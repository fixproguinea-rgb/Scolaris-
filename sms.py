"""Envoi des SMS (codes de verification).

Le fournisseur se choisit avec la variable SMS_FOURNISSEUR :
- "twilio"  : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (numero ou nom d'expediteur)
- "console" : le message est seulement ecrit dans les journaux (tests, developpement)
Sans fournisseur, la verification par SMS est desactivee (les comptes sont actifs tout de suite).
"""
import base64
import json
import logging
import os
import urllib.parse
import urllib.request

log = logging.getLogger("scolaris.sms")


def fournisseur():
    return (os.environ.get("SMS_FOURNISSEUR") or "").strip().lower()


def actif():
    return fournisseur() in ("twilio", "console")


def envoyer(telephone, texte):
    """Envoie un SMS au numero normalise (224XXXXXXXXX). Renvoie True si accepte."""
    f = fournisseur()
    if f == "console":
        log.warning("SMS (console) vers %s : %s", telephone, texte)
        return True
    if f == "twilio":
        sid, jeton = os.environ.get("TWILIO_ACCOUNT_SID", ""), os.environ.get("TWILIO_AUTH_TOKEN", "")
        donnees = urllib.parse.urlencode({"To": "+" + telephone, "From": os.environ.get("TWILIO_FROM", ""),
                                          "Body": texte}).encode()
        req = urllib.request.Request(
            "https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json" % sid, data=donnees,
            headers={"Authorization": "Basic " + base64.b64encode(("%s:%s" % (sid, jeton)).encode()).decode()})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return 200 <= r.status < 300 and bool(json.loads(r.read() or b"{}").get("sid"))
        except Exception:  # noqa: BLE001 - on journalise sans planter l'inscription
            log.exception("Echec d'envoi du SMS")
            return False
    return False
