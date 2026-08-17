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

// LOT 6B (6e, 16/08/2026) : les criteres de divisibilite par 3 et 9 sont une
// competence 5e (cycle 4), pas 6e (cycle 3, seuls 2/5/10 sont attestes). Pool
// desormais dependant du niveau -- 5e garde exactement le pool d'origine, 6e
// est restreint. Le comportement par defaut (niveau absent/inconnu) reste le
// pool complet, pour ne jamais casser un appel existant qui n'enverrait pas
// encore le parametre niveau.
function genererMultiplesDiviseurs(niveau?: string) {
  const pool6e = [2, 4, 5, 6, 8, 10];
  const pool5e = [2, 3, 4, 5, 6, 8, 9, 10];
  const d = choice(niveau === "6eme" ? pool6e : pool5e);
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

// LOT 6 (6e, 16/08/2026) : trois vrais manques BO identifies lors de l'audit
// (bissectrice d'un angle saillant, mediatrices d'un triangle/cercle
// circonscrit, inegalite triangulaire) -- zero couverture avant ce lot.
function genererBissectrice() {
  const mode = randInt(0, 2);
  const half = randInt(10, 80);
  if (mode === 0) {
    const theta = half * 2;
    const enonce = `Un angle $\\widehat{AOB}$ mesure $${theta}°$. Sa bissectrice $[OM)$ le partage en deux angles égaux. Quelle est la mesure de l'angle $\\widehat{AOM}$ (en degrés) ?`;
    return { enonce, x: half };
  } else if (mode === 1) {
    const enonce = `La bissectrice $[OM)$ d'un angle $\\widehat{AOB}$ partage celui-ci en deux angles égaux. On sait que $\\widehat{AOM}=${half}°$. Quelle est la mesure de l'angle total $\\widehat{AOB}$ (en degrés) ?`;
    return { enonce, x: half * 2 };
  } else {
    const enonce = `$[OM)$ est la bissectrice de l'angle $\\widehat{AOB}$. On sait que $\\widehat{AOM}=${half}°$. Quelle est la mesure de l'angle $\\widehat{MOB}$ (en degrés) ?`;
    return { enonce, x: half };
  }
}

function genererCercleCirconscrit() {
  const mode = randInt(0, 2);
  const x = randInt(20, 120) / 10;
  if (mode === 0) {
    const enonce = `Dans un triangle $ABC$, le point $O$ est le point de concours des trois médiatrices : c'est le centre du cercle circonscrit, équidistant des trois sommets. On sait que $OA=${x}$ cm. Quelle est la longueur $OB$ (en cm) ?`;
    return { enonce, x };
  } else if (mode === 1) {
    const enonce = `Dans un triangle $ABC$, $O$ est le centre du cercle circonscrit (point de concours des médiatrices, équidistant de $A$, $B$ et $C$). On sait que $OA=${x}$ cm. Calcule la somme $OB+OC$ (en cm).`;
    return { enonce, x: x * 2 };
  } else {
    const enonce = `Dans un triangle $ABC$, le centre du cercle circonscrit $O$ (point de concours des médiatrices) vérifie $OA=OB=OC=R$. Sachant que $R=${x}$ cm, quel est le diamètre du cercle circonscrit (en cm) ?`;
    return { enonce, x: x * 2 };
  }
}

function genererInegaliteTriangulaire() {
  const mode = randInt(0, 1);
  if (mode === 0) {
    const valide = randInt(0, 1) === 1;
    const a = randInt(3, 15);
    const b = randInt(3, 15);
    let c: number;
    if (valide) {
      const min = Math.abs(a - b) + 1;
      const max = a + b - 1;
      c = randInt(min, max);
    } else {
      c = randInt(a + b, a + b + 10);
    }
    const cotes = [a, b, c];
    for (let i = cotes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cotes[i], cotes[j]] = [cotes[j], cotes[i]];
    }
    const enonce = `On dispose de trois segments de longueurs $${cotes[0]}$ cm, $${cotes[1]}$ cm et $${cotes[2]}$ cm. Peut-on construire un triangle avec ces trois longueurs ? Réponds $1$ si oui, $0$ si non.`;
    return { enonce, x: valide ? 1 : 0 };
  } else {
    const a = randInt(3, 15);
    const b = randInt(3, 15);
    const enonce = `Un triangle a deux côtés de $${a}$ cm et $${b}$ cm. Quelle est la plus grande valeur entière (en cm) que peut prendre le troisième côté pour que le triangle soit constructible ?`;
    return { enonce, x: a + b - 1 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id, niveau } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "priorites_v1": result = genererPriorites(); break;
      case "fraction_addition_v1": result = genererFractionAddition(); break;
      case "angle_triangle_v1": result = genererAngleTriangle(); break;
      case "multiples_diviseurs_v1": result = genererMultiplesDiviseurs(niveau); break;
      case "volume_cube_v1": result = genererVolumeCube(); break;
      case "bissectrice_v1": result = genererBissectrice(); break;
      case "cercle_circonscrit_v1": result = genererCercleCirconscrit(); break;
      case "inegalite_triangulaire_v1": result = genererInegaliteTriangulaire(); break;
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
