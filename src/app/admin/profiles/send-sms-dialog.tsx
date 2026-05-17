"use client";

import { useState } from "react";
import { Loader2, MessageSquareText, X } from "lucide-react";
import { toast } from "sonner";
import { humanizeApiError } from "@/lib/errors";

const MAX_CHARS = 320;

const SKIP_REASON_LABEL: Record<string, string> = {
  no_api_key: "Provider SMS non configuré (BREVO_API_KEY manquant).",
  no_phone: "Cette personne n'a pas de téléphone enregistré.",
  invalid_phone: "Le numéro de cette personne n'est pas valide.",
  opted_out: "Cette personne a désactivé les SMS dans ses préférences.",
  already_sent: "Ce SMS a déjà été envoyé (dédoublonnage).",
};

export function SendSmsDialog({
  userId,
  prenom,
  nom,
  onClose,
}: {
  userId: string;
  prenom: string;
  nom: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const remaining = MAX_CHARS - message.length;
  const tooLong = remaining < 0;

  async function send() {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Écris un message avant d'envoyer.");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      toast.error(`Message trop long (max ${MAX_CHARS} caractères).`);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/send-sms-individual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, message: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        reason?: string;
      };
      if (res.ok && data.ok) {
        toast.success(`SMS envoyé à ${prenom}`);
        onClose();
        return;
      }
      if (data.error === "skipped" && data.reason) {
        toast.error(
          SKIP_REASON_LABEL[data.reason] ??
            `SMS non envoyé (${data.reason}).`,
        );
        return;
      }
      toast.error(humanizeApiError(data.error));
    } catch (e) {
      console.error(e);
      toast.error("Problème de connexion. Réessaie.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <MessageSquareText className="size-4 text-emerald-600 dark:text-emerald-400" />
              Envoyer un SMS
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              À {prenom} {nom}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <label
            htmlFor="sms-individual-msg"
            className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Message
          </label>
          <textarea
            id="sms-individual-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Bonjour, ..."
            rows={5}
            disabled={sending}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-emerald-600"
          />
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className={tooLong ? "text-red-600 dark:text-red-400" : "text-slate-400"}>
              {remaining} caractère{Math.abs(remaining) > 1 ? "s" : ""} restant
              {Math.abs(remaining) > 1 ? "s" : ""}
            </span>
            <span className="text-slate-400">SMS facturé via Brevo</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || tooLong || message.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageSquareText className="size-4" />
            )}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
