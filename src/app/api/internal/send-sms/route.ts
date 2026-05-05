import { NextResponse, type NextRequest } from "next/server";
import { sendSmsTo, type SmsKind } from "@/lib/sms/send";

type RequestBody = {
  userId: string;
  kind: SmsKind;
  body: string;
  dedupKey: string;
};

const VALID_KINDS: SmsKind[] = ["reminder_2h", "decision"];

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

  const { userId, kind, body: smsBody, dedupKey } = body;

  if (!userId || !kind || !smsBody || !dedupKey) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  try {
    const result = await sendSmsTo({ userId, kind, body: smsBody, dedupKey });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[internal/send-sms] error", msg);
    return NextResponse.json({ error: "sms_failed" }, { status: 500 });
  }
}
