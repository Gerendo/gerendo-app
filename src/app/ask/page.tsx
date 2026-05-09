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
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    // Check if user has tools connected and data synced
    Promise.all([
      fetch("/api/nango/status").then(r => r.json()).catch(() => ({ connected: false, driveConnected: false, asanaConnected: false })),
      fetch("/api/sync/status").then(r => r.json()).catch(() => ({ totalSynced: 0 })),
    ]).then(([status, syncStatus]) => {
      const anyConnected = status.connected || status.driveConnected || status.asanaConnected;
      if (!anyConnected) {
        setSetupState("no-tools");
      } else if (!syncStatus.totalSynced || syncStatus.totalSynced === 0) {
        setSetupState("no-data");
      } else {
        setSetupState("ready");
      }
    });
  }, []);

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
    <div className="min-h-screen bg-[oklch(0.11_0.008_55)] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[oklch(1_0_0_/_8%)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Gerendo</h1>
          <p className="text-[oklch(0.55_0.012_60)] text-xs mt-0.5">Ask anything across your emails, Drive, and Asana</p>
        </div>
        <a href="/connect" className="text-[oklch(0.55_0.012_60)] text-xs underline underline-offset-2 hover:text-[oklch(0.78_0.14_65)] transition-colors">
          Manage connections
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        {messages.length === 0 && !loading && setupState === "checking" && (
          <div className="flex items-center justify-center mt-20">
            <div className="w-1 h-1 rounded-full bg-[oklch(0.45_0.01_60)] animate-pulse" />
          </div>
        )}

        {messages.length === 0 && !loading && setupState === "no-tools" && (
          <div className="flex flex-col items-center text-center gap-6 mt-16 px-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>
                Welcome to Gerendo
              </h2>
              <p className="text-[oklch(0.65_0.015_60)] text-sm max-w-sm">
                Connect your tools to get started. Gerendo indexes your emails, files, and tasks so you can ask questions across all of them.
              </p>
            </div>
            <a
              href="/connect"
              className="px-8 py-3 text-sm font-semibold rounded-[var(--radius-xl)] transition-colors hover:opacity-90"
              style={{ background: "oklch(0.78 0.14 65)", color: "oklch(0.11 0.008 55)" }}
            >
              Connect your tools
            </a>
            <div className="flex flex-col gap-2 w-full max-w-sm mt-2">
              {["Gmail", "Google Drive", "Asana"].map((tool) => (
                <div key={tool} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[oklch(1_0_0_/_8%)]">
                  <div className="w-2 h-2 rounded-full bg-[oklch(1_0_0_/_15%)]" />
                  <span className="text-sm text-[oklch(0.65_0.015_60)]">{tool} — not connected</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && !loading && setupState === "no-data" && (
          <div className="flex flex-col items-center text-center gap-6 mt-16 px-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>
                Tools connected — sync your data
              </h2>
              <p className="text-[oklch(0.65_0.015_60)] text-sm max-w-sm">
                Your tools are connected but nothing has been indexed yet. Run a sync to start building your agency brain.
              </p>
            </div>
            <a
              href="/connect"
              className="px-8 py-3 text-sm font-semibold rounded-[var(--radius-xl)] transition-colors hover:opacity-90"
              style={{ background: "oklch(0.78 0.14 65)", color: "oklch(0.11 0.008 55)" }}
            >
              Sync your data
            </a>
          </div>
        )}

        {messages.length === 0 && !loading && setupState === "ready" && (
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
              <div className="bg-[oklch(0.16_0.01_55)] text-white text-sm px-4 py-3 rounded-2xl rounded-tr-sm max-w-sm">
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

      {/* Input */}
      <div className="border-t border-[oklch(1_0_0_/_8%)] px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about your emails, files, or tasks..."
            className="flex-1 bg-[oklch(0.13_0.009_55)] border border-[oklch(1_0_0_/_12%)] rounded-2xl px-4 py-3 text-sm text-[oklch(0.96_0.012_80)] placeholder:text-[oklch(0.45_0.01_60)] focus:outline-none focus:border-[oklch(0.78_0.14_65)]"
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="bg-[oklch(0.78_0.14_65)] text-[oklch(0.11_0.008_55)] text-sm font-semibold px-5 py-3 rounded-2xl hover:bg-[oklch(0.85_0.08_70)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
