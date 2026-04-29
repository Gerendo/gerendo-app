import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — Gerendo" },
      { name: "description", content: "How Gerendo keeps your business data private and secure." },
    ],
  }),
  component: Security,
});

function Security() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
        <Link to="/"><Wordmark /></Link>
        <Link to="/" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">← Back</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">Trust</p>
        <h1 className="mt-4 font-display text-5xl tracking-tight">Security &amp; Privacy</h1>
        <p className="mt-4 text-lg text-muted-foreground">Your data stays yours. Always.</p>

        <div className="mt-12 space-y-10 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="font-display text-2xl text-foreground">Never used to train AI</h2>
            <p className="mt-3">We never train models on your data, and we route through your AI provider's zero-retention endpoints whenever possible. Your business knowledge is not anyone else's training set.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">Encrypted everywhere</h2>
            <p className="mt-3">TLS 1.3 in transit. AES-256 at rest. OAuth tokens isolated in a secrets vault. Per-tenant encryption keys.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">Permission-aware</h2>
            <p className="mt-3">Gerendo respects the access controls in your source tools. If a teammate can't see a Drive file, Gerendo won't show them an answer based on it.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">No human eyes</h2>
            <p className="mt-3">No one at Gerendo reads your data. Engineering access to production is logged, time-bound, and limited to break-glass scenarios.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">You own the off switch</h2>
            <p className="mt-3">Disconnect any source in one click. Export everything. Delete it all — permanently — whenever you want.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">Compliance roadmap</h2>
            <p className="mt-3">SOC 2 Type II in progress. GDPR-aligned data processing. EU data residency available on request.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
