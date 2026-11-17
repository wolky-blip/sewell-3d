// Arma el grey-box de un nivel: terreno, edificios con zócalo y techo a dos aguas, escaleras con rampa invisible,
// plazas, vía, andariveles, puertas a los interiores y las salas aparte. Los personajes y objetos los crea juego/entidades.js.
import { mallaDe, grupoMalla, ponerNivelKit, kitNivel, kitActivo } from './mallas.js';
import { torreKit } from './kitSewell.js';   // N2-C37: la torre de balcones con el kit
import * as THREE from 'three';
import { rellano } from './rellanos.js';
import { viaOllas } from './vidaMinera.js';
import { terrazasFundicion, construirFundicion } from './kitFundicion.js';   // N1-MOLINO (carril kit): molino y fundición de 1905
import { altura, alturaBase, crearTerreno, crearCordillera, enBarranco, matMundo, CERROS, alturaCerro, TERRAZAS, LADERA, HUECOS, limpiarHuecos, CONO, texturasSuelo, CAMINO, hayNieve } from './terreno.js';
import { terrazasCono, obrasCono, edificioGirado } from './ciudadObras.js';
import { salaKit } from './kitEmblemas.js';   // N0-EMB: interiores con el kit   // Sewell en cono (?sewell=cono, carril ciudad): solo actúa si el nivel trae def.cono
import { COLOR, SALAS } from '../datos/niveles.js';
import { SplatMesh, PackedSplats, SplatEdit, SplatEditSdf } from '@sparkjsdev/spark';
import { corregirAzul } from './corregirAzul.js';
import { precargarUtileria, piezaGrupo, Colocador, hayPieza, tamPieza } from './utileria.js';   // N0-UTIL3 (E1): carpas de malla TRELLIS (respaldo: la procedural)
import { vestirMina, escaleraMina } from './mina.js';
import { texMat, uvMetros, uvPieza, piezaTex } from './texFaena.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';   // G9 (16-11): marco de bocamina FINO   // TEX (16-11): bancas, faroles, andén, vías y durmientes con textura
// un solo modelo de Idol por archivo, compartido por todas sus copias (camarotes repetidos), con árbol de LoD
const MODELOS = new Map();
const CON_LOD = !location.search.includes('lod=no');
// N2-C24 (carril ciudad): el árbol de LoD de Spark vive en UN worker de wasm de 32 bits (tope 4 GB, ~160 B por gaussiana). Con 24 modelos
// completos (~1,2 M c/u, N2) llegaba a 4088 MB, initLodTree se caía («unreachable») y el worker quedaba roto: NINGÚN edificio con LoD
// se dibujaba en todo el nivel. Tope por nivel de modelos completos; los demás usan su versión liviana (urlMovil, 150 mil). ?topeLod=N
const TOPE_LOD = +(new URLSearchParams(location.search).get('topeLod') || 12);
const COMPLETOS = new Set();
function modelo(url, movil) {
  if (CON_LOD && movil && movil !== url && !COMPLETOS.has(url)) { if (COMPLETOS.size >= TOPE_LOD) url = movil; else COMPLETOS.add(url); }
  if (!MODELOS.has(url)) MODELOS.set(url, new PackedSplats({ url, lod: CON_LOD })); return MODELOS.get(url); }

const PISO = 3.2;   // alto de un piso
const mats = new Map();
export function mat(color, op = {}) {
  const k = color + JSON.stringify(op);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: op.rough ?? 0.8, metalness: op.metal ?? 0, emissive: op.emisivo ?? 0x000000, emissiveIntensity: op.brillo ?? 1, transparent: !!op.alfa, opacity: op.alfa ?? 1, side: op.doble ? THREE.DoubleSide : THREE.FrontSide }));
  return mats.get(k);
}
// textura de fachada: tinglado de color con ventanas de guillotina de marco blanco (una por cada 3 m × 1 piso)
const texFachada = new Map();
function fachada(color, oscura) {
  const k = color + (oscura ? 'n' : '');
  if (texFachada.has(k)) return texFachada.get(k);
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'), base = new THREE.Color(color);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.07)'; for (let y = 0; y < 64; y += 5) g.fillRect(0, y, 64, 1);   // tinglado
  g.fillStyle = '#f7f5ef'; g.fillRect(18, 12, 28, 40);                                          // marco blanco
  g.fillStyle = oscura ? '#ffcf7a' : '#2c3e57'; g.fillRect(21, 15, 22, 34);                      // vidrio (de noche, luz cálida)
  g.fillStyle = '#f7f5ef'; g.fillRect(31, 15, 2, 34); g.fillRect(21, 31, 22, 2); g.fillRect(16, 51, 32, 3);   // cuarterones y alféizar
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.anisotropy = 16;   // R-1: anisotropía máxima (three la recorta al tope de la GPU)
  texFachada.set(k, t); return t;
}
export function letreroTex(texto, fondo = '#f3e6c8', tinta = '#3a2410', ancho = 512) {
  const c = document.createElement('canvas'); c.width = ancho; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = fondo; g.fillRect(0, 0, ancho, 128); g.strokeStyle = tinta; g.lineWidth = 8; g.strokeRect(4, 4, ancho - 8, 120);
  g.fillStyle = tinta; g.textAlign = 'center'; g.textBaseline = 'middle';
  let tam = 78; g.font = `bold ${tam}px Georgia, serif`;
  while (g.measureText(texto).width > ancho - 40 && tam > 20) { tam -= 4; g.font = `bold ${tam}px Georgia, serif`; }
  g.fillText(texto, ancho / 2, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// caja con UV a escala de mundo (para que las ventanas tengan siempre el mismo tamaño)
function cajaFachada(sx, sy, sz, color, oscura) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const uv = geo.attributes.uv;
  const esc = [[sz / 3, sy / PISO], [sz / 3, sy / PISO], [0, 0], [0, 0], [sx / 3, sy / PISO], [sx / 3, sy / PISO]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v, [a, b] = esc[f];
    if (a === 0) uv.setXY(i, 0.03, 0.03); else uv.setXY(i, uv.getX(i) * a, uv.getY(i) * b);
  }
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: fachada(color, oscura), roughness: 0.85 }));
  return m;
}
function malla(geo, material, sombra = true) { const m = new THREE.Mesh(geo, material); m.castShadow = sombra; m.receiveShadow = true; return m; }
function caja(sx, sy, sz, color, op) { return malla(new THREE.BoxGeometry(sx, sy, sz), mat(color, op)); }
function tubo(a, b, r, color) {
  const d = new THREE.Vector3().subVectors(b, a), m = malla(new THREE.CylinderGeometry(r, r, d.length(), 6), mat(color, { metal: 0.3, rough: 0.5 }), false);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}
const hash = n => { let h = Math.sin(n * 12.9898) * 43758.5453; return h - Math.floor(h); };

// ------------------------------------------------------------------ texturas dibujadas (canvas)
const TEXC = new Map();
function texCanvas(clave, dibujar, n = 512) {
  if (TEXC.has(clave)) return TEXC.get(clave);
  const c = document.createElement('canvas'); c.width = c.height = n; dibujar(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
  TEXC.set(clave, t); return t;
}
// losas de piedra para las plazas (antes concreto liso gris: parecía asfalto); en invierno, nieve en las juntas y en manchones
const texLosas = invierno => texCanvas('losas_' + (invierno ? 'n' : 'c'), (g, n) => {
  let sem = 19; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#8f8a80'; g.fillRect(0, 0, n, n);   // junta
  const filas = 6, alto = n / filas;
  for (let f = 0; f < filas; f++) {
    let x = f % 2 ? -alto * 0.6 : 0;
    while (x < n) {
      const w = alto * (1.1 + az() * 0.9), v = 160 + az() * 40 | 0;
      g.fillStyle = `rgb(${v},${v - 5},${v - 14})`; g.fillRect(x + 2, f * alto + 2, w - 4, alto - 4);
      for (let i = 0; i < 30; i++) { const u = 120 + az() * 90 | 0; g.fillStyle = `rgba(${u},${u - 4},${u - 10},0.25)`; g.fillRect(x + 2 + az() * (w - 6), f * alto + 2 + az() * (alto - 6), 3, 2); }
      x += w;
    }
  }
  if (invierno) {
    g.strokeStyle = 'rgba(240,245,252,0.75)'; g.lineWidth = 3; for (let f = 0; f <= filas; f++) { g.beginPath(); g.moveTo(0, f * alto); g.lineTo(n, f * alto); g.stroke(); }   // nieve en las juntas
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(242,246,252,${0.35 + az() * 0.5})`; g.beginPath(); g.ellipse(az() * n, az() * n, 12 + az() * 50, 6 + az() * 24, az() * 3, 0, 7); g.fill(); }   // manchones
  }
});
// peldaños de la escalera central: concreto gastado (grano, manchas, canto más oscuro y juntas); en invierno, polvo de nieve
const MATP = new Map();
function matPeldano(invierno) {
  const k = invierno ? 'n' : 'c'; if (MATP.has(k)) return MATP.get(k);
  const t = texCanvas('peldano_' + k, (g, n) => {
    let sem = invierno ? 11 : 7; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 9000; i++) { const v = 150 + az() * 70 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 12},0.35)`; g.fillRect(az() * n, az() * n, 2 + az() * 3, 2 + az() * 3); }   // grano
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(80,74,66,${0.05 + az() * 0.08})`; g.beginPath(); g.arc(az() * n, az() * n, 10 + az() * 40, 0, 7); g.fill(); }   // manchas de uso
    g.fillStyle = 'rgba(70,64,58,0.35)'; g.fillRect(0, 0, n, n * 0.06); g.fillRect(0, n * 0.94, n, n * 0.06);   // cantos gastados
    g.strokeStyle = 'rgba(60,56,50,0.45)'; g.lineWidth = 3; for (const x of [n * 0.33, n * 0.66]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + az() * 8 - 4, n); g.stroke(); }   // juntas
    if (invierno) for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(244,248,255,${0.35 + az() * 0.5})`; g.beginPath(); g.ellipse(az() * n, n * (0.25 + az() * 0.65), 6 + az() * 26, 3 + az() * 10, 0, 0, 7); g.fill(); }   // nieve en la huella
  });
  const m = new THREE.MeshStandardMaterial({ map: t, color: 0xffffff, roughness: 0.9 }); MATP.set(k, m); return m;
}
// TEX (16-11-2026, Diego: «falta aplicar las texturas»): andén de la estación con muro de sillería (costados) y piso de concreto
// (arriba y abajo), compartido por todos los andenes; rieles de tubo con la textura del riel (hongo pulido y alma oxidada)
let MAT_ANDEN = null;
function matAnden() {
  if (MAT_ANDEN) return MAT_ANDEN;
  const s = matMundo(texSilleria(), 2.4, 0xc4b8a6), c = matMundo('concreto', 3, 0xd0c8bc);
  return (MAT_ANDEN = [s, s, c, c, s, s]);
}
function rielTex(m) {   // tubo del riel: a lo largo, 1,5 m por repetición; arriba (normal de mundo hacia el cielo) la franja pulida, abajo la oxidada
  const g = m.geometry, uv = g.attributes.uv, nr = g.attributes.normal, h = g.parameters.height, n = new THREE.Vector3(), ou = Math.random() * 7;
  for (let i = 0; i < uv.count; i++) { n.fromBufferAttribute(nr, i).applyQuaternion(m.quaternion); uv.setXY(i, uv.getY(i) * h / 1.5 + ou, n.y > 0.35 ? 0.76 : 0.24); }
  uv.needsUpdate = true; m.material = texMat('riel'); return m;
}
// aparejo de bloques (sillería del portal del túnel, ladrillo de los cortafuegos): hiladas trabadas, tono distinto por bloque y junta de mortero
function texAparejo(clave, { filas, cols, base, varia, junta, grano = 0.25 }) {
  return texCanvas(clave, (g, n) => {
    let sem = 7; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
    g.fillStyle = junta; g.fillRect(0, 0, n, n);
    const bh = n / filas, bw = n / cols;
    for (let f = 0; f < filas; f++) for (let k = -1; k < cols; k++) {
      const x = k * bw + (f % 2 ? bw / 2 : 0), y = f * bh, v = (az() - 0.5) * varia;
      g.fillStyle = `rgb(${base[0] + v * 255 | 0},${base[1] + v * 240 | 0},${base[2] + v * 220 | 0})`;
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 2, y + bh - 5, bw - 4, 3);   // sombra bajo cada bloque
    }
    for (let i = 0; i < n * n * 0.04; i++) { const v = az() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${grano * az() * 0.4})`; g.fillRect(az() * n, az() * n, 2, 2); }   // grano
  });
}
const texSilleria = () => texAparejo('silleria', { filas: 8, cols: 4, base: [150, 142, 130], varia: 0.22, junta: '#6e665c' });
const texLadrillo = () => texAparejo('ladrillo', { filas: 24, cols: 6, base: [150, 78, 56], varia: 0.2, junta: '#b9ad9a', grano: 0.35 });
// madera de las salas: tablas (literas) y cajón con marco y diagonal (antes cajas de color liso)
function texMadera(cajon) {
  return texCanvas(cajon ? 'cajon' : 'tablas', (g, n) => {
    let sem = 11; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
    const tablas = 4, h = n / tablas;
    for (let i = 0; i < tablas; i++) {
      const v = (az() - 0.5) * 30; g.fillStyle = `rgb(${150 + v | 0},${104 + v | 0},${62 + v * 0.6 | 0})`; g.fillRect(0, i * h, n, h);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(70,40,15,${0.08 + az() * 0.12})`; g.lineWidth = 1 + az() * 2; const y = i * h + az() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(n * 0.3, y + (az() - 0.5) * 8, n * 0.7, y + (az() - 0.5) * 8, n, y + (az() - 0.5) * 6); g.stroke(); }   // veta
      g.fillStyle = 'rgba(40,22,8,0.75)'; g.fillRect(0, i * h, n, 4);   // rendija entre tablas
    }
    if (cajon) {
      const b = n * 0.11; g.fillStyle = 'rgba(120,78,40,0.95)';
      g.fillRect(0, 0, n, b); g.fillRect(0, n - b, n, b); g.fillRect(0, 0, b, n); g.fillRect(n - b, 0, b, n);   // marco
      g.save(); g.translate(n / 2, n / 2); g.rotate(Math.atan2(n - 2 * b, n - 2 * b)); g.fillRect(-n * 0.68, -b / 2, n * 1.36, b); g.restore();   // diagonal
      g.strokeStyle = 'rgba(40,22,8,0.8)'; g.lineWidth = 3; g.strokeRect(b, b, n - 2 * b, n - 2 * b); g.strokeRect(1.5, 1.5, n - 3, n - 3);
      g.fillStyle = '#2a2622'; for (const [x, y] of [[b / 2, b / 2], [n - b / 2, b / 2], [b / 2, n - b / 2], [n - b / 2, n - b / 2]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }   // clavos
    }
  }, 256);
}
// madera vieja gris a la intemperie (como la tabla del andén de Idol): tablas desteñidas, veta oscura, rendijas y nudos
let MAT_GRIS = null;
function matMaderaGris() {
  if (MAT_GRIS) return MAT_GRIS;
  const t = texCanvas('tablas_gris', (g, n) => {
    let sem = 23; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
    const tablas = 3, h = n / tablas;
    for (let i = 0; i < tablas; i++) {
      const v = (az() - 0.5) * 34; g.fillStyle = `rgb(${128 + v | 0},${121 + v | 0},${110 + v | 0})`; g.fillRect(0, i * h, n, h);
      for (let k = 0; k < 18; k++) { g.strokeStyle = `rgba(48,42,36,${0.1 + az() * 0.18})`; g.lineWidth = 1 + az() * 2.5; const y = i * h + az() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(n * 0.3, y + (az() - 0.5) * 10, n * 0.7, y + (az() - 0.5) * 10, n, y + (az() - 0.5) * 8); g.stroke(); }   // veta
      for (let k = 0; k < 2; k++) { g.fillStyle = 'rgba(52,44,36,0.6)'; g.beginPath(); g.ellipse(az() * n, i * h + h * (0.3 + az() * 0.4), 5 + az() * 6, 3 + az() * 3, 0, 0, 7); g.fill(); }   // nudos
      g.fillStyle = 'rgba(28,24,20,0.8)'; g.fillRect(0, i * h, n, 4);   // rendija
    }
  }, 256);
  MAT_GRIS = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); return MAT_GRIS;
}
const matMaderaSala = new Map();
function maderaSala(cajon) {
  if (!matMaderaSala.has(cajon)) matMaderaSala.set(cajon, new THREE.MeshStandardMaterial({ map: texMadera(cajon), roughness: 0.85 }));
  return matMaderaSala.get(cajon);
}
// ---- interiores (cine, palitroque, gimnasio, hospital): tapices de muro, terciopelo y película (antes todo color plano)
// tapiz de muro, en coordenadas de mundo con matMundo (S.tapiz): brocado del cine, listones pintados, azulejo del hospital
function texMuroSala(tipo) {
  return texCanvas('muro_' + tipo, (g, n) => {
    let sem = 23; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
    if (tipo === 'brocado') {   // burdeo con rombos y flores doradas
      g.fillStyle = '#5a1e26'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 2500; i++) { g.fillStyle = az() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(160,60,70,0.08)'; g.fillRect(az() * n, az() * n, 2, 2); }
      g.strokeStyle = 'rgba(214,168,96,0.45)'; g.lineWidth = 3;
      for (const [cx, cy] of [[n / 2, n / 2], [0, 0], [n, 0], [0, n], [n, n]]) {
        g.beginPath(); g.moveTo(cx, cy - n * 0.3); g.lineTo(cx + n * 0.2, cy); g.lineTo(cx, cy + n * 0.3); g.lineTo(cx - n * 0.2, cy); g.closePath(); g.stroke();
        g.beginPath(); g.arc(cx, cy, n * 0.06, 0, 7); g.stroke();   // roseta: círculo con cuatro puntos
        g.fillStyle = 'rgba(214,168,96,0.45)'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(cx + Math.cos(a) * n * 0.1, cy + Math.sin(a) * n * 0.1, n * 0.018, 0, 7); g.fill(); }
      }
    } else if (tipo === 'azulejo') {   // azulejo blanco verdoso con junta
      g.fillStyle = '#9fb3a6'; g.fillRect(0, 0, n, n);
      const k = 4, b = n / k;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const v = (az() - 0.5) * 14; g.fillStyle = `rgb(${214 + v | 0},${232 + v | 0},${220 + v | 0})`; g.fillRect(i * b + 3, j * b + 3, b - 6, b - 6); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(i * b + 6, j * b + 6, b * 0.35, 4); }
    } else if (tipo === 'damero') {   // baldosa de hospital en damero blanco y gris verdoso
      const k = 4, b = n / k;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const v = (az() - 0.5) * 10, cl = (i + j) % 2 ? [228, 232, 224] : [120, 140, 130]; g.fillStyle = `rgb(${cl[0] + v | 0},${cl[1] + v | 0},${cl[2] + v | 0})`; g.fillRect(i * b, j * b, b, b); }
      g.fillStyle = 'rgba(60,60,60,0.25)'; for (let i = 0; i <= k; i++) { g.fillRect(i * b - 1, 0, 2, n); g.fillRect(0, i * b - 1, n, 2); }
    } else if (tipo === 'pista') {   // pista de palitroque: tablillas angostas de maple barnizado a lo largo
      const t = 16, w = n / t;
      for (let i = 0; i < t; i++) { const v = (az() - 0.5) * 26; g.fillStyle = `rgb(${222 + v | 0},${170 + v | 0},${104 + v * 0.7 | 0})`; g.fillRect(i * w, 0, w, n); g.fillStyle = 'rgba(90,50,20,0.35)'; g.fillRect(i * w, 0, 1.5, n); }
      for (let i = 0; i < 300; i++) { g.strokeStyle = 'rgba(120,70,30,0.12)'; g.lineWidth = 1; const x = az() * n; g.beginPath(); g.moveTo(x, az() * n); g.lineTo(x + (az() - 0.5) * 2, az() * n); g.stroke(); }    } else {   // listones: tablas verticales pintadas (gimnasio, palitroque)
      const col = tipo === 'listones_verde' ? [196, 210, 190] : [236, 226, 204];
      const t = 8, w = n / t;
      for (let i = 0; i < t; i++) { const v = (az() - 0.5) * 12; g.fillStyle = `rgb(${col[0] + v | 0},${col[1] + v | 0},${col[2] + v | 0})`; g.fillRect(i * w, 0, w, n); g.fillStyle = 'rgba(80,60,40,0.28)'; g.fillRect(i * w, 0, 3, n); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(i * w + 3, 0, 2, n); }
      for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(90,70,40,0.05)'; g.fillRect(az() * n, az() * n, 1, 6); }
    }
  }, 256);
}
const texTerciopelo = () => texCanvas('terciopelo', (g, n) => {
  const v = g.createLinearGradient(0, 0, n, 0); for (let i = 0; i <= 8; i++) v.addColorStop(i / 8, i % 2 ? '#9a2430' : '#6c141d');
  g.fillStyle = v; g.fillRect(0, 0, n, n);
  let sem = 5; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1500; i++) { g.fillStyle = az() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,140,150,0.05)'; g.fillRect(az() * n, az() * n, 2, 3); }
}, 128);
// película muda en la pantalla: cordillera, tren con humo, grano y viñeta (la textura cuadrada se estira a 18x7: se dibuja comprimida)
const texPelicula = (ax = 18 / 7) => texCanvas('pelicula', (g, n) => {
  const v = g.createLinearGradient(0, 0, 0, n); v.addColorStop(0, '#e2dccb'); v.addColorStop(0.55, '#bdb29a'); v.addColorStop(1, '#857b67'); g.fillStyle = v; g.fillRect(0, 0, n, n);
  g.fillStyle = '#8a816f'; g.beginPath(); g.moveTo(0, n); for (let x = 0; x <= n; x += 8) g.lineTo(x, n * (0.4 + 0.12 * Math.abs(Math.sin(x * 0.021)) + 0.05 * Math.sin(x * 0.09))); g.lineTo(n, n); g.fill();
  g.fillStyle = '#6a6252'; g.fillRect(0, n * 0.74, n, n * 0.26);
  g.fillStyle = '#3a342b'; g.fillRect(0, n * 0.735, n, 3);   // la vía
  g.save(); g.scale(1 / ax, 1); const W = n * ax, x0 = W * 0.55, y0 = n * 0.735;
  g.fillStyle = '#2a251f';
  g.fillRect(x0, y0 - 46, 90, 34); g.fillRect(x0 + 62, y0 - 72, 36, 60); g.fillRect(x0 + 14, y0 - 66, 14, 22); g.fillRect(x0 - 8, y0 - 14, 112, 6);   // caldera, cabina, chimenea
  for (const dx of [12, 40, 72]) { g.beginPath(); g.arc(x0 + dx, y0 - 8, 9, 0, 7); g.fill(); }
  for (let k = 1; k <= 3; k++) { g.fillRect(x0 + 110 + (k - 1) * 84, y0 - 40, 76, 30); for (const dx of [12, 64]) { g.beginPath(); g.arc(x0 + 110 + (k - 1) * 84 + dx, y0 - 8, 8, 0, 7); g.fill(); } }   // carros
  for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(240,236,226,${0.55 - k * 0.06})`; g.beginPath(); g.arc(x0 + 21 - k * 26, y0 - 80 - k * 9, 12 + k * 5, 0, 7); g.fill(); }   // humo
  g.restore();
  let sem = 3; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2500; i++) { g.fillStyle = az() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'; g.fillRect(az() * n, az() * n, 1.5, 1.5); }   // grano
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,30,20,0.18)'; g.fillRect(az() * n, 0, 1, n); }   // rayas de la cinta
  const r = g.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n * 0.75); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(20,14,8,0.6)'); g.fillStyle = r; g.fillRect(0, 0, n, n);
}, 512);
// luz del día vista desde dentro: cielo arriba, suelo cálido abajo y más brillo al centro (antes un rectángulo blanco plano)
const texLuzDia = () => texCanvas('luzdia', (g, n) => {
  const v = g.createLinearGradient(0, 0, 0, n);
  v.addColorStop(0, '#cfe3f6'); v.addColorStop(0.55, '#fffaf0'); v.addColorStop(0.7, '#f1dfbf'); v.addColorStop(1, '#c9a77c');
  g.fillStyle = v; g.fillRect(0, 0, n, n);
  const r = g.createRadialGradient(n / 2, n * 0.55, 0, n / 2, n * 0.55, n * 0.7);
  r.addColorStop(0, 'rgba(255,255,250,0.7)'); r.addColorStop(1, 'rgba(255,255,250,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n);
}, 128);

// ------------------------------------------------------------------ nivel
// frente de roca del cerro: muro que sigue el perfil de la colina a lo largo del corte, del suelo a la cima
function frenteCerro(c) {
  // la malla del terreno tiene un punto cada 5 m: el corte se vuelve una rampa de 5 m. El muro va justo delante de esa rampa
  // (en el último punto sin cerro) y sube hasta la altura del primer punto con cerro, así la tapa entera.
  const pos = [], idx = [], eje = c.corte.eje, lado = c.corte.lado, G0 = eje === 'x' ? -760 : -1000, P = 5;
  const k = (c.corte.valor - G0) / P, fuera = (lado > 0 ? Math.floor(k) : Math.ceil(k)) * P + G0;
  const muro = fuera - lado * 0.1, dentro = fuera + lado * P;
  const centro = eje === 'x' ? c.z : c.x, desde = centro - c.r * 1.25, hasta = centro + c.r * 1.25;   // más acotado: a los lados quedaba una lámina delgada de roca parada
  const xz = (w, u) => eje === 'x' ? [w, u] : [u, w];
  // la cara tiene varias filas con salientes y entrantes en las dos direcciones y tonos distintos por vértice:
  // con solo base y cima se veía como un muro plano de baldosas (la textura repetida sobre un plano)
  const FILAS = 8, col = [];
  let n = 0;
  for (let u = desde; u <= hasta; u += 0.75) {
    const [xa, za] = xz(dentro, u), [xb, zb] = xz(muro - lado * 0.6, u);
    const arriba = altura(xa, za) + 0.4, base = altura(xb, zb) - 1.2;
    if (arriba - base < 3.5) { n = 0; continue; }   // donde el cerro es bajo no hay muro
    for (let f = 0; f <= FILAS; f++) {
      const t = f / FILAS, y = base + (arriba - base) * t;
      const borde = Math.sin(Math.PI * t);   // arriba y abajo queda pegada a la línea del corte (tapa la rampa del terreno)
      const off = -lado * (0.15 + borde * (0.45 * Math.abs(Math.sin(u * 0.9 + f * 1.7)) + 0.35 * Math.abs(Math.sin(u * 2.3 - f * 2.9)) + 0.5 * Math.abs(Math.sin(u * 0.37 + f * 0.8))));
      const [x, z] = xz(muro + off, u); pos.push(x, y, z);
      const v = 0.78 + 0.22 * Math.abs(Math.sin(u * 0.53 + f * 1.3)) + 0.12 * Math.sin(u * 1.9 - f * 0.7); col.push(v, v * 0.97, v * 0.93);
    }
    if (n > 0) { const i1 = pos.length / 3 - (FILAS + 1), i0 = i1 - (FILAS + 1); for (let f = 0; f < FILAS; f++) idx.push(i0 + f, i1 + f, i0 + f + 1, i0 + f + 1, i1 + f, i1 + f + 1); }
    n++;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, matMundo('suelo_roca', 7, 0xb8a894)); m.material.vertexColors = true; m.material.side = THREE.DoubleSide; m.receiveShadow = true; m.castShadow = true;
  m.material.emissive = new THREE.Color(0x6a5846);   // luz propia: visto desde atrás (lado del cerro) el frente quedaba como una lámina casi negra
  return m;
}

// ------------------------------------------------------------------ bocamina de verdad (Mina Fortuna)
// Un macizo de roca con volumen, cerrado por todos lados: frente vertical con relieve (con un vano de 3,6 x 3,6 m para la boca), cresta que baja
// hacia atrás y flancos que se funden con el terreno (no una placa: desde cualquier ángulo se ve una masa de roca). Portal de entibación de madera
// con dos marcos hacia adentro, túnel oscuro con rieles y farol, y desmonte de roca al costado. La malla del macizo también es la física.
// G9 (16-11-2026): marco de bocamina FINO (pedido de Diego: «evitemos ese estilo de acuarela»; MALLAS_FALTANTES_1611 §4). Entibación de
// rollizos pelados con veta (texFaena 'veta', UV en metros a 0,9 m por repetición: ~570 px/m), postes con inclinación hacia adentro sobre
// zapatas, cabezal (dintel) de rollizo con destaje, cuñas, collarín y abrazadera de fierro con pernos en cada ensamble, tornapuntas de
// escuadría, encostillado de rollizos delgados sobre el cabezal (sostiene la roca de la frente), cabecera de escuadría y forro de tablones a
// los costados entre el portal y la frente. Marco local: +z afuera, el portal en z 0,9, y = piso de la boca. Geometría única compartida por
// las dos bocaminas (3 mallas: rollizos, escuadría, fierro).
let MARCO_FINO = null; const MAT_DESM = {};   // G9: material de las rocas del desmonte (uno por pieza)
function marcoBocaminaFino() {
  if (MARCO_FINO) return MARCO_FINO.clone();
  const L = { tronco: [], escuadra: [], fierro: [] }, Z0 = 0.9, Y_ = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  let sem = 11; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  const colocar = (geo, a, b, giro = 0) => {   // eje y de la geometría de a hacia b
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A).normalize();
    q.setFromUnitVectors(Y_, d); if (giro) q.multiply(new THREE.Quaternion().setFromAxisAngle(Y_, giro));
    geo.applyMatrix4(m4.compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))); return geo;
  };
  const tronco = (a, b, r0, r1 = r0 * 0.93) => {   // rollizo de a (pie, r0) a b (punta, r1), con lomos y nudos suaves
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), gm = new THREE.CylinderGeometry(r1, r0, len, 16, Math.max(2, Math.round(len / 0.3)));
    uvMetros(gm, 0.9); const p = gm.attributes.position, f = az() * 6.3;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 1e-4) continue;
      const an = Math.atan2(z, x), k = 1 + 0.045 * Math.sin(an * 3 + f + y * 1.7) + 0.03 * Math.sin(an * 7 - y * 4.3 + f * 2) + 0.025 * Math.sin(y * 8.5 + f) + 0.03 * Math.max(0, Math.sin(an * 2 + y * 13 + f * 3) - 0.85) * 8;
      p.setXYZ(i, x * k, y, z * k); }
    gm.computeVertexNormals(); L.tronco.push(colocar(gm, a, b, az() * 6.3));
  };
  const viga = (a, b, w, h, tipo = 'escuadra') => { const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), gm = new THREE.BoxGeometry(w, len, h); uvMetros(gm, tipo === 'fierro' ? 0.5 : 0.8); L[tipo].push(colocar(gm, a, b)); };
  const bloque = (sx, sy, sz, x, y, z, tipo = 'escuadra', rz = 0, ry = 0) => { const gm = new THREE.BoxGeometry(sx, sy, sz); uvMetros(gm, tipo === 'fierro' ? 0.5 : 0.8);
    gm.applyMatrix4(m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)), new THREE.Vector3(1, 1, 1))); L[tipo].push(gm); };
  const anillo = (r, h, x, y, z, eje) => { const gm = new THREE.CylinderGeometry(r, r, h, 18, 1, true); uvMetros(gm, 0.5);
    if (eje === 'x') gm.rotateZ(Math.PI / 2); else if (eje === 'z') gm.rotateX(Math.PI / 2); gm.translate(x, y, z); L.fierro.push(gm); };
  const perno = (x, y, z) => { const gm = new THREE.CylinderGeometry(0.03, 0.03, 0.045, 8); gm.rotateX(Math.PI / 2); gm.translate(x, y, z); L.fierro.push(gm); };
  const YC = 4.15, RC = 0.245;   // cabezal
  for (const s of [-1, 1]) {
    bloque(0.64, 0.2, 0.64, s * 1.74, 0.1, Z0, 'escuadra', 0, az() * 0.2);                                   // zapata
    tronco([s * 1.77, 0.18, Z0], [s * 1.67, YC - RC + 0.07, Z0], 0.215, 0.198);                               // poste (inclinado hacia adentro)
    for (const dz of [-0.17, 0.17]) bloque(0.07, 0.2, 0.12, s * 1.43, YC - RC - 0.06, Z0 + dz, 'escuadra', s * 0.35);   // cuñas del destaje
    anillo(0.226, 0.09, s * 1.675, YC - RC - 0.2, Z0); anillo(0.262, 0.08, s * 1.67, YC, Z0, 'x');              // collarín del poste y abrazadera del cabezal
    bloque(0.075, 0.42, 0.018, s * 1.67, YC - RC - 0.02, Z0 + 0.225, 'fierro');                                 // grapa que une collarín y abrazadera
    for (const dy of [-0.14, 0.1]) perno(s * 1.67, YC - RC - 0.02 + dy, Z0 + 0.24);
    viga([s * 1.645, 2.95, Z0], [s * 0.92, YC - RC + 0.03, Z0], 0.15, 0.16);                                     // tornapunta
    perno(s * 1.5, 3.1, Z0 + 0.09); perno(s * 1.05, YC - RC - 0.05, Z0 + 0.09);
    for (let k = 0; k < 15; k++) {                                                                            // forro de tablones del costado
      const y = 0.14 + k * 0.258 + (az() - 0.5) * 0.02; if (y > YC - 0.1) break;
      bloque(0.055, 0.235, 1.32 + (az() - 0.5) * 0.12, s * (1.935 + az() * 0.012), y, 0.18 + (az() - 0.5) * 0.06, 'escuadra', (az() - 0.5) * 0.02);
    }
    viga([s * 1.98, 0, 0.85], [s * 1.98, YC - 0.1, 0.85], 0.1, 0.1);                                             // pie derecho que sujeta el forro
  }
  tronco([-2.42, YC - 0.01, Z0], [2.42, YC + 0.01, Z0], RC, RC * 0.94);                                         // cabezal
  for (let x = -2.1; x <= 2.11; x += 0.42) { const r = 0.08 + az() * 0.02, y = YC + RC + r - 0.02 + (az() - 0.5) * 0.02;   // encostillado (de la frente hacia afuera)
    tronco([x + (az() - 0.5) * 0.06, y, -0.5], [x + (az() - 0.5) * 0.06, y + 0.01, 1.45 + az() * 0.12], r, r * 0.92); }
  viga([-2.55, YC + RC + 0.29, 1.32], [2.55, YC + RC + 0.29, 1.32], 0.22, 0.26);                               // cabecera sobre las puntas del encostillado
  for (const s of [-1, 1]) perno(s * 2.2, YC + RC + 0.29, 1.46);
  const out = new THREE.Group();
  for (const [tipo, mt] of [['tronco', texMat('veta', 0xa59d92)], ['escuadra', texMat('durmiente', 0xd8c8b0)], ['fierro', texMat('oxido')]]) {
    const me = new THREE.Mesh(mergeGeometries(L[tipo]), mt); me.castShadow = tipo !== 'fierro'; me.receiveShadow = true; me.name = 'g9_marco_' + tipo; out.add(me);
  }
  MARCO_FINO = out; return out.clone();
}
function bocaminaReal(e, G, fis) {
  const rot = (e.rot || 0) * Math.PI / 180, nx = Math.sin(rot), nz = Math.cos(rot), tx = Math.cos(rot), tz = -Math.sin(rot);   // n: hacia afuera (frente); t: a lo largo del frente
  const W = e.t === 'tunel' ? 26 : 32, D = e.t === 'tunel' ? 16 : 20, HF = e.t === 'tunel' ? 9 : 10, FACE = -0.4;                       // ancho, fondo, alto de la cara en el centro, y la cara queda 0,4 m dentro del origen
  const ox = e.x + nx * FACE, oz = e.z + nz * FACE;
  const P = (u, v) => [ox + tx * u - nx * v, oz + tz * u - nz * v];
  let y0 = -1e9; for (const u of [-2, 0, 2]) { const [x, z] = P(u, 0); y0 = Math.max(y0, altura(x, z)); }
  const hw = W / 2, us = (() => { const a = [-1.8, 0, 1.8, -hw, hw]; for (let u = -hw + 1.25; u < hw - 0.6; u += 1.25) if (Math.abs(u) > 2.6) a.push(+u.toFixed(2)); return a.sort((p, q) => p - q); })();   // columnas cada ~1,25 m (cara con bloques) y exactas en ±1,8 (vano de la boca)
  const offs = [-1.5, 0, 1.2, 2.4, 3.6, 4.5, 5.4, 6.3, 7.2, 8.1, 9, 10];      // alturas de las filas de la cara sobre el suelo local
  const vf = [0.025, 0.06, 0.11, 0.18, 0.275, 0.4, 0.55, 0.725, 0.875, 1];   // fracciones del fondo de cada columna
  // planta irregular: el ancho y el fondo de cada columna varían con ruido, y el fondo se acorta hacia los flancos (óvalo con contorno de lóbulos), no un rectángulo
  const cont = u => 1 + 0.16 * Math.sin(u * 0.47 + 1.3) + 0.1 * Math.sin(u * 1.13 + 0.4);
  const base = u => Math.pow(Math.max(0, 1 - (2 * u / (W * cont(u * 0.5))) ** 2), 1.15);
  const fondo = u => D * (0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - (2 * u / W) ** 2))) * cont(u * 1.3 + 2);
  const ruido = (u, v, k) => Math.sin(u * 0.83 + v * 0.41 + k) * 0.5 + Math.sin(u * 1.9 - v * 0.7 + k * 2.1) * 0.3 + Math.sin(u * 0.31 + v * 1.3 - k) * 0.4;
  const pos = [], col = [], idx = [], filas = [];
  const push = (x, y, z, c) => { pos.push(x, y, z); col.push(c, c * 0.96, c * 0.92); return pos.length / 3 - 1; };
  // filas de la cara (vertical, de abajo hacia arriba); la última coincide con el labio
  for (const off of offs) {
    const fila = [];
    for (const u of us) {
      const [gx, gz] = P(u, 0), yt = altura(gx, gz), alto = HF * base(u), borde = Math.min(1, Math.max(0, (Math.abs(u) - 4.5) / 3));   // sin relieve junto a la boca
      const bi = Math.floor((u + hw) / 2.5), bj = Math.floor(off / 1.5), hb = Math.abs(Math.sin(bi * 127.1 + bj * 311.7 + e.x * 0.37) * 43758.5453) % 1;   // bloques salientes: un tercio de las celdas sobresale 0,4-1,2 m
      const bloque = hb > 0.62 ? 0.4 + 1.8 * (hb - 0.62) : 0;
      const rel = (off > 0 && off < alto - 0.4 ? 0.5 + 0.5 * ruido(u, off, 1) + bloque : 0) * 1.0 * borde;
      const [x, z] = P(u, -rel * 1.3 + 0.022 * u * u * (off > 0 ? Math.min(1, off / 3) : 0));   // los flancos se retiran hacia atrás: la cara es un baluarte redondeado, no un muro recto
      const yy = yt + Math.min(off, alto) + (off > 0 ? ruido(u, off, 3) * 0.25 * borde * Math.min(1, alto / 3) : 0);
      fila.push(push(x, yy, z, 0.82 + 0.16 * Math.abs(ruido(u, off, 5)) - (off < 0 ? 0.1 : 0)));
    }
    filas.push(fila);
  }
  const nCara = filas.length;
  // cresta y dorso: desde el labio hacia el fondo, bajando hasta el suelo
  for (const f of vf) {
    const fila = [];
    for (const u of us) {
      const v = f * fondo(u), [x, z] = P(u, v), yt = altura(x, z), p = Math.pow(1 - f, 1.25), alto = HF * base(u) * p;
      const yy = yt + alto + ruido(u * 0.8, v * 0.7, 2) * 1.5 * Math.min(1, alto / 2.5) + 0.02;
      fila.push(push(x, yy, z, 0.7 + 0.2 * Math.abs(ruido(u, v, 7))));
    }
    filas.push(fila);
  }
  // triángulos; en el vano de la boca (|u| ≤ 1,8, alturas 0 a 3,6) no hay cara: queda el hueco
  for (let r = 0; r < filas.length - 1; r++) for (let c = 0; c < us.length - 1; c++) {
    if (r < nCara - 1 && r >= 1 && r <= 3 && us[c] >= -1.8 && us[c + 1] <= 1.8) continue;
    const a = filas[r][c], b = filas[r][c + 1], d = filas[r + 1][c], f = filas[r + 1][c + 1];
    idx.push(a, d, b, b, d, f);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mt = rocaSinMosaico(6, 0xc4b3a0); mt.vertexColors = true; mt.side = THREE.DoubleSide; mt.emissive = new THREE.Color(0x4a3c30);
  const m = new THREE.Mesh(geo, mt); m.receiveShadow = true; m.castShadow = true; m.name = 'macizo_bocamina'; G.add(m);
  fis.malla(new Float32Array(pos), new Uint32Array(idx), { tipo: 'muro' });
  // portal de entibación y túnel (grupo en el origen de la bocamina, +z hacia afuera)
  const g = new THREE.Group(), mad = 0x5b3d22, madOsc = 0x2e1f12;
  // N1-C47/M4: la madera del portal lleva textura de tablas en coordenadas de mundo (antes cajas lisas café y negras)
  const matPortal = { [mad]: matMundo(texMadera(false), 1.2, 0x8a6a4a), [madOsc]: matMundo(texMadera(false), 1.2, 0x5a4634) };
  const bx = (sx, sy, sz, c, x, y, z) => { const b = matPortal[c] ? malla(new THREE.BoxGeometry(sx, sy, sz), matPortal[c]) : caja(sx, sy, sz, c); b.position.set(x, y, z); g.add(b); return b; };
  // G9 (16-11): portal FINO en código (rollizos con veta, cabezal, tornapuntas, encostillado, forro y herrajes): reemplaza el portal de
  // cajas y la malla TRELLIS «marco_bocamina» (acuarela a 1080p; el rehecho s11 salió peor). Vano libre de ~3,0 × 3,9 m (antes ~2,1 × 2,5).
  const marco = marcoBocaminaFino(); marco.name = 'g9_marco_bocamina'; g.add(marco);
  for (const z of [-0.2, -1.4, -2.6]) {                                                          // marcos de entibación hacia adentro
    for (const dx of [-1.5, 1.5]) bx(0.32, 3.5, 0.32, mad, dx, 1.75, z);
    bx(3.6, 0.32, 0.32, mad, 0, 3.5, z);
  }
  bx(3.8, 0.16, 4.7, madOsc, 0, 3.64, -2.15); for (const dx of [-1.76, 1.76]) bx(0.14, 3.6, 4.7, madOsc, dx, 1.8, -2.15);   // tablones de entibación: techo y paredes
  bx(3.3, 0.1, 4.8, 0x1a120a, 0, 0.04, -2.2);                                                    // piso de tierra oscura
  bx(3.4, 3.6, 0.1, 0x030303, 0, 1.8, -4.4);                                                     // fondo negro (profundidad: 4,4 m tras la boca)
  // N1-M4: forro de roca por fuera del túnel (sin cara frontal): si la cámara queda dentro del cerro, detrás de la boca, ve roca
  // y no la caja negra del fondo ni los tablones; desde dentro del túnel sus caras quedan de espaldas y no se dibujan
  { const rk = rocaSinMosaico(3, 0x8a7a68), nada = new THREE.MeshBasicMaterial({ visible: false });
    const forro = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.5, 4.75), [rk, rk, rk, rk, nada, rk]); forro.position.set(0, 1.95, -2.38); g.add(forro); }
  for (const dx of [-0.6, 0.6]) bx(0.09, 0.1, 5.2, 0x4a4a4e, dx, 0.14, -1.9);                    // rieles
  for (let z = 1.3; z > -4.2; z -= 0.75) bx(1.7, 0.07, 0.16, madOsc, 0, 0.1, z);                 // durmientes
  const brazo = bx(0.08, 0.08, 0.7, 0x2a2a2a, 2.3, 3.45, 1.3); const faro = bx(0.28, 0.42, 0.28, 0xffb347, 2.3, 3.1, 1.6); faro.material = new THREE.MeshBasicMaterial({ color: 0xffc060 });
  const varilla = bx(0.04, 0.3, 0.04, 0x2a2a2a, 2.3, 3.4, 1.6);
  // G9 (16-11): farol de la bocamina de malla (farol_brazo, G11) ×1,3 atornillado al costado exterior del poste derecho; el farol de cajas
  // queda de respaldo (su caja luminosa se veía como una calcomanía tras el vidrio: se oculta); la luz puntual no cambia
  { const pu = precargarUtileria(); if (pu) pu.then(() => { const m = piezaGrupo('farol_brazo', [1.3, 1.3, 1.3]); if (!m) return;
    m.rotation.y = Math.PI / 2; m.position.set(2.1, 2.88, 0.9); m.name = 'g9_farol_brazo'; g.add(m); brazo.visible = varilla.visible = faro.visible = false; }); }
  const luz = new THREE.PointLight(0xffa850, 26, 12); luz.position.set(2.3, 3.0, 2.0); g.add(luz);
  const luzInt = new THREE.PointLight(0xff9040, 9, 7); luzInt.position.set(0, 2.6, -1.5); g.add(luzInt);
  if (e.nombre) { const t = bx(3.9, 1.1, 0.12, 0x6a4a2a, 0, 5.32, 0.75); const l = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: letreroTex(e.nombre) })); l.position.set(0, 5.32, 0.82); g.add(l); }   // G9: 0,17 m más arriba, sobre la cabecera del marco FINO
  const yG = y0; g.position.set(e.x, yG, e.z); g.rotation.y = rot; G.add(g);
  // G9 (16-11): colisión de los postes del marco FINO (rollizos de r 0,21 en u ±1,71)
  for (const sg of [-1, 1]) { const u = sg * 1.71, v = 0.9; fis.caja(e.x + tx * u + nx * v, yG + 2, e.z + tz * u + nz * v, 0.44, 4, 0.44, rot, { tipo: 'muro' }); }
  // N1-M2 (carril mina): el túnel no tenía física (el macizo es una cáscara hueca): si Nato entraba desviado del disparador de 1,3 m
  // seguía de largo dentro del cerro. Paredes y fondo sólidos del túnel; el disparador ahora cubre todo el vano (revisarPuertas, boca)
  for (const [u, v, su, sv] of [[-1.95, -1.9, 0.3, 6.2], [1.95, -1.9, 0.3, 6.2], [0, -4.6, 4.2, 0.4]]) fis.caja(e.x + tx * u - nx * -v, yG + 2, e.z + tz * u - nz * -v, su, 4, sv, rot, { tipo: 'muro' });
  // N1-C60: el umbral (piso, durmientes) quedaba colgado sobre el rellano: la malla visible del suelo (vértices cada 5 m) pasa bajo la
  // cota de la boca. Cuña de tierra apisonada del ancho del portal que baja del umbral a la malla, con colisión
  // N1-V1: con el mismo sombreador del suelo (tierra triplanar y color por vértice) y costados en talud hasta bajo la malla: sin cantos de bloque
  { const W2 = 2.3, WA = 4.2, z0 = -0.2, tx = Math.cos(rot), tz = -Math.sin(rot);
    const enM = (u, z) => alturaMalla(e.x + nx * z + tx * u, e.z + nz * z + tz * u) - yG, hb0 = enM(0, z0 + 1.6);
    if (hb0 < -0.04) {
      let L = 1.8; for (let i = 0; i < 4; i++) L = Math.max(1.8, -enM(0, z0 + 1.6 + L) / 0.42 + 1.6);
      const hb1 = Math.min(enM(0, z0 + L) - 0.08, -0.05), nP = Math.max(4, Math.ceil(L / 0.5)), pos = [], col = [], mez = [], idx = [], c0 = new THREE.Color(0xb69a76);
      for (let k = 0; k <= nP; k++) {   // perfil: talud izq. (bajo la malla), borde izq., borde der., talud der.
        const z = z0 + L * k / nP, ytop = z <= z0 + 1.6 ? 0.02 - 0.02 * (z - z0) / 1.6 : (z - z0 - 1.6) / (L - 1.6) * hb1;
        for (const u of [-WA, -W2, W2, WA]) { const y = Math.abs(u) > W2 + 0.1 ? Math.min(ytop, enM(u, z)) - 0.3 : ytop; pos.push(u, y, z); col.push(c0.r, c0.g, c0.b); mez.push(0, 0); }
      }
      for (let k = 0; k < nP; k++) for (let j = 0; j < 3; j++) { const a = k * 4 + j, b = a + 1, c = a + 4, d = a + 5; idx.push(a, c, b, b, c, d); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('mezcla', new THREE.Float32BufferAttribute(mez, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const mt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }); texturasSuelo(mt);
      const cu = new THREE.Mesh(geo, mt); cu.receiveShadow = true; g.add(cu);
      g.updateMatrixWorld(true); const w = new THREE.Vector3(), pts = []; for (let i = 0; i < pos.length; i += 3) { w.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(g.matrixWorld); pts.push(w.x, w.y, w.z); }
      for (let i = 0, n0 = pts.length; i < n0; i += 12) pts.push(pts[i + 3], pts[i + 4] - 1, pts[i + 5], pts[i + 6], pts[i + 7] - 1, pts[i + 8]);   // fondo del sólido para el casco convexo
      fis.convexo(new Float32Array(pts), { tipo: 'tierra' });
    } }
  // desmonte: rocas y un montón de tierra al costado de la boca y frente a ella
  const mr = rocaSinMosaico(3, 0x9a8a78), desm = []; let sem = 7;   // G9: desm = rocas del desmonte (malla y colisión, para la roca de malla)
  const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  const lugares = [[4.5, 3], [6, 2], [7.5, 4.2], [9, 2.4], [5.2, 6], [11, 4.5], [-4, 4.5], [-6.5, 3], [3.5, 8.5]];
  for (let [u, f] of lugares) {
    if (e.t === 'tunel' && u > 0) u = -u - 2.5;   // N1-C47: en la salida el camino parte hacia +u (oriente): el desmonte va al otro lado y la salida queda despejada
    const r = 0.5 + az() * 0.9, gm = new THREE.IcosahedronGeometry(1, 2), pa = gm.attributes.position, v3 = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) { v3.fromBufferAttribute(pa, i); const k = 1 + 0.22 * Math.sin(v3.x * 3.7 + u) * Math.sin(v3.z * 3.1 + f) + 0.1 * Math.sin(v3.y * 6.1 + u * f); pa.setXYZ(i, v3.x * k, v3.y * k * 0.7, v3.z * k); }
    gm.computeVertexNormals();
    const rk = malla(gm, mr), [x, z] = P(u, -f); rk.scale.set(r * (1 + az() * 0.4), r * 0.8, r * (1 + az() * 0.4)); rk.position.set(x, altura(x, z) + r * 0.25, z); rk.rotation.y = az() * 6; G.add(rk);
    rk.updateMatrixWorld(true); { const pts = []; const w = new THREE.Vector3(), pg = gm.attributes.position; for (let i = 0; i < pg.count; i++) { w.fromBufferAttribute(pg, i).applyMatrix4(rk.matrixWorld); pts.push(w.x, w.y, w.z); } desm.push([rk, fis.convexo(new Float32Array(pts), { tipo: 'muro' })]); }   // colisión convexa simple del desmonte
  }
  // G9 (16-11): rocas del desmonte de malla (G11 roca_grande1/2: andesita de 3-4 m, textura 2048, siempre achicadas a la caja de cada roca
  // procedural); la colisión pasa a ser el casco convexo de la malla (LOD) y se quita el de la roca procedural. Respaldo: los icosaedros
  { const pu = precargarUtileria(); if (pu) pu.then(() => desm.forEach(([rk, col], i) => {
    const id = i % 2 && hayPieza('roca_grande2') ? 'roca_grande2' : 'roca_grande1', T = tamPieza(id); if (!T) return;
    const bb = new THREE.Box3().setFromObject(rk), x = rk.position.x, z = rk.position.z, yb = altura(x, z) - 0.2;
    const m = piezaGrupo(id, [(bb.max.x - bb.min.x) / T[0], (bb.max.y - yb) / T[1], (bb.max.z - bb.min.z) / T[2]]); if (!m) return;
    const me = m.children[0]; me.material = MAT_DESM[id] ||= (() => { const c = me.material.clone(); c.color.setHex(0xb8a48c); c.emissive.setHex(0x000000); return c; })();   // andesita entonada con la tierra cálida del desmonte (sin el brillo propio de interior, al sol se veía blanca)
    m.position.set(x, yb, z); m.rotation.y = rk.rotation.y; m.name = 'g9_roca_desmonte'; me.castShadow = true; G.add(m); rk.visible = false;
    const lod = piezaGrupo(id, null, 1).children[0].geometry.attributes.position, w = new THREE.Vector3(), pts = []; m.updateMatrixWorld(true);
    for (let k = 0; k < lod.count; k += 2) { w.fromBufferAttribute(lod, k).applyMatrix4(m.children[0].matrixWorld); pts.push(w.x, w.y, w.z); }
    if (fis.convexo(new Float32Array(pts), { tipo: 'muro' }) && col && fis.mundo) { fis.mundo.removeCollider(col, false); fis.etiquetas && fis.etiquetas.delete(col.handle); }
  })); }
  const tierra = malla(new THREE.SphereGeometry(1, 14, 8), rocaSinMosaico(4, 0x8c7c68)); { const [x, z] = P(-5.5, -4); tierra.scale.set(3.6, 0.9, 2.6); tierra.position.set(x, altura(x, z) + 0.1, z); tierra.rotation.y = rot; G.add(tierra); tierra.updateMatrixWorld(true); const pg = tierra.geometry.attributes.position, w = new THREE.Vector3(), pts = []; for (let i = 0; i < pg.count; i++) { w.fromBufferAttribute(pg, i).applyMatrix4(tierra.matrixWorld); pts.push(w.x, w.y, w.z); } fis.convexo(new Float32Array(pts), { tipo: 'muro' }); }
  return yG;
}

// pieza de Idol suelta (torre, andén): enderezada, dada vuelta y escalada a un alto; el centro de su base queda en el origen
let LONA = null;
function texLona() {
  if (LONA) return LONA;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  let sem = 5; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  x.fillStyle = '#d6c9a8'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) { const v = 180 + az() * 50 | 0; x.fillStyle = `rgba(${v},${v - 12},${v - 40},0.22)`; x.fillRect(az() * 256, az() * 256, 2, 1); }   // trama
  for (let y = 0; y < 256; y += 3) { x.fillStyle = `rgba(90,70,40,${0.03 + az() * 0.03})`; x.fillRect(0, y, 256, 1); }   // hilos
  x.strokeStyle = 'rgba(110,90,60,0.5)'; x.lineWidth = 2; for (let k = 40; k < 256; k += 88) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.stroke(); }   // costuras de los paños
  // barro abajo (arriba del canvas = v 1 = borde del faldón): franja difusa y salpicaduras, sin manchas sueltas a media lona
  const b = x.createLinearGradient(0, 0, 0, 70); b.addColorStop(0, 'rgba(105,80,50,0.55)'); b.addColorStop(1, 'rgba(105,80,50,0)'); x.fillStyle = b; x.fillRect(0, 0, 256, 70);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(100,76,48,${0.1 + az() * 0.2})`; x.fillRect(az() * 256, az() * az() * 60, 2 + az() * 3, 2 + az() * 3); }
  LONA = new THREE.CanvasTexture(c); LONA.colorSpace = THREE.SRGBColorSpace; LONA.wrapS = LONA.wrapT = THREE.RepeatWrapping; LONA.anisotropy = 8; return LONA;
}

function piezaSplat(sp, alto, ancho = 0) {
  const [x0, y0, z0] = sp.min, [x1, y1, z1] = sp.max, k = alto / (y1 - y0), kxz = ancho ? ancho / Math.max(x1 - x0, z1 - z0) : k;
  const afuera = new THREE.Group(), m = new THREE.Group();
  m.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.alinear || 0));
  { const info = mallaDe(sp); if (info) afuera.add(grupoMalla(info, sp)); else { const sm = new SplatMesh({ packedSplats: modelo(sp.url, sp.urlMovil), lod: CON_LOD }); corregirAzul(sm, sp.azul); m.add(sm); afuera.add(m); } }   // ?malla=1: malla de TRELLIS.2
  afuera.scale.set(kxz, k, kxz);
  afuera.position.copy(new THREE.Vector3((x0 + x1) / 2, -y1, -(z0 + z1) / 2).multiply(afuera.scale)).negate();
  const g = new THREE.Group(); g.add(afuera); return g;
}

// N2-C28 (carril codigo): torre de balcones con la malla TRELLIS (indice.json yaw 90; modelo a 20 m de alto). Medidas tomadas de la
// malla con rayos (herramientas/prog10_c28_medir*.js), relativas a (e.x, y0, e.z), y0 = pie del modelo: balcones al poniente,
// x -5,1…-3,65, z -4,5…+4,5, losas de 0,34 m con el piso a 2,51/5,44/8,41/11,16/14,08 y baranda de 0,75 m en el borde; cuerpo
// x -3,65…+3,7, z ±4,6; techo a cuatro aguas: alero ±4,1 × ±5,6 a 16,7 y punta a 20,05 en el centro.
// Cada balcón tapa por completo al de abajo (la losa de arriba quedaba sobre la cabeza: no se podía saltar de uno a otro). Se sube
// (N2-C29: ya NO hay caracol; ver «escalera de incendio» abajo) por una ESCALERA DE CARACOL de tablones al norte de los balcones: 5 tablones por piso alrededor de un poste (saltitos de ~0,58 m;
// el tablón que queda encima está un piso más arriba, así el salto no choca), con un descanso a la altura de cada balcón que entra
// por un hueco en su baranda norte (recorte de la malla). Arriba, el último descanso queda sobre el alero y se sube al techo.
const TB = { pisos: [2.513, 5.443, 8.413, 11.163, 14.083], bx0: -5.1, bx1: -3.65, bz0: -4.5, bz1: 4.5, cx1: 3.7, cz: 4.6, alero: 16.7, ax: 4.1, az: 5.6, punta: 20.05,
  poste: [-5.4, 5.9], desc: [-5.05, -3.75, 4.45, 5.55], paso: 0.58 };
function torreMalla(e, y0, G, fis, R, def, v) {
  const P = TB.pisos.map(f => y0 + f), mad = new THREE.MeshStandardMaterial({ map: texMadera(false), color: 0xb08860, roughness: 0.9 });
  const tMin = minTerreno(e.x + TB.bx0, e.x + TB.cx1, e.z - TB.cz, e.z + TB.cz);
  // cuerpo (muro) y zócalo de sillería bajo los balcones (tapa el pie del modelo, con física)
  fis.caja(e.x + (TB.bx1 + TB.cx1) / 2, (y0 + TB.alero + tMin - 1) / 2, e.z, TB.cx1 - TB.bx1, y0 + TB.alero - tMin + 1, 2 * TB.cz, 0, { tipo: 'muro' });
  const zTop = y0 + 1.7, zh = zTop - (tMin - 1);
  if (v) {   // malla TRELLIS (?kit=0): zócalo de sillería
    const zo = malla(new THREE.BoxGeometry(TB.cx1 - TB.bx0 + 0.3, zh, 2 * TB.cz + 0.3), matMundo(texSilleria(), 3, 0xcfc4b4));
    zo.position.set(e.x + (TB.bx0 + TB.cx1) / 2, zTop - zh / 2, e.z); G.add(zo);
  } else {   // N2-C37: torre del kit Sewell (cuerpo de tablas, zócalo de hormigón, balcones de madera, techo de zinc a cuatro aguas)
    const kt = torreKit({ pisos: TB.pisos, yBase: tMin - 1 - y0, color: 0x8c5a3a, colorTecho: 0xa8432f, semilla: 37, lados: TB.pisos.map((_, i) => (i % 2 === 0 ? 1 : -1)) });
    kt.position.set(e.x, y0, e.z); G.add(kt); R.torreKit = kt;
  }
  fis.caja(e.x + (TB.bx0 + TB.bx1) / 2, zTop - zh / 2, e.z, TB.bx1 - TB.bx0, zh, 2 * TB.cz + 0.3, 0, { tipo: 'muro' });
  // techo: pirámide del alero a la punta (0,05 m bajo la malla)
  const ya = y0 + TB.alero - 0.05;
  if (v) fis.convexo(new Float32Array([e.x - TB.ax, ya, e.z - TB.az, e.x + TB.ax, ya, e.z - TB.az, e.x - TB.ax, ya, e.z + TB.az, e.x + TB.ax, ya, e.z + TB.az, e.x, y0 + TB.punta - 0.05, e.z]), { tipo: 'techo' });
  else { const yp = y0 + TB.punta - 0.05, rz = 1.0;   // N2-C37: a cuatro aguas con cumbrera corta (z ±1): el casco convexo calza con el zinc del kit (alero ±4,1 × ±5,1)
    fis.convexo(new Float32Array([e.x - TB.ax, ya, e.z - 5.1, e.x + TB.ax, ya, e.z - 5.1, e.x - TB.ax, ya, e.z + 5.1, e.x + TB.ax, ya, e.z + 5.1, e.x, yp, e.z - rz, e.x, yp, e.z + rz]), { tipo: 'techo' }); }
  // N2-C29: ESCALERA DE INCENDIO de hierro (estilo Nueva York) en la fachada poniente, la que mira a la escalera y a la plaza.
  // Cada piso tiene un descanso de rejilla pegado al balcón (por un portillo en su baranda) en UN extremo de la fachada, alternando
  // sur/norte; entre piso y piso un tramo recto de 6,6 m (24-25°) en zigzag, un carril (A al lado del balcón, B más afuera) por tramo.
  // Abajo, un tramo corto baja al cerro por el sur; arriba, el descanso del techo llega al alero. Todo con rampas de colisión.
  const FF = [...P, y0 + TB.alero + 0.28];   // pisos 0-4 (balcones) y 5 = descanso del alero
  const lado = f => (f % 2 === 0 ? 1 : -1), X = u => e.x + u, Z = u => e.z + u;
  const LX0 = -7.9, LX1 = -5.1, ZD0 = 3.3, ZD1 = 4.5, CARRIL = [[-6.4, -5.4], [-7.7, -6.7]];   // carril 0 = A (pares), 1 = B
  // los cajones que el trazado del cono dejó al pie quedaban bajo la escalera: se corren al poniente, como decorado
  (def.elementos || []).filter(c => c.t === 'cajas' && Math.hypot(c.x - X(TB.poste[0]), c.z - Z(TB.poste[1])) < 4).forEach((c, i) => { c.x = +X(-13.5).toFixed(2); c.z = +Z(8 + i * 1.7).toFixed(2); });
  fis.indexar();
  const sueloEn = (x, z) => { const h = fis.rayo({ x, y: P[0] + 1, z }, { x: 0, y: -1, z: 0 }, 60, undefined, ['baranda']); return h ? h.punto.y : altura(x, z); };
  // balcones: losa, baranda exterior con un portillo ante el descanso, y barandas de los dos extremos
  const bxm = X((TB.bx0 + TB.bx1) / 2), bw = TB.bx1 - TB.bx0, bl = TB.bz1 - TB.bz0, gates = [];
  P.forEach((f, i) => {
    const s = lado(i), za = s < 0 ? -ZD0 + 0.1 : TB.bz0, zb = s < 0 ? TB.bz1 : ZD0 - 0.1;   // la baranda exterior sin el tramo del portillo
    fis.caja(bxm, f - 0.17, e.z, bw, 0.34, bl, 0, { tipo: 'balcon' });
    fis.caja(X(TB.bx0 + 0.04), f + 0.42, Z((za + zb) / 2), 0.12, 0.84, zb - za, 0, { tipo: 'baranda' });
    for (const zz of [TB.bz0 + 0.06, TB.bz1 - 0.06]) fis.caja(bxm, f + 0.42, Z(zz), bw, 0.84, 0.12, 0, { tipo: 'baranda' });
    gates.push([X(LX1 - 0.25), f + 0.02, Z(s < 0 ? -ZD1 - 0.05 : ZD0 - 0.05), X(LX1 + 0.3), f + 1.0, Z(s < 0 ? -ZD0 + 0.05 : ZD1 + 0.05)]);
  });
  // ---- piezas de hierro: una sola malla instanciada (caja unitaria) con color por instancia (hierro oscuro, algo de óxido)
  const pz = [], Q = new THREE.Quaternion(), Eu = new THREE.Euler(0, 0, 0, 'YXZ');
  const hier = (cx, cy, cz, sx, sy, sz, yaw = 0, pitch = 0, c = 0x2b2d30) => pz.push([cx, cy, cz, sx, sy, sz, yaw, pitch, c]);
  const oxi = k => { const r = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1; return r < 0.22 ? 0x5a3a26 : r < 0.45 ? 0x3a2f2a : 0x2b2d30; };
  let kc = 0;
  const rejilla = (x0, x1, z0, z1, y) => {   // piso de rejilla: chapa fina + vigas inferiores + marco
    hier((x0 + x1) / 2, y - 0.04, (z0 + z1) / 2, x1 - x0, 0.06, z1 - z0, 0, 0, 0x3b3d40);
    for (let t = 0.2; t < x1 - x0; t += 0.4) hier(x0 + t, y - 0.12, (z0 + z1) / 2, 0.04, 0.12, z1 - z0, 0, 0, oxi(kc++));
    hier((x0 + x1) / 2, y - 0.14, z0 + 0.04, x1 - x0, 0.16, 0.08, 0, 0, 0x24262a); hier((x0 + x1) / 2, y - 0.14, z1 - 0.04, x1 - x0, 0.16, 0.08, 0, 0, 0x24262a);
  };
  const barandaPlano = (xa, za, xb, zb, y) => {   // baranda recta horizontal (visual) + colisión
    const L = Math.hypot(xb - xa, zb - za), cx = (xa + xb) / 2, cz = (za + zb) / 2, yaw = Math.atan2(xb - xa, zb - za);
    hier(cx, y + 1.0, cz, 0.05, 0.05, L, yaw, 0, 0x202225); hier(cx, y + 0.5, cz, 0.03, 0.03, L, yaw, 0, 0x2b2d30);
    for (let t = 0; t <= L + 0.01; t += Math.max(0.5, L / Math.ceil(L / 0.9))) hier(xa + (xb - xa) * t / L, y + 0.5, za + (zb - za) * t / L, 0.04, 1.0, 0.04, 0, 0, oxi(kc++));
    fis.caja(cx, y + 0.5, cz, Math.abs(xb - xa) + 0.08, 1.0, Math.abs(zb - za) + 0.08, 0, { tipo: 'baranda' });
  };
  const tramo = (carril, zt, zb, yt, yb, corto = 0) => {   // zt = z del extremo alto; rampa de colisión + peldaños + largueros + pasamanos
    const [xa, xb] = CARRIL[carril].map(X), ztw = Z(zt), zbw = Z(zb), dz = zbw - ztw, L = Math.hypot(dz, yb - yt), pend = (yb - yt) / dz, pitch = -Math.atan(pend);
    const yAt = z => yt + (yb - yt) * (z - ztw) / dz;
    fis.convexo(new Float32Array([xa, yt, ztw, xb, yt, ztw, xa, yb, zbw, xb, yb, zbw, xa, yt - 0.2, ztw, xb, yt - 0.2, ztw, xa, yb - 0.2, zbw, xb, yb - 0.2, zbw]), { tipo: 'escalera' });
    const n = Math.max(3, Math.round(Math.abs(dz) / 0.33)), dd = dz / n;
    for (let k = 0; k < n; k++) { const zc = ztw + dd * (k + 0.5); hier((xa + xb) / 2, yAt(zc) - 0.02, zc, xb - xa - 0.08, 0.05, Math.abs(dd) - 0.02, 0, 0, 0x3b3d40); }
    const zr = zbw - Math.sign(dz) * corto, yr = yAt(zr), LR = Math.hypot(zr - ztw, yr - yt);   // las barandas dejan libres los últimos «corto» m (entrada desde el costado)
    for (const xx of [xa + 0.03, xb - 0.03]) {   // largueros, pasamanos y balaustres; colisión de la baranda inclinada
      hier(xx, (yt + yb) / 2 - 0.14, (ztw + zbw) / 2, 0.06, 0.24, L, 0, pitch, 0x24262a);
      hier(xx, (yt + yr) / 2 + 0.95, (ztw + zr) / 2, 0.06, 0.05, LR, 0, pitch, 0x202225); hier(xx, (yt + yr) / 2 + 0.5, (ztw + zr) / 2, 0.035, 0.03, LR, 0, pitch, 0x2b2d30);
      for (let k = 0; k <= n; k += 2) { const zc = ztw + dd * k; if (Math.abs(zc - ztw) <= Math.abs(zr - ztw) + 0.01) hier(xx, yAt(zc) + 0.47, zc, 0.04, 0.95, 0.04, 0, 0, oxi(kc++)); }
      const x0 = xx - 0.05, x1 = xx + 0.05;
      fis.convexo(new Float32Array([x0, yt, ztw, x1, yt, ztw, x0, yr, zr, x1, yr, zr, x0, yt + 1, ztw, x1, yt + 1, ztw, x0, yr + 1, zr, x1, yr + 1, zr]), { tipo: 'baranda' });
    }
  };
  const descanso = (f, s, xE) => {   // descanso de rejilla del piso f en el extremo s (xE = borde oriente; el del techo llega al alero)
    const y = FF[f], za = s < 0 ? -ZD1 : ZD0, zb = s < 0 ? -ZD0 : ZD1;
    rejilla(X(LX0), X(xE), Z(za), Z(zb), y);
    fis.caja(X((LX0 + xE) / 2), y - 0.06, Z((za + zb) / 2), xE - LX0, 0.12, zb - za, 0, { tipo: 'escalera' });
    barandaPlano(X(LX0 + 0.04), Z(za), X(LX0 + 0.04), Z(zb), y);   // poniente
    if (f !== 0) barandaPlano(X(LX0 + 0.04), Z(s * ZD1 - s * 0.04), X(xE === LX1 ? LX1 : xE - 0.04), Z(s * ZD1 - s * 0.04), y);   // cabecera
    else barandaPlano(X(CARRIL[0][0] - 0.05), Z(s * ZD1 - s * 0.04), X(LX1), Z(s * ZD1 - s * 0.04), y);   // abajo: la cabecera deja libre el carril B (tramo al suelo)
    for (const zz of [za + 0.1, zb - 0.1]) hier(X(LX0 + 0.1), y - 0.6, Z(zz), 0.08, 1.2, 0.08, 0, 0, 0x24262a);
    hier(X((LX0 + LX1) / 2), y - 0.9, Z((za + zb) / 2), 0.07, 0.07, 1.6, 0, 0.55, 0x3a2f2a); hier(X((LX0 + LX1) / 2), y - 0.9, Z((za + zb) / 2), 0.07, 0.07, 1.6, 0, -0.55, 0x3a2f2a);   // tornapuntas
  };
  const ruta = [];   // [x, y, z, etiqueta]: la ruta a pie (guion herramientas/prog11_c29_subir.js)
  // tramo al suelo: baja desde el descanso del piso 0 (extremo +z, el de la plaza) hasta la plaza, carril B (pendiente ≤ 34°)
  { const xc = X((CARRIL[1][0] + CARRIL[1][1]) / 2), gP = sueloEn(xc, Z(ZD1 + 6));   // la plaza acaba en un muro a 10,3 m del descanso: el tramo termina ~0,9 m sobre ella ("deslizable"), con dos cajones de escalón al costado
    const s = 10.05, yb = FF[0] - 7.0; tramo(1, ZD1, ZD1 + s, FF[0], yb, 1.6);
    setTimeout(() => {   // la plaza se crea después de la torre: los cajones se apoyan en ella cuando ya existe
      fis.indexar(); const pre = [];
      for (const [i, h] of [[0, 0.45], [1, 0.9]]) {   // cajones de escalón (≤ 0,55 m) al costado poniente del pie del tramo
        const cx = X(-9 + i * 0.9), cz = Z(ZD1 + 9.5), g = sueloEn(cx, cz), mc = malla(new THREE.BoxGeometry(0.9, h, 1.0), mad); mc.position.set(cx, g + h / 2, cz); G.add(mc);
        fis.caja(cx, g + h / 2, cz, 0.9, h, 1.0, 0, { tipo: 'cajon' }); pre.push([cx, g + h, cz, 'cajon' + i]); }
      ruta.unshift(...pre); fis.indexar();
    }, 0);
    for (let t = s - 1; t >= 0; t -= 0.8) ruta.push([xc, FF[0] + (yb - FF[0]) * t / s, Z(ZD1 + t), 'suelo']); }
  for (let f = 0; f <= 5; f++) {
    const s = lado(f); descanso(f, s, f === 5 ? -3.9 : LX1);
    ruta.push([X(-6.5), FF[f], Z(s * 3.9), 'descanso' + f]);
    if (f === 5) { barandaPlano(X(-5.3), Z(s * ZD0 + s * 0.04), X(-3.9), Z(s * ZD0 + s * 0.04), FF[5]);   /* N2-C31: llega hasta el borde del descanso (-3,9; antes -4,1): el extremo suelto de la baranda y la falda del techo (x -4,1) dejaban un rincón donde Nato quedaba trabado al subir en diagonal; así se sale al techo hacia el este */ ruta.push([X(-4.3), FF[5], Z(s * 3.9), 'techo5']); }   // el borde interior del descanso del techo da al vacío
    if (f < 5) ruta.push([X(-4.75), FF[f], Z(s * 3.9), 'balcon' + f], [X(-6.5), FF[f], Z(s * 3.9), 'descanso' + f]);
    if (f < 5) {   // tramo f: del piso f (extremo s) al piso f+1 (extremo -s), carril f%2
      const zt = -s * ZD0, zb = s * ZD0, xc = X((CARRIL[f % 2][0] + CARRIL[f % 2][1]) / 2);
      tramo(f % 2, zt, zb, FF[f + 1], FF[f]);
      for (let t = 0; t <= 1.0001; t += 1 / 7) ruta.push([xc, FF[f] + (FF[f + 1] - FF[f]) * t, Z(zb + (zt - zb) * t), 'tramo' + f]);
    }
  }
  R.torreRuta = ruta; R.torreEscalones = ruta.map(([x, y, z]) => [x, y, z, 0]);
  // postes de apoyo de los descansos hasta el suelo (solo visual)
  for (let f = 0; f <= 5; f++) { const s = lado(f); for (const zz of [s * 3.45, s * 4.4]) { const x = X(LX0 + 0.1), z = Z(zz), g = sueloEn(x, z), top = FF[f] - 0.2; if (top - g > 0.3) hier(x, (top + g) / 2, z, 0.09, top - g, 0.09, 0, 0, 0x24262a); } }
  const geoC = new THREE.BoxGeometry(1, 1, 1), matH = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.4 }), inst = new THREE.InstancedMesh(geoC, matH, pz.length), mm = new THREE.Matrix4(), cc = new THREE.Color(), sc3 = new THREE.Vector3();
  pz.forEach(([cx, cy, cz, sx, sy, sz, yaw, pitch, c], i) => { Eu.set(pitch, yaw, 0); Q.setFromEuler(Eu); mm.compose(new THREE.Vector3(cx, cy, cz), Q, sc3.set(sx, sy, sz)); inst.setMatrixAt(i, mm); inst.setColorAt(i, cc.set(c)); });
  inst.castShadow = true; inst.receiveShadow = true; inst.frustumCulled = false; inst.name = 'escalera_incendio'; G.add(inst);
  // los portillos de la baranda exterior de la malla (una caja por piso, en coordenadas de mundo): se descartan sus fragmentos
  if (!v) { R.torres.push({ x: e.x, z: e.z, y: y0 + TB.punta + 0.3 }); return; }   // N2-C37: con el kit no hay malla que recortar
  const GV = gates.flatMap(g => [new THREE.Vector3(g[0], g[1], g[2]), new THREE.Vector3(g[3], g[4], g[5])]);
  let n = 0; const iv = setInterval(() => {
    let hecho = false;
    v.traverse(o => { if (!o.isMesh || o.userData.c29) return; o.userData.c29 = hecho = true;
      const m = o.material = o.material.clone();
      m.onBeforeCompile = sh => { sh.uniforms.uG = { value: GV };
        sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vWp; uniform vec3 uG[' + GV.length + '];\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfor (int i = 0; i < ' + GV.length / 2 + '; i++) { if (all(greaterThan(vWp, uG[2 * i])) && all(lessThan(vWp, uG[2 * i + 1]))) discard; }'); };
      m.customProgramCacheKey = () => 'c29gate'; m.needsUpdate = true; });
    if (hecho || ++n > 600) clearInterval(iv);
  }, 200);
  R.torres.push({ x: e.x, z: e.z, y: y0 + TB.punta + 0.3 });
}

export function construirNivel(def, fis, escena) {
  const R = { splats: def.splats || null, gaussianas: [], exterior: new THREE.Group(), salas: {}, puertas: [], specs: [], escaleras: {}, andariveles: [], tablones: [], zonas: [], torres: [], repisas: [], muertes: [] };
  R.exterior.name = 'exterior';
  ponerNivelKit(def.numero);   // N0-KIT (carril kit): niveles con el kit Sewell por omisión (mallas.js)
  COMPLETOS.clear();   // N2-C24: el tope de modelos completos es por nivel (principal.js vacía el worker de LoD antes de construir)
  for (const e of def.elementos) if (e.t === 'edificio' && e.puerta && e.id && def.splats && def.splats[e.id] && COMPLETOS.size < TOPE_LOD) COMPLETOS.add(def.splats[e.id].url);   // N2-C27: los que tienen puerta (cine, hospital, club…) siempre completos
  const op = { invierno: !!def.invierno, nieveDesde: def.nieveDesde };
  R.invierno = op.invierno;   // escalera(): peldaños con nieve en la huella solo en invierno
  LADERA.natural = !!def.laderaNatural;   // 1905: ladera sin las terrazas planas de la ciudad
  CONO.perfil = def.cono ? def.cono.perfil : null; CONO.marco = null;   // ?sewell=cono (N2-N4)
  CERROS.length = 0; for (const c of def.cerros || []) CERROS.push(c);   // antes del terreno: altura() ya los incluye
  TERRAZAS.length = 0; limpiarHuecos();
  // franja plana bajo la vía solo donde el cerro está cerca de su altura (estación y talleres); más allá la vía va en túnel/corte
  // (a lo largo de toda la vía abría una zanja recta y oscura en las laderas de los extremos)
  for (const e of def.elementos) if (e.t === 'via') TERRAZAS.push({ x: 0, z: e.z, c: 1, s: 0, hx: 215, hz: 3.5, m: 6, r: 1e6, y: e.y, prioridad: true });
  // portales de túnel donde la vía se mete al cerro (antes los rieles se hundían en la ladera): una trinchera corta
  // (solo corta, no rellena) lleva la vía hasta el muro del portal
  const portales = [];
  for (const e of def.elementos) if (e.t === 'via') for (const lado of [-1, 1]) {
    const xp = bocaTunel(e, lado); if (xp == null) continue;
    // el corte sigue 0,9 m dentro del muro (que mide 1,4 m): la subida del terreno queda tapada por el muro y la boca negra.
    // Corta y también rellena: donde el suelo estaba bajo la vía (poniente) se veían las paredes oscuras del terraplén como una cuña
    const xa = lado * 214, xb = xp + lado * 0.9;
    TERRAZAS.push({ x: (xa + xb) / 2, z: e.z, c: 1, s: 0, hx: Math.abs(xb - xa) / 2, hz: 4, m: 6, mx: 0.4, r: 1e6, y: e.y, prioridad: true });
    portales.push({ e, xp, lado });
  }
  // plaza integrada (planta de 1971, 120×66): el terreno corta y rellena hasta la losa con 14 m de talud;
  // antes la losa sobresalía ~7 m del cerro con caras verticales
  for (const e of def.elementos) if (e.t === 'plaza' && e.integrar && e.y != null) {
    const hx = e.sx / 2, hz = e.sz / 2, m = 14;
    TERRAZAS.push({ x: e.x, z: e.z, c: 1, s: 0, hx, hz, m, r: Math.hypot(hx, hz) + m, y: e.y - 0.3 });
  }
  // plaza con terraza (nido del N4): rebaja la ladera hasta la losa (solo corta); antes la losa quedaba enterrada hasta 19 m
  for (const e of def.elementos) if (e.t === 'plaza' && e.terraza && e.y != null) {
    const hx = e.sx / 2 + 3, hz = e.sz / 2 + 4, m = 12;
    TERRAZAS.push({ x: e.x, z: e.z, c: 1, s: 0, hx, hz, m, r: Math.hypot(hx, hz) + m, y: e.y - 0.3, corte: true });
  }
  // plaza con terraza y sin altura fija (cornisa del jefe del N3): la losa va a 40 % del desnivel de la ladera y el terreno se
  // corta y rellena alrededor. Antes tomaba el punto más alto + 1,5 m: un cajón de roca con muros de 10-16 m
  for (const e of def.elementos) if (e.t === 'plaza' && e.terrazaLadera && e.y == null) {
    let lo = 1e9, hi = -1e9;
    for (let i = -1; i <= 1; i += 0.25) for (let j = -1; j <= 1; j += 0.25) { const y = altura(e.x + i * e.sx / 2, e.z + j * e.sz / 2); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    e._yT = lo + (hi - lo) * 0.4 + 0.3;
    const hx = e.sx / 2 + 1, hz = e.sz / 2 + 1, m = 12;
    TERRAZAS.push({ x: e.x, z: e.z, c: 1, s: 0, hx, hz, m, r: Math.hypot(hx, hz) + m, y: e._yT - 0.3, prioridad: true });
  }
  const cotaPorId = {};
  for (const e of def.elementos) if (e.t === 'edificio' && !def.sinTerrazas && e.anillo == null) {   // anillo: edificio de ?sewell=cono (su terraza la pone terrazasCono)
    // la terraza cubre la planta real del modelo de Idol (puede ser más grande que el lote: horno de la panadería) + 2 m
    let L = e.largo, A = e.ancho;
    const sp = def.splats && (e.id ? def.splats[e.id] : def.splats['color:' + e.color]);
    if (sp && !sp.estirar && sp.min && sp.max) {
      const k = (sp.alto || e.pisos * PISO + 5) / (sp.max[1] - sp.min[1]), ml = (sp.max[0] - sp.min[0]) * k, mw = (sp.max[2] - sp.min[2]) * k;
      if (L >= A) { L = Math.max(L, ml); A = Math.max(A, mw); } else { L = Math.max(L, mw); A = Math.max(A, ml); }
    }
    const pr = plantaReal(e, sp);   // N1-C64 / G-C2: terraza con la planta que Spark dibuja de verdad (escala promedio, ver edificioSplat)
    if (pr) { if (L >= A) { L = Math.max(L, pr.L); A = Math.max(A, pr.W); } else { L = Math.max(L, pr.W); A = Math.max(A, pr.L); } }
    const margen = e.margenTerraza ?? 2;   // e.margenTerraza: casa aislada con terraza ancha (Hamilton 6 m: la malla del terreno, con vértices cada 5 m, queda plana bajo toda la planta). (probado 6,5 m: las terrazas vecinas se pisaban y quedaban acantilados de 6 m entre casas; el apoyo sobre la malla visual se arregla en minTerreno/maxTerreno)
    const tx = e.terraza0 ? e.terraza0.x : e.x; if (e.terraza0) L = Math.max(L, e.terraza0.largo);   // N3-C13: lote recortado junto a un pasaje: la terraza sigue cubriendo el lote original (la escalera manda en su franja)
    const rot = (e.rot || 0) * Math.PI / 180, hx = L / 2 + margen, hz = A / 2 + margen, c = Math.cos(rot), s = Math.sin(rot);
    // altura de la terraza: a media altura del suelo original bajo la planta (corta arriba, rellena abajo)
    let lo = 1e9, hi = -1e9;
    for (let i = -1; i <= 1; i += 0.25) for (let j = -1; j <= 1; j += 0.25) { const lx = i * hx, lz = j * hz, y = alturaBase(tx + lx * c - lz * s, e.z + lx * s + lz * c); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const m = def.laderaNatural ? 15 : 9;   // 1905: transición más larga (entre las casas de piedra el escalón entre terrazas pasaba de 40° y se caía)
    // en la ladera natural (1905) la terraza corta más de lo que rellena: rellenando la mitad el molino quedaba sobre un montículo
    // e.terraza: fracción propia (alas del hospital: más baja, para no dejar un podio desnudo de 14 m hacia la plaza)
    // terrazaCon: misma cota que la terraza de otro edificio (alas del hospital en H con su cuerpo central)
    const yT = e.terrazaCon && cotaPorId[e.terrazaCon] != null ? cotaPorId[e.terrazaCon] : lo + (hi - lo) * (e.terraza ?? (def.laderaNatural ? 0.3 : 0.55));
    if (e.id && cotaPorId[e.id] == null) cotaPorId[e.id] = yT;
    TERRAZAS.push({ x: tx, z: e.z, c, s, hx, hz, m, r: Math.hypot(hx, hz) + m, y: yT, peso: e.terrazaPeso });   // terrazaPeso: 1905, la terraza propia manda al mezclarse con caminos y vecinas
    // patio de tierra apisonada frente a la puerta (lado sur, +z): e.patio = metros extra de terreno plano a la misma cota (la fachada principal queda despejada desde la altura de los ojos)
    if (e.patio) TERRAZAS.push({ x: e.x, z: e.z + hz + e.patio / 2, c: 1, s: 0, hx, hz: e.patio / 2, m: 6, r: Math.hypot(hx, e.patio / 2) + 6, y: yT, peso: e.terrazaPeso });
  }
  terrazasFundicion(def);   // N1-MOLINO (carril kit): banco plano bajo la fundición y la playa de las ollas
  if (def.numero === 1 && def.laderaNatural) {   // plaza del pueblo de 1905: terreno plano bajo la gravilla, junto a la estación
    const { x, z, r } = PLAZA1905; let sum = 0, nn = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { sum += alturaBase(x + i * r * 0.7, z + j * r * 0.7); nn++; }
    TERRAZAS.push({ x, z, c: 1, s: 0, hx: r + 2, hz: r + 2, m: 9, r: Math.hypot(r + 2, r + 2) + 9, y: sum / nn, prioridad: true });
    // caminos de tierra tallados en la ladera (13-11-2026): cada tramo de ~6 m es una rampa plana de lado a lado (corta arriba y
    // rellena abajo). Antes la cinta seguía la ladera tal cual: junto a la casa de Hamilton y tras el molino iba por bordes con
    // 45-60° de inclinación lateral (no se podía caminar) y los troncos-peldaño quedaban hasta 3 m en el aire
    const yaCaminos = [];
    for (const pts of CAMINOS1905) {
      const curva = new THREE.CatmullRomCurve3(pts.map(([px, pz]) => new THREE.Vector3(px, 0, pz)), false, 'centripetal');
      const n = Math.max(2, Math.round(curva.getLength() / 6)), P = [];
      for (let k = 0; k <= n; k++) { const p = curva.getPoint(k / n); P.push({ x: p.x, z: p.z, y: altura(p.x, p.z) }); }
      for (let pasada = 0; pasada < 3; pasada++) { const ys = P.map(p => p.y); for (let k = 1; k < n; k++) P[k].y = (ys[k - 1] + ys[k] * 2 + ys[k + 1]) / 4; }   // perfil suave a lo largo
      for (let k = 0; k < n; k++) {
        const a = P[k], b = P[k + 1], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        if (mz > 2 || Math.hypot(mx - x, mz - z) < r + 4) continue;   // junto a la vía y en la plaza manda su propia terraza
        let dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, hz = L / 2 + 0.6, cx = mx, cz = mz, y1 = b.y;
        // N1-M3: el último tramo que llega al andén A se corta 2,5 m antes (ahí baja la escalera de madera; la rampa subía el
        // camino por los costados de los peldaños y los dejaba medio enterrados)
        if (def.elementos.some(e => e.peldano && Math.hypot(e.peldano[0] - b.x, e.peldano[1] - b.z) < 3)) {
          const c = Math.min(2.5, L - 1); L -= c; hz = L / 2 + 0.3; cx = a.x + ux * L / 2; cz = a.z + uz * L / 2; y1 = a.y + (b.y - a.y) * L / (L + c);
        }
        yaCaminos.push({ x: cx, z: cz, c: uz, s: -ux, hx: 4.5, hz, m: 7, r: hz + 4.5 + 7, y: a.y, y1 });
      }
    }
    TERRAZAS.push(...yaCaminos);
  }
  // fogatas al aire libre (N1-C46, pedido de Diego): rellano plano chico bajo el anillo de piedras, a la altura media del suelo
  // (en ladera quedaban medio enterradas del lado alto y con las piedras en el aire del lado bajo)
  for (const e of def.elementos) if (e.t === 'fogata' && e.y == null && !e.sala) {
    let sum = 0, nn = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { sum += alturaBase(e.x + i * 1.3, e.z + j * 1.3); nn++; }
    TERRAZAS.push({ x: e.x, z: e.z, c: 1, s: 0, hx: 2.6, hz: 2.6, m: 3, r: Math.hypot(2.6, 2.6) + 3, y: sum / nn });
  }
  // bocamina: banco plano a la cota de la boca que entra 12 m en el cerro (el túnel va sobre ese piso; sin esto el terreno que sube hacia el este atravesaba el túnel)
  for (const e of def.elementos) if (e.t === 'bocamina' || e.t === 'tunel') {
    const rr = (e.rot || 0) * Math.PI / 180, nx = Math.sin(rr), nz = Math.cos(rr), tx = Math.cos(rr), tz = -Math.sin(rr);
    let yP = -1e9; for (const u of [-2, 0, 2]) yP = Math.max(yP, alturaBase(e.x - nx * 0.4 + tx * u, e.z - nz * 0.4 + tz * u));
    TERRAZAS.push({ x: e.x - nx * 6, z: e.z - nz * 6, c: Math.cos(rr), s: Math.sin(rr), hx: 3.4, hz: 6.5, m: 5, r: Math.hypot(3.4, 6.5) + 5, y: yP, prioridad: true });
    // N1-C47: salida del túnel: rellano de 3 m a la cota del umbral y rampa (≤ 20°) que baja al camino. Antes el piso del portal
    // quedaba ~1,5 m sobre la ladera, con un hueco negro debajo
    if (e.t === 'tunel') {
      let Lr = 5; for (let i = 0; i < 4; i++) Lr = Math.max(5, (yP - alturaBase(e.x + nx * (3 + Lr), e.z + nz * (3 + Lr))) / 0.36);
      const y1 = Math.min(yP, alturaBase(e.x + nx * (3 + Lr), e.z + nz * (3 + Lr)));
      TERRAZAS.push({ x: e.x + nx * 1.4, z: e.z + nz * 1.4, c: Math.cos(rr), s: Math.sin(rr), hx: 3.2, hz: 1.8, m: 4, r: 3.2 + 1.8 + 4, y: yP, prioridad: true });
      TERRAZAS.push({ x: e.x + nx * (3 + Lr / 2), z: e.z + nz * (3 + Lr / 2), c: nz, s: -nx, hx: 2.6, hz: Lr / 2, m: 4, r: 2.6 + Lr / 2 + 4, y: yP, y1, prioridad: true });
    }
  }
  // plazas de altura fija: el terreno queda bajo la losa (la transición de la terraza del hospital asomaba sobre la plaza 126)
  for (const e of def.elementos) if (e.t === 'plaza' && e.y != null) {
    TERRAZAS.push({ x: e.x, z: e.z, c: 1, s: 0, hx: e.sx / 2, hz: e.sz / 2, m: 6, r: Math.hypot(e.sx, e.sz) / 2 + 6, y: e.y - 0.4, corte: true, prioridad: true });
    // N3-X1: y rellena (solo rellena, nunca sube sobre la losa) con talud de 12 m: con solo el corte quedaba un escalón de 3 m al
    // borde sur de la plaza 126 donde pasa la ruta. Sin el prototipo ?sewell=cono, ni en las plazas que ya integran o tienen terraza
    if (!def.cono && !e.integrar && !e.terraza)
      TERRAZAS.push({ x: e.x, z: e.z, c: 1, s: 0, hx: e.sx / 2, hz: e.sz / 2, m: 12, r: Math.hypot(e.sx, e.sz) / 2 + 12, y: e.y - 0.4, relleno: true, prioridad: true });
  }
  // escaleras: el terreno sigue la pendiente de la escalera (rampa de y0 a y1) con 4 m de transición a los lados.
  // Antes la escalera iba en línea recta entre sus extremos y el terreno subía y bajaba: el costado de los peldaños y del
  // cuerpo de concreto asomaba en dientes de sierra
  if (def.cono) terrazasCono(def, TERRAZAS);   // ?sewell=cono: calles y edificios de los anillos (antes que las escaleras: ganan en los descansos)
  for (const e of def.elementos) if (e.t === 'escalera') {
    // N3-X1: el extremo que toca una plaza de altura fija termina a la cota de la losa (antes quedaba 2,9 m bajo las plazas 60 y 126)
    const cotaPlaza = (x, z) => { if (def.cono) return null; for (const p of def.elementos) if (p.t === 'plaza' && p.y != null && !p.terraza && Math.abs(x - p.x) <= p.sx / 2 + 1 && Math.abs(z - p.z) <= p.sz / 2 + 1) return p.y; return null; };
    const y0 = e.y0 ?? cotaPlaza(e.x0, e.z0) ?? altura(e.x0, e.z0) + 0.25, y1 = e.y1 ?? cotaPlaza(e.x1, e.z1) ?? altura(e.x1, e.z1) + 0.25;
    e._y0 = y0; e._y1 = y1;
    // hx ≥ 5,5: la malla del terreno tiene vértices cada 5 m; si la columna de vértices a ±5 m caía fuera de la rampa
    // (tomaba la terraza más alta del camarote vecino) el terreno subía entre vértices y tapaba el borde de los peldaños (tramo 2, junto al cine)
    const dx = e.x1 - e.x0, dz = e.z1 - e.z0, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, hx = e.hxTerreno ?? Math.max(e.ancho / 2 + 1, 5.5), m = e.mTerreno ?? 4;   // hxTerreno/mTerreno: pasaje angosto entre casas (N3-X1)
    TERRAZAS.push({ x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, c: uz, s: -ux, hx, hz: L / 2, m, r: L / 2 + hx + m, y: y0 - 0.3, y1: y1 - 0.3, prioridad: true });
  }
  R.exterior.add(crearTerreno(fis, op));
  for (const c of CERROS) if (c.corte) R.exterior.add(frenteCerro(c));
  R.tapones = [];
  for (const p of portales) R.exterior.add(portalTunel(p, fis, R, def.numero === 1 || def.numero === 4));   // X-K10 (carril cine): también el N4, donde el tren del final entra al túnel (la boca se veía tapada de tierra)
  R.exterior.add(crearCordillera(op));
  for (const e of def.elementos) {
    try { elemento(e, def, fis, R); } catch (err) { console.warn('elemento con problema', e, err); }
  }
  escalerasHielo(def, fis, R);   // ESC2: la escalera bajo la lámina de hielo (N3) pisa la lámina
  // N0-OLLAS (carril ciudad): playa de maniobras de las ollas de cobre fundido: rellano plano (a la cota más alta), vía de trocha angosta y
  // durmientes; los carros portaolla y sus ollas son elementos 't:olla, carro:true' con el mismo giro (entidades.js olla).
  fis.indexar();
  for (const e of def.elementos) if (e.t === 'playaOllas') {
    const th = (e.giro || 0) * Math.PI / 180, L = e.largo || 24, r = rellano(fis, R.exterior, e.x, e.z, th, L / 2 + 1.5, e.ancho || 3.4, { siempre: true, nombre: 'playa_ollas', na: 36, pend: 0.8 });
    const top = r ? r.top : fis.suelo(e.x, e.z, 1200), v = viaOllas(L); v.position.set(e.x, top, e.z); v.rotation.y = th; R.exterior.add(v);
    e.y = top;
  }
  for (const e of def.elementos) if (e.t === 'fundicion') construirFundicion(e, def, fis, R);   // N1-MOLINO (carril kit)
  if (def.numero === 1 && def.laderaNatural && !def.sinPueblo) construirPueblo1905(def, fis, R);
  if (def.cono) obrasCono(def, fis, R);   // ?sewell=cono: calles, muros de contención y barandas
  // N0-FOG (carril ciudad, pedido de Diego: «fogata medio enterrada»): cada fogata exterior en ladera (desnivel > 0,12 m bajo su anillo
  // de piedras) lleva un rellano de tierra apisonada de 2,5 m de radio a la cota más alta (rellanos.js). ?rellano=0 lo apaga (comparar).
  fis.indexar();
  if (!(globalThis.location && /[?&]rellano=0/.test(location.search)))
    for (const e of def.elementos) if (e.t === 'fogata' && !e.sala && e.ySala == null && e.y == null) rellano(fis, R.exterior, e.x, e.z, 0, 2.5, 2.5, { nombre: 'rellano_fogata', na: 20, omitirSobre: ['plaza'], color: hayNieve(e.x, e.z, e.y ?? fis.suelo(e.x, e.z, 1200)) ? 0xe9eef2 : undefined });
  // salas aparte
  (def.salas || []).forEach((id, k) => { R.salas[id] = construirSala(SALAS[id], k, fis, R); });
  escena.add(R.exterior);
  for (const s of Object.values(R.salas)) escena.add(s.grupo);
  fis.paso(1 / 60);   // para que los rayos ya vean todo lo estático
  // resolver alturas de lo que se apoya en el suelo
  for (const s of R.specs) {
    if (s.ySala != null) continue;
    if (s.x == null || s.z == null) continue;   // filas (pepitas, vagonetas, alud) sin x,z propio: cada pieza busca su suelo (antes salían a y=1200)
    if (s.y == null) s.y = fis.suelo(s.x, s.z) + (s.sobre || 0);
  }
  return R;
}

// x donde el cerro ya cubre la vía con ~7,5 m (cabe el tren bajo el arco); null si no hay cerro en ese extremo
function bocaTunel(e, lado) {
  const xmax = Math.min(Math.abs(e.x0), Math.abs(e.x1)) - 80;
  for (let ax = 200; ax < xmax; ax += 0.5) {
    const x = lado * ax; let mn = 1e9;
    for (let dz = -6; dz <= 6; dz += 1) mn = Math.min(mn, alturaBase(x, e.z + dz));
    if (mn - e.y >= 7.5) return x;
  }
  return null;
}
// portal de túnel de 1905: muro de sillería con arco de medio punto, dovelas claras y el túnel oscuro detrás
const suave = f => { f = Math.min(1, Math.max(0, f)); return f * f * (3 - 2 * f); };
function portalTunel({ e, xp, lado }, fis, R, hondo) {   // hondo: N1-C49 (por ahora solo el nivel 1, pedido de main)
  const g = new THREE.Group(), W = 21, Ra = 2.4, hp = 3.6, grosor = 2.4, V = (u, v) => new THREE.Vector2(u, v);   // más delgado: con 2,2 m el canto de arriba asomaba sobre la ladera de costado
  // u = -(z - e.z) tras girar el muro: así la forma (plano XY) queda de frente a la vía
  const muro = new THREE.Shape([V(-W / 2, -1.5), V(-Ra, -1.5), V(-Ra, hp)]);
  muro.absarc(0, hp, Ra, Math.PI, 0, true);
  muro.lineTo(Ra, -1.5); muro.lineTo(W / 2, -1.5);
  // borde de arriba: sigue el cerro justo detrás y sobre el arco deja 1,4 m de piedra; hacia las puntas baja hasta
  // meterse bajo el suelo de delante (antes el muro asomaba del cerro por un costado con su canto y una sombra triangular)
  for (let u = W / 2; u >= -W / 2 - 0.01; u -= 0.75) {
    // X-K11: el canto de arriba queda 0,35 m BAJO lo que se dibuja detrás (malla del terreno o manto, el más alto) en las caras
    // trasera y de media pared; antes seguía alturaBase() a media pared y desde atrás asomaba una cinta de piedra sobre el cerro
    const supD = x => Math.max(altura(x, e.z - u), alturaMalla(x, e.z - u)) + 0.05;
    const atras = Math.min(supD(xp + lado * grosor * 0.5), supD(xp + lado * grosor), supD(xp + lado * (grosor + 1.2))) - e.y - 0.35;
    const arco = hp + Ra + 1.4 - Math.max(0, Math.abs(u) - Ra - 1.2) * 1.2;
    const delante = altura(xp - lado * 0.4, e.z - u) - e.y;
    // últimos 4,5 m: baja hasta 0,6 m bajo el suelo más bajo (delante o atrás); con 3 m y 0,4 m los extremos asomaban de costado
    const punta = suave((Math.abs(u) - (W / 2 - 4.5)) / 4.5);
    const top = Math.max(atras, arco) * (1 - punta) + (Math.min(atras, delante) - 0.6) * punta;
    muro.lineTo(u, Math.max(top, -1.2));
  }
  const geo = new THREE.ExtrudeGeometry(muro, { depth: grosor, bevelEnabled: false }); geo.rotateY(Math.PI / 2);   // extrusión → +x
  const m = malla(geo, matMundo(texSilleria(), 4, 0xd6cec2)); m.position.set(lado > 0 ? xp : xp - grosor, e.y, e.z); g.add(m);
  // dovelas y jambas de piedra clara, un poco salidas del muro
  const anillo = new THREE.Shape([V(Ra + 0.6, 0), V(Ra + 0.6, hp)]);
  anillo.absarc(0, hp, Ra + 0.6, 0, Math.PI, false);
  anillo.lineTo(-Ra - 0.6, 0); anillo.lineTo(-Ra, 0); anillo.lineTo(-Ra, hp);
  anillo.absarc(0, hp, Ra, Math.PI, 0, true); anillo.lineTo(Ra, 0);
  const ga = new THREE.ExtrudeGeometry(anillo, { depth: 0.3, bevelEnabled: false }); ga.rotateY(Math.PI / 2);
  const a = malla(ga, matMundo(texSilleria(), 1.6, 0xf2ebdf)); a.position.set(lado > 0 ? xp - 0.3 : xp, e.y, e.z); g.add(a);
  // cornisa sobre el arco
  const cor = malla(new THREE.BoxGeometry(0.5, 0.35, 2 * Ra + 3), matMundo(texSilleria(), 1.6, 0xe8e0d2)); cor.position.set(xp - lado * 0.2, e.y + hp + Ra + 0.9, e.z); g.add(cor);
  // túnel: caja vista por dentro, oscura, hasta el borde del mapa (desde afuera se ve la boca negra; desde el tren, paredes)
  const largo = 760 - Math.abs(xp), alto = hp + Ra + 0.6;
  // el túnel va en tramos de 8 m cuyo techo no sube sobre la ladera (antes una sola caja asomaba como una cuña negra donde el cerro bajaba)
  const matT = new THREE.MeshBasicMaterial({ color: 0x0e0b09, side: THREE.BackSide }), tuneles = [], paso = 8, nSeg = Math.ceil(largo / paso), LH = hondo ? 16 : 0;
  // N1-C49: el suelo no se dibuja dentro de la boca en los primeros LH m (ver HUECOS en terreno.js): los rieles entran y el túnel
  // se ve hondo; un techo de roca tapa desde arriba el trozo de ladera que queda sin dibujar detrás del muro
  if (hondo) { const k = R.tapones.length, xa = xp - lado * 0.1, xb = xp + lado * LH;
    if (k < 4) { HUECOS.min[k].set(Math.min(xa, xb), e.y - 0.25, e.z - Ra - 0.2); HUECOS.max[k].set(Math.max(xa, xb), e.y + alto + 0.25, e.z + Ra + 0.2); }
    // bóveda de sillería tras el muro hasta la primera columna de vértices del terreno (cada 5 m): entre el muro y esa
    // columna la malla baja en cuña y sin esto se veía el hueco. Techo a la altura del muro sobre el arco y dos muros laterales
    const xg = xp + lado * grosor, xv = lado > 0 ? Math.ceil(xg / 5 + 1e-6) * 5 : Math.floor(xg / 5 - 1e-6) * 5, lt = Math.abs(xv - xg) + 0.9;
    const mS = matMundo(texSilleria(), 4, 0xd6cec2), yT = e.y + hp + Ra + 1.4, cxB = xg - lado * 0.2 + lado * lt / 2;
    const techo = malla(new THREE.BoxGeometry(lt, yT - (e.y + alto), 2 * Ra + 2), mS); techo.position.set(cxB, (yT + e.y + alto) / 2, e.z); g.add(techo);
    for (const sz of [-1, 1]) { const w = malla(new THREE.BoxGeometry(lt, alto + 0.6, 0.8), mS); w.position.set(cxB, e.y - 0.3 + (alto + 0.6) / 2, e.z + sz * (Ra + 0.65)); g.add(w); }
    // N1-C49 (reabierta): manto de cerro tras el muro. La malla del terreno (vértices cada 5 m) bajaba en rampa desde la columna
    // de la trinchera (y = vía) hasta la siguiente, y desde atrás o arriba el muro y la bóveda se veían como una placa suelta.
    // Parche fino (0,5 m) con el material del suelo que sigue altura() y nunca queda bajo la malla gruesa; también es física
    const xm0 = xp + lado * (grosor - 0.3), xm1 = xv + lado * 5, ZM = 12, PM = 0.5, nmx = Math.round(Math.abs(xm1 - xm0) / PM), nmz = Math.round(2 * ZM / PM);
    const pm = [], cm = [], mm = [], im = [], cT = new THREE.Color(0xb69a76), cR = new THREE.Color(0x9c8068), cc = new THREE.Color();
    for (let j = 0; j <= nmz; j++) for (let i = 0; i <= nmx; i++) {
      const x = xm0 + (xm1 - xm0) * i / nmx, z = e.z - ZM + j * PM, y = Math.max(altura(x, z), alturaMalla(x, z)) + 0.05;
      pm.push(x, y, z);
      const p2 = Math.abs(altura(x + 2, z) - altura(x - 2, z)) + Math.abs(altura(x, z + 2) - altura(x, z - 2));
      cc.copy(cT).lerp(cR, Math.min(1, p2 / 4)); cm.push(cc.r, cc.g, cc.b);
      const p6 = (Math.abs(altura(x + 6, z) - altura(x - 6, z)) + Math.abs(altura(x, z + 6) - altura(x, z - 6))) / 3;
      mm.push(Math.min(1, Math.max(0, (p6 - 2.4) / 3.5)), 0);
    }
    for (let j = 0; j < nmz; j++) for (let i = 0; i < nmx; i++) { const a = j * (nmx + 1) + i, b = a + 1, c2 = a + nmx + 1, d = c2 + 1; im.push(a, c2, b, b, c2, d); }
    const gm = new THREE.BufferGeometry(); gm.setAttribute('position', new THREE.Float32BufferAttribute(pm, 3)); gm.setAttribute('color', new THREE.Float32BufferAttribute(cm, 3));
    gm.setAttribute('mezcla', new THREE.Float32BufferAttribute(mm, 2)); gm.setIndex(im); gm.computeVertexNormals();
    const mtm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }); texturasSuelo(mtm);
    const manto = new THREE.Mesh(gm, mtm); manto.receiveShadow = true; manto.name = 'mantoPortal'; g.add(manto);
    fis.malla(new Float32Array(pm), new Uint32Array(im), { tipo: 'tierra' }); }
  for (let k = 0; k < nSeg; k++) {
    const x0t = k * paso, lenT = Math.min(paso, largo - x0t), xc = xp + lado * (x0t + lenT / 2 + 0.2);
    let terr = 1e9; for (const dz of [-Ra, 0, Ra]) for (const dx of [-lenT / 2, 0, lenT / 2]) terr = Math.min(terr, altura(xc + dx, e.z + dz));
    const hT = x0t < LH ? alto : Math.max(3.2, Math.min(alto, terr - e.y - 0.4));   // N1-C49: los primeros LH m, a toda altura (el suelo ahí no se dibuja)
    const t = new THREE.Mesh(new THREE.BoxGeometry(lenT, hT, 2 * Ra + 0.4), matT); t.position.set(xc, e.y - 0.3 + hT / 2, e.z); g.add(t); tuneles.push(t);
  }
  const tun = tuneles[0];
  // fondo negro dentro del arco: sin él se veía la tierra del cerro subiendo detrás del muro (el terreno es una sola superficie)
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(2 * Ra + 0.2, hp + Ra + 0.4), new THREE.MeshBasicMaterial({ color: 0x0a0807 }));
  fondo.position.set(xp + lado * (hondo ? LH - 0.5 : grosor - 0.2), e.y + (hp + Ra + 0.4) / 2 - 0.3, e.z); fondo.rotation.y = -lado * Math.PI / 2; g.add(fondo);
  g.traverse(o => { if (o.isMesh && !tuneles.includes(o) && o !== fondo && o.name !== 'mantoPortal') { o.castShadow = true; o.receiveShadow = true; } });
  // tapón invisible en la boca: no se camina túnel adentro; se quita cuando parte el tren del final (entidades.js)
  R.tapones.push(fis.movil(xp + lado * 1.2, e.y + 3, e.z, [{ sx: 0.8, sy: 7, sz: 2 * Ra + 0.6 }], { tipo: 'muro' }));
  return g;
}

function yPlaza(e) {
  const xs = [e.x - e.sx / 2, e.x + e.sx / 2], zs = [e.z - e.sz / 2, e.z + e.sz / 2];
  let mx = -1e9; for (const x of xs) for (const z of zs) mx = Math.max(mx, altura(x, z)); mx = Math.max(mx, altura(e.x, e.z));
  return mx + (e.sobreTerreno ?? 2);
}
// alturas para apoyar edificios: en 1905 se mide sobre la MALLA VISUAL (vértices cada 5 m, triángulos), no sobre altura():
// la terraza es plana, pero la celda del borde se interpola con vértices de la ladera, y el edificio quedaba enterrado ~1 m por el cerro y en el aire por la bajada
function muestrasTerreno(x0, x1, z0, z1, f) {
  const vis = LADERA.natural, n = vis ? Math.max(4, Math.ceil(Math.max(x1 - x0, z1 - z0))) : 4;
  const h = vis ? alturaMalla : altura;
  let r = null;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const y = h(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * j / n); r = r === null ? y : f(r, y); }
  return r;
}
function minTerreno(x0, x1, z0, z1) { return muestrasTerreno(x0, x1, z0, z1, Math.min); }
// N1-C74: mínimo con altura() (sin la malla visual): en el borde de una terraza altura() y la malla de 5 m difieren hasta ~1 m
function minAltura(x0, x1, z0, z1) { const n = Math.max(4, Math.ceil(Math.max(x1 - x0, z1 - z0))); let r = 1e9; for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) r = Math.min(r, altura(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * j / n)); return r; }
function maxTerreno(x0, x1, z0, z1) { return muestrasTerreno(x0, x1, z0, z1, Math.max); }
// N4-C19 (Diego): escalinata de roca tallada de S a E ({x, y, z}): peldaños visibles de ≤ 0,45 m (una sola malla) y una rampa
// convexa lisa para la física (S → E, ≤ 52° del controlador). Las repisas del N4 tenían 4,4 m de muro del lado de abajo: a pie solo
// se pasaba trepando por el costado (el piloto, a los saltos; Diego no podía).
function escalinataRoca(G, fis, S, E, ancho = 3) {
  const dx = E.x - S.x, dz = E.z - S.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, sube = E.y - S.y, n = Math.max(3, Math.round(Math.abs(sube) / 0.42)), run = L / n, rot = Math.atan2(ux, uz);
  const pos = [], nor = [], uv = [], rY = new THREE.Matrix4().makeRotationY(rot);
  const suelo = (x, z) => Math.min(altura(x, z), alturaMalla(x, z));
  for (let k = 0; k < n; k++) {
    const s = run * (k + 0.5), cx = S.x + ux * s, cz = S.z + uz * s, top = S.y + sube * (k + 0.5) / n;   // tope a media contrahuella de la rampa física
    let bajo = top - 0.6; for (const a of [-1, 1]) for (const b of [-1, 1]) bajo = Math.min(bajo, suelo(cx + ux * run / 2 * a - uz * ancho / 2 * b, cz + uz * run / 2 * a + ux * ancho / 2 * b) - 0.5);
    const h = top - bajo, ga = new THREE.BoxGeometry(ancho * (1 + 0.04 * Math.sin(k * 2.3)), h, run + 0.04).toNonIndexed();
    ga.applyMatrix4(rY); ga.applyMatrix4(new THREE.Matrix4().makeTranslation(cx, bajo + h / 2, cz));
    pos.push(...ga.attributes.position.array); nor.push(...ga.attributes.normal.array); uv.push(...ga.attributes.uv.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  G.add(malla(geo, matMundo('suelo_roca', 6, 0xc8baa8)));
  const pts = [];
  for (const [P, yb] of [[S, Math.min(S.y, suelo(S.x, S.z)) - 1.5], [E, Math.min(E.y, suelo(E.x, E.z)) - 1.5]]) for (const b of [-1, 1]) { const x = P.x - uz * ancho / 2 * b, z = P.z + ux * ancho / 2 * b; pts.push(x, P.y, z, x, yb, z); }
  fis.convexo(new Float32Array(pts), { tipo: 'roca' });
  // pretiles de piedra a los costados (0,45 m visibles, 1,1 m de colisión): sin ellos el piloto (y Diego) se salían por el lado
  // y quedaban al pie del muro de la repisa siguiente
  const lg = Math.hypot(L, sube), pend = Math.atan2(sube, L), mp = matMundo('suelo_roca', 3, 0xb3a796);
  for (const b of [-1, 1]) {
    const ox = -uz * (ancho / 2 + 0.17) * b, oz = ux * (ancho / 2 + 0.17) * b;
    const pr = malla(new THREE.BoxGeometry(0.34, 0.6, lg + 0.3), mp); pr.position.set((S.x + E.x) / 2 + ox, (S.y + E.y) / 2 + 0.15, (S.z + E.z) / 2 + oz);
    pr.rotation.order = 'YXZ'; pr.rotation.y = rot; pr.rotation.x = -pend; G.add(pr);
    const q = []; for (const P of [S, E]) for (const w of [-0.17, 0.17]) { const x = P.x + ox - uz * w * b, z = P.z + oz + ux * w * b; q.push(x, P.y - 0.3, z, x, P.y + 1.1, z); }
    fis.convexo(new Float32Array(q), { tipo: 'baranda' });
  }
}


// ------------------------------------------------------------------ pueblo de 1905: caminos de tierra y plaza (N1)
// altura de la malla visual del terreno (vértices cada 5 m, dos triángulos por celda con la diagonal b–c): lo que se ve, no lo que dice altura()
const alturaMalla = (x, z) => {
  const P = 5, X0 = -760, Z0 = -1000, u = (x - X0) / P, v = (z - Z0) / P, i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j;
  const ya = altura(X0 + i * P, Z0 + j * P), yb = altura(X0 + (i + 1) * P, Z0 + j * P), yc = altura(X0 + i * P, Z0 + (j + 1) * P), yd = altura(X0 + (i + 1) * P, Z0 + (j + 1) * P);
  return fx + fz <= 1 ? ya + fx * (yb - ya) + fz * (yc - ya) : yd + (1 - fx) * (yc - yd) + (1 - fz) * (yb - yd);
};
const PLAZA1905 = { x: 6, z: -2, r: 9 };   // junto a la estación, sobre el camino que baja de las casas al andén
const CAMINOS1905 = [   // polilíneas (x, z): la ruta del piloto, con ramales a las casas y la panadería
  [[-425, -470], [-400, -430], [-360, -360], [-338, -350], [-326, -336], [-326, -316], [-330, -303]],   // Cerro Negro → andén del andarivel, rodeando la casa de Hamilton por el este
  [[-268, -300], [-252, -294], [-243, -292]],                                                    // andarivel → bocamina de Fortuna
  [[-190, -202.8], [-190, -198], [-172, -184], [-158, -170], [-139, -156], [-120, -141], [-100, -124], [-78, -108], [-52, -102], [-46, -84], [-40, -60], [-20, -20], [6, -2], [21, 11]],   // salida de la mina → casas → rodea el molino por el este → plaza → andén
  // N1-ABASTECIMIENTO-c (carril vida, 15-11, Diego: «las carretas entre el tren y el andarivel PASANDO POR PUEBLO HUNDIDO»): camino de carretas
  // de la yunta en dos tramos que se empalman con la calle de Pueblo Hundido (el tramo de arriba de CAMINOS1905[2], que la carreta recorre tal cual).
  // Trazado con A* sobre el terreno (herramientas/abasto_astar.py, pendiente ≤ 20°): el camino real del molino tiene 40-53° y no sirve para carretas.
  // Reemplaza a la 4.ª polilínea de N1-ABASTECIMIENTO-b (meseta oeste, ya no se usa). Quitar estas 2 líneas revierte el tallado.
  [[18, 7], [6, 10.5], [-6, 10], [-16, 4], [-24, -6], [-28, -11], [-46, -23], [-64, -35], [-82, -47], [-100, -59], [-109, -65], [-115, -77], [-133, -89], [-151, -101], [-133, -113], [-115, -125], [-109, -128], [-112, -137], [-120, -141]],   // estación del tren → bordea la plaza por el sur (la fuente) → sube en zigzag por la ladera al poniente del molino → entrada de la calle de Pueblo Hundido
  [[-172, -185], [-184, -187], [-197, -192], [-214, -200], [-223, -206], [-229, -206], [-238, -212], [-220, -224], [-202, -236], [-184, -248], [-175, -254], [-193, -266], [-202, -269], [-217, -269], [-226, -269], [-244, -275]],   // salida de la calle de Pueblo Hundido → dos curvas en zigzag → explanada de la estación baja del andarivel (B)
];
const texCamino = () => texCanvas('camino1905', (g, n) => {
  let sem = 7; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#cdb78f'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) { const t = az(); g.fillStyle = t < 0.4 ? 'rgba(130,106,76,0.4)' : t < 0.8 ? 'rgba(232,216,180,0.5)' : 'rgba(90,72,56,0.35)'; const r = 1 + az() * 3; g.beginPath(); g.arc(az() * n, az() * n, r, 0, 6.3); g.fill(); }
  for (const cx of [0.3, 0.7]) { const gr = g.createLinearGradient((cx - 0.07) * n, 0, (cx + 0.07) * n, 0); gr.addColorStop(0, 'rgba(70,52,38,0)'); gr.addColorStop(0.5, 'rgba(70,52,38,0.35)'); gr.addColorStop(1, 'rgba(70,52,38,0)'); g.fillStyle = gr; g.fillRect((cx - 0.07) * n, 0, 0.14 * n, n); }   // huellas de carreta
  g.globalCompositeOperation = 'destination-in';   // bordes difusos: sin canto recto contra el terreno
  const a = g.createLinearGradient(0, 0, n, 0); a.addColorStop(0, 'rgba(0,0,0,0)'); a.addColorStop(0.14, 'rgba(0,0,0,1)'); a.addColorStop(0.86, 'rgba(0,0,0,1)'); a.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = a; g.fillRect(0, 0, n, n);
}, 256);
const texGravilla = () => texCanvas('gravilla1905', (g, n) => {
  let sem = 11; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#b09878'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 4200; i++) { const t = az(); g.fillStyle = t < 0.4 ? 'rgba(110,90,68,0.5)' : t < 0.75 ? 'rgba(220,204,172,0.55)' : 'rgba(150,136,118,0.5)'; g.beginPath(); g.ellipse(az() * n, az() * n, 1 + az() * 2.6, 1 + az() * 1.8, az() * 3, 0, 6.3); g.fill(); }
}, 256);
function construirPueblo1905(def, fis, R) {
  const G = new THREE.Group(); G.name = 'pueblo1905';
  let sem = 5; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  // T-CAM1 (Diego: «el camino está muy delimitado, se ven muy falsos»): sin cinta de textura con borde duro ni hileras de piedras.
  // El camino y la plaza se pintan en el sombreado del terreno (terreno.js CAMINO) con una máscara de distancia a la polilínea;
  // aquí quedan solo piedras sueltas al azar, matas de coirón en los bordes y peldaños de rollizo con estacas donde de verdad sube fuerte.
  const piedras = [], escalones = [], matas = [], ancho = 3.4, curvas = CAMINOS1905.map(pts => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'));
  { // máscara: 0,5 m por texel sobre la caja de los caminos y la plaza (r = distancia al eje /6 m, b = distancia al centro de la plaza /24 m)
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const pts of CAMINOS1905) for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    x0 = Math.min(x0, PLAZA1905.x - 24) - 8; x1 = Math.max(x1, PLAZA1905.x + 24) + 8; z0 = Math.min(z0, PLAZA1905.z - 24) - 8; z1 = Math.max(z1, PLAZA1905.z + 24) + 8;
    const T = 0.5, W = Math.ceil((x1 - x0) / T), H = Math.ceil((z1 - z0) / T), dist = new Float32Array(W * H).fill(6), RR = Math.ceil(6 / T);
    for (const c of curvas) {
      const n = Math.ceil(c.getLength() / 0.35);
      for (let k = 0; k <= n; k++) {
        const p = c.getPoint(k / n), ci = Math.round((p.x - x0) / T), cj = Math.round((p.z - z0) / T);
        for (let j = Math.max(0, cj - RR); j <= Math.min(H - 1, cj + RR); j++) for (let i = Math.max(0, ci - RR); i <= Math.min(W - 1, ci + RR); i++) {
          const d = Math.hypot(x0 + i * T - p.x, z0 + j * T - p.z), q = j * W + i; if (d < dist[q]) dist[q] = d;
        }
      }
    }
    const datos = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, dP = Math.hypot(x0 + i * T - PLAZA1905.x, z0 + j * T - PLAZA1905.z);
      datos[q * 4] = Math.round(dist[q] / 6 * 255); datos[q * 4 + 1] = 128; datos[q * 4 + 2] = Math.round(Math.min(1, dP / 24) * 255); datos[q * 4 + 3] = 255;
    }
    const tx = new THREE.DataTexture(datos, W, H); tx.magFilter = tx.minFilter = THREE.LinearFilter; tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; tx.needsUpdate = true;
    // texel j = z0 + j·T; con LinearFilter el centro del texel cae en (j + 0,5)/H: la caja se corre medio texel
    CAMINO.tex.value = tx; CAMINO.caja.value.set(x0 - T / 2, z0 - T / 2, 1 / (W * T), 1 / (H * T)); CAMINO.on.value = 1;
  }
  for (const curva of curvas) {
    const largo = curva.getLength(), n = Math.max(4, Math.ceil(largo / 0.8));
    let ultimoPeldano = -9, yPrev = null, pPrev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, p = curva.getPoint(t), tg = curva.getTangent(t), nx = -tg.z, nz = tg.x, h = ancho / 2;
      // piedras sueltas: pocas, de tamaño muy distinto, a veces en grupitos y casi siempre fuera de la huella (nada de hileras)
      if (az() < 0.07) { const sg = az() < 0.5 ? -1 : 1, off = h * (0.85 + az() * 0.9), nG = az() < 0.3 ? 2 + Math.floor(az() * 3) : 1;
        for (let g = 0; g < nG; g++) { const x = p.x + nx * off * sg + (az() - 0.5) * 0.9, z = p.z + nz * off * sg + (az() - 0.5) * 0.9; piedras.push([x, z, 0.06 + Math.pow(az(), 2) * 0.32, az() * 6.28]); } }
      // matas de coirón (pasto seco de altura) en los bordes, nunca en la nieve
      for (const sg of [-1, 1]) if (az() < 0.2) { const off = h * 0.95 + 0.2 + az() * 2.4, x = p.x + nx * off * sg + (az() - 0.5) * 0.6, z = p.z + nz * off * sg + (az() - 0.5) * 0.6;
        if (!hayNieve(x, z)) matas.push([x, z, 0.55 + az() * 0.7, az() * 6.28]); }
      const y = alturaMalla(p.x, p.z);
      // peldaños: solo donde el tramo sube fuerte (> 30°), cortos (no asoman del camino) y con dos estacas que los sujetan
      if (pPrev) { const pend = Math.atan2(Math.abs(y - yPrev), Math.hypot(p.x - pPrev.x, p.z - pPrev.z)) * 180 / Math.PI; if (pend > 30 && largo * t - ultimoPeldano > 1.3) { const w = 1.0, yI = alturaMalla(p.x - nx * w, p.z - nz * w), yD = alturaMalla(p.x + nx * w, p.z + nz * w); if (Math.abs(yI - yD) < 0.5) { ultimoPeldano = largo * t;
        const sube = Math.max(alturaMalla(p.x + tg.x * 0.14, p.z + tg.z * 0.14), alturaMalla(p.x - tg.x * 0.14, p.z - tg.z * 0.14)) - y;
        escalones.push([p.x, (yI + yD) / 2 + sube + 0.03 - 0.13, p.z, Math.atan2(tg.x, tg.z), 2 * w, Math.atan2(yI - yD, 2 * w), nx, nz, tg.x, tg.z]); } } }   // rollizo medio enterrado (N1-O7), de lado con la ladera
      yPrev = y; pPrev = p;
    }
  }
  if (escalones.length) {   // peldaños: rollizos atravesados, medio enterrados, con una estaca en cada punta del lado de abajo
    const gT = new THREE.CylinderGeometry(0.12, 0.12, 1, 9); gT.rotateZ(Math.PI / 2);
    const tr = new THREE.InstancedMesh(gT, mat(0x5e4228, { rough: 1 }), escalones.length), mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), qr = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), ejeY = new THREE.Vector3(0, 1, 0), ejeZ = new THREE.Vector3(0, 0, 1);
    const est = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 6), mat(0x4e3622, { rough: 1 }), escalones.length * 2);
    escalones.forEach(([x, y, z, yaw, w, lado, nx, nz, tx, tz], i) => { qq.setFromAxisAngle(ejeY, yaw).multiply(qr.setFromAxisAngle(ejeZ, lado)); v3.set(x, y, z); s3.set(w / Math.cos(lado), 1, 1); mm.compose(v3, qq, s3); tr.setMatrixAt(i, mm);
      tr.setColorAt(i, new THREE.Color().setScalar(0.82 + ((i * 37) % 11) / 55));
      const yA = alturaMalla(x + tx * 0.2, z + tz * 0.2), yB = alturaMalla(x - tx * 0.2, z - tz * 0.2), sd = yA < yB ? 1 : -1;   // estacas del lado de abajo de la pendiente
      for (const s of [-1, 1]) { const ex = x + nx * (w / 2 - 0.12) * s + tx * 0.17 * sd, ez = z + nz * (w / 2 - 0.12) * s + tz * 0.17 * sd; mm.makeTranslation(ex, Math.min(y + 0.15, alturaMalla(ex, ez) + 0.2) - 0.25, ez); /* cabeza de la estaca apenas sobre el rollizo */ est.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), mm); }
    });
    tr.castShadow = true; tr.receiveShadow = true; est.castShadow = true; G.add(tr, est);
  }
  if (matas.length) {   // coirón: manojo de hojas finas y secas que se abren hacia afuera (un cono por hoja, en una sola geometría)
    const hojas = [], m4 = new THREE.Matrix4(), eu = new THREE.Euler();
    for (let k = 0; k < 9; k++) { const g = new THREE.ConeGeometry(0.03, 0.42 + (k % 3) * 0.08, 3); g.translate(0, 0.21, 0); eu.set(0.35 + (k % 2) * 0.2, k * 0.7, 0, 'YXZ'); g.applyMatrix4(m4.makeRotationFromEuler(eu)); g.translate(Math.cos(k * 0.7) * 0.05, 0, Math.sin(k * 0.7) * 0.05); hojas.push(g); }
    const pos = [], nor = []; for (const g of hojas) { const gi = g.toNonIndexed(); pos.push(...gi.attributes.position.array); nor.push(...gi.attributes.normal.array); }
    const gM = new THREE.BufferGeometry(); gM.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gM.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const im = new THREE.InstancedMesh(gM, mat(0xb39a5e, { rough: 1 }), matas.length), dm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), eY = new THREE.Vector3(0, 1, 0);
    matas.forEach(([x, z, s, a], i) => { q.setFromAxisAngle(eY, a); sc.set(s, s * (0.8 + az() * 0.5), s); p3.set(x, alturaMalla(x, z) - 0.03, z); dm.compose(p3, q, sc); im.setMatrixAt(i, dm); im.setColorAt(i, new THREE.Color().setHSL(0.11 + az() * 0.03, 0.35 + az() * 0.15, 0.48 + az() * 0.14)); });
    im.castShadow = true; im.receiveShadow = true; G.add(im);
    // G9 (16-11): mata de coirón de malla (G11 mata_coiron, LOD de 760 caras) en las mismas copias ×0,75 (~0,5 m como los conos); el tono
    // de cada copia pasa a un gris claro que apenas tiñe la textura. Respaldo: los conos (se ocultan solo si la malla cargó)
    { const pu = precargarUtileria(); if (pu) pu.then(() => { const pg = piezaGrupo('mata_coiron', null, 1); if (!pg) return; const me = pg.children[0];
      const ik = new THREE.InstancedMesh(me.geometry, me.material, matas.length), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4().makeScale(0.75, 0.75, 0.75), c = new THREE.Color(), hsl = {};
      for (let i = 0; i < matas.length; i++) { im.getMatrixAt(i, m1); ik.setMatrixAt(i, m1.multiply(m2)); im.getColorAt(i, c); c.getHSL(hsl); ik.setColorAt(i, c.setHSL(0.1, 0.15, Math.min(1, 0.82 + (hsl.l - 0.55) * 1.2))); }
      ik.castShadow = false; ik.receiveShadow = true; ik.name = 'util:mata_coiron'; G.add(ik); im.visible = false; }); }
  }
  // plaza: terraza plana (ver TERRAZAS) con el piso de gravilla pintado en el terreno (sin disco ni anillo de piedras), fuente, bancas y faroles
  const { x: px, z: pz, r: pr } = PLAZA1905, py = alturaMalla(px, pz) + 0.02;
  for (let i = 0; i < 26; i++) { const a = az() * Math.PI * 2, rr = pr + (az() - 0.4) * 2.2; piedras.push([px + Math.cos(a) * rr, pz + Math.sin(a) * rr, 0.07 + Math.pow(az(), 2) * 0.28, az() * 6.28]); }
  const roca = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), matMundo('suelo_roca', 2, 0xb4a898), piedras.length), dm = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
  piedras.forEach(([x, z, r, a], i) => {
    const y = alturaMalla(x, z);
    e3.set(az() * 0.5, a, az() * 0.5); q.setFromEuler(e3); sc.set(r * (1 + az() * 0.6), r * (0.45 + az() * 0.3), r * (0.8 + az() * 0.5)); p3.set(x, y + r * 0.12, z);
    dm.compose(p3, q, sc); roca.setMatrixAt(i, dm); roca.setColorAt(i, new THREE.Color().setHSL(0.08 + az() * 0.03, 0.08 + az() * 0.06, 0.52 + az() * 0.25));
  });
  roca.castShadow = true; roca.receiveShadow = true; G.add(roca);
  { const pu = precargarUtileria(); if (pu) pu.then(() => { if (!hayPieza('roca1') || !hayPieza('roca2') || !hayPieza('roca3')) return;   // N0-UTIL3 (E1): piedras sueltas = 3 rocas TRELLIS instanciadas (bolón, laja, montón) con escala y giro al azar
    const U = new Colocador(), ID = ['roca1', 'roca2', 'roca3'], AN = [1.4, 1.0, 1.2];
    piedras.forEach(([x, z, r, a], i) => { const k = i % 3, e = 2.2 * r / AN[k]; U.poner(ID[k], x, alturaMalla(x, z) - r * 0.12, z, a, 0, [e * (0.85 + (i * 37 % 10) * 0.03), e, e]); });
    U.armar(G); roca.visible = false; }); }
  // fuente de piedra: pilón, agua, columna y copa
  const piedra = matMundo(texSilleria(), 2, 0xd0c6b6), cil = (r0, r1, h, y, m) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 24), m); c.position.set(px, py + y, pz); c.castShadow = true; c.receiveShadow = true; G.add(c); return c; };
  cil(1.75, 1.75, 0.05, 0.66, new THREE.MeshStandardMaterial({ color: 0x4f8fae, roughness: 0.08, metalness: 0.1, emissive: 0x16344a, emissiveIntensity: 0.5 }));
  const fu = [cil(2.0, 2.15, 0.7, 0.35, piedra), cil(0.3, 0.4, 1.6, 1.2, piedra), cil(0.95, 0.45, 0.22, 2.0, piedra), cil(0.16, 0.2, 0.5, 2.25, piedra)];
  const bola = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), piedra); bola.position.set(px, py + 2.62, pz); G.add(bola); fu.push(bola);
  { const pu = precargarUtileria(); if (pu) pu.then(() => { const f = piezaGrupo('fuente_plaza', [1.9, 1.9, 1.9]); if (!f) return; f.position.set(px, py - 0.02, pz); G.add(f); for (const o of fu) o.visible = false; }); }   // N0-UTIL3 (E1): fuente de piedra TRELLIS ×1,9 (4,2 m); el agua sigue procedural
  fis.caja(px, py + 0.35, pz, 4.2, 0.7, 4.2, 0, { tipo: 'muro' });
  // bancas de tablas con respaldo, mirando a la fuente
  const madera = texMat('tablas', 0x9a6e48), hierro = texMat('pintado');   // TEX: tablas viejas con vetas y fierro fundido pintado (antes mat liso)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, b = new THREE.Group(); b.position.set(px + Math.cos(a) * 5.8, py, pz + Math.sin(a) * 5.8); b.rotation.y = -a - Math.PI / 2;
    const asiento = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.5), madera); asiento.position.y = 0.48; b.add(asiento);
    const resp = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.06), madera); resp.position.set(0, 0.85, -0.22); resp.rotation.x = -0.12; b.add(resp);
    for (const sx of [-0.85, 0.85]) { const pata = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.5), hierro); pata.position.set(sx, 0.25, 0); b.add(pata); }
    b.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; uvPieza(o.geometry, o.material); } }); G.add(b);   // TEX: UV en metros
    { const pu = precargarUtileria(); if (pu) pu.then(() => { const m = piezaGrupo('banco_plaza_1905', [2.0 / 1.8, 1, 1]); if (!m) return; for (const o of b.children) o.visible = false; m.name = 'g9ext_banco'; b.add(m); }); }   // G9-EXT (16-11): banca de malla (tablas y costados de fierro fundido); respaldo: las cajas de arriba
    fis.caja(b.position.x, py + 0.3, b.position.z, 2.0, 0.6, 0.6, b.rotation.y, { tipo: 'muro' });
  }
  // faroles de gas: poste de fierro, brazo y farol con vidrio cálido (emisivo, sin luz real)
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, x = px + Math.cos(a) * (pr - 1), z = pz + Math.sin(a) * (pr - 1), f = new THREE.Group(); f.position.set(x, py, z);
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.4, 8), hierro); poste.position.y = 1.7; f.add(poste);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 8), hierro); base.position.y = 0.25; f.add(base);
    const vidrio = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.34), texMat('vidrio')); /* TEX: vidrio con marco y cruz de fierro (compartido) */ vidrio.position.y = 3.65; f.add(vidrio);
    const techo = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.32, 4), hierro); techo.position.y = 4.06; techo.rotation.y = Math.PI / 4; f.add(techo);
    f.traverse(o => { if (o.isMesh) { o.castShadow = true; uvPieza(o.geometry, o.material); } }); G.add(f);   // TEX: UV en metros
    { const pu = precargarUtileria(); if (pu) pu.then(() => { const m = piezaGrupo('farol_calle_1905'); if (!m) return; poste.visible = base.visible = techo.visible = vidrio.visible = false; m.rotation.y = a; m.name = 'g9ext_farol'; f.add(m); }); }   // G9-EXT (16-11): farol de calle de parafina de malla (id farol_calle_1905: «farol_parafina» es el FINO colgado de C1) (4,2 m); el vidrio TEX se oculta: la malla trae su farol
    fis.caja(x, py + 1.7, z, 0.3, 3.4, 0.3, 0, { tipo: 'muro' });
  }
  R.exterior.add(G);
}

function elemento(e, def, fis, R) {
  const G = R.exterior;
  switch (e.t) {
    case 'edificio': return e.giro != null ? edificioGirado(e, def, fis, R, edificio) : edificio(e, def, fis, R);   // giro: ?sewell=cono
    case 'escalera': return escalera(e, fis, R);
    case 'fundicion': return;   // N1-MOLINO: se arma después de la playa de las ollas (kitFundicion.js)
    case 'playaOllas': return;   // N0-OLLAS: se arma después (rellano + vía), ver «playaOllas» más abajo
    case 'plaza': {
      const y = e.y ?? e._yT ?? yPlaza(e), fondo = Math.min(minTerreno(e.x - e.sx / 2, e.x + e.sx / 2, e.z - e.sz / 2, e.z + e.sz / 2), y) - 3;
      const m = malla(new THREE.BoxGeometry(e.sx, y - fondo, e.sz), e.color === COLOR.roca ? (e.terraza || e.terrazaLadera ? rocaSinMosaico(6) : matMundo('suelo_roca', 6)) : e.color === COLOR.concreto || e.color === 0xc8bfae ? matMundo(texLosas(R.invierno), 7) : matMundo('concreto', 4, e.color ?? COLOR.concreto));
      m.position.set(e.x, (y + fondo) / 2, e.z); G.add(m);   // plazas cívicas: losas de piedra (con nieve en invierno). Antes este comentario se tragaba el G.add y la losa no se dibujaba
      fis.caja(e.x, (y + fondo) / 2, e.z, e.sx, y - fondo, e.sz, 0, { tipo: 'plaza' });
      if (e.color !== COLOR.roca && !e.terraza && !e.terrazaLadera) {   // N0-FABLE-1611b M17: sardinel de piedra en el borde y zócalo oscuro bajo la losa (antes una plancha lisa sin borde)
        const hc = 3 / (e.sx / 2), sard = (cx, cz, w, d) => { const b = caja(w, 0.2, d, 0x8d8576); b.position.set(cx, y + 0.1, cz); b.castShadow = false; G.add(b); fis.caja(cx, y + 0.1, cz, w, 0.2, d, 0, { tipo: 'plaza' }); };   // ESC (16-11): el sardinel con su colisión (antes Nato se hundía 20 cm al pisarlo)
        const sx2 = e.sx / 2, sz2 = e.sz / 2, ce = 0.3;
        for (const sg of [-1, 1]) {   // frente y atrás con el hueco de la escalera (6 m); costados enteros
          const L = (sx2 - hc * sx2) - 0.0, c = (sx2 + hc * sx2) / 2;
          for (const sd of [-1, 1]) sard(e.x + sd * c, e.z + sg * (sz2 - ce / 2), L, ce);
          sard(e.x + sg * (sx2 - ce / 2), e.z, ce, e.sz - 2 * ce);
        }
        const zo = malla(new THREE.BoxGeometry(e.sx + 0.3, 1.4, e.sz + 0.3), matMundo('suelo_roca', 3, 0x6e6558)); zo.position.set(e.x, y - 0.7 - 0.02, e.z); zo.castShadow = false; G.add(zo);
        fis.caja(e.x, y - 0.72, e.z, e.sx + 0.3, 1.4, e.sz + 0.3, 0, { tipo: 'plaza' });   // ESC (16-11): el zócalo asoma 15 cm alrededor de la losa: con colisión (antes Nato se hundía en ese borde)
      }
      if (e.terraza) murosTerraza(e, y, fis, G);   // nido del N4: muros de roca a los costados y atrás, donde la terraza corta el cerro
      // barandas al frente y atrás (con el hueco de la escalera) y también a los costados (antes la losa quedaba abierta por los lados)
      // hueco de 6 m (escalera más ancha, 5 m, más 0,5 m por lado): con 0,06/0,04 del ancho medía 3,8 y 2,6 m y la baranda se montaba sobre la escalera
      const hg = 3 / (e.sx / 2);
      if (e.baranda && !e.barandaCono) for (const [x0, z0, x1, z1] of [[-1, 1, -hg, 1], [hg, 1, 1, 1], [-1, -1, -hg, -1], [hg, -1, 1, -1], [-1, -1, -1, 1], [1, -1, 1, 1]]) {
        const a = new THREE.Vector3(e.x + x0 * e.sx / 2, y + 1.1, e.z + z0 * e.sz / 2), b = new THREE.Vector3(e.x + x1 * e.sx / 2, y + 1.1, e.z + z1 * e.sz / 2);
        G.add(tubo(a, b, 0.06, 0xe2ded2));
        const L = a.distanceTo(b);
        for (let k = 0; k <= L; k += 4) { const p = a.clone().lerp(b, k / L); G.add(tubo(p.clone().setY(y), p, 0.04, COLOR.blanco)); }   // postes cada 4 m
      }
      e._y = y; R.ultimaPlaza = { ...e, y };
      return;
    }
    case 'via': {
      for (const dz of [-0.6, 0.6]) { const r = piezaTex(new THREE.BoxGeometry(e.x1 - e.x0, 0.15, 0.12), texMat('riel')); r.position.set((e.x0 + e.x1) / 2, e.y + 0.3, e.z + dz); G.add(r); }
      const lecho = malla(new THREE.BoxGeometry(e.x1 - e.x0, 0.4, 3.4), matMundo('suelo_roca', 1.5, 0x8a7c70)); lecho.position.set((e.x0 + e.x1) / 2, e.y, e.z); G.add(lecho);   // balasto con textura
      // durmientes de madera cada 0,9 m (antes la vía eran dos líneas sobre una caja lisa)
      const nD = Math.floor((e.x1 - e.x0) / 0.9), dur = new THREE.InstancedMesh(uvMetros(new THREE.BoxGeometry(0.22, 0.14, 2.3), 1.6), texMat('durmiente', 0xb8a08a), nD), dm = new THREE.Matrix4();
      for (let i = 0; i < nD; i++) { dm.makeTranslation(e.x0 + 0.45 + i * 0.9, e.y + 0.24, e.z); dur.setMatrixAt(i, dm); }
      dur.receiveShadow = true; G.add(dur);
      // terraplén bajo la vía, para que no flote sobre la quebrada
      const t = malla(new THREE.BoxGeometry(e.x1 - e.x0, 30, 6), matMundo('suelo_roca', 5, 0x9a8676)); t.position.set((e.x0 + e.x1) / 2, e.y - 15.2, e.z); G.add(t);
      fis.caja((e.x0 + e.x1) / 2, e.y - 15, e.z, e.x1 - e.x0, 30.4, 6, 0, { tipo: 'via' });
      return;
    }
    case 'anden': {
      const m = malla(new THREE.BoxGeometry(e.x1 - e.x0, e.y + 3, e.ancho), matAnden()); m.position.set((e.x0 + e.x1) / 2, (e.y - 3) / 2, e.z); G.add(m);   // TEX: muro de sillería y piso de concreto (antes todo concreto)   // andén de concreto con textura
      const borde = malla(new THREE.BoxGeometry(e.x1 - e.x0, 0.12, 0.35), matAnden()[0]);   // TEX: borde de sillería
      borde.position.set((e.x0 + e.x1) / 2, e.y + 0.07, e.z + e.ancho / 2 - 0.2); borde.castShadow = false; G.add(borde);   // borde de piedra del andén (M8: sin franja amarilla moderna), del lado de la vía (+z; N1-C63: estaba del lado de la estación)
      fis.caja((e.x0 + e.x1) / 2, e.y + 0.07, e.z + e.ancho / 2 - 0.2, e.x1 - e.x0, 0.12, 0.35, 0, { tipo: 'anden' });   // ESC (16-11): el borde de sillería (13 cm sobre el piso) no tenía colisión: Nato quedaba hundido en él
      fis.caja((e.x0 + e.x1) / 2, (e.y - 3) / 2, e.z, e.x1 - e.x0, e.y + 3, e.ancho, 0, { tipo: 'anden' });
      // escaleras de bajada desde el andén hacia la estación (lado -z): 3 peldaños de concreto cada ~60 m, con colisión (el andén de 0,9 m era un salto sin escalón)
      const nE = Math.max(2, Math.round((e.x1 - e.x0) / 60) + 1);
      for (let k = 0; k < nE; k++) {
        const ex = e.x0 + 12 + (nE > 1 ? k * (e.x1 - e.x0 - 24) / (nE - 1) : 0);
        for (let i = 0; i < 3; i++) {
          const top = e.y - 0.3 * (i + 1) + 0.08, hh = top + 0.5, zc = e.z - e.ancho / 2 - 0.2 - i * 0.42;
          const p = malla(new THREE.BoxGeometry(2.6, hh, 0.42), matPeldano(def.invierno)); p.position.set(ex, top - hh / 2, zc); G.add(p);   // TEX: concreto gastado de la escalera central (antes caja lisa)
          fis.caja(ex, top - hh / 2, zc, 2.6, hh, 0.42, 0, { tipo: 'anden' });
        }
      }
      return;
    }
    case 'roca': {
      const yb = minTerreno(e.x - e.sx / 2, e.x + e.sx / 2, e.z - e.sz / 2, e.z + e.sz / 2) - 2, yt = maxTerreno(e.x - e.sx / 2, e.x + e.sx / 2, e.z - e.sz / 2, e.z + e.sz / 2) + e.sy;
      // roca orgánica (antes un dodecaedro café plano): esfera subdividida, deformada con ruido propio de cada roca y base aplanada
      const geo = new THREE.IcosahedronGeometry(1, 4), pa = geo.attributes.position, sem = e.x * 0.137 + e.z * 0.311, v = new THREE.Vector3();
      const grande = Math.max(e.sx, e.sz) > 25, col = [];   // las grandes (40 m al final del valle) se veían de lejos como una mancha redonda
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i);
        let r = 1 + 0.16 * Math.sin(v.x * 3.1 + sem) * Math.sin(v.z * 2.7 - sem) + 0.1 * Math.sin(v.y * 5.3 + v.x * 2.2 + sem * 2) + 0.05 * Math.sin(v.x * 11 + v.z * 9 + sem);
        if (grande) r += 0.14 * Math.sin(v.x * 1.7 - v.z * 2.3 + sem) + 0.12 * Math.abs(Math.sin(v.x * 6.1 + v.z * 4.3 + sem)) - 0.06;   // crestas y lomos
        v.multiplyScalar(r); if (v.y < -0.55) v.y = -0.55 + (v.y + 0.55) * 0.3;
        if (grande && v.y > 0.15) { const k = 1 - 0.45 * (v.y - 0.15); v.x *= k; v.z *= k; v.y *= 1 + 0.25 * Math.max(0, Math.sin(v.x * 2.4 + sem)); }   // cumbre en picos, no cúpula
        pa.setXYZ(i, v.x, v.y, v.z);
        const c = 0.72 + 0.2 * Math.sin(v.y * 11 + Math.sin(v.x * 3 + sem) * 1.6) + 0.1 * Math.sin(v.x * 7 - v.z * 5);   // vetas de estratos
        col.push(c, c * 0.96, c * 0.9);
      }
      geo.scale(e.sx / 2, (yt - yb) / 2, e.sz / 2); geo.computeVertexNormals();
      if (grande) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const mr = matMundo('suelo_roca', 7, 0xc8baa8); if (grande) mr.vertexColors = true;
      // la base aplanada queda en y = -0,55 de la esfera: centrada en (yt+yb)/2 quedaba ~22 % del alto sobre yb y en ladera
      // empinada la roca colgaba sobre la nieve del lado de abajo (la de 40 m tras la concentradora, REPORTE_N3 #13). Se apoya la base en yb.
      geo.computeBoundingBox(); const yc = yb - geo.boundingBox.min.y;
      const m = malla(geo, mr); m.position.set(e.x, yc, e.z); G.add(m);
      const p = geo.attributes.position.array, pts = new Float32Array(p.length);
      for (let i = 0; i < p.length; i += 3) { pts[i] = p[i] + e.x; pts[i + 1] = p[i + 1] + yc; pts[i + 2] = p[i + 2] + e.z; }
      fis.convexo(pts, { tipo: 'roca' });
      return;
    }
    case 'caja': case 'plataforma': {
      // N4-C18: sobreLadera = andén en la ladera, a ras de su lado alto (con la altura del centro el lado alto quedaba enterrado y el bajo, volado)
      const y = e.y ?? (e.sobreLadera ? maxTerreno(e.x - e.sx * 0.4, e.x + e.sx * 0.4, e.z - e.sz * 0.4, e.z + e.sz * 0.4) + 0.25 : altura(e.x, e.z) + 1.2); e._y = y;
      // N4-C18: e.giro (grados, rotation.y) gira el andén entero (modelo, física, escalera y barandas): el modelo de Idol deja libre
      // su lado +x local, que debe mirar al cable (en el N1 el cable va al oriente, giro 0; en el N4 va hacia el norte, giro ±90)
      const thG = (e.giro || 0) * Math.PI / 180, cG = Math.cos(thG), sG = Math.sin(thG);
      const W = (lx, lz) => [e.x + lx * cG + lz * sG, e.z - lx * sG + lz * cG];   // local del andén → mundo
      // andenes de madera sin pilar: macizos hasta el suelo, para que nadie quede atrapado debajo
      const sy = e.sy ?? (e.t === 'plataforma' && !e.pilar && e.y == null ? y - minTerreno(e.x - e.sx / 2, e.x + e.sx / 2, e.z - e.sz / 2, e.z + e.sz / 2) + 1 : 0.6);
      const m = caja(e.sx, sy, e.sz, e.color ?? COLOR.madera); m.position.set(e.x, y - sy / 2, e.z); m.rotation.y = thG; G.add(m);
      const spA = e.andarivel && def.splatsTodos && def.splatsTodos.anden_andarivel;
      // andén de madera de Idol con sus postes (el bloque queda solo para la física). La tabla visible del modelo mide el 76 % de su caja
      // y queda corrida 0,89 m al poniente (medido con la sonda, ancho 8,4): se agranda para que la tabla mida e.sx y se centra en la caja
      // (antes la tabla medía 6,4 m y Nato caminaba en el aire hasta 1,7 m más allá del borde, por el lado del capacho)
      // la tabla visible quedaba ~0,6 m sobre la física: Nato y Hércules se veían con las piernas enterradas en el andén
      // (14-11, pedido de Diego; medido en el juego bajando el modelo de a 0,15 m y mirando los pies de costado)
      let v = null; if (spA) { m.visible = false; v = piezaSplat(spA, 2.4, e.sx * 1.3125); const [vx, vz] = W(1.11 * e.sx / 8, 0.04 * e.sx / 8); v.position.set(vx, y - 1.45 - 0.6, vz); v.rotation.y += thG; G.add(v); }
      // con el modelo de Idol la física se ajusta a la tabla visible, medida desde arriba (sobre una caja de 8 m): 6,4 m en x, 7 m en z, corrida +0,3 m en x
      // ESC2 (16-11, Diego: «que Nato no se entierre»): con la malla TRELLIS del andén (modo normal; la calibración de arriba era la de la
      // nube) la tabla visible queda 0,475 m BAJO «y» (medida con rayos en los 4 andenes del N1 y el N4: mediana −0,475, juntas −0,58/−0,60)
      // y mide x −3,45…+3,8 (el +x da al cable), z −3,85…+3,85 (las barandas del modelo están en z ±4,0 y x −3,6): Nato flotaba
      // ~0,5 m sobre ella. Ahora la física (andén, escalera, barandas, balde y cable) va a yF = y − 0,5 y calza con esa tabla
      const trA = !!(spA && mallaDe(spA)), dT = trA ? 0.5 : 0, yF = y - dT; e._dT = dT;
      const TX0 = trA ? -3.45 * e.sx / 8 : 0.3 * e.sx / 8 - e.sx * 0.4, TX1 = trA ? 3.8 * e.sx / 8 : 0.3 * e.sx / 8 + e.sx * 0.4, TZ = trA ? 3.85 * e.sz / 8 : e.sz * 0.4375;
      if (spA) { const [bx, bz] = W((TX0 + TX1) / 2, 0); fis.caja(bx, yF - sy / 2, bz, TX1 - TX0, sy, 2 * TZ, thG, { tipo: 'plataforma' }); }
      // ESC2: contrapiso de tablas oscuras 2,5 cm bajo la tabla del modelo (a la altura de la física): por las rendijas y el hueco del borde del
      // cable (la malla TRELLIS tiene juntas de 10-20 cm) se veía el suelo 0,1-3 m más abajo y Nato parecía flotar sobre ellas
      if (trA) { const [bx, bz] = W((TX0 + TX1) / 2, 0), cp = malla(new THREE.BoxGeometry(TX1 - TX0 - 0.04, 0.04, 2 * TZ - 0.04), mat(0x3e2c1c, { rough: 0.95 })); cp.position.set(bx, yF - 0.02, bz); cp.rotation.y = thG; cp.castShadow = false; cp.receiveShadow = true; G.add(cp); }
      if (spA && e.sobreLadera) {   // zócalo de pirca bajo la tabla (el modelo trae postes de 2 m: en la ladera el lado bajo quedaba volando)
        const [bx, bz] = W(0.3 * e.sx / 8, 0), yb = minTerreno(e.x - e.sx / 2, e.x + e.sx / 2, e.z - e.sz / 2, e.z + e.sz / 2) - 0.6, hz = y - 0.75 - yb;   // tope 0,75 m bajo la tabla: queda bajo las vigas del modelo
        const zc = malla(new THREE.BoxGeometry(e.sx * 0.74, hz, e.sz * 0.8), matMundo('suelo_roca', 5, def.invierno ? 0xd9d6d2 : 0xa99f92)); zc.position.set(bx, yb + hz / 2, bz); zc.rotation.y = thG; zc.castShadow = true; zc.receiveShadow = true; G.add(zc);
      }
      else if (!spA) fis.caja(e.x, y - sy / 2, e.z, e.sx, sy, e.sz, thG, { tipo: 'plataforma' });   // ESC2: (antes también con el modelo sin sobreLadera: una 2.ª caja de 8 × 8 m a la altura «y», sobre la tabla)
      // peldaños de tablones frente a la entrada del andén (e.peldano = [x, z] del pie del camino): el camino llegaba 0,85 m bajo la tabla
      // y Nato (y el piloto) se quedaban empujando contra el costado (el paso automático sube solo 0,55 m)
      // N1-M3 (14-11): escalera de madera vieja gris con dos largueros y peldaños sueltos, apoyada sobre el camino (antes eran
      // cajas caoba macizas que bajaban 0,4 m bajo el suelo y se veían metidas en el camino). El pie va donde la línea de 28°
      // que baja de la tabla toca la malla visible; el primer peldaño queda a ras del camino y el último a ras de la tabla.
      // (todo en coordenadas locales del andén: x a lo largo del cable, z hacia la escalera o el fondo; W() las pasa al mundo)
      if (e.peldano) {
        const y = yF;   // ESC2: escalera y barandas a la altura de la tabla física
        const dpx = e.peldano[0] - e.x, dpz = e.peldano[1] - e.z, lpx = dpx * cG - dpz * sG, lpz = dpx * sG + dpz * cG;
        const sg = lpz < 0 ? -1 : 1, zb = sg * (spA ? TZ + (trA ? 0.6 : 0) : e.sz / 2);   // ESC2: TZ   // cara física del andén
        // ESC2: con TRELLIS, fuera de la baranda del modelo (z ±4,0) va su solera a ras de la tabla hasta z ±4,45, a todo lo largo: la escalera
        // arranca ahí y la solera lleva su piso físico (antes los peldaños de arriba quedaban bajo ella)
        if (trA) { const SP = 0.6, SE = 0.3, [ux0, uz0] = W((TX0 - SP + TX1 + SE) / 2, sg * (TZ + 0.3)); fis.caja(ux0, y - 0.15 + 0.02, uz0, TX1 - TX0 + SP + SE, 0.3, 0.6, thG, { tipo: 'plataforma' });   // (la solera llega 0,6 m más allá de la tabla por el poniente: esquina del modelo; y 0,3 m por el lado del cable; ESC2-fin: con 0,3 m quedaba 0,2 m de esquina visible sin piso en los andenes B del N1 y del N4)
          const tb = malla(new THREE.BoxGeometry(TX1 - TX0 + SP + SE, 0.04, 0.6), mat(0x3e2c1c, { rough: 0.95 })); tb.position.set(ux0, y - 0.02, uz0); tb.rotation.y = thG; tb.castShadow = false; tb.receiveShadow = true; G.add(tb); }   // (tablón bajo la baranda: en el vano se veía el suelo entre la tabla y la solera)
        const an = 2.8, cx = lpx, tanA = 0.53, mt = matMaderaGris();
        const aM = (lx, lz) => alturaMalla(...W(lx, lz));
        const suelo = d => Math.max(aM(cx - an / 2, zb + sg * d), aM(cx, zb + sg * d), aM(cx + an / 2, zb + sg * d));
        let L = 0.4; while (L < 4 && y - tanA * L > suelo(L) + 0.03) L += 0.05;
        const y0 = suelo(L), alza = y - y0, n = Math.max(2, Math.round(alza / 0.22)), paso = L / n;
        const conEsc = !trA || alza >= 0.15;   // ESC2: con la tabla TRELLIS más baja, en el andén B del N1 el camino ya llega a su altura: sin escalera
        if (conEsc) for (let k = 0; k <= n; k++) {   // peldaño k: alto y0 + alza·k/n, a una distancia L·(1 − k/n) de la cara (k = n queda pegado a la tabla)
          const f = Math.min(paso * 0.92, 0.4), D = (L - f / 2) * (1 - k / n) + f / 2, tope = y0 + alza * k / n, cz = zb + sg * D, [wx, wz] = W(cx, cz);
          const t = malla(new THREE.BoxGeometry(an, 0.06, f), mt); t.position.set(wx, tope - 0.03, wz); t.rotation.y = thG + (k * 7 % 5 - 2) * 0.006; G.add(t);
          const ab = Math.max(0.3, tope - suelo(D) + 0.3);   // colisión invisible hasta bajo el suelo: Nato y el piloto suben paso a paso
          if (k > 0) fis.caja(wx, tope - ab / 2, wz, an, ab, paso + 0.02, thG, { tipo: 'plataforma' });
        }
        const lg = Math.hypot(L, alza) + 0.25, ang = Math.atan2(alza, L);   // largueros: del camino (hundidos 4 cm) a la cara del andén
        if (conEsc) for (const s of [-1, 1]) {
          const lar = malla(new THREE.BoxGeometry(0.09, 0.24, lg), mt), [wx, wz] = W(cx + s * (an / 2 - 0.05), zb + sg * L / 2);
          lar.position.set(wx, (y0 + y) / 2 - 0.12, wz); lar.rotation.order = 'YXZ'; lar.rotation.y = thG; lar.rotation.x = sg < 0 ? ang : -ang; G.add(lar);
        }
        // N1-C67 (14-11, Diego): la baranda del andén de Idol cruzaba justo donde llega la escalera (y no tenía colisión: Nato la
        // atravesaba y también la del fondo, y caía por el otro lado). Se abre un vano de 3 m en la nube sobre la escalera (SplatEdit,
        // como la llama de las fogatas), con dos postes nuevos en los cortes, y las barandas visibles de los tres lados sin cable
        // (escalera, fondo y el lado opuesto al cable) llevan colisión en el borde de la tabla física
        if (spA) {
          const fx0 = TX0, fx1 = TX1, zf = -sg * TZ;   // tabla física (local); zf: borde del fondo
          const VA = an / 2 + 0.1, zr = sg * TZ + sg * (trA ? 0.1 : -0.12),   /* ESC2: con TRELLIS la baranda física va en la del modelo (z ±4,0), justo fuera de la tabla */ mp = mat(0x5a3d26, { rough: 0.9 });
          let sm = null; v.traverse(o => { if (!sm && o instanceof SplatMesh) sm = o; });
          if (sm) {   // con ?malla=1 (TRELLIS) no se edita: queda la baranda entera, pero la colisión igual deja el vano
            const sdf = new SplatEditSdf({ type: 'box', opacity: 0 }), [sx0, sz0] = W(cx, zr); sdf.position.set(sx0, y + 0.95, sz0); sdf.rotation.y = thG; sdf.scale.set(VA, 0.8, 0.5); G.add(sdf);
            sm.add(new SplatEdit({ rgbaBlendMode: 'multiply', softEdge: 0.04, sdfs: [sdf] }));
            for (const s of [-1, 1]) { const p = malla(new THREE.BoxGeometry(0.17, 1.3, 0.17), mp), [px0, pz0] = W(cx + s * (VA + 0.05), zr); p.position.set(px0, y + 0.6, pz0); p.rotation.y = thG; p.castShadow = true; G.add(p); }
          }
          if (!sm) {   // N1-ANDEN-B: con la malla TRELLIS (modo normal) se descartan los fragmentos de la baranda sobre la escalera (como los portillos de la torre N2-C28)
            const [gx, gz] = W(cx, zr), hx = Math.abs(cG) * (VA + 0.05) + Math.abs(sG) * 0.45, hz = Math.abs(sG) * (VA + 0.05) + Math.abs(cG) * 0.45;
            const GV = [new THREE.Vector3(gx - hx, y + (trA ? 0.07 : 0.02), gz - hz),   /* ESC2: desde 7 cm sobre la tabla (antes quedaba un trozo de 0,5 m de baranda cruzando la llegada de la escalera) */ new THREE.Vector3(gx + hx, y + 2.2, gz + hz)], clave = 'vanoAnden' + Math.round(e.x) + '_' + Math.round(e.z);
            let nn = 0; const iv = setInterval(() => {
              let hecho = false;
              v.traverse(o => { if (!o.isMesh || o.userData.vano) return; o.userData.vano = hecho = true; o.userData.vanoCaja = GV;   /* ESC2: el auditor de escalones no cuenta lo descartado */
                const m2 = o.material = o.material.clone();
                m2.onBeforeCompile = sh => { sh.uniforms.uV = { value: GV };
                  sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
                  sh.fragmentShader = 'varying vec3 vWp; uniform vec3 uV[2];\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (all(greaterThan(vWp, uV[0])) && all(lessThan(vWp, uV[1]))) discard;'); };
                m2.customProgramCacheKey = () => clave; m2.needsUpdate = true; });
              if (hecho || ++nn > 600) clearInterval(iv);
            }, 200);
          }
          const bar = (lx, lz, sx, sz) => { const [wx, wz] = W(lx, lz); fis.caja(wx, y + 0.6, wz, sx, 1.2, sz, thG, { tipo: 'baranda' }); };
          for (const [a0, a1] of [[fx0, cx - VA], [cx + VA, fx1]]) bar((a0 + a1) / 2, zr, a1 - a0, 0.2);   // lado de la escalera, con vano
          bar((fx0 + fx1) / 2, zf + sg * (trA ? -0.1 : 0.12), fx1 - fx0, 0.2);   // fondo (ESC2: TRELLIS, en la baranda del modelo)
          // N1-ABASTECIMIENTO-c (carril vida, cambio mínimo): en el andén del extremo b del andarivel el cable llega por el poniente: la baranda va al oriente
          // (N1-ANDEN-B: el andén B lleva giro 180 en niveles.js, así el lado abierto del modelo mira al cable y esta baranda cae al oriente sin invertir nada)
          bar(fx0 + (trA ? -0.1 : 0.12), 0, 0.2, 2 * TZ);   // poniente local (ESC2: TRELLIS, en la baranda del modelo, x −3,6) (el +x local es el del cable: lo pone el andarivel)
        }
      }
      if (e.pilar) { const yb = altura(e.x, e.z) - 1, p = caja(1.2, y - yb, 1.2, COLOR.madera); p.position.set(e.x, (y + yb) / 2 - sy, e.z); G.add(p); }
      return;
    }
    case 'cajas': {   // cajones de madera para subir (de a dos alturas)
      const y0 = altura(e.x, e.z);
      const mc = new THREE.MeshStandardMaterial({ map: texMadera(true), color: 0xd8b48a, roughness: 0.9 });   // cajón de tablas con marco (antes caja naranja lisa)
      const cj = [];
      for (let i = 0; i < (e.y2 ? 2 : 1); i++) { const m = malla(new THREE.BoxGeometry(1.6, 1.4, 1.6), mc); m.position.set(e.x, y0 + 0.7 + i * 1.4, e.z); G.add(m); cj.push(m); fis.caja(e.x, y0 + 0.7 + i * 1.4, e.z, 1.6, 1.4, 1.6, 0, { tipo: 'cajon' }); }
      // G9 (16-11): cajón grande de malla (G11 cajon_grande, tablas con zunchos y esquineros) ×[1, 0,875, 1] = 1,6 × 1,4 × 1,6; la caja de respaldo se oculta
      { const pu = precargarUtileria(); if (pu) pu.then(() => cj.forEach((m, i) => { const c = piezaGrupo('cajon_grande', [1, 0.875, 1]); if (!c) return;
        c.position.set(e.x, m.position.y - 0.7, e.z); c.rotation.y = ((Math.round(e.x * 7 + e.z * 3) + i) % 4) * Math.PI / 2; c.name = 'g9_cajon'; G.add(c); m.visible = false; })); }
      return;
    }
    case 'escalinata': {   // N4-C19: escalinata de roca suelta: a = [x, z, y], b = [x, z, y] (y null = altura del terreno)
      const P = v => ({ x: v[0], z: v[1], y: v[2] ?? altura(v[0], v[1]) });
      escalinataRoca(G, fis, P(e.a), P(e.b), e.ancho ?? 3);
      return;
    }
    case 'repisa': {   // repisas de roca hacia la cumbre
      const y = altura(e.x, e.z) + 2.5;
      // repisa de roca irregular con textura (antes un cilindro de 7 lados café plano); la cara de arriba queda plana para pisar
      // N4-C13 (14-11): el pie baja hasta lo más bajo del terreno alrededor (en la ladera el lado de abajo quedaba 1-2 m en el aire)
      let yMin = y - 5; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; yMin = Math.min(yMin, altura(e.x + Math.cos(a) * 6.2, e.z + Math.sin(a) * 6.2) - 2.5); }   // 2,5 m bajo tierra: de lejos la malla del terreno (menos detalle) queda más baja que altura()
      const H = y - yMin, nV = Math.max(4, Math.round(H / 1.5));
      const geo = new THREE.CylinderGeometry(4.5, 5.8 + (H - 5) * 0.12, H, 18, nV), pa = geo.attributes.position, sem = e.x * 0.21 + e.z * 0.13;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y0 = pa.getY(i), z = pa.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
        if (r < 0.01) continue;
        const k = 1 + 0.09 * Math.sin(a * 3 + sem) + 0.06 * Math.sin(a * 7 - sem * 2 + y0) + 0.03 * Math.sin(a * 13 + y0 * 2);
        pa.setXYZ(i, x * k, y0 > H / 2 - 0.1 ? y0 : y0 + 0.25 * Math.sin(a * 5 + sem), z * k);
      }
      geo.computeVertexNormals();
      const m = malla(geo, matMundo('suelo_roca', 6, 0xc8baa8)); m.position.set(e.x, y - H / 2, e.z); G.add(m);
      fis.caja(e.x, y - 2.5, e.z, 7.5, 5, 7.5, 0, { tipo: 'roca' });
      R.repisas.push({ x: e.x, y, z: e.z });
      if (e.desde) {   // N4-C19: escalinata desde la repisa anterior (o desde el suelo en e.desde) hasta el borde de esta
        const prev = R.repisas.find(r => Math.hypot(r.x - e.desde[0], r.z - e.desde[1]) < 1), dx = e.x - e.desde[0], dz = e.z - e.desde[1], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
        const S = prev ? { x: prev.x + ux * 3.5, y: prev.y, z: prev.z + uz * 3.5 } : { x: e.desde[0], y: altura(e.desde[0], e.desde[1]), z: e.desde[1] };
        escalinataRoca(G, fis, S, { x: e.x - ux * 3.5, y, z: e.z - uz * 3.5 }, 3.6);
      }
      return;
    }
    case 'torre': {   // torre de balcones: se sube saltando de balcón en balcón
      const yb = maxTerreno(e.x - 5, e.x + 5, e.z - 5, e.z + 5), h = e.pisos * PISO;
      const m = cajaFachada(10, h, 10, COLOR.madera); m.position.set(e.x, yb + h / 2, e.z); m.castShadow = true; G.add(m);
      const spTB = def.splatsTodos && def.splatsTodos.torre_balcones;   // torre de departamentos de madera de Idol (balcones en +X local)
      if (spTB) {
        // modelo de 20 m (no 23,4): así los balcones quedan a 2,9-3,4 m y, con las jardineras colgadas de la baranda, se suben de a saltos de ≤ 2,6 m
        m.visible = false;
        const A = 20, s = A / 23.4, y0 = yb - 1, X = u => e.x + u * s, Y = u => y0 + u * s, Z = u => e.z + u * s;
        if (kitActivo()) { torreMalla(e, y0, G, fis, R, def, null); return; }   // N2-C37: kit Sewell (sin malla TRELLIS)
        const v = piezaSplat(spTB, A); v.position.set(e.x, y0, e.z); v.rotation.y = Math.PI * 1.5; G.add(v); R.torreSplat = v;   // 270°: balcones al poniente, hacia la escalera
        if (mallaDe(spTB)) { torreMalla(e, y0, G, fis, R, def, v); return; }   // N2-C28: con la malla TRELLIS (yaw 90) las medidas son otras
        // medidas del modelo (alto 23,4, origen al pie y al centro; herramientas/explorador2_sonda.js): cuerpo x -3,5…4,7 z -3,6…4,9;
        // balcones x -4,85…-3,5 z -5,1…4,9 con el piso a 2,1 / 5,5 / 9,3 / 13,0 / 17,0; alero a 20,7 (x -3,9…5,2); punta del techo a 24,3
        const bx0 = X(-3.5), bx1 = X(4.7), bz0 = Z(-3.6), bz1 = Z(4.9), alero = Y(20.7);
        // zócalo de sillería hasta el suelo (la torre está al borde de la terraza). Sube hasta 1,6 m sobre la base y es 0,3 m más ancho
        // que el cuerpo por lado: tapa el zócalo de gaussianas del modelo, que se veía como un bloque gris difuso bajo el primer balcón
        const tMinT = minTerreno(bx0, bx1, bz0, bz1), zTop = y0 + 1.7, zh = zTop - (tMinT - 1);   // 0,6 m por lado: con 0,3 asomaban las esquinas grises
        const zx0 = X(-4.85), zx1 = bx1 + 0.6;   // al poniente llega hasta la línea de los balcones: bajo el primero también asomaba el gris
        const zo = malla(new THREE.BoxGeometry(zx1 - zx0, zh, bz1 - bz0 + 1.2), matMundo(texSilleria(), 3, 0xcfc4b4));
        zo.position.set((zx0 + zx1) / 2, zTop - zh / 2, (bz0 + bz1) / 2); G.add(zo);
        fis.caja((bx0 + bx1) / 2, (alero + tMinT - 1) / 2, (bz0 + bz1) / 2, bx1 - bx0, alero - tMinT + 1, bz1 - bz0, 0, { tipo: 'muro' });
        fis.convexo(new Float32Array([X(-3.9), alero, Z(-3.9), X(5.2), alero, Z(-3.9), X(-3.9), alero, Z(5.2), X(5.2), alero, Z(5.2), X(0.63), Y(24.3), Z(0.65)]), { tipo: 'techo' });   // techo a cuatro aguas
        [2.1, 5.5, 9.3, 13.0, 17.0].forEach((f, i) => {
          const yt = Y(f), xa = X(-4.85), xb = X(-3.3);
          fis.caja((xa + xb) / 2, yt - 0.15, Z(-0.1), xb - xa, 0.3, 10 * s, 0, { tipo: 'balcon' });   // piso del balcón del modelo
          // jardinera colgada por fuera de la baranda (lados alternados): escalón intermedio entre un balcón y el de arriba
          const zj = Z(i % 2 ? -3 : 3), yj = yt + 0.85, xj = xa - 0.42;
          const jb = caja(0.8, 0.5, 1.6, 0x7a5232); jb.position.set(xj, yj - 0.25, zj); G.add(jb);
          const ti = caja(0.66, 0.12, 1.46, 0x4f7a34); ti.position.set(xj, yj + 0.02, zj); G.add(ti);
          [-0.5, 0, 0.5].forEach((dz, k) => { const fl = caja(0.22, 0.2, 0.22, [0xd8443a, 0xf0c419, 0xe07ab0][(i + k) % 3]); fl.position.set(xj, yj + 0.16, zj + dz); G.add(fl); });
          fis.caja(xj, yj - 0.25, zj, 0.8, 0.5, 1.6, 0, { tipo: 'balcon' });
        });
        R.torres.push({ x: X(0.63), z: Z(0.65), y: Y(24.3) + 0.3 });
        return;
      }
      fis.caja(e.x, yb + h / 2, e.z, 10, h, 10, 0, { tipo: 'muro' });
      fis.caja(e.x, yb + h + 0.15, e.z, 10, 0.3, 10, 0, { tipo: 'azotea' });
      for (let i = 1; i <= e.pisos; i++) {
        const lado = i % 2 ? 1 : -1, y = yb + i * PISO - 0.6;
        const b = caja(3, 0.25, 4, COLOR.blanco); b.position.set(e.x + lado * 6.3, y, e.z + 2); G.add(b);
        fis.caja(e.x + lado * 6.3, y, e.z + 2, 3, 0.25, 4, 0, { tipo: 'balcon' });
      }
      R.torres.push({ x: e.x, z: e.z, y: yb + h + 0.3 });
      return;
    }
    case 'tablon': {
      const y = (e.y ?? altura(e.x, e.z) + 6);
      R.tablones.push({ x: e.x, y, z: e.z, largo: e.largo || 6, rot: (e.rot || 0) * Math.PI / 180, conTecho: e.conTecho });
      return;
    }
    case 'andarivel': {
      // giro extra de la torre nueva de Idol (medido desde arriba): deja el plano de la rueda paralelo al cable
      const GIRO_TORRE = +(new URLSearchParams(location.search).get('giroTorre') ?? 164) * Math.PI / 180;
      // a y b son los centros de los andenes (8 × 8 m): el capacho para justo fuera del borde, a la altura del andén
      let a = { x: e.a[0], y: e.a[1] ?? altura(e.a[0], e.a[2]) + 1.2, z: e.a[2] }, b = { x: e.b[0], y: e.b[1] ?? altura(e.b[0], e.b[2]) + 1.2, z: e.b[2] };
      const dd = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / dd, uz = (b.z - a.z) / dd, corre = 4.95, spAn = !!(def.splatsTodos && def.splatsTodos.anden_andarivel), trAn = spAn && !!mallaDe(def.splatsTodos.anden_andarivel);   // ESC2   // el balde se mete un poco bajo el borde del andén: sin ranura
      // distancia del centro del andén al borde de su tabla visible (mira al cable); sin el modelo, el borde de la caja de 8 m (4 m)
      // N4-C18: con el andén girado (e.giro, para que su lado libre mire al cable) la dirección del cable se pasa a sus ejes locales
      const andenEn = (px, pz) => (def.elementos || []).find(q => q.t === 'plataforma' && q.andarivel && Math.hypot(q.x - px, q.z - pz) < 1);
      const giroDe = (px, pz) => { const p = andenEn(px, pz); return ((p && p.giro) || 0) * Math.PI / 180; };
      const thA = giroDe(e.a[0], e.a[2]), thB = giroDe(e.b[0], e.b[2]);
      { const pa = andenEn(e.a[0], e.a[2]), pb = andenEn(e.b[0], e.b[2]); if (e.a[1] == null && pa && pa._y != null) a.y = pa._y; if (e.b[1] == null && pb && pb._y != null) b.y = pb._y;
        a.y -= (pa && pa._dT) || 0; b.y -= (pb && pb._dT) || 0; }   // ESC2: andén TRELLIS: el balde llega a la tabla física (yF)   // N4-C18: a la altura del andén ya armado (sobreLadera)
      const bordeA = (sg, th = sg > 0 ? thA : thB) => { const wx = sg * ux, wz = sg * uz, lx = wx * Math.cos(th) - wz * Math.sin(th), lz = wx * Math.sin(th) + wz * Math.cos(th); return trAn ? lx * 0.175 + 3.625 * Math.abs(lx) + 3.85 * Math.abs(lz) : spAn ? lx * 0.3 + 3.2 * Math.abs(lx) + 3.5 * Math.abs(lz) : 4; };   // ESC2: tabla TRELLIS (x −3,45…3,8, z ±3,85)
      const correA = bordeA(1) + corre - 4, correB = bordeA(-1) + corre - 4;
      a = { x: a.x + ux * correA, y: a.y, z: a.z + uz * correA }; b = { x: b.x - ux * correB, y: b.y, z: b.z - uz * correB };
      const alto = 6;
      // N4-C18: torres intermedias (e.torres = [[x, z, sobre]]: piso del balde a «sobre» m del terreno) para que el balde no roce la ladera;
      // deben quedar en la línea recta a→b vista desde arriba (el balde no gira en el viaje)
      const puntos = [a, ...(e.torres || []).map(([x, z, sobre]) => ({ x, y: altura(x, z) + sobre, z })), b];
      const spT = def.splatsTodos && def.splatsTodos.torre_andarivel;
      for (const p of puntos) {   // torres del suelo al cable (con modelo de Idol: torre de madera con polea)
        const yb = altura(p.x, p.z) - 1, top = p.y + alto;
        if (spT) {
          // torre nueva: la rueda está al 78,5 % del alto del modelo (arriba hay gaussianas sueltas que agrandan la caja);
          // se escala para que la parte alta de la rueda quede a la altura del cable, 3,4 m de ancho y a 2,6 m del cable
          // (el capacho pasa al lado), y un tramo corto de cable va de la rueda a la línea
          const off = 2.6, yr = top + 0.15, t = piezaSplat(spT, (yr - (yb + 1)) / 0.785, 3.4), ox = p.x + uz * off, oz = p.z - ux * off;   // al costado del cable (en el N1: 2,6 m al norte)
          t.position.set(ox, yb + 1, oz); t.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + GIRO_TORRE; G.add(t);
          G.add(tubo(new THREE.Vector3(ox, yr, oz), new THREE.Vector3(p.x, top, p.z), 0.05, 0x222222));
          // N1-ANDEN-B (Diego 15-11: «Nato queda en el aire»): la torre de los andenes del andarivel 'hamilton' se metía 0,7 m sobre la tabla del andén
          // y Nato caminaba dentro del caballete, con los pies a media altura. Ahora el pie de la torre (2,8 × 2,8 m, el hueco entre sus patas) es sólido
          if (e.id === 'hamilton' && (p === puntos[0] || p === puntos[puntos.length - 1])) fis.caja(ox, (yb + yr) / 2, oz, 2.8, yr - yb, 2.8, 0, { tipo: 'muro' });
          (fis.camObst ||= []).push({ x: ox, z: oz, r: 2.0, y0: yb, y1: yr + 1.2, obj: t });   // N1-O8 (carril codigo): la cámara no se mete entre las vigas (sin física: el capacho pasa al lado)
          continue;
        }
        const t = caja(0.6, top - yb, 0.6, 0x3a3a40, { metal: 0.6 }); t.position.set(p.x, (top + yb) / 2, p.z - 3); G.add(t);
        const v = caja(0.4, 0.4, 6, 0x3a3a40, { metal: 0.6 }); v.position.set(p.x, top, p.z); G.add(v);
        // G9 (16-11): sin la torre de Idol (?splats=0) va la torre de celosía remachada de malla (G11 torre_andarivel, 2,4 × 9 m) con el
        // travesaño de las poleas a lo largo del cable, alto ajustado al cable (0,85-1,05×, sin agrandar más de 1,3×); respaldo: las dos cajas
        { const pu = precargarUtileria(); if (pu) pu.then(() => { const h = top + 0.3 - (yb + 1), m = piezaGrupo('torre_andarivel', [1, h / 9, 1]); if (!m) return;
          m.position.set(p.x, yb + 1, p.z); m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2; m.name = 'g9_torre_andarivel'; m.children[0].castShadow = true; G.add(m); t.visible = v.visible = false; }); }   // sin física, como las cajas (el capacho pasa por el cable)
      }
      for (let k = 0; k + 1 < puntos.length; k++) { const p = puntos[k], q = puntos[k + 1]; G.add(tubo(new THREE.Vector3(p.x, p.y + alto, p.z), new THREE.Vector3(q.x, q.y + alto, q.z), 0.05, 0x222222)); }
      // baranda de madera (con colisión) en el borde de cada andén que da al cable, con un vano de 2,6 m frente al capacho:
      // en el N1 ese borde es el del barranco y un cóndor podía botar a Nato al vacío
      for (const [cx, cz, y, sg] of [[e.a[0], e.a[2], a.y, 1], [e.b[0], e.b[2], b.y, -1]]) {
        const dB = spAn ? bordeA(sg) - 0.1 : 3.85;   // (bordeA ya mira el giro de cada andén)   // con el andén de Idol: en la línea de su propia baranda (a 3,85 Nato quedaba por fuera de ella)
        const ex = cx + ux * sg * dB, ez = cz + uz * sg * dB, vx = -uz, vz = ux, giro = Math.atan2(vx, vz);
        // retornos en las esquinas (1,6 m hacia adentro por los costados): sin ellos Nato se deslizaba por la punta de la baranda y caía al barranco (andén B del N1)
        const SL = spAn ? 3.5 : 4.05, VANO = spAn ? 1.75 : 1.3;   // vano de 3,5 m con el modelo de Idol
        for (const s of [-SL, SL]) fis.caja(ex + vx * s - ux * sg * 0.8, y + 0.6, ez + vz * s - uz * sg * 0.8, 0.2, 1.2, 1.6, giro + Math.PI / 2, { tipo: 'baranda' });
        for (const [s0, s1] of [[-SL - 0.05, -VANO], [VANO, SL + 0.05]]) {
          const sm = (s0 + s1) / 2, L = s1 - s0, mx = ex + vx * sm, mz = ez + vz * sm;
          // solo la colisión: el andén de Idol ya trae su baranda de madera (las tablas de grey-box quedaban dobles y sueltas sobre el pasto)
          if (!(def.splatsTodos && def.splatsTodos.anden_andarivel)) {
            const tabla = caja(0.12, 0.14, L, 0x7a5432); tabla.position.set(mx, y + 1.05, mz); tabla.rotation.y = giro; G.add(tabla);
            const media = caja(0.08, 0.1, L, 0x7a5432); media.position.set(mx, y + 0.55, mz); media.rotation.y = giro; G.add(media);
            for (const s of [s0, s1]) { const p = caja(0.14, 1.15, 0.14, 0x5e3f24); p.position.set(ex + vx * s, y + 0.57, ez + vz * s); G.add(p); }
          }
          fis.caja(mx, y + 0.6, mz, 0.2, 1.2, L, giro, { tipo: 'baranda' });
        }
      }
      R.andariveles.push({ a, b, puntos, capachos: e.capachos || 3, periodo: (e.periodo || 8) * 1.4, alto, id: e.id });
      return;
    }
    case 'barranco': R.muertes.push({ tipo: 'barranco' }); return;
    case 'bocamina': case 'tunel': {   // marco de troncos con el túnel negro
      if (e.t === 'bocamina' || e.t === 'tunel') {   // la Mina Fortuna y su salida: macizo de roca con volumen, portal de entibación y túnel (bocaminaReal)
        const yB = bocaminaReal(e, G, fis), rotB = (e.rot || 0) * Math.PI / 180;
        R.puertas.push({ x: e.x + Math.sin(rotB) * 1.5, y: yB, z: e.z + Math.cos(rotB) * 1.5, rumbo: rotB, sala: e.sala, lado: e.lado || 'entrada', nombre: e.nombre, boca: { hw: 1.8, fondo: 6 } });   // N1-M2: disparador = todo el vano y el túnel
        return;
      }
      const rot = (e.rot || 0) * Math.PI / 180, g = new THREE.Group();
      const px = Math.cos(rot) * 1.8, pz = -Math.sin(rot) * 1.8, y = Math.max(altura(e.x, e.z), altura(e.x + px, e.z + pz), altura(e.x - px, e.z - pz));   // ningún poste enterrado
      const fondo = caja(3.2, 3.6, 1.6, 0x060606); fondo.position.set(0, 1.8, 0.1); g.add(fondo);   // saca la cara negra 0,9 m al frente: la ladera ya no la corta en dientes de sierra
      for (const dx of [-1.8, 1.8]) { const p = caja(0.45, 4, 0.45, 0x6b4a2a); p.position.set(dx, 2, 1.05); g.add(p); }
      const v = caja(4.4, 0.5, 0.5, 0x6b4a2a); v.position.set(0, 4.1, 1.05); g.add(v);
      if (e.nombre) { const l = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: letreroTex(e.nombre) })); l.position.set(0, 4.9, 1.2); g.add(l); }
      if (e.t === 'bocamina') { const f = new THREE.PointLight(0xffb060, 30, 9); f.position.set(2.4, 3.2, 1.8); g.add(f); }
      g.position.set(e.x, y, e.z); g.rotation.y = rot; G.add(g);
      const n = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
      R.puertas.push({ x: e.x + n.x * 1.5, y, z: e.z + n.z * 1.5, rumbo: rot, sala: e.sala, lado: e.lado || 'entrada', nombre: e.nombre });
      return;
    }
    case 'puerta': {
      const y = e._y ?? (R.ultimaPlaza && Math.abs(R.ultimaPlaza.x - e.x) < R.ultimaPlaza.sx / 2 && Math.abs(R.ultimaPlaza.z - e.z) < R.ultimaPlaza.sz / 2 ? R.ultimaPlaza.y : altura(e.x, e.z));
      const rot = (e.rot || 0) * Math.PI / 180;
      // puerta con marco claro, tablas de madera y manilla (antes un rectángulo café oscuro que se veía negro)
      const p = new THREE.Group(); p.position.set(e.x, y, e.z); p.rotation.y = rot; G.add(p);
      const marco = caja(2.9, 3.7, 0.28, 0xe8e0d0); marco.position.y = 1.85; p.add(marco);
      const hoja = caja(2.3, 3.3, 0.36, 0x8a5530); hoja.position.y = 1.65; p.add(hoja);
      for (const dx of [-0.58, 0, 0.58]) { const t = caja(0.05, 3.2, 0.38, 0x5e3a1e); t.position.set(dx, 1.65, 0); p.add(t); }
      const man = caja(0.12, 0.12, 0.5, 0xd8b04a); man.position.set(0.85, 1.6, 0); p.add(man);
      if (e.caseta) {
        // boca de pasadizo: bloque de roca detrás de la puerta (antes un marco suelto en medio de la losa), con colisión.
        // Local: -z es detrás de la puerta (la puerta mira hacia +z)
        const roca = malla(new THREE.BoxGeometry(5.6, 5.2, 4), rocaSinMosaico(3, 0xb8ab9c)); roca.position.set(0, 2.2, -2.15); p.add(roca);
        // N3-C11 (carril codigo): techo de calamina a dos aguas (antes un bloque de roca encima): se lee como caseta y no como caja suelta
        for (const sx of [-1, 1]) { const t = caja(3.5, 0.12, 4.7, 0x8c3b2b, { metal: 0.3 }); t.position.set(sx * 1.55, 5.55, -2.15); t.rotation.z = -sx * 0.42; p.add(t); }
        const tri = new THREE.Shape([new THREE.Vector2(-2.8, 0), new THREE.Vector2(2.8, 0), new THREE.Vector2(0, 1.25)]);
        for (const z of [-0.14, -4.16]) { const f = malla(new THREE.ShapeGeometry(tri), mat(0x6b4a2a, { doble: true })); f.position.set(0, 4.8, z); p.add(f); }   // frontones de tabla
        const cx = e.x - Math.sin(rot) * 2.15, cz = e.z - Math.cos(rot) * 2.15;
        fis.caja(cx, y + 2.2, cz, 5.6, 5.2, 4, rot, { tipo: 'muro' });
      }
      R.puertas.push({ x: e.x + Math.sin(rot) * 1.5, y, z: e.z + Math.cos(rot) * 1.5, rumbo: rot, sala: e.sala, lado: e.lado || 'entrada', salidaDist: e.salidaDist });
      return;
    }
    case 'carpa': {
      // carpa de lona a dos aguas: geometría propia con UV a escala (la lona se repite cada 2 m; antes las manchas se
      // repetían cada metro), faldón que se mete 25 cm en la tierra y la carpa inclinada como el suelo (antes flotaba
      // en la pendiente y se veía la base café por debajo), vientos con estacas
      const rot = e.rot ? e.rot * Math.PI / 180 : (e.x * 7 + e.z * 3) % 6.28, cr = Math.cos(rot), sr = Math.sin(rot);
      const A = 1.7, H = 2.3, Lc = 3.6, F = 0.25, ax = A * (H + F) / H;   // media base, alto, largo, faldón
      const enSuelo = (lx, lz) => altura(e.x + lx * cr + lz * sr, e.z - lx * sr + lz * cr);
      const y = enSuelo(0, 0), gx = (enSuelo(A, 0) - enSuelo(-A, 0)) / (2 * A), gz = (enSuelo(0, Lc / 2) - enSuelo(0, -Lc / 2)) / Lc;
      const lim = v => Math.max(-0.3, Math.min(0.3, v));
      const m = new THREE.Group(); m.rotation.set(-lim(Math.atan(gz)), rot, lim(Math.atan(gx)), 'YXZ');
      const sl = Math.hypot(ax, H + F), pos = [], uv = [], idx = [];
      const quad = (a, b, c, d, ua, ub, uc, ud) => { const i = pos.length / 3; pos.push(...a, ...b, ...c, ...d); uv.push(...ua, ...ub, ...uc, ...ud); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
      // UV: una vuelta de textura por faldón (v = 1 abajo, donde está el barro), a escala real a lo largo
      for (const sx of [-1, 1]) quad([sx * ax, -F, -Lc / 2], [sx * ax, -F, Lc / 2], [0, H, Lc / 2], [0, H, -Lc / 2], [0, 1], [Lc / sl, 1], [Lc / sl, 0], [0, 0]);
      for (const sz of [-1, 1]) { const i = pos.length / 3; pos.push(-ax, -F, sz * Lc / 2, ax, -F, sz * Lc / 2, 0, H, sz * Lc / 2); uv.push(0.5 - ax / sl, 1, 0.5 + ax / sl, 1, 0.5, 1 - (H + F) / sl); idx.push(i, i + 1, i + 2); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      m.add(malla(geo, new THREE.MeshStandardMaterial({ map: texLona(), roughness: 0.95, side: THREE.DoubleSide })));
      const boca = malla(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.75, -0.1), new THREE.Vector2(0.75, -0.1), new THREE.Vector2(0, 1.55)])), mat(0x2e241c)); boca.position.z = Lc / 2 + 0.02; m.add(boca);
      for (const sz of [-1, 1]) {
        const palo = malla(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 6), mat(0x6a4a2a)); palo.position.set(0, 1.3, sz * (Lc / 2 + 0.12)); m.add(palo);
        const tope = new THREE.Vector3(0, 2.6, sz * (Lc / 2 + 0.12)), estaca = new THREE.Vector3(0, -0.05, sz * (Lc / 2 + 1.5));
        m.add(tubo(tope, estaca, 0.012, 0xcfc4a8));   // viento
        const es = caja(0.06, 0.35, 0.06, 0x5a3c22); es.position.copy(estaca); m.add(es);
      }
      // G12 (16-11, Diego: «queda en el aire en la ladera»): la inclinación tiene tope (±0,3 rad); en la pendiente fuerte las esquinas de abajo
      // quedaban colgando. Se baja la carpa hasta que el borde de la lona (8 puntos del contorno a ras de suelo) toque el suelo en TODOS
      const hunde = (() => { let d = 0; const v = new THREE.Vector3();
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) { v.set(lx * A, 0, lz * Lc / 2).applyEuler(m.rotation); d = Math.min(d, enSuelo(lx * A, lz * Lc / 2) - (y - 0.04 + v.y)); }
        return Math.max(-0.9, d); })();
      m.position.set(e.x, y - 0.04 + hunde, e.z); G.add(m);
      { const pu = precargarUtileria(); if (pu) pu.then(() => {   // N0-UTIL3 (E1): carpa de lona TRELLIS (2,6×2,1×3 → 3,4×2,3×3,6), misma inclinación; LOD a 45 m
        const a = piezaGrupo('carpa', [1.3, 1.1, 1.2]), b = piezaGrupo('carpa', [1.3, 1.1, 1.2], 1); if (!a) return;
        const L = new THREE.LOD(); L.addLevel(a, 0); L.addLevel(b, 45); L.position.copy(m.position); L.position.y -= 0.06; L.rotation.copy(m.rotation); G.add(L); m.visible = false; }); }
      fis.caja(e.x, y + 1, e.z, 3, 2, 3, Math.PI / 4, { tipo: 'carpa' });
      return;
    }
    case 'escenario': {   // 1967: tarima con banderas chilenas
      // sólo se apoya en la última plaza si la tarima cae dentro de ella (en el N4 la última era otra, a y≈211, y la tarima flotaba)
      const P = R.ultimaPlaza, enPlaza = P && Math.abs(P.x - e.x) < P.sx / 2 && Math.abs(P.z - e.z) < P.sz / 2;
      const y = enPlaza ? Math.max(P.y, altura(e.x, e.z)) : altura(e.x, e.z);
      // tarima de tablas: armazón oscuro con faldón de tablas verticales y 14 tablones a lo largo, cada uno de un tono, con junta
      const t = caja(13.8, 0.86, 5.8, 0x5e3f26); t.position.set(e.x, y + 0.43, e.z); G.add(t);
      // ESC2 (16-11): la física era una caja de 14 × 6 m: los 14 tablones (0,4 m, desde z −2,985 hasta +2,79) no llegan al borde de +z y
      // en esa franja de 0,21 m Nato flotaba 14 cm sobre el armazón (y + 0,86). Ahora calza con los tablones (tope y + 1,0)
      fis.caja(e.x, y + 0.5, e.z - 0.0975, 13.9, 1, 5.775, 0, { tipo: 'plataforma' });
      for (let i = 0; i < 14; i++) {
        const tono = new THREE.Color(COLOR.madera).offsetHSL(0, 0, ((i * 37) % 9 - 4) * 0.012), tb = caja(14, 0.12, 0.4, tono.getHex(), { rough: 0.85 });
        tb.position.set(e.x + ((i * 53) % 7 - 3) * 0.02, y + 0.94, e.z - 3 + 0.215 + i * 0.4134); G.add(tb);
      }
      for (const lado of [-1, 1]) for (let i = 0; i < 46; i++) {   // faldón: tablas verticales en el frente y atrás
        const tb = caja(0.28, 0.86, 0.05, new THREE.Color(0x7a5232).offsetHSL(0, 0, ((i * 29) % 7 - 3) * 0.015).getHex()); tb.position.set(e.x - 6.9 + 0.15 + i * 0.3, y + 0.43, e.z + lado * 2.93); G.add(tb);
        if (i < 19) { const tc = caja(0.05, 0.86, 0.28, new THREE.Color(0x7a5232).offsetHSL(0, 0, ((i * 31) % 7 - 3) * 0.015).getHex()); tc.position.set(e.x + lado * 6.93, y + 0.43, e.z - 2.85 + 0.15 + i * 0.3); G.add(tc); }   // y en los costados
      }
      for (const dx of [-6, -2, 2, 6]) {
        G.add(tubo(new THREE.Vector3(e.x + dx, y + 1, e.z - 2.5), new THREE.Vector3(e.x + dx, y + 6, e.z - 2.5), 0.05, 0xdddddd));
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), new THREE.MeshStandardMaterial({ map: banderaChile(), side: THREE.DoubleSide }));
        b.position.set(e.x + dx + 0.9, y + 5.4, e.z - 2.5); G.add(b);
      }
      return;
    }
    case 'rieles': {
      const y = e.y ?? altura(e.x0 ?? e.x, e.z ?? e.z0);
      const x0 = e.x0 ?? e.x, x1 = e.x1 ?? e.x, z0 = e.z0 ?? e.z, z1 = e.z1 ?? e.z;
      if (x0 === x1) { const dir = Math.sign(z1 - z0) || 1; for (let z = z0; (z1 - z) * dir > 0; z += dir * 0.9) { const t = piezaTex(new THREE.BoxGeometry(1.7, 0.08, 0.18), texMat('durmiente', 0x9c8470)); t.position.set(x0, y + 0.04, z); t.castShadow = false; G.add(t); } }   // durmientes (TEX: madera gastada)
      for (const d of [-0.5, 0.5]) G.add(rielTex(tubo(new THREE.Vector3(x0 + (z0 === z1 ? 0 : d), y + 0.1, z0 + (z0 === z1 ? d : 0)), new THREE.Vector3(x1 + (z0 === z1 ? 0 : d), y + 0.1, z1 + (z0 === z1 ? d : 0)), 0.06, 0x555555)));   // TEX: riel
      return;
    }
    case 'zona': R.zonas.push(e); return;
    default:   // personajes, objetos y efectos: los crea juego/entidades.js
      R.specs.push({ ...e, y: e.y ?? null, sobre: e.sobre });
  }
}

// Roca en coordenadas de mundo sin el mosaico repetido (losa del nido, 40x34 m): a la textura de matMundo se le mezcla
// una segunda muestra girada 37° y 3,7 veces más grande, y manchas suaves de claro/oscuro (como en el terreno)
function rocaSinMosaico(escala, color = 0xffffff) {
  const m = matMundo('suelo_roca', escala, color), antes = m.onBeforeCompile;
  m.onBeforeCompile = sh => {
    antes(sh);
    sh.fragmentShader = sh.fragmentShader.replace('diffuseColor.rgb *= tx * 1.15;', `
        vec2 qG = mat2(0.8, -0.6, 0.6, 0.8) * vMundo2.xz;
        vec3 tx2 = texture2D(tMundo, qG / (escalaMundo * 3.7) + 0.37).rgb * an.y + tx * (1.0 - an.y);
        float mancha = texture2D(tMundo, vMundo2.xz / (escalaMundo * 9.0) + 0.61).r + texture2D(tMundo, qG / (escalaMundo * 5.3)).g - 1.0;
        tx = mix(tx, tx2, 0.5) * (1.0 + 0.35 * mancha);
        diffuseColor.rgb *= tx * 1.15;`);
  };
  m.customProgramCacheKey = () => 'rocaSinMosaico';
  return m;
}

// Muros de contención de roca (3,5 m) a los costados y atrás de una plaza con terraza: donde el corte del cerro
// dejaba una pendiente lisa de nieve. Atrás va más lejos que el borde, para no tocar el nido que está en el borde.
function murosTerraza(e, y, fis, G) {
  const alto = 3.5, grueso = 1.6, mt = rocaSinMosaico(4, 0xc8bcae), fondo = 3;
  const lados = [[e.x - e.sx / 2 - grueso / 2, e.z - 3.5, grueso, e.sz + 7], [e.x + e.sx / 2 + grueso / 2, e.z - 3.5, grueso, e.sz + 7],
    [e.x, e.z - e.sz / 2 - 7 - grueso / 2, e.sx + 2 * grueso, grueso]];   // atrás a 7 m del borde: el nido de Idol (r 3,9 m en z-738) no lo toca
  for (const [x, z, sx, sz] of lados) {
    const h = alto + fondo, w = malla(new THREE.BoxGeometry(sx, h, sz), mt); w.position.set(x, y - fondo + h / 2, z); G.add(w);
    fis.caja(x, y - fondo + h / 2, z, sx, h, sz, 0, { tipo: 'muro' });
  }
}

function banderaChile() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 96, 32); g.fillStyle = '#d52b1e'; g.fillRect(0, 32, 96, 32); g.fillStyle = '#0039a6'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 10; g.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); } g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// edificio con zócalo de hormigón metido en el cerro, cuerpo de tinglado con ventanas y techo a dos aguas de 45°
// Edificio con las gaussianas de Idol (Fase 1): el splat a escala real reemplaza la caja; colisión y puerta siguen igual.
// El modelo se endereza con su eje largo (medido en herramientas/medir_splats.py), se da vuelta (Idol guarda Y hacia abajo)
// y, si el bloque es mucho más largo que el modelo (Idol los deja casi cúbicos), se arma con varios módulos en hilera.

// G-C2 (14-11): Spark dibuja cada nube con UNA escala, el promedio de la matriz (spark.module.js, updateFromMatrix), así que un
// modelo «estirar» NO se estira: cada módulo mide Lm·sE × Wm·sE × Hm·sE con sE = k·(fL + 1 + fW)/3. Esto da la planta real de la
// hilera (podio, colisión, terraza y losa de azotea la usan). null: sin estirar, con malla (?malla=1 sí se estira) o ?sewell=cono
const SIN_PLANTA_REAL = typeof location !== 'undefined' && new URLSearchParams(location.search).get('plantaReal') === '0';   // ?plantaReal=0: como antes (para comparar)
function plantaReal(e, sp) {
  if (SIN_PLANTA_REAL || !sp || !sp.estirar || !sp.min || !sp.max || e.anillo != null || mallaDe(sp)) return null;
  const Lm = sp.max[0] - sp.min[0], Hm = sp.max[1] - sp.min[1], Wm = sp.max[2] - sp.min[2], k = (sp.alto || e.pisos * PISO + 5) / Hm;
  const gL = Math.max(e.largo, e.ancho), gW = Math.min(e.largo, e.ancho);
  const n0 = sp.modulos || Math.max(1, Math.round(gL / (Lm * k * 1.2)));
  const lm0 = (gL / n0) * (n0 > 1 ? (sp.traslape || 1.2) : 1), sE = k * (lm0 / (Lm * k) + 1 + gW / (Wm * k)) / 3;   // lo que Spark dibujaba
  let s = sE, n = n0, paso = n0 > 1 ? (gL - lm0) / (n0 - 1) : 0;
  if (!sp.modulos) {
    // hileras (camarotes, escuela, club, concentradora, taller...): la escala única se elige para que el modelo calce con el ANCHO
    // del lote (hasta 15 % más) y los módulos llenan el LARGO con un traslape. Antes el ancho real era 15-25 m en lotes de 12-14 m
    // (el modelo sobresalía 2-6 m sobre la calle) y la hilera quedaba más corta que el podio (asomaba en las puntas)
    s = Math.min(sE, gW * 1.15 / Wm);
    const mL = Lm * s;
    n = Math.max(1, Math.round(gL * (sp.traslape || 1.2) / mL));
    if (n > 1 && (gL - mL) / (n - 1) > mL * 0.97) n = Math.ceil((gL - mL) / (mL * 0.97)) + 1;   // sin rendijas entre módulos
    paso = n > 1 ? (gL - mL) / (n - 1) : 0;
  }
  // pie del modelo: con la escala k del alto el ancla caía y1·(k − s) más arriba o abajo; los hundir empíricos ya cuentan con eso
  // (se conserva), salvo que el modelo quede flotando: entonces va 0,2 m dentro del podio
  const dy = Math.min(sp.max[1] * (k - s) - (sp.hundir || 0), -0.2);
  return { s, sE: s, k, n, paso, L: (n - 1) * paso + Lm * s, W: Wm * s, H: Hm * s, mL: Lm * s, dy };
}

function edificioSplat(e, def, fis, R, sp) {
  const esKit = !!(mallaDe(sp) || {}).kit;   // N0-KIT: el kit Sewell va a ras de su base (sin el «hundir» de la nube/malla)
  if (esKit) sp = { ...sp, hundir: 0 };
  const [x0, y0, z0] = sp.min, [x1, y1, z1] = sp.max;           // medidas ya enderezadas (eje largo = X)
  const Lm = x1 - x0, Hm = y1 - y0, Wm = z1 - z0;
  const k = (sp.alto || e.pisos * PISO + 5) / Hm;               // escala por la altura: pisos + techo
  const girado = (e.rot || 0) % 180 !== 0;
  const gx = girado ? e.ancho : e.largo, gz = girado ? e.largo : e.ancho;   // bloque en el mundo
  const largoX = gx >= gz;                                        // el eje largo del bloque va en X del mundo
  const gL = largoX ? gx : gz, gW = largoX ? gz : gx;
  let n = 1, fL = 1, fW = 1;
  if (sp.estirar) {
    n = sp.modulos || Math.max(1, Math.round(gL / (Lm * k * 1.2)));   // modulos: 1 → un solo modelo (casa Hamilton: dos copias se solapaban)             // módulos en hilera, cada uno estirado a lo más ~1,5×
    fL = (gL / n) / (Lm * k) * (n > 1 ? (sp.traslape || 1.2) : 1); fW = gW / (Wm * k);   // en hilera se traslapan un 20 %: sin eso quedaban huecos de 2-5 m entre módulos
  }
  const wL = sp.estirar ? gL : Lm * k, wW = sp.estirar ? gW : Wm * k;
  const wxS = largoX ? wL : wW, wzS = largoX ? wW : wL;
  const pr = plantaReal(e, sp);   // G-C2: planta que Spark dibuja de verdad (null con malla, sin estirar o en ?sewell=cono)
  if (pr) n = pr.n;   // G-C2: las hileras pueden llevar más módulos (más chicos) que antes
  if (esKit) n = 1;   // N0-KIT: el kit es UN edificio del largo del lote (los módulos 2..n quedaban vacíos: «carga» del auditor)
  const rxS = pr ? (largoX ? pr.L : pr.W) : wxS, rzS = pr ? (largoX ? pr.W : pr.L) : wzS;   // planta real en X y Z del mundo
  if (e.margenBase != null) sp = { ...sp, margenBase: e.margenBase };   // N1-A3: margenBase propio de un lote (casa de piedra junto a la terraza de la panadería)
  const tMin = minTerreno(e.x - wxS / 2, e.x + wxS / 2, e.z - wzS / 2, e.z + wzS / 2), tMax = pr && sp.margenBase == null ? maxTerreno(e.x - rxS / 2 - 0.5, e.x + rxS / 2 + 0.5, e.z - rzS / 2 - 0.5, e.z + rzS / 2 + 0.5) : maxTerreno(e.x - wxS / 2 - (sp.margenBase ?? 2.5), e.x + wxS / 2 + (sp.margenBase ?? 2.5), e.z - wzS / 2 - (sp.margenBase ?? 2.5), e.z + wzS / 2 + (sp.margenBase ?? 2.5));   // G-C2: con planta real, lo más alto bajo ella + 0,5 m (con 2,5 m alrededor del lote tomaba el muro de la terraza vecina: camarote de (-30,-340) subía 13 m)   // margenBase 0: terraza propia con patio (Hamilton), el cerro de atrás no sube la base   // la base queda sobre lo más alto en 2,5 m a la redonda: el cerro ya no tapa la planta baja
  // apoyo en el cerro: la base va al punto más alto del terreno bajo el edificio (nada queda enterrado);
  // pendiente abajo, el zócalo de concreto (edificio() lo dibuja) llena hasta el suelo, como en las fotos de Sewell
  // con terrazas el suelo bajo el edificio queda plano: solo se mete en el cerro si todavía hay desnivel (antes siempre 0,8 m: casa Hamilton enterrada)
  const base = tMax + 0.05, techo = pr ? base + pr.dy + pr.H : base + Hm * k;   // con terrazas el suelo queda plano: el modelo se apoya arriba y el podio rellena abajo (antes se metía 0,8 m)   // apenas 0,8 m dentro del cerro por detrás (no se ve; el modelo trae su propio zócalo)
  // podio: un poco más grande que la planta del modelo (103 %) y con la cara de arriba justo bajo su base.
  // Antes medía el 94 % y quedaba 1,2 m más alto: la base sobresalía 1-2 m por los bordes y el primer metro quedaba metido en el podio.
  // N1-C64: Spark dibuja las gaussianas con UNA escala (el promedio de x, y, z de la matriz), así que una nube «estirada» no se
  // estira: queda con su planta propia (camarote1905: 17,9 × 18,2 m en un lote de 22 × 10) y el podio del lote asomaba 2-3 m
  // en dos caras. e.podioReal: el podio (y su colisión y puerta) toma la planta que de verdad se dibuja. Con ?malla=1 no aplica
  // G-C2: ahora para todos los lotes «estirar» (plantaReal), también hileras de varios módulos
  const pX = rxS, pZ = rzS, fP = pr ? 1 : 1.03;
  if (esKit && e.id === 'club' && e.puerta && e.puerta.propia) e._clubFis = { fis, R, x: e.x, z: e.z, base, e };   // N2-C38: el pórtico del club arma su colisión y su puerta (kitEmblemas.js clubAcceso)
  if (esKit && e.id === 'escuela') e._escFis = { fis, R, x: e.x, z: e.z, base, e, epoca: def.epoca, tur: !!def.turismo };   // N2-ESCUELA: tur = museo   // N2-PUERTAS-EMB: acceso lateral de la Escuela Industrial (escalera, descanso y puerta; kitEmblemas.js escuelaAcceso)
  const e2 = { ...e, largo: girado ? pZ * fP : pX * fP, ancho: girado ? pX * fP : pZ * fP, pisos: Math.max(1, (techo - 3 - base) / PISO), techo: 'ninguno', _splat: true, _malla: !!mallaDe(sp), _kit1905: esKit && mallaDe(sp).kit.estilo === '1905', _kitPropia: esKit && !!mallaDe(sp).kit.puertaPropia, _yb: base + 0.05, _hundir: sp.hundir || 0,
    _cumbrera: sp.estirar && !sp.azotea ? (largoX ? 'x' : 'z') : null, _techo: techo };   // los estirados son a dos aguas con la cumbrera a lo largo   // la cara de arriba del podio a ras de la base (más alta tapaba las ventanas bajas del taller)
  edificio(e2, def, fis, R);
  const hundir = sp.hundir || 0;   // camarote_azotea: 0,5 m dentro del podio (tapa una franja gris al pie del modelo)
  // losa caminable de la azotea (el parapeto es el 5 % de arriba). Las copias muy estiradas a lo largo muestran la losa visual
  // más alta que el centro de sus gaussianas: ~0,4 m en (-96,-79), con fL 1,78; en (-95,-104), con fL 1,25, calza. Se sube en proporción
  const extraLosa = sp.azotea && !esKit ? Math.max(0, fL - 1.25) * 0.75 : 0;
  const yLosa = pr ? base + pr.dy + pr.H * (sp.azotea + 0.015) - 0.15 : base - hundir + Hm * k * sp.azotea - 0.15 + extraLosa;   // G-C2: 96,5 % del alto real (calzaba así en (-95,-104))
  if (sp.azotea) fis.caja(e.x, yLosa, e.z, rxS * 0.98, 0.3, rzS * 0.98, 0, { tipo: 'azotea' });
  const yaw = (largoX ? 0 : Math.PI / 2) + (sp.yaw || 0) * Math.PI / 180;
  const qAlinear = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.alinear || 0);
  const qVuelta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  for (let i = 0; i < n; i++) {
    // afuera: posición, giro y escala (en el marco ya enderezado y dado vuelta); adentro: el splat enderezado y dado vuelta
    const afuera = new THREE.Group();
    const m = new THREE.Group(); m.quaternion.copy(qVuelta).multiply(qAlinear);
    const info = mallaDe(sp); let s = null;   // ?malla=1: malla de TRELLIS.2 en la misma caja que la nube
    if (info) afuera.add(grupoMalla(info, sp, e));   /* N4-C20: el lote (color, número, puerta) para el kit Sewell */ else { s = new SplatMesh({ packedSplats: modelo(sp.url, sp.urlMovil), lod: CON_LOD }); corregirAzul(s, sp.azul); m.add(s); afuera.add(m); }
    if (pr) afuera.scale.setScalar(pr.s); else afuera.scale.set(k * fL, k, k * fW);   // G-C2: con la nube, la escala única que Spark usa de verdad
    afuera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    // tras la vuelta: x igual, y → -y, z → -z. El punto (centro x, y1, centro z) del modelo queda abajo al centro
    // G-C2: con la nube el ancla se escala con la escala uniforme que Spark usa de verdad: el modelo queda centrado en su podio
    const ancla = new THREE.Vector3((x0 + x1) / 2, -y1, -(z0 + z1) / 2).multiply(afuera.scale).applyQuaternion(afuera.quaternion);
    // con traslape cada módulo mide más que su espacio: los centros se reparten para que los extremos de la hilera calcen
    // justo con el podio (antes el primero y el último sobresalían en el aire)
    const largoMod = (gL / n) * (n > 1 ? (sp.traslape || 1.2) : 1);
    const paso = n > 1 ? (i - (n - 1) / 2) * (pr ? pr.paso : (gL - largoMod) / (n - 1)) : 0;
    const destino = new THREE.Vector3(e.x + (largoX ? paso : 0), pr ? base + pr.dy : base - hundir, e.z + (largoX ? 0 : paso));
    afuera.position.copy(destino).sub(ancla);
    R.exterior.add(afuera); R.gaussianas.push({ id: e.id || sp.url, malla: s || afuera, grupo: afuera, podio: e2._podio, lote: { x: e.x, z: e.z, largo: e.largo, ancho: e.ancho, rot: e.rot || 0 }, base, real: pr && { L: pr.L, W: pr.W, H: pr.H, sE: pr.sE, dy: pr.dy } });
  }
  // N1-O5 (14-11): ventanas de madera pintada en una cara ciega del modelo (Hamilton: el hastial poniente era un muro liso y oscuro).
  // e.ventanasExtra = { lado: 'oeste'|'este'|'norte'|'sur', v: [[u, h], ...] } (u: metros a lo largo de la cara, h: centro sobre la base)
  if (e.ventanasExtra && !esKit) {   /* N1-KIT: el kit ya trae ventanas en los hastiales */
    const { lado, v, dentro = 0 } = e.ventanasExtra, nn = { sur: [0, 1], norte: [0, -1], este: [1, 0], oeste: [-1, 0] }[lado];
    // N1-C66 (14-11): dentro = m que el muro visible queda dentro de la caja del modelo (Hamilton: la caja la agrandan el alero y
    // gaussianas sueltas; el muro poniente está 0,5 m más adentro y las ventanas flotaban en el aire, vistas de canto desde el sur)
    const cara = (nn[0] ? rxS : rzS) / 2 + 0.04 - dentro, rotV = Math.atan2(nn[0], nn[1]), mBl = mat(0xe9e4d8, { rough: 0.8 }), mVi = mat(0x1f262e, { rough: 0.25, metal: 0.3 });
    for (const [u, h] of v) {
      const g = new THREE.Group(); g.position.set(e.x + nn[0] * cara - nn[1] * u, (pr ? base + pr.dy : base - hundir) + h, e.z + nn[1] * cara + nn[0] * u); g.rotation.y = rotV;
      const pz = (sx, sy, sz, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); };
      pz(0.95, 1.55, 0.06, mVi, 0, 0, 0.02);   // vidrio
      for (const s of [-1, 1]) { pz(0.14, 1.85, 0.14, mBl, s * 0.55, 0, 0.06); pz(1.24, 0.14, 0.14, mBl, 0, s * 0.85, 0.06); }   // marco
      pz(0.06, 1.55, 0.08, mBl, 0, 0, 0.07); pz(0.95, 0.06, 0.08, mBl, 0, 0.1, 0.07);   // cruz de la ventana de guillotina
      pz(1.4, 0.1, 0.28, mBl, 0, -0.95, 0.12);   // alféizar
      R.exterior.add(g);
    }
  }
  const wR = pr ? pr.W : wW, hR = pr ? pr.H : Hm * k;   // G-C2: juntas y tablas con el ancho y alto que se ven
  const lmR = pr ? gL - pr.paso * (n - 1) : (gL / n) * (sp.traslape || 1.2);   // juntas y tablas en los mismos puntos medios que los módulos
  if (n > 1 && sp.juntas && !esKit) juntasHilera(e, R, { n, gL, wW: wR, largoMod: lmR, base, alto: hR, largoX });
  if (n > 1 && sp.relleno && !esKit) rellenoHilera(e, R, { n, gL, wW: wR, largoMod: lmR, base, alto: hR * sp.relleno, largoX });
}

// casas de frontón en hilera (palitroque): entre una y otra quedaba una rendija con el cielo a la vista; la cierra un tabique de tablas hasta el alero
function rellenoHilera(e, R, { n, gL, wW, largoMod, base, alto, largoX }) {
  const paso = (gL - largoMod) / (n - 1), mt = matMundo(texMadera(false), 1.1, 0x9a6c46);
  for (let i = 0; i < n - 1; i++) {
    const u = (i + 0.5 - (n - 1) / 2) * paso, m = malla(new THREE.BoxGeometry(3, alto + 0.4, wW * 0.94), mt);
    if (largoX) m.position.set(e.x + u, base + alto / 2 - 0.2, e.z); else { m.position.set(e.x, base + alto / 2 - 0.2, e.z + u); m.rotation.y = Math.PI / 2; }
    R.exterior.add(m);
  }
}

// Muro cortafuego de ladrillo en cada unión de una hilera de módulos (taller): los galpones largos los tenían,
// y tapan la costura entre dos copias del modelo (pared de punta y techo cortado que se veían como una raya)
function juntasHilera(e, R, { n, gL, wW, largoMod, base, alto, largoX }) {
  const paso = (gL - largoMod) / (n - 1), traslapo = largoMod - paso, grueso = Math.min(3, traslapo + 0.9);
  // alero y cumbrera medidos en el modelo del taller (alero ~80 % del alto); el muro asoma 1,2 m sobre la cumbrera
  const ancho = wW + 0.5, alero = alto * 0.8, cima = alto + 1.2, V = (u, v) => new THREE.Vector2(u, v);
  const forma = new THREE.Shape([V(-ancho / 2, -0.5), V(ancho / 2, -0.5), V(ancho / 2, alero), V(0, cima), V(-ancho / 2, alero)]);
  const geo = new THREE.ExtrudeGeometry(forma, { depth: grueso, bevelEnabled: false }); geo.translate(0, 0, -grueso / 2);
  const mt = matMundo(texLadrillo(), 2.4, 0xbfb2a4);   // ladrillo gastado, más cerca del tono de la madera del taller
  const tapa = mat(COLOR.zinc, { metal: 0.4, rough: 0.5 });   // remate de zinc sobre el muro
  for (let i = 0; i < n - 1; i++) {
    const u = (i + 0.5 - (n - 1) / 2) * paso, g = new THREE.Group();
    g.add(malla(geo, mt));
    const largoFald = Math.hypot(ancho / 2, cima - alero);
    for (const sx of [-1, 1]) {
      const r = caja(largoFald + 0.3, 0.18, grueso + 0.3, COLOR.zinc); r.material = tapa;
      r.position.set(sx * ancho / 4, (alero + cima) / 2 + 0.09, 0); r.rotation.z = -sx * Math.atan2(cima - alero, ancho / 2); g.add(r);
    }
    if (largoX) { g.position.set(e.x + u, base, e.z); g.rotation.y = Math.PI / 2; } else g.position.set(e.x, base, e.z + u);
    R.exterior.add(g);
  }
}

// N0-EMB (carril kit): edificio emblemático sin nube ni malla (iglesia 231): una «nube» vacía de 1 m que solo da la caja; el kit la llena
function spKit(id) {
  const k = kitNivel(id); if (!k || !k.forma) return null;
  return { url: 'kit/' + id + '.ply', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5], estirar: true, alto: k.alto, yaw: 0, alinear: 0 };
}
function edificio(e, def, fis, R) {
  // con id: su propio modelo; sin id (camarotes): el modelo de su color, estirado a la medida del bloque
  const sp = !e._splat && R.splats && (e.id ? R.splats[e.id] || spKit(e.id) : R.splats['color:' + e.color]);
  if (sp) return edificioSplat(e, def, fis, R, sp);
  const G = new THREE.Group(), girado = (e.rot || 0) % 180 !== 0;
  const wx = girado ? e.ancho : e.largo, wz = girado ? e.largo : e.ancho;
  const x0 = e.x - wx / 2, x1 = e.x + wx / 2, z0 = e.z - wz / 2, z1 = e.z + wz / 2;
  const tMax = maxTerreno(x0, x1, z0, z1), tMin = minTerreno(x0, x1, z0, z1);
  const yb = e._yb ?? tMax + 0.4, h = e.pisos * PISO;
  if (e._splat) { R.matEscalon ||= matMundo(texSilleria(), 2.2, 0xb8ada0); e._podio = { x0, x1, z0, z1, yb, tMin, tMax }; }   // para medir el montaje del modelo sobre su podio
  const noche = !!def.noche;
  // zócalo
  // los zócalos altos (muro de contención hacia la pendiente) llevan sillería de piedra: lisos se veían como un bloque desnudo
  // N1-C74: el zócalo baja hasta lo más bajo del terreno bajo TODA su huella (el podio sobresale 0,2 m del lote; se mira 1 m más
  // allá, con la malla visual y con altura()) y se entierra al menos 0,3 m más. Antes se medía solo bajo el lote y con alturaMalla:
  // en la ladera el borde del zócalo podía quedar sobre el suelo, recto y con su sombra más abajo («casa flotando»)
  const tMinA = Math.min(muestrasTerreno(x0 - 1.2, x1 + 1.2, z0 - 1.2, z1 + 1.2, Math.min), minAltura(x0 - 1.2, x1 + 1.2, z0 - 1.2, z1 + 1.2));
  const tFondo = Math.min(tMin - 1.5, tMinA - 0.3);
  const zh = yb - tFondo, z = malla(new THREE.BoxGeometry(wx + 0.4, zh, wz + 0.4), zh > (LADERA.natural ? 1.2 : 5) ? matMundo(texSilleria(), LADERA.natural ? 2.2 : 4, LADERA.natural ? 0xb8ada0 : 0xcfc6b8) : e._splat ? matMundo('suelo_tierra', 8, 0xc9b48f) : matMundo('concreto', 3, 0xd8d2c8));
  // zócalo: esta línea quedaba dentro de un comentario (el podio no se agregaba nunca y los edificios de 1905 flotaban en la bajada). Solo se activa en 1905 (LADERA.natural): N2-N4 siguen como estaban
  z.position.set(e.x, yb - zh / 2, e.z); if (LADERA.natural && yb - tMinA > 0.4) {   /* N1-C74: también si el desnivel está justo fuera del lote */ G.add(z); if (e._podio) e._podio.mat = z.material; }   // N1-C73: el material del podio lo toma la escalera de la puerta (interiores.js)   // en terreno parejo (estación, taller) el zócalo no hace falta: sobresalía como un delantal de ladrillo
  // cuerpo
  const c = cajaFachada(wx, h, wz, e.color, noche); c.position.set(e.x, yb + h / 2, e.z); c.castShadow = true; c.receiveShadow = true; G.add(c);
  const colCuerpo = fis.caja(e.x, (yb + h + tMin - 1.5) / 2, e.z, wx, h + yb - tMin + 1.5, wz, 0, { tipo: 'muro', cuerpo: !e._clubFis && !e._escFis });   // ESC2: cuerpo = interiores.js (colisionKit) puede recortarla frente a los peldaños del kit (club y escuela la rehacen ellos)
  if (e._clubFis) Object.assign(e._clubFis, { col: colCuerpo, y0: tMin - 1.5, y1: yb + h });
  if (e._escFis) Object.assign(e._escFis, { col: colCuerpo, y0: tMin - 1.5, y1: yb + h, wx, wz });   // N2-PUERTAS-EMB
  if (e._splat) c.visible = false;   // el zócalo sí se ve: es el apoyo del modelo en la pendiente
  // techo físico a dos aguas para los modelos de Idol a dos aguas: antes el colisionador terminaba plano 3 m bajo la
  // cumbrera y Nato (y los tablones de techo a techo) quedaban metidos dentro del techo, en el hueco en V entre techos
  if (e._cumbrera) {
    const pts = [], yt = yb + h, eje = e._cumbrera;
    for (const s of [-1, 1]) {
      if (eje === 'x') pts.push(e.x + s * wx / 2, yt, e.z - wz / 2, e.x + s * wx / 2, yt, e.z + wz / 2, e.x + s * wx / 2, e._techo, e.z);
      else pts.push(e.x - wx / 2, yt, e.z + s * wz / 2, e.x + wx / 2, yt, e.z + s * wz / 2, e.x, e._techo, e.z + s * wz / 2);
    }
    const colTecho = fis.convexo(new Float32Array(pts), { tipo: 'techo' });
    if (e._clubFis) e._clubFis.techo = { col: colTecho, pts };
    if (e._escFis) e._escFis.techo = { col: colTecho, pts };   // N2-PUERTAS-EMB: la escuela lo recorta sobre la escalera lateral   // N2-C38: el club recorta su frente (el alero llega 0,6 m más allá de la fachada, no sobre el pórtico)
  }
  // techo
  let techo = e.techo || 'dos';
  const az = def.azoteas;
  if (az && techo === 'dos' && (!e.id || e.id === 'camarote_azotea') &&   /* R-2: sin malla el camarote de azotea sale con techo plano caminable */ e.x > az.x0 && e.x < az.x1 && -e.z > az.t0 && -e.z < az.t1) techo = 'plano';
  const yt = yb + h;
  const colTecho = e.techoColor ?? [COLOR.rojoTecho, COLOR.zinc, 0x6c8f5a, COLOR.rojoTecho][Math.floor(hash(e.x * 3.1 + e.z) * 4)];
  if (techo === 'ninguno') { /* el splat trae su propio techo */ }
  else if (techo === 'dos') {
    const a = (girado ? wz : wx) + 1, an = (girado ? wx : wz) + 1.2, alto = an / 2;
    const forma = new THREE.Shape([new THREE.Vector2(-an / 2, 0), new THREE.Vector2(an / 2, 0), new THREE.Vector2(0, alto)]);
    const geo = new THREE.ExtrudeGeometry(forma, { depth: a, bevelEnabled: false }); geo.translate(0, 0, -a / 2);
    const m = malla(geo, mat(def.invierno ? 0xf4f6fb : colTecho, { metal: def.invierno ? 0 : 0.35, rough: 0.55 }));
    m.position.set(e.x, yt, e.z); m.rotation.y = girado ? 0 : Math.PI / 2; G.add(m);
    const pts = [];
    for (const s of [-1, 1]) {
      const p = [[-an / 2, 0], [an / 2, 0], [0, alto]];
      for (const [u, v] of p) { if (girado) pts.push(e.x + u, yt + v, e.z + s * a / 2); else pts.push(e.x + s * a / 2, yt + v, e.z + u); }
    }
    fis.convexo(new Float32Array(pts), { tipo: 'techo' });
    // chimenea de lata
    const ch = malla(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 8), mat(0x777b80, { metal: 0.6 })); ch.position.set(e.x + (hash(e.z) - 0.5) * wx * 0.6, yt + alto * 0.7, e.z + (girado ? 0 : 0)); G.add(ch);
  } else {
    const losa = caja(wx + 0.6, 0.35, wz + 0.6, def.invierno ? 0xf4f6fb : COLOR.zinc, { metal: 0.4, rough: 0.5 }); losa.position.set(e.x, yt + 0.17, e.z); G.add(losa);
    fis.caja(e.x, yt + 0.17, e.z, wx + 0.6, 0.35, wz + 0.6, 0, { tipo: 'azotea' });
    if (techo === 'artdeco') {   // parapeto escalonado al frente
      const frente = girado ? 'x' : 'z';
      for (const [w, hh] of [[0.9, 2.5], [0.5, 4]]) {
        const p = caja(frente === 'x' ? 0.6 : wx * w, hh, frente === 'x' ? wz * w : 0.6, e.color);
        p.position.set(e.x + (frente === 'x' ? wx / 2 : 0), yt + hh / 2, e.z + (frente === 'z' ? wz / 2 : 0)); G.add(p);
      }
    }
  }
  // letrero, número y puerta en la fachada del lado indicado
  const lado = (e.puerta && e.puerta.lado) || 'sur';
  const n = { sur: [0, 1], norte: [0, -1], este: [1, 0], oeste: [-1, 0] }[lado];
  const fx = e.x + n[0] * (wx / 2 + 0.05), fz = e.z + n[1] * (wz / 2 + 0.05), rotF = Math.atan2(n[0], n[1]);
  // la puerta va a la altura del suelo justo frente a ella (en el zócalo si el edificio está en pendiente)
  const yPuerta = Math.min(altura(fx + n[0] * 1.2, fz + n[1] * 1.2), altura(fx + n[0] * 3, fz + n[1] * 3)) + 0.05;
  // N1-A1 (14-11): peldaños de piedra frente a la puerta cuando el podio de 1905 queda 0,45-2,6 m sobre el suelo (antes un escalón de ~1 m)
  const dP = yb - yPuerta;
  if (LADERA.natural && e._splat && dP > 0.45 && dP < 2.6) {
    const ns = Math.ceil(dP / 0.35), prof = 0.45, anch = 2.6, mP = R.matEscalon ||= matMundo(texSilleria(), 2.2, 0xb8ada0);
    for (let k = 1; k < ns; k++) {
      const top = yPuerta + dP * k / ns, dist = 0.2 + (ns - k - 0.5) * prof;   // 0,2: el zócalo sobresale 0,2 m de la planta
      const sx = n[0] ? prof : anch, sz = n[0] ? anch : prof, px = e.x + n[0] * (wx / 2 + dist), pz = e.z + n[1] * (wz / 2 + dist);
      const alto = top - Math.min(yPuerta - 0.6, minAltura(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2) - 0.3, muestrasTerreno(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2, Math.min) - 0.3);   // N1-C74: macizo hasta el suelo real bajo el peldaño (antes hasta yPuerta − 0,6: colgaba en la ladera)
      const pe = malla(new THREE.BoxGeometry(sx, alto, sz), mP); pe.position.set(px, top - alto / 2, pz); G.add(pe);
      const cF = fis.caja(px, top - alto / 2, pz, sx, alto, sz, 0, { tipo: 'escalera' });
      ((R.escPodio ||= []).push({ x: e.x, z: e.z, malla: pe, col: cF }));   // N1-C73: interiores.js la reemplaza si la casa tiene puerta propia (antes: escalera sobre la escalera)
    }
  }
  // M-C1: con ?malla=1 la malla de TRELLIS llena la caja de la nube y puede asomar sobre el podio: letreros y números 0,35 m más afuera
  const salM = e._malla ? 0.35 : 0;
  if (e.nombre && e._splat && e.id === 'estacion') {
    // estación: dos letreros de andén sobre postes, de cara a la vía (un cartel en la fachada quedaba tapado por el alero del corredor del modelo)
    const tx = letreroTex(e.nombre, '#1d2a44', '#f3efe2'), mL = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 });
    for (const dx of [-14, 14]) {
      const x = e.x + dx, z = 14.4, y0 = 0.9;   // andén de la estación: z 13-18, cara de arriba a 0,9 m
      for (const s of [-1.9, 1.9]) { const p = caja(0.14, 3.1, 0.14, 0x3a3f44, { metal: 0.5 }); p.position.set(x + s, y0 + 1.55, z); G.add(p); }
      const marco = caja(4.3, 1.0, 0.1, 0x3a3f44, { metal: 0.5 }); marco.position.set(x, y0 + 2.75, z); G.add(marco);
      for (const lado of [1, -1]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 0.85), mL); t.position.set(x, y0 + 2.75, z + lado * 0.056); if (lado < 0) t.rotation.y = Math.PI; G.add(t); }
    }
  } else if (e.nombre && e._splat && e.id === 'club') {
    // club (GIMNASIO, desde 1930): letras blancas recortadas sobre la fachada azul del modelo (antes un cartel gris de grey-box)
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const gg = c.getContext('2d');
    gg.font = 'bold 120px Georgia, serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.lineWidth = 10; gg.strokeStyle = '#13213d'; gg.strokeText(e.nombre, 512, 84); gg.fillStyle = '#f4f1e6'; gg.fillText(e.nombre, 512, 84);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const l = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.72), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 }));
    l.position.set(fx + n[0] * (0.3 + salM), Math.max(yb + 3.5, yPuerta + 4.6), fz + n[1] * (0.3 + salM)); l.rotation.y = rotF; G.add(l);
  } else if (e.nombre && e._splat && e.id === 'hamilton') {
    // casa de Hamilton: letras recortadas más chicas, rectas y pegadas a la fachada (antes un cartel de 9,6 m que colgaba torcido de la pared)
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const gg = c.getContext('2d');
    gg.font = 'bold 92px Georgia, serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.lineWidth = 9; gg.strokeStyle = '#2a1a0c'; gg.strokeText(e.nombre, 256, 68); gg.fillStyle = '#f2e6c8'; gg.fillText(e.nombre, 256, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const l = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 }));
    l.position.set(fx + n[0] * (0.2 + salM), yb + 3.7 - (e._hundir || 0), fz + n[1] * (0.2 + salM)); l.rotation.y = rotF; G.add(l);
  } else if (e.nombre && e._splat && e.id === 'cine') {
    // el modelo de Idol trae su marquesina blanca (frente a ~0,1 m de fx, entre +4,9 y +6,6 sobre la puerta): solo las letras, montadas en ella
    // (antes un cartel plano con fondo encima de la mitad baja de la marquesina: doble letrero)
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const gg = c.getContext('2d');
    gg.font = 'bold 96px Georgia, serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.lineWidth = 8; gg.strokeStyle = '#2a0c0c'; gg.strokeText(e.nombre, 256, 68); gg.fillStyle = '#b8231e'; gg.fillText(e.nombre, 256, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const l = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 }));   // recorte opaco: con transparencia las gaussianas lo tapaban de frente
    // el modelo va hundido sp.hundir en el podio: las letras bajan con él
    l.position.set(fx + n[0] * (0.25 + salM), yPuerta + 5.75 - (e._hundir || 0), fz + n[1] * (0.25 + salM)); l.rotation.y = rotF; G.add(l);
  } else if (e.nombre) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(12, wx * (e._kit1905 ? 0.42 : 0.6), 3 + e.nombre.length * 0.9), e._kit1905 ? 1.5 : 2), new THREE.MeshStandardMaterial({ map: letreroTex(e.nombre, e.id === 'cine' ? '#1d1b22' : '#f3e6c8', e.id === 'cine' ? '#ffd060' : '#3a2410'), emissive: e.id === 'cine' ? 0xffd060 : 0, emissiveIntensity: 0.4 }));
    // N1-KIT: con el kit de 1905 el letrero va 0,14 m delante del muro del kit (caja / 1,03 − alero 0,45), sobre un tablero café
    const sal = e._kit1905 ? (n[0] ? wx : wz) / 2.06 - 0.31 - (n[0] ? wx : wz) / 2 - 0.05 : 0.1 + salM;
    l.position.set(fx + n[0] * sal, Math.max(yb + 3.5, yPuerta + 4.6), fz + n[1] * sal); l.rotation.y = rotF; G.add(l);
    if (e._kit1905) { const tb = caja(l.geometry.parameters.width + 0.3, 1.8, 0.12, 0x5a4330); tb.position.set(l.position.x - n[0] * 0.07, l.position.y, l.position.z - n[1] * 0.07); tb.rotation.y = rotF; G.add(tb); }
  }
  if (e.numero) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.6), new THREE.MeshStandardMaterial({ map: letreroTex(e.numero, '#ffffff', '#1a3d22'), transparent: true }));
    l.position.set(fx + n[0] * (0.1 + salM), yb + h - 2, fz + n[1] * (0.1 + salM)); l.rotation.y = rotF; G.add(l);
  }
  if (e.puerta) {
    if (!e._splat) { const p = caja(2.5, 3.4, 0.4, 0x4a2c18); p.position.set(fx, yPuerta + 1.7, fz); p.rotation.y = rotF; G.add(p); }   // los modelos de Idol traen su puerta
    if (!e._splat) { const m = caja(3.6, 0.25, 1.6, 0x222222, { metal: 0.6 }); m.position.set(fx + n[0] * 0.8, yPuerta + 3.8, fz + n[1] * 0.8); m.rotation.y = rotF; G.add(m); }   // marquesina (los modelos de Idol traen la suya: la caja negra atravesaba los letreros)
    // descanso frente a la puerta
    if (!e._splat) { const d = caja(n[0] ? 3 : 5, 0.3, n[0] ? 5 : 3, COLOR.concreto); d.position.set(fx + n[0] * 1.6, yPuerta - 0.13, fz + n[1] * 1.6); d.castShadow = false; G.add(d); }   // descanso (con modelo de Idol quedaba como losa gris suelta)
    if (e._splat && (e.puerta.marco || e._malla) && !e.puerta.propia && !e._kitPropia) {   /* N2-C36: el cine165 trae su portón: sin cortavientos delante */   /* M-C1: la malla de TRELLIS no trae la puerta ni el pórtico de la nube */   // modelo de Idol sin puerta en ese lado (palitroque): marco, puerta de madera y peldaños hasta el suelo
      const ent = new THREE.Group(), yd = Math.max(yb, yPuerta);
      // suelo más bajo bajo toda la huella (cortavientos + peldaños): en pendiente un solo escalón quedaba flotando
      let tSuelo = yPuerta;
      for (let u = -1.8; u <= 1.8; u += 0.6) for (let w = 0; w <= 4.6; w += 0.4) tSuelo = Math.min(tSuelo, altura(fx + n[0] * w + n[1] * u, fz + n[1] * w - n[0] * u));
      const sube = yd - tSuelo;
      // cortavientos de tablas que sale 1,4 m de la fachada (las ventanas del modelo sobresalen y tapaban una puerta a ras), con techito de zinc
      const P = 1.4, altoC = 3.55 + sube + 0.3;   // el cuerpo baja hasta el suelo más bajo de la huella
      const cuerpo = malla(new THREE.BoxGeometry(3.6, altoC, P + 0.4), matMundo(texMadera(false), 1.1, 0xb98a5c)); cuerpo.position.set(0, 3.55 - altoC / 2, P / 2 - 0.2); ent.add(cuerpo);   // tablas de madera (antes caja café lisa)
      const techito = caja(4.2, 0.18, P + 0.9, COLOR.zinc, { metal: 0.4, rough: 0.5 }); techito.position.set(0, 3.68, P / 2); techito.rotation.x = 0.18; ent.add(techito);   // bajo el letrero BOWLING
      const hoja = caja(2.0, 2.9, 0.12, 0x4e2f1a); hoja.position.set(0, 1.45, P + 0.06); ent.add(hoja);
      for (const s of [-1, 1]) {
        const j = caja(0.24, 3.2, 0.2, 0xe9e3d3); j.position.set(s * 1.12, 1.6, P + 0.1); ent.add(j);   // jambas
        const t = caja(0.78, 2.4, 0.04, 0x6e4a2c); t.position.set(s * 0.48, 1.4, P + 0.13); ent.add(t);   // tableros de la hoja
      }
      const dintel = caja(2.7, 0.28, 0.24, 0xe9e3d3); dintel.position.set(0, 3.3, P + 0.1); ent.add(dintel);
      const manilla = caja(0.1, 0.1, 0.12, 0xd8b048, { metal: 0.7 }); manilla.position.set(0.72, 1.35, P + 0.2); ent.add(manilla);
      const np = Math.max(1, Math.ceil(sube / 0.22));
      for (let i = 0; i < np; i++) {   // peldaños: el primero a ras del umbral, el último sobre el suelo
        const top = -i * sube / np, hh = top + sube + 0.3;   // cada peldaño macizo hasta bajo el suelo más bajo
        const p = caja(2.8, hh, 0.38, COLOR.concreto); p.position.set(0, top - hh / 2, P + 0.3 + i * 0.36); ent.add(p);
        // ESC (16-11, Diego: «que Nato no se entierre en las escaleras»): estos peldaños eran solo dibujo (el HOSPITAL del N4 y los
        // modelos con cortavientos): Nato pisaba el suelo de abajo, hundido hasta 0,5 m. Ahora cada uno con su caja de colisión
        const dz = P + 0.3 + i * 0.36; fis.caja(fx + Math.sin(rotF) * dz, yd + top - hh / 2, fz + Math.cos(rotF) * dz, 2.8, hh, 0.38, rotF, { tipo: 'escalera' });
      }
      ent.position.set(fx, yd, fz); ent.rotation.y = rotF; G.add(ent);
      // N0-FABLE-1611 (C1): el cortavientos no tiene física y la cámara, al salir de la sala, quedaba DENTRO de él (pantalla café): obstáculo solo de cámara
      (fis.camObst ||= []).push({ x: fx + n[0] * 0.55, z: fz + n[1] * 0.55, r: 1.95, y0: yd - sube - 0.5, y1: yd + 4.1 }); e._cortav = true;
    }
    if (!e._clubFis) R.puertas.push({ x: fx + n[0] * 1.8, y: yPuerta, z: fz + n[1] * 1.8, rumbo: rotF, sala: e.puerta.sala, lado: 'entrada', nombre: e.puerta.nombre || e.nombre, avisoCerrado: e.puerta.cerrado, salidaDist: e._cortav ? 4.4 : undefined });   // N0-FABLE-1611 (C1): con cortavientos se sale más lejos (cámara fuera de él)   // N4-SALAS: cerrado = aviso si no hay sala   // N0-EMB9: puerta.nombre (TENIENTE CLUB)
  }
  if (e.ropa && !e._splat) {   // ropa tendida entre ventanas (los modelos de Idol traen la suya)
    const y = yb + PISO * 1.8, zz = e.z + wz / 2 + 0.6;
    G.add(tubo(new THREE.Vector3(e.x - wx * 0.3, y, zz), new THREE.Vector3(e.x + wx * 0.3, y, zz), 0.02, 0xeeeeee));
    for (let i = 0; i < 5; i++) { const r = caja(0.8, 1, 0.05, [0xf2f2f2, 0xd84c4c, 0x4c7fd8, 0xf2d84c, 0x7fd87f][i]); r.position.set(e.x - wx * 0.25 + i * wx * 0.12, y - 0.5, zz); r.castShadow = false; G.add(r); }
  }
  R.exterior.add(G);
}

// escalera central: peldaños a la vista, rampa invisible para la física y pasamanos amarillos
function escalera(e, fis, R) {
  const y0 = e.y0 ?? e._y0 ?? altura(e.x0, e.z0) + 0.25, y1 = e.y1 ?? e._y1 ?? altura(e.x1, e.z1) + 0.25;   // _y0/_y1: los de su rampa de terreno
  const a = new THREE.Vector3(e.x0, y0, e.z0), b = new THREE.Vector3(e.x1, y1, e.z1), d = new THREE.Vector3().subVectors(b, a);
  const L = d.length(), f = d.clone().normalize();
  const eu = new THREE.Euler(-Math.asin(f.y), Math.atan2(f.x, f.z), 0, 'YXZ'), q = new THREE.Quaternion().setFromEuler(eu);
  const grosor = 1.0, up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const centro = a.clone().addScaledVector(d, 0.5).addScaledVector(up, -grosor / 2);
  // peldaños (visual): huella 0.32 m
  const n = Math.max(2, Math.round(Math.hypot(d.x, d.z) / 0.32)), alto = (y1 - y0) / n;
  // ESC2 (16-11, Diego: «que Nato no se entierre en las escaleras»): antes UNA rampa invisible por los talones de los peldaños
  // (la caja de abajo): cada huella quedaba hasta una contrahuella sobre ella y Nato se hundía 10-30 cm en las escaleras públicas.
  // Ahora UN colisionador compuesto con una caja por peldaño, con el tope de su huella dibujada (el paso automático los sube de a uno).
  // ciudadViva.js no usa la física en las escaleras (su propia curva enTramo): no cambia. La rampa queda guardada para el hielo (abajo)
  const gH = Math.hypot(d.x, d.z) / n, hh = Math.abs(alto) + 0.6, cajasP = [];
  for (let i = 0; i < n; i++) { const top = y0 + alto * (i + 0.5) + Math.abs(alto) / 2 + 0.025; cajasP.push({ x: 0, y: top - hh / 2 - y0, z: (i + 0.5) * gH, sx: e.ancho, sy: hh, sz: gH }); }
  const colP = fis.compuesto(cajasP, a.x, y0, a.z, { x: 0, y: Math.sin(Math.atan2(d.x, d.z) / 2), z: 0, w: Math.cos(Math.atan2(d.x, d.z) / 2) }, { tipo: 'escalera' });
  const rampaEsc = { centro, grosor, L, q: { x: q.x, y: q.y, z: q.z, w: q.w }, alto };
  const geoP = new THREE.BoxGeometry(e.ancho, Math.abs(alto) + 0.05, Math.hypot(d.x, d.z) / n + 0.02);
  const inst = new THREE.InstancedMesh(geoP, matPeldano(R.invierno), n);
  const m4 = new THREE.Matrix4(), rumbo = Math.atan2(d.x, d.z);
  for (let i = 0; i < n; i++) {
    const p = a.clone().addScaledVector(d, (i + 0.5) / n); p.y = y0 + alto * (i + 0.5) - (alto > 0 ? 0 : 0);
    m4.makeRotationY(rumbo).setPosition(p.x, p.y - alto * 0.0, p.z); inst.setMatrixAt(i, m4);
  }
  inst.castShadow = false; inst.receiveShadow = true; R.exterior.add(inst);
  // cuerpo de concreto bajo la escalera
  // sinCuerpo: escalera metida en un corte del terreno (pasaje del N3): el cuerpo inclinado asomaba por delante del último peldaño
  if (!e.sinCuerpo) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(e.ancho + 0.6, 6, L), matMundo('concreto', 3));
    base.position.copy(a).addScaledVector(d, 0.5).addScaledVector(up, -3.4); base.quaternion.copy(q); base.receiveShadow = true; R.exterior.add(base);
  }
  // pasamanos amarillos a 1 m, con postes blancos
  const lado = new THREE.Vector3(Math.cos(rumbo), 0, -Math.sin(rumbo));
  for (const s of e.sinPasamanos ? [] : [-1, 1]) {   // sinPasamanos: ?sewell=cono los dibuja con aberturas en los descansos
    const o = lado.clone().multiplyScalar(s * (e.ancho / 2 - 0.15));
    R.exterior.add(tubo(a.clone().add(o).setY(y0 + 1.05), b.clone().add(o).setY(y1 + 1.05), 0.05, 0xe2ded2));
    for (let k = 0; k <= L; k += 6) { const p = a.clone().addScaledVector(f, k).add(o); R.exterior.add(tubo(p, p.clone().setY(p.y + 1.05), 0.05, COLOR.blanco)); }
  }
  R.escaleras[e.id || ('e' + Object.keys(R.escaleras).length)] = { a, b, ancho: e.ancho, col: colP, rampa: rampaEsc };   // ESC2: col/rampa para el hielo
}
// ESC2 (16-11): escalera cubierta por la lámina de hielo (entidades.js hieloVisible, N3): la lámina lisa va sobre las narices de los
// peldaños (+ contrahuella + 6 cm): ahí la física es una rampa a la altura de la cara de arriba de la lámina (resbala, sin peldaños).
// Misma búsqueda de escalera que hieloVisible (la primera que calza)
function escalerasHielo(def, fis, R) {
  for (const s of def.elementos) if (s.t === 'hielo') {
    const esc = Object.values(R.escaleras || {}).find(e => Math.abs((e.a.x + e.b.x) / 2 - s.x) < s.sx && Math.min(e.a.z, e.b.z) < s.z + s.sz / 2 && Math.max(e.a.z, e.b.z) > s.z - s.sz / 2);
    if (!esc || !esc.rampa || esc.hielo) continue;
    const r = esc.rampa, d = new THREE.Vector3().subVectors(esc.b, esc.a), cosT = Math.hypot(d.x, d.z) / d.length(), sube = Math.abs(r.alto) + 0.03 + 0.03 / cosT;
    // (los peldaños compuestos quedan debajo: siguen siendo la física de las franjas de los costados que la lámina no cubre)
    esc.colHielo = fis.caja(r.centro.x, r.centro.y + sube, r.centro.z, Math.max(esc.ancho, s.sx) - 0.4, r.grosor, r.L, 0, { tipo: 'escalera' }, r.q); esc.hielo = true;
  }
}

// ------------------------------------------------------------------ salas aparte (interiores)
// Puerta de una sala vista desde dentro: vano con jambas y dintel del material del muro (1,1 m de fondo), marco de
// troncos y la luz del día con degradado al fondo. Antes era un rectángulo blanco plano pegado al muro.
// dir: +1 si la sala queda hacia +z del plano de la luz (muro del fondo), -1 si queda hacia -z (muro de la entrada).
function portalSala(g, fis, x, y0, zp, dir, enMuro, matJ, abre = 1.1) {   // abre: giro de las hojas (rad)
  const luz = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({ map: texLuzDia(), color: 0x8a6a42 }));
  luz.position.set(x, y0 + 1.6, zp); if (dir < 0) luz.rotation.y = Math.PI; g.add(luz);
  const P = enMuro ? 1.1 : 0;
  if (enMuro) {
    for (const s of [-1, 1]) {
      const j = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.95, P), matJ); j.position.set(x + s * 1.55, y0 + 1.925, zp + dir * P / 2); j.receiveShadow = true; g.add(j);
      fis.caja(x + s * 1.55, y0 + 1.925, zp + dir * P / 2, 0.7, 3.95, P, 0, { tipo: 'muro' });
    }
    const d = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.0, P), matJ); d.position.set(x, y0 + 3.7, zp + dir * P / 2); g.add(d);
  }
  const zf = zp + dir * (P + 0.15);
  for (const dx of [-1.25, 1.25]) { const p = caja(0.3, 3.5, 0.3, 0x6b4a2a); p.position.set(x + dx, y0 + 1.75, zf); g.add(p); }
  const din = caja(3.1, 0.32, 0.32, 0x6b4a2a); din.position.set(x, y0 + 3.36, zf); g.add(din);
  const umbral = caja(2.8, 0.12, 0.35, 0x5a3c22); umbral.position.set(x, y0 + 0.06, zf); umbral.castShadow = false; g.add(umbral);
  // dos hojas de madera entreabiertas hacia la sala: el vano ya no es un rectángulo blanco plano
  const mh = matMundo(texMadera(false), 2.5, 0xb89a78);
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(x + s * 1.15, y0, zf); piv.rotation.y = dir * s * abre;
    const hoja = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.3, 0.07), mh); hoja.position.set(-s * 0.55, 1.7, 0); hoja.castShadow = false; piv.add(hoja);
    const man = caja(0.05, 0.05, 0.14, 0x2a2a2a); man.position.set(-s * 1.0, 1.6, 0); piv.add(man);
    g.add(piv);
  }
}
function construirSala(S, k, fis, R) {
  const O = new THREE.Vector3(3000 + k * 300, 0, 0), g = new THREE.Group(); g.name = 'sala_' + S.id; g.visible = false;
  const W = S.ancho, L = S.largo, H = S.alto * (S.pisos || 1) + (S.pisos ? 0.4 : 0);
  // piso (con el hueco de la piscina si la hay)
  const ag = S.elementos.find(e => e.t === 'agua');
  const trozos = S.pisoHasta ? [[0, S.pisoHasta / 2, W, -S.pisoHasta]] : !ag ? [[0, -L / 2, W, L]] : [
    [0, (ag.z + ag.sz / 2) / 2, W, -(ag.z + ag.sz / 2)], [0, (ag.z - ag.sz / 2 - L) / 2, W, L + (ag.z - ag.sz / 2)],
    [(-W / 2 + ag.x - ag.sx / 2) / 2, ag.z, ag.x - ag.sx / 2 + W / 2, ag.sz], [(W / 2 + ag.x + ag.sx / 2) / 2, ag.z, W / 2 - ag.x - ag.sx / 2, ag.sz]];
  for (const [x, z, sx, sz] of trozos) {
    if (sx <= 0.01 || sz <= 0.01) continue;
    const m = S.roca ? malla(new THREE.BoxGeometry(sx, 1, sz), rocaSinMosaico(4, 0x9a8a7a))
      : S.pisoTapiz ? malla(new THREE.BoxGeometry(sx, 1, sz), matMundo(S.pisoTapiz === 'tablas' ? texMadera(false) : texMuroSala(S.pisoTapiz), S.pisoTapiz === 'tablas' ? 3 : 1.6))   // piso de tablas o baldosa
      : caja(sx, 1, sz, S.piso); m.position.set(O.x + x, -0.5, O.z + z); m.castShadow = false; g.add(m);
    fis.caja(O.x + x, -0.5, O.z + z, sx, 1, sz, 0, { tipo: 'piso' });
  }
  const muro = S.roca ? Object.assign(rocaSinMosaico(3.5, 0x8a7868), { side: THREE.DoubleSide })   // la mina: roca con textura (antes color plano)
    : S.tapiz ? Object.assign(matMundo(texMuroSala(S.tapiz), S.tapizEscala || 2.4), { side: THREE.DoubleSide })   // cine, palitroque, gimnasio, hospital: tapiz dibujado
    : mat(S.muro, { rough: 0.9, doble: true });
  for (const [x, z, sx, sz] of [[0, 0.5, W + 2, 1], [0, -L - 0.5, W + 2, 1], [-W / 2 - 0.5, -L / 2, 1, L], [W / 2 + 0.5, -L / 2, 1, L]]) {
    const yb = S.roca ? -12 : 0, m = new THREE.Mesh(new THREE.BoxGeometry(sx, H - yb, sz), muro); m.position.set(O.x + x, (H + yb) / 2, O.z + z); m.receiveShadow = true;
    if (!(S.roca && (sz === L || (S.tunelFondo && z < -L)))) g.add(m);   // tunelFondo (N1-FORTUNA-TUNEL2): el muro del fondo solo con física (detrás está el túnel de la vía) · en la mina los muros laterales los dibuja la roca irregular de mina.js (la física queda)
    fis.caja(O.x + x, (H + yb) / 2, O.z + z, sx, H - yb, sz, 0, { tipo: 'muro' });
  }
  const techo = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.5, L + 2), S.tapiz ? mat(S.techo ?? S.muro, { rough: 0.9, doble: true }) : muro); techo.position.set(O.x, H + 0.25, O.z - L / 2); if (!S.roca && !S.sinCielo) g.add(techo);   // sinCielo: el kit dibuja la bóveda y las cerchas (N2-C35)
  // zócalo de madera (o azulejo) a lo largo de los muros, cortado en las puertas, con moldura arriba
  if (S.zocalo) {
    const zh = S.zocalo.alto || 1.2, zt = 0.06, azu = S.zocalo.tex === 'azulejo';
    const zm = matMundo(azu ? texMuroSala('azulejo') : texMadera(false), azu ? 1.2 : 2.5), rem = mat(azu ? 0x6f8f7c : 0x4a2e18, { rough: 0.6 });
    const tramos = (a, b, hs) => { let r = [[a, b]]; for (const h of hs) r = r.flatMap(([u, v]) => [[u, Math.min(v, h - 2)], [Math.max(u, h + 2), v]]).filter(([p, q]) => q - p > 0.2); return r; };
    const puertas = [S.entrada, S.salida].filter(p => p && !(p.y > 0.5));
    const frente = puertas.filter(p => p.z > -1).map(p => p.x), fondo = puertas.filter(p => p.z <= -L + 3).map(p => p.x);
    const pieza = (x, z, sx, sz) => { const m = malla(new THREE.BoxGeometry(sx, zh, sz), zm, false); m.position.set(O.x + x, zh / 2, O.z + z); g.add(m);
      const r = malla(new THREE.BoxGeometry(sx + (sx > sz ? 0 : 0.06), 0.08, sz + (sz > sx ? 0 : 0.06)), rem, false); r.position.set(O.x + x, zh + 0.04, O.z + z); g.add(r); };
    for (const [u, v] of tramos(-W / 2, W / 2, frente)) pieza((u + v) / 2, -zt / 2, v - u, zt);
    for (const [u, v] of tramos(-W / 2, W / 2, fondo)) pieza((u + v) / 2, -L + zt / 2, v - u, zt);
    for (const s of [-1, 1]) pieza(s * (W / 2 - zt / 2), -L / 2, zt, L);
  }
  fis.caja(O.x, H + 0.25, O.z - L / 2, W + 2, 0.5, L + 2, 0, { tipo: 'techo' });
  let kg = null; if (S.kit) { kg = salaKit(S, O, fis); if (kg) g.add(kg); }   // N0-EMB (carril kit): mobiliario del kit (palitroque 106 según la foto)
  // luz de la sala (la mina y el cine, oscuros desde el primer cuadro)
  const luces = S.oscura ? [[0, -8], [0, -L * 0.6]] : [[0, -L * 0.25], [0, -L * 0.75]];
  // salas de dos pisos (hospital): una lámpara bajo el techo de cada piso (antes las dos quedaban sobre la losa del 2.º piso y el 1.º quedaba a oscuras)
  const techos = S.oscura || !S.pisos ? [H] : Array.from({ length: S.pisos }, (_, f) => f === S.pisos - 1 ? H : S.alto * (f + 1));
  for (const [x, z] of S.roca || (S.luzK === 0 && S.sinLamparas) ? [] : luces) for (const Ht of techos) {   // N4-HOSP2: con luzK 0 (la luz la pone el kit) no se crean luces apagadas: three.js las calcula igual en cada fragmento   // la mina: solo las 4 luces de las lámparas más cercanas (mina.js)
    const yl = S.oscura ? H - 1 : Ht - Math.min(1.9, S.alto * 0.35), l = new THREE.PointLight(S.oscura ? 0xffa860 : 0xfff3e0, (S.oscura ? 60 : techos.length > 1 ? 90 : 160) * (S.luzK ?? 1), S.oscura ? 22 : 40, 1.6); l.position.set(O.x + x, yl, O.z + z); g.add(l);
    if (!S.oscura && !S.sinLamparas) {   // lámpara colgante: cordón, pantalla de lata esmaltada y ampolleta (antes la luz pegada al techo lo quemaba en un manchón blanco)
      const cord = caja(0.03, Ht - yl - 0.25, 0.03, 0x222222); cord.position.set(O.x + x, (Ht + yl + 0.25) / 2, O.z + z); cord.castShadow = false; g.add(cord);
      const pan = malla(new THREE.ConeGeometry(0.55, 0.4, 16, 1, true), mat(0x2f4a3a, { rough: 0.5, metal: 0.3, doble: true }), false); pan.position.set(O.x + x, yl + 0.32, O.z + z); g.add(pan);
      const amp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c8 })); amp.position.set(O.x + x, yl + 0.16, O.z + z); g.add(amp);
    }
  }
  // la mina por dentro: marcos de entibación de madera, faroles con luz cálida y rieles (calidad GOTY de Fortuna)
  if (S.roca && S.oscura) {
    const madM = mat(0x4a3220, { rough: 0.95 }), madC = mat(0x372414, { rough: 0.95 });
    const tramo = (z, y0, alto) => {   // marco: dos postes pegados a los muros, dintel y dos tirantes en diagonal
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, alto, 0.42), madM); p.position.set(O.x + sx * (W / 2 - 0.45), y0 + alto / 2, O.z + z); p.castShadow = true; g.add(p);
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.3, 0.22), madC); t.position.set(O.x + sx * (W / 2 - 1.05), y0 + alto - 0.5, O.z + z); t.rotation.z = -sx * 0.7; g.add(t); }
      const d = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.5, 0.5), madM); d.position.set(O.x, y0 + alto + 0.15, O.z + z); d.castShadow = true; g.add(d);
    };
    vestirMina(S, g, fis, O);   // galería de roca irregular, entibación, piso de barro, galerías ciegas, cables y polvo (antes marcos de cajas con `tramo`)
    const farol = (x, y, z) => {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.6), madC); br.position.set(O.x + x - Math.sign(x) * 0.3, y + 0.4, O.z + z); br.rotation.y = Math.PI / 2; g.add(br);
      const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), new THREE.MeshBasicMaterial({ color: 0xffc468 })); cuerpo.position.set(O.x + x, y, O.z + z); g.add(cuerpo);
      const tapa = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 4), mat(0x1c1c1e)); tapa.position.set(O.x + x, y + 0.34, O.z + z); tapa.rotation.y = Math.PI / 4; g.add(tapa);
      const l = new THREE.PointLight(0xffa850, 20, 16, 1.7); l.position.set(O.x + x - Math.sign(x) * 0.6, y, O.z + z); l.castShadow = false; g.add(l);
    };
    if (!S.roca) { farol(-6.4, 3.4, -16); farol(6.4, 3.4, -28); }   // la mina usa las lámparas de carburo de mina.js (antes 4 faroles con luz propia)
  }
  // la luz del día entra por la puerta
  if (!S.sinPortal) portalSala(g, fis, O.x + (S.entrada.x || 0), S.entrada.y || 0, O.z - 0.01, -1, true, muro, S.roca ? Math.PI / 2 + 0.12 : 1.1);   // mina: hojas abiertas del todo, rectas (N1-M6: antes torcidas sobre el vano)
  // antorchas a cada lado de las puertas de las salas oscuras (pedido de Diego: en la mina no se veía la puerta de salida)
  if (S.oscura && !S.roca) for (const pu of [S.entrada, S.salida].filter(Boolean)) {   // en la mina van lámparas de carburo (los conos rosados eran estas antorchas)
    const y0 = pu.y || 0, zf = Math.max(pu.z, -L + 0.6);
    for (const dx of [-2.25, 2.25]) {   // a los lados del vano de la puerta
      const palo = caja(0.12, 0.7, 0.12, 0x4a3018); palo.position.set(O.x + pu.x + dx, y0 + 2.2, O.z + zf + (pu.z > -1 ? -0.4 : 0.4)); g.add(palo);
      const llama = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), mat(0xe86a12, { emisivo: 0xd85a08, brillo: 0.7 })); llama.position.set(palo.position.x, y0 + 2.75, palo.position.z); g.add(llama);
      const luz = new THREE.PointLight(0xffa050, 18, 11, 1.6); luz.position.set(palo.position.x, y0 + 2.9, palo.position.z + (pu.z > -1 ? -1.3 : 1.3)); g.add(luz);
    }
  }
  const sala = { id: S.id, nombre: S.nombre, grupo: g, origen: O, oscura: !!S.oscura, entrada: null, salida: null, specs: [], agua: [], ascensores: [], vagonetas: [], metas: [] };
  sala.entrada = { x: O.x + S.entrada.x, y: S.entrada.y || 0, z: O.z + S.entrada.z };
  if (kg && kg.userData.agua) sala.agua.push(...kg.userData.agua);   // N0-EMB9: piscina del kit (Teniente Club)
  if (kg && kg.userData.ascensor) sala.ascensores.push(kg.userData.ascensor);   // N4-HOSP2: ascensor de época del hospital del kit (kitHospital.js)
  if (S.salida) {
    sala.salida = { x: O.x + S.salida.x, y: S.salida.y || 0, z: O.z + S.salida.z };
    const enMuro = S.salida.z <= -L + 3;   // si no, la salida está en medio de la sala (balcón del gimnasio): solo marco
    portalSala(g, fis, sala.salida.x, sala.salida.y, enMuro ? O.z - L + 0.04 : sala.salida.z - 1.4, 1, enMuro, muro, S.roca ? Math.PI / 2 + 0.12 : 1.1);   // antes quedaba dentro del muro del fondo
  }
  for (const e of S.elementos) {
    if (e.t === 'caja') {
      // madera con tablas (literas) o cajón con marco (cajas de la anciana); antes eran cajas de un color liso
      const m = S.roca && e.color === COLOR.roca ? malla(new THREE.BoxGeometry(e.sx, e.sy, e.sz), matMundo('suelo_roca', 4, 0x9a8a7a))
        : e.tapiz ? malla(new THREE.BoxGeometry(e.sx, e.sy, e.sz), matMundo(texMuroSala(e.tapiz), e.escala || 2, e.color ?? 0xffffff))   // pista del palitroque, piso del hospital, etc.
        : (e.color ?? COLOR.madera) === COLOR.madera ? malla(new THREE.BoxGeometry(e.sx, e.sy, e.sz), maderaSala(e.sy >= 0.8 && Math.min(e.sx, e.sz) >= 0.8 && Math.max(e.sx, e.sz) <= 3))
        : caja(e.sx, e.sy, e.sz, e.color ?? COLOR.madera);
      m.position.set(O.x + e.x, e.y, O.z + e.z); if (!e.soloFis) g.add(m);   // soloFis: solo colisión (mina: roca maciza bajo Fortuna 4, detrás de la boca del túnel)
      fis.caja(O.x + e.x, e.y, O.z + e.z, e.sx, e.sy, e.sz, 0, { tipo: 'mueble' });
    } else if (e.t === 'pieza') {
      // G12 (16-11, F01 de C6): pieza de utilería (malla del índice o mueble FINO) en una sala: { t: 'pieza', id, x, y = 0, z, ry (grados), esc: [sx, sy, sz],
      // respaldo: [{ x, y, z, sx, sy, sz, sinFis }] } — las cajas de respaldo dan la colisión y se ven mientras la pieza no cargó (celular: carga diferida)
      const resp = new THREE.Group(); g.add(resp);
      for (const c of e.respaldo || []) {
        const m = malla(new THREE.BoxGeometry(c.sx, c.sy, c.sz), maderaSala(false)); m.position.set(O.x + c.x, c.y, O.z + c.z); resp.add(m);
        if (!c.sinFis) fis.caja(O.x + c.x, c.y, O.z + c.z, c.sx, c.sy, c.sz, 0, { tipo: 'mueble' });
      }
      const pu = precargarUtileria(); if (pu) pu.then(() => {
        const p = piezaGrupo(e.id, e.esc); if (!p) return;
        p.position.set(O.x + e.x, e.y || 0, O.z + e.z); p.rotation.y = (e.ry || 0) * Math.PI / 180; p.name = 'g12_' + e.id;
        p.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(p); resp.visible = false;
      });
    } else if (e.t === 'rampa') {
      const a = new THREE.Vector3(O.x + e.x, e.y0, O.z + e.z0), b = new THREE.Vector3(O.x + e.x, e.y1, O.z + e.z1);
      const d = b.clone().sub(a), f = d.clone().normalize(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.asin(f.y), Math.atan2(f.x, f.z), 0, 'YXZ'));
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), c = a.clone().addScaledVector(d, 0.5).addScaledVector(up, -0.3);
      fis.caja(c.x, c.y, c.z, e.ancho, 0.6, d.length(), 0, { tipo: 'escalera' }, { x: q.x, y: q.y, z: q.z, w: q.w });
      if (S.roca) escaleraMina(g, fis, a, b, e.ancho, q, O, S.ancho / 2);   // la mina: peldaños, largueros y baranda (antes una tabla naranja lisa)
      else { const m = caja(e.ancho, 0.6, d.length(), COLOR.madera); m.position.copy(c); m.quaternion.copy(q); g.add(m); }
    } else if (e.t === 'agua') {
      const y = 0, fondo = -e.hondo;
      const borde = mat(0x8fd0c8, { rough: 0.3 });
      // hoyo: se quita el piso con cuatro cajas alrededor (el piso general queda bajo el agua)
      const agua = new THREE.Mesh(new THREE.BoxGeometry(e.sx, e.hondo, e.sz), new THREE.MeshStandardMaterial({ color: 0x3fb8d8, transparent: true, opacity: 0.55, roughness: 0.75, metalness: 0 }));   // pulida (0,05 o 0,3), las dos lámparas sobre el eje de la piscina se reflejaban como una raya blanca a lo largo del carril del medio
      agua.position.set(O.x + e.x, -e.hondo / 2 + 0.02, O.z + e.z); g.add(agua);
      const fondoM = caja(e.sx, 0.4, e.sz, 0x6fc3d0); fondoM.position.set(O.x + e.x, fondo - 0.2, O.z + e.z); g.add(fondoM);
      fis.caja(O.x + e.x, fondo - 0.2, O.z + e.z, e.sx, 0.4, e.sz, 0, { tipo: 'piso' });
      // paredes de azulejo del pozo (antes no había: bajo el agua se veía negro), fondo de azulejo con carriles y borde de piedra blanca
      const az = matMundo(texMuroSala('azulejo'), 1.2), cx = O.x + e.x, cz = O.z + e.z, tw = 0.3;
      for (const [x, z, sx, sz] of [[0, e.sz / 2 + tw / 2, e.sx + 2 * tw, tw], [0, -e.sz / 2 - tw / 2, e.sx + 2 * tw, tw], [-e.sx / 2 - tw / 2, 0, tw, e.sz], [e.sx / 2 + tw / 2, 0, tw, e.sz]]) {
        const p = malla(new THREE.BoxGeometry(sx, e.hondo - 1, sz), az, false); p.position.set(cx + x, fondo + (e.hondo - 1) / 2, cz + z); g.add(p);
        fis.caja(cx + x, fondo + (e.hondo - 1) / 2, cz + z, sx, e.hondo - 1, sz, 0, { tipo: 'muro' });
        const b = caja(sx + (sx > sz ? 0.5 : 0.25), 0.1, sz + (sz > sx ? 0.5 : 0.25), 0xeeeae0, { rough: 0.6 }); b.position.set(cx + x * (1 + 0.12 / Math.max(Math.abs(x), 0.01)), 0.05, cz + z * (1 + 0.12 / Math.max(Math.abs(z), 0.01))); b.castShadow = false; g.add(b);
      }
      fondoM.material = matMundo(texMuroSala('azulejo'), 1.2);
      for (let k = -1; k <= 1; k++) { const c = caja(0.25, 0.02, e.sz - 1.5, 0x1f4a6a); c.position.set(cx + k * e.sx / 4, fondo + 0.01, cz); c.castShadow = false; g.add(c); }   // carriles
      sala.agua.push({ x0: O.x + e.x - e.sx / 2, x1: O.x + e.x + e.sx / 2, z0: O.z + e.z - e.sz / 2, z1: O.z + e.z + e.sz / 2, y: 0, fondo });
      sala.hueco = { x: O.x + e.x, z: O.z + e.z, sx: e.sx, sz: e.sz };
    } else if (e.t === 'rieles') {
      for (const d of [-0.5, 0.5]) g.add(rielTex(tubo(new THREE.Vector3(O.x + e.x + d, e.y + 0.1, O.z + e.z0), new THREE.Vector3(O.x + e.x + d, e.y + 0.1, O.z + e.z1), 0.06, 0x555555)));   // TEX: riel
      for (let z = Math.max(e.z0, e.z1) - 0.3; z > Math.min(e.z0, e.z1); z -= 0.8) { const d = piezaTex(new THREE.BoxGeometry(1.6, 0.1, 0.22), texMat('durmiente', 0xb8a08a)); d.position.set(O.x + e.x, e.y + 0.03, O.z + z); d.castShadow = false; g.add(d); }   // durmientes (TEX: madera gastada)
    } else if (e.t === 'pantalla') {
      // película muda proyectada, marco negro que tapa el borde (antes dentado) y frente de madera bajo la pantalla
      const p = new THREE.Mesh(new THREE.PlaneGeometry(e.sx, e.sy), new THREE.MeshBasicMaterial({ map: texPelicula(e.sx / e.sy), color: 0xeae4d4 })); p.position.set(O.x + e.x, e.y, O.z + e.z); g.add(p);
      for (const [x, y, sx, sy] of [[0, e.sy / 2 + 0.25, e.sx + 1, 0.5], [0, -e.sy / 2 - 0.25, e.sx + 1, 0.5], [-e.sx / 2 - 0.25, 0, 0.5, e.sy], [e.sx / 2 + 0.25, 0, 0.5, e.sy]]) {
        const m = caja(sx, sy, 0.14, 0x0d0a0a, { rough: 1 }); m.position.set(O.x + e.x + x, e.y + y, O.z + e.z + 0.07); m.castShadow = false; g.add(m);
      }
      const yb = e.y - e.sy / 2 - 0.5, fr = malla(new THREE.BoxGeometry(e.sx + 3, yb, 0.3), matMundo(texMadera(false), 1.5), false); fr.position.set(O.x + e.x, yb / 2, O.z + e.z + 0.15); g.add(fr);
    } else if (e.t === 'haz') {
      // haz del proyector: pirámide abierta del proyector a las esquinas de la pantalla, más clara junto al lente
      // (antes un cono de radio 4 que pasaba la pantalla y asomaba como octágono arriba y abajo)
      const a = [O.x + e.de[0], e.de[1], O.z + e.de[2]], bx = O.x + e.a[0], by = e.a[1], bz = O.z + e.a[2], hx = (e.sx || 18) / 2 * 0.97, hy = (e.sy || 7) / 2 * 0.95;
      // capas anidadas (cada una más angosta) para que el centro brille más y los bordes se esfumen (antes una lámina de bordes duros)
      const pos = [], col = [];
      for (const [s, k] of [[1, 0.35], [0.82, 0.5], [0.62, 0.7], [0.4, 0.9], [0.2, 1]]) {
        const esq = [[bx - hx * s, by - hy * s, bz], [bx + hx * s, by - hy * s, bz], [bx + hx * s, by + hy * s, bz], [bx - hx * s, by + hy * s, bz]];
        for (let i = 0; i < 4; i++) { pos.push(...a, ...esq[i], ...esq[(i + 1) % 4]); col.push(0.5 * k, 0.47 * k, 0.37 * k, 0.07 * k, 0.065 * k, 0.05 * k, 0.07 * k, 0.065 * k, 0.05 * k); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const haz = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      haz.renderOrder = 2; g.add(haz);
      // polvo en suspensión dentro del haz, que sube y baja despacio
      const pp = []; let sem = 17; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 260; i++) { const t = 0.08 + az() * 0.9, u = (az() * 2 - 1) * 0.85, v = (az() * 2 - 1) * 0.85; pp.push(a[0] + (bx - a[0]) * t + u * hx * t, a[1] + (by - a[1]) * t + v * hy * t, a[2] + (bz - a[2]) * t); }
      const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
      const polvo = new THREE.Points(gp, new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.05, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      polvo.onBeforeRender = () => { const t = performance.now() / 1000; polvo.position.set(Math.sin(t * 0.13) * 0.15, Math.sin(t * 0.21) * 0.12, 0); };
      g.add(polvo);
    } else if (e.t === 'proyector') {
      // cabina del proyector sobre la galería: repisa, cuerpo con lente encendido y dos carretes
      const x = O.x + e.x, y = e.y, z = O.z + e.z, md = matMundo(texMadera(false), 1.5);
      const rep = malla(new THREE.BoxGeometry(3, 0.2, 2.4), md); rep.position.set(x, y - 0.55, z + 0.6); g.add(rep);
      for (const s of [-1, 1]) { const m = malla(new THREE.BoxGeometry(0.12, 0.9, 0.12), md, false); m.position.set(x + s * 1.3, y - 1.1, z + 1.6); g.add(m); }   // ménsulas
      const cu = caja(0.7, 0.6, 1.0, 0x2b2b2e, { metal: 0.5, rough: 0.4 }); cu.position.set(x, y - 0.15, z + 0.5); g.add(cu);
      const le = malla(new THREE.CylinderGeometry(0.13, 0.16, 0.4, 12), mat(0x1a1a1a, { metal: 0.6, rough: 0.3 })); le.rotation.x = Math.PI / 2; le.position.set(x, y, z - 0.1); g.add(le);
      const luz = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshBasicMaterial({ color: 0xfff4d0 })); luz.position.set(x, y, z - 0.31); luz.rotation.y = Math.PI; g.add(luz);
      const carretes = []; for (const dz of [0.1, 0.95]) { const c = malla(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), mat(0x4a4a50, { metal: 0.6, rough: 0.4 })); c.rotation.z = Math.PI / 2; c.position.set(x, y + 0.6, z + dz); g.add(c); carretes.push(c); }
      // G9 (16-11): proyector de 35 mm de malla (G9 proyector_cine: cuerpo de fierro fundido, dos carretes, lente) sobre la repisa, lente hacia
      // la pantalla (−z); el disco de luz se corre a la boca del lente. Respaldo: cuerpo, lente y carretes de cajas y cilindros
      { const pu = precargarUtileria(); if (pu) pu.then(() => { const m = piezaGrupo('proyector_cine'); if (!m) return;
        m.position.set(x, y - 0.45, z + 0.5); m.rotation.y = Math.PI / 2; m.name = 'g9_proyector'; g.add(m); cu.visible = le.visible = false; for (const c of carretes) c.visible = false;
        luz.position.set(x, y + 0.2, z - 0.17); luz.scale.setScalar(0.6); }); }
    } else if (e.t === 'butacas') {
      // filas de butacas de terciopelo con respaldo y brazos de fierro sobre las gradas, con pasillo al centro (antes escalones rojos lisos)
      const aB = 0.62, mT = new THREE.MeshStandardMaterial({ map: texTerciopelo(), roughness: 0.95 }), mF = mat(0x2a2220, { metal: 0.5, rough: 0.5 }), lista = [];
      for (let i = 0; i < e.filas; i++) for (let x = -e.ancho / 2 + aB / 2; x <= e.ancho / 2 - aB / 2 + 1e-6; x += aB) if (Math.abs(x) > (e.pasillo || 0) / 2) lista.push([x, e.alto0 + e.dAlto * i, e.z0 - i * e.paso]);
      const n = lista.length, partes = [[new THREE.BoxGeometry(0.5, 0.14, 0.46), mT], [new THREE.BoxGeometry(0.52, 0.62, 0.1), mT], [new THREE.BoxGeometry(0.06, 0.6, 0.5), mF]].map(([geo, m]) => new THREE.InstancedMesh(geo, m, n));
      const M4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), qR = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, 0)), uno = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
      lista.forEach(([x, y, z], k) => {
        partes[0].setMatrixAt(k, M4.compose(v.set(O.x + e.x + x, y + 0.44, O.z + z - 0.15), q0, uno));
        partes[1].setMatrixAt(k, M4.compose(v.set(O.x + e.x + x, y + 0.8, O.z + z + 0.14), qR, uno));
        partes[2].setMatrixAt(k, M4.compose(v.set(O.x + e.x + x - aB / 2, y + 0.3, O.z + z - 0.05), q0, uno));
      });
      for (const m of partes) { m.frustumCulled = false; m.receiveShadow = true; g.add(m); }
      // C5 (T01): butaca_teatro FINA (terciopelo acolchado, costado de fierro fundido con voluta, brazo de madera), instanciada; las 3 cajas quedan de respaldo
      { const pu = precargarUtileria(); if (pu) pu.then(() => { const U = new Colocador();
        if (lista.every(([x, y, z]) => U.poner('butaca_teatro', O.x + e.x + x, y, O.z + z - 0.08, Math.PI, 0))) { U.armar(g); for (const m of partes) m.visible = false; } }); }
    } else if (e.t === 'telon') {
      // telón de terciopelo con pliegues a cada lado de la pantalla y bambalina arriba
      const mT = new THREE.MeshStandardMaterial({ map: texTerciopelo(), roughness: 0.95, side: THREE.DoubleSide });
      const pliegues = (w, h, np) => { const geo = new THREE.PlaneGeometry(w, h, np * 8, 1), p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w + 0.5) * np * Math.PI * 2) * 0.16); geo.computeVertexNormals(); return geo; };
      for (const s of [-1, 1]) { const c = malla(pliegues(e.lado, e.alto, 6), mT, false); c.position.set(O.x + e.x + s * (e.ancho / 2 + e.lado / 2 - 0.3), e.alto / 2, O.z + e.z); g.add(c); }
      const b = malla(pliegues(e.ancho + 2 * e.lado, e.bambalina, 16), mT, false); b.position.set(O.x + e.x, e.alto - e.bambalina / 2, O.z + e.z + 0.12); g.add(b);
    } else if (e.t === 'palos') {
      // diez palos torneados (blancos con franjas rojas en el cuello) en triángulo sobre su plataforma, con el foso y la cortina negra atrás
      const perfil = [[0, 0], [0.05, 0], [0.07, 0.06], [0.085, 0.14], [0.07, 0.24], [0.036, 0.31], [0.04, 0.36], [0.046, 0.41], [0.03, 0.45], [0, 0.46]].map(([r, y]) => new THREE.Vector2(r, y));
      const tp = texCanvas('palo', (c, n) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, n, n); c.fillStyle = '#b3202a'; c.fillRect(0, n * 0.3, n, n * 0.05); c.fillRect(0, n * 0.39, n, n * 0.03); }, 64);
      const geo = new THREE.LatheGeometry(perfil, 14), mp = new THREE.MeshStandardMaterial({ map: tp, roughness: 0.35 });
      let k = 0; if (!e.juega) for (let f = 0; f < 4; f++) for (let j = 0; j <= f; j++, k++) { const p = malla(geo, mp);   /* N2-C34: con juega los pinos son del bolero (boleroJuega.js) */ p.position.set(O.x + e.x + (j - f / 2) * 0.3, 0.1, O.z + e.z - f * 0.26); g.add(p); }
      const pl = malla(new THREE.BoxGeometry(2, 0.1, 2.2), matMundo(texMuroSala('pista'), 2), false); pl.position.set(O.x + e.x, 0.05, O.z + e.z - 0.4); g.add(pl);
      const foso = caja(2.2, 0.1, 0.8, 0x15110e); foso.position.set(O.x + e.x, 0.01, O.z + e.z - 1.9); foso.castShadow = false; g.add(foso);
      const cort = caja(2.4, 1.6, 0.08, 0x111015, { rough: 1 }); cort.position.set(O.x + e.x, 0.8, O.z + e.z - 2.35); g.add(cort);
      const dintel = malla(new THREE.BoxGeometry(2.6, 0.5, 0.2), matMundo(texMadera(false), 1.5)); dintel.position.set(O.x + e.x, 1.85, O.z + e.z - 2.3); g.add(dintel);
    } else if (e.t === 'cama') {
      // cama de hospital: catre de fierro blanco con cabecera de barrotes, colchón, sábana, frazada y almohada (antes caja blanca)
      const x = O.x + e.x, z = O.z + e.z, mF = mat(0xe8ece8, { metal: 0.4, rough: 0.4 }), L2 = 2, A = 0.95, n0 = g.children.length;   // n0: con e.y la cama sube a otro piso (hospital, 2.º piso)
      for (const dx of [-L2 / 2, L2 / 2]) for (const dz of [-A / 2, A / 2]) { const p = malla(new THREE.CylinderGeometry(0.03, 0.03, dx < 0 ? 1.05 : 0.75, 6), mF, false); p.position.set(x + dx, dx < 0 ? 0.525 : 0.375, z + dz); g.add(p); }
      for (let k = -2; k <= 2; k++) { const b = malla(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5), mF, false); b.position.set(x - L2 / 2, 0.78, z + k * A / 5); g.add(b); }   // barrotes
      for (const y of [0.55, 1.02]) { const t = caja(0.05, 0.05, A, 0xe8ece8, { metal: 0.4, rough: 0.4 }); t.position.set(x - L2 / 2, y, z); t.castShadow = false; g.add(t); }
      const col = caja(L2 - 0.05, 0.18, A - 0.05, 0xf4f4ee); col.position.set(x, 0.5, z); g.add(col);
      const fr = caja(L2 * 0.62, 0.05, A + 0.04, 0x8fa8c0, { rough: 1 }); fr.position.set(x + L2 * 0.18, 0.61, z); g.add(fr);   // frazada celeste
      const al = malla(new THREE.SphereGeometry(0.22, 10, 6), mat(0xffffff, { rough: 1 })); al.scale.set(1, 0.4, 1.6); al.position.set(x - L2 / 2 + 0.3, 0.66, z); g.add(al);
      for (let i = n0; i < g.children.length; i++) g.children[i].position.y += e.y || 0;
      fis.caja(x, 0.35 + (e.y || 0), z, L2, 0.7, A, 0, { tipo: 'mueble' });
    } else if (e.t === 'rayos') {
      // equipo de rayos X: gabinete, columna con brazo y tubo, camilla y negatoscopio en el muro con una radiografía
      const x = O.x + e.x, z = O.z + e.z, mG = mat(0x8a9a9a, { metal: 0.5, rough: 0.4 }), mO = mat(0x3a3f44, { metal: 0.6, rough: 0.35 });
      const gab = malla(new THREE.BoxGeometry(0.9, 1.2, 0.8), mG); gab.position.set(x + 0.5, 0.6, z); g.add(gab);
      const colm = malla(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 10), mO); colm.position.set(x - 0.6, 1.2, z); g.add(colm);
      const bra = malla(new THREE.BoxGeometry(1.1, 0.12, 0.12), mO); bra.position.set(x - 0.1, 2.1, z); g.add(bra);
      const tubo = malla(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 14), mG); tubo.rotation.z = Math.PI / 2; tubo.position.set(x + 0.3, 1.95, z); g.add(tubo);
      const cam = caja(1.9, 0.12, 0.7, 0xdfe5e2); cam.position.set(x + 0.2, 0.85, z - 0.9); g.add(cam);
      for (const dx of [-0.6, 0.9]) { const p = caja(0.08, 0.8, 0.08, 0x3a3f44); p.position.set(x + dx, 0.4, z - 0.9); g.add(p); }
      const rx = texCanvas('radiografia', (c, n) => { c.fillStyle = '#0d1418'; c.fillRect(0, 0, n, n); c.strokeStyle = 'rgba(210,230,240,0.75)'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(n / 2, n * 0.1); c.lineTo(n / 2, n * 0.9); c.stroke();   // columna
        for (let i = 0; i < 7; i++) { const y = n * (0.2 + i * 0.09); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(n / 2, y); c.quadraticCurveTo(n / 2 + s * n * 0.36, y - n * 0.02, n / 2 + s * n * 0.3, y + n * 0.1); c.stroke(); } }   // costillas
      }, 128);
      const neg = caja(1.1, 0.8, 0.06, 0xf0f0f0, { emisivo: 0xffffff, brillo: 0.4 }); neg.position.set(x + e.muro, 1.7, z); neg.rotation.y = Math.PI / 2; g.add(neg);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshBasicMaterial({ map: rx })); pl.position.set(x + e.muro - Math.sign(e.muro) * 0.04, 1.7, z); pl.rotation.y = -Math.sign(e.muro) * Math.PI / 2; g.add(pl);
      fis.caja(x + 0.5, 0.6, z, 0.9, 1.2, 0.8, 0, { tipo: 'mueble' });
    } else if (e.t === 'espaldera') {
      // espalderas de madera del gimnasio contra el muro (largueros y barrotes)
      const md = matMundo(texMadera(false), 1.5), x = O.x + e.x;
      for (let i = 0; i < e.n; i++) {
        const z = O.z + e.z - i * 1.1;
        for (const dz of [-0.45, 0.45]) { const p = malla(new THREE.BoxGeometry(0.1, 2.6, 0.08), md, false); p.position.set(x, 1.3, z + dz); g.add(p); }
        for (let k = 0; k < 10; k++) { const b = malla(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), md, false); b.rotation.x = Math.PI / 2; b.position.set(x, 0.25 + k * 0.25, z); g.add(b); }
      }
    } else if (e.t === 'banco') {
      // banco de madera con respaldo hacia el muro y patas (antes cajas blancas)
      const md = matMundo(texMadera(false), 1.5), s = Math.sign(e.x) || 1, x = O.x + e.x, z = O.z + e.z, lg = e.largo;
      const as = malla(new THREE.BoxGeometry(0.6, 0.08, lg), md); as.position.set(x, 0.48, z); g.add(as);
      const re = malla(new THREE.BoxGeometry(0.06, 0.5, lg), md); re.position.set(x + s * 0.32, 0.85, z); re.rotation.z = -s * 0.12; g.add(re);
      const tramos = Math.max(1, Math.round((lg - 0.6) / 1.6));
      const resp = [as, re];
      for (let i = 0; i <= tramos; i++) for (const dx of [-0.24, 0.24]) { const p = caja(0.07, 0.44, 0.07, 0x3a2614); p.position.set(x + dx, 0.22, z - lg / 2 + 0.3 + i * (lg - 0.6) / tramos); p.castShadow = false; g.add(p); resp.push(p); }
      fis.caja(x, 0.26, z, 0.6, 0.52, lg, 0, { tipo: 'mueble' });
      { const pu = precargarUtileria(); if (pu) pu.then(() => { const U = new Colocador();   // C5 (L02): banco_respaldo FINO (tablas, patas, brazos) escalado al largo; las cajas quedan de respaldo
        const nB = Math.max(1, Math.round(lg / 2.1)), lb = lg / nB; let ok = true;   // bancos de ~2 m seguidos (sin estirar patas ni brazos)
        for (let i = 0; i < nB; i++) ok = U.poner('banco_respaldo', x, 0, z - lg / 2 + (i + 0.5) * lb, -s * Math.PI / 2, 0, [(lb - 0.08) / 2, 1, 1]) && ok;
        if (ok) { U.armar(g); for (const m of resp) m.visible = false; } }); }
    } else if (e.t === 'ascensor') {
      sala.ascensores.push({ x: O.x + e.x, z: O.z + e.z, y0: e.y0, y1: e.y1 });
    } else {
      const mover = p => p && p.length === 2 ? [O.x + p[0], O.z + p[1]] : p;   // vagonetas: de/a también en coordenadas de la sala (antes quedaban en el mundo y nunca salía ninguna, N1-M8)
      sala.specs.push({ ...e, x: O.x + e.x, z: O.z + e.z, y: e.y ?? 0, ySala: true, sala: S.id, ...(e.de ? { de: mover(e.de), a: mover(e.a) } : {}) });
    }
  }
  return sala;
}
