// Fonction consolidee : templates generatifs propres a 2nde dans une seule
// Edge Function, routee par template_id (chantier de consolidation du
// 30/07/2026). Les templates de 2nde deja consolides via 4e (moyenne_v1,
// probabilite_v1) restent routes vers exo-4eme-*. Aucun des 3 templates
// ci-dessous n'est partage avec un autre niveau.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

function fmtRelatif(n: number): string {
  return n < 0 ? `(${n})` : `${n}`;
}

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TRIPLETS_DISTANCE = [
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

function genererFonctionReference() {
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
  return { enonce, x: reponse };
}

function genererDistance() {
  const [c1, c2, hyp] = TRIPLETS_DISTANCE[randInt(0, TRIPLETS_DISTANCE.length - 1)];
  const swap = Math.random() < 0.5;
  const dx = (swap ? c2 : c1) * (Math.random() < 0.5 ? 1 : -1);
  const dy = (swap ? c1 : c2) * (Math.random() < 0.5 ? 1 : -1);
  const x1 = randInt(-8, 8);
  const y1 = randInt(-8, 8);
  const x2 = x1 + dx;
  const y2 = y1 + dy;
  const enonce = `Calcule la distance $AB$ avec $A(${x1}\\,;\\,${y1})$ et $B(${x2}\\,;\\,${y2})$.`;
  return { enonce, x: hyp };
}

function genererValeurAbsolue() {
  const a = nonZero(-20, 20);
  let b = nonZero(-20, 20);
  while (b === a) b = nonZero(-20, 20);
  const reponse = Math.abs(a - b);
  const enonce = `Calcule : $|${fmtRelatif(a)} - ${fmtRelatif(b)}|$`;
  return { enonce, x: reponse };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "fonction_reference_v1": result = genererFonctionReference(); break;
      case "distance_v1": result = genererDistance(); break;
      case "valeur_absolue_v1": result = genererValeurAbsolue(); break;
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
