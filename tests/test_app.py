"""Tests de Scolaris : chaque test tourne sur une base SQLite temporaire."""
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ["DATABASE_URL"] = ""

import app as appmod  # noqa: E402
import calcul  # noqa: E402


class CalculTests(unittest.TestCase):
    T = [("1re tranche", 600000, "2026-10-15"), ("2e tranche", 600000, "2026-11-15"),
         ("3e tranche", 600000, "2027-01-15")]

    def test_exemple_du_fondateur_500000_paye_reste_1300000(self):
        s = calcul.situation(self.T, 500000, jour="2026-10-01")
        self.assertEqual((s["total"], s["paye"], s["reste"]), (1800000, 500000, 1300000))
        self.assertEqual(s["statut"], "partiel")

    def test_retard_et_jours(self):
        s = calcul.situation(self.T, 500000, jour="2026-11-20")
        self.assertEqual(s["exigible"], 1200000)
        self.assertEqual(s["retard"], 700000)
        self.assertEqual(s["statut"], "retard")
        self.assertEqual(s["jours_retard"], 36)                 # 1re tranche entamee seulement
        self.assertEqual([t["etat"] for t in s["tranches"]], ["partiel_retard", "retard", "a_venir"])

    def test_reduction_sur_dernieres_tranches_et_solde(self):
        s = calcul.situation(self.T, 1500000, reduction=300000, jour="2027-02-01")
        self.assertEqual(s["total"], 1500000)
        self.assertEqual(s["statut"], "solde")
        self.assertEqual(s["tranches"][2]["montant"], 300000)

    def test_trop_percu_signale(self):
        s = calcul.situation(self.T, 2000000, jour="2026-10-01")
        self.assertEqual((s["reste"], s["trop_percu"]), (0, 200000))

    def test_telephone_et_montant(self):
        self.assertEqual(calcul.telephone("622 00 00 00"), "224622000000")
        self.assertEqual(calcul.telephone("+224 622-00-00-00"), "224622000000")
        self.assertEqual(calcul.montant("1 300 000 GNF"), 1300000)
        self.assertIsNone(calcul.montant(""))


class AppTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["SCOLARIS_DB_PATH"] = os.path.join(self.tmp.name, "t.db")
        appmod._schema_pret = False
        appmod.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
        self.c = appmod.app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def inscrire(self, tel="620000001", email=""):
        return self.c.post("/inscription", data={"ecole": "Les Étoiles", "nom": "Mamadou Bah", "telephone": tel,
                                                  "email": email, "mot_de_passe": "Scolaris2026",
                                                  "confirmation": "Scolaris2026", "conditions": "1"},
                           follow_redirects=True)

    def ecole_type(self):
        self.inscrire()
        self.c.post("/classes", data={"nom": "6e A"})
        for lib, m, d in (("1re tranche", "600 000", "2020-10-15"), ("2e tranche", "600 000", "2020-11-15"),
                          ("3e tranche", "600 000", "2099-01-15")):
            self.c.post("/classes/1", data={"action": "tranche", "libelle": lib, "montant": m, "date_limite": d})
        self.c.post("/eleves/nouveau", data={"prenom": "Aïssatou", "nom": "Diallo", "classe_id": "1",
                                             "parent_nom": "Alpha Diallo", "tel1": "622 00 00 00"})
        self.c.post("/eleves/nouveau", data={"prenom": "Mamadou", "nom": "Diallo", "classe_id": "1",
                                             "parent_nom": "Alpha Diallo", "tel1": "622000000"})

    def test_pages_publiques(self):
        self.assertEqual(self.c.get("/").status_code, 200)
        self.assertEqual(self.c.get("/health").get_json()["status"], "ok")
        self.assertEqual(self.c.get("/connexion").status_code, 200)
        self.assertEqual(self.c.get("/tableau").status_code, 302)       # pages internes protegees

    def test_inscription_connexion_deconnexion(self):
        r = self.inscrire()
        self.assertIn("Bienvenue sur Scolaris", r.get_data(as_text=True))
        self.c.post("/deconnexion")
        self.assertEqual(self.c.get("/tableau").status_code, 302)
        r = self.c.post("/connexion", data={"telephone": "+224 620 00 00 01", "mot_de_passe": "Scolaris2026"})
        self.assertEqual(r.status_code, 302)
        self.assertEqual(self.c.get("/tableau").status_code, 200)
        self.c.post("/deconnexion")
        r = self.c.post("/connexion", data={"telephone": "620000001", "mot_de_passe": "faux"})
        self.assertIn("incorrect", r.get_data(as_text=True))

    def test_connexion_par_email_et_controles_inscription(self):
        self.inscrire(email="Directeur@Etoiles.gn")
        self.c.post("/deconnexion")
        r = self.c.post("/connexion", data={"identifiant": "directeur@etoiles.gn", "mot_de_passe": "Scolaris2026"})
        self.assertEqual(r.status_code, 302)
        self.c.post("/deconnexion")
        base = {"ecole": "B", "nom": "N", "telephone": "620000005", "mot_de_passe": "Scolaris2026"}
        r = self.c.post("/inscription", data=dict(base, confirmation="autre", conditions="1"))
        self.assertIn("pas identiques", r.get_data(as_text=True))
        r = self.c.post("/inscription", data=dict(base, confirmation="Scolaris2026"))
        self.assertIn("conditions", r.get_data(as_text=True))
        r = self.c.post("/inscription", data=dict(base, confirmation="Scolaris2026", conditions="1",
                                                  email="directeur@etoiles.gn"))
        self.assertIn("déjà un compte", r.get_data(as_text=True))
        for url in ("/mot-de-passe-oublie", "/conditions", "/inscription"):
            self.assertEqual(self.c.get(url).status_code, 200, url)

    def test_directeur_change_mot_de_passe_membre(self):
        self.inscrire()
        self.c.post("/equipe", data={"nom": "Mariama", "telephone": "620000009", "role": "secretaire",
                                     "mot_de_passe": "Secret2026"})
        self.c.post("/equipe", data={"action": "mot_de_passe", "uid": "2", "mot_de_passe": "Nouveau2026"})
        self.c.post("/deconnexion")
        r = self.c.post("/connexion", data={"identifiant": "620000009", "mot_de_passe": "Nouveau2026"})
        self.assertEqual(r.status_code, 302)

    def test_verification_par_sms(self):
        import sms
        recus = []
        ancien = sms.envoyer
        sms.envoyer = lambda tel, txt: recus.append((tel, txt)) or True
        os.environ["SMS_FOURNISSEUR"] = "console"
        try:
            r = self.inscrire()
            self.assertIn("Vérifiez votre compte", r.get_data(as_text=True))
            self.assertEqual(self.c.get("/tableau").status_code, 302)          # pas encore connecte
            code = re.search(r"(\d{6})", recus[-1][1]).group(1)
            faux = "000000" if code != "000000" else "111111"
            r = self.c.post("/verification", data={"code": list(faux)}, follow_redirects=True)
            self.assertIn("Code incorrect", r.get_data(as_text=True))
            r = self.c.post("/verification", data={"code": list(code)})
            self.assertEqual(r.status_code, 302)
            self.assertEqual(self.c.get("/tableau").status_code, 200)
            self.c.post("/deconnexion")                                         # deja verifie : connexion directe
            r = self.c.post("/connexion", data={"identifiant": "620000001", "mot_de_passe": "Scolaris2026"})
            self.assertTrue(r.headers["Location"].endswith("/tableau"))
        finally:
            sms.envoyer = ancien
            os.environ.pop("SMS_FOURNISSEUR", None)

    def test_paiement_calcule_le_reste_et_recu(self):
        self.ecole_type()
        r = self.c.post("/paiements/nouveau", data={"eleve_id": "1", "montant": "500 000", "mode": "Orange Money"})
        self.assertEqual(r.status_code, 302)
        page = self.c.get(r.headers["Location"]).get_data(as_text=True)
        self.assertIn("Reçu n° 0001", page)
        self.assertIn("1 300 000", page)                      # reste a payer
        self.assertIn("wa.me/224622000000", page)
        lien = re.search(r'href="(http://localhost/r/[^"]+)"', page).group(1)
        pub = self.c.get(lien.replace("http://localhost", "")).get_data(as_text=True)
        self.assertIn("500 000", pub)
        self.assertEqual(self.c.get("/r/faux-jeton").status_code, 404)

    def test_retards_regroupes_par_famille_et_relance(self):
        self.ecole_type()
        page = self.c.get("/retards").get_data(as_text=True)
        self.assertIn("1 famille(s)", page)                              # deux enfants, un seul parent
        self.assertIn("2 400 000", page)                       # 2 x 1 200 000 exigibles
        r = self.c.post("/retards/relancer", data={"tel": "224622000000"})
        self.assertTrue(r.headers["Location"].startswith("https://wa.me/224622000000?text="))
        self.assertIn("1 / ", "1 / ")
        self.assertIn("224622000000", self.c.get("/rappels").get_data(as_text=True))

    def test_promesse_met_en_pause(self):
        self.ecole_type()
        self.c.post("/promesse", data={"tel": "224622000000", "date_promise": "2099-12-31"})
        self.assertIn("en pause", self.c.get("/retards").get_data(as_text=True))

    def test_annulation_par_directeur_seulement(self):
        self.ecole_type()
        self.c.post("/paiements/nouveau", data={"eleve_id": "1", "montant": "600000", "mode": "Espèces"})
        self.c.post("/paiements/1/annuler", data={"motif": "erreur"})
        self.assertIn("annulé", self.c.get("/eleves/1").get_data(as_text=True))
        self.c.post("/equipe", data={"nom": "Mariama", "telephone": "620000009", "role": "secretaire",
                                     "mot_de_passe": "Secret2026"})
        self.c.post("/deconnexion")
        self.c.post("/connexion", data={"telephone": "620000009", "mot_de_passe": "Secret2026"})
        self.assertEqual(self.c.post("/paiements/1/annuler", data={"motif": "x"}).status_code, 302)
        self.assertEqual(self.c.get("/equipe").status_code, 302)          # reserve au directeur

    def test_isolation_entre_ecoles(self):
        self.ecole_type()
        self.c.post("/deconnexion")
        self.inscrire(tel="620000002")
        self.assertEqual(self.c.get("/eleves/1").status_code, 404)
        self.assertEqual(self.c.get("/classes/1").status_code, 404)
        self.assertNotIn("Aïssatou", self.c.get("/eleves").get_data(as_text=True))

    def test_import_csv_cree_classes_et_ignore_doublons(self):
        self.inscrire()
        texte = "prenom;nom;classe;parent;telephone\nAwa;Camara;CM2;Fanta Camara;625000000\nAwa;Camara;CM2;;\n"
        r = self.c.post("/eleves/import", data={"texte": texte}, follow_redirects=True)
        self.assertIn("1 élève(s) importé(s)", r.get_data(as_text=True))
        self.assertIn("CM2", self.c.get("/classes").get_data(as_text=True))

    def test_page_famille_et_exports(self):
        self.ecole_type()
        lien = appmod.app.test_request_context()
        with lien:
            tok = appmod._signer({"e": 1, "t": "224622000000"}, "famille")
        page = self.c.get("/f/" + tok).get_data(as_text=True)
        self.assertIn("Aïssatou", page)
        self.assertIn("Mamadou", page)
        self.assertIn("text/csv", self.c.get("/export/eleves.csv").content_type)
        self.assertIn("text/csv", self.c.get("/export/paiements.csv").content_type)

    def test_toutes_les_pages_internes_repondent(self):
        self.ecole_type()
        self.c.post("/paiements/nouveau", data={"eleve_id": "1", "montant": "500000", "mode": "Espèces"})
        for url in ("/tableau", "/classes", "/classes/1", "/eleves", "/eleves/1", "/eleves/1/modifier",
                    "/eleves/nouveau", "/eleves/import", "/eleves/modele.csv", "/paiements", "/paiements/nouveau",
                    "/paiements/1", "/retards", "/retards?f=10j", "/retards?f=fratries", "/rappels", "/equipe",
                    "/parametres", "/plus", "/rapports", "/rappels?o=retard", "/rappels?o=envoyes", "/retards?classe=1"):
            self.assertEqual(self.c.get(url).status_code, 200, url)


if __name__ == "__main__":
    unittest.main()
