import { NextResponse } from "next/server";

// Redirects user to Google OAuth for Drive access
export async function GET(): Promise<NextResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID not set" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/drive`;
  const scope = "https://www.googleapis.com/auth/drive.readonly";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return NextResponse.redirect(url.toString());
}
