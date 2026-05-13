import { createClient } from "@/lib/supabase/server";
import { BugsSection } from "../bugs-section";
import type { BugReportRow } from "../bugs-section";

export default async function AdminBugsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("prenom").eq("id", user.id).maybeSingle()
    : { data: null };

  const { data } = await supabase
    .from("bug_reports")
    .select(
      `id, description, categorie, page_url, user_agent, statut, note_admin, created_at,
      auteur:profiles!bug_reports_auteur_id_fkey (id, prenom, nom, photo_url, telephone)`,
    )
    .order("created_at", { ascending: false });

  const bugs = (data ?? []) as unknown as BugReportRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Bugs signalés</h1>
      <BugsSection bugs={bugs} myPrenom={me?.prenom ?? "l'admin"} />
    </div>
  );
}
