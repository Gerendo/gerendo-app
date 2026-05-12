# Google OAuth Verification - Step-by-Step

*Submit ASAP. ~3 week clock. Without verification, only whitelisted test users can sign in. This blocks pilot users in Week 5.*

---

## What you're submitting for

Google reviews any app that uses **sensitive** or **restricted** Google API scopes and requests OAuth from users outside your org. Gerendo uses two sensitive scopes (`gmail.readonly`, `drive.readonly`), so we need verification before going live.

After approval, the "unverified app" warning screen goes away and any Google user can sign in.

---

## Pre-flight checklist (do these BEFORE opening the console)

1. **Verify domain ownership of gerendo.com.** Google requires this for the privacy policy and ToS URLs to be accepted.
   - Open https://search.google.com/search-console
   - Add property: `gerendo.com` (Domain property, not URL prefix)
   - Verify via DNS TXT record (Cloudflare DNS)
   - Wait for "Ownership verified" - usually 1-5 minutes

2. **Confirm privacy and ToS pages are live** at:
   - `https://gerendo.com/privacy`
   - `https://gerendo.com/terms`
   - Both must render publicly (no login wall). Test in incognito.
   - Privacy page MUST mention: what Google data you access, what you do with it, retention, deletion flow.

3. **Have a logo ready.** PNG, 120x120 px minimum, square, transparent or solid background. The Gerendo favicon at `public/Gerendo-Favicon.png` likely works.

4. **Have a public homepage** at `https://gerendo.com` (the marketing site, not the app). Must mention Gerendo's name and the product.

5. **Recording tool ready.** macOS: built-in QuickTime (File > New Screen Recording). Or Loom (free).

---

## Step 1: Open the OAuth consent screen

1. Go to https://console.cloud.google.com
2. Select the project that owns your OAuth client (the one with `GOOGLE_CLIENT_ID` in your env). If unsure: top-left dropdown, find it by name.
3. Left nav: **APIs & Services** > **OAuth consent screen**
4. Click **Edit App**

If User Type is "Testing", you'll switch to **Production** later in this flow.

---

## Step 2: App Information

Fill in:

| Field | Value |
|-------|-------|
| App name | `Gerendo` |
| User support email | Your email (the one you can monitor) |
| App logo | Upload the 120x120 PNG |
| Application home page | `https://gerendo.com` |
| Application privacy policy link | `https://gerendo.com/privacy` |
| Application terms of service link | `https://gerendo.com/terms` |
| Authorized domains | `gerendo.com` (just the apex, no www) |
| Developer contact email | Your email |

Click **Save and continue**.

---

## Step 3: Scopes

Click **Add or remove scopes**. In the search/filter field, find and tick each one:

| Scope | Type | Why we need it |
|-------|------|----------------|
| `openid` | Non-sensitive | Sign in. |
| `https://www.googleapis.com/auth/userinfo.email` | Non-sensitive | Identify the user by email so workspace membership is consistent. |
| `https://www.googleapis.com/auth/userinfo.profile` | Non-sensitive | Show user name and avatar in the app. |
| `https://www.googleapis.com/auth/gmail.readonly` | **Sensitive** | Search and read the user's emails to answer their questions across their workspace. |
| `https://www.googleapis.com/auth/drive.readonly` | **Sensitive** | Search and read the user's Drive docs to answer their questions across their workspace. |

If you also use Gmail labels reading or Drive metadata, add those too (whatever your code actually requests).

**Sensitive scopes require justification.** For each sensitive scope, click "Add justification" and paste:

For `gmail.readonly`:
> Gerendo is an AI assistant that answers questions across a marketing agency's tools (Gmail, Drive, Asana). To answer "what did the client decide about X" we read the user's Gmail messages, embed them in their workspace's private database (EU region, Row-Level Security enforced), and search them at query time. We never send mail. We never train AI models on user data. Users can revoke access and delete their data from Settings at any time. Privacy policy: https://gerendo.com/privacy

For `drive.readonly`:
> Same model as Gmail: we read the user's Drive docs, embed them in their private workspace database (EU region, RLS), and search them when the user asks questions. We never modify, share, or train on the user's files. Per-source revoke is available in Settings. Privacy policy: https://gerendo.com/privacy

Click **Update**, then **Save and continue**.

---

## Step 4: Test users (skip or fill if Testing mode)

If your app is currently in Testing mode, this lists whitelisted users. After verification you can leave it as is; production users won't need to be listed.

Click **Save and continue**.

---

## Step 5: Summary, then "Publish App"

Review the summary page. Click **Back to dashboard**.

On the OAuth consent screen dashboard, click **Publish App** to move from Testing to Production. A confirmation dialog appears.

After publishing, Google will detect the sensitive scopes and require verification before any user outside your org can use them. Click **Prepare for verification** (or the equivalent "Submit for verification" button that appears).

---

## Step 6: Verification submission form

This is the longest screen. Be thorough; vague answers cause rejection.

### 6a. App branding / consent

Double-check logo, app name, privacy URL, ToS URL all show correctly. Click **Continue**.

### 6b. Justify your scopes (again, in detail)

For each sensitive scope, Google asks 3 things:

1. **How does your app use these scopes?**
2. **Why can't your app function with a more limited scope?**
3. **What's the limited use compliance statement?**

For `gmail.readonly`, paste:

> **How:** When a user connects Gmail through OAuth, Gerendo periodically syncs their email metadata and bodies via the Gmail API. Each message is split into chunks, embedded with a vector model, and stored in the user's private workspace database (Supabase Postgres, EU region, Row-Level Security enforced per-user). At query time the user asks Gerendo questions like "what did Acme say about the launch?" and we search across their indexed messages to return cited answers.
>
> **Why not a more limited scope:** `gmail.readonly` is the minimum scope that allows reading message contents across all of a user's emails. `gmail.metadata` would only give headers, which is insufficient for answering questions about message content. We do not need `gmail.send` or `gmail.modify` and we do not request them.
>
> **Limited use:** Gerendo's use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We do not transfer this data to others except as needed to provide the user-facing features (e.g., AI model inference at request time). We do not use the data for advertising. We do not allow humans to read the data unless we have the user's affirmative agreement, or it is necessary for security, to comply with law, or as part of an aggregated and anonymized usage report.

For `drive.readonly`, paste a parallel version replacing "email/messages" with "files/documents."

### 6c. Demo video (REQUIRED)

This is the part most often rejected. Google needs a specific video showing the OAuth flow + how the scope is actually used.

**Record a 60-90 second screencast that shows ALL of:**

1. Visit `https://app.gerendo.com` (the homepage / sign-in screen).
2. Click **Sign in with Google**.
3. The Google OAuth consent screen appears - **PAUSE for 2 seconds so the URL bar shows `accounts.google.com` and the scopes are visible.**
4. Approve the consent (with your test account).
5. Return to Gerendo. Navigate to `/connect`.
6. Click **Connect Gmail**. Approve the Gmail scope.
7. Show the sync state (sync banner or completed state).
8. Navigate to `/ask`. Type a question that uses Gmail data (e.g. *"What was the last email from my client?"*).
9. Show the answer with the source citation linking back to Gmail.
10. (Optional but recommended) Repeat steps 6-9 for Drive.

**Critical:**
- The video MUST clearly show the OAuth consent URL on `accounts.google.com` (Google checks this).
- The video MUST show the homepage URL `https://gerendo.com` or `https://app.gerendo.com` somewhere.
- The video MUST be a public unlisted YouTube link (not a Loom direct upload - Google's reviewers can't always access Loom).

Upload to YouTube as **Unlisted**. Paste the YouTube URL in the form.

### 6d. Submit

Final confirmation, then submit.

---

## What happens next

1. **Day 1-3:** Automated check. You may get a quick rejection if any URL is dead, the video is private, or the privacy policy doesn't mention Google data handling. Fix and resubmit.

2. **Day 3-21:** Manual review by a Google reviewer. Most apps land in 5-15 days. They may email back with clarifying questions; respond fast (24h) to keep your queue position.

3. **Approved:** the "unverified app" warning is gone. Any Google user can sign in.

4. **Rejected:** Google sends a detailed reason. Common ones:
   - "Demo video doesn't show the OAuth flow on accounts.google.com" -> re-record with the consent URL clearly visible.
   - "Privacy policy missing limited-use disclosure" -> add a paragraph to `/privacy` quoting the limited-use language above.
   - "Cannot verify domain ownership" -> finish Search Console verification.
   - "Scope justification too generic" -> paste the detailed justifications above verbatim.

---

## After approval

- You don't need to re-verify unless you add a new sensitive/restricted scope or change branding significantly.
- Keep `https://gerendo.com/privacy` and `https://gerendo.com/terms` live forever. If they 404, Google can flag your app post-verification.
- If you add WhatsApp / WhatsApp Business later, that has its own Meta review (not Google).

---

## Mark this done when

- [ ] Search Console: gerendo.com ownership verified
- [ ] Privacy + ToS pages live and contain limited-use language
- [ ] OAuth consent screen fields filled
- [ ] All 5 scopes added with justifications
- [ ] App published (Testing -> Production)
- [ ] Demo video recorded, uploaded to YouTube as Unlisted, linked in form
- [ ] Submitted for verification
- [ ] Confirmation email received from Google

Update `_notes.md` once submitted with the submission date so future agents know the clock has started.
