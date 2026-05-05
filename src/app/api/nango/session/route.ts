import { NextResponse } from "next/server";
import { Nango } from "@nangohq/node";

const GMAIL_CONNECTION_ID = "gerendo-gmail";

export async function POST(): Promise<NextResponse> {
  const secretKey = process.env.NANGO_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "NANGO_SECRET_KEY not set" }, { status: 500 });
  }

  const nango = new Nango({ secretKey });

  try {
    const session = await nango.createConnectSession({
      end_user: { id: "local-user", display_name: "Local User" },
      allowed_integrations: ["google-mail"],
    });

    return NextResponse.json({ token: session.data.token });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create connect session", details: String(err) }, { status: 500 });
  }
}
