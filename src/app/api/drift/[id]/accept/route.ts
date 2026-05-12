import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";
import { asana as asanaActions } from "@/lib/actions";
import { getTaskParticipantEmails } from "@/lib/actions/asana";
import { webpush } from "@/lib/push";
import { extractProjectShape } from "@/lib/extract-project-shape";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function extractDateFromText(text: string): string | null {
  // ISO date YYYY-MM-DD
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const lower = text.toLowerCase();
  const year = new Date().getFullYear();
  for (let i = 0; i < MONTHS.length; i++) {
    const m = MONTHS[i];
    const month = String(i + 1).padStart(2, "0");
    const re1 = new RegExp(`\\b${m}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i");
    const match1 = lower.match(re1);
    if (match1) {
      const day = String(parseInt(match1[1], 10)).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    const re2 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${m}\\b`, "i");
    const match2 = lower.match(re2);
    if (match2) {
      const day = String(parseInt(match2[1], 10)).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  return null;
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
    .select("id, workspace_id, user_id, decision_summary, draft_update, asana_item_id, status, source, source_external_id")
    .eq("id", findingId)
    .maybeSingle();

  if (!finding) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (finding.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (finding.status !== "pending") {
    return NextResponse.json({ status: "already-resolved", finding_status: finding.status });
  }

  const ctx = {
    workspaceId: finding.workspace_id as string,
    driftFindingId: finding.id as number,
    executedBy: user.id,
  };

  const results: Array<{ action: string; logId?: number; ok: boolean; error?: string }> = [];
  let taskGid: string | null = null;
  let taskName: string | null = null;

  if (finding.asana_item_id) {
    const { data: asanaItem } = await service
      .from("asana_items")
      .select("external_id, name")
      .eq("id", finding.asana_item_id)
      .maybeSingle();
    taskGid = asanaItem?.external_id ?? null;
    taskName = asanaItem?.name ?? null;
  }

  // No match found at detect time. Run Sonnet to suggest a project shape so the SW
  // can prompt the user to create a new project — without leaving the notification.
  // Leave status as "pending" so missed prompts still appear in /drift/pending.
  if (!taskGid) {
    let shape;
    try {
      shape = await extractProjectShape(
        finding.decision_summary as string,
        finding.draft_update as string
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Sonnet extraction failed: ${message}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: "no_match_pending",
      task_linked: false,
      finding_id: findingId,
      suggested: {
        project_name: shape.projectName,
        section_name: shape.sectionName,
        task_name: shape.taskName,
        due_on: shape.dueOn,
      },
      create_url: `/api/drift/${findingId}/create-project`,
      skip_url: `/api/drift/${findingId}/skip`,
    });
  }

  if (taskGid) {
    const detectedDate = extractDateFromText(finding.decision_summary as string);
    if (detectedDate) {
      try {
        const r = await asanaActions.updateTask(ctx, taskGid, { due_on: detectedDate });
        results.push({ action: "asana.update_task", logId: r.logId, ok: true });
      } catch (err: unknown) {
        results.push({
          action: "asana.update_task",
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    try {
      const r = await asanaActions.addComment(
        ctx,
        taskGid,
        finding.draft_update as string,
        finding.source === "gmail" ? gmailUrlForExternal(finding.source_external_id as string) : undefined
      );
      results.push({ action: "asana.add_comment", logId: r.logId, ok: true });
    } catch (err: unknown) {
      results.push({
        action: "asana.add_comment",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await service
    .from("drift_findings")
    .update({
      status: "accepted",
      resolved_at: new Date().toISOString(),
      resolution_note: taskGid ? null : "no_asana_task_linked",
    })
    .eq("id", findingId);

  // Best-effort team broadcast. Don't block the SW response on this.
  broadcastToTeam(
    ctx.workspaceId,
    user.id,
    finding.decision_summary as string,
    taskName,
    taskGid
  ).catch((err) => console.error("[drift accept] broadcast error:", err));

  return NextResponse.json({ status: "accepted", task_linked: !!taskGid, results });
}

async function broadcastToTeam(
  workspaceId: string,
  actorUserId: string,
  summary: string,
  taskName: string | null,
  taskGid: string | null
): Promise<void> {
  const service = createServiceClient();

  // Fetch all workspace members except the actor.
  const { data: members } = await service
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .neq("user_id", actorUserId);
  if (!members?.length) return;
  let memberIds = members.map((m) => m.user_id as string);

  // If we have an Asana task, narrow broadcast to actual assignee + followers by email.
  if (taskGid) {
    try {
      const participantEmails = await getTaskParticipantEmails(workspaceId, actorUserId, taskGid);
      if (participantEmails.length) {
        const lookups = await Promise.all(
          memberIds.map(async (uid) => {
            const { data } = await service.auth.admin.getUserById(uid);
            return { uid, email: data.user?.email?.toLowerCase() ?? null };
          })
        );
        const matched = lookups
          .filter((row) => row.email && participantEmails.includes(row.email))
          .map((row) => row.uid);
        if (matched.length) memberIds = matched;
      }
    } catch {
      // Fall back to broadcasting to all workspace members.
    }
  }

  if (!memberIds.length) return;

  const { data: subs } = await service
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", memberIds);
  if (!subs?.length) return;

  const title = taskName ? `Update on ${taskName}` : "Project update";
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
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        payload
      )
    )
  );
}
