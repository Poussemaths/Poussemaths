// Template : limite d'une forme indeterminee 0/0 levee par factorisation.
// f(x) = (x^2 - a^2) / (x - a) quand x -> a. Apres factorisation : (x-a)(x+a)/(x-a) = x+a -> 2a.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randNonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
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
    const a = randNonZero(-8, 8);
    const aSq = a * a;
    const reponse = 2 * a;
    const denom = a >= 0 ? `x-${a}` : `x+${-a}`;

    const enonce = `Calcule $\\lim\\limits_{x\\to ${a}}\\dfrac{x^2-${aSq}}{${denom}}$ (factorise le numérateur pour lever la forme indéterminée).`;
    const token = await encryptPayload({ x: reponse, template: "limite_fonction_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
