/**
 * Esportazione verso ZWCAD / AutoCAD: file "progetto.lpsdati" letto dal comando LPS-IMPORTA di LPS.lsp.
 *
 * Formato: un record LISP per riga, letto dal CAD con la funzione nativa (read).
 * Coordinate in metri (il LISP converte nelle unità del disegno). Testi solo ASCII
 * (accenti tolti), così ZWCAD e AutoCAD li leggono uguali qualunque sia la codifica.
 *
 *   (LPSDATI 1)
 *   (PROGETTO "codice" "nome" "comune" "LPL" raggio)
 *   (CORPO "id" "nome" quotaBase altezzaGronda "piano|falde|altro" colmo|nil ((x y) ...))
 *   (ASTA "id" x y zBase altezza diametro "codice" "origine")
 *   (CONDUTTORE "captazione|calata|terra|anello" "materiale" sezione "codice" ((x y z) ...))
 *   (SUPPORTO "tipo" x y z rotazioneGradi "codice")
 *   (MORSETTO "tipo" x y z rotazioneGradi "codice")
 *   (PICCHETTO "id" x y zTesta lunghezza diametro "codice")
 *   (ESPOSTA "LPL" x0 x1 y z passo)              ; tratto di copertura esposta (riga di celle)
 *   (PARETE "LPL" x y nx ny zDa zA larghezza)    ; faccia di parete esposta
 */

import type { Corpo, Punto3, RisultatoSfera } from "../captazione/sferaRotolante";
import type { RisultatoCombinato } from "../captazione/verificaMaglia";

export interface AstaCAD { id?: string | undefined; x: number; y: number; z?: number | undefined; altezza: number; diametro?: number | undefined; codiceOBO?: string | undefined; origine?: string | undefined }
export interface ConduttoreCAD { tipo: string; punti: Punto3[]; materiale?: string | undefined; sezione?: number | undefined; codiceOBO?: string | undefined }
export interface ComponenteCAD { tipo?: string | undefined; x: number; y: number; z: number; rotazione?: number | undefined; codiceOBO?: string | undefined }
export interface PicchettoCAD { id?: string | undefined; x: number; y: number; z?: number | undefined; lunghezza: number; diametro?: number | undefined; codiceOBO?: string | undefined }

export interface ProgettoCAD {
  progetto: { codice?: string; nome?: string; comune?: string; lpl?: string; raggio?: number };
  edificio: { corpi: Corpo[] };
  aste?: AstaCAD[] | undefined;
  conduttori?: ConduttoreCAD[] | undefined;
  supporti?: ComponenteCAD[] | undefined;
  morsetti?: ComponenteCAD[] | undefined;
  picchetti?: PicchettoCAD[] | undefined;
}

/** Stringa LISP sicura: solo ASCII, niente virgolette doppie né barre rovesciate. */
export function testoLisp(v: unknown): string {
  const s = String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[“”«»]/g, "'")
    .replace(/["]/g, "'")
    .replace(/\\/g, "/")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7e]/g, "?");
  return `"${s}"`;
}

/** Numero LISP: punto decimale, 4 decimali, mai notazione esponenziale. */
export function numeroLisp(v: number | null | undefined, decimali = 4): string {
  if (v == null || !Number.isFinite(v)) return "nil";
  const t = v.toFixed(decimali);
  return t === "-0" || /^-0\.0+$/.test(t) ? (0).toFixed(decimali) : t;
}

const P2 = (p: [number, number]) => `(${numeroLisp(p[0])} ${numeroLisp(p[1])})`;
const P3 = (p: Punto3) => `(${numeroLisp(p[0])} ${numeroLisp(p[1])} ${numeroLisp(p[2])})`;

/**
 * Zone esposte da disegnare. Con 'combinata' si esporta l'esito della verifica combinata
 * (sfera + maglia): una zona protetta dalla maglia NON è esposta. Senza, vale la sola sfera.
 */
export interface ZoneEsposte { lpl: string; risultato: RisultatoSfera; combinata?: RisultatoCombinato | null | undefined }

export function generaFileCAD(pr: ProgettoCAD, esposte: ZoneEsposte[] = []): string {
  const r: string[] = [];
  const p = pr.progetto;
  r.push(";; Progettazione LPS - dati per LPS.lsp (ZWCAD / AutoCAD) - coordinate in metri");
  r.push("(LPSDATI 1)");
  r.push(`(PROGETTO ${testoLisp(p.codice)} ${testoLisp(p.nome)} ${testoLisp(p.comune)} ${testoLisp(p.lpl)} ${numeroLisp(p.raggio ?? null)})`);
  pr.edificio.corpi.forEach((c, k) => {
    const colmo = c.tipoTetto === "falde" && c.altezzaColmo != null ? numeroLisp(c.altezzaColmo) : "nil";
    r.push(`(CORPO ${testoLisp(c.id || `C${k + 1}`)} ${testoLisp(c.nome || c.id || `Corpo ${k + 1}`)} ${numeroLisp(c.quotaBase ?? 0)} ${numeroLisp(c.altezzaGronda)} ${testoLisp(c.tipoTetto || "piano")} ${colmo} (${c.impronta.map(P2).join(" ")}))`);
  });
  (pr.aste ?? []).forEach((a, k) => {
    r.push(`(ASTA ${testoLisp(a.id || `A${k + 1}`)} ${numeroLisp(a.x)} ${numeroLisp(a.y)} ${numeroLisp(a.z ?? null)} ${numeroLisp(a.altezza)} ${numeroLisp(a.diametro ?? 0.016)} ${testoLisp(a.codiceOBO)} ${testoLisp(a.origine || "progetto")})`);
  });
  for (const c of pr.conduttori ?? []) {
    if (c.punti.length < 2) continue;
    r.push(`(CONDUTTORE ${testoLisp(c.tipo)} ${testoLisp(c.materiale)} ${numeroLisp(c.sezione ?? null, 2)} ${testoLisp(c.codiceOBO)} (${c.punti.map(P3).join(" ")}))`);
  }
  for (const [nome, lista] of [["SUPPORTO", pr.supporti ?? []], ["MORSETTO", pr.morsetti ?? []]] as const) {
    for (const s of lista) {
      r.push(`(${nome} ${testoLisp(s.tipo)} ${numeroLisp(s.x)} ${numeroLisp(s.y)} ${numeroLisp(s.z)} ${numeroLisp(s.rotazione ?? 0, 2)} ${testoLisp(s.codiceOBO)})`);
    }
  }
  (pr.picchetti ?? []).forEach((q, k) => {
    r.push(`(PICCHETTO ${testoLisp(q.id || `P${k + 1}`)} ${numeroLisp(q.x)} ${numeroLisp(q.y)} ${numeroLisp(q.z ?? 0)} ${numeroLisp(q.lunghezza)} ${numeroLisp(q.diametro ?? 0.02)} ${testoLisp(q.codiceOBO)})`);
  });
  // zone esposte: righe di celle consecutive unite in un unico tratto
  for (const { lpl, risultato: ris, combinata } of esposte) {
    const g = ris.griglia;
    const esp = (k: number) => (combinata ? combinata.stato[k]! === 3 : ris.esposta[k]! === 1);
    for (let j = 0; j < g.ny; j++) {
      let i = 0;
      while (i < g.nx) {
        const k = j * g.nx + i;
        if (!esp(k)) { i++; continue; }
        const z = ris.altezze[k]!;
        let i1 = i;
        while (i1 + 1 < g.nx && esp(k + (i1 + 1 - i)) && Math.abs(ris.altezze[k + (i1 + 1 - i)]! - z) < 0.05) i1++;
        r.push(`(ESPOSTA ${testoLisp(lpl)} ${numeroLisp(g.x0 + i * g.passo)} ${numeroLisp(g.x0 + i1 * g.passo)} ${numeroLisp(g.y0 + j * g.passo)} ${numeroLisp(z)} ${numeroLisp(g.passo)})`);
        i = i1 + 1;
      }
    }
    for (const f of ris.facceEsposte) {
      r.push(`(PARETE ${testoLisp(lpl)} ${numeroLisp(f.x)} ${numeroLisp(f.y)} ${f.normale[0]} ${f.normale[1]} ${numeroLisp(f.zDa)} ${numeroLisp(f.zA)} ${numeroLisp(g.passo)})`);
    }
  }
  return r.join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ */
/* Ritorno dal CAD: edificio_da_CAD.json scritto da LPS-ESPORTA         */
/* ------------------------------------------------------------------ */

export interface EdificioDaCAD {
  versione: string;
  unita: "m";
  corpi: Corpo[];
}

/** Legge e controlla il file scritto da LPS-ESPORTA. Lancia un errore leggibile se non valido. */
export function leggiEdificioDaCAD(testo: string): EdificioDaCAD {
  let d: unknown;
  try { d = JSON.parse(testo); } catch { throw new Error("Il file non è un JSON valido"); }
  const o = d as Partial<EdificioDaCAD>;
  if (!o || !Array.isArray(o.corpi)) throw new Error("Nel file manca l'elenco dei corpi");
  o.corpi.forEach((c, k) => {
    if (!Array.isArray(c.impronta) || c.impronta.length < 3) throw new Error(`Corpo ${k + 1}: impronta non valida`);
    if (!(typeof c.altezzaGronda === "number" && c.altezzaGronda > 0)) throw new Error(`Corpo ${k + 1}: altezza non valida`);
  });
  return { versione: String(o.versione ?? "1"), unita: "m", corpi: o.corpi };
}
