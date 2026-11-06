import { describe, it, expect } from "vitest";
import { calcolaSferaRotolante, type Corpo, type Conduttore, type Punto2, type Punto3 } from "./sferaRotolante";
import { verificaMaglia, verificaCombinata, rettangoloMinimo, STATO_MAGLIA } from "./verificaMaglia";

const rett = (id: string, x0: number, y0: number, L: number, W: number, H: number): Corpo => ({
  id, impronta: [[x0, y0], [x0 + L, y0], [x0 + L, y0 + W], [x0, y0 + W]], altezzaGronda: H, tipoTetto: "piano",
});

/** maglia di conduttori a filo copertura: linee x = xs, y = ys */
const griglia = (xs: number[], ys: number[], y0: number, y1: number, x0: number, x1: number, z: number): Conduttore[] => [
  ...xs.map((x) => ({ punti: [[x, y0, z], [x, y1, z]] as Punto3[] })),
  ...ys.map((y) => ({ punti: [[x0, y, z], [x1, y, z]] as Punto3[] })),
];
const passi = (da: number, a: number, p: number) => Array.from({ length: Math.round((a - da) / p) + 1 }, (_, k) => da + k * p);

describe("rettangolo minimo", () => {
  it("rettangolo 10×4 ruotato di 30°", () => {
    const th = Math.PI / 6, pts: Punto2[] = [];
    for (let u = 0; u <= 10; u += 0.5) for (let v = 0; v <= 4; v += 0.5)
      pts.push([u * Math.cos(th) - v * Math.sin(th), u * Math.sin(th) + v * Math.cos(th)]);
    const r = rettangoloMinimo(pts);
    expect(Math.abs(r.a - 10)).toBeLessThan(0.05);
    expect(Math.abs(r.b - 4)).toBeLessThan(0.05);
    expect(r.angolo).toBe(30);
  });
});

describe("metodo della maglia", () => {
  const H = 8, corpi = [rett("C", 0, 0, 60, 40, H)];

  it("capannone 60×40 m, maglia 10×10 m, LPL II (lato 10 m): 24 maglie conformi, captazione adeguata", () => {
    const cond = griglia(passi(0, 60, 10), passi(0, 40, 10), 0, 40, 0, 60, H);
    const ris = calcolaSferaRotolante({ corpi, conduttori: cond, raggio: 30 });
    const rm = verificaMaglia(ris, cond, { latoMaglia: 10 });
    expect(rm.maglie.length).toBe(24);
    for (const m of rm.maglie) {
      expect(m.conforme).toBe(true);
      expect(Math.abs(m.lunghezza - 10)).toBeLessThan(0.05);
    }
    // la sfera da sola segna esposto il centro delle maglie, la combinata no
    expect(ris.areaCoperturaEsposta).toBeGreaterThan(0);
    const vc = verificaCombinata(ris, rm);
    expect(vc.areaEsposta).toBe(0);
    expect(vc.areaProtettaMaglia).toBeGreaterThan(0);
    expect(vc.esito).toBe("adeguata");
  });

  it("maglia 15×10 m con LPL I (lato 5 m): non conforme, esposta", () => {
    const cond = griglia(passi(0, 60, 15), passi(0, 40, 10), 0, 40, 0, 60, H);
    const ris = calcolaSferaRotolante({ corpi, conduttori: cond, raggio: 20 });
    const rm = verificaMaglia(ris, cond, { latoMaglia: 5 });
    expect(rm.maglie.every((m) => !m.conforme)).toBe(true);
    const vc = verificaCombinata(ris, rm);
    expect(vc.esito).toBe("non adeguata");
    expect(vc.maglieNonConformi.length).toBeGreaterThan(0);
  });

  it("maglia 10,5 m con lato massimo 10 m: non conforme (misura precisa)", () => {
    const cond = griglia(passi(0, 42, 10.5), passi(0, 40, 10), 0, 40, 0, 42, H);
    const ris = calcolaSferaRotolante({ corpi: [rett("C", 0, 0, 42, 40, H)], conduttori: cond, raggio: 30 });
    const rm = verificaMaglia(ris, cond, { latoMaglia: 10 });
    for (const m of rm.maglie) {
      expect(Math.abs(m.lunghezza - 10.5)).toBeLessThan(0.05);
      expect(m.conforme).toBe(false);
    }
  });

  it("maglia senza conduttore sul bordo est: le maglie di bordo sono aperte", () => {
    const cond = griglia(passi(0, 50, 10), passi(0, 40, 10), 0, 40, 0, 60, H); // manca x = 60
    const ris = calcolaSferaRotolante({ corpi, conduttori: cond, raggio: 30 });
    const rm = verificaMaglia(ris, cond, { latoMaglia: 10 });
    const aperte = rm.maglie.filter((m) => m.aperta);
    expect(aperte.length).toBe(4);
    for (const m of aperte) expect(m.centro[0]).toBeGreaterThan(50);
    expect(rm.maglie.filter((m) => m.conforme).length).toBe(20);
  });

  it("edificio e maglia ruotati di 30°: maglie 10×10 conformi", () => {
    const th = Math.PI / 6;
    const rot = (x: number, y: number): Punto2 => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];
    const corpo: Corpo = { id: "R", impronta: [rot(0, 0), rot(40, 0), rot(40, 20), rot(0, 20)], altezzaGronda: H };
    const cond: Conduttore[] = [
      ...passi(0, 40, 10).map((x) => ({ punti: [[...rot(x, 0), H], [...rot(x, 20), H]] as Punto3[] })),
      ...passi(0, 20, 10).map((y) => ({ punti: [[...rot(0, y), H], [...rot(40, y), H]] as Punto3[] })),
    ];
    const ris = calcolaSferaRotolante({ corpi: [corpo], conduttori: cond, raggio: 30, passo: 0.5 });
    const rm = verificaMaglia(ris, cond, { latoMaglia: 10 });
    expect(rm.maglie.length).toBe(8);
    for (const m of rm.maglie) {
      expect(m.conforme).toBe(true);
      expect(Math.abs(m.lunghezza - 10)).toBeLessThan(0.05);
      expect(Math.abs(m.larghezza - 10)).toBeLessThan(0.05);
    }
    expect(verificaCombinata(ris, rm).esito).toBe("adeguata");
  });

  it("camino sul tetto: la maglia non lo protegge, un'asta sì", () => {
    const camino = rett("camino", 24, 14, 2, 2, H + 3);
    const cond = griglia(passi(0, 60, 10), passi(0, 40, 10), 0, 40, 0, 60, H);
    const senza = calcolaSferaRotolante({ corpi: [...corpi, camino], conduttori: cond, raggio: 30 });
    const vc1 = verificaCombinata(senza, verificaMaglia(senza, cond, { latoMaglia: 10 }));
    expect(vc1.esito).toBe("non adeguata");
    let espCamino = 0;
    vc1.stato.forEach((v, k) => { if (v === 3 && senza.corpoCella[k]! === 1) espCamino++; });
    expect(espCamino).toBeGreaterThan(0);
    const con = calcolaSferaRotolante({ corpi: [...corpi, camino], conduttori: cond, raggio: 30, aste: [{ x: 25, y: 15, altezza: 1.5 }] });
    const vc2 = verificaCombinata(con, verificaMaglia(con, cond, { latoMaglia: 10 }));
    expect(vc2.esito).toBe("adeguata");
  });

  it("pendenza oltre il limite: maglia non applicabile", () => {
    const falda: Corpo = { ...rett("F", 0, 0, 30, 12, 8), tipoTetto: "falde", altezzaColmo: 12 };
    const cond = [
      ...passi(0, 30, 10).map((x) => ({ punti: [[x, 0, 8], [x, 6, 12], [x, 12, 8]] as Punto3[] })),
      { punti: [[0, 0, 8], [30, 0, 8]] as Punto3[] }, { punti: [[0, 6, 12], [30, 6, 12]] as Punto3[] }, { punti: [[0, 12, 8], [30, 12, 8]] as Punto3[] },
    ];
    const ris = calcolaSferaRotolante({ corpi: [falda], conduttori: cond, raggio: 30, passo: 0.25 });
    const libero = verificaMaglia(ris, cond, { latoMaglia: 10, sogliaGradino: 0.5 });
    expect(libero.maglie.filter((m) => m.conforme).length).toBe(6);
    for (const m of libero.maglie) expect(Math.abs(m.pendenza - 4 / 6)).toBeLessThan(0.02);
    const limitato = verificaMaglia(ris, cond, { latoMaglia: 10, pendenzaMassima: 0.5, sogliaGradino: 0.5 });
    expect(limitato.maglie.every((m) => !m.conforme)).toBe(true);
    let n = 0;
    limitato.stato.forEach((v) => { if (v === STATO_MAGLIA.PENDENZA) n++; });
    expect(n).toBeGreaterThan(0);
  });
});

describe("modelli 3D importati", () => {
  /** parallelepipedo come mesh di triangoli (coperture + pareti + base) */
  const scatola = (x0: number, y0: number, L: number, W: number, H: number): number[] => {
    const v = (x: number, y: number, z: number) => [x0 + x, y0 + y, z];
    const q = (a: number[], b: number[], c: number[], d: number[]) => [...a, ...b, ...c, ...a, ...c, ...d];
    return [
      ...q(v(0, 0, H), v(L, 0, H), v(L, W, H), v(0, W, H)), // copertura
      ...q(v(0, 0, 0), v(L, 0, 0), v(L, W, 0), v(0, W, 0)), // base a terra
      ...q(v(0, 0, 0), v(L, 0, 0), v(L, 0, H), v(0, 0, H)), // pareti
      ...q(v(0, W, 0), v(L, W, 0), v(L, W, H), v(0, W, H)),
      ...q(v(0, 0, 0), v(0, W, 0), v(0, W, H), v(0, 0, H)),
      ...q(v(L, 0, 0), v(L, W, 0), v(L, W, H), v(L, 0, H)),
    ];
  };

  it("una scatola importata come mesh dà lo stesso risultato del corpo equivalente", () => {
    const aste = [{ x: 10, y: 10, altezza: 4 }];
    const daCorpo = calcolaSferaRotolante({ corpi: [rett("A", 0, 0, 20, 20, 10)], aste, raggio: 30, passo: 0.5 });
    const daMesh = calcolaSferaRotolante({ corpi: [], superfici: [{ id: "ifc", triangoli: scatola(0, 0, 20, 20, 10) }], aste, raggio: 30, passo: 0.5 });
    expect(Math.abs(daMesh.areaCopertura - daCorpo.areaCopertura)).toBeLessThan(25);
    expect(Math.abs(daMesh.areaCoperturaEsposta - daCorpo.areaCoperturaEsposta)).toBeLessThan(25);
  });

  it("edificio alto da mesh: pareti esposte sopra r, lato −1", () => {
    const ris = calcolaSferaRotolante({ corpi: [], superfici: [{ id: "t", triangoli: scatola(0, 0, 20, 20, 60) }], raggio: 20, passo: 0.5 });
    expect(ris.facceEsposte.length).toBeGreaterThan(0);
    expect(ris.facceEsposte[0]!.lato).toBe(-1);
    const zMin = Math.min(...ris.facceEsposte.map((f) => f.zDa));
    expect(Math.abs(zMin - 20)).toBeLessThan(0.6);
  });

  it("asta su copertura da mesh: appoggia sulla mesh", () => {
    const sup = [{ id: "m", triangoli: scatola(0, 0, 20, 20, 10) }];
    const a = calcolaSferaRotolante({ corpi: [], superfici: sup, aste: [{ x: 10, y: 10, altezza: 4 }], raggio: 45, passo: 0.5 });
    const b = calcolaSferaRotolante({ corpi: [], superfici: sup, aste: [{ x: 10, y: 10, altezza: 4, zBase: 10 }], raggio: 45, passo: 0.5 });
    expect(a.areaCoperturaEsposta).toBeCloseTo(b.areaCoperturaEsposta, 3);
  });
});

import { triangoliDaGeometria } from "./superfici3D";

describe("conversione dei modelli 3D", () => {
  it("asse Y verso l'alto → quota z; indici, matrice e scala", () => {
    // un triangolo orizzontale a quota 10 m in un modello in millimetri, Y verso l'alto
    const pos = [0, 10000, 0, 20000, 10000, 0, 0, 10000, -20000];
    const t = triangoliDaGeometria(pos, { indici: [0, 1, 2], scala: 0.001 });
    expect(Array.from(t)).toEqual([0, 0, 10, 20, 0, 10, 0, 20, 10]);
    // traslazione di 5 m in x con una matrice (ordine colonne)
    const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5000, 0, 0, 1];
    const t2 = triangoliDaGeometria(pos, { matrice: m, scala: 0.001 });
    expect(t2[0]!).toBe(5);
    expect(t2[2]!).toBe(10);
  });
});
