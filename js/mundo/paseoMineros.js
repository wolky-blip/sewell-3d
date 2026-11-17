// N1-PASEO-MINEROS (carril mina, 15-11-2026, pedido de Diego): «a los 4 mineros del paseo en vagoneta les faltan picos, palas y
// animaciones trabajando con ellas». Solo en la galería del paseo (paseoVagoneta.js); la malla compartida del minero no se toca.
// - Herramientas de 1905 hechas en código (mango de madera + fierro, 2 mallas por herramienta): PICOTA de dos puntas, PALA de punta con
//   empuñadura en D, BARRETA de punta de cincel y COMBO (este apoyado en el muro).
// - Animación procedural SOBRE la acción «idle» (respira), independiente de los ejes del esqueleto (como gente1905/banda): cada hueso se gira
//   en el mundo. Caderas bajan y giran con los pies FIJOS (IK de dos huesos en las piernas, el pie recupera su giro), columna se dobla y
//   gira, cabeza mira el trabajo; brazos con IK de dos huesos con la palma como efector. La herramienta se arma DESPUÉS desde las palmas
//   reales (el mango pasa siempre por las dos palmas: nunca flota ni queda al lado de la mano).
// - Trabajos: 2 picando el muro (sube sobre el hombro derecho, golpe acelerado con chispas, polvillo, trozos de roca que caen y sonido),
//   1 paleando mineral del montón al carro (hinca, carga, gira el torso, echa: los trozos vuelan al carro) que SALUDA al paso de la
//   vagoneta con la pala en la izquierda y vuelve a trabajar, 1 con barreta palanqueando una laja al pie del muro (la laja se mece y suelta trozos).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { texMaderaMina, texRoca } from './mina.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const suave = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const PALMA = 0.085;   // muñeca → centro de la palma (mitón de la malla del minero), m

// ---------------------------------------------------------------- materiales y geometría de herramientas
let _MAT = null;
function mats() {
  return _MAT ||= {
    // (con algo de emisivo, como la malla del minero: en la galería casi no llega luz dinámica fuera del farol de la vagoneta)
    madera: new THREE.MeshStandardMaterial({ map: texMaderaMina()[0], color: 0xe8c08a, roughness: 0.62, emissiveMap: texMaderaMina()[0], emissive: 0x8a6a48 }),   // mango gastado por las manos
    fierro: new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide, emissive: 0x2a2724 }),
    roca: new THREE.MeshStandardMaterial({ map: texRoca()[0], color: 0x9a8c7c, roughness: 0.9, emissiveMap: texRoca()[0], emissive: 0x4a4038 }),
  };
}
// color de fierro por vértice: oscuro y oxidado, brillante donde se gasta (filo/puntas): k = 0..1
function pintar(geo, kDe) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const k = Math.max(0, Math.min(1, kDe(v))), n = 0.9 + 0.2 * Math.sin(v.x * 91 + v.y * 57 + v.z * 73);
    c[i * 3] = (0.2 + 0.5 * k) * n; c[i * 3 + 1] = (0.18 + 0.48 * k) * n; c[i * 3 + 2] = (0.16 + 0.46 * k) * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
const sinUV = g => { g.deleteAttribute('uv'); return g; };
const soloPos = g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
// mango torneado: perfil [(radio, y)], sección ovalada (oval = ancho/espesor)
function mango(perfil, oval = 0.8) {
  const g = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 10); g.scale(1, 1, oval); g.computeVertexNormals(); return g;
}
// barra que se afina a lo largo de una curva: pts (Vector3), rad(s) → [ancho, alto]; sección de 'lados' caras (4 = cuadrada)
function barra(pts, rad, lados = 4, giro = Math.PI / 4) {
  const n = pts.length, pos = [], idx = [], ref = V3(1, 0, 0), t = V3(), a = V3(), b = V3();
  for (let i = 0; i < n; i++) {
    t.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
    a.copy(ref).addScaledVector(t, -ref.dot(t)).normalize(); b.crossVectors(t, a);
    const [w, h] = rad(i / (n - 1));
    for (let k = 0; k < lados; k++) { const an = giro + k * 2 * Math.PI / lados; pos.push(...pts[i].clone().addScaledVector(a, Math.cos(an) * w).addScaledVector(b, Math.sin(an) * h).toArray()); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < lados; k++) { const k2 = (k + 1) % lados, A = i * lados + k, B = i * lados + k2, C = A + lados, D = B + lados; idx.push(A, C, B, B, C, D); }
  const ci = n * lados; pos.push(...pts[n - 1].toArray()); for (let k = 0; k < lados; k++) idx.push((n - 1) * lados + k, ci, (n - 1) * lados + (k + 1) % lados);   // punta cerrada
  const ca = ci + 1; pos.push(...pts[0].toArray()); for (let k = 0; k < lados; k++) idx.push(k, (k + 1) % lados, ca);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function herramienta(geoMadera, geoFierro, nombre) {
  const M = mats(), g = new THREE.Group(); g.name = nombre;
  if (geoMadera) g.add(new THREE.Mesh(geoMadera, M.madera));
  if (geoFierro) g.add(new THREE.Mesh(geoFierro, M.fierro));
  g.traverse(o => { o.castShadow = false; o.receiveShadow = false; });
  return g;
}
// Todas las herramientas: eje +Y desde el extremo de las manos (y = 0) hacia el extremo que trabaja; +Z = cara/punta que golpea o carga.
let _GEO = null;
export function geoHerr() {
  if (_GEO) return _GEO;
  // PICOTA: mango de 0,9 m (pomo en la base, más grueso hacia el ojo), cabeza de fierro de dos puntas algo curvas (0,56 m), ojo con collar y cuña
  const pM = mango([[0, 0], [0.021, 0], [0.024, 0.018], [0.019, 0.06], [0.0165, 0.35], [0.019, 0.7], [0.024, 0.83], [0.024, 0.905], [0, 0.905]], 0.78).scale(1.3, 1, 1.3);   // (más grueso: las manos de la serie son mitones grandes)
  const yO = 0.865, brazo = s => { const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push(V3(0, yO - 0.055 * u * u, s * (0.035 + 0.25 * u))); } return pts; };
  const ancho = u => { const w = 0.036 * (1 - u) + 0.006 * u; return [w * 0.85, w * 1.15]; };
  const cab = [barra(brazo(1), ancho), barra(brazo(-1), ancho),
    new THREE.CylinderGeometry(0.044, 0.044, 0.1, 8).translate(0, yO, 0),                       // ojo
    new THREE.BoxGeometry(0.064, 0.115, 0.09).translate(0, yO, 0),                                  // cuerpo de la cabeza
    new THREE.CylinderGeometry(0.036, 0.04, 0.025, 8).translate(0, yO - 0.068, 0),                 // collar bajo el ojo
    new THREE.BoxGeometry(0.008, 0.012, 0.03).translate(0, 0.909, 0)].map(soloPos);               // cuña de fierro en la punta del mango
  const pF = pintar(mergeGeometries(cab), v => (Math.abs(v.z) - 0.18) / 0.11);
  // PALA de punta: empuñadura en D (travesaño + dos mejillas con remaches), cabo de 0,8 m, cubo de fierro y hoja con punta redonda,
  // cóncava, con pisadera arriba y algo de «lift» (la hoja se dobla hacia atrás para quedar plana en el suelo)
  const dM = [mango([[0, 0.15], [0.02, 0.15], [0.022, 0.18], [0.019, 0.3], [0.019, 0.86], [0.022, 0.9], [0, 0.9]], 0.85).scale(1.25, 1, 1.25),
    new THREE.CylinderGeometry(0.017, 0.017, 0.13, 8).rotateZ(Math.PI / 2).translate(0, 0.018, 0),   // travesaño de la D
    barra([V3(0.058, 0.005, 0), V3(0.05, 0.07, 0), V3(0.03, 0.13, 0), V3(0.017, 0.17, 0)], () => [0.011, 0.007], 6, 0),
    barra([V3(-0.058, 0.005, 0), V3(-0.05, 0.07, 0), V3(-0.03, 0.13, 0), V3(-0.017, 0.17, 0)], () => [0.011, 0.007], 6, 0)].map(soloPos);
  const pala = new THREE.BufferGeometry(); {
    const NU = 9, NV = 12, pos = [], idx = [], y0 = 0.96, L = 0.31, lift = Math.tan(0.22);
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const v = j / NV, u = i / NU * 2 - 1, hw = v < 0.5 ? 0.128 : 0.128 * Math.sqrt(Math.max(0, 1 - ((v - 0.5) / 0.52) ** 2));
      pos.push(u * hw, y0 + L * v, -v * L * lift + 0.032 * u * u * (1 - 0.4 * v) - 0.01);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    pala.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pala.setIndex(idx); pala.computeVertexNormals();
  }
  const dF = pintar(mergeGeometries([soloPos(pala),
    soloPos(new THREE.CylinderGeometry(0.03, 0.023, 0.13, 8).scale(1, 1, 0.8).translate(0, 0.9, 0)),       // cubo
    soloPos(new THREE.BoxGeometry(0.2, 0.012, 0.022).translate(0, 0.965, 0.012)),                          // pisadera
    soloPos(new THREE.BoxGeometry(0.03, 0.12, 0.012).translate(0, 0.86, 0.016)),                           // lengüeta del cubo sobre el cabo
    ...[0.03, 0.12].map(y => soloPos(new THREE.SphereGeometry(0.008, 5, 4).translate(0, y, 0.006)))]), v => (v.y - 1.15) / 0.12 + Math.abs(v.x) * 2 - 0.15);
  // BARRETA: barra octogonal de 1,15 m, cabeza algo recalcada arriba, punta de cincel abajo
  const bpts = []; for (let i = 0; i <= 14; i++) bpts.push(V3(0, 1.15 * i / 14, 0));
  const bF = pintar(mergeGeometries([soloPos(barra(bpts, u => u < 0.04 ? [0.027, 0.027] : u > 0.86 ? [0.023 * (1 - (u - 0.86) / 0.14 * 0.9) + 0.003, 0.023 + (u - 0.86) * 0.14] : [0.022, 0.022], 8, 0))]),
    v => v.y > 1.0 ? (v.y - 1.0) / 0.15 : v.y < 0.05 ? 0.4 : 0.05);
  // COMBO: cabeza octogonal de 0,17 m con caras biseladas, mango de 0,8 m
  const cM = mango([[0, 0], [0.021, 0], [0.022, 0.02], [0.018, 0.08], [0.018, 0.7], [0.022, 0.8], [0, 0.8]], 0.8);
  const cF = pintar(mergeGeometries([soloPos(new THREE.CylinderGeometry(0.04, 0.04, 0.17, 8).rotateX(Math.PI / 2).translate(0, 0.76, 0)),
    soloPos(new THREE.CylinderGeometry(0.033, 0.04, 0.012, 8).rotateX(Math.PI / 2).translate(0, 0.76, 0.091)),
    soloPos(new THREE.CylinderGeometry(0.04, 0.033, 0.012, 8).rotateX(Math.PI / 2).translate(0, 0.76, -0.091))]), v => Math.abs(v.z) > 0.08 ? 0.6 : 0.05);
  return (_GEO = { picota: [pM, pF, 0.27 + 0.035, yO], pala: [mergeGeometries(dM), dF], barreta: [null, bF], combo: [cM, cF] });
}
export const ESCALA = { picota: 1.12, pala: 1.1, barreta: 1.0, combo: 1.1 };   // la serie tiene manos y cuerpos grandes: herramientas algo mayores que las reales
export function nuevaHerr(tipo) { const G = geoHerr()[tipo], h = herramienta(G[0], G[1], tipo); h.userData.esc = ESCALA[tipo]; return h; }

// ---------------------------------------------------------------- IK y giros en el mundo (independiente de los ejes del esqueleto)
const _S = V3(), _E = V3(), _W = V3(), _d = V3(), _pn = V3(), _E2 = V3(), _a = V3(), _b = V3(), _T2 = V3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
function girar(bone, desde, hacia) {
  _q.setFromUnitVectors(desde.normalize(), hacia.normalize());
  bone.getWorldQuaternion(_qw); _qw.premultiply(_q); bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_qw)); bone.updateMatrixWorld(true);
}
function rotar(bone, eje, ang) {   // gira el hueso en el mundo alrededor de un eje del mundo (los hijos lo siguen)
  if (!bone || !ang) return;
  _q.setFromAxisAngle(eje, ang); bone.getWorldQuaternion(_qw); _qw.premultiply(_q); bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_qw)); bone.updateMatrixWorld(true);
}
function ik(up, fo, ha, T, polo, palma) {
  _S.setFromMatrixPosition(up.matrixWorld); _E.setFromMatrixPosition(fo.matrixWorld); _W.setFromMatrixPosition(ha.matrixWorld);
  const a = _S.distanceTo(_E), b = _E.distanceTo(_W) + palma;
  const dd = _S.distanceTo(T), d = Math.max(Math.abs(a - b) + 1e-3, Math.min(dd, (a + b) * 0.999));
  _d.copy(T).sub(_S).normalize();
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  _pn.copy(polo).sub(_S); _pn.addScaledVector(_d, -_pn.dot(_d)).normalize();
  _E2.copy(_S).addScaledVector(_d, x).addScaledVector(_pn, h);
  girar(up, _a.copy(_E).sub(_S), _b.copy(_E2).sub(_S));
  _E.setFromMatrixPosition(fo.matrixWorld); _W.setFromMatrixPosition(ha.matrixWorld);
  _T2.copy(_S).addScaledVector(_d, d);
  girar(fo, _a.copy(_W).sub(_E), _b.copy(_T2).sub(_E));
  return dd - d;   // lo que faltó para llegar (m)
}
function palmaDe(H, lado, out) {   // palma real (mundo): muñeca + PALMA en la dirección del antebrazo
  _W.setFromMatrixPosition(H['hand' + lado].matrixWorld); _E.setFromMatrixPosition(H['forearm' + lado].matrixWorld);
  return out.copy(_W).add(_E.sub(_W).negate().normalize().multiplyScalar(PALMA));
}

// ---------------------------------------------------------------- ciclos de trabajo (marco local del minero: +Z adelante, +X su izquierda)
// Cuadros clave: t (0..1), B = extremo de las manos de la herramienta, f = elevación del eje, y = giro del eje, dL/dR = agarres (m desde B),
// cu = flexión del torso, gi = giro del torso, ag = cuánto bajan las caderas, ro = giro de la hoja sobre el eje (pala, para echar).
const CICLOS = {
  picota: { dur: 1.85, k: [
    { t: 0.00, B: [0.0, 0.98, 0.38], f: 0.8, y: 0.0, dL: 0.05, dR: 0.2, cu: 0.4, gi: 0.0, ag: 0.08 },
    { t: 0.09, B: [0.0, 0.99, 0.35], f: 0.86, y: 0.0, dL: 0.05, dR: 0.2, cu: 0.38, gi: 0.0, ag: 0.08 },      // rebote (la punta queda clavada)
    { t: 0.22, B: [-0.05, 1.04, 0.26], f: 1.15, y: 0.1, dL: 0.05, dR: 0.26, cu: 0.28, gi: -0.1, ag: 0.05 },  // la arranca
    { t: 0.58, B: [-0.2, 1.4, 0.3], f: 2.15, y: 0.75, dL: 0.05, dR: 0.42, cu: -0.04, gi: -0.42, ag: 0.0 },  // arriba, sobre el hombro derecho
    { t: 0.70, B: [-0.22, 1.44, 0.27], f: 2.3, y: 0.8, dL: 0.05, dR: 0.44, cu: -0.06, gi: -0.46, ag: 0.0, acel: 1 },
    { t: 0.87, B: [-0.08, 1.22, 0.36], f: 1.45, y: 0.25, dL: 0.05, dR: 0.3, cu: 0.2, gi: -0.18, ag: 0.04 },
    { t: 1.00, B: [0.0, 0.98, 0.38], f: 0.8, y: 0.0, dL: 0.05, dR: 0.2, cu: 0.4, gi: 0.0, ag: 0.08 }] },
  // la pala: B = la D (mano derecha); Y = giro del cuerpo entero hacia el montón (0) o el carro (1) → se reemplaza por los ángulos reales
  pala: { dur: 2.9, k: [
    { t: 0.00, B: [-0.05, 0.98, 0.12], f: -0.5, y: 0.35, dL: 0.36, dR: 0.03, cu: 0.42, gi: 0, ag: 0.16, Y: 0, ro: 0 },
    { t: 0.13, B: [-0.04, 0.9, 0.3], f: -0.5, y: 0.35, dL: 0.36, dR: 0.03, cu: 0.52, gi: 0, ag: 0.2, Y: 0, ro: 0 },       // hinca en el montón
    { t: 0.32, B: [-0.05, 1.0, 0.16], f: -0.12, y: 0.32, dL: 0.36, dR: 0.03, cu: 0.3, gi: 0, ag: 0.1, Y: 0.1, ro: 0 },   // levanta la carga
    { t: 0.55, B: [-0.05, 1.05, 0.2], f: -0.02, y: 0.32, dL: 0.36, dR: 0.03, cu: 0.2, gi: 0, ag: 0.05, Y: 1, ro: 0 },    // gira hacia el carro
    { t: 0.64, B: [-0.05, 1.12, 0.3], f: 0.1, y: 0.3, dL: 0.37, dR: 0.03, cu: 0.14, gi: 0, ag: 0.04, Y: 1, ro: 0.1 },    // empuja
    { t: 0.72, B: [-0.05, 1.12, 0.31], f: 0.12, y: 0.3, dL: 0.37, dR: 0.03, cu: 0.14, gi: 0, ag: 0.04, Y: 1, ro: 1.15 },  // vuelca la hoja
    { t: 0.82, B: [-0.05, 1.04, 0.2], f: -0.1, y: 0.32, dL: 0.36, dR: 0.03, cu: 0.2, gi: 0, ag: 0.06, Y: 0.85, ro: 0.4 },
    { t: 1.00, B: [-0.05, 0.98, 0.12], f: -0.5, y: 0.35, dL: 0.36, dR: 0.03, cu: 0.42, gi: 0, ag: 0.16, Y: 0, ro: 0 }] },
  // barreta: la punta queda calzada bajo la laja (P) y las manos (arriba del eje) bajan empujando (h = alto de las manos)
  barreta: { dur: 2.3, k: [
    { t: 0.00, h: 1.0, x: 0.0, cu: 0.42, gi: 0, ag: 0.06 },
    { t: 0.38, h: 0.74, x: 0.0, cu: 0.62, gi: 0.04, ag: 0.17 },    // empuja con el peso del cuerpo
    { t: 0.5, h: 0.73, x: 0.0, cu: 0.63, gi: 0.04, ag: 0.17 },
    { t: 0.78, h: 1.02, x: -0.01, cu: 0.4, gi: 0, ag: 0.05 },
    { t: 1.00, h: 1.0, x: 0.0, cu: 0.42, gi: 0, ag: 0.06 }] },
};
const CAMPOS = ['f', 'y', 'dL', 'dR', 'cu', 'gi', 'ag', 'Y', 'ro', 'h', 'x'];
function muestra(ciclo, u, out) {
  const K = ciclo.k; let i = 0; while (i < K.length - 2 && u > K[i + 1].t) i++;
  const A = K[i], B = K[i + 1]; let s = (u - A.t) / (B.t - A.t); s = Math.max(0, Math.min(1, s));
  s = A.acel ? s * s : A.lin ? s : suave(s);   // la bajada de la picota acelera
  for (const c of CAMPOS) if (A[c] != null) out[c] = A[c] + (B[c] - A[c]) * s;
  if (A.B) { out.B = out.B || V3(); out.B.set(A.B[0] + (B.B[0] - A.B[0]) * s, A.B[1] + (B.B[1] - A.B[1]) * s, A.B[2] + (B.B[2] - A.B[2]) * s); }
  return out;
}
const ejeDe = (f, y, out) => out.set(Math.cos(f) * Math.sin(y), Math.sin(f), Math.cos(f) * Math.cos(y));
const normDe = (f, y, out) => out.set(-Math.sin(f) * Math.sin(y), Math.cos(f), -Math.sin(f) * Math.cos(y));   // d(eje)/df

// ---------------------------------------------------------------- armado en la galería
// ctx: { M, grp, ponerEn(ds, a) → { p, r, t } (p en el piso), color(p), sGal, mallaPersona, escala, matBase }
export function armarMineros(ctx) {
  const { grp, ponerEn, sGal } = ctx, Mt = mats(), mineros = [];
  const malla = [];   // mallas de roca del túnel (para medir la distancia al muro)
  grp.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position.count > 2000) malla.push(o); });
  const rc = new THREE.Raycaster(); rc.far = 4;
  const alMuro = (p, dir, alto) => { rc.set(p.clone().add(V3(0, alto, 0)), dir); const h = rc.intersectObjects(malla, false)[0]; return h ? h.distance : 1.6; };
  // propios: montón para la pala (junto al carro), laja al pie del muro para la barreta, herramientas de repuesto apoyadas
  const roca = (rad, p, esc = [1, 1, 1], semilla = 0) => {
    const g = new THREE.DodecahedronGeometry(rad, 1), pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), n = 1 + 0.16 * Math.sin(x * 23 + semilla) * Math.cos(z * 19 + y * 7); pa.setXYZ(i, x * n, y * n, z * n); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, Mt.roca); m.scale.set(...esc); m.position.copy(p); grp.add(m); return m;
  };
  const DEF = [
    { ds: 3.6, a: -2.35, hace: 'picota', fase: 0.0, diag: 0.75 },
    { ds: 6.75, a: 1.95, hace: 'pala', fase: 0.35, saluda: true },
    { ds: 10.4, a: -2.35, hace: 'picota', fase: 0.55, diag: 0.6 },
    { ds: 12.7, a: 2.3, hace: 'barreta', fase: 0.2, diag: 0.7 },
  ];
  // montón para la pala (el carro de mineral está en ds 5,2, a 2,55: el minero queda entre el montón y el carro)
  const monP = ponerEn(7.75, 2.8).p, carroP = ponerEn(5.2, 2.55).p;
  if (ctx.monton) ctx.monton(7.75, 2.8, 0.7);
  for (const D of DEF) {
    let { p, r, t } = ponerEn(D.ds, D.a);
    // de frente al muro pero girados hacia la vagoneta que llega (por -t): desde la vagoneta se ve el golpe de perfil, no la espalda
    let mira = r.clone().multiplyScalar(Math.sign(D.a)).addScaledVector(t, -(D.diag ?? 0)).normalize();
    let yawMon = 0, yawCar = 0;
    if (D.hace === 'pala') {   // mira la bisectriz entre el montón y el carro
      const dm = monP.clone().sub(p).setY(0).normalize(), dc = carroP.clone().sub(p).setY(0).normalize();
      mira = dm.clone().add(dc).normalize();
    }
    // distancia al muro: la punta de la picota llega a ~1,24 m (a 1,4 m de alto, a la altura del pecho); la barreta calza a 1,12 m (a 0,3 m)
    if (D.hace === 'picota' || D.hace === 'barreta') {
      const quiero = D.hace === 'picota' ? 1.25 : 1.18, alto = D.hace === 'picota' ? 1.41 : 0.35;
      const d = alMuro(p, mira, alto); p = p.clone().addScaledVector(mira, Math.max(-0.6, Math.min(0.6, d - quiero)));
    }
    const m = ctx.mallaPersona({ cuerpo: 0x7a5236, piernas: 0x3b3a36, casco: 0xf0c419 }, ctx.escala, 'p_minero', { malla: true });
    m.position.copy(p); m.rotation.y = Math.atan2(mira.x, mira.z); grp.add(m);
    if (D.hace === 'pala') {   // ángulos (marco local) del montón y del carro
      const X = V3(Math.cos(m.rotation.y), 0, -Math.sin(m.rotation.y)), Z = mira;
      const ang = w => { const d = w.clone().sub(p); return Math.atan2(d.dot(X), d.dot(Z)); };
      yawMon = ang(monP); yawCar = ang(carroP);
    }
    const herr = nuevaHerr(D.hace); herr.matrixAutoUpdate = false; herr.visible = false; m.add(herr);
    const q = { m, ry0: m.rotation.y, p0: p.clone(), hace: D.hace, saluda: !!D.saluda, anim: null, H: {}, s: sGal + D.ds, u: D.fase, herr, yawMon, yawCar, w: 0, k: {}, errIK: 0, piso: p.y };
    if (D.hace === 'pala') {   // carga de mineral sobre la hoja
      q.carga = new THREE.Group(); for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035 + 0.012 * (i % 3), 0), Mt.roca); c.position.set((i % 3 - 1) * 0.06, 1.06 + Math.floor(i / 3) * 0.08, 0.035 + (i % 2) * 0.012); c.rotation.set(i, i * 2, 0); q.carga.add(c); }
      q.carga.visible = false; herr.add(q.carga);
    }
    if (D.hace === 'barreta') {   // laja suelta al pie del muro donde calza la punta
      q.P = V3(0.0, 0.3, 1.12);
      const w = q.P.clone().add(V3(0, 0.12, 0.2)).applyAxisAngle(V3(0, 1, 0), m.rotation.y).add(p);
      q.laja = roca(0.26, w, [1.25, 0.72, 0.8], 3); q.laja.rotation.y = m.rotation.y; q.laja0 = q.laja.quaternion.clone();
      q.nEmpuje = 0;
    }
    m.traverse(o2 => { if (o2.userData.mallaPromesa) { o2.userData.manejada = true; o2.userData.mallaPromesa.then(rr => {
      q.anim = rr.anim; rr.anim.tocar('idle', { reiniciar: true }); rr.anim.actualizar(D.fase * 2);
      rr.escena.traverse(x => { if (x.isBone) q.H[x.name.replace('.', '')] = x; });
      q.rest = []; rr.escena.traverse(x => { if (x.isBone) q.rest.push([x, x.position.clone(), x.quaternion.clone()]); });
      herr.visible = true;
    }); } });
    mineros.push(q);
  }
  // herramientas de repuesto apoyadas en el muro / tiradas (reemplazan las palas de cajas de antes)
  const apoyar = (tipo, ds, a, giro = 0) => {   // el extremo de las manos contra el muro, el que trabaja en el suelo
    const { p, r } = ponerEn(ds, a), h = nuevaHerr(tipo), lado = r.clone().multiplyScalar(Math.sign(a)), L = { pala: 1.24, combo: 0.84, picota: 0.95 }[tipo] * h.userData.esc; h.scale.setScalar(h.userData.esc);
    const dW = Math.min(L * 0.5, Math.max(0.15, alMuro(p, lado, 0.9) - 0.03)), Pt = p.clone().addScaledVector(lado, dW).add(V3(0, Math.sqrt(L * L - dW * dW), 0));
    const Y = p.clone().sub(Pt).normalize(), Z = lado.clone().negate().applyAxisAngle(Y, giro); Z.addScaledVector(Y, -Z.dot(Y)).normalize();
    h.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3().crossVectors(Y, Z), Y, Z)); h.position.copy(Pt); grp.add(h); return h;
  };
  apoyar('pala', 4.6, -3.0, 0.0);
  apoyar('combo', 8.1, -3.0, 1.2);
  apoyar('pala', 13.6, 3.0, 0.3);
  // trozos de roca que caen (picota, barreta) o vuelan al carro (pala) y polvillo
  const NT = 40, trozos = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.045, 0), Mt.roca, NT);
  trozos.instanceMatrix.setUsage(THREE.DynamicDrawUsage); trozos.frustumCulled = false; trozos.castShadow = false; grp.add(trozos);
  const T = { n: NT, p: new Float32Array(NT * 3), v: new Float32Array(NT * 3), vida: new Float32Array(NT), esc: new Float32Array(NT), giro: new Float32Array(NT * 3), piso: new Float32Array(NT), quieto: new Uint8Array(NT), i: 0 };
  const _m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _qq = new THREE.Quaternion(), _sc = V3(), _pp = V3();
  for (let i = 0; i < NT; i++) { _m4.makeScale(0, 0, 0); trozos.setMatrixAt(i, _m4); }
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const texPolvo = new THREE.CanvasTexture(cv), polvo = [];
  for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPolvo, color: 0x8a7a66, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; grp.add(s); polvo.push({ s, vida: 0, v: V3() }); }
  const efectos = {
    trozo(p, v, esc, piso) { const i = T.i = (T.i + 1) % T.n; T.p.set([p.x, p.y, p.z], i * 3); T.v.set([v.x, v.y, v.z], i * 3); T.vida[i] = 4 + Math.random() * 2; T.esc[i] = esc; T.piso[i] = piso; T.quieto[i] = 0; T.giro.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3); },
    polvo(p, k = 1) { const q = polvo.find(x => x.vida <= 0) || polvo[0]; q.vida = 1.4; q.k = k; q.s.position.copy(p); q.v.set((Math.random() - 0.5) * 0.3, 0.12 + Math.random() * 0.15, (Math.random() - 0.5) * 0.3); q.s.visible = true; },
    actualizar(dt) {
      for (let i = 0; i < T.n; i++) {
        if (T.vida[i] <= 0) continue;
        T.vida[i] -= dt; const j = i * 3;
        if (!T.quieto[i]) {
          T.v[j + 1] -= 9.8 * dt; for (let c = 0; c < 3; c++) T.p[j + c] += T.v[j + c] * dt;
          if (T.p[j + 1] < T.piso[i] + T.esc[i] * 0.04) { T.p[j + 1] = T.piso[i] + T.esc[i] * 0.04; if (Math.abs(T.v[j + 1]) > 1.2) { T.v[j + 1] *= -0.3; T.v[j] *= 0.4; T.v[j + 2] *= 0.4; } else T.quieto[i] = 1; }
          for (let c = 0; c < 3; c++) T.giro[j + c] += dt * 7;
        }
        const s = T.esc[i] * Math.min(1, T.vida[i] / 0.8);
        _e.set(T.giro[j], T.giro[j + 1], T.giro[j + 2]); _qq.setFromEuler(_e); _sc.setScalar(Math.max(0, s));
        _m4.compose(_pp.set(T.p[j], T.p[j + 1], T.p[j + 2]), _qq, _sc); trozos.setMatrixAt(i, _m4);
      }
      trozos.instanceMatrix.needsUpdate = true;
      for (const q of polvo) {
        if (q.vida <= 0) continue; q.vida -= dt;
        if (q.vida <= 0) { q.s.visible = false; continue; }
        const u = 1 - q.vida / 1.4; q.s.position.addScaledVector(q.v, dt); q.s.scale.setScalar((0.25 + 0.75 * u) * q.k); q.s.material.opacity = 0.42 * Math.sin(Math.PI * Math.min(1, u * 1.3)) * (1 - u);
      }
    },
  };
  return { mineros, efectos };
}

// ---------------------------------------------------------------- pose por cuadro
const _up = V3(), _X = V3(), _Z = V3(), _B = V3(), _ax = V3(), _n = V3(), _pL = V3(), _pR = V3(), _t1 = V3(), _t2 = V3(), _pol = V3(), _inv = new THREE.Matrix4(),
  _qf = { L: new THREE.Quaternion(), R: new THREE.Quaternion() }, _pf = { L: V3(), R: V3() }, _mb = new THREE.Matrix4(), _Yb = V3(), _Xb = V3(), _Zb = V3(), _ow = V3();
const aMundo = (m, v, out) => out.copy(v).applyMatrix4(m.matrixWorld);
const dirMundo = (m, v, out) => out.copy(v).transformDirection(m.matrixWorld);
function lado(q, nombre) {   // 'L' = su izquierda (+X local) según la posición real del hueso (no por el nombre)
  if (q.izq) return nombre === 'L' ? q.izq : q.izq === 'L' ? 'R' : 'L';
  q.m.updateMatrixWorld(true); _inv.copy(q.m.matrixWorld).invert();
  const x = q.H.uparmL.getWorldPosition(_t1).applyMatrix4(_inv).x; q.izq = x > 0 ? 'L' : 'R';
  return lado(q, nombre);
}
// pose: { B, ax, n (locales), dL, dR, cu, gi, ag, ca (cadera gira), mira (Vector3 local o null), saludo (0..1), ola }
function posar(q, P, dt) {
  const { m, H } = q;
  for (const [b, p, r] of q.rest) { b.position.copy(p); b.quaternion.copy(r); }
  q.anim.actualizar(dt);
  m.updateMatrixWorld(true); _inv.copy(m.matrixWorld).invert();
  const L = lado(q, 'L'), R = lado(q, 'R');
  dirMundo(m, _up.set(0, 1, 0), _up);
  // pies fijos: se guardan antes de mover caderas
  for (const s of [L, R]) { H['foot' + s].getWorldPosition(_pf[s]); H['foot' + s].getWorldQuaternion(_qf[s]); }
  // caderas: bajan (rodillas) y giran un poco con el torso
  const hp = H.hips; hp.getWorldPosition(_t1).addScaledVector(_up, -P.ag); hp.position.copy(hp.parent.worldToLocal(_t1)); hp.updateMatrixWorld(true);
  rotar(hp, _up, P.ca);
  dirMundo(m, _X.set(Math.cos(P.ca), 0, -Math.sin(P.ca)), _X); rotar(hp, _X, P.cu * 0.45);   // bisagra de cadera (las piernas las corrige la IK)
  for (const s of [L, R]) {
    const sg = s === L ? 1 : -1;
    aMundo(m, _t2.set(0, 0, 0), _t2); _inv.copy(m.matrixWorld).invert();
    const fl = _pf[s].clone().applyMatrix4(_inv);
    aMundo(m, _pol.set(fl.x + sg * 0.05, 0.55, fl.z + 0.7), _pol);
    ik(H['thigh' + s], H['shin' + s], H['foot' + s], _pf[s], _pol, 0);
    const f = H['foot' + s]; f.parent.getWorldQuaternion(_qp); f.quaternion.copy(_qp.invert().multiply(_qf[s])); f.updateMatrixWorld(true);
  }
  // columna: giro (repartido) y flexión hacia adelante alrededor del eje lateral ya girado
  const giroT = P.gi - P.ca;
  rotar(H.spine, _up, giroT * 0.45); rotar(H.chest, _up, giroT * 0.55);
  dirMundo(m, _X.set(Math.cos(P.gi), 0, -Math.sin(P.gi)), _X);
  rotar(H.spine, _X, P.cu * 0.4); rotar(H.chest, _X, P.cu * 0.3);
  // cabeza: compensa media flexión y mira hacia el trabajo (o la vagoneta)
  let my = 0, mp = -P.cu * 0.7;
  if (P.mira) { my = Math.max(-0.9, Math.min(0.9, Math.atan2(P.mira.x, P.mira.z) - P.gi)); mp += Math.max(-0.5, Math.min(0.4, -Math.atan2(P.mira.y - 1.6, Math.hypot(P.mira.x, P.mira.z)))) * 0.6; }
  rotar(H.neck, _up, my * 0.6); rotar(H.head, _up, my * 0.4);
  dirMundo(m, _X.set(Math.cos(P.gi + my), 0, -Math.sin(P.gi + my)), _X); rotar(H.head, _X, mp);
  // brazos: palmas a los agarres
  q.errIK = 0;
  const brazo = (s, objetivoLocal, polo) => {
    aMundo(m, objetivoLocal, _t1);
    H['uparm' + s].getWorldPosition(_t2); aMundo(m, polo, _pol); _pol.add(_t2).sub(aMundo(m, _ow.set(0, 0, 0), _ow));
    const er = ik(H['uparm' + s], H['forearm' + s], H['hand' + s], _t1, _pol.clone(), PALMA); q.errIK = Math.max(q.errIK, er); q['err' + (s === L ? 'I' : 'D')] = er;
  };
  _pL.copy(P.B).addScaledVector(P.ax, P.dL);
  brazo(L, _pL, _t1.set(0.55, -0.6, -0.25).clone());
  if (P.ola != null) _pR.copy(P.ola); else _pR.copy(P.B).addScaledVector(P.ax, P.dR);
  brazo(R, _pR, (P.ola != null ? _t1.set(-0.9, -0.2, 0.1) : _t1.set(-0.55, -0.6, -0.25)).clone());
  // herramienta desde las palmas reales (marco local del minero)
  const pl = palmaDe(H, L, V3()).applyMatrix4(_inv), pr = palmaDe(H, R, V3()).applyMatrix4(_inv);
  if (P.unaMano < 1) {
    // con las manos juntas (< 0,3 m) el eje medido entre palmas es inestable: manda el eje deseado, anclado en la palma izquierda
    _ax.copy(P.dR > P.dL ? pr.clone().sub(pl) : pl.clone().sub(pr)).normalize();
    _ax.lerp(P.ax, 1 - suave((Math.abs(P.dR - P.dL) - 0.12) / 0.25)).normalize();
    if (P.unaMano > 0) _ax.lerp(P.ax2, P.unaMano).normalize();
  } else _ax.copy(P.ax2);
  _B.copy(pl).addScaledVector(_ax, -P.dL);
  _n.copy(P.n).addScaledVector(_ax, -P.n.dot(_ax)).normalize();
  if (P.ro) _n.applyAxisAngle(_ax, P.ro);
  _Yb.copy(_ax); _Zb.copy(_n); _Xb.crossVectors(_Yb, _Zb).normalize(); _Zb.crossVectors(_Xb, _Yb);
  _mb.makeBasis(_Xb, _Yb, _Zb).scale(_ow.setScalar(q.herr.userData.esc)).setPosition(_B); q.herr.matrix.copy(_mb); q.herr.matrixWorldNeedsUpdate = true;
}

// ---------------------------------------------------------------- cada cuadro (llamado desde paseoCuadro con la posición de la vagoneta)
const _P = { B: V3(), ax: V3(), n: V3(), ax2: V3(), ola: null, mira: null }, _k = {}, _vag = V3(), _ola = V3(), _mira = V3(), _tip = V3(), _vv = V3();
export function animarMineros(PS, e, dt, ctx) {
  const { mineros, efectos } = PS, cam = ctx.cam, son = ctx.sonido;
  for (const q of mineros) {
    if (!q.anim || !q.rest || Math.abs(q.s - e.s) > 45) continue;
    const C = CICLOS[q.hace], u0 = q.u; q.u = q.qcU != null ? q.qcU : (q.u + dt / C.dur) % 1; const vuelta = q.qcU == null && q.u < u0;   // qcU: fase fija (pruebas)
    const k = muestra(C, q.u, _k), P = _P;
    P.ola = null; P.mira = null; P.unaMano = 0; P.ro = 0;
    if (q.hace === 'picota') {
      P.B.copy(k.B); ejeDe(k.f, k.y, P.ax); normDe(k.f, k.y, P.n).negate();   // la punta de adelante (+Z) mira hacia el golpe
      Object.assign(P, { dL: k.dL, dR: k.dR, cu: k.cu, gi: k.gi, ag: k.ag, ca: k.gi * 0.3 });
      P.mira = _mira.set(0, 1.55, 1.1);
    } else if (q.hace === 'pala') {
      const Y = q.yawMon + (q.yawCar - q.yawMon) * k.Y;   // todo el cuerpo hacia el montón o el carro
      P.B.copy(k.B).applyAxisAngle(_up.set(0, 1, 0), Y); ejeDe(k.f, k.y + Y, P.ax); normDe(k.f, k.y + Y, P.n);
      Object.assign(P, { dL: k.dL, dR: k.dR, cu: k.cu, gi: Y * 0.85, ag: k.ag, ca: Y * 0.3, ro: k.ro });
      P.mira = _mira.set(Math.sin(Y) * 1.3, 0.5, Math.cos(Y) * 1.3);
      q.carga.visible = q.u > 0.15 && q.u < 0.68;
    } else {   // barreta
      const hz = Math.sqrt(Math.max(0.01, 1.15 * 1.15 - (k.h - q.P.y) ** 2));
      P.B.set(k.x, k.h, q.P.z - hz); P.ax.copy(q.P).sub(P.B).normalize(); P.n.set(0, 1, 0);
      Object.assign(P, { dL: 0.2, dR: 0.04, cu: k.cu, gi: k.gi, ag: k.ag, ca: 0 });
      P.mira = _mira.copy(q.P);
      const emp = Math.max(0, (1.0 - k.h) / 0.26);   // la laja se levanta con el empuje
      q.laja.quaternion.copy(q.laja0); q.laja.rotateX(-0.07 * emp);
    }
    // saludo: la vagoneta se acerca → suelta la pala con la derecha (queda en la izquierda, parada) y saluda; luego vuelve
    if (q.saluda) {
      const cerca = q.s - e.s < 15 && q.s - e.s > -5;
      q.w += ((cerca ? 1 : 0) - q.w) * Math.min(1, dt * (cerca ? 3.2 : 1.8));
      if (q.w <= 0.002 && q.m.rotation.y !== q.ry0) q.m.rotation.y = q.ry0;
      if (q.w > 0.002) {
        const w = suave(q.w);
        // gira el cuerpo entero (pivota sobre los pies) hacia la vagoneta; el torso y la cabeza hacen el resto
        let dA = Math.atan2(ctx.vag.x - q.p0.x, ctx.vag.z - q.p0.z) - q.ry0; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
        q.m.rotation.y = q.ry0 + w * Math.max(-2.6, Math.min(2.6, dA)) * 0.75;
        q.m.updateMatrixWorld(true); _inv.copy(q.m.matrixWorld).invert();
        const vl = _vag.copy(ctx.vag).applyMatrix4(_inv), yv = Math.max(-1.3, Math.min(1.3, Math.atan2(vl.x, vl.z)));
        // pala parada a su izquierda, la D en la mano izquierda; la derecha en alto, moviéndose
        P.B.lerp(_t1.set(0.5, 1.2, 0.3), w); P.ax2.set(0.1, -1, 0.08).normalize(); P.n.lerp(_t2.set(0, 0, 1), w).normalize();
        P.dL = P.dL * (1 - w); P.unaMano = w;
        P.ax.lerp(P.ax2, w).normalize();
        const ola = Math.sin(TIEMPO_OLA(q, dt) * 2 * Math.PI * 1.9);
        _ola.set(-0.36 + 0.1 * ola, 1.86, 0.24).applyAxisAngle(_up.set(0, 1, 0), yv * 0.5);
        const pr = _t2.copy(P.B).addScaledVector(P.ax, P.dR);
        P.ola = w >= 0.999 ? _ola : pr.lerp(_ola, w).clone();
        P.cu *= 1 - w; P.ag *= 1 - w; P.ro *= 1 - w; P.gi = P.gi * (1 - w) + yv * 0.55 * w; P.ca *= 1 - w;
        P.mira = _mira.lerp(vl.clone().setY(1.3), w);
        q.carga.visible = q.carga.visible && w < 0.3;
        if (q.w > 0.5) q.u = u0;   // el trabajo se congela mientras saluda (retoma donde quedó)
      }
    }
    if (P.unaMano === 0) P.ax2.copy(P.ax);
    posar(q, P, dt);
    // eventos: golpe de picota (vuelta del ciclo), pala que echa, barreta que suelta trozos
    const dCam = cam ? cam.position.distanceTo(q.m.position) : 10, vol = 1 / (1 + dCam * dCam / 30);
    q.herr.updateMatrixWorld(true);
    if (q.hace === 'picota' && vuelta) {
      _tip.set(0, 0.865 - 0.055, 0.035 + 0.25).applyMatrix4(q.herr.matrixWorld);
      _vv.set(0, 0, 1).transformDirection(q.m.matrixWorld);   // hacia el muro
      const chispa = Math.random() < 0.7;
      if (chispa && ctx.chispa) for (let i = 0; i < 9; i++) ctx.chispa(_tip, _vv.clone().multiplyScalar(-(0.6 + Math.random() * 1.8)).add(V3((Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 1.8, (Math.random() - 0.5) * 1.6)));
      efectos.polvo(_tip.clone().addScaledVector(_vv, -0.08), 0.8);
      const nT = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < nT; i++) efectos.trozo(_tip.clone().addScaledVector(_vv, -0.06), _vv.clone().multiplyScalar(-(0.3 + Math.random() * 0.6)).add(V3((Math.random() - 0.5) * 0.6, 0.4 * Math.random(), (Math.random() - 0.5) * 0.6)), 0.5 + Math.random() * 0.7, q.piso);
      if (son && vol > 0.03) { son.golpe(1900 + Math.random() * 500, 900, 0.1, 0.06 * vol, 'square', 2800, 0.1 * vol); son.golpe(150, 70, 0.14, 0.12 * vol, 'triangle', 500, 0.08 * vol); if (chispa) setTimeout(() => son.golpe(0, 0, 0.05, 0, 'square', 6200, 0.03 * vol), 20); }
    }
    if (q.hace === 'pala' && u0 < 0.68 && q.u >= 0.68 && q.w < 0.3) {   // los trozos vuelan de la hoja al carro
      const blade = V3(0, 1.1, 0.03).applyMatrix4(q.herr.matrixWorld), dst = ctx.carro.clone().add(V3(0, 0.55, 0));
      for (let i = 0; i < 5; i++) { const tv = 0.45, d = dst.clone().add(V3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.7)).sub(blade); efectos.trozo(blade.clone().add(V3((Math.random() - 0.5) * 0.1, 0.03, (Math.random() - 0.5) * 0.1)), V3(d.x / tv, d.y / tv + 4.9 * tv, d.z / tv), 0.7 + Math.random() * 0.5, dst.y - 0.08); }
      efectos.polvo(dst.clone().add(V3(0, 0.1, 0)), 0.9);
      if (son && vol > 0.03) { son.golpe(0, 0, 0.25, 0, 'square', 1200, 0.07 * vol); setTimeout(() => son.golpe(120, 60, 0.12, 0.07 * vol, 'triangle', 700, 0.06 * vol), 320); }
    }
    if (q.hace === 'pala' && u0 < 0.13 && q.u >= 0.13 && q.w < 0.3 && son && vol > 0.03) son.golpe(0, 0, 0.18, 0, 'square', 2200, 0.06 * vol);   // la hoja entra al mineral (raspado)
    if (q.hace === 'barreta' && u0 < 0.38 && q.u >= 0.38) {
      q.nEmpuje++;
      const w = q.P.clone().add(V3(0, 0.1, 0.05)).applyMatrix4(q.m.matrixWorld);
      if (son && vol > 0.03) son.golpe(320, 180, 0.12, 0.05 * vol, 'triangle', 1500, 0.05 * vol);
      if (q.nEmpuje % 3 === 0) {
        _vv.set(0, 0, -1).transformDirection(q.m.matrixWorld);
        for (let i = 0; i < 3; i++) efectos.trozo(w.clone().add(V3(0, 0.15, 0)), _vv.clone().multiplyScalar(0.4 + Math.random() * 0.5).add(V3((Math.random() - 0.5) * 0.5, 0.6 + Math.random(), (Math.random() - 0.5) * 0.5)), 0.6 + Math.random() * 0.6, q.piso);
        efectos.polvo(w, 0.9);
        if (son && vol > 0.03) son.golpe(90, 50, 0.25, 0.1 * vol, 'triangle', 400, 0.08 * vol);
      }
    }
  }
  efectos.actualizar(dt);
}
function TIEMPO_OLA(q, dt) { q.tOla = (q.tOla || 0) + dt; return q.tOla; }
// para las pruebas: error de IK (m que faltaron a cada mano) por minero
export function errIK(PS) { return PS.mineros.map(q => +q.errIK.toFixed(3)); }
