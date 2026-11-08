import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FaBars, FaBell, FaBuilding, FaCalendarDays, FaChartColumn, FaChevronDown, FaFileImport, FaFileInvoiceDollar, FaGear, FaHouse, FaRotate, FaUsers, FaUsersRectangle, FaWallet, FaMoneyBill1Wave, FaArrowRightFromBracket } from 'react-icons/fa6';
import { auth, db, getSession, surSession } from './api';
import { Chargement, Ctx, Erreur, Lien, Logo, naviguer, useQ } from './ui';
import { Accueil, Conditions, Connexion, FamillePublic, Inscription, NouveauMdp, Oublie, PremierEtablissement, RecuPublic } from './public';
import { DetailEleve, Classes, Eleves, Frais } from './gestion';
import { Depenses, NouveauPaiement, Paiements, Rapports, Tableau } from './finance';
import { Importation, Parametres, Relances } from './outils';

const MENU: [string, string, any, string[]?][] = [
  ['/tableau', 'Tableau de bord', FaHouse],
  ['/eleves', 'Élèves', FaUsers],
  ['/classes', 'Classes', FaUsersRectangle],
  ['/frais', 'Frais scolaires', FaFileInvoiceDollar, ['directeur', 'comptable', 'caissier', 'secretaire']],
  ['/paiements', 'Paiements', FaMoneyBill1Wave, ['directeur', 'comptable', 'caissier', 'secretaire']],
  ['/depenses', 'Dépenses', FaWallet, ['directeur', 'comptable', 'caissier']],
  ['/rapports', 'Rapports', FaChartColumn, ['directeur', 'comptable']],
  ['/relances', 'Relances', FaRotate, ['directeur', 'comptable', 'caissier', 'secretaire']],
  ['/importation', 'Importation', FaFileImport, ['directeur', 'secretaire']],
  ['/parametres', 'Paramètres', FaGear],
];

function Coque({ m, annees, recharger }: any) {
  const [ouvert, setO] = useState(false);
  const [chemin, setC] = useState(location.pathname);
  const [anneeId, setA] = useState<string>(() => { try { return localStorage.getItem('scolaris_annee') || ''; } catch { return ''; } });
  useEffect(() => { const f = () => { setC(location.pathname); setO(false); }; addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  const annee = annees.find((a: any) => a.id === anneeId) || annees.find((a: any) => a.statut === 'active') || annees[0];
  const role = m.role;
  const can = (...r: string[]) => r.includes(role);
  const etab = m.etablissements; const eid = m.etablissement_id;
  const s = getSession();
  const notif = useQ(async () => {
    if (!can('directeur', 'comptable', 'caissier', 'secretaire') || !annee) return 0;
    const [p, v] = await Promise.all([db.get(`paiements?etablissement_id=eq.${eid}&statut=eq.en_attente&select=id`), db.get(`v_situation_eleves?annee_scolaire_id=eq.${annee.id}&en_retard=is.true&select=inscription_id`)]);
    return p.length + v.length;
  }, [annee?.id, chemin]);
  const ctx = { eid, etab, role, can, annee, annees, setAnnee: (id: string) => { setA(id); try { localStorage.setItem('scolaris_annee', id); } catch { /* ignoré */ } }, recharger, majNotif: notif.reload };
  const seg = chemin.split('/').filter(Boolean);
  let page: any = <Tableau />;
  if (!annee) page = <Parametres />;
  else if (seg[0] === 'eleves' && seg[1]) page = <DetailEleve id={seg[1]} key={seg[1]} />;
  else if (seg[0] === 'eleves') page = <Eleves />;
  else if (seg[0] === 'classes') page = <Classes />;
  else if (seg[0] === 'frais') page = <Frais />;
  else if (seg[0] === 'paiements' && seg[1] === 'nouveau') page = <NouveauPaiement />;
  else if (seg[0] === 'paiements') page = <Paiements />;
  else if (seg[0] === 'depenses') page = <Depenses />;
  else if (seg[0] === 'rapports') page = <Rapports />;
  else if (seg[0] === 'relances') page = <Relances />;
  else if (seg[0] === 'importation') page = <Importation />;
  else if (seg[0] === 'parametres') page = <Parametres />;
  const initiale = (s?.user?.user_metadata?.prenom || etab.nom || 'S')[0].toUpperCase();
  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        {ouvert && <div className="voile" onClick={() => setO(false)} />}
        <aside className={ouvert ? 'menu ouvert' : 'menu'}>
          <Lien to="/tableau" className="marque"><Logo petit /></Lien>
          <nav>{MENU.filter((x) => !x[3] || x[3].includes(role)).map(([to, t, I]) => <Lien key={to} to={to} className={chemin.startsWith(to) ? 'actif' : ''}><I /><span>{t}</span></Lien>)}</nav>
          <button className="sortie" onClick={auth.deconnexion}><FaArrowRightFromBracket /><span>Se déconnecter</span></button>
        </aside>
        <div className="corps">
          <header className="haut">
            <button className="ico burger" onClick={() => setO(true)} aria-label="Ouvrir le menu"><FaBars /></button>
            <div className="ecole"><FaBuilding /><b>{etab.nom}</b></div>
            <div className="esp" />
            {annees.length > 0 && <label className="sel-annee"><FaCalendarDays /><select value={annee?.id} onChange={(e) => ctx.setAnnee(e.target.value)} aria-label="Année scolaire">{annees.map((a: any) => <option key={a.id} value={a.id}>{a.libelle}</option>)}</select><FaChevronDown /></label>}
            <Lien to="/relances" className="ico cloche" aria-label="Notifications"><FaBell />{(notif.data as number) > 0 && <i>{(notif.data as number) > 99 ? '99+' : notif.data}</i>}</Lien>
            <Lien to="/parametres" className="avatar" aria-label="Paramètres">{initiale}</Lien>
          </header>
          <main className="page">{page}</main>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function Espace() {
  const uid = getSession()?.user?.id;
  const q = useQ(async () => {
    let l = await db.get(`membres?profil_id=eq.${uid}&actif=is.true&select=role,etablissement_id,etablissements(*)&order=cree_le`);
    if (!l.length) {
      const nom = getSession()?.user?.user_metadata?.etablissement;
      if (nom) { await db.rpc('creer_etablissement', { p_nom: nom }); l = await db.get(`membres?profil_id=eq.${uid}&actif=is.true&select=role,etablissement_id,etablissements(*)`); }
    }
    if (!l.length) return { m: null, annees: [] };
    const annees = await db.get(`annees_scolaires?etablissement_id=eq.${l[0].etablissement_id}&order=date_debut.desc`);
    return { m: l[0], annees };
  }, [uid]);
  if (q.erreur && !q.data) return <main className="pub"><section className="carte-pub"><Logo /><Erreur t={q.erreur} /><button className="btn plein" onClick={q.reload}>Réessayer</button><button className="btn lien" onClick={auth.deconnexion}>Se déconnecter</button></section></main>;
  if (!q.data) return <main className="pub"><Chargement /></main>;
  const d: any = q.data;
  if (!d.m) return <PremierEtablissement fini={q.reload} />;
  return <Coque m={d.m} annees={d.annees} recharger={q.reload} />;
}

const PUB = ['/', '/connexion', '/inscription', '/mot-de-passe-oublie'];
function Racine() {
  const [, maj] = useState(0);
  const [recup, setR] = useState(false);
  const [pret, setP] = useState(false);
  useEffect(() => {
    const f = () => maj((n) => n + 1);
    const a = surSession(f); addEventListener('popstate', f);
    auth.retour().then((t) => { if (t === 'recovery') setR(true); }).catch(() => {}).finally(() => setP(true));
    return () => { a(); removeEventListener('popstate', f); };
  }, []);
  if (!pret) return <main className="pub"><Chargement /></main>;
  const c = location.pathname; const seg = c.split('/').filter(Boolean);
  if (seg[0] === 'r' && seg[1]) return <RecuPublic jeton={seg[1]} />;
  if (seg[0] === 'f' && seg[1]) return <FamillePublic jeton={seg[1]} />;
  if (c === '/conditions') return <Conditions />;
  const connecte = !!getSession()?.access_token;
  if (recup && connecte) return <NouveauMdp fini={() => { setR(false); naviguer('/tableau'); }} />;
  if (connecte) { if (PUB.includes(c)) { history.replaceState(null, '', '/tableau'); } return <Espace />; }
  if (c === '/connexion') return <Connexion />;
  if (c === '/inscription') return <Inscription />;
  if (c === '/mot-de-passe-oublie') return <Oublie />;
  if (c !== '/') history.replaceState(null, '', '/');
  return <Accueil />;
}

createRoot(document.getElementById('root')!).render(<Racine />);
