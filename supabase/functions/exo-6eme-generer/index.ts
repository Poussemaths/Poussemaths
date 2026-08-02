// Fonction consolidee : templates generatifs propres a 6e dans une seule
// Edge Function, routee par template_id (chantier de consolidation du
// 30/07/2026). aire_perimetre_v1 (6e) est deja consolide via exo-5eme-*
// (fait avant 6e dans l'ordre de traitement), pourcentage_v1/probabilite_v1/
// moyenne_v1 (6e) sont deja sur exo-4eme-*. Les 3 templates ci-dessous sont
// les seuls encore individuels pour 6e.

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

function genererPriorites() {
  const a = randInt(2, 15);
  const b = randInt(2, 15);
  const c = randInt(2, 15);
  const pattern = randInt(0, 2);
  let enonce: string, reponse: number;
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
  return { enonce, x: reponse };
}

function genererFractionAddition() {
  const b = randInt(2, 9);
  let d = randInt(2, 9);
  while (d === b) d = randInt(2, 9);
  const a = randInt(1, b - 1);
  const c = randInt(1, d - 1);
  const reponse = a / b + c / d;
  const enonce = `Calcule : $\\dfrac{${a}}{${b}} + \\dfrac{${c}}{${d}}$ (donne une fraction ou un nombre décimal)`;
  return { enonce, x: reponse };
}

function genererAngleTriangle() {
  const a = randInt(20, 100);
  const b = randInt(20, 150 - a);
  const reponse = 180 - a - b;
  const enonce = `Dans un triangle, deux angles mesurent $${a}°$ et $${b}°$. Calcule la mesure du troisième angle (en degrés).`;
  return { enonce, x: reponse };
}

function genererMultiplesDiviseurs() {
  const d = choice([2, 3, 4, 5, 6, 8, 9, 10]);
  const n = randInt(10, 300);
  const reponse = n % d;
  const enonce = `Quel est le reste de la division euclidienne de $${n}$ par $${d}$ ? (un reste de $0$ signifie que $${n}$ est un multiple de $${d}$)`;
  return { enonce, x: reponse };
}

function genererVolumeCube() {
  const c = randInt(2, 12);
  const reponse = c * c * c;
  const enonce = `Un cube a une arête de $${c}$ cm. Calcule son volume (en cm³).`;
  return { enonce, x: reponse };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "priorites_v1": result = genererPriorites(); break;
      case "fraction_addition_v1": result = genererFractionAddition(); break;
      case "angle_triangle_v1": result = genererAngleTriangle(); break;
      case "multiples_diviseurs_v1": result = genererMultiplesDiviseurs(); break;
      case "volume_cube_v1": result = genererVolumeCube(); break;
      default:
        return new Response(JSON.stringify({ error: "template_id inconnu" }), { status: 400, headers: corsHeaders });
    }

    const token = await encryptPayload({ x: result.x, template: template_id, ts: Date.now() });
    return new Response(JSON.stringify({ enonce: result.enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
