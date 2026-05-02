// Templates email — relances passagers inactifs
// Deno-compatible, pas de dépendance npm.

export interface StatsHebdo {
  nbConducteursActifs: number;
  nbTrajetsDispo: number;
  nbPassagersTransportes: number;
}

export interface Verset {
  reference: string;
  texte: string;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const btn = (label: string, url: string): string =>
  `<div style="margin-top:24px;text-align:center;">
    <a href="${url}" style="display:inline-block;padding:12px 28px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(label)}</a>
  </div>`;

const versetHtml = (v: Verset): string =>
  `<div style="margin-top:24px;padding:16px;background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;">
    <p style="margin:0;font-style:italic;color:#065f46;font-size:14px;">&laquo;&nbsp;${escapeHtml(v.texte)}&nbsp;&raquo;</p>
    <p style="margin:6px 0 0 0;font-weight:600;color:#047857;font-size:12px;">— ${escapeHtml(v.reference)}</p>
  </div>`;

const baseLayout = (prenom: string, body: string): string =>
  `<!doctype html>
<html lang="fr">
<body style="font-family:system-ui,sans-serif;line-height:1.6;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#0f172a;">Bonjour ${escapeHtml(prenom)},</h2>
  ${body}
  <hr style="margin-top:32px;border:none;border-top:1px solid #e2e8f0;" />
  <p style="font-size:12px;color:#94a3b8;margin-top:12px;">
    Tu reçois cet email parce que tu t'es inscrit sur l'app de covoiturage ICC.
    Tu peux désactiver ces relances dans les paramètres de l'app.
  </p>
</body>
</html>`;

const APP_SEARCH_URL = "https://app.icc-covoit.fr/trajets/recherche";

export const renderEngageD2 = (prenom: string): { subject: string; html: string } => {
  const subject = `👋 ${prenom}, tu as déjà essayé de trouver un trajet ?`;

  const body = `
  <p>On a remarqué que tu n'as pas encore réservé de trajet. C'est super simple :</p>
  <ol style="padding-left:20px;">
    <li>Entre ton adresse de départ</li>
    <li>Choisis le culte</li>
    <li>Tu vois les conducteurs disponibles autour de toi</li>
  </ol>
  <p>Tout prend moins de 30 secondes. Essaie !</p>
  ${btn("Trouver un trajet", APP_SEARCH_URL)}`;

  return { subject, html: baseLayout(prenom, body) };
};

export const renderEngageD7 = (
  prenom: string,
  stats: StatsHebdo,
): { subject: string; html: string } => {
  const subject = `🚗 ${prenom}, ${stats.nbConducteursActifs} conducteurs t'attendent cette semaine`;

  const body = `
  <p>
    <strong>${stats.nbConducteursActifs} fidèles ICC</strong> ont covoituré cette semaine,
    transportant <strong>${stats.nbPassagersTransportes} personnes</strong>.
    Il y a en ce moment <strong>${stats.nbTrajetsDispo} trajets disponibles</strong> d'ici dimanche.
  </p>
  <p>Tu n'as toujours pas réservé — mais il est encore temps !</p>
  ${btn("Voir les trajets disponibles", APP_SEARCH_URL)}`;

  return { subject, html: baseLayout(prenom, body) };
};

export const renderEngageD14 = (
  prenom: string,
  verset: Verset,
): { subject: string; html: string } => {
  const subject = `📍 ${prenom}, on garde ta place dimanche ?`;

  const body = `
  <p>
    On voudrait pas que tu rates le culte parce que tu n'as pas trouvé de trajet.
    Si tu as une difficulté, réponds directement à cet email — on est là.
  </p>
  <p>
    C'est notre dernier petit rappel, promis. Après ça on te laisse tranquille !
  </p>
  ${btn("Trouver un trajet maintenant", APP_SEARCH_URL)}
  ${versetHtml(verset)}`;

  return { subject, html: baseLayout(prenom, body) };
};

// ──────────────────────────────────────────────
// Templates conducteurs
// ──────────────────────────────────────────────

export interface StatsHebdoConducteur {
  nbPassagersInscritsSansResa: number;
  nbDemandesPending: number;
}

const APP_NOUVEAU_TRAJET_URL = "https://app.icc-covoit.fr/trajets/nouveau";
const APP_PROFIL_URL = "https://app.icc-covoit.fr/profil";

export const renderEngageConducteurD2 = (prenom: string): { subject: string; html: string } => {
  const subject = `🚗 ${prenom}, tu peux aider la communauté ICC en proposant un trajet`;

  const body = `
  <p>
    Tu es inscrit comme conducteur mais tu n'as pas encore proposé de trajet.
    C'est super simple : indique ton point de départ, choisis le culte,
    et les passagers proches de toi pourront te demander une place.
  </p>
  ${btn("Créer mon premier trajet", APP_NOUVEAU_TRAJET_URL)}`;

  return { subject, html: baseLayout(prenom, body) };
};

export const renderEngageConducteurD7 = (
  prenom: string,
  stats: StatsHebdoConducteur,
): { subject: string; html: string } => {
  const subject = `🙏 ${prenom}, ${stats.nbPassagersInscritsSansResa} passagers attendent une place vers ICC`;

  const body = `
  <p>
    <strong>${stats.nbPassagersInscritsSansResa} fidèles ICC</strong> se sont inscrits cette semaine
    sans trouver de trajet.
    ${stats.nbDemandesPending > 0 ? `Il y a en ce moment <strong>${stats.nbDemandesPending} demande${stats.nbDemandesPending > 1 ? "s" : ""} en attente</strong> de conducteur.` : ""}
  </p>
  <p>
    Sans conducteurs, le covoiturage ne peut pas exister.
    Sois leur premier conducteur !
  </p>
  ${btn("Créer mon premier trajet", APP_NOUVEAU_TRAJET_URL)}`;

  return { subject, html: baseLayout(prenom, body) };
};

export const renderEngageConducteurD14 = (
  prenom: string,
  verset: Verset,
): { subject: string; html: string } => {
  const subject = `🚗 ${prenom}, on a vraiment besoin de toi`;

  const body = `
  <p>
    La communauté ICC compte sur des conducteurs comme toi pour fonctionner.
    Si tu peux conduire, un seul trajet peut changer le dimanche de plusieurs fidèles.
  </p>
  ${versetHtml(verset)}
  <p style="margin-top:16px;">
    Si tu ne peux pas conduire pour de bonnes raisons (voiture indisponible, contraintes personnelles),
    tu peux changer ton rôle vers passager dans
    <a href="${APP_PROFIL_URL}" style="color:#10b981;">ton profil</a>.
    Sinon, on serait vraiment heureux que tu démarres !
  </p>
  <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">
    <a href="${APP_NOUVEAU_TRAJET_URL}" style="display:inline-block;padding:12px 28px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Créer un trajet</a>
    <a href="${APP_PROFIL_URL}" style="display:inline-block;padding:12px 28px;background:#f1f5f9;color:#1e293b;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Modifier mon rôle</a>
  </div>`;

  return { subject, html: baseLayout(prenom, body) };
};

export interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export const sendResend = async (
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> => {
  const payload: ResendPayload = { from, to: [to], subject, html };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
};
