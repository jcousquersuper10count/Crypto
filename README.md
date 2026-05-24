# 🔮 VAULT - Crypto Portfolio Tracker

Dashboard de suivi de portefeuille crypto, hébergé sur GitHub Pages.

## Fonctionnalités

- **Holdings** : Calcul automatique des positions depuis votre Google Sheet de transactions
- **Prix en temps réel** : Données CoinGecko (gratuit, pas de clé API)
- **Marché** : Top 50 cryptos avec prix, variation 24h et market cap
- **Historique** : Parcourez vos transactions avec filtres par type et par actif
- **Analytiques** : Répartition du portefeuille, statistiques de trading

## Déploiement sur GitHub Pages

### 1. Prérequis
- Votre Google Sheet doit être **partagé en "Accessible à tous avec le lien"**
  - Ouvrez la feuille → Partager → Accès général → "Tous les utilisateurs disposant du lien"

### 2. Pousser sur GitHub

```bash
cd crypto-dashboard
git init
git add .
git commit -m "Initial commit - Crypto Dashboard"
git remote add origin https://github.com/jcousquersuper10count/Crypto.git
git branch -M main
git push -u origin main
```

### 3. Activer GitHub Pages
1. Allez sur votre repo GitHub → **Settings**
2. Section **Pages** (menu gauche)
3. Source : **Deploy from a branch**
4. Branch : **main** / dossier **/ (root)**
5. Cliquez **Save**

Votre site sera disponible à :
`https://jcousquersuper10count.github.io/Crypto/`

## Configuration

### Changer le Google Sheet
Dans `app.js`, modifiez la constante `SHEET_ID` :
```javascript
const SHEET_ID = 'VOTRE_SHEET_ID_ICI';
```

### Ajouter une crypto manquante
Dans `app.js`, ajoutez l'entrée dans `COINGECKO_MAP` :
```javascript
'SYMBOL': 'coingecko-id',
```

Trouvez l'ID CoinGecko sur https://www.coingecko.com/ (dans l'URL de la crypto).

## APIs utilisées

- **Google Sheets** : Export CSV (gratuit, pas de clé)
- **CoinGecko** : API publique gratuite (limite : ~30 req/min)

## Notes

- Le rafraîchissement des prix est automatique toutes les 60 secondes
- Les transactions sont rechargées à chaque visite ou rafraîchissement manuel
- Aucune donnée sensible n'est exposée (pas de clé API côté client)
- Vos clés privées ou mots de passe ne sont jamais nécessaires
