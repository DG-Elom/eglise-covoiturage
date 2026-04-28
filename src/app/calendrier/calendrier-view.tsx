"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayDetail, type DayEvent } from "./day-detail";

export type CalendrierConducteurTrajet = {
  id: string;
  depart_adresse: string;
  heure_depart: string;
  sens: "aller" | "retour" | "aller_retour";
  cultes: { libelle: string; heure: string } | null;
  trajets_instances: Array<{
    id: string;
    date: string;
    annule_par_conducteur: boolean;
    reservations: Array<{
      id: string;
      statut:
        | "pending"
        | "accepted"
        | "refused"
        | "cancelled"
        | "completed"
        | "no_show";
    }>;
  }>;
};

export type CalendrierPassagerReservation = {
  id: string;
  statut:
    | "pending"
    | "accepted"
    | "refused"
    | "cancelled"
    | "completed"
    | "no_show";
  sens: "aller" | "retour";
  pickup_adresse: string;
  trajets_instances: {
    id: string;
    date: string;
    trajets: {
      depart_adresse: string;
      heure_depart: string;
      cultes: { libelle: string; heure: string } | null;
      conducteur: { prenom: string } | null;
    } | null;
  } | null;
};

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const WEEKDAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildEventsByDay(
  trajets: CalendrierConducteurTrajet[],
  reservations: CalendrierPassagerReservation[],
): Map<string, DayEvent[]> {
  const map = new Map<string, DayEvent[]>();

  for (const t of trajets) {
    for (const inst of t.trajets_instances) {
      if (inst.annule_par_conducteur) continue;
      const heure =
        t.cultes?.heure?.slice(0, 5) ?? t.heure_depart.slice(0, 5);
      const ev: DayEvent = {
        kind: "conducteur",
        id: inst.id,
        date: inst.date,
        libelle: t.cultes?.libelle ?? "Trajet",
        heure,
        depart_adresse: t.depart_adresse,
        nb_reservations: inst.reservations.filter(
          (r) => r.statut === "accepted" || r.statut === "pending",
        ).length,
      };
      const arr = map.get(inst.date);
      if (arr) arr.push(ev);
      else map.set(inst.date, [ev]);
    }
  }

  for (const r of reservations) {
    const inst = r.trajets_instances;
    if (!inst) continue;
    const trajet = inst.trajets;
    const heure =
      trajet?.cultes?.heure?.slice(0, 5) ??
      trajet?.heure_depart.slice(0, 5) ??
      "";
    const ev: DayEvent = {
      kind: "passager",
      id: r.id,
      date: inst.date,
      libelle: trajet?.cultes?.libelle ?? "Trajet",
      heure,
      conducteur_prenom: trajet?.conducteur?.prenom ?? "—",
      statut: r.statut,
    };
    const arr = map.get(inst.date);
    if (arr) arr.push(ev);
    else map.set(inst.date, [ev]);
  }

  return map;
}

export function CalendrierView({
  trajets,
  reservations,
  initialYear,
  initialMonth,
}: {
  trajets: CalendrierConducteurTrajet[];
  reservations: CalendrierPassagerReservation[];
  initialYear: number;
  initialMonth: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const eventsByDay = useMemo(
    () => buildEventsByDay(trajets, reservations),
    [trajets, reservations],
  );

  const todayStr = ymd(new Date());

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const gridStart = new Date(year, month, 1 - startWeekday);
    const out: Array<{ date: Date; dateStr: string; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i,
      );
      out.push({
        date: d,
        dateStr: ymd(d),
        inMonth: d.getMonth() === month,
      });
    }
    return out;
  }, [year, month]);

  function prev() {
    setSelectedDate(null);
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function next() {
    setSelectedDate(null);
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  const selectedEvents = selectedDate ? eventsByDay.get(selectedDate) ?? [] : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize text-slate-900 dark:text-slate-100">
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prev}
            aria-label="Mois précédent"
            className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Mois suivant"
            className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
        {WEEKDAY_NAMES.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const events = eventsByDay.get(c.dateStr) ?? [];
          const hasConducteur = events.some((e) => e.kind === "conducteur");
          const hasPassager = events.some((e) => e.kind === "passager");
          const isToday = c.dateStr === todayStr;
          const isSelected = c.dateStr === selectedDate;
          const tinted = events.length > 0;

          const base =
            "relative flex aspect-square flex-col items-center justify-start rounded-md border p-1.5 text-xs transition";
          const colors = !c.inMonth
            ? "border-transparent text-slate-300 dark:text-slate-600"
            : tinted
              ? "border-slate-200 bg-emerald-50/60 hover:bg-emerald-100 text-slate-900 dark:border-slate-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30 dark:text-slate-100"
              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300";
          const ring = isToday
            ? "ring-2 ring-emerald-500 dark:ring-emerald-400"
            : "";
          const selectedCls = isSelected
            ? "outline outline-2 outline-sky-500 dark:outline-sky-400"
            : "";

          return (
            <button
              key={c.dateStr}
              type="button"
              onClick={() => setSelectedDate(c.dateStr)}
              className={`${base} ${colors} ${ring} ${selectedCls}`}
            >
              <span className={isToday ? "font-semibold" : ""}>
                {c.date.getDate()}
              </span>
              {(hasConducteur || hasPassager) && (
                <span className="mt-1 flex gap-0.5">
                  {hasConducteur && (
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                  )}
                  {hasPassager && (
                    <span className="size-1.5 rounded-full bg-sky-500" />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Conducteur
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-sky-500" /> Passager
        </span>
      </div>

      {selectedDate && (
        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
          <DayDetail dateStr={selectedDate} events={selectedEvents} />
        </div>
      )}
    </div>
  );
}
