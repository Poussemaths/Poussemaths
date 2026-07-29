// Template : calcul de ax+by+cz pour un point M(x,y,z), etape clef pour
// verifier l'appartenance de M a un plan d'equation ax+by+cz=d.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randNonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
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
    const a = randNonZero(-5, 5);
    const b = randNonZero(-5, 5);
    const c = randNonZero(-5, 5);
    const d = randInt(-20, 20);
    const x0 = randInt(-6, 6);
    const y0 = randInt(-6, 6);
    const z0 = randInt(-6, 6);

    const reponse = a * x0 + b * y0 + c * z0;

    const enonce = `Le plan $P$ a pour équation $${a}x${b < 0 ? "" : "+"}${b}y${c < 0 ? "" : "+"}${c}z=${d}$. Pour le point $M(${x0}\\,;\\,${y0}\\,;\\,${z0})$, calcule $${a}x_M${b < 0 ? "" : "+"}${b}y_M${c < 0 ? "" : "+"}${c}z_M$ (pour vérifier si $M\\in P$).`;
    const token = await encryptPayload({ x: reponse, template: "appartenance_plan_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
