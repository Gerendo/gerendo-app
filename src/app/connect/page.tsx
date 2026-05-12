"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import UserMenu from "@/components/UserMenu";
import { createClient } from "@/lib/supabase";

type ToolStatus = "idle" | "connecting" | "syncing" | "active" | "error";

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  comingSoon?: boolean;
}

type AsanaTeam = { gid: string; name: string };
type AsanaWorkspace = { gid: string; name: string; teams: AsanaTeam[] };
type AsanaCurrent = {
  asanaWorkspaceGid: string;
  asanaTeamGid: string;
  defaultPrivacy: string;
};
type AsanaPickerStatus = "idle" | "loading" | "ready" | "error";
type AsanaPickerState = {
  status: AsanaPickerStatus;
  workspaces: AsanaWorkspace[];
  current: AsanaCurrent | null;
  error: string | null;
};

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authChecked, setAuthChecked] = useState(false);

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

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) checkAuth();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  const [connectedTools, setConnectedTools] = useState<Set<string>>(new Set());
  const [toolStatus, setToolStatus] = useState<Record<string, ToolStatus>>({});
  const [toolError, setToolError] = useState<Record<string, string>>({});
  const [syncedCounts, setSyncedCounts] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [initialSyncing, setInitialSyncing] = useState<string | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthHandledRef = useRef(false);

  // Label picker modal
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<Array<{ id: string; name: string; icon: string; type: string; default: boolean }>>([]);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<{ backfilled: number; remaining: number } | null>(null);
  const [pendingDeleteLabel, setPendingDeleteLabel] = useState<string | null>(null);
  const [deletingLabel, setDeletingLabel] = useState(false);

  // Asana defaults picker modal
  const [asanaPicker, setAsanaPicker] = useState<AsanaPickerState>({
    status: "idle",
    workspaces: [],
    current: null,
    error: null,
  });
  const [showAsanaPicker, setShowAsanaPicker] = useState(false);
  const asanaModalAutoOpenedRef = useRef(false);
  const [asanaPickerWorkspaceGid, setAsanaPickerWorkspaceGid] = useState("");
  const [asanaPickerTeamGid, setAsanaPickerTeamGid] = useState("");
  const [asanaPickerPrivacy, setAsanaPickerPrivacy] = useState<"public_to_team" | "private">("public_to_team");
  const [asanaPickerSubmitting, setAsanaPickerSubmitting] = useState(false);
  const [asanaPickerSubmitError, setAsanaPickerSubmitError] = useState<string | null>(null);
  const [asanaFormSeeded, setAsanaFormSeeded] = useState(false);

  useEffect(() => {
    if (!authChecked) return; // wait for session to be confirmed before fetching

    const gmailConnected = searchParams.get("gmail_connected");
    const driveConnected = searchParams.get("drive_connected");
    const asanaConnected = searchParams.get("asana_connected");
    const gmailError = searchParams.get("gmail_error");
    const driveError = searchParams.get("drive_error");
    const asanaError = searchParams.get("asana_error");

    if (!oauthHandledRef.current && (gmailConnected || driveConnected || asanaConnected || gmailError || driveError || asanaError)) {
      oauthHandledRef.current = true;
      if (gmailConnected === "1") doFirstSync("gmail");
      if (driveConnected === "1") doFirstSync("drive");
      if (asanaConnected === "1") doFirstSync("asana");
      if (gmailError) { setToolError(p => ({ ...p, gmail: "Authorization failed" })); setToolStatus(p => ({ ...p, gmail: "error" })); }
      if (driveError) { setToolError(p => ({ ...p, drive: "Authorization failed" })); setToolStatus(p => ({ ...p, drive: "error" })); }
      if (asanaError) { setToolError(p => ({ ...p, asana: "Authorization failed" })); setToolStatus(p => ({ ...p, asana: "error" })); }
      window.history.replaceState({}, "", "/connect");
    }

    // Load current state
    fetch("/api/nango/status").then(r => r.json()).then(({ connected, driveConnected: dc, asanaConnected: ac }) => {
      setConnectedTools(prev => {
        const next = new Set(prev);
        if (connected) next.add("gmail"); else if (!gmailConnected) next.delete("gmail");
        if (dc) next.add("drive"); else if (!driveConnected) next.delete("drive");
        if (ac) next.add("asana"); else if (!asanaConnected) next.delete("asana");
        return next;
      });

      // Set active status for already-connected tools
      const statuses: Record<string, ToolStatus> = {};
      if (connected) statuses.gmail = "active";
      if (dc) statuses.drive = "active";
      if (ac) statuses.asana = "active";
      setToolStatus(p => ({ ...p, ...statuses }));

      // Get indexed counts from both sync job (Gmail live) and workspace info (all tools)
      fetch("/api/workspace/info").then(r => r.json()).then(info => {
        if (info.emailCount > 0) setSyncedCounts(p => ({ ...p, gmail: info.emailCount }));
        if (info.driveCount > 0) setSyncedCounts(p => ({ ...p, drive: info.driveCount }));
        if (info.asanaCount > 0) setSyncedCounts(p => ({ ...p, asana: info.asanaCount }));
      }).catch(() => {});

      if (connected) {
        fetch("/api/sync/status").then(r => r.json()).then(job => {
          if (job.totalSynced > 0) setSyncedCounts(p => ({ ...p, gmail: job.totalSynced }));
          if (job.status === "running") {
            setInitialSyncing("gmail");
            setSyncCount(job.totalSynced ?? 0);
            startPoll();
          }
        }).catch(() => {});
      }
    }).catch(() => {});

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [authChecked, searchParams]);

  // Load Asana defaults whenever Asana is connected and active.
  useEffect(() => {
    if (!authChecked) return;
    if (!connectedTools.has("asana")) return;
    if (toolStatus.asana && toolStatus.asana !== "active") return;
    if (asanaPicker.status === "loading" || asanaPicker.status === "ready") return;

    let cancelled = false;
    setAsanaPicker(p => ({ ...p, status: "loading", error: null }));
    fetch("/api/settings/asana-defaults")
      .then(async res => {
        if (cancelled) return;
        if (res.status === 400) {
          setAsanaPicker({ status: "ready", workspaces: [], current: null, error: null });
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to load (${res.status})`);
        }
        const data: { workspaces: AsanaWorkspace[]; current: AsanaCurrent | null } = await res.json();
        setAsanaPicker({
          status: "ready",
          workspaces: data.workspaces ?? [],
          current: data.current ?? null,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAsanaPicker(p => ({
          ...p,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load Asana defaults",
        }));
      });

    return () => { cancelled = true; };
  }, [authChecked, connectedTools, toolStatus.asana, asanaPicker.status]);

  // Auto-open the modal once when picker becomes ready and there are no saved defaults.
  useEffect(() => {
    if (asanaPicker.status !== "ready") return;
    if (asanaPicker.current !== null) return;
    if (showAsanaPicker) return;
    if (asanaModalAutoOpenedRef.current) return;
    asanaModalAutoOpenedRef.current = true;
    setShowAsanaPicker(true);
  }, [asanaPicker.status, asanaPicker.current, showAsanaPicker]);

  // Seed form fields the first time the modal opens with a ready picker.
  useEffect(() => {
    if (!showAsanaPicker) return;
    if (asanaPicker.status !== "ready") return;
    if (asanaFormSeeded) return;
    setAsanaPickerSubmitError(null);
    const current = asanaPicker.current;
    if (current) {
      setAsanaPickerWorkspaceGid(current.asanaWorkspaceGid);
      setAsanaPickerTeamGid(current.asanaTeamGid);
      setAsanaPickerPrivacy(current.defaultPrivacy === "private" ? "private" : "public_to_team");
    } else if (asanaPicker.workspaces.length > 0) {
      setAsanaPickerWorkspaceGid(prev => prev || asanaPicker.workspaces[0].gid);
      setAsanaPickerTeamGid(prev => prev || (asanaPicker.workspaces[0].teams[0]?.gid ?? ""));
    }
    setAsanaFormSeeded(true);
  }, [showAsanaPicker, asanaPicker.status, asanaPicker.current, asanaPicker.workspaces, asanaFormSeeded]);

  // Close modal on Escape key.
  useEffect(() => {
    if (!showAsanaPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAsanaPicker(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAsanaPicker]);

  function onAsanaWorkspaceChange(nextGid: string) {
    setAsanaPickerWorkspaceGid(nextGid);
    const next = asanaPicker.workspaces.find(w => w.gid === nextGid);
    setAsanaPickerTeamGid(next?.teams[0]?.gid ?? "");
  }

  async function reloadAsanaDefaults() {
    setAsanaPicker(p => ({ ...p, status: "loading", error: null }));
    try {
      const res = await fetch("/api/settings/asana-defaults");
      if (res.status === 400) {
        setAsanaPicker({ status: "ready", workspaces: [], current: null, error: null });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to load (${res.status})`);
      }
      const data: { workspaces: AsanaWorkspace[]; current: AsanaCurrent | null } = await res.json();
      setAsanaPicker({
        status: "ready",
        workspaces: data.workspaces ?? [],
        current: data.current ?? null,
        error: null,
      });
    } catch (err: unknown) {
      setAsanaPicker(p => ({
        ...p,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to load Asana defaults",
      }));
    }
  }

  async function saveAsanaDefaults(e: React.FormEvent) {
    e.preventDefault();
    if (!asanaPickerWorkspaceGid || !asanaPickerTeamGid) {
      setAsanaPickerSubmitError("Pick a workspace and team");
      return;
    }
    setAsanaPickerSubmitting(true);
    setAsanaPickerSubmitError(null);
    try {
      const res = await fetch("/api/settings/asana-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asanaWorkspaceGid: asanaPickerWorkspaceGid,
          asanaTeamGid: asanaPickerTeamGid,
          defaultPrivacy: asanaPickerPrivacy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.saved) {
        throw new Error(data.error ?? `Failed to save (${res.status})`);
      }
      await reloadAsanaDefaults();
      setShowAsanaPicker(false);
    } catch (err: unknown) {
      setAsanaPickerSubmitError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setAsanaPickerSubmitting(false);
    }
  }

  function startPoll() {
    if (pollRef.current) clearInterval(pollRef.current);
    const deadline = Date.now() + 20 * 60 * 1000;
    pollRef.current = setInterval(async () => {
      try {
        const job = await fetch("/api/sync/status").then(r => r.json());
        if (job.totalSynced) setSyncCount(job.totalSynced);
        const finished = job.status === "done" || job.status === "cancelled" || job.status !== "running";
        const timedOut = Date.now() > deadline;
        if (finished || timedOut) {
          setInitialSyncing(null);
          setSyncedCounts(p => ({ ...p, gmail: job.totalSynced ?? 0 }));
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 15000);
  }

  // Default labels shown before API loads - user can start sync immediately with these
  const DEFAULT_LABELS = [
    { id: "INBOX", name: "Inbox", icon: "inbox", type: "system", default: true },
    { id: "SENT", name: "Sent", icon: "send", type: "system", default: true },
    { id: "DRAFT", name: "Drafts", icon: "drafts", type: "system", default: false },
    { id: "STARRED", name: "Starred", icon: "star", type: "system", default: false },
    { id: "IMPORTANT", name: "Important", icon: "label_important", type: "system", default: false },
    { id: "SPAM", name: "Spam", icon: "report", type: "system", default: false },
    { id: "TRASH", name: "Trash", icon: "delete", type: "system", default: false },
  ];

  function getSavedLabels(): Set<string> | null {
    try {
      const saved = localStorage.getItem("gerendo_gmail_selected_labels");
      if (!saved) return null;
      return new Set<string>(JSON.parse(saved));
    } catch { return null; }
  }

  async function openLabelPicker(fetchFresh = false) {
    setShowLabelPicker(true);
    setLabelError(null);

    const isFreshLoad = availableLabels.length === 0;

    // Show defaults immediately so the modal is usable without waiting
    if (isFreshLoad) {
      setAvailableLabels(DEFAULT_LABELS);
      // Don't pre-select anything yet — wait for API to tell us what's actually syncing
      setSelectedLabels(new Set());
    }

    // Always fetch to get currently synced labels (syncedLabelIds from backend)
    if (fetchFresh || isFreshLoad) {
      setLoadingLabels(true);
      fetch("/api/sync/gmail/labels")
        .then(r => r.json())
        .then(body => {
          if (body.labels?.length) {
            setAvailableLabels(body.labels);
            const validIds = new Set(body.labels.map((l: any) => l.id));
            // Use synced labels from backend as the source of truth for current selection
            if (body.syncedLabelIds?.length) {
              setSelectedLabels(new Set(
                (body.syncedLabelIds as string[]).filter((id: string) => validIds.has(id))
              ));
            } else {
              // First-time setup (nothing synced yet) — no default selection
              setSelectedLabels(new Set());
            }
          } else if (body.error) {
            setLabelError(body.error);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingLabels(false));
    }
  }

  async function deleteLabel(labelId: string) {
    setDeletingLabel(true);
    try {
      await fetch("/api/sync/gmail/labels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelIds: [labelId] }),
      });
      setPendingDeleteLabel(null);
      // Deselect the deleted label immediately
      setSelectedLabels(p => { const next = new Set(p); next.delete(labelId); return next; });
      // Refresh the synced count displayed on the tool card
      fetch("/api/workspace/info").then(r => r.json()).then(info => {
        if (info.emailCount >= 0) setSyncedCounts(p => ({ ...p, gmail: info.emailCount }));
      }).catch(() => {});
    } finally {
      setDeletingLabel(false);
    }
  }

  async function startGmailSyncWithLabels() {
    try { localStorage.setItem("gerendo_gmail_selected_labels", JSON.stringify(Array.from(selectedLabels))); } catch {}
    setShowLabelPicker(false);
    const labelsParam = Array.from(selectedLabels).join(",");
    setConnectedTools(p => new Set([...p, "gmail"]));
    setToolStatus(p => ({ ...p, gmail: "syncing" }));
    setToolError(p => { const n = { ...p }; delete n.gmail; return n; });
    setInitialSyncing("gmail");

    try {
      const res = await fetch(`/api/sync/gmail/stream?labels=${encodeURIComponent(labelsParam)}`);
      const { error } = await res.json();
      if (error) throw new Error(error);
      startPoll();
      fetch("/api/webhooks/gmail/register", { method: "POST" }).catch(() => {});
      setToolStatus(p => ({ ...p, gmail: "active" }));
    } catch (err: any) {
      setToolStatus(p => ({ ...p, gmail: "error" }));
      setToolError(p => ({ ...p, gmail: err.message ?? "Something went wrong" }));
      setInitialSyncing(null);
    }
  }

  async function doFirstSync(toolId: string) {
    setConnectedTools(p => new Set([...p, toolId]));
    setToolStatus(p => ({ ...p, [toolId]: "syncing" }));
    setToolError(p => { const n = { ...p }; delete n[toolId]; return n; });
    setInitialSyncing(toolId);

    try {
      if (toolId === "gmail") {
        // Show label picker instead of starting immediately
        setToolStatus(p => ({ ...p, gmail: "idle" }));
        setInitialSyncing(null);
        openLabelPicker();
        return;
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

  async function confirmAndDisconnect(toolId: string) {
    setDisconnecting(toolId);
    setConfirmDisconnect(null);
    try {
      await fetch("/api/sync/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolId }),
      });
      setConnectedTools(p => { const n = new Set(p); n.delete(toolId); return n; });
      setToolStatus(p => { const n = { ...p }; delete n[toolId]; return n; });
      setSyncedCounts(p => { const n = { ...p }; delete n[toolId]; return n; });
      setInitialSyncing(p => p === toolId ? null : p);
      if (pollRef.current) clearInterval(pollRef.current);
      if (toolId === "asana") {
        setAsanaPicker({ status: "idle", workspaces: [], current: null, error: null });
        setShowAsanaPicker(false);
        asanaModalAutoOpenedRef.current = false;
        setAsanaFormSeeded(false);
        setAsanaPickerWorkspaceGid("");
        setAsanaPickerTeamGid("");
        setAsanaPickerPrivacy("public_to_team");
        setAsanaPickerSubmitError(null);
      }
    } catch {
      setToolError(p => ({ ...p, [toolId]: "Disconnect failed" }));
    } finally {
      setDisconnecting(null);
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

  if (!authChecked) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.11 0.008 55)", color: "oklch(0.96 0.012 80)" }}>
      {/* Header */}
      <div className="relative border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
        <a href="/ask" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Gerendo</h1>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.012 60)" }}>Connect your tools</p>
        </a>
        <UserMenu />
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
                  {initialSyncing === "gmail"
                    ? `Importing emails${syncCount > 0 ? ` — ${syncCount.toLocaleString()} indexed` : "..."}`
                    : initialSyncing === "drive"
                    ? "Indexing Google Drive files..."
                    : "Syncing Asana tasks..."}
                </div>
                {initialSyncing && (
                  <button
                    onClick={async () => {
                      await fetch("/api/sync/stop", { method: "POST" });
                      // Disconnect all connected tools
                      await Promise.all(
                        ["gmail", "drive", "asana"].map(tool =>
                          fetch("/api/sync/disconnect", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tool }),
                          }).catch(() => {})
                        )
                      );
                      if (pollRef.current) clearInterval(pollRef.current);
                      setInitialSyncing(null);
                      setSyncCount(0);
                      setToolStatus({});
                      setConnectedTools(new Set());
                      setSyncedCounts({});
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium opacity-80 hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.65 0.015 60)", border: "1px solid oklch(1 0 0 / 10%)" }}
                  >
                    Stop
                  </button>
                )}
              </div>
              {initialSyncing === "gmail" && syncCount >= 0 && (
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "oklch(0.16 0.01 55)" }}>
                  <div className="h-full rounded-full" style={{ width: syncCount > 0 ? `${Math.min((syncCount / 2000) * 100, 95)}%` : "5%", background: "oklch(0.78 0.14 65)", transition: "width 1s ease" }} />
                </div>
              )}
              <p className="text-xs" style={{ color: "oklch(0.55 0.012 60)" }}>
                This only happens once. After this, everything syncs automatically.{" "}
                <a href="/ask" className="underline" style={{ color: "oklch(0.78 0.14 65)" }}>You can start asking questions now.</a>
              </p>
            </div>
          )}
        </div>

        {/* Category filter - horizontal scroll on mobile, wraps on desktop */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap md:flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="text-sm px-4 py-2 rounded-lg border transition-colors whitespace-nowrap"
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
            const isConfirming = confirmDisconnect === tool.id;

            return (
              <div
                key={tool.id}
                className="flex flex-col rounded-2xl border overflow-hidden"
                style={{
                  borderColor: isConfirming ? "oklch(0.62 0.22 25 / 40%)" : isConnected && !tool.comingSoon ? "oklch(0.78 0.14 65 / 20%)" : "oklch(1 0 0 / 8%)",
                  background: isConnected && !tool.comingSoon ? "oklch(0.78 0.14 65 / 5%)" : "oklch(0.13 0.009 55)",
                  opacity: tool.comingSoon ? 0.6 : 1,
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0"
                      style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.78 0.14 65)" }}>
                      {tool.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{tool.name}</div>
                      <div className="text-xs" style={{ color: "oklch(0.55 0.012 60)" }}>{tool.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pl-12 sm:pl-0">
                    <span className="text-xs whitespace-nowrap" style={{ color: statusColor }}>{statusText}</span>
                    {!tool.comingSoon && isConnected && !isConfirming && tool.id === "gmail" && (
                      <button
                        onClick={() => openLabelPicker(true)}
                        className="text-xs px-2.5 py-1.5 rounded-xl font-medium transition-colors"
                        style={{ background: "oklch(0.78 0.14 65 / 10%)", color: "oklch(0.78 0.14 65)", border: "1px solid oklch(0.78 0.14 65 / 25%)" }}
                      >
                        Manage labels
                      </button>
                    )}
                    {!tool.comingSoon && isConnected && !isConfirming && tool.id === "asana" && toolStatus.asana === "active" && (
                      <button
                        onClick={() => setShowAsanaPicker(true)}
                        className="text-xs px-2.5 py-1.5 rounded-xl font-medium transition-colors"
                        style={{ background: "oklch(0.78 0.14 65 / 10%)", color: "oklch(0.78 0.14 65)", border: "1px solid oklch(0.78 0.14 65 / 25%)" }}
                      >
                        Manage projects
                      </button>
                    )}
                    {!tool.comingSoon && isConnected && !isConfirming && (
                      <button
                        onClick={() => setConfirmDisconnect(tool.id)}
                        disabled={disconnecting === tool.id}
                        className="text-xs px-2.5 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-40"
                        style={{ background: "oklch(0.62 0.22 25 / 15%)", color: "oklch(0.75 0.18 25)", border: "1px solid oklch(0.62 0.22 25 / 30%)" }}
                      >
                        {disconnecting === tool.id ? "..." : "Disconnect"}
                      </button>
                    )}
                    {!tool.comingSoon && !isConnected && (
                      <button
                        onClick={() => handleToolAction(tool)}
                        disabled={isSyncing}
                        className="text-xs px-3 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                        style={{ background: "oklch(0.78 0.14 65)", color: "oklch(0.11 0.008 55)" }}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline confirm panel */}
                {isConfirming && (
                  <div className="flex items-center justify-between px-4 py-3 gap-3" style={{ background: "oklch(0.62 0.22 25 / 8%)", borderTop: "1px solid oklch(0.62 0.22 25 / 20%)" }}>
                    <p className="text-xs" style={{ color: "oklch(0.75 0.18 25)" }}>
                      Stop {tool.name}? This removes all indexed data for this tool.
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setConfirmDisconnect(null)}
                        className="text-xs px-3 py-1.5 rounded-xl font-medium"
                        style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.65 0.015 60)", border: "1px solid oklch(1 0 0 / 10%)" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => confirmAndDisconnect(tool.id)}
                        className="text-xs px-3 py-1.5 rounded-xl font-medium"
                        style={{ background: "oklch(0.62 0.22 25)", color: "white" }}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}

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

        {/* Re-index */}
        {connectedTools.has("gmail") && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "oklch(0.55 0.012 60)" }}>
                Search not finding everything?
              </p>
              <button
                onClick={async () => {
                  setReindexing(true);
                  setReindexResult(null);
                  try {
                    const res = await fetch("/api/sync/embeddings-backfill", { method: "POST" });
                    const data = await res.json();
                    setReindexResult(data);
                  } catch { /* ignore */ } finally {
                    setReindexing(false);
                  }
                }}
                disabled={reindexing}
                className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
                style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.65 0.015 60)", border: "1px solid oklch(1 0 0 / 8%)" }}
              >
                {reindexing ? "Re-indexing..." : "Re-index"}
              </button>
            </div>
            {reindexResult && (
              <p className="text-xs" style={{ color: "oklch(0.65 0.015 60)" }}>
                {reindexResult.backfilled > 0
                  ? `Indexed ${reindexResult.backfilled} emails. ${reindexResult.remaining > 0 ? `${reindexResult.remaining} remaining — press again.` : "All caught up."}`
                  : "All emails already indexed."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Label picker modal */}
      {showLabelPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-sm rounded-3xl flex flex-col gap-4 p-6" style={{ background: "oklch(0.14 0.009 55)", border: "1px solid oklch(1 0 0 / 10%)" }}>
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Choose mailboxes to sync</h3>
              <p className="text-xs mt-1" style={{ color: "oklch(0.55 0.012 60)" }}>Select which Gmail labels to index. You can change this later.</p>
            </div>

            {loadingLabels ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm" style={{ color: "oklch(0.55 0.012 60)" }}>Loading mailboxes...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {availableLabels.map(label => {
                  const selected = selectedLabels.has(label.id);
                  const isPendingDelete = pendingDeleteLabel === label.id;

                  if (isPendingDelete) {
                    return (
                      <div key={label.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl gap-3"
                        style={{ background: "oklch(0.62 0.22 25 / 8%)", border: "1px solid oklch(0.62 0.22 25 / 30%)" }}>
                        <span className="text-sm" style={{ color: "oklch(0.75 0.18 25)" }}>Delete all {label.name} data?</span>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => setPendingDeleteLabel(null)}
                            className="text-xs px-2.5 py-1 rounded-lg font-medium"
                            style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.65 0.015 60)", border: "1px solid oklch(1 0 0 / 10%)" }}
                          >Cancel</button>
                          <button
                            onClick={() => deleteLabel(label.id)}
                            disabled={deletingLabel}
                            className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-40"
                            style={{ background: "oklch(0.62 0.22 25)", color: "white" }}
                          >{deletingLabel ? "..." : "Delete"}</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={label.id} className="flex items-center gap-1">
                      {/* Selection toggle */}
                      <button
                        onClick={() => setSelectedLabels(p => {
                          const next = new Set(p);
                          if (next.has(label.id)) next.delete(label.id);
                          else next.add(label.id);
                          return next;
                        })}
                        className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                        style={{
                          background: selected ? "oklch(0.78 0.14 65 / 12%)" : "oklch(0.11 0.008 55)",
                          border: `1px solid ${selected ? "oklch(0.78 0.14 65 / 30%)" : "oklch(1 0 0 / 8%)"}`,
                        }}
                      >
                        {/* Checkbox */}
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: selected ? "oklch(0.78 0.14 65)" : "transparent", border: `1.5px solid ${selected ? "oklch(0.78 0.14 65)" : "oklch(1 0 0 / 25%)"}` }}>
                          {selected && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="oklch(0.11 0.008 55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        {/* Icon */}
                        <span className="material-icons text-base flex-shrink-0" style={{ color: selected ? "oklch(0.78 0.14 65)" : "oklch(0.45 0.01 60)", fontSize: "18px" }}>
                          {label.icon}
                        </span>
                        {/* Name */}
                        <span className="text-sm flex-1 text-left">{label.name}</span>
                        {label.type === "user" && (
                          <span className="text-xs" style={{ color: "oklch(0.45 0.01 60)" }}>label</span>
                        )}
                      </button>
                      {/* Delete data button */}
                      <button
                        onClick={() => setPendingDeleteLabel(label.id)}
                        className="p-1.5 rounded-lg flex-shrink-0 opacity-25 hover:opacity-70 transition-opacity"
                        style={{ color: "oklch(0.75 0.18 25)" }}
                        title={`Delete ${label.name} data from index`}
                      >
                        <span className="material-icons" style={{ fontSize: "16px" }}>delete</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowLabelPicker(false);
                  // Reset gmail status back to whatever it was before
                  setToolStatus(p => ({
                    ...p,
                    gmail: connectedTools.has("gmail") ? "active" : "idle",
                  }));
                  setInitialSyncing(null);
                }}
                className="flex-1 text-sm py-2.5 rounded-xl font-medium"
                style={{ background: "oklch(0.11 0.008 55)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.65 0.015 60)" }}
              >
                Cancel
              </button>

              <button
                onClick={startGmailSyncWithLabels}
                disabled={selectedLabels.size === 0}
                className="flex-1 text-sm py-2.5 rounded-xl font-medium disabled:opacity-40"
                style={{ background: "oklch(0.78 0.14 65)", color: "oklch(0.11 0.008 55)" }}
              >
                Start sync ({selectedLabels.size} selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asana defaults picker modal */}
      {showAsanaPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setShowAsanaPicker(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl flex flex-col gap-4 p-6"
            style={{ background: "oklch(0.14 0.009 55)", border: "1px solid oklch(1 0 0 / 10%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Manage Asana defaults</h3>
              <p className="text-xs mt-1" style={{ color: "oklch(0.55 0.012 60)" }}>
                Pick the workspace, team, and default privacy Gerendo uses when it creates new Asana projects for you.
              </p>
            </div>

            {asanaPicker.status === "loading" && (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm" style={{ color: "oklch(0.55 0.012 60)" }}>Loading workspaces...</span>
              </div>
            )}

            {asanaPicker.status === "error" && (
              <div className="flex flex-col gap-3 py-2">
                <p className="text-xs" style={{ color: "oklch(0.75 0.18 25)" }}>
                  {asanaPicker.error ?? "Failed to load Asana defaults."}
                </p>
                <button
                  onClick={reloadAsanaDefaults}
                  className="text-xs px-3 py-1.5 rounded-xl font-medium self-start"
                  style={{ background: "oklch(0.16 0.01 55)", color: "oklch(0.65 0.015 60)", border: "1px solid oklch(1 0 0 / 10%)" }}
                >
                  Retry
                </button>
              </div>
            )}

            {asanaPicker.status === "ready" && (() => {
              const selectedWorkspace = asanaPicker.workspaces.find(w => w.gid === asanaPickerWorkspaceGid) ?? null;
              return (
                <form onSubmit={saveAsanaDefaults} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" style={{ color: "oklch(0.72 0.012 60)" }} htmlFor="asana-modal-workspace">
                      Asana workspace
                    </label>
                    <select
                      id="asana-modal-workspace"
                      value={asanaPickerWorkspaceGid}
                      onChange={(e) => onAsanaWorkspaceChange(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl border"
                      style={{ background: "oklch(0.13 0.009 55)", borderColor: "oklch(1 0 0 / 12%)", color: "oklch(0.96 0.012 80)" }}
                    >
                      {asanaPicker.workspaces.length === 0 && <option value="">No workspaces found</option>}
                      {asanaPicker.workspaces.map(w => (
                        <option key={w.gid} value={w.gid}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" style={{ color: "oklch(0.72 0.012 60)" }} htmlFor="asana-modal-team">
                      Team
                    </label>
                    <select
                      id="asana-modal-team"
                      value={asanaPickerTeamGid}
                      onChange={(e) => setAsanaPickerTeamGid(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl border"
                      style={{ background: "oklch(0.13 0.009 55)", borderColor: "oklch(1 0 0 / 12%)", color: "oklch(0.96 0.012 80)" }}
                    >
                      {(selectedWorkspace?.teams ?? []).length === 0 && (
                        <option value="">No teams in this workspace</option>
                      )}
                      {(selectedWorkspace?.teams ?? []).map(t => (
                        <option key={t.gid} value={t.gid}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium" style={{ color: "oklch(0.72 0.012 60)" }}>Default privacy for new projects</p>
                    <label className="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer" style={{ borderColor: "oklch(1 0 0 / 10%)", background: "oklch(0.13 0.009 55)" }}>
                      <input
                        type="radio"
                        name="asana-modal-privacy"
                        value="public_to_team"
                        checked={asanaPickerPrivacy === "public_to_team"}
                        onChange={() => setAsanaPickerPrivacy("public_to_team")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="text-xs font-medium" style={{ color: "oklch(0.96 0.012 80)" }}>Public to team</span>
                        <span className="block text-xs mt-0.5" style={{ color: "oklch(0.55 0.012 60)" }}>
                          Anyone on the team can see and collaborate on new projects.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer" style={{ borderColor: "oklch(1 0 0 / 10%)", background: "oklch(0.13 0.009 55)" }}>
                      <input
                        type="radio"
                        name="asana-modal-privacy"
                        value="private"
                        checked={asanaPickerPrivacy === "private"}
                        onChange={() => setAsanaPickerPrivacy("private")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="text-xs font-medium" style={{ color: "oklch(0.96 0.012 80)" }}>Private, only me</span>
                        <span className="block text-xs mt-0.5" style={{ color: "oklch(0.55 0.012 60)" }}>
                          Only you can see new projects until you invite others manually.
                        </span>
                      </span>
                    </label>
                  </div>

                  {asanaPickerSubmitError && (
                    <p className="text-xs" style={{ color: "oklch(0.75 0.18 25)" }}>{asanaPickerSubmitError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAsanaPicker(false);
                        setAsanaPickerSubmitError(null);
                      }}
                      disabled={asanaPickerSubmitting}
                      className="flex-1 text-sm py-2.5 rounded-xl font-medium"
                      style={{ background: "oklch(0.11 0.008 55)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.65 0.015 60)" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={asanaPickerSubmitting || !asanaPickerWorkspaceGid || !asanaPickerTeamGid}
                      className="flex-1 text-sm py-2.5 rounded-xl font-medium disabled:opacity-40"
                      style={{ background: "oklch(0.78 0.14 65)", color: "oklch(0.11 0.008 55)" }}
                    >
                      {asanaPickerSubmitting ? "Saving..." : "Save defaults"}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
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
