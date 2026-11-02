# Scolaris

La scolarité, sans impayés : suivi des frais de scolarité par élève et relance des parents en retard.

## Fonctionnalités (V1)
- Inscription de l'école, connexion par téléphone, rôles directeur / secrétaire
- Classes et tranches de paiement (montant + date limite), réductions par élève
- Élèves (ajout, modification, import CSV avec création automatique des classes)
- Paiements avec reçu numéroté, calcul automatique du payé / reste à payer, annulation tracée
- Tableau de bord (attendu, encaissé, reste, retards, par classe)
- Retards regroupés par famille, relance WhatsApp en un clic, promesses de paiement
- Pages publiques signées : reçu et solde de la famille
- Exports CSV (Excel)

## Technique
- Flask (Python), SQLite en local, PostgreSQL (Supabase) en production via `DATABASE_URL`
- Requêtes avec `?` (traduit en `%s` pour PostgreSQL par `db.py`)
- Déploiement Vercel (`api/index.py`), variables : `SECRET_KEY` (obligatoire), `DATABASE_URL`

## Lancer
```
pip install -r requirements.txt
python app.py
python -m pytest -q
```
Cahier des charges complet : `CAHIER_DES_CHARGES.md`.
