import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use - Gerendo" },
      { name: "description", content: "Terms governing your use of Gerendo." },
    ],
  }),
  component: Terms,
});

const AI_SUBPROCESSORS = [
  { name: "Anthropic", model: "Claude", privacy: "https://www.anthropic.com/privacy" },
  { name: "OpenAI", model: "GPT-4", privacy: "https://openai.com/policies/privacy-policy" },
  { name: "Google", model: "Gemini", privacy: "https://policies.google.com/privacy" },
  { name: "Mistral AI", model: "Mistral", privacy: "https://mistral.ai/privacy" },
];

function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
        <Link to="/"><Wordmark /></Link>
        <Link to="/" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">← Back</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">Legal</p>
        <h1 className="mt-4 font-display text-5xl tracking-tight">Terms of Use</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: April 2026</p>

        <div className="mt-12 space-y-10 text-[15px] leading-relaxed text-muted-foreground">

          {/* 1. Acceptance */}
          <section>
            <h2 className="font-display text-2xl text-foreground">1. Acceptance</h2>
            <p className="mt-3">
              By accessing or using Gerendo, you confirm that you are at least 18 years old, have
              the authority to bind the organisation you represent, and agree to these Terms of Use
              ("Terms"). If you do not agree, do not use the service.
            </p>
          </section>

          {/* 2. What Gerendo does */}
          <section>
            <h2 className="font-display text-2xl text-foreground">2. The service</h2>
            <p className="mt-3">
              Gerendo is a B2B SaaS platform that connects to the tools your team already uses -
              including but not limited to Gmail, Google Drive, Asana, Google Meet, WhatsApp
              Business, Slack, Notion, and Linear - and uses AI to help your team query, summarise,
              and act on your business knowledge. To deliver this, Gerendo reads and indexes data
              from the sources you connect, routes queries through AI providers of your choice, and
              stores derived outputs (summaries, tasks, memory) within your isolated workspace.
            </p>
          </section>

          {/* 3. Your account */}
          <section>
            <h2 className="font-display text-2xl text-foreground">3. Your account</h2>
            <p className="mt-3">
              You are responsible for maintaining the confidentiality of your login credentials and
              for all activity that occurs within your workspace. Notify us immediately at{" "}
              <a href="mailto:legal@gerendo.com" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">legal@gerendo.com</a>{" "}
              if you suspect unauthorised access. We are not liable for losses arising from
              compromised credentials that you failed to report promptly.
            </p>
          </section>

          {/* 4. Acceptable use */}
          <section>
            <h2 className="font-display text-2xl text-foreground">4. Acceptable use</h2>
            <p className="mt-3">You agree not to use Gerendo to:</p>
            <ul className="mt-3 space-y-2 list-none">
              {[
                "violate any applicable law or regulation, including EU data protection law (GDPR);",
                "process data relating to children under 16 without appropriate consent mechanisms in place on your side;",
                "upload or transmit malicious code, conduct security attacks, or attempt to reverse-engineer the service;",
                "resell, sublicense, or white-label the service without our written consent;",
                "use the service to train AI models, build competing products, or scrape outputs in bulk;",
                "violate the terms of any third-party tool you connect to Gerendo (e.g. Google, Slack, WhatsApp Business).",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[6px] h-1 w-1 flex-shrink-0 rounded-full bg-ember" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 5. Your data */}
          <section>
            <h2 className="font-display text-2xl text-foreground">5. Your data is yours</h2>
            <p className="mt-3">
              You retain full ownership of all data you connect to or generate within Gerendo.
              By using the service, you grant Gerendo a limited, non-exclusive licence to access,
              process, and store your data solely to provide and improve the service for your
              workspace. We do not sell your data, use it for advertising, or share it with third
              parties except as set out in these Terms and our{" "}
              <Link to="/privacy" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">Privacy Policy</Link>.
            </p>
            <p className="mt-3">
              You can disconnect any data source at any time from your workspace settings.
              On account deletion, your data is permanently purged from our systems within 30 days.
            </p>
          </section>

          {/* 6. GDPR roles */}
          <section>
            <h2 className="font-display text-2xl text-foreground">6. GDPR - controller & processor</h2>
            <p className="mt-3">
              Gerendo is operated by a Romanian-registered entity and is subject to the EU General
              Data Protection Regulation (GDPR). With respect to personal data you feed into
              Gerendo, you (the customer) act as the <strong className="text-foreground font-medium">data controller</strong> and
              Gerendo acts as the <strong className="text-foreground font-medium">data processor</strong>,
              processing data only on your documented instructions.
            </p>
            <p className="mt-3">
              If your use of Gerendo requires a Data Processing Agreement (DPA) under Article 28
              GDPR - which is typical for any business processing personal data of EU residents -
              contact us at{" "}
              <a href="mailto:legal@gerendo.com" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">legal@gerendo.com</a>{" "}
              and we will provide one. Our full privacy practices are described in our{" "}
              <Link to="/privacy" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">Privacy Policy</Link>.
            </p>
          </section>

          {/* 7. AI subprocessors */}
          <section>
            <h2 className="font-display text-2xl text-foreground">7. AI subprocessors</h2>
            <p className="mt-3">
              Gerendo allows you to choose which AI model powers your workspace. When you submit a
              query, relevant context from your connected sources is routed to the AI provider you
              have selected. We use zero-retention API endpoints wherever available, meaning your
              data is not stored or used to train models by these providers. The current AI
              providers available are:
            </p>

            {/* Mobile cards */}
            <div className="mt-6 space-y-3 sm:hidden">
              {AI_SUBPROCESSORS.map((p) => (
                <div key={p.name} className="rounded-lg border border-border p-4 space-y-1">
                  <p className="text-foreground font-medium">{p.name}</p>
                  <p className="text-[13px]">Model: {p.model}</p>
                  <a href={p.privacy} target="_blank" rel="noopener noreferrer"
                    className="text-[13px] text-foreground underline underline-offset-2 hover:text-ember transition-colors">
                    Privacy policy ↗
                  </a>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="mt-6 hidden sm:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Provider", "Model", "Privacy policy"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-foreground/60">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {AI_SUBPROCESSORS.map((p) => (
                    <tr key={p.name} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground">{p.name}</td>
                      <td className="px-4 py-3">{p.model}</td>
                      <td className="px-4 py-3">
                        <a href={p.privacy} target="_blank" rel="noopener noreferrer"
                          className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">
                          View ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              By selecting an AI provider, you acknowledge that your query data will be processed
              by that provider under their terms. You can switch providers at any time from your
              workspace settings.
            </p>
          </section>

          {/* 8. Third-party integrations */}
          <section>
            <h2 className="font-display text-2xl text-foreground">8. Third-party integrations</h2>
            <p className="mt-3">
              Gerendo connects to third-party tools via their official APIs. Your use of those
              tools remains subject to their own terms of service. Gerendo is not affiliated with,
              endorsed by, or responsible for Google, Meta, Atlassian, Slack, Notion, or any other
              third-party provider. We are not liable for changes, outages, or policy updates on
              their platforms that affect the Gerendo service.
            </p>
          </section>

          {/* 9. Intellectual property */}
          <section>
            <h2 className="font-display text-2xl text-foreground">9. Intellectual property</h2>
            <p className="mt-3">
              Gerendo and its underlying software, design, and branding are owned by us and
              protected by applicable intellectual property law. These Terms do not grant you any
              rights to our IP beyond the limited licence to use the service. All rights not
              expressly granted are reserved.
            </p>
          </section>

          {/* 10. Disclaimer & liability */}
          <section>
            <h2 className="font-display text-2xl text-foreground">10. Disclaimer & liability</h2>
            <p className="mt-3">
              Gerendo is provided <strong className="text-foreground font-medium">"as is"</strong> and{" "}
              <strong className="text-foreground font-medium">"as available"</strong> without warranties
              of any kind, express or implied, including fitness for a particular purpose or
              uninterrupted availability. AI-generated outputs may contain errors - you are
              responsible for verifying anything before acting on it.
            </p>
            <p className="mt-3">
              To the maximum extent permitted by applicable law, Gerendo's total liability to you
              for any claim arising from these Terms or your use of the service shall not exceed
              the fees you paid to Gerendo in the three months preceding the event giving rise to
              the claim. We are not liable for indirect, incidental, consequential, or punitive
              damages of any kind.
            </p>
            <p className="mt-3">
              Nothing in these Terms limits liability for death or personal injury caused by
              negligence, fraud, or any other liability that cannot be excluded under Romanian or
              EU law.
            </p>
          </section>

          {/* 11. Termination */}
          <section>
            <h2 className="font-display text-2xl text-foreground">11. Termination</h2>
            <p className="mt-3">
              You may stop using Gerendo at any time. We may suspend or terminate your access
              if you breach these Terms, with or without notice depending on severity. On
              termination for any reason:
            </p>
            <ul className="mt-3 space-y-2 list-none">
              {[
                "your right to use the service ceases immediately;",
                "you may request an export of your data within 30 days of termination;",
                "after 30 days, your data will be permanently deleted from our systems.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[6px] h-1 w-1 flex-shrink-0 rounded-full bg-ember" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 12. Governing law */}
          <section>
            <h2 className="font-display text-2xl text-foreground">12. Governing law</h2>
            <p className="mt-3">
              These Terms are governed by the laws of Romania and, where applicable, the laws of
              the European Union. Any disputes shall be subject to the exclusive jurisdiction of
              the competent courts of Romania, without prejudice to your rights as a consumer or
              business under mandatory EU law.
            </p>
          </section>

          {/* 13. Changes */}
          <section>
            <h2 className="font-display text-2xl text-foreground">13. Changes to these terms</h2>
            <p className="mt-3">
              We may update these Terms from time to time. For material changes, we will notify
              you by email at least 30 days before the changes take effect. Continued use of
              Gerendo after that date constitutes acceptance of the updated Terms. The current
              version is always available at{" "}
              <Link to="/terms" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">gerendo.com/terms</Link>.
            </p>
          </section>

          {/* 14. Contact */}
          <section>
            <h2 className="font-display text-2xl text-foreground">14. Contact</h2>
            <p className="mt-3">
              For legal notices and questions about these Terms, contact us at{" "}
              <a href="mailto:legal@gerendo.com" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">legal@gerendo.com</a>.
              For privacy and data requests, use{" "}
              <a href="mailto:privacy@gerendo.com" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">privacy@gerendo.com</a>.
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}