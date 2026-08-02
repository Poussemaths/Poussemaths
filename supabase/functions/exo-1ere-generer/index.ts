// Fonction consolidee : tous les templates generatifs de 1ere dans une seule
// Edge Function, routee par template_id (chantier de consolidation du
// 30/07/2026). Aucun de ces 10 templates n'est partage avec un autre niveau.

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

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toString().replace(".", ",");
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

function genererSuitePremiersTermes() {
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
  return { enonce, x: reponse };
}

function genererSuiteArithmetique() {
  const u0 = randInt(-15, 15);
  const r = nonZero(-6, 6);
  const n = randInt(3, 15);
  const reponse = u0 + n * r;
  const enonce = `Soit $(u_n)$ une suite arithmétique de premier terme $u_0 = ${u0}$ et de raison $r = ${r}$. Calcule $u_{${n}}$.`;
  return { enonce, x: reponse };
}

function genererSuiteGeometrique() {
  const raisons: [number, number][] = [[2, 1], [-2, 1], [3, 1], [-3, 1], [1, 2], [-1, 2]];
  const [num, den] = choice(raisons);
  const n = randInt(2, 6);
  const k = nonZero(-6, 6);
  const u0 = k * Math.pow(den, n);
  const reponse = k * Math.pow(num, n);
  const qStr = den === 1 ? `${num}` : `\\dfrac{${num}}{${den}}`;
  const enonce = `Soit $(u_n)$ une suite géométrique de premier terme $u_0 = ${u0}$ et de raison $q = ${qStr}$. Calcule $u_{${n}}$.`;
  return { enonce, x: reponse };
}

function genererDiscriminant() {
  let a = randInt(1, 6);
  if (Math.random() < 0.5) a = -a;
  let b = randInt(1, 10);
  if (Math.random() < 0.5) b = -b;
  let c = randInt(1, 10);
  if (Math.random() < 0.5) c = -c;
  const reponse = b * b - 4 * a * c;
  const aTerm = Math.abs(a) === 1 ? (a === 1 ? "x^2" : "-x^2") : `${fmtNum(a)}x^2`;
  const bAbsTerm = Math.abs(b) === 1 ? "x" : `${fmtNum(Math.abs(b))}x`;
  const bTerm = b >= 0 ? ` + ${bAbsTerm}` : ` - ${bAbsTerm}`;
  const cTerm = c === 0 ? "" : c > 0 ? ` + ${fmtNum(c)}` : ` - ${fmtNum(Math.abs(c))}`;
  const enonce = `Calcule le discriminant du trinôme $${aTerm}${bTerm}${cTerm}$.`;
  return { enonce, x: reponse };
}

function genererDerivation() {
  const a = nonZero(-5, 5);
  const b = nonZero(-8, 8);
  const c = randInt(-10, 10);
  const x0 = nonZero(-4, 4);
  const reponse = 2 * a * x0 + b;
  const aTerm = Math.abs(a) === 1 ? (a === 1 ? "x^2" : "-x^2") : `${fmtNum(a)}x^2`;
  const bAbsTerm = Math.abs(b) === 1 ? "x" : `${fmtNum(Math.abs(b))}x`;
  const bTerm = b >= 0 ? ` + ${bAbsTerm}` : ` - ${bAbsTerm}`;
  const cTerm = c === 0 ? "" : c > 0 ? ` + ${fmtNum(c)}` : ` - ${fmtNum(Math.abs(c))}`;
  const enonce = `$f(x) = ${aTerm}${bTerm}${cTerm}$. Calcule $f'(${fmtNum(x0)})$.`;
  return { enonce, x: reponse };
}

function genererProbasTotales() {
  const options = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const p = options[randInt(0, options.length - 1)];
  const q1 = options[randInt(0, options.length - 1)];
  const q2 = options[randInt(0, options.length - 1)];
  const pBar = Math.round((1 - p) * 10) / 10;
  const reponse = Math.round((p * q1 + pBar * q2) * 100) / 100;
  const enonce = `Un événement $A$ vérifie $P(A)=${fmtNum(p)}$. Sachant $P_A(B)=${fmtNum(q1)}$ et $P_{\\bar{A}}(B)=${fmtNum(q2)}$, calcule $P(B)$ (arrondie au centième si besoin) grâce à la formule des probabilités totales.`;
  return { enonce, x: reponse };
}

function fmtCentiemes(n: number): string {
  return `0{,}${String(n).padStart(2, "0")}`;
}

function genererIndependance() {
  const pAt = randInt(1, 9);
  const pBt = randInt(1, 9);
  const mode = randInt(0, 1);
  let reponse: number, enonce: string;
  if (mode === 0) {
    reponse = (pAt * pBt) / 100;
    enonce = `$P(A)=0{,}${pAt}$ et $P(B)=0{,}${pBt}$. $A$ et $B$ sont indépendants. Calcule $P(A\\cap B)$.`;
  } else {
    const estIndependant = Math.random() < 0.5;
    const produitExact = pAt * pBt;
    const maxInter = Math.min(pAt, pBt) * 10 - 1;
    let pInterCent: number;
    if (estIndependant || maxInter < 1) {
      pInterCent = produitExact;
    } else {
      do {
        pInterCent = randInt(1, maxInter);
      } while (pInterCent === produitExact);
    }
    reponse = pInterCent === produitExact ? 1 : 0;
    enonce = `$P(A)=0{,}${pAt}$, $P(B)=0{,}${pBt}$ et $P(A\\cap B)=${fmtCentiemes(pInterCent)}$. $A$ et $B$ sont-ils indépendants ? Réponds par $1$ si oui, $0$ si non.`;
  }
  return { enonce, x: reponse };
}

function genererExponentielle() {
  // x tire d'abord puis c derive (x=(c-b)/a garanti exact) -- generer a,b,c
  // independamment donnerait un x en tiers/sixiemes des que a=3 ou a=6 sans
  // que l'enonce ne demande d'arrondi, rejetant a tort une reponse d'eleve
  // arrondie a 2 decimales (ex: 0,33 au lieu de 0,3333...) hors tolerance.
  const a = nonZero(-6, 6);
  const b = randInt(-9, 9);
  const x = randInt(-9, 9);
  const c = a * x + b;
  const bTerm = b === 0 ? "" : b > 0 ? `+${fmtNum(b)}` : fmtNum(b);
  const aTerm = Math.abs(a) === 1 ? (a === 1 ? "x" : "-x") : `${fmtNum(a)}x`;
  const enonce = `Résous l'équation $e^{${aTerm}${bTerm}}=e^{${fmtNum(c)}}$ (utilise l'injectivité de la fonction exponentielle).`;
  return { enonce, x };
}

function genererRadian() {
  const angles = [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
  const deg = angles[randInt(0, angles.length - 1)];
  const radExact = (deg * Math.PI) / 180;
  const reponse = Math.round(radExact * 100) / 100;
  const enonce = `Convertis $${deg}°$ en radians (valeur approchée arrondie au centième).`;
  return { enonce, x: reponse };
}

function genererProduitScalaire() {
  const xa = randInt(-6, 6);
  const ya = randInt(-6, 6);
  const xb = randInt(-6, 6);
  const yb = randInt(-6, 6);
  const reponse = xa * xb + ya * yb;
  const enonce = `$\\vec{u}(${fmtNum(xa)}\\,;\\,${fmtNum(ya)})$ et $\\vec{v}(${fmtNum(xb)}\\,;\\,${fmtNum(yb)})$ dans une base orthonormée. Calcule $\\vec{u}\\cdot\\vec{v}$.`;
  return { enonce, x: reponse };
}

function genererEsperance() {
  let v1 = randInt(-10, 10);
  let v2 = randInt(-10, 10);
  while (v2 === v1) v2 = randInt(-10, 10);
  const pOptions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const p = pOptions[randInt(0, pOptions.length - 1)];
  const q = Math.round((1 - p) * 10) / 10;
  const reponse = Math.round((v1 * p + v2 * q) * 100) / 100;
  const enonce = `Une variable aléatoire $X$ suit la loi de probabilité : $P(X=${v1})=${fmtNum(p)}$ et $P(X=${v2})=${fmtNum(q)}$. Calcule l'espérance $E(X)$ (arrondie au centième si besoin).`;
  return { enonce, x: reponse };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "suite_premiers_termes_v1": result = genererSuitePremiersTermes(); break;
      case "suite_arithmetique_v1": result = genererSuiteArithmetique(); break;
      case "suite_geometrique_v1": result = genererSuiteGeometrique(); break;
      case "discriminant_v1": result = genererDiscriminant(); break;
      case "derivation_v1": result = genererDerivation(); break;
      case "probas_totales_v1": result = genererProbasTotales(); break;
      case "independance_evenements_v1": result = genererIndependance(); break;
      case "exponentielle_v1": result = genererExponentielle(); break;
      case "radian_v1": result = genererRadian(); break;
      case "produit_scalaire_v1": result = genererProduitScalaire(); break;
      case "esperance_v1": result = genererEsperance(); break;
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
