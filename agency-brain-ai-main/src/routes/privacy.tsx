import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy - Gerendo" },
      { name: "description", content: "How Gerendo collects, uses, and protects your business data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
        <Link to="/"><Wordmark /></Link>
        <Link to="/" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">← Back</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 prose-invert">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">Legal</p>
        <h1 className="mt-4 font-display text-5xl tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: May 2026</p>

        <div className="mt-12 space-y-8 text-[15px] leading-relaxed text-muted-foreground">

          <section>
            <h2 className="font-display text-2xl text-foreground">1. Who we are</h2>
            <p className="mt-3">
              Gerendo is operated by <strong className="text-foreground">Ermina</strong>, based in Romania, European Union.
              For any privacy-related questions, contact us at{" "}
              <a href="mailto:privacy@gerendo.com" className="text-foreground underline underline-offset-4">privacy@gerendo.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">2. What we collect</h2>
            <p className="mt-3">
              We access the data you explicitly connect to Gerendo through OAuth (today: Gmail, Google Drive, and Asana). To answer your queries, we synchronise message and file content from those sources into your isolated workspace database.
            </p>
            <p className="mt-3">
              Sensitive content - email subjects and senders, file and document content, task names and descriptions, AI-generated summaries, OAuth tokens, and chat history - is encrypted at rest before it is written to the database. A small set of fields needed to look up and join records (source labels, provider message IDs, timestamps, internal IDs) remains as queryable plaintext metadata. Section 6 has the full breakdown.
            </p>
            <p className="mt-3">
              We also collect basic account information (name, email address) when you sign up, and standard usage logs for security and performance purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">3. Legal basis for processing</h2>
            <p className="mt-3">
              We process your data under the following legal bases as defined by the GDPR:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Contract performance</strong> - to provide the Gerendo service you signed up for.</li>
              <li><strong className="text-foreground">Legitimate interest</strong> - to maintain security, prevent abuse, and improve the product.</li>
              <li><strong className="text-foreground">Consent</strong> - for any optional data uses, such as product updates or feedback requests. You may withdraw consent at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">4. How we use it</h2>
            <p className="mt-3">
              Your data is used solely to power your team's queries inside Gerendo. We never sell, share, or expose your data to third parties for marketing or advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">5. AI processing</h2>
            <p className="mt-3">
              <strong className="text-foreground">We never train AI models on your data.</strong> Gerendo uses two AI services to power search and chat:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Voyage AI</strong> generates the vector embeddings that make semantic search work. Text from your synced Gmail, Drive, and Asana content is sent to Voyage over TLS to produce embeddings; Voyage does not retain inputs or train on them per their commercial terms.</li>
              <li><strong className="text-foreground">Anthropic (Claude)</strong> answers your questions. When you ask Gerendo something, relevant snippets are decrypted in our application and sent over TLS to Anthropic for inference. Anthropic does not train models on inputs sent through its API. Per Anthropic's standard commercial terms, prompts may be retained for up to 30 days for abuse monitoring and are then deleted.</li>
            </ul>
            <p className="mt-3">
              Bring-your-own-key support and additional model providers (OpenAI, Gemini, Mistral) are on the roadmap and are not yet available. When they ship, this section will be updated and existing customers will be notified.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">6. Encryption &amp; security</h2>

            <h3 className="mt-5 text-base font-semibold text-foreground">What is encrypted with a key only Gerendo holds</h3>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>Email subjects, senders, thread IDs, and indexed body keywords (after sync from Gmail)</li>
              <li>Google Drive file names and indexed document content (after sync)</li>
              <li>Asana task names, project names, assignees, descriptions, due dates, and links (after sync)</li>
              <li>AI-generated summaries derived from your data</li>
              <li>Extracted facts (e.g., "Acme decided to launch May 25")</li>
              <li>Decision findings and AI-drafted updates surfaced by Gerendo</li>
              <li>Workspace names and chat history (conversation titles and messages)</li>
              <li>OAuth tokens for your connected tools</li>
            </ul>
            <p className="mt-3">
              These columns are encrypted with AES-256-GCM. The master key lives in our application's environment (Vercel), separate from the database. A Supabase staff member, a leaked database snapshot, or a compromised service-role token sees only ciphertext. We hold the key.
            </p>

            <h3 className="mt-6 text-base font-semibold text-foreground">What is stored as queryable plaintext metadata</h3>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>Source labels (e.g., "gmail", "drive", "asana") and item type or status (e.g., "inbox", "task", "open")</li>
              <li>Provider message and file IDs (Gmail message IDs, Drive file IDs, Asana task IDs) so we can fetch fresh content on demand</li>
              <li>Drive file MIME type and modified timestamp</li>
              <li>Internal IDs, foreign keys (workspace ID, user ID), and audit timestamps</li>
            </ul>
            <p className="mt-3">
              These fields are needed to look up and join records before any decryption happens. They do not include message bodies, file contents, subjects, names, or any other free-form user content. We will revisit as customers and threat model evolve.
            </p>

            <h3 className="mt-6 text-base font-semibold text-foreground">How chat queries actually work</h3>
            <p className="mt-3">
              When you ask Gerendo a question, relevant snippets are decrypted in our application server (Vercel) and sent over TLS to our LLM provider (Anthropic Claude) for inference. Anthropic processes the prompt and returns an answer. Per Anthropic's standard commercial terms, prompts may be retained for up to 30 days for abuse monitoring. Anthropic does not train models on your data.
            </p>

            <h3 className="mt-6 text-base font-semibold text-foreground">Three-layer summary</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-foreground">
                    <th className="py-2 pr-4 font-semibold">Layer</th>
                    <th className="py-2 pr-4 font-semibold">What</th>
                    <th className="py-2 font-semibold">Encryption</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4">At rest in Supabase</td>
                    <td className="py-2 pr-4">Body content, summaries, facts, OAuth tokens</td>
                    <td className="py-2">AES-256-GCM, key held by Gerendo</td>
                  </tr>
                  <tr className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4">In transit</td>
                    <td className="py-2 pr-4">All API traffic</td>
                    <td className="py-2">TLS 1.3</td>
                  </tr>
                  <tr className="align-top">
                    <td className="py-2 pr-4">During Claude inference</td>
                    <td className="py-2 pr-4">Decrypted snippets sent to Anthropic</td>
                    <td className="py-2">TLS 1.3, retained per Anthropic ToS up to 30 days</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="mt-6 text-base font-semibold text-foreground">What we deliberately do not claim</h3>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>We do not claim "zero-knowledge", we hold the encryption key.</li>
              <li>We do not claim "end-to-end encryption", that means only sender and recipient hold keys, which does not apply to a RAG product.</li>
              <li>We do not claim "even our engineers cannot read your messages" without context. During a chat query, the data is decrypted briefly in process memory. We claim <em>operator-level isolation</em> (the database operator cannot read it), not absolute isolation.</li>
            </ul>

            <p className="mt-6">
              Each workspace's data is also isolated at the database level via Postgres Row Level Security, so tenants cannot read each other's rows. RLS enforces tenant isolation. Encryption enforces operator isolation.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">7. Google API Services &amp; Limited Use</h2>
            <p className="mt-3">
              Gerendo's use of information received from Google APIs adheres to the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">Google API Services User Data Policy</a>, including the Limited Use requirements. Specifically:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>We use the Google data we receive only to provide and improve user-facing features that are visible inside Gerendo.</li>
              <li>We do not transfer the data to third parties except where necessary to provide those features (for example, AI inference at request time, and the infrastructure providers listed in Section 8), to comply with applicable law, or as part of a merger or acquisition where the data continues to be protected by this policy.</li>
              <li>We do not use the data for advertising, including personalised, retargeted, or interest-based advertising.</li>
              <li>We do not allow humans to read the data unless you have given specific affirmative consent, it is necessary for security (for example, investigating abuse), it is required by law, or the data has been aggregated and de-identified for usage analytics.</li>
            </ul>

            <h3 className="mt-6 text-base font-semibold text-foreground">Scopes Gerendo currently requests</h3>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">https://www.googleapis.com/auth/gmail.readonly</strong> - read your Gmail messages so Gerendo can answer questions across your mail. Read-only: we never send, modify, label, or delete messages.</li>
              <li><strong className="text-foreground">https://www.googleapis.com/auth/drive.readonly</strong> - read your Google Drive files so Gerendo can answer questions across your documents. Read-only: we never modify, share, or delete files.</li>
              <li><strong className="text-foreground">openid</strong>, <strong className="text-foreground">userinfo.email</strong>, <strong className="text-foreground">userinfo.profile</strong> - sign you in and identify your account so workspace membership and permissions are consistent.</li>
            </ul>

            <h3 className="mt-6 text-base font-semibold text-foreground">Revoking access</h3>
            <p className="mt-3">
              You can revoke Gerendo's access to your Google account at any time at{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">myaccount.google.com/permissions</a>, or from the Settings page inside Gerendo. Revoking access stops further synchronisation. To also delete data already indexed, use "Delete data" in Settings or email{" "}
              <a href="mailto:privacy@gerendo.com" className="text-foreground underline underline-offset-4">privacy@gerendo.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">8. Third-party processors</h2>
            <p className="mt-3">
              To deliver the service, we work with the following trusted sub-processors:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Supabase</strong> - managed Postgres database (EU region) and authentication infrastructure.</li>
              <li><strong className="text-foreground">Vercel</strong> - application hosting and deployment for the product app.</li>
              <li><strong className="text-foreground">Cloudflare</strong> - DNS, security, content delivery, and web analytics (anonymised, no cookies).</li>
              <li><strong className="text-foreground">Anthropic</strong> - AI inference for chat and decision detection (Claude). Inputs not used for training; see Section 5.</li>
              <li><strong className="text-foreground">Voyage AI</strong> - vector embeddings for semantic search. Inputs not used for training; see Section 5.</li>
              <li><strong className="text-foreground">Resend</strong> - transactional email delivery (sign-in links, notifications).</li>
              <li><strong className="text-foreground">Google APIs</strong> - reading your connected Gmail and Drive content under the scopes you authorise. Use is governed by the Google API Services User Data Policy; see Section 7.</li>
              <li><strong className="text-foreground">Asana API</strong> - reading your connected Asana workspace under the scopes you authorise.</li>
            </ul>
            <p className="mt-3">
              All processors are required to handle your data in compliance with GDPR.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">9. Data retention</h2>
            <p className="mt-3">
              We retain your metadata for as long as your account is active. If you delete your workspace, all associated data is permanently removed within <strong className="text-foreground">30 days</strong>. Anonymised usage logs may be retained for up to 12 months for security purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">10. Your rights</h2>
            <p className="mt-3">
              Under GDPR, you have the following rights regarding your personal data:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Access</strong> - request a copy of the data we hold about you.</li>
              <li><strong className="text-foreground">Rectification</strong> - ask us to correct inaccurate data.</li>
              <li><strong className="text-foreground">Erasure</strong> - request permanent deletion of your data.</li>
              <li><strong className="text-foreground">Portability</strong> - receive your data in a structured, machine-readable format.</li>
              <li><strong className="text-foreground">Objection</strong> - object to processing based on legitimate interest.</li>
              <li><strong className="text-foreground">Restriction</strong> - ask us to limit how we use your data.</li>
              <li><strong className="text-foreground">Withdraw consent</strong> - at any time, for processing based on consent.</li>
            </ul>
            <p className="mt-3">
              You can exercise most of these rights directly from your workspace settings. For anything else, email us at{" "}
              <a href="mailto:privacy@gerendo.com" className="text-foreground underline underline-offset-4">privacy@gerendo.com</a> and we will respond within 30 days.
            </p>
            <p className="mt-3">
              You also have the right to lodge a complaint with your local data protection authority.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">11. Contact</h2>
            <p className="mt-3">
              Questions or requests? Reach us at{" "}
              <a href="mailto:privacy@gerendo.com" className="text-foreground underline underline-offset-4">privacy@gerendo.com</a>.
              We aim to respond to all privacy enquiries within 5 business days.
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}