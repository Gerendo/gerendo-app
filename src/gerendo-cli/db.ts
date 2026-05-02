import Database from "better-sqlite3";
import type { ChunkRow } from "./types.js";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pointer_json TEXT NOT NULL,
    embedding BLOB NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    indexed_at INTEGER NOT NULL
  );
`;

export function openDb(absPath: string): Database.Database {
  const db = new Database(absPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

export function insertChunk(
  db: Database.Database,
  pointerJson: string,
  embedding: Float32Array,
  hash: string
): void {
  db.prepare(
    `INSERT OR IGNORE INTO chunks (pointer_json, embedding, hash, indexed_at)
     VALUES (?, ?, ?, ?)`
  ).run(pointerJson, Buffer.from(embedding.buffer), hash, Date.now());
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
  db.prepare("DELETE FROM chunks").run();
}
