import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.ASANA_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "ASANA_CLIENT_ID not set" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/asana`;

  const url = new URL("https://app.asana.com/-/oauth_authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "default");

  return NextResponse.redirect(url.toString());
}
