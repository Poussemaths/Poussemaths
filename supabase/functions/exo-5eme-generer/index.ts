// Fonction consolidee : templates generatifs propres a 5e dans une seule Edge
// Function, routee par template_id (chantier de consolidation du 30/07/2026).
// Les templates de 5e deja consolides via 4e (relatifs_v1, moyenne_v1,
// pourcentage_v1, probabilite_v1) restent routes vers exo-4eme-* -- seuls
// les 2 templates encore individuels sont repris ici.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
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

function genererEvaluationFonction() {
  let a = randInt(2, 9);
  if (Math.random() < 0.5) a = -a;
  const b = randInt(-15, 15);
  const k = randInt(-8, 8);
  const reponse = a * k + b;
  const bTerm = b === 0 ? "" : b > 0 ? ` + ${fmtNum(b)}` : ` - ${fmtNum(Math.abs(b))}`;
  const enonce = `Soit $f(x) = ${fmtNum(a)}x${bTerm}$. Calcule $f(${fmtNum(k)})$.`;
  return { enonce, x: reponse };
}

// LOT 7 (audit aire_perimetre_v1, 16/08/2026) : "Calculer l'aire d'un
// triangle" est une competence explicitement 5e (Cycle 4 nouveau programme,
// section Cinquieme > Triangles), absente du Cycle 3 (6e) qui ne couvre que
// l'aire du carre/rectangle. Le mode triangle est donc reserve a la 5e ;
// comportement 5e strictement inchange (meme expression Math.random()<0.6),
// 6e (ou tout autre niveau) force au mode rectangle uniquement.
function genererAirePerimetre(niveau?: string) {
  const estRectangle = niveau === "5eme" ? Math.random() < 0.6 : true;
  let enonce: string, reponse: number;

  if (estRectangle) {
    const L = randInt(3, 25);
    const l = randInt(3, 25);
    const demanderAire = Math.random() < 0.5;
    if (demanderAire) {
      reponse = L * l;
      enonce = `Un rectangle a pour longueur $${L}$ cm et pour largeur $${l}$ cm. Calcule son aire (en cm²).`;
    } else {
      reponse = 2 * (L + l);
      enonce = `Un rectangle a pour longueur $${L}$ cm et pour largeur $${l}$ cm. Calcule son périmètre (en cm).`;
    }
  } else {
    let a = randInt(3, 20);
    let b = randInt(3, 20);
    if ((a * b) % 2 !== 0) b += 1;
    reponse = (a * b) / 2;
    enonce = `Un triangle rectangle a pour côtés de l'angle droit $${a}$ cm et $${b}$ cm. Calcule son aire (en cm²).`;
  }
  return { enonce, x: reponse };
}

// puissances_5e_v1 -- carre/cube uniquement (jamais puissances de 10 / notation
// scientifique, qui relevent d'un autre registre deja couvert en 3e). 3 modes :
// 0=carre (n in [2,12], bornes exactes du BO 5e "connaitre les carres des
// entiers de 0 a 12"), 1=cube (n in [2,10]), 2=expression combinee (carre ou
// cube avec une operation simple +/-/x), conforme a la capacite BO "calculer
// la valeur numerique d'expressions contenant des puissances simples,
// additions, soustractions et produits".
function genererPuissances5e() {
  const mode = randInt(0, 2);
  if (mode === 0) {
    const n = randInt(2, 12);
    return { enonce: `Calcule $${n}^2$.`, x: n * n };
  }
  if (mode === 1) {
    const n = randInt(2, 10);
    return { enonce: `Calcule $${n}^3$.`, x: n * n * n };
  }
  const carre = Math.random() < 0.5;
  if (carre) {
    const n = randInt(2, 9);
    const a = randInt(2, 5);
    const b = nonZero(-10, 10);
    const reponse = a * n * n + b;
    const enonce = `Calcule : $${a}\\times${n}^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}$`;
    return { enonce, x: reponse };
  }
  const n = randInt(2, 8);
  const c = randInt(1, 20);
  const reponse = n * n * n - c;
  const enonce = `Calcule : $${n}^3 - ${c}$`;
  return { enonce, x: reponse };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id, niveau } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "evaluation_fonction_v1": result = genererEvaluationFonction(); break;
      case "aire_perimetre_v1": result = genererAirePerimetre(niveau); break;
      case "puissances_5e_v1": result = genererPuissances5e(); break;
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
