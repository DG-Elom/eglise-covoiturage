"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Send, Search, Users, UserPlus } from "lucide-react";
import { confirmToast } from "@/lib/confirm";

type Ton = "info" | "encouragement" | "urgent";

type RosterMember = {
  id: string;
  prenom: string;
  nom: string;
  role: string;
  has_phone: boolean;
};

const TON_OPTIONS: Array<{ value: Ton; label: string }> = [
  { value: "info", label: "Info" },
  { value: "encouragement", label: "Encouragement" },
  { value: "urgent", label: "Urgent" },
];

const COUT_SMS_EUR = 0.06;

export function BroadcastSmsForm({
  cultes,
}: {
  cultes: Array<{ id: string; libelle: string }>;
}) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [culteId, setCulteId] = useState<string>(cultes[0]?.id ?? "");

  const [ton, setTon] = useState<Ton>("info");
  const [brief, setBrief] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"generate" | "send" | null>(null);
  const [quickAdd, setQuickAdd] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false); // garde anti-double-envoi (double-clic)

  // --- Chargement de l'annuaire ---------------------------------------------
  const loadRoster = useCallback(() => {
    setRosterLoading(true);
    fetch("/api/admin/broadcast-sms/roster")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { members: RosterMember[] } | null) => d && setRoster(d.members))
      .catch(() => toast.error("Annuaire indisponible"))
      .finally(() => setRosterLoading(false));
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // --- Sélection ------------------------------------------------------------
  const addIds = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const toggleId = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isDriver = (m: RosterMember) => m.role === "conducteur" || m.role === "les_deux";
  const isPassenger = (m: RosterMember) => m.role === "passager" || m.role === "les_deux";

  function addRoleGroup(kind: "all" | "drivers" | "passengers") {
    const pick =
      kind === "all"
        ? roster
        : kind === "drivers"
          ? roster.filter(isDriver)
          : roster.filter(isPassenger);
    addIds(pick.map((m) => m.id));
    toast.success(`${pick.length} membre(s) ajouté(s)`);
  }

  // Groupes nécessitant la base (inactifs, par culte) : résolus côté serveur.
  async function addServerGroup(
    filter: Record<string, unknown>,
    label: string,
    key: string,
  ) {
    setQuickAdd(key);
    try {
      const res = await fetch("/api/admin/broadcast-sms/recipients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filter }),
      });
      const data = (await res.json()) as { ids?: string[]; error?: string };
      if (!res.ok || !data.ids) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      addIds(data.ids);
      toast.success(`${label} : ${data.ids.length} ajouté(s)`);
    } finally {
      setQuickAdd(null);
    }
  }

  const selectedMembers = useMemo(
    () => roster.filter((m) => selected.has(m.id)),
    [roster, selected],
  );
  const withPhone = selectedMembers.filter((m) => m.has_phone).length;
  const withoutPhone = selectedMembers.length - withPhone;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((m) => `${m.prenom} ${m.nom}`.toLowerCase().includes(q));
  }, [roster, search]);

  // --- Personnalisation : insertion du jeton au curseur ---------------------
  function insertPrenom() {
    const ta = textareaRef.current;
    const token = "{prénom}";
    if (!ta) {
      setMessage((m) => m + token);
      return;
    }
    const start = ta.selectionStart ?? message.length;
    const end = ta.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  // --- IA -------------------------------------------------------------------
  async function handleGenerate() {
    if (selected.size === 0) {
      toast.error("Choisis d'abord des destinataires");
      return;
    }
    if (brief.trim().length < 5) {
      toast.error("Décris ton message en quelques mots");
      return;
    }
    setLoading("generate");
    try {
      const res = await fetch("/api/admin/broadcast-sms/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief: brief.trim(),
          ton,
          target_label: `${withPhone} membre(s) sélectionné(s)`,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok || !data.message) {
        toast.error(data.error ?? "Génération échouée");
        return;
      }
      setMessage(data.message);
      toast.success("Message généré");
    } finally {
      setLoading(null);
    }
  }

  // --- Envoi ----------------------------------------------------------------
  async function handleSend() {
    // Garde anti-réentrance : empêche un double-clic d'ouvrir deux confirmations
    // (et donc d'envoyer deux campagnes).
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      if (withPhone === 0) {
        toast.error("Aucun destinataire avec un numéro");
        return;
      }
      if (message.trim().length === 0) {
        toast.error("Le SMS est vide");
        return;
      }
      if (overMax) {
        toast.error(`Message trop long (max ${MAX_MESSAGE_CHARS} caractères)`);
        return;
      }
      const ok = await confirmToast(
        `Envoyer ce SMS à ${withPhone} destinataire${withPhone > 1 ? "s" : ""} ? ` +
          `Coût estimé : ~${estimatedCost} EUR` +
          (segments > 1 ? ` (${segments} SMS/pers.)` : "") +
          ".",
        { confirmLabel: "Envoyer", destructive: false },
      );
      if (!ok) return;

      setLoading("send");
      const res = await fetch("/api/admin/broadcast-sms/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filter: { type: "explicit", user_ids: [...selected] },
          message: message.trim(),
          prompt_admin: brief.trim() || null,
          ton,
        }),
      });
      const data = (await res.json()) as {
        n_envoyes?: number;
        n_skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Envoi échoué");
        return;
      }
      toast.success(
        `Campagne envoyée : ${data.n_envoyes} réussis, ${data.n_skipped} ignorés`,
      );
      setBrief("");
      setMessage("");
      setSelected(new Set());
    } finally {
      submittingRef.current = false;
      setLoading(null);
    }
  }

  const charCount = message.length;
  const SEGMENT_SIZE = 160; // 1 segment SMS GSM-7
  const MAX_MESSAGE_CHARS = 320; // doit rester aligné avec la route send
  const segments = Math.max(1, Math.ceil(charCount / SEGMENT_SIZE));
  const overMax = charCount > MAX_MESSAGE_CHARS;
  const estimatedCost = (withPhone * segments * COUT_SMS_EUR).toFixed(2);

  return (
    <div className="space-y-6">
      {/* 1. Destinataires */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          1. Choisir les destinataires
        </h2>

        {/* Ajouts rapides de groupes */}
        <div className="flex flex-wrap gap-2">
          <QuickChip onClick={() => addRoleGroup("all")} icon={<Users className="size-3.5" />}>
            Tous
          </QuickChip>
          <QuickChip onClick={() => addRoleGroup("drivers")}>+ Conducteurs</QuickChip>
          <QuickChip onClick={() => addRoleGroup("passengers")}>+ Passagers</QuickChip>
          <QuickChip
            onClick={() =>
              addServerGroup({ type: "drivers_inactive" }, "Conducteurs sans trajet", "di")
            }
            loading={quickAdd === "di"}
          >
            + Conducteurs sans trajet
          </QuickChip>
          <QuickChip
            onClick={() =>
              addServerGroup({ type: "passengers_inactive" }, "Passagers inactifs", "pi")
            }
            loading={quickAdd === "pi"}
          >
            + Passagers inactifs
          </QuickChip>
          {cultes.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 pl-2 text-xs dark:border-slate-700 dark:bg-slate-800">
              <select
                value={culteId}
                onChange={(e) => setCulteId(e.target.value)}
                className="bg-transparent py-1 text-slate-700 outline-none dark:text-slate-200"
              >
                {cultes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  addServerGroup({ type: "by_culte", culte_id: culteId }, "Par culte", "bc")
                }
                disabled={!culteId || quickAdd === "bc"}
                className="rounded-r-full bg-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200"
              >
                {quickAdd === "bc" ? "…" : "+ ajouter"}
              </button>
            </span>
          )}
        </div>

        {/* Résumé sélection */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <span className="text-emerald-700 dark:text-emerald-400">
            {withPhone} recevront
          </span>
          {withoutPhone > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {withoutPhone} sans numéro (ignoré{withoutPhone > 1 ? "s" : ""})
            </span>
          )}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              Tout désélectionner
            </button>
          )}
        </div>

        {/* Recherche + liste */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {rosterLoading ? (
            <p className="p-4 text-center text-sm text-slate-500">Chargement de l&apos;annuaire…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">Aucun membre trouvé.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <li key={m.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                        checked
                          ? "bg-emerald-50 dark:bg-emerald-950/30"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={checked}
                        onChange={() => toggleId(m.id)}
                      />
                      <span className="flex-1 text-slate-800 dark:text-slate-200">
                        {m.prenom} {m.nom}
                        <span className="ml-2 text-xs text-slate-400">{m.role}</span>
                      </span>
                      {!m.has_phone && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                          sans n°
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 2. Génération IA (optionnel) */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          2. Générer avec l&apos;IA (optionnel)
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {TON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                ton === opt.value
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              <input
                type="radio"
                className="size-4"
                checked={ton === opt.value}
                onChange={() => setTon(opt.value)}
              />
              <span className="text-slate-700 dark:text-slate-200">{opt.label}</span>
            </label>
          ))}
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Ex : rappeler aux conducteurs de déclarer un trajet pour dimanche prochain"
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading !== null || selected.size === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading === "generate" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Générer le SMS
        </button>
      </section>

      {/* 3. Message final */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            3. SMS final (modifiable)
          </h2>
          <span className={`text-xs ${overMax ? "text-red-600" : "text-slate-500"}`}>
            {charCount}/{MAX_MESSAGE_CHARS}
            {segments > 1 && !overMax && ` — ${segments} SMS facturés/pers.`}
            {overMax && " — trop long"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={insertPrenom}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <UserPlus className="size-3.5" />
            Insérer {"{prénom}"}
          </button>
          <span className="text-xs text-slate-400">
            personnalise chaque SMS avec le prénom du destinataire
          </span>
        </div>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Écris ou génère ton SMS. Astuce : {prénom} sera remplacé pour chacun."
          rows={4}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={
              loading !== null || withPhone === 0 || message.trim().length === 0 || overMax
            }
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {loading === "send" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Envoyer à {withPhone} destinataire{withPhone > 1 ? "s" : ""}
          </button>
        </div>
      </section>
    </div>
  );
}

function QuickChip({
  children,
  onClick,
  loading,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
