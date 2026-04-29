import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Gerendo" },
      { name: "description", content: "How Gerendo uses cookies and similar technologies." },
    ],
  }),
  component: Cookies,
});

function Cookies() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
        <Link to="/"><Wordmark /></Link>
        <Link to="/" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">← Back</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">Legal</p>
        <h1 className="mt-4 font-display text-5xl tracking-tight">Cookie Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: April 2026</p>

        <div className="mt-12 space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="font-display text-2xl text-foreground">Essential cookies</h2>
            <p className="mt-3">We use a small number of essential cookies to keep you logged in and to remember workspace preferences. These can't be turned off without breaking the app.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">Analytics</h2>
            <p className="mt-3">We use privacy-respecting, cookieless analytics to understand how Gerendo is used. We do not use third-party advertising trackers.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">Your choice</h2>
            <p className="mt-3">You can clear cookies any time from your browser settings.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
