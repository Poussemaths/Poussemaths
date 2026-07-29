// Template : variance d'une combinaison lineaire de 2 variables aleatoires independantes.
// V(aX+bY) = a^2 V(X) + b^2 V(Y) (independance).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randCoeff(): number {
  const choix = [-3, -2, 2, 3];
  return choix[Math.floor(Math.random() * choix.length)];
}

function fmtSigned(n: number): string {
  return n < 0 ? `- ${Math.abs(n)}Y` : `+ ${n}Y`;
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
    const a = randCoeff();
    const b = randCoeff();
    const vx = randInt(1, 10);
    const vy = randInt(1, 10);
    const reponse = a * a * vx + b * b * vy;

    const enonce = `$X$ et $Y$ sont deux variables aléatoires indépendantes telles que $V(X)=${vx}$ et $V(Y)=${vy}$. Calcule $V(${a}X ${fmtSigned(b)})$.`;
    const token = await encryptPayload({ x: reponse, template: "variance_somme_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
