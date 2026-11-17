// N1-RENDIMIENTO (carril render, 15-11-2026): LOD automático «por índice» para las mallas estáticas grandes (edificios TRELLIS, mallas
// instanciadas de casas/rocas, kits fundidos). Medido en el N1 con la iGPU: desde el inicio se dibujaban ~0,5 M de triángulos de edificios a
// 250 m y ~0,3 M de casas instanciadas a 580 m (cada una de 5-60 mil triángulos para 20-50 píxeles de pantalla).
// Cómo: meshoptimizer simplifica SOLO el índice (una vez por geometría, repartido en varios cuadros): los niveles comparten vértices,
// normales, UV y material, y las costuras de UV se respetan. Cada nivel tiene un error máximo pequeño relativo al tamaño de la pieza y se
// usa solo cuando ese error queda bajo 1 píxel en pantalla: 1 = 0,5 % del tamaño bajo 150 px de diámetro; 2 = 1,5 % bajo 50 px.
// La sombra usa el mismo nivel (decidido por la cámara principal). ?lodmallas=0 lo apaga.
import * as THREE from 'three';
import { MeshoptSimplifier } from '../../lib/meshopt/meshopt_simplifier.module.js';

const URLP = new URLSearchParams(location.search);
const APAGADO = URLP.get('lodmallas') === '0';
const MIN_TRI = 8000;
const NIVELES = [{ fr: 0.3, err: 0.005, px: 150 }, { fr: 0.08, err: 0.015, px: 50 }];
const LODS = new WeakMap();      // geometría (cualquier nivel) → [completa, n1, n2] (o null si no conviene)
const ESTADO = new WeakMap();    // malla → { n, r }
const COLA = [], EN_COLA = new WeakSet();
let listo = false, registradas = [], tEscaneo = 0, cuadro = 0;
MeshoptSimplifier.ready.then(() => { listo = true; }).catch(() => {});

const tris = g => (g.index ? g.index.count : 0) / 3;
function apta(o) {
  if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.index || o.geometry.morphAttributes.position) return false;
  const p = o.geometry.attributes.position;
  if (!p || p.itemSize !== 3 || tris(o.geometry) < MIN_TRI || o.geometry.drawRange.count !== Infinity) return false;
  if (/Splat|Spark/.test(o.constructor.name) || o.name === 'terreno' || o.name === 'cordillera') return false;
  const m = o.material; if (Array.isArray(m) && o.geometry.groups.length) return false;   // grupos por material: no se tocan
  return true;
}
function simplificar(g) {
  if (LODS.has(g)) return;
  try {
    const p = g.attributes.position, n = p.count, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = p.getX(i); pos[i * 3 + 1] = p.getY(i); pos[i * 3 + 2] = p.getZ(i); }
    const idx = g.index.array instanceof Uint32Array ? g.index.array : new Uint32Array(g.index.array), lods = [g];
    for (const N of NIVELES) {
      const [nuevo] = MeshoptSimplifier.simplify(idx, pos, 3, Math.floor(idx.length * N.fr / 3) * 3, N.err, ['LockBorder']);   // costuras de UV sin soldar: bordes fijos
      if (nuevo.length > idx.length * 0.85 || (lods.length > 1 && nuevo.length > lods[lods.length - 1].index.count * 0.85)) break;   // casi no baja: no vale la pena
      const h = new THREE.BufferGeometry(); h.attributes = g.attributes; h.setIndex(new THREE.BufferAttribute(nuevo, 1));
      if (!g.boundingSphere) g.computeBoundingSphere(); h.boundingSphere = g.boundingSphere; h.boundingBox = g.boundingBox; h.name = (g.name || 'malla') + '_lod' + lods.length;
      lods.push(h);
    }
    const r = lods.length > 1 ? lods : null; for (const h of lods) LODS.set(h, r);
  } catch (e) { LODS.set(g, null); console.warn('lodIndice:', e); }
}
function escanear(escena) {
  const vistas = new Set(registradas); registradas = [];
  escena.traverse(o => {
    if (!apta(o) && !ESTADO.has(o)) return;
    registradas.push(o);
    if (!vistas.has(o) && !ESTADO.has(o)) ESTADO.set(o, { n: 0 });
    const g = o.geometry; if (!LODS.has(g) && !EN_COLA.has(g)) { EN_COLA.add(g); COLA.push(g); }
  });
}
const _c = new THREE.Vector3(), _s = new THREE.Vector3();
// cada cuadro antes de dibujar
export function lodMallasCuadro(escena, camara, altoPx) {
  if (APAGADO || !listo) return;
  const t = performance.now();
  if (t - tEscaneo > 2000) { tEscaneo = t; escanear(escena); }
  // simplificar lo pendiente sin pasar de ~6 ms por cuadro
  while (COLA.length && performance.now() - t < 6) simplificar(COLA.shift());
  if (++cuadro % 3) return;   // elegir nivel cada 3 cuadros
  const k = altoPx / (2 * Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2) * (camara.zoom || 1)), cp = camara.position;
  for (const o of registradas) {
    const est = ESTADO.get(o), lods = LODS.get(o.geometry); if (!est || !lods) continue;
    const g0 = lods[0]; if (!g0.boundingSphere) g0.computeBoundingSphere();
    o.getWorldScale(_s); const esc = Math.max(Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z)), rG = g0.boundingSphere.radius * esc;
    let d;
    if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); _c.copy(o.boundingSphere.center).applyMatrix4(o.matrixWorld); d = _c.distanceTo(cp) - (o.boundingSphere.radius * esc - rG); }   // la copia más cercana posible
    else { _c.copy(g0.boundingSphere.center).applyMatrix4(o.matrixWorld); d = _c.distanceTo(cp); }
    const px = 2 * rG * k / Math.max(0.1, d - rG);   // diámetro en pantalla desde su punto más cercano
    let n = est.n;
    if (globalThis.__forzarLod != null) n = Math.min(globalThis.__forzarLod, lods.length - 1); else {
    while (n > 0 && px > NIVELES[n - 1].px * 1.15) n--;
    while (n < lods.length - 1 && px < NIVELES[n].px) n++; }
    if (n !== est.n || o.geometry !== lods[n]) { est.n = n; o.geometry = lods[n]; }
  }
}
// para pruebas: cuántas mallas tienen LOD y en qué nivel están
export function lodMallasEstado() {
  const c = [0, 0, 0]; let sin = 0; for (const o of registradas) { const e = ESTADO.get(o); if (e && LODS.get(o.geometry)) c[e.n]++; else sin++; }
  return { niveles: c, sinLod: sin, cola: COLA.length };
}
