// Reinitialisation du mot de passe d'un eleve depuis le dashboard prof
// (07/08/2026, meme chantier que prof-inscrire-eleves). Le prof ne peut
// reinitialiser que le mot de passe d'un eleve de SA PROPRE classe --
// verifie explicitement ici (jamais confie a la RLS, la cle service-role
// la contourne de toute facon).

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

function genererMotDePasse(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I ambigus
  let mdp = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) mdp += alphabet[bytes[i] % alphabet.length];
  return mdp;
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
    const profUserId = await verifierUtilisateur(jwt);
    if (!profUserId) return new Response(JSON.stringify({ error: "utilisateur non authentifie" }), { status: 401, headers: corsHeaders });

    const { eleve_id } = await req.json();
    if (!eleve_id) return new Response(JSON.stringify({ error: "eleve_id requis" }), { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const eleveResp = await fetch(`${supabaseUrl}/rest/v1/eleves?id=eq.${eleve_id}&select=id,user_id,identifiant,code_classe,prenom,nom`, {
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
    });
    const eleveRows = await eleveResp.json();
    const eleve = Array.isArray(eleveRows) && eleveRows.length > 0 ? eleveRows[0] : null;
    if (!eleve) return new Response(JSON.stringify({ error: "eleve introuvable" }), { status: 404, headers: corsHeaders });
    if (!eleve.user_id || !eleve.identifiant) {
      return new Response(JSON.stringify({ error: "cet eleve ne s'est pas inscrit par identifiant (pas de mot de passe a reinitialiser ici)" }), { status: 400, headers: corsHeaders });
    }

    // Verification de propriete : le prof doit posseder la classe de cet eleve.
    const classeResp = await fetch(`${supabaseUrl}/rest/v1/classes?code=eq.${encodeURIComponent(eleve.code_classe ?? "")}&select=prof_id`, {
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
    });
    const classeRows = await classeResp.json();
    const classe = Array.isArray(classeRows) && classeRows.length > 0 ? classeRows[0] : null;
    if (!classe || classe.prof_id !== profUserId) {
      return new Response(JSON.stringify({ error: "cet eleve n'est pas dans une de tes classes" }), { status: 403, headers: corsHeaders });
    }

    const motDePasse = genererMotDePasse();
    const updateResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${eleve.user_id}`, {
      method: "PUT",
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: motDePasse }),
    });
    if (!updateResp.ok) {
      const errText = await updateResp.text();
      return new Response(JSON.stringify({ error: `reinitialisation echouee : ${errText}` }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ prenom: eleve.prenom, nom: eleve.nom, identifiant: eleve.identifiant, mot_de_passe: motDePasse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
