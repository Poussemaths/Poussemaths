// Template : inequation ax+b R c (QCM), avec generation de distracteurs.
// Erreurs types simulees : oubli d'inverser le sens en divisant par un negatif,
// erreur de signe en isolant b. Les 4 options sont garanties distinctes par
// construction (m != 0), une boucle de securite revalide neanmoins avant envoi.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(min, max);
  return v;
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

    const token = await encryptPayload({ idx, correction, template: "inequation_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, choix, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
