// Validation cote serveur des exercices "fixes" (non generes). Chantier
// anti-triche du 31/07/2026 : jusqu'ici, la correction de ces exercices etait
// un champ texte livre au navigateur (lisible via Ctrl+U) et le score etait
// calcule et ecrit cote client sans aucune verification serveur. Cette
// fonction reprend EXACTEMENT (verbatim) le moteur verifierReponse() du
// client (index.html) -- pur JS sans API navigateur, donc portable tel quel
// en Deno -- pour ne pas reintroduire les ~15 classes de bugs deja corrigees
// dedans au fil des audits precedents.
//
// Deux actions :
// - "verifier" : verifie UNE question, ne touche jamais la base. Sert au
//   feedback immediat affiche a l'ecran (jamais la correction avant cet appel).
// - "terminer" : recoit les reponses brutes des 5 questions, RE-VERIFIE
//   chacune independamment (ne fait jamais confiance a un score fourni par le
//   client), calcule le score reel et ecrit la ligne progression. C'est la
//   seule maniere d'enregistrer un score pour un exercice fixe desormais --
//   le client n'ecrit plus jamais directement dans la table progression pour
//   ces exercices (cf. retrait de l'appel direct sauvegarderProgression()).

async function verifierUtilisateur(jwt: string): Promise<string | null> {
  if (!jwt) return null;
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: "sb_publishable_z9cxUDLcFMFsb5w692JScg_VSzVvhp2" },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return user.id ?? null;
  } catch {
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ═══════════════════════════════════════
//  MOTEUR DE VERIFICATION -- copie verbatim de verifierReponse() (index.html)
//  Pur JS/TS, aucune API navigateur : portage direct sans reecriture pour ne
//  pas reintroduire les bugs deja corriges (fractions, milliers, sci-notation,
//  unites, LaTeX, intervalles, oui/non...). Ne PAS "ameliorer" ce code ici --
//  toute correction doit d'abord etre appliquee cote client puis re-copiee.
// ═══════════════════════════════════════
function verifierReponse(userRaw: string, correctionRaw: string): boolean {
  const supprimerEspacesMilliers = (s: string) => s.replace(/(\d)\s+(\d)/g, '$1$2').replace(/(\d)\s+(\d)/g, '$1$2');

  const userNorm = supprimerEspacesMilliers(userRaw.trim());
  const corrNorm = supprimerEspacesMilliers(correctionRaw);

  const clean = (s: string) => s
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/['']/g, "'")
    .replace(/[−–]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√/g, 'sqrt')
    .replace(/≤/g, 'leq')
    .replace(/≥/g, 'geq')
    .replace(/≠/g, 'neq')
    .toLowerCase();

  const user = clean(userNorm);

  const extraireResultatFinal = (correction: string): number[] => {
    const cPreserve = correction
      .replace(/\$([^$]+)\$/g, ' $1 ')
      .replace(/\{,\}/g, '.')
      .replace(/\\,/g, '')
      .replace(/[−–]/g, '-')
      .replace(/\\approx|\\Rightarrow|\\rightarrow|\\Leftrightarrow|\\Longrightarrow|\\to(?![a-zA-Z])/gi, '=')
      .replace(/(\d)\s+(\d)/g, '$1$2')
      .replace(/(\d)\s+(\d)/g, '$1$2');

    const parties = cPreserve.split(/[=≈→]/);
    const resultats: number[] = [];

    for (const partie of parties) {
      const p = partie.trim();

      const matchDfrac = p.match(/(-)?\\d?frac\{(-?\d+)\}\{(-?\d+)\}\s*$/);
      if (matchDfrac) {
        const den = parseFloat(matchDfrac[3]);
        if (den !== 0) {
          const signeExterne = matchDfrac[1] ? -1 : 1;
          resultats.push(signeExterne * parseFloat(matchDfrac[2]) / den);
          continue;
        }
      }

      const UNITE_RE = 'cm²|cm³|dm³|km\\/h|m\\/s|mL|cL|dL|hL|mg|min|rad|cm|dm|km|mm|kg|m²|m³|m|g|s|h|L|°|%|€';
      const pClean = p.replace(/\\[a-zA-Z]+/g, ' ').replace(/\\[%$&_#]/g, ' ').replace(/[{}]/g, ' ')
        .replace(/[.,;:]+\s*$/, '')
        .replace(new RegExp(`\\s*(?:${UNITE_RE})\\s*$`, 'i'), '')
        .replace(/[.,;:]+\s*$/, '')
        .replace(/\s+(?:[a-zàâäéèêëïîôöùûüç]{1,2}\s+)*[a-zàâäéèêëïîôöùûüç]{3,}\s*$/i, '');
      const matchFin = pClean.match(/(-?\d+(?:\.\d+)?)\s*$/);
      if (matchFin) {
        const avantNombre = pClean.slice(0, matchFin.index);
        const hasFrac = /\\d?frac\{/i.test(p);
        const hasFracSimple = /\\d?frac\{-?\d+\}\{-?\d+\}/i.test(p);
        const hasTrailingCaret = /\^\s*$/.test(avantNombre);
        if (!/[a-zA-Z]/.test(avantNombre) && !/\\sqrt/i.test(p) && !/\\times\s*10\^/i.test(p) && !(hasFrac && !hasFracSimple) && !hasTrailingCaret) resultats.push(parseFloat(matchFin[1]));
        continue;
      }

      const matchFrac = pClean.match(/(-?\d+)\s*\/\s*(-?\d+)\s*$/);
      if (matchFrac) {
        const den = parseFloat(matchFrac[2]);
        if (den !== 0) resultats.push(parseFloat(matchFrac[1]) / den);
      }
    }

    return resultats.length > 0 ? [resultats[resultats.length - 1]] : [];
  };

  const extraireTousNombres = (correction: string): number[] => {
    const nums: number[] = [];
    const fracRe = /(-)?\\d?frac\{(-?\d+)\}\{(-?\d+)\}/g;
    let fm;
    while ((fm = fracRe.exec(correction)) !== null) {
      const den = parseFloat(fm[3]);
      if (den !== 0) nums.push((fm[1] ? -1 : 1) * parseFloat(fm[2]) / den);
    }
    const c = correction
      .replace(/\$([^$]+)\$/g, ' $1 ')
      .replace(/\{,\}/g, '.')
      .replace(/\\,/g, '')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}]/g, ' ')
      .replace(/[−–]/g, '-');
    const matches = c.matchAll(/(?<![a-zA-Z/])(-?\d+(?:[.,]\d+)?)(?![a-zA-Z/\d])/g);
    for (const m of matches) nums.push(parseFloat(m[1].replace(',', '.')));
    return [...new Set(nums)];
  };

  const resultatFinal = extraireResultatFinal(corrNorm);
  const tousNombres = extraireTousNombres(corrNorm);

  // 1. Fraction tapee par l'eleve
  const fracMatch = user.match(/^(-?\d+)\.?(\d*)\/(-?\d+)\.?(\d*)$/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1] + (fracMatch[2] ? '.' + fracMatch[2] : ''));
    const den = parseFloat(fracMatch[3] + (fracMatch[4] ? '.' + fracMatch[4] : ''));
    if (den === 0) return false;
    const fracVal = num / den;
    for (const r of resultatFinal) {
      const tolerance = 0.001;
      if (Math.abs(fracVal - r) < tolerance) return true;
    }
    return false;
  }

  // 2. Nombre unique
  const userNum = parseFloat(user.replace(',', '.'));
  if (!isNaN(userNum)) {
    for (const r of resultatFinal) {
      const tolerance = 0.001;
      if (Math.abs(userNum - r) < tolerance) return true;
    }
    const nombresUniques = [...new Set(tousNombres.map(n => Math.round(n * 100) / 100))];
    if (resultatFinal.length === 0 && nombresUniques.length === 1) {
      if (Math.abs(userNum - nombresUniques[0]) < 0.001) return true;
    }
  }

  // 3. Reponses multiples
  const userParts = userRaw.split(/;|,(?!\d)|\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (userParts.length >= 2) {
    const userNums = userParts.map(s => {
      const f = s.match(/^(-?\d+)\/(\d+)$/);
      if (f) return parseFloat(f[1]) / parseFloat(f[2]);
      return parseFloat(clean(s));
    }).filter(n => !isNaN(n));

    if (userNums.length >= 2) {
      let matchCount = 0;
      for (const u of userNums) {
        for (const a of tousNombres) {
          if (Math.abs(u - a) < 0.001) { matchCount++; break; }
        }
      }
      if (matchCount === userNums.length) return true;
    }
  }

  // 4. Texte normalise (intervalles, expressions)
  if (resultatFinal.length === 0) {
    const corrClean = clean(correctionRaw
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/\\,/g, '')
      .replace(/\\times/gi, '*')
      .replace(/\\div/gi, '/')
      .replace(/[\\{}]/g, '')
      .replace(/rightarrow/gi, '')
      .replace(/Rightarrow/gi, '')
    );

    const extraireSegmentFinalAlgebrique = (correction: string): string => {
      const seg = correction
        .replace(/\$([^$]+)\$/g, ' $1 ')
        .replace(/\{,\}/g, '.')
        .replace(/\\,/g, '')
        .replace(/[−–]/g, '-')
        .replace(/\\approx|\\Rightarrow|\\rightarrow|\\Leftrightarrow|\\Longrightarrow|\\to(?![a-zA-Z])/gi, '=');
      const parties = seg.split(/[=≈→]/);
      return (parties[parties.length - 1] || '')
        .replace(/\\times/gi, '*')
        .replace(/\\div/gi, '/')
        .replace(/[\\{}]/g, '')
        .trim();
    };
    const decouperTermes = (expr: string): string[] => {
      const termes: string[] = [];
      let depth = 0, cur = '';
      for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        if (c === '(') depth++;
        if (c === ')') depth--;
        if (depth === 0 && (c === '+' || c === '-') && cur.length > 0) {
          termes.push(cur);
          cur = c;
        } else {
          cur += c;
        }
      }
      if (cur.length > 0) termes.push(cur);
      return termes
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => (t[0] === '+' || t[0] === '-') ? t : '+' + t)
        .sort();
    };
    const segFinalClean = clean(extraireSegmentFinalAlgebrique(correctionRaw));
    const segEstProse = /[a-z]{3,}/i.test(segFinalClean);
    const corrTermes = segEstProse ? [] : decouperTermes(segFinalClean);
    if (corrTermes.length >= 2) {
      const userTermes = decouperTermes(user);
      if (corrTermes.length === userTermes.length && corrTermes.every((t, idx) => t === userTermes[idx])) {
        return true;
      }
    } else if (user.length >= 2 && corrClean.includes(user)) {
      return true;
    }

    // 4b. Intervalles
    const normaliserIntervalle = (s: string) => s
      .replace(/\\,/g, '')
      .replace(/\s/g, '')
      .replace(/\+∞|\+\\infty|\+infty|\+inf/gi, '+inf')
      .replace(/−∞|-∞|-\\infty|-infty|-inf/gi, '-inf')
      .replace(/∞|\\infty|infty/gi, '+inf')
      .replace(/,/g, ';')
      .toLowerCase();

    const userN = normaliserIntervalle(userRaw);
    const corrN = normaliserIntervalle(correctionRaw);
    if (userN.length >= 3 && corrN.includes(userN)) return true;
    const userSansC = userN.replace(/[\[\]]/g, '');
    const corrSansC = corrN.replace(/[\[\]]/g, '');
    if (userSansC.length >= 3 && corrSansC.includes(userSansC)) return true;

    // 5. Oui / Non / Vrai / Faux
    if (['non', 'no', 'faux', 'false'].includes(user)) {
      if (corrClean.match(/\bfaux\b/) || corrClean.match(/\bnon\b/)) return true;
    }
    if (['oui', 'yes', 'vrai', 'true'].includes(user)) {
      if (corrClean.match(/\bvrai\b/) || corrClean.match(/\boui\b/) || corrClean.includes('✓')) return true;
    }
  }

  return false;
}

function verifierQuestion(q: any, reponse: string): { correcte: boolean; correction: string; bonneReponse?: string } {
  if (q.type === 'qcm') {
    // Comparaison par TEXTE, jamais par position : le client melange l'ordre
    // d'affichage des choix (Fisher-Yates, anti-biais "toujours en A") sans
    // que le serveur en soit informe -- comparer un index reviendrait a
    // comparer une position mélangée a la position originale non mélangée
    // stockee en base, faussant la correction pour toute question melangee.
    const bonneReponseTexte = q.bonneReponse !== undefined && q.bonneReponse !== null
      ? q.bonneReponse
      : (q.choix || [])[q.bonneReponseIdx];
    const correcte = String(reponse) === String(bonneReponseTexte);
    return { correcte, correction: q.correction ?? '', bonneReponse: bonneReponseTexte };
  }
  const correcte = verifierReponse(String(reponse), q.correction ?? '');
  return { correcte, correction: q.correction ?? '' };
}

// Ecrit une ligne de progression, avec verrou "une tentative" si l'exercice est
// rattache a un parcours en mode evaluation (Parcours-Notation, 04/08/2026).
// - Sans parcoursId : comportement strictement inchange (upsert sur eleve_id+
//   exercice_id, la pratique libre garde une seule ligne par exercice).
// - Avec parcoursId en mode entrainement : upsert scope a CE parcours precis
//   (colonne generee parcours_key), ne touche jamais la ligne de pratique
//   libre ni celle d'un autre parcours sur le meme exercice.
// - Avec parcoursId en mode evaluation : verifie d'abord qu'aucune ligne
//   n'existe deja pour (eleve, exercice, parcours) ; si si, rejette --
//   c'est le verrou "une seule tentative" qui garantit une note definitive.
async function ecrireProgression(
  supabaseUrl: string,
  serviceKey: string,
  data: Record<string, unknown>,
  parcoursId: string | null | undefined,
): Promise<{ ok: boolean; error?: string; verrouille?: boolean }> {
  if (parcoursId) {
    const pResp = await fetch(`${supabaseUrl}/rest/v1/parcours?id=eq.${parcoursId}&select=mode`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const pRows = await pResp.json();
    const mode = Array.isArray(pRows) && pRows.length > 0 ? pRows[0].mode : null;
    if (!mode) return { ok: false, error: "parcours introuvable" };

    if (mode === "evaluation") {
      const existResp = await fetch(
        `${supabaseUrl}/rest/v1/progression?eleve_id=eq.${data.eleve_id}&exercice_id=eq.${data.exercice_id}&parcours_id=eq.${parcoursId}&select=id`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      const existRows = await existResp.json();
      if (Array.isArray(existRows) && existRows.length > 0) {
        return { ok: false, verrouille: true, error: "Tu as déjà répondu à cette question dans le cadre de cette évaluation." };
      }
      const insResp = await fetch(`${supabaseUrl}/rest/v1/progression`, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, parcours_id: parcoursId }),
      });
      if (!insResp.ok) return { ok: false, error: await insResp.text() };
      return { ok: true };
    }

    const writeResp = await fetch(`${supabaseUrl}/rest/v1/progression?on_conflict=eleve_id,exercice_id,parcours_key`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ ...data, parcours_id: parcoursId }),
    });
    if (!writeResp.ok) return { ok: false, error: await writeResp.text() };
    return { ok: true };
  }

  const writeResp = await fetch(`${supabaseUrl}/rest/v1/progression?on_conflict=eleve_id,exercice_id,parcours_key`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(data),
  });
  if (!writeResp.ok) return { ok: false, error: await writeResp.text() };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Pas d'authentification exigee ici : l'exercice reste essayable par un
    // visiteur non connecte (comme avant, la verification locale ne demandait
    // aucun compte) -- seule l'action "terminer" (ecriture progression) a
    // besoin de savoir qui est l'eleve, verifie plus bas au moment voulu.
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const userId = await verifierUtilisateur(jwt);

    const body = await req.json();
    const { action, exercice_id } = body;
    if (!action || !exercice_id) return new Response(JSON.stringify({ error: "action et exercice_id requis" }), { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const exResp = await fetch(`${supabaseUrl}/rest/v1/exercices?id=eq.${exercice_id}&select=questions,points_total`, {
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
    });
    const exRows = await exResp.json();
    if (!Array.isArray(exRows) || exRows.length === 0) {
      return new Response(JSON.stringify({ error: "exercice introuvable" }), { status: 404, headers: corsHeaders });
    }
    const questions = exRows[0].questions as any[];

    if (action === "verifier") {
      const { question_index, reponse } = body;
      if (question_index === undefined || reponse === undefined) {
        return new Response(JSON.stringify({ error: "question_index et reponse requis" }), { status: 400, headers: corsHeaders });
      }
      const q = questions[question_index];
      if (!q) return new Response(JSON.stringify({ error: "question introuvable" }), { status: 404, headers: corsHeaders });

      const { correcte, correction, bonneReponse } = verifierQuestion(q, reponse);
      return new Response(JSON.stringify({ correcte, correction, bonneReponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "terminer") {
      const { chapitre, niveau, reponses, parcours_id } = body;
      let pointsObtenus = 0;
      let pointsTotal = 0;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        pointsTotal += q.points || 0;
        const r = reponses ? reponses[String(i)] : undefined;
        if (r === undefined || r === null || r === '') continue;
        const { correcte } = verifierQuestion(q, r);
        if (correcte) pointsObtenus += q.points || 0;
      }
      const score = pointsTotal > 0 ? Math.round((pointsObtenus / pointsTotal) * 100) : 0;

      const eleveResp = await fetch(`${supabaseUrl}/rest/v1/eleves?user_id=eq.${userId}&select=id`, {
        headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
      });
      const eleves = await eleveResp.json();
      const eleveId = Array.isArray(eleves) && eleves.length > 0 ? eleves[0].id : null;

      // Compte sans ligne eleves (ex: prof qui teste un exercice) : on garde le
      // score calcule, on saute juste le suivi de progression (meme pattern que
      // les templates generes, trouve par Jamal le 29/07/2026).
      if (eleveId) {
        const result = await ecrireProgression(supabaseUrl!, serviceKey!, {
          eleve_id: eleveId,
          exercice_id,
          chapitre: chapitre ?? '',
          niveau: niveau ?? '',
          score,
          points_obtenus: pointsObtenus,
          points_total: pointsTotal,
          completed_at: new Date().toISOString(),
        }, parcours_id);
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error, verrouille: !!result.verrouille }), { status: result.verrouille ? 409 : 500, headers: corsHeaders });
        }
      }

      return new Response(JSON.stringify({ score, pointsObtenus, pointsTotal }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action inconnue" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
