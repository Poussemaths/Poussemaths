// Calcul et ecriture des badges cote serveur. Jusqu'ici verifierBadges()
// (index.html) calculait l'eligibilite a partir de `progression` (fiable,
// ecriture serveur uniquement) mais ecrivait directement dans `badges` depuis
// le client -- la policy RLS ne verifiait que l'appartenance de eleve_id,
// jamais que les criteres reels (%, score moyen) etaient remplis. Un eleve
// pouvait donc s'auto-attribuer n'importe quel badge via un appel REST
// direct, sans avoir fait l'exercice. Trouve et documente le 07/08/2026,
// corrige le 31/10/2026 : INSERT/UPDATE retires du role authenticated
// (migration 20261031_badges_lecture_seule.sql), seule cette fonction peut
// desormais ecrire dans `badges`, via la cle service-role.
//
// Deux actions :
// - "attribuer" (chapitre, niveau) : recalcule l'eligibilite a partir de
//   `progression` (source de verite deja fiable) et du vrai total
//   d'exercices du chapitre (table `exercices`, resynchronisee le
//   31/10/2026 -- voir memoire du projet), ecrit le badge si merite.
// - "purger" : supprime les badges inactifs depuis >45 jours. Deplacee ici
//   car le client n'a jamais eu le droit DELETE sur `badges` -- cette
//   fonctionnalite etait silencieusement cassee depuis sa construction.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const userId = await verifierUtilisateur(jwt);
    if (!userId) {
      return new Response(JSON.stringify({ error: "non authentifié" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

    const eleveResp = await fetch(`${supabaseUrl}/rest/v1/eleves?user_id=eq.${userId}&select=id`, { headers: h });
    const eleves = await eleveResp.json();
    const eleveId = Array.isArray(eleves) && eleves.length > 0 ? eleves[0].id : null;
    if (!eleveId) {
      return new Response(JSON.stringify({ error: "pas un compte élève" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "purger") {
      const badgesResp = await fetch(`${supabaseUrl}/rest/v1/badges?eleve_id=eq.${eleveId}&select=id,chapitre,niveau`, { headers: h });
      const badges = await badgesResp.json();
      const limite = new Date();
      limite.setDate(limite.getDate() - 45);
      let supprimes = 0;
      for (const b of (Array.isArray(badges) ? badges : [])) {
        const progResp = await fetch(
          `${supabaseUrl}/rest/v1/progression?eleve_id=eq.${eleveId}&chapitre=eq.${encodeURIComponent(b.chapitre)}&niveau=eq.${encodeURIComponent(b.niveau)}&select=completed_at&order=completed_at.desc&limit=1`,
          { headers: h },
        );
        const progRows = await progResp.json();
        const derniere = Array.isArray(progRows) && progRows.length > 0 ? new Date(progRows[0].completed_at) : null;
        if (derniere && derniere < limite) {
          await fetch(`${supabaseUrl}/rest/v1/badges?id=eq.${b.id}`, { method: "DELETE", headers: h });
          supprimes++;
        }
      }
      return new Response(JSON.stringify({ supprimes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "attribuer") {
      const { chapitre, niveau } = body;
      if (!chapitre || !niveau) {
        return new Response(JSON.stringify({ error: "chapitre et niveau requis" }), { status: 400, headers: corsHeaders });
      }

      const progResp = await fetch(
        `${supabaseUrl}/rest/v1/progression?eleve_id=eq.${eleveId}&chapitre=eq.${encodeURIComponent(chapitre)}&niveau=eq.${encodeURIComponent(niveau)}&select=score`,
        { headers: h },
      );
      const progs = await progResp.json();
      if (!Array.isArray(progs) || progs.length === 0) {
        return new Response(JSON.stringify({ badgeType: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const nbFaits = progs.length;
      const moy = Math.round(progs.reduce((s: number, p: { score: number }) => s + p.score, 0) / nbFaits);

      const totalResp = await fetch(
        `${supabaseUrl}/rest/v1/exercices?niveau_scolaire=eq.${encodeURIComponent(niveau)}&chapitre=eq.${encodeURIComponent(chapitre)}&select=id`,
        { headers: { ...h, Prefer: "count=exact", Range: "0-0" } },
      );
      const range = totalResp.headers.get("content-range") || "0-0/1";
      const nbTotal = Math.max(parseInt(range.split("/")[1] || "1", 10), nbFaits, 1);

      const pctFait = nbFaits / nbTotal;
      let badgeType: string | null = null;
      if (pctFait >= 1.0 && moy >= 85) badgeType = "or";
      else if (pctFait >= 0.7 && moy >= 75) badgeType = "argent";
      else if (pctFait >= 0.4 && moy >= 60) badgeType = "bronze";

      if (!badgeType) {
        return new Response(JSON.stringify({ badgeType: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const existResp = await fetch(
        `${supabaseUrl}/rest/v1/badges?eleve_id=eq.${eleveId}&chapitre=eq.${encodeURIComponent(chapitre)}&select=badge_type`,
        { headers: h },
      );
      const existants = await existResp.json();
      const niveaux: Record<string, number> = { bronze: 1, argent: 2, or: 3 };
      const meilleurExistant = (Array.isArray(existants) ? existants : []).reduce(
        (max: number, b: { badge_type: string }) => Math.max(max, niveaux[b.badge_type] || 0), 0,
      );
      if (niveaux[badgeType] <= meilleurExistant) {
        return new Response(JSON.stringify({ badgeType: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const insResp = await fetch(`${supabaseUrl}/rest/v1/badges?on_conflict=eleve_id,badge_type,chapitre`, {
        method: "POST",
        headers: { ...h, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ eleve_id: eleveId, badge_type: badgeType, chapitre, niveau, obtenu_at: new Date().toISOString() }),
      });
      if (!insResp.ok) {
        return new Response(JSON.stringify({ error: await insResp.text() }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ badgeType, nbFaits, nbTotal, moy }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "action inconnue" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
