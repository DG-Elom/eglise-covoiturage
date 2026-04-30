"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { submitThanks } from "./send-thanks-modal.logic";

const MAX_LENGTH = 500;

type Props = {
  reservationId: string | null;
  destinataire: { id: string; prenom: string; nom: string };
  open: boolean;
  onClose: () => void;
};

export function SendThanksModal({ reservationId, destinataire, open, onClose }: Props) {
  if (!open) return null;

  return (
    <SendThanksModalInner
      key={`${destinataire.id}-${reservationId}`}
      reservationId={reservationId}
      destinataire={destinataire}
      onClose={onClose}
    />
  );
}

type InnerProps = Omit<Props, "open">;

function SendThanksModalInner({ reservationId, destinataire, onClose }: InnerProps) {
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || loading) return;

    setLoading(true);
    const result = await submitThanks({
      destinataireId: destinataire.id,
      reservationId,
      message: message.trim(),
      isPublic,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error("Impossible d'envoyer le remerciement. Réessaie.");
      return;
    }

    toast.success("Remerciement envoyé !");
    onClose();
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Remercier ${destinataire.prenom} ${destinataire.nom}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Remercier {destinataire.prenom} {destinataire.nom}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label
              htmlFor="thanks-message"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Message
            </label>
            <textarea
              id="thanks-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
              rows={4}
              placeholder={`Écris un mot pour ${destinataire.prenom}…`}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <div className="mt-1 text-right text-xs text-slate-400">
              {message.length}/{MAX_LENGTH}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Visible par tous (affiché sur le profil public)
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!message.trim() || loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
