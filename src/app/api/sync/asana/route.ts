import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAsanaToken, asanaGet } from "@/lib/agency-db";
import { embedTexts } from "@/lib/embed";
import { encryptForBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export const maxDuration = 300;

function chunkText(text: string, size = 1500): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk.length > 30) chunks.push(chunk);
  }
  return chunks;
}

export async function syncSingleAsanaTask(workspaceId: string, userId: string, taskGid: string): Promise<void> {
  const supabase = createServiceClient();
  const token = await getAsanaToken(workspaceId, userId);

  const task = await asanaGet(token,
    `/tasks/${taskGid}?opt_fields=gid,name,notes,completed,assignee.name,due_on,permalink_url,modified_at,memberships.project.name`
  );

  const projectName = task.memberships?.[0]?.project?.name ?? null;

  let comments = "";
  try {
    const stories = await asanaGet(token, `/tasks/${taskGid}/stories?opt_fields=type,text,created_by.name`);
    comments = (stories ?? [])
      .filter((s: any) => s.type === "comment" && s.text)
      .map((s: any) => `${s.created_by?.name ?? "Unknown"}: ${s.text}`)
      .join("\n");
  } catch {}

  const textParts = [
    projectName ? `Project: ${projectName}` : null,
    `Task: ${task.name}`,
    task.assignee?.name ? `Assignee: ${task.assignee.name}` : null,
    task.due_on ? `Due: ${task.due_on}` : null,
    task.completed ? "Status: Completed" : "Status: Open",
    task.notes ? `Description: ${task.notes}` : null,
    comments ? `Comments:\n${comments}` : null,
  ].filter(Boolean).join("\n");

  const modifiedAt = new Date(task.modified_at ?? Date.now()).getTime();

  const { data: itemRow } = await supabase
    .from("asana_items")
    .upsert({
      workspace_id: workspaceId,
      user_id: userId,
      external_id: task.gid,
      type: "task",
      name: task.name,
      project_name: projectName,
      assignee: task.assignee?.name ?? null,
      due_date: task.due_on ?? null,
      status: task.completed ? "completed" : "open",
      notes: task.notes ?? null,
      permalink_url: task.permalink_url ?? null,
      modified_at: modifiedAt,
      synced_at: Date.now(),
    }, { onConflict: "workspace_id,user_id,external_id" })
    .select("id")
    .single();

  if (!itemRow) return;

  const chunks = chunkText(textParts);
  if (chunks.length === 0) return;

  const embeddings = await embedTexts(chunks);
  await supabase.from("asana_embeddings").delete().eq("item_id", itemRow.id);
  await supabase.from("asana_embeddings").insert(
    chunks.map((chunk, i) => ({
      workspace_id: workspaceId,
      user_id: userId,
      item_id: itemRow.id,
      chunk_index: i,
      embedding: Array.from(embeddings[i]),
      keyword_text_enc: encryptForBytea(
        chunk,
        aad.asanaEmbeddingsKeywordText(workspaceId, itemRow.id, i)
      ),
      indexed_at: Date.now(),
    }))
  );
}

export async function runAsanaSyncForUser(workspaceId: string, userId: string): Promise<{ synced: number; skipped: number }> {
  const supabase = createServiceClient();
  const token = await getAsanaToken(workspaceId, userId);

  let synced = 0;
  let skipped = 0;

  const workspaces = await asanaGet(token, "/workspaces");

  for (const ws of workspaces) {
    let projects: any[] = [];
    try {
      projects = await asanaGet(token, `/projects?workspace=${ws.gid}&limit=100&opt_fields=gid,name,permalink_url,modified_at`);
    } catch { continue; }

    for (const project of projects) {
      let tasks: any[] = [];
      try {
        tasks = await asanaGet(token,
          `/tasks?project=${project.gid}&limit=100&opt_fields=gid,name,notes,completed,assignee.name,due_on,permalink_url,modified_at`
        );
      } catch { continue; }

      for (const task of tasks) {
        try {
          const modifiedAt = new Date(task.modified_at ?? Date.now()).getTime();

          const { data: existing } = await supabase
            .from("asana_items")
            .select("id, synced_at")
            .eq("workspace_id", workspaceId)
            .eq("external_id", task.gid)
            .maybeSingle();

          if (existing && existing.synced_at >= modifiedAt) {
            skipped++;
            continue;
          }

          let comments = "";
          try {
            const stories = await asanaGet(token, `/tasks/${task.gid}/stories?opt_fields=type,text,created_by.name,created_at`);
            comments = (stories ?? [])
              .filter((s: any) => s.type === "comment" && s.text)
              .map((s: any) => `${s.created_by?.name ?? "Unknown"}: ${s.text}`)
              .join("\n");
          } catch {}

          const textParts = [
            `Project: ${project.name}`,
            `Task: ${task.name}`,
            task.assignee?.name ? `Assignee: ${task.assignee.name}` : null,
            task.due_on ? `Due: ${task.due_on}` : null,
            task.completed ? "Status: Completed" : "Status: Open",
            task.notes ? `Description: ${task.notes}` : null,
            comments ? `Comments:\n${comments}` : null,
          ].filter(Boolean).join("\n");

          const { data: itemRow, error: itemErr } = await supabase
            .from("asana_items")
            .upsert({
              workspace_id: workspaceId,
              user_id: userId,
              external_id: task.gid,
              type: "task",
              name: task.name,
              project_name: project.name,
              assignee: task.assignee?.name ?? null,
              due_date: task.due_on ?? null,
              status: task.completed ? "completed" : "open",
              notes: task.notes ?? null,
              permalink_url: task.permalink_url ?? null,
              modified_at: modifiedAt,
              synced_at: Date.now(),
            }, { onConflict: "workspace_id,user_id,external_id" })
            .select("id")
            .single();

          if (itemErr || !itemRow) continue;

          const chunks = chunkText(textParts);
          if (chunks.length === 0) { skipped++; continue; }

          const embeddings = await embedTexts(chunks);
          await supabase.from("asana_embeddings").delete().eq("item_id", itemRow.id);
          await supabase.from("asana_embeddings").insert(
            chunks.map((chunk, i) => ({
              workspace_id: workspaceId,
              user_id: userId,
              item_id: itemRow.id,
              chunk_index: i,
              embedding: Array.from(embeddings[i]),
              keyword_text_enc: encryptForBytea(
                chunk,
                aad.asanaEmbeddingsKeywordText(workspaceId, itemRow.id, i)
              ),
              indexed_at: Date.now(),
            }))
          );
          synced++;
        } catch (err: any) {
          console.error(`[asana] task failed:`, err?.message);
          continue;
        }
      }
    }
  }

  return { synced, skipped };
}

export async function POST(): Promise<NextResponse> {
  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) return _ws; const { workspaceId, userId } = _ws;

  try {
    const result = await runAsanaSyncForUser(workspaceId, userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status: 500 });
  }
}
