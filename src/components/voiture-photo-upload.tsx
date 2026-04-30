"use client";

import { useRef, useState } from "react";
import { Car, Camera, Loader2, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPT = "image/jpeg,image/png,image/webp";

export type ValidationResult = { ok: true; error?: undefined } | { ok: false; error: string };

export function validateVoiturePhoto(file: File): ValidationResult {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return { ok: false, error: "Format non supporté. Utilise JPEG, PNG ou WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image trop lourde (max 3 Mo)." };
  }
  return { ok: true };
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_W = 1200;
      let { width, height } = img;
      if (width > MAX_W) {
        height = Math.round((height * MAX_W) / width);
        width = MAX_W;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        "image/jpeg",
        0.8,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

type Props = {
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
};

export function VoiturePhotoUpload({ userId, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<"upload" | "remove" | null>(null);
  const [zoomed, setZoomed] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateVoiturePhoto(file);
    if (!validation.ok) {
      toast.error(validation.error);
      e.target.value = "";
      return;
    }

    setLoading("upload");
    const supabase = createClient();

    const compressed = await compressImage(file);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/voiture-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("voiture-photos")
      .upload(path, compressed, { upsert: false, cacheControl: "3600" });

    if (error) {
      setLoading(null);
      toast.error(error.message);
      e.target.value = "";
      return;
    }

    const { data } = supabase.storage.from("voiture-photos").getPublicUrl(path);
    onChange(`${data.publicUrl}?v=${Date.now()}`);
    setLoading(null);
    toast.success("Photo de voiture mise à jour");
    e.target.value = "";
  }

  async function remove() {
    if (!value) return;
    setLoading("remove");
    const supabase = createClient();

    // Extract path from URL: last two segments = userId/filename
    try {
      const urlObj = new URL(value.split("?")[0]);
      const parts = urlObj.pathname.split("/");
      // path format: .../storage/v1/object/public/voiture-photos/userId/filename
      const bucketIdx = parts.indexOf("voiture-photos");
      if (bucketIdx !== -1) {
        const storagePath = parts.slice(bucketIdx + 1).join("/");
        await supabase.storage.from("voiture-photos").remove([storagePath]);
      }
    } catch {
      // ignore URL parse error — still clear value
    }

    onChange(null);
    setLoading(null);
    toast.success("Photo supprimée");
  }

  return (
    <>
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => value && setZoomed(true)}
          className={`relative shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 ${value ? "cursor-zoom-in" : "cursor-default"}`}
          style={{ width: 80, height: 60 }}
          aria-label={value ? "Voir la photo en grand" : "Aucune photo"}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Photo de la voiture"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car className="size-8 text-slate-400 dark:text-slate-600" />
            </div>
          )}
          {value && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition">
              <ZoomIn className="size-4 text-white" />
            </div>
          )}
          {loading === "upload" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="size-5 text-white animate-spin" />
            </div>
          )}
        </button>

        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={onPick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Camera className="size-3.5" />
            {value ? "Modifier la photo" : "Ajouter une photo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={remove}
              disabled={loading !== null}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-red-600 disabled:opacity-50 transition"
            >
              {loading === "remove" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              Supprimer
            </button>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            JPEG, PNG ou WebP · max 3 Mo
          </p>
        </div>
      </div>

      {zoomed && value && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Photo de la voiture (plein écran)"
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
          />
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition"
            onClick={() => setZoomed(false)}
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </>
  );
}
