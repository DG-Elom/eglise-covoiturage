import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CarteClient } from "./carte-client";

export default async function CartePage() {
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Carte offre / demande</h1>
        <p className="mt-1 text-sm text-slate-400">
          Où des passagers attendent un trajet, et quels conducteurs peuvent les
          emmener. Les passagers <span className="text-red-400">en rouge</span> n&apos;ont
          aucun conducteur sur leur culte — à mettre en relation en priorité.
        </p>
      </div>
      <CarteClient />
    </div>
  );
}
