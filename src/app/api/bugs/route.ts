import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { emailNouveauBugReport } from "@/lib/email/templates";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const CATEGORIES = new Set([
  "crash",
  "affichage",
  "fonctionnalite",
  "performance",
  "autre",
]);

type Body = {
  description?: string;
  categorie?: string;
  page_url?: string;
  user_agent?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const description = body.description?.trim();
  const categorie = body.categorie ?? "autre";

  if (!description || description.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!CATEGORIES.has(categorie)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bug_reports")
    .insert({
      auteur_id: user.id,
      description,
      categorie: categorie as "crash" | "affichage" | "fonctionnalite" | "performance" | "autre",
      page_url: body.page_url ?? null,
      user_agent: body.user_agent ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[bugs] insert failed:", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("id", user.id)
    .maybeSingle();

  const bugEmail = process.env.BUG_REPORT_EMAIL;
  if (bugEmail && profile) {
    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const { subject, html } = emailNouveauBugReport({
      auteurPrenom: profile.prenom,
      auteurNom: profile.nom,
      categorie,
      description,
      pageUrl: body.page_url ?? null,
      date: format(new Date(), "dd MMMM yyyy · HH:mm", { locale: fr }),
      appUrl,
    });
    void sendEmail(bugEmail, subject, html).catch((err) => {
      console.warn("[bugs] email notification failed:", err);
    });
  } else if (!bugEmail) {
    console.warn("[bugs] BUG_REPORT_EMAIL non configuré, notification ignorée");
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
