// Template : systeme de deux equations lineaires a deux inconnues, saisie libre (x ou y).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

function formatTerme(coef: number, varName: string, estPremier: boolean): string {
  const abs = Math.abs(coef);
  const partieVar = abs === 1 ? varName : `${abs}${varName}`;
  if (estPremier) return coef < 0 ? `-${partieVar}` : partieVar;
  return coef < 0 ? `- ${partieVar}` : `+ ${partieVar}`;
}

function formatEquation(a: number, b: number, c: number): string {
  return `${formatTerme(a, "x", true)} ${formatTerme(b, "y", false)} = ${c}`;
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
    const x0 = randInt(-9, 9);
    const y0 = randInt(-9, 9);

    let a1 = 0, b1 = 0, a2 = 0, b2 = 0;
    let det = 0;
    do {
      a1 = nonZero(-6, 6);
      b1 = nonZero(-6, 6);
      a2 = nonZero(-6, 6);
      b2 = nonZero(-6, 6);
      det = a1 * b2 - a2 * b1;
    } while (det === 0);

    const c1 = a1 * x0 + b1 * y0;
    const c2 = a2 * x0 + b2 * y0;

    const demanderX = Math.random() < 0.5;
    const reponse = demanderX ? x0 : y0;

    const enonce = `Résous le système d'équations suivant :\n$\\begin{cases} ${formatEquation(a1, b1, c1)} \\\\ ${formatEquation(a2, b2, c2)} \\end{cases}$\nDonne la valeur de $${demanderX ? "x" : "y"}$.`;
    const token = await encryptPayload({ x: reponse, template: "systeme_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
