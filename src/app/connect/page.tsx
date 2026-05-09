"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type SyncStatus = "checking" | "idle" | "connecting" | "syncing" | "done" | "error";
type DriveStatus = "idle" | "connecting" | "syncing" | "done" | "error";

interface LabelProgress {
  synced: number;
  total: number | null;
  status: "pending" | "syncing" | "done" | "error";
}

function ConnectPageInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<SyncStatus>("checking");
  const [driveStatus, setDriveStatus] = useState<DriveStatus>("idle");
  const [driveSynced, setDriveSynced] = useState<{ synced: number; total: number } | null>(null);
  const [driveError, setDriveError] = useState("");
  const [driveConnected, setDriveConnected] = useState(false);
  const [asanaStatus, setAsanaStatus] = useState<DriveStatus>("idle");
  const [asanaSynced, setAsanaSynced] = useState<{ synced: number } | null>(null);
  const [asanaError, setAsanaError] = useState("");
  const [asanaConnected, setAsanaConnected] = useState(false);
  const [error, setError] = useState("");
  const [labelProgress, setLabelProgress] = useState<Record<string, LabelProgress>>({});
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [totalSynced, setTotalSynced] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const driveConnectedParam = searchParams.get("drive_connected");
    const driveErrorParam = searchParams.get("drive_error");
    const gmailConnectedParam = searchParams.get("gmail_connected");
    const gmailErrorParam = searchParams.get("gmail_error");

    if (driveConnectedParam === "1") {
      setDriveConnected(true);
      setDriveStatus("idle");
      syncDrive();
      window.history.replaceState({}, "", "/connect");
    } else if (driveErrorParam) {
      setDriveError("Drive authorization failed. Try again.");
      setDriveStatus("error");
      window.history.replaceState({}, "", "/connect");
    }

    const asanaConnectedParam = searchParams.get("asana_connected");
    const asanaErrorParam = searchParams.get("asana_error");
    if (asanaConnectedParam === "1") {
      setAsanaConnected(true);
      setAsanaStatus("idle");
      syncAsana();
      window.history.replaceState({}, "", "/connect");
    } else if (asanaErrorParam) {
      setAsanaError("Asana authorization failed. Try again.");
      setAsanaStatus("error");
      window.history.replaceState({}, "", "/connect");
    }

    if (gmailConnectedParam === "1") {
      setStatus("idle");
      startSync();
      window.history.replaceState({}, "", "/connect");
    } else if (gmailErrorParam) {
      setError("Gmail authorization failed. Try again.");
      setStatus("error");
      window.history.replaceState({}, "", "/connect");
    }
  }, []);

  useEffect(() => {
    fetch("/api/nango/status")
      .then((r) => r.json())
      .then(({ connected, driveConnected: dc, asanaConnected: ac }) => {
        if (dc) setDriveConnected(true);
        if (ac) setAsanaConnected(true);
        if (connected) {
          // Check if there's an active sync job
          fetch("/api/sync/status")
            .then((r) => r.json())
            .then((job) => {
              if (job.status === "running") {
                setStatus("syncing");
                setLabelProgress(job.labelProgress ?? {});
                setCurrentLabel(job.currentLabel);
                setTotalSynced(job.totalSynced ?? 0);
                startPolling();
              } else if (job.status === "done") {
                setStatus("done");
                setLabelProgress(job.labelProgress ?? {});
                setTotalSynced(job.totalSynced ?? 0);
              } else {
                setStatus("idle");
              }
            })
            .catch(() => setStatus("idle"));
        } else {
          setStatus("idle");
        }
      })
      .catch(() => setStatus("idle"));

    return () => stopPolling();
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/sync/status");
        const job = await res.json();
        setLabelProgress(job.labelProgress ?? {});
        setCurrentLabel(job.currentLabel);
        setTotalSynced(job.totalSynced ?? 0);
        if (job.status === "done") {
          setStatus("done");
          stopPolling();
        } else if (job.status === "error") {
          setError("Sync failed. Try again.");
          setStatus("error");
          stopPolling();
        }
      } catch {}
    }, 2000);
  }

  async function startSync() {
    setStatus("syncing");
    setLabelProgress({});
    setCurrentLabel(null);
    setTotalSynced(0);
    setError("");

    try {
      const res = await fetch("/api/sync/gmail/stream");
      const { jobId, error: err } = await res.json();
      if (err) throw new Error(err);
      if (!jobId) throw new Error("No job ID returned");
      startPolling();
    } catch (err: any) {
      setError(err.message ?? "Failed to start sync");
      setStatus("error");
    }
  }

  async function handleConnect() {
    window.location.href = "/api/auth/gmail";
  }

  async function syncAsana() {
    setAsanaStatus("syncing");
    setAsanaError("");
    try {
      const res = await fetch("/api/sync/asana", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Asana sync failed");
      setAsanaSynced({ synced: data.synced });
      setAsanaStatus("done");
    } catch (err: any) {
      setAsanaError(err.message ?? "Asana sync failed");
      setAsanaStatus("error");
    }
  }

  async function handleDriveConnect() {
    // Redirect to Google OAuth directly
    window.location.href = "/api/auth/drive";
  }

  async function syncDrive() {
    setDriveStatus("syncing");
    setDriveError("");
    try {
      const res = await fetch("/api/sync/drive", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drive sync failed");
      setDriveSynced({ synced: data.synced, total: data.total });
      setDriveStatus("done");
    } catch (err: any) {
      setDriveError(err.message ?? "Drive sync failed");
      setDriveStatus("error");
    }
  }

  const labels = Object.entries(labelProgress);
  const doneCount = labels.filter(([, v]) => v.status === "done").length;
  const progressPct = labels.length > 0 ? Math.round((doneCount / labels.length) * 100) : 0;
  const activeLabel = currentLabel;

  return (
    <div className="min-h-screen bg-[oklch(0.11_0.008_55)] text-white flex flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-md w-full flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Connect your tools</h1>
          <p className="text-[oklch(0.65_0.015_60)] mt-1 text-sm">
            Connect your tools to start building your agency brain.
          </p>
        </div>

        <div className="border border-[oklch(1_0_0_/_8%)] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[oklch(0.16_0.01_55)] flex items-center justify-center text-sm">G</div>
              <div>
                <div className="font-medium text-sm">Gmail</div>
                <div className="text-[oklch(0.55_0.012_60)] text-xs">Read email threads</div>
              </div>
            </div>
            {(status === "done" || status === "syncing") && (
              <span className="text-xs text-[oklch(0.78_0.14_65)] font-medium">Connected</span>
            )}
          </div>

          {status === "checking" && (
            <div className="text-[oklch(0.55_0.012_60)] text-sm text-center py-1">Checking connection...</div>
          )}

          {status === "idle" && (
            <button
              onClick={handleConnect}
              className="w-full bg-[oklch(0.96_0.012_80)] text-[oklch(0.11_0.008_55)] hover:bg-[oklch(0.92_0.02_75)] transition-colors"
            >
              Connect Gmail
            </button>
          )}

          {status === "connecting" && (
            <button disabled className="w-full bg-[oklch(0.16_0.01_55)] text-[oklch(0.65_0.015_60)] text-sm py-2 rounded-lg cursor-not-allowed">
              Connecting...
            </button>
          )}

          {status === "syncing" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-[oklch(0.65_0.015_60)]">
                <span>{activeLabel ? `Syncing ${activeLabel}...` : "Starting sync..."}</span>
                <span>{totalSynced} emails</span>
              </div>
              <div className="w-full h-1.5 bg-[oklch(0.16_0.01_55)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-[oklch(0.45_0.01_60)] text-xs text-center">
                {doneCount} of {labels.length} mailboxes done
              </div>
              {labels.length > 0 && (
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {labels.map(([label, v]) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-[oklch(0.65_0.015_60)] capitalize">{label}</span>
                      <span className={
                        v.status === "done" ? "text-[oklch(0.78_0.14_65)]" :
                        v.status === "error" ? "text-red-400" :
                        v.status === "syncing" ? "text-[oklch(0.85_0.08_70)]" :
                        "text-[oklch(0.45_0.01_60)]"
                      }>
                        {v.status === "done"
                          ? `${v.synced} emails`
                          : v.status === "error"
                            ? "error"
                            : v.status === "syncing"
                              ? `${v.synced} / ${v.total ?? "..."}`
                              : "waiting..."}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {status === "done" && (
            <div className="flex flex-col gap-2">
              <p className="text-[oklch(0.65_0.015_60)] text-xs text-center">
                {totalSynced === 0 ? "Already up to date." : `${totalSynced} emails indexed.`}
              </p>
              <button
                onClick={startSync}
                className="w-full bg-[oklch(0.16_0.01_55)] text-white text-sm font-medium py-2 rounded-lg hover:bg-[oklch(0.20_0.012_55)] transition-colors"
              >
                Sync new emails
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col gap-2">
              <p className="text-red-400 text-xs">{error}</p>
              <button
                onClick={startSync}
                className="w-full bg-[oklch(0.96_0.012_80)] text-[oklch(0.11_0.008_55)] hover:bg-[oklch(0.92_0.02_75)] transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Google Drive card */}
        <div className="border border-[oklch(1_0_0_/_8%)] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[oklch(0.16_0.01_55)] flex items-center justify-center text-sm">D</div>
              <div>
                <div className="font-medium text-sm">Google Drive</div>
                <div className="text-[oklch(0.55_0.012_60)] text-xs">Docs, Sheets, Slides</div>
              </div>
            </div>
            {driveStatus === "done" && (
              <span className="text-xs text-[oklch(0.78_0.14_65)] font-medium">Connected</span>
            )}
          </div>

          {driveStatus === "idle" && !driveConnected && (
            <button
              onClick={handleDriveConnect}
              className="w-full bg-[oklch(0.96_0.012_80)] text-[oklch(0.11_0.008_55)] hover:bg-[oklch(0.92_0.02_75)] transition-colors"
            >
              Connect Drive
            </button>
          )}

          {driveStatus === "idle" && driveConnected && (
            <button
              onClick={syncDrive}
              className="w-full bg-[oklch(0.16_0.01_55)] text-white text-sm font-medium py-2 rounded-lg hover:bg-[oklch(0.20_0.012_55)] transition-colors"
            >
              Sync Drive
            </button>
          )}

          {driveStatus === "connecting" && (
            <button disabled className="w-full bg-[oklch(0.16_0.01_55)] text-[oklch(0.65_0.015_60)] text-sm py-2 rounded-lg cursor-not-allowed">
              Connecting...
            </button>
          )}

          {driveStatus === "syncing" && (
            <div className="text-[oklch(0.65_0.015_60)] text-sm text-center py-1 animate-pulse">
              Indexing Drive files...
            </div>
          )}

          {driveStatus === "done" && (
            <div className="flex flex-col gap-2">
              {driveSynced && (
                <p className="text-[oklch(0.65_0.015_60)] text-xs text-center">
                  {driveSynced.synced} of {driveSynced.total} files indexed.
                </p>
              )}
              <button
                onClick={syncDrive}
                className="w-full bg-[oklch(0.16_0.01_55)] text-white text-sm font-medium py-2 rounded-lg hover:bg-[oklch(0.20_0.012_55)] transition-colors"
              >
                Sync Drive
              </button>
            </div>
          )}

          {driveStatus === "error" && (
            <div className="flex flex-col gap-2">
              <p className="text-red-400 text-xs">{driveError}</p>
              <button
                onClick={handleDriveConnect}
                className="w-full bg-[oklch(0.96_0.012_80)] text-[oklch(0.11_0.008_55)] hover:bg-[oklch(0.92_0.02_75)] transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Asana card */}
        <div className="border border-[oklch(1_0_0_/_8%)] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[oklch(0.16_0.01_55)] flex items-center justify-center text-sm">A</div>
              <div>
                <div className="font-medium text-sm">Asana</div>
                <div className="text-[oklch(0.55_0.012_60)] text-xs">Tasks, projects, comments</div>
              </div>
            </div>
            {asanaStatus === "done" && (
              <span className="text-xs text-[oklch(0.78_0.14_65)] font-medium">Connected</span>
            )}
          </div>

          {asanaStatus === "idle" && !asanaConnected && (
            <button
              onClick={() => { window.location.href = "/api/auth/asana"; }}
              className="w-full bg-[oklch(0.96_0.012_80)] text-[oklch(0.11_0.008_55)] hover:bg-[oklch(0.92_0.02_75)] transition-colors"
            >
              Connect Asana
            </button>
          )}

          {asanaStatus === "idle" && asanaConnected && (
            <button
              onClick={syncAsana}
              className="w-full bg-[oklch(0.16_0.01_55)] text-white text-sm font-medium py-2 rounded-lg hover:bg-[oklch(0.20_0.012_55)] transition-colors"
            >
              Sync Asana
            </button>
          )}

          {asanaStatus === "syncing" && (
            <div className="text-[oklch(0.65_0.015_60)] text-sm text-center py-1 animate-pulse">
              Indexing Asana tasks...
            </div>
          )}

          {asanaStatus === "done" && (
            <div className="flex flex-col gap-2">
              {asanaSynced && (
                <p className="text-[oklch(0.65_0.015_60)] text-xs text-center">
                  {asanaSynced.synced} tasks indexed.
                </p>
              )}
              <button
                onClick={syncAsana}
                className="w-full bg-[oklch(0.16_0.01_55)] text-white text-sm font-medium py-2 rounded-lg hover:bg-[oklch(0.20_0.012_55)] transition-colors"
              >
                Sync Asana
              </button>
            </div>
          )}

          {asanaStatus === "error" && (
            <div className="flex flex-col gap-2">
              <p className="text-red-400 text-xs">{asanaError}</p>
              <button
                onClick={() => { window.location.href = "/api/auth/asana"; }}
                className="w-full bg-[oklch(0.96_0.012_80)] text-[oklch(0.11_0.008_55)] hover:bg-[oklch(0.92_0.02_75)] transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        <a
          href="/ask"
          className="w-full bg-[oklch(0.78_0.14_65)] text-[oklch(0.11_0.008_55)] hover:bg-[oklch(0.85_0.08_70)] transition-colors text-center block font-medium"
        >
          Ask your agency brain
        </a>
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
