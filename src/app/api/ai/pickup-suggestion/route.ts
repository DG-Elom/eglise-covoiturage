import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { parseGeoPoint, buildPickupPrompt, type PassagerInfo } from "./_logic";

export const runtime = "nodejs";

interface PickupSuggestion {
  label: string;
  raison: string;
  lat: number;
  lng: number;
}

const PICKUP_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          raison: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
        },
        required: ["label", "raison", "lat", "lng"],
      },
    },
  },
  required: ["suggestions"],
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { trajetInstanceId } = body as { trajetInstanceId?: string };
  if (!trajetInstanceId || typeof trajetInstanceId !== "string") {
    return NextResponse.json({ error: "trajetInstanceId requis" }, { status: 400 });
  }

  // Récupère l'instance + trajet
  const { data: instance, error: instErr } = await supabase
    .from("trajets_instances")
    .select(`
      id,
      trajet:trajets!inner (
        conducteur_id,
        depart_adresse,
        depart_position
      )
    `)
    .eq("id", trajetInstanceId)
    .single();

  if (instErr || !instance) {
    return NextResponse.json({ error: "Instance introuvable" }, { status: 404 });
  }

  const trajet = instance.trajet as unknown as {
    conducteur_id: string;
    depart_adresse: string;
    depart_position: unknown;
  };

  // Vérifie que l'utilisateur est le conducteur
  if (trajet.conducteur_id !== user.id) {
    return NextResponse.json({ error: "Réservé au conducteur du trajet" }, { status: 403 });
  }

  const departPoint = parseGeoPoint(trajet.depart_position);
  if (!departPoint) {
    return NextResponse.json({ error: "Position de départ invalide" }, { status: 500 });
  }

  // Passagers accepted ou pending avec leur pickup_position
  const { data: reservations, error: resErr } = await supabase
    .from("reservations")
    .select("pickup_adresse, pickup_position")
    .eq("trajet_instance_id", trajetInstanceId)
    .in("statut", ["accepted", "pending"]);

  if (resErr) {
    return NextResponse.json({ error: "Erreur lors du chargement des réservations" }, { status: 500 });
  }

  const passagers: PassagerInfo[] = (reservations ?? [])
    .map((r) => {
      const pt = parseGeoPoint(r.pickup_position);
      if (!pt) return null;
      return { lat: pt.lat, lng: pt.lng, adresse: r.pickup_adresse };
    })
    .filter((x): x is PassagerInfo => x !== null);

  if (passagers.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // Récupère la position de l'église
  const { data: egliseData, error: egliseErr } = await supabase
    .from("eglise")
    .select("adresse, position")
    .limit(1)
    .maybeSingle();

  if (egliseErr || !egliseData) {
    return NextResponse.json({ error: "Position de l'église introuvable" }, { status: 500 });
  }

  const eglisePoint = parseGeoPoint(egliseData.position);
  if (!eglisePoint) {
    return NextResponse.json({ error: "Coordonnées de l'église invalides" }, { status: 500 });
  }

  const prompt = buildPickupPrompt(
    departPoint,
    trajet.depart_adresse,
    passagers,
    eglisePoint,
    egliseData.adresse,
  );

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: PICKUP_RESPONSE_SCHEMA,
      },
    });

    const rawText = result.text?.trim();
    if (!rawText) {
      return NextResponse.json({ error: "Réponse inattendue du modèle" }, { status: 500 });
    }

    let suggestions: PickupSuggestion[];
    try {
      const parsed = JSON.parse(rawText) as { suggestions: PickupSuggestion[] };
      suggestions = parsed.suggestions;
    } catch {
      return NextResponse.json({ error: "Réponse du modèle non parseable" }, { status: 500 });
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
