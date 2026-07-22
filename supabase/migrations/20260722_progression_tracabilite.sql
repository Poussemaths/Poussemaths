-- Tracabilite des exercices generes : jusqu'ici seul le score etait enregistre,
-- impossible pour un prof/parent de voir quel enonce a ete pose et ce que
-- l'eleve a repondu. Colonnes nullables : retro-compatible avec les lignes
-- existantes et avec les exercices fixes (client-scores, ne les renseignent pas).

alter table progression
  add column if not exists enonce text,
  add column if not exists reponse_donnee text,
  add column if not exists reponse_attendue text;
