"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { createClient } from "@/lib/supabase";

interface Member {
  userId: string;
  role: string;
  joinedAt: string;
  name: string;
  email: string;
  avatar: string | null;
  isYou: boolean;
}

interface WorkspaceInfo {
  workspace: { id: string; name: string; created_at: string };
  members: Member[];
  currentUser: { id: string; name: string; email: string; avatar: string | null };
}

type AsanaTeam = { gid: string; name: string };
type AsanaWorkspace = { gid: string; name: string; teams: AsanaTeam[] };
type AsanaCurrent = {
  asanaWorkspaceGid: string;
  asanaTeamGid: string;
  defaultPrivacy: string;
};
type AsanaDefaultsStatus = "loading" | "not_connected" | "ready" | "error";

export default function SettingsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const push = usePushNotifications();
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState("");

  async function sendTestNotification() {
    setTestSent(false);
    setTestError("");
    const res = await fetch("/api/push/test", { method: "POST" });
    if (res.ok) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    } else {
      const d = await res.json();
      setTestError(d.error ?? "Failed to send test");
    }
  }

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

  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/workspace/info")
      .then(r => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  async function generateInvite() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/invite", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteUrl(`${window.location.origin}/join?token=${data.token}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to generate invite");
    } finally {
      setGenerating(false);
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteAllData() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/workspace/delete-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteConfirm(false);
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 4000);
    } catch (err: any) {
      setDeleteError(err.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  // Asana defaults section state
  const [asanaStatus, setAsanaStatus] = useState<AsanaDefaultsStatus>("loading");
  const [asanaError, setAsanaError] = useState<string | null>(null);
  const [asanaWorkspaces, setAsanaWorkspaces] = useState<AsanaWorkspace[]>([]);
  const [asanaCurrent, setAsanaCurrent] = useState<AsanaCurrent | null>(null);
  const [asanaModalOpen, setAsanaModalOpen] = useState(false);
  const [asanaAutoOpened, setAsanaAutoOpened] = useState(false);

  // Modal form state
  const [pickerWorkspaceGid, setPickerWorkspaceGid] = useState("");
  const [pickerTeamGid, setPickerTeamGid] = useState("");
  const [pickerPrivacy, setPickerPrivacy] = useState<"public_to_team" | "private">("public_to_team");
  const [pickerSubmitting, setPickerSubmitting] = useState(false);
  const [pickerSubmitError, setPickerSubmitError] = useState<string | null>(null);

  const loadAsanaDefaults = useCallback(async () => {
    setAsanaStatus("loading");
    setAsanaError(null);
    try {
      const res = await fetch("/api/settings/asana-defaults");
      if (res.status === 400) {
        setAsanaWorkspaces([]);
        setAsanaCurrent(null);
        setAsanaStatus("not_connected");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to load (${res.status})`);
      }
      const data: { workspaces: AsanaWorkspace[]; current: AsanaCurrent | null } = await res.json();
      setAsanaWorkspaces(data.workspaces ?? []);
      setAsanaCurrent(data.current ?? null);
      setAsanaStatus("ready");
    } catch (err: unknown) {
      setAsanaError(err instanceof Error ? err.message : "Failed to load Asana defaults");
      setAsanaStatus("error");
    }
  }, []);

  useEffect(() => {
    loadAsanaDefaults();
  }, [loadAsanaDefaults]);

  // Auto-open modal once per page load when Asana is connected but no defaults are saved.
  useEffect(() => {
    if (asanaAutoOpened) return;
    if (asanaStatus === "ready" && asanaCurrent === null) {
      setAsanaModalOpen(true);
      setAsanaAutoOpened(true);
    }
  }, [asanaStatus, asanaCurrent, asanaAutoOpened]);

  // Seed picker form whenever the modal opens.
  useEffect(() => {
    if (!asanaModalOpen) return;
    setPickerSubmitError(null);
    if (asanaCurrent) {
      setPickerWorkspaceGid(asanaCurrent.asanaWorkspaceGid);
      setPickerTeamGid(asanaCurrent.asanaTeamGid);
      setPickerPrivacy(asanaCurrent.defaultPrivacy === "private" ? "private" : "public_to_team");
    } else if (asanaWorkspaces.length > 0) {
      // Only seed if the user hasn't already picked something in this session.
      setPickerWorkspaceGid((prev) => prev || asanaWorkspaces[0].gid);
      setPickerTeamGid((prev) => prev || (asanaWorkspaces[0].teams[0]?.gid ?? ""));
    }
  }, [asanaModalOpen, asanaCurrent, asanaWorkspaces]);

  const pickerSelectedWorkspace = useMemo(
    () => asanaWorkspaces.find((w) => w.gid === pickerWorkspaceGid) ?? null,
    [asanaWorkspaces, pickerWorkspaceGid]
  );

  function onPickerWorkspaceChange(nextGid: string) {
    setPickerWorkspaceGid(nextGid);
    const next = asanaWorkspaces.find((w) => w.gid === nextGid);
    setPickerTeamGid(next?.teams[0]?.gid ?? "");
  }

  async function onPickerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickerWorkspaceGid || !pickerTeamGid) {
      setPickerSubmitError("Pick a workspace and team");
      return;
    }
    setPickerSubmitting(true);
    setPickerSubmitError(null);
    try {
      const res = await fetch("/api/settings/asana-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asanaWorkspaceGid: pickerWorkspaceGid,
          asanaTeamGid: pickerTeamGid,
          defaultPrivacy: pickerPrivacy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.saved) {
        throw new Error(data.error ?? `Failed to save (${res.status})`);
      }
      setAsanaModalOpen(false);
      await loadAsanaDefaults();
    } catch (err: unknown) {
      setPickerSubmitError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPickerSubmitting(false);
    }
  }

  // Close modal on Escape.
  useEffect(() => {
    if (!asanaModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAsanaModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asanaModalOpen]);

  const borderColor = "oklch(1 0 0 / 8%)";
  const mutedColor = "oklch(0.65 0.015 60)";
  const dimColor = "oklch(0.72 0.012 60)";
  const emberColor = "oklch(0.78 0.14 65)";
  const inkSoft = "oklch(0.16 0.01 55)";
  const fieldBg = "oklch(0.13 0.009 55)";
  const fieldBorder = "oklch(1 0 0 / 12%)";

  const asanaCurrentDisplay = useMemo(() => {
    if (!asanaCurrent) return null;
    const ws = asanaWorkspaces.find((w) => w.gid === asanaCurrent.asanaWorkspaceGid);
    const team = ws?.teams.find((t) => t.gid === asanaCurrent.asanaTeamGid);
    const wsName = ws?.name ?? asanaCurrent.asanaWorkspaceGid;
    const teamName = team?.name ?? asanaCurrent.asanaTeamGid;
    const privacyLabel = asanaCurrent.defaultPrivacy === "private" ? "Private" : "Public to team";
    return `${wsName} · ${teamName} · ${privacyLabel}`;
  }, [asanaCurrent, asanaWorkspaces]);

  if (!authChecked) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.11 0.008 55)", color: "oklch(0.96 0.012 80)" }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor }}>
        <a href="/ask" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Gerendo</h1>
          <p className="text-xs mt-0.5" style={{ color: dimColor }}>Settings</p>
        </a>
        <div className="flex gap-4">
          <a href="/connect" className="text-xs underline underline-offset-2" style={{ color: dimColor }}>Connect tools</a>
          <a href="/ask" className="text-xs underline underline-offset-2" style={{ color: dimColor }}>Ask questions</a>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full flex flex-col gap-8">

        {/* Current user */}
        {info?.currentUser && (
          <div className="flex items-center gap-4 p-4 rounded-2xl border" style={{ borderColor, background: "oklch(0.13 0.009 55)" }}>
            {info.currentUser.avatar ? (
              <img src={info.currentUser.avatar} className="w-10 h-10 rounded-full" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: inkSoft, color: emberColor }}>
                {info.currentUser.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{info.currentUser.name}</p>
              <p className="text-xs" style={{ color: mutedColor }}>{info.currentUser.email}</p>
            </div>
          </div>
        )}

        {/* Workspace */}
        {info?.workspace && (
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Workspace</h2>
            <div className="p-4 rounded-2xl border" style={{ borderColor, background: "oklch(0.13 0.009 55)" }}>
              <p className="text-sm font-medium">{info.workspace.name}</p>
              <p className="text-xs mt-0.5" style={{ color: mutedColor }}>
                Created {new Date(info.workspace.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        )}

        {/* Team members */}
        {info?.members && (
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Team ({info.members.length})
            </h2>
            <div className="flex flex-col gap-2">
              {info.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 p-3 rounded-2xl border" style={{ borderColor, background: "oklch(0.13 0.009 55)" }}>
                  {m.avatar ? (
                    <img src={m.avatar} className="w-8 h-8 rounded-full" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: inkSoft, color: emberColor }}>
                      {m.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.name} {m.isYou && <span style={{ color: mutedColor }} className="font-normal text-xs">(you)</span>}
                    </p>
                    <p className="text-xs truncate" style={{ color: mutedColor }}>{m.email}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg capitalize" style={{ background: inkSoft, color: m.role === "admin" ? emberColor : mutedColor }}>
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Invite team members</h2>
            <p className="text-sm mt-1" style={{ color: mutedColor }}>
              Share this link with your team. Anyone with it can join your workspace.
            </p>
          </div>

          {!inviteUrl ? (
            <button
              onClick={generateInvite}
              disabled={generating}
              className="self-start px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              style={{ background: emberColor, color: "oklch(0.11 0.008 55)" }}
            >
              {generating ? "Generating..." : "Generate invite link"}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border"
                  style={{ background: "oklch(0.13 0.009 55)", borderColor: "oklch(1 0 0 / 12%)", color: "oklch(0.96 0.012 80)" }}
                />
                <button
                  onClick={copyInvite}
                  className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                  style={{ background: copied ? "oklch(0.65 0.15 145)" : emberColor, color: "oklch(0.11 0.008 55)" }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs" style={{ color: dimColor }}>Expires in 30 days. Generate a new one anytime.</p>
              <button onClick={generateInvite} disabled={generating} className="self-start text-xs underline underline-offset-2" style={{ color: dimColor }}>
                Generate new link
              </button>
            </div>
          )}
          {error && <p className="text-sm" style={{ color: "oklch(0.62 0.22 25)" }}>{error}</p>}
        </div>

        {/* Notifications */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Notifications</h2>
            <p className="text-sm mt-1" style={{ color: mutedColor }}>
              Get push notifications when Gerendo detects a decision or drift that needs your attention.
            </p>
          </div>

          <div className="p-4 rounded-2xl border flex items-center justify-between gap-4" style={{ borderColor, background: "oklch(0.13 0.009 55)" }}>
            <div>
              {push.state === "unsupported" && (
                <p className="text-sm" style={{ color: mutedColor }}>Push notifications are not supported in this browser.</p>
              )}
              {push.state === "denied" && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium" style={{ color: "oklch(0.75 0.18 25)" }}>
                    Notifications are blocked by your browser.
                  </p>
                  <ol className="flex flex-col gap-1" style={{ color: mutedColor }}>
                    {/Chrome|Chromium/.test(navigator.userAgent) && !(/Edg/.test(navigator.userAgent)) && (<>
                      <li className="text-xs">1. Click the <strong style={{ color: "oklch(0.88 0.012 80)" }}>lock icon</strong> in the address bar</li>
                      <li className="text-xs">2. Find <strong style={{ color: "oklch(0.88 0.012 80)" }}>Notifications</strong> and set it to <strong style={{ color: "oklch(0.88 0.012 80)" }}>Allow</strong></li>
                      <li className="text-xs">3. Reload this page</li>
                    </>)}
                    {/Edg/.test(navigator.userAgent) && (<>
                      <li className="text-xs">1. Click the <strong style={{ color: "oklch(0.88 0.012 80)" }}>lock icon</strong> in the address bar</li>
                      <li className="text-xs">2. Click <strong style={{ color: "oklch(0.88 0.012 80)" }}>Permissions for this site</strong></li>
                      <li className="text-xs">3. Set <strong style={{ color: "oklch(0.88 0.012 80)" }}>Notifications</strong> to <strong style={{ color: "oklch(0.88 0.012 80)" }}>Allow</strong></li>
                      <li className="text-xs">4. Reload this page</li>
                    </>)}
                    {/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && (<>
                      <li className="text-xs">1. Open <strong style={{ color: "oklch(0.88 0.012 80)" }}>Safari → Settings → Websites</strong></li>
                      <li className="text-xs">2. Click <strong style={{ color: "oklch(0.88 0.012 80)" }}>Notifications</strong> in the sidebar</li>
                      <li className="text-xs">3. Find <strong style={{ color: "oklch(0.88 0.012 80)" }}>app.gerendo.com</strong> and set to <strong style={{ color: "oklch(0.88 0.012 80)" }}>Allow</strong></li>
                      <li className="text-xs">4. Reload this page</li>
                    </>)}
                    {!/Chrome|Chromium|Edg|Safari/.test(navigator.userAgent) && (<>
                      <li className="text-xs">1. Click the <strong style={{ color: "oklch(0.88 0.012 80)" }}>lock icon</strong> in the address bar</li>
                      <li className="text-xs">2. Find <strong style={{ color: "oklch(0.88 0.012 80)" }}>Notifications</strong> and set to <strong style={{ color: "oklch(0.88 0.012 80)" }}>Allow</strong></li>
                      <li className="text-xs">3. Reload this page</li>
                    </>)}
                  </ol>
                  <button
                    onClick={() => window.location.reload()}
                    className="self-start text-xs px-3 py-1.5 rounded-lg font-medium mt-1 transition-colors"
                    style={{ background: inkSoft, color: mutedColor, border: `1px solid ${borderColor}` }}
                  >
                    Reload page
                  </button>
                </div>
              )}
              {push.state === "granted" && (
                <p className="text-sm">Notifications enabled on this device.</p>
              )}
              {(push.state === "prompt" || push.state === "loading") && (
                <p className="text-sm" style={{ color: mutedColor }}>Enable to receive decision alerts on this device.</p>
              )}
            </div>

            {push.state === "granted" && (
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={sendTestNotification}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ background: inkSoft, color: emberColor, border: `1px solid ${borderColor}` }}
                  >
                    {testSent ? "Sent!" : "Test"}
                  </button>
                  <button
                    onClick={push.disable}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ background: inkSoft, color: mutedColor, border: `1px solid ${borderColor}` }}
                  >
                    Disable
                  </button>
                </div>
                {testError && <p className="text-xs" style={{ color: "oklch(0.75 0.18 25)" }}>{testError}</p>}
              </div>
            )}
            {(push.state === "prompt") && (
              <button
                onClick={push.enable}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                style={{ background: emberColor, color: "oklch(0.11 0.008 55)" }}
              >
                Enable
              </button>
            )}
            {push.state === "loading" && (
              <span className="shrink-0 text-xs" style={{ color: mutedColor }}>...</span>
            )}
          </div>
        </div>

        {/* Asana defaults */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Asana defaults</h2>
            <p className="text-sm mt-1" style={{ color: mutedColor }}>
              Where Gerendo creates new projects on your behalf when an email decision references a project that doesn&apos;t exist yet.
            </p>
          </div>

          <div className="p-4 rounded-2xl border flex items-center justify-between gap-4" style={{ borderColor, background: "oklch(0.13 0.009 55)" }}>
            <div className="flex-1 min-w-0">
              {asanaStatus === "loading" && (
                <p className="text-sm" style={{ color: mutedColor }}>Loading Asana defaults.</p>
              )}
              {asanaStatus === "error" && (
                <p className="text-sm" style={{ color: "oklch(0.75 0.18 25)" }}>{asanaError ?? "Failed to load."}</p>
              )}
              {asanaStatus === "not_connected" && (
                <p className="text-sm" style={{ color: mutedColor }}>
                  Connect Asana first to configure these defaults.{" "}
                  <a href="/connect" className="underline underline-offset-2" style={{ color: dimColor }}>Connect</a>
                </p>
              )}
              {asanaStatus === "ready" && asanaCurrent === null && (
                <p className="text-sm" style={{ color: mutedColor }}>Not configured yet.</p>
              )}
              {asanaStatus === "ready" && asanaCurrent && (
                <p className="text-sm truncate">{asanaCurrentDisplay}</p>
              )}
            </div>
            {asanaStatus === "ready" && (
              <button
                onClick={() => setAsanaModalOpen(true)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                style={{ background: emberColor, color: "oklch(0.11 0.008 55)" }}
              >
                {asanaCurrent ? "Change" : "Configure"}
              </button>
            )}
            {asanaStatus === "error" && (
              <button
                onClick={loadAsanaDefaults}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{ background: inkSoft, color: mutedColor, border: `1px solid ${borderColor}` }}
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="flex flex-col gap-4 pt-4 border-t" style={{ borderColor }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "oklch(0.75 0.18 25)" }}>Danger zone</h2>
            <p className="text-xs mt-1" style={{ color: dimColor }}>
              Permanently delete all indexed data and disconnect all tools. You can reconnect them afterwards and start fresh.
            </p>
          </div>

          {deleteSuccess && (
            <p className="text-sm" style={{ color: "oklch(0.75 0.18 150)" }}>All indexed data deleted. Your tools have been disconnected.</p>
          )}

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="self-start text-sm px-4 py-2 rounded-xl font-medium transition-colors hover:opacity-90"
              style={{ background: "oklch(0.62 0.22 25 / 12%)", color: "oklch(0.75 0.18 25)", border: "1px solid oklch(0.62 0.22 25 / 30%)" }}
            >
              Delete all indexed data
            </button>
          ) : (
            <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "oklch(0.62 0.22 25 / 8%)", border: "1px solid oklch(0.62 0.22 25 / 25%)" }}>
              <p className="text-sm font-medium" style={{ color: "oklch(0.75 0.18 25)" }}>
                This will delete all indexed data (embeddings and metadata) and disconnect all connected tools. It cannot be undone.
              </p>
              {deleteError && <p className="text-xs" style={{ color: "oklch(0.62 0.22 25)" }}>{deleteError}</p>}
              <div className="flex items-center gap-3">
                <button
                  onClick={deleteAllData}
                  disabled={deleting}
                  className="text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
                  style={{ background: "oklch(0.62 0.22 25)", color: "white" }}
                >
                  {deleting ? "Deleting..." : "Yes, delete everything"}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteError(""); }}
                  disabled={deleting}
                  className="text-sm px-4 py-2 rounded-xl font-medium transition-colors"
                  style={{ background: inkSoft, color: mutedColor, border: `1px solid ${borderColor}` }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="pt-4 border-t" style={{ borderColor }}>
          <a href="/api/auth/signout" className="text-sm underline underline-offset-2" style={{ color: dimColor }}>
            Sign out
          </a>
        </div>
      </div>

      {/* Asana defaults modal */}
      {asanaModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
          style={{ background: "oklch(0.05 0.005 55 / 70%)" }}
          onClick={() => setAsanaModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl border p-6 flex flex-col gap-6"
            style={{ borderColor, background: "oklch(0.13 0.009 55)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asana-picker-modal-title"
          >
            <div>
              <h2 id="asana-picker-modal-title" className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                Where should Gerendo create new Asana projects?
              </h2>
              <p className="text-sm mt-1" style={{ color: mutedColor }}>
                Pick the Asana workspace, team, and default privacy. Gerendo uses these whenever it suggests creating a new project on your behalf.
              </p>
            </div>

            <form onSubmit={onPickerSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="asana-workspace">
                  Asana workspace
                </label>
                <select
                  id="asana-workspace"
                  value={pickerWorkspaceGid}
                  onChange={(e) => onPickerWorkspaceChange(e.target.value)}
                  className="px-4 py-2.5 text-sm rounded-xl border"
                  style={{ background: fieldBg, borderColor: fieldBorder, color: "oklch(0.96 0.012 80)" }}
                >
                  {asanaWorkspaces.length === 0 && <option value="">No workspaces found</option>}
                  {asanaWorkspaces.map((w) => (
                    <option key={w.gid} value={w.gid}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="asana-team">
                  Team
                </label>
                <select
                  id="asana-team"
                  value={pickerTeamGid}
                  onChange={(e) => setPickerTeamGid(e.target.value)}
                  className="px-4 py-2.5 text-sm rounded-xl border"
                  style={{ background: fieldBg, borderColor: fieldBorder, color: "oklch(0.96 0.012 80)" }}
                >
                  {(pickerSelectedWorkspace?.teams ?? []).length === 0 && (
                    <option value="">No teams in this workspace</option>
                  )}
                  {(pickerSelectedWorkspace?.teams ?? []).map((t) => (
                    <option key={t.gid} value={t.gid}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Default privacy for new projects</p>
                <label
                  className="flex items-start gap-3 p-3 rounded-2xl border cursor-pointer"
                  style={{ borderColor, background: fieldBg }}
                >
                  <input
                    type="radio"
                    name="privacy"
                    value="public_to_team"
                    checked={pickerPrivacy === "public_to_team"}
                    onChange={() => setPickerPrivacy("public_to_team")}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm font-medium">Public to team</span>
                    <span className="block text-xs mt-0.5" style={{ color: mutedColor }}>
                      Anyone on the team can see and collaborate on new projects.
                    </span>
                  </span>
                </label>
                <label
                  className="flex items-start gap-3 p-3 rounded-2xl border cursor-pointer"
                  style={{ borderColor, background: fieldBg }}
                >
                  <input
                    type="radio"
                    name="privacy"
                    value="private"
                    checked={pickerPrivacy === "private"}
                    onChange={() => setPickerPrivacy("private")}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm font-medium">Private, only me</span>
                    <span className="block text-xs mt-0.5" style={{ color: mutedColor }}>
                      Only you can see new projects until you invite others manually.
                    </span>
                  </span>
                </label>
              </div>

              {pickerSubmitError && (
                <p className="text-sm" style={{ color: "oklch(0.75 0.18 25)" }}>
                  {pickerSubmitError}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pickerSubmitting || !pickerWorkspaceGid || !pickerTeamGid}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  style={{ background: emberColor, color: "oklch(0.11 0.008 55)" }}
                >
                  {pickerSubmitting ? "Saving..." : "Save defaults"}
                </button>
                <button
                  type="button"
                  onClick={() => setAsanaModalOpen(false)}
                  disabled={pickerSubmitting}
                  className="text-sm px-4 py-2 rounded-xl font-medium transition-colors"
                  style={{ background: inkSoft, color: mutedColor, border: `1px solid ${borderColor}` }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
