import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const SCHEMA_VERSION = 1;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    thread_id TEXT,
    sender TEXT,
    subject TEXT,
    preview TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    synced_at INTEGER NOT NULL,
    UNIQUE (source, external_id)
  );

  CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    embedding BLOB NOT NULL,
    keyword_text TEXT NOT NULL,
    indexed_at INTEGER NOT NULL
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
    keyword_text,
    content='embeddings',
    tokenize='unicode61 remove_diacritics 1'
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    source TEXT PRIMARY KEY,
    last_synced_at INTEGER,
    cursor TEXT
  );
`;

let _db: Database.Database | null = null;

export function openAgencyDb(): Database.Database {
  if (_db) return _db;

  const dbPath = path.join(process.cwd(), "data", "agency.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const version = (db.pragma("user_version") as Array<{ user_version: number }>)[0].user_version;
  if (version < SCHEMA_VERSION) {
    db.exec(SCHEMA);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  _db = db;
  return db;
}

export function upsertMessage(
  db: Database.Database,
  msg: {
    source: string;
    externalId: string;
    threadId: string | null;
    sender: string;
    subject: string;
    preview: string;
    receivedAt: number;
  }
): number {
  const result = db.prepare(`
    INSERT INTO messages (source, external_id, thread_id, sender, subject, preview, received_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (source, external_id) DO UPDATE SET
      preview = excluded.preview,
      synced_at = excluded.synced_at
  `).run(
    msg.source,
    msg.externalId,
    msg.threadId,
    msg.sender,
    msg.subject,
    msg.preview,
    msg.receivedAt,
    Date.now()
  );

  return result.lastInsertRowid as number;
}

export function upsertEmbedding(
  db: Database.Database,
  messageId: number,
  embedding: Float32Array,
  keywordText: string
): void {
  const existing = db.prepare(`SELECT id FROM embeddings WHERE message_id = ?`).get(messageId) as { id: number } | undefined;

  if (existing) {
    db.prepare(`UPDATE embeddings SET embedding = ?, keyword_text = ?, indexed_at = ? WHERE message_id = ?`)
      .run(Buffer.from(embedding.buffer), keywordText, Date.now(), messageId);
    db.prepare(`UPDATE embeddings_fts SET keyword_text = ? WHERE rowid = ?`)
      .run(keywordText, existing.id);
  } else {
    const result = db.prepare(`
      INSERT INTO embeddings (message_id, embedding, keyword_text, indexed_at)
      VALUES (?, ?, ?, ?)
    `).run(messageId, Buffer.from(embedding.buffer), keywordText, Date.now());
    db.prepare(`INSERT INTO embeddings_fts (rowid, keyword_text) VALUES (?, ?)`)
      .run(result.lastInsertRowid, keywordText);
  }
}

export function getSyncState(db: Database.Database, source: string): { lastSyncedAt: number | null; cursor: string | null } {
  const row = db.prepare(`SELECT last_synced_at, cursor FROM sync_state WHERE source = ?`).get(source) as
    | { last_synced_at: number | null; cursor: string | null }
    | undefined;
  return { lastSyncedAt: row?.last_synced_at ?? null, cursor: row?.cursor ?? null };
}

export function setSyncState(db: Database.Database, source: string, cursor: string): void {
  db.prepare(`
    INSERT INTO sync_state (source, last_synced_at, cursor)
    VALUES (?, ?, ?)
    ON CONFLICT (source) DO UPDATE SET last_synced_at = excluded.last_synced_at, cursor = excluded.cursor
  `).run(source, Date.now(), cursor);
}

export function ftsSearch(
  db: Database.Database,
  query: string,
  limit = 20
): Array<{ id: number; rank: number }> {
  const terms = query
    .split(/\s+/)
    .map((t) => t.replace(/['"*^(){}[\]|!]/g, "").trim())
    .filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  const ftsQuery = terms.join(" OR ");
  try {
    return db
      .prepare(`SELECT rowid AS id, rank FROM embeddings_fts WHERE keyword_text MATCH ? ORDER BY rank LIMIT ?`)
      .all(ftsQuery, limit) as Array<{ id: number; rank: number }>;
  } catch {
    return [];
  }
}

export function allEmbeddings(db: Database.Database): Array<{
  id: number;
  messageId: number;
  embedding: Float32Array;
}> {
  const rows = db.prepare(`SELECT id, message_id, embedding FROM embeddings`).all() as Array<{
    id: number;
    message_id: number;
    embedding: Buffer;
  }>;
  return rows.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    embedding: new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4),
  }));
}

export function getMessagesByEmbeddingIds(
  db: Database.Database,
  embeddingIds: number[]
): Array<{
  embeddingId: number;
  source: string;
  externalId: string;
  threadId: string | null;
  sender: string;
  subject: string;
  preview: string;
  receivedAt: number;
}> {
  if (embeddingIds.length === 0) return [];
  const placeholders = embeddingIds.map(() => "?").join(",");
  return db.prepare(`
    SELECT e.id AS embedding_id, m.source, m.external_id, m.thread_id, m.sender, m.subject, m.preview, m.received_at
    FROM embeddings e
    JOIN messages m ON e.message_id = m.id
    WHERE e.id IN (${placeholders})
  `).all(...embeddingIds) as any;
}
