# Rappels J-2h — Déploiement

Système d'envoi automatique d'emails 2h avant chaque trajet, pour le conducteur
et chaque passager dont la réservation est `accepted`. Idempotent grâce à la
table `reminders_log` (un email = une ligne).

## Architecture

1. **`pg_cron`** déclenche la fonction Edge toutes les **15 min**.
2. **`pg_net.http_post`** appelle l'URL `https://<PROJECT_REF>.supabase.co/functions/v1/reminders` avec la `service_role` en `Authorization`.
3. **Edge Function `reminders`** (Deno) :
   - récupère les `trajets_instances` non annulées,
   - calcule `instance_datetime = date + trajet.heure_depart` (Europe/Paris),
   - garde uniquement celles dont le départ est dans la fenêtre `[now+1h45, now+2h15]`,
   - pour chaque instance : envoie 1 email au conducteur + 1 email à chaque passager `accepted`,
   - vérifie `reminders_log` avant envoi, insère après envoi réussi (Resend).
4. **`reminders_log (trajet_instance_id, recipient_id, kind)` UNIQUE** → pas de doublon même si le cron tourne plusieurs fois.

`kind` :
- `reminder_2h_conducteur` pour le conducteur
- `reminder_2h` pour chaque passager

## Fuseau horaire

Le fuseau est piloté par le secret `REMINDERS_TZ` (défaut : `Africa/Abidjan`). La conversion wall-time → UTC utilise `Intl.DateTimeFormat` avec une boucle de convergence sur 2 itérations, ce qui gère correctement les transitions DST. Pour la France :

```bash
supabase secrets set REMINDERS_TZ=Europe/Paris
```

## Prérequis

- Compte **Resend** (https://resend.com) avec un domaine vérifié et une clé API (`re_...`).
- **Supabase CLI** installée localement.
- Accès `service_role` au projet Supabase (Dashboard → Settings → API).

---

## Étapes

### 1. Exécuter la migration SQL

Dans Supabase Dashboard → SQL Editor, copier-coller et exécuter :

```
supabase/migration_v7_reminders.sql
```

Cela crée :
- la table `reminders_log` (+ RLS),
- les extensions `pg_cron` et `pg_net`.

Le bloc `cron.schedule(...)` est **commenté** dans le fichier — on l'exécute à l'étape 6, après le déploiement de la fonction.

### 2. Installer Supabase CLI

```bash
brew install supabase/tap/supabase
```

### 3. Lier le projet local

Depuis la racine du repo :

```bash
supabase link --project-ref ulfpjbhmiddpmsuwpedm
```

(Remplacer `ulfpjbhmiddpmsuwpedm` par votre PROJECT_REF si différent.)

### 4. Configurer les secrets de la fonction

```bash
supabase secrets set RESEND_API_KEY=re_xxx_votre_cle
supabase secrets set REMINDERS_FROM_EMAIL="Covoiturage Église <noreply@votre-domaine.fr>"
```

> `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont **injectés automatiquement** par Supabase dans les Edge Functions — pas besoin de les définir.

L'adresse `from` doit être sur un domaine vérifié dans Resend.

### 5. Déployer la fonction

```bash
supabase functions deploy reminders
```

URL résultante : `https://<PROJECT_REF>.supabase.co/functions/v1/reminders`

### 6. Activer le cron

Dans le SQL Editor, exécuter le bloc suivant **après avoir substitué les deux placeholders** :

```sql
select cron.schedule(
  'reminders-every-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

- `<PROJECT_REF>` → ex `ulfpjbhmiddpmsuwpedm`
- `<SERVICE_ROLE_KEY>` → Dashboard → Settings → API → `service_role` (clé qui commence par `eyJ...`).

> ⚠️ La clé service_role est en clair dans le job cron. C'est admissible car la table `cron.job` est en `pg_catalog`, accessible au seul rôle `postgres`.

Vérifier le job :

```sql
select * from cron.job where jobname = 'reminders-every-15min';
select * from cron.job_run_details order by start_time desc limit 5;
```

---

## Test manuel

```bash
curl -i -X POST \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://<PROJECT_REF>.supabase.co/functions/v1/reminders
```

Réponse attendue :

```json
{ "sent": 0, "skipped": 0, "errors": 0 }
```

Pour forcer un envoi de test, créer un `trajets_instances` dont la `date` + `heure_depart` tombe dans ~2h, plus une `reservations.statut = 'accepted'`, puis relancer le `curl`.

## Observabilité

```sql
-- Derniers rappels envoyés
select rl.*, p.prenom, p.nom
from reminders_log rl
join profiles p on p.id = rl.recipient_id
order by sent_at desc
limit 50;

-- Logs de la fonction Edge
-- Dashboard → Edge Functions → reminders → Logs
```

## Désactiver

```sql
select cron.unschedule('reminders-every-15min');
```

```bash
supabase functions delete reminders
```

## Troubleshooting

- **`{ "error": "RESEND_API_KEY missing" }`** → relancer `supabase secrets set RESEND_API_KEY=...`, puis `supabase functions deploy reminders` (les secrets ne sont pas hot-reload).
- **`Resend error 403`** → domaine non vérifié dans Resend, ou `from` ne correspond pas à un domaine vérifié.
- **`{ "sent": 0 }` alors qu'un trajet est prévu dans 2h** → vérifier `trajets.heure_depart` non null, `trajets_instances.annule_par_conducteur = false`, et que la date est calculée correctement (caveat fuseau ci-dessus).
- **Doublons d'emails** → ne devrait pas arriver grâce à `reminders_log` UNIQUE ; vérifier que la fonction insère bien après chaque envoi (table consultable via SQL).
- **Cron qui ne se déclenche pas** → `select * from cron.job_run_details order by start_time desc limit 10;` pour voir les erreurs `pg_net`.
