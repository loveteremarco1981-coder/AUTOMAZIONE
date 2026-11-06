/**
 * Proposta automatica della captazione e delle calate – CEI EN IEC 62305-3:2024
 *
 * Per ogni corpo di fabbrica:
 *  - tetto piano:  conduttore perimetrale + maglia orientata secondo il lato lungo, con passo
 *                  uguale ≤ lato massimo (anche su impronte non rettangolari o ruotate);
 *  - tetto a falde: conduttore di gronda, di colmo e trasversali gronda–colmo–gronda;
 *  - calate:       prima sugli spigoli, poi intermedie, a distanza ≤ distanza massima del livello;
 *                  niente calate sui lati in comune con un altro corpo.
 * Poi verifica il risultato (sfera rotolante + maglia) e, dove resta qualcosa di esposto
 * (sporgenze, corpi più alti, camini), aggiunge aste con il suggeritore.
 * Infine posiziona supporti e morsetti (incroci, giunzioni, attacchi delle calate).
 *
 * I codici articolo e il passo dei supporti arrivano dal catalogo (default: particolare tipico
 * OBO-TBS-250-T1.05, captazione a maglia con conduttore tondo su tetto piano).
 */

import {
  calcolaSferaRotolante, suggerisciAste, puntoInPoligono,
  type Corpo, type Punto2, type Punto3, type Asta, type InputSfera, type RisultatoSfera,
} from "./sferaRotolante";
import { verificaMaglia, verificaCombinata, rettangoloMinimo, type RisultatoCombinato } from "./verificaMaglia";
import type { ConduttoreCAD, ComponenteCAD, AstaCAD } from "../cad/esportaCAD";

export interface CatalogoCaptazione {
  conduttore: { codice: string; descrizione: string; materiale: string; diametroMm: number };
  supporto: { codice: string; descrizione: string; passoMax: number } | null; // passo massimo (m); null = conduttore annegato
  connettore: { codice: string; descrizione: string };
  compensatore?: { codice: string; descrizione: string; ogni: number | null } | undefined; // ogni quanti m (null = non posato)
  asta?: { codice: string; descrizione: string } | undefined;
  riferimento: string;
}

/** Valori del particolare OBO-TBS-250-T1.05 (tetto piano, conduttore tondo). */
export const CATALOGO_T1_05: CatalogoCaptazione = {
  conduttore: { codice: "5021294", descrizione: "RD 8-ALU-T – conduttore tondo in alluminio", materiale: "Al", diametroMm: 8 },
  supporto: { codice: "5218700", descrizione: "165 MBG-8-10 – supporto per tetto piano", passoMax: 1.0 },
  connettore: { codice: "5311519", descrizione: "249 8-10 ALU – connettore rapido Vario" },
  compensatore: { codice: "5218926", descrizione: "172 AR – compensatore di dilatazione", ogni: 10 }, // T1.04: alluminio 10 m
  riferimento: "OBO-TBS-250-T1.05",
};

/** OBO-TBS-250-T1.06: maglia con conduttore piatto in acciaio zincato. */
export const CATALOGO_T1_06: CatalogoCaptazione = {
  conduttore: { codice: "5019347", descrizione: "5052 DIN 30x3,5 – piatto acciaio zincato", materiale: "St/tZn", diametroMm: 30 },
  supporto: { codice: "5218700", descrizione: "165 MBG-8-10 + 165 MBG HFL (5218885) – supporto con adattatore piatto", passoMax: 1.0 },
  connettore: { codice: "5314658", descrizione: "256 A-DIN 30 FT – morsetto a croce per piatto" },
  compensatore: { codice: "5331501", descrizione: "856 – nastro di dilatazione (+ 2 viti SKS 10x25 F 3160734)", ogni: 15 }, // T1.04: acciaio 15 m
  riferimento: "OBO-TBS-250-T1.06",
};

/** OBO-TBS-250-T1.07: tetto con ghiaia (passo dei supporti non indicato nel PDF: 1,0 m da verificare). */
export const CATALOGO_T1_07: CatalogoCaptazione = {
  conduttore: CATALOGO_T1_05.conduttore,
  supporto: { codice: "5218977", descrizione: "165 KRB SO – supporto per tetto con ghiaia", passoMax: 1.0 },
  connettore: CATALOGO_T1_05.connettore,
  compensatore: CATALOGO_T1_05.compensatore,
  riferimento: "OBO-TBS-250-T1.07",
};

/** OBO-TBS-250-T1.22: copertura carrabile, conduttore inox annegato nell'impermeabilizzazione. */
export const CATALOGO_T1_22: CatalogoCaptazione = {
  conduttore: { codice: "5021647", descrizione: "RD 10-V4A – tondo inox Ø10", materiale: "V4A", diametroMm: 10 },
  supporto: null,
  connettore: { codice: "5312318", descrizione: "252 8-10 V4A – morsetto a croce" },
  riferimento: "OBO-TBS-250-T1.22",
};

export type CoperturaPiana = "guaina" | "ghiaia" | "carrabile";

/** Supporto con passo e accessori per supporto (tasselli, viti…), dal particolare OBO indicato. */
export interface SupportoCat {
  codice: string;
  descrizione: string;
  passoMax: number | null;            // null = conduttore senza supporti a passo (in traccia, sulle staffe…)
  accessori?: { codice: string; descrizione: string; quantita: number }[] | undefined;
  riferimento: string;
}

/** Tetti a falde (serie T3): supporto sulla falda e sul colmo per tipo di manto. */
export const SUPPORTI_FALDA: Record<string, { falda: SupportoCat; colmo: SupportoCat }> = {
  tegole: {
    falda: { codice: "5215625", descrizione: "157 I-VA – supporto per tetti in tegole", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.09" },
    colmo: { codice: "5202515", descrizione: "132 K VA – supporto per colmo", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.06" },
  },
  coppi: {
    falda: { codice: "5215625", descrizione: "157 I-VA – supporto per tetti in tegole", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.09" },
    colmo: { codice: "5202515", descrizione: "132 K VA – supporto per colmo", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.03" },
  },
  bituminoso: {
    falda: { codice: "5215544", descrizione: "157 FK-VA 230 – supporto per tetti in tegole", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.08" },
    colmo: { codice: "5215544", descrizione: "157 FK-VA 230 – supporto per tetti in tegole", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.05" },
  },
  ardesia: {
    falda: { codice: "5202248", descrizione: "133 A – supporto per tegole, ardesia, ondulato", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.14" },
    colmo: { codice: "5202510", descrizione: "132 P VA – supporto per colmo", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.01" },
  },
  lamiera_grecata: {
    falda: { codice: "5217075", descrizione: "159 VA-V – supporto per tegole, ardesia, ondulato", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.16" },
    colmo: { codice: "5203015", descrizione: "132 U – supporto per colmo con molla", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.16" },
  },
  aggraffata: {
    falda: { codice: "5317208", descrizione: "270 8-10 VA – morsetto per aggraffatura", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.17" },
    colmo: { codice: "5317208", descrizione: "270 8-10 VA – morsetto per aggraffatura", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.04" },
  },
  tegole_metalliche: {
    falda: { codice: "5207342", descrizione: "177 35 VA M6 – staffa rialzata senza viti", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.12" },
    colmo: { codice: "5202510", descrizione: "132 P VA – supporto per colmo", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.01" },
  },
  kalzip: {
    falda: { codice: "5317512", descrizione: "RSF 177 20 VA M8 – morsetto Kalzip", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.25" },
    colmo: { codice: "5317512", descrizione: "RSF 177 20 VA M8 – morsetto Kalzip", passoMax: 1.0, riferimento: "OBO-TBS-250-T3.25" },
  },
};

/** Calate (serie T4): supporti, accessori e conduttore per tipo di parete. */
export const SUPPORTI_CALATA: Record<string, SupportoCat & { conduttore?: { codice: string; descrizione: string } | undefined }> = {
  muratura: { codice: "5229960", descrizione: "113 Z8-10 – staffa con traversa Rd 8-10", passoMax: 1.0, riferimento: "OBO-TBS-250-T4.01",
    accessori: [{ codice: "3133230", descrizione: "985 M8 35 – tassello filettato M8", quantita: 1 }, { codice: "2349086", descrizione: "910 N 8x40 GRW – tassello ad espansione", quantita: 1 }] },
  cappotto: { codice: "5229960", descrizione: "113 Z8-10 – staffa con traversa Rd 8-10", passoMax: 1.0, riferimento: "OBO-TBS-250-T4.02",
    accessori: [{ codice: "3141128", descrizione: "TR M8 1M G – barra filettata 1 m (da tagliare)", quantita: 1 }, { codice: "3492910", descrizione: "E M 8x40 – tassello a battere", quantita: 1 }] },
  sotto_cappotto: { codice: "5228123", descrizione: "156 K 8-10 ST – traversa Rd 8-10", passoMax: 1.0, riferimento: "OBO-TBS-250-T4.03",
    accessori: [{ codice: "3188043", descrizione: "HHWS 6x40 G – vite DIN 571", quantita: 1 }, { codice: "2349086", descrizione: "910 N 8x40 GRW – tassello ad espansione", quantita: 1 }] },
  sotto_intonaco: { codice: "", descrizione: "in traccia sotto intonaco, senza supporti", passoMax: null, riferimento: "OBO-TBS-250-T4.04",
    conduttore: { codice: "5021332", descrizione: "RD 8-PVC – tondo Al con guaina PVC" } },
  facciata_ventilata: { codice: "5229960", descrizione: "113 Z8-10 – staffa con traversa Rd 8-10", passoMax: 1.0, riferimento: "OBO-TBS-250-T4.05",
    accessori: [{ codice: "3141128", descrizione: "TR M8 1M G – barra filettata 1 m (da tagliare)", quantita: 1 }, { codice: "3492910", descrizione: "E M 8x40 – tassello a battere", quantita: 1 }] },
  vetrata: { codice: "5229960", descrizione: "113 Z8-10 – staffa con traversa Rd 8-10", passoMax: 1.0, riferimento: "OBO-TBS-250-T4.07",
    accessori: [{ codice: "3192644", descrizione: "4759 6.0x60 – vite Sprint", quantita: 1 }] },
  lamiera: { codice: "5207347", descrizione: "177 20 VA M8 – staffa senza viti Rd 8", passoMax: 1.0, riferimento: "OBO-TBS-250-T4.08",
    accessori: [{ codice: "5207371", descrizione: "177 U – rondella per staffa", quantita: 1 }, { codice: "3195635", descrizione: "4758 5.0x30 – vite Sprint", quantita: 1 }] },
};

export interface VoceDistinta { codice: string; descrizione: string; quantita: number; unita: "m" | "pz"; riferimento?: string | undefined }

/** Particolare OBO da usare per il tipo di copertura e il materiale del conduttore. */
export function catalogoPerCopertura(copertura: CoperturaPiana | string | undefined, materiale: "alluminio" | "acciaio" = "alluminio"): CatalogoCaptazione {
  if (copertura === "ghiaia") return CATALOGO_T1_07;
  if (copertura === "carrabile") return CATALOGO_T1_22;
  return materiale === "acciaio" ? CATALOGO_T1_06 : CATALOGO_T1_05;
}

export interface ParametriProposta {
  raggio: number;               // sfera rotolante dell'LPL (m)
  latoMaglia: number;           // lato massimo della maglia (m)
  distanzaCalate: number;       // distanza massima tra le calate (m)
  pendenzaMassimaMaglia?: number | null | undefined;
  strategia?: "maglia" | "aste" | "mista" | undefined; // default "mista": maglia + aste dove serve
  altezzaAsta?: number | undefined;         // default 1,5 m
  altezzaConduttore?: number | undefined;   // quota del conduttore sopra la copertura (default 0)
  catalogo?: CatalogoCaptazione | undefined;
  manto?: string | undefined;               // tetti a falde: chiave di SUPPORTI_FALDA (default "tegole")
  parete?: string | undefined;              // calate: chiave di SUPPORTI_CALATA (default "muratura")
}

export interface PropostaCaptazione {
  conduttori: ConduttoreCAD[];
  aste: AstaCAD[];
  supporti: ComponenteCAD[];
  morsetti: ComponenteCAD[];
  compensatori: ComponenteCAD[];
  sfera: RisultatoSfera;
  combinata: RisultatoCombinato;
  distinta: VoceDistinta[];
  riepilogo: { metriCaptazione: number; metriCalate: number; numeroCalate: number; aste: number; supporti: number; morsetti: number; compensatori: number; particolare: string };
  avvisi: string[];
}

/* ------------------------------------------------------------------ */
/* Geometria in pianta                                                 */
/* ------------------------------------------------------------------ */

/** Tratti interni al poligono della retta v = c nel sistema ruotato (u lungo l'asse principale). */
function trattiInterni(poli: Punto2[], th: number, c: number): [Punto2, Punto2][] {
  const co = Math.cos(th), si = Math.sin(th);
  const uv = poli.map(([x, y]) => [x * co + y * si, -x * si + y * co] as Punto2);
  const us: number[] = [];
  for (let i = 0; i < uv.length; i++) {
    const [u1, v1] = uv[i]!;
    const [u2, v2] = uv[(i + 1) % uv.length]!;
    if ((v1 > c) !== (v2 > c)) us.push(u1 + ((c - v1) * (u2 - u1)) / (v2 - v1));
  }
  us.sort((a, b) => a - b);
  const out: [Punto2, Punto2][] = [];
  for (let k = 0; k + 1 < us.length; k += 2) {
    if (us[k + 1]! - us[k]! < 1e-6) continue;
    const xy = (u: number): Punto2 => [u * co - c * si, u * si + c * co];
    out.push([xy(us[k]!), xy(us[k + 1]!)]);
  }
  return out;
}

function lunghezza(p: Punto3[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1], p[i]![2] - p[i - 1]![2]);
  return l;
}

function bbox(poli: Punto2[]) {
  const xs = poli.map((p) => p[0]), ys = poli.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/* ------------------------------------------------------------------ */
/* Captazione per corpo                                                */
/* ------------------------------------------------------------------ */

type Ruolo = "piano" | "falda" | "colmo";
interface Linea { punti: Punto3[]; ruolo: Ruolo }

function magliaTettoPiano(c: Corpo, lato: number, dz: number): Punto3[][] {
  const z = (c.quotaBase ?? 0) + c.altezzaGronda + dz;
  const out: Punto3[][] = [];
  // perimetro chiuso
  out.push([...c.impronta, c.impronta[0]!].map(([x, y]) => [x, y, z] as Punto3));
  // orientamento: rettangolo minimo dell'impronta
  const th = (rettangoloMinimo(c.impronta).angolo * Math.PI) / 180;
  for (const ang of [th, th + Math.PI / 2]) {
    const co = Math.cos(ang), si = Math.sin(ang);
    const vs = c.impronta.map(([x, y]) => -x * si + y * co);
    const v0 = Math.min(...vs), v1 = Math.max(...vs);
    const n = Math.ceil((v1 - v0) / lato - 1e-9);
    for (let k = 1; k < n; k++) {
      const cc = v0 + ((v1 - v0) * k) / n;
      for (const [a, b] of trattiInterni(c.impronta, ang, cc)) out.push([[a[0], a[1], z], [b[0], b[1], z]]);
    }
  }
  return out;
}

function captazioneFalde(c: Corpo, lato: number, dz: number): Punto3[][] {
  const base = c.quotaBase ?? 0;
  const g = base + c.altezzaGronda + dz;
  const k = base + (c.altezzaColmo ?? c.altezzaGronda) + dz;
  const b = bbox(c.impronta);
  const lungoX = b.maxX - b.minX >= b.maxY - b.minY;
  const out: Punto3[][] = [];
  out.push([...c.impronta, c.impronta[0]!].map(([x, y]) => [x, y, g] as Punto3)); // gronda
  if (lungoX) {
    const ym = (b.minY + b.maxY) / 2;
    out.push([[b.minX, ym, k], [b.maxX, ym, k]]); // colmo
    const n = Math.max(1, Math.ceil((b.maxX - b.minX) / lato - 1e-9));
    for (let i = 0; i <= n; i++) {
      const x = b.minX + ((b.maxX - b.minX) * i) / n;
      out.push([[x, b.minY, g], [x, ym, k], [x, b.maxY, g]]);
    }
  } else {
    const xm = (b.minX + b.maxX) / 2;
    out.push([[xm, b.minY, k], [xm, b.maxY, k]]);
    const n = Math.max(1, Math.ceil((b.maxY - b.minY) / lato - 1e-9));
    for (let i = 0; i <= n; i++) {
      const y = b.minY + ((b.maxY - b.minY) * i) / n;
      out.push([[b.minX, y, g], [xm, y, k], [b.maxX, y, g]]);
    }
  }
  return out;
}

/** Calate: spigoli + intermedie, distanza ≤ dMax lungo il perimetro, esclusi i lati in comune. */
function proponiCalate(corpi: Corpo[], dMax: number): { punto: Punto2; zTesta: number }[] {
  const out: { punto: Punto2; zTesta: number }[] = [];
  const presente = (p: Punto2) => out.some((q) => Math.hypot(q.punto[0] - p[0], q.punto[1] - p[1]) < 0.5);
  corpi.forEach((c, ci) => {
    const z = (c.quotaBase ?? 0) + c.altezzaGronda;
    const n = c.impronta.length;
    for (let i = 0; i < n; i++) {
      const a = c.impronta[i]!, b = c.impronta[(i + 1) % n]!;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-6) continue;
      // lato in comune con un altro corpo: il punto appena fuori dal lato cade in un altro corpo
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
      const fuori1: Punto2 = [mx + nx * 0.1, my + ny * 0.1], fuori2: Punto2 = [mx - nx * 0.1, my - ny * 0.1];
      const esterno = puntoInPoligono(fuori1[0], fuori1[1], c.impronta) ? fuori2 : fuori1;
      if (corpi.some((o, oi) => oi !== ci && puntoInPoligono(esterno[0], esterno[1], o.impronta))) continue;
      const m = Math.ceil(L / dMax - 1e-9);
      for (let k = 0; k < m; k++) {
        const p: Punto2 = [a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m];
        if (!presente(p)) out.push({ punto: p, zTesta: z });
      }
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Componenti: morsetti agli incroci, supporti lungo i conduttori       */
/* ------------------------------------------------------------------ */

function incrociPianta(segs: [Punto3, Punto3][]): Punto3[] {
  const out: Punto3[] = [];
  const agg = (p: Punto3) => { if (!out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05 && Math.abs(q[2] - p[2]) < 0.3)) out.push(p); };
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [a, b] = segs[i]!, [c, d] = segs[j]!;
    const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) continue; // paralleli
    const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
    const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
    // estremo contro estremo dello stesso conduttore (vertice di una polilinea): non è un incrocio
    const estremoT = t < 1e-6 || t > 1 - 1e-6, estremoU = u < 1e-6 || u > 1 - 1e-6;
    if (estremoT && estremoU && Math.hypot(rx, ry) > 0 && ((t < 1e-6 && u > 1 - 1e-6) || (t > 1 - 1e-6 && u < 1e-6))) continue;
    const z1 = a[2] + (b[2] - a[2]) * t, z2 = c[2] + (d[2] - c[2]) * u;
    if (Math.abs(z1 - z2) > 0.3) continue;
    agg([a[0] + rx * t, a[1] + ry * t, z1]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Proposta                                                             */
/* ------------------------------------------------------------------ */

export function proponiCaptazione(corpi: Corpo[], par: ParametriProposta): PropostaCaptazione {
  const cat = par.catalogo ?? CATALOGO_T1_05;
  const strategia = par.strategia ?? "mista";
  const dz = par.altezzaConduttore ?? 0;
  const avvisi: string[] = [];

  // 1. captazione a maglia
  const linee: Linea[] = [];
  let falde = false;
  if (strategia !== "aste") {
    for (const c of corpi) {
      if (c.tipoTetto === "falde" && c.altezzaColmo != null && c.altezzaColmo > c.altezzaGronda) {
        falde = true;
        // in captazioneFalde la seconda linea è il colmo
        captazioneFalde(c, par.latoMaglia, dz).forEach((punti, i) => linee.push({ punti, ruolo: i === 1 ? "colmo" : "falda" }));
      } else magliaTettoPiano(c, par.latoMaglia, dz).forEach((punti) => linee.push({ punti, ruolo: "piano" }));
    }
  }
  const supFalda = SUPPORTI_FALDA[par.manto ?? "tegole"] ?? SUPPORTI_FALDA["tegole"]!;
  const supCalata = SUPPORTI_CALATA[par.parete ?? "muratura"] ?? SUPPORTI_CALATA["muratura"]!;
  const conduttori: ConduttoreCAD[] = linee.map((l) => ({
    tipo: "captazione", punti: l.punti, materiale: cat.conduttore.materiale, sezione: cat.conduttore.diametroMm, codiceOBO: cat.conduttore.codice,
  }));
  const ruoli: Ruolo[] = linee.map((l) => l.ruolo);

  // 2. verifica e aste dove resta esposto
  const input: InputSfera = { corpi, raggio: par.raggio, conduttori: conduttori.map((c) => ({ punti: c.punti })) };
  let aste: Asta[] = [];
  let sfera = calcolaSferaRotolante(input);
  const parMaglia = { latoMaglia: par.latoMaglia, pendenzaMassima: par.pendenzaMassimaMaglia ?? null, sogliaGradino: 0.5 };
  let combinata = verificaCombinata(sfera, conduttori.length ? verificaMaglia(sfera, input.conduttori!, parMaglia) : null);
  if (combinata.areaEsposta > 0) {
    // le aste servono solo dove la maglia non protegge: si passano al suggeritore solo quelle zone
    const h = par.altezzaAsta ?? 1.5;
    const s = suggerisciAste(input, h, { asteMax: 60 });
    // tiene solo le aste che coprono zone non protette dalla maglia
    aste = s.asteAggiunte.filter((a) => {
      const g = sfera.griglia;
      const i = Math.round((a.x - g.x0) / g.passo), j = Math.round((a.y - g.y0) / g.passo);
      const r = Math.ceil(Math.sqrt(h * (2 * par.raggio - h)) / g.passo);
      for (let jj = j - r; jj <= j + r; jj++) for (let ii = i - r; ii <= i + r; ii++) {
        if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
        if (combinata.stato[jj * g.nx + ii]! === 3) return true;
      }
      return false;
    });
    if (aste.length) {
      sfera = calcolaSferaRotolante({ ...input, aste });
      combinata = verificaCombinata(sfera, conduttori.length ? verificaMaglia(sfera, input.conduttori!, parMaglia) : null);
    }
    if (combinata.areaEsposta > 0) {
      // ultimo tentativo: tutte le aste del suggeritore
      aste = s.asteAggiunte;
      sfera = calcolaSferaRotolante({ ...input, aste });
      combinata = verificaCombinata(sfera, conduttori.length ? verificaMaglia(sfera, input.conduttori!, parMaglia) : null);
    }
    if (combinata.areaEsposta > 0) avvisi.push(`Restano ${combinata.areaEsposta.toFixed(1)} m² esposti: completare a mano`);
  }
  if (combinata.areaPareteEsposta > 0) {
    avvisi.push(`Pareti esposte (${combinata.areaPareteEsposta.toFixed(0)} m²): edificio più alto del raggio della sfera, prevedere captazione in facciata`);
  }

  // 3. calate
  const calate = proponiCalate(corpi, par.distanzaCalate);
  for (const c of calate) {
    conduttori.push({
      tipo: "calata", materiale: cat.conduttore.materiale, sezione: cat.conduttore.diametroMm,
      codiceOBO: supCalata.conduttore?.codice ?? cat.conduttore.codice,
      punti: [[c.punto[0], c.punto[1], c.zTesta + dz], [c.punto[0], c.punto[1], 0]],
    });
  }

  // 4. morsetti: incroci e giunzioni tra conduttori di captazione + attacco delle calate
  const segCapt: [Punto3, Punto3][] = [];
  const ruoloSeg: Ruolo[] = [];
  conduttori.forEach((c, ci) => {
    if (c.tipo !== "captazione") return;
    for (let i = 1; i < c.punti.length; i++) { segCapt.push([c.punti[i - 1]!, c.punti[i]!]); ruoloSeg.push(ruoli[ci]!); }
  });
  const nodi = incrociPianta(segCapt);
  for (const c of calate) {
    const p: Punto3 = [c.punto[0], c.punto[1], c.zTesta + dz];
    if (!nodi.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05)) nodi.push(p);
  }
  const morsetti: ComponenteCAD[] = nodi.map(([x, y, z]) => ({ tipo: "connettore", x, y, z, codiceOBO: cat.connettore.codice }));
  for (const a of aste) {
    morsetti.push({ tipo: "connettore asta", x: a.x, y: a.y, z: a.zBase ?? 0, codiceOBO: cat.connettore.codice });
  }

  // 5. supporti lungo i conduttori di captazione (passo ≤ passoMax, non sui morsetti)
  const supporti: ComponenteCAD[] = [];
  const supportoDi = (r: Ruolo): { codice: string; passoMax: number | null } | null =>
    r === "colmo" ? supFalda.colmo : r === "falda" ? supFalda.falda : cat.supporto;
  const occupato = (x: number, y: number, z: number) =>
    morsetti.some((m) => Math.hypot(m.x - x, m.y - y) < 0.15 && Math.abs(m.z - z) < 0.3) ||
    supporti.some((s) => Math.hypot(s.x - x, s.y - y) < 0.15 && Math.abs(s.z - z) < 0.3);
  segCapt.forEach(([a, b], si) => {
    const sup = supportoDi(ruoloSeg[si]!);
    if (!sup || !sup.passoMax) return;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(L / sup.passoMax - 1e-9));
    const rot = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
      if (!occupato(x, y, z)) supporti.push({ tipo: ruoloSeg[si]! === "piano" ? "supporto" : `supporto ${ruoloSeg[si]!}`, x, y, z, rotazione: rot, codiceOBO: sup.codice });
    }
  });

  // 5b. supporti delle calate (T4): dal primo metro sotto la gronda fino a terra, passo ≤ passoMax
  if (supCalata.passoMax) {
    for (const c of conduttori) {
      if (c.tipo !== "calata") continue;
      const top = c.punti[0]!, bot = c.punti[c.punti.length - 1]!;
      const L = top[2] - bot[2];
      const n = Math.max(1, Math.ceil(L / supCalata.passoMax - 1e-9));
      for (let k = 1; k <= n; k++) {
        supporti.push({ tipo: "supporto calata", x: top[0], y: top[1], z: top[2] - (L * k) / n, codiceOBO: supCalata.codice });
      }
    }
  }

  // 6. compensatori di dilatazione (T1.04): su ogni conduttore di captazione, a intervalli
  //    uguali non superiori al passo del materiale
  const compensatori: ComponenteCAD[] = [];
  const ogni = cat.compensatore?.ogni ?? null;
  if (cat.compensatore && ogni) {
    for (const c of conduttori) {
      if (c.tipo !== "captazione") continue;
      const L = lunghezza(c.punti);
      const n = Math.ceil(L / ogni - 1e-9);
      for (let k = 1; k < n; k++) {
        const target = (L * k) / n;
        let acc = 0;
        for (let i = 1; i < c.punti.length; i++) {
          const a = c.punti[i - 1]!, b = c.punti[i]!;
          const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          if (acc + l >= target - 1e-9) {
            const f = l > 0 ? (target - acc) / l : 0;
            compensatori.push({
              tipo: "compensatore", x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, z: a[2] + (b[2] - a[2]) * f,
              rotazione: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI, codiceOBO: cat.compensatore.codice,
            });
            break;
          }
          acc += l;
        }
      }
    }
  } else if (cat.compensatore) {
    avvisi.push(`Compensatori di dilatazione (${cat.compensatore.codice}) non posati: indicare ogni quanti metri`);
  }

  // 7. distinta per codice
  const descr = new Map<string, { d: string; rif?: string }>();
  descr.set(cat.conduttore.codice, { d: cat.conduttore.descrizione, rif: cat.riferimento });
  if (cat.supporto) descr.set(cat.supporto.codice, { d: cat.supporto.descrizione, rif: cat.riferimento });
  descr.set(cat.connettore.codice, { d: cat.connettore.descrizione, rif: cat.riferimento });
  if (cat.compensatore) descr.set(cat.compensatore.codice, { d: cat.compensatore.descrizione, rif: "OBO-TBS-250-T1.04" });
  if (falde) for (const s of [supFalda.falda, supFalda.colmo]) descr.set(s.codice, { d: s.descrizione, rif: s.riferimento });
  if (supCalata.codice) descr.set(supCalata.codice, { d: supCalata.descrizione, rif: supCalata.riferimento });
  if (supCalata.conduttore) descr.set(supCalata.conduttore.codice, { d: supCalata.conduttore.descrizione, rif: supCalata.riferimento });
  const tab = new Map<string, VoceDistinta>();
  const somma = (codice: string | undefined, q: number, unita: "m" | "pz", d?: string, rif?: string) => {
    if (!codice) return;
    const v = tab.get(codice);
    if (v) v.quantita += q;
    else tab.set(codice, { codice, descrizione: d ?? descr.get(codice)?.d ?? "", quantita: q, unita, riferimento: rif ?? descr.get(codice)?.rif });
  };
  for (const c of conduttori) somma(c.codiceOBO, lunghezza(c.punti), "m");
  for (const s of supporti) somma(s.codiceOBO, 1, "pz");
  for (const m of morsetti) somma(m.codiceOBO, 1, "pz");
  for (const k of compensatori) somma(k.codiceOBO, 1, "pz");
  const nSupCalate = supporti.filter((s) => s.tipo === "supporto calata").length;
  for (const a of supCalata.accessori ?? []) somma(a.codice, a.quantita * nSupCalate, "pz", a.descrizione, supCalata.riferimento);
  const distinta = [...tab.values()].map((v) => ({ ...v, quantita: v.unita === "m" ? Math.round(v.quantita * 100) / 100 : v.quantita }))
    .sort((a, b) => a.codice.localeCompare(b.codice));

  const astecad: AstaCAD[] = aste.map((a, k) => ({
    id: a.id ?? `A${k + 1}`, x: a.x, y: a.y, z: a.zBase, altezza: a.altezza, codiceOBO: cat.asta?.codice, origine: "proposta",
  }));
  const metri = (t: string) => conduttori.filter((c) => c.tipo === t).reduce((s, c) => s + lunghezza(c.punti), 0);
  return {
    conduttori, aste: astecad, supporti, morsetti, compensatori, sfera, combinata, distinta,
    riepilogo: {
      metriCaptazione: metri("captazione"), metriCalate: metri("calata"), numeroCalate: calate.length,
      aste: astecad.length, supporti: supporti.length, morsetti: morsetti.length,
      compensatori: compensatori.length, particolare: cat.riferimento,
    },
    avvisi,
  };
}
