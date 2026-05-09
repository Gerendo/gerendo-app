"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function generateInvite() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/invite", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const url = `${window.location.origin}/join?token=${data.token}`;
      setInviteUrl(url);
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.11 0.008 55)", color: "oklch(0.96 0.012 80)" }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
        <a href="/ask" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Gerendo</h1>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.012 60)" }}>Settings</p>
        </a>
        <div className="flex gap-4">
          <a href="/connect" className="text-xs underline underline-offset-2" style={{ color: "oklch(0.55 0.012 60)" }}>Connect tools</a>
          <a href="/ask" className="text-xs underline underline-offset-2" style={{ color: "oklch(0.55 0.012 60)" }}>Ask questions</a>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full flex flex-col gap-8">

        {/* Team section */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Invite team members</h2>
            <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.015 60)" }}>
              Generate an invite link and share it with your team. Anyone with the link can join your workspace.
            </p>
          </div>

          {!inviteUrl ? (
            <button
              onClick={generateInvite}
              disabled={generating}
              className="self-start px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              style={{ background: "oklch(0.78 0.14 65)", color: "oklch(0.11 0.008 55)" }}
            >
              {generating ? "Generating..." : "Generate invite link"}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border"
                  style={{
                    background: "oklch(0.13 0.009 55)",
                    borderColor: "oklch(1 0 0 / 12%)",
                    color: "oklch(0.96 0.012 80)",
                  }}
                />
                <button
                  onClick={copyInvite}
                  className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                  style={{
                    background: copied ? "oklch(0.65 0.15 145)" : "oklch(0.78 0.14 65)",
                    color: "oklch(0.11 0.008 55)",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs" style={{ color: "oklch(0.55 0.012 60)" }}>
                This link expires in 30 days. Generate a new one anytime.
              </p>
              <button
                onClick={generateInvite}
                disabled={generating}
                className="self-start text-xs underline underline-offset-2"
                style={{ color: "oklch(0.55 0.012 60)" }}
              >
                Generate new link
              </button>
            </div>
          )}

          {error && <p className="text-sm" style={{ color: "oklch(0.62 0.22 25)" }}>{error}</p>}
        </div>

        {/* Sign out */}
        <div className="pt-4 border-t" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <a
            href="/api/auth/signout"
            className="text-sm underline underline-offset-2"
            style={{ color: "oklch(0.55 0.012 60)" }}
          >
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
