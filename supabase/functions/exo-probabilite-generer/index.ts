// Template : probabilite de tirage dans un sac, saisie libre (fraction ou decimal).

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const denominateurs = [4, 5, 8, 10, 20, 25, 40, 50];
    const total = denominateurs[randInt(0, denominateurs.length - 1)];
    const favorables = randInt(1, total - 1);
    const reponse = favorables / total;
    const couleur = ["rouges", "bleues", "vertes", "jaunes"][randInt(0, 3)];

    const enonce = `Un sac contient $${total}$ boules dont $${favorables}$ ${couleur}. On tire une boule au hasard. Quelle est la probabilité de tirer une boule ${couleur} ? (donne une fraction ou un nombre décimal)`;
    const token = await encryptPayload({ x: reponse, template: "probabilite_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
