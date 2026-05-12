"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Team = { gid: string; name: string };
type Workspace = { gid: string; name: string; teams: Team[] };
type Current = {
  asanaWorkspaceGid: string;
  asanaTeamGid: string;
  defaultPrivacy: string;
};

const borderColor = "oklch(1 0 0 / 8%)";
const mutedColor = "oklch(0.65 0.015 60)";
const dimColor = "oklch(0.72 0.012 60)";
const emberColor = "oklch(0.78 0.14 65)";
const inkSoft = "oklch(0.16 0.01 55)";
const fieldBg = "oklch(0.13 0.009 55)";
const fieldBorder = "oklch(1 0 0 / 12%)";

export default function AsanaPickerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceGid, setWorkspaceGid] = useState<string>("");
  const [teamGid, setTeamGid] = useState<string>("");
  const [privacy, setPrivacy] = useState<"public_to_team" | "private">("public_to_team");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/settings/asana-defaults");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to load (${res.status})`);
        }
        const data: { workspaces: Workspace[]; current: Current | null } = await res.json();
        if (cancelled) return;
        setWorkspaces(data.workspaces ?? []);

        if (data.current) {
          setWorkspaceGid(data.current.asanaWorkspaceGid);
          setTeamGid(data.current.asanaTeamGid);
          setPrivacy(data.current.defaultPrivacy === "private" ? "private" : "public_to_team");
        } else if (data.workspaces && data.workspaces.length > 0) {
          setWorkspaceGid(data.workspaces[0].gid);
          setTeamGid(data.workspaces[0].teams[0]?.gid ?? "");
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load Asana defaults");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.gid === workspaceGid) ?? null,
    [workspaces, workspaceGid]
  );

  function onWorkspaceChange(nextGid: string) {
    setWorkspaceGid(nextGid);
    const next = workspaces.find((w) => w.gid === nextGid);
    setTeamGid(next?.teams[0]?.gid ?? "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceGid || !teamGid) {
      setSubmitError("Pick a workspace and team");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/settings/asana-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asanaWorkspaceGid: workspaceGid,
          asanaTeamGid: teamGid,
          defaultPrivacy: privacy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.saved) {
        throw new Error(data.error ?? `Failed to save (${res.status})`);
      }
      router.push("/ask");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "oklch(0.11 0.008 55)", color: "oklch(0.96 0.012 80)" }}
    >
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor }}>
        <a href="/ask" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Gerendo
          </h1>
          <p className="text-xs mt-0.5" style={{ color: dimColor }}>
            Asana defaults
          </p>
        </a>
        <div className="flex gap-4">
          <a href="/settings" className="text-xs underline underline-offset-2" style={{ color: dimColor }}>
            Settings
          </a>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full flex flex-col gap-8">
        <div>
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Where should Gerendo create new Asana projects?
          </h2>
          <p className="text-sm mt-1" style={{ color: mutedColor }}>
            Pick the Asana workspace, team, and default privacy. Gerendo uses these whenever it suggests
            creating a new project on your behalf.
          </p>
        </div>

        {loading && (
          <p className="text-sm" style={{ color: mutedColor }}>
            Loading your Asana workspaces.
          </p>
        )}

        {loadError && (
          <p className="text-sm" style={{ color: "oklch(0.75 0.18 25)" }}>
            {loadError}
          </p>
        )}

        {!loading && !loadError && (
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="asana-workspace">
                Asana workspace
              </label>
              <select
                id="asana-workspace"
                value={workspaceGid}
                onChange={(e) => onWorkspaceChange(e.target.value)}
                className="px-4 py-2.5 text-sm rounded-xl border"
                style={{ background: fieldBg, borderColor: fieldBorder, color: "oklch(0.96 0.012 80)" }}
              >
                {workspaces.length === 0 && <option value="">No workspaces found</option>}
                {workspaces.map((w) => (
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
                value={teamGid}
                onChange={(e) => setTeamGid(e.target.value)}
                className="px-4 py-2.5 text-sm rounded-xl border"
                style={{ background: fieldBg, borderColor: fieldBorder, color: "oklch(0.96 0.012 80)" }}
              >
                {(selectedWorkspace?.teams ?? []).length === 0 && (
                  <option value="">No teams in this workspace</option>
                )}
                {(selectedWorkspace?.teams ?? []).map((t) => (
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
                  checked={privacy === "public_to_team"}
                  onChange={() => setPrivacy("public_to_team")}
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
                  checked={privacy === "private"}
                  onChange={() => setPrivacy("private")}
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

            {submitError && (
              <p className="text-sm" style={{ color: "oklch(0.75 0.18 25)" }}>
                {submitError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || !workspaceGid || !teamGid}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ background: emberColor, color: "oklch(0.11 0.008 55)" }}
              >
                {submitting ? "Saving..." : "Save defaults"}
              </button>
              <a
                href="/ask"
                className="text-xs underline underline-offset-2"
                style={{ color: dimColor }}
              >
                Skip for now
              </a>
            </div>
            <p className="text-xs" style={{ color: dimColor, background: inkSoft, padding: "0", margin: 0 }}>
              You can change these any time in Settings.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
