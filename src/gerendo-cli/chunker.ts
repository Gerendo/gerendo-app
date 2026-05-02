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

// Regex to find top-level export declarations (functions, consts, classes, types, interfaces)
const EXPORT_DECLARATION_REGEX =
  /^export\s+(async\s+)?(function|const|class|type|interface|default)\s+\w+/gm;

function globFiles(dir: string, patterns: string[]): string[] {
  const results: string[] = [];

  function walk(current: string) {
    if (!fs.existsSync(current)) return;

    const entries = fs.readdirSync(current);
    for (const entry of entries) {
      const fullPath = path.join(current, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (
          entry === "node_modules" ||
          entry === ".next" ||
          entry === "dist" ||
          entry === ".git"
        ) {
          continue;
        }
        walk(fullPath);
      } else if (stat.isFile()) {
        // Check against patterns
        for (const pattern of patterns) {
          if (matchPattern(fullPath, pattern)) {
            results.push(fullPath);
            break;
          }
        }
      }
    }
  }

  walk(dir);
  return results;
}

function matchPattern(filePath: string, pattern: string): boolean {
  // Simple pattern matching: *.ts, *.tsx, *.md
  if (pattern === "*.md") return filePath.endsWith(".md");
  if (pattern === "*.ts") return filePath.endsWith(".ts");
  if (pattern === "*.tsx") return filePath.endsWith(".tsx");
  return false;
}

export function collectFiles(repoRoot: string): string[] {
  const results: string[] = [];

  // Root files (explicit list)
  for (const name of ROOT_FILES) {
    const abs = path.join(repoRoot, name);
    if (fs.existsSync(abs)) results.push(abs);
  }

  // Docs directory
  const docsDir = path.join(repoRoot, "docs");
  if (fs.existsSync(docsDir)) {
    for (const entry of fs.readdirSync(docsDir)) {
      if (entry.endsWith(".md")) results.push(path.join(docsDir, entry));
    }
  }

  // Memory directory
  if (fs.existsSync(MEMORY_DIR)) {
    for (const entry of fs.readdirSync(MEMORY_DIR)) {
      if (entry.endsWith(".md")) results.push(path.join(MEMORY_DIR, entry));
    }
  }

  // Code files: src/**/*.{ts,tsx}
  const srcDir = path.join(repoRoot, "src");
  results.push(...globFiles(srcDir, ["*.ts", "*.tsx"]));

  // Code files: agency-brain-ai-main/src/**/*.{ts,tsx}
  const marketingSrcDir = path.join(repoRoot, "agency-brain-ai-main", "src");
  if (fs.existsSync(marketingSrcDir)) {
    results.push(...globFiles(marketingSrcDir, ["*.ts", "*.tsx"]));
  }

  // Filter out test files and type definitions
  return results.filter(
    (f) => !f.endsWith(".test.ts") && !f.endsWith(".spec.ts") && !f.endsWith(".d.ts")
  );
}

export function chunkCodeFile(absPath: string): Chunk[] {
  const content = fs.readFileSync(absPath, "utf-8");
  const chunks: Chunk[] = [];

  function byteOffsetOf(charOffset: number): number {
    return Buffer.byteLength(content.slice(0, charOffset), "utf-8");
  }

  function addChunk(text: string, byteStart: number, byteEnd: number): void {
    if (text.trim().length === 0) return;
    const hash = crypto.createHash("sha256").update(text).digest("hex");
    chunks.push({
      pointer: { path: absPath, byteStart, byteEnd },
      text,
      hash,
    });
  }

  // Find all export declaration positions
  const matches: Array<{ index: number; text: string }> = [];
  let match;
  while ((match = EXPORT_DECLARATION_REGEX.exec(content)) !== null) {
    matches.push({ index: match.index, text: match[0] });
  }

  if (matches.length === 0) {
    // No exports found - treat entire file as one chunk
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    chunks.push({
      pointer: { path: absPath, byteStart: 0, byteEnd: Buffer.byteLength(content, "utf-8") },
      text: content,
      hash,
    });
    return chunks;
  }

  // Check if there's a preamble (code before the first export)
  if (matches[0].index > 0) {
    const preamble = content.slice(0, matches[0].index);
    addChunk(preamble, 0, byteOffsetOf(matches[0].index));
  }

  // For each export, collect text from that declaration to the next one (or EOF)
  for (let i = 0; i < matches.length; i++) {
    const startChar = matches[i].index;
    const endChar = i < matches.length - 1 ? matches[i + 1].index : content.length;
    const text = content.slice(startChar, endChar).trimEnd();

    // Truncate large functions to avoid mega-chunks
    let finalText = text;
    if (text.length > 3000) {
      finalText = text.slice(0, 3000) + "\n// ... (truncated)";
    }

    const byteStart = byteOffsetOf(startChar);
    const byteEnd = byteOffsetOf(startChar + finalText.length);
    addChunk(finalText, byteStart, byteEnd);
  }

  return chunks;
}

function chunkParagraphFile(absPath: string): Chunk[] {
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

export function chunkFile(absPath: string): Chunk[] {
  // Dispatch based on file type
  if (absPath.endsWith(".ts") || absPath.endsWith(".tsx")) {
    return chunkCodeFile(absPath);
  } else {
    return chunkParagraphFile(absPath);
  }
}
