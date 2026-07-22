// Template : vocabulaire des fonctions (image / antecedent) via une fonction affine, QCM.
// Distracteurs = erreurs types (oubli de +b, oubli de x a, mauvaise repartition).
// Toutes les valeurs sont garanties distinctes par construction (a!=1, m!=0, x0!=0, n!=0),
// une boucle de securite revalide neanmoins avant envoi.

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

function formatAxB(a: number, b: number): string {
  const absA = Math.abs(a);
  const aTerm = absA === 1 ? (a < 0 ? "-x" : "x") : `${a}x`;
  const bTerm = b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`;
  return `${aTerm} ${bTerm}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
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
        if (set.size === 4) {
          valeursTxt = [correctVal, d1, d2, d3];
          enonceVar = m;
          break;
        }
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
        if (set.size === 4) {
          valeursTxt = [correctVal, d1, d2, d3];
          enonceVar = funcRes;
          break;
        }
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

    const token = await encryptPayload({ idx, correction, template: "fonction_generalites_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, choix, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
