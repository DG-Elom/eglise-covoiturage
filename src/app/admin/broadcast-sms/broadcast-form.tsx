"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Send, Users } from "lucide-react";
import { confirmToast } from "@/lib/confirm";

type TargetType =
  | "drivers_inactive"
  | "passengers_inactive"
  | "all_members"
  | "by_culte";

type Ton = "info" | "encouragement" | "urgent";

const TARGET_OPTIONS: Array<{ value: TargetType; label: string }> = [
  { value: "drivers_inactive", label: "Conducteurs sans trajet actif" },
  { value: "passengers_inactive", label: "Passagers inactifs (>30j)" },
  { value: "all_members", label: "Tous les membres inscrits" },
  { value: "by_culte", label: "Membres ayant reserve sur un culte" },
];

const TON_OPTIONS: Array<{ value: Ton; label: string }> = [
  { value: "info", label: "Info" },
  { value: "encouragement", label: "Encouragement" },
  { value: "urgent", label: "Urgent" },
];

type RecipientPreview = {
  count: number;
  target_label: string;
  sample: Array<{ id: string; prenom: string; nom: string }>;
};

export function BroadcastSmsForm({
  cultes,
}: {
  cultes: Array<{ id: string; libelle: string }>;
}) {
  const [targetType, setTargetType] = useState<TargetType>("drivers_inactive");
  const [culteId, setCulteId] = useState<string>(cultes[0]?.id ?? "");
  const [ton, setTon] = useState<Ton>("info");
  const [brief, setBrief] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<RecipientPreview | null>(null);
  const [loading, setLoading] = useState<"preview" | "generate" | "send" | null>(
    null,
  );

  function buildFilter() {
    if (targetType === "by_culte") return { type: "by_culte", culte_id: culteId };
    return { type: targetType };
  }

  async function handlePreview() {
    if (targetType === "by_culte" && !culteId) {
      toast.error("Choisis un culte");
      return;
    }
    setLoading("preview");
    try {
      const res = await fetch("/api/admin/broadcast-sms/recipients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filter: buildFilter() }),
      });
      const data = (await res.json()) as RecipientPreview & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      setPreview(data);
    } finally {
      setLoading(null);
    }
  }

  async function handleGenerate() {
    if (!preview) {
      toast.error("Calcule d'abord le nombre de destinataires");
      return;
    }
    if (brief.trim().length < 5) {
      toast.error("Decris ton message en quelques mots");
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
          target_label: preview.target_label,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok || !data.message) {
        toast.error(data.error ?? "Generation echouee");
        return;
      }
      setMessage(data.message);
      toast.success("Message genere");
    } finally {
      setLoading(null);
    }
  }

  async function handleSend() {
    if (!preview || preview.count === 0) {
      toast.error("Aucun destinataire");
      return;
    }
    if (message.trim().length === 0) {
      toast.error("Le SMS est vide");
      return;
    }
    const ok = await confirmToast(
      `Envoyer ce SMS a ${preview.count} destinataire${preview.count > 1 ? "s" : ""} ? ` +
        `Coût estime : ~${(preview.count * 0.06).toFixed(2)} EUR.`,
      { confirmLabel: "Envoyer", destructive: false },
    );
    if (!ok) return;

    setLoading("send");
    try {
      const res = await fetch("/api/admin/broadcast-sms/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filter: buildFilter(),
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
        toast.error(data.error ?? "Envoi echoue");
        return;
      }
      toast.success(
        `Campagne envoyee : ${data.n_envoyes} reussis, ${data.n_skipped} ignores`,
      );
      setBrief("");
      setMessage("");
      setPreview(null);
    } finally {
      setLoading(null);
    }
  }

  const charCount = message.length;
  const charLimit = 160;
  const overLimit = charCount > charLimit;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          1. Choisir la cible
        </h2>

        <div className="grid gap-2 sm:grid-cols-2">
          {TARGET_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                targetType === opt.value
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              <input
                type="radio"
                className="size-4"
                checked={targetType === opt.value}
                onChange={() => {
                  setTargetType(opt.value);
                  setPreview(null);
                }}
              />
              <span className="text-slate-700 dark:text-slate-200">
                {opt.label}
              </span>
            </label>
          ))}
        </div>

        {targetType === "by_culte" && (
          <select
            value={culteId}
            onChange={(e) => {
              setCulteId(e.target.value);
              setPreview(null);
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {cultes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={handlePreview}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {loading === "preview" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Users className="size-4" />
          )}
          Calculer les destinataires
        </button>

        {preview && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {preview.count} destinataire{preview.count > 1 ? "s" : ""}{" "}
              <span className="font-normal text-slate-500">
                avec un numero de telephone
              </span>
            </div>
            {preview.sample.length > 0 && (
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Echantillon :{" "}
                {preview.sample
                  .map((s) => `${s.prenom} ${s.nom}`)
                  .join(", ")}
                {preview.count > preview.sample.length && "..."}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          2. Generer avec l&apos;IA (optionnel)
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
              <span className="text-slate-700 dark:text-slate-200">
                {opt.label}
              </span>
            </label>
          ))}
        </div>

        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Ex : rappeler aux conducteurs de declarer un trajet pour le culte de dimanche prochain"
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading !== null || !preview}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading === "generate" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Generer le SMS
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            3. SMS final (modifiable)
          </h2>
          <span
            className={`text-xs ${overLimit ? "text-red-600" : "text-slate-500"}`}
          >
            {charCount}/{charLimit}
            {overLimit && " — sera segmente en 2 SMS factures"}
          </span>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ecris ou genere ton SMS"
          rows={4}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={loading !== null || !preview || message.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {loading === "send" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Envoyer la campagne
          </button>
        </div>
      </section>
    </div>
  );
}
