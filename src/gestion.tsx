import { useMemo, useState } from 'react';
import { FaCheck, FaCircleExclamation, FaCircleXmark, FaEllipsisVertical, FaEye, FaMagnifyingGlass, FaPhone, FaPlus, FaRegUser, FaTrash, FaUser, FaWhatsapp, FaFileInvoiceDollar, FaMoneyBill1Wave, FaCircleCheck } from 'react-icons/fa6';
import { db } from './api';
import { dateFr, gnf, nb, tel } from './lib';
import { Champ, Erreur, Etat, Lien, Modale, Montant, Titre, Vide, naviguer, useApp, useEnvoi, useQ } from './ui';

export function Statut({ s }: { s: any }) {
  if (s.situation === 'a_jour') return <span className="st vert"><FaCheck /> À jour</span>;
  if (s.situation === 'rien_paye' && s.facture_net > 0) return <span className="st rouge"><FaCircleXmark /> Non payé</span>;
  if (s.en_retard) return <span className="st orange"><FaCircleExclamation /> Retard</span>;
  if (s.situation === 'partiel') return <span className="st bleu">Partiel</span>;
  return <span className="st gris">Sans frais</span>;
}

function FormEleve({ init, classes, fermer, fini }: any) {
  const { eid, annee } = useApp();
  const [f, setF] = useState<any>(init || { prenom: '', nom: '', matricule: '', classe_id: classes[0]?.id || '', parent_nom: '', parent_telephone: '', date_naissance: '', sexe: '' });
  const e = useEnvoi();
  const c = (k: string, req = false) => ({ value: f[k] ?? '', onChange: (x: any) => setF({ ...f, [k]: x.target.value }), required: req });
  return (
    <Modale titre={init ? 'Modifier l\'élève' : 'Ajouter un élève'} fermer={fermer}>
      <form onSubmit={(x) => { x.preventDefault(); e.envoyer(async () => { await db.rpc('enregistrer_eleve', { p: { ...f, parent_telephone: tel(f.parent_telephone), etablissement_id: eid, annee_scolaire_id: annee.id } }); fini(); }); }}>
        <div className="deux"><Champ label="Prénom *"><input {...c('prenom', true)} /></Champ><Champ label="Nom *"><input {...c('nom', true)} /></Champ></div>
        <Champ label="Classe *"><select {...c('classe_id', true)}><option value="">Choisir…</option>{classes.map((k: any) => <option key={k.id} value={k.id}>{k.nom}</option>)}</select></Champ>
        <div className="deux"><Champ label="Matricule" aide="Automatique si vide"><input {...c('matricule')} /></Champ><Champ label="Date de naissance"><input type="date" {...c('date_naissance')} /></Champ></div>
        <div className="deux"><Champ label="Nom du parent"><input {...c('parent_nom')} /></Champ><Champ label="Téléphone du parent"><input inputMode="tel" {...c('parent_telephone')} /></Champ></div>
        <Erreur t={e.erreur} />
        <button className="btn plein" disabled={e.occupe}>{e.occupe ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </Modale>
  );
}

export function Eleves() {
  const { annee, can } = useApp();
  const [txt, setT] = useState(''); const [cl, setCl] = useState(''); const [p, setP] = useState(1); const [aj, setAj] = useState(false);
  const q = useQ(async () => {
    const [l, classes] = await Promise.all([db.get(`v_situation_eleves?annee_scolaire_id=eq.${annee.id}&order=nom,prenom`), db.get(`classes?annee_scolaire_id=eq.${annee.id}&order=ordre,nom`)]);
    return { l, classes };
  }, [annee.id]);
  const filtres = useMemo(() => {
    const t = txt.trim().toLowerCase();
    return (q.data?.l || []).filter((s: any) => (!cl || s.classe_id === cl) && (!t || `${s.matricule} ${s.nom} ${s.prenom}`.toLowerCase().includes(t)));
  }, [q.data, txt, cl]);
  const PAR = 10; const pages = Math.max(1, Math.ceil(filtres.length / PAR)); const page = Math.min(p, pages);
  return (
    <>
      <Titre t="Gestion des élèves">{can('directeur', 'secretaire') && <button className="btn plein mini" onClick={() => setAj(true)}><FaPlus /> Ajouter un élève</button>}</Titre>
      <Etat q={q}>{(d) => <section className="carte">
        <div className="filtres">
          <div className="recherche"><FaMagnifyingGlass /><input value={txt} onChange={(e) => { setT(e.target.value); setP(1); }} placeholder="Rechercher un élève…" /></div>
          <select value={cl} onChange={(e) => { setCl(e.target.value); setP(1); }} aria-label="Classe"><option value="">Toutes les classes</option>{d.classes.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>
        </div>
        {filtres.length === 0 ? <Vide t={d.l.length ? 'Aucun élève ne correspond.' : d.classes.length ? 'Aucun élève inscrit pour le moment.' : 'Créez d\'abord une classe.'}>{!d.classes.length && <Lien to="/classes" className="btn contour mini">Créer une classe</Lien>}</Vide> :
          <div className="table t-eleves"><table><thead><tr><th>Matricule</th><th>Nom &amp; Prénom</th><th>Classe</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{filtres.slice((page - 1) * PAR, page * PAR).map((s: any) => <tr key={s.inscription_id}>
              <td>{s.matricule}</td><td><Lien to={`/eleves/${s.eleve_id}`}>{s.nom} {s.prenom}</Lien></td><td>{s.classe}</td><td><Statut s={s} /></td>
              <td className="acts"><Lien className="ico" to={`/eleves/${s.eleve_id}`} aria-label="Voir"><FaEye /></Lien><Lien className="ico" to={`/eleves/${s.eleve_id}?onglet=infos`} aria-label="Plus"><FaEllipsisVertical /></Lien></td>
            </tr>)}</tbody></table></div>}
        {pages > 1 && <div className="pagin"><button onClick={() => setP(page - 1)} disabled={page === 1} aria-label="Précédent">‹</button>{Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map((n) => <button key={n} className={n === page ? 'on' : ''} onClick={() => setP(n)}>{n}</button>)}<button onClick={() => setP(page + 1)} disabled={page === pages} aria-label="Suivant">›</button></div>}
      </section>}</Etat>
      {aj && q.data && <FormEleve classes={q.data.classes} fermer={() => setAj(false)} fini={() => { setAj(false); q.reload(); }} />}
    </>
  );
}

export function DetailEleve({ id }: { id: string }) {
  const { annee, can, eid } = useApp();
  const [onglet, setO] = useState(new URLSearchParams(location.search).get('onglet') === 'infos' ? 'infos' : 'hist');
  const [mod, setMod] = useState(false); const [red, setRed] = useState(false);
  const q = useQ(async () => {
    const [el, sit, pay, ech, res, classes] = await Promise.all([
      db.get(`eleves?id=eq.${id}`), db.get(`v_situation_eleves?eleve_id=eq.${id}&annee_scolaire_id=eq.${annee.id}`),
      can('directeur', 'comptable', 'caissier', 'secretaire') ? db.get(`v_paiements_detail?eleve_id=eq.${id}&order=date_paiement.desc`) : [],
      can('directeur', 'comptable', 'caissier', 'secretaire') ? db.get(`v_echeances_soldes?eleve_id=eq.${id}&annee_scolaire_id=eq.${annee.id}&order=date_limite`) : [],
      can('directeur', 'comptable', 'caissier', 'secretaire') ? db.get(`eleve_responsables?eleve_id=eq.${id}&select=principal,lien,responsables(*)&order=principal.desc`) : [],
      db.get(`classes?annee_scolaire_id=eq.${annee.id}&order=ordre,nom`),
    ]);
    return { el: el[0], sit: sit[0], pay, ech, res, classes };
  }, [id, annee.id]);
  return (
    <>
      <Titre t="Détail d'un élève" retour="/eleves">{can('directeur', 'comptable', 'caissier', 'secretaire') && <Lien to={`/paiements/nouveau?eleve=${id}`} className="btn plein mini"><FaMoneyBill1Wave /> Enregistrer un paiement</Lien>}</Titre>
      <Etat q={q}>{(d) => {
        if (!d.el) return <Vide t="Élève introuvable." />;
        const s = d.sit || { facture_net: 0, regle: 0, reste: 0, avance: 0, situation: 'sans_frais' };
        const r = d.res[0]?.responsables; const pct = s.facture_net ? Math.round((s.regle / s.facture_net) * 100) : 0;
        return <section className="carte detail">
          <div className="fiche">
            <div className="photo"><div className="avatar-eleve"><FaRegUser /></div><b>{d.el.matricule}</b><Statut s={s} /></div>
            <div className="infos">
              <h2>{d.el.nom} {d.el.prenom}</h2><p className="classe">{s.classe || 'Sans classe'}</p>
              {r && <p><FaPhone /> Téléphone : {r.telephone} <a className="wa" href={`https://wa.me/224${r.telephone}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><FaWhatsapp /></a></p>}
              {r && <p><FaUser /> Parent : {r.nom}</p>}
              <h3>Situation financière</h3>
              <p className="ln"><FaFileInvoiceDollar className="bleu" />Frais dus :<b>{gnf(s.facture_net)}</b></p>
              <p className="ln"><FaCircleCheck className="vert" />Payé :<b className="vert">{gnf(s.regle)}</b></p>
              <p className="ln"><FaCircleXmark className="rouge" />Reste :<b>{gnf(s.reste)}</b></p>
              {s.avance > 0 && <p className="ln"><FaCircleCheck className="vert" />Avance :<b>{gnf(s.avance)}</b></p>}
              <div className="prog"><div className="barre-p"><i style={{ width: `${pct}%` }} /></div><b>{pct} %</b></div>
            </div>
          </div>
          <div className="onglets">{[['hist', 'Historique'], ['infos', 'Informations'], ['autres', 'Autres']].map(([k, t]) => <button key={k} className={onglet === k ? 'on' : ''} onClick={() => setO(k)}>{t}</button>)}</div>
          {onglet === 'hist' && (d.pay.length === 0 ? <Vide t="Aucun paiement enregistré." /> : <ul className="liste">{d.pay.map((p: any) => <li key={p.id}><div><b>{gnf(p.montant)}</b><small>{dateFr(p.date_paiement)} · {p.moyen}{p.numero_recu ? ` · Reçu n° ${p.numero_recu}` : ''}</small></div><EtatPaiement s={p.statut} /></li>)}</ul>)}
          {onglet === 'infos' && <div>
            <dl className="dl"><dt>Matricule</dt><dd>{d.el.matricule}</dd><dt>Naissance</dt><dd>{dateFr(d.el.date_naissance) || '—'}</dd>{d.res.map((x: any, i: number) => <span key={i} className="contents"><dt>Parent{x.principal ? ' principal' : ''}</dt><dd>{x.responsables.nom} · {x.responsables.telephone}</dd></span>)}</dl>
            {can('directeur', 'secretaire') && <div className="ligne-btn"><button className="btn contour mini" onClick={() => setMod(true)}>Modifier</button><button className="btn contour mini rouge" onClick={async () => { if (confirm('Archiver cet élève ?')) { await db.upd(`eleves?id=eq.${id}`, { statut: 'archive', archive_le: new Date().toISOString() }); await db.upd(`inscriptions?eleve_id=eq.${id}&annee_scolaire_id=eq.${annee.id}`, { statut: 'archive' }); naviguer('/eleves'); } }}>Archiver</button></div>}
          </div>}
          {onglet === 'autres' && <div>
            {d.ech.length === 0 ? <Vide t="Aucune échéance. Définissez les frais de la classe." /> : <ul className="liste">{d.ech.map((e: any) => <li key={e.id}><div><b>{e.libelle} · {gnf(e.net)}</b><small>Limite {dateFr(e.date_limite)}{e.reductions > 0 ? ` · Réduction ${gnf(e.reductions)}` : ''}</small></div><span className={`st ${e.etat === 'soldee' ? 'vert' : e.etat === 'echue' ? 'rouge' : 'gris'}`}>{e.etat === 'soldee' ? 'Soldée' : e.etat === 'echue' ? `Reste ${nb(e.reste)}` : `À venir`}</span></li>)}</ul>}
            {d.ech.some((e: any) => e.reste > 0) && can('directeur', 'comptable', 'secretaire') && <button className="btn contour mini" onClick={() => setRed(true)}>Réduction ou exonération</button>}
          </div>}
          {mod && <FormEleve init={{ id, prenom: d.el.prenom, nom: d.el.nom, matricule: d.el.matricule, date_naissance: d.el.date_naissance, classe_id: s.classe_id || '', parent_nom: r?.nom || '', parent_telephone: r?.telephone || '' }} classes={d.classes} fermer={() => setMod(false)} fini={() => { setMod(false); q.reload(); }} />}
          {red && <FormReduction ech={d.ech.filter((e: any) => e.reste > 0)} eid={eid} fermer={() => setRed(false)} fini={() => { setRed(false); q.reload(); }} />}
        </section>;
      }}</Etat>
    </>
  );
}

export const EtatPaiement = ({ s }: any) => <span className={`st ${s === 'valide' ? 'vert' : s === 'en_attente' ? 'orange' : 'rouge'}`}>{s === 'valide' ? 'Validé' : s === 'en_attente' ? 'En attente' : s === 'rejete' ? 'Rejeté' : 'Annulé'}</span>;

function FormReduction({ ech, eid, fermer, fini }: any) {
  const { can } = useApp();
  const [f, setF] = useState<any>({ echeance_id: ech[0].id, type: 'reduction', montant: 0, motif: '' }); const e = useEnvoi();
  const max = ech.find((x: any) => x.id === f.echeance_id)?.reste || 0;
  return <Modale titre="Réduction ou exonération" fermer={fermer}><form onSubmit={(x) => { x.preventDefault(); if (!f.montant) return e.setE('Indiquez un montant'); e.envoyer(async () => { await db.ins('reductions', { ...f, etablissement_id: eid, statut: can('directeur') ? 'autorisee' : 'demandee' }); fini(); }); }}>
    <Champ label="Échéance"><select value={f.echeance_id} onChange={(x) => setF({ ...f, echeance_id: x.target.value })}>{ech.map((x: any) => <option key={x.id} value={x.id}>{x.libelle} (reste {nb(x.reste)})</option>)}</select></Champ>
    <Champ label="Type"><select value={f.type} onChange={(x) => setF({ ...f, type: x.target.value })}><option value="reduction">Réduction</option><option value="exoneration">Exonération</option></select></Champ>
    <Champ label="Montant" aide={`Maximum : ${gnf(max)}`}><Montant value={f.montant} onChange={(v: number) => setF({ ...f, montant: v })} /></Champ>
    <Champ label="Motif *"><input value={f.motif} onChange={(x) => setF({ ...f, motif: x.target.value })} required /></Champ>
    {!can('directeur') && <p className="note">La demande devra être autorisée par le directeur.</p>}
    <Erreur t={e.erreur} /><button className="btn plein" disabled={e.occupe}>Enregistrer</button></form></Modale>;
}

export function Classes() {
  const { annee, can, eid } = useApp(); const [aj, setAj] = useState(false);
  const q = useQ(async () => {
    const [st, cl, nv] = await Promise.all([db.get(`v_stats_classes?annee_scolaire_id=eq.${annee.id}&order=ordre,nom`), db.get(`classes?annee_scolaire_id=eq.${annee.id}&select=id,niveaux(nom)`), db.get(`niveaux?etablissement_id=eq.${eid}&order=ordre,nom`)]);
    const niv = Object.fromEntries(cl.map((c: any) => [c.id, c.niveaux?.nom || '']));
    return { st, niv, nv };
  }, [annee.id]);
  return (
    <>
      <Titre t="Classes et niveaux">{can('directeur', 'secretaire') && <button className="btn plein mini" onClick={() => setAj(true)}><FaPlus /> Ajouter une classe</button>}</Titre>
      <Etat q={q}>{(d) => <section className="carte">{d.st.length === 0 ? <Vide t="Aucune classe pour cette année." /> :
        <div className="table"><table><thead><tr><th>Classe</th><th>Niveau</th><th>Effectif</th><th>Taux</th></tr></thead><tbody>{d.st.map((c: any) => {
          const t = Math.round(c.taux_recouvrement);
          return <tr key={c.classe_id}><td><b>{c.nom}</b></td><td>{d.niv[c.classe_id]}</td><td>{c.effectif}</td><td><span className={`taux ${t >= 70 ? 'vert' : t >= 50 ? 'orange' : c.facture_net ? 'rouge' : 'gris'}`}>{c.facture_net ? `${t} %` : '—'}</span></td></tr>;
        })}</tbody></table></div>}</section>}</Etat>
      {aj && q.data && <FormClasse nv={q.data.nv} fermer={() => setAj(false)} fini={() => { setAj(false); q.reload(); }} />}
    </>
  );
}

function FormClasse({ nv, fermer, fini }: any) {
  const { eid, annee } = useApp(); const [nom, setN] = useState(''); const [niv, setV] = useState(''); const e = useEnvoi();
  return <Modale titre="Ajouter une classe" fermer={fermer}><form onSubmit={(x) => { x.preventDefault(); e.envoyer(async () => {
    let niveau_id = null;
    if (niv.trim()) { const r = await db.ups('niveaux', { etablissement_id: eid, nom: niv.trim() }, 'etablissement_id,nom'); niveau_id = r[0].id; }
    await db.ins('classes', { etablissement_id: eid, annee_scolaire_id: annee.id, nom: nom.trim(), niveau_id }); fini();
  }); }}>
    <Champ label="Nom de la classe *"><input value={nom} onChange={(x) => setN(x.target.value)} placeholder="6e A" required /></Champ>
    <Champ label="Niveau"><input value={niv} onChange={(x) => setV(x.target.value)} list="niv" placeholder="Collège" /><datalist id="niv">{nv.map((n: any) => <option key={n.id} value={n.nom} />)}{['Primaire', 'Collège', 'Lycée'].map((n) => <option key={n} value={n} />)}</datalist></Champ>
    <Erreur t={e.erreur} /><button className="btn plein" disabled={e.occupe}>Enregistrer</button></form></Modale>;
}

export function Frais() {
  const { annee, can, eid } = useApp(); const [form, setF] = useState<any>(null);
  const q = useQ(async () => {
    const [classes, types, tarifs] = await Promise.all([db.get(`classes?annee_scolaire_id=eq.${annee.id}&order=ordre,nom`), db.get(`types_frais?etablissement_id=eq.${eid}&actif=is.true&order=ordre`), db.get(`tarifs?annee_scolaire_id=eq.${annee.id}&select=*,tarif_tranches(*)`)]);
    return { classes, types, tarifs };
  }, [annee.id]);
  return (
    <>
      <Titre t="Frais scolaires">{can('directeur', 'comptable') && q.data?.classes.length > 0 && <button className="btn plein mini" onClick={() => setF({})}><FaPlus /> Définir un tarif</button>}</Titre>
      <Etat q={q}>{(d) => d.classes.length === 0 ? <section className="carte"><Vide t="Créez d'abord une classe."><Lien to="/classes" className="btn contour mini">Créer une classe</Lien></Vide></section> :
        d.classes.map((c: any) => {
          const t = d.tarifs.filter((x: any) => x.classe_id === c.id); const tot = t.reduce((s: number, x: any) => s + x.montant, 0);
          return <section className="carte" key={c.id}><div className="tete-carte"><h2>{c.nom}</h2><b>{gnf(tot)}</b></div>
            {t.length === 0 ? <p className="note">Aucun tarif défini.</p> : <ul className="liste">{t.map((x: any) => <li key={x.id}><div><b>{d.types.find((y: any) => y.id === x.type_frais_id)?.libelle}</b><small>{x.tarif_tranches.length ? [...x.tarif_tranches].sort((a: any, b: any) => a.ordre - b.ordre).map((y: any) => `${y.libelle} : ${nb(y.montant)} (${dateFr(y.date_limite)})`).join(' · ') : 'Paiement unique'}</small></div>
              <span className="d-fin"><b>{gnf(x.montant)}</b>{can('directeur', 'comptable') && <button className="ico" aria-label="Modifier" onClick={() => setF({ classe: c.id, x })}><FaEllipsisVertical /></button>}</span></li>)}</ul>}
          </section>;
        })}</Etat>
      {form && q.data && <FormTarif d={q.data} init={form} fermer={() => setF(null)} fini={() => { setF(null); q.reload(); }} />}
    </>
  );
}

function FormTarif({ d, init, fermer, fini }: any) {
  const x = init.x; const e = useEnvoi();
  const [classe, setC] = useState(init.classe || d.classes[0].id); const [type, setT] = useState(x?.type_frais_id || d.types[1]?.id || d.types[0].id); const [montant, setM] = useState(x?.montant || 0);
  const [tr, setTr] = useState<any[]>(x?.tarif_tranches?.length ? [...x.tarif_tranches].sort((a: any, b: any) => a.ordre - b.ordre).map((y: any) => ({ libelle: y.libelle, montant: y.montant, date_limite: y.date_limite })) : []);
  const som = tr.reduce((s, y) => s + y.montant, 0);
  const maj = (i: number, k: string, v: any) => setTr(tr.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  return <Modale titre="Définir un tarif" fermer={fermer}><form onSubmit={(z) => { z.preventDefault(); if (!montant) return e.setE('Indiquez un montant'); if (tr.length && som !== montant) return e.setE(`La somme des tranches (${gnf(som)}) doit égaler le montant`); e.envoyer(async () => { await db.rpc('enregistrer_tarif', { p_classe: classe, p_type: type, p_montant: montant, p_tranches: tr }); fini(); }); }}>
    <div className="deux"><Champ label="Classe"><select value={classe} onChange={(v) => setC(v.target.value)} disabled={!!x}>{d.classes.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></Champ>
      <Champ label="Type de frais"><select value={type} onChange={(v) => setT(v.target.value)} disabled={!!x}>{d.types.map((c: any) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select></Champ></div>
    <Champ label="Montant total *"><Montant value={montant} onChange={setM} /></Champ>
    <div className="tete-carte"><b>Tranches</b><button type="button" className="btn lien" onClick={() => setTr([...tr, { libelle: `Tranche ${tr.length + 1}`, montant: Math.max(montant - som, 0), date_limite: '' }])}><FaPlus /> Ajouter</button></div>
    {tr.map((y, i) => <div className="tranche" key={i}><input value={y.libelle} onChange={(v) => maj(i, 'libelle', v.target.value)} aria-label="Libellé" required /><Montant value={y.montant} onChange={(v: number) => maj(i, 'montant', v)} /><input type="date" value={y.date_limite} onChange={(v) => maj(i, 'date_limite', v.target.value)} aria-label="Date limite" required /><button type="button" className="ico" aria-label="Retirer" onClick={() => setTr(tr.filter((_, j) => j !== i))}><FaTrash /></button></div>)}
    {x && <p className="note">Un nouveau montant s'applique aux prochaines factures, pas à celles déjà émises.</p>}
    <Erreur t={e.erreur} /><button className="btn plein" disabled={e.occupe}>Enregistrer</button></form></Modale>;
}
