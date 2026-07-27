// Template : resolution d'une equation e^(ax+b)=e^c par injectivite de exp
// (ax+b=c), saisie libre (nombre entier ou fraction a/b).

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
    const a = nonZeroInt(-6, 6);
    const b = randInt(-9, 9);
    const c = randInt(-9, 9);

    // e^(ax+b) = e^c  =>  ax+b=c  =>  x=(c-b)/a
    const reponse = (c - b) / a;

    const bTerm = b === 0 ? "" : b > 0 ? `+${fmtNum(b)}` : fmtNum(b);
    const aTerm = Math.abs(a) === 1 ? (a === 1 ? "x" : "-x") : `${fmtNum(a)}x`;
    const enonce = `Résous l'équation $e^{${aTerm}${bTerm}}=e^{${fmtNum(c)}}$ (utilise l'injectivité de la fonction exponentielle).`;
    const token = await encryptPayload({ x: reponse, template: "exponentielle_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
