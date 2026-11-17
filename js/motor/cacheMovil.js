// CACHE-MOVIL (16-11-2026, pedido de Diego: «que en el celular no esté cargando a cada rato»). Solo en la calidad Móvil.
// 1. Caché persistente: con Service Worker (sw.js, https o localhost) todo lo pedido queda en Cache Storage; sin él (iPhone por
//    http://192.168.1.108, donde el navegador no deja registrar Service Workers) las mallas .glb se guardan en IndexedDB desde
//    GLTFLoader (gltfComprimido.js). En ambos casos la llave lleva el hash de publicar/version.json: al publicar de nuevo solo se
//    baja lo que cambió.
// 2. Precarga en segundo plano: de a 1-2 archivos, solo con el cuadro holgado (fps ≥ 28, sin cargas pendientes, en requestIdleCallback):
//    lo que pidió el nivel en la sesión anterior y, pasados 30 s de juego, los archivos del nivel siguiente (version.json → niveles).
// 3. Memoria: inventario de texturas y geometrías de la escena (VRAM estimada como herramientas/movil_texturas.js). Con más de TOPE MB
//    se liberan de la GPU (dispose: Three las vuelve a subir si se vuelven a usar; los datos siguen en la caché de cada módulo) las
//    que llevan más tiempo sin estar en la escena (LRU). Nato, Hércules, la ciudad viva y la utilería del nivel en curso están en la
//    escena y no se tocan.
// En PC no se llama a nada de esto (principal.js lo arranca solo con la calidad Móvil). ?cache=0 lo apaga. globalThis.CACHE_MOVIL: pruebas.
import { ponerCacheGlb, rutaMovil } from './gltfComprimido.js';

const Q = new URLSearchParams(location.search);
const TOPE = +(Q.get('topeMB') || 600) * 1e6;   // VRAM estimada (texturas + geometría) antes de desalojar lo que no se usa
const BASE = new URL('./', document.baseURI).href;
const EST = { modo: 'apagado', aciertos: 0, fallos: 0, bytesRed: 0, precargados: 0, cola: 0, desalojadosMB: 0, vramMB: 0 };
let MAN = null, G = null, ocupado = () => false, activo = false;
const rel = u => { const s = new URL(u, document.baseURI).href.split(/[?#]/)[0]; return s.startsWith(BASE) ? decodeURIComponent(s.slice(BASE.length)) : null; };

// ---------------------------------------------------------------- IndexedDB (sin Service Worker)
let BD = null;
const bd = () => BD ||= new Promise((ok, mal) => { const r = indexedDB.open('teniente-cache', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('archivos'); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });
const tx = (modo, f) => bd().then(d => new Promise((ok, mal) => { const t = d.transaction('archivos', modo), q = f(t.objectStore('archivos'));
  t.oncomplete = () => ok(q && q.result); t.onerror = t.onabort = () => mal(t.error); }));
const llave = r => r + '#' + MAN.f[r];
async function bajarIDB(abs, r) {
  const resp = await fetch(abs, { credentials: 'same-origin' }); if (!resp.ok) throw new Error(`HTTP ${resp.status} ${r}`);
  const b = await resp.arrayBuffer(); EST.bytesRed += b.byteLength;
  tx('readwrite', s => s.put(b, llave(r))).catch(e => console.warn('caché móvil: no se guardó', r, e && e.message));   // cuota llena: se sigue sin guardar
  return b;
}
async function glbIDB(abs) {   // lo llama GLTFLoader.load (gltfComprimido.js) con la URL ya cambiada a .movil.glb
  const r = rel(abs);
  if (!r || !MAN || !MAN.f[r]) { const resp = await fetch(abs); if (!resp.ok) throw new Error(`HTTP ${resp.status} ${abs}`); return resp.arrayBuffer(); }
  let b = null; try { b = await tx('readonly', s => s.get(llave(r))); } catch (e) { /* IndexedDB no disponible */ }
  if (b) { EST.aciertos++; return b; }
  EST.fallos++; return bajarIDB(abs, r);
}
async function limpiarIDB() {   // entradas de versiones viejas
  const ks = await tx('readonly', s => s.getAllKeys()); let n = 0;
  for (const k of ks || []) { const i = k.lastIndexOf('#'), r = k.slice(0, i); if (MAN.f[r] !== k.slice(i + 1)) { await tx('readwrite', s => s.delete(k)); n++; } }
  if (n) console.info(`caché móvil: ${n} archivos de versiones viejas borrados`);
}

// ---------------------------------------------------------------- precarga en segundo plano
const COLA = [], PEDIDOS = new Set();
export function precargar(urls) {
  if (!activo) return;
  for (const u of urls || []) { const r = rel(rutaMovil(u)); if (!r || PEDIDOS.has(r) || !MAN || !MAN.f[r]) continue;
    if (EST.modo === 'idb' && !r.endsWith('.glb')) continue;   // sin Service Worker solo las mallas van a IndexedDB
    PEDIDOS.add(r); COLA.push(r); }
  EST.cola = COLA.length;
}
const aSW = (msg) => new Promise(ok => { const c = new MessageChannel(); c.port1.onmessage = e => ok(e.data); navigator.serviceWorker.controller.postMessage(msg, [c.port2]); setTimeout(() => ok(null), 60000); });
let trabajando = false;
const holgado = () => G && (G.escena === 'juego' || G.escena === 'titulo') && !ocupado() && (G.fps || 60) >= 28;
const enCache = async r => { try { return !!(await (await caches.open('teniente-v1')).match(BASE + r.split('/').map(encodeURIComponent).join('/') + '?h=' + MAN.f[r])); } catch (e) { return false; } };
async function turno() {   // mientras el cuadro vaya holgado: de a 2 archivos que falten (lo que ya está guardado se salta sin red)
  if (trabajando) return; trabajando = true;
  try {
    while (COLA.length && holgado()) {
      const lote = [];
      while (COLA.length && lote.length < 2) { const r = COLA.shift();
        const ya = r === 'index.html' ? false : EST.modo === 'sw' ? await enCache(r) : !!(await tx('readonly', s => s.getKey(llave(r))).catch(() => null));
        if (!ya) lote.push(r); }
      EST.cola = COLA.length; if (!lote.length) continue;
      if (EST.modo === 'sw' && navigator.serviceWorker.controller) { const r = await aSW({ tipo: 'precargar', urls: lote.map(x => BASE + x) }); EST.precargados += (r && r.bajados) || 0; }
      else if (EST.modo === 'idb') for (const r of lote) { await bajarIDB(BASE + r, r); EST.precargados++; }
    }
  } catch (e) { /* sin red: se sigue con lo que venga */ }
  trabajando = false;
}
const ocio = f => (self.requestIdleCallback ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 50));

// ---------------------------------------------------------------- memoria (LRU de texturas y geometrías)
const VIVOS = new Map();   // textura o geometría → { b: bytes estimados, t: última vez vista en la escena }
const bytesTex = t => { const im = t.image || {}; if (t.isCompressedTexture) return (t.mipmaps || []).reduce((s, x) => s + (x.data ? x.data.byteLength : 0), 0);
  const w = im.width || 0, h = im.height || 0; return w * h * 4 * (t.generateMipmaps !== false ? 1.33 : 1); };
const bytesGeo = g => { let b = 0; for (const a of Object.values(g.attributes || {})) b += (a.array || (a.data && a.data.array) || { byteLength: 0 }).byteLength; if (g.index) b += g.index.array.byteLength; return b; };
function inventario() {
  const ahora = performance.now(), R = G.render, M = G.M, visto = x => { const v = VIVOS.get(x); if (v) v.t = ahora; else VIVOS.set(x, { b: x.isTexture ? bytesTex(x) : bytesGeo(x), t: ahora }); };
  const P = R.renderer && R.renderer.properties, subida = t => { try { return !P || !!P.get(t).__webglTexture; } catch (e) { return true; } };   // solo las que están en la GPU
  const tex = t => { if (t && t.isTexture && !t.isRenderTargetTexture && !t.isVideoTexture && t.image && t.image.width && subida(t)) visto(t); };
  const ver = o => {
    if (o.isSplatMesh || (o.constructor && /Splat/.test(o.constructor.name))) return;   // Spark maneja su propia memoria
    if (o.geometry && o.geometry.isBufferGeometry) visto(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      for (const k in m) tex(m[k]);
      if (m.uniforms) for (const k in m.uniforms) tex(m.uniforms[k] && m.uniforms[k].value);
    }
  };
  for (const e of [R.escena, R.aparte]) if (e) { e.traverse(ver); tex(e.background); tex(e.environment); }
  if (M && M.R && M.R.salas) for (const s of Object.values(M.R.salas)) if (s.grupo && !s.grupo.parent) s.grupo.traverse(ver);
  let total = 0; for (const v of VIVOS.values()) total += v.b;
  EST.vramMB = Math.round(total / 1e6);
  if (total <= TOPE) return;
  const viejos = [...VIVOS].filter(([, v]) => ahora - v.t > 20000).sort((a, b) => a[1].t - b[1].t);   // no vistos en 20 s, el más viejo primero
  for (const [x, v] of viejos) { if (total <= TOPE) break; x.dispose(); VIVOS.delete(x); total -= v.b; EST.desalojadosMB += v.b / 1e6; }
  EST.vramMB = Math.round(total / 1e6); EST.desalojadosMB = Math.round(EST.desalojadosMB);
}

// ---------------------------------------------------------------- arranque y latido
let nivelT = null, nivelN = 0, tInv = 0;
function latido() {
  if (!activo) return;
  ocio(() => {
    turno();
    const M = G.M, ahora = performance.now();
    if (G.escena === 'juego' && M && M.def) {
      const n = M.def.numero || 0;
      if (n !== nivelN) { nivelN = n; nivelT = ahora; }
      // último tramo: pasados 30 s de juego en el nivel se baja (sin armar nada) lo que pedirá el siguiente
      if (nivelT != null && ahora - nivelT > 30000 && MAN && MAN.niveles) { nivelT = null; precargar(MAN.niveles['n' + (n + 1)]); }
    }
    if (G.escena === 'juego' && ahora - tInv > 5000 && !ocupado()) { tInv = ahora; try { inventario(); } catch (e) { console.warn('caché móvil: inventario', e); } }
  });
  setTimeout(latido, 500);
}
export async function iniciarCacheMovil(juego, op = {}) {
  if (activo || Q.get('cache') === '0') return;
  G = juego; ocupado = op.ocupado || ocupado; activo = true;
  try { const r = await fetch('version.json', { cache: 'no-store' }); if (r.ok) MAN = await r.json(); } catch (e) { /* sin red o servidor de desarrollo */ }
  const sw = navigator.serviceWorker;
  if (sw && sw.controller) EST.modo = 'sw';
  else if (globalThis.SW_MOVIL) EST.modo = 'sw';
  if (EST.modo === 'sw') { if (!globalThis.SW_INICIO) {   // primera visita: lo que se bajó antes de que el Service Worker tomara la página va a la caché, en segundo plano
    const calentar = () => precargar(['index.html', ...performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(BASE))]);
    if (sw.controller) setTimeout(calentar, 3000); else sw.addEventListener('controllerchange', () => setTimeout(calentar, 3000), { once: true }); }
  } else if (MAN && self.indexedDB) {
    if (!MAN.f) MAN = null;
    else { EST.modo = 'idb'; ponerCacheGlb(glbIDB); limpiarIDB().catch(() => {}); }
  }
  if (!MAN) { activo = EST.modo === 'sw'; if (!activo) return; }
  globalThis.CACHE_MOVIL = { estado, precargar, inventario: () => (inventario(), EST.vramMB) };
  latido();
}
export function estado() { return { ...EST }; }
export async function estadoSW() { return navigator.serviceWorker && navigator.serviceWorker.controller ? aSW({ tipo: 'estado' }) : null; }
