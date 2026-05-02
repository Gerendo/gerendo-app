# Gerendo - Running Notes

Read at session start. Update at session end. Keep this short - history goes to [docs/CHANGELOG.md](docs/CHANGELOG.md).

---

## Current state (2026-05-02)

- **Phase 0** - validation. All public infra is live: `gerendo.com` (marketing, Cloudflare Pages) and `app.gerendo.com` (Next.js, Vercel) both serve waitlists into Resend. Favicon, SEO metadata, and two-way email aliases all done.
- **What's blocking Phase 1:** 4-of-7 agency conversations confirming the same pain. Outreach work hasn't started. No app code yet, by design.

## Open

1. **Rotate Resend API key.** A full-access key was pasted in chat earlier (in conversation logs) and commit `4a9fd3a` suggests an env file was committed at some point. Revoke the current key, issue a new sending-scoped key, update Vercel + `.env.local` + the Gmail "Send mail as" SMTP configs. Optionally rewrite git history.
2. **Outreach.** Build 15-20 agency contact list. Draft `docs/INTERVIEW_SCRIPT.md` and `docs/OUTREACH_TEMPLATES.md`. Fill the four `[GINO: ...]` markers in `docs/BRIEF.md` (now likely `[ANDREI/ERMINA: ...]`).
3. **`terms.tsx` references Slack/Notion/Linear** as integrations - not on the v1/v2 roadmap. Prune or label "planned" before any enterprise call.
4. **Romanian-lawyer pass on `terms.tsx` + `privacy.tsx`** before signing first enterprise customer. Substance plausible but not vetted.
5. **DNS apex conflict on `gerendo.com`** - was an issue when adding the Cloudflare Pages custom domain. Status unclear; verify nothing's still broken.

## Don't do yet

- No Supabase schema until M1 (Week 4-5 of PLAN.md)
- No Stripe billing until Phase 3
- No local LLM / self-hosted model support (cut from BringYourAI deliberately)
- No Slack/Notion/Linear integrations until on the actual roadmap
- No cookie consent banner (Cloudflare Web Analytics is cookieless, GDPR-OK)

## Reference

- [docs/PLAN.md](docs/PLAN.md), [docs/BRIEF.md](docs/BRIEF.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/CHANGELOG.md](docs/CHANGELOG.md)
- Agency operational context: `~/Gerendo/CLAUDE.md`
