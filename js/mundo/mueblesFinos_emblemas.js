// C5 (G9M, 16-11-2026): muebles FINOS de la iglesia, el cine/teatro 165 y el palitroque, en código (estilo mueblesFinos.js, sin GPU).
//   candelabro_3     I05 candelabro negro de 3 brazos curvos con arandelas, velas de cera y llamas (0,42 × 0,62)
//   florero_ramo     I05 florero de loza con filete dorado y ramo de flores de 5 pétalos con hojas
//   repisa_flores    I06 repisa blanca moldurada con 2 ménsulas en S y 2 floreros con ramos (0,9 × 0,28; frente +z)
//   mesa_iglesia     I07 mesa de nave lateral: cubierta de madera con canto moldurado, patas de fierro con travesaños (0,7 × 0,76 × 1,0)
//   silla_iglesia    I07 silla de madera curvada: asiento de tablillas, respaldo con travesaños, patas de fierro
//   aplique_iglesia  I08 luminaria de pared: roseta, brazo curvo de bronce y globo de opalina (pivote en el muro, sale hacia +z)
//   farol_teatro     T03 farol de pared del teatro: ménsula dorada en voluta y farol hexagonal de vidrio con ampolleta
//   lampara_teatro   T04 lámpara colgante de la nave: vara, pantalla dorada acanalada y globo cálido (pivote en el cielo, cuelga hacia −y)
//   butaca_teatro    T01 butaca de terciopelo: asiento y respaldo acolchados, costado de fierro fundido con voluta y brazo de madera (232 copias)
//   banco_respaldo   L02 banco de madera con respaldo de tablas, patas y brazos (2 m; se escala al largo; frente +z)
//   lampara_globo    L04 lámpara globo del palitroque: brazo rojo con tornapunta, copa y globo blanco (pivote en el pilar, sale hacia +z)
// Marco local: pivote en el piso al centro y frente +z, salvo los indicados.
import * as THREE from 'three';
import { registrarFabrica, registrarMaterial, HERRAMIENTAS_FINAS } from './mueblesFinos.js';

const { curva, bloque, uvMetros } = HERRAMIENTAS_FINAS;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI;
registrarMaterial('terciopelo', (b, T) => { const t = T('tela'), l = T('lana'); return new THREE.MeshStandardMaterial({ ...b, map: t, bumpMap: l, bumpScale: 0.5, roughness: 0.93, metalness: 0 }); }, 1 / 0.3);
registrarMaterial('globo', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.28, emissive: 0xfff2dc, emissiveIntensity: 0.85 }));
registrarMaterial('foco', b => new THREE.MeshBasicMaterial({ ...b, toneMapped: false }));
registrarMaterial('cristal', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
const NEG = 0x1c1a18, ORO = 0xc9a24a, BL = 0xf2efe6;
const M4 = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);

function candelabro(A, op) {
  const q = A.q;
  A.torno('pintura', [[0, 0], [0.09, 0], [0.095, 0.015], [0.07, 0.03], [0.03, 0.06], [0.022, 0.09], [0.035, 0.11], [0.018, 0.13], [0, 0.13]], 0, 0, 0, NEG, q ? 16 : 6);
  A.torno('pintura', [[0.014, 0.12], [0.016, 0.3], [0.03, 0.32], [0.032, 0.34], [0.016, 0.36], [0.014, 0.4], [0, 0.4]], 0, 0, 0, NEG, q ? 10 : 5);
  for (const s of [-1, 1]) A.tubo('pintura', curva(t => V3(s * 0.15 * Math.sin(t * PI / 2), 0.33 + 0.1 * (1 - Math.cos(t * PI / 2)) - 0.03 * Math.sin(PI * t), 0), q ? 10 : 4), 0.008, NEG, { lados: q ? 6 : 4 });
  for (const x of [-0.15, 0, 0.15]) { const y = x ? 0.43 : 0.4;
    A.torno('pintura', [[0, y], [0.035, y], [0.04, y + 0.008], [0.02, y + 0.015], [0.016, y + 0.035], [0, y + 0.035]], x, 0, 0, NEG, q ? 12 : 6);   // arandela y mechero
    A.torno('cera', [[0, y + 0.03], [0.013, y + 0.03], [0.013, y + 0.15], [0.009, y + 0.158], [0, y + 0.16]], x, 0, 0, 0xf2ead2, q ? 10 : 5);
    A.esfera('llama', 0.011, x, y + 0.18, 0, 0xffd27a, 2.0); }
  return [0.42, 0.62, 0.12];
}
function florero(A, x0, y0, z0, k, sem) {   // florero de loza (escala k) con ramo
  const q = A.q; let s = sem; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  A.torno('loza', [[0, 0], [0.05, 0], [0.065, 0.04], [0.07, 0.09], [0.05, 0.15], [0.04, 0.18], [0.055, 0.2], [0.05, 0.205], [0.035, 0.19], [0, 0.17]].map(([a, b]) => [a * k, b * k]), x0, y0, z0, BL, q ? 18 : 8);
  A.torno('bronce', [[0.052 * k, 0.195 * k], [0.057 * k, 0.2 * k], [0.052 * k, 0.205 * k]], x0, y0, z0, ORO, q ? 18 : 8);
  const yb = y0 + 0.19 * k, COL = [0xd8506a, 0xf0d060, 0xf4f0e8, 0xc83a3a, 0xe890b0];
  const n = q ? 11 : 6;
  for (let i = 0; i < n; i++) {
    const a = r() * 2 * PI, inc = 0.15 + r() * 0.45, L = (0.2 + r() * 0.16) * k / 0.9, c = COL[Math.floor(r() * COL.length)];
    const p1 = V3(x0 + Math.cos(a) * Math.sin(inc) * L, yb + Math.cos(inc) * L, z0 + Math.sin(a) * Math.sin(inc) * L);
    A.tubo('tela', [V3(x0, yb - 0.02, z0), V3((x0 + p1.x) / 2, (yb + p1.y) / 2 + 0.02, (z0 + p1.z) / 2), p1], 0.003, 0x3f6b3a, { lados: 3 });
    const np = q ? 5 : 3, rp = 0.022 + r() * 0.01;
    for (let j = 0; j < np; j++) { const b = j / np * 2 * PI + a, g = new THREE.SphereGeometry(rp, q ? 6 : 4, q ? 4 : 2); g.scale(1, 0.3, 0.6); g.translate(rp * 0.8, 0, 0); g.rotateZ(0.35); g.rotateY(b); g.translate(p1.x, p1.y, p1.z); A.add('tela', g, c); }
    A.esfera('tela', rp * 0.4, p1.x, p1.y + 0.004, p1.z, 0xe8c040);
    if (q && i % 2) { const g = new THREE.SphereGeometry(0.022, 5, 3); g.scale(1.5, 0.1, 0.45); g.translate(0.03, 0, 0); g.rotateZ(-0.4); g.rotateY(a + 1.2); g.translate((x0 + p1.x) / 2, (yb + p1.y) / 2, (z0 + p1.z) / 2); A.add('tela', g, 0x4a7a3a); }
  }
}
function floreroRamo(A, op) { florero(A, 0, 0, 0, 1, 71); return [0.3, 0.5, 0.3]; }
function repisaFlores(A, op) {
  const q = A.q, w = 0.9, d = 0.28;
  A.bloque('laca', w, 0.045, d, 0.012, 0, 0, d / 2, BL, { seg: [3, 1, 2], veta: 'x' });
  A.bloque('laca', w + 0.03, 0.02, d + 0.02, 0.008, 0, 0.03, d / 2, BL, { seg: [3, 1, 1] });   // canto moldurado
  for (const s of [-1, 1]) {   // ménsulas en S
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.22, 0); sh.bezierCurveTo(0.2, -0.06, 0.06, -0.06, 0.06, -0.14); sh.bezierCurveTo(0.06, -0.2, 0.02, -0.22, 0, -0.22); sh.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: q ? 8 : 3 });
    g.rotateY(-PI / 2); g.translate(s * w * 0.38 - 0.0175, -0.022, 0); uvMetros(g, 'y'); A.add('laca', g, BL);
  }
  florero(A, -w * 0.2, 0.025, d / 2, 1.1, 37); florero(A, w * 0.22, 0.025, d / 2, 0.85, 53);
  return [w, 0.55, d];
}
function mesaIglesia(A, op) {
  const q = A.q, W = 0.7, D = 1.0, y = 0.76;
  A.bloque('madera', W, 0.035, D, 0.01, 0, y - 0.018, 0, 0x6a4a2c, { seg: [2, 1, 3], veta: 'z' });
  A.bloque('madera', W - 0.08, 0.07, D - 0.08, 0.006, 0, y - 0.07, 0, 0x5a3c22, { seg: [1, 1, 2], veta: 'z' });   // faldón
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.tubo('pintura', [V3(sx * 0.3, 0, sz * 0.45), V3(sx * 0.3, y - 0.04, sz * 0.45)], 0.016, NEG, { lados: q ? 8 : 4 });
  for (const s of [-1, 1]) A.tubo('pintura', [V3(s * 0.3, 0.15, -0.45), V3(s * 0.3, 0.15, 0.45)], 0.008, NEG, { lados: 4 });
  A.tubo('pintura', [V3(-0.3, 0.15, 0), V3(0.3, 0.15, 0)], 0.008, NEG, { lados: 4 });
  { const g = new THREE.PlaneGeometry(0.42, 0.62, q ? 6 : 1, q ? 8 : 1); g.rotateX(-PI / 2); g.translate(0, y + 0.002, 0); A.add('tela', g, 0xf6f2e6); }   // carpeta de crochet
  return [W, y, D];
}
function sillaIglesia(A, op) {
  const q = A.q, M = 0x6a4a2c;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.tubo('pintura', sz < 0 ? curva(t => V3(sx * 0.17, 0.92 * t, -0.17 - 0.03 * t * t), q ? 5 : 2) : [V3(sx * 0.17, 0, 0.17), V3(sx * 0.17, 0.45, 0.17)], 0.012, NEG, { lados: q ? 6 : 4 });
  for (const s of [-1, 1]) A.tubo('pintura', [V3(s * 0.17, 0.2, -0.17), V3(s * 0.17, 0.2, 0.17)], 0.006, NEG, { lados: 3 });
  for (let i = 0; i < 4; i++) A.bloque('madera', 0.4, 0.022, 0.09, 0.006, 0, 0.46, -0.15 + i * 0.1, i % 2 ? M : 0x5e4026, { seg: [2, 1, 1], veta: 'x' });
  for (const y of [0.66, 0.84]) A.bloque('madera', 0.38, 0.07, 0.02, 0.006, 0, y, -0.2 - (y - 0.46) * 0.07, M, { seg: [2, 1, 1], veta: 'x', rx: -0.08 });
  return [0.42, 0.92, 0.42];
}
function apliqueIglesia(A, op) {
  const q = A.q;
  A.torno('bronce', [[0, 0], [0.06, 0], [0.065, 0.012], [0.04, 0.025], [0.012, 0.03], [0, 0.03]], 0, 0, 0, ORO, q ? 16 : 6, new THREE.Matrix4().makeRotationX(PI / 2));   // roseta
  A.tubo('bronce', curva(t => V3(0, -0.06 * Math.sin(PI * t), 0.03 + 0.17 * t), q ? 8 : 3), 0.009, ORO, { lados: q ? 6 : 4 });
  A.torno('bronce', [[0.012, 0], [0.04, 0.005], [0.045, 0.03], [0.03, 0.035], [0.012, 0.035]], 0, -0.03, 0.2, ORO, q ? 14 : 6);   // portaglobo
  { const g = new THREE.SphereGeometry(0.09, q ? 18 : 8, q ? 12 : 5); g.translate(0, 0.08, 0.2); A.add('globo', g, 0xfff6e6); }
  return [0.2, 0.2, 0.3];
}
function farolTeatro(A, op) {
  const q = A.q;
  A.bloque('bronce', 0.1, 0.26, 0.02, 0.006, 0, 0, 0.01, ORO, { seg: [1, 2, 1] });   // placa
  A.tubo('bronce', curva(t => V3(0, 0.08 - 0.12 * t + 0.06 * Math.sin(PI * t), 0.02 + 0.2 * t), q ? 10 : 4), 0.01, ORO, { lados: q ? 6 : 4 });
  A.tubo('bronce', curva(t => V3(0, -0.1 + 0.05 * Math.sin(PI * t * 1.5), 0.02 + 0.12 * t), q ? 8 : 3), 0.007, ORO, { lados: 4 });   // voluta de abajo
  const z = 0.24, y = -0.06;
  A.torno('bronce', [[0, y - 0.06], [0.06, y - 0.06], [0.08, y - 0.02], [0.07, y], [0, y]], 0, 0, z, ORO, 6);   // fondo hexagonal
  A.torno('vidrio', [[0.065, y], [0.08, y + 0.2], [0.065, y + 0.2]], 0, 0, z, 0xfff0d8, 6);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI; A.tubo('bronce', [V3(Math.cos(a) * 0.068, y, z + Math.sin(a) * 0.068), V3(Math.cos(a) * 0.082, y + 0.2, z + Math.sin(a) * 0.082)], 0.004, ORO, { lados: 3 }); }
  A.torno('bronce', [[0.088, y + 0.2], [0.09, y + 0.22], [0.04, y + 0.28], [0.015, y + 0.3], [0, y + 0.31]], 0, 0, z, ORO, 6);   // sombrerete
  A.esfera('foco', 0.04, 0, y + 0.1, z, 0xffe0a8, 1.3);
  return [0.2, 0.42, 0.34];
}
function lamparaTeatro(A, op) {
  const q = A.q;
  A.torno('bronce', [[0, 0], [0.07, 0], [0.06, -0.03], [0.015, -0.05], [0, -0.05]], 0, 0, 0, ORO, q ? 14 : 6);   // florón
  A.tubo('bronce', [V3(0, -0.04, 0), V3(0, -1.98, 0)], 0.012, ORO, { lados: q ? 6 : 4 });
  for (const y of [-0.6, -1.2, -1.8]) A.esfera('bronce', 0.02, 0, y, 0, ORO);
  // pantalla dorada acanalada (cono abierto) con borde
  { const n = q ? 48 : 16, g = new THREE.CylinderGeometry(0.09, 0.4, 0.3, n, 1, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), k = 1 + 0.035 * Math.cos(a * 12) * (r / 0.4); p.setX(i, x * k); p.setZ(i, z * k); }
    g.computeVertexNormals(); g.translate(0, -2.08, 0); A.add('bronce', g, ORO); const g2 = g.clone(); g2.scale(0.985, 1, 0.985); g2.translate(0, -2.08 * 0.0, 0); const idx = g2.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; } g2.computeVertexNormals(); A.add('tulipa', g2, 0xf0d8a0); }
  A.tubo('bronce', curva(t => V3(Math.cos(2 * PI * t) * 0.405, -2.23, Math.sin(2 * PI * t) * 0.405), q ? 36 : 12).slice(0, -1), 0.01, ORO, { lados: 4, cerrado: true });
  A.torno('bronce', [[0.02, -1.98], [0.1, -1.94], [0.1, -1.92], [0.02, -1.92]], 0, 0, 0, ORO, q ? 14 : 6);
  { const g = new THREE.SphereGeometry(0.15, q ? 18 : 8, q ? 12 : 5); g.translate(0, -2.17, 0); A.add('foco', g, 0xffe6b0); }
  return [0.82, 2.4, 0.82];
}
function butacaTeatro(A, op) {
  const q = A.q, V = 0x7a1e22, FN = 0x2a2220, MD = 0x5a3820;
  // costado de fierro fundido (izquierdo; el derecho lo pone la butaca vecina) con voluta y pie
  { const sh = new THREE.Shape(); sh.moveTo(-0.24, 0); sh.lineTo(0.22, 0); sh.lineTo(0.2, 0.05); sh.bezierCurveTo(0.12, 0.08, 0.1, 0.3, 0.14, 0.52); sh.lineTo(0.2, 0.6); sh.lineTo(-0.2, 0.62); sh.bezierCurveTo(-0.16, 0.4, -0.18, 0.2, -0.22, 0.05); sh.lineTo(-0.24, 0);
    const ho = new THREE.Path(); ho.absellipse(-0.02, 0.32, 0.08, 0.14, 0, 2 * PI, false); sh.holes.push(ho);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: q, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: q ? 6 : 2 });
    g.rotateY(-PI / 2); g.translate(-0.3, 0, 0); uvMetros(g, 'y'); A.add('pintura', g, FN); }
  A.bloque('madera', 0.06, 0.035, 0.42, 0.012, -0.3, 0.64, -0.0, MD, { seg: [1, 1, 3], veta: 'z' });   // brazo
  // asiento (acolchado, un poco levantado atrás) y respaldo curvo
  { const g = bloque(0.5, 0.12, 0.44, 0.04, q ? [4, 2, 4] : [2, 1, 2], (v, w, h, d) => { if (v.y > 0) v.y += 0.015 * (1 - Math.pow(2 * v.x / w, 4)) * (1 - Math.pow(2 * v.z / d, 4)); }); uvMetros(g, 'x'); g.rotateX(-0.05); g.translate(0, 0.44, 0.02); A.add('terciopelo', g, V); }
  A.bloque('pintura', 0.46, 0.02, 0.4, 0.004, 0, 0.375, 0.02, FN, { seg: [1, 1, 1] });
  { const g = bloque(0.5, 0.6, 0.09, 0.035, q ? [4, 4, 1] : [2, 2, 1], (v, w) => { v.z += 0.04 * Math.pow(2 * v.x / w, 2); }); uvMetros(g, 'y'); g.rotateX(0.16); g.translate(0, 0.82, -0.22); A.add('terciopelo', g, V); }
  { const g = bloque(0.5, 0.6, 0.02, 0.006, [2, 2, 1], (v, w) => { v.z += 0.04 * Math.pow(2 * v.x / w, 2); }); uvMetros(g, 'y'); g.rotateX(0.16); g.translate(0, 0.82, -0.275); A.add('madera', g, MD); }   // espaldar de madera
  A.bloque('bronce', 0.06, 0.03, 0.006, 0.002, 0, 1.08, -0.255, ORO, { seg: [1, 1, 1] });   // plaquita del número
  return [0.62, 1.12, 0.6];
}
function bancoRespaldo(A, op) {
  const q = A.q, L = 2.0, M = 0x6a4a2c, M2 = 0x553a22;
  for (let i = 0; i < 3; i++) A.bloque('madera', L, 0.035, 0.15, 0.008, 0, 0.46, 0.2 - i * 0.16, i % 2 ? M : M2, { seg: [4, 1, 1], veta: 'x' });
  for (let i = 0; i < 3; i++) A.bloque('madera', L, 0.1, 0.025, 0.008, 0, 0.62 + i * 0.13, -0.28 - i * 0.025, i % 2 ? M2 : M, { seg: [4, 1, 1], veta: 'x', rx: -0.18 });
  const nP = 3;
  for (let k = 0; k < nP; k++) { const x = -L / 2 + 0.1 + k * (L - 0.2) / (nP - 1);
    A.bloque('madera', 0.06, 0.44, 0.06, 0.006, x, 0.22, 0.2, M2, { seg: [1, 2, 1], veta: 'y' });
    A.tubo('madera', curva(t => V3(x, 0.92 * t, -0.24 - 0.12 * t * t), q ? 6 : 2), 0.03, M2, { lados: 4, plano: true });   // pata trasera que sube al respaldo
    A.bloque('madera', 0.05, 0.05, 0.48, 0.006, x, 0.43, -0.03, M, { seg: [1, 1, 2], veta: 'z' });   // travesaño del asiento
    A.bloque('madera', 0.04, 0.04, 0.42, 0.006, x, 0.12, -0.03, M, { seg: [1, 1, 2], veta: 'z' }); }
  for (const s of [-1, 1]) { const x = s * (L / 2 - 0.1);
    A.tubo('madera', curva(t => V3(x, 0.66 + 0.04 * Math.sin(PI * t), -0.3 + 0.52 * t), q ? 6 : 2), 0.025, M, { lados: 4, plano: true });   // brazo
    A.tubo('madera', [V3(x, 0.46, 0.2), V3(x, 0.66, 0.22)], 0.018, M, { lados: q ? 6 : 4 }); }
  A.bloque('madera', L - 0.1, 0.05, 0.03, 0.006, 0, 0.18, 0.2, M2, { seg: [3, 1, 1], veta: 'x' });
  return [L, 1.0, 0.6];
}
function lamparaGlobo(A, op) {
  const q = A.q, RO = 0xb3202a;
  A.bloque('pintura', 0.12, 0.2, 0.02, 0.006, 0, 0.0, 0.01, RO, { seg: [1, 1, 1] });   // placa en el pilar
  A.tubo('pintura', [V3(0, 0, 0.02), V3(0, 0, 0.42)], 0.025, RO, { lados: q ? 10 : 5 });   // brazo
  A.tubo('pintura', curva(t => V3(0, -0.12 + 0.12 * t - 0.03 * Math.sin(PI * t), 0.02 + 0.3 * t), q ? 8 : 3), 0.012, RO, { lados: q ? 6 : 4 });   // tornapunta
  A.torno('pintura', [[0, 0.02], [0.03, 0.02], [0.07, 0.06], [0.09, 0.13], [0.085, 0.15], [0.03, 0.15], [0, 0.15]], 0, 0, 0.45, RO, q ? 16 : 8);   // copa
  { const g = new THREE.SphereGeometry(0.2, q ? 22 : 10, q ? 16 : 7); g.translate(0, 0.43, 0.45); A.add('globo', g, 0xfff4dc); }
  return [0.42, 0.65, 0.66];
}

export const FABRICA_EMBLEMAS = {
  candelabro_3: candelabro, florero_ramo: floreroRamo, repisa_flores: repisaFlores, mesa_iglesia: mesaIglesia, silla_iglesia: sillaIglesia,
  aplique_iglesia: apliqueIglesia, farol_teatro: farolTeatro, lampara_teatro: lamparaTeatro, butaca_teatro: butacaTeatro, banco_respaldo: bancoRespaldo,
  lampara_globo: lamparaGlobo,
};
registrarFabrica(FABRICA_EMBLEMAS);
