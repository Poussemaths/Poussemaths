// Fonction consolidee : templates generatifs propres a 5e dans une seule Edge
// Function, routee par template_id (chantier de consolidation du 30/07/2026).
// Les templates de 5e deja consolides via 4e (relatifs_v1, moyenne_v1,
// pourcentage_v1, probabilite_v1) restent routes vers exo-4eme-* -- seuls
// les 2 templates encore individuels sont repris ici.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

function genererAirePerimetre() {
  const estRectangle = Math.random() < 0.6;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { template_id } = await req.json();

    let result: { enonce: string; x: number } | null = null;
    switch (template_id) {
      case "evaluation_fonction_v1": result = genererEvaluationFonction(); break;
      case "aire_perimetre_v1": result = genererAirePerimetre(); break;
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
