// Template : distance entre deux points dans un repere, saisie libre (nombre).
// Utilise des triplets pythagoriciens pour garantir une distance entiere exacte.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TRIPLETS = [
  [3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25], [20, 21, 29],
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
    const [c1, c2, hyp] = TRIPLETS[randInt(0, TRIPLETS.length - 1)];
    const swap = Math.random() < 0.5;
    const dx = (swap ? c2 : c1) * (Math.random() < 0.5 ? 1 : -1);
    const dy = (swap ? c1 : c2) * (Math.random() < 0.5 ? 1 : -1);
    const x1 = randInt(-8, 8);
    const y1 = randInt(-8, 8);
    const x2 = x1 + dx;
    const y2 = y1 + dy;

    const enonce = `Calcule la distance $AB$ avec $A(${x1}\\,;\\,${y1})$ et $B(${x2}\\,;\\,${y2})$.`;
    const token = await encryptPayload({ x: hyp, template: "distance_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
