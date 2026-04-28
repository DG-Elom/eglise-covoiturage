"use client";

import { useRef, useState } from "react";
import { Star, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";

type Props = {
  reservationId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  otherPrenom: string;
  onClose: () => void;
  onDone: () => void;
};

export function RateTripModal({
  reservationId,
  otherName,
  otherAvatarUrl,
  otherPrenom,
  onClose,
  onDone,
}: Props) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) onClose();
  }

  async function submit() {
    if (stars === 0) {
      toast.error("Choisis une note avant d'envoyer");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          stars,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Erreur lors de l'envoi");
        setLoading(false);
        return;
      }
      toast.success("Note envoyée !");
      onDone();
    } catch {
      toast.error("Erreur réseau");
      setLoading(false);
    }
  }

  const displayStars = hovered || stars;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Avatar
              photoUrl={otherAvatarUrl}
              prenom={otherPrenom}
              nom={otherName.replace(otherPrenom, "").trim()}
              size="md"
            />
            <div>
              <p className="text-sm font-medium">Note ton trajet avec</p>
              <p className="font-semibold">{otherPrenom}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition dark:text-slate-500 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex justify-center gap-2">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform hover:scale-110"
                aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
              >
                <Star
                  className={`size-8 ${
                    n <= displayStars
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ))}
          </div>

          <div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={`Un mot pour ${otherPrenom} ?`}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none resize-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
            />
            <div className="mt-1 text-right text-[10px] text-slate-400">
              {comment.length}/500
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
            >
              Plus tard
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={loading || stars === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Star className="size-3.5" />
              )}
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
