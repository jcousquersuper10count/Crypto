# Signaux Kronos

Alimente la page **Signaux** de VAULT (`data/signals.json`).

Chaque jour à 05:17 UTC, le workflow `.github/workflows/signals.yml` :

1. récupère l'historique quotidien de BTC, PLUME, ATOM et CETUS (Coinbase, Kraken, Gate.io), converti en euros ;
2. calcule le signal de tendance (prix au-dessus / en dessous de sa moyenne 50 jours) et son bilan historique ;
3. fait tourner [Kronos](https://github.com/shiyu-coder/Kronos) (modèle *small*, sur processeur) : 48 scénarios en bougies journalières sur 30 jours, dont on garde le scénario central ;
4. construit les fourchettes à partir des variations passées de chaque crypto sur la même durée (celles de Kronos étaient bien trop étroites au test), et joint le bilan du test sur le passé (`calibration.json`) ;
5. publie `data/signals.json` dans le dépôt.

Relance manuelle : onglet **Actions** → *Signaux Kronos* → **Run workflow**.

## Ajouter une crypto

Dans `fetch_data.py`, ajoute une entrée à `COINS` avec une source de prix. Dans `signals.js`, ajoute le symbole à `ORDER`. Puis refais un backtest pour la calibration.

## Refaire le test sur le passé

`calibration.json` vient d'un test sur le passé : à des dates passées, Kronos a prévu les 30 jours suivants avec les seules données connues à ce moment-là. Pour le refaire (environ une heure sur processeur) :

```
python backtest.py --model small --step 10 --ntest 400 --samples 12
python calibrate.py small
```

(`backtest.py` et `calibrate.py` lisent les CSV écrits par `python fetch_data.py`.)

Ces signaux sont une aide à la réflexion, pas un conseil en investissement.
