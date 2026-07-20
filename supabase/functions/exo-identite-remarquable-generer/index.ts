// Template : evaluation numerique via identites remarquables, saisie libre.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
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
    const a = nonZero(-9, 9);
    const b = nonZero(-9, 9);
    const type = choice(["somme", "difference", "produit"]);

    let reponse: number, enonce: string;
    const aStr = a < 0 ? `(${a})` : `${a}`;
    const bStr = b < 0 ? `(${b})` : `${b}`;

    if (type === "somme") {
      reponse = (a + b) * (a + b);
      enonce = `En utilisant l'identité remarquable $(x+y)^2 = x^2+2xy+y^2$, calcule $(${aStr}+${bStr})^2$.`;
    } else if (type === "difference") {
      reponse = (a - b) * (a - b);
      enonce = `En utilisant l'identité remarquable $(x-y)^2 = x^2-2xy+y^2$, calcule $(${aStr}-${bStr})^2$.`;
    } else {
      reponse = a * a - b * b;
      enonce = `En utilisant l'identité remarquable $(x+y)(x-y) = x^2-y^2$, calcule $(${aStr}+${bStr})\\times(${aStr}-${bStr})$.`;
    }

    const token = await encryptPayload({ x: reponse, template: "identite_remarquable_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
