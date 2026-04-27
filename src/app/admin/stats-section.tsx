import { Users, Car, Calendar, Clock, TrendingUp, Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";

type ReservationStatut =
  | "pending"
  | "accepted"
  | "refused"
  | "cancelled"
  | "completed"
  | "no_show";

type Stats = {
  users: number;
  conducteurs: number;
  trajetsActifs: number;
  prochainesDates: number;
  demandesEnAttente: number;
  trajetsParProgramme: { libelle: string; count: number }[];
  statutsReservations: { statut: ReservationStatut; count: number }[];
  topConducteurs: {
    id: string;
    prenom: string;
    nom: string;
    photo_url: string | null;
    count: number;
  }[];
  sparkline14j: { date: string; count: number }[];
};

const STATUT_META: Record<ReservationStatut, { label: string; color: string }> = {
  pending: { label: "En attente", color: "#f59e0b" }, // amber-500
  accepted: { label: "Acceptée", color: "#10b981" }, // emerald-500
  refused: { label: "Refusée", color: "#ef4444" }, // red-500
  cancelled: { label: "Annulée", color: "#94a3b8" }, // slate-400
  completed: { label: "Terminée", color: "#0f766e" }, // teal-700
  no_show: { label: "Non présenté", color: "#b91c1c" }, // red-700
};

export function StatsSection({ stats }: { stats: Stats }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-slate-700 uppercase tracking-wide dark:text-slate-300">
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

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {stats.prochainesDates} date{stats.prochainesDates > 1 ? "s" : ""} planifiée
        {stats.prochainesDates > 1 ? "s" : ""} sur les 30 prochains jours.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Trajets par programme">
          <BarChart data={stats.trajetsParProgramme} />
        </Card>

        <Card title="Statuts des réservations">
          <DonutChart data={stats.statutsReservations} />
        </Card>

        <Card title="Top conducteurs" icon={<Trophy className="size-3.5 text-amber-500" />}>
          <TopConducteurs items={stats.topConducteurs} />
        </Card>

        <Card
          title="Demandes — 14 derniers jours"
          icon={<TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />}
        >
          <Sparkline data={stats.sparkline14j} />
        </Card>
      </div>
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
        highlight
          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <div
        className={`inline-flex size-8 items-center justify-center rounded-lg ${
          highlight
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        } [&>svg]:size-4`}
      >
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function BarChart({ data }: { data: { libelle: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Aucun programme actif.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <li key={d.libelle} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-slate-700 dark:text-slate-300">{d.libelle}</span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{d.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DonutChart({
  data,
}: {
  data: { statut: ReservationStatut; count: number }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Aucune réservation.</p>;
  }

  const size = 120;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const len = (d.count / total) * circumference;
      const seg = {
        statut: d.statut,
        len,
        offset,
        color: STATUT_META[d.statut].color,
      };
      offset += len;
      return seg;
    });

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="relative shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={stroke}
          />
          {segments.map((s) => (
            <circle
              key={s.statut}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${s.len} ${circumference - s.len}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">total</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-1">
        {data.map((d) => (
          <li key={d.statut} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: STATUT_META[d.statut].color }}
            />
            <span className="flex-1 truncate text-slate-600 dark:text-slate-400">
              {STATUT_META[d.statut].label}
            </span>
            <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopConducteurs({
  items,
}: {
  items: Stats["topConducteurs"];
}) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Aucun trajet terminé pour le moment.</p>;
  }
  return (
    <ol className="space-y-2">
      {items.map((c, idx) => (
        <li key={c.id} className="flex items-center gap-3">
          <span className="w-4 text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
            {idx + 1}
          </span>
          <Avatar
            photoUrl={c.photo_url}
            prenom={c.prenom}
            nom={c.nom}
            size="sm"
          />
          <span className="flex-1 truncate text-sm text-slate-800 dark:text-slate-200">
            {c.prenom} {c.nom}
          </span>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {c.count}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Aucune donnée.</p>;
  }
  const w = 280;
  const h = 64;
  const padX = 2;
  const padY = 4;
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const stepX = (w - 2 * padX) / Math.max(1, data.length - 1);

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = h - padY - (d.count / max) * (h - 2 * padY);
    return { x, y, count: d.count, date: d.date };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${h - padY} L ${points[0].x.toFixed(1)} ${h - padY} Z`;

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular-nums">{total}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">demandes / 14j</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-16 w-full"
        preserveAspectRatio="none"
        aria-label="Évolution des demandes sur 14 jours"
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#spark-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r="1.5" fill="#10b981" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>{fmtDate(data[0].date)}</span>
        <span>{fmtDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
