/**
 * E2E — Parcours réservation complet
 *
 * Prérequis : Supabase local UP + seed appliqué (`supabase db reset`).
 * - passager : passager.e2e@test.local (UUID a0000000-...)
 * - conducteur : conducteur.e2e@test.local (UUID b0000000-...)
 * - trajet seeded : UUID c0000000-... (dimanche, Metz aller, 3 places, rayon 5 km)
 * - instance : UUID f0000000-... (prochain dimanche + 7 jours)
 *
 * Flow :
 *   /login → OTP → Mailpit → callback → /trajets/recherche → réservation
 */

import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const MAILPIT_URL = "http://127.0.0.1:54324";

const PASSAGER_EMAIL = "passager.e2e@test.local";
const PASSAGER_UUID = "a0000000-0000-0000-0000-000000000001";
const INSTANCE_UUID = "f0000000-0000-0000-0000-000000000006";

/** Récupère la date de l'instance seedée via l'API REST Supabase */
async function getInstanceDate(): Promise<string> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trajets_instances?id=eq.${INSTANCE_UUID}&select=date`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  const data = (await res.json()) as { date: string }[];
  if (!data.length) throw new Error("Instance seedée introuvable — relancer `supabase db reset`");
  return data[0].date; // e.g. "2026-06-07"
}

/** Purge la boîte Mailpit pour ne pas avoir de résidus entre tests */
async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" }).catch(() => {
    // non-bloquant
  });
}

/** Récupère le dernier magic link dans Mailpit pour l'email passager */
async function getMagicLinkFromMailpit(timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const data = (await res.json()) as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    const msg = data.messages.find((m) =>
      m.To.some((t) => t.Address === PASSAGER_EMAIL),
    );
    if (msg) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`);
      const body = (await detail.json()) as { Text: string };
      const match = body.Text.match(/https?:\/\/[^\s\)]+verify[^\s\)]+/);
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Magic link non reçu dans Mailpit sous " + timeoutMs + "ms");
}

test.describe("Parcours réservation", () => {
  test.beforeEach(async () => {
    await clearMailpit();
  });

  test("login OTP → recherche trajet → réservation → confirmation", async ({ page }) => {
    // ── Phase 1 : récupère la date de l'instance en DB ────────────────────────
    const instanceDate = await getInstanceDate();
    // Format : "YYYY-MM-DD" → on extrait le jour_semaine pour trouver la bonne
    // date dans le sélecteur radios (ou on utilise l'input date)

    // ── Phase 2 : login via OTP ──────────────────────────────────────────────
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Covoiturage ICC Metz/i })).toBeVisible();

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(PASSAGER_EMAIL);

    const submitBtn = page.getByRole("button", { name: /recevoir un lien/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Attendre le feedback toast "Lien de connexion envoyé"
    await expect(page.getByText(/lien de connexion envoyé/i)).toBeVisible({ timeout: 10_000 });

    // ── Phase 3 : récupère le magic link depuis Mailpit ──────────────────────
    const rawMagicLink = await getMagicLinkFromMailpit(15_000);

    // Le lien pointe sur 127.0.0.1:54321/auth/v1/verify?...&redirect_to=http://localhost:3201/auth/callback
    // On navigue directement, le serveur auth redirigera vers /auth/callback?code=...
    // qui échangera le code contre une session.
    await page.goto(rawMagicLink);

    // Après redirect_to → /auth/callback → /dashboard
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

    // Le profil est seeded complet → doit atterrir sur /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });

    // ── Phase 4 : navigation vers la recherche ────────────────────────────────
    await page.goto("/trajets/recherche");
    await expect(page.getByRole("heading", { name: /Trouver un trajet/i })).toBeVisible({ timeout: 10_000 });

    // ── Phase 5 : sélection du culte ─────────────────────────────────────────
    // Le culte seeded s'appelle "Culte du dimanche"
    const cultLabel = page.getByText("Culte du dimanche");
    await expect(cultLabel).toBeVisible({ timeout: 5_000 });
    await cultLabel.click();

    // ── Phase 6 : sélection du sens (aller est déjà sélectionné par défaut) ──
    const allerLabel = page.getByText("Aller").first();
    await allerLabel.click();

    // ── Phase 7 : sélection de la date via l'input date ──────────────────────
    // On utilise l'input type="date" (champ "Ou choisis une autre date")
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(instanceDate);

    // ── Phase 8 : adresse de départ via l'autocomplete (Mapbox mocké) ───────
    // Le mock intercepte TOUTES les requêtes vers api.mapbox.com (geocoding)
    // et renvoie une réponse déterministe avec des coordonnées proches du trajet
    // seeded (6.1760, 49.1180 — rayon 5 km) pour que trajets_compatibles matche.
    // Cela élimine la dépendance au token Mapbox réel et au réseau externe.
    await page.route("**/api.mapbox.com/**", (route) => {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              id: "place.mock-metz",
              type: "Feature",
              place_name: "Rue Serpenoise, 57000 Metz, France",
              center: [6.1762, 49.1182],
              geometry: { type: "Point", coordinates: [6.1762, 49.1182] },
            },
          ],
        }),
      });
    });

    const addressInput = page.getByPlaceholder("Saisis ton adresse de domicile");
    await addressInput.fill("Rue Serpenoise Metz");

    // Attendre l'apparition de la liste de suggestions (ul.absolute avec li>button)
    const suggestionsList = page.locator("ul.absolute");
    await expect(suggestionsList).toBeVisible({ timeout: 10_000 });

    // Cliquer sur la première suggestion disponible
    const firstSuggestionBtn = suggestionsList.locator("li > button").first();
    await expect(firstSuggestionBtn).toBeVisible({ timeout: 5_000 });
    await firstSuggestionBtn.click();

    // ── Phase 9 : lancer la recherche ────────────────────────────────────────
    const searchBtn = page.getByRole("button", { name: /rechercher/i });
    await searchBtn.click();

    // Attendre les résultats (le trajet seeded doit apparaître)
    await expect(page.getByText("TestConducteur")).toBeVisible({ timeout: 15_000 });

    // ── Phase 10 : réserver le trajet ────────────────────────────────────────
    const demanderBtn = page.getByRole("button", { name: /demander/i }).first();
    await expect(demanderBtn).toBeVisible();
    await demanderBtn.click();

    // ── Phase 11 : assertion — toast de confirmation + redirect ──────────────
    // L'app affiche "Demande envoyée !" et redirige vers /dashboard
    await expect(page.getByText(/demande envoyée/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // ── Phase 12 : vérification DB — réservation en statut pending ───────────
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reservations?passager_id=eq.${PASSAGER_UUID}&select=id,statut,trajet_instance_id`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    const reservations = (await dbRes.json()) as { id: string; statut: string; trajet_instance_id: string }[];
    const resa = reservations.find((r) => r.trajet_instance_id === INSTANCE_UUID);
    expect(resa, "Réservation pending introuvable en DB").toBeDefined();
    expect(resa!.statut).toBe("pending");
  });
});
