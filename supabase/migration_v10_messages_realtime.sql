-- Migration v10 : activer Supabase Realtime sur messages
-- Permet la souscription postgres_changes côté client
-- pour le chat in-app entre conducteur et passager.

alter publication supabase_realtime add table messages;
