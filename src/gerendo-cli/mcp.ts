import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { embedTexts } from "./embed.js";
import { openDb, allChunks, ftsSearch } from "./db.js";
import type { Pointer } from "./types.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../");
const DB_PATH = path.join(REPO_ROOT, "data/gerendo.db");
const TOP_K = 5;
const MAX_PER_FILE = 2;
const MIN_VECTOR_SCORE = 0.3; // discard chunks with cosine < this before RRF merge
const RRF_K = 60;             // reciprocal rank fusion constant

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY ?? "";
if (!VOYAGE_API_KEY) {
  process.stderr.write("VOYAGE_API_KEY is not set\n");
  process.exit(1);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function readChunkPreview(pointer: Pointer, maxChars = 120): string {
  const buf = Buffer.alloc(pointer.byteEnd - pointer.byteStart);
  const fd = fs.openSync(pointer.path, "r");
  fs.readSync(fd, buf, 0, buf.length, pointer.byteStart);
  fs.closeSync(fd);
  const text = buf.toString("utf-8");
  return text.length > maxChars ? text.slice(0, maxChars).trimEnd() + "…" : text;
}

const server = new McpServer({
  name: "gerendo",
  version: "0.1.0",
});

server.tool(
  "search_gerendo",
  "Search the Gerendo codebase and knowledge base using semantic search. Returns file path, byte range, and a short preview per result. To read the full content of a result, use the Read tool with the returned path and byte range.",
  { query: z.string().describe("The question or topic to search for") },
  async ({ query }) => {
    if (!fs.existsSync(DB_PATH)) {
      return {
        content: [{ type: "text", text: "Index not found. Run: npm run gerendo:index" }],
      };
    }

    const db = openDb(DB_PATH);
    const rows = allChunks(db);

    if (rows.length === 0) {
      return {
        content: [{ type: "text", text: "Index is empty. Run: npm run gerendo:index" }],
      };
    }

    const [queryEmbedding] = await embedTexts([query], VOYAGE_API_KEY);

    // --- Vector ranking (cosine, threshold-filtered) ---
    const vecScored = rows
      .map((row) => ({ row, score: cosineSimilarity(queryEmbedding, row.embedding) }))
      .filter(({ score }) => score >= MIN_VECTOR_SCORE)
      .sort((a, b) => b.score - a.score);

    const vecRankById = new Map<number, number>();
    vecScored.forEach(({ row }, rank) => vecRankById.set(row.id, rank));

    // --- FTS5 keyword ranking ---
    const ftsRows = ftsSearch(db, query, 20);
    const ftsRankById = new Map<number, number>();
    ftsRows.forEach(({ id }, rank) => ftsRankById.set(id, rank));

    // --- Reciprocal Rank Fusion ---
    const candidateIds = new Set<number>([
      ...vecScored.map(({ row }) => row.id),
      ...ftsRows.map(({ id }) => id),
    ]);

    const rowById = new Map(rows.map((row) => [row.id, row]));

    const rrfScored = Array.from(candidateIds)
      .map((id) => {
        const vecRank = vecRankById.get(id) ?? null;
        const ftsRank = ftsRankById.get(id) ?? null;
        const rrf =
          (vecRank !== null ? 1 / (RRF_K + vecRank) : 0) +
          (ftsRank !== null ? 1 / (RRF_K + ftsRank) : 0);
        return { id, rrf, vecScore: vecRank !== null ? vecScored[vecRank].score : 0 };
      })
      .sort((a, b) => b.rrf - a.rrf);

    const fileCounts = new Map<string, number>();
    const scored = rrfScored
      .filter(({ id }) => {
        const row = rowById.get(id);
        if (!row) return false;
        const p = (JSON.parse(row.pointerJson) as { path: string }).path;
        const count = fileCounts.get(p) ?? 0;
        if (count >= MAX_PER_FILE) return false;
        fileCounts.set(p, count + 1);
        return true;
      })
      .slice(0, TOP_K);

    const passages = scored.map(({ id, vecScore }, i) => {
      const row = rowById.get(id)!;
      const pointer: Pointer = JSON.parse(row.pointerJson);
      const preview = readChunkPreview(pointer, 120);
      const relPath = path.relative(REPO_ROOT, pointer.path) || pointer.path;
      return `[${i + 1}] ${relPath} bytes ${pointer.byteStart}-${pointer.byteEnd} (score: ${vecScore.toFixed(3)})\n${preview}`;
    });

    return {
      content: [{ type: "text", text: passages.join("\n\n---\n\n") }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
