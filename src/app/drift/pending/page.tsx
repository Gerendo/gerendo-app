"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface PendingFinding {
  id: number;
  decision_summary: string;
  draft_update: string;
  source: string;
  source_external_id: string;
  detected_at: string;
}

interface CreatedInfo {
  projectName: string;
  taskName: string;
  wasExistingProject: boolean;
  taskPermalinkUrl: string | null;
}

export default function PendingDecisionsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<PendingFinding[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorById, setErrorById] = useState<Record<number, string>>({});
  const [createdById, setCreatedById] = useState<Record<number, CreatedInfo>>({});

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    fetch("/api/drift/pending")
      .then((r) => r.json())
      .then((d) => setFindings(Array.isArray(d.findings) ? d.findings : []))
      .catch(() => setFindings([]))
      .finally(() => setLoading(false));
  }, [authChecked]);

  async function createProject(finding: PendingFinding) {
    setBusyId(finding.id);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[finding.id];
      return next;
    });
    try {
      const res = await fetch(`/api/drift/${finding.id}/create-project`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.status !== "created") {
        throw new Error(data.error ?? "Failed to create project");
      }
      setCreatedById((prev) => ({
        ...prev,
        [finding.id]: {
          projectName: data.project_name,
          taskName: data.task_name,
          wasExistingProject: !!data.was_existing_project,
          taskPermalinkUrl: data.task_permalink_url ?? null,
        },
      }));
      // Remove from the pending list after a short success display interval.
      setTimeout(() => {
        setFindings((prev) => prev.filter((f) => f.id !== finding.id));
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorById((prev) => ({ ...prev, [finding.id]: message }));
    } finally {
      setBusyId(null);
    }
  }

  const borderColor = "oklch(1 0 0 / 8%)";
  const mutedColor = "oklch(0.65 0.015 60)";
  const dimColor = "oklch(0.72 0.012 60)";
  const emberColor = "oklch(0.78 0.14 65)";
  const inkSoft = "oklch(0.16 0.01 55)";
  const greenColor = "oklch(0.65 0.15 145)";
  const errorColor = "oklch(0.62 0.22 25)";

  if (!authChecked) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "oklch(0.11 0.008 55)", color: "oklch(0.96 0.012 80)" }}
    >
      <div
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor }}
      >
        <a href="/ask" className="hover:opacity-80 transition-opacity">
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Gerendo
          </h1>
          <p className="text-xs mt-0.5" style={{ color: dimColor }}>
            Pending decisions
          </p>
        </a>
        <div className="flex gap-4">
          <a
            href="/ask"
            className="text-xs underline underline-offset-2"
            style={{ color: dimColor }}
          >
            Ask questions
          </a>
          <a
            href="/settings"
            className="text-xs underline underline-offset-2"
            style={{ color: dimColor }}
          >
            Settings
          </a>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full flex flex-col gap-6">
        <div>
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Decisions waiting for an Asana project
          </h2>
          <p className="text-sm mt-1" style={{ color: mutedColor }}>
            Gerendo detected these client decisions but could not match them to an existing
            Asana task. Create a new project for each one.
          </p>
        </div>

        {loading && (
          <p className="text-sm" style={{ color: mutedColor }}>
            Loading...
          </p>
        )}

        {!loading && findings.length === 0 && (
          <p className="text-sm" style={{ color: mutedColor }}>
            No pending decisions waiting for an Asana project.
          </p>
        )}

        <div className="flex flex-col gap-4">
          {findings.map((f) => {
            const created = createdById[f.id];
            const error = errorById[f.id];
            const busy = busyId === f.id;
            return (
              <div
                key={f.id}
                className="p-4 rounded-2xl border flex flex-col gap-3"
                style={{ borderColor, background: "oklch(0.13 0.009 55)" }}
              >
                <p className="text-sm font-semibold">{f.decision_summary}</p>
                <p className="text-xs" style={{ color: mutedColor }}>
                  {f.draft_update}
                </p>

                {created ? (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: "oklch(0.65 0.15 145 / 12%)",
                      border: "1px solid oklch(0.65 0.15 145 / 30%)",
                    }}
                  >
                    <span
                      className="text-xs font-semibold"
                      style={{ color: greenColor }}
                    >
                      Created
                    </span>
                    <span className="text-xs" style={{ color: dimColor }}>
                      {created.wasExistingProject ? "Added to" : "Project"} {created.projectName}
                      {" / "}task {created.taskName}
                    </span>
                    {created.taskPermalinkUrl && (
                      <a
                        href={created.taskPermalinkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline underline-offset-2"
                        style={{ color: emberColor }}
                      >
                        Open
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => createProject(f)}
                      disabled={busy}
                      className="self-start px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                      style={{ background: emberColor, color: "oklch(0.11 0.008 55)" }}
                    >
                      {busy ? "Creating..." : "Create Asana project"}
                    </button>
                    {error && (
                      <p className="text-xs" style={{ color: errorColor }}>
                        {error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-6 border-t" style={{ borderColor }}>
          <a
            href="/ask"
            className="text-xs underline underline-offset-2"
            style={{ color: dimColor }}
          >
            Back to Ask
          </a>
        </div>
      </div>
    </div>
  );
}
