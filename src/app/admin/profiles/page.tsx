import { createClient } from "@/lib/supabase/server";
import { ProfilesTable } from "./profiles-table";

export default async function AdminProfilesPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, prenom, nom, telephone, role, photo_url, is_admin, suspended, suspended_reason, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Profils
      </h1>
      <ProfilesTable profiles={profiles ?? []} />
    </div>
  );
}
