import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { getAsanaToken } from "@/lib/agency-db";
import { safeEqual } from "@/lib/crypto";

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  let workspaceId: string;
  let userId: string;

  const authHeader = request.headers.get("authorization");

  if (safeEqual(authHeader ?? "", `Bearer ${process.env.CRON_SECRET ?? ""}`)) {
    const body = await request.json();
    workspaceId = body.workspaceId;
    userId = body.userId;
    if (!workspaceId || !userId) {
      return NextResponse.json({ error: "Missing workspaceId or userId" }, { status: 400 });
    }
  } else {
    const _ws = await requireWorkspace();
    if (isErrorResponse(_ws)) return _ws;
    ({ workspaceId, userId } = _ws);
  }

  let token: string;
  try {
    token = await getAsanaToken(workspaceId, userId);
  } catch {
    return NextResponse.json({ error: "Asana not connected" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const workspacesRes = await fetch("https://app.asana.com/api/1.0/workspaces", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const { data: asanaWorkspaces } = await workspacesRes.json();

  const supabase = createServiceClient();
  const results = [];

  for (const asanaWs of asanaWorkspaces ?? []) {
    try {
      // Check if webhook already exists for this Asana workspace
      const { data: existing } = await supabase
        .from("webhook_secrets")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .eq("provider", "asana")
        .eq("key", asanaWs.gid)
        .maybeSingle();

      if (existing) {
        results.push({ asanaWorkspaceGid: asanaWs.gid, status: "already_registered" });
        continue;
      }

      // Include asana_ws in the target URL so the handshake handler can store
      // key=asanaWs.gid (enabling per-workspace deduplication on re-registration)
      const webhookTarget = `${appUrl}/api/webhooks/asana?workspace_id=${workspaceId}&user_id=${userId}&asana_ws=${asanaWs.gid}`;

      const res = await fetch("https://app.asana.com/api/1.0/webhooks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          data: {
            resource: asanaWs.gid,
            target: webhookTarget,
            filters: [
              { resource_type: "task", action: "changed" },
              { resource_type: "task", action: "added" },
            ],
          },
        }),
      });

      const data = await res.json();
      results.push({ asanaWorkspaceGid: asanaWs.gid, webhookGid: data.data?.gid });
    } catch (err: any) {
      results.push({ asanaWorkspaceGid: asanaWs.gid, error: err.message });
    }
  }

  return NextResponse.json({ ok: true, webhooks: results });
}
