import { useMemo, useRef, useState } from 'react';
import { FaBell, FaCloudArrowUp, FaMoneyBillWave, FaUserPlus, FaWhatsapp, FaCalendarCheck } from 'react-icons/fa6';
import { auth, db, getSession, message } from './api';
import { auj, dateFr, gnf, heure, lireTableau, nb, tel, telechargerExcel } from './lib';
import { Champ, Erreur, Etat, Lien, Montant, Titre, Vide, useApp, useEnvoi, useQ } from './ui';

export function Relances() {
  const { annee, eid, etab, majNotif } = useApp(); const e = useEnvoi();
  const q = useQ(async () => {
    const [ret, att, ins] = await Promise.all([db.get(`v_situation_eleves?annee_scolaire_id=eq.${annee.id}&en_retard=is.true&order=impaye_echu.desc`), db.get(`v_paiements_detail?annee_scolaire_id=eq.${annee.id}&statut=eq.en_attente&order=date_paiement.desc&limit=10`), db.get(`inscriptions?annee_scolaire_id=eq.${annee.id}&select=id,cree_le,classes(nom),eleves(prenom,nom)&order=cree_le.desc&limit=5`)]);
    const ids = ret.map((r: any) => r.eleve_id).join(',');
    const [lien, rap] = ids ? await Promise.all([db.get(`eleve_responsables?eleve_id=in.(${ids})&select=eleve_id,principal,responsables(id,nom,telephone,jeton_public)&order=principal.desc`), db.get(`rappels?eleve_id=in.(${ids})&select=eleve_id,cree_le&order=cree_le.desc`)]) : [[], []];
    return { ret, att, ins, lien, rap };
  }, [annee.id]);
  const relancer = (r: any, resp: any) => {
    const msg = `Bonjour ${resp.nom}, ${etab.nom} vous rappelle que ${r.prenom} ${r.nom} (${r.classe}) a un retard de paiement de ${gnf(r.impaye_echu)}. Détail : ${location.origin}/f/${resp.jeton_public}`;
    window.open(`https://wa.me/224${resp.telephone}?text=${encodeURIComponent(msg)}`, '_blank');
    e.envoyer(async () => {
      await db.ins('rappels', { etablissement_id: eid, eleve_id: r.eleve_id, responsable_id: resp.id, telephone: resp.telephone, montant: r.impaye_echu, canal: 'whatsapp', message: msg, statut: 'envoye', envoye_par: getSession()?.user?.id, envoye_le: new Date().toISOString() });
      await q.reload(); majNotif();
    });
  };
  const promesse = (r: any, resp: any) => {
    const d = prompt('Date promise par le parent (AAAA-MM-JJ)', auj()); if (!d) return;
    e.envoyer(async () => { await db.ins('promesses', { etablissement_id: eid, eleve_id: r.eleve_id, responsable_id: resp?.id || null, date_promise: d }); });
  };
  return (
    <>
      <Titre t="Notifications et relances" />
      <Erreur t={e.erreur} />
      <Etat q={q}>{(d) => {
        const vide = !d.ret.length && !d.att.length && !d.ins.length;
        return <section className="carte">
          {vide && <Vide t="Aucune notification." />}
          <ul className="notifs">
            {d.ret.map((r: any) => {
              const resp = d.lien.find((l: any) => l.eleve_id === r.eleve_id)?.responsables; const dern = d.rap.find((x: any) => x.eleve_id === r.eleve_id);
              const fait = dern && String(dern.cree_le).slice(0, 10) === auj();
              return <li key={r.inscription_id}><i className="rouge"><FaBell /></i><div><b>Rappel : {r.prenom} {r.nom} en retard</b><small>{r.classe} · {gnf(r.impaye_echu)}{dern ? ` · Relancé le ${dateFr(dern.cree_le)}` : ''}</small></div>
                <span className="d-fin">{resp ? <button className="btn contour mini" disabled={fait} onClick={() => relancer(r, resp)}><FaWhatsapp /> {fait ? 'Relancé' : 'Relancer'}</button> : <small>Pas de téléphone</small>}<button className="ico" title="Promesse de paiement" aria-label="Promesse de paiement" onClick={() => promesse(r, resp)}><FaCalendarCheck /></button></span></li>;
            })}
            {d.att.map((p: any) => <li key={p.id}><i className="vert"><FaMoneyBillWave /></i><div><b>Nouveau paiement reçu</b><small>{gnf(p.montant)} · {p.prenom} {p.nom} · à vérifier</small></div><span className="d-fin"><Lien to="/paiements" className="btn lien">Vérifier</Lien></span></li>)}
            {d.ins.map((x: any) => <li key={x.id}><i className="orange"><FaUserPlus /></i><div><b>Nouvelle inscription</b><small>{x.eleves.prenom} {x.eleves.nom} · Classe {x.classes.nom}</small></div><span className="d-fin"><small>{dateFr(x.cree_le)}</small></span></li>)}
          </ul>
        </section>;
      }}</Etat>
    </>
  );
}

const COLS: [string, string, RegExp][] = [['matricule', 'Matricule', /matri/i], ['prenom', 'Prénom', /pr[ée]nom/i], ['nom', 'Nom', /^nom|nom.*[ée]l[èe]ve|^[ée]l[èe]ve/i], ['classe', 'Classe', /classe/i], ['parent_nom', 'Parent', /parent|tuteur|responsable/i], ['parent_telephone', 'Téléphone', /t[ée]l|phone|contact/i]];
const norm = (s: any) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function Importation() {
  const { annee, eid } = useApp();
  const [tab, setTab] = useState<string[][] | null>(null); const [nomF, setNF] = useState(''); const [map, setMap] = useState<Record<string, number>>({}); const [rap, setRap] = useState<any>(null); const [av, setAv] = useState(0); const [sur, setSur] = useState(false);
  const e = useEnvoi(); const inp = useRef<HTMLInputElement>(null);
  const ex = useQ(async () => db.get(`eleves?etablissement_id=eq.${eid}&select=matricule,prenom,nom`), [eid, rap]);
  const ouvrir = (f?: File | null) => { if (!f) return; setRap(null); e.envoyer(async () => {
    const t = await lireTableau(f); if (t.length < 2) throw new Error('Le fichier ne contient aucune ligne');
    const m: Record<string, number> = {}; COLS.forEach(([k, , r]) => { const i = t[0].findIndex((h, n) => r.test(h) && !Object.values(m).includes(n)); if (i >= 0) m[k] = i; });
    setTab(t); setNF(f.name); setMap(m);
  }); };
  const lignes = useMemo(() => {
    if (!tab) return [];
    const mats = new Set((ex.data || []).map((x: any) => norm(x.matricule))); const noms = new Set((ex.data || []).map((x: any) => `${norm(x.nom)}|${norm(x.prenom)}`));
    const vus = new Set<string>();
    return tab.slice(1).map((l, i) => {
      const v: any = { n: i + 2 }; COLS.forEach(([k]) => { v[k] = map[k] !== undefined ? String(l[map[k]] ?? '').trim() : ''; });
      const cle = `${norm(v.nom)}|${norm(v.prenom)}`;
      v.etat = !v.nom || !v.prenom ? 'Nom ou prénom manquant' : !v.classe ? 'Classe manquante' : (v.matricule && mats.has(norm(v.matricule))) || noms.has(cle) ? 'Déjà inscrit' : vus.has(cle) ? 'Doublon dans le fichier' : '';
      vus.add(cle); return v;
    });
  }, [tab, map, ex.data]);
  const bonnes = lignes.filter((l) => !l.etat);
  const lancer = () => e.envoyer(async () => {
    const existantes = await db.get(`classes?annee_scolaire_id=eq.${annee.id}&select=id,nom`); const cl: Record<string, string> = Object.fromEntries(existantes.map((c: any) => [norm(c.nom), c.id]));
    let ok = 0; const err: string[] = []; setAv(0);
    for (const l of bonnes) {
      try {
        if (!cl[norm(l.classe)]) { const [c] = await db.ins('classes', { etablissement_id: eid, annee_scolaire_id: annee.id, nom: l.classe }); cl[norm(l.classe)] = c.id; }
        await db.rpc('enregistrer_eleve', { p: { etablissement_id: eid, annee_scolaire_id: annee.id, classe_id: cl[norm(l.classe)], matricule: l.matricule, prenom: l.prenom, nom: l.nom, parent_nom: l.parent_nom, parent_telephone: tel(l.parent_telephone) } });
        ok++;
      } catch (x) { err.push(`Ligne ${l.n} : ${message(x)}`); }
      setAv(ok + err.length);
    }
    const ecartees = lignes.length - bonnes.length;
    await db.ins('imports', { etablissement_id: eid, type: 'eleves', fichier: nomF, statut: err.length ? 'echec' : 'termine', total: lignes.length, importees: ok, doublons: lignes.filter((l) => /Déjà|Doublon/.test(l.etat)).length, erreurs: err.length, rapport: { erreurs: err } });
    setRap({ ok, ecartees, err }); setTab(null);
  });
  const modele = () => telechargerExcel('modele-import-eleves', [['Matricule', 'Prénom', 'Nom', 'Classe', 'Parent', 'Téléphone'], ['SC-0001', 'Alpha', 'Diallo', '6e A', 'Mamadou Diallo', '620123456']]);
  return (
    <>
      <Titre t="Importation Excel" />
      <section className="carte">
        <Erreur t={e.erreur} />
        {rap && <div className="alerte ok"><b>Import terminé :</b> {rap.ok} élève(s) importé(s), {rap.ecartees} ligne(s) écartée(s), {rap.err.length} erreur(s).{rap.err.slice(0, 5).map((x: string) => <div key={x}>{x}</div>)}</div>}
        {!tab ? <>
          <div className={sur ? 'depot sur' : 'depot'} onDragOver={(x) => { x.preventDefault(); setSur(true); }} onDragLeave={() => setSur(false)} onDrop={(x) => { x.preventDefault(); setSur(false); ouvrir(x.dataTransfer.files[0]); }}>
            <FaCloudArrowUp /><h2>Glissez votre fichier ici</h2><p>ou</p>
            <button className="btn plein mini" onClick={() => inp.current?.click()} disabled={e.occupe}>Choisir un fichier</button>
            <input ref={inp} type="file" hidden accept=".xlsx,.csv" onChange={(x) => { ouvrir(x.target.files?.[0]); x.target.value = ''; }} />
            <small>Formats acceptés : .xlsx, .csv</small>
          </div>
          <button className="btn lien centre" onClick={modele}>Télécharger un modèle</button>
        </> : <>
          <h2>Correspondance des colonnes</h2>
          <div className="corresp">{COLS.map(([k, t]) => <Champ key={k} label={t}><select value={map[k] ?? ''} onChange={(x) => { const m = { ...map }; if (x.target.value === '') delete m[k]; else m[k] = Number(x.target.value); setMap(m); }}><option value="">Ignorer</option>{tab[0].map((h, i) => <option key={i} value={i}>{h}</option>)}</select></Champ>)}</div>
          <h2>Prévisualisation</h2>
          <p className="note">{bonnes.length} ligne(s) prête(s), {lignes.length - bonnes.length} écartée(s) sur {lignes.length}.</p>
          <div className="table court"><table><thead><tr><th>Ligne</th><th>Nom</th><th>Prénom</th><th>Classe</th><th>Téléphone</th><th>Contrôle</th></tr></thead><tbody>{lignes.slice(0, 100).map((l) => <tr key={l.n}><td>{l.n}</td><td>{l.nom}</td><td>{l.prenom}</td><td>{l.classe}</td><td>{l.parent_telephone}</td><td>{l.etat ? <span className="st rouge">{l.etat}</span> : <span className="st vert">OK</span>}</td></tr>)}</tbody></table></div>
          <div className="ligne-btn"><button className="btn contour mini" onClick={() => setTab(null)} disabled={e.occupe}>Annuler</button><button className="btn plein mini" onClick={lancer} disabled={e.occupe || !bonnes.length}>{e.occupe ? `Import… ${av}/${bonnes.length}` : `Importer ${bonnes.length} élève(s)`}</button></div>
        </>}
      </section>
    </>
  );
}

export function Parametres() {
  const { annee, annees, eid, etab, can, recharger, role } = useApp();
  const ROLES: any = { directeur: 'Directeur', comptable: 'Comptable', caissier: 'Caissier', secretaire: 'Secrétaire', enseignant: 'Enseignant' };
  const [f, setF] = useState({ nom: etab.nom || '', ville: etab.ville || '', telephone: etab.telephone || '', orange_money_numero: etab.orange_money_numero || '', mtn_money_numero: etab.mtn_money_numero || '' });
  const [obj, setO] = useState<number | null>(null); const [na, setNa] = useState({ libelle: '', date_debut: '', date_fin: '' }); const [ok, setOk] = useState(''); const e = useEnvoi();
  const q = useQ(async () => (annee && can('directeur', 'comptable') ? db.get(`objectifs_financiers?annee_scolaire_id=eq.${annee.id}&periode=eq.annuel&classe_id=is.null`) : []), [annee?.id]);
  const courant = q.data?.[0]; const valeur = obj ?? courant?.montant ?? 0; const d = can('directeur');
  const fait = (t: string) => { setOk(t); setTimeout(() => setOk(''), 3000); };
  return (
    <>
      <Titre t="Paramètres" />
      <Erreur t={e.erreur} />{ok && <div className="alerte ok">{ok}</div>}
      {annee && can('directeur', 'comptable') && <section className="carte"><h2>Objectif financier {annee.libelle}</h2>
        <form className="ligne-f" onSubmit={(x) => { x.preventDefault(); if (!valeur) return e.setE('Indiquez un montant'); e.envoyer(async () => { if (courant) await db.upd(`objectifs_financiers?id=eq.${courant.id}`, { montant: valeur }); else await db.ins('objectifs_financiers', { etablissement_id: eid, annee_scolaire_id: annee.id, periode: 'annuel', montant: valeur }); await q.reload(); fait('Objectif enregistré'); }); }}>
          <Montant value={valeur} onChange={setO} /><button className="btn plein mini" disabled={!d || e.occupe}>Enregistrer</button></form></section>}
      <section className="carte"><h2>Établissement</h2><form onSubmit={(x) => { x.preventDefault(); e.envoyer(async () => { await db.upd(`etablissements?id=eq.${eid}`, f); await recharger(); fait('Établissement enregistré'); }); }}><fieldset disabled={!d}>
        <div className="deux"><Champ label="Nom"><input value={f.nom} onChange={(x) => setF({ ...f, nom: x.target.value })} required /></Champ><Champ label="Ville"><input value={f.ville} onChange={(x) => setF({ ...f, ville: x.target.value })} /></Champ></div>
        <div className="deux"><Champ label="Téléphone"><input value={f.telephone} onChange={(x) => setF({ ...f, telephone: x.target.value })} /></Champ><Champ label="Numéro Orange Money"><input value={f.orange_money_numero} onChange={(x) => setF({ ...f, orange_money_numero: x.target.value })} /></Champ></div>
        {d && <button className="btn plein mini">Enregistrer</button>}</fieldset></form></section>
      <section className="carte"><h2>Années scolaires</h2><ul className="liste">{annees.map((a: any) => <li key={a.id}><div><b>{a.libelle}</b><small>{dateFr(a.date_debut)} → {dateFr(a.date_fin)}</small></div><span className="d-fin">{a.statut === 'active' ? <span className="st vert">Active</span> : a.statut === 'preparation' ? (d ? <button className="btn lien" onClick={() => e.envoyer(async () => { await db.rpc('activer_annee', { p_annee: a.id }); await recharger(); })}>Activer</button> : <span className="st gris">En préparation</span>) : <span className="st gris">Clôturée</span>}</span></li>)}</ul>
        {d && <form className="ligne-f trois" onSubmit={(x) => { x.preventDefault(); e.envoyer(async () => { await db.ins('annees_scolaires', { ...na, etablissement_id: eid }); setNa({ libelle: '', date_debut: '', date_fin: '' }); await recharger(); }); }}><input placeholder="2027-2028" aria-label="Libellé" value={na.libelle} onChange={(x) => setNa({ ...na, libelle: x.target.value })} required /><input type="date" aria-label="Début" value={na.date_debut} onChange={(x) => setNa({ ...na, date_debut: x.target.value })} required /><input type="date" aria-label="Fin" value={na.date_fin} onChange={(x) => setNa({ ...na, date_fin: x.target.value })} required /><button className="btn contour mini">Ajouter</button></form>}</section>
      <section className="carte"><h2>Mon compte</h2><p className="note">{getSession()?.user?.email} · {ROLES[role]}</p><button className="btn contour mini rouge" onClick={auth.deconnexion}>Se déconnecter</button></section>
    </>
  );
}
