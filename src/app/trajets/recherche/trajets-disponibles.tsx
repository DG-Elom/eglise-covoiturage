import { Calendar, MapPin, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";

export type TrajetDisponible = {
  id: string;
  date: string;
  trajet: {
    id: string;
    depart_adresse: string;
    sens: "aller" | "retour" | "aller_retour";
    places_total: number;
    heure_depart: string;
    conducteur: {
      id: string;
      prenom: string;
      nom: string;
      photo_url: string | null;
    };
    culte: { libelle: string; heure: string };
  };
};

const SENS_LABEL: Record<TrajetDisponible["trajet"]["sens"], string> = {
  aller: "Aller",
  retour: "Retour",
  aller_retour: "Aller-retour",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

export function TrajetsDisponibles({
  instances,
}: {
  instances: TrajetDisponible[];
}) {
  if (instances.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          Trajets disponibles
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Aucun trajet n&apos;est encore proposé pour les jours à venir.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Reviens bientôt ou demande à un conducteur de la communauté.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Trajets disponibles
        </h2>
        <span className="text-xs text-slate-500">
          {instances.length} trajet{instances.length > 1 ? "s" : ""}
        </span>
      </div>
      <ul className="space-y-3">
        {instances.map((inst) => (
          <li
            key={inst.id}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <Avatar
                photoUrl={inst.trajet.conducteur.photo_url}
                prenom={inst.trajet.conducteur.prenom}
                nom={inst.trajet.conducteur.nom}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">
                    {inst.trajet.conducteur.prenom}
                  </span>
                  <span className="text-xs text-slate-500">
                    {inst.trajet.culte.libelle}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Calendar className="size-3 shrink-0" />
                  <span>
                    {formatDate(inst.date)} · départ {inst.trajet.heure_depart.slice(0, 5)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{inst.trajet.depart_adresse}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Users className="size-3" /> {inst.trajet.places_total} place
                    {inst.trajet.places_total > 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {SENS_LABEL[inst.trajet.sens]}
                  </span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Pour réserver une place, saisis ton adresse en haut puis lance la recherche.
      </p>
    </section>
  );
}
