-- Bug bloquant trouve par Jamal (08/08/2026) en testant l'inscription en
-- masse : aucune interface ne permettait a un prof de creer une classe --
-- la seule classe existante (3B-VH-2026) avait ete inseree a la main via la
-- cle service-role. La policy RLS classes_own (FOR ALL, auth.uid()=prof_id)
-- existait deja et est correcte, mais le role authenticated n'avait jamais
-- recu le GRANT INSERT sur la table -- PostgREST/Postgres rejette une
-- requete AVANT meme d'evaluer RLS si le GRANT manque ("permission denied
-- for table classes", verifie en conditions reelles avant ce correctif).
grant insert on classes to authenticated;
