-- Espace Parent V1 : chaque eleve peut generer un code d'acces lecture-seule
-- pour ses parents, sans creer de compte separe. Le code est genere a la
-- demande (colonne nullable), jamais automatiquement, pour que l'eleve garde
-- le controle de qui a acces a sa progression.

ALTER TABLE eleves ADD COLUMN IF NOT EXISTS code_parent text UNIQUE;

-- Aucune policy RLS ajoutee pour la lecture par code : la consultation
-- parent passe exclusivement par une Edge Function (cle service-role),
-- jamais par une lecture directe anon sur la table eleves. Coherent avec le
-- reste de l'architecture anti-triche du projet (jamais de lecture/ecriture
-- sensible exposee directement au client).
