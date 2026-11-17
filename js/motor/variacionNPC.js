// N0-NPC-UNICOS (15-11-2026, carril animador). Pedido de Diego: «Los personajes de todos los NPC deberían ser únicos y no repetirse;
// no puedo ver a la misma persona en un lugar y después en otro al mismo tiempo».
// Variación POR INSTANCIA de cualquier malla de NPC con esqueleto (animMalla vía personajeSplat y mallaCiudad.crearPersona), determinista
// por la semilla de cada NPC, sin duplicar texturas ni huesos ni acciones:
//  · shader (material clonado por persona, MISMO programa: customProgramCacheKey): ropa de arriba / de abajo (falda, pantalón) con color
//    de época manteniendo el detalle de la textura (luminancia relativa a la media de la zona), pelo (castaño, negro, canas…) y tono de
//    piel en rango natural. Zonas por los PESOS de los huesos (atributo «vzona», una vez por geometría) + prueba de piel por píxel.
//  · accesorios de código fundidos en UNA malla por hueso (colores por vértice, un material para todos): sombrero de fieltro, gorra,
//    boina, pañuelo, sombrero de campana; bigote, barba, anteojos; bufanda y delantal. Pegados al hueso con la matriz de enlace
//    (boneInverse · espacio de enlace): siguen cualquier pose sin medir nada por cuadro.
//  · altura ±6 % y complexión ±8 % de ancho (escala del nodo de los pies).
// Registro global: dos NPC vivos de la misma malla no comparten firma (ropa+pelo+cabeza+cara) y se elige, de 24 candidatos, el más
// distinto a los demás de su malla. Los NPC con nombre (vecina de cada casa, matrona…) llevan variante fija (FIJAS) y no ceden.
// Si la persona ya trae algo colgado en la cabeza/cuello/cadera (gente1905, obreros1905, banda, sotana) no se le pone nada encima.
// URL: ?variar=0 lo apaga (A/B) · window.__varNPC.inventario() lista los NPC vivos con su malla y variante.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const URLP = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const APAGADO = URLP.get('variar') === '0';
// no se tocan: protagonistas que se repiten a propósito y enemigos/jefe (los mineros ENEMIGOS cargan su malla aparte, en entidades.js)
const SIN_VARIAR = new Set(['nato', 'pedro', 'diego', 'jefe', 'hercules', 'condor', 'condor_vuelo', 'condor_posado']);
// perfil de cada malla: s = h(ombre) | m(ujer) | n(iño) | a (niña); uni = uniforme (ropa sin cambio: blancos de enfermera, novia, banda)
// cab: 'pelo' (pelo a la vista) | 'sombrero' (la malla ya trae sombrero: se le cambia el color de fieltro) | 'fija' (casco, cofia, velo)
// barba/lentes: la malla ya los trae · traje: arriba y abajo del mismo paño · cortas: mangas cortas (antebrazo = piel) · viejo: canas
const PERFIL = {
  vecina: { s: 'm', abrigo: 1 }, vecina_m: { s: 'm', abrigo: 1 }, anciana: { s: 'm', viejo: 1, abrigo: 1, delantal: 1 }, anciana_m: { s: 'm', viejo: 1, abrigo: 1, delantal: 1 },
  enfermera: { s: 'm', uni: 1, cab: 'fija' }, medico: { s: 'h', uni: 1, lentes: 1, sinSombrero: 1, sinCara: 1 }, doliente_minero: { s: 'h', sinLentes: 1 },
  doliente_mujer: { s: 'm', cab: 'fija', luto: 1 }, minero: { s: 'h', cab: 'fija', traje: 1 },
  oficinista: { s: 'h', cab: 'sombrero', barba: 1, viejo: 1, traje: 1 }, joven: { s: 'h' }, nino1: { s: 'n' }, nino2: { s: 'n' },
  novia: { s: 'm', uni: 1, cab: 'fija', sinLentes: 1 }, invitado: { s: 'h', cab: 'sombrero', barba: 1, traje: 1 }, gringo: { s: 'h', barba: 1, traje: 1 },
  gringo2: { s: 'h', cab: 'sombrero', barba: 1, lentes: 1, traje: 1 }, obrero1: { s: 'h', cab: 'fija' }, obrero2: { s: 'h', cab: 'fija' },
  obrero20: { s: 'h', cab: 'sombrero', barba: 1 }, musico1: { s: 'h', uni: 1, cab: 'fija' }, musico2: { s: 'h', uni: 1, cab: 'fija', barba: 1, bajo: 0x1a1a1e, sinCara: 1 },
  musico3: { s: 'h', uni: 1, cab: 'fija' }, cura: { s: 'h', uni: 1 }, padrino: { s: 'h', traje: 1 }, senora: { s: 'm', cortas: 1 },
  senora20: { s: 'm' }, dama: { s: 'a', uni: 1, cab: 'fija', sinLentes: 1 }, invitada: { s: 'm', cab: 'sombrero' }, muchacha: { s: 'm' },
  abuela: { s: 'm', viejo: 1 }, nina: { s: 'a' }, madre: { s: 'm' }, nino20: { s: 'n', cab: 'fija' },   // 16-11 noche: tipos nuevos (madre con delantal, niño de 1920 con gorra)
  musico4: { s: 'h', uni: 1, cab: 'fija', bajo: 0x1a1a1e }, musico5: { s: 'h', uni: 1, cab: 'fija', bajo: 0x1a1a1e }, musico6: { s: 'h', uni: 1, cab: 'fija', bajo: 0x1a1a1e },   // cierre 15-11 (cola10, uniforme negro) prueba_medico: { s: 'h', uni: 1 },
};
// paletas de época (paño, lana, percal): apagadas, nada chillón
const PAL = {
  saco: [0x2b2f3a, 0x3b3530, 0x4a4a46, 0x262626, 0x564431, 0x3a4234, 0x6a5c48, 0x55504a, 0x4e5a66, 0x5e5650, 0x7a6a52, 0x7c7872, 0x6e5a40, 0x5a4a52],
  luto: [0x1e1e20, 0x2a2622, 0x26282e, 0x302a28, 0x3a3836, 0x2a2430],
  abrigo: [0x3e4a5e, 0x5a6a52, 0x6a5040, 0x8a7a6a, 0x4a3a4a, 0x6e7a86, 0x7a6a58, 0x5e3a36, 0x3a3a3c, 0x7a7466],
  pantalon: [0x2a2a2c, 0x3a3632, 0x4b4740, 0x2e3440, 0x5a5044, 0x463c32, 0x6a6458, 0x383a36],
  blusa: [0xd6cebd, 0x6e3a36, 0x3e4a5e, 0x5a6a52, 0x6a5040, 0x8a7a6a, 0x4a3a4a, 0xb4a585, 0x6e7a86, 0x7a6a58, 0x2e3438, 0x8a6e5a],
  falda: [0x2a2e3a, 0x3a3030, 0x4a4a48, 0x5a4a3a, 0x3e3a46, 0x6a6258, 0x2e3a32, 0x4a3a36],
  nino: [0x3a4a3a, 0x5a3a2a, 0x2e3a52, 0x6a5a4a, 0x6e3a30, 0x4a4a4a, 0x7a6e5a, 0x354048],
  ninoAbajo: [0x5a5a5a, 0x8a7a62, 0x3a3a42, 0x2e3446, 0x4e4234, 0x6a6a64],
  pelo: [0x141210, 0x241a12, 0x3c281a, 0x5a3e28, 0x6e5034, 0x1c1814],
  canas: [0x8a8680, 0xa8a49c, 0xc8c4bc, 0x6e6a64],
  fieltro: [0x2a2622, 0x3a3028, 0x4a4440, 0x5a4a38, 0x1e1e22, 0x6a5e4e, 0x8a7a62, 0x6a6a64],
  gorra: [0x3a3a3a, 0x4a4036, 0x2e3236, 0x5a5244, 0x3a3428],
  panuelo: [0x5a3a3a, 0x3a4a5a, 0x6a6a5a, 0x4a3a2a, 0x7a6a50, 0x3a3a46, 0x8a7e6a],
  bufanda: [0x6a3030, 0x3a4a3a, 0x5a5a5a, 0x2e3a4e, 0x6a5a40, 0x4a3a46],
  delantal: [0xe0d8c8, 0xc8c0b0, 0x8a8a7a, 0xb8b0a0],
};
const PIEL = [[1.07, 1.05, 1.02], [1, 1, 1], [0.95, 0.91, 0.87], [0.88, 0.81, 0.74], [0.8, 0.71, 0.62], [1.03, 0.99, 0.95]];
// NPC con nombre: variante fija (o la ORIGINAL aprobada). Clave = lo que entidades.js pone en g.userData.varNPC (sala, nombre, quien)
const FIJAS = [
  { si: v => /hamilton/.test(v.sala || '') && v.quien === 'vecina', var: 'original' },   // ama de llaves de la Casa Hamilton: la vecina aprobada
  { si: v => v.nombre === 'Matrona', var: { pelo: 1, piel: 3, alto: 0.97, lentes: true } },
  { si: v => v.nombre === 'Guía del museo', var: { ra: 2, rb: 0, cab: 'nada', pelo: 3, extra: 'bufanda', alto: 1.03 } },
  { si: v => v.nombre === 'Exalumna', var: { ra: 7, rb: 3, cab: 'panuelo', canas: 2 } },
  { si: v => v.nombre === 'Cirujano', var: { pelo: 0, cara: 'bigote', piel: 3, alto: 1.04 } },
  { si: v => v.nombre === 'Profesor', var: { pelo: 2, canas: 0, cara: 'bigote', alto: 0.97 } },
];

// ------------------------------------------------------------------ azar determinista
function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function azar(sem) { let a = sem >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const de = (r, l) => Math.floor(r() * l) % l;

function sortear(perfil, r, interior) {   // una variante candidata (índices de paleta y piezas)
  const s = perfil.s, nino = s === 'n' || s === 'a', mujer = s === 'm' || s === 'a', viejo = !!perfil.viejo;
  const v = { piel: r() < 0.35 ? 1 : de(r, PIEL.length), alto: 1 + (r() * 2 - 1) * 0.06, ancho: 1 + (r() * 2 - 1) * 0.08 };
  v.ra = de(r, (nino ? PAL.nino : perfil.luto ? PAL.luto : perfil.abrigo ? PAL.abrigo : mujer ? PAL.blusa : PAL.saco).length);
  v.rb = perfil.traje && !mujer ? -1 : de(r, (nino ? PAL.ninoAbajo : mujer ? PAL.falda : PAL.pantalon).length);   // -1 = mismo paño (traje)
  v.pelo = de(r, PAL.pelo.length);
  v.canas = viejo ? de(r, 3) + 1 : (!nino && r() < (mujer ? 0.15 : 0.25)) ? de(r, PAL.canas.length) : -1;   // -1 sin canas
  const c = perfil.cab || 'pelo';
  if (c === 'pelo' && !perfil.sinSombrero) v.cab = nino ? ['nada', 'nada', 'gorra', 'boina'][de(r, 4)] : mujer ? ['nada', 'nada', 'panuelo', 'campana'][de(r, 4)] : ['nada', 'fieltro', 'fieltro', 'gorra', 'boina'][de(r, 5)];
  else v.cab = 'nada';
  // barba en el shader (sombra de varios días o barba corta) y el bigote de la malla: igual, afeitado o canoso
  v.barba = 0;   // la barba por shader parecía suciedad en este estilo: descartada
  v.bigote = s === 'h' && perfil.barba ? ['igual', 'castano', 'canas', 'igual'][de(r, 4)] : 'igual';
  v.cara = s === 'h' && !perfil.barba && !perfil.sinCara && c === 'pelo' ? ['nada', 'bigote', 'nada'][de(r, 3)] : 'nada';
  v.lentes = !perfil.lentes && !perfil.sinCara && !perfil.sinLentes && !nino && r() < (viejo ? 0.45 : perfil.uni ? 0.4 : 0.18);
  if (interior && v.cab !== 'nada' && v.cab !== 'panuelo') v.cab = 'nada';   // bajo techo los hombres no llevan sombrero
  v.extra = nino || perfil.luto ? 'nada' : mujer ? ['nada', perfil.delantal || perfil.luto || perfil.abrigo ? 'nada' : 'delantal', 'bufanda', 'nada'][de(r, 4)] : ['nada', 'nada', 'bufanda'][de(r, 3)];
  v.fieltro = de(r, PAL.fieltro.length); v.gorra = de(r, PAL.gorra.length); v.panuelo = de(r, PAL.panuelo.length);
  v.bufanda = de(r, PAL.bufanda.length); v.delantal = de(r, PAL.delantal.length);
  if (perfil.uni) { v.ra = -2; v.rb = -2; v.extra = 'nada'; }   // -2 = ropa original (uniforme)
  return v;
}
const rasgos = v => [v.ra, v.rb, v.cab === 'nada' ? v.pelo * 10 + (v.canas + 1) : v.cab, v.cara + (v.lentes ? '+l' : '') + (v.barba ? '+b' + v.barba : '') + (v.bigote !== 'igual' ? '+' + v.bigote : ''), v.extra];
const firma = v => rasgos(v).join('|');
const distancia = (a, b) => { const x = rasgos(a), y = rasgos(b); let d = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d++; return d + Math.abs(a.piel - b.piel) * 0.15 + Math.abs(a.alto - b.alto) * 4; };

// ------------------------------------------------------------------ registro global de variantes en uso
const VIVOS = [];
function enEscena(o) { let t = o; while (t.parent) t = t.parent; return t.isScene; }
function vivos(malla) {
  const ahora = performance.now();
  for (let i = VIVOS.length - 1; i >= 0; i--) { const e = VIVOS[i]; if (!enEscena(e.obj) && ahora - e.t0 > 15000) VIVOS.splice(i, 1); }   // recién creados aún sin colgar: se respetan 15 s
  return VIVOS.filter(e => e.malla === malla);
}
function elegir(malla, perfil, semilla, fija, interior) {
  const otros = vivos(malla);
  if (fija === 'original') return { original: true };
  const r = azar(hash(malla + '#' + semilla));
  if (fija) return Object.assign(sortear(perfil, r, interior), fija, { fija: true });
  let mejor = null, dm = -1;
  const usadas = new Set(otros.map(e => firma(e.v))), originalUsada = otros.some(e => e.v.original);
  for (let k = 0; k < 24; k++) {
    const v = sortear(perfil, r, interior);
    if (usadas.has(firma(v))) continue;
    let d = 99; for (const e of otros) if (!e.v.original) d = Math.min(d, distancia(v, e.v));
    if (d > dm) { dm = d; mejor = v; }
    if (!otros.length || d >= 3.5) break;
  }
  void originalUsada;
  return mejor || sortear(perfil, r, interior);
}

// ------------------------------------------------------------------ medidas de la malla (una vez por geometría)
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4();
const LIENZOS = new Map();
function pixeles(tex) {   // la textura base a 128x128 (para la luminancia media de cada zona)
  if (!tex || !tex.image) return null;
  if (LIENZOS.has(tex.uuid)) return LIENZOS.get(tex.uuid);
  let d = null;
  try { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(tex.image, 0, 0, 128, 128); d = x.getImageData(0, 0, 128, 128).data; } catch (e) { d = null; }
  LIENZOS.set(tex.uuid, d); return d;
}
const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export function marcoDe(malla) { return marco(malla.skeleton); }
function marco(sk) {   // posiciones de enlace de los huesos y ejes de la persona (arriba, izquierda, frente) en el espacio de enlace
  const B = {}; sk.bones.forEach((b, i) => { B[b.name] = new THREE.Vector3().setFromMatrixPosition(_m.copy(sk.boneInverses[i]).invert()); });
  const up = (B.head && B.hips) ? B.head.clone().sub(B.hips).normalize() : new THREE.Vector3(0, 1, 0);
  const izq = (B.thighL && B.thighR) ? B.thighL.clone().sub(B.thighR) : new THREE.Vector3(1, 0, 0);
  izq.addScaledVector(up, -izq.dot(up)).normalize();
  const frente = new THREE.Vector3().crossVectors(izq, up).normalize();
  return { B, up, izq, frente };
}
// atributo vzona = (ropa arriba, ropa abajo, pelo, piel posible) y medidas de cabeza, cuello y cadera
function medir(malla, perfil) {
  const ge = malla.geometry; if (ge.userData.varNPC) return ge.userData.varNPC;
  const sk = malla.skeleton, F = marco(sk), pos = ge.attributes.position, si = ge.attributes.skinIndex, sw = ge.attributes.skinWeight, uv = ge.attributes.uv;
  const nom = sk.bones.map(b => b.name), n = pos.count;
  const zonaHueso = nom.map(h => /^(spine|chest|clav|uparm)/.test(h) ? 'A' : /^forearm/.test(h) ? (perfil.cortas ? 'P' : 'A') : /^(hips|thigh|shin)/.test(h) ? 'B' : /^head/.test(h) ? 'H' : /^(neck|hand)/.test(h) ? 'P' : /^neck/.test(h) ? 'N' : '-');
  const iHead = nom.indexOf('head'), iNeck = nom.indexOf('neck'), iHips = nom.indexOf('hips');
  const P = new Float32Array(n * 3), wA = new Float32Array(n), wB = new Float32Array(n), wH = new Float32Array(n), wP = new Float32Array(n), wN = new Float32Array(n), wX = new Float32Array(n);
  let top = -1e9, bot = 1e9;
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(malla.bindMatrix); P[i * 3] = _v.x; P[i * 3 + 1] = _v.y; P[i * 3 + 2] = _v.z;
    const h = _v.dot(F.up); if (h > top) top = h; if (h < bot) bot = h;
    for (let k = 0; k < 4; k++) {
      const j = si.getComponent(i, k), w = sw.getComponent(i, k); if (!w) continue;
      const z = zonaHueso[j]; if (z === 'A') wA[i] += w; else if (z === 'B') wB[i] += w; else if (z === 'H') wH[i] += w; else if (z === 'P') wP[i] += w;
      if (j === iNeck) wN[i] += w; if (j === iHips) wX[i] += w;
    }
  }
  const p = i => _w.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  // cabeza: centro (vértices con peso de cabeza > 0,6), mentón y radio
  const cen = new THREE.Vector3(); let kc = 0, chin = 1e9;
  for (let i = 0; i < n; i++) if (wH[i] > 0.6) { cen.add(p(i)); kc++; const h = _w.dot(F.up); if (h < chin) chin = h; }
  cen.multiplyScalar(1 / Math.max(1, kc));
  const hc = cen.dot(F.up), alto = top - bot;
  // casquete (lo más alto, 5 % del alto): centro y radio → sombreros
  const cap = new THREE.Vector3(); let kk = 0, rad = 0;
  for (let i = 0; i < n; i++) { const h = p(i).dot(F.up); if (h > top - 0.05 * alto) { cap.add(_w); kk++; } }
  cap.multiplyScalar(1 / Math.max(1, kk));
  const horiz = (q, c) => { const d = q.clone().sub(c); d.addScaledVector(F.up, -d.dot(F.up)); return d; };
  let rCab = 0, rFrente = 0;
  for (let i = 0; i < n; i++) if (wH[i] > 0.6) { const h = p(i).dot(F.up); if (h > top - 0.07 * alto) rad = Math.max(rad, horiz(_w, cap).length()); if (Math.abs(h - hc) < 0.03 * alto) { const d = horiz(_w, cen); rCab = Math.max(rCab, d.length()); } }
  const H = top - chin, frenteEn = (h0, h1) => { let f = -1e9; for (let i = 0; i < n; i++) if (wH[i] > 0.5) { const h = (p(i).dot(F.up) - chin) / H; if (h > h0 && h < h1) f = Math.max(f, horiz(_w, cen).dot(F.frente)); } return f > -1e8 ? f : rCab; };
  rFrente = frenteEn(0.38, 0.55);
  // pelo: arriba del rostro o detrás de la cabeza (no los ojos, la boca ni el bigote de la malla)
  const z = new Float32Array(n * 4), zb = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let pelo = 0;
    if (wH[i] > 0.3) { const hr = (p(i).dot(F.up) - chin) / H, fr = horiz(_w, cen).dot(F.frente) / Math.max(1e-6, rCab);
      const s1 = THREE.MathUtils.smoothstep(hr, 0.6, 0.74), s2 = 1 - THREE.MathUtils.smoothstep(fr, -0.35, -0.05); pelo = Math.min(1, wH[i]) * Math.max(s1, s2);
      zb[i] = Math.min(1, wH[i] + wN[i]) * (1 - THREE.MathUtils.smoothstep(hr, 0.3, 0.4)) * THREE.MathUtils.smoothstep(fr, 0.05, 0.35); }   // mentón, mejillas bajas y bigote
    z[i * 4] = Math.min(1, wA[i]); z[i * 4 + 1] = Math.min(1, wB[i]); z[i * 4 + 2] = pelo; z[i * 4 + 3] = Math.min(1, wP[i] + wH[i]);
  }
  // cierre 15-11: uniforme con pantalón parejo (perfil.bajo, musico2): los vértices del pantalón con peso de MANO (pesos automáticos de
  // Blender que se cuelan en los muslos) quedaban como «piel posible» y al marchar se veían manchas rosadas: bajo la cadera y dentro del
  // ancho de la cadera todo es pantalón
  if (perfil.bajo != null && F.B.hips) {
    const hH = F.B.hips.dot(F.up); let aH = 0;
    for (let i = 0; i < n; i++) { const h = p(i).dot(F.up); if (Math.abs(h - hH) < 0.04 * alto) aH = Math.max(aH, Math.abs(horiz(_w, F.B.hips).dot(F.izq))); }
    for (let i = 0; i < n; i++) { const h = p(i).dot(F.up); if (h < hH - 0.02 * alto && Math.abs(horiz(_w, F.B.hips).dot(F.izq)) < aH * 1.15 && wH[i] < 0.1) { z[i * 4] = 0; z[i * 4 + 1] = 1; z[i * 4 + 3] = 0; } }
  }
  ge.setAttribute('vzona', new THREE.BufferAttribute(z, 4)); ge.setAttribute('vbarba', new THREE.BufferAttribute(zb, 1));
  // cuello (bufanda) y cadera (delantal)
  const cue = new THREE.Vector3(); let kn = 0; for (let i = 0; i < n; i++) if (wN[i] > 0.5) { cue.add(p(i)); kn++; } cue.multiplyScalar(1 / Math.max(1, kn));
  let rCue = 0; for (let i = 0; i < n; i++) if (wN[i] > 0.5) rCue = Math.max(rCue, horiz(p(i), cue).length());
  const hHip = F.B.hips ? F.B.hips.dot(F.up) : bot + alto * 0.5; let fHip = 0, aHip = 0;
  for (let i = 0; i < n; i++) { const h = p(i).dot(F.up); if (Math.abs(h - hHip) < 0.04 * alto) { const d = horiz(_w, F.B.hips || cen); fHip = Math.max(fHip, d.dot(F.frente)); aHip = Math.max(aHip, Math.abs(d.dot(F.izq))); } }
  const hRod = F.B.shinL ? F.B.shinL.dot(F.up) : hHip - 0.25 * alto; let fRod = fHip;
  for (let i = 0; i < n; i++) { const h = p(i).dot(F.up); if (Math.abs(h - hRod) < 0.03 * alto) fRod = Math.max(fRod, horiz(_w, F.B.hips || cen).dot(F.frente)); }
  const M = { F, top, bot, alto, chin, H, cen, cap, rad: rad || rCab, rCab, rFrente, cue: kn ? cue : (F.B.neck || cen), rCue: rCue || rCab * 0.6, hHip, fHip, aHip, hRod, fRod, n };
  ge.userData.varNPC = M; return M;
}
function ojos(malla, mat) {   // altura relativa de los ojos (0 mentón – 1 tope): 60 % hasta el borde superior de la piel de la frente
  const M = medir(malla, {}), ge = malla.geometry; if (M.hrOjos != null) return M.hrOjos;
  const px = pixeles(mat && mat.map), uv = ge.attributes.uv, pos = ge.attributes.position, F = M.F; let tope = -1e9;
  if (px && uv) for (let i = 0; i < pos.count; i += 2) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(malla.bindMatrix); const d = _v.clone().sub(M.cen); d.addScaledVector(F.up, -d.dot(F.up));
    if (d.dot(F.frente) < 0.45 * M.rCab) continue; const h = _v.dot(F.up); if (h < M.chin || h <= tope) continue;
    const u = uv.getX(i), v = uv.getY(i), o = (Math.min(127, Math.max(0, Math.floor((v - Math.floor(v)) * 128))) * 128 + Math.min(127, Math.max(0, Math.floor((u - Math.floor(u)) * 128)))) * 4;
    const R = px[o] / 255, G = px[o + 1] / 255, B = px[o + 2] / 255;
    if (R >= G && G >= B - 0.02 && R - B > 0.1 && 0.299 * R + 0.587 * G + 0.114 * B > 0.32) tope = h;
  }
  M.hrOjos = tope > -1e8 ? Math.max(0.35, Math.min(0.55, 0.6 * (tope - M.chin) / M.H)) : 0.47;
  // mejor: los ojos son los píxeles oscuros del frente, a los lados de la nariz, bajo la piel más alta de la frente
  const hs = [];
  if (px && uv) for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(malla.bindMatrix); const h = _v.dot(F.up), hr = (h - M.chin) / M.H; if (hr < 0.28 || hr > 0.7 || (tope > -1e8 && h > tope)) continue;
    const d = _v.clone().sub(M.cen); d.addScaledVector(F.up, -d.dot(F.up)); const lat = Math.abs(d.dot(F.izq)) / M.rCab;
    if (d.dot(F.frente) < 0.5 * M.rCab || lat < 0.12 || lat > 0.6) continue;
    const u = uv.getX(i), v = uv.getY(i), o = (Math.min(127, Math.max(0, Math.floor((v - Math.floor(v)) * 128))) * 128 + Math.min(127, Math.max(0, Math.floor((u - Math.floor(u)) * 128)))) * 4;
    if (0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2] < 60) hs.push(hr);
  }
  if (hs.length >= 4) { hs.sort((a, b) => a - b); M.hrOjos = hs[Math.floor(hs.length * 0.2)]; }   // percentil bajo: sin cejas ni visera
  // boca: labios (rojizos) o bigote de la malla, al centro del frente, bajo los ojos → el bigote de código va justo encima
  const hb = [];
  if (px && uv) for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(malla.bindMatrix); const hr = (_v.dot(F.up) - M.chin) / M.H; if (hr < 0.05 || hr > M.hrOjos - 0.08) continue;
    const d = _v.clone().sub(M.cen); d.addScaledVector(F.up, -d.dot(F.up)); if (d.dot(F.frente) < 0.5 * M.rCab || Math.abs(d.dot(F.izq)) > 0.22 * M.rCab) continue;
    const u = uv.getX(i), v = uv.getY(i), o = (Math.min(127, Math.max(0, Math.floor((v - Math.floor(v)) * 128))) * 128 + Math.min(127, Math.max(0, Math.floor((u - Math.floor(u)) * 128)))) * 4;
    if (px[o] - px[o + 1] > 45 && px[o] > 110) hb.push(hr);
  }
  hb.sort((a, b) => a - b); M.hrBoca = hb.length >= 3 ? hb[Math.floor(hb.length * 0.25)] : M.hrOjos * 0.45;
  let f = -1e9; for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(malla.bindMatrix); const hr = (_v.dot(F.up) - M.chin) / M.H; if (Math.abs(hr - M.hrOjos + 0.01) > 0.05) continue;
    const d = _v.clone().sub(M.cen); d.addScaledVector(F.up, -d.dot(F.up)); if (Math.abs(d.dot(F.izq)) < 0.5 * M.rCab) f = Math.max(f, d.dot(F.frente)); }
  if (f > 0) M.rFrente = f; return M.hrOjos;
}
function luminancias(malla, mat) {   // luminancia media (lineal) de cada zona en la textura: el tinte conserva el detalle relativo
  const ge = malla.geometry, k = 'lref' + (mat.map ? mat.map.uuid : '0');
  if (ge.userData[k]) return ge.userData[k];
  const z = ge.attributes.vzona, uv = ge.attributes.uv, px = pixeles(mat.map), S = [0, 0, 0], W = [0, 0, 0];
  if (px && uv) for (let i = 0; i < z.count; i += 3) {
    const u = uv.getX(i), v = uv.getY(i), x = Math.min(127, Math.max(0, Math.floor((u - Math.floor(u)) * 128))), y = Math.min(127, Math.max(0, Math.floor((v - Math.floor(v)) * 128))), o = (y * 128 + x) * 4;
    const L = 0.2126 * lin(px[o] / 255) + 0.7152 * lin(px[o + 1] / 255) + 0.0722 * lin(px[o + 2] / 255);
    for (let c = 0; c < 3; c++) { const w = z.getComponent(i, c); S[c] += L * w; W[c] += w; }
  }
  const r = new THREE.Vector3(...S.map((s, c) => (W[c] > 0 ? Math.max(0.02, s / W[c]) : 0.2)));
  ge.userData[k] = r; return r;
}

// ------------------------------------------------------------------ shader (un programa para todas las personas)
function vestir(mat, U, lref) {
  const m = mat.clone(); m.userData.varNPC = true;
  const u = Object.assign({ uLref: { value: lref } }, U);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec4 vzona;\nattribute float vbarba;\nvarying vec4 vZn;\nvarying float vBa;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvZn = vzona; vBa = vbarba;');
    sh.fragmentShader = 'uniform vec3 uRA, uRB, uPelo, uPiel, uLref;\n// 16-11 (Diego: «como pintados con acuarela»): el tinte seguía la luminancia de la textura hasta ×2,4 y agrandaba sus manchas; ahora\n// conserva solo la mitad del contraste (raíz) y lo acota: queda el detalle (pliegues, botones) sin las manchas de TRELLIS\nfloat suav(float k, float tope) { return clamp(mix(1.0, sqrt(max(k, 0.0)), 0.75), 0.6, tope); }\nuniform float uKA, uKB, uKP, uBarba, uTopeB;\nuniform vec2 uBig;\nvarying vec4 vZn;\nvarying float vBa;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb, cs = sqrt(c);
        float L = dot(c, vec3(0.2126, 0.7152, 0.0722)), Ls = dot(cs, vec3(0.299, 0.587, 0.114));
        float mx = max(cs.r, max(cs.g, cs.b)), mn = min(cs.r, min(cs.g, cs.b)), sat = (mx - mn) / (mx + 1e-4);
        float esPiel = step(cs.b, cs.g + 0.01) * step(cs.g, cs.r + 0.01) * smoothstep(0.06, 0.14, cs.r - cs.b) * (1.0 - smoothstep(0.62, 0.75, sat)) * smoothstep(0.26, 0.36, Ls);
        float kPiel = vZn.w * esPiel * (1.0 - step(uTopeB, 1.2) * smoothstep(0.08, 0.35, vZn.y));   // pantalón de uniforme (uTopeB 1,15): las manchas rosadas no son piel
        vec3 r = c;
        r = mix(r, uRA * suav(L / uLref.x, 1.5), uKA * vZn.x * (1.0 - kPiel));
        float uniB = step(uTopeB, 1.2);   // pantalón de uniforme parejo: todo lo que es de abajo, aunque el peso sea parcial (manchas rosadas de musico2 al marchar)
        r = mix(r, uRB * suav(L / uLref.y, min(uTopeB, 1.5)) * (1.0 - 0.25 * uniB), uKB * mix(vZn.y, smoothstep(0.08, 0.35, vZn.y), uniB));
        r = mix(r, uPelo * suav(L / uLref.z, 1.6), uKP * vZn.z * (1.0 - esPiel));
        r = mix(r, c * uPiel, kPiel);
        float kB = vBa * (1.0 - esPiel) * (1.0 - smoothstep(0.22, 0.42, Ls));   // pelo oscuro de la cara (bigote de la malla)
        r = mix(r, vec3(0.16, 0.085, 0.045) * (0.5 + 2.0 * Ls), kB * uBig.x);   // castaño
        r = mix(r, vec3(0.42, 0.41, 0.39) * (0.6 + 1.2 * Ls), kB * uBig.y);   // canoso
        r = mix(r, uPelo * clamp(L / uLref.z, 0.25, 1.4) * 0.8, uBarba * vBa * esPiel);   // barba / sombra de barba
        diffuseColor.rgb = r;
      }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_EMISSIVEMAP\ntotalEmissiveRadiance = emissive * diffuseColor.rgb;\n#endif');
  };
  m.customProgramCacheKey = () => 'varNPC'; m.needsUpdate = true;
  return m;
}

// ------------------------------------------------------------------ accesorios (metros, marco canónico: +Y arriba, +Z frente, +X izquierda)
let MAT_ACC = null;
function matAcc() {   // un material para todos: color por vértice + el mismo brillo propio suave que las mallas (la cara no queda negra)
  if (MAT_ACC) return MAT_ACC;
  MAT_ACC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  MAT_ACC.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += 0.22 * diffuseColor.rgb;'); };
  MAT_ACC.customProgramCacheKey = () => 'varNPCacc';
  return MAT_ACC;
}
function pieza(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const oscuro = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
// sombreros: origen en lo más alto de la cabeza (centro del casquete), r = radio de la cabeza a esa altura
function sombrero(tipo, r, v) {
  const L = [];
  if (tipo === 'fieltro') {
    const c = PAL.fieltro[v.fieltro], cinta = oscuro(c, 0.45);
    L.push(pieza(new THREE.CylinderGeometry(r * 1.5, r * 1.55, 0.012, 22), c, 0, -0.055, 0));
    L.push(pieza(new THREE.CylinderGeometry(r * 0.98, r * 1.1, 0.13, 18, 1, true), c, 0, 0.01, 0));
    L.push(pieza(new THREE.SphereGeometry(r * 0.98, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0.075, 0, 0, 0, 0, 1, 0.32, 1));
    L.push(pieza(new THREE.CylinderGeometry(r * 1.115, r * 1.115, 0.026, 18, 1, true), cinta, 0, -0.04, 0));
  } else if (tipo === 'gorra') {
    const c = PAL.gorra[v.gorra];
    L.push(pieza(new THREE.SphereGeometry(r * 1.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, -0.045, -0.01, -0.08, 0, 0, 1, 0.5, 1.08));
    L.push(pieza(new THREE.CylinderGeometry(r * 1.1, r * 1.12, 0.028, 18, 1, true), c, 0, -0.04, -0.005));
    L.push(pieza(new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.008, 14, 1, false, -Math.PI / 2, Math.PI), oscuro(c, 0.8), 0, -0.05, r * 0.72, 0.12, 0, 0, 1, 1, 0.75));
  } else if (tipo === 'boina') {
    const c = PAL.gorra[(v.gorra + 2) % PAL.gorra.length];
    L.push(pieza(new THREE.SphereGeometry(r * 1.2, 16, 8), c, 0.01, -0.03, 0, 0, 0, 0.14, 1, 0.3, 1.05));
    L.push(pieza(new THREE.CylinderGeometry(r * 1.06, r * 1.08, 0.022, 18, 1, true), oscuro(c, 0.75), 0, -0.045, 0));
  } else if (tipo === 'panuelo') {   // pañuelo de cabeza: casquete que cubre arriba y atrás, abierto en la cara
    const c = PAL.panuelo[v.panuelo];
    L.push(pieza(new THREE.SphereGeometry(r * 1.1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), c, 0, -r * 1.0, -0.012, -0.32, 0, 0, 1, 1.02, 1.06));
    // costados y nuca (sin el frente: phi de la esfera de three empieza en -X y gira hacia +Z; el hueco de 150° queda al frente)
    L.push(pieza(new THREE.SphereGeometry(r * 1.12, 20, 12, Math.PI * 0.5 + Math.PI * 0.42, Math.PI * 2 - Math.PI * 0.84, Math.PI * 0.2, Math.PI * 0.62), c, 0, -r * 1.0, -0.012, 0, 0, 0, 1, 1.08, 1.06));
    L.push(pieza(new THREE.SphereGeometry(r * 0.26, 8, 6), oscuro(c, 0.85), 0, -r * 1.9, -r * 0.9, 0, 0, 0, 1.3, 0.8, 0.8));   // nudo en la nuca
  } else if (tipo === 'campana') {   // sombrero de campana (cloche) de los años 20-40
    const c = [0x6a5a48, 0x5a5048, 0x7a6a56, 0x4a4040, 0x5e5446][v.fieltro % 5], cinta = PAL.panuelo[v.panuelo];
    L.push(pieza(new THREE.SphereGeometry(r * 1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), c, 0, -r * 0.62, -0.005, 0, 0, 0, 1, 0.95, 1));
    L.push(pieza(new THREE.CylinderGeometry(r * 1.3, r * 1.38, 0.01, 22), c, 0, -r * 0.62, 0.01, 0.1));
    L.push(pieza(new THREE.CylinderGeometry(r * 1.105, r * 1.105, 0.024, 18, 1, true), cinta, 0, -r * 0.6 + 0.014, 0));
  }
  return L;
}
// cara: origen en el centro de la cabeza a la altura de los ojos; f = distancia al frente de la cara, r = radio de la cabeza
function cara(v, M, uM, pelo, hO = 0.47, hB = hO * 0.5) {
  const L = [], f = M.rFrente / uM, r = M.rCab / uM, H = M.H / uM, enH = hr => (hr - hO) * H;   // altura relativa → metros desde los ojos
  if (v.cara === 'bigote' || v.cara === 'barba') {
    const yb = enH(Math.min(hB + 0.035, hO - 0.1));
    for (const s of [-1, 1]) L.push(pieza(new THREE.CapsuleGeometry(0.012, 0.03, 3, 6), pelo, s * 0.022, yb, f * 0.96, 0, 0, s * 1.25));
  }
  if (v.lentes) {
    const y = enH(hO), mon = 0x2a2420, sep = Math.min(0.036, r * 0.36);
    for (const s of [-1, 1]) L.push(pieza(new THREE.TorusGeometry(0.019, 0.0028, 4, 14), mon, s * sep, y, f * 1.02));
    L.push(pieza(new THREE.CylinderGeometry(0.0025, 0.0025, sep * 2 - 0.038, 4), mon, 0, y + 0.004, f * 1.03, 0, 0, Math.PI / 2));
    for (const s of [-1, 1]) L.push(pieza(new THREE.CylinderGeometry(0.0022, 0.0022, f * 0.95, 4), mon, s * (sep + 0.019), y + 0.004, f * 0.52, Math.PI / 2));
  }
  return L;
}

// ------------------------------------------------------------------ cola diferida: accesorios y escala ~2 cuadros después
// (gente1905 / obreros1905 / banda / boda cuelgan su ropa justo después de cargar: así se ve si la cabeza ya trae algo)
const COLA = []; let corriendo = false;
function encolar(f) {
  COLA.push({ f, n: 0 }); if (corriendo) return; corriendo = true;
  const paso = () => { for (let i = COLA.length - 1; i >= 0; i--) if (++COLA[i].n >= 3) { const t = COLA.splice(i, 1)[0]; try { t.f(); } catch (e) { console.warn('variacionNPC', e); } }
    if (COLA.length) requestAnimationFrame(paso); else corriendo = false; };
  requestAnimationFrame(paso);
}

// ------------------------------------------------------------------ API
// r: { escena } (animMalla) o persona de mallaCiudad (tiene escena). op: { malla, raiz (nodo de los pies, se escala), alto (m),
// ancla (objeto del NPC: se busca userData.varNPC hacia arriba), semilla, fija, sinSombrero, uniforme }
let cuenta = 0;
export function variarNPC(r, op = {}) {
  if (!r || !r.escena || SIN_VARIAR.has(op.malla)) return null;
  if (APAGADO) {   // ?variar=0 (A/B): sin variar, pero registrado (original) para las hojas «antes» (herramientas/unicos_hoja.js)
    const pl = []; r.escena.traverse(o => { if (o.isSkinnedMesh && o.skeleton && o.geometry.attributes.skinIndex) pl.push(o); });
    if (pl.length) VIVOS.push({ malla: op.malla, v: { original: true }, obj: op.ancla || op.raiz || r.escena, t0: performance.now(), semilla: '', ctl: { sk: pl[0].skeleton, F: medir(pl[0], PERFIL[op.malla] || { s: 'h' }).F } });
    return null;
  }
  const perfilBase = PERFIL[op.malla] || { s: /mujer|vecina|senora|dama|nina|abuela|muchacha|novia|invitada|enfermera/.test(op.malla || '') ? 'm' : 'h' };
  const perfil = op.uniforme ? Object.assign({}, perfilBase, { uni: 1 }) : perfilBase;
  const pieles = []; r.escena.traverse(o => { if (o.isSkinnedMesh && o.skeleton && o.geometry.attributes.skinIndex) pieles.push(o); });
  if (!pieles.length) return null;
  const U = { uRA: { value: new THREE.Color() }, uRB: { value: new THREE.Color() }, uPelo: { value: new THREE.Color() }, uPiel: { value: new THREE.Vector3(1, 1, 1) },
    uKA: { value: 0 }, uKB: { value: 0 }, uKP: { value: 0 }, uBarba: { value: 0 }, uTopeB: { value: 2.4 }, uBig: { value: new THREE.Vector2() } };
  const ctl = { malla: op.malla, v: null, U, acc: [] };
  // materiales: un clon por persona (mismo programa); se rehacen si otro código cambia el material después (gente1905 clona para su tinte)
  const vestirTodo = () => { const hecho = new Map(); for (const m of pieles) { if (!m.material || m.material.userData.varNPC || !m.material.isMeshStandardMaterial) continue;
    const prev = m.material; if (!hecho.has(prev)) { medir(m, perfil); hecho.set(prev, vestir(prev, U, luminancias(m, prev))); } else medir(m, perfil); m.material = hecho.get(prev);
    if (perfil.bajo != null && m.material.roughnessMap) { m.material.roughnessMap = null; m.material.metalnessMap = null; m.material.roughness = 0.9; m.material.needsUpdate = true; } } };   // cierre 15-11: uniforme mate (brillos malva en el pantalón de musico2)
  for (const m of pieles) medir(m, perfil);
  vestirTodo();
  ctl.sk = pieles[0].skeleton; ctl.F = medir(pieles[0], perfil).F;
  const aplicar = () => {
    // semilla: la del NPC (entidades.js / ciudad) o su lugar al aparecer; NPC con nombre → FIJAS
    let ud = null; for (let o = op.ancla || op.raiz; o && !ud; o = o.parent) if (o.userData && o.userData.varNPC) ud = o.userData.varNPC;
    let fija = op.fija || null, semilla = op.semilla;
    if (ud) { semilla ??= ud.semilla; if (!fija) { const f = FIJAS.find(x => x.si(ud)); if (f) fija = f.var; } }
    if (semilla == null) { (op.ancla || op.raiz || r.escena).updateWorldMatrix(true, false); const p = new THREE.Vector3().setFromMatrixPosition((op.ancla || op.raiz || r.escena).matrixWorld); semilla = Math.round(p.x * 2) + ',' + Math.round(p.z * 2) + ',' + Math.round(p.y); }
    const v = elegir(op.malla, perfil, semilla, fija, !!(ud && ud.sala)); ctl.v = v;
    VIVOS.push({ malla: op.malla, v, obj: op.ancla || op.raiz || r.escena, t0: performance.now(), semilla: String(semilla), ctl });
    vestirTodo();
    if (v.original) return;
    // colores
    const s = perfil.s, nino = s === 'n' || s === 'a', mujer = s === 'm' || s === 'a';
    const pa = nino ? PAL.nino : perfil.luto ? PAL.luto : perfil.abrigo ? PAL.abrigo : mujer ? PAL.blusa : PAL.saco, pb = nino ? PAL.ninoAbajo : mujer ? PAL.falda : PAL.pantalon;
    if (v.ra >= 0) { U.uRA.value.set(pa[v.ra % pa.length]); U.uKA.value = 0.85; }
    if (v.rb >= 0) { U.uRB.value.set(pb[v.rb % pb.length]); U.uKB.value = 0.85; } else if (v.rb === -1 && v.ra >= 0) { U.uRB.value.copy(U.uRA.value).multiplyScalar(0.92); U.uKB.value = 0.85; }
    const pelo = v.canas >= 0 ? PAL.canas[v.canas % PAL.canas.length] : PAL.pelo[v.pelo % PAL.pelo.length];
    const cab = perfil.cab || 'pelo';
    if (cab === 'pelo') { U.uPelo.value.set(pelo); U.uKP.value = 0.8; }
    else if (cab === 'sombrero') { U.uPelo.value.set(PAL.fieltro[v.fieltro]); U.uKP.value = 0.75; }   // sombrero de la malla: otro fieltro
    const pl = PIEL[v.piel % PIEL.length]; U.uPiel.value.set(pl[0], pl[1], pl[2]);
    if (cab === 'fija') U.uPelo.value.set(pelo);   // la barba usa el color de pelo aunque la cabeza no se tiña
    U.uBarba.value = v.barba || 0; U.uBig.value.set(v.bigote === 'castano' ? 0.9 : 0, v.bigote === 'canas' ? 0.85 : 0);
    if (perfil.bajo != null) { U.uRB.value.set(perfil.bajo); U.uKB.value = 0.92; U.uTopeB.value = 1.15; }   // pantalón del uniforme parejo (musico2: manchas rosadas)
    // accesorios y escala (diferido: ver si la cabeza / el cuello / la cadera ya traen algo de otro código)
    encolar(() => {
      vestirTodo();
      const malla = pieles.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a));
      const M = medir(malla, perfil), F = M.F, sk = malla.skeleton, hueso = n => sk.bones.find(b => b.name === n);
      const uM = op.alto ? M.alto / op.alto : 1;   // unidades de enlace por metro
      const ajeno = b => !!b && b.children.some(c => !c.isBone && !c.userData.varNPC);
      const colgar = (nombreH, geos, origen) => {
        const b = hueso(nombreH); if (!b || !geos.length) return;
        const g = mergeGeometries(geos, false); if (!g) return;
        const me = new THREE.Mesh(g, matAcc()); me.userData.varNPC = true; me.castShadow = false; me.receiveShadow = false; me.frustumCulled = false;
        const base = new THREE.Matrix4().makeBasis(F.izq, F.up, F.frente).scale(new THREE.Vector3(uM, uM, uM)).setPosition(origen);
        const iB = sk.boneInverses[sk.bones.indexOf(b)];
        me.matrixAutoUpdate = false; me.matrix.copy(iB).multiply(base); b.add(me); ctl.acc.push(me);
      };
      const cabeza = hueso('head');
      if (!ajeno(cabeza)) {
        const L = [];
        if (v.cab !== 'nada' && cab === 'pelo' && !op.sinSombrero) L.push(...sombrero(v.cab, Math.max(0.085, Math.min(0.15, (Math.max(M.rad, M.rCab * 0.92) / uM) * 1.02)), v));   // moño alto (anciana): el radio del casquete es chico
        const geoS = L.length ? [mergeGeometries(L, false)] : [];
        const origenS = M.cap.clone().addScaledVector(F.up, (M.top - M.cap.dot(F.up)));
        if (geoS.length) colgar('head', geoS, origenS);
        const hO = ojos(malla, malla.material), Lc = cara(cab === 'pelo' ? v : { cara: 'nada', lentes: v.lentes }, M, uM, pelo, hO, M.hrBoca);
        if (Lc.length) colgar('head', Lc, M.cen.clone().addScaledVector(F.up, M.chin + hO * M.H - M.cen.dot(F.up)));
      }
      if (v.extra === 'bufanda' && !ajeno(hueso('neck')) && !ajeno(hueso('chest'))) {
        const rc = Math.max(0.06, Math.min(0.1, (M.rCue / uM) * 1.3)), c = PAL.bufanda[v.bufanda];
        colgar('neck', [pieza(new THREE.TorusGeometry(rc, 0.03, 6, 16), c, 0, 0, 0, Math.PI / 2, 0, 0, 1, 1, 0.9),
          pieza(new THREE.BoxGeometry(0.06, 0.2, 0.018), c, 0.03, -0.1, rc * 0.95, 0.1, 0, 0.12)], M.cue.clone().addScaledVector(F.up, -0.01 * uM));
      }
      if (v.extra === 'delantal' && !ajeno(hueso('hips'))) {   // de la cintura hasta bajo la rodilla, inclinado como el frente de la falda
        const c = PAL.delantal[v.delantal], a = Math.max(0.26, Math.min(0.36, (M.aHip / uM) * 1.6)), h = Math.min(0.62, (M.hHip - M.hRod) / uM + 0.12);
        const inc = Math.atan2(Math.max(0, M.fRod - M.fHip) / uM + 0.02, Math.max(0.2, (M.hHip - M.hRod) / uM + 0.1));
        // trozo de cono abierto (≈95°) alrededor de la cadera: sigue la curva y el vuelo de la falda
        const r0 = M.fHip / uM + 0.02, r1 = Math.max(r0 + 0.03, M.fRod / uM + 0.05 + Math.tan(inc) * 0.1), ang = Math.min(1.9, a / r0);
        const o = (F.B.hips || M.cen).clone().addScaledVector(F.up, 0.1 * uM);
        colgar('hips', [pieza(new THREE.CylinderGeometry(r0, r1, h, 12, 2, true, -ang / 2, ang), c, 0, -h / 2, 0),
          pieza(new THREE.CylinderGeometry(r0 + 0.004, r0 + 0.004, 0.032, 12, 1, true, -ang / 2 - 0.15, ang + 0.3), oscuro(c, 0.8), 0, -0.012, 0)], o);
      }
      // altura y complexión (en el nodo de los pies)
      const raiz = op.raiz || r.escena; raiz.scale.multiply(new THREE.Vector3(v.ancho, v.alto, v.ancho));
    });
  };
  aplicar();
  return ctl;
}
// para el control de calidad y el inventario
if (typeof window !== 'undefined') window.__varNPC = {
  VIVOS, PERFIL, apagado: APAGADO,
  mirar(e) {   // para las hojas: cabeza (mundo) y frente del pecho (mundo, horizontal)
    const sk = e.ctl.sk, i = sk.bones.findIndex(b => b.name === 'chest'), b = sk.bones[i]; b.updateWorldMatrix(true, false);
    const f = e.ctl.F.frente.clone().transformDirection(b.matrixWorld.clone().multiply(sk.boneInverses[i])); f.y = 0; f.normalize();
    const h = sk.bones.find(x => x.name === 'head').getWorldPosition(new THREE.Vector3()); return { f: [f.x, f.z], h: [h.x, h.y, h.z] };
  },
  inventario() { const W = new THREE.Vector3(); return VIVOS.filter(e => enEscena(e.obj)).map(e => { e.obj.getWorldPosition(W); return { malla: e.malla, firma: e.v.original ? 'original' : firma(e.v), x: +W.x.toFixed(1), y: +W.y.toFixed(1), z: +W.z.toFixed(1) }; }); },
};
