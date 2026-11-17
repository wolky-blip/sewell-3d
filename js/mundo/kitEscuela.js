// N2-ESCUELA (carril interiores, 15-11-2026; decisión de Diego): el Edificio 129 deja de estar CERRADO.
//   salaEscuela(S, O, fis): Escuela Industrial de su época (N2 1920, N3 1940, N4 1967): hall con letrero, pasillo, salón de clases
//     (pupitres dobles de madera, pizarrón, tarima y escritorio del profesor, mapa y láminas, estufa) y taller mecánico (tornos, bancos
//     con tornillos de banco, tableros de herramientas, motores eléctricos de enseñanza, piezas de fundición). 1920/1940: tornos movidos
//     por eje de transmisión con correas; 1967: tornos con motor propio, cajas de mudanza y aviso de la Operación Valle.
//   salaMuseo(S, O, fis): modo turista = Museo de la Gran Minería del Cobre de hoy, en la misma planta: recepción, sala de historia
//     (paneles, vitrinas de minerales, maqueta de Sewell), pasillo de fotos y la sala de maquinaria pintada de amarillo (locomotora chica
//     con dos carros mineros sobre la vía, pala Eimco y perforadora jumbo), tarimas con cordón, rieles de focos.
// Planta común (local de construirSala: x a lo ancho, z de 0 en la entrada hacia −largo, y sobre el piso):
//   hall z 0…−5 (ancho completo) · salón x −7…3, z −5…−16 (tabique vidriado al pasillo, vano de 2 m en z −12,4…−14,4) ·
//   pasillo x 3…7, z −5…−16 · taller / gran sala z −16…−36 (puerta doble x 3,5…6,5 desde el pasillo y vano x −1…1 desde el salón).
//   Museo: vano x 0,4…2,4 entre la recepción y la sala 1 (N2-ESCUELA2).
// Mismas reglas anti parpadeo que kitHospital.js (R-7/R-8/R-9): nada coplanar del mismo lado entre materiales; polygonOffset por rango.
// Sin texturas de archivo: carteles en lienzo (kitHospital.js) y una malla por material (~45-55 mallas). 4 PointLight + ambiente.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';   // Q1: polea del eje con rayos
import { Junta, material } from './kitSewell.js';
import { texto, texCartel, texCalendario, cartel, mueble } from './kitHospital.js';
import { CEDULAS } from '../datos/turismo.js';
import { montarEnKit, texUtil, precargarUtileria } from './utileria.js';   // N0-UTIL3 (G4/G5): mallas TRELLIS con respaldo procedural   // N2-ESCUELA2: textos de las cédulas del museo

const R8 = !/[?&]r8=0/.test(globalThis.location?.search || '');
const xC = 3.0, zA = -5, zT = -16, tM = 0.14;   // tabique del pasillo, muro del hall, muro del taller, espesor de tabiques
const zPu0 = -12.4, zPu1 = -14.4, xPT0 = 3.5, xPT1 = 6.5;   // vano del salón (2 m, N2-ESCUELA2; antes puerta de 1 m) y puerta doble del taller
const xF0 = -1.0, xF1 = 1.0, xA0 = 0.4, xA1 = 2.4, hP = 2.9;   // N2-ESCUELA2: vano salón→taller, vano recepción→sala 1 (museo) y alto de los vanos

// ---------------------------------------------------------------- lienzos propios
function texPizarra(lineas) {
  return texto('pz:' + lineas.join('|'), 1024, 384, (c, w, h) => {
    c.fillStyle = '#26382e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`; c.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 90, 2 + Math.random() * 5); }   // borrones de tiza
    c.fillStyle = '#ecebe2'; c.textAlign = 'left'; c.textBaseline = 'top';
    lineas.forEach((l, i) => { c.font = (i === 0 ? 'italic bold 54px' : 'italic 42px') + ' Georgia, serif'; c.fillText(l, 60, 34 + i * 74); });
    c.strokeStyle = '#ecebe2'; c.lineWidth = 3; c.beginPath(); c.arc(860, 250, 70, 0, Math.PI * 2); c.moveTo(790, 250); c.lineTo(930, 250); c.stroke();   // un dibujo de engranaje / polea
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; c.beginPath(); c.moveTo(860 + Math.cos(a) * 70, 250 + Math.sin(a) * 70); c.lineTo(860 + Math.cos(a) * 88, 250 + Math.sin(a) * 88); c.stroke(); }
  });
}
function texMapaChile() {
  return texto('mapaChile', 256, 1024, (c, w, h) => {
    c.fillStyle = '#e9dfc3'; c.fillRect(0, 0, w, h); c.fillStyle = '#9cc2cf'; c.fillRect(14, 60, w - 28, h - 80);
    c.fillStyle = '#d9c38c'; c.beginPath(); c.moveTo(150, 70);   // la franja de Chile, de norte a sur
    const pts = [[150, 70], [168, 160], [160, 260], [154, 360], [146, 470], [138, 560], [130, 650], [118, 740], [108, 820], [96, 880], [120, 930], [150, 975], [70, 975], [40, 930], [60, 880], [74, 820], [86, 740], [100, 650], [110, 560], [118, 470], [124, 360], [128, 260], [130, 160]];
    for (const [x, y] of pts) c.lineTo(x, y); c.closePath(); c.fill(); c.strokeStyle = '#6a5430'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#c9b8a0'; c.fillRect(170, 70, 60, 900);   // Argentina, sin detalle
    c.fillStyle = '#8a1c1c'; c.beginPath(); c.arc(134, 560, 6, 0, 7); c.fill();   // Sewell / Rancagua
    c.fillStyle = '#2a2216'; c.font = 'bold 34px Georgia, serif'; c.textAlign = 'center'; c.fillText('CHILE', w / 2, 44);
    c.font = '16px Georgia, serif'; c.fillText('Sewell', 92, 562);
  });
}
const planoUtil = (m, n, rx = 1) => { const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil(n); if (!t) return; if (rx > 1) { t.wrapS = THREE.RepeatWrapping; const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * rx); uv.needsUpdate = true; } m.material.map = t; m.material.needsUpdate = true; }); };   // N0-UTIL3 (P2): textura de Qwen cuando carga el índice (respaldo: el lienzo procedural)
// C4 (P1): foto de Qwen dibujada DENTRO de un lienzo ya hecho (texto propio + foto): src = [x, y, w, h] del jpg (o null = recorte centrado que cubre),
// dst = [x, y, w, h] en el lienzo; fundido = px de transición por la izquierda (pizarrón). Respaldo: el lienzo tal cual si no hay índice o jpg.
function fotoEnLienzo(t, nombre, dst, src = null, fundido = 0) {
  const pu = precargarUtileria(); if (!pu || !t || !t.image) return;
  pu.then(() => { if (!texUtil(nombre)) return; const im = new Image();
    im.onload = () => { const [dx, dy, dw, dh] = dst; let [sx, sy, sw, sh] = src || [0, 0, im.width, im.height];
      if (!src) { const k = Math.max(dw / im.width, dh / im.height); sw = dw / k; sh = dh / k; sx = (im.width - sw) / 2; sy = (im.height - sh) / 2; }
      const c = t.image.getContext('2d'); c.save(); c.setTransform(1, 0, 0, 1, 0, 0);   // el lienzo del panel quedó con scale(1,5): dibujar en píxeles
      if (fundido > 0) { const o = document.createElement('canvas'); o.width = dw; o.height = dh; const x = o.getContext('2d'); x.drawImage(im, sx, sy, sw, sh, 0, 0, dw, dh);
        const gr = x.createLinearGradient(0, 0, fundido, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-in'; x.fillStyle = gr; x.fillRect(0, 0, dw, dh); c.drawImage(o, dx, dy); }
      else c.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
      c.restore(); t.needsUpdate = true; };
    im.src = 'assets3d/utileria/planos/' + nombre + '.jpg'; });
}
// C4 (P1): plano de Qwen en una malla con otra proporción: recorte centrado que cubre (aspecto = ancho/alto de la malla)
function planoCubre(m, nombre, aspecto) { const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil(nombre); if (!t) return;
  const ap = () => { const a = t.image.width / t.image.height; if (a > aspecto) { t.repeat.set(aspecto / a, 1); t.offset.set((1 - aspecto / a) / 2, 0); } else { t.repeat.set(1, a / aspecto); t.offset.set(0, (1 - a / aspecto) / 2); } t.needsUpdate = true; };
  if (t.image && t.image.width) ap(); else { const i0 = setInterval(() => { if (t.image && t.image.width) { clearInterval(i0); ap(); } }, 200); setTimeout(() => clearInterval(i0), 20000); }
  m.material.map = t; m.material.needsUpdate = true; }); }
function texTablero() {   // tablero de herramientas: siluetas pintadas y herramientas colgadas
  return texto('tableroHerr', 768, 320, (c, w, h) => {
    c.fillStyle = '#6d7a5c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a3a2a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    const silueta = (dib) => { c.save(); c.translate(5, 5); c.fillStyle = '#2e3426'; dib(); c.restore(); c.fillStyle = '#9aa0a4'; dib(); };
    for (let i = 0; i < 6; i++) { const x = 50 + i * 42; silueta(() => { c.fillRect(x - 6, 40, 12, 150 - i * 12); c.beginPath(); c.arc(x, 40, 16, 0, 7); c.fill(); }); }   // llaves de punta
    for (let i = 0; i < 3; i++) { const x = 340 + i * 70; silueta(() => { c.fillRect(x - 5, 60, 10, 160); c.fillStyle = c.fillStyle; c.fillRect(x - 28, 40, 56, 26); }); }   // martillos
    silueta(() => { c.fillRect(560, 60, 160, 50); });   // sierra de arco
    for (let i = 0; i < 5; i++) silueta(() => { c.fillRect(560 + i * 34, 150, 10, 130); });   // limas y destornilladores
    for (let i = 0; i < 4; i++) silueta(() => { c.beginPath(); c.arc(80 + i * 70, 260, 22, 0, 7); c.fill(); });   // rollos / calibres
  });
}
function texPanel(titulo, anio, cuerpo, foto = true) {   // panel de historia del museo: franja con el año, título, foto sepia y texto
  let rect = null;   // C4 (P1): rectángulo de la foto en el lienzo (para dibujar ahí la foto de Qwen)
  const t = texto('pn:' + titulo + anio, 768, 1020, (c) => {   // N2-ESCUELA2: lienzo ×1,5 (texto nítido de cerca), mismo dibujo en 512 × 680
    const w = 512, h = 680; c.scale(1.5, 1.5);
    c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c3550'; c.fillRect(0, 0, w, 120);
    c.fillStyle = '#f2c230'; c.font = 'bold 64px Arial, sans-serif'; c.textAlign = 'left'; c.fillText(anio, 28, 82);
    c.fillStyle = '#1c3550'; c.font = 'bold 34px Arial, sans-serif'; let y = 170;
    for (const l of titulo.split('\n')) { c.fillText(l, 28, y); y += 40; }
    if (foto) { rect = [28 * 1.5, y * 1.5, (w - 56) * 1.5, 210 * 1.5]; const g = c.createLinearGradient(0, y, 0, y + 220); g.addColorStop(0, '#b59a72'); g.addColorStop(1, '#6e5a3e'); c.fillStyle = g; c.fillRect(28, y, w - 56, 210);
      c.fillStyle = 'rgba(40,30,20,0.55)'; for (let i = 0; i < 9; i++) c.fillRect(40 + i * 50, y + 100 - (i % 3) * 22, 40, 110 + (i % 3) * 22);   // casas del campamento en la foto
      c.fillStyle = 'rgba(240,230,210,0.5)'; c.beginPath(); c.moveTo(28, y + 90); c.lineTo(180, y + 20); c.lineTo(320, y + 70); c.lineTo(w - 28, y + 30); c.lineTo(w - 28, y); c.lineTo(28, y); c.fill(); y += 240; }
    c.fillStyle = '#2a2a2a'; c.font = '25px Arial, sans-serif';
    const pal = cuerpo.split(' '); let l = '';
    for (const p of pal) { if (c.measureText(l + p).width > w - 56) { c.fillText(l, 28, y); y += 32; l = ''; } l += p + ' '; } c.fillText(l, 28, y);
  });
  if (rect) t.userData.foto = rect; return t;
}
function texMural() {   // corte de la mina El Teniente (sala de maquinaria)
  return texto('muralMina', 1024, 400, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fb4d4'); g.addColorStop(0.28, '#c9d6de'); g.addColorStop(0.3, '#7a5a40'); g.addColorStop(1, '#3a2a20'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4f2ee'; c.beginPath(); c.moveTo(0, 120); c.lineTo(180, 40); c.lineTo(300, 100); c.lineTo(470, 20); c.lineTo(640, 110); c.lineTo(820, 50); c.lineTo(w, 115); c.lineTo(w, 125); c.lineTo(0, 125); c.fill();
    c.strokeStyle = '#f2c230'; c.lineWidth = 6; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(80, 170 + i * 36); c.lineTo(w - 80, 170 + i * 36); c.stroke(); }   // niveles de la mina
    c.lineWidth = 4; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(130 + i * 95, 170); c.lineTo(130 + i * 95, 350); c.stroke(); }   // piques
    c.fillStyle = '#c05a2a'; c.beginPath(); c.ellipse(560, 250, 190, 80, 0, 0, 7); c.globalAlpha = 0.45; c.fill(); c.globalAlpha = 1;   // el cuerpo mineralizado
    c.fillStyle = '#fff'; c.font = 'bold 40px Arial, sans-serif'; c.textAlign = 'center'; c.fillText('EL TENIENTE · LA MINA SUBTERRÁNEA DE COBRE MÁS GRANDE DEL MUNDO', w / 2, 388);
  });
}

// N2-ESCUELA2: cédula del museo (título, año / origen, para qué servía) en lienzo de 1024 × 640: legible de cerca. La ficha completa
// (con el dato histórico) la abre «E: leer» (turismo.js) con los mismos textos (CEDULAS de js/datos/turismo.js).
function texCedula(id) {
  const d = CEDULAS[id];
  return texto('ced:' + id, 1024, 640, (c, w, h) => {
    c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, w, h); c.fillStyle = d.sobrio ? '#2b3036' : '#1c3550'; c.fillRect(0, 0, w, 132);
    c.fillStyle = d.sobrio ? '#e8e4da' : '#f2c230'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    let f = 62; c.font = `bold ${f}px Arial, sans-serif`; while (c.measureText(d.nombre.toUpperCase()).width > w - 70 && f > 30) { f -= 2; c.font = `bold ${f}px Arial, sans-serif`; }
    c.fillText(d.nombre.toUpperCase(), 36, 66 + f / 3);
    c.fillStyle = '#1c3550'; c.font = 'italic bold 34px Arial, sans-serif'; c.fillText(d.anio, 36, 184);
    let y = 184; if (d.origen) { c.font = 'italic 30px Arial, sans-serif'; c.fillText(d.origen, 36, y += 42); }
    c.fillStyle = '#f2c230'; c.fillRect(36, y + 18, 120, 6);
    c.fillStyle = '#222'; y += 50;
    const lineas = fz => { c.font = fz + 'px Arial, sans-serif'; const r = []; let l = ''; for (const p of d.uso.split(' ')) { if (c.measureText(l + p).width > w - 72) { r.push(l); l = ''; } l += p + ' '; } r.push(l); return r; };
    let fz = 44, L; while ((L = lineas(fz)).length * fz * 1.22 > h - 60 - y && fz > 26) fz -= 2;   // letra grande que llene la cédula sin salirse
    L.forEach((l, i) => c.fillText(l, 36, y + fz + i * fz * 1.22));
    c.fillStyle = '#1c3550'; c.font = 'bold 24px Arial, sans-serif'; c.textAlign = 'right'; c.fillText('E: LEER LA FICHA', w - 30, h - 24);
    c.strokeStyle = '#1c3550'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  });
}

// ---------------------------------------------------------------- estructura común: tabiques, vanos, ventanas
// N2-ESCUELA2 (15-11, pedido de Diego: «mejorar la distribución»): recorrido continuo a pie, sin puertas angostas.
//   hall → pasillo (4 m, abierto al hall) → salón por un vano de 2 m (hojas plegadas contra el tabique) → taller por un vano de 2 m
//   al fondo del salón → de vuelta al pasillo por la puerta doble de 3 m (hojas abiertas a 90° contra el taller) → hall.
//   Museo (k.frente): además un vano de 2 m entre la recepción y la sala 1. Todos los vanos de 2,9 m de alto (la cámara no choca el dintel).
// k = { muro, base, borde, vidrio, marco, dia, frente }: claves de material (cambian entre escuela y museo)
function estructura(J, F, S, k) {
  const hw = S.ancho / 2, L = S.largo, H = S.alto;
  // tramo macizo de un muro transversal (z fijo) de x a a x b, del piso a H (o de y0 a H: dintel)
  const muroX = (a, b, z, y0 = 0) => { J.caja(k.muro, (a + b) / 2, (y0 + H) / 2, z, b - a, H - y0 - 0.004, tM); F((a + b) / 2, (y0 + H) / 2, z, b - a, H - y0, tM + 0.02, 'muro'); };
  const marcoX = (a, b, z) => { for (const x of [a + 0.04, b - 0.04]) J.caja(k.marco, x, hP / 2, z, 0.1, hP, tM + 0.05); J.caja(k.marco, (a + b) / 2, hP + 0.02, z, b - a + 0.08, 0.1, tM + 0.05); };
  // muro del hall (z −5) de x −7 a 3: lleno en la escuela; en el museo con el vano de la recepción a la sala 1
  if (k.frente) { muroX(-hw + 0.005, xA0, zA); muroX(xA0, xA1, zA, hP); muroX(xA1, xC - tM / 2, zA); marcoX(xA0, xA1, zA); }
  else muroX(-hw + 0.005, xC, zA);
  // tabique del pasillo (x = 3): zócalo macizo hasta 1,1, vidriado hasta 2,3, macizo arriba; vano del salón (2 m)
  const zz = [[zA - tM / 2, zPu0], [zPu1, zT + tM / 2]];
  for (const [a, b] of zz) { J.caja(k.muro, xC, 0.55, (a + b) / 2, tM, 1.1, a - b); F(xC, 1.2, (a + b) / 2, tM + 0.02, 2.4, a - b, 'muro');
    J.caja(k.muro, xC, (2.3 + H) / 2, (a + b) / 2, tM, H - 2.3 - 0.004, a - b); F(xC, (2.3 + H) / 2, (a + b) / 2, tM + 0.02, H - 2.3, a - b, 'muro'); }
  J.caja(k.muro, xC, (hP + H) / 2, (zPu0 + zPu1) / 2, tM, H - hP - 0.004, zPu0 - zPu1); F(xC, (hP + H) / 2, (zPu0 + zPu1) / 2, tM + 0.02, H - hP, zPu0 - zPu1, 'muro');   // dintel
  J.caja(k.vidrio, xC, 1.7, (zA + zPu0) / 2 - 0.05, 0.012, 1.2, zA - zPu0 - 0.2);
  for (let z = zA - 0.08; z > zPu0; z -= 1.5) J.caja(k.marco, xC, 1.7, Math.max(z, zPu0 + 0.05), tM + 0.03, 1.2, 0.07);   // montantes
  for (const y of [1.12, 2.28]) J.caja(k.marco, xC, y, (zA + zPu0) / 2, tM + 0.04, 0.06, zA - zPu0 - 0.1);
  J.caja(k.vidrio, xC, 1.7, (zPu1 + zT) / 2, 0.012, 1.2, zPu1 - zT - 0.2); for (const y of [1.12, 2.28]) J.caja(k.marco, xC, y, (zPu1 + zT) / 2, tM + 0.04, 0.06, zPu1 - zT - 0.1);
  J.caja(k.marco, xC, 1.7, (zPu1 + zT) / 2, tM + 0.03, 1.2, 0.07);
  // marco del vano del salón y sus dos hojas abiertas del todo, plegadas contra el tabique por el lado del salón
  for (const z of [zPu0 - 0.04, zPu1 + 0.04]) J.caja(k.marco, xC, hP / 2, z, tM + 0.05, hP, 0.08); J.caja(k.marco, xC, hP + 0.02, (zPu0 + zPu1) / 2, tM + 0.05, 0.1, zPu0 - zPu1 + 0.08);
  for (const s of [1, -1]) { const z0 = s > 0 ? zPu0 : zPu1, zc = z0 + s * 0.52, x = xC - tM / 2 - 0.05;
    J.caja(k.puerta, x, 1.2, zc, 0.045, 2.4, 0.98); J.caja(k.vidrio, x - 0.004, 1.75, zc, 0.05, 0.7, 0.6); J.caja('laton', x - 0.04, 1.05, z0 + s * 0.9, 0.05, 0.05, 0.08); }
  // muro del taller (z −16): vano de 2 m desde el salón (xF0…xF1) y puerta doble de 3 m desde el pasillo (xPT0…xPT1)
  muroX(-hw + 0.005, xF0, zT); muroX(xF0, xF1, zT, hP); muroX(xF1, xPT0, zT); muroX(xPT0, xPT1, zT, hP); muroX(xPT1, hw - 0.005, zT);
  marcoX(xF0, xF1, zT); marcoX(xPT0, xPT1, zT);
  for (const s of [-1, 1]) {   // hojas de la puerta doble, abiertas a 90° hacia el taller (con colisión delgada: la cámara no las atraviesa)
    const x = s < 0 ? xPT0 + 0.06 : xPT1 - 0.06, zc = zT - tM / 2 - 0.76;
    J.caja(k.puerta, x, 1.35, zc, 0.05, 2.7, 1.42); J.caja(k.vidrio, x, 1.85, zc, 0.06, 0.7, 0.9); F(x, 1.35, zc, 0.1, 2.7, 1.42, 'mueble');
  }
  // ventanas en los muros exteriores (guillotina, marco blanco, cielo de la época)
  const ven = [[-1, -7.6], [-1, -10.6], [-1, -13.6], [1, -8.5], [1, -12.5], [-1, -19.5], [-1, -24], [-1, -28.5], [-1, -33], [1, -24], [1, -33]];
  const wv = 1.3, y0v = 1.4, y1v = 3.25;
  for (const [s, z] of ven) {
    const x = s * hw, yc = (y0v + y1v) / 2, hv = y1v - y0v;
    J.caja(k.dia, x - s * 0.02, yc, z, 0.01, hv, wv);
    for (const dz of [-1, 1]) J.caja(k.marcoV, x - s * 0.075, yc, z + dz * (wv / 2 + 0.05), 0.11, hv + 0.2, 0.1);
    J.caja(k.marcoV, x - s * 0.075, y1v + 0.1, z, 0.11, 0.12, wv + 0.3); J.caja(k.marcoV, x - s * 0.1, y0v - 0.05, z, 0.16, 0.06, wv + 0.36);
    J.caja(k.marcoV, x - s * 0.06, yc, z, 0.05, 0.06, wv); J.caja(k.marcoV, x - s * 0.055, yc, z, 0.04, hv, 0.04);
    for (const v of [0.31, 0.69]) J.caja(k.marcoV, x - s * 0.05, y0v + hv * v, z, 0.03, 0.03, wv);   // 6 paños por hoja, como la fachada
  }
  return ven;
}
function armarMallas(g, J, mats, O, prefijo, rangos) {
  if (R8) for (const [k, n] of Object.entries(rangos)) { let m = mats[k]; if (!m) continue; if (m.name?.startsWith('kit_')) m = mats[k] = m.clone(); m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -n * 8; }
  const gr = new THREE.Group(); gr.name = prefijo + '_mallas';
  for (const k of Object.keys(J.p)) { const geo = J.geometria(k); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = prefijo + '_' + k; m.receiveShadow = true; m.castShadow = false; if (mats[k]?.transparent) m.renderOrder = 2; gr.add(m); }
  gr.position.copy(O); g.add(gr);
  g.children.filter(o => o.name === 'hosp_cartel').forEach(o => o.position.add(O));
}
const T = (color, op = {}) => new THREE.MeshStandardMaterial({ color, roughness: op.r ?? 0.8, metalness: op.m ?? 0, side: op.doble ? THREE.DoubleSide : THREE.FrontSide, transparent: !!op.op, opacity: op.op ?? 1, depthWrite: !op.op, emissive: op.e ?? 0x000000 });

// ======================================================================================= Escuela Industrial
export function salaEscuela(S, O, fis) {
  const W = S.ancho, L = S.largo, H = S.alto, hw = W / 2, J = new Junta(), g = new THREE.Group(); g.name = 'kit_sala_escuela129';
  const anio = S.epoca || 1920, a67 = anio >= 1960, a20 = anio < 1930;
  const F = (x, y, z, sx, sy, sz, tipo = 'mueble') => fis.caja(O.x + x, O.y + y, O.z + z, sx, sy, sz, 0, { tipo });
  let sem = 129 + anio; const rnd = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  // N0-UTIL3 (G4): R(id, x, y, z, ry, esc) → Junta aparte con el respaldo procedural; montarEnKit pone la malla y lo oculta (patrón de kitHospital)
  let correasQ1 = null;   // Q1: correas de la malla del torno (se muestran al montar los tornos)
  const JBan = new Junta(); let banQ1 = null;   // Q1: paño de la bandera del hall (respaldo de cajas del plano bandera_chile)
  const RESP = new Map(), R = (id, x, y, z, ry = 0, esc) => { let e = RESP.get(id); if (!e) RESP.set(id, e = { JR: new Junta(), it: [] });
    e.it.push({ id, x: O.x + x, y: O.y + y, z: O.z + z, ry, esc }); return e.JR; };
  estructura(J, F, S, { muro: 'muroInt', vidrio: 'vidrio', marco: 'madera', marcoV: 'blanco', puerta: 'madera', dia: 'dia' });

  // ------------------------------------------------ zócalo de madera (friso de tablas, 1,1 m) en los muros del hall, salón y pasillo
  const friso = (ax, az, bx, bz) => { const lx = Math.abs(bx - ax), lz = Math.abs(bz - az); J.caja('friso', (ax + bx) / 2, 0.55, (az + bz) / 2, lx || 0.02, 1.1, lz || 0.02); J.caja('filete', (ax + bx) / 2, 1.12, (az + bz) / 2, lx || 0.04, 0.05, lz || 0.04); };
  friso(-hw + 0.012, -0.03, -hw + 0.012, zA + 0.08); friso(-hw + 0.012, zA - 0.08, -hw + 0.012, zT + 0.08);   // muro oeste: hall y salón
  friso(hw - 0.012, -0.03, hw - 0.012, zT + 0.08);                                                              // muro este: hall y pasillo
  friso(-hw + 0.02, -0.012, -1.65, -0.012); friso(1.65, -0.012, hw - 0.02, -0.012);                             // muro de la entrada
  friso(-hw + 0.02, zA + tM / 2 + 0.012, xC - tM / 2 - 0.01, zA + tM / 2 + 0.012);                               // hall, contra el salón
  friso(-hw + 0.02, zA - tM / 2 - 0.012, xC - tM / 2 - 0.01, zA - tM / 2 - 0.012);                               // salón, bajo el pizarrón
  friso(-hw + 0.02, zT + tM / 2 + 0.012, xF0 - 0.08, zT + tM / 2 + 0.012); friso(xF1 + 0.08, zT + tM / 2 + 0.012, xC - tM / 2 - 0.01, zT + tM / 2 + 0.012);   // salón, muro del fondo (cortado en el vano al taller)
  // piso de cemento del taller (2 cm sobre las tablas)
  J.caja('cemento', 0, 0.01, (zT - tM / 2 + -L) / 2, W - 0.01, 0.02, L + zT - tM / 2 - 0.01);

  // ------------------------------------------------ HALL: letrero, felpudo, perchero, banca, vitrina de piezas, diario mural, bandera, campana
  J.caja('goma', 0, 0.009, -1.6, 2.2, 0.018, 1.2);
  J.caja('madera', -1.6, 3.05, zA + tM / 2 + 0.03, 4.3, 0.95, 0.04);
  cartel(g, texCartel(['ESCUELA INDUSTRIAL', a20 ? 'BRADEN COPPER CO. · SEWELL' : a67 ? 'SOC. MINERA EL TENIENTE · SEWELL' : 'BRADEN COPPER CO. · SEWELL · 1940'], '#2a3f5a', '#f2e6c4', 900, 200), 4.1, 0.82, -1.6, 3.05, zA + tM / 2 + 0.058, 0);
  cartel(g, texCartel(['SALÓN DE CLASES'], '#f1eee4', '#2a3f5a', 512, 110), 1.3, 0.28, xC + tM / 2 + 0.02, 3.3, (zPu0 + zPu1) / 2, Math.PI / 2);   // sobre el vano del salón, lado pasillo
  { const p = mueble(R('perchero_cotona', -hw + 0.5, 0, -1.2, 0), -hw + 0.5, -1.2); /* C3b: perchero FINO con cotona y gorra */ p.c('madera', 0.03, 0.035, 1.8, 0, 0.9, 0, 8); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; p.b('madera', Math.cos(a) * 0.18, 0.04, Math.sin(a) * 0.18, 0.36, 0.05, 0.05, -a); }
    p.b('cotona', 0.12, 1.35, 0, 0.1, 0.7, 0.34); p.s('gorra', 0.12, 0, 1.84, 0, 1, 0.4, 1); F(-hw + 0.5, 0.9, -1.2, 0.45, 1.8, 0.45); }
  // banca larga junto al muro del salón (hall)
  { const p = mueble(R('banca_larga', -3.2, 0, zA + tM / 2 + 0.3, 0), -3.2, zA + tM / 2 + 0.3); /* C3b: banca FINA de caballetes */ for (let i = 0; i < 3; i++) p.b('madera', 0, 0.44, -0.12 + i * 0.12, 2.4, 0.035, 0.1); for (const dx of [-1.05, 1.05]) p.b('maderaOsc', dx, 0.21, 0, 0.06, 0.42, 0.34); F(-3.2, 0.45, zA + tM / 2 + 0.3, 2.4, 0.9, 0.42); }
  // vitrina de piezas hechas por los alumnos (engranajes, llaves, una maqueta de torno)
  { const X = hw - 0.4, Z = -2.6, p = mueble(R('vitrina_piezas', X, 0, Z, -Math.PI / 2), X, Z, -Math.PI / 2), w = 1.6;   // C3b: vitrina FINA (puertas con tableros, engranajes dentados, llaves)
    p.b('madera', 0, 0.45, 0, w, 0.9, 0.5); p.b('maderaOsc', 0, 0.92, 0, w + 0.05, 0.04, 0.54);
    p.b('vidrioR', 0, 1.45, 0, w - 0.06, 1.0, 0.46); for (const s of [-1, 1]) p.b('madera', s * (w / 2 - 0.02), 1.45, 0, 0.04, 1.0, 0.5); p.b('madera', 0, 1.97, 0, w + 0.04, 0.05, 0.52);
    for (let i = 0; i < 4; i++) { p.c('fierroB', 0.11 - i * 0.015, 0.11 - i * 0.015, 0.04, -0.55 + i * 0.36, 1.05, 0, 14, Math.PI / 2); p.c('fierroB', 0.03, 0.03, 0.06, -0.55 + i * 0.36, 1.05, 0, 8, Math.PI / 2); }
    for (let i = 0; i < 5; i++) p.b('fierroB', -0.6 + i * 0.3, 1.5, 0, 0.04, 0.02, 0.22); p.b('vidrioR', 0, 1.42, 0, w - 0.1, 0.012, 0.42);
    F(X, 1.0, Z, 0.55, 2.0, w + 0.05); }
  cartel(g, texCartel(['TRABAJOS DE LOS ALUMNOS'], '#f1eee4', '#2a3f5a', 512, 110), 1.2, 0.26, hw - 0.025, 2.35, -2.6, -Math.PI / 2);
  // diario mural (horario, avisos) en el muro oeste del hall
  J.caja('madera', -hw + 0.03, 2.0, -3.1, 0.04, 1.0, 1.5);
  cartel(g, texCartel(a67 ? ['OPERACIÓN VALLE', 'Las familias con casa asignada', 'retiren sus papeles en Bienestar', 'Matrículas 1968: Rancagua'] : ['HORARIO', 'Mañana: TALLER · 8 a 12', 'Tarde: CLASES · 14 a 17', 'Sábado: DIBUJO TÉCNICO'], '#f4efe2', '#1f3a2c', 512, 340), 1.3, 0.86, -hw + 0.072, 2.0, -3.1, Math.PI / 2);
  // bandera chilena en su asta (hall, junto al salón)
  { const x = 1.9, z = zA + tM / 2 + 0.45, JA = R('asta_bandera', x, 0, z, 0);   // G9M (E09): asta FINA (pie torneado, anillos y moharra de bronce); lo de abajo es su respaldo
    JA.add('madera', new THREE.CylinderGeometry(0.025, 0.03, 2.9, 8).translate(x, 1.45, z)); JA.add('laton', new THREE.SphereGeometry(0.05, 8, 6).translate(x, 2.93, z));
    JA.add('madera', new THREE.CylinderGeometry(0.18, 0.22, 0.12, 12).translate(x, 0.06, z));
    }
  { const x = 1.9, z = zA + tM / 2 + 0.45, piv = new THREE.Matrix4().makeRotationY(0.5).setPosition(x, 0, z);   // paño colgando (azul con estrella, blanco, rojo)
    const paño = (kk, px, py, sx, sy) => { const gg = new THREE.BoxGeometry(sx, sy, 0.01).translate(px, py, 0.012); gg.applyMatrix4(piv); JBan.add(kk, gg); };   // Q1: el paño de cajas es el respaldo
    paño('bandAzul', -0.2, 2.62, 0.3, 0.3); paño('bandBlanco', -0.55, 2.62, 0.4, 0.3); paño('bandRojo', -0.4, 2.31, 0.7, 0.3);
    const st = new THREE.CircleGeometry(0.06, 5).translate(-0.2, 2.62, 0.019); st.applyMatrix4(piv); JBan.add('bandBlanco', st); F(x, 1.4, z, 0.4, 2.8, 0.4);
    banQ1 = { x, z }; }
  // campana de mano sobre una mesita (la del inspector)
  { const p = mueble(J, 6.3, -4.45); p.b('madera', 0, 0.75, 0, 0.7, 0.04, 0.5); for (const [dx, dz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) p.b('maderaOsc', dx, 0.37, dz, 0.04, 0.74, 0.04);
    { const pc = mueble(R('campana', 6.3, 0.77, -4.45, 0, [1.15, 1.15, 1.15]), 6.3, -4.45); pc.c('laton', 0.02, 0.09, 0.14, 0, 0.84, 0, 12); pc.c('madera', 0.02, 0.02, 0.14, 0, 0.98, 0, 6); }   /* N0-UTIL3 (G8): campana de mano de malla */ p.b('papel', 0.2, 0.775, 0.05, 0.22, 0.012, 0.3, 0.2); F(6.3, 0.4, -4.45, 0.75, 0.8, 0.55); }   // N2-ESCUELA2: contra el muro (antes en la boca del pasillo)

  // ------------------------------------------------ PASILLO: percheros con cotonas, banca, láminas
  { const JP = R('percha_cotonas', hw - 0.02, 0, -6.6, -Math.PI / 2);   // C3b: percha FINA (tabla moldurada, ganchos dobles de bronce, cotonas con pliegues); las cajas quedan de respaldo
  for (let i = 0; i < 5; i++) { const z = -5.6 - i * 0.5; JP.caja('madera', hw - 0.03, 1.75, z, 0.03, 0.12, 0.08); JP.add('laton', new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6).rotateZ(Math.PI / 2).translate(hw - 0.1, 1.72, z));
    if (i !== 2) JP.caja(i % 2 ? 'cotona' : 'cotona2', hw - 0.12, 1.32, z, 0.09, 0.78, 0.36); }
  JP.caja('madera', hw - 0.035, 1.75, -6.6, 0.02, 0.06, 2.4); }
  { const p = mueble(R('banca_larga_2', hw - 0.3, 0, -14.8, -Math.PI / 2), hw - 0.3, -14.8, -Math.PI / 2); /* C3b */ for (let i = 0; i < 3; i++) p.b('madera', 0, 0.44, -0.12 + i * 0.12, 2.0, 0.035, 0.1); for (const dx of [-0.85, 0.85]) p.b('maderaOsc', dx, 0.21, 0, 0.06, 0.42, 0.34); F(hw - 0.3, 0.45, -14.8, 0.42, 0.9, 2.0); }
  cartel(g, texCartel(['TALLER MECÁNICO'], '#2a3f5a', '#f2e6c4', 640, 140), 1.9, 0.42, (xPT0 + xPT1) / 2, 3.35, zT + tM / 2 + 0.02, 0);
  cartel(g, texCartel(a20 ? ['ASEO · ORDEN', 'PUNTUALIDAD'] : ['EL ORDEN ES LA BASE', 'DE LA SEGURIDAD'], '#f1eee4', '#8a1c1c', 512, 180), 0.9, 0.32, hw - 0.025, 2.4, -10.5, -Math.PI / 2);
  cartel(g, texCalendario(anio, a67 ? 'NOVIEMBRE' : 'MARZO'), 0.32, 0.4, hw - 0.025, 1.95, -14.1, -Math.PI / 2);

  // ------------------------------------------------ SALÓN DE CLASES
  // tarima y escritorio del profesor
  J.caja('maderaOsc', (-hw + xC - tM / 2) / 2, 0.1, zA - tM / 2 - 0.85, xC - tM / 2 + hw - 0.02, 0.2, 1.7); F((-hw + xC) / 2, 0.1, zA - tM / 2 - 0.85, xC + hw, 0.2, 1.7, 'piso');
  { const X = -1.6, Z = zA - 1.25, p = mueble(J, X, Z, Math.PI, 0.2);   // frente local +z → −z (hacia los alumnos)
    p.b('madera', 0, 0.76, 0, 1.4, 0.05, 0.75); for (const s of [-1, 1]) p.b('maderaOsc', s * 0.5, 0.37, 0, 0.36, 0.74, 0.65); p.b('maderaOsc', 0, 0.55, 0.32, 0.64, 0.4, 0.02);
    for (const s of [-1, 1]) for (const y of [0.25, 0.5]) p.b('laton', s * 0.5, y, -0.33, 0.08, 0.02, 0.012);
    p.b('papel', -0.25, 0.795, 0.05, 0.3, 0.02, 0.22, 0.25); p.b('lomo', 0.3, 0.81, -0.1, 0.22, 0.05, 0.3); p.c('negro', 0.03, 0.035, 0.06, 0.1, 0.815, 0.2, 8);
    p.c('madera', 0.04, 0.06, 0.03, -0.5, 0.8, -0.1, 10); p.c('laton', 0.008, 0.008, 0.2, -0.5, 0.9, -0.1, 5); p.s('globo', 0.15, -0.5, 1.13, -0.1, 1, 1, 1, 16, 12); p.t('laton', 0.17, 0.008, -0.5, 1.13, -0.1);   // globo terráqueo
    p.b('madera', 0, 0.46, -0.55, 0.42, 0.04, 0.42); for (const [dx, dz] of [[-0.18, -0.37], [0.18, -0.37], [-0.18, -0.73], [0.18, -0.73]]) p.b('maderaOsc', dx, 0.23, dz, 0.035, 0.46, 0.035); p.b('madera', 0, 0.72, -0.75, 0.42, 0.5, 0.03);
    F(X, 0.6, Z, 1.45, 0.9, 0.8); }
  // pizarrón (en el muro del hall, mirando al salón), con repisa, tizas y borrador
  { const z = zA - tM / 2, x0 = -4.6, x1 = 0.4, xc = (x0 + x1) / 2, w = x1 - x0;
    J.caja('madera', xc, 1.85, z - 0.02, w + 0.16, 1.36, 0.04);
    { const tp = texPizarra(a20 ? ['Lección 12: el torno paralelo', '1 pulgada = 25,4 mm', 'Velocidad de corte: V = π · D · n'] : a67 ? ['Electrotecnia: ley de Ohm', 'V = I · R     P = V · I', 'Tarea: motor trifásico, pág. 84'] : ['Dibujo técnico: vistas', 'planta · elevación · perfil', 'Velocidad de corte: V = π · D · n']);
      cartel(g, tp, w, 1.2, xc, 1.85, z - 0.042, Math.PI); fotoEnLienzo(tp, 'pizarron', [600, 0, 424, 384], [330, 120, 640, 580], 150); }   // C4 (P1): dibujos de tiza de Qwen (engranaje y torno) a la derecha de la lección
    J.caja('maderaOsc', xc, 1.2, z - 0.07, w + 0.1, 0.04, 0.1); J.caja('tiza', xc - 1.2, 1.235, z - 0.08, 0.08, 0.02, 0.02); J.caja('tiza', xc - 1.0, 1.235, z - 0.09, 0.06, 0.02, 0.02); J.caja('maderaOsc', xc + 1.4, 1.25, z - 0.08, 0.18, 0.05, 0.06);
    // reloj sobre el pizarrón
    J.add('madera', new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20).rotateX(Math.PI / 2).translate(xc, 3.0, z - 0.03)); J.add('esfera', new THREE.CylinderGeometry(0.18, 0.18, 0.02, 20).rotateX(Math.PI / 2).translate(xc, 3.0, z - 0.06));
    J.caja('negro', xc, 3.05, z - 0.075, 0.015, 0.12, 0.008); J.caja('negro', xc + 0.05, 3.0, z - 0.078, 0.11, 0.012, 0.008, 0, 0, 0.4);
    // mapa de Chile y lámina, a la derecha del pizarrón
    J.caja('madera', 1.6, 3.12, z - 0.04, 0.85, 0.04, 0.04); J.caja('madera', 1.6, 0.88, z - 0.04, 0.85, 0.04, 0.04);
    planoCubre(cartel(g, texMapaChile(), 0.75, 2.2, 1.6, 2.0, z - 0.03, Math.PI), 'mapa_chile', 0.75 / 2.2);   // C4 (P1): mapa de Qwen
    { const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil('lamina_metrico'); if (!t) return;   // C4 (P1): lámina «Sistema métrico» entre el pizarrón y el escudo, colgada de dos varillas
      cartel(g, t, 0.55, 0.73, -5.22, 2.0, z - 0.03, Math.PI).position.add(O); const mv = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.6 });   // (armarMallas ya corrió: el cartel lleva O a mano)
      for (const dy of [0.375, -0.375]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.025, 0.025), mv); v.position.set(-5.22, 2.0 + dy, z - 0.035).add(O); g.add(v); } }); }
    cartel(g, texCartel(['ESCUDO', 'POR LA RAZÓN', 'O LA FUERZA'], '#f4efe2', '#2a3f5a', 256, 300), 0.45, 0.52, -6.0, 2.4, z - 0.02, Math.PI); }
  // pupitres dobles de madera (3 columnas × 5 filas), mirando al pizarrón (+z local → hacia z −5)
  const pupitre = (X, Z, i) => {
    const p = mueble(R(i % 3 !== 1 ? 'pupitre_doble' : 'pupitre_doble_b', X, 0, Z, Math.PI), X, Z, Math.PI), w = 1.15;   // C3: pupitre FINO con costados de fierro fundido (15 instancias; las cajas quedan de respaldo)
    p.b('madera', 0, 0.74, -0.05, w, 0.035, 0.42, 0, 0.18);                 // tapa inclinada
    p.b('madera', 0, 0.765, -0.29, w, 0.03, 0.1);                           // listón plano con los tinteros
    for (const dx of [-0.28, 0.28]) { p.c('negro', 0.022, 0.022, 0.02, dx, 0.785, -0.29, 8); p.c('laton', 0.027, 0.027, 0.006, dx, 0.778, -0.29, 8); }
    p.b('maderaOsc', 0, 0.55, -0.05, w - 0.06, 0.02, 0.36);                 // repisa de los libros
    for (const s of [-1, 1]) {   // costados de fierro fundido (patas unidas al banco)
      p.b('fierroN', s * (w / 2 - 0.03), 0.38, -0.05, 0.04, 0.76, 0.06); p.b('fierroN', s * (w / 2 - 0.03), 0.04, 0.12, 0.04, 0.05, 0.9);
      p.b('fierroN', s * (w / 2 - 0.03), 0.22, 0.3, 0.04, 0.44, 0.05); p.b('fierroN', s * (w / 2 - 0.03), 0.6, 0.47, 0.04, 0.4, 0.05, 0, -0.12);
    }
    for (let k = 0; k < 3; k++) p.b('madera', 0, 0.42, 0.25 + k * 0.1, w, 0.03, 0.085);   // asiento de listones
    for (const y of [0.66, 0.8]) p.b('madera', 0, y, 0.5 - (y - 0.6) * 0.12, w, 0.08, 0.025, 0, -0.12);   // respaldo
    if (i % 3 !== 1) { p.b('cuaderno', -0.25, 0.77, -0.02, 0.22, 0.015, 0.3, 0.1, 0.18); }
    if (i % 4 === 0) p.b('lomo', 0.28, 0.585, -0.05, 0.26, 0.05, 0.2);
    F(X, 0.45, Z - 0.1, w, 0.9, 1.0);
  };
  { let i = 0; for (const z of [-7.9, -9.3, -10.7, -12.1, -13.5]) for (const x of [-5.0, -2.25, 0.5]) pupitre(x, z, i++); }
  // estufa a leña (salamandra de fierro) con su cañón, cajón de leña
  { const X = -6.1, Z = -15.2, p = mueble(J, X, Z, 0);
    p.c('fierroN', 0.3, 0.3, 0.06, 0, 0.03, 0, 16); p.c('fierroN', 0.24, 0.27, 0.75, 0, 0.45, 0, 16); p.c('fierroN', 0.27, 0.24, 0.06, 0, 0.85, 0, 16); p.c('fierroN', 0.18, 0.24, 0.18, 0, 0.97, 0, 16);
    p.b('brasa', 0, 0.42, 0.25, 0.2, 0.14, 0.03); p.c('laton', 0.02, 0.02, 0.03, 0, 1.08, 0, 8);
    for (const a of [0.4, 2.5, 4.4]) p.c('fierroN', 0.022, 0.03, 0.12, Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2, 6);
    p.c('fierroN', 0.07, 0.07, H - 1.06 - 0.6, 0, (1.06 + H - 0.6) / 2, 0, 10); p.c('fierroN', 0.07, 0.07, 0.83, -0.42, H - 0.6, 0, 10, 0, Math.PI / 2);   // cañón hasta el muro
    p.b('madera', 0.7, 0.2, 0.15, 0.5, 0.4, 0.38); for (let k = 0; k < 6; k++) p.c('lena', 0.05, 0.05, 0.45, 0.6 + (k % 3) * 0.1, 0.43 + Math.floor(k / 3) * 0.08, 0.15, 7, 0, Math.PI / 2);
    F(X, 0.55, Z, 0.65, 1.1, 0.65); F(X + 0.7, 0.3, Z + 0.15, 0.55, 0.6, 0.42); }
  // armario de madera y láminas en el muro del fondo del salón
  { const X = -2.6, Z = zT + tM / 2 + 0.28, p = mueble(J, X, Z, 0); p.b('madera', 0, 1.05, 0, 1.4, 2.1, 0.5); for (const s of [-1, 1]) { p.b('maderaOsc', s * 0.34, 1.05, 0.255, 0.6, 1.9, 0.012); p.b('laton', s * 0.06, 1.1, 0.27, 0.03, 0.12, 0.02); } p.b('maderaOsc', 0, 2.12, 0, 1.5, 0.06, 0.56);
    p.b('lomo', -0.3, 2.25, 0, 0.5, 0.2, 0.3); F(X, 1.05, Z, 1.45, 2.15, 0.55); }
  cartel(g, texCartel(['SISTEMA MÉTRICO', '1 m = 100 cm = 1000 mm', '1 kg = 1000 g'], '#f4efe2', '#2a3f5a', 512, 300), 1.0, 0.58, 1.95, 2.0, zT + tM / 2 + 0.02, 0);   // N2-ESCUELA2: entre el vano al taller y el tabique
  cartel(g, texCartel(a20 ? ['LA MÁQUINA DE VAPOR', 'caldera · cilindro · biela'] : ['EL MOTOR ELÉCTRICO', 'estator · rotor · escobillas'], '#f4efe2', '#8a1c1c', 512, 300), 1.1, 0.64, 0, 3.45, zT + tM / 2 + 0.02, 0);   // sobre el vano al taller
  cartel(g, texCalendario(anio, a67 ? 'NOVIEMBRE' : 'MAYO'), 0.3, 0.38, -4.3, 2.0, zT + tM / 2 + 0.02, 0);
  // lámina del salón en el tabique del pasillo, lado salón (sobre el vidrio no: entre el vidrio y el cielo)
  cartel(g, texCartel(['SEGUNDO AÑO · MECÁNICA'], '#2a3f5a', '#f2e6c4', 640, 110), 1.8, 0.3, xC - tM / 2 - 0.02, 2.85, -9.5, -Math.PI / 2);

  // ------------------------------------------------ TALLER MECÁNICO
  const zTor = [-18.6, -22.6, -26.6, -30.6], xTor = -4.6, ejeY = 3.55, verdeMaq = a20 ? 'fierroN' : 'maquina';
  const torno = (Z, i) => {   // bancada a lo largo de z; el operario se para en +x (hacia el centro del taller)
    const Lb = 2.3, p = mueble(R(a67 ? 'torno_motor' : 'torno', xTor, 0, Z, Math.PI / 2, a67 ? [1.25, 1, 1] : [1.35, 1.1, 1.1]), xTor, Z, 0);   // N0-UTIL3: frente al taller (+x)
    for (const dz of [-Lb / 2 + 0.25, Lb / 2 - 0.25]) { p.b(verdeMaq, 0, 0.42, dz, 0.42, 0.84, 0.4); p.b(verdeMaq, 0, 0.03, dz, 0.55, 0.06, 0.5); }   // patas de gabinete
    p.b('fierroB', 0, 0.82, 0, 0.62, 0.04, Lb + 0.1);                       // bandeja de virutas
    p.b(verdeMaq, 0, 0.98, 0, 0.36, 0.28, Lb);                              // bancada
    p.b('acero', 0.1, 1.13, 0, 0.06, 0.02, Lb - 0.05); p.b('acero', -0.1, 1.13, 0, 0.06, 0.02, Lb - 0.05);   // guías
    p.b(verdeMaq, 0, 1.38, -Lb / 2 + 0.35, 0.46, 0.5, 0.6);                 // cabezal
    p.c('acero', 0.13, 0.13, 0.08, 0, 1.38, -Lb / 2 + 0.7, 14, Math.PI / 2); for (let k = 0; k < 3; k++) p.b('acero', Math.cos(k * 2.1) * 0.1, 1.38 + Math.sin(k * 2.1) * 0.1, -Lb / 2 + 0.72, 0.03, 0.03, 0.05);   // plato y mordazas
    p.c('fierroB', 0.035, 0.035, 0.6, 0, 1.38, -Lb / 2 + 1.0, 8, Math.PI / 2);   // pieza en el plato
    p.b(verdeMaq, 0, 1.3, Lb / 2 - 0.25, 0.3, 0.3, 0.4); p.c('acero', 0.03, 0.03, 0.25, 0, 1.38, Lb / 2 - 0.55, 8, Math.PI / 2); p.c('acero', 0.01, 0.01, 0.2, 0.18, 1.33, Lb / 2 - 0.2, 6, 0, Math.PI / 2);   // contrapunto y manivela
    p.b(verdeMaq, 0.05, 1.22, 0.1, 0.5, 0.16, 0.36); p.b('acero', 0.05, 1.33, 0.1, 0.16, 0.08, 0.16); p.c('acero', 0.08, 0.08, 0.03, 0.31, 1.18, 0.1, 12, 0, Math.PI / 2);   // carro, torre y volante
    p.c('acero', 0.012, 0.012, Lb - 0.2, 0.2, 0.9, 0, 6, Math.PI / 2);      // tornillo madre
    if (!a67) { for (let k = 0; k < 3; k++) p.c('fierroN', 0.16 - k * 0.04, 0.16 - k * 0.04, 0.08, 0, 1.78, -Lb / 2 + 0.25 + k * 0.08, 16, Math.PI / 2); }   // cono de poleas (movido por correa)
    else { p.c('motor', 0.14, 0.14, 0.32, -0.25, 0.55, -Lb / 2 + 0.25, 14, 0, Math.PI / 2); p.b('negro', -0.2, 0.75, -Lb / 2 + 0.25, 0.12, 0.08, 0.1); p.b('rojo', 0.21, 1.5, -Lb / 2 + 0.35, 0.02, 0.06, 0.06); }   // 1967: motor propio y botón de parada
    F(xTor, 0.75, Z, 0.7, 1.5, Lb + 0.1);
  };
  zTor.forEach(torno);
  if (!a67) {   // eje de transmisión con poleas y correas a cada torno; motor grande en la ménsula del fondo
    J.add('acero', new THREE.CylinderGeometry(0.04, 0.04, 18.4, 10).rotateX(Math.PI / 2).translate(xTor, ejeY, -26.3));
    for (const z of [-17.6, -21.6, -25.6, -29.6, -33.6]) { J.caja('fierroN', xTor, (ejeY + H) / 2, z, 0.06, H - ejeY, 0.12); J.caja('fierroN', xTor, ejeY + 0.06, z, 0.2, 0.16, 0.14); }   // colgadores
    for (const z of zTor) { const zp = z - 1.15 + 0.29, ap = 1.78, dy = ejeY - ap;
      RESP.get('torno').JR.add('fierroN', new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18).rotateX(Math.PI / 2).translate(xTor, ejeY, zp));   // Q1: la polea del eje del respaldo también va con el respaldo
      for (const s of [-1, 1]) RESP.get('torno').JR.caja('correa', xTor + s * 0.2, ap + dy / 2, zp, 0.02, dy, 0.07); }   // N0-UTIL3: correas con el respaldo (Q1 las rehace hacia la polea de la malla)
    // Q1 (16-11): correas de la malla del torno. Con el giro 90° y la escala [1,35, 1,1, 1,1] el cono de poleas de la malla queda hacia +z:
    // centro (x −0,091, y 1,06, z +0,844) del torno, radio ~0,16. Polea con rayos en el eje (gira) y dos tramos de correa de cuero tangentes
    // (la textura corre: un tramo sube y el otro baja). Se muestran solo si TODOS los tornos quedaron de malla (si no, queda el respaldo).
    { const gC = new THREE.Group(); gC.name = 'esc_q1_correas'; gC.visible = false; gC.position.copy(O); g.add(gC); correasQ1 = gC;
      const tex = texto('correaQ1', 16, 64, (c, w, h) => { c.fillStyle = '#5c3b24'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(30,18,10,0.85)'; c.fillRect(0, 0, w, 5); c.fillStyle = 'rgba(160,120,80,0.35)'; c.fillRect(2, 20, w - 4, 2); c.fillRect(2, 44, w - 4, 2); });
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const mC = new THREE.MeshStandardMaterial({ map: tex, color: 0xb08a6a, roughness: 0.8 }), mP = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.55, metalness: 0.5 }), JK = new Junta(), rP = 0.22, rT = 0.155;
      const tramo = (a, b, inv) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0), L = d.length(), gt = new THREE.BoxGeometry(0.012, L, 0.07), uv = gt.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, (inv ? 1 - uv.getY(i) : uv.getY(i)) * L * 2);
        gt.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); gt.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2]); JK.add('c', gt); };
      const poleas = new THREE.InstancedMesh(mergeGeometries([new THREE.CylinderGeometry(rP, rP, 0.1, 20).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10).rotateX(Math.PI / 2),
        ...[0, 1, 2, 3].map(k => new THREE.BoxGeometry(0.03, rP * 1.9, 0.03).rotateZ(k * Math.PI / 4).translate(0, 0, 0.06))], false), mP, zTor.length);
      poleas.name = 'esc_q1_poleas'; gC.add(poleas);
      const zQ = zTor.map(z => z + 0.844), xT = xTor - 0.091, yT = 1.06;
      zQ.forEach(zq => { tramo([xTor + rP, ejeY, zq], [xT + rT, yT, zq], false); tramo([xTor - rP, ejeY, zq], [xT - rT, yT, zq], true); });
      const mk = new THREE.Mesh(JK.geometria('c'), mC); mk.name = 'esc_q1_correa'; gC.add(mk);
      const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Z3 = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3(), uno = new THREE.Vector3(1, 1, 1);
      const girar = t => { q.setFromAxisAngle(Z3, (t / 1000 * 5.5) % (Math.PI * 2)); zQ.forEach((zq, i) => poleas.setMatrixAt(i, M4.compose(v.set(xTor, ejeY, zq), q, uno))); poleas.instanceMatrix.needsUpdate = true; };
      let t0 = performance.now();
      mk.onBeforeRender = () => { const t = performance.now(), dt = Math.min(0.1, (t - t0) / 1000); t0 = t; tex.offset.y -= 5.5 * rP * dt * 2; girar(t); };   // polea a 5,5 rad/s; la correa corre a ω·r
      girar(t0); poleas.computeBoundingSphere(); poleas.frustumCulled = false;
    }
    J.add('motor', new THREE.CylinderGeometry(0.28, 0.28, 0.6, 16).rotateZ(Math.PI / 2).translate(xTor + 0.2, ejeY - 0.05, -35.2)); J.caja('fierroN', xTor + 0.2, ejeY - 0.38, -35.2, 0.7, 0.06, 0.6);
    J.caja('fierroN', xTor + 0.2, ejeY - 0.38 - 0.4, -L + 0.06, 0.08, 0.8, 0.08, 0, 0.6);
  }
  // taladro de columna junto al muro del fondo
  { const X = -5.6, Z = -34.6, p = mueble(R('taladro', X, 0, Z, Math.PI / 2, [1, 1.1, 1]), X, Z, Math.PI / 2);   // N0-UTIL3
    p.b(verdeMaq, 0, 0.04, 0, 0.6, 0.08, 0.5); p.c('acero', 0.05, 0.05, 1.8, 0, 0.9, -0.15, 10); p.b(verdeMaq, 0, 0.75, 0.05, 0.4, 0.04, 0.35);
    p.b(verdeMaq, 0, 1.75, 0, 0.3, 0.32, 0.55); p.c('acero', 0.02, 0.012, 0.25, 0, 1.47, 0.12, 6); p.c('motor', 0.12, 0.12, 0.3, 0, 1.98, -0.12, 12, 0, Math.PI / 2);
    for (let k = 0; k < 3; k++) p.c('acero', 0.008, 0.008, 0.28, 0.14, 1.7, 0.1 + k * 0.03, 5, 0, -0.8 + k * 0.8);
    F(X, 1.0, Z, 0.6, 2.0, 0.6); }
  // bancos de trabajo con tornillos de banco contra el muro este, tableros de herramientas encima
  for (const [z0, z1] of [[-18.0, -23.4], [-25.0, -31.6]]) {   // N2-ESCUELA2: el 1.º empieza tras la hoja abierta de la puerta doble
    const zc = (z0 + z1) / 2, lb = z0 - z1, X = hw - 0.45, JB = R(lb > 6 ? 'banco_trabajo_b' : 'banco_trabajo_a', X, 0, zc, -Math.PI / 2);   // C3b: banco FINO de tablones con tornillos de banco de fierro fundido; las cajas quedan de respaldo
    JB.caja('madera', X, 0.84, zc, 0.85, 0.08, lb); JB.caja('maderaOsc', X, 0.3, zc, 0.75, 0.04, lb - 0.2);
    for (const z of [z0 - 0.15, zc, z1 + 0.15]) for (const dx of [-0.35, 0.35]) JB.caja('maderaOsc', X + dx, 0.4, z, 0.08, 0.8, 0.08);
    for (let z = z0 - 0.8; z > z1 + 0.4; z -= 1.5) {   // tornillo de banco
      JB.caja('fierroN', X - 0.3, 0.95, z, 0.18, 0.14, 0.2); JB.caja('fierroN', X - 0.46, 0.98, z, 0.06, 0.2, 0.22); JB.caja('acero', X - 0.39, 1.04, z, 0.12, 0.03, 0.22);
      JB.add('acero', new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6).rotateX(Math.PI / 2).translate(X - 0.52, 0.94, z)); JB.add('acero', new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6).rotateZ(Math.PI / 2).translate(X - 0.55, 0.94, z));
    }
    for (let k = 0; k < 4; k++) { const z = z0 - 0.5 - k * 1.5 - rnd() * 0.4; JB.caja('fierroB', X - 0.1 + rnd() * 0.2, 0.9, z, 0.08, 0.04, 0.22, rnd()); JB.caja('acero', X + 0.05, 0.895, z - 0.4, 0.03, 0.03, 0.25, rnd()); }   // piezas y limas sueltas
    F(X, 0.5, zc, 0.95, 1.0, lb);
    J.caja('madera', hw - 0.025, 1.85, zc, 0.03, 1.1, lb - 0.6);
    planoUtil(cartel(g, texTablero(), lb - 0.8, 1.0, hw - 0.05, 1.85, zc, -Math.PI / 2), z0 > -20 ? 'tablero_herr1' : 'tablero_herr2', Math.max(1, Math.round((lb - 0.8) / 1.33)));   // N0-UTIL3 (P2): foto de Qwen repetida a lo largo (4:3 por tramo)
  }
  // motores eléctricos de enseñanza en una mesa al centro (uno abierto, con el bobinado de cobre a la vista)
  { const X = 1.0, Z = -27.0, p = mueble(J, X, Z, 0);
    p.b('madera', 0, 0.82, 0, 1.0, 0.06, 2.6); for (const [dx, dz] of [[-0.42, -1.2], [0.42, -1.2], [-0.42, 1.2], [0.42, 1.2]]) p.b('maderaOsc', dx, 0.4, dz, 0.08, 0.8, 0.08);
    for (const [dz, abierto] of [[-0.8, false], [0, true], [0.85, false]]) {
      const p = mueble(R(abierto ? 'motor_abierto' : 'motor_cerrado', X, 0.85, Z + dz, Math.PI / 2, [0.9, 0.9, 0.9]), X, Z, 0);   // N0-UTIL3: cada motor = malla (eje en x)
      p.b('fierroN', 0, 0.88, dz, 0.36, 0.06, 0.32);
      if (!abierto) { p.c('motor', 0.15, 0.15, 0.36, 0, 1.06, dz, 16, 0, Math.PI / 2); for (let k = 0; k < 5; k++) p.c('motor', 0.16, 0.16, 0.02, -0.14 + k * 0.07, 1.06, dz, 16, 0, Math.PI / 2); }
      else { p.t('cobre', 0.12, 0.035, -0.08, 1.06, dz, Math.PI / 2); p.t('cobre', 0.12, 0.035, 0.08, 1.06, dz, Math.PI / 2); p.c('acero', 0.06, 0.06, 0.3, 0, 1.06, dz, 12, 0, Math.PI / 2); p.c('motor', 0.15, 0.15, 0.03, -0.17, 1.06, dz, 16, 0, Math.PI / 2); }
      p.c('acero', 0.015, 0.015, 0.14, 0.24, 1.06, dz, 6, 0, Math.PI / 2); p.c('fierroB', 0.06, 0.06, 0.04, 0.3, 1.06, dz, 12, 0, Math.PI / 2);
      p.b('negro', -0.05, 1.22, dz, 0.1, 0.05, 0.08); }
    for (let k = 0; k < 2; k++) p.c('cobre', 0.004, 0.004, 0.8, -0.3, 0.86, -0.4 + k * 0.6, 4, Math.PI / 2);   // cables
    F(X, 0.6, Z, 1.05, 1.2, 2.65); }
  // tablero eléctrico de mármol con cuchillos (muro del fondo), y piezas de fundición
  { const z = -L + 0.02, J = R('tablero_marmol', 0, 1.08, z + 0.07, 0, [1.2, 0.8, 0.4]);   // N0-UTIL3: tablero = malla (1,2 × 1,44 × 0,12 m)
    J.caja('marmol', 0.0, 1.8, z + 0.03, 1.2, 1.4, 0.04);
    for (let i = 0; i < 3; i++) { const x = -0.35 + i * 0.35; J.caja('negro', x, 2.2, z + 0.07, 0.16, 0.12, 0.04); J.caja('cobre', x, 2.12 - 0.16, z + 0.12, 0.03, 0.32, 0.03, 0, 0.5); J.caja('negro', x, 1.55, z + 0.07, 0.16, 0.12, 0.04); }
    J.add('esfera', new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16).rotateX(Math.PI / 2).translate(0.35, 1.4, z + 0.08));
    cartel(g, texCartel(['¡PELIGRO!', 'ALTA TENSIÓN'], '#f2c230', '#1b1c1e', 384, 200), 0.5, 0.26, 0, 2.7, z + 0.012, 0); }
  { const X = 3.4, Z = -34.6;   // tarima de piezas de fundición: engranajes, poleas, una caja de moldeo con arena
    J.caja('madera', X, 0.07, Z, 1.6, 0.14, 1.1);
    for (const [dx, dz, r, rueda] of [[-0.45, -0.2, 0.32, true], [0.2, 0.15, 0.24, true], [0.45, -0.25, 0.2, false], [-0.2, 0.3, 0.18, false]]) {
      const e = rueda ? 2 * (r + 0.03) / 0.5 : 2 * r / 0.45, J = R(rueda ? 'engranaje' : 'polea', X + dx, 0.14, Z + dz, rnd() * 6.28, [e, rueda ? 1.25 : 0.85, e]);   // N0-UTIL3: engranajes y poleas = mallas
      J.add('fundicion', new THREE.CylinderGeometry(r, r, 0.1, rueda ? 20 : 16).translate(X + dx, 0.19, Z + dz)); J.add('fierroB', new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.16, 10).translate(X + dx, 0.2, Z + dz));
      if (rueda) for (let k = 0; k < 14; k++) { const a = k * Math.PI / 7; J.caja('fundicion', X + dx + Math.cos(a) * (r + 0.03), 0.19, Z + dz + Math.sin(a) * (r + 0.03), 0.06, 0.1, 0.05, -a); }
    }
    R('engranaje', X - 0.45, 0.25, Z - 0.2, 0.7, [1.2, 1.5, 1.2]).add('fundicion', new THREE.CylinderGeometry(0.3, 0.3, 0.12, 20).translate(X - 0.45, 0.31, Z - 0.2)); F(X, 0.25, Z, 1.6, 0.5, 1.1);   // N0-UTIL3
    const p = mueble(R('caja_moldeo', X - 1.9, 0, Z + 0.2, 0, [1.15, 1.3, 1.1]), X - 1.9, Z + 0.2);   // N0-UTIL3 p.b('madera', 0, 0.2, 0, 0.7, 0.4, 0.5); p.b('arena', 0, 0.395, 0, 0.62, 0.02, 0.42); p.b('madera', 0, 0.55, 0, 0.7, 0.3, 0.5); p.b('arena', 0.0, 0.6, 0, 0.6, 0.22, 0.4);   // caja de moldeo abierta
    p.c('fierroN', 0.13, 0.1, 0.24, 0.6, 0.12, 0.3, 12); F(X - 1.9, 0.4, Z + 0.2, 0.75, 0.8, 0.55); }
  // estante con piezas fundidas y mecanizadas (muro del fondo, a la izquierda del tablero)
  { const X = -2.6, Z = -L + 0.3, p = mueble(R('estante_fundicion', X, 0, Z, 0), X, Z, 0);   // C3b: estante FINO con escuadras y piezas fundidas
    for (const y of [0.05, 0.6, 1.15, 1.7]) p.b('madera', 0, y, 0, 1.8, 0.04, 0.45); for (const dx of [-0.88, 0.88]) p.b('maderaOsc', dx, 0.9, 0, 0.05, 1.8, 0.45);
    for (let k = 0; k < 10; k++) { const y = [0.6, 1.15, 1.7][k % 3], dx = -0.7 + (k * 0.157) % 1.4; if (k % 2) p.c('fundicion', 0.1, 0.1, 0.06, dx, y + 0.05, 0, 14); else p.b('fierroB', dx, y + 0.08, 0, 0.18, 0.12, 0.12); }
    F(X, 0.9, Z, 1.85, 1.8, 0.48); }
  // carteles del taller
  cartel(g, texCartel(a20 ? ['CUIDE SUS HERRAMIENTAS'] : ['USE ANTEOJOS', 'EN EL TORNO'], '#f1eee4', '#8a1c1c', 512, 150), 1.2, 0.36, -hw + 0.025, 3.55, -21.3, Math.PI / 2);
  cartel(g, texCartel(['TALLER MECÁNICO', a20 ? 'AJUSTE · TORNERÍA · FUNDICIÓN' : 'TORNERÍA · AJUSTE · ELECTRICIDAD'], '#2a3f5a', '#f2e6c4', 768, 200), 2.4, 0.62, 0, 3.45, zT - tM / 2 - 0.02, Math.PI);

  // ------------------------------------------------ 1967: cajas de mudanza (Operación Valle) en el hall
  if (a67) {
    for (const [x, y, z, sx, sy, sz, r] of [[-5.6, 0.25, -2.4, 0.6, 0.5, 0.5, 0.1], [-5.6, 0.71, -2.35, 0.5, 0.42, 0.45, -0.15], [-4.85, 0.22, -2.0, 0.5, 0.44, 0.45, 0.3], [6.5, 0.22, -9.3, 0.55, 0.44, 0.45, 0.2]]) {
      const JC = R('caja_mudanza', x, y - sy / 2, z, r, [sx / 0.6, sy / 0.45, sz / 0.45]); JC.caja('carton', x, y, z, sx, sy, sz, r); JC.caja('cinta', x, y + sy / 2 + 0.004, z, 0.08, 0.008, sz + 0.004, r); }   // N0-UTIL3 (G8): cajas de malla
    F(-5.3, 0.5, -2.25, 1.5, 1.0, 1.0); F(6.5, 0.25, -9.3, 0.6, 0.5, 0.55);   // N2-ESCUELA2: caja contra el muro, no al medio del pasillo
  }

  // ------------------------------------------------ armar
  const mats = {
    muroInt: T(S.muro ?? 0xe6dcc2, { r: 0.92 }), friso: material('puerta', 0x8a5e38), filete: material('puerta', 0x4e3420), madera: material('puerta', 0x7a5634), maderaOsc: material('puerta', 0x4e3420),
    blanco: material('blanco', 0xeceae2), cemento: T(0x8e8a82, { r: 0.95 }), goma: T(0x3a3430, { r: 0.95 }), papel: T(0xf2eedf, { r: 0.9 }), lomo: T(0x6a2a20), cuaderno: T(0x3a5a8a, { r: 0.8 }),
    cotona: T(0xb9b4a6, { r: 0.95 }), cotona2: T(0x5f6f86, { r: 0.95 }), gorra: T(0x2c2a2a, { r: 0.9 }), negro: T(0x1b1c1e, { r: 0.5 }), laton: T(0xb08d3c, { r: 0.35, m: 0.7 }),
    fierroN: T(0x2a2b2d, { r: 0.55, m: 0.5 }), fierroB: T(0x6c6e70, { r: 0.4, m: 0.7 }), acero: T(0xa9adb0, { r: 0.3, m: 0.8 }), maquina: T(0x41594b, { r: 0.5, m: 0.3 }), motor: T(a67 ? 0x3d5f7a : 0x34383c, { r: 0.45, m: 0.4 }),
    cobre: T(0xb86a3a, { r: 0.35, m: 0.8 }), fundicion: T(0x4a4642, { r: 0.85, m: 0.4 }), arena: T(0x5a4632, { r: 1 }), correa: T(0x5a3a24, { r: 0.8 }), marmol: T(0xe8e6e0, { r: 0.3 }), rojo: T(0xc0201c, { r: 0.5 }),
    tiza: T(0xf6f6f0), esfera: T(0xf6f2e6, { r: 0.4 }), globo: T(0x4f86a8, { r: 0.5 }), lena: T(0x6b4a2c, { r: 0.95 }), brasa: T(0xff7a2a, { e: 0x9a3008 }),
    bandAzul: T(0x1d3c8f, { r: 0.9, doble: true }), bandBlanco: T(0xf4f4f0, { r: 0.9, doble: true }), bandRojo: T(0xc8202a, { r: 0.9, doble: true }),
    carton: T(0xa88457, { r: 0.95 }), cinta: T(0xd8c9a4, { r: 0.7 }),
    vidrio: T(0xd4e6ec, { r: 0.05, m: 0.1, op: 0.18 }), vidrioR: T(0xd4e6ec, { r: 0.05, m: 0.1, op: 0.3 }),
    dia: new THREE.MeshBasicMaterial({ color: a20 ? 0xe9cfae : anio < 1950 ? 0xdde6ee : 0xe6eef4 }),
  };
  for (const [id, { JR, it }] of RESP) {   // N0-UTIL3 (G4): respaldo de cada pieza en su grupo; se oculta al montar la malla
    const gR = new THREE.Group(); gR.name = 'esc_resp_' + id;
    for (const k of Object.keys(JR.p)) { const geo = JR.geometria(k); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'esc_' + k; m.receiveShadow = true; if (mats[k]?.transparent) m.renderOrder = 2; gR.add(m); }
    gR.position.copy(O); g.add(gR); const pr = montarEnKit(g, it, { ocultar: gR });
    if (id === 'torno' && correasQ1) pr.then(({ ok }) => { if (ok.length && ok.every(Boolean)) correasQ1.visible = true; });   // Q1
  }
  if (banQ1) {   // Q1 (16-11): bandera chilena del hall = plano bandera_chile (paño con pliegues de Qwen) de 0,7 × 0,6 en el mismo lugar del paño de cajas;
    // la estrella va junto al asta (u invertida). Doble cara (de atrás se ve espejada, como una bandera real). Sin el plano queda el de cajas.
    const gB = new THREE.Group(); gB.name = 'esc_resp_bandera'; for (const k of Object.keys(JBan.p)) { const geo = JBan.geometria(k); if (geo) gB.add(new THREE.Mesh(geo, mats[k] ?? mats.blanco)); } gB.position.copy(O); g.add(gB);
    const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil('bandera_chile'); if (!t) return;
      const geo = new THREE.PlaneGeometry(0.7, 0.6), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide })); m.name = 'esc_q1_bandera';
      m.position.set(-0.4, 2.465, 0.012).applyMatrix4(new THREE.Matrix4().makeRotationY(0.5)).add(new THREE.Vector3(O.x + banQ1.x, O.y, O.z + banQ1.z)); m.rotation.y = 0.5; g.add(m); gB.visible = false; });
  }
  armarMallas(g, J, mats, O, 'esc', { friso: 0.6, filete: 1.2, muroInt: 0.4, cemento: 0.3, blanco: 1, madera: 1.4, maderaOsc: 2, papel: 2.6, cuaderno: 2.6, dia: 0.3, vidrio: 3.5, vidrioR: 3.5, cinta: 2.5, laton: 3, negro: 3.2, marmol: 1.6, tiza: 3 });
  lamparas(g, O, H, [[-1.6, -9.0], [-1.6, -12.8], [0, -2.6], [5, -8.5], [5, -13.5], [-3, -20], [-3, -26], [-3, -32], [3, -20], [3, -26], [3, -32]], a20 ? 0x2f4a3a : 0x3b5a4a, 0xfff1c8);
  const tono = a20 ? 0xffe3b8 : 0xfff0d8;
  for (const [x, z, I] of [[-1.6, -10.5, 24], [-1.2, -2.4, 16], [5, -8.5, 16], [-1, -21, 26], [1, -31, 26]]) { const l = new THREE.PointLight(tono, I, 15, 1.6); l.position.set(O.x + x, H - 1.2, O.z + z); g.add(l); }
  g.add(new THREE.AmbientLight(0xf2ece0, 0.34));
  return g;
}

// lámparas colgantes de esmalte (cordón, pantalla y ampolleta), en 3 mallas
function lamparas(g, O, H, lista, colPan, colAmp, yl = H - 1.0) {
  const JL = new Junta();
  for (const [x, z] of lista) {
    JL.add('c', new THREE.CylinderGeometry(0.008, 0.008, H - yl - 0.2, 4).translate(x, (H + yl + 0.2) / 2, z));
    JL.add('p', new THREE.ConeGeometry(0.34, 0.22, 16, 1, true).translate(x, yl + 0.1, z)); JL.add('p', new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10).translate(x, yl + 0.23, z));
    JL.add('a', new THREE.SphereGeometry(0.075, 10, 8).translate(x, yl + 0.02, z));
  }
  const mP = T(colPan, { r: 0.4, m: 0.2, doble: true }), mC = T(0x1b1c1e, { r: 0.5 }), mA = new THREE.MeshBasicMaterial({ color: colAmp });
  for (const [k, m] of [['c', mC], ['p', mP], ['a', mA]]) { const ms = new THREE.Mesh(JL.geometria(k), m); ms.position.copy(O); ms.name = 'esc_lamp_' + k; g.add(ms); }
}

// ======================================================================================= Museo de la Gran Minería del Cobre (hoy)
export function salaMuseo(S, O, fis) {
  const W = S.ancho, L = S.largo, H = S.alto, hw = W / 2, J = new Junta(), g = new THREE.Group(); g.name = 'kit_sala_museo129';
  // N0-UTIL3 (G5): mismo patrón R()/montarEnKit que salaEscuela (respaldo procedural en Junta aparte, se oculta al poner la malla)
  const RESP = new Map(), R = (id, x, y, z, ry = 0, esc) => { let e = RESP.get(id); if (!e) RESP.set(id, e = { JR: new Junta(), it: [] });
    e.it.push({ id, x: O.x + x, y: O.y + y, z: O.z + z, ry, esc }); return e.JR; };
  const CED = [];   // N2-ESCUELA2: puntos de lectura de las cédulas (local); turismo.js muestra «E: leer» al acercarse
  const placa = (id, w, h, x, y, z, rot, incl = 0, lx = x, lz = z) => {   // cédula física: lienzo nítido + punto de lectura (lx, lz)
    const c = cartel(g, texCedula(id), w, h, 0, 0, 0, 0); c.position.set(x, y, z); c.rotation.set(incl, rot, 0, 'YXZ'); c.material.map.anisotropy = 8; CED.push({ id, x: lx, y, z: lz }); return c; };
  const F = (x, y, z, sx, sy, sz, tipo = 'mueble') => fis.caja(O.x + x, O.y + y, O.z + z, sx, sy, sz, 0, { tipo });
  estructura(J, F, S, { muro: 'muroInt', vidrio: 'vidrio', marco: 'grafito', marcoV: 'blanco', puerta: 'grafito', dia: 'dia', frente: true });   // N2-ESCUELA2: vano recepción → sala 1
  // zócalo gris oscuro (8 cm) en todos los muros
  const zoc = (ax, az, bx, bz) => J.caja('grafito', (ax + bx) / 2, 0.06, (az + bz) / 2, Math.abs(bx - ax) || 0.02, 0.12, Math.abs(bz - az) || 0.02);
  zoc(-hw + 0.012, -0.03, -hw + 0.012, zA + 0.08); zoc(-hw + 0.012, zA - 0.08, -hw + 0.012, zT + 0.08); zoc(-hw + 0.012, zT - 0.08, -hw + 0.012, -L + 0.03);
  zoc(hw - 0.012, -0.03, hw - 0.012, -L + 0.03); zoc(-hw + 0.02, -L + 0.012, hw - 0.02, -L + 0.012);
  // piso de la gran sala: hormigón pulido gris (2 cm sobre las tablas)
  J.caja('pulido', 0, 0.01, (zT - tM / 2 + -L) / 2, W - 0.01, 0.02, L + zT - tM / 2 - 0.01);

  // ------------------------------------------------ RECEPCIÓN
  J.caja('grafito', -2.0, 3.05, zA + tM / 2 + 0.03, 4.6, 0.95, 0.04);
  cartel(g, texCartel(['MUSEO DE LA GRAN MINERÍA DEL COBRE', 'SEWELL · EX ESCUELA INDUSTRIAL · EDIFICIO 129'], '#1c3550', '#f2c230', 1024, 200), 4.4, 0.86, -2.0, 3.05, zA + tM / 2 + 0.058, 0);
  { const X = 6.25, Z = -2.7, p = mueble(R('meson_recepcion', X, 0, Z, -Math.PI / 2, [1.15, 0.97, 1]), X, Z, -Math.PI / 2);   // N0-UTIL3 · mesón de recepción con folletos (N2-ESCUELA2: contra el muro este, deja libre la boca del pasillo)
    p.b('blanco', 0, 0.52, 0, 2.2, 1.04, 0.6); p.b('grafito', 0, 1.06, -0.05, 2.3, 0.04, 0.75); p.b('amarillo', 0, 0.55, 0.305, 2.2, 0.22, 0.012);
    for (let k = 0; k < 4; k++) p.b(['folleto1', 'folleto2', 'folleto1', 'papel'][k], -0.7 + k * 0.18, 1.09, 0.15, 0.12, 0.012, 0.2, 0.1 * k);
    p.b('negro', 0.6, 1.2, -0.1, 0.35, 0.22, 0.03, 0, -0.2); p.b('negro', 0.6, 1.09, 0.05, 0.3, 0.012, 0.12);   // pantalla y teclado de la caja
    F(X, 0.55, Z, 0.75, 1.1, 2.3); }
  cartel(g, texCartel(['SEWELL', 'PATRIMONIO DE LA HUMANIDAD', 'UNESCO · 2006'], '#f4f1e8', '#1c3550', 512, 320), 1.2, 0.75, -hw + 0.025, 2.0, -2.6, Math.PI / 2);
  cartel(g, texCartel(['↑  RECORRIDO', 'Sala 1 · La ciudad de las escaleras', 'Sala 2 · La mina y sus máquinas'], '#1c3550', '#f4f1e8', 640, 260), 1.2, 0.49, (xA0 + xA1) / 2, 3.42, zA + tM / 2 + 0.012, 0);   // sobre el vano a la sala 1
  // postes con cordón rojo guiando a la sala
  const poste = (x, z) => { const J = R('poste_cordon', x, 0, z, 0); J.add('acero',   /* C3: poste FINO (base torneada, caña cromada, remate y argollas) */ new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8).translate(x, 0.5, z)); J.add('acero', new THREE.CylinderGeometry(0.16, 0.18, 0.03, 14).translate(x, 0.015, z)); J.add('acero', new THREE.SphereGeometry(0.04, 8, 6).translate(x, 0.98, z)); };
  const cordon = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, pts = [];   // C3: cordón de terciopelo que cuelga en catenaria entre las argollas (antes una barra recta)
    for (let k = 0; k <= 12; k++) { const t = k / 12, d = 0.045 + (l - 0.09) * t; pts.push(new THREE.Vector3(a[0] + ux * d, 0.86 - Math.min(0.12, l * 0.06) * 4 * t * (1 - t), a[1] + uz * d)); }
    J.add('cordon', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.016, 6)); };
  const vallado = (pts) => { pts.forEach(p => poste(...p)); for (let i = 0; i + 1 < pts.length; i++) cordon(pts[i], pts[i + 1]); };

  // ------------------------------------------------ SALA 1 (ex salón): paneles de historia, vitrinas de minerales, maqueta de Sewell
  const paneles = [
    ['Braden Copper\nCompany', '1904', 'William Braden, con el respaldo de E. W. Nash y Barton Sewell, organiza la Braden Copper Company para explotar El Teniente. En 1906 parte el primer concentrador.'],
    ['El campamento\nse llama Sewell', '1915', 'A la muerte de Barton Sewell el campamento toma su nombre. Ya viven miles de personas en la ladera del cerro Negro.'],
    ['La ciudad de\nlas escaleras', '1920', 'Sin calles para autos: la Escalera Central une el hospital, el cine, el palitroque, la escuela y los camarotes de colores.'],
    ['La tragedia\ndel humo', '1945', 'El 19 de junio un incendio en la mina llena de humo las galerías: mueren 355 trabajadores. Es la mayor tragedia de la minería chilena.'],
    ['Operación\nValle', '1967', 'Las familias bajan a vivir a Rancagua. Sewell se va quedando vacío y muchos edificios se desarman.'],
    ['Nacionalización\ndel cobre', '1971', 'El Estado de Chile nacionaliza la gran minería del cobre. Desde 1976 El Teniente es parte de Codelco.'],
    ['Patrimonio de\nla Humanidad', '2006', 'La UNESCO declara a Sewell Patrimonio de la Humanidad: un campamento minero único en el mundo.'],
  ];
  // muro del fondo de la sala 1 (z −16, cara al salón) y muro del hall (z −5, cara al salón)
  paneles.forEach(([t, a, c], i) => {
    const enFondo = i < 4, x = enFondo ? -6.1 + i * 1.35 : -5.4 + (i - 4) * 2.4,   // N2-ESCUELA2: los del fondo dejan libre el vano al taller (x −1…1)
      z = enFondo ? zT + tM / 2 + 0.03 : zA - tM / 2 - 0.03;
    J.caja('grafito', x, 1.75, enFondo ? z - 0.012 : z + 0.012, 1.0, 1.32, 0.02);
    const tp = texPanel(t, a, c); cartel(g, tp, 0.94, 1.25, x, 1.75, z + (enFondo ? 0.004 : -0.004), enFondo ? 0 : Math.PI);
    if (i < 4 && tp.userData.foto) fotoEnLienzo(tp, ['panel_hist3', 'panel_hist4', 'panel_hist2', 'panel_hist1'][i], tp.userData.foto);   // C4 (P1): foto sepia de Qwen (tren de la Braden, familia en el campamento, las escaleras, mineros con lámparas)
    CED.push({ id: 'p' + a, x, y: 1.75, z: z + (enFondo ? 0.6 : -0.6) });   // el panel ES la cédula: E abre su ficha
  });
  // vitrinas de mesa con minerales y objetos (bajo las ventanas del muro oeste)
  const vitrina = (X, Z, rot, cosas, id) => {   // C3b: vitrina de mesa FINA (vitrina_mesa_<id>); las cajas quedan de respaldo
    const p = mueble(R('vitrina_mesa_' + id, X, 0, Z, rot), X, Z, rot), w = 1.6, d = 0.7;
    p.b('blanco', 0, 0.42, 0, w, 0.84, d); p.b('grafito', 0, 0.86, 0, w + 0.02, 0.04, d + 0.02); p.b('fieltro', 0, 0.885, 0, w - 0.06, 0.01, d - 0.06);
    p.b('vidrio', 0, 1.13, 0, w - 0.02, 0.5, d - 0.02); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.b('acero', sx * (w / 2 - 0.01), 1.13, sz * (d / 2 - 0.01), 0.02, 0.5, 0.02);
    p.b('acero', 0, 1.385, 0, w, 0.012, d);
    cosas(p);
    F(X, 0.7, Z, rot ? d + 0.04 : w + 0.04, 1.4, rot ? w + 0.04 : d + 0.04);
    p.b('grafito', 0, 0.68, d / 2 + 0.07, 0.62, 0.03, 0.14);   // repisa de la cédula, al frente de la vitrina
  };
  const minerales = p => { const cols = ['calcopirita', 'bornita', 'malaquita', 'cuprita', 'roca', 'cobreN'];
    for (let i = 0; i < 6; i++) { const x = -0.6 + i * 0.24; p.s(cols[i], 0.07 + (i % 3) * 0.015, x, 0.95, -0.08, 1.2, 0.75, 1, 8, 6); p.b('papel', x, 0.893, 0.18, 0.14, 0.006, 0.06); } };
  const lamparasCarburo = p => { for (let i = 0; i < 3; i++) { const x = -0.5 + i * 0.5; p.c('laton', 0.045, 0.05, 0.16, x, 0.97, -0.05, 10); p.c('laton', 0.02, 0.02, 0.06, x, 1.08, -0.05, 6); p.c('laton', 0.008, 0.008, 0.08, x + 0.05, 1.06, -0.05, 4, 0, 1.0); p.b('papel', x, 0.893, 0.2, 0.14, 0.006, 0.06); }
    p.s('casco', 0.13, 0.55, 0.93, 0.05, 1, 0.7, 1.15, 12, 8); };
  const herramientas = p => { p.b('acero', -0.4, 0.91, 0, 0.7, 0.025, 0.04, 0.2); p.b('madera', 0.2, 0.92, -0.05, 0.05, 0.04, 0.5, 0.3); p.b('acero', 0.2, 0.92, 0.22, 0.2, 0.06, 0.06, 0.3); p.b('papel', 0.4, 0.895, 0.15, 0.24, 0.008, 0.16, -0.1); p.b('papel', -0.5, 0.895, 0.2, 0.14, 0.006, 0.06); };
  vitrina(-hw + 0.5, -7.6, Math.PI / 2, minerales, 'minerales'); vitrina(-hw + 0.5, -10.6, Math.PI / 2, lamparasCarburo, 'lamparas'); vitrina(-hw + 0.5, -13.6, Math.PI / 2, herramientas, 'herramientas');
  [['minerales', -7.6], ['lamparas', -10.6], ['herramientas', -13.6]].forEach(([id, z]) => placa(id, 0.56, 0.35, -hw + 0.5 + 0.35 + 0.15, 0.84, z, Math.PI / 2, -0.75, -hw + 1.6, z));
  // maqueta de Sewell bajo una urna de vidrio (al centro de la sala 1): terrazas, Escalera Central y edificios de colores
  { const X = -0.6, Z = -10.4, w = 3.0, d = 2.2, p = mueble(J, X, Z, 0);
    p.b('grafito', 0, 0.42, 0, w, 0.84, d); const pz = p; { const p = mueble(R('maqueta', X, 0.84, Z, 0, [1.8, 1.1, 1.75]), X, Z, 0);   // N0-UTIL3: maqueta = malla sobre el zócalo
    for (let k = 0; k < 4; k++) p.b('cerro', 0, 0.88 + k * 0.06, -d / 2 + 0.35 + k * 0.4, w - 0.1, 0.06 + k * 0.12, 0.62, 0, 0.0);   // terrazas que suben hacia el fondo
    p.b('cerro', 0, 1.2, -d / 2 + 0.15, w - 0.1, 0.7, 0.24);
    p.b('escalera', 0.05, 1.05, 0, 0.12, 0.02, d - 0.3, 0, -0.3);
    const colores = ['m_verde', 'm_rojo', 'm_amarillo', 'm_celeste', 'm_blanco', 'm_ocre'];
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) { if (Math.abs(-1.25 + i * 0.5 + 0.05) < 0.15) continue; const x = -1.25 + i * 0.5 + (r() - 0.5) * 0.1, y = 0.88 + k * 0.06 + (0.06 + k * 0.12) / 2, z = -d / 2 + 0.35 + k * 0.4;
      const hb = 0.08 + r() * 0.12; p.b(colores[(i + k * 2) % 6], x, y + hb / 2, z, 0.3 + r() * 0.12, hb, 0.18); p.b('m_techo', x, y + hb + 0.012, z, 0.32, 0.024, 0.2); } }
    pz.b('vidrio', 0, 1.5, 0, w - 0.04, 1.2, d - 0.04); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pz.b('acero', sx * (w / 2 - 0.02), 1.5, sz * (d / 2 - 0.02), 0.025, 1.2, 0.025); pz.b('acero', 0, 2.11, 0, w, 0.012, d);
    F(X, 1.05, Z, w + 0.04, 2.1, d + 0.04); }
  placa('maqueta', 0.9, 0.5625, -0.6, 0.48, -10.4 + 1.1 + 0.012, 0, 0, -0.6, -8.6);   // en el frente del zócalo de la urna
  cartel(g, texCartel(['SALA 1 · LA CIUDAD DE LAS ESCALERAS'], '#f2c230', '#1c3550', 768, 110), 2.4, 0.34, -1.6, 3.4, zA - tM / 2 - 0.03, Math.PI);
  // pasillo: fotos históricas enmarcadas y banca
  for (let i = 0; i < 3; i++) { const z = [-6.4, -10.5, -14.4][i]; J.caja('grafito', hw - 0.03, 1.75, z, 0.03, 0.9, 1.25);
    { const tp = texPanel(['La planta concentradora', 'Alumnos de la Escuela', 'Enfermeras del hospital', 'La Escalera Central'][i], ['1930', '1940', '1950', '1955'][i], 'Fotografía del archivo histórico de El Teniente.', true);   // C4 (P1): fotos del pasillo de Qwen (títulos y cédulas al día con las fotos)
      cartel(g, tp, 0.62, 0.82, hw - 0.05, 1.75, z, -Math.PI / 2); if (tp.userData.foto) fotoEnLienzo(tp, 'foto_pas' + (i + 1), tp.userData.foto); }
    CED.push({ id: 'foto' + (i + 1), x: hw - 0.7, y: 1.75, z }); }
  { const p = mueble(J, xC + 0.5, -10.8, Math.PI / 2); p.b('grafito', 0, 0.44, 0, 1.8, 0.06, 0.45); for (const dx of [-0.8, 0.8]) p.b('acero', dx, 0.21, 0, 0.05, 0.42, 0.4); F(xC + 0.5, 0.45, -10.8, 0.5, 0.9, 1.8); }
  cartel(g, texCartel(['SALA 2 · LA MINA Y SUS MÁQUINAS'], '#f2c230', '#1c3550', 768, 110), 2.4, 0.34, (xPT0 + xPT1) / 2, 3.2, zT + tM / 2 + 0.02, 0);

  // ------------------------------------------------ SALA 2 (ex taller): maquinaria minera pintada de amarillo
  // vía de trocha angosta con locomotora chica de baterías y dos carros mineros
  const xV = -3.6, zV0 = -17.2, zV1 = -35.4;
  J.caja('balasto', xV, 0.06, (zV0 + zV1) / 2, 1.6, 0.1, zV0 - zV1);
  for (let z = zV0 - 0.3; z > zV1; z -= 0.6) J.caja('durmiente', xV, 0.13, z, 1.2, 0.07, 0.16);
  for (const s of [-1, 1]) J.caja('riel', xV + s * 0.3, 0.2, (zV0 + zV1) / 2, 0.05, 0.07, zV0 - zV1 - 0.1);
  F(xV, 0.12, (zV0 + zV1) / 2, 1.6, 0.24, zV0 - zV1, 'piso');
  const ruedas = (p, zs) => { for (const z of zs) for (const s of [-1, 1]) { p.c('negro', 0.17, 0.17, 0.08, s * 0.3, 0.4, z, 14, 0, Math.PI / 2); p.c('acero', 0.06, 0.06, 0.1, s * 0.34, 0.4, z, 8, 0, Math.PI / 2); } };
  { const Z = -20.0, p = mueble(R('locomotora_bat', xV, 0.23, Z, Math.PI / 2, [1, 1, 0.78]), xV, Z, 0);   // locomotora chica de baterías (cabina baja al fondo, capot de baterías) · Q1: malla sobre los rieles (cabina hacia −z; ancho ×0,78 para la trocha de 0,6 m)
    p.b('amarillo', 0, 0.75, 0.0, 1.1, 0.5, 2.6); p.b('amarillo', 0, 1.25, 0.35, 0.95, 0.5, 1.6); p.b('amarillo', 0, 1.35, -0.95, 1.0, 0.7, 0.7);   // chasis, cajón de baterías, cabina
    p.b('negro', 0, 1.82, -0.95, 1.1, 0.06, 0.85); for (const s of [-1, 1]) p.b('amarillo', s * 0.5, 1.6, -0.95, 0.04, 0.4, 0.04);
    for (let k = 0; k < 4; k++) p.b('negroM', 0, 1.25, -0.25 + k * 0.4, 0.97, 0.06, 0.03);   // tapas de las baterías
    p.b('negro', 0, 0.55, 1.33, 0.9, 0.18, 0.12); p.b('negro', 0, 0.55, -1.33, 0.9, 0.18, 0.12);   // topes
    p.c('farol', 0.07, 0.07, 0.06, 0, 1.02, 1.33, 12, Math.PI / 2); p.b('negro', 0.25, 1.15, -1.1, 0.04, 0.3, 0.04, 0, 0, 0.3);
    ruedas(p, [-0.75, 0.75]); F(xV, 1.0, Z, 1.15, 1.6, 2.7); }
  const carro = (Z) => { const p = mueble(R('carro_volteo', xV, 0.23, Z, Math.PI / 2, [0.9, 1, 0.9]), xV, Z, 0);   // N0-UTIL3: malla sobre los rieles   // carro minero de volteo (tolva en V)
    p.b('amarillo', 0, 0.6, 0, 0.9, 0.12, 1.5); for (const s of [-1, 1]) { p.b('amarilloO', s * 0.42, 0.98, 0, 0.06, 0.66, 1.5, 0, 0, s * 0.18); }
    for (const s of [-1, 1]) p.b('amarilloO', 0, 0.98, s * 0.74, 0.86, 0.66, 0.05); p.b('roca', 0, 1.24, 0, 0.82, 0.14, 1.36);
    p.b('negro', 0, 0.55, 0.85, 0.5, 0.14, 0.12); p.b('negro', 0, 0.55, -0.85, 0.5, 0.14, 0.12); ruedas(p, [-0.45, 0.45]); F(xV, 0.9, Z, 1.0, 1.4, 1.75); };
  carro(-23.3); carro(-25.4);
  // pala Eimco 12B (cargadora de volteo sobre rieles: cuchara al frente que bascula sobre la máquina)
  { const X = -3.6, Z = -31.0, p = mueble(J, X, Z, Math.PI, 0.16);
    p.b('amarillo', 0, 0.65, 0, 1.0, 0.5, 1.5); p.b('amarillo', 0, 1.05, -0.2, 0.9, 0.35, 0.9);   // chasis y torreta
    for (const s of [-1, 1]) { p.b('amarillo', s * 0.38, 1.25, 0.25, 0.08, 0.12, 1.1, 0, 0.6); }   // brazos (balancines)
    for (const s of [-1, 1]) p.t('amarilloO', 0.38, 0.05, s * 0.38, 1.35, 0.15, Math.PI / 2);   // arcos de basculación
    p.b('amarillo', 0, 0.6, 1.05, 0.95, 0.42, 0.55, 0, 0.25); p.b('acero', 0, 0.42, 1.34, 0.95, 0.04, 0.1);   // cuchara con su labio
    p.b('negro', 0.55, 1.0, -0.4, 0.12, 0.25, 0.3); p.c('negro', 0.1, 0.1, 0.4, 0, 0.95, -0.85, 10, Math.PI / 2);   // mandos y motor neumático
    ruedas(p, [-0.5, 0.5]); F(X, 0.95, Z, 1.15, 1.6, 2.8); }
  // perforadora jumbo de un brazo sobre neumáticos (como la de la explanada del museo)
  { const X = 3.2, Z = -21.6, p = mueble(J, X, Z, Math.PI, 0.16);
    J.caja('tarima', X, 0.08, Z, 2.6, 0.16, 4.8); F(X, 0.08, Z, 2.6, 0.16, 4.8, 'piso');
    p.b('amarillo', 0, 0.95, -0.6, 1.4, 0.6, 2.0); p.b('amarillo', 0, 1.45, -1.2, 1.2, 0.5, 0.8);   // chasis y motor
    p.b('negro', 0, 1.9, -0.5, 1.3, 0.05, 1.1); for (const [dx, dz] of [[-0.6, 0], [0.6, 0], [-0.6, -1.0], [0.6, -1.0]]) p.b('amarillo', dx, 1.55, dz - 0.0, 0.05, 0.7, 0.05);   // techo de protección
    for (const [dx, dz] of [[-0.72, 0.25], [0.72, 0.25], [-0.72, -1.4], [0.72, -1.4]]) p.c('negro', 0.36, 0.36, 0.3, dx, 0.52, dz, 16, 0, Math.PI / 2);
    p.b('amarilloO', 0, 1.35, 0.9, 0.22, 0.22, 1.8, 0, -0.25); p.b('amarilloO', 0, 1.72, 1.85, 0.14, 0.14, 0.8, 0, -0.25);   // brazo y prolongación
    p.b('acero', 0, 1.9, 2.25, 0.16, 0.18, 1.5); p.c('acero', 0.02, 0.02, 1.3, 0, 1.75, 2.8, 6, Math.PI / 2);   // deslizadera y barra de perforación
    p.c('negro', 0.03, 0.03, 1.5, 0.12, 1.4, 1.2, 6, Math.PI / 2 - 0.25);   // manguera
    F(X, 1.2, Z, 1.8, 2.2, 3.6); F(X, 1.8, Z - 2.2, 0.4, 0.5, 1.2); }
  // perforadora neumática manual (de pierna) sobre un pedestal
  { const X = 3.2, Z = -27.6, p = mueble(R('perforadora', X, 0, Z, 0), X, Z, 0); p.b('grafito', 0, 0.35, 0, 1.2, 0.7, 0.8);   // N0-UTIL3: malla con su pedestal p.b('amarillo', 0, 0.82, 0, 0.7, 0.18, 0.18, 0, 0, 0.35); p.c('acero', 0.015, 0.015, 0.6, 0.55, 1.0, 0, 6, 0, Math.PI / 2 + 0.35);
    p.c('amarilloO', 0.03, 0.03, 0.9, -0.25, 1.05, 0, 8, 0, -0.5); p.b('papel', 0, 0.71, 0.38, 0.3, 0.12, 0.02, 0, -0.5); F(X, 0.5, Z, 1.25, 1.0, 0.85); }
  // vagoneta de madera de los primeros años, sobre una tarima
  { const X = 3.4, Z = -32.6, p = mueble(J, X, Z, 0.0); p.b('grafito', 0, 0.12, 0, 2.0, 0.24, 1.6); F(X, 0.12, Z, 2.0, 0.24, 1.6, 'piso');
    const q = mueble(R('vagoneta_madera', X, 0.24, Z, Math.PI / 2), X, Z, 0.0);   // G9 (16-11): vagoneta de tablas con zunchos de malla (G9 vagoneta_madera) sobre la tarima; respaldo: cajas y ruedas
    q.b('madera', 0, 0.75, 0, 1.0, 0.6, 1.3); for (const y of [0.55, 0.95]) q.b('fierroN', 0, y, 0, 1.03, 0.05, 1.33); ruedas(q, [-0.4, 0.4]); F(X, 0.75, Z, 1.1, 1.3, 1.4); }
  // vallados con cordón alrededor de las máquinas
  vallado([[-2.4, -18.2], [-2.4, -27.0]]); vallado([[-2.4, -29.4], [-2.4, -32.8]]); vallado([[1.6, -19.0], [1.6, -24.2]]);
  // cédulas inclinadas junto a cada pieza (atril con su texto)
  // N2-ESCUELA2: atril más grande (0,64 × 0,4 m) con la cédula completa en lienzo de 1024 × 640; se lee parado a ~0,8 m
  const cedula = (x, z, rot, id) => { const p = mueble(R('atril_cedula', x, 0, z, rot), x, z, rot);   /* C3b: atril FINO (base torneada, columna, tablero con marco) */ p.b('grafito', 0, 0.48, 0, 0.06, 0.96, 0.06); p.b('grafito', 0, 1.0, 0.02, 0.68, 0.44, 0.03, 0, -0.6);
    placa(id, 0.64, 0.4, x + Math.sin(rot) * 0.045, 1.02, z + Math.cos(rot) * 0.045, rot, -0.6, x + Math.sin(rot) * 0.8, z + Math.cos(rot) * 0.8); F(x, 0.55, z, 0.3, 1.1, 0.3); };
  cedula(-2.0, -19.4, Math.PI / 2, 'loco');
  cedula(-2.0, -24.4, Math.PI / 2, 'carros');
  cedula(-2.0, -31.0, Math.PI / 2, 'pala');
  cedula(1.2, -21.6, -Math.PI / 2, 'jumbo');
  cedula(1.6, -27.6, -Math.PI / 2, 'perforadora');
  cedula(1.9, -32.6, -Math.PI / 2, 'vagoneta');
  // mural del corte de la mina en el muro del fondo
  J.caja('grafito', 0, 2.2, -L + 0.02, 6.6, 2.7, 0.04);
  { const mm = cartel(g, texMural(), 6.4, 2.5, 0, 2.2, -L + 0.045, 0), pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil('mural_mina'); if (!t) return;   // C4 (P1): mural de Qwen entero (4:3) al centro del tablero gris; el lienzo ancho queda de respaldo
    mm.visible = false; cartel(g, t, 3.5, 2.62, 0, 2.2, -L + 0.045, 0).position.add(O); }); }   // (armarMallas ya corrió: el cartel lleva O a mano)
  J.caja('grafito', 4.6, 1.45, -L + 0.02, 0.7, 0.46, 0.04); placa('mural', 0.64, 0.4, 4.6, 1.45, -L + 0.045, 0, 0, 4.6, -L + 0.9);   // cédula del mural, a su derecha
  // rieles de focos en el cielo (focos negros apuntando a las piezas, con cara encendida)
  // C3b: cada foco = FINO foco_riel (inclinado hacia afuera) / foco_riel_v (vertical) colgado del riel; los cilindros quedan de respaldo
  for (const x of [-2.2, 2.0]) { J.caja('negro', x, H - 0.03, -26, 0.06, 0.04, 18); for (let z = -18.5; z > -34; z -= 2.5) { const J = R('foco_riel', x, H - 0.05, z, x < 0 ? -Math.PI / 2 : Math.PI / 2); J.add('negro', new THREE.CylinderGeometry(0.06, 0.08, 0.2, 10).rotateZ(x < 0 ? 0.6 : -0.6).translate(x + (x < 0 ? -0.08 : 0.08), H - 0.18, z)); J.add('foco', new THREE.CircleGeometry(0.055, 10).rotateX(Math.PI / 2).rotateZ(x < 0 ? 0.6 : -0.6).translate(x + (x < 0 ? -0.14 : 0.14), H - 0.27, z)); } }
  for (const x of [-1.6, 4.8]) { J.caja('negro', x, H - 0.03, -10.4, 0.06, 0.04, 9); for (let z = -6.5; z > -14.5; z -= 2.6) { const J = R('foco_riel_v', x, H - 0.05, z, 0); J.add('negro', new THREE.CylinderGeometry(0.06, 0.08, 0.2, 10).translate(x, H - 0.15, z)); J.add('foco', new THREE.CircleGeometry(0.055, 10).rotateX(Math.PI / 2).translate(x, H - 0.252, z)); } }

  const mats = {
    muroInt: T(S.muro ?? 0xf2f0ea, { r: 0.92 }), grafito: T(0x34373b, { r: 0.6 }), blanco: material('blanco', 0xf4f2ec), pulido: T(0x9a9894, { r: 0.35, m: 0.05 }),
    amarillo: T(0xf2b818, { r: 0.45, m: 0.2 }), amarilloO: T(0xd99a10, { r: 0.5, m: 0.25 }), negro: T(0x1b1c1e, { r: 0.5 }), negroM: T(0x2a2b2d, { r: 0.6 }), acero: T(0xa9adb0, { r: 0.3, m: 0.8 }),
    fierroN: T(0x2a2b2d, { r: 0.55, m: 0.5 }), madera: material('puerta', 0x7a5634), papel: T(0xf2eedf, { r: 0.9 }), folleto1: T(0xf2c230), folleto2: T(0x1c3550), laton: T(0xb08d3c, { r: 0.35, m: 0.7 }),
    fieltro: T(0x1f2f45, { r: 1 }), cordon: T(0xa01c24, { r: 0.8 }), casco: T(0x6a4a2a, { r: 0.5 }), roca: T(0x6a5e52, { r: 1 }), balasto: T(0x5d5650, { r: 1 }), durmiente: T(0x4a3422, { r: 0.95 }), riel: T(0x7a6a5a, { r: 0.4, m: 0.7 }),
    tarima: T(0x34373b, { r: 0.6 }), farol: T(0xfff2c0, { e: 0x8a7a40 }), foco: new THREE.MeshBasicMaterial({ color: 0xfff6dc }),
    calcopirita: T(0xc8a840, { r: 0.35, m: 0.7 }), bornita: T(0x6a4a8a, { r: 0.35, m: 0.6 }), malaquita: T(0x2f8a5a, { r: 0.5 }), cuprita: T(0x8a2a24, { r: 0.4, m: 0.3 }), cobreN: T(0xc8743a, { r: 0.3, m: 0.9 }),
    cerro: T(0x9c8a72, { r: 1 }), escalera: T(0xd8d2c4), m_verde: T(0x86d6c2), m_rojo: T(0xc0503a), m_amarillo: T(0xf0d070), m_celeste: T(0x9ec4e6), m_blanco: T(0xf0ece2), m_ocre: T(0xe4b850), m_techo: T(0xa8432f),
    vidrio: T(0xd4e6ec, { r: 0.05, m: 0.1, op: 0.16 }),
    dia: new THREE.MeshBasicMaterial({ color: 0xe6eef4 }),
  };
  for (const [id, { JR, it }] of RESP) {   // N0-UTIL3 (G5)
    const gR = new THREE.Group(); gR.name = 'mus_resp_' + id;
    for (const k of Object.keys(JR.p)) { const geo = JR.geometria(k); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'mus_' + k; m.receiveShadow = true; if (mats[k]?.transparent) m.renderOrder = 2; gR.add(m); }
    gR.position.copy(O); g.add(gR); montarEnKit(g, it, { ocultar: gR });
  }
  armarMallas(g, J, mats, O, 'mus', { muroInt: 0.4, pulido: 0.3, grafito: 1.2, blanco: 1, papel: 2.6, fieltro: 2.2, dia: 0.3, vidrio: 3.5, acero: 2.8, amarilloO: 1.8, negroM: 2.4, folleto1: 3, folleto2: 3 });
  lamparas(g, O, H, [[0, -2.6]], 0xf2f1ea, 0xfff6e4, H - 1.2);
  for (const [x, z, I] of [[-1.6, -10.4, 26], [-1.2, -2.4, 16], [5, -9, 16], [-2, -22, 30], [2, -30, 30]]) { const l = new THREE.PointLight(0xfff4e2, I, 16, 1.6); l.position.set(O.x + x, H - 0.6, O.z + z); g.add(l); }
  g.add(new THREE.AmbientLight(0xeef0f4, 0.36));
  g.userData.cedulas = CED.filter(c => CEDULAS[c.id]).map(c => ({ ...CEDULAS[c.id], id: c.id, cedula: true, x: O.x + c.x, y: O.y + c.y, z: O.z + c.z }));
  return g;
}
