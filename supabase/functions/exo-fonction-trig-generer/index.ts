// Template : evaluation de f(x) = a sin(x) + b cos(x) en un angle remarquable.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randNonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

function fmtSignedNum(n: number): string {
  return n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
}

// Angles remarquables avec valeurs exactes de sin/cos, pour garder une reponse
// calculable a la main et un enonce en LaTeX propre.
const ANGLES = [
  { latex: "0", sin: 0, cos: 1 },
  { latex: "\\dfrac{\\pi}{6}", sin: 0.5, cos: Math.sqrt(3) / 2 },
  { latex: "\\dfrac{\\pi}{4}", sin: Math.sqrt(2) / 2, cos: Math.sqrt(2) / 2 },
  { latex: "\\dfrac{\\pi}{3}", sin: Math.sqrt(3) / 2, cos: 0.5 },
  { latex: "\\dfrac{\\pi}{2}", sin: 1, cos: 0 },
  { latex: "\\pi", sin: 0, cos: -1 },
];

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
    const angle = ANGLES[randInt(0, ANGLES.length - 1)];
    const reponse = Math.round((a * angle.sin + b * angle.cos) * 1000) / 1000;

    const enonce = `On considère $f(x) = ${a}\\sin(x) ${fmtSignedNum(b)}\\cos(x)$. Calcule $f\\left(${angle.latex}\\right)$ (arrondi au millième si besoin).`;
    const token = await encryptPayload({ x: reponse, template: "fonction_trig_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
