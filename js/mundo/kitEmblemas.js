// N0-EMB (carril kit, 14-11-2026): edificios emblemáticos de Sewell hechos a mano con el kit, fieles a las fotos que aportó Diego
// (assets3d/referencias/sewell/emblematicos/). Misma convención que edificioKit: origen al centro de la planta a ras de la base,
// eje largo en X, fachada principal (la de la calle / puerta del juego) hacia +Z, todo dentro de la caja largo × alto × ancho.
//   club20     Edificio 20, Teniente Club: estucado crema, zócalo alto con rejas, ventanas pareadas abajo y de medio punto con
//              abanico arriba, pórtico de columnas con balcón y balaustrada calada, escalera lateral, banderas, cornisa y alero.
//   escuela129 Edificio 129, ex Escuela Industrial (hoy Museo de la Gran Minería del Cobre): 4 pisos ocre, esquina curva con el
//              letrero «ESCUELA INDUSTRIAL» arriba y (op.museo) «MUSEO DE LA GRAN MINERÍA DEL COBRE» abajo, acceso lateral con escalera.
//   iglesia231 Edificio 231, Iglesia: celeste con molduras blancas, techo rojo, campanario con celosía y cruz, ventanas de medio punto,
//              pórtico de acceso con arco, campana en su brazo de fierro y bancos de fierro forjado.
// Documentación: capturas/coordinacion/KIT_SEWELL.md («Emblemáticos»).
import * as THREE from 'three';
import { Junta, material, muroConVanos, moduloVentana, uvCaja, uvTecho, azar, modCache } from './kitSewell.js';
import { salaClub } from './kitClub.js';
import { salaHospital, adornosEpoca } from './kitHospital.js';   // N4-SALAS
import { salaEscuela, salaMuseo } from './kitEscuela.js';   // N2-ESCUELA (carril interiores)
import { Colocador, hayPieza, precargarUtileria, montarEnKit, texUtil } from './utileria.js';   // N0-UTIL: bancas de malla   // N0-EMB9: Teniente Club por dentro


// R-8: orden de «quién queda encima» entre piezas coplanares de materiales distintos (polygonOffset por rango; sirve a cualquier distancia). ?r8=0 lo apaga.
function ordenarCoplanares(mats, rangos) {
  if (/[?&]r8=0/.test(globalThis.location?.search || '')) return;
  for (const [k, n] of Object.entries(rangos)) { let m = mats[k]; if (m) { m = mats[k] = m.clone(); m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -n * 8; } }
}
export function emblemaKit(op) {
  if (op.forma === 'club20') return club20(op);
  if (op.forma === 'escuela129') return escuela129(op);
  if (op.forma === 'iglesia231') return iglesia231(op);
  return null;
}

// ---- textos en lienzo (letreros, placas EDIF, banderas)
const texCache = {};
function texLienzo(clave, w, h, dibujar) {
  if (texCache[clave]) return texCache[clave];
  const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (texCache[clave] = t);
}
// placa de número de edificio («EDIF-020»): fondo oscuro, letras blancas, como las de Sewell
function placa(g, texto, x, y, z, rotY = 0, ancho = 1.5, alto = 0.42, fondo = '#1d2026', tinta = '#f3f1ea') {
  const t = texLienzo('placa:' + texto + fondo, 512, 144, (c, w, h) => { c.fillStyle = fondo; c.fillRect(0, 0, w, h); c.strokeStyle = tinta; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = tinta; c.font = 'bold 84px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(texto, w / 2, h / 2 + 4); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.position.set(x, y, z); m.rotation.y = rotY; m.name = 'kit_placa'; g.add(m); return m;
}
// letras recortadas (sin fondo) en una tira curva o plana: tex con alpha
function texLetras(texto, tinta, sombra, px = 120) {
  return texLienzo('letras:' + texto + tinta, 2048, 192, (c, w, h) => {
    c.font = `bold ${px}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    let f = px; while (c.measureText(texto).width > w * 0.96 && f > 30) { f -= 4; c.font = `bold ${f}px Georgia, serif`; }
    if (sombra) { c.fillStyle = sombra; c.fillText(texto, w / 2 + 4, h / 2 + 6); }
    c.fillStyle = tinta; c.fillText(texto, w / 2, h / 2 + 2);
  });
}
function banderaChile() {
  return texLienzo('bandera', 192, 128, (c) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, 192, 64); c.fillStyle = '#d52b1e'; c.fillRect(0, 64, 192, 64); c.fillStyle = '#0039a6'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 8 : 20; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } c.fill();
  });
}

// ---- ventana / puerta de medio punto con abanico. Origen al centro del alféizar (abajo del vano), +Z hacia afuera.
// Vano: u ±w/2, v 0 .. hR + w/2. { marco, vidrio, jamba } (jamba: tímpanos de las esquinas + intradós, del material del muro)
function moduloArco(w, hR, puerta = false) {
  const k = ['arco', w.toFixed(2), hR.toFixed(2), puerta].join('|');
  if (modCache[k]) return modCache[k];
  const J = new Junta(), B = 'b', r = w / 2, d = 0.2, n = 12, hT = hR + r, t = 0.06;
  const A = (i, rr = r) => { const a = Math.PI * i / n; return [rr * Math.cos(a), hR + rr * Math.sin(a)]; };
  const tri = (cl, p, q, s) => { const cz = (q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]); if (cz > 0) J.tri(cl, p, q, s); else J.tri(cl, p, s, q); };
  for (let i = 0; i < n; i++) {   // tímpanos (esquinas entre el arco y el vano rectangular del muro) e intradós
    const [x0, y0] = A(i), [x1, y1] = A(i + 1), cx = i < n / 2 ? r : -r;
    tri('j', [cx, hT, 0], [x0, y0, 0], [x1, y1, 0]);
    J.quad('j', [x1, y1, 0], [x0, y0, 0], [x0, y0, -d], [x1, y1, -d]);
    // arquivolta blanca (moldura del arco) y abanico
    const [ax0, ay0] = A(i, r + 0.07), [ax1, ay1] = A(i + 1, r + 0.07), la = Math.hypot(ax1 - ax0, ay1 - ay0) + 0.02;
    J.caja(B, (ax0 + ax1) / 2, (ay0 + ay1) / 2, 0.03, la, 0.14, 0.07, 0, 0, Math.atan2(ay1 - ay0, ax1 - ax0));
    const [bx0, by0] = A(i, r - t / 2), [bx1, by1] = A(i + 1, r - t / 2);
    J.caja(B, (bx0 + bx1) / 2, (by0 + by1) / 2, -0.09, Math.hypot(bx1 - bx0, by1 - by0) + 0.01, t, 0.05, 0, 0, Math.atan2(by1 - by0, bx1 - bx0));
    const [cx0, cy0] = A(i, r * 0.3), [cx1, cy1] = A(i + 1, r * 0.3);
    J.caja(B, (cx0 + cx1) / 2, (cy0 + cy1) / 2, -0.09, Math.hypot(cx1 - cx0, cy1 - cy0) + 0.01, 0.04, 0.04, 0, 0, Math.atan2(cy1 - cy0, cx1 - cx0));
  }
  for (let j = 1; j < 6; j++) { const a = Math.PI * j / 6, rm = r * 0.65; J.caja(B, Math.cos(a) * rm, hR + Math.sin(a) * rm, -0.09, r * 0.7, 0.035, 0.035, 0, 0, a); }   // rayos del abanico
  J.caja(B, 0, hT + 0.1, 0.05, 0.22, 0.3, 0.1);   // clave
  for (const sx of [-1, 1]) {   // jambas del vano (muro) y molduras
    J.quadR('j', ...(sx < 0 ? [[-r, 0, -d], [-r, 0, 0], [-r, hR, 0], [-r, hR, -d]] : [[r, 0, 0], [r, 0, -d], [r, hR, -d], [r, hR, 0]]));
    J.caja(B, sx * (r + 0.07), hR / 2, 0.03, 0.14, hR, 0.07);
    J.caja(B, sx * (r - t / 2), hR / 2, -0.09, t, hR, 0.05);
  }
  J.quadR('j', [-r, 0, -d], [r, 0, -d], [r, 0, 0], [-r, 0, 0]);
  J.caja(B, 0, hR, -0.09, w, 0.09, 0.06);   // travesaño bajo el abanico
  if (puerta) {   // puerta de dos hojas con tableros (blanca, como en la iglesia)
    J.caja(B, 0, hR / 2, -0.13, w, hR, 0.06);
    for (const sx of [-1, 1]) for (const yy of [0.28, 0.66]) J.caja(B, sx * w / 4, hR * yy, -0.09, w / 2 - 0.22, hR * 0.28, 0.03);
    J.caja('o', 0, hR / 2, -0.095, 0.03, hR, 0.03);
  } else {
    J.caja(B, 0, t, -0.09, w, t * 1.6, 0.05);   // peinazo de abajo
    J.caja(B, 0, -0.04, 0.05, w + 0.3, 0.07, 0.17);   // alféizar
    J.caja(B, 0, hR * 0.5, -0.09, w, 0.06, 0.05);    // encuentro de las hojas de guillotina
    J.caja(B, 0, hR / 2, -0.095, 0.035, hR, 0.03);
    for (const yy of [0.25, 0.75]) J.caja(B, 0, hR * yy, -0.095, w, 0.03, 0.03);
  }
  const V = new Junta(), zv = -0.12;
  if (!puerta) V.quad('v', [-r, 0, zv], [r, 0, zv], [r, hR, zv], [-r, hR, zv]);
  for (let i = 0; i < n; i++) { const [x0, y0] = A(i), [x1, y1] = A(i + 1); V.tri('v', [0, hR, zv], [x0, y0, zv], [x1, y1, zv]); }
  return (modCache[k] = { marco: J.geometria(B), vidrio: V.geometria('v'), jamba: J.geometria('j', uvCaja), oscuro: J.geometria('o') });
}

// triángulo en una cara (u, v) → mundo, ordenado para mirar hacia afuera
function tri2(J, clave, f, a, b, c) {
  const cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (cz > 0) J.tri(clave, f(...a), f(...b), f(...c)); else J.tri(clave, f(...a), f(...c), f(...b));
}
// ---- ensamblado: una malla por material + ventanas instanciadas por tipo y tamaño
// ventanas: { f, rot, u, v, w, h, tipo: 'g' (guillotina, v = centro) | 'arco' | 'arcoP' (v = alféizar), panos, jm: material del muro }
function vano(o) { return o.tipo === 'arco' || o.tipo === 'arcoP' ? { u0: o.u - o.w / 2, u1: o.u + o.w / 2, v0: o.v, v1: o.v + o.h + o.w / 2 } : { u0: o.u - o.w / 2, u1: o.u + o.w / 2, v0: o.v - o.h / 2, v1: o.v + o.h / 2 }; }
function cara(J, clave, f, rot, u0, u1, v0, v1, lista, ventanas, extra = []) {
  muroConVanos(J, clave, (u, v) => f(u, v), u0, u1, v0, v1, [...lista.map(vano), ...extra]);
  for (const o of lista) if (!o.abierta) ventanas.push({ f, rot, jm: clave, ...o });   // abierta: vano libre (sin hoja ni vidrio)
}
function armar(J, mats, ventanas, op, uvs = {}) {
  const g = new THREE.Group(); g.name = 'kit_sewell';
  const lodFino = new THREE.LOD(); lodFino.name = 'kit_finos'; const finos = new THREE.Group();
  lodFino.addLevel(finos, 0); lodFino.addLevel(new THREE.Object3D(), op.lejosFino ?? 70, 0.08);
  for (const k of Object.keys(J.p)) {
    const geo = J.geometria(k, uvs[k] ?? (/^(estuco|estucoZ|cinta|hormigon|tablas|acanalada)$/.test(k) ? uvCaja : null));
    if (!geo) continue;
    const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'kit_' + k; m.castShadow = !/fierro|Fino/.test(k); m.receiveShadow = true;
    if (k.endsWith('Fino')) finos.add(m); else g.add(m);
  }
  const tipos = {};
  for (const v of ventanas) (tipos[[v.tipo || 'g', v.w.toFixed(2), v.h.toFixed(2), v.panos || 2, v.jm].join('|')] ||= []).push(v);
  const lod = new THREE.LOD(); lod.name = 'kit_marcos'; const marcos = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), uno = new THREE.Vector3(1, 1, 1), col = new THREE.Color(), r = azar(op.semilla ?? 20);
  for (const lista of Object.values(tipos)) {
    const v0 = lista[0], arco = v0.tipo === 'arco' || v0.tipo === 'arcoP';
    const mod = arco ? moduloArco(v0.w, v0.h, v0.tipo === 'arcoP') : moduloVentana(v0.w, v0.h, v0.panos || 2, false);
    const im = new THREE.InstancedMesh(mod.marco, mats.blanco, lista.length), iv = new THREE.InstancedMesh(mod.vidrio, material('vidrio'), lista.length);
    const ij = mod.jamba && new THREE.InstancedMesh(mod.jamba, mats[v0.jm] ?? mats.estuco, lista.length);
    const io = mod.oscuro && new THREE.InstancedMesh(mod.oscuro, mats.fierro, lista.length);
    im.name = 'kit_ventanas'; iv.name = 'kit_vidrios'; im.receiveShadow = iv.receiveShadow = true;
    lista.forEach((v, i) => {
      m4.compose(new THREE.Vector3(...v.f(v.u, v.v)), q.setFromAxisAngle(eje, v.rot), uno);
      im.setMatrixAt(i, m4); iv.setMatrixAt(i, m4); if (ij) ij.setMatrixAt(i, m4); if (io) io.setMatrixAt(i, m4);
      const t = r(); col.setHex(t < 0.08 ? 0xd8d2c0 : t < 0.2 ? 0x7d8f98 : t < 0.55 ? 0x34414c : 0x2a343e); iv.setColorAt(i, col);
    });
    for (const x of [im, iv, ij, io]) if (x) x.computeBoundingSphere();
    marcos.add(im); g.add(iv); if (ij) { ij.receiveShadow = true; g.add(ij); } if (io) g.add(io);
  }
  lod.addLevel(marcos, 0); lod.addLevel(new THREE.Object3D(), op.lejos ?? 220, 0.08); g.add(lod);
  if (finos.children.length) g.add(lodFino);
  return g;
}
// balaustrada calada (cruces en X entre postes), de (x0,z0) a (x1,z1) a la altura y (recta en X o en Z)
function balaustrada(J, x0, z0, x1, z1, y, h = 1.0) {
  const enX = Math.abs(x1 - x0) >= Math.abs(z1 - z0), Lb = enX ? Math.abs(x1 - x0) : Math.abs(z1 - z0), np = Math.max(1, Math.round(Lb / 0.6)), pw = Lb / np;
  const P = s => [x0 + (x1 - x0) * s, z0 + (z1 - z0) * s];
  const [xm, zm] = P(0.5);
  J.caja('blanco', xm, y + h - 0.06, zm, enX ? Lb + 0.1 : 0.16, 0.12, enX ? 0.16 : Lb + 0.1);   // pasamanos
  J.caja('blanco', xm, y + 0.1, zm, enX ? Lb : 0.13, 0.12, enX ? 0.13 : Lb);                  // zócalo de la baranda
  for (const s of [0, 1]) { const [x, z] = P(s); J.caja('blanco', x, y + h / 2, z, 0.2, h, 0.2); }
  const hh = h - 0.28, ang = Math.atan2(hh, pw), len = Math.hypot(hh, pw);
  for (let i = 0; i < np; i++) {
    const [x, z] = P((i + 0.5) / np);
    for (const s of [-1, 1]) J.caja('blancoFino', x, y + 0.16 + hh / 2, z, enX ? len : 0.05, 0.05, enX ? 0.05 : len, 0, enX ? 0 : s * ang, enX ? s * ang : 0);
    if (i) { const [xp, zp] = P(i / np); J.caja('blanco', xp, y + h / 2, zp, 0.07, h - 0.1, 0.07); }
  }
}

// ======================================================================================= Edificio 20 · Teniente Club
function club20(op) {
  const L = op.largo, W = op.ancho, H = op.alto, J = new Junta(), ven = [];
  const dP = Math.min(3.4, W * 0.22), wP = Math.min(10, L * 0.3), al = 0.6;
  const xE = L / 2 - al, zF = W / 2 - dP, zB = -W / 2 + al, zc = (zF + zB) / 2, Ww = zF - zB, Lw = 2 * xE;
  const zoc = Math.min(2.6, H * 0.18), p1 = 0.32, yR = H - 0.2, yE = yR - p1 * (Ww / 2 + al), yM = yE + p1 * al - 0.12;
  const hp = (yM - zoc - 0.6) / 2, y2 = zoc + hp;
  const rejas = [];   // { f, u } vanos con reja en el zócalo
  // --- frente: piso 1 ventanas pareadas (detrás del pórtico: puerta y ventanas sueltas), piso 2 arcos de medio punto con abanico
  const nb = Math.max(3, Math.floor((Lw - 2) / 3.6)) | 1, us = Array.from({ length: nb }, (_, i) => (i - (nb - 1) / 2) * ((Lw - 2.4) / (nb - 1)));
  const fF = (u, v) => [u, v, zF], f1 = [], f2 = [], extraF = [];
  const hA = Math.max(1.2, hp - 0.9 - 0.75 - 0.75);
  for (const u of us) {
    f2.push({ u, v: y2 + 0.9, w: 1.5, h: hA, tipo: 'arco' });
    if (Math.abs(u) < 0.5) continue;   // puerta
    if (Math.abs(u) < wP / 2) { f1.push({ u, v: zoc + 0.9 + 1.1, w: 1.0, h: 2.2 }); continue; }
    for (const s of [-1, 1]) f1.push({ u: u + s * 0.5, v: zoc + 0.9 + 1.05, w: 0.82, h: 2.1 });
    J.caja('blanco', u, zoc + 0.9 + 2.1 + 0.32, zF + 0.1, 2.5, 0.16, 0.26); J.caja('blanco', u, zoc + 0.9 + 2.1 + 0.2, zF + 0.04, 2.3, 0.12, 0.1);   // cornisa sobre el par
    for (const s of [-1, 1]) J.caja('blanco', u + s * 1.08, zoc + 0.9 + 1.05, zF + 0.03, 0.14, 2.3, 0.07);
    rejas.push({ f: fF, u, rot: 0 });
  }
  extraF.push({ u0: -0.95, u1: 0.95, v0: zoc + 0.15, v1: zoc + 3.2 });   // puerta principal (detrás del pórtico)
  // N0-EMB9: puerta ABIERTA (el club se visita por dentro): hojas hacia adentro, jambas y el vestíbulo cálido al fondo
  J.caja('interior', 0, zoc + 1.67, zF - 1.1, 1.9, 3.05, 0.06); J.caja('alfombra', 0, zoc + 0.17, zF - 0.6, 1.0, 0.02, 1.0); J.caja('piso', 0, zoc + 0.155, zF - 0.6, 1.9, 0.03, 1.1);
  for (const s of [-1, 1]) { J.caja('estuco', s * 0.97, zoc + 1.67, zF - 0.55, 0.04, 3.05, 1.1); J.caja('puerta', s * 0.89, zoc + 1.67, zF - 0.62, 0.06, 3.0, 0.9);
    J.caja('vidrioP', s * 0.85, zoc + 2.2, zF - 0.62, 0.02, 1.1, 0.6); J.caja('blanco', s * 1.03, zoc + 1.67, zF + 0.03, 0.16, 3.15, 0.07); }
  J.caja('blanco', 0, zoc + 3.3, zF + 0.05, 2.4, 0.22, 0.12);
  cara(J, 'estuco', fF, 0, -xE, xE, zoc, yM, [...f1, ...f2], ven, extraF);
  // --- costados (ventanas altas estrechas en los dos pisos) y fondo
  const lados = [['este', (u, v) => [xE, v, zc - u], Math.PI / 2], ['oeste', (u, v) => [-xE, v, zc + u], -Math.PI / 2]];
  const nl = Math.max(2, Math.floor((Ww - 2) / 3.0)), ul = Array.from({ length: nl }, (_, i) => (i - (nl - 1) / 2) * ((Ww - 2.4) / Math.max(1, nl - 1)));
  for (const [, f, rot] of lados) {
    const l = []; for (const u of ul) { l.push({ u, v: zoc + 0.8 + 1.15, w: 0.9, h: 2.3 }, { u, v: y2 + 0.8 + 1.15, w: 0.9, h: 2.3 }); rejas.push({ f, u, rot }); }
    cara(J, 'estuco', f, rot, -Ww / 2, Ww / 2, zoc, yM, l, ven);
  }
  const fB = (u, v) => [-u, v, zB], lb = [];
  for (const u of us) lb.push({ u, v: zoc + 0.9 + 1.0, w: 1.0, h: 2.0 }, { u, v: y2 + 0.9 + 1.0, w: 1.0, h: 2.0 });
  cara(J, 'estuco', fB, Math.PI, -xE, xE, zoc, yM, lb, ven);
  for (const u of us) rejas.push({ f: fB, u, rot: Math.PI });
  // --- zócalo alto con rejas de fierro y líneas de almohadillado
  const hz = zoc >= 1.8;
  for (const [f, u0, u1, rot] of [[fF, -xE, xE, 0], [fB, -xE, xE, Math.PI], [lados[0][1], -Ww / 2, Ww / 2, Math.PI / 2], [lados[1][1], -Ww / 2, Ww / 2, -Math.PI / 2]]) {
    const rj = hz ? rejas.filter(o => o.f === f).map(o => ({ u0: o.u - 0.7, u1: o.u + 0.7, v0: 0.55, v1: 1.5 })) : [];
    muroConVanos(J, 'estucoZ', f, u0, u1, 0, zoc, rj);
  }
  if (hz) for (const o of rejas) {
    const n = Math.round(1.4 / 0.14), fo = (u, v, d) => { const p = o.f(u, v); const nx = Math.sin(o.rot), nz = Math.cos(o.rot); return [p[0] + nx * d, p[1], p[2] + nz * d]; };
    const [bx, by, bz] = fo(o.u, 1.02, -0.22); J.caja('oscuro', bx, by, bz, Math.abs(Math.cos(o.rot)) > 0.5 ? 1.4 : 0.04, 0.95, Math.abs(Math.cos(o.rot)) > 0.5 ? 0.04 : 1.4);
    for (let k = 0; k <= n; k++) { const [x, y, z] = fo(o.u - 0.7 + k * 1.4 / n, 1.02, -0.06); J.caja('fierroFino', x, y, z, 0.03, 0.95, 0.03); }
    for (const yy of [0.62, 1.02, 1.42]) { const [x, y, z] = fo(o.u, yy, -0.06); J.caja('fierro', x, y, z, Math.abs(Math.cos(o.rot)) > 0.5 ? 1.4 : 0.03, 0.03, Math.abs(Math.cos(o.rot)) > 0.5 ? 0.03 : 1.4); }
  }
  for (const yy of [0.5, 1.75]) J.caja('cinta', 0, yy, zc, Lw + 0.03, 0.05, Ww + 0.03);   // almohadillado
  // --- molduras: cinta del zócalo, cinta de piso, cornisa
  J.caja('blanco', 0, zoc, zc, Lw + 0.22, 0.24, Ww + 0.22);
  J.caja('blanco', 0, y2 + 0.05, zc, Lw + 0.12, 0.18, Ww + 0.12);
  J.caja('blanco', 0, yM - 0.3, zc, Lw + 0.28, 0.5, Ww + 0.28); J.caja('blanco', 0, yM - 0.62, zc, Lw + 0.14, 0.14, Ww + 0.14);
  // --- techo a dos aguas de pendiente baja (cumbrera en X), alero ancho con tapacán blanco profundo
  const zt = Ww / 2 + al;
  for (const s of [1, -1]) {
    const a = [-L / 2, yR, zc], b = [L / 2, yR, zc], c = [L / 2, yE, zc + s * zt], d = [-L / 2, yE, zc + s * zt];
    if (s > 0) J.quad('zinc', d, c, b, a); else J.quad('zinc', a, b, c, d);
    const dn = q => [q[0], q[1] - 0.14, q[2]];
    if (s > 0) J.quad('blanco', dn(a), dn(b), dn(c), dn(d)); else J.quad('blanco', dn(d), dn(c), dn(b), dn(a));
    J.caja('blanco', 0, yE - 0.14, zc + s * (zt - 0.03), L, 0.34, 0.06);
  }
  for (const sx of [-1, 1]) {
    const xg = sx * xE, ap = yR - 0.16;
    if (sx > 0) J.tri('estuco', [xg, yM, zF], [xg, yM, zB], [xg, ap, zc]); else J.tri('estuco', [xg, yM, zB], [xg, yM, zF], [xg, ap, zc]);
    for (const s of [1, -1]) J.caja('blanco', sx * (L / 2 - 0.03), (yR + yE) / 2 - 0.12, zc + s * zt / 2, 0.06, 0.34, Math.hypot(zt, yR - yE), 0, s * Math.atan(p1));
    J.caja('blanco', xg + sx * 0.03, yM + (ap - yM) * 0.4, zc, 0.06, 0.5, 0.9);   // ventila del hastial
  }
  J.caja('fierro', 0, yR + 0.04, zc, L + 0.02, 0.08, 0.3);
  // --- pórtico: podio estucado, columnas, balcón con balaustrada calada arriba y abajo, escalera lateral (+X)
  const zP0 = zF, zP1 = W / 2 - 0.1, zPc = (zP0 + zP1) / 2, xP = wP / 2;
  J.caja('estucoZ', 0, zoc / 2, zPc, wP, zoc, zP1 - zP0);
  for (const u of [-wP / 4, wP / 4]) { J.caja('blanco', u, zoc / 2, zP1 + 0.02, wP / 2 - 0.9, zoc - 0.8, 0.04); J.caja('estucoZ', u, zoc / 2, zP1 + 0.04, wP / 2 - 1.1, zoc - 1.0, 0.04); }   // tableros rehundidos
  J.caja('blanco', 0, zoc + 0.06, zPc, wP + 0.12, 0.14, zP1 - zP0 + 0.12);
  const xc = [-xP + 0.35, -xP / 3, xP / 3, xP - 0.35], zcol = zP1 - 0.35, hCol = y2 - 0.35 - (zoc + 0.12);
  for (const x of xc) {
    J.add('blanco', new THREE.CylinderGeometry(0.19, 0.22, hCol, 14).translate(x, zoc + 0.12 + hCol / 2, zcol));
    J.caja('blanco', x, zoc + 0.22, zcol, 0.52, 0.2, 0.52); J.caja('blanco', x, y2 - 0.42, zcol, 0.56, 0.16, 0.56);
    J.add('blanco', new THREE.CylinderGeometry(0.26, 0.2, 0.18, 14).translate(x, y2 - 0.54, zcol));
  }
  for (const s of [-1, 1]) J.caja('blanco', s * (xP - 0.35), (zoc + y2) / 2, zF + 0.12, 0.4, y2 - zoc, 0.2);   // pilastras contra el muro
  J.caja('blanco', 0, y2 - 0.17, zPc, wP, 0.36, zP1 - zP0 + 0.05);   // losa del balcón
  J.caja('blanco', 0, y2 + 0.04, zP1 - 0.02, wP + 0.2, 0.14, 0.22);
  balaustrada(J, -xP + 0.1, zP1 - 0.15, xP - 0.1, zP1 - 0.15, y2 + 0.1);
  for (const s of [-1, 1]) balaustrada(J, s * (xP - 0.1), zP0 + 0.1, s * (xP - 0.1), zP1 - 0.15, y2 + 0.1);
  balaustrada(J, -xP + 0.35, zP1 - 0.15, xP - 0.35, zP1 - 0.15, zoc + 0.12, 0.95);
  balaustrada(J, -(xP - 0.1), zP0 + 0.1, -(xP - 0.1), zP1 - 0.35, zoc + 0.12, 0.95);
  // N2-C38: escalera lateral de hormigón CAMINABLE (a lo largo de la fachada, sube hacia -X hasta el podio del pórtico): pendiente ~27°
  // (contrahuella ~16,5 cm, huella 32 cm), mejilla de estuco por el lado de la calle y pasamanos de fierro con postes. La colisión (rampa bajo los
  // peldaños, baranda, podio, columnas) la arma clubAcceso() con g.userData.kit.acc.
  const yT = zoc + 0.13, zA0 = zF + 0.12, wE = 1.8, zA1 = zA0 + wE, uA = xP + 0.06;
  const nS = Math.max(6, Math.round((yT - 0.12) / 0.165)), rise = (yT - 0.12) / nS, tread = 0.32, run = nS * tread, caida = yT - 0.12, phi = Math.atan2(caida, run);
  const yPend = u => yT - caida * u / run;   // altura de la nariz de los peldaños a la distancia u del podio
  for (let k = 0; k < nS - 1; k++) { const top = yT - (k + 1) * rise; J.caja('hormigon', uA + (k + 0.5) * tread, top / 2, zA0 + wE / 2, tread + 0.004, top, wE - 0.02); }
  { const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(run, 0), new THREE.Vector2(run, 0.12 + 0.32), new THREE.Vector2(0, yT + 0.32)]);
    J.add('estucoZ', new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }).translate(uA, 0, zA1));
    J.caja('blanco', uA + run / 2, (yT + 0.12) / 2 + 0.35, zA1 + 0.1, Math.hypot(run, caida) + 0.1, 0.06, 0.3, 0, 0, -phi);   // albardilla
    const tubo = (y, r) => J.add('fierro', new THREE.CylinderGeometry(r, r, Math.hypot(run, caida) + 0.05, 8).rotateZ(Math.PI / 2 - phi).translate(uA + run / 2, (yT + 0.12) / 2 + y, zA1 + 0.1));
    tubo(0.95, 0.032); tubo(0.64, 0.02);
    for (const u of [0.06, run / 3, 2 * run / 3, run - 0.06]) J.caja('fierro', uA + u, yPend(u) + 0.38 + 0.3, zA1 + 0.1, 0.055, 0.6, 0.055);   // postes
    J.caja('fierro', uA - 0.04, yT + 0.35 + 0.3, zA1 + 0.1, 0.055, 0.6, 0.055); }
  const acc = { L, W, zoc, yT, zF, zP0, zP1, xP, wP, zA0, zA1, uA, run, caida, nS, zcol, xc };
  // vereda y bolardos rojos frente a la fachada
  J.caja('hormigon', 0, 0.06, (zF + W / 2) / 2, L - 0.1, 0.12, W / 2 - zF);
  for (let x = uA + run + 1.2; x < L / 2 - 0.6; x += 2.3) J.add('rojo', new THREE.CylinderGeometry(0.07, 0.07, 0.95, 8).translate(x, 0.47, W / 2 - 0.3));
  // baranda baja del costado este del pórtico (entre la escalera y la columna de la esquina)
  balaustrada(J, xP - 0.1, zA1 + 0.1, xP - 0.1, zP1 - 0.35, zoc + 0.12, 0.95);
  // --- armar
  const mats = { estuco: material('estuco', op.colorEstuco ?? 0xf6eed8), estucoZ: material('estuco', 0xfbf7ee), cinta: material('estuco', 0xe8dec6), zinc: material('zinc', op.colorTecho ?? 0x8e8a82),
    blanco: material('blanco', 0xf4f1e8), fierro: material('fierro'), oscuro: material('fierro', 0x15171a), puerta: material('puerta', 0x4b3322), hormigon: material('hormigon'), rojo: material('fierro', 0xa3201c),
    interior: new THREE.MeshBasicMaterial({ color: 0x7a4c2a }), alfombra: new THREE.MeshStandardMaterial({ color: 0x8a1420, roughness: 1 }), piso: new THREE.MeshStandardMaterial({ color: 0x7a4632, roughness: 0.3 }), vidrioP: new THREE.MeshBasicMaterial({ color: 0xc8a878 }) };
  mats.blancoFino = mats.blanco; mats.fierroFino = mats.fierro;
  const g = armar(J, mats, ven, op, { zinc: uvTecho(p1) });
  // banderas de Chile en astas inclinadas desde el balcón
  const mB = new THREE.MeshStandardMaterial({ map: banderaChile(), side: THREE.DoubleSide, roughness: 0.8 });
  for (const x of [-xP * 0.55, xP * 0.15]) {
    const a = new THREE.Group(); a.position.set(x, y2 + 1.0, zP1 - 0.2); a.rotation.x = 0.45;
    const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 4.2, 6), mats.blanco); asta.position.y = 2.1; a.add(asta);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), mB); b.position.set(0.78, 3.65, 0); b.rotation.x = -0.45; a.add(b);
    g.add(a);
  }
  placa(g, op.placa ?? 'EDIF-020', -xP - 1.2, yM - 1.05, zF + 0.06, 0, 1.3, 0.38);
  g.userData.kit = { forma: 'club20', ventanas: ven.length, muro: yM, cumbrera: yR, piso2: y2, zocalo: zoc, acc };
  return g;
}

// ======================================================================================= Edificio 129 · Escuela Industrial
function escuela129(op) {
  const L = op.largo, W = op.ancho, H = op.alto, J = new Junta(), ven = [];
  const xE = L / 2 - 1.7, zF = W / 2 - 0.12, zB = -W / 2 + 0.12;   // 1,7 m libres al costado +X: escalera y marquesina del acceso
  const R = Math.min((zF - zB) * 0.55, 6.5), cx = xE - R, cz = zF - R;
  const zoc = 0.9, yPar = H - 1.1, yLosa = yPar - 0.9, pisos = op.pisos ?? 4, hp = (yLosa - zoc - 0.3) / pisos;
  const yV = i => zoc + i * hp + 0.75 + 0.85, wv = 1.12, hv = Math.min(1.75, hp - 1.0);
  // --- frente (+Z): de -xE a cx, ventanas en fila con pilastras cada 3
  const fF = (u, v) => [u, v, zF], lF = [], nF = Math.floor((cx - (-xE) - 1.6) / 2.05), uF = Array.from({ length: nF }, (_, i) => -xE + 1.0 + (i + 0.5) * ((cx - 0.6 + xE - 1.0) / nF));
  for (let p = 0; p < pisos; p++) for (const u of uF) lF.push({ u, v: yV(p), w: wv, h: hv, panos: 6 });
  cara(J, 'estuco', fF, 0, -xE, cx, 0.02, yPar, lF, ven);
  for (let i = 3; i < uF.length; i += 3) J.caja('cinta', (uF[i - 1] + uF[i]) / 2, (zoc + yPar) / 2, zF + 0.06, 0.55, yPar - zoc, 0.12);
  J.caja('cinta', -xE + 0.3, (zoc + yPar) / 2, zF + 0.06, 0.6, yPar - zoc, 0.12);
  // --- fondo y oeste
  const fB = (u, v) => [-u, v, zB], lB = [], nB = Math.floor((2 * xE - 2) / 2.3), uB = Array.from({ length: nB }, (_, i) => (i - (nB - 1) / 2) * 2.3);
  for (let p = 0; p < pisos; p++) for (const u of uB) lB.push({ u, v: yV(p), w: wv, h: hv, panos: 6 });
  cara(J, 'estuco', fB, Math.PI, -xE, xE, 0.02, yPar, lB, ven);
  const fO = (u, v) => [-xE, v, u], lO = [];
  for (let p = 0; p < pisos; p++) for (const u of [-(zF - zB) / 4, (zF - zB) / 4]) lO.push({ u, v: yV(p), w: wv, h: hv, panos: 6 });
  cara(J, 'estuco', fO, -Math.PI / 2, zB, zF, 0.02, yPar, lO, ven);
  // --- costado +X (acceso): puerta elevada con marquesina, ventanas en columna
  const fE = (u, v) => [xE, v, -u], uD = -cz + 1.5, yd = zoc + 1.1, lE = [], ex = [{ u0: uD - 0.68, u1: uD + 0.68, v0: yd, v1: yd + 2.35 }];
  const uE2 = uD + 2.3 < -zB - 0.8 ? uD + 2.3 : null;
  for (let p = 0; p < pisos; p++) { if (p > 0) lE.push({ u: uD, v: yV(p), w: wv, h: hv, panos: 6 }); if (uE2 != null) lE.push({ u: uE2, v: yV(p), w: wv, h: hv, panos: 6 }); }
  cara(J, 'estuco', fE, Math.PI / 2, -cz, -zB, 0.02, yPar, lE, ven, ex);
  const zD = -uD;
  J.caja('puerta', xE - 0.14, yd + 1.17, zD, 0.06, 2.35, 1.36);
  J.caja('cinta', xE + 0.04, yd + 2.45, zD, 0.1, 0.2, 1.7);
  J.caja('cinta', xE + 0.6, yd + 2.7, zD, 1.2, 0.16, 2.2);   // marquesina
  J.caja('estucoZ', xE + 0.7, yd / 2, zD, 1.4, yd, 2.0);       // descanso
  const nS = Math.max(4, Math.round(yd / 0.18)), zS0 = zD + 1.0;
  for (let k = 0; k < nS; k++) { const top = yd - (k + 1) * yd / nS + yd / nS; J.caja('hormigon', xE + 0.7, top / 2, zS0 + (k + 0.5) * 0.28, 1.3, top, 0.28); }
  { const xw = xE + 1.48, z0 = zD - 1.0, z1 = zS0 + nS * 0.28;   // murete macizo de la escalera (ocre, como en la foto)
    for (const s of [1, -1]) { const x = xw + (s > 0 ? 0.07 : -0.07), P = [[x, 0, z1], [x, 0, z0], [x, yd + 0.95, z0], [x, yd + 0.95, zS0], [x, 0.95, z1]];
      if (s > 0) { J.quad('estuco', P[0], P[1], P[2], P[3]); J.tri('estuco', P[0], P[3], P[4]); } else { J.quad('estuco', P[3], P[2], P[1], P[0]); J.tri('estuco', P[4], P[3], P[0]); } }
    J.caja('cinta', xw, yd + 0.98, (z0 + zS0) / 2, 0.22, 0.08, zS0 - z0);
    J.caja('cinta', xw, (yd + 0.95 + 0.95) / 2 + 0.04, (zS0 + z1) / 2, 0.22, 0.08, Math.hypot(z1 - zS0, yd), 0, -Math.atan2(yd, z1 - zS0)); }
  // --- esquina curva (torreón): segmentos planos con una ventana por piso, sube hasta H con el letrero
  const nC = 7, P = i => { const a = Math.PI / 2 - (Math.PI / 2) * i / nC; return [cx + R * Math.cos(a), cz + R * Math.sin(a), a]; };
  for (let i = 0; i < nC; i++) {
    const [x0, z0] = P(i), [x1, z1] = P(i + 1), len = Math.hypot(x1 - x0, z1 - z0), tx = (x1 - x0) / len, tz = (z1 - z0) / len, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const f = (u, v) => [mx + tx * u, v, mz + tz * u], l = [];
    const am = (P(i)[2] + P(i + 1)[2]) / 2, rotV = Math.atan2(Math.cos(am), Math.sin(am));
    for (let p = 0; p < pisos; p++) l.push({ u: 0, v: yV(p), w: Math.min(wv, len - 0.4), h: hv, panos: 6 });
    cara(J, 'estuco', f, rotV, -len / 2, len / 2, 0.02, H - 0.1, l, ven);
    for (let p = 0; p <= pisos; p++) J.caja('cinta', mx + Math.cos(am) * 0.07, p < pisos ? yV(p) - hv / 2 - 0.12 : yPar - 0.15, mz + Math.sin(am) * 0.07, len + 0.06, 0.2, 0.16, rotV);
    J.caja('cinta', mx - Math.cos(am) * 0.05, H - 0.06, mz - Math.sin(am) * 0.05, len + 0.08, 0.12, 0.42, rotV);
    J.quadR('estuco', [x1, yPar, z1], [x0, yPar, z0], [x0, H - 0.1, z0], [x1, H - 0.1, z1]); J.quad('estuco', [x1, yPar, z1], [x0, yPar, z0], [x0, H - 0.1, z0], [x1, H - 0.1, z1]);   // cara interior del remate (sobre la azotea)
    J.tri('losa', [cx, yLosa, cz], [x0, yLosa, z0], [x1, yLosa, z1]);

  }
  // franjas de piso (bajo las ventanas) en las caras planas
  for (let p = 0; p < pisos; p++) { const y = yV(p) - hv / 2 - 0.12; J.caja('cinta', (cx - xE) / 2, y, zF + 0.07, cx + xE, 0.2, 0.14); J.caja('cinta', 0, y, zB - 0.07, 2 * xE, 0.2, 0.14); J.caja('cinta', xE + 0.07, y, (cz + zB) / 2, 0.14, 0.2, cz - zB); J.caja('cinta', -xE - 0.07, y, 0, 0.14, 0.2, zF - zB); }
  // zócalo, azotea y pretiles con remate
  J.caja('cinta', (cx - xE) / 2, zoc / 2, zF + 0.05, cx + xE, zoc, 0.1); J.caja('cinta', 0, zoc / 2, zB - 0.05, 2 * xE, zoc, 0.1);
  J.caja('losa', (cx - xE) / 2, yLosa - 0.1, (zF + zB) / 2, cx + xE, 0.2, zF - zB - 0.1); J.caja('losa', (cx + xE) / 2, yLosa - 0.1, (cz + zB) / 2, xE - cx - 0.1, 0.2, cz - zB - 0.1);
  for (const [x, z, sx, sz] of [[(cx - xE) / 2, zF - 0.05, cx + xE, 0.3], [0, zB + 0.05, 2 * xE, 0.3], [-xE + 0.05, 0, 0.3, zF - zB], [xE - 0.05, (cz + zB) / 2, 0.3, cz - zB]]) J.caja('cinta', x, yPar + 0.05, z, sx + 0.1, 0.12, sz + 0.12);
  for (const [x, z, sx, sz] of [[(cx - xE) / 2, zF - 0.2, cx + xE, 0.3], [0, zB + 0.2, 2 * xE, 0.3], [-xE + 0.2, 0, 0.3, zF - zB], [xE - 0.2, (cz + zB) / 2, 0.3, cz - zB]]) J.caja('estuco', x, (yLosa + yPar) / 2, z, sx, yPar - yLosa, sz);   // cara interior de los pretiles
  // --- armar
  const col = op.colorEstuco ?? 0xf2d276;
  const mats = { estuco: material('estuco', col), estucoZ: material('estuco', 0xeccb6c), cinta: material('estuco', 0xe4c062), losa: material('losa', 0x5a5650), blanco: material('blanco', 0xf2efe6),
    fierro: material('fierro'), puerta: material('puerta', 0x3d3a36), hormigon: material('hormigon') };
  mats.blancoFino = mats.blanco; mats.fierroFino = mats.fierro;
  const g = armar(J, mats, ven, op);
  // letreros en la esquina curva: tira curva con letras recortadas
  const tira = (texto, y0, y1, tinta, sombra) => {
    const n = 24, a0 = Math.PI / 2 - 0.08, a1 = 0.08, pos = [], uv = [], idx = [], rr = R * Math.cos(Math.PI / 4 / nC) + 0.1;
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = cx + rr * Math.cos(a), z = cz + rr * Math.sin(a); pos.push(x, y0, z, x, y1, z); uv.push(i / n, 0, i / n, 1); if (i < n) { const b = 2 * i; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, (() => { const t = texLetras(texto, tinta, sombra, 150); return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3, side: THREE.DoubleSide }); })()); m.name = 'kit_letrero'; g.add(m);
  };
  tira('ESCUELA INDUSTRIAL', yPar - 0.05, H - 0.12, '#fffaf0', 'rgba(70,45,10,0.6)');
  if (op.museo) tira('MUSEO DE LA GRAN MINERÍA DEL COBRE', yV(0) + hv / 2 + 0.2, yV(0) + hv / 2 + 0.85, '#2a2216', null);
  placa(g, op.placa ?? 'EDIF-129', xE + 0.12, yd + 2.95, zD, Math.PI / 2, 1.3, 0.38);
  g.userData.kit = { forma: 'escuela129', ventanas: ven.length, pisos, losa: yLosa, museo: !!op.museo,
    accE: { L, W, xE, zD, yd, zS0, nS, tread: 0.28, xw: xE + 1.48 } };   // N2-PUERTAS-EMB: acceso lateral (escuelaAcceso arma su colisión y la puerta)
  return g;
}

// ======================================================================================= Edificio 231 · Iglesia
function iglesia231(op) {
  const L = op.largo, W = op.ancho, H = op.alto, J = new Junta(), ven = [];
  const al = 0.45, pD = Math.min(2.8, L * 0.13), zF = W / 2 - 1.7, zB = -W / 2 + al, zc = (zF + zB) / 2, Ww = zF - zB;
  const xW = -L / 2 + al, xG = L / 2 - pD;   // nave de xW a xG; el pórtico de acceso sale hacia +X
  const zoc = 0.5, yM = Math.min(5.6, H * 0.45), p1 = 0.78, yR = yM + p1 * (Ww / 2 + al) - 0.1, yE = yR - p1 * (Ww / 2 + al);
  const fF = (u, v) => [u, v, zF], lF = [], ex = [];
  const xs = []; for (let x = xW + 2.0; x < xG - 1.4; x += 2.9) xs.push(x);
  const kP = Math.max(0, Math.floor(xs.length / 2) - 1);   // puerta lateral con abanico (la de la foto, a la izquierda del pórtico)
  xs.forEach((x, i) => lF.push(i === kP ? { u: x, v: zoc, w: 1.35, h: 2.3, tipo: 'arcoP' } : { u: x, v: zoc + 1.25, w: 0.85, h: 1.9, tipo: 'arco' }));
  cara(J, 'estuco', fF, 0, xW, xG, zoc, yM, lF, ven, ex);
  const fB = (u, v) => [-u, v, zB], lB = xs.map(x => ({ u: -x, v: zoc + 1.25, w: 0.85, h: 1.9, tipo: 'arco' }));
  cara(J, 'estuco', fB, Math.PI, -xG, -xW, zoc, yM, lB, ven);
  // testero oeste (liso con una ventana redonda alta)
  const fO = (u, v) => [xW, v, zc + u];
  cara(J, 'estuco', fO, -Math.PI / 2, -Ww / 2, Ww / 2, zoc, yM, [], ven);
  // fachada principal (+X): puerta en el muro de la nave bajo el pórtico, ventana de medio punto en el hastial y placa
  const fG = (u, v) => [xG, v, zc - u], wPo = Math.min(4.0, Ww * 0.5), uPo = -Ww * 0.12;   // pórtico algo corrido hacia la calle, como en la foto
  const lG = [{ u: uPo, v: zoc, w: 1.6, h: 2.6, tipo: 'arcoP', abierta: true }, { u: Ww * 0.3, v: zoc + 1.25, w: 0.85, h: 1.9, tipo: 'arco' }];
  cara(J, 'estuco', fG, Math.PI / 2, -Ww / 2, Ww / 2, zoc, yM, lG, ven);
  { const ap = yR - 0.14, f = (u, v) => [xG, v, zc - u], uh = 0.55, hw = [{ u: 0, v: yM + 0.55, w: 0.9, h: 1.2, tipo: 'arco' }];
    // hastial: columna central con el vano de la ventana + dos triángulos a los lados + triángulo de remate
    const yTop = yM + (Ww / 2 - uh) * (ap - yM) / (Ww / 2);
    muroConVanos(J, 'estuco', f, -uh, uh, yM, yTop, hw.map(vano));
    tri2(J, 'estuco', f, [uh, yM], [Ww / 2, yM], [uh, yTop]); tri2(J, 'estuco', f, [-Ww / 2, yM], [-uh, yM], [-uh, yTop]); tri2(J, 'estuco', f, [-uh, yTop], [uh, yTop], [0, ap]);
    for (const o of hw) ven.push({ f, rot: Math.PI / 2, jm: 'estuco', ...o });
    J.tri('estuco', [xW, yM, zc - Ww / 2], [xW, yM, zc + Ww / 2], [xW, ap, zc]);
  }
  // molduras blancas: esquineras, cornisa y frontón quebrado con retornos
  for (const [x, z] of [[xW, zF], [xW, zB], [xG, zF], [xG, zB]]) J.caja('blanco', x + (x > 0 ? -0.06 : 0.06), (zoc + yM) / 2, z + (z > 0 ? -0.06 : 0.06), 0.24, yM - zoc, 0.24);
  J.caja('blanco', (xW + xG) / 2, yM - 0.12, zc, xG - xW + 0.16, 0.26, Ww + 0.16);
  for (const s of [-1, 1]) J.caja('blanco', xG + 0.12, yM + 0.05, zc + s * (Ww / 2 - 0.5), 0.36, 0.2, 1.4);   // retornos del frontón
  J.caja('hormigon', (xW + xG) / 2, zoc / 2, zc, xG - xW + 0.1, zoc, Ww + 0.1);
  // techo rojo empinado (cumbrera en X) con aleros y tapacanes blancos
  const zt = Ww / 2 + al, x0 = -L / 2, x1 = xG + 0.35;
  for (const s of [1, -1]) {
    const a = [x0, yR, zc], b = [x1, yR, zc], c = [x1, yE, zc + s * zt], d = [x0, yE, zc + s * zt];
    if (s > 0) J.quad('zinc', d, c, b, a); else J.quad('zinc', a, b, c, d);
    const dn = q => [q[0], q[1] - 0.12, q[2]];
    if (s > 0) J.quad('blanco', dn(a), dn(b), dn(c), dn(d)); else J.quad('blanco', dn(d), dn(c), dn(b), dn(a));
    J.caja('blanco', (x0 + x1) / 2, yE - 0.1, zc + s * (zt - 0.03), x1 - x0, 0.22, 0.06);
    for (const xe of [x0, x1]) J.caja('blanco', xe + (xe > 0 ? -0.04 : 0.04), (yR + yE) / 2 - 0.12, zc + s * zt / 2, 0.08, 0.3, Math.hypot(zt, yR - yE) + 0.1, 0, s * Math.atan(p1));
  }
  J.caja('zinc', (x0 + x1) / 2, yR + 0.05, zc, x1 - x0, 0.1, 0.32);
  // campanario sobre la cumbrera, cerca del frente: base, celosía blanca, techo a dos aguas rojo y cruz
  const bx = xG - 1.6, bw = 1.7, yb0 = yR - 0.5, yb1 = yR + 1.9;
  J.caja('estuco', bx, (yb0 + yR + 0.3) / 2, zc, bw, yR + 0.3 - yb0, bw);
  J.caja('blanco', bx, yR + 0.35, zc, bw + 0.2, 0.12, bw + 0.2);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) J.caja('blanco', bx + sx * (bw / 2 - 0.08), (yR + 0.4 + yb1) / 2, zc + sz * (bw / 2 - 0.08), 0.16, yb1 - yR - 0.4, 0.16);
  J.caja('oscuro', bx, (yR + 0.4 + yb1) / 2, zc, bw - 0.25, yb1 - yR - 0.45, bw - 0.25);
  for (let k = 0; k < 7; k++) { const y = yR + 0.55 + k * (yb1 - yR - 0.7) / 7; for (const s of [-1, 1]) { J.caja('blancoFino', bx + s * (bw / 2 - 0.1), y, zc, 0.04, 0.05, bw - 0.3, 0, s * 0.6); J.caja('blancoFino', bx, y, zc + s * (bw / 2 - 0.1), bw - 0.3, 0.05, 0.04, 0, -s * 0.6); } }
  J.caja('blanco', bx, yb1 + 0.06, zc, bw + 0.3, 0.14, bw + 0.3);
  const pT = 0.7, yTc = yb1 + 0.12 + pT * (bw / 2 + 0.25);
  for (const s of [1, -1]) { const a = [bx - bw / 2 - 0.25, yTc, zc], b = [bx + bw / 2 + 0.25, yTc, zc], c = [bx + bw / 2 + 0.25, yb1 + 0.12, zc + s * (bw / 2 + 0.25)], d = [bx - bw / 2 - 0.25, yb1 + 0.12, zc + s * (bw / 2 + 0.25)]; if (s > 0) J.quad('zinc', d, c, b, a); else J.quad('zinc', a, b, c, d); }
  for (const sx of [-1, 1]) { const xg = bx + sx * bw / 2; if (sx > 0) J.tri('blanco', [xg, yb1 + 0.12, zc + bw / 2], [xg, yb1 + 0.12, zc - bw / 2], [xg, yTc - 0.05, zc]); else J.tri('blanco', [xg, yb1 + 0.12, zc - bw / 2], [xg, yb1 + 0.12, zc + bw / 2], [xg, yTc - 0.05, zc]); }
  const hC = Math.min(1.5, H - yTc - 0.05);
  J.caja('blanco', bx, yTc + hC / 2, zc, 0.12, hC, 0.12); J.caja('blanco', bx, yTc + hC * 0.68, zc, 0.12, 0.12, hC * 0.6);
  // pórtico de acceso con arco (+X): cuerpo celeste con techo rojo a dos aguas (cumbrera en X) y gran arco abierto
  const zPc = zc - uPo, x2 = L / 2 - 0.05, yPe = Math.min(4.6, yM - 0.4), pP = 0.75, yPr = yPe + pP * (wPo / 2 + 0.3);
  for (const s of [-1, 1]) {   // muros laterales del pórtico
    const z = zPc + s * wPo / 2; J.caja('estuco', (xG + x2) / 2, (zoc + yPe) / 2, z - s * 0.12, x2 - xG, yPe - zoc, 0.24);
  }
  { const r = 1.25, hR = 2.4, f = (u, v) => [x2, v, zPc - u];   // frente del pórtico con el arco abierto
    muroConVanos(J, 'estuco', f, -wPo / 2, wPo / 2, zoc, yPe, [{ u0: -r, u1: r, v0: zoc, v1: zoc + hR + r }]);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n, P0 = [Math.cos(a0) * r, zoc + hR + Math.sin(a0) * r], P1 = [Math.cos(a1) * r, zoc + hR + Math.sin(a1) * r], cxu = i < n / 2 ? r : -r;
      tri2(J, 'estuco', f, [cxu, zoc + hR + r], P0, P1);
      for (const [p, q] of [[P0, P1], [P1, P0]]) J.quad('estuco', f(p[0], p[1]), [xG, p[1], zPc - p[0]], [xG, q[1], zPc - q[0]], f(q[0], q[1]));   // intradós (las dos caras)
      const Q0 = [Math.cos(a0) * (r + 0.1), Math.sin(a0) * (r + 0.1)], Q1 = [Math.cos(a1) * (r + 0.1), Math.sin(a1) * (r + 0.1)];
      J.caja('blanco', x2 + 0.04, zoc + hR + (Q0[1] + Q1[1]) / 2, zPc - (Q0[0] + Q1[0]) / 2, 0.08, 0.2, Math.hypot(Q1[0] - Q0[0], Q1[1] - Q0[1]) + 0.03, 0, -Math.atan2(Q1[1] - Q0[1], -(Q1[0] - Q0[0])));
    }
    for (const s of [-1, 1]) { J.caja('blanco', x2 + 0.04, zoc + hR / 2, zPc - s * (r + 0.1), 0.08, hR, 0.2); J.quadR('estuco', ...(s < 0 ? [[x2, zoc, zPc + r], [xG, zoc, zPc + r], [xG, zoc + hR, zPc + r], [x2, zoc + hR, zPc + r]] : [[xG, zoc, zPc - r], [x2, zoc, zPc - r], [x2, zoc + hR, zPc - r], [xG, zoc + hR, zPc - r]])); }
    J.caja('hormigon', (xG + x2) / 2, zoc / 2, zPc, x2 - xG, zoc, wPo);
  }
  for (const s of [1, -1]) {
    const zt2 = wPo / 2 + 0.3, a = [xG, yPr, zPc], b = [x2 + 0.25, yPr, zPc], c = [x2 + 0.25, yPe - 0.05, zPc + s * zt2], d = [xG, yPe - 0.05, zPc + s * zt2];
    if (s > 0) J.quad('zinc', d, c, b, a); else J.quad('zinc', a, b, c, d);
    J.caja('blanco', (xG + x2 + 0.25) / 2, yPe - 0.15, zPc + s * (zt2 - 0.03), x2 + 0.25 - xG, 0.2, 0.06);
    J.caja('blanco', x2 + 0.21, (yPr + yPe) / 2 - 0.12, zPc + s * zt2 / 2, 0.08, 0.28, Math.hypot(zt2, yPr - yPe) + 0.1, 0, s * Math.atan(pP));
  }
  J.tri('estuco', [x2, yPe, zPc + wPo / 2], [x2, yPe, zPc - wPo / 2], [x2, yPr - 0.12, zPc]);
  for (const s of [-1, 1]) J.caja('blanco', x2 + 0.1, yPe + 0.02, zPc + s * (wPo / 2 - 0.25), 0.3, 0.16, 0.9);
  // campana en su brazo de fierro blanco (poste en la esquina del pórtico hacia la calle)
  const zCa = zPc + wPo / 2 + 0.35, xCa = x2 - 0.35;
  J.add('blanco', new THREE.CylinderGeometry(0.06, 0.06, yPe + 0.1, 8).translate(xCa, (yPe + 0.1) / 2, zCa));
  J.add('blanco', new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8).rotateZ(Math.PI / 2).translate(xCa - 0.5, yPe - 0.3, zCa));
  J.add('bronce', new THREE.CylinderGeometry(0.1, 0.24, 0.34, 14).translate(xCa - 0.95, yPe - 0.62, zCa));
  J.add('bronce', new THREE.SphereGeometry(0.1, 10, 6).translate(xCa - 0.95, yPe - 0.43, zCa));
  // puerta de la nave ABIERTA (N0-EMB7: se entra a la sala 'iglesia'): marco blanco con arco, dos hojas abiertas hacia dentro y un fondo cálido
  { const zd = zc - uPo, w = 1.6, hh = 2.6, r = w / 2, xd = xG - 0.02;
    for (const s2 of [-1, 1]) J.caja('blanco', xd + 0.06, zoc + hh / 2, zd + s2 * (r + 0.08), 0.1, hh + 0.1, 0.16);
    const nA = 10; for (let i = 0; i < nA; i++) { const a0 = Math.PI * i / nA, a1 = Math.PI * (i + 1) / nA, am = (a0 + a1) / 2, rr = r + 0.08;
      J.caja('blanco', xd + 0.06, zoc + hh + Math.sin(am) * rr, zd + Math.cos(am) * rr, 0.1, 0.16, 2 * rr * Math.sin(Math.PI / (2 * nA)) + 0.03, 0, -(am + Math.PI / 2)); }
    for (const s2 of [-1, 1]) J.caja('puerta', xd - 0.55, zoc + 1.2, zd + s2 * (r - 0.02) - s2 * 0.05, 0.9, 2.3, 0.06, s2 * 1.15);   // hojas abiertas hacia dentro
    J.caja('claro', xd - 1.5, zoc + 1.8, zd, 0.06, 3.6, 2.4); J.caja('claro', xd - 0.7, zoc + 0.02, zd, 1.6, 0.04, 2.0);
  }
  // bancos de fierro forjado (verde oscuro) con tablas, frente a la nave
  const banco = (x, z) => {
    for (const s of [-1, 1]) { J.caja('verde', x + s * 0.8, 0.42, z, 0.06, 0.84, 0.55); J.add('verde', new THREE.TorusGeometry(0.16, 0.025, 6, 12).translate(x + s * 0.8, 0.62, z + 0.05)); }
    for (let k = 0; k < 4; k++) J.caja('puerta', x, 0.45, z - 0.18 + k * 0.12, 1.65, 0.035, 0.09);
    for (let k = 0; k < 3; k++) J.caja('puerta', x, 0.62 + k * 0.13, z - 0.25, 1.65, 0.09, 0.035);
    J.caja('verde', x, 0.92, z - 0.26, 1.7, 0.05, 0.05);
  };
  banco(xW + 2.4, W / 2 - 0.55); banco(xW + 5.2, W / 2 - 0.55);
  J.caja('hormigon', 0, 0.05, (zF + W / 2) / 2, L - 0.1, 0.1, W / 2 - zF);
  // --- armar
  const mats = { estuco: material('estuco', op.colorEstuco ?? 0xaecbf4), zinc: material('zinc', op.colorTecho ?? 0xb3343a), blanco: material('blanco', 0xf4f2ec), fierro: material('fierro'), oscuro: material('fierro', 0x2a2c30),
    claro: new THREE.MeshBasicMaterial({ color: 0xf0c98c }), hormigon: material('hormigon'), puerta: material('puerta', 0x3d4a3a), verde: material('fierro', 0x23382a), bronce: material('fierro', 0x8a6a2e) };
  mats.blancoFino = mats.blanco; mats.fierroFino = mats.fierro;
  const g = armar(J, mats, ven, op, { zinc: uvTecho(p1) });
  placa(g, op.placa ?? 'EDIF-231-P', xG + 0.05, yM + 1.95 + 1.35, zc, Math.PI / 2, 1.3, 0.36);
  g.userData.kit = { forma: 'iglesia231', ventanas: ven.length, muro: yM, cumbrera: yR };
  return g;
}

// ======================================================================================= interiores (salas de construirSala)
// salaKit(S, O, fis): mobiliario hecho con el kit para una sala con `kit` (SALAS en niveles.js). O = origen de la sala en el mundo
// (x a lo ancho, z de 0 en la entrada hacia −largo). Devuelve un THREE.Group (o null).
export function salaKit(S, O, fis) {
  const g = salaKitBase(S, O, fis);
  if (g && S.epoca >= 1960 && !S.adornosPropios) g.add(adornosEpoca(S, O, fis));   // N4-SALAS: cine y palitroque de 1967 (Operación Valle)
  return g;
}
function salaKitBase(S, O, fis) {
  if (S.kit === 'hospital157') return salaHospital(S, O, fis);
  if (S.kit === 'escuela129') return salaEscuela(S, O, fis);   // N2-ESCUELA (kitEscuela.js): escuela de su época (N2-N4)
  if (S.kit === 'museo129') return salaMuseo(S, O, fis);       // N2-ESCUELA: museo de hoy (modo turista)   // N4-SALAS (kitHospital.js): hospital del N2 (1920) y del N4 (1967)
  if (S.kit === 'palitroque106') return salaPalitroque(S, O, fis);
  if (S.kit === 'iglesia231') return salaIglesia(S, O, fis);
  if (S.kit === 'teatro165') return salaTeatro(S, O, fis);
  if (S.kit === 'club20') return salaClub(S, O, fis);   // N0-EMB9 (kitClub.js)
  return null;
}
// Palitroque (edificio 106) por dentro, según la foto: piso de madera, 2 pistas con canaletas, divisor central blanco (retorno de
// bolas) con pilares, barandas blancas a los costados (pasillos junto a las ventanas), zócalo de piedra gris, ventanas de guillotina a
// ambos lados, cuadros históricos, extintores rojos en los pilares, lámparas globo, vigas y plafones blancos, mural al fondo.
const planoUtil = (m, n) => { const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil(n); if (t) { m.material.map = t; m.material.needsUpdate = true; } }); };   // N0-UTIL3 (P2/P3): textura de Qwen cuando carga el índice (respaldo: el lienzo procedural)
function salaPalitroque(S, O, fis) {
  const W = S.ancho, L = S.largo, H = S.alto, J = new Junta(), g = new THREE.Group(); g.name = 'kit_sala_palitroque';
  const xR = 5.0, z0 = -7, z1 = -42, xs = [-xR, 0, xR], zs = []; for (let z = -8.5; z >= z1 + 1; z -= 5.5) zs.push(z);
  // divisor central: retorno de bolas blanco con tablillas y remate redondeado adelante
  J.caja('blanco', 0, 0.36, (z0 - 1 + z1 + 2) / 2, 0.8, 0.72, z0 - 1 - z1 - 2);
  J.add('blanco', new THREE.CylinderGeometry(0.4, 0.4, 0.72, 16, 1, false, -Math.PI / 2, Math.PI).translate(0, 0.36, z0 - 1));
  J.caja('gris', 0, 0.74, (z0 - 1 + z1 + 2) / 2, 0.36, 0.04, z0 - 1 - z1 - 2);   // canal del retorno
  for (let z = z0 - 1.3; z > z1 + 2; z -= 0.45) for (const s of [-1, 1]) J.caja('blancoFino', s * 0.41, 0.36, z, 0.02, 0.62, 0.05);
  fis.caja(O.x, 0.45, O.z + (z0 - 1.4 + z1 + 2) / 2, 0.9, 0.9, z0 - 1.4 - z1 - 2, 0, { tipo: 'muro' });
  // barandas blancas a los costados (tubo de 2 rieles) con pilares; frente de la zona de pistas abierta (se entra por los pasillos)
  for (const s of [-1, 1]) {
    const x = s * xR;
    for (const y of [0.55, 1.0]) J.add('blanco', new THREE.CylinderGeometry(0.035, 0.035, z0 - z1, 8).rotateX(Math.PI / 2).translate(x, y, (z0 + z1) / 2));
    for (let z = z0; z >= z1; z -= 2.5) J.add('blanco', new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8).translate(x, 0.5, z));
    fis.caja(O.x + x, 0.55, O.z + (z0 + z1) / 2, 0.12, 1.1, z0 - z1, 0, { tipo: 'baranda' });
  }
  // 16-11 (Diego): sin la baranda delantera (mirador): cruzaba la línea de lanzamiento e impedía jugar; quedan las de los costados
  // pilares blancos hasta las vigas del cielo, con ménsulas; vigas transversales
  for (const z of zs) {
    for (const x of xs) {
      J.caja('blanco', x, H / 2, z, 0.24, H, 0.24); J.caja('blanco', x, 0.15, z, 0.34, 0.3, 0.34);
      for (const s of [-1, 1]) J.caja('blanco', x + s * 0.35, H - 0.75, z, 0.1, 0.9, 0.1, 0, 0, s * 0.7);
      if (x) fis.caja(O.x + x, H / 2, O.z + z, 0.26, H, 0.26, 0, { tipo: 'muro' });
    }
    J.caja('blanco', 0, H - 0.18, z, W, 0.36, 0.3);
  }
  // lámparas globo (brazo rojo y globo blanco) en los pilares; extintores rojos en algunos
  const globos = [], JG = new Junta(), itG = [];   // C5 (L04): lampara_globo FINA (pivote en la cara del pilar); JG + kit_globos son su respaldo
  for (const z of zs) for (const x of xs) for (const s of x ? [-Math.sign(x)] : [-1, 1]) {
    const xa = x + s * 0.45;
    JG.caja('rojo', x + s * 0.24, 3.05, z, 0.42, 0.06, 0.06);
    JG.add('rojo', new THREE.CylinderGeometry(0.07, 0.09, 0.22, 10).translate(xa, 3.18, z));
    globos.push([xa, 3.48, z]); itG.push({ id: 'lampara_globo', x: O.x + x + s * 0.13, y: O.y + 3.05, z: O.z + z, ry: s * Math.PI / 2 });
  }
  const JX = new Junta(), itX = [];   // N0-UTIL3 (G8): extintores de malla (0,2×0,6×0,18) colgados del pilar; respaldo procedural en JX
  zs.forEach((z, i) => { if (i % 2 === 0) for (const x of [i % 4 ? -xR : 0]) {
    const zx = z + 0.17; itX.push({ id: 'extintor', x: O.x + x, y: O.y + 1.05, z: O.z + z + 0.215, ry: 0 });
    JX.add('rojo', new THREE.CylinderGeometry(0.1, 0.1, 0.55, 12).translate(x, 1.35, zx)); JX.add('fierro', new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8).translate(x, 1.68, zx));
    JX.caja('fierro', x, 1.6, zx + 0.11, 0.03, 0.03, 0.18); } });
  // zócalo de piedra gris (1,15 m) en los cuatro muros y moldura blanca arriba
  const zh = 1.15;
  for (const s of [-1, 1]) { J.caja('piedra', s * (W / 2 - 0.03), zh / 2, -L / 2, 0.06, zh, L); J.caja('blanco', s * (W / 2 - 0.05), zh + 0.04, -L / 2, 0.1, 0.08, L); }
  for (const z of [-0.03, -L + 0.03]) for (const s of [-1, 1]) { J.caja('piedra', s * (W / 4 + 1.1), zh / 2, z, W / 2 - 2.2, zh, 0.06); J.caja('blanco', s * (W / 4 + 1.1), zh + 0.04, z, W / 2 - 2.2, 0.08, 0.1); }
  // ventanas de guillotina a ambos lados (marco blanco, luz del día), entre los pilares
  const vent = [];
  for (const s of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) vent.push([s, (zs[i] + zs[i + 1]) / 2]);
  vent.push([-1, -4.5], [1, -4.5]);
  for (const [s, z] of vent) {
    const x = s * (W / 2 - 0.04), w = 1.3, hv = 1.9, yc = zh + 0.35 + hv / 2;
    J.caja('dia', x + s * 0.012, yc, z, 0.02, hv, w);   // R-7: +1,2 cm hacia afuera (su cara coincidía con la del marco blanco)
    for (const dz of [-1, 1]) J.caja('blanco', x - s * 0.04, yc, z + dz * (w / 2 + 0.06), 0.1, hv + 0.2, 0.14);
    J.caja('blanco', x - s * 0.04, yc + hv / 2 + 0.1, z, 0.1, 0.16, w + 0.3); J.caja('blanco', x - s * 0.1, yc - hv / 2 - 0.06, z, 0.2, 0.08, w + 0.36);
    J.caja('blanco', x - s * 0.05, yc, z, 0.06, 0.07, w); J.caja('blanco', x - s * 0.05, yc, z, 0.05, hv, 0.04);
    for (const dy of [-hv / 4, hv / 4]) J.caja('blanco', x - s * 0.05, yc + dy, z, 0.04, 0.03, w);
  }
  // plafones del cielo (luz pareja) y mural del fondo tras los palos
  for (const z of [-12, -25, -38]) for (const x of [-3, 3]) J.caja('dia', x, H - 0.03, z, 1.2, 0.04, 0.5);
  J.caja('oscuro', 0, 1.2, -L + 0.09, 9.4, 1.4, 0.06);   // R-7: +4 cm (coplanar con la moldura blanca del zócalo)
  const gr = armarSala(J);
  g.add(gr);
  const mGl = new THREE.MeshBasicMaterial({ color: 0xfff4dc }), geoGl = new THREE.SphereGeometry(0.2, 14, 10);
  const ig = new THREE.InstancedMesh(geoGl, mGl, globos.length), m4 = new THREE.Matrix4();
  globos.forEach((p, i) => { m4.makeTranslation(...p); ig.setMatrixAt(i, m4); }); ig.computeBoundingSphere(); ig.name = 'kit_globos'; g.add(ig);
  // cuadros históricos (fotos sepia en marco oscuro) en los muros, entre ventanas y sobre el zócalo
  const tCuadro = k => texLienzo('cuadro' + k, 256, 192, (c, w, h) => {
    const r = azar(17 + k * 31); c.fillStyle = '#d9cdb2'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2116'; c.fillRect(14, 14, w - 28, h - 28);
    const gg = c.createLinearGradient(0, 14, 0, h - 14); gg.addColorStop(0, '#cdbb98'); gg.addColorStop(1, '#6f5c40'); c.fillStyle = gg; c.fillRect(20, 20, w - 40, h - 40);
    c.fillStyle = 'rgba(40,28,16,0.75)'; for (let i = 0; i < 9; i++) { const x = 24 + r() * (w - 60), y = 60 + r() * (h - 110), a = 10 + r() * 50; c.fillRect(x, y, a, (h - 40) - y - 6 * r()); }
    c.fillStyle = 'rgba(60,45,25,0.5)'; c.fillRect(20, h - 70, w - 40, 50);
  });
  let kq = 0;
  for (const s of [-1, 1]) for (let i = 0; i < zs.length; i += 2) {
    const z = zs[i] + (s > 0 ? 1.2 : -1.2), m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.56), new THREE.MeshStandardMaterial({ map: tCuadro(kq % 5), roughness: 0.8 })); if (kq % 5 < 2) planoUtil(m, 'cuadro_palit' + (kq % 5 + 1)); kq++;   // N0-UTIL3 (P3)
    m.position.set(O.x + s * (W / 2 - 0.06), 2.45, O.z + z); m.rotation.y = -s * Math.PI / 2; g.add(m);
  }
  const tMural = texLienzo('mural_bowling', 1024, 160, (c, w, h) => { c.fillStyle = '#1d2b44'; c.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { c.fillStyle = ['#c8372d', '#e9b949', '#2f8f6f', '#f2ead6'][i % 4]; c.fillRect(i * w / 12, h - 26, w / 12 - 6, 18); } c.fillStyle = '#f2ead6'; c.font = 'bold 74px Georgia, serif'; c.textAlign = 'center'; c.fillText('PALITROQUE · SEWELL', w / 2, 92); });
  const mu = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 1.1), new THREE.MeshBasicMaterial({ map: tMural })); mu.position.set(O.x, O.y + 4.95, O.z - L + 0.06)   /* N2-C34: sobre el marco de la puerta del fondo (remate a 4,2 m) */; g.add(mu);
  gr.position.copy(O); ig.position.copy(O);
  { const grG = armarSala(JG); grG.name = 'palit_resp_globo'; grG.position.copy(O); g.add(grG); montarEnKit(g, itG, { ocultar: [grG, ig] }); }   // C5 (L04)
  { const grX = armarSala(JX); grX.name = 'palit_resp_extintor'; grX.position.copy(O); g.add(grX); montarEnKit(g, itX, { ocultar: grX }); }   // N0-UTIL3 (G8)
  montarEnKit(g, [{ id: 'soporte_bolas', x: O.x - (W / 2 - 0.2), y: O.y, z: O.z - 8.5, ry: Math.PI / 2 }]).then(({ ok }) => { if (ok[0]) fis.caja(O.x - (W / 2 - 0.2), 0.25, O.z - 8.5, 0.34, 0.5, 0.95, 0, { tipo: 'mueble' }); });   // N0-UTIL3 (G8): soporte de bolas de repuesto en el pasillo oeste (decorado; el del bolero sigue en boleroJuega.js)
  // luz pareja de sala blanca (las caras blancas a contraluz se veían azul marino): una lámpara más junto a la entrada y luz ambiente cálida
  const l = new THREE.PointLight(0xfff3e0, 70, 26, 1.6); l.position.set(O.x, 4.6, O.z - 4); g.add(l);
  g.add(new THREE.AmbientLight(0xfff1dc, 0.55));
  return g;
}
// Iglesia (edificio 231) por dentro, N0-EMB8: fiel al video de Diego (assets3d/referencias/sewell/iglesia_video/, 18 cuadros).
// Nave central de 6,4 m entre muros (celeste, molduras blancas) con bóveda ojival de nervios celestes; a cada lado una arcada de medio punto
// sobre pilares cuadrados blancos con capitel y una nave lateral baja (plafón a 5,5 m) con ventanas en arco con abanico, repisas con flores,
// cuadros, relicarios ovalados, mesas con sillas y puertas blancas de tablero; San Lorenzo sobre pedestal con reja de fierro forjado.
// Coro alto en la entrada (baranda de balaustres, escalera de mano) con puerta ojival bajo él; bancas de madera oscura en dos filas;
// arco triunfal blanco sobre gradas curvas y presbiterio crema: gran crucifijo, altar de madera con cruz tallada, ambón, banderas de Chile y
// del Vaticano, candelabros, floreros y plafón redondo. Sin gente (respeta el duelo del N3). Local: x a lo ancho, z de 0 (entrada) a −largo.
function salaIglesia(S, O, fis) {
  const W = S.ancho, L = S.largo, H = S.alto, J = new Junta(), g = new THREE.Group(); g.name = 'kit_sala_iglesia';
  const PI = Math.PI, hw = W / 2, xp = 3.2, zT = -20, ySp = 3.3, yAi = 5.5, yV0 = 7.4;
  let sem = 91; const rnd = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  const B = (k, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => J.caja(k, x, y, z, sx, sy, sz, ry, rx, rz);
  const C = (k, r0, r1, h, x, y, z, seg = 12) => J.add(k, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z));
  const Sp = (k, r, x, y, z, ws = 10, hs = 8) => J.add(k, new THREE.SphereGeometry(r, ws, hs).translate(x, y, z));
  const F = (x, y, z, sx, sy, sz) => fis.caja(O.x + x, y, O.z + z, sx, sy, sz, 0, { tipo: 'muro' });
  const bx = (a, b, c) => new THREE.BoxGeometry(a, b, c);
  // N0-UTIL3 (G6): R(id, x, y, z, ry, esc) → Junta aparte con el respaldo procedural de esa pieza; al final montarEnKit pone la malla y lo oculta
  const RESP = new Map(), R = (id, x, y, z, ry = 0, esc) => { let e = RESP.get(id); if (!e) RESP.set(id, e = { JR: new Junta(), it: [] });
    e.it.push({ id, x: O.x + x, y: O.y + y, z: O.z + z, ry, esc }); return e.JR; };
  const RB = (JR) => (k, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => JR.caja(k, x, y, z, sx, sy, sz, ry, rx, rz), RC = (JR) => (k, r0, r1, h, x, y, z, seg = 12) => JR.add(k, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z)),
    RS = (JR) => (k, r, x, y, z, ws = 10, hs = 8) => JR.add(k, new THREE.SphereGeometry(r, ws, hs).translate(x, y, z));
  // P: pone una geometría LOCAL (+z = hacia el interior de la sala, +x = a lo largo del muro) en un muro. rot: lateral −sx·π/2, entrada π, fondo 0
  const P = (k, rot, X, Z, geo, dx = 0, dy = 0, dz = 0) => { geo.translate(dx, dy, dz); geo.rotateY(rot); geo.translate(X, 0, Z); J.add(k, geo); };
  const medio = (p, cx, y0, h, hR) => { p.moveTo(cx - h, y0); p.lineTo(cx - h, y0 + hR); p.absarc(cx, y0 + hR, h, PI, 0, true); p.lineTo(cx + h, y0); p.lineTo(cx - h, y0); return p; };
  const ojival = (p, cx, y0, h, hR, hA) => { const q = y0 + hR + (hA - hR) * 0.85; p.moveTo(cx - h, y0); p.lineTo(cx - h, y0 + hR); p.quadraticCurveTo(cx - h, q, cx, y0 + hA); p.quadraticCurveTo(cx + h, q, cx + h, y0 + hR); p.lineTo(cx + h, y0); p.lineTo(cx - h, y0); return p; };
  const ext = (sh, d) => new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 18 });

  const ramo = (x, y, z, n, Sq = Sp) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, rr = 0.03 + rnd() * 0.12, k = ['flor1', 'flor2', 'flor3'][Math.floor(rnd() * 3)]; Sq(k, 0.04 + rnd() * 0.03, x + Math.cos(a) * rr, y + 0.1 + rnd() * 0.22, z + Math.sin(a) * rr, 6, 5); }
    for (let i = 0; i < 3; i++) Sq('hoja', 0.05, x + (rnd() - 0.5) * 0.2, y + 0.04, z + (rnd() - 0.5) * 0.2, 5, 4); };
  // ============================================================ muros de la nave: arcada de medio punto + ventanas altas ojivales
  const pz = [0, -4.3, -8.3, -12.3, -16.3, zT], baha = [];   // ejes de pilares (los de los extremos son las esquinas)
  for (let k = 0; k < 5; k++) { const z0 = k === 0 ? -0.3 : pz[k] - 0.27, z1 = k === 4 ? zT + 0.3 : pz[k + 1] + 0.27; baha.push([z0, z1, (z0 + z1) / 2, (z0 - z1) / 2]); }
  { const sh = new THREE.Shape(); sh.moveTo(0, -0.1); sh.lineTo(-zT, -0.1); sh.lineTo(-zT, H); sh.lineTo(0, H); sh.lineTo(0, -0.1);   // R-7: el muro baja 10 cm bajo el piso (antes el canto del arco quedaba a y=0 y era una franja celeste coplanar con el piso: z-fighting)
    for (const [z0, z1, zc, hh] of baha) {
      sh.holes.push(medio(new THREE.Path(), -zc, -0.05, hh, ySp + 0.05));
      sh.holes.push(ojival(new THREE.Path(), -zc, 5.85, 0.5, 0.95, 1.5));
    }
    const ge = ext(sh, 0.45); ge.rotateY(PI / 2);
    for (const s of [-1, 1]) { const m = ge.clone(); m.translate(s * xp - 0.225, 0, 0); J.add('celeste', m); }
    ge.dispose();
    for (const [z0, z1, zc, hh] of baha) {   // molduras blancas de cada arco (anillo) y de cada ventana alta
      const rr = new THREE.Shape(); rr.absarc(-zc, ySp, hh + 0.2, 0, PI, false); rr.lineTo(-zc - hh + 0.02, ySp); rr.absarc(-zc, ySp, hh - 0.02, PI, 0, true); rr.lineTo(-zc + hh + 0.2, ySp);
      const g1 = ext(rr, 0.53); g1.rotateY(PI / 2);
      for (const s of [-1, 1]) { const m = g1.clone(); m.translate(s * xp - 0.265, 0, 0); J.add('blanco', m); }
      g1.dispose();
      // vidrio y marco de la ventana alta (el vidrio en el centro del muro; luz de día)
      const vi = ojival(new THREE.Shape(), 0, 5.85, 0.5, 0.95, 1.5);
      const mk = ojival(new THREE.Shape(), 0, 5.77, 0.58, 1.03, 1.65); mk.holes.push(ojival(new THREE.Path(), 0, 5.85, 0.5, 0.95, 1.5));
      for (const s of [-1, 1]) {
        P('dia', s * PI / 2 * -1, s * xp, zc, new THREE.ShapeGeometry(vi, 12));
        P('blanco', s * PI / 2 * -1, s * (xp - 0.2), zc, ext(mk, 0.04), 0, 0, 0);
        P('blanco', s * PI / 2 * -1, s * (xp + 0.2), zc, ext(mk, 0.04), 0, 0, -0.04);
        P('blanco', -s * PI / 2, s * (xp - 0.03), zc, bx(0.04, 1.8, 0.05), 0, 6.75, 0.0);   // parteluz
        P('blanco', -s * PI / 2, s * (xp - 0.03), zc, bx(1.0, 0.04, 0.05), 0, 6.5, 0.0);
      }
    }
  }
  // pilares cuadrados blancos con base y capitel; colisiones
  for (let i = 1; i <= 4; i++) for (const s of [-1, 1]) {
    const x = s * xp, z = pz[i];
    B('blanco', x, 1.8, z, 0.62, 3.2, 0.56); B('blanco', x, 0.15, z, 0.76, 0.3, 0.68); B('blanco', x, 0.34, z, 0.68, 0.08, 0.6);
    B('blanco', x, 3.2, z, 0.72, 0.14, 0.64); B('blanco', x, 3.34, z, 0.8, 0.12, 0.72);
    // R-7: las «acanaladuras» (cajas de 4 cm que sobresalían 2 cm de las caras del pilar) eran astillas que centelleaban al caminar: eliminadas
    F(x, 1.7, z, 0.7, 3.4, 0.6);
  }
  for (const s of [-1, 1]) {   // cornisas y base blanca
    F(s * xp, (5.3 + H) / 2, zT / 2, 0.45, H - 5.3, -zT);
    B('blanco', s * (xp - 0.25), yAi + 0.02, zT / 2, 0.16, 0.16, -zT); B('blanco', s * (xp + 0.25), yAi + 0.02, zT / 2, 0.16, 0.16, -zT);
    B('blanco', s * (xp - 0.25), 0.25, zT / 2 - 0.0, 0.06, 0.5, -zT + 0.8);
    B('blanco', s * (hw - 0.04), yAi - 0.05, zT / 2, 0.1, 0.18, -zT); B('blanco', s * (hw - 0.03), 1.1, zT / 2, 0.06, 0.05, -zT);   // cornisa y línea de zócalo de la nave lateral
  }
  // plafón de las naves laterales (con vigas blancas en cada pilar)
  for (const s of [-1, 1]) {
    B('plafon', s * (xp + hw) / 2, yAi + 0.05, zT / 2, hw - xp, 0.1, -zT);
    for (const z of pz.slice(1, 5)) B('blanco', s * (xp + hw) / 2, yAi - 0.08, z, hw - xp, 0.14, 0.3);
  }
  // bóveda ojival de la nave (superficie) y nervios celestes
  { const a = xp - 0.225, hh = H - 0.05 - yV0, cx = (hh * hh - a * a) / (2 * a), R = a + cx, th1 = Math.acos(-cx / R), n = 12, pts = [];
    for (let i = 0; i <= n; i++) { const t = PI + (th1 - PI) * i / n; pts.push([cx + R * Math.cos(t), yV0 + R * Math.sin(t)]); }
    const der = pts.map(([x, y]) => [-x, y]).reverse().slice(1), perfil = [...pts, ...der];
    for (let i = 0; i < perfil.length - 1; i++) {
      const [x0, y0] = perfil[i], [x1, y1] = perfil[i + 1];
      J.quad('plafon', [x0, y0, 0], [x0, y0, zT], [x1, y1, zT], [x1, y1, 0]);
      for (const z of pz) { const l = Math.hypot(x1 - x0, y1 - y0) + 0.02; B('celesteN', (x0 + x1) / 2, (y0 + y1) / 2 - 0.05, Math.min(-0.15, Math.max(zT + 0.15, z)), l, 0.16, 0.26, 0, 0, Math.atan2(y1 - y0, x1 - x0)); }
    }
    B('blanco', 0, H - 0.1, zT / 2, 0.2, 0.1, -zT);   // cumbrera
  }

  // ============================================================ muro de entrada, puerta ojival, coro
  { const rot = PI;   // entrada: local +z hacia −z
    const dp = ojival(new THREE.Path(), 0, -0.05, 0.95, 2.05, 3.05);   // R-7: el vano baja 5 cm bajo el piso (si no, su canto inferior quedaba coplanar con el piso)
    const sh = new THREE.Shape(); sh.moveTo(-hw, -0.1); sh.lineTo(hw, -0.1); sh.lineTo(hw, H); sh.lineTo(-hw, H); sh.lineTo(-hw, -0.1); sh.holes.push(dp);
    const fm = ojival(new THREE.Shape(), 0, 0, 1.12, 2.0, 3.18); fm.holes.push(ojival(new THREE.Path(), 0, 0, 0.95, 2.0, 3.0));
    P('blanco', rot, 0, 0, ext(fm, 0.09), 0, 0, 0.0);
    P('rosa', rot, 0, 0, new THREE.ShapeGeometry(ojival(new THREE.Shape(), 0, 2.55, 0.85, 0.0, 0.42), 8), 0, 0, 0.0);
    for (const sx of [-1, 1]) {   // hojas blancas de tablero
      P('blanco', rot, 0, 0, bx(0.9, 2.55, 0.05), sx * 0.46, 1.275, 0.07);
      for (const dy of [0.55, 1.4, 2.1]) P('blanco', rot, 0, 0, bx(0.62, dy === 2.1 ? 0.5 : 0.62, 0.03), sx * 0.46, dy, 0.1);
      P('bronce', rot, 0, 0, bx(0.04, 0.16, 0.05), sx * 0.12, 1.1, 0.12);
    }
    const w1 = ojival(new THREE.Shape(), 0, 5.0, 0.8, 1.7, 3.0), w2 = ojival(new THREE.Shape(), 0, 4.92, 0.9, 1.78, 3.15); w2.holes.push(ojival(new THREE.Path(), 0, 5.0, 0.8, 1.7, 3.0));
    P('dia', rot, 0, 0, new THREE.ShapeGeometry(w1, 12), 0, 0, 0.012); P('blanco', rot, 0, 0, ext(w2, 0.08), 0, 0, 0);
    P('blanco', rot, 0, 0, bx(0.05, 3.0, 0.05), 0, 6.5, 0.05); P('blanco', rot, 0, 0, bx(1.6, 0.05, 0.05), 0, 6.6, 0.05);
  }
  { const yD = 3.25, zF = -4.0;   // coro: losa, viga con moldura, baranda de balaustres, escalera de mano
    B('plafon', 0, yD - 0.1, zF / 2, 2 * xp, 0.3, -zF); B('blanco', 0, yD - 0.15, zF - 0.05, 2 * xp + 0.3, 0.5, 0.18); B('blanco', 0, yD + 0.12, zF - 0.05, 2 * xp + 0.4, 0.06, 0.26);
    F(0, yD - 0.1, zF / 2, 2 * xp, 0.3, -zF);
    for (const [x0, z0, x1, z1] of [[-xp + 0.1, zF + 0.05, xp - 0.1, zF + 0.05], [-xp + 0.1, -0.1, -xp + 0.1, zF + 0.05], [xp - 0.1, -0.1, xp - 0.1, zF + 0.05]]) {
      const l = Math.hypot(x1 - x0, z1 - z0), n = Math.round(l / 0.19);
      B('blanco', (x0 + x1) / 2, yD + 1.05, (z0 + z1) / 2, x1 === x0 ? 0.1 : l, 0.07, x1 === x0 ? l : 0.1); B('blanco', (x0 + x1) / 2, yD + 0.22, (z0 + z1) / 2, x1 === x0 ? 0.1 : l, 0.06, x1 === x0 ? l : 0.1);
      for (let i = 0; i <= n; i++) { const t = i / n; C(i % 8 === 0 ? 'blanco' : 'blanco', i % 8 === 0 ? 0.05 : 0.027, i % 8 === 0 ? 0.05 : 0.027, 0.83, x0 + (x1 - x0) * t, yD + 0.63, z0 + (z1 - z0) * t, 6); }
    }
    const xl = -xp + 0.5; for (const dx of [-0.1, 0.1]) B('maderaClara', xl + dx, 2.0, zF - 0.2, 0.05, 4.0, 0.06);   // escalera de mano
    for (let y = 0.3; y < 3.8; y += 0.3) B('maderaClara', xl, y, zF - 0.2, 0.2, 0.04, 0.05);
  }
  // pilares-esquina de la entrada
  // ============================================================ arco triunfal y presbiterio
  { const rA = 2.9, yA = 3.6, d = 0.5;
    const sh = new THREE.Shape(); sh.moveTo(-hw, -0.1); sh.lineTo(hw, -0.1); sh.lineTo(hw, H); sh.lineTo(-hw, H); sh.lineTo(-hw, -0.1); sh.holes.push(medio(new THREE.Path(), 0, -0.05, rA, yA + 0.05));   // R-7: idem (canto del arco bajo el piso)
    J.add('celeste', ext(sh, d).translate(0, 0, zT - d + 0.25));
    const rr = new THREE.Shape(); rr.absarc(0, yA, rA + 0.32, 0, PI, false); rr.lineTo(-rA + 0.02, yA); rr.absarc(0, yA, rA - 0.02, PI, 0, true); rr.lineTo(rA + 0.32, yA);
    J.add('blanco', ext(rr, 0.62).translate(0, 0, zT - d + 0.25 - 0.06)); B('blanco', 0, yA + rA + 0.45, zT + 0.35, 0.5, 0.2, 0.2);
    F(-(hw + rA) / 2, H / 2, zT, hw - rA, H, d); F((hw + rA) / 2, H / 2, zT, hw - rA, H, d); F(0, (yA + rA + H) / 2, zT, 2 * rA, H - yA - rA, d);
    for (const s of [-1, 1]) { const x = s * (rA + 0.1);   // pilastras dobles del arco
      B('blanco', x, 1.85, zT + 0.45, 0.62, 3.6, 0.6); B('blanco', x, 0.18, zT + 0.45, 0.78, 0.36, 0.74); B('blanco', x, 3.7, zT + 0.45, 0.78, 0.16, 0.74); B('blanco', x, 3.84, zT + 0.45, 0.86, 0.12, 0.8);
      F(x, 1.9, zT + 0.45, 0.8, 3.8, 0.76); }
  }
  // presbiterio: muros crema, plafón con luminaria redonda, gradas curvas, estrado
  const yE = 0.45, zE = -22.4;
  for (const s of [-1, 1]) { B('crema', s * 3.0, 3.45, -22.2, 0.08, 6.9, 3.9); F(s * 3.05, 3.4, -22.2, 0.2, 6.8, 3.9); B('blanco', s * 2.95, 0.5, -22.2, 0.06, 1.0, 3.9); B('blanco', s * 2.93, 1.02, -22.2, 0.08, 0.05, 3.9); }
  B('crema', 0, 3.45, zT - 4 + 0.04, 6.1, 6.9, 0.08); B('blanco', 0, 0.5, zT - 4 + 0.08, 5.9, 1.0, 0.04); B('blanco', 0, 1.02, zT - 4 + 0.09, 5.9, 0.05, 0.06);
  B('plafon', 0, 6.95, -22.2, 6.1, 0.1, 3.9); B('blanco', 0, 6.82, -22.2, 6.1, 0.14, 0.2);
  C('blanco', 0.62, 0.62, 0.07, 0, 6.88, -22.4, 28); C('lampara', 0.5, 0.5, 0.04, 0, 6.82, -22.4, 28);
  const steps = [[3.15, 0.15], [2.8, 0.3], [2.45, yE]];
  steps.forEach(([R, h], i) => {
    J.add('grada', new THREE.CylinderGeometry(R, R, h, 32, 1, false, -PI / 2, PI).translate(0, h / 2, zT + 0.4));
    for (let x = -R + 0.25; x < R; x += 0.5) { const zz = Math.sqrt(Math.max(0, R * R - x * x)); if (zz > 0.1) F(x, h / 2, zT + 0.4 + zz / 2, 0.52, h, zz); }
  });
  B('grada', 0, yE / 2, (zT + 0.4 + zT - 4) / 2, 6.0, yE, 4.4); F(0, yE / 2, (zT + 0.4 + zT - 4) / 2, 6.0, yE, 4.4);
  // gran crucifijo de madera oscura con el Cristo
  { const z = zT - 3.78, yc = 4.35;
    J.caja('hierro', -0.35, yc + 1.6, z, 0.02, 0.6, 0.02); J.caja('hierro', 0.35, yc + 1.6, z, 0.02, 0.6, 0.02);   // tiros
    const JX = R('crucifijo', 0, yc - 1.3, zT - 3.765, 0, [1.08, 1.08, 1.08]), B = RB(JX), Sp = RS(JX);   // N0-UTIL3 (G6): crucifijo de malla 1,5×2,6 m colgado de los tiros
    B('maderaOsc', 0, yc, z, 0.22, 2.6, 0.1); B('maderaOsc', 0, yc + 0.55, z, 1.5, 0.2, 0.1);
    B('talla', 0, yc + 0.1, z + 0.07, 0.22, 0.85, 0.07); B('talla', 0, yc + 0.55, z + 0.07, 1.25, 0.1, 0.06); Sp('talla', 0.1, 0, yc + 0.78, z + 0.1);
    B('maderaOsc', 0, yc - 0.3, z + 0.08, 0.26, 0.2, 0.06); B('talla', 0, yc - 0.65, z + 0.07, 0.14, 0.4, 0.06);
  }
  // altar de madera con cruz tallada al frente; mesa trasera blanca con candelabros, floreros y crucifijos
  { const z = zE + 0.2, y = yE;
    { const B = RB(R('altar', 0, y, z, 0, [1, 1.08, 1]));   // N0-UTIL3 (G6): altar de malla 2,0×1,08×0,8
    B('altar', 0, y + 0.52, z, 1.9, 1.04, 0.75); B('altarClaro', 0, y + 1.06, z, 2.05, 0.06, 0.88);
    B('altarOsc', 0, y + 0.55, z + 0.385, 0.1, 0.55, 0.02); B('altarOsc', 0, y + 0.66, z + 0.385, 0.38, 0.1, 0.02);
    for (const sx of [-1, 1]) B('altarOsc', sx * 0.7, y + 0.55, z + 0.38, 0.5, 0.75, 0.02); }
    F(0, y + 0.52, z, 1.9, 1.04, 0.75);
    const zb = zT - 3.3;
    B('blanco', 0, y + 0.5, zb, 2.6, 1.0, 0.5); B('blanco', 0, y + 1.02, zb, 2.7, 0.05, 0.6); F(0, y + 0.5, zb, 2.6, 1.0, 0.5);
    const yt = y + 1.05;
    for (const sx of [-1, 1]) { const x = sx * 1.05;   // candelabros negros de 3 brazos con velas, y floreros con ramos · C5 (I05): FINOS candelabro_3 y florero_ramo; lo de abajo es su respaldo
      { const JK = R('candelabro_3', x, yt, zb, 0), B = RB(JK), C = RC(JK), Sp = RS(JK);
      C('hierro', 0.04, 0.08, 0.1, x, yt + 0.05, zb); C('hierro', 0.012, 0.012, 0.32, x, yt + 0.26, zb); B('hierro', x, yt + 0.4, zb, 0.28, 0.02, 0.02);
      for (const dx of [-0.14, 0, 0.14]) { C('vela', 0.012, 0.012, 0.1, x + dx, yt + 0.47, zb); Sp('llama', 0.016, x + dx, yt + 0.55, zb, 6, 5); } }
      const x2 = sx * 0.55, JF = R('florero_ramo', x2, yt, zb, sx); RC(JF)('florero', 0.04, 0.07, 0.18, x2, yt + 0.09, zb); ramo(x2, yt + 0.18, zb, 7, RS(JF));
    }
    C('hierro', 0.015, 0.03, 0.18, 0, yt + 0.09, zb); B('hierro', 0, yt + 0.28, zb, 0.02, 0.2, 0.02); B('hierro', 0, yt + 0.32, zb, 0.12, 0.02, 0.02);
    B('azulRug', 0, yE + 0.02, zE + 1.0, 1.9, 0.03, 1.2);   // R-7: tope a +3,5 cm (antes 1 cm, coplanar con el estrado)   // alfombrilla celeste del estrado
  }
  // ambón de madera a la izquierda, con micrófono y lamparita
  { const x = -2.25, z = -21.2, JA = R('ambon', x, yE, z, 0, [1.2, 1.1, 1.2]), B = RB(JA), C = RC(JA);   // N0-UTIL3 (G6): ambón de malla 0,72×1,32×0,6 (el micrófono va con el respaldo)
    B('altar', x, yE + 0.62, z, 0.78, 1.24, 0.58); B('altarClaro', x, yE + 1.27, z + 0.02, 0.9, 0.05, 0.7, 0, -0.28); B('altarOsc', x + 0.0, yE + 0.6, z + 0.296, 0.5, 0.75, 0.02);
    C('hierro', 0.008, 0.008, 0.5, x + 0.1, yE + 1.55, z - 0.1, 6); B('hierro', x + 0.1, yE + 1.8, z - 0.1, 0.02, 0.02, 0.2, 0, 0.2); C('hierro', 0.025, 0.02, 0.1, x + 0.1, yE + 1.82, z + 0.02, 8);
    F(x, yE + 0.62, z, 0.78, 1.24, 0.58);
  }
  // banderas: Chile (izquierda) y del Vaticano (derecha) en mástiles
  const flags = [];
  for (const [sx, tipo] of [[-1, 'chile'], [1, 'papal']]) { const x = sx * 2.55, z = zT - 3.6;
    C('bronce', 0.025, 0.025, 4.2, x, yE + 2.1, z, 8); Sp('bronce', 0.05, x, yE + 4.25, z, 8, 6); C('bronce', 0.1, 0.14, 0.1, x, yE + 0.05, z, 10);
    flags.push([x, yE + 3.9, z, tipo, sx]);
  }
  // ============================================================ bancas de madera oscura, dos filas con pasillo central
  const bancas = [];   // N0-UTIL: posiciones para la banca de TRELLIS (se cambia cuando carga la utilería; respaldo: la de cajas)
  for (let i = 0; i < 10; i++) for (const s of [-1, 1]) {
    const xc = s * 1.85, z = -5.5 - i * 1.1, lg = 1.9;   // R-7: antes xc 1,95/lg 2,1: la banca se metía 11 cm en los pilares (cara coplanar)
    bancas.push([xc, z, lg]);
    B('banca', xc, 0.46, z, lg, 0.07, 0.42); B('banca', xc, 0.84, z + 0.25, lg, 0.7, 0.06); B('banca', xc, 1.22, z + 0.25, lg, 0.06, 0.1);
    B('banca', xc, 0.14, z - 0.4, lg, 0.1, 0.3); B('banca', xc, 0.08, z - 0.3, lg, 0.16, 0.05);
    for (const dx of [-1, 1]) { B('banca', xc + dx * (lg / 2), 0.55, z - 0.02, 0.07, 1.1, 0.68); B('banca', xc + dx * (lg / 2), 1.12, z + 0.2, 0.09, 0.12, 0.2); }
    F(xc, 0.5, z - 0.03, lg, 1.0, 0.78);
  }
  // ============================================================ naves laterales: ventanas en arco, repisas, cuadros, relicarios, puertas, mesas, San Lorenzo
  const zb = [-2.15, -6.3, -10.3, -14.3, -18.1];
  const ventana = (rot, X, Z, y0 = 1.6, w = 1.0, hR = 1.35, dz = 0) => {
    const r = w / 2, vi = medio(new THREE.Shape(), 0, y0, r, hR);
    P('dia', rot, X, Z, new THREE.ShapeGeometry(vi, 14), 0, 0, 0.012 + dz);
    const so = new THREE.Shape(); so.moveTo(-r - 0.17, y0 - 0.1); so.lineTo(-r - 0.17, y0 + hR); so.absarc(0, y0 + hR, r + 0.17, PI, 0, true); so.lineTo(r + 0.17, y0 - 0.1); so.lineTo(-r - 0.17, y0 - 0.1);
    so.holes.push(medio(new THREE.Path(), 0, y0, r, hR)); P('blanco', rot, X, Z, ext(so, 0.07), 0, 0, dz);
    P('blanco', rot, X, Z, bx(w, 0.045, 0.05), 0, y0 + hR, 0.03 + dz); P('blanco', rot, X, Z, bx(w, 0.04, 0.05), 0, y0 + hR * 0.5, 0.03 + dz); P('blanco', rot, X, Z, bx(0.04, hR, 0.05), 0, y0 + hR / 2, 0.03 + dz);
    for (const a of [-1.0, -0.5, 0, 0.5, 1.0]) { const gg = new THREE.BoxGeometry(0.03, r, 0.05); gg.translate(0, r / 2, 0); gg.rotateZ(a); P('blanco', rot, X, Z, gg, 0, y0 + hR, 0.03 + dz); }
    P('blanco', rot, X, Z, bx(w + 0.5, 0.07, 0.22), 0, y0 - 0.13, 0.11 + dz);
  };
  const repisa = (s, z, y, w = 0.9) => {   // repisa blanca con ménsulas, ramos de flores y florero · C5 (I06): FINO repisa_flores (pivote en el muro); lo de abajo es su respaldo
    const JP = R('repisa_flores', s * hw, y, z, -s * PI / 2, [w / 0.9, 1, 1]), B = RB(JP), C = RC(JP);
    const x = s * (hw - 0.14); B('blanco', x, y, z, 0.28, 0.05, w); for (const dz of [-w * 0.38, w * 0.38]) B('blanco', x + s * 0.04, y - 0.1, z + dz, 0.2, 0.14, 0.04);
    C('florero', 0.05, 0.08, 0.2, x, y + 0.12, z - w * 0.2); ramo(x, y + 0.22, z - w * 0.2, 8, RS(JP)); C('florero', 0.04, 0.06, 0.16, x, y + 0.1, z + w * 0.22); ramo(x, y + 0.18, z + w * 0.22, 6, RS(JP));
  };
  const icono = k => texLienzo('ig8_icono' + k, 128, 160, (c, w, h) => {
    const fondos = ['#d6c9a8', '#8fb6c9', '#c9a98f', '#a9c5a0', '#e6d9c0']; c.fillStyle = fondos[k % 5]; c.fillRect(0, 0, w, h);
    c.fillStyle = ['#b8423a', '#2f5d8a', '#d9a441', '#6b4a8c'][k % 4]; c.beginPath(); c.arc(w / 2, h * 0.42, 24, 0, 7); c.fill();
    c.fillStyle = '#f0d3b0'; c.beginPath(); c.arc(w / 2, h * 0.3, 11, 0, 7); c.fill(); c.fillStyle = ['#2f5d8a', '#b8423a'][k % 2]; c.fillRect(w / 2 - 22, h * 0.52, 44, 52);
    if (k % 3 === 0) { c.strokeStyle = '#e8c860'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, h * 0.26, 16, 0, 7); c.stroke(); }
  });
  const cuadro = (s, z, y, w, h, k, oval) => {   // cuadro o relicario ovalado sobre el muro lateral
    const x = s * (hw - 0.025), rotY = -s * PI / 2;
    const geoM = oval ? new THREE.CircleGeometry(0.5, 24) : new THREE.PlaneGeometry(1, 1), geoP = oval ? new THREE.CircleGeometry(0.5, 24) : new THREE.PlaneGeometry(1, 1);
    const mm = new THREE.Mesh(geoM.scale(w + 0.1, h + 0.1, 1), matsExtra.marco); mm.position.set(x, y, z); mm.rotation.y = rotY; g.add(mm);
    const mp = new THREE.Mesh(geoP.scale(w, h, 1), new THREE.MeshStandardMaterial({ map: icono(k), roughness: 0.7, polygonOffset: !/[?&]r8=0/.test(globalThis.location?.search || ''), polygonOffsetFactor: 0, polygonOffsetUnits: -24 })); mp.position.set(x - s * 0.006, y, z); mp.rotation.y = rotY; g.add(mp);
    if (oval ? k === 8 : k === 4) planoUtil(mp, oval ? 'relicario' : 'cuadro_iglesia');   // N0-UTIL3 (P3): dos relicarios (k 8) y el cuadro grande con pintura de Qwen
  };
  const matsExtra = { marco: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.5, metalness: 0.2, polygonOffset: !/[?&]r8=0/.test(globalThis.location?.search || ''), polygonOffsetFactor: 0, polygonOffsetUnits: -16 })   /* R-8: cuadro sobre marco sobre muro */ };
  // ventanas, repisas y cuadros por tramo
  for (const s of [-1, 1]) {
    const rot = -s * PI / 2, Xw = s * hw;
    zb.forEach((z, i) => { ventana(rot, Xw, z); });
    for (const z of [-4.3, -8.3, -12.3, -16.3]) cuadro(s, z, 2.6, 0.32, 0.42, Math.abs(z) | 0, true);
  }
  // este: ... bay 2 = San Lorenzo con su pedestal y reja; bay 1 = mesa con sillas; resto, repisas y cuadros
  repisa(1, zb[1] + 1.25, 1.35, 0.7); cuadro(1, zb[1] - 1.25, 1.9, 0.4, 0.55, 2, false); cuadro(1, zb[0] + 1.25, 1.9, 0.4, 0.5, 5, false); repisa(1, zb[3] + 1.25, 1.35); cuadro(1, zb[3] - 1.25, 1.9, 0.45, 0.6, 7, false); cuadro(1, zb[2] - 1.35, 2.0, 0.3, 0.4, 3, true);
  // oeste: repisas con flores y cuadros, puerta blanca de tablero en el tramo 3, mesa con sillas en el 4, diario mural
  repisa(-1, zb[2] + 1.25, 1.35); cuadro(-1, zb[2] - 1.3, 1.9, 0.5, 0.65, 4, false); repisa(-1, zb[0] - 1.2, 1.35, 0.7); cuadro(-1, zb[1] + 1.3, 1.9, 0.4, 0.55, 8, false);
  repisa(-1, zb[4] + 1.2, 1.35, 0.8); cuadro(-1, zb[4] - 1.2, 1.9, 0.4, 0.5, 6, true);
  const puerta = (s, z) => {
    const rot = -s * PI / 2, Xw = s * hw, w = 1.0, h = 2.2;
    P('blanco', rot, Xw, z, bx(w + 0.28, h + 0.14, 0.05), 0, (h + 0.14) / 2, 0.025); P('blanco', rot, Xw, z, bx(w, h, 0.06), 0, h / 2, 0.06);
    for (const [dx, dy, ww, hh] of [[-0.22, 0.55, 0.36, 0.7], [0.22, 0.55, 0.36, 0.7], [-0.22, 1.65, 0.36, 0.7], [0.22, 1.65, 0.36, 0.7]]) P('blancoSombra', rot, Xw, z, bx(ww, hh, 0.02), dx, dy + 0.1, 0.1);
    P('bronce', rot, Xw, z, bx(0.04, 0.04, 0.1), 0.38, 1.05, 0.12); P('blanco', rot, Xw, z, bx(w + 0.3, 0.1, 0.12), 0, h + 0.15, 0.06);
    P('grada', rot, Xw, z, bx(w + 0.5, 0.1, 0.3), 0, 0.05, 0.2);
  };
  puerta(-1, zb[3]); puerta(1, zb[4]);
  { const rot = PI / 2, Xw = -hw, z = zb[1] - 0.0;   // diario mural y extintor (oeste, tramo 2)
    P('maderaClara', rot, Xw, z - 1.3, bx(0.7, 0.9, 0.04), 0, 1.7, 0.04); P('papel', rot, Xw, z - 1.3, bx(0.6, 0.8, 0.02), 0, 1.7, 0.07);
    { const JE = R('extintor', -hw + 0.1, 0.62, z + 1.5, PI / 2, [0.8, 0.8, 0.8]); RC(JE)('rojo', 0.07, 0.07, 0.4, -hw + 0.12, 0.85, z + 1.5, 10); RB(JE)('hierro', -hw + 0.05, 1.12, z + 1.5, 0.05, 0.14, 0.03); } }   // N0-UTIL3 (G8): extintor de malla
  const mesa = (x, z, ang, sillas) => {
    const rp = (dx, dz) => [x + dx * Math.cos(ang) + dz * Math.sin(ang), z - dx * Math.sin(ang) + dz * Math.cos(ang)];
    { const JM = R('mesa_iglesia', x, 0, z, ang), B = RB(JM), C = RC(JM);   // C5 (I07): mesa y sillas FINAS; las cajas son su respaldo
    B('mesaTop', x, 0.74, z, 0.7, 0.04, 1.0, ang); for (const [dx, dz] of [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]]) { const [px, pz2] = rp(dx, dz); C('hierro', 0.018, 0.018, 0.72, px, 0.36, pz2, 6); } }
    F(x, 0.4, z, 0.8, 0.8, 1.1);
    for (const [dx, dz, fa] of sillas) { const [px, pz2] = rp(dx, dz), a = ang + fa, JS = R('silla_iglesia', px, 0, pz2, a), B = RB(JS), C = RC(JS);
      B('silla', px, 0.46, pz2, 0.4, 0.04, 0.4, a); const bxp = px - Math.sin(a) * 0.19, bzp = pz2 - Math.cos(a) * 0.19; B('silla', bxp, 0.75, bzp, 0.4, 0.34, 0.03, a);
      for (const [ax, az] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) { C('hierro', 0.013, 0.013, 0.46, px + ax * Math.cos(a) + az * Math.sin(a), 0.23, pz2 - ax * Math.sin(a) + az * Math.cos(a), 5); } }
  };
  mesa(4.95, zb[1] + 0.2, PI / 2 * 0, [[0, 0.8, PI], [-0.75, 0, PI / 2 * 3], [0, -0.8, 0]]);
  mesa(-4.95, zb[4] + 0.3, 0, [[0, 0.8, PI], [0.75, 0, PI / 2], [0, -0.8, 0]]);
  // San Lorenzo (patrono de los mineros) sobre pedestal blanco con reja de fierro forjado blanca; mesita con velas votivas
  { const xs = 4.95, zs = zb[2] - 0.2, yP = 0.95;
    B('blanco', xs, yP / 2, zs, 1.0, yP, 1.0); B('blanco', xs, yP + 0.03, zs, 1.12, 0.07, 1.12); B('blanco', xs, 0.06, zs, 1.12, 0.12, 1.12); F(xs, yP / 2, zs, 1.1, yP, 1.1);
    { const JL = R('san_lorenzo', xs, yP + 0.065, zs, -PI / 2, [0.9, 0.9, 0.9]), B = RB(JL), C = RC(JL), Sp = RS(JL);   // N0-UTIL3 (G6): imagen de malla (1,7 m) mirando a la nave
    C('base', 0.34, 0.36, 0.1, xs, yP + 0.12, zs, 8);
    const x0 = xs - 0.0;
    C('sotana', 0.17, 0.27, 0.62, x0, yP + 0.47, zs, 14); C('sobrepelliz', 0.2, 0.25, 0.4, x0, yP + 0.78, zs, 14); C('dalmatica', 0.19, 0.2, 0.46, x0, yP + 1.18, zs, 14);
    B('estola', x0 - 0.18, yP + 0.95, zs, 0.04, 0.95, 0.26); B('estola', x0 - 0.2, yP + 0.95, zs, 0.02, 0.2, 0.2);
    Sp('dalmatica', 0.2, x0, yP + 1.4, zs, 12, 8); Sp('piel', 0.1, x0, yP + 1.62, zs, 12, 10); Sp('cabello', 0.105, x0 + 0.015, yP + 1.65, zs, 12, 8);
    for (const dz of [-1, 1]) { B('dalmatica', x0 - 0.1, yP + 1.2, zs + dz * 0.22, 0.14, 0.4, 0.1, 0, 0, dz * 0.25); B('sobrepelliz', x0 - 0.16, yP + 1.0, zs + dz * 0.27, 0.12, 0.2, 0.1); }
    B('hoja', x0 - 0.2, yP + 1.28, zs + 0.3, 0.02, 0.55, 0.02, 0, 0, -0.3); for (const dy of [0.25, 0.35]) Sp('flor3', 0.035, x0 - 0.12, yP + 1.28 + dy, zs + 0.36, 6, 5);
    B('negro', x0 - 0.2, yP + 1.0, zs - 0.28, 0.2, 0.26, 0.05); }
    // reja: tres lados (oeste, norte, sur) con barrotes, travesaños y volutas
    const h = 0.95, xr = xs - 0.75, zn = zs - 0.75, zS = zs + 0.75, lados = [[xr, zn, xr, zS], [xr, zn, hw - 0.05, zn], [xr, zS, hw - 0.05, zS]];
    for (const [ax, az, bx2, bz2] of lados) { const l = Math.hypot(bx2 - ax, bz2 - az), n = Math.max(2, Math.round(l / 0.16));
      const mx = (ax + bx2) / 2, mz = (az + bz2) / 2, alongX = Math.abs(bx2 - ax) > Math.abs(bz2 - az);
      B('blancoFino', mx, h, mz, alongX ? l : 0.04, 0.04, alongX ? 0.04 : l); B('blancoFino', mx, 0.12, mz, alongX ? l : 0.03, 0.03, alongX ? 0.03 : l); B('blancoFino', mx, h * 0.55, mz, alongX ? l : 0.025, 0.025, alongX ? 0.025 : l);
      for (let i = 0; i <= n; i++) { const t = i / n, px = ax + (bx2 - ax) * t, pz2 = az + (bz2 - az) * t; C('blancoFino', 0.014, 0.014, h, px, h / 2, pz2, 5);
        if (i < n) { const px2 = ax + (bx2 - ax) * (t + 0.5 / n), pz3 = az + (bz2 - az) * (t + 0.5 / n); J.add('blancoFino', new THREE.TorusGeometry(0.06, 0.011, 5, 12).rotateY(alongX ? 0 : PI / 2).translate(px2, h * 0.32, pz3)); J.add('blancoFino', new THREE.TorusGeometry(0.05, 0.011, 5, 12).rotateY(alongX ? 0 : PI / 2).translate(px2, h * 0.8, pz3)); } } }
    F(xr, 0.5, zs, 0.1, 1.0, 1.5);
    // portavelas de fierro con velas votivas
    const xv = xs - 1.15, zv = zs + 1.15; B('hierro', xv, 0.45, zv, 0.5, 0.04, 0.36); for (const dx of [-0.2, 0.2]) for (const dz of [-0.13, 0.13]) C('hierro', 0.012, 0.012, 0.45, xv + dx, 0.22, zv + dz, 5);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const px = xv - 0.15 + i * 0.15, pz2 = zv - 0.08 + j * 0.16; C('vela', 0.025, 0.025, 0.1, px, 0.52, pz2, 6); Sp('llama', 0.02, px, 0.6, pz2, 6, 5); }
    F(xv, 0.3, zv, 0.5, 0.6, 0.36);
  }
  // luminarias de pared blancas en los pilares (apliques)
  for (let i = 1; i <= 4; i++) for (const s of [-1, 1]) { const x = s * (xp - 0.42), z = pz[i], JA = R('aplique_iglesia', x + s * 0.05, 4.12, z, -s * PI / 2); RB(JA)('blanco', x, 4.2, z, 0.1, 0.06, 0.1); RS(JA)('lampara', 0.09, x - s * 0.05, 4.2, z, 8, 6); }   // C5 (I08): aplique FINO (roseta, brazo de bronce y globo de opalina)
  // piso de baldosas claras cuadradas (sobre el piso del juego)
  { const t = texLienzo('ig8_piso', 256, 256, (c, w, h) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = (rnd() - 0.5) * 16; c.fillStyle = `rgb(${214 + v | 0},${207 + v | 0},${192 + v | 0})`; c.fillRect(i * 128, j * 128, 128, 128); }
      c.fillStyle = 'rgba(120,110,95,0.55)'; c.fillRect(0, 0, 256, 3); c.fillRect(0, 0, 3, 256); c.fillRect(0, 126, 256, 4); c.fillRect(126, 0, 4, 256); });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W / 1.2, -zT / 1.2 + 1);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(W, -zT + 0.0).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 })); pm.position.set(O.x, 0.012, O.z + zT / 2); pm.receiveShadow = true; g.add(pm);
    const t2 = t.clone(); t2.needsUpdate = true; t2.repeat.set(5, 3.4);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 4.4).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.55 })); p2.position.set(O.x, yE + 0.012, O.z + (zT + 0.4 + zT - 4) / 2); p2.receiveShadow = true; g.add(p2);
  }
  // ============================================================ armar
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
  const mats = { celeste: M(0xb4d0ea, { side: THREE.DoubleSide }), celesteN: M(0x8fb3da), blanco: M(0xf4f1e8), blancoFino: M(0xf4f1e8), blancoSombra: M(0xe6e2d6), plafon: M(0xf4f0e2, { side: THREE.DoubleSide }), crema: M(0xf2e9cf),
    grada: M(0xcfc7b6, { roughness: 0.9 }), azulRug: M(0x4f89b7), maderaClara: M(0xc79a62), maderaOsc: M(0x2b190d), talla: M(0xcdb690), bronce: M(0xb08a3a, { metalness: 0.6, roughness: 0.4 }),
    hierro: M(0x1b1b1d, { metalness: 0.5, roughness: 0.5 }), altar: M(0x9a5a2c, { roughness: 0.55 }), altarClaro: M(0xb9773a, { roughness: 0.45 }), altarOsc: M(0x3a2010), banca: M(0x2a1a14, { roughness: 0.4 }),
    mesaTop: M(0xb9773a, { roughness: 0.45 }), silla: M(0xa86a35), papel: M(0xe8d27a), rojo: M(0xb52a22), vela: M(0xf2ead0), florero: M(0xe9e6df), flor1: M(0xe9708a), flor2: M(0xf6efe6), flor3: M(0xd7432f), hoja: M(0x3f7d46),
    base: M(0x2f6a3c), sotana: M(0x1c1612), sobrepelliz: M(0xf1ece0), dalmatica: M(0xb52a2a), estola: M(0x4b5d86), negro: M(0x15110f), piel: M(0xd9a67e), cabello: M(0x2a1a10),
    llama: new THREE.MeshBasicMaterial({ color: 0xffd27a }), lampara: new THREE.MeshBasicMaterial({ color: 0xfff1d0 }), dia: new THREE.MeshBasicMaterial({ polygonOffset: !/[?&]r8=0/.test(globalThis.location?.search || ''), polygonOffsetFactor: 0, polygonOffsetUnits: -12, color: 0xdbe8f6, side: THREE.DoubleSide }), rosa: new THREE.MeshBasicMaterial({ color: 0xe9a89a, side: THREE.DoubleSide }) };
  ordenarCoplanares(mats, { celesteN: 0.3, grada: 0.5, blanco: 1, blancoFino: 1.1, blancoSombra: 1.2, plafon: 1.3, crema: 1.4, azulRug: 1.6, hierro: 2, altar: 2.1, altarClaro: 2.15, maderaClara: 2.2, silla: 2.25, altarOsc: 2.3, banca: 2.4, mesaTop: 2.45, maderaOsc: 2.5, talla: 2.6, papel: 2.8, rojo: 2.9, bronce: 3, vela: 3.05, florero: 3.1, flor1: 3.2, flor2: 3.3, flor3: 3.4, hoja: 3.5 });   // R-8
  for (const k of Object.keys(J.p)) { const geo = J.geometria(k, null); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'kit_' + k; m.receiveShadow = true; m.position.copy(O); g.add(m); }
  for (const [id, { JR, it }] of RESP) {   // N0-UTIL3 (G6): respaldo de cada pieza en su grupo; se oculta al montar la malla
    const gR = new THREE.Group(); gR.name = 'ig_resp_' + id;
    for (const k of Object.keys(JR.p)) { const geo = JR.geometria(k, null); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'kit_' + k; m.receiveShadow = true; gR.add(m); }
    gR.position.copy(O); g.add(gR); montarEnKit(g, it, { ocultar: gR });
  }
  for (const [x, y, z, tipo, sx] of flags) {   // paños colgando de un travesaño del mástil
    const t = texLienzo('ig8_bandera_' + tipo, 256, 160, (c, w, h) => {
      if (tipo === 'chile') { c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#c8302a'; c.fillRect(0, h / 2, w, h / 2); c.fillStyle = '#1f4a9a'; c.fillRect(0, 0, w * 0.34, h / 2); c.fillStyle = '#fff'; c.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 22; c.lineTo(w * 0.17 + Math.cos(a) * r, h * 0.25 + Math.sin(a) * r); } c.fill(); }
      else { c.fillStyle = '#f2c94c'; c.fillRect(0, 0, w / 2, h); c.fillStyle = '#f5f2ea'; c.fillRect(w / 2, 0, w / 2, h); c.fillStyle = '#8a6a2e'; c.fillRect(w * 0.55, h * 0.3, w * 0.2, 8); c.fillRect(w * 0.64, h * 0.2, 8, h * 0.4); } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.65), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 })); planoUtil(m, tipo === 'chile' ? 'bandera_chile' : 'bandera_vaticano'); m.position.set(O.x + x - sx * 0.52, O.y + y - 0.36, O.z + z); g.add(m);
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 6).rotateZ(PI / 2), mats.bronce); cr.position.set(O.x + x - sx * 0.52, O.y + y, O.z + z); g.add(cr);
  }
  // el Cristo y el plano de papel ya están en la malla; luces: día frío por las ventanas, velas cálidas en altar y San Lorenzo
  const luz = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(O.x + x, O.y + y, O.z + z); g.add(l); return l; };
  luz(0xdfe9ff, 70, 20, 0, 6.2, -6); luz(0xdfe9ff, 70, 20, 0, 6.2, -14); luz(0xe6efff, 26, 10, -4.7, 3.4, -9); luz(0xe6efff, 26, 10, 4.7, 3.4, -12);
  luz(0xffd9a0, 16, 8, 0, yE + 2.6, zE - 0.4); luz(0xfff0dc, 12, 7, 0, 2.7, -2); luz(0xffb46a, 6, 4.5, 3.9, 1.0, zb[2] + 1.0);
  g.add(new THREE.AmbientLight(0xe8eefc, 0.9));
  const pu = precargarUtileria(); if (pu) pu.then(() => { if (!hayPieza('banca')) return;   // N0-UTIL: bancas de malla en vez de las de cajas
    const U = new Colocador(); for (const [xc, z, lg] of bancas) U.poner('banca', O.x + xc, O.y, O.z + z + 0.02, PI, 0, [lg / 2.6, 1, 1]);
    U.armar(g); const vieja = g.getObjectByName('kit_banca'); if (vieja) vieja.visible = false; });
  return g;
}
function armarSala(J) {
  const mats = { blanco: material('blanco', 0xf6f4ee), fierro: material('fierro'), rojo: new THREE.MeshStandardMaterial({ color: 0xb3221c, roughness: 0.45 }), piedra: material('piedra', 0xa9a39c),
    oscuro: material('fierro', 0x1a1c20), gris: material('blanco', 0xb9b6ae) };
  mats.blancoFino = mats.blanco; mats.dia = new THREE.MeshBasicMaterial({ color: 0xeaf1f6 });
  const g = new THREE.Group();
  for (const k of Object.keys(J.p)) { const geo = J.geometria(k, k === 'piedra' ? uvCaja : null); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'kit_' + k; m.receiveShadow = true; m.castShadow = k === 'blanco'; g.add(m); }
  return g;
}

// ======================================================================================= Teatro 165 por dentro (N2-C35)
// Según los planos de 1937 (Braden Copper, G.C. Kipping, M-1342; assets3d/referencias/sewell/planos/): nave larga con techo abovedado sobre
// cerchas de madera (nervios de arco con tirante, pendolones y tornapuntas), bloque de entrada con techo a dos aguas y cercha de pendolón,
// galería de proyección arriba de la entrada (cabina de madera con portillo), gradería escalonada con butacas, ventanas altas en los muros,
// escenario ELEVADO tras la boca (muro del proscenio con arco rebajado) y telón al fondo. Muros estucados por dentro, madera en cerchas, zócalo y piso.
// Local de la sala: x a lo ancho, z de 0 (entrada) a −largo, y sobre el piso. La altura del muro (S.alto) es la de los aleros.
function salaTeatro(S, O, fis) {
  const W = S.ancho, L = S.largo, H = S.alto, J = new Junta(), g = new THREE.Group(); g.name = 'kit_sala_teatro165';
  const hw = W / 2, flecha = 4.5, yV = H + flecha, yR = H + 6.2;   // corona de la bóveda y cumbrera del bloque de entrada
  const JFT = new Junta(), itT = [], itL = [];   // C5: respaldo de los faroles de pared y lista de FINOS del teatro (marco local de g)
  const Rv = (hw * hw + flecha * flecha) / (2 * flecha), cyV = yV - Rv;
  const yArc = x => cyV + Math.sqrt(Math.max(0, Rv * Rv - x * x));   // intradós de la bóveda
  const zP = -8, zBoca = -27.5, yEsc = 0.9, hall = [-10.5, -14.5, -18.5, -22.5, -25.8, -31], frente = [-2.5, -5.3];
  const vg = (k, x0, y0, x1, y1, z, t = 0.3, d = 0.45) => J.caja(k, (x0 + x1) / 2, (y0 + y1) / 2, z, Math.hypot(x1 - x0, y1 - y0), d, t, 0, 0, Math.atan2(y1 - y0, x1 - x0));
  // --- muros estucados por dentro con ventanas altas (rectangulares, con parteluz), zócalo de madera y cornisa
  const zv = [-3.9, -6.65, -12.5, -16.5, -20.5, -24.2, -29.2], wv = 1.7, yv0 = 7.4, yv1 = 10.6;
  for (const s of [-1, 1]) {
    const x = s * (hw - 0.03);
    J.caja('estuco', x, (1.3 + yv0) / 2, -L / 2, 0.06, yv0 - 1.3, L); J.caja('estuco', x, (yv1 + H) / 2, -L / 2, 0.06, H - yv1, L);
    let z = 0; for (const c of [...zv].sort((a, b) => b - a)) { const a = c + wv / 2; if (z - a > 0.01) J.caja('estuco', x, (yv0 + yv1) / 2, (z + a) / 2, 0.06, yv1 - yv0, z - a); z = c - wv / 2; }
    J.caja('estuco', x, (yv0 + yv1) / 2, (z - L) / 2, 0.06, yv1 - yv0, z + L);
    J.caja('madera', s * (hw - 0.04), 0.65, -L / 2, 0.08, 1.3, L); J.caja('maderaOsc', s * (hw - 0.07), 1.33, -L / 2, 0.14, 0.1, L);   // zócalo con moldura
    J.caja('maderaOsc', s * (hw - 0.14), H - 0.12, -L / 2, 0.28, 0.24, L);   // cornisa bajo los aleros
    for (const c of zv) {   // vidrio (luz del día), marco y parteluz de madera, dintel y alféizar
      J.caja('vidrio', x, (yv0 + yv1) / 2, c, 0.02, yv1 - yv0, wv);
      for (const dz of [-wv / 2, wv / 2]) J.caja('maderaClara', x - s * 0.05, (yv0 + yv1) / 2, c + dz, 0.1, yv1 - yv0 + 0.2, 0.12);
      J.caja('maderaClara', x - s * 0.05, yv1 + 0.06, c, 0.1, 0.12, wv + 0.24); J.caja('maderaClara', x - s * 0.08, yv0 - 0.06, c, 0.16, 0.1, wv + 0.3);
      J.caja('maderaClara', x - s * 0.05, (yv0 + yv1) / 2, c, 0.06, yv1 - yv0, 0.07); J.caja('maderaClara', x - s * 0.05, (yv0 + yv1) / 2, c, 0.06, 0.07, wv);
    }
    for (const c of [...frente, ...hall, zP]) {   // pilastras de madera que reciben las cerchas, con ménsula
      J.caja('madera', s * (hw - 0.3), H / 2, c, 0.5, H, 0.55);
      vg('maderaOsc', s * (hw - 0.5), H - 3.0, s * (hw - 3.3), H - 0.25, c, 0.3, 0.3);
    }
    for (const c of [...frente, -9.2, -12.5, -16.5, -20.5, -24.2]) {   // faroles de pared (luz cálida) · C5 (T03): farol_teatro FINO; JFT es su respaldo
      JFT.caja('oro', s * (hw - 0.1), 5.2, c + 1.0, 0.06, 0.12, 0.3); JFT.add('luz', new THREE.SphereGeometry(0.16, 8, 6).translate(s * (hw - 0.22), 5.35, c + 1.0));
      itT.push({ id: 'farol_teatro', x: s * (hw - 0.07), y: 5.3, z: c + 1.0, ry: -s * Math.PI / 2 }); }
  }
  // muro de la entrada (z = 0): estuco a los lados y sobre el portal; frontón a dos aguas con celosía
  for (const s of [-1, 1]) J.caja('estuco', s * (hw + 1.9) / 2, (3.4 + H) / 2, -0.03, hw - 1.9, H - 3.4, 0.06);
  J.caja('estuco', 0, (8.1 + H) / 2, -0.03, 3.8, H - 8.1, 0.06); J.caja('maderaOsc', 0, H - 0.12, -0.12, W, 0.24, 0.24);
  const tri = (zf, y0, y1) => { const sh = new THREE.Shape([new THREE.Vector2(-hw, y0), new THREE.Vector2(hw, y0), new THREE.Vector2(0, y1)]); J.add('estuco', new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }).translate(0, 0, zf - 0.3)); };
  tri(0, H, yR);
  for (let i = 0; i < 6; i++) J.caja('maderaOsc', 0, yR - 1.2 - i * 0.25, -0.33, 2.6 - i * 0.28 + 0.4, 0.07, 0.04);   // celosía de ventilación del frontón
  // --- tímpano del muro de partición (z = −8): entre la bóveda y la cubierta a dos aguas del bloque de entrada
  { const pts = [new THREE.Vector2(-hw, H), new THREE.Vector2(0, yR), new THREE.Vector2(hw, H)];
    for (let i = 16; i >= 0; i--) { const x = -hw + 2 * hw * i / 16; pts.push(new THREE.Vector2(x, yArc(x) + 0.05)); }
    J.add('estuco', new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.3, bevelEnabled: false }).translate(0, 0, zP - 0.3)); }
  // --- muro del fondo: luneta bajo la bóveda
  { const pts = [new THREE.Vector2(-hw, H), new THREE.Vector2(hw, H)]; for (let i = 16; i >= 0; i--) { const x = -hw + 2 * hw * i / 16; pts.push(new THREE.Vector2(x, yArc(x))); }
    J.add('estuco', new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.3, bevelEnabled: false }).translate(0, 0, -L)); }
  J.caja('estuco', 0, H / 2, -L + 0.03, W, H, 0.06);
  // --- cielo: bóveda de tablas sobre los nervios (nave) y dos aguas (bloque de entrada)
  const N = 20;
  for (let i = 0; i < N; i++) { const xa = -hw + 2 * hw * i / N, xb = -hw + 2 * hw * (i + 1) / N;
    J.quad('cielo', [xa, yArc(xa) + 0.3, zP], [xb, yArc(xb) + 0.3, zP], [xb, yArc(xb) + 0.3, -L], [xa, yArc(xa) + 0.3, -L]); }
  for (const s of [-1, 1]) J.quad('cielo', [s * hw, H, 0], [0, yR, 0], [0, yR, zP], [s * hw, H, zP]);
  for (const x of [-9, -4.5, 0, 4.5, 9]) J.caja('maderaOsc', x, yArc(x) + 0.05, (zP - L) / 2, 0.25, 0.3, L + zP);   // correas largas bajo la bóveda
  for (const s of [-1, 1]) for (const f of [0.35, 0.7]) J.caja('maderaOsc', s * hw * (1 - f), H + (yR - H) * f - 0.05, zP / 2, 0.25, 0.3, -zP, 0, 0, s * Math.atan2(yR - H, hw) * -1);
  // --- cerchas del bloque de entrada: tirante, pares, pendolón, tornapuntas y pendolones laterales
  for (const z of frente) {
    J.caja('maderaOsc', 0, H - 0.22, z, W, 0.45, 0.32);
    for (const s of [-1, 1]) { vg('madera', s * hw, H, 0, yR, z, 0.32, 0.5); vg('madera', 0, H + 0.2, s * hw / 2, H + (yR - H) / 2, z, 0.26, 0.35);
      J.caja('madera', s * hw / 2, H + (yR - H) / 4, z, 0.3, (yR - H) / 2, 0.28); }
    J.caja('maderaOsc', 0, (H + yR) / 2, z, 0.4, yR - H, 0.34);
  }
  // --- cerchas de la nave: nervio de arco con tirante, pendolones y tornapuntas
  const nn = 18;
  for (const z of hall) {
    J.caja('maderaOsc', 0, H - 0.22, z, W, 0.45, 0.32);
    for (let i = 0; i < nn; i++) { const xa = -hw + 2 * hw * i / nn, xb = -hw + 2 * hw * (i + 1) / nn; vg('madera', xa, yArc(xa), xb, yArc(xb), z, 0.34, 0.6); }
    const ps = [0, 3.4, 7.2, 10.4];
    for (const s of [-1, 1]) ps.forEach((x, k) => { J.caja('madera', s * x, (H + yArc(x)) / 2, z, 0.26, yArc(x) - H, 0.26);
      if (k < ps.length - 1) vg('madera', s * x, H, s * ps[k + 1], yArc(ps[k + 1]), z, 0.2, 0.25); });
  }
  // --- boca del escenario: muro del proscenio con arco rebajado, marco dorado y escenario elevado con escalones
  { const outer = [new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(hw, H)];
    for (let i = 16; i >= 0; i--) { const x = -hw + 2 * hw * i / 16; outer.push(new THREE.Vector2(x, yArc(x) + 0.05)); }
    const xo = 11, rise = 2.0, ySp = 8.6, Ra = (xo * xo + rise * rise) / (2 * rise), cya = ySp + rise - Ra, yA = x => cya + Math.sqrt(Ra * Ra - x * x);
    const hole = [new THREE.Vector2(-xo, yEsc - 0.05), new THREE.Vector2(xo, yEsc - 0.05)];   /* R-7: el canto bajo la boca queda 5 cm dentro del escenario (antes coplanar con las tablas a 0,9 m) */ for (let i = 0; i <= 12; i++) { const x = xo - 2 * xo * i / 12; hole.push(new THREE.Vector2(x, yA(x))); }
    const sh = new THREE.Shape(outer); sh.holes.push(new THREE.Path(hole));
    J.add('estuco', new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }).translate(0, 0, zBoca - 0.5));
    for (const s of [-1, 1]) J.caja('oro', s * (xo + 0.18), (yEsc + ySp) / 2, zBoca + 0.04, 0.36, ySp - yEsc, 0.12);
    for (let i = 0; i < 12; i++) { const xa = -xo + 2 * xo * i / 12, xb = -xo + 2 * xo * (i + 1) / 12; vg('oro', xa, yA(xa) + 0.18, xb, yA(xb) + 0.18, zBoca + 0.04, 0.12, 0.38); }
    J.caja('oro', 0, yEsc + 0.05, zBoca + 0.04, 2 * xo, 0.1, 0.14);
    // física: muro a los lados y sobre la boca
    for (const s of [-1, 1]) fis.caja(O.x + s * (xo + hw) / 2, H / 2, O.z + zBoca - 0.25, hw - xo, H, 0.5, 0, { tipo: 'muro' });
    fis.caja(O.x, (yA(0) + H) / 2, O.z + zBoca - 0.25, 2 * xo, H - yA(0), 0.5, 0, { tipo: 'muro' }); }
  { const z0 = zBoca + 0.5, z1 = -L + 0.1;   // escenario: tablas a 0,9 m, frente con moldura, dos escalones al centro
    J.caja('madera', 0, yEsc / 2, (z0 + z1) / 2, W - 0.1, yEsc, z0 - z1); J.caja('maderaOsc', 0, yEsc + 0.02, (z0 + z1) / 2, W - 0.1, 0.05, z0 - z1);
    fis.caja(O.x, yEsc / 2, O.z + (z0 + z1) / 2, W, yEsc, z0 - z1, 0, { tipo: 'piso' });
    J.caja('maderaOsc', 0, yEsc - 0.12, z0 + 0.03, W - 0.1, 0.24, 0.08); J.caja('oro', 0, yEsc - 0.3, z0 + 0.04, W - 0.1, 0.05, 0.05);
    for (const [k, zz] of [[1, z0 + 0.25], [2, z0 + 0.75]]) { const top = yEsc - 0.3 * k, y = top / 2;
      J.caja('madera', 0, y, zz, 5, top, 0.5); fis.caja(O.x, y, O.z + zz, 5, top, 0.5, 0, { tipo: 'escalera' }); }
  }
  // --- galería de proyección sobre la entrada: cabina de madera con portillo para el haz
  { const y0 = 8.1, z0 = -3.0, hh = 3.0;
    J.caja('madera', 0, y0 - 0.12, z0 / 2, 6.4, 0.24, -z0); J.caja('maderaOsc', 0, y0 - 0.26, z0 / 2, 6.6, 0.1, -z0 + 0.2);
    J.caja('estuco', 0, 8.25, z0 - 0.03, 6.4, 0.3, 0.06); J.caja('estuco', 0, 10.25, z0 - 0.03, 6.4, 1.7, 0.06);
    for (const s of [-1, 1]) J.caja('estuco', s * 1.925, 8.9, z0 - 0.03, 2.55, 1.0, 0.06);
    for (const s of [-1, 1]) J.caja('maderaClara', s * 3.2, y0 + hh / 2, z0 / 2, 0.06, hh, -z0);
    J.caja('maderaOsc', 0, y0 + hh + 0.06, z0 / 2, 6.6, 0.14, -z0 + 0.1);
    for (const s of [-1, 1]) for (const x of [-3.0, 3.0]) if (s > 0) for (const z of [-0.3, -2.8]) J.caja('madera', x, (3.4 + y0) / 2, z, 0.3, y0 - 3.4, 0.3);
    // portillo (marco) y letrero
    J.caja('maderaOsc', 0, 8.5, z0 - 0.06, 1.3, 0.1, 0.08); J.caja('maderaOsc', 0, 9.3, z0 - 0.06, 1.3, 0.1, 0.08);
    for (const s of [-1, 1]) J.caja('maderaOsc', s * 0.65, 8.9, z0 - 0.06, 0.1, 0.9, 0.08);
  }
  // --- frente de la galería de entrada (hacia la gradería): faja de madera con paneles y pasamanos en los pasillos laterales
  for (const s of [-1, 1]) { const x = s * (hw + 10) / 2, w = hw - 10;
    J.caja('estuco', x, 1.7, -5.02, w, 3.4, 0.06); J.caja('maderaOsc', x, 3.46, -4.95, w, 0.1, 0.3);
    for (let k = 0; k < 4; k++) J.caja('maderaOsc', s * (10.4 + k * 0.7), 4.0, -4.88, 0.05, 0.9, 0.05);
    J.caja('maderaOsc', x, 4.5, -4.88, w, 0.07, 0.1); }
  // --- armar con materiales propios (estuco cálido, madera, dorado, terciopelo)
  const dobles = m => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
  const mats = { estuco: material('estuco', 0xe6d6b4), cielo: dobles(material('tablasViejas', 0x6a4a30)), madera: material('tablasViejas', 0x82583a), maderaOsc: material('tablasViejas', 0x4b301d),
    maderaClara: material('puerta', 0xb68a58), oro: material('fierro', 0xa88436), rojo: new THREE.MeshStandardMaterial({ color: 0x6e1a20, roughness: 0.95 }),
    vidrio: new THREE.MeshBasicMaterial({ color: 0x7c93a8 }), luz: new THREE.MeshBasicMaterial({ color: 0xffd8a0 }) };
  ordenarCoplanares(mats, { cielo: 0.5, madera: 1, maderaClara: 1.2, maderaOsc: 2, rojo: 2.5, oro: 3, vidrio: 3.5 });   // R-8
  for (const k of Object.keys(J.p)) { const geo = J.geometria(k, ['estuco', 'madera', 'maderaOsc', 'maderaClara'].includes(k) ? uvCaja : null); if (!geo) continue;
    if (k === 'cielo') { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, -p.getZ(i) / 2.5, p.getX(i) / 2.5); uv.needsUpdate = true; }   // tablas a lo largo de la nave
    const m = new THREE.Mesh(geo, mats[k]); m.name = 'kit_' + k; m.receiveShadow = true; m.castShadow = false; g.add(m); }
  // lámparas colgantes de la nave (pantalla dorada y globo cálido) bajo los nervios, y luz de escena
  const gl = [], gLR = new THREE.Group(); gLR.name = 'teatro_resp_lampara'; g.add(gLR);   // C5 (T04): lampara_teatro FINA; gLR es su respaldo
  for (const z of [-14.5, -22.5]) for (const x of [-4.5, 0, 4.5]) { const y = yArc(x) - 2.2;
    const cd = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.0, 5), mats.oro); cd.position.set(x, y + 1.1, z); gLR.add(cd);
    const pa = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 14, 1, true), dobles(mats.oro)); pa.position.set(x, y + 0.1, z); gLR.add(pa);
    const gb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mats.luz); gb.position.set(x, y - 0.02, z); gLR.add(gb); gl.push(gb);
    itL.push({ id: 'lampara_teatro', x, y: y + 2.1, z, ry: 0 }); }
  { const gF = new THREE.Group(); gF.name = 'teatro_resp_farol'; for (const k of Object.keys(JFT.p)) { const geo = JFT.geometria(k); if (geo) gF.add(new THREE.Mesh(geo, mats[k])); } g.add(gF);
    montarEnKit(g, itT, { ocultar: gF }); montarEnKit(g, itL, { ocultar: gLR }); }   // C5: g queda en O (marco local)
  g.position.copy(O);
  const out = new THREE.Group(); out.name = 'kit_teatro165'; out.add(g);
  { const l = new THREE.PointLight(0xffd29a, 55, 24, 1.5); l.position.set(O.x, 9.5, O.z - 30); out.add(l); }
  { const l = new THREE.PointLight(0xffd8a8, 40, 20, 1.5); l.position.set(O.x, 10.5, O.z - 5); out.add(l); }
  out.add(new THREE.AmbientLight(0xffe8cc, 0.45));
  return out;
}

// N2-C38: colisión del acceso del Teniente Club (pórtico y escalera lateral) y puerta de entrada ARRIBA, en el pórtico. ctx = e._clubFis de
// construir.js { fis (con el giro del lote), R, x, z, base, e, col, y0, y1 }; a = userData.kit.acc. Coordenadas locales del kit (sin girar).
export function clubAcceso(ctx, a) {
  const { fis, R, x: cx, z: cz, base, e } = ctx; globalThis.__clubAcc = { a, cx, cz, base };
  if (ctx.col) { try { fis.mundo.removeCollider(ctx.col, true); fis.etiquetas.delete(ctx.col.handle); } catch (err) { console.warn('club: caja vieja', err); } }
  const C = (x, ya, yb, z, sx, sz, et = 'muro') => fis.caja(cx + x, base + (ya + yb) / 2, cz + z, sx, yb - ya, sz, 0, { tipo: et });
  const zB = -a.W / 2 - 0.05, zF = a.zF, xP = a.xP;
  if (ctx.techo && ctx.techo.col) {   // techo físico: sin la parte que quedaba sobre el pórtico y la escalera (los rayos desde arriba no veían el suelo del pórtico)
    try { fis.mundo.removeCollider(ctx.techo.col, true); fis.etiquetas.delete(ctx.techo.col.handle); } catch (err) { console.warn('club: techo viejo', err); }
    const zl = cz + zF + 0.6, p = Float32Array.from(ctx.techo.pts); for (let i = 2; i < p.length; i += 3) if (p[i] > zl) p[i] = zl;
    fis.convexo(p, { tipo: 'techo' });
  }
  fis.caja(cx, (ctx.y0 + ctx.y1) / 2, cz + (zB + zF) / 2, a.L + 0.1, ctx.y1 - ctx.y0, zF - zB, 0, { tipo: 'muro' });   // el cuerpo, ahora sin el pórtico
  C(0, -1.5, a.yT, (a.zF + a.zP1) / 2 + 0.03, 2 * xP + 0.12, a.zP1 - a.zF + 0.06, 'piso');   // podio del pórtico (arriba: yT)
  C(0, -0.3, 0.12, (zF + a.W / 2) / 2, a.L - 0.1, a.W / 2 - zF, 'piso');   // vereda
  // ESC (16-11, Diego: «que Nato no se entierre en las escaleras»): antes, una rampa ~5 cm bajo las narices: en el talón de cada huella
  // quedaba una contrahuella entera bajo lo que se ve (Nato hundido ~20 cm). Ahora una caja por peldaño, igual a la del kit (club20)
  { const rise = a.caida / a.nS, tread = a.run / a.nS, wE = a.zA1 - a.zA0;
    for (let k = 0; k < a.nS - 1; k++) C(a.uA + (k + 0.5) * tread, -0.3, a.yT - (k + 1) * rise, a.zA0 + wE / 2, tread + 0.004, wE - 0.02, 'escalera'); }
  // mejilla + pasamanos (muro alto como la baranda, por el lado de la calle)
  { const z0 = a.zA1, z1 = a.zA1 + 0.2, u0 = a.uA, u1 = a.uA + a.run, p = [];
    for (const z of [z0, z1]) p.push(u0, -0.3, z, u0, a.yT + 0.95, z, u1, 0.12 + 0.95, z, u1, -0.3, z);
    fis.convexo(Float32Array.from(p, (v, i) => i % 3 === 0 ? cx + v : i % 3 === 1 ? base + v : cz + v), { tipo: 'baranda' }); }
  // balaustradas del pórtico (frente, oeste y este) y columnas
  C(0, a.yT, a.yT + 0.95, a.zP1 - 0.15, 2 * xP - 0.7, 0.2, 'baranda');
  C(-(xP - 0.1), a.yT, a.yT + 0.95, (a.zP0 + 0.1 + a.zP1 - 0.35) / 2, 0.2, a.zP1 - 0.35 - a.zP0 - 0.1, 'baranda');
  C(xP - 0.1, a.yT, a.yT + 0.95, (a.zA1 + 0.1 + a.zP1 - 0.35) / 2, 0.2, a.zP1 - 0.35 - a.zA1 - 0.1, 'baranda');
  for (const x of a.xc) C(x, a.yT, a.yT + 5, a.zcol, 0.46, 0.46);
  // puerta de entrada: en el rellano del pórtico, frente a la puerta (sale mirando a la calle, 1,6 m más afuera, bajo el balcón)
  // N2-PUERTAS-EMB: «acceso» = pie de la escalera lateral en el marco de la puerta (a: a su derecha, b: hacia afuera; na/nb: hacia la calle).
  // irLugar.js (&ir=club, turismo «ir») aparece ahí, en la vereda frente a la escalera, y no frente a la baranda del pórtico (2,7 m más abajo).
  if (e && e.puerta) R.puertas.push({ x: cx, y: base + a.yT, z: cz + zF + 1.0, rumbo: 0, sala: e.puerta.sala, lado: 'entrada', nombre: e.puerta.nombre || e.nombre, salidaDist: 1.7,
    lugar: 'club', acceso: { a: a.uA + a.run + 0.4, b: (a.zA0 + a.zA1) / 2 - zF - 1.0, na: 1, nb: 0 } });
}

// N2-PUERTAS-EMB (carril kit, 15-11-2026): acceso lateral de la Escuela Industrial (ed. 129). El kit dibuja en el costado +X la puerta
// elevada (yd ≈ 2 m) con su descanso, la escalera que baja hacia el frente (+Z) y el murete ocre por el lado de la calle, pero la caja de
// colisión del cuerpo cubría todo el lote (escalera y descanso por dentro) y no había disparador: a pie no se llegaba y E no hacía nada.
// Ahora: cuerpo recortado en xE, descanso y rampa bajo los peldaños caminables, murete como baranda y la puerta en el descanso. La escuela
// es «solo exterior» (DISENO3D.md): la puerta es genérica cerrada (E avisa) hasta que tenga sala propia. ctx = e._escFis de construir.js.
export function escuelaAcceso(ctx, a) {
  const { fis, R, x: cx, z: cz, base } = ctx; globalThis.__escAcc = { a, cx, cz, base };
  if (!ctx.col || !(ctx.wx >= ctx.wz)) { console.warn('escuela: sin caja o lote girado: acceso sin recortar'); return; }
  try { fis.mundo.removeCollider(ctx.col, true); fis.etiquetas.delete(ctx.col.handle); } catch (err) { console.warn('escuela: caja vieja', err); return; }
  const xE = a.xE, x0 = -ctx.wx / 2;
  fis.caja(cx + (x0 + xE) / 2, (ctx.y0 + ctx.y1) / 2, cz, xE - x0, ctx.y1 - ctx.y0, ctx.wz, 0, { tipo: 'muro' });   // el cuerpo, sin la franja de 1,7 m del acceso
  if (ctx.techo && ctx.techo.col) {   // techo físico: no sobre la escalera (los rayos desde arriba no veían el descanso)
    try { fis.mundo.removeCollider(ctx.techo.col, true); fis.etiquetas.delete(ctx.techo.col.handle); } catch (err) { console.warn('escuela: techo viejo', err); }
    const xl = cx + xE + 0.05, p = Float32Array.from(ctx.techo.pts); for (let i = 0; i < p.length; i += 3) if (p[i] > xl) p[i] = xl;
    fis.convexo(p, { tipo: 'techo' });
  }
  const P = pts => fis.convexo(Float32Array.from(pts, (v, i) => i % 3 === 0 ? cx + v : i % 3 === 1 ? base + v : cz + v), { tipo: P.t });
  const { zD, yd, zS0 } = a, z1 = zS0 + a.nS * a.tread, xa = xE + 0.02, xb = a.xw - 0.08;
  fis.caja(cx + (xa + xb) / 2, base + (yd - 1.5) / 2, cz + zD, xb - xa, yd + 1.5, 2.0, 0, { tipo: 'piso' });   // descanso frente a la puerta
  // ESC (16-11): una caja por peldaño, igual a la del kit (escuela129: nS peldaños de 0,28 desde zS0, 1,3 m de ancho en xE + 0,7).
  // Antes, una rampa ~5 cm bajo las narices: Nato quedaba hundido una contrahuella en el talón de cada huella
  for (let k = 0; k < a.nS; k++) { const top = a.yd - k * a.yd / a.nS; fis.caja(cx + xE + 0.7, base + (top - 0.3) / 2, cz + zS0 + (k + 0.5) * a.tread, 1.3, top + 0.3, a.tread + 0.004, 0, { tipo: 'escalera' }); }
  { const p = []; for (const x of [a.xw - 0.08, a.xw + 0.08]) p.push(x, -0.3, zD - 1.0, x, yd + 0.95, zD - 1.0, x, yd + 0.95, zS0, x, 0.95, z1, x, -0.3, z1); P.t = 'baranda'; P(p); }   // murete ocre (lado de la calle)
  // puerta: genérica cerrada en el descanso (E: aviso). acceso = pie de la escalera (marco de la puerta: derecha = -Z, afuera = +X)
  // N2-ESCUELA (carril interiores, 15-11): ya no está cerrada. Sala por época (escuela20/45/67) y, en el modo turista, el museo de hoy.
  // Al salir, Nato queda en la escalera, ~2 m bajo el umbral, mirando hacia abajo (salir: el descanso es angosto y el murete corta el paso hacia +X).
  const ep = ctx.epoca || 1920, sala = ctx.tur ? 'museo' : ep >= 1960 ? 'escuela67' : ep >= 1930 ? 'escuela45' : 'escuela20';
  R.puertas.push({ x: cx + xE + 0.75, y: base + yd, z: cz + zD, rumbo: Math.PI / 2, sala, lado: 'entrada', lugar: 'escuela',
    nombre: ctx.tur ? 'MUSEO DE LA GRAN MINERÍA DEL COBRE' : 'ESCUELA INDUSTRIAL', avisoCerrado: 'ESCUELA INDUSTRIAL · CERRADA',
    salir: { dx: -0.05, dz: zS0 + 1.1 - zD, rumbo: 0 }, placa: { dx: -0.72, dz: -1.05 }, brillo: { dx: -0.01, dz: 0, s: 1.4 },   /* desplazamientos en el marco del edificio sin girar (rumbo π/2); el cono gira la puerta: ver ptoPuerta */ acceso: { a: -(z1 + 0.5 - zD), b: -0.05, na: -1, nb: 0 } });
}
