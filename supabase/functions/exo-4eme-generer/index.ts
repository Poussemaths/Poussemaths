// Fonction consolidee : tous les templates generatifs de 4e dans une seule Edge
// Function, routee par template_id (chantier de consolidation du 30/07/2026,
// motive par le plafond de 100 fonctions du plan Supabase). Chaque branche du
// switch reprend a l'identique la logique de generation de son ancien fichier
// exo-<template>-generer (aucun changement de comportement, juste le point de
// deploiement qui change).

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

const TRIPLETS_PYTHAGORE = [
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

function genererRelatifs() {
  const a = nonZero(-20, 20);
  const b = nonZero(-20, 20);
  const soustraction = Math.random() < 0.5;
  const reponse = soustraction ? a - b : a + b;
  const enonce = `Calcule : $${fmtRelatif(a)} ${soustraction ? "-" : "+"} ${fmtRelatif(b)}$`;
  return { enonce, x: reponse };
}

function genererPythagore() {
  const [c1, c2, hyp] = TRIPLETS_PYTHAGORE[randInt(0, TRIPLETS_PYTHAGORE.length - 1)];
  const k = randInt(1, 4);
  const a = c1 * k;
  const b = c2 * k;
  const reponse = hyp * k;
  const enonce = `Un triangle rectangle a des côtés de l'angle droit mesurant $${a}$ cm et $${b}$ cm. Calcule la longueur de l'hypoténuse (en cm).`;
  return { enonce, x: reponse };
}

function genererPourcentage() {
  const k = randInt(1, 19); // p = 5k -> 5..95
  const m = randInt(1, 25); // Y = 20m -> 20..500
  const p = 5 * k;
  const y = 20 * m;
  const reponse = k * m;
  const enonce = `Calcule : $${p}\\%$ de $${y}$`;
  return { enonce, x: reponse };
}

function genererProbabilite() {
  const denominateurs = [4, 5, 8, 10, 20, 25, 40, 50];
  const total = denominateurs[randInt(0, denominateurs.length - 1)];
  const favorables = randInt(1, total - 1);
  const reponse = favorables / total;
  const couleur = ["rouges", "bleues", "vertes", "jaunes"][randInt(0, 3)];
  const enonce = `Un sac contient $${total}$ boules dont $${favorables}$ ${couleur}. On tire une boule au hasard. Quelle est la probabilité de tirer une boule ${couleur} ? (donne une fraction ou un nombre décimal)`;
  return { enonce, x: reponse };
}

function genererMoyenne() {
  const nb = randInt(4, 6);
  const valeurs = Array.from({ length: nb }, () => randInt(2, 20));
  let somme = valeurs.reduce((a, b) => a + b, 0);
  const reste = somme % nb;
  if (reste !== 0) valeurs[0] += nb - reste;
  somme = valeurs.reduce((a, b) => a + b, 0);
  const moyenne = somme / nb;
  const enonce = `Calcule la moyenne de la série : $${valeurs.join(" \\, ; \\, ")}$`;
  return { enonce, x: moyenne };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "relatifs_v1": result = genererRelatifs(); break;
      case "pythagore_v1": result = genererPythagore(); break;
      case "pourcentage_v1": result = genererPourcentage(); break;
      case "probabilite_v1": result = genererProbabilite(); break;
      case "moyenne_v1": result = genererMoyenne(); break;
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
