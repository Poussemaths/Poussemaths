// Template : resoudre e^x = k (k = e^m pour un entier m connu), saisie libre.
// x = m exactement ; k est affiche arrondi au centieme (l'enonce donne une
// valeur approchee, la reponse exacte reste l'entier m).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toString().replace(".", ",");
}

// Arrondi a precision variable : un arrondi fixe a 2 decimales ecrase les
// petites valeurs de k=e^m (ex: m=-4 -> k=0,0183 -> arrondi 0,02 -> ln(0,02)
// = -3,912, ecart de 0,09 avec la vraie reponse -4). On garde ~4 chiffres
// significatifs quelle que soit la taille de k.
function roundSmart(n: number): number {
  if (n < 1) return Math.round(n * 10000) / 10000;
  if (n < 10) return Math.round(n * 1000) / 1000;
  return Math.round(n * 100) / 100;
}

async function getKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(Deno.env.get("EXO_KEY")!), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function encryptPayload(payload: unknown): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${ivB64}.${ctB64}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let m = randInt(-4, 5);
    if (m === 0) m = 3;
    const k = roundSmart(Math.exp(m));

    // IMPORTANT : ne jamais reveler m (= la reponse) dans l'enonce -- on donne
    // seulement k (deja arrondi), l'eleve doit calculer ln(k) lui-meme.
    // Erreur deja rencontree et corrigee une fois sur du contenu statique
    // (log_t_2) : donner "e^m ≈ k" en indice quand la reponse EST m rend la
    // question triviale (recopier un nombre deja fourni).
    const enonce = `Résous $e^x = ${fmtNum(k)}$ (donne $x$ arrondi au centième).`;
    const token = await encryptPayload({ x: m, template: "logarithme_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
