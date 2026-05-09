"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

type Source = { subject: string; sender: string; date: string; url: string; mailbox?: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  warning?: string;
};

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSources, setStreamingSources] = useState<Source[]>([]);
  const [setupState, setSetupState] = useState<"checking" | "no-tools" | "no-data" | "ready">("checking");
  const [syncingInBackground, setSyncingInBackground] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    Promise.all([
      fetch("/api/nango/status").then(r => r.json()).catch(() => ({ connected: false, driveConnected: false, asanaConnected: false })),
      fetch("/api/sync/status").then(r => r.json()).catch(() => ({ totalSynced: 0, status: "idle" })),
      fetch("/api/workspace/info").then(r => r.json()).catch(() => ({ emailCount: 0, driveCount: 0, asanaCount: 0 })),
    ]).then(([status, syncStatus, info]) => {
      const anyConnected = status.connected || status.driveConnected || status.asanaConnected;
      const totalIndexed = (info.emailCount ?? 0) + (info.driveCount ?? 0) + (info.asanaCount ?? 0);

      if (!anyConnected) {
        setSetupState("no-tools");
      } else if (totalIndexed === 0) {
        setSetupState("no-data");
        if (syncStatus.status === "running") {
          setSyncingInBackground(true);
          startSyncPoll();
        }
      } else {
        setSetupState("ready");
        if (syncStatus.status === "running") {
          setSyncingInBackground(true);
          setSyncCount(syncStatus.totalSynced);
          startSyncPoll();
        }
      }
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function startSyncPoll() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await fetch("/api/sync/status").then(r => r.json());
        if (job.totalSynced) setSyncCount(job.totalSynced);
        if (job.status === "done") {
          setSyncingInBackground(false);
          setSetupState("ready");
          setToast(`Sync complete — ${job.totalSynced?.toLocaleString() ?? 0} items indexed.`);
          setTimeout(() => setToast(null), 5000);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (job.status === "error") {
          setSyncingInBackground(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 3000);
  }

  // Build history for API — last 4 messages (2 exchanges) only.
  // Assistant content is truncated to 300 chars so prior verbose answers
  // don't carry full email dumps back into every subsequent prompt.
  function buildHistory(): Array<{ role: "user" | "assistant"; content: string }> {
    return messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.role === "assistant" && m.content.length > 300
        ? m.content.slice(0, 300) + "…"
        : m.content,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userQuery = query.trim();
    setQuery("");
    setLoading(true);
    setStreamingText("");
    setStreamingSources([]);

    // Add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: userQuery }]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery, history: buildHistory() }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const err = await res.json();
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: err.error === "no_results"
            ? "I couldn't find any relevant emails for that. Try rephrasing or sync more emails."
            : (err.error ?? "Something went wrong."),
        }]);
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";
      let sources: Source[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "source") {
            // Sources arrive one at a time as Claude fetches layers
            sources = [...sources, data.source];
            setStreamingSources([...sources]);
          }
          if (data.type === "token") {
            fullAnswer += data.text;
            setStreamingText(fullAnswer);
          }
          if (data.type === "done") {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: fullAnswer,
              sources: sources.length > 0 ? sources : undefined,
            }]);
            setStreamingText("");
            setStreamingSources([]);
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: err.message ?? "Something went wrong.",
      }]);
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="h-dvh bg-[oklch(0.11_0.008_55)] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="relative border-b border-[oklch(1_0_0_/_8%)] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <a href="/ask" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Gerendo</h1>
          <p className="text-[oklch(0.55_0.012_60)] text-xs mt-0.5">Ask anything about your workspace</p>
        </a>
        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-2">
          <a href="/connect" className="text-sm font-medium px-3 py-2 rounded-xl transition-colors hover:opacity-90"
            style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.78 0.14 65)", border: "1px solid oklch(1 0 0 / 10%)" }}>
            Connect tools
          </a>
          <a href="/settings" className="text-sm font-medium px-3 py-2 rounded-xl transition-colors hover:opacity-90"
            style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.65 0.015 60)", border: "1px solid oklch(1 0 0 / 10%)" }}>
            Settings
          </a>
          <a href="/api/auth/signout" className="text-sm px-3 py-2 rounded-xl transition-colors hover:opacity-90"
            style={{ color: "oklch(0.55 0.012 60)", border: "1px solid oklch(1 0 0 / 10%)" }}>
            Log out
          </a>
        </div>
        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-xl transition-colors"
          style={{ color: "oklch(0.65 0.015 60)", border: "1px solid oklch(1 0 0 / 10%)" }}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor"/>
            <rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor"/>
            <rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute top-full left-0 right-0 z-50 flex flex-col gap-1 px-4 py-3 sm:hidden"
            style={{ background: "oklch(0.13 0.009 55)", borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
            <a href="/connect" className="text-sm font-medium py-2.5 transition-colors hover:opacity-80"
              style={{ color: "oklch(0.78 0.14 65)" }}>
              Connect tools
            </a>
            <a href="/settings" className="text-sm py-2.5 transition-colors hover:opacity-80"
              style={{ color: "oklch(0.65 0.015 60)" }}>
              Settings
            </a>
            <a href="/api/auth/signout" className="text-sm py-2.5 transition-colors hover:opacity-80"
              style={{ color: "oklch(0.55 0.012 60)" }}>
              Log out
            </a>
          </div>
        )}
      </div>

      {/* Sync banner with progress bar */}
      {syncingInBackground && (
        <div className="flex flex-col gap-1.5 px-6 py-2.5" style={{ background: "oklch(0.78 0.14 65 / 8%)", borderBottom: "1px solid oklch(0.78 0.14 65 / 15%)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.85 0.08 70)" }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "oklch(0.78 0.14 65)" }} />
              Syncing your workspace in the background
            </div>
            <span className="text-xs font-medium" style={{ color: "oklch(0.78 0.14 65)" }}>
              {syncCount > 0 ? `${Math.min(Math.round((syncCount / 2000) * 100), 99)}%` : "0%"}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.16 0.01 55)" }}>
            <div className="h-full rounded-full" style={{ width: syncCount > 0 ? `${Math.min((syncCount / 2000) * 100, 99)}%` : "3%", background: "oklch(0.78 0.14 65)", transition: "width 0.8s ease" }} />
          </div>
          {syncCount > 0 && (
            <p className="text-xs" style={{ color: "oklch(0.55 0.012 60)" }}>{syncCount.toLocaleString()} items indexed so far</p>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-medium shadow-lg z-50 cursor-pointer"
          style={{ background: "oklch(0.78 0.14 65)", color: "oklch(0.11 0.008 55)" }}
          onClick={() => setToast(null)}
        >
          {toast}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 max-w-2xl mx-auto w-full min-h-0">
        {messages.length === 0 && !loading && setupState === "checking" && (
          <div className="flex items-center justify-center mt-20">
            <div className="w-1 h-1 rounded-full bg-[oklch(0.45_0.01_60)] animate-pulse" />
          </div>
        )}

        {messages.length === 0 && !loading && setupState === "no-tools" && (
          <div className="mx-auto max-w-sm mt-10 px-4 py-3 rounded-2xl border border-[oklch(0.78_0.14_65/_25%)] text-sm text-center"
               style={{ background: "oklch(0.78 0.14 65 / 6%)", color: "oklch(0.78 0.14 65)" }}>
            No tools connected yet.{" "}
            <a href="/connect" className="underline underline-offset-2 hover:opacity-80">
              Connect Gmail, Drive, or Asana
            </a>{" "}
            for full search — or ask a general question.
          </div>
        )}

        {messages.length === 0 && !loading && setupState === "no-data" && (
          <div className="mx-auto max-w-sm mt-10 px-4 py-3 rounded-2xl border border-[oklch(0.78_0.14_65/_25%)] text-sm text-center"
               style={{ background: "oklch(0.78 0.14 65 / 6%)", color: "oklch(0.78 0.14 65)" }}>
            Tools connected but not synced yet.{" "}
            <a href="/connect" className="underline underline-offset-2 hover:opacity-80">
              Sync your data
            </a>{" "}
            for full answers — or ask anyway.
          </div>
        )}

        {messages.length === 0 && !loading && (setupState === "ready" || setupState === "no-data") && (
          <div className="flex flex-col gap-3 mt-8">
            <p className="text-[oklch(0.55_0.012_60)] text-sm">Try asking:</p>
            {[
              "What are my last 5 emails?",
              "What tasks are overdue in Asana?",
              "Any emails about invoices this week?",
              "Summarize what's happening with the Acme project",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => { setQuery(suggestion); inputRef.current?.focus(); }}
                className="text-left text-sm text-[oklch(0.65_0.015_60)] hover:text-white border border-[oklch(1_0_0_/_8%)] hover:border-[oklch(1_0_0_/_18%)] rounded-2xl px-4 py-3 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "user" ? (
              <div className="bg-[oklch(0.16_0.01_55)] text-white text-sm px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%]">
                {msg.content}
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-full">
                {msg.warning && (
                  <p className="text-yellow-500 text-xs">{msg.warning}</p>
                )}
                <div className="text-sm text-zinc-100 leading-relaxed prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <p className="text-xs text-[oklch(0.45_0.01_60)] uppercase tracking-wider">Sources</p>
                    {msg.sources.map((s, j) => (
                      <a
                        key={j}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col gap-0.5 p-3 rounded-2xl border border-[oklch(1_0_0_/_8%)] hover:border-[oklch(1_0_0_/_18%)] transition-colors"
                      >
                        <span className="text-xs text-white font-medium">{s.subject}</span>
                        <span className="text-xs text-[oklch(0.55_0.012_60)]">{s.sender} · {s.date} · <span className="text-[oklch(0.45_0.01_60)]">{s.mailbox ?? "inbox"}</span></span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {loading && (
          <div className="flex flex-col gap-3 items-start">
            {streamingSources.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-[oklch(0.45_0.01_60)] uppercase tracking-wider">Sources</p>
                {streamingSources.map((s, j) => (
                  <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col gap-0.5 p-3 rounded-2xl border border-[oklch(1_0_0_/_8%)]">
                    <span className="text-xs text-white font-medium">{s.subject}</span>
                    <span className="text-xs text-[oklch(0.55_0.012_60)]">{s.sender} · {s.date}</span>
                  </a>
                ))}
              </div>
            )}
            <div className="text-sm text-zinc-100 leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{streamingText}</ReactMarkdown>
              <span className="inline-block w-1 h-4 bg-zinc-400 ml-1 animate-pulse" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input - always shown */}
      {setupState !== "checking" && (
        <div className="border-t border-[oklch(1_0_0_/_8%)] px-4 py-3 flex-shrink-0 bg-[oklch(0.11_0.008_55)]">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your workspace..."
              className="flex-1 bg-[oklch(0.13_0.009_55)] border border-[oklch(1_0_0_/_12%)] rounded-2xl px-4 py-3 text-sm text-[oklch(0.96_0.012_80)] placeholder:text-[oklch(0.45_0.01_60)] focus:outline-none focus:border-[oklch(0.78_0.14_65)]"
              style={{ fontSize: "16px" }}
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="bg-[oklch(0.78_0.14_65)] text-[oklch(0.11_0.008_55)] text-sm font-semibold px-5 py-3 rounded-2xl hover:bg-[oklch(0.85_0.08_70)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {loading ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
