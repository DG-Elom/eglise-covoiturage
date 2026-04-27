import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const googlePhoto =
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined);

    if (googlePhoto) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("photo_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && !profile.photo_url) {
        await supabase
          .from("profiles")
          .update({ photo_url: googlePhoto } as never)
          .eq("id", user.id);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
