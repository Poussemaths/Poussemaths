// Fonction consolidee : templates generatifs propres a Terminale
// Complementaire dans une seule Edge Function, routee par template_id.
// Niveau tout nouveau (30/07-01/08/2026), aucun template partage avec un
// autre niveau -- pas de risque de casser autre chose en y touchant.

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

function genererLoiUniforme() {
  const a = randInt(0, 10);
  const largeur = randInt(4, 20);
  const b = a + largeur;
  const mode = randInt(0, 1);
  let reponse: number, enonce: string;
  if (mode === 0) {
    const c = randInt(a + 1, b - 1);
    reponse = Math.round(((c - a) / (b - a)) * 100) / 100;
    enonce = `$X$ suit la loi uniforme sur $[${a}\\,;\\,${b}]$. Calcule $P(X\\leq${c})$ (arrondis au centième si besoin).`;
  } else {
    const c1 = randInt(a + 1, b - 2);
    const c2 = randInt(c1 + 1, b - 1);
    reponse = Math.round(((c2 - c1) / (b - a)) * 100) / 100;
    enonce = `$X$ suit la loi uniforme sur $[${a}\\,;\\,${b}]$. Calcule $P(${c1}\\leq X\\leq${c2})$ (arrondis au centième si besoin).`;
  }
  return { enonce, x: reponse };
}

function genererLoiExponentielle() {
  const lambdaTenths = randInt(1, 9);
  const lambda = lambdaTenths / 10;
  const t = randInt(1, 10);
  const modeInf = Math.random() < 0.5;
  let reponse: number, enonce: string;
  if (modeInf) {
    reponse = Math.round((1 - Math.exp(-lambda * t)) * 100) / 100;
    enonce = `$X$ suit la loi exponentielle de paramètre $\\lambda=0{,}${lambdaTenths}$. Calcule $P(X\\leq${t})$ (arrondis au centième), sachant $P(X\\leq t)=1-e^{-\\lambda t}$.`;
  } else {
    reponse = Math.round(Math.exp(-lambda * t) * 100) / 100;
    enonce = `$X$ suit la loi exponentielle de paramètre $\\lambda=0{,}${lambdaTenths}$. Calcule $P(X\\geq${t})$ (arrondis au centième), sachant $P(X\\geq t)=e^{-\\lambda t}$.`;
  }
  return { enonce, x: reponse };
}

function genererEsperanceDensite() {
  const mode = randInt(0, 1);
  let reponse: number, enonce: string;
  if (mode === 0) {
    const a = randInt(0, 10);
    const largeur = randInt(2, 20);
    const b = a + largeur;
    reponse = (a + b) / 2;
    enonce = `$X$ suit la loi uniforme sur $[${a}\\,;\\,${b}]$. Calcule son espérance $E(X)=\\dfrac{a+b}{2}$.`;
  } else {
    const lambdaTenths = randInt(1, 9);
    const lambda = lambdaTenths / 10;
    reponse = Math.round((1 / lambda) * 100) / 100;
    enonce = `$X$ suit la loi exponentielle de paramètre $\\lambda=0{,}${lambdaTenths}$. Calcule son espérance $E(X)=\\dfrac{1}{\\lambda}$ (arrondis au centième si besoin).`;
  }
  return { enonce, x: reponse };
}

function genererDroiteRegression() {
  const base = randInt(0, 5);
  const xs = [0, 1, 2, 3, 4].map((i) => base + i);
  const m = nonZero(-4, 4);
  const p = randInt(-5, 10);
  const ys = xs.map((x) => m * x + p);
  const mode = randInt(0, 1);
  const dataStr = `$x$ : $${xs.join(",")}$ et $y$ : $${ys.join(",")}$`;
  let reponse: number, enonce: string;
  if (mode === 0) {
    reponse = m;
    enonce = `Un tableau statistique donne ${dataStr}. Les points sont parfaitement alignés. Calcule le coefficient directeur $a$ de la droite de régression.`;
  } else {
    reponse = p;
    enonce = `Un tableau statistique donne ${dataStr}. Les points sont parfaitement alignés. Calcule l'ordonnée à l'origine $b$ de la droite de régression.`;
  }
  return { enonce, x: reponse };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "loi_uniforme_v1": result = genererLoiUniforme(); break;
      case "loi_exponentielle_v1": result = genererLoiExponentielle(); break;
      case "esperance_densite_v1": result = genererEsperanceDensite(); break;
      case "droite_regression_v1": result = genererDroiteRegression(); break;
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
