import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSms, type SmsTon } from "@/lib/ai/generate-sms";

const VALID_TONS: SmsTon[] = ["info", "encouragement", "urgent"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "non_authentifie" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "non_admin" }, { status: 403 });
  }

  let body: { brief?: string; ton?: SmsTon; target_label?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const brief = body.brief?.trim();
  const ton = body.ton;
  const targetLabel = body.target_label?.trim();

  if (!brief || brief.length < 5) {
    return NextResponse.json({ error: "brief_trop_court" }, { status: 400 });
  }
  if (brief.length > 500) {
    return NextResponse.json({ error: "brief_trop_long" }, { status: 400 });
  }
  if (!ton || !VALID_TONS.includes(ton)) {
    return NextResponse.json({ error: "ton_invalide" }, { status: 400 });
  }
  if (!targetLabel) {
    return NextResponse.json({ error: "missing_target_label" }, { status: 400 });
  }

  try {
    const message = await generateSms({ brief, ton, targetLabel });
    return NextResponse.json({ message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[broadcast-sms/generate] error", msg);
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
