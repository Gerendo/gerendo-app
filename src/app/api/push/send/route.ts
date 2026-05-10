import { NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase-server";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
  data?: Record<string, unknown>;
}

// Internal route - only callable server-side via CRON_SECRET
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, payload } = await request.json() as {
    userId: string;
    payload: PushPayload;
  };

  if (!userId || !payload) {
    return NextResponse.json({ error: "Missing userId or payload" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: subs, error } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );

  // Remove stale subscriptions (push service returned 410 Gone)
  const staleEndpoints: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410) staleEndpoints.push(subs[i].endpoint);
    }
  }
  if (staleEndpoints.length) {
    await service.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent });
}
