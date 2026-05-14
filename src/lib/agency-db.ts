import { createServiceClient } from "./supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptForBytea, decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

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
    thread_id_enc: msg.threadId
      ? encryptForBytea(
          msg.threadId,
          aad.messagesThreadId(db.workspaceId, db.userId, msg.source, msg.externalId)
        )
      : null,
    sender_enc: encryptForBytea(
      msg.sender,
      aad.messagesSender(db.workspaceId, db.userId, msg.source, msg.externalId)
    ),
    subject_enc: encryptForBytea(
      msg.subject,
      aad.messagesSubject(db.workspaceId, db.userId, msg.source, msg.externalId)
    ),
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
    keyword_text_enc: encryptForBytea(
      item.keywordText,
      aad.embeddingsKeywordText(db.workspaceId, item.messageId)
    ),
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
      thread_id_enc: msg.threadId
        ? encryptForBytea(
            msg.threadId,
            aad.messagesThreadId(db.workspaceId, db.userId, msg.source, msg.externalId)
          )
        : null,
      sender_enc: encryptForBytea(
        msg.sender,
        aad.messagesSender(db.workspaceId, db.userId, msg.source, msg.externalId)
      ),
      subject_enc: encryptForBytea(
        msg.subject,
        aad.messagesSubject(db.workspaceId, db.userId, msg.source, msg.externalId)
      ),
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

  const keywordTextEnc = encryptForBytea(
    keywordText,
    aad.embeddingsKeywordText(db.workspaceId, messageId)
  );

  if (existing) {
    const { error } = await db.supabase
      .from("embeddings")
      .update({
        embedding: vec,
        keyword_text_enc: keywordTextEnc,
        indexed_at: Date.now(),
      })
      .eq("id", existing.id);
    if (error) console.error("[db] upsertEmbedding update failed:", error.message);
  } else {
    const { error } = await db.supabase.from("embeddings").insert({
      workspace_id: db.workspaceId,
      user_id: db.userId,
      message_id: messageId,
      embedding: vec,
      keyword_text_enc: keywordTextEnc,
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
      summary_enc: encryptForBytea(summary, aad.summariesSummary(db.workspaceId, messageId)),
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
    .select("message_id, summary_enc")
    .eq("workspace_id", db.workspaceId)
    .in("message_id", messageIds);
  return (data ?? []).map((r) => ({
    messageId: r.message_id,
    summary: decryptColumn(
      r.summary_enc,
      aad.summariesSummary(db.workspaceId, r.message_id)
    ),
  }));
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
    detail_enc: encryptForBytea(
      fact.detail,
      aad.factsDetail(db.workspaceId, fact.messageId, fact.type, fact.subject)
    ),
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
    .select("id, message_id, messages(user_id, source, external_id, thread_id_enc, sender_enc, subject_enc, received_at, mailbox)")
    .eq("workspace_id", db.workspaceId)
    .in("id", embeddingIds);

  return (data ?? []).map((r: any) => {
    const m = r.messages;
    // thread_id is legitimately nullable (some message sources don't expose it),
    // so decrypt only when an encrypted blob is present.
    const threadId = m.thread_id_enc
      ? decryptColumn(
          m.thread_id_enc,
          aad.messagesThreadId(db.workspaceId, m.user_id, m.source, m.external_id)
        )
      : null;
    return {
      embeddingId: r.id,
      source: m.source,
      externalId: m.external_id,
      threadId,
      sender: decryptColumn(
        m.sender_enc,
        aad.messagesSender(db.workspaceId, m.user_id, m.source, m.external_id)
      ),
      subject: decryptColumn(
        m.subject_enc,
        aad.messagesSubject(db.workspaceId, m.user_id, m.source, m.external_id)
      ),
      receivedAt: m.received_at,
      mailbox: m.mailbox,
    };
  });
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
      context_text_enc: encryptForBytea(
        contextText,
        aad.workspaceContextsContextText(db.workspaceId)
      ),
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
    .select("context_text_enc, built_at, sources_used")
    .eq("workspace_id", db.workspaceId)
    .maybeSingle();
  if (!data) return null;
  const contextText = decryptColumn(
    data.context_text_enc,
    aad.workspaceContextsContextText(db.workspaceId)
  );
  return { contextText, builtAt: data.built_at, sourcesUsed: data.sources_used };
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
    .select("id, chunk_index, keyword_text_enc, file_id, drive_files(user_id, external_id, name_enc, mime_type, web_view_link)")
    .eq("workspace_id", db.workspaceId)
    .in("id", embeddingIds);

  return (data ?? []).map((r: any) => {
    const f = r.drive_files;
    return {
      embeddingId: r.id,
      fileId: r.file_id,
      name: decryptColumn(
        f.name_enc,
        aad.driveFilesName(db.workspaceId, f.user_id, f.external_id)
      ),
      mimeType: f.mime_type,
      webViewLink: f.web_view_link,
      chunkIndex: r.chunk_index,
      keywordText: decryptColumn(
        r.keyword_text_enc,
        aad.driveEmbeddingsKeywordText(db.workspaceId, r.file_id, r.chunk_index)
      ),
    };
  });
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
    .select("id, chunk_index, keyword_text_enc, item_id, asana_items(user_id, external_id, name_enc, project_name_enc, assignee_enc, due_date_enc, status, permalink_url_enc)")
    .eq("workspace_id", db.workspaceId)
    .in("id", embeddingIds);

  return (data ?? []).map((r: any) => {
    const it = r.asana_items;
    return {
      embeddingId: r.id,
      itemId: r.item_id,
      name: decryptColumn(
        it.name_enc,
        aad.asanaItemsName(db.workspaceId, it.user_id, it.external_id)
      ),
      // project_name, assignee, due_date, permalink_url are legitimately nullable.
      projectName: it.project_name_enc
        ? decryptColumn(
            it.project_name_enc,
            aad.asanaItemsProjectName(db.workspaceId, it.user_id, it.external_id)
          )
        : null,
      assignee: it.assignee_enc
        ? decryptColumn(
            it.assignee_enc,
            aad.asanaItemsAssignee(db.workspaceId, it.user_id, it.external_id)
          )
        : null,
      dueDate: it.due_date_enc
        ? decryptColumn(
            it.due_date_enc,
            aad.asanaItemsDueDate(db.workspaceId, it.user_id, it.external_id)
          )
        : null,
      status: it.status,
      permalinkUrl: it.permalink_url_enc
        ? decryptColumn(
            it.permalink_url_enc,
            aad.asanaItemsPermalinkUrl(db.workspaceId, it.user_id, it.external_id)
          )
        : null,
      keywordText: decryptColumn(
        r.keyword_text_enc,
        aad.asanaEmbeddingsKeywordText(db.workspaceId, r.item_id, r.chunk_index)
      ),
    };
  });
}

export async function getDriveFileContent(workspaceId: string, userId: string, fileId: string): Promise<string> {
  const supabase = createServiceClient();

  // Get file record
  const { data: file } = await supabase
    .from("drive_files")
    .select("external_id, mime_type")
    .eq("workspace_id", workspaceId)
    .eq("id", parseInt(fileId))
    .maybeSingle();

  if (!file) return "(file not found)";

  // Get Drive token
  const { data: tokenRow } = await supabase
    .from("oauth_tokens")
    .select("access_token_enc")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google-drive")
    .maybeSingle();

  if (!tokenRow) return "(Drive not connected)";

  const accessToken = decryptColumn(
    tokenRow.access_token_enc,
    aad.oauthTokensAccessToken(workspaceId, userId, "google-drive")
  );

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
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return `(failed to fetch: ${res.status})`;
    const text = await res.text();
    // Cap at 8000 chars to fit in context
    return text.slice(0, 8000);
  } catch (err: any) {
    return `(error: ${err?.message})`;
  }
}

/**
 * Thrown when an OAuth access token is expired and the refresh path cannot
 * recover it (missing refresh_token, provider rejected the refresh, network
 * error). Callers should map this to a 401 with a "reconnect" CTA — never
 * fall back to the stale token, which silently 401s downstream.
 */
export class ReauthorizeRequiredError extends Error {
  constructor(public provider: string, public reason: string) {
    super(`Reauthorize required: ${provider} (${reason})`);
    this.name = "ReauthorizeRequiredError";
  }
}

export async function getGmailToken(workspaceId: string, userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google-gmail")
    .maybeSingle();

  if (!data) throw new Error("Gmail not connected");

  // refresh_token_enc is legitimately nullable: Google does not always return
  // a refresh token on token rotation. Decrypt only when present.
  const refreshToken = data.refresh_token_enc
    ? decryptColumn(
        data.refresh_token_enc,
        aad.oauthTokensRefreshToken(workspaceId, userId, "google-gmail")
      )
    : null;

  const isExpired = !!(data.expires_at && Date.now() > data.expires_at - 60000);
  if (isExpired) {
    if (!refreshToken) {
      throw new ReauthorizeRequiredError("google-gmail", "no_refresh_token");
    }
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokens = await res.json();
    if (tokens.access_token) {
      await supabase.from("oauth_tokens").update({
        access_token_enc: encryptForBytea(
          tokens.access_token,
          aad.oauthTokensAccessToken(workspaceId, userId, "google-gmail")
        ),
        expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      }).eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "google-gmail");
      return tokens.access_token;
    }
    const reason = typeof tokens.error === "string" ? tokens.error : "no_access_token";
    console.error(`[oauth] google-gmail refresh failed: ${reason}`);
    throw new ReauthorizeRequiredError("google-gmail", reason);
  }

  return decryptColumn(
    data.access_token_enc,
    aad.oauthTokensAccessToken(workspaceId, userId, "google-gmail")
  );
}

export async function getDriveToken(workspaceId: string, userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google-drive")
    .maybeSingle();

  if (!data) throw new Error("Google Drive not connected");

  // refresh_token_enc is legitimately nullable: Google does not always return
  // a refresh token on token rotation. Decrypt only when present.
  const refreshToken = data.refresh_token_enc
    ? decryptColumn(
        data.refresh_token_enc,
        aad.oauthTokensRefreshToken(workspaceId, userId, "google-drive")
      )
    : null;

  const isExpired = !!(data.expires_at && Date.now() > data.expires_at - 60000);
  if (isExpired) {
    if (!refreshToken) {
      throw new ReauthorizeRequiredError("google-drive", "no_refresh_token");
    }
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokens = await res.json();
    if (tokens.access_token) {
      await supabase.from("oauth_tokens").update({
        access_token_enc: encryptForBytea(
          tokens.access_token,
          aad.oauthTokensAccessToken(workspaceId, userId, "google-drive")
        ),
        expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      }).eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "google-drive");
      return tokens.access_token;
    }
    const reason = typeof tokens.error === "string" ? tokens.error : "no_access_token";
    console.error(`[oauth] google-drive refresh failed: ${reason}`);
    throw new ReauthorizeRequiredError("google-drive", reason);
  }

  return decryptColumn(
    data.access_token_enc,
    aad.oauthTokensAccessToken(workspaceId, userId, "google-drive")
  );
}

export async function getAsanaToken(workspaceId: string, userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "asana")
    .maybeSingle();

  if (!data) throw new Error("Asana not connected");

  // refresh_token_enc is legitimately nullable: not every OAuth response
  // includes a refresh token. Decrypt only when present.
  const refreshToken = data.refresh_token_enc
    ? decryptColumn(
        data.refresh_token_enc,
        aad.oauthTokensRefreshToken(workspaceId, userId, "asana")
      )
    : null;

  const isExpired = !!(data.expires_at && Date.now() > data.expires_at - 60000);
  if (isExpired) {
    if (!refreshToken) {
      throw new ReauthorizeRequiredError("asana", "no_refresh_token");
    }
    const res = await fetch("https://app.asana.com/-/oauth_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.ASANA_CLIENT_ID!,
        client_secret: process.env.ASANA_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokens = await res.json();
    if (tokens.access_token) {
      await supabase.from("oauth_tokens").update({
        access_token_enc: encryptForBytea(
          tokens.access_token,
          aad.oauthTokensAccessToken(workspaceId, userId, "asana")
        ),
        expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      }).eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "asana");
      return tokens.access_token;
    }
    const reason = typeof tokens.error === "string" ? tokens.error : "no_access_token";
    console.error(`[oauth] asana refresh failed: ${reason}`);
    throw new ReauthorizeRequiredError("asana", reason);
  }

  return decryptColumn(
    data.access_token_enc,
    aad.oauthTokensAccessToken(workspaceId, userId, "asana")
  );
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

  // Insert workspace with placeholder name first to get the id, then
  // update with encrypted name_enc using id as part of the AAD.
  const { data: ws, error: wsError } = await supabase
    .from("workspaces")
    .insert({})
    .select("id")
    .single();

  if (!ws) throw new Error(`Failed to create default workspace: ${wsError?.message ?? "unknown"}`);

  await supabase
    .from("workspaces")
    .update({ name_enc: encryptForBytea("My Workspace", aad.workspacesName(ws.id)) })
    .eq("id", ws.id);

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
    .insert({})
    .select("id")
    .single();
  if (!ws) throw new Error(`Failed to create workspace: ${error?.message}`);
  await supabase
    .from("workspaces")
    .update({ name_enc: encryptForBytea(name, aad.workspacesName(ws.id)) })
    .eq("id", ws.id);
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
