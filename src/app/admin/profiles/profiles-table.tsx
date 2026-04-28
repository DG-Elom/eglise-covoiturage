"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { confirmToast } from "@/lib/confirm";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  Ban,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export type Profile = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  role: "conducteur" | "passager" | "les_deux";
  photo_url: string | null;
  is_admin: boolean;
  suspended: boolean;
  suspended_reason: string | null;
  created_at: string;
};

const ROLE_LABEL: Record<Profile["role"], string> = {
  conducteur: "Conducteur",
  passager: "Passager",
  les_deux: "Les deux",
};

const ROLE_COLOR: Record<Profile["role"], string> = {
  conducteur:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  passager:
    "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  les_deux:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? "s" : ""}`;
}

function ProfileRow({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function toggleSuspend() {
    if (!profile.suspended) {
      const reason = window.prompt(
        `Raison de la suspension de ${profile.prenom} ${profile.nom} (optionnel) :`,
      );
      if (reason === null) return;

      const ok = await confirmToast(
        `Suspendre ${profile.prenom} ${profile.nom} ? Il/elle ne pourra plus accéder à l'app.`,
        { confirmLabel: "Suspendre", destructive: true },
      );
      if (!ok) return;

      setLoadingAction("suspend");
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          suspended: true,
          suspended_reason: reason.trim() || null,
        } as never)
        .eq("id", profile.id);
      setLoadingAction(null);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Compte suspendu");
    } else {
      const ok = await confirmToast(
        `Réactiver le compte de ${profile.prenom} ${profile.nom} ?`,
        { confirmLabel: "Réactiver" },
      );
      if (!ok) return;

      setLoadingAction("suspend");
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ suspended: false, suspended_reason: null } as never)
        .eq("id", profile.id);
      setLoadingAction(null);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Compte réactivé");
    }
    startTransition(() => router.refresh());
  }

  async function toggleAdmin() {
    const action = profile.is_admin ? "Retirer les droits admin" : "Promouvoir admin";
    const ok = await confirmToast(
      `${action} pour ${profile.prenom} ${profile.nom} ?`,
      {
        confirmLabel: action,
        destructive: profile.is_admin,
      },
    );
    if (!ok) return;

    setLoadingAction("admin");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ is_admin: !profile.is_admin } as never)
      .eq("id", profile.id);
    setLoadingAction(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(profile.is_admin ? "Droits admin retirés" : "Promu admin");
    startTransition(() => router.refresh());
  }

  async function deleteProfile() {
    const ok = await confirmToast(
      `Supprimer le profil de ${profile.prenom} ${profile.nom} ? Cette action est irréversible.`,
      { confirmLabel: "Supprimer", destructive: true },
    );
    if (!ok) return;

    setLoadingAction("delete");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profile.id);
    setLoadingAction(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil supprimé");
    startTransition(() => router.refresh());
  }

  const busy = loadingAction !== null;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <Avatar
            photoUrl={profile.photo_url}
            prenom={profile.prenom}
            nom={profile.nom}
            size="sm"
          />
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900 dark:text-slate-100">
              {profile.prenom} {profile.nom}
            </div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {profile.telephone}
            </div>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 sm:table-cell">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLOR[profile.role]}`}
        >
          {ROLE_LABEL[profile.role]}
        </span>
      </td>
      <td className="hidden px-3 py-3 md:table-cell">
        {profile.is_admin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldCheck className="size-3" />
            Admin
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3 md:table-cell">
        {profile.suspended && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300"
            title={profile.suspended_reason ?? undefined}
          >
            <Ban className="size-3" />
            Suspendu
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3 text-xs text-slate-500 sm:table-cell dark:text-slate-400">
        {relativeDate(profile.created_at)}
      </td>
      <td className="py-3 pl-3 pr-4">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={toggleSuspend}
            disabled={busy}
            title={profile.suspended ? "Réactiver" : "Suspendre"}
            className={`inline-flex size-7 items-center justify-center rounded-md transition disabled:opacity-40 ${
              profile.suspended
                ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                : "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
            }`}
          >
            {profile.suspended ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Ban className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleAdmin}
            disabled={busy}
            title={profile.is_admin ? "Retirer admin" : "Promouvoir admin"}
            className={`inline-flex size-7 items-center justify-center rounded-md transition disabled:opacity-40 ${
              profile.is_admin
                ? "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                : "text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
            }`}
          >
            {profile.is_admin ? (
              <ShieldOff className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={deleteProfile}
            disabled={busy}
            title="Supprimer le profil"
            className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ProfilesTable({ profiles }: { profiles: Profile[] }) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? profiles.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.prenom.toLowerCase().includes(q) ||
          p.nom.toLowerCase().includes(q) ||
          p.telephone.toLowerCase().includes(q)
        );
      })
    : profiles;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par prénom, nom ou téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          {search.trim() ? "Aucun profil ne correspond à la recherche." : "Aucun profil."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5 pl-4 pr-3">Membre</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Rôle</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Admin</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Statut</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Inscription</th>
                <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => (
                <ProfileRow key={profile.id} profile={profile} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-right text-xs text-slate-400 dark:text-slate-600">
        {filtered.length} profil{filtered.length !== 1 ? "s" : ""}
        {search.trim() ? ` sur ${profiles.length}` : ""}
      </p>
    </div>
  );
}
