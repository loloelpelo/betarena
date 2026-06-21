// api/matches.js
// Cette fonction tourne sur le serveur Vercel, jamais dans le navigateur.
// La clé API reste donc invisible des visiteurs du site.

// Cache en mémoire partagé entre tous les visiteurs : tant que ce cache est
// valide, on ne réinterroge PAS l'IA, peu importe combien de personnes
// ouvrent le site en même temps. C'est ce qui limite vraiment les coûts.
let cache = { data: null, timestamp: 0 };
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  // Autorise les appels venant du site (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Si le cache est encore valide, on le renvoie directement sans appeler l'IA
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_DURATION_MS) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Cache-Age-Seconds', Math.round((now - cache.timestamp) / 1000));
    return res.status(200).json(cache.data);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API non configurée sur le serveur' });
  }

  try {
    const nowFR = new Date().toLocaleString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const systemPrompt = `Tu es un agent de données live pour un site de paris CS2. Récupère TOUS les matchs CS2 du jour sur HLTV.org (hltv.org/matches), en cours ET à venir.
Réponds UNIQUEMENT en JSON valide, sans texte avant/après, sans markdown.
Format: {"featured":[...matchs tier-1 Major BLAST ESL IEM PGL...],"other":[...autres matchs...]}
Chaque match: {"team1":"Nom1","team2":"Nom2","live":true,"score":"8-6","time":"15h45","event":"Nom tournoi","stage":"Quarts","format":"BO3","rank1":"#3 HLTV","rank2":"#7 HLTV","players1":[{"nick":"x","real":"y","role":"AWP","rating":1.15,"flag":"🇫🇷"}],"players2":[...],"maps":[{"name":"Mirage","s1":13,"s2":9,"status":"done"}],"hltvUrl":"https://www.hltv.org/matches/X","bookmakers":[{"name":"Bet365","odd1":1.75,"odd2":2.10},{"name":"Unibet","odd1":1.80,"odd2":2.00},{"name":"Betway","odd1":1.72,"odd2":2.15},{"name":"1xBet","odd1":1.78,"odd2":2.05},{"name":"Pinnacle","odd1":1.82,"odd2":2.08}]}
"live":true seulement si en cours maintenant avec score exact. featured = 2-3 matchs majeurs max. other = 4-6 autres matchs tier 2/3. 5 joueurs par équipe avec pseudo réel, rôle, rating HLTV, drapeau emoji pays. Reste concis sur le champ "real" (prénom nom uniquement, pas de détails supplémentaires).
Heure actuelle: ${nowFR}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: 'Tous les matchs CS2 HLTV du jour, en direct et à venir, scores live exacts si en cours. JSON uniquement.'
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Erreur API Anthropic', details: errText });
    }

    const data = await response.json();
    const text = data.content.map(b => (b.type === 'text' ? b.text : '')).join('').replace(/```json|```/g, '').trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');

    if (jsonStart === -1) {
      return res.status(502).json({ error: 'Réponse IA invalide', raw: text.slice(0, 300) });
    }

    let rawJson = text.slice(jsonStart, jsonEnd === -1 ? text.length : jsonEnd + 1);

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (parseErr) {
      // La réponse a probablement été coupée (limite de tokens atteinte) ou contient
      // une petite erreur de syntaxe. On tente une réparation simple : on referme
      // proprement les tableaux/objets resté ouverts en tronquant au dernier
      // objet de match complet.
      const repaired = repairTruncatedJson(rawJson);
      if (repaired) {
        try {
          parsed = JSON.parse(repaired);
        } catch (secondErr) {
          return res.status(502).json({
            error: 'Réponse IA mal formée',
            message: parseErr.message,
            raw: rawJson.slice(0, 500)
          });
        }
      } else {
        return res.status(502).json({
          error: 'Réponse IA mal formée',
          message: parseErr.message,
          raw: rawJson.slice(0, 500)
        });
      }
    }

    // S'assure qu'on a toujours une structure valide même si featured/other manquent
    if (!parsed.featured) parsed.featured = [];
    if (!parsed.other) parsed.other = [];

    // Met à jour le cache partagé pour les prochains visiteurs
    cache = { data: parsed, timestamp: Date.now() };

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', message: err.message });
  }
}

// Tente de réparer un JSON tronqué en coupant proprement au dernier élément
// complet d'un des deux tableaux "featured" ou "other", puis en refermant
// les structures ouvertes. Renvoie null si la réparation échoue.
function repairTruncatedJson(text) {
  try {
    // Coupe au dernier "}" suivi d'une virgule ou d'une fin de tableau,
    // ce qui correspond généralement à la fin d'un objet match complet.
    let lastGoodIndex = -1;
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (ch === '\\') { escapeNext = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') depth++;
      if (ch === '}' || ch === ']') {
        depth--;
        if (depth >= 0 && ch === '}') lastGoodIndex = i;
      }
    }

    if (lastGoodIndex === -1) return null;

    let truncated = text.slice(0, lastGoodIndex + 1);

    // Compte les accolades/crochets ouverts restants pour les refermer
    let openBraces = 0, openBrackets = 0;
    inString = false; escapeNext = false;
    for (let i = 0; i < truncated.length; i++) {
      const ch = truncated[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (ch === '\\') { escapeNext = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }

    let closing = '';
    for (let i = 0; i < openBrackets; i++) closing += ']';
    for (let i = 0; i < openBraces; i++) closing += '}';

    return truncated + closing;
  } catch {
    return null;
  }
}
