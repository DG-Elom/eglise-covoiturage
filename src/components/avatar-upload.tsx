"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  userId: string;
  prenom?: string | null;
  nom?: string | null;
  value: string | null;
  onChange: (url: string | null) => void;
};

export function AvatarUpload({ userId, prenom, nom, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<"upload" | "remove" | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Image trop lourde (max 3 Mo)");
      return;
    }
    setLoading("upload");
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "0" });

    if (error) {
      setLoading(null);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    onChange(`${data.publicUrl}?v=${Date.now()}`);
    setLoading(null);
    toast.success("Photo mise à jour");
  }

  async function remove() {
    setLoading("remove");
    const supabase = createClient();
    await supabase.storage.from("avatars").remove([
      `${userId}/avatar.jpg`,
      `${userId}/avatar.jpeg`,
      `${userId}/avatar.png`,
      `${userId}/avatar.webp`,
    ]);
    onChange(null);
    setLoading(null);
    toast.success("Photo supprimée");
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar photoUrl={value} prenom={prenom} nom={nom} size="lg" />
        {loading === "upload" && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="size-5 text-white animate-spin" />
          </div>
        )}
      </div>
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <Camera className="size-3.5" />
          {value ? "Changer la photo" : "Ajouter une photo"}
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
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}
