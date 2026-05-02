import * as path from "path";
import * as fs from "fs";
import { collectFiles, chunkFile } from "./chunker.js";
import { embedTexts } from "./embed.js";
import { openDb, insertChunk } from "./db.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../");
const DB_PATH = path.join(REPO_ROOT, "data/gerendo.db");

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY ?? "";
if (!VOYAGE_API_KEY) {
  console.error("VOYAGE_API_KEY is not set in environment");
  process.exit(1);
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = openDb(DB_PATH);

const files = collectFiles(REPO_ROOT);
console.log(`\nFound ${files.length} files to index:`);
for (const f of files) console.log(" ", path.relative(REPO_ROOT, f) || f);

let totalChunks = 0;
let skipped = 0;
let inserted = 0;

for (const absPath of files) {
  const rel = path.relative(REPO_ROOT, absPath) || absPath;
  const chunks = chunkFile(absPath);
  if (chunks.length === 0) continue;

  process.stdout.write(`\n${rel} — ${chunks.length} chunk(s)\n`);

  const texts = chunks.map((c) => c.text);
  const embeddings = await embedTexts(texts, VOYAGE_API_KEY);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const pointerJson = JSON.stringify(chunk.pointer);
    const before = db.prepare("SELECT 1 FROM chunks WHERE hash = ?").get(chunk.hash);

    insertChunk(db, pointerJson, embeddings[i], chunk.hash);

    if (before) {
      process.stdout.write(`  [skip] chunk ${i + 1} (unchanged)\n`);
      skipped++;
    } else {
      process.stdout.write(
        `  [index] chunk ${i + 1} bytes ${chunk.pointer.byteStart}-${chunk.pointer.byteEnd} hash ${chunk.hash.slice(0, 8)}…\n`
      );
      inserted++;
    }
    totalChunks++;
  }
}

console.log(`\nDone. ${inserted} indexed, ${skipped} skipped (unchanged). DB: ${DB_PATH}`);
