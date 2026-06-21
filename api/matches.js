// api/matches.js
// Cette fonction tourne sur le serveur Vercel, jamais dans le navigateur.
// La clé API reste donc invisible des visiteurs du site.

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
"live":true seulement si en cours maintenant avec score exact. featured = 2-4 matchs majeurs max. other = 5-10 autres matchs tier 2/3. 5 joueurs par équipe avec pseudo réel, rôle, rating HLTV, drapeau emoji pays.
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
        max_tokens: 2000,
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

    if (jsonStart === -1 || jsonEnd === -1) {
      return res.status(502).json({ error: 'Réponse IA invalide', raw: text.slice(0, 300) });
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', message: err.message });
  }
}
