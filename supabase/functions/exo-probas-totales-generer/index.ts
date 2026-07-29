// Template : formule des probabilites totales P(B) = P(A)*P_A(B) + P(non-A)*P_(non-A)(B),
// saisie libre.

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
    const options = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const p = options[randInt(0, options.length - 1)];
    const q1 = options[randInt(0, options.length - 1)];
    const q2 = options[randInt(0, options.length - 1)];
    const pBar = Math.round((1 - p) * 10) / 10;

    const reponse = Math.round((p * q1 + pBar * q2) * 100) / 100;

    const enonce = `Un événement $A$ vérifie $P(A)=${fmtNum(p)}$. Sachant $P_A(B)=${fmtNum(q1)}$ et $P_{\\bar{A}}(B)=${fmtNum(q2)}$, calcule $P(B)$ (arrondie au centième si besoin) grâce à la formule des probabilités totales.`;
    const token = await encryptPayload({ x: reponse, template: "probas_totales_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
