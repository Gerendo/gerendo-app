"use client";

import { useState, useRef } from "react";

type Source = { subject: string; sender: string; date: string; url: string };

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [warning, setWarning] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || status === "loading") return;

    setStatus("loading");
    setAnswer("");
    setSources([]);
    setWarning("");
    setError("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.error === "no_results") {
          setError("Nothing found. Try syncing your emails first.");
        } else {
          setError(err.error ?? "Something went wrong");
        }
        setStatus("error");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "warning") setWarning(data.text);
          if (data.type === "sources") setSources(data.sources);
          if (data.type === "token") setAnswer((prev) => prev + data.text);
          if (data.type === "done") setStatus("done");
        }
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setStatus("error");
    }
  }

  function handleReset() {
    setQuery("");
    setAnswer("");
    setSources([]);
    setWarning("");
    setError("");
    setStatus("idle");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-8 pt-24">
      <div className="max-w-2xl w-full flex flex-col gap-8">

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ask your agency brain</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Search across your emails and messages.{" "}
            <a href="/connect" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              Sync emails
            </a>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What did we tell Acme about the launch?"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            disabled={status === "loading"}
            autoFocus
          />
          <button
            type="submit"
            disabled={!query.trim() || status === "loading"}
            className="bg-white text-black text-sm font-medium px-5 py-3 rounded-lg hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? "..." : "Ask"}
          </button>
        </form>

        {warning && (
          <p className="text-yellow-500 text-xs">{warning}</p>
        )}

        {error && (
          <div className="flex flex-col gap-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={handleReset} className="text-zinc-500 text-xs underline underline-offset-2 w-fit">
              Ask something else
            </button>
          </div>
        )}

        {(answer || status === "loading") && (
          <div className="flex flex-col gap-6">
            <div className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
              {answer}
              {status === "loading" && <span className="inline-block w-1 h-4 bg-zinc-400 ml-1 animate-pulse" />}
            </div>

            {sources.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-zinc-600 uppercase tracking-wider">Sources</p>
                {sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-0.5 p-3 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors"
                  >
                    <span className="text-sm text-white font-medium">{s.subject}</span>
                    <span className="text-xs text-zinc-500">{s.sender} · {s.date}</span>
                  </a>
                ))}
              </div>
            )}

            {status === "done" && (
              <button onClick={handleReset} className="text-zinc-600 text-xs underline underline-offset-2 w-fit hover:text-zinc-400">
                Ask something else
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
