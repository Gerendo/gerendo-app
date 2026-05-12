#!/usr/bin/env npx tsx
// Phase 3a Bucket C backfill for app-layer envelope encryption.
// See /Users/mingw/.claude/plans/atomic-crafting-wreath.md and the Phase 1
// counterpart scripts/backfill-encryption.ts (whose structure this mirrors).
//
// Bucket C covers content/PII columns left plaintext by Phase 1+2:
//   messages.sender, messages.thread_id
//   drive_files.name
//   asana_items.{name, project_name, assignee, notes, due_date, permalink_url}
//   workspace_contexts.context_text
//   drift_findings.{decision_summary, draft_update, resolution_note}
//
// Usage:
//   npx tsx scripts/backfill-bucket-c.ts --mode encrypt
//   npx tsx scripts/backfill-bucket-c.ts --mode verify
//   npx tsx scripts/backfill-bucket-c.ts --mode dry-run-null
//   npx tsx scripts/backfill-bucket-c.ts --mode null-plaintext --confirm-i-understand-this-is-irreversible
//
// Requires: GERENDO_MASTER_KEY env var, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { encrypt, encryptForBytea, decryptOrFallback } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";
import { createServiceClient } from "@/lib/supabase-server";

type Mode = "encrypt" | "verify" | "dry-run-null" | "null-plaintext";

const USAGE = `Phase 3a Bucket C encryption backfill script.

Usage:
  npx tsx scripts/backfill-bucket-c.ts --mode <encrypt|verify|dry-run-null|null-plaintext> [flags]

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
  // workspace_contexts uses workspace_id as its primary key (no `id` column).
  // The default cursor is "id"; tables without that need a different cursor.
  idCol?: string;
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
  // ── messages ────────────────────────────────────────────────────────────
  {
    table: "messages",
    plaintextCol: "sender",
    encCol: "sender_enc",
    identityCols: ["id", "workspace_id", "user_id", "source", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const source = reqStr(r.source);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !source || !externalId) return null;
      return aad.messagesSender(ws, userId, source, externalId);
    },
  },
  {
    table: "messages",
    plaintextCol: "thread_id",
    encCol: "thread_id_enc",
    identityCols: ["id", "workspace_id", "user_id", "source", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const source = reqStr(r.source);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !source || !externalId) return null;
      return aad.messagesThreadId(ws, userId, source, externalId);
    },
  },
  // ── drive_files ─────────────────────────────────────────────────────────
  {
    table: "drive_files",
    plaintextCol: "name",
    encCol: "name_enc",
    identityCols: ["id", "workspace_id", "user_id", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !externalId) return null;
      return aad.driveFilesName(ws, userId, externalId);
    },
  },
  // ── asana_items ─────────────────────────────────────────────────────────
  {
    table: "asana_items",
    plaintextCol: "name",
    encCol: "name_enc",
    identityCols: ["id", "workspace_id", "user_id", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !externalId) return null;
      return aad.asanaItemsName(ws, userId, externalId);
    },
  },
  {
    table: "asana_items",
    plaintextCol: "project_name",
    encCol: "project_name_enc",
    identityCols: ["id", "workspace_id", "user_id", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !externalId) return null;
      return aad.asanaItemsProjectName(ws, userId, externalId);
    },
  },
  {
    table: "asana_items",
    plaintextCol: "assignee",
    encCol: "assignee_enc",
    identityCols: ["id", "workspace_id", "user_id", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !externalId) return null;
      return aad.asanaItemsAssignee(ws, userId, externalId);
    },
  },
  {
    table: "asana_items",
    plaintextCol: "notes",
    encCol: "notes_enc",
    identityCols: ["id", "workspace_id", "user_id", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !externalId) return null;
      return aad.asanaItemsNotes(ws, userId, externalId);
    },
  },
  {
    table: "asana_items",
    plaintextCol: "due_date",
    encCol: "due_date_enc",
    identityCols: ["id", "workspace_id", "user_id", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !externalId) return null;
      return aad.asanaItemsDueDate(ws, userId, externalId);
    },
  },
  {
    table: "asana_items",
    plaintextCol: "permalink_url",
    encCol: "permalink_url_enc",
    identityCols: ["id", "workspace_id", "user_id", "external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const externalId = reqStr(r.external_id);
      if (!ws || !userId || !externalId) return null;
      return aad.asanaItemsPermalinkUrl(ws, userId, externalId);
    },
  },
  // ── workspace_contexts ──────────────────────────────────────────────────
  // No `id` column; primary key is workspace_id. Use workspace_id as cursor.
  {
    table: "workspace_contexts",
    plaintextCol: "context_text",
    encCol: "context_text_enc",
    identityCols: ["workspace_id"],
    idCol: "workspace_id",
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      if (!ws) return null;
      return aad.workspaceContextsContextText(ws);
    },
  },
  // ── drift_findings ──────────────────────────────────────────────────────
  {
    table: "drift_findings",
    plaintextCol: "decision_summary",
    encCol: "decision_summary_enc",
    identityCols: ["id", "workspace_id", "user_id", "source", "source_external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const source = reqStr(r.source);
      const ext = reqStr(r.source_external_id);
      if (!ws || !userId || !source || !ext) return null;
      return aad.driftFindingsDecisionSummary(ws, userId, source, ext);
    },
  },
  {
    table: "drift_findings",
    plaintextCol: "draft_update",
    encCol: "draft_update_enc",
    identityCols: ["id", "workspace_id", "user_id", "source", "source_external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const source = reqStr(r.source);
      const ext = reqStr(r.source_external_id);
      if (!ws || !userId || !source || !ext) return null;
      return aad.driftFindingsDraftUpdate(ws, userId, source, ext);
    },
  },
  {
    table: "drift_findings",
    plaintextCol: "resolution_note",
    encCol: "resolution_note_enc",
    identityCols: ["id", "workspace_id", "user_id", "source", "source_external_id"],
    buildAad: (r) => {
      const ws = reqStr(r.workspace_id);
      const userId = reqStr(r.user_id);
      const source = reqStr(r.source);
      const ext = reqStr(r.source_external_id);
      if (!ws || !userId || !source || !ext) return null;
      return aad.driftFindingsResolutionNote(ws, userId, source, ext);
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
  const base = supabase.from(table).select("*", { count: "exact", head: true });
  const filtered = filter(base);
  const { count, error } = await filtered;
  if (error) {
    const detail = [error.message, error.details, error.hint, error.code]
      .filter(Boolean)
      .join(" | ");
    throw new Error(`count(${table}): ${detail || "(empty error, likely missing column — has the Phase 3a migration been applied?)"}`);
  }
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
    const idCol = cfg.idCol ?? "id";
    const selectCols = Array.from(
      new Set([...cfg.identityCols, idCol, cfg.plaintextCol, cfg.encCol])
    ).join(", ");

    let batchN = 0;
    const tableTotals: BatchResult = {
      processed: 0,
      encrypted: 0,
      skipped: 0,
      errored: 0,
    };

    while (true) {
      batchN++;
      const { data, error } = await supabase
        .from(cfg.table)
        .select(selectCols)
        .not(cfg.plaintextCol, "is", null)
        .is(cfg.encCol, null)
        .order(idCol, { ascending: true })
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
        const rowIdRaw = row[idCol];
        const rowIdNum = reqNum(rowIdRaw);
        const rowId = rowIdNum ?? rowIdRaw;
        const plaintextRaw = row[cfg.plaintextCol];
        if (plaintextRaw === null || plaintextRaw === undefined) {
          batchResult.skipped++;
          continue;
        }
        const plaintext = String(plaintextRaw);
        // Match Phase 1 behavior: skip empty strings.
        if (plaintext.length === 0) {
          batchResult.skipped++;
          continue;
        }
        if (row[cfg.encCol] !== null && row[cfg.encCol] !== undefined) {
          batchResult.skipped++;
          continue;
        }
        const aadStr = cfg.buildAad(row);
        if (!aadStr) {
          console.warn(
            `[${label}] row ${idCol}=${String(rowId)} missing AAD identity columns; skipping`
          );
          batchResult.skipped++;
          continue;
        }
        try {
          const blob = encryptForBytea(plaintext, aadStr);
          const { error: updErr } = await supabase
            .from(cfg.table)
            .update({ [cfg.encCol]: blob })
            .eq(idCol, rowId);
          if (updErr) {
            console.error(
              `[${label}] row ${idCol}=${String(rowId)} update failed: ${updErr.message}`
            );
            batchResult.errored++;
            continue;
          }
          batchResult.encrypted++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            `[${label}] row ${idCol}=${String(rowId)} encrypt failed: ${msg}`
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
    const idCol = cfg.idCol ?? "id";
    const selectCols = Array.from(
      new Set([...cfg.identityCols, idCol, cfg.plaintextCol, cfg.encCol])
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
        .order(idCol, { ascending: true })
        .limit(BATCH_SIZE);
      if (lastId !== null) {
        query = query.gt(idCol, lastId);
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
        const rowIdRaw = row[idCol];
        const rowIdNum = reqNum(rowIdRaw);
        const rowId = rowIdNum ?? rowIdRaw;
        lastId =
          rowIdNum !== null ? rowIdNum : (rowIdRaw as string | number | null);

        const result = verifyOneRow(cfg, row);
        if (result.status === "ok") {
          okCount++;
        } else if (result.status === "skip") {
          skipCount++;
          console.warn(
            `[${label}] row ${idCol}=${String(rowId)} skipped: ${result.reason}`
          );
        } else if (result.status === "decrypt-failed") {
          mismatchCount++;
          totalFailures++;
          console.error(
            `WOULD ABORT at row ${idCol}=${String(rowId)} table=${cfg.table} ` +
              `(decrypt failed: ${result.message})`
          );
        } else {
          mismatchCount++;
          totalFailures++;
          console.error(
            `WOULD ABORT at row ${idCol}=${String(rowId)} table=${cfg.table}\n` +
              `  plaintext.length=${result.plaintextLength}, decrypted.length=${result.decryptedLength}\n` +
              `  plaintext[0..50]=${JSON.stringify(result.plaintextPreview)}\n` +
              `  decrypted[0..50]=${JSON.stringify(result.decryptedPreview)}`
          );
        }
      }

      if (rows.length < BATCH_SIZE) break;
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
    const idCol = cfg.idCol ?? "id";
    const selectCols = Array.from(
      new Set([...cfg.identityCols, idCol, cfg.plaintextCol, cfg.encCol])
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
        .order(idCol, { ascending: true })
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
        const rowIdRaw = row[idCol];
        const rowIdNum = reqNum(rowIdRaw);
        const rowId = rowIdNum ?? rowIdRaw;

        const verifyResult = verifyOneRow(cfg, row);
        if (verifyResult.status === "skip") {
          if (verifyResult.reason === "missing AAD identity columns") {
            console.warn(
              `[${label}] row ${idCol}=${String(rowId)} missing AAD identity columns; skipping`
            );
          }
          batchResult.skipped++;
          continue;
        }
        if (verifyResult.status === "decrypt-failed") {
          console.error(
            `[${label}] row ${idCol}=${String(rowId)} DECRYPT FAILED: ${verifyResult.message} - ABORTING`
          );
          process.exit(3);
        }
        if (verifyResult.status === "mismatch") {
          console.error(
            `[${label}] row ${idCol}=${String(rowId)} INTEGRITY MISMATCH - ABORTING\n` +
              `  plaintext.length=${verifyResult.plaintextLength}, decrypted.length=${verifyResult.decryptedLength}\n` +
              `  plaintext[0..50]=${JSON.stringify(verifyResult.plaintextPreview)}\n` +
              `  decrypted[0..50]=${JSON.stringify(verifyResult.decryptedPreview)}`
          );
          process.exit(4);
        }

        try {
          const { error: updErr } = await supabase
            .from(cfg.table)
            .update({ [cfg.plaintextCol]: null })
            .eq(idCol, rowId);
          if (updErr) {
            console.error(
              `[${label}] row ${idCol}=${String(rowId)} update failed: ${updErr.message}`
            );
            batchResult.errored++;
            continue;
          }
          batchResult.nulled++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            `[${label}] row ${idCol}=${String(rowId)} update threw: ${msg}`
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
