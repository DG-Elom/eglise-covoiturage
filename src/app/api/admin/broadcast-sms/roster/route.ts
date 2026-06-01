import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export type RosterMember = {
  id: string;
  prenom: string;
  nom: string;
  role: string;
  has_phone: boolean;
};

/**
 * Annuaire des membres actifs pour le sélecteur de destinataires SMS.
 * Admin only (lecture via RLS is_admin() sur profiles). Ne renvoie pas le
 * numéro brut, seulement sa présence — l'envoi vérifie le téléphone côté
 * service.
 */
export async function GET(): Promise<NextResponse> {
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

  const { data, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom, role, telephone")
    .eq("suspended", false)
    .not("charte_acceptee_at", "is", null)
    .order("prenom");

  if (error) {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }

  const members: RosterMember[] = (
    (data ?? []) as Array<{
      id: string;
      prenom: string;
      nom: string;
      role: string;
      telephone: string | null;
    }>
  ).map((p) => ({
    id: p.id,
    prenom: p.prenom,
    nom: p.nom,
    role: p.role,
    has_phone: !!p.telephone && p.telephone.trim().length > 0,
  }));

  return NextResponse.json({ members });
}
