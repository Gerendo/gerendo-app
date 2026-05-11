import { NextResponse } from "next/server";
import { webpush } from "@/lib/push";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const ctx = await requireWorkspace();
  if (isErrorResponse(ctx)) return ctx;

  const service = createServiceClient();
  const { data: subs, error } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", ctx.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ error: "No subscriptions found. Enable notifications first." }, { status: 404 });

  const payload = JSON.stringify({
    title: "Gerendo",
    body: "Acme confirmed the launch is moving to May 20. Update the Asana task from May 12?",
    tag: "gerendo-test",
    actions: [
      { action: "confirm", title: "Yes" },
      { action: "edit", title: "Edit" },
      { action: "dismiss", title: "No" },
    ],
    data: { findingId: "test-123" },
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected");

  if (sent === 0) {
    const reason = (failed[0]?.reason as { message?: string })?.message ?? "Unknown error";
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  return NextResponse.json({ sent });
}
