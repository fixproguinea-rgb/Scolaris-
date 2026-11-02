"""Scolaris : suivi des frais de scolarite et relance des parents en retard."""
import csv
import io
import os
from datetime import date, datetime, timedelta
from functools import wraps
from urllib.parse import quote

from flask import (Flask, Response, abort, flash, g, redirect, render_template, request,
                   session, url_for)
from flask_wtf.csrf import CSRFProtect
from itsdangerous import BadSignature, URLSafeSerializer
from werkzeug.security import check_password_hash, generate_password_hash

import calcul
import db

PROD = bool(os.environ.get("VERCEL")) or os.environ.get("FLASK_ENV") == "production"

app = Flask(__name__)
_cle = os.environ.get("SECRET_KEY")
if PROD and not _cle:
    raise RuntimeError("SECRET_KEY est obligatoire en production.")
app.config.update(
    SECRET_KEY=_cle or os.urandom(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=PROD,
    PERMANENT_SESSION_LIFETIME=timedelta(days=60),
)
csrf = CSRFProtect(app)

MODES = ["Espèces", "Orange Money", "MTN MoMo", "Banque", "Autre"]
ROLES = {"directeur": "Directeur", "secretaire": "Secrétaire"}
_schema_pret = False


# ---------------------------------------------------------------- base de donnees
def conn():
    global _schema_pret
    if "db" not in g:
        g.db = db.connect()
        if not _schema_pret:
            db.init_schema(g.db)
            _schema_pret = True
    return g.db


@app.teardown_appcontext
def _fermer(_exc):
    c = g.pop("db", None)
    if c is not None:
        c.close()


def maintenant():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


# ---------------------------------------------------------------- filtres
@app.template_filter("gnf")
def _gnf(n):
    return calcul.gnf(n)


@app.template_filter("date_fr")
def _date_fr(v):
    if not v:
        return ""
    try:
        return date.fromisoformat(str(v)[:10]).strftime("%d/%m/%Y")
    except ValueError:
        return v


@app.template_filter("initiales")
def _initiales(nom):
    mots = [m for m in str(nom or "").split() if m]
    return "".join(m[0] for m in mots[:2]).upper() or "?"


@app.context_processor
def _contexte():
    return {"utilisateur": g.get("user"), "ecole": g.get("ecole"), "STATUTS": calcul.STATUTS,
            "ETATS": calcul.ETATS, "ROLES": ROLES}


# ---------------------------------------------------------------- comptes
@app.before_request
def _charger_utilisateur():
    g.user = g.ecole = None
    uid = session.get("uid")
    if uid and request.endpoint not in ("static", "health"):
        u = conn().execute("SELECT * FROM utilisateurs WHERE id = ? AND actif = 1", (uid,)).fetchone()
        if u:
            g.user = u
            g.ecole = conn().execute("SELECT * FROM ecoles WHERE id = ?", (u["ecole_id"],)).fetchone()
        else:
            session.clear()


def connecte(vue):
    @wraps(vue)
    def f(*a, **k):
        if not g.user:
            return redirect(url_for("connexion", suite=request.path))
        return vue(*a, **k)
    return f


def directeur(vue):
    @wraps(vue)
    @connecte
    def f(*a, **k):
        if g.user["role"] != "directeur":
            flash("Seul le directeur peut faire cette action.", "erreur")
            return redirect(url_for("tableau"))
        return vue(*a, **k)
    return f


def _signer(data, sel):
    return URLSafeSerializer(app.config["SECRET_KEY"], salt=sel).dumps(data)


def _lire(token, sel):
    try:
        return URLSafeSerializer(app.config["SECRET_KEY"], salt=sel).loads(token)
    except BadSignature:
        abort(404)


# ---------------------------------------------------------------- donnees de l'ecole
def _situations(ecole_id, jour=None):
    """Toutes les fiches eleves de l'ecole avec leur situation calculee."""
    c = conn()
    classes = {r["id"]: r for r in c.execute(
        "SELECT * FROM classes WHERE ecole_id = ? ORDER BY ordre, nom", (ecole_id,)).fetchall()}
    ech = {}
    for r in c.execute("SELECT e.* FROM echeances e JOIN classes c ON c.id = e.classe_id"
                       " WHERE c.ecole_id = ?", (ecole_id,)).fetchall():
        ech.setdefault(r["classe_id"], []).append((r["libelle"], r["montant"], r["date_limite"]))
    payes = {r["eleve_id"]: int(r["s"] or 0) for r in c.execute(
        "SELECT eleve_id, SUM(montant) AS s FROM paiements WHERE ecole_id = ? AND annule = 0"
        " GROUP BY eleve_id", (ecole_id,)).fetchall()}
    fiches = []
    for e in c.execute("SELECT * FROM eleves WHERE ecole_id = ? AND actif = 1 ORDER BY nom, prenom",
                       (ecole_id,)).fetchall():
        s = calcul.situation(ech.get(e["classe_id"], []), payes.get(e["id"], 0), e["reduction"], jour)
        cl = classes.get(e["classe_id"])
        fiches.append({"e": e, "s": s, "classe": cl["nom"] if cl else "Sans classe",
                       "famille": calcul.telephone(e["tel1"]) or "eleve-%d" % e["id"]})
    return classes, fiches


def _promesses(ecole_id):
    jour = calcul.aujourdhui()
    return {r["telephone"]: r["d"] for r in conn().execute(
        "SELECT telephone, MAX(date_promise) AS d FROM promesses WHERE ecole_id = ?"
        " GROUP BY telephone", (ecole_id,)).fetchall() if r["d"] >= jour}


def _familles(fiches):
    fam = {}
    for f in fiches:
        fam.setdefault(f["famille"], []).append(f)
    return fam


def _lien_famille(tel):
    return url_for("page_famille", token=_signer({"e": g.ecole["id"], "t": tel}, "famille"), _external=True)


def _message_rappel(enfants, total, tel):
    parent = enfants[0]["e"]["parent_nom"] or "Madame, Monsieur"
    noms = " et ".join("%s (%s)" % (f["e"]["prenom"], f["classe"]) for f in enfants)
    return ("Bonjour %s.\n%s\nPour %s, il reste %s GNF à payer (échéance dépassée).\n"
            "Détail : %s\nMerci de régulariser auprès de l'école. Si c'est déjà fait, ignorez ce message."
            % (parent, g.ecole["nom"], noms, calcul.gnf(total), _lien_famille(tel)))


def _message_recu(p, e, s):
    return ("Reçu n° %04d - %s\nPaiement reçu : %s GNF (%s)\n%s %s\nReste à payer : %s GNF\nReçu : %s\nMerci."
            % (p["recu_no"], g.ecole["nom"], calcul.gnf(p["montant"]), p["mode"], e["prenom"], e["nom"],
               calcul.gnf(s["reste"]),
               url_for("recu_public", token=_signer({"p": p["id"]}, "recu"), _external=True)))


def _wa(tel, texte):
    return "https://wa.me/%s?text=%s" % (tel, quote(texte))


# ---------------------------------------------------------------- pages publiques
@app.route("/health")
def health():
    return {"status": "ok", "app": "scolaris"}


@app.route("/")
def accueil():
    if g.user:
        return redirect(url_for("tableau"))
    return render_template("index.html")


@app.route("/inscription", methods=["GET", "POST"])
def inscription():
    if request.method == "POST":
        f = request.form
        nom_ecole, nom = f.get("ecole", "").strip(), f.get("nom", "").strip()
        tel, mdp = calcul.telephone(f.get("telephone")), f.get("mot_de_passe", "")
        if not (nom_ecole and nom and len(tel) >= 9):
            flash("Remplissez le nom de l'école, votre nom et un numéro de téléphone valide.", "erreur")
        elif len(mdp) < 8:
            flash("Le mot de passe doit faire au moins 8 caractères.", "erreur")
        elif conn().execute("SELECT 1 FROM utilisateurs WHERE telephone = ?", (tel,)).fetchone():
            flash("Ce numéro a déjà un compte. Connectez-vous.", "erreur")
        else:
            c = conn()
            eid = c.insert("INSERT INTO ecoles (nom, ville, telephone, annee, cree_le) VALUES (?, ?, ?, ?, ?)",
                           (nom_ecole, f.get("ville", "").strip(), tel, f.get("annee", "").strip(), maintenant()))
            uid = c.insert("INSERT INTO utilisateurs (ecole_id, nom, telephone, mot_de_passe, role, cree_le)"
                           " VALUES (?, ?, ?, ?, 'directeur', ?)",
                           (eid, nom, tel, generate_password_hash(mdp), maintenant()))
            c.commit()
            session.clear()
            session.permanent = True
            session["uid"] = uid
            flash("Bienvenue sur Scolaris ! Commencez par créer vos classes.", "ok")
            return redirect(url_for("classes"))
    return render_template("inscription.html")


@app.route("/connexion", methods=["GET", "POST"])
def connexion():
    if request.method == "POST":
        tel = calcul.telephone(request.form.get("telephone"))
        u = conn().execute("SELECT * FROM utilisateurs WHERE telephone = ? AND actif = 1", (tel,)).fetchone()
        if u and check_password_hash(u["mot_de_passe"], request.form.get("mot_de_passe", "")):
            session.clear()
            session.permanent = True
            session["uid"] = u["id"]
            suite = request.args.get("suite", "")
            return redirect(suite if suite.startswith("/") and not suite.startswith("//") else url_for("tableau"))
        flash("Numéro ou mot de passe incorrect.", "erreur")
    return render_template("connexion.html")


@app.route("/deconnexion", methods=["POST"])
def deconnexion():
    session.clear()
    return redirect(url_for("accueil"))


@app.route("/r/<token>")
def recu_public(token):
    pid = _lire(token, "recu").get("p")
    c = conn()
    p = c.execute("SELECT * FROM paiements WHERE id = ?", (pid,)).fetchone() or abort(404)
    e = c.execute("SELECT * FROM eleves WHERE id = ?", (p["eleve_id"],)).fetchone()
    ec = c.execute("SELECT * FROM ecoles WHERE id = ?", (p["ecole_id"],)).fetchone()
    cl = c.execute("SELECT nom FROM classes WHERE id = ?", (e["classe_id"],)).fetchone()
    return render_template("recu_public.html", p=p, e=e, ec=ec, classe=cl["nom"] if cl else "")


@app.route("/f/<token>")
def page_famille(token):
    d = _lire(token, "famille")
    ec = conn().execute("SELECT * FROM ecoles WHERE id = ?", (d.get("e"),)).fetchone() or abort(404)
    _, fiches = _situations(ec["id"])
    enfants = [f for f in fiches if f["famille"] == d.get("t")] or abort(404)
    ids = [f["e"]["id"] for f in enfants]
    recus = conn().execute(
        "SELECT * FROM paiements WHERE annule = 0 AND eleve_id IN (%s) ORDER BY date_paiement DESC, id DESC"
        % ",".join("?" * len(ids)), ids).fetchall()
    noms = {f["e"]["id"]: f["e"]["prenom"] for f in enfants}
    return render_template("famille_public.html", ec=ec, enfants=enfants, recus=recus, noms=noms,
                           reste=sum(f["s"]["reste"] for f in enfants))


# ---------------------------------------------------------------- tableau de bord
@app.route("/tableau")
@connecte
def tableau():
    classes, fiches = _situations(g.ecole["id"])
    jour = calcul.aujourdhui()
    attendu = sum(f["s"]["total"] for f in fiches)
    encaisse = sum(min(f["s"]["paye"], f["s"]["total"]) for f in fiches)
    c = conn()
    du_jour = c.execute("SELECT COALESCE(SUM(montant), 0) AS s FROM paiements WHERE ecole_id = ? AND annule = 0"
                        " AND date_paiement = ?", (g.ecole["id"], jour)).fetchone()["s"]
    mois = jour[:7]
    rappels = c.execute("SELECT COUNT(*) AS n FROM rappels WHERE ecole_id = ? AND cree_le LIKE ?",
                        (g.ecole["id"], mois + "%")).fetchone()["n"]
    derniers = c.execute(
        "SELECT p.*, e.prenom, e.nom FROM paiements p JOIN eleves e ON e.id = p.eleve_id"
        " WHERE p.ecole_id = ? AND p.annule = 0 ORDER BY p.id DESC LIMIT 6", (g.ecole["id"],)).fetchall()
    par_classe = []
    for cid, cl in classes.items():
        fs = [f for f in fiches if f["e"]["classe_id"] == cid]
        t = sum(f["s"]["total"] for f in fs)
        p = sum(min(f["s"]["paye"], f["s"]["total"]) for f in fs)
        par_classe.append({"c": cl, "n": len(fs), "total": t, "paye": p,
                           "pc": round(100 * p / t) if t else 0,
                           "retards": sum(1 for f in fs if f["s"]["statut"] == "retard")})
    return render_template("tableau.html", attendu=attendu, encaisse=encaisse, reste=attendu - encaisse,
                           pc=round(100 * encaisse / attendu) if attendu else 0,
                           en_retard=sum(1 for f in fiches if f["s"]["statut"] == "retard"),
                           nb=len(fiches), du_jour=du_jour, rappels=rappels, derniers=derniers,
                           par_classe=par_classe, sans_classe=not classes)


# ---------------------------------------------------------------- classes et tranches
@app.route("/classes", methods=["GET", "POST"])
@connecte
def classes():
    c = conn()
    if request.method == "POST":
        if g.user["role"] != "directeur":
            abort(403)
        nom = request.form.get("nom", "").strip()
        if nom:
            n = c.execute("SELECT COUNT(*) AS n FROM classes WHERE ecole_id = ?", (g.ecole["id"],)).fetchone()["n"]
            cid = c.insert("INSERT INTO classes (ecole_id, nom, ordre) VALUES (?, ?, ?)", (g.ecole["id"], nom, n))
            c.commit()
            flash("Classe « %s » créée. Ajoutez maintenant ses tranches de paiement." % nom, "ok")
            return redirect(url_for("classe", cid=cid))
    cls, fiches = _situations(g.ecole["id"])
    lignes = []
    for cid, cl in cls.items():
        fs = [f for f in fiches if f["e"]["classe_id"] == cid]
        t = sum(f["s"]["total"] for f in fs)
        p = sum(min(f["s"]["paye"], f["s"]["total"]) for f in fs)
        tranches = c.execute("SELECT COALESCE(SUM(montant), 0) AS s, COUNT(*) AS n FROM echeances"
                             " WHERE classe_id = ?", (cid,)).fetchone()
        lignes.append({"c": cl, "n": len(fs), "pc": round(100 * p / t) if t else 0, "annuel": tranches["s"],
                       "nb_tranches": tranches["n"],
                       "retards": sum(1 for f in fs if f["s"]["statut"] == "retard")})
    return render_template("classes.html", lignes=lignes)


def _classe_ou_404(cid):
    return conn().execute("SELECT * FROM classes WHERE id = ? AND ecole_id = ?",
                          (cid, g.ecole["id"])).fetchone() or abort(404)


@app.route("/classes/<int:cid>", methods=["GET", "POST"])
@connecte
def classe(cid):
    cl = _classe_ou_404(cid)
    c = conn()
    if request.method == "POST":
        if g.user["role"] != "directeur":
            abort(403)
        action = request.form.get("action")
        if action == "tranche":
            m = calcul.montant(request.form.get("montant"))
            d = request.form.get("date_limite", "")
            lib = request.form.get("libelle", "").strip() or "Tranche"
            if m and d:
                c.insert("INSERT INTO echeances (classe_id, libelle, montant, date_limite) VALUES (?, ?, ?, ?)",
                         (cid, lib, m, d))
                c.commit()
                flash("Tranche ajoutée.", "ok")
            else:
                flash("Indiquez le montant et la date limite de la tranche.", "erreur")
        elif action == "supprimer_tranche":
            c.execute("DELETE FROM echeances WHERE id = ? AND classe_id = ?", (request.form.get("tid"), cid))
            c.commit()
            flash("Tranche supprimée.", "ok")
        elif action == "renommer":
            nom = request.form.get("nom", "").strip()
            if nom:
                c.execute("UPDATE classes SET nom = ? WHERE id = ?", (nom, cid))
                c.commit()
                flash("Classe renommée.", "ok")
        return redirect(url_for("classe", cid=cid))
    tranches = c.execute("SELECT * FROM echeances WHERE classe_id = ? ORDER BY date_limite", (cid,)).fetchall()
    _, fiches = _situations(g.ecole["id"])
    eleves = [f for f in fiches if f["e"]["classe_id"] == cid]
    return render_template("classe.html", cl=cl, tranches=tranches, eleves=eleves,
                           total=sum(t["montant"] for t in tranches))


# ---------------------------------------------------------------- eleves
@app.route("/eleves")
@connecte
def eleves():
    cls, fiches = _situations(g.ecole["id"])
    q = request.args.get("q", "").strip().lower()
    cid = request.args.get("classe", type=int)
    st = request.args.get("statut", "")
    if q:
        fiches = [f for f in fiches if q in ("%s %s %s %s" % (f["e"]["prenom"], f["e"]["nom"],
                                                               f["e"]["matricule"] or "", f["e"]["parent_nom"] or "")).lower()]
    if cid:
        fiches = [f for f in fiches if f["e"]["classe_id"] == cid]
    if st:
        fiches = [f for f in fiches if f["s"]["statut"] == st]
    return render_template("eleves.html", fiches=fiches, classes=cls, q=q, cid=cid, st=st)


def _champs_eleve(f):
    return {"prenom": f.get("prenom", "").strip(), "nom": f.get("nom", "").strip(),
            "classe_id": f.get("classe_id", type=int), "parent_nom": f.get("parent_nom", "").strip(),
            "tel1": calcul.telephone(f.get("tel1")), "tel2": calcul.telephone(f.get("tel2")),
            "reduction": calcul.montant(f.get("reduction")) or 0}


def _matricule(c):
    n = c.execute("SELECT COUNT(*) AS n FROM eleves WHERE ecole_id = ?", (g.ecole["id"],)).fetchone()["n"]
    return "%s-%04d" % (date.today().year, n + 1)


@app.route("/eleves/nouveau", methods=["GET", "POST"])
@connecte
def eleve_nouveau():
    c = conn()
    cls = c.execute("SELECT * FROM classes WHERE ecole_id = ? ORDER BY ordre, nom", (g.ecole["id"],)).fetchall()
    if request.method == "POST":
        d = _champs_eleve(request.form)
        if not (d["prenom"] and d["nom"] and d["classe_id"]):
            flash("Prénom, nom et classe sont obligatoires.", "erreur")
        else:
            _classe_ou_404(d["classe_id"])
            eid = c.insert("INSERT INTO eleves (ecole_id, classe_id, prenom, nom, matricule, parent_nom, tel1, tel2,"
                           " reduction, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                           (g.ecole["id"], d["classe_id"], d["prenom"], d["nom"], _matricule(c), d["parent_nom"],
                            d["tel1"], d["tel2"], d["reduction"], maintenant()))
            c.commit()
            flash("%s %s ajouté(e)." % (d["prenom"], d["nom"]), "ok")
            if request.form.get("encore"):
                return redirect(url_for("eleve_nouveau", classe=d["classe_id"]))
            return redirect(url_for("eleve", eid=eid))
    return render_template("eleve_form.html", cls=cls, e=None, choix=request.args.get("classe", type=int))


def _eleve_ou_404(eid):
    return conn().execute("SELECT * FROM eleves WHERE id = ? AND ecole_id = ?",
                          (eid, g.ecole["id"])).fetchone() or abort(404)


@app.route("/eleves/<int:eid>/modifier", methods=["GET", "POST"])
@connecte
def eleve_modifier(eid):
    e = _eleve_ou_404(eid)
    c = conn()
    cls = c.execute("SELECT * FROM classes WHERE ecole_id = ? ORDER BY ordre, nom", (g.ecole["id"],)).fetchall()
    if request.method == "POST":
        if request.form.get("action") == "retirer":
            c.execute("UPDATE eleves SET actif = 0 WHERE id = ?", (eid,))
            c.commit()
            flash("Élève retiré de la liste.", "ok")
            return redirect(url_for("eleves"))
        d = _champs_eleve(request.form)
        if not (d["prenom"] and d["nom"] and d["classe_id"]):
            flash("Prénom, nom et classe sont obligatoires.", "erreur")
        else:
            _classe_ou_404(d["classe_id"])
            c.execute("UPDATE eleves SET classe_id = ?, prenom = ?, nom = ?, parent_nom = ?, tel1 = ?, tel2 = ?,"
                      " reduction = ? WHERE id = ?", (d["classe_id"], d["prenom"], d["nom"], d["parent_nom"],
                                                      d["tel1"], d["tel2"], d["reduction"], eid))
            c.commit()
            flash("Fiche mise à jour.", "ok")
            return redirect(url_for("eleve", eid=eid))
    return render_template("eleve_form.html", cls=cls, e=e, choix=e["classe_id"])


@app.route("/eleves/<int:eid>")
@connecte
def eleve(eid):
    e = _eleve_ou_404(eid)
    _, fiches = _situations(g.ecole["id"])
    f = next(x for x in fiches if x["e"]["id"] == eid)
    c = conn()
    paiements = c.execute("SELECT p.*, u.nom AS par FROM paiements p LEFT JOIN utilisateurs u ON u.id = p.enregistre_par"
                          " WHERE p.eleve_id = ? ORDER BY p.id DESC", (eid,)).fetchall()
    rappels = c.execute("SELECT * FROM rappels WHERE ecole_id = ? AND telephone = ? ORDER BY id DESC LIMIT 10",
                        (g.ecole["id"], f["famille"])).fetchall()
    return render_template("eleve.html", f=f, e=e, paiements=paiements, rappels=rappels,
                           promesse=_promesses(g.ecole["id"]).get(f["famille"]))


@app.route("/eleves/import", methods=["GET", "POST"])
@connecte
def eleves_import():
    if request.method == "POST":
        fichier = request.files.get("fichier")
        brut = fichier.read().decode("utf-8-sig", errors="replace") if fichier else request.form.get("texte", "")
        sep = ";" if brut.count(";") >= brut.count(",") else ","
        c = conn()
        cls = {r["nom"].strip().lower(): r["id"] for r in c.execute(
            "SELECT * FROM classes WHERE ecole_id = ?", (g.ecole["id"],)).fetchall()}
        ajoutes, ignores = 0, 0
        for ligne in csv.reader(io.StringIO(brut), delimiter=sep):
            cols = [x.strip() for x in ligne] + [""] * 7
            prenom, nom, classe_nom = cols[0], cols[1], cols[2]
            if not (prenom and nom and classe_nom) or prenom.lower() == "prenom" or prenom.lower() == "prénom":
                ignores += 1 if any(cols[:3]) and prenom.lower() not in ("prenom", "prénom") else 0
                continue
            cid = cls.get(classe_nom.lower())
            if not cid:
                cid = c.insert("INSERT INTO classes (ecole_id, nom, ordre) VALUES (?, ?, ?)",
                               (g.ecole["id"], classe_nom, len(cls)))
                cls[classe_nom.lower()] = cid
            if c.execute("SELECT 1 FROM eleves WHERE ecole_id = ? AND actif = 1 AND lower(prenom) = ? AND lower(nom) = ?"
                         " AND classe_id = ?", (g.ecole["id"], prenom.lower(), nom.lower(), cid)).fetchone():
                ignores += 1
                continue
            c.insert("INSERT INTO eleves (ecole_id, classe_id, prenom, nom, matricule, parent_nom, tel1, tel2,"
                     " reduction, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     (g.ecole["id"], cid, prenom, nom, _matricule(c), cols[3], calcul.telephone(cols[4]),
                      calcul.telephone(cols[5]), calcul.montant(cols[6]) or 0, maintenant()))
            ajoutes += 1
        c.commit()
        flash("%d élève(s) importé(s)%s." % (ajoutes, ", %d ignoré(s) (doublons ou lignes incomplètes)" % ignores
                                              if ignores else ""), "ok" if ajoutes else "erreur")
        return redirect(url_for("eleves"))
    return render_template("eleves_import.html")


@app.route("/eleves/modele.csv")
@connecte
def modele_csv():
    texte = ("prenom;nom;classe;parent;telephone;telephone2;reduction\n"
             "Aïssatou;Diallo;6e A;Alpha Diallo;622000000;;0\n")
    return Response("﻿" + texte, mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=modele-eleves-scolaris.csv"})


# ---------------------------------------------------------------- paiements
@app.route("/paiements/nouveau", methods=["GET", "POST"])
@connecte
def paiement_nouveau():
    cls, fiches = _situations(g.ecole["id"])
    eid = request.values.get("eleve_id", type=int)
    choisi = next((f for f in fiches if f["e"]["id"] == eid), None)
    if request.method == "POST":
        m = calcul.montant(request.form.get("montant"))
        mode = request.form.get("mode") if request.form.get("mode") in MODES else "Espèces"
        jour = request.form.get("date_paiement") or calcul.aujourdhui()
        if not choisi:
            flash("Choisissez l'élève.", "erreur")
        elif not m:
            flash("Indiquez le montant reçu.", "erreur")
        else:
            c = conn()
            no = c.execute("UPDATE ecoles SET recu_seq = recu_seq + 1 WHERE id = ? RETURNING recu_seq",
                           (g.ecole["id"],)).fetchone()["recu_seq"]
            pid = c.insert("INSERT INTO paiements (ecole_id, eleve_id, montant, mode, reference, recu_no, date_paiement,"
                           " enregistre_par, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                           (g.ecole["id"], eid, m, mode, request.form.get("reference", "").strip(), no, jour,
                            g.user["id"], maintenant()))
            c.commit()
            return redirect(url_for("paiement_fait", pid=pid))
    return render_template("paiement_form.html", fiches=fiches, choisi=choisi, modes=MODES,
                           jour=calcul.aujourdhui())


def _paiement_ou_404(pid):
    return conn().execute("SELECT * FROM paiements WHERE id = ? AND ecole_id = ?",
                          (pid, g.ecole["id"])).fetchone() or abort(404)


@app.route("/paiements/<int:pid>")
@connecte
def paiement_fait(pid):
    p = _paiement_ou_404(pid)
    e = _eleve_ou_404(p["eleve_id"])
    _, fiches = _situations(g.ecole["id"])
    f = next(x for x in fiches if x["e"]["id"] == e["id"])
    tel = calcul.telephone(e["tel1"])
    return render_template("paiement_fait.html", p=p, f=f,
                           wa=_wa(tel, _message_recu(p, e, f["s"])) if tel else None,
                           lien=url_for("recu_public", token=_signer({"p": p["id"]}, "recu"), _external=True))


@app.route("/paiements/<int:pid>/annuler", methods=["POST"])
@directeur
def paiement_annuler(pid):
    p = _paiement_ou_404(pid)
    motif = request.form.get("motif", "").strip()
    if not motif:
        flash("Indiquez le motif de l'annulation.", "erreur")
    else:
        conn().execute("UPDATE paiements SET annule = 1, annule_par = ?, annule_motif = ? WHERE id = ?",
                       (g.user["id"], motif, pid))
        conn().commit()
        flash("Paiement n° %04d annulé." % p["recu_no"], "ok")
    return redirect(url_for("eleve", eid=p["eleve_id"]))


@app.route("/paiements")
@connecte
def paiements():
    du = request.args.get("du") or (date.today() - timedelta(days=30)).isoformat()
    au = request.args.get("au") or calcul.aujourdhui()
    lignes = conn().execute(
        "SELECT p.*, e.prenom, e.nom, u.nom AS par FROM paiements p JOIN eleves e ON e.id = p.eleve_id"
        " LEFT JOIN utilisateurs u ON u.id = p.enregistre_par WHERE p.ecole_id = ? AND p.date_paiement >= ?"
        " AND p.date_paiement <= ? ORDER BY p.date_paiement DESC, p.id DESC", (g.ecole["id"], du, au)).fetchall()
    valides = [p for p in lignes if not p["annule"]]
    par_mode = {}
    for p in valides:
        par_mode[p["mode"]] = par_mode.get(p["mode"], 0) + p["montant"]
    return render_template("paiements.html", lignes=lignes, du=du, au=au,
                           total=sum(p["montant"] for p in valides), par_mode=par_mode)


# ---------------------------------------------------------------- retards et rappels
@app.route("/retards")
@connecte
def retards():
    _, fiches = _situations(g.ecole["id"])
    promesses = _promesses(g.ecole["id"])
    derniers = {r["telephone"]: r["d"] for r in conn().execute(
        "SELECT telephone, MAX(cree_le) AS d FROM rappels WHERE ecole_id = ? GROUP BY telephone",
        (g.ecole["id"],)).fetchall()}
    familles = []
    for tel, enfants in _familles(fiches).items():
        en_retard = [f for f in enfants if f["s"]["retard"] > 0]
        if not en_retard:
            continue
        familles.append({"tel": tel, "enfants": en_retard, "retard": sum(f["s"]["retard"] for f in en_retard),
                         "jours": max(f["s"]["jours_retard"] for f in en_retard), "promesse": promesses.get(tel),
                         "dernier": derniers.get(tel), "joignable": not tel.startswith("eleve-")})
    filtre = request.args.get("f", "")
    if filtre == "10j":
        familles = [x for x in familles if x["jours"] >= 10]
    elif filtre == "fratries":
        familles = [x for x in familles if len(x["enfants"]) > 1]
    familles.sort(key=lambda x: (-x["jours"], -x["retard"]))
    return render_template("retards.html", familles=familles, total=sum(x["retard"] for x in familles), filtre=filtre)


@app.route("/retards/relancer", methods=["POST"])
@connecte
def relancer():
    tel = request.form.get("tel", "")
    _, fiches = _situations(g.ecole["id"])
    enfants = [f for f in _familles(fiches).get(tel, []) if f["s"]["retard"] > 0]
    if not enfants or tel.startswith("eleve-"):
        flash("Aucun retard à relancer pour ce numéro.", "erreur")
        return redirect(url_for("retards"))
    total = sum(f["s"]["retard"] for f in enfants)
    texte = _message_rappel(enfants, total, tel)
    conn().execute("INSERT INTO rappels (ecole_id, telephone, montant, canal, message, envoye_par, cree_le)"
                   " VALUES (?, ?, ?, 'whatsapp', ?, ?, ?)", (g.ecole["id"], tel, total, texte, g.user["id"],
                                                               maintenant()))
    conn().commit()
    return redirect(_wa(tel, texte))


@app.route("/promesse", methods=["POST"])
@connecte
def promesse():
    tel, d = request.form.get("tel", ""), request.form.get("date_promise", "")
    if tel and d:
        conn().execute("INSERT INTO promesses (ecole_id, telephone, date_promise, note, cree_le) VALUES (?, ?, ?, ?, ?)",
                       (g.ecole["id"], tel, d, request.form.get("note", "").strip(), maintenant()))
        conn().commit()
        flash("Promesse notée : relances en pause jusqu'au %s." % _date_fr(d), "ok")
    return redirect(request.referrer or url_for("retards"))


@app.route("/rappels")
@connecte
def rappels():
    lignes = conn().execute("SELECT r.*, u.nom AS par FROM rappels r LEFT JOIN utilisateurs u ON u.id = r.envoye_par"
                            " WHERE r.ecole_id = ? ORDER BY r.id DESC LIMIT 200", (g.ecole["id"],)).fetchall()
    return render_template("rappels.html", lignes=lignes)


# ---------------------------------------------------------------- equipe et parametres
@app.route("/equipe", methods=["GET", "POST"])
@directeur
def equipe():
    c = conn()
    if request.method == "POST":
        if request.form.get("action") == "desactiver":
            uid = request.form.get("uid", type=int)
            if uid != g.user["id"]:
                c.execute("UPDATE utilisateurs SET actif = 0 WHERE id = ? AND ecole_id = ?", (uid, g.ecole["id"]))
                c.commit()
                flash("Accès retiré.", "ok")
        else:
            nom, tel = request.form.get("nom", "").strip(), calcul.telephone(request.form.get("telephone"))
            mdp = request.form.get("mot_de_passe", "")
            role = request.form.get("role") if request.form.get("role") in ROLES else "secretaire"
            if not (nom and len(tel) >= 9 and len(mdp) >= 8):
                flash("Nom, téléphone et mot de passe (8 caractères minimum) sont obligatoires.", "erreur")
            elif c.execute("SELECT 1 FROM utilisateurs WHERE telephone = ?", (tel,)).fetchone():
                flash("Ce numéro a déjà un compte.", "erreur")
            else:
                c.insert("INSERT INTO utilisateurs (ecole_id, nom, telephone, mot_de_passe, role, cree_le)"
                         " VALUES (?, ?, ?, ?, ?, ?)", (g.ecole["id"], nom, tel, generate_password_hash(mdp), role,
                                                        maintenant()))
                c.commit()
                flash("%s peut maintenant se connecter avec son numéro." % nom, "ok")
        return redirect(url_for("equipe"))
    membres = c.execute("SELECT * FROM utilisateurs WHERE ecole_id = ? AND actif = 1 ORDER BY role, nom",
                        (g.ecole["id"],)).fetchall()
    return render_template("equipe.html", membres=membres)


@app.route("/parametres", methods=["GET", "POST"])
@directeur
def parametres():
    if request.method == "POST":
        f = request.form
        nom = f.get("nom", "").strip()
        if nom:
            conn().execute("UPDATE ecoles SET nom = ?, ville = ?, telephone = ?, om_numero = ?, annee = ? WHERE id = ?",
                           (nom, f.get("ville", "").strip(), calcul.telephone(f.get("telephone")),
                            f.get("om_numero", "").strip(), f.get("annee", "").strip(), g.ecole["id"]))
            conn().commit()
            flash("Paramètres enregistrés.", "ok")
        return redirect(url_for("parametres"))
    return render_template("parametres.html")


# ---------------------------------------------------------------- exports
def _csv(nom, entetes, lignes):
    sortie = io.StringIO()
    w = csv.writer(sortie, delimiter=";")
    w.writerow(entetes)
    w.writerows(lignes)
    return Response("﻿" + sortie.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=%s" % nom})


@app.route("/export/<quoi>.csv")
@connecte
def export(quoi):
    _, fiches = _situations(g.ecole["id"])
    if quoi == "eleves":
        return _csv("eleves.csv", ["Matricule", "Prénom", "Nom", "Classe", "Parent", "Téléphone", "Total", "Payé",
                                   "Reste", "En retard", "Statut"],
                    [[f["e"]["matricule"], f["e"]["prenom"], f["e"]["nom"], f["classe"], f["e"]["parent_nom"],
                      f["e"]["tel1"], f["s"]["total"], f["s"]["paye"], f["s"]["reste"], f["s"]["retard"],
                      calcul.STATUTS[f["s"]["statut"]][0]] for f in fiches])
    if quoi == "paiements":
        rows = conn().execute(
            "SELECT p.*, e.prenom, e.nom FROM paiements p JOIN eleves e ON e.id = p.eleve_id WHERE p.ecole_id = ?"
            " ORDER BY p.date_paiement, p.id", (g.ecole["id"],)).fetchall()
        return _csv("paiements.csv", ["Reçu", "Date", "Élève", "Montant", "Mode", "Référence", "Annulé"],
                    [["%04d" % p["recu_no"], p["date_paiement"], "%s %s" % (p["prenom"], p["nom"]), p["montant"],
                      p["mode"], p["reference"], "oui" if p["annule"] else ""] for p in rows])
    abort(404)


@app.errorhandler(404)
def _404(_e):
    return render_template("erreur.html", titre="Page introuvable",
                           texte="Cette page n'existe pas ou n'est plus disponible."), 404


@app.errorhandler(403)
def _403(_e):
    return render_template("erreur.html", titre="Accès refusé",
                           texte="Vous n'avez pas le droit de faire cette action."), 403


if __name__ == "__main__":
    app.run(debug=True)
