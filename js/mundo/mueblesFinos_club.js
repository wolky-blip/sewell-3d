// C4 (finos C, 16-11-2026): muebles FINOS del Teniente Club (1925) hechos en código, en el estilo de mueblesFinos.js (sin GPU).
// Referencias: assets3d/referencias/sewell/emblematicos/club_interior/ (fotos y cuadros del video de Diego).
//   silla_salon   K08 silla de salón: patas delanteras torneadas, traseras curvadas, asiento y respaldo tapizados en terciopelo burdeo con tachas
//   mesa_pedestal K06 mesa redonda de pedestal: cubierta moldurada, columna torneada en jarrón, 4 patas curvas con regatón de bronce
//   banca_piscina K01 banca blanca de la piscina: costados de fierro fundido con volutas, tablillas de madera laqueada
//   perchero_pared K02 tabla blanca moldurada con 6 ganchos dobles cromados
//   escalerilla   K03 escalerilla de la piscina: pasamanos cromados doblados sobre el borde, peldaños antideslizantes (marco: muro en z 0, agua hacia +z, y 0 = cubierta)
//   arana_club / arana_chica  K09 arañas de bronce: columna torneada, brazos en S, arandelas y tulipas de vidrio ámbar (marco: y 0 = corona)
//   lampara_pantalla K09 colgante de la sala del espejo: pantalla ámbar acampanada y 5 brazos con pantallas chicas (y 0 = enganche)
//   globo_lampara K09 globo de vidrio opalino con galería de latón (y 0 = centro del globo; radio 0,3: se escala)
//   aplique_pared K15 aplique: platina oval, brazo curvo y pantalla ámbar (z 0 = muro, y 0 = centro de la platina)
//   botellas_barra K12 juego de botellas (vino, licor, ginebra) y copas sobre la barra (y 0 = cubierta)
//   atril          K11 atril de música de fierro: trípode, vara y bandeja calada
// Marco local de todo: frente hacia +z. Geometría y materiales compartidos (mueble(id) en caché) → el Colocador los instancia.
import * as THREE from 'three';
import { registrarFabrica, registrarMaterial, HERRAMIENTAS_FINAS } from './mueblesFinos.js';

const { doblar, densificar, curva, bloque, uvMetros } = HERRAMIENTAS_FINAS;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// ------------------------------------------------------------------ materiales propios (colores en los vértices)
registrarMaterial('laca', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.4, metalness: 0, emissive: 0x2a2826, emissiveIntensity: 0.6 }));
registrarMaterial('cromo', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.22, metalness: 0.6, emissive: 0x5a6066, emissiveIntensity: 0.6 }));
registrarMaterial('terciopelo', (b, T) => { const t = T('tela'), l = T('lana'); return new THREE.MeshStandardMaterial({ ...b, map: t, bumpMap: l, bumpScale: 0.5, roughness: 0.93, metalness: 0 }); }, 1 / 0.12);
registrarMaterial('tulipa', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.32, metalness: 0, emissive: 0xff9a30, emissiveIntensity: 0.55, side: THREE.DoubleSide }));
registrarMaterial('pantalla', (b, T) => new THREE.MeshStandardMaterial({ ...b, map: T('tela'), roughness: 0.75, emissive: 0xc86a1a, emissiveIntensity: 0.6, side: THREE.DoubleSide }), 1 / 0.2);
registrarMaterial('globo', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.28, emissive: 0xfff2dc, emissiveIntensity: 0.85 }));
registrarMaterial('foco', b => new THREE.MeshBasicMaterial({ ...b, toneMapped: false }));
registrarMaterial('vidrioColor', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.84 }));
registrarMaterial('cristal', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));

const BRONCE = 0xc39443, LATON = 0xd2ab5c;

// ------------------------------------------------------------------ SILLA DE SALÓN tapizada (K08; 96 en filas + las de las mesas)
function sillaSalon(A, op) {
  const M = op.madera ?? 0x2e1a0e, T = op.tapiz ?? 0x7c1a2a, q = A.q, ys = 0.47, xf = 0.2, zf = 0.19, zb = -0.19, yR = 0.95, dz = -0.08;
  // patas delanteras torneadas (anillo bajo el asiento, caña y pie)
  for (const s of [-1, 1]) A.torno('madera', [[0, 0], [0.014, 0], [0.017, 0.015], [0.013, 0.05], [0.015, 0.16], [0.02, 0.26], [0.023, 0.3], [0.017, 0.33], [0.024, 0.355], [0.024, ys - 0.05], [0, ys - 0.05]], s * xf, 0, zf, M, q ? 10 : 5);
  // patas traseras que siguen como parantes del respaldo, inclinadas hacia atrás
  const zr = y => zb + Math.max(0, y - ys) / (yR - ys) * dz;
  for (const s of [-1, 1]) {
    const p = doblar([V3(s * xf, 0, zb - 0.045), V3(s * xf, ys - 0.03, zb), V3(s * 0.185, yR, zb + dz)], 0.14, q ? 6 : 2);
    A.tubo('madera', densificar(p, 0.08), 0.017, M, { lados: 4, plano: true, rFn: t => t < 0.45 ? 0.82 + 0.18 * t / 0.45 : 1 - 0.15 * (t - 0.45), normal: V3(1, 0, 0) });
    if (q) A.torno('madera', [[0, 0], [0.02, 0], [0.022, 0.012], [0.012, 0.03], [0, 0.034]], s * 0.185, yR - 0.002, zb + dz, M, 8);   // remate torneado
  }
  // asiento tapizado: cojín abombado sobre el bastidor, con tachas de bronce en el canto
  A.bloque('madera', 2 * xf + 0.03, 0.06, zf - zb + 0.04, 0.01, 0, ys - 0.03, 0, M, { seg: [3, 1, 3], veta: 'x' });
  A.bloque('terciopelo', 2 * xf + 0.05, 0.075, zf - zb + 0.06, 0.03, 0, ys + 0.035, 0.005, T, { seg: [6, 2, 6], veta: 'x', def: (v, w, h, d) => { if (v.y > 0) v.y += 0.014 * (1 - Math.pow(2 * v.x / w, 4)) * (1 - Math.pow(2 * v.z / d, 4)); } });
  if (q) A.tubo('bronce', [V3(-0.232, ys + 0.014, zf + 0.041), V3(0.232, ys + 0.014, zf + 0.041)], 0.0045, BRONCE, { lados: 4 });   // galón de bronce del canto (antes 11 tachas esféricas: 3 mil triángulos por silla ×96)
  // respaldo: travesaño alto curvo, panel tapizado acolchado y travesaño bajo
  const trav = (y, alto, grueso) => { const pts = curva(t => { const x = -0.185 + 0.37 * t; return V3(x, y, zr(y) - 0.018 * (1 - Math.pow(x / 0.185, 2))); }, q ? 12 : 4); A.tubo('madera', pts, grueso / 2, M, { lados: 4, plano: true, esc: [alto / grueso, 1], normal: V3(0, 1, 0), ang0: PI / 4 }); };
  trav(yR - 0.035, 0.06, 0.026); trav(0.6, 0.03, 0.022);
  { const yc = 0.76, g = bloque(0.33, 0.25, 0.05, 0.022, q ? [6, 5, 2] : [2, 2, 1], (v, w, h, d) => { if (v.z > 0) v.z += 0.012 * (1 - Math.pow(2 * v.x / w, 4)) * (1 - Math.pow(2 * v.y / h, 4)); });
    uvMetros(g, 'y'); g.rotateX(Math.atan2(-dz, yR - ys) * -1); g.translate(0, yc, zr(yc) - 0.012); A.add('terciopelo', g, T); }
  // faldones y travesaños en H entre las patas
  for (const s of [-1, 1]) A.tubo('madera', [V3(s * xf, 0.16, zf), V3(s * xf, 0.16, zb - 0.02)], 0.009, M, { lados: q ? 6 : 4 });
  A.tubo('madera', [V3(-xf, 0.2, 0), V3(xf, 0.2, 0)], 0.009, M, { lados: q ? 6 : 4 });
  return [0.47, 0.98, 0.52];
}

// ------------------------------------------------------------------ MESA REDONDA DE PEDESTAL (K06; Ø 1 m, alto 0,76)
function mesaPedestal(A, op) {
  const M = op.madera ?? 0x3b2111, q = A.q, R = 0.5, H = 0.76;
  A.torno('madera', [[0, H - 0.032], [R - 0.03, H - 0.032], [R - 0.004, H - 0.028], [R + 0.004, H - 0.018], [R + 0.002, H - 0.008], [R - 0.008, H - 0.001], [R - 0.02, H], [0, H]], 0, 0, 0, M, q ? 44 : 14);   // cubierta con canto de media caña
  A.torno('madera', [[R - 0.08, H - 0.1], [R - 0.06, H - 0.1], [R - 0.055, H - 0.09], [R - 0.06, H - 0.04], [R - 0.06, H - 0.032], [R - 0.08, H - 0.032], [R - 0.08, H - 0.1]], 0, 0, 0, M, q ? 36 : 12);   // faldón
  A.torno('madera', [[0, 0.11], [0.075, 0.11], [0.08, 0.13], [0.06, 0.16], [0.05, 0.2], [0.07, 0.26], [0.088, 0.32], [0.084, 0.37], [0.06, 0.43], [0.042, 0.5], [0.05, 0.53], [0.038, 0.56], [0.036, H - 0.15], [0.05, H - 0.13], [0.07, H - 0.1], [0.07, H - 0.034], [0, H - 0.034]], 0, 0, 0, M, q ? 16 : 7);   // columna en jarrón
  for (let i = 0; i < 4; i++) {   // patas cabriolé
    const a = PI / 4 + i * PI / 2, d = (r, y) => V3(Math.cos(a) * r, y, Math.sin(a) * r);
    A.tubo('madera', curva(t => d(0.055 + 0.33 * t, 0.17 * Math.pow(1 - t, 1.5) + 0.035 * Math.sin(PI * t) + 0.022), q ? 12 : 5), 0.024, M, { lados: q ? 8 : 5, esc: [1, 1.5], normal: V3(0, 1, 0), rFn: t => 1 - 0.45 * t });
    A.torno('bronce', [[0, 0], [0.02, 0], [0.022, 0.012], [0.016, 0.026], [0, 0.03]], Math.cos(a) * 0.385, 0, Math.sin(a) * 0.385, BRONCE, q ? 10 : 5);
  }
  return [1.0, 0.76, 1.0];
}

// ------------------------------------------------------------------ BANCA BLANCA DE LA PISCINA (K01; 2,2 m)
function bancaPiscina(A, op) {
  const C = op.color ?? 0xf1efe8, F = op.fierro ?? 0xe9e7df, q = A.q, Lx = 2.2;
  const s = new THREE.Shape();   // costado de fierro fundido (z hacia el frente, y arriba)
  s.moveTo(-0.27, 0); s.lineTo(-0.19, 0); s.quadraticCurveTo(-0.14, 0.2, -0.04, 0.24); s.lineTo(0.07, 0.24); s.quadraticCurveTo(0.17, 0.2, 0.2, 0); s.lineTo(0.27, 0);
  s.lineTo(0.26, 0.05); s.quadraticCurveTo(0.21, 0.25, 0.22, 0.41); s.quadraticCurveTo(0.27, 0.52, 0.255, 0.6);
  s.absarc(0.225, 0.61, 0.032, -0.3, PI * 1.15, false); s.quadraticCurveTo(0.16, 0.5, 0.02, 0.45); s.lineTo(-0.17, 0.45);
  s.quadraticCurveTo(-0.22, 0.62, -0.28, 0.84); s.absarc(-0.305, 0.855, 0.028, -0.4, PI * 1.05, false); s.quadraticCurveTo(-0.3, 0.6, -0.26, 0.42); s.quadraticCurveTo(-0.24, 0.2, -0.27, 0);
  const hueco = new THREE.Path(); hueco.moveTo(0.05, 0.3); hueco.quadraticCurveTo(0.14, 0.3, 0.17, 0.38); hueco.quadraticCurveTo(0.1, 0.4, 0.05, 0.36); hueco.closePath(); if (q) s.holes.push(hueco);   // calado del costado
  for (const x of [-(Lx / 2 - 0.12), 0, Lx / 2 - 0.12]) {
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: q ? 2 : 1, curveSegments: q ? 10 : 3 });
    g.translate(0, 0, -0.0175); uvMetros(g, 'y'); g.rotateY(-PI / 2); g.translate(x, 0, 0); A.add('laca', g, F);
    if (q) for (const z of [-0.23, 0.235]) A.torno('laca', [[0, 0], [0.03, 0], [0.032, 0.012], [0.02, 0.02], [0, 0.02]], x, 0, z, F, 10);   // patines
  }
  const L = Lx;
  for (let i = 0; i < 4; i++) { const z = 0.18 - i * 0.105; A.bloque('laca', L, 0.028, 0.088, 0.01, 0, 0.465, z, C, { seg: [8, 1, 2], veta: 'x' }); }   // tablillas del asiento
  for (let i = 0; i < 3; i++) { const t = (i + 0.5) / 3, y = 0.53 + t * 0.29, z = -0.2 - t * 0.08; A.bloque('laca', L, 0.075, 0.024, 0.009, 0, y, z, C, { seg: [8, 2, 1], veta: 'x', rx: -0.27 }); }   // tablillas del respaldo
  A.bloque('laca', L - 0.1, 0.05, 0.03, 0.008, 0, 0.2, -0.02, F, { veta: 'x' });   // travesaño bajo
  if (q) for (const x of [-(Lx / 2 - 0.12), 0, Lx / 2 - 0.12]) for (let i = 0; i < 4; i++) A.torno('cromo', [[0, 0], [0.008, 0], [0.006, 0.004], [0, 0.005]], x, 0.479, 0.18 - i * 0.105, 0xb9bec2, 6);   // pernos
  return [2.2, 0.88, 0.58];
}

// ------------------------------------------------------------------ PERCHERO DE PARED (K02; tabla 2,1 m con 6 ganchos dobles)
function percheroPared(A, op) {
  const C = op.color ?? 0xf3f1ea, Cr = 0xc9cfd3, q = A.q, W = 2.1;
  A.bloque('laca', W, 0.16, 0.026, 0.008, 0, 0, 0.013, C, { seg: [6, 2, 1], veta: 'x' });
  A.tubo('laca', [V3(-W / 2, 0.085, 0.022), V3(W / 2, 0.085, 0.022)], 0.012, C, { lados: q ? 8 : 4 });   // moldura alta (media caña)
  A.tubo('laca', [V3(-W / 2, -0.085, 0.02), V3(W / 2, -0.085, 0.02)], 0.009, C, { lados: q ? 8 : 4 });
  for (let k = 0; k < 6; k++) {
    const x = -0.8 + k * 0.32;
    A.torno('cromo', [[0, 0], [0.026, 0], [0.026, 0.004], [0.016, 0.01], [0, 0.012]], x, 0, 0.026, Cr, q ? 12 : 6, new THREE.Matrix4().makeRotationX(PI / 2));   // roseta
    const alto = doblar([V3(x, 0.01, 0.03), V3(x, 0.01, 0.1), V3(x, 0.07, 0.12), V3(x, 0.1, 0.11)], 0.035, q ? 6 : 2);
    A.tubo('cromo', densificar(alto, 0.02), 0.0055, Cr, { lados: q ? 8 : 4 }); if (q) A.esfera('cromo', 0.009, x, 0.1, 0.11, Cr);
    const bajo = doblar([V3(x, -0.005, 0.03), V3(x, -0.005, 0.07), V3(x, -0.04, 0.085), V3(x, -0.03, 0.06)], 0.025, q ? 5 : 2);
    A.tubo('cromo', densificar(bajo, 0.02), 0.005, Cr, { lados: q ? 8 : 4 }); if (q) A.esfera('cromo', 0.008, x, -0.03, 0.06, Cr);
  }
  return [2.1, 0.2, 0.14];
}

// ------------------------------------------------------------------ ESCALERILLA DE LA PISCINA (K03; muro en z 0, agua hacia +z, y 0 = cubierta)
function escalerilla(A, op) {
  const Cr = 0xd3d8dc, q = A.q, yFondo = op.fondo ?? -1.24;
  for (const x of [-0.3, 0.3]) {
    const p = doblar([V3(x, 0, -0.85), V3(x, 1.1, -0.85), V3(x, 1.1, 0.14), V3(x, yFondo, 0.14)], 0.3, q ? 10 : 3);
    A.tubo('cromo', densificar(p, 0.06), 0.022, Cr, { lados: q ? 10 : 5 });
    A.torno('cromo', [[0, 0], [0.05, 0], [0.05, 0.006], [0.03, 0.016], [0.024, 0.03], [0, 0.03]], x, 0, -0.85, Cr, q ? 14 : 6);   // anclaje en la cubierta
    A.torno('cromo', [[0, 0], [0.03, 0], [0.03, 0.02], [0, 0.02]], x, yFondo - 0.005, 0.14, Cr, 8);
    for (const y of [0.18, -0.75]) { A.tubo('cromo', [V3(x, y, 0.14), V3(x, y, 0.005)], 0.011, Cr, { lados: q ? 8 : 4 }); A.torno('cromo', [[0, 0], [0.026, 0], [0.026, 0.006], [0, 0.008]], x, y, 0.0, Cr, 10, new THREE.Matrix4().makeRotationX(PI / 2)); }   // separadores al muro
  }
  for (let k = 0; k < 4; k++) {   // peldaños de acero con estrías antideslizantes
    const y = -0.34 - k * 0.27;
    A.bloque('cromo', 0.58, 0.022, 0.11, 0.006, 0, y, 0.12, Cr, { seg: [4, 1, 2], veta: 'x' });
    if (q) for (let j = 0; j < 4; j++) A.bloque('oscuro', 0.5, 0.004, 0.008, 0.001, 0, y + 0.012, 0.08 + j * 0.026, 0x55606a, { seg: [1, 1, 1] });
  }
  return [0.7, 1.15, 1.0];
}

// ------------------------------------------------------------------ ARAÑA DE BRONCE con tulipas ámbar (K09; y 0 = corona)
function arana(A, op) {
  const n = op.n ?? 10, rr = op.r ?? 0.8, pisos = op.pisos ?? 2, q = A.q, B = BRONCE;
  A.torno('bronce', [[0, -0.62], [0.025, -0.6], [0.05, -0.56], [0.03, -0.5], [0.06, -0.44], [0.075, -0.36], [0.06, -0.28], [0.035, -0.22], [0.05, -0.17], [0.11, -0.1], [0.13, -0.03], [0.12, 0.03], [0.07, 0.07], [0.03, 0.1],
    [0.03, pisos > 1 ? 0.28 : 0.2], [0.06, pisos > 1 ? 0.31 : 0.23], [0.03, pisos > 1 ? 0.36 : 0.27], [0.022, pisos > 1 ? 0.5 : 0.36], [0.03, pisos > 1 ? 0.52 : 0.38], [0, pisos > 1 ? 0.52 : 0.38]], 0, 0, 0, B, q ? 16 : 8);   // columna torneada con jarrón y bellota
  for (let p = 0; p < pisos; p++) {
    const R = rr * (1 - p * 0.35), yy = p * 0.32, m = n - p * 3;
    A.tubo('bronce', curva(t => V3(Math.cos(2 * PI * t) * R * 0.52, yy - 0.08, Math.sin(2 * PI * t) * R * 0.52), q ? 36 : 12), 0.012, B, { lados: q ? 6 : 4, cerrado: true });   // aro
    for (let i = 0; i < m; i++) {
      const a = (i + p * 0.5) / m * 2 * PI, c = Math.cos(a), s = Math.sin(a), d = (r, y) => V3(c * r, yy + y, s * r);
      A.tubo('bronce', curva(t => d(0.1 + (R - 0.1) * t, -0.3 * Math.sin(PI * Math.min(1, t * 1.15)) * (1 - t * 0.3) + 0.03 * t), q ? 14 : 5), 0.013, B, { lados: q ? 7 : 4, rFn: t => 1 - 0.3 * t });   // brazo en S
      if (q) A.tubo('bronce', curva(t => { const an = PI * 1.6 * t; return d(0.18 + R * 0.25 + 0.05 * Math.sin(an), -0.24 - 0.05 * Math.cos(an) + 0.05); }, 8), 0.007, B, { lados: 4 });   // voluta bajo el brazo
      const x = c * R, z = s * R;
      A.torno('bronce', [[0, 0], [0.018, 0], [0.04, 0.02], [0.045, 0.035], [0.03, 0.04], [0.02, 0.06], [0, 0.06]], x, yy + 0.02, z, B, q ? 12 : 6);   // arandela
      A.torno('tulipa', [[0.022, 0.07], [0.04, 0.09], [0.066, 0.14], [0.084, 0.2], [0.09, 0.235], [0.096, 0.25]], x, yy + 0.02, z, 0xffc070, q ? 14 : 7);   // tulipa abierta hacia arriba
      A.torno('foco', [[0, 0.08], [0.022, 0.09], [0.03, 0.12], [0.02, 0.15], [0, 0.155]], x, yy + 0.02, z, 0xfff0c8, q ? 8 : 5);
    }
  }
  return [2 * rr + 0.2, 1.2, 2 * rr + 0.2];
}

// ------------------------------------------------------------------ COLGANTE DE PANTALLA ÁMBAR (K09, sala del espejo; y 0 = enganche)
function lamparaPantalla(A, op) {
  const q = A.q, B = LATON, P = 0xe8a050;
  A.torno('bronce', [[0, -0.33], [0.03, -0.32], [0.035, -0.28], [0.018, -0.24], [0.016, -0.06], [0.04, -0.03], [0.045, 0.02], [0.012, 0.04], [0, 0.04]], 0, 0, 0, B, q ? 14 : 6);
  A.torno('pantalla', [[0.19, 0.03], [0.24, -0.02], [0.33, -0.12], [0.4, -0.22], [0.43, -0.28], [0.44, -0.3]], 0, 0, 0, P, q ? 32 : 12);   // campana
  if (q) A.torno('pantalla', [[0.44, -0.3], [0.445, -0.34], [0.44, -0.345]], 0, 0, 0, 0xb05a20, 32);   // fleco
  A.torno('bronce', [[0.185, 0.035], [0.2, 0.025], [0.2, 0.04], [0.185, 0.045]], 0, 0, 0, B, q ? 24 : 10);
  A.torno('foco', [[0, -0.16], [0.04, -0.17], [0.05, -0.21], [0.035, -0.25], [0, -0.26]], 0, 0, 0, 0xfff0c8, 8);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 2 * PI, c = Math.cos(a), s = Math.sin(a), d = (r, y) => V3(c * r, y, s * r);
    A.tubo('bronce', curva(t => d(0.03 + 0.59 * t, -0.27 - 0.06 * Math.sin(PI * t) + 0.04 * t), q ? 10 : 4), 0.01, B, { lados: q ? 6 : 4 });
    A.torno('bronce', [[0, 0], [0.025, 0], [0.03, 0.02], [0, 0.03]], c * 0.62, -0.24, s * 0.62, B, 8);
    A.torno('pantalla', [[0.065, -0.17], [0.08, -0.2], [0.11, -0.27], [0.12, -0.3]], c * 0.62, 0, s * 0.62, P, q ? 16 : 7);
  }
  return [1.5, 0.4, 1.5];
}

// ------------------------------------------------------------------ GLOBO OPALINO con galería (K09; y 0 = centro, radio 0,3)
function globoLampara(A, op) {
  const q = A.q, r = 0.3, B = LATON;
  const perfil = []; for (let i = 0; i <= (q ? 16 : 7); i++) { const t = i / (q ? 16 : 7), an = -PI / 2 + t * PI * 0.86; perfil.push([r * Math.cos(an), r * Math.sin(an)]); }
  perfil.push([r * 0.42, r * 0.98], [r * 0.4, r * 1.04], [0, r * 1.04]); perfil.unshift([0, -r]);
  A.torno('globo', perfil, 0, 0, 0, 0xffffff, q ? 24 : 10);
  A.torno('bronce', [[r * 0.36, r * 0.94], [r * 0.5, r * 0.98], [r * 0.5, r * 1.12], [r * 0.4, r * 1.16], [r * 0.25, r * 1.22], [r * 0.12, r * 1.3], [0, r * 1.32]], 0, 0, 0, B, q ? 18 : 8);   // galería
  if (q) for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI; A.bloque('bronce', 0.012, r * 0.18, 0.006, 0.002, Math.cos(a) * r * 0.51, r * 1.04, Math.sin(a) * r * 0.51, B, { ry: -a, seg: [1, 1, 1] }); }
  A.torno('bronce', [[0, -r - 0.03], [0.02, -r - 0.025], [0.025, -r - 0.005], [0, -r + 0.004]], 0, 0, 0, B, 8);   // botón de abajo
  return [2 * r, 2.4 * r, 2 * r];
}

// ------------------------------------------------------------------ APLIQUE DE PARED (K15; z 0 = muro, y 0 = centro de la platina)
function aplique(A, op) {
  const q = A.q, B = LATON;
  A.torno('bronce', [[0, 0], [0.06, 0], [0.065, 0.006], [0.05, 0.016], [0.03, 0.022], [0, 0.024]], 0, 0, 0, B, q ? 16 : 8, new THREE.Matrix4().makeRotationX(PI / 2).premultiply(new THREE.Matrix4().makeScale(1, 1.45, 1)));
  const p = doblar([V3(0, -0.02, 0.02), V3(0, -0.04, 0.14), V3(0, 0.09, 0.17)], 0.06, q ? 8 : 3);
  A.tubo('bronce', densificar(p, 0.02), 0.011, B, { lados: q ? 8 : 4 });
  if (q) A.tubo('bronce', curva(t => { const an = PI * 1.5 * t; return V3(0, -0.07 - 0.03 * Math.sin(an), 0.03 + 0.05 * t + 0.02 * Math.cos(an)); }, 8), 0.006, B, { lados: 4 });   // voluta
  A.torno('bronce', [[0, 0.08], [0.02, 0.08], [0.032, 0.095], [0.022, 0.11], [0, 0.11]], 0, 0, 0.17, B, q ? 10 : 6);
  A.torno('pantalla', [[0.065, 0.24], [0.08, 0.2], [0.12, 0.12], [0.135, 0.095]], 0, 0, 0.17, 0xe8a050, q ? 16 : 8);
  A.torno('foco', [[0, 0.1], [0.025, 0.115], [0.03, 0.15], [0, 0.17]], 0, 0, 0.17, 0xfff0c8, 6);
  return [0.28, 0.35, 0.32];
}

// ------------------------------------------------------------------ BOTELLAS Y COPAS sobre la barra (K12; y 0 = cubierta)
function botellas(A, op) {
  const q = A.q, sg = q ? 14 : 6;
  const botella = (x, z, h, r, col, cuello = 0.3) => {
    const hc = h * cuello, hb = h - hc;
    A.torno('vidrioColor', [[0, 0.002], [r * 0.85, 0], [r, 0.01], [r, hb * 0.82], [r * 0.9, hb * 0.95], [r * 0.45, hb + hc * 0.15], [r * 0.32, hb + hc * 0.3], [r * 0.3, h - 0.02], [r * 0.36, h - 0.012], [r * 0.34, h], [0, h]], x, 0, z, col, sg);
    A.torno('loza', [[r * 1.012, hb * 0.28], [r * 1.012, hb * 0.66]], x, 0, z, 0xe9dfc4, sg);   // etiqueta
    A.torno('madera', [[0, h], [r * 0.3, h], [r * 0.32, h + 0.018], [0, h + 0.02]], x, 0, z, 0x8a6a40, 6);   // corcho
  };
  botella(-0.24, -0.02, 0.3, 0.036, 0x1f4a2a); botella(-0.14, 0.03, 0.26, 0.042, 0x8a4a14, 0.22); botella(-0.04, -0.03, 0.29, 0.034, 0x2f5a3a);
  A.torno('vidrioColor', [[0, 0.002], [0.05, 0], [0.055, 0.04], [0.06, 0.12], [0.05, 0.17], [0.025, 0.2], [0.02, 0.24], [0, 0.24]], 0.07, 0, 0.0, 0xcfd9d2, sg);   // licorera
  A.torno('cristal', [[0, 0.248], [0.024, 0.24], [0.028, 0.27], [0, 0.28]], 0.07, 0, 0.0, 0xe4ece8, 8);   // tapón
  for (const [x, z] of [[0.18, 0.05], [0.26, -0.03]]) {   // copas
    A.torno('cristal', [[0, 0], [0.035, 0], [0.036, 0.004], [0.006, 0.008], [0.004, 0.08], [0.012, 0.09], [0.03, 0.11], [0.038, 0.14], [0.036, 0.17]], x, 0, z, 0xf0f4f2, sg);
    A.torno('vidrioColor', [[0, 0.092], [0.016, 0.096], [0.028, 0.11], [0.03, 0.12], [0, 0.12]], x, 0, z, 0x7a1418, sg);   // vino servido
  }
  return [0.62, 0.32, 0.2];
}

// ------------------------------------------------------------------ ATRIL DE MÚSICA (K11; fierro negro)
function atril(A, op) {
  const N = 0x1e1d1c, q = A.q, H = 1.08;
  for (let i = 0; i < 3; i++) { const a = PI / 2 + i * 2 * PI / 3, d = (r, y) => V3(Math.cos(a) * r, y, Math.sin(a) * r);
    A.tubo('pintura', curva(t => d(0.02 + 0.28 * t, 0.32 * (1 - t) + 0.02 * Math.sin(PI * t) + 0.008), q ? 8 : 3), 0.009, N, { lados: q ? 6 : 4 }); A.esfera('oscuro', 0.012, Math.cos(a) * 0.3, 0.01, Math.sin(a) * 0.3, 0x111111, 0.7); }
  A.tubo('pintura', [V3(0, 0.3, 0), V3(0, H, 0)], 0.011, N, { lados: q ? 8 : 4 });
  A.torno('pintura', [[0.014, 0.55], [0.02, 0.56], [0.02, 0.6], [0.014, 0.61]], 0, 0, 0, N, 8);   // collar de la vara
  const inc = 0.42, base = new THREE.Matrix4().makeRotationX(-inc).setPosition(0, H, 0);
  const placa = new THREE.Shape(); placa.moveTo(-0.25, 0); placa.lineTo(0.25, 0); placa.lineTo(0.25, 0.32); placa.quadraticCurveTo(0, 0.37, -0.25, 0.32); placa.lineTo(-0.25, 0);
  if (q) for (let i = 0; i < 4; i++) { const h = new THREE.Path(), x = -0.18 + i * 0.12; h.moveTo(x - 0.03, 0.06); h.lineTo(x + 0.03, 0.06); h.lineTo(x + 0.03, 0.26); h.lineTo(x - 0.03, 0.26); h.closePath(); placa.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(placa, { depth: 0.004, bevelEnabled: false, curveSegments: q ? 8 : 3 }); uvMetros(g, 'y'); g.applyMatrix4(base); A.add('pintura', g, N);
  const lab = new THREE.BoxGeometry(0.5, 0.025, 0.04); lab.translate(0, 0.0, 0.02); lab.applyMatrix4(base); A.add('pintura', uvMetros(lab, 'x'), N);   // labio de la bandeja
  { const par = new THREE.BoxGeometry(0.44, 0.3, 0.003); par.translate(0, 0.17, 0.008); par.applyMatrix4(base); A.add('loza', uvMetros(par, 'y'), 0xeee6cf); }   // partitura
  return [0.62, 1.32, 0.62];
}

export const FABRICA_CLUB = {
  silla_salon: sillaSalon, mesa_pedestal: mesaPedestal, banca_piscina: bancaPiscina, perchero_pared: percheroPared, escalerilla,
  arana_club: (A, op) => arana(A, op), arana_chica: (A, op) => arana(A, { n: 6, r: 0.45, pisos: 1, ...op }),
  lampara_pantalla: lamparaPantalla, globo_lampara: globoLampara, aplique_pared: aplique, botellas_barra: botellas, atril,
};
registrarFabrica(FABRICA_CLUB);
