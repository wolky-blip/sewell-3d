// N1-ABASTECIMIENTO (carril vida, 15-11-2026). Pedido de Diego: «la yunta de bueyes y las mulas deben recorrer los caminos desde el
// campamento hasta la estación […] los bueyes hasta donde están los capachos, y las mulas desde la Casa Hamilton hasta el campamento;
// así simulamos una cadena de abastecimiento. Modifica los capachos para que vayan de ida y vuelta.»
// Cadena (N1-ABASTECIMIENTO-c): tren → yunta (por Pueblo Hundido) → estación B del andarivel → capachos de vuelta con sacos → andén A
// (frente, Casa Hamilton) → arreo de mulas → campamento; el mineral al revés (mulas → A → capachos de ida → B → yunta → tren). Aquí: pilas de sacos (acopios), el saco que vuela de la carreta/mula a la pila y el ciclo de ida y vuelta de
// los capachos del andarivel «hamilton» (los de ida siguen siendo los que Nato aborda; los de vuelta cuelgan de un segundo cable,
// paralelo, y traen mineral; en cada andén pasan de un cable al otro por un riel de traslado, sin desaparecer).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './construir.js';
import { texMat } from './texFaena.js';   // TEX (16-11): sacos de arpillera con trama, costura y polvo

// ------------------------------------------------------------------ sacos
const GEO_SACO = (() => { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(0.3, 0.19, 0.36); return g; })();
const MATS = {};
export function matSaco(tipo) { return MATS[tipo] ||= texMat('arpillera', tipo === 'm' ? 0xa08a68 : 0xf0dcb4); }   // TEX: arpillera (antes mat liso 0x8c7b5e / 0xcdb584)   // m: mineral (saco oscuro, pesado); v: víveres (arpillera clara)
export function saco(tipo = 'v') { const m = new THREE.Mesh(GEO_SACO, matSaco(tipo)); m.castShadow = true; m.userData.tipo = tipo; return m; }
// sacos de una carga (carreta) en una sola malla instanciada: lo visible es siempre un prefijo (se baja el de arriba, se sube en orden)
// → I.count. Devuelve «sacos» con la misma forma que un Mesh (position, visible, userData.tipo, material, getWorldPosition).
export function sacosInstanciados(slots, tipo = 'v') {
  const I = new THREE.InstancedMesh(GEO_SACO, matSaco(tipo), slots.length), o = new THREE.Object3D(), ud = { tipo }; I.castShadow = true; I.frustumCulled = false;   // ud: tipo común a toda la carga
  const sacos = slots.map(([x, y, z], k) => {
    o.position.set(x, y, z); o.rotation.set(0, (k % 3 - 1) * 0.15, 0); o.updateMatrix(); I.setMatrixAt(k, o.matrix);
    let vis = true; const sa = { position: new THREE.Vector3(x, y, z), userData: ud,
      get visible() { return vis; }, set visible(v) { vis = v; I.count = sacos.filter(q => q.visible).length; },
      get material() { return I.material; }, set material(m) { I.material = m; },
      getWorldPosition: v => I.localToWorld(v.copy(sa.position)) };
    return sa;
  });
  return { I, sacos };
}
export function tipoSaco(m, tipo) { if (m.userData.tipo !== tipo) { m.material = matSaco(tipo); m.userData.tipo = tipo; } }

// pila de sacos (acopio): dos montones de 2×2×(cap/4) sacos, uno de víveres y otro de mineral, apoyados en el suelo bajo cada columna.
// pila.n = { v, m } cuántos hay; pila.slot(tipo, k) = punto del mundo del saco k; pila.ver() actualiza lo dibujado.
export function pila(M, x, z, giro, cap = 8, suelo) {
  const g = new THREE.Group(), c = Math.cos(giro), s = Math.sin(giro), n = { v: 0, m: 0 };
  const im = {}, yCol = {}, dm = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();
  const local = (tipo, k) => { const col = k % 2, fila = Math.floor(k / 2) % 2, capa = Math.floor(k / 4); return [(tipo === 'v' ? -0.82 : 0.82) + (col - 0.5) * 0.6, capa, (fila - 0.5) * 0.74]; };
  const mundo = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
  const slot = (tipo, k) => {
    const [lx, capa, lz] = local(tipo, k), [wx, wz] = mundo(lx, lz), key = tipo + (k % 4);
    if (yCol[key] == null) yCol[key] = suelo(wx, wz);
    return new THREE.Vector3(wx, yCol[key] + 0.17 + capa * 0.33, wz);
  };
  let az = Math.abs(Math.round(x * 7 + z * 13)) + 1; const r = () => ((az = (az * 16807) % 2147483647) / 2147483647);
  for (const tipo of ['v', 'm']) {
    const I = new THREE.InstancedMesh(GEO_SACO, matSaco(tipo), cap); I.castShadow = true; I.receiveShadow = true; I.frustumCulled = false;
    for (let k = 0; k < cap; k++) { const P = slot(tipo, k); e3.set((r() - 0.5) * 0.12, giro + (r() - 0.5) * 0.35, (r() - 0.5) * 0.12); q.setFromEuler(e3); dm.compose(p3.copy(P), q, sc); I.setMatrixAt(k, dm); }
    I.count = 0; im[tipo] = I; g.add(I);
  }
  const ver = () => { for (const t of ['v', 'm']) im[t].count = Math.max(0, Math.min(cap, n[t])); };
  // regulador entre visitas: lo descargado aquí se va gastando/despachando y lo que se carga aquí se va juntando
  let reloj = 0;
  const regular = (dt, entra, sale, cada = 7) => { reloj += dt; if (reloj < cada) return; reloj = 0; if (n[entra] > 0) n[entra]--; if (n[sale] < cap) n[sale]++; ver(); };
  return { g, n, cap, slot, ver, regular, x, z };
}

// un saco en vuelo (de la carreta o la mula a la pila o al revés): arco de parábola
export function vuelo() {
  const m = saco('v'); m.visible = false;
  let t = 1, dur = 1, A = new THREE.Vector3(), B = new THREE.Vector3(), alto = 1;
  return {
    m,
    lanzar(a, b, tipo, d = 1.1) { A.copy(a); B.copy(b); tipoSaco(m, tipo); t = 0; dur = d; alto = Math.max(a.y, b.y) + 0.9 - Math.min(a.y, b.y); m.visible = true; m.position.copy(a); },
    actualizar(dt) {
      if (t >= 1) return true; t = Math.min(1, t + dt / dur);
      const e = t * t * (3 - 2 * t); m.position.lerpVectors(A, B, e); m.position.y += Math.sin(Math.PI * e) * alto * 0.6; m.rotation.set(0, e * 2.4, Math.sin(Math.PI * e) * 0.4);
      if (t >= 1) m.visible = false; return t >= 1;
    },
    ocultar() { t = 1; m.visible = false; },
  };
}

// ------------------------------------------------------------------ andarivel de ida y vuelta
// Solo el andarivel 'hamilton' del N1 (el de la cumbre del N4 sigue de una sola vía).
// N1-ABASTECIMIENTO-c (15-11, Diego): B (estación baja, la de la foto, lado de la mina y Pueblo Hundido) recibe de la yunta los víveres del
// tren; los capachos de VUELTA (B → A, cable paralelo) los llevan en sacos al frente (andén A, Casa Hamilton), donde las mulas los suben al
// campamento; los de IDA (A → B, los de siempre) bajan el mineral que traen las mulas. Y Nato (con Hércules) puede volver de B a A en un
// capacho de vuelta: se sube en el muelle de B (el mismo vano por donde se baja al llegar), cruza y se baja solo en el andén A.
// Línea de tiempo de cada capacho (segundos): ida (Pida: espera en A 20 %, viaje, espera en B ~2,3 s: ahí se baja y se sube Nato) → vuelta:
// 0,4 s sale 0,3 m del andén → 1,6 s pasa al cable de vuelta (cargan los sacos) → viaje TV → en A: 1 s quieto junto al andén,
// 1 s vuelve al cable de ida, 0,4 s entra al muelle y descarga. Ahora los de vuelta SÍ tienen física (pl/plT/plF los siguen): se pueden
// abordar en B. Cola: uno de vuelta no entra al muelle de A si hay otro de ida ahí y guarda ≥ 3 s con el de adelante; uno de ida no llega
// al muelle de B mientras otro de vuelta lo ocupa (ocupaB); el que lleva a Nato espera en B hasta que esté adentro y en A hasta bajarlo.
export const TB_ESP = 0;   // el embarque en B usa la espera de la ida en el muelle (2,3 s; con 1,6 s más se encimaba el siguiente capacho)
const TB_SAL = 0.4, TB_LAT = 1.6, TV = 9.5, TA_ESP = 1.0, TA_LAT = 1.0, TA_ENT = 0.4, SAL = 0.3, SEP = 2.8;
const TRET = TB_ESP + TB_SAL + TB_LAT + TV + TA_ESP + TA_LAT + TA_ENT, TB = TB_ESP + TB_SAL + TB_LAT;
export function andarivelVuelta(M, L, A, enCable, Ltot) {
  if (A.id !== 'hamilton') return null;
  const n = Math.max(5, A.capachos + 2), Pida = A.periodo, Ptot = Pida + TRET, F = Pida / Ptot;
  const ux = A.b.x - A.a.x, uz = A.b.z - A.a.z, lu = Math.hypot(ux, uz) || 1, u = { x: ux / lu, z: uz / lu }, nl = { x: -u.z, z: u.x };   // nl: al sur en el N1 (la torre queda al norte)
  const Us = new Array(n).fill(0), uAct = new Array(n).fill(1), ret = new Array(n).fill(false);
  // cable de vuelta y rieles de traslado (a la altura del cable de ida)
  const G = new THREE.Group(), mC = mat(0x222222), mR = mat(0x2e2a26, { metal: 0.5, rough: 0.6 });
  const geos = new Map();   // una sola malla por material (rendimiento: 2 dibujos en vez de ~36)
  const barra = (a, b, r, m) => { const d = new THREE.Vector3().subVectors(b, a), Lb = d.length(), g = new THREE.CylinderGeometry(r, r, Lb, 6), o = new THREE.Object3D(); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); o.updateMatrix(); g.applyMatrix4(o.matrix); (geos.get(m) || geos.set(m, []).get(m)).push(g); };
  const V3 = (p, dl, du, dy = A.alto) => new THREE.Vector3(p[0] + nl.x * dl + u.x * du, p[1] + dy, p[2] + nl.z * dl + u.z * du);
  const pA = enCable(0), pB = enCable(1), nS = 24;
  for (let k = 0; k < nS; k++) barra(V3(enCable(Math.max(SAL / Ltot, k / nS)), SEP, 0), V3(enCable(Math.min(1 - SAL / Ltot, (k + 1) / nS)), SEP, 0), 0.05, mC);
  for (const [p, sg] of [[pA, 1], [pB, -1]]) {   // riel de traslado: del extremo del cable de ida, 0,3 m hacia afuera, al cable de vuelta (viga de fierro con 2 tirantes)
    barra(V3(p, 0, 0, A.alto + 0.05), V3(p, 0, sg * SAL, A.alto + 0.05), 0.06, mR);
    barra(V3(p, -0.2, sg * SAL, A.alto + 0.05), V3(p, SEP + 0.3, sg * SAL, A.alto + 0.05), 0.07, mR);
    barra(V3(p, 0, sg * SAL, A.alto + 0.05), V3(p, SEP * 0.5, sg * SAL, A.alto + 0.9), 0.035, mR); barra(V3(p, SEP, sg * SAL, A.alto + 0.05), V3(p, SEP * 0.5, sg * SAL, A.alto + 0.9), 0.035, mR);
  }
  for (const [m, gs] of geos) { const me = new THREE.Mesh(mergeGeometries(gs), m); me.castShadow = true; G.add(me); }
  L.agregar({ tipo: 'decor', vivo: true, malla: G, sala: null });
  const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const V = {
    n, Ptot, TRET, TB, jinete: null,
    U: (reloj, i) => ((reloj / Ptot) + i / n) % 1,
    // u de la ida (0..0,985) o 0,99 en la vuelta; paraU0: 0,5 en la vuelta (ninguna regla de abordaje de la ida)
    u(reloj, i, paraU0) { const U = V.U(reloj, i); return U < F ? U / F * 0.985 : (paraU0 ? 0.5 : 0.99); },
    tRet(reloj, i) { const U = V.U(reloj, i); return U < F ? null : (U - F) * Ptot; },
    enMuelleB: t => t != null && t < TB_ESP + 0.12,   // recién empezada la vuelta, aún en el muelle de B (el que lleva a Nato se queda aquí)
    enMuelleA: t => t != null && t > TRET - 0.03,       // de vuelta, ya entró al muelle de A (se baja Nato)
    // ¿espera este capacho (de vuelta) en la cola?
    espera(reloj, i) {
      const t = V.tRet(reloj, i); if (t == null) return false;
      if (t >= TB - 0.02 && V.jinete !== i) {   // (el que lleva a Nato no espera por distancia: los de adelante están en otro tramo)
        let gap = 1; for (let k = 0; k < n; k++) if (k !== i) { const d = ((Us[k] - Us[i]) % 1 + 1) % 1; if (d > 0 && d < gap) gap = d; }
        if (gap * Ptot < 3.0) return true;
      }
      if (t >= TRET - TA_LAT - TA_ENT - 0.02) for (let k = 0; k < n; k++) if (k !== i && !ret[k] && uAct[k] < 0.3) return true;   // muelle de A ocupado
      return false;
    },
    // ¿hay otro capacho de vuelta todavía en el muelle de B o saliendo de él? (uno de ida no debe llegar encima)
    ocupaB(i) { for (let k = 0; k < n; k++) if (k !== i) { if (ret[k]) { const t = (Us[k] - F) * Ptot; if (t >= 0 && t < TB) return true; } else if (uAct[k] >= 0.8 && uAct[k] < 0.99) return true; } return false; },
    // posición de la vuelta y carga de sacos (0..1)
    pos(t) {
      let p = pB, dl = 0, du = 0, c = 0;
      if (t < TB_ESP) c = 0;
      else if (t < TB) { const t1 = t - TB_ESP; du = -SAL * sm(t1 / TB_SAL); dl = SEP * sm((t1 - TB_SAL) / TB_LAT); c = sm((t1 - TB_SAL) / TB_LAT); }
      else if (t < TB + TV) { const f = sm((t - TB) / TV), d = (Ltot - SAL) + (SAL - (Ltot - SAL)) * f; p = enCable(d / Ltot); dl = SEP; c = 1; }
      else { const t2 = t - (TB + TV); p = pA; dl = SEP * (1 - sm((t2 - TA_ESP) / TA_LAT)); du = SAL * (1 - sm((t2 - TA_ESP - TA_LAT) / TA_ENT)); c = 1 - sm((t2 - TA_ESP - TA_LAT) / TA_ENT); }
      return [p[0] + nl.x * dl + u.x * du, p[1], p[2] + nl.z * dl + u.z * du, c];
    },
    // tras mover la física: muestra la carga (mineral en la ida, sacos de víveres en la vuelta) y avisa a la cadena de cada extremo.
    // conNato: Nato (o su viaje) va en este capacho: no lleva carga
    colocar(e, i, u, conNato) {
      const t = V.tRet(e.reloj, i); Us[i] = V.U(e.reloj, i); uAct[i] = t == null ? u : 1; ret[i] = t != null; e.vuelta = t != null;
      let cm = 0, cs = 0;
      if (t == null) cm = u < 0.5 ? sm((u - 0.03) / 0.14) : 1 - sm((u - 0.82) / 0.13);   // mineral: lo cargan en A, lo descargan en B
      else cs = V.pos(t)[3];
      if (conNato) cm = cs = 0;
      if (e.carga) { e.carga.visible = cm > 0.02; e.carga.scale.set(1, Math.max(0.02, cm), 1); }
      if (e.sacos) { const k = Math.round(cs * e.sacos.n); e.sacos.I.count = k; e.sacos.I.visible = k > 0; }
      const ab = (tipo, ext) => { const f = ext === 'A' ? M.abastoCapachoA : M.abastoCapacho; if (f) f(tipo); };
      if (!conNato) {
        if (t == null && e.uPrev != null && e.uPrev < 0.9 && u >= 0.9) ab('llega', 'B');   // dejó mineral en la estación B
        if (t == null && e.uPrev != null && e.uPrev < 0.2 && u >= 0.2) ab('sale', 'A');    // partió de A con mineral
        if (t != null && e.tPrev != null && e.tPrev < TB_ESP + TB_SAL && t >= TB_ESP + TB_SAL) ab('sale', 'B');   // partió de B con víveres
        if (t != null && e.tPrev != null && e.tPrev < TRET - TA_ENT && t >= TRET - TA_ENT) ab('llega', 'A');      // dejó víveres en el andén A
      }
      e.uPrev = t == null ? u : null; e.tPrev = t;
    },
  };
  return V;
}
// sacos de víveres dentro del balde (vuelta): una malla instanciada; I.count = cuántos se ven
export function cargaSacos() {
  const slots = [[-0.45, 0.17, -0.42], [0.45, 0.17, -0.42], [-0.45, 0.17, 0.42], [0.45, 0.17, 0.42], [0, 0.5, -0.22], [0, 0.5, 0.3]];
  const S = sacosInstanciados(slots, 'v'); S.I.count = 0; S.I.visible = false; return { I: S.I, n: slots.length };
}
// mineral dentro del balde (montón de rocas grises con cobre): se escala en y al cargar/descargar
let GEO_MIN = null;
export function cargaMineral() {
  if (!GEO_MIN) {
    const piezas = []; let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 26; k++) { const g = new THREE.DodecahedronGeometry(0.16 + r() * 0.14, 0), a = r() * 6.28, d = Math.sqrt(r()) * 0.85; g.translate(Math.cos(a) * d, 0.12 + (0.85 - d) * 0.45 + r() * 0.1, Math.sin(a) * d * 0.85); piezas.push([g, r()]); }
    // una geometría por material (3 dibujos por capacho)
    GEO_MIN = [0, 1, 2].map(k => mergeGeometries(piezas.filter(([, t]) => (t < 0.6 ? 0 : t < 0.85 ? 1 : 2) === k).map(([g]) => g.index ? g.toNonIndexed() : g)));
  }
  const g = new THREE.Group(), mats = [mat(0x77716a, { rough: 0.95 }), mat(0x8f6442, { metal: 0.4, rough: 0.5 }), mat(0x5d7a66, { rough: 0.85 })];
  GEO_MIN.forEach((geo, k) => { if (geo) g.add(new THREE.Mesh(geo, mats[k])); });
  g.visible = false; return g;
}
