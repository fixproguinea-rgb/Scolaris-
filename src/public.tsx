import { useState } from 'react';
import { FaBell, FaBuilding, FaChartColumn, FaCirclePlus, FaEnvelope, FaEye, FaEyeSlash, FaLock, FaPhone, FaPrint, FaUser, FaUsers, FaWhatsapp, FaArrowLeft } from 'react-icons/fa6';
import { FcGoogle } from 'react-icons/fc';
import { auth, db } from './api';
import { dateFr, gnf, tel } from './lib';
import { Chargement, Erreur, Lien, Logo, naviguer, useEnvoi, useQ } from './ui';

export function Accueil() {
  return (
    <main className="pub"><section className="carte-pub accueil">
      <Logo />
      <p className="slogan">La scolarité, sans impayés</p>
      <h1>Bienvenue sur Scolaris</h1>
      <p className="intro">Gérez facilement les paiements<br />et le suivi de votre établissement.</p>
      <Lien to="/connexion" className="btn plein"><FaUser /> Se connecter</Lien>
      <Lien to="/inscription" className="btn contour"><FaCirclePlus /> Créer un compte</Lien>
      <div className="atouts">
        <div><FaChartColumn /><span>Suivi des paiements</span></div>
        <div><FaBell /><span>Rappels automatiques</span></div>
        <div><FaUsers /><span>Gestion des élèves</span></div>
      </div>
      <img className="vague" src="/img/accueil/pied.webp" alt="" />
    </section></main>
  );
}

function Icone({ i, children }: any) { return <div className="saisie">{i}{children}</div>; }
function Mdp({ value, onChange, placeholder, auto }: any) {
  const [v, s] = useState(false);
  return <Icone i={<FaLock />}><input type={v ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={auto} required minLength={6} /><button type="button" className="oeil" onClick={() => s(!v)} aria-label={v ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{v ? <FaEyeSlash /> : <FaEye />}</button></Icone>;
}
const Entete = ({ t, st }: any) => <><Lien to="/" className="retour" aria-label="Retour"><FaArrowLeft /></Lien><Logo /><h1>{t}</h1><p className="intro">{st}</p></>;

export function Connexion() {
  const [id, setId] = useState(''); const [m, setM] = useState(''); const e = useEnvoi();
  return (
    <main className="pub"><section className="carte-pub">
      <Entete t="Connexion" st="Accédez à votre espace" />
      <form onSubmit={(x) => { x.preventDefault(); e.envoyer(async () => { await auth.connexion(id, m); naviguer('/tableau'); }); }}>
        <Icone i={<FaEnvelope />}><input value={id} onChange={(x) => setId(x.target.value)} placeholder="E-mail ou téléphone" autoComplete="username" required /></Icone>
        <Mdp value={m} onChange={setM} placeholder="Mot de passe" auto="current-password" />
        <Lien to="/mot-de-passe-oublie" className="oublie">Mot de passe oublié ?</Lien>
        <Erreur t={e.erreur} />
        <button className="btn plein" disabled={e.occupe}><FaUser /> {e.occupe ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <div className="ou"><span>ou</span></div>
      <button className="btn contour" onClick={() => e.envoyer(auth.google)}><FcGoogle /> Se connecter avec Google</button>
      <p className="bas">Pas encore de compte ?<br /><Lien to="/inscription">Créer un compte</Lien></p>
    </section></main>
  );
}

export function Inscription() {
  const [f, setF] = useState({ ecole: '', resp: '', tel: '', email: '', m: '', m2: '', ok: false });
  const [fin, setFin] = useState(false); const e = useEnvoi();
  const c = (k: string) => ({ value: (f as any)[k], onChange: (x: any) => setF({ ...f, [k]: x.target.value }), required: true });
  if (fin) return <main className="pub"><section className="carte-pub"><Logo /><h1>Vérifiez vos e-mails</h1><p className="intro">Un lien de confirmation vient d'être envoyé à {f.email}. Cliquez dessus pour activer votre compte.</p><Lien to="/connexion" className="btn plein">Retour à la connexion</Lien></section></main>;
  return (
    <main className="pub"><section className="carte-pub">
      <Entete t="Créer un compte" st="Inscrivez votre établissement" />
      <form onSubmit={(x) => {
        x.preventDefault();
        if (f.m !== f.m2) return e.setE('Les deux mots de passe sont différents');
        const t = tel(f.tel); if (t.length < 8) return e.setE('Numéro de téléphone invalide');
        const [prenom, ...reste] = f.resp.trim().split(/\s+/);
        e.envoyer(async () => {
          const ok = await auth.inscription(f.email, f.m, { prenom, nom: reste.join(' '), telephone: t, etablissement: f.ecole.trim() });
          if (ok) naviguer('/tableau'); else setFin(true);
        });
      }}>
        <Icone i={<FaBuilding />}><input {...c('ecole')} placeholder="Nom de l'établissement" /></Icone>
        <Icone i={<FaUser />}><input {...c('resp')} placeholder="Nom du responsable" autoComplete="name" /></Icone>
        <Icone i={<FaPhone />}><input {...c('tel')} placeholder="Téléphone" inputMode="tel" autoComplete="tel" /></Icone>
        <Icone i={<FaEnvelope />}><input {...c('email')} type="email" placeholder="Adresse e-mail" autoComplete="email" /></Icone>
        <Mdp value={f.m} onChange={(v: string) => setF({ ...f, m: v })} placeholder="Mot de passe" auto="new-password" />
        <Mdp value={f.m2} onChange={(v: string) => setF({ ...f, m2: v })} placeholder="Confirmer le mot de passe" auto="new-password" />
        <label className="coche"><input type="checkbox" checked={f.ok} onChange={(x) => setF({ ...f, ok: x.target.checked })} required /> <span>J'accepte les <Lien to="/conditions">conditions d'utilisation</Lien></span></label>
        <Erreur t={e.erreur} />
        <button className="btn plein" disabled={e.occupe}>{e.occupe ? 'Création…' : 'Créer mon compte'}</button>
      </form>
    </section></main>
  );
}

export function Oublie() {
  const [id, setId] = useState(''); const [fin, setFin] = useState(false); const e = useEnvoi();
  return (
    <main className="pub"><section className="carte-pub">
      <Entete t="Mot de passe oublié" st="Recevez un lien de réinitialisation" />
      {fin ? <><div className="alerte ok">Si ce compte existe, un lien a été envoyé à son adresse e-mail.</div><Lien to="/connexion" className="btn plein">Retour à la connexion</Lien></> :
        <form onSubmit={(x) => { x.preventDefault(); e.envoyer(async () => { await auth.recuperation(id); setFin(true); }); }}>
          <Icone i={<FaEnvelope />}><input value={id} onChange={(x) => setId(x.target.value)} placeholder="E-mail ou téléphone" required /></Icone>
          <Erreur t={e.erreur} />
          <button className="btn plein" disabled={e.occupe}>Envoyer le lien</button>
        </form>}
    </section></main>
  );
}

export function NouveauMdp({ fini }: any) {
  const [m, setM] = useState(''); const e = useEnvoi();
  return (
    <main className="pub"><section className="carte-pub"><Logo /><h1>Nouveau mot de passe</h1>
      <form onSubmit={(x) => { x.preventDefault(); e.envoyer(async () => { await auth.nouveauMotDePasse(m); fini(); }); }}>
        <Mdp value={m} onChange={setM} placeholder="Nouveau mot de passe" auto="new-password" />
        <Erreur t={e.erreur} /><button className="btn plein" disabled={e.occupe}>Enregistrer</button>
      </form>
    </section></main>
  );
}

export function PremierEtablissement({ fini }: any) {
  const [n, setN] = useState(''); const e = useEnvoi();
  return (
    <main className="pub"><section className="carte-pub"><Logo /><h1>Votre établissement</h1><p className="intro">Indiquez le nom de votre école pour commencer.</p>
      <form onSubmit={(x) => { x.preventDefault(); e.envoyer(async () => { await db.rpc('creer_etablissement', { p_nom: n.trim() }); fini(); }); }}>
        <Icone i={<FaBuilding />}><input value={n} onChange={(x) => setN(x.target.value)} placeholder="Nom de l'établissement" required /></Icone>
        <Erreur t={e.erreur} /><button className="btn plein" disabled={e.occupe}>Continuer</button>
      </form>
      <button className="btn lien" onClick={auth.deconnexion}>Se déconnecter</button>
    </section></main>
  );
}

export function Conditions() {
  return <main className="pub"><section className="carte-pub texte"><Lien to="/inscription" className="retour" aria-label="Retour"><FaArrowLeft /></Lien><Logo /><h1>Conditions d'utilisation</h1>
    <p>Scolaris aide les établissements scolaires à suivre leurs élèves, leurs frais, leurs paiements et leurs dépenses.</p>
    <p>L'établissement reste responsable de l'exactitude des informations saisies et de l'accès accordé à son équipe. Chaque utilisateur protège son mot de passe.</p>
    <p>Les données d'un établissement ne sont jamais accessibles aux autres établissements.</p></section></main>;
}

export function RecuPublic({ jeton }: { jeton: string }) {
  const q = useQ(() => db.rpc('recu_public', { p_jeton: jeton }), [jeton]);
  if (q.charge && !q.data) return <main className="pub"><Chargement /></main>;
  const r: any = q.data;
  if (!r) return <main className="pub"><section className="carte-pub"><Logo /><h1>Reçu introuvable</h1></section></main>;
  const lien = location.href;
  return (
    <main className="pub"><section className="carte-pub recu">
      <Logo petit /><h1>Reçu n° {r.numero}</h1>
      {r.statut === 'annule' && <div className="alerte err">Ce reçu a été annulé.</div>}
      <p className="intro">{r.ecole}{r.ville ? ` · ${r.ville}` : ''}</p>
      <div className="grand">{gnf(r.montant)}</div>
      <dl>
        <dt>Élève</dt><dd>{r.prenom} {r.nom}</dd><dt>Matricule</dt><dd>{r.matricule}</dd><dt>Classe</dt><dd>{r.classe}</dd>
        <dt>Année</dt><dd>{r.annee}</dd><dt>Date</dt><dd>{dateFr(r.date)}</dd><dt>Moyen</dt><dd>{r.moyen}</dd>
        {r.reference && <><dt>Référence</dt><dd>{r.reference}</dd></>}
      </dl>
      <div className="noprint actions-recu">
        <button className="btn plein" onClick={() => print()}><FaPrint /> Imprimer</button>
        <a className="btn contour" href={`https://wa.me/?text=${encodeURIComponent(`Reçu Scolaris n° ${r.numero} : ${lien}`)}`} target="_blank" rel="noreferrer"><FaWhatsapp /> Partager</a>
        <button className="btn lien" onClick={() => history.back()}>Retour</button>
      </div>
    </section></main>
  );
}

export function FamillePublic({ jeton }: { jeton: string }) {
  const q = useQ(() => db.rpc('famille_public', { p_jeton: jeton }), [jeton]);
  if (q.charge && !q.data) return <main className="pub"><Chargement /></main>;
  const r: any = q.data;
  if (!r) return <main className="pub"><section className="carte-pub"><Logo /><h1>Lien introuvable</h1></section></main>;
  return (
    <main className="pub"><section className="carte-pub recu"><Logo petit /><h1>{r.ecole}</h1><p className="intro">Situation de la famille de {r.parent}</p>
      {r.enfants.map((e: any, i: number) => <div className="enfant" key={i}><b>{e.prenom} {e.nom}</b><span>{e.classe}</span>
        <dl><dt>Frais dus</dt><dd>{gnf(e.net)}</dd><dt>Payé</dt><dd>{gnf(e.regle)}</dd><dt>Reste</dt><dd>{gnf(e.reste)}</dd>{e.echu > 0 && <><dt>En retard</dt><dd className="rouge">{gnf(e.echu)}</dd></>}</dl></div>)}
    </section></main>
  );
}
