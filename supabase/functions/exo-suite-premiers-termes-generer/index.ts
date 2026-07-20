// Template : calcul d'un terme a partir d'une relation de recurrence (definition d'une suite),
// distinct de la formule explicite deja couverte par suite_arithmetique_v1/suite_geometrique_v1.

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
    const type = choice(["arithmetique", "geometrique", "affine"]);
    const demanderU2 = Math.random() < 0.5;
    const u0 = randInt(-12, 12);

    let enonce: string, u1: number, u2: number;

    if (type === "arithmetique") {
      const r = nonZero(-8, 8);
      u1 = u0 + r;
      u2 = u1 + r;
      enonce = `Soit $(u_n)$ la suite définie par $u_0 = ${u0}$ et, pour tout entier $n$, $u_{n+1} = u_n + ${r < 0 ? `(${r})` : r}$.`;
    } else if (type === "geometrique") {
      const q = choice([2, -2, 3, -3]);
      u1 = u0 * q;
      u2 = u1 * q;
      enonce = `Soit $(u_n)$ la suite définie par $u_0 = ${u0}$ et, pour tout entier $n$, $u_{n+1} = ${q} \\times u_n$.`;
    } else {
      const a = choice([2, 3, -2, -3]);
      const b = randInt(-6, 6);
      u1 = a * u0 + b;
      u2 = a * u1 + b;
      enonce = `Soit $(u_n)$ la suite définie par $u_0 = ${u0}$ et, pour tout entier $n$, $u_{n+1} = ${a} \\times u_n ${b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`}$.`;
    }

    const reponse = demanderU2 ? u2 : u1;
    enonce += ` Calcule $u_{${demanderU2 ? 2 : 1}}$.`;

    const token = await encryptPayload({ x: reponse, template: "suite_premiers_termes_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
