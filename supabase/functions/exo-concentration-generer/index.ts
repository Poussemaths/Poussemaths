// Template : inegalite de Bienayme-Tchebychev, P(|X-E(X)|>=a) <= V(X)/a^2.
// On demande de calculer le majorant V(X)/a^2.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
    const esperance = randInt(1, 20);
    const variance = randInt(1, 25);
    const a = randInt(2, 10);

    const reponse = Math.round((variance / (a * a)) * 10000) / 10000;

    const enonce = `$X$ est une variable aléatoire d'espérance $E(X)=${esperance}$ et de variance $V(X)=${variance}$. D'après l'inégalité de Bienaymé-Tchebychev, calcule le majorant $\\dfrac{V(X)}{a^2}$ de $P(|X-E(X)|\\geq ${a})$ (arrondi au dix-millième si besoin).`;
    const token = await encryptPayload({ x: reponse, template: "concentration_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
