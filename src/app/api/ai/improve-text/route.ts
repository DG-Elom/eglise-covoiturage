import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { validateImproveTextInput, buildImproveTextPrompt, type ImproveTextContext } from "./_logic";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "Tu es un assistant qui reformule des textes pour une app de covoiturage chrétien (église ICC Metz). " +
  "Garde un ton chaleureux, simple, et bref. Préserve le sens. " +
  "Réponds UNIQUEMENT avec le texte reformulé, sans préambule.";

// Rate limit léger : Map<userId, { count, resetAt }>
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = user.id;
  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans une minute." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = body as { text?: unknown; context?: unknown };
  const validation = validateImproveTextInput({ text: parsed.text, context: parsed.context });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const text = parsed.text as string;
  const context = parsed.context as ImproveTextContext;
  const userPrompt = buildImproveTextPrompt(text, context);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
    });

    const improved = result.text?.trim();
    if (!improved) {
      return NextResponse.json({ error: "Réponse inattendue du modèle" }, { status: 500 });
    }

    return NextResponse.json({ improved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
