-- Audit securite systematique du 07/08/2026 (demande par Jamal suite a la
-- decouverte de la faille JWT du 04/08 -- couvre RLS de chaque table, chaque
-- Edge Function, chaque point d'ecriture sensible).

-- ═══════════════════════════════════════════════════════════════════
-- FAILLE CRITIQUE : la table exercices (312 exercices "fixes") etait
-- lisible publiquement via l'API REST (`select`, using:true, GRANT SELECT
-- a anon+authenticated), colonne "questions" incluse -- qui contient le
-- champ "correction" de chaque question EN CLAIR. N'importe qui, sans
-- compte, pouvait recuperer TOUTES les corrections d'un simple GET REST
-- avec la cle publique (verifie : `curl .../rest/v1/exercices?select=id,
-- questions` renvoyait les corrections). Ca defaisait entierement le
-- chantier anti-triche du 31/07 (qui avait retire la correction du JS
-- client mais jamais restreint la table Supabase sous-jacente).
--
-- Le client ne lit JAMAIS cette table directement (verifie : aucun
-- `.from('exercices')` dans index.html) -- seule exo-fixe-valider y accede,
-- via la cle service-role qui contourne RLS/GRANT de toute facon. Aucun
-- usage legitime cote client ne depend de cet acces : le retirer n'a
-- aucun impact fonctionnel.
revoke select on exercices from anon, authenticated;
drop policy if exists "Lecture publique des exercices" on exercices;

-- ═══════════════════════════════════════════════════════════════════
-- DURCISSEMENT (non exploitable en pratique, verifie empiriquement --
-- la policy "eleve_own" bloque deja toute usurpation de user_id a
-- l'insertion -- mais "insert_own_profile" a un WITH CHECK (true) qui ne
-- verifie rien par elle-meme : fragile si "eleve_own" est un jour
-- modifiee/supprimee sans qu'on s'en rende compte. Corrige pour que
-- CHAQUE policy applicable soit independamment correcte.
drop policy if exists insert_own_profile on eleves;
create policy insert_own_profile on eleves for insert
  to anon, authenticated
  with check (auth.uid() = user_id);
