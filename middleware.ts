import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/gmail",
  "/auth/drive",
  "/auth/asana",
  "/join",
  "/api/auth/",
  "/api/webhooks/",
  "/api/cron/",
  "/api/workspace/context/build",
];

const ASANA_PICKER_PATH = "/settings/asana-picker";

function isAsanaFunnelExempt(path: string): boolean {
  return (
    path.startsWith("/settings/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/api/") ||
    path.startsWith("/_next") ||
    path === "/login" ||
    path === "/join" ||
    path === "/privacy" ||
    path === "/favicon.ico"
  );
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    PUBLIC_PATHS.some((p) => path.startsWith(p)) ||
    path.startsWith("/_next") ||
    path.startsWith("/api/waitlist");

  if (!user && !isPublic) {
    // API routes get 401, not a redirect - redirecting a POST to /login causes 405
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Asana defaults funnel: once Asana is connected, push the user to the picker
  // on their next main-app page view until they save their defaults.
  if (user && !isAsanaFunnelExempt(path) && path !== ASANA_PICKER_PATH) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (serviceKey && supabaseUrl) {
      try {
        const service = createSupabaseClient(supabaseUrl, serviceKey);
        const { data: member } = await service
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .order("joined_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (member?.workspace_id) {
          const { data: asanaToken } = await service
            .from("oauth_tokens")
            .select("provider")
            .eq("workspace_id", member.workspace_id)
            .eq("user_id", user.id)
            .eq("provider", "asana")
            .maybeSingle();

          if (asanaToken) {
            const { data: settings } = await service
              .from("workspace_settings")
              .select("asana_team_gid")
              .eq("workspace_id", member.workspace_id)
              .maybeSingle();

            if (!settings || !settings.asana_team_gid) {
              const url = request.nextUrl.clone();
              url.pathname = ASANA_PICKER_PATH;
              return NextResponse.redirect(url);
            }
          }
        }
      } catch {
        // Best-effort funnel: never block the request if the lookup fails.
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
