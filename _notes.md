# Gerendo SaaS — Running Session Notes

Read this at the start of every session. Update it at the end of every session.

---

## Last session: 2026-05-02 (favicon, copy polish, email aliases two-way)

### What got done

- **Favicon shipped.** `Gerendo-Favicon.png` (italic G) dropped into both `public/` (Next.js app) and `agency-brain-ai-main/public/` (marketing). Wired via `<link rel="icon">` in `__root.tsx` and `metadata.icons` in `src/app/layout.tsx`. Committed `925146a`.
- **Final SEO metadata pass on `__root.tsx`** committed (had been local-only): "Gerendo - One brain for your whole business" title, og:url, removed Lovable og:image / `@Lovable` twitter:site, aligned description with hero copy.
- **Em dash purge.** Founder doesn't want em dashes anywhere in marketing copy ("so AI"). Replaced every `—` with single `-` across `agency-brain-ai-main/src/` (titles, meta, body, AskDemo, all legal pages). CSS custom properties left alone. Committed `1da736a`. **Lock this in:** no em dashes in any future Gerendo copy.
- **Email aliases set up two-way (Cloudflare Routing in + Resend SMTP out via Gmail).**
  - Cloudflare Email Routing inbound: `ermina@`, `contact@`, `privacy@`, `legal@`, `thankyou@` all forward to `tomagino28@gmail.com`.
  - Gmail filters: one per alias, matching on `to:<alias>@gerendo.com`, applies a label of the same name.
  - Gmail "Send mail as" configured for ermina + contact (and likely privacy + legal) using Resend SMTP (`smtp.resend.com:465`, username `resend`, password = Resend API key, SSL, "Treat as alias" UNCHECKED).
  - Reply-from-same-address radio enabled in Accounts and Import.
  - Net effect: Gino can send and receive from any `@gerendo.com` alias inside his existing Gmail UI — no Google Workspace needed.

### Current phase

**Phase 0 - validation. Infra fully done** (both waitlists live, favicon, SEO metadata, two-way email). Outreach work is now the only thing standing between us and Phase 1.

---

## Old open questions (status)

1. ✅ **Favicon** - shipped this session.
2. ✅ **Cloudflare Email Routing aliases** - added ermina/privacy/legal this session.
3. **DNS conflict on apex** - status unknown, may already be resolved since gerendo.com serves the marketing site. Verify if anything is still failing.
4. ⚠️ **Rotate Resend API key** - STILL OPEN. Reminder given again this session before pasting into Gmail SMTP. Confirm with Gino that the key now in Vercel + `.env.local` + Gmail SMTP configs is the rotated one, not the original.
5. **Slack/Notion/Linear in `terms.tsx`** - still references them. Prune or label "planned" before any enterprise call.
6. ✅ **Cookies/analytics decision** - locked.
7. **Romanian-lawyer pass on legal pages** - still pending; needed before first enterprise signup.
8. **Phase 0 outreach work** - unchanged. Still need 4-of-7 agency conversations.

---

## Older sessions

### 2026-04-29 → 2026-05-02 (waitlist sites live)

### What got done

- **Locked the brand.** Warm-ink palette (`#0E0F12` / `#F6F4EE` / `#E8A33D` ember), Fraunces (display) + Inter (body) + JetBrains Mono (Lovable site). Wordmark = "Gerendo" in Fraunces 600 with amber dot. Standalone mark = italic Fraunces "G" in amber rounded square.
- **Built `app.gerendo.com`** (Next.js 16 / Turbopack at the root of `gerendo-app` repo). Single waitlist landing — wordmark, hero, 3-bullet feature list, email form. Deployed on Vercel.
- **Built `/api/waitlist` route** with Resend integration: contacts.create into the General audience + emails.send transactional welcome. CORS headers `*` so cross-origin works. Lazy-init pattern for Resend client (env vars read inside handler — important to not break Vercel's "collect page data" build pass).
- **Brought in the Lovable-built marketing site** at `agency-brain-ai-main/` (TanStack Start + Vite + Tailwind 4 + framer-motion, scaffolded for Cloudflare Pages). Connected via Cloudflare Pages, root dir = `agency-brain-ai-main`, build cmd `npm run build`, output `dist`. Deployed at `gerendo.com`.
- **Wired the Lovable WaitlistDialog** to POST cross-origin to `https://app.gerendo.com/api/waitlist` via constant `WAITLIST_ENDPOINT`. One backend, two frontends.
- **Renamed fictional client** "Pescobar" → "Marengo" in `AskDemo.tsx`.
- **Softened homepage Security + AI sections** to honest "we're building" framing. **Then user added back the specific tech claims** (TLS 1.3, AES-256, SOC 2 in progress) on the dedicated `routes/security.tsx` and `routes/privacy.tsx` pages — deliberately, as aspirational target architecture. Homepage and dedicated pages now say slightly different things about security posture.
- **Resend domain verified** for `gerendo.com` (DKIM, SPF on `send.gerendo.com` subdomain — no conflict with Cloudflare Email Routing on apex). Cloudflare Email Routing is set up for **inbound** mail; `contact@` and `thankyou@` forward to `tomagino28@gmail.com`.
- **Welcome email signature** is "Ermina here — co-founder behind Gerendo." From: `Andrei from Gerendo <contact@gerendo.com>` (Andrei = display name in env var; Ermina = signature in body — co-founder personas, see user memory).
- **SEO/branding cleanup of `__root.tsx`** done locally (not yet committed/pushed): replaced "Lovable App" / "@Lovable" / Lovable og:image defaults with proper Gerendo metadata. Homepage description updated to: *"Gerendo is your business's brain. One OS connecting every tool you use, remembering every decision, answering anything your team asks."* (Option C — chosen because it echoes the homepage hero "One brain for your whole business").

### Current phase

**Phase 0 — validation, with public-facing infra now live.** Both domains serve real pages. Real waitlist signups are captured into Resend.

---

## Open questions / pick up next session

1. **User is supplying a favicon** (italic G). When it arrives → drop into `agency-brain-ai-main/public/` and add `link rel="icon"` in `__root.tsx`. Then commit + push the bundled SEO/branding/favicon update — Cloudflare rebuilds.
2. **Cloudflare Email Routing — add three more inbound routes** on `gerendo.com`: `privacy` (referenced in privacy.tsx + cookies.tsx), `ermina` (founder persona, user wants it set up), `legal` (referenced in terms.tsx). All forward to `tomagino28@gmail.com`. Without these, mail to those addresses bounces.
3. **DNS conflict on apex `gerendo.com`** — when adding the custom domain in Cloudflare Pages, an existing record blocked it. User needs to identify and delete the conflicting A/AAAA/CNAME on `@` (do NOT delete MX, TXT, or `app`/`_dmarc`/`_domainkey`/`send` subdomains).
4. **Rotate Resend API key** — earlier in the session a full-access key was pasted in chat (so it's in conversation logs) AND there's a commit `4a9fd3a "Remove sensitive credentials from Git"` which suggests an env file may have been committed at some point. Even after deletion, it stays in `git log -p`. Action: revoke current key in Resend → create a new one → update Vercel env vars + local `.env.local`. Optionally also: check git history for any committed secrets and decide whether to rewrite history.
5. **Slack/Notion/Linear references in `terms.tsx`** — listed as integrations but not on the v1/v2 roadmap. Either prune them or frame as "planned." Legal pages should match real product scope.
6. **Cookies/analytics decision** — confirmed: skip third-party analytics for now. Cloudflare Web Analytics (cookieless) + Google Search Console is the stack. No consent banner needed under GDPR for that combination — and `cookies.tsx` correctly states this.
7. **Romanian-lawyer pass on legal pages** before signing first enterprise customer. Both `terms.tsx` and `privacy.tsx` look LLM-drafted; substance is plausible but not vetted.
8. **Phase 0 outreach work** — the original gates haven't moved: still need 4-of-7 agency conversations confirming the same pain. The two waitlists are infra; the validation conversations are still ahead. Build the 15–20 contact list, draft `INTERVIEW_SCRIPT.md`, draft `OUTREACH_TEMPLATES.md`, fill in the four `[GINO: ...]` markers in `BRIEF.md` (now likely `[ANDREI/ERMINA: ...]`).

---

## Decisions locked in (do not relitigate)

- **Subdomain split:** `gerendo.com` = marketing (Lovable, Cloudflare Pages). `app.gerendo.com` = product/waitlist (Next.js, Vercel). Today both serve waitlists; later, app.* becomes the actual product.
- **One repo, two projects:** `gerendo-app` GitHub repo. Vercel deploys root (Next.js). Cloudflare Pages deploys `agency-brain-ai-main/` subfolder (TanStack Start). Cleaner than two repos for now.
- **Tech stack additions:** TanStack Start + Vite + framer-motion for marketing site. Cloudflare Pages instead of Vercel for that side (cheaper, native to the Lovable export, DNS already on Cloudflare).
- **Positioning leaned generic.** The Lovable copy says "your business" (not "your agency"). User explicitly chose to keep this — broader market, less wedge focus than CLAUDE.md prescribes. Watch for this drift in copy/decisions.
- **Security/privacy public claims include specific tech (TLS 1.3, AES-256, SOC 2 in progress).** User's call — treated as target architecture/aspirational. Homepage section is softer, dedicated pages are specific. Keep this in mind before any prospect calls about security.
- **Welcome email signed "Ermina"** with from-display "Andrei from Gerendo." Co-founder personas; treat both names as legit when copy needs editing.
- **Skip third-party analytics** — Cloudflare Web Analytics (cookieless) + Google Search Console is enough for Phase 0. No consent banner needed.
- **Email From address:** `contact@gerendo.com` (display name "Andrei from Gerendo"). Was `thankyou@` originally; switched mid-session because user preferred a more standard contact address.

---

## Things to NOT do yet

- Don't write Supabase schema yet — wait until M1 (Week 4–5 of PLAN.md)
- Don't activate Stripe billing — Phase 3
- Don't build local LLM / self-hosted model support (cut from BringYourAI section deliberately)
- Don't add Slack/Notion/Linear integrations until they're on the actual roadmap (terms.tsx claims them; reality doesn't yet)
- Don't add cookie consent banner (Cloudflare Web Analytics is cookieless, GDPR-compliant without consent)

---

## Reference

- Full plan: [docs/PLAN.md](docs/PLAN.md)
- Product brief: [docs/BRIEF.md](docs/BRIEF.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Original venture notes: [docs/_notes-original.md](docs/_notes-original.md)
- Changelog: [docs/CHANGELOG.md](docs/CHANGELOG.md)
- Agency operational context: `~/Gerendo/CLAUDE.md`
