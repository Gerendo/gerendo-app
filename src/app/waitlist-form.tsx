"use client";

import { useState } from "react";

type State =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Something went wrong.");
      }
      setState({ status: "success" });
      setEmail("");
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  if (state.status === "success") {
    return (
      <div className="max-w-md rounded-lg border border-border bg-bg/40 px-4 py-4 text-base text-fg">
        You&apos;re on the list. Check your inbox — a note from{" "}
        <span className="text-accent">contact@gerendo.com</span> is on its way.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@agency.com"
        disabled={state.status === "submitting"}
        className="flex-1 rounded-lg border border-border bg-transparent px-4 py-3.5 text-[15px] text-fg placeholder:text-muted focus:border-fg focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={state.status === "submitting"}
        className="rounded-lg bg-accent px-5 py-3.5 text-[15px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {state.status === "submitting" ? "Joining…" : "Join the waitlist"}
      </button>
      {state.status === "error" && (
        <p className="basis-full text-sm text-accent">{state.message}</p>
      )}
    </form>
  );
}
