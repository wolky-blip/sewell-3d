// N0-VIDA (carril ciudad, 14-11-2026): lo que da vida a la ciudad minera. Los datos (dónde va cada cosa) están en js/datos/vida.js;
// aquí se arman en el juego, como fábricas de juego/entidades.js (FABRICA_VIDA se suma a FABRICA):
//   faena    maquinaria y objetos de faena modelados en código (bulldozer, tractor oruga, carreta, carro de mano, carretilla,
//            vagoneta en su riel, sacos, cajones de dinamita, tambores, herramientas, leña, trineo), una malla por material
//            (mergeGeometries) y una caja de colisión ('cajon'); sin TRELLIS ni GPU.
//   gente    vecinos y mineros genéricos con las mallas de personajes (minero, vecina, anciana): caminan entre dos puntos de
//            la calle o conversan en pareja; no atacan; se apartan y empujan suave a Nato (como el viento); burbujas con datos del libro.
//            Rendimiento: invisibles a > 85 m, sin animar a > 45 m (medido en capturas/ciudad/vida/).
//   reliquia coleccionables del libro (ficha de la pulpería, lámpara de carburo...): al tocarlos se lee su ficha y el HUD los cuenta.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './construir.js';
import { mallaPersona } from '../juego/jugador.js';
import { escalaPersona } from '../datos/alturas.js';
import { P } from '../juego/logica.js';
import { UI } from '../ui/hud.js';
import { RELIQUIAS } from '../datos/vida.js';
import { FABRICA_ANIMALES } from './animales.js';   // N1-PUEBLO-VIDA: mulas, yuntas de bueyes con su carreta
import { FABRICA_GENTE1905 } from './gente1905.js';   // N1-PUEBLO-VIDA: gente de 1905 (arrieros, lavanderas, niños...)
import { texMat, uvPieza } from './texFaena.js';
import { precargarUtileria, piezaGrupo, partirPieza } from './utileria.js';   // G9-EXT (16-11): mallas TRELLIS de exterior (vagoneta, sacos)   // TEX (16-11): materiales con textura compartidos (madera, fierro, riel, arpillera)

// ------------------------------------------------------------------ armado: piezas sueltas → una malla por material
function Arma() {
  const partes = new Map(), o = new THREE.Object3D();
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
    uvPieza(geo, m, sx, sy, sz);   // TEX: UV en metros por pieza si el material tiene textura
    let g = geo.index ? geo.toNonIndexed() : geo; g.applyMatrix4(o.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    (partes.get(m) || partes.set(m, []).get(m)).push(g);
  };
  const A = {
    add,
    caja: (m, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => add(new THREE.BoxGeometry(sx, sy, sz), m, x, y, z, rx, ry, rz),
    // cilindro con el eje en z (ruedas, rodillos) o en y (eje: 'y') o en x
    cil: (m, r0, r1, h, x, y, z, eje = 'z', seg = 14) => add(new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z, eje === 'z' ? Math.PI / 2 : 0, 0, eje === 'x' ? Math.PI / 2 : 0),
    bola: (m, r, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => add(new THREE.SphereGeometry(r, 10, 7), m, x, y, z, 0, ry, 0, sx, sy, sz),
    toro: (m, R, r, x, y, z, rx = 0, ry = 0, arco = Math.PI * 2) => add(new THREE.TorusGeometry(R, r, 6, 20, arco), m, x, y, z, rx, ry, 0),
    fin: () => {
      const g = new THREE.Group();
      for (const [m, gs] of partes) { const me = new THREE.Mesh(mergeGeometries(gs), m); me.castShadow = true; me.receiveShadow = true; g.add(me); }
      return g;
    },
  };
  return A;
}
const lienzos = new Map();
function rotuloMat(texto, fondo, tinta, ancho = 256, alto = 96) {
  const k = texto + fondo + tinta; if (lienzos.has(k)) return lienzos.get(k);
  const c = document.createElement('canvas'); c.width = ancho; c.height = alto; const x = c.getContext('2d');
  x.fillStyle = fondo; x.fillRect(0, 0, ancho, alto); x.strokeStyle = tinta; x.lineWidth = 5; x.strokeRect(6, 6, ancho - 12, alto - 12);
  x.fillStyle = tinta; x.font = `bold ${Math.floor(alto * 0.42)}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(texto, ancho / 2, alto / 2 + 2, ancho - 24);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); lienzos.set(k, m); return m;
}
// TEX (16-11-2026, Diego: «falta aplicar las texturas»): madera con vetas, fierro fundido con óxido, acero, riel y arpillera
// (js/mundo/texFaena.js, una textura y un material por tipo en todo el juego). Antes: mat(color) liso.
const C = {
  madera: () => texMat('veta'), maderaV: () => texMat('durmiente', 0xd8c4ac), fierro: () => texMat('fierro'),
  acero: () => texMat('acero'), oruga: () => texMat('pintado', 0xb0b0b0), oxido: () => texMat('oxido'),
  saco: () => texMat('arpillera', 0xd2bc90), sacoO: () => texMat('arpillera', 0xa8916c), negro: () => texMat('pintado'), cuero: () => mat(0x3e2a1c, { rough: 0.8 }),
  tablas: () => texMat('tablas', 0xa88460), riel: () => texMat('riel'),   // TEX: caja de tablas de la vagoneta; rieles con el hongo pulido
  mineral: () => mat(0x4f4a44, { rough: 0.95 }), cobre: () => mat(0x6f8a5a, { rough: 0.9 }), nieve: () => mat(0xf2f5f8, { rough: 0.9 }), vidrio: () => mat(0x22303a, { metal: 0.3, rough: 0.2 }),
};

// N1-PUEBLO-VIDA: piezas aprobadas de la utilería (assets3d/utileria/<id>.glb) para el exterior: una carga por pieza, copias que
// comparten geometría y material (mismo ajuste de material que utileria.js). La carretilla se inclina 5,5° para que patas y rueda toquen.
const UTIL = {};
const UTIL_AJUSTE = { carretilla: -0.097 };
function utilGlb(id) { return utilRaw(id).then(r => { if (!r) return null; const me = new THREE.Mesh(r.geo, r.ma); me.castShadow = true; me.receiveShadow = true; return me; }); }
function utilRaw(id) {
  return UTIL[id] ||= import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync('assets3d/utileria/' + id + '.glb')).then(gl => {
    let m = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if (o.isMesh && !m) m = o; });
    if (!m) return null;
    const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
    if (UTIL_AJUSTE[id]) { geo.applyMatrix4(new THREE.Matrix4().makeRotationX(UTIL_AJUSTE[id])); geo.computeBoundingBox(); geo.translate(0, -geo.boundingBox.min.y, 0); }
    const ma = m.material;
    if (ma && ma.isMeshStandardMaterial) { ma.metalness = Math.min(ma.metalness ?? 0, 0.15); ma.roughness = Math.max(ma.roughness ?? 0.8, 0.5); ma.needsUpdate = true; }
    return { geo, ma };
  }).catch(e => { console.warn('vida: no cargó', id, e && e.message); return null; });
}
// N1-PUEBLO-VIDA (15-11, Diego: «falta la textura de los minerales»): mineral de cobre con la malla aprobada pepita (roca con
// calcopirita/malaquita) instanciada y girada al azar, más trozos de roca gris (misma malla con la textura suelo_roca).
// piezas: [[x, y, z, escala, roca?]] en el marco del modelo; una InstancedMesh por material (geometría compartida).
let matRoca = null;
export function mineral(piezas, semilla = 1, respaldo = null) {
  const g = new THREE.Group(); let s = semilla * 9301 + 49297;
  const az = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const rot = piezas.map(() => [az() * 6.3, az() * 6.3, az() * 6.3, 0.85 + az() * 0.3]);
  utilRaw('pepita').then(r => {   // la _lod no trae textura (salía blanca)
    if (!r) { if (respaldo) g.add(respaldo()); return; }
    if (!matRoca) { const t = new THREE.TextureLoader().load('assets3d/texturas/suelo_roca.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.35, 0.35);
      matRoca = new THREE.MeshStandardMaterial({ map: t, color: 0x6e6862, roughness: 0.95 }); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const roca of [false, true]) {
      const lst = piezas.map((pz, i) => [pz, rot[i]]).filter(([pz]) => !!pz[4] === roca); if (!lst.length) continue;
      const im = new THREE.InstancedMesh(r.geo, roca ? matRoca : r.ma, lst.length);
      lst.forEach(([[x, y, z, k], [a, b, c, f]], i) => { q.setFromEuler(e.set(a, b, c)); im.setMatrixAt(i, m4.compose(p.set(x, y, z), q, sc.set(k * f, k, k / f))); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; g.add(im);
    }
  });
  return g;
}
// rueda de rayos (carretas): llanta, maza y rayos
function ruedaRayos(A, R, x, y, z, rayos = 10, ancho = 0.08) {
  A.add(new THREE.TorusGeometry(R, ancho * 0.7, 6, 26), C.fierro(), x, y, z);
  A.add(new THREE.TorusGeometry(R - ancho, ancho * 0.6, 6, 26), C.madera(), x, y, z);
  A.cil(C.maderaV(), 0.11, 0.11, 0.22, x, y, z);
  for (let k = 0; k < rayos; k++) { const a = k * Math.PI * 2 / rayos; A.caja(C.madera(), 0.05, R - 0.1, 0.05, x + Math.sin(a) * (R - 0.1) / 2, y + Math.cos(a) * (R - 0.1) / 2, z, 0, 0, -a); }
}
function saco(A, x, y, z, ry = 0, k = 1, m = C.saco()) {
  A.bola(m, 0.3 * k, x, y + 0.24 * k, z, 1.35, 0.8, 1, ry);
  A.cil(m, 0.07 * k, 0.1 * k, 0.16 * k, x + Math.cos(ry) * 0.38 * k, y + 0.3 * k, z - Math.sin(ry) * 0.38 * k, 'y', 8);
}
// orugas, cuerpo y hoja: bulldozer de los 60 (canopia y gatos hidráulicos) o tractor oruga de los 30-40 (hoja de cable, sin techo)
function bulldozer(op = {}) {
  const A = Arma(), viejo = !!op.viejo, k = viejo ? 0.82 : 1, am = mat(op.color || 0xd9a21b, { rough: 0.55, metal: 0.15 });
  const L = 4.2 * k, w = 1.05 * k, hT = 0.82 * k, rT = hT / 2;
  for (const s of [-1, 1]) {
    const z = s * w;
    A.caja(C.oruga(), L - 2 * rT, hT, 0.55 * k, 0, rT + 0.02, z);                 // bastidor de la oruga
    for (const x of [-(L / 2 - rT), L / 2 - rT]) A.cil(C.oruga(), rT, rT, 0.55 * k, x, rT + 0.02, z, 'z', 18);
    const n = Math.round(L / 0.24);
    for (let i = 0; i < n; i++) { const x = -L / 2 + rT + (i + 0.5) * (L - 2 * rT) / n; A.caja(C.fierro(), 0.07, 0.07, 0.6 * k, x, hT + 0.05, z); A.caja(C.fierro(), 0.07, 0.07, 0.6 * k, x, 0.03, z); }   // tejas de la oruga
    for (let i = 0; i < 5; i++) A.cil(C.acero(), 0.16 * k, 0.16 * k, 0.06, -L / 2 + rT + 0.3 + i * (L - 2 * rT - 0.6) / 4, 0.24 * k, z + s * 0.3 * k);   // rodillos
    A.cil(C.acero(), 0.36 * k, 0.36 * k, 0.07, -(L / 2 - rT), rT + 0.02, z + s * 0.3 * k, 'z', 12);   // rueda motriz
    A.caja(am, L - 0.4, 0.05, 0.62 * k, 0, hT + 0.12, z);                           // guardabarro
  }
  A.caja(am, 3.4 * k, 0.55 * k, (2 * w - 0.5) * k, -0.1, hT * 0.85, 0);              // chasis
  // motor: capó, rejilla, persianas, escape y filtro
  const xc = 0.55 * k, hy = hT + 0.62 * k;
  A.caja(am, 1.9 * k, 1.0 * k, 1.1 * k, xc, hy, 0);
  A.caja(C.negro(), 0.1, 0.92 * k, 1.0 * k, xc + 0.97 * k, hy, 0);
  for (let i = -3; i <= 3; i++) A.caja(am, 0.06, 0.92 * k, 0.04, xc + 1.0 * k, hy, i * 0.14 * k);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) A.caja(C.negro(), 0.04, 0.5 * k, 0.02, xc - 0.5 * k + i * 0.18 * k, hy + 0.05, s * 0.555 * k);
  A.cil(C.negro(), 0.07, 0.08, 0.9 * k, xc + 0.45 * k, hy + 0.9 * k, 0.28 * k, 'y', 10); A.cil(C.oxido(), 0.09, 0.09, 0.08, xc + 0.45 * k, hy + 1.36 * k, 0.28 * k, 'y', 10);
  if (!viejo) A.cil(am, 0.13, 0.13, 0.5 * k, xc + 0.65 * k, hy + 0.7 * k, -0.3 * k, 'y', 12);
  // puesto del operador: estanque, asiento, palancas
  const xo = -1.0 * k;
  A.caja(am, 0.7 * k, 0.75 * k, 1.7 * k, xo - 0.55 * k, hT + 0.55 * k, 0);
  A.caja(C.cuero(), 0.5 * k, 0.12, 0.65 * k, xo + 0.05, hT + 0.55 * k, 0); A.caja(C.cuero(), 0.1, 0.55 * k, 0.65 * k, xo - 0.22 * k, hT + 0.85 * k, 0);
  for (const s of [-0.18, 0.18]) A.caja(C.negro(), 0.04, 0.6 * k, 0.04, xo + 0.45 * k, hT + 0.75 * k, s, 0, 0, 0.35);
  if (!viejo) {   // canopia de protección (ROPS)
    const hc = 2.95;
    for (const [x, z] of [[-1.6, -0.75], [-1.6, 0.75], [-0.25, -0.75], [-0.25, 0.75]]) A.caja(C.negro(), 0.1, hc - hT - 0.2, 0.1, x, (hc + hT + 0.2) / 2, z);
    A.caja(am, 1.6, 0.08, 1.75, -0.92, hc, 0);
  }
  // hoja de empuje (curva), cuchilla, brazos y gatos (o poleas del cable en el viejo)
  const xb = L / 2 + 0.55 * k, ancho = 2 * w + 0.95 * k, hb = 1.05 * k;
  A.add(new THREE.CylinderGeometry(0.85 * k, 0.85 * k, ancho, 16, 1, true, Math.PI * 1.19, Math.PI * 0.62), am, xb + 0.85 * k, 0.75 * k, 0, Math.PI / 2, 0, 0);   // cara cóncava hacia adelante
  A.caja(C.acero(), 0.08, 0.14, ancho, xb + 0.02, 0.07, 0);
  for (const s of [-1, 1]) A.caja(am, 0.12, hb, 0.08, xb + 0.1, hb * 0.5, s * ancho / 2);
  for (const s of [-1, 1]) A.caja(am, 2.0 * k, 0.16, 0.14, L / 2 - 0.55 * k, 0.45 * k, s * (w + 0.36 * k), 0, 0, -0.08);   // brazos de empuje
  if (!viejo) for (const s of [-1, 1]) A.cil(C.acero(), 0.06, 0.06, 1.2 * k, xc + 1.25 * k, hy + 0.15, s * 0.45 * k, 'x', 8);
  else { A.caja(C.fierro(), 0.1, 1.2, 0.1, xc + 0.95 * k, hy + 0.5, 0); A.cil(C.acero(), 0.12, 0.12, 0.1, xc + 0.95 * k, hy + 1.05, 0); A.cil(C.oxido(), 0.25, 0.25, 0.5, xo - 1.0 * k, hT + 0.8, 0, 'z', 12); }
  if (!viejo) { A.caja(C.fierro(), 0.18, 1.0, 0.18, -L / 2 - 0.35, 0.55, 0, 0, 0, 0.25); A.caja(am, 0.6, 0.18, 1.3, -L / 2 - 0.2, 1.05, 0); }   // escarificador atrás
  // óxido y barro en los bordes (máquina usada)
  A.caja(C.oxido(), 0.02, 0.18, ancho * 0.6, xb - 0.02, 0.2, 0.1);
  const g = A.fin();
  return { g, colision: [[0.2 * k, 1.2 * k, 0, L + 1.6 * k, 2.4 * k, ancho + 0.1]] };
}
// REV (16-11, revisor de mallas): cajones de la faena con la malla aprobada `cajon` (0,8 × 0,6 × 0,55 m, pivote al piso, frente +z).
// L = [[x, y piso, z, giro, ancho, alto, fondo]]; se ocultan las cajas de respaldo menos el rótulo (material rot). ?utileria=0: respaldo
function cajonesMalla(g, L, rot) {
  utilGlb('cajon').then(m0 => { if (!m0 || /[?&]utileria=0/.test(location.search)) return; const resp = g.children.filter(o => o.material !== rot);
    L.forEach(([x, y, z, ry, a, h, f], i) => { const m = i ? new THREE.Mesh(m0.geometry, m0.material) : m0; m.name = 'util:cajon'; m.castShadow = m.receiveShadow = true; m.position.set(x, y, z); m.rotation.y = ry; m.scale.set(a / 0.8, h / 0.6, f / 0.55); g.add(m); });
    for (const o of resp) o.visible = false; });
}
const MINERAL_CARRETILLA = () => mineral([[0, 0.5, 0.12, 0.85], [0.1, 0.49, -0.1, 0.75], [-0.1, 0.5, -0.06, 0.8, true], [0.03, 0.6, 0.0, 0.7], [-0.07, 0.48, 0.27, 0.6, true], [0.09, 0.47, 0.25, 0.65], [-0.02, 0.58, -0.2, 0.6, true]], 3);
const MODELOS = {
  bulldozer: op => bulldozer(op),
  tractor: op => bulldozer({ ...op, viejo: true, color: op.color || 0xb98a2a }),
  carreta() {   // 1905: carreta de dos ruedas grandes, con varas para la mula, cargada de sacos
    const A = Arma();
    for (const s of [-1, 1]) ruedaRayos(A, 0.78, 0, 0.78, s * 0.86, 12);
    A.cil(C.fierro(), 0.05, 0.05, 1.9, 0, 0.78, 0);
    A.caja(C.madera(), 2.6, 0.1, 1.45, 0.1, 1.0, 0);
    for (const s of [-1, 1]) { A.caja(C.madera(), 2.6, 0.32, 0.06, 0.1, 1.2, s * 0.72); for (let i = 0; i < 5; i++) A.caja(C.maderaV(), 0.06, 0.55, 0.07, -1.1 + i * 0.55, 1.22, s * 0.74); }
    A.caja(C.madera(), 0.06, 0.32, 1.45, -1.18, 1.2, 0);
    for (const s of [-1, 1]) A.caja(C.maderaV(), 2.7, 0.09, 0.09, 2.2, 0.55, s * 0.5, 0, 0, -0.35);   // varas apoyadas en el suelo
    A.caja(C.maderaV(), 0.08, 0.95, 0.08, -1.25, 0.5, 0, 0, 0, 0.1);   // pata de apoyo atrás
    saco(A, -0.6, 1.05, -0.3, 0.3); saco(A, 0.2, 1.05, 0.25, -0.2); saco(A, -0.2, 1.38, 0, 1.4, 0.9, C.sacoO());
    return { g: A.fin(), colision: [[0.1, 0.8, 0, 2.7, 1.6, 1.9]] };
  },
  carroMano() {   // carro de mano de dos ruedas con sacos de mercadería
    const A = Arma();
    for (const s of [-1, 1]) ruedaRayos(A, 0.45, 0, 0.45, s * 0.55, 8, 0.06);
    A.cil(C.fierro(), 0.035, 0.035, 1.2, 0, 0.45, 0);
    A.caja(C.madera(), 1.5, 0.08, 0.95, 0.1, 0.62, 0);
    for (const s of [-1, 1]) A.caja(C.madera(), 1.5, 0.28, 0.05, 0.1, 0.78, s * 0.47);
    for (const s of [-1, 1]) A.caja(C.maderaV(), 1.3, 0.06, 0.06, -1.15, 0.5, s * 0.36, 0, 0, 0.32);
    A.caja(C.maderaV(), 0.06, 0.06, 0.78, -1.75, 0.31, 0);
    saco(A, 0.35, 0.66, -0.18, 0.2, 0.8); saco(A, -0.2, 0.66, 0.2, -0.3, 0.8, C.sacoO());
    A.caja(C.madera(), 0.5, 0.35, 0.4, 0.4, 0.84, 0.25);
    return { g: A.fin(), colision: [[0, 0.55, 0, 2.2, 1.1, 1.2]] };
  },
  carretilla() {   // N1-PUEBLO-VIDA: malla aprobada assets3d/utileria/carretilla.glb (QC 360°) con mineral encima; respaldo: la de cajas
    const g = new THREE.Group();
    // mineral de cobre apilado en la batea (pepita.glb) con trozos de roca gris
    const mineral = MINERAL_CARRETILLA(); mineral.visible = false; g.add(mineral);
    utilGlb('carretilla').then(m => { if (!m) { const r = MODELOS.carretillaCajas(); r.g.rotation.y = Math.PI / 2; g.add(r.g); return; } g.add(m); mineral.visible = true; });
    // rueda adelante (+z, toca en z 0,5) y patas atrás (z -0,1); el modelo trae las patas 6 cm sobre el piso: se inclina 5,5° (utilGlb)
    return { g, colision: [[0, 0.35, 0, 0.66, 0.7, 1.5]], contactos: [[0, 0, 0.5], [-0.21, 0, -0.1], [0.21, 0, -0.1]] };
  },
  carretillaCajas() {   // carretilla de fierro con mineral (respaldo procedural)
    const A = Arma();
    A.add(new THREE.CylinderGeometry(0.5, 0.36, 0.38, 4, 1, false, Math.PI / 4), C.oxido(), 0.05, 0.6, 0, 0, 0, 0, 1.2, 1, 0.85);
    A.add(new THREE.DodecahedronGeometry(0.22), C.mineral(), 0.0, 0.82, 0.05); A.add(new THREE.DodecahedronGeometry(0.17), C.cobre(), 0.2, 0.8, -0.12); A.add(new THREE.DodecahedronGeometry(0.15), C.mineral(), -0.2, 0.8, -0.1);
    A.cil(C.negro(), 0.22, 0.22, 0.1, 0.72, 0.22, 0); A.cil(C.acero(), 0.06, 0.06, 0.12, 0.72, 0.22, 0);
    for (const s of [-1, 1]) { A.caja(C.madera(), 1.7, 0.06, 0.06, -0.15, 0.48, s * 0.26, 0, 0, 0.15); A.caja(C.fierro(), 0.05, 0.4, 0.05, -0.35, 0.2, s * 0.25); }
    return { g: A.fin(), colision: [[0, 0.45, 0, 1.8, 0.9, 0.8]] };
  },
  sacos() {   // pila de sacos de mineral (dos hileras y uno encima)
    const A = Arma(); let k = 0;
    for (const [x, z, y] of [[-0.55, -0.3, 0], [0.15, -0.32, 0], [0.8, -0.28, 0], [-0.4, 0.35, 0], [0.4, 0.33, 0], [-0.1, 0, 0.42], [0.55, 0.02, 0.42]]) saco(A, x, y, z, (k++ * 1.7) % 3, 1, k % 3 ? C.saco() : C.sacoO());
    const g = A.fin();
    { const pu = precargarUtileria(); if (pu) pu.then(() => { const m = piezaGrupo('sacos_monton', [1.3, 1.1, 1.3]); if (!m) return;   // G9-EXT (16-11): montón de sacos TRELLIS (1,3×0,75×0,9 ×[1,3 1,1 1,3]); respaldo: los sacos TEX
      m.position.x = 0.1; m.name = 'g9ext_sacos'; for (const o of g.children) if (o.material === C.saco() || o.material === C.sacoO()) o.visible = false; g.add(m); }); }
    return { g, colision: [[0.1, 0.45, 0, 2.0, 0.9, 1.3]] };
  },
  dinamita() {   // cajones de dinamita con su rótulo (de la época: madera clara y letras rojas)
    const A = Arma(), m = mat(0xa8865a, { rough: 0.9 }), r = rotuloMat('DINAMITA', '#d9c08a', '#9a1c14');
    for (const [x, y, z, ry] of [[-0.4, 0.23, 0, 0], [0.38, 0.23, 0.05, 0.1], [0, 0.69, 0.02, -0.08]]) {
      A.caja(m, 0.72, 0.45, 0.46, x, y, z, 0, ry, 0);
      for (const dx of [-0.33, 0.33]) A.caja(C.maderaV(), 0.05, 0.47, 0.48, x + Math.cos(ry) * dx, y, z - Math.sin(ry) * dx, 0, ry, 0);
      A.add(new THREE.PlaneGeometry(0.5, 0.2), r, x - Math.sin(ry) * 0.235, y, z + Math.cos(ry) * 0.235, 0, ry, 0);
    }
    // REV (16-11, revisor de mallas): los cajones son la malla aprobada `cajon` (tablas con zunchos) a 0,72 × 0,45 × 0,46 m; el rótulo DINAMITA queda
    const g = A.fin();
    cajonesMalla(g, [[-0.4, 0, 0, 0], [0.38, 0, 0.05, 0.1], [0, 0.46, 0.02, -0.08]].map(([x, y, z, ry]) => [x, y, z, ry, 0.72, 0.45, 0.46]), r);
    return { g, colision: [[0, 0.45, 0, 1.6, 0.92, 0.6]] };
  },
  tambores() {   // tambores de petróleo y grasa (uno volcado)
    const A = Arma(), cols = [0x8e2a22, 0x2d4f7a, 0x5d6a4a, 0x8e2a22];
    [[-0.5, 0], [0.15, -0.15], [0.05, 0.5]].forEach(([x, z], i) => {
      const m = mat(cols[i], { rough: 0.6, metal: 0.4 });
      A.cil(m, 0.29, 0.29, 0.88, x, 0.44, z, 'y', 16);
      for (const y of [0.08, 0.3, 0.58, 0.8]) A.add(new THREE.TorusGeometry(0.292, 0.018, 4, 20), C.fierro(), x, y, z, Math.PI / 2);
    });
    A.cil(mat(cols[3], { rough: 0.6, metal: 0.4 }), 0.29, 0.29, 0.88, 0.85, 0.29, 0.2, 'z', 16);
    A.caja(C.oxido(), 0.7, 0.02, 0.5, 0.75, 0.01, 0.6);
    // REV (16-11, revisor de mallas): tambores con la malla aprobada `tambor` (0,58 × 0,88 m, la misma medida); las cajas quedan de respaldo
    const g = A.fin();
    utilGlb('tambor').then(m0 => { if (!m0 || /[?&]utileria=0/.test(location.search)) return;   /* ?utileria=0: respaldo, como el resto de la utilería */ const resp = g.children.slice();
      [[-0.5, 0, 0.3], [0.15, -0.15, 1.9], [0.05, 0.5, 4.1]].forEach(([x, z, ry], i) => { const m = i ? new THREE.Mesh(m0.geometry, m0.material) : m0; m.castShadow = m.receiveShadow = true; m.name = 'util:tambor'; m.position.set(x, 0, z); m.rotation.y = ry; g.add(m); });
      const p = new THREE.Group(), m = new THREE.Mesh(m0.geometry, m0.material); m.castShadow = m.receiveShadow = true; m.position.y = -0.44; p.add(m); p.position.set(0.85, 0.29, 0.2); p.rotation.set(0, 0.3, Math.PI / 2); g.add(p);   // el volcado
      for (const o of resp) o.visible = false; });
    return { g, colision: [[0.15, 0.45, 0.15, 2.0, 0.9, 1.4]] };
  },
  herramientas() {   // caballete con palas y picotas apoyadas
    const A = Arma();
    for (const x of [-0.8, 0.8]) for (const s of [-1, 1]) A.caja(C.maderaV(), 0.07, 1.1, 0.07, x, 0.52, s * 0.22, s * 0.38, 0, 0);
    A.caja(C.madera(), 1.9, 0.09, 0.09, 0, 1.0, 0);
    for (let i = 0; i < 3; i++) { const x = -0.55 + i * 0.5; A.cil(C.madera(), 0.025, 0.025, 1.25, x, 0.62, 0.32, 'y', 6); A.add(new THREE.BoxGeometry(0.24, 0.3, 0.02), C.acero(), x, 0.12, 0.4, -0.25, 0, 0); }
    for (let i = 0; i < 2; i++) { const x = -0.3 + i * 0.6; A.cil(C.madera(), 0.03, 0.03, 0.9, x, 0.55, -0.3, 'y', 6); A.add(new THREE.TorusGeometry(0.32, 0.03, 4, 12, Math.PI * 0.8), C.fierro(), x, 1.0, -0.32, 0, 0, Math.PI * 0.1); }
    return { g: A.fin(), colision: [[0, 0.5, 0, 2.0, 1.0, 0.9]] };
  },
  lena() {   // leña para las cocinas y las estufas de los camarotes
    const A = Arma(), m = mat(0x6b4a2c, { rough: 1 }), c = mat(0xc9a77a, { rough: 1 });
    let i = 0; for (let fila = 0; fila < 3; fila++) for (let k = 0; k < 5 - fila; k++) {
      const z = (k - (4 - fila) / 2) * 0.27, y = 0.13 + fila * 0.23, r = 0.11 + ((i++ * 37) % 5) * 0.008;
      A.cil(m, r, r, 1.25, 0, y, z, 'x', 8); for (const s of [-1, 1]) A.cil(c, r * 0.92, r * 0.92, 0.01, s * 0.626, y, z, 'x', 8);
    }
    for (const s of [-1, 1]) A.caja(C.maderaV(), 0.06, 0.9, 0.06, 0, 0.45, s * 0.75);
    // REV (16-11, revisor de mallas): dos rumas de la malla aprobada `lena` (0,9 × 0,6 × 0,5 m) a 1,3×, troncos a lo largo de x; las cajas de respaldo
    const g = A.fin();
    utilGlb('lena').then(m0 => { if (!m0 || /[?&]utileria=0/.test(location.search)) return;   /* ?utileria=0: respaldo, como el resto de la utilería */ const resp = g.children.slice();
      [[-0.33, 0.04], [0.33, -0.04]].forEach(([x, z], i) => { const m = i ? new THREE.Mesh(m0.geometry, m0.material) : m0; m.castShadow = m.receiveShadow = true; m.name = 'util:lena'; m.scale.setScalar(1.3); m.position.set(x, 0, z); m.rotation.y = Math.PI / 2 + i * Math.PI; g.add(m); });
      for (const o of resp) o.visible = false; });
    return { g, colision: [[0, 0.4, 0, 1.3, 0.8, 1.5]] };
  },
  trineo() {   // trineo de carga para la nieve
    const A = Arma();
    for (const s of [-1, 1]) { A.caja(C.fierro(), 2.0, 0.05, 0.06, 0, 0.04, s * 0.45); A.add(new THREE.TorusGeometry(0.2, 0.03, 4, 10, Math.PI / 2), C.fierro(), 1.0, 0.24, s * 0.45, 0, 0, -Math.PI / 2); A.caja(C.madera(), 0.06, 0.25, 0.06, -0.6, 0.18, s * 0.45); A.caja(C.madera(), 0.06, 0.25, 0.06, 0.5, 0.18, s * 0.45); }
    for (let i = 0; i < 7; i++) A.caja(C.madera(), 0.2, 0.04, 1.0, -0.8 + i * 0.25, 0.32, 0);
    saco(A, -0.3, 0.34, 0, 0, 0.85); A.caja(mat(0xa8865a), 0.5, 0.4, 0.45, 0.45, 0.54, 0);
    return { g: A.fin(), colision: [[0, 0.35, 0, 2.2, 0.7, 1.1]] };
  },
  cajonera() {   // cajones de repuestos apilados
    const A = Arma(), m = mat(0x8e6a42, { rough: 0.9 }), r = rotuloMat('REPUESTOS', '#cdb68a', '#2c2c2c');
    for (const [x, y, z, s] of [[-0.45, 0.3, 0, 0.6], [0.35, 0.25, 0.05, 0.5], [-0.3, 0.85, 0, 0.5], [0.35, 0.68, 0, 0.36]]) { A.caja(m, s * 1.3, s, s, x, y, z); A.add(new THREE.PlaneGeometry(s, s * 0.35), r, x, y, z + s / 2 + 0.005); }
    const g = A.fin();   // REV (16-11, revisor de mallas): cajones = malla aprobada `cajon`, el rótulo REPUESTOS queda
    cajonesMalla(g, [[-0.45, 0.3, 0, 0.6], [0.35, 0.25, 0.05, 0.5], [-0.3, 0.85, 0, 0.5], [0.35, 0.68, 0, 0.36]].map(([x, y, z, s]) => [x, y - s / 2, z, 0, s * 1.3, s, s]), r);
    return { g, colision: [[0, 0.55, 0, 1.6, 1.1, 0.7]] };
  },
  vagonetaRiel() {   // tramo de riel con su vagoneta cargada de mineral (N1: del túnel al molino)
    const A = Arma();
    for (let i = 0; i < 9; i++) A.caja(C.maderaV(), 0.22, 0.12, 1.15, -2.8 + i * 0.7, 0.06, 0);
    for (const s of [-1, 1]) A.caja(C.riel(), 6.2, 0.1, 0.07, 0, 0.17, s * 0.32);   // TEX: riel (antes C.acero liso)
    A.add(new THREE.CylinderGeometry(0.75, 0.55, 0.7, 4, 1, false, Math.PI / 4), C.tablas(), 0, 0.85, 0, 0, 0, 0, 1.25, 1, 0.9);   // TEX: tolva de tablas viejas (antes C.oxido liso)
    A.caja(C.fierro(), 1.6, 0.12, 0.9, 0, 0.47, 0);
    for (const x of [-0.5, 0.5]) for (const s of [-1, 1]) A.cil(C.fierro(), 0.2, 0.2, 0.08, x, 0.32, s * 0.32);
    const g = A.fin(), P = [];   // mineral de cobre (pepita.glb) y roca gris colmando la tolva
    for (let i = 0; i < 9; i++) P.push([-0.55 + (i % 3) * 0.55, 1.08 + Math.floor(i / 3) % 2 * 0.1, -0.28 + Math.floor(i / 3) * 0.28, 1.2 + (i % 2) * 0.35, i % 3 === 1]);
    P.push([-0.2, 1.3, 0, 1.4], [0.3, 1.28, 0.05, 1.3, true]);
    const minV = mineral(P, 7); g.add(minV);
    { const pu = precargarUtileria(); if (pu) pu.then(() => { const P = partirPieza('vagoneta_vacia', 'sin_rieles', (x, y) => y < 0.045); if (!P || !P.a.index.count) return;   // G9-EXT (16-11): vagoneta vacía TRELLIS (1,5×1,0×0,9 ×[1,25 1,12 1,2]) sobre los rieles de código (los de la malla se quitan); la carga de mineral sigue en código
      const m = new THREE.Mesh(P.a, P.mat); m.castShadow = m.receiveShadow = true; m.scale.set(1.25, 1.12, 1.2); m.position.y = 0.17; m.name = 'g9ext_vagoneta'; minV.scale.set(0.78, 0.92, 0.7);   /* el mineral cabe en la caja de la malla (más angosta que la tolva TEX) */ for (const o of g.children) if (o.material === C.tablas() || o.material === C.fierro()) o.visible = false; g.add(m); }); }   // respaldo: tolva y chasis TEX
    return { g, colision: [[0, 0.7, 0, 1.9, 1.4, 1.2]], contactos: [[-2.8, 0, -0.57], [-2.8, 0, 0.57], [2.8, 0, -0.57], [2.8, 0, 0.57], [0, 0, -0.57], [0, 0, 0.57]] };
  },
  nieve() {   // nieve apilada por el tractor
    const A = Arma();
    A.bola(C.nieve(), 1.0, 0, 0.1, 0, 1.8, 0.75, 1.4); A.bola(C.nieve(), 0.7, 1.1, 0.0, 0.4, 1.4, 0.6, 1.2);
    return { g: A.fin(), colision: [[0.3, 0.35, 0.1, 3.0, 0.7, 2.4]] };
  },
};

// N0-OLLAS: carro portaolla (bastidor de fierro, 4 ruedas de ferrocarril sobre trocha de 1 m, muñones a los lados). Eje largo = x.
// La olla se monta a PORTAOLLAS_H sobre el suelo; cuadro de rieles y durmientes: viaOllas().
export const PORTAOLLAS_H = 0.95;
export function portaollas() {
  const A = Arma(), F = C.fierro(), O = C.oxido(), N = C.negro();
  for (const z of [-0.95, 0.95]) A.caja(F, 4.0, 0.24, 0.22, 0, 0.83, z);              // largueros del bastidor
  for (const x of [-1.7, -0.6, 0.6, 1.7]) A.caja(F, 0.2, 0.2, 2.1, x, 0.83, 0);        // travesaños
  A.caja(O, 3.5, 0.06, 2.3, 0, 0.93, 0);                                               // plataforma
  for (const x of [-1.2, 1.2]) {
    A.cil(F, 0.06, 0.06, 1.5, x, 0.52, 0);                                             // eje
    for (const z of [-0.5, 0.5]) { A.cil(N, 0.32, 0.32, 0.1, x, 0.52, z); A.cil(F, 0.2, 0.2, 0.12, x, 0.52, z); A.cil(F, 0.38, 0.38, 0.03, x, 0.52, z + Math.sign(z) * -0.06); }   // rueda con pestaña
    for (const z of [-0.95, 0.95]) A.caja(F, 0.35, 0.34, 0.12, x, 0.67, z * 0.93);     // caja de grasa
  }
  for (const z of [-1.55, 1.55]) {                                                      // outriggers y pedestales con muñón
    A.caja(F, 0.3, 0.2, 0.9, 0, 0.83, z * 0.75);
    A.caja(F, 0.9, 1.5, 0.2, 0, 1.7, z * 1.08);
    A.cil(O, 0.3, 0.3, 0.3, 0, 2.2, z * 1.08, 'z', 14);
  }
  for (const x of [-2.2, 2.2]) { A.caja(F, 0.35, 0.12, 0.12, x, 0.8, 0); A.cil(F, 0.09, 0.09, 0.2, x * 1.03, 0.8, 0, 'x'); }   // topes y enganche
  return A.fin();
}
// tramo de vía de trocha angosta (rieles + durmientes) de largo L a lo largo de x, centrado en el origen (y = 0 al suelo del rellano)
export function viaOllas(L) {
  const A = Arma(); const n = Math.floor(L / 0.7);
  for (let i = 0; i <= n; i++) A.caja(C.maderaV(), 0.2, 0.12, 1.7, -L / 2 + i * L / n, 0.06, 0);
  for (const z of [-0.5, 0.5]) A.caja(C.riel(), L, 0.1, 0.07, 0, 0.17, z);   // TEX: riel
  A.caja(C.fierro(), 0.3, 0.9, 0.3, L / 2 - 0.1, 0.5, 0); A.caja(C.fierro(), 1.2, 0.2, 0.25, L / 2 - 0.1, 0.95, 0);   // tope de fin de vía
  return A.fin();
}

// ------------------------------------------------------------------ apoyo en la ladera (N1-PUEBLO-VIDA, 15-11)
// puntos de apoyo de un modelo: los vértices más bajos (≤ 8 cm sobre el mínimo), muestreados (ruedas, patas, varas)
export function puntosBajos(g, margen = 0.08, max = 48) {
  const v = new THREE.Vector3(), todos = []; let mn = 1e9;
  g.updateMatrixWorld(true);
  g.traverse(o => { if (!o.isMesh || !o.geometry.attributes.position) return; const p = o.geometry.attributes.position; o.updateMatrix();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.applyMatrix4(o.matrix); if (v.y < mn + margen + 0.5) todos.push([v.x, v.y, v.z]); mn = Math.min(mn, v.y); } });
  const bajos = todos.filter(p => p[1] < mn + margen), paso = Math.max(1, Math.floor(bajos.length / max));
  return bajos.filter((_, i) => i % paso === 0);
}
const _ABAJO = { x: 0, y: -1, z: 0 };
const PILAS = new Set(['sacos', 'dinamita', 'herramientas', 'lena', 'tambores', 'cajonera', 'nieve', 'trineo']);
// suelo bajo (x, z) sin contar otros objetos de faena ni personajes; desde = altura de partida del rayo
export function sueloSin(M, x, z, desde) {
  const h = M.fis.rayo({ x, y: desde, z }, _ABAJO, desde + 260, undefined, ['cajon', 'animal']);
  return h ? h.punto.y : M.fis.suelo(x, z);
}
// plano del suelo bajo la huella (caja de colisión [cx, cy, cz, lx, ly, lz] en el marco del modelo) → cuaternión (giro + inclinación)
// y altura del origen para que ningún punto de apoyo quede enterrado. maxIncl en radianes.
// op.alinear: gira el eje x del modelo hacia la pendiente (riel que baja del túnel); op.asentar: pilas y cajones (≤ maxIncl de
// inclinación y se asientan un poco del lado de arriba en vez de quedar volando del lado de abajo, como en la nieve).
export function apoyar(M, x, z, th, caja, contactos, yFija, maxIncl = 0.38, op = {}) {
  const [cx0, , cz0, lx, , lz] = caja;
  const y0 = yFija ?? M.fis.suelo(x, z), desde = y0 + 8;
  if (op.alinear) {   // gradiente en el mundo con diferencias centrales de 2 m
    const gx = sueloSin(M, x + 2, z, desde) - sueloSin(M, x - 2, z, desde), gz = sueloSin(M, x, z + 2, desde) - sueloSin(M, x, z - 2, desde);
    if (Math.hypot(gx, gz) > 0.2) th = Math.atan2(-gz, gx);
  }
  const c = Math.cos(th), sn = Math.sin(th);
  const loc = (u, w) => [x + u * c + w * sn, z - u * sn + w * c];
  // mínimos cuadrados h = a + bu·u + bw·w sobre una grilla 3×3 de la huella (un poco más grande que la caja)
  let S = 0, Su = 0, Sw = 0, Suu = 0, Sww = 0, Sh = 0, Suh = 0, Swh = 0;
  for (const a of [-0.5, 0, 0.5]) for (const b of [-0.5, 0, 0.5]) {
    const u = cx0 + a * lx * 1.05, w = cz0 + b * lz * 1.05, [px, pz] = loc(u, w), h = sueloSin(M, px, pz, desde);
    S++; Su += u; Sw += w; Suu += u * u; Sww += w * w; Sh += h; Suh += u * h; Swh += w * h;
  }
  const mu = Su / S, mw = Sw / S, mh = Sh / S;
  let bu = (Suh / S - mu * mh) / Math.max(1e-6, Suu / S - mu * mu), bw = (Swh / S - mw * mh) / Math.max(1e-6, Sww / S - mw * mw);
  const k = Math.hypot(bu, bw), tope = Math.tan(maxIncl); if (k > tope) { bu *= tope / k; bw *= tope / k; }
  const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), th);
  const qT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-bu, 1, -bw).normalize());
  const q = qY.multiply(qT);
  let y = -1e9, ymin = 1e9; const v = new THREE.Vector3();
  for (const p of contactos) { v.set(p[0], p[1], p[2]).applyQuaternion(q); const n = sueloSin(M, x + v.x, z + v.z, desde) - v.y; y = Math.max(y, n); ymin = Math.min(ymin, n); }
  if (y < -1e8) y = y0;
  else if (op.asentar) y = Math.max((y + ymin) / 2, y - 0.18);   // se hunde ≤ 18 cm del lado de arriba
  return { q, y, incl: +(Math.atan(Math.hypot(bu, bw)) * 57.3).toFixed(1) };
}

// ------------------------------------------------------------------ fábricas (se suman a FABRICA de juego/entidades.js)
const rumboA = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
export const FABRICA_VIDA = {
  faena(M, L, s) {
    const f = MODELOS[s.que]; if (!f) return;
    const { g, colision, contactos } = f(s);
    // N1-PUEBLO-VIDA (15-11): apoyo según la pendiente. Antes la base quedaba a la altura MÁS BAJA de las 4 esquinas y en la ladera
    // el objeto se hundía hasta 2,7 m del lado de arriba («carretas enterradas»). Ahora: plano ajustado al suelo bajo la huella
    // (inclinación ≤ 22°) y altura tal que ningún punto de apoyo (ruedas, patas, varas) quede bajo el suelo.
    const pila = PILAS.has(s.que), ap = apoyar(M, s.x, s.z, (s.giro || 0) * Math.PI / 180, colision[0], contactos || puntosBajos(g), s.y, pila ? 0.14 : 0.38, { asentar: pila, alinear: s.que === 'vagonetaRiel' && s.alinear !== false });
    g.position.set(s.x, ap.y, s.z); g.quaternion.copy(ap.q);
    const _v = new THREE.Vector3();
    for (const [x, yy, z, sx, sy, sz] of colision) {   // 0,12 m más baja que el modelo: el auditor daba «enterrado entero» porque su rayo chocaba con el techo de la propia caja (N3-XK1, N4-XK1)
      _v.set(x, yy - 0.06, z).applyQuaternion(ap.q);
      M.fis.caja(s.x + _v.x, ap.y + _v.y, s.z + _v.z, sx, sy - 0.12, sz, 0, { tipo: 'cajon' }, { x: ap.q.x, y: ap.q.y, z: ap.q.z, w: ap.q.w });
    }
    L.agregar({ tipo: 'decor', vivo: true, malla: g, sala: null, x: s.x, y: ap.y, z: s.z, que: s.que, incl: ap.incl });
  },
  gente(M, L, s) {
    const COLS = { minero: { cuerpo: 0x7a5236, piernas: 0x3b3a36, casco: 0xf0c419 }, vecina: { cuerpo: 0x8a3b4a, piernas: 0x3a2a30, pelo: 0x2a1a14 }, anciana: { cuerpo: 0x4a4a5a, piernas: 0x2a2a30, pelo: 0xcfcfcf } };
    const g = mallaPersona(COLS[s.quien] || COLS.vecina, escalaPersona(s.quien), 'p_' + s.quien, { malla: true });
    const y0 = s.y ?? M.fis.suelo(s.x, s.z);
    g.position.set(s.x, y0, s.z);
    let sp = null; g.traverse(o => { if (o.userData && o.userData.mallaPromesa) sp = o; });
    const e = L.agregar({ tipo: 'npc', vivo: true, malla: g, sala: null, x: s.x, y: y0, z: s.z, t: Math.random() * 5, generico: true });
    let anim = null, actual = '';
    if (sp) { sp.userData.manejada = true; sp.userData.mallaPromesa.then(r => { anim = r.anim; anim.tocar('idle'); anim.actualizar(Math.random() * 2); }).catch(() => {}); }
    const poner = (n, dt, vel = 1) => { if (!anim) return; if (!anim.nombres.includes(n)) n = 'idle'; if (n !== actual) { anim.tocar(n, { fundido: 0.3, reiniciar: true, vel }); actual = n; } anim.actualizar(dt); };
    const nombre = s.nombre || { minero: 'Minero', vecina: 'Vecina', anciana: 'Señora' }[s.quien] || 'Vecino';   // N0-FABLE-1611 (M15): el turista lo nombra («Enfermera del hospital», no «Vecina: Enfermera…»)
    const A = { x: s.x, z: s.z }, B = s.a ? { x: s.a[0], z: s.a[1] } : null;
    let hacia = B, espera = 1 + Math.random() * 2, cuadro = 0;
    g.rotation.y = s.mira ? rumboA(s.x, s.z, s.mira[0], s.mira[1]) : B ? rumboA(s.x, s.z, B.x, B.z) : 0;
    e.act = dt => {
      e.t += dt; cuadro++;
      const j = M.jug, dx = g.position.x - j.pos.x, dz = g.position.z - j.pos.z, d = Math.hypot(dx, dz), dy = Math.abs(j.pie - g.position.y);
      const ver = d < 85; if (g.visible !== ver) g.visible = ver;
      if (!ver) return;
      // colisión suave: Nato no lo atraviesa (lo empuja hacia afuera, como el viento) y el vecino se hace a un lado
      if (d < 0.85 && dy < 1.6) { const k = (0.85 - d) * 30 * dt / Math.max(d, 0.05); j.vel.x -= dx * k; j.vel.z -= dz * k; }
      const cerca = d < 3.2 && dy < 3;
      if (s.texto) M.burbujaCerca(e, g.position, 3.2, `<b>${nombre}:</b> ${s.texto}`);
      let accion = 'idle', vel = 1;
      if (cerca) {   // se detiene y mira a Nato; saluda al llegar
        g.rotation.y += (rumboA(g.position.x, g.position.z, j.pos.x, j.pos.z) - g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI > 0 ? dt * 3 : -dt * 3;
        e.tc = (e.tc || 0) + dt; accion = e.tc < 1.4 ? 'saludar' : s.quien === 'minero' ? 'idle' : 'hablar';
      } else {
        e.tc = 0;
        if (hacia && d < 110) {
          if (espera > 0) espera -= dt;
          else {
            const vx = hacia.x - g.position.x, vz = hacia.z - g.position.z, l = Math.hypot(vx, vz), v = s.quien === 'anciana' ? 0.8 : 1.15;
            if (l < 0.4) { hacia = hacia === B ? A : B; espera = 2 + Math.random() * 3; }
            else {
              const nx = g.position.x + vx / l * v * dt, nz = g.position.z + vz / l * v * dt;
              const h = M.fis.rayo({ x: nx, y: g.position.y + 1.2, z: nz }, { x: 0, y: -1, z: 0 }, 2.6);
              if (!h || Math.abs(h.punto.y - g.position.y) > 0.6) { hacia = hacia === B ? A : B; espera = 1.5; }   // escalón o borde: se devuelve
              else { g.position.set(nx, h.punto.y, nz); g.rotation.y = Math.atan2(vx, vz); accion = 'caminar'; vel = v / 1.3; }
            }
          }
        } else if (s.mira) {   // conversa: alterna hablar y escuchar
          accion = s.quien !== 'minero' && Math.sin(e.t * 0.7 + s.x) > 0.2 ? 'hablar' : 'idle';
        }
      }
      if (d < 45 || !actual) { if (d < 25 || cuadro % 2 === 0) poner(accion, d < 25 ? dt : dt * 2, vel); }
    };
  },
  reliquia(M, L, s) {
    const R = RELIQUIAS[s.id]; if (!R) return;
    if (P && P._relDef !== M.def) { P._relDef = M.def; P.reliquias = new Set(); P.reliquiasTot = 0; }
    if (P) P.reliquiasTot++;
    const g = new THREE.Group(), obj = modeloReliquia(s.id);
    obj.position.y = 0; g.add(obj);
    if (!FABRICA_VIDA._halo) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(170,230,255,0.9)'); gr.addColorStop(0.45, 'rgba(120,200,255,0.3)'); gr.addColorStop(1, 'rgba(100,180,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); FABRICA_VIDA._halo = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
    }
    const halo = new THREE.Sprite(FABRICA_VIDA._halo); halo.scale.set(1.6, 1.6, 1); g.add(halo);
    const y = (s.y ?? M.fis.suelo(s.x, s.z)) + 1.0;
    g.position.set(s.x, y, s.z);
    const e = L.agregar({ tipo: 'reliquia', vivo: true, malla: g, sala: null, x: s.x, y, z: s.z, id: s.id, t: 0 });
    e.act = dt => {
      obj.rotation.y += dt * 1.3; g.position.y = y + Math.sin(M.t * 2 + s.x) * 0.08; halo.material.opacity = 0.5 + Math.sin(M.t * 3) * 0.12;
      if (M.cerca(g.position, 1.35)) {
        L.quitar(e); if (!P) return;
        P.reliquias.add(s.id); P.puntos += 300; M.efecto('apunte'); M.jug.gesto && M.jug.gesto('recoger', 0.55);
        UI.modal(`Reliquia ${P.reliquias.size} de ${P.reliquiasTot} · ${R[0]}`, R[1]);
        if (window.JUEGO) window.JUEGO.modalAbierto = performance.now();
      }
    };
  },
};

Object.assign(FABRICA_VIDA, FABRICA_ANIMALES, FABRICA_GENTE1905);

// objeto chico de cada reliquia (~0,5 m), reconocible
function modeloReliquia(id) {
  const A = Arma();
  const papel = (txt, fondo = '#efe2c0', tinta = '#3a2a18', w = 0.5, h = 0.34) => { const m = rotuloMat(txt, fondo, tinta); A.add(new THREE.PlaneGeometry(w, h), m, 0, 0.1, 0.012); A.add(new THREE.PlaneGeometry(w, h), m, 0, 0.1, -0.012, 0, Math.PI, 0); A.caja(mat(0xd8c9a4), w, h, 0.02, 0, 0.1, 0); };
  switch (id) {
    case 'herradura': A.toro(C.fierro(), 0.2, 0.045, 0, 0.1, 0, 0, 0, Math.PI * 1.6); break;
    case 'muestra': A.add(new THREE.DodecahedronGeometry(0.22), C.mineral(), 0, 0.1, 0); A.add(new THREE.DodecahedronGeometry(0.1), C.cobre(), 0.13, 0.18, 0.1); A.add(new THREE.DodecahedronGeometry(0.08), mat(0xc77b3a, { metal: 0.6, rough: 0.3 }), -0.14, 0.2, 0.06); break;
    case 'carburo': A.cil(mat(0x9a7a3a, { metal: 0.8, rough: 0.3 }), 0.09, 0.1, 0.32, 0, 0, 0, 'y'); A.cil(mat(0x9a7a3a, { metal: 0.8, rough: 0.3 }), 0.07, 0.09, 0.12, 0, 0.22, 0, 'y'); A.add(new THREE.CylinderGeometry(0.16, 0.03, 0.08, 14, 1, true), mat(0xd8d2c0, { metal: 0.9, rough: 0.2 }), 0.1, 0.2, 0, 0, 0, Math.PI / 2); A.toro(C.fierro(), 0.08, 0.01, 0, 0.36, 0); break;
    case 'candil': { const f = mat(0x3a332c, { metal: 0.7, rough: 0.55 });   // N0-FABLE-1611 (A7): candil de fierro colgado de su gancho, con la mecha encendida
      A.cil(f, 0.13, 0.09, 0.06, 0, 0.0, 0, 'y', 16); A.caja(f, 0.16, 0.025, 0.06, 0.15, 0.03, 0, 0, 0, 0.25); A.cil(f, 0.012, 0.012, 0.42, -0.06, 0.2, 0, 'y', 6); A.toro(f, 0.05, 0.01, -0.06, 0.43, 0, 0, Math.PI / 2, Math.PI * 1.4);
      A.bola(mat(0xffb040, { emisivo: 0xff8a20, brillo: 1.6 }), 0.03, 0.22, 0.08, 0, 1, 1.8, 1); break; }
    case 'dinamita': for (let i = 0; i < 3; i++) A.cil(mat(0xb3261e), 0.045, 0.045, 0.36, -0.1 + i * 0.1, 0.1, 0, 'x', 8); A.caja(mat(0xe8dcc0), 0.1, 0.12, 0.33, 0, 0.1, 0); break;
    case 'carpa': A.cil(C.madera(), 0.03, 0.015, 0.5, 0, 0.05, 0, 'y', 6); A.toro(mat(0xd8cba8), 0.06, 0.012, 0, 0.25, 0); break;
    case 'ficha': case 'pension': { const m = rotuloMat(id === 'ficha' ? 'PULPERÍA' : '$ 5', '#c58a3a', '#3a1e08', 128, 128); A.cil(mat(0xc58a3a, { metal: 0.8, rough: 0.35 }), 0.17, 0.17, 0.03, 0, 0.1, 0, 'z', 24); A.add(new THREE.CircleGeometry(0.15, 20), m, 0, 0.1, 0.017); A.add(new THREE.CircleGeometry(0.15, 20), m, 0, 0.1, -0.017, 0, Math.PI, 0); break; }
    case 'topics': papel('TENIENTE TOPICS', '#e9e0c6', '#1c2a50', 0.42, 0.56); break;
    case 'boleto': papel('RANCAGUA ⇄ SEWELL', '#e7c76a', '#3a2a10', 0.5, 0.24); break;
    case 'partitura': papel('♪ BANDA ♪', '#f2ead8', '#1a1a1a', 0.5, 0.36); break;
    case 'entrada': papel('CINE · ENTRADA', '#c94a3a', '#fff3dc', 0.48, 0.22); break;
    case 'biblioteca': papel('BIBLIOTECA', '#9fb7c9', '#14263a', 0.46, 0.3); break;
    case 'hospital': papel('HOSPITAL 157', '#f4f6f0', '#8a1c1c', 0.42, 0.5); break;
    case 'foto': A.caja(C.madera(), 0.5, 0.4, 0.04, 0, 0.1, 0); { const m = rotuloMat('SEWELL', '#8a6a44', '#efe0c0'); A.add(new THREE.PlaneGeometry(0.42, 0.32), m, 0, 0.1, 0.022); A.add(new THREE.PlaneGeometry(0.42, 0.32), m, 0, 0.1, -0.022, 0, Math.PI, 0); } break;
    case 'carretera': papel('CARRETERA DEL COBRE', '#dfe8d0', '#24402a', 0.56, 0.36); break;
    case 'llave': A.toro(mat(0xc9a646, { metal: 0.9, rough: 0.3 }), 0.08, 0.02, 0, 0.22, 0); A.caja(mat(0xc9a646, { metal: 0.9, rough: 0.3 }), 0.035, 0.32, 0.02, 0, 0.0, 0); A.caja(mat(0xc9a646, { metal: 0.9, rough: 0.3 }), 0.09, 0.03, 0.02, 0.05, -0.12, 0); break;
    case 'pala': A.cil(C.madera(), 0.02, 0.02, 0.5, 0, 0.2, 0, 'y', 6); A.caja(C.acero(), 0.24, 0.26, 0.02, 0, -0.12, 0); break;
    case 'casco': case 'bomberos': { const m = mat(id === 'bomberos' ? 0xb3261e : 0xe0b020, { rough: 0.4 }); A.add(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.0, 0); A.cil(m, 0.27, 0.27, 0.02, 0, 0.0, 0, 'y', 20); A.cil(C.acero(), 0.05, 0.05, 0.05, 0, 0.1, 0.19, 'z', 10); break; }
    default: A.caja(mat(0xc58a3a), 0.3, 0.3, 0.3, 0, 0.1, 0);
  }
  const g = A.fin(); g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  if (id === 'muestra') { g.clear(); g.add(mineral([[0, 0.05, 0, 1.1], [0.15, 0.12, 0.08, 0.55, true], [-0.12, 0.1, 0.06, 0.5]], 11)); }   // N1-PUEBLO-VIDA: muestra con la malla de mineral real
  // REV (16-11, revisor de mallas): reliquias con malla aprobada en la utilería: atado de dinamita (`dinamita`, 1,3×) y lámpara de carburo
  // (`carburo`, 1,15×); los cilindros quedan de respaldo
  const RM = { dinamita: [1.3, 0.035], carburo: [1.15, -0.17] }[id];
  if (RM) utilGlb(id).then(m => { if (!m || /[?&]utileria=0/.test(location.search)) return; const resp = g.children.slice(); m.name = 'util:' + id; m.castShadow = false; m.scale.setScalar(RM[0]); m.position.y = RM[1]; g.add(m); for (const o of resp) o.visible = false; });
  return g;
}
