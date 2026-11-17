// N0-UTIL (carril utilería, 14-11-2026): biblioteca de utilería de época (1905-1970) en mallas livianas con textura nítida.
// Pedido de Diego: «a los muebles y decoraciones les hacen falta mallas con gráficos más realistas».
// - assets3d/utileria/indice.json: solo las piezas que PASARON el QC de 6 vistas (capturas/utileria/qc/). Cada pieza tiene
//   <id>.glb (≤ 12 mil caras, textura 1024, pivote en el piso al centro, frente hacia +z, medida real) y <id>_lod.glb (~1500 caras).
// - precargarUtileria(): una vez (prepararInteriores la llama); carga todo en segundo plano. Si una pieza no cargó, el mueble
//   procedural de interiores.js queda como respaldo (nada se rompe).
// - Colocador: junta las copias por pieza y por piso en InstancedMesh (una geometría y un material compartidos por todas las copias:
//   1 llamada de dibujo por pieza y piso). LOD por piso (verPiso): el piso de Nato con la malla completa, los vecinos (se ven por el
//   hueco de la escalera) con la liviana y el resto oculto.
// - texUtil(nombre): texturas planas generadas en local (retratos, calendario, alfombras, plano): assets3d/utileria/planos/<nombre>.jpg.
// - ?utileria=0 apaga todo (vuelven los muebles de cajas).
import * as THREE from 'three';
import { GLTFLoader, mallasMovil } from 'three/addons/loaders/GLTFLoader.js';   // MOVIL: mallasMovil()
import { mueble, FINOS } from './mueblesFinos.js';   // N0-MUEBLES
// UTIL-T0: los archivos mueblesFinos_<edificio>.js (uno por tanda FINO) se registran al cargarse; agregar aquí su import, p. ej. import './mueblesFinos_casas.js';
import './mueblesFinos_club.js';   // C4: muebles finos del Teniente Club
import './mueblesFinos_casas.js';   // C1: muebles finos de las casas 1905, Hamilton y genéricas
import './mueblesFinos_hospital.js';   // C2: muebles finos del hospital
import './mueblesFinos_escuela.js';   // C3: muebles finos de la escuela y del museo
import './mueblesFinos_mina.js';   // G9M: jaula del pique (FINO) y otros de la mina
import './mueblesFinos_emblemas.js';   // C5: iglesia, cine/teatro y palitroque

const BASE = 'assets3d/utileria/';
const APAGADA = typeof location !== 'undefined' && /[?&]utileria=0/.test(location.search);
const PIEZA = {};   // id -> { geo, geoL, mat, tam }
let carga = null; const PLANOS = new Set();
export const utileriaActiva = () => !APAGADA;

function extraer(gltf) {   // primera malla del GLB, con su transformación aplicada
  let m = null; gltf.scene.updateMatrixWorld(true); gltf.scene.traverse(o => { if (o.isMesh && !m) m = o; });
  if (!m) return null;
  const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); g.computeBoundingSphere(); return { g, mat: m.material };
}
export function precargarUtileria() {
  if (APAGADA || carga) return carga;
  // MOVIL (M-MOVIL-CARGA): en el celular la utilería (112 mallas y los muebles finos procedurales, que se ven sobre todo en los
  // interiores) se baja DESPUÉS de que el nivel empezó: la pantalla de carga ya no la espera (4-5 s menos con la CPU de un celular).
  // Mientras tanto, hayPieza() da false y los interiores usan sus muebles de cajas de respaldo, como cuando una pieza no carga.
  if (mallasMovil() && !precargarUtileria.diferida) {
    precargarUtileria.diferida = true;
    return (carga = new Promise(r => { const f = () => (globalThis.JUEGO && globalThis.JUEGO.escena === 'juego' ? setTimeout(r, 1500) : setTimeout(f, 400)); f(); })
      .then(async () => { for (const id of FINOS) { if (!PIEZA[id]) PIEZA[id] = mueble(id); await new Promise(r => setTimeout(r, 30)); }   // de a uno, sin trabar cuadros
        carga = null; return precargarUtileria(); }));
  }
  for (const id of FINOS) if (!PIEZA[id]) PIEZA[id] = mueble(id);   // N0-MUEBLES: muebles finos procedurales   // MOVIL: en el celular ya se hicieron de a uno
  const L = new GLTFLoader();
  // MOVIL: en el celular las mallas bajan de a 2 (con las 112 a la vez el juego caía a ~20 fps varios segundos al empezar)
  const cola = []; let activas = 0;
  const turno = f => mallasMovil() ? new Promise((ok, mal) => { const ir = () => { activas++; f().then(ok, mal).finally(() => { activas--; const s = cola.shift(); if (s) setTimeout(s, 16); }); }; if (activas < 2) ir(); else cola.push(ir); }) : f();
  carga = fetch(BASE + 'indice.json').then(r => r.json()).then(ind => { for (const n of ind.planos || []) PLANOS.add(n); return ind; }).then(ind => Promise.all(Object.entries(ind.piezas || {}).map(([id, inf]) =>
    Promise.all([turno(() => L.loadAsync(BASE + inf.glb)), inf.lod /* MOVIL: la _lod se baja también en el celular (sin ella las copias lejanas usaban la malla completa: 13,8 M de triángulos de coirón en el N1) */ ? turno(() => L.loadAsync(BASE + inf.lod)).catch(() => null) : null]).then(([a, b]) => {
      const A = extraer(a); if (!A) return;
      const B = b ? extraer(b) : null, mat = A.mat;
      if (mat.isMeshStandardMaterial) {   // luz de interior sin mapa de entorno: nada de metal oscuro; un poco de brillo propio para que la textura se lea
        mat.metalness = Math.min(mat.metalness ?? 0, inf.metal ?? 0.15); mat.roughness = Math.max(mat.roughness ?? 0.8, 0.45);
        if (mat.map) { mat.map.anisotropy = 4; mat.emissiveMap = mat.map; mat.emissive = new THREE.Color(0.1, 0.09, 0.08); }
        mat.needsUpdate = true;
      }
      PIEZA[id] = { geo: A.g, geoL: B ? B.g : A.g, mat, tam: inf.tam };
    }).catch(e => console.warn('utilería: no cargó', id, e && e.message))))).catch(e => console.warn('utilería: sin índice', e && e.message));
  return carga;
}
export const hayPieza = id => !!PIEZA[id];
export const tamPieza = id => (PIEZA[id] ? PIEZA[id].tam : null);
// UTIL-T0: caja REAL de la geometría (no la «tam» nominal: la litera con su escalerita mide más ancho), para apoyar bien contra un muro. null si no hay pieza.
export function cajaPieza(id) {
  const P = PIEZA[id]; if (!P) return null;
  if (!P.caja) { P.geo.computeBoundingBox(); const b = P.geo.boundingBox; P.caja = { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] }; }
  return P.caja;
}

// UTIL-T0 · puente 1: piezaGrupo(id, esc?, lod?) → THREE.Group con la malla de la pieza (geometría y material COMPARTIDOS), pivote en el piso, frente +z.
// Para objetos sueltos o móviles (recuerdos coleccionables, pedestales, lo que se gira o se anima) donde no sirve el Colocador. null si no hay pieza (queda el respaldo procedural).
export function piezaGrupo(id, esc, lod = 0) {
  const P = PIEZA[id]; if (APAGADA || !P) return null;
  const g = new THREE.Group(), me = new THREE.Mesh(lod ? P.geoL : P.geo, P.mat); me.receiveShadow = true; me.name = 'util:' + id;
  if (esc) g.scale.set(...esc); g.userData.tam = P.tam; g.add(me); return g;
}

// Q1 (16-11-2026) · puente 3: partirPieza(id, clave, pred) → { a, b, mat, tam } | null. Parte la malla de una pieza en dos geometrías
// (comparten los atributos; solo cambia el índice) según pred(x, y, z) sobre el centro de cada triángulo, en el marco de la pieza
// (pivote al piso, frente +z, sin escala): b = triángulos con pred verdadero (la parte móvil o la de vidrio), a = el resto.
// Para animar una parte (brazo del tubo de rayos X) o darle otro material (capota de acrílico) sin otra malla. Se guarda por id + clave.
const PARTIDAS = {};
export function partirPieza(id, clave, pred) {
  const P = PIEZA[id]; if (APAGADA || !P || !P.geo.index) return null;
  const k = id + '|' + clave; if (PARTIDAS[k]) return PARTIDAS[k];
  const g = P.geo, pos = g.attributes.position, ix = g.index.array, A = [], B = [];
  for (let t = 0; t < ix.length; t += 3) {
    const i = ix[t], j = ix[t + 1], l = ix[t + 2];
    const x = (pos.getX(i) + pos.getX(j) + pos.getX(l)) / 3, y = (pos.getY(i) + pos.getY(j) + pos.getY(l)) / 3, z = (pos.getZ(i) + pos.getZ(j) + pos.getZ(l)) / 3;
    (pred(x, y, z) ? B : A).push(i, j, l);
  }
  const hacer = I => { const n = new THREE.BufferGeometry(); for (const [nm, at] of Object.entries(g.attributes)) n.setAttribute(nm, at); n.setIndex(I); n.computeBoundingSphere(); n.computeBoundingBox(); return n; };
  return (PARTIDAS[k] = { a: hacer(A), b: hacer(B), mat: P.mat, tam: P.tam });
}

// UTIL-T0 · puente 2: montarEnKit(g, lista, opc) para las salas de kit (hospital, escuela, club, iglesia…), que no usaban la utilería.
// lista: [{ id, x, y, z, ry = 0, esc, f = 0 }] (o arreglos [id, x, y, z, ry, esc, f]) en el marco del grupo g (incluye el origen O del kit; y = piso).
// Espera la carga de la utilería, pone cada pieza con un Colocador (1 llamada de dibujo por id) y lo arma dentro de g. Devuelve Promise<{ U, ok: boolean[] }>;
// ok[i] = la pieza i se colocó. opc.ocultar = Object3D | nombre (en g) | arreglo de ellos: la geometría de cajas de respaldo, que se esconde SOLO si TODAS las piezas se colocaron.
// Las colisiones F(...) del kit no se tocan. Patrón de kitEmblemas.js (bancas), ahora en una llamada.
export function montarEnKit(g, lista, opc = {}) {
  const pu = precargarUtileria(); if (!pu) return Promise.resolve({ U: null, ok: lista.map(() => false) });
  return pu.then(() => {
    const U = new Colocador(), ok = lista.map(it => { const [id, x, y, z, ry, esc, f] = Array.isArray(it) ? it : [it.id, it.x, it.y, it.z, it.ry, it.esc, it.f]; return U.poner(id, x, y, z, ry || 0, f || 0, esc); });
    if (U.n) U.armar(g);
    if (opc.ocultar && ok.length && ok.every(Boolean)) for (const o of [].concat(opc.ocultar)) { const ob = typeof o === 'string' ? g.getObjectByName(o) : o; if (ob) ob.visible = false; }
    return { U, ok };
  });
}

const TEX = {};
export function texUtil(nombre) {
  if (APAGADA || !PLANOS.has(nombre)) return null;
  if (TEX[nombre] !== undefined) return TEX[nombre];
  const t = new THREE.TextureLoader().load(BASE + 'planos/' + nombre + '.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (TEX[nombre] = t);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
export class Colocador {
  constructor() { this.L = {}; this.mallas = []; this.n = 0; }
  // copia de la pieza en (x, y, z) del marco del interior, girada rotY (frente +z), en el piso f; esc = [sx, sy, sz] opcional
  poner(id, x, y, z, rotY, f, esc) {
    if (APAGADA || !PIEZA[id]) return false;
    (this.L[id + '|' + f] ||= []).push([x, y, z, rotY, esc]); this.n++; return true;
  }
  armar(grupo) {
    for (const [clave, lst] of Object.entries(this.L)) {
      const [id, f] = clave.split('|'), P = PIEZA[id];
      for (const lod of [0, 1]) {
        const im = new THREE.InstancedMesh(lod ? P.geoL : P.geo, P.mat, lst.length);
        lst.forEach(([x, y, z, ry, e], i) => { _q.setFromAxisAngle(_Y, ry); _s.set(...(e || [1, 1, 1])); im.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s)); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = true;
        im.name = 'util:' + id; im.userData.util = { f: +f, lod }; im.visible = lod ? +f === 1 : +f === 0;   // N1-HAMILTON: como verPiso(0) (antes el LOD del piso de arriba no salía hasta subir y bajar)
        grupo.add(im); this.mallas.push(im);
      }
    }
    this.piso = 0; return this;
  }
  verPiso(f) {   // LOD por piso
    if (f === this.piso) return; this.piso = f;
    for (const m of this.mallas) { const d = Math.abs(m.userData.util.f - f); m.visible = m.userData.util.lod ? d === 1 : d === 0; }
  }
}
