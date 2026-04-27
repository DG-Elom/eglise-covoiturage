"use client";

import { useRef, useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const MOTIFS = [
  "Comportement inapproprié",
  "Pas venu / pas présent",
  "Conduite dangereuse",
  "Hygiène / propreté",
  "Autre",
] as const;

type Props = {
  reservationId: string;
  cibleId: string;
  cibleNom: string;
};

export function ReportButton({ reservationId, cibleId, cibleNom }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [motif, setMotif] = useState<string>(MOTIFS[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setMotif(MOTIFS[0]);
    setDescription("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      toast.error("Session expirée");
      return;
    }
    const { error } = await supabase.from("signalements").insert({
      auteur_id: user.id,
      cible_id: cibleId,
      reservation_id: reservationId,
      motif,
      description: description.trim() || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signalement envoyé. Un admin va l'examiner.");
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:border-red-200 hover:text-red-700 hover:bg-red-50 transition"
      >
        <Flag className="size-3" />
        Signaler
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        className="m-auto rounded-2xl p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={submit} className="w-[min(440px,calc(100vw-32px))] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Signaler {cibleNom}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Le signalement reste confidentiel et sera examiné par un admin.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition"
            >
              <X className="size-4" />
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">Motif</label>
            <div className="mt-2 space-y-1">
              {MOTIFS.map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    motif === m
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="motif"
                    checked={motif === m}
                    onChange={() => setMotif(m)}
                    className="sr-only"
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Quelques détails pour aider l'admin…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none resize-none"
            />
            <div className="mt-1 text-right text-[10px] text-slate-400">
              {description.length}/500
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Flag className="size-3.5" />}
              Envoyer
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
