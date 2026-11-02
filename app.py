"""Scolaris : suivi des frais de scolarite et relance des parents en retard."""
import os

from flask import Flask, jsonify, render_template

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or os.urandom(32)


@app.route("/")
def accueil():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify(status="ok", app="scolaris")


if __name__ == "__main__":
    app.run(debug=True)
