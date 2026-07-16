// Template : equation du premier degre ax + b = c, saisie libre (nombre)
// Ne renvoie jamais la reponse en clair : elle est chiffree (AES-GCM) dans le token
// que le client doit renvoyer tel quel a exo-equation-valider.

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fmtNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toString().replace(".", ",");
}

function enonceEquation(a: number, b: number, c: number): string {
  const bTerm = b === 0 ? "" : b > 0 ? ` + ${fmtNum(b)}` : ` - ${fmtNum(Math.abs(b))}`;
  const aTerm = Math.abs(a) === 1 ? (a === 1 ? "x" : "-x") : `${fmtNum(a)}x`;
  return `Resoudre l'equation : $${aTerm}${bTerm} = ${fmtNum(c)}$`;
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

Deno.serve(async (_req) => {
  try {
    let a = randInt(2, 9);
    if (Math.random() < 0.5) a = -a;
    const numerator = randInt(-16, 16);
    const x = numerator / 2;
    const b = randInt(-20, 20);
    const c = a * x + b;

    const enonce = enonceEquation(a, b, c);
    const token = await encryptPayload({ x, template: "equation_1er_degre_v1", ts: Date.now() });

    return new Response(JSON.stringify({ enonce, token }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
