// Template : cosinus/sinus dans un triangle rectangle, saisie libre (fraction ou decimal).
// Utilise des triplets pythagoriciens pour garantir une configuration coherente.

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
    const k = randInt(1, 4);
    const cote = (Math.random() < 0.5 ? c1 : c2) * k;
    const hypotenuse = hyp * k;
    const fonction = Math.random() < 0.5 ? "cosinus" : "sinus";
    const relation = fonction === "cosinus" ? "adjacent à" : "opposé à";
    const reponse = cote / hypotenuse;

    const enonce = `Dans un triangle rectangle, le côté ${relation} un angle aigu mesure $${cote}$ et l'hypoténuse mesure $${hypotenuse}$. Calcule le ${fonction} de cet angle (donne une fraction ou un nombre décimal).`;
    const token = await encryptPayload({ x: reponse, template: "trigonometrie_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
