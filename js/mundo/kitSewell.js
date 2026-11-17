// Kit Sewell (N4-C20, carril modelado, 14-11-2026): edificios hechos a mano en código, nítidos y con la arquitectura de Sewell
// (tablas horizontales pintadas, ventanas de guillotina blancas de verdad, esquineros, cornisas, techo de zinc con cumbrera,
// zócalo de hormigón). Reemplaza las mallas TRELLIS «de lego» (ventanas borrosas, costuras, fachadas derretidas).
// API: edificioKit(op) → THREE.Group con el origen al centro de la planta y a ras de la base; eje largo en X, fachada principal
// hacia +Z. La caja del grupo mide EXACTAMENTE largo × alto × ancho (aleros y cornisas incluidos): calza en el lote.
// Documentación: capturas/coordinacion/KIT_SEWELL.md. Texturas: assets3d/texturas/kit (blender/hospital_texturas.py).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TEX = 'assets3d/texturas/kit/';
const texCache = {};
function tex(nombre, color) {
  if (texCache[nombre]) return texCache[nombre];
  const t = new THREE.TextureLoader().load(TEX + nombre);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[nombre] = t);
}
const matCache = {};
// pocos materiales, compartidos por todos los edificios del kit (uno por color de tablas / de zinc)
function material(tipo, color) {
  if (color === undefined && ['tablas', 'zinc', 'tablasViejas', 'zincViejo', 'acanalada'].includes(tipo)) color = 0xffffff;   // N2-C35: three avisaba «color undefined» (mismo resultado: blanco)
  const k = tipo + ':' + (color ?? '');
  if (matCache[k]) return matCache[k];
  let m;
  if (tipo === 'tablas') m = new THREE.MeshStandardMaterial({ color, map: tex('siding.jpg', true), normalMap: tex('siding_normal.jpg'), roughness: 0.82 });
  else if (tipo === 'zinc') m = new THREE.MeshStandardMaterial({ color, map: tex('zinc.jpg', true), normalMap: tex('zinc_normal.jpg'), roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide });
  else if (tipo === 'tablasViejas') m = new THREE.MeshStandardMaterial({ color, map: tex('tablas_viejas.jpg', true), normalMap: tex('tablas_viejas_normal.jpg'), roughness: 0.9 });   // N1-KIT: tablas de 1905
  else if (tipo === 'zincViejo') m = new THREE.MeshStandardMaterial({ color, map: tex('zinc_viejo.jpg', true), normalMap: tex('zinc_viejo_normal.jpg'), roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide });
  else if (tipo === 'piedra') m = new THREE.MeshStandardMaterial({ color: color ?? 0xd8cfc0, map: tex('piedra.jpg', true), normalMap: tex('piedra_normal.jpg'), roughness: 0.95 });   // mampostería (tiñe el color del lote)
  else if (tipo === 'estuco') m = new THREE.MeshStandardMaterial({ color: color ?? 0xf1ece0, map: tex('estuco.jpg', true), normalMap: tex('estuco_normal.jpg'), roughness: 0.93 });   // N2-C33: muro estucado claro
  else if (tipo === 'acanalada') m = new THREE.MeshStandardMaterial({ color, map: tex('zinc.jpg', true), normalMap: tex('zinc_normal.jpg'), roughness: 0.62, metalness: 0.12 });   // N0-EMB: plancha acanalada pintada (vivienda obrera 035)
  else if (tipo === 'hormigon') m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('hormigon.jpg', true), normalMap: tex('hormigon_normal.jpg'), roughness: 0.92 });
  else if (tipo === 'blanco') m = new THREE.MeshStandardMaterial({ color: color ?? 0xeeeae0, roughness: 0.6 });
  else if (tipo === 'vidrio') m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.35 });
  else if (tipo === 'fierro') m = new THREE.MeshStandardMaterial({ color: color ?? 0x2b2d30, roughness: 0.6, metalness: 0.5 });
  else if (tipo === 'puerta') m = new THREE.MeshStandardMaterial({ color: color ?? 0x5a3620, roughness: 0.7 });
  else if (tipo === 'ladrillo') m = new THREE.MeshStandardMaterial({ color: color ?? 0x8a4a36, roughness: 0.9 });
  else m = new THREE.MeshStandardMaterial({ color: color ?? 0x888888, roughness: 0.9 });   // 'losa' de techo plano
  m.name = 'kit_' + k;
  // R-8: quién queda encima entre piezas coplanares (marcos y jambas blancos sobre el muro, fierro sobre blanco, vidrio sobre marcos): polygonOffset por rango. ?r8=0 lo apaga.
  const rg = { blanco: 1, puerta: 1.5, fierro: 2, vidrio: 3 }[tipo];
  if (rg && !/[?&]r8=0/.test(globalThis.location?.search || '')) { m.polygonOffset = true; const rc = rg + ((color ?? 0) % 97) / 97 * 0.9; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -rc * 8; }   // + un matiz por color: blancos/crema/celeste del mismo tipo también se ordenan
  return (matCache[k] = m);
}

// ---- utilidades de geometría: cajas y cuadriláteros que se juntan por material (una malla por material)
class Junta {
  constructor() { this.p = {}; }
  add(clave, g) { (this.p[clave] ||= []).push(g); }
  caja(clave, cx, cy, cz, sx, sy, sz, rotY = 0, rotX = 0, rotZ = 0) {
    const g = new THREE.BoxGeometry(Math.max(sx, 1e-3), Math.max(sy, 1e-3), Math.max(sz, 1e-3));
    if (rotX) g.rotateX(rotX); if (rotZ) g.rotateZ(rotZ); if (rotY) g.rotateY(rotY);
    g.translate(cx, cy, cz); this.add(clave, g);
  }
  // cuadrilátero a, b, c, d (antihorario visto desde afuera)
  quadR(clave, a, b, c, d) { this.quad(clave, a, d, c, b); }
  quad(clave, a, b, c, d) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    g.computeVertexNormals(); this.add(clave, g);
  }
  tri(clave, a, b, c) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    g.computeVertexNormals(); this.add(clave, g);
  }
  geometria(clave, uvMundo) {
    const lista = this.p[clave]; if (!lista || !lista.length) return null;
    const g = mergeGeometries(lista.map(x => x.index ? x.toNonIndexed() : x), false);
    lista.forEach(x => x.dispose());
    if (uvMundo) uvMundo(g);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
// UV en metros del mundo (2 m por repetición de textura): las tablas quedan a la misma altura en todas las caras
function uvCaja(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay > ax && ay > az) uv.setXY(i, x / 2, z / 2);
    else if (ax > az) uv.setXY(i, z / 2, y / 2);
    else uv.setXY(i, x / 2, y / 2);
  }
  uv.needsUpdate = true;
}
function uvTecho(p1) {   // zinc: ondas a lo largo del alero (u = x), v = distancia por la pendiente
  return g => {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, k = Math.sqrt(1 + p1 * p1);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (Math.abs(n.getX(i)) > 0.7) uv.setXY(i, z / 2, y / 2); else uv.setXY(i, x / 2, Math.abs(z) * k / 2);
    }
    uv.needsUpdate = true;
  };
}

// ---- módulo de ventana de guillotina (geometría real: jambas, marco, dos hojas, travesaños, alféizar, botaguas).
// Origen al centro del vano, en el plano del muro; +Z hacia afuera. Devuelve { marco, vidrio } (BufferGeometry) en caché.
const modCache = {};
function moduloVentana(w, h, panos = 2, puerta = false, simple = false, prof = 0) {
  const k = [w.toFixed(2), h.toFixed(2), panos, puerta, simple, prof].join('|');
  if (modCache[k]) return modCache[k];
  const J = new Junta(), B = 'b', t = 0.055, d = 0.16 + prof;   // prof (N1-KIT): el muro de piedra es grueso, la ventana va más adentro
  // jambas interiores del vano (el muro tiene el hueco: se ve el espesor); clave 'j': con muro de piedra van del material del muro
  const JB = prof ? 'j' : B;
  J.quadR(JB, [-w / 2, -h / 2, -d], [-w / 2, -h / 2, 0], [-w / 2, h / 2, 0], [-w / 2, h / 2, -d]);
  J.quadR(JB, [w / 2, -h / 2, 0], [w / 2, -h / 2, -d], [w / 2, h / 2, -d], [w / 2, h / 2, 0]);
  J.quadR(JB, [-w / 2, h / 2, 0], [w / 2, h / 2, 0], [w / 2, h / 2, -d], [-w / 2, h / 2, -d]);
  J.quadR(JB, [-w / 2, -h / 2, -d], [w / 2, -h / 2, -d], [w / 2, -h / 2, 0], [-w / 2, -h / 2, 0]);
  if (simple) {   // N1-KIT (1905): ventana de dos hojas de abatir (4 paños) con marco plano y alféizar; sin dintel moldurado ni faldón
    const zz = -prof, c = 0.09;
    J.caja(B, -w / 2 - c / 2 + 0.02, 0, zz + 0.02, c, h + 0.04, 0.05); J.caja(B, w / 2 + c / 2 - 0.02, 0, zz + 0.02, c, h + 0.04, 0.05);
    J.caja(B, 0, h / 2 + c / 2 - 0.02, zz + 0.02, w + 2 * c, c, 0.05);
    if (!puerta) J.caja(B, 0, -h / 2 - 0.04, 0.04, w + 0.24, 0.08, 0.2 + prof);   // alféizar (de piedra o tabla) que sale del muro
    const zh = zz - 0.09;
    for (const sx of [-1, 1]) {   // dos hojas: marco + un travesaño (2 paños cada una)
      const xm = sx * w / 4;
      J.caja(B, xm - w / 4 + t / 2, 0, zh, t, h, 0.045); J.caja(B, xm + w / 4 - t / 2, 0, zh, t, h, 0.045);
      J.caja(B, xm, h / 2 - t / 2, zh, w / 2, t, 0.045); J.caja(B, xm, -h / 2 + t * 0.7, zh, w / 2, t * 1.4, 0.045);
      J.caja(B, xm, puerta ? -h * 0.15 : 0, zh, w / 2 - t, 0.035, 0.03);
      if (puerta) J.caja(B, xm, -h / 2 + h * 0.18, zh - 0.005, w / 2 - 0.12, h * 0.3, 0.03);
    }
    const V = new Junta();
    V.quad('v', [-w / 2, -h / 2, zh - 0.03], [w / 2, -h / 2, zh - 0.03], [w / 2, h / 2, zh - 0.03], [-w / 2, h / 2, zh - 0.03]);
    return (modCache[k] = { marco: J.geometria(B), vidrio: V.geometria('v'), jamba: J.geometria('j', uvCaja) });
  }
  // marco exterior (tapajuntas) que sobresale del muro
  const c = 0.11;
  J.caja(B, -w / 2 - c / 2 + 0.01, 0, 0.02, c, h + 0.02, 0.05); J.caja(B, w / 2 + c / 2 - 0.01, 0, 0.02, c, h + 0.02, 0.05);
  J.caja(B, 0, h / 2 + 0.08, 0.025, w + 2 * c + 0.06, 0.17, 0.06);       // dintel
  J.caja(B, 0, h / 2 + 0.185, 0.05, w + 2 * c + 0.14, 0.045, 0.11);      // botaguas
  if (!puerta) {
    J.caja(B, 0, -h / 2 - 0.03, 0.05, w + 2 * c + 0.1, 0.06, 0.16);      // alféizar
    J.caja(B, 0, -h / 2 - 0.12, 0.015, w + 0.06, 0.12, 0.04);            // faldón bajo el alféizar
  }
  // hojas: la de arriba más afuera, la de abajo más adentro (como una guillotina de verdad)
  const hoja = (y0, y1, z, travV, travH) => {
    const hh = y1 - y0, ym = (y0 + y1) / 2;
    J.caja(B, -w / 2 + t / 2, ym, z, t, hh, 0.045); J.caja(B, w / 2 - t / 2, ym, z, t, hh, 0.045);
    J.caja(B, 0, y1 - t / 2, z, w, t, 0.045); J.caja(B, 0, y0 + t * 0.7, z, w, t * 1.4, 0.045);
    for (let i = 1; i < travV; i++) J.caja(B, -w / 2 + t + (w - 2 * t) * i / travV, ym, z, 0.028, hh - t, 0.03);
    for (let i = 1; i < travH; i++) J.caja(B, 0, y0 + t + (hh - 2 * t) * i / travH, z, w - t, 0.028, 0.03);
  };
  const vt = panos >= 6 ? 3 : 2, ht = panos >= 6 ? 2 : 1;
  if (puerta) {   // puerta-ventana de balcón: dos hojas con vidrio arriba y tablero abajo
    hoja(-h / 2, h / 2, -0.08, 2, 3);
    J.caja(B, 0, -h / 2 + h * 0.18, -0.085, w - 0.1, h * 0.34, 0.03);
  } else {
    hoja(-0.015, h / 2, -0.07, vt, ht);
    hoja(-h / 2, 0.035, -0.115, vt, ht);
  }
  const marco = J.geometria(B);
  const V = new Junta();
  V.quad('v', [-w / 2, -h / 2, -0.125], [w / 2, -h / 2, -0.125], [w / 2, h / 2, -0.125], [-w / 2, h / 2, -0.125]);
  return (modCache[k] = { marco, vidrio: V.geometria('v'), jamba: J.geometria('j', uvCaja) });
}

// ---- muro con vanos: corta la fachada en una grilla y deja fuera las celdas de los vanos
function muroConVanos(J, clave, aMundo, u0, u1, v0, v1, vanos) {
  const us = new Set([u0, u1]), vs = new Set([v0, v1]);
  for (const o of vanos) { us.add(o.u0); us.add(o.u1); vs.add(o.v0); vs.add(o.v1); }
  const U = [...us].filter(u => u >= u0 && u <= u1).sort((a, b) => a - b), Vv = [...vs].filter(v => v >= v0 && v <= v1).sort((a, b) => a - b);
  for (let i = 0; i < U.length - 1; i++) {
    // juntar celdas verticales contiguas llenas (menos triángulos)
    let ini = null;
    for (let j = 0; j <= Vv.length - 1; j++) {
      const llena = j < Vv.length - 1 && !vanos.some(o => U[i] >= o.u0 - 1e-6 && U[i + 1] <= o.u1 + 1e-6 && Vv[j] >= o.v0 - 1e-6 && Vv[j + 1] <= o.v1 + 1e-6);
      if (llena && ini === null) ini = Vv[j];
      if (!llena && ini !== null) { J.quad(clave, aMundo(U[i], ini), aMundo(U[i + 1], ini), aMundo(U[i + 1], Vv[j]), aMundo(U[i], Vv[j])); ini = null; }
    }
  }
}

function aclarar(hex, f) { const c = new THREE.Color(hex); return c.lerp(new THREE.Color(0xffffff), f).getHex(); }
// semilla simple (cortinas y detalles que cambian de un edificio a otro sin parpadear entre cargas)
function azar(s) { let x = (s >>> 0) || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

/**
 * edificioKit(op): edificio de Sewell hecho a mano.
 * op.largo, op.ancho, op.alto: caja total en metros (eje largo en X, frente +Z). Obligatorios.
 * op.pisos: pisos con ventanas (si no, se calculan con altoPiso ~3,3 m). op.color: tablas (hex). op.colorTecho: zinc (hex).
 * op.techo: 'dos' (dos aguas con cumbrera a lo largo) | 'plano' (losa con parapeto y cornisa) | 'artdeco' (plano con frontón escalonado).
 * op.pendiente: alto/avance del techo a dos aguas (0,8). op.alero: vuelo del alero (0,45). op.zocalo: alto del zócalo de hormigón (1,2).
 * op.vano: distancia entre ventanas (2,2). op.grupo: ventanas entre pilastras (5; 0 = sin pilastras). op.panos: 2 (2 sobre 2) o 6.
 * op.ventanasLado: ventanas también en los costados (true). op.cintas: molduras horizontales entre pisos (false). op.chimeneas: cuántas en la cumbrera (0).
 * op.balcones: cada cuántas ventanas del frente va un balcón de madera (0 = ninguno). op.escaleraIncendio: 'este' | 'oeste' | null.
 * op.porche: deja libre el vano central del primer piso y un relleno donde el juego pone su cortavientos (puerta con sala).
 * op.puerta: dibuja una puerta de madera en el vano central del primer piso (si no hay porche). op.letrero: tabla blanca
 * en el alero del frente, detrás del número que pone el juego. op.lejos: distancia (m) desde la que se ocultan los marcos (220).
 * op.semilla: número para las cortinas.
 */
export function edificioKit(op) {
  if (op.forma === 'cine165') return cine165(op);   // N2-C33: Teatro de Sewell (edificio 165)
  const L = op.largo, W = op.ancho, H = op.alto;
  const techo = op.techo || 'dos', zoc = op.zocalo ?? 1.2, vano = op.vano ?? 2.2;
  const alero = techo === 'dos' ? (op.alero ?? 0.45) : 0.25, aleroG = techo === 'dos' ? Math.min(alero, 0.35) : 0.25;
  const Lw = L - 2 * aleroG, Ww = W - 2 * alero;              // muros
  const r = azar(op.semilla ?? Math.round(L * 131 + W * 17 + H * 7));
  const J = new Junta();
  const colTablas = op.color ?? 0x4f8a3c, colTecho = op.colorTecho ?? 0xa8432f;
  // N1-KIT (estilo '1905'): tablas viejas, calamina gastada, molduras de madera café, zócalo y peldaños de piedra, ventanas de abatir
  // de 4 paños sin molduras, puertas de tablas, sin friso, pilastras ni canaleta. op.muro: 'piedra' | 'estuco' | (tablas);
  // op.piedraHasta: alto (m sobre la base) hasta donde llega la piedra; arriba, tablas (casa Hamilton). op.hastial: 'piedra' | 'estuco'
  const v1905 = op.estilo === '1905';
  const kTab = v1905 ? 'tablasViejas' : 'tablas', kZoc = v1905 ? 'piedra' : 'hormigon';
  const kMuro = op.muro === 'piedra' || op.muro === 'estuco' || op.muro === 'acanalada' ? op.muro : kTab;
  // --- alturas
  const p1 = op.pendiente ?? 0.8, tr = 0.12, chim = op.chimeneas || 0;
  let yM, yR = 0, yE = 0;
  if (techo === 'dos') {
    yR = op.yCumbrera ?? H - (chim ? 1.3 : 0.2);   // cumbrera (la tapa sobresale 0,2; las chimeneas 1,3). yCumbrera (N0-KIT): fija, las chimeneas asoman 1,1 m sobre ella
    yE = yR - p1 * W / 2;                         // borde del alero
    yM = yE + p1 * alero - tr;                    // tope del muro: bajo la cara inferior del techo
  } else yM = op.yLosa ?? H - (techo === 'artdeco' ? 1.6 : 0.9);   // tope del muro bajo el parapeto (yLosa: la losa caminable que pide el juego)
  const altoUtil = yM - zoc - 0.45;               // menos el friso
  const pisos = op.pisos || Math.max(1, Math.round(altoUtil / 3.3));
  const hp = altoUtil / pisos;
  const hv = op.altoVentana ?? Math.min(1.9, hp * 0.55), wv = op.anchoVentana ?? Math.min(1.05, vano * 0.47);
  const yPiso = i => zoc + i * hp, yVent = i => yPiso(i) + (op.antepecho ?? hp * 0.3) + hv / 2;   // antepecho: alto del alféizar sobre el piso (ventanas altas del palitroque)
  const yP = kMuro === kTab ? zoc : Math.min(op.piedraHasta ?? yM, yM);   // muro de piedra/estuco hasta yP; tablas de yP a yM
  const kHast = op.hastial || (yP >= yM ? kMuro : kTab), grueso = kMuro === 'piedra' ? 0.18 : 0;   // vano más hondo en la piedra

  // --- caras (facade): frente (+Z), fondo (-Z), este (+X), oeste (-X). aMundo(u, v, d): u a lo largo (izq→der visto de afuera), d hacia afuera
  // corredor (N0-KIT, estación): el muro del frente se mete `corredor` m y queda una galería techada con pilares sobre el zócalo
  const pc = op.corredor || 0, zF = Ww / 2 - pc, zc = -pc / 2;
  // porcheBajo (ronda 4, oficina de ingeniería): porche SOLO en planta baja: el muro del piso 1 se mete `porcheBajo` m en un tramo central
  // de ventanas completas (pw) y los pisos de arriba quedan al ras del frente, sobre el porche con columnas (foto oficina_ingenieria.webp)
  const pisosPB = op.porcheBajo && !op.porche && !pc && pisos >= 2;
  const pb = pisosPB ? op.porcheBajo : 0, yUp = yPiso(1) - 0.12;
  let pw = 0;
  if (pb) { let nbF = Math.max(1, Math.floor((Lw - 1.8) / vano)); if (nbF % 2 === 0) nbF--; const m = Math.max(0, Math.min(Math.round((nbF * 0.7 - 1) / 2), (nbF - 1) / 2 - 1)); pw = (2 * m + 1) * vano; }
  const zRec = Ww / 2 - pb, enPorche = (u, v) => pb && v < yUp && Math.abs(u) < pw / 2;
  const caras = [
    { id: 'frente', largo: Lw, f: (u, v, d = 0) => [u, v, (enPorche(u, v) ? zRec : zF) + d], fMuro: (u, v) => [u, v, zF], rot: 0 },
    { id: 'fondo', largo: Lw, f: (u, v, d = 0) => [-u, v, -Ww / 2 - d], rot: Math.PI },
    { id: 'este', largo: Ww - pc, f: (u, v, d = 0) => [Lw / 2 + d, v, zc - u], rot: Math.PI / 2 },
    { id: 'oeste', largo: Ww - pc, f: (u, v, d = 0) => [-Lw / 2 - d, v, zc + u], rot: -Math.PI / 2 },
  ];
  const ventanas = [];   // { cara, u, v, w, h, puerta }
  const mE = 0.9;        // margen de esquina
  for (const c of caras) {
    const lateral = c.id === 'este' || c.id === 'oeste';
    if (lateral && op.ventanasLado === false) { c.vanos = []; continue; }
    let nb = Math.max(1, Math.floor((c.largo - 2 * mE) / vano));
    if (c.id === 'frente' && (op.porche || op.puerta) && nb % 2 === 0) nb--;   // vano central para la puerta
    if (lateral && (op.escaleraIncendio === c.id || op.corredorTestero === c.id) && nb % 2 === 0) nb--;
    const us = Array.from({ length: nb }, (_, i) => (i - (nb - 1) / 2) * vano);
    c.us = us; c.vanos = [];
    const grupo = op.grupo ?? 5;
    for (let p = 0; p < pisos; p++) for (let i = 0; i < nb; i++) {
      const u = us[i];
      if (p === 0 && c.id === 'frente' && (op.porche || op.puerta) && Math.abs(u) < 1e-6) continue;
      if (c.id === 'frente' && op.libreCentro && Math.abs(u) < op.libreCentro) continue;   // muro liso al centro del frente (letrero grande sobre la entrada)
      if (c.id === 'frente' && op.cartel && Math.abs(u) - wv / 2 < op.cartel.u && yVent(p) + hv / 2 > op.cartel.v0 && yVent(p) - hv / 2 < op.cartel.v1) continue;   // N1-KIT: tras el letrero del juego
      const balcon = !lateral && c.id === 'frente' && op.balcones && p > 0 && (i % op.balcones === Math.floor(op.balcones / 2));
      const esc = lateral && (op.escaleraIncendio === c.id || (op.corredorTestero === c.id && p > 0)) && Math.abs(u) < 1e-6 && p > 0;
      const pta = balcon || esc;
      const h = pta ? Math.min(hp - 0.55, 2.3) : hv, v = pta ? yPiso(p) + 0.08 + h / 2 : yVent(p);
      if (op.pareadas && !pta && !lateral) {   // N0-EMB (vivienda de empleados): dos ventanas juntas por vano, con un montante de muro al medio
        for (const s2 of [-1, 1]) { const u2 = u + s2 * (wv / 2 + 0.07); ventanas.push({ c, u: u2, v, w: wv, h, puerta: false }); c.vanos.push({ u0: u2 - wv / 2, u1: u2 + wv / 2, v0: v - h / 2, v1: v + h / 2 }); }
        continue;
      }
      ventanas.push({ c, u, v, w: wv, h, puerta: pta, balcon });
      c.vanos.push({ u0: u - wv / 2, u1: u + wv / 2, v0: v - h / 2, v1: v + h / 2 });
    }
    c.grupo = grupo;
  }
  // --- puerta del primer piso (vano y hoja de madera) o relleno para el cortavientos del juego
  const cf = caras[0];
  // ESC (16-11, Diego: «que Nato no se entierre en las escaleras»): los peldaños de la puerta del kit eran solo dibujo (sin colisión):
  // Nato pisaba el podio y quedaba hundido en ellos. Se guardan [x, tope, z, ancho, huella] (marco del kit, y 0 = base) en
  // userData.kit.peldanos y interiores.js (colisionKit) les pone una caja de colisión igual a cada uno.
  const peldanosKit = [];
  if (op.porche) {
    J.caja(kMuro, 0, 1.85, Ww / 2 + alero / 2, 3.4, 3.7, alero);      // relleno: el cortavientos del juego queda pegado al muro
  } else if (op.puerta && v1905) {   // N1-KIT: puerta de tablas verticales con travesaños y riostra en Z, marco café y peldaños de piedra
    const wp = 1.2, hpu = Math.min(2.25, hp * 0.8), y0 = zoc, zp = zF;
    cf.vanos.push({ u0: -wp / 2, u1: wp / 2, v0: y0, v1: y0 + hpu });
    J.caja('puerta', 0, y0 + hpu / 2, zp - 0.1 - grueso, wp, hpu, 0.06);
    for (let k = 1; k < 5; k++) J.caja('fierro', -wp / 2 + k * wp / 5, y0 + hpu / 2, zp - 0.07 - grueso, 0.015, hpu - 0.04, 0.01);   // juntas de las tablas
    for (const yy of [0.3, hpu - 0.3]) J.caja('puerta', 0, y0 + yy, zp - 0.05 - grueso, wp - 0.12, 0.13, 0.04);
    J.caja('puerta', 0, y0 + hpu / 2, zp - 0.05 - grueso, 0.12, Math.hypot(wp - 0.3, hpu - 0.6), 0.04, 0, 0, -Math.atan2(wp - 0.3, hpu - 0.6));
    if (grueso) for (const sx of [-1, 1]) J.quadR(kMuro, ...(sx < 0 ? [[-wp / 2, y0, zp - 0.1 - grueso], [-wp / 2, y0, zp], [-wp / 2, y0 + hpu, zp], [-wp / 2, y0 + hpu, zp - 0.1 - grueso]] : [[wp / 2, y0, zp], [wp / 2, y0, zp - 0.1 - grueso], [wp / 2, y0 + hpu, zp - 0.1 - grueso], [wp / 2, y0 + hpu, zp]]));
    if (grueso) J.quadR(kMuro, [-wp / 2, y0 + hpu, zp], [wp / 2, y0 + hpu, zp], [wp / 2, y0 + hpu, zp - 0.1 - grueso], [-wp / 2, y0 + hpu, zp - 0.1 - grueso]);
    for (const sx of [-1, 1]) J.caja('blanco', sx * (wp / 2 + 0.05), y0 + hpu / 2, zp + 0.02, 0.1, hpu + 0.06, 0.06);
    J.caja(grueso ? 'piedraClara' : 'blanco', 0, y0 + hpu + 0.1, zp + 0.03, wp + (grueso ? 0.7 : 0.3), 0.2, grueso ? 0.12 : 0.08);   // dintel (piedra labrada en los muros de piedra)
    const np = Math.max(1, Math.round(zoc / 0.2)), paso = 0.26;
    for (let k = 0; k < np; k++) { const top = zoc - k * zoc / np; J.caja('piedra', 0, top / 2, zp + 0.06 + (k + 0.5) * paso, wp + 0.7, top, paso); peldanosKit.push([0, top, zp + 0.06 + (k + 0.5) * paso, wp + 0.7, paso]); }   // ESC: medidas para su colisión
  } else if (op.puerta) {   // puerta de madera sobre el zócalo, con dintel, tejadillo y peldaños de hormigón hasta el suelo
    const wp = 1.4, hpu = Math.min(2.5, hp * 0.8), y0 = zoc, zp = zF - pb;
    cf.vanos.push({ u0: -wp / 2, u1: wp / 2, v0: y0, v1: y0 + hpu });
    J.caja('puerta', 0, y0 + hpu / 2, zp - 0.12, wp, hpu, 0.06);
    for (const sx of [-1, 1]) J.caja('puerta', sx * wp * 0.24, y0 + hpu * 0.3, zp - 0.08, wp * 0.36, hpu * 0.4, 0.03);   // tableros
    for (const sx of [-1, 1]) J.caja('blanco', sx * (wp / 2 + 0.06), y0 + hpu / 2, zp + 0.02, 0.12, hpu + 0.1, 0.06);
    J.caja('blanco', 0, y0 + hpu + 0.1, zp + 0.03, wp + 0.4, 0.2, 0.08);
    if (!pb) J.caja('blanco', 0, y0 + hpu + 0.45, zp + 0.45, wp + 1.0, 0.08, 0.9, 0, 0.15);   // tejadillo (con porcheBajo lo cubre el porche)
    const np = Math.max(1, Math.round(zoc / 0.2)), paso = 0.28;   // los peldaños salen de la caja (~1,4 m hacia la calle); ESC: huella 0,28 (con 0,24 el paso automático no subía dos peldaños seguidos)
    // ESC (16-11): con pórtico (piso de 1,7 m a la altura del zócalo) los peldaños quedaban DENTRO de su piso: se veía un bloque de hasta
    // 1,2 m sin escalones (Nato lo atravesaba hundido). Ahora bajan desde el borde del pórtico
    const sal = op.portico ? Math.max(0, zF + 1.7 - zp - 0.06) : 0;
    for (let k = 0; k < np; k++) { const top = zoc - k * zoc / np, zc = zp + 0.06 + sal + (k + 0.5) * paso; J.caja('hormigon', 0, top / 2, zc, wp + 0.6, top, paso); peldanosKit.push([0, top, zc, wp + 0.6, paso]); }   // ESC: medidas para su colisión
  }
  // portones (ronda 4, taller de 1967): n portones corredizos de chapa en el frente, con riel arriba y refuerzos (se dibujan sobre el muro, 0,1 m)
  if (op.portones) {
    const n = op.portones, wg = Math.min(4.4, Lw / n * 0.72), hg = Math.min(op.altoPorton ?? 4.6, yM - 0.8), z = zF + 0.05;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (Lw / n);
      J.caja('fierro', x, zoc + hg / 2, z, wg, hg, 0.08); J.caja('blanco', x, zoc + hg + 0.1, z, wg + 0.5, 0.2, 0.12);
      for (const s2 of [-1, 1]) J.caja('blanco', x + s2 * (wg / 2 + 0.12), zoc + hg / 2, z, 0.18, hg + 0.1, 0.12);
      for (let k = 1; k < 4; k++) J.caja('blanco', x, zoc + hg * k / 4, z + 0.05, wg - 0.2, 0.06, 0.04);
      J.caja('blanco', x, zoc + hg / 2, z + 0.05, 0.05, hg - 0.1, 0.04);
    }
  }
  // --- muros con vanos (tablas) y zócalo de hormigón
  for (const c of caras) {
    const vn = (c.vanos || []).filter(o => o.v1 > zoc);
    const banda = (clave, v0, v1) => {   // porcheBajo: la banda de planta baja del frente va en tres tramos (pilares al ras y fondo del porche)
      if (!(pb && c.id === 'frente') || v0 >= yUp) return muroConVanos(J, clave, (u, v) => c.f(u, v), -c.largo / 2, c.largo / 2, v0, v1, vn);
      const vt = Math.min(v1, yUp);
      muroConVanos(J, clave, (u, v) => [u, v, zF], -c.largo / 2, -pw / 2, v0, vt, vn);
      muroConVanos(J, clave, (u, v) => [u, v, zRec], -pw / 2, pw / 2, v0, vt, vn);
      muroConVanos(J, clave, (u, v) => [u, v, zF], pw / 2, c.largo / 2, v0, vt, vn);
      if (v1 > yUp) muroConVanos(J, clave, (u, v) => [u, v, zF], -c.largo / 2, c.largo / 2, yUp, v1, vn);
    };
    if (yP > zoc) banda(kMuro, zoc, yP);
    if (yP < yM) banda(kTab, yP, yM);
  }
  J.caja(op.colorZocalo ? 'zocalo' : kZoc, 0, zoc / 2, 0, Lw + (v1905 ? 0.2 : 0.12), zoc, Ww + (v1905 ? 0.2 : 0.12));   // colorZocalo (N0-EMB, oficina de ingeniería): zócalo estucado de color
  if (v1905 && yP > zoc && yP < yM) J.caja('blanco', 0, yP, 0, Lw + 0.08, 0.16, Ww + 0.08);   // tabla de remate entre la piedra y la madera
  // --- molduras blancas: esquineros, cinta sobre el zócalo, cintas de piso, friso bajo el alero, pilastras entre grupos
  const blancoEx = 0.04;
  if (kMuro === 'piedra' && yP > zoc) {   // N1-KIT: esquinas de sillares labrados (cantería clara, largos alternados) en lugar de esquineros
    const nq = Math.max(1, Math.round((yP - zoc) / 0.36)), hq = (yP - zoc) / nq;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < nq; k++) {
      const largoX = k % 2 ? 0.34 : 0.62, largoZ = k % 2 ? 0.62 : 0.34, y = zoc + (k + 0.5) * hq;
      J.caja('piedraClara', sx * (Lw / 2 - largoX / 2 + 0.03), y, sz * (Ww / 2 - largoZ / 2 + 0.03), largoX, hq - 0.035, largoZ);
    }
  }
  if (!v1905 || yP < yM) for (const sx of [-1, 1]) for (const sz of [-1, 1]) J.caja('blanco', sx * (Lw / 2 + blancoEx / 2 - 0.08), ((v1905 ? yP : zoc) + yM) / 2, sz * (Ww / 2 + blancoEx / 2 - 0.08), v1905 ? 0.2 : 0.26, yM - (v1905 ? yP : zoc), v1905 ? 0.2 : 0.26);
  if (!v1905) J.caja('blanco', 0, zoc + 0.06, 0, Lw + 0.16, 0.14, Ww + 0.16);                     // botaguas del zócalo
  if (op.cintas) for (let p = 1; p < pisos; p++) J.caja('blanco', 0, yPiso(p), 0, Lw + 0.06, 0.14, Ww + 0.06);  // cinta de cada piso (op.cintas)
  if (!v1905) J.caja('blanco', 0, yM - 0.22, 0, Lw + 0.1, 0.44, Ww + 0.1);                        // friso
  else if (yP < yM) J.caja('blanco', 0, yM - 0.12, 0, Lw + 0.06, 0.24, Ww + 0.06);               // 1905: tapacán bajo el alero (sin friso)
  for (const c of caras) {
    if (v1905) break;   // 1905: sin pilastras
    if (!c.us || !c.grupo || c.us.length <= c.grupo) continue;
    for (let i = c.grupo; i < c.us.length; i += c.grupo) {
      const u = (c.us[i - 1] + c.us[i]) / 2, [x, , z] = c.f(u, 0, 0.02);
      const lat = c.id === 'este' || c.id === 'oeste';
      J.caja('blanco', x, (zoc + yM) / 2, z, lat ? 0.05 : 0.16, yM - zoc, lat ? 0.16 : 0.05);
    }
  }
  // --- techo
  const kZinc = v1905 ? 'zincViejo' : 'zinc';
  if (techo === 'dos') {
    const zt = W / 2, yTop = z => yR - p1 * Math.abs(z), x0 = -L / 2, x1 = L / 2;
    for (const s of [1, -1]) {   // dos aguas: cara de arriba, cara de abajo y canto (losa de zinc de 12 cm)
      const a = [x0, yTop(0), 0], b = [x1, yTop(0), 0], c = [x1, yE, s * zt], d = [x0, yE, s * zt];
      if (s > 0) J.quad(kZinc, d, c, b, a); else J.quad(kZinc, a, b, c, d);
      const dn = q => [q[0], q[1] - tr, q[2]];
      if (s > 0) J.quad('blanco', dn(a), dn(b), dn(c), dn(d)); else J.quad('blanco', dn(d), dn(c), dn(b), dn(a));   // cielo del alero
      // tapacán del alero
      J.caja('blanco', 0, yE - 0.1, s * (zt - 0.03), L, 0.24, 0.06);
      if (!v1905) J.caja('fierro', 0, yE - 0.24, s * (zt - 0.1), L - 0.1, 0.1, 0.12, 0, 0, 0);   // canaleta (1905: sin canaleta)
    }
    // hastiales (triángulo de tablas sobre el muro) y tapas de los cantos
    for (const sx of [-1, 1]) {
      const xg = sx * Lw / 2, apex = yR - tr - 0.02, ys = yM;
      const zA = Ww / 2;
      if (sx > 0) J.tri(kHast, [xg, ys, zA], [xg, ys, -zA], [xg, apex, 0]); else J.tri(kHast, [xg, ys, -zA], [xg, ys, zA], [xg, apex, 0]);
      // tapas laterales de la losa del techo (canto) y tapacanes inclinados blancos
      for (const s of [1, -1]) {
        const xe = sx * L / 2, ang = Math.atan(p1), len = Math.hypot(zt, yR - yE);
        J.caja('blanco', xe - sx * 0.03, (yR + yE) / 2 - 0.1, s * zt / 2, 0.06, 0.26, len, 0, s * ang);
      }
      // ventila del hastial (rombo de persianas)
      const yv = ys + (apex - ys) * 0.45;
      if (v1905) { if (apex - ys > 1.6) { J.caja('blanco', xg + sx * 0.03, yv, 0, 0.06, 0.7, 0.6); J.caja('puerta', xg + sx * 0.06, yv, 0, 0.03, 0.56, 0.46); } continue; }   // 1905: postigo de tablas
      J.caja('blanco', xg + sx * 0.03, yv, 0, 0.06, 0.9, 1.3);
      for (let k = -2; k <= 2; k++) J.caja('fierro', xg + sx * 0.06, yv + k * 0.15, 0, 0.04, 0.05, 1.1);
    }
    // cumbrera: tapa en V de zinc
    const ang = Math.atan(p1);
    for (const s of [1, -1]) J.caja('fierro', 0, yR + 0.06, s * 0.13, L + 0.02, 0.04, 0.34, 0, s * ang);
    J.caja('fierro', 0, yR + 0.14, 0, L + 0.02, 0.06, 0.08);
    // chimeneas de ladrillo en la cumbrera
    for (let k = 0; k < chim; k++) {
      const x = (k - (chim - 1) / 2) * (Lw / Math.max(chim, 1)) * 0.8;
      const yc = op.yCumbrera != null ? yR + 1.1 : H - 0.08;
      if (v1905 && op.chimenea === 'lata') {   // 1905: tubo de lata con sombrerete (galpones y casas de madera)
        const zc0 = Ww * 0.22, yb0 = yR - p1 * zc0 - 0.2;
        J.add('fierro', new THREE.CylinderGeometry(0.18, 0.18, yc + 0.6 - yb0, 10).translate(x, (yc + 0.6 + yb0) / 2, zc0));
        J.add('fierro', new THREE.ConeGeometry(0.38, 0.3, 10).translate(x, yc + 0.85, zc0));
        continue;
      }
      J.caja(v1905 ? 'piedra' : 'ladrillo', x, (yR - 1 + yc) / 2, 0, 0.8, yc - (yR - 1), 0.6);
      J.caja(v1905 ? 'piedraClara' : 'hormigon', x, yc + 0.03, 0, 0.95, 0.1, 0.75);
    }
    // tabla del número (letrero): en el alero del frente, a la altura donde el juego pone el «157»
    if (op.letrero) {
      const yl = op.letrero.y ?? (H - 5);   // el juego pone el número a (alto - 5 m) sobre la base (construir.js, e.numero)
      J.caja('blanco', 0, yl, zt - 0.06, op.letrero.ancho ?? 5.6, op.letrero.alto ?? 2.0, 0.1);
      for (const s of [-1, 1]) J.caja('fierro', s * 2.2, yl - 0.4, zt - 0.6, 0.08, 0.08, 1.1, 0, 0.6);   // tornapuntas
    }
  } else {
    const yL = yM;   // losa
    J.caja('losa', 0, yL - 0.1, 0, Lw - 0.1, 0.2, Ww - 0.1);
    const bc = (L - Lw) / 2 + 0.35;   // cornisa: un anillo (antes una caja llena que tapaba la losa con una placa blanca)
    J.caja('blanco', 0, yL + 0.15, (W - bc) / 2, L, 0.3, bc); J.caja('blanco', 0, yL + 0.15, -(W - bc) / 2, L, 0.3, bc);
    J.caja('blanco', (L - bc) / 2, yL + 0.15, 0, bc, 0.3, W - 2 * bc); J.caja('blanco', -(L - bc) / 2, yL + 0.15, 0, bc, 0.3, W - 2 * bc);
    const hPar = H - yL - 0.3;
    const parapeto = (x, z, sx, sz, h) => { J.caja('tablas', x, yL + 0.3 + h / 2, z, sx, h, sz); J.caja('blanco', x, yL + 0.3 + h + 0.04, z, sx + 0.08, 0.08, sz + 0.08); };
    const hp0 = techo === 'artdeco' ? hPar - 0.75 : hPar - 0.08;
    parapeto(0, Ww / 2 - 0.1, Lw, 0.2, hp0); parapeto(0, -Ww / 2 + 0.1, Lw, 0.2, hp0);
    parapeto(Lw / 2 - 0.1, 0, 0.2, Ww, hp0); parapeto(-Lw / 2 + 0.1, 0, 0.2, Ww, hp0);
    if (techo === 'artdeco') {   // frontón escalonado al centro del frente y bandas horizontales
      for (let k = 0; k < 3; k++) { const wk = Math.min(Lw * 0.5, 8) - k * 2; parapeto(0, Ww / 2 - 0.1, wk, 0.22, hp0 + (k + 1) * 0.22); }
      for (const yy of [yM - 1.1, yM - 1.4]) J.caja('blanco', 0, yy, 0, Lw + 0.04, 0.07, Ww + 0.04);
    }
    if (chim) for (let k = 0; k < chim; k++) J.caja('ladrillo', (k - (chim - 1) / 2) * 6, yL + 0.6, -Ww / 4, 0.8, 1.2, 0.6);
  }
  // ESC2 (16-11): el piso que se ve en el porche y la galería es el botaguas del zócalo (caja blanca hasta zoc + 0,13, sin el kit de 1905):
  // con la colisión a zoc Nato quedaba 13 cm hundido (se vio al recortar la caja del edificio, interiores.js recortarCuerpo)
  const zBot = v1905 ? zoc : zoc + 0.13;
  if (pb) peldanosKit.push([0, zBot, (zRec + Ww / 2 + 0.06) / 2, pw, Ww / 2 + 0.06 - zRec]);   // ESC: piso del porche (el zócalo a la vista) con colisión
  if (pc) peldanosKit.push([0, zBot, (zF + Ww / 2 + 0.06) / 2, Lw + 0.12, Ww / 2 + 0.06 - zF]);   // ESC: piso de la galería, ídem
  if (pb) {   // porche de planta baja: cielo y viga bajo el piso 1, columnas y retornos de los pilares al ras
    J.caja('blanco', 0, yUp - 0.03, (zRec + Ww / 2) / 2, pw, 0.06, pb);
    J.caja('blanco', 0, yUp - 0.17, Ww / 2 - 0.1, pw + 0.3, 0.34, 0.2);
    const nc = Math.max(2, Math.round(pw / 3.4));
    for (let i = 0; i <= nc; i++) { const x = -pw / 2 + i * pw / nc; J.caja('blanco', x, (zoc + yUp) / 2, Ww / 2 - 0.2, 0.2, yUp - zoc - 0.34, 0.2); }
    for (const sx of [-1, 1]) J.caja(kMuro, sx * (pw / 2 + 0.1), (zoc + yUp) / 2, (zRec + Ww / 2) / 2 - 0.01, 0.2, yUp - zoc, pb - 0.02);
  }
  if (pc) {   // pilares de la galería (con jabalcones al friso) y cielo de tablas
    const n = Math.max(2, Math.round(Lw / 3.2)), zp = Ww / 2 - 0.16;
    for (let i = 1; i < n; i++) {
      const x = -Lw / 2 + i * Lw / n;
      J.caja('blanco', x, (zoc + yM) / 2, zp, 0.2, yM - zoc, 0.2);
      for (const s of [-1, 1]) J.caja('blanco', x + s * 0.4, yM - 0.75, zp, 0.1, 0.9, 0.1, 0, 0, s * 0.75);
    }
    J.caja('blanco', 0, yM - 0.05, (zF + Ww / 2) / 2, Lw, 0.08, pc);
  }
  // marquesina art déco sobre la entrada (cine): losa blanca con canto de fierro y tirantes al muro; su frente sale `sale` m de la caja
  if (op.marquesina) {
    const mq = op.marquesina, wq = mq.ancho ?? 7, y = mq.y ?? 4.2, hq = mq.alto ?? 1.5, z0 = Ww / 2, z1 = W / 2 + (mq.sale ?? 0.5);
    J.caja('blanco', 0, y + hq / 2, z1 - 0.12, wq, hq, 0.24);                         // frente de la marquesina (las letras del juego van encima)
    J.caja('blanco', 0, y + 0.06, (z0 + z1) / 2, wq, 0.12, z1 - z0);                   // losa
    J.caja('blanco', 0, y + hq - 0.06, (z0 + z1) / 2, wq, 0.12, z1 - z0);              // tapa
    for (const s of [-1, 1]) J.caja('blanco', s * (wq / 2 - 0.06), y + hq / 2, (z0 + z1) / 2, 0.12, hq, z1 - z0);
    for (const yy of [y + 0.25, y + hq - 0.25]) J.caja('fierro', 0, yy, z1 + 0.01, wq + 0.02, 0.06, 0.04);   // filetes
    const dz = z1 - 0.15 - z0, dyT = 1.6;   // tirantes de fierro del canto de la marquesina al muro (bajan hacia afuera)
    for (const s of [-1, 1]) J.caja('fierro', s * wq * 0.35, y + hq + dyT / 2, z0 + dz / 2, 0.05, 0.05, Math.hypot(dz, dyT), 0, Math.atan2(dyT, dz));
  }
  // --- N0-EMB: pórtico de entrada con techo propio (vivienda de empleados: postes blancos, techo rojo a dos aguas y baranda)
  if (op.portico && (op.puerta || op.porche)) {
    const zp = zF, d = 1.7, wpo = 2.8, yE2 = zoc + 2.75, pp = 0.75, yR2 = yE2 + pp * (wpo / 2 + 0.25);
    for (const sx of [-1, 1]) for (const dz of [d - 0.1]) { J.caja('blanco', sx * (wpo / 2 - 0.1), (zoc + yE2) / 2, zp + dz, 0.16, yE2 - zoc, 0.16); }
    J.caja(kZoc, 0, zoc / 2, zp + d / 2, wpo, zoc, d); peldanosKit.push([0, zoc, zp + d / 2, wpo, d]);   // ESC: piso del pórtico con colisión (antes Nato se hundía 0,45 m en él)
    for (const sx of [-1, 1]) { J.caja('blanco', sx * (wpo / 2 - 0.1), zoc + 0.95, zp + d / 2, 0.07, 0.07, d); for (let k = 1; k < 6; k++) J.caja('blancoFino', sx * (wpo / 2 - 0.1), zoc + 0.5, zp + k * d / 6, 0.035, 0.9, 0.035); }
    J.caja('blanco', 0, yE2 - 0.1, zp + d - 0.1, wpo, 0.2, 0.12);
    for (const sx of [1, -1]) { const a = [0, yR2, zp], b = [0, yR2, zp + d + 0.3], c = [sx * (wpo / 2 + 0.25), yE2, zp + d + 0.3], dd = [sx * (wpo / 2 + 0.25), yE2, zp];
      if (sx > 0) J.quad('portico', a, b, c, dd); else J.quad('portico', dd, c, b, a); }
    J.tri('blanco', [-(wpo / 2), yE2, zp + d + 0.28], [wpo / 2, yE2, zp + d + 0.28], [0, yR2 - 0.05, zp + d + 0.28]);
  }
  // --- N0-EMB: lucarnas en fila en el faldón del frente (vivienda obrera 035)
  if (op.lucarnas && techo === 'dos') {
    const n = Math.max(1, Math.floor((Lw - 2) / 3.6)), zl = Ww * 0.2, yl = yR - p1 * zl, wl = 1.5, hl = 1.0;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * ((Lw - 2.4) / Math.max(1, n - 1 || 1)) * (n > 1 ? 1 : 0);
      J.caja(kMuro, x, yl + hl / 2 - 0.1, zl - 0.5, wl, hl + 0.4, 1.4);
      J.caja('blanco', x, yl + hl / 2, zl + 0.21, wl - 0.3, hl - 0.25, 0.04); J.caja('fierro', x, yl + hl / 2, zl + 0.23, wl - 0.5, hl - 0.45, 0.02);
      J.caja('blanco', x, yl + hl / 2, zl + 0.24, 0.05, hl - 0.45, 0.03);
      for (const sx of [-1, 1]) J.caja(kZinc, x + sx * (wl / 4 + 0.08), yl + hl + 0.25 - 0.1, zl - 0.45, wl / 2 + 0.36, 0.06, 1.6, 0, 0, -sx * 0.62);
    }
  }
  // --- N0-EMB: corredores en el testero (galería de pisos con postes y barandas, vivienda obrera 035); cuelgan 1,2 m fuera de la caja
  if (op.corredorTestero) {
    const sx = op.corredorTestero === 'este' ? 1 : -1, prof = 1.2, xd = sx * (Lw / 2 + prof / 2), an = Math.min(Ww * 0.75, 7);
    for (let p = 1; p <= pisos; p++) {
      const y = p < pisos ? yPiso(p) : yM - 0.05;
      J.caja('blanco', xd, y, 0, prof, 0.16, an);
      if (p < pisos) { J.caja('blanco', xd + sx * (prof / 2 - 0.04), y + 1.0, 0, 0.08, 0.08, an); J.caja('blanco', xd + sx * (prof / 2 - 0.04), y + 0.45, 0, 0.05, 0.6, an); for (const s2 of [-1, 1]) J.caja('blanco', xd, y + 0.55, s2 * an / 2, prof, 0.9, 0.05); }
    }
    for (const s2 of [-1, 1]) J.caja('blanco', xd + sx * (prof / 2 - 0.08), (zoc + yM) / 2, s2 * (an / 2 - 0.08), 0.16, yM - zoc, 0.16);
  }
  // --- balcones de madera (frente) y escalera de incendio (costado)
  for (const v of ventanas) if (v.balcon) {
    const [x, , z] = v.c.f(v.u, 0, 0), yb = v.v - v.h / 2 - 0.08, prof = Math.min(0.9, alero + 0.4), wb = Math.min(2.0, vano * 0.9);
    J.caja('blanco', x, yb, z + prof / 2, wb, 0.1, prof);
    for (const s of [-1, 1]) J.caja('blanco', x + s * wb * 0.35, yb - 0.25, z + prof * 0.4, 0.08, 0.4, prof * 0.7, 0, 0.6);   // ménsulas
    J.caja('blanco', x, yb + 0.95, z + prof - 0.03, wb, 0.06, 0.08);
    for (const s of [-1, 1]) J.caja('blanco', x + s * (wb / 2 - 0.03), yb + 0.95, z + prof / 2, 0.06, 0.06, prof);
    const nbal = Math.round(wb / 0.14);
    for (let k = 0; k <= nbal; k++) J.caja('blancoFino', x - wb / 2 + k * wb / nbal, yb + 0.5, z + prof - 0.03, 0.035, 0.9, 0.035);   // R-3: «Fino» = se oculta lejos
  }
  if (op.escaleraIncendio) {
    const c = caras.find(q => q.id === op.escaleraIncendio), sx = c.id === 'este' ? 1 : -1;
    const prof = 1.1, xd = sx * (Lw / 2 + prof / 2 + 0.02), anchoE = Math.min(Ww * 0.7, 6);
    const xs = xd;   // la escalera cuelga fuera de la caja (1,1 m en ese costado), como en las fotos
    for (let p = 1; p < pisos; p++) {
      const y = yPiso(p) + 0.05;
      J.caja('fierro', xs, y, 0, prof, 0.06, anchoE);                                   // descanso de reja
      J.caja('fierro', xs + sx * (prof / 2 - 0.02), y + 0.95, 0, 0.04, 0.04, anchoE);   // baranda
      for (let k = 0; k <= 8; k++) J.caja('fierroFino', xs + sx * (prof / 2 - 0.02), y + 0.48, -anchoE / 2 + k * anchoE / 8, 0.025, 0.95, 0.025);
      for (const s of [-1, 1]) J.caja('fierro', xs, y + 0.48, s * anchoE / 2, prof, 0.95, 0.03);
      // tramo de escalera al piso de abajo (en diagonal)
      const yb = p === 1 ? Math.max(zoc + 1.2, y - hp + 1.6) : yPiso(p - 1) + 0.05, dy = y - yb, len = Math.hypot(dy, anchoE * 0.8), a = Math.atan2(dy, anchoE * 0.8);
      const sgn = p % 2 ? 1 : -1;
      J.caja('fierro', xs, (y + yb) / 2, 0, prof * 0.7, 0.05, len, 0, sgn * a);
      const nt = Math.max(3, Math.round(dy / 0.22));
      for (let k = 1; k < nt; k++) J.caja('fierroFino', xs, yb + dy * k / nt + 0.04, sgn * (-anchoE * 0.4 + anchoE * 0.8 * k / nt), prof * 0.7, 0.03, 0.2);
    }
    for (const s of [-1, 1]) J.caja('fierro', xs + sx * (prof / 2 - 0.02), (zoc + yPiso(pisos - 1) + 1) / 2, s * anchoE / 2, 0.06, yPiso(pisos - 1) + 1 - zoc, 0.06);
  }

  // --- armar mallas (una por material) + ventanas instanciadas
  const g = new THREE.Group(); g.name = 'kit_sewell';
  const mats = { tablas: material('tablas', colTablas), zinc: material('zinc', colTecho), hormigon: material('hormigon'), blanco: material('blanco', op.colorMolduras ?? (v1905 ? 0x7a5f45 : undefined)),   /* 1905: molduras de madera café */
    fierro: material('fierro'), puerta: material('puerta', v1905 ? 0x4a3524 : undefined), ladrillo: material('ladrillo'), losa: material('losa', 0x5a5650),
    tablasViejas: material('tablasViejas', colTablas), zincViejo: material('zincViejo', colTecho), estuco: material('estuco', op.colorEstuco),
    piedra: material('piedra', op.colorPiedra ?? (kMuro === 'piedra' ? aclarar(colTablas, 0.45) : undefined)), piedraClara: material('piedra', 0xe6dccb),
    acanalada: material('acanalada', colTablas), zocalo: material('estuco', op.colorZocalo ?? 0x8fd6c4), portico: material('zinc', op.portico === true ? 0xb8302a : op.portico) };   // N0-EMB
  mats.blancoFino = mats.blanco; mats.fierroFino = mats.fierro;
  // R-3 (carril render): los barrotes de 2,5-3,5 cm quedan bajo 1/3 de píxel pasados ~70 m y chispean al moverse (ni el MSAA los
  // sostiene): van en su propio LOD y se ocultan desde op.lejosFino (70 m); la baranda y los largueros siguen
  const lodFino = new THREE.LOD(); lodFino.name = 'kit_finos'; const finos = new THREE.Group();
  lodFino.addLevel(finos, 0); lodFino.addLevel(new THREE.Object3D(), op.lejosFino ?? 70, 0.08);
  for (const k of Object.keys(J.p)) {
    const geo = J.geometria(k, k === 'zinc' || k === 'zincViejo' ? uvTecho(p1) : (/^(tablas|tablasViejas|hormigon|piedra|piedraClara|estuco|acanalada)$/.test(k) ? uvCaja : null));
    if (!geo) continue;
    const m = new THREE.Mesh(geo, mats[k]); m.name = 'kit_' + k; m.castShadow = k !== 'fierro' && k !== 'fierroFino'; m.receiveShadow = true;
    if (k.endsWith('Fino')) finos.add(m); else g.add(m);
  }
  // ventanas: un InstancedMesh por módulo (ventana / puerta de balcón) y por parte (marco blanco, vidrio)
  const tipos = {};
  for (const v of ventanas) (tipos[[v.w.toFixed(2), v.h.toFixed(2), v.puerta, grueso && v.v < yP ? 1 : 0].join('|')] ||= []).push(v);
  const lod = new THREE.LOD(); lod.name = 'kit_marcos';
  const marcos = new THREE.Group(), mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), uno = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  for (const lista of Object.values(tipos)) {
    const v0 = lista[0], hondo = grueso && v0.v < yP, mod = moduloVentana(v0.w, v0.h, op.panos ?? 2, v0.puerta, v1905, hondo ? grueso : 0);
    const im = new THREE.InstancedMesh(mod.marco, mats.blanco, lista.length), iv = new THREE.InstancedMesh(mod.vidrio, material('vidrio'), lista.length);
    const ij = mod.jamba && new THREE.InstancedMesh(mod.jamba, mats[kMuro], lista.length);   // N1-KIT: jambas del vano en piedra (muro grueso)
    if (ij) { ij.name = 'kit_jambas'; ij.receiveShadow = true; }
    im.name = 'kit_ventanas'; iv.name = 'kit_vidrios'; im.receiveShadow = true; iv.receiveShadow = true;
    lista.forEach((v, i) => {
      const [x, y, z] = v.c.f(v.u, v.v, 0);
      mat4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(eje, v.c.rot), uno);
      im.setMatrixAt(i, mat4); iv.setMatrixAt(i, mat4); if (ij) ij.setMatrixAt(i, mat4);
      // vidrio: casi todos oscuros con reflejo; algunos con cortina clara o visillo (vida en la fachada, sin texturas)
      const t = r();
      col.setHex(t < 0.07 ? 0xd8d2c0 : t < 0.17 ? 0x7d8f98 : t < 0.5 ? 0x34414c : 0x2a343e); iv.setColorAt(i, col);
    });
    im.computeBoundingSphere(); iv.computeBoundingSphere();
    marcos.add(im); g.add(iv); if (ij) { ij.computeBoundingSphere(); g.add(ij); }
  }
  lod.addLevel(marcos, 0); lod.addLevel(new THREE.Object3D(), op.lejos ?? 220, 0.08);
  g.add(lod);
  if (finos.children.length) g.add(lodFino);
  if (op.placa && techo === 'dos') {   // N0-EMB: placa «EDIF 035-P» en el hastial del testero (oeste si el corredor va al este)
    const sx = op.corredorTestero === 'este' ? -1 : 1, t = texCartel('placa' + op.placa, c => { c.fillStyle = '#1d2026'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#eee'; c.lineWidth = 5; c.strokeRect(6, 30, 244, 68); c.fillStyle = '#f3f1ea'; c.font = 'bold 42px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(op.placa, 128, 66); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, alphaTest: 0.5 }));
    m.position.set(sx * (Lw / 2 + 0.04), yM - 0.9, 0); m.rotation.y = sx * Math.PI / 2; g.add(m);
  }
  g.userData.kit = { pisos, altoPiso: hp, ventanas: ventanas.length, muro: yM, cumbrera: yR, alero: yE,
    // N0-INT (carril interiores): gancho para los interiores procedurales: zócalo (piso 1), muros, puerta dibujada y vanos [cara, u, v, w, h]
    zoc, Lw, Ww, zF, puerta: !!(op.puerta && !op.porche), porche: !!op.porche, peldanos: peldanosKit, alcance: peldanosKit.reduce((m, q) => Math.max(m, q[2] + q[4] / 2 - zF), 0), vanos: ventanas.map(v => [v.c.id, +v.u.toFixed(2), +v.v.toFixed(2), +v.w.toFixed(2), +v.h.toFixed(2)]) };
  return g;
}


// ---- N2-C33 (carril kit, 14-11-2026): Teatro de Sewell, edificio 165 (Braden Copper, plano M-1342 de 1937 + foto de la fachada,
// assets3d/referencias/sewell/planos/). En la caja del lote (largo × alto × ancho, frente +Z = lado de la puerta del juego):
// cuerpo bajo de acceso al frente (portón ancho oscuro donde construir.js pone el cortavientos y la puerta de la sala, marquesina
// con las letras CINE del juego, ventanas altas estrechas, cartelera «HOY»), detrás la nave de la sala con bóveda de zinc gris
// y frontón estucado claro con el «165» y la celosía de ventilación, dos ventiladores cilíndricos con sombrerete en la cumbrera,
// ventanas altas estrechas en fila en los costados y la torre de 3 pisos a dos aguas en el extremo de atrás (escenario).
const texTexto = {};
function texCartel(clave, dibujar) {
  if (texTexto[clave]) return texTexto[clave];
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; dibujar(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (texTexto[clave] = t);
}
function cine165(op) {
  const L = op.largo, W = op.ancho, H = op.alto, J = new Junta(), r = azar(op.semilla ?? 165);
  const zoc = op.zocalo ?? 0.6, colEst = op.colorEstuco ?? 0xeedb9f;   // N0-EMB: crema amarillento de la foto actual
  const wN = L - 0.8, dB = Math.min(4.2, W * 0.3), hB = Math.min(7.0, H * 0.4), wB = Math.min(L * 0.66, 13.5);
  const zF = W / 2 - dB, zA = -W / 2 + 0.2, zB = W / 2 - 0.05;            // frente de la nave, fondo, frente del cuerpo de acceso
  const yA = H - 3, flecha = Math.min(5.4, wN * 0.28), yW = yA - flecha;     // clave de la bóveda (a ras de la colisión) y arranque
  const ventanas = [];   // { f, rot, u, v, w, h }
  const cara = (id, f, rot, u0, u1, v0, v1, vanos, clave = 'estuco') => { muroConVanos(J, clave, (u, v) => f(u, v), u0, u1, v0, v1, vanos.map(o => ({ u0: o.u - o.w / 2, u1: o.u + o.w / 2, v0: o.v - o.h / 2, v1: o.v + o.h / 2 }))); for (const o of vanos) if (!o.hueco) ventanas.push({ f, rot, ...o }); };
  // --- torre de 3 pisos a dos aguas (atrás a la izquierda): 6 × 5,2 m, cumbrera a lo largo de X
  const tL = Math.min(6.4, wN * 0.33), tW = Math.min(5.2, W * 0.36), tx0 = -wN / 2, tx1 = tx0 + tL, tz0 = zA, tz1 = zA + tW;
  const yTc = H - 0.1, pT = 0.85, yTe = yTc - pT * (tW / 2 + 0.3), yTm = yTe + pT * 0.3 - 0.1;
  // --- nave: costados con ventanas altas estrechas en fila; fondo; frente bajo el frontón
  const filaV = (largo, excl = () => false) => { const n = Math.max(1, Math.floor((largo - 2) / 2.6)), o = []; for (let i = 0; i < n; i++) { const u = (i - (n - 1) / 2) * 2.6; if (!excl(u)) o.push({ u, v: zoc + 4.4, w: 0.8, h: 3.2 }); } return o; };
  const zcN = (zF + zA) / 2, lN = zF - zA;
  cara('este', (u, v) => [wN / 2, v, zcN - u], Math.PI / 2, -lN / 2, lN / 2, zoc, yW, filaV(lN));
  // oeste: la torre ocupa el tramo de atrás (u > lN/2 - tW) y sube hasta su alero
  cara('oeste', (u, v) => [-wN / 2, v, zcN + u], -Math.PI / 2, -lN / 2, lN / 2 - tW, zoc, yW, filaV(lN, u => u > lN / 2 - tW - 1.2));
  cara('oesteT', (u, v) => [-wN / 2, v, zcN + u], -Math.PI / 2, lN / 2 - tW, lN / 2, zoc, yTm, [0.8, 4.0, 7.2, 10.4].slice(0, 4).map(y => ({ u: lN / 2 - tW / 2, v: zoc + 2 + y, w: 0.9, h: 1.5 })).filter(o => o.v < yTm - 1));
  cara('fondo', (u, v) => [-u, v, zA], Math.PI, -wN / 2, wN / 2 - tL, zoc, yW, [{ u: wN / 2 - tL - 3, v: zoc + 1.3, w: 1.6, h: 2.4, hueco: false }]);   // portón de escena atrás
  cara('fondoT', (u, v) => [-u, v, zA], Math.PI, wN / 2 - tL, wN / 2, zoc, yTm, [2, 5.2, 8.4, 11.6].map(y => [-1.6, 0, 1.6].map(du => ({ u: wN / 2 - tL / 2 + du, v: zoc + 1.6 + y, w: 0.85, h: 1.45 }))).flat().filter(o => o.v < yTm - 1));
  // caras interiores de la torre (solo se ven sobre la bóveda)
  cara('torreE', (u, v) => [tx1, v, (tz0 + tz1) / 2 - u], Math.PI / 2, -tW / 2, tW / 2, yW - 0.5, yTm, [{ u: 0, v: yTm - 1.6, w: 0.85, h: 1.4 }]);
  cara('torreN', (u, v) => [u, v, tz1], 0, tx0, tx1, yW - 0.5, yTm, [-1.6, 0, 1.6].map(du => ({ u: (tx0 + tx1) / 2 + du, v: yTm - 1.6, w: 0.85, h: 1.4 })));
  // frente de la nave (a los lados del cuerpo de acceso y sobre él, hasta el arranque de la bóveda)
  cara('frenteN', (u, v) => [u, v, zF], 0, -wN / 2, wN / 2, zoc, yW, [{ u: -wN / 2 + (wN / 2 - wB / 2) / 2, v: zoc + 4.4, w: 0.8, h: 3.2 }, { u: wN / 2 - (wN / 2 - wB / 2) / 2, v: zoc + 4.4, w: 0.8, h: 3.2 },
    ...[-2.2, 0, 2.2].map(u => ({ u, v: hB + 1.3, w: 0.7, h: 1.0 }))].filter(o => Math.abs(o.u) > wB / 2 + 0.5 || o.v > hB + 0.6));
  // --- bóveda de zinc (parábola) entre el frontón y el fondo, con vuelo de 0,35 m a los costados
  const n = 14, P = [];
  for (let i = 0; i <= n; i++) { const t = i / n * 2 - 1, x = t * (wN / 2 + 0.35); P.push([x, yW + flecha * (1 - t * t) - (Math.abs(t) > 0.97 ? 0.1 : 0)]); }
  const zb0 = zA - 0.3, zb1 = zF + 0.1;
  for (let i = 0; i < n; i++) { const [x0, y0] = P[i], [x1, y1] = P[i + 1]; J.quad('boveda', [x0, y0, zb1], [x1, y1, zb1], [x1, y1, zb0], [x0, y0, zb0]); }
  for (const s of [-1, 1]) J.caja('blanco', s * (wN / 2 + 0.3), yW - 0.1, (zb0 + zb1) / 2, 0.08, 0.24, zb1 - zb0);   // tapacán del vuelo
  // tímpano de atrás (bajo la bóveda) y del frente (tapado por el frontón)
  { const c = wN / 2 / (wN / 2 + 0.35), f = (x, y) => [x, y, zA];   // tímpano de atrás en franjas verticales, como la cara 'fondo' (u = −x)
    for (let i = 0; i < n; i++) { const [x0, y0] = P[i], [x1, y1] = P[i + 1]; J.quad('estuco', f(x1 * c, yW), f(x0 * c, yW), f(x0 * c, y0), f(x1 * c, y1)); } }
  // --- frontón estucado: triángulo más alto que la bóveda, con remate, la placa «165» y la celosía
  const fA = yA + 1.1, fx = wN / 2 + 0.25;
  J.tri('estuco', [0, yW, zF + 0.04], [fx, yW, zF + 0.04], [0, fA, zF + 0.04]); J.tri('estuco', [0, yW, zF + 0.04], [0, fA, zF + 0.04], [-fx, yW, zF + 0.04]);
  J.tri('estuco', [0, yW, zF - 0.3], [0, fA, zF - 0.3], [fx, yW, zF - 0.3]); J.tri('estuco', [0, yW, zF - 0.3], [-fx, yW, zF - 0.3], [0, fA, zF - 0.3]);
  const angF = Math.atan2(fA - yW, fx), lenF = Math.hypot(fA - yW, fx);
  for (const s of [-1, 1]) J.caja('azul', s * fx / 2, (yW + fA) / 2 + 0.12, zF - 0.13, lenF + 0.3, 0.2, 0.5, 0, 0, -s * angF);   // remate (N0-EMB: azul, como hoy)
  J.caja('azul', 0, yW - 0.05, zF + 0.02, wN + 0.5, 0.2, 0.12);   // cornisa bajo el frontón (azul)
  const yCel = yW + (fA - yW) * 0.5;   // celosía de ventilación (marco y persianas)
  J.caja('blanco', 0, yCel, zF + 0.06, 2.2, 1.5, 0.1); J.caja('fierro', 0, yCel, zF + 0.09, 1.9, 1.2, 0.02);
  for (let k = 0; k < 7; k++) J.caja('blanco', 0, yCel - 0.52 + k * 0.17, zF + 0.14, 1.9, 0.05, 0.1, 0, 0.6);
  // --- ventiladores cilíndricos con sombrerete en la clave de la bóveda
  for (const zv of [zF - 2.2, zF - 2.2 - lN * 0.42]) {
    J.add('chapa', new THREE.CylinderGeometry(0.42, 0.46, 1.7, 14).translate(0, yA + 0.75, zv));
    J.add('chapa', new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14).translate(0, yA + 1.62, zv));
    J.add('chapa', new THREE.ConeGeometry(0.72, 0.42, 14).translate(0, yA + 2.0, zv));
    J.add('fierro', new THREE.CylinderGeometry(0.4, 0.4, 0.22, 14, 1, true).translate(0, yA + 1.75, zv));
  }
  // --- torre: techo a dos aguas (cumbrera en X), hastiales estucados, alero
  for (const sz of [-1, 1]) {
    const zc = (tz0 + tz1) / 2, ze = zc + sz * (tW / 2 + 0.3), a = [tx0 - 0.3, yTc, zc], b = [tx1 + 0.3, yTc, zc], c = [tx1 + 0.3, yTe, ze], d = [tx0 - 0.3, yTe, ze];
    if (sz > 0) J.quad('zinc', d, c, b, a); else J.quad('zinc', a, b, c, d);
    J.caja('blanco', (tx0 + tx1) / 2, yTe - 0.1, ze - sz * 0.03, tL + 0.6, 0.22, 0.06);
  }
  for (const [xg, sx] of [[tx0, -1], [tx1, 1]]) {
    const zc = (tz0 + tz1) / 2;
    if (sx > 0) J.tri('estuco', [xg, yTm, tz1], [xg, yTm, tz0], [xg, yTc - 0.14, zc]); else J.tri('estuco', [xg, yTm, tz0], [xg, yTm, tz1], [xg, yTc - 0.14, zc]);
  }
  J.caja('fierro', (tx0 + tx1) / 2, yTc + 0.05, (tz0 + tz1) / 2, tL + 0.62, 0.08, 0.3);
  J.caja('blanco', (tx0 + tx1) / 2, yTm - 0.2, (tz0 + tz1) / 2, tL + 0.08, 0.4, tW + 0.08);   // friso de la torre
  // --- cuerpo bajo de acceso: estucado, losa con pretil, portón oscuro (el cortavientos y la puerta del juego van al centro)
  const zcB = (zF + zB) / 2;
  const vB = [-1, 1].flatMap(s => [s * (wB / 2 - 1.1), s * (wB / 2 - 2.1)].map(u => ({ u, v: zoc + 2.6, w: 0.5, h: 2.6 })));
  cara('frenteB', (u, v) => [u, v, zB], 0, -wB / 2, wB / 2, zoc, hB, [...vB, { u: 0, v: zoc + 1.9, w: 5.2, h: 3.8, hueco: true }]);
  cara('esteB', (u, v) => [wB / 2, v, zcB - u], Math.PI / 2, -dB / 2, dB / 2, zoc, hB, [{ u: 0, v: zoc + 2.6, w: 0.5, h: 2.6 }]);
  cara('oesteB', (u, v) => [-wB / 2, v, zcB + u], -Math.PI / 2, -dB / 2, dB / 2, zoc, hB, [{ u: 0, v: zoc + 2.6, w: 0.5, h: 2.6 }]);
  J.caja('madera', 0, zoc + 1.9, zB - 0.5, 5.2, 3.8, 0.06);   // portón de tablas café en el fondo del vano (N0-EMB, foto actual)
  for (const u of [-1.73, 0, 1.73]) { J.caja('fierro', u, zoc + 1.9, zB - 0.46, 0.06, 3.8, 0.03); }
  for (const u of [-0.87, 0.87, -2.2, 2.2]) for (const yy of [1.1, 2.8]) J.caja('madera', u * (Math.abs(u) > 2 ? 0.8 : 1), zoc + yy, zB - 0.44, 1.2, 1.2, 0.04);
  J.caja('azul', 0, hB - 0.95, zB + 0.03, wB + 0.02, 0.14, 0.05);   // franja azul del cuerpo de acceso
  for (const s of [-1, 1]) J.quadR('estuco', ...(s < 0 ? [[-2.6, zoc, zB - 0.5], [-2.6, zoc, zB], [-2.6, zoc + 3.8, zB], [-2.6, zoc + 3.8, zB - 0.5]] : [[2.6, zoc, zB], [2.6, zoc, zB - 0.5], [2.6, zoc + 3.8, zB - 0.5], [2.6, zoc + 3.8, zB]]));
  J.quadR('estuco', [-2.6, zoc + 3.8, zB], [2.6, zoc + 3.8, zB], [2.6, zoc + 3.8, zB - 0.5], [-2.6, zoc + 3.8, zB - 0.5]);
  J.caja('losa', 0, hB - 0.1, zcB, wB - 0.1, 0.2, dB - 0.1);
  for (const [x, z, sx, sz] of [[0, zB - 0.1, wB, 0.2], [wB / 2 - 0.1, zcB, 0.2, dB], [-wB / 2 + 0.1, zcB, 0.2, dB]]) { J.caja('estuco', x, hB + 0.35, z, sx, 0.7, sz); J.caja('blanco', x, hB + 0.74, z, sx + 0.1, 0.08, sz + 0.1); }
  // marquesina sobre el portón (las letras CINE de construir.js van en su frente, a 5,75 m sobre la puerta)
  if (op.marquesina) {
    const mq = op.marquesina, wq = mq.ancho ?? 6.4, y = mq.y ?? 4.9, hq = mq.alto ?? 1.6, z1 = W / 2 + (mq.sale ?? 0.55);
    J.caja('blanco', 0, y + hq / 2, z1 - 0.12, wq, hq, 0.24); J.caja('blanco', 0, y + 0.06, (zB + z1) / 2, wq, 0.12, z1 - zB);
    for (const s of [-1, 1]) J.caja('blanco', s * (wq / 2 - 0.06), y + hq / 2, (zB + z1) / 2, 0.12, hq, z1 - zB);
    for (const yy of [y + 0.2, y + hq - 0.2]) J.caja('fierro', 0, yy, z1 + 0.01, wq + 0.02, 0.05, 0.04);
  }
  // zócalo de hormigón bajo nave y cuerpo, y barandas de tubo a los lados de la entrada
  J.caja('hormigon', 0, zoc / 2, (zA + zF) / 2, wN + 0.12, zoc, lN + 0.12); J.caja('hormigon', 0, zoc / 2, zcB, wB + 0.12, zoc, dB + 0.1);
  for (const s of [-1, 1]) {
    J.add('fierro', new THREE.CylinderGeometry(0.03, 0.03, 3.0, 6).rotateZ(Math.PI / 2).translate(s * 4.2, zoc + 1.0, zB + 1.2));
    for (const dx of [-1.4, 0, 1.4]) J.add('fierro', new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6).translate(s * 4.2 + dx, zoc + 0.5, zB + 1.2));
  }
  // cartelera «HOY» a la izquierda del portón (dos postes y tablero)
  const xc = -wB / 2 + 0.2, zc = zB + 0.35;
  for (const s of [-1, 1]) J.caja('fierro', xc + s * 0.75, 1.3, zc, 0.07, 2.6, 0.07);
  J.caja('blanco', xc, 2.15, zc, 1.75, 1.35, 0.06);

  // --- armar
  const g = new THREE.Group(); g.name = 'kit_sewell';
  const mats = { estuco: material('estuco', colEst), boveda: material('zinc', op.colorTecho ?? 0x9b9c9a), zinc: material('zinc', op.colorTecho ?? 0x9b9c9a), blanco: material('blanco', 0xf2efe6),
    fierro: material('fierro'), chapa: material('fierro', 0xa5a8aa), hormigon: material('hormigon'), losa: material('losa', 0x5a5650), azul: material('blanco', 0x2f5597), madera: material('puerta', 0x6e4a2a) };
  const uvB = geo => { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) / 2, p.getX(i) / 2); uv.needsUpdate = true; };
  for (const k of Object.keys(J.p)) {
    const geo = J.geometria(k, k === 'boveda' ? uvB : k === 'zinc' ? uvTecho(pT) : (k === 'estuco' || k === 'hormigon' ? uvCaja : null));
    if (!geo) continue;
    const m = new THREE.Mesh(geo, mats[k]); m.name = 'kit_' + k; m.castShadow = k !== 'fierro'; m.receiveShadow = true; g.add(m);
  }
  // placa «165» bajo la celosía y tablero «HOY»
  const t165 = texCartel('165', c => { c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#222'; c.lineWidth = 8; c.strokeRect(6, 6, 244, 116); c.fillStyle = '#1b1b1b'; c.font = 'bold 92px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('165', 128, 70); });
  const p165 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshStandardMaterial({ map: t165, roughness: 0.7 })); p165.position.set(0, yCel - 1.35, zF + 0.1); g.add(p165);
  const tHoy = texCartel('hoy', c => { c.fillStyle = '#f2ead6'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#7a1c18'; c.fillRect(10, 10, 110, 108); c.fillStyle = '#f2ead6'; c.font = 'bold 22px Georgia, serif'; c.textAlign = 'center'; c.fillText('FUNCIÓN', 65, 50); c.fillText('20:30', 65, 84); c.fillStyle = '#1b1b1b'; c.font = 'bold 64px Georgia, serif'; c.fillText('HOY', 190, 86); });
  const pHoy = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.25), new THREE.MeshStandardMaterial({ map: tHoy, roughness: 0.75 })); pHoy.position.set(xc, 2.15, zc + 0.035); g.add(pHoy);
  // ventanas (guillotina de 6 paños, marco blanco) instanciadas por tamaño
  const tipos = {};
  for (const v of ventanas) (tipos[v.w.toFixed(2) + '|' + v.h.toFixed(2)] ||= []).push(v);
  const lod = new THREE.LOD(); lod.name = 'kit_marcos'; const marcos = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), uno = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  for (const lista of Object.values(tipos)) {
    const mod = moduloVentana(lista[0].w, lista[0].h, 6, false);
    const im = new THREE.InstancedMesh(mod.marco, mats.blanco, lista.length), iv = new THREE.InstancedMesh(mod.vidrio, material('vidrio'), lista.length);
    im.name = 'kit_ventanas'; iv.name = 'kit_vidrios';
    lista.forEach((v, i) => { m4.compose(new THREE.Vector3(...v.f(v.u, v.v)), q.setFromAxisAngle(eje, v.rot), uno); im.setMatrixAt(i, m4); iv.setMatrixAt(i, m4); const t = r(); col.setHex(t < 0.1 ? 0x7d8f98 : t < 0.5 ? 0x34414c : 0x2a343e); iv.setColorAt(i, col); });
    im.computeBoundingSphere(); iv.computeBoundingSphere(); marcos.add(im); g.add(iv);
  }
  lod.addLevel(marcos, 0); lod.addLevel(new THREE.Object3D(), op.lejos ?? 220, 0.08); g.add(lod);
  g.userData.kit = { forma: 'cine165', ventanas: ventanas.length, boveda: yA, torre: yTc };
  return g;
}


// ---- N2-C37 (carril kit, 14-11-2026): TORRE DE BALCONES del N2 (reemplaza la malla TRELLIS torre_balcones).
// Coordenadas relativas al pie (e.x, y0, e.z) y con los ejes del mundo (balcones al poniente, -X): calza con los colisionadores de torreMalla()
// (construir.js): cuerpo x -3,65…3,7 · z ±4,6; balcones x -5,1…-3,65 · z ±4,5 con el piso a `pisos`; alero ±4,1 × ±5,1 a 16,7; cumbrera a 20,05.
// op: { pisos:[...], yBase (negativa, fondo del zócalo), color, colorTecho, semilla, lados:[+1,-1,...] (lado del portillo de cada balcón) }
const TB6 = { x0: -3.65, x1: 3.7, z: 4.6, bx0: -5.1, bz: 4.5, ax: 4.1, az: 5.1, alero: 16.7, punta: 20.05, zoc: 1.0, yW: 16.97, gate: 3.2 };
export function torreKit(op) {
  const T = TB6, P = op.pisos, J = new Junta(), r = azar(op.semilla ?? 37);
  const Lw = T.x1 - T.x0, Ww = 2 * T.z, xc = (T.x0 + T.x1) / 2, yB = op.yBase ?? -3, ridge = T.az - T.ax;
  const colTablas = op.color ?? 0x8c5a3a, colTecho = op.colorTecho ?? 0xa8432f;
  const vara = (clave, a, b, g, g2 = g) => {   // listón de sección g×g2 entre dos puntos
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(), geo = new THREE.BoxGeometry(g, g2, L);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()));
    geo.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); J.add(clave, geo);
  };
  // --- caras (mismo convenio que edificioKit): u de izquierda a derecha visto de afuera, d hacia afuera
  const caras = [
    { id: 'frente', largo: Lw, f: (u, v, d = 0) => [xc + u, v, T.z + d], rot: 0 },
    { id: 'fondo', largo: Lw, f: (u, v, d = 0) => [xc - u, v, -T.z - d], rot: Math.PI },
    { id: 'este', largo: Ww, f: (u, v, d = 0) => [T.x1 + d, v, -u], rot: Math.PI / 2 },
    { id: 'oeste', largo: Ww, f: (u, v, d = 0) => [T.x0 - d, v, u], rot: -Math.PI / 2 },
  ];
  const ventanas = [], hv = 1.45, wv = 1.05;
  for (const c of caras) {
    c.vanos = [];
    const us = c.id === 'oeste' ? [-2.5, 0, 2.5] : c.id === 'este' ? [-2.8, 0, 2.8] : [-2.1, 0, 2.1];
    const pon = (u, v, w, h, puerta) => { ventanas.push({ c, u, v, w, h, puerta }); c.vanos.push({ u0: u - w / 2, u1: u + w / 2, v0: v - h / 2, v1: v + h / 2 }); };
    if (c.id !== 'oeste') for (const u of us) pon(u, 1.65, wv, 0.75, false);   // planta baja: ventanas bajas sobre el zócalo (al poniente va el faldón del balcón)
    P.forEach(f => us.forEach(u => { if (c.id === 'oeste' && u === 0) pon(0, f + 0.08 + 1.05, 1.1, 2.1, true); else pon(u, f + 0.65 + hv / 2, wv, hv, false); }));
  }
  // --- zócalo de hormigón (de la base del terreno al pie del primer piso), cuerpo de tablas con vanos
  const zx0 = T.bx0 - 0.15, zx1 = T.x1 + 0.15, zzz = T.z + 0.15;
  J.caja('hormigon', (zx0 + zx1) / 2, (yB + T.zoc) / 2, 0, zx1 - zx0, T.zoc - yB, 2 * zzz);
  J.caja('blanco', (zx0 + zx1) / 2, T.zoc + 0.04, 0, zx1 - zx0 + 0.1, 0.08, 2 * zzz + 0.1);   // botaguas
  for (const c of caras) muroConVanos(J, 'tablas', (u, v) => c.f(u, v), -c.largo / 2, c.largo / 2, T.zoc, T.yW, c.vanos);
  // faldón de tablas bajo el primer balcón (cierra el hueco hasta el zócalo)
  const bw = T.x0 - T.bx0, bl = 2 * T.bz, bxm = (T.bx0 + T.x0) / 2;
  J.caja('tablas', bxm, (T.zoc + P[0] - 0.34) / 2, 0, bw, P[0] - 0.34 - T.zoc, bl);
  // molduras: esquineros, cintas de cada piso, friso bajo el alero
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) J.caja('blanco', xc + sx * (Lw / 2 + 0.02), (T.zoc + T.yW) / 2, sz * (T.z + 0.02), 0.2, T.yW - T.zoc, 0.2);
  P.forEach(f => J.caja('blanco', xc, f - 0.17, 0, Lw + 0.14, 0.14, Ww + 0.14));
  J.caja('blanco', xc, (T.alero - 0.2 + T.yW) / 2, 0, Lw + 0.16, T.yW - T.alero + 0.2, Ww + 0.16);   // friso
  J.caja('blanco', xc, T.alero - 0.22, 0, Lw + 0.3, 0.1, Ww + 0.3);                                       // cornisa
  // --- balcones de madera: losa, frente de tabla blanca, ménsulas, balaustrada con portillo hacia la escalera de incendio
  P.forEach((f, i) => {
    const s = op.lados ? op.lados[i] : (i % 2 === 0 ? 1 : -1), za = s < 0 ? -T.gate + 0.1 : -T.bz, zb = s < 0 ? T.bz : T.gate - 0.1, xo = T.bx0 + 0.04;
    J.caja('tablas', bxm, f - 0.2, 0, bw, 0.2, bl);                                      // piso de tablas
    J.caja('blanco', T.bx0 - 0.02, f - 0.19, 0, 0.06, 0.34, bl + 0.1);                   // frente
    for (const sz of [-1, 1]) J.caja('blanco', bxm, f - 0.19, sz * (T.bz + 0.02), bw, 0.34, 0.06);
    for (const z of [-3.3, -1.1, 1.1, 3.3]) vara('blanco', [T.x0, f - 1.0, z], [T.bx0 + 0.18, f - 0.34, z], 0.1, 0.08);   // ménsulas
    const alt = 0.9, base = 0.12;
    const rail = (xa, za2, xb, zb2) => {   // pasamanos, travesaño bajo, balaustres
      const L = Math.hypot(xb - xa, zb2 - za2), n = Math.max(2, Math.round(L / 0.14)), yaw = Math.atan2(xb - xa, zb2 - za2);
      J.caja('blanco', (xa + xb) / 2, f + alt, (za2 + zb2) / 2, 0.1, 0.06, L, yaw); J.caja('blanco', (xa + xb) / 2, f + base, (za2 + zb2) / 2, 0.07, 0.06, L, yaw);
      for (let k = 0; k <= n; k++) { const t = k / n; J.caja('blancoFino', xa + (xb - xa) * t, f + (alt + base) / 2, za2 + (zb2 - za2) * t, 0.035, alt - base, 0.035); }
    };
    const post = (x, z) => { J.caja('blanco', x, f + 0.52, z, 0.11, 1.04, 0.11); J.caja('blanco', x, f + 1.07, z, 0.15, 0.06, 0.15); };
    rail(xo, za, xo, zb);                                                                  // exterior (sin el portillo)
    for (const sz of [-1, 1]) rail(T.bx0 + 0.06, sz * (T.bz - 0.06), T.x0, sz * (T.bz - 0.06));   // extremos
    post(xo, s < 0 ? za : zb); if (s < 0) post(xo, zb - 0.06); else post(xo, za + 0.06);
    post(xo, (za + zb) / 2); post(T.x0 - 0.06, T.bz - 0.06); post(T.x0 - 0.06, -T.bz + 0.06);
  });
  // --- techo de zinc a cuatro aguas con alero (cumbrera a lo largo de Z); UV propio: v = distancia por la pendiente
  const ya = T.alero, yp = T.punta, E = T.ax, Z5 = T.az, k = Math.hypot(E, yp - ya), nz = (yp - ya) / k, nx = E / k;
  const cara = (pts, U, V) => {
    const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[1]), c = new THREE.Vector3(...pts[2]);
    const arr = b.clone().sub(a).cross(c.clone().sub(a)).y < 0 ? pts.slice().reverse() : pts, pos = [], uv = [];
    const o = new THREE.Vector3(...arr[0]), Uv = new THREE.Vector3(...U), Vv = new THREE.Vector3(...V);
    for (let i = 1; i < arr.length - 1; i++) for (const q of [arr[0], arr[i], arr[i + 1]]) { const w = new THREE.Vector3(...q); pos.push(...q); uv.push(w.clone().sub(o).dot(Uv) / 2, w.clone().sub(o).dot(Vv) / 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); J.add('zinc', g);
  };
  const A = [-E, ya, -Z5], B = [E, ya, -Z5], C = [E, ya, Z5], D = [-E, ya, Z5], R1 = [0, yp, -ridge], R2 = [0, yp, ridge];
  cara([A, D, R2, R1], [0, 0, 1], [nx, nz, 0]); cara([C, B, R1, R2], [0, 0, -1], [-nx, nz, 0]);
  cara([D, C, R2], [1, 0, 0], [0, nz, -nx]); cara([B, A, R1], [-1, 0, 0], [0, nz, nx]);
  const up = p => [p[0], p[1] + 0.05, p[2]];
  for (const [a, b] of [[A, R1], [B, R1], [C, R2], [D, R2], [R1, R2]]) vara('fierro', up(a), up(b), 0.14, 0.1);   // cumbrera y limas
  J.quadR('blanco', [-E, ya - 0.25, -Z5], [-E, ya - 0.25, Z5], [E, ya - 0.25, Z5], [E, ya - 0.25, -Z5]);        // cielo del alero
  for (const [x, z, sx, sz] of [[0, -Z5, 2 * E, 0.06], [0, Z5, 2 * E, 0.06], [-E, 0, 0.06, 2 * Z5], [E, 0, 0.06, 2 * Z5]]) {
    J.caja('blanco', x, ya - 0.1, z, sx, 0.3, sz);                                                   // tapacán
    J.caja('fierro', x + (sx < 0.1 ? Math.sign(x) * 0.07 : 0), ya + 0.02, z + (sz < 0.1 ? Math.sign(z) * 0.07 : 0), sx < 0.1 ? 0.1 : sx, 0.1, sz < 0.1 ? 0.1 : sz);   // canaleta
  }
  // --- armar mallas por material + ventanas instanciadas
  const g = new THREE.Group(); g.name = 'kit_torre';
  const mats = { tablas: material('tablas', colTablas), zinc: material('zinc', colTecho), hormigon: material('hormigon'), blanco: material('blanco'), fierro: material('fierro') };
  mats.blancoFino = mats.blanco;
  const lodFino = new THREE.LOD(); lodFino.name = 'kit_finos'; const finos = new THREE.Group(); lodFino.addLevel(finos, 0); lodFino.addLevel(new THREE.Object3D(), op.lejosFino ?? 70, 0.08);
  for (const key of Object.keys(J.p)) {
    const geo = J.geometria(key, /^(tablas|hormigon)$/.test(key) ? uvCaja : null); if (!geo) continue;
    const m = new THREE.Mesh(geo, mats[key]); m.name = 'kit_' + key; m.castShadow = true; m.receiveShadow = true;
    if (key.endsWith('Fino')) finos.add(m); else g.add(m);
  }
  const tipos = {};
  for (const v of ventanas) (tipos[[v.w.toFixed(2), v.h.toFixed(2), v.puerta].join('|')] ||= []).push(v);
  const lod = new THREE.LOD(); lod.name = 'kit_marcos'; const marcos = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), uno = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  for (const lista of Object.values(tipos)) {
    const v0 = lista[0], mod = moduloVentana(v0.w, v0.h, 2, v0.puerta);
    const im = new THREE.InstancedMesh(mod.marco, mats.blanco, lista.length), iv = new THREE.InstancedMesh(mod.vidrio, material('vidrio'), lista.length);
    im.name = 'kit_ventanas'; iv.name = 'kit_vidrios'; im.receiveShadow = true; iv.receiveShadow = true;
    lista.forEach((v, i) => {
      const [x, y, z] = v.c.f(v.u, v.v, 0);
      m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(eje, v.c.rot), uno); im.setMatrixAt(i, m4); iv.setMatrixAt(i, m4);
      const t = r(); col.setHex(t < 0.08 ? 0xd8d2c0 : t < 0.18 ? 0x7d8f98 : t < 0.5 ? 0x34414c : 0x2a343e); iv.setColorAt(i, col);
    });
    im.computeBoundingSphere(); iv.computeBoundingSphere(); marcos.add(im); g.add(iv);
  }
  lod.addLevel(marcos, 0); lod.addLevel(new THREE.Object3D(), op.lejos ?? 220, 0.08); g.add(lod);
  if (finos.children.length) g.add(lodFino);
  g.userData.kit = { forma: 'torre6', ventanas: ventanas.length };
  return g;
}

// N0-EMB (carril kit, 14-11-2026): utilidades compartidas con los edificios emblemáticos (js/mundo/kitEmblemas.js)
export { Junta, material, muroConVanos, moduloVentana, uvCaja, uvTecho, azar, aclarar, modCache };
