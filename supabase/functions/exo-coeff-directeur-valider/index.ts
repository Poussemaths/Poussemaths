// Valide la reponse d'un eleve pour le template coefficient_directeur_v1.

async function getKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(Deno.env.get("EXO_KEY")!), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptToken(token: string): Promise<{ x: number; template: string; ts: number }> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const userId = decodeJwtSub(jwt);
    if (!userId) return new Response(JSON.stringify({ error: "utilisateur non authentifie" }), { status: 401, headers: corsHeaders });

    const { token, reponse, exercice_id, chapitre, niveau } = await req.json();
    if (!token || reponse === undefined) return new Response(JSON.stringify({ error: "token et reponse requis" }), { status: 400, headers: corsHeaders });

    let payload;
    try {
      payload = await decryptToken(token);
    } catch {
      return new Response(JSON.stringify({ error: "token invalide" }), { status: 400, headers: corsHeaders });
    }

    const donnee = parseReponse(String(reponse));
    const correcte = donnee !== null && Math.abs(donnee - payload.x) < 0.001;
    const score = correcte ? 100 : 0;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const eleveResp = await fetch(`${supabaseUrl}/rest/v1/eleves?user_id=eq.${userId}&select=id`, {
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
    });
    const eleves = await eleveResp.json();
    if (!Array.isArray(eleves) || eleves.length === 0) return new Response(JSON.stringify({ error: "eleve introuvable" }), { status: 404, headers: corsHeaders });
    const eleveId = eleves[0].id;

    const writeResp = await fetch(`${supabaseUrl}/rest/v1/progression?on_conflict=eleve_id,exercice_id`, {
      method: "POST",
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        eleve_id: eleveId,
        exercice_id: exercice_id ?? "coefficient_directeur_v1",
        chapitre: chapitre ?? "Fonctions linéaires et affines",
        niveau: niveau ?? "3eme",
        score, points_obtenus: correcte ? 1 : 0, points_total: 1,
        completed_at: new Date().toISOString(),
      }),
    });

    if (!writeResp.ok) {
      const errText = await writeResp.text();
      return new Response(JSON.stringify({ error: "ecriture progression echouee", detail: errText }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ correcte, score, valeur: payload.x }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
