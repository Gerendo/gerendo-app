import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.ASANA_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "ASANA_CLIENT_ID not set" }, { status: 500 });

  const state = crypto.randomUUID();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/asana`;

  const url = new URL("https://app.asana.com/-/oauth_authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "default");
  url.searchParams.set("state", state);

  const cookieStore = await cookies();
  cookieStore.set("oauth_state_asana", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });

  return NextResponse.redirect(url.toString());
}
