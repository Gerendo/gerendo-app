import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Gerendo" },
      { name: "description", content: "Terms governing your use of Gerendo." },
    ],
  }),
  component: Terms,
});

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

        <div className="mt-12 space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="font-display text-2xl text-foreground">1. Acceptance</h2>
            <p className="mt-3">By using Gerendo, you agree to these terms. If you don't agree, don't use the service.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">2. Your account</h2>
            <p className="mt-3">You're responsible for keeping your credentials secure and for everything that happens under your workspace.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">3. Acceptable use</h2>
            <p className="mt-3">Don't use Gerendo for anything illegal, harmful, or in violation of others' rights. Don't try to reverse-engineer or abuse the service.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">4. Your data is yours</h2>
            <p className="mt-3">You own all data you connect or generate. We act as a processor to power your workspace and never claim ownership.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">5. Liability</h2>
            <p className="mt-3">Gerendo is provided "as is." We work hard to keep it reliable, but we're not liable for indirect damages.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">6. Changes</h2>
            <p className="mt-3">We may update these terms. Material changes will be communicated by email.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
