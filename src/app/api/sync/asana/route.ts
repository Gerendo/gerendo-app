import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import {  } from "@/lib/agency-db";
import { embedTexts } from "@/lib/embed";

export const maxDuration = 300;

async function getAsanaToken(workspaceId: string, userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "asana")
    .maybeSingle();

  if (!data) throw new Error("Asana not connected");

  if (data.expires_at && Date.now() > data.expires_at - 60000 && data.refresh_token) {
    const res = await fetch("https://app.asana.com/-/oauth_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.ASANA_CLIENT_ID!,
        client_secret: process.env.ASANA_CLIENT_SECRET!,
        refresh_token: data.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokens = await res.json();
    if (tokens.access_token) {
      await supabase.from("oauth_tokens").update({
        access_token: tokens.access_token,
        expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      }).eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "asana");
      return tokens.access_token;
    }
  }

  return data.access_token;
}

async function asanaGet(token: string, path: string): Promise<any> {
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`Asana API error ${res.status}: ${path}`);
  const json = await res.json();
  return json.data;
}

function chunkText(text: string, size = 1500): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk.length > 30) chunks.push(chunk);
  }
  return chunks;
}

export async function POST(): Promise<NextResponse> {
  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) return _ws; const { workspaceId, userId } = _ws;
  const supabase = createServiceClient();

  let token: string;
  try {
    token = await getAsanaToken(workspaceId, userId);
  } catch (err) {
    return NextResponse.json({ error: "Asana not connected", details: String(err) }, { status: 401 });
  }

  let synced = 0;
  let skipped = 0;

  try {
    // Get all workspaces the user belongs to
    const workspaces = await asanaGet(token, "/workspaces");

    for (const ws of workspaces) {
      // Get all projects in this workspace
      let projects: any[] = [];
      try {
        projects = await asanaGet(token, `/projects?workspace=${ws.gid}&limit=100&opt_fields=gid,name,permalink_url,modified_at`);
      } catch { continue; }

      for (const project of projects) {
        // Get all tasks in this project with full details
        let tasks: any[] = [];
        try {
          tasks = await asanaGet(token,
            `/tasks?project=${project.gid}&limit=100&opt_fields=gid,name,notes,completed,assignee.name,due_on,permalink_url,modified_at`
          );
        } catch { continue; }

        for (const task of tasks) {
          try {
            const modifiedAt = new Date(task.modified_at ?? Date.now()).getTime();

            // Check if already synced and up to date
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

            // Fetch comments for this task
            let comments = "";
            try {
              const stories = await asanaGet(token,
                `/tasks/${task.gid}/stories?opt_fields=type,text,created_by.name,created_at`
              );
              const commentStories = (stories ?? [])
                .filter((s: any) => s.type === "comment" && s.text)
                .map((s: any) => `${s.created_by?.name ?? "Unknown"}: ${s.text}`)
                .join("\n");
              if (commentStories) comments = commentStories;
            } catch {}

            // Build text for embedding
            const textParts = [
              `Project: ${project.name}`,
              `Task: ${task.name}`,
              task.assignee?.name ? `Assignee: ${task.assignee.name}` : null,
              task.due_on ? `Due: ${task.due_on}` : null,
              task.completed ? "Status: Completed" : "Status: Open",
              task.notes ? `Description: ${task.notes}` : null,
              comments ? `Comments:\n${comments}` : null,
            ].filter(Boolean).join("\n");

            // Upsert item record
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

            // Chunk + embed
            const chunks = chunkText(textParts);
            if (chunks.length === 0) { skipped++; continue; }

            const embeddings = await embedTexts(chunks);

            await supabase.from("asana_embeddings").delete().eq("item_id", itemRow.id);

            const embRows = chunks.map((chunk, i) => ({
              workspace_id: workspaceId,
              item_id: itemRow.id,
              chunk_index: i,
              embedding: Array.from(embeddings[i]),
              keyword_text: chunk,
              indexed_at: Date.now(),
            }));

            await supabase.from("asana_embeddings").insert(embRows);
            synced++;
          } catch (err: any) {
            console.error(`[asana] task failed:`, err?.message);
            continue;
          }
        }
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Sync failed", details: err?.message }, { status: 500 });
  }

  return NextResponse.json({ synced, skipped });
}
