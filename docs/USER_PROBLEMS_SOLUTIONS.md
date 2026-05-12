# Gerendo: User Problems, Easy Solutions, Build Plan

*Drafted 2026-05-11. Revised with validation + step-by-step build 2026-05-12.*

*Source: validation interviews, QuickLeap observation, cold-email replies, [BRIEF.md](BRIEF.md), [INTERVIEW_SCRIPT.md](INTERVIEW_SCRIPT.md), [FORUM_POSTS.md](FORUM_POSTS.md).*

---

## How to read this document

For each of the 12 known user problems, you get four sections:

1. **Problem.** What the user actually said or did. Source + verbatim quote where possible.
2. **Validate (problem).** How to confirm this problem is still real for the target user before building. Specific interview question, survey item, or metric.
3. **Solution.** The lowest-friction way Gerendo can make the problem go away. One tap, where the user already is.
4. **Build (step-by-step).** Numbered, concrete dev tasks. File paths. Acceptance criteria.

Plus a **validate (solution)** row at the bottom of each section: the user-pain test, the success metric, and the threshold for "this actually works."

**Design rule (non-negotiable).** Every solution must be: one tap, in the channel the user is already in (push notification, email, chat). No new dashboard to check. No setup wizard beyond OAuth.

**Sequence rule.** Build order is optimized for *user pain closed per week*, not technical dependency. Security and OAuth submission run in parallel from week 1.

---

## The 12 known problems (overview)

| # | Pain | Source | Severity |
|---|------|--------|----------|
| P1 | **Decision drift.** Client changes deadline/scope in WhatsApp/email/Meet, Asana + brief + deck still show old. | BRIEF.md, QuickLeap obs, forum posts | Top wedge |
| P2 | **Colleague-went-quiet / accountability invisibility.** Blame falls on whoever gets pulled in last. | Sister (strong signal) | High |
| P3 | **Client not prepped for expected side effects.** Site launched, traffic dropped, no SEO-dip warning sent. | QuickLeap observation | High |
| P4 | **Decisions in silos.** Decision-maker knows; nobody else does. Tribal knowledge in 1-2 heads. | QuickLeap obs, INTERVIEW Q3 | High |
| P5 | **New hire ramp = 1-3 months.** Constant interruptions to senior staff. | BRIEF.md, INTERVIEW Q3 | Medium-high |
| P6 | **"What's happening, without a standup."** PM with 5 clients opens 6 tabs to answer one question. | Cold email, BRIEF.md | High |
| P7 | **Cross-tool search tax.** Hours hunting a decision across Meet / Slack / email. | LinkedIn forum, INTERVIEW Q4 | Medium |
| P8 | **Privacy / data fear (#1 objection, universal).** CTO approval blocker. | Every conversation | Hard requirement |
| P9 | **WhatsApp Business primary channel in EU/LatAm, zero tooling.** | BRIEF.md, FORUM post 5 | Phase 2 wedge |
| P10 | **Tool sprawl.** 25-person agency uses 12+ tools. Human is the search engine. | BRIEF.md | Macro frame |
| P11 | **Client request missed or implemented wrong.** Same root as P1. | INTERVIEW Q1, FORUM post 2 | Merges with P1 |
| P12 | **Enterprise-stack workaround.** Sister uses Slack + Outlook + spreadsheets, can only connect personal Google. | Sister conversation | Phase 2 expansion |

---

# P1. Decision drift → S1. Drift watcher with one-tap fix

## Problem

A client changes the deadline, scope, or a decision in WhatsApp, email, or on a Meet call. That change does not propagate to the Asana task, the brief in Drive, or the deck. Days later, the team ships the old version. The client either notices and is unhappy, or the team catches it at the last moment and burns hours fixing it.

Sample story (forum post 1): *"This week a client changed a deadline over WhatsApp, my PM updated the Asana task, the designer never saw it because she was working off the brief in Drive, and we shipped a day late."*

## Validate (problem)

Before building, confirm in 3 more agency conversations:

- **Interview Q (add to script section 2):** *"Last time a client changed their mind, walk me through who touched what tool, in what order. Where did the change get stuck?"*
- **Look for:** named tools, a specific time/money cost, an emotional charge ("ugh, that one").
- **Confirms problem:** if 3+ of the next 5 conversations describe a recent specific drift incident with named tools, P1 is locked.
- **Disconfirms:** if interviewees say "we have a standup, this never happens" or shrug, the wedge needs reframing.

## Solution: S1 drift watcher

Push notification within 60 seconds of the contradicting message arriving. Three one-tap actions: Yes, Edit, No. "Yes" writes the Asana update + posts a comment with source attribution + broadcasts a one-line FYI to project assignees.

## Build (step-by-step)

**Prerequisite:** baseline schema migration done (see Foundation section).

1. **Create `action_log` table** for auditability. Migration `20260513_action_log.sql`:
   ```
   id uuid pk, workspace_id uuid, drift_finding_id uuid fk,
   action_type text, target_system text, target_id text,
   payload_before jsonb, payload_after jsonb,
   executed_by uuid (user), executed_at timestamptz, status text
   ```
2. **Create action executor library.** New directory `src/lib/actions/`:
   - `src/lib/actions/asana.ts`: exports `updateTask(workspaceId, taskId, fields)` and `addComment(workspaceId, taskId, body, citationUrl)`. Uses Nango-stored Asana token. Throws on API error. Logs to `action_log`.
   - `src/lib/actions/index.ts`: registry mapping `{ "asana.update_task": asana.updateTask, "asana.add_comment": asana.addComment, ... }`.
3. **Add accept endpoint.** New `src/app/api/drift/[id]/accept/route.ts`:
   - POST handler reads the `drift_finding` row.
   - Calls `asana.addComment` with body = decision summary + Gmail message URL.
   - Calls `asana.updateTask` if the drift mentions a date/status change (parse from `decision_summary`).
   - Returns 200 with `action_log` IDs.
4. **Wire the "Yes" notification action.** Service worker [public/sw.js](../public/sw.js) already routes notification actions to fetch URLs. Update the push payload generator in [src/lib/decision-detector.ts](../src/lib/decision-detector.ts) so the "Yes" action POSTs to `/api/drift/[id]/accept`.
5. **Team broadcast on accept.** Inside `/api/drift/[id]/accept`:
   - Query `asana_items.assignees` for the matched task.
   - Filter to workspace members with active push subscriptions.
   - Call `/api/push/send` with a short FYI ("Launch moved to 15th. Source: Pescobar WhatsApp.") to each.
   - Skip the user who pressed Yes (no self-notify).
6. **Auto-register Asana webhook on connect.** Edit [src/app/api/auth/asana/route.ts](../src/app/api/auth/asana/route.ts) callback: after token exchange, POST to existing [src/app/api/webhooks/asana/register/route.ts](../src/app/api/webhooks/asana/register/route.ts). Deregister on disconnect.
7. **Undo path.** Add a "Undo" link in the post-accept push notification. POSTs to `/api/drift/[id]/undo` which reads `action_log.payload_before` and reverses.

## Acceptance

- Test email referencing a real Asana task triggers notification in <60s.
- Tap Yes: Asana due_date updated, comment posted with email link.
- Project assignees (excluding the actor) receive an FYI push within 10s of Yes.
- `action_log` has one row per write, with reversible payload.
- Undo restores prior state.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| Time from email arrival to notification fire | < 60s |
| Time from "Yes" tap to Asana state updated | < 5s |
| User does not open Asana to verify | "I trusted it" in 4/5 first uses |
| Weekly accept rate per PM | >= 2 |

**Critical test (week 5 with QuickLeap):** Bogdan gets a real drift notification. Taps Yes. Designer (Alex) sees the broadcast on his phone before opening Asana the next morning.

---

# P2. Colleague-went-quiet → S2. Silent-task watcher

## Problem

Someone on the team sits silently on a problem. Days pass. Eventually it surfaces, often at handoff or in front of the client. Blame lands on whoever gets pulled in last, not on the person who went quiet.

Sister verbatim: *"I get blamed for things that weren't my fault."*

## Validate (problem)

- **Interview Q (add to script):** *"When was the last time you found out about a problem on a project too late? Who knew about it first?"*
- **Confirms:** named person who went silent, time delay measured in days, downstream cost.
- **Phase 1 vs Phase 2 signal:** if 3+ agency conversations mention this independently, promote to Phase 1. Otherwise keep as Phase 2 expansion (team-lead angle, not agency wedge).

## Solution: S2 silent-task watcher

Server-side daily scan. For each task: if `last_activity > N days` AND `deadline_in < M days` AND `assignee != null`, soft-poke the assignee. If no response in 24h, escalate to team lead with a draft check-in message.

## Build (step-by-step)

**Prerequisite:** Asana webhook auto-registration (S1 step 6) so `last_activity_at` is fresh.

1. **Add `last_activity_at` to `asana_items`.** Migration `20260514_asana_activity.sql`. Backfill from existing comments/status changes.
2. **Update Asana sync to maintain `last_activity_at`.** Edit [src/app/api/sync/asana/route.ts](../src/app/api/sync/asana/route.ts) and the webhook handler: on any comment, assignee change, or status change, update `last_activity_at = now()`.
3. **Add `silent_pokes` table.** Migration `20260514_silent_pokes.sql`: `id, task_id, assignee_user_id, sent_at, replied_at, escalated_at`. Used to debounce repeat pokes.
4. **Create silent-scan cron.** New `src/app/api/cron/silent-tasks/route.ts`:
   - Runs daily 07:00 UTC.
   - SQL: select tasks where `last_activity_at < now() - interval '5 days' AND due_date < now() + interval '3 days' AND assignee_user_id IS NOT NULL AND no `silent_pokes` row in last 7 days`.
   - For each, call `/api/push/send` with payload: title "Task quiet", body "[task name] hasn't moved in 5 days, due in 3", actions: "Update", "Snooze", "Done".
   - Insert `silent_pokes` row.
5. **Add to [vercel.json](../vercel.json) crons.** `{ "path": "/api/cron/silent-tasks", "schedule": "0 7 * * *" }`.
6. **Escalation cron.** Same route, second pass: for each `silent_pokes` row >= 24h old with `replied_at IS NULL`, send a push to the team lead (workspace owner) with a draft check-in message body. Set `escalated_at`.
7. **Draft check-in generator.** Reuses Haiku 4.5 with prompt: "Draft a 1-line Slack-style check-in to [name] about [task] which has been quiet for [N] days." Cached prompt prefix.

## Acceptance

- Test task last touched 6 days ago, due in 2 days, generates a poke at 07:00.
- Assignee does not reply within 24h: team lead receives escalation with editable draft.
- Snooze suppresses pokes on that task for 7 days.
- "Done" marks task as complete in Asana via action executor.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| False-positive rate (poke when task was actually fine) | < 15% by week 3 |
| Tasks where poke triggered a reply within 24h | >= 60% |
| Reduction in "fire drill" reports from team leads | qualitative, weekly check-in |

**Critical test:** Sister tries the silent-task watcher with her team. Within 2 weeks, she names one specific incident where the poke caught something before it blew up.

---

# P3. Client side effects not prepped → S3. Milestone playbook

## Problem

The team ships something. Predictable side effects follow (SEO indexing dip after launch, slower ad ROI in first 2 weeks of a campaign, design proofs need 24h soak before client review). The client panics because nobody warned them.

Sample (QuickLeap direct observation): *"Built a website, client panicked when traffic dropped post-launch. Nobody warned them about the SEO indexing dip."*

## Validate (problem)

- **Interview Q:** *"Last time a client got surprised by something that you, internally, knew was normal. Walk me through it."*
- **Confirms:** named milestone (launch, campaign, design delivery), predictable side effect, missed warning.
- **Strong signal:** the interviewee has an SOP doc somewhere that lists "things to tell the client when you ship X" but nobody actually opens it.

## Solution: S3 milestone playbook

When Gerendo detects a milestone (Asana task moves to Done with milestone tag, or matching keyword in email/commit), it surfaces a pre-built playbook: "You just shipped X. Send the side-effects warning to the client?" One tap to send.

## Build (step-by-step)

1. **Add `playbooks` table.** Migration `20260515_playbooks.sql`:
   ```
   id uuid pk, workspace_id uuid, name text, trigger_type text
   (asana_status / keyword / cron), trigger_pattern text,
   template_subject text, template_body text, template_lang text,
   channel text (email / whatsapp), is_active bool
   ```
2. **Seed 3 playbooks via migration.**
   - "Website launch": trigger = Asana task status -> Done with tag `launch`, body = SEO-dip warning template.
   - "Campaign live": trigger = Asana task tag `campaign-launch`, body = first-2-weeks ROI expectations.
   - "Designs delivered": trigger = Asana task tag `designs-final`, body = client review SLA reminder.
3. **Trigger detector.** New `src/lib/playbooks.ts`:
   - `detectFromAsanaEvent(event)`: matches Asana webhook payloads against `playbooks.trigger_pattern`.
   - `detectFromMessage(message)`: keyword match in Gmail/WhatsApp content.
   - Returns matched playbook + extracted variables (client name, project name, asana task id).
4. **Wire into Asana webhook handler.** Edit [src/app/api/webhooks/asana/route.ts](../src/app/api/webhooks/asana/route.ts) (or create if missing): after sync, call `playbooks.detectFromAsanaEvent`. If match, queue a push notification.
5. **Notification payload.** Title: "Send the SEO-dip warning to [Client]?" Action: "Send" (POSTs to `/api/playbooks/[id]/send`).
6. **Send route.** New `src/app/api/playbooks/[id]/send/route.ts`:
   - Renders template with variables.
   - Sends via Resend (if channel=email) using PM's connected Gmail account (so it comes from them, not Gerendo).
   - Logs to `action_log`.
7. **Editable templates UI.** New `src/app/settings/playbooks/page.tsx`: list, edit, deactivate, create.

## Acceptance

- Move test Asana task to Done with tag `launch`. Within 60s, push notification fires.
- Tap Send. Email arrives at client inbox within 30s, signed by PM (not by Gerendo).
- Action logged. Can be undone by Gmail's standard "unsend" if within 30s.
- PM can edit the body inline before send.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| Notification fires on real milestone | 4/5 known milestones |
| Send rate (tap "Send" / notifications fired) | >= 50% by week 4 |
| Editing rate (open template, modify, send) | tracked for template quality |
| Client replies positively (anecdotal) | >= 1 quoted comment in first month |

---

# P4. Decisions in silos → S4. Decision log

## Problem

Decisions get made and only the decision-maker knows. Others don't know what was decided, who made the call, or who to ask. Knowledge stays in 1-2 heads.

## Validate (problem)

- **Interview Q (existing Q6):** *"If a magic assistant could answer one question across all your tools tomorrow morning, what question would you ask it?"* Look for: "what did we decide about X?", "who signed off on Y?"
- **Strong signal:** at least 1 question per PM per week today is "wait, when did we agree to that?"

## Solution: S4 decision log

Per-project timeline of every detected decision with source attribution. New hire opens project, sees full history. Weekly digest auto-emailed.

## Build (step-by-step)

1. **Generalize `drift_findings` to `decisions`.** Migration `20260516_decisions.sql`: rename or add view. Add columns: `project_id` (FK to Asana project), `decided_by` (user or external party name), `decided_at`, `source_type`, `source_url`, `summary`, `confidence`.
2. **Backfill project_id.** Match each decision to its referenced Asana task -> task.project_id.
3. **Decision list query.** Add to [src/lib/agency-db.ts](../src/lib/agency-db.ts): `listDecisionsForProject(workspaceId, projectId, limit)`.
4. **Per-project decisions page.** New `src/app/projects/[id]/decisions/page.tsx`:
   - Header: project name, total decisions count, decision rate per week.
   - Timeline: reverse-chronological, grouped by week.
   - Each entry: date, summary, source icon + link, decided-by chip.
   - Filter by source, by decider, search box.
5. **Projects list page.** New `src/app/projects/page.tsx`: list of active Asana projects with decision count.
6. **Weekly digest cron.** Reuses cron infra (see S6). Sends per-PM email Sunday 18:00: "5 decisions made this week across 3 projects."

## Acceptance

- After 1 week of QuickLeap usage, `/projects/[any]/decisions` shows 5+ entries with sources.
- Click source link, opens Gmail thread / WhatsApp message / Meet transcript in new tab.
- New hire (test account) opens project, gets oriented without asking anyone.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| Decisions captured per active project per week | >= 3 |
| Source link click-through rate | >= 30% (people verify) |
| New hire onboarding time (anecdotal) | < 1 month from 1-3 months |

---

# P5. New hire ramp → S5. New-hire mode

## Problem

New hire spends 1-3 months learning where information lives, constantly interrupting senior staff. Senior staff pays the tax in hours.

## Validate (problem)

- **Interview Q (existing Q3):** *"When a new person joined in the last 12 months, how did they learn what your team had done for ClientX in the past?"*
- **Confirms:** named senior person who did the training, hours-per-week cost, examples of tribal-knowledge clients.

## Solution: S5 new-hire mode

First login as a new workspace member: onboarding empty state with 6 starter questions auto-personalized to the workspace. Each question returns a cited answer in seconds. Senior staff is never interrupted.

## Build (step-by-step)

1. **Role-aware empty state in [src/app/ask/page.tsx](../src/app/ask/page.tsx).**
   - Query: `workspace_members` where `user_id = current` AND `created_at > now() - interval '14 days'` AND `role != 'owner'`.
   - If match, render onboarding empty state instead of default chat input.
2. **Starter question generator.** New `src/lib/onboarding-questions.ts`:
   - Fetch top 5 Asana projects by activity from `asana_items`.
   - Generate 6 question templates pre-filled with real client/project names:
     - "Who are our top 5 clients right now?"
     - "What did we deliver for [Client A] last year?"
     - "Who leads the [Project B] account?"
     - "What was decided on [Project C] last week?"
     - "What are our most common client deliverables?"
     - "Who do I ask about [Client D]?"
3. **Render as tappable cards.** Each card auto-runs the question through `/api/ask` on tap. Streamed answer with sources displays inline.
4. **"Mark as canonical onboarding doc" feature.** New flag `is_onboarding_canonical` on `drive_files`. Owner can mark docs from `/connect`. Boost in retrieval ranking (multiply BM25 score by 1.5) for queries made by new hires.

## Acceptance

- Invite a new test user. First `/ask` visit shows 6 starter questions.
- Tap each. Cited answer in < 3s.
- Senior staff member observes (anecdotally) fewer interruptions.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| New hire asks 6+ starter questions in week 1 | confirms uptake |
| New hire asks senior staff < 5 questions in week 1 | confirms displacement |
| Time to first independent client work | < 2 weeks (vs 1-3 months) |

---

# P6. "What's happening without a standup" → S6. Daily digest

## Problem

To know project status, PMs run a standup or ask multiple people. PM with 5 clients can't answer "latest on Acme?" without opening 6 tabs.

## Validate (problem)

- **Interview Q (new, add):** *"How do you find out what's happening on a project right now, without a standup?"* (This is literally the cold email subject.)
- **Confirms:** specific workaround (Slack ping, escalation, just hoping).

## Solution: S6 daily digest email

8am email per PM. Single page. One line per active client. Read on phone in 30 seconds.

## Build (step-by-step)

1. **Define digest data model.** New `src/lib/digest.ts`:
   - `buildDigest(userId)` returns: per active project, one of:
     - Latest decision (last 24h)
     - Silent task warning
     - Upcoming milestone (this week)
     - "No news, last activity X days ago"
2. **Render Markdown email.** Template: "Today's 3 things on your 5 clients: ..." Each line is plain text + one tappable URL.
3. **Cron route.** New `src/app/api/cron/daily-digest/route.ts`:
   - Runs 08:00 in user's tz (use `notification_prefs.timezone`, default Europe/Bucharest).
   - For each workspace member with `notification_prefs.daily_digest = true` (default true):
     - Build digest. If digest has < 1 actionable item, skip (no spam).
     - Send via Resend with subject "Gerendo digest. [N] things on your [M] clients."
4. **Mobile-first inline links.** Each digest line has a deep link: open Asana, draft message, snooze, "view in Gerendo". Deep links use `app.gerendo.com/inbox?item=X` pattern.
5. **Add to [vercel.json](../vercel.json) crons.** Schedule `0 6 * * *` UTC = 08:00 Europe/Bucharest in May. Note: timezone-correct only for one zone. Phase 2: per-user scheduling via Trigger.dev.
6. **Unsubscribe link.** Standard footer. Sets `notification_prefs.daily_digest = false`.

## Acceptance

- Tomorrow 08:00 (Bucharest): test user receives email.
- Read time < 30s, validated against 3 PMs.
- All 5 of their clients accounted for in one line each.
- Tap a line, opens the right Asana task / Gmail thread.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| Open rate | >= 70% (Resend reports) |
| Tap-through rate | >= 25% |
| "Replaces my standup" qualitative quote | from >= 1 QuickLeap PM by week 6 |
| Unsubscribe rate | < 10% |

---

# P7. Cross-tool search tax → S7. Ask-anything chat (already 80% built)

## Problem

PM digs through Gmail / Drive / Asana / Slack to find one specific thing. Sometimes gives up, asks someone, or recreates.

## Validate (problem)

Already validated. The cold email reply pattern confirms.

## Solution: S7 chat fixes

The chat exists. Two bugs kill trust. Fix them.

## Build (step-by-step)

1. **Fix BUG-002 (chat blocked unless all tools synced).** Edit [src/app/ask/page.tsx](../src/app/ask/page.tsx):
   - Remove the gate that disables the input.
   - Add an inline banner: "Connect [Asana / Drive] for richer answers."
   - Always allow asking; route to whatever tools are connected.
2. **Fix BUG-004 (AI claims limited Asana data).** Edit [src/app/api/ask/route.ts](../src/app/api/ask/route.ts):
   - System prompt change: enumerate active integrations explicitly. *"You have live access to: Gmail (search + fetch), Asana (list tasks, get task, list overdue), Drive (search docs)."*
   - Add a new tool: `asana_query_live({type: "overdue" | "by_assignee" | "by_project", filters})`. Implementation fetches from Asana API directly via Nango.
   - Update model selection: for queries containing `overdue / deadline / today / this week`, force live data path; bypass embedding search.
3. **Suggested-question chips on empty state.** Three chips: "Latest on [most active client]?", "What's overdue?", "Decisions made this week?". Generated from workspace activity.
4. **Mobile polish.** Re-verify BUGs 001, 005, 006, 009, 010 against [docs/QA_CHECKLIST.md](QA_CHECKLIST.md) §11. Fix any regression.

## Acceptance

- Connect Gmail only. Ask "what's overdue in Asana?". Response says "Asana not connected, here's how to connect" (not "I have 5 of 199 tasks").
- Connect both. Ask same. Response is a real list of overdue tasks pulled live.
- Empty state shows 3 suggested-question chips matching the workspace's actual clients.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| "AI lied to me about Asana data" reports | 0 after fix |
| Suggested-question tap rate | >= 40% of first sessions |
| Mobile chat usability (no zoom, hamburger works) | confirmed on iPhone + Android |

---

# P8. Privacy / data fear → S8. Trust-first UX

## Problem

Universal #1 objection across every conversation. Sister: monitored devices, CTO approval blocker. Designer: "we can't do that." Boyfriend: privacy concerns despite being technical.

## Validate (problem)

Already validated, but quantify:

- **Survey on every cold-email reply:** *"On a scale of 1-5, how much would data privacy concerns block you from trying a tool like this?"*
- **Track:** % of waitlist signups who click "Read security one-pager" before completing OAuth.

## Solution: S8 trust-first UX

Lead with privacy on the homepage. Make the privacy story tappable, downloadable, and verifiable everywhere data appears.

## Build (step-by-step)

1. **Update marketing hero in `agency-brain-ai-main/`.**
   - Edit hero copy: **"Your data stays in the EU. We never train on it. Even our engineers can't read your messages (Postgres RLS)."**
   - Add 3 trust badges: "EU-hosted", "Zero training", "RLS-enforced".
   - File: marketing `agency-brain-ai-main/src/components/Hero.tsx` (or equivalent).
2. **Per-integration scope text on Connect page.** Edit [src/app/connect/page.tsx](../src/app/connect/page.tsx):
   - Below each integration card, two lines:
     - *Read:* "Gmail messages and metadata. We never send mail from your account."
     - *Write:* "Only when you tap a notification action (e.g., update Asana task). Every write is logged."
3. **Per-message provenance badge.** New `src/components/ProvenanceBadge.tsx`:
   - Shows: source icon, "Found in your Gmail", "EU-hosted", encryption icon.
   - Renders in chat answers next to each citation.
4. **Security one-pager PDF.** Static asset at `public/gerendo-security.pdf` (generate once from a Markdown source). Covers: data residency, RLS policy summary, no-training commitment, retention policy, deletion flow, SOC 2 path, GDPR DPA contact.
5. **"Download for your IT team" CTA.** On Connect page + Settings. Pre-filled link tagged with `?utm=cto`.
6. **Revoke and delete button.** In [src/app/settings/page.tsx](../src/app/settings/page.tsx):
   - "Revoke [Integration]" button per tool. Disconnects + deletes all data from that source within 30s. Confirmation modal.
   - "Delete workspace" button. Confirmation requires typing workspace name.
7. **DPA template.** Static asset `public/gerendo-dpa.pdf`. Lawyer-reviewed in Phase 3.

## Acceptance

- Open homepage on mobile. First viewport (no scroll) shows EU + RLS + no-training claim.
- From `/connect`, download security PDF. Hand to a non-technical CTO. CTO can decide in < 2 min.
- Tap revoke on Gmail. Data is gone within 30s. Verify in Supabase that `messages` rows for that user are deleted.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| Waitlist conversion (after seeing hero) | >= 8% (was unmeasured) |
| % of pilot users who download security PDF | >= 40% |
| CTO approval time (sister test) | < 10 min |
| Privacy mentioned as blocker post-onboard | 0/3 in first design partners |

---

# P9. WhatsApp Business → S9. WhatsApp connector (Phase 2)

## Problem

In EU/LatAm, day-to-day client comms live in WhatsApp Business. The decision happens there. The project plan is in Asana. US-built tools ignore it.

## Validate (problem)

- **Interview Q (existing Q2):** *"What channel did the client use? Email, WhatsApp, call, in-meeting?"*
- **Confirms:** 4+ of next 5 EU/Romanian conversations say WhatsApp.
- **Sets Phase 2 wedge timing:** if WhatsApp shows up in <40% of conversations, defer further.

## Solution: S9 WhatsApp connector

Same notification flow as S1, with WhatsApp as a new source. "Yes" can also offer "Reply to client in WhatsApp" with a draft.

## Build (step-by-step, Phase 2)

1. **Set up Meta Business account.** Use QuickLeap's WhatsApp Business as the first test number.
2. **Configure Nango WhatsApp Business OAuth.** New connector. Scopes: `whatsapp_business_messaging`, `whatsapp_business_management`.
3. **Webhook receiver.** New `src/app/api/webhooks/whatsapp/route.ts`. Receives Meta webhook events. Stores incoming messages to new `whatsapp_messages` table (workspace_id, contact_id, body, direction, timestamp).
4. **Embed + index** same pipeline as Gmail. Reuse [src/lib/embed.ts](../src/lib/embed.ts).
5. **Drift detector on WhatsApp.** Extend [src/lib/decision-detector.ts](../src/lib/decision-detector.ts) to consume `whatsapp_messages` source.
6. **WhatsApp reply action.** New `src/lib/actions/whatsapp.ts`: `sendMessage(workspaceId, contactId, body)`. Calls Meta Cloud API.
7. **Notification UX update.** "Yes" action on a WhatsApp-sourced drift offers both: (a) update Asana, (b) reply to client.
8. **White-glove setup wizard.** First 3 customers: manual onboarding (Gino walks them through Meta Business setup on a call). Self-serve wizard in week 12.

## Acceptance

- Send a test WhatsApp Business message containing a deadline change.
- Drift detector fires within 60s.
- Tap Yes: Asana updated AND draft reply ready.
- Tap "Send reply": message sent from agency's WhatsApp Business number.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| WhatsApp-sourced drifts as % of all drifts | >= 30% in EU agencies |
| Reply send rate | >= 50% of "Yes" taps |
| "Saved me from switching apps" qualitative | quote from >= 1 design partner |

---

# P10. Tool sprawl → S10. Universal inbox

## Problem

25-person agency uses 12+ tools. Human is the search engine. Even after Gerendo, notifications arrive across push / email / digest. Need one place to see everything.

## Validate (problem)

- **Post-S1 + S6 ship:** observe whether QuickLeap PMs ask "where do I see all my notifications?" If yes, build S10.
- **Anti-validation:** if push + digest is enough and nobody asks for a unified view, defer.

## Solution: S10 universal inbox

Single feed at `/inbox`. Every notification source lands here. Each item has 1-3 actions.

## Build (step-by-step)

1. **Add `inbox_items` table (or view).** Migration `20260601_inbox.sql`. Polymorphic source: `source_type` (drift / silent_task / milestone / decision / digest_summary), `source_id`, `workspace_id`, `user_id`, `title`, `body`, `actions jsonb`, `status` (new / read / actioned / snoozed / dismissed), `created_at`.
2. **Write hook.** Every notification-creating service (drift detector, silent-task cron, playbook trigger, daily digest) also inserts an `inbox_items` row.
3. **Inbox page.** New `src/app/inbox/page.tsx`:
   - Reverse-chronological list, grouped: Today, This week, Older.
   - Each item: status pill, title, body preview, source icon, action buttons.
   - Snooze (1h / tomorrow / next week). Dismiss. Mark done.
4. **Real-time updates.** Supabase Realtime subscription on `inbox_items` for current user.
5. **Bell icon in nav.** Shows unread count. Click opens `/inbox`.

## Acceptance

- After 1 week of QuickLeap usage, `/inbox` shows >= 20 items across all source types.
- Snooze works: item disappears, reappears at snooze time.
- Bell count matches unread.

## Validate (solution)

| Metric | Threshold |
|--------|-----------|
| Daily active inbox openers / total active users | >= 60% by week 7 |
| Actions taken from inbox / actions taken overall | >= 40% |
| "I check inbox instead of email" qualitative | from >= 1 PM |

---

# P11. Client request missed → covered by S1

## Problem

Same root cause as P1. Implementation differs only in source (any inbound channel).

## Validate / Solution / Build

Reuse S1. No separate build.

---

# P12. Enterprise stack → S11. Microsoft / Outlook / Slack (Phase 2+)

## Problem

Sister-pattern user: Microsoft 365 + Slack + monitored devices. Can't connect personal Google to corporate data. Needs enterprise connectors.

## Validate (problem)

- Defer validation until agency wedge is proven.
- Then survey design partners + waitlist for stack mix. If >= 30% Microsoft-stack, build S11.

## Solution: S11 enterprise connectors

Same OAuth flow as Google. Same notification flow. New connectors via Nango.

## Build (step-by-step, Phase 2+)

1. Microsoft 365 OAuth via Nango (Outlook mail, OneDrive, Teams).
2. Slack OAuth (bot install in workspace).
3. Reuse all existing infra: sync, embed, drift detect, notifications, actions.
4. Action executor expansion: `outlook.send_message`, `slack.post_message`.

Deferred. No detailed step-by-step until validation gate met.

---

# Foundation work (week 1, parallel to everything)

These are not user-facing but block multiple builds. Do them first.

## F1. Rotate Resend API key (P0 security)

1. Revoke current key in Resend dashboard (https://resend.com/api-keys).
2. Issue new key scoped to `sending:write` only (no admin).
3. Update Vercel env vars: `RESEND_API_KEY`.
4. Update local `.env.local` and Gmail SMTP "Send mail as" configs.
5. Audit commit `4a9fd3a`. If the key shipped in git history: rewrite history with `git filter-repo --invert-paths --path .env`. Force-push. Notify any collaborators.

**Acceptance:** `git log -p | grep -i 're_'` returns nothing. New key sends test email successfully.

## F2. Submit Google OAuth verification (~3-week clock)

1. Google Cloud Console > APIs & Services > OAuth consent screen.
2. Fill out: app name, support email, logo, privacy policy URL (https://gerendo.com/privacy), TOS URL.
3. Add scopes used: `gmail.readonly`, `drive.readonly`, `userinfo.email`, `userinfo.profile`.
4. Justification per scope (1-2 sentences each).
5. Record a 1-min demo video showing data usage.
6. Submit for verification. Track in Google Cloud Console.

**Acceptance:** verification submitted, status shows "In review" in Google Cloud Console. Re-check weekly.

## F3. Baseline schema migration

1. Use `supabase db dump --schema public > supabase/migrations/20260512_baseline.sql`.
2. Strip any keys / sensitive content. Add column comments.
3. Add a `migrations/README.md` documenting the policy: every schema change from now on must be a numbered migration.
4. Verify with `supabase db push --dry-run` on a fresh staging project.

**Acceptance:** all current Supabase tables represented in `supabase/migrations/`. New project can be created from migrations alone.

## F4. Type fix: `asana_items.user_id` text -> uuid

1. Migration `20260512_fix_asana_user_id.sql`. Add new column `user_id_new uuid`. Backfill from `user_id::uuid` where parseable. Drop old. Rename new.
2. Update [src/lib/agency-db.ts](../src/lib/agency-db.ts) types.
3. Run on staging, verify no row loss. Then prod.

**Acceptance:** `asana_items.user_id` is uuid. All queries still pass.

## F5. DNS apex on gerendo.com

1. Use `dig gerendo.com` and `dig MX gerendo.com`.
2. Confirm: A record points to Cloudflare Pages, MX points to Cloudflare Email Routing, SPF/DKIM/DMARC valid via `mxtoolbox.com`.
3. Test outbound: send a Resend email from `noreply@gerendo.com`. Verify SPF pass.

**Acceptance:** clean MX setup, no apex conflicts, test email lands without spam flag.

---

# Sequencing roadmap (week-by-week)

Optimized for user pain closed per week.

## Week 1 (now, 2026-05-12 to 2026-05-18)

**Track 1 (foundations):** F1, F2, F3, F4, F5.
**Track 2 (trust):** S8 steps 1-7.
**Track 3 (chat fixes):** S7 steps 1-4.
**Track 4 (validation):** contact 2 warm agency-founder leads. Hit 4/7 interview gate by EOW.

End-of-week state: no exposed secrets, OAuth in Google review queue, schema is in migrations, trust story leads the funnel, chat doesn't lie about data, Phase 1 validation gate cleared.

## Week 2

**Track 1:** S1 steps 1-7 (drift write-back fully working).
**Track 2:** Asana webhook auto-reg (S1 step 6 expanded).
**Track 3:** continue cold outreach, process replies.

End-of-week: PM gets a notification, taps Yes, Asana updates, team gets broadcast. Demo-ready.

## Week 3

**Track 1:** S4 steps 1-6 (decision log) + S6 steps 1-6 (daily digest).
**Track 2:** validate digest with sister + boyfriend (the existing testers).

End-of-week: 8am digest replaces standup. Per-project decision timelines populated.

## Week 4

**Track 1:** S5 steps 1-4 (new-hire mode) + S2 steps 1-7 (silent-task watcher).
**Track 2:** final QuickLeap onboarding prep. Verify mobile bugs from BUGS.md §11.
**Track 3:** Google OAuth verification approved (or escalation).

End-of-week: pilot-ready. Anyone can sign up without whitelist.

## Week 5 (QuickLeap kickoff)

**Track 1:** Bogdan + Alex + George onboarded.
**Track 2:** daily 10-min check-ins for first 5 days.
**Track 3:** instrument every notification + chat session via PostHog.

End-of-week: baseline usage measured.

## Weeks 6-7

**Track 1:** S3 steps 1-7 (milestone playbooks) + S10 steps 1-5 (universal inbox).
**Track 2:** tune detector thresholds on real QuickLeap signal.
**Track 3:** recruit 3 design partners for Phase 2.

End-of-week 7: full feature surface live. 3+x/week usage confirmed for 1 week.

## Weeks 8-9 (pilot success criterion)

**Track 1:** sustain 3+x/week usage for 2nd consecutive week.
**Track 2:** WhatsApp Business connector scoping (S9).
**Track 3:** 3 design partners signed.

End-of-week 9: Phase 1 -> Phase 2 gate cleared per [PLAN.md](PLAN.md) line 47.

---

# Critical files (single reference table)

| Area | File |
|------|------|
| Drift write-back, action executor | new `src/lib/actions/*.ts`, [src/lib/decision-detector.ts](../src/lib/decision-detector.ts), new `src/app/api/drift/[id]/accept/route.ts` |
| Chat fixes | [src/app/api/ask/route.ts](../src/app/api/ask/route.ts), [src/app/ask/page.tsx](../src/app/ask/page.tsx) |
| Trust UI | [src/app/connect/page.tsx](../src/app/connect/page.tsx), new `src/components/ProvenanceBadge.tsx`, marketing hero in `agency-brain-ai-main/src/` |
| Decision log | new `src/app/projects/[id]/decisions/page.tsx`, [src/lib/agency-db.ts](../src/lib/agency-db.ts) |
| Daily digest | new `src/app/api/cron/daily-digest/route.ts`, new `src/lib/digest.ts` |
| Silent-task watcher | new `src/app/api/cron/silent-tasks/route.ts` |
| Playbooks | new `src/lib/playbooks.ts`, new `src/app/settings/playbooks/page.tsx`, migration `20260515_playbooks.sql` |
| Inbox | new `src/app/inbox/page.tsx`, migration `20260601_inbox.sql` |
| Asana webhook auto-reg | [src/app/api/webhooks/asana/register/route.ts](../src/app/api/webhooks/asana/register/route.ts), [src/app/api/auth/asana/route.ts](../src/app/api/auth/asana/route.ts) |
| Schema baseline | new `supabase/migrations/20260512_baseline.sql` |
| Onboarding | new `src/lib/onboarding-questions.ts`, [src/app/ask/page.tsx](../src/app/ask/page.tsx) |

---

# Verification matrix (one row per solution)

| Solution | Validate problem (interview / signal) | Validate solution (acceptance) | Success metric | Threshold |
|----------|---------------------------------------|--------------------------------|----------------|-----------|
| S1 drift | 3/5 interviews describe specific drift incident | Real drift -> Yes tap -> Asana updates + team broadcast within 10s | Weekly accept rate per PM | >= 2 |
| S2 silent | "Found out too late" question gets specific stories | Test task quiet 6d -> poke at 07:00, escalation 24h later | Reply rate within 24h | >= 60% |
| S3 milestone | Has SOP but nobody opens it | Test task -> Done -> notification -> "Send" tap -> email lands | Send rate | >= 50% |
| S4 log | Q6 magic-question patterns include "what did we decide" | 5+ decisions per project after 1 week | Source click-through | >= 30% |
| S5 onboard | Q3 named senior person and tribal-knowledge clients | New test user asks 6+ starter Qs, < 5 senior interruptions | TTFR (time to first independent work) | < 2 weeks |
| S6 digest | Cold email subject resonates ("without a standup") | Email arrives 08:00, < 30s read, all clients accounted for | Open rate | >= 70% |
| S7 chat | Already validated. | Connect Gmail only -> overdue Asana query -> clear "not connected" response | "AI lied" reports | 0 |
| S8 trust | Universal #1 objection in every conversation | Homepage hero shows EU + RLS + no-training in first viewport. CTO approves < 10 min | Privacy as blocker post-onboard | 0/3 partners |
| S9 WhatsApp | 4/5 EU interviews name WhatsApp | Phase 2 test number -> drift detect -> Yes -> reply | WhatsApp-sourced drifts | >= 30% |
| S10 inbox | QuickLeap asks "where are all my notifications?" | Inbox shows 20+ items across sources after 1 week | DAU on inbox | >= 60% |
| S11 enterprise | Defer until agency proven. >= 30% stack-mix signal | Phase 2+ | n/a | n/a |

---

# What's deliberately out of scope (and why)

- **Discord, Notion, Slack, ClickUp, Monday, HubSpot.** No user pain we've captured requires them. Add when 3+ customers ask unprompted (per [PLAN.md](PLAN.md) Phase 5).
- **Local-first architecture.** May 2 [_notes.md](../_notes.md) floated this. The privacy story (S8) handles the same objection without operational complexity.
- **Per-seat billing, SSO, SOC 2.** Phase 3+. Workspace pricing is intentionally non-enterprise.
- **Native mobile apps.** Push + responsive web is enough through 25 paying customers.
- **Multi-language UI.** English only. Voyage-3 handles Romanian content. UI strings stay English until a partner asks.
- **AI agents that take actions without human confirmation.** Every write-back requires a human tap. No autonomy until trust is earned.

---

# Open decisions still to lock

These are not blockers, but should be answered before week 2:

1. **Notification quiet hours default.** 22:00 - 07:00 in user's tz? Or full opt-in?
2. **Digest tz default.** Europe/Bucharest (Gino) or per-user from browser at signup?
3. **Action_log retention.** 90 days? 1 year? Forever?
4. **Onboarding canonical doc tagging.** Who can mark? Owner only, or any workspace member?
5. **Drift confidence threshold.** Currently Layer 2 Haiku fires on YES; Layer 3 Sonnet extracts. What's the false-positive ceiling we accept? Suggest: < 15% on Layer 2, < 5% on Layer 3.
