import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPushEnabled } from "@/lib/push";

type SubscribeBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function POST(req: NextRequest) {
  if (!isPushEnabled()) {
    return NextResponse.json({ error: "push_disabled" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? null;

  type PushSubInsert = {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent: string | null;
  };

  const row: PushSubInsert = {
    user_id: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    user_agent: userAgent,
  };

  const { error } = await (
    supabase.from("push_subscriptions" as never) as unknown as {
      upsert: (
        values: PushSubInsert,
        options?: { onConflict?: string },
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(row, { onConflict: "user_id,endpoint" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
