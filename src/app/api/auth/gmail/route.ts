import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID not set" }, { status: 500 });

  const state = crypto.randomUUID();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/gmail`;
  const scope = "https://www.googleapis.com/auth/gmail.readonly";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  const cookieStore = await cookies();
  cookieStore.set("oauth_state_gmail", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });

  return NextResponse.redirect(url.toString());
}
