import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { message } from './api';
import { nb } from './lib';

export const Ctx = createContext<any>(null);
export const useApp = () => useContext(Ctx);

export const naviguer = (to: string) => { history.pushState(null, '', to); dispatchEvent(new PopStateEvent('popstate')); scrollTo(0, 0); };
export function Lien({ to, children, className, ...p }: any) {
  return <a href={to} className={className} onClick={(e) => { if (e.ctrlKey || e.metaKey) return; e.preventDefault(); naviguer(to); }} {...p}>{children}</a>;
}

export function useQ<T = any>(f: () => Promise<T>, deps: any[]) {
  const [data, set] = useState<T | null>(null);
  const [erreur, setE] = useState('');
  const [charge, setC] = useState(true);
  const n = useRef(0);
  const reload = useCallback(async () => {
    const id = ++n.current; setC(true);
    try { const d = await f(); if (id === n.current) { set(d); setE(''); } }
    catch (e) { if (id === n.current) setE(message(e)); }
    finally { if (id === n.current) setC(false); }
  }, deps); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return { data, erreur, charge, reload };
}

export const Logo = ({ petit }: { petit?: boolean }) => (
  <div className={petit ? 'logo petit' : 'logo'}>
    <img src="/img/accueil/icone-net.webp" alt="" />
    <img className="mot" src="/img/accueil/mot.webp" alt="Scolaris" />
  </div>
);

export const Chargement = () => <div className="vide"><div className="spin" aria-label="Chargement" /></div>;
export const Erreur = ({ t }: { t: string }) => (t ? <div className="alerte err" role="alert">{t}</div> : null);
export const Vide = ({ t, children }: any) => <div className="vide"><p>{t}</p>{children}</div>;

export function Etat({ q, children }: { q: any; children: (d: any) => any }) {
  if (q.erreur && !q.data) return <Erreur t={q.erreur} />;
  if (!q.data) return <Chargement />;
  return children(q.data);
}

export function Modale({ titre, fermer, children }: any) {
  return (
    <div className="fond" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div className="modale" role="dialog" aria-modal="true" aria-label={titre}>
        <div className="mod-t"><h2>{titre}</h2><button className="ico" onClick={fermer} aria-label="Fermer"><FaXmark /></button></div>
        {children}
      </div>
    </div>
  );
}

export const Champ = ({ label, children, aide }: any) => <label className="champ"><span>{label}</span>{children}{aide && <small>{aide}</small>}</label>;

export function Montant({ value, onChange, placeholder }: any) {
  return <div className="montant"><input inputMode="numeric" value={value ? nb(value) : ''} placeholder={placeholder || '0'} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)} /><b>GNF</b></div>;
}

// Formulaire avec envoi, erreur et bouton occupé
export function useEnvoi() {
  const [occupe, setO] = useState(false);
  const [erreur, setE] = useState('');
  const envoyer = async (f: () => Promise<any>) => {
    if (occupe) return; setO(true); setE('');
    try { await f(); } catch (e) { setE(message(e)); } finally { setO(false); }
  };
  return { occupe, erreur, envoyer, setE };
}

export function Titre({ t, children, retour }: any) {
  return <div className="titre">{retour && <Lien to={retour} className="ico" aria-label="Retour">←</Lien>}<h1>{t}</h1><div className="esp" />{children}</div>;
}
