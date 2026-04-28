"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Save, Loader2 } from "lucide-react";

type Props = {
  egliseId: string;
  initialNom: string;
  initialAdresse: string;
};

export function EgliseForm({ egliseId, initialNom, initialAdresse }: Props) {
  const [nom, setNom] = useState(initialNom);
  const [adresse, setAdresse] = useState(initialAdresse);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (!adresse.trim()) {
      toast.error("L'adresse est requise");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("eglise")
      .update({ nom: nom.trim(), adresse: adresse.trim() } as never)
      .eq("id", egliseId);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Informations enregistrées");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="space-y-1">
        <label
          htmlFor="eglise-nom"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Nom
        </label>
        <input
          id="eglise-nom"
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
          placeholder="Nom de l'église"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="eglise-adresse"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Adresse
        </label>
        <input
          id="eglise-adresse"
          type="text"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
          placeholder="Adresse complète"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition dark:hover:bg-emerald-500"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Enregistrer
      </button>
    </form>
  );
}
