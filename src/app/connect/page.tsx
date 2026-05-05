"use client";

import { useState } from "react";
import Nango from "@nangohq/frontend";

type Status = "idle" | "connecting" | "syncing" | "done" | "error";

export default function ConnectPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [syncedCount, setSyncedCount] = useState<number | null>(null);

  async function handleConnect() {
    setStatus("connecting");
    setMessage("");

    try {
      // Get a short-lived session token from our server
      const sessionRes = await fetch("/api/nango/session", { method: "POST" });
      if (!sessionRes.ok) {
        const err = await sessionRes.json();
        throw new Error(err.error ?? "Failed to create session");
      }
      const { token } = await sessionRes.json();

      // Launch Nango's hosted OAuth flow
      const nango = new Nango({ connectSessionToken: token });
      await nango.auth("google-mail");

      // OAuth done - now trigger Gmail sync
      setStatus("syncing");
      setMessage("Connected! Syncing all your emails - this may take a few minutes...");

      const syncRes = await fetch("/api/sync/gmail", { method: "POST" });
      if (!syncRes.ok) {
        const err = await syncRes.json();
        throw new Error(err.error ?? "Sync failed");
      }

      const { synced } = await syncRes.json();
      setSyncedCount(synced);
      setStatus("done");
      setMessage(`Done! ${synced} emails indexed.`);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Something went wrong");
    }
  }

  async function handleSync() {
    setStatus("syncing");
    setMessage("Syncing new emails...");
    setSyncedCount(null);


    try {
      const syncRes = await fetch("/api/sync/gmail", { method: "POST" });
      if (!syncRes.ok) {
        const err = await syncRes.json();
        throw new Error(err.error ?? "Sync failed");
      }
      const { synced, message: msg } = await syncRes.json();
      setSyncedCount(synced);
      setStatus("done");
      setMessage(msg ?? `${synced} new emails indexed.`);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Sync failed");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-md w-full flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connect your tools</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Your data stays on this machine. We only read, never send.
          </p>
        </div>

        <div className="border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm">G</div>
              <div>
                <div className="font-medium text-sm">Gmail</div>
                <div className="text-zinc-500 text-xs">Read email threads</div>
              </div>
            </div>
            {status === "done" && (
              <span className="text-xs text-green-400 font-medium">Connected</span>
            )}
          </div>

          {status === "idle" && (
            <button
              onClick={handleConnect}
              className="w-full bg-white text-black text-sm font-medium py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Connect Gmail
            </button>
          )}

          {status === "connecting" && (
            <button disabled className="w-full bg-zinc-800 text-zinc-400 text-sm py-2 rounded-lg cursor-not-allowed">
              Connecting...
            </button>
          )}

          {status === "syncing" && (
            <button disabled className="w-full bg-zinc-800 text-zinc-400 text-sm py-2 rounded-lg cursor-not-allowed">
              Syncing emails...
            </button>
          )}

          {status === "done" && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSync}
                className="w-full bg-zinc-800 text-white text-sm font-medium py-2 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Sync new emails
              </button>
              <a
                href="/ask"
                className="w-full bg-white text-black text-sm font-medium py-2 rounded-lg hover:bg-zinc-100 transition-colors text-center"
              >
                Ask questions
              </a>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col gap-2">
              <p className="text-red-400 text-xs">{message}</p>
              <button
                onClick={handleConnect}
                className="w-full bg-white text-black text-sm font-medium py-2 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {message && status !== "error" && (
          <p className="text-zinc-400 text-sm text-center">{message}</p>
        )}

        {syncedCount !== null && status === "done" && (
          <p className="text-zinc-500 text-xs text-center">
            {syncedCount === 0
              ? "No new emails since last sync."
              : `${syncedCount} emails are now searchable.`}
          </p>
        )}
      </div>
    </div>
  );
}
