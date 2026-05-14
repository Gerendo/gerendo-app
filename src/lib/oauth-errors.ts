// Shared helpers for surfacing OAuth reauthorize-required errors out of
// API routes. ReauthorizeRequiredError is thrown by getGmailToken /
// getDriveToken / getAsanaToken when a token is expired and the refresh
// path cannot recover (no refresh_token, invalid_grant, network error).
//
// Routes should map this to an HTTP 401 with a stable shape — the UI keys
// on `error: "reauthorize_required"` + `provider` to render a Reconnect CTA.
// Never surface the raw err.message (it contains provider jargon like
// "invalid_grant") and never fall back to the stale token.

import { NextResponse } from "next/server";
import { ReauthorizeRequiredError } from "@/lib/agency-db";

export function isReauthError(err: unknown): err is ReauthorizeRequiredError {
  return err instanceof ReauthorizeRequiredError;
}

export function reauthErrorToResponse(err: unknown): NextResponse | null {
  if (!isReauthError(err)) return null;
  return NextResponse.json(
    { error: "reauthorize_required", provider: err.provider },
    { status: 401 }
  );
}

/**
 * Structured-log helper for paths that cannot return an HTTP response
 * (webhooks, background sweeps). Emits a single greppable line so an
 * operator can spot the issue in Vercel function logs and tell the user
 * to reconnect. We intentionally do NOT log the err.message or stack —
 * provider name + reason code is enough.
 */
export function logReauthNeeded(err: unknown, contextHint: string): boolean {
  if (!isReauthError(err)) return false;
  console.error(
    `[oauth-reauth-needed] provider=${err.provider} reason=${err.reason} context=${contextHint}`
  );
  return true;
}
