# Gerendo — Product Brief

*v0 draft — 2026-04-28. Edit freely. `[GINO: ...]` markers flag spots that need your input.*

---

## One-liner

Gerendo turns your agency's scattered tools into a single brain your whole team can ask questions to.

---

## The problem

Marketing agencies run on fragmented information. A client brief lands in Gmail. The project plan lives in Asana. Designs sit in Figma. Final assets land in Drive. Calls happen in Meet. And in the EU and LatAm, day-to-day client comms increasingly happen in WhatsApp Business.

Nothing reconciles them. So:

- A client says "push the launch to the 15th" in WhatsApp on Tuesday. Friday, the Asana task still shows the old date and the deck shows the old date.
- A new hire spends 1–3 months learning where information lives before they're useful.
- A project manager running 5 clients in parallel can't answer "what's the latest on Acme?" without opening six tabs.

> [GINO: insert one concrete drift story here — ideally from QuickLeap or an agency you know personally. "Last month at [agency], [client] changed X in WhatsApp on [day], but the [deck/Asana task/brief] still showed Y on [later day], and it cost [time/credibility/€]." Real anecdote beats abstract pitch.]

The pain has a name internally: **drift**. Nobody owns reconciliation, so it doesn't happen.

---

## Target customer

**15–50 person marketing agencies** using Gmail + Google Drive + Asana + Google Meet, plus WhatsApp Business (EU/Romanian/LatAm) or Discord (creative/dev shops).

Roles we serve: project managers (scope, timelines, client questions), designers, developers, strategists. The PM is the wedge — they feel drift first.

**Not the target:** sub-15-person teams (too small to feel the pain), Fortune 1000 (Glean's market).

---

## What Gerendo does

Three things, in order of value:

1. **Ask anything, get cited answers.** "What did Acme decide about the homepage hero?" returns the answer with links to the Gmail thread, WhatsApp message, and Asana comment it came from.
2. **Proactive drift alerts.** When the system notices a contradiction — client said one thing in WhatsApp, the Asana task still says another — it surfaces the conflict before it ships.
3. **Onboarding compression.** New hires query the agency's full memory instead of interrupting senior staff. Days, not months.

All of this runs across Gmail (per-user), Google Drive, Asana, Meet transcripts at v1; WhatsApp Business and Discord at v2.

---

## Why now

> [GINO: pick one of these to lead with — or write your own. The other two become supporting points.]

- **WhatsApp Business is now the default client channel in EU/LatAm**, and US-built tools (Glean, Notion AI, Slack AI) ignore it entirely. The geographic gap is real and closing fast.
- **LLM inference costs dropped enough in 2025–2026** that per-workspace economics work at €299–€1,499/mo without per-seat pricing — agencies can finally afford this class of tool.
- **Agency tool sprawl crossed a threshold post-2024** — the average 25-person agency now uses 12+ tools, and the human cost of reconciliation has become the limiting factor on growth.

---

## Why us

> [GINO: 1–2 sentences. Something like: "I run [QuickLeap], a [size]-person marketing agency. I live this pain every week. I've already mapped how agency work flows — see Gerendo's internal SOPs — and I know which integrations matter and which don't. Most SaaS founders building for agencies have never run one."]

---

## What it's not

- Not a dashboard. The system surfaces; humans don't go check screens.
- Not a workflow tool. Agencies live in Asana/Notion/ClickUp/Monday — Gerendo integrates, doesn't replace.
- Not enterprise software. No 6-month sales cycle, no SOC 2 in v1, no SSO gating.
- Not per-seat. Workspace pricing (€299 / €699 / €1,499) — easier to swallow for small teams.

---

## Differentiation

| | Glean | Notion AI / Slack AI | Onyx (open source) | **Gerendo** |
|---|---|---|---|---|
| Cross-tool reasoning | ✅ | ❌ (one tool) | ✅ | ✅ |
| Serves 15–50 person agencies | ❌ (F1000) | partial | ⚠️ DIY setup | ✅ |
| WhatsApp Business native | ❌ | ❌ | ❌ | ✅ |
| Proactive drift alerts | ❌ | ❌ | ❌ | ✅ |
| Self-serve OAuth onboarding | ✅ | ✅ | ❌ | ✅ |
| Workspace pricing | ❌ per-seat | ❌ per-seat | n/a | ✅ |

---

## Stage and ask

Phase 0 — validation. We're talking to 15–20 agencies to confirm the drift wedge before writing product code. Gate to advance: 4 of 7 conversations confirm the same pain.

If you run or work at a 15–50 person marketing agency: 20 minutes of your honest experience would be the most valuable thing you could give us. No demo, no pitch — we want to hear how your team actually handles client comms across tools today.

> [GINO: contact line — `gino@gerendo.com`? `app.gerendo.com/waitlist`? Pick one.]
