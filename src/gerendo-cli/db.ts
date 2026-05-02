import * as fs from "fs";
import Database from "better-sqlite3";
import type { ChunkRow } from "./types.js";

const SCHEMA_VERSION = 2;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pointer_json TEXT NOT NULL,
    embedding BLOB NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    keyword_text TEXT NOT NULL DEFAULT '',
    indexed_at INTEGER NOT NULL
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    keyword_text,
    tokenize='unicode61 remove_diacritics 1'
  );
`;

export function openDb(absPath: string): Database.Database {
  const db = new Database(absPath);
  db.pragma("journal_mode = WAL");

  const version = (db.pragma("user_version") as Array<{ user_version: number }>)[0].user_version;
  if (version < SCHEMA_VERSION) {
    db.exec("DROP TABLE IF EXISTS chunks; DROP TABLE IF EXISTS chunks_fts;");
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
    console.log(`DB schema upgraded to v${SCHEMA_VERSION} — full reindex required.`);
  }

  db.exec(SCHEMA);
  return db;
}

export function insertChunk(
  db: Database.Database,
  pointerJson: string,
  embedding: Float32Array,
  hash: string,
  keywordText: string
): void {
  const result = db.prepare(
    `INSERT OR IGNORE INTO chunks (pointer_json, embedding, hash, keyword_text, indexed_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(pointerJson, Buffer.from(embedding.buffer), hash, keywordText, Date.now());

  if (result.changes > 0) {
    db.prepare(`INSERT INTO chunks_fts(rowid, keyword_text) VALUES (?, ?)`)
      .run(result.lastInsertRowid, keywordText);
  }
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
      .prepare(`SELECT rowid AS id, rank FROM chunks_fts WHERE keyword_text MATCH ? ORDER BY rank LIMIT ?`)
      .all(ftsQuery, limit) as Array<{ id: number; rank: number }>;
  } catch {
    return [];
  }
}

export function allChunks(db: Database.Database): ChunkRow[] {
  const rows = db
    .prepare("SELECT id, pointer_json, embedding, hash FROM chunks")
    .all() as Array<{
    id: number;
    pointer_json: string;
    embedding: Buffer;
    hash: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    pointerJson: row.pointer_json,
    embedding: new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4
    ),
    hash: row.hash,
  }));
}

export function clearChunks(db: Database.Database): void {
  db.prepare("DELETE FROM chunks_fts").run();
  db.prepare("DELETE FROM chunks").run();
}

function deleteByIds(db: Database.Database, ids: number[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`DELETE FROM chunks_fts WHERE rowid IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM chunks WHERE id IN (${placeholders})`).run(...ids);
}

export function pruneUnlistedFiles(db: Database.Database, listedPaths: Set<string>): number {
  const rows = db.prepare("SELECT id, pointer_json FROM chunks").all() as Array<{ id: number; pointer_json: string }>;
  const toDelete = rows
    .filter((row) => !listedPaths.has((JSON.parse(row.pointer_json) as { path: string }).path))
    .map((row) => row.id);
  deleteByIds(db, toDelete);
  return toDelete.length;
}

export function pruneDeletedFiles(db: Database.Database): number {
  const rows = db.prepare("SELECT id, pointer_json FROM chunks").all() as Array<{ id: number; pointer_json: string }>;
  const toDelete = rows
    .filter((row) => !fs.existsSync((JSON.parse(row.pointer_json) as { path: string }).path))
    .map((row) => row.id);
  deleteByIds(db, toDelete);
  return toDelete.length;
}

export function pruneStaleChunks(db: Database.Database, filePath: string, currentHashes: Set<string>): number {
  const rows = db.prepare("SELECT id, hash, pointer_json FROM chunks").all() as Array<{ id: number; hash: string; pointer_json: string }>;
  const toDelete: number[] = [];
  for (const row of rows) {
    const pointer = JSON.parse(row.pointer_json) as { path: string };
    if (pointer.path === filePath && !currentHashes.has(row.hash)) {
      toDelete.push(row.id);
    }
  }
  deleteByIds(db, toDelete);
  return toDelete.length;
}
