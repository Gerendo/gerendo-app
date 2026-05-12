#!/usr/bin/env npx tsx
// Phase 1 backfill for app-layer envelope encryption.
// See /Users/mingw/.claude/plans/atomic-crafting-wreath.md
//
// Usage:
//   npx tsx scripts/backfill-encryption.ts --mode encrypt
//   npx tsx scripts/backfill-encryption.ts --mode verify
//   npx tsx scripts/backfill-encryption.ts --mode dry-run-null
//   npx tsx scripts/backfill-encryption.ts --mode null-plaintext --confirm-i-understand-this-is-irreversible
//
// Requires: GERENDO_MASTER_KEY env var, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Modes:
//   encrypt          - additive, idempotent. For each (table, column) pair, find
//                      rows where plaintext IS NOT NULL AND _enc IS NULL, encrypt
//                      the plaintext and write to the _enc column. Never touches
//                      the plaintext. Re-running is a no-op.
//   verify           - read-only. Prints per-table counts:
//                        (a) plaintext IS NOT NULL
//                        (b) _enc IS NOT NULL
//                        (c) both NULL
//                        (d) plaintext IS NOT NULL AND _enc IS NULL
//                      (d) must be 0 before running null-plaintext.
//   dry-run-null     - read-only. Runs the SAME decrypt-and-compare check as
//                      null-plaintext WITHOUT any writes. Reports per-table
//                      pass/fail counts. Exits non-zero if any row fails.
//                      If this is clean, null-plaintext is safe to run.
//   null-plaintext   - DESTRUCTIVE. For each (table, column) pair, find rows
//                      where plaintext IS NOT NULL AND _enc IS NOT NULL, decrypt
//                      the _enc column and assert equality with the plaintext,
//                      then NULL the plaintext column. Requires
//                      --confirm-i-understand-this-is-irreversible.

import { encrypt, encryptForBytea, decryptOrFallback } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";
import { createServiceClient } from "@/lib/supabase-server";

type Mode = "encrypt" | "verify" | "dry-run-null" | "null-plaintext";

const USAGE = `Phase 1 encryption backfill script.

Usage:
  npx tsx scripts/backfill-encryption.ts --mode <encrypt|verify|dry-run-null|null-plaintext> [flags]

Modes:
  --mode encrypt         Safe, idempotent. Encrypts plaintext into _enc columns.
  --mode verify          Read-only. Prints per-table counts.
  --mode dry-run-null    Read-only. Runs null-plaintext's decrypt-and-compare
                         check WITHOUT writes. Exits non-zero if any row fails.
  --mode null-plaintext  DESTRUCTIVE. NULLs plaintext after verifying _enc.
                         Requires --confirm-i-understand-this-is-irreversible.

Required env: GERENDO_MASTER_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
`;

function parseArgs(argv: string[]): {
  mode: Mode | null;
  confirm: boolean;
} {
  let mode: Mode | null = null;
  let confirm = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode") {
      const v = argv[i + 1];
      if (
        v === "encrypt" ||
        v === "verify" ||
        v === "dry-run-null" ||
        v === "null-plaintext"
      ) {
        mode = v;
        i++;
      } else {
        mode = null;
      }
    } else if (a === "--confirm-i-understand-this-is-irreversible") {
      confirm = true;
    }
  }
  return { mode, confirm };
}

// Print help BEFORE doing anything that touches env, the DB, or the crypto
// module. `crypto-storage.ts` is statically imported but it only reads
// GERENDO_MASTER_KEY lazily inside encrypt()/decrypt(), so unsetting the key
// is fine until we actually call them.
const args = parseArgs(process.argv.slice(2));
if (args.mode === null) {
  process.stdout.write(USAGE);
  process.exit(1);
}

if (args.mode === "null-plaintext" && !args.confirm) {
  process.stderr.write(
    "REFUSED: --mode null-plaintext is destructive and irreversible.\n" +
      "Pass --confirm-i-understand-this-is-irreversible to proceed.\n"
  );
  process.exit(2);
}

// Use a loose type for the Supabase client throughout — the script builds
// queries dynamically over generic table names, which is exactly the case
// Supabase JS's generated types don't cover. Casting to `any` once at the
// boundary is cleaner than fighting the generic types per call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

const BATCH_SIZE = 200;

// ---------------------------------------------------------------------------
// Table configuration
// ---------------------------------------------------------------------------

type TableConfig = {
  table: string;
  plaintextCol: string;
  encCol: string;
  identityCols: string[];
  // Build the AAD string for a row. Returns null if any identity column is
  // missing (caller should skip the row with a warning).
  buildAad: (row: Record<string, unknown>) => string | null;
};

function reqStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return String(v);
}

function reqNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const TABLES: TableConfig[] = [
  {
    table: "embeddings",
    plaintextCol: "keyword_text",
    encCol: "keyword_text_enc",
    identityCols: ["id", "workspace_id", "message_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const messageId = reqNum(r.message_id);
      if (!ws || messageId === null) return null;
      return aad.embeddingsKeywordText(ws, messageId);
    },
  },
  {
    table: "drive_embeddings",
    plaintextCol: "keyword_text",
    encCol: "keyword_text_enc",
    identityCols: ["id", "workspace_id", "file_id", "chunk_index"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const fileId = reqNum(r.file_id);
      const chunkIndex = reqNum(r.chunk_index);
      if (!ws || fileId === null || chunkIndex === null) return null;
      return aad.driveEmbeddingsKeywordText(ws, fileId, chunkIndex);
    },
  },
  {
    table: "asana_embeddings",
    plaintextCol: "keyword_text",
    encCol: "keyword_text_enc",
    identityCols: ["id", "workspace_id", "item_id", "chunk_index"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const itemId = reqNum(r.item_id);
      const chunkIndex = reqNum(r.chunk_index);
      if (!ws || itemId === null || chunkIndex === null) return null;
      return aad.asanaEmbeddingsKeywordText(ws, itemId, chunkIndex);
    },
  },
  {
    table: "summaries",
    plaintextCol: "summary",
    encCol: "summary_enc",
    identityCols: ["id", "workspace_id", "message_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const messageId = reqNum(r.message_id);
      if (!ws || messageId === null) return null;
      return aad.summariesSummary(ws, messageId);
    },
  },
  {
    table: "facts",
    plaintextCol: "detail",
    encCol: "detail_enc",
    identityCols: ["id", "workspace_id", "message_id", "type", "subject"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const type = reqStr(r.type);
      if (!ws || !type) return null;
      // message_id and subject are nullable in the AAD builder
      const messageId =
        r.message_id === null || r.message_id === undefined
          ? null
          : reqNum(r.message_id);
      const subject =
        r.subject === null || r.subject === undefined ? null : reqStr(r.subject);
      return aad.factsDetail(ws, messageId, type, subject);
    },
  },
  {
    table: "messages",
    plaintextCol: "subject",
    encCol: "subject_enc",
    identityCols: ["id", "workspace_id", "user_id", "source", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const source = reqStr(r.source);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !source || !externalId) return null;
      return aad.messagesSubject(ws, userId, source, externalId);
    },
  },
  {
    table: "oauth_tokens",
    plaintextCol: "access_token",
    encCol: "access_token_enc",
    identityCols: ["id", "workspace_id", "user_id", "provider"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const provider = reqStr(r.provider);
      if (!ws || !userId || !provider) return null;
      return aad.oauthTokensAccessToken(ws, userId, provider);
    },
  },
  {
    table: "oauth_tokens",
    plaintextCol: "refresh_token",
    encCol: "refresh_token_enc",
    identityCols: ["id", "workspace_id", "user_id", "provider"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const provider = reqStr(r.provider);
      if (!ws || !userId || !provider) return null;
      return aad.oauthTokensRefreshToken(ws, userId, provider);
    },
  },
];

// ---------------------------------------------------------------------------
// Mode: verify
// ---------------------------------------------------------------------------

async function countWhere(
  supabase: SupabaseLike,
  table: string,
  filter: (q: SupabaseLike) => SupabaseLike
): Promise<number> {
  // Supabase JS count via head:true returns just the count, no rows.
  const base = supabase.from(table).select("*", { count: "exact", head: true });
  const filtered = filter(base);
  const { count, error } = await filtered;
  if (error) throw new Error(`count(${table}): ${error.message}`);
  return (count as number | null) ?? 0;
}

async function runVerify(supabase: SupabaseLike): Promise<void> {
  console.log("=== verify mode (read-only) ===\n");
  let totalNeedingBackfill = 0;
  for (const cfg of TABLES) {
    const label = `${cfg.table}.${cfg.plaintextCol}`;
    const a = await countWhere(supabase, cfg.table, (q) =>
      q.not(cfg.plaintextCol, "is", null)
    );
    const b = await countWhere(supabase, cfg.table, (q) =>
      q.not(cfg.encCol, "is", null)
    );
    const c = await countWhere(supabase, cfg.table, (q) =>
      q.is(cfg.plaintextCol, null).is(cfg.encCol, null)
    );
    const d = await countWhere(supabase, cfg.table, (q) =>
      q.not(cfg.plaintextCol, "is", null).is(cfg.encCol, null)
    );
    totalNeedingBackfill += d;
    console.log(`[${label}]`);
    console.log(`  (a) plaintext IS NOT NULL              : ${a}`);
    console.log(`  (b) enc IS NOT NULL                    : ${b}`);
    console.log(`  (c) both NULL                          : ${c}`);
    console.log(
      `  (d) plaintext NOT NULL AND enc NULL    : ${d}   ${d === 0 ? "OK" : "NEEDS BACKFILL"}`
    );
    console.log("");
  }
  console.log(
    `Summary: ${totalNeedingBackfill} row(s) across all tables need encryption backfill.`
  );
  if (totalNeedingBackfill > 0) {
    console.log("Run with --mode encrypt to populate the _enc columns.");
  } else {
    console.log("All rows are encrypted; --mode null-plaintext is safe to run.");
  }
}

// ---------------------------------------------------------------------------
// Mode: encrypt
// ---------------------------------------------------------------------------

type BatchResult = {
  processed: number;
  encrypted: number;
  skipped: number;
  errored: number;
};

async function runEncrypt(supabase: SupabaseLike): Promise<number> {
  console.log("=== encrypt mode (additive, idempotent) ===\n");
  let totalErrors = 0;

  for (const cfg of TABLES) {
    const label = `${cfg.table}.${cfg.plaintextCol}`;
    const selectCols = Array.from(
      new Set([...cfg.identityCols, cfg.plaintextCol, cfg.encCol])
    ).join(", ");

    let batchN = 0;
    const tableTotals: BatchResult = {
      processed: 0,
      encrypted: 0,
      skipped: 0,
      errored: 0,
    };

    // Loop: select page of rows where plaintext IS NOT NULL AND enc IS NULL,
    // encrypt each, update by id. Since each successful update flips enc from
    // NULL to non-NULL, those rows drop out of the filter for the next read,
    // so range(0, BATCH_SIZE-1) every iteration is correct. Stop when empty.
    while (true) {
      batchN++;
      const { data, error } = await supabase
        .from(cfg.table)
        .select(selectCols)
        .not(cfg.plaintextCol, "is", null)
        .is(cfg.encCol, null)
        .order("id", { ascending: true })
        .range(0, BATCH_SIZE - 1);

      if (error) {
        console.error(`[${label}] select failed: ${error.message}`);
        totalErrors++;
        break;
      }
      const rows = (data as Array<Record<string, unknown>> | null) ?? [];
      if (rows.length === 0) break;

      const batchResult: BatchResult = {
        processed: 0,
        encrypted: 0,
        skipped: 0,
        errored: 0,
      };

      for (const row of rows) {
        batchResult.processed++;
        const rowIdNum = reqNum(row.id);
        const rowId = rowIdNum ?? row.id;
        const plaintextRaw = row[cfg.plaintextCol];
        if (plaintextRaw === null || plaintextRaw === undefined) {
          // Defensive: filter should already exclude these.
          batchResult.skipped++;
          continue;
        }
        const plaintext = String(plaintextRaw);
        if (row[cfg.encCol] !== null && row[cfg.encCol] !== undefined) {
          // Defensive: filter should already exclude these. Keeps idempotency
          // airtight if we ever miss-quote a filter.
          batchResult.skipped++;
          continue;
        }
        const aadStr = cfg.buildAad(row);
        if (!aadStr) {
          console.warn(
            `[${label}] row id=${String(rowId)} missing AAD identity columns; skipping`
          );
          batchResult.skipped++;
          continue;
        }
        try {
          const blob = encryptForBytea(plaintext, aadStr);
          const { error: updErr } = await supabase
            .from(cfg.table)
            .update({ [cfg.encCol]: blob })
            .eq("id", rowId);
          if (updErr) {
            console.error(
              `[${label}] row id=${String(rowId)} update failed: ${updErr.message}`
            );
            batchResult.errored++;
            continue;
          }
          batchResult.encrypted++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            `[${label}] row id=${String(rowId)} encrypt failed: ${msg}`
          );
          batchResult.errored++;
        }
      }

      console.log(
        `[${label}] batch ${batchN}: processed ${batchResult.processed}, ` +
          `encrypted ${batchResult.encrypted}, skipped ${batchResult.skipped}, ` +
          `errored ${batchResult.errored}`
      );

      tableTotals.processed += batchResult.processed;
      tableTotals.encrypted += batchResult.encrypted;
      tableTotals.skipped += batchResult.skipped;
      tableTotals.errored += batchResult.errored;

      // Safety: if a batch made no forward progress (everything skipped or
      // errored), stop this table to avoid an infinite loop on persistent
      // bad rows.
      if (
        batchResult.encrypted === 0 &&
        batchResult.skipped + batchResult.errored === rows.length
      ) {
        console.warn(
          `[${label}] batch ${batchN} made no progress (all skipped/errored); stopping this table`
        );
        break;
      }
    }

    console.log(
      `[${label}] DONE: total processed=${tableTotals.processed}, ` +
        `encrypted=${tableTotals.encrypted}, skipped=${tableTotals.skipped}, ` +
        `errored=${tableTotals.errored}\n`
    );
    totalErrors += tableTotals.errored;
  }

  return totalErrors;
}

// ---------------------------------------------------------------------------
// Shared decrypt-and-compare helper (used by null-plaintext and dry-run-null)
// ---------------------------------------------------------------------------

type VerifyResult =
  | { status: "ok" }
  | { status: "skip"; reason: string }
  | { status: "decrypt-failed"; message: string }
  | {
      status: "mismatch";
      plaintextLength: number;
      decryptedLength: number;
      plaintextPreview: string;
      decryptedPreview: string;
    };

function truncatePreview(s: string): string {
  return s.length > 50 ? s.slice(0, 50) + "..." : s;
}

// Decrypt the _enc column and compare to the plaintext column. Pure, no writes.
// Both runNullPlaintext and runDryRunNull route through this so the dry-run
// guarantee is byte-for-byte identical to the destructive run.
function verifyOneRow(
  cfg: TableConfig,
  row: Record<string, unknown>
): VerifyResult {
  const plaintextRaw = row[cfg.plaintextCol];
  const encRaw = row[cfg.encCol];
  if (plaintextRaw === null || plaintextRaw === undefined) {
    return { status: "skip", reason: "plaintext is null" };
  }
  if (encRaw === null || encRaw === undefined) {
    return { status: "skip", reason: "enc is null" };
  }
  const plaintext = String(plaintextRaw);
  const aadStr = cfg.buildAad(row);
  if (!aadStr) {
    return { status: "skip", reason: "missing AAD identity columns" };
  }

  let decrypted: string;
  try {
    decrypted = decryptOrFallback(encRaw as Buffer | null, null, aadStr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "decrypt-failed", message: msg };
  }

  if (decrypted !== plaintext) {
    return {
      status: "mismatch",
      plaintextLength: plaintext.length,
      decryptedLength: decrypted.length,
      plaintextPreview: truncatePreview(plaintext),
      decryptedPreview: truncatePreview(decrypted),
    };
  }
  return { status: "ok" };
}

// ---------------------------------------------------------------------------
// Mode: dry-run-null
// ---------------------------------------------------------------------------

async function runDryRunNull(supabase: SupabaseLike): Promise<number> {
  console.log("=== dry-run-null mode (read-only, no writes) ===\n");
  let totalFailures = 0;

  for (const cfg of TABLES) {
    const label = `${cfg.table}.${cfg.plaintextCol}`;
    const selectCols = Array.from(
      new Set([...cfg.identityCols, cfg.plaintextCol, cfg.encCol])
    ).join(", ");

    let lastId: number | string | null = null;
    let okCount = 0;
    let mismatchCount = 0;
    let skipCount = 0;
    let abortedHere = false;

    while (true) {
      let query = supabase
        .from(cfg.table)
        .select(selectCols)
        .not(cfg.plaintextCol, "is", null)
        .not(cfg.encCol, "is", null)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);
      if (lastId !== null) {
        query = query.gt("id", lastId);
      }
      const { data, error } = await query;

      if (error) {
        console.error(`[${label}] select failed: ${error.message}`);
        totalFailures++;
        break;
      }
      const rows = (data as Array<Record<string, unknown>> | null) ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const rowIdNum = reqNum(row.id);
        const rowId = rowIdNum ?? row.id;
        // Advance the cursor regardless of outcome to keep paging forward
        // even on skipped/mismatch rows.
        lastId =
          rowIdNum !== null ? rowIdNum : (row.id as string | number | null);

        const result = verifyOneRow(cfg, row);
        if (result.status === "ok") {
          okCount++;
        } else if (result.status === "skip") {
          skipCount++;
          console.warn(
            `[${label}] row id=${String(rowId)} skipped: ${result.reason}`
          );
        } else if (result.status === "decrypt-failed") {
          mismatchCount++;
          totalFailures++;
          console.error(
            `WOULD ABORT at row id=${String(rowId)} table=${cfg.table} ` +
              `(decrypt failed: ${result.message})`
          );
        } else {
          // mismatch
          mismatchCount++;
          totalFailures++;
          console.error(
            `WOULD ABORT at row id=${String(rowId)} table=${cfg.table}\n` +
              `  plaintext.length=${result.plaintextLength}, decrypted.length=${result.decryptedLength}\n` +
              `  plaintext[0..50]=${JSON.stringify(result.plaintextPreview)}\n` +
              `  decrypted[0..50]=${JSON.stringify(result.decryptedPreview)}`
          );
        }
      }

      if (rows.length < BATCH_SIZE) break;
      // Defensive: if id cursor didn't advance (e.g. non-numeric ids), stop.
      if (lastId === null) {
        console.warn(
          `[${label}] cursor did not advance; stopping this table`
        );
        abortedHere = true;
        break;
      }
    }

    const verifiedTotal = okCount + mismatchCount;
    console.log(
      `[${label}] verified ${okCount}/${verifiedTotal} rows OK, ${mismatchCount} mismatches` +
        (skipCount > 0 ? ` (${skipCount} skipped)` : "") +
        (abortedHere ? " [partial: cursor stalled]" : "")
    );
  }

  console.log("");
  if (totalFailures > 0) {
    console.error(
      `dry-run-null: ${totalFailures} failure(s) detected. null-plaintext is NOT safe to run.`
    );
  } else {
    console.log(
      "dry-run-null: all rows verified clean. null-plaintext is safe to run."
    );
  }
  return totalFailures;
}

// ---------------------------------------------------------------------------
// Mode: null-plaintext
// ---------------------------------------------------------------------------

async function runNullPlaintext(supabase: SupabaseLike): Promise<number> {
  console.log("=== null-plaintext mode (DESTRUCTIVE, irreversible) ===\n");
  let totalErrors = 0;

  for (const cfg of TABLES) {
    const label = `${cfg.table}.${cfg.plaintextCol}`;
    const selectCols = Array.from(
      new Set([...cfg.identityCols, cfg.plaintextCol, cfg.encCol])
    ).join(", ");

    let batchN = 0;
    const tableTotals = { processed: 0, nulled: 0, skipped: 0, errored: 0 };

    while (true) {
      batchN++;
      const { data, error } = await supabase
        .from(cfg.table)
        .select(selectCols)
        .not(cfg.plaintextCol, "is", null)
        .not(cfg.encCol, "is", null)
        .order("id", { ascending: true })
        .range(0, BATCH_SIZE - 1);

      if (error) {
        console.error(`[${label}] select failed: ${error.message}`);
        totalErrors++;
        break;
      }
      const rows = (data as Array<Record<string, unknown>> | null) ?? [];
      if (rows.length === 0) break;

      const batchResult = { processed: 0, nulled: 0, skipped: 0, errored: 0 };

      for (const row of rows) {
        batchResult.processed++;
        const rowIdNum = reqNum(row.id);
        const rowId = rowIdNum ?? row.id;

        // Use the shared verifier so behavior matches dry-run-null exactly.
        const verifyResult = verifyOneRow(cfg, row);
        if (verifyResult.status === "skip") {
          if (verifyResult.reason === "missing AAD identity columns") {
            console.warn(
              `[${label}] row id=${String(rowId)} missing AAD identity columns; skipping`
            );
          }
          batchResult.skipped++;
          continue;
        }
        if (verifyResult.status === "decrypt-failed") {
          console.error(
            `[${label}] row id=${String(rowId)} DECRYPT FAILED: ${verifyResult.message} - ABORTING`
          );
          process.exit(3);
        }
        if (verifyResult.status === "mismatch") {
          console.error(
            `[${label}] row id=${String(rowId)} INTEGRITY MISMATCH - ABORTING\n` +
              `  plaintext.length=${verifyResult.plaintextLength}, decrypted.length=${verifyResult.decryptedLength}\n` +
              `  plaintext[0..50]=${JSON.stringify(verifyResult.plaintextPreview)}\n` +
              `  decrypted[0..50]=${JSON.stringify(verifyResult.decryptedPreview)}`
          );
          process.exit(4);
        }

        // Verified. NULL the plaintext column.
        try {
          const { error: updErr } = await supabase
            .from(cfg.table)
            .update({ [cfg.plaintextCol]: null })
            .eq("id", rowId);
          if (updErr) {
            console.error(
              `[${label}] row id=${String(rowId)} update failed: ${updErr.message}`
            );
            batchResult.errored++;
            continue;
          }
          batchResult.nulled++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            `[${label}] row id=${String(rowId)} update threw: ${msg}`
          );
          batchResult.errored++;
        }
      }

      console.log(
        `[${label}] batch ${batchN}: processed ${batchResult.processed}, ` +
          `nulled ${batchResult.nulled}, skipped ${batchResult.skipped}, ` +
          `errored ${batchResult.errored}`
      );

      tableTotals.processed += batchResult.processed;
      tableTotals.nulled += batchResult.nulled;
      tableTotals.skipped += batchResult.skipped;
      tableTotals.errored += batchResult.errored;

      if (
        batchResult.nulled === 0 &&
        batchResult.skipped + batchResult.errored === rows.length
      ) {
        console.warn(
          `[${label}] batch ${batchN} made no progress (all skipped/errored); stopping this table`
        );
        break;
      }
    }

    console.log(
      `[${label}] DONE: total processed=${tableTotals.processed}, ` +
        `nulled=${tableTotals.nulled}, skipped=${tableTotals.skipped}, ` +
        `errored=${tableTotals.errored}\n`
    );
    totalErrors += tableTotals.errored;
  }

  return totalErrors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // For mutating modes, fail fast if the master key is missing or malformed
  // by performing a throwaway encrypt() at startup. Avoids discovering the
  // problem halfway through batch N.
  if (args.mode !== "verify") {
    try {
      encrypt("", "startup-key-check");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Master key check failed: ${msg}`);
      process.exit(5);
    }
  }

  const supabase: SupabaseLike = createServiceClient();
  let errors = 0;

  if (args.mode === "verify") {
    await runVerify(supabase);
  } else if (args.mode === "encrypt") {
    errors = await runEncrypt(supabase);
  } else if (args.mode === "dry-run-null") {
    errors = await runDryRunNull(supabase);
  } else if (args.mode === "null-plaintext") {
    errors = await runNullPlaintext(supabase);
  }

  if (errors > 0) {
    console.error(`\nCompleted with ${errors} row error(s).`);
    process.exit(6);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  console.error(`FATAL: ${msg}`);
  process.exit(7);
});
