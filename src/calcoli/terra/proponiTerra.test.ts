import { describe, it, expect } from "vitest";
import { proponiTerra, verificaTerra, contornoOffset } from "./proponiTerra";
import { proponiCaptazione } from "../captazione/proponiCaptazione";
import type { Corpo, Punto2 } from "../captazione/sferaRotolante";

const rett = (id: string, x0: number, y0: number, L: number, W: number, H: number): Corpo => ({
  id, impronta: [[x0, y0], [x0 + L, y0], [x0 + L, y0 + W], [x0, y0 + W]], altezzaGronda: H, tipoTetto: "piano",
});
const calateDi = (corpi: Corpo[]): Punto2[] =>
  proponiCaptazione(corpi, { raggio: 30, latoMaglia: 10, distanzaCalate: 10 }).conduttori
    .filter((c) => c.tipo === "calata").map((c) => [c.punti[0]![0], c.punti[0]![1]] as Punto2);
const voce = (p: { distinta: { codice: string; quantita: number }[] }, cod: string) => p.distinta.find((v) => v.codice === cod)?.quantita ?? 0;

describe("contorno a distanza costante", () => {
  it("rettangolo 60×40 a 1 m: perimetro 2·(62+42) − (8 − 2π)·1 ≈ 206,3 m", () => {
    const a = contornoOffset([rett("C", 0, 0, 60, 40, 8)], 1);
    expect(a.length).toBe(1);
    let L = 0;
    const p = a[0]!;
    for (let i = 0; i < p.length; i++) L += Math.hypot(p[(i + 1) % p.length]![0] - p[i]![0], p[(i + 1) % p.length]![1] - p[i]![1]);
    expect(Math.abs(L - (208 - (8 - 2 * Math.PI)))).toBeLessThan(0.4);
    // ogni punto a 1 m dall'edificio (± 5 cm)
    for (const [x, y] of p) {
      const dx = Math.max(0 - x, 0, x - 60), dy = Math.max(0 - y, 0, y - 40);
      expect(Math.abs(Math.hypot(dx, dy) - 1)).toBeLessThan(0.05);
    }
  });
  it("due corpi uniti a L: un solo anello attorno all'unione", () => {
    const a = contornoOffset([rett("A", 0, 0, 40, 15, 8), rett("B", 0, 15, 15, 25, 8)], 1);
    expect(a.length).toBe(1);
  });
  it("edificio a corte: si tiene solo l'anello esterno", () => {
    const corte = [rett("N", 0, 30, 40, 10, 8), rett("S", 0, 0, 40, 10, 8), rett("O", 0, 10, 10, 20, 8), rett("E", 30, 10, 10, 20, 8)];
    expect(contornoOffset(corte, 1).length).toBe(1);
  });
});

describe("proposta impianto di terra (OBO T5)", () => {
  const corpi = [rett("C", 0, 0, 60, 40, 8)];
  const calate = calateDi(corpi);

  it("tipo B – anello inox a 1 m e 0,7 m di profondità, 20 collegamenti", () => {
    const p = proponiTerra(corpi, { tipo: "B", calate });
    const anello = p.conduttori.find((c) => c.tipo === "anello")!;
    expect(anello.punti.every((q) => q[2] === -0.7)).toBe(true);
    expect(Math.abs(p.riepilogo.metriDispersore - 206.3)).toBeLessThan(0.5);
    expect(Math.abs(p.riepilogo.metriCollegamenti - 20)).toBeLessThan(0.5); // 20 calate × ~1 m
    expect(voce(p, "5336341")).toBe(20); // giunti di sezionamento
    expect(voce(p, "3049256")).toBe(20); // targhette
    expect(voce(p, "5420504")).toBe(20); // aste di uscita
    expect(voce(p, "5314659")).toBe(20); // morsetti a croce sull'anello
    expect(Math.abs(p.riepilogo.raggioEquivalente - Math.sqrt((62 * 42 - (4 - Math.PI)) / Math.PI))).toBeLessThan(0.1);
  });

  it("tipo A – un picchetto da 3 m (2 elementi BP) per calata, a 1 m dal muro, fuori dall'edificio", () => {
    const p = proponiTerra(corpi, { tipo: "A", calate });
    expect(p.picchetti.length).toBe(20);
    expect(voce(p, "5000858")).toBe(40);
    expect(voce(p, "3041212")).toBe(20);
    expect(voce(p, "5001633")).toBe(20);
    for (const q of p.picchetti) {
      const dentro = q.x > 0 && q.x < 60 && q.y > 0 && q.y < 40;
      expect(dentro).toBe(false);
      const dx = Math.max(0 - q.x, 0, q.x - 60), dy = Math.max(0 - q.y, 0, q.y - 40);
      expect(Math.abs(Math.hypot(dx, dy) - 1)).toBeLessThan(0.05);
    }
  });

  it("fondazione – perimetro + maglia 20×20 m: 340 m di piatto zincato, 8 morsetti, 20 punti fissi", () => {
    const p = proponiTerra(corpi, { tipo: "fondazione", calate });
    expect(Math.abs(voce(p, "5019347") - 340)).toBeLessThan(0.01); // 200 + 2×40 + 60
    expect(voce(p, "5314658")).toBe(8);   // 2 incroci interni + 6 giunzioni a T
    expect(voce(p, "5420022")).toBe(20);
  });

  it("verifica con l1: dato mancante, poi esiti", () => {
    const a = proponiTerra(corpi, { tipo: "A", calate });
    expect(verificaTerra(a, null).esito).toBe("dato norma mancante");
    expect(verificaTerra(a, 5).esito).toBe("adeguata");      // 3 m ≥ 2,5 m
    expect(verificaTerra(a, 8).esito).toBe("non adeguata");  // 3 m < 4 m
    const b = proponiTerra(corpi, { tipo: "B", calate });
    expect(verificaTerra(b, 20).esito).toBe("adeguata");     // re ≈ 28,8 m
  });
});
