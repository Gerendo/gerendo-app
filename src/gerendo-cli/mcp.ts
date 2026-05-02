import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { embedTexts } from "./embed.js";
import { openDb, allChunks } from "./db.js";
import type { Pointer } from "./types.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../");
const DB_PATH = path.join(REPO_ROOT, "data/gerendo.db");
const TOP_K = 5;
const MAX_PER_FILE = 2;

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

function readChunkText(pointer: Pointer): string {
  const buf = Buffer.alloc(pointer.byteEnd - pointer.byteStart);
  const fd = fs.openSync(pointer.path, "r");
  fs.readSync(fd, buf, 0, buf.length, pointer.byteStart);
  fs.closeSync(fd);
  return buf.toString("utf-8");
}

const server = new McpServer({
  name: "gerendo",
  version: "0.1.0",
});

server.tool(
  "search_gerendo",
  "Search the Gerendo project knowledge base (docs, notes, memory files) using semantic search. Call this before answering any question about the project, its architecture, decisions, or context.",
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

    const fileCounts = new Map<string, number>();
    const scored = rows
      .map((row) => ({ row, score: cosineSimilarity(queryEmbedding, row.embedding) }))
      .sort((a, b) => b.score - a.score)
      .filter(({ row }) => {
        const p = (JSON.parse(row.pointerJson) as { path: string }).path;
        const count = fileCounts.get(p) ?? 0;
        if (count >= MAX_PER_FILE) return false;
        fileCounts.set(p, count + 1);
        return true;
      })
      .slice(0, TOP_K);

    const passages = scored.map(({ row, score }, i) => {
      const pointer: Pointer = JSON.parse(row.pointerJson);
      const text = readChunkText(pointer);
      const relPath = path.relative(REPO_ROOT, pointer.path) || pointer.path;
      return `[${i + 1}] ${relPath} (score: ${score.toFixed(3)})\n${text}`;
    });

    return {
      content: [{ type: "text", text: passages.join("\n\n---\n\n") }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
