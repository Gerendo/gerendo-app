## deb72df - fix(security): verify workspace membership before storing Asana handshake secret

**Author:** Tocki28  
**Date:** 2026-05-10 17:14

The handshake endpoint accepted workspace_id/user_id from query params
without validating they correspond to a real workspace member with Asana
connected. An attacker with valid UUIDs could overwrite a user's stored
HMAC secret, breaking event verification or injecting Asana task data.

Fix: check workspace_members + oauth_tokens before upsert. Returns 401
if either check fails, so the Asana handshake is rejected cleanly.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 27b0060 - fix(gmail): skip labels API call when rate limit window is active

**Author:** Tocki28  
**Date:** 2026-05-10 17:10

Prevents burning quota units on the label picker when we already know
the API is rate limited. Returns hardcoded defaults immediately with
rateLimited:true so the UI still works.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 65110b8 - fix(marketing): self-host fonts to fix 4x 404 errors on gerendo.com

**Author:** Tocki28  
**Date:** 2026-05-10 17:03

Fraunces v37, Inter v19, JetBrains Mono v24 woff2 URLs were returning
404 after Google updated font versions. Downloaded current Latin subset
woff2 files locally and updated @font-face src to /fonts/* so this
cannot break again on a Google Fonts version bump.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 8170099 - fix(gmail): batch messages.get, reset stale cursor, cache labels

**Author:** Tocki28  
**Date:** 2026-05-10 16:43

- Replace individual gmail.users.messages.get calls with batch API
  (100 messages per HTTP request), matching what stream/route.ts already
  does. This was the primary driver of 98k GetMessage calls.

- Clear the historyId cursor from sync_state when history.list fails with
  a non-rate-limit error (stale cursor, expires ~7 days). Previously the
  stale cursor was kept, causing 70k ListHistory calls at 99% error rate
  on every webhook fire.

- Cache user labels in sync_state for 24h. labels.list was called on
  every webhook trigger regardless of push frequency, driving 7.9k
  ListLabels calls at 98.7% error rate.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 3e119b6 - fix: persist gmail rate limit window to sync_state so webhook skips sync until quota resets

**Author:** Tocki28  
**Date:** 2026-05-10 16:20


---
## 5402d62 - fix(qa): ISSUE-006 — founding partner CTA links to app.gerendo.com beta instead of waitlist

**Author:** Tocki28  
**Date:** 2026-05-10 16:13


---
## 81cb72f - fix(qa): ISSUE-MKTG-002 — add initial r value to BrainOrb motion.circle to fix SVG undefined attribute error

**Author:** Tocki28  
**Date:** 2026-05-10 16:12


---
## 38a9c69 - fix(qa): ISSUE-006 — add Sign in link and Open app footer link to gerendo.com

**Author:** Tocki28  
**Date:** 2026-05-10 16:12


---
## 8f2e8f4 - chore: add .gstack to gitignore, update git history doc

**Author:** Tocki28  
**Date:** 2026-05-10 16:08


---
## bb7d0bd - fix: add 200ms delay between labels and 100ms between pagination pages to stay within Gmail quota

**Author:** Tocki28  
**Date:** 2026-05-10 15:58


---
## 1f24e30 - fix: labels API returns defaults on rate limit instead of error, remove error modal from label picker

**Author:** Tocki28  
**Date:** 2026-05-10 15:57


---
## 55b980c - fix: retry after rate limit in gmail sync, set webhook lock before sync to prevent concurrent race

**Author:** Tocki28  
**Date:** 2026-05-10 15:55


---
## adfb7b2 - fix: cache tool results in-request so identical tool calls return cached data, not a live re-fetch

**Author:** Tocki28  
**Date:** 2026-05-10 15:50


---
## 99bbc78 - fix: hard client-side completed status check, clearer meta-question rule to prevent unnecessary re-fetches

**Author:** Tocki28  
**Date:** 2026-05-10 15:46


---
## e5fad46 - fix: AI must preserve tool result order, never re-call tools when asked about data source

**Author:** Tocki28  
**Date:** 2026-05-10 15:43


---
## e0106e2 - fix: revert to project-based fetch (search API is premium-only), fix due_on filter to exclude null, sort by due date for stable ordering

**Author:** Tocki28  
**Date:** 2026-05-10 15:37


---
## 3118861 - fix: use Asana search API for consistent server-side filtering, remove broken custom URL scheme

**Author:** Tocki28  
**Date:** 2026-05-10 15:33


---
## ee99df9 - fix: paginate through all Asana tasks for accurate count, hard-enforce 10 per page in tool result

**Author:** Tocki28  
**Date:** 2026-05-10 15:28


---
## 38c029d - fix: add offset+show_all to get_asana_tasks for pagination, fix count confusion between indexed vs live, clearer pagination prompt

**Author:** Tocki28  
**Date:** 2026-05-10 15:22


---
## b7bdf40 - feat: smart links open native app if installed (Asana), fall back to web after 1.5s

**Author:** Tocki28  
**Date:** 2026-05-10 15:17


---
## 83d5fd4 - fix: fetch all tasks for accurate count but show only top 10, AI told to always state total then list top 10

**Author:** Tocki28  
**Date:** 2026-05-10 15:12


---
## 11e957a - fix: increase Asana default limit to 100, number tasks so AI counts correctly, make total count explicit

**Author:** Tocki28  
**Date:** 2026-05-10 15:10


---
## 7e3da42 - fix: use SDK streaming for real token-by-token output, make task/file names clickable markdown links

**Author:** Tocki28  
**Date:** 2026-05-10 15:07


---
## 86f89fe - fix: add X-Accel-Buffering header for Vercel streaming, replace inline pill parsing with source chips below response

**Author:** Tocki28  
**Date:** 2026-05-10 15:02


---
## c78c559 - feat: inline source pills replace [D1]/[A1]/[E1] markers with clickable chips linking to Drive/Asana/Gmail

**Author:** Tocki28  
**Date:** 2026-05-10 14:56


---
## 384ffb4 - fix: add force-dynamic and maxDuration to ask route to enable streaming on Vercel

**Author:** Tocki28  
**Date:** 2026-05-10 14:50


---
## 169f0e7 - fix: OAuth callback handled only once - searchParams identity changes were re-triggering doFirstSync on every render

**Author:** Tocki28  
**Date:** 2026-05-10 14:40


---
## cceb281 - revert: restore gmail webhook register call on connect

**Author:** Tocki28  
**Date:** 2026-05-10 14:17


---
## 39937fe - fix: remove gmail webhook register call from connect page, cron handles registration daily

**Author:** Tocki28  
**Date:** 2026-05-10 14:15


---
## e54355c - fix: never show syncing banner if Gmail not connected, mark stuck jobs done after 5min with 0 synced

**Author:** Tocki28  
**Date:** 2026-05-10 14:10


---
## 27b02dd - chore: log caller context on gmail register to trace quota exhaustion

**Author:** Tocki28  
**Date:** 2026-05-10 14:00


---
## 0a8b3c6 - fix: cache rate limit retry-after in DB so subsequent register calls are skipped until quota resets

**Author:** Tocki28  
**Date:** 2026-05-10 13:59


---
## 69da151 - fix: cron only processes members who have the relevant provider connected

**Author:** Tocki28  
**Date:** 2026-05-10 13:56


---
## 619b264 - fix: getWorkspaceFromSession picks most recently joined workspace, handles multi-workspace users

**Author:** Tocki28  
**Date:** 2026-05-10 13:46


---
## 9653194 - fix: skip auto-workspace creation when signing in via invite link

**Author:** Tocki28  
**Date:** 2026-05-10 13:38


---
## 20395d3 - fix: skip gmail watch re-registration if an active watch already exists

**Author:** Tocki28  
**Date:** 2026-05-10 13:18


---
## a0fc44d - fix: status route timestamp bug causes infinite poll, remove spurious Drive sync from Gmail webhook

**Author:** Tocki28  
**Date:** 2026-05-10 13:15


---
## d4db9f6 - chore: sync GEMINI.md with CLAUDE.md (deploy config section)

**Author:** Tocki28  
**Date:** 2026-05-10 13:06

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 6b02acf - fix: fix broken debounce in Gmail webhook, increase to 5 minutes

**Author:** Tocki28  
**Date:** 2026-05-10 12:02

The debounce comparison was broken - comparing ms timestamp to Postgres
date string always evaluated false, meaning every webhook push triggered
a full Gmail sync. Fixed by parsing the date string properly.
Increased debounce from 30s to 5 minutes to reduce API hammering.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 88402c9 - fix: never call Gmail labels API on initial connect, only on explicit refresh

**Author:** Tocki28  
**Date:** 2026-05-10 12:00

On first connect, modal shows hardcoded defaults (Inbox, Sent, Drafts etc)
with no API call. Gmail labels API only called when user clicks Manage labels
or the retry button inside the modal. Eliminates rate limit issues entirely.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 739028d - fix: global stop button disconnects all tools, not just syncing one

**Author:** Tocki28  
**Date:** 2026-05-10 11:54

Stop now calls disconnect for all tools (gmail, drive, asana) and
clears all connected state so every card shows Not connected.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## fd3738d - fix: Stop button works for all tools, not just Gmail

**Author:** Tocki28  
**Date:** 2026-05-10 11:52

Stop button was gated on initialSyncing === 'gmail' so Drive and Asana
syncs could never be stopped. Now shows for any syncing tool.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 875f188 - fix: stop button also deletes OAuth token so disconnect persists on reload

**Author:** Tocki28  
**Date:** 2026-05-10 11:48

Previously Stop only cleared UI state - on next page load nango status
fetch would find the token still in DB and show the tool as connected again.
Now Stop calls /api/sync/disconnect to remove the token from the DB.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 8dd7ea3 - fix: stop disconnects tool, fix connectedTools race condition

**Author:** Tocki28  
**Date:** 2026-05-10 11:45

- Stop button now removes tool from connectedTools so card shows Not connected
- Nango status fetch merges instead of replacing connectedTools to prevent
  race condition where a just-connected tool gets wiped out by stale status

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 3cec7de - fix: stop button clears poll and syncCount

**Author:** Tocki28  
**Date:** 2026-05-10 11:42

Stop button now clears the poll interval and resets syncCount to 0
so the progress bar disappears cleanly.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## b815929 - fix: clear progress bar and stop button when syncing tool is disconnected

**Author:** Tocki28  
**Date:** 2026-05-10 11:39

Disconnecting a tool that is currently syncing now clears initialSyncing
and stops the poll, so the progress bar and stop button disappear.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 7882935 - fix: catch Gmail watch API errors in webhook register route

**Author:** Tocki28  
**Date:** 2026-05-10 11:34

Unhandled exception from gmail.users.watch was causing 500 with empty body.
Now returns 502 with actual error. Client already ignores this error (fire-and-forget).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 72889fd - fix: show default labels immediately, load full list in background

**Author:** Tocki28  
**Date:** 2026-05-10 11:31

Modal opens instantly with Inbox/Sent/Drafts/etc pre-populated.
Full label list (including custom Gmail labels) loads in background.
No API call blocks the modal from opening - eliminates rate limit UX issues.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## d9a5f0e - fix: cache Gmail labels in state, only fetch once per session

**Author:** Tocki28  
**Date:** 2026-05-10 11:28

Reopening the label picker reuses cached labels instead of hitting
the Gmail API again. Try again button forces a fresh fetch.
Prevents rate limit errors from repeated calls.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## f809eb6 - fix: show error inside label picker modal instead of closing silently

**Author:** Tocki28  
**Date:** 2026-05-10 11:26

When Gmail API returns an error (rate limit, token issue, etc.) the modal
stays open and shows the error message with a retry button.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 9a5b61a - fix: catch Gmail API errors in labels route, return proper error message

**Author:** Tocki28  
**Date:** 2026-05-10 11:23

Unhandled exception from gmail.users.labels.list was causing a 500 with
empty body. Now returns a 502 with the actual error message.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 20e9a12 - fix: show actual error message when label picker fails to load

**Author:** Tocki28  
**Date:** 2026-05-10 11:17

Instead of closing silently, surfaces the real error from the API
so we can diagnose why labels aren't loading.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## b2c8404 - fix: gate OAuth redirect handler on authChecked, add Manage labels button

**Author:** Tocki28  
**Date:** 2026-05-10 11:14

- URL param handler (gmail_connected=1 etc) now waits for auth to be
  confirmed before fetching, fixing empty label picker on reconnect
- Add 'Manage labels' button on connected Gmail card so users can
  change which mailboxes are synced without disconnecting

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## b2ed6ee - fix: close label picker and show error if Gmail labels fail to load

**Author:** Tocki28  
**Date:** 2026-05-10 11:05

Instead of opening an empty modal when the labels API returns 401/error,
close the picker and show an inline error message on the Gmail card.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 84f4547 - fix: handle bfcache restore on back button (mobile Safari)

**Author:** Tocki28  
**Date:** 2026-05-10 11:00

Mobile Safari's back-forward cache freezes pages in memory and restores
them without re-running useEffect. The pageshow event with e.persisted=true
fires on bfcache restores - we check auth there and redirect if session is gone.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 1310fd4 - fix: render nothing until auth confirmed, preventing back button flash

**Author:** Tocki28  
**Date:** 2026-05-10 10:57

Pages return null until getUser() confirms a valid session. If no session,
redirects to login. Prevents cached page content from showing to logged-out users.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 0d33a81 - fix: explicitly delete auth cookies on signout response

**Author:** Tocki28  
**Date:** 2026-05-10 10:52

Forces browser to drop sb-* cookies immediately on logout so cached
pages cannot restore an authenticated session via the back button.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 08bc983 - fix: use getUser() instead of getSession() for auth guard

**Author:** Tocki28  
**Date:** 2026-05-10 10:50

getSession() reads from local cache and can return stale data after logout.
getUser() makes a live server request so it correctly detects invalid sessions.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 84f8110 - fix: redirect to login if session gone on back button

**Author:** Tocki28  
**Date:** 2026-05-10 10:47

Each protected page checks auth on mount and redirects to /login if
no session exists. Catches the case where browser restores a cached
page after logout.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 5744abf - fix: add Cache-Control no-store to authenticated pages

**Author:** Tocki28  
**Date:** 2026-05-10 10:39

Prevents browser back button from restoring a cached authenticated page
after logout. Middleware sets no-store on /ask, /connect, /settings.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 9118b98 - fix: category chips are rectangles, connect/disconnect button pushed right

**Author:** Tocki28  
**Date:** 2026-05-10 10:29

- Category filter: rounded-lg instead of rounded-full, larger text and padding
- Tool card: status + button row uses justify-between on mobile so button sits at far right

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 5ea8d29 - fix: tool cards stack vertically on mobile to prevent text overlap

**Author:** Tocki28  
**Date:** 2026-05-10 10:25

Status text and action button now appear on a second row on mobile,
indented to align with the text. No more overlap with description.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## de4dd9f - fix: suggestion chips use 2-column grid on mobile, clamp to 2 lines

**Author:** Tocki28  
**Date:** 2026-05-10 10:22

Prevents chips from becoming unreadably tall in narrow viewports.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## d917ace - fix: always show Google account picker on login

**Author:** Tocki28  
**Date:** 2026-05-10 10:19

Adds prompt=select_account so users can switch accounts instead of
being silently signed into their last Google session.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 22817f1 - fix(qa): sidebar defaults collapsed on mobile, category filter no-wrap on mobile

**Author:** Tocki28  
**Date:** 2026-05-10 10:13

- ISSUE-002: sidebar now defaults to collapsed on mobile (< 768px) unless
  the user has an explicit localStorage preference
- ISSUE-003: category filter chips now only wrap at md breakpoint (768px+),
  staying in a single scrollable row on mobile

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## bd37573 - docs: update git history log

**Author:** Tocki28  
**Date:** 2026-05-10 10:00


---
## 285564a - feat: register Asana webhooks on connect, expand QA sync checklist

**Author:** Tocki28  
**Date:** 2026-05-10 09:58

- Register Asana push webhooks immediately when user connects Asana
  (fire-and-forget, same pattern as Drive)
- Expand QA checklist section 8 with comprehensive automated sync tests:
  webhook registration on connect, Gmail/Drive/Asana real-time sync,
  cron safety net verification, data quality checks, and disconnect/reconnect flows
- Update BUG-007 status to resolved in checklist

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 0db0649 - feat: register Drive webhook on connect, add missing cron entries

**Author:** Tocki28  
**Date:** 2026-05-10 09:55

- Register Drive push webhook immediately when user connects Google Drive
  from the Connect page (fire-and-forget, cron handles renewal)
- Add drive-channel-renew cron (daily 05:00) to vercel.json
- Add asana-webhook-register cron (daily 07:00) to vercel.json
- Mark BUG-007 (Asana OAuth redirect_uri) as resolved

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 4a6cba2 - feat: real-time webhooks for Google Drive and Asana sync

**Author:** Tocki28  
**Date:** 2026-05-10 09:43

- Drive: add changes.list cursor for incremental sync (first run full scan, subsequent runs use stored page token)
- Drive: new /api/webhooks/drive receiver with 30s debounce and channel ID verification
- Drive: new /api/webhooks/drive/register with 6-day channel TTL and stop-before-renew logic
- Drive: add webhook_secrets cleanup to delete-data route
- Asana: add 15s debounce per Asana workspace to webhook receiver
- Cron: wire drive-channel-renew and asana-webhook-register sources
- ARCHITECTURE.md: add full sync/webhook architecture section with latency table

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## b461ecc - fix: correct privacy policy inaccuracies

**Author:** Tocki28  
**Date:** 2026-05-10 09:19

- Account deletion: accurate 3-step flow (Danger Zone + revoke Google
  OAuth access + email for workspace removal) - users sign in via Google,
  there is no separate Gerendo password account to delete
- Voyage AI: corrected - text IS sent to Voyage as input to generate
  embeddings; previous wording implied Voyage never received the text
- Chat history: added to 'What data do you store?' - questions and AI
  answers are now stored in conversation_messages table
- Supabase region: removed unverified 'EU Ireland' claim, left as AWS

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 20aca36 - fix: remove arrow from collapsed sidebar toggle icon in top bar

**Author:** Tocki28  
**Date:** 2026-05-10 09:11


---
## cdc9c13 - fix: remove arrow from sidebar toggle icon - panel outline only

**Author:** Tocki28  
**Date:** 2026-05-10 09:08


---
## 685efb0 - fix: sidebar user avatar at bottom, better toggle icon, fix text contrast

**Author:** Tocki28  
**Date:** 2026-05-10 09:05

- Sidebar bottom: user initials circle (amber), name + email, log out icon button
- Nav links (Connect tools, Settings, Privacy) sit above the user row with a divider
- Toggle icon: custom sidebar panel icon with arrow direction (open/close)
- Collapsed toggle moved from absolute position into top bar - now properly
  vertically aligned with 'New chat' text
- Bump dim text from oklch(0.55) to oklch(0.72) in Settings header nav links
  and Sidebar bottom nav - was near-invisible on dark background

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## a745210 - feat: collapsible sidebar with persistent chat history

**Author:** Tocki28  
**Date:** 2026-05-10 08:56

DB: conversations + conversation_messages tables (requires migration SQL)

API:
- GET/POST /api/conversations - list and create conversations
- PATCH/DELETE /api/conversations/[id] - rename/delete
- GET/POST /api/conversations/[id]/messages - load and save messages

Sidebar (src/components/Sidebar.tsx):
- 260px collapsible panel, collapse state persisted in localStorage
- New chat button, conversation list grouped by Today/Yesterday/7d/30d/Older
- Hover to reveal delete button per conversation
- Bottom nav: Connect tools, Settings, Privacy, Log out

Ask page refactor:
- Sidebar layout (flex row) replaces top header nav
- Conversation persistence: first message creates conversation, URL updates
  to /ask?c=[id], messages saved to DB after each exchange
- Page reload restores conversation from DB via URL param
- Switching conversations loads messages from DB
- Auto-title from first user message (first 50 chars)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
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