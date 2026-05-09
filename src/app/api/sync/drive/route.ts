import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase-server";
import { getOrCreateDefaultWorkspace } from "@/lib/agency-db";
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

const CHUNK_SIZE = 1500; // chars per embedding chunk

async function getDriveToken(workspaceId: string, userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google-drive")
    .maybeSingle();

  if (!data) throw new Error("Google Drive not connected");

  // Refresh token if expired
  if (data.expires_at && Date.now() > data.expires_at - 60000 && data.refresh_token) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: data.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokens = await res.json();
    if (tokens.access_token) {
      await supabase.from("oauth_tokens").update({
        access_token: tokens.access_token,
        expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      }).eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "google-drive");
      return tokens.access_token;
    }
  }

  return data.access_token;
}

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

export async function POST(): Promise<NextResponse> {
  const { workspaceId, userId } = await getOrCreateDefaultWorkspace();
  const supabase = createServiceClient();

  let token: string;
  try {
    token = await getDriveToken(workspaceId, userId);
  } catch (err) {
    return NextResponse.json({ error: "Google Drive not connected", details: String(err) }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const drive = google.drive({ version: "v3", auth });

  // List all supported files
  let files: any[] = [];
  let pageToken: string | undefined;

  try {
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
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to list Drive files", details: err?.message }, { status: 500 });
  }

  let synced = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const modifiedAt = new Date(file.modifiedTime).getTime();

      // Check if already synced and up to date
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

      // Extract text
      const text = await extractFileText(drive, file);
      if (!text || text.length < 50) {
        skipped++;
        continue;
      }

      // Upsert file record
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

      // Chunk + embed
      const chunks = chunkText(text);
      if (chunks.length === 0) { skipped++; continue; }

      const embeddings = await embedTexts(chunks);

      // Delete old embeddings for this file then insert new
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

  return NextResponse.json({ synced, skipped, total: files.length });
}
