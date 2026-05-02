import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { Chunk } from "./types.js";

// CLAUDE.md is already loaded as system context every session - skip it to avoid flooding results
const ROOT_FILES = ["AGENTS.md", "_notes.md", "README.md"];
const MEMORY_DIR =
  "/Users/mingw/.claude/projects/-Users-mingw-gerendo-app/memory";

const TARGET_MIN = 1600;
const TARGET_MAX = 2400;

export function collectFiles(repoRoot: string): string[] {
  const results: string[] = [];

  for (const name of ROOT_FILES) {
    const abs = path.join(repoRoot, name);
    if (fs.existsSync(abs)) results.push(abs);
  }

  const docsDir = path.join(repoRoot, "docs");
  if (fs.existsSync(docsDir)) {
    for (const entry of fs.readdirSync(docsDir)) {
      if (entry.endsWith(".md")) results.push(path.join(docsDir, entry));
    }
  }

  if (fs.existsSync(MEMORY_DIR)) {
    for (const entry of fs.readdirSync(MEMORY_DIR)) {
      if (entry.endsWith(".md")) results.push(path.join(MEMORY_DIR, entry));
    }
  }

  return results;
}

export function chunkFile(absPath: string): Chunk[] {
  const content = fs.readFileSync(absPath, "utf-8");
  const paragraphs = content.split(/\n\n+/);

  const chunks: Chunk[] = [];
  let buffer = "";
  let pendingStart = 0;
  let charCursor = 0;

  function byteOffsetOf(charOffset: number): number {
    return Buffer.byteLength(content.slice(0, charOffset), "utf-8");
  }

  function flush(byteEnd: number): void {
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    chunks.push({
      pointer: { path: absPath, byteStart: pendingStart, byteEnd },
      text: buffer,
      hash,
    });
    pendingStart = byteEnd;
    buffer = "";
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const separator = i < paragraphs.length - 1 ? "\n\n" : "";

    if (buffer === "") {
      buffer = para;
    } else if (buffer.length + 2 + para.length > TARGET_MAX) {
      flush(byteOffsetOf(charCursor));
      buffer = para;
    } else {
      buffer = buffer + "\n\n" + para;
    }

    charCursor += para.length + separator.length;

    if (buffer.length >= TARGET_MIN && i < paragraphs.length - 1) {
      flush(byteOffsetOf(charCursor));
    }
  }

  if (buffer.length > 0) {
    flush(Buffer.byteLength(content, "utf-8"));
  }

  return chunks;
}
