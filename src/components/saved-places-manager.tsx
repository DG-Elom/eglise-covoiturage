"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type SavedPlace = Database["public"]["Tables"]["saved_places"]["Row"];

const ICON_OPTIONS = [
  { value: "home", emoji: "🏠", label: "Maison" },
  { value: "work", emoji: "💼", label: "Travail" },
  { value: "church", emoji: "⛪", label: "Église" },
  { value: "pin", emoji: "📍", label: "Épingle" },
  { value: "school", emoji: "🎓", label: "École" },
  { value: "heart", emoji: "❤️", label: "Favori" },
] as const;

export type IconValue = (typeof ICON_OPTIONS)[number]["value"];

export function iconEmoji(icon: string | null): string {
  return ICON_OPTIONS.find((o) => o.value === icon)?.emoji ?? "📍";
}

type Props = {
  userId: string;
  onClose: () => void;
};

type FormState = {
  label: string;
  icon: IconValue;
};

export function SavedPlacesManager({ userId, onClose }: Props) {
  const supabase = createClient();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ label: "", icon: "pin" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchPlaces() {
    const { data, error } = await supabase
      .from("saved_places")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPlaces(data ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetchPlaces().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(place: SavedPlace) {
    setEditingId(place.id);
    setForm({
      label: place.label,
      icon: (ICON_OPTIONS.find((o) => o.value === place.icon)?.value ?? "pin") as IconValue,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ label: "", icon: "pin" });
  }

  async function saveEdit() {
    if (!editingId) return;
    const trimmed = form.label.trim();
    if (!trimmed) {
      toast.error("Le libellé est requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("saved_places")
      .update({ label: trimmed, icon: form.icon })
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === editingId ? { ...p, label: trimmed, icon: form.icon } : p,
      ),
    );
    cancelEdit();
    toast.success("Lieu mis à jour");
  }

  async function deletePlace(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("saved_places").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPlaces((prev) => prev.filter((p) => p.id !== id));
    toast.success("Lieu supprimé");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Mes lieux favoris
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-slate-400" />
            </div>
          ) : places.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-6">
              Aucun lieu enregistré.
            </p>
          ) : (
            places.map((place) =>
              editingId === place.id ? (
                <div
                  key={place.id}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30 p-3 space-y-2"
                >
                  <div className="flex gap-2 flex-wrap">
                    {ICON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, icon: opt.value }))}
                        title={opt.label}
                        className={`text-lg rounded-md px-2 py-1 transition ${
                          form.icon === opt.value
                            ? "bg-emerald-200 dark:bg-emerald-700"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {opt.emoji}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Libellé"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      {saving && <Loader2 className="size-3 animate-spin" />}
                      Sauvegarder
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={place.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 bg-white dark:bg-slate-800/40"
                >
                  <span className="text-lg shrink-0">{iconEmoji(place.icon)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {place.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{place.adresse}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(place)}
                    title="Modifier le libellé"
                    className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition dark:hover:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePlace(place.id)}
                    disabled={deletingId === place.id}
                    title="Supprimer"
                    className="rounded-md p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50 dark:hover:text-red-400 dark:hover:bg-red-950/40"
                  >
                    {deletingId === place.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                </div>
              ),
            )
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-3">
          <p className="text-xs text-slate-500 text-center">
            {places.length}/8 lieux enregistrés
          </p>
        </div>
      </div>
    </div>
  );
}

type AddPlaceModalProps = {
  adresse: string;
  lat: number;
  lng: number;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AddSavedPlaceModal({
  adresse,
  lat,
  lng,
  userId,
  onClose,
  onSaved,
}: AddPlaceModalProps) {
  const supabase = createClient();
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<IconValue>("pin");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error("Le libellé est requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("saved_places").insert({
      user_id: userId,
      label: trimmed,
      icon,
      adresse,
      position: `POINT(${lng} ${lat})`,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lieu enregistré");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Ajouter un lieu favori
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500 truncate">{adresse}</p>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Icône
            </label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(opt.value)}
                  title={opt.label}
                  className={`text-lg rounded-md px-2 py-1 transition ${
                    icon === opt.value
                      ? "bg-emerald-200 dark:bg-emerald-700"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Libellé
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Maison, Travail…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") onClose();
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-3 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !label.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {saving && <Loader2 className="size-3 animate-spin" />}
            <Plus className="size-3" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
