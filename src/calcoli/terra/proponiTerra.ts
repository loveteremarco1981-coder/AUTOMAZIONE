/**
 * Proposta automatica dell'impianto di terra – CEI EN IEC 62305-3:2024 e particolari OBO serie T5
 *
 *  - "A"           picchetti: un dispersore verticale per ogni calata, a 1 m dal muro (T5.01/T5.02);
 *  - "B"           anello perimetrale in piatto inox, a 1 m dall'edificio e 0,7 m di profondità
 *                  (T5.04, T5.05, T5.17), anche attorno a più corpi uniti o a piante a L;
 *  - "fondazione"  dispersore di fondazione in piatto zincato: perimetro + maglia ≤ 20 × 20 m (T5.09),
 *                  punto di terra fisso per ogni calata (T5.11).
 * Ogni calata: giunto di sezionamento con targhetta numerata (T5.03/T5.04) e collegamento al dispersore.
 *
 * La verifica della lunghezza minima l1 dipende dalla norma (resistività e LPL): verificaTerra()
 * la esegue quando il dato è disponibile, altrimenti segnala "dato norma mancante".
 */

import { puntoInPoligono, trasformataDistanza, type Corpo, type Punto2, type Punto3 } from "../captazione/sferaRotolante";
import type { ConduttoreCAD, ComponenteCAD, PicchettoCAD } from "../cad/esportaCAD";
import type { VoceDistinta } from "../captazione/proponiCaptazione";

export type TipoTerra = "A" | "B" | "fondazione";

export interface ParametriTerra {
  tipo: TipoTerra;
  calate: Punto2[];                 // piedi delle calate (dalla proposta di captazione o dal progetto)
  distanzaAnello?: number | undefined;      // m dal muro (default 1,0 – T5.04)
  profondita?: number | undefined;          // m (default 0,7 – T5.04)
  lunghezzaPicchetto?: number | undefined;  // m per picchetto, tipo A (default 3,0 = 2 elementi da 1,5 m)
  latoMagliaFondazione?: number | undefined;// m (default 20 – T5.09)
  picchettiSuAnello?: boolean | undefined;  // tipo B: aggiunge un picchetto per calata (T5.05)
}

export interface PropostaTerra {
  conduttori: ConduttoreCAD[];
  picchetti: PicchettoCAD[];
  morsetti: ComponenteCAD[];
  distinta: VoceDistinta[];
  riepilogo: { tipo: TipoTerra; metriDispersore: number; metriCollegamenti: number; picchetti: number; areaRacchiusa: number; raggioEquivalente: number };
  avvisi: string[];
}

/* Componenti OBO (serie T5) */
const C = {
  piattoInox: { codice: "5018706", descrizione: "5052 V4A 30x3,5 – piatto inox", rif: "OBO-TBS-200-T5.04" },
  piattoZn: { codice: "5019347", descrizione: "5052 DIN 30x3,5 – piatto acciaio zincato", rif: "OBO-TBS-200-T5.09" },
  croceInox: { codice: "5314659", descrizione: "256 A-DIN 30 V4A – morsetto a croce per piatto", rif: "OBO-TBS-200-T5.04" },
  croceZn: { codice: "5314658", descrizione: "256 A-DIN 30 FT – morsetto a croce per piatto", rif: "OBO-TBS-200-T5.09" },
  sezionamento: { codice: "5336341", descrizione: "233 VA – giunto di sezionamento Rd 8-10 / FL 30", rif: "OBO-TBS-200-T5.04" },
  targhetta: { codice: "3049256", descrizione: "311 N-ALU 8-10 – targhetta numerata", rif: "OBO-TBS-200-T5.04" },
  anticorrosione: { codice: "2360055", descrizione: "356 50 – nastro anticorrosione", rif: "OBO-TBS-200-T5.04" },
  uscitaTerra: { codice: "5420504", descrizione: "200 V4A 1500 – asta di uscita dal terreno 1,5 m", rif: "OBO-TBS-200-T5.17" },
  picchettoBP: { codice: "5000858", descrizione: "219 20 BP V4A – picchetto BP 1,5 m", rif: "OBO-TBS-200-T5.05" },
  punta: { codice: "3041212", descrizione: "1819 20 BP – punta di infissione", rif: "OBO-TBS-200-T5.05" },
  morsettoPicchetto: { codice: "5001633", descrizione: "2760 20 V4A – morsetto universale per picchetto", rif: "OBO-TBS-200-T5.05" },
  puntoFisso: { codice: "5420022", descrizione: "205 DG L180 V4A – punto di terra fisso", rif: "OBO-TBS-200-T5.11" },
};
const ELEMENTO_PICCHETTO = 1.5; // m per elemento BP (da verificare sul catalogo)

/* ------------------------------------------------------------------ */
/* Contorno a distanza costante dall'edificio (unione di più corpi)     */
/* ------------------------------------------------------------------ */

/** Curve chiuse a distanza d dall'unione delle impronte (marching squares sul campo di distanza). */
export function contornoOffset(corpi: Corpo[], d: number): Punto2[][] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, area = 0;
  for (const c of corpi) for (const [x, y] of c.impronta) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  area = (maxX - minX) * (maxY - minY);
  const s = Math.max(0.1, Math.sqrt(area) / 500);
  const m = d + 3 * s;
  const x0 = minX - m, y0 = minY - m;
  const nx = Math.ceil((maxX - minX + 2 * m) / s) + 1, ny = Math.ceil((maxY - minY + 2 * m) / s) + 1;
  const src = new Uint8Array(nx * ny);
  // celle dentro le impronte, contorno compreso (anche lati destro e superiore)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (distanzaDaiCorpi(corpi, [x0 + i * s, y0 + j * s]) <= s * 0.01) src[j * nx + i] = 1;
  }
  const { d2 } = trasformataDistanza(src, nx, ny);
  const D = (i: number, j: number) => Math.sqrt(d2[j * nx + i]!) * s;
  // segmenti: chiave del lato → punto di attraversamento
  const pt = new Map<string, Punto2>();
  const adiac = new Map<string, string[]>();
  const lato = (a: string, b: string) => {
    (adiac.get(a) ?? adiac.set(a, []).get(a)!).push(b);
    (adiac.get(b) ?? adiac.set(b, []).get(b)!).push(a);
  };
  const interp = (i1: number, j1: number, i2: number, j2: number, key: string) => {
    if (!pt.has(key)) {
      const a = D(i1, j1), b = D(i2, j2);
      const f = (d - a) / (b - a);
      pt.set(key, [x0 + (i1 + (i2 - i1) * f) * s, y0 + (j1 + (j2 - j1) * f) * s]);
    }
    return key;
  };
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const a = D(i, j) <= d, b = D(i + 1, j) <= d, c = D(i + 1, j + 1) <= d, e = D(i, j + 1) <= d;
    const k: string[] = [];
    if (a !== b) k.push(interp(i, j, i + 1, j, `h${i},${j}`));
    if (b !== c) k.push(interp(i + 1, j, i + 1, j + 1, `v${i + 1},${j}`));
    if (c !== e) k.push(interp(i, j + 1, i + 1, j + 1, `h${i},${j + 1}`));
    if (e !== a) k.push(interp(i, j, i, j + 1, `v${i},${j}`));
    if (k.length === 2) lato(k[0]!, k[1]!);
    else if (k.length === 4) { lato(k[0]!, k[1]!); lato(k[2]!, k[3]!); }
  }
  // concatena in anelli chiusi
  const visto = new Set<string>();
  const anelli: Punto2[][] = [];
  for (const start of adiac.keys()) {
    if (visto.has(start)) continue;
    const giro: Punto2[] = [];
    let prev = "", cur = start;
    while (cur && !visto.has(cur)) {
      visto.add(cur);
      giro.push(pt.get(cur)!);
      const nb = adiac.get(cur)!;
      const next = nb[0] !== prev ? nb[0]! : nb[1]!;
      prev = cur; cur = next;
    }
    if (giro.length > 3) anelli.push(semplifica(giro, s * 0.5));
  }
  // solo i contorni esterni (non contenuti in un altro: esclude i cortili)
  return anelli.filter((a, i) => !anelli.some((b, j) => j !== i && Math.abs(areaPoli(b)) > Math.abs(areaPoli(a)) && puntoInPoligono(a[0]![0], a[0]![1], b)));
}

function areaPoli(p: Punto2[]): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j]![0] * p[i]![1] - p[i]![0] * p[j]![1];
  return a / 2;
}

/** Douglas–Peucker su una curva chiusa. */
function semplifica(p: Punto2[], tol: number): Punto2[] {
  const dp = (pts: Punto2[]): Punto2[] => {
    if (pts.length < 3) return pts;
    const a = pts[0]!, b = pts[pts.length - 1]!;
    let dmax = 0, idx = 0;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-12;
    for (let i = 1; i < pts.length - 1; i++) {
      const q = pts[i]!;
      const dd = Math.abs((b[0] - a[0]) * (a[1] - q[1]) - (a[0] - q[0]) * (b[1] - a[1])) / L;
      if (dd > dmax) { dmax = dd; idx = i; }
    }
    if (dmax <= tol) return [a, b];
    const l = dp(pts.slice(0, idx + 1)), r = dp(pts.slice(idx));
    return [...l.slice(0, -1), ...r];
  };
  const mid = Math.floor(p.length / 2);
  const out = [...dp(p.slice(0, mid + 1)).slice(0, -1), ...dp([...p.slice(mid), p[0]!]).slice(0, -1)];
  return out;
}

function lunghezza(p: Punto3[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1], p[i]![2] - p[i - 1]![2]);
  return l;
}

/** Punto più vicino su una polilinea chiusa. */
function piuVicino(poli: Punto2[], q: Punto2): Punto2 {
  let best: Punto2 = poli[0]!, bd = Infinity;
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i]!, b = poli[(i + 1) % poli.length]!;
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const l2 = vx * vx + vy * vy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / l2)) : 0;
    const p: Punto2 = [a[0] + t * vx, a[1] + t * vy];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** Direzione verso l'esterno dell'edificio nel punto q (sul muro). */
function versoEsterno(corpi: Corpo[], q: Punto2): Punto2 {
  // la direzione (ogni 5°) che porta il punto a 1 m il più lontano possibile dagli edifici:
  // sul muro è la perpendicolare, sullo spigolo la bisettrice esterna
  let best: Punto2 = [1, 0], bd = -1;
  for (let k = 0; k < 72; k++) {
    const a = (k * Math.PI) / 36;
    const v: Punto2 = [Math.cos(a), Math.sin(a)];
    const d = distanzaDaiCorpi(corpi, [q[0] + v[0], q[1] + v[1]]);
    if (d > bd + 1e-9) { bd = d; best = v; }
  }
  return best;
}

/** Distanza in pianta dall'unione delle impronte (0 se il punto è dentro). */
function distanzaDaiCorpi(corpi: Corpo[], q: Punto2): number {
  let d = Infinity;
  for (const c of corpi) {
    if (puntoInPoligono(q[0], q[1], c.impronta)) return 0;
    const P = c.impronta;
    for (let i = 0; i < P.length; i++) {
      const A = P[i]!, B = P[(i + 1) % P.length]!;
      const vx = B[0] - A[0], vy = B[1] - A[1];
      const l2 = vx * vx + vy * vy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - A[0]) * vx + (q[1] - A[1]) * vy) / l2)) : 0;
      d = Math.min(d, Math.hypot(q[0] - A[0] - t * vx, q[1] - A[1] - t * vy));
    }
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Proposta                                                             */
/* ------------------------------------------------------------------ */

export function proponiTerra(corpi: Corpo[], par: ParametriTerra): PropostaTerra {
  const dA = par.distanzaAnello ?? 1.0;
  const zP = -(par.profondita ?? 0.7);
  const avvisi: string[] = [];
  const conduttori: ConduttoreCAD[] = [];
  const picchetti: PicchettoCAD[] = [];
  const morsetti: ComponenteCAD[] = [];
  const tab = new Map<string, VoceDistinta>();
  const somma = (c: { codice: string; descrizione: string; rif: string }, q: number, unita: "m" | "pz") => {
    const v = tab.get(c.codice);
    if (v) v.quantita += q;
    else tab.set(c.codice, { codice: c.codice, descrizione: c.descrizione, quantita: q, unita, riferimento: c.rif });
  };
  let metriDisp = 0, metriColl = 0, areaRacc = 0;

  // giunto di sezionamento + targhetta + anticorrosione per ogni calata
  for (const [x, y] of par.calate) {
    morsetti.push({ tipo: "giunto di sezionamento", x, y, z: 0.5, codiceOBO: C.sezionamento.codice });
    somma(C.sezionamento, 1, "pz");
    somma(C.targhetta, 1, "pz");
    somma(C.anticorrosione, 1, "pz");
  }

  const aggiungiPicchetto = (x: number, y: number, ztesta: number) => {
    const L = par.lunghezzaPicchetto ?? 3.0;
    const n = Math.ceil(L / ELEMENTO_PICCHETTO - 1e-9);
    picchetti.push({ id: `P${picchetti.length + 1}`, x, y, z: ztesta, lunghezza: n * ELEMENTO_PICCHETTO, diametro: 0.02, codiceOBO: C.picchettoBP.codice });
    somma(C.picchettoBP, n, "pz");
    somma(C.punta, 1, "pz");
    somma(C.morsettoPicchetto, 1, "pz");
  };

  if (par.tipo === "B") {
    const anelli = contornoOffset(corpi, dA);
    for (const a of anelli) {
      const punti: Punto3[] = [...a, a[0]!].map(([x, y]) => [x, y, zP]);
      conduttori.push({ tipo: "anello", punti, materiale: "V4A", sezione: 30, codiceOBO: C.piattoInox.codice });
      const l = lunghezza(punti);
      metriDisp += l;
      areaRacc += Math.abs(areaPoli(a));
      somma(C.piattoInox, l, "m");
    }
    // collegamento di ogni calata all'anello: asta di uscita (1,5 m) + piatto fino all'anello + morsetto a croce
    for (const q of par.calate) {
      const anello = anelli.reduce((b, a) => (Math.hypot(...sub(piuVicino(a, q), q)) < Math.hypot(...sub(piuVicino(b, q), q)) ? a : b), anelli[0]!);
      const p = piuVicino(anello, q);
      // uscita dal terreno (asta 1,5 m, a pezzi) + piatto orizzontale fino all'anello
      conduttori.push({ tipo: "uscita", punti: [[q[0], q[1], 0.5], [q[0], q[1], zP]], materiale: "V4A", sezione: 10, codiceOBO: C.uscitaTerra.codice });
      conduttori.push({ tipo: "terra", punti: [[q[0], q[1], zP], [p[0], p[1], zP]], materiale: "V4A", sezione: 30, codiceOBO: C.piattoInox.codice });
      const lp = Math.hypot(p[0] - q[0], p[1] - q[1]);
      metriColl += lp;
      somma(C.uscitaTerra, 1, "pz");
      somma(C.piattoInox, lp, "m");
      morsetti.push({ tipo: "morsetto a croce", x: p[0], y: p[1], z: zP, codiceOBO: C.croceInox.codice });
      somma(C.croceInox, 1, "pz");
      if (par.picchettiSuAnello) aggiungiPicchetto(p[0], p[1], zP);
    }
  } else if (par.tipo === "A") {
    for (const q of par.calate) {
      const v = versoEsterno(corpi, q);
      const p: Punto2 = [q[0] + v[0] * dA, q[1] + v[1] * dA];
      conduttori.push({ tipo: "uscita", punti: [[q[0], q[1], 0.5], [q[0], q[1], zP]], materiale: "V4A", sezione: 10, codiceOBO: C.uscitaTerra.codice });
      conduttori.push({ tipo: "terra", punti: [[q[0], q[1], zP], [p[0], p[1], zP]], materiale: "V4A", sezione: 30, codiceOBO: C.piattoInox.codice });
      metriColl += dA;
      somma(C.uscitaTerra, 1, "pz");
      somma(C.piattoInox, dA, "m");
      aggiungiPicchetto(p[0], p[1], zP);
    }
  } else {
    // fondazione: perimetro di ogni corpo + maglia ≤ lato, in piatto zincato
    const lato = par.latoMagliaFondazione ?? 20;
    const z = -0.1;
    const segs: [Punto3, Punto3][] = [];
    for (const c of corpi) {
      const per: Punto3[] = [...c.impronta, c.impronta[0]!].map(([x, y]) => [x, y, z]);
      conduttori.push({ tipo: "dispersore", punti: per, materiale: "St/tZn", sezione: 30, codiceOBO: C.piattoZn.codice });
      for (let i = 1; i < per.length; i++) segs.push([per[i - 1]!, per[i]!]);
      areaRacc += Math.abs(areaPoli(c.impronta));
      const xs = c.impronta.map((p) => p[0]), ys = c.impronta.map((p) => p[1]);
      const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
      for (const [asse, a0, a1] of [["x", bx0, bx1], ["y", by0, by1]] as const) {
        const n = Math.ceil((a1 - a0) / lato - 1e-9);
        for (let k = 1; k < n; k++) {
          const v = a0 + ((a1 - a0) * k) / n;
          // tratti interni al poligono lungo la retta
          const cuts: number[] = [];
          const P = c.impronta;
          for (let i = 0; i < P.length; i++) {
            const A = P[i]!, B = P[(i + 1) % P.length]!;
            const [ua, va, ub, vb] = asse === "x" ? [A[1], A[0], B[1], B[0]] : [A[0], A[1], B[0], B[1]];
            if ((va > v) !== (vb > v)) cuts.push(ua + ((v - va) * (ub - ua)) / (vb - va));
          }
          cuts.sort((p, q) => p - q);
          for (let t = 0; t + 1 < cuts.length; t += 2) {
            const p1: Punto3 = asse === "x" ? [v, cuts[t]!, z] : [cuts[t]!, v, z];
            const p2: Punto3 = asse === "x" ? [v, cuts[t + 1]!, z] : [cuts[t + 1]!, v, z];
            conduttori.push({ tipo: "dispersore", punti: [p1, p2], materiale: "St/tZn", sezione: 30, codiceOBO: C.piattoZn.codice });
            segs.push([p1, p2]);
          }
        }
      }
    }
    for (const c of conduttori) { const l = lunghezza(c.punti); metriDisp += l; somma(C.piattoZn, l, "m"); }
    // morsetti a croce agli incroci e alle giunzioni a T (non ai vertici del perimetro)
    const nodi: Punto2[] = [];
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const [a, b] = segs[i]!, [c2, d] = segs[j]!;
      const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c2[0], sy = d[1] - c2[1];
      const den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((c2[0] - a[0]) * sy - (c2[1] - a[1]) * sx) / den;
      const u = ((c2[0] - a[0]) * ry - (c2[1] - a[1]) * rx) / den;
      if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
      const vertice = (t < 1e-6 || t > 1 - 1e-6) && (u < 1e-6 || u > 1 - 1e-6);
      if (vertice) continue;
      const p: Punto2 = [a[0] + rx * t, a[1] + ry * t];
      if (!nodi.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05)) nodi.push(p);
    }
    for (const [x, y] of nodi) { morsetti.push({ tipo: "morsetto a croce", x, y, z, codiceOBO: C.croceZn.codice }); somma(C.croceZn, 1, "pz"); }
    // punto di terra fisso per ogni calata
    for (const [x, y] of par.calate) {
      morsetti.push({ tipo: "punto di terra fisso", x, y, z: 0.3, codiceOBO: C.puntoFisso.codice });
      somma(C.puntoFisso, 1, "pz");
    }
    avvisi.push("Collegamento ai ferri di armatura (1814 FT 5014468) ogni 2 m: passo da verificare");
  }

  if (!par.calate.length) avvisi.push("Nessuna calata: proporre prima la captazione");
  const distinta = [...tab.values()].map((v) => ({ ...v, quantita: v.unita === "m" ? Math.round(v.quantita * 100) / 100 : v.quantita }))
    .sort((a, b) => a.codice.localeCompare(b.codice));
  return {
    conduttori, picchetti, morsetti, distinta,
    riepilogo: {
      tipo: par.tipo, metriDispersore: metriDisp, metriCollegamenti: metriColl, picchetti: picchetti.length,
      areaRacchiusa: areaRacc, raggioEquivalente: Math.sqrt(areaRacc / Math.PI),
    },
    avvisi,
  };
}

function sub(a: Punto2, b: Punto2): [number, number] { return [a[0] - b[0], a[1] - b[1]]; }

/**
 * Verifica con la lunghezza minima l1 (dal grafico della norma, in funzione di resistività e LPL).
 * Tipo A: ogni picchetto verticale ≥ 0,5·l1. Tipo B / fondazione: raggio equivalente re ≥ l1.
 */
export function verificaTerra(p: PropostaTerra, l1: number | null): { esito: "adeguata" | "non adeguata" | "dato norma mancante"; dettaglio: string } {
  if (l1 == null) return { esito: "dato norma mancante", dettaglio: "Lunghezza minima l1 non impostata (Dati normativi)" };
  if (p.riepilogo.tipo === "A") {
    const min = Math.min(...p.picchetti.map((q) => q.lunghezza));
    const ok = min >= 0.5 * l1 - 1e-9;
    return { esito: ok ? "adeguata" : "non adeguata", dettaglio: `Picchetto più corto ${min.toFixed(2)} m, richiesto ≥ 0,5·l1 = ${(0.5 * l1).toFixed(2)} m` };
  }
  const re = p.riepilogo.raggioEquivalente;
  const ok = re >= l1 - 1e-9;
  return { esito: ok ? "adeguata" : "non adeguata", dettaglio: `Raggio equivalente re = ${re.toFixed(2)} m, richiesto ≥ l1 = ${l1.toFixed(2)} m` };
}
