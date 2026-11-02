# SCOLARIS — Cahier des charges complet

> À donner tel quel à ChatGPT (ou à un designer / développeur).
> Objectif : produire le logo, les maquettes de toutes les pages, puis l'application.

---

## 0. Instructions pour ChatGPT

Tu es designer produit et développeur. À partir de ce document :
1. Crée le **logo Scolaris** en respectant la section 3.
2. Crée les **maquettes de toutes les pages** de la section 6 : version téléphone (390 × 844) **et** version ordinateur (1440 × 900).
3. Respecte **exactement** les couleurs, la police, les règles de calcul (section 7), les rappels (section 8) et les textes (section 9).
4. Langue de l'interface : **français**. Monnaie : **GNF** (franc guinéen), format `1 300 000 GNF` (espace entre les milliers).
5. Ne rien ajouter de la liste « Hors version 1 » (section 11).

---

## 1. Le produit en une phrase

**Scolaris permet à une école privée de savoir à tout moment ce que chaque élève a payé et ce qu'il doit encore, et relance automatiquement les parents en retard (WhatsApp / SMS).**

- L'argent **ne passe jamais** par l'application : les parents paient l'école comme d'habitude (espèces, Orange Money, MTN MoMo, banque). La secrétaire **enregistre** le paiement dans Scolaris.
- Slogan : **« La scolarité, sans impayés. »**
- Pays de départ : Guinée (Conakry et régions), puis Afrique francophone.

## 2. Le problème et les clients

**Problème** : les écoles privées courent après les frais de scolarité. Retards, espèces mal notées, cahiers perdus, argent détourné, et des millions jamais récupérés en fin d'année.

**Clients (qui paient)** : fondateurs et directeurs d'écoles privées (maternelle, primaire, collège, lycée).

**Utilisateurs** :
| Rôle | Ce qu'il fait |
|---|---|
| **Directeur / fondateur** | Voit tout : encaissé, restant, retards, qui a encaissé quoi. Valide les relances. Gère l'équipe et l'abonnement. |
| **Secrétaire / comptable** | Ajoute les élèves, enregistre les paiements, envoie les reçus, relance les retards (si autorisé). |
| **Parent** (sans compte) | Reçoit les rappels et les reçus sur WhatsApp/SMS, consulte une page « solde de la famille » via un lien sécurisé. |
| **Administrateur Scolaris** (nous) | Gère les écoles clientes, les abonnements et le coût des SMS. |

## 3. Identité visuelle

### Nom
**Scolaris** (du latin *scolaris*, « de l'école »).

### Logo
- **Icône** : carré aux coins très arrondis (rayon ≈ 27 % du côté), **dégradé bleu** en diagonale (haut-gauche `#3B7BFF` → milieu `#1840B8` → bas-droite `#0A1F5C`), léger reflet lumineux en haut à gauche, fin contour blanc translucide.
- Dans l'icône : une **toque de diplômé blanche** en volume (dessus blanc → `#DCE6FF`, partie basse `#C9D7FA` → `#EEF3FF`), avec un **gland doré** (dégradé `#FFE29A` → `#E0A526`).
- En bas à droite, qui déborde légèrement sur la toque : une **pastille ronde verte** (dégradé `#34D399` → `#059669`) avec une **coche blanche** et un épais contour blanc = « payé, à jour ».
- **Logotype** : « Scolaris » en police **Inter ExtraBold (800)**, lettres serrées (-5 %), couleur `#0A1F5C` (ou blanc sur fond sombre). **Le point du « i » est remplacé par une pastille ronde verte** (dorée sur fond sombre) : c'est la signature de la marque.
- **Slogan** sous le nom : « LA SCOLARITÉ, SANS IMPAYÉS » en capitales, Inter SemiBold, lettres très espacées (+32 %), couleur `#6B7A99` (doré `#E9C46A` sur fond sombre).
- Versions à livrer : horizontale fond blanc, horizontale fond bleu nuit (`#070F2B`) avec accents or, carrée (réseaux sociaux 1080 × 1080), icône seule (1024 × 1024, fond transparent), favicon (32 × 32).

**Prompt image prêt à l'emploi** :
> « Premium fintech app logo for "Scolaris", a school fee tracking app. Rounded-square app icon with a diagonal blue gradient (#3B7BFF to #0A1F5C), subtle top-left glossy highlight, a white 3D graduation cap with a golden tassel, and a green circular badge with a white checkmark at the bottom-right overlapping the cap. Next to it the wordmark "Scolaris" in a bold geometric sans-serif (Inter ExtraBold), dark navy #0A1F5C, the dot of the letter i replaced by a green circle. Tagline below in widely spaced capitals: "LA SCOLARITÉ, SANS IMPAYÉS". Clean, modern, trustworthy, white background, vector style. »

### Couleurs
| Nom | Hex | Usage |
|---|---|---|
| Bleu nuit | `#0A1F5C` | Textes principaux, titres |
| Bleu | `#1840B8` | Boutons principaux, liens, éléments actifs |
| Bleu clair | `#3B7BFF` | Début des dégradés |
| Vert | `#059669` / `#34D399` | Payé, encaissé, bouton « + Paiement » |
| Rouge | `#DC2626` | En retard, reste à payer |
| Orange | `#B45309` / fond `#FEF3C7` | Partiel, promesse de paiement |
| Or | `#E0A526` / `#E9C46A` | Accents premium (fond sombre) |
| Gris texte | `#6B7A99` | Textes secondaires |
| Fond | `#F4F7FD` | Fond des pages |
| Traits | `#E3E9F5` | Séparateurs, bordures |

### Typographie
**Inter** partout. Titres 800, sous-titres 700, texte 500-600. Chiffres importants en très gros (30-40 px) et gras.

### Style
Cartes blanches arrondies (rayon 16-18 px) avec ombre douce, en-tête bleu en dégradé arrondi en bas, pastilles de statut colorées, barre de navigation en bas sur téléphone, menu latéral sur ordinateur. Interface simple, gros boutons, utilisable par une secrétaire non habituée à l'informatique.

## 4. Fonctionnalités de la version 1

1. Créer l'école (nom, ville, logo, contacts, année scolaire).
2. Classes (ex. CP1, CM2, 6e A, Terminale SE).
3. Élèves : nom, prénom, classe, matricule (auto), 1 ou 2 numéros de parent, nom du parent, réduction éventuelle.
4. **Familles** : les élèves avec le même numéro de parent sont regroupés automatiquement (fratrie).
5. Frais par classe : total annuel + **échéances** (tranches avec montant et date). Plusieurs types de frais : inscription, scolarité, cantine, transport, tenue.
6. Réductions et bourses (montant ou pourcentage, par élève).
7. **Enregistrer un paiement** → calcul automatique du payé et du reste à payer.
8. **Reçu numéroté** envoyé au parent (WhatsApp ou SMS) + page de reçu vérifiable.
9. Liste des **retards** (par classe, par ancienneté, par famille).
10. **Rappels** : WhatsApp en un clic (gratuit) et SMS automatiques (offre Pro).
11. **Promesse de paiement** : met les rappels en pause jusqu'à une date.
12. Tableau de bord du directeur.
13. Rapports et **export Excel**.
14. Équipe : rôles directeur / secrétaire, chaque action est tracée (qui, quand).
15. Abonnement de l'école.
16. Page « solde de la famille » pour le parent (lien sécurisé, sans mot de passe).
17. Espace administrateur Scolaris.

## 5. Données (entrées et sorties)

### Entrées (ce qu'on saisit)
| Objet | Champs |
|---|---|
| École | nom, ville, quartier, logo, téléphone, e-mail, numéro Orange Money de l'école (affiché aux parents), année scolaire en cours |
| Utilisateur | nom, téléphone, e-mail, mot de passe, rôle (directeur / secrétaire), droits |
| Classe | nom, niveau, ordre d'affichage |
| Frais | type (scolarité, inscription, cantine…), classe, montant annuel |
| Échéance | frais, libellé (1re tranche…), montant, date limite |
| Élève | prénom, nom, classe, matricule, sexe (option), date de naissance (option), parent (nom, téléphone 1, téléphone 2), réduction |
| Paiement | élève, montant, mode (espèces, Orange Money, MTN MoMo, banque, autre), référence (option), échéance concernée (ou répartition automatique), date, enregistré par |
| Promesse | élève/famille, date promise, note |
| Réglages des rappels | jours d'envoi, heures (8 h–19 h), canal (WhatsApp / SMS), modèles de messages |

### Sorties (ce que l'application produit)
| Sortie | Contenu |
|---|---|
| Solde élève | total dû, payé, reste, % payé, statut (à jour / partiel / en retard / soldé) |
| Solde famille | somme des soldes des enfants |
| Tableau de bord | attendu, encaissé, restant, % encaissé, nombre d'élèves en retard, encaissé du jour / de la semaine / du mois, rappels envoyés |
| Reçu | n°, école + logo, élève, classe, montant, mode, date, encaissé par, nouveau reste à payer |
| Liste des retards | famille/élève, classe, montant en retard, jours de retard, dernier rappel, statut promesse |
| Rapports | encaissements par période, par classe, par mode, par utilisateur ; impayés par classe |
| Exports | Excel (élèves, paiements, impayés) |
| Messages | rappels et reçus (WhatsApp / SMS) |

## 6. Pages de l'application (21 pages)

Chaque page doit exister en **version téléphone** et **version ordinateur**.

### Partie publique
1. **Accueil (site vitrine)** — titre « La scolarité, sans impayés », 3 avantages (savoir qui a payé ; relances automatiques ; plus de vols ni de cahiers perdus), captures de l'app, tarifs (section 10), bouton « Essai gratuit 1 mois », témoignages (plus tard), contact WhatsApp.
2. **Connexion** — téléphone ou e-mail + mot de passe, « Mot de passe oublié ».
3. **Inscription de l'école** — nom de l'école, ville, nom du directeur, téléphone, mot de passe.
4. **Mot de passe oublié** — code par SMS ou e-mail.

### Espace école
5. **Tableau de bord** — en-tête bleu : « Encaissé cette année » en très gros, barre de progression, « Attendu : X GNF », % payé. Cartes : Reste à encaisser (rouge), Élèves en retard (rouge, X / total), Encaissé aujourd'hui (vert), Rappels envoyés ce mois. Liste des derniers paiements. Bouton flottant vert « + Paiement ». Sur ordinateur : graphique des encaissements par mois, tableau des classes avec leur % payé.
6. **Classes** — liste des classes avec effectif, total attendu, encaissé, % payé (barre), nombre en retard.
7. **Élèves** — recherche par nom/matricule, filtres classe et statut (à jour, partiel, en retard, soldé), chaque ligne : initiales, nom, classe, reste à payer, pastille de statut.
8. **Fiche élève** — en-tête : nom, classe, parent, téléphone. Carte : Déjà payé (vert) / Reste à payer (rouge), barre, total de l'année. Échéances avec statut (Payé / Partiel / En retard / À venir). Historique des paiements (n° de reçu) et des rappels (envoyé / lu). Boutons « + Paiement » et « Relancer ». Bouton « Promesse de paiement ».
9. **Ajouter des élèves** — formulaire un par un + **import Excel** (modèle à télécharger), aperçu avant validation, détection des doublons.
10. **Nouveau paiement** — montant en très gros, élève (recherche), mode de paiement (boutons), échéance concernée, encadré vert « Après ce paiement : total payé / reste à payer », case « Envoyer le reçu au parent par WhatsApp » cochée par défaut, bouton « Enregistrer le paiement », mention « Enregistré par : [nom] · date heure ».
11. **Retards** — total en retard, filtres (toutes classes, + de 10 jours, fratries), liste par **famille** (enfants, jours de retard, montant, bouton « Relancer », ou « En pause » si promesse). Bouton « Vérifier et relancer les X familles » → écran de validation avant envoi.
12. **Rappels** — historique (date, famille, canal, statut envoyé/lu/échoué), modèles de messages modifiables, réglages (calendrier, heures, canal, fréquence max), compteur de SMS du mois.
13. **Frais et échéances** — par classe : types de frais, montant annuel, tranches (montant + date), réductions (fratrie, bourses).
14. **Rapports** — choix de la période, encaissements par classe / mode / utilisateur, impayés, bouton « Exporter en Excel ».
15. **Équipe** — liste des utilisateurs, ajouter une secrétaire, droits (enregistrer paiements, relancer, voir rapports, modifier frais).
16. **Paramètres de l'école** — nom, logo (affiché sur les reçus et messages), contacts, numéro Orange Money de l'école, année scolaire (clôturer / démarrer une nouvelle année).
17. **Abonnement** — formule actuelle, date de fin, changer de formule, historique des paiements de l'abonnement.

### Pour les parents (sans compte, via lien)
18. **Reçu** — logo de l'école, « Reçu n° », élève, classe, montant, mode, date, reste à payer, mention « Reçu vérifié par Scolaris ».
19. **Solde de la famille** — reste à payer total en gros, une carte par enfant (payé / total, barre, montant dû), liste des reçus, « Pour payer : à l'école ou Orange Money au [numéro de l'école] ».

### Administration Scolaris
20. **Écoles** — liste des écoles clientes, formule, date de fin, nombre d'élèves, dernière activité, actions (prolonger, suspendre).
21. **Envois et coûts** — SMS envoyés par école et par mois, coût, alertes de dépassement.

### Navigation
- Téléphone : barre du bas à 4 onglets — Accueil, Élèves, Retards, Rappels — + bouton flottant « + Paiement ». Le reste dans un menu (profil).
- Ordinateur : menu latéral gauche — Tableau de bord, Classes, Élèves, Paiements, Retards, Rappels, Frais, Rapports, Équipe, Paramètres, Abonnement.

## 7. Règles de calcul

- **Total dû (élève)** = somme des frais de sa classe − réductions.
- **Payé** = somme de ses paiements validés.
- **Reste à payer** = total dû − payé (jamais négatif ; un trop-perçu est signalé).
- **Montant exigible à date** = somme des échéances dont la date est passée.
- **En retard** si payé < montant exigible à date. **Montant en retard** = exigible − payé.
- **Jours de retard** = jours depuis la plus ancienne échéance non couverte.
- Statuts : **Soldé** (reste = 0) · **À jour** (rien d'exigible impayé) · **Partiel** (échéance entamée) · **En retard**.
- Un paiement sans échéance précisée est **réparti automatiquement** sur les échéances les plus anciennes.
- **Famille** = élèves partageant le même numéro de parent ; le solde famille = somme.
- Chaque paiement : numéro de reçu unique et croissant par école, non modifiable ; une annulation crée une ligne d'annulation tracée (qui, quand, pourquoi).

## 8. Rappels (règles)

| Moment | Message |
|---|---|
| J − 7 | Rappel doux : l'échéance approche |
| Jour J | Information : c'est aujourd'hui |
| J + 3 | Rappel : il reste X GNF |
| J + 10 | Plus ferme : passer à l'école / contacter la direction |
| Ensuite | 1 par semaine maximum, si le directeur le souhaite |

- **1 seul message par famille** (tous les enfants dans le même message).
- Envoi uniquement **entre 8 h et 19 h**.
- **Arrêt automatique** dès que c'est payé.
- **Promesse de paiement** → pause jusqu'à la date promise.
- Les relances groupées sont **validées par le directeur** avant envoi (évite d'écrire à un parent qui a payé mais dont le paiement n'a pas été saisi).
- Ton toujours poli ; nom de l'école toujours présent ; jamais de menace.
- Canaux : WhatsApp en un clic (offre Essentiel, gratuit) ; SMS automatiques (offre Pro) ; plus tard API WhatsApp Business.

## 9. Textes des messages

**Rappel J − 7**
> Bonjour [Parent]. [École] : l'échéance du [date] approche pour [Enfant(s)]. Montant : [montant] GNF. Merci 🙏

**Rappel retard**
> Bonjour [Parent] 👋
> [École]
> Pour [Enfant 1] ([classe]) et [Enfant 2] ([classe]), il reste [montant] GNF à payer. Échéance du [date] dépassée.
> 📄 Détail : [lien]
> Merci de régulariser auprès de l'école. Si c'est déjà fait, ignorez ce message.

**Reçu**
> ✅ Reçu n° [n°]
> Paiement reçu : [montant] GNF ([mode])
> [Enfant] · [classe]
> Reste à payer : [reste] GNF
> Merci 🙏 · [École]

**SMS (court, 160 caractères)**
> [École] : il reste [montant] GNF pour [Enfant]. Échéance [date] dépassée. Détail : [lien court]

## 10. Tarifs

| Formule | Contenu | Prix |
|---|---|---|
| Essai | Tout, pendant 1 mois | Gratuit |
| **Essentiel** | Élèves, paiements, soldes, reçus, rappels WhatsApp en un clic | **160 000 GNF / mois** |
| **Pro** | Essentiel + SMS automatiques, plusieurs utilisateurs, rapports | **270 000 GNF / mois** |
| Pro trimestriel | Pro pour 3 mois | **670 000 GNF** |
| Annuel | 10 mois payés pour 12 | Essentiel 1 600 000 · Pro 2 700 000 |

## 11. Hors version 1 (ne PAS faire maintenant)

Notes, bulletins, absences, emploi du temps, paiement en ligne dans l'application, messagerie parents-école, application Play Store / App Store (on fait une **application web** installable), comptes parents avec mot de passe, IA.

**Plus tard (V2/V3)** : photo du cahier papier → import automatique ; détection des familles qui paient souvent en retard ; messages vocaux enregistrés en soussou / pular / malinké ; API WhatsApp Business ; paiement mobile money direct vers le compte de l'école.

## 12. Technique (pour le développement)

- Application web responsive (téléphone + ordinateur), installable (PWA), très légère (réseau faible).
- Backend : Python Flask. Base : PostgreSQL (Supabase). Hébergement : Vercel.
- SMS : fournisseur local (Orange SMS API ou autre, à négocier). WhatsApp : lien `wa.me` pré-rempli au départ.
- Sécurité : mots de passe hachés, protection CSRF, liens parents signés et non devinables, chaque école ne voit que ses données, journal de toutes les actions.
- Exports Excel ; import Excel avec modèle.

## 13. Planning

| Étape | Durée |
|---|---|
| Logo + maquettes de toutes les pages | 1 semaine |
| Version 1 | 3 à 4 semaines |
| Test gratuit dans 2-3 écoles | 1 mois |
| Lancement payant | Janvier 2027 |
