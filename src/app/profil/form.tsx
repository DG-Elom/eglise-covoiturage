"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AvatarUpload } from "@/components/avatar-upload";

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
  const [role, setRole] = useState<Role>(profile.role);
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photo_url);
  const isConducteur = role === "conducteur" || role === "les_deux";

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
    </form>
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
