// Espace Parent V1 : consultation lecture-seule de la progression d'un eleve
// via un code d'acces, sans compte parent separe. Deux actions :
// - "generer" (JWT eleve requis) : cree/renvoie le code_parent de l'eleve
//   connecte.
// - "consulter" (public, sans auth) : renvoie un rapport lecture-seule pour
//   un code donne. Jamais de lecture directe de la table eleves cote client
//   -- tout passe par ici avec la cle service-role, coherent avec le reste
//   de l'architecture anti-triche du projet.

function decodeJwtSub(jwt: string): string | null {
  try {
    const payloadB64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(payloadB64));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function genererCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I ambigus
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const body = await req.json();
    const { action } = body;

    if (action === "generer") {
      const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      const userId = decodeJwtSub(jwt);
      if (!userId) return new Response(JSON.stringify({ error: "utilisateur non authentifie" }), { status: 401, headers: corsHeaders });

      const eleveResp = await fetch(`${supabaseUrl}/rest/v1/eleves?user_id=eq.${userId}&select=id,code_parent`, {
        headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
      });
      const eleves = await eleveResp.json();
      if (!Array.isArray(eleves) || eleves.length === 0) {
        return new Response(JSON.stringify({ error: "eleve introuvable" }), { status: 404, headers: corsHeaders });
      }
      const eleve = eleves[0];
      if (eleve.code_parent) {
        return new Response(JSON.stringify({ code: eleve.code_parent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Boucle de regeneration en cas de collision improbable sur la contrainte UNIQUE
      let code = "";
      for (let tries = 0; tries < 5; tries++) {
        code = genererCode();
        const writeResp = await fetch(`${supabaseUrl}/rest/v1/eleves?id=eq.${eleve.id}`, {
          method: "PATCH",
          headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ code_parent: code }),
        });
        if (writeResp.ok) {
          return new Response(JSON.stringify({ code }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify({ error: "generation du code echouee" }), { status: 500, headers: corsHeaders });
    }

    if (action === "consulter") {
      const { code } = body;
      if (!code || typeof code !== "string") {
        return new Response(JSON.stringify({ error: "code requis" }), { status: 400, headers: corsHeaders });
      }
      const eleveResp = await fetch(`${supabaseUrl}/rest/v1/eleves?code_parent=eq.${encodeURIComponent(code)}&select=id,nom,prenom,niveau,classe`, {
        headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
      });
      const eleves = await eleveResp.json();
      if (!Array.isArray(eleves) || eleves.length === 0) {
        return new Response(JSON.stringify({ error: "code invalide" }), { status: 404, headers: corsHeaders });
      }
      const eleve = eleves[0];

      const [progResp, badgesResp] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/progression?eleve_id=eq.${eleve.id}&select=score,points_obtenus,chapitre,niveau,completed_at&order=completed_at.desc`, {
          headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
        }),
        fetch(`${supabaseUrl}/rest/v1/badges?eleve_id=eq.${eleve.id}&select=badge_type,chapitre,obtenu_at`, {
          headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
        }),
      ]);
      const progressions = await progResp.json();
      const badges = await badgesResp.json();

      const nbExercices = Array.isArray(progressions) ? progressions.length : 0;
      const totalPoints = Array.isArray(progressions) ? progressions.reduce((s: number, p: any) => s + (p.points_obtenus || 0), 0) : 0;
      const moyenneGlobale = nbExercices > 0
        ? Math.round(progressions.reduce((s: number, p: any) => s + p.score, 0) / nbExercices)
        : 0;

      const parChapitre: Record<string, { chapitre: string; niveau: string; scores: number[] }> = {};
      if (Array.isArray(progressions)) {
        for (const p of progressions) {
          const cle = `${p.niveau || ""}::${p.chapitre}`;
          if (!parChapitre[cle]) parChapitre[cle] = { chapitre: p.chapitre, niveau: p.niveau, scores: [] };
          parChapitre[cle].scores.push(p.score);
        }
      }
      const progressionParChapitre = Object.values(parChapitre).map((c) => ({
        chapitre: c.chapitre,
        niveau: c.niveau,
        moyenne: Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length),
        nbExercices: c.scores.length,
      }));

      return new Response(JSON.stringify({
        prenom: eleve.prenom,
        nom: eleve.nom,
        niveau: eleve.niveau,
        classe: eleve.classe,
        totalPoints,
        nbExercices,
        moyenneGlobale,
        progressionParChapitre,
        badges: Array.isArray(badges) ? badges : [],
        derniersExercices: Array.isArray(progressions) ? progressions.slice(0, 5) : [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "action inconnue" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
