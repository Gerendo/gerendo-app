import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase-server";
import { getDriveToken } from "@/lib/agency-db";
import { embedTexts } from "@/lib/embed";

export const maxDuration = 300;

const SUPPORTED_MIME_TYPES = [
  "application/vnd.google-apps.document",   // Google Docs
  "application/vnd.google-apps.spreadsheet", // Google Sheets
  "application/vnd.google-apps.presentation", // Google Slides
  "text/plain",
  "application/pdf",
];

const EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

const CHUNK_SIZE = 1500;

function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk.length > 50) chunks.push(chunk);
  }
  return chunks.length > 0 ? chunks : [];
}

async function extractFileText(drive: any, file: any): Promise<string> {
  const exportMime = EXPORT_MIME[file.mimeType];
  if (exportMime) {
    try {
      const res = await drive.files.export({ fileId: file.id, mimeType: exportMime });
      return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    } catch {
      return "";
    }
  }
  if (file.mimeType === "text/plain") {
    try {
      const res = await drive.files.get({ fileId: file.id, alt: "media" });
      return typeof res.data === "string" ? res.data : "";
    } catch {
      return "";
    }
  }
  return "";
}

export async function runDriveSyncForUser(workspaceId: string, userId: string): Promise<{ synced: number; skipped: number }> {
  const supabase = createServiceClient();
  const token = await getDriveToken(workspaceId, userId);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const drive = google.drive({ version: "v3", auth });

  let files: any[] = [];
  let pageToken: string | undefined;

  const mimeQuery = SUPPORTED_MIME_TYPES.map((m) => `mimeType='${m}'`).join(" or ");
  do {
    const res = await drive.files.list({
      q: `(${mimeQuery}) and trashed=false`,
      fields: "nextPageToken, files(id, name, mimeType, parents, webViewLink, modifiedTime)",
      pageSize: 100,
      pageToken,
    });
    files.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  let synced = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const modifiedAt = new Date(file.modifiedTime).getTime();

      const { data: existing } = await supabase
        .from("drive_files")
        .select("id, synced_at")
        .eq("workspace_id", workspaceId)
        .eq("external_id", file.id)
        .maybeSingle();

      if (existing && existing.synced_at >= modifiedAt) {
        skipped++;
        continue;
      }

      const text = await extractFileText(drive, file);
      if (!text || text.length < 50) {
        skipped++;
        continue;
      }

      const { data: fileRow, error: fileErr } = await supabase
        .from("drive_files")
        .upsert({
          workspace_id: workspaceId,
          user_id: userId,
          external_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          parent_id: file.parents?.[0] ?? null,
          web_view_link: file.webViewLink ?? null,
          modified_at: modifiedAt,
          synced_at: Date.now(),
        }, { onConflict: "workspace_id,user_id,external_id" })
        .select("id")
        .single();

      if (fileErr || !fileRow) {
        console.error(`[drive] upsert failed for ${file.name}:`, fileErr?.message);
        continue;
      }

      const chunks = chunkText(text);
      if (chunks.length === 0) { skipped++; continue; }

      const embeddings = await embedTexts(chunks);

      await supabase.from("drive_embeddings").delete().eq("file_id", fileRow.id);

      const embRows = chunks.map((chunk, i) => ({
        workspace_id: workspaceId,
        file_id: fileRow.id,
        chunk_index: i,
        embedding: Array.from(embeddings[i]),
        keyword_text: `${file.name}. ${chunk}`,
        indexed_at: Date.now(),
      }));

      await supabase.from("drive_embeddings").insert(embRows);
      synced++;
    } catch (err: any) {
      console.error(`[drive] failed for ${file.name}:`, err?.message);
      continue;
    }
  }

  return { synced, skipped };
}

export async function POST(): Promise<NextResponse> {
  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) return _ws; const { workspaceId, userId } = _ws;

  try {
    const result = await runDriveSyncForUser(workspaceId, userId);
    return NextResponse.json({ ...result, total: result.synced + result.skipped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status: 500 });
  }
}
