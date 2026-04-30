// Email helpers — Deno-compatible (Supabase Edge Functions runtime)
// Pas de dépendance npm/React Email : strings HTML simples.

export interface Verset {
  reference: string;
  texte: string;
}

export interface ConducteurEmailData {
  prenom: string;
  programme: string;
  date: string; // YYYY-MM-DD ou format affichable
  heureDepart: string; // HH:MM
  passagers: Array<{
    prenom: string;
    nom: string;
    pickupAdresse: string;
    telephone: string;
  }>;
}

export interface PassagerEmailData {
  prenom: string;
  conducteurPrenom: string;
  conducteurNom: string;
  programme: string;
  date: string;
  heureDepart: string;
  pickupAdresse: string;
  voitureModele: string | null;
  voitureCouleur: string | null;
  conducteurTelephone: string;
}

export interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const versetHtml = (v: Verset): string =>
  `<div style="margin-top:24px; padding:16px; background:#f0fdf4; border-left:4px solid #10b981; border-radius:8px;">
  <p style="margin:0; font-style:italic; color:#065f46; font-size:14px;">&laquo;&nbsp;${escapeHtml(v.texte)}&nbsp;&raquo;</p>
  <p style="margin:6px 0 0 0; font-weight:600; color:#047857; font-size:12px;">— ${escapeHtml(v.reference)}</p>
</div>`;

export const renderConducteurEmail = (
  data: ConducteurEmailData,
  verset: Verset,
): { subject: string; html: string } => {
  const subject = "Trajet dans 2h";
  const passagersList =
    data.passagers.length === 0
      ? "<li>Aucun passager accepté pour le moment.</li>"
      : data.passagers
          .map(
            (p) =>
              `<li><strong>${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</strong> — Pickup : ${escapeHtml(
                p.pickupAdresse,
              )} — Tél : ${escapeHtml(p.telephone)}</li>`,
          )
          .join("");

  const html = `<!doctype html>
<html lang="fr"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222;">
  <h2>Bonjour ${escapeHtml(data.prenom)},</h2>
  <p>Tu conduis dans environ <strong>2h</strong> pour <strong>${escapeHtml(data.programme)}</strong> le ${escapeHtml(
    data.date,
  )} (départ prévu à ${escapeHtml(data.heureDepart)}).</p>
  <p><strong>${data.passagers.length} passager(s)</strong> à récupérer :</p>
  <ul>${passagersList}</ul>
  <p>Merci pour ton service. Bonne route !</p>
  ${versetHtml(verset)}
</body></html>`;

  return { subject, html };
};

export const renderPassagerEmail = (
  data: PassagerEmailData,
  verset: Verset,
): { subject: string; html: string } => {
  const subject = "Trajet dans 2h";
  const voiture =
    data.voitureModele || data.voitureCouleur
      ? `${escapeHtml(data.voitureModele ?? "")} ${escapeHtml(data.voitureCouleur ?? "")}`.trim()
      : "non renseignée";

  const html = `<!doctype html>
<html lang="fr"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222;">
  <h2>Bonjour ${escapeHtml(data.prenom)},</h2>
  <p><strong>${escapeHtml(data.conducteurPrenom)} ${escapeHtml(
    data.conducteurNom,
  )}</strong> t'emmène dans environ <strong>2h</strong> pour <strong>${escapeHtml(
    data.programme,
  )}</strong> le ${escapeHtml(data.date)} (départ prévu à ${escapeHtml(data.heureDepart)}).</p>
  <ul>
    <li><strong>Pickup :</strong> ${escapeHtml(data.pickupAdresse)}</li>
    <li><strong>Voiture :</strong> ${voiture}</li>
    <li><strong>Téléphone conducteur :</strong> ${escapeHtml(data.conducteurTelephone)}</li>
  </ul>
  <p>Sois prêt(e) 5 minutes avant. Bon culte !</p>
  ${versetHtml(verset)}
</body></html>`;

  return { subject, html };
};

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
