import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface InactiveConducteur {
  id: string;
  prenom: string;
  nom: string;
  charte_acceptee_at: string;
  days_since_signup: number;
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile?.is_admin) {
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  }

  const { data: conducteursRaw, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom, charte_acceptee_at")
    .in("role", ["conducteur", "les_deux"])
    .eq("suspended", false)
    .not("charte_acceptee_at", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidats = (conducteursRaw ?? []) as Array<{
    id: string;
    prenom: string;
    nom: string;
    charte_acceptee_at: string;
  }>;

  const now = Date.now();
  const list: InactiveConducteur[] = [];

  for (const p of candidats) {
    const { count } = await supabase
      .from("trajets")
      .select("*", { count: "exact", head: true })
      .eq("conducteur_id", p.id)
      .eq("actif", true);

    if ((count ?? 0) > 0) continue;

    const days_since_signup = Math.floor(
      (now - new Date(p.charte_acceptee_at).getTime()) / (24 * 3600 * 1000),
    );

    list.push({
      id: p.id,
      prenom: p.prenom,
      nom: p.nom,
      charte_acceptee_at: p.charte_acceptee_at,
      days_since_signup,
    });
  }

  list.sort((a, b) => b.days_since_signup - a.days_since_signup);

  return NextResponse.json({ count: list.length, list });
}
