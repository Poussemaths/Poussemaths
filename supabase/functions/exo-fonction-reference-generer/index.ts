// Template : evaluation des fonctions de reference (carre, inverse, racine), saisie libre.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
    const type = choice(["carre", "inverse", "racine"]);
    let enonce: string, reponse: number;

    if (type === "carre") {
      const x = randInt(-15, 15);
      reponse = x * x;
      enonce = `Soit $f$ la fonction carré, définie par $f(x) = x^2$. Calcule $f(${x})$.`;
    } else if (type === "inverse") {
      const pool = [1, 2, 4, 5, 8, 10, -1, -2, -4, -5, -8, -10];
      const x = choice(pool);
      reponse = 1 / x;
      enonce = `Soit $f$ la fonction inverse, définie par $f(x) = \\dfrac{1}{x}$. Calcule $f(${x})$ (donne le résultat sous forme décimale ou fractionnaire).`;
    } else {
      const k = randInt(0, 12);
      const x = k * k;
      reponse = k;
      enonce = `Soit $f$ la fonction racine carrée, définie par $f(x) = \\sqrt{x}$. Calcule $f(${x})$.`;
    }

    const token = await encryptPayload({ x: reponse, template: "fonction_reference_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
