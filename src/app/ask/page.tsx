"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase";

type Source = { ref: string; label: string; sublabel: string; url: string; kind: "gmail" | "drive" | "asana" };

function SmartLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  warning?: string;
};

const KIND_ICON: Record<string, string> = { gmail: "✉", drive: "📄", asana: "✓" };
const KIND_COLOR: Record<string, string> = {
  gmail: "oklch(0.55 0.12 250)",
  drive: "oklch(0.55 0.14 145)",
  asana: "oklch(0.6 0.16 25)",
};

function SourceChips({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {sources.map((s, i) => (
        <a
          key={i}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={s.sublabel}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium no-underline hover:opacity-80 transition-opacity"
          style={{ background: "oklch(0.18 0.01 55)", border: `1px solid ${KIND_COLOR[s.kind]}55`, color: KIND_COLOR[s.kind] }}
        >
          <span>{KIND_ICON[s.kind]}</span>
          <span className="max-w-[160px] truncate">{s.label}</span>
        </a>
      ))}
    </div>
  );
}

export default function AskPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);

  // Guard: verify session on mount AND on bfcache restore (back button on mobile Safari)
  useEffect(() => {
    const checkAuth = () => {
      createClient().auth.getUser().then(({ data }) => {
        if (!data.user) {
          router.replace("/login");
        } else {
          setAuthChecked(true);
        }
      });
    };

    checkAuth();

    // pageshow fires when page is restored from bfcache (persisted = true)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) checkAuth();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSources, setStreamingSources] = useState<Source[]>([]);
  const [setupState, setSetupState] = useState<"checking" | "no-tools" | "no-data" | "ready">("checking");
  const [syncingInBackground, setSyncingInBackground] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < 768;
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Load conversation from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("c");
    if (cid) {
      setConversationId(cid);
      fetch(`/api/conversations/${cid}/messages`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Setup state check
  useEffect(() => {
    Promise.all([
      fetch("/api/nango/status").then(r => r.json()).catch(() => ({ connected: false, driveConnected: false, asanaConnected: false })),
      fetch("/api/sync/status").then(r => r.json()).catch(() => ({ totalSynced: 0, status: "idle" })),
      fetch("/api/workspace/info").then(r => r.json()).catch(() => ({ emailCount: 0, driveCount: 0, asanaCount: 0 })),
    ]).then(([status, syncStatus, info]) => {
      const anyConnected = status.connected || status.driveConnected || status.asanaConnected;
      const totalIndexed = (info.emailCount ?? 0) + (info.driveCount ?? 0) + (info.asanaCount ?? 0);
      if (!anyConnected) setSetupState("no-tools");
      else if (totalIndexed === 0) {
        setSetupState("no-data");
        if (syncStatus.status === "running") { setSyncingInBackground(true); startSyncPoll(); }
      } else {
        setSetupState("ready");
        if (syncStatus.status === "running") { setSyncingInBackground(true); setSyncCount(syncStatus.totalSynced); startSyncPoll(); }
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

  function buildHistory(): Array<{ role: "user" | "assistant"; content: string }> {
    return messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.role === "assistant" && m.content.length > 300 ? m.content.slice(0, 300) + "…" : m.content,
    }));
  }

  function handleNewChat() {
    setMessages([]);
    setConversationId(null);
    setQuery("");
    window.history.pushState({}, "", "/ask");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSelectConversation(id: string) {
    setMessages([]);
    setConversationId(id);
    window.history.pushState({}, "", `/ask?c=${id}`);
    fetch(`/api/conversations/${id}/messages`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })));
        }
      })
      .catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function toggleSidebar() {
    setSidebarCollapsed(v => {
      const next = !v;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userQuery = query.trim();
    setQuery("");
    setLoading(true);
    setStreamingText("");
    setStreamingSources([]);
    setMessages((prev) => [...prev, { role: "user", content: userQuery }]);

    // Create conversation on first message
    let cid = conversationId;
    if (!cid) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userQuery.slice(0, 50) + (userQuery.length > 50 ? "..." : "") }),
        });
        const conv = await res.json();
        cid = conv.id;
        setConversationId(cid);
        window.history.pushState({}, "", `/ask?c=${cid}`);
      } catch {}
    }

    let fullAnswer = "";
    let sources: Source[] = [];

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery, history: buildHistory() }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const err = await res.json();
        let errorMessage: string;
        if (err.error === "monthly_limit_reached") {
          errorMessage = `You've used all ${err.limit} questions for this month. Your limit resets on the 1st. Contact support if you need more.`;
        } else if (err.error === "no_results") {
          errorMessage = "I couldn't find any relevant emails for that. Try rephrasing or sync more emails.";
        } else {
          errorMessage = err.error ?? "Something went wrong.";
        }
        setMessages((prev) => [...prev, { role: "assistant", content: errorMessage }]);
        setLoading(false);
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

          if (data.type === "source") { sources = [...sources, data.source]; setStreamingSources([...sources]); }
          if (data.type === "token") { fullAnswer += data.text; setStreamingText(fullAnswer); }
          if (data.type === "done") {
            setMessages((prev) => [...prev, { role: "assistant", content: fullAnswer, sources: sources.length > 0 ? sources : undefined }]);
            setStreamingText("");
            setStreamingSources([]);
          }
        }
      }
    } catch (err: any) {
      fullAnswer = err.message ?? "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", content: fullAnswer }]);
    }

    // Persist messages to DB
    if (cid && fullAnswer) {
      fetch(`/api/conversations/${cid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: userQuery }, { role: "assistant", content: fullAnswer }] }),
      }).catch(() => {});
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (!authChecked) return null;

  return (
    <div className="h-dvh flex relative overflow-hidden" style={{ background: "oklch(0.11 0.008 55)", color: "white" }}>

      {/* Sidebar */}
      <Sidebar
        currentConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="border-b border-[oklch(1_0_0_/_8%)] px-3 py-2.5 flex items-center gap-2 flex-shrink-0">
          {sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
              style={{ color: "oklch(0.55 0.012 60)" }}
              aria-label="Open sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M6 1v16" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
            </button>
          )}
          <span className="text-sm font-medium text-[oklch(0.55_0.012_60)]">
            {conversationId ? "" : "New chat"}
          </span>
        </div>

        {/* Sync banner */}
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
              <a href="/connect" className="underline underline-offset-2 hover:opacity-80">Connect Gmail, Drive, or Asana</a>{" "}
              for full search — or ask a general question.
            </div>
          )}
          {messages.length === 0 && !loading && setupState === "no-data" && (
            <div className="mx-auto max-w-sm mt-10 px-4 py-3 rounded-2xl border border-[oklch(0.78_0.14_65/_25%)] text-sm text-center"
              style={{ background: "oklch(0.78 0.14 65 / 6%)", color: "oklch(0.78 0.14 65)" }}>
              Tools connected but not synced yet.{" "}
              <a href="/connect" className="underline underline-offset-2 hover:opacity-80">Sync your data</a>{" "}
              for full answers — or ask anyway.
            </div>
          )}
          {messages.length === 0 && !loading && (setupState === "ready" || setupState === "no-data") && (
            <div className="flex flex-col gap-3 mt-8">
              <p className="text-[oklch(0.55_0.012_60)] text-sm">Try asking:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {["What are my last 5 emails?", "What tasks are overdue in Asana?", "Any emails about invoices this week?", "Summarize what's happening with the Acme project"].map((s) => (
                <button key={s} onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                  className="text-left text-sm text-[oklch(0.65_0.015_60)] hover:text-white border border-[oklch(1_0_0_/_8%)] hover:border-[oklch(1_0_0_/_18%)] rounded-2xl px-4 py-3 transition-colors line-clamp-2">
                  {s}
                </button>
              ))}
              </div>
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
                  {msg.warning && <p className="text-yellow-500 text-xs">{msg.warning}</p>}
                  <div className="text-sm text-zinc-100 leading-relaxed prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown components={{ a: ({ href, children }) => <SmartLink href={href ?? "#"} className="text-[oklch(0.7_0.12_250)] hover:underline">{children}</SmartLink> }}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex flex-col gap-3 items-start">
              <div className="text-sm text-zinc-100 leading-relaxed prose prose-invert prose-sm max-w-none">
                <ReactMarkdown components={{ a: ({ href, children }) => <SmartLink href={href ?? "#"} className="text-[oklch(0.7_0.12_250)] hover:underline">{children}</SmartLink> }}>{streamingText}</ReactMarkdown>
                <span className="inline-block w-1 h-4 bg-zinc-400 ml-1 animate-pulse" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {setupState !== "checking" && (
          <div className="border-t border-[oklch(1_0_0_/_8%)] px-4 py-3 flex-shrink-0" style={{ background: "oklch(0.11 0.008 55)" }}>
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
    </div>
  );
}
