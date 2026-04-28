"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AvatarUpload } from "@/components/avatar-upload";
import { confirmToast } from "@/lib/confirm";
import { AddSavedPlaceModal, SavedPlacesManager, iconEmoji } from "@/components/saved-places-manager";
import { geocodeAddress } from "@/lib/mapbox";
import type { Database } from "@/lib/supabase/types";

type SavedPlace = Database["public"]["Tables"]["saved_places"]["Row"];

type Role = "passager" | "conducteur" | "les_deux";

type Profile = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  role: Role;
  voiture_modele: string | null;
  voiture_couleur: string | null;
  voiture_plaque: string | null;
  photo_url: string | null;
};

export function ProfilForm({ profile, email }: { profile: Profile; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [role, setRole] = useState<Role>(profile.role);
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photo_url);
  const isConducteur = role === "conducteur" || role === "les_deux";

  async function deleteAccount() {
    const ok = await confirmToast(
      "Supprimer définitivement ton compte ? Toutes tes données (trajets, réservations, messages) seront effacées.",
      { confirmLabel: "Supprimer", destructive: true },
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Échec de la suppression");
        setDeleting(false);
        return;
      }
      toast.success("Compte supprimé. À bientôt.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
      setDeleting(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        prenom: String(fd.get("prenom") || "").trim(),
        nom: String(fd.get("nom") || "").trim(),
        telephone: String(fd.get("telephone") || "").trim(),
        role,
        photo_url: photoUrl,
        voiture_modele: isConducteur
          ? String(fd.get("voiture_modele") || "").trim() || null
          : null,
        voiture_couleur: isConducteur
          ? String(fd.get("voiture_couleur") || "").trim() || null
          : null,
        voiture_plaque: isConducteur
          ? String(fd.get("voiture_plaque") || "").trim() || null
          : null,
      } as never)
      .eq("id", profile.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil mis à jour");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-700 dark:bg-slate-900">
        <AvatarUpload
          userId={profile.id}
          prenom={profile.prenom}
          nom={profile.nom}
          value={photoUrl}
          onChange={setPhotoUrl}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prénom" name="prenom" defaultValue={profile.prenom} required />
          <Field label="Nom" name="nom" defaultValue={profile.nom} required />
        </div>
        <Field label="Email" name="email" defaultValue={email} disabled />
        <Field
          label="Téléphone"
          name="telephone"
          type="tel"
          defaultValue={profile.telephone}
          required
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-700 dark:bg-slate-900">
        <label className="text-sm font-medium">Rôle</label>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["passager", "conducteur", "les_deux"] as const).map((r) => (
            <label
              key={r}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                role === r
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
              }`}
            >
              <input
                type="radio"
                name="role"
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              {r === "passager" && "Passager"}
              {r === "conducteur" && "Conducteur"}
              {r === "les_deux" && "Les deux"}
            </label>
          ))}
        </div>

        {isConducteur && (
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            <Field
              label="Modèle voiture"
              name="voiture_modele"
              defaultValue={profile.voiture_modele ?? ""}
              placeholder="Toyota Corolla"
            />
            <Field
              label="Couleur"
              name="voiture_couleur"
              defaultValue={profile.voiture_couleur ?? ""}
              placeholder="Blanc"
            />
            <Field
              label="Plaque"
              name="voiture_plaque"
              defaultValue={profile.voiture_plaque ?? ""}
              placeholder="AA-123-BB"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Enregistrer
      </button>

      <SavedPlacesSection userId={profile.id} />

      <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 dark:border-red-900/50 dark:bg-red-950/20">
        <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">
          Zone de danger
        </h2>
        <p className="mt-1 text-xs text-red-800/80 dark:text-red-300/80">
          Supprimer ton compte effacera définitivement ton profil, tes trajets
          et tes réservations. Cette action est irréversible.
        </p>
        <button
          type="button"
          onClick={deleteAccount}
          disabled={deleting}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
          Supprimer mon compte
        </button>
      </div>
    </form>
  );
}

const MAX_PLACES = 8;

function SavedPlacesSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerOpen, setManagerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newAdresse, setNewAdresse] = useState("");
  const [searching, setSearching] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("saved_places")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setPlaces(data ?? []);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, version]);

  const [pendingGeocode, setPendingGeocode] = useState<{
    adresse: string;
    lat: number;
    lng: number;
  } | null>(null);

  async function handleAdd() {
    const q = newAdresse.trim();
    if (!q) {
      toast.error("Saisis une adresse");
      return;
    }
    setSearching(true);
    const results = await geocodeAddress(q).catch(() => []);
    setSearching(false);
    if (results.length === 0) {
      toast.error("Adresse introuvable. Essaie une formulation plus précise.");
      return;
    }
    setPendingGeocode({
      adresse: results[0].address,
      lat: results[0].lat,
      lng: results[0].lng,
    });
    setNewAdresse("");
    setAddOpen(true);
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Mes lieux favoris
          </h2>
          <button
            type="button"
            onClick={() => {
              setManagerOpen(true);
            }}
            className="text-xs text-slate-500 hover:text-slate-700 transition dark:hover:text-slate-300"
          >
            Gérer
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {places.length === 0 ? (
              <p className="text-xs text-slate-500">
                Aucun lieu enregistré. Ajoute tes adresses fréquentes pour les retrouver rapidement.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {places.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="text-base">{iconEmoji(p.icon)}</span>
                    <span className="font-medium">{p.label}</span>
                    <span className="truncate text-xs text-slate-400">— {p.adresse}</span>
                  </li>
                ))}
              </ul>
            )}

            {places.length < MAX_PLACES && (
              <div className="flex gap-2 pt-1">
                <div className="relative flex-1">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={newAdresse}
                    onChange={(e) => setNewAdresse(e.target.value)}
                    placeholder="Adresse à ajouter…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAdd();
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={searching || !newAdresse.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {searching ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  Ajouter
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400">{places.length}/{MAX_PLACES} lieux</p>
          </>
        )}
      </div>

      {managerOpen && (
        <SavedPlacesManager
          userId={userId}
          onClose={() => {
            setManagerOpen(false);
            setVersion((v) => v + 1);
          }}
        />
      )}

      {addOpen && pendingGeocode && (
        <AddSavedPlaceModal
          adresse={pendingGeocode.adresse}
          lat={pendingGeocode.lat}
          lng={pendingGeocode.lng}
          userId={userId}
          onClose={() => {
            setAddOpen(false);
            setPendingGeocode(null);
          }}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  disabled,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
      />
    </label>
  );
}
