/**
 * Conversione di una geometria 3D (three.js / glTF / OBJ / IFC tramite web-ifc) nel formato
 * "triangoli" del motore della sfera rotolante (metri, asse z verso l'alto).
 *
 * three.js e glTF usano l'asse Y verso l'alto: con yVersoAlto = true il punto (x, y, z) del
 * modello diventa (x, −z, y) del progetto, cioè la pianta resta x/y e la quota è z.
 */

/** Applica una matrice 4×4 in ordine colonne (come Matrix4.elements di three.js). */
function trasforma(m: ArrayLike<number>, x: number, y: number, z: number): [number, number, number] {
  const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]! || 1;
  return [
    (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w,
    (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w,
    (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!) / w,
  ];
}

export interface OpzioniConversione {
  indici?: ArrayLike<number> | null | undefined;   // geometry.index (null se non indicizzata)
  matrice?: ArrayLike<number> | null | undefined;  // mesh.matrixWorld.elements
  yVersoAlto?: boolean | undefined;                // default true (three.js, glTF)
  scala?: number | undefined;                      // fattore per portare in metri (es. 0.001 da mm)
  traslazione?: [number, number, number] | undefined; // spostamento finale nelle coordinate di progetto
}

export function triangoliDaGeometria(posizioni: ArrayLike<number>, op: OpzioniConversione = {}): Float32Array {
  const yUp = op.yVersoAlto ?? true;
  const k = op.scala ?? 1;
  const [tx, ty, tz] = op.traslazione ?? [0, 0, 0];
  const nVert = Math.floor(posizioni.length / 3);
  const idx = op.indici ?? null;
  const nTri = idx ? Math.floor(idx.length / 3) : Math.floor(nVert / 3);
  const out = new Float32Array(nTri * 9);
  for (let t = 0; t < nTri; t++) {
    for (let v = 0; v < 3; v++) {
      const vi = idx ? idx[t * 3 + v]! : t * 3 + v;
      let x = posizioni[vi * 3]!, y = posizioni[vi * 3 + 1]!, z = posizioni[vi * 3 + 2]!;
      if (op.matrice) [x, y, z] = trasforma(op.matrice, x, y, z);
      const px = x * k, py = (yUp ? -z : y) * k, pz = (yUp ? y : z) * k;
      out[t * 9 + v * 3] = px + tx;
      out[t * 9 + v * 3 + 1] = py + ty;
      out[t * 9 + v * 3 + 2] = pz + tz;
    }
  }
  return out;
}

/** Unisce più blocchi di triangoli (una mesh per elemento IFC, per esempio). */
export function unisciTriangoli(blocchi: ArrayLike<number>[]): Float32Array {
  const n = blocchi.reduce((t, b) => t + b.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const b of blocchi) { out.set(Array.from(b), o); o += b.length; }
  return out;
}
