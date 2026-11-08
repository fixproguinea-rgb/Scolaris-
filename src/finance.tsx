import { useMemo, useState } from 'react';
import { FaBuildingColumns, FaCircleCheck, FaCircleExclamation, FaCircleXmark, FaFileExcel, FaFilePdf, FaMagnifyingGlass, FaMoneyBillWave, FaMoneyBillTrendUp, FaMoneyBill1Wave, FaPlus, FaSackDollar, FaUser, FaUsers, FaWallet, FaMobileScreen, FaThumbsUp, FaUserGroup, FaHandHoldingDollar, FaCheck, FaBan } from 'react-icons/fa6';
import { db } from './api';
import { Anneau, Barres, Courbe } from './charts';
import { auj, dateFr, entier, gnf, heure, moisAnnee, nb, parMois, telechargerExcel } from './lib';
import { EtatPaiement } from './gestion';
import { Champ, Erreur, Etat, Lien, Modale, Montant, Titre, Vide, naviguer, useApp, useEnvoi, useQ } from './ui';

const STAFF = ['directeur', 'comptable', 'caissier', 'secretaire'];

export function Tableau() {
  const { annee, eid, can, etab } = useApp();
  const fin = can('directeur', 'comptable', 'caissier', 'secretaire');
  const [per, setPer] = useState(12);
  const q = useQ(async () => {
    const [tb, obj, pay, recents] = await Promise.all([
      db.get(`v_tableau_bord?annee_scolaire_id=eq.${annee.id}`),
      can('directeur', 'comptable') ? db.get(`v_objectifs_resultats?annee_scolaire_id=eq.${annee.id}&periode=eq.annuel&classe_id=is.null`) : [],
      fin ? db.get(`v_paiements_detail?annee_scolaire_id=eq.${annee.id}&statut=eq.valide&select=montant,date_paiement`) : [],
      fin ? db.get(`v_paiements_detail?etablissement_id=eq.${eid}&annee_scolaire_id=eq.${annee.id}&select=id,montant,date_paiement,statut,prenom,nom&order=date_paiement.desc&limit=3`) : [],
    ]);
    return { t: tb[0] || {}, obj: obj[0], pay, recents };
  }, [annee.id]);
  return (
    <Etat q={q}>{(d) => {
      const t = d.t; const o = d.obj; const encaisse = t.encaisse_valide || 0;
      const pct = o ? Math.min(100, Math.round((encaisse / o.objectif) * 100)) : 0;
      const courbe = parMois(annee, d.pay, 'date_paiement', true).slice(-per);
      const tot = t.eleves || 0; const part = (n: number) => (tot ? Math.round((n / tot) * 100) : 0);
      // Estimation de fin d'année selon le rythme observé
      const debut = +new Date(annee.date_debut), finA = +new Date(annee.date_fin), now = Math.min(Date.now(), finA);
      const estim = now > debut ? Math.round((encaisse / (now - debut)) * (finA - debut)) : 0;
      const retard = t.en_retard || 0;
      return <>
        <Titre t="Tableau de bord" />
        <p className="sous">{etab.nom} · {t.classes || 0} classes · {t.enseignants || 0} enseignants</p>
        <div className="stats">
          <div className="stat bleu"><FaUsers /><span>Élèves inscrits</span><b>{nb(tot)}</b></div>
          <div className="stat vert"><FaSackDollar /><span>Total des frais</span><b>{nb(t.facture_net)}</b><small>GNF</small></div>
          <div className="stat vert"><FaCircleCheck /><span>Déjà encaissé</span><b>{nb(encaisse)}</b><small>GNF</small></div>
          <div className="stat rouge"><FaCircleExclamation /><span>Reste à encaisser</span><b className="rg">{nb(t.reste)}</b><small>GNF</small></div>
        </div>
        {can('directeur', 'comptable') && <section className="carte objectif">
          {o ? <><div className="obj-g"><h2>Objectif annuel : {gnf(o.objectif)}</h2><div className="barre-p grande"><i style={{ width: `${pct}%` }} /></div><p>{pct >= 100 ? 'Objectif atteint' : 'Objectif en cours'} <FaThumbsUp /> · reste {gnf(Math.max(o.objectif - encaisse, 0))}{estim > 0 && ` · estimation fin d'année ${gnf(estim)}`}</p></div><strong>{pct} %</strong></>
            : <><div className="obj-g"><h2>Objectif annuel</h2><p>Définissez l'objectif financier de l'année pour suivre votre progression.</p></div>{can('directeur') && <Lien to="/parametres" className="btn contour mini">Définir</Lien>}</>}
        </section>}
        {fin && <div className="grille-2">
          <section className="carte"><div className="tete-carte"><h2>Évolution des recettes</h2><select value={per} onChange={(e) => setPer(Number(e.target.value))} aria-label="Période"><option value={12}>12 mois</option><option value={6}>6 mois</option><option value={3}>3 mois</option></select></div>{courbe.length ? <Courbe data={courbe} /> : <Vide t="L'année scolaire n'a pas encore commencé." />}</section>
          <section className="carte"><h2>État des paiements</h2><ul className="etats">
            <li><FaCircleCheck className="vert" />Entièrement payé<b className="vert">{nb(t.a_jour)}</b><small>({part(t.a_jour)} %)</small></li>
            <li><FaCircleExclamation className="orange" />Paiement partiel<b className="orange">{nb(t.partiels)}</b><small>({part(t.partiels)} %)</small></li>
            <li><FaCircleXmark className="rouge" />Sans paiement<b className="rouge">{nb(t.rien_paye)}</b><small>({part(t.rien_paye)} %)</small></li>
            <li><FaCircleExclamation className="rouge" />En retard<b>{nb(retard)}</b><small>({part(retard)} %)</small></li>
            <li><FaHandHoldingDollar className="bleu" />Avec avance<b>{nb(t.avec_avance)}</b><small>({part(t.avec_avance)} %)</small></li>
          </ul></section>
        </div>}
        {fin && <div className="mini-stats">
          <div><span>Impayés échus</span><b>{gnf(t.impaye_echu)}</b></div><div><span>Avances</span><b>{gnf(t.avances)}</b></div>
          <div><span>Dépenses</span><b>{gnf(t.depenses_payees)}</b></div><div><span>Trésorerie</span><b>{gnf(t.tresorerie)}</b></div>
        </div>}
        {fin && <div className="grille-2">
          <section className="carte"><div className="tete-carte"><h2>Activités récentes</h2><Lien to="/paiements" className="voir">Voir tout →</Lien></div>
            {d.recents.length === 0 ? <p className="note">Aucun paiement pour le moment.</p> : <ul className="activites">{d.recents.map((p: any) => <li key={p.id}><i><FaMoneyBillWave /></i><div><b>Paiement reçu : {gnf(p.montant)}</b><small>{p.prenom} {p.nom} · {dateFr(p.date_paiement)}</small></div></li>)}</ul>}</section>
          {tot === 0 ? <section className="carte bilan bleu"><FaUserGroup /><div><b>Bienvenue !</b><p>Créez vos classes puis vos élèves pour commencer.</p></div></section>
            : retard > 0 ? <section className="carte bilan orange"><FaCircleExclamation /><div><b>{retard} élève{retard > 1 ? 's' : ''} en retard</b><p>{gnf(t.impaye_echu)} d'impayés échus. <Lien to="/relances">Relancer</Lien></p></div></section>
              : <section className="carte bilan vert"><FaCircleCheck /><div><b>Tout se passe bien !</b><p>Aucun impayé échu.</p></div></section>}
        </div>}
      </>;
    }}</Etat>
  );
}

const ICO: any = { especes: FaMoneyBillWave, virement: FaBuildingColumns, depot: FaBuildingColumns, orange_money: FaMobileScreen, mtn_money: FaMobileScreen, autre: FaWallet };

export function NouveauPaiement() {
  const { annee, eid, can } = useApp();
  const pre = new URLSearchParams(location.search).get('eleve') || '';
  const [el, setEl] = useState(pre); const [txt, setT] = useState(''); const [m, setM] = useState(0); const [moy, setMoy] = useState(''); const [ref, setR] = useState(''); const [date, setD] = useState(auj()); const [fic, setF] = useState<File | null>(null); const e = useEnvoi();
  const q = useQ(async () => {
    const [l, mo] = await Promise.all([db.get(`v_situation_eleves?annee_scolaire_id=eq.${annee.id}&order=nom,prenom`), db.get(`moyens_paiement?etablissement_id=eq.${eid}&actif=is.true`)]);
    return { l, mo };
  }, [annee.id]);
  const valider = can('directeur', 'comptable');
  return (
    <>
      <Titre t="Enregistrer un paiement" retour="/paiements" />
      <Etat q={q}>{(d) => {
        const moyens = [...d.mo].sort((a: any, b: any) => ['especes', 'virement', 'depot', 'orange_money', 'mtn_money', 'autre'].indexOf(a.type) - ['especes', 'virement', 'depot', 'orange_money', 'mtn_money', 'autre'].indexOf(b.type));
        const choix = moy || moyens[0]?.id; const s = d.l.find((x: any) => x.eleve_id === el); const t = txt.trim().toLowerCase();
        return <section className="carte form-p"><form onSubmit={(x) => { x.preventDefault(); if (!el) return e.setE('Choisissez un élève'); if (!m) return e.setE('Indiquez le montant'); e.envoyer(async () => {
          const justificatif_chemin = fic ? await db.fichier(eid, fic) : null;
          const [p] = await db.ins('paiements', { etablissement_id: eid, eleve_id: el, annee_scolaire_id: annee.id, montant: m, date_paiement: date, moyen_id: choix, reference: ref.trim() || null, justificatif_chemin });
          if (valider) { await db.upd(`paiements?id=eq.${p.id}`, { statut: 'valide' }); naviguer(`/r/${p.jeton_public}`); } else naviguer('/paiements');
        }); }}>
          {s ? <div className="eleve-choisi"><FaUser /><b>Élève : {s.nom} {s.prenom} ({s.matricule})</b><button type="button" className="btn lien" onClick={() => setEl('')}>Changer</button></div> :
            <div className="choix-eleve"><div className="recherche"><FaMagnifyingGlass /><input value={txt} onChange={(v) => setT(v.target.value)} placeholder="Rechercher l'élève…" autoFocus /></div>
              {t && <ul>{d.l.filter((y: any) => `${y.matricule} ${y.nom} ${y.prenom}`.toLowerCase().includes(t)).slice(0, 6).map((y: any) => <li key={y.eleve_id}><button type="button" onClick={() => { setEl(y.eleve_id); setT(''); }}>{y.nom} {y.prenom} · {y.classe}</button></li>)}</ul>}</div>}
          {s && s.reste > 0 && <p className="note">Reste à payer : <b>{gnf(s.reste)}</b></p>}
          <Champ label="Montant *"><Montant value={m} onChange={setM} /></Champ>
          <div className="champ"><span>Moyen de paiement</span><div className="moyens">{moyens.map((y: any) => { const I = ICO[y.type] || FaWallet; return <button type="button" key={y.id} className={`${choix === y.id ? 'on ' : ''}${y.type}`} onClick={() => setMoy(y.id)}><I /><span>{y.libelle}</span></button>; })}</div></div>
          <Champ label="Référence (optionnel)"><input value={ref} onChange={(v) => setR(v.target.value)} placeholder="Entrez la référence…" /></Champ>
          <div className="deux"><Champ label="Date"><input type="date" value={date} max={auj()} onChange={(v) => setD(v.target.value)} required /></Champ><Champ label="Justificatif"><input type="file" accept="image/*,application/pdf" onChange={(v) => setF(v.target.files?.[0] || null)} /></Champ></div>
          {!valider && <p className="note">Ce paiement restera en attente jusqu'à sa validation par le directeur ou le comptable.</p>}
          <Erreur t={e.erreur} />
          <button className="btn plein" disabled={e.occupe}><FaCheck /> {valider ? 'Valider le paiement' : 'Enregistrer le paiement'}</button>
        </form></section>;
      }}</Etat>
    </>
  );
}

export function Paiements() {
  const { annee, can, majNotif } = useApp(); const [f, setF] = useState('en_attente'); const e = useEnvoi();
  const q = useQ(async () => {
    const [l, jet] = await Promise.all([db.get(`v_paiements_detail?annee_scolaire_id=eq.${annee.id}&order=date_paiement.desc,numero_recu.desc`), db.get(`paiements?annee_scolaire_id=eq.${annee.id}&select=id,jeton_public`)]);
    const j = Object.fromEntries(jet.map((x: any) => [x.id, x.jeton_public])); return { l, j };
  }, [annee.id]);
  const act = (id: string, b: any) => e.envoyer(async () => { await db.upd(`paiements?id=eq.${id}`, b); await q.reload(); majNotif(); });
  const v = can('directeur', 'comptable');
  return (
    <>
      <Titre t="Paiements"><Lien to="/paiements/nouveau" className="btn plein mini"><FaPlus /> Enregistrer</Lien></Titre>
      <Erreur t={e.erreur} />
      <Etat q={q}>{(d) => {
        const l = d.l.filter((p: any) => f === 'tous' || p.statut === f);
        return <section className="carte">
          <div className="onglets">{[['en_attente', `En attente (${d.l.filter((p: any) => p.statut === 'en_attente').length})`], ['valide', 'Validés'], ['tous', 'Tous']].map(([k, t]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{t}</button>)}</div>
          {l.length === 0 ? <Vide t="Aucun paiement ici." /> : <div className="table"><table><thead><tr><th>Date</th><th>Élève</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{l.map((p: any) => <tr key={p.id}>
            <td>{dateFr(p.date_paiement)}</td><td><Lien to={`/eleves/${p.eleve_id}`}>{p.nom} {p.prenom}</Lien><small className="bloc">{p.classe}</small></td><td><b>{nb(p.montant)}</b></td><td>{p.moyen}{p.reference && <small className="bloc">{p.reference}</small>}</td><td><EtatPaiement s={p.statut} /></td>
            <td className="acts">
              {p.statut === 'en_attente' && v && <><button className="ico vert" aria-label="Valider" title="Valider" onClick={() => act(p.id, { statut: 'valide' })}><FaCheck /></button><button className="ico rouge" aria-label="Rejeter" title="Rejeter" onClick={() => { const m = prompt('Motif du rejet'); if (m) act(p.id, { statut: 'rejete', motif_rejet: m }); }}><FaBan /></button></>}
              {p.numero_recu && <Lien className="btn lien" to={`/r/${d.j[p.id]}`}>Reçu</Lien>}
              {p.statut === 'valide' && v && <button className="ico rouge" aria-label="Annuler" title="Annuler" onClick={() => { const m = prompt('Motif de l\'annulation'); if (m) act(p.id, { statut: 'annule', annule_motif: m }); }}><FaCircleXmark /></button>}
            </td></tr>)}</tbody></table></div>}
        </section>;
      }}</Etat>
    </>
  );
}

export function Depenses() {
  const { annee, eid, can } = useApp(); const [aj, setAj] = useState(false); const [mv, setMv] = useState(false); const e = useEnvoi();
  const q = useQ(async () => {
    const [l, cat, cai, tb] = await Promise.all([db.get(`depenses?annee_scolaire_id=eq.${annee.id}&select=*,categories_depense(libelle)&order=date_depense.desc,cree_le.desc`), db.get(`categories_depense?etablissement_id=eq.${eid}&order=libelle`), db.get(`v_tresorerie_caisses?etablissement_id=eq.${eid}&order=nom`), db.get(`v_tableau_bord?annee_scolaire_id=eq.${annee.id}&select=depenses_payees`)]);
    return { l, cat, cai, tot: tb[0]?.depenses_payees || 0 };
  }, [annee.id]);
  const maj = (id: string, b: any) => e.envoyer(async () => { await db.upd(`depenses?id=eq.${id}`, b); await q.reload(); });
  return (
    <>
      <Titre t="Dépenses et caisse">{can('directeur', 'comptable') && <button className="btn contour mini" onClick={() => setMv(true)}>Mouvement</button>}<button className="btn plein mini" onClick={() => setAj(true)}><FaPlus /> Ajouter</button></Titre>
      <Erreur t={e.erreur} />
      <Etat q={q}>{(d) => {
        const solde = d.cai.reduce((s: number, c: any) => s + c.solde, 0);
        return <>
          <div className="stats deux-s"><div className="stat bleu"><FaMoneyBillTrendUp /><span>Dépenses totales</span><b>{nb(d.tot)}</b><small>GNF</small></div><div className="stat vert"><FaWallet /><span>Solde de caisse</span><b>{nb(solde)}</b><small>GNF</small></div></div>
          <section className="carte"><h2>Caisses</h2><div className="caisses">{d.cai.map((c: any) => <div key={c.caisse_id}><span>{c.nom}</span><b>{gnf(c.solde)}</b></div>)}</div></section>
          <section className="carte"><h2>Dernières dépenses</h2>{d.l.length === 0 ? <Vide t="Aucune dépense enregistrée." /> : <ul className="liste">{d.l.map((x: any) => <li key={x.id}><div><b>{x.libelle}</b><small>{x.categories_depense?.libelle}{x.beneficiaire ? ` · ${x.beneficiaire}` : ''} · {dateFr(x.date_depense)}</small></div>
            <span className="d-fin"><b>{gnf(x.montant)}</b>
              {x.statut === 'soumise' && (can('directeur') ? <><button className="btn lien" onClick={() => maj(x.id, { statut: 'autorisee' })}>Autoriser</button><button className="btn lien rouge" onClick={() => { const m = prompt('Motif du rejet'); if (m) maj(x.id, { statut: 'rejetee', motif_statut: m }); }}>Rejeter</button></> : <span className="st orange">À autoriser</span>)}
              {x.statut === 'autorisee' && (can('directeur', 'comptable', 'caissier') ? <select aria-label="Payer depuis la caisse" value="" onChange={(ev) => ev.target.value && maj(x.id, { statut: 'payee', caisse_id: ev.target.value })}><option value="">Payer depuis…</option>{d.cai.map((c: any) => <option key={c.caisse_id} value={c.caisse_id}>{c.nom}</option>)}</select> : <span className="st bleu">Autorisée</span>)}
              {x.statut === 'payee' && <span className="st vert">Payée</span>}{x.statut === 'rejetee' && <span className="st rouge">Rejetée</span>}{x.statut === 'annulee' && <span className="st gris">Annulée</span>}
            </span></li>)}</ul>}</section>
          {aj && <FormDepense d={d} fermer={() => setAj(false)} fini={() => { setAj(false); q.reload(); }} />}
          {mv && <FormMouvement d={d} fermer={() => setMv(false)} fini={() => { setMv(false); q.reload(); }} />}
        </>;
      }}</Etat>
    </>
  );
}

function FormDepense({ d, fermer, fini }: any) {
  const { annee, eid } = useApp(); const [f, setF] = useState<any>({ libelle: '', beneficiaire: '', montant: 0, categorie_id: d.cat[0]?.id, date_depense: auj() }); const e = useEnvoi();
  return <Modale titre="Ajouter une dépense" fermer={fermer}><form onSubmit={(x) => { x.preventDefault(); if (!f.montant) return e.setE('Indiquez le montant'); e.envoyer(async () => { const cat = d.cat.find((c: any) => c.id === f.categorie_id); await db.ins('depenses', { ...f, etablissement_id: eid, annee_scolaire_id: annee.id, est_salaire: cat?.libelle === 'Salaires' }); fini(); }); }}>
    <Champ label="Libellé *"><input value={f.libelle} onChange={(x) => setF({ ...f, libelle: x.target.value })} required /></Champ>
    <div className="deux"><Champ label="Catégorie"><select value={f.categorie_id} onChange={(x) => setF({ ...f, categorie_id: x.target.value })}>{d.cat.map((c: any) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select></Champ><Champ label="Date"><input type="date" value={f.date_depense} onChange={(x) => setF({ ...f, date_depense: x.target.value })} required /></Champ></div>
    <Champ label="Montant *"><Montant value={f.montant} onChange={(v: number) => setF({ ...f, montant: v })} /></Champ>
    <Champ label="Bénéficiaire"><input value={f.beneficiaire} onChange={(x) => setF({ ...f, beneficiaire: x.target.value })} /></Champ>
    <Erreur t={e.erreur} /><button className="btn plein" disabled={e.occupe}>Enregistrer</button></form></Modale>;
}

function FormMouvement({ d, fermer, fini }: any) {
  const { eid } = useApp(); const [f, setF] = useState<any>({ caisse_id: d.cai[0]?.caisse_id, sens: 'entree', montant: 0, libelle: '', date_mouvement: auj() }); const e = useEnvoi();
  return <Modale titre="Entrée ou sortie de caisse" fermer={fermer}><form onSubmit={(x) => { x.preventDefault(); if (!f.montant) return e.setE('Indiquez le montant'); e.envoyer(async () => { await db.ins('mouvements_tresorerie', { ...f, etablissement_id: eid, origine: 'manuel' }); fini(); }); }}>
    <div className="deux"><Champ label="Caisse"><select value={f.caisse_id} onChange={(x) => setF({ ...f, caisse_id: x.target.value })}>{d.cai.map((c: any) => <option key={c.caisse_id} value={c.caisse_id}>{c.nom}</option>)}</select></Champ><Champ label="Sens"><select value={f.sens} onChange={(x) => setF({ ...f, sens: x.target.value })}><option value="entree">Entrée</option><option value="sortie">Sortie</option></select></Champ></div>
    <Champ label="Montant *"><Montant value={f.montant} onChange={(v: number) => setF({ ...f, montant: v })} /></Champ>
    <Champ label="Libellé *"><input value={f.libelle} onChange={(x) => setF({ ...f, libelle: x.target.value })} required /></Champ>
    <Erreur t={e.erreur} /><button className="btn plein" disabled={e.occupe}>Enregistrer</button></form></Modale>;
}

export function Rapports() {
  const { annee, eid, can } = useApp(); const [o, setO] = useState('recettes'); const [mois, setM] = useState('');
  const q = useQ(async () => {
    const [p, s, c, dep] = await Promise.all([db.get(`v_paiements_detail?annee_scolaire_id=eq.${annee.id}&statut=eq.valide&order=date_paiement`), db.get(`v_situation_eleves?annee_scolaire_id=eq.${annee.id}&order=nom,prenom`), db.get(`v_stats_classes?annee_scolaire_id=eq.${annee.id}&order=ordre,nom`), db.get(`depenses?annee_scolaire_id=eq.${annee.id}&statut=eq.payee&select=*,categories_depense(libelle)&order=date_depense`)]);
    return { p, s, c, dep };
  }, [annee.id]);
  const nom = `scolaris-${o}-${annee.libelle}${mois ? '-' + mois : ''}`;
  return (
    <>
      <Titre t="Rapports et statistiques" />
      <Etat q={q}>{(d) => {
        const dansMois = (x: string) => !mois || String(x).startsWith(mois);
        const p = d.p.filter((x: any) => dansMois(x.date_paiement)); const dep = d.dep.filter((x: any) => dansMois(x.date_depense));
        const moyens = Object.entries(p.reduce((a: any, x: any) => ({ ...a, [x.moyen]: (a[x.moyen] || 0) + x.montant }), {})).map(([label, valeur]: any) => ({ label, valeur }));
        const cats = Object.entries(dep.reduce((a: any, x: any) => { const k = x.categories_depense?.libelle || 'Autres'; return { ...a, [k]: (a[k] || 0) + x.montant }; }, {})).map(([label, valeur]: any) => ({ label, valeur }));
        const som = (l: any[]) => l.reduce((s, x) => s + x.montant, 0);
        const excel = () => {
          if (o === 'recettes') telechargerExcel(nom, [['Date', 'Reçu', 'Élève', 'Classe', 'Moyen', 'Montant GNF'], ...p.map((x: any) => [x.date_paiement, x.numero_recu, `${x.nom} ${x.prenom}`, x.classe || '', x.moyen, x.montant])]);
          if (o === 'eleves') telechargerExcel(nom, [['Matricule', 'Élève', 'Classe', 'Frais', 'Payé', 'Reste', 'Impayé échu', 'Avance'], ...d.s.map((x: any) => [x.matricule || '', `${x.nom} ${x.prenom}`, x.classe, x.facture_net, x.regle, x.reste, x.impaye_echu, x.avance])]);
          if (o === 'classes') telechargerExcel(nom, [['Classe', 'Effectif', 'Frais', 'Payé', 'Reste', 'Impayé échu', 'Taux %'], ...d.c.map((x: any) => [x.nom, x.effectif, x.facture_net, x.regle, x.reste, x.impaye_echu, Number(x.taux_recouvrement)])]);
          if (o === 'depenses') telechargerExcel(nom, [['Date', 'Libellé', 'Catégorie', 'Bénéficiaire', 'Montant GNF'], ...dep.map((x: any) => [x.date_depense, x.libelle, x.categories_depense?.libelle || '', x.beneficiaire || '', x.montant])]);
        };
        return <section className="carte">
          <div className="onglets noprint">{[['recettes', 'Recettes'], ['eleves', 'Élèves'], ['classes', 'Classes'], ['depenses', 'Dépenses']].map(([k, t]) => <button key={k} className={o === k ? 'on' : ''} onClick={() => setO(k)}>{t}</button>)}</div>
          <div className="filtres noprint"><select value={mois} onChange={(e) => setM(e.target.value)} aria-label="Mois"><option value="">Tous les mois</option>{moisAnnee(annee).map((m) => <option key={m.cle} value={m.cle}>{m.label} {m.cle.slice(0, 4)}</option>)}</select></div>
          {o === 'recettes' && <><div className="grille-2 sans"><div><h2>Recettes mensuelles</h2><Barres data={parMois(annee, mois ? p : d.p, 'date_paiement')} /></div><div><h2>Répartition des paiements</h2>{moyens.length ? <Anneau data={moyens} /> : <Vide t="Aucune recette." />}</div></div>
            <p className="total">Total validé : <b>{gnf(som(p))}</b></p></>}
          {o === 'eleves' && <div className="table"><table><thead><tr><th>Élève</th><th>Classe</th><th>Frais</th><th>Payé</th><th>Reste</th><th>Avance</th></tr></thead><tbody>{d.s.map((x: any) => <tr key={x.inscription_id}><td>{x.nom} {x.prenom}</td><td>{x.classe}</td><td>{nb(x.facture_net)}</td><td>{nb(x.regle)}</td><td className={x.en_retard ? 'rouge' : ''}>{nb(x.reste)}</td><td>{nb(x.avance)}</td></tr>)}</tbody></table></div>}
          {o === 'classes' && <div className="table"><table><thead><tr><th>Classe</th><th>Effectif</th><th>Frais</th><th>Payé</th><th>Reste</th><th>Taux</th></tr></thead><tbody>{d.c.map((x: any) => <tr key={x.classe_id}><td>{x.nom}</td><td>{x.effectif}</td><td>{nb(x.facture_net)}</td><td>{nb(x.regle)}</td><td>{nb(x.reste)}</td><td>{Math.round(x.taux_recouvrement)} %</td></tr>)}</tbody></table></div>}
          {o === 'depenses' && <><div className="grille-2 sans"><div><h2>Dépenses mensuelles</h2><Barres data={parMois(annee, mois ? dep : d.dep, 'date_depense')} /></div><div><h2>Par catégorie</h2>{cats.length ? <Anneau data={cats} /> : <Vide t="Aucune dépense." />}</div></div><p className="total">Total payé : <b>{gnf(som(dep))}</b></p></>}
          <div className="ligne-btn noprint"><button className="btn contour mini" onClick={() => print()}><FaFilePdf /> Exporter en PDF</button><button className="btn contour mini" onClick={excel}><FaFileExcel /> Exporter en Excel</button></div>
        </section>;
      }}</Etat>
    </>
  );
}
