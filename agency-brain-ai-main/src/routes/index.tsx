import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Wordmark } from "@/components/Wordmark";
import { BrainOrb } from "@/components/BrainOrb";
import { AskDemo } from "@/components/AskDemo";
import { Marquee } from "@/components/Marquee";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerendo - One brain for your whole business" },
      {
        name: "description",
        content:
          "Gerendo is your business's brain. One OS connecting every tool you use, remembering every decision, answering anything your team asks.",
      },
      { property: "og:title", content: "Gerendo - One brain for your whole business" },
      {
        property: "og:description",
        content:
          "Gerendo is your business's brain. One OS connecting every tool you use, remembering every decision, answering anything your team asks.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-60 mix-blend-overlay" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-ember/10 blur-[140px]" />

      <Nav onWaitlistOpen={() => setWaitlistOpen(true)} />
      <Hero onWaitlistOpen={() => setWaitlistOpen(true)} />
      <Marquee />
      <Pillars />
      <Showcase />
      <MeetingsToSOPs />
      <BringYourAI />
      <Security />
      <Pricing onWaitlistOpen={() => setWaitlistOpen(true)} />
      <Manifesto />
      <Footer />

      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </div>
  );
}

function Nav({ onWaitlistOpen }: { onWaitlistOpen: () => void }) {
  return (
    <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
      <Wordmark />
      <nav className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:flex">
        <a href="#how" className="hover:text-foreground">How it works</a>
        <a href="#meetings" className="hover:text-foreground">Meetings</a>
        <a href="#ai" className="hover:text-foreground">Your AI</a>
        <a href="#security" className="hover:text-foreground">Security</a>
        <a href="#pricing" className="hover:text-foreground">Pricing</a>
      </nav>
      <button
        onClick={onWaitlistOpen}
        className="rounded-full border border-border bg-background/40 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-foreground backdrop-blur transition hover:border-ember/60 hover:text-ember"
      >
        Get early access
      </button>
    </header>
  );
}

function Hero({ onWaitlistOpen }: { onWaitlistOpen: () => void }) {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-16 md:px-10 md:pb-32 md:pt-24">
      <div className="grid gap-16 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3.5 py-1.5 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ember pulse-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Built for modern businesses
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display text-balance text-[clamp(2.75rem,7vw,5.5rem)] font-medium leading-[0.95] tracking-tight"
          >
            One{" "}
            <em className="italic text-ember">brain</em>
            <br />
            for your whole business.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl"
          >
            Your team's knowledge is scattered across Gmail, Drive, Asana, Meet,
            WhatsApp, and a dozen other tools. Gerendo brings it all into one place
            your team can simply{" "}
            <em className="font-display italic text-foreground/90">talk to</em> -
            and get answers backed by the source.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <button
              onClick={onWaitlistOpen}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-ember px-6 py-3.5 text-sm font-medium text-primary-foreground ember-glow transition hover:scale-[1.02]"
            >
              Get early access
              <span className="transition group-hover:translate-x-0.5">→</span>
            </button>
            <a
              href="#how"
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
            >
              See how it works ↓
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70"
          >
            <span>Cited answers</span>
            <span className="h-px w-6 bg-border" />
            <span>Your choice of AI</span>
            <span className="h-px w-6 bg-border" />
            <span>Never trained on your data</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.2 }}
          className="relative mx-auto w-full max-w-md"
        >
          <BrainOrb />
        </motion.div>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    {
      n: "01",
      tag: "Ask",
      title: "Ask anything. Get cited answers.",
      body: "“What did Acme decide about the homepage?” - answered in seconds with links to the Gmail thread, the WhatsApp message, and the Asana comment that prove it.",
    },
    {
      n: "02",
      tag: "Drift",
      title: "Catch the drift before it ships.",
      body: "When a client says one thing in WhatsApp and your Asana task says another, Gerendo surfaces the conflict before someone sends the wrong file to the wrong person.",
    },
    {
      n: "03",
      tag: "Memory",
      title: "Your whole company, on tap.",
      body: "New hires query your business's full memory instead of interrupting senior staff. Every account, every decision, every nuance - answerable on day one.",
    },
  ];
  return (
    <section id="how" className="relative z-10 mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
      <div className="mb-16 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
          What it does for you
        </p>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
          A closed loop, <em className="italic text-muted-foreground">not</em> another dashboard.
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {items.map((it, i) => (
          <motion.article
            key={it.n}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card/40 p-7 backdrop-blur-sm transition hover:border-ember/40"
          >
            <div className="mb-8 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {it.n} · {it.tag}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-ember/60 transition group-hover:bg-ember group-hover:shadow-[0_0_12px_var(--ember)]" />
            </div>
            <h3 className="font-display text-2xl leading-tight tracking-tight text-foreground">
              {it.title}
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              {it.body}
            </p>
          </motion.article>
        ))}
      </div>

      <p className="mt-10 max-w-2xl font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
        …and a lot more as your business grows with it.
      </p>
    </section>
  );
}

function Showcase() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
            Live in your team
          </p>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            The question is the interface.
          </h2>
          <p className="mt-5 max-w-md text-pretty text-muted-foreground">
            No new tabs. No setup theater. Hit{" "}
            <kbd className="mx-1 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd>
            anywhere and ask. Gerendo reads across every tool you've connected and answers
            with the receipts.
          </p>
          <ul className="mt-8 space-y-3 font-mono text-[12px] uppercase tracking-wider text-muted-foreground">
            <li className="flex items-center gap-3"><span className="h-px w-6 bg-ember" /> Cited every time</li>
            <li className="flex items-center gap-3"><span className="h-px w-6 bg-ember" /> Permission-aware</li>
            <li className="flex items-center gap-3"><span className="h-px w-6 bg-ember" /> Streamed answers · sub-second</li>
          </ul>
        </div>
        <AskDemo />
      </div>
    </section>
  );
}

function MeetingsToSOPs() {
  const flow = [
    {
      tag: "01 · Capture",
      title: "Every meeting becomes context.",
      body: "Gerendo turns your Google Meet calls into clean summaries - decisions, owners, deadlines, blockers - so nothing important gets lost in someone's notebook.",
    },
    {
      tag: "02 · Remember",
      title: "Your business never forgets.",
      body: "Past calls, past decisions, past clients - all searchable. Ask “what did we promise the client in March?” and get the answer with the timestamp.",
    },
    {
      tag: "03 · Act",
      title: "Turn talk into tasks.",
      body: "From the same conversation, Gerendo drafts the Asana tasks that need to happen - owners assigned, context attached. You review, you ship.",
    },
  ];

  return (
    <section
      id="meetings"
      className="relative z-10 mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36"
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
            Meetings → memory → action
          </p>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            Stop running the process. <em className="italic text-muted-foreground">Let it run itself.</em>
          </h2>
          <p className="mt-6 max-w-md text-pretty text-muted-foreground">
            Every client call holds context that shapes the next three months of work - and
            most of it gets lost. Gerendo summarizes your meetings, remembers the history of
            your business, and uses it to draft the tasks and SOPs that move things forward.
          </p>
          <p className="mt-4 max-w-md text-pretty text-sm text-muted-foreground/80">
            You stop being the bottleneck. The work still ships.
          </p>
        </div>

        <div className="space-y-4">
          {flow.map((step, i) => (
            <motion.div
              key={step.tag}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/40 p-7 backdrop-blur-sm transition hover:border-ember/40"
            >
              <div className="flex items-baseline justify-between gap-6">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember/80">
                    {step.tag}
                  </span>
                  <h3 className="mt-3 font-display text-2xl leading-tight tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
                <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-ember/60 transition group-hover:bg-ember group-hover:shadow-[0_0_12px_var(--ember)] sm:block" />
              </div>
            </motion.div>
          ))}

          <div className="mt-6 rounded-2xl border border-ember/20 bg-gradient-to-br from-ember/5 to-transparent p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">
              The compounding effect
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/90">
              The more your business works, the smarter it gets. Patterns become playbooks.
              Playbooks become defaults. Your best operator's instincts become everyone's baseline.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BringYourAI() {
  const models = [
    { name: "Claude", note: "Anthropic" },
    { name: "GPT-4", note: "OpenAI" },
    { name: "Gemini", note: "Google" },
    { name: "Mistral", note: "EU API" },
  ];

  return (
    <section
      id="ai"
      className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32"
    >
      <div className="mb-14 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
          Use the AI you trust
        </p>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
          Pick your AI. <em className="italic text-muted-foreground">Any of them.</em>
        </h2>
        <p className="mt-5 max-w-xl text-pretty text-muted-foreground">
          Gerendo plugs into the AI tools you already know - Claude, ChatGPT, Gemini,
          Mistral. Use the one your team prefers. Switch any time. Your data is never
          used to train any of them.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {models.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="group rounded-xl border border-border bg-card/40 p-5 backdrop-blur-sm transition hover:border-ember/40"
          >
            <div className="font-display text-xl text-foreground">{m.name}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {m.note}
            </div>
            <div className="mt-3 h-1 w-6 rounded-full bg-border transition group-hover:bg-ember" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Security() {
  const items = [
    {
      title: "Security is a first principle.",
      body: "We're building Gerendo with security as a foundational concern - not something to bolt on later. Every architecture decision passes through it first.",
    },
    {
      title: "Never used to train AI.",
      body: "Your data is never used to train any model - ours or anyone else's. We route through zero-retention AI endpoints whenever available.",
    },
    {
      title: "Permission-aware by design.",
      body: "Gerendo will respect the access controls in your source tools. If a teammate can't see a file in Drive, they won't see an answer based on it.",
    },
    {
      title: "Multi-tenant from line one.",
      body: "Each workspace's data is isolated at the database level - never retrofitted, never shared by mistake. We're building this in from day one, not later.",
    },
    {
      title: "You own the off switch.",
      body: "Disconnect any source in one click. Export everything. Delete it all - permanently - whenever you want.",
    },
    {
      title: "Compliance on the roadmap.",
      body: "We're committed to SOC 2 and GDPR alignment as we grow. EU data residency is part of the plan. Ask us where we are today.",
    },
  ];

  return (
    <section
      id="security"
      className="relative z-10 mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36"
    >
      <div className="mb-14 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
          Security &amp; privacy
        </p>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
          Your data <em className="italic text-muted-foreground">stays</em> your data.
        </h2>
        <p className="mt-5 max-w-xl text-pretty text-muted-foreground">
          The whole point of Gerendo is that it knows your business. So we built it from day
          one assuming you'd ask the hard questions about where that knowledge goes. Here are
          the answers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-sm transition hover:border-ember/40"
          >
            <h3 className="font-display text-xl tracking-tight text-foreground">
              {it.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {it.body}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-8">
        <Link
          to="/security"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember hover:text-foreground"
        >
          Read the full security overview →
        </Link>
      </div>
    </section>
  );
}

function Pricing({ onWaitlistOpen }: { onWaitlistOpen: () => void }) {
  return (
    <section
      id="pricing"
      className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32"
    >
      <div className="mb-12 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
          Pricing
        </p>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
          Free for the first <em className="italic text-ember">five</em>.
        </h2>
        <p className="mt-5 max-w-xl text-pretty text-muted-foreground">
          The first five businesses to come on board get Gerendo free, in exchange for
          working closely with us - sharing feedback, shaping the roadmap, helping us
          build the product your team actually wants.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-ember/30 bg-gradient-to-br from-ember/10 via-card/60 to-transparent p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-ember/20 blur-3xl" />
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">
            Founding partners · 5 spots
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-5xl tracking-tight">$0</span>
            <span className="text-sm text-muted-foreground">/ unlimited</span>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Full product. All integrations. Direct line to the team building it. In
            return: candid feedback and the willingness to help us get this right.
          </p>
          <button
            onClick={onWaitlistOpen}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ember px-6 py-3.5 text-sm font-medium text-primary-foreground ember-glow transition hover:scale-[1.01]"
          >
            Apply to be a founding partner →
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-8 backdrop-blur-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Everyone else
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-5xl tracking-tight">Soon</span>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Standard plans roll out once founding partners are happy. Join the waitlist
            and we'll be in touch - no spam, just an email when access opens.
          </p>
          <button
            onClick={onWaitlistOpen}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background/40 px-6 py-3.5 text-sm font-medium text-foreground transition hover:border-ember/60 hover:text-ember"
          >
            Join the waitlist
          </button>
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section
      id="manifesto"
      className="relative z-10 mx-auto max-w-5xl px-6 py-32 md:px-10 md:py-40"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
        Why now
      </p>
      <p className="mt-6 font-display text-balance text-[clamp(1.6rem,3.5vw,2.6rem)] leading-[1.2] tracking-tight">
        The big AI tools were built for the Fortune 1000 - they assume one giant company,
        one source of truth. But your business doesn't run that way. Your knowledge lives{" "}
        <span className="shimmer-text">between the tools</span> - in the WhatsApp thread
        nobody logged, the Drive folder nobody named, the meeting only one person remembers.
      </p>
      <p className="mt-6 max-w-3xl text-[17px] leading-relaxed text-muted-foreground">
        Gerendo was built for <em className="font-display italic text-foreground/90">how teams actually work</em>:
        messy, fast-moving, juggling clients across a dozen apps. It connects what you already use,
        learns the way your business operates, and turns it into something your whole team can talk to.
        No migration. No new system to learn. Just answers, where you already work.
      </p>
    </section>
  );
}

const WAITLIST_ENDPOINT = "https://app.gerendo.com/api/waitlist";

type WaitlistState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "ok" }
  | { status: "error"; message: string };

function WaitlistDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<WaitlistState>({ status: "idle" });

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setState({ status: "idle" });
        setEmail("");
      }, 200);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "submitting" });
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Something went wrong.");
      }
      setState({ status: "ok" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-3xl border-ember/20 bg-gradient-to-br from-card/95 to-background p-0 sm:max-w-lg">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-ember/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-ember/10 blur-3xl" />

        <div className="relative p-8 md:p-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">
            Early access
          </p>
          <DialogTitle asChild>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight">
              Give your business a <em className="italic">brain</em>.
            </h2>
          </DialogTitle>
          <DialogDescription asChild>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Drop your work email. We'll be in touch when your spot opens - and tell
              you if you qualify for one of the five free founding partner spots.
            </p>
          </DialogDescription>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Work email
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co"
                disabled={state.status === "submitting" || state.status === "ok"}
                className="flex-1 rounded-full border border-border bg-background/60 px-5 py-3.5 text-sm placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/30 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={state.status === "submitting" || state.status === "ok"}
                className="rounded-full bg-ember px-6 py-3.5 text-sm font-medium text-primary-foreground ember-glow transition hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
              >
                {state.status === "ok"
                  ? "✓ You're in"
                  : state.status === "submitting"
                    ? "Joining…"
                    : "Join waitlist"}
              </button>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {state.status === "ok"
                ? "Check your inbox - a note from contact@gerendo.com is on its way."
                : state.status === "error"
                  ? state.message
                  : "One email when access opens. No spam, ever."}
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 mx-auto max-w-7xl px-6 pb-12 pt-20 md:px-10">
      <div className="grid gap-10 border-t border-border pt-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            One brain for your whole business. Cited answers across every tool your team
            already uses.
          </p>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">Product</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><a href="#how" className="hover:text-foreground">How it works</a></li>
            <li><a href="#meetings" className="hover:text-foreground">Meetings</a></li>
            <li><a href="#ai" className="hover:text-foreground">Your AI</a></li>
            <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
          </ul>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">Trust</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/security" className="hover:text-foreground">Security</Link></li>
            <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
          </ul>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">Legal</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/terms" className="hover:text-foreground">Terms of Use</Link></li>
            <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/cookies" className="hover:text-foreground">Cookie Policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 md:flex-row md:items-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          gerendo.com · one brain for your business · © 2026
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Built with care.
        </div>
      </div>
    </footer>
  );
}
