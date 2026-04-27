# Covoiturage Église

App web responsive pour le covoiturage entre fidèles d'une église locale.

## Stack

- **Next.js 16** (App Router) + TypeScript strict + Tailwind 4
- **Supabase** : Auth (Google + magic link), Postgres + PostGIS, RLS, Storage
- **Mapbox GL** : carte, géocodage, optimisation d'itinéraire
- **TanStack Query** + **Zustand** : state
- **Sonner** : toasts
- **Anthropic Claude** : IA (parsing langage naturel, modération, insights)
- **Resend** : emails

## Démarrage

1. Copier les variables d'environnement :
   ```bash
   cp .env.example .env.local
   ```
2. Renseigner les clés Supabase, Mapbox, Anthropic, Resend.
3. Exécuter le SQL dans `supabase/schema.sql` dans le SQL Editor de Supabase.
4. Activer Google OAuth dans Supabase → Authentication → Providers.
5. Lancer le dev :
   ```bash
   npm run dev
   ```

## Structure

```
src/
├── app/
│   ├── login/               # Connexion Google + magic link
│   ├── auth/callback/       # Callback OAuth/magic link
│   ├── dashboard/           # Espace utilisateur connecté
│   ├── layout.tsx           # Layout racine + providers
│   └── page.tsx             # Landing
├── components/
│   ├── map.tsx              # Composant carte Mapbox
│   └── query-provider.tsx   # TanStack Query
├── lib/
│   ├── supabase/            # Clients browser, server, middleware, types
│   ├── navigation.ts        # Liens vers Google Maps / Apple Plans / Waze
│   └── utils.ts             # cn() helper
└── middleware.ts            # Auth + redirections
```

## Prochaines étapes

- [ ] Onboarding profil (charte, photo, voiture si conducteur)
- [ ] Déclaration d'un trajet (formulaire + carte + parsing IA)
- [ ] Recherche de trajets compatibles (PostGIS)
- [ ] Demande/acceptation de réservation
- [ ] Messagerie interne
- [ ] Notifications email + push PWA
- [ ] Dashboard admin
