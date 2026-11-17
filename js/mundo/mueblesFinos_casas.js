// C1 (finos C, 16-11-2026): muebles FINOS de las casas 1905, Hamilton y casas genéricas, en código (estilo mueblesFinos.js, sin GPU).
//   mesa_rustica   G01 mesa de tablas (3 tablones con junta, faldones, patas escuadradas algo ahusadas, travesaños en H); 1,2 × 0,8 (se escala)
//   banca_rustica  G02 banca de palo: tablón grueso y 4 patas abiertas de palo redondo con cuñas; 1,6 m (se escala a lo largo)
//   farol_parafina G09 farol de parafina: asa de alambre, sombrerete con respiros, globo de vidrio con guardas, depósito de lata (y 0 = gancho)
//   candil         G10 candil de lata: cazoleta, pico con mecha, asa de anillo (y 0 = apoyo)
//   lavamanos_rustico G12 banco de lavarse con palangana y jarro de lata enlozada y toalla en el travesaño
//   palangana_fina G12 palangana suelta de lata enlozada (pie anular, borde con filete azul, agua); y 0 = apoyo
//   repisa_pared   G14 repisa de tabla con dos ménsulas recortadas y moldura (z 0 = muro, y 0 = cara de arriba)
//   biombo_3hojas  G30 biombo de 3 hojas con bastidor torneado y paño tapizado (Hamilton)
//   biombo_tablas  G30 biombo de tablas de 1905 (tablas verticales con luz, 3 pies derechos con patín)
// Marco local: pivote en el piso al centro, frente hacia +z.
import * as THREE from 'three';
import { registrarFabrica, registrarMaterial, HERRAMIENTAS_FINAS } from './mueblesFinos.js';

const { doblar, densificar, curva, bloque, uvMetros } = HERRAMIENTAS_FINAS;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI;
registrarMaterial('lata', (b, T) => new THREE.MeshStandardMaterial({ ...b, map: T('bronce'), roughness: 0.42, metalness: 0.5, emissive: 0x2c2c2a, emissiveIntensity: 0.5 }), 1 / 0.1);
registrarMaterial('vidrioColor', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.84 }));
registrarMaterial('foco', b => new THREE.MeshBasicMaterial({ ...b, toneMapped: false }));
const rustico = (k, a = 0.004) => v => { v.x += a * Math.sin(v.y * 37 + k) + a * 0.6 * Math.sin(v.z * 23 + k * 3); v.z += a * Math.sin(v.y * 29 + k * 2); };

// ------------------------------------------------------------------ MESA de tablas (1,2 × 0,8; alto 0,78)
function mesaRustica(A, op) {
  const M = op.madera ?? 0x7a5a3e, q = A.q, W = 1.2, D = 0.8, H = 0.78;
  for (let i = 0; i < 3; i++) { const z = -D / 2 + D / 6 + i * D / 3; A.bloque('madera', W, 0.04, D / 3 - 0.006, 0.006, 0, H - 0.02, z, M + (i - 1) * 0x060402, { seg: [6, 1, 2], veta: 'x', def: v => { v.y += 0.002 * Math.sin(v.x * 9 + i * 2); } }); }
  for (const s of [-1, 1]) { A.bloque('madera', W - 0.16, 0.09, 0.025, 0.004, 0, H - 0.085, s * (D / 2 - 0.07), M, { veta: 'x' }); A.bloque('madera', 0.025, 0.09, D - 0.16, 0.004, s * (W / 2 - 0.07), H - 0.085, 0, M, { veta: 'z' }); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) A.tubo('madera', [V3(sx * (W / 2 - 0.07), 0, sz * (D / 2 - 0.07)), V3(sx * (W / 2 - 0.07), H - 0.04, sz * (D / 2 - 0.07))], 0.028, M, { lados: 4, plano: true, rFn: t => 0.78 + 0.22 * t });
  for (const sx of [-1, 1]) A.bloque('madera', 0.03, 0.045, D - 0.14, 0.004, sx * (W / 2 - 0.07), 0.16, 0, M, { veta: 'z' });
  A.bloque('madera', W - 0.14, 0.045, 0.03, 0.004, 0, 0.2, 0, M, { veta: 'x' });
  if (q) for (const sx of [-1, 1]) for (const sz of [-1, 1]) A.tubo('oscuro', [V3(sx * (W / 2 - 0.07), H - 0.002, sz * (D / 2 - 0.08)), V3(sx * (W / 2 - 0.07), H + 0.001, sz * (D / 2 - 0.08))], 0.005, 0x2a2622, { lados: 5 });   // clavos
  return [W, H, D];
}

// ------------------------------------------------------------------ BANCA de palo (1,6 m)
function bancaRustica(A, op) {
  const M = op.madera ?? 0x6e5238, q = A.q, Lx = 1.6, H = 0.44;
  A.bloque('madera', Lx, 0.055, 0.3, 0.012, 0, H - 0.028, 0, M, { seg: [8, 1, 2], veta: 'x', def: (v, w) => { v.z *= 1 + 0.04 * Math.sin(v.x * 4.1); v.y += 0.003 * Math.sin(v.x * 11); void w; } });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx * (Lx / 2 - 0.16), z0 = sz * 0.07, x1 = x0 + sx * 0.08, z1 = z0 + sz * 0.07;
    A.tubo('madera', [V3(x1, 0, z1), V3(x0, H - 0.03, z0), V3(x0 - sx * 0.006, H + 0.001, z0 - sz * 0.003)], 0.024, M - 0x080604, { lados: q ? 7 : 5, rFn: t => 0.85 + 0.15 * t });
    if (q) A.bloque('madera', 0.012, 0.004, 0.045, 0.001, x0, H + 0.0005, z0, 0x4a3422, { seg: [1, 1, 1] });   // cuña en la espiga
  }
  for (const sx of [-1, 1]) A.tubo('madera', [V3(sx * (Lx / 2 - 0.12), 0.16, -0.12), V3(sx * (Lx / 2 - 0.12), 0.16, 0.12)], 0.014, M, { lados: q ? 6 : 4 });
  return [Lx, H, 0.32];
}

// ------------------------------------------------------------------ FAROL DE PARAFINA (cuelga del gancho: y 0 arriba)
function farol(A, op) {
  const L = op.lata ?? 0x8c8a82, q = A.q, s = q ? 16 : 8;
  A.tubo('lata', curva(t => V3(Math.cos(PI * t) * 0.08, -0.03 - Math.sin(PI * t) * 0.05 - 0.02, 0), q ? 12 : 5), 0.003, 0x3a3936, { lados: 4 });   // asa de alambre
  A.tubo('lata', curva(t => V3(Math.cos(PI * (1 + t)) * 0.02, -0.005 + Math.sin(PI * (1 + t)) * 0.02, 0), 6), 0.003, 0x3a3936, { lados: 4 });   // argolla en el gancho
  A.torno('lata', [[0, -0.07], [0.012, -0.07], [0.02, -0.085], [0.03, -0.09], [0.05, -0.11], [0.082, -0.14], [0.085, -0.15], [0.05, -0.152], [0, -0.152]], 0, 0, 0, L, s);   // sombrerete
  if (q) for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI; A.bloque('oscuro', 0.012, 0.004, 0.006, 0.001, Math.cos(a) * 0.04, -0.104, Math.sin(a) * 0.04, 0x1a1a1a, { ry: -a, seg: [1, 1, 1] }); }   // respiros
  A.torno('vidrioColor', [[0.04, -0.15], [0.058, -0.18], [0.068, -0.23], [0.064, -0.28], [0.05, -0.31], [0.044, -0.32]], 0, 0, 0, 0xeef2ea, s);   // globo
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; A.tubo('lata', curva(t => { const y = -0.15 - 0.17 * t, r = 0.072 + 0.012 * Math.sin(PI * t); return V3(Math.cos(a) * r, y, Math.sin(a) * r); }, q ? 8 : 3), 0.0028, 0x3a3936, { lados: 4 }); }   // guardas
  A.torno('bronce', [[0.03, -0.32], [0.046, -0.322], [0.046, -0.335], [0.03, -0.34]], 0, 0, 0, 0xb08840, s);   // quemador
  A.torno('foco', [[0, -0.3], [0.008, -0.285], [0.011, -0.262], [0.007, -0.245], [0, -0.235]], 0, 0, 0, 0xffc45e, 8);   // llama
  A.torno('lata', [[0, -0.34], [0.05, -0.34], [0.074, -0.35], [0.078, -0.37], [0.078, -0.41], [0.074, -0.425], [0.06, -0.43], [0, -0.43]], 0, 0, 0, L, s);   // depósito
  if (q) for (const y of [-0.375, -0.405]) A.torno('lata', [[0.078, y - 0.003], [0.081, y], [0.078, y + 0.003]], 0, 0, 0, L - 0x101010, s);   // nervios del depósito
  return [0.18, 0.44, 0.18];
}

// ------------------------------------------------------------------ CANDIL de lata (y 0 = apoyo)
function candil(A, op) {
  const L = op.lata ?? 0x8a877e, q = A.q, s = q ? 14 : 7;
  A.torno('lata', [[0, 0], [0.05, 0], [0.056, 0.008], [0.05, 0.03], [0.046, 0.06], [0.05, 0.068], [0.036, 0.074], [0, 0.074]], 0, 0, 0, L, s);
  A.tubo('lata', [V3(0.035, 0.05, 0), V3(0.06, 0.09, 0), V3(0.066, 0.12, 0)], 0.008, L, { lados: q ? 8 : 4, rFn: t => 1 - 0.3 * t });   // pico
  A.tubo('oscuro', [V3(0.066, 0.118, 0), V3(0.068, 0.13, 0)], 0.003, 0x1a1512, { lados: 4 });
  A.torno('foco', [[0, 0], [0.006, 0.006], [0.008, 0.016], [0.005, 0.026], [0, 0.034]], 0.068, 0.128, 0, 0xffc45e, 8);
  A.tubo('lata', curva(t => V3(-0.05 - Math.sin(PI * t) * 0.035, 0.035 + 0.035 * (1 - Math.cos(PI * t)) / 2 * 0 + Math.cos(PI * t) * -0.025 + 0.025, 0), q ? 10 : 4), 0.004, L, { lados: 4 });   // asa
  return [0.18, 0.17, 0.11];
}

// ------------------------------------------------------------------ LAVAMANOS rústico: banco, palangana y jarro de lata enlozada, toalla
function lavamanos(A, op) {
  const M = op.madera ?? 0x6a4e36, E = op.enlozado ?? 0xe8e4da, Az = 0x2c4a78, q = A.q, s = q ? 20 : 8, H = 0.62;
  A.bloque('madera', 0.7, 0.035, 0.4, 0.006, 0, H - 0.018, 0, M, { veta: 'x', def: rustico(2, 0.002) });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) A.tubo('madera', [V3(sx * 0.3, 0, sz * 0.15), V3(sx * 0.3, H - 0.03, sz * 0.15)], 0.02, M, { lados: 4, plano: true });
  A.bloque('madera', 0.6, 0.03, 0.3, 0.005, 0, 0.18, 0, M, { veta: 'x' });   // repisa baja
  for (const sx of [-1, 1]) A.tubo('madera', [V3(sx * 0.3, H + 0.12, -0.15), V3(sx * 0.3, H - 0.03, -0.15)], 0.014, M, { lados: q ? 6 : 4 });
  A.tubo('madera', [V3(-0.36, H + 0.12, -0.15), V3(0.36, H + 0.12, -0.15)], 0.012, M, { lados: q ? 6 : 4 });   // toallero
  { const g = bloque(0.3, 0.32, 0.012, 0.004, q ? [4, 6, 1] : [2, 2, 1], (v, w, h) => { const t = (h / 2 - v.y) / h; v.z += 0.02 * Math.sin(v.x * 30) * t + (v.y > h / 2 - 0.01 ? 0.008 : 0); }); uvMetros(g, 'y'); g.translate(0.12, H + 0.12 - 0.15, -0.16); A.add('tela', g, 0xece6d4); }
  A.torno('loza', [[0, H + 0.002], [0.09, H + 0.003], [0.15, H + 0.03], [0.19, H + 0.075], [0.205, H + 0.085], [0.2, H + 0.088], [0.186, H + 0.078], [0.14, H + 0.04], [0.085, H + 0.015], [0, H + 0.014]], 0, 0, 0.01, E, s);   // palangana
  A.torno('loza', [[0.2, H + 0.083], [0.208, H + 0.088], [0.2, H + 0.091]], 0, 0, 0.01, Az, s);   // filete azul
  A.torno('loza', [[0, H], [0.05, H], [0.055, H + 0.02], [0.06, H + 0.09], [0.05, H + 0.15], [0.04, H + 0.19], [0.05, H + 0.22], [0.045, H + 0.225], [0, H + 0.2]], 0.26, 0, 0.1, E, q ? 16 : 7);   // jarro
  A.tubo('loza', curva(t => V3(0.26 - 0.055 - Math.sin(PI * t) * 0.045, H + 0.06 + 0.12 * t, 0.1), q ? 8 : 4), 0.006, E, { lados: 4 });
  return [0.72, H + 0.24, 0.42];
}

// ------------------------------------------------------------------ PALANGANA suelta de lata enlozada (PALANGANA-FINA, 16-11: la malla TRELLIS
// «palangana» se veía rasgada, «acuarela», a 1080p). Fuente honda de 0,43 m con pie anular, borde enrollado con filete azul, algo de agua.
// y 0 = apoyo (piso o tabla); se pone sola, NO reemplaza al lavamanos_rustico.
function palangana(A, op) {
  const E = op.enlozado ?? 0xe9e5dc, Az = op.filete ?? 0x2c4a78, q = A.q, s = q ? 28 : 12;
  A.torno('loza', [[0.075, 0], [0.095, 0], [0.1, 0.012]], 0, 0, 0, E, s);   // pie anular
  A.torno('loza', [[0, 0.01], [0.1, 0.012], [0.16, 0.038], [0.198, 0.082], [0.212, 0.094], [0.216, 0.1], [0.208, 0.103], [0.2, 0.096], [0.188, 0.086], [0.148, 0.048], [0.09, 0.024], [0, 0.021]], 0, 0, 0, E, s);   // fuente (cara de afuera y de adentro)
  A.torno('loza', [[0.207, 0.097], [0.219, 0.1], [0.21, 0.106], [0.202, 0.1]], 0, 0, 0, Az, s);   // filete azul del borde enrollado
  A.torno('vidrioColor', [[0, 0.05], [0.164, 0.05]], 0, 0, 0, op.agua ?? 0x8d9a9b, s);   // agua jabonosa
  return [0.44, 0.11, 0.44];
}

// ------------------------------------------------------------------ REPISA de pared con ménsulas (z 0 = muro, y 0 = cara de arriba de la tabla)
function repisa(A, op) {
  const M = op.madera ?? 0x6e4a2c, q = A.q, W = 0.8, D = 0.24;
  A.bloque('madera', W, 0.032, D, 0.006, 0, -0.016, D / 2, M, { veta: 'x' });
  A.bloque('madera', W - 0.02, 0.02, 0.014, 0.004, 0, -0.04, D - 0.01, M, { veta: 'x' });   // moldura del canto
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.2, 0); s.quadraticCurveTo(0.17, -0.04, 0.12, -0.06); s.quadraticCurveTo(0.08, -0.08, 0.07, -0.13); s.quadraticCurveTo(0.03, -0.15, 0.0, -0.2); s.lineTo(0, 0);
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) { const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: q ? 8 : 3 });
    g.translate(0, -0.032, -0.011); uvMetros(g, 'y'); g.rotateY(-PI / 2); g.translate(x, 0, 0); A.add('madera', g, M); }
  return [W, 0.24, D];
}

// ------------------------------------------------------------------ BIOMBO de 3 hojas (Hamilton): bastidor torneado y paño tapizado
function biombo3(A, op) {
  const M = op.madera ?? 0x3a2416, T = op.pano ?? 0x3f5a3a, q = A.q, w = 0.64, H = 1.72, ang = 0.22;
  for (let i = -1; i <= 1; i++) {
    const a = i % 2 ? ang : -ang, m = new THREE.Matrix4().makeRotationY(a).setPosition(i * (w + 0.03) * Math.cos(ang), 0, 0);   // zigzag: las hojas se tocan en las bisagras
    const P = (x, y) => new THREE.Vector3(x, y, 0).applyMatrix4(m);
    for (const sx of [-1, 1]) { const g = new THREE.LatheGeometry([[0, 0], [0.022, 0], [0.024, 0.04], [0.016, 0.07], [0.017, H - 0.08], [0.022, H - 0.06], [0.014, H - 0.02], [0.006, H], [0, H]].map(([r, y]) => new THREE.Vector2(r, y)), q ? 10 : 5);
      g.translate(sx * w / 2, 0, 0); g.applyMatrix4(m); { const p = g.attributes.position, uv = g.attributes.uv; for (let k = 0; k < p.count; k++) uv.setXY(k, uv.getX(k) * 0.1, p.getY(k)); } A.add('madera', g, M); }
    for (const y of [0.14, H - 0.12]) A.tubo('madera', [P(-w / 2, y), P(w / 2, y)], 0.016, M, { lados: q ? 6 : 4 });
    const pano = bloque(w - 0.04, H - 0.3, 0.02, 0.006, q ? [4, 8, 1] : [1, 2, 1], (v, ww, hh) => { v.z += 0.006 * Math.sin(v.x * 40); void ww; void hh; });
    uvMetros(pano, 'y'); pano.translate(0, (H - 0.3) / 2 + 0.15, 0); pano.applyMatrix4(m); A.add('tela', pano, T);
    if (q) { const g = bloque(w - 0.04, 0.035, 0.026, 0.006, [2, 1, 1]); uvMetros(g, 'x'); g.translate(0, H - 0.12 - 0.02, 0); g.applyMatrix4(m); A.add('madera', g, M); }
  }
  return [2.1, H, 0.4];
}

// ------------------------------------------------------------------ BIOMBO de tablas (1905): tablas verticales con luz entre ellas, 3 pies derechos con patín
function biomboTablas(A, op) {
  const M = op.madera ?? 0x6a5038, q = A.q, W = 2.1, H = 1.6;
  for (let i = 0; i < 9; i++) { const x = -W / 2 + 0.12 + i * (W - 0.24) / 8, h = H - 0.08 - (i * 37 % 5) * 0.012;
    A.bloque('madera', 0.21, h, 0.022, 0.004, x, 0.1 + h / 2, 0, M + ((i * 13) % 3 - 1) * 0x050403, { seg: [1, 3, 1], veta: 'y', def: rustico(i, 0.003) }); }
  for (const y of [0.35, H - 0.2]) A.bloque('madera', W, 0.08, 0.025, 0.004, 0, y, -0.024, M - 0x0a0806, { veta: 'x' });   // travesaños de atrás
  for (const k of [-1, 0, 1]) { A.bloque('madera', 0.07, H + 0.12, 0.07, 0.008, k * 0.98, (H + 0.12) / 2, -0.06, M - 0x100c08, { veta: 'y', def: rustico(k + 5, 0.003) });
    A.bloque('madera', 0.07, 0.06, 0.45, 0.008, k * 0.98, 0.03, -0.06, M - 0x100c08, { veta: 'z' }); }
  if (q) for (let i = 0; i < 9; i++) for (const y of [0.35, H - 0.2]) A.esfera('oscuro', 0.006, -W / 2 + 0.12 + i * (W - 0.24) / 8, y, 0.013, 0x2a2622, 0.5);   // clavos
  return [W, H + 0.12, 0.45];
}

// ================================================================== C1b (finos C, relevo 16-11)
//   herramientas_minero G08 barreta de punta, combo (cabeza en el suelo, mango apoyado) y pala de mango largo, apoyados en un muro que está en
//                    z = −0,2 del pivote (los pies en z ≈ +0,05 … +0,1). Se monta con el giro que deja el muro detrás (−z local hacia el muro).
//   cortina_lana     G36 varilla de fierro con remates y argollas, cortina de lana con franjas y pliegues que cae de 0,95 m en adelante (2,5 m;
//                    se escala en x al largo de la varilla)
registrarMaterial('fierroF', (b, T) => { const t = T('pintura'); return new THREE.MeshStandardMaterial({ ...b, map: t, bumpMap: t, bumpScale: 1.2, roughness: 0.55, metalness: 0.5 }); }, 1 / 0.2);
function herramientasMinero(A, op) {
  const q = A.q, FE = 0x4a4642, MV = 0x7a5a3a, yw = -0.2;
  const apoyo = (x, pie, top, h) => { const zt = yw + 0.025; return [V3(x, pie, 0.08), V3(x + 0.02, h, zt)]; };
  { const [a, b] = apoyo(0, 0.02, 0, 1.56), dir = b.clone().sub(a).normalize();   // barreta: punta de cincel abajo, cabeza recalcada arriba
    A.tubo('fierroF', [a.clone().addScaledVector(dir, 0.06), b], 0.016, FE, { lados: q ? 8 : 5 });
    A.tubo('fierroF', [a, a.clone().addScaledVector(dir, 0.06)], 0.016, FE, { lados: 4, esc: [1, 0.3], rFn: t => 0.3 + 0.7 * t });
    A.tubo('fierroF', [b.clone().addScaledVector(dir, -0.04), b.clone().addScaledVector(dir, 0.015)], 0.021, FE, { lados: q ? 8 : 5 }); }
  { const x = -0.27, cab = V3(x, 0.05, 0.05);   // combo: cabeza de fierro en el suelo, mango apoyado
    const g = bloque(0.09, 0.09, 0.22, 0.012, q ? [2, 2, 2] : [1, 1, 1]); uvMetros(g, 'z'); g.rotateY(PI / 2); g.translate(cab.x, 0.045, cab.z); A.add('fierroF', g, 0x3a3836);
    A.tubo('madera', curva(t => V3(x + 0.01 * t, 0.06 + 0.82 * t, 0.05 + (yw + 0.03 - 0.05) * t + 0.01 * Math.sin(PI * t)), q ? 6 : 2), 0.017, MV, { lados: q ? 8 : 5, rFn: t => 1 - 0.15 * t }); }
  { const x = 0.32;   // pala: hoja de lata con tubo, mango largo apoyado
    const pie = V3(x, 0.02, 0.1), top = V3(x - 0.02, 1.36, yw + 0.025), dir = top.clone().sub(pie).normalize();
    const hoja = new THREE.Shape(); hoja.moveTo(-0.11, 0.0); hoja.quadraticCurveTo(-0.12, 0.2, -0.09, 0.28); hoja.lineTo(-0.025, 0.32); hoja.lineTo(0.025, 0.32); hoja.lineTo(0.09, 0.28); hoja.quadraticCurveTo(0.12, 0.2, 0.11, 0.0); hoja.quadraticCurveTo(0, -0.05, -0.11, 0.0);
    const M2 = new THREE.Matrix4(), up = dir.clone(), fw = V3(0, 0, 1).sub(up.clone().multiplyScalar(up.z)).normalize(), rt = up.clone().cross(fw);
    M2.makeBasis(rt, up, fw).setPosition(pie); const g2 = new THREE.ExtrudeGeometry(hoja, { depth: 0.004, bevelEnabled: false, curveSegments: q ? 6 : 2 }); const p2 = g2.attributes.position;
    for (let k = 0; k < p2.count; k++) p2.setZ(k, p2.getZ(k) + 0.03 * Math.pow(p2.getX(k) / 0.12, 2) + 0.01);
    g2.computeVertexNormals(); uvMetros(g2, 'y'); g2.applyMatrix4(M2); A.add('lata', g2, 0x6a6660);
    A.tubo('lata', [pie.clone().addScaledVector(dir, 0.26), pie.clone().addScaledVector(dir, 0.42)], 0.022, 0x5a5650, { lados: q ? 8 : 5, rFn: t => 1 - 0.3 * t });   // tubo de la hoja
    A.tubo('madera', [pie.clone().addScaledVector(dir, 0.38), top], 0.017, MV, { lados: q ? 8 : 5 }); }
  return [0.8, 1.6, 0.35];
}
function cortinaLana(A, op) {
  const q = A.q, L = 2.5, y = 2.2, xa = -L / 2 + 0.95, xb = L / 2 - 0.03, FE = 0x2e2c2a;
  A.tubo('fierroF', [V3(-L / 2, y, 0), V3(L / 2, y, 0)], 0.012, FE, { lados: q ? 8 : 5 });
  for (const s of [-1, 1]) { A.esfera('fierroF', 0.022, s * L / 2, y, 0, FE); A.tubo('fierroF', [V3(s * (L / 2 - 0.06), y, 0), V3(s * (L / 2 - 0.06), y + 0.03, 0), V3(s * (L / 2 - 0.06), y + 0.03, -0.06)], 0.006, FE, { lados: 4 }); }   // remates y soportes al muro
  const n = q ? 11 : 6;
  for (let i = 0; i < n; i++) { const x = xa + 0.02 + i * (xb - xa - 0.04) / (n - 1);
    A.tubo('fierroF', curva(t => V3(x + Math.cos(2 * PI * t) * 0.0, y + Math.sin(2 * PI * t) * 0.022, Math.cos(2 * PI * t) * 0.022), q ? 10 : 4).slice(0, -1), 0.003, FE, { lados: 3, cerrado: true }); }   // argollas
  const W = xb - xa, H = 2.05, nu = q ? 60 : 12, nv = q ? 16 : 4;
  const bandas = [[0, 0.06, 0x8a3a2a], [0.06, 0.1, 0x6e6a62], [0.1, 0.16, 0x8a3a2a], [0.16, 0.84, 0x6e6a62], [0.84, 0.9, 0x8a3a2a], [0.9, 1, 0x6e6a62]];
  for (const [v0, v1, c] of bandas) {
    const g = new THREE.PlaneGeometry(W, H * (v1 - v0), nu, Math.max(1, Math.round(nv * (v1 - v0)))), p = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < p.count; k++) { const u = (p.getX(k) + W / 2) / W, yy = y - 0.03 - H * (1 - v0) + (p.getY(k) + H * (v1 - v0) / 2), t = (y - 0.03 - yy) / H;
      const pl = 0.045 * Math.sin(u * W * 2 * PI / 0.16) + 0.012 * Math.sin(u * W * 2 * PI / 0.07 + 1.3);
      p.setXYZ(k, xa + u * W + 0.01 * t * Math.sin(u * 9), yy, pl * (0.55 + 0.45 * t)); uv.setXY(k, u * W, yy); }
    g.computeVertexNormals(); A.add('lana', g, c); }
  return [L, y + 0.04, 0.15];
}

// ================================================================== C6 (finos C, relevo 16-11): menudencias de las casas
//   ropa_clavos / ropa_clavos_r  G16 tabla de clavos contra el muro (muro en z = 0, frente +z) con 3 prendas de lana colgadas y dobladas sobre los clavos
//   ropa_tendida / ropa_tendida_r G15 ropa tendida en un cordel a y = 2,08 (el cordel lo dibuja el código de largo variable): camisa con mangas, paño,
//                    calcetines y sábana chica con perros de ropa; 1,6 m de ancho (la «_r» con colores de 1905)
//   escoba           G19 escoba de curahuilla: palo torneado, abanico de paja con 3 amarras de alambre
registrarMaterial('paja', (b, T) => { const t = T('tela'); return new THREE.MeshStandardMaterial({ ...b, map: t, bumpMap: t, bumpScale: 4, roughness: 0.9, side: THREE.DoubleSide }); }, 1 / 0.04);
function prenda(A, mat, x, yTop, z, w, h, color, sem, plano = false) {   // tela colgada: arriba redondeada sobre el clavo/cordel, pliegues que se abren abajo
  const q = A.q, g = bloque(w, h, 0.02, 0.008, q ? [8, 10, 1] : [2, 3, 1], (v, ww, hh) => {
    const t = (hh / 2 - v.y) / hh; v.z += (plano ? 0.006 : 0.016) * Math.sin(v.x * 34 + sem) * t + 0.008 * Math.sin(v.x * 71 + sem * 2) * t;
    if (!plano && t < 0.08) v.z += 0.02 * (1 - t / 0.08); v.x *= 1 + 0.06 * t; });
  uvMetros(g, 'y'); g.translate(x, yTop - h / 2, z); A.add(mat, g, color);
}
function ropaClavos(A, op) {
  const q = A.q, M = 0x6e5a40, C = op.rustico ? [0x6a5a48, 0x7a3a2a, 0x8a7a60] : [0x4a5a7a, 0xb8a888, 0x8a3030];
  A.bloque('madera', 1.0, 0.08, 0.03, 0.006, 0, 1.72, 0.02, M, { seg: [3, 1, 1], veta: 'x', def: rustico(3, 0.002) });
  for (let i = 0; i < 4; i++) { const x = -0.36 + i * 0.24; A.tubo('fierroF', [V3(x, 1.72, 0.03), V3(x, 1.725, 0.1)], 0.005, 0x2e2c2a, { lados: 4 }); if (q) A.esfera('fierroF', 0.009, x, 1.725, 0.1, 0x2e2c2a, 0.5); }
  prenda(A, 'lana', -0.36, 1.74, 0.07, 0.34, 0.72, C[0], 1); prenda(A, 'lana', -0.36, 1.74, 0.105, 0.3, 0.6, C[0] - 0x0a0a0a, 2);   // manta doblada (dos capas)
  prenda(A, 'tela', 0.0 + 0.12, 1.74, 0.075, 0.3, 0.55, C[1], 3);
  prenda(A, 'lana', 0.36, 1.74, 0.07, 0.28, 0.66, C[2], 4); A.torno('lana', [[0, 0], [0.12, 0], [0.125, 0.008], [0.08, 0.012], [0.075, 0.07], [0.06, 0.1], [0, 0.105]], 0, 0, 0, 0x2e2a26, q ? 14 : 6, new THREE.Matrix4().makeRotationX(-1.2).setPosition(0.36, 1.66, 0.15));   // sombrero colgado
  return [1.0, 1.8, 0.2];
}
function ropaTendida(A, op) {
  const C = op.rustico ? [0xd8d0bc, 0x6a5a48, 0x8a7a60, 0xc8bca4] : [0xe8e4da, 0x4a6a9a, 0xb03a30, 0xf0ece0], y = 2.08;
  const pinza = x => { A.bloque('madera', 0.012, 0.07, 0.022, 0.003, x, y - 0.01, 0, 0xb89a6a, { seg: [1, 1, 1] }); };
  { const x = -0.55; prenda(A, 'tela', x, y + 0.01, 0, 0.42, 0.6, C[0], 5, true); for (const s of [-1, 1]) A.tubo('tela', curva(t => V3(x + s * (0.2 + 0.05 * t), y - 0.08 - 0.32 * t, 0.012 * Math.sin(PI * t)), A.q ? 6 : 2), 0.035, C[0], { lados: A.q ? 7 : 4, rFn: t => 1 - 0.3 * t }); pinza(x - 0.18); pinza(x + 0.18); }   // camisa
  { const x = -0.04; prenda(A, 'tela', x, y + 0.01, 0, 0.36, 0.48, C[1], 6); pinza(x - 0.15); pinza(x + 0.15); }   // paño
  for (const x of [0.25, 0.36]) { const g = bloque(0.08, 0.26, 0.02, 0.008, A.q ? [2, 4, 1] : [1, 1, 1], (v, w, h) => { if (v.y < -h / 2 + 0.06) v.z += 0.03 * (1 - (v.y + h / 2) / 0.06); }); uvMetros(g, 'y'); g.translate(x, y - 0.13, 0); A.add('lana', g, C[2]); pinza(x); }   // calcetines
  { const x = 0.62; prenda(A, 'tela', x, y + 0.01, 0, 0.36, 0.7, C[3], 7, true); pinza(x - 0.16); pinza(x + 0.16); }   // sábana chica
  return [1.6, 2.1, 0.1];
}
function escoba(A, op) {
  const q = A.q, M = 0x8a6a42, P = 0xc8a860;
  A.tubo('madera', [V3(0, 0.3, 0), V3(0, 1.42, 0)], 0.013, M, { lados: q ? 8 : 5 });
  const g = new THREE.CylinderGeometry(0.035, 0.16, 0.34, q ? 14 : 6, q ? 4 : 1); g.scale(1, 1, 0.28); const p = g.attributes.position;   // abanico de paja
  for (let k = 0; k < p.count; k++) { const yy = p.getY(k), t = (0.17 - yy) / 0.34; p.setX(k, p.getX(k) * (1 + 0.04 * Math.sin(k * 7.1))); p.setY(k, yy - (t > 0.98 ? 0.01 * Math.sin(k * 3.3) : 0)); }
  g.computeVertexNormals(); g.translate(0, 0.17, 0); uvMetros(g, 'y'); A.add('paja', g, P);
  for (const yy of [0.3, 0.24, 0.17]) { const r = 0.035 + (0.3 - yy) / 0.34 * 0.125; A.tubo('fierroF', curva(t => V3(Math.cos(2 * PI * t) * (r + 0.004), yy, Math.sin(2 * PI * t) * (r + 0.004) * 0.3), q ? 16 : 6).slice(0, -1), 0.0025, 0x3a3634, { lados: 3, cerrado: true }); }   // amarras
  return [0.34, 1.42, 0.12];
}

export const FABRICA_CASAS = { mesa_rustica: mesaRustica, banca_rustica: bancaRustica, farol_parafina: farol, candil, lavamanos_rustico: lavamanos, palangana_fina: palangana, repisa_pared: repisa, biombo_3hojas: biombo3, biombo_tablas: biomboTablas,
  herramientas_minero: herramientasMinero, cortina_lana: cortinaLana,
  ropa_clavos: ropaClavos, ropa_clavos_r: (A, op) => ropaClavos(A, { rustico: true, ...op }), ropa_tendida: ropaTendida, ropa_tendida_r: (A, op) => ropaTendida(A, { rustico: true, ...op }), escoba };
registrarFabrica(FABRICA_CASAS);
