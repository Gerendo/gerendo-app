import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGmailToken } from "@/lib/agency-db";

// Only exclude true system internals that are never useful to index
const EXCLUDED_LABELS = new Set(["UNREAD", "CHAT"]);

const LABEL_META: Record<string, { displayName: string; icon: string; default: boolean }> = {
  INBOX:                  { displayName: "Inbox",        icon: "inbox",          default: true },
  SENT:                   { displayName: "Sent",         icon: "send",           default: true },
  DRAFT:                  { displayName: "Drafts",       icon: "drafts",         default: false },
  STARRED:                { displayName: "Starred",      icon: "star",           default: false },
  IMPORTANT:              { displayName: "Important",    icon: "label_important", default: false },
  SPAM:                   { displayName: "Spam",         icon: "report",         default: false },
  TRASH:                  { displayName: "Trash",        icon: "delete",         default: false },
  SNOOZED:                { displayName: "Snoozed",      icon: "snooze",         default: false },
  SCHEDULED:              { displayName: "Scheduled",    icon: "schedule_send",  default: false },
  CATEGORY_PERSONAL:      { displayName: "Personal",     icon: "person",         default: false },
  CATEGORY_SOCIAL:        { displayName: "Social",       icon: "people",         default: false },
  CATEGORY_PROMOTIONS:    { displayName: "Promotions",   icon: "local_offer",    default: false },
  CATEGORY_UPDATES:       { displayName: "Updates",      icon: "info",           default: false },
  CATEGORY_FORUMS:        { displayName: "Forums",       icon: "forum",          default: false },
};

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
    .map(l => {
      const meta = LABEL_META[l.id!];
      return {
        id: l.id!,
        name: meta?.displayName ?? l.name!,
        icon: meta?.icon ?? "label",
        type: l.type ?? "user",
        default: meta?.default ?? false,
      };
    })
    .sort((a, b) => {
      if (a.type === "system" && b.type !== "system") return -1;
      if (a.type !== "system" && b.type === "system") return 1;
      // Within system labels, put inbox/sent first
      if (a.id === "INBOX") return -1;
      if (b.id === "INBOX") return 1;
      if (a.id === "SENT") return -1;
      if (b.id === "SENT") return 1;
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json({ labels });
}
