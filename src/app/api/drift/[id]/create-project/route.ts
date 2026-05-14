import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";
import { asana as asanaActions } from "@/lib/actions";
import { findProjectByName } from "@/lib/actions/asana";
import { webpush } from "@/lib/push";
import { extractProjectShape } from "@/lib/extract-project-shape";
import { encryptForBytea, decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";
import { isReauthError, reauthErrorToResponse } from "@/lib/oauth-errors";
import { getExistingActionTargetId, hasActionSucceeded } from "@/lib/action-log-idempotency";

function gmailUrlForExternal(externalId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${externalId}`;
}

function pickString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function pickDueOn(...values: unknown[]): string | null | undefined {
  for (const v of values) {
    if (v === null) return null;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length === 0) continue;
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    }
  }
  return undefined;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const findingId = parseInt(id, 10);
  if (!Number.isFinite(findingId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: finding } = await service
    .from("drift_findings")
    .select(
      "id, workspace_id, user_id, decision_summary_enc, draft_update_enc, asana_item_id, status, source, source_external_id"
    )
    .eq("id", findingId)
    .maybeSingle();

  if (!finding) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (finding.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (finding.status !== "pending") {
    return NextResponse.json({ status: "already-resolved", finding_status: finding.status });
  }

  const workspaceId = finding.workspace_id as string;
  const findingUserId = finding.user_id as string;
  const findingSource = finding.source as string;
  const findingSourceExternalId = finding.source_external_id as string;
  const decisionSummary = decryptColumn(
    finding.decision_summary_enc as Buffer | null | undefined,
    aad.driftFindingsDecisionSummary(workspaceId, findingUserId, findingSource, findingSourceExternalId)
  );
  const draftUpdate = decryptColumn(
    finding.draft_update_enc as Buffer | null | undefined,
    aad.driftFindingsDraftUpdate(workspaceId, findingUserId, findingSource, findingSourceExternalId)
  );

  const { data: settings } = await service
    .from("workspace_settings")
    .select("asana_workspace_gid, asana_team_gid, asana_default_privacy")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const asanaWorkspaceGid = settings?.asana_workspace_gid as string | null | undefined;
  const asanaTeamGid = settings?.asana_team_gid as string | null | undefined;
  const defaultPrivacy = (settings?.asana_default_privacy as string | undefined) ?? "public_to_team";

  if (!asanaWorkspaceGid || !asanaTeamGid) {
    return NextResponse.json(
      { error: "Asana defaults not configured. Visit /connect to set them up." },
      { status: 400 }
    );
  }

  const ctx = {
    workspaceId,
    driftFindingId: finding.id as number,
    executedBy: user.id,
  };

  // Parse optional body — SW passes pre-extracted suggestion to skip the second Sonnet call.
  // Accept both snake_case (SW) and camelCase keys.
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed body; fall through to Sonnet.
  }

  const bodyProjectName = pickString(body.project_name, body.projectName);
  const bodySectionName = pickString(body.section_name, body.sectionName);
  const bodyTaskName = pickString(body.task_name, body.taskName);
  const bodyDueOn = pickDueOn(body.due_on, body.dueOn);

  let extracted: {
    projectName: string;
    sectionName: string;
    taskName: string;
    dueOn: string | null;
  };
  if (bodyProjectName && bodySectionName && bodyTaskName && bodyDueOn !== undefined) {
    extracted = {
      projectName: bodyProjectName,
      sectionName: bodySectionName,
      taskName: bodyTaskName,
      dueOn: bodyDueOn,
    };
  } else {
    try {
      const shape = await extractProjectShape(decisionSummary, draftUpdate);
      extracted = {
        projectName: bodyProjectName ?? shape.projectName,
        sectionName: bodySectionName ?? shape.sectionName,
        taskName: bodyTaskName ?? shape.taskName,
        dueOn: bodyDueOn !== undefined ? bodyDueOn : shape.dueOn,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Sonnet extraction failed: ${message}` }, { status: 502 });
    }
  }

  // Defensive: ensure required strings are never empty.
  if (!extracted.projectName) extracted.projectName = "New project";
  if (!extracted.sectionName) extracted.sectionName = "Decisions";
  if (!extracted.taskName) extracted.taskName = "Decision logged";

  // Forward-only idempotency. If a prior attempt on this finding already
  // succeeded at any step, reuse the Asana gids from action_log instead of
  // re-creating. Partial-failure retries are safe.
  let projectGid: string;
  let projectName: string;
  let projectPermalink: string | null = null;
  let wasExistingProject = false;
  const loggedProjectGid = await getExistingActionTargetId(service, findingId, "asana.create_project");
  if (loggedProjectGid) {
    projectGid = loggedProjectGid;
    projectName = extracted.projectName;
    wasExistingProject = true;
  } else {
    // Dedup: see if a project with this name already exists in the team.
    try {
      const existing = await findProjectByName(workspaceId, user.id, asanaTeamGid, extracted.projectName);
      if (existing) {
        projectGid = existing.gid;
        projectName = existing.name;
        projectPermalink = existing.permalinkUrl;
        wasExistingProject = true;
      } else {
        const created = await asanaActions.createProject(ctx, {
          teamGid: asanaTeamGid,
          workspaceGid: asanaWorkspaceGid,
          name: extracted.projectName,
          isPublic: defaultPrivacy !== "private",
        });
        projectGid = created.projectGid;
        projectName = created.projectName;
        projectPermalink = created.permalinkUrl;
      }
    } catch (err: unknown) {
      if (isReauthError(err)) return reauthErrorToResponse(err)!;
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Create a section inside the project. Tolerant: if Asana rejects (free-plan
  // quirks, transient API errors) we log + swallow and continue without a section.
  let sectionGid: string | null = null;
  let sectionName: string | null = null;
  const loggedSectionGid = await getExistingActionTargetId(service, findingId, "asana.create_section");
  if (loggedSectionGid) {
    sectionGid = loggedSectionGid;
    sectionName = extracted.sectionName;
  } else {
    try {
      const s = await asanaActions.createSection(ctx, {
        projectGid,
        name: extracted.sectionName,
      });
      sectionGid = s.sectionGid;
      sectionName = s.sectionName;
    } catch (err: unknown) {
      if (isReauthError(err)) return reauthErrorToResponse(err)!;
      const message = err instanceof Error ? err.message : String(err);
      console.error("[drift create-project] createSection failed, continuing without section:", message);
    }
  }

  // Create the task in that project (placed in the section if we got one).
  let taskGid: string;
  let taskName: string;
  let taskPermalink: string | null = null;
  const loggedTaskGid = await getExistingActionTargetId(service, findingId, "asana.create_task");
  if (loggedTaskGid) {
    taskGid = loggedTaskGid;
    taskName = extracted.taskName;
  } else {
    try {
      const t = await asanaActions.createTask(ctx, {
        projectGid,
        name: extracted.taskName,
        dueOn: extracted.dueOn,
        notes: undefined,
        sectionGid,
      });
      taskGid = t.taskGid;
      taskName = t.taskName;
      taskPermalink = t.permalinkUrl;
    } catch (err: unknown) {
      if (isReauthError(err)) return reauthErrorToResponse(err)!;
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Add the draft update as a comment on the new task. Skip if a prior retry
  // already commented on this finding — Asana stories are not deduped server-
  // side so re-commenting would create spam.
  if (!(await hasActionSucceeded(service, findingId, "asana.add_comment"))) {
    try {
      await asanaActions.addComment(
        ctx,
        taskGid,
        draftUpdate,
        findingSource === "gmail"
          ? gmailUrlForExternal(findingSourceExternalId)
          : undefined
      );
    } catch (err: unknown) {
      if (isReauthError(err)) return reauthErrorToResponse(err)!;
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Persist the new task as an asana_items row (idempotent via upsert).
  const { data: itemRow, error: itemErr } = await service
    .from("asana_items")
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: user.id,
        external_id: taskGid,
        type: "task",
        name_enc: encryptForBytea(
          taskName,
          aad.asanaItemsName(workspaceId, user.id, taskGid)
        ),
        project_name_enc: projectName
          ? encryptForBytea(
              projectName,
              aad.asanaItemsProjectName(workspaceId, user.id, taskGid)
            )
          : null,
        due_date_enc: extracted.dueOn
          ? encryptForBytea(
              extracted.dueOn,
              aad.asanaItemsDueDate(workspaceId, user.id, taskGid)
            )
          : null,
        status: "open",
        permalink_url_enc: taskPermalink
          ? encryptForBytea(
              taskPermalink,
              aad.asanaItemsPermalinkUrl(workspaceId, user.id, taskGid)
            )
          : null,
        modified_at: Date.now(),
        synced_at: Date.now(),
      },
      { onConflict: "workspace_id,user_id,external_id" }
    )
    .select("id")
    .single();

  if (itemErr || !itemRow) {
    return NextResponse.json(
      { error: itemErr?.message ?? "Failed to persist asana_items row" },
      { status: 500 }
    );
  }

  // Resolve the drift finding.
  const resolutionNote = "created_new_project";
  await service
    .from("drift_findings")
    .update({
      asana_item_id: itemRow.id as number,
      status: "accepted",
      resolved_at: new Date().toISOString(),
      resolution_note_enc: encryptForBytea(
        resolutionNote,
        aad.driftFindingsResolutionNote(workspaceId, findingUserId, findingSource, findingSourceExternalId)
      ),
    })
    .eq("id", findingId);

  // Best-effort team broadcast — no participant narrowing on a brand-new task.
  broadcastToTeam(workspaceId, user.id, decisionSummary, taskName).catch((err) =>
    console.error("[drift create-project] broadcast error:", err)
  );

  return NextResponse.json({
    status: "created",
    project_gid: projectGid,
    project_name: projectName,
    project_permalink_url: projectPermalink,
    section_gid: sectionGid,
    section_name: sectionName,
    task_gid: taskGid,
    task_name: taskName,
    task_permalink_url: taskPermalink,
    asana_item_id: itemRow.id as number,
    was_existing_project: wasExistingProject,
  });
}

async function broadcastToTeam(
  workspaceId: string,
  actorUserId: string,
  summary: string,
  taskName: string | null
): Promise<void> {
  const service = createServiceClient();

  const { data: members } = await service
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .neq("user_id", actorUserId);
  if (!members?.length) return;
  const memberIds = members.map((m) => m.user_id as string);

  const { data: subs } = await service
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", memberIds);
  if (!subs?.length) return;

  const title = taskName ? `New project: ${taskName}` : "Project update";
  const body = summary.slice(0, 200);
  const payload = JSON.stringify({
    title,
    body,
    tag: `gerendo-broadcast-${Date.now()}`,
    data: {},
  });

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        payload
      )
    )
  );
}
