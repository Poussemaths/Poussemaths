// Fonction consolidee : valide les templates generatifs propres a 3e, routee
// par template_id (chantier de consolidation du 30/07/2026). Gere 2 formes de
// reponse : saisie libre (10 templates, tolerance numerique) et QCM (2
// templates : inequation_v1, fonction_generalites_v1, comparaison d'index).

async function getKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(Deno.env.get("EXO_KEY")!), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptToken(token: string): Promise<any> {
  const [ivB64, ctB64] = token.split(".");
  const key = await getKey();
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

function parseReponse(s: string): number | null {
  const norm = s.trim().replace(/\s/g, "").replace(",", ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-");
  const fracMatch = norm.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    if (den === 0) return null;
    return num / den;
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function decodeJwtSub(jwt: string): string | null {
  try {
    const payloadB64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(payloadB64));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QCM_TEMPLATES = new Set(["inequation_v1", "fonction_generalites_v1"]);

const DEFAULTS: Record<string, { tolerance: number; chapitre: string; niveau: string }> = {
  puissance_v1: { tolerance: 0.001, chapitre: "Puissances & Notation scientifique", niveau: "3eme" },
  racine_carree_v1: { tolerance: 0.001, chapitre: "Racines carrées", niveau: "3eme" },
  equation_1er_degre_v1: { tolerance: 0.001, chapitre: "equations", niveau: "3eme" },
  systeme_v1: { tolerance: 0.001, chapitre: "Systèmes d'équations", niveau: "3eme" },
  coefficient_directeur_v1: { tolerance: 0.001, chapitre: "Fonctions linéaires et affines", niveau: "3eme" },
  thales_v1: { tolerance: 0.001, chapitre: "Théorème de Thalès", niveau: "3eme" },
  trigonometrie_v1: { tolerance: 0.006, chapitre: "Trigonométrie", niveau: "3eme" },
  transformation_v1: { tolerance: 0.001, chapitre: "Transformations géométriques", niveau: "3eme" },
  volume_pave_v1: { tolerance: 0.001, chapitre: "Volumes de solides", niveau: "3eme" },
  pgcd_v1: { tolerance: 0.001, chapitre: "Divisibilité & Nombres premiers", niveau: "3eme" },
  notation_scientifique_v1: { tolerance: 0.001, chapitre: "Puissances & Notation scientifique", niveau: "3eme" },
  regles_puissances_v1: { tolerance: 0.001, chapitre: "Puissances & Notation scientifique", niveau: "3eme" },
  quartiles_v1: { tolerance: 0.001, chapitre: "Statistiques descriptives", niveau: "3eme" },
  decomposition_facteurs_v1: { tolerance: 0.001, chapitre: "Divisibilité & Nombres premiers", niveau: "3eme" },
  volumes_solides_v1: { tolerance: 0.06, chapitre: "Volumes de solides", niveau: "3eme" },
  inequation_v1: { tolerance: 0, chapitre: "Inéquations", niveau: "3eme" },
  fonction_generalites_v1: { tolerance: 0, chapitre: "Fonctions — généralités", niveau: "3eme" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const userId = decodeJwtSub(jwt);
    if (!userId) return new Response(JSON.stringify({ error: "utilisateur non authentifie" }), { status: 401, headers: corsHeaders });

    const { template_id, token, reponse, exercice_id, chapitre, niveau, enonce, choix } = await req.json();
    if (!token || reponse === undefined) return new Response(JSON.stringify({ error: "token et reponse requis" }), { status: 400, headers: corsHeaders });

    const defaults = DEFAULTS[template_id];
    if (!defaults) return new Response(JSON.stringify({ error: "template_id inconnu" }), { status: 400, headers: corsHeaders });

    let payload;
    try {
      payload = await decryptToken(token);
    } catch {
      return new Response(JSON.stringify({ error: "token invalide" }), { status: 400, headers: corsHeaders });
    }

    const isQcm = QCM_TEMPLATES.has(template_id);
    let correcte: boolean;
    let valeurReponseAttendue: string;
    let valeurReponseDonnee: string;
    let responseBody: Record<string, unknown>;

    if (isQcm) {
      const donnee = Number(reponse);
      correcte = Number.isInteger(donnee) && donnee === payload.idx;
      valeurReponseDonnee = Array.isArray(choix) && choix[donnee] !== undefined ? choix[donnee] : String(reponse);
      valeurReponseAttendue = Array.isArray(choix) && choix[payload.idx] !== undefined ? choix[payload.idx] : String(payload.idx);
      responseBody = { correcte, score: correcte ? 100 : 0, bonIdx: payload.idx, correction: payload.correction };
    } else {
      const donnee = parseReponse(String(reponse));
      correcte = donnee !== null && Math.abs(donnee - payload.x) < defaults.tolerance;
      valeurReponseDonnee = String(reponse);
      valeurReponseAttendue = String(payload.x);
      responseBody = { correcte, score: correcte ? 100 : 0, valeur: payload.x };
    }

    const score = correcte ? 100 : 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const eleveResp = await fetch(`${supabaseUrl}/rest/v1/eleves?user_id=eq.${userId}&select=id`, {
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
    });
    const eleves = await eleveResp.json();
    const eleveId = Array.isArray(eleves) && eleves.length > 0 ? eleves[0].id : null;

    // Compte sans ligne eleves (ex: prof qui teste un exercice) : on garde la
    // correction, on saute juste le suivi de progression au lieu de bloquer
    // la validation avec un 404 (trouve par Jamal le 29/07/2026).
    if (eleveId) {
      const writeResp = await fetch(`${supabaseUrl}/rest/v1/progression?on_conflict=eleve_id,exercice_id`, {
        method: "POST",
        headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          eleve_id: eleveId,
          exercice_id: exercice_id ?? template_id,
          chapitre: chapitre ?? defaults.chapitre,
          niveau: niveau ?? defaults.niveau,
          score, points_obtenus: correcte ? 1 : 0, points_total: 1,
          completed_at: new Date().toISOString(),
          enonce: enonce ?? null,
          reponse_donnee: valeurReponseDonnee,
          reponse_attendue: valeurReponseAttendue,
        }),
      });

      if (!writeResp.ok) {
        const errText = await writeResp.text();
        return new Response(JSON.stringify({ error: "ecriture progression echouee", detail: errText }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify(responseBody), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
