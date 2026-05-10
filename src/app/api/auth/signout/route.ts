import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL!));

  // Explicitly delete all Supabase auth cookies so the browser cannot
  // restore a cached authenticated page via the back button.
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  }

  return response;
}
