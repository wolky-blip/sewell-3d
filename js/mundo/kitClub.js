// N0-EMB9 (carril kit, 14-11-2026): Teniente Club (Edificio 20, 1925) por dentro, fiel a las fotos y al video de Diego
// (assets3d/referencias/sewell/emblematicos/club_interior/). Sala de 3 niveles (local: x a lo ancho, z de 0 = fachada/puerta a −34, y absoluto):
//   ZÓCALO (deck y 2,0): piscina temperada de baldosa blanca con borde azul ancho, carriles, barandas tubulares, escalerillas, focos redondos,
//            bancas, camarines, reloj y fotos históricas en marcos rojos; agua tibia con vapor (o vacía con ?piscina=vacia / S.vacia).
//   PLANTA DE ACCESO (y 6,4): vestíbulo con la ESCALERA imperial de madera y alfombra roja (tramo central → rellano con cortinaje rojo →
//            dos tramos laterales), balaustres torneados, cielo de lata estampada y lámpara de globo; escalera de servicio a la piscina;
//            SALA DEL ESPEJO al fondo (paneles de madera con óvalos, parquet, chimenea con gran ESPEJO ovalado que refleja de verdad).
//   SALÓN (y 11,4): ventanas de medio punto con abanico, cortinas de terciopelo burdeo con cenefas, arañas de bronce con tulipas ámbar,
//            arco con columnas jónicas blancas y barra con columnas, cuadros al óleo, friso de madera, sillas tapizadas, tarima y piano.
// Colisiones con fis.caja; las escaleras son rampas inclinadas (cómodas) bajo los peldaños dibujados. Documentación: KIT_SEWELL.md «N0-EMB9».
import * as THREE from 'three';
import { Junta, uvCaja } from './kitSewell.js';
import { montarEnKit, texUtil, precargarUtileria } from './utileria.js';   // N0-UTIL3 (G6): mallas TRELLIS (chimenea, sillones, piano, bancos, guitarra) con respaldo procedural

const texCache = {};
function lienzo(clave, w, h, dibujar, rep) {
  if (texCache[clave]) return texCache[clave];
  const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (texCache[clave] = t);
}
function azar(s) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// ---------------------------------------------------------------- texturas
const TX = {
  lata: () => lienzo('club_lata', 256, 256, (c, w) => {   // cielo de lata estampada: cuadros con medallón en relieve
    c.fillStyle = '#efe9dc'; c.fillRect(0, 0, w, w);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = i * 128, y = j * 128;
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.strokeRect(x + 6, y + 6, 116, 116);
      c.strokeStyle = 'rgba(95,82,62,0.7)'; c.lineWidth = 4; c.strokeRect(x + 9, y + 9, 116, 116);
      for (const [r, a] of [[44, 0.75], [30, 0.6], [16, 0.75]]) { c.beginPath(); c.arc(x + 64, y + 64, r, 0, 7); c.strokeStyle = `rgba(110,98,80,${a})`; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(x + 62, y + 62, r, 0, 7); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.stroke(); }
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.moveTo(x + 64 + Math.cos(a) * 46, y + 64 + Math.sin(a) * 46); c.lineTo(x + 64 + Math.cos(a) * 60, y + 64 + Math.sin(a) * 60); c.strokeStyle = 'rgba(110,98,80,0.4)'; c.lineWidth = 4; c.stroke(); }
    }
  }, true),
  placas: () => lienzo('club_placas', 256, 256, (c, w) => { c.fillStyle = '#f1efe9'; c.fillRect(0, 0, w, w); const r = azar(7);
    for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(150,145,135,${r() * 0.18})`; c.fillRect(r() * w, r() * w, 2, 2); }
    c.fillStyle = 'rgba(160,155,145,0.8)'; c.fillRect(0, 0, w, 3); c.fillRect(0, 0, 3, w); c.fillRect(0, 126, w, 3); c.fillRect(126, 0, 3, w); }, true),
  baldosaPis: () => lienzo('club_baldosa', 256, 256, (c, w) => { c.fillStyle = '#f7f7f4'; c.fillRect(0, 0, w, w); c.fillStyle = 'rgba(150,160,165,0.75)';
    for (let i = 0; i <= 8; i++) { c.fillRect(i * 32 - 1, 0, 2, w); c.fillRect(0, i * 32 - 1, w, 2); } }, true),
  deck: () => lienzo('club_deck', 256, 256, (c, w) => { c.fillStyle = '#8c8478'; c.fillRect(0, 0, w, w); const r = azar(11);
    for (let i = 0; i < 2600; i++) { const v = r(); c.fillStyle = v < 0.5 ? `rgba(60,55,48,${r() * 0.25})` : `rgba(190,182,168,${r() * 0.2})`; c.fillRect(r() * w, r() * w, 1 + r() * 3, 1 + r() * 3); } }, true),
  mosaico: () => lienzo('club_mosaico', 256, 256, (c, w) => { const r = azar(23);   // baldosa pulida café rojiza (vestíbulo)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = r() * 26 - 13, x = i * 64, y = j * 64;
      c.fillStyle = `rgb(${128 + v | 0},${74 + v * 0.7 | 0},${52 + v * 0.5 | 0})`; c.fillRect(x, y, 64, 64);
      for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(${r() < 0.5 ? '70,38,24' : '190,140,105'},${r() * 0.35})`; c.beginPath(); c.ellipse(x + r() * 64, y + r() * 64, 2 + r() * 8, 1 + r() * 3, r() * 3, 0, 7); c.fill(); } }
    c.fillStyle = 'rgba(40,24,16,0.6)'; for (let i = 0; i <= 4; i++) { c.fillRect(i * 64 - 1, 0, 2, w); c.fillRect(0, i * 64 - 1, w, 2); } }, true),
  parquet: () => lienzo('club_parquet', 256, 256, (c, w) => { const r = azar(31);   // espiga
    c.fillStyle = '#5a3418'; c.fillRect(0, 0, w, w);
    for (let y = -64; y < w + 64; y += 32) for (let x = -64; x < w + 64; x += 64) for (const s of [0, 1]) {
      const v = r() * 30 - 15; c.save(); c.translate(x + s * 32, y); c.rotate(s ? -Math.PI / 4 : Math.PI / 4);
      c.fillStyle = `rgb(${132 + v | 0},${80 + v * 0.7 | 0},${42 + v * 0.4 | 0})`; c.fillRect(0, 0, 64, 15); c.strokeStyle = 'rgba(40,22,10,0.6)'; c.lineWidth = 1.5; c.strokeRect(0, 0, 64, 15);
      for (let k = 0; k < 3; k++) { c.strokeStyle = `rgba(60,34,16,${0.2 + r() * 0.2})`; c.beginPath(); c.moveTo(0, 3 + k * 4.5); c.lineTo(64, 2 + k * 4.5 + r() * 2); c.stroke(); }
      c.restore(); } }, true),
  alfombra: () => lienzo('club_alfombra', 128, 128, (c, w) => { c.fillStyle = '#c9b89c'; c.fillRect(0, 0, w, w); const r = azar(41);
    for (let i = 0; i < 2400; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '150,135,112' : '222,210,190'},${r() * 0.35})`; c.fillRect(r() * w, r() * w, 1, 1); } }, true),
  madera: () => lienzo('club_madera', 256, 256, (c, w) => { const r = azar(53); c.fillStyle = '#8a5a30'; c.fillRect(0, 0, w, w);
    for (let i = 0; i < 90; i++) { const y = r() * w; c.strokeStyle = `rgba(${r() < 0.5 ? '60,34,14' : '170,120,70'},${0.15 + r() * 0.25})`; c.lineWidth = 1 + r() * 2; c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x * 0.03 + i) * 3); c.stroke(); } }, true),
  terciopelo: () => lienzo('club_terciopelo', 128, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 8; i++) { g.addColorStop(i / 8, i % 2 ? '#8a1a26' : '#4a0a12'); } c.fillStyle = g; c.fillRect(0, 0, w, h); }, true),
  vista: () => lienzo('club_vista', 256, 384, (c, w, h) => {   // cielo de alta montaña y cordillera seca por la ventana
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9ec4e6'); g.addColorStop(0.55, '#d9e6ee'); g.addColorStop(1, '#e8e2d4'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b9ab97'; c.beginPath(); c.moveTo(0, h * 0.62); for (let x = 0; x <= w; x += 16) c.lineTo(x, h * (0.5 + 0.08 * Math.sin(x * 0.03) + 0.05 * Math.sin(x * 0.11))); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.fillStyle = '#9d8f7c'; c.beginPath(); c.moveTo(0, h * 0.8); for (let x = 0; x <= w; x += 16) c.lineTo(x, h * (0.72 + 0.05 * Math.sin(x * 0.05 + 1))); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)'; for (let x = 0; x < w; x += 22) c.fillRect(x, h * (0.5 + 0.08 * Math.sin(x * 0.03)) - 2, 10, 3); }),
  agua: () => lienzo('club_agua', 256, 256, (c, w) => { c.fillStyle = '#7cc9da'; c.fillRect(0, 0, w, w); const r = azar(61);
    for (let i = 0; i < 70; i++) { c.strokeStyle = `rgba(230,250,255,${0.1 + r() * 0.25})`; c.lineWidth = 1 + r() * 2; c.beginPath(); const x = r() * w, y = r() * w; c.moveTo(x, y);
      c.bezierCurveTo(x + 20, y - 10 * r(), x + 30, y + 10 * r(), x + 50 * r() + 20, y + 4); c.stroke(); } }, true),
  vapor: () => lienzo('club_vapor', 128, 128, (c, w) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); }),
};
// óleos (paisaje, marina, cordillera, bodegón) y fotos históricas en sepia
function oleo(i) {
  return lienzo('club_oleo' + i, 256, 192, (c, w, h) => { const r = azar(100 + i * 7), tipo = i % 4;
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, ['#8fb0c8', '#a9c3cf', '#c9b08a', '#3a2a1c'][tipo]); g.addColorStop(1, ['#e7d7b0', '#d8d0b6', '#f0dcb0', '#5a3a22'][tipo]); c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (tipo === 0 || tipo === 2) { c.fillStyle = tipo ? '#8a6a52' : '#6f7f8f'; c.beginPath(); c.moveTo(0, h * 0.6); for (let x = 0; x <= w; x += 12) c.lineTo(x, h * (0.35 + 0.15 * Math.sin(x * 0.04 + i) + r() * 0.04)); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.fillStyle = tipo ? '#c8a06a' : '#5e7a3e'; c.fillRect(0, h * 0.75, w, h * 0.25); c.fillStyle = '#f4f4f0'; for (let x = 0; x < w; x += 18) c.fillRect(x, h * (0.35 + 0.15 * Math.sin(x * 0.04 + i)), 9, 3); }
    if (tipo === 1) { c.fillStyle = '#3f6a86'; c.fillRect(0, h * 0.55, w, h * 0.45); for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(255,255,255,${r() * 0.6})`; c.fillRect(r() * w, h * 0.55 + r() * h * 0.45, 8 + r() * 14, 2); }
      c.fillStyle = '#4a2e1c'; c.beginPath(); c.moveTo(w * 0.4, h * 0.6); c.lineTo(w * 0.62, h * 0.6); c.lineTo(w * 0.58, h * 0.66); c.lineTo(w * 0.44, h * 0.66); c.fill(); c.fillStyle = '#f2ead8'; c.beginPath(); c.moveTo(w * 0.5, h * 0.25); c.lineTo(w * 0.5, h * 0.58); c.lineTo(w * 0.6, h * 0.56); c.fill(); }
    if (tipo === 3) { c.fillStyle = '#c9a24a'; c.beginPath(); c.ellipse(w * 0.45, h * 0.62, 40, 30, 0, 0, 7); c.fill(); c.fillStyle = '#9a2a22'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(w * (0.35 + r() * 0.3), h * (0.5 + r() * 0.15), 10 + r() * 6, 0, 7); c.fill(); } c.fillStyle = '#4a3a2a'; c.fillRect(0, h * 0.78, w, h * 0.22); }
    for (let k = 0; k < 400; k++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '40,30,20'},${r() * 0.07})`; c.fillRect(r() * w, r() * h, 3 + r() * 6, 2 + r() * 3); } });
}
function fotoHist(i) {
  return lienzo('club_foto' + i, 192, 144, (c, w, h) => { const r = azar(300 + i * 13);
    c.fillStyle = '#f2ead8'; c.fillRect(0, 0, w, h); c.fillStyle = '#b39a74'; c.fillRect(10, 10, w - 20, h - 20);
    const g = c.createLinearGradient(0, 10, 0, h - 10); g.addColorStop(0, '#d8c7a6'); g.addColorStop(1, '#7a6448'); c.fillStyle = g; c.fillRect(12, 12, w - 24, h - 24);
    if (i % 3 === 0) { for (let k = 0; k < 9; k++) { const x = 20 + k * 18, y = 60 + r() * 20; c.fillStyle = '#3c2e20'; c.fillRect(x, y, 10, 50); c.beginPath(); c.arc(x + 5, y - 6, 6, 0, 7); c.fill(); } }   // grupo de nadadores
    else if (i % 3 === 1) { c.fillStyle = '#4a3a28'; for (let k = 0; k < 7; k++) c.fillRect(16 + k * 24, 40 + r() * 30, 20, 90); c.fillStyle = '#e0d2b4'; c.fillRect(12, 100, w - 24, 20); }   // edificios y piscina
    else { c.fillStyle = '#5a4630'; c.beginPath(); c.moveTo(12, 90); for (let x = 12; x < w - 12; x += 10) c.lineTo(x, 50 + Math.sin(x * 0.07) * 20); c.lineTo(w - 12, h - 12); c.lineTo(12, h - 12); c.fill(); }
    for (let k = 0; k < 300; k++) { c.fillStyle = `rgba(255,240,210,${r() * 0.12})`; c.fillRect(r() * w, r() * h, 2, 2); } });
}
function cartelTex(ancho, alto, titulo, lineas, fondo = '#f4ecd8', tinta = '#2b1d12') {
  return lienzo('club_cartel_' + titulo, ancho, alto, (c, w, h) => {
    c.fillStyle = fondo; c.fillRect(0, 0, w, h); c.strokeStyle = '#7a5a2a'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#8a1a22'; c.fillRect(30, 30, w - 60, 120); c.fillStyle = '#f6ecd4'; c.font = 'bold 64px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(titulo, w / 2, 92);
    c.fillStyle = tinta; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    let y = 210; for (const [txt, px, neg] of lineas) { c.font = `${neg ? 'bold ' : ''}${px}px Georgia, serif`;
      const pal = txt.split(' '); let lin = '';
      for (const p of pal) { const t = lin ? lin + ' ' + p : p; if (c.measureText(t).width > w - 110) { c.fillText(lin, 55, y); y += px * 1.3; lin = p; } else lin = t; }
      if (lin) { c.fillText(lin, 55, y); y += px * 1.3; } y += px * 0.5; }
  });
}
const FOTO = i => 'foto_club' + (1 + (i * 2) % 5);   // C4 (P1): fotos históricas de Qwen en los marcos rojos (vecinas distintas)
const planoUtil = (m, n, rx = 1) => { const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil(n); if (!t) return; if (rx > 1) { t.wrapS = THREE.RepeatWrapping; const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * rx); uv.needsUpdate = true; } m.material.map = t; m.material.needsUpdate = true; }); };   // N0-UTIL3 (P2): textura de Qwen cuando carga el índice (respaldo: el lienzo procedural)
function relojTex() { return lienzo('club_reloj', 256, 256, (c, w) => { c.fillStyle = '#fbf8ef'; c.beginPath(); c.arc(128, 128, 124, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 6; c.stroke();
  c.fillStyle = '#222'; c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let k = 1; k <= 12; k++) { const a = k * Math.PI / 6 - Math.PI / 2; c.fillText(String(k), 128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98); }
  c.lineWidth = 7; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + 50 * Math.cos(-2.2), 128 + 50 * Math.sin(-2.2)); c.stroke(); c.lineWidth = 4; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + 80 * Math.cos(-0.4), 128 + 80 * Math.sin(-0.4)); c.stroke(); }); }
function letrasTex(texto, fondo, tinta) { return lienzo('club_let_' + texto, 512, 128, (c, w, h) => { c.fillStyle = fondo; c.fillRect(0, 0, w, h); c.fillStyle = tinta; let f = 72; c.font = `bold ${f}px Georgia, serif`; while (c.measureText(texto).width > w * 0.92 && f > 24) { f -= 4; c.font = `bold ${f}px Georgia, serif`; } c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(texto, w / 2, h / 2 + 4); }); }

// ---------------------------------------------------------------- geometrías en caché
const GEO = {};
function balaustre() {   // balaustre torneado de madera (alto 1)
  return GEO.bal ||= new THREE.LatheGeometry([[0.001, 0], [0.042, 0], [0.042, 0.06], [0.028, 0.1], [0.034, 0.2], [0.052, 0.34], [0.056, 0.44], [0.038, 0.55], [0.026, 0.64], [0.032, 0.7], [0.024, 0.78], [0.038, 0.84], [0.038, 0.94], [0.026, 0.97], [0.026, 1.0], [0.001, 1.0]].map(([x, y]) => new THREE.Vector2(x, y)), 8);
}
// cortina de terciopelo con pliegues, recogida hacia `lado` (−1 izq., +1 der.) a la altura tie (fracción); origen abajo al centro, mira +z
function cortinaGeo(w, h, lado, tie = 0.36, recoge = 0.5) {
  const g = new THREE.PlaneGeometry(w, h, 22, 16), p = g.attributes.position, xo = lado * w / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + h / 2, v = y / h;
    const k = v < tie ? recoge * (1 - (tie - v) / tie * 0.55) : recoge * Math.pow(Math.max(0, 1 - (v - tie) / (1 - tie)), 1.6);
    const nx = xo + (x - xo) * (1 - k), pl = 0.05 + 0.05 * (1 - k);
    p.setXYZ(i, nx, y, pl * Math.sin((x + w / 2) / w * Math.PI * 9) + 0.06);
  }
  g.computeVertexNormals(); return g;
}
// cenefa drapeada (bandó con guirnaldas): ancho w, caída d; origen arriba al centro, mira +z
function cenefaGeo(w, d, swags = 2) {
  const g = new THREE.PlaneGeometry(w, d, 40, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) - d / 2, u = (x + w / 2) / w, s = Math.abs(Math.sin(u * Math.PI * swags)), v = -y / d;
    p.setXYZ(i, x, y * (0.45 + 0.55 * s), 0.08 + 0.1 * Math.sin(v * Math.PI) * s + 0.03 * Math.sin(u * 60)); }
  g.computeVertexNormals(); return g;
}

// ======================================================================= la sala
export function salaClub(S, O, fis) {
  const PI = Math.PI, W = S.ancho, L = S.largo, H = S.alto * (S.pisos || 1), hw = W / 2, J = new Junta(), g = new THREE.Group(); g.name = 'kit_sala_club';
  const YP = 2.0, Y1 = 6.4, Y2 = 11.4, LS = 0.4;                   // deck de la piscina, planta de acceso, salón; espesor de losa
  const zPart = -15.15, zPor = -24.0, zCol = -26.0;                // tabique vestíbulo/espejo, portal de la sala del espejo, columnata del salón
  const P0 = { x0: -4, x1: 4, z0: -30, z1: -12 }, YA = YP - 0.3;  // piscina (agua a YA)
  const vacia = S.vacia || /piscina=vacia/.test(location.search);
  const r = azar(77);
  // N0-UTIL3 (G6): R(id, x, y, z, ry, esc) → Junta aparte con el respaldo procedural de esa pieza; al final montarEnKit pone la malla y lo oculta (patrón de kitHospital)
  const RESP = new Map(), R = (id, x, y, z, ry = 0, esc) => { let e = RESP.get(id); if (!e) RESP.set(id, e = { JR: new Junta(), it: [] });
    e.it.push({ id, x: O.x + x, y: O.y + y, z: O.z + z, ry, esc }); return e.JR; };   // y del kit (las mallas del kit van en O)
  const B =(k, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => J.caja(k, x, y, z, sx, sy, sz, ry, rx, rz);
  const C = (k, r0, r1, h, x, y, z, seg = 12) => J.add(k, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z));
  const Sp = (k, rr, x, y, z, ws = 10, hs = 8) => J.add(k, new THREE.SphereGeometry(rr, ws, hs).translate(x, y, z));
  const put = (k, geo, rot, X, Y, Z) => { geo.rotateY(rot); geo.translate(X, Y, Z); J.add(k, geo); };
  const F = (x, y, z, sx, sy, sz, tipo = 'muro') => fis.caja(O.x + x, y, O.z + z, sx, sy, sz, 0, { tipo });
  const Fx0 = (x0, x1, y0, y1, z0, z1, tipo) => F((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), tipo);
  const quatZ = (dy, dz) => { const f = new THREE.Vector3(0, dy, dz).normalize(); return new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.asin(f.y), Math.atan2(f.x, f.z), 0, 'YXZ')); };
  // caja inclinada a lo largo de z (rampa o baranda): de (z0,y0) a (z1,y1); desp = corrimiento a lo largo de la normal "arriba" del plano
  const FR = (x, z0, y0, z1, y1, sx, sy, desp, tipo) => { const q = quatZ(y1 - y0, z1 - z0), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), len = Math.hypot(y1 - y0, z1 - z0);
    fis.caja(O.x + x, (y0 + y1) / 2 + up.y * desp, O.z + (z0 + z1) / 2 + up.z * desp, sx, sy, len, 0, { tipo }, { x: q.x, y: q.y, z: q.z, w: q.w }); };
  const plano = (mat, w, d, x, y, z, abajo = false, rep) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(abajo ? PI / 2 : -PI / 2), mat); m.position.set(O.x + x, y, O.z + z); m.receiveShadow = true;
    if (rep && mat.map) { m.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? d / rep : w / rep); }); m.geometry.attributes.uv.needsUpdate = true; } g.add(m); return m; };
  const rect = (lista, mat, y, abajo, rep) => { for (const [x0, x1, z0, z1] of lista) plano(mat, x1 - x0, Math.abs(z1 - z0), (x0 + x1) / 2, y, (z0 + z1) / 2, abajo, rep); };

  // ============================================================ losas (colisión + canto), pisos y cielos
  const losa = (x0, x1, z0, z1, ytop, k = 'estuco') => { Fx0(x0, x1, ytop - LS, ytop, z0, z1, 'piso'); B(k, (x0 + x1) / 2, ytop - LS / 2, (z0 + z1) / 2, x1 - x0, LS, Math.abs(z1 - z0)); };
  const deckR = [[-hw, hw, 0, P0.z1], [-hw, hw, P0.z0, -L], [-hw, P0.x0, P0.z1, P0.z0], [P0.x1, hw, P0.z1, P0.z0]];
  for (const [a, b, c, d] of deckR) losa(a, b, c, d, YP, 'estucoZ');
  const zSu = -2.8, zSd = -10.3, xS0 = -hw, xS1 = -8.6;            // hueco de la escalera de servicio a la piscina
  const y1R = [[-hw, hw, 0, zSu], [xS1, hw, zSu, zSd], [-hw, hw, zSd, -L]];
  for (const [a, b, c, d] of y1R) losa(a, b, c, d, Y1);
  const zM = -6.02, xG = 6.6;                                     // mezanine (z 0..zM) y galerías laterales (|x| > xG) sobre el vestíbulo
  const y2R = [[-hw, hw, 0, zM], [-hw, -xG, zM, zPart], [xG, hw, zM, zPart], [-hw, hw, zPart, -L]];
  for (const [a, b, c, d] of y2R) losa(a, b, c, d, Y2);
  // pisos
  const mDeck = new THREE.MeshStandardMaterial({ map: TX.deck(), roughness: 0.85 });
  rect(deckR, mDeck, YP + 0.01, false, 3);
  const mMos = new THREE.MeshStandardMaterial({ map: TX.mosaico(), roughness: 0.22, metalness: 0.05 });
  rect([[-hw, hw, 0, zSu], [xS1, hw, zSu, zSd], [-hw, hw, zSd, zPart]], mMos, Y1 + 0.012, false, 1.6);
  const mPar = new THREE.MeshStandardMaterial({ map: TX.parquet(), roughness: 0.28, metalness: 0.05 });
  rect([[-hw, hw, zPart - 0.15, -L]], mPar, Y1 + 0.012, false, 1.4);
  const mAlf = new THREE.MeshStandardMaterial({ map: TX.alfombra(), roughness: 1 });
  rect(y2R, mAlf, Y2 + 0.012, false, 1.2);
  // cielos
  const mPla = new THREE.MeshStandardMaterial({ map: TX.placas(), roughness: 0.9 });
  rect([[-hw, hw, 0, zSu], [xS1, hw, zSu, zSd], [-hw, hw, zSd, -L]], mPla, Y1 - LS - 0.012, true, 1.2);
  const mLata = new THREE.MeshStandardMaterial({ map: TX.lata(), roughness: 0.55, metalness: 0.15 });
  rect([[-hw, hw, 0, zM], [-hw, -xG, zM, zPart], [xG, hw, zM, zPart]], mLata, Y2 - LS - 0.012, true, 1.2);
  rect([[-xG, xG, zM, zPart]], mLata, H - 0.02, true, 1.2);
  const mCielo = new THREE.MeshStandardMaterial({ color: 0xf6eedb, roughness: 0.95 });
  rect([[-hw, hw, 0, zM], [-hw, -xG, zM, zPart], [xG, hw, zM, zPart], [-hw, hw, zPart, -L]], mCielo, H - 0.02, true);
  rect([[-hw, hw, zPart - 0.15, -L]], mCielo, Y2 - LS - 0.012, true);
  // cantos de las losas en el pozo de la escalera (moldura de madera)
  B('maderaOsc', 0, Y2 - 0.2, zM - 0.02, 2 * xG, 0.44, 0.08); for (const s of [-1, 1]) B('maderaOsc', s * xG, Y2 - 0.2, (zM + zPart) / 2, 0.08, 0.44, zM - zPart);
  B('maderaOsc', xS1 - 0.02, Y1 - 0.2, (zSu + zSd) / 2, 0.08, 0.44, zSu - zSd); B('maderaOsc', (xS0 + xS1) / 2, Y1 - 0.2, zSd - 0.02, xS1 - xS0, 0.44, 0.08);

  // ============================================================ ayudas: balaustrada torneada, escaleras, ventanas, cortinas, lámparas
  const balGeo = balaustre();
  // baranda de madera torneada de (x0,z0,y0) a (x1,z1,y1): recta en x (plana) o en z (puede subir); con colisión
  const baranda = (x0, z0, y0, x1, z1, y1, alto = 0.95, col = true, paso = 0.16) => {
    const enX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = enX ? Math.abs(x1 - x0) : Math.hypot(z1 - z0, y1 - y0), n = Math.max(1, Math.round((enX ? Math.abs(x1 - x0) : Math.abs(z1 - z0)) / paso));
    const ang = enX ? 0 : Math.atan2(-(y1 - y0), z1 - z0), xm = (x0 + x1) / 2, zm = (z0 + z1) / 2, ym = (y0 + y1) / 2;
    if (enX) { B('maderaMiel', xm, y0 + alto - 0.04, zm, len, 0.08, 0.11); B('maderaOsc', xm, y0 + 0.07, zm, len, 0.08, 0.1); }
    else { B('maderaMiel', xm, ym + alto - 0.04, zm, 0.11, 0.08, len, 0, ang); B('maderaOsc', xm, ym + 0.07, zm, 0.1, 0.08, len, 0, ang); }
    const hb = alto - 0.19;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t;
      J.add('maderaMiel', balGeo.clone().scale(1, hb, 1).translate(x, y + 0.11, z)); }
    if (col) { if (enX) Fx0(Math.min(x0, x1), Math.max(x0, x1), y0, y0 + 1.05, z0 - 0.06, z0 + 0.06); else FR(x0, z0, y0, z1, y1, 0.14, 1.05, 0.52, 'muro'); }
  };
  const poste = (x, y, z, alto = 1.15) => { B('maderaMiel', x, y + alto / 2, z, 0.2, alto, 0.2); B('maderaOsc', x, y + 0.16, z, 0.24, 0.12, 0.24); B('maderaOsc', x, y + alto - 0.1, z, 0.26, 0.08, 0.26);
    J.add('maderaMiel', new THREE.LatheGeometry([[0.001, 0], [0.09, 0], [0.06, 0.08], [0.1, 0.16], [0.04, 0.26], [0.001, 0.3]].map(([a, b]) => new THREE.Vector2(a, b)), 10).translate(x, y + alto - 0.06, z)); };
  // escalera a lo largo de z: n peldaños de alto `sube` y huella `huella`; z0 = pie del 1.er peldaño, dir ±1 (hacia donde sube); relleno macizo o no
  const escalera = (xc, ancho, z0, y0, n, sube, huella, dir, op = {}) => {
    for (let i = 0; i < n; i++) {
      const top = y0 + (i + 1) * sube, zc = z0 + dir * (i + 0.5) * huella, zf = z0 + dir * i * huella;
      B(op.huella ?? 'maderaMiel', xc, top - 0.025, zc - dir * 0.015, ancho, 0.05, huella + 0.03);
      if (op.macizo) B(op.relleno ?? 'maderaOsc', xc, (y0 + top - 0.05) / 2, zc, ancho - 0.08, top - 0.05 - y0, huella);
      else { B('maderaOsc', xc, top - sube / 2 - 0.02, zf + dir * 0.02, ancho - 0.06, sube - 0.04, 0.03); }
      if (op.alfombra) { const a = op.alfombra; B('alfombraRoja', xc, top + 0.004, zc, a, 0.012, huella); B('alfombraRoja', xc, top - sube / 2, zf + dir * 0.005 - dir * 0.012, a, sube, 0.012);
        J.add('laton', new THREE.CylinderGeometry(0.012, 0.012, a + 0.12, 6).rotateZ(PI / 2).translate(xc, top - sube + 0.03, zf + dir * 0.03)); }
    }
    // rampa de colisión por la línea de las narices de los peldaños
    const za = z0 - dir * huella, zb = z0 + dir * (n - 1) * huella;
    FR(xc, za, y0, zb, y0 + n * sube, ancho, 0.6, -0.32, 'escalera');
    if (!op.macizo) {   // cielo inclinado bajo los peldaños y zancas
      const q = quatZ(n * sube, dir * n * huella), e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      const geo = new THREE.BoxGeometry(ancho, 0.06, Math.hypot(n * sube, n * huella)); geo.applyQuaternion(q); geo.translate(xc, y0 + n * sube / 2 - 0.25, z0 + dir * n * huella / 2); J.add('estuco', geo);
      for (const s of [-1, 1]) { const zg = new THREE.BoxGeometry(0.08, 0.42, Math.hypot(n * sube, n * huella)); zg.applyQuaternion(q); zg.translate(xc + s * ancho / 2, y0 + n * sube / 2 - 0.05, z0 + dir * n * huella / 2); J.add('maderaOsc', zg); }
      void e;
    } else for (let i = 0; i < n; i += 2) {   // costados macizos: colisión escalonada bajo la rampa (no se entra por el lado)
      const top = y0 + (i + 1) * sube - 0.35; if (top <= y0 + 0.05) continue;
      F(xc, (y0 + top) / 2, z0 + dir * (i + 1) * huella, ancho, top - y0, 2 * huella, 'muro'); }
  };
  // ventana de medio punto con abanico, vista desde dentro. (cx: centro a lo largo del muro; muro con rot como `put`)
  const vista = new THREE.MeshBasicMaterial({ map: TX.vista(), color: 0xe4e8ea }); vista.userData.vistaVentana = true;   // N0-VENTANAS-REALES: js/motor/vistaVentanas.js la cambia por el mundo real
  const ventanaArco = (rot, X, Z, y0, w, hR, cortinas = true, alto = Y2 + 4.6) => {
    const rr = w / 2, sh = new THREE.Shape(); sh.moveTo(-rr, 0); sh.lineTo(rr, 0); sh.lineTo(rr, hR); sh.absarc(0, hR, rr, 0, PI, false); sh.lineTo(-rr, 0);
    const gv = new THREE.ShapeGeometry(sh, 16), uv = gv.attributes.uv, pv = gv.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pv.getX(i) + rr) / w, pv.getY(i) / (hR + rr));
    gv.translate(0, y0, 0.03); gv.rotateY(rot); gv.translate(X, 0, Z); const mv = new THREE.Mesh(gv, vista); mv.position.copy(O); g.add(mv);
    const L2 = (geo) => put('blancoV', geo, rot, X, 0, Z);
    // marco: jambas, arquivolta, travesaño, parteluz y rayos del abanico, alféizar
    const n = 12; for (let i = 0; i < n; i++) { const a0 = PI * i / n, a1 = PI * (i + 1) / n, la = rr * (a1 - a0) + 0.02;
      L2(new THREE.BoxGeometry(la, 0.1, 0.1).rotateZ((a0 + a1) / 2 + PI / 2).translate(Math.cos((a0 + a1) / 2) * rr, y0 + hR + Math.sin((a0 + a1) / 2) * rr, 0.08));
      L2(new THREE.BoxGeometry(la * 1.12, 0.12, 0.2).rotateZ((a0 + a1) / 2 + PI / 2).translate(Math.cos((a0 + a1) / 2) * (rr + 0.1), y0 + hR + Math.sin((a0 + a1) / 2) * (rr + 0.1), 0.1)); }
    for (let j = 1; j < 6; j++) { const a = PI * j / 6; L2(new THREE.BoxGeometry(rr * 0.82, 0.035, 0.04).rotateZ(a).translate(Math.cos(a) * rr * 0.55, y0 + hR + Math.sin(a) * rr * 0.55, 0.07)); }
    L2(new THREE.TorusGeometry(rr * 0.18, 0.025, 4, 12, PI).translate(0, y0 + hR, 0.07));
    for (const s of [-1, 1]) { L2(new THREE.BoxGeometry(0.1, hR, 0.1).translate(s * rr, y0 + hR / 2, 0.08)); L2(new THREE.BoxGeometry(0.12, hR, 0.2).translate(s * (rr + 0.1), y0 + hR / 2, 0.1)); }
    L2(new THREE.BoxGeometry(w, 0.08, 0.08).translate(0, y0 + hR, 0.08)); L2(new THREE.BoxGeometry(0.05, hR, 0.05).translate(0, y0 + hR / 2, 0.07));
    for (const yy of [0.33, 0.66]) L2(new THREE.BoxGeometry(w, 0.035, 0.04).translate(0, y0 + hR * yy, 0.07));
    L2(new THREE.BoxGeometry(w + 0.4, 0.06, 0.28).translate(0, y0 - 0.03, 0.14));
    if (cortinas) {   // cortinas de terciopelo burdeo recogidas, cenefa drapeada con flecos dorados y barral
      const hc = alto - 0.25 - (y0 - 0.6), wc = 1.0;
      for (const s of [-1, 1]) put('cortina', cortinaGeo(wc, hc, s, 0.38, 0.45).translate(s * (rr + 0.25), y0 - 0.6, 0.06), rot, X, 0, Z);
      put('cortina', cenefaGeo(w + 1.6, 0.85, 2).translate(0, alto - 0.25, 0.08), rot, X, 0, Z);
      put('oro', new THREE.BoxGeometry(w + 1.7, 0.05, 0.05).translate(0, alto - 0.23, 0.2), rot, X, 0, Z);
      for (const s of [-1, 1]) put('oro', new THREE.SphereGeometry(0.06, 8, 6).translate(s * (rr + 0.25), y0 - 0.6 + hc * 0.38, 0.2), rot, X, 0, Z);
    }
  };
  // ventana rectangular de guillotina (planta de acceso, sala del espejo, zócalo)
  const ventanaRect = (rot, X, Z, yc, w, h, op = {}) => {
    const gv = new THREE.PlaneGeometry(w, h); gv.translate(0, yc, 0.03); gv.rotateY(rot); gv.translate(X, 0, Z); const mv = new THREE.Mesh(gv, vista); mv.position.copy(O); g.add(mv);
    const L2 = (geo, k = 'blancoV') => put(k, geo, rot, X, 0, Z);
    for (const s of [-1, 1]) { L2(new THREE.BoxGeometry(0.1, h + 0.1, 0.1).translate(s * w / 2, yc, 0.08)); L2(new THREE.BoxGeometry(0.14, h + 0.3, 0.18).translate(s * (w / 2 + 0.1), yc, 0.09)); }
    L2(new THREE.BoxGeometry(w + 0.4, 0.14, 0.18).translate(0, yc + h / 2 + 0.1, 0.09)); L2(new THREE.BoxGeometry(w + 0.4, 0.06, 0.26).translate(0, yc - h / 2 - 0.03, 0.13));
    L2(new THREE.BoxGeometry(w, 0.06, 0.06).translate(0, yc, 0.08)); L2(new THREE.BoxGeometry(0.04, h, 0.04).translate(0, yc, 0.07));
    if (op.reja) for (let k = 0; k < 7; k++) L2(new THREE.CylinderGeometry(0.015, 0.015, h, 5).translate(-w / 2 + (k + 0.5) * w / 7, yc, 0.12), 'fierro');
    if (op.cortinas) for (const s of [-1, 1]) put(op.cortinas, cortinaGeo(0.8, op.hc ?? h + 0.9, s, 0.42, 0.4).translate(s * (w / 2 + 0.25), yc - h / 2 - 0.3, 0.07), rot, X, 0, Z);
  };
  // araña de bronce con brazos y tulipas ámbar (cuelga del cielo yTecho; corona a y)
  const arana = (x, y, z, yTecho, n = 8, rr = 0.75, pisos = 2, conLuz = 0) => {
    C('bronce', 0.018, 0.018, yTecho - y, x, (y + yTecho) / 2, z, 6); C('bronce', 0.2, 0.06, 0.08, x, yTecho - 0.04, z, 12);
    { const JA = R(pisos < 2 ? 'arana_chica' : 'arana_club', x, y, z, 0, pisos < 2 ? undefined : [rr / 0.8, rr / 0.8, rr / 0.8]), J = JA, C = (k, r0, r1, h, x, y, z, seg = 12) => JA.add(k, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z)), Sp = (k, rr, x, y, z, ws = 10, hs = 8) => JA.add(k, new THREE.SphereGeometry(rr, ws, hs).translate(x, y, z));   // C4: araña FINA (mueblesFinos_club.js); el cable y el florón siguen aquí, esto es su respaldo
    Sp('bronce', 0.13, x, y - 0.05, z, 12, 8); C('bronce', 0.03, 0.1, 0.3, x, y - 0.3, z, 10); Sp('bronce', 0.05, x, y - 0.5, z, 8, 6);
    for (let p = 0; p < pisos; p++) { const R = rr * (1 - p * 0.35), yy = y + p * 0.32, m = n - p * 3;
      J.add('bronce', new THREE.TorusGeometry(R * 0.55, 0.014, 5, 24).rotateX(PI / 2).translate(x, yy - 0.08, z));
      for (let i = 0; i < m; i++) { const a = (i + p * 0.5) / m * 2 * PI, cx = x + Math.cos(a) * R, cz = z + Math.sin(a) * R;
        const brazo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, yy, z), new THREE.Vector3(x + Math.cos(a) * R * 0.6, yy - 0.28, z + Math.sin(a) * R * 0.6), new THREE.Vector3(cx, yy + 0.02, cz)), 6, 0.014, 4); J.add('bronce', brazo);
        C('bronce', 0.035, 0.02, 0.06, cx, yy + 0.05, cz, 8);
        J.add('tulipa', new THREE.CylinderGeometry(0.085, 0.035, 0.16, 10, 1, true).translate(cx, yy + 0.16, cz)); Sp('foco', 0.032, cx, yy + 0.13, cz, 6, 5); } } }
    if (conLuz) { const l = new THREE.PointLight(0xffd29a, conLuz, 11, 2); l.position.set(O.x + x, y - 0.1, O.z + z); g.add(l); }
  };
  const luz = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 2); l.position.set(O.x + x, y, O.z + z); g.add(l); return l; };
  // columna jónica blanca (base, fuste con estrías, capitel con volutas); y0 = pie, h = alto total
  const jonica = (x, y0, z, h, rc = 0.2, k = 'blanco') => {
    C(k, rc * 1.45, rc * 1.5, 0.1, x, y0 + 0.05, z, 16); J.add(k, new THREE.TorusGeometry(rc * 1.2, rc * 0.18, 6, 16).rotateX(PI / 2).translate(x, y0 + 0.14, z));
    const hf = h - 0.42; C(k, rc * 0.88, rc, hf, x, y0 + 0.2 + hf / 2, z, 16);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; B(k + 'S', x + Math.cos(a) * rc * 0.93, y0 + 0.2 + hf / 2, z + Math.sin(a) * rc * 0.93, 0.025, hf * 0.94, 0.025, -a); }
    const yc = y0 + h - 0.22; C(k, rc * 1.05, rc * 0.9, 0.1, x, yc, z, 16);
    for (const s of [-1, 1]) for (const d of [-1, 1]) J.add(k, new THREE.TorusGeometry(rc * 0.28, rc * 0.11, 6, 14).translate(x + s * rc * 1.05, yc + 0.02, z + d * rc * 0.9));
    B(k, x, yc + 0.1, z, rc * 2.4, 0.1, rc * 2.0); B(k, x, y0 + h - 0.04, z, rc * 2.7, 0.08, rc * 2.7);
  };
  const cuadro = (rot, X, Y, Z, w, h, tex, marco = 'oro', fondo = 0.05, plano) => {   // C4 (P1): plano = nombre de la foto/óleo de Qwen (respaldo: el lienzo) put(marco, new THREE.BoxGeometry(w + 0.16, h + 0.16, fondo).translate(0, 0, fondo / 2 + 0.02), rot, X, Y, Z);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(rot), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, polygonOffset: !/[?&]r8=0/.test(location.search), polygonOffsetFactor: 0, polygonOffsetUnits: -100 })); const d = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)).multiplyScalar(fondo + 0.025);
    m.position.set(O.x + X + d.x, Y, O.z + Z + d.z); g.add(m); if (plano) planoUtil(m, plano); return m; };
  // friso/zócalo de madera a lo largo de un muro: de u0 a u1 sobre la recta del muro (rot como put); y0 piso; h alto; salta puertas [u0,u1]
  const friso = (rot, ax, az, bx, bz, y0, h, k = 'maderaOsc', huecos = []) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len; let tr = [[0, len]];
    for (const [a, b] of huecos) tr = tr.flatMap(([p, q]) => [[p, Math.min(q, a)], [Math.max(p, b), q]]).filter(([p, q]) => q - p > 0.1);
    for (const [p, q] of tr) { const m = (p + q) / 2, X = ax + ux * m, Z = az + uz * m;
      put(k, new THREE.BoxGeometry(q - p, h, 0.05).translate(0, y0 + h / 2, 0.025), rot, X, 0, Z); put('maderaMiel', new THREE.BoxGeometry(q - p, 0.06, 0.09).translate(0, y0 + h, 0.045), rot, X, 0, Z);
      put('maderaOsc', new THREE.BoxGeometry(q - p, 0.12, 0.07).translate(0, y0 + 0.06, 0.035), rot, X, 0, Z);
      for (let u = p + 0.6; u < q - 0.3; u += 1.1) put('maderaMiel', new THREE.BoxGeometry(0.05, h - 0.2, 0.07).translate(0, y0 + h / 2, 0.035), rot, ax + ux * u, 0, az + uz * u); }
  };
  const cornisa = (y, y0Muro) => { void y0Muro; for (const [x, z, sx, sz] of [[0, -0.06, W, 0.12], [0, -L + 0.06, W, 0.12], [-hw + 0.06, -L / 2, 0.12, L], [hw - 0.06, -L / 2, 0.12, L]]) { B('blanco', x, y - 0.1, z, sx, 0.2, sz); B('blanco', x, y - 0.24, z, sx * (sx > 1 ? 1 : 0.7), 0.08, sz * (sz > 1 ? 1 : 0.7)); } };
  // N2-C39: puerta de tableros con marco recto. Capas en z (local, hacia la sala): friso 0-0,05 · hoja 0,05-0,10 · tableros 0,10-0,125 (la hoja va
  // DELANTE del friso: antes quedaba a ras y el friso se «comía» su mitad inferior) · marco 0-0,14 · dintel 0-0,16 · pomo 0,15
  const puertaMadera = (rot, X, Y, Z, w = 1.4, h = 2.6, k = 'maderaOsc', hoja = 'maderaMiel') => {
    put(hoja, new THREE.BoxGeometry(w, h, 0.05).translate(0, Y + h / 2, 0.075), rot, X, 0, Z);
    for (const s of [-1, 1]) put(k, new THREE.BoxGeometry(0.14, h + 0.14, 0.14).translate(s * (w / 2 + 0.07), Y + h / 2 + 0.07, 0.07), rot, X, 0, Z);
    for (const s of [-1, 1]) for (const [y0, y1] of [[0.08, 0.46], [0.54, 0.92]]) put(k === 'puertaBlanca' ? 'puertaTablero' : k, new THREE.BoxGeometry(w / 2 - 0.2, h * (y1 - y0), 0.03).translate(s * w / 4, Y + h * (y0 + y1) / 2, 0.115), rot, X, 0, Z);
    put(k, new THREE.BoxGeometry(w + 0.42, 0.18, 0.16).translate(0, Y + h + 0.16, 0.08), rot, X, 0, Z);
    put('laton', new THREE.SphereGeometry(0.045, 10, 8).translate(w / 2 - 0.15, Y + 1.05, 0.16), rot, X, 0, Z);
  };

  // ============================================================ ZÓCALO: la piscina temperada
  { const { x0, x1, z0, z1 } = P0, wP = x1 - x0, lP = z1 - z0, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, zHondo = -21;
    const yF = z => z > zHondo ? 0.9 * (z - zHondo) / (z1 - zHondo) : 0;   // fondo inclinado: 0,9 en la parte baja (z1) a 0 en la honda
    // vaso: muros de colisión del fondo a la cubierta, baldosa blanca, fondo inclinado con 2 franjas de carril
    for (const [x, z, sx, sz] of [[xc, z1 + 0.15, wP + 0.6, 0.3], [xc, z0 - 0.15, wP + 0.6, 0.3], [x0 - 0.15, zc, 0.3, lP], [x1 + 0.15, zc, 0.3, lP]]) F(x, YP / 2, z, sx, YP, sz);
    FR(xc, z1, 0.9, zHondo, 0, wP, 0.5, -0.25, 'piso');
    const mBal = new THREE.MeshStandardMaterial({ map: TX.baldosaPis(), roughness: 0.35, polygonOffset: !/[?&]r8=0/.test(location.search), polygonOffsetFactor: 0, polygonOffsetUnits: -30 });   // R-8: encima del canto de la losa
    const pared = (w, h, rot, X, Y, Z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(rot), mBal); m.position.set(O.x + X, Y, O.z + Z); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.2, uv.getY(i) * h / 1.2); g.add(m); };
    pared(wP, YP, 0, xc, YP / 2, z0 + 0.001); pared(wP, YP, PI, xc, YP / 2, z1 - 0.001); pared(lP, YP, PI / 2, x0 + 0.001, YP / 2, zc); pared(lP, YP, -PI / 2, x1 - 0.001, YP / 2, zc);
    { const geo = new THREE.PlaneGeometry(wP, lP, 1, 24).rotateX(-PI / 2), p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) { const z = p.getZ(i) + zc; p.setY(i, yF(z) + 0.01); uv.setXY(i, uv.getX(i) * wP / 1.2, uv.getY(i) * lP / 1.2); } geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mBal); m.position.set(O.x + xc, 0, O.z + zc); g.add(m);
      for (const s of [-1, 1]) { const fr = new THREE.PlaneGeometry(0.28, lP - 2, 1, 24).rotateX(-PI / 2), q = fr.attributes.position; for (let i = 0; i < q.count; i++) q.setY(i, yF(q.getZ(i) + zc) + 0.02); fr.computeVertexNormals();
        const mf = new THREE.Mesh(fr, new THREE.MeshStandardMaterial({ color: 0x1d3f74, roughness: 0.5 })); mf.position.set(O.x + xc + s * 1.35, 0, O.z + zc); g.add(mf);
        for (const zz of [z1 - 1.0, z0 + 1.0]) B('azulCarril', xc + s * 1.35, yF(zz) + 0.02, zz, 0.9, 0.02, 0.28); } }
    // focos redondos (ojos de buey) bajo el agua en los muros largos y en los testeros
    for (let z = z0 + 2; z < z1 - 1; z += 3.2) for (const s of [-1, 1]) put('focoPisc', new THREE.CircleGeometry(0.14, 16).translate(0, 1.05, 0.012), s < 0 ? PI / 2 : -PI / 2, s < 0 ? x0 : x1, 0, z);
    for (const x of [-2, 2]) { put('focoPisc', new THREE.CircleGeometry(0.14, 16).translate(0, 1.05, 0.012), 0, x, 0, z0); put('focoPisc', new THREE.CircleGeometry(0.14, 16).translate(0, 1.1, 0.012), PI, x, 0, z1); }
    // borde superior AZUL ancho (bordillo) con canto redondeado y rebalse
    const bA = 0.55, bH = 0.32;
    for (const [x, z, sx, sz] of [[xc, z1 + bA / 2, wP + 2 * bA, bA], [xc, z0 - bA / 2, wP + 2 * bA, bA], [x0 - bA / 2, zc, bA, lP], [x1 + bA / 2, zc, bA, lP]]) {
      B('azulBorde', x, YP + bH / 2, z, sx, bH, sz); F(x, YP + bH / 2, z, sx, bH, sz, 'piso'); }
    for (const [x, z, sx, sz] of [[xc, z1 + 0.03, wP, 0.1], [xc, z0 - 0.03, wP, 0.1], [x0 - 0.03, zc, 0.1, lP], [x1 + 0.03, zc, 0.1, lP]]) B('azulOsc', x, YP - 0.12, z, sx, 0.16, sz);   // canaleta de rebalse
    // barandas tubulares blancas alrededor (con 2 pasos en las escalerillas de la parte baja)
    const dB = bA + 0.45, xa = x0 - dB, xb = x1 + dB, za = z0 - dB, zb = z1 + dB, yb = YP + bH;
    const tubo = (a, b, rr = 0.03) => { const d = new THREE.Vector3().subVectors(b, a), geo = new THREE.CylinderGeometry(rr, rr, d.length(), 8); geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); J.add('tuboBlanco', geo); };
    const V = (x, y, z) => new THREE.Vector3(x, y, z), zEsc = z1 - 1.6, hueco = 0.9;
    const tramosLargo = [[za, zEsc - hueco / 2], [zEsc + hueco / 2, zb]];
    for (const s of [-1, 1]) { const x = s < 0 ? xa : xb;
      for (const [p, q] of tramosLargo) { for (const yy of [yb + 0.95, yb + 0.5]) tubo(V(x, yy, p), V(x, yy, q)); for (let z = p; z <= q + 0.01; z += Math.max(1.0, (q - p) / Math.round((q - p) / 2.2))) tubo(V(x, yb - bH, z), V(x, yb + 0.97, z), 0.035);
        Fx0(x - 0.05, x + 0.05, yb - bH, yb + 1.0, p, q); } }
    for (const z of [za, zb]) { for (const yy of [yb + 0.95, yb + 0.5]) tubo(V(xa, yy, z), V(xb, yy, z)); for (let x = xa; x <= xb + 0.01; x += (xb - xa) / 5) tubo(V(x, yb - bH, z), V(x, yb + 0.97, z), 0.035); Fx0(xa, xb, yb - bH, yb + 1.0, z - 0.05, z + 0.05); }
    for (const s of [-1, 1]) for (const z of [za, zb]) J.add('tuboBlanco', new THREE.TorusGeometry(0.12, 0.03, 6, 8, PI / 2).rotateX(PI / 2).translate(s < 0 ? xa + 0.12 : xb - 0.12, yb + 0.95, z));   // codos
    // escalerillas metálicas en los pasos (pasamanos curvo sobre el borde y peldaños dentro del agua)
    for (const s of [-1, 1]) { const xe = s < 0 ? x0 : x1, J = R('escalerilla', xe, YP, zEsc, -s * PI / 2), B = (k, ...a) => J.caja(k, ...a);   // C4: escalerilla FINA (pasamanos sobre el borde y hacia el agua; la vieja bajaba por dentro del muro)
      for (const dz of [-0.3, 0.3]) { const cv = new THREE.CatmullRomCurve3([V(xe - s * 0.85, YP + bH, zEsc + dz), V(xe - s * 0.85, yb + 0.9, zEsc + dz), V(xe - s * 0.4, yb + 1.05, zEsc + dz), V(xe + s * 0.05, yb + 0.7, zEsc + dz), V(xe + s * 0.15, YP - 0.2, zEsc + dz), V(xe + s * 0.15, yF(zEsc) + 0.3, zEsc + dz)]);
        J.add('cromo', new THREE.TubeGeometry(cv, 24, 0.022, 6)); }
      for (let k = 0; k < 4; k++) B('cromo', xe + s * 0.2, YP - 0.35 - k * 0.3, zEsc, 0.12, 0.03, 0.62);
    }
    // agua tibia con brillo que se mueve y vapor suave (más vapor en invierno), o vacía como en las fotos
    if (!vacia) {
      const tA = TX.agua().clone(); tA.needsUpdate = true; tA.wrapS = tA.wrapT = THREE.RepeatWrapping; tA.repeat.set(wP / 3, lP / 3);
      const mA = new THREE.MeshStandardMaterial({ map: tA, color: 0xbfe6ee, transparent: true, opacity: 0.62, roughness: 0.12, metalness: 0.1, depthWrite: false });
      const agua = new THREE.Mesh(new THREE.PlaneGeometry(wP, lP).rotateX(-PI / 2), mA); agua.position.set(O.x + xc, YA, O.z + zc); agua.renderOrder = 2; agua.name = 'club_agua'; g.add(agua);
      const vol = new THREE.Mesh(new THREE.BoxGeometry(wP - 0.02, YA - 0.02, lP - 0.02), new THREE.MeshBasicMaterial({ color: 0x58b8cc, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.BackSide })); vol.position.set(O.x + xc, YA / 2, O.z + zc); g.add(vol);
      const nV = Math.round(10 + 14 * (S.vapor ?? 0.5)), mV = new THREE.SpriteMaterial({ map: TX.vapor(), transparent: true, depthWrite: false, opacity: 0.1 + 0.16 * (S.vapor ?? 0.5), color: 0xffffff }), vap = [];
      for (let i = 0; i < nV; i++) { const sp = new THREE.Sprite(mV); const s = 1.6 + r() * 2.2; sp.scale.set(s, s * 0.7, 1); sp.userData = { x: x0 + 0.6 + r() * (wP - 1.2), z: z0 + 0.6 + r() * (lP - 1.2), t: r() * 6, v: 0.12 + r() * 0.12 }; vap.push(sp); g.add(sp); }
      let t0 = performance.now();
      agua.onBeforeRender = () => { const t = performance.now(), dt = Math.min(0.1, (t - t0) / 1000); t0 = t; tA.offset.x += dt * 0.02; tA.offset.y += dt * 0.013;
        for (const sp of vap) { const u = sp.userData; u.t += dt * u.v; const f = u.t % 3; sp.position.set(O.x + u.x + Math.sin(u.t * 1.3) * 0.3, YA + 0.2 + f * 0.9, O.z + u.z); sp.material.opacity = mV.opacity; } };
      g.userData.agua = [{ x0: O.x + x0, x1: O.x + x1, z0: O.z + z0, z1: O.z + z1, y: YA, fondo: 0 }];
    }
    // bancas blancas con respaldo, camarines, reloj, fotos históricas en marcos rojos, salvavidas, cielo con lámparas
    const banca = (x, z, rot, largo = 2.2) => { const JB = R('banca_piscina', x, YP, z, rot), put = (k, geo, r, X, Y, Z) => { geo.rotateY(r); geo.translate(X, Y, Z); JB.add(k, geo); };   // C4: banca FINA (costados de fierro y tablillas); las cajas quedan de respaldo
      put('blanco', new THREE.BoxGeometry(largo, 0.06, 0.45).translate(0, YP + 0.45, 0), rot, x, 0, z); put('blanco', new THREE.BoxGeometry(largo, 0.4, 0.05).translate(0, YP + 0.75, -0.22), rot, x, 0, z);
      for (const s of [-1, 1]) put('blanco', new THREE.BoxGeometry(0.06, 0.45, 0.45).translate(s * (largo / 2 - 0.1), YP + 0.22, 0), rot, x, 0, z);
      const ax = Math.abs(Math.cos(rot)) > 0.5; Fx0(x - (ax ? largo / 2 : 0.25), x + (ax ? largo / 2 : 0.25), YP, YP + 0.9, z - (ax ? 0.25 : largo / 2), z + (ax ? 0.25 : largo / 2)); };
    for (const z of [-16, -21, -26, -31]) banca(-hw + 0.45, z, PI / 2);   // R-9b: una banca bajo cada cuadro (paños entre ventanas)
    banca(-2.5, -32.8, 0); banca(2.5, -32.8, 0);
    for (const [z, t] of [[-5.2, 'DAMAS'], [-8.4, 'VARONES'], [-31.5, 'CAMARINES']]) { puertaMadera(-PI / 2, hw, YP, z, 1.1, 2.3, 'puertaBlanca', 'puertaBlanca');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22).rotateY(-PI / 2), new THREE.MeshStandardMaterial({ map: letrasTex(t, '#1d3f74', '#f4f1e8') })); m.position.set(O.x + hw - 0.1, YP + 2.75, O.z + z); g.add(m); }
    { const m = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshStandardMaterial({ map: relojTex(), roughness: 0.4 })); planoUtil(m, 'reloj');   /* N0-UTIL3 (P2): esfera de Qwen */ m.position.set(O.x + 3.0, YP + 3.1, O.z - L + 0.06); g.add(m);
      J.add('negro', new THREE.TorusGeometry(0.35, 0.035, 6, 32).translate(3.0, YP + 3.1, -L + 0.06)); }   // R-9b: reloj centrado entre las ventanas x 0 y 6
    // R-9b (14-11-2026, Diego): muros largos compuestos. Ventanas con reja a ritmo parejo (cada 5 m: z −13,5 −18,5 −23,5 −28,5, centradas con la piscina);
    // cuadros y salvavidas al centro de los paños ENTRE ventanas (z −16, −21, −26; al oeste además −31); nada sobre las puertas ni sus letreros.
    const zVen = [-13.5, -18.5, -23.5, -28.5];
    [-16, -21, -26, -31].forEach((z, i) => cuadro(PI / 2, -hw, YP + 2.55, z, 0.95, 0.7, fotoHist(i), 'rojoMarco', 0.04, FOTO(i)));
    [-16, -26].forEach((z, i) => cuadro(-PI / 2, hw, YP + 2.55, z, 0.95, 0.7, fotoHist(i + 4), 'rojoMarco', 0.04, FOTO(i + 4)));
    J.add('rojo', new THREE.TorusGeometry(0.3, 0.08, 8, 20).rotateY(PI / 2).translate(hw - 0.1, YP + 1.9, -21));
    // muro norte del zócalo: letrero de la piscina, fotos, bancas y percheros
    { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshStandardMaterial({ map: letrasTex('PISCINA TEMPERADA', '#1d3f74', '#f4f1e8'), roughness: 0.6 })); m.position.set(O.x + 1.5, YP + 3.0, O.z - 0.07); m.rotation.y = PI; g.add(m); }
    for (const [x, i] of [[-5.5, 6], [-2.6, 7], [4.6, 8], [7.4, 9]]) cuadro(PI, x, YP + 2.5, 0, 0.95, 0.7, fotoHist(i), 'rojoMarco', 0.04, FOTO(i));
    banca(-2.5, -0.5, PI); banca(4.5, -0.5, PI); cuadro(-PI / 2, hw, YP + 2.55, -1.8, 0.95, 0.7, fotoHist(10), 'rojoMarco', 0.04, FOTO(10));
    // percheros: ahora con su tabla blanca detrás (antes eran 6 ganchos sueltos = «puntitos flotando»), centrados entre la puerta VARONES y la 1.ª ventana
    { const JP = R('perchero_pared', hw - 0.06, YP + 1.75, -10.9, -PI / 2);   // C4: perchero FINO (tabla moldurada, ganchos dobles cromados)
      JP.caja('blanco', hw - 0.08, YP + 1.75, -10.9, 0.04, 0.16, 2.1);
      for (let k = 0; k < 6; k++) { JP.caja('cromo', hw - 0.14, YP + 1.75, -11.7 + k * 0.32, 0.12, 0.03, 0.03); JP.add('cromo', new THREE.SphereGeometry(0.025, 6, 4).translate(hw - 0.2, YP + 1.75, -11.7 + k * 0.32)); } }
    for (const zz of [-21.15, -20.85]) B('blanco', hw - 0.05, YP + 1.9, zz, 0.05, 0.18, 0.06);
    for (const z of zVen) for (const s of [-1, 1]) ventanaRect(s < 0 ? PI / 2 : -PI / 2, s * hw, z, Y1 - 1.25, 1.1, 0.7, { reja: true });
    for (const x of [-6, 0, 6]) ventanaRect(0, x, -L, Y1 - 1.25, 1.3, 0.7, { reja: true });
    // lámparas de techo (globos de 1925) en dos filas
    for (const x of [-4.6, 4.6]) for (const z of [-5, -13, -21, -29]) { C('bronce', 0.12, 0.12, 0.05, x, Y1 - LS - 0.04, z, 10); R('globo_lampara', x, Y1 - LS - 0.27, z, 0, [0.2 / 0.3, 0.2 / 0.3, 0.2 / 0.3]).add('globo', new THREE.SphereGeometry(0.2, 14, 10).translate(x, Y1 - LS - 0.27, z)); }   // C4: globo FINO (respaldo: la esfera)
    // canaletas de luz y muro: zócalo pintado en los muros del zócalo (franja crema oscura) y cornisa
    for (const [x, z, sx, sz] of [[0, -0.03, W, 0.06], [0, -L + 0.03, W, 0.06], [-hw + 0.03, -L / 2, 0.06, L], [hw - 0.03, -L / 2, 0.06, L]]) { B('cremaOsc', x, YP + 0.5, z, sx, 1.0, sz); B('blanco', x, Y1 - LS - 0.08, z, sx, 0.14, sz); }
    luz(0xfff0d8, 34, 16, 0, Y1 - 1.1, -9); luz(0xfff0d8, 34, 16, 0, Y1 - 1.1, -25);
    // escalera de servicio a la piscina (encerrada abajo por un muro con la puerta del pasillo) y su baranda arriba
    const nS = 25, rS = (Y1 - YP) / nS, hS = (zSu - zSd) / nS;
    escalera((xS0 + xS1) / 2 + 0.05, xS1 - xS0 - 0.1, zSd, YP, nS, rS, hS, 1, { macizo: true, huella: 'maderaOsc', relleno: 'estuco' });
    B('estuco', -8.45, (YP + Y1 - LS) / 2, zSd / 2, 0.2, Y1 - LS - YP, -zSd); Fx0(-8.55, -8.35, YP, Y1 - LS, 0, zSd);
    friso(PI / 2, -8.35, 0, -8.35, zSd, YP, 1.0, 'cremaOsc');
    baranda(xS1, zSu, Y1, xS1, zSd, Y1); baranda(xS0 + 0.05, zSd, Y1, xS1, zSd, Y1); poste(xS1, Y1, zSd); poste(xS1, Y1, zSu);
    { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshStandardMaterial({ map: letrasTex('▼ PISCINA', '#1d3f74', '#f4f1e8') })); m.position.set(O.x - 9.75, Y1 + 2.6, O.z - 0.07); m.rotation.y = PI; g.add(m); }
  }

  // ============================================================ PLANTA DE ACCESO: vestíbulo y escalera imperial
  const yR = 9.2, zR = -10.44, nC = 16, rC = (yR - Y1) / nC, hC = 0.34, zC0 = zR + nC * hC;   // rellano, tramo central (pie en zC0 ≈ −5,0)
  { // tramo central (macizo), rellano macizo y tramos laterales que vuelven hacia la fachada
    escalera(0, 4.4, zC0, Y1, nC, rC, hC, -1, { macizo: true, alfombra: 3.0 });
    B('maderaOsc', 0, (Y1 + yR - LS) / 2, (zR + zPart) / 2, 2 * xG, yR - LS - Y1, zR - zPart); Fx0(-xG, xG, Y1, yR, zR, zPart + 0.15, 'piso');
    B('maderaMiel', 0, yR - 0.03, (zR + zPart) / 2, 2 * xG, 0.06, zR - zPart);
    B('alfombraRoja', 0, yR + 0.005, (zR + zPart + 0.5) / 2, 9.6, 0.012, zR - zPart - 0.5);
    for (const s of [-1, 1]) { for (let u = 0; u < 4; u++) B('maderaMiel', s * (2.6 + u * 1.0), (Y1 + yR - LS) / 2, zR - 0.02, 0.06, yR - LS - Y1 - 0.2, 0.05); }   // tableros del frente del rellano
    const nL = 13, rL = (Y2 - yR) / nL, xL = 4.8, aL = 3.6;
    for (const s of [-1, 1]) {
      escalera(s * xL, aL, zR, yR, nL, rL, hC, 1, { alfombra: 2.4 });
      // muro que separa los tramos laterales de los pasillos (x = ±6,65), con friso
      B('estuco', s * (xG + 0.05), (Y1 + Y2 - LS) / 2, (zM + zPart) / 2, 0.2, Y2 - LS - Y1, zM - zPart); Fx0(s * xG, s * (xG + 0.1), Y1, Y2 - LS, zM, zPart);
      friso(s < 0 ? -PI / 2 : PI / 2, s * (xG + 0.15), zM, s * (xG + 0.15), zPart + 0.15, Y1, 1.2);
      friso(s < 0 ? PI / 2 : -PI / 2, s * (xG - 0.05), zR, s * (xG - 0.05), zM, Y1, 1.2);
      // barandas torneadas: tramo central, rellano y lado interior de los laterales
      baranda(s * 2.1, zC0 + 0.1, Y1 + rC, s * 2.1, zR, yR); poste(s * 2.1, Y1, zC0 + 0.15, 1.25); poste(s * 2.1, yR, zR, 1.2);
      baranda(s * 2.1, zR, yR, s * (xL - aL / 2), zR, yR); poste(s * (xL - aL / 2), yR, zR, 1.2);
      baranda(s * (xL - aL / 2), zR, yR, s * (xL - aL / 2), zR + nL * hC, Y2); poste(s * (xL - aL / 2), Y2, zM, 1.2);
    }
    // mezanine y galerías: barandas sobre el pozo
    baranda(-(xL - aL / 2), zM, Y2, xL - aL / 2, zM, Y2);
    for (const s of [-1, 1]) { baranda(s * xG, zM, Y2, s * xG, zPart + 0.15, Y2); poste(s * xG, Y2, zPart + 0.2, 1.15); poste(s * xG, Y2, zM, 1.15); }
    // tabique entre el vestíbulo y la sala del espejo (2 puertas con cortinas) y, arriba del rellano, el muro del cortinaje rojo
    const xD = 8.6, wD = 1.8, hD = 2.9;
    for (const [a, b] of [[-hw, -xD - wD / 2], [-xD + wD / 2, xD - wD / 2], [xD + wD / 2, hw]]) { B('estuco', (a + b) / 2, (Y1 + Y2 - LS) / 2, zPart, b - a, Y2 - LS - Y1, 0.3); Fx0(a, b, Y1, Y2 - LS, zPart - 0.15, zPart + 0.15); }
    for (const s of [-1, 1]) { B('estuco', s * xD, (Y1 + hD + Y2 - LS) / 2, zPart, wD, Y2 - LS - Y1 - hD, 0.3); Fx0(s * xD - wD / 2, s * xD + wD / 2, Y1 + hD, Y2 - LS, zPart - 0.15, zPart + 0.15);
      for (const d of [1, -1]) { put('maderaOsc', new THREE.BoxGeometry(wD + 0.5, 0.25, 0.12).translate(0, Y1 + hD + 0.12, 0.06), d > 0 ? 0 : PI, s * xD, 0, zPart + d * 0.15);
        for (const t of [-1, 1]) put('maderaOsc', new THREE.BoxGeometry(0.2, hD + 0.1, 0.12).translate(t * (wD / 2 + 0.1), Y1 + hD / 2, 0.06), d > 0 ? 0 : PI, s * xD, 0, zPart + d * 0.15);
        for (const t of [-1, 1]) put('cortinaOsc', cortinaGeo(0.75, hD - 0.1, t, 0.45, 0.35).translate(t * (wD / 2 - 0.3), Y1, 0.18), d > 0 ? 0 : PI, s * xD, 0, zPart + d * 0.15); } }
    B('estuco', 0, (yR + H) / 2, zPart, 2 * xG, H - yR, 0.3); Fx0(-xG, xG, yR, H, zPart - 0.15, zPart + 0.15);
    // cortinaje rojo de fondo del rellano (pliegues de suelo a cielo) con cenefa
    { const wc = 2 * xG - 0.4, hc = H - 0.5 - yR, geo = new THREE.PlaneGeometry(wc, hc, 60, 4), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, 0.09 + 0.07 * Math.sin((p.getX(i) + wc / 2) * PI * 2 / 0.42));
      geo.computeVertexNormals(); geo.translate(0, yR + hc / 2, zPart + 0.15); J.add('cortina', geo);
      J.add('cortina', cenefaGeo(wc + 0.3, 1.0, 4).translate(0, H - 0.4, zPart + 0.3)); B('oro', 0, H - 0.38, zPart + 0.42, wc + 0.4, 0.06, 0.06); }
    // CARTEL TURÍSTICO con la historia del club (estandarte sobre el rellano, como el de las fotos)
    { const tx = cartelTex(1024, 1536, 'TENIENTE CLUB', [['Edificio N° 20 · 1925', 54, true],
        ['Centro social y recreativo de la comunidad estadounidense de Sewell, el campamento de la Braden Copper Company.', 40],
        ['Aquí se celebraban bailes, conciertos de guitarra y piano, actos y fiestas; se disputaban partidas de naipes y billar en la sala del espejo.', 40],
        ['En su zócalo subterráneo estaba la única piscina de la ciudad, temperada para nadar todo el año con la cordillera nevada afuera.', 40],
        ['La escalera de madera con alfombra roja, las arañas de bronce y las cortinas de terciopelo son las del edificio que se conserva hoy, Patrimonio de la Humanidad (2006).', 36]]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.85), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 })); m.position.set(O.x, yR + 0.5 + 1.43 + 0.3, O.z + zPart + 0.45); m.name = 'club_cartel'; g.add(m);
      B('fierro', 0, yR + 0.4 + 2.95 + 0.35, zPart + 0.43, 2.1, 0.04, 0.04); for (const s of [-1, 1]) { C('fierro', 0.025, 0.025, 3.5, s * 1.0, yR + 1.75, zPart + 0.43, 6); B('fierro', s * 1.0, yR + 0.02, zPart + 0.43, 0.5, 0.04, 0.3); }
      F(0, yR + 1.5, zPart + 0.43, 2.2, 3, 0.3); }
    // muros del vestíbulo: friso de madera oscura, puertas altas de madera, ventanas pareadas de la fachada
    friso(PI, -hw, 0, hw, 0, Y1, 1.2, 'maderaOsc', [[hw - 1.5, hw + 1.5]]);
    friso(PI / 2, -hw, 0, -hw, zPart + 0.15, Y1, 1.2, 'maderaOsc', [[-zSu, -zSd]]); friso(-PI / 2, hw, 0, hw, zPart + 0.15, Y1, 1.2, 'maderaOsc', [[3.4, 5.0], [10.4, 12.0]]);
    friso(0, -hw, zPart + 0.15, -xG - 0.2, zPart + 0.15, Y1, 1.2, 'maderaOsc', [[2.4 - 0.1 - 1.2, 2.4 + 1.2]]); friso(0, xG + 0.2, zPart + 0.15, hw, zPart + 0.15, Y1, 1.2, 'maderaOsc', [[0.9, 3.5]]);
    puertaMadera(-PI / 2, hw, Y1, -4.2, 1.3, 3.0); puertaMadera(-PI / 2, hw, Y1, -11.2, 1.3, 3.0);
    for (const x of [-8.4, -4.2, 4.2, 8.4]) for (const d of [-0.55, 0.55]) ventanaRect(PI, x + d, 0, Y1 + 2.45, 0.8, 2.2, { cortinas: 'cortina', hc: 3.3 });
    // lámpara colgante de globo blanco sobre la escalera, y otra bajo el mezanine; apliques en los muros de los pasillos
    for (const [x, y, z, rr] of [[0, H - 2.6, -9.5, 0.36], [-3.6, Y2 - LS - 0.8, -3.0, 0.26], [3.6, Y2 - LS - 0.8, -3.0, 0.26], [-8.8, Y2 - LS - 0.6, -7.5, 0.2], [8.8, Y2 - LS - 0.6, -7.5, 0.2]]) {
      const yT = rr > 0.32 ? H : Y2 - LS; C('laton', 0.012, 0.012, yT - y, x, (y + yT) / 2, z, 6); C('laton', 0.16, 0.1, 0.12, x, yT - 0.06, z, 10); { const JG = R('globo_lampara', x, y, z, 0, [rr / 0.3, rr / 0.3, rr / 0.3]); JG.add('laton', new THREE.CylinderGeometry(0.07, 0.12, 0.12, 10).translate(x, y + rr * 0.95, z)); JG.add('globo', new THREE.SphereGeometry(rr, 18, 14).translate(x, y, z)); } }   // C4: globo FINO con galería
    luz(0xffefd6, 40, 14, 0, H - 3.0, -9.5); luz(0xffefd6, 24, 11, 0, Y2 - LS - 1.6, -3.5); luz(0xffe2c0, 22, 8, 0, H - 1.5, -13.6);
    // puerta principal por dentro: vano con la luz del pórtico, marco de madera y dos hojas con vidrios abiertas contra el muro
    { const wPu = 1.9, hPu = 3.1, dia = new THREE.Mesh(new THREE.PlaneGeometry(wPu, hPu), new THREE.MeshBasicMaterial({ color: 0xcfc4ad })); dia.position.set(O.x, Y1 + hPu / 2, O.z - 0.02); dia.rotation.y = PI; g.add(dia);
      B('maderaOsc', 0, Y1 + hPu + 0.15, -0.08, wPu + 0.6, 0.3, 0.16); for (const s of [-1, 1]) B('maderaOsc', s * (wPu / 2 + 0.12), Y1 + hPu / 2, -0.08, 0.24, hPu, 0.16);
      B('blanco', 0, Y1 + hPu + 0.75, -0.04, 2.0, 0.7, 0.04);
      for (const s of [-1, 1]) { const A = PI - 0.12, hx = s * (wPu / 2), a = -s * A, cx = hx - s * Math.cos(A) * wPu / 4, cz = -Math.sin(A) * wPu / 4 - 0.2;   // hojas abiertas contra el muro
        B('maderaMiel', cx, Y1 + hPu / 2, cz, wPu / 2, hPu - 0.05, 0.06, a); for (const yy of [0.62, 0.3]) B('vidrioPuerta', cx, Y1 + hPu * yy, cz, wPu / 2 - 0.25, hPu * 0.26, 0.07, a); }
      const tl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshStandardMaterial({ map: letrasTex('TENIENTE CLUB', '#4a2a16', '#e8c878') })); tl.position.set(O.x, Y1 + hPu + 0.75, O.z - 0.07); tl.rotation.y = PI; g.add(tl); }
  }

  // ============================================================ SALA DEL ESPEJO (planta de acceso, al fondo)
  { const y0 = Y1, yT = Y2 - LS, zA = zPart - 0.15;
    // paneles de madera oscura con marcos (abajo) y friso de óvalos (arriba), en los 4 muros y en el portal interior
    const paneles = (rot, ax, az, bx, bz, huecos = []) => {
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len; let tr = [[0, len]];
      for (const [a, b] of huecos) tr = tr.flatMap(([p, q]) => [[p, Math.min(q, a)], [Math.max(p, b), q]]).filter(([p, q]) => q - p > 0.2);
      for (const [p, q] of tr) { const m = (p + q) / 2;
        put('panel', new THREE.BoxGeometry(q - p, 3.2, 0.04).translate(0, y0 + 1.6, 0.02), rot, ax + ux * m, 0, az + uz * m);
        put('maderaOsc', new THREE.BoxGeometry(q - p, 0.16, 0.08).translate(0, y0 + 3.25, 0.05), rot, ax + ux * m, 0, az + uz * m);
        put('maderaOsc', new THREE.BoxGeometry(q - p, 0.2, 0.07).translate(0, y0 + 0.1, 0.04), rot, ax + ux * m, 0, az + uz * m);
        put('maderaOsc', new THREE.BoxGeometry(q - p, 0.1, 0.07).translate(0, y0 + 1.0, 0.04), rot, ax + ux * m, 0, az + uz * m);
        const n = Math.max(1, Math.round((q - p) / 1.25)), pw = (q - p) / n;
        for (let i = 0; i <= n; i++) put('maderaOsc', new THREE.BoxGeometry(0.12, 3.2, 0.07).translate(0, y0 + 1.6, 0.04), rot, ax + ux * (p + i * pw), 0, az + uz * (p + i * pw));
        for (let i = 0; i < n; i++) { const u = p + (i + 0.5) * pw, X = ax + ux * u, Z = az + uz * u;
          put('maderaOsc', new THREE.TorusGeometry(0.34, 0.035, 5, 24).scale(1.35, 0.8, 1).translate(0, y0 + 3.85, 0.04), rot, X, 0, Z);
          put('panelOsc', new THREE.CircleGeometry(0.33, 24).scale(1.35, 0.8, 1).translate(0, y0 + 3.85, 0.025), rot, X, 0, Z);
          put('maderaMiel', new THREE.BoxGeometry(pw - 0.4, 1.7, 0.02).translate(0, y0 + 2.15, 0.045), rot, X, 0, Z); put('panelOsc', new THREE.BoxGeometry(pw - 0.5, 1.6, 0.02).translate(0, y0 + 2.15, 0.05), rot, X, 0, Z); }
        put('maderaOsc', new THREE.BoxGeometry(q - p, 0.22, 0.14).translate(0, y0 + 4.42, 0.07), rot, ax + ux * m, 0, az + uz * m);
      } };
    paneles(PI / 2, -hw, zA, -hw, -L, [[3.2, 5.0], [13.2, 15.0]]); paneles(-PI / 2, hw, zA, hw, -L, [[3.2, 5.0], [13.2, 15.0]]);
    paneles(PI, -hw, zA, hw, zA, [[hw - 8.6 - 1.1, hw - 8.6 + 1.1], [hw + 8.6 - 1.1, hw + 8.6 + 1.1]]);
    paneles(0, -hw, -L, hw, -L); B('panelOsc', 0, y0 + 3.0, -L + 0.07, 2.5, 3.0, 0.04); B('maderaOsc', 0, y0 + 4.55, -L + 0.08, 2.7, 0.14, 0.08);   // tablero oscuro detrás del espejo
    for (const s of [-1, 1]) for (const z of [-19.1, -29.1]) ventanaRect(s < 0 ? PI / 2 : -PI / 2, s * hw, z, y0 + 2.05, 1.0, 2.0, { cortinas: 'cortinaOsc', hc: 3.1 });
    // portal interior de madera (z = −24) con cortinas oscuras recogidas
    const wPo = 6, hPo = 3.3;
    for (const s of [-1, 1]) { B('estuco', s * (wPo / 2 + (hw - wPo / 2) / 2), (y0 + yT) / 2, zPor, hw - wPo / 2, yT - y0, 0.3); Fx0(s * wPo / 2, s * hw, y0, yT, zPor - 0.15, zPor + 0.15);
      for (const d of [1, -1]) paneles(d > 0 ? 0 : PI, s > 0 ? (d > 0 ? wPo / 2 + 0.2 : hw) : (d > 0 ? -hw : -wPo / 2 - 0.2), zPor + d * 0.15, s > 0 ? (d > 0 ? hw : wPo / 2 + 0.2) : (d > 0 ? -wPo / 2 - 0.2 : -hw), zPor + d * 0.15); }
    B('estuco', 0, (y0 + hPo + yT) / 2, zPor, wPo, yT - y0 - hPo, 0.3); Fx0(-wPo / 2, wPo / 2, y0 + hPo, yT, zPor - 0.15, zPor + 0.15);
    for (const d of [1, -1]) { put('maderaOsc', new THREE.BoxGeometry(wPo + 0.6, 0.4, 0.16).translate(0, y0 + hPo + 0.2, 0.08), d > 0 ? 0 : PI, 0, 0, zPor + d * 0.15);
      for (const t of [-1, 1]) { put('maderaOsc', new THREE.BoxGeometry(0.3, hPo, 0.16).translate(t * (wPo / 2 + 0.15), y0 + hPo / 2, 0.08), d > 0 ? 0 : PI, 0, 0, zPor + d * 0.15);
        put('cortinaOsc', cortinaGeo(1.3, hPo - 0.2, t, 0.4, 0.45).translate(t * (wPo / 2 - 0.65), y0, 0.25), d > 0 ? 0 : PI, 0, 0, zPor + d * 0.15); } }
    // chimenea con repisa de madera tallada, hogar negro con brasas y el GRAN ESPEJO OVALADO
    const zCh = -L, yE = y0 + 3.05;
    { const JC = R('chimenea_club', 0, y0, zCh + 0.39, 0, [1.4, 1.1, 1.3]), B = (k, ...a) => JC.caja(k, ...a), C = (k, r0, r1, h, x, y, z, seg = 12) => JC.add(k, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z));   // N0-UTIL3 (G6): malla 2,5×1,43×0,59
    B('maderaOsc', 0, y0 + 0.65, zCh + 0.3, 2.6, 1.3, 0.6); B('maderaMiel', 0, y0 + 1.36, zCh + 0.38, 2.9, 0.1, 0.76); B('maderaOsc', 0, y0 + 1.45, zCh + 0.34, 2.7, 0.08, 0.66);
    for (const s of [-1, 1]) { B('maderaMiel', s * 1.05, y0 + 0.65, zCh + 0.62, 0.26, 1.3, 0.06); C('maderaMiel', 0.08, 0.08, 1.1, s * 1.05, y0 + 0.65, zCh + 0.66, 10); }
    B('negro', 0, y0 + 0.5, zCh + 0.6, 1.3, 0.9, 0.04); B('brasa', 0, y0 + 0.12, zCh + 0.45, 0.9, 0.08, 0.3); for (let i = 0; i < 3; i++) C('maderaOsc', 0.06, 0.06, 0.7, -0.2 + i * 0.2, y0 + 0.2, zCh + 0.45, 6);
    B('marmol', 0, y0 + 0.02, zCh + 0.85, 2.8, 0.04, 0.5); }
    F(0, y0 + 0.7, zCh + 0.35, 2.9, 1.4, 0.8);
    for (const s of [-1, 1]) { C('laton', 0.04, 0.05, 0.25, s * 1.1, y0 + 1.6, zCh + 0.4, 8); Sp('vela', 0.035, s * 1.1, y0 + 1.76, zCh + 0.4, 6, 5); }
    J.add('marcoEsp', new THREE.TorusGeometry(1, 0.075, 8, 48).scale(0.85, 1.2, 1).translate(0, yE, zCh + 0.1));
    J.add('maderaOsc', new THREE.TorusGeometry(1.1, 0.05, 6, 48).scale(0.85, 1.2, 1).translate(0, yE, zCh + 0.08));
    J.add('maderaMiel', new THREE.TorusGeometry(0.4, 0.06, 6, 12, PI).translate(0, yE + 1.32, zCh + 0.12));
    g.add(espejo(new THREE.CircleGeometry(1, 48).scale(0.82, 1.17, 1), O.x, yE, O.z + zCh + 0.11));
    // lámparas de pantalla ámbar (colgantes) y apliques; mesas con sillas y sillones frente a la chimenea
    for (const [x, z] of [[-4, -19.5], [4, -19.5], [0, -28.4]]) { C('laton', 0.012, 0.012, yT - (y0 + 3.75), x, (y0 + 3.75 + yT) / 2, z, 6); const J = R('lampara_pantalla', x, y0 + 3.75, z, 0), B = (k, ...a) => J.caja(k, ...a), Sp = (k, rr, x, y, z, ws = 10, hs = 8) => J.add(k, new THREE.SphereGeometry(rr, ws, hs).translate(x, y, z));   // C4: colgante FINO (campana ámbar y 5 brazos)
      J.add('pantalla', new THREE.CylinderGeometry(0.2, 0.42, 0.34, 16, 1, true).translate(x, y0 + 3.65, z)); Sp('foco', 0.08, x, y0 + 3.55, z, 8, 6);
      for (let i = 0; i < 5; i++) { const a = i / 5 * 2 * PI; J.add('pantalla', new THREE.CylinderGeometry(0.07, 0.12, 0.13, 10, 1, true).translate(x + Math.cos(a) * 0.62, y0 + 3.45, z + Math.sin(a) * 0.62)); B('laton', x + Math.cos(a) * 0.31, y0 + 3.5, z + Math.sin(a) * 0.31, 0.62, 0.02, 0.02, -a); } }
    for (const s of [-1, 1]) for (const z of [-17.5, -21.5, -27, -31.5]) { const J = R('aplique_pared', s * (hw - 0.07), y0 + 2.6, z, s < 0 ? PI / 2 : -PI / 2), B = (k, ...a) => J.caja(k, ...a);   // C4: aplique FINO (platina, brazo y pantalla)
      B('laton', s * (hw - 0.12), y0 + 2.6, z, 0.1, 0.1, 0.1); J.add('pantalla', new THREE.CylinderGeometry(0.08, 0.14, 0.16, 10, 1, true).translate(s * (hw - 0.25), y0 + 2.75, z)); }
    const mesa = (x, z, n = 4) => { { const JM = R('mesa_pedestal', x, y0, z, 0), C = (k, r0, r1, h, x, y, z, seg = 12) => JM.add(k, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z));   // C4: mesa de pedestal y sillas tapizadas FINAS (cajas de respaldo)
      C('maderaOsc', 0.5, 0.5, 0.05, x, y0 + 0.76, z, 18); C('maderaOsc', 0.05, 0.08, 0.72, x, y0 + 0.38, z, 8); C('maderaOsc', 0.3, 0.3, 0.04, x, y0 + 0.02, z, 12); } F(x, y0 + 0.4, z, 1.0, 0.8, 1.0);
      for (let i = 0; i < n; i++) { const a = i / n * 2 * PI + 0.4, cx = x + Math.cos(a) * 0.85, cz = z + Math.sin(a) * 0.85, JS = R('silla_salon', cx, y0, cz, Math.atan2(-Math.cos(a), -Math.sin(a)));
        JS.caja('tapiz', cx, y0 + 0.46, cz, 0.44, 0.08, 0.44, -a); JS.caja('maderaOsc', cx + Math.cos(a) * 0.2, y0 + 0.8, cz + Math.sin(a) * 0.2, 0.06, 0.62, 0.44, -a);
        for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) JS.add('maderaOsc', new THREE.CylinderGeometry(0.02, 0.02, 0.44, 5).translate(cx + dx, y0 + 0.22, cz + dz)); } };
    mesa(-6.5, -18.5); mesa(6.5, -18.5); mesa(-6.5, -21.5, 3); mesa(6.5, -21.5, 3); mesa(-6.5, -30); mesa(6.5, -30);
    for (const s of [-1, 1]) { const x = s * 1.9, z = -30.8, JS = R('sillon_burdeo', x, y0, z, PI + s * 0.5), B = (k, ...a) => JS.caja(k, ...a);   // N0-UTIL3 (G6): sillón de malla mirando a la chimenea
      B('tapiz', x, y0 + 0.42, z, 0.85, 0.22, 0.8, s * 0.5); B('tapiz', x - s * 0.18, y0 + 0.82, z - 0.32, 0.85, 0.7, 0.18, s * 0.5); B('maderaOsc', x, y0 + 0.17, z, 0.85, 0.34, 0.78, s * 0.5);
      for (const d of [-1, 1]) B('tapiz', x + d * 0.4 * Math.cos(s * 0.5), y0 + 0.6, z - d * 0.4 * Math.sin(s * 0.5) * -1, 0.14, 0.4, 0.78, s * 0.5);
      F(x, y0 + 0.5, z, 1.0, 1.0, 1.0); }
    B('alfombraRoja', 0, y0 + 0.016, -31, 4.2, 0.008, 2.6);
    luz(0xffc98e, 30, 11, 0, y0 + 3.4, -19.5); luz(0xffc98e, 30, 11, 0, y0 + 3.4, -29.5);
  }

  // ============================================================ SALÓN (arriba)
  { const y0 = Y2, yT = H, zS = zPart - 0.15;
    // ventanas de medio punto con abanico: en la fachada (sobre el mezanine y las galerías) y en los costados; cortinas de terciopelo
    for (const x of [-8.4, -4.2, 0, 4.2, 8.4]) ventanaArco(PI, x, 0, y0 + 0.9, 1.5, 2.0);
    for (const s of [-1, 1]) for (const z of [-3.2, -10.5, -17.6, -21.6, -29.6, -32.6]) ventanaArco(s < 0 ? PI / 2 : -PI / 2, s * hw, z, y0 + 0.9, 1.3, 1.9);
    for (const x of [-6.4, 6.4]) ventanaArco(0, x, -L, y0 + 0.9, 1.5, 2.0);
    // friso de madera, cornisa blanca, rosetones en el cielo
    friso(PI, -hw, 0, hw, 0, y0, 1.0); friso(0, -hw, -L, hw, -L, y0, 1.0); for (const s of [-1, 1]) friso(s < 0 ? PI / 2 : -PI / 2, s * hw, 0, s * hw, -L, y0, 1.0);
    friso(PI, -xG, zS, xG, zS, y0, 1.0); cornisa(yT, y0);
    for (const [x, z] of [[-4.5, -20.5], [4.5, -20.5], [0, -30.2], [0, -3]]) { C('blanco', 0.55, 0.62, 0.06, x, yT - 0.03, z, 24); J.add('blanco', new THREE.TorusGeometry(0.5, 0.05, 5, 24).rotateX(PI / 2).translate(x, yT - 0.07, z)); }
    // arañas de bronce con tulipas ámbar
    arana(-4.5, yT - 1.5, -20.5, yT, 10, 0.8, 2, 30); arana(4.5, yT - 1.5, -20.5, yT, 10, 0.8, 2, 30); arana(0, yT - 1.5, -30.2, yT, 10, 0.8, 2, 30);
    arana(0, yT - 1.3, -3, yT, 8, 0.6, 2, 18); arana(-8.8, yT - 1.1, -10.5, yT, 6, 0.45, 1); arana(8.8, yT - 1.1, -10.5, yT, 6, 0.45, 1);
    // tarima de los conciertos contra el muro del cortinaje (con atril, silla y guitarra) y filas de sillas tapizadas
    B('maderaMiel', 0, y0 + 0.15, zS - 1.2, 10, 0.3, 2.3); B('maderaOsc', 0, y0 + 0.15, zS - 2.36, 10, 0.3, 0.04); Fx0(-5, 5, y0, y0 + 0.3, zS - 0.05, zS - 2.35, 'piso');
    { const JA = R('atril', 0.8, y0 + 0.3, zS - 1.6, 0), JS = R('silla_salon', -0.4, y0 + 0.3, zS - 1.1, PI);   // C4: atril de fierro y silla tapizada FINOS
      JA.add('fierro', new THREE.CylinderGeometry(0.015, 0.015, 1.1, 5).translate(0.8, y0 + 0.85, zS - 1.6)); JA.caja('fierro', 0.8, y0 + 1.42, zS - 1.6, 0.45, 0.32, 0.02, 0, -0.4);
      JS.caja('tapiz', -0.4, y0 + 0.75, zS - 1.1, 0.45, 0.08, 0.45); JS.caja('tapiz', -0.4, y0 + 1.0, zS - 0.9, 0.45, 0.45, 0.06); }
    { const gu = new THREE.LatheGeometry([[0.001, 0], [0.16, 0.02], [0.2, 0.12], [0.12, 0.24], [0.16, 0.36], [0.12, 0.46], [0.001, 0.48]].map(([a, b]) => new THREE.Vector2(a, b)), 14).scale(1, 1, 0.3).rotateX(-0.3).translate(0.1, y0 + 0.62, zS - 1.2); const JG = R('guitarra', 0.03, y0 + 0.3, zS - 1.12, PI); JG.add('maderaMiel', gu); JG.caja('maderaOsc', 0.1, y0 + 1.25, zS - 1.38, 0.05, 0.6, 0.03, 0, -0.3); }   // N0-UTIL3 (G6): guitarra de malla de pie apoyada en la silla
    const sillas = [];
    for (let f = 0; f < 6; f++) for (const s of [-1, 1]) { const z = zS - 3.4 - f * 0.95;
      for (let c = 0; c < 8; c++) sillas.push([s * (1.1 + c * 0.6), z]); Fx0(s * 0.85, s * (1.1 + 7 * 0.6 + 0.28), y0, y0 + 0.92, z - 0.28, z + 0.28); }
    { const si = sillasInst(sillas, y0, O); g.add(...si); montarEnKit(g, sillas.map(([x, z]) => ['silla_salon', O.x + x, O.y + y0, O.z + z, 0]), { ocultar: si }); }   // C4: 96 sillas tapizadas FINAS instanciadas (las de cajas quedan de respaldo)
    // columnata: arco de medio punto sobre columnas jónicas al centro y barras con columnas a los lados (z = −26)
    const rA = 2.0, ySpr = y0 + 2.6;
    for (const s of [-1, 1]) { jonica(s * (rA + 0.25), y0, zCol, 2.6, 0.2); F(s * (rA + 0.25), y0 + 1.3, zCol, 0.55, 2.6, 0.55);
      // barra / mesón: paneles crema con marco oscuro, cubierta oscura
      const xa = s * 2.9, xb = s * 9.4, xm = (xa + xb) / 2, lb = Math.abs(xb - xa);
      B('crema', xm, y0 + 0.55, zCol, lb, 1.1, 0.6); B('maderaOsc', xm, y0 + 1.14, zCol, lb + 0.1, 0.08, 0.72); B('maderaOsc', xm, y0 + 0.06, zCol, lb, 0.12, 0.64);
      for (const d of [1, -1]) { for (let i = 0; i <= 4; i++) B('maderaOsc', xa + (xb - xa) * i / 4, y0 + 0.55, zCol + d * 0.31, 0.1, 1.1, 0.03); B('maderaOsc', xm, y0 + 1.03, zCol + d * 0.31, lb, 0.08, 0.03); }
      Fx0(Math.min(xa, xb), Math.max(xa, xb), y0, y0 + 1.2, zCol - 0.35, zCol + 0.35);
      for (const x of [s * 4.6, s * 7.6]) { jonica(x, y0 + 1.18, zCol, yT - 0.45 - (y0 + 1.18), 0.17); F(x, (y0 + yT) / 2, zCol, 0.4, yT - y0, 0.4); }
      jonica(s * 10.6, y0, zCol, yT - 0.45 - y0, 0.17); F(s * 10.6, (y0 + yT) / 2, zCol, 0.4, yT - y0, 0.4);
    }
    B('blanco', 0, yT - 0.24, zCol, W, 0.48, 0.5); B('blanco', 0, yT - 0.5, zCol, W, 0.06, 0.56);   // entablamento
    { const sh = new THREE.Shape(); sh.moveTo(-rA - 0.05, ySpr); sh.lineTo(-rA - 0.05, yT - 0.48); sh.lineTo(rA + 0.05, yT - 0.48); sh.lineTo(rA + 0.05, ySpr); sh.absarc(0, ySpr, rA, 0, PI, false);
      const ge = new THREE.ExtrudeGeometry(sh, { depth: 0.44, bevelEnabled: false, curveSegments: 24 }); ge.translate(0, 0, zCol - 0.22); J.add('blanco', ge);
      const ar = new THREE.Shape(); ar.absarc(0, ySpr, rA + 0.14, 0, PI, false); ar.lineTo(-rA, ySpr); ar.absarc(0, ySpr, rA, PI, 0, true); ar.lineTo(rA + 0.14, ySpr);
      for (const d of [1, -1]) J.add('blancoS', new THREE.ExtrudeGeometry(ar, { depth: 0.05, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, zCol + d * 0.24 - 0.025)); B('blanco', 0, ySpr + rA + 0.06, zCol, 0.3, 0.32, 0.52); }
    // botellas y copas en la barra; detrás, salón de fondo con mesas redondas y piano
    for (const s of [-1, 1]) { const JB = R('botellas_barra', s * 3.8, y0 + 1.18, zCol - 0.05, 0);   // C4: juegos de botellas y copas FINOS entre las columnas de la barra (respaldo: los cilindros)
      for (let i = 1; i < 4; i++) R('botellas_barra', s * (3.8 + i * 1.5), y0 + 1.18, zCol - 0.05, i % 2 ? PI : 0);
      for (let i = 0; i < 6; i++) { const x = s * (3.6 + i * 0.9); JB.add(i % 2 ? 'vidrioVerde' : 'vidrioAmbar', new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8).translate(x, y0 + 1.31, zCol - 0.05)); JB.add('vidrioVerde', new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6).translate(x, y0 + 1.49, zCol - 0.05)); } }
    for (const [x, z] of [[-6.5, -29.2], [6.5, -29.2], [-3, -32], [3, -32]]) { const JM = R('mesa_pedestal', x, y0, z, 0, [0.9, 1, 0.9]);   // C4: mesa de pedestal (Ø 0,9) y 3 sillas tapizadas FINAS
      JM.add('maderaOsc', new THREE.CylinderGeometry(0.45, 0.45, 0.05, 18).translate(x, y0 + 0.75, z)); JM.add('maderaOsc', new THREE.CylinderGeometry(0.05, 0.08, 0.72, 8).translate(x, y0 + 0.38, z)); F(x, y0 + 0.4, z, 0.9, 0.8, 0.9);
      for (let i = 0; i < 3; i++) { const a = i / 3 * 2 * PI + 0.3, cx = x + Math.cos(a) * 0.8, cz = z + Math.sin(a) * 0.8, JS = R('silla_salon', cx, y0, cz, Math.atan2(-Math.cos(a), -Math.sin(a))); JS.caja('tapiz', cx, y0 + 0.46, cz, 0.44, 0.08, 0.44, -a); JS.caja('tapiz', cx + Math.cos(a) * 0.2, y0 + 0.78, cz + Math.sin(a) * 0.2, 0.06, 0.55, 0.44, -a); } }
    { const xp = -9.4, zp = -33.45, JP = R('piano', xp, y0, zp + 0.06, 0), BP = (k, ...a) => JP.caja(k, ...a);   // N0-UTIL3 (G6): piano vertical de malla (1,5×1,3×0,65)
      BP('negroPiano', xp, y0 + 0.7, zp, 1.5, 1.3, 0.6); BP('negroPiano', xp, y0 + 0.76, zp + 0.42, 1.45, 0.06, 0.3); BP('teclas', xp, y0 + 0.8, zp + 0.47, 1.25, 0.02, 0.16);
      for (const d of [-0.65, 0.65]) BP('negroPiano', xp + d, y0 + 0.35, zp + 0.5, 0.08, 0.7, 0.08); for (const dx of [-0.3, 0.3]) for (const dz of [-0.14, 0.14]) C('maderaOsc', 0.02, 0.02, 0.43, xp + dx, y0 + 0.215, zp + 1.0 + dz, 6); F(xp, y0 + 0.7, zp + 0.1, 1.6, 1.4, 0.9); B('tapiz', xp, y0 + 0.47, zp + 1.0, 0.7, 0.08, 0.35); }
    // óleos con marco dorado en los muros del salón y en el muro del cortinaje
    let io = 0; const OL = [4, 2, 5, 1, 5, 4, 2, 1, 1, 4, 5, 3, 2], OLEO = () => 'oleo' + OL[io];   // C4 (P1): óleos de Qwen (oleo3 = retrato vertical, en el marco vertical de la fachada)
    for (const s of [-1, 1]) for (const z of [-7, -14.0, -24.4, -27.2]) cuadro(   /* R-9b: −19,6 y −31,1 quedaban sobre las cortinas de las ventanas (−17,6/−21,6 y −29,6/−32,6) */ s < 0 ? PI / 2 : -PI / 2, s * hw, y0 + 2.4, z, 1.2, 0.85, oleo(io), 'oro', 0.05, OLEO(io++));
    cuadro(0, 0, y0 + 2.6, -L, 1.9, 1.3, oleo(io), 'oro', 0.05, OLEO(io++)); cuadro(PI, -3.5, y0 + 2.5, zS, 1.3, 0.9, oleo(io), 'oro', 0.05, OLEO(io++)); cuadro(PI, 3.5, y0 + 2.5, zS, 1.3, 0.9, oleo(io), 'oro', 0.05, OLEO(io++));
    cuadro(PI, -6.3, y0 + 2.6, 0, 0.66, 0.88, oleo(io), 'oro', 0.05, OLEO(io++)); cuadro(PI, 6.3, y0 + 2.6, 0, 0.9, 0.7, oleo(io), 'oro', 0.05, OLEO(io++));
    // bancos tapizados en las galerías, junto a las barandas
    for (const s of [-1, 1]) { const JB = R('banco_tapizado', s * 9.9, y0, -9, -s * PI / 2, [1.55, 1, 1.1]); JB.caja('tapiz', s * 9.9, y0 + 0.45, -9, 0.5, 0.1, 2.2); JB.caja('maderaOsc', s * 9.9, y0 + 0.2, -9, 0.46, 0.4, 2.1); JB.caja('tapiz', s * 10.2, y0 + 0.75, -9, 0.08, 0.6, 2.2); Fx0(   /* N0-UTIL3 (G6): banco de malla 2,2 m */ s * 9.6, s * hw, y0, y0 + 0.9, -10.1, -7.9); }
  }

  // ============================================================ materiales y armado
  const tMad = TX.madera();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
  const mats = {
    estuco: M(0xf0e2bc, { roughness: 0.92 }), estucoZ: M(0xe9dcbf, { roughness: 0.92 }), crema: M(0xf2e6c2), cremaOsc: M(0xd9c79a), blanco: M(0xf6f3ea), blancoS: M(0xece8dc), blancoV: M(0xf4f2ec, { roughness: 0.5 }), puertaBlanca: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4efe4, emissiveIntensity: 0.7, roughness: 0.55 }), puertaTablero: new THREE.MeshStandardMaterial({ color: 0xf2eee4, emissive: 0xd8d2c4, emissiveIntensity: 0.5, roughness: 0.6 }),
    maderaOsc: M(0x4a2a16, { map: tMad, roughness: 0.45 }), maderaMiel: M(0xb8783e, { map: tMad, roughness: 0.38 }), panel: M(0x9a5e30, { map: tMad, roughness: 0.4 }), panelOsc: M(0x6e3e1e, { map: tMad, roughness: 0.4 }),
    alfombraRoja: M(0x8a1420, { roughness: 1 }), laton: M(0xc9a45a, { metalness: 0.8, roughness: 0.3 }), bronce: M(0xa07a3a, { metalness: 0.75, roughness: 0.35 }), oro: M(0xc8a048, { metalness: 0.7, roughness: 0.35 }),
    cortina: new THREE.MeshStandardMaterial({ color: 0xc02838, map: TX.terciopelo(), roughness: 0.82, side: THREE.DoubleSide }), cortinaOsc: new THREE.MeshStandardMaterial({ color: 0x5a1a1a, map: TX.terciopelo(), roughness: 0.85, side: THREE.DoubleSide }),
    tulipa: new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a30, emissiveIntensity: 0.55, roughness: 0.4, side: THREE.DoubleSide }), foco: new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
    globo: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 0.85, roughness: 0.3 }),
    pantalla: new THREE.MeshStandardMaterial({ color: 0xe8a050, emissive: 0xc86a1a, emissiveIntensity: 0.6, roughness: 0.6, side: THREE.DoubleSide }),
    tapiz: M(0x7a1a2a, { roughness: 0.9 }), fierro: M(0x26282c, { metalness: 0.5, roughness: 0.5 }), negro: M(0x121212), negroPiano: M(0x0e0b0a, { roughness: 0.2 }), teclas: M(0xf2efe6),
    azulBorde: M(0x1f5fb0, { roughness: 0.45 }), azulOsc: M(0x163f78), azulCarril: M(0x1d3f74), tuboBlanco: M(0xf6f6f2, { roughness: 0.3, metalness: 0.2 }), cromo: M(0xdfe3e6, { metalness: 0.9, roughness: 0.2 }),
    focoPisc: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff4ff, emissiveIntensity: 0.6 }), rojo: M(0xc0261e, { roughness: 0.5 }), rojoMarco: M(0xa3201c, { roughness: 0.5 }),
    marmol: M(0xe6e0d4, { roughness: 0.25 }), brasa: new THREE.MeshStandardMaterial({ color: 0x3a1206, emissive: 0xff5a10, emissiveIntensity: 0.9 }), vela: M(0xf4ecd8),
    vidrioPuerta: M(0xd8d0bc, { roughness: 0.1, metalness: 0.3 }),
    marcoEsp: M(0x6a3a18, { map: tMad, roughness: 0.35 }), vidrioVerde: M(0x2c5a3a, { roughness: 0.15, metalness: 0.2 }), vidrioAmbar: M(0x8a4a14, { roughness: 0.15, metalness: 0.2 }),
  };
  // R-8: orden de «quién queda encima» entre piezas coplanares de materiales distintos (polygonOffset, independiente de la distancia): estuco/piso abajo, madera encima
  const RANGO = { cremaOsc: 1, blanco: 1, blancoS: 1, blancoV: 2.5, puertaBlanca: 5, puertaTablero: 6, azulOsc: 1, panel: 2, panelOsc: 2, maderaOsc: 3, marcoEsp: 3, maderaMiel: 4, tapiz: 3, vidrioPuerta: 5, azulBorde: 2, rojoMarco: 3, rojo: 3.2, oro: 4.2, laton: 4.4, bronce: 4.3 };
  for (const m of [mDeck, mMos, mPar, mAlf]) if (m && !/[?&]r8=0/.test(location.search)) { m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -4; }   // pisos sobre la losa
  for (const [k, n] of Object.entries(RANGO)) if (mats[k] && !/[?&]r8=0/.test(location.search)) { mats[k].polygonOffset = true; mats[k].polygonOffsetFactor = 0; mats[k].polygonOffsetUnits = -n * 8; }
  for (const k of Object.keys(J.p)) { const geo = J.geometria(k, /^(madera|panel|marcoEsp)/.test(k) ? uvCaja : null); if (!geo) continue;
    const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'kit_club_' + k; m.receiveShadow = true; m.position.copy(O); g.add(m); }
  for (const [id, { JR, it }] of RESP) {   // N0-UTIL3 (G6): respaldo de cada pieza en su grupo; se oculta al montar la malla
    const gR = new THREE.Group(); gR.name = 'club_resp_' + id;
    for (const k of Object.keys(JR.p)) { const geo = JR.geometria(k, /^(madera|panel|marcoEsp)/.test(k) ? uvCaja : null); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'kit_club_' + k; m.receiveShadow = true; gR.add(m); }
    gR.position.copy(O); g.add(gR); montarEnKit(g, it, { ocultar: gR });
  }
  g.add(new THREE.AmbientLight(0xfff0dc, 0.35));
  return g;
}

// sillas de salón tapizadas burdeo (2 mallas instanciadas): lista [[x, z]] mirando hacia +z (la tarima)
function sillasInst(lista, y0, O) {
  const tap = [], est = [];
  tap.push(new THREE.BoxGeometry(0.46, 0.09, 0.44).translate(0, 0.47, 0)); tap.push(new THREE.BoxGeometry(0.44, 0.42, 0.07).translate(0, 0.78, -0.21));
  for (const [dx, dz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) est.push(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5).translate(dx, 0.22, dz));
  for (const dx of [-0.2, 0.2]) est.push(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5).translate(dx, 0.75, -0.25));
  const geoT = mergeSimple(tap), geoE = mergeSimple(est);
  const mT = new THREE.MeshStandardMaterial({ color: 0x7a1a2c, roughness: 0.9 }), mE = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.5, roughness: 0.5 });
  const iT = new THREE.InstancedMesh(geoT, mT, lista.length), iE = new THREE.InstancedMesh(geoE, mE, lista.length), m4 = new THREE.Matrix4();
  lista.forEach(([x, z], i) => { m4.makeTranslation(O.x + x, y0, O.z + z); iT.setMatrixAt(i, m4); iE.setMatrixAt(i, m4); });
  iT.computeBoundingSphere(); iE.computeBoundingSphere(); iT.name = 'club_sillas'; iE.name = 'club_sillas_fierro'; iT.receiveShadow = true;
  return [iT, iE];
}
function mergeSimple(lista) {
  const J = new Junta(); for (const x of lista) J.add('a', x); return J.geometria('a');
}

// ---------------------------------------------------------------- espejo plano que refleja de verdad
// Como Reflector de three, pero compatible con la profundidad invertida (reverse-Z de render.js): en vez de la matriz de proyección
// oblicua, recorta lo que queda detrás del espejo con un plano de recorte global (renderer.clippingPlanes) durante el render reflejado.
// Textura chica (352×484), sin MSAA; se actualiza cada 3 cuadros, solo si el espejo está en cuadro, de frente y a menos de 16 m.
function espejo(geo, X, Y, Z) {
  const rt = new THREE.WebGLRenderTarget(352, 484, { type: THREE.HalfFloatType, samples: 0 });
  const texM = new THREE.Matrix4();
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, textureMatrix: { value: texM }, tinte: { value: new THREE.Color(0xe6dccb) } },
    vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    polygonOffset: !/[?&]r8=0/.test(location.search), polygonOffsetFactor: 0, polygonOffsetUnits: -60,   // R-8: el espejo siempre sobre el tablero/muro que tiene detrás
    fragmentShader: 'uniform sampler2D tDiffuse; uniform vec3 tinte; varying vec4 vUv; void main(){ vec4 b = texture2DProj(tDiffuse, vUv); gl_FragColor = vec4(b.rgb * tinte, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const m = new THREE.Mesh(geo, mat); m.position.set(X, Y, Z); m.name = 'club_espejo'; m.userData.rt = rt; m.userData.n = 0;
  const camR = new THREE.PerspectiveCamera(), n = new THREE.Vector3(), pE = new THREE.Vector3(), pC = new THREE.Vector3(), rot = new THREE.Matrix4(), mira = new THREE.Vector3(), obj = new THREE.Vector3(), vista = new THREE.Vector3();
  const plano = new THREE.Plane(), planos = [plano];
  // R-9 (14-11-2026): el reflejo YA NO se dibuja dentro de onBeforeRender (render anidado). three r187, al terminar el render anidado,
  // deja activo en el cuadro principal el plano de recorte global del espejo (renderStateStack.pop → clipping.setGlobalState con
  // renderer.clippingPlanes todavía = planos, y _clippingEnabled queda en true): todo lo que se dibujaba DESPUÉS del espejo en ese cuadro
  // y quedaba detrás de su plano (paneles, friso, viga, cuadros, zócalo, cornisa y parteluces a < 9 cm del muro del fondo, en los 3 pisos)
  // desaparecía 1 de cada 3 cuadros = el «parpadeo de pared lisa». Ahora onBeforeRender solo pide el reflejo y este se dibuja en una
  // microtarea, al terminar el cuadro (fuera de todo render), con el estado de recorte limpio. `?r9=0` vuelve al render anidado (comparar).
  const anidado = /[?&]r9=0/.test(location.search);
  const reflejar = (renderer, scene, camera) => {
    vista.reflect(n).negate().add(pE);
    rot.extractRotation(camera.matrixWorld); mira.set(0, 0, -1).applyMatrix4(rot).add(pC);
    obj.subVectors(pE, mira).reflect(n).negate().add(pE);
    camR.position.copy(vista); camR.up.set(0, 1, 0).applyMatrix4(rot).reflect(n); camR.lookAt(obj);
    camR.near = camera.near; camR.far = camera.far; camR.fov = camera.fov; camR.aspect = camera.aspect; camR.updateMatrixWorld();
    camR.projectionMatrix.copy(camera.projectionMatrix); camR.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    camR._reversedDepth = camera.reversedDepth === true;   // si no, three recalcula la proyección (reverse-Z de render.js)
    texM.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); texM.multiply(camR.projectionMatrix); texM.multiply(camR.matrixWorldInverse); texM.multiply(m.matrixWorld);
    plano.setFromNormalAndCoplanarPoint(n, pE); plano.constant -= 0.02;
    const rtPrev = renderer.getRenderTarget(), clipPrev = renderer.clippingPlanes, sombra = renderer.shadowMap.autoUpdate;
    m.userData.ocupado = true; m.visible = false; renderer.shadowMap.autoUpdate = false; renderer.clippingPlanes = planos;
    try {
      renderer.setRenderTarget(rt); renderer.state.buffers.depth.setMask(true); if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, camR); m.userData.n++;
    } finally { renderer.setRenderTarget(rtPrev); renderer.clippingPlanes = clipPrev; renderer.shadowMap.autoUpdate = sombra; m.visible = true; m.userData.ocupado = false; }
  };
  m.onBeforeRender = (renderer, scene, camera) => {
    if (m.userData.ocupado || m.userData.pedido) return;
    pE.setFromMatrixPosition(m.matrixWorld); pC.setFromMatrixPosition(camera.matrixWorld); rot.extractRotation(m.matrixWorld); n.set(0, 0, 1).applyMatrix4(rot);
    vista.subVectors(pE, pC); if (vista.dot(n) > 0 || vista.length() > 16) return;
    if (!anidado && (pC.y > pE.y + 1.9 || pC.y < pE.y - 3.4)) return;   // R-9: cámara en otro piso (salón o piscina): el espejo no se ve, no se dibuja su reflejo
    if ((m.userData.f = (m.userData.f || 0) + 1) % 3 && m.userData.n) return;   // cada 3 cuadros (un tercio del costo; el reflejo se ve fluido igual)
    if (anidado) { reflejar(renderer, scene, camera); if (camera.viewport !== undefined) renderer.state.viewport(camera.viewport); return; }
    m.userData.pedido = true;
    queueMicrotask(() => { m.userData.pedido = false; let o = m; while (o) { if (!o.visible) return; o = o.parent; } reflejar(renderer, scene, camera); });
  };
  return m;
}
