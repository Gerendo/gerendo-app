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
- [ ] OAuth starts without `invalid_redirect_uri` error (**BUG-007 - needs Asana console fix**)
- [ ] After OAuth, sync starts automatically
- [ ] Banner shows "Syncing Asana tasks..."
- [ ] Webhook registered after first sync (check Vercel logs for handshake)

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

## 5. Real-time sync (webhooks)

### Gmail webhook
- [ ] Send yourself an email → appears in chat within ~60 seconds
- [ ] Vercel logs show 200 on `/api/webhooks/gmail` (no rate limit errors)
- [ ] Rapid burst of emails does not trigger rate limit storm (30s debounce)
- [ ] `sync_state` table has row with `source = 'gmail:webhook_lock'` after first webhook

### Asana webhook (requires BUG-007 fix first)
- [ ] Create a task in Asana → appears in query results quickly
- [ ] Update a task → change reflected in next query
- [ ] Complete a task → shows as completed in results

---

## 6. Mobile UX (test on real iPhone + Android)

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

## 7. Security

- [ ] User A cannot read User B's data (even in same workspace)
- [ ] Supabase Table Editor with `anon` role → 0 rows on all tables
- [ ] `oauth_tokens` not readable from browser (no anon/user SELECT policy)
- [ ] `webhook_secrets` not readable from browser
- [ ] Direct API call to `/api/ask` without session → 401
- [ ] Gmail webhook rejects requests without valid JWT
- [ ] Asana webhook rejects requests without valid HMAC signature

---

## 8. Known bugs status

| Bug | Area | Fixed? | How to verify |
|-----|------|--------|---------------|
| BUG-001 iPhone zoom on input | Mobile | ✅ Fixed | Tap input on iPhone, no zoom |
| BUG-002 Chat blocked without all tools | Chat | ✅ Fixed | Connect only Gmail, still ask |
| BUG-003 Invite link base64url crash | Settings | ✅ Fixed | Generate link, no error |
| BUG-004 AI claims limited Asana data | Chat | ✅ Fixed | Ask overdue tasks, gets live data |
| BUG-005 No logout from most pages | Navigation | ✅ Fixed | Log out visible everywhere |
| BUG-006 No cursor pointer | CSS | ✅ Fixed | Hover any button on desktop |
| BUG-007 Asana OAuth redirect_uri | Connect | ❌ Manual | Add URI in Asana developer console |
| BUG-008 Sync progress disappears | Connect | ⚠️ Improved | Messages correct, no fake bar |
| BUG-009 Mobile header cramped | Mobile | ✅ Fixed | Hamburger on mobile |
| BUG-010 Mobile connect layout | Mobile | ✅ Fixed | Status one line, chips scroll |

---

## 9. Debugging reference

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
