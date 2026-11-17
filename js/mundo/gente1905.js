// N1-PUEBLO-VIDA (carril vida, 15-11-2026). Pedido de Diego: «reemplazar a los mineros NPC que no son enemigos por NPC que
// trabajaban en la época, con sus familias, con mulas y yuntas de bueyes». Gente de 1905 hecha con las MALLAS de personajes que ya
// existen (vecina, anciana, doliente_minero, doliente_mujer: TRELLIS + esqueleto, acciones idle/saludar/hablar/caminar/duelo/entregar)
// más ropa y utensilios de la época modelados en código y colgados de sus huesos: chupalla de paja, sombrero de fieltro, manta
// (poncho) de lana a listas, delantal, balde de madera, bastón, aro de niño. Los tintes de ropa son por copia (material clonado).
// persona1905(M, tipo) → { g, alto, nombre, listo (promesa), poner(accion, dt, vel), mano() }
import * as THREE from 'three';
import { personajeSplat } from '../juego/jugador.js';
import { mat } from './construir.js';
import { texMat, uvPieza } from './texFaena.js';   // TEX (16-11): banco de madera con vetas
import { piezaGrupo, precargarUtileria } from './utileria.js';   // REV (16-11): balde, batea y fogón con la malla aprobada de la utilería

// tipos: malla base, alto (m), ropa y nombre para la burbuja
export const TIPOS_1905 = {
  arriero:   { base: 'doliente_minero', alto: 1.70, gorro: 'chupalla', manta: [0x8a3a22, 0x2a1d16, 0xd8b070], nombre: 'Arriero' },
  carretero: { base: 'doliente_minero', alto: 1.72, gorro: 'fieltro', manta: [0x5a4a3a, 0x1e1a16, 0xb89a62], baston: 'picana', nombre: 'Carretero' },
  campesino: { base: 'doliente_minero', alto: 1.68, gorro: 'chupalla', tinte: 0xc8b8a0, nombre: 'Peón' },
  anciano:   { base: 'doliente_minero', alto: 1.62, gorro: 'fieltro', manta: [0x6a6a5a, 0x2a2a24, 0xc0b090], baston: 'baston', tinte: 0xa8a8a8, nombre: 'Don Ruperto' },
  lavandera: { base: 'vecina', alto: 1.57, delantal: 0xe8e0cc, nombre: 'Lavandera' },
  aguatera:  { base: 'doliente_mujer', alto: 1.58, balde: true, tinte: 0x9a7a6a, nombre: 'Vecina' },
  cocinera:  { base: 'anciana', alto: 1.52, delantal: 0xd8cfb8, nombre: 'Doña Rosa' },
  madre:     { base: 'vecina', alto: 1.57, tinte: 0xa89a8a, nombre: 'Vecina' },
  nino:      { base: 'doliente_minero', alto: 1.12, gorro: 'chupalla', tinte: 0xd0c4b0, nombre: 'Niño' },
  nina:      { base: 'vecina', alto: 1.05, tinte: 0xc0a0a8, nombre: 'Niña' },
};

const _v = new THREE.Vector3();
const YAW_BASE = {};   // todas las mallas de personajes miran a +z con -90° (medido con herramientas/pueblo_giro.js)
function lienzo(w, h, pinta) { const c = document.createElement('canvas'); c.width = w; c.height = h; pinta(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const MATS = {};
// paja tejida de la chupalla
function matPaja() {
  return MATS.paja ||= new THREE.MeshStandardMaterial({ roughness: 0.95, map: lienzo(128, 128, (g, w, h) => {
    g.fillStyle = '#cdb27a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? 'rgba(120,92,50,0.35)' : 'rgba(250,236,190,0.35)'; g.fillRect(0, y, w, 2); }
    for (let x = 0; x < w; x += 6) { g.fillStyle = 'rgba(110,84,46,0.18)'; g.fillRect(x, 0, 1, h); }
  }) });
}
// manta de lana a listas (colores: fondo, lista oscura, lista clara)
function matManta([f, o, c]) {
  const k = 'manta' + f + o + c;
  return MATS[k] ||= new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide, map: lienzo(64, 256, (g, w, h) => {
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    g.fillStyle = hex(f); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }   // lana
    // listas horizontales junto al ruedo (v bajo = abajo de la manta) y una al cuello
    for (const [y0, al, col] of [[0.06, 0.05, o], [0.13, 0.025, c], [0.17, 0.05, o], [0.25, 0.02, c], [0.86, 0.03, o]]) { g.fillStyle = hex(col); g.fillRect(0, h - (y0 + al) * h, w, al * h); }
  }) });
}

// ------------------------------------------------------------------ ropa y utensilios (en el marco del personaje: pies en 0, +z al frente)
function chupalla(k) {   // sombrero de paja de ala ancha
  const g = new THREE.Group(), m = matPaja();
  const ala = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * k, 0.26 * k, 0.012, 24), m); g.add(ala);
  const copa = new THREE.Mesh(new THREE.CylinderGeometry(0.095 * k, 0.11 * k, 0.11 * k, 18), m); copa.position.y = 0.055 * k; g.add(copa);
  const cinta = new THREE.Mesh(new THREE.CylinderGeometry(0.112 * k, 0.112 * k, 0.025 * k, 18, 1, true), mat(0x2a1d16)); cinta.position.y = 0.02 * k; g.add(cinta);
  return g;
}
function fieltro(k) {   // sombrero de fieltro (de los mayores y los carreteros)
  const g = new THREE.Group(), m = mat(0x3a3028, { rough: 0.9 });
  const ala = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * k, 0.2 * k, 0.014, 24), m); g.add(ala);
  const copa = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * k, 0.105 * k, 0.13 * k, 18), m); copa.position.y = 0.065 * k; g.add(copa);
  const hun = new THREE.Mesh(new THREE.SphereGeometry(0.09 * k, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), m); hun.scale.y = 0.35; hun.position.y = 0.125 * k; g.add(hun);
  const cinta = new THREE.Mesh(new THREE.CylinderGeometry(0.107 * k, 0.107 * k, 0.025 * k, 18, 1, true), mat(0x161210)); cinta.position.y = 0.02 * k; g.add(cinta);
  return g;
}
function manta(col, a) {   // manta (poncho) de lana: cae de los hombros y tapa los brazos; octogonal y aplanada adelante-atrás
  const k = a / 1.7, perfil = [[0.075, 0.03], [0.1, 0.0], [0.27, -0.06], [0.34, -0.2], [0.4, -0.48]].map(([r, y]) => new THREE.Vector2(r * k, y * k));
  const geo = new THREE.LatheGeometry(perfil, 8); geo.rotateY(Math.PI / 8); geo.scale(1, 1, 0.66);
  const me = new THREE.Mesh(geo, matManta(col)); me.castShadow = true;
  return me;
}
function delantal(color, a) { const me = new THREE.Mesh(new THREE.BoxGeometry(0.2 * a, 0.27 * a, 0.01), mat(color, { rough: 1 })); me.castShadow = true; return me; }
// REV (16-11, revisor de mallas, pedido de Diego «si la malla existe aplícala»): pone la pieza aprobada de la utilería en g cuando
// carga y oculta las primitivas de respaldo (oc = las que hay al llamar, o las que se indiquen). Sin malla quedan las primitivas.
function conMalla(g, id, esc, x = 0, y = 0, z = 0, ry = 0, oc = null) {
  const pu = precargarUtileria(); if (!pu) return g;
  const ocultar = oc || g.children.slice();
  pu.then(() => { const m = piezaGrupo(id, esc); if (!m) return; m.position.set(x, y, z); m.rotation.y = ry; m.traverse(o => { o.castShadow = true; }); for (const o of ocultar) o.visible = false; g.add(m); });
  return g;
}
function balde() {   // balde de madera con aro de fierro y asa
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 14), mat(0x7a5634, { rough: 0.95 })); g.add(c);
  for (const y of [-0.08, 0.08]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.113 + y * 0.12, 0.008, 4, 18), mat(0x3b3936, { metal: 0.5, rough: 0.6 })); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  const agua = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), mat(0x56708a, { rough: 0.2 })); agua.rotation.x = -Math.PI / 2; agua.position.y = 0.09; g.add(agua);
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.006, 4, 14, Math.PI), mat(0x3b3936, { metal: 0.5 })); asa.position.y = 0.12; g.add(asa);
  return conMalla(g, 'balde', [0.78, 0.78, 0.78], 0, -0.125, 0);   // REV: balde de duelas TRELLIS (0,32 m → 0,25 m)
}
function palo(largo, r = 0.016, color = 0x6b4a2c) { const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, largo, 6), mat(color, { rough: 1 })); me.castShadow = true; return me; }

// colgar un objeto de un hueso conservando la pose actual: se pone en el marco del personaje y se pasa al hueso con attach()
function colgar(g, hueso, obj, x, y, z, rx = 0, ry = 0, rz = 0) {
  g.add(obj); obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz); g.updateMatrixWorld(true); hueso.attach(obj);
}

export function persona1905(M, tipo) {
  const T = TIPOS_1905[tipo] || TIPOS_1905.campesino, sp = M.splatsTodos && (M.splatsTodos[T.base] || M.splatsTodos['p_' + T.base]);
  const g = new THREE.Group(), a = T.alto, ctl = { g, alto: a, nombre: T.nombre, tipo, anim: null, huesos: {}, pose: null };
  if (!sp) { ctl.listo = Promise.resolve(null); ctl.poner = () => {}; return ctl; }
  // giro de la malla para que mire a +z: las de dolientes vienen giradas distinto que las p_* (medido en capturas/vida/pueblo/)
  const yaw = (typeof window !== 'undefined' && window.__YAW && window.__YAW[T.base] != null) ? window.__YAW[T.base] : (YAW_BASE[T.base] ?? -Math.PI / 2);
  const piv = personajeSplat(sp, a, yaw, T.base, null, true);
  g.add(piv);
  let o = null; piv.traverse(x => { if (x.userData && x.userData.mallaPromesa) o = x; });
  let actual = '';
  ctl.poner = (n, dt, vel = 1) => {
    const an = ctl.anim; if (!an) return;
    if (!an.nombres.includes(n)) n = 'idle';
    if (n !== actual) { an.tocar(n, { fundido: 0.3, reiniciar: true, vel }); actual = n; } else if (vel !== ctl._vel) an.tocar(n, { vel });
    ctl._vel = vel; an.actualizar(dt);
    if (ctl.pose) ctl.pose(ctl.huesos);   // poses hechas a mano sobre la acción (sentado)
  };
  ctl.listo = !o ? Promise.resolve(null) : (o.userData.manejada = true, o.userData.mallaPromesa.then(r => {
    ctl.anim = r.anim; r.anim.tocar('idle'); r.anim.actualizar(Math.random() * 2);
    r.escena.traverse(x => { if (x.isBone) ctl.huesos[x.name.replace('.', '')] = x; });   // GLTFLoader quita el punto: «thigh.L» → «thighL»
    if (T.tinte != null) r.escena.traverse(x => { if (x.isMesh && x.material) { x.material = x.material.clone(); x.material.color.set(T.tinte); } });
    const H = ctl.huesos; g.updateMatrixWorld(true);
    const enG = n => H[n] ? g.worldToLocal(H[n].getWorldPosition(_v.set(0, 0, 0))).clone() : null;
    const cab = enG('head'), pecho = enG('chest'), cad = enG('hips');
    if (H.head && cab && T.gorro) colgar(g, H.head, T.gorro === 'chupalla' ? chupalla(a / 1.7) : fieltro(a / 1.7), cab.x, a * 0.955, cab.z + 0.005 * a, -0.05);
    if (H.chest && pecho && T.manta) colgar(g, H.chest, manta(T.manta, a), pecho.x, a * 0.835, pecho.z - 0.01 * a);   // abertura del cuello a la altura del cuello
    if (H.hips && cad && T.delantal != null) colgar(g, H.hips, delantal(T.delantal, a), cad.x, a * 0.43, cad.z + 0.13 * a);
    if (H.handR && T.balde) { const m = enG('handR'); colgar(g, H.handR, balde(), m.x, m.y - 0.16, m.z); }
    if (H.handL && T.baston) {   // bastón (anciano) o picana larga (carretero) en la mano izquierda
      const m = enG('handL'), L = T.baston === 'picana' ? 2.6 : 0.95, p = palo(L, T.baston === 'picana' ? 0.014 : 0.018, T.baston === 'picana' ? 0x8a6a40 : 0x4a3220);
      if (T.baston === 'picana') colgar(g, H.handL, p, m.x, m.y + 0.35, m.z + 0.15, 0.35); else colgar(g, H.handL, p, m.x, m.y - L / 2 + 0.05, m.z + 0.04);
    }
    return r;
  }).catch(e => { console.warn('gente1905', tipo, e && e.message); return null; }));
  ctl.mano = () => ctl.huesos.handR ? ctl.huesos.handR.getWorldPosition(new THREE.Vector3()) : g.localToWorld(new THREE.Vector3(0.2, a * 0.5, 0.2));
  return ctl;
}

// ------------------------------------------------------------------ utensilios de la escena (batea, fogón, banco, aro)
function Grupo(...hijos) { const g = new THREE.Group(); for (const h of hijos) { h.castShadow = true; h.receiveShadow = true; g.add(h); } return g; }
const M_ = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); return me; };
function batea() {   // artesa de madera sobre un caballete, con agua jabonosa y ropa
  const mM = mat(0x7a5634, { rough: 0.95 }), mV = mat(0x5e4128, { rough: 1 });
  const g = Grupo(M_(new THREE.BoxGeometry(1.0, 0.06, 0.5), mM, 0, 0.62, 0), M_(new THREE.BoxGeometry(1.0, 0.18, 0.05), mM, 0, 0.72, 0.24), M_(new THREE.BoxGeometry(1.0, 0.18, 0.05), mM, 0, 0.72, -0.24),
    M_(new THREE.BoxGeometry(0.05, 0.18, 0.5), mM, 0.48, 0.72, 0), M_(new THREE.BoxGeometry(0.05, 0.18, 0.5), mM, -0.48, 0.72, 0),
    M_(new THREE.PlaneGeometry(0.92, 0.42), mat(0xa8b8c0, { rough: 0.15 }), 0, 0.77, 0, -Math.PI / 2), M_(new THREE.BoxGeometry(0.4, 0.06, 0.3), mat(0xe8e2d4, { rough: 1 }), 0.15, 0.79, 0.02, 0, 0.4, 0.1),
    M_(new THREE.BoxGeometry(0.3, 0.05, 0.25), mat(0x4a5a7a, { rough: 1 }), -0.2, 0.79, -0.05, 0, -0.3, -0.1));
  for (const x of [-0.38, 0.38]) for (const z of [-0.18, 0.18]) g.add(M_(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 6), mV, x, 0.31, z, z * 0.6, 0, 0));
  const tina = M_(new THREE.CylinderGeometry(0.28, 0.24, 0.3, 14), mM, 0.9, 0.15, 0.1); g.add(tina);   // tina con ropa limpia al lado
  g.add(M_(new THREE.SphereGeometry(0.22, 10, 6), mat(0xeeeae0, { rough: 1 }), 0.9, 0.3, 0.1, 0, 0, 0)); g.children.at(-1).scale.y = 0.45;
  return conMalla(g, 'batea', [1.05, 1.0, 1.05], 0, 0.6, 0, 0, g.children.slice(0, 5));   // REV: artesa TRELLIS sobre el caballete (quedan patas, agua, ropa y tina)
}
function fogon() {   // tres piedras, olla de greda, leña y llama
  const mP = mat(0x6a645a, { rough: 1 }), g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const a = i * 2.1; const p = M_(new THREE.DodecahedronGeometry(0.14), mP, Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22, i, i * 2, 0); p.castShadow = true; g.add(p); }
  for (let i = 0; i < 4; i++) { const a = i * 1.6; g.add(M_(new THREE.CylinderGeometry(0.03, 0.035, 0.5, 6), mat(0x4a3220, { rough: 1 }), Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12, Math.PI / 2, a, 0)); }
  const olla = M_(new THREE.SphereGeometry(0.2, 14, 10), mat(0x8a4a2a, { rough: 0.85 }), 0, 0.36, 0); olla.scale.y = 0.85; olla.castShadow = true; g.add(olla);
  g.add(M_(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 14), mat(0x7a4024, { rough: 0.85 }), 0, 0.52, 0));
  const llama = M_(new THREE.ConeGeometry(0.11, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85 }), 0, 0.17, 0); g.add(llama);
  g.userData.llama = llama; return conMalla(g, 'fogon', [0.8, 0.8, 0.8], 0, 0, 0, 0, g.children.slice(0, 9));   // REV: fogón de piedras con trípode y olla TRELLIS; la llama animada queda
}
function banco(h = 0.45) {   // h: altura del asiento
  const mM = texMat('veta', 0xa88a6c), g = Grupo(M_(new THREE.BoxGeometry(1.3, 0.07, 0.36), mM, 0, h - 0.035, 0));
  for (const x of [-0.52, 0.52]) g.add(M_(new THREE.BoxGeometry(0.07, h - 0.07, 0.3), mM, x, (h - 0.07) / 2, 0));
  g.traverse(o => { if (o.isMesh) uvPieza(o.geometry, o.material); });   // TEX: UV en metros (antes mat liso 0x6b4a2c)
  return g;
}
function aro() { const g = new THREE.Group(); g.add(M_(new THREE.TorusGeometry(0.28, 0.014, 5, 24), mat(0x6b4a2c, { rough: 0.9 }))); return g; }

// pose «sentado» (N1-PUEBLO-VIDA-b, 15-11): se APUNTA cada hueso en el mundo (no suma ángulos a ejes locales, que cambian cuando se
// rehace el esqueleto): muslos al frente y horizontales, canillas abajo, brazos con las manos sobre las rodillas. Se aplica después de
// cada actualización de la acción idle, así que no se acumula.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function apuntar(hueso, hijo, dir) {
  if (!hueso || !hijo) return;
  hueso.updateWorldMatrix(true, true);
  const d = hijo.getWorldPosition(_b).sub(hueso.getWorldPosition(_a)).normalize();
  _q.setFromUnitVectors(d, dir); hueso.getWorldQuaternion(_qb); hueso.parent.getWorldQuaternion(_qp);
  hueso.quaternion.copy(_qp.invert().multiply(_q.multiply(_qb)));
}
function poseSentado(g, H) {
  g.updateWorldMatrix(true, false);
  const q = g.getWorldQuaternion(new THREE.Quaternion()), adel = new THREE.Vector3(0, 0, 1).applyQuaternion(q), izq = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  for (const [s, k] of [['L', 1], ['R', -1]]) {
    // (L/R del esqueleto: se elige el lado por la posición real del hueso, no por el nombre)
    const lado = H['thigh' + s] && H['thigh' + s].getWorldPosition(_c).sub(g.getWorldPosition(_a)).dot(izq) > 0 ? 1 : -1;
    apuntar(H['thigh' + s], H['shin' + s], _c.copy(adel).addScaledVector(izq, lado * 0.12).normalize());
    apuntar(H['shin' + s], H['foot' + s], _c.copy(adel).multiplyScalar(0.12).add(new THREE.Vector3(0, -1, 0)).normalize());
    // brazos: el brazo cae hacia adelante y el antebrazo va a la rodilla de su lado
    const brazo = H['uparm' + s], ante = H['forearm' + s], mano = H['hand' + s], rod = H['shin' + s];
    if (brazo && ante && mano && rod && !(s === 'L' && g.userData.manoIzqOcupada)) {
      apuntar(brazo, ante, _c.copy(adel).multiplyScalar(0.45).add(new THREE.Vector3(0, -1, 0)).addScaledVector(izq, lado * 0.08).normalize());
      ante.updateWorldMatrix(true, true);
      const meta = rod.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.07, 0)).addScaledVector(izq, -lado * 0.02);
      apuntar(ante, mano, meta.sub(ante.getWorldPosition(_a)).normalize());
    }
  }
}
// medidas de la pose sentada en el marco del personaje (con la acción idle puesta): altura de la articulación de la cadera que deja
// los pies en el suelo con la canilla vertical, y cuánto hay que bajar el cuerpo
function medirSentado(g, H) {
  g.updateWorldMatrix(true, true);
  const L = n => H[n] ? g.worldToLocal(H[n].getWorldPosition(new THREE.Vector3())) : null;
  const mu = L('thighL'), ca = L('shinL'), pi = L('footL');
  if (!mu || !ca || !pi) return null;
  const canilla = ca.distanceTo(pi), tobillo = Math.max(0.04, pi.y);
  return { cadera: mu.y, rodilla: canilla + tobillo, z: mu.z };
}

const angD = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
// vecino de 1905: { t: 'vecino', quien, x, z, hace?: 'lavar'|'cocinar'|'sentado'|'jugar'|'caminar'|'charlar', a?: [x,z], mira?: [x,z], r?, texto? }
export const FABRICA_GENTE1905 = {
  vecino(M, L, s) {
    const per = persona1905(M, s.quien), g = per.g, hace = s.hace || (s.a ? 'caminar' : 'charlar');
    const y0 = s.y ?? M.fis.suelo(s.x, s.z); g.position.set(s.x, y0, s.z);
    const rumbo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
    g.rotation.y = s.mira ? rumbo(s.x, s.z, s.mira[0], s.mira[1]) : s.a ? rumbo(s.x, s.z, s.a[0], s.a[1]) : (s.giro || 0) * Math.PI / 180;
    const e = L.agregar({ tipo: 'npc', vivo: true, malla: g, sala: null, x: s.x, y: y0, z: s.z, t: Math.random() * 5, generico: true, epoca: 1905 });
    // utensilios fijos frente a la persona (en el marco de la escena, sobre el suelo)
    const delante = (d, obj, giro = 0) => { const x = s.x + Math.sin(g.rotation.y) * d, z = s.z + Math.cos(g.rotation.y) * d; obj.position.set(x, M.fis.suelo(x, z), z); obj.rotation.y = g.rotation.y + giro; M.grupoDe(e).add(obj); L.agregar({ tipo: 'decor', vivo: true, malla: obj, sala: null, x, z }); return obj; };
    let fuego = null, aroG = null;
    if (hace === 'lavar') delante(0.62, batea(), Math.PI / 2);
    if (hace === 'cocinar') fuego = delante(0.75, fogon()).userData.llama;
    if (hace === 'sentado') {   // banco bajo la persona; el cuerpo (no la raíz) baja a la altura del asiento
      // el cuerpo (no la raíz) baja hasta que la cadera queda a la altura de las rodillas (muslo horizontal, canilla vertical, pies en el
      // suelo); el banco se hace a esa altura y bajo las nalgas. Después de colgar sombrero y manta (per.listo)
      per.listo.then(() => {
        const m = medirSentado(g, per.huesos); if (!m) return;
        const piv = g.children[0], baja = m.cadera - m.rodilla, asiento = m.rodilla - 0.07;
        piv.position.y -= baja;
        g.userData.manoIzqOcupada = !!TIPOS_1905[s.quien].baston;
        per.pose = H => poseSentado(g, H);
        const b = banco(asiento); const zb = m.z - 0.12; b.position.set(s.x + Math.sin(g.rotation.y) * zb, y0, s.z + Math.cos(g.rotation.y) * zb); b.rotation.y = g.rotation.y;
        M.grupoDe(e).add(b); L.agregar({ tipo: 'decor', vivo: true, malla: b, sala: null, x: b.position.x, z: b.position.z });
        e.sentado = { baja, asiento };
      });
    }
    if (hace === 'jugar' && s.aro) { aroG = aro(); M.grupoDe(e).add(aroG); }
    const A = { x: s.x, z: s.z }, B = s.a ? { x: s.a[0], z: s.a[1] } : null;
    let hacia = B, espera = 1 + Math.random() * 2, cuadro = 0, ang = s.fase || 0, giroAro = 0;
    const v = s.v ?? (per.alto < 1.3 ? 1.25 : s.quien === 'anciano' || s.quien === 'cocinera' ? 0.8 : 1.1);
    e.act = dt => {
      e.t += dt; cuadro++;
      const j = M.jug, dx = g.position.x - j.pos.x, dz = g.position.z - j.pos.z, d = Math.hypot(dx, dz), dy = Math.abs(j.pie - g.position.y);
      const ver = d < 85; if (g.visible !== ver) g.visible = ver; if (aroG && aroG.visible !== ver) aroG.visible = ver;
      if (!ver) return;
      if (d < 0.85 && dy < 1.6) { const k = (0.85 - d) * 30 * dt / Math.max(d, 0.05); j.vel.x -= dx * k; j.vel.z -= dz * k; }
      if (fuego && d < 45) { const f = 0.8 + Math.sin(e.t * 13) * 0.12 + Math.sin(e.t * 7.3) * 0.1; fuego.scale.set(f, 0.8 + f * 0.4, f); }
      const cerca = d < 3.2 && dy < 3;
      if (s.texto) M.burbujaCerca(e, g.position, 3.2, `<b>${per.nombre}:</b> ${s.texto}`);
      let accion = 'idle', vel = 1;
      if (hace === 'jugar') {   // corre en círculo (a la pinta), con el aro rodando adelante
        const r = s.r || 2.4, w = v / r; if (!(cerca && d < 1.6)) ang += w * dt;
        const cx = s.x + Math.cos(ang) * r, cz = s.z + Math.sin(ang) * r, h = M.fis.rayo({ x: cx, y: g.position.y + 1.2, z: cz }, { x: 0, y: -1, z: 0 }, 2.6);
        if (h) g.position.set(cx, h.punto.y, cz);
        g.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang)) ; accion = cerca && d < 1.6 ? 'saludar' : 'caminar'; vel = v / 1.3;
        if (aroG) { const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y); giroAro += (cerca && d < 1.6 ? 0 : v * dt / 0.28);
          aroG.position.set(g.position.x + fx * 0.75 + fz * 0.15, g.position.y + 0.29, g.position.z + fz * 0.75 - fx * 0.15); aroG.rotation.set(0, g.rotation.y + Math.PI / 2, 0); aroG.rotateZ(-giroAro); }
      } else if (hace === 'sentado') {
        accion = 'idle'; if (cerca) e.tc = (e.tc || 0) + dt; else e.tc = 0; if (cerca && e.tc < 1.4) accion = 'saludar';
      } else if (cerca && hace !== 'lavar' && hace !== 'cocinar') {   // se detiene y mira a Nato; saluda al llegar
        g.rotation.y += angD(rumbo(g.position.x, g.position.z, j.pos.x, j.pos.z), g.rotation.y) > 0 ? dt * 3 : -dt * 3;
        e.tc = (e.tc || 0) + dt; accion = e.tc < 1.4 ? 'saludar' : 'hablar';
      } else {
        e.tc = 0;
        if (hace === 'lavar' || hace === 'cocinar') accion = Math.sin(e.t * 0.9 + s.x) > -0.3 ? 'entregar' : 'idle';   // refriega / revuelve la olla
        else if (hacia && d < 110) {
          if (espera > 0) espera -= dt;
          else {
            const vx = hacia.x - g.position.x, vz = hacia.z - g.position.z, l = Math.hypot(vx, vz);
            if (l < 0.4) { hacia = hacia === B ? A : B; espera = 2 + Math.random() * 3; }
            else {
              const nx = g.position.x + vx / l * v * dt, nz = g.position.z + vz / l * v * dt;
              const h = M.fis.rayo({ x: nx, y: g.position.y + 0.6, z: nz }, { x: 0, y: -1, z: 0 }, 2.0);
              if (!h || Math.abs(h.punto.y - g.position.y) > 0.6) { hacia = hacia === B ? A : B; espera = 1.5; }
              else { g.position.set(nx, h.punto.y, nz); g.rotation.y = Math.atan2(vx, vz); accion = 'caminar'; vel = v / 1.3; }
            }
          }
        } else if (s.mira) accion = Math.sin(e.t * 0.7 + s.x) > 0.2 ? 'hablar' : 'idle';
      }
      if (d < 45 || !e.ya) { e.ya = true; if (d < 25 || cuadro % 2 === 0) per.poner(accion, d < 25 ? dt : dt * 2, vel); }
    };
  },
};
