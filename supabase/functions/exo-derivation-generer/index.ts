// Template : derivee d'une fonction polynomiale du second degre evaluee en un point,
// saisie libre (nombre entier ou decimal).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZeroInt(min: number, max: number): number {
  let n = 0;
  while (n === 0) n = randInt(min, max);
  return n;
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
    const a = nonZeroInt(-5, 5);
    const b = nonZeroInt(-8, 8);
    const c = randInt(-10, 10);
    const x0 = nonZeroInt(-4, 4);

    // f(x) = a x^2 + b x + c  =>  f'(x) = 2a x + b  =>  f'(x0) = 2a*x0 + b
    const reponse = 2 * a * x0 + b;

    const aTerm = Math.abs(a) === 1 ? (a === 1 ? "x^2" : "-x^2") : `${fmtNum(a)}x^2`;
    const bAbsTerm = Math.abs(b) === 1 ? "x" : `${fmtNum(Math.abs(b))}x`;
    const bTerm = b >= 0 ? ` + ${bAbsTerm}` : ` - ${bAbsTerm}`;
    const cTerm = c === 0 ? "" : c > 0 ? ` + ${fmtNum(c)}` : ` - ${fmtNum(Math.abs(c))}`;
    const enonce = `$f(x) = ${aTerm}${bTerm}${cTerm}$. Calcule $f'(${fmtNum(x0)})$.`;
    const token = await encryptPayload({ x: reponse, template: "derivation_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
