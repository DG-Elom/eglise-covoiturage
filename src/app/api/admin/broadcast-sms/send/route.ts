import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendSmsTo } from "@/lib/sms/send";
import {
  resolveRecipients,
  targetLabelFor,
  type TargetFilter,
} from "@/lib/sms/targets";
import type { Database } from "@/lib/supabase/types";

const MAX_RECIPIENTS = 200;
const MAX_MESSAGE_CHARS = 320;

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

  let body: {
    filter?: TargetFilter;
    message?: string;
    prompt_admin?: string;
    ton?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = body.message?.trim();
  const filter = body.filter;
  if (!filter?.type) {
    return NextResponse.json({ error: "missing_filter" }, { status: 400 });
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

  let recipients;
  try {
    recipients = await resolveRecipients(filter);
  } catch (e) {
    console.error("[broadcast-sms/send] resolve failed", e);
    return NextResponse.json({ error: "resolve_failed" }, { status: 500 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "aucun_destinataire" }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      {
        error: "trop_de_destinataires",
        count: recipients.length,
        max: MAX_RECIPIENTS,
      },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 500 });
  }
  const admin = createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: campaign, error: insertErr } = await admin
    .from("sms_campaigns")
    .insert({
      auteur_id: user.id,
      target_filter: JSON.stringify(filter),
      target_label: targetLabelFor(filter),
      prompt_admin: body.prompt_admin ?? null,
      ton: body.ton ?? null,
      message,
      n_destinataires: recipients.length,
    } as never)
    .select("id")
    .single();

  if (insertErr || !campaign) {
    console.error("[broadcast-sms/send] insert failed", insertErr);
    return NextResponse.json({ error: "campaign_insert_failed" }, { status: 500 });
  }

  const campaignId = (campaign as { id: string }).id;

  const results = await Promise.all(
    recipients.map((r) =>
      sendSmsTo({
        userId: r.id,
        kind: "admin_broadcast",
        body: message,
        dedupKey: `admin_broadcast:${campaignId}:${r.id}`,
      }).catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
    ),
  );

  let nEnvoyes = 0;
  let nSkipped = 0;
  for (const r of results) {
    if ("ok" in r) nEnvoyes++;
    else nSkipped++;
  }

  await admin
    .from("sms_campaigns")
    .update({ n_envoyes: nEnvoyes, n_skipped: nSkipped } as never)
    .eq("id", campaignId);

  return NextResponse.json({
    campaign_id: campaignId,
    n_destinataires: recipients.length,
    n_envoyes: nEnvoyes,
    n_skipped: nSkipped,
  });
}
