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
        <p className="mt-3 text-sm text-muted-foreground">Last updated: April 2026</p>

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
              We only access the data you explicitly connect to Gerendo through OAuth (Gmail, Drive, Asana, Meet, WhatsApp, etc.).
              We collect the minimum metadata needed to index and answer your queries - we do not store the full content of your documents, emails, or messages.
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
            <h2 className="font-display text-2xl text-foreground">5. AI model training</h2>
            <p className="mt-3">
              <strong className="text-foreground">We never train AI models on your data.</strong> When you bring your own AI provider key (Claude, OpenAI, Gemini, Mistral, etc.), we route through their zero-retention APIs where available.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">6. Encryption &amp; security</h2>

            <h3 className="mt-5 text-base font-semibold text-foreground">What is encrypted with a key only Gerendo holds</h3>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>Email subject lines and body content (after sync from Gmail)</li>
              <li>Google Drive document content (after sync)</li>
              <li>Asana task descriptions and comments (after sync)</li>
              <li>AI-generated summaries derived from your data</li>
              <li>Extracted facts (e.g., "Acme decided to launch May 25")</li>
              <li>OAuth tokens for your connected tools</li>
            </ul>
            <p className="mt-3">
              These columns are encrypted with AES-256-GCM. The master key lives in our application's environment (Vercel), separate from the database. A Supabase staff member, a leaked database snapshot, or a compromised service-role token sees only ciphertext. We hold the key.
            </p>

            <h3 className="mt-6 text-base font-semibold text-foreground">What is stored as queryable metadata</h3>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>Email sender, recipient, timestamp, thread ID</li>
              <li>Drive file name, type, modified timestamp</li>
              <li>Asana task name, project name, assignee</li>
              <li>Internal IDs, foreign keys, audit timestamps</li>
            </ul>
            <p className="mt-3">
              These fields are needed to display search results and join data across sources before any decryption happens. Encrypting them would require decrypting every row of every query, too expensive for our current size. We will revisit as customers and threat model evolve.
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
            <h2 className="font-display text-2xl text-foreground">7. Third-party processors</h2>
            <p className="mt-3">
              To deliver the service, we work with the following trusted sub-processors:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Supabase</strong> - database and authentication infrastructure.</li>
              <li><strong className="text-foreground">Vercel</strong> - application hosting and deployment.</li>
              <li><strong className="text-foreground">Cloudflare</strong> - DNS, security, and content delivery.</li>
              <li><strong className="text-foreground">Resend</strong> - transactional email delivery.</li>
              <li><strong className="text-foreground">Anthropic, OpenAI, Google, Mistral</strong> - AI inference, via zero-retention endpoints where available.</li>
            </ul>
            <p className="mt-3">
              All processors are required to handle your data in compliance with GDPR.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">8. Data retention</h2>
            <p className="mt-3">
              We retain your metadata for as long as your account is active. If you delete your workspace, all associated data is permanently removed within <strong className="text-foreground">30 days</strong>. Anonymised usage logs may be retained for up to 12 months for security purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">9. Your rights</h2>
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
            <h2 className="font-display text-2xl text-foreground">10. Contact</h2>
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