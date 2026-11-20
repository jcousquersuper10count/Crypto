# VAULT — Suivi et aide à la décision pour mon portefeuille crypto et ETF

> État au 15 novembre 2026 (mis à jour après l'audit).
> Site : https://jcousquersuper10count.github.io/Crypto/
> Dépôt : `jcousquersuper10count/Crypto` (GitHub Pages, branche `main`)

VAULT est un tableau de bord personnel, protégé par mot de passe. Il regroupe trois comptes :

- **Neverless** (crypto) ;
- **Revolut Crypto** ;
- **Revolut Robo-Advisor** (ETF).

Il calcule chaque matin un signal d'achat ou de vente pour les cryptos suivies, et sa page d'accueil dit en une phrase quoi faire aujourd'hui.

Ce n'est pas un conseil en investissement : les signaux appliquent une règle simple, testée sur le passé, qui se trompe régulièrement.

---

## 1. Vue d'ensemble

```
Exports CSV des comptes ──► page Importer ──► Apps Script ──► Google Sheet (3 onglets)
                                                                    │
                                    lecture CSV publique (gviz) ◄───┘
                                                                    │
GitHub Actions (chaque matin) ──► data/*.json ──► GitHub Pages ──► VAULT (navigateur)
   • prix et signaux crypto (Kronos + tendance)                      ▲
   • cours des ETF                                                   │
   • prix crypto de secours                       prix en direct (CoinGecko)
```

- **Aucun serveur à maintenir.** Le site est statique (HTML, CSS, JS). Les données personnelles sont dans une Google Sheet, et les calculs lourds tournent une fois par jour dans GitHub Actions.
- **Prix en direct :** CoinGecko, depuis le navigateur. S'il refuse les demandes, VAULT se rabat sur `data/prices.json` (calculé chaque matin), puis sur les derniers prix gardés dans le navigateur.

---

## 2. Pages

### Menu principal

| Page | Rôle |
|---|---|
| **Aujourd'hui** (accueil) | Décision du jour, valeur totale, variation depuis hier, courbe sur 7 jours, gain ou perte, montant investi, répartition crypto / ETF / espèces, plus grosses positions, points à surveiller |
| **Portefeuille** | Toutes les positions, avec des onglets *Tout · Neverless · Revolut Crypto · Revolut Robo* : quantité, prix, valeur, prix de revient, gain en %, variations, courbe, part du total |
| **Signaux** | Pour BTC, PLUME, ATOM et CETUS : signal de tendance, prix de bascule, bilan historique de la règle, prévisions Kronos sur 8 horizons, courbe avec tes achats et ventes |
| **Performance** | Gain latent, gain réalisé, revenus passifs, frais, gain par position, comparaison avec le Bitcoin |
| **Historique** | Liste des transactions |
| **Importer** | Envoi des relevés CSV des trois comptes |

### Sous « Plus »

Risque, Évolution, Marché, Stratégie, Fiscal. Ces pages n'ont pas encore été remises au nouveau style.

### Page d'accueil en détail

- **Titre :** une décision. Par exemple « Réduire 4 positions crypto », « Achat possible : ATOM » ou « Rien à faire aujourd'hui ».
- **Valeur totale :** animée en compteur, avec la variation du portefeuille entier depuis hier. Le week-end, les ETF sont exclus de cette variation et c'est indiqué (« bourse fermée pour les ETF »).
- **Courbe sur 7 jours :** valeur des positions actuelles, à quantités constantes.
- **Ligne de fraîcheur :** date des prix crypto, de la clôture ETF et des signaux.
- **Carte « Décision du jour » :**
  - les positions sont regroupées par décision (Vendre, Achat possible, Garder) ;
  - chaque crypto a une jauge qui situe son prix face à sa moyenne 50 jours (de −30 % à +30 %) et indique son prix de bascule.
- **À surveiller :**
  - signaux de plus de 36 h ;
  - une crypto qui pèse plus de 40 % du portefeuille ;
  - des positions d'au moins 50 $ sans signal ;
  - un compte sans opération depuis plus de 45 jours ;
  - un onglet de la Sheet vide.

---

## 3. Données des comptes

### Google Sheet

Une feuille avec trois onglets, lus en CSV public (`gviz/tq?tqx=out:csv&sheet=…`) :

| Onglet | Source | Colonnes obligatoires (contrôlées à l'import) |
|---|---|---|
| `Neverless` | Relevé des transactions Neverless (ex-SwissBorg) | Type, Date, Asset received, Amount received |
| `Revolut_Crypto` | Relevé des transactions crypto Revolut | Symbol, Type, Date |
| `Revolut_Robo` | Relevé des **transactions** du Robo-Advisor (pas le relevé de gains et pertes) | Date, Ticker, Type, Quantity |

### Protection des données (depuis le 15 novembre)

- **Script :** `apps-script/Code.gs`, à coller dans le projet Apps Script de la feuille.
- **Clé d'accès :** chaque lecture et chaque écriture exige la clé `VAULT_KEY`, rangée dans les propriétés du script (jamais sur GitHub). On la crée en exécutant la fonction `creerCle` ; on la saisit dans VAULT > Importer.
- **Feuille privée :** une fois la clé en place, il faut retirer le partage public de la Google Sheet et la publication sur le web. VAULT lit alors les données uniquement par le script. Sans clé, l'accueil affiche « Données verrouillées ».
- **Ancien mode :** tant que la feuille est publique, VAULT la lit encore sans clé, et l'accueil signale que les transactions sont lisibles par tout le monde.

### Import

La page Importer envoie le fichier à un Google Apps Script (constante `GAS` dans `app.js`), qui remplace le contenu de l'onglet. L'import :

1. refuse un fichier dont les colonnes ne correspondent pas au compte ;
2. compare le fichier à ce qui est enregistré et affiche un aperçu : lignes lues, nouvelles, déjà présentes, **disparues**, et la période couverte par chacun ;
3. demande confirmation, avec un avertissement rouge si des lignes enregistrées disparaîtraient ;
4. fait sauvegarder l'onglet actuel par le script avant de le remplacer (5 sauvegardes par onglet, onglets masqués `_svg_…`), restaurables depuis la page Importer.

**Le script doit être déployé avec l'accès « Tout le monde ».** L'option « Tous les utilisateurs disposant d'un compte Google » oblige à se connecter et bloque l'import. Si l'adresse du déploiement change, il faut la remplacer dans `GAS`.

### Particularités gérées

- **Dates Revolut Crypto en français** (« 23 mai 2026, 02:41:05 ») : converties par `frDate()`.
- **Divisions d'actions ETF** (`STOCK SPLIT`, par exemple LYP5 le 28 octobre 2026) : la quantité et le dernier prix payé sont ajustés.
- **Espèces non investies du Robo :** versements − achats + ventes + dividendes − frais − retraits (`roboCash()`).
- **Stablecoins** (USDC, USDT, EURC, DAI…) : traités comme de la trésorerie dans le calcul du gain réalisé.
- **Ventes sans coût d'achat connu** (crypto reçue par transfert) : ignorées dans le gain réalisé.
- **PLUME et CETUS** : ajoutés à la table des identifiants CoinGecko (`CGM`).

---

## 4. Calcul quotidien (GitHub Actions)

- **Fichier :** `.github/workflows/signals.yml`.
- **Déclenchement :** chaque jour à 05:17 UTC, au bouton *Run workflow*, et à chaque modification de `kronos/` ou du workflow.
- **Durée :** environ 15 minutes, sur processeur.

| Étape | Script | Produit |
|---|---|---|
| Prix et signaux crypto | `kronos/forecast.py` | `data/signals.json` |
| Prix crypto de secours | `kronos/fetch_prices.py` | `data/prices.json` (≈ 76 cryptos, liste lue dans `CGM`) |
| Cours ETF | `kronos/fetch_etf.py` | `data/etf.json` (Yahoo Finance, clôture, variations sur 1 j / 7 j / 30 j / 1 an, 60 séances) |

Le workflow publie ensuite `data/` par un commit « Signaux du AAAA-MM-JJ ».

### Sources de prix des signaux (`kronos/fetch_data.py`)

| Crypto | Source | Historique |
|---|---|---|
| BTC | Coinbase BTC-EUR | ≈ 5 ans |
| ATOM | Coinbase ATOM-EUR | ≈ 5 ans |
| PLUME | Kraken PLUME-USD, converti en EUR | ≈ 480 jours |
| CETUS | Gate.io CETUS-USDT, converti en EUR | ≈ 900 jours |

La conversion en euros utilise le cours USDT-EUR de Coinbase.

---

## 5. Méthode des signaux

### Le signal : règle de tendance (expérimentale)

- **Prix au-dessus de sa moyenne des 50 derniers jours :** achat, ou garder.
- **Prix en dessous :** vente, ou attendre.
- **Prix de bascule :** la moyenne 50 jours du jour, recalculée chaque matin.

Validation refaite le 15 novembre (`kronos/validate_rule.py`), frais de 0,25 % par changement, rendement nul hors marché.

**Effet du moment où l'on agit.** Le calcul tourne le matin, donc on agit au plus tôt le lendemain de la clôture qui donne le signal. Les premiers chiffres publiés supposaient d'agir pile à cette clôture, ce qui les rendait trop flatteurs :

| Crypto | Agir à la clôture du signal (irréaliste) | Agir le lendemain | Lendemain, frais 0,6 % | Garder sans bouger |
|---|---|---|---|---|
| BTC | +98 % (recul max −47 %) | +58 % (−55 %) | +8 % | +70 % (−64 %) |
| ATOM | −33 % | −53 % | −67 % | −96 % |
| PLUME | −53 % | −63 % | −67 % | −88 % |
| CETUS | +131 % | +43 % | +19 % | −90 % |

**Hors échantillon.** Tous les 90 jours, on choisit la durée de la moyenne (20 à 200 jours) d'après les 365 jours précédents seulement, puis on l'applique aux 90 jours suivants. Résultat : ce choix glissant fait **moins bien** que garder 50 jours (BTC +53 % contre +161 % depuis juin 2023 ; CETUS −27 % contre +15 % depuis septembre 2025). On garde donc 50 jours, sans réglage.

**Variantes fixées à l'avance** (zone neutre de ±2 %, confirmation sur 2 clôtures) : elles divisent environ par deux le nombre d'allers-retours, mais ne font pas mieux de façon constante (meilleures sur ATOM, moins bonnes sur BTC et CETUS).

**Conclusion.** La règle a surtout **limité les pertes** sur les cryptos en forte baisse. Elle **n'a pas battu la conservation sur BTC** sur l'ensemble de l'historique. Le résultat dépend beaucoup du jour exact d'exécution, signe de fragilité. Elle est présentée comme une tendance « favorable / défavorable », pas comme un ordre d'achat ou de vente.

**Signal suspendu.** Aucune tendance n'est affichée si le calcul a plus de 36 h ou si la dernière bougie d'une crypto a plus de 2 jours.

### Kronos : avis secondaire

- **Ce que c'est :** [Kronos](https://github.com/shiyu-coder/Kronos), modèle open source (licence MIT, AAAI 2026) entraîné sur des bougies de marché. Version *small* utilisée (environ 25 millions de paramètres), commit figé dans le workflow.
- **Ce qu'on en garde :** 48 scénarios sur 30 jours en bougies journalières, dont on retient le scénario central.
- **Test sur le passé :** à environ 40 à 100 dates par crypto, sur 1, 5, 7 et 30 jours, versions *mini* et *small*. Kronos n'a pas deviné le sens du prix mieux que de parier toujours sur le sens le plus fréquent. Ses fourchettes étaient bien trop étroites : à 1 mois, le vrai prix tombait dedans 10 à 30 % du temps au lieu de 80 %.
- **Conséquences :**
  - le signal affiché dépend uniquement de la règle de tendance ;
  - Kronos est montré à côté, marqué « non validé », sans notion d'accord avec la tendance (deux méthodes non validées qui coïncident ne se confirment pas), avec sa fiabilité mesurée ligne par ligne (`kronos/calibration.json`) ;
  - les fourchettes ne viennent pas de Kronos : elles reprennent l'amplitude réelle des variations passées de chaque crypto sur la même durée ;
  - de 3 mois à 1 an, il n'y a pas de prévision de sens : ces lignes sont marquées « Dispersion seule » (amplitude des variations passées autour du scénario à 1 mois).

### Refaire le test sur le passé

```
cd kronos
python fetch_data.py
python backtest.py --model small --step 10 --ntest 400 --samples 12
python calibrate.py small
python evaluate.py "bt_small_*.npz"
```

Compter environ une heure sur processeur. Il faut cloner Kronos dans `kronos/Kronos` ou définir `KRONOS_DIR`.

### Ajouter une crypto aux signaux

1. Ajouter une entrée dans `COINS` (`kronos/fetch_data.py`), avec une source de prix quotidiens.
2. Ajouter le symbole dans `ORDER` (`signals.js`).
3. Vérifier qu'il est dans `CGM` (`app.js`).
4. Relancer le test sur le passé pour sa fiabilité.

---

## 6. Organisation du code

| Fichier | Contenu |
|---|---|
| `index.html` | Structure de toutes les pages, menu, écran d'entrée |
| `app.js` | Cœur de l'application (données, calculs, pages historiques) : `loadSheets`, `parseCSV`, `compSB`/`compRC`/`compRR` (positions par compte), `fetchPrices` (CoinGecko + secours), `fetchETF`, `lastETFPrices`, `etfPRU`, `roboCash`, `allItems`, `renderH`, `renderSum`, `computePRU`/`renderPerf`, `doUpload` (import), `fv` (montants en français), `chText` (pourcentages en français) |
| `home.js` | Page Aujourd'hui (décision, courbe 7 jours, anneau, jauges, fraîcheur des données), onglets de comptes, attribut `data-page` pour la teinte de chaque onglet |
| `signals.js`, `signals.css` | Page Signaux : cartes, graphique (prix, moyenne 50 jours, cône, points d'achat et de vente avec info-bulle), tableau des horizons, signaux passés |
| `style.css` | Styles d'origine |
| `theme.css` | Thème actuel, chargé après `style.css` (couleurs, typographie, menu, accueil, animations) |
| `kronos/` | Scripts Python du calcul quotidien et du test sur le passé (voir `kronos/README.md`) |
| `data/` | Fichiers générés chaque matin : `signals.json`, `prices.json`, `etf.json` |
| `apps-script/Code.gs` | Script Google sécurisé (lecture, import avec sauvegarde, restauration, historique de valeur) |

**Accès :** le mot de passe de l'écran d'entrée (empreinte SHA-256 dans `PWD_HASH`) n'est qu'une barrière d'interface. Les données sont protégées par la **clé d'accès** du script Google (voir section 3), saisie une fois par appareil et gardée dans le navigateur.

---

## 7. Design

### Typographie et couleurs
- **Police :** Geist (texte et chiffres, chiffres alignés en colonnes) ; Geist Mono reste sur quelques anciens tableaux.
- **Accent unique :** or, `hsl(40 68% 68%)` en sombre et `hsl(36 70% 36%)` en clair, pour le logo, le menu, l'anneau et les barres.
- **Couleurs de sens :** vert pour une hausse, rouge pour une baisse, orange pour une alerte. Elles sont identiques sur toutes les pages.
- **Une teinte par onglet (thème sombre)**, via `--h` sur `html[data-page]`. Le fond change de nuance, l'accent reste or.

| Onglet | Teinte (`--h`) |
|---|---|
| Aujourd'hui | violet (258) |
| Portefeuille | bleu (214) |
| Signaux | cyan (186) |
| Performance | doré (42) |
| Historique | orchidée (300) |
| Importer | indigo (232) |
| Risque | rose (332) |
| Évolution | mauve (278) |
| Marché | bleu clair (200) |
| Stratégie | vert olive (96) |
| Fiscal | cuivre (20) |

### Format et animations
- **Format français :** `31 238,41 €` et `−0,70 %`.
- **Animations gardées, parce qu'elles expliquent quelque chose :** compteur de la valeur totale, courbe qui se trace, jauges qui se placent, anneau qui se remplit, apparition en cascade, transition entre pages, logo qui se dessine à l'entrée, secousse sur un mauvais mot de passe.
- **Animations retirées :** reflet sur « Vendre », halo qui dérive, trame de points, point qui pulse.
- `prefers-reduced-motion` est respecté.

### Menu
- 6 entrées principales, le reste sous « Plus ».
- Sur mobile, une barre d'icônes à gauche.

---

## 8. Points connus et suite possible

### Agent (20 novembre)
- Profil fixé avec Julien : capital = solde Neverless (673 €), arrêt à −20 %, comptant sans levier, Neverless sans frais. Objectif ×20 en un mois non retenu.
- `kronos/paper.py` (chaque matin) : 4 stratégies fixées à l'avance sur BTC, ETH, SOL, CETUS, PLUME (garder, tendance 50 jours, tendance + volatilité, élan 2 meilleures), décision à la clôture et exécution le lendemain, écart 0,1 %, seuil d'ordre 3 %. Test sur l'historique et trading fictif depuis le 19 novembre 2026, ordres du jour en euros.
- `kronos/committee.py` : comité IA inspiré de TradingAgents (analystes puis gérant), suivi en fictif uniquement. Gratuit par défaut : modèle ouvert `qwen2.5:7b` lancé par Ollama dans la tâche GitHub (variable de dépôt `OLLAMA_MODEL` pour en changer). Secrets facultatifs : `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`. Tous ceux présents rendent un avis séparé ; un juge (Gemini en priorité) combine les avis et garde la position la plus prudente en cas de désaccord. Chaque avis (IA Groq, IA Gemini) et le mélange ont leur propre suivi fictif ; le modèle local ne sert que si aucune clé n'existe. GitHub Models n'est plus une option (retiré le 30 juillet 2026).
- Premiers résultats : sur 12 mois, toutes les stratégies auraient touché l'arrêt à −20 % ; sans arrêt, depuis juin 2025 : garder −80 %, tendance +10 %, élan +23 %.

### Saisie manuelle (20 novembre)
- Bouton « ＋ Opération » en haut : achat ou vente, compte, actif, quantité, prix (prérempli au cours actuel), frais, date.
- L'opération compte immédiatement partout (positions, prix de revient, accueil, points sur les graphiques, historique marqué « saisi à la main »).
- Elle est retirée automatiquement quand un import contient la même opération (même actif et sens, quantité à 3 % près, datée de 2 jours avant à 10 jours après).
- Stockage : propriétés du script Google (`VAULT_MANUAL`, avec la clé) et ce navigateur ; une vente supérieure à la quantité détenue est refusée.

### Corrigé après l'audit du 15 novembre
- Données protégées par clé, import avec aperçu des différences, sauvegardes restaurables.
- Historique de valeur : n'enregistre plus que des totaux complets (tous les prix présents et frais) ; les anciens points partiels (moins de 60 % de la médiane) sont écartés à l'affichage.
- Gain réalisé marqué « résultat partiel », avec le nombre et le montant des ventes exclues faute de coût d'achat connu.
- Accueil descriptif (« 4 positions en tendance défavorable »), règle présentée comme expérimentale, part du portefeuille couverte par les signaux.
- Anciennes copies de fichiers supprimées.

### Restant de l'audit, non traité
- Journal comptable normalisé (identifiant stable par opération, rapprochement des quantités et des espèces, transferts entre comptes appariés).
- Performance réelle dans le temps : valeur historique, TWR et MWR ; comparaison au Bitcoin à flux identiques.
- Registre unique des actifs (aujourd'hui `COINS`, `ORDER` et `CGM` séparés), prix horodatés avec leur source.
- Publication quotidienne en deux temps (validation puis remplacement) et tests automatiques des calculs.
- Banc d'essai séparé pour d'autres modèles (par exemple AdaBoost à 10 jours sur HBAR, RSR, MNT, TURBO, IO).

### Limites actuelles
- **Écart de valorisation Robo :** environ 0,35 % (96 € le 15 novembre) face à Revolut. Il vient des cours (clôture de la bourse allemande contre les prix de Revolut), pas d'une opération manquante : vérifié ligne par ligne.
- **Petit reste d'USDC :** environ 5,9 USDC apparaissent sur Neverless sans y figurer dans l'application (arrondis et intérêts accumulés).
- **Courbe de la page Évolution :** repartie de zéro avec le nouveau script Google. L'ancien historique n'a pas été récupéré.
- **Couverture des signaux :** les autres positions crypto de 50 $ ou plus n'ont pas de signal.
- **Prix des points sur la courbe :** les points d'achat et de vente de la page Signaux sont placés au cours de clôture du jour, pas au prix d'exécution.

### Chantiers proposés
1. Remettre les pages sous « Plus » au nouveau style, ou les retirer.
2. Un style unique pour tous les tableaux, et Geist Mono retiré.
3. Une barre d'onglets en bas de l'écran sur mobile.
4. Étendre les signaux à d'autres positions.

---

## 9. Historique des changements (novembre 2026)

| Date | Changement |
|---|---|
| 14 nov. | Page Signaux, Kronos installé et testé sur le passé, calcul quotidien GitHub Actions |
| 14 nov. | Import CSV fiabilisé (script vérifié, lignes relues), nouveau script Google public, dates Revolut en français |
| 14 nov. | Prix PLUME et CETUS ajoutés (positions Neverless jusque-là masquées) |
| 15 nov. | Revolut Robo restauré après un mauvais relevé, contrôle des colonnes à l'import |
| 15 nov. | Page Aujourd'hui, nouveau thème, menu allégé, onglets de comptes, écran d'entrée, montants en français |
| 15 nov. | Division d'actions LYP5, espèces non investies du Robo, cours ETF quotidiens avec variations, prix de revient et courbes |
| 15 nov. | Points d'achat et de vente sur la courbe des signaux |
| 15 nov. | Gain réalisé corrigé (de −2 M€ à environ −1 090 €), prix crypto de secours quotidiens, accueil recentré sur une décision, accent or, teintes adoucies |

| 15 nov. (soir) | Audit : clé d'accès et script sécurisé, import avec aperçu et sauvegardes, règle revalidée hors échantillon avec un jour de délai, affichage descriptif, gain réalisé partiel, signal suspendu |
| 20 nov. | Saisie manuelle des achats et ventes en attente d'import, rapprochement automatique |
| 20 nov. (soir) | Onglet Agent : stratégies en test, ordres du jour, trading fictif, comité IA |
