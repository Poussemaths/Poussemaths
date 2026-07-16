// Template : priorites operatoires (+, x, parentheses), saisie libre (nombre entier).
// 3 structures possibles, toutes a resultat positif pour rester adapte au niveau.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const a = randInt(2, 15);
    const b = randInt(2, 15);
    const c = randInt(2, 15);
    const pattern = randInt(0, 2);

    let enonce: string;
    let reponse: number;

    if (pattern === 0) {
      enonce = `Calcule : $${a} + ${b} \\times ${c}$`;
      reponse = a + b * c;
    } else if (pattern === 1) {
      enonce = `Calcule : $(${a} + ${b}) \\times ${c}$`;
      reponse = (a + b) * c;
    } else {
      enonce = `Calcule : $${a} \\times ${b} + ${c}$`;
      reponse = a * b + c;
    }

    const token = await encryptPayload({ x: reponse, template: "priorites_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
