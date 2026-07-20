// Template : aire/perimetre d'un rectangle ou aire d'un triangle rectangle, saisie libre.
// Pas de cercle ici : une aire impliquant pi n'est jamais exacte, contraire a la regle
// "reponse libre = resultat exact uniquement" (les approximations doivent etre en QCM).

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
    const estRectangle = Math.random() < 0.6;
    let enonce: string, reponse: number;

    if (estRectangle) {
      const L = randInt(3, 25);
      const l = randInt(3, 25);
      const demanderAire = Math.random() < 0.5;
      if (demanderAire) {
        reponse = L * l;
        enonce = `Un rectangle a pour longueur $${L}$ cm et pour largeur $${l}$ cm. Calcule son aire (en cm²).`;
      } else {
        reponse = 2 * (L + l);
        enonce = `Un rectangle a pour longueur $${L}$ cm et pour largeur $${l}$ cm. Calcule son périmètre (en cm).`;
      }
    } else {
      let a = randInt(3, 20);
      let b = randInt(3, 20);
      if ((a * b) % 2 !== 0) b += 1;
      reponse = (a * b) / 2;
      enonce = `Un triangle rectangle a pour côtés de l'angle droit $${a}$ cm et $${b}$ cm. Calcule son aire (en cm²).`;
    }

    const token = await encryptPayload({ x: reponse, template: "aire_perimetre_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
