// Template : produit scalaire de deux vecteurs donnes par leurs coordonnees
// en base orthonormee (u.v = xa*xb + ya*yb), saisie libre (nombre entier).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toString().replace(".", ",");
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
    const xa = randInt(-6, 6);
    const ya = randInt(-6, 6);
    const xb = randInt(-6, 6);
    const yb = randInt(-6, 6);

    const reponse = xa * xb + ya * yb;

    const enonce = `$\\vec{u}(${fmtNum(xa)}\\,;\\,${fmtNum(ya)})$ et $\\vec{v}(${fmtNum(xb)}\\,;\\,${fmtNum(yb)})$ dans une base orthonormée. Calcule $\\vec{u}\\cdot\\vec{v}$.`;
    const token = await encryptPayload({ x: reponse, template: "produit_scalaire_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
