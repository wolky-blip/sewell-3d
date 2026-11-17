// C2 (finos C, 16-11-2026): muebles FINOS del hospital (Edificio 157, 1.er piso), en código (estilo mueblesFinos.js, sin GPU).
//   cama_hospital / cama_hospital2  H01 cama de fierro esmaltado blanco (la FINA «cama» con frazada de hospital) + ficha clínica en la piecera (cabecera en −z)
//   biombo_hospital H03 biombo de 3 hojas: bastidor de tubo esmaltado con esquinas dobladas, tela fruncida en varillas, regatones
//   porta_sueros    H04 pie de 3 patas con ruedas, vara, travesaño con ganchos, irrigador de vidrio con suero y goma colgando
//   carro_curaciones H05 carro de 2 bandejas de fierro enlozado con borde, ruedas, riñonera, frascos, gasa
//   silla_ruedas    H06 silla de ruedas de madera y mimbre: ruedas grandes de rayos con aro de mano, ruedas chicas, posapiés
//   camilla         H07 camilla de tubo con colchoneta, manillas y ruedas
//   banca_espera    H08 banca de listones con respaldo y costados de fierro fundido (2,2 m; se escala a 2,6)
//   radiador        H10 radiador de columnas de fierro fundido (11 elementos, 1 m) con llave y patas
// Marco local: pivote en el piso al centro, frente hacia +z.
import * as THREE from 'three';
import { registrarFabrica, registrarMaterial, fabricaFina, HERRAMIENTAS_FINAS } from './mueblesFinos.js';

const { doblar, densificar, curva, bloque, uvMetros } = HERRAMIENTAS_FINAS;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI;
registrarMaterial('esmalte', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.3, metalness: 0.1, emissive: 0x262624, emissiveIntensity: 0.6 }));
registrarMaterial('cromo', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.22, metalness: 0.6, emissive: 0x5a6066, emissiveIntensity: 0.6 }));
registrarMaterial('vidrioColor', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.84 }));
registrarMaterial('cristal', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
const BL = 0xeceae2, NEG = 0x1c1c1c;

function rueda(A, x, y, z, r, eje = 'x', rayos = 0, color = NEG) {   // rueda: llanta de goma, aro y (si rayos) rayos de alambre; eje = 'x' o 'z'
  const q = A.q, rot = eje === 'x' ? new THREE.Matrix4().makeRotationY(PI / 2) : new THREE.Matrix4();
  const pts = curva(t => V3(Math.cos(2 * PI * t) * r, Math.sin(2 * PI * t) * r, 0), q ? 28 : 10).map(p => p.applyMatrix4(rot).add(V3(x, y, z)));
  A.tubo('oscuro', pts.slice(0, -1), r * 0.09, color, { lados: q ? 6 : 4, cerrado: true });
  if (rayos) { for (let i = 0; i < (q ? rayos : 4); i++) { const a = i / rayos * 2 * PI * (q ? 1 : rayos / 4); A.tubo('cromo', [V3(0, 0, 0), V3(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, 0)].map(p => p.applyMatrix4(rot).add(V3(x, y, z))), 0.003, 0xb8bcc0, { lados: 3 }); }
    A.torno('cromo', [[0, -0.02], [0.025, -0.02], [0.025, 0.02], [0, 0.02]], 0, 0, 0, 0xb8bcc0, 8, new THREE.Matrix4().makeRotationX(PI / 2).premultiply(rot).premultiply(new THREE.Matrix4().makeTranslation(x, y, z))); }
  else A.torno('esmalte', [[0, -0.012], [r * 0.6, -0.012], [r * 0.6, 0.012], [0, 0.012]], 0, 0, 0, 0x8a8a86, 8, new THREE.Matrix4().makeRotationX(PI / 2).premultiply(rot).premultiply(new THREE.Matrix4().makeTranslation(x, y, z)));
}
function rodaja(A, x, y0, z) {   // rueda giratoria chica (horquilla + rueda)
  A.tubo('cromo', [V3(x, y0, z), V3(x, y0 - 0.03, z)], 0.008, 0xb8bcc0, { lados: 5 });
  A.bloque('cromo', 0.03, 0.035, 0.012, 0.003, x, y0 - 0.045, z, 0xb8bcc0, { seg: [1, 1, 1] });
  rueda(A, x, 0.032, z, 0.032, 'x');
}

// ------------------------------------------------------------------ CAMA DE HOSPITAL (cama FINA de fierro blanco + ficha clínica)
function camaHospital(A, op) {
  const tam = fabricaFina('cama')(A, { fierro: 0xeceae2, frazada: op.frazada ?? 0xc9c2b0, sabana: 0xf2efe8 });
  A.bloque('madera', 0.2, 0.26, 0.012, 0.004, 0, 0.66, 0.975, 0x7a5a3a, { seg: [1, 1, 1] });   // tablilla de la ficha colgada en la piecera
  A.bloque('loza', 0.17, 0.21, 0.004, 0.001, 0, 0.65, 0.983, 0xf4f1e6, { seg: [1, 1, 1] });
  A.bloque('bronce', 0.07, 0.02, 0.01, 0.002, 0, 0.775, 0.984, 0xb08d3c, { seg: [1, 1, 1] });
  return tam;
}

// ------------------------------------------------------------------ BIOMBO de hospital (3 hojas en zigzag como el del kit: la del medio adelantada)
function biomboHospital(A, op) {
  const q = A.q, w = 0.62, h = 1.75, T = op.tela ?? 0xf1eee6;
  for (const i of [-1, 0, 1]) {
    const a = i === 0 ? -0.4 : 0.4, m = new THREE.Matrix4().makeRotationY(a).setPosition(i * 0.6, 0, i === 0 ? 0.12 : 0), d = w / 2 - 0.02;
    const marco = doblar([V3(-d, 0.04, 0), V3(-d, h + 0.08, 0), V3(d, h + 0.08, 0), V3(d, 0.04, 0)], 0.06, q ? 5 : 2).map(p => p.applyMatrix4(m));
    A.tubo('esmalte', densificar(marco, 0.1), 0.013, BL, { lados: q ? 8 : 4 });
    for (const y of [0.24, h - 0.02]) A.tubo('esmalte', [V3(-d, y, 0), V3(d, y, 0)].map(p => p.applyMatrix4(m)), 0.007, BL, { lados: 4 });   // varillas de la tela
    for (const u of [-1, 1]) A.torno('oscuro', [[0, 0], [0.018, 0], [0.016, 0.04], [0, 0.045]], 0, 0, 0, 0x2a2a2a, 8, new THREE.Matrix4().makeTranslation(u * d, 0, 0).premultiply(m));   // regatón
    const g = new THREE.PlaneGeometry(2 * d - 0.02, h - 0.3, q ? 28 : 6, 2), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setZ(k, 0.012 * Math.sin(p.getX(k) * 52) + 0.004);   // tela fruncida
    g.computeVertexNormals(); g.translate(0, 0.24 + (h - 0.26) / 2, 0); g.applyMatrix4(m); A.add('tela', g, T);
  }
  return [1.95, h + 0.1, 0.6];
}

// ------------------------------------------------------------------ PORTA-SUEROS (irrigador de vidrio)
function portaSueros(A, op) {
  const q = A.q;
  for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3 + PI / 2, d = (r, y) => V3(Math.cos(a) * r, y, Math.sin(a) * r);
    A.tubo('cromo', [d(0.02, 0.12), d(0.2, 0.07), d(0.24, 0.065)], 0.01, 0xc8ccd0, { lados: q ? 6 : 4 }); rodaja(A, Math.cos(a) * 0.24, 0.065, Math.sin(a) * 0.24); }
  A.torno('cromo', [[0, 0.1], [0.03, 0.1], [0.035, 0.13], [0.02, 0.16], [0, 0.16]], 0, 0, 0, 0xc8ccd0, q ? 10 : 6);
  A.tubo('cromo', [V3(0, 0.12, 0), V3(0, 1.82, 0)], 0.011, 0xc8ccd0, { lados: q ? 8 : 4 });
  A.torno('cromo', [[0.012, 1.0], [0.02, 1.0], [0.02, 1.04], [0.012, 1.04]], 0, 0, 0, 0xc8ccd0, 8);   // collar de altura
  A.tubo('cromo', [V3(-0.17, 1.8, 0), V3(0.17, 1.8, 0)], 0.007, 0xc8ccd0, { lados: 4 });
  for (const s of [-1, 1]) A.tubo('cromo', curva(t => V3(s * 0.17, 1.8 - 0.04 * Math.sin(PI * t), 0.03 * (1 - Math.cos(PI * t))), 5), 0.004, 0xc8ccd0, { lados: 3 });   // ganchos
  A.tubo('cromo', [V3(0.17, 1.8, 0), V3(0.17, 1.73, 0)], 0.003, 0xc8ccd0, { lados: 3 });
  A.torno('cristal', [[0.008, 1.52], [0.03, 1.55], [0.05, 1.58], [0.052, 1.7], [0.048, 1.72], [0.02, 1.73], [0.02, 1.75]], 0.17, 0, 0, 0xeef4f2, q ? 14 : 7);   // irrigador
  A.torno('vidrioColor', [[0, 1.56], [0.04, 1.58], [0.046, 1.66], [0, 1.66]], 0.17, 0, 0, 0xe8d7a0, q ? 12 : 6);   // suero
  A.tubo('oscuro', curva(t => V3(0.17 - 0.06 * Math.sin(PI * t * 0.7), 1.52 - 0.75 * t, 0.06 * Math.sin(PI * t)), q ? 14 : 5), 0.004, 0x8a6a4a, { lados: 3 });   // goma
  return [0.5, 1.85, 0.5];
}

// ------------------------------------------------------------------ CARRO DE CURACIONES
function carro(A, op) {
  const q = A.q, W = 0.75, D = 0.45;
  for (const y of [0.3, 0.82]) { A.bloque('esmalte', W, 0.018, D, 0.006, 0, y, 0, BL, { seg: [2, 1, 2] });
    for (const s of [-1, 1]) { A.tubo('esmalte', [V3(-W / 2, y + 0.02, s * D / 2), V3(W / 2, y + 0.02, s * D / 2)], 0.009, BL, { lados: 5 }); A.tubo('esmalte', [V3(s * W / 2, y + 0.02, -D / 2), V3(s * W / 2, y + 0.02, D / 2)], 0.009, BL, { lados: 5 }); } }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { A.tubo('cromo', [V3(sx * (W / 2 - 0.02), 0.085, sz * (D / 2 - 0.02)), V3(sx * (W / 2 - 0.02), 0.86, sz * (D / 2 - 0.02))], 0.012, 0xc8ccd0, { lados: q ? 8 : 4 }); rodaja(A, sx * (W / 2 - 0.02), 0.085, sz * (D / 2 - 0.02)); }
  A.tubo('cromo', doblar([V3(-W / 2 - 0.02, 0.86, -0.15), V3(-W / 2 - 0.1, 0.92, -0.15), V3(-W / 2 - 0.1, 0.92, 0.15), V3(-W / 2 - 0.02, 0.86, 0.15)], 0.04, q ? 4 : 2), 0.01, 0xc8ccd0, { lados: q ? 6 : 4 });   // manilla
  { const sh = new THREE.Shape(); sh.absellipse(0, 0, 0.13, 0.07, 0, PI * 2); const hole = new THREE.Path(); hole.absellipse(0.03, 0, 0.04, 0.03, 0, PI * 2); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: q ? 16 : 6 }); g.rotateX(-PI / 2); uvMetros(g, 'x'); g.translate(-0.15, 0.83, 0); A.add('loza', g, 0xf4f2ec); }   // riñonera
  A.torno('vidrioColor', [[0, 0.83], [0.035, 0.83], [0.036, 0.94], [0.02, 0.96], [0.016, 0.98], [0, 0.98]], 0.18, 0, 0.08, 0x8a4a14, q ? 12 : 6);
  A.torno('vidrioColor', [[0, 0.83], [0.03, 0.83], [0.031, 0.93], [0.016, 0.95], [0, 0.95]], 0.26, 0, -0.1, 0x2c4a8a, q ? 12 : 6);
  A.torno('tela', [[0.02, 0.32], [0.06, 0.32], [0.06, 0.4], [0.02, 0.4]], 0.15, 0, 0, 0xf2efe6, q ? 12 : 6);   // rollo de gasa
  A.bloque('tela', 0.3, 0.05, 0.25, 0.015, -0.15, 0.34, 0, 0xe8e4da, { seg: [3, 1, 3] });   // compresas
  return [W + 0.15, 0.95, D];
}

// ------------------------------------------------------------------ SILLA DE RUEDAS (madera y mimbre)
function sillaRuedas(A, op) {
  const q = A.q, M = 0x5a3a22, Mi = 0xc49a5c;
  A.bloque('tela', 0.46, 0.04, 0.44, 0.012, 0, 0.5, 0.02, Mi, { seg: [3, 1, 3] });   // asiento de mimbre
  { const g = bloque(0.46, 0.6, 0.03, 0.01, q ? [3, 4, 1] : [1, 2, 1]); uvMetros(g, 'y'); g.rotateX(-0.18); g.translate(0, 0.85, -0.23); A.add('tela', g, Mi); }
  for (const s of [-1, 1]) {
    A.tubo('madera', [V3(s * 0.25, 0.38, 0.22), V3(s * 0.25, 0.52, 0.2)], 0.018, M, { lados: 4, plano: true });
    A.tubo('madera', doblar([V3(s * 0.25, 0.38, -0.24), V3(s * 0.25, 1.15, -0.32), V3(s * 0.25, 1.17, -0.42)], 0.06, q ? 4 : 2), 0.02, M, { lados: q ? 6 : 4 });   // parante y manilla
    A.tubo('madera', [V3(s * 0.25, 0.7, -0.26), V3(s * 0.25, 0.7, 0.18), V3(s * 0.25, 0.52, 0.2)], 0.016, M, { lados: q ? 6 : 4 });   // brazo
    A.tubo('madera', [V3(s * 0.25, 0.38, -0.26), V3(s * 0.25, 0.38, 0.28)], 0.02, M, { lados: 4, plano: true });   // larguero bajo
    rueda(A, s * 0.31, 0.31, -0.08, 0.3, 'x', 16);
    { const pts = curva(t => V3(s * 0.335, 0.31 + Math.sin(2 * PI * t) * 0.27, -0.08 + Math.cos(2 * PI * t) * 0.27), q ? 24 : 8); A.tubo('cromo', pts.slice(0, -1), 0.006, 0xb8bcc0, { lados: 4, cerrado: true }); }   // aro de mano
    rodaja(A, s * 0.2, 0.12, 0.33); A.tubo('cromo', [V3(s * 0.2, 0.12, 0.33), V3(s * 0.22, 0.38, 0.25)], 0.009, 0xb8bcc0, { lados: 4 });
  }
  A.tubo('cromo', [V3(-0.3, 0.31, -0.08), V3(0.3, 0.31, -0.08)], 0.009, 0xb8bcc0, { lados: 5 });   // eje
  A.bloque('madera', 0.38, 0.02, 0.16, 0.004, 0, 0.18, 0.4, M, { rx: 0.5 });   // posapiés
  return [0.75, 1.2, 0.85];
}

// ------------------------------------------------------------------ CAMILLA de tubo con colchoneta (largo en z)
function camilla(A, op) {
  const q = A.q, W = 0.62, L = 1.9, H = 0.78;
  for (const s of [-1, 1]) A.tubo('cromo', [V3(s * W / 2, H, -L / 2 - 0.12), V3(s * W / 2, H, L / 2 + 0.12)], 0.016, 0xc8ccd0, { lados: q ? 8 : 4 });   // largueros con manillas
  for (const z of [-L / 2, L / 2]) A.tubo('cromo', [V3(-W / 2, H, z), V3(W / 2, H, z)], 0.012, 0xc8ccd0, { lados: 5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { A.tubo('cromo', [V3(sx * (W / 2 - 0.04), 0.09, sz * (L / 2 - 0.08)), V3(sx * (W / 2 - 0.02), H, sz * (L / 2 - 0.06))], 0.013, 0xc8ccd0, { lados: q ? 6 : 4 }); rodaja(A, sx * (W / 2 - 0.04), 0.09, sz * (L / 2 - 0.08)); }
  for (const sz of [-1, 1]) A.tubo('cromo', [V3(-W / 2 + 0.04, 0.2, sz * (L / 2 - 0.08)), V3(W / 2 - 0.04, 0.2, sz * (L / 2 - 0.08))], 0.009, 0xc8ccd0, { lados: 4 });
  A.bloque('tela', W - 0.02, 0.07, L, 0.03, 0, H + 0.04, 0, 0x6a6e66, { seg: [3, 1, 8], veta: 'z' });   // colchoneta de hule
  A.bloque('tela', W - 0.06, 0.012, L * 0.7, 0.004, 0, H + 0.082, 0.1, 0xf2efe6, { seg: [3, 1, 6], veta: 'z' });   // sábana
  A.bloque('tela', 0.42, 0.08, 0.28, 0.035, 0, H + 0.1, -L / 2 + 0.2, 0xf4f1ea, { seg: [4, 2, 3] });   // almohada
  return [W + 0.04, H + 0.15, L + 0.24];
}

// ------------------------------------------------------------------ BANCA DE ESPERA (listones y costados de fierro fundido; 2,2 m)
function bancaEspera(A, op) {
  const q = A.q, Lx = 2.2, M = op.madera ?? 0x8a5a32, F = 0x2a2b2c;
  const s = new THREE.Shape();
  s.moveTo(-0.26, 0); s.lineTo(-0.19, 0); s.quadraticCurveTo(-0.14, 0.2, -0.04, 0.24); s.lineTo(0.07, 0.24); s.quadraticCurveTo(0.17, 0.2, 0.2, 0); s.lineTo(0.26, 0);
  s.lineTo(0.25, 0.05); s.quadraticCurveTo(0.21, 0.25, 0.22, 0.42); s.lineTo(0.02, 0.43); s.lineTo(-0.17, 0.43);
  s.quadraticCurveTo(-0.22, 0.62, -0.27, 0.9); s.absarc(-0.295, 0.91, 0.026, -0.4, PI * 1.05, false); s.quadraticCurveTo(-0.29, 0.6, -0.25, 0.42); s.quadraticCurveTo(-0.23, 0.2, -0.26, 0);
  for (const x of [-(Lx / 2 - 0.12), 0, Lx / 2 - 0.12]) { const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1, curveSegments: q ? 8 : 3 });
    g.translate(0, 0, -0.015); uvMetros(g, 'y'); g.rotateY(-PI / 2); g.translate(x, 0, 0); A.add('pintura', g, F); }
  for (let i = 0; i < 4; i++) A.bloque('madera', Lx, 0.03, 0.085, 0.009, 0, 0.445, 0.165 - i * 0.105, M, { seg: [8, 1, 2], veta: 'x' });
  for (let i = 0; i < 2; i++) { const t = (i + 0.5) / 2, y = 0.6 + t * 0.26, z = -0.2 - t * 0.07; A.bloque('madera', Lx, 0.09, 0.024, 0.009, 0, y, z, M, { seg: [8, 2, 1], veta: 'x', rx: -0.25 }); }
  return [Lx, 0.95, 0.56];
}

// ------------------------------------------------------------------ RADIADOR de columnas (largo en x, 1 m; frente +z)
function radiador(A, op) {
  const q = A.q, C = op.color ?? 0xbab5a6, n = 11, H = 0.78;
  for (let i = 0; i < n; i++) { const x = -0.45 + i * 0.09;
    for (const z of [-0.035, 0.035]) A.torno('esmalte', [[0, 0.1], [0.018, 0.1], [0.024, 0.13], [0.022, 0.2], [0.022, H - 0.1], [0.024, H - 0.07], [0.018, H - 0.04], [0, H - 0.04]], x, 0, z, C, q ? 8 : 5);
    A.bloque('esmalte', 0.03, H - 0.22, 0.05, 0.008, x, H / 2 + 0.03, 0, C, { seg: [1, 2, 1] }); }
  for (const y of [0.14, H - 0.07]) A.tubo('esmalte', [V3(-0.5, y, 0), V3(0.5, y, 0)], 0.022, C, { lados: q ? 8 : 4 });   // colectores
  for (const s of [-1, 1]) A.torno('esmalte', [[0, 0], [0.03, 0], [0.025, 0.1], [0, 0.1]], s * 0.45, 0, 0, C, 8);   // patas
  A.tubo('bronce', [V3(-0.5, H - 0.07, 0), V3(-0.56, H - 0.07, 0)], 0.016, 0xa88a4a, { lados: 6 });
  A.torno('oscuro', [[0, 0], [0.035, 0], [0.035, 0.012], [0, 0.014]], -0.56, H - 0.07 + 0.016, 0, 0x1c1c1c, 10);   // llave
  return [1.1, H, 0.14];
}

// ================================================================== C7 (finos C, relevo 16-11): 2.º piso del hospital
//   mesa_instrumental H34 mesa de Mayo: trípode con rodajas, tubo con collar y perilla, bandeja cromada con borde enrollado, paño verde e instrumental
//   taburete_giratorio H34 taburete de fierro de 4 patas curvas con aro reposapiés, husillo y asiento torneado de madera
//   vitrina_instrumental H37 vitrina esmaltada: mueble bajo de 2 puertas y 2 cajones, cuerpo vidriado con 3 repisas de vidrio, frascos de color con
//                    tapón, riñoneras, tambor de gasa y frascos de instrumental (1,6 × 2,06 × 0,44; frente +z)
//   mecedora_mimbre  H41 mecedora de madera curvada con asiento y respaldo de mimbre tejido y balancines
//   escritorio_cosas_a / _b H12 lo que hay sobre el escritorio del jefe (marco del escritorio de cajas): lámpara de bronce con pantalla de vidrio
//                    verde, teléfono de candelero (a, 1920-45) o de baquelita (b, 1967), libros, libro de registro abierto y tintero con pluma
//   librero_jefe     H25 librero de madera con zócalo, cornisa y 4 repisas de libros empastados (lomos con nervios dorados)
registrarMaterial('mimbre', (b, T) => { const t = T('tela'); return new THREE.MeshStandardMaterial({ ...b, map: t, bumpMap: t, bumpScale: 3, roughness: 0.85, side: THREE.DoubleSide }); }, 1 / 0.07);
registrarMaterial('baquelita', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.25, metalness: 0.05, emissive: 0x141414, emissiveIntensity: 0.4 }));
registrarMaterial('laca', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.4, metalness: 0, emissive: 0x2a2826, emissiveIntensity: 0.6 }));
const CR = 0xc4c8cc;

function mesaInstrumental(A, op) {
  const q = A.q;
  for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3 + PI / 2, d = (r, y) => V3(Math.cos(a) * r, y, Math.sin(a) * r);   // trípode
    A.tubo('cromo', curva(t => d(0.03 + 0.22 * t, 0.1 - 0.04 * t + 0.02 * Math.sin(PI * t)), q ? 6 : 2), 0.014, CR, { lados: q ? 8 : 4 });
    rodaja(A, Math.cos(a) * 0.25, 0.06, Math.sin(a) * 0.25); }
  A.torno('cromo', [[0, 0.07], [0.04, 0.07], [0.045, 0.1], [0.025, 0.13], [0, 0.13]], 0, 0, 0, CR, q ? 12 : 6);
  A.tubo('cromo', [V3(0, 0.12, 0), V3(0, 0.6, 0)], 0.017, CR, { lados: q ? 10 : 5 });
  A.tubo('cromo', [V3(0, 0.55, 0), V3(0, 0.95, 0)], 0.012, CR, { lados: q ? 10 : 5 });   // tubo interior
  A.torno('cromo', [[0.012, 0.58], [0.026, 0.58], [0.028, 0.62], [0.012, 0.62]], 0, 0, 0, CR, q ? 12 : 6);   // collar
  A.tubo('cromo', [V3(0.025, 0.6, 0), V3(0.07, 0.6, 0)], 0.005, CR, { lados: 4 }); A.esfera('baquelita', 0.014, 0.075, 0.6, 0, 0x1a1a1a);   // perilla
  A.tubo('cromo', [V3(0, 0.95, 0), V3(0, 0.96, 0), V3(-0.15, 0.96, 0)], 0.01, CR, { lados: 4 });   // brazo de la bandeja
  const W = 0.6, D = 0.4, y = 0.965;
  A.bloque('cromo', W, 0.006, D, 0.002, -0.15, y, 0, CR, { seg: [1, 1, 1] });
  A.tubo('cromo', densificar(doblar([V3(-0.15 - W / 2, y + 0.012, -D / 2), V3(-0.15 + W / 2, y + 0.012, -D / 2), V3(-0.15 + W / 2, y + 0.012, D / 2), V3(-0.15 - W / 2, y + 0.012, D / 2)], 0.03, q ? 4 : 1, true), 0.2), 0.008, CR, { lados: q ? 6 : 4, cerrado: true });   // borde enrollado
  { const g = new THREE.PlaneGeometry(W - 0.06, D - 0.05, q ? 12 : 2, q ? 8 : 1), p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setZ(k, 0.004 * Math.sin(p.getX(k) * 30 + p.getY(k) * 17));
    g.rotateX(-PI / 2); g.computeVertexNormals(); g.translate(-0.15, y + 0.008, 0); A.add('tela', g, 0x4f8a78); }   // paño
  let s = 34; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 7; i++) { const x = -0.38 + i * 0.07, z = (r() - 0.5) * 0.1, a = (r() - 0.5) * 0.3, m = new THREE.Matrix4().makeRotationY(a).setPosition(x, y + 0.016, z);
    const P = (px, pz) => V3(px, 0, pz).applyMatrix4(m);
    if (i % 3 === 0) { A.tubo('cromo', [P(0, -0.08), P(0, 0.04)], 0.004, CR, { lados: 4, esc: [1.6, 0.6] }); A.tubo('cromo', [P(0, 0.04), P(0, 0.08)], 0.002, CR, { lados: 3, esc: [2, 0.5] }); }   // bisturí
    else if (i % 3 === 1) { for (const sg of [-1, 1]) A.tubo('cromo', [P(sg * 0.012, -0.08), P(0, 0.0), P(-sg * 0.004, 0.07)], 0.003, CR, { lados: 3 });   // pinza / tijera
      if (q) for (const sg of [-1, 1]) A.tubo('cromo', curva(t => P(sg * 0.012 + Math.cos(2 * PI * t) * 0.01, -0.09 + Math.sin(2 * PI * t) * 0.01), 8), 0.002, CR, { lados: 3 }); }
    else A.tubo('cromo', [P(0, -0.08), P(0, 0.08)], 0.003, CR, { lados: 4 });   // sonda
  }
  { const g = new THREE.SphereGeometry(0.09, q ? 14 : 6, q ? 6 : 3, 0, 2 * PI, PI / 2, PI / 2); g.scale(1.4, 0.3, 0.8); g.translate(0.05, y + 0.03, 0.06); A.add('esmalte', g, 0xeeeee8); }   // riñonera
  return [0.6, 1.0, 0.5];
}
function tabureteGiratorio(A, op) {
  const q = A.q, FN = 0x2c2e30;
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, d = (r, y) => V3(Math.cos(a) * r, y, Math.sin(a) * r);
    A.tubo('pintura', curva(t => d(0.04 + 0.18 * t + 0.03 * t * t, 0.42 * (1 - t) + 0.01), q ? 6 : 2), 0.012, FN, { lados: q ? 6 : 4 });
    A.torno('oscuro', [[0, 0], [0.018, 0], [0.016, 0.015], [0, 0.015]], Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25, 0x1a1a1a, 6); }
  A.tubo('pintura', curva(t => V3(Math.cos(2 * PI * t) * 0.16, 0.16, Math.sin(2 * PI * t) * 0.16), q ? 20 : 8).slice(0, -1), 0.008, FN, { lados: 4, cerrado: true });   // aro reposapiés
  A.torno('pintura', [[0, 0.38], [0.05, 0.38], [0.055, 0.44], [0, 0.44]], 0, 0, 0, FN, q ? 12 : 6);
  A.tubo('cromo', [V3(0, 0.44, 0), V3(0, 0.6, 0)], 0.014, CR, { lados: q ? 8 : 4 });   // husillo
  if (q) for (let k = 0; k < 8; k++) A.torno('cromo', [[0.014, 0], [0.018, 0.004], [0.014, 0.008]], 0, 0.45 + k * 0.018, 0, CR, 8);   // hilos
  A.torno('pintura', [[0, 0.59], [0.06, 0.59], [0.08, 0.61], [0, 0.61]], 0, 0, 0, FN, q ? 12 : 6);
  A.torno('madera', [[0, 0.61], [0.17, 0.61], [0.182, 0.625], [0.18, 0.645], [0.165, 0.655], [0, 0.66]], 0, 0, 0, 0x7a5232, q ? 24 : 10);
  return [0.5, 0.66, 0.5];
}
function vitrinaInstrumental(A, op) {
  const q = A.q, w = 1.6, d = 0.42, BLc = 0xeceae2;
  A.bloque('esmalte', w, 0.06, d - 0.04, 0.006, 0, 0.03, -0.01, 0xd8d6ce, { seg: [1, 1, 1] });   // zócalo
  A.bloque('esmalte', w, 0.84, d, 0.012, 0, 0.48, 0, BLc, { seg: [3, 3, 2] });
  for (const s of [-1, 1]) {
    A.bloque('esmalte', w / 2 - 0.04, 0.52, 0.012, 0.004, s * w / 4, 0.36, d / 2 + 0.004, 0xf2f0e8, { seg: [1, 1, 1] });   // puerta
    if (q) A.bloque('esmalte', w / 2 - 0.16, 0.42, 0.006, 0.003, s * w / 4, 0.36, d / 2 + 0.012, 0xe2e0d8, { seg: [1, 1, 1] });   // tablero rehundido
    A.tubo('cromo', [V3(s * 0.06, 0.42, d / 2 + 0.012), V3(s * 0.06, 0.42, d / 2 + 0.035), V3(s * 0.06, 0.3, d / 2 + 0.035), V3(s * 0.06, 0.3, d / 2 + 0.012)], 0.006, CR, { lados: 4 });   // tirador
    A.bloque('esmalte', w / 2 - 0.04, 0.2, 0.012, 0.004, s * w / 4, 0.76, d / 2 + 0.004, 0xf2f0e8, { seg: [1, 1, 1] });   // cajón
    A.bloque('cromo', 0.12, 0.02, 0.02, 0.006, s * w / 4, 0.76, d / 2 + 0.02, CR, { seg: [1, 1, 1] });
  }
  A.bloque('esmalte', w + 0.03, 0.03, d + 0.03, 0.008, 0, 0.915, 0, BLc, { seg: [2, 1, 1] });
  const y0 = 0.93, y1 = 2.0, h = y1 - y0;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.bloque('esmalte', 0.035, h, 0.035, 0.005, sx * (w / 2 - 0.018), y0 + h / 2, sz * (d / 2 - 0.018), BLc, { seg: [1, 2, 1] });
  A.bloque('esmalte', w - 0.04, h, 0.012, 0.003, 0, y0 + h / 2, -d / 2 + 0.01, 0xf4f2ea, { seg: [1, 1, 1] });   // fondo
  A.bloque('esmalte', 0.03, h, 0.03, 0.005, 0, y0 + h / 2, d / 2 - 0.016, BLc, { seg: [1, 2, 1] });   // montante de las 2 hojas
  for (const s of [-1, 1]) A.bloque('vidrio', 0.004, h - 0.04, d - 0.05, 0.001, s * (w / 2 - 0.018), y0 + h / 2, 0, 0xe6eee8, { seg: [1, 1, 1] });
  A.bloque('vidrio', w - 0.05, h - 0.04, 0.004, 0.001, 0, y0 + h / 2, d / 2 - 0.016, 0xe6eee8, { seg: [1, 1, 1] });
  for (const s of [-1, 1]) A.tubo('cromo', [V3(s * 0.04, 1.4, d / 2), V3(s * 0.04, 1.4, d / 2 + 0.02), V3(s * 0.04, 1.52, d / 2 + 0.02), V3(s * 0.04, 1.52, d / 2)], 0.005, CR, { lados: 4 });
  A.bloque('esmalte', w + 0.05, 0.05, d + 0.04, 0.012, 0, 2.025, 0, BLc, { seg: [2, 1, 1] }); A.bloque('esmalte', w + 0.08, 0.02, d + 0.06, 0.006, 0, 2.06, 0, BLc, { seg: [2, 1, 1] });   // cornisa
  let s = 37; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const COL = [0x8a5a1c, 0x2f4f8f, 0x3f6f4f, 0xe8e6de];
  for (const y of [0.94, 1.27, 1.6]) {
    if (y > 1) A.bloque('vidrio', w - 0.07, 0.008, d - 0.08, 0.002, 0, y, -0.01, 0xe6eee8, { seg: [1, 1, 1] });
    let x = -w / 2 + 0.1;
    while (x < w / 2 - 0.12) {
      const t = op.frascos ? (r() < 0.8 ? Math.floor(r() * 2) : 4) : Math.floor(r() * 5), z = -0.03 + (r() - 0.5) * 0.06;   // G9M: op.frascos → solo frascos (medicamentos)
      if (t <= 1) { const R = 0.03 + r() * 0.015, H = 0.1 + r() * 0.08, c = COL[Math.floor(r() * 3)];   // frasco de color con tapón esmerilado
        A.torno('vidrioColor', [[0, 0], [R, 0], [R, H * 0.7], [R * 0.45, H * 0.85], [R * 0.4, H], [0, H]], x + R, y + 0.004, z, c, q ? 12 : 6);
        A.torno('cristal', [[0, H], [R * 0.45, H], [R * 0.5, H + 0.015], [R * 0.25, H + 0.03], [0, H + 0.035]], x + R, y + 0.004, z, 0xe6eee8, q ? 10 : 5); x += 2 * R + 0.04; }
      else if (t === 2) { A.torno('cromo', [[0, 0], [0.07, 0], [0.072, 0.1], [0.075, 0.105], [0.072, 0.11], [0, 0.11]], x + 0.075, y + 0.004, z, CR, q ? 16 : 8);   // tambor de gasa
        if (q) A.tubo('cromo', curva(t => V3(x + 0.075 + Math.cos(2 * PI * t) * 0.073, y + 0.055, z + Math.sin(2 * PI * t) * 0.073), 16).slice(0, -1), 0.004, 0x9ea2a6, { lados: 3, cerrado: true });
        x += 0.19; }
      else if (t === 3) { const g = new THREE.SphereGeometry(0.1, q ? 14 : 6, q ? 6 : 3, 0, 2 * PI, PI / 2, PI / 2); g.scale(1.3, 0.35, 0.75); g.translate(x + 0.13, y + 0.04, z); A.add('esmalte', g, 0xf0eee6); x += 0.29; }   // riñonera
      else { A.torno('cristal', [[0, 0], [0.035, 0], [0.035, 0.16], [0, 0.16]], x + 0.04, y + 0.004, z, 0xe6eee8, q ? 12 : 6);   // frasco con instrumental
        for (let k = 0; k < 4; k++) A.tubo('cromo', [V3(x + 0.03 + k * 0.008, y + 0.01, z - 0.01 + k * 0.006), V3(x + 0.02 + k * 0.014, y + 0.22, z - 0.02 + k * 0.012)], 0.003, CR, { lados: 3 });
        x += 0.11; }
    }
  }
  return [w + 0.08, 2.07, d + 0.06];
}
function mecedora(A, op) {
  const q = A.q, M = 0x4e3420, MB = 0xb08a58;
  for (const s of [-1, 1]) {
    const x = s * 0.25;
    A.tubo('madera', curva(t => V3(x, 0.04 + 0.12 * Math.pow(2 * t - 1, 2), -0.45 + 0.95 * t), q ? 14 : 6), 0.018, M, { lados: q ? 8 : 5, esc: [0.7, 1.3] });   // balancín
    A.tubo('madera', [V3(x, 0.1, 0.22), V3(x, 0.44, 0.2)], 0.016, M, { lados: q ? 8 : 5 });   // pata delantera
    A.tubo('madera', curva(t => V3(x, 0.08 + 0.95 * t, -0.18 - 0.16 * t - 0.04 * Math.sin(PI * t)), q ? 10 : 4), 0.016, M, { lados: q ? 8 : 5 });   // pata trasera que sube al respaldo
    A.tubo('madera', curva(t => V3(x * (1 + 0.1 * Math.sin(PI * t)), 0.64 + 0.05 * Math.sin(PI * t) - 0.02 * t, 0.24 - 0.44 * t), q ? 10 : 4), 0.014, M, { lados: q ? 8 : 5 });   // brazo curvo
    A.tubo('madera', curva(t => V3(x, 0.44 + 0.2 * Math.sin(PI / 2 * t), 0.2 + 0.04 * t), q ? 5 : 2), 0.012, M, { lados: q ? 6 : 4 });   // apoyo del brazo
  }
  A.tubo('madera', [V3(-0.25, 1.03, -0.38), V3(0.25, 1.03, -0.38)], 0.016, M, { lados: q ? 8 : 5 });   // travesaño de arriba
  for (const [z, y] of [[0.21, 0.44], [-0.17, 0.44], [0.0, 0.16]]) A.tubo('madera', [V3(-0.25, y, z), V3(0.25, y, z)], 0.012, M, { lados: q ? 6 : 4 });
  { const g = bloque(0.48, 0.03, 0.4, 0.012, q ? [8, 1, 8] : [2, 1, 2], (v, w) => { v.y -= 0.02 * (1 - Math.pow(2 * v.x / w, 2)); }); uvMetros(g, 'x'); g.translate(0, 0.45, 0.02); A.add('mimbre', g, MB); }   // asiento de mimbre
  { const g = bloque(0.47, 0.56, 0.02, 0.01, q ? [8, 10, 1] : [2, 3, 1], (v, w) => { v.z -= 0.03 * (1 - Math.pow(2 * v.x / w, 2)); }); uvMetros(g, 'y'); g.rotateX(-0.22); g.translate(0, 0.76, -0.27); A.add('mimbre', g, MB); }   // respaldo
  return [0.6, 1.05, 0.95];
}
function escritorioCosas(A, op) {   // marco del escritorio (frente +z hacia la silla del jefe): tablero en y 0,745 (G9M)
  // G9M (16-11): sobre la cubierta del escritorio_cortina (malla ×1,2 en y: cubierta 0,745). Los casilleros ocupan z < −0,15: todo va en z ≥ −0,1
  const q = A.q, y = 0.745, BR = 0xb08d3c;
  { const x = 0.6, z = -0.1;   // lámpara de bronce con pantalla de vidrio verde
    A.torno('bronce', [[0, y], [0.08, y], [0.082, y + 0.01], [0.06, y + 0.025], [0.02, y + 0.035], [0, y + 0.035]], x, 0, z, BR, q ? 18 : 8);
    A.tubo('bronce', [V3(x, y + 0.03, z), V3(x, y + 0.3, z), V3(x, y + 0.36, z + 0.05)], 0.008, BR, { lados: q ? 8 : 4 });
    A.torno('vidrioColor', [[0.02, 0.0], [0.05, -0.005], [0.12, -0.05], [0.125, -0.06], [0.118, -0.062], [0.045, -0.012], [0.015, -0.006]], 0, 0, 0, 0x2f6a46, q ? 20 : 8, new THREE.Matrix4().makeScale(1, 1, 0.65).setPosition(x, y + 0.38, z + 0.08));
    A.esfera('loza', 0.025, x, y + 0.34, z + 0.08, 0xfff4d8); }
  if (!op.moderno) { const x = -0.62, z = -0.03;   // teléfono de candelero
    A.torno('baquelita', [[0, y], [0.055, y], [0.058, y + 0.012], [0.03, y + 0.03], [0.014, y + 0.05], [0.012, y + 0.29], [0.022, y + 0.3], [0.03, y + 0.33], [0.025, y + 0.345], [0, y + 0.35]], x, 0, z, 0x1a1a1a, q ? 16 : 8);
    A.torno('baquelita', [[0.004, -0.05], [0.014, -0.05], [0.02, 0.0], [0.03, 0.04], [0.028, 0.05], [0.0, 0.05]], 0, 0, 0, 0x1a1a1a, q ? 12 : 6, new THREE.Matrix4().makeRotationX(PI / 2.4).setPosition(x, y + 0.33, z + 0.04));   // bocina
    A.tubo('bronce', [V3(x + 0.015, y + 0.24, z), V3(x + 0.06, y + 0.24, z)], 0.004, BR, { lados: 4 });   // horquilla
    A.torno('baquelita', [[0, 0], [0.02, 0], [0.024, 0.04], [0.016, 0.1], [0.018, 0.13], [0, 0.135]], 0, 0, 0, 0x1a1a1a, q ? 10 : 6, new THREE.Matrix4().makeTranslation(x + 0.07, y + 0.17, z));   // auricular colgado
    A.tubo('tela', curva(t => V3(x + 0.04 * Math.sin(PI * t) + 0.12 * t, y + 0.006 + 0.01 * Math.sin(PI * t * 2), z + 0.05 + 0.25 * t), q ? 10 : 4), 0.004, 0x3a2e26, { lados: 4 }); }
  else { const x = -0.6, z = 0.0;   // teléfono de baquelita de 1967
    const g = bloque(0.2, 0.08, 0.22, 0.03, q ? [3, 2, 3] : [1, 1, 1], (v, w, h) => { if (v.y > 0) v.z *= 0.85; }); uvMetros(g, 'x'); g.translate(x, y + 0.04, z); A.add('baquelita', g, 0x161616);
    A.torno('loza', [[0, 0], [0.05, 0], [0.05, 0.004], [0, 0.005]], x, y + 0.08, z + 0.02, 0xe8e2d0, q ? 16 : 8);   // disco
    A.tubo('baquelita', curva(t => V3(x - 0.1 + 0.2 * t, y + 0.105 + 0.02 * Math.sin(PI * t), z - 0.07), q ? 8 : 3), 0.016, 0x161616, { lados: q ? 8 : 5 });   // auricular
    for (const s of [-1, 1]) A.esfera('baquelita', 0.03, x + s * 0.1, y + 0.1, z - 0.07, 0x161616, 0.7);
    A.tubo('baquelita', curva(t => V3(x + 0.1 + 0.08 * t, y + 0.005, z + 0.1 + 0.25 * t * t), q ? 8 : 3), 0.004, 0x161616, { lados: 4 }); }
  { const C = [0x6a2a20, 0x2f4a3a, 0x3a3a5a];   // libros cerrados
    for (let i = 0; i < 3; i++) { const yy = y + 0.022 + i * 0.044; A.bloque('piel', 0.24 - i * 0.02, 0.04, 0.32 - i * 0.02, 0.004, 0.3, yy, 0.08, C[i], { seg: [1, 1, 1], ry: 0.08 * i - 0.05 });
      A.bloque('loza', 0.226 - i * 0.02, 0.034, 0.3 - i * 0.02, 0.002, 0.305, yy, 0.08, 0xefe8d4, { seg: [1, 1, 1], ry: 0.08 * i - 0.05 }); } }
  { const m = new THREE.Matrix4().makeRotationY(0.2).setPosition(-0.25, y, 0.16);   // libro de registro abierto
    for (const s of [-1, 1]) { const g = bloque(0.17, 0.012, 0.25, 0.003, q ? [4, 1, 2] : [1, 1, 1], (v) => { v.y += 0.008 * Math.sin(PI * (v.x * s + 0.085) / 0.17); }); uvMetros(g, 'x'); g.translate(s * 0.086, 0.01, 0); g.applyMatrix4(m); A.add('loza', g, 0xf2ecda); }
    const tp = bloque(0.36, 0.006, 0.27, 0.002, [1, 1, 1]); uvMetros(tp, 'x'); tp.translate(0, 0.003, 0); tp.applyMatrix4(m); A.add('piel', tp, 0x4a2a1c);
    if (q) for (let k = 0; k < 8; k++) for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(0.13, 0.003); g.rotateX(-PI / 2); g.translate(s * 0.086, 0.0175 + 0.008 * Math.sin(PI * 0.5), -0.09 + k * 0.024); g.applyMatrix4(m); A.add('oscuro', g, 0x5a5a6a); } }   // renglones
  { const x = 0.62, z = 0.26;   // tintero de vidrio con pluma
    A.bloque('cristal', 0.06, 0.04, 0.06, 0.006, x, y + 0.02, z, 0xe6eee8, { seg: [1, 1, 1] }); A.bloque('oscuro', 0.045, 0.025, 0.045, 0.004, x, y + 0.014, z, 0x101018, { seg: [1, 1, 1] });
    A.torno('bronce', [[0, 0], [0.02, 0], [0.022, 0.008], [0, 0.012]], x, y + 0.04, z, BR, 8);
    A.tubo('baquelita', [V3(x + 0.01, y + 0.03, z), V3(x + 0.08, y + 0.17, z - 0.03)], 0.004, 0x1a1a1a, { lados: 5 }); }
  return [1.7, 1.2, 0.85];
}
function libreroJefe(A, op) {
  const q = A.q, w = 2.2, H = 2.2, d = 0.36, M = 0x4e3420, M2 = 0x5e3e24;
  A.bloque('madera', w, 0.1, d, 0.008, 0, 0.05, 0, M, { veta: 'x' });   // zócalo
  for (const s of [-1, 1]) A.bloque('madera', 0.04, H - 0.1, d, 0.006, s * (w / 2 - 0.02), 0.05 + (H - 0.1) / 2, 0, M2, { seg: [1, 4, 1], veta: 'y' });
  A.bloque('madera', 0.035, H - 0.2, d - 0.04, 0.006, 0, 0.1 + (H - 0.2) / 2, -0.01, M2, { seg: [1, 4, 1], veta: 'y' });   // división central
  A.bloque('madera', w - 0.04, H - 0.1, 0.012, 0.003, 0, 0.05 + (H - 0.1) / 2, -d / 2 + 0.006, 0x3e2a18, { seg: [2, 2, 1], veta: 'y' });   // fondo
  A.bloque('madera', w + 0.06, 0.06, d + 0.04, 0.015, 0, H - 0.03, 0.01, M, { veta: 'x' }); A.bloque('madera', w + 0.1, 0.025, d + 0.06, 0.008, 0, H + 0.012, 0.015, M, { veta: 'x' });   // cornisa
  let s = 25; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const C = [0x6a2a20, 0x2f4a3a, 0x3a3a5a, 0x5a4024, 0x7a5a30, 0x2a2a2a];
  for (let k = 0; k < 4; k++) {
    const yb = 0.1 + k * 0.5;
    if (k) A.bloque('madera', w - 0.08, 0.025, d - 0.03, 0.005, 0, yb, -0.005, M2, { seg: [2, 1, 1], veta: 'x' });
    for (const lado of [-1, 1]) {
      let x = lado < 0 ? -w / 2 + 0.05 : 0.03; const x1 = lado < 0 ? -0.03 : w / 2 - 0.05;
      while (x < x1 - 0.06) {
        const e = 0.035 + r() * 0.04, h = 0.24 + r() * 0.14, pr = 0.2 + r() * 0.08, c = C[Math.floor(r() * C.length)];
        if (r() < 0.05 && x < x1 - 0.3) { const hh = h; A.bloque('piel', e, hh, pr, 0.004, x + hh / 2 * Math.sin(0.25) + e / 2, yb + 0.0125 + hh / 2 * Math.cos(0.25), 0.02, c, { seg: [1, 1, 1], rz: -0.25 }); x += hh * Math.sin(0.25) + e + 0.01; continue; }   // libro inclinado
        A.bloque('piel', e, h, pr, 0.004, x + e / 2, yb + 0.0125 + h / 2, d / 2 - pr / 2 - 0.03, c, { seg: [1, 1, 1] });
        if (q) for (const f of [0.15, 0.8]) A.bloque('bronce', e + 0.002, 0.008, 0.004, 0.001, x + e / 2, yb + 0.0125 + h * f, d / 2 - 0.03 + 0.001, 0xc0a050, { seg: [1, 1, 1] });   // nervios dorados del lomo
        x += e + 0.003;
      }
    }
  }
  return [w + 0.1, H + 0.03, d + 0.06];
}


// ================================================================== G9M (16-11): lámparas cialíticas del pabellón, FINAS en código (TRELLIS no ve la cara de abajo)
//   cialitica_1920  Scialytique de una cúpula (Ø 1,5 m): cúpula esmaltada con borde cromado, anillo de 28 + 16 espejos facetados por dentro,
//                   vidrio protector, foco central con lente, corona de 10 lentes chicas que brillan, manilla esterilizable, rótula y vástago
//   cialitica_1967  dos cúpulas (Ø 0,85) en brazos curvos desde un cubo central, horquillas con pivotes y cúpulas inclinadas hacia la mesa
// Marco local: y = 0 en el borde de la cúpula (1920) o en el borde de las cúpulas (1967); el tubo al techo lo pone kitHospital.js.
registrarMaterial('espejo', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.12, metalness: 0.85, emissive: 0x5a6066, emissiveIntensity: 0.45 }));
function cupula(A, Rr, Hh, M, color, n1, n2) {   // cúpula de radio Rr y alto Hh (borde en y 0), transformada por la matriz M
  const q = A.q, seg = q ? 40 : 14, add = (m, g, c) => { g.applyMatrix4(M); A.add(m, g, c); };
  const yIn = r => (Hh - 0.03) * Math.sqrt(Math.max(0, 1 - Math.pow(r / (Rr - 0.025), 2.2)));   // cara de adentro
  const ext = [], int = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, r = Rr * (1 - t * t * 0.0) * Math.cos(t * PI / 2) + 1e-4; ext.push([Math.max(r, 1e-4), Hh * Math.sin(t * PI / 2)]); }
  for (let i = 10; i >= 0; i--) { const r = (Rr - 0.025) * i / 10; int.push([Math.max(r, 1e-4), yIn(r)]); }
  add('esmalte', new THREE.LatheGeometry(ext.map(([r, y]) => new THREE.Vector2(r, y)), seg), color);
  add('esmalte', new THREE.LatheGeometry(int.map(([r, y]) => new THREE.Vector2(r, y)), seg), 0x9ea4a8);
  add('cromo', new THREE.TorusGeometry(Rr - 0.004, Rr * 0.025, q ? 8 : 4, seg).rotateX(PI / 2), 0xc4c8cc);   // borde
  add('cromo', new THREE.TorusGeometry(Rr * 0.97, Rr * 0.012, 4, seg).rotateX(PI / 2).translate(0, Hh * 0.25, 0), 0xc4c8cc);   // filete
  // espejos facetados por dentro: dos anillos (se ven desde abajo)
  for (const [n, r0, r1] of [[n2, 0.6, 0.93], [n1, 0.3, 0.57]]) {
    const rm = Rr * (r0 + r1) / 2, lr = Rr * (r1 - r0), wt = 2 * PI * rm / n * 0.86, dy = yIn(Rr * r1) - yIn(Rr * r0), th = Math.atan2(dy, lr);
    for (let i = 0; i < n; i++) { const a = (i + (n === n1 ? 0.5 : 0)) / n * 2 * PI;
      const g = new THREE.BoxGeometry(Math.hypot(lr, dy) * 0.94, 0.004, wt).rotateZ(th).translate(rm, yIn(rm) - 0.012, 0).rotateY(a);
      add('espejo', g, i % 2 ? 0xf2f6f8 : 0x8e969c); } }
  // foco central y corona de lentes
  const rf = Rr * 0.16;
  add('cromo', new THREE.CylinderGeometry(rf, rf * 1.1, Hh * 0.55, q ? 20 : 8, 1, true).translate(0, Hh * 0.2, 0), 0xc4c8cc);
  add('cromo', new THREE.TorusGeometry(rf * 1.08, rf * 0.12, 4, q ? 20 : 8).rotateX(PI / 2).translate(0, -0.06 * Rr / 0.75 + 0.02, 0), 0xc4c8cc);
  add('llama', new THREE.CircleGeometry(rf * 0.9, q ? 20 : 8).rotateX(PI / 2).translate(0, -0.03, 0), 0xfff2d2);
  { const g = new THREE.SphereGeometry(rf, q ? 20 : 8, q ? 8 : 3, 0, 2 * PI, PI / 2, PI / 2); g.scale(1, 0.45, 1); g.translate(0, -0.03, 0); add('cristal', g, 0xf0f4f0); }   // lente central
  const nL = Math.max(6, Math.round(n1 * 0.6)), rL = Rr * 0.075;
  for (let i = 0; i < nL; i++) { const a = (i + 0.5) / nL * 2 * PI, x = Math.cos(a) * Rr * 0.31, z = Math.sin(a) * Rr * 0.31;
    add('cromo', new THREE.TorusGeometry(rL, rL * 0.18, 4, q ? 12 : 6).rotateX(PI / 2).translate(x, -0.006, z), 0xb8bcc0);
    add('llama', new THREE.CircleGeometry(rL * 0.85, q ? 12 : 6).rotateX(PI / 2).translate(x, -0.004, z), 0xffe6b8);
    const g = new THREE.SphereGeometry(rL, q ? 12 : 6, q ? 5 : 2, 0, 2 * PI, PI / 2, PI / 2); g.scale(1, 0.4, 1); g.translate(x, -0.006, z); add('cristal', g, 0xf0f4f0); }
  // manilla esterilizable bajo el foco
  { const pts = curva(t => V3(-Rr * 0.12 + Rr * 0.24 * t, -0.03 - Rr * 0.13 * Math.sin(PI * t), 0), q ? 10 : 4); const g = HERRAMIENTAS_FINAS.barrido(pts, Rr * 0.016, q ? 8 : 4); add('cromo', g, 0xc4c8cc); }
  add('cromo', new THREE.CylinderGeometry(Rr * 0.05, Rr * 0.07, Hh * 0.18, q ? 14 : 6).translate(0, Hh + Hh * 0.06, 0), 0xc4c8cc);   // collar de arriba
}
function cialitica1920(A, op) {
  const q = A.q;
  cupula(A, 0.75, 0.5, new THREE.Matrix4(), 0xf4f2ea, 16, 28);
  A.esfera('cromo', 0.06, 0, 0.62, 0, 0xc4c8cc);   // rótula
  A.tubo('cromo', [V3(0, 0.6, 0), V3(0, 0.95, 0)], 0.032, 0xc4c8cc, { lados: q ? 12 : 6 });
  A.torno('cromo', [[0.032, 0.8], [0.05, 0.8], [0.05, 0.86], [0.032, 0.86]], 0, 0, 0, 0xc4c8cc, q ? 14 : 6);   // manguito del contrapeso
  return [1.55, 0.95, 1.55];
}
function cialitica1967(A, op) {
  const q = A.q, CR = 0xc4c8cc, Rr = 0.42, Hh = 0.3;
  A.torno('esmalte', [[0, 0.4], [0.09, 0.4], [0.1, 0.44], [0.1, 0.52], [0.06, 0.56], [0.04, 0.56]], 0, 0, 0, 0xd8dcd6, q ? 20 : 8);   // cubo central
  A.tubo('cromo', [V3(0, 0.55, 0), V3(0, 0.95, 0)], 0.04, CR, { lados: q ? 12 : 6 });
  for (const s of [-1, 1]) {
    const xc = s * 0.66, yp = 0.26;
    A.tubo('esmalte', curva(t => V3(s * (0.09 + 0.57 * t), 0.47 + 0.31 * t + 0.16 * Math.sin(PI * t), 0), q ? 14 : 5), 0.03, 0xd8dcd6, { lados: q ? 10 : 5 });   // brazo curvo
    A.esfera('cromo', 0.045, xc, 0.78, 0, CR);   // rótula del brazo
    A.tubo('cromo', curva(t => { const a = PI * t; return V3(xc, yp + 0.5 * Math.sin(a), -0.5 * Math.cos(a)); }, q ? 18 : 7), 0.018, CR, { lados: q ? 8 : 4 });   // horquilla
    for (const z of [-1, 1]) A.tubo('cromo', [V3(xc, yp, z * 0.5), V3(xc, yp, z * (Rr - 0.01))], 0.022, CR, { lados: q ? 8 : 4 });   // pivotes
    const M = new THREE.Matrix4().makeTranslation(xc, yp, 0).multiply(new THREE.Matrix4().makeRotationZ(-s * 0.32)).multiply(new THREE.Matrix4().makeTranslation(0, -yp + 0.12, 0));
    cupula(A, Rr, Hh, M, 0xd8dcd6, 10, 18);
  }
  return [2.0, 0.95, 1.0];
}

export const FABRICA_HOSPITAL = {
  cama_hospital: camaHospital, cama_hospital2: (A, op) => camaHospital(A, { frazada: 0x8a9aa6, ...op }), biombo_hospital: biomboHospital, porta_sueros: portaSueros,
  carro_curaciones: carro, silla_ruedas: sillaRuedas, camilla, banca_espera: bancaEspera, radiador,
  mesa_instrumental: mesaInstrumental, taburete_giratorio: tabureteGiratorio, vitrina_instrumental: vitrinaInstrumental, mecedora_mimbre: mecedora,
  escritorio_cosas_a: escritorioCosas, escritorio_cosas_b: (A, op) => escritorioCosas(A, { moderno: true, ...op }), librero_jefe: libreroJefe,
  cialitica_1920: cialitica1920, cialitica_1967: cialitica1967,   // G9M
  vitrina_medicamentos: (A, op) => vitrinaInstrumental(A, { frascos: true, ...op }),   // G9M (H09)
};
registrarFabrica(FABRICA_HOSPITAL);
