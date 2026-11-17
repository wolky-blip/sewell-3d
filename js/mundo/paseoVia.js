// N1-FORTUNA-PASEO (carril mina, 15-11-2026): trazado y movimiento del paseo en vagoneta por el interior de la mina Fortuna.
// Solo datos y cálculo (sin escena): se puede importar desde node para revisar tiempos y velocidades (herramientas/paseo_sim.mjs).
// Coordenadas LOCALES de la sala: x y z relativas al origen de la sala (O.x, O.z); y absoluta (Fortuna 5 está en y = -8).
// Recorrido: desvío junto a la vía de Fortuna 5 (x 2,6) → túnel del fondo (z -80) → montaña rusa escondida detrás del muro del fondo
// y al costado derecho de la galería (fuera de la caja negra de la sala) → vuelve por debajo de Fortuna 4 y sale por el túnel de
// la vía (boca en z -40) → vía principal → desvío → se detiene en el MISMO punto, con el mismo rumbo (-z).
import * as THREE from 'three';

// ---------------------------------------------------------------- puntos de control [x, y, z, marcas]
// marcas: c = cadena (velocidad; 0 la suelta), f = freno de ajuste (velocidad máxima; 0 lo suelta), z = zona del túnel desde aquí,
// ini/fin = punto de partida y llegada (el mismo lugar)
const arco = (cx, cz, r, f0, f1, n, ys, sentido = 1) => Array.from({ length: n }, (_, i) => {   // arco horizontal (sentido 1: x = cx - r cos, z = cz - r sin)
  const f = f0 + (f1 - f0) * i / (n - 1);
  return sentido > 0 ? [cx - r * Math.cos(f), ys[i], cz - r * Math.sin(f)] : [cx + r * Math.cos(f), ys[i], cz + r * Math.sin(f)];
});
export const PUNTOS = [
  // ---- desvío de partida y túnel del fondo (la vía principal sigue en x 0)
  [2.6, -8, -64], [2.6, -8, -68], [2.6, -8, -72, { ini: 1, c: 3.3, ca: 0.8 }], [2.5, -8, -74.2], [1.3, -8, -76.9], [0.1, -8, -79.6],
  [0, -8, -82.5], [0, -8, -86.5], [0, -8, -90.5], [0, -8, -94.5],
  // ---- primera subida con cadena (clac-clac)
  [0, -8, -98, { c: 3.0, ca: 1.2 }], [0, -7.75, -101], [0, -7.0, -104], [0, -5.6, -107.5], [0, -3.4, -112], [0, -1.2, -116.5], [0, 0.6, -120.5],
  [0, 1.6, -123.8], [0, 1.9, -126.3, { c: 0 }], [0, 1.6, -128.6],
  // ---- gran bajada
  [0.15, 0.3, -131], [0.6, -2.6, -133.8], [1.3, -6.4, -136.6], [2.1, -10.2, -139.6], [3.0, -13.0, -142.8], [4.0, -14.4, -146.5, { f: 10.5 }], [4.8, -14.4, -150.5],
  // ---- caverna grande (curva peraltada a la derecha, 180°, sobre caballetes) con vetas de mineral
  ...arco(22, -153.5, 17, 0, Math.PI, 10, [-14.0, -13.4, -12.6, -12.1, -11.9, -12.0, -12.4, -12.9, -13.4, -13.7]).map((p, i) => i === 0 ? [...p, { z: 'cueva' }] : i === 2 ? [...p, { f: 0 }] : i === 8 ? [...p, { f: 7.5 }] : p),
  // ---- puente de caballetes sobre el pique
  [39, -13.8, -149, { z: 'pique' }], [39, -13.8, -144], [39, -13.8, -139], [39, -13.8, -134], [39, -13.8, -129.5, { f: 0 }],
  // ---- segunda bajada y curvas en S
  [39, -14.3, -125.5, { z: 'tunel' }], [39, -15.8, -122], [39, -17.6, -118.5], [39, -19.1, -114.8], [38.9, -19.8, -110.8], [38.2, -19.8, -106],
  [36.6, -19.6, -101], [35.0, -19.5, -95.5], [34.8, -19.5, -89.5], [36.2, -19.5, -84], [38.0, -19.5, -79, { f: 5 }], [38.6, -19.5, -74.5],
  // ---- galería con mineros trabajando (despacio)
  [38.6, -19.5, -70, { z: 'galeria' }], [38.6, -19.5, -65.5], [38.6, -19.5, -61], [38.6, -19.5, -56.5, { f: 0, c: 3.0, ca: 1.0 }],
  // ---- segunda subida con cadena
  [38.6, -19.3, -53, { z: 'tunel' }], [38.6, -18.6, -50], [38.6, -17.2, -46.6], [38.6, -14.8, -42], [38.6, -12.2, -37], [38.6, -9.6, -32], [38.6, -7.0, -27],
  [38.6, -5.0, -22.6], [38.6, -3.8, -19.1], [38.6, -3.4, -16.4, { c: 0 }], [38.6, -3.6, -14],
  // ---- bajada y vuelta en U a la derecha por debajo de Fortuna 4
  [38.6, -5.2, -11.2], [38.6, -8.0, -8.0], [38.6, -10.4, -4.8],
  ...arco(19.3, -1.5, 19.3, 0, Math.PI, 9, [-11.4, -11.1, -10.6, -10.0, -9.5, -9.0, -8.6, -8.35, -8.2], -1),
  // ---- recta bajo Fortuna 4, frenos, túnel de la vía (boca en z -40) y vía principal de Fortuna 5
  [0, -8.1, -6.5], [0, -8.03, -11.5, { f: 3.8, c: 3.6, ca: 0.6 }], [0, -8, -16.5], [0, -8, -21.5], [0, -8, -26.5], [0, -8, -31.5], [0, -8, -36.5], [0, -8, -41.5],
  [0, -8, -46.5], [0, -8, -51.5], [0, -8, -55],
  // ---- desvío de llegada: vuelve al mismo punto
  [0.1, -8, -57.6], [1.3, -8, -60.6], [2.5, -8, -63.4], [2.6, -8, -66], [2.6, -8, -69], [2.6, -8, -72, { fin: 1 }], [2.6, -8, -75], [2.6, -8, -78],
];

// ---------------------------------------------------------------- perfil del túnel por zona (relativo a la vía, en su plano normal)
// hwI/hwD: medio ancho a la izquierda/derecha del sentido de marcha; yw: alto del muro; yr: alto de la clave; fondo: piso bajo la vía
// (con más de 0,6 m la vía va sobre caballetes)
export const PERFIL = {
  tunel: { hwI: 2.05, hwD: 2.05, yw: 2.55, yr: 3.7, fondo: 0.03 },
  cueva: { hwI: 15, hwD: 10, yw: 7, yr: 15, fondo: 11 },
  pique: { hwI: 6.5, hwD: 6.5, yw: 11, yr: 14, fondo: 26 },
  galeria: { hwI: 3.5, hwD: 3.5, yw: 2.9, yr: 4.3, fondo: 0.03 },
};
const CLAVES = ['hwI', 'hwD', 'yw', 'yr', 'fondo'];
export const GRAV = 9.8, FISICA = { mu: 0.014, k: 0.0019, frenoA: 4.5, paradaA: 0.5, dt: 1 / 240 };

let CACHE = null;
export function armarVia() {
  if (CACHE) return CACHE;
  const pts = PUNTOS.map(p => new THREE.Vector3(p[0], p[1], p[2])), marcas = PUNTOS.map(p => p[3] || null);
  const curva = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const n = pts.length, SUB = 48, N = (n - 1) * SUB, den = [], sDen = [0];
  for (let i = 0; i <= N; i++) { den.push(curva.getPoint(i / N)); if (i) sDen.push(sDen[i - 1] + den[i].distanceTo(den[i - 1])); }
  const sPunto = i => sDen[i * SUB];
  const L = sDen[N], DS = 0.25, M = Math.floor(L / DS) + 1;
  const pos = new Float32Array(M * 3), tan = new Float32Array(M * 3), der = new Float32Array(M * 3), arr = new Float32Array(M * 3);
  for (let k = 0, j = 0; k < M; k++) {
    const s = k * DS; while (j < N - 1 && sDen[j + 1] < s) j++;
    const a = den[j], b = den[Math.min(N, j + 1)], f = Math.min(1, (s - sDen[j]) / Math.max(1e-6, sDen[j + 1] - sDen[j]));
    pos[k * 3] = a.x + (b.x - a.x) * f; pos[k * 3 + 1] = a.y + (b.y - a.y) * f; pos[k * 3 + 2] = a.z + (b.z - a.z) * f;
  }
  const P = k => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  for (let k = 0; k < M; k++) { const t = P(Math.min(M - 1, k + 1)).sub(P(Math.max(0, k - 1))).normalize(); tan.set([t.x, t.y, t.z], k * 3); }
  const T = k => new THREE.Vector3(tan[k * 3], tan[k * 3 + 1], tan[k * 3 + 2]);
  // zonas por marcas (desde el punto con la marca hasta la siguiente marca del mismo tipo)
  const tramos = clave => { const r = []; let act = null; marcas.forEach((m, i) => { if (!m || m[clave] === undefined) return; if (act) { act.s1 = sPunto(i); r.push(act); act = null; } if (m[clave]) act = { s0: sPunto(i), v: m[clave], a: m.ca }; }); if (act) { act.s1 = L; r.push(act); } return r; };
  const cadenas = tramos('c'), frenos = tramos('f');
  const zonas = []; marcas.forEach((m, i) => { if (m && m.z) zonas.push({ s: sPunto(i), z: m.z }); });
  const zonaEn = s => { let z = 'tunel'; for (const q of zonas) if (q.s <= s) z = q.z; return z; };
  const sIni = sPunto(marcas.findIndex(m => m && m.ini)), sFin = sPunto(marcas.findIndex(m => m && m.fin));
  const en = (lista, s) => lista.find(q => s >= q.s0 && s < q.s1);
  // ---- simulación: gravedad a lo largo de la vía, roce, aire, cadena (no deja bajar de su velocidad) y frenos de ajuste
  const tAt = new Float32Array(M).fill(-1), vAt = new Float32Array(M), frAt = new Uint8Array(M), caAt = new Uint8Array(M);
  let s = sIni, v = 0, t = 0, vMinLibre = 99, kUlt = Math.floor(sIni / DS);
  const { mu, k: kAire, frenoA, paradaA, dt } = FISICA;
  tAt[kUlt] = 0;
  while (s < sFin - 0.002 && t < 400) {
    const k = Math.min(M - 1, Math.floor(s / DS)), ty = tan[k * 3 + 1];
    const ca = en(cadenas, s), fr = en(frenos, s);
    let v1 = v + (-GRAV * ty - mu * GRAV * Math.sqrt(1 - ty * ty) - kAire * v * v) * dt, frena = 0;
    if (ca && v1 < ca.v) v1 = Math.max(v1, Math.min(ca.v, v + (ca.a || 1) * dt));
    if (fr && v1 > fr.v) { v1 = Math.max(fr.v, v1 - frenoA * dt); frena = 1; }
    const vMax = Math.sqrt(2 * paradaA * Math.max(0, sFin - s)) + 0.04;   // llegada: frena suave hasta detenerse en sFin
    if (v1 > vMax) { v1 = vMax; frena = sFin - s < 14 ? 2 : 1; }
    if (!ca && s - sIni > 2 && sFin - s > 14) vMinLibre = Math.min(vMinLibre, v1);
    v1 = Math.max(v1, 0.06);
    s += v1 * dt; t += dt; v = v1;
    const k2 = Math.min(M - 1, Math.floor(s / DS));
    for (let q = kUlt + 1; q <= k2; q++) { tAt[q] = t; vAt[q] = v; frAt[q] = frena; caAt[q] = ca ? 1 : 0; }
    kUlt = Math.max(kUlt, k2);
  }
  const kIni = Math.floor(sIni / DS), kFin = kUlt;
  vAt[kIni] = 0;
  // ---- peralte: inclinación hacia adentro según la aceleración lateral (v² · curvatura horizontal), suavizada y limitada a ±36°
  const bankC = new Float32Array(M), bank = new Float32Array(M);
  for (let k = 4; k < M - 4; k++) {
    const a = T(k - 4), b = T(k + 4), ps = Math.atan2(a.x, a.z), pn = Math.atan2(b.x, b.z);
    let d = pn - ps; d = Math.atan2(Math.sin(d), Math.cos(d));
    const hz = Math.hypot(a.x, a.z) * Math.hypot(b.x, b.z);
    const vv = vAt[k] || 0;
    bankC[k] = -Math.atan(vv * vv * (d / (8 * DS)) * Math.min(1, hz) / GRAV);
  }
  for (let k = 0; k < M; k++) { let sm = 0, c = 0; for (let q = -14; q <= 14; q++) { const i = k + q; if (i < 0 || i >= M) continue; sm += bankC[i]; c++; } bank[k] = Math.max(-0.63, Math.min(0.63, sm / c)); }
  const Y = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < M; k++) {
    const t3 = T(k), r = t3.clone().cross(Y); if (r.lengthSq() < 1e-6) r.set(1, 0, 0); r.normalize();
    const u = r.clone().cross(t3).normalize();
    r.applyAxisAngle(t3, bank[k]); u.applyAxisAngle(t3, bank[k]);
    der.set([r.x, r.y, r.z], k * 3); arr.set([u.x, u.y, u.z], k * 3);
  }
  // ---- perfil del túnel por muestra (media móvil de 8 m entre zonas: transición suave)
  const perfil = {}; for (const c of CLAVES) perfil[c] = new Float32Array(M);
  const W = Math.round(4 / DS);
  const crudo = CLAVES.map(c => Float32Array.from({ length: M }, (_, k) => PERFIL[zonaEn(k * DS)][c]));
  CLAVES.forEach((c, ci) => { const pre = new Float64Array(M + 1); for (let k = 0; k < M; k++) pre[k + 1] = pre[k] + crudo[ci][k]; for (let k = 0; k < M; k++) { const a = Math.max(0, k - W), b = Math.min(M, k + W + 1); perfil[c][k] = (pre[b] - pre[a]) / (b - a); } });
  for (let k = 0; k < M; k++) perfil.fondo[k] += 0.6 * Math.abs(Math.sin(bank[k]));   // piso más abajo en los peraltes (el riel de adentro baja)
  const zonaK = Array.from({ length: M }, (_, k) => zonaEn(k * DS));
  CACHE = { L, DS, M, pos, tan, der, arr, bank, vAt, tAt, frAt, caAt, perfil, zonaK, sIni, sFin, kIni, kFin, tTotal: tAt[kFin], vMinLibre, sPunto, cadenas, frenos, zonas, marcas };
  return CACHE;
}

// estado a un tiempo t del paseo: s, v, freno, cadena (interpolado entre muestras)
export function enTiempo(V, t) {
  const { tAt, kIni, kFin, DS } = V;
  if (t <= 0) return { s: kIni * DS, k: kIni, f: 0, v: 0, fr: 0, ca: 0 };
  if (t >= tAt[kFin]) return { s: kFin * DS, k: kFin, f: 0, v: 0, fr: 0, ca: 0 };
  let a = kIni, b = kFin;
  while (b - a > 1) { const m = (a + b) >> 1; if (tAt[m] <= t) a = m; else b = m; }
  const f = (t - tAt[a]) / Math.max(1e-6, tAt[b] - tAt[a]);
  return { s: (a + f) * DS, k: a, f, v: V.vAt[a] + (V.vAt[b] - V.vAt[a]) * f, fr: V.frAt[b], ca: V.caAt[b] };
}
// posición y ejes de la vía en s (interpolados)
export function marcoEn(V, s, out = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() }) {
  const x = Math.max(0, Math.min(V.M - 1.001, s / V.DS)), k = Math.floor(x), f = x - k;
  const L = (arr, v) => v.set(arr[k * 3] + (arr[k * 3 + 3] - arr[k * 3]) * f, arr[k * 3 + 1] + (arr[k * 3 + 4] - arr[k * 3 + 1]) * f, arr[k * 3 + 2] + (arr[k * 3 + 5] - arr[k * 3 + 2]) * f);
  L(V.pos, out.p); L(V.tan, out.t).normalize(); L(V.der, out.r).normalize(); L(V.arr, out.u).normalize();
  return out;
}
