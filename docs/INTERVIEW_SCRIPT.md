# Interview Script — Phase 0 Validation Calls

Goal: in 20 minutes, learn whether this agency feels the "information scattered + drift" pain *acutely enough to pay to solve it*. Not whether they like the idea.

**Format:** 1-on-1 call, 20 min hard cap, audio recorded with permission. Take notes on a single doc per call.

**Mom Test rules:**
- Ask about their life and past behavior, never your idea
- Specifics > generalities. "Last time X happened" beats "do you usually X"
- After they answer, shut up. Silence makes them keep going
- Time and money commitments they've already made > opinions about the future
- If they ask what you're building, deflect: "I'll share once I've talked to enough folks — I don't want to bias your answers"

---

## Pre-call (2 min)

> "Thanks for the time. Quick framing — I'm not pitching anything today. I'm trying to understand how agency teams actually deal with information across tools. I'll ask about specific moments in the last few months. Sound good if I record so I don't have to scribble?"

Record agency basics first:
- Agency size (people)
- Roles on call (PM, owner, ops, designer, etc.)
- Tools used daily (let them list — *don't* prompt with names)
- Number of active clients per PM
- Geography (matters for WhatsApp angle)

---

## The 7 questions

### 1. Walk me through the last project where something fell through the cracks.

Probe for:
- What was the thing that fell through?
- Where was the original info? Where was it *supposed* to be?
- Who noticed? When?
- What did it cost — hours, money, client trust?

> Listen for: a real story with specific tools named, real time/money cost, emotional charge ("ugh, that one").
> Red flag: vague "yeah it happens sometimes" with no specifics → this isn't a top-3 pain for them.

---

### 2. Last time a client changed their mind mid-project — how did the change make it from their head to your team's hands?

Probe for:
- What channel did the client use? (Email, WhatsApp, call, in-meeting)
- Who received it first?
- How did they tell the rest of the team?
- Did the project tool (Asana/ClickUp/etc.) get updated? By whom? How long after?
- Was the right person looking at the right place at the right time?

> This is the **drift question**. Listen for the gap between "client said it" and "team acted on it."

---

### 3. When a new person joined in the last 12 months, how did they learn what your team had done for ClientX in the past?

Probe for:
- How long until they could answer a basic client-history question without asking someone?
- Who paid the tax — was someone training them full-time?
- Did they Slack/DM senior people constantly? How often?
- Are there any clients where the "tribal knowledge" lives in 1–2 people's heads only?

> This is the **onboarding tax** question. Hours of senior people = real money.

---

### 4. Tell me about the most recent time you had to dig through email/Drive/Slack to find something specific. What was it, and how long did it take?

Probe for:
- Specific search — what were they looking for?
- How many tools did they check?
- Did they find it? Did they give up and ask someone? Did they recreate it?
- How often does this happen — daily, weekly, monthly?

> Pure pain measurement. If they shrug, the pain isn't sharp.

---

### 5. What's the worst tool problem you've actually paid money to solve in the last 12 months?

Probe for:
- What tool? What did it cost?
- Who pushed for it — owner, ops, team?
- Did it actually solve the problem?
- What problem are they currently *not* paying to solve, even though it bugs them?

> **Money already spent is the strongest signal.** Tools they pay for tell you what category of pain they treat as real.

---

### 6. If a magic assistant could answer one question across all your tools tomorrow morning, what question would you ask it?

Probe for:
- The exact question, in their words.
- Why that one — what triggered it?
- How do they answer it today (or do they not)?
- Who else on the team needs the same answer?

> One acceptable hypothetical. The *content* of the question reveals what they actually need. Watch for repeated patterns across calls.

---

### 7. Who else at your agency feels this same pain — and who would push back on a tool that tried to fix it?

Probe for:
- Names + roles of allies
- Names + roles of skeptics ("the one who'd say 'we have Notion, why do we need this'")
- Who controls the budget for tools?
- Who's the person whose day this would actually save?

> Maps the buying committee. Tells you who to talk to next + who'd block a sale.

---

## Close (2 min)

> "Last thing — would it be okay if I came back to you in a few weeks once I've talked to more agencies? I want to share what I'm learning. And if I do end up building something, would you be open to a 30-min look at an early version?"

If yes → ask for a warm intro to one peer agency:

> "One favor — is there one other agency owner or PM you'd intro me to? Same kind of conversation, no pitch, 20 minutes. Doesn't have to be today."

Warm intros are the unlock for the contact-list bottleneck.

---

## Post-call (10 min, same day)

Write up in `docs/interviews/YYYY-MM-DD-<agency>.md` (folder TBD):

1. **Top 3 quotes** — verbatim, with timestamps
2. **Tools they use** — full list
3. **Pain ranking** — what bugs them most? Drift / onboarding / search / something else?
4. **Money signal** — what have they paid for? What would they pay for?
5. **The "magic question"** they'd ask the assistant (Q6 verbatim)
6. **Verdict** — confirms the wedge / partial / disconfirms / new direction
7. **Follow-up** — owe them anything? Permission to come back?

---

## Tracking the gate

Phase 0 → Phase 1 gate (from CLAUDE.md): **4 of 7 confirm the same pain.**

"Same pain" = at minimum:
- A specific recent story of info-loss between tools
- Real time/money cost named
- Acknowledgement that no current tool solves it for them

Track in a single sheet: `interview_log.csv` — agency, size, date, primary pain, magic question, verdict, paying signal Y/N.

When 4 of 7 hit "confirms" → green light to Phase 1 (MVP build).

If you hit 7 calls and only 1–2 confirm → **stop and reframe**. The wedge is wrong, or you're talking to the wrong agencies, or both. Don't power through.
