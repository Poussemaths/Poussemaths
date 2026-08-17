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

function fmtPolyTvi(a: number, b: number): string {
  const aTerm = a === 0 ? "" : ` ${fmtSigned(a)}x`;
  return `x^3${aTerm} ${fmtSigned(b)}`;
}

// Remplace l'ancienne genererContinuiteTvi (evaluait seulement f(x0), ne
// travaillait jamais le raisonnement TVI -- trouve par l'audit Chantier 1.5).
// 4 modes tires aleatoirement pour une vraie diversite pedagogique : existence
// bornes donnees, bornes a calculer, existence+unicite (nombre de solutions),
// et un cas piege a signes identiques (le TVI ne permet alors rien conclure).
// a >= 0 garantit f'(x)=3x^2+a >= 0 partout, donc f strictement croissante sur
// R -- elimine tout risque de monotonie locale mal maitrisee.
function genererContinuiteTvi() {
  const modes = ["bornesDonnees", "bornesACalculer", "existenceUnicite", "piege"];
  const mode = modes[randInt(0, 3)];
  const a = randInt(0, 6);
  const veutOpposes = mode !== "piege";
  let b = 0, p = 0, q = 0, fp = 0, fq = 0, tentatives = 0;
  do {
    b = randInt(-15, 15);
    p = randInt(-4, 3);
    q = randInt(p + 1, p + 5);
    fp = Math.pow(p, 3) + a * p + b;
    fq = Math.pow(q, 3) + a * q + b;
    tentatives++;
    if (tentatives > 500) throw new Error("tvi: trop de tentatives");
  } while (fp === 0 || fq === 0 || (veutOpposes ? fp * fq >= 0 : fp * fq <= 0));

  const poly = fmtPolyTvi(a, b);
  let enonce: string, reponse: number;
  if (mode === "bornesDonnees") {
    enonce = `On considère $f(x)=${poly}$ sur $[${p}\\,;\\,${q}]$, avec $f(${p})=${fp}$ et $f(${q})=${fq}$. Le théorème des valeurs intermédiaires permet-il d'affirmer l'existence d'une solution à $f(x)=0$ sur $[${p}\\,;\\,${q}]$ ? (réponds 1 pour oui, 0 pour non)`;
    reponse = 1;
  } else if (mode === "bornesACalculer") {
    enonce = `On considère $f(x)=${poly}$. Calcule $f(${p})$ et $f(${q})$, puis dis si le TVI permet d'affirmer l'existence d'une solution à $f(x)=0$ sur $[${p}\\,;\\,${q}]$ (1 pour oui, 0 pour non).`;
    reponse = 1;
  } else if (mode === "existenceUnicite") {
    enonce = `$f(x)=${poly}$ est strictement croissante sur $\\mathbb{R}$. Sachant que $f(${p})=${fp}$ et $f(${q})=${fq}$, combien l'équation $f(x)=0$ admet-elle de solutions sur $[${p}\\,;\\,${q}]$ ?`;
    reponse = 1;
  } else {
    enonce = `On considère $f(x)=${poly}$. On donne $f(${p})=${fp}$ et $f(${q})=${fq}$. Le TVI permet-il de conclure à l'existence d'une solution de $f(x)=0$ sur $[${p}\\,;\\,${q}]$ ? (1 pour oui, 0 pour non)`;
    reponse = 0;
  }
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

// Cas echantillon (n variable) de l'inegalite de concentration -- distinct de
// concentration_v1 (variable simple, majorant direct). Ici on inverse le sens
// du calcul : etant donnes une precision et un risque cibles, determiner la
// TAILLE D'ECHANTILLON minimale n qui les garantit (capacite BO explicite :
// "definir une taille d'echantillon en fonction de la precision et du
// risque choisi"), pas juste rejouer la meme formule avec un n en plus.
function genererConcentrationEchantillon() {
  const V = randInt(2, 25);
  const delta = randInt(2, 8);
  const alphaOptions = [0.01, 0.05, 0.1, 0.2];
  const alpha = alphaOptions[randInt(0, alphaOptions.length - 1)];
  const raw = Math.round((V / (delta * delta * alpha)) * 1e6) / 1e6;
  const nMin = Math.ceil(raw);
  const enonce = `On veut estimer l'espérance $\\mu$ d'une variable aléatoire de variance $V(X)=${V}$ à partir de la moyenne $M_n$ d'un échantillon de taille $n$. D'après l'inégalité de concentration, quelle taille d'échantillon minimale $n$ garantit $P(|M_n-\\mu|\\geq ${delta})\\leq ${alpha}$ ?`;
  return { enonce, x: nMin };
}

// Cas affine y'=ay+b (b != 0) de l'equation differentielle -- distinct de
// equadiff_v1 (cas homogene y'=ay seul). Raisonnement en 2 etapes explicite
// dans le BO : solution particuliere constante k=-b/a, puis solution
// generale y=Ce^{ax}+k avec C determine par la condition initiale.
function genererEquadiffAffine() {
  const aOptions = [-2, -1, 1, 2];
  let a = 0, b = 0, y0 = 0, C = 0, k = 0, tentatives = 0;
  do {
    a = aOptions[randInt(0, aOptions.length - 1)];
    b = randNonZero(-8, 8);
    y0 = randNonZero(-6, 6);
    k = -b / a;
    C = y0 - k;
    tentatives++;
    if (tentatives > 1000) throw new Error("equadiff_affine: trop de tentatives");
  } while (Math.abs(C) < 0.01);
  const x1 = randInt(1, 3);
  const reponse = roundSmart(C * Math.exp(a * x1) + k);
  const aCoeff = Math.abs(a) === 1 ? (a < 0 ? "-" : "") : String(a);
  const enonce = `$f$ est solution de l'équation différentielle $y'=${aCoeff}y ${fmtSigned(b)}$ avec $f(0)=${y0}$. Calcule $f(${x1})$ (arrondi si besoin).`;
  return { enonce, x: reponse };
}

// Paramétrage de droite dans l'espace -- distinct de appartenance_plan_v1
// (qui ne teste que l'appartenance a un PLAN). 2 modes pour eviter une
// operation unique repetitive : calcul de coordonnees pour un t donne, ou
// test d'appartenance d'un point (construit sur la droite via un vrai t, ou
// hors droite par une perturbation d'une composante mathematiquement
// irrecuperable par un autre t -- voir preuve dans le rapport de conception).
function genererDroiteParametree() {
  let u: number[];
  do {
    u = [randInt(-5, 5), randInt(-5, 5), randInt(-5, 5)];
  } while (u[0] === 0 && u[1] === 0 && u[2] === 0);
  const A = [randInt(-6, 6), randInt(-6, 6), randInt(-6, 6)];

  if (Math.random() < 0.5) {
    let t0 = 0;
    while (t0 === 0) t0 = randInt(-4, 4);
    const M = [A[0] + t0 * u[0], A[1] + t0 * u[1], A[2] + t0 * u[2]];
    const reponse = M[0] + M[1] + M[2];
    const enonce = `La droite $D$ passe par $A(${A[0]}\\,;\\,${A[1]}\\,;\\,${A[2]})$ et a pour vecteur directeur $\\vec{u}(${u[0]}\\,;\\,${u[1]}\\,;\\,${u[2]})$, soit $M(t)=A+t\\vec{u}$. Calcule la somme des coordonnées du point de $D$ obtenu pour $t=${t0}$.`;
    return { enonce, x: reponse };
  } else {
    const surLaDroite = Math.random() < 0.5;
    const tReal = randInt(-4, 4);
    const M = [A[0] + tReal * u[0], A[1] + tReal * u[1], A[2] + tReal * u[2]];
    if (!surLaDroite) {
      let idx = u.findIndex((v) => v === 0);
      if (idx === -1) idx = 0;
      let delta = 0;
      while (delta === 0) delta = randInt(-3, 3);
      M[idx] += delta;
    }
    const reponse = surLaDroite ? 1 : 0;
    const enonce = `La droite $D$ passe par $A(${A[0]}\\,;\\,${A[1]}\\,;\\,${A[2]})$ et a pour vecteur directeur $\\vec{u}(${u[0]}\\,;\\,${u[1]}\\,;\\,${u[2]})$. Le point $M(${M[0]}\\,;\\,${M[1]}\\,;\\,${M[2]})$ appartient-il à $D$ ? (réponds 1 pour oui, 0 pour non)`;
    return { enonce, x: reponse };
  }
}

// LOT 9 (Terminale, 16/08/2026) : le raisonnement par recurrence est cite
// explicitement 3 fois dans le BO 2019 (Suites -- "raisonner par recurrence
// pour etablir une propriete d'une suite" ; Algebre et geometrie -- objectif
// introductif ; Vocabulaire ensembliste et logique -- "demontrer une
// propriete par recurrence") et n'etait teste nulle part dans le catalogue.
// 2 modes couvrant les deux piliers d'une preuve par recurrence (le
// raisonnement complet n'est pas gradable automatiquement, seule sa
// mecanique l'est) :
//  - initialisation : verifier si u0 respecte la propriete visee (0/1,
//    equilibre 50/50 comme les autres templates vrai/faux du projet) ;
//  - heredite : a partir de l'hypothese de recurrence u_n<=M, calculer la
//    valeur aM+b qui majore u_{n+1} d'apres la relation de recurrence
//    (mecanique centrale du pas d'heredite, sans exiger la redaction
//    complete de l'implication logique).
function genererRecurrence() {
  const mode = randInt(0, 1);
  const aOptions = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  const a = aOptions[randInt(0, aOptions.length - 1)];
  const b = randInt(1, 10);
  if (mode === 0) {
    const vraie = Math.random() < 0.5;
    const u0 = randInt(0, 10);
    const M = vraie ? u0 + randInt(1, 10) : u0 - randNonZero(1, 5);
    const enonce = `On définit une suite par $u_0=${u0}$ et, pour tout $n$, $u_{n+1}=${fmtNum(a)}u_n+${b}$. On veut démontrer par récurrence que, pour tout $n$, $u_n\\leq ${M}$. L'étape d'initialisation (vérifier que $u_0\\leq ${M}$) est-elle vérifiée ? Réponds $1$ si oui, $0$ si non.`;
    return { enonce, x: vraie ? 1 : 0 };
  } else {
    const M = randInt(5, 20);
    const reponse = roundSmart(a * M + b);
    const enonce = `Une suite vérifie, pour tout $n$, $u_{n+1}=${fmtNum(a)}u_n+${b}$ (avec $${fmtNum(a)}\\in\\,]0\\,;\\,1[$). Dans une démonstration par récurrence, on suppose qu'à un rang $n$, $u_n\\leq ${M}$ (hypothèse de récurrence). D'après la relation de récurrence, calcule la valeur $${fmtNum(a)}\\times${M}+${b}$ qui majore alors $u_{n+1}$.`;
    return { enonce, x: reponse };
  }
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
      case "concentration_echantillon_v1": result = genererConcentrationEchantillon(); break;
      case "equadiff_affine_v1": result = genererEquadiffAffine(); break;
      case "droite_parametree_v1": result = genererDroiteParametree(); break;
      case "recurrence_v1": result = genererRecurrence(); break;
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
