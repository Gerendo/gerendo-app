# Gerendo QA Checklist

Last updated: 2026-05-10  
Legend: ✅ Pass · ❌ Fail · ⚠️ Partial · ⏭️ Skip

---

## 1. Auth

- [ ] Sign in with Google - workspace created, lands on `/ask`
- [ ] Sign in again (existing account) - session restored, no duplicate workspace
- [ ] Unauthenticated access to `/ask`, `/connect`, `/settings` → redirected to `/login`
- [ ] API routes return **401** (not redirect) for unauthenticated requests
- [ ] Two users in the same workspace cannot see each other's data

### Logout
- [ ] Log out link visible in Ask page header (desktop + hamburger on mobile)
- [ ] Log out link visible in Connect page header (desktop + hamburger on mobile)
- [ ] Log out link visible in Settings page
- [ ] Clicking Log out clears session, redirects to `/login`, back button does not restore session

---

## 2. Connect page (`/connect`)

### Navigation
- [ ] Header: Ask questions, Settings, Log out all work (desktop)
- [ ] Hamburger opens dropdown on mobile with same links
- [ ] Settings reachable from Connect page

### Tool cards - unconnected
- [ ] Gmail, Drive, Asana show "Not connected" + Connect button
- [ ] Slack / Notion / WhatsApp show "Coming soon" with no button
- [ ] "Not connected" stays on **one line** on mobile (no wrapping)
- [ ] Category filter chips scroll horizontally on mobile (single row, no wrap)

### Gmail connect
- [ ] OAuth flow completes, redirects back to `/connect?gmail_connected=1`
- [ ] Label picker modal opens after OAuth
- [ ] Inbox and Sent pre-selected by default
- [ ] Can select/deselect individual labels
- [ ] Start import begins sync, banner shows "Importing emails — X indexed"
- [ ] Count increments live
- [ ] **Stop button** cancels sync but keeps data + keeps tool connected
- [ ] After Stop, tool card shows "Active - auto-syncing" (not disconnected)
- [ ] After full sync, card shows "X indexed - auto-syncing"
- [ ] After page refresh, indexed count is still correct (loaded from DB)

### Drive connect
- [ ] OAuth completes, sync starts automatically
- [ ] Banner shows "Indexing Google Drive files..." (not "Importing emails")
- [ ] After sync, card shows "X indexed - auto-syncing"

### Asana connect
- [ ] OAuth starts without `invalid_redirect_uri` error
- [ ] After OAuth, sync starts automatically
- [ ] Banner shows "Syncing Asana tasks..."
- [ ] Webhook registered immediately on connect (check `webhook_secrets` table within 10s, see section 8A)

### Disconnect (tool card button)
- [ ] Clicking Disconnect shows confirm panel inline (not browser alert)
- [ ] Confirming removes OAuth token, tool shows "Not connected"
- [ ] **Data is NOT deleted** - check Supabase: rows still exist after disconnect
- [ ] Reconnecting after disconnect → incremental sync (fast, not full re-index)
- [ ] Cancel dismisses confirm without changing anything

---

## 3. Settings (`/settings`)

### Content
- [ ] Current user name, email, avatar shown
- [ ] Workspace name shown
- [ ] Team members list with roles and "You" badge

### Invite flow
- [ ] Generate invite link works, no error (**was BUG-003**)
- [ ] Generated URL is copyable
- [ ] Invite link opens join page for another account
- [ ] Already-used invite shows an appropriate error

### Danger zone - Delete all data
- [ ] Button visible with red/warning styling
- [ ] Confirm step appears before any deletion
- [ ] Cancel works without deleting
- [ ] After confirm: all indexed data deleted **and** all tools disconnected
- [ ] Navigating to /connect shows all tools as "Not connected"
- [ ] Reconnecting after full delete → full re-sync from scratch

### Sign out
- [ ] Sign out link visible, works correctly

---

## 4. Ask page (`/ask`)

### Empty states
- [ ] No tools connected: message visible, input still accessible and usable
- [ ] Sending a question with no tools → AI responds helpfully, mentions what connecting would unlock, gives `/connect` link
- [ ] Tools connected but nothing indexed: input usable, AI explains data not ready yet

### Core chat
- [ ] Suggestion chips show on empty state, clicking one fills input
- [ ] Sending a message shows loading state
- [ ] Response streams in progressively (not all at once)
- [ ] Markdown renders: **bold**, bullets, headers
- [ ] Source citations appear below response ([E1], [D2], [A1])
- [ ] Conversation history persists across turns in the same session

### Gmail queries
- [ ] "What are my last 5 emails?" returns inbox/sent only (not label noise)
- [ ] "Emails from [person]?" filters by sender correctly
- [ ] "Any emails about [topic]?" returns semantically relevant results
- [ ] Results from non-inbox folders: AI flags the folder, offers to search inbox
- [ ] "Summarize my conversation with [person]" uses pre-computed summaries

### Drive queries
- [ ] "What files do I have in Drive?" lists indexed files
- [ ] "What's in [doc name]?" fetches and returns file content

### Asana queries
- [ ] "What are my overdue tasks?" calls **live Asana API** (not just indexed snippets)
- [ ] AI never says "I only have X tasks indexed" when Asana is connected (**was BUG-004**)
- [ ] "Tasks assigned to [person]" filters correctly
- [ ] "Tasks due this week" returns correct results

### Partial tools state
- [ ] Only Gmail connected → Asana/Drive questions: AI explains gap in one sentence, answers what it can

### Mobile chat
- [ ] Input pinned to bottom of screen
- [ ] Tapping input does **not** zoom on iPhone (**was BUG-001**)
- [ ] Keyboard appears, input stays visible above keyboard
- [ ] Long responses scroll correctly
- [ ] Hamburger opens nav menu

---

## 5. AI Query Engine - Edge Cases

This section tests the 4-level query strategy and tool-awareness system end to end.
Run each test and note the AI's actual behavior in the findings log.

### 5A. Tool detection (Step 1)

These verify the AI knows exactly what it has access to before answering.

| Setup | Question | Expected behavior |
|-------|----------|-------------------|
| No tools connected | "What are my emails?" | Explains Gmail not connected, offers to be useful anyway, gives /connect link |
| No tools connected | "Any overdue tasks?" | Explains Asana not connected, describes what it could do once connected |
| No tools connected | "Who am I meeting tomorrow?" | Helpful general response, notes no calendar connected |
| Only Gmail | "What tasks are overdue?" | "Asana isn't connected — once connected I can check live. Here's what I found in your emails..." |
| Only Asana | "What are my last 5 emails?" | "Gmail isn't connected — I can't search emails yet. Here's what I can tell you from Asana..." |
| Only Drive | "Summarize my emails from John" | Explains Gmail not connected, does not attempt a Gmail search |
| Gmail + Asana, no Drive | "What's in my project brief doc?" | "Drive isn't connected — I can't read files yet..." |
| All connected | Any question | Answers from correct source, no "not connected" apology |

**Key failure modes to catch:**
- [ ] AI attempts to search Gmail when Gmail is not connected (hallucination)
- [ ] AI says "I don't have access to anything" when at least one tool IS connected
- [ ] AI ignores connected tools and only answers generically

### 5B. Level 1 - Metadata only (no tool call needed)

These should be answered from the pre-loaded CONTEXT block. The AI must NOT call any tool.

- [ ] "How many emails do I have?" → answers from COUNT RESULT, no tool call
- [ ] "Who sent me the most emails?" → answers from sender metadata
- [ ] "List my last 5 emails" → subject + sender + date from DB, no tool call
- [ ] "Did I get any emails today?" → filters by date, answers directly
- [ ] "How many Asana tasks do I have?" → count from indexed data
- [ ] "What Drive files have been synced?" → list from DB metadata

**Pass criteria:** Response arrives quickly, no `[calling tool...]` indicator, answer is specific with names/dates.

### 5C. Level 2 - Hybrid search snippets (no tool call needed)

Semantic questions answered from the search results already in context.

- [ ] "Any emails about invoices?" → returns relevant snippets, no tool call
- [ ] "What's the status of the Acme project?" → searches across emails + Asana
- [ ] "Did anyone mention the deadline?" → semantic match, not exact keyword
- [ ] "Emails where someone asked me for something" → intent-based retrieval

**Pass criteria:** Answer cites specific emails/tasks by reference ([E1], [A2]). No tool call made unless snippets genuinely insufficient.

### 5D. Level 3 - Pre-computed summaries (get_email_details tool)

Should trigger when snippets exist but aren't enough to answer the full question.

- [ ] "Summarize my thread with [person you emailed]" → calls `get_email_details`, returns summary
- [ ] "What was decided in the conversation about [topic]?" → escalates to summaries
- [ ] Email with `(no summary yet)` in summary → AI notes this and either fetches body (Level 4) or explains

**Pass criteria:** AI calls `get_email_details`, response includes substantive summary not just subject line.

### 5E. Level 4a - Raw email body (get_email_body tool)

Should only trigger when the user needs exact text or summary is "(no summary yet)".

- [ ] "Quote exactly what John said about the deadline" → fetches raw body, quotes it
- [ ] "What was the exact wording of the contract clause?" → raw body fetch
- [ ] "Summarize this email" when summary is "(no summary yet)" → falls back to body fetch
- [ ] Simple "summarize" question with existing summary → does NOT call get_email_body (Level 3 is enough)

**Pass criteria:** AI calls `get_email_body` only when necessary. Never calls it for questions a summary would answer.

### 5F. Level 4b - Live Asana API (get_asana_tasks tool)

This is the most important level to verify - was completely broken before.

- [ ] "What are my overdue tasks?" → calls `get_asana_tasks`, returns real live list
- [ ] "Tasks assigned to [name]?" → filters by assignee in live API call
- [ ] "What's due this week?" → filters by due date
- [ ] "Show me all open tasks in [project name]" → filters by project
- [ ] "How many tasks do I have total?" → live count, not "I only have X indexed"
- [ ] AI never says "I only have X of your Y tasks" when Asana is connected
- [ ] AI never says "you need to index more data" when Asana is connected
- [ ] No Asana tasks exist (empty workspace) → "No tasks found" not a crash

**Pass criteria:** Live data, not indexed snippets. Task count matches what you see in Asana.

### 5F. Level 4c - Drive file content (get_drive_file_content tool)

- [ ] "What are the exact numbers in the [spreadsheet name]?" → fetches file content
- [ ] "Full text of the [doc name] brief" → fetches and returns content
- [ ] Drive snippet already answers the question → does NOT call get_drive_file_content

### 5G. Multi-source questions

- [ ] "Any emails about the Acme project AND what tasks are open for it?" → uses Gmail search + Asana live query in same response
- [ ] "Summarize what's happening with [client]" → pulls from all connected sources
- [ ] "Did we discuss [topic] in email or in Asana?" → checks both, synthesizes answer

### 5H. Failure and empty result cases

These test graceful degradation.

- [ ] Ask about emails from someone who doesn't exist → "No emails found from [name]" not a hallucination
- [ ] Ask for exact quote from email that has no body (deleted or inaccessible) → graceful error, not crash
- [ ] Ask Asana question when token is expired → error message, not crash or silent failure
- [ ] Ask Drive question when token expired → same
- [ ] Very long Asana task list (100+ tasks) → response handles it, doesn't time out
- [ ] Question that genuinely has no answer → AI says so clearly, doesn't make something up

### 5I. Conversation continuity

- [ ] Ask "What are my emails from John?" → follow up "And what tasks mention him?" → second answer uses correct context
- [ ] Ask about an email → follow up "Summarize that thread" → AI fetches summary of the right thread
- [ ] Refer to "that project" from a previous message → AI resolves the reference correctly
- [ ] 4+ turns of conversation → history doesn't degrade answer quality

### 5J. iPhone-specific
- [ ] Input does not zoom on focus (16px fix)
- [ ] Long response (50+ lines) scrolls without layout breaking
- [ ] Tapping a source citation opens correctly on mobile

---

## 6. Security and data audit

Run these checks in Supabase SQL editor and the browser. This section verifies that the privacy policy accurately describes what the product actually does.

### 6A. Row-Level Security (RLS)

These are the most important checks. A failure here means data leakage.

- [ ] **Anon role reads 0 rows on every table** - run in Supabase SQL editor as anon role:
  ```sql
  SELECT COUNT(*) FROM messages;        -- must be 0
  SELECT COUNT(*) FROM embeddings;      -- must be 0
  SELECT COUNT(*) FROM drive_files;     -- must be 0
  SELECT COUNT(*) FROM asana_items;     -- must be 0
  SELECT COUNT(*) FROM oauth_tokens;    -- must be 0
  SELECT COUNT(*) FROM webhook_secrets; -- must be 0
  SELECT COUNT(*) FROM sync_state;      -- must be 0
  ```
- [ ] **User A cannot read User B's data** - log in as two different users in the same workspace, verify neither can see the other's emails/tasks via the app
- [ ] **`oauth_tokens` has no user SELECT policy** - tokens only readable by service_role (server-side), not from the browser
- [ ] **`webhook_secrets` has no user SELECT policy** - same as above
- [ ] **Direct API call without session returns 401** - `curl -X POST https://app.gerendo.com/api/ask -d '{"query":"test"}'` must return 401

### 6B. What is actually stored (verify against privacy policy)

Run in Supabase SQL editor to confirm what data exists:

```sql
-- Check messages table: should have subject, sender, mailbox - NO body
SELECT subject, sender, mailbox, synced_at FROM messages LIMIT 5;

-- Check embeddings: keyword_text contains subject + sender + body start (~1500 chars)
SELECT LEFT(keyword_text, 200) FROM embeddings LIMIT 3;

-- Check drive_embeddings: contains file text chunks
SELECT LEFT(keyword_text, 200) FROM drive_embeddings LIMIT 3;

-- Check asana_items: task metadata only (no full description beyond notes field)
SELECT name, project_name, assignee, status, due_date FROM asana_items LIMIT 5;

-- Check oauth_tokens: access_token is plaintext (known risk - protected by RLS + service_role only)
SELECT provider, expires_at FROM oauth_tokens LIMIT 5; -- do NOT expose access_token in audit log
```

- [ ] `messages` table has NO column called `body` - only `subject`, `sender`, `mailbox`, `received_at`
- [ ] `keyword_text` in `embeddings` contains only subject + sender + first ~1500 chars of body (not full body)
- [ ] `oauth_tokens` access_token is plaintext but NOT readable via anon or authenticated browser role
- [ ] No table stores full email body, full Drive file content, or passwords

### 6C. Encryption

- [ ] **In transit** - app only accessible over HTTPS (`https://app.gerendo.com`, HTTP redirects to HTTPS)
- [ ] **At rest** - Supabase AES-256 by default. Verify in Supabase dashboard: Settings → Infrastructure → Encryption at rest is enabled
- [ ] **OAuth tokens** - stored as plaintext in `oauth_tokens` table (known accepted risk; protected by RLS + service_role-only access). Not application-level encrypted.
- [ ] **Webhook secrets** - stored as plaintext in `webhook_secrets` table (same risk profile as OAuth tokens)

### 6D. OAuth scope audit

Verify we only request the minimum permissions needed:

- [ ] **Gmail scope** - app requests `https://mail.google.com/` (read) only, not modify/send/delete. Confirm in Google Cloud Console → OAuth consent screen → Scopes.
- [ ] **Drive scope** - app requests `https://www.googleapis.com/auth/drive.readonly` only
- [ ] **Asana scope** - app requests `default` scope (read tasks/projects). Creating tasks requires write scope - verify this is included if task creation is enabled.
- [ ] No scope grants access to Google Calendar, Contacts, or other Google services

### 6E. Webhook security

- [ ] **Gmail webhook** - verifies JWT from Google Pub/Sub before processing. Token audience must match `PUBSUB_AUDIENCE` env var (service account email). Invalid JWTs return 401.
- [ ] **Asana webhook** - verifies HMAC-SHA256 signature using stored secret. Invalid signatures return 401. Handshake phase echoes `X-Hook-Secret` header back correctly.
- [ ] **Cron routes** - require `CRON_SECRET` bearer token. Unauthenticated cron calls return 401.

### 6F. Privacy page accuracy

Verify that [/privacy](https://app.gerendo.com/privacy) accurately reflects the product:

- [ ] "Full email body is never stored" - confirmed by 6B (no `body` column in `messages`)
- [ ] "First ~1500 chars of body" - confirmed by checking `keyword_text` in 6B
- [ ] "OAuth tokens stored in database" - confirmed by 6C (honest about the risk)
- [ ] "Data encrypted at rest (AES-256)" - confirmed by Supabase dashboard check
- [ ] "Delete all data" button in Settings works as described
- [ ] Privacy page accessible without login at `/privacy`
- [ ] Privacy link appears in user menu dropdown on all app pages

### 6G. Per-user quota

- [ ] Monthly question limit enforced (default 500/month)
- [ ] Hitting the limit shows a clear message with the reset date (not a generic error)
- [ ] Quota resets on the 1st of each month (new `quota:ask:YYYY-MM` key in sync_state)
- [ ] Check current usage:
  ```sql
  SELECT user_id, source, cursor::int as questions_used
  FROM sync_state WHERE source LIKE 'quota:ask:%'
  ORDER BY cursor::int DESC;
  ```

---

## 8. Real-time sync and automated data fetching

### 8A. Webhook registration - on connect

Verify webhooks register immediately when user connects a tool (not waiting for cron).

- [ ] **Drive**: connect Google Drive → check `webhook_secrets` table within 10 seconds:
  ```sql
  SELECT provider, key, secret, meta FROM webhook_secrets WHERE provider = 'drive';
  -- must have a row with key='channel', secret=<uuid>, meta.resourceId present
  ```
- [ ] **Asana**: connect Asana → check `webhook_secrets` table within 10 seconds:
  ```sql
  SELECT provider, key, meta FROM webhook_secrets WHERE provider = 'asana';
  -- must have one row per Asana workspace the user belongs to
  ```
- [ ] **Gmail**: connect Gmail → check Vercel logs for `[gmail/register] watch registered` within 10 seconds
- [ ] Disconnecting a tool and reconnecting re-registers webhooks correctly (no duplicate rows in `webhook_secrets`)

### 8B. Gmail real-time sync

- [ ] Send yourself an email from an external account → appears in `/ask` query results within 60 seconds
- [ ] Verify sync happened via webhook (not cron): check `sync_state` for `source = 'gmail:webhook_lock'` row updated within 60 seconds of sending
- [ ] Vercel logs show `POST /api/webhooks/gmail` returning **200** (not 4xx/5xx)
- [ ] Rapid burst: send 5 emails in 10 seconds → only 1-2 sync calls fired (30s debounce working)
- [ ] Check no rate-limit errors in Vercel logs after burst
- [ ] Gmail watch channel renews without error: check `sync_state` for `source = 'gmail:watch_expiry'` row exists
  ```sql
  SELECT source, cursor, last_synced_at FROM sync_state WHERE source LIKE 'gmail%';
  ```

### 8C. Google Drive real-time sync

- [ ] Create a new Google Doc in Drive → appears in `/ask` query results within 90 seconds
- [ ] Edit an existing indexed doc → changes reflected in next query (incremental sync)
- [ ] Verify push channel is registered:
  ```sql
  SELECT key, secret, meta->>'expiration' as expires, meta->>'registeredAt' as registered
  FROM webhook_secrets WHERE provider = 'drive';
  -- expiration should be ~6 days from now
  ```
- [ ] Vercel logs show `POST /api/webhooks/drive` returning **200** after file change
- [ ] Check `sync_state` for changes cursor advancing after webhook fires:
  ```sql
  SELECT source, cursor FROM sync_state WHERE source = 'drive:changes_page_token';
  -- cursor should update after each incremental sync
  ```
- [ ] Drive channel expiry: `meta.expiration` timestamp is ~6 days from registration (not 7, not expired)
- [ ] No duplicate Drive webhook channels registered (only one row per workspace/user in `webhook_secrets`)

### 8D. Asana real-time sync

- [ ] Create a task in Asana → appears in `/ask` query results within 30 seconds
- [ ] Update a task's title → change reflected in next query
- [ ] Complete a task → shows as "Completed" in query results
- [ ] Assign a task to a different person → assignee updated in results
- [ ] Verify webhook handshake succeeded (no handshake = webhook silently inactive):
  ```sql
  SELECT provider, key, meta FROM webhook_secrets WHERE provider = 'asana';
  -- key = asana workspace GID, meta should have webhookGid from Asana
  ```
- [ ] Vercel logs show `POST /api/webhooks/asana` returning **200** after task change
- [ ] Bulk task move (move 10 tasks to a different project) → only 1 sync fires per 15s debounce window (not 10 separate syncs)
- [ ] Multiple Asana workspaces: each workspace gets its own webhook row, debounce scoped per workspace

### 8E. Cron safety net (daily fallback)

These verify the cron runs correctly as a fallback if webhooks miss anything.

- [ ] Check cron schedule is registered in Vercel dashboard under Settings → Crons:
  - `0 0 * * *` → `/api/cron/sync?source=drive`
  - `0 5 * * *` → `/api/cron/sync?source=drive-channel-renew`
  - `0 6 * * *` → `/api/cron/sync?source=gmail-watch-renew`
  - `0 7 * * *` → `/api/cron/sync?source=asana-webhook-register`
- [ ] Trigger cron manually (requires `CRON_SECRET`):
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" \
    "https://app.gerendo.com/api/cron/sync?source=drive"
  # should return { ok: true, results: [...] }
  ```
- [ ] `drive-channel-renew` cron stops old channel and registers a new one (check `webhook_secrets.meta.registeredAt` advances)
- [ ] `asana-webhook-register` cron skips workspaces that already have a registered webhook (`status: already_registered` in response)
- [ ] `gmail-watch-renew` cron renews Gmail push subscriptions without error

### 8F. Sync data quality

Verify data fetched is correct and complete, not stale or partial.

- [ ] **Gmail**: after initial sync, query "emails from [your own address]" → returns actual emails, correct senders and subjects
- [ ] **Gmail**: query "emails from last week" → date filtering works, no emails from 6 months ago in results
- [ ] **Drive**: query "what files do I have?" → lists actual files from Drive, not phantom entries
- [ ] **Drive**: query about a specific doc → returns content from current version (not a stale cached version)
- [ ] **Asana**: query "what are my open tasks?" → count matches what you see in Asana UI
- [ ] **Asana**: query "tasks due this week" → only tasks with due dates in current week
- [ ] No duplicate entries after incremental sync (same email/task indexed twice):
  ```sql
  SELECT external_id, COUNT(*) FROM messages GROUP BY external_id HAVING COUNT(*) > 1;
  SELECT external_id, COUNT(*) FROM drive_files GROUP BY external_id HAVING COUNT(*) > 1;
  SELECT external_id, COUNT(*) FROM asana_items GROUP BY external_id HAVING COUNT(*) > 1;
  -- all three should return 0 rows
  ```
- [ ] Orphaned embeddings (no parent row) = 0:
  ```sql
  SELECT COUNT(*) FROM embeddings e LEFT JOIN messages m ON e.message_id = m.id WHERE m.id IS NULL;
  -- must be 0
  ```

### 8G. Disconnect and reconnect

- [ ] Disconnect Drive → `webhook_secrets` row for `provider=drive` deleted
- [ ] Reconnect Drive → new webhook channel registered, sync resumes
- [ ] Disconnect Asana → `webhook_secrets` rows for `provider=asana` deleted
- [ ] Reconnect Asana → webhooks re-registered for all Asana workspaces
- [ ] Disconnect Gmail → Gmail watch channel stopped (check Vercel logs for stop call)
- [ ] After "Delete all data" in Settings → `webhook_secrets` table has 0 rows for that workspace:
  ```sql
  SELECT COUNT(*) FROM webhook_secrets WHERE workspace_id = '<your-workspace-id>';
  -- must be 0
  ```

---

## 9. Mobile UX (test on real iPhone + Android)

- [ ] No horizontal overflow on any page
- [ ] All buttons have pointer cursor on hover (**was BUG-006**)
- [ ] Tap targets comfortable (buttons easy to tap)
- [ ] Input fields do not zoom on focus (**was BUG-001**)
- [ ] Hamburger on `/ask`: opens, all links work
- [ ] Hamburger on `/connect`: opens, all links work including Settings
- [ ] Tool cards: "Not connected" on one line (**was BUG-010**)
- [ ] Category chips: single scrollable row on mobile (**was BUG-010**)
- [ ] Label picker modal usable on small screen
- [ ] Disconnect confirm panel readable on small screen

---

## 10. Security (legacy - superseded by section 6)

- [ ] User A cannot read User B's data (even in same workspace)
- [ ] Supabase Table Editor with `anon` role → 0 rows on all tables
- [ ] `oauth_tokens` not readable from browser (no anon/user SELECT policy)
- [ ] `webhook_secrets` not readable from browser
- [ ] Direct API call to `/api/ask` without session → 401
- [ ] Gmail webhook rejects requests without valid JWT
- [ ] Asana webhook rejects requests without valid HMAC signature

---

## 11. Known bugs status

| Bug | Area | Fixed? | How to verify |
|-----|------|--------|---------------|
| BUG-001 iPhone zoom on input | Mobile | ✅ Fixed | Tap input on iPhone, no zoom |
| BUG-002 Chat blocked without all tools | Chat | ✅ Fixed | Connect only Gmail, still ask |
| BUG-003 Invite link base64url crash | Settings | ✅ Fixed | Generate link, no error |
| BUG-004 AI claims limited Asana data | Chat | ✅ Fixed | Ask overdue tasks, gets live data |
| BUG-005 No logout from most pages | Navigation | ✅ Fixed | Log out visible everywhere |
| BUG-006 No cursor pointer | CSS | ✅ Fixed | Hover any button on desktop |
| BUG-007 Asana OAuth redirect_uri | Connect | ✅ Fixed | OAuth completes, webhook registers on connect |
| BUG-008 Sync progress disappears | Connect | ⚠️ Improved | Messages correct, no fake bar |
| BUG-009 Mobile header cramped | Mobile | ✅ Fixed | Hamburger on mobile |
| BUG-010 Mobile connect layout | Mobile | ✅ Fixed | Status one line, chips scroll |

---

## 12. Debugging reference

### Sync stuck or not running
```sql
SELECT id, status, total_synced, label_progress, started_at, finished_at
FROM sync_jobs ORDER BY started_at DESC LIMIT 5;

-- Fix permission errors (if total_synced stuck at 0)
GRANT ALL ON sync_jobs TO service_role;
GRANT ALL ON sync_state TO service_role;
```

### Check for duplicates
```sql
SELECT external_id, COUNT(*) FROM messages GROUP BY external_id HAVING COUNT(*) > 1;
SELECT external_id, COUNT(*) FROM drive_files GROUP BY external_id HAVING COUNT(*) > 1;
SELECT external_id, COUNT(*) FROM asana_items GROUP BY external_id HAVING COUNT(*) > 1;
-- Orphaned embeddings (no parent message)
SELECT COUNT(*) FROM embeddings e LEFT JOIN messages m ON e.message_id = m.id WHERE m.id IS NULL;
```

### Verify RLS is working
```sql
-- Run as anon role - should always return 0
SELECT COUNT(*) FROM messages;
SELECT COUNT(*) FROM embeddings;
SELECT COUNT(*) FROM oauth_tokens;
```

### Webhook health
```sql
SELECT provider, key, meta FROM webhook_secrets;
SELECT source, last_synced_at FROM sync_state WHERE source LIKE 'gmail%';
```

---

## 10. Findings log

| # | Page | Severity | Description | Steps to repro | Fixed? |
|---|------|----------|-------------|----------------|--------|
| | | | | | |

**Severity:** P0 crash · P1 major block · P2 noticeable issue · P3 cosmetic
