-- v38: table bug_reports pour les remontées de bugs utilisateur
create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null references profiles(id) on delete cascade,
  description text not null,
  categorie text not null default 'autre'
    check (categorie in ('crash','affichage','fonctionnalite','performance','autre')),
  page_url text,
  user_agent text,
  statut text not null default 'ouvert'
    check (statut in ('ouvert','en_cours','resolu','ferme')),
  note_admin text,
  created_at timestamptz not null default now()
);

create index idx_bug_reports_auteur on bug_reports(auteur_id);
create index idx_bug_reports_statut on bug_reports(statut);
create index idx_bug_reports_created_at on bug_reports(created_at desc);

alter table bug_reports enable row level security;

create policy "users insert own bug reports"
  on bug_reports for insert
  with check (auth.uid() = auteur_id);

create policy "users select own or admin all"
  on bug_reports for select
  using (auth.uid() = auteur_id or is_admin());

create policy "admin update bug reports"
  on bug_reports for update
  using (is_admin());
