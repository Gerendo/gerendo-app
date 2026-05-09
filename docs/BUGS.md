# Known Bugs

---

## BUG-001 - iPhone zooms in on input focus

**Status:** Open  
**Platform:** iOS Safari (iPhone)  
**Area:** Mobile UX / global inputs

**Description:**  
When tapping any input or textarea on mobile, iOS Safari automatically zooms in on the field.

**Root cause:**  
iOS Safari zooms in whenever a focused input has a font size below 16px. Any input styled with `text-sm` (14px) or smaller triggers this behavior.

**Fix:**  
Ensure all `<input>`, `<textarea>`, and `<select>` elements have a minimum font size of 16px on mobile. Either set `font-size: 16px` globally for inputs in `globals.css`, or add `text-base` to shadcn input components.

---

## BUG-002 - Chat locked unless all tools are synced

**Status:** Open  
**Platform:** All  
**Area:** Chat / Connect flow

**Description:**  
The chat page refuses to let the user ask questions unless every integration (Gmail, Drive, Asana, etc.) is synced. If only Gmail is connected, the user still gets blocked from using the chat.

**Expected behavior:**  
Chat should work with any subset of connected tools. The AI should answer based on whatever data is available and let the user know if a specific source is not synced.

**Fix:**  
Remove the all-tools-required gate on the chat page. Replace it with a soft prompt (e.g. "Connect more tools to get richer answers") shown inline, not as a blocker.

---

## BUG-003 - Invite link generation fails with "unrecognized encoding: base64url"

**Status:** Open  
**Platform:** All  
**Area:** Settings / Invite flow

**Description:**  
Clicking "Generate invite link" in Settings throws: `Failed to create invite: unrecognized encoding: "base64url"`. The error comes from Postgres - the `invite_tokens` table uses `encode(gen_random_bytes(32), 'base64url')` as the column default, but Supabase's Postgres version does not support the `base64url` encoding variant.

**Root cause:**  
Postgres only supports `'base64'`, `'hex'`, and `'escape'` as encoding names. `'base64url'` is not valid.

**Fix:**  
Generate the token in app code (e.g. `crypto.randomBytes(32).toString('hex')`) and pass it explicitly in the insert, instead of relying on the column default. No schema change needed.

---

## BUG-005 - Logout requires navigating to Ask page then Settings

**Status:** Open  
**Platform:** All  
**Area:** Navigation / Auth

**Description:**  
There is no way to log out from most pages. The user must navigate to the Ask (chat) page, open Settings, and then find the logout button. This is too many steps and non-obvious.

**Expected behavior:**  
A logout option should be accessible from anywhere in the app - ideally in a persistent user menu, sidebar footer, or top-bar avatar dropdown - without requiring navigation to a specific page first.

**Fix:**  
Add a logout button to a globally accessible UI element. Options: (1) user avatar/initials dropdown in the top bar or sidebar footer with "Log out" as a menu item, (2) a persistent "Log out" link in the sidebar navigation. The logout action should call `supabase.auth.signOut()` and redirect to `/login`.

---

## BUG-007 - Asana OAuth fails with invalid redirect_uri

**Status:** Open  
**Platform:** All  
**Area:** Connect / Asana OAuth

**Description:**  
Clicking "Connect Asana" redirects to Asana's OAuth page but immediately returns an error: `invalid_request: The redirect_uri parameter does not match a valid url for the application.` The redirect URI being sent is `https://app.gerendo.com/auth/asana`, which is not registered in the Asana OAuth app settings.

**Root cause:**  
The redirect URI hardcoded in the OAuth flow (`https://app.gerendo.com/auth/asana`) does not match any of the allowed redirect URIs registered in the Asana developer console for this OAuth app.

**Fix:**  
Go to the Asana developer console, open the OAuth app, and add `https://app.gerendo.com/auth/asana` to the list of allowed redirect URIs. If using Nango, also verify the redirect URI registered there matches what Asana expects.

---

## BUG-006 - Cursor does not change to pointer on clickable buttons

**Status:** Open  
**Platform:** All (desktop)  
**Area:** Global UX / CSS

**Description:**  
Hovering over clickable buttons does not change the cursor to the standard hand/pointer icon. Users have no visual affordance that an element is interactive.

**Root cause:**  
Tailwind's base reset sets `cursor: default` on buttons. The `cursor-pointer` utility is not applied globally to button and interactive elements.

**Fix:**  
Add `cursor-pointer` to the base button styles in `src/components/ui/button.tsx` (the `buttonVariants` base class). Also add it globally in `globals.css` for `button, [role="button"], a` to catch all interactive elements across the app.

---

## BUG-008 - Sync progress bar disappears when navigating away from Connect page

**Status:** Open  
**Platform:** All  
**Area:** Connect / Sync UX

**Description:**  
When connecting Google Drive or Asana, the tool shows a "Starting..." status with a progress bar. If the user navigates to the Ask page during this time, the progress bar disappears entirely. On returning to Connect, the tools show "Active - auto-syncing" with no indication of whether the initial sync actually completed or how far along it is.

**Expected behavior:**  
Sync progress should persist across navigation. Either (1) show a persistent sync indicator in the global header/sidebar while a sync is in progress, or (2) restore the progress state when the user returns to the Connect page. The user should always know if a sync is still running.

**Fix:**  
Poll sync status from the server on Connect page mount and resume displaying progress if a sync is still in progress. Optionally add a small global indicator (e.g. a pulsing dot next to the tool icon in the nav) that is visible from any page during active syncs.

---

## BUG-009 - Mobile header shows raw buttons instead of a menu

**Status:** Open  
**Platform:** iOS / Android (mobile browsers)  
**Area:** Mobile UX / Header

**Description:**  
On mobile, the top header shows "Ask questions" and "Log out" as full-width buttons side by side. They look cramped, are not well sized for touch, and take up too much header space. This is visible on both the Connect page and other app pages.

**Expected behavior:**  
On mobile, the header should collapse navigation actions into a hamburger menu or a compact icon-only layout. The primary CTA ("Ask questions") can remain visible but secondary actions ("Log out", settings) should be hidden behind a menu.

**Fix:**  
Add a responsive header: on `md+` show the current button row, on mobile show the app name/logo + a hamburger icon that opens a drawer or dropdown with all navigation actions.

---

## BUG-010 - Mobile Connect page layout issues

**Status:** Open  
**Platform:** iOS / Android (mobile browsers)  
**Area:** Mobile UX / Connect page

**Description:**  
Several layout problems on the Connect page on mobile:
1. "Not connected" status text wraps to two lines inside the tool card, making cards taller and harder to scan.
2. Tool descriptions are verbose and take up too much vertical space on small screens.
3. The category filter row (All, Communication, Files, Project Management, CRM, Calendar) wraps across two rows and feels overwhelming on mobile.

**Expected behavior:**  
Tool cards should stay compact on mobile with status text on a single line. Category filters should either scroll horizontally (single row) or show only the most relevant 3-4 on mobile. Descriptions can be shortened or hidden behind a "details" expand.

**Fix:**  
(1) Truncate "Not connected" to an icon + short badge or shorten to "Connect" only. (2) Limit the description to one line with `truncate` on mobile. (3) Make the category filter row `overflow-x-auto` with `whitespace-nowrap` so it scrolls horizontally instead of wrapping.

---

## BUG-004 - Chat AI claims it cannot access full Asana data when it can

**Status:** Open  
**Platform:** All  
**Area:** Chat / AI responses

**Description:**  
When asked about overdue Asana tasks, the AI responds that it only has access to a small snippet of tasks (e.g. 5 out of 199) and says it cannot check the full list. It then suggests the user needs to "index" more data - but Asana is already connected and the AI should be able to query it live via the Nango integration.

**Expected behavior:**  
The AI should know which tools are connected for the workspace and use the live Asana API to answer task queries, not rely on pre-indexed snippets. If it cannot query live, it should say "Asana is connected - let me search your tasks" and actually do it.

**Fix:**  
The system prompt or tool-calling logic for chat needs to (1) tell the AI which integrations are active for the workspace, (2) give it a tool call to query Asana tasks live rather than only searching the vector index, and (3) make the AI prefer live data over stale embeddings for time-sensitive queries like "overdue tasks".
