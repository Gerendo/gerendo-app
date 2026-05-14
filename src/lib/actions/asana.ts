import { createServiceClient } from "@/lib/supabase-server";
import { getAsanaToken, asanaGet, asanaPost } from "@/lib/agency-db";
import { encryptForBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export type ActionContext = {
  workspaceId: string;
  driftFindingId: number | null;
  executedBy: string;
};

type LogArgs = {
  actionType: string;
  targetId: string | null;
  payloadBefore: unknown;
  payloadAfter: unknown;
  status: "success" | "failed";
};

// Sweep stale "pending" action_log rows older than 5 minutes — anything that
// old is the carcass of a function that died between the stub insert and the
// payload update. Vercel's max function duration is 300s, so 5 minutes is a
// safe horizon. Runs inline before each new logAction so no cron is needed.
async function sweepStaleActionLog(supabase: ReturnType<typeof createServiceClient>, workspaceId: string): Promise<void> {
  const cutoffIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase
    .from("action_log")
    .update({ status: "failed" })
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .lt("executed_at", cutoffIso);
}

// Two-step insert: write the operational fields with status="pending" first
// to get a row id, then encrypt the JSON payloads using that id in the AAD,
// UPDATE the row with payloads, and finally flip status to the caller's
// terminal value. If encryption or the second UPDATE fails the row stays
// "pending" — undo skips it cleanly and the orphan is identifiable for
// cleanup rather than presenting as a successful action with no payload.
async function logAction(ctx: ActionContext, args: LogArgs): Promise<number> {
  const supabase = createServiceClient();
  // Fire-and-forget sweep — failures here must not block the new write.
  sweepStaleActionLog(supabase, ctx.workspaceId).catch(() => {});
  const { data: row, error: insErr } = await supabase
    .from("action_log")
    .insert({
      workspace_id: ctx.workspaceId,
      drift_finding_id: ctx.driftFindingId,
      action_type: args.actionType,
      target_system: "asana",
      target_id: args.targetId,
      executed_by: ctx.executedBy,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !row) throw new Error(`logAction insert: ${insErr?.message ?? "unknown"}`);
  const id = row.id as number;

  const updates: {
    payload_before_enc?: string;
    payload_after_enc?: string;
    status: "success" | "failed";
  } = { status: args.status };
  if (args.payloadBefore !== null && args.payloadBefore !== undefined) {
    updates.payload_before_enc = encryptForBytea(
      JSON.stringify(args.payloadBefore),
      aad.actionLogPayloadBefore(id)
    );
  }
  if (args.payloadAfter !== null && args.payloadAfter !== undefined) {
    updates.payload_after_enc = encryptForBytea(
      JSON.stringify(args.payloadAfter),
      aad.actionLogPayloadAfter(id)
    );
  }
  const { error: updErr } = await supabase
    .from("action_log")
    .update(updates)
    .eq("id", id);
  if (updErr) throw new Error(`logAction update: ${updErr.message}`);
  return id;
}

// Asana update uses PUT, which is not exported from agency-db. Define inline.
async function asanaPut(token: string, path: string, body: object): Promise<any> {
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ??
        `Asana API error ${res.status}: ${path}`
    );
  }
  const json = await res.json();
  return json.data;
}

export async function updateTask(
  ctx: ActionContext,
  taskGid: string,
  fields: { due_on?: string | null; name?: string; notes?: string; completed?: boolean }
): Promise<{ logId: number; before: unknown; after: unknown }> {
  const token = await getAsanaToken(ctx.workspaceId, ctx.executedBy);
  const before = await asanaGet(token, `/tasks/${taskGid}?opt_fields=name,due_on,notes,completed`);
  try {
    const after = await asanaPut(token, `/tasks/${taskGid}`, fields);
    const logId = await logAction(ctx, {
      actionType: "asana.update_task",
      targetId: taskGid,
      payloadBefore: before,
      payloadAfter: after,
      status: "success",
    });
    return { logId, before, after };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logAction(ctx, {
      actionType: "asana.update_task",
      targetId: taskGid,
      payloadBefore: before,
      payloadAfter: { error: message, fields },
      status: "failed",
    });
    throw err;
  }
}

export async function addComment(
  ctx: ActionContext,
  taskGid: string,
  body: string,
  citationUrl?: string
): Promise<{ logId: number; commentGid: string }> {
  const token = await getAsanaToken(ctx.workspaceId, ctx.executedBy);
  const text = citationUrl ? `${body}\n\nSource: ${citationUrl}` : body;
  try {
    const data = await asanaPost(token, `/tasks/${taskGid}/stories`, { text });
    const logId = await logAction(ctx, {
      actionType: "asana.add_comment",
      targetId: taskGid,
      payloadBefore: null,
      payloadAfter: { story_gid: data.gid, text },
      status: "success",
    });
    return { logId, commentGid: data.gid as string };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logAction(ctx, {
      actionType: "asana.add_comment",
      targetId: taskGid,
      payloadBefore: null,
      payloadAfter: { error: message, text },
      status: "failed",
    });
    throw err;
  }
}

export async function createProject(
  ctx: ActionContext,
  args: { teamGid: string; workspaceGid: string; name: string; isPublic: boolean }
): Promise<{ logId: number; projectGid: string; projectName: string; permalinkUrl: string | null }> {
  const token = await getAsanaToken(ctx.workspaceId, ctx.executedBy);

  // Asana free plans don't have teams. Try with team first (paid org behaviour),
  // fall back to workspace-only on any error so the same code works across plans.
  let data: { gid?: string; name?: string; permalink_url?: string } | null = null;
  let firstError: string | null = null;
  try {
    data = await asanaPost(token, "/projects", {
      name: args.name,
      team: args.teamGid,
      workspace: args.workspaceGid,
    });
  } catch (err: unknown) {
    firstError = err instanceof Error ? err.message : String(err);
  }

  if (!data) {
    try {
      data = await asanaPost(token, "/projects", {
        name: args.name,
        workspace: args.workspaceGid,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await logAction(ctx, {
        actionType: "asana.create_project",
        targetId: null,
        payloadBefore: null,
        payloadAfter: { error: message, fallback_error: firstError, args },
        status: "failed",
      });
      throw err;
    }
  }

  if (!data) throw new Error("Asana createProject returned no data");
  const created = data;
  const logId = await logAction(ctx, {
    actionType: "asana.create_project",
    targetId: (created.gid as string) ?? null,
    payloadBefore: null,
    payloadAfter: created,
    status: "success",
  });
  return {
    logId,
    projectGid: created.gid as string,
    projectName: (created.name as string) ?? args.name,
    permalinkUrl: (created.permalink_url as string | undefined) ?? null,
  };
}

export async function createSection(
  ctx: ActionContext,
  args: { projectGid: string; name: string }
): Promise<{ logId: number; sectionGid: string; sectionName: string }> {
  const token = await getAsanaToken(ctx.workspaceId, ctx.executedBy);
  try {
    const data = await asanaPost(token, `/projects/${args.projectGid}/sections`, {
      name: args.name,
    });
    const logId = await logAction(ctx, {
      actionType: "asana.create_section",
      targetId: (data.gid as string) ?? null,
      payloadBefore: null,
      payloadAfter: data,
      status: "success",
    });
    return {
      logId,
      sectionGid: data.gid as string,
      sectionName: (data.name as string) ?? args.name,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logAction(ctx, {
      actionType: "asana.create_section",
      targetId: null,
      payloadBefore: null,
      payloadAfter: { error: message, args },
      status: "failed",
    });
    throw err;
  }
}

export async function createTask(
  ctx: ActionContext,
  args: {
    projectGid: string;
    name: string;
    dueOn: string | null;
    notes?: string;
    sectionGid?: string | null;
  }
): Promise<{ logId: number; taskGid: string; taskName: string; permalinkUrl: string | null }> {
  const token = await getAsanaToken(ctx.workspaceId, ctx.executedBy);
  const body: Record<string, unknown> = {
    name: args.name,
  };
  // When a section is set, place the task in the section via memberships.
  // Otherwise fall back to the simple projects array.
  if (args.sectionGid) {
    body.memberships = [{ project: args.projectGid, section: args.sectionGid }];
  } else {
    body.projects = [args.projectGid];
  }
  if (args.dueOn) body.due_on = args.dueOn;
  if (args.notes) body.notes = args.notes;
  try {
    const data = await asanaPost(token, "/tasks", body);
    const logId = await logAction(ctx, {
      actionType: "asana.create_task",
      targetId: (data.gid as string) ?? null,
      payloadBefore: null,
      payloadAfter: data,
      status: "success",
    });
    return {
      logId,
      taskGid: data.gid as string,
      taskName: (data.name as string) ?? args.name,
      permalinkUrl: (data.permalink_url as string | undefined) ?? null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logAction(ctx, {
      actionType: "asana.create_task",
      targetId: null,
      payloadBefore: null,
      payloadAfter: { error: message, args },
      status: "failed",
    });
    throw err;
  }
}

// Look up an existing project in a team by name (case-insensitive). Not logged.
export async function findProjectByName(
  workspaceId: string,
  executedBy: string,
  teamGid: string,
  name: string
): Promise<{ gid: string; name: string; permalinkUrl: string | null } | null> {
  const token = await getAsanaToken(workspaceId, executedBy);
  const target = name.toLowerCase().trim();
  try {
    const projects = await asanaGet(
      token,
      `/projects?team=${teamGid}&opt_fields=gid,name,permalink_url`
    );
    for (const p of (projects ?? []) as Array<{ gid: string; name: string; permalink_url?: string }>) {
      if (typeof p.name === "string" && p.name.toLowerCase().trim() === target) {
        return { gid: p.gid, name: p.name, permalinkUrl: p.permalink_url ?? null };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Fetch task assignee + followers (with emails) for team broadcast matching.
export async function getTaskParticipantEmails(
  workspaceId: string,
  userId: string,
  taskGid: string
): Promise<string[]> {
  try {
    const token = await getAsanaToken(workspaceId, userId);
    const task = await asanaGet(
      token,
      `/tasks/${taskGid}?opt_fields=assignee.email,followers.email`
    );
    const emails: string[] = [];
    if (task.assignee?.email) emails.push(String(task.assignee.email).toLowerCase());
    for (const f of (task.followers as Array<{ email?: string }>) ?? []) {
      if (f.email) emails.push(String(f.email).toLowerCase());
    }
    return emails;
  } catch {
    return [];
  }
}
