// Template : abscisse du point d'inflexion d'une fonction cubique f(x) = x^3 + a x^2 + b x + c.
// f''(x) = 6x + 2a, point d'inflexion en x = -a/3.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randNonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

function fmtSigned(n: number, varName: string): string {
  if (n === 0) return "";
  const abs = Math.abs(n);
  const coeff = varName !== "" && abs === 1 ? "" : String(abs);
  return n < 0 ? `- ${coeff}${varName}` : `+ ${coeff}${varName}`;
}

function fmtSignedNum(n: number): string {
  return n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
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
    const a = randNonZero(-9, 9);
    const b = randInt(-6, 6);
    const c = randInt(-6, 6);
    const reponse = -a / 3;

    const enonce = `On considère $f(x) = x^3 ${fmtSigned(a, "x^2")} ${fmtSigned(b, "x")} ${fmtSigned(c, "")}$. Sachant que $f''(x)=6x ${fmtSignedNum(2 * a)}$, détermine l'abscisse du point d'inflexion de $f$.`;
    const token = await encryptPayload({ x: reponse, template: "convexite_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
