// Template : calcul du discriminant d'un trinome du second degre, saisie libre (nombre entier).

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
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
    const token = await encryptPayload({ x: reponse, template: "discriminant_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
