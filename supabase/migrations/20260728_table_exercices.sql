-- Table exercices : prepare la migration hors du JS inline (index.html grossit
-- a chaque session, ne scale pas a plusieurs milliers d'exercices/etablissements).
-- Purement additif : rien ne lit encore cette table cote client, aucun risque
-- sur le site en prod tant que la Phase 2 (moteur de rendu) n'est pas faite.
--
-- "difficulte" (Facile/Moyen/Difficile) est volontairement renomme (pas "niveau")
-- pour eviter la collision de nom deja presente dans le JS actuel, ou "niveau"
-- designe tantot le niveau scolaire (cle du dict EXERCICES) tantot la difficulte
-- (champ de l'exercice) selon le contexte.

create table if not exists exercices (
  id text primary key,
  niveau_scolaire text not null,
  chapitre text not null,
  ordre_chapitre integer not null default 0,
  ordre_exercice integer not null default 0,
  titre text not null,
  difficulte text,
  points_total integer not null,
  questions jsonb not null,
  indices jsonb,
  genere boolean not null default false,
  template_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_exercices_niveau_chapitre on exercices(niveau_scolaire, chapitre);

alter table exercices enable row level security;

-- Contenu pedagogique, pas sensible : deja expose integralement dans le HTML
-- public actuel (JS inline). Lecture publique, aucune ecriture cote client
-- (les mises a jour de contenu se font via l'API Management/SQL Editor).
create policy "Lecture publique des exercices" on exercices
  for select using (true);
