import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security - Gerendo" },
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
            <h2 className="font-display text-2xl text-foreground">Encrypted at rest with a key only Gerendo holds</h2>
            <p className="mt-3">
              Email body content, AI-generated summaries, extracted facts, and OAuth tokens are encrypted with AES-256-GCM before they reach Postgres. The master key lives in our application environment (Vercel), separate from Supabase. A leaked database snapshot, a Supabase staff member, or a compromised service-role token sees only ciphertext.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">The three layers, in plain English</h2>
            <p className="mt-3">
              The honest answer to "can anyone read my messages?" is layered.
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">At rest in Supabase.</strong> Encrypted with AES-256-GCM. Key held by Gerendo, not Supabase.</li>
              <li><strong className="text-foreground">In transit.</strong> TLS 1.3 everywhere, between you, our app, the database, and our LLM provider.</li>
              <li><strong className="text-foreground">During Claude inference.</strong> Relevant snippets are decrypted in our application server and sent over TLS to Anthropic Claude. Per Anthropic's standard commercial terms, prompts may be retained up to 30 days for abuse monitoring. Anthropic does not train models on your data.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">Technical specifics</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Encryption.</strong> AES-256-GCM with a 12-byte nonce, GCM authentication tag, and AAD bound to (table, column, row identity).</li>
              <li><strong className="text-foreground">Key storage.</strong> Vercel environment variable, never persisted to disk, rotatable.</li>
              <li><strong className="text-foreground">Database.</strong> Supabase Postgres with Row Level Security for tenant isolation.</li>
              <li><strong className="text-foreground">Transport.</strong> TLS 1.3 throughout.</li>
              <li><strong className="text-foreground">LLM provider.</strong> Anthropic Claude (Haiku 4.5 and Sonnet 4.6).</li>
              <li><strong className="text-foreground">Data retention at the LLM.</strong> Anthropic standard terms, up to 30 days for abuse monitoring, no training on your data.</li>
              <li><strong className="text-foreground">Compliance.</strong> SOC 2 path planned for a later phase. We do not claim certification today.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">RLS for tenant isolation, encryption for operator isolation</h2>
            <p className="mt-3">
              Postgres Row Level Security stops one tenant from reading another tenant's rows. That is necessary but not sufficient. RLS does not stop a database operator with a service-role key, a Supabase staff member, or a leaked snapshot. Application-layer encryption does, because the key is not in Supabase. We use both, and we keep the line between them clear.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">Never used to train AI</h2>
            <p className="mt-3">
              Your data is not anyone's training set. We route through Anthropic's standard commercial API, which does not train on customer data. We do not train our own models on your data.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">Permission-aware</h2>
            <p className="mt-3">
              Gerendo respects the access controls in your source tools. If a teammate cannot see a Drive file, Gerendo will not show them an answer based on it.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">You own the off switch</h2>
            <p className="mt-3">
              Disconnect any source in one click. Export everything. Delete it all, permanently, whenever you want.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-foreground">What we deliberately do not claim</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>Not "zero-knowledge". We hold the encryption key.</li>
              <li>Not "end-to-end encrypted". That term means only sender and recipient hold keys, which does not apply to a RAG product.</li>
              <li>Not "even our engineers cannot read your messages" without the operator-level qualifier. During a chat query, snippets are decrypted briefly in process memory on our app server. We claim operator-level isolation (the database operator cannot read your content), not absolute isolation.</li>
            </ul>
          </section>

        </div>
      </main>
    </div>
  );
}
