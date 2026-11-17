// CACHE-MOVIL (16-11-2026): Service Worker del juego en el celular (lo registra index.html solo en el perfil Móvil y en contexto
// seguro: https o localhost). Guarda en Cache Storage todo lo que el juego pide (js, glb, texturas, wasm, audio, json) y lo sirve sin
// red desde la segunda vez. version.json (lo escribe herramientas/publicar_manifiesto.py) trae un hash por archivo:
//  - index.html y version.json: primero la red (si no hay red, lo guardado);
//  - lo demás: primero la caché, con la llave «ruta?h=<hash>». Al publicar una versión nueva solo cambian los hashes de los archivos
//    tocados: esos se vuelven a bajar y las entradas viejas se borran; lo que no cambió sigue en el celular.
// Mensajes de la página: {tipo:'precargar', urls:[...]} (baja a la caché sin pasar por la página; responde por el puerto) y {tipo:'estado'}.
const CACHE = 'teniente-v1', BASE = new URL('./', self.location).href;
let MAN = null, MAN_P = null;
const EST = { aciertos: 0, fallos: 0, bytesRed: 0, precargados: 0 };
const rel = u => { const s = u.split(/[?#]/)[0]; return s.startsWith(BASE) ? decodeURIComponent(s.slice(BASE.length)) : null; };
async function leerMan(red) {
  const c = await caches.open(CACHE);
  if (red) try {
    const r = await fetch(BASE + 'version.json', { cache: 'no-store' });
    if (r.ok) { const j = await r.clone().json(); await c.put(BASE + 'version.json', r); if (!MAN || MAN.v !== j.v) { MAN = j; limpiar(); } return MAN; }
  } catch (e) { /* sin red */ }
  if (!MAN) { const r = await c.match(BASE + 'version.json'); if (r) MAN = await r.json(); }
  return MAN;
}
const man = red => (MAN && !red ? Promise.resolve(MAN) : (MAN_P ||= leerMan(red).finally(() => { MAN_P = null; })));
async function limpiar() {   // borra lo que ya no corresponde a la versión publicada
  if (!MAN) return; const c = await caches.open(CACHE);
  for (const q of await c.keys()) { const u = new URL(q.url), r = rel(q.url), h = u.searchParams.get('h');
    if (h && (!r || MAN.f[r] !== h)) await c.delete(q); }
}
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(man(true)); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('teniente-') && k !== CACHE) await caches.delete(k);
  await man(false); await limpiar(); await self.clients.claim(); })()));
const llave = (r, h) => BASE + r.split('/').map(encodeURIComponent).join('/') + '?h=' + h;
async function desdeCache(ev, req, r, h) {
  const c = await caches.open(CACHE), k = llave(r, h), g = await c.match(k);
  if (g) { EST.aciertos++; return g; }
  EST.fallos++;
  const resp = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
  if (resp.ok && resp.status === 200) { const cp = resp.clone();   // se guarda aparte: la página recibe la respuesta sin esperar
    ev.waitUntil(cp.arrayBuffer().then(b => { EST.bytesRed += b.byteLength;
      return c.put(k, new Response(b, { status: 200, headers: { 'Content-Type': resp.headers.get('Content-Type') || '' } })); }).catch(() => {})); }
  return resp;
}
async function primeroRed(req, nav) {
  const c = await caches.open(CACHE), k = nav ? BASE + 'index.html' : req.url.split('#')[0];
  try {
    const [resp] = await Promise.all([fetch(req, { cache: 'no-store' }), nav ? man(true) : null]);   // la página nueva y su manifiesto, juntos
    if (resp.ok) c.put(k, resp.clone()).catch(() => {});
    return resp;
  } catch (e) { const g = await c.match(k); if (g) return g; throw e; }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || req.headers.has('range')) return;
  const r = rel(req.url); if (r == null || r.startsWith('herramientas/')) return;
  if (req.mode === 'navigate' || r === '' || r === 'index.html') return e.respondWith(primeroRed(req, true));
  if (r === 'version.json') return e.respondWith(primeroRed(req, false));
  e.respondWith(man(false).then(m => { const h = m && m.f[r]; return h ? desdeCache(e, req, r, h) : fetch(req); }).catch(() => fetch(req)));
});
self.addEventListener('message', e => {
  const d = e.data || {}, port = e.ports && e.ports[0];
  if (d.tipo === 'estado') return e.waitUntil(caches.open(CACHE).then(c => c.keys()).then(k => port && port.postMessage({ ...EST, entradas: k.length, version: MAN && MAN.v })));
  if (d.tipo === 'precargar') e.waitUntil((async () => {   // de a uno: la página manda de a 1-2 cuando el cuadro va holgado
    const m = await man(false), c = await caches.open(CACHE); let n = 0;
    for (const u of d.urls || []) { const r = rel(new URL(u, BASE).href), h = m && r != null && m.f[r]; if (!h) continue;
      const k = r === 'index.html' ? BASE + 'index.html' : llave(r, h); if (r !== 'index.html' && await c.match(k)) continue;   // la página va sin hash (primeroRed)
      try { const resp = await fetch(new URL(u, BASE).href, { cache: 'no-cache', priority: 'low' });
        if (resp.ok && resp.status === 200) { const b = await resp.arrayBuffer(); EST.bytesRed += b.byteLength; EST.precargados++; n++;
          await c.put(k, new Response(b, { status: 200, headers: { 'Content-Type': resp.headers.get('Content-Type') || '' } })); } } catch (er) { /* sin red */ } }
    if (port) port.postMessage({ bajados: n });
  })());
});
