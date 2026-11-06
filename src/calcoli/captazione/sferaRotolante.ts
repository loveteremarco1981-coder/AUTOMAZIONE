/**
 * Motore della sfera rotolante – CEI EN IEC 62305-3:2024 (metodo della sfera rotolante)
 *
 * Funzioni pure, senza dipendenze, eseguibili in un Web Worker.
 * Unità: metri. Asse z verso l'alto, quota 0 = terreno.
 *
 * Metodo
 * 1. Gli edifici vengono rasterizzati in una mappa di altezze h (passo = passo di calcolo).
 * 2. Si calcola la superficie C dei centri della sfera (la quota più bassa che può avere il
 *    centro sopra ogni punto senza penetrare edificio, terreno o captatori). È una dilatazione
 *    con una semisfera di raggio r, calcolata in modo esatto:
 *      - terreno:            C >= r
 *      - coperture:          per ogni livello di quota Hk, C >= Hk + sqrt(r² − dk²),
 *                            con dk = distanza euclidea esatta dalle celle di quota Hk
 *      - aste e conduttori:  contributo analitico con la distanza reale (non rasterizzati)
 * 3. L'inviluppo inferiore delle sfere (E) è l'erosione di C con la stessa semisfera:
 *      E(p) = min_c [ C(c) − sqrt(r² − |c − p|²) ]
 *    Un punto della superficie è toccato dalla sfera se la sua quota è >= E − tolleranza.
 * 4. Coperture: cella esposta se E − h <= tolleranza e non è occupata da un captatore.
 *    Pareti: una sfera tocca una parete verticale solo in tangenza (centro a distanza r):
 *    la parte di parete sopra il centro più basso possibile è esposta (fulminazioni laterali).
 *
 * Precisione
 * I nodi della griglia danno una prima stima; nelle celle vicine alla soglia protetto/esposto
 * il punto di contatto viene cercato sulla superficie esatta dei centri (aste e conduttori
 * analitici). Errore residuo verificato con i casi analitici: < 1 cm.
 *
 * Limiti noti (da riportare in relazione)
 * - Le coperture sono modellate come mappa di altezze: niente sbalzi o aggetti.
 * - Le quote delle coperture sono arrotondate per difetto a 'quantizzazioneQuote' (default 5 cm),
 *   cioè a favore di sicurezza.
 * - Con tetto piano e conduttori di captazione appoggiati, la sfera tocca la copertura tra i
 *   conduttori (penetrazione p). È corretto: in quel caso la verifica è il metodo della maglia.
 */

export type Punto2 = [number, number];
export type Punto3 = [number, number, number];

export interface Corpo {
  id: string;
  nome?: string | undefined;
  impronta: Punto2[];          // poligono in pianta, metri
  quotaBase?: number | undefined;          // default 0
  altezzaGronda: number;       // altezza della gronda rispetto a quotaBase
  tipoTetto?: "piano" | "falde" | "altro" | undefined;
  altezzaColmo?: number | undefined;       // solo "falde": altezza del colmo rispetto a quotaBase
}

export interface Asta {
  id?: string | undefined;
  x: number;
  y: number;
  altezza: number;             // altezza dell'asta sopra l'appoggio
  zBase?: number | undefined;              // quota dell'appoggio; se assente = copertura in (x, y)
}

export interface Conduttore {
  id?: string | undefined;
  punti: Punto3[];             // polilinea 3D (quote assolute)
}

/**
 * Modello 3D importato (IFC, glTF, OBJ…) come elenco di triangoli in metri, quote assolute:
 * [x1, y1, z1, x2, y2, z2, x3, y3, z3, x1', …]. Della mesh si usa la superficie superiore
 * (coperture, parapetti, volumi tecnici); pareti verticali e solai interni sono ignorati.
 */
export interface Superficie {
  id: string;
  nome?: string | undefined;
  triangoli: ArrayLike<number>;
}

export interface InputSfera {
  corpi: Corpo[];
  superfici?: Superficie[] | undefined;    // modelli 3D importati (in aggiunta o in alternativa ai corpi)
  aste?: Asta[] | undefined;
  conduttori?: Conduttore[] | undefined;
  raggio: number;              // raggio della sfera (m) – dal JSON parametriLPL
  passo?: number | undefined;              // passo di calcolo (m); se assente viene scelto in automatico
  passoMinimo?: number | undefined;        // default 0.25 m
  celleMaxEdificio?: number | undefined;   // limite per la scelta automatica del passo, default 40000
  tolleranza?: number | undefined;         // default 0.01 m
  quantizzazioneQuote?: number | undefined;// default 0.05 m
}

export interface FacciaEsposta {
  corpo: number;               // indice del corpo (dopo i corpi: superfici 3D, in ordine)
  lato: number;                // indice del lato dell'impronta (−1 per le superfici 3D)
  x: number;                   // punto della faccia in pianta
  y: number;
  normale: Punto2;             // verso l'esterno
  zDa: number;                 // parte esposta della parete: da zDa ...
  zA: number;                  // ... a zA
  lunghezza: number;           // larghezza equivalente della faccia sul lato reale (m)
}

export interface Griglia {
  x0: number;                  // coordinate del centro della cella (0,0)
  y0: number;
  passo: number;
  nx: number;
  ny: number;
}

export interface RisultatoSfera {
  raggio: number;
  griglia: Griglia;
  modello: Modello;            // dati interni per le verifiche puntuali
  altezze: Float32Array;       // h per cella (0 = terreno)
  corpoCella: Int16Array;      // indice del corpo per cella (dopo i corpi: superfici 3D), -1 = terreno
  captatoreCella: Uint8Array;  // 1 = cella occupata da un captatore
  centri: Float32Array;        // C: quota minima del centro sfera
  inviluppo: Float32Array;     // E sulle celle di copertura (NaN altrove)
  esposta: Uint8Array;         // 1 = copertura esposta, 2 = protetta, 0 = non copertura
  facceEsposte: FacciaEsposta[];
  areaCopertura: number;       // m²
  areaCoperturaEsposta: number;// m²
  areaPareteEsposta: number;   // m²
  esito: "adeguata" | "non adeguata";
  avvisi: string[];
  tempoMs: number;
}

/* ------------------------------------------------------------------ */
/* Geometria                                                           */
/* ------------------------------------------------------------------ */

export function puntoInPoligono(x: number, y: number, poli: Punto2[]): boolean {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i]!;
    const [xj, yj] = poli[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function distanzaDalContorno(x: number, y: number, poli: Punto2[]): number {
  let d = Infinity;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [ax, ay] = poli[j]!;
    const [bx, by] = poli[i]!;
    const vx = bx - ax, vy = by - ay;
    const l2 = vx * vx + vy * vy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)) : 0;
    d = Math.min(d, Math.hypot(x - ax - t * vx, y - ay - t * vy));
  }
  return d;
}

/** Lato del poligono più vicino al punto: indice e coseni direttori. */
function latoPiuVicino(x: number, y: number, poli: Punto2[]): { lato: number; ux: number; uy: number } {
  let best = Infinity, lato = 0, ux = 1, uy = 0;
  for (let i = 0; i < poli.length; i++) {
    const [ax, ay] = poli[i]!;
    const [bx, by] = poli[(i + 1) % poli.length]!;
    const vx = bx - ax, vy = by - ay;
    const l2 = vx * vx + vy * vy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)) : 0;
    const d = Math.hypot(x - ax - t * vx, y - ay - t * vy);
    if (d < best) { best = d; lato = i; const L = Math.sqrt(l2) || 1; ux = vx / L; uy = vy / L; }
  }
  return { lato, ux, uy };
}

function areaPoligono(poli: Punto2[]): number {
  let a = 0;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    a += poli[j]![0] * poli[i]![1] - poli[i]![0] * poli[j]![1];
  }
  return Math.abs(a) / 2;
}

function bboxPoligono(poli: Punto2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poli) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Quota della copertura di un corpo nel punto (x, y), oppure -Infinity se fuori. */
export function quotaCopertura(c: Corpo, x: number, y: number, verificaInterno = true): number {
  if (verificaInterno && !puntoInPoligono(x, y, c.impronta)) return -Infinity;
  const base = c.quotaBase ?? 0;
  const gronda = base + c.altezzaGronda;
  if (c.tipoTetto !== "falde" || c.altezzaColmo == null || c.altezzaColmo <= c.altezzaGronda) {
    return gronda;
  }
  // Tetto a due falde: colmo parallelo al lato lungo del rettangolo circoscritto, in mezzeria.
  const b = bboxPoligono(c.impronta);
  const lx = b.maxX - b.minX;
  const ly = b.maxY - b.minY;
  const colmo = base + c.altezzaColmo;
  const t = lx >= ly
    ? Math.abs(y - (b.minY + b.maxY) / 2) / (ly / 2)
    : Math.abs(x - (b.minX + b.maxX) / 2) / (lx / 2);
  return colmo - (colmo - gronda) * Math.min(1, t);
}

/**
 * Quota di appoggio in (x, y): copertura più alta che contiene il punto, contorno compreso
 * (un'asta su uno spigolo appoggia sul tetto, non a terra). 0 se fuori da tutti i corpi.
 */
export function quotaAppoggio(corpi: Corpo[], x: number, y: number, tolleranza = 0.01): number {
  let z = 0;
  for (const c of corpi) {
    if (puntoInPoligono(x, y, c.impronta) || distanzaDalContorno(x, y, c.impronta) <= tolleranza) {
      z = Math.max(z, quotaCopertura(c, x, y, false));
    }
  }
  return z;
}

/* ------------------------------------------------------------------ */
/* Trasformata della distanza euclidea esatta (Felzenszwalb–Huttenlocher) */
/* ------------------------------------------------------------------ */

const INF = 1e20;

function dt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const dq = q - v[k]!;
    d[q] = dq * dq + f[v[k]!]!;
  }
}

/**
 * Trasformata della distanza con la cella sorgente più vicina.
 * d2: distanza al quadrato in celle; src: indice della cella sorgente (−1 se nessuna).
 */
export function trasformataDistanza(sorgente: Uint8Array, nx: number, ny: number) {
  const n = Math.max(nx, ny);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const arg = new Int32Array(n);
  const N = nx * ny;
  const tmp = new Float64Array(N);
  const riga = new Int32Array(N);
  const d2 = new Float64Array(N);
  const src = new Int32Array(N).fill(-1);
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) f[y] = sorgente[y * nx + x]! ? 0 : INF;
    dt1dArg(f, ny, d, v, z, arg);
    for (let y = 0; y < ny; y++) { tmp[y * nx + x] = d[y]!; riga[y * nx + x] = arg[y]!; }
  }
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) f[x] = tmp[y * nx + x]!;
    dt1dArg(f, nx, d, v, z, arg);
    for (let x = 0; x < nx; x++) {
      d2[y * nx + x] = d[x]!;
      if (d[x]! < INF / 2) src[y * nx + x] = riga[y * nx + arg[x]!]! * nx + arg[x]!;
    }
  }
  return { d2, src };
}

function dt1dArg(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array, arg: Int32Array) {
  dt1d(f, n, d, v, z);
  // ricostruisce l'argomento del minimo (dt1d lascia in v/z l'inviluppo delle parabole)
  let k = 0;
  let kMax = 0;
  while (kMax + 1 < n && z[kMax + 1]! < INF) kMax++;
  for (let q = 0; q < n; q++) {
    while (k < kMax && z[k + 1]! < q) k++;
    arg[q] = v[k]!;
  }
}

/** Distanza al quadrato (in celle) dalla cella "sorgente" più vicina. */
export function distanzaQuadra(sorgente: Uint8Array, nx: number, ny: number): Float64Array {
  return trasformataDistanza(sorgente, nx, ny).d2;
}

/* ------------------------------------------------------------------ */
/* Modello e superficie dei centri                                     */
/* ------------------------------------------------------------------ */

/** Dati interni del calcolo, restituiti nel risultato per le verifiche puntuali. */
export interface Modello {
  r: number;
  g: Griglia;
  h: Float32Array;
  C: Float32Array;          // superficie dei centri sui nodi (coperture + aste + conduttori)
  srcCella: Int32Array;     // per ogni nodo: cella di copertura che determina C (−1 = terreno)
  srcQuota: Float32Array;   // quota di quella cella
  punte: Float64Array;      // aste: x, y, zPunta
  segmenti: Float64Array;   // conduttori: ax, ay, az, bx, by, bz
}

/**
 * Superficie dei centri in un punto qualsiasi, valutata in modo esatto:
 * coperture (dalle celle sorgente dei nodi vicini), aste e conduttori analitici.
 */
export function centroMinimo(m: Modello, x: number, y: number): number {
  const { r, g } = m;
  const r2 = r * r;
  let v = r; // terreno
  const ic = Math.round((x - g.x0) / g.passo);
  const jc = Math.round((y - g.y0) / g.passo);
  for (let j = jc - 1; j <= jc + 1; j++) {
    if (j < 0 || j >= g.ny) continue;
    for (let i = ic - 1; i <= ic + 1; i++) {
      if (i < 0 || i >= g.nx) continue;
      const nodo = j * g.nx + i;
      const sc = m.srcCella[nodo]!;
      if (sc < 0) continue;
      const sx = g.x0 + (sc % g.nx) * g.passo;
      const sy = g.y0 + Math.floor(sc / g.nx) * g.passo;
      const d2 = (x - sx) ** 2 + (y - sy) ** 2;
      if (d2 < r2) {
        const val = m.srcQuota[nodo]! + Math.sqrt(r2 - d2);
        if (val > v) v = val;
      }
    }
  }
  const P = m.punte;
  for (let k = 0; k < P.length; k += 3) {
    const d2 = (x - P[k]!) ** 2 + (y - P[k + 1]!) ** 2;
    if (d2 < r2) {
      const val = P[k + 2]! + Math.sqrt(r2 - d2);
      if (val > v) v = val;
    }
  }
  const S = m.segmenti;
  for (let k = 0; k < S.length; k += 6) {
    const ax = S[k]!, ay = S[k + 1]!, az = S[k + 2]!, bx = S[k + 3]!, by = S[k + 4]!, bz = S[k + 5]!;
    // scarto rapido sul riquadro
    if (x < Math.min(ax, bx) - r || x > Math.max(ax, bx) + r || y < Math.min(ay, by) - r || y > Math.max(ay, by) + r) continue;
    const vx = bx - ax, vy = by - ay, wx = ax - x, wy = ay - y;
    const A = vx * vx + vy * vy, B = 2 * (wx * vx + wy * vy), Cq = wx * wx + wy * wy - r2;
    let t0 = 0, t1 = 1;
    if (A < 1e-12) {
      if (Cq >= 0) continue;
    } else {
      const disc = B * B - 4 * A * Cq;
      if (disc <= 0) continue;
      const sq = Math.sqrt(disc);
      t0 = Math.max(0, (-B - sq) / (2 * A));
      t1 = Math.min(1, (-B + sq) / (2 * A));
      if (t0 >= t1) continue;
    }
    // funzione concava in t: ricerca della sezione aurea
    const phi = (t: number) => {
      const q = r2 - ((wx + t * vx) ** 2 + (wy + t * vy) ** 2);
      return az + t * (bz - az) + Math.sqrt(Math.max(0, q));
    };
    let lo = t0, hi = t1;
    const gr = 0.6180339887;
    let c1 = hi - gr * (hi - lo), c2 = lo + gr * (hi - lo);
    let f1 = phi(c1), f2 = phi(c2);
    for (let it = 0; it < 40 && hi - lo > 1e-6; it++) {
      if (f1 < f2) { lo = c1; c1 = c2; f1 = f2; c2 = lo + gr * (hi - lo); f2 = phi(c2); }
      else { hi = c2; c2 = c1; f2 = f1; c1 = hi - gr * (hi - lo); f1 = phi(c1); }
    }
    const val = Math.max(f1, f2, phi(t0), phi(t1));
    if (val > v) v = val;
  }
  return v;
}

const DIREZIONI: [number, number][] = Array.from({ length: 16 }, (_, k) => [
  Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8),
]);

/**
 * Affinamento: partendo dal miglior nodo della griglia cerca, con una ricerca a pattern
 * sulla superficie esatta dei centri, la sfera che scende più in basso sul punto (px, py).
 */
function affina(m: Modello, px: number, py: number, cx: number, cy: number): number {
  const r2 = m.r * m.r;
  const g = (x: number, y: number) => {
    const d2 = (x - px) ** 2 + (y - py) ** 2;
    if (d2 >= r2) return Infinity;
    return centroMinimo(m, x, y) - Math.sqrt(r2 - d2);
  };
  let best = g(cx, cy);
  let passo = m.g.passo / 2;
  while (passo > m.g.passo / 512) {
    let bv = best, bx = cx, by = cy;
    for (const [dx, dy] of DIREZIONI) {
      const v = g(cx + dx * passo, cy + dy * passo);
      if (v < bv - 1e-9) { bv = v; bx = cx + dx * passo; by = cy + dy * passo; }
    }
    if (bv < best) { best = bv; cx = bx; cy = by; } else passo /= 2;
  }
  return best;
}

/** Inviluppo sul nodo (i, j) con il kernel ordinato; restituisce valore e nodo del minimo. */
interface Kernel { di: Int32Array; dj: Int32Array; sq: Float64Array; n: number }

function costruisciKernel(r: number, s: number): Kernel {
  const R = Math.floor(r / s);
  const r2 = r * r;
  const tmp: [number, number, number][] = [];
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    const d2 = (di * di + dj * dj) * s * s;
    if (d2 < r2) tmp.push([d2, di, dj]);
  }
  tmp.sort((a, b) => a[0] - b[0]);
  const n = tmp.length;
  const K: Kernel = { di: new Int32Array(n), dj: new Int32Array(n), sq: new Float64Array(n), n };
  tmp.forEach(([d2, di, dj], k) => { K.di[k] = di; K.dj[k] = dj; K.sq[k] = Math.sqrt(r2 - d2); });
  return K;
}

function inviluppoNodo(m: Modello, K: Kernel, i: number, j: number, soglia: number): [number, number] {
  const g = m.g;
  let e = Infinity, arg = -1;
  for (let k = 0; k < K.n; k++) {
    const ii = i + K.di[k]!, jj = j + K.dj[k]!;
    if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
    const v = m.C[jj * g.nx + ii]! - K.sq[k]!;
    if (v < e) { e = v; arg = jj * g.nx + ii; if (e <= soglia) break; }
  }
  return [e, arg];
}

function inviluppoPuntoLibero(m: Modello, px: number, py: number): number {
  const { r, g } = m;
  const r2 = r * r;
  const i0 = Math.max(0, Math.ceil((px - r - g.x0) / g.passo));
  const i1 = Math.min(g.nx - 1, Math.floor((px + r - g.x0) / g.passo));
  const j0 = Math.max(0, Math.ceil((py - r - g.y0) / g.passo));
  const j1 = Math.min(g.ny - 1, Math.floor((py + r - g.y0) / g.passo));
  let e = Infinity, bx = px, by = py;
  for (let j = j0; j <= j1; j++) {
    const dy = g.y0 + j * g.passo - py;
    for (let i = i0; i <= i1; i++) {
      const dx = g.x0 + i * g.passo - px;
      const q = r2 - dx * dx - dy * dy;
      if (q <= 0) continue;
      const v = m.C[j * g.nx + i]! - Math.sqrt(q);
      if (v < e) { e = v; bx = px + dx; by = py + dy; }
    }
  }
  return Math.min(e, affina(m, px, py, bx, by));
}

/* ------------------------------------------------------------------ */
/* Motore                                                              */
/* ------------------------------------------------------------------ */

/** Quote fino a 5 cm sono considerate terreno (piani di posa, marciapiedi dei modelli 3D). */
const Z_TERRENO = 0.05;

function scegliPasso(inp: InputSfera, areaEdifici: number): number {
  if (inp.passo && inp.passo > 0) return inp.passo;
  const minimo = inp.passoMinimo ?? 0.25;
  const celleMax = inp.celleMaxEdificio ?? 40000;
  let s = Math.max(minimo, inp.raggio / 50);
  if (areaEdifici / (s * s) > celleMax) s = Math.sqrt(areaEdifici / celleMax);
  return Math.round(s * 100) / 100;
}

export function calcolaSferaRotolante(inp: InputSfera): RisultatoSfera {
  const t0 = Date.now();
  const avvisi: string[] = [];
  const r = inp.raggio;
  if (!(r > 0)) throw new Error("Raggio della sfera non valido");
  const superfici = inp.superfici ?? [];
  if (!inp.corpi.length && !superfici.length) throw new Error("Nessun corpo di fabbrica");
  const tol = inp.tolleranza ?? 0.01;
  const qz = inp.quantizzazioneQuote ?? 0.05;

  // Estensione del modello
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let areaEdifici = 0;
  for (const c of inp.corpi) {
    if (c.impronta.length < 3) throw new Error(`Corpo ${c.id}: impronta con meno di 3 vertici`);
    const b = bboxPoligono(c.impronta);
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    areaEdifici += areaPoligono(c.impronta);
  }
  for (const sup of superfici) {
    const T = sup.triangoli;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (let k = 0; k + 2 < T.length; k += 3) {
      if (T[k + 2]! <= Z_TERRENO) continue;
      a = Math.min(a, T[k]!); b = Math.min(b, T[k + 1]!);
      c = Math.max(c, T[k]!); d = Math.max(d, T[k + 1]!);
    }
    if (a === Infinity) continue;
    minX = Math.min(minX, a); minY = Math.min(minY, b);
    maxX = Math.max(maxX, c); maxY = Math.max(maxY, d);
    areaEdifici += (c - a) * (d - b); // stima per la scelta del passo
  }
  if (minX === Infinity) throw new Error("Il modello non ha superfici sopra il terreno");
  for (const a of inp.aste ?? []) {
    minX = Math.min(minX, a.x); minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x); maxY = Math.max(maxY, a.y);
  }
  for (const k of inp.conduttori ?? []) for (const [x, y] of k.punti) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }

  const s = scegliPasso(inp, areaEdifici);
  const margine = r + 2 * s;
  const g: Griglia = {
    x0: minX - margine,
    y0: minY - margine,
    passo: s,
    nx: Math.ceil((maxX - minX + 2 * margine) / s) + 1,
    ny: Math.ceil((maxY - minY + 2 * margine) / s) + 1,
  };
  const N = g.nx * g.ny;
  if (N > 4_000_000) throw new Error("Modello troppo grande: aumentare il passo di calcolo");

  // 1. Rasterizzazione delle coperture
  const h = new Float32Array(N);
  const corpoCella = new Int16Array(N).fill(-1);
  inp.corpi.forEach((c, ci) => {
    const b = bboxPoligono(c.impronta);
    const i0 = Math.max(0, Math.floor((b.minX - g.x0) / s));
    const i1 = Math.min(g.nx - 1, Math.ceil((b.maxX - g.x0) / s));
    const j0 = Math.max(0, Math.floor((b.minY - g.y0) / s));
    const j1 = Math.min(g.ny - 1, Math.ceil((b.maxY - g.y0) / s));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = g.x0 + i * s, y = g.y0 + j * s;
      // il bordo del modello coincide con il contorno reale: si includono anche le celle
      // il cui centro è entro mezzo passo dal contorno
      if (!puntoInPoligono(x, y, c.impronta) && distanzaDalContorno(x, y, c.impronta) > s / 2 + 1e-9) continue;
      const z = quotaCopertura(c, x, y, false);
      const idx = j * g.nx + i;
      if (z > h[idx]!) { h[idx] = z; corpoCella[idx] = ci; }
    }
  });
  // 1b. modelli 3D: quota della superficie superiore per ogni cella
  superfici.forEach((sup, k) => {
    const ci = inp.corpi.length + k;
    const T = sup.triangoli;
    for (let t = 0; t + 8 < T.length; t += 9) {
      const ax = T[t]!, ay = T[t + 1]!, az = T[t + 2]!;
      const bx = T[t + 3]!, by = T[t + 4]!, bz = T[t + 5]!;
      const cx = T[t + 6]!, cy = T[t + 7]!, cz = T[t + 8]!;
      if (Math.max(az, bz, cz) <= Z_TERRENO) continue;
      const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(det) < 1e-9) continue; // triangolo verticale (parete)
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - s / 2 - g.x0) / s));
      const i1 = Math.min(g.nx - 1, Math.ceil((Math.max(ax, bx, cx) + s / 2 - g.x0) / s));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - s / 2 - g.y0) / s));
      const j1 = Math.min(g.ny - 1, Math.ceil((Math.max(ay, by, cy) + s / 2 - g.y0) / s));
      const tri: Punto2[] = [[ax, ay], [bx, by], [cx, cy]];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = g.x0 + i * s, y = g.y0 + j * s;
        let l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det;
        let l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det;
        let l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) {
          // fuori dal triangolo: si include se entro mezzo passo (bordo del modello = bordo reale)
          if (distanzaDalContorno(x, y, tri) > s / 2 + 1e-9) continue;
          l1 = Math.max(0, l1); l2 = Math.max(0, l2); l3 = Math.max(0, l3);
          const somma = l1 + l2 + l3;
          l1 /= somma; l2 /= somma; l3 /= somma;
        }
        const z = l1 * az + l2 * bz + l3 * cz;
        if (z <= Z_TERRENO) continue;
        const idx = j * g.nx + i;
        if (z > h[idx]!) { h[idx] = z; corpoCella[idx] = ci; }
      }
    }
  });

  // 2. Superficie dei centri C
  const r2 = r * r;
  const C = new Float32Array(N).fill(r);
  const srcCella = new Int32Array(N).fill(-1);
  const srcQuota = new Float32Array(N);
  // 2a. coperture, per livelli di quota (arrotondati per difetto)
  const livelli = new Map<number, Uint8Array>();
  for (let i = 0; i < N; i++) {
    if (corpoCella[i]! < 0 || h[i]! <= 0) continue;
    const lv = Math.floor(h[i]! / qz + 1e-9);
    let mk = livelli.get(lv);
    if (!mk) { mk = new Uint8Array(N); livelli.set(lv, mk); }
    mk[i] = 1;
  }
  if (livelli.size > 400) avvisi.push(`Molti livelli di quota (${livelli.size}): calcolo lento, valutare una quantizzazione maggiore`);
  const rc2 = (r / s) * (r / s);
  for (const [lv, mk] of livelli) {
    const H = lv * qz;
    const { d2, src } = trasformataDistanza(mk, g.nx, g.ny);
    for (let i = 0; i < N; i++) {
      if (d2[i]! >= rc2) continue; // a distanza ≥ r la colonna non vincola il centro
      const val = H + Math.sqrt(r2 - d2[i]! * s * s);
      if (val > C[i]!) { C[i] = val; srcCella[i] = src[i]!; srcQuota[i] = H; }
    }
  }
  // 2b. aste e conduttori
  const captatoreCella = new Uint8Array(N);
  const timbra = (px: number, py: number, pz: number) => {
    const i0 = Math.max(0, Math.ceil((px - r - g.x0) / s));
    const i1 = Math.min(g.nx - 1, Math.floor((px + r - g.x0) / s));
    const j0 = Math.max(0, Math.ceil((py - r - g.y0) / s));
    const j1 = Math.min(g.ny - 1, Math.floor((py + r - g.y0) / s));
    for (let j = j0; j <= j1; j++) {
      const dy = g.y0 + j * s - py;
      const resto = r2 - dy * dy;
      if (resto <= 0) continue;
      for (let i = i0; i <= i1; i++) {
        const dx = g.x0 + i * s - px;
        const q = resto - dx * dx;
        if (q <= 0) continue;
        const val = pz + Math.sqrt(q);
        const idx = j * g.nx + i;
        if (val > C[idx]!) C[idx] = val;
      }
    }
  };
  const cellaDi = (x: number, y: number) => {
    const i = Math.round((x - g.x0) / s);
    const j = Math.round((y - g.y0) / s);
    return i >= 0 && j >= 0 && i < g.nx && j < g.ny ? j * g.nx + i : -1;
  };
  const punte: number[] = [];
  for (const a of inp.aste ?? []) {
    const ia = cellaDi(a.x, a.y);
    const zb = a.zBase ?? Math.max(quotaAppoggio(inp.corpi, a.x, a.y, s / 2), ia >= 0 ? h[ia]! : 0);
    punte.push(a.x, a.y, zb + a.altezza);
    timbra(a.x, a.y, zb + a.altezza);
    const idx = cellaDi(a.x, a.y);
    if (idx >= 0) captatoreCella[idx] = 1;
  }
  const segmenti: number[] = [];
  for (const k of inp.conduttori ?? []) {
    for (let t = 0; t + 1 < k.punti.length; t++) {
      const [ax, ay, az] = k.punti[t]!;
      const [bx, by, bz] = k.punti[t + 1]!;
      segmenti.push(ax, ay, az, bx, by, bz);
      const L = Math.hypot(bx - ax, by - ay, bz - az);
      const n = Math.max(1, Math.ceil(L / (s / 2)));
      for (let u = 0; u <= n; u++) {
        const f = u / n;
        const x = ax + (bx - ax) * f, y = ay + (by - ay) * f, z = az + (bz - az) * f;
        timbra(x, y, z);
        const idx = cellaDi(x, y);
        // il conduttore protegge la cella su cui corre (se è appoggiato alla copertura)
        if (idx >= 0 && z >= h[idx]! - 0.01) captatoreCella[idx] = 1;
      }
    }
  }

  const m: Modello = {
    r, g, h, C, srcCella, srcQuota,
    punte: Float64Array.from(punte),
    segmenti: Float64Array.from(segmenti),
  };

  // 3. Inviluppo sulle coperture.
  //    Kernel ordinato per distanza (sulle coperture esposte si esce al primo nodo);
  //    le celle vicine alla soglia vengono affinate sulla superficie esatta dei centri.
  const K = costruisciKernel(r, s);
  const banda = 0.4 * s; // errore massimo del solo campionamento ≈ 0,28 × passo
  const inviluppo = new Float32Array(N).fill(NaN);
  const esposta = new Uint8Array(N);
  let nCop = 0, nEsp = 0;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const idx = j * g.nx + i;
    if (corpoCella[idx]! < 0) continue;
    nCop++;
    let [e, arg] = inviluppoNodo(m, K, i, j, h[idx]! + tol);
    if (e - h[idx]! > tol && e - h[idx]! <= tol + banda && arg >= 0) {
      e = Math.min(e, affina(m, g.x0 + i * s, g.y0 + j * s, g.x0 + (arg % g.nx) * s, g.y0 + Math.floor(arg / g.nx) * s));
    }
    inviluppo[idx] = e;
    if (e - h[idx]! <= tol && !captatoreCella[idx]!) { esposta[idx] = 1; nEsp++; }
    else esposta[idx] = 2;
  }

  // 4. Pareti. Una sfera tocca una parete verticale solo in tangenza, con il centro a distanza
  //    orizzontale r dal punto: si provano i centri nel semipiano esterno e la quota del centro
  //    è la quota del punto toccato. I centri si prendono a r + passo: così la scalettatura
  //    della griglia su pareti non allineate non nasconde la parete (scelta cautelativa).
  const vicini: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const hVicino = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < g.nx && j < g.ny ? h[j * g.nx + i]! : 0;
  const facceEsposte: FacciaEsposta[] = [];
  const tolParete = Math.max(0.1, s);
  let areaParete = 0;
  const rr = r + s;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const idx = j * g.nx + i;
    if (corpoCella[idx]! < 0) continue;
    const px = g.x0 + i * s, py = g.y0 + j * s;
    for (const [di, dj] of vicini) {
      const hn = hVicino(i + di, j + dj);
      if (hn >= h[idx]! - tolParete) continue;
      let eLat = Infinity;
      for (let a = -85; a <= 85; a += 5) {
        const th = (a * Math.PI) / 180;
        const ux = di * Math.cos(th) - dj * Math.sin(th);
        const uy = di * Math.sin(th) + dj * Math.cos(th);
        const zc = centroMinimo(m, px + rr * ux, py + rr * uy);
        if (zc < eLat) eLat = zc;
      }
      const zDa = Math.max(hn, Math.min(eLat, inviluppo[idx]!));
      if (h[idx]! - zDa > tolParete) {
        // su un lato inclinato i gradini della griglia sommano facce in x e in y:
        // si riporta la faccia alla lunghezza equivalente sul lato reale
        const ci = corpoCella[idx]!;
        let lato = -1, lunghezza = s;
        if (ci < inp.corpi.length) {
          const l = latoPiuVicino(px, py, inp.corpi[ci]!.impronta);
          lato = l.lato;
          lunghezza = s / (Math.abs(l.ux) + Math.abs(l.uy));
        }
        facceEsposte.push({ corpo: ci, lato, x: px, y: py, normale: [di, dj], zDa, zA: h[idx]!, lunghezza });
        areaParete += (h[idx]! - zDa) * lunghezza;
      }
    }
  }

  // area delle coperture: dai poligoni per i corpi (parte esposta in proporzione alle celle),
  // dalle celle per i modelli 3D
  let nCopCorpi = 0, nEspCorpi = 0;
  const nc = inp.corpi.length;
  for (let k = 0; k < N; k++) {
    if (corpoCella[k]! < 0 || corpoCella[k]! >= nc) continue;
    nCopCorpi++;
    if (esposta[k]! === 1) nEspCorpi++;
  }
  const areaPoligoni = inp.corpi.reduce((t, c) => t + areaPoligono(c.impronta), 0);
  const fattore = nCopCorpi > 0 ? areaPoligoni / nCopCorpi : 0;
  const areaCopertura = areaPoligoni + (nCop - nCopCorpi) * s * s;
  const areaEsposta = nEspCorpi * fattore + (nEsp - nEspCorpi) * s * s;
  return {
    raggio: r,
    griglia: g,
    modello: m,
    altezze: h,
    corpoCella,
    captatoreCella,
    centri: C,
    inviluppo,
    esposta,
    facceEsposte,
    areaCopertura,
    areaCoperturaEsposta: areaEsposta,
    areaPareteEsposta: areaParete,
    esito: nEsp === 0 && facceEsposte.length === 0 ? "adeguata" : "non adeguata",
    avvisi,
    tempoMs: Date.now() - t0,
  };
}

/** Quota più bassa raggiunta dalla sfera in un punto (per verifiche puntuali e grafici). */
export function inviluppoInPunto(ris: RisultatoSfera, x: number, y: number): number {
  return inviluppoPuntoLibero(ris.modello, x, y);
}

/** Quota del centro della sfera in un punto (per animare la sfera lungo un percorso). */
export function centroSferaInPunto(ris: RisultatoSfera, x: number, y: number): number {
  return centroMinimo(ris.modello, x, y);
}

/** Centri della sfera lungo un percorso (es. un lato o una diagonale), passo in metri. */
export function percorsoSfera(ris: RisultatoSfera, da: Punto2, a: Punto2, passo = 0.5): Punto3[] {
  const L = Math.hypot(a[0] - da[0], a[1] - da[1]);
  const n = Math.max(1, Math.ceil(L / passo));
  const out: Punto3[] = [];
  for (let k = 0; k <= n; k++) {
    const x = da[0] + ((a[0] - da[0]) * k) / n;
    const y = da[1] + ((a[1] - da[1]) * k) / n;
    out.push([x, y, centroSferaInPunto(ris, x, y)]);
  }
  return out;
}

/**
 * Inviluppo su una griglia regolare (per il disegno 3D e l'export DXF come mesh di 3DFACE).
 * Restituisce le quote per righe: z[j][i], con x = x0 + i·passo, y = y0 + j·passo.
 */
export function inviluppoSuGriglia(ris: RisultatoSfera, passo: number) {
  const g = ris.griglia;
  const x0 = g.x0 + ris.raggio, y0 = g.y0 + ris.raggio;
  const x1 = g.x0 + (g.nx - 1) * g.passo - ris.raggio;
  const y1 = g.y0 + (g.ny - 1) * g.passo - ris.raggio;
  const nx = Math.max(2, Math.ceil((x1 - x0) / passo) + 1);
  const ny = Math.max(2, Math.ceil((y1 - y0) / passo) + 1);
  const z: number[][] = [];
  for (let j = 0; j < ny; j++) {
    const riga: number[] = [];
    for (let i = 0; i < nx; i++) riga.push(inviluppoInPunto(ris, x0 + i * passo, y0 + j * passo));
    z.push(riga);
  }
  return { x0, y0, passo, nx, ny, z };
}

/* ------------------------------------------------------------------ */
/* Confronto dei 4 livelli e suggerimento aste                          */
/* ------------------------------------------------------------------ */

export interface RiepilogoLivello {
  lpl: string;
  raggio: number;
  areaCoperturaEsposta: number;
  areaPareteEsposta: number;
  esito: "adeguata" | "non adeguata";
}

/** raggi: es. { I: 20, II: 30, III: 45, IV: 60 } letti da parametriLPL.json */
export function confrontaLivelli(
  base: Omit<InputSfera, "raggio">,
  raggi: Record<string, number | null>,
): { riepilogo: RiepilogoLivello[]; risultati: Record<string, RisultatoSfera> } {
  const riepilogo: RiepilogoLivello[] = [];
  const risultati: Record<string, RisultatoSfera> = {};
  for (const [lpl, raggio] of Object.entries(raggi)) {
    if (raggio == null) continue;
    const ris = calcolaSferaRotolante({ ...base, raggio });
    risultati[lpl] = ris;
    riepilogo.push({
      lpl, raggio,
      areaCoperturaEsposta: ris.areaCoperturaEsposta,
      areaPareteEsposta: ris.areaPareteEsposta,
      esito: ris.esito,
    });
  }
  return { riepilogo, risultati };
}

/**
 * Propone aste aggiuntive sulle coperture esposte.
 * Greedy: ogni asta di altezza 'altezzaAsta' protegge sul piano di appoggio circa un cerchio
 * di raggio sqrt(ha·(2r − ha)); si sceglie la posizione che copre più celle esposte, poi si
 * ricalcola con il motore completo. Dove la stima era ottimista (tipicamente i bordi del tetto,
 * raggiunti dalle sfere che arrivano di lato) il raggio stimato si riduce a ogni giro, così
 * le aste successive vanno verso i bordi.
 * Le pareti esposte (edifici più alti di r) non si risolvono con aste in copertura:
 * vengono segnalate negli avvisi.
 */
export function suggerisciAste(
  inp: InputSfera,
  altezzaAsta: number,
  opzioni: { asteMax?: number | undefined; iterazioniMax?: number | undefined } = {},
): { asteAggiunte: Asta[]; risultato: RisultatoSfera; avvisi: string[] } {
  const asteMax = opzioni.asteMax ?? 50;
  const iterMax = opzioni.iterazioniMax ?? 10;
  const r = inp.raggio;
  const ha = Math.min(altezzaAsta, r);
  const rp = Math.sqrt(ha * (2 * r - ha));
  const aggiunte: Asta[] = [];
  const avvisi: string[] = [];
  let ris = calcolaSferaRotolante(inp);

  // Giro 0: aste agli spigoli delle coperture (rientrate di 0,5 m), dove gli spigoli sono esposti
  if (ris.areaCoperturaEsposta > 0) {
    const g = ris.griglia;
    for (const c of inp.corpi) {
      const n = c.impronta.length;
      const cx = c.impronta.reduce((t, p) => t + p[0], 0) / n;
      const cy = c.impronta.reduce((t, p) => t + p[1], 0) / n;
      for (const [vx, vy] of c.impronta) {
        const L = Math.hypot(cx - vx, cy - vy) || 1;
        const x = vx + ((cx - vx) / L) * 0.5;
        const y = vy + ((cy - vy) / L) * 0.5;
        const i = Math.round((vx - g.x0) / g.passo), j = Math.round((vy - g.y0) / g.passo);
        if (ris.esposta[j * g.nx + i]! !== 1) continue;
        if ([...(inp.aste ?? []), ...aggiunte].some((a) => Math.hypot(a.x - x, a.y - y) < 2)) continue;
        aggiunte.push({ id: `S${aggiunte.length + 1}`, x, y, zBase: quotaAppoggio(inp.corpi, x, y), altezza: altezzaAsta });
      }
    }
    if (aggiunte.length) ris = calcolaSferaRotolante({ ...inp, aste: [...(inp.aste ?? []), ...aggiunte] });
  }

  for (let it = 0; it < iterMax && ris.areaCoperturaEsposta > 0 && aggiunte.length < asteMax; it++) {
    const fattore = 0.9 * Math.pow(0.7, it);
    const esistenti = [...(inp.aste ?? []), ...aggiunte];
    const g = ris.griglia;
    // celle esposte e candidati (celle di copertura, sottocampionate)
    const esposte: Punto3[] = [];
    const candidati: Punto3[] = [];
    const salto = Math.max(1, Math.round(Math.min(rp / 4, 2) / g.passo));
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
      const idx = j * g.nx + i;
      if (ris.esposta[idx]! === 0) continue;
      const p: Punto3 = [g.x0 + i * g.passo, g.y0 + j * g.passo, ris.altezze[idx]!];
      if (ris.esposta[idx]! === 1) esposte.push(p);
      if (i % salto === 0 && j % salto === 0) candidati.push(p);
    }
    const coperta = new Uint8Array(esposte.length);
    // il cerchio protetto si riduce sulle coperture più alte del piede dell'asta
    const protegge = (c: Punto3, e: Punto3) => {
      const dz = e[2] - c[2];
      if (dz >= ha) return false;
      const hr = ha - dz;
      const raggio = Math.sqrt(hr * (2 * r - hr)) * fattore;
      return Math.hypot(e[0] - c[0], e[1] - c[1]) <= raggio;
    };
    let nuove = 0;
    while (aggiunte.length < asteMax) {
      let migliore = -1, conta = 0;
      for (let k = 0; k < candidati.length; k++) {
        const [cx, cy] = candidati[k]!;
        if (esistenti.some((a) => Math.hypot(a.x - cx, a.y - cy) < 1)) continue;
        let n = 0;
        for (let e = 0; e < esposte.length; e++) if (!coperta[e]! && protegge(candidati[k]!, esposte[e]!)) n++;
        if (n > conta) { conta = n; migliore = k; }
      }
      if (migliore < 0) break;
      const c = candidati[migliore]!;
      const nuova = { id: `S${aggiunte.length + 1}`, x: c[0], y: c[1], zBase: c[2], altezza: altezzaAsta };
      aggiunte.push(nuova);
      esistenti.push(nuova);
      nuove++;
      for (let e = 0; e < esposte.length; e++) if (protegge(c, esposte[e]!)) coperta[e] = 1;
      if (coperta.every((v) => v === 1)) break;
    }
    if (!nuove) break;
    ris = calcolaSferaRotolante({ ...inp, aste: [...(inp.aste ?? []), ...aggiunte] });
  }

  if (ris.areaCoperturaEsposta > 0) {
    avvisi.push(`Restano ${ris.areaCoperturaEsposta.toFixed(1)} m² di copertura esposta: aumentare l'altezza delle aste o il numero massimo`);
  }
  if (ris.facceEsposte.length) {
    avvisi.push(`Pareti esposte per ${ris.areaPareteEsposta.toFixed(1)} m² (fulminazione laterale): prevedere captatori in facciata o anelli`);
  }
  return { asteAggiunte: aggiunte, risultato: ris, avvisi };
}
