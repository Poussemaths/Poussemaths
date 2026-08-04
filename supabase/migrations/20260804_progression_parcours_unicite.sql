-- Corrige un trou trouve en construisant le verrou "une tentative" du mode
-- Evaluation (Phase 3 Parcours-Notation) : la contrainte UNIQUE(eleve_id,
-- exercice_id) n'autorise qu'UNE seule ligne de progression par exercice, quel
-- que soit le contexte. Un exercice deja fait en pratique libre partage
-- EXACTEMENT le meme exercice_id (ou template_id pour les generatifs) qu'un
-- exercice identique assigne dans un parcours -- sans ce correctif, une
-- pratique libre posterieure a une Evaluation ecraserait silencieusement la
-- note d'evaluation deja enregistree, ce qui viole la garantie de "note
-- definitive" du cahier des charges.
--
-- Fix : ajoute une colonne generee parcours_key (uuid non-null, coalesce de
-- parcours_id vers un UUID zero sentinelle) et deplace l'unicite dessus.
-- Comportement inchange pour la pratique libre (parcours_id toujours null =
-- toujours la meme parcours_key = toujours UNE seule ligne par exercice,
-- upsert-merge comme avant). Une tentative liee a un parcours precis vit
-- desormais dans SA PROPRE ligne, jamais en collision avec la pratique libre
-- ni avec un autre parcours utilisant le meme exercice.

alter table progression drop constraint progression_eleve_id_exercice_id_key;

alter table progression
  add column parcours_key uuid generated always as (coalesce(parcours_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored;

alter table progression
  add constraint progression_eleve_exercice_parcours_key unique (eleve_id, exercice_id, parcours_key);
