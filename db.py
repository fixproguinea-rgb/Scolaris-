"""Acces aux donnees de Scolaris.

SQLite en local (fichier SCOLARIS_DB_PATH, par defaut scolaris.db), PostgreSQL
(Supabase) en production des que DATABASE_URL est defini. Les requetes
utilisent toujours le placeholder `?`, traduit en `%s` pour PostgreSQL.
"""
import os
import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS ecoles (
    id {PK}, nom TEXT NOT NULL, ville TEXT, telephone TEXT, om_numero TEXT,
    annee TEXT, recu_seq INTEGER DEFAULT 0, cree_le TEXT);
CREATE TABLE IF NOT EXISTS utilisateurs (
    id {PK}, ecole_id INTEGER NOT NULL, nom TEXT NOT NULL, telephone TEXT NOT NULL UNIQUE,
    mot_de_passe TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'secretaire', actif INTEGER DEFAULT 1, cree_le TEXT,
    email TEXT);
CREATE TABLE IF NOT EXISTS classes (
    id {PK}, ecole_id INTEGER NOT NULL, nom TEXT NOT NULL, ordre INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS echeances (
    id {PK}, classe_id INTEGER NOT NULL, libelle TEXT NOT NULL, montant INTEGER NOT NULL,
    date_limite TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS eleves (
    id {PK}, ecole_id INTEGER NOT NULL, classe_id INTEGER, prenom TEXT NOT NULL, nom TEXT NOT NULL,
    matricule TEXT, parent_nom TEXT, tel1 TEXT, tel2 TEXT, reduction INTEGER DEFAULT 0,
    actif INTEGER DEFAULT 1, cree_le TEXT);
CREATE TABLE IF NOT EXISTS paiements (
    id {PK}, ecole_id INTEGER NOT NULL, eleve_id INTEGER NOT NULL, montant INTEGER NOT NULL,
    mode TEXT, reference TEXT, recu_no INTEGER, date_paiement TEXT, enregistre_par INTEGER,
    annule INTEGER DEFAULT 0, annule_par INTEGER, annule_motif TEXT, cree_le TEXT);
CREATE TABLE IF NOT EXISTS rappels (
    id {PK}, ecole_id INTEGER NOT NULL, telephone TEXT NOT NULL, montant INTEGER, canal TEXT,
    message TEXT, envoye_par INTEGER, cree_le TEXT);
CREATE TABLE IF NOT EXISTS promesses (
    id {PK}, ecole_id INTEGER NOT NULL, telephone TEXT NOT NULL, date_promise TEXT NOT NULL,
    note TEXT, cree_le TEXT);
CREATE INDEX IF NOT EXISTS idx_eleves_ecole ON eleves (ecole_id);
CREATE INDEX IF NOT EXISTS idx_paiements_ecole ON paiements (ecole_id);
CREATE INDEX IF NOT EXISTS idx_paiements_eleve ON paiements (eleve_id);
CREATE INDEX IF NOT EXISTS idx_classes_ecole ON classes (ecole_id);
CREATE INDEX IF NOT EXISTS idx_echeances_classe ON echeances (classe_id);
CREATE INDEX IF NOT EXISTS idx_rappels_ecole ON rappels (ecole_id);
"""


def database_url():
    return (os.environ.get("DATABASE_URL") or "").strip()


class _Conn:
    """Enveloppe commune SQLite / PostgreSQL : execute(sql avec ?), insert(), commit()."""

    def __init__(self, raw, pg):
        self.raw, self.pg = raw, pg

    def _sql(self, sql):
        return sql.replace("?", "%s") if self.pg else sql

    def execute(self, sql, params=()):
        if self.pg:
            import psycopg2.extras
            cur = self.raw.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            cur = self.raw.cursor()
        cur.execute(self._sql(sql), tuple(params))
        return cur

    def insert(self, sql, params=()):
        """INSERT et renvoie l'id cree."""
        if self.pg:
            return self.execute(sql + " RETURNING id", params).fetchone()["id"]
        return self.execute(sql, params).lastrowid

    def commit(self):
        self.raw.commit()

    def rollback(self):
        self.raw.rollback()

    def close(self):
        self.raw.close()


def connect():
    url = database_url()
    if url:
        import psycopg2
        if "sslmode=" not in url:
            url += ("&" if "?" in url else "?") + "sslmode=require"
        return _Conn(psycopg2.connect(url, connect_timeout=10), True)
    path = os.environ.get("SCOLARIS_DB_PATH", "scolaris.db")
    raw = sqlite3.connect(path)
    raw.row_factory = sqlite3.Row
    raw.execute("PRAGMA foreign_keys = ON")
    return _Conn(raw, False)


def init_schema(conn):
    pk = "SERIAL PRIMARY KEY" if conn.pg else "INTEGER PRIMARY KEY AUTOINCREMENT"
    for stmt in _SCHEMA.replace("{PK}", pk).split(";"):
        if stmt.strip():
            conn.execute(stmt)
    _migrer(conn)
    conn.commit()


def _migrer(conn):
    """Colonnes ajoutees apres la V1 (bases deja creees)."""
    nouvelles = [("email", "TEXT"), ("tel_verifie", "INTEGER DEFAULT 1"), ("sms_code", "TEXT"),
                 ("sms_expire", "TEXT"), ("sms_essais", "INTEGER DEFAULT 0"), ("sms_envoye", "TEXT")]
    if conn.pg:
        for nom, typ in nouvelles:
            conn.execute("ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS %s %s" % (nom, typ))
    else:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(utilisateurs)").fetchall()]
        for nom, typ in nouvelles:
            if nom not in cols:
                conn.execute("ALTER TABLE utilisateurs ADD COLUMN %s %s" % (nom, typ))
