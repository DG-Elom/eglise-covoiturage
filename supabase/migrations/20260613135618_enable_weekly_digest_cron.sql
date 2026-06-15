-- Active le cron du digest hebdomadaire weekly-digest.
-- Jeudi 16h00 UTC (~18h Paris été). Bearer = clé anon (publique, passe verify_jwt).
-- Idempotent : cron.schedule remplace le job s'il existe déjà (clé = jobname).
select cron.schedule(
  'weekly-digest-thursday',
  '0 16 * * 4',
  $$
  select net.http_post(
    url := 'https://ulfpjbhmiddpmsuwpedm.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZnBqYmhtaWRkcG1zdXdwZWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDI3ODIsImV4cCI6MjA5Mjg3ODc4Mn0.MgTEJLU5qyKr2x7OW675WWZlbw5LTqTvdXPLwYgvenA', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
