import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolveRecipients,
  targetLabelFor,
  type TargetFilter,
} from "@/lib/sms/targets";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "non_authentifie" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return { ok: false as const, status: 403, message: "non_admin" };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: { filter?: TargetFilter };
  try {
    body = (await req.json()) as { filter?: TargetFilter };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.filter?.type) {
    return NextResponse.json({ error: "missing_filter" }, { status: 400 });
  }

  try {
    const recipients = await resolveRecipients(body.filter);
    return NextResponse.json({
      count: recipients.length,
      target_label: targetLabelFor(body.filter),
      sample: recipients.slice(0, 5).map((r) => ({
        id: r.id,
        prenom: r.prenom,
        nom: r.nom,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[broadcast-sms/recipients] error", msg);
    return NextResponse.json({ error: "resolve_failed" }, { status: 500 });
  }
}
