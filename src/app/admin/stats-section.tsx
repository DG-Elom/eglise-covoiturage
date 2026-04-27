import { Users, Car, Calendar, Clock } from "lucide-react";

type Stats = {
  users: number;
  conducteurs: number;
  trajetsActifs: number;
  prochainesDates: number;
  demandesEnAttente: number;
};

export function StatsSection({ stats }: { stats: Stats }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-slate-700 uppercase tracking-wide">
        Statistiques
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Users />} label="Membres" value={stats.users} />
        <Stat icon={<Car />} label="Conducteurs" value={stats.conducteurs} />
        <Stat icon={<Calendar />} label="Trajets actifs" value={stats.trajetsActifs} />
        <Stat
          icon={<Clock />}
          label="Demandes en attente"
          value={stats.demandesEnAttente}
          highlight={stats.demandesEnAttente > 0}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {stats.prochainesDates} date{stats.prochainesDates > 1 ? "s" : ""} planifiée
        {stats.prochainesDates > 1 ? "s" : ""} sur les 30 prochains jours.
      </p>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <div
        className={`inline-flex size-8 items-center justify-center rounded-lg ${
          highlight ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"
        } [&>svg]:size-4`}
      >
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
