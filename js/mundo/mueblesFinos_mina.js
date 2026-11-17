// G9M (16-11-2026): muebles FINOS de la mina, en código (estilo mueblesFinos.js, sin GPU).
//   jaula_mina  jaula del pique (reemplaza la malla cabina_ascensor, que a 1080p se veía «acuarela», cerrada y con botonera moderna):
//               piso de tablones con cantonera de fierro, 4 pilares de roble escuadrado con zunchos y pernos, costados y fondo de listones
//               verticales con travesaños y pasamanos, techo de tablas con vigas, horquilla de fierro con argolla para el cable, zapatas
//               de guía a los costados, farol de lata colgado y REJA DE TIJERA de pletina al frente (recogida a la izquierda: el vano queda abierto).
// Marco local: pivote en el piso al centro, frente (vano y reja) hacia +z. 1,5 × 2,4 × 1,5 m.
import * as THREE from 'three';
import { registrarFabrica, HERRAMIENTAS_FINAS } from './mueblesFinos.js';

const { curva, manta, almohada, uvMetros } = HERRAMIENTAS_FINAS;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const MAD = 0x6a4a2c, MAD2 = 0x5a3c22, FIE = 0x2e2c2a, OX = 0x5a3a24;

function jaulaMina(A, op) {
  const q = A.q, w = 1.5, h = 2.4, d = 1.5, hw = w / 2, hd = d / 2, yT = 2.25;
  // piso: 6 tablones con junta y cantonera de fierro
  for (let i = 0; i < 6; i++) A.bloque('madera', w - 0.02, 0.06, d / 6 - 0.008, 0.006, 0, 0.05, -hd + (i + 0.5) * d / 6, i % 2 ? MAD : MAD2, { seg: [3, 1, 1], veta: 'x' });
  A.bloque('madera', w, 0.1, 0.1, 0.01, 0, 0.0 + 0.03, -hd + 0.05, MAD2, { veta: 'x' }); A.bloque('madera', w, 0.1, 0.1, 0.01, 0, 0.03, hd - 0.05, MAD2, { veta: 'x' });   // soleras
  for (const s of [-1, 1]) A.bloque('pintura', w + 0.01, 0.012, 0.05, 0.002, 0, 0.085, s * (hd - 0.02), FIE, { seg: [2, 1, 1] });   // cantonera
  // pilares con zunchos y pernos
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * (hw - 0.05), z = sz * (hd - 0.05);
    A.bloque('madera', 0.1, yT - 0.02, 0.1, 0.008, x, (yT + 0.02) / 2, z, MAD, { seg: [1, 4, 1], veta: 'y' });
    for (const y of [0.2, 1.05, 2.0]) { A.bloque('pintura', 0.114, 0.05, 0.114, 0.003, x, y, z, FIE, { seg: [1, 1, 1] });
      if (q) for (const [dx, dz] of [[0.058, 0], [0, 0.058]]) A.esfera('pintura', 0.011, x + Math.sign(x) * dx, y, z + Math.sign(z) * dz, OX, 0.5); }
  }
  // costados (±x) y fondo (−z): solera de arriba, travesaños, pasamanos y listones verticales con luz entre ellos
  const lado = (eje, s) => {   // eje 'x' = costado en x = s·hw; 'z' = fondo
    const L = (eje === 'x' ? d : w) - 0.2, P = (u, y) => eje === 'x' ? [s * (hw - 0.05), y, u] : [u, y, s * (hd - 0.05)];
    for (const y of [0.16, 1.05, yT - 0.05]) { const [x, yy, z] = P(0, y); A.bloque('madera', eje === 'x' ? 0.07 : L, 0.08, eje === 'x' ? L : 0.07, 0.008, x, yy, z, MAD2, { veta: eje === 'x' ? 'z' : 'x' }); }
    const n = 8; for (let i = 0; i < n; i++) { const u = -L / 2 + (i + 0.5) * L / n, [x, , z] = P(u, 0);
      A.bloque('madera', eje === 'x' ? 0.03 : 0.07, yT - 0.32, eje === 'x' ? 0.07 : 0.03, 0.006, x + (eje === 'x' ? -s * 0.0 : 0), 0.2 + (yT - 0.32) / 2, z, i % 3 ? MAD : MAD2, { seg: [1, 3, 1], veta: 'y' }); }
    { const [x, yy, z] = P(0, 1.02); A.tubo('pintura', eje === 'x' ? [V3(x - s * 0.09, yy, -L / 2), V3(x - s * 0.09, yy, L / 2)] : [V3(-L / 2, yy, z - s * 0.09), V3(L / 2, yy, z - s * 0.09)], 0.016, FIE, { lados: q ? 8 : 4 });   // pasamanos de fierro
      for (const u of [-L / 2 + 0.1, 0, L / 2 - 0.1]) { const [a, , b] = P(u, 0); A.tubo('pintura', eje === 'x' ? [V3(a, yy, b), V3(a - s * 0.09, yy, b)] : [V3(a, yy, b), V3(a, yy, b - s * 0.09)], 0.01, FIE, { lados: 4 }); } }
    { const [x, yy, z] = P(0, 0.6); if (eje === 'x') { A.bloque('pintura', 0.06, 0.18, 0.16, 0.004, x + s * 0.07, 0.6, 0, FIE, { seg: [1, 1, 1] }); A.bloque('pintura', 0.06, 0.18, 0.16, 0.004, x + s * 0.07, 1.9, 0, FIE, { seg: [1, 1, 1] }); } }   // zapatas de guía
  };
  lado('x', -1); lado('x', 1); lado('z', -1);
  // techo: vigas, tablas y horquilla de fierro con argolla para el cable
  for (const s of [-1, 1]) A.bloque('madera', 0.12, 0.14, d + 0.04, 0.01, s * 0.35, yT + 0.07, 0, MAD2, { veta: 'z' });
  for (let i = 0; i < 7; i++) A.bloque('madera', w / 7 - 0.01, 0.04, d + 0.06, 0.004, -hw + (i + 0.5) * w / 7, yT + 0.16, 0, i % 2 ? MAD : MAD2, { seg: [1, 1, 3], veta: 'z' });
  for (const s of [-1, 1]) A.tubo('pintura', curva(t => V3(s * 0.35 * (1 - t), yT + 0.18 + 0.2 * Math.sin(PI2 * t), 0), q ? 8 : 3), 0.022, FIE, { lados: q ? 8 : 4 });
  A.tubo('pintura', curva(t => V3(0, h - 0.04 + 0.04 * Math.cos(2 * Math.PI * t), 0.04 * Math.sin(2 * Math.PI * t)), q ? 14 : 6).slice(0, -1), 0.012, FIE, { lados: q ? 6 : 4, cerrado: true });   // argolla
  // farol de lata colgado del techo (la luz la dan los puntos del paseo)
  A.tubo('pintura', [V3(0.3, yT - 0.0, 0.3), V3(0.3, yT - 0.25, 0.3)], 0.004, FIE, { lados: 3 });
  A.torno('pintura', [[0, 0], [0.06, 0], [0.065, 0.02], [0.05, 0.03], [0.05, 0.16], [0.07, 0.18], [0.02, 0.24], [0, 0.25]], 0.3, yT - 0.5, 0.3, 0x3a3632, q ? 12 : 6);
  A.torno('vidrio', [[0, 0.03], [0.048, 0.03], [0.048, 0.16], [0, 0.16]], 0.3, yT - 0.5, 0.3, 0xf0e8d0, q ? 12 : 6);
  A.esfera('llama', 0.018, 0.3, yT - 0.42, 0.3, 0xffc070, 1.8);
  // reja de tijera al frente: pletinas verticales y en X, recogida entre x −0,7 y x −0,05 (5 módulos plegados)
  const z = hd - 0.02, x0 = -hw + 0.08, x1 = -0.08, nM = 6, yb = 0.1, yt = 2.1, m = (x1 - x0) / nM;
  for (const y of [yb, yt]) A.bloque('pintura', x1 - x0 + 0.04, 0.03, 0.03, 0.003, (x0 + x1) / 2, y, z, FIE, { seg: [2, 1, 1] });   // guías
  for (let i = 0; i <= nM; i++) A.bloque('pintura', 0.022, yt - yb, 0.008, 0.002, x0 + i * m, (yb + yt) / 2, z, FIE, { seg: [1, 2, 1] });
  const nX = 6, hX = (yt - yb) / nX;
  for (let i = 0; i < nM; i++) for (let k = 0; k < nX; k++) for (const sg of [-1, 1]) {
    const xa = x0 + i * m, ya = yb + k * hX, L = Math.hypot(m, hX), a = Math.atan2(hX, m) * sg;
    const g = new THREE.BoxGeometry(L, 0.016, 0.005).rotateZ(a).translate(xa + m / 2, ya + hX / 2, z + sg * 0.006); A.add('pintura', g, FIE);
    if (q) A.torno('pintura', [[0, -0.008], [0.009, -0.008], [0.009, 0.008], [0, 0.008]], xa + m / 2, ya + hX / 2, z, OX, 6, new THREE.Matrix4().makeRotationX(Math.PI / 2));   // remache del cruce
  }
  A.tubo('pintura', [V3(x1 + 0.02, 1.05, z), V3(x1 + 0.02, 1.05, z + 0.06), V3(x1 + 0.02, 1.2, z + 0.06), V3(x1 + 0.02, 1.2, z)], 0.008, FIE, { lados: 4 });   // manilla
  return [w, h, d];
}

// ------------------------------------------------------------------ G12 (16-11, F01 de C6): LITERA de la mina Fortuna, madera rústica de 1905
// Camarote corrido de dos pisos: 6 pies derechos de escuadría (3 por lado) con cuñas y clavos de fierro, largueros y cabezales, tablas
// transversales con junta (cada una de su tono), jergón de arpillera relleno de paja, almohada de lana y frazada de lana con pliegues;
// baranda en el piso de arriba y dos peldaños clavados al pie derecho del frente. Largo en x (3,0 m), frente +z, fondo contra el muro.
// Tablas de abajo a y 1,02 y de arriba a 2,42 (como las cajas de antes: el minero dormido queda en y 1,12). op.doblada: la frazada de abajo
// va doblada a los pies (ahí duerme el minero).
function literaMina(A, op) {
  const q = A.q, L = 3.0, D = 1.1, hl = L / 2, hd = D / 2, H = 2.85, MAD = [0x6e4e30, 0x5e4026, 0x7a5838, 0x684a2e], FIE = 0x2e2a26;
  const tono = i => MAD[(((i * 7 + 3) % MAD.length) + MAD.length) % MAD.length];
  // pies derechos (3 por lado) con zapata de tabla al piso
  for (const x of [-hl + 0.06, 0, hl - 0.06]) for (const s of [-1, 1]) {
    const z = s * (hd - 0.05);
    A.bloque('madera', 0.1, H, 0.1, 0.012, x, H / 2, z, tono(Math.round(x * 3 + s)), { seg: [1, 5, 1], veta: 'y' });
    A.bloque('madera', 0.16, 0.04, 0.16, 0.008, x, 0.02, z, 0x4e3420, { veta: 'x' });
  }
  for (const [yT, i] of [[1.02, 0], [2.42, 1]]) {
    const yR = yT - 0.03 - 0.07;   // largueros bajo las tablas
    for (const s of [-1, 1]) {
      A.bloque('madera', L + 0.04, 0.14, 0.06, 0.01, 0, yR, s * (hd - 0.13), tono(i + s + 2), { seg: [6, 1, 1], veta: 'x' });
      if (q) for (const x of [-hl + 0.06, 0, hl - 0.06]) for (const dy of [-0.03, 0.03]) A.esfera('pintura', 0.009, x, yR + dy, s * (hd + 0.006 - 0.0), FIE, 0.6);   // clavos
    }
    for (const sx of [-1, 1]) A.bloque('madera', 0.06, 0.14, D - 0.1, 0.01, sx * (hl - 0.06), yR, 0, tono(i + sx), { seg: [1, 1, 2], veta: 'z' });   // cabezales
    // tablas transversales con junta, algo disparejas
    const n = q ? 14 : 7, w = L / n;
    for (let k = 0; k < n; k++) A.bloque('madera', w - 0.012, 0.03, D - 0.04 + ((k * 37) % 5) * 0.006, 0.004, -hl + (k + 0.5) * w, yT - 0.015 + ((k * 13) % 3) * 0.002, ((k * 11) % 3 - 1) * 0.006, tono(k + i), { seg: [1, 1, 2], veta: 'z' });
    // jergón de arpillera relleno de paja (bulto disparejo), almohada de lana a la cabecera (−x)
    const jy = yT + 0.05;
    A.bloque('tela', L - 0.9, 0.1, D - 0.22, 0.045, -0.3, jy, -0.02, 0x9a8862, { seg: [16, 3, 8], veta: 'x', def: (v, ww, hh, dd) => {
      if (v.y > 0) v.y += 0.02 * (1 - Math.pow(2 * v.x / ww, 4)) * (1 - Math.pow(2 * v.z / dd, 4)) + 0.008 * Math.sin(v.x * 9 + v.z * 5);
      else v.y -= 0.003; } });
    almohada(A, 0.36, 0.5, -hl + 0.45, jy + 0.09, -0.02, 0xb8aa8a, 0.0);
    const yM = jy + 0.06 + 0.04;   // sobre el bulto del jergón (a +0,012 lo atravesaba)
    const M4 = (tx, ty, tz) => new THREE.Matrix4().makeTranslation(tx, ty, tz).multiply(new THREE.Matrix4().makeRotationY(PI2));
    if (i === 0 && op.doblada) {   // frazada doblada en cuatro a los pies
      A.add('lana', manta(0.72, 0, -0.32, 0.32, 0.05, 0.03, { nu: q ? 20 : 8, nv: q ? 12 : 6, amp: 0.008, ondas: 3 }), 0x7a3a2a, M4(0.75, yM + 0.02, -0.04));
      A.add('lana', manta(0.7, 0.05, -0.3, 0.3, 0.04, 0.03, { nu: q ? 20 : 8, nv: q ? 12 : 6, amp: 0.006, ondas: 2, fase: 1.3 }), 0x8a4632, M4(0.75, yM + 0.02, -0.04));
    } else {   // frazada de lana extendida: cae por el frente con pliegues; listas oscuras en el borde
      A.add('lana', manta(D - 0.26, 0, -hl + 0.7, hl - 0.12, 0.16, 0.035, { nu: q ? 40 : 14, nv: q ? 30 : 8, amp: 0.03, ondas: 6, fase: i ? 1.7 : 0.4, lados: [0, 1],
        bulto: (s, z) => 0.012 * Math.sin(z * 4 + i) * (1 - Math.abs(s) * 1.6) }), i ? 0x6c5a44 : 0x7a3a2a, M4(0, yM, -0.02));
      if (q) A.add('lana', manta(D - 0.24, 0.004, hl - 0.2, hl - 0.14, 0.17, 0.035, { nu: 12, nv: 2, amp: 0, ondas: 1, lados: [0, 1] }), 0x2e2420, M4(0, yM, -0.02));   // lista del borde
    }
  }
  // baranda del piso de arriba (tabla al frente, entre el pie del medio y el de la cabecera) y peldaños clavados al pie del frente (+x)
  A.bloque('madera', hl + 0.1, 0.12, 0.04, 0.008, -hl / 2, 2.72, hd - 0.02, tono(5), { seg: [4, 1, 1], veta: 'x' });
  for (const y of [0.5, 1.45, 1.95]) A.bloque('madera', 0.05, 0.06, 0.34, 0.006, hl - 0.06 + 0.075, y, hd - 0.2, tono(Math.round(y * 3)), { veta: 'z' });
  // cuñas y tirantes en cruz al fondo (contra el muro), para que no se ladee
  for (const sx of [-1, 1]) { const g = new THREE.BoxGeometry(Math.hypot(hl - 0.06, 1.25), 0.08, 0.035); uvMetros(g, 'x'); g.rotateZ(sx * Math.atan2(1.25, hl - 0.06)); g.translate(sx * (hl - 0.06) / 2, 1.72, -hd - 0.018); A.add('madera', g, tono(sx + 7)); }
  return [L + 0.14, H, D];
}
const PI2 = Math.PI / 2;

export const FABRICA_MINA = { jaula_mina: jaulaMina, litera_mina: literaMina, litera_mina_b: (A, op) => literaMina(A, { ...op, doblada: true }) };   // G12: literas FINAS de Fortuna
registrarFabrica(FABRICA_MINA);
