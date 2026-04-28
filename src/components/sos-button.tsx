"use client";

import { useState } from "react";
import { AlertTriangle, Phone, X } from "lucide-react";

export function SosButton({
  emergencyName,
  emergencyPhone,
}: {
  emergencyName?: string | null;
  emergencyPhone?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Bouton d'urgence"
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 transition active:scale-95 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/40"
      >
        <AlertTriangle className="size-3.5" />
        SOS
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="size-5" />
                Urgence
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              En cas de danger immédiat, appelle directement les services d&apos;urgence.
            </p>

            <div className="mt-4 space-y-2">
              <SosLink
                tel="112"
                label="112"
                sublabel="Numéro d'urgence européen"
                tone="red"
              />
              <SosLink
                tel="17"
                label="17"
                sublabel="Police / Gendarmerie"
                tone="slate"
              />
              <SosLink
                tel="15"
                label="15"
                sublabel="SAMU"
                tone="slate"
              />
              <SosLink
                tel="18"
                label="18"
                sublabel="Pompiers"
                tone="slate"
              />
              {emergencyPhone && (
                <SosLink
                  tel={emergencyPhone}
                  label={emergencyName ?? "Contact perso"}
                  sublabel={emergencyPhone}
                  tone="emerald"
                />
              )}
            </div>

            {!emergencyPhone && (
              <p className="mt-4 text-xs text-slate-500">
                Tu n&apos;as pas configuré de contact d&apos;urgence. Va dans ton
                profil pour en ajouter un.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SosLink({
  tel,
  label,
  sublabel,
  tone,
}: {
  tel: string;
  label: string;
  sublabel: string;
  tone: "red" | "slate" | "emerald";
}) {
  const cls =
    tone === "red"
      ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-900/40"
      : tone === "emerald"
        ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
        : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100 dark:hover:bg-slate-700";
  return (
    <a
      href={`tel:${tel}`}
      className={`flex items-center gap-3 rounded-lg border p-3 transition active:scale-[0.98] ${cls}`}
    >
      <Phone className="size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{label}</p>
        <p className="text-xs opacity-80">{sublabel}</p>
      </div>
    </a>
  );
}
