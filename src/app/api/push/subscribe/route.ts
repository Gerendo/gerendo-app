import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const ctx = await requireWorkspace();
  if (isErrorResponse(ctx)) return ctx;

  const body = await request.json();
  const { endpoint, keys, deviceType = "browser" } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    deviceType?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("push_subscriptions").upsert(
    {
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device_type: deviceType,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const ctx = await requireWorkspace();
  if (isErrorResponse(ctx)) return ctx;

  const { endpoint } = await request.json();
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const service = createServiceClient();
  await service.from("push_subscriptions").delete().eq("user_id", ctx.userId).eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
