type ReservationEmailData = {
  passagerPrenom: string;
  passagerNom: string;
  conducteurPrenom: string;
  conducteurNom: string;
  conducteurTelephone?: string;
  voitureModele?: string | null;
  voitureCouleur?: string | null;
  programmeLibelle: string;
  date: string;
  heure: string;
  sens: "aller" | "retour";
  pickupAdresse: string;
  departAdresse: string;
  appUrl: string;
};

const SENS_LABEL = { aller: "Aller", retour: "Retour" } as const;

function shell(title: string, content: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:24px;margin:0;color:#0f172a;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
<div style="padding:24px 24px 16px;">
<div style="font-size:13px;color:#64748b;margin-bottom:4px;">Covoiturage Église</div>
<h1 style="margin:0;font-size:20px;">${title}</h1>
</div>
<div style="padding:0 24px 24px;font-size:14px;line-height:1.6;">
${content}
</div>
</div>
<p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">Cet email t'est envoyé par Covoiturage Église.</p>
</body></html>`;
}

function infoBox(rows: Array<[string, string]>) {
  return `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;margin:16px 0;">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:8px 12px;color:#64748b;width:140px;">${k}</td><td style="padding:8px 12px;font-weight:500;">${v}</td></tr>`,
  )
  .join("")}
</table>`;
}

function btn(href: string, label: string) {
  return `<p style="margin:20px 0 0;"><a href="${href}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:500;">${label}</a></p>`;
}

export function emailNouvelleReservation(d: ReservationEmailData) {
  const subject = `Nouvelle demande de ${d.passagerPrenom}`;
  const html = shell(
    "Nouvelle demande de covoiturage",
    `<p>Bonjour ${d.conducteurPrenom},</p>
<p><strong>${d.passagerPrenom} ${d.passagerNom}</strong> souhaite rejoindre ton trajet :</p>
${infoBox([
  ["Programme", d.programmeLibelle],
  ["Date", `${d.date} · ${d.heure}`],
  ["Sens", SENS_LABEL[d.sens]],
  ["Pickup", d.pickupAdresse],
])}
<p>Connecte-toi pour accepter ou refuser la demande.</p>
${btn(`${d.appUrl}/dashboard`, "Voir la demande")}`,
  );
  return { subject, html };
}

export function emailReservationAcceptee(d: ReservationEmailData) {
  const subject = `${d.conducteurPrenom} t'emmène`;
  const voiture = d.voitureModele
    ? `${d.voitureModele}${d.voitureCouleur ? ` · ${d.voitureCouleur}` : ""}`
    : "—";
  const html = shell(
    "Ta demande est acceptée 🎉",
    `<p>Bonjour ${d.passagerPrenom},</p>
<p>Bonne nouvelle : <strong>${d.conducteurPrenom} ${d.conducteurNom}</strong> t'emmène !</p>
${infoBox([
  ["Programme", d.programmeLibelle],
  ["Date", `${d.date} · ${d.heure}`],
  ["Sens", SENS_LABEL[d.sens]],
  ["Conducteur", `${d.conducteurPrenom} ${d.conducteurNom}`],
  ["Téléphone", d.conducteurTelephone ?? "—"],
  ["Voiture", voiture],
  ["Pickup", d.pickupAdresse],
])}
${btn(`${d.appUrl}/dashboard`, "Voir le détail")}`,
  );
  return { subject, html };
}

export function emailReservationRefusee(d: ReservationEmailData) {
  const subject = `Demande non retenue`;
  const html = shell(
    "Demande non retenue",
    `<p>Bonjour ${d.passagerPrenom},</p>
<p>${d.conducteurPrenom} ${d.conducteurNom} ne peut pas t'emmener pour le ${d.date}.</p>
<p>Tu peux essayer un autre conducteur sur le même créneau.</p>
${btn(`${d.appUrl}/trajets/recherche`, "Chercher un autre trajet")}`,
  );
  return { subject, html };
}

export function emailTrajetAnnuleParConducteur(d: ReservationEmailData) {
  const subject = `Trajet annulé pour le ${d.date}`;
  const html = shell(
    "Le conducteur a annulé",
    `<p>Bonjour ${d.passagerPrenom},</p>
<p><strong>${d.conducteurPrenom} ${d.conducteurNom}</strong> ne peut finalement pas conduire le ${d.date}.</p>
${infoBox([
  ["Programme", d.programmeLibelle],
  ["Date", `${d.date} · ${d.heure}`],
  ["Sens", SENS_LABEL[d.sens]],
])}
<p>Tu peux chercher un autre conducteur sur le même créneau.</p>
${btn(`${d.appUrl}/trajets/recherche`, "Chercher un autre trajet")}`,
  );
  return { subject, html };
}
