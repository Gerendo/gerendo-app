#!/usr/bin/env bash
# PostToolUse hook on Edit|Write: lint touched files for encryption discipline.
# Reads JSON from stdin, extracts the file_path, scans for violations.
# Always exits 0 (warn, don't block).

set -u

# Bail quietly if jq isn't on PATH.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

# Read stdin JSON.
INPUT="$(cat)"
if [ -z "$INPUT" ]; then
  exit 0
fi

FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
if [ -z "$FILE" ]; then
  exit 0
fi

PROJECT_ROOT="/Users/mingw/gerendo-app"

# Must be inside the Gerendo project root.
case "$FILE" in
  "$PROJECT_ROOT"/*) ;;
  *) exit 0 ;;
esac

# File must exist and be readable.
if [ ! -r "$FILE" ]; then
  exit 0
fi

REL="${FILE#$PROJECT_ROOT/}"
BASENAME_FILE="$(basename "$FILE")"

# Files that legitimately use bare encrypt(): exclusion list for Pattern A.
is_crypto_definition_file() {
  case "$REL" in
    src/lib/crypto-storage.ts) return 0 ;;
    src/lib/crypto-storage.test.ts) return 0 ;;
    scripts/test-crypto-storage.ts) return 0 ;;
    scripts/backfill-encryption.ts) return 0 ;;
    scripts/backfill-phase3a.ts) return 0 ;;
    scripts/backfill-phase3b.ts) return 0 ;;
    scripts/backfill-phase4.ts) return 0 ;;
    scripts/encrypt-empty-strings.ts) return 0 ;;
    scripts/rotate-encryption.ts) return 0 ;;
  esac
  return 1
}

# Determine if file is in a "sensitive area" worth scanning broadly.
is_sensitive_path() {
  case "$REL" in
    src/lib/agency-db.ts) return 0 ;;
    src/lib/decision-detector.ts) return 0 ;;
    src/app/api/sync/*) return 0 ;;
    src/app/auth/*) return 0 ;;
    src/app/api/webhooks/*) return 0 ;;
    src/app/api/conversations/*) return 0 ;;
    src/app/api/ask/*) return 0 ;;
    src/app/api/drift/*) return 0 ;;
    src/app/api/workspaces/*) return 0 ;;
  esac
  return 1
}

# Heuristic Pattern C trigger: anything that imports crypto module.
imports_crypto() {
  grep -qE "from ['\"]@/lib/crypto-(storage|aad)['\"]" "$FILE" 2>/dev/null
}

# Pattern A: bare encrypt( calls outside crypto definitions.
check_pattern_a() {
  if is_crypto_definition_file; then
    return 0
  fi
  grep -nE '\bencrypt[[:space:]]*\(' "$FILE" 2>/dev/null \
    | grep -v 'encryptForBytea' \
    | grep -v 'decrypt' \
    | grep -vE '(^|[^:])//[[:space:]]' \
    | grep -vE '^[^:]*:[[:space:]]*\*[[:space:]]' \
    | while IFS=: read -r lineno _rest; do
        if [ -n "$lineno" ]; then
          printf '[ENCRYPTION CHECK] %s:%s: bare encrypt() call — use encryptForBytea() instead\n' "$BASENAME_FILE" "$lineno"
        fi
      done
}

# Pattern B: write to a DROPPED plaintext column.
# After Phase 2/3a/3b/4 every plaintext counterpart was dropped from the schema.
# Writing to one of these column names against the matching table will fail at
# runtime; warn so the author switches to the _enc column.
check_pattern_b() {
  awk -v fname="$BASENAME_FILE" '
    function lookback_is_write_for_table(idx, table,    k, start, joined) {
      # Walk back up to 20 lines, but STOP at function boundaries so we
      # do not bleed into the previous function write call.
      start = idx - 20
      if (start < 1) start = 1
      joined = ""
      for (k = idx; k >= start; k--) {
        # Function boundary: `}` at column 0, or `function`/`export function`/`async function` declarations.
        if (lines[k] ~ /^\}/) break
        if (lines[k] ~ /^(export[[:space:]]+)?(async[[:space:]]+)?function[[:space:]]/) break
        joined = lines[k] " " joined
      }
      if (index(joined, ".from(\"" table "\"") == 0 \
          && index(joined, ".from(`" table "`") == 0 \
          && index(joined, ".from('"'"'"  table  "'"'"')") == 0) {
        return 0
      }
      if (joined ~ /\.(insert|update|upsert)\(/) {
        return 1
      }
      return 0
    }

    function check_col(col, allowed_tables_csv,    enc_pat, regex, i, line, end, t, n, tables, in_table) {
      enc_pat = col "_enc"
      regex = "(^|[[:space:],{(])" col ":[[:space:]]*[^/[:space:]]"
      n = split(allowed_tables_csv, tables, ",")

      for (i = 1; i <= NR; i++) {
        line = lines[i]
        # Skip the encrypted form itself.
        if (line ~ enc_pat) continue
        # Skip comments.
        if (line ~ /^[[:space:]]*\/\//) continue
        if (line ~ /^[[:space:]]*\*/) continue
        # Skip TypeScript type annotations.
        if (line ~ ("(^|[[:space:],{(])" col ":[[:space:]]*[A-Za-z_][A-Za-z0-9_<>\\[\\]| ]*;[[:space:]]*$")) continue
        # Skip read-side mapping: `col: decryptColumn(...)` or `col: decrypt(...)`.
        if (line ~ ("(^|[[:space:],{(])" col ":[[:space:]]*decrypt")) continue
        # Skip Promise/Array generic type annotations like `summary: string }>>`.
        if (line ~ /Promise</ || line ~ /Array</) continue

        if (match(line, regex)) {
          in_table = 0
          for (t = 1; t <= n; t++) {
            if (lookback_is_write_for_table(i, tables[t])) { in_table = 1; break }
          }
          if (!in_table) continue
          printf("[ENCRYPTION CHECK] %s:%d: write to %c%s%c — this plaintext column was DROPPED; write to %c%s%c (bytea) instead\n", fname, i, 39, col, 39, 39, enc_pat, 39)
        }
      }
    }

    { lines[NR] = $0 }
    END {
      # Phase 1+2:
      check_col("subject",          "messages")
      check_col("keyword_text",     "embeddings,drive_embeddings,asana_embeddings")
      check_col("summary",          "summaries")
      check_col("detail",           "facts")
      check_col("access_token",     "oauth_tokens")
      check_col("refresh_token",    "oauth_tokens")
      # Phase 3a:
      check_col("sender",           "messages")
      check_col("thread_id",        "messages")
      check_col("name",             "drive_files,asana_items,workspaces")
      check_col("project_name",     "asana_items")
      check_col("assignee",         "asana_items")
      check_col("notes",            "asana_items")
      check_col("due_date",         "asana_items")
      check_col("permalink_url",    "asana_items")
      check_col("context_text",     "workspace_contexts")
      # Phase 3b:
      check_col("decision_summary", "drift_findings")
      check_col("draft_update",     "drift_findings")
      check_col("resolution_note",  "drift_findings")
      # Phase 4:
      check_col("title",            "conversations")
      check_col("content",          "conversation_messages")
    }
  ' "$FILE"
}

# Pattern C: informational note when crypto module is imported.
check_pattern_c() {
  case "$REL" in
    src/lib/crypto-storage.ts) return 0 ;;
    src/lib/crypto-aad.ts) return 0 ;;
  esac
  if imports_crypto; then
    printf '[ENCRYPTION CHECK] %s imports crypto module — verify AAD builders match write/read sites\n' "$BASENAME_FILE"
  fi
}

check_pattern_a

if is_sensitive_path || imports_crypto; then
  check_pattern_b
  check_pattern_c
fi

exit 0
