// Template : calcul de P(X=k) pour une loi binomiale B(n,p), saisie libre
// (nombre decimal, arrondi a 4 decimales).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function binom(n: number, k: number): number {
  return factorial(n) / (factorial(k) * factorial(n - k));
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
    const n = randInt(3, 6);
    const k = randInt(0, n);
    const pOptions = [0.2, 0.3, 0.5, 0.7, 0.8];
    const p = pOptions[randInt(0, pOptions.length - 1)];

    const raw = binom(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    const reponse = Math.round(raw * 10000) / 10000;

    const pStr = fmtNum(p);
    const enonce = `Une variable aléatoire $X$ suit la loi binomiale $\\mathcal{B}(${n}\\,;\\,${pStr})$. Calcule $P(X=${k})$ (valeur arrondie à $4$ décimales).`;
    const token = await encryptPayload({ x: reponse, template: "loi_binomiale_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
