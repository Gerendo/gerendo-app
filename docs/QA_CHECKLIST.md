# Gerendo QA Checklist

Last updated: 2026-05-09

---

## Auth

- [ ] Sign up with a new Google account - workspace is created automatically
- [ ] Sign in with existing account - lands on `/ask` if data exists, `/connect` if not
- [ ] Sign out and back in - session restores correctly
- [ ] Two different users cannot see each other's data (even in the same workspace)
- [ ] Unauthenticated user cannot access `/ask`, `/connect`, `/settings` - redirected to `/login`

---

## Connect page (`/connect`)

- [ ] Gmail connect - OAuth flow completes, redirects back to `/connect` with label picker modal
- [ ] Label picker shows all Gmail labels with correct icons
- [ ] Inbox and Sent are pre-selected by default
- [ ] Cancelling the label picker resets Gmail back to previous state (not stuck "syncing")
- [ ] After selecting labels and clicking Start sync - progress banner appears with % counter
- [ ] Progress banner counts up (not stuck at "0%" or "starting...")
- [ ] Stop button during import - fully disconnects Gmail, removes indexed data, shows Connect button
- [ ] Per-tool Stop button - shows inline confirm panel (not browser popup)
- [ ] Confirming per-tool Stop removes the tool and its data
- [ ] Cancelling per-tool Stop dismisses the confirm panel without changing anything
- [ ] Google Drive connect - OAuth completes, first sync runs automatically
- [ ] Asana connect - OAuth completes, first sync runs automatically
- [ ] "Ask questions" button in header navigates to `/ask`
- [ ] After at least one tool synced with data - `/ask` is accessible

---

## Ask page (`/ask`)

- [ ] No tools connected - shows "Connect your tools" screen
- [ ] Tools connected but no data indexed - shows "Sync your data" screen
- [ ] Data indexed - shows ask UI with suggested questions
- [ ] Asking "what are my last 5 emails" - returns inbox/sent only (not labels like F5Bot_Reddit)
- [ ] If results are from unexpected labels - Claude mentions which label and offers to search inbox instead
- [ ] Asking about a Drive file - returns correct file content
- [ ] Asking about an Asana task - returns correct task details
- [ ] Sources panel shows correct email subject, sender, date, mailbox
- [ ] Clicking a source link opens the correct Gmail thread
- [ ] Sync banner appears when background sync is running
- [ ] Sync banner shows % progress that updates
- [ ] Sync banner disappears when sync completes
- [ ] Input bar is pinned to bottom on mobile
- [ ] No horizontal scrolling on mobile
- [ ] Connect tools / Settings buttons in header are tappable on mobile

---

## Auto-sync (webhooks + cron)

- [ ] Send a new email to your Gmail inbox - it appears in the DB within 30 seconds
- [ ] Check Supabase `webhook_secrets` table - has a row with `provider = 'gmail'` and `key = 'watch'`
- [ ] Update an Asana task - re-indexed within seconds (after Asana webhook is registered)
- [ ] Add a Google Doc to Drive - indexed within the next cron run (daily on Hobby plan)
- [ ] Add a Meet transcription doc to Drive - indexed on next Gmail webhook trigger

---

## Security

- [ ] User A cannot see User B's emails by any means
- [ ] Supabase Table Editor with `anon` role - all tables return 0 rows
- [ ] Supabase Table Editor with `authenticated` role for User A - only User A's rows visible
- [ ] Direct API call without auth header returns 401
- [ ] `oauth_tokens` table not readable from browser (no user SELECT policy)
- [ ] `webhook_secrets` table not readable from browser (no user SELECT policy)

---

## Debugging sync issues

### Step 1 - Check Vercel logs
Go to Vercel → your project → Logs tab. Filter for `sync/gmail/stream`. Look for any error messages after clicking sync.

### Step 2 - Check the sync_jobs table
Go to Supabase → Table Editor → `sync_jobs`. Find the row with `status = 'running'` for your workspace. Check:
- `total_synced` - is it incrementing? If stuck at 0, the job is failing silently
- `label_progress` - is it empty `{}`? If so, the job never started processing
- `started_at` - if more than 30 minutes ago and still `running`, it timed out

### Step 3 - Check for permission errors
If `label_progress` is `{}` and `total_synced` is 0, run in Supabase SQL editor:
```sql
SELECT id, status, total_synced, label_progress, started_at 
FROM sync_jobs 
ORDER BY started_at DESC 
LIMIT 5;
```
If rows exist but never update, the service role may not have write permission. Run:
```sql
GRANT ALL ON sync_jobs TO service_role;
GRANT ALL ON sync_state TO service_role;
```

### Step 4 - Check the Gmail token
If sync starts but immediately errors, the Gmail OAuth token may be expired. Go to Supabase → `oauth_tokens` table. Check `expires_at` for the `google-gmail` provider. If expired, disconnect and reconnect Gmail from `/connect`.

### Step 5 - Check Voyage API
The sync calls Voyage AI to generate embeddings. If Voyage is down or the API key is wrong, the sync will fail silently on the embedding step. Check:
- Vercel env vars - is `VOYAGE_API_KEY` set?
- Vercel logs - look for `embed error` messages

### Step 6 - Manual trigger test
Run this in the browser console on `app.gerendo.com` to test the register endpoint directly:
```javascript
fetch("/api/webhooks/gmail/register", { method: "POST" })
  .then(r => r.json()).then(console.log)
```
Should return `{ ok: true, expiration: "...", workspaceId: "...", userId: "..." }`.

---

## Known limitations (Hobby plan)

- Drive cron runs once per day (midnight). New Drive files are also picked up when Gmail receives a new email (piggybacked sync).
- Gmail watch expires every 7 days - automatically renewed by cron at 06:00 every 6th day.
- Vercel function timeout is 300 seconds - very large mailboxes may not finish in one run. The cursor system means subsequent syncs pick up where the last one left off.
