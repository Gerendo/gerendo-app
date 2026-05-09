import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { syncSingleAsanaTask } from "@/app/api/sync/asana/route";

export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse> {
  const hookSecret = request.headers.get("x-hook-secret");
  const hookSignature = request.headers.get("x-hook-signature");

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspace_id");
  const userId = searchParams.get("user_id");
  // asana_ws is the Asana workspace GID included in the target URL at registration time
  const asanaWsKey = searchParams.get("asana_ws") ?? "default";

  if (!workspaceId || !userId) {
    return NextResponse.json({ error: "Missing workspace context" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Handshake phase: Asana sends X-Hook-Secret on first POST
  if (hookSecret) {
    await supabase.from("webhook_secrets").upsert({
      workspace_id: workspaceId,
      user_id: userId,
      provider: "asana",
      key: asanaWsKey,
      secret: hookSecret,
      meta: { registeredAt: Date.now() },
    }, { onConflict: "workspace_id,user_id,provider,key" });

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Hook-Secret": hookSecret,
      },
    });
  }

  // Event phase: verify HMAC signature
  if (!hookSignature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const rawBody = await request.text();

  const { data: secretRow } = await supabase
    .from("webhook_secrets")
    .select("secret")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "asana")
    .eq("key", asanaWsKey)
    .maybeSingle();

  if (!secretRow) {
    return NextResponse.json({ error: "No secret found" }, { status: 401 });
  }

  const expectedSig = createHmac("sha256", secretRow.secret)
    .update(rawBody)
    .digest("hex");

  if (hookSignature !== expectedSig) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const events: Array<{ resource: { gid: string; resource_type: string }; action: string }> = body.events ?? [];

  if (events.length === 0) return NextResponse.json({ ok: true }); // heartbeat

  // Dedupe task GIDs, skip removed events
  const taskGids = [...new Set(
    events
      .filter(e => e.resource?.resource_type === "task" && e.action !== "removed")
      .map(e => e.resource.gid)
  )];

  for (const taskGid of taskGids) {
    try {
      await syncSingleAsanaTask(workspaceId, userId, taskGid);
    } catch (err: any) {
      console.error(`[webhook/asana] task sync failed ${taskGid}:`, err?.message);
    }
  }

  return NextResponse.json({ ok: true });
}
