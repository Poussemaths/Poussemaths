// Template : calcul d'une integrale definie d'un trinome ax^2+bx+c entre 0 et k,
// saisie libre (nombre entier garanti par construction : a multiple de 3, b multiple de 2).

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
    // a multiple de 3 (primitive a/3 x^3 -> entier) ; b multiple de 2 (primitive b/2 x^2 -> entier)
    const aOptions = [3, 6, 9, -3, -6];
    const bOptions = [2, 4, 6, -2, -4];
    const a = aOptions[randInt(0, aOptions.length - 1)];
    const b = bOptions[randInt(0, bOptions.length - 1)];
    const c = randInt(-5, 5);
    const k = randInt(2, 4);

    const reponse = (a / 3) * k ** 3 + (b / 2) * k ** 2 + c * k;

    const aTerm = `${fmtNum(a)}x^2`;
    const bAbs = Math.abs(b) === 1 ? "x" : `${fmtNum(Math.abs(b))}x`;
    const bTerm = b >= 0 ? ` + ${bAbs}` : ` - ${bAbs}`;
    const cTerm = c === 0 ? "" : c > 0 ? ` + ${fmtNum(c)}` : ` - ${fmtNum(Math.abs(c))}`;
    const enonce = `Calcule $\\displaystyle\\int_0^{${k}} (${aTerm}${bTerm}${cTerm})\\,dx$.`;
    const token = await encryptPayload({ x: reponse, template: "primitive_integrale_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
