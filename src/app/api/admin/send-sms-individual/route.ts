import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendSmsTo } from "@/lib/sms/send";

const MAX_MESSAGE_CHARS = 320;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { user_id?: string; message?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const userId = body.user_id?.trim();
  const message = body.message?.trim();
  if (!userId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "missing_message" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: "message_trop_long", max: MAX_MESSAGE_CHARS },
      { status: 400 },
    );
  }

  // Verifie que le destinataire existe (et donne un message clair sinon)
  const { data: target } = await supabase
    .from("profiles")
    .select("id, prenom, nom")
    .eq("id", userId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // dedup_key unique pour ce tir (admin peut envoyer plusieurs SMS au meme user)
  const dedupKey = `admin_individual:${user.id}:${userId}:${Date.now()}`;

  const result = await sendSmsTo({
    userId,
    kind: "admin_broadcast",
    body: message,
    dedupKey,
  });

  if ("ok" in result) {
    return NextResponse.json({ ok: true, messageId: result.messageId });
  }
  if ("skipped" in result) {
    return NextResponse.json(
      { error: "skipped", reason: result.reason },
      { status: 422 },
    );
  }
  console.error("[admin/send-sms-individual] send failed", {
    target_id: userId,
    admin_id: user.id,
    error: result.error,
  });
  return NextResponse.json({ error: result.error }, { status: 500 });
}
