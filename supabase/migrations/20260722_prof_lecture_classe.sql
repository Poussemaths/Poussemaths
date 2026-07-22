-- Autorise un prof a lire les eleves et la progression des eleves de SES classes
-- (jusqu'ici RLS ne permettait qu'a un eleve de lire ses propres donnees, donc le
-- dashboard prof ne peut recevoir aucune ligne meme quand il est branche sur de
-- vraies donnees). Policies additives (SELECT multiples = OR), ne retirent aucun
-- droit existant. Portee strictement limitee aux classes dont prof_id = auth.uid().

-- Bug supplementaire trouve en testant : le role "authenticated" n'a aucun GRANT
-- SELECT sur la table classes (seul "anon" en a un, neutralise par la policy RLS
-- existante puisque auth.uid() est null pour anon). Consequence : meme un prof qui
-- consulte SA PROPRE classe recevait "permission denied for table classes", avant
-- meme que la policy RLS ne soit evaluee. Necessaire pour que la policy classes_own
-- deja existante fonctionne enfin pour un prof connecte.
grant select on classes to authenticated;

create policy eleves_select_prof on eleves for select
  using (
    code_classe in (select code from classes where prof_id = auth.uid())
  );

create policy progression_select_prof on progression for select
  using (
    eleve_id in (
      select e.id from eleves e
      join classes c on c.code = e.code_classe
      where c.prof_id = auth.uid()
    )
  );
