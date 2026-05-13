"use client";

import { useRef, useState } from "react";
import { Bug, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "crash", label: "L'app plante / ne charge pas" },
  { value: "affichage", label: "Problème d'affichage" },
  { value: "fonctionnalite", label: "Une fonctionnalité ne marche pas" },
  { value: "performance", label: "L'app est lente" },
  { value: "autre", label: "Autre" },
] as const;

export function BugReportButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [categorie, setCategorie] = useState<(typeof CATEGORIES)[number]["value"]>(CATEGORIES[0].value);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setCategorie(CATEGORIES[0].value);
    setDescription("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Décris le problème rencontré.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          categorie,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 401) {
          toast.error("Session expirée. Reconnecte-toi.");
        } else {
          toast.error(data.error ?? "Erreur lors de l'envoi.");
        }
        return;
      }
      toast.success("Bug signalé. Merci pour ton retour !");
      close();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="fixed bottom-4 right-4 z-20 flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg hover:border-amber-300 hover:bg-amber-50 transition dark:border-slate-700 dark:bg-slate-900 dark:hover:border-amber-700 dark:hover:bg-amber-950/40"
        aria-label="Signaler un bug"
      >
        <Bug className="size-5 text-slate-500 dark:text-slate-400" />
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        className="m-auto rounded-2xl p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm dark:bg-slate-900 dark:text-slate-100"
      >
        <form onSubmit={submit} className="w-[min(440px,calc(100vw-32px))] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Signaler un bug</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Ton signalement nous aidera à améliorer l&apos;app.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition dark:text-slate-500 dark:hover:bg-slate-800"
            >
              <X className="size-4" />
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Type de problème
            </label>
            <div className="mt-2 space-y-1">
              {CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    categorie === c.value
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="categorie"
                    checked={categorie === c.value}
                    onChange={() => setCategorie(c.value)}
                    className="sr-only"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Que s&apos;est-il passé ?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              required
              placeholder="Décris le problème en détail : ce que tu faisais, ce qui s'est passé, ce que tu attendais…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none resize-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
            />
            <div className="mt-1 text-right text-[10px] text-slate-400">
              {description.length}/1000
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Bug className="size-3.5" />}
              Envoyer
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
