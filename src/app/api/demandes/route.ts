import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  culte_id?: string;
  date?: string;
  sens?: "aller" | "retour";
  pickup_adresse?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  notes?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const {
    culte_id,
    date,
    sens,
    pickup_adresse,
    pickup_lat,
    pickup_lng,
    notes,
  } = body;

  if (
    !culte_id ||
    !date ||
    !sens ||
    !pickup_adresse ||
    typeof pickup_lat !== "number" ||
    typeof pickup_lng !== "number"
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("demandes_passager")
    .insert({
      passager_id: user.id,
      culte_id,
      date,
      sens,
      pickup_adresse,
      pickup_position: `POINT(${pickup_lng} ${pickup_lat})`,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  // Fire-and-forget notification aux conducteurs proches
  void notifyConducteurs(data.id).catch((e) =>
    console.warn("[demandes] notify failed", e),
  );

  return NextResponse.json({ id: data.id });
}

async function notifyConducteurs(demandeId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const admin = createAdmin(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: demande } = await admin
    .from("demandes_passager")
    .select(
      `id, culte_id, date, sens, pickup_adresse,
       culte:cultes (libelle, heure),
       passager:profiles!demandes_passager_passager_id_fkey (prenom, nom)`,
    )
    .eq("id", demandeId)
    .single();
  if (!demande) return;

  const culte = Array.isArray(demande.culte) ? demande.culte[0] : demande.culte;
  const passager = Array.isArray(demande.passager)
    ? demande.passager[0]
    : demande.passager;
  if (!culte || !passager) return;

  // Ne notifier que les conducteurs avec un trajet actif non plein pour ce culte+date+sens.
  // Limite connue : pas de filtrage géographique (rayon_detour_km non vérifié ici).
  const { filterConducteursByTrajetActif } = await import("./_notify-logic");
  const { data: trajetsActifs } = await admin
    .from("trajets_instances")
    .select(
      `trajets!inner ( conducteur_id, culte_id, actif, sens, places_total ),
       reservations ( statut )`,
    )
    .eq("date", demande.date)
    .eq("trajets.culte_id", demande.culte_id)
    .eq("trajets.actif", true)
    .in("trajets.sens", [demande.sens, "aller_retour"]);

  type TrajetInstanceRow = {
    trajets: {
      conducteur_id: string;
      culte_id: string;
      actif: boolean;
      sens: string;
      places_total: number;
    };
    reservations: Array<{ statut: string }>;
  };

  const trajetsAvecPlaces = ((trajetsActifs ?? []) as unknown as TrajetInstanceRow[]).map(
    (ti) => {
      const occupees = ti.reservations.filter(
        (r) => r.statut === "accepted" || r.statut === "pending",
      ).length;
      return {
        conducteur_id: ti.trajets.conducteur_id,
        culte_id: ti.trajets.culte_id,
        places_restantes: Math.max(0, ti.trajets.places_total - occupees),
      };
    },
  );

  const conducteurIds = filterConducteursByTrajetActif(trajetsAvecPlaces, demande.culte_id);
  if (conducteurIds.length === 0) return;

  const dateFr = new Date(`${demande.date}T12:00:00`).toLocaleDateString(
    "fr-FR",
    { weekday: "long", day: "numeric", month: "long" },
  );
  const sens = demande.sens === "aller" ? "aller" : "retour";
  const title = `Nouvelle demande de trajet`;
  const body = `${passager.prenom} cherche un ${sens} pour ${culte.libelle} (${dateFr}) depuis ${demande.pickup_adresse}.`;

  const { sendPushTo } = await import("@/lib/push");
  await Promise.all(
    conducteurIds.map((id) =>
      sendPushTo(id, "new_request", { title, body, url: "/dashboard" }).catch(() => {}),
    ),
  );
}
