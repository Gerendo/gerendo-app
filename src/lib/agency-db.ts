import { createServiceClient } from "./supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AgencyDb = {
  supabase: SupabaseClient;
  workspaceId: string;
  userId: string;
};

export function openAgencyDb(workspaceId: string, userId: string): AgencyDb {
  return { supabase: createServiceClient(), workspaceId, userId };
}

export async function batchUpsertMessages(
  db: AgencyDb,
  msgs: Array<{
    source: string;
    externalId: string;
    threadId: string | null;
    sender: string;
    subject: string;
    mailbox: string;
    receivedAt: number;
  }>
): Promise<Map<string, number>> {
  const rows = msgs.map((msg) => ({
    workspace_id: db.workspaceId,
    user_id: db.userId,
    source: msg.source,
    external_id: msg.externalId,
    thread_id: msg.threadId,
    sender: msg.sender,
    subject: msg.subject,
    mailbox: msg.mailbox,
    received_at: msg.receivedAt,
    synced_at: Date.now(),
  }));

  const { data, error } = await db.supabase
    .from("messages")
    .upsert(rows, { onConflict: "workspace_id,user_id,source,external_id", ignoreDuplicates: false })
    .select("id, external_id");

  if (error) throw new Error(`batchUpsertMessages: ${error.message}`);
  const map = new Map<string, number>();
  for (const row of data ?? []) map.set(row.external_id, row.id);
  return map;
}

export async function batchUpsertEmbeddings(
  db: AgencyDb,
  items: Array<{ messageId: number; embedding: Float32Array; keywordText: string }>
): Promise<void> {
  const rows = items.map((item) => ({
    workspace_id: db.workspaceId,
    user_id: db.userId,
    message_id: item.messageId,
    embedding: Array.from(item.embedding),
    keyword_text: item.keywordText,
    indexed_at: Date.now(),
  }));

  const { error } = await db.supabase
    .from("embeddings")
    .upsert(rows, { onConflict: "message_id" });

  if (error) throw new Error(`batchUpsertEmbeddings: ${error.message}`);
}

export async function upsertMessage(
  db: AgencyDb,
  msg: {
    source: string;
    externalId: string;
    threadId: string | null;
    sender: string;
    subject: string;
    mailbox: string;
    receivedAt: number;
  }
): Promise<number> {
  const { data: existing } = await db.supabase
    .from("messages")
    .select("id")
    .eq("workspace_id", db.workspaceId)
    .eq("user_id", db.userId)
    .eq("source", msg.source)
    .eq("external_id", msg.externalId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await db.supabase
    .from("messages")
    .insert({
      workspace_id: db.workspaceId,
      user_id: db.userId,
      source: msg.source,
      external_id: msg.externalId,
      thread_id: msg.threadId,
      sender: msg.sender,
      subject: msg.subject,
      mailbox: msg.mailbox,
      received_at: msg.receivedAt,
      synced_at: Date.now(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`upsertMessage: ${error.message}`);
  return data.id;
}

export async function upsertEmbedding(
  db: AgencyDb,
  messageId: number,
  embedding: Float32Array,
  keywordText: string
): Promise<void> {
  // Supabase pgvector expects a plain number array
  const vec = Array.from(embedding);

  const { data: existing } = await db.supabase
    .from("embeddings")
    .select("id")
    .eq("message_id", messageId)
    .eq("workspace_id", db.workspaceId)
    .maybeSingle();

  if (existing) {
    const { error } = await db.supabase
      .from("embeddings")
      .update({ embedding: vec, keyword_text: keywordText, indexed_at: Date.now() })
      .eq("id", existing.id);
    if (error) console.error("[db] upsertEmbedding update failed:", error.message);
  } else {
    const { error } = await db.supabase.from("embeddings").insert({
      workspace_id: db.workspaceId,
      message_id: messageId,
      embedding: vec,
      keyword_text: keywordText,
      indexed_at: Date.now(),
    });
    if (error) console.error("[db] upsertEmbedding insert failed:", error.message);
  }
}

export async function upsertSummary(
  db: AgencyDb,
  messageId: number,
  summary: string
): Promise<void> {
  await db.supabase.from("summaries").upsert(
    {
      workspace_id: db.workspaceId,
      message_id: messageId,
      summary,
      summarized_at: Date.now(),
    },
    { onConflict: "message_id" }
  );
}

export async function getSummariesByMessageIds(
  db: AgencyDb,
  messageIds: number[]
): Promise<Array<{ messageId: number; summary: string }>> {
  if (messageIds.length === 0) return [];
  const { data } = await db.supabase
    .from("summaries")
    .select("message_id, summary")
    .eq("workspace_id", db.workspaceId)
    .in("message_id", messageIds);
  return (data ?? []).map((r) => ({ messageId: r.message_id, summary: r.summary }));
}

export async function insertFact(
  db: AgencyDb,
  fact: {
    messageId: number | null;
    type: string;
    subject: string | null;
    detail: string;
    client: string | null;
  }
): Promise<void> {
  await db.supabase.from("facts").insert({
    workspace_id: db.workspaceId,
    message_id: fact.messageId,
    type: fact.type,
    subject: fact.subject,
    detail: fact.detail,
    client: fact.client,
    extracted_at: Date.now(),
  });
}

// ── Per-user quota ────────────────────────────────────────────────────────────

export async function checkAndIncrementQuota(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  userId: string,
  limit: number
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const month = new Date().toISOString().slice(0, 7);
  const source = `quota:ask:${month}`;

  const { data: existing } = await supabase
    .from("sync_state")
    .select("cursor")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();

  const used = parseInt(existing?.cursor ?? "0", 10);

  if (used >= limit) {
    return { allowed: false, used, limit };
  }

  await supabase.from("sync_state").upsert(
    { workspace_id: workspaceId, user_id: userId, source, last_synced_at: Date.now(), cursor: String(used + 1) },
    { onConflict: "workspace_id,user_id,source" }
  );

  return { allowed: true, used: used + 1, limit };
}

export async function getQuotaUsage(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  userId: string,
  limit: number
): Promise<{ used: number; limit: number; remaining: number }> {
  const month = new Date().toISOString().slice(0, 7);
  const { data } = await supabase
    .from("sync_state")
    .select("cursor")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", `quota:ask:${month}`)
    .maybeSingle();
  const used = parseInt(data?.cursor ?? "0", 10);
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function getSyncState(
  db: AgencyDb,
  source: string
): Promise<{ lastSyncedAt: number | null; cursor: string | null }> {
  const { data } = await db.supabase
    .from("sync_state")
    .select("last_synced_at, cursor")
    .eq("workspace_id", db.workspaceId)
    .eq("user_id", db.userId)
    .eq("source", source)
    .maybeSingle();
  return { lastSyncedAt: data?.last_synced_at ?? null, cursor: data?.cursor ?? null };
}

export async function setSyncState(
  db: AgencyDb,
  source: string,
  cursor: string
): Promise<void> {
  await db.supabase.from("sync_state").upsert(
    {
      workspace_id: db.workspaceId,
      user_id: db.userId,
      source,
      last_synced_at: Date.now(),
      cursor,
    },
    { onConflict: "workspace_id,user_id,source" }
  );
}

export async function ftsSearch(
  db: AgencyDb,
  query: string,
  limit = 20
): Promise<Array<{ id: number; rank: number }>> {
  const terms = query
    .split(/\s+/)
    .map((t) => t.replace(/['"*^(){}[\]|!]/g, "").trim())
    .filter((t) => t.length > 2);
  if (terms.length === 0) return [];

  const tsQuery = terms.join(" | ");
  const { data } = await db.supabase.rpc("fts_search_embeddings", {
    p_workspace_id: db.workspaceId,
    p_query: tsQuery,
    p_limit: limit,
  });
  return (data ?? []).map((r: { id: number; rank: number }) => ({ id: r.id, rank: r.rank }));
}

export async function semanticSearch(
  db: AgencyDb,
  queryEmbedding: number[],
  limit = 20
): Promise<Array<{ id: number; score: number }>> {
  const { data } = await db.supabase.rpc("semantic_search_embeddings", {
    p_workspace_id: db.workspaceId,
    p_embedding: queryEmbedding,
    p_limit: limit,
  });
  return (data ?? []).map((r: { id: number; score: number }) => ({ id: r.id, score: r.score }));
}

export async function getMessagesByEmbeddingIds(
  db: AgencyDb,
  embeddingIds: number[]
): Promise<Array<{
  embeddingId: number;
  source: string;
  externalId: string;
  threadId: string | null;
  sender: string;
  subject: string;
  receivedAt: number;
  mailbox: string;
}>> {
  if (embeddingIds.length === 0) return [];
  const { data } = await db.supabase
    .from("embeddings")
    .select("id, message_id, messages(source, external_id, thread_id, sender, subject, received_at, mailbox)")
    .eq("workspace_id", db.workspaceId)
    .in("id", embeddingIds);

  return (data ?? []).map((r: any) => ({
    embeddingId: r.id,
    source: r.messages.source,
    externalId: r.messages.external_id,
    threadId: r.messages.thread_id,
    sender: r.messages.sender,
    subject: r.messages.subject,
    receivedAt: r.messages.received_at,
    mailbox: r.messages.mailbox,
  }));
}

export async function upsertWorkspaceContext(
  db: AgencyDb,
  contextText: string,
  sourcesUsed: number,
  tokenCount: number
): Promise<void> {
  await db.supabase.from("workspace_contexts").upsert(
    {
      workspace_id: db.workspaceId,
      context_text: contextText,
      built_at: Date.now(),
      sources_used: sourcesUsed,
      token_count: tokenCount,
    },
    { onConflict: "workspace_id" }
  );
}

export async function getWorkspaceContext(
  db: AgencyDb
): Promise<{ contextText: string; builtAt: number; sourcesUsed: number } | null> {
  const { data } = await db.supabase
    .from("workspace_contexts")
    .select("context_text, built_at, sources_used")
    .eq("workspace_id", db.workspaceId)
    .maybeSingle();
  if (!data) return null;
  return { contextText: data.context_text, builtAt: data.built_at, sourcesUsed: data.sources_used };
}

export async function ftsDriveSearch(
  db: AgencyDb,
  query: string,
  limit = 20
): Promise<Array<{ id: number; rank: number }>> {
  const terms = query
    .split(/\s+/)
    .map((t) => t.replace(/['"*^(){}[\]|!]/g, "").trim())
    .filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  const tsQuery = terms.join(" | ");
  const { data } = await db.supabase.rpc("fts_search_drive", {
    p_workspace_id: db.workspaceId,
    p_query: tsQuery,
    p_limit: limit,
  });
  return (data ?? []).map((r: { id: number; rank: number }) => ({ id: r.id, rank: r.rank }));
}

export async function semanticDriveSearch(
  db: AgencyDb,
  queryEmbedding: number[],
  limit = 20
): Promise<Array<{ id: number; score: number }>> {
  const { data } = await db.supabase.rpc("semantic_search_drive", {
    p_workspace_id: db.workspaceId,
    p_embedding: queryEmbedding,
    p_limit: limit,
  });
  return (data ?? []).map((r: { id: number; score: number }) => ({ id: r.id, score: r.score }));
}

export async function getDriveFilesByEmbeddingIds(
  db: AgencyDb,
  embeddingIds: number[]
): Promise<Array<{
  embeddingId: number;
  fileId: number;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  chunkIndex: number;
  keywordText: string;
}>> {
  if (embeddingIds.length === 0) return [];
  const { data } = await db.supabase
    .from("drive_embeddings")
    .select("id, chunk_index, keyword_text, file_id, drive_files(name, mime_type, web_view_link)")
    .eq("workspace_id", db.workspaceId)
    .in("id", embeddingIds);

  return (data ?? []).map((r: any) => ({
    embeddingId: r.id,
    fileId: r.file_id,
    name: r.drive_files.name,
    mimeType: r.drive_files.mime_type,
    webViewLink: r.drive_files.web_view_link,
    chunkIndex: r.chunk_index,
    keywordText: r.keyword_text,
  }));
}

export async function ftsAsanaSearch(
  db: AgencyDb,
  query: string,
  limit = 20
): Promise<Array<{ id: number; rank: number }>> {
  const terms = query.split(/\s+/).map((t) => t.replace(/['"*^(){}[\]|!]/g, "").trim()).filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  const { data } = await db.supabase.rpc("fts_search_asana", {
    p_workspace_id: db.workspaceId,
    p_query: terms.join(" | "),
    p_limit: limit,
  });
  return (data ?? []).map((r: { id: number; rank: number }) => ({ id: r.id, rank: r.rank }));
}

export async function semanticAsanaSearch(
  db: AgencyDb,
  queryEmbedding: number[],
  limit = 20
): Promise<Array<{ id: number; score: number }>> {
  const { data } = await db.supabase.rpc("semantic_search_asana", {
    p_workspace_id: db.workspaceId,
    p_embedding: queryEmbedding,
    p_limit: limit,
  });
  return (data ?? []).map((r: { id: number; score: number }) => ({ id: r.id, score: r.score }));
}

export async function getAsanaItemsByEmbeddingIds(
  db: AgencyDb,
  embeddingIds: number[]
): Promise<Array<{
  embeddingId: number;
  itemId: number;
  name: string;
  projectName: string | null;
  assignee: string | null;
  dueDate: string | null;
  status: string | null;
  permalinkUrl: string | null;
  keywordText: string;
}>> {
  if (embeddingIds.length === 0) return [];
  const { data } = await db.supabase
    .from("asana_embeddings")
    .select("id, chunk_index, keyword_text, item_id, asana_items(name, project_name, assignee, due_date, status, permalink_url)")
    .eq("workspace_id", db.workspaceId)
    .in("id", embeddingIds);

  return (data ?? []).map((r: any) => ({
    embeddingId: r.id,
    itemId: r.item_id,
    name: r.asana_items.name,
    projectName: r.asana_items.project_name,
    assignee: r.asana_items.assignee,
    dueDate: r.asana_items.due_date,
    status: r.asana_items.status,
    permalinkUrl: r.asana_items.permalink_url,
    keywordText: r.keyword_text,
  }));
}

export async function getDriveFileContent(workspaceId: string, userId: string, fileId: string): Promise<string> {
  const supabase = createServiceClient();

  // Get file record
  const { data: file } = await supabase
    .from("drive_files")
    .select("external_id, name, mime_type")
    .eq("workspace_id", workspaceId)
    .eq("id", parseInt(fileId))
    .maybeSingle();

  if (!file) return "(file not found)";

  // Get Drive token
  const { data: tokenRow } = await supabase
    .from("oauth_tokens")
    .select("access_token")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google-drive")
    .maybeSingle();

  if (!tokenRow) return "(Drive not connected)";

  const EXPORT_MIME: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  };

  const exportMime = EXPORT_MIME[file.mime_type];
  if (!exportMime) return "(unsupported file type)";

  try {
    const url = exportMime
      ? `https://www.googleapis.com/drive/v3/files/${file.external_id}/export?mimeType=${encodeURIComponent(exportMime)}`
      : `https://www.googleapis.com/drive/v3/files/${file.external_id}?alt=media`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenRow.access_token}` },
    });

    if (!res.ok) return `(failed to fetch: ${res.status})`;
    const text = await res.text();
    // Cap at 8000 chars to fit in context
    return text.slice(0, 8000);
  } catch (err: any) {
    return `(error: ${err?.message})`;
  }
}

export async function getGmailToken(workspaceId: string, userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google-gmail")
    .maybeSingle();

  if (!data) throw new Error("Gmail not connected");

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
      }).eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "google-gmail");
      return tokens.access_token;
    }
  }

  return data.access_token;
}

export async function getDriveToken(workspaceId: string, userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google-drive")
    .maybeSingle();

  if (!data) throw new Error("Google Drive not connected");

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

export async function getAsanaToken(workspaceId: string, userId: string): Promise<string> {
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

export async function getWorkspaceId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.workspace_id ?? null;
}

// Returns the first workspace in the DB, creating one if none exists.
// Used by API routes that run before full auth is wired up.
export async function getOrCreateDefaultWorkspace(): Promise<{ workspaceId: string; userId: string }> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id")
    .limit(1)
    .maybeSingle();

  if (existing) return { workspaceId: existing.workspace_id, userId: existing.user_id };

  // No workspace yet — create a placeholder linked to a synthetic user id
  const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000001";

  const { data: ws, error: wsError } = await supabase
    .from("workspaces")
    .insert({ name: "My Workspace" })
    .select("id")
    .single();

  if (!ws) throw new Error(`Failed to create default workspace: ${wsError?.message ?? "unknown"}`);

  await supabase.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: PLACEHOLDER_USER_ID,
    role: "admin",
  });

  return { workspaceId: ws.id, userId: PLACEHOLDER_USER_ID };
}

// Get workspace from the authenticated Supabase session.
// Used by all API routes once real auth is enforced.
export async function getWorkspaceFromSession(
  userId: string
): Promise<{ workspaceId: string; userId: string } | null> {
  const supabase = createServiceClient();
  // Users can be in multiple workspaces (their own + invited ones).
  // Return the one they joined most recently - for invited users this is the host workspace.
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { workspaceId: data.workspace_id, userId };
}

export async function asanaGet(token: string, path: string): Promise<any> {
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Asana API error ${res.status}: ${path}`);
  const json = await res.json();
  return json.data;
}

export async function asanaPost(token: string, path: string, body: object): Promise<any> {
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ data: body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message ?? `Asana API error ${res.status}: ${path}`);
  }
  const json = await res.json();
  return json.data;
}

// Create a new workspace for a user on first login.
export async function createWorkspaceForUser(
  userId: string,
  name: string
): Promise<string> {
  const supabase = createServiceClient();
  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({ name })
    .select("id")
    .single();
  if (!ws) throw new Error(`Failed to create workspace: ${error?.message}`);
  await supabase.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: userId,
    role: "admin",
  });
  return ws.id;
}

// Join an existing workspace via invite token.
export async function joinWorkspaceViaToken(
  token: string,
  userId: string
): Promise<{ workspaceId: string } | { error: string }> {
  const supabase = createServiceClient();
  const { data: invite } = await supabase
    .from("invite_tokens")
    .select("id, workspace_id, used_by, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return { error: "Invalid invite link" };
  if (invite.used_by) return { error: "This invite link has already been used" };
  if (new Date(invite.expires_at) < new Date()) return { error: "This invite link has expired" };

  // Check if user is already in this workspace
  const { data: existing } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("workspace_members").insert({
      workspace_id: invite.workspace_id,
      user_id: userId,
      role: "member",
    });
  }

  // Mark token as used
  await supabase.from("invite_tokens").update({ used_by: userId }).eq("id", invite.id);

  return { workspaceId: invite.workspace_id };
}

// Generate an invite token for a workspace.
export async function createInviteToken(
  workspaceId: string,
  createdBy: string
): Promise<string> {
  const supabase = createServiceClient();
  // Generate token in app code - Postgres base64url encoding is not supported
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("invite_tokens")
    .insert({ workspace_id: workspaceId, created_by: createdBy, token, expires_at: expiresAt })
    .select("token")
    .single();
  if (!data) throw new Error(`Failed to create invite: ${error?.message}`);
  return data.token;
}
