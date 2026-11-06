import { describe, it, expect } from "vitest";
import {
  calcolaSferaRotolante,
  inviluppoInPunto,
  confrontaLivelli,
  suggerisciAste,
  percorsoSfera,
  inviluppoSuGriglia,
  distanzaQuadra,
  type Corpo,
} from "./sferaRotolante";

const rett = (id: string, x0: number, y0: number, L: number, W: number, H: number): Corpo => ({
  id,
  impronta: [[x0, y0], [x0 + L, y0], [x0 + L, y0 + W], [x0, y0 + W]],
  altezzaGronda: H,
  tipoTetto: "piano",
});

/** penetrazione analitica della sfera tra due captatori distanti d */
const penetrazione = (r: number, d: number) => r - Math.sqrt(r * r - (d / 2) ** 2);

describe("trasformata della distanza", () => {
  it("distanza esatta da una cella", () => {
    const m = new Uint8Array(25);
    m[12] = 1; // centro di una griglia 5x5
    const d = distanzaQuadra(m, 5, 5);
    expect(d[0]!).toBe(8); // (2,2) → 2²+2²
    expect(d[13]!).toBe(1);
    expect(d[12]!).toBe(0);
  });
});

describe("sfera rotolante – coperture senza captatori", () => {
  it("tetto piano 20×20 m, LPL III (r = 45 m): tutto esposto, pareti no (H < r)", () => {
    const ris = calcolaSferaRotolante({ corpi: [rett("A", 0, 0, 20, 20, 10)], raggio: 45, passo: 0.5 });
    expect(ris.areaCopertura).toBeCloseTo(400, 3);
    expect(ris.areaCoperturaEsposta).toBe(ris.areaCopertura);
    expect(ris.areaPareteEsposta).toBe(0);
    expect(ris.esito).toBe("non adeguata");
  });

  it("edificio alto 60 m con r = 20 m: pareti esposte sopra i 20 m", () => {
    const ris = calcolaSferaRotolante({ corpi: [rett("T", 0, 0, 20, 20, 60)], raggio: 20, passo: 0.5 });
    const quote = ris.facceEsposte.map((f) => f.zDa);
    const zMin = Math.min(...quote);
    expect(zMin).toBeGreaterThan(19.5);
    expect(zMin).toBeLessThan(20.1);
    // perimetro ≈ 84 m (celle di bordo) × 40 m di altezza esposta
    expect(ris.areaPareteEsposta).toBeGreaterThan(80 * 39);
    expect(ris.areaPareteEsposta).toBeLessThan(86 * 41);
  });
});

describe("sfera rotolante – confronto con le soluzioni analitiche", () => {
  it("asta singola su tetto piano: inviluppo e raggio protetto sqrt(h(2r − h))", () => {
    const r = 20, H = 5, ha = 5;
    const ris = calcolaSferaRotolante({
      corpi: [rett("A", -40, -40, 80, 80, H)],
      aste: [{ x: 0, y: 0, altezza: ha }],
      raggio: r,
      passo: 0.25,
    });
    const rp = Math.sqrt(ha * (2 * r - ha)); // 13,23 m
    for (const d of [1, 3, 6, 9, 12, 13]) {
      const atteso = H + r - Math.sqrt(r * r - (rp - d) ** 2);
      for (const e of [inviluppoInPunto(ris, d, 0), inviluppoInPunto(ris, d * 0.7071, d * 0.7071), inviluppoInPunto(ris, -d * 0.6, d * 0.8)]) {
        // vicino alla soglia (d ≥ 9 m) l'errore deve essere trascurabile
        expect(Math.abs(e - atteso)).toBeLessThan(d >= 9 ? 0.003 : 0.02);
      }
    }
    // area protetta ≈ π·rp² (ridotta solo dalla tolleranza di 1 cm)
    const protetta = ris.areaCopertura - ris.areaCoperturaEsposta;
    const teorica = Math.PI * rp * rp;
    expect(protetta).toBeLessThanOrEqual(teorica * 1.01);
    expect(protetta).toBeGreaterThan(0.88 * teorica);
  });

  it("due conduttori paralleli: penetrazione r − sqrt(r² − (d/2)²)", () => {
    const r = 20, H = 5, d = 10, zc = H + 1;
    const ris = calcolaSferaRotolante({
      corpi: [rett("A", -40, -40, 80, 80, H)],
      conduttori: [
        { punti: [[-d / 2, -40, zc], [-d / 2, 40, zc]] },
        { punti: [[d / 2, -40, zc], [d / 2, 40, zc]] },
      ],
      raggio: r,
      passo: 0.25,
    });
    const p = penetrazione(r, d); // 0,635 m
    const e = inviluppoInPunto(ris, 0, 0);
    expect(Math.abs(e - (zc - p))).toBeLessThan(0.01);
  });

  it("due aste: la sfera scende tra le punte almeno della penetrazione", () => {
    const r = 30, H = 0.01, ha = 10, d = 20;
    const ris = calcolaSferaRotolante({
      corpi: [rett("A", -30, -30, 60, 60, H)],
      aste: [{ x: -d / 2, y: 0, altezza: ha, zBase: H }, { x: d / 2, y: 0, altezza: ha, zBase: H }],
      raggio: r,
      passo: 0.25,
    });
    const e = inviluppoInPunto(ris, 0, 0);
    expect(e).toBeLessThanOrEqual(H + ha - penetrazione(r, d) + 0.01);
  });
});

describe("sfera rotolante – casi di progetto", () => {
  const corpi = [rett("A", 0, 0, 20, 20, 10)];

  it("tetto 20×20 m LPL III: con 4 aste agli angoli + 1 al centro l'esposizione si riduce", () => {
    const senza = calcolaSferaRotolante({ corpi, raggio: 45, passo: 0.5 });
    const con = calcolaSferaRotolante({
      corpi,
      raggio: 45,
      passo: 0.5,
      aste: [
        { x: 0.5, y: 0.5, altezza: 3 }, { x: 19.5, y: 0.5, altezza: 3 },
        { x: 0.5, y: 19.5, altezza: 3 }, { x: 19.5, y: 19.5, altezza: 3 },
        { x: 10, y: 10, altezza: 3 },
      ],
    });
    expect(con.areaCoperturaEsposta).toBeLessThan(senza.areaCoperturaEsposta * 0.2);
  });

  it("suggerisci aste: porta a zero la copertura esposta", () => {
    const { asteAggiunte, risultato } = suggerisciAste({ corpi, raggio: 45, passo: 0.5 }, 3);
    expect(asteAggiunte.length).toBeGreaterThan(0);
    expect(asteAggiunte.length).toBeLessThanOrEqual(5); // 4 agli spigoli bastano con h = 3 m
    expect(risultato.areaCoperturaEsposta).toBe(0);
    expect(risultato.esito).toBe("adeguata");
  });

  it("asta sullo spigolo: appoggia sul tetto, non a terra", () => {
    const sopra = calcolaSferaRotolante({ corpi, raggio: 45, passo: 0.5, aste: [{ x: 0, y: 0, altezza: 3 }] });
    const dentro = calcolaSferaRotolante({ corpi, raggio: 45, passo: 0.5, aste: [{ x: 0.01, y: 0.01, altezza: 3 }] });
    expect(Math.abs(sopra.areaCoperturaEsposta - dentro.areaCoperturaEsposta)).toBeLessThan(5);
  });

  it("confronto 4 livelli: a raggio maggiore, meno superficie esposta", () => {
    const { riepilogo } = confrontaLivelli(
      { corpi, aste: [{ x: 10, y: 10, altezza: 4 }], passo: 0.5 },
      { I: 20, II: 30, III: 45, IV: 60 },
    );
    const a = riepilogo.map((x) => x.areaCoperturaEsposta);
    expect(a[0]!).toBeGreaterThanOrEqual(a[1]!);
    expect(a[1]!).toBeGreaterThanOrEqual(a[2]!);
    expect(a[2]!).toBeGreaterThanOrEqual(a[3]!);
  });

  it("corpo basso addossato a un corpo alto: protetto se stretto, esposto se largo", () => {
    // corpo alto 30 m, r = 20 m: una sfera appoggiata al suolo ha il centro ad almeno
    // 20 m dalla parete → un corpo basso (3 m) largo 4 m resta nell'ombra del corpo alto
    const stretto = calcolaSferaRotolante({
      corpi: [rett("alto", 0, 0, 20, 20, 30), rett("basso", 20, 0, 4, 20, 3)],
      raggio: 20,
      passo: 0.5,
    });
    let espBasso = 0;
    stretto.esposta.forEach((v, k) => { if (v === 1 && stretto.corpoCella[k]! === 1) espBasso++; });
    expect(espBasso).toBe(0);
    // largo 30 m: il bordo esterno è esposto, la fascia vicino alla parete no
    const largo = calcolaSferaRotolante({
      corpi: [rett("alto", 0, 0, 20, 20, 30), rett("basso", 20, 0, 30, 20, 3)],
      raggio: 20,
      passo: 0.5,
    });
    expect(inviluppoInPunto(largo, 49.5, 10) - 3).toBeLessThan(0.06);
    expect(inviluppoInPunto(largo, 21, 10) - 3).toBeGreaterThan(1);
    // la parete libera del corpo alto è esposta sopra i 20 m
    const zMin = Math.min(...largo.facceEsposte.filter((f) => f.normale[0] === -1).map((f) => f.zDa));
    expect(zMin).toBeGreaterThan(19.5);
  });

  it("tetto a falde: il colmo è esposto", () => {
    const ris = calcolaSferaRotolante({
      corpi: [{ ...rett("F", 0, 0, 30, 12, 8), tipoTetto: "falde", altezzaColmo: 11 }],
      raggio: 30,
      passo: 0.5,
    });
    expect(inviluppoInPunto(ris, 15, 6) - 11).toBeLessThan(0.06);
    expect(ris.areaCoperturaEsposta).toBeGreaterThan(0);
  });

  it("percorso e inviluppo su griglia per il 3D/DXF", () => {
    const ris = calcolaSferaRotolante({ corpi, raggio: 45, passo: 0.5 });
    const p = percorsoSfera(ris, [-10, 10], [30, 10], 1);
    expect(p.length).toBe(41);
    expect(Math.abs(p[20]![2] - (10 + 45))).toBeLessThan(0.06); // centro sopra il tetto
    const inv = inviluppoSuGriglia(ris, 2);
    expect(inv.z.length).toBe(inv.ny);
  });

  it("edificio alto ruotato di 30°: pareti esposte sopra r anche se non allineate alla griglia", () => {
    const a = Math.PI / 6;
    const rot = ([x, y]: [number, number]): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const ris = calcolaSferaRotolante({
      corpi: [{ id: "R", impronta: [[0, 0], [25, 0], [25, 15], [0, 15]].map((p) => rot(p as [number, number])), altezzaGronda: 50 }],
      raggio: 20,
      passo: 0.5,
    });
    const quote = ris.facceEsposte.map((f) => f.zDa).sort((x, y) => x - y);
    const mediana = quote[Math.floor(quote.length / 2)]!;
    expect(quote.length).toBeGreaterThan(100);
    expect(Math.abs(mediana - 20)).toBeLessThan(0.3);
    // area: perimetro 80 m × 30 m esposti (±10 % per la scalettatura)
    expect(Math.abs(ris.areaPareteEsposta - 80 * 30) / (80 * 30)).toBeLessThan(0.1);
  });

  it("magliatura 10×10 m su capannone 60×40 m, LPL II", () => {
    const H = 8;
    const maglia = (zc: number) => {
      const c = [];
      for (let x = 0; x <= 60; x += 10) c.push({ punti: [[x, 0, zc], [x, 40, zc]] as [number, number, number][] });
      for (let y = 0; y <= 40; y += 10) c.push({ punti: [[0, y, zc], [60, y, zc]] as [number, number, number][] });
      return c;
    };
    // conduttori a filo tetto: la sfera tocca la copertura al centro delle maglie
    // (corretto: in questo caso vale la verifica con il metodo della maglia)
    const filo = calcolaSferaRotolante({ corpi: [rett("C", 0, 0, 60, 40, H)], conduttori: maglia(H), raggio: 30 });
    expect(Math.abs(inviluppoInPunto(filo, 25, 15) - H)).toBeLessThan(0.01);
    // conduttori sollevati di 1 m: la sfera appoggia sui due lati più vicini (distanza 5 m)
    const zc = H + 1;
    const alto = calcolaSferaRotolante({ corpi: [rett("C", 0, 0, 60, 40, H)], conduttori: maglia(zc), raggio: 30 });
    const p = 30 - Math.sqrt(900 - 25);
    expect(Math.abs(inviluppoInPunto(alto, 25, 15) - (zc - p))).toBeLessThan(0.01);
    expect(alto.areaCoperturaEsposta).toBe(0);
    expect(alto.tempoMs).toBeLessThan(5000);
  });

  it("prestazioni: 40×20×12 m, r = 60 m, passo automatico", () => {
    const ris = calcolaSferaRotolante({ corpi: [rett("A", 0, 0, 40, 20, 12)], raggio: 60 });
    expect(ris.tempoMs).toBeLessThan(3000);
  });
});
