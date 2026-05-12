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
          printf '[ENCRYPTION CHECK] %s:%s: bare encrypt() call — use encryptForBytea() instead, see CLAUDE.md\n' "$BASENAME_FILE" "$lineno"
        fi
      done
}

# Pattern B: write to sensitive plaintext column without matching _enc in surrounding block.
# Only fires when the surrounding context is an actual Supabase write
# (.insert/.update/.upsert) on the matching sensitive table.
check_pattern_b() {
  awk -v fname="$BASENAME_FILE" '
    function lookback_is_write_for_table(idx, table,    j, start, joined, k) {
      # Walk back up to 30 lines, build a window, and look for
      # .from("table") ... .insert/update/upsert(  with no closing brace yet on current line.
      start = idx - 30
      if (start < 1) start = 1
      joined = ""
      for (k = start; k <= idx; k++) {
        joined = joined " " lines[k]
      }
      # Require a .from("table") AND a write call in the window.
      if (index(joined, ".from(\"" table "\"") == 0 && index(joined, ".from(`" table "`") == 0 && index(joined, ".from('"'"'"  table  "'"'"')") == 0) {
        return 0
      }
      if (joined ~ /\.(insert|update|upsert)\(/) {
        return 1
      }
      return 0
    }

    function check_col(col, allowed_tables_csv,    enc_pat, regex, i, line, found, end, j, start_back, tables, n, t, in_table) {
      enc_pat = col "_enc"
      # Require col: as a key — preceded by start, whitespace, comma, brace, or paren — and value not a comment.
      regex = "(^|[[:space:],{(])" col ":[[:space:]]*[^/[:space:]]"
      n = split(allowed_tables_csv, tables, ",")

      for (i = 1; i <= NR; i++) {
        line = lines[i]
        if (line ~ enc_pat) continue
        if (line ~ /^[[:space:]]*\/\//) continue
        if (line ~ /^[[:space:]]*\*/) continue
        # Skip TypeScript type annotations: `col: SomeType;` or `col: string;` etc.
        # If line ends with `;` and value looks like a TS type (no quotes, no call, no comma at end of object literal),
        # treat as type decl. Heuristic: matches `col:[ws]<word>(\[\])?;` or `col:[ws]<word>\s*\|`.
        if (line ~ ("(^|[[:space:],{(])" col ":[[:space:]]*[A-Za-z_][A-Za-z0-9_<>\\[\\]| ]*;[[:space:]]*$")) continue

        if (match(line, regex)) {
          # Confirm we are in a write to one of the allowed tables.
          in_table = 0
          for (t = 1; t <= n; t++) {
            if (lookback_is_write_for_table(i, tables[t])) { in_table = 1; break }
          }
          if (!in_table) continue

          # Look for matching _enc within +/- 15 lines.
          found = 0
          end = i + 15
          if (end > NR) end = NR
          for (j = i; j <= end; j++) {
            if (index(lines[j], enc_pat) > 0) { found = 1; break }
          }
          if (!found) {
            start_back = i - 5
            if (start_back < 1) start_back = 1
            for (j = start_back; j < i; j++) {
              if (index(lines[j], enc_pat) > 0) { found = 1; break }
            }
          }
          if (!found) {
            printf("[ENCRYPTION CHECK] %s:%d: write to %c%s%c without matching %c%s_enc%c — sensitive data must be written to both columns, see CLAUDE.md\n", fname, i, 39, col, 39, 39, col, 39)
          }
        }
      }
    }

    { lines[NR] = $0 }
    END {
      # column -> allowed tables (only flag when writing to one of these tables).
      check_col("keyword_text",  "embeddings,drive_embeddings,asana_embeddings")
      check_col("subject",       "messages")
      check_col("summary",       "summaries")
      check_col("detail",        "facts")
      check_col("access_token",  "oauth_tokens")
      check_col("refresh_token", "oauth_tokens")
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
