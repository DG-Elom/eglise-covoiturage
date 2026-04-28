# Push notifications — Setup

## 1. Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
```

Affiche un couple `Public Key` / `Private Key`.

## 2. Variables d'environnement

Ajouter sur Vercel (Project Settings → Environment Variables) **et** dans `.env.local` :

| Nom | Valeur | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | la public key générée | Production, Preview, Development |
| `VAPID_PUBLIC_KEY` | la même public key | idem |
| `VAPID_PRIVATE_KEY` | la private key générée | idem |

> `NEXT_PUBLIC_VAPID_PUBLIC_KEY` est utilisé côté client pour s'abonner. `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` sont utilisés côté serveur (`src/lib/push.ts`).

Si les clés ne sont pas définies :
- `/api/push/subscribe` retourne `503 push_disabled`
- `sendPushTo` est un no-op (les emails partent toujours)

## 3. Migration Supabase

Exécuter `supabase/migration_v8_push.sql` dans le SQL Editor.

## 4. Intégration UI

Dans `src/app/layout.tsx`, à l'intérieur du provider client, ajouter :

```tsx
import { SwRegister } from "@/components/sw-register";
import { PushSubscribe } from "@/components/push-subscribe";

// quelque part dans le layout (header, à côté de <ThemeToggle />)
<SwRegister />
<PushSubscribe />
```

`<SwRegister />` est invisible (il enregistre `/sw.js` au montage). `<PushSubscribe />` affiche un bouton "Activer les notifications" / "Désactiver".

## 5. Tester

1. `npm run dev`
2. Ouvrir l'app, se connecter
3. Cliquer sur "Activer les notifications" → autoriser dans le navigateur
4. Déclencher un email (réservation créée / acceptée / refusée) → la push arrive sur le device
