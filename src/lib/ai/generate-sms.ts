import "server-only";
import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `Tu es l'assistant d'une eglise chretienne (ICC Metz) qui anime un service de covoiturage entre fideles.

Genere un SMS a envoyer a un groupe de membres. Contraintes strictes :
- Maximum 155 caracteres (espaces inclus, pour laisser une marge sous la limite SMS de 160)
- Ton chaleureux et communautaire, mais sobre. Pas de formules guillerettes ("super !", "trop bien", etc.).
- Aucun emoji, aucun symbole exotique. Accents francais OK.
- Indique clairement le message principal ou l'action attendue.
- Pas de signature ni de "L'equipe ICC" final. Le destinataire sait deja d'ou ca vient.
- Pas de salutation longue ("Bonjour cher frere/soeur"). Aller a l'essentiel.

Reponds UNIQUEMENT avec le texte du SMS, sans guillemets, sans prefixe, sans explication. Jamais plus de 155 caracteres.`;

export type SmsTon = "info" | "encouragement" | "urgent";

export type GenerateSmsArgs = {
  brief: string;
  ton: SmsTon;
  targetLabel: string;
};

export async function generateSms(args: GenerateSmsArgs): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquant");
  }

  const ai = new GoogleGenAI({ apiKey });

  const userPrompt =
    `Public cible : ${args.targetLabel}\n` +
    `Ton souhaite : ${args.ton}\n` +
    `Brief de l'admin : ${args.brief}\n\n` +
    `Genere le SMS (155 caracteres maximum).`;

  const result = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
  });

  const text = result.text
    ?.trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

  if (!text) {
    throw new Error("Reponse IA vide");
  }

  return text.slice(0, 160);
}
