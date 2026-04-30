import { NextResponse, type NextRequest } from "next/server";
import { sendPushTo, type NotifKind, type PushPayload } from "@/lib/push";

type RequestBody = {
  userId: string;
  kind: NotifKind;
  payload: PushPayload;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.INTERNAL_PUSH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "internal_secret_not_configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("x-internal-secret");
  if (!authHeader || authHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { userId, kind, payload } = body;

  if (!userId || !kind || !payload?.title || !payload?.body) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const validKinds: NotifKind[] = [
    "reminder_2h",
    "imminent_departure",
    "new_request",
    "decision",
    "trajet_cancelled",
    "new_message",
    "thanks_received",
    "weekly_summary_admin",
  ];
  if (!validKinds.includes(kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  try {
    await sendPushTo(userId, kind, payload);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[internal/send-push] error", msg);
    return NextResponse.json({ error: "push_failed" }, { status: 500 });
  }
}
