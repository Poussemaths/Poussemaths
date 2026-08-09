// Inscription des eleves par le prof (07/08/2026) : le prof colle une liste
// de noms (deja verifiee/corrigee cote client dans un apercu modifiable),
// cette fonction cree un vrai compte Supabase Auth par eleve SANS email --
// chaque eleve recoit un identifiant court (prenom.nom normalise) et un mot
// de passe genere aleatoirement, imprimes ensuite sur des etiquettes.
//
// Traite les eleves un par un (pas en parallele) : plus simple pour gerer
// les doublons d'identifiant (y compris DANS le meme lot colle par le prof,
// pas seulement contre la base existante) et pour renvoyer un rapport ligne
// par ligne qui permet de ne relancer que les echecs.

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

// Identique a normaliserPourIdentifiant() cote client (index.html) : retire
// les accents (NFD) et tout caractere non alphanumerique. Doit rester en
// phase avec le client -- copie verbatim, ne pas diverger.
function normaliserPourIdentifiant(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Ne garde que le PREMIER mot du prenom et le PREMIER mot du nom (regle
// validee par Jamal le 08/08/2026, apres un identifiant de 26 caracteres
// genere pour un eleve a prenoms multiples + nom compose -- injouable pour
// un collegien). "Hector Sami Jacques Burgevin" -> hector.burgevin,
// "Theo Fougeras Lavergnolle" -> theo.fougeras. C'est un identifiant de
// connexion, pas un document officiel -- perdre le reste du nom compose est
// un compromis assume, pas un oubli.
function premierMot(s: string): string {
  return (s || "").trim().split(/\s+/)[0] || "";
}

const LONGUEUR_MAX_IDENTIFIANT = 20;

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

const MAX_ELEVES_PAR_LOT = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const profUserId = await verifierUtilisateur(jwt);
    if (!profUserId) return new Response(JSON.stringify({ error: "utilisateur non authentifie" }), { status: 401, headers: corsHeaders });

    const { code_classe, eleves } = await req.json();
    if (!code_classe || !Array.isArray(eleves) || eleves.length === 0) {
      return new Response(JSON.stringify({ error: "code_classe et eleves (liste non vide) requis" }), { status: 400, headers: corsHeaders });
    }
    if (eleves.length > MAX_ELEVES_PAR_LOT) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_ELEVES_PAR_LOT} eleves par lot.` }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Verification de propriete : le prof doit posseder reellement cette classe
    // (jamais confie au client -- meme principe que le reste de l'anti-triche).
    const classeResp = await fetch(`${supabaseUrl}/rest/v1/classes?code=eq.${encodeURIComponent(code_classe)}&select=code,nom,niveau,prof_id`, {
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
    });
    const classeRows = await classeResp.json();
    const classe = Array.isArray(classeRows) && classeRows.length > 0 ? classeRows[0] : null;
    if (!classe || classe.prof_id !== profUserId) {
      return new Response(JSON.stringify({ error: "classe introuvable ou tu n'en es pas le professeur" }), { status: 403, headers: corsHeaders });
    }

    // Identifiants deja utilises (base de comparaison pour les doublons,
    // recuperee une seule fois puis mise a jour au fil du lot en memoire).
    const existantsResp = await fetch(`${supabaseUrl}/rest/v1/eleves?identifiant=not.is.null&select=identifiant`, {
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
    });
    const existants: string[] = (await existantsResp.json()).map((e: { identifiant: string }) => e.identifiant);
    const identifiantsPris = new Set(existants);

    function identifiantLibre(prenom: string, nom: string): string {
      let base = `${normaliserPourIdentifiant(premierMot(prenom))}.${normaliserPourIdentifiant(premierMot(nom))}`;
      if (base.length > LONGUEUR_MAX_IDENTIFIANT) base = base.slice(0, LONGUEUR_MAX_IDENTIFIANT);
      let candidat = base;
      let n = 2;
      while (identifiantsPris.has(candidat)) {
        candidat = `${base}${n}`;
        n++;
      }
      identifiantsPris.add(candidat);
      return candidat;
    }

    const resultats = [];
    for (const e of eleves) {
      const prenom = String(e?.prenom ?? "").trim();
      const nom = String(e?.nom ?? "").trim();
      if (!prenom || !nom) {
        resultats.push({ prenom, nom, ok: false, erreur: "prenom ou nom manquant" });
        continue;
      }

      const identifiant = identifiantLibre(prenom, nom);
      const motDePasse = genererMotDePasse();
      const email = `${identifiant}@poussemaths.fr`;

      const creationResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: motDePasse, email_confirm: true }),
      });
      if (!creationResp.ok) {
        identifiantsPris.delete(identifiant);
        const errText = await creationResp.text();
        resultats.push({ prenom, nom, identifiant, ok: false, erreur: `creation du compte echouee : ${errText}` });
        continue;
      }
      const creationData = await creationResp.json();
      const userId = creationData.id;

      const eleveResp = await fetch(`${supabaseUrl}/rest/v1/eleves`, {
        method: "POST",
        headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId, nom, prenom, niveau: classe.niveau, classe: classe.nom, code_classe: classe.code, identifiant,
        }),
      });
      if (!eleveResp.ok) {
        const errText = await eleveResp.text();
        resultats.push({ prenom, nom, identifiant, ok: false, erreur: `ligne eleve non creee : ${errText}` });
        continue;
      }

      resultats.push({ prenom, nom, identifiant, mot_de_passe: motDePasse, ok: true });
    }

    return new Response(JSON.stringify({ classe: classe.nom, resultats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
