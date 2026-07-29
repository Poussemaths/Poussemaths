// Template : derivee d'une fonction composee f(x) = (a x + b)^n, evaluee en x0.
// f'(x) = n * a * (a x + b)^(n-1)

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randNonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

function fmtSigned(n: number): string {
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
    const a = randNonZero(-3, 3);
    const n = randInt(2, 4);
    const x0 = randInt(-3, 3);

    let b = 0;
    let inner = 0;
    do {
      b = randInt(-5, 5);
      inner = a * x0 + b;
    } while (inner === 0);

    const reponse = n * a * Math.pow(inner, n - 1);

    const enonce = `On considère $f(x) = (${a}x ${fmtSigned(b)})^{${n}}$. Calcule $f'(${x0})$.`;
    const token = await encryptPayload({ x: reponse, template: "derivee_composee_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
