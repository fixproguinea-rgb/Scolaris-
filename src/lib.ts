export const nb = (n: any) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const gnf = (n: any) => `${nb(n)} GNF`;
export const entier = (s: any) => Number(String(s ?? '').replace(/\D/g, '')) || 0;
export const dateFr = (d: any) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('fr-FR') : '');
export const heure = (d: any) => (d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
export const auj = () => new Date().toISOString().slice(0, 10);
export const tel = (v: any) => { let t = String(v ?? '').replace(/\D/g, '').replace(/^00/, ''); if (/^224\d{9}$/.test(t)) t = t.slice(3); return t; };
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// Mois de l'année scolaire : [{cle:'2026-10', label:'Oct'}…]
export function moisAnnee(a: any) {
  const l: { cle: string; label: string }[] = [];
  const d = new Date(a.date_debut + 'T00:00:00'); const f = new Date(a.date_fin + 'T00:00:00');
  for (let y = d.getFullYear(), m = d.getMonth(); y < f.getFullYear() || (y === f.getFullYear() && m <= f.getMonth());) {
    l.push({ cle: `${y}-${String(m + 1).padStart(2, '0')}`, label: MOIS[m] });
    if (++m === 12) { m = 0; y++; }
  }
  return l;
}

export function parMois(a: any, lignes: any[], champDate: string, jusquAujourdhui = false) {
  const t: Record<string, number> = {};
  for (const l of lignes) { const k = String(l[champDate]).slice(0, 7); t[k] = (t[k] || 0) + Number(l.montant); }
  const fin = auj().slice(0, 7);
  return moisAnnee(a).filter((m) => !jusquAujourdhui || m.cle <= fin).map((m) => ({ label: m.label, cle: m.cle, valeur: t[m.cle] || 0 }));
}

// Excel : fichier .xlsx réel, sans dépendance
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(fichiers: Record<string, string>) {
  const enc = new TextEncoder(); const morceaux: Uint8Array[] = []; const central: Uint8Array[] = []; let pos = 0;
  const u16 = (n: number) => [n & 255, n >> 8]; const u32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24];
  for (const [nom, txt] of Object.entries(fichiers)) {
    const n = enc.encode(nom), d = enc.encode(txt), c = crc(d);
    const com = [20, 0, 0, 8, 0, 0, 0, 0, 33, 0, ...u32(c), ...u32(d.length), ...u32(d.length), ...u16(n.length), 0, 0];
    const loc = new Uint8Array([0x50, 0x4b, 3, 4, ...com, ...n, ...d]);
    morceaux.push(loc);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, ...com, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(pos), ...n]));
    pos += loc.length;
  }
  const tc = central.reduce((s, x) => s + x.length, 0); const k = Object.keys(fichiers).length;
  const fin = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(k), ...u16(k), ...u32(tc), ...u32(pos), 0, 0]);
  return new Blob([...morceaux, ...central, fin] as any, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const col = (i: number) => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

export function telechargerExcel(nom: string, lignes: any[][]) {
  const rows = lignes.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => typeof v === 'number'
    ? `<c r="${col(c)}${r + 1}"><v>${v}</v></c>`
    : `<c r="${col(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('');
  const b = zip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Scolaris" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
  });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${nom}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Lecture des fichiers importés
function csv(txt: string): string[][] {
  const sep = (txt.split('\n')[0].match(/;/g) || []).length >= (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const r: string[][] = []; let l: string[] = [], c = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const x = txt[i];
    if (q) { if (x === '"' && txt[i + 1] === '"') { c += '"'; i++; } else if (x === '"') q = false; else c += x; }
    else if (x === '"') q = true;
    else if (x === sep) { l.push(c); c = ''; }
    else if (x === '\n') { l.push(c.replace(/\r$/, '')); r.push(l); l = []; c = ''; }
    else c += x;
  }
  if (c || l.length) { l.push(c.replace(/\r$/, '')); r.push(l); }
  return r.filter((x) => x.some((v) => v.trim()));
}

async function deziper(buf: ArrayBuffer) {
  const v = new DataView(buf); let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Fichier Excel illisible');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  const res: Record<string, string> = {}; const dec = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const meth = v.getUint16(p + 10, true), taille = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true), lx = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const nom = dec.decode(new Uint8Array(buf, p + 46, ln));
    if (/sharedStrings\.xml$|worksheets\/sheet1\.xml$/.test(nom)) {
      const d = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
      const brut = new Uint8Array(buf, d, taille);
      res[nom] = meth === 0 ? dec.decode(brut) : await new Response(new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    p += 46 + ln + lx + lc;
  }
  return res;
}

async function xlsx(buf: ArrayBuffer): Promise<string[][]> {
  const f = await deziper(buf); const P = new DOMParser();
  const partages = f['xl/sharedStrings.xml'] ? [...P.parseFromString(f['xl/sharedStrings.xml'], 'text/xml').getElementsByTagName('si')].map((s) => [...s.getElementsByTagName('t')].map((t) => t.textContent).join('')) : [];
  const feuille = f['xl/worksheets/sheet1.xml']; if (!feuille) throw new Error('Feuille Excel introuvable');
  const lignes: string[][] = [];
  for (const row of P.parseFromString(feuille, 'text/xml').getElementsByTagName('row')) {
    const l: string[] = [];
    for (const c of row.getElementsByTagName('c')) {
      const m = (c.getAttribute('r') || 'A').match(/[A-Z]+/)![0]; let idx = 0; for (const ch of m) idx = idx * 26 + ch.charCodeAt(0) - 64;
      const t = c.getAttribute('t'); const val = c.getElementsByTagName('v')[0]?.textContent ?? '';
      l[idx - 1] = t === 's' ? partages[Number(val)] ?? '' : t === 'inlineStr' ? c.getElementsByTagName('t')[0]?.textContent ?? '' : val;
    }
    lignes.push(Array.from(l, (x) => x ?? ''));
  }
  return lignes.filter((x) => x.some((v) => String(v).trim()));
}

export async function lireTableau(f: File) {
  if (/\.xlsx$/i.test(f.name)) return xlsx(await f.arrayBuffer());
  if (/\.csv$/i.test(f.name)) return csv((await f.text()).replace(/^﻿/, ''));
  throw new Error('Format accepté : .xlsx ou .csv');
}
