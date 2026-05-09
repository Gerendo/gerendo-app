import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGmailToken } from "@/lib/agency-db";

// Labels to always exclude - system noise
const EXCLUDED_LABELS = new Set([
  "CHAT", "SPAM", "TRASH", "UNREAD", "STARRED", "IMPORTANT",
  "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS",
]);

export async function GET(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  let token: string;
  try {
    token = await getGmailToken(workspaceId, userId);
  } catch {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: "v1", auth });

  const labelsRes = await gmail.users.labels.list({ userId: "me" });
  const all = labelsRes.data.labels ?? [];

  const labels = all
    .filter(l => l.id && l.name && !EXCLUDED_LABELS.has(l.id))
    .map(l => ({
      id: l.id!,
      name: l.type === "system"
        ? l.name!.replace("CATEGORY_", "").toLowerCase()
        : l.name!,
      type: l.type ?? "user",
      // Pre-select inbox and sent by default
      default: l.id === "INBOX" || l.id === "SENT",
    }))
    .sort((a, b) => {
      // System labels first, then user labels alphabetically
      if (a.type === "system" && b.type !== "system") return -1;
      if (a.type !== "system" && b.type === "system") return 1;
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json({ labels });
}
