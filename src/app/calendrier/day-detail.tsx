"use client";

import Link from "next/link";
import { Car, MapPin, User } from "lucide-react";

export type DayEvent =
  | {
      kind: "conducteur";
      id: string;
      date: string;
      libelle: string;
      heure: string;
      depart_adresse: string;
      nb_reservations: number;
    }
  | {
      kind: "passager";
      id: string;
      date: string;
      libelle: string;
      heure: string;
      conducteur_prenom: string;
      statut:
        | "pending"
        | "accepted"
        | "refused"
        | "cancelled"
        | "completed"
        | "no_show";
    };

const STATUT_LABEL: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  cancelled: "Annulée",
  completed: "Effectuée",
  no_show: "Pas venu",
};

const STATUT_TONE: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  accepted:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  refused: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  no_show: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
};

function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DayDetail({
  dateStr,
  events,
}: {
  dateStr: string;
  events: DayEvent[];
}) {
  return (
    <div>
      <h3 className="text-base font-semibold capitalize text-slate-900 dark:text-slate-100">
        {formatLongDate(dateStr)}
      </h3>

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Aucun événement ce jour.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {events
            .slice()
            .sort((a, b) => a.heure.localeCompare(b.heure))
            .map((ev) => (
              <li key={`${ev.kind}-${ev.id}`}>
                <Link
                  href="/dashboard"
                  className="block rounded-lg border border-slate-200 bg-white p-3 text-sm hover:border-slate-300 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {ev.kind === "conducteur" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        <Car className="size-3" /> Conducteur
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                        <User className="size-3" /> Passager
                      </span>
                    )}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {ev.libelle}
                    </span>
                    {ev.heure && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        · {ev.heure}
                      </span>
                    )}
                  </div>

                  {ev.kind === "conducteur" ? (
                    <div className="mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        <span className="truncate">{ev.depart_adresse}</span>
                      </div>
                      <div>
                        {ev.nb_reservations} réservation
                        {ev.nb_reservations > 1 ? "s" : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>Conducteur · {ev.conducteur_prenom}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_TONE[ev.statut] ?? ""}`}
                      >
                        {STATUT_LABEL[ev.statut] ?? ev.statut}
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
