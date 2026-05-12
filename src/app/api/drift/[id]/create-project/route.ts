import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";
import { asana as asanaActions } from "@/lib/actions";
import { findProjectByName } from "@/lib/actions/asana";
import { webpush } from "@/lib/push";

const client = new Anthropic();

const SYSTEM = `You are helping an agency tool create a new Asana project from a detected decision in an email.

Given the decision summary and draft update, extract:
- project_name: short, capitalized client or project name (1 to 4 words). Examples: "Acme", "Acme Launch", "Skull Tattoo Brand"
- task_name: short task description (2 to 5 words). Examples: "Launch", "Brand identity v2", "Kickoff meeting"
- due_date: ISO date YYYY-MM-DD if a date is mentioned, else null. Examples: "2026-05-25"

Return JSON only, no markdown:
{
  "project_name": "...",
  "task_name": "...",
  "due_date": "YYYY-MM-DD or null"
}`;

async function extractProjectShape(
  decisionSummary: string,
  draftUpdate: string
): Promise<{ projectName: string; taskName: string; dueOn: string | null }> {
  const userText = `Decision: ${decisionSummary}\n\nDraft update: ${draftUpdate}`;
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      projectName: typeof parsed.project_name === "string" ? parsed.project_name.trim() : "New project",
      taskName: typeof parsed.task_name === "string" ? parsed.task_name.trim() : "Decision logged",
      dueOn:
        typeof parsed.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date)
          ? parsed.due_date
          : null,
    };
  } catch {
    return { projectName: "New project", taskName: "Decision logged", dueOn: null };
  }
}

function gmailUrlForExternal(externalId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${externalId}`;
}

export async function POST(
  _request: Request,
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
      "id, workspace_id, user_id, decision_summary, draft_update, asana_item_id, status, source, source_external_id"
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

  let extracted: { projectName: string; taskName: string; dueOn: string | null };
  try {
    extracted = await extractProjectShape(
      finding.decision_summary as string,
      finding.draft_update as string
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Sonnet extraction failed: ${message}` }, { status: 502 });
  }

  // Dedup: see if a project with this name already exists in the team.
  let projectGid: string;
  let projectName: string;
  let projectPermalink: string | null = null;
  let wasExistingProject = false;
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Create the task in that project.
  let taskGid: string;
  let taskName: string;
  let taskPermalink: string | null = null;
  try {
    const t = await asanaActions.createTask(ctx, {
      projectGid,
      name: extracted.taskName,
      dueOn: extracted.dueOn,
      notes: undefined,
    });
    taskGid = t.taskGid;
    taskName = t.taskName;
    taskPermalink = t.permalinkUrl;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Add the draft update as a comment on the new task.
  try {
    await asanaActions.addComment(
      ctx,
      taskGid,
      finding.draft_update as string,
      finding.source === "gmail"
        ? gmailUrlForExternal(finding.source_external_id as string)
        : undefined
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
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
        name: taskName,
        project_name: projectName,
        due_date: extracted.dueOn,
        status: "open",
        permalink_url: taskPermalink,
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
  await service
    .from("drift_findings")
    .update({
      asana_item_id: itemRow.id as number,
      status: "accepted",
      resolved_at: new Date().toISOString(),
      resolution_note: "created_new_project",
    })
    .eq("id", findingId);

  // Best-effort team broadcast — no participant narrowing on a brand-new task.
  broadcastToTeam(workspaceId, user.id, finding.decision_summary as string, taskName).catch((err) =>
    console.error("[drift create-project] broadcast error:", err)
  );

  return NextResponse.json({
    status: "created",
    project_gid: projectGid,
    project_name: projectName,
    project_permalink_url: projectPermalink,
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
