import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import {
  emailNouvelleReservation,
  emailReservationAcceptee,
  emailReservationRefusee,
  emailTrajetAnnuleParConducteur,
} from "@/lib/email/templates";
import { sendPushTo } from "@/lib/push";

type NotifyKind =
  | "reservation_created"
  | "reservation_accepted"
  | "reservation_refused"
  | "trajet_date_cancelled";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { kind: NotifyKind; reservationId: string };
  if (!body.reservationId || !body.kind) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: r, error } = await supabase
    .from("reservations")
    .select(
      `
      id, statut, sens, pickup_adresse, passager_id,
      passager:profiles!reservations_passager_id_fkey (
        prenom, nom
      ),
      trajets_instances!inner (
        date,
        trajets (
          conducteur_id,
          depart_adresse,
          cultes (libelle, jour_semaine, heure),
          conducteur:profiles!trajets_conducteur_id_fkey (
            prenom, nom, telephone, voiture_modele, voiture_couleur
          )
        )
      )
    `,
    )
    .eq("id", body.reservationId)
    .single();

  if (error || !r) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const trajet = (r.trajets_instances as unknown as {
    date: string;
    trajets: {
      conducteur_id: string;
      depart_adresse: string;
      cultes: { libelle: string; jour_semaine: number; heure: string } | null;
      conducteur: {
        prenom: string;
        nom: string;
        telephone: string;
        voiture_modele: string | null;
        voiture_couleur: string | null;
      } | null;
    } | null;
  }).trajets;

  const inst = r.trajets_instances as unknown as { date: string };
  const passager = r.passager as unknown as { prenom: string; nom: string } | null;
  const conducteur = trajet?.conducteur ?? null;
  const culte = trajet?.cultes ?? null;

  if (!trajet || !passager || !conducteur || !culte) {
    return NextResponse.json({ error: "incomplete_data" }, { status: 422 });
  }

  // Auth checks: only the relevant party can trigger their own notification
  const isPassager = user.id === r.passager_id;
  const isConducteur = user.id === trajet.conducteur_id;

  if (body.kind === "reservation_created" && !isPassager) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (
    (body.kind === "reservation_accepted" ||
      body.kind === "reservation_refused" ||
      body.kind === "trajet_date_cancelled") &&
    !isConducteur
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Get email of the recipient via auth.users via a server-side query
  const recipientId = body.kind === "reservation_created" ? trajet.conducteur_id : r.passager_id;
  const { data: recipientUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", recipientId)
    .single();
  if (!recipientUser) {
    return NextResponse.json({ error: "no_recipient" }, { status: 404 });
  }

  // Email is in auth.users, not profiles; we need service role OR we accept it via body
  // Workaround: fetch via admin endpoint requires service role key.
  // Pragmatic: use the auth.admin.getUserById with service role.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn("[notify] SUPABASE_SERVICE_ROLE_KEY manquant, email ignoré");
    return NextResponse.json({ skipped: true });
  }

  const adminRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${recipientId}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!adminRes.ok) {
    return NextResponse.json({ error: "no_email" }, { status: 500 });
  }
  const adminData = (await adminRes.json()) as { email?: string };
  if (!adminData.email) {
    return NextResponse.json({ error: "no_email" }, { status: 500 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin ?? "http://localhost:3201";

  const data = {
    passagerPrenom: passager.prenom,
    passagerNom: passager.nom,
    conducteurPrenom: conducteur.prenom,
    conducteurNom: conducteur.nom,
    conducteurTelephone: conducteur.telephone,
    voitureModele: conducteur.voiture_modele,
    voitureCouleur: conducteur.voiture_couleur,
    programmeLibelle: `${culte.libelle} (${JOURS[culte.jour_semaine]})`,
    date: formatDate(inst.date),
    heure: culte.heure.slice(0, 5),
    sens: r.sens,
    pickupAdresse: r.pickup_adresse,
    departAdresse: trajet.depart_adresse,
    appUrl,
  };

  let tpl;
  if (body.kind === "reservation_created") tpl = emailNouvelleReservation(data);
  else if (body.kind === "reservation_accepted") tpl = emailReservationAcceptee(data);
  else if (body.kind === "trajet_date_cancelled") tpl = emailTrajetAnnuleParConducteur(data);
  else tpl = emailReservationRefusee(data);

  const result = await sendEmail(adminData.email, tpl.subject, tpl.html);

  // Push notification (fire-and-forget — n'échoue pas la requête)
  const pushTitle =
    body.kind === "reservation_created"
      ? "Nouvelle réservation"
      : body.kind === "reservation_accepted"
        ? "Réservation acceptée"
        : body.kind === "reservation_refused"
          ? "Réservation refusée"
          : "Trajet annulé";
  const pushBody =
    body.kind === "reservation_created"
      ? `${data.passagerPrenom} ${data.passagerNom} — ${data.programmeLibelle} (${data.date})`
      : body.kind === "reservation_accepted"
        ? `${data.conducteurPrenom} ${data.conducteurNom} a accepté votre demande pour le ${data.date}`
        : body.kind === "reservation_refused"
          ? `${data.conducteurPrenom} ${data.conducteurNom} a refusé votre demande pour le ${data.date}`
          : `Le trajet du ${data.date} a été annulé par le conducteur`;

  const pushKind =
    body.kind === "reservation_created"
      ? "new_request" as const
      : body.kind === "reservation_accepted" || body.kind === "reservation_refused"
        ? "decision" as const
        : "trajet_cancelled" as const;

  void sendPushTo(recipientId, pushKind, {
    title: pushTitle,
    body: pushBody,
    url: `${appUrl}/dashboard`,
  }).catch((err) => {
    console.warn("[notify] push failed", err);
  });

  return NextResponse.json(result);
}
