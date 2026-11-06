import { describe, it, expect } from "vitest";
import { generaFileCAD, testoLisp, numeroLisp, leggiEdificioDaCAD } from "./esportaCAD";
import { calcolaSferaRotolante } from "../captazione/sferaRotolante";
import { proponiCaptazione } from "../captazione/proponiCaptazione";

describe("esportazione verso il CAD", () => {
  it("testi ASCII senza virgolette doppie né barre rovesciate", () => {
    expect(testoLisp('Città "nuova" C:\\dati')).toBe(`"Citta 'nuova' C:/dati"`);
    expect(testoLisp(undefined)).toBe('""');
  });
  it("numeri con punto decimale, senza esponenziale né -0", () => {
    expect(numeroLisp(1e-7)).toBe("0.0000");
    expect(numeroLisp(-0.00001)).toBe("0.0000");
    expect(numeroLisp(12345678.9)).toBe("12345678.9000");
    expect(numeroLisp(null)).toBe("nil");
  });
  it("un record per riga, intestazione LPSDATI, zone esposte unite per riga", () => {
    const corpi = [{ id: "A", impronta: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][], altezzaGronda: 5 }];
    const ris = calcolaSferaRotolante({ corpi, raggio: 30, passo: 1 });
    const t = generaFileCAD({ progetto: { codice: "X" }, edificio: { corpi } }, [{ lpl: "II", risultato: ris }]);
    const righe = t.trim().split("\r\n");
    expect(righe[1]!).toBe("(LPSDATI 1)");
    expect(righe.filter((r) => r.startsWith("(CORPO")).length).toBe(1);
    // 11×11 celle tutte esposte → 11 tratti, uno per riga di celle
    expect(righe.filter((r) => r.startsWith("(ESPOSTA")).length).toBe(11);
    for (const r of righe.slice(1)) {
      expect(r.startsWith("(") && r.endsWith(")")).toBe(true);
      let p = 0;
      for (const c of r.replace(/"[^"]*"/g, "")) { p += c === "(" ? 1 : c === ")" ? -1 : 0; expect(p >= 0).toBe(true); }
      expect(p).toBe(0);
    }
  });
  it("con la verifica combinata, il tetto protetto dalla maglia non viene esportato come esposto", () => {
    const corpi = [{ id: "C", impronta: [[0, 0], [60, 0], [60, 40], [0, 40]] as [number, number][], altezzaGronda: 8 }];
    const p = proponiCaptazione(corpi, { raggio: 30, latoMaglia: 10, distanzaCalate: 10 });
    const soloSfera = generaFileCAD({ progetto: {}, edificio: { corpi } }, [{ lpl: "II", risultato: p.sfera }]);
    const combinata = generaFileCAD({ progetto: {}, edificio: { corpi } }, [{ lpl: "II", risultato: p.sfera, combinata: p.combinata }]);
    expect(soloSfera.includes("(ESPOSTA")).toBe(true);   // la sola sfera tocca il centro delle maglie
    expect(combinata.includes("(ESPOSTA")).toBe(false);  // ma la maglia le protegge
  });

  it("lettura del file restituito dal CAD", () => {
    const e = leggiEdificioDaCAD('{"versione":"1","unita":"m","corpi":[{"id":"CAD1","impronta":[[0,0],[1,0],[1,1]],"altezzaGronda":3}]}');
    expect(e.corpi.length).toBe(1);
    expect(() => leggiEdificioDaCAD('{"corpi":[{"impronta":[[0,0]],"altezzaGronda":3}]}')).toThrow();
  });
});
