// Template : terme d'une suite geometrique de raison rationnelle, saisie libre.
// La raison est num/den ; u0 = k * den^n garantit un terme un = k * num^n toujours entier exact.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
    const raisons: [number, number][] = [[2, 1], [-2, 1], [3, 1], [-3, 1], [1, 2], [-1, 2]];
    const [num, den] = choice(raisons);
    const n = randInt(2, 6);
    const k = nonZero(-6, 6);

    const u0 = k * Math.pow(den, n);
    const reponse = k * Math.pow(num, n);

    const qStr = den === 1 ? `${num}` : `\\dfrac{${num}}{${den}}`;
    const enonce = `Soit $(u_n)$ une suite géométrique de premier terme $u_0 = ${u0}$ et de raison $q = ${qStr}$. Calcule $u_{${n}}$.`;
    const token = await encryptPayload({ x: reponse, template: "suite_geometrique_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
