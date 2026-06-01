import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BroadcastSmsForm } from "./broadcast-form";

export default async function BroadcastSmsPage() {
  const supabase = await createClient();
  // Défense en profondeur : le layout /admin protège déjà, on revérifie ici
  // (page qui charge des données et déclenche des envois facturés).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: cultes } = await supabase
    .from("cultes")
    .select("id, libelle")
    .order("libelle");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
          <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400" />
          Envoyer un SMS
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Choisis qui tu veux — une personne, plusieurs, ou un groupe entier — puis
          écris (ou laisse l&apos;IA proposer) un SMS court. {"{prénom}"} personnalise
          chaque message. Brevo facture chaque SMS.
        </p>
      </div>

      <BroadcastSmsForm
        cultes={(cultes ?? []) as Array<{ id: string; libelle: string }>}
      />
    </div>
  );
}
