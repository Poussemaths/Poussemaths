-- Inscription des eleves par le prof (07/08/2026) : un eleve cree en masse
-- par le prof n'a pas de vrai email -- il se connecte avec un identifiant
-- court (prenom.nom normalise, sans accent) au lieu d'une adresse email.
-- L'identifiant est stocke ici pour permettre une verification d'unicite
-- simple (le prof colle 28 noms, il faut detecter les doublons avant meme
-- de creer les comptes) ; le compte Supabase Auth sous-jacent utilise en
-- interne un faux email `${identifiant}@poussemaths.fr`, jamais visible
-- par l'eleve. Nullable : les eleves inscrits via le code de classe
-- (parcours existant, avec un vrai email) n'en ont pas besoin.

alter table eleves add column if not exists identifiant text unique;
