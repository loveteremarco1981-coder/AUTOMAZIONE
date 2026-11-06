/**
 * Metodo della maglia e verifica combinata – CEI EN IEC 62305-3:2024
 *
 * Usa la griglia e le coperture del risultato della sfera rotolante, così i due metodi
 * lavorano sulle stesse celle.
 *
 * Metodo della maglia
 * 1. I conduttori di captazione che corrono sulla copertura vengono rasterizzati in pianta
 *    (tracciato continuo, senza varchi in diagonale).
 * 2. Le parti di copertura racchiuse dai conduttori sono le maglie (riempimento a 4 vicini).
 * 3. Ogni maglia viene misurata con il rettangolo di area minima che la contiene
 *    (funziona anche con maglie ruotate o non rettangolari): lato = interasse dei conduttori.
 * 4. Una maglia è conforme se:
 *    - è chiusa: non arriva a un bordo libero della copertura senza conduttore
 *      (un bordo contro una parete più alta non conta come bordo libero);
 *    - entrambi i lati sono ≤ lato massimo del livello di protezione (parametriLPL.json);
 *    - se è impostata una pendenza massima di applicabilità, la falda non la supera.
 *
 * Verifica combinata
 * Una cella di copertura è protetta se è protetta dalla sfera rotolante OPPURE se è dentro
 * una maglia conforme (o è occupata da un captatore). Le pareti esposte vengono solo dalla sfera.
 */

import type { Conduttore, RisultatoSfera, Punto2 } from "./sferaRotolante";

export interface ParametriMaglia {
  latoMaglia: number;               // lato massimo della maglia per l'LPL (m)
  pendenzaMassima?: number | null | undefined;  // oltre questa pendenza (Δz/Δx) il metodo non si applica; null = nessun limite
  altezzaMassimaConduttore?: number | undefined;// conduttori fino a questa altezza sopra la copertura contano come maglia (default 2 m)
  sogliaGradino?: number | undefined;           // salto di quota oltre il quale c'è un bordo (default 0,3 m)
}

/** Stato di ogni cella nella verifica a maglia. */
export const STATO_MAGLIA = {
  NON_COPERTURA: 0,
  CONDUTTORE: 1,
  CONFORME: 2,
  TROPPO_GRANDE: 3,
  APERTA: 4,
  PENDENZA: 5,
} as const;

export interface Maglia {
  id: number;
  celle: number;
  area: number;             // m²
  lunghezza: number;        // lato maggiore (m), interasse dei conduttori
  larghezza: number;        // lato minore (m)
  rotazione: number;        // gradi, orientamento del rettangolo minimo
  aperta: boolean;
  pendenza: number;         // pendenza media (Δz/Δx)
  conforme: boolean;
  motivo?: string | undefined;
  centro: Punto2;
}

export interface RisultatoMaglia {
  stato: Uint8Array;        // per cella, valori di STATO_MAGLIA
  maglia: Int32Array;       // per cella, id della maglia (−1 se nessuna)
  maglie: Maglia[];
  avvisi: string[];
}

export function verificaMaglia(
  ris: RisultatoSfera,
  conduttori: Conduttore[],
  par: ParametriMaglia,
): RisultatoMaglia {
  const g = ris.griglia;
  const s = g.passo;
  const N = g.nx * g.ny;
  const h = ris.altezze;
  const copertura = (k: number) => ris.corpoCella[k]! >= 0;
  const altMax = par.altezzaMassimaConduttore ?? 2;
  const gradino = par.sogliaGradino ?? 0.3;
  const avvisi: string[] = [];

  const stato = new Uint8Array(N);
  const maglia = new Int32Array(N).fill(-1);
  for (let k = 0; k < N; k++) if (copertura(k)) stato[k] = 255; // da classificare

  // segmenti dei conduttori in pianta, per misurare le maglie sulla geometria vera
  const seg: number[] = [];
  for (const c of conduttori) for (let t = 0; t + 1 < c.punti.length; t++) {
    seg.push(c.punti[t]![0], c.punti[t]![1], c.punti[t + 1]![0], c.punti[t + 1]![1]);
  }

  // 1. Conduttori in pianta (tracciato 4-connesso)
  const segna = (i: number, j: number, z: number) => {
    if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return;
    const k = j * g.nx + i;
    if (!copertura(k)) return;
    if (z >= h[k]! - 0.05 && z <= h[k]! + altMax) stato[k] = STATO_MAGLIA.CONDUTTORE;
  };
  for (const c of conduttori) {
    for (let t = 0; t + 1 < c.punti.length; t++) {
      const [ax, ay, az] = c.punti[t]!;
      const [bx, by, bz] = c.punti[t + 1]!;
      const L = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.ceil(L / (s / 4)));
      let pi = NaN, pj = NaN;
      for (let u = 0; u <= n; u++) {
        const f = u / n;
        const x = ax + (bx - ax) * f, y = ay + (by - ay) * f, z = az + (bz - az) * f;
        const i = Math.round((x - g.x0) / s), j = Math.round((y - g.y0) / s);
        // passaggio in diagonale: si segna anche una cella intermedia, così la maglia
        // non "perde" tra due celle che si toccano solo nello spigolo
        if (!Number.isNaN(pi) && i !== pi && j !== pj) segna(i, pj, z);
        segna(i, j, z);
        pi = i; pj = j;
      }
    }
  }

  // 2. Maglie: componenti 4-connesse delle celle di copertura non occupate da conduttori
  const vicini: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const coda = new Int32Array(N);
  const maglie: Maglia[] = [];
  for (let k0 = 0; k0 < N; k0++) {
    if (stato[k0]! !== 255 || maglia[k0]! >= 0) continue;
    const id = maglie.length;
    let testa = 0, fine = 0;
    coda[fine++] = k0;
    maglia[k0] = id;
    let aperta = false;
    // piano medio della maglia (minimi quadrati) per la pendenza
    let sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
    const punti: Punto2[] = [];
    while (testa < fine) {
      const k = coda[testa++]!;
      const i = k % g.nx, j = (k - i) / g.nx;
      const x = g.x0 + i * s, y = g.y0 + j * s, z = h[k]!;
      punti.push([x, y]);
      sx += x; sy += y; sz += z; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z;
      for (const [di, dj] of vicini) {
        const ii = i + di, jj = j + dj;
        const fuori = ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny;
        const kk = jj * g.nx + ii;
        if (fuori || !copertura(kk)) { aperta = true; continue; }
        const dz = h[kk]! - h[k]!;
        if (dz < -gradino) { aperta = true; continue; }   // bordo verso una quota più bassa
        if (dz > gradino) continue;                      // parete più alta: chiude la maglia
        if (stato[kk]! === STATO_MAGLIA.CONDUTTORE) continue;
        if (maglia[kk]! < 0) { maglia[kk] = id; coda[fine++] = kk; }
      }
    }
    const dim = rettangoloMinimo(punti);
    const [lunghezza, larghezza] = interassi(punti, dim.angolo, seg, s);
    const pendenza = pendenzaPiano(fine, sx, sy, sz, sxx, syy, sxy, sxz, syz);
    let conforme = true;
    let motivo: string | undefined;
    if (aperta) { conforme = false; motivo = "Maglia aperta verso un bordo senza conduttore"; }
    else if (par.pendenzaMassima != null && pendenza > par.pendenzaMassima) {
      conforme = false; motivo = `Pendenza ${pendenza.toFixed(2)} oltre il limite di applicabilità`;
    } else if (lunghezza > par.latoMaglia + 0.05) {
      conforme = false; motivo = `Maglia ${lunghezza.toFixed(1)} × ${larghezza.toFixed(1)} m oltre il lato massimo di ${par.latoMaglia} m`;
    }
    maglie.push({
      id, celle: fine, area: fine * s * s, lunghezza, larghezza, rotazione: dim.angolo,
      aperta, pendenza, conforme, motivo, centro: dim.centro,
    });
  }
  for (let k = 0; k < N; k++) {
    if (stato[k]! !== 255) continue;
    const m = maglie[maglia[k]!]!;
    stato[k] = m.conforme ? STATO_MAGLIA.CONFORME
      : m.aperta ? STATO_MAGLIA.APERTA
      : m.motivo?.startsWith("Pendenza") ? STATO_MAGLIA.PENDENZA
      : STATO_MAGLIA.TROPPO_GRANDE;
  }
  if (!conduttori.length) avvisi.push("Nessun conduttore di captazione: metodo della maglia non applicabile");
  return { stato, maglia, maglie, avvisi };
}

/**
 * Interassi della maglia lungo i due assi del rettangolo minimo: estensione delle celle più la
 * distanza (vera, in pianta) delle celle estreme dal conduttore che le chiude da quel lato.
 * Restituisce [maggiore, minore].
 */
function interassi(punti: Punto2[], angolo: number, seg: number[], s: number): [number, number] {
  const th = (angolo * Math.PI) / 180;
  const assi: Punto2[] = [[Math.cos(th), Math.sin(th)], [-Math.sin(th), Math.cos(th)]];
  const out: number[] = [];
  for (const [ux, uy] of assi) {
    let u0 = Infinity, u1 = -Infinity;
    for (const [x, y] of punti) { const u = x * ux + y * uy; if (u < u0) u0 = u; if (u > u1) u1 = u; }
    // distanza dal conduttore "trasversale" più vicino, per le celle estreme di ciascun lato
    const lato = (estremo: number, verso: number) => {
      let d = Infinity;
      for (const [x, y] of punti) {
        const u = x * ux + y * uy;
        if (Math.abs(u - estremo) > s * 0.75) continue;
        for (let k = 0; k < seg.length; k += 4) {
          const ax = seg[k]!, ay = seg[k + 1]!, bx = seg[k + 2]!, by = seg[k + 3]!;
          const vx = bx - ax, vy = by - ay;
          const L = Math.hypot(vx, vy);
          if (L < 1e-9 || Math.abs((vx * ux + vy * uy) / L) > 0.5) continue; // solo conduttori trasversali
          const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (L * L)));
          const px = ax + t * vx, py = ay + t * vy;
          if (((px - x) * ux + (py - y) * uy) * verso <= 0) continue; // dal lato giusto
          const dd = Math.hypot(px - x, py - y);
          if (dd < d) d = dd;
        }
      }
      return d <= 2 * s ? d : s; // nessun conduttore vicino (maglia aperta): stima con il passo
    };
    out.push(u1 - u0 + lato(u0, -1) + lato(u1, 1));
  }
  return out[0]! >= out[1]! ? [out[0]!, out[1]!] : [out[1]!, out[0]!];
}

/** Pendenza del piano z = a·x + b·y + c interpolato ai minimi quadrati: sqrt(a² + b²). */
function pendenzaPiano(n: number, sx: number, sy: number, sz: number, sxx: number, syy: number, sxy: number, sxz: number, syz: number): number {
  if (n < 3) return 0;
  // coordinate centrate per stabilità numerica
  const mx = sx / n, my = sy / n, mz = sz / n;
  const cxx = sxx - n * mx * mx, cyy = syy - n * my * my, cxy = sxy - n * mx * my;
  const cxz = sxz - n * mx * mz, cyz = syz - n * my * mz;
  const det = cxx * cyy - cxy * cxy;
  if (Math.abs(det) < 1e-9) return 0;
  const a = (cxz * cyy - cyz * cxy) / det;
  const b = (cyz * cxx - cxz * cxy) / det;
  return Math.hypot(a, b);
}

/** Rettangolo di area minima che contiene i punti (rotazioni di 1°). a ≥ b. */
export function rettangoloMinimo(punti: Punto2[]) {
  let best = { area: Infinity, a: 0, b: 0, angolo: 0, centro: [0, 0] as Punto2 };
  for (let deg = 0; deg < 90; deg++) {
    const th = (deg * Math.PI) / 180;
    const c = Math.cos(th), sn = Math.sin(th);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of punti) {
      const u = x * c + y * sn, v = -x * sn + y * c;
      if (u < u0) u0 = u; if (u > u1) u1 = u;
      if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const du = u1 - u0, dv = v1 - v0;
    const area = (du + 1e-9) * (dv + 1e-9);
    if (area < best.area - 1e-9) {
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      best = {
        area, a: Math.max(du, dv), b: Math.min(du, dv), angolo: deg,
        centro: [uc * c - vc * sn, uc * sn + vc * c],
      };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Verifica combinata                                                  */
/* ------------------------------------------------------------------ */

export const STATO_COMBINATO = {
  NON_COPERTURA: 0,
  PROTETTA_SFERA: 1,   // verde
  PROTETTA_MAGLIA: 2,  // blu
  ESPOSTA: 3,          // rosso
} as const;

export interface RisultatoCombinato {
  stato: Uint8Array;
  areaProtettaSfera: number;
  areaProtettaMaglia: number;
  areaEsposta: number;
  areaPareteEsposta: number;
  esito: "adeguata" | "non adeguata";
  maglieNonConformi: Maglia[];
}

export function verificaCombinata(ris: RisultatoSfera, rm: RisultatoMaglia | null): RisultatoCombinato {
  const g = ris.griglia;
  const N = g.nx * g.ny;
  const stato = new Uint8Array(N);
  let nS = 0, nM = 0, nE = 0, nTot = 0;
  for (let k = 0; k < N; k++) {
    if (ris.esposta[k]! === 0) continue;
    nTot++;
    if (ris.esposta[k]! === 2 || ris.captatoreCella[k]!) { stato[k] = STATO_COMBINATO.PROTETTA_SFERA; nS++; }
    else if (rm && (rm.stato[k]! === STATO_MAGLIA.CONFORME || rm.stato[k]! === STATO_MAGLIA.CONDUTTORE)) {
      stato[k] = STATO_COMBINATO.PROTETTA_MAGLIA; nM++;
    } else { stato[k] = STATO_COMBINATO.ESPOSTA; nE++; }
  }
  // stesse aree della sfera: si ripartisce l'area di copertura in proporzione alle celle
  const fattore = nTot ? ris.areaCopertura / nTot : 0;
  // le maglie non conformi interessano solo dove la sfera non protegge già
  const conEsposte = new Set<number>();
  if (rm) for (let k = 0; k < N; k++) if (stato[k]! === STATO_COMBINATO.ESPOSTA && rm.maglia[k]! >= 0) conEsposte.add(rm.maglia[k]!);
  const maglieNonConformi = rm ? rm.maglie.filter((m) => !m.conforme && conEsposte.has(m.id)) : [];
  return {
    stato,
    areaProtettaSfera: nS * fattore,
    areaProtettaMaglia: nM * fattore,
    areaEsposta: nE * fattore,
    areaPareteEsposta: ris.areaPareteEsposta,
    esito: nE === 0 && ris.facceEsposte.length === 0 ? "adeguata" : "non adeguata",
    maglieNonConformi,
  };
}
