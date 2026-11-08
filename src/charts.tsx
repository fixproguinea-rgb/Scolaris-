import { useState } from 'react';
import { gnf, nb } from './lib';

const court = (n: number) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}Md` : n >= 1e6 ? `${Math.round(n / 1e6)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
function pasRond(max: number) { const m = Math.max(max, 3000000); const p = 10 ** Math.floor(Math.log10(m)); for (const f of [1.5, 3, 6, 9, 15]) if (f * p >= m) return f * p; return 15 * p; }
const W = 560, H = 230, G = 46, B = 26, T = 12;

function Axes({ max, n, labels, pas }: any) {
  const lignes = [0, 1, 2, 3].map((i) => (max / 3) * i);
  const dx = (W - G - 8) / n; const mod = n > 8 ? 2 : 1;
  return <>
    {lignes.map((v) => { const y = H - B - (v / max) * (H - B - T); return <g key={v}><line x1={G} x2={W - 8} y1={y} y2={y} className="grille" /><text x={G - 8} y={y + 4} textAnchor="end" className="axe">{court(v)}</text></g>; })}
    {labels.map((l: string, i: number) => (i % mod === 0 ? <text key={i} x={G + dx * (i + (pas ? 0.5 : 0)) + (pas ? 0 : dx / 2)} y={H - 7} textAnchor="middle" className="axe">{l}</text> : null))}
  </>;
}

export function Courbe({ data }: { data: any[] }) {
  const [i, setI] = useState<number | null>(null);
  const max = pasRond(Math.max(...data.map((d) => d.valeur), 0));
  const dx = (W - G - 8) / data.length;
  const X = (k: number) => G + dx * k + dx / 2; const Y = (v: number) => H - B - (v / max) * (H - B - T);
  const pts = data.map((d, k) => `${X(k)},${Y(d.valeur)}`).join(' ');
  const survol = (e: any) => { const r = e.currentTarget.getBoundingClientRect(); const cx = (e.clientX ?? e.touches?.[0]?.clientX) - r.left; const k = Math.floor(((cx / r.width) * W - G) / dx); setI(Math.max(0, Math.min(data.length - 1, k))); };
  return (
    <div className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution des recettes par mois" onMouseMove={survol} onMouseLeave={() => setI(null)} onTouchStart={survol}>
        <Axes max={max} n={data.length} labels={data.map((d) => d.label)} />
        {data.length > 1 && <polygon points={`${X(0)},${H - B} ${pts} ${X(data.length - 1)},${H - B}`} className="aire" />}
        <polyline points={pts} className="ligne" />
        {data.map((d, k) => <circle key={k} cx={X(k)} cy={Y(d.valeur)} r={i === k ? 7 : 5} className="point" />)}
        {i !== null && <line x1={X(i)} x2={X(i)} y1={T} y2={H - B} className="reticule" />}
      </svg>
      {i !== null && <div className="bulle" style={{ left: `${(X(i) / W) * 100}%` }}><b>{gnf(data[i].valeur)}</b><span>{data[i].label}</span></div>}
    </div>
  );
}

export function Barres({ data }: { data: any[] }) {
  const [i, setI] = useState<number | null>(null);
  const max = pasRond(Math.max(...data.map((d) => d.valeur), 0));
  const dx = (W - G - 8) / data.length; const l = Math.min(26, dx - 6);
  return (
    <div className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Montants par mois">
        <Axes max={max} n={data.length} labels={data.map((d) => d.label)} pas />
        {data.map((d, k) => {
          const h = (d.valeur / max) * (H - B - T); const x = G + dx * k + (dx - l) / 2;
          return <g key={k} onMouseEnter={() => setI(k)} onMouseLeave={() => setI(null)} onClick={() => setI(k)}>
            <rect x={G + dx * k} y={T} width={dx} height={H - B - T} fill="transparent" />
            {h > 0 && <path className="barre" d={`M${x},${H - B} v${-(h - Math.min(4, h))} q0,${-Math.min(4, h)} ${Math.min(4, h)},${-Math.min(4, h)} h${l - 2 * Math.min(4, h)} q${Math.min(4, h)},0 ${Math.min(4, h)},${Math.min(4, h)} v${h - Math.min(4, h)} z`} />}
          </g>;
        })}
      </svg>
      {i !== null && <div className="bulle" style={{ left: `${((G + dx * (i + 0.5)) / W) * 100}%` }}><b>{gnf(data[i].valeur)}</b><span>{data[i].label}</span></div>}
    </div>
  );
}

const COUL = ['#1D4ED8', '#F59E0B', '#16A34A', '#7C3AED', '#DB2777'];
export function Anneau({ data }: { data: { label: string; valeur: number }[] }) {
  const tot = data.reduce((s, d) => s + d.valeur, 0);
  const top = [...data].sort((a, b) => b.valeur - a.valeur);
  const l = top.length > 5 ? [...top.slice(0, 4), { label: 'Autres', valeur: top.slice(4).reduce((s, d) => s + d.valeur, 0) }] : top;
  const R = 42, C = 2 * Math.PI * R; let cumul = 0;
  return (
    <div className="anneau">
      <svg viewBox="0 0 120 120" role="img" aria-label="Répartition des paiements">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#EEF2F9" strokeWidth="18" />
        {l.map((d, k) => { const part = d.valeur / (tot || 1); const dash = Math.max(part * C - (l.length > 1 ? 1.5 : 0), 0); const el = <circle key={k} cx="60" cy="60" r={R} fill="none" stroke={COUL[k]} strokeWidth="18" strokeDasharray={`${dash} ${C}`} strokeDashoffset={-cumul * C} transform="rotate(-90 60 60)"><title>{`${d.label} : ${nb(d.valeur)} GNF`}</title></circle>; cumul += part; return el; })}
      </svg>
      <ul>{l.map((d, k) => <li key={k}><i style={{ background: COUL[k] }} />{d.label}<b>{tot ? Math.round((d.valeur / tot) * 100) : 0} %</b></li>)}</ul>
    </div>
  );
}
