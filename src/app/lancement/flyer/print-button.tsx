"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
    >
      <Printer className="size-4" />
      Imprimer / PDF
    </button>
  );
}
