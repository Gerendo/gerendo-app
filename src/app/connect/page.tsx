"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type ToolStatus = "idle" | "connecting" | "syncing" | "active" | "error";

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  comingSoon?: boolean;
}

const ALL_TOOLS: Tool[] = [
  { id: "gmail", name: "Gmail", description: "Emails, threads, sent messages", category: "Communication", available: true },
  { id: "drive", name: "Google Drive", description: "Docs, Sheets, Slides", category: "Files", available: true },
  { id: "asana", name: "Asana", description: "Tasks, projects, comments", category: "Project Management", available: true },
  { id: "slack", name: "Slack", description: "Messages, channels, threads", category: "Communication", available: false, comingSoon: true },
  { id: "notion", name: "Notion", description: "Pages, databases, notes", category: "Files", available: false, comingSoon: true },
  { id: "whatsapp", name: "WhatsApp Business", description: "Client conversations", category: "Communication", available: false, comingSoon: true },
  { id: "hubspot", name: "HubSpot", description: "CRM contacts, deals, notes", category: "CRM", available: false, comingSoon: true },
  { id: "meet", name: "Google Meet", description: "Meeting transcripts", category: "Communication", available: false, comingSoon: true },
  { id: "calendar", name: "Google Calendar", description: "Events, meetings, attendees", category: "Calendar", available: false, comingSoon: true },
  { id: "linear", name: "Linear", description: "Issues, projects, cycles", category: "Project Management", available: false, comingSoon: true },
  { id: "dropbox", name: "Dropbox", description: "Files and folders", category: "Files", available: false, comingSoon: true },
  { id: "jira", name: "Jira", description: "Issues, sprints, epics", category: "Project Management", available: false, comingSoon: true },
];

function ConnectPageInner() {
  const searchParams = useSearchParams();

  const [connectedTools, setConnectedTools] = useState<Set<string>>(new Set());
  const [toolStatus, setToolStatus] = useState<Record<string, ToolStatus>>({});
  const [toolError, setToolError] = useState<Record<string, string>>({});
  const [syncedCounts, setSyncedCounts] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [initialSyncing, setInitialSyncing] = useState<string | null>(null); // which tool is doing first-time sync
  const [syncCount, setSyncCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const gmailConnected = searchParams.get("gmail_connected");
    const driveConnected = searchParams.get("drive_connected");
    const asanaConnected = searchParams.get("asana_connected");
    const gmailError = searchParams.get("gmail_error");
    const driveError = searchParams.get("drive_error");
    const asanaError = searchParams.get("asana_error");

    if (gmailConnected === "1") { doFirstSync("gmail"); window.history.replaceState({}, "", "/connect"); }
    if (driveConnected === "1") { doFirstSync("drive"); window.history.replaceState({}, "", "/connect"); }
    if (asanaConnected === "1") { doFirstSync("asana"); window.history.replaceState({}, "", "/connect"); }
    if (gmailError) { setToolError(p => ({ ...p, gmail: "Authorization failed" })); setToolStatus(p => ({ ...p, gmail: "error" })); window.history.replaceState({}, "", "/connect"); }
    if (driveError) { setToolError(p => ({ ...p, drive: "Authorization failed" })); setToolStatus(p => ({ ...p, drive: "error" })); window.history.replaceState({}, "", "/connect"); }
    if (asanaError) { setToolError(p => ({ ...p, asana: "Authorization failed" })); setToolStatus(p => ({ ...p, asana: "error" })); window.history.replaceState({}, "", "/connect"); }

    // Load current state
    fetch("/api/nango/status").then(r => r.json()).then(({ connected, driveConnected: dc, asanaConnected: ac }) => {
      const connected_set = new Set<string>();
      if (connected) connected_set.add("gmail");
      if (dc) connected_set.add("drive");
      if (ac) connected_set.add("asana");
      setConnectedTools(connected_set);

      // Set active status for already-connected tools
      const statuses: Record<string, ToolStatus> = {};
      if (connected) statuses.gmail = "active";
      if (dc) statuses.drive = "active";
      if (ac) statuses.asana = "active";
      setToolStatus(p => ({ ...p, ...statuses }));

      // Get indexed counts
      fetch("/api/sync/status").then(r => r.json()).then(job => {
        if (job.totalSynced > 0) setSyncedCounts(p => ({ ...p, gmail: job.totalSynced }));

        // If a first-time sync is still running, poll for it
        if (job.status === "running") {
          setInitialSyncing("gmail");
          setSyncCount(job.totalSynced ?? 0);
          startPoll();
        }
      }).catch(() => {});
    }).catch(() => {});

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function startPoll() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await fetch("/api/sync/status").then(r => r.json());
        if (job.totalSynced) setSyncCount(job.totalSynced);
        if (job.status === "done" || job.status !== "running") {
          setInitialSyncing(null);
          setSyncedCounts(p => ({ ...p, gmail: job.totalSynced ?? 0 }));
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 2000);
  }

  async function doFirstSync(toolId: string) {
    setConnectedTools(p => new Set([...p, toolId]));
    setToolStatus(p => ({ ...p, [toolId]: "syncing" }));
    setToolError(p => { const n = { ...p }; delete n[toolId]; return n; });
    setInitialSyncing(toolId);

    try {
      if (toolId === "gmail") {
        const res = await fetch("/api/sync/gmail/stream");
        const { error } = await res.json();
        if (error) throw new Error(error);
        startPoll();
        fetch("/api/webhooks/gmail/register", { method: "POST" }).catch(() => {});
      } else if (toolId === "drive") {
        const res = await fetch("/api/sync/drive", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSyncedCounts(p => ({ ...p, drive: data.synced }));
        setInitialSyncing(null);
      } else if (toolId === "asana") {
        const res = await fetch("/api/sync/asana", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSyncedCounts(p => ({ ...p, asana: data.synced }));
        setInitialSyncing(null);
        fetch("/api/webhooks/asana/register", { method: "POST" }).catch(() => {});
      }
      setToolStatus(p => ({ ...p, [toolId]: "active" }));
    } catch (err: any) {
      setToolStatus(p => ({ ...p, [toolId]: "error" }));
      setToolError(p => ({ ...p, [toolId]: err.message ?? "Something went wrong" }));
      setInitialSyncing(null);
    }
  }

  function handleConnect(toolId: string) {
    const routes: Record<string, string> = {
      gmail: "/api/auth/gmail",
      drive: "/api/auth/drive",
      asana: "/api/auth/asana",
    };
    if (routes[toolId]) window.location.href = routes[toolId];
  }

  function handleToolAction(tool: Tool) {
    if (!tool.available || tool.comingSoon) return;
    if (!connectedTools.has(tool.id)) handleConnect(tool.id);
  }

  const categories = ["All", ...Array.from(new Set(ALL_TOOLS.map(t => t.category)))];
  const filtered = selectedCategory === "All" ? ALL_TOOLS : ALL_TOOLS.filter(t => t.category === selectedCategory);

  function toolStatusLabel(tool: Tool): { text: string; color: string } {
    if (tool.comingSoon) return { text: "Coming soon", color: "oklch(0.45 0.01 60)" };
    const s = toolStatus[tool.id];
    if (s === "syncing") return { text: "Initial sync running...", color: "oklch(0.85 0.08 70)" };
    if (s === "active") {
      const count = syncedCounts[tool.id];
      return { text: count ? `${count.toLocaleString()} indexed - auto-syncing` : "Active - auto-syncing", color: "oklch(0.78 0.14 65)" };
    }
    if (s === "error") return { text: toolError[tool.id] ?? "Error", color: "oklch(0.62 0.22 25)" };
    if (connectedTools.has(tool.id)) return { text: "Active - auto-syncing", color: "oklch(0.78 0.14 65)" };
    return { text: "Not connected", color: "oklch(0.45 0.01 60)" };
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.11 0.008 55)", color: "oklch(0.96 0.012 80)" }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
        <a href="/ask" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Gerendo</h1>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.012 60)" }}>Connect your tools</p>
        </a>
        <a href="/ask" className="text-xs underline underline-offset-2 transition-colors" style={{ color: "oklch(0.55 0.012 60)" }}>
          Ask questions
        </a>
      </div>

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full flex flex-col gap-6">
        {/* Summary */}
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Your workspace
          </h2>
          <p className="text-sm" style={{ color: "oklch(0.65 0.015 60)" }}>
            {connectedTools.size > 0
              ? "Your tools are connected and syncing automatically."
              : "Connect your tools to start building your agency brain."}
          </p>

          {/* Initial sync progress banner */}
          {initialSyncing && (
            <div className="mt-3 flex flex-col gap-2 px-4 py-3 rounded-2xl" style={{ background: "oklch(0.78 0.14 65 / 8%)", border: "1px solid oklch(0.78 0.14 65 / 15%)" }}>
              <div className="flex items-center justify-between text-xs" style={{ color: "oklch(0.85 0.08 70)" }}>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "oklch(0.78 0.14 65)" }} />
                  First-time sync running in background
                </div>
                {syncCount > 0 && <span style={{ color: "oklch(0.65 0.015 60)" }}>{syncCount.toLocaleString()} items so far</span>}
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "oklch(0.16 0.01 55)" }}>
                <div className="h-full rounded-full animate-pulse" style={{ width: syncCount > 0 ? `${Math.min((syncCount / 2000) * 100, 95)}%` : "5%", background: "oklch(0.78 0.14 65)", transition: "width 1s ease" }} />
              </div>
              <p className="text-xs" style={{ color: "oklch(0.55 0.012 60)" }}>
                This only happens once. After this, new emails and tasks sync automatically.{" "}
                <a href="/ask" className="underline" style={{ color: "oklch(0.78 0.14 65)" }}>You can start asking questions now.</a>
              </p>
            </div>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="text-xs px-3 py-1.5 rounded-full border transition-colors"
              style={{
                borderColor: selectedCategory === cat ? "oklch(0.78 0.14 65)" : "oklch(1 0 0 / 8%)",
                color: selectedCategory === cat ? "oklch(0.78 0.14 65)" : "oklch(0.65 0.015 60)",
                background: selectedCategory === cat ? "oklch(0.78 0.14 65 / 10%)" : "transparent",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tools grid */}
        <div className="flex flex-col gap-3">
          {filtered.map(tool => {
            const { text: statusText, color: statusColor } = toolStatusLabel(tool);
            const isConnected = connectedTools.has(tool.id);
            const isSyncing = toolStatus[tool.id] === "syncing";

            return (
              <div
                key={tool.id}
                className="flex items-center justify-between p-4 rounded-2xl border"
                style={{
                  borderColor: isConnected && !tool.comingSoon ? "oklch(0.78 0.14 65 / 20%)" : "oklch(1 0 0 / 8%)",
                  background: isConnected && !tool.comingSoon ? "oklch(0.78 0.14 65 / 5%)" : "oklch(0.13 0.009 55)",
                  opacity: tool.comingSoon ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold"
                    style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.78 0.14 65)" }}>
                    {tool.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{tool.name}</div>
                    <div className="text-xs" style={{ color: "oklch(0.55 0.012 60)" }}>{tool.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: statusColor }}>{statusText}</span>
                  {!tool.comingSoon && !isConnected && (
                    <button
                      onClick={() => handleToolAction(tool)}
                      disabled={isSyncing}
                      className="text-xs px-3 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                      style={{
                        background: "oklch(0.78 0.14 65)",
                        color: "oklch(0.11 0.008 55)",
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {connectedTools.size > 0 && (
          <a
            href="/ask"
            className="w-full text-center block font-semibold text-sm py-3.5 transition-colors hover:opacity-90"
            style={{
              background: "oklch(0.78 0.14 65)",
              color: "oklch(0.11 0.008 55)",
              borderRadius: "var(--radius-xl)",
            }}
          >
            Ask your agency brain
          </a>
        )}
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectPageInner />
    </Suspense>
  );
}
