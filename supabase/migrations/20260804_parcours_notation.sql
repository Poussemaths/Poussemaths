-- Parcours-Notation : le prof compose une liste figee d'exercices (fixes et/ou
-- generatifs) pour une classe, en mode Entrainement (tentatives illimitees,
-- aucune note remontee) ou Evaluation (une tentative par question, note
-- definitive -- verrou applique cote Edge Function, pas ici en DB, cf.
-- exo-*-valider). Ecriture/lecture prof directe depuis le client (pas de
-- nouvelle Edge Function necessaire), la RLS suffit a garantir qu'un eleve ne
-- peut jamais creer/modifier un parcours.

create table parcours (
  id uuid primary key default gen_random_uuid(),
  prof_id uuid not null,
  code_classe text not null,
  titre text not null,
  mode text not null check (mode in ('entrainement', 'evaluation')),
  niveau text not null,
  exercices jsonb not null,
  temps_limite_min integer,
  date_limite timestamptz,
  created_at timestamptz not null default now()
);

alter table parcours enable row level security;

-- Meme pattern de propriete que classes/eleves/progression (20260722_prof_lecture_classe.sql) :
-- un prof possede un parcours s'il possede la classe visee (classes.prof_id = auth.uid()).
create policy parcours_prof_all on parcours for all
  using (code_classe in (select code from classes where prof_id = auth.uid()))
  with check (prof_id = auth.uid() and code_classe in (select code from classes where prof_id = auth.uid()));

-- Lecture seule pour les eleves de la classe concernee
create policy parcours_eleve_select on parcours for select
  using (code_classe in (select code_classe from eleves where user_id = auth.uid()));

grant select, insert, update, delete on parcours to authenticated;
grant select, insert, update, delete on parcours to service_role;

-- Rattache une ligne de progression a un parcours precis (null = pratique libre,
-- comportement actuel inchange). Le verrou "une tentative en evaluation" est
-- applique par la logique applicative des Edge Functions (Phase 3), pas par une
-- contrainte SQL -- coherent avec le reste de l'anti-triche du projet.
alter table progression add column if not exists parcours_id uuid references parcours(id);
