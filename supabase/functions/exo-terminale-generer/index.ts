// Fonction consolidee : tous les templates generatifs de Terminale dans une
// seule Edge Function, routee par template_id (chantier de consolidation du
// 30/07/2026). Aucun de ces 14 templates n'est partage avec un autre niveau.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randNonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toString().replace(".", ",");
}

function fmtSigned(n: number): string {
  return n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function binom(n: number, k: number): number {
  return factorial(n) / (factorial(k) * factorial(n - k));
}

// Arrondi a precision variable (4/3/2 decimales selon l'echelle) : un arrondi
// fixe ecrase les petites valeurs (voir logarithme_v1/equadiff_v1 -- bug deja
// trouve et corrige le 29/07/2026 avant tout deploiement en prod).
function roundSmart(n: number): number {
  const abs = Math.abs(n);
  if (abs < 1) return Math.round(n * 10000) / 10000;
  if (abs < 10) return Math.round(n * 1000) / 1000;
  return Math.round(n * 100) / 100;
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

function genererLimiteSuite() {
  const a = randNonZero(-9, 9);
  const c = randNonZero(-9, 9);
  const b = randInt(-20, 20);
  const d = randInt(-20, 20);
  const reponse = a / c;
  const enonce = `On considère la suite définie pour $n \\ge 1$ par $u_n = \\dfrac{${a}n ${fmtSigned(b)}}{${c}n ${fmtSigned(d)}}$. Détermine la limite de $u_n$ quand $n \\to +\\infty$ (arrondie au millième si besoin).`;
  return { enonce, x: reponse };
}

function genererLimiteFonction() {
  const a = randNonZero(-8, 8);
  const aSq = a * a;
  const reponse = 2 * a;
  const denom = a >= 0 ? `x-${a}` : `x+${-a}`;
  const enonce = `Calcule $\\lim\\limits_{x\\to ${a}}\\dfrac{x^2-${aSq}}{${denom}}$ (factorise le numérateur pour lever la forme indéterminée).`;
  return { enonce, x: reponse };
}

function genererPrimitiveIntegrale() {
  const aOptions = [3, 6, 9, -3, -6];
  const bOptions = [2, 4, 6, -2, -4];
  const a = aOptions[randInt(0, aOptions.length - 1)];
  const b = bOptions[randInt(0, bOptions.length - 1)];
  const c = randInt(-5, 5);
  const k = randInt(2, 4);
  const reponse = (a / 3) * k ** 3 + (b / 2) * k ** 2 + c * k;
  const aTerm = `${fmtNum(a)}x^2`;
  const bAbs = Math.abs(b) === 1 ? "x" : `${fmtNum(Math.abs(b))}x`;
  const bTerm = b >= 0 ? ` + ${bAbs}` : ` - ${bAbs}`;
  const cTerm = c === 0 ? "" : c > 0 ? ` + ${fmtNum(c)}` : ` - ${fmtNum(Math.abs(c))}`;
  const enonce = `Calcule $\\displaystyle\\int_0^{${k}} (${aTerm}${bTerm}${cTerm})\\,dx$.`;
  return { enonce, x: reponse };
}

function genererLoiBinomiale() {
  const n = randInt(3, 6);
  const k = randInt(0, n);
  const pOptions = [0.2, 0.3, 0.5, 0.7, 0.8];
  const p = pOptions[randInt(0, pOptions.length - 1)];
  const raw = binom(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  const reponse = Math.round(raw * 10000) / 10000;
  const enonce = `Une variable aléatoire $X$ suit la loi binomiale $\\mathcal{B}(${n}\\,;\\,${fmtNum(p)})$. Calcule $P(X=${k})$ (valeur arrondie à $4$ décimales).`;
  return { enonce, x: reponse };
}

function genererGeometrieEspace() {
  const xa = randInt(-6, 6), ya = randInt(-6, 6), za = randInt(-6, 6);
  const xb = randInt(-6, 6), yb = randInt(-6, 6), zb = randInt(-6, 6);
  const reponse = xa * xb + ya * yb + za * zb;
  const enonce = `Dans l'espace muni d'un repère orthonormé, $\\vec{u}(${xa}\\,;\\,${ya}\\,;\\,${za})$ et $\\vec{v}(${xb}\\,;\\,${yb}\\,;\\,${zb})$. Calcule $\\vec{u}\\cdot\\vec{v}$.`;
  return { enonce, x: reponse };
}

function genererLogarithme() {
  let m = randInt(-4, 5);
  if (m === 0) m = 3;
  const k = roundSmart(Math.exp(m));
  const enonce = `Résous $e^x = ${fmtNum(k)}$ (donne $x$ arrondi au centième).`;
  return { enonce, x: m };
}

function genererConvexite() {
  // a doit etre un multiple de 3 : l'abscisse d'inflexion x=-a/3 doit rester
  // exacte, l'enonce ne demandant aucun arrondi (meme piege que
  // exponentielle_v1 -- un a non multiple de 3 donnerait un tiers/sixieme
  // periodique rejetant a tort une reponse d'eleve arrondie a 2 decimales).
  const aMultiples = [-9, -6, -3, 3, 6, 9];
  const a = aMultiples[randInt(0, aMultiples.length - 1)];
  const b = randInt(-6, 6);
  const c = randInt(-6, 6);
  const reponse = -a / 3;
  function fmtSignedVar(n: number, varName: string): string {
    if (n === 0) return "";
    const abs = Math.abs(n);
    const coeff = varName !== "" && abs === 1 ? "" : String(abs);
    return n < 0 ? `- ${coeff}${varName}` : `+ ${coeff}${varName}`;
  }
  const enonce = `On considère $f(x) = x^3 ${fmtSignedVar(a, "x^2")} ${fmtSignedVar(b, "x")} ${fmtSignedVar(c, "")}$. Sachant que $f''(x)=6x ${fmtSigned(2 * a)}$, détermine l'abscisse du point d'inflexion de $f$.`;
  return { enonce, x: reponse };
}

function genererCombinaison() {
  const n = randInt(4, 12);
  const k = randInt(0, n);
  const reponse = binom(n, k);
  return { enonce: `Calcule $\\binom{${n}}{${k}}$.`, x: reponse };
}

const ANGLES_TRIG = [
  { latex: "0", sin: 0, cos: 1 },
  { latex: "\\dfrac{\\pi}{6}", sin: 0.5, cos: Math.sqrt(3) / 2 },
  { latex: "\\dfrac{\\pi}{4}", sin: Math.sqrt(2) / 2, cos: Math.sqrt(2) / 2 },
  { latex: "\\dfrac{\\pi}{3}", sin: Math.sqrt(3) / 2, cos: 0.5 },
  { latex: "\\dfrac{\\pi}{2}", sin: 1, cos: 0 },
  { latex: "\\pi", sin: 0, cos: -1 },
];

function genererFonctionTrig() {
  const a = randNonZero(-5, 5);
  const b = randNonZero(-5, 5);
  const angle = ANGLES_TRIG[randInt(0, ANGLES_TRIG.length - 1)];
  const reponse = Math.round((a * angle.sin + b * angle.cos) * 1000) / 1000;
  const enonce = `On considère $f(x) = ${a}\\sin(x) ${fmtSigned(b)}\\cos(x)$. Calcule $f\\left(${angle.latex}\\right)$ (arrondi au millième si besoin).`;
  return { enonce, x: reponse };
}

function genererEquadiff() {
  const a = randNonZero(-2, 2);
  const y0 = randNonZero(-5, 5);
  const x1 = randInt(1, 3);
  const reponse = roundSmart(y0 * Math.exp(a * x1));
  const aCoeff = Math.abs(a) === 1 ? (a < 0 ? "-" : "") : String(a);
  const enonce = `$f$ est solution de l'équation différentielle $y'=${aCoeff}y$ avec $f(0)=${y0}$. Calcule $f(${x1})$ (arrondi si besoin).`;
  return { enonce, x: reponse };
}

function genererVarianceSomme() {
  function randCoeff(): number {
    const choix = [-3, -2, 2, 3];
    return choix[Math.floor(Math.random() * choix.length)];
  }
  const a = randCoeff();
  const b = randCoeff();
  const vx = randInt(1, 10);
  const vy = randInt(1, 10);
  const reponse = a * a * vx + b * b * vy;
  const bTerm = b < 0 ? `- ${Math.abs(b)}Y` : `+ ${b}Y`;
  const enonce = `$X$ et $Y$ sont deux variables aléatoires indépendantes telles que $V(X)=${vx}$ et $V(Y)=${vy}$. Calcule $V(${a}X ${bTerm})$.`;
  return { enonce, x: reponse };
}

function genererAppartenancePlan() {
  const a = randNonZero(-5, 5), b = randNonZero(-5, 5), c = randNonZero(-5, 5);
  const d = randInt(-20, 20);
  const x0 = randInt(-6, 6), y0 = randInt(-6, 6), z0 = randInt(-6, 6);
  const reponse = a * x0 + b * y0 + c * z0;
  const enonce = `Le plan $P$ a pour équation $${a}x${b < 0 ? "" : "+"}${b}y${c < 0 ? "" : "+"}${c}z=${d}$. Pour le point $M(${x0}\\,;\\,${y0}\\,;\\,${z0})$, calcule $${a}x_M${b < 0 ? "" : "+"}${b}y_M${c < 0 ? "" : "+"}${c}z_M$ (pour vérifier si $M\\in P$).`;
  return { enonce, x: reponse };
}

function genererDeriveeComposee() {
  const a = randNonZero(-3, 3);
  const n = randInt(2, 4);
  const x0 = randInt(-3, 3);
  let b = 0, inner = 0;
  do {
    b = randInt(-5, 5);
    inner = a * x0 + b;
  } while (inner === 0);
  const reponse = n * a * Math.pow(inner, n - 1);
  const enonce = `On considère $f(x) = (${a}x ${fmtSigned(b)})^{${n}}$. Calcule $f'(${x0})$.`;
  return { enonce, x: reponse };
}

function genererContinuiteTvi() {
  const a = randNonZero(-6, 6);
  const b = randInt(-8, 8);
  const x0 = randInt(-3, 3);
  const reponse = Math.pow(x0, 3) + a * x0 + b;
  const enonce = `On considère $f(x) = x^3 ${fmtSigned(a)}x ${fmtSigned(b)}$. Calcule $f(${x0})$.`;
  return { enonce, x: reponse };
}

function genererConcentration() {
  const esperance = randInt(1, 20);
  const variance = randInt(1, 25);
  const a = randInt(2, 10);
  const reponse = Math.round((variance / (a * a)) * 10000) / 10000;
  const enonce = `$X$ est une variable aléatoire d'espérance $E(X)=${esperance}$ et de variance $V(X)=${variance}$. D'après l'inégalité de Bienaymé-Tchebychev, calcule le majorant $\\dfrac{V(X)}{a^2}$ de $P(|X-E(X)|\\geq ${a})$ (arrondi au dix-millième si besoin).`;
  return { enonce, x: reponse };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "limite_suite_v1": result = genererLimiteSuite(); break;
      case "limite_fonction_v1": result = genererLimiteFonction(); break;
      case "primitive_integrale_v1": result = genererPrimitiveIntegrale(); break;
      case "loi_binomiale_v1": result = genererLoiBinomiale(); break;
      case "geometrie_espace_v1": result = genererGeometrieEspace(); break;
      case "logarithme_v1": result = genererLogarithme(); break;
      case "convexite_v1": result = genererConvexite(); break;
      case "combinaison_v1": result = genererCombinaison(); break;
      case "fonction_trig_v1": result = genererFonctionTrig(); break;
      case "equadiff_v1": result = genererEquadiff(); break;
      case "variance_somme_v1": result = genererVarianceSomme(); break;
      case "appartenance_plan_v1": result = genererAppartenancePlan(); break;
      case "derivee_composee_v1": result = genererDeriveeComposee(); break;
      case "concentration_v1": result = genererConcentration(); break;
      case "continuite_tvi_v1": result = genererContinuiteTvi(); break;
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
