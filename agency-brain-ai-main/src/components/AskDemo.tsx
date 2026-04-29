import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const SAMPLES = [
  {
    q: "What did Acme decide about the homepage redesign?",
    a: "Acme approved the warm-neutral direction on Tue. Final scope: 5 pages, launch May 12.",
    sources: [
      { app: "Gmail", who: "lena@acme.co", when: "Tue 14:02" },
      { app: "Asana", who: "Homepage v3 · comment", when: "Tue 16:18" },
      { app: "WhatsApp", who: "Acme · #project", when: "Wed 09:41" },
    ],
  },
  {
    q: "Where are we with Marengo's Q2 deliverables?",
    a: "3 of 5 shipped. Brand guidelines pending Maria's review since Mon. Video edit blocked on raw assets.",
    sources: [
      { app: "Asana", who: "Marengo Q2 board", when: "today" },
      { app: "Drive", who: "/Marengo/2026-Q2", when: "Mon" },
    ],
  },
  {
    q: "Did anyone reply to the Northwind invoice question?",
    a: "Yes — Dani confirmed net-30 in WhatsApp 22 min ago. Not yet logged in Asana.",
    sources: [
      { app: "WhatsApp", who: "Dani · Northwind", when: "22m ago" },
    ],
  },
];

const APP_COLORS: Record<string, string> = {
  Gmail: "oklch(0.7 0.16 25)",
  Asana: "oklch(0.72 0.18 350)",
  Drive: "oklch(0.75 0.15 130)",
  WhatsApp: "oklch(0.72 0.16 150)",
  Meet: "oklch(0.72 0.16 240)",
  Discord: "oklch(0.7 0.14 270)",
};

export function AskDemo() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "thinking" | "answer">("typing");

  useEffect(() => {
    const sample = SAMPLES[i];
    setTyped("");
    setPhase("typing");
    let idx = 0;
    const typer = setInterval(() => {
      idx++;
      setTyped(sample.q.slice(0, idx));
      if (idx >= sample.q.length) {
        clearInterval(typer);
        setPhase("thinking");
        setTimeout(() => setPhase("answer"), 900);
        setTimeout(() => setI((p) => (p + 1) % SAMPLES.length), 5800);
      }
    }, 28);
    return () => clearInterval(typer);
  }, [i]);

  const sample = SAMPLES[i];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-card">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-ember pulse-dot" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            ask.gerendo
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/60">⌘K</span>
      </div>

      {/* prompt */}
      <div className="px-6 pt-6">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 font-mono text-xs text-ember">›</span>
          <p className="font-display text-xl leading-snug text-foreground md:text-2xl">
            {typed}
            <span className="ml-0.5 inline-block h-5 w-[2px] translate-y-0.5 bg-ember align-middle animate-pulse" />
          </p>
        </div>
      </div>

      {/* answer */}
      <div className="min-h-[220px] px-6 pb-6 pt-5">
        <AnimatePresence mode="wait">
          {phase === "thinking" && (
            <motion.div
              key="think"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 font-mono text-xs text-muted-foreground"
            >
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-ember/70 pulse-dot" />
                <span className="h-1.5 w-1.5 rounded-full bg-ember/70 pulse-dot" style={{ animationDelay: "0.2s" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-ember/70 pulse-dot" style={{ animationDelay: "0.4s" }} />
              </span>
              reading 4 tools · 1,284 messages · 22 docs
            </motion.div>
          )}

          {phase === "answer" && (
            <motion.div
              key={`ans-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-pretty text-[15px] leading-relaxed text-foreground/90">
                {sample.a}
              </p>

              <div className="mt-5 space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Sources
                </div>
                {sample.sources.map((s, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + idx * 0.08 }}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[13px] hover:border-ember/40"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: APP_COLORS[s.app] || "var(--ember)" }}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      {s.app}
                    </span>
                    <span className="text-foreground/80">{s.who}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                      {s.when}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
