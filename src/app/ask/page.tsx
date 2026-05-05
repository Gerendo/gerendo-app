"use client";

import { useState, useRef, useEffect } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Build history array for API (last 10 turns)
  function buildHistory(): Array<{ role: "user" | "assistant"; content: string }> {
    return messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
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
      let warning = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "warning") warning = data.text;
          if (data.type === "sources") {
            sources = data.sources;
            setStreamingSources(data.sources);
          }
          if (data.type === "token") {
            fullAnswer += data.text;
            setStreamingText(fullAnswer);
          }
          if (data.type === "done") {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: fullAnswer,
              sources,
              warning: warning || undefined,
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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">Agency Brain</h1>
          <p className="text-zinc-500 text-xs">Ask anything about your emails</p>
        </div>
        <a href="/connect" className="text-zinc-500 text-xs underline underline-offset-2 hover:text-white">
          Sync emails
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col gap-3 mt-8">
            <p className="text-zinc-500 text-sm">Try asking:</p>
            {[
              "What are my last 5 emails?",
              "What did Jennifer say to me?",
              "Any emails about invoices this week?",
              "Summarize what's happening with the Acme project",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => { setQuery(suggestion); inputRef.current?.focus(); }}
                className="text-left text-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 rounded-lg px-4 py-3 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "user" ? (
              <div className="bg-zinc-800 text-white text-sm px-4 py-3 rounded-2xl rounded-tr-sm max-w-sm">
                {msg.content}
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-full">
                {msg.warning && (
                  <p className="text-yellow-500 text-xs">{msg.warning}</p>
                )}
                <div className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <p className="text-xs text-zinc-600 uppercase tracking-wider">Sources</p>
                    {msg.sources.map((s, j) => (
                      <a
                        key={j}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col gap-0.5 p-3 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors"
                      >
                        <span className="text-xs text-white font-medium">{s.subject}</span>
                        <span className="text-xs text-zinc-500">{s.sender} · {s.date} · <span className="text-zinc-600">{s.mailbox ?? "inbox"}</span></span>
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
                <p className="text-xs text-zinc-600 uppercase tracking-wider">Sources</p>
                {streamingSources.map((s, j) => (
                  <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col gap-0.5 p-3 rounded-lg border border-zinc-800">
                    <span className="text-xs text-white font-medium">{s.subject}</span>
                    <span className="text-xs text-zinc-500">{s.sender} · {s.date}</span>
                  </a>
                ))}
              </div>
            )}
            <div className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
              {streamingText}
              <span className="inline-block w-1 h-4 bg-zinc-400 ml-1 animate-pulse" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about your emails..."
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="bg-white text-black text-sm font-medium px-5 py-3 rounded-xl hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
