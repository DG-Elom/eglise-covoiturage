export const CHARTE_TEXT = [
  "Je m'engage à être ponctuel·le et à prévenir au moins 2h à l'avance en cas d'annulation.",
  "Je m'engage à respecter les autres membres : politesse, écoute, discrétion.",
  "En tant que conducteur, je dispose d'une assurance auto valide qui couvre le transport occasionnel de passagers.",
  "Je comprends que la paroisse n'est pas responsable des incidents survenant durant les trajets.",
  "Je m'engage à utiliser cette plateforme uniquement à des fins de covoiturage vers les cultes.",
];

export function CharteText() {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
      <h3 className="font-medium text-slate-900">Charte d&apos;engagement</h3>
      <ul className="space-y-2 text-slate-700">
        {CHARTE_TEXT.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-emerald-600 shrink-0">{i + 1}.</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
