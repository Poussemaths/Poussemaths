// Template : image d'un point par translation ou symetrie centrale, saisie libre (coordonnee x ou y).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZero(min: number, max: number): number {
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
    const xa = randInt(-9, 9);
    const ya = randInt(-9, 9);
    const estTranslation = Math.random() < 0.5;

    let xImg: number, yImg: number, enonce: string;

    if (estTranslation) {
      const vx = nonZero(-7, 7);
      const vy = nonZero(-7, 7);
      xImg = xa + vx;
      yImg = ya + vy;
      enonce = `Le point $A(${xa}\\,;\\,${ya})$ subit une translation de vecteur $\\vec{u}(${vx}\\,;\\,${vy})$. Le point $A'$ est l'image de $A$ par cette translation.`;
    } else {
      const ox = randInt(-6, 6);
      const oy = randInt(-6, 6);
      xImg = 2 * ox - xa;
      yImg = 2 * oy - ya;
      enonce = `Le point $A(${xa}\\,;\\,${ya})$ subit une symétrie centrale de centre $O(${ox}\\,;\\,${oy})$. Le point $A'$ est l'image de $A$ par cette symétrie.`;
    }

    const demanderX = Math.random() < 0.5;
    const reponse = demanderX ? xImg : yImg;
    enonce += ` Donne la ${demanderX ? "coordonnée $x$" : "coordonnée $y$"} du point $A'$.`;

    const token = await encryptPayload({ x: reponse, template: "transformation_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
