-- Verrou/deverrou de chapitres par classe (28/10/2026) : un prof peut
-- restreindre ce qu'une classe voit sur la page Exercices a un sous-ensemble
-- des chapitres de son niveau (ex: ne pas montrer "Racines carrees" tant que
-- la notion n'a pas ete vue en cours). Repond au probleme vecu lors du test
-- reel en classe ou un eleve tombait sur une notion pas encore enseignee.
--
-- NULL (valeur par defaut) = tous les chapitres du niveau sont visibles,
-- comportement strictement identique a aujourd'hui pour toute classe
-- existante et pour tout eleve non rattache a une classe (inscription libre,
-- etablissement non abonne) -- rien ne doit changer pour eux.

alter table classes add column if not exists chapitres_actifs jsonb;

comment on column classes.chapitres_actifs is
  'Liste des noms de chapitres visibles par les eleves de cette classe sur la page Exercices. NULL = tous les chapitres du niveau sont visibles (comportement par defaut).';
