"""Regles de calcul de Scolaris : soldes, retards, statuts, familles, telephones."""
import re
from datetime import date


def aujourdhui():
    return date.today().isoformat()


def montant(valeur):
    """'1 300 000', '1.300.000 GNF' -> 1300000 ; invalide -> None."""
    chiffres = re.sub(r"\D", "", str(valeur or ""))
    return int(chiffres) if chiffres else None


def gnf(n):
    """1300000 -> '1 300 000'."""
    return f"{int(n or 0):,}".replace(",", " ")


def telephone(valeur):
    """Numero guineen normalise : 9 chiffres commencant par 6 -> '224XXXXXXXXX'."""
    d = re.sub(r"\D", "", str(valeur or ""))
    if d.startswith("00"):
        d = d[2:]
    if len(d) == 9 and d.startswith("6"):
        d = "224" + d
    return d


def situation(echeances, paye, reduction=0, jour=None):
    """Situation d'un eleve.

    echeances : liste de (libelle, montant, date_limite) de sa classe.
    La reduction s'applique sur les dernieres tranches. Renvoie un dict :
    total, paye, reste, exigible, retard, jours_retard, statut, tranches.
    """
    jour = jour or aujourdhui()
    tranches = sorted(echeances, key=lambda e: e[2])
    reste_reduc = max(0, int(reduction or 0))
    dus = [int(m) for _, m, _ in tranches]
    for i in range(len(dus) - 1, -1, -1):          # reduction : dernieres tranches d'abord
        retire = min(dus[i], reste_reduc)
        dus[i] -= retire
        reste_reduc -= retire
    total = sum(dus)
    paye = max(0, int(paye or 0))
    exigible = sum(d for d, (_, _, lim) in zip(dus, tranches) if lim <= jour)
    retard = max(0, exigible - paye)

    details, cumul, jours_retard = [], 0, 0
    for d, (libelle, _, lim) in zip(dus, tranches):
        debut, cumul = cumul, cumul + d
        couvert = max(0, min(d, paye - debut))
        if d == 0 or couvert >= d:
            etat = "paye"
        elif lim <= jour:
            etat = "retard"
            if not jours_retard:
                jours_retard = (date.fromisoformat(jour) - date.fromisoformat(lim)).days
        elif couvert > 0:
            etat = "partiel"
        else:
            etat = "a_venir"
        if etat == "retard" and couvert > 0:
            etat = "partiel_retard"
        details.append({"libelle": libelle, "montant": d, "date": lim, "paye": couvert, "etat": etat})

    reste = max(0, total - paye)
    if total and reste == 0:
        statut = "solde"
    elif retard > 0:
        statut = "retard"
    elif paye > 0:
        statut = "partiel"
    else:
        statut = "a_jour"
    return {"total": total, "paye": paye, "reste": reste, "exigible": exigible, "retard": retard,
            "jours_retard": jours_retard, "statut": statut, "tranches": details,
            "trop_percu": max(0, paye - total) if total else 0,
            "pourcent": round(100 * min(paye, total) / total) if total else 0}


STATUTS = {"solde": ("Soldé", "v"), "a_jour": ("À jour", "g"), "partiel": ("Partiel", "o"),
           "retard": ("En retard", "r")}
ETATS = {"paye": ("Payé", "v"), "retard": ("En retard", "r"), "partiel_retard": ("Partiel · en retard", "r"),
         "partiel": ("Partiel", "o"), "a_venir": ("À venir", "g")}
