-- Calcul mental connecte : sessions live, participants sans compte, reponses individuelles
-- Design : la table de session ne contient JAMAIS les questions/reponses (elles restent
-- en memoire dans le navigateur du prof, diffusees en direct via Realtime Broadcast).
-- Ca evite tout risque qu'un eleve lise les questions/reponses a l'avance via l'API.

CREATE TABLE sessions_calcul_mental (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  prof_id uuid NOT NULL,
  themes jsonb NOT NULL,
  chrono int NOT NULL DEFAULT 5,
  nb_questions int NOT NULL DEFAULT 10,
  question_index int NOT NULL DEFAULT -1,
  statut text NOT NULL DEFAULT 'attente',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE participants_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions_calcul_mental(id) ON DELETE CASCADE,
  prenom text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reponses_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions_calcul_mental(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants_session(id) ON DELETE CASCADE,
  question_index int NOT NULL,
  reponse text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id, question_index)
);

ALTER TABLE sessions_calcul_mental ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE reponses_session ENABLE ROW LEVEL SECURITY;

-- sessions_calcul_mental : lecture publique (code/statut/chrono/index -- rien de sensible),
-- ecriture reservee au prof proprietaire
CREATE POLICY sessions_public_read ON sessions_calcul_mental FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sessions_prof_write ON sessions_calcul_mental FOR ALL TO authenticated USING (auth.uid() = prof_id) WITH CHECK (auth.uid() = prof_id);

-- participants_session : n'importe qui peut rejoindre (insert) et voir qui a rejoint
CREATE POLICY participants_insert_public ON participants_session FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY participants_select_public ON participants_session FOR SELECT TO anon, authenticated USING (true);

-- reponses_session : n'importe qui peut inserer sa propre reponse ; seul le prof proprietaire
-- de la session peut lire l'ensemble des reponses (pour le dashboard live)
CREATE POLICY reponses_insert_public ON reponses_session FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY reponses_select_prof ON reponses_session FOR SELECT TO authenticated USING (
  session_id IN (SELECT id FROM sessions_calcul_mental WHERE prof_id = auth.uid())
);

GRANT SELECT ON sessions_calcul_mental TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions_calcul_mental TO authenticated, service_role;

GRANT SELECT, INSERT ON participants_session TO anon, authenticated, service_role;

GRANT SELECT, INSERT ON reponses_session TO anon, authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE reponses_session;
ALTER PUBLICATION supabase_realtime ADD TABLE participants_session;
