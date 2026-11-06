import { describe, it, expect } from "vitest";
import { proponiCaptazione, catalogoPerCopertura } from "./proponiCaptazione";
import particolari from "../../dati/particolari/particolari.json";
import type { Corpo, Punto2 } from "./sferaRotolante";

const rett = (id: string, x0: number, y0: number, L: number, W: number, H: number): Corpo => ({
  id, impronta: [[x0, y0], [x0 + L, y0], [x0 + L, y0 + W], [x0, y0 + W]], altezzaGronda: H, tipoTetto: "piano",
});
const LPL_II = { raggio: 30, latoMaglia: 10, distanzaCalate: 10 };

describe("proposta automatica della captazione", () => {
  it("capannone 60×40 m, LPL II: maglia 10×10, 20 calate, 35 morsetti, esito adeguato", () => {
    const p = proponiCaptazione([rett("C", 0, 0, 60, 40, 8)], LPL_II);
    expect(p.combinata.esito).toBe("adeguata");
    expect(p.aste.length).toBe(0);
    // perimetro 200 m + 5 linee da 40 m + 3 linee da 60 m
    expect(Math.abs(p.riepilogo.metriCaptazione - 580)).toBeLessThan(0.01);
    expect(p.riepilogo.numeroCalate).toBe(20);
    expect(Math.abs(p.riepilogo.metriCalate - 160)).toBeLessThan(0.01);
    // 15 incroci interni + 16 giunzioni a T sul perimetro + 4 spigoli con calata
    expect(p.riepilogo.morsetti).toBe(35);
    // supporti ogni 1 m (T1.05): punti unici sui conduttori (200 perimetro + 5×39 + 3×59 − 15 incroci)
    // meno i 35 punti occupati dai morsetti = 522
    // + 20 calate da 8 m con supporti ogni 1 m (T4.01) = 160
    expect(p.riepilogo.supporti).toBe(522 + 160);
    expect(p.supporti.filter((s) => s.tipo === "supporto").every((s) => s.codiceOBO === "5218700")).toBe(true);
  });

  it("compensatori T1.04: alluminio ogni ≤ 10 m su ogni conduttore (60×40 m → 49)", () => {
    const p = proponiCaptazione([rett("C", 0, 0, 60, 40, 8)], LPL_II);
    // perimetro 200 m → 19; 5 linee da 40 m → 3 ciascuna; 3 linee da 60 m → 5 ciascuna
    expect(p.riepilogo.compensatori).toBe(19 + 15 + 15);
    expect(p.compensatori.every((c) => c.codiceOBO === "5218926")).toBe(true);
    expect(p.riepilogo.particolare).toBe("OBO-TBS-250-T1.05");
  });

  it("catalogo per copertura: ghiaia T1.07, acciaio T1.06 (compensatori ogni 15 m), carrabile T1.22 senza supporti", () => {
    const c = [rett("C", 0, 0, 60, 40, 8)];
    const g = proponiCaptazione(c, { ...LPL_II, catalogo: catalogoPerCopertura("ghiaia") });
    expect(g.supporti.filter((s) => s.tipo === "supporto").every((s) => s.codiceOBO === "5218977")).toBe(true);
    const st = proponiCaptazione(c, { ...LPL_II, catalogo: catalogoPerCopertura("guaina", "acciaio") });
    expect(st.conduttori[0]!.codiceOBO).toBe("5019347");
    expect(st.riepilogo.compensatori).toBe(13 + 5 * 2 + 3 * 3);
    const k = proponiCaptazione(c, { ...LPL_II, catalogo: catalogoPerCopertura("carrabile") });
    expect(k.supporti.filter((s) => s.tipo === "supporto").length).toBe(0);
    expect(k.combinata.esito).toBe("adeguata");
  });

  it("libreria particolari: ogni voce ha codice, componenti con codice a 7 cifre e riferimento OBO", () => {
    const ids = new Set<string>();
    for (const p of particolari as { id: string; componenti: { codiceOBO: string }[]; origine: string }[]) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.origine).toBe("OBO");
      expect(p.componenti.length).toBeGreaterThan(0);
      for (const c of p.componenti) expect(/^\d{7}$/.test(c.codiceOBO)).toBe(true);
    }
    // i codici usati dalla proposta automatica sono nella libreria
    const tutti = new Set((particolari as { componenti: { codiceOBO: string }[] }[]).flatMap((p) => p.componenti.map((c) => c.codiceOBO)));
    for (const cod of ["5021294", "5218700", "5311519", "5218926", "5019347", "5314658", "5331501", "5218977", "5021647", "5312318"]) {
      expect(tutti.has(cod)).toBe(true);
    }
  });

  it("distinta per codice: maglia T1.05 + calate su muratura T4.01 con tasselli", () => {
    const p = proponiCaptazione([rett("C", 0, 0, 60, 40, 8)], LPL_II);
    const d = Object.fromEntries(p.distinta.map((v) => [v.codice, v]));
    expect(d["5021294"]!.quantita).toBe(740);          // 580 m captazione + 160 m calate
    expect(d["5218700"]!.quantita).toBe(522);          // supporti tetto piano
    expect(d["5229960"]!.quantita).toBe(160);          // staffe calata 113 Z8-10
    expect(d["3133230"]!.quantita).toBe(160);          // tasselli filettati
    expect(d["2349086"]!.quantita).toBe(160);          // tasselli ad espansione
    expect(d["5311519"]!.quantita).toBe(35);
    expect(d["5218926"]!.quantita).toBe(49);
    expect(d["5229960"]!.riferimento).toBe("OBO-TBS-250-T4.01");
  });

  it("calate sotto intonaco (T4.04): conduttore RD 8-PVC, senza supporti; cappotto (T4.02): barra filettata", () => {
    const c = [rett("C", 0, 0, 60, 40, 8)];
    const t = proponiCaptazione(c, { ...LPL_II, parete: "sotto_intonaco" });
    expect(t.conduttori.filter((k) => k.tipo === "calata").every((k) => k.codiceOBO === "5021332")).toBe(true);
    expect(t.supporti.some((s) => s.tipo === "supporto calata")).toBe(false);
    const k = proponiCaptazione(c, { ...LPL_II, parete: "cappotto" });
    expect(k.distinta.find((v) => v.codice === "3141128")?.quantita).toBe(160);
  });

  it("tetto a falde in coppi: supporti di colmo 132 K VA e di falda 157 I-VA", () => {
    const f: Corpo = { ...rett("F", 0, 0, 30, 12, 7), tipoTetto: "falde", altezzaColmo: 10 };
    const p = proponiCaptazione([f], { ...LPL_II, manto: "coppi" });
    const colmo = p.supporti.filter((s) => s.tipo === "supporto colmo");
    const falda = p.supporti.filter((s) => s.tipo === "supporto falda");
    expect(colmo.length).toBeGreaterThan(25);
    expect(colmo.every((s) => s.codiceOBO === "5202515" && Math.abs(s.z - 10) < 1e-9)).toBe(true);
    expect(falda.every((s) => s.codiceOBO === "5215625")).toBe(true);
    expect(p.distinta.find((v) => v.codice === "5202515")?.riferimento).toBe("OBO-TBS-250-T3.03");
  });

  it("supporti mai a più di 1 m l'uno dall'altro lungo un conduttore", () => {
    const p = proponiCaptazione([rett("C", 0, 0, 23.7, 11.3, 6)], LPL_II);
    const lungoX = p.supporti.concat(p.morsetti as typeof p.supporti).filter((s) => Math.abs(s.y) < 1e-6).map((s) => s.x).sort((a, b) => a - b);
    for (let i = 1; i < lungoX.length; i++) expect(lungoX[i]! - lungoX[i - 1]!).toBeLessThanOrEqual(1.0 + 1e-9);
    expect(lungoX[0]!).toBe(0);
    expect(Math.abs(lungoX[lungoX.length - 1]! - 23.7)).toBeLessThan(1e-9);
  });

  it("edificio a L ruotato di 25°: maglie conformi ed esito adeguato", () => {
    const th = (25 * Math.PI) / 180;
    const r = ([x, y]: Punto2): Punto2 => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];
    const L: Corpo = { id: "L", impronta: ([[0, 0], [50, 0], [50, 20], [20, 20], [20, 45], [0, 45]] as Punto2[]).map(r), altezzaGronda: 12 };
    const p = proponiCaptazione([L], LPL_II);
    expect(p.combinata.esito).toBe("adeguata");
    expect(p.combinata.maglieNonConformi.length).toBe(0);
  });

  it("corpo basso + corpo alto adiacenti: niente calate sul lato in comune", () => {
    const p = proponiCaptazione([rett("A", 0, 0, 30, 20, 6), rett("B", 30, 0, 20, 20, 15)], LPL_II);
    const sulLato = p.conduttori.filter((c) => c.tipo === "calata" && Math.abs(c.punti[0]![0] - 30) < 1e-6 && c.punti[0]![1] > 0.5 && c.punti[0]![1] < 19.5);
    expect(sulLato.length).toBe(0);
    expect(p.combinata.esito).toBe("adeguata");
  });

  it("tetto a falde 30×12 m: colmo, gronde e trasversali; esito adeguato", () => {
    const f: Corpo = { ...rett("F", 0, 0, 30, 12, 7), tipoTetto: "falde", altezzaColmo: 10 };
    const p = proponiCaptazione([f], LPL_II);
    const colmo = p.conduttori.find((c) => c.tipo === "captazione" && c.punti.length === 2 && c.punti.every((q) => Math.abs(q[2] - 10) < 1e-9));
    expect(colmo).toBeTruthy();
    expect(p.combinata.esito).toBe("adeguata");
  });

  it("strategia solo aste (tetto 20×20, LPL III): aste proposte, nessuna maglia, esito adeguato", () => {
    const p = proponiCaptazione([rett("A", 0, 0, 20, 20, 10)], { raggio: 45, latoMaglia: 15, distanzaCalate: 15, strategia: "aste", altezzaAsta: 3 });
    expect(p.conduttori.filter((c) => c.tipo === "captazione").length).toBe(0);
    expect(p.aste.length).toBeGreaterThan(0);
    expect(p.combinata.esito).toBe("adeguata");
  });

  it("camino sul tetto a maglia: esito adeguato (maglia sul camino o asta)", () => {
    const p = proponiCaptazione([rett("C", 0, 0, 40, 20, 8), rett("K", 18, 8, 2, 2, 11)], LPL_II);
    expect(p.combinata.esito).toBe("adeguata");
  });
});
