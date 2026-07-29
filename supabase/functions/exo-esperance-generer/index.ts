// Template : esperance d'une variable aleatoire a deux valeurs, saisie libre.

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
    let v1 = randInt(-10, 10);
    let v2 = randInt(-10, 10);
    while (v2 === v1) v2 = randInt(-10, 10);

    const pOptions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const p = pOptions[randInt(0, pOptions.length - 1)];
    const q = Math.round((1 - p) * 10) / 10;

    const reponse = Math.round((v1 * p + v2 * q) * 100) / 100;

    const enonce = `Une variable aléatoire $X$ suit la loi de probabilité : $P(X=${v1})=${fmtNum(p)}$ et $P(X=${v2})=${fmtNum(q)}$. Calcule l'espérance $E(X)$ (arrondie au centième si besoin).`;
    const token = await encryptPayload({ x: reponse, template: "esperance_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
