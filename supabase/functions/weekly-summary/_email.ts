// Email helpers pour le résumé hebdomadaire — Deno-compatible

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export interface WeeklySummaryEmailData {
  semaineDu: string; // ex: "21/04"
  trajetsEffectues: number;
  passagersTransportes: number;
  nouveauxInscrits: number;
  messagesEchanges: number;
  kmCumules: number;
  co2EconomiseKg: number;
  messageCommunaute: string;
}

export const renderWeeklySummaryEmail = (
  data: WeeklySummaryEmailData,
): { subject: string; html: string } => {
  const subject = `📊 Carrefour ICC — semaine du ${data.semaineDu}`;

  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;line-height:1.6;color:#222;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a56db;">📊 Résumé de la semaine — ICC Metz</h2>
  <p style="color:#555;">Semaine du ${escapeHtml(data.semaineDu)}</p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr style="background:#f3f4f6;">
      <td style="padding:8px 12px;font-weight:bold;">Trajets effectués</td>
      <td style="padding:8px 12px;text-align:right;">${data.trajetsEffectues}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:bold;">Passagers transportés</td>
      <td style="padding:8px 12px;text-align:right;">${data.passagersTransportes}</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px 12px;font-weight:bold;">Nouveaux inscrits</td>
      <td style="padding:8px 12px;text-align:right;">${data.nouveauxInscrits}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:bold;">Messages échangés</td>
      <td style="padding:8px 12px;text-align:right;">${data.messagesEchanges}</td>
    </tr>
    <tr style="background:#f3f4f6;">
      <td style="padding:8px 12px;font-weight:bold;">Km cumulés estimés</td>
      <td style="padding:8px 12px;text-align:right;">${data.kmCumules} km</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:bold;">CO₂ économisé estimé</td>
      <td style="padding:8px 12px;text-align:right;">${data.co2EconomiseKg} kg</td>
    </tr>
  </table>

  <div style="background:#eff6ff;border-left:4px solid #1a56db;padding:16px;margin:16px 0;border-radius:4px;">
    <p style="margin:0;white-space:pre-wrap;">${escapeHtml(data.messageCommunaute)}</p>
  </div>

  <p style="color:#888;font-size:12px;margin-top:32px;">
    Ce message est généré automatiquement par l'application de covoiturage ICC Metz.
  </p>
</body>
</html>`;

  return { subject, html };
};

export const sendResend = async (
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
};
