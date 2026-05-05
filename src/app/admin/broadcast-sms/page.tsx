import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BroadcastSmsForm } from "./broadcast-form";

export default async function BroadcastSmsPage() {
  const supabase = await createClient();
  const { data: cultes } = await supabase
    .from("cultes")
    .select("id, libelle")
    .order("libelle");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
          <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400" />
          Envoyer un SMS groupe
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Decris ce que tu veux communiquer, l&apos;IA propose un SMS court (≤160
          caracteres). Tu peux editer avant envoi. Brevo facture chaque SMS.
        </p>
      </div>

      <BroadcastSmsForm
        cultes={(cultes ?? []) as Array<{ id: string; libelle: string }>}
      />
    </div>
  );
}
