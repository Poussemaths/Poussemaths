// Fonction consolidee : templates generatifs propres a 3e dans une seule Edge
// Function, routee par template_id (chantier de consolidation du 30/07/2026).
// evaluation_fonction_v1, probabilite_v1, moyenne_v1, pythagore_v1,
// pourcentage_v1 (3e) sont deja consolides via exo-5eme-*/exo-4eme-*. Les 12
// templates ci-dessous sont les seuls encore individuels pour 3e -- 10 en
// saisie libre (retournent {enonce, x}), 2 en QCM (inequation_v1,
// fonction_generalites_v1, retournent {enonce, choix, idx, correction}).

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
}

function nonZeroNonUn(min: number, max: number): number {
  let v = 1;
  while (v === 0 || v === 1) v = randInt(min, max);
  return v;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toString().replace(".", ",");
}

const TRIPLETS = [
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

function genererPuissance() {
  const a = randInt(2, 9);
  const n = randInt(2, 4);
  const reponse = Math.pow(a, n);
  return { enonce: `Calcule : $${a}^${n}$`, x: reponse };
}

function genererRacineCarree() {
  const k = randInt(2, 20);
  const n = k * k;
  return { enonce: `Calcule : $\\sqrt{${n}}$`, x: k };
}

function genererEquation1erDegre() {
  let a = randInt(2, 9);
  if (Math.random() < 0.5) a = -a;
  const numerator = randInt(-16, 16);
  const x = numerator / 2;
  const b = randInt(-20, 20);
  const c = a * x + b;
  const bTerm = b === 0 ? "" : b > 0 ? ` + ${fmtNum(b)}` : ` - ${fmtNum(Math.abs(b))}`;
  const aTerm = Math.abs(a) === 1 ? (a === 1 ? "x" : "-x") : `${fmtNum(a)}x`;
  const enonce = `Resoudre l'equation : $${aTerm}${bTerm} = ${fmtNum(c)}$`;
  return { enonce, x };
}

function genererSysteme() {
  // LOT 10 (16/08/2026) : l'ancien mecanisme (systeme de deux equations a
  // deux inconnues, resolu par substitution/combinaison) n'est pas atteste
  // dans le programme applicable en 3e (BO n°31 du 30/07/2020, cycle 4
  // ancien) -- aucune des 5 thematiques du programme ne mentionne la
  // resolution d'un systeme a deux inconnues. En revanche "resoudre
  // algebriquement des equations du premier degre... du type ax+b=cx+d" et
  // "resoudre des problemes modelises par des fonctions" le sont
  // explicitement : l'intersection de deux fonctions affines f et g, via
  // f(x)=g(x), est une authentique equation a UNE inconnue -- deja utilisee
  // ailleurs dans le catalogue 3e (chapitre "Fonctions linéaires et
  // affines"). Remplace l'ancien mecanisme hors-programme.
  const a = nonZero(-6, 6);
  let c = nonZero(-6, 6);
  while (c === a) c = nonZero(-6, 6);
  const x0 = randInt(-9, 9);
  const b = randInt(-12, 12);
  const d = b + (a - c) * x0;
  const y0 = a * x0 + b;
  const demanderX = Math.random() < 0.5;
  function formatTerme(coef: number): string {
    return coef >= 0 ? `+ ${fmtNum(coef)}` : `- ${fmtNum(-coef)}`;
  }
  const enonce = `On considère les fonctions affines $f(x) = ${fmtNum(a)}x ${formatTerme(b)}$ et $g(x) = ${fmtNum(c)}x ${formatTerme(d)}$. Détermine ${demanderX ? "l'abscisse" : "l'ordonnée"} du point d'intersection de leurs représentations graphiques.`;
  return { enonce, x: demanderX ? x0 : y0 };
}

function genererCoeffDirecteur() {
  const m = nonZero(-9, 9);
  const x1 = randInt(-8, 5);
  const dx = randInt(1, 6);
  const x2 = x1 + dx;
  const y1 = randInt(-10, 10);
  const y2 = y1 + m * dx;
  const enonce = `Calcule le coefficient directeur de la droite passant par $A(${x1}\\,;\\,${y1})$ et $B(${x2}\\,;\\,${y2})$.`;
  return { enonce, x: m };
}

function genererThales() {
  const ab = randInt(2, 9);
  const ac = randInt(2, 9);
  const k = randInt(2, 5);
  const ad = ab * k;
  const reponse = ac * k;
  const enonce = `Dans une configuration de Thalès, on a $AB = ${ab}$, $AD = ${ad}$, $AC = ${ac}$, avec $(BC)$ parallèle à $(DE)$. Calcule $AE$.`;
  return { enonce, x: reponse };
}

function genererTrigonometrie() {
  const [c1, c2, hyp] = TRIPLETS[randInt(0, TRIPLETS.length - 1)];
  const k = randInt(1, 4);
  const cote = (Math.random() < 0.5 ? c1 : c2) * k;
  const hypotenuse = hyp * k;
  const fonction = Math.random() < 0.5 ? "cosinus" : "sinus";
  const relation = fonction === "cosinus" ? "adjacent à" : "opposé à";
  const reponse = cote / hypotenuse;
  const enonce = `Dans un triangle rectangle, le côté ${relation} un angle aigu mesure $${cote}$ et l'hypoténuse mesure $${hypotenuse}$. Calcule le ${fonction} de cet angle (donne une fraction ou un nombre décimal).`;
  return { enonce, x: reponse };
}

function genererTransformation() {
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
  return { enonce, x: reponse };
}

function genererVolumePave() {
  const l = randInt(2, 12);
  const w = randInt(2, 12);
  const h = randInt(2, 12);
  const reponse = l * w * h;
  const enonce = `Un pavé droit a pour dimensions $${l}$ cm $\\times$ $${w}$ cm $\\times$ $${h}$ cm. Calcule son volume (en cm³).`;
  return { enonce, x: reponse };
}

function pgcdCalc(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}

function genererNotationScientifique() {
  const estMultiplication = Math.random() < 0.5;
  const p = randInt(2, 6);
  let q = p + (Math.random() < 0.5 ? 1 : -1) * randInt(0, 2);
  q = Math.max(2, Math.min(6, q));
  let reponse: number, enonce: string;
  if (estMultiplication) {
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    reponse = a * b * Math.pow(10, p + q);
    enonce = `Calcule : $(${a} \\times 10^{${p}}) \\times (${b} \\times 10^{${q}})$ (résultat développé)`;
  } else {
    const b = randInt(1, 9);
    const k = randInt(1, 9);
    const a = b * k;
    reponse = k * Math.pow(10, p - q);
    enonce = `Calcule : $(${a} \\times 10^{${p}}) \\div (${b} \\times 10^{${q}})$ (résultat développé)`;
  }
  return { enonce, x: reponse };
}

function genererReglesPuissances() {
  const a = randInt(2, 5);
  const type = randInt(0, 2);
  let m: number, n: number, reponse: number, enonce: string;
  if (type === 0) {
    m = randInt(1, 4); n = randInt(1, 4);
    reponse = Math.pow(a, m + n);
    enonce = `Calcule (donne le résultat sous forme d'un nombre) : $${a}^{${m}} \\times ${a}^{${n}}$`;
  } else if (type === 1) {
    m = randInt(2, 6); n = randInt(1, m - 1);
    reponse = Math.pow(a, m - n);
    enonce = `Calcule : $\\dfrac{${a}^{${m}}}{${a}^{${n}}}$`;
  } else {
    m = randInt(1, 3); n = randInt(1, 3);
    reponse = Math.pow(a, m * n);
    enonce = `Calcule : $(${a}^{${m}})^{${n}}$`;
  }
  return { enonce, x: reponse };
}

function genererQuartiles() {
  const vals: number[] = [];
  while (vals.length < 12) {
    const v = randInt(1, 50);
    if (!vals.includes(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  const mode = randInt(0, 2);
  let reponse: number, label: string;
  if (mode === 0) { reponse = vals[2]; label = "le premier quartile $Q_1$"; }
  else if (mode === 1) { reponse = (vals[5] + vals[6]) / 2; label = "la médiane"; }
  else { reponse = vals[8]; label = "le troisième quartile $Q_3$"; }
  const enonce = `Voici une série de $12$ valeurs, déjà triées dans l'ordre croissant : $${vals.join("\\,;\\,")}$. Détermine ${label} de cette série.`;
  return { enonce, x: reponse };
}

const SMALL_PRIMES = [2, 3, 5, 7, 11, 13];

function genererDecompositionFacteurs() {
  const nbFacteurs = randInt(2, 3);
  const primesChoisis = shuffle([...SMALL_PRIMES]).slice(0, nbFacteurs);
  const factors: Record<number, number> = {};
  let n = 1;
  for (const p of primesChoisis) {
    const e = randInt(1, p <= 3 ? 3 : 2);
    factors[p] = e;
    n *= Math.pow(p, e);
  }
  const mode = randInt(0, 1);
  let reponse: number, enonce: string;
  if (mode === 0) {
    reponse = Object.values(factors).reduce((a, b) => a + b, 0);
    enonce = `Décompose $${n}$ en produit de facteurs premiers, puis donne le nombre total de facteurs premiers de cette décomposition (comptés avec leur multiplicité).`;
  } else {
    reponse = Math.max(...Object.keys(factors).map(Number));
    enonce = `Décompose $${n}$ en produit de facteurs premiers, puis donne le plus grand facteur premier de $${n}$.`;
  }
  return { enonce, x: reponse };
}

function genererVolumesSolides() {
  const type = randInt(0, 2);
  let reponse: number, enonce: string;
  if (type === 0) {
    const c = randInt(3, 12);
    const h = randInt(3, 15);
    reponse = Math.round(((1 / 3) * c * c * h) * 10) / 10;
    enonce = `Une pyramide a une base carrée de côté $${c}$ cm et une hauteur de $${h}$ cm. Calcule son volume en cm³ (arrondis au dixième si besoin).`;
  } else if (type === 1) {
    const r = randInt(2, 10);
    const h = randInt(3, 15);
    // On calcule la reponse de reference avec 3.14 (et pas Math.PI) car c'est
    // exactement l'approximation demandee a l'eleve dans l'enonce -- sinon
    // l'ecart peut depasser 0.25 sur un arrondi au dixieme et rejeter a tort
    // une reponse d'eleve pourtant correcte (trouve en testant ce template).
    reponse = Math.round(((1 / 3) * 3.14 * r * r * h) * 10) / 10;
    enonce = `Un cône a un rayon de base $${r}$ cm et une hauteur de $${h}$ cm. Calcule son volume en cm³ (arrondis au dixième, prends $\\pi \\approx 3{,}14$).`;
  } else {
    const r = randInt(2, 10);
    reponse = Math.round(((4 / 3) * 3.14 * r * r * r) * 10) / 10;
    enonce = `Une sphère a un rayon de $${r}$ cm. Calcule son volume en cm³ (arrondis au dixième, prends $\\pi \\approx 3{,}14$).`;
  }
  return { enonce, x: reponse };
}

function genererPgcd() {
  const k = randInt(2, 12);
  const a = k * randInt(2, 10);
  const b = k * randInt(2, 10);
  const reponse = pgcdCalc(a, b);
  return { enonce: `Calcule le PGCD de $${a}$ et $${b}$.`, x: reponse };
}

function flip(rel: string): string {
  return ({ "<": ">", "≤": "≥", ">": "<", "≥": "≤" } as Record<string, string>)[rel];
}

function formatAxB(a: number, b: number): string {
  const absA = Math.abs(a);
  const aTerm = absA === 1 ? (a < 0 ? "-x" : "x") : `${a}x`;
  const bTerm = b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`;
  return `${aTerm} ${bTerm}`;
}

function genererInequation() {
  const relPool = ["<", "≤", ">", "≥"];
  let choixTxt: string[] = [];
  let correctTxt = "";
  let a = 0, b = 0, c = 0, k = 0, relOriginal = "<", relFinal = "<";

  for (let tries = 0; tries < 30; tries++) {
    a = nonZero(-6, 6);
    const m = nonZero(-5, 5);
    b = a * m;
    k = randInt(-10, 10);
    c = a * k + b;
    relOriginal = relPool[randInt(0, 3)];
    relFinal = a > 0 ? relOriginal : flip(relOriginal);
    const k2 = k + 2 * m;

    correctTxt = `x ${relFinal} ${k}`;
    const d1Txt = `x ${flip(relFinal)} ${k}`;
    const d2Txt = `x ${relFinal} ${k2}`;
    const d3Txt = `x ${flip(relFinal)} ${k2}`;

    const set = new Set([correctTxt, d1Txt, d2Txt, d3Txt]);
    if (set.size === 4) {
      choixTxt = [correctTxt, d1Txt, d2Txt, d3Txt];
      break;
    }
  }
  if (choixTxt.length !== 4) throw new Error("distracteurs non distincts apres 30 tentatives");

  const choix = shuffle(choixTxt);
  const idx = choix.indexOf(correctTxt);
  const enonce = `Résous l'inéquation $${formatAxB(a, b)} ${relOriginal} ${c}$.`;
  const correction = a < 0
    ? `On isole $x$ en divisant par $${a}$ (négatif) : le sens de l'inégalité s'inverse. $x ${relFinal} ${k}$.`
    : `On isole $x$ en divisant par $${a}$ (positif) : le sens de l'inégalité ne change pas. $x ${relFinal} ${k}$.`;
  return { enonce, choix, idx, correction };
}

function genererFonctionGeneralites() {
  const mode = Math.random() < 0.5 ? "image" : "antecedent";
  let valeursTxt: number[] = [];
  let correctVal = 0;
  let a = 0, b = 0, enonceVar = 0, funcRes = 0;

  if (mode === "image") {
    for (let tries = 0; tries < 30; tries++) {
      a = nonZeroNonUn(-6, 6);
      const m = nonZero(-10, 10);
      b = nonZero(-10, 10);
      correctVal = a * m + b;
      const d1 = m + b;
      const d2 = a * m;
      const d3 = a * (m + b);
      const set = new Set([correctVal, d1, d2, d3]);
      if (set.size === 4) { valeursTxt = [correctVal, d1, d2, d3]; enonceVar = m; break; }
    }
    if (valeursTxt.length !== 4) throw new Error("distracteurs non distincts apres 30 tentatives (image)");
  } else {
    for (let tries = 0; tries < 30; tries++) {
      a = nonZeroNonUn(-6, 6);
      const x0 = nonZero(-10, 10);
      const n = nonZero(-5, 5);
      b = a * n;
      funcRes = a * (x0 + n);
      correctVal = x0;
      const d1 = x0 + 2 * n;
      const d2 = a * x0;
      const d3 = x0 + n;
      const set = new Set([correctVal, d1, d2, d3]);
      if (set.size === 4) { valeursTxt = [correctVal, d1, d2, d3]; enonceVar = funcRes; break; }
    }
    if (valeursTxt.length !== 4) throw new Error("distracteurs non distincts apres 30 tentatives (antecedent)");
  }

  const choix = shuffle(valeursTxt).map((v) => String(v));
  const idx = choix.indexOf(String(correctVal));
  let enonce: string, correction: string;
  if (mode === "image") {
    enonce = `Soit $f$ la fonction définie par $f(x) = ${formatAxB(a, b)}$. Quelle est l'image de $${enonceVar}$ par $f$ ?`;
    correction = `$f(${enonceVar}) = ${a}\\times ${enonceVar} ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${correctVal}$.`;
  } else {
    enonce = `Soit $f$ la fonction définie par $f(x) = ${formatAxB(a, b)}$. Quel est l'antécédent de $${enonceVar}$ par $f$ ?`;
    correction = `On résout $${formatAxB(a, b)} = ${enonceVar}$, ce qui donne $x = ${correctVal}$.`;
  }
  return { enonce, choix, idx, correction };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id } = await req.json();

    // Templates QCM : renvoient {enonce, choix, idx, correction}
    if (template_id === "inequation_v1" || template_id === "fonction_generalites_v1") {
      const r = template_id === "inequation_v1" ? genererInequation() : genererFonctionGeneralites();
      const token = await encryptPayload({ idx: r.idx, correction: r.correction, template: template_id, ts: Date.now() });
      return new Response(JSON.stringify({ enonce: r.enonce, choix: r.choix, token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Templates saisie libre : renvoient {enonce, x}
    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "puissance_v1": result = genererPuissance(); break;
      case "racine_carree_v1": result = genererRacineCarree(); break;
      case "equation_1er_degre_v1": result = genererEquation1erDegre(); break;
      case "systeme_v1": result = genererSysteme(); break;
      case "coefficient_directeur_v1": result = genererCoeffDirecteur(); break;
      case "thales_v1": result = genererThales(); break;
      case "trigonometrie_v1": result = genererTrigonometrie(); break;
      case "transformation_v1": result = genererTransformation(); break;
      case "volume_pave_v1": result = genererVolumePave(); break;
      case "pgcd_v1": result = genererPgcd(); break;
      case "notation_scientifique_v1": result = genererNotationScientifique(); break;
      case "regles_puissances_v1": result = genererReglesPuissances(); break;
      case "quartiles_v1": result = genererQuartiles(); break;
      case "decomposition_facteurs_v1": result = genererDecompositionFacteurs(); break;
      case "volumes_solides_v1": result = genererVolumesSolides(); break;
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
