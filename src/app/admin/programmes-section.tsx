"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Power, Loader2, Save, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { confirmToast } from "@/lib/confirm";
import { formatProgramme } from "@/lib/dates";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import type { GeocodeResult } from "@/lib/mapbox";

const JOURS_LONG = [
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
  /** nullable depuis migration v42 — null pour les événements */
  jour_semaine: number | null;
  jours_semaine: number[];
  date_debut: string | null;
  date_fin: string | null;
  heure: string;
  actif: boolean;
  /** null → le trajet route vers l'église globale */
  destination_adresse: string | null;
  /** GeoJSON Point renvoyé par Supabase (geography) */
  destination_position: unknown;
};

type Mode = "recurrent" | "evenement";

/** Extrait { lng, lat } d'un Point GeoJSON renvoyé par une colonne geography. */
function parsePoint(raw: unknown): { lng: number; lat: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const coords = (raw as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coords)) return null;
  const [lng, lat] = coords;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  return { lng, lat };
}

/** Reconstruit un GeocodeResult depuis les colonnes destination d'un programme. */
function destinationToResult(p: Programme): GeocodeResult | null {
  const pt = parsePoint(p.destination_position);
  if (!p.destination_adresse || !pt) return null;
  return { id: p.id, address: p.destination_adresse, lat: pt.lat, lng: pt.lng };
}

/** Colonnes destination à écrire depuis un GeocodeResult (ou null si effacé). */
function destinationPayload(dest: GeocodeResult | null) {
  return {
    destination_adresse: dest ? dest.address : null,
    destination_position: dest ? `POINT(${dest.lng} ${dest.lat})` : null,
  };
}

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

// ─── Formulaire de création ───────────────────────────────────────────────────

function NewRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [mode, setMode] = useState<Mode>("recurrent");
  const [joursChecked, setJoursChecked] = useState<Set<number>>(new Set([0]));
  const [heure, setHeure] = useState("09:00");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [dest, setDest] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleJour(j: number) {
    setJoursChecked((prev) => {
      const next = new Set(prev);
      if (next.has(j)) next.delete(j);
      else next.add(j);
      return next;
    });
  }

  async function save() {
    if (!libelle.trim()) {
      toast.error("Donne un libellé");
      return;
    }
    if (mode === "recurrent" && joursChecked.size === 0) {
      toast.error("Coche au moins un jour");
      return;
    }
    if (mode === "evenement") {
      if (!dateDebut || !dateFin) {
        toast.error("Renseigne la date de début et de fin");
        return;
      }
      if (dateFin < dateDebut) {
        toast.error("La date de fin doit être après la date de début");
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();
    const jours = mode === "recurrent" ? [...joursChecked].sort((a, b) => a - b) : [];
    const payload =
      mode === "recurrent"
        ? {
            libelle: libelle.trim(),
            jours_semaine: jours,
            jour_semaine: jours[0] ?? null,
            date_debut: null,
            date_fin: null,
            heure,
            ...destinationPayload(dest),
          }
        : {
            libelle: libelle.trim(),
            jours_semaine: [] as number[],
            jour_semaine: null,
            date_debut: dateDebut,
            date_fin: dateFin,
            heure,
            ...destinationPayload(dest),
          };

    const { error } = await supabase.from("cultes").insert(payload as never);
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
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30 space-y-3">
      {/* Libellé */}
      <input
        type="text"
        autoFocus
        placeholder="Ex : Culte du dimanche matin"
        value={libelle}
        onChange={(e) => setLibelle(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
      />

      {/* Toggle mode */}
      <ModeToggle mode={mode} onChange={setMode} />

      {/* Champs selon le mode */}
      {mode === "recurrent" ? (
        <JoursCheckboxes selected={joursChecked} onChange={toggleJour} />
      ) : (
        <DateRangeInputs
          debut={dateDebut}
          fin={dateFin}
          onDebutChange={setDateDebut}
          onFinChange={setDateFin}
        />
      )}

      {/* Heure */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-600 dark:text-slate-400 shrink-0">Heure :</label>
        <input
          type="time"
          value={heure}
          onChange={(e) => setHeure(e.target.value)}
          step={300}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      {/* Destination */}
      <DestinationField value={dest} onChange={setDest} />

      {/* Actions */}
      <div className="flex justify-end gap-1">
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
  );
}

// ─── Ligne d'affichage / édition ─────────────────────────────────────────────

function Row({ programme }: { programme: Programme }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  // Déterminer le mode initial depuis les données
  const initialMode: Mode = programme.date_debut ? "evenement" : "recurrent";

  const [libelle, setLibelle] = useState(programme.libelle);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [joursChecked, setJoursChecked] = useState<Set<number>>(
    () => new Set(programme.jours_semaine.length > 0 ? programme.jours_semaine : programme.jour_semaine != null ? [programme.jour_semaine] : []),
  );
  const [heure, setHeure] = useState(programme.heure.slice(0, 5));
  const [dateDebut, setDateDebut] = useState(programme.date_debut ?? "");
  const [dateFin, setDateFin] = useState(programme.date_fin ?? "");
  const [dest, setDest] = useState<GeocodeResult | null>(() => destinationToResult(programme));
  const [loading, setLoading] = useState(false);

  function toggleJour(j: number) {
    setJoursChecked((prev) => {
      const next = new Set(prev);
      if (next.has(j)) next.delete(j);
      else next.add(j);
      return next;
    });
  }

  async function save() {
    if (mode === "recurrent" && joursChecked.size === 0) {
      toast.error("Coche au moins un jour");
      return;
    }
    if (mode === "evenement") {
      if (!dateDebut || !dateFin) {
        toast.error("Renseigne la date de début et de fin");
        return;
      }
      if (dateFin < dateDebut) {
        toast.error("La date de fin doit être après la date de début");
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();
    const jours = mode === "recurrent" ? [...joursChecked].sort((a, b) => a - b) : [];
    const payload =
      mode === "recurrent"
        ? {
            libelle: libelle.trim(),
            jours_semaine: jours,
            jour_semaine: jours[0] ?? null,
            date_debut: null,
            date_fin: null,
            heure,
            ...destinationPayload(dest),
          }
        : {
            libelle: libelle.trim(),
            jours_semaine: [] as number[],
            jour_semaine: null,
            date_debut: dateDebut,
            date_fin: dateFin,
            heure,
            ...destinationPayload(dest),
          };

    const { error } = await supabase
      .from("cultes")
      .update(payload as never)
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
      <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900 space-y-3">
        <input
          type="text"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
        />

        <ModeToggle mode={mode} onChange={setMode} />

        {mode === "recurrent" ? (
          <JoursCheckboxes selected={joursChecked} onChange={toggleJour} />
        ) : (
          <DateRangeInputs
            debut={dateDebut}
            fin={dateFin}
            onDebutChange={setDateDebut}
            onFinChange={setDateFin}
          />
        )}

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 dark:text-slate-400 shrink-0">Heure :</label>
          <input
            type="time"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
            step={300}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <DestinationField value={dest} onChange={setDest} />

        <div className="flex justify-end gap-1">
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
    );
  }

  const displayJour = formatProgramme({
    jours_semaine: programme.jours_semaine,
    date_debut: programme.date_debut,
    date_fin: programme.date_fin,
    jour_semaine: programme.jour_semaine,
  });

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
          {displayJour} · {programme.heure.slice(0, 5)}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">
            {programme.destination_adresse ?? "Église par défaut"}
          </span>
        </div>
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Modifier"
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <Pencil className="size-4" />
        </button>
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

// ─── Composants helpers ───────────────────────────────────────────────────────

function DestinationField({
  value,
  onChange,
}: {
  value: GeocodeResult | null;
  onChange: (r: GeocodeResult | null) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-slate-600 dark:text-slate-400">
        Destination{" "}
        <span className="text-slate-400 dark:text-slate-500">
          (optionnel — vide = église par défaut)
        </span>
      </label>
      <AddressAutocomplete
        value={value}
        onChange={onChange}
        placeholder="Adresse du lieu de ce programme"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Effacer la destination (revenir à l&apos;église)
        </button>
      )}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs dark:border-slate-700">
      <button
        type="button"
        onClick={() => onChange("recurrent")}
        className={`px-3 py-1.5 transition ${
          mode === "recurrent"
            ? "bg-slate-900 text-white dark:bg-emerald-600"
            : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        Récurrent
      </button>
      <button
        type="button"
        onClick={() => onChange("evenement")}
        className={`px-3 py-1.5 transition border-l border-slate-200 dark:border-slate-700 ${
          mode === "evenement"
            ? "bg-slate-900 text-white dark:bg-emerald-600"
            : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        Événement
      </button>
    </div>
  );
}

function JoursCheckboxes({
  selected,
  onChange,
}: {
  selected: Set<number>;
  onChange: (j: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {JOURS_LONG.map((j, i) => (
        <label
          key={j}
          className={`inline-flex items-center gap-1.5 cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition select-none ${
            selected.has(i)
              ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={selected.has(i)}
            onChange={() => onChange(i)}
          />
          {j}
        </label>
      ))}
    </div>
  );
}

function DateRangeInputs({
  debut,
  fin,
  onDebutChange,
  onFinChange,
}: {
  debut: string;
  fin: string;
  onDebutChange: (v: string) => void;
  onFinChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-600 dark:text-slate-400 shrink-0">Début :</label>
        <input
          type="date"
          value={debut}
          onChange={(e) => onDebutChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-600 dark:text-slate-400 shrink-0">Fin :</label>
        <input
          type="date"
          value={fin}
          min={debut}
          onChange={(e) => onFinChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>
    </div>
  );
}
