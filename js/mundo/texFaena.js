// TEX (16-11-2026, Diego: «falta aplicar las texturas»): materiales con textura para los objetos hechos en código que seguían con
// color plano (vagonetas, carros portaolla, ollas, rieles, durmientes, bancas, faroles, sacos, carretas, carretillas...).
// Todo se dibuja en canvas (CPU, sin GPU ni archivos nuevos) una sola vez y se comparte: cada textura y cada material es único en
// todo el juego (caché), así que no cuesta llamadas de dibujo extra ni memoria por copia. La madera de tablas reutiliza las tablas
// viejas del kit Sewell (assets3d/texturas/kit/tablas_viejas*.jpg, con vetas y clavos).
//   texMat(tipo, color?)   material compartido: 'tablas' 'veta' 'durmiente' 'fierro' 'oxido' 'pintado' 'acero' 'cobre' 'riel' 'olla'
//                          'arpillera' 'vidrio'. color tiñe (multiplica) la textura.
//   uvMetros(geo, esc, sx, sy, sz, modo)  UV en metros (esc m por repetición) de una pieza Box/Cylinder/Cone/Sphere/Torus ANTES de
//                          juntarla: la veta corre por el lado largo de cada cara y cada pieza parte en un punto distinto de la textura.
//                          modo 'riel': la cara de arriba toma la franja brillante de la textura del riel y los costados la oxidada.
//   uvPieza(geo, m, ...)   igual, solo si el material lo pide (m.userData.uvM): lo usan Arma() (vidaMinera) y volcar() (kitFundicion).
import * as THREE from 'three';
import { material as matKit } from './kitSewell.js';

let semillaPieza = 1;
const azPieza = () => ((semillaPieza = (semillaPieza * 16807) % 2147483647) / 2147483647);
const azar = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);

// ------------------------------------------------------------------ texturas en canvas (una vez cada una)
const TEX = new Map();
function lienzo(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }
function aTextura(c, color) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace; return t;
}
// mapa de normales a partir del brillo (sobel, con vuelta en los bordes: la textura sigue repitiendo sin costura)
function normalDe(c, fuerza) {
  const n = c.width, src = c.getContext('2d').getImageData(0, 0, n, n).data, L = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) L[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255;
  const o = lienzo(n), g = o.getContext('2d'), im = g.createImageData(n, n), d = im.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const xl = (x + n - 1) % n, xr = (x + 1) % n, yu = (y + n - 1) % n, yd = (y + 1) % n;
    const dx = (L[y * n + xr] - L[y * n + xl]) * fuerza, dy = (L[yd * n + x] - L[yu * n + x]) * fuerza;
    const nz = 1 / Math.hypot(dx, dy, 1), i = (y * n + x) * 4;
    d[i] = (-dx * nz * 0.5 + 0.5) * 255; d[i + 1] = (dy * nz * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return o;
}
// manchas suaves (óxido, polvo, tizne): círculos difusos con vuelta en los bordes
function mancha(g, n, x, y, r, color) {
  for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
    const cx = x + ox, cy = y + oy; if (cx + r < 0 || cx - r > n || cy + r < 0 || cy - r > n) continue;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}
function grano(g, n, az, k, v0, dv, a, t = 2) { for (let i = 0; i < k; i++) { const v = v0 + az() * dv | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(az() * n, az() * n, t, t); } }

// madera de una pieza (veta larga a lo largo de u = x del canvas), con nudos y grietas; gastada: gris, rajada y con tizne de aceite
function dibujarVeta(g, n, az, base, gastada) {
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 26; i++) { const y = az() * n, h = 6 + az() * 40; g.fillStyle = `rgba(${az() < 0.5 ? '0,0,0' : '255,240,220'},${0.04 + az() * 0.07})`; g.fillRect(0, y, n, h); }   // bandas de color
  for (let i = 0; i < 150; i++) {   // vetas: líneas onduladas que cruzan todo el ancho (repiten en x)
    const y0 = az() * n, amp = 1 + az() * 5, fr = (1 + (az() * 3 | 0)) * Math.PI * 2 / n, fase = az() * 6.3;
    g.strokeStyle = `rgba(${gastada ? '30,24,18' : '50,28,12'},${0.08 + az() * 0.22})`; g.lineWidth = 0.6 + az() * 1.6; g.beginPath();
    for (let x = 0; x <= n; x += 8) { const y = y0 + Math.sin(x * fr + fase) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  }
  for (let i = 0; i < 5; i++) {   // nudos
    const x = az() * n, y = az() * n, r = 4 + az() * 8;
    g.fillStyle = 'rgba(40,22,10,0.55)'; g.beginPath(); g.ellipse(x, y, r * 1.8, r, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(40,22,10,0.3)'; g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(x, y, r * 1.8 + k * 5, r + k * 3, 0, 0, 7); g.stroke(); }
  }
  if (gastada) {
    for (let i = 0; i < 26; i++) { const x = az() * n, y = az() * n, L = 30 + az() * 140; g.strokeStyle = `rgba(15,10,6,${0.35 + az() * 0.4})`; g.lineWidth = 1 + az() * 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + (az() - 0.5) * 6); g.stroke(); }   // rajaduras
    for (let i = 0; i < 18; i++) mancha(g, n, az() * n, az() * n, 20 + az() * 60, `rgba(${az() < 0.6 ? '20,16,12' : '150,140,125'},${0.12 + az() * 0.18})`);   // aceite y polvo
  }
  grano(g, n, az, 5000, 40, 140, 0.08);
}
// fierro: base, óxido en manchas y chorreado hacia abajo, rayones claros (bordes y cantos gastados)
function dibujarFierro(g, n, az, { base, oxido, rayas, pintura }) {
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  grano(g, n, az, 9000, 20, 90, 0.1, 3);
  for (let i = 0; i < 40; i++) mancha(g, n, az() * n, az() * n, 10 + az() * 50, `rgba(${base === '#2b2a28' ? '70,66,60' : '0,0,0'},${0.08 + az() * 0.12})`);   // fundición irregular
  const nO = Math.round(oxido * 90);
  for (let i = 0; i < nO; i++) { const x = az() * n, y = az() * n, r = 6 + az() * 34, t = az();
    mancha(g, n, x, y, r, t < 0.5 ? 'rgba(122,62,30,0.55)' : t < 0.8 ? 'rgba(92,44,22,0.6)' : 'rgba(160,92,44,0.45)');
    if (az() < 0.5) { g.fillStyle = 'rgba(110,56,28,0.18)'; g.fillRect(x - r * 0.2, y, r * 0.4, r * (2 + az() * 4)); } }   // chorreado
  for (let i = 0; i < oxido * 3000; i++) { g.fillStyle = `rgba(${130 + az() * 50 | 0},${60 + az() * 30 | 0},${25 + az() * 15 | 0},0.5)`; g.fillRect(az() * n, az() * n, 2, 2); }   // picado
  if (pintura) for (let i = 0; i < 70; i++) {   // pintura saltada: islas de metal y óxido
    const x = az() * n, y = az() * n, r = 2 + az() * 9; g.fillStyle = az() < 0.6 ? 'rgba(110,58,30,0.85)' : 'rgba(95,92,86,0.85)';
    g.beginPath(); g.ellipse(x, y, r * (1 + az()), r, az() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < rayas; i++) { const x = az() * n, y = az() * n, L = 6 + az() * 40, a = az() * 6.3;
    g.strokeStyle = `rgba(170,165,155,${0.15 + az() * 0.35})`; g.lineWidth = 0.6 + az(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
}
// rugosidad desde el color: óxido (rojizo) áspero, metal limpio más liso
function rugosidadDe(c, liso, aspero) {
  const n = c.width, s = c.getContext('2d').getImageData(0, 0, n, n).data, o = lienzo(n), g = o.getContext('2d'), im = g.createImageData(n, n), d = im.data;
  for (let i = 0; i < n * n; i++) { const r = s[i * 4], gg = s[i * 4 + 1], b = s[i * 4 + 2], rojo = Math.min(1, Math.max(0, (r - b) / 70));
    const v = (liso + (aspero - liso) * rojo) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return o;
}

const RECETAS = {
  veta: n => { const c = lienzo(n); dibujarVeta(c.getContext('2d'), n, azar(31), '#8a6440', false); return { c, normal: 2.5 }; },
  durmiente: n => { const c = lienzo(n); dibujarVeta(c.getContext('2d'), n, azar(57), '#6e5844', true); return { c, normal: 4 }; },
  fierro: n => { const c = lienzo(n); dibujarFierro(c.getContext('2d'), n, azar(11), { base: '#3d3b38', oxido: 0.55, rayas: 160 }); return { c, normal: 2, rough: [0.45, 0.95] }; },
  oxido: n => { const c = lienzo(n); dibujarFierro(c.getContext('2d'), n, azar(13), { base: '#6a3d24', oxido: 1.6, rayas: 60 }); return { c, normal: 3, rough: [0.6, 0.98] }; },
  pintado: n => { const c = lienzo(n); dibujarFierro(c.getContext('2d'), n, azar(17), { base: '#2b2a28', oxido: 0.25, rayas: 120, pintura: true }); return { c, normal: 1.5, rough: [0.4, 0.95] }; },
  acero: n => { const c = lienzo(n); dibujarFierro(c.getContext('2d'), n, azar(19), { base: '#6c6a66', oxido: 0.3, rayas: 260 }); return { c, normal: 1.2, rough: [0.35, 0.9] }; },
  cobre: n => { const c = lienzo(n), g = c.getContext('2d'), az = azar(23);   // cobre o latón oxidado: tono cobre con pátina oscura y cardenillo
    dibujarFierro(g, n, az, { base: '#8a5332', oxido: 0.15, rayas: 140 });
    for (let i = 0; i < 40; i++) mancha(g, n, az() * n, az() * n, 8 + az() * 40, `rgba(${az() < 0.5 ? '70,130,105' : '40,30,24'},${0.25 + az() * 0.3})`);
    return { c, normal: 1.5, rough: [0.35, 0.85] }; },
  riel: n => { const c = lienzo(n), g = c.getContext('2d'), az = azar(29), h = n / 2;   // arriba (filas 0..h): hongo pulido; abajo: alma oxidada
    dibujarFierro(g, n, az, { base: '#4a3a30', oxido: 1.1, rayas: 40 });
    g.fillStyle = '#9c9a96'; g.fillRect(0, 0, n, h);
    for (let i = 0; i < 260; i++) { const y = az() * h, v = 120 + az() * 90 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},${0.2 + az() * 0.35})`; g.fillRect(0, y, n, 1 + az() * 2); }   // rayado del roce de las ruedas
    for (let i = 0; i < 30; i++) mancha(g, n, az() * n, az() * h * 0.2, 6 + az() * 20, 'rgba(110,70,40,0.35)');
    g.fillStyle = 'rgba(90,60,40,0.5)'; g.fillRect(0, 0, n, h * 0.12); g.fillRect(0, h * 0.88, n, h * 0.12);   // cantos del hongo
    return { c, normal: 1.2, rough: [0.22, 0.9] }; },
  olla: n => { const c = lienzo(n), g = c.getContext('2d'), az = azar(37);   // olla de escoria: fierro fundido tiznado, costra de escoria chorreada desde el borde (arriba) y salpicaduras de cobre
    dibujarFierro(g, n, az, { base: '#2f2d2b', oxido: 0.35, rayas: 60 });
    for (let i = 0; i < 70; i++) { const x = az() * n, L = 20 + az() * n * 0.55, w = 5 + az() * 16;
      const gr = g.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, 'rgba(120,112,104,0.75)'); gr.addColorStop(1, 'rgba(120,112,104,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 0.3, L); g.lineTo(x - w * 0.3, L); g.fill(); }
    g.fillStyle = 'rgba(110,104,96,0.8)'; g.fillRect(0, 0, n, n * 0.05);
    for (let i = 0; i < 60; i++) mancha(g, n, az() * n, az() * n * 0.6, 2 + az() * 6, 'rgba(190,100,40,0.7)');
    for (let i = 0; i < 25; i++) mancha(g, n, az() * n, n * (0.6 + az() * 0.4), 20 + az() * 40, 'rgba(10,8,6,0.4)');
    return { c, normal: 3, rough: [0.5, 0.95] }; },
  arpillera: n => { const c = lienzo(n), g = c.getContext('2d'), az = azar(41), k = n / 128;   // tela de saco: trama de hilos gruesos, costura a lo largo y polvo abajo
    g.fillStyle = '#d6c6a2'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 128; i++) { const v = 170 + az() * 50 | 0; g.fillStyle = `rgba(${v},${v - 18},${v - 50},0.55)`; g.fillRect(i * k, 0, k * 0.62, n); }   // urdimbre
    for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) if ((i + j) % 2) { const v = 150 + az() * 60 | 0; g.fillStyle = `rgba(${v},${v - 20},${v - 55},0.7)`; g.fillRect(i * k, j * k, k, k * 0.6); }   // trama (tejido llano)
    g.strokeStyle = 'rgba(70,50,30,0.8)'; g.lineWidth = k * 1.2; for (let y = 2; y < n; y += k * 4) { g.beginPath(); g.moveTo(k, y); g.lineTo(k * 3, y + k * 2); g.stroke(); }   // costura (x ≈ 0)
    g.fillStyle = 'rgba(80,60,40,0.35)'; g.fillRect(0, 0, k * 4, n);
    for (let i = 0; i < 40; i++) mancha(g, n, az() * n, n * (0.55 + az() * 0.45), 15 + az() * 50, `rgba(120,100,75,${0.15 + az() * 0.2})`);   // polvo y tierra abajo
    for (let i = 0; i < 12; i++) mancha(g, n, az() * n, az() * n, 6 + az() * 18, 'rgba(70,60,50,0.2)');
    return { c, normal: 3 }; },
  vidrio: n => { const c = lienzo(n), g = c.getContext('2d'), az = azar(43);   // vidrio del farol: luz cálida, marco y cruz de fierro, tizne arriba
    const gr = g.createRadialGradient(n / 2, n * 0.55, 4, n / 2, n * 0.55, n * 0.6); gr.addColorStop(0, '#fff2c8'); gr.addColorStop(1, '#e6a650');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 12; i++) mancha(g, n, az() * n, az() * n * 0.4, 6 + az() * 18, 'rgba(70,50,30,0.25)');
    g.fillStyle = '#1e1d1b'; const b = n * 0.08; g.fillRect(0, 0, n, b); g.fillRect(0, n - b, n, b); g.fillRect(0, 0, b, n); g.fillRect(n - b, 0, b, n); g.fillRect(n / 2 - b * 0.3, 0, b * 0.6, n);
    return { c, normal: 0 }; },
};
const TAM = { arpillera: 512, vidrio: 128, riel: 256 };
function texturas(tipo) {
  if (TEX.has(tipo)) return TEX.get(tipo);
  const { c, normal, rough } = RECETAS[tipo](TAM[tipo] || 512);
  const r = { map: aTextura(c, true) };
  if (normal) r.normalMap = aTextura(normalDe(c, normal));
  if (rough) r.roughnessMap = aTextura(rugosidadDe(c, rough[0], rough[1]));
  const rep = PROPS[tipo] && PROPS[tipo].rep; if (rep) for (const t of Object.values(r)) t.repeat.set(...rep);   // UV propias: repetición fija por tipo
  TEX.set(tipo, r); return r;
}

// ------------------------------------------------------------------ materiales compartidos
// esc: metros por repetición de la textura (UV en metros, ver uvMetros); null = UV propias de la geometría (sacos, vidrio, olla)
const PROPS = {
  tablas: { esc: 2 }, veta: { esc: 1.5, rough: 0.9 }, durmiente: { esc: 1.6, rough: 1 },
  fierro: { esc: 1, metal: 0.55, rough: 1 }, oxido: { esc: 1, metal: 0.3, rough: 1 }, pintado: { esc: 0.8, metal: 0.35, rough: 1 },
  acero: { esc: 1, metal: 0.65, rough: 1 }, cobre: { esc: 1, metal: 0.6, rough: 1 }, riel: { esc: 1.5, metal: 0.7, rough: 1, modo: 'riel' },
  olla: { esc: null, metal: 0.45, rough: 1, rep: [3, 1] }, arpillera: { esc: null, rough: 1, rep: [2, 1] }, vidrio: { esc: null, rough: 0.3 },
};
const MATS = new Map();
// ?tex=0: sin texturas (color liso parecido), solo para comparar fps y aspecto
const SIN_TEX = /[?&]tex=0/.test(globalThis.location?.search || '');
const LISO = { tablas: 0x8a7a68, veta: 0x7a5634, durmiente: 0x5e4a3a, fierro: 0x3b3936, oxido: 0x6e4028, pintado: 0x2a2a28, acero: 0x6d6a64, cobre: 0x7a5034,
  riel: 0x6a6866, olla: 0x34322f, arpillera: 0xcdb88e, vidrio: 0xffe0a0 };
export function texMat(tipo, color = 0xffffff) {
  const k = tipo + ':' + color; if (MATS.has(k)) return MATS.get(k);
  const P = PROPS[tipo]; let m;
  if (SIN_TEX) { m = new THREE.MeshStandardMaterial({ color: new THREE.Color(LISO[tipo]).multiply(new THREE.Color(color)), roughness: 0.8, metalness: P.metal ?? 0 });
    if (tipo === 'vidrio') { m.emissive = new THREE.Color(0xffb24a); m.emissiveIntensity = 1.4; } MATS.set(k, m); return m; }
  if (tipo === 'tablas') m = matKit('tablasViejas', color);   // tablas viejas del kit (vetas y clavos); mismo material que comparten los edificios
  else {
    const T = texturas(tipo), map = T.map;
    m = new THREE.MeshStandardMaterial({ color, map, normalMap: T.normalMap || null, roughnessMap: T.roughnessMap || null, roughness: P.rough ?? 0.85, metalness: P.metal ?? 0 });
    if (tipo === 'vidrio') { m.emissive = new THREE.Color(0xffb24a); m.emissiveMap = map; m.emissiveIntensity = 1.4; }
    m.name = 'tex_' + k;
  }
  if (P.esc) m.userData = { ...m.userData, uvM: P.esc, uvModo: P.modo };
  MATS.set(k, m); return m;
}

// ------------------------------------------------------------------ UV en metros por pieza
export function uvMetros(geo, esc = 1, sx = 1, sy = 1, sz = 1, modo) {
  const uv = geo.attributes.uv; if (!uv || geo.userData.uvTex) return geo;
  geo.userData.uvTex = true;
  const P = geo.parameters || {}, t = geo.type, ou = azPieza() * 7, ov = modo === 'riel' ? 0 : azPieza() * 7;
  const pon = (i, U, V, frac, arriba) => {
    if (modo === 'riel') uv.setXY(i, U / esc + ou, (arriba ? 0.58 : 0.06) + 0.36 * frac);
    else uv.setXY(i, U / esc + ou, V / esc + ov);
  };
  if (t === 'BoxGeometry' && uv.count === 24) {
    const w = P.width * sx, h = P.height * sy, d = P.depth * sz, caras = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) { const [Lu, Lv] = caras[f], gira = Lv > Lu * 1.001;
      for (let i = f * 4; i < f * 4 + 4; i++) { const u0 = uv.getX(i), v0 = uv.getY(i);
        if (gira) pon(i, v0 * Lv, u0 * Lu, u0, f === 2); else pon(i, u0 * Lu, v0 * Lv, v0, f === 2); } }
  } else if (t === 'CylinderGeometry' || t === 'ConeGeometry') {
    const r = t === 'ConeGeometry' ? P.radius / 2 : (P.radiusTop + P.radiusBottom) / 2, rr = r * (sx + sz) / 2, h = P.height * sy;
    const nT = (P.radialSegments + 1) * (P.heightSegments + 1), per = 2 * Math.PI * rr;
    for (let i = 0; i < uv.count; i++) { const u0 = uv.getX(i), v0 = uv.getY(i);
      if (i < nT) { if (per >= h) pon(i, u0 * per, v0 * h, v0 * 0.3, false); else pon(i, v0 * h, u0 * per, u0 * 0.3, false); }
      else pon(i, (u0 - 0.5) * 2 * rr, (v0 - 0.5) * 2 * rr, 0.5, true); }
  } else if (t === 'SphereGeometry') {
    const rr = P.radius * (sx + sy + sz) / 3;
    for (let i = 0; i < uv.count; i++) pon(i, uv.getX(i) * 2 * Math.PI * rr, uv.getY(i) * Math.PI * rr, 0.5, false);
  } else if (t === 'TorusGeometry') {
    const s = (sx + sy + sz) / 3;
    for (let i = 0; i < uv.count; i++) pon(i, uv.getX(i) * P.arc * P.radius * s, uv.getY(i) * 2 * Math.PI * P.tube * s, 0.5, false);
  } else return geo;
  uv.needsUpdate = true; return geo;
}
export function uvPieza(geo, m, sx = 1, sy = 1, sz = 1) {
  const u = m && m.userData && m.userData.uvM; if (u) uvMetros(geo, u, sx, sy, sz, m.userData.uvModo); return geo;
}
// malla suelta con UV en metros (bancas, faroles, peldaños): una geometría nueva por pieza, material compartido
export function piezaTex(geo, m) { uvPieza(geo, m); const me = new THREE.Mesh(geo, m); me.castShadow = true; me.receiveShadow = true; return me; }
