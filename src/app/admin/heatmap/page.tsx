import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HeatmapClient } from "./heatmap-client";

export default async function HeatmapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h1 className="text-xl font-semibold text-white">Heatmap des demandes</h1>
        <p className="text-sm text-slate-400 mt-1">
          Zones géographiques où la demande de passagers dépasse l&apos;offre de conducteurs.
        </p>
      </div>
      <HeatmapClient />
    </div>
  );
}
