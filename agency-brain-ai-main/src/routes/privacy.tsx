import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Gerendo" },
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
            <h2 className="font-display text-2xl text-foreground">1. What we collect</h2>
            <p className="mt-3">W only access the data you explicitly connect to Gerendo through OAuth (Gmail, Drive, Asana, Meet, WhatsApp, etc.). We collect the minimum metadata needed to index and answer your queries.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">2. How we use it</h2>
            <p className="mt-3">Your data is used solely to power your team's queries inside Gerendo. We never sell, share, or expose your data to third parties.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">3. AI model training</h2>
            <p className="mt-3"><strong className="text-foreground">We never train AI models on your data.</strong> When you bring your own AI provider key (Claude, OpenAI, Gemini, etc.), we route through their zero-retention APIs where available.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">4. Encryption</h2>
            <p className="mt-3">All data is encrypted in transit (TLS 1.3) and at rest (AES-256). OAuth tokens are stored in an isolated secrets vault.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">5. Your rights</h2>
            <p className="mt-3">You can revoke access, export, or permanently delete all your data at any time from your workspace settings. Deletion is irreversible and complete within 30 days.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">6. Contact</h2>
            <p className="mt-3">Questions? Reach us at privacy@gerendo.com.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
