// Templates email pour le digest hebdomadaire grand public.
// Deno-compatible, pas de dépendance npm.

export interface Verset {
  reference: string;
  texte: string;
}

export interface WeeklyDigestContext {
  nbInstancesAVenir: number;
  nbPlacesLibres: number;
  nextDate: string | null; // YYYY-MM-DD
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

const statsHtml = (ctx: WeeklyDigestContext): string => {
  const lines: string[] = [];
  if (ctx.nbInstancesAVenir > 0) {
    lines.push(
      `<strong>${ctx.nbInstancesAVenir}</strong> trajet${ctx.nbInstancesAVenir > 1 ? "s" : ""} vers le programme cette semaine`,
    );
  }
  if (ctx.nbPlacesLibres > 0) {
    lines.push(
      `<strong>${ctx.nbPlacesLibres}</strong> place${ctx.nbPlacesLibres > 1 ? "s" : ""} encore libre${ctx.nbPlacesLibres > 1 ? "s" : ""}`,
    );
  }
  if (lines.length === 0) return "";
  return `<p style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0;">${lines.join(" · ")}</p>`;
};

const pushPromoHtml = (appUrl: string): string =>
  `<div style="margin-top:24px;padding:14px 16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;">
    <p style="margin:0 0 6px 0;font-weight:600;color:#1e40af;font-size:14px;">📲 Garde l'app sous la main</p>
    <p style="margin:0;color:#1e3a8a;font-size:13px;line-height:1.5;">
      Reçois ces rappels en notification, sans ouvrir tes mails :
      <br/>• <strong>iPhone</strong> : ouvre <a href="${appUrl}" style="color:#1d4ed8;">l'app</a> dans Safari → bouton Partager → « Sur l'écran d'accueil », puis autorise les notifications.
      <br/>• <strong>Android</strong> : ouvre <a href="${appUrl}" style="color:#1d4ed8;">l'app</a> dans Chrome → menu ⋮ → « Installer l'application », puis autorise les notifications.
    </p>
  </div>`;

const footer = (): string =>
  `<hr style="margin-top:32px;border:none;border-top:1px solid #e2e8f0;" />
  <p style="font-size:12px;color:#94a3b8;margin-top:12px;">
    Tu reçois cet email parce que tu es inscrit sur l'app de covoiturage ICC.
    Tu peux désactiver ces messages dans les paramètres de l'app.
  </p>`;

const baseLayout = (prenom: string, body: string, appUrl: string): string =>
  `<!doctype html>
<html lang="fr">
<body style="font-family:system-ui,sans-serif;line-height:1.6;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#0f172a;">Bonjour ${escapeHtml(prenom)},</h2>
  ${body}
  ${pushPromoHtml(appUrl)}
  ${footer()}
</body>
</html>`;

/** Email passager : incite à réserver une place. */
export const renderDigestPassager = (
  prenom: string,
  ctx: WeeklyDigestContext,
  verset: Verset,
  appUrl: string,
): { subject: string; html: string } => {
  const subject = `🚗 ${prenom}, ta place pour dimanche ?`;

  const body = `
  <p>Le week-end approche et des conducteurs ICC t'attendent !</p>
  ${statsHtml(ctx)}
  <p>Réserve maintenant, c'est rapide.</p>
  ${btn("Réserve ta place pour ce week-end", `${appUrl}/trajets/recherche`)}
  ${versetHtml(verset)}`;

  return { subject, html: baseLayout(prenom, body, appUrl) };
};

/** Email conducteur sans trajet : invite à proposer. */
export const renderDigestConducteurSansTrajet = (
  prenom: string,
  ctx: WeeklyDigestContext,
  verset: Verset,
  appUrl: string,
): { subject: string; html: string } => {
  const subject = `🙏 ${prenom}, la communauté compte sur toi dimanche`;

  const body = `
  <p>
    Tu n'as pas encore proposé de trajet pour ce week-end.
  </p>
  ${statsHtml(ctx)}
  <p>
    Proposer un trajet prend moins de 2 minutes et change le dimanche de plusieurs personnes.
  </p>
  ${btn("Propose ton trajet", `${appUrl}/trajets/nouveau`)}
  ${versetHtml(verset)}`;

  return { subject, html: baseLayout(prenom, body, appUrl) };
};

/** Email conducteur avec trajet actif : remerciement + vérifier les demandes. */
export const renderDigestConducteurAvecTrajet = (
  prenom: string,
  ctx: WeeklyDigestContext,
  verset: Verset,
  appUrl: string,
): { subject: string; html: string } => {
  const subject = `✅ ${prenom}, merci pour ton trajet !`;

  const body = `
  <p>
    Merci d'avoir proposé un trajet vers le programme. La communauté te le rend bien !
  </p>
  ${statsHtml(ctx)}
  <p>
    Pense à vérifier si des passagers ont fait une demande — une réponse rapide, ça compte.
  </p>
  ${btn("Voir les demandes en attente", `${appUrl}/dashboard`)}
  ${versetHtml(verset)}`;

  return { subject, html: baseLayout(prenom, body, appUrl) };
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
