import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CulteInput = {
  id: string;
  libelle: string;
  jour_semaine: number;
  heure: string;
};

type ParsedTrajet = {
  culte_id?: string | null;
  heure_depart?: string;
  places_total?: number;
  sens?: "aller" | "retour" | "aller_retour";
  rayon_detour_km?: number;
  depart_address_text?: string;
  dates?: string[];
};

type ParseBody = {
  text?: unknown;
  cultes?: unknown;
};

const JOURS_FR = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

// Modèle Gemini : "pro-preview" pour précision (thinking model, plus lent/cher),
// "flash-lite-preview" pour rapidité/coût. Override via env GEMINI_MODEL si besoin.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-pro-preview";

function isCulteArray(value: unknown): value is CulteInput[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const c = item as Record<string, unknown>;
    return (
      typeof c.id === "string" &&
      typeof c.libelle === "string" &&
      typeof c.jour_semaine === "number" &&
      typeof c.heure === "string"
    );
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function sanitize(raw: unknown, validCulteIds: Set<string>): ParsedTrajet {
  if (typeof raw !== "object" || raw === null) return {};
  const obj = raw as Record<string, unknown>;
  const out: ParsedTrajet = {};

  if (typeof obj.culte_id === "string" && validCulteIds.has(obj.culte_id)) {
    out.culte_id = obj.culte_id;
  } else if (obj.culte_id === null) {
    out.culte_id = null;
  }

  if (typeof obj.heure_depart === "string" && isValidTime(obj.heure_depart)) {
    out.heure_depart = obj.heure_depart;
  }

  if (typeof obj.places_total === "number" && Number.isFinite(obj.places_total)) {
    out.places_total = clamp(Math.round(obj.places_total), 1, 8);
  }

  if (
    obj.sens === "aller" ||
    obj.sens === "retour" ||
    obj.sens === "aller_retour"
  ) {
    out.sens = obj.sens;
  }

  if (
    typeof obj.rayon_detour_km === "number" &&
    Number.isFinite(obj.rayon_detour_km)
  ) {
    out.rayon_detour_km = clamp(obj.rayon_detour_km, 0.5, 5);
  }

  if (
    typeof obj.depart_address_text === "string" &&
    obj.depart_address_text.trim().length > 0
  ) {
    out.depart_address_text = obj.depart_address_text.trim();
  }

  if (Array.isArray(obj.dates)) {
    const dates = obj.dates.filter(
      (d): d is string => typeof d === "string" && isValidDate(d),
    );
    if (dates.length > 0) out.dates = dates;
  }

  return out;
}

function buildSystemPrompt(today: Date, cultes: CulteInput[]): string {
  const todayIso = today.toISOString().slice(0, 10);
  const todayDay = JOURS_FR[today.getDay()];
  const cultesList = cultes
    .map(
      (c) =>
        `- id="${c.id}" libelle="${c.libelle}" jour=${JOURS_FR[c.jour_semaine]} heure=${c.heure.slice(0, 5)}`,
    )
    .join("\n");

  return `Tu es un assistant qui extrait des informations structurées depuis une description en français d'un trajet de covoiturage proposé par un conducteur d'église.

Date du jour : ${todayIso} (${todayDay}).

Programmes (cultes) disponibles :
${cultesList || "(aucun)"}

Tu dois répondre UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, sans bloc \`\`\`json. L'objet a les champs suivants (tous optionnels — n'inclus que ce qui est clairement présent dans le texte) :

- culte_id (string|null) : l'id du programme qui correspond le mieux à ce que dit l'utilisateur (en se basant sur le jour ou le libellé). null si aucun ne correspond clairement.
- heure_depart (string) : heure de départ au format "HH:MM" sur 24h. Ex : "8h30" -> "08:30", "vers midi" -> "12:00".
- places_total (number) : nombre de places, entre 1 et 8.
- sens ("aller" | "retour" | "aller_retour") : si non précisé, ne pas inclure.
- rayon_detour_km (number) : entre 0.5 et 5. Si non précisé, ne pas inclure.
- depart_address_text (string) : l'adresse de départ telle qu'écrite par l'utilisateur (ex : "Cocody Riviera 2"). Ne pas géocoder.
- dates (string[]) : tableau de dates ISO YYYY-MM-DD. Convertis "dimanche prochain", "le suivant", "ce dimanche", etc. en dates absolues à partir de la date du jour. Si l'utilisateur dit "dimanche prochain et le suivant", retourne deux dates.

Si une information n'est pas dans le texte, OMETS le champ. Ne devine pas.`;
}

type GeminiPart = { text?: string };
type GeminiCandidate = { content?: { parts?: GeminiPart[] } };
type GeminiResponse = { candidates?: GeminiCandidate[]; error?: { message?: string } };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }

  let body: ParseBody;
  try {
    body = (await req.json()) as ParseBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length === 0) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "text_too_long" }, { status: 400 });
  }

  const cultes = isCulteArray(body.cultes) ? body.cultes : [];
  const systemPrompt = buildSystemPrompt(new Date(), cultes);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as GeminiResponse | null;
      return NextResponse.json(
        { error: errBody?.error?.message ?? `gemini_${res.status}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!raw) {
      return NextResponse.json({ error: "empty_response" }, { status: 502 });
    }

    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(raw);
    } catch {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end <= start) {
        return NextResponse.json({ error: "invalid_ai_output" }, { status: 502 });
      }
      try {
        parsedRaw = JSON.parse(raw.slice(start, end + 1));
      } catch {
        return NextResponse.json({ error: "invalid_ai_output" }, { status: 502 });
      }
    }

    const validIds = new Set(cultes.map((c) => c.id));
    const parsed = sanitize(parsedRaw, validIds);
    return NextResponse.json({ parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
