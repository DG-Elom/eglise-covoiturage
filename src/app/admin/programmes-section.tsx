"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Power, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { confirmToast } from "@/lib/confirm";

const JOURS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

type Programme = {
  id: string;
  libelle: string;
  jour_semaine: number;
  heure: string;
  actif: boolean;
};

export function ProgrammesSection({ programmes }: { programmes: Programme[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700 uppercase tracking-wide dark:text-slate-300">
          Programmes
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition dark:hover:bg-emerald-500"
          >
            <Plus className="size-3.5" />
            Nouveau
          </button>
        )}
      </div>

      <div className="space-y-2">
        {adding && <NewRow onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />}
        {programmes.map((p) => (
          <Row key={p.id} programme={p} />
        ))}
        {programmes.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Aucun programme. Clique sur &laquo; Nouveau &raquo;.
          </p>
        )}
      </div>
    </section>
  );
}

function NewRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [jour, setJour] = useState(0);
  const [heure, setHeure] = useState("09:00");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!libelle.trim()) {
      toast.error("Donne un libellé");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("cultes").insert({
      libelle: libelle.trim(),
      jour_semaine: jour,
      heure,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Programme créé");
    onSaved();
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="grid gap-2 sm:grid-cols-[1fr,auto,auto,auto]">
        <input
          type="text"
          autoFocus
          placeholder="Ex : Culte du dimanche matin"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
        />
        <select
          value={jour}
          onChange={(e) => setJour(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          {JOURS.map((j, i) => (
            <option key={j} value={i}>
              {j}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={heure}
          onChange={(e) => setHeure(e.target.value)}
          step={300}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition dark:hover:bg-emerald-500"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ programme }: { programme: Programme }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [libelle, setLibelle] = useState(programme.libelle);
  const [jour, setJour] = useState(programme.jour_semaine);
  const [heure, setHeure] = useState(programme.heure.slice(0, 5));
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cultes")
      .update({ libelle: libelle.trim(), jour_semaine: jour, heure } as never)
      .eq("id", programme.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Modifié");
    setEditing(false);
    router.refresh();
  }

  async function toggleActif() {
    const supabase = createClient();
    const { error } = await supabase
      .from("cultes")
      .update({ actif: !programme.actif } as never)
      .eq("id", programme.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(programme.actif ? "Désactivé" : "Activé");
    router.refresh();
  }

  async function remove() {
    const supabase = createClient();
    const { count } = await supabase
      .from("trajets")
      .select("*", { count: "exact", head: true })
      .eq("culte_id", programme.id);

    if ((count ?? 0) > 0) {
      toast.error(
        `Impossible : ${count} trajet(s) utilisent ce programme. Désactive-le plutôt (bouton power).`,
      );
      return;
    }

    const ok = await confirmToast("Supprimer définitivement ce programme ?", {
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;

    const { error } = await supabase.from("cultes").delete().eq("id", programme.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Supprimé");
    router.refresh();
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
        <div className="grid gap-2 sm:grid-cols-[1fr,auto,auto,auto]">
          <input
            type="text"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
          />
          <select
            value={jour}
            onChange={(e) => setJour(Number(e.target.value))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {JOURS.map((j, i) => (
              <option key={j} value={i}>
                {j}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
            step={300}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border bg-white p-3 dark:bg-slate-900 ${
        programme.actif
          ? "border-slate-200 dark:border-slate-700"
          : "border-slate-200 opacity-60 dark:border-slate-700"
      }`}
    >
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="font-medium">{programme.libelle}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {JOURS[programme.jour_semaine]} · {programme.heure.slice(0, 5)}
        </div>
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleActif}
          title={programme.actif ? "Désactiver" : "Activer"}
          className={`inline-flex size-7 items-center justify-center rounded-md transition ${
            programme.actif
              ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              : "text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-800"
          }`}
        >
          <Power className="size-4" />
        </button>
        <button
          type="button"
          onClick={remove}
          title="Supprimer"
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
