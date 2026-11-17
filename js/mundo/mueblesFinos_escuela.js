// C3 (finos C, 16-11-2026): muebles FINOS de la Escuela Industrial y del museo, en código (estilo mueblesFinos.js, sin GPU).
//   pupitre_doble / pupitre_doble_b  E01 pupitre doble de madera con costados de fierro fundido (patín, pie del pupitre en S, pie del banco,
//                    voluta), tapa inclinada con canto moldurado, listón con 2 tinteros de vidrio y tapa de bronce, repisa, asiento y respaldo
//                    de listones; la «b» sin cuaderno. MISMO marco local que el pupitre de cajas de kitEscuela.js (tapa en z −0,05, asiento
//                    en +0,3, respaldo en +0,5; se monta con giro π).
//   poste_cordon     U02 poste de vallado del museo: base pesada torneada, caña cromada, remate de bola y argolla para el cordón.
import * as THREE from 'three';
import { registrarFabrica, registrarMaterial, fabricaFina, HERRAMIENTAS_FINAS } from './mueblesFinos.js';

const { curva, uvMetros, bloque, densificar, doblar } = HERRAMIENTAS_FINAS;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI;
registrarMaterial('cromo', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.22, metalness: 0.6, emissive: 0x5a6066, emissiveIntensity: 0.6 }));
registrarMaterial('fierro', (b, T) => { const t = T('pintura'); return new THREE.MeshStandardMaterial({ ...b, map: t, bumpMap: t, bumpScale: 0.9, roughness: 0.5, metalness: 0.55 }); }, 1 / 0.25);   // C3b: fierro fundido / forjado
registrarMaterial('acero', (b, T) => { const t = T('bronce'); return new THREE.MeshStandardMaterial({ ...b, map: t, roughness: 0.28, metalness: 0.75, emissive: 0x2a2c2e, emissiveIntensity: 0.55 }); }, 1 / 0.06);   // C3b: acero mecanizado
registrarMaterial('mineral', (b, T) => { const t = T('pintura'); return new THREE.MeshStandardMaterial({ ...b, map: t, bumpMap: t, bumpScale: 2.5, roughness: 0.55, metalness: 0.35, flatShading: true }); }, 1 / 0.05);
registrarMaterial('fieltro', (b, T) => { const t = T('lana'); return new THREE.MeshStandardMaterial({ ...b, map: t, bumpMap: t, bumpScale: 0.6, roughness: 1 }); }, 1 / 0.15);
registrarMaterial('laca', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.4, metalness: 0, emissive: 0x2a2826, emissiveIntensity: 0.6 }));
registrarMaterial('foco', b => new THREE.MeshBasicMaterial({ ...b, toneMapped: false }));
registrarMaterial('cristal', b => new THREE.MeshStandardMaterial({ ...b, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));

function pupitre(A, op) {
  const q = A.q, M = op.madera ?? 0x8a5a30, Mo = 0x5a3a1e, F = 0x262626, w = 1.15, lados = q ? 6 : 4;
  const barra = (pts, r = 0.016, e = [2.2, 0.7]) => A.tubo('pintura', pts, r, F, { lados: 4, plano: true, esc: e, normal: V3(1, 0, 0) });
  for (const s of [-1, 1]) {   // costado de fierro fundido
    const x = s * (w / 2 - 0.03), X = (y, z) => V3(x, y, z);
    barra([X(0.025, -0.33), X(0.025, 0.57)], 0.014, [1, 2.2]);   // patín
    for (const z of [-0.31, 0.55]) A.bloque('pintura', 0.05, 0.03, 0.05, 0.01, x, 0.015, z, F, { seg: [1, 1, 1] });   // tacos
    barra(curva(t => X(0.04 + 0.68 * t, -0.08 - 0.07 * Math.sin(PI * t * 1.2) + 0.03 * t), q ? 10 : 4));   // pie del pupitre en S
    barra([X(0.7, -0.27), X(0.7, 0.16)], 0.013);   // apoyo de la tapa
    barra(curva(t => X(0.04 + 0.37 * t, 0.36 + 0.04 * Math.sin(PI * t)), q ? 6 : 3));   // pie del banco
    barra([X(0.41, 0.2), X(0.41, 0.46)], 0.012);   // apoyo del asiento
    barra(curva(t => X(0.4 + 0.47 * t, 0.46 + 0.05 * t + 0.015 * Math.sin(PI * t)), q ? 6 : 3), 0.013);   // parante del respaldo
    if (q) A.tubo('pintura', curva(t => { const a = 2 * PI * t * 0.85; return X(0.24 + 0.06 * Math.sin(a), 0.12 + 0.06 * Math.cos(a) * (1 - t * 0.4)); }, 14), 0.008, F, { lados: 4, normal: V3(1, 0, 0) });   // voluta
    barra([X(0.2, -0.1), X(0.38, 0.12)], 0.01);   // tirante
  }
  A.bloque('madera', w, 0.03, 0.42, 0.008, 0, 0.74, -0.05, M, { seg: [4, 1, 2], veta: 'x', rx: 0.18 });   // tapa inclinada
  if (q) A.bloque('madera', w + 0.01, 0.012, 0.02, 0.004, 0, 0.705, 0.155, Mo, { seg: [2, 1, 1], veta: 'x', rx: 0.18 });   // canto del frente
  A.bloque('madera', w, 0.03, 0.1, 0.006, 0, 0.765, -0.29, M, { veta: 'x' });   // listón de los tinteros
  for (const dx of [-0.28, 0.28]) {
    A.torno('cristal', [[0.012, 0.75], [0.022, 0.752], [0.024, 0.78], [0.016, 0.785]], dx, 0, -0.29, 0xe6eee8, q ? 10 : 6);
    A.torno('oscuro', [[0, 0.752], [0.018, 0.752], [0.018, 0.772], [0, 0.772]], dx, 0, -0.29, 0x141824, 8);   // tinta
    A.torno('bronce', [[0, 0.781], [0.026, 0.781], [0.027, 0.786], [0.012, 0.79], [0, 0.791]], dx, 0, -0.29, 0xb08d3c, q ? 10 : 6);
  }
  A.bloque('madera', w - 0.06, 0.018, 0.36, 0.004, 0, 0.55, -0.05, Mo, { veta: 'x' });   // repisa de los libros
  for (let k = 0; k < 3; k++) A.bloque('madera', w, 0.028, 0.085, 0.008, 0, 0.42 + 0.004 * k, 0.25 + k * 0.1, M, { veta: 'x' });   // asiento de listones
  for (const y of [0.66, 0.8]) A.bloque('madera', w, 0.08, 0.024, 0.008, 0, y, 0.5 - (y - 0.6) * 0.12 + 0.03, M, { veta: 'x', rx: -0.12 });   // respaldo
  if (op.cuaderno !== false) {
    A.bloque('loza', 0.22, 0.012, 0.3, 0.003, -0.25, 0.768, -0.02, 0xece6d4, { rx: 0.18, ry: 0.1 });   // cuaderno abierto
    A.bloque('loza', 0.004, 0.013, 0.29, 0.001, -0.25, 0.772, -0.02, 0x8a7a60, { rx: 0.18, ry: 0.1 });
    A.tubo('madera', [V3(0.05, 0.778, -0.08), V3(0.2, 0.775, 0.0)], 0.004, 0xc89a40, { lados: 5 });   // lápiz
  }
  return [w, 0.9, 0.95];
}

function posteCordon(A, op) {
  const q = A.q, C = 0xc8ccd0;
  A.torno('cromo', [[0, 0], [0.17, 0], [0.18, 0.008], [0.17, 0.022], [0.12, 0.034], [0.05, 0.05], [0.032, 0.07], [0.028, 0.09], [0, 0.09]], 0, 0, 0, C, q ? 24 : 10);
  A.tubo('cromo', [V3(0, 0.08, 0), V3(0, 0.93, 0)], 0.024, C, { lados: q ? 12 : 6 });
  A.torno('cromo', [[0, 0.9], [0.03, 0.9], [0.034, 0.915], [0.028, 0.93], [0.035, 0.95], [0.045, 0.98], [0.035, 1.01], [0, 1.02]], 0, 0, 0, C, q ? 16 : 8);   // remate
  for (const a of [0, PI]) A.tubo('cromo', curva(t => V3(Math.cos(a) * (0.03 + 0.018 * (1 - Math.cos(PI * t))), 0.86 + 0.018 * Math.sin(PI * t * 2) * 0, Math.sin(a) * 0.0 + 0.018 * Math.sin(PI * t)), q ? 8 : 4), 0.0035, C, { lados: 4 });   // argollas
  return [0.36, 1.02, 0.36];
}


// ================================================================== C3b (finos C, relevo 16-11): resto de la escuela y del museo
//   banca_larga / banca_larga_2  E07 banca de 3 listones con caballetes de tabla recortada y larguero acuñado (2,4 m hall; 2,0 m pasillo)
//   percha_cotonas   E07 tabla moldurada con 5 ganchos dobles de bronce y 4 cotonas colgadas (2,4 m; se monta contra el muro)
//   perchero_cotona  E07 perchero de pie (FINO «perchero») con una cotona y una gorra
//   vitrina_piezas   E08 vitrina de los trabajos de los alumnos: mueble bajo de puertas con tableros, caja de vidrio con montantes,
//                    repisa de vidrio, 4 engranajes dentados en atriles, 5 llaves de boca y un eje escalonado
//   banco_trabajo_a / _b  E15 banco de tablones de 5,4 / 6,6 m con 3 / 4 tornillos de banco de fierro fundido (mordazas de acero, husillo y
//                    palanca con bolitas), repisa baja, limas, martillo y piezas sueltas. Largo en x, operario en +z.
//   estante_fundicion E20 estante de tablas con escuadras de fierro y piezas fundidas: engranajes, poleas acanaladas, bridas, ejes
//   vitrina_mesa_minerales / _lamparas / _herramientas  U04 vitrina de mesa del museo: mueble blanco con zócalo, fieltro azul, urna de
//                    vidrio con cantoneras de acero y repisa de la cédula al frente (+z)
//   atril_cedula     U12 atril de cédula: base torneada, columna cuadrada y tablero inclinado con marco (la placa la pone el kit)
//   foco_riel / foco_riel_v  U13 foco de riel: adaptador, horquilla, cuerpo con aletas y cara encendida; la cara mira 0,6 rad hacia +z / abajo
const MAD = 0x8a5a30, MADO = 0x5a3a1e, FN = 0x2c2d2f, AC = 0xb4b8bc;

function engranaje(A, mat, R, n, e, color, M) {   // rueda dentada extruida (dientes trapezoidales, cubo y agujero), eje = z local
  const s = new THREE.Shape(), h = R * 0.16, k = A.q ? n : Math.min(n, 12);
  for (let i = 0; i < k; i++) { const a = i / k * 2 * PI, d = PI / k;
    const P = (r, b) => [Math.cos(a + b) * r, Math.sin(a + b) * r];
    for (const [r, b] of [[R - h, -d * 0.55], [R, -d * 0.28], [R, d * 0.28], [R - h, d * 0.55]]) { const [x, y] = P(r, b); i || r !== R - h || b > 0 ? s.lineTo(x, y) : s.moveTo(x, y); } }
  s.closePath();
  const hoyo = new THREE.Path(); hoyo.absarc(0, 0, R * 0.18, 0, 2 * PI, true); s.holes.push(hoyo);
  if (R > 0.1 && A.q) for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, c = new THREE.Path(); c.absarc(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.16, 0, 2 * PI, true); s.holes.push(c); }
  const g = new THREE.ExtrudeGeometry(s, { depth: e, bevelEnabled: A.q, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: A.q ? 6 : 3 });
  g.translate(0, 0, -e / 2); uvMetros(g, 'y'); if (M) g.applyMatrix4(M); A.add(mat, g, color);
  A.torno(mat, [[R * 0.18, -e * 0.9], [R * 0.3, -e * 0.9], [R * 0.3, e * 0.9], [R * 0.18, e * 0.9]], 0, 0, 0, color, A.q ? 12 : 6, new THREE.Matrix4().makeRotationX(PI / 2).premultiply(M || new THREE.Matrix4()));   // cubo
}
function llave(A, L, x, y, z, ry, color = AC) {   // llave de boca plana (cabeza abierta hacia +x, mango hacia −x), acostada
  const s = new THREE.Shape(), r = L * 0.16, a0 = 0.62;
  s.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
  for (let i = 1; i <= 8; i++) { const a = a0 + (PI - 0.3 - a0) * i / 8; s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.lineTo(-L, r * 0.36); s.quadraticCurveTo(-L - r * 0.4, 0, -L, -r * 0.36);
  for (let i = 0; i <= 8; i++) { const a = PI + 0.3 + (PI - 0.3 - a0) * i / 8; s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.lineTo(r * 0.15, -r * 0.42); s.lineTo(r * 0.15, r * 0.42); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-PI / 2); g.rotateY(ry); g.translate(x, y, z); uvMetros(g, 'x'); A.add('acero', g, color);
}
function polea(A, r, x, y, z, color, M) {   // polea acanalada torneada (eje y local)
  const g = [[r * 0.15, -0.03], [r, -0.03], [r, -0.022], [r * 0.82, 0], [r, 0.022], [r, 0.03], [r * 0.3, 0.03], [r * 0.3, 0.05], [r * 0.15, 0.05]];
  A.torno('fierro', g, x, y, z, color, A.q ? 22 : 8, M);
}

// ------------------------------------------------------------------ E07 banca larga
function bancaLarga(A, op) {
  const L = op.largo ?? 2.4, q = A.q, M = op.madera ?? MAD;
  for (let i = 0; i < 3; i++) A.bloque('madera', L, 0.035, 0.105, 0.01, 0, 0.44, -0.12 + i * 0.12, M, { seg: [6, 1, 1], veta: 'x' });   // listones con canto redondeado
  for (const s of [-1, 1]) {   // caballete: tabla recortada en arco abajo, cabezal y patín
    const x = s * (L / 2 - 0.2), sh = new THREE.Shape();
    sh.moveTo(-0.17, 0); sh.lineTo(-0.1, 0); sh.quadraticCurveTo(0, 0.13, 0.1, 0); sh.lineTo(0.17, 0); sh.lineTo(0.15, 0.4); sh.lineTo(-0.15, 0.4); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: q, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: q ? 10 : 4 });
    g.translate(0, 0, -0.02); uvMetros(g, 'y'); g.rotateY(PI / 2); g.translate(x, 0, 0); A.add('madera', g, MADO);
    A.bloque('madera', 0.07, 0.035, 0.36, 0.006, x, 0.405, 0, MADO, { veta: 'z' });   // cabezal bajo los listones
  }
  A.bloque('madera', L - 0.3, 0.07, 0.03, 0.006, 0, 0.27, 0, MADO, { seg: [4, 1, 1], veta: 'x' });   // larguero que pasa los caballetes
  for (const s of [-1, 1]) A.bloque('madera', 0.02, 0.09, 0.03, 0.003, s * (L / 2 - 0.15), 0.27, 0, 0x4a3018, { seg: [1, 1, 1], rz: 0.15 * s });   // cuñas
  if (q) for (let i = 0; i < 3; i++) for (const s of [-1, 1]) A.torno('fierro', [[0, 0.457], [0.006, 0.457], [0.006, 0.459], [0, 0.46]], s * (L / 2 - 0.2), 0, -0.12 + i * 0.12, 0x2a2622, 6);   // cabezas de clavo
  return [L, 0.46, 0.36];
}

// ------------------------------------------------------------------ E07 cotona colgada (guardapolvo de taller) + percha de pared
function cotona(A, x, yG, z, color, giro = 0) {   // cuelga del gancho en (x, yG, z); ancho en x, espalda hacia −z
  const q = A.q, h = 0.82, m = new THREE.Matrix4().makeRotationY(giro).setPosition(x, 0, z);
  const g = bloque(0.4, h, 0.1, 0.035, q ? [10, 14, 3] : [3, 5, 1], (v, w, hh, d) => {
    const t = (v.y + hh / 2) / hh;   // 0 abajo, 1 hombros
    const hombro = t > 0.86 ? 1 - (t - 0.86) / 0.14 * 0.55 : 1; v.x *= (0.9 + 0.12 * (1 - t)) * hombro;
    v.z *= 0.55 + 0.5 * (1 - t); v.z += 0.018 * Math.sin(v.x * 26 + 0.7) * (1 - t) + 0.01 * Math.sin(v.x * 61) * (1 - t);   // pliegues que se abren abajo
    if (t > 0.97) v.y -= 0.02 * Math.pow(Math.abs(v.x) / 0.2, 2) * 6;   // cae de los hombros
  });
  uvMetros(g, 'y'); g.translate(0, yG - 0.06 - h / 2, 0.02); g.applyMatrix4(m); A.add('tela', g, color);
  for (const s of [-1, 1]) A.tubo('tela', curva(t => V3(s * (0.17 - 0.02 * t), yG - 0.12 - 0.5 * t, 0.03 + 0.03 * Math.sin(PI * t)), q ? 8 : 3).map(p => p.applyMatrix4(m)), 0.045, color, { lados: q ? 8 : 5, rFn: t => 0.85 + 0.25 * t });   // mangas
  A.tubo('tela', curva(t => V3(Math.cos(PI * t) * 0.07, yG - 0.06 + 0.012 * Math.sin(PI * t), 0.045 + 0.02 * Math.sin(PI * t)), q ? 8 : 3).map(p => p.applyMatrix4(m)), 0.014, color, { lados: q ? 6 : 4 });   // cuello
  if (q) for (let k = 0; k < 4; k++) A.torno('loza', [[0, 0], [0.008, 0], [0.008, 0.004], [0, 0.005]], 0, 0, 0, 0xe8e2d0, 8, new THREE.Matrix4().makeRotationX(PI / 2).setPosition(0.012, yG - 0.18 - k * 0.15, 0.085).premultiply(m));   // botones
}
function perchaCotonas(A, op) {
  const q = A.q, L = 2.4, y = 1.75;
  A.bloque('madera', L, 0.12, 0.026, 0.006, 0, y, 0.013, MAD, { seg: [6, 1, 1], veta: 'x' });
  if (q) for (const yy of [y + 0.055, y - 0.055]) A.bloque('madera', L, 0.014, 0.01, 0.004, 0, yy, 0.03, MADO, { seg: [4, 1, 1], veta: 'x' });   // filetes
  for (let i = 0; i < 5; i++) {
    const x = 1.0 - i * 0.5;
    A.torno('bronce', [[0, 0], [0.022, 0], [0.024, 0.006], [0.012, 0.012], [0, 0.012]], x, 0, 0, 0xb08d3c, q ? 10 : 6, new THREE.Matrix4().makeRotationX(PI / 2).setPosition(x, y - 0.02, 0.026));   // roseta
    A.tubo('bronce', curva(t => V3(x, y - 0.02 + 0.06 * Math.sin(PI * 0.9 * t) - 0.02 * t, 0.03 + 0.11 * t), q ? 8 : 3), 0.007, 0xb08d3c, { lados: q ? 6 : 4 });   // gancho alto
    A.tubo('bronce', curva(t => { const a = PI * 1.2 * t; return V3(x, y - 0.03 - 0.03 * Math.sin(a), 0.03 + 0.07 * Math.sin(a * 0.5) + 0.01 * t); }, q ? 8 : 3), 0.007, 0xb08d3c, { lados: q ? 6 : 4 });   // gancho bajo
    if (i !== 2) cotona(A, x, y - 0.05, 0.075, i % 2 ? 0x5f6f86 : 0xbdb8a8, (i - 2) * 0.05);
  }
  return [L, 1.85, 0.2];
}
function percheroCotona(A, op) {
  const tam = fabricaFina('perchero')(A, {});
  cotona(A, 0.21, 1.66, 0, 0xbdb8a8, PI / 2);
  A.torno('lana', [[0, 0], [0.11, 0], [0.11, 0.01], [0.09, 0.02], [0.085, 0.06], [0.06, 0.085], [0, 0.09]], 0, 0, 0, 0x2c2a2a, A.q ? 16 : 8, new THREE.Matrix4().makeRotationZ(0.35).setPosition(-0.12, 1.62, -0.1));   // gorra
  A.bloque('lana', 0.2, 0.012, 0.09, 0.005, -0.08, 1.6, -0.06, 0x2c2a2a, { rz: 0.35, ry: 0.6 });   // visera
  return tam;
}

// ------------------------------------------------------------------ E08 vitrina de piezas de los alumnos
function vitrinaPiezas(A, op) {
  const q = A.q, w = 1.6, d = 0.5;
  A.bloque('madera', w + 0.04, 0.08, d + 0.03, 0.01, 0, 0.04, 0, MADO, { veta: 'x' });   // zócalo
  A.bloque('madera', w, 0.82, d - 0.04, 0.01, 0, 0.49, -0.02, MAD, { seg: [4, 4, 2], veta: 'y' });   // caja
  for (const s of [-1, 1]) {   // 2 puertas: marco + tablero en relieve + tirador
    const x = s * w / 4;
    for (const [dx, dy, sx, sy] of [[0, 0.36, w / 2 - 0.04, 0.06], [0, -0.36, w / 2 - 0.04, 0.06], [-(w / 4 - 0.05), 0, 0.06, 0.66], [w / 4 - 0.05, 0, 0.06, 0.66]]) A.bloque('madera', sx, sy, 0.022, 0.006, x + dx, 0.49 + dy, d / 2 - 0.01, MAD, { veta: sx > sy ? 'x' : 'y' });
    A.bloque('madera', w / 2 - 0.2, 0.6, 0.02, 0.02, x, 0.49, d / 2 - 0.016, MADO, { seg: [2, 3, 1], veta: 'y' });
    A.torno('bronce', [[0, 0], [0.012, 0], [0.012, 0.01], [0.018, 0.022], [0, 0.028]], 0, 0, 0, 0xb08d3c, 8, new THREE.Matrix4().makeRotationX(PI / 2).setPosition(x - s * (w / 4 - 0.1), 0.52, d / 2));
  }
  A.bloque('madera', w + 0.05, 0.04, d + 0.04, 0.012, 0, 0.92, 0, MADO, { veta: 'x' });   // cubierta
  const y0 = 0.94, y1 = 1.94, hv = y1 - y0;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.bloque('madera', 0.04, hv, 0.04, 0.006, sx * (w / 2 - 0.02), y0 + hv / 2, sz * (d / 2 - 0.02), MAD, { veta: 'y' });   // montantes
  if (q) A.bloque('madera', 0.025, hv, 0.025, 0.004, 0, y0 + hv / 2, d / 2 - 0.015, MAD, { veta: 'y' });   // montante del medio (2 hojas)
  for (const yy of [y0 + 0.02, y1 - 0.02]) for (const s of [-1, 1]) { A.bloque('madera', w, 0.04, 0.04, 0.006, 0, yy, s * (d / 2 - 0.02), MAD, { veta: 'x' }); A.bloque('madera', 0.04, 0.04, d, 0.006, s * (w / 2 - 0.02), yy, 0, MAD, { veta: 'z' }); }
  A.bloque('madera', w + 0.06, 0.05, d + 0.06, 0.015, 0, y1 + 0.03, 0, MADO, { veta: 'x' }); A.bloque('madera', w + 0.1, 0.025, d + 0.08, 0.008, 0, y1 + 0.065, 0, MADO, { veta: 'x' });   // cornisa
  for (const [x, z, sx, sz] of [[0, d / 2 - 0.02, w - 0.06, 0.004], [0, -d / 2 + 0.02, w - 0.06, 0.004], [-w / 2 + 0.02, 0, 0.004, d - 0.06], [w / 2 - 0.02, 0, 0.004, d - 0.06]]) A.bloque('vidrio', sx, hv - 0.06, sz, 0.001, x, y0 + hv / 2, z, 0xe6eee8, { seg: [1, 1, 1] });
  A.bloque('cristal', w - 0.08, 0.008, d - 0.08, 0.002, 0, 1.42, 0, 0xe6eee8, { seg: [1, 1, 1] });   // repisa de vidrio
  for (const s of [-1, 1]) for (const z of [-0.15, 0.15]) A.tubo('bronce', [V3(s * (w / 2 - 0.05), 1.405, z), V3(s * (w / 2 - 0.05), 1.415, z)], 0.008, 0xb08d3c, { lados: 5 });
  for (let i = 0; i < 4; i++) {   // engranajes parados en atriles de fierro
    const R = 0.11 - i * 0.015, x = -0.55 + i * 0.36, yc = y0 + 0.03 + R + 0.02;
    engranaje(A, 'fierro', R, 18 - i * 2, 0.03, i % 2 ? 0x6c6e70 : 0x8a7a68, new THREE.Matrix4().makeRotationY(0.15 * (i - 1.5)).setPosition(x, yc, -0.04));
    A.bloque('fierro', 0.1, 0.02, 0.08, 0.004, x, y0 + 0.01, -0.02, FN, { seg: [1, 1, 1] }); A.tubo('fierro', [V3(x, y0 + 0.02, -0.02), V3(x, yc - R * 0.2, -0.02)], 0.006, FN, { lados: 4 });
    A.bloque('loza', 0.07, 0.004, 0.035, 0.001, x, y0 + 0.003, 0.17, 0xf2eedf, { seg: [1, 1, 1], rx: -0.3 });   // etiqueta
  }
  for (let i = 0; i < 5; i++) llave(A, 0.17 + i * 0.012, -0.55 + i * 0.27, 1.43, -0.05 + (i % 2) * 0.08, 0.12 * (i - 2), i === 2 ? 0x8a8e92 : AC);
  A.torno('acero', [[0, 0], [0.018, 0], [0.018, 0.12], [0.026, 0.12], [0.026, 0.2], [0.014, 0.2], [0.014, 0.3], [0, 0.3]], 0, 0, 0, AC, q ? 14 : 6, new THREE.Matrix4().makeRotationZ(PI / 2).setPosition(0.62, 1.455, 0.12));   // eje escalonado acostado
  return [w + 0.1, 2.0, d + 0.08];
}

// ------------------------------------------------------------------ E15 banco de trabajo con tornillos de banco
function tornillo(A, x, yT, z) {   // tornillo de banco paralelo de fierro fundido sobre el borde del frente (+z), mordazas a lo largo de x
  const q = A.q, V = 0x3a4a3e;
  A.bloque('fierro', 0.16, 0.02, 0.18, 0.006, x, yT + 0.01, z - 0.06, V, { seg: [1, 1, 1] });   // base atornillada
  A.bloque('fierro', 0.12, 0.1, 0.2, 0.02, x, yT + 0.07, z - 0.06, V, { seg: [2, 2, 2] });   // cuerpo
  A.bloque('fierro', 0.18, 0.11, 0.05, 0.012, x, yT + 0.135, z - 0.15, V, { seg: [2, 2, 1] });   // mordaza fija (atrás)
  A.bloque('fierro', 0.18, 0.11, 0.05, 0.012, x, yT + 0.135, z + 0.02, V, { seg: [2, 2, 1] });   // mordaza móvil
  for (const zz of [z - 0.122, z - 0.008]) { A.bloque('acero', 0.17, 0.045, 0.008, 0.001, x, yT + 0.168, zz, AC, { seg: [1, 1, 1] });
    if (q) for (let k = 0; k < 8; k++) A.bloque('acero', 0.003, 0.04, 0.002, 0, x - 0.075 + k * 0.021, yT + 0.168, zz + (zz < z - 0.06 ? 0.005 : -0.005), 0x8a8e92, { seg: [1, 1, 1], rz: 0.6 }); }   // estrías
  A.tubo('acero', [V3(x, yT + 0.08, z - 0.12), V3(x, yT + 0.08, z + 0.13)], 0.012, AC, { lados: q ? 8 : 4 });   // husillo
  A.tubo('fierro', [V3(x - 0.13, yT + 0.08, z + 0.13), V3(x + 0.13, yT + 0.08, z + 0.13)], 0.007, AC, { lados: q ? 6 : 4 });   // palanca
  for (const s of [-1, 1]) A.esfera('acero', 0.014, x + s * 0.135, yT + 0.08, z + 0.13, AC);
  A.torno('fierro', [[0, -0.02], [0.022, -0.02], [0.022, 0.02], [0, 0.02]], 0, 0, 0, V, q ? 10 : 6, new THREE.Matrix4().makeRotationX(PI / 2).setPosition(x, yT + 0.08, z + 0.115));   // tuerca de la palanca
}
function bancoTrabajo(A, op) {
  const q = A.q, L = op.largo, D = 0.85, yT = 0.88, M = 0x7a5232;
  const n = Math.ceil(L / 2.4);
  for (let k = 0; k < 4; k++) for (let j = 0; j < n; j++) A.bloque('madera', L / n - 0.004, 0.08, D / 4 - 0.006, 0.006, -L / 2 + (j + 0.5) * L / n, yT - 0.04, -D / 2 + (k + 0.5) * D / 4, [M, 0x6e4a2c, 0x845a36, 0x704c2e][(k + j) % 4], { seg: [Math.max(2, Math.round(6 / n)), 1, 1], veta: 'x' });   // tablones gruesos
  const patas = [-L / 2 + 0.15, 0, L / 2 - 0.15];
  for (const x of patas) {
    for (const z of [-0.35, 0.35]) A.bloque('madera', 0.08, yT - 0.08, 0.08, 0.008, x, (yT - 0.08) / 2, z, MADO, { veta: 'y' });
    A.bloque('madera', 0.06, 0.08, D - 0.02, 0.006, x, yT - 0.12, 0, MADO, { veta: 'z' }); A.bloque('madera', 0.05, 0.06, 0.74, 0.006, x, 0.12, 0, MADO, { veta: 'z' });   // cabezales
  }
  A.bloque('madera', L - 0.2, 0.03, 0.74, 0.006, 0, 0.3, 0, 0x5e3e22, { seg: [4, 1, 1], veta: 'x' });   // repisa baja
  A.bloque('madera', L - 0.2, 0.12, 0.04, 0.006, 0, yT - 0.12, -0.38, MADO, { seg: [4, 1, 1], veta: 'x' });   // faldón de atrás
  for (const x of op.tornillos) tornillo(A, x, yT, D / 2 - 0.1);
  let s = 17 + Math.round(L * 10); const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < op.tornillos.length + 1; k++) {   // herramientas y piezas sobre el tablero
    const x = -L / 2 + 0.5 + k * (L - 1) / op.tornillos.length + (r() - 0.5) * 0.3, z = -0.1 + r() * 0.2, a = (r() - 0.5) * 0.8;
    const m = new THREE.Matrix4().makeRotationY(a).setPosition(x, yT, z);
    if (k % 3 === 0) { A.tubo('acero', [V3(-0.14, 0.008, 0), V3(0.1, 0.008, 0)].map(p => p.applyMatrix4(m)), 0.007, 0x7c8084, { lados: 4, rFn: t => 1 - 0.5 * t }); A.tubo('madera', [V3(-0.26, 0.012, 0), V3(-0.14, 0.012, 0)].map(p => p.applyMatrix4(m)), 0.013, 0x9a6a3a, { lados: q ? 8 : 5 }); }   // lima con mango
    else if (k % 3 === 1) { A.tubo('madera', [V3(0, 0.014, -0.15), V3(0, 0.014, 0.12)].map(p => p.applyMatrix4(m)), 0.012, 0x9a6a3a, { lados: q ? 8 : 5 }); A.bloque('acero', 0.1, 0.03, 0.03, 0.006, 0, 0, 0, 0x5a5e62, { seg: [1, 1, 1] }); A.P.acero[A.P.acero.length - 1].applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.016, 0.13).premultiply(m)); }   // martillo
    else engranaje(A, 'fierro', 0.07, 14, 0.025, 0x6c6e70, new THREE.Matrix4().makeRotationX(PI / 2).setPosition(0, 0.013, 0).premultiply(m));   // pieza fundida acostada
    if (k < op.tornillos.length) A.bloque('fierro', 0.14, 0.05, 0.05, 0.004, op.tornillos[k] + 0.25, yT + 0.025, -0.25, 0x6c6e70, { seg: [1, 1, 1], ry: a });   // bloque de fierro a medio ajustar
  }
  return [L, yT + 0.2, D];
}

// ------------------------------------------------------------------ E20 estante de piezas fundidas
function estanteFundicion(A, op) {
  const q = A.q, w = 1.8, d = 0.45, M = 0x6e4a2c;
  for (const s of [-1, 1]) A.bloque('madera', 0.05, 1.8, d, 0.008, s * (w / 2 - 0.025), 0.9, 0, MADO, { seg: [1, 4, 1], veta: 'y' });   // laterales
  for (const y of [0.05, 0.6, 1.15, 1.7]) { A.bloque('madera', w - 0.1, 0.035, d - 0.01, 0.006, 0, y, 0, M, { seg: [4, 1, 1], veta: 'x' }); A.bloque('madera', w - 0.1, 0.05, 0.02, 0.004, 0, y - 0.035, d / 2 - 0.02, MADO, { veta: 'x' }); }
  for (const s of [-1, 1]) A.tubo('fierro', [V3(s * (w / 2 - 0.06), 0.08, -d / 2 + 0.01), V3(-s * (w / 2 - 0.06), 1.68, -d / 2 + 0.01)], 0.012, FN, { lados: 4, esc: [2.2, 0.5] });   // cruz de pletina atrás
  for (const s of [-1, 1]) for (const y of [0.6, 1.15]) A.tubo('fierro', [V3(s * (w / 2 - 0.06), y - 0.15, -d / 2 + 0.01), V3(s * (w / 2 - 0.06), y - 0.02, -d / 2 + 0.01), V3(s * (w / 2 - 0.06), y - 0.02, -d / 2 + 0.16)], 0.008, FN, { lados: 4 });   // escuadras
  const FU = [0x4a4642, 0x5a524a, 0x6c6e70, 0x3e3a36];
  let s = 71; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const y of [0.6, 1.15, 1.7, 0.05]) {
    let x = -w / 2 + 0.16;
    while (x < w / 2 - 0.2) {
      const t = Math.floor(r() * 4), c = FU[Math.floor(r() * 4)], yy = y + 0.0175;
      if (t === 0) { const R = 0.08 + r() * 0.05; engranaje(A, 'fierro', R, 12 + Math.floor(r() * 8), 0.04, c, new THREE.Matrix4().makeRotationY(0.2 * (r() - 0.5)).setPosition(x + R, yy + R, -0.08)); x += 2 * R + 0.06; }
      else if (t === 1) { const R = 0.07 + r() * 0.05; polea(A, R, x + R, yy + 0.03, 0.02, c); x += 2 * R + 0.05; }
      else if (t === 2) { const R = 0.06 + r() * 0.03; A.torno('fierro', [[R * 0.4, 0], [R, 0], [R, 0.025], [R * 0.55, 0.03], [R * 0.5, 0.11], [R * 0.4, 0.11]], x + R, yy, -0.02 + r() * 0.08, c, q ? 16 : 6); x += 2 * R + 0.05; }   // brida con cuello
      else { const l = 0.22 + r() * 0.15; A.torno('acero', [[0, 0], [0.02, 0], [0.02, l * 0.4], [0.028, l * 0.4], [0.028, l * 0.7], [0.016, l * 0.7], [0.016, l], [0, l]], 0, 0, 0, AC, q ? 12 : 5, new THREE.Matrix4().makeRotationZ(PI / 2).setPosition(x + l, yy + 0.028, 0.08)); x += l + 0.07; }   // eje mecanizado
    }
  }
  return [w, 1.8, d];
}

// ------------------------------------------------------------------ U04 vitrina de mesa del museo (contenido por id)
function roca(A, r, x, y, z, color, sem, sy = 0.75) {
  const g = new THREE.IcosahedronGeometry(r, A.q ? 2 : 1), p = g.attributes.position, v = new THREE.Vector3();
  const h = (a, b, c) => { const t = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + sem) * 43758.5453; return t - Math.floor(t); };
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); const k = 0.78 + 0.32 * h(Math.round(n.x * 3), Math.round(n.y * 3), Math.round(n.z * 3)) + 0.08 * h(Math.round(n.x * 9), Math.round(n.y * 9), Math.round(n.z * 9)); v.multiplyScalar(k); v.y *= sy; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); g.translate(x, y + r * sy * 0.8, z); A.add('mineral', g, color);
}
function vitrinaMesa(A, op) {
  const q = A.q, w = 1.6, d = 0.7, BLC = 0xf2f0ea, GR = 0x34373b, yF = 0.885;
  A.bloque('pintura', w - 0.06, 0.08, d - 0.06, 0.004, 0, 0.04, 0, GR, { seg: [2, 1, 1] });   // zócalo retranqueado
  A.bloque('laca', w, 0.76, d, 0.012, 0, 0.46, 0, BLC, { seg: [3, 3, 2] });   // mueble blanco
  if (q) for (const s of [-1, 1]) A.bloque('laca', w / 2 - 0.08, 0.6, 0.008, 0.003, s * w / 4, 0.46, d / 2 + 0.002, 0xe8e6de, { seg: [1, 1, 1] });   // tapas de registro
  A.bloque('pintura', w + 0.02, 0.04, d + 0.02, 0.008, 0, 0.86, 0, GR, { seg: [2, 1, 1] });   // cubierta
  A.bloque('fieltro', w - 0.06, 0.01, d - 0.06, 0.003, 0, 0.885, 0, 0x1f2f45, { seg: [2, 1, 2] });   // fieltro azul
  const yv = 0.88, hv = 0.5;
  for (const [x, z, sx, sz] of [[0, d / 2 - 0.01, w - 0.02, 0.006], [0, -d / 2 + 0.01, w - 0.02, 0.006], [-w / 2 + 0.01, 0, 0.006, d - 0.02], [w / 2 - 0.01, 0, 0.006, d - 0.02]]) A.bloque('vidrio', sx, hv, sz, 0.001, x, yv + hv / 2, z, 0xe6eee8, { seg: [1, 1, 1] });
  A.bloque('vidrio', w - 0.02, 0.006, d - 0.02, 0.001, 0, yv + hv, 0, 0xe6eee8, { seg: [1, 1, 1] });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.tubo('cromo', [V3(sx * (w / 2 - 0.012), yv, sz * (d / 2 - 0.012)), V3(sx * (w / 2 - 0.012), yv + hv + 0.006, sz * (d / 2 - 0.012))], 0.012, 0xa9adb0, { lados: 4 });   // cantoneras
  for (const s of [-1, 1]) { A.tubo('cromo', [V3(-w / 2, yv + hv + 0.006, s * (d / 2 - 0.012)), V3(w / 2, yv + hv + 0.006, s * (d / 2 - 0.012))], 0.008, 0xa9adb0, { lados: 4 }); A.tubo('cromo', [V3(s * (w / 2 - 0.012), yv + hv + 0.006, -d / 2), V3(s * (w / 2 - 0.012), yv + hv + 0.006, d / 2)], 0.008, 0xa9adb0, { lados: 4 }); }
  A.bloque('pintura', 0.62, 0.03, 0.14, 0.006, 0, 0.68, d / 2 + 0.07, GR, { seg: [1, 1, 1] });   // repisa de la cédula
  for (const s of [-1, 1]) A.tubo('pintura', [V3(s * 0.26, 0.6, d / 2), V3(s * 0.26, 0.6, d / 2 + 0.06), V3(s * 0.26, 0.665, d / 2 + 0.1)], 0.008, GR, { lados: 4 });   // ménsulas
  const etq = (x, z) => A.bloque('loza', 0.12, 0.004, 0.05, 0.001, x, yF + 0.006, z, 0xf2eedf, { seg: [1, 1, 1], rx: -0.25 });
  if (op.tipo === 'minerales') {
    const cols = [0xb89a3a, 0x7a4a6a, 0x2f7a4a, 0x8a2a1e, 0x6a5e52, 0xb06a3a];   // calcopirita, bornita, malaquita, cuprita, roca, cobre nativo
    for (let i = 0; i < 6; i++) { const x = -0.6 + i * 0.24; roca(A, 0.065 + (i % 3) * 0.014, x, yF, -0.07, cols[i], i * 3.1); if (i === 5) for (let k = 0; k < 4; k++) roca(A, 0.018, x + 0.06 * Math.cos(k * 2), yF + 0.02, -0.07 + 0.06 * Math.sin(k * 2), 0xc87a40, 9 + k, 1.4); etq(x, 0.17);
      A.torno('pintura', [[0, 0], [0.06, 0], [0.065, 0.01], [0, 0.012]], x, yF, -0.07, 0x1a1c1e, q ? 12 : 6); }   // peana
  } else if (op.tipo === 'lamparas') {
    for (let i = 0; i < 3; i++) { const x = -0.5 + i * 0.4, z = -0.06, B = [0xb08d3c, 0x9a7a34, 0xc0a050][i];
      A.torno('bronce', [[0, 0], [0.042, 0], [0.045, 0.008], [0.045, 0.07], [0.04, 0.078], [0.036, 0.08], [0.038, 0.088], [0.038, 0.15], [0.03, 0.16], [0, 0.162]], x, yF, z, B, q ? 16 : 8);   // depósitos de carburo y agua
      A.torno('bronce', [[0, 0], [0.012, 0], [0.012, 0.03], [0.02, 0.032], [0, 0.04]], x, yF + 0.162, z, B, 8);   // tapa y regulador
      A.torno('bronce', [[0.006, -0.004], [0.02, 0], [0.045, 0.012], [0.052, 0.022], [0.048, 0.024], [0.02, 0.01], [0.006, 0.006]], 0, 0, 0, 0xd0b060, q ? 18 : 8, new THREE.Matrix4().makeRotationX(PI / 2).setPosition(x, yF + 0.13, z + 0.05));   // reflector
      A.tubo('bronce', [V3(x, yF + 0.13, z + 0.03), V3(x, yF + 0.13, z + 0.052)], 0.005, B, { lados: 5 });
      A.tubo('fierro', curva(t => V3(x - 0.04 - 0.03 * Math.sin(PI * t), yF + 0.13 - 0.03 * t, z - 0.05 * t), q ? 6 : 3), 0.004, 0x3a3634, { lados: 4 });   // gancho
      etq(x, 0.18); }
    { const x = 0.58, z = 0.0;   // casco de minero de cuero
      const g = new THREE.SphereGeometry(0.12, q ? 16 : 8, q ? 8 : 4, 0, 2 * PI, 0, PI / 2); g.scale(1, 0.85, 1.18); g.translate(x, yF + 0.025, z); A.add('piel', g, 0x6a4a2a);
      A.torno('piel', [[0.115, 0], [0.16, -0.004], [0.165, 0.004], [0.12, 0.012]], 0, 0, 0, 0x5a3c22, q ? 18 : 8, new THREE.Matrix4().makeScale(1, 1, 1.18).setPosition(x, yF + 0.025, z));
      A.bloque('bronce', 0.05, 0.05, 0.012, 0.004, x, yF + 0.1, z + 0.13, 0xb08d3c, { seg: [1, 1, 1], rx: -0.3 }); etq(x, 0.2); }
  } else {
    { const m = new THREE.Matrix4().makeRotationY(0.2); A.tubo('acero', [V3(-0.74, 0, 0), V3(-0.14, 0, 0), V3(-0.06, 0, 0)].map(p => p.applyMatrix4(m).add(V3(0, yF + 0.02, 0.0))), 0.019, 0xa4a8ac, { lados: 6, rFn: t => t > 0.9 ? 0.25 + (1 - t) * 7 : 1 }); }   // barreta con punta
    { const x = 0.2, z = -0.02, a = 0.3, m = new THREE.Matrix4().makeRotationY(a).setPosition(x, yF, z);   // combo
      A.tubo('madera', [V3(0, 0.04, -0.3), V3(0, 0.04, 0.18)].map(p => p.applyMatrix4(m)), 0.018, 0xb07a44, { lados: q ? 8 : 5 });
      const g = bloque(0.26, 0.08, 0.08, 0.01, [2, 1, 1]); uvMetros(g, 'x'); g.translate(0, 0.04, 0.22); g.applyMatrix4(m); A.add('fierro', g, 0x7a7c7e); }
    { const g = new THREE.CylinderGeometry(0.005, 0.045, 0.24, 4, 1); g.rotateZ(PI / 2); g.rotateY(-0.1); g.scale(1, 0.6, 1); g.translate(0.5, yF + 0.028, 0.1); A.add('fierro', g, 0x8a8c8e); }   // cuña
    etq(-0.5, 0.2); etq(0.2, 0.2); etq(0.45, 0.24);
  }
  return [w, 1.39, d + 0.14];
}

// ------------------------------------------------------------------ U12 atril de cédula (tablero 0,68 × 0,44 inclinado −0,6 rad, centro en (0, 1, 0,02))
function atrilCedula(A, op) {
  const q = A.q, GR = 0x34373b;
  A.torno('pintura', [[0, 0], [0.16, 0], [0.165, 0.008], [0.15, 0.018], [0.06, 0.03], [0.04, 0.045], [0, 0.045]], 0, 0, 0, GR, q ? 24 : 10);   // base de fundición
  A.tubo('pintura', [V3(0, 0.04, 0), V3(0, 0.86, 0)], 0.028, GR, { lados: 4 });   // columna cuadrada
  A.torno('pintura', [[0, 0.84], [0.04, 0.84], [0.045, 0.86], [0.03, 0.88], [0, 0.88]], 0, 0, 0, GR, q ? 12 : 6);   // capitel
  const m = new THREE.Matrix4().makeRotationX(-0.6).setPosition(0, 1.0, 0.02);
  const pl = (sx, sy, sz, x, y, z, mat = 'laca') => { const g = bloque(sx, sy, sz, Math.min(0.004, sz / 2 - 1e-4), [1, 1, 1]); uvMetros(g, 'x'); g.translate(x, y, z); g.applyMatrix4(m); A.add(mat, g, GR); };
  pl(0.68, 0.44, 0.022, 0, 0, -0.004);   // tablero
  for (const s of [-1, 1]) { pl(0.68, 0.02, 0.03, 0, s * 0.21, 0.004); pl(0.02, 0.44, 0.03, s * 0.33, 0, 0.004); }   // marco (canto 1 cm sobre la cara: la placa queda 0,7 cm más afuera)
  A.tubo('pintura', [V3(0, 0.86, 0), V3(0, 0.9, 0.02), V3(0, 0.95, 0.06)], 0.02, GR, { lados: 4 });   // cuello al tablero
  return [0.68, 1.15, 0.36];
}

// ------------------------------------------------------------------ U13 foco de riel
function focoRiel(A, op) {
  const q = A.q, N = 0x1b1c1e, inc = op.incl ?? 0;
  A.bloque('pintura', 0.05, 0.03, 0.09, 0.006, 0, -0.015, 0, N, { seg: [1, 1, 1] });   // adaptador al riel
  A.tubo('pintura', [V3(0, -0.03, 0), V3(0, -0.06, 0)], 0.01, N, { lados: 6 });
  const piv = new THREE.Matrix4().makeRotationX(inc).setPosition(0, -0.12, 0);
  const P = (x, y, z) => V3(x, y, z).applyMatrix4(piv);
  A.tubo('pintura', doblar([V3(-0.075, 0, 0), V3(-0.075, 0.06, 0), V3(0.075, 0.06, 0), V3(0.075, 0, 0)], 0.02, q ? 4 : 2).map(p => p.add(V3(0, -0.12, 0))), 0.007, N, { lados: 4, esc: [0.5, 2] });   // horquilla
  for (const s of [-1, 1]) A.torno('pintura', [[0, -0.006], [0.018, -0.006], [0.018, 0.006], [0, 0.006]], 0, 0, 0, N, 8, new THREE.Matrix4().makeRotationZ(PI / 2).setPosition(s * 0.068, -0.12, 0));   // perillas
  const cuerpo = [[0, -0.1], [0.04, -0.1], [0.05, -0.09], [0.055, -0.06], [0.06, 0.06], [0.068, 0.075], [0.068, 0.085], [0.062, 0.085], [0.06, 0.07], [0, 0.07]];
  A.torno('pintura', cuerpo, 0, 0, 0, N, q ? 18 : 8, new THREE.Matrix4().makeRotationX(PI).premultiply(new THREE.Matrix4().makeRotationX(inc)).setPosition(0, -0.12, 0).multiply(new THREE.Matrix4()));
  if (q) for (let k = 0; k < 4; k++) A.torno('pintura', [[0.054, 0], [0.064, 0], [0.064, 0.006], [0.054, 0.006]], 0, 0, 0, N, 16, new THREE.Matrix4().makeRotationX(PI).premultiply(new THREE.Matrix4().makeRotationX(inc)).setPosition(0, -0.12, 0).multiply(new THREE.Matrix4().makeTranslation(0, -0.085 + k * 0.022, 0)));   // aletas
  const cara = new THREE.CircleGeometry(0.055, q ? 18 : 8); cara.rotateX(PI / 2); cara.translate(0, -0.075, 0); cara.applyMatrix4(piv); A.add('foco', cara, 0xfff6dc);
  void P;
  return [0.16, 0.25, 0.16];
}

// G9M (E09, 16-11): asta de la bandera del hall: pie de madera torneada sobre cruceta con regatones, asta de madera barnizada en dos tramos con
// anillos de bronce, cordón con su cornamusa y moharra de bronce (lanza sobre globo). Pivote en el piso; el paño lo pone kitEscuela.js (plano Q1).
function astaBandera(A, op) {
  const q = A.q, BR = 0xc9a24a, MB = 0x6a4224;
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; A.tubo('madera', curva(t => V3(Math.cos(a) * 0.28 * t, 0.05 * (1 - t) + 0.02, Math.sin(a) * 0.28 * t), q ? 5 : 2), 0.022, MADO, { lados: 4, plano: true });
    A.torno('bronce', [[0, 0], [0.018, 0], [0.02, 0.02], [0, 0.02]], Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28, BR, 8); }   // cruceta con regatones
  A.torno('madera', [[0, 0.04], [0.09, 0.04], [0.095, 0.07], [0.07, 0.09], [0.05, 0.13], [0.06, 0.2], [0.04, 0.24], [0.034, 0.26], [0, 0.26]], 0, 0, 0, MADO, q ? 18 : 8);   // pie torneado
  A.torno('madera', [[0.03, 0.24], [0.027, 1.45], [0.025, 2.86], [0, 2.86]], 0, 0, 0, MB, q ? 12 : 6);   // asta
  for (const y of [0.27, 1.45, 2.84]) A.torno('bronce', [[0.026, y - 0.02], [0.034, y - 0.012], [0.034, y + 0.012], [0.026, y + 0.02]], 0, 0, 0, BR, q ? 12 : 6);
  A.esfera('bronce', 0.045, 0, 2.92, 0, BR);
  A.torno('bronce', [[0, 2.96], [0.012, 2.96], [0.03, 3.02], [0.008, 3.12], [0, 3.13]], 0, 0, 0, BR, q ? 10 : 4);   // moharra
  A.tubo('tela', [V3(0.03, 2.8, 0), V3(0.034, 1.6, 0.004), V3(0.04, 1.1, 0.01)], 0.003, 0xe8e2d0, { lados: 3 });   // cordón
  A.bloque('bronce', 0.012, 0.08, 0.02, 0.003, 0.034, 1.08, 0, BR, { seg: [1, 1, 1] });   // cornamusa
  return [0.6, 3.13, 0.6];
}
export const FABRICA_ESCUELA = { pupitre_doble: pupitre, pupitre_doble_b: (A, op) => pupitre(A, { cuaderno: false, ...op }), poste_cordon: posteCordon,
  banca_larga: bancaLarga, banca_larga_2: (A, op) => bancaLarga(A, { largo: 2.0, ...op }), percha_cotonas: perchaCotonas, perchero_cotona: percheroCotona,
  vitrina_piezas: vitrinaPiezas, banco_trabajo_a: (A, op) => bancoTrabajo(A, { largo: 5.4, tornillos: [1.9, 0.4, -1.1], ...op }), banco_trabajo_b: (A, op) => bancoTrabajo(A, { largo: 6.6, tornillos: [2.5, 1.0, -0.5, -2.0], ...op }),
  estante_fundicion: estanteFundicion, vitrina_mesa_minerales: (A, op) => vitrinaMesa(A, { tipo: 'minerales', ...op }), vitrina_mesa_lamparas: (A, op) => vitrinaMesa(A, { tipo: 'lamparas', ...op }),
  vitrina_mesa_herramientas: (A, op) => vitrinaMesa(A, { tipo: 'herramientas', ...op }), atril_cedula: atrilCedula, foco_riel: (A, op) => focoRiel(A, { incl: -0.6, ...op }), foco_riel_v: focoRiel,
  asta_bandera: astaBandera };   // G9M (E09)
registrarFabrica(FABRICA_ESCUELA);
void densificar;
