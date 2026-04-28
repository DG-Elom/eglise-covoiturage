# Tests E2E (Playwright)

Tests end-to-end pour `eglise-covoiturage`. Aucune base Supabase de test n'est requise pour la v1 : les specs couvrent le rendu public et les redirections d'auth.

## Pre-requis

```bash
npm install
npx playwright install chromium
```

Si `playwright install` est trop lent ou bloque (CI restreint, reseau), il peut etre saute en local : les workflows GitHub installent les navigateurs avec `--with-deps`.

## Lancer les tests

### Contre le dev local (par defaut)

```bash
npm run test:e2e
```

`playwright.config.ts` demarre automatiquement `npm run dev -- -p 3201` via `webServer` et reutilise un serveur deja lance en local (`reuseExistingServer: true` hors CI).

### Contre la prod Vercel

```bash
PLAYWRIGHT_BASE_URL=https://eglise-covoiturage.vercel.app npm run test:e2e
```

Quand `PLAYWRIGHT_BASE_URL` ne pointe pas sur `localhost`, le `webServer` est desactive : on tape directement la cible distante.

### Mode UI (debug interactif)

```bash
npm run test:e2e:ui
```

### Voir le dernier rapport HTML

```bash
npm run test:e2e:report
```

## Debug

- `npx playwright test --debug` ouvre l'inspecteur Playwright.
- `npx playwright test tests/e2e/login.spec.ts --headed` lance un seul fichier en mode visible.
- `npx playwright codegen http://localhost:3201` aide a generer des selecteurs.
- Les artefacts (traces, screenshots) sont dans `test-results/` et le rapport HTML dans `playwright-report/`.

## Ajouter un nouveau test

1. Creer un fichier `tests/e2e/<nom>.spec.ts`.
2. Importer `import { expect, test } from "@playwright/test";`.
3. Privilegier les selecteurs accessibles : `getByRole`, `getByLabel`, `getByAltText`. Eviter les CSS fragiles.
4. Ne dependre d'aucun etat Supabase pour l'instant : seules les pages publiques et les redirections d'auth sont testees.
5. Verifier que la spec passe localement et contre Vercel avant de pousser.

## CI

Le workflow `.github/workflows/playwright.yml` s'execute sur chaque pull request et sur `push` vers `main`. Il installe les navigateurs, lance la suite et publie le rapport HTML en artefact si un test echoue. Definir la variable de repo `PLAYWRIGHT_BASE_URL` (Settings -> Variables) pour cibler une URL Vercel preview ; sinon le job demarre `npm run dev` localement via `webServer`.
