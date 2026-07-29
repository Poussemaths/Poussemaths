// Template : equation differentielle y'=ay, y(0)=y0 -> y(x)=y0*e^(ax).
// On demande d'evaluer y(x1).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randNonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

// Arrondi a precision variable (voir logarithme_v1 : un arrondi fixe ecrase
// les petites valeurs de e^(ax) quand a*x1 est tres negatif).
function roundSmart(n: number): number {
  const abs = Math.abs(n);
  if (abs < 1) return Math.round(n * 10000) / 10000;
  if (abs < 10) return Math.round(n * 1000) / 1000;
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
    const a = randNonZero(-2, 2);
    const y0 = randNonZero(-5, 5);
    const x1 = randInt(1, 3);

    const reponse = roundSmart(y0 * Math.exp(a * x1));

    const aCoeff = Math.abs(a) === 1 ? (a < 0 ? "-" : "") : String(a);
    const enonce = `$f$ est solution de l'équation différentielle $y'=${aCoeff}y$ avec $f(0)=${y0}$. Calcule $f(${x1})$ (arrondi si besoin).`;
    const token = await encryptPayload({ x: reponse, template: "equadiff_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
