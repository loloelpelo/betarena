# BetArena — Guide de mise en ligne

Ce dossier contient votre site complet : le frontend (ce que voient les visiteurs)
et un petit backend (qui cache votre clé API en sécurité).

```
betarena-project/
├── public/
│   └── index.html      ← le site (déjà prêt, ne pas modifier pour l'instant)
├── api/
│   └── matches.js       ← le serveur sécurisé qui va chercher les matchs HLTV
├── vercel.json           ← config d'hébergement
├── package.json
└── .env.example           ← exemple de fichier secret (clé API)
```

Vous n'avez rien à coder vous-même. Suivez juste les étapes ci-dessous,
idéalement avec **Claude Code** ouvert à côté de vous pour vous aider si un message
d'erreur apparaît.

---

## Étape 1 — Installer les outils de base

Vous avez besoin de deux choses sur votre ordinateur :

1. **Node.js** (le moteur qui fait tourner le code) → téléchargez-le sur https://nodejs.org (choisissez la version "LTS")
2. **Claude Code** → suivez les instructions sur https://docs.claude.com pour l'installer (ça vous permettra de demander de l'aide en langage normal si besoin)

Une fois Node.js installé, ouvrez un terminal (l'application "Terminal" sur Mac,
"PowerShell" ou "Invite de commandes" sur Windows) et tapez :

```bash
node -v
```

Si un numéro de version s'affiche (ex: `v20.11.0`), c'est bon.

---

## Étape 2 — Récupérer votre clé API Anthropic

1. Allez sur https://console.anthropic.com
2. Créez un compte si vous n'en avez pas
3. Allez dans "API Keys" et créez une nouvelle clé
4. **Copiez-la et gardez-la de côté** (vous ne pourrez plus la revoir après, donc notez-la quelque part en sécurité — jamais dans un message public ou un fichier partagé)

C'est cette clé qui sera utilisée par votre site pour interroger l'IA et récupérer
les données HLTV. Elle restera cachée côté serveur, jamais visible des visiteurs.

---

## Étape 3 — Créer un compte GitHub (gratuit)

GitHub sert à stocker votre code en ligne, ce qui permet à Vercel de s'y connecter.

1. Allez sur https://github.com et créez un compte gratuit
2. Créez un nouveau dépôt (bouton vert "New") nommé par exemple `betarena`
3. Laissez-le vide pour l'instant (ne cochez aucune case de fichier initial)

---

## Étape 4 — Envoyer votre code sur GitHub

Dans le terminal, placez-vous dans le dossier du projet et tapez ces commandes
une par une (remplacez `VOTRE-NOM-UTILISATEUR` par votre pseudo GitHub) :

```bash
cd chemin/vers/betarena-project
git init
git add .
git commit -m "Premier envoi du site BetArena"
git branch -M main
git remote add origin https://github.com/VOTRE-NOM-UTILISATEUR/betarena.git
git push -u origin main
```

Si `git` n'est pas reconnu, installez-le depuis https://git-scm.com puis recommencez.

---

## Étape 5 — Déployer sur Vercel (votre site devient accessible en ligne)

1. Allez sur https://vercel.com et connectez-vous avec votre compte GitHub
2. Cliquez sur "Add New" → "Project"
3. Choisissez votre dépôt `betarena`
4. Avant de cliquer sur "Deploy", allez dans la section **Environment Variables**
   et ajoutez :
   - Nom : `ANTHROPIC_API_KEY`
   - Valeur : votre clé API copiée à l'étape 2
5. Cliquez sur **Deploy**

Au bout de 30 à 60 secondes, Vercel vous donne une adresse du type :

```
https://betarena-xxxx.vercel.app
```

**Votre site est en ligne, visible par n'importe qui dans le monde.**

---

## Étape 6 — Vérifier que tout fonctionne

Ouvrez l'adresse fournie par Vercel. Les matchs devraient se charger après
quelques secondes (le temps que le serveur interroge HLTV). Si rien ne s'affiche :

- Ouvrez les outils développeur du navigateur (clic droit → "Inspecter" → onglet "Console")
- Cherchez un message d'erreur en rouge
- Copiez ce message et montrez-le à Claude Code ou revenez en discuter avec Claude

---

## Étape 7 — Faire évoluer le site dans le temps

C'est ici que ça devient intéressant. À chaque fois que vous voulez ajouter
une fonctionnalité (un nouveau classement, une page de profil, un système
de connexion, etc.), vous pouvez :

1. Ouvrir le dossier du projet avec Claude Code
2. Décrire ce que vous voulez en langage normal ("ajoute une page où chaque
   joueur peut voir ses propres statistiques détaillées")
3. Claude Code modifie le code pour vous
4. Renvoyer le code mis à jour sur GitHub :

```bash
git add .
git commit -m "Description de ce qui a été ajouté"
git push
```

Vercel redéploie automatiquement le site à chaque envoi — pas besoin de
recommencer les étapes précédentes.

---

## Pour aller plus loin (quand vous serez prêt)

- **Nom de domaine personnalisé** (ex: `betarena.fr` au lieu de `.vercel.app`) :
  achetez-en un chez OVH, Namecheap ou Google Domains (~10€/an), puis ajoutez-le
  dans les réglages du projet sur Vercel ("Domains")
- **Vraie base de données** pour stocker les points des joueurs de façon
  permanente et partagée entre tous les visiteurs (actuellement chaque
  visiteur a ses propres points stockés uniquement dans son navigateur) :
  des services comme Vercel Postgres ou Supabase ont des offres gratuites
  pour démarrer
- **Système de comptes/connexion** pour que chaque joueur ait son propre
  profil persistant

Vous n'avez pas besoin de tout faire d'un coup. Le site fonctionne déjà
correctement tel quel — ces étapes sont des évolutions futures possibles.
