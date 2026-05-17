// Sends a notification email when an API route hits a 5xx. Cheap
// observability for Phase 0: instead of waiting for a Vercel log to
// surface (and lose it 24h later), the founder learns within seconds.
//
// Best-effort: if the notification itself fails (Resend down, env vars
// missing), we log and move on. The caller has already returned an error
// response to the user — we never want notify-on-error to throw and mask
// the original failure.
//
// Required env: RESEND_API_KEY, RESEND_FROM, ERROR_NOTIFICATION_EMAIL.

import { Resend } from "resend";

type NotifyOpts = {
  route: string;
  error: unknown;
  context?: Record<string, unknown>;
};

export async function notifyError(opts: NotifyOpts): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    const to = process.env.ERROR_NOTIFICATION_EMAIL;

    if (!apiKey || !from || !to) {
      console.error(
        "[notify-error] missing env vars, cannot send notification",
        { hasApiKey: !!apiKey, hasFrom: !!from, hasTo: !!to }
      );
      return;
    }

    const errMessage =
      opts.error instanceof Error ? opts.error.message : String(opts.error);
    const errName = opts.error instanceof Error ? opts.error.name : "unknown";
    const stack = opts.error instanceof Error ? opts.error.stack : undefined;
    const extra =
      typeof opts.error === "object" && opts.error !== null
        ? JSON.stringify(opts.error, null, 2)
        : undefined;

    const lines = [
      `Route: ${opts.route}`,
      `Time: ${new Date().toISOString()}`,
      `Env: ${process.env.VERCEL_ENV ?? "local"}`,
      "",
      `Error (${errName}): ${errMessage}`,
    ];

    if (opts.context && Object.keys(opts.context).length > 0) {
      lines.push("", "Context:", JSON.stringify(opts.context, null, 2));
    }

    if (extra && extra !== "{}") {
      lines.push("", "Error object:", extra);
    }

    if (stack) {
      lines.push("", "Stack:", stack);
    }

    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
      from,
      to,
      subject: `[gerendo error] ${opts.route}`,
      text: lines.join("\n"),
    });

    if (res.error) {
      console.error("[notify-error] resend send failed", res.error);
    }
  } catch (sendErr) {
    console.error("[notify-error] unexpected failure", sendErr);
  }
}
