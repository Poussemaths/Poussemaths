// Valide la reponse d'un eleve pour le template identite_remarquable_v1.

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

async function verifierUtilisateur(jwt: string): Promise<string | null> {
  if (!jwt) return null;
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: "sb_publishable_z9cxUDLcFMFsb5w692JScg_VSzVvhp2" },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return user.id ?? null;
  } catch {
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function ecrireProgression(
  supabaseUrl: string,
  serviceKey: string,
  data: Record<string, unknown>,
  parcoursId: string | null | undefined,
): Promise<{ ok: boolean; error?: string; verrouille?: boolean }> {
  if (parcoursId) {
    const pResp = await fetch(`${supabaseUrl}/rest/v1/parcours?id=eq.${parcoursId}&select=mode`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const pRows = await pResp.json();
    const mode = Array.isArray(pRows) && pRows.length > 0 ? pRows[0].mode : null;
    if (!mode) return { ok: false, error: "parcours introuvable" };

    if (mode === "evaluation") {
      const existResp = await fetch(
        `${supabaseUrl}/rest/v1/progression?eleve_id=eq.${data.eleve_id}&exercice_id=eq.${data.exercice_id}&parcours_id=eq.${parcoursId}&select=id`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      const existRows = await existResp.json();
      if (Array.isArray(existRows) && existRows.length > 0) {
        return { ok: false, verrouille: true, error: "Tu as déjà répondu à cette question dans le cadre de cette évaluation." };
      }
      const insResp = await fetch(`${supabaseUrl}/rest/v1/progression`, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, parcours_id: parcoursId }),
      });
      if (!insResp.ok) return { ok: false, error: await insResp.text() };
      return { ok: true };
    }

    const writeResp = await fetch(`${supabaseUrl}/rest/v1/progression?on_conflict=eleve_id,exercice_id,parcours_key`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ ...data, parcours_id: parcoursId }),
    });
    if (!writeResp.ok) return { ok: false, error: await writeResp.text() };
    return { ok: true };
  }

  const writeResp = await fetch(`${supabaseUrl}/rest/v1/progression?on_conflict=eleve_id,exercice_id,parcours_key`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(data),
  });
  if (!writeResp.ok) return { ok: false, error: await writeResp.text() };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const userId = await verifierUtilisateur(jwt);
    if (!userId) return new Response(JSON.stringify({ error: "utilisateur non authentifie" }), { status: 401, headers: corsHeaders });

    const { token, reponse, exercice_id, chapitre, niveau, enonce, parcours_id } = await req.json();
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
    const eleveId = Array.isArray(eleves) && eleves.length > 0 ? eleves[0].id : null;

    // Compte sans ligne eleves (ex: prof qui teste un exercice) : on garde la
    // correction, on saute juste le suivi de progression au lieu de bloquer
    // la validation avec un 404 (trouve par Jamal le 29/07/2026).
    if (eleveId) {
      const result = await ecrireProgression(supabaseUrl!, serviceKey!, {
        eleve_id: eleveId,
        exercice_id: exercice_id ?? "identite_remarquable_v1",
        chapitre: chapitre ?? "Calcul littéral",
        niveau: niveau ?? "3eme",
        score, points_obtenus: correcte ? 1 : 0, points_total: 1,
        completed_at: new Date().toISOString(),
        enonce: enonce ?? null,
        reponse_donnee: String(reponse),
        reponse_attendue: String(payload.x),
      }, parcours_id);

      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error, verrouille: !!result.verrouille }), { status: result.verrouille ? 409 : 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ correcte, score, valeur: payload.x }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
