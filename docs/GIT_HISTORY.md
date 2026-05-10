## 6766a9c - fix: user menu always shows branded amber initials, ignores Google avatar

**Author:** Tocki28  
**Date:** 2026-05-10 08:48


---
## 896a779 - feat: UserMenu avatar dropdown, /privacy page, security audit QA section

**Author:** Tocki28  
**Date:** 2026-05-10 08:42

- UserMenu component: avatar/initials circle in header, dropdown shows user
  email, nav links (Ask, Connect, Settings), Privacy policy (external link),
  Log out. Closes on outside click. Replaces the cramped button row + hamburger.
- /privacy page: accurate Q&A covering what data is stored, where, encryption,
  OAuth scopes, third-party processors, deletion rights, incident response.
  Content matches actual DB schema (acknowledges keyword_text, plaintext tokens).
  Publicly accessible without login.
- QA checklist section 6: security and data audit with Supabase SQL queries,
  RLS verification, encryption checks, OAuth scope audit, webhook security,
  privacy page accuracy check, per-user quota verification.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## dc21fb7 - feat: per-user monthly question quota with clear limit-reached message

**Author:** Tocki28  
**Date:** 2026-05-10 08:34

- checkAndIncrementQuota() in agency-db: reads/increments quota:ask:YYYY-MM
  key in sync_state, returns allowed/used/limit; resets automatically each month
- /api/ask: checks quota before doing any AI work, returns 429 with
  { error: 'monthly_limit_reached', used, limit } when exhausted
- Ask page: handles 429 with human-readable message showing the limit and
  reset date, instead of a generic error
- Limit configurable via USER_MONTHLY_QUESTION_LIMIT env var (default: 500)
- No schema changes - uses existing sync_state table

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 726b7cd - feat: create Asana tasks from emails and Drive files via chat

**Author:** Tocki28  
**Date:** 2026-05-10 08:14

- Add asanaPost() helper to agency-db.ts
- Add create_asana_task tool: name, notes, project_name, assignee, due_on
  - Resolves project name to GID by fuzzy-matching against user's projects
  - Resolves assignee by name or 'me' keyword
  - Returns task name + permalink URL on success
- Tool is only offered when Asana is connected
- System prompt teaches Claude to extract task details from email/Drive context
  already in scope without asking the user to repeat information
- Today's date injected into prompt for relative date resolution ("by Friday")
- Connected tools description updated to mention task creation capability

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 1d656bc - docs: add comprehensive AI query engine edge case tests to QA checklist

**Author:** Tocki28  
**Date:** 2026-05-10 08:09


---
## 3d845d2 - docs: overhaul QA checklist - current flows, bug status, debugging SQL

**Author:** Tocki28  
**Date:** 2026-05-10 08:07


---
## 2c3e9e5 - fix: delete-data also disconnects tools; add Settings to connect page nav

**Author:** Tocki28  
**Date:** 2026-05-10 07:48

- /api/workspace/delete-data now removes OAuth tokens alongside indexed data -
  no more half-connected state where tools auto-re-sync immediately after delete
- Update Settings description to accurately say tools are disconnected
- Add Settings link to connect page header (desktop nav + hamburger dropdown)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 3b8491e - fix: separate stop/disconnect/delete-data into distinct operations

**Author:** Tocki28  
**Date:** 2026-05-09 21:31

- Stop button (sync banner): only cancels the running job, tool stays
  connected, all indexed data is preserved, cursor intact
- Disconnect button (tool card): only removes OAuth token, data stays in DB,
  cursor stays - reconnecting does an incremental sync, not a full re-index
- New POST /api/workspace/delete-data: actually deletes indexed data per tool
  or all tools; clears sync cursors so next sync re-indexes from scratch;
  OAuth tokens are preserved (tools stay connected)
- Settings page: new Danger Zone section with 'Delete all indexed data' button
  behind a confirm step

Previously Stop and Disconnect both called /api/sync/disconnect which wiped
all data and cursors, making every reconnect a full re-index.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 27c267a - fix: rename Stop to Disconnect on connected tool card - clarifies data is deleted

**Author:** Tocki28  
**Date:** 2026-05-09 21:27


---
## df1f76c - fix: mobile UX - hamburger menu, category scroll, tool card layout, sync banner

**Author:** Tocki28  
**Date:** 2026-05-09 21:12

- Ask + connect pages: hamburger menu on mobile (hidden sm:flex / flex sm:hidden)
  replaces cramped 3-button header row; dropdown shows full nav links
- Category chips: overflow-x-auto flex-nowrap on mobile so they scroll
  horizontally instead of wrapping into 3 rows
- Tool cards: whitespace-nowrap + flex-shrink-0 on status text so 'Not connected'
  stays on one line; min-w-0 on left side so icon+name shrinks first
- Sync progress banner: correct text per tool (emails / Drive files / Asana tasks)
  instead of always saying 'Importing emails'; progress bar only for Gmail
  (Drive/Asana have no streaming progress endpoint)
- Load Drive/Asana indexed counts from /api/workspace/info on page load so
  'X indexed - auto-syncing' shows correctly after page refresh

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## cfeabf8 - feat: lock in always-helpful behavior for no-tools and partial-tools states

**Author:** Tocki28  
**Date:** 2026-05-09 20:56

Add explicit system prompt section with concrete rules:
- No tools: answer general questions + show specific value of each integration,
  never refuse to engage
- Partial tools: answer from what's connected, one-sentence gap mention
- All tools: answer directly, no preamble

Previously this relied on Claude inferring behavior from a one-liner.
Now it's deterministic regardless of model version.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## a18c748 - fix: Asana webhook key alignment - use asana_ws GID for per-workspace deduplication

**Author:** Tocki28  
**Date:** 2026-05-09 20:43

- Pass asana_ws=<gid> in webhook target URL at registration time
- Handshake handler now stores key=asanaWsKey (from URL param, falls back to 'default')
  instead of always storing key='default'
- HMAC verification looks up secret by asanaWsKey to match
- Deduplication in register route now correctly finds existing rows by workspace GID
- Supports multiple Asana workspaces per user independently

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 3494f43 - fix: cursor pointer, iPhone zoom, invite token generation, logout accessibility

**Author:** Tocki28  
**Date:** 2026-05-09 20:41

BUG-006: add cursor-pointer globally to button/a/[role=button] in globals.css
BUG-001: set font-size min 16px on inputs to prevent iOS Safari zoom on focus
BUG-003: generate invite token in app code (crypto.getRandomValues hex) instead
  of relying on Postgres base64url encoding which is not supported
BUG-005: add Log out link to ask and connect page headers so users can log out
  from anywhere without navigating to Settings first

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 79fb861 - fix: debounce Gmail webhook and limit to INBOX+SENT to stop rate limit storm

**Author:** Tocki28  
**Date:** 2026-05-09 20:39

- Add 30s debounce on webhook handler via sync_state gmail:webhook_lock key
  so rapid Pub/Sub retries and duplicate notifications are dropped immediately
- Webhook-triggered syncs now only process INBOX and SENT (2 API calls) instead
  of all 9 system labels + user labels (was 9+ calls per webhook hit)
- Add labelsOnly option to runGmailSyncForUser for webhook vs full sync distinction
- Daily cron continues to sync all labels unaffected

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 6e312fc - feat: add live Asana tool + email body fetch to ask route, track known bugs

**Author:** Tocki28  
**Date:** 2026-05-09 20:38

- Split tool definitions into named consts (EMAIL_DETAIL_TOOL, EMAIL_BODY_TOOL, DRIVE_CONTENT_TOOL, LIST_DRIVE_TOOL, ASANA_TASKS_TOOL)
- Add get_email_body tool: fetches full Gmail message live when summaries are insufficient
- Add get_asana_tasks tool: queries Asana API live for real-time task data (fixes BUG-004)
- Import getAsanaToken + asanaGet from agency-db for live Asana queries
- Add docs/BUGS.md with tracked open bugs

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 70c2f0b - fix: return 401 for unauthenticated API routes instead of redirecting to /login

**Author:** Tocki28  
**Date:** 2026-05-09 19:05

Redirecting POST /api/* to /login causes 405 since login page only accepts GET.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 767fa4f - fix: allow workspace context build route through middleware - called internally by sync worker

**Author:** Tocki28  
**Date:** 2026-05-09 19:03


---
## 0eaa769 - fix: check cancellation inside batch loop not just between labels

**Author:** Tocki28  
**Date:** 2026-05-09 19:01


---
## 2d3ca58 - fix: correct Pub/Sub JWT verification - audience is service account email via tokeninfo endpoint

**Author:** Tocki28  
**Date:** 2026-05-09 18:59

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 7b67d68 - fix: allow webhook and cron routes through middleware without auth session

**Author:** Tocki28  
**Date:** 2026-05-09 18:53

Gmail Pub/Sub and Asana webhooks have no session cookie - middleware
was redirecting them to /login with 307. Cron jobs same issue.
These routes do their own auth via JWT verification and CRON_SECRET.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 63f1066 - fix: add error logging to gmail stream sync to debug stuck jobs

**Author:** Tocki28  
**Date:** 2026-05-09 18:52


---
## 9ecd69c - docs: add QA checklist with debugging guide for sync issues

**Author:** Tocki28  
**Date:** 2026-05-09 18:48


---
## dade7df - fix: stamp user_id on all embedding writes - required after RLS migration

**Author:** Tocki28  
**Date:** 2026-05-09 18:45

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## aa2b107 - fix: replace tiny text links with proper button styling in headers

**Author:** Tocki28  
**Date:** 2026-05-09 17:25


---
## 5a76940 - fix: Stop button fully disconnects Gmail including webhook, not just batch job

**Author:** Tocki28  
**Date:** 2026-05-09 17:21


---
## 3c73bd7 - fix: rename Stop sync to Stop import - clarifies it stops bulk import not the webhook

**Author:** Tocki28  
**Date:** 2026-05-09 17:18


---
## ad81402 - fix: show percentage on sync banner, remove starting... text, smooth progress bar

**Author:** Tocki28  
**Date:** 2026-05-09 17:15


---
## adaec98 - fix: ask page checks actual DB item counts not just gmail sync job

**Author:** Tocki28  
**Date:** 2026-05-09 17:14

Any connected tool with indexed data now unlocks the ask UI.
Previously only gmail sync jobs were counted, blocking users with
only Drive or Asana connected.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 598e6ea - fix: correct Material Icons names for Gmail labels

**Author:** Tocki28  
**Date:** 2026-05-09 17:12


---
## e621074 - fix: reset gmail status to active when label picker is cancelled

**Author:** Tocki28  
**Date:** 2026-05-09 17:09


---
## edd454f - feat: show all Gmail labels with Material Icons in label picker

**Author:** Tocki28  
**Date:** 2026-05-09 17:08

- Include all labels (Starred, Snoozed, Drafts, Purchases, custom labels etc.)
- Only exclude UNREAD and CHAT (true internals)
- Each label shows its Gmail icon (inbox, send, star, draft, etc.)
- User labels tagged as 'label', system labels shown first

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 56e1b90 - feat: inline branded confirm panel instead of browser alert, red stop button styling

**Author:** Tocki28  
**Date:** 2026-05-09 17:04

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 45456b9 - feat: per-tool Stop button - disconnects tool and removes all indexed data

**Author:** Tocki28  
**Date:** 2026-05-09 16:59

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 3d4c547 - feat: stop sync button - cancels running job, stops loop between label batches

**Author:** Tocki28  
**Date:** 2026-05-09 16:55

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 7f10d7b - feat: Gmail label picker modal before first sync

**Author:** Tocki28  
**Date:** 2026-05-09 16:51

- New /api/sync/gmail/labels endpoint fetches user's labels, excludes noise (spam/trash/promotions)
- Connect page shows modal after Gmail OAuth with checkboxes for each label
- Inbox and sent pre-selected by default
- Stream sync accepts ?labels=INBOX,SENT,... param to sync only chosen labels

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 4af192b - fix: only sync inbox+sent on first sync, skip promotions/social/updates

**Author:** Tocki28  
**Date:** 2026-05-09 16:49

Reduces first-time sync from 20+ labels to 2, cuts sync time dramatically.
Also fixes localhost hardcode in context rebuild call.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 3039644 - fix: dismiss stuck sync banner, treat jobs running >30min as done

**Author:** Tocki28  
**Date:** 2026-05-09 16:47

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 01b8e59 - feat: redesign connect page for auto-sync model

**Author:** Tocki28  
**Date:** 2026-05-09 16:44

- Remove manual Sync now button - tools show Active/auto-syncing once connected
- First-time sync shows a progress banner that disappears when done
- No more stuck syncing state on page reload
- Connect button only shows for unconnected tools

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## af203f3 - feat: add Cloudflare Web Analytics to app.gerendo.com

**Author:** Tocki28  
**Date:** 2026-05-09 16:41


---
## dc0d0c2 - fix: log upsert error in gmail register route

**Author:** Tocki28  
**Date:** 2026-05-09 16:27


---
## 22f74f8 - fix: use listUsers to find user by email - getUserByEmail does not exist in this Supabase version

**Author:** Tocki28  
**Date:** 2026-05-09 16:08


---
## f5e833d - fix: cron to once per day - Hobby plan limitation

**Author:** Tocki28  
**Date:** 2026-05-09 16:05


---
## 5f6bd68 - feat: trigger Drive sync on every Gmail webhook event

**Author:** Tocki28  
**Date:** 2026-05-09 16:02

Piggybacks Drive sync onto Gmail push notifications so new Meet
transcription files are indexed in near-real-time without needing
a frequent cron job on the Hobby plan.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 6b9d233 - fix: cron schedules to once/day for Vercel Hobby plan

**Author:** Tocki28  
**Date:** 2026-05-09 15:53


---
## 154e1eb - chore: trigger Vercel redeploy

**Author:** Tocki28  
**Date:** 2026-05-09 15:49


---
## 3a06c14 - fix: remove redundant Gmail + Asana cron jobs - webhooks handle real-time updates

**Author:** Tocki28  
**Date:** 2026-05-09 14:53

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## b83525e - feat: automated indexing - cron + Gmail Pub/Sub webhooks + Asana webhooks

**Author:** Tocki28  
**Date:** 2026-05-09 14:52

- vercel.json: cron every 15min Gmail, 10min Drive, 30min Asana, 6-day watch renewal
- /api/cron/sync: fan-out handler iterates all workspace members, calls sync per user
- /api/webhooks/gmail: Pub/Sub push receiver, verifies JWT, runs incremental sync
- /api/webhooks/gmail/register: registers Gmail watch (called post-OAuth + by cron)
- /api/webhooks/asana: handles handshake + HMAC-verified event delivery, syncs changed tasks
- /api/webhooks/asana/register: registers Asana webhook per workspace
- Extracted runGmailSyncForUser, runDriveSyncForUser, runAsanaSyncForUser as standalone exports
- Extracted syncSingleAsanaTask for targeted single-task resync from webhook events
- Moved getDriveToken + getAsanaToken to agency-db.ts alongside getGmailToken
- Connect page triggers webhook registration fire-and-forget after Gmail/Asana OAuth

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 0bd37c0 - docs: update git history

**Author:** Tocki28  
**Date:** 2026-05-09 14:29


---
## 4e672ef - fix: mobile layout, mailbox filter for recent emails, smarter label hints

**Author:** Tocki28  
**Date:** 2026-05-09 14:25

- Use h-dvh + min-h-0 so input bar stays pinned to bottom on mobile
- Constrain user message bubble to 85% width to prevent horizontal scroll
- Filter recent email queries to inbox+sent only (was returning all labels including F5Bot_Reddit)
- System prompt now tells Claude to flag off-inbox results and offer to refine

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## a117263 - Merge pull request #10 from Gerendo/feat/settings-team-view

**Author:** Gerendo  
**Date:** 2026-05-09 10:00

v0.2.0.1 feat: settings shows user, workspace, team members
---
## 9ecafe9 - feat: settings page shows current user, workspace name, team members with avatars

**Author:** Tocki28  
**Date:** 2026-05-09 10:00


---
## 0186fe6 - Merge pull request #9 from Gerendo/feat/multi-tenant-auth

**Author:** Gerendo  
**Date:** 2026-05-09 09:56

v0.2.0.0 feat: multi-tenant auth with invite links
---
## 1304ec4 - feat: multi-tenant auth - real session, invite links, settings page

**Author:** Tocki28  
**Date:** 2026-05-09 09:56

- requireWorkspace() replaces getOrCreateDefaultWorkspace() in all API routes
- middleware enforces auth on /ask, /connect, /settings
- /join page handles invite token acceptance
- /settings page generates shareable invite links (30 day expiry)
- /api/auth/signout route
- createWorkspaceForUser() on first login
- joinWorkspaceViaToken() for invite flow
- Settings link in ask header

---
## 98452f5 - Merge pull request #8 from Gerendo/fix/ask-ui-improvements

**Author:** Gerendo  
**Date:** 2026-05-09 09:34

v0.1.0.7 fix: logo navigation, sync progress bar, no double dash
---
## ee1cd99 - fix: clickable logo, single dash, progress bar with fill animation in sync banner

**Author:** Tocki28  
**Date:** 2026-05-09 09:34


---
## 8575675 - Merge pull request #7 from Gerendo/feat/supabase-multi-source-brain

**Author:** Gerendo  
**Date:** 2026-05-09 09:22

v0.1.0.6 fix: Gerendo favicon on app subdomain
---
## 0913bcf - fix: replace Vercel default favicon with Gerendo favicon

**Author:** Tocki28  
**Date:** 2026-05-09 09:22


---
## 48b6c7f - Merge pull request #6 from Gerendo/feat/supabase-multi-source-brain

**Author:** Gerendo  
**Date:** 2026-05-09 09:20

v0.1.0.5 feat: sync banner and completion toast
---
## b17bdb0 - feat: sync progress banner + completion toast on ask page

**Author:** Tocki28  
**Date:** 2026-05-09 09:20


---
## f404090 - Merge pull request #5 from Gerendo/feat/supabase-multi-source-brain

**Author:** Gerendo  
**Date:** 2026-05-09 09:19

v0.1.0.4 fix: non-blocking sync, gated ask input
---
## cf52a67 - fix: non-blocking sync with progress bar, ask input gated on indexed data

**Author:** Tocki28  
**Date:** 2026-05-09 09:19


---
## d62b3c9 - Merge pull request #4 from Gerendo/feat/supabase-multi-source-brain

**Author:** Gerendo  
**Date:** 2026-05-09 09:12

v0.1.0.3 feat: tool selector with categories and coming soon
---
## b587ca4 - feat: tool selector connect page with categories + coming soon, workspace-agnostic copy

**Author:** Tocki28  
**Date:** 2026-05-09 09:12


---
## 6f08944 - Merge pull request #3 from Gerendo/feat/supabase-multi-source-brain

**Author:** Gerendo  
**Date:** 2026-05-09 09:08

v0.1.0.2 feat: smart onboarding flow
---
## a10cb90 - feat: smart onboarding state in /ask - no tools, no data, ready

**Author:** Tocki28  
**Date:** 2026-05-09 09:08


---
## 231765d - Merge pull request #2 from Gerendo/feat/supabase-multi-source-brain

**Author:** Gerendo  
**Date:** 2026-05-09 09:04

v0.1.0.1 fix: redirect root to /ask
---
## 857f520 - feat: redirect root to /ask on app subdomain

**Author:** Tocki28  
**Date:** 2026-05-09 09:03


---
## 991494b - Merge pull request #1 from Gerendo/feat/supabase-multi-source-brain

**Author:** Gerendo  
**Date:** 2026-05-09 08:57

v0.1.0.0 feat: Supabase migration + Gmail, Drive, and Asana integration
---
## 39ac4c6 - fix: flat amber button with radius-xl, no gradient

**Author:** Tocki28  
**Date:** 2026-05-09 08:50


---
## 6144aa3 - fix: fire gradient pill button for Ask your agency brain

**Author:** Tocki28  
**Date:** 2026-05-09 08:47


---
## 3ec4c11 - fix: bigger title, rounder borders, cleaner send button in /ask

**Author:** Tocki28  
**Date:** 2026-05-09 08:45


---
## c9697d3 - feat: apply Gerendo design system to app pages

**Author:** Tocki28  
**Date:** 2026-05-09 08:42

Warm ink background, amber ember accent, Fraunces display font,
consistent with marketing site. Updated ask, connect, and login pages.

---
## 8ea6a38 - chore: bump version to 0.1.0.0 and add changelog

**Author:** Tocki28  
**Date:** 2026-05-09 08:35

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## f5b6f7b - feat: Supabase auth + Google OAuth login flow

**Author:** Tocki28  
**Date:** 2026-05-09 08:34

Add Supabase browser/server clients, middleware protecting all routes,
login page with Google OAuth, and auth callback that creates workspace
on first login.

---
## 3e2a68c - feat: full Gmail sync - paginate all messages, no limit

**Author:** Tocki28  
**Date:** 2026-05-05 06:49

- Remove 100 message cap, paginate through entire mailbox
- 5 minute timeout for sync route
- Progress logging per page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 67e7f15 - feat: multi-mailbox sync (inbox + sent), mailbox tag on messages, regex intent parsing

**Author:** Tocki28  
**Date:** 2026-05-05 06:30

- Add mailbox column to messages table (schema v3)
- Sync inbox and sent folders separately
- Replace Haiku intent parsing with fast regex (cheaper, more reliable)
- Show mailbox label on source citations in /ask UI

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 4ee75a3 - feat: remove preview storage, fetch full email bodies live at query time

**Author:** Tocki28  
**Date:** 2026-05-05 05:45

- Drop preview field from messages table (schema v2)
- Full body used for embedding quality at sync time, then discarded
- /api/ask fetches full email bodies live from Gmail before calling Anthropic
- Add facts table to schema for Phase 1 knowledge extraction
- Export getNangoGmailToken, extractBody, getHeader for reuse

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 00f5d29 - feat: local-first agency brain - Gmail sync, hybrid search, /ask UI

**Author:** Tocki28  
**Date:** 2026-05-05 05:24

- agency.db schema (messages, embeddings, sync_state)
- Nango OAuth session + Gmail sync with incremental cursor
- Voyage voyage-3 1024-dim embeddings
- Hybrid search (vector cosine + FTS5 BM25 RRF)
- /api/ask with Anthropic Haiku 4.5 streaming + prompt caching
- /connect and /ask pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## a44428d - chore: add gstack skill routing rules to CLAUDE.md

**Author:** Tocki28  
**Date:** 2026-05-02 19:17


---
## 65a8cf7 - require gstack for AI-assisted work

**Author:** Tocki28  
**Date:** 2026-05-02 19:12


---
## 60d59a3 - feat: hybrid BM25+vector search with score threshold in MCP

**Author:** Tocki28  
**Date:** 2026-05-02 18:34

- Add FTS5 virtual table (chunks_fts) with unicode61 tokenizer to SQLite schema (v2)
- Store keyword_text per chunk; sync inserts/deletes to FTS index
- Add ftsSearch() helper returning BM25-ranked results
- Rewrite mcp.ts search: vector cosine threshold (0.3) + FTS5 keyword recall merged via Reciprocal Rank Fusion (RRF_K=60)
- All prune functions now sync FTS deletions via shared deleteByIds helper
- Schema migration auto-clears stale data and logs reindex prompt

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 0703b8f - docs: update HOW_THE_CLI_WORKS and CHANGELOG for pointer-only search

**Author:** Tocki28  
**Date:** 2026-05-02 18:06

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 68ec16e - perf: return pointers + preview from search_gerendo, not full chunks

**Author:** Tocki28  
**Date:** 2026-05-02 18:04

Drops per-search token cost from ~4,000-5,000 to ~200-300 tokens.
Claude reads full content via the Read tool only when needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 926026d - feat: extend Voyage index to full codebase with declaration-based chunking

**Author:** Tocki28  
**Date:** 2026-05-02 17:13

- Add chunkCodeFile() in chunker.ts: splits .ts/.tsx files on top-level export declarations for semantic precision
- Expand collectFiles() to glob src/**/*.{ts,tsx} and agency-brain-ai-main/src/**/*.{ts,tsx}, excluding .test.ts, .spec.ts, .d.ts
- Update chunkFile() dispatcher to route code files to declaration-based chunking, markdown to paragraph chunking
- Update MCP tool description to reflect full codebase + docs coverage
- Update HOW_THE_CLI_WORKS.md with code sources inventory

Index now has 165 total chunks: 108 from code + 57 from docs. search_gerendo is now a unified knowledge layer across the entire repo.

---
## c5a9881 - fix: clean Voyage index - prune stale/unlisted chunks, cap per-file results

**Author:** Tocki28  
**Date:** 2026-05-02 16:51

- Remove CLAUDE.md from indexed files (already in system context every session)
- Add pruneUnlistedFiles: removes chunks for files dropped from the collection list
- Add pruneDeletedFiles: removes chunks for files no longer on disk
- Add pruneStaleChunks: removes old byte-offset chunks when a file is edited
- Cap search results at 2 chunks per source file to prevent any file flooding TOP_K

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## db06c5b - chore: use absolute paths in MCP server config and enable project MCP servers

**Author:** Tocki28  
**Date:** 2026-05-02 16:41

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 19c0240 - chore: fix Voyage MCP sourcing and harden search_gerendo rule

**Author:** Tocki28  
**Date:** 2026-05-02 14:01

- MCP server now sources .env.local via set -a before starting node
- CLAUDE.md: mandatory search_gerendo blockquote at top of file

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 9f9353d - chore: harden Voyage pipeline - auto-refresh git history, update context rules

**Author:** Tocki28  
**Date:** 2026-05-02 13:51

- Regenerate GIT_HISTORY.md before every index run (index.ts)
- Add full source inventory to HOW_THE_CLI_WORKS.md
- CLAUDE.md: pipeline-first context rule with file fallback
- docs/CHANGELOG.md: session log

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 53934df - feat: add Voyage RAG pipeline and MCP server for semantic context retrieval

**Author:** Tocki28  
**Date:** 2026-05-02 13:36

- Add gerendo CLI (chunker, embedder, SQLite DB, index + ask commands)
- Add MCP server exposing search_gerendo tool for Claude Code integration
- Register MCP server and auto-index hook in .claude/settings.json
- Slim CLAUDE.md to hard rules only - all context via search_gerendo
- Add docs/HOW_THE_CLI_WORKS.md explaining the full RAG pipeline
- Add data/ and *.db to .gitignore

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## c946f7b - docs: slim CLAUDE.md and _notes.md, route history to CHANGELOG

**Author:** Tocki28  
**Date:** 2026-05-02 08:25

CLAUDE.md trimmed 192 -> 86 lines: kept operational essentials (stack,
architectural rules, conventions, ask-before list, session ritual).
Pitch / target customer / comparisons / validation gates moved to BRIEF
and PLAN. Loaded every turn so the savings compound.

_notes.md trimmed 106 -> 31 lines: keeps current state and open
questions only. Two prior session blocks moved into CHANGELOG.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 0609038 - docs: log 2026-05-02 session (favicon, em-dash purge, two-way email aliases)

**Author:** Tocki28  
**Date:** 2026-05-02 08:21

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 1da736a - copy: replace em dashes with single hyphens across marketing site

**Author:** Tocki28  
**Date:** 2026-05-02 07:27

Per founder preference, swap every — for - in titles, meta, and body copy
on the marketing site. Cleaner, less AI-sounding.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 925146a - feat: add Gerendo favicon + finalize SEO metadata

**Author:** Tocki28  
**Date:** 2026-05-02 07:26

- Drop Gerendo-Favicon.png into both public dirs (marketing + app)
- Wire <link rel="icon"> in TanStack __root.tsx and Next.js layout.tsx
- Replace Lovable-default meta (title, og:image, twitter:site) with Gerendo branding
- Align homepage description with the "one brain / one OS" hero copy

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 4a9fd3a - Remove sensitive credentials from Git

**Author:** Tocki28  
**Date:** 2026-05-01 07:30


---
## db6f092 - F5Bot automation added + Ermi name changed in email

**Author:** Tocki28  
**Date:** 2026-05-01 07:09


---
## 3f96d82 - update terms of use

**Author:** Tocki28  
**Date:** 2026-05-01 07:05


---
## 695f9de - update terms of use

**Author:** Tocki28  
**Date:** 2026-04-30 17:27


---
## eacd182 - update cookie policy

**Author:** Tocki28  
**Date:** 2026-04-30 17:20


---
## aa5191d - update cookie policy

**Author:** Tocki28  
**Date:** 2026-04-30 17:17


---
## 959d25f - update privacy policy

**Author:** Tocki28  
**Date:** 2026-04-30 16:58


---
## 8227207 - update privacy policy

**Author:** Tocki28  
**Date:** 2026-04-30 16:53


---
## 0a0fe0b - fix: regenerate package-lock.json for Lovable site

**Author:** Tocki28  
**Date:** 2026-04-29 23:13

Cloudflare uses `npm ci` which requires exact alignment between
package.json and package-lock.json. The Lovable export had a stale
lockfile (@lovable.dev/vite-tanstack-config 1.2.0 -> 1.4.3,
framer-motion missing entirely, etc.). Regenerated locally.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 2c5805e - copy: welcome email — solo founder -> co-founder

**Author:** Tocki28  
**Date:** 2026-04-29 23:07

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 7fa0818 - fix: drop bun.lockb so Cloudflare Pages uses npm

**Author:** Tocki28  
**Date:** 2026-04-29 23:04

Cloudflare auto-detects Bun when bun.lockb is present and runs
`bun install --frozen-lockfile` before any build command — failing
because the exported lockfile is in an outdated format. Removing it
makes Cloudflare fall back to npm via package-lock.json, which is
what we want.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## e2829fd - fix: lazy-init Resend client inside POST handler

**Author:** Tocki28  
**Date:** 2026-04-29 22:55

Top-level `new Resend(process.env.RESEND_API_KEY)` ran during Next's
build-time "collect page data" pass and threw because env vars aren't
populated until runtime on Vercel. Move client instantiation + env
reads inside the handler. Also returns a clean 500 if env is missing
in production instead of crashing the build.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## bbfa19f - fix: exclude agency-brain-ai-main from Next.js type-check

**Author:** Tocki28  
**Date:** 2026-04-29 22:50

Vercel's Next build was failing because TypeScript walked into the
Lovable subfolder, whose deps (framer-motion, etc.) aren't installed
at the repo root. The subfolder is its own self-contained project,
deployed separately by Cloudflare Pages.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## f701676 - feat: waitlist landing pages + Resend integration

**Author:** Tocki28  
**Date:** 2026-04-29 22:44

- Build Next.js waitlist at app.gerendo.com (Fraunces + Inter, warm-ink palette, italic G favicon)
- Add /api/waitlist route handler: Resend contacts.create + transactional welcome email
- Add CORS so cross-origin POST from gerendo.com works
- Add Lovable marketing site in agency-brain-ai-main/ (TanStack Start, targets Cloudflare Pages)
- Wire Lovable WaitlistDialog to POST to app.gerendo.com/api/waitlist
- Soften vapor security + AI claims to honest "we're building" framing
- Rename fictional client Pescobar -> Marengo in AskDemo
- Update .gitignore to handle nested deps + Vite build outputs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## ed15ac5 - docs: add BRIEF.md, ARCHITECTURE.md; update notes + changelog

**Author:** Tocki28  
**Date:** 2026-04-28 18:21

- BRIEF.md v0: 1-page product brief with placeholders for drift story, why-now, why-us
- ARCHITECTURE.md v0: RAG data model, RLS pattern, ingest + retrieval pipelines, 6 milestones
- _notes.md + CHANGELOG.md: today's progress, decisions, open questions

---
## 1d3b3b0 - chore: trigger redeploy after repo visibility change

**Author:** Tocki28  
**Date:** 2026-04-28 18:16


---
## d430229 - docs: add CLAUDE.md, _notes.md, planning docs from venture brainstorm

**Author:** Tocki28  
**Date:** 2026-04-28 06:28

Sets up this repo as a self-contained Claude Code workspace for the Gerendo SaaS product. Includes target customer context, marketing agency operational reality, locked-in stack decisions, validation gates, and session management routines. Phase 0 — Validation; no app code yet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 5e26c7d - Initial commit from Create Next App

**Author:** Tocki28  
**Date:** 2026-04-28 06:09


---