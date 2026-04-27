import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Covoiturage Église <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY non configuré, email ignoré:", subject);
    return { skipped: true };
  }
  const { error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  if (error) {
    console.error("[email] erreur envoi:", error);
    return { error };
  }
  return { ok: true };
}
