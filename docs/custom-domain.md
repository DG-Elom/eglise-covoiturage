# Configurer un domaine custom

L'app tourne actuellement sur `eglise-covoiturage.vercel.app`. Pour un domaine pro
type `covoit-paroisse.fr`, suit ces étapes.

## 1. Acheter un domaine
~10€/an. Registrars recommandés :
- **OVH** : populaire en France, interface en français
- **Gandi** : éthique, support FR
- **Namecheap** / **Porkbun** : moins cher, anglais

Suggestions de noms (à vérifier dispo) :
- `covoit-{nom-paroisse}.fr`
- `covoit-eglise.fr`
- `eglise-covoit.com`
- `{nom-paroisse}.app`

## 2. Ajouter le domaine dans Vercel

1. Vercel → projet `eglise-covoiturage` → **Settings → Domains**
2. **Add Domain** → entre ton domaine (ex: `covoit-paroisse.fr`)
3. Vercel propose 2 options :

### Option A — Vercel gère les DNS (le plus simple)
- Change les **nameservers** de ton domaine chez le registrar pour pointer vers Vercel :
  ```
  ns1.vercel-dns.com
  ns2.vercel-dns.com
  ```
- Propagation : 1-24h
- Vercel gère TOUT (A records, AAAA, etc.)

### Option B — Garde tes nameservers actuels
Vercel te dit d'ajouter ces records chez ton registrar :
- **A record** : `@` → `76.76.21.21`
- **CNAME** : `www` → `cname.vercel-dns.com`

Propagation : 5 min – 24h.

## 3. Mettre à jour les redirections OAuth

⚠️ Une fois le domaine actif, tu dois mettre à jour :

### Supabase
**Authentication → URL Configuration** :
- **Site URL** : `https://covoit-paroisse.fr`
- Ajouter dans **Redirect URLs** : `https://covoit-paroisse.fr/**`

### Google OAuth
**Google Cloud Console → APIs & Services → Credentials → ton OAuth Client** :
- L'URI de callback (`https://...supabase.co/auth/v1/callback`) reste **inchangée** — pas besoin d'y toucher.

### App
Ajouter dans Vercel env vars (si tu utilises `NEXT_PUBLIC_APP_URL` quelque part) :
```
NEXT_PUBLIC_APP_URL=https://covoit-paroisse.fr
```

Et redéployer.

## 4. HTTPS automatique
Vercel génère un certificat SSL Let's Encrypt **gratuitement** dès que le domaine est validé. Aucune action.

## 5. Email pro (optionnel mais recommandé)

Si tu fais l'effort d'un domaine, autant en profiter pour les emails :
- Voir [`docs/email-domain.md`](./email-domain.md) — vérifier le domaine dans Resend pour envoyer depuis `hello@covoit-paroisse.fr` au lieu de `onboarding@resend.dev`.
- Tu peux aussi recevoir des emails sur ce domaine via OVH / Gandi mail (5€/mois) ou un service gratuit type ImprovMX (forward).

## ✅ Checklist finale

- [ ] Domaine acheté
- [ ] Domaine ajouté dans Vercel + DNS configurés
- [ ] HTTPS validé (Vercel affiche un cadenas vert)
- [ ] Site URL Supabase mis à jour
- [ ] Redirect URLs Supabase mis à jour
- [ ] Test login via le nouveau domaine
- [ ] (Optionnel) `RESEND_FROM_EMAIL` mis à jour avec le nouveau domaine
- [ ] (Optionnel) `NEXT_PUBLIC_APP_URL` ajouté dans Vercel
