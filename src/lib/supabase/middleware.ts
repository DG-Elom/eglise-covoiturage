import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes("xxx")) {
    return response;
  }

  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const target = request.nextUrl.clone();
  const isAuthRoute =
    target.pathname.startsWith("/login") || target.pathname.startsWith("/auth");
  const isOnboarding = target.pathname.startsWith("/onboarding");
  const isPublicRoute =
    target.pathname === "/" ||
    isAuthRoute ||
    target.pathname.startsWith("/lancement") ||
    target.pathname.startsWith("/legal");

  if (!user && !isPublicRoute) {
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  if (user && isAuthRoute && target.pathname !== "/auth/callback") {
    target.pathname = "/dashboard";
    return NextResponse.redirect(target);
  }

  if (user && !isPublicRoute && !isOnboarding) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      target.pathname = "/onboarding";
      return NextResponse.redirect(target);
    }
  }

  return response;
}
