"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function SettingsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
    } catch (err: any) {
      setDeleteError(err.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const borderColor = "oklch(1 0 0 / 8%)";
  const mutedColor = "oklch(0.65 0.015 60)";
  const dimColor = "oklch(0.72 0.012 60)";
  const emberColor = "oklch(0.78 0.14 65)";
  const inkSoft = "oklch(0.16 0.01 55)";

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

        {/* Danger zone */}
        <div className="flex flex-col gap-4 pt-4 border-t" style={{ borderColor }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "oklch(0.75 0.18 25)" }}>Danger zone</h2>
            <p className="text-xs mt-1" style={{ color: dimColor }}>
              Permanently delete all indexed data and disconnect all tools. You can reconnect them afterwards and start fresh.
            </p>
          </div>

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
                This will delete all emails, Drive files, and Asana tasks from the database. It cannot be undone.
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
    </div>
  );
}
