-- Faille trouvee le 07/08/2026 : verifierBadges() (index.html) calculait
-- l'eligibilite a un badge cote client (a partir de `progression`, fiable
-- car ecrite uniquement par les Edge Functions serveur) mais ecrivait
-- ensuite directement dans `badges`. La policy RLS d'alors ne verifiait que
-- l'appartenance de eleve_id, jamais que les vrais criteres (% d'exercices
-- faits, score moyen) etaient remplis -- un eleve authentifie pouvait
-- s'auto-attribuer n'importe quel badge via un simple appel REST direct,
-- sans jamais avoir fait l'exercice. Confirme exploitable avant ce correctif
-- (teste sur un compte jetable : badge "or" obtenu en un seul appel).
--
-- Corrige le 31/10/2026 : l'eligibilite et l'ecriture du badge sont
-- desormais calculees et effectuees uniquement par la nouvelle Edge
-- Function `badges-gerer` (cle service-role, contourne RLS par construction
-- comme le reste des fonctions de ce projet). Le client n'a plus besoin
-- d'ecrire dans `badges` -- seule la lecture de ses propres badges reste
-- necessaire (affichage de l'espace eleve).
--
-- Au passage : la policy `badges_insert` donnait aussi le droit UPDATE via
-- `badges_own` (FOR ALL), jamais utilise legitimement par le client --
-- retire en meme temps par coherence (meme faille potentielle : un eleve
-- aurait pu modifier un badge deja obtenu, ex. changer sa date d'obtention).

revoke insert, update on public.badges from authenticated;

drop policy if exists badges_insert on public.badges;
drop policy if exists badges_own on public.badges;

-- `badges_select` (lecture, deja en place) est conservee telle quelle --
-- un eleve doit toujours pouvoir voir ses propres badges dans son espace.
