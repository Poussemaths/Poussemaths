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

function genererVecteursCoordonnees() {
  const mode = randInt(0, 2);
  let reponse: number, enonce: string;
  if (mode === 0) {
    const xa = randInt(-8, 8), ya = randInt(-8, 8);
    let xb = randInt(-8, 8), yb = randInt(-8, 8);
    while (xb === xa && yb === ya) { xb = randInt(-8, 8); yb = randInt(-8, 8); }
    const demandeX = Math.random() < 0.5;
    reponse = demandeX ? xb - xa : yb - ya;
    enonce = `On donne $A(${xa}\\,;\\,${ya})$ et $B(${xb}\\,;\\,${yb})$. Donne la coordonnée ${demandeX ? "$x$" : "$y$"} du vecteur $\\vec{AB}$.`;
  } else if (mode === 1) {
    const ux = randInt(-8, 8), uy = randInt(-8, 8);
    const vx = randInt(-8, 8), vy = randInt(-8, 8);
    const demandeX = Math.random() < 0.5;
    reponse = demandeX ? ux + vx : uy + vy;
    enonce = `On donne $\\vec{u}(${ux}\\,;\\,${uy})$ et $\\vec{v}(${vx}\\,;\\,${vy})$. Donne la coordonnée ${demandeX ? "$x$" : "$y$"} du vecteur $\\vec{u}+\\vec{v}$.`;
  } else {
    const k = nonZero(-4, 4);
    const ux = randInt(-8, 8), uy = randInt(-8, 8);
    const demandeX = Math.random() < 0.5;
    reponse = demandeX ? k * ux : k * uy;
    enonce = `On donne $\\vec{u}(${ux}\\,;\\,${uy})$ et $k=${k}$. Donne la coordonnée ${demandeX ? "$x$" : "$y$"} du vecteur $k\\vec{u}$.`;
  }
  return { enonce, x: reponse };
}

function genererEquationDroite() {
  const m = nonZero(-5, 5);
  const p = randInt(-8, 8);
  const xa = randInt(-6, 6);
  const d = nonZero(-5, 5);
  const xb = xa + d;
  const ya = m * xa + p;
  const yb = m * xb + p;
  const demandeCoeff = Math.random() < 0.5;
  const reponse = demandeCoeff ? m : p;
  const enonce = `Une droite passe par les points $A(${xa}\\,;\\,${ya})$ et $B(${xb}\\,;\\,${yb})$. Donne ${demandeCoeff ? "son coefficient directeur" : "son ordonnée à l'origine"}.`;
  return { enonce, x: reponse };
}

function genererProbaConditionnelle() {
  const total = 100;
  const nB = randInt(2, 9) * 10;
  const nAinterB = randInt(1, nB - 1);
  const reponse = Math.round((nAinterB / nB) * 100) / 100;
  const enonce = `Dans une population de $${total}$ personnes, $${nB}$ vérifient l'évènement $B$. Parmi elles, $${nAinterB}$ vérifient aussi l'évènement $A$. Calcule $P_B(A)$, la probabilité de $A$ sachant $B$ (arrondis au centième si besoin).`;
  return { enonce, x: reponse };
}

// LOT 8 (2nde, 16/08/2026) : le mode 1 calculait auparavant P(S) a partir
// d'une partition B1/B2 (formule des probabilites totales). Le BO 2nde 2026
// exclut explicitement ce calcul : "Le calcul de la probabilite d'un
// evenement connaissant ses probabilites conditionnelles relatives a une
// partition de l'univers n'est pas un attendu du programme." (cette formule
// devient un attendu explicite en 1ere -- probas_totales_v1). Remplace par
// le calcul de l'AUTRE chemin unique P(B2 cap S), qui reste une simple
// multiplication le long d'un chemin, explicitement grounded pour la 2nde.
function genererArbrePondere() {
  const p1t = randInt(1, 9);
  const p2t = 10 - p1t;
  const q1t = randInt(1, 9);
  const q2t = randInt(1, 9);
  const fmt = (t: number) => `0{,}${t}`;
  const mode = randInt(0, 1);
  let reponse: number, enonce: string;
  if (mode === 0) {
    reponse = (p1t * q1t) / 100;
    enonce = `Un arbre pondéré a deux branches au premier niveau : $P(B_1)=${fmt(p1t)}$ et $P(B_2)=${fmt(p2t)}$. Au second niveau, $P_{B_1}(S)=${fmt(q1t)}$ et $P_{B_2}(S)=${fmt(q2t)}$. Calcule $P(B_1\\cap S)$.`;
  } else {
    reponse = (p2t * q2t) / 100;
    enonce = `Un arbre pondéré a deux branches au premier niveau : $P(B_1)=${fmt(p1t)}$ et $P(B_2)=${fmt(p2t)}$. Au second niveau, $P_{B_1}(S)=${fmt(q1t)}$ et $P_{B_2}(S)=${fmt(q2t)}$. Calcule $P(B_2\\cap S)$.`;
  }
  return { enonce, x: reponse };
}

function genererTauxEvolutionBase() {
  const v0unit = randInt(2, 20);
  const v0 = v0unit * 20;
  const tUnit = nonZero(-8, 12);
  const t = tUnit * 5;
  const v1 = v0 + (v0 * t) / 100;
  const enonce = `Une grandeur passe de $${v0}$ à $${v1}$. Calcule son taux d'évolution en pourcentage (donne un nombre, positif si augmentation, négatif si diminution).`;
  return { enonce, x: t };
}

// LOT 7 (1ere, 16/08/2026) : taux_evolution_v1 est partage avec la 2nde. Le
// mode existant (genererTauxEvolutionBase, copie a l'identique) reste le
// comportement par defaut -- inchange pour tout niveau hors 1ere/2nde.
// Trois nouveaux modes couvrent les items BO non testes par le mode de base
// (application directe valeur finale/initiale, evolutions successives,
// evolution reciproque).
//
// LOT 8 (2nde, 16/08/2026) : audit du BO 2nde 2026 (section Statistiques >
// Evolution) montre que ces trois modes sont EXPLICITEMENT des contenus
// 2nde, pas seulement 1ere : "Calculer le taux d'evolution global a partir
// des taux d'evolution successifs. Calculer un taux d'evolution reciproque."
// -- deja partiellement testes en fixe pour la 2nde via stat_2_C. Gate donc
// elargi a niveau==="1ere" OU niveau==="2nde" (le mode de base reste
// disponible pour les deux, desormais un mode parmi quatre plutot que le
// seul possible -- aucune regression, uniquement un ajout de couverture).
//
// Mode "evolutions successives" : verifie exhaustivement (script offline,
// LOT7) que pour t1,t2 multiples de 5 non nuls dans [-40,60], le taux global
// t1+t2+t1*t2/100 est TOUJOURS un multiple exact de 0,25 -- jamais de
// decimale infinie, tolerance standard suffisante.
//
// Mode "evolution reciproque" : un taux t quelconque donne generalement un
// taux reciproque a decimales infinies (ex. t=20 -> -16,666...). Pool
// curate ou les deux sens (t et son reciproque) sont des entiers exacts.
function genererTauxEvolution(niveau?: string) {
  if (niveau !== "1ere" && niveau !== "2nde") return genererTauxEvolutionBase();

  const mode = randInt(0, 3);
  if (mode === 0) return genererTauxEvolutionBase();

  if (mode === 1) {
    const v0unit = randInt(2, 20);
    const v0 = v0unit * 20;
    const tUnit = nonZero(-8, 12);
    const t = tUnit * 5;
    const v1 = v0 + (v0 * t) / 100;
    const versFinale = Math.random() < 0.5;
    if (versFinale) {
      const enonce = `Une grandeur vaut $${v0}$. Elle subit une évolution de $${t}\\%$. Calcule sa valeur finale.`;
      return { enonce, x: v1 };
    } else {
      const enonce = `Une grandeur, après avoir évolué de $${t}\\%$, vaut $${v1}$. Calcule sa valeur initiale.`;
      return { enonce, x: v0 };
    }
  }

  if (mode === 2) {
    const t1 = nonZero(-8, 12) * 5;
    const t2 = nonZero(-8, 12) * 5;
    const global = t1 + t2 + (t1 * t2) / 100;
    const enonce = `Une grandeur subit deux évolutions successives : d'abord $${t1}\\%$, puis $${t2}\\%$. Calcule le taux d'évolution global équivalent (en %, avec les décimales si besoin).`;
    return { enonce, x: global };
  }

  const poolRecip = [25, -20, 100, -50, 150, -60];
  const t = choice(poolRecip);
  const reponse = (-100 * t) / (100 + t);
  const enonce = `Une grandeur subit une évolution de $${t}\\%$. Quel est le taux d'évolution réciproque (celui qui permettrait de revenir exactement à la valeur initiale) ?`;
  return { enonce, x: reponse };
}

function genererEquationCarre() {
  const mode = randInt(0, 1);
  let reponse: number, enonce: string;
  if (mode === 0) {
    const k = randInt(2, 12);
    const a = k * k;
    enonce = `Résous l'équation $x^2 = ${a}$ et donne la solution positive.`;
    reponse = k;
  } else {
    const a = randInt(-20, 20);
    reponse = a > 0 ? 2 : a === 0 ? 1 : 0;
    enonce = `Combien de solutions réelles admet l'équation $x^2 = ${a}$ ?`;
  }
  return { enonce, x: reponse };
}

function td(v: string | number): string {
  return `<td style="border:1px solid #999;padding:3px 8px">${v}</td>`;
}

function tableauCroiseHtml(effA: number, effNonA: number, a: number, b: number, c: number, d: number, hideIdx: number | null): string {
  const cell = (v: number, idx: number) => (hideIdx === idx ? "?" : v);
  return `<table style="border-collapse:collapse;margin:6px 0;font-size:14px"><tr><td></td>${td("<b>B</b>")}${td("<b>non-B</b>")}${td("<b>Total</b>")}</tr>` +
    `<tr>${td("<b>A</b>")}${td(cell(a, 0))}${td(cell(b, 1))}${td(effA)}</tr>` +
    `<tr>${td("<b>non-A</b>")}${td(cell(c, 2))}${td(cell(d, 3))}${td(effNonA)}</tr>` +
    `<tr>${td("<b>Total</b>")}${td(a + c)}${td(b + d)}${td(effA + effNonA)}</tr></table>`;
}

function tableauCroiseHtmlSansMarges(a: number, b: number, c: number, d: number): string {
  return `<table style="border-collapse:collapse;margin:6px 0;font-size:14px"><tr><td></td>${td("<b>B</b>")}${td("<b>non-B</b>")}</tr>` +
    `<tr>${td("<b>A</b>")}${td(a)}${td(b)}</tr>` +
    `<tr>${td("<b>non-A</b>")}${td(c)}${td(d)}</tr></table>`;
}

// tableau_croise_v1 -- Croisement de deux variables qualitatives (BO 2026 2nde,
// section dediee, distincte de "Probabilites"). 5 modes tires aleatoirement,
// chacun une tache pedagogique distincte (pas une reformulation numerique) :
// 0=completer un effectif manquant, 1=effectif marginal, 2=frequence
// conditionnelle lue sur le tableau, 3=effectif retrouve depuis une frequence
// conditionnelle donnee, 4=comparaison de deux frequences conditionnelles.
// Le mode 2 chevauche partiellement proba_conditionnelle_v1 en calcul mais pas
// en registre (tableau croise complet a identifier, pas une phrase narrative
// isolee) -- distinction actee explicitement avec Jamal (LOT 3).
function genererTableauCroise() {
  const mode = randInt(0, 4);
  const effA = randInt(2, 9) * 10;
  const effNonA = 100 - effA;
  const a = randInt(1, effA - 1);
  const b = effA - a;
  const c = randInt(1, effNonA - 1);
  const d = effNonA - c;
  const effB = a + c;
  const effNonB = b + d;

  if (mode === 0) {
    const hideIdx = randInt(0, 3);
    const valeurs = [a, b, c, d];
    const enonce = `On interroge 100 personnes sur deux caractéristiques $A$ et $B$. Voici le tableau croisé des effectifs (une case est manquante) :<br>${tableauCroiseHtml(effA, effNonA, a, b, c, d, hideIdx)}Quel est l'effectif manquant ?`;
    return { enonce, x: valeurs[hideIdx] };
  }

  if (mode === 1) {
    const margeChoisie = randInt(0, 3);
    const libelles = ["vérifient $A$", "ne vérifient pas $A$", "vérifient $B$", "ne vérifient pas $B$"];
    const enonce = `On interroge 100 personnes sur deux caractéristiques $A$ et $B$. Voici les effectifs de chaque catégorie croisée :<br>${tableauCroiseHtmlSansMarges(a, b, c, d)}Combien de personnes au total ${libelles[margeChoisie]} ?`;
    const reponse = [effA, effNonA, effB, effNonB][margeChoisie];
    return { enonce, x: reponse };
  }

  if (mode === 2) {
    const dir = randInt(0, 1);
    const reponse = Math.round((a / (dir === 0 ? effA : effB)) * 100) / 100;
    const enonce = dir === 0
      ? `On interroge 100 personnes. Tableau croisé :<br>${tableauCroiseHtml(effA, effNonA, a, b, c, d, null)}Parmi les personnes qui vérifient $A$, quelle proportion vérifie aussi $B$ ? (arrondis au centième)`
      : `On interroge 100 personnes. Tableau croisé :<br>${tableauCroiseHtml(effA, effNonA, a, b, c, d, null)}Parmi les personnes qui vérifient $B$, quelle proportion vérifie aussi $A$ ? (arrondis au centième)`;
    return { enonce, x: reponse };
  }

  if (mode === 3) {
    const baseNonA = Math.random() < 0.5;
    const base = baseNonA ? effNonA : effA;
    const freqOptions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const freq = freqOptions[randInt(0, freqOptions.length - 1)];
    const inter = Math.round(freq * base);
    const enonce = `On interroge 100 personnes. ${base} d'entre elles ${baseNonA ? "ne vérifient pas" : "vérifient"} $A$. Parmi ce groupe, ${Math.round(freq * 100)}% vérifient aussi $B$. Combien de personnes de ce groupe vérifient à la fois ${baseNonA ? "non-$A$" : "$A$"} et $B$ ?`;
    return { enonce, x: inter };
  }

  // mode 4 : comparer deux frequences conditionnelles
  const freqA = a / effA;
  const freqNonA = c / effNonA;
  if (freqA === freqNonA) return genererTableauCroise(); // redraw, evite une question sans reponse univoque
  const reponse = freqA > freqNonA ? 1 : 0;
  const enonce = `On interroge 100 personnes. Tableau croisé :<br>${tableauCroiseHtml(effA, effNonA, a, b, c, d, null)}La fréquence de $B$ est-elle plus élevée chez les personnes qui vérifient $A$ que chez celles qui ne le vérifient pas ? (1 si oui, 0 si non)`;
  return { enonce, x: reponse };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id, niveau } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "fonction_reference_v1": result = genererFonctionReference(); break;
      case "distance_v1": result = genererDistance(); break;
      case "valeur_absolue_v1": result = genererValeurAbsolue(); break;
      case "vecteurs_coordonnees_v1": result = genererVecteursCoordonnees(); break;
      case "equation_droite_v1": result = genererEquationDroite(); break;
      case "proba_conditionnelle_v1": result = genererProbaConditionnelle(); break;
      case "arbre_pondere_v1": result = genererArbrePondere(); break;
      case "taux_evolution_v1": result = genererTauxEvolution(niveau); break;
      case "equation_carre_v1": result = genererEquationCarre(); break;
      case "tableau_croise_v1": result = genererTableauCroise(); break;
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
