# Configurer un domaine email pour Resend

En mode test, Resend n'envoie qu'à l'email du compte propriétaire (`elom.gnaglo@gmail.com`).
Pour envoyer aux autres fidèles, il faut **vérifier un domaine** auprès de Resend.

## Étapes

### 1. Acheter un domaine
~10€/an chez OVH, Gandi, Namecheap, etc. Suggestions :
- `covoiturage-eglise.fr`
- `covoiturage-{nom-paroisse}.fr`
- `{nom-paroisse}-covoit.fr`

### 2. Ajouter le domaine dans Resend
1. https://resend.com/domains → **Add Domain**
2. Saisir le domaine (sans `www.` ni `https://`)
3. Région : **EU (Frankfurt)** pour cohérence avec Supabase EU

### 3. Ajouter les DNS records
Resend affiche 3-4 records à créer chez le registrar du domaine :

| Type | Name | Value |
|---|---|---|
| MX | `send` | feedback-smtp.eu-west-1.amazonses.com (priorité 10) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | (clé DKIM longue, fournie par Resend) |
| TXT | `_dmarc` | `v=DMARC1; p=none;` (optionnel mais recommandé) |

Une fois ajoutés, clique **Verify** dans Resend. Propagation DNS : 5 min – 24h.

### 4. Mettre à jour Vercel
Ajouter une nouvelle env var dans Vercel → **Settings → Environment Variables** :

```
RESEND_FROM_EMAIL=Covoiturage Église <hello@covoiturage-eglise.fr>
```

(L'app lit cette variable dans `src/lib/email/send.ts`. Si non définie, fallback à `onboarding@resend.dev` mode test.)

### 5. Redéployer
Vercel → **Deployments** → 3 points sur le dernier deployment → **Redeploy**.
Le redéploiement applique la nouvelle env var.

## Vérification

Après redéploiement, demande à un autre fidèle (autre email) de :
1. Créer un compte
2. Faire une demande de trajet sur ton trajet

Tu (le conducteur) reçois l'email comme avant. Quand tu acceptes, **lui** doit recevoir un email de confirmation. Avant la vérification de domaine, il ne recevait rien.

## Alternative gratuite (rapide mais moins propre)

Tu peux utiliser un sous-domaine d'un domaine que tu possèdes déjà.
Exemple : si tu as `monsite.fr`, tu peux ajouter `mail.monsite.fr` dans Resend.
Pas besoin de racheter — juste ajouter les DNS records sur le sous-domaine.

## Limites Resend

- **Free tier** : 3 000 emails/mois, 100/jour
- **Pro** : 50 000 emails/mois (~20$/mois) — pas nécessaire au début
- Pour une église de 300-1000 fidèles avec ~10 emails/jour (notifs trajets), le free tier est largement suffisant.
