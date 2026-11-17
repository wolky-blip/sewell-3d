// N4-SALAS (carril kit, 15-11-2026): Hospital del Edificio 157 por dentro para los niveles donde la historia no usa la sala del N3
// (N2 = 1920, recién inaugurado; N4 = 1967, Operación Valle). Antes la puerta del hospital tenía disparador pero no sala (E no hacía nada).
// Planta (local de construirSala: x a lo ancho, z de 0 en la entrada hacia −largo, y sobre el piso; muros interiores en x = ±W/2):
//   hall de acceso (z 0 … −5,5) con felpudo, perchero, macetero y letrero · mampara de madera y vidrio con paso central ·
//   sala de espera (z −5,5 … −17): bancas de madera junto a los muros y en dos filas, radiadores de fierro bajo las ventanas, reloj,
//   carteles, balanza de columna, escritorio con teléfono de magneto y fichero; MESÓN DE ENFERMERÍA y VITRINA DE MEDICAMENTOS (frascos) ·
//   tabique con puerta de dos hojas · sala de camas (z −17 … −34): 12 camas de hierro esmaltado con veladores, biombos de tela,
//   carro de curaciones, porta-sueros, silla de ruedas, camilla y la puerta cerrada del pabellón y rayos X al fondo. Lámparas colgantes
//   de esmalte blanco en el eje. Contraluz de ventanas con el cielo de la época (atardecer en 1920, día en 1967).
// Reglas anti parpadeo (RELEVO_render.md R-7/R-8/R-9): ninguna cara coplanar que mire al mismo lado entre materiales distintos (todo lo que
// va sobre un muro queda ≥ 1 cm afuera), polygonOffset por rango de material (factor 0) y nada de render anidado (sin espejos ni RTT).
// N4-HOSP2 (15-11-2026, pedido de Diego): con S.pisos = 2 vuelven el 2.º piso (losa a 4,2-4,6 m: hall con oficina del médico jefe, rayos X,
// pabellón con lámpara cialítica, maternidad), la ESCALERA de madera contra el muro izquierdo del hall y el ASCENSOR de época a la derecha
// (pozoAscensor: reja de tijera, botonera, agujas, máquina; g.userData.ascensor → construirSala → entidades.js lo anima).
// adornosEpoca(S, O, fis): detalles de 1967 para el cine y el palitroque del N4 (cajas de mudanza, aviso de la Operación Valle, calendario).
import * as THREE from 'three';
import { Junta, material } from './kitSewell.js';
import { matMundo } from './terreno.js';
import { E } from '../motor/entrada.js';
import { montarEnKit, texUtil, precargarUtileria, partirPieza, piezaGrupo } from './utileria.js';   // N0-UTIL3 (G2): mallas TRELLIS con respaldo procedural

const R8 = !/[?&]r8=0/.test(globalThis.location?.search || '');
const texCache = {};
function texto(clave, w, h, dib) {
  if (texCache[clave]) return texCache[clave];
  const c = document.createElement('canvas'); c.width = w; c.height = h; dib(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[clave] = t);
}
// cartel esmaltado: fondo, borde y líneas centradas (la primera más grande)
function texCartel(lineas, fondo = '#f1eee4', tinta = '#1f3a2c', w = 512, h = 160) {
  return texto('hc:' + lineas.join('|') + fondo + tinta + w + 'x' + h, w, h, (c) => {
    c.fillStyle = fondo; c.fillRect(0, 0, w, h); c.strokeStyle = tinta; c.lineWidth = 6; c.strokeRect(9, 9, w - 18, h - 18);
    c.fillStyle = tinta; c.textAlign = 'center'; c.textBaseline = 'middle';
    const n = lineas.length;
    lineas.forEach((l, i) => {
      let f = i === 0 ? Math.min(64, (h - 30) / (n + 0.3) * 1.15) : Math.min(40, (h - 30) / (n + 0.3) * 0.8);
      c.font = `bold ${f}px Georgia, serif`; while (c.measureText(l).width > w - 50 && f > 14) { f -= 2; c.font = `bold ${f}px Georgia, serif`; }
      c.fillText(l, w / 2, h / 2 + (i - (n - 1) / 2) * (h - 40) / Math.max(n, 1.6));
    });
  });
}
function texCalendario(anio, mes) {
  return texto('cal' + anio + mes, 256, 320, (c, w, h) => {
    c.fillStyle = '#f4efe2'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a1c1c'; c.fillRect(0, 0, w, 70);
    c.fillStyle = '#fff'; c.font = 'bold 40px Georgia, serif'; c.textAlign = 'center'; c.fillText(String(anio), w / 2, 50);
    c.fillStyle = '#222'; c.font = 'bold 26px Georgia, serif'; c.fillText(mes, w / 2, 102);
    c.font = '18px Georgia, serif'; for (let i = 0; i < 31; i++) c.fillText(String(i + 1), 30 + (i % 7) * 33, 140 + Math.floor(i / 7) * 34);
  });
}
// N4-HOSP2: baldosa en damero del 2.º piso (la misma del piso de construirSala: blanco y gris verdoso)
function texDamero() {
  if (texCache.damero2) return texCache.damero2;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); let sem = 23; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  const k = 4, b = 256 / k; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const v = (az() - 0.5) * 10, cl = (i + j) % 2 ? [228, 232, 224] : [120, 140, 130]; x.fillStyle = `rgb(${cl[0] + v | 0},${cl[1] + v | 0},${cl[2] + v | 0})`; x.fillRect(i * b, j * b, b, b); }
  x.fillStyle = 'rgba(60,60,60,0.25)'; for (let i = 0; i <= k; i++) { x.fillRect(i * b - 1, 0, 2, 256); x.fillRect(0, i * b - 1, 256, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return (texCache.damero2 = t);
}
// placa de texto en un muro: plano a «sep» de la superficie (nunca a ras), material con offset de cuadro (R-8)
function cartel(g, tex, w, h, x, y, z, rotY, basico = false) {
  const m = basico ? new THREE.MeshBasicMaterial({ map: tex, color: 0xd8d4c8 }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  if (R8) { m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -40; }
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = rotY; p.name = 'hosp_cartel'; g.add(p); return p;
}
// mueble: arma geometrías en su marco local (frente +z) y las lleva a (X, Z) girado rot
function mueble(J, X, Z, rot = 0, Y = 0) {
  const m = new THREE.Matrix4().makeRotationY(rot).setPosition(X, Y, Z);
  const put = (k, g) => { g.applyMatrix4(m); J.add(k, g); };
  return {
    b: (k, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => { const g = new THREE.BoxGeometry(Math.max(sx, 1e-3), Math.max(sy, 1e-3), Math.max(sz, 1e-3)); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); put(k, g); },
    c: (k, r0, r1, h, x, y, z, seg = 10, rx = 0, rz = 0) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); put(k, g); },
    s: (k, r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 10, hs = 8) => { const g = new THREE.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); put(k, g); },
    t: (k, R, r, x, y, z, ry = 0) => { const g = new THREE.TorusGeometry(R, r, 6, 18); g.rotateY(ry); g.translate(x, y, z); put(k, g); },
    g: (k, g) => put(k, g),
  };
}

// ======================================================================================= Hospital 157
export function salaHospital(S, O, fis) {
  const W = S.ancho, L = S.largo, H = S.alto, hw = W / 2, J = new Junta(), g = new THREE.Group(); g.name = 'kit_sala_hospital157';
  const anio = S.epoca || 1920, viejo = anio < 1950;
  const F = (x, y, z, sx, sy, sz, tipo = 'mueble') => fis.caja(O.x + x, O.y + y, O.z + z, sx, sy, sz, 0, { tipo });
  const zM = -5.5, zT = -17, xMuro = hw - 0.012;   // mampara, tabique de la sala de camas, cara del friso pintado
  const dosPisos = (S.pisos || 1) >= 2, Y2 = H + 0.4;   // N4-HOSP2: 2.º piso (losa de 0,4 m) con escalera y ascensor
  let sem = 157 + anio; const rnd = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  // N0-UTIL3 (G2): R(id, x, y, z, ry, esc) → Junta aparte con el respaldo procedural de esa pieza; al final, montarEnKit pone la malla
  // del índice (frente +z, pivote al piso) y oculta el respaldo solo si TODAS las copias de ese id se pusieron. Colisiones F() intactas.
  const ESC_G2 = { macetero: [0.75, 0.95, 0.75], balanza_columna: [1, 0.85, 1], telefono: [1, 0.9, 1], velador_blanco: [0.95, 1, 1], sillon_cuero: [0.85, 0.95, 0.85],
    esqueleto: [1, 1, 1], lavatorio_doble: [1.25, 1, 1], mesa_mudar: [1.3, 1, 1] };   // escala de cada malla G2 a la caja del respaldo/colisión
  const ESC_G3 = { biombo_plomo: [1.3, 0.95, 0.3], mandos_rx: [1.1, 1, 0.95], transformador: [1.3, 1.3, 1.3], mesa_operaciones: [1, 1, 1], anestesia: [1, 1, 1], autoclave: [1, 1, 1], cubo_pedal: [1, 1, 1] };   // rayos_x e incubadoras: las monta Q1 (partes móviles/vidrio)
  const RESP = new Map(), R = (id, x, y, z, ry = 0, esc) => { let e = RESP.get(id); if (!e) RESP.set(id, e = { JR: new Junta(), it: [] });
    e.it.push({ id, x: O.x + x, y: O.y + y, z: O.z + z, ry, esc }); return e.JR; };
  // Q1 (16-11): piezas con parte móvil o vidrio (rayos X, incubadoras): no van por montarEnKit. JQ(id) = Junta del respaldo procedural
  // (grupo hosp_respq1_<id>); QM: { id, fn } arma la malla cuando carga la utilería y, si fn() devuelve true, oculta ese respaldo.
  const RQ = new Map(), JQ = id => { let j = RQ.get(id); if (!j) RQ.set(id, j = new Junta()); return j; }, QM = [];

  // ------------------------------------------------ friso de pintura verde (1,35 m) en los muros, con filete oscuro; cortado en puertas y vanos
  const friso = (ax, az, bx, bz) => {   // tramo recto pegado al muro, a 1,2 cm de su cara (no coplanar)
    const lx = Math.abs(bx - ax), lz = Math.abs(bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    J.caja('friso', cx, 0.675, cz, lx || 0.02, 1.35, lz || 0.02);
    J.caja('filete', cx, 1.375, cz, (lx || 0.035), 0.05, (lz || 0.035));
  };
  for (const s of [-1, 1]) {
    friso(s * xMuro, -0.02, s * xMuro, zT + 0.08); friso(s * xMuro, zT - 0.08, s * xMuro, -L + 0.02);
  }
  friso(-hw + 0.02, -0.012, -1.65, -0.012); friso(1.65, -0.012, hw - 0.02, -0.012);   // muro de la entrada (paso de las hojas del portal)
  friso(-hw + 0.02, -L + 0.012, -1.0, -L + 0.012); friso(1.0, -L + 0.012, hw - 0.02, -L + 0.012);   // fondo (puerta del pabellón)

  // ------------------------------------------------ ventanas (guillotina, marco blanco, cielo de la época) en los dos muros largos
  const zVen = [-8.5, -12.5, -20.3, -25.5, -30.7], wv = 1.2, y0v = 1.6, y1v = 3.2;
  for (const s of [-1, 1]) for (const z of zVen) {
    const x = s * hw, yc = (y0v + y1v) / 2, hv = y1v - y0v;
    J.caja('dia', x - s * 0.02, yc, z, 0.01, hv, wv);                                   // cielo a 1,5 cm del muro
    for (const dz of [-1, 1]) J.caja('blanco', x - s * 0.075, yc, z + dz * (wv / 2 + 0.05), 0.11, hv + 0.2, 0.1);   // jambas
    J.caja('blanco', x - s * 0.075, y1v + 0.1, z, 0.11, 0.12, wv + 0.3);                 // dintel
    J.caja('blanco', x - s * 0.1, y0v - 0.05, z, 0.16, 0.06, wv + 0.36);                 // alféizar
    J.caja('blanco', x - s * 0.06, yc, z, 0.05, 0.06, wv);                               // travesaño de la guillotina
    J.caja('blanco', x - s * 0.055, yc, z, 0.04, hv, 0.04);                              // parteluz
    J.caja('cortina', x - s * 0.16, y1v - 0.12, z - s * 0 + (wv / 2 - 0.1), 0.04, 0.5, 0.26);   // visillo recogido a un lado
  }

  // ------------------------------------------------ HALL: felpudo, perchero, macetero, letrero sobre el paso de la mampara
  J.caja('goma', 0, 0.009, -1.6, 2.2, 0.018, 1.2);
  { const p = mueble(J, -3.2, -0.5);   // perchero de pie (N4-HOSP2: junto a la puerta; la escalera ocupa el muro izquierdo)
    p.c('madera', 0.03, 0.035, 1.8, 0, 0.9, 0, 8); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; p.b('madera', Math.cos(a) * 0.18, 0.04, Math.sin(a) * 0.18, 0.36, 0.05, 0.05, -a); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; p.c('laton', 0.012, 0.012, 0.18, Math.cos(a) * 0.08, 1.7, Math.sin(a) * 0.08, 6, 0, 0.9); }
    p.b('abrigo', 0.12, 1.4, 0, 0.12, 0.6, 0.32); p.s('sombrero', 0.13, 0, 1.86, 0, 1, 0.45, 1); F(-3.2, 0.9, -0.5, 0.45, 1.8, 0.45); }
  for (const [x, z] of [[2.6, -0.5], [-2.4, zM + 0.45], [2.4, zM + 0.45]]) {   // maceteros con helechos
    const p = mueble(R('macetero', x, 0, z, 0, ESC_G2.macetero), x, z); p.c('greda', 0.22, 0.16, 0.42, 0, 0.21, 0, 12);   // N0-UTIL3
    for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = 0.05 + rnd() * 0.18; p.s('hoja', 0.12 + rnd() * 0.06, Math.cos(a) * r, 0.55 + rnd() * 0.25, Math.sin(a) * r, 1, 0.55, 1, 7, 5); }
    F(x, 0.4, z, 0.45, 0.8, 0.45); }
  cartel(g, texCartel(['HOSPITAL', viejo ? 'EDIFICIO 157 · BRADEN COPPER CO.' : 'EDIFICIO 157 · SOC. MINERA EL TENIENTE'], '#1f3a2c', '#efe8d2', 768, 200), 3.0, 0.78, 0, 3.05, zM + 0.11, 0);
  J.caja('madera', 0, 3.05, zM + 0.07, 3.16, 0.92, 0.04);   // tablero del letrero (detrás del cartel, 2 cm), colgado del cielo
  for (const s of [-1, 1]) J.caja('negro', s * 1.3, (3.51 + H) / 2, zM + 0.07, 0.015, H - 3.51, 0.015);

  // ------------------------------------------------ MAMPARA de madera y vidrio entre el hall y la sala de espera (paso de 3,6 m)
  for (const s of [-1, 1]) {
    const a = s * 1.8, b = s > 0 ? hw - 0.005 : (dosPisos ? -5.6 : -hw + 0.005), xc = (a + b) / 2, w = Math.abs(b - a);   // N4-HOSP2: el ala izquierda termina en la escalera
    J.caja('madera', xc + s * 0.03, 0.5, zM, w - 0.06, 1.0, 0.08);                   // tablero bajo
    for (let k = 0; k < Math.floor(w / 0.9); k++) for (const dz of [-1, 1]) J.caja('maderaOsc', a + s * (0.55 + k * 0.9), 0.5, zM + dz * 0.048, 0.6, 0.6, 0.016);   // cuarterones (resaltan 0,8 cm)
    J.caja('madera', xc, 1.05, zM, w, 0.1, 0.12);                                     // travesaño medio
    J.caja('vidrio', xc, 1.75, zM, w - 0.1, 1.3, 0.012);
    for (let x = a + s * 0.9; Math.abs(x) < Math.abs(b) - 0.3; x += s * 0.9) J.caja('madera', x, 1.75, zM, 0.05, 1.3, 0.05);   // junquillos
    J.caja('madera', xc, 2.45, zM, w, 0.1, 0.12); J.caja('maderaOsc', xc, 2.53, zM, w + 0.0, 0.05, 0.16);   // remate
    J.caja('madera', a, 1.27, zM, 0.12, 2.54, 0.14);                                   // pie derecho en el paso
    F(xc, 1.27, zM, w, 2.54, 0.16, 'muro');
  }

  // ------------------------------------------------ SALA DE ESPERA
  const banca = (X, Z, rot, Lb, Y = 0) => {   // banca de listones con respaldo (frente +z local: hacia donde mira quien se sienta)
    const p = mueble(R('banca_espera', X, Y, Z, rot, [Lb / 2.2, 1, 1]), X, Z, rot, Y);   // C2: banca FINA (costados de fierro fundido); las cajas quedan de respaldo
    for (let i = 0; i < 4; i++) p.b('madera', 0, 0.44, -0.16 + i * 0.105, Lb, 0.035, 0.085);                 // asiento de 4 listones
    for (const dx of [-Lb / 2 + 0.12, Lb / 2 - 0.12, ...(Lb > 2.2 ? [0] : [])]) {
      p.b('maderaOsc', dx, 0.21, 0.13, 0.06, 0.42, 0.06); p.b('maderaOsc', dx, 0.45, -0.2, 0.06, 0.9, 0.06, 0, -0.12);   // patas y montante del respaldo
      p.b('maderaOsc', dx, 0.41, -0.02, 0.05, 0.05, 0.4);                                                          // larguero bajo el asiento
    }
    for (const y of [0.68, 0.84]) p.b('madera', 0, y, -0.205 - (y - 0.45) * 0.12, Lb, 0.09, 0.03, 0, -0.12);   // respaldo
  };
  for (const s of [-1, 1]) { banca(s * (hw - 0.42), -10.5, -s * Math.PI / 2, 2.2); F(s * (hw - 0.4), 0.45, -10.5, 0.6, 0.9, 2.2); }   // junto al muro, entre ventanas
  for (const z of [-8.2, -11.0, -13.6]) for (const s of z < -13 ? [-1] : [-1, 1]) { banca(s * 3.4, z, Math.PI, 2.6); F(s * 3.4, 0.45, z, 2.6, 0.9, 0.55); }   // filas mirando al mesón
  // radiadores de fierro bajo las ventanas de la espera
  for (const s of [-1, 1]) for (const z0 of [-8.5, -12.5]) {
    const x = s * (hw - 0.14), z = dosPisos && s < 0 && z0 === -8.5 ? -8.85 : z0;   // N4-HOSP2: deja libre el pie de la escalera
    { const J = R('radiador', x, 0, z, -s * Math.PI / 2);   // C2: radiador de columnas FINO (respaldo: las cajas)
    for (let i = 0; i < 11; i++) J.caja('radiador', x, 0.46, z - 0.45 + i * 0.09, 0.16, 0.62, 0.06);
    J.caja('radiador', x, 0.79, z, 0.1, 0.04, 1.0); J.caja('radiador', x, 0.14, z, 0.08, 0.04, 1.0);
    for (const dz of [-0.45, 0.45]) J.caja('radiador', x, 0.07, z + dz, 0.14, 0.14, 0.06); }
    F(x, 0.4, z, 0.2, 0.8, 1.0);
  }
  // reloj de pared (muro izquierdo) y carteles
  { const x = -hw + 0.04; J.add('madera', new THREE.CylinderGeometry(0.26, 0.26, 0.06, 24).rotateZ(Math.PI / 2).translate(x + 0.01, 2.85, -10.5));
    J.add('esfera', new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24).rotateZ(Math.PI / 2).translate(x + 0.045, 2.85, -10.5));
    J.caja('negro', x + 0.062, 2.85 + 0.07, -10.5, 0.008, 0.15, 0.022); J.caja('negro', x + 0.064, 2.85, -10.5 + 0.08, 0.008, 0.02, 0.17, 0, 0.5);
    J.add('madera', new THREE.BoxGeometry(0.04, 0.22, 0.12).translate(x + 0.01, 2.5, -10.5)); }
  cartel(g, texCartel(['SALA DE ESPERA']), 1.4, 0.44, hw - 0.03, 2.75, -10.5, -Math.PI / 2);
  cartel(g, texCartel(['SILENCIO'], '#f1eee4', '#8a1c1c'), 1.1, 0.34, -hw + 0.03, 3.45, -10.5, Math.PI / 2);
  cartel(g, texCartel(viejo ? ['SE PROHÍBE', 'ESCUPIR EN EL SUELO'] : ['VACUNACIÓN', 'NIÑOS: LUNES Y JUEVES'], '#f1eee4', '#1f3a2c', 384, 200), 0.62, 0.32, -hw + 0.03, 1.85, -14.9, Math.PI / 2);
  // balanza de columna (pesar a los pacientes)
  { const bx = dosPisos ? -4.95 : -hw + 0.7, bz = dosPisos ? -6.4 : -7.0, p = mueble(R('balanza_columna', bx, 0, bz, Math.PI / 2, ESC_G2.balanza_columna), bx, bz, Math.PI / 2);   // N4-HOSP2: fuera de la escalera · N0-UTIL3
    p.b('fierroN', 0, 0.06, 0.1, 0.42, 0.12, 0.55); p.b('goma', 0, 0.128, 0.12, 0.36, 0.012, 0.45); p.c('fierroN', 0.03, 0.035, 1.25, 0, 0.75, -0.13, 8);
    p.b('laton', 0, 1.38, -0.05, 0.035, 0.035, 0.5); p.b('laton', 0, 1.38, 0.08, 0.06, 0.06, 0.04); p.b('fierroN', 0, 1.6, -0.14, 0.06, 0.4, 0.04);
    F(bx, 0.75, bz, 0.6, 1.5, 0.5); }
  // escritorio del médico de turno, silla, fichero y teléfono de magneto en el muro
  { const X = -hw + 1.1, Z = -15.4, p = mueble(J, X, Z, Math.PI / 2);   // frente hacia +x (a la sala)
    p.b('madera', 0, 0.76, 0, 1.4, 0.04, 0.72); for (const s of [-1, 1]) p.b('maderaOsc', s * 0.5, 0.37, 0, 0.36, 0.74, 0.62);
    for (const s of [-1, 1]) for (const y of [0.2, 0.45, 0.65]) p.b('laton', s * 0.5, y, 0.316, 0.08, 0.02, 0.012);
    p.b('papel', -0.2, 0.786, 0.05, 0.3, 0.012, 0.22, 0.2); p.b('papel', 0.3, 0.79, 0.0, 0.24, 0.018, 0.32);
    p.c('negro', 0.03, 0.035, 0.06, 0.45, 0.81, -0.15, 8);   // tintero
    p.b('madera', 0, 0.46, 0.55, 0.42, 0.04, 0.42); for (const [dx, dz] of [[-0.18, 0.37], [0.18, 0.37], [-0.18, 0.73], [0.18, 0.73]]) p.b('maderaOsc', dx, 0.23, dz, 0.035, 0.46, 0.035);
    p.b('madera', 0, 0.72, 0.75, 0.42, 0.5, 0.03);   // silla
    F(X, 0.4, Z, 0.75, 0.8, 1.4); }
  { const p = mueble(J, -hw + 0.3, -13.6, Math.PI / 2);   // fichero de 4 cajones
    p.b('verdeOsc', 0, 0.68, 0, 0.5, 1.36, 0.5); for (let i = 0; i < 4; i++) { p.b('verdeOsc', 0, 0.2 + i * 0.32, 0.258, 0.44, 0.28, 0.012); p.b('laton', 0, 0.28 + i * 0.32, 0.27, 0.12, 0.025, 0.02); }
    F(-hw + 0.3, 0.7, -13.6, 0.5, 1.4, 0.5); }
  { const p = mueble(R('telefono', -hw + 0.13, 1.3, -16.3, Math.PI / 2, ESC_G2.telefono), -hw + 0.02, -16.3, Math.PI / 2);   // teléfono de magneto en caja de madera · N0-UTIL3
    p.b('madera', 0, 1.6, 0.08, 0.26, 0.5, 0.12); for (const s of [-1, 1]) p.s('laton', 0.045, s * 0.06, 1.78, 0.15); p.c('negro', 0.03, 0.04, 0.12, 0, 1.48, 0.2, 8, Math.PI / 2);
    p.c('negro', 0.025, 0.025, 0.16, 0.15, 1.58, 0.15, 8); p.b('madera', 0, 1.33, 0.12, 0.3, 0.03, 0.2); }

  // ------------------------------------------------ MESÓN DE ENFERMERÍA (en L) y VITRINA DE MEDICAMENTOS contra el muro derecho
  { const xF = 2.6;   // cara del mesón hacia la sala
    const tramo = (cx, cz, sx, sz, fx, fz) => {   // cuerpo, tapa saliente, zócalo negro rehundido y cuarterones en la cara (fx, fz)
      const L1 = fx ? sz : sx, J = R('meson_enfermeria', cx, 0, cz, fx ? -fx * Math.PI / 2 : (fz < 0 ? Math.PI : 0), [L1 / 2.0, 1, 1]);   // N0-UTIL3: tramo = malla del mesón (2,0 m) estirada a su largo
      J.caja('madera', cx, 0.52, cz, sx, 0.96, sz); J.caja('maderaOsc', cx, 1.02, cz, sx + 0.08, 0.05, sz + 0.08);
      J.caja('negro', cx, 0.04, cz, sx - 0.06, 0.08, sz - 0.06);
      const n = Math.max(1, Math.round((fx ? sz : sx) / 0.75));
      for (let i = 0; i < n; i++) { const u = -((fx ? sz : sx) / 2) + ((fx ? sz : sx) / n) * (i + 0.5);
        J.caja('maderaOsc', fx ? cx + fx * (sx / 2 + 0.008) : cx + u, 0.55, fz ? cz + fz * (sz / 2 + 0.008) : cz + u, fx ? 0.016 : (sx / n) - 0.16, 0.62, fx ? (sz / n) - 0.16 : 0.016); }
      F(cx, 0.52, cz, sx + 0.08, 1.05, sz + 0.08);
    };
    tramo(xF + 0.3, -15.0, 0.6, 2.8, -1, 0);   // frente a la sala (de z −13,6 a −16,4)
    tramo(xF + 1.3, -13.9, 1.4, 0.6, 0, 1);    // retorno hacia el muro (deja paso de 1,6 m a la enfermera)
    // sobre el mesón: libro de registro abierto, timbre, frascos, lámpara de mesa de pantalla verde (1967: teléfono negro)
    { const JM = RESP.get('meson_enfermeria').JR;   // N0-UTIL3: el libro va con el respaldo (la malla del mesón ya trae libros en la tapa)
      JM.caja('papel', xF + 0.3, 1.055, -14.6, 0.34, 0.012, 0.46, 0.15); JM.caja('lomo', xF + 0.3, 1.06, -14.6, 0.36, 0.008, 0.03, 0.15); }
    J.add('laton', new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(xF + 0.2, 1.045, -15.5));
    if (viejo) { J.add('laton', new THREE.CylinderGeometry(0.06, 0.07, 0.03, 10).translate(xF + 0.45, 1.06, -16.1)); J.add('laton', new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6).translate(xF + 0.45, 1.22, -16.1));
      J.add('pantalla', new THREE.SphereGeometry(0.14, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 0.7).translate(xF + 0.45, 1.36, -16.1)); }
    else { J.caja('negro', xF + 0.4, 1.09, -16.1, 0.2, 0.08, 0.24); J.add('negro', new THREE.CylinderGeometry(0.025, 0.025, 0.24, 8).rotateX(Math.PI / 2).translate(xF + 0.4, 1.16, -16.1)); }
    for (let i = 0; i < 4; i++) J.add(['ambar', 'azul', 'blancoF', 'verdeV'][i], new THREE.CylinderGeometry(0.03, 0.03, 0.13, 8).translate(xF + 0.42, 1.11, -14.0 - i * 0.09));
    cartel(g, texCartel(['ENFERMERÍA'], '#f1eee4', '#1f3a2c', 512, 128), 1.1, 0.28, xF - 0.03, 0.62, -15.0, -Math.PI / 2);   // sobre los cuarterones (a 2,3 cm)
    // vitrina de medicamentos: cuerpo blanco esmaltado, puertas de vidrio, repisas y frascos de colores; cajones abajo
    const xV = hw - 0.26, zV = -15.0, wv2 = 1.7, p = mueble(R('vitrina_medicamentos', xV, 0, zV, -Math.PI / 2, [1.01, 1.08, 0.96]), xV, zV, -Math.PI / 2);   // frente local +z → −x (hacia el mesón) · G9M (H09): vitrina FINA (la de instrumental, solo con frascos); las cajas son su respaldo
    p.b('blanco', 0, 0.42, 0, wv2, 0.84, 0.44); for (const s of [-1, 1]) p.b('laton', s * 0.42, 0.62, 0.228, 0.12, 0.025, 0.02);
    for (const s of [-1, 1]) p.b('blanco', s * (wv2 / 2 - 0.03), 1.5, -0.02, 0.06, 1.32, 0.4);   // costados de la parte alta
    p.b('blanco', 0, 1.5, -0.2, wv2 - 0.06, 1.32, 0.02); p.b('blanco', 0, 2.2, 0, wv2 + 0.06, 0.08, 0.46);   // fondo y cornisa
    p.b('blanco', 0, 0.855, -0.02, wv2 - 0.08, 0.03, 0.36);   // tabla de la fila de abajo
    for (const y of [1.18, 1.56, 1.94]) p.b('vidrioR', 0, y, -0.02, wv2 - 0.08, 0.015, 0.34);   // repisas de vidrio
    for (const y of [0.86, 1.18, 1.56, 1.94]) for (let i = 0; i < 11; i++) {   // frascos (la fila de abajo, sobre la tapa del cuerpo)
      const r = 0.025 + rnd() * 0.02, h = 0.08 + rnd() * 0.12, k = ['ambar', 'azul', 'blancoF', 'verdeV', 'ambar'][Math.floor(rnd() * 5)];
      p.c(k, r, r, h, -wv2 / 2 + 0.12 + i * 0.135 + (rnd() - 0.5) * 0.03, y + 0.012 + h / 2, -0.08 + (rnd() - 0.5) * 0.1, 8);
      if (rnd() < 0.6) p.c('negro', r * 0.55, r * 0.55, 0.025, -wv2 / 2 + 0.12 + i * 0.135, y + 0.025 + h, -0.08, 6);
    }
    for (const s of [-1, 1]) { p.b('vidrio', s * wv2 / 4, 1.52, 0.17, wv2 / 2 - 0.08, 1.24, 0.01);   // dos puertas de vidrio con marco
      p.b('blancoM', s * wv2 / 4, 0.9, 0.175, wv2 / 2 - 0.04, 0.04, 0.03); p.b('blancoM', s * wv2 / 4, 2.14, 0.175, wv2 / 2 - 0.04, 0.04, 0.03);
      p.b('blancoM', s * (wv2 / 2 - 0.05), 1.52, 0.175, 0.04, 1.24, 0.03); p.b('blancoM', s * 0.02, 1.52, 0.175, 0.03, 1.24, 0.03); }
    F(xV, 1.1, zV, 0.48, 2.25, wv2 + 0.06);
    cartel(g, texCartel(['FARMACIA'], '#1f3a2c', '#efe8d2', 512, 128), 0.9, 0.22, xV - 0.245, 2.36, zV, -Math.PI / 2);
    cartel(g, texCalendario(anio, viejo ? 'MAYO' : 'NOVIEMBRE'), 0.32, 0.4, hw - 0.025, 1.9, -13.2, -Math.PI / 2);
  }

  // ------------------------------------------------ TABIQUE a la sala de camas con puerta de dos hojas abiertas
  { const t = 0.14, zc = zT, hp = 2.6, ap = 1.0;
    for (const s of [-1, 1]) { const a = s * ap, b = s * (hw - 0.005), xc = (a + b) / 2, w = Math.abs(b - a);
      J.caja('muroInt', xc, H / 2, zc, w, H - 0.004, t); F(xc, H / 2, zc, w, H, t + 0.02, 'muro');
      for (const dz of [-1, 1]) { J.caja('friso', xc + s * 0.06, 0.675, zc + dz * (t / 2 + 0.012), w - 0.12, 1.35, 0.02); J.caja('filete', xc + s * 0.06, 1.375, zc + dz * (t / 2 + 0.017), w - 0.12, 0.05, 0.035); } }
    J.caja('muroInt', 0, (hp + H) / 2, zc, 2 * ap + 0.02, H - hp - 0.004, t); F(0, (hp + H) / 2, zc, 2 * ap, H - hp, t + 0.02, 'muro');
    for (const s of [-1, 1]) J.caja('blanco', s * (ap - 0.03), hp / 2, zc, 0.12, hp, t + 0.05);   // jambas (salen 2,5 cm por lado)
    J.caja('blanco', 0, hp + 0.05, zc, 2 * ap + 0.06, 0.12, t + 0.05);
    for (const s of [-1, 1]) {   // hojas (abiertas 78°, hacia la sala de camas): tablero abajo, vidrio arriba
      const piv = new THREE.Matrix4().makeRotationY(-s * 1.36).setPosition(s * (ap - 0.1), 0, zc - t / 2 - 0.03);
      const hoja = (k, x, y, sx, sy, sz) => { const gg = new THREE.BoxGeometry(sx, sy, sz).translate(-s * x, y, 0); gg.applyMatrix4(piv); J.add(k, gg); };
      hoja('blanco', 0.45, 0.72, 0.86, 1.36, 0.045); hoja('vidrio', 0.45, 1.86, 0.7, 0.88, 0.01);
      hoja('blanco', 0.06, 1.86, 0.12, 0.92, 0.05); hoja('blanco', 0.84, 1.86, 0.12, 0.92, 0.05); hoja('blanco', 0.45, 2.37, 0.86, 0.1, 0.05);
      hoja('laton', 0.8, 1.05, 0.04, 0.12, 0.07);
    }
    cartel(g, texCartel(['SALA DE MEDICINA', 'HOMBRES']), 1.6, 0.42, 0, 3.15, zc + t / 2 + 0.012, 0);
  }

  // ------------------------------------------------ SALA DE CAMAS: 12 camas de hierro esmaltado, veladores, biombos, carro, porta-sueros
  const zCamas = [-19.0, -21.6, -24.2, -26.8, -29.4, -32.0];
  const cama = (X, Z, rot, k, Y = 0) => {   // marco local: cabecera en z = 0 (contra el muro), pies hacia +z; ancho en x (Y: 2.º piso)
    const p = mueble(R(k % 3 === 1 ? 'cama_hospital2' : 'cama_hospital', X + 0.975 * Math.sin(rot), Y, Z + 0.975 * Math.cos(rot), rot), X, Z, rot, Y), Lc = 1.95, Ac = 0.92, cf = 'catre';   // C2: cama FINA de fierro esmaltado con ficha
    for (const [dx, z, h] of [[-Ac / 2, 0.03, 1.15], [Ac / 2, 0.03, 1.15], [-Ac / 2, Lc, 0.85], [Ac / 2, Lc, 0.85]]) { p.c(cf, 0.025, 0.025, h, dx, h / 2, z, 8); p.s('laton', 0.035, dx, h + 0.02, z, 1, 1, 1, 8, 6); }
    for (const [z, h] of [[0.03, 1.15], [Lc, 0.85]]) {   // cabecera y piecera: travesaños y barrotes
      p.c(cf, 0.018, 0.018, Ac, 0, h - 0.08, z, 6, 0, Math.PI / 2); p.c(cf, 0.018, 0.018, Ac, 0, 0.5, z, 6, 0, Math.PI / 2);
      for (let i = 1; i < 7; i++) p.c(cf, 0.009, 0.009, h - 0.58, -Ac / 2 + i * Ac / 7, (h - 0.08 + 0.5) / 2, z, 5);
    }
    for (const s of [-1, 1]) p.b(cf, s * Ac / 2, 0.42, Lc / 2, 0.03, 0.05, Lc - 0.05);   // largueros
    p.b('colchon', 0, 0.535, Lc / 2 + 0.01, Ac - 0.06, 0.15, Lc - 0.1);                     // colchón con sábana
    p.b(k % 3 === 1 ? 'frazada2' : 'frazada', 0, 0.6, Lc * 0.62, Ac - 0.02, 0.04, Lc * 0.7);   // frazada (cae 2 cm más allá del colchón)
    p.b('colchon', 0, 0.628, Lc * 0.28 + 0.02, Ac - 0.03, 0.012, 0.16);                      // embozo de la sábana
    p.s('colchon', 1, 0, 0.66, 0.26, 0.3, 0.08, 0.2, 10, 6);                                 // almohada
    p.b('papel', 0, 0.68, Lc + 0.035, 0.18, 0.24, 0.012);                                    // ficha clínica colgada en la piecera
  };
  zCamas.forEach((z, i) => { for (const s of [-1, 1]) { cama(s * (hw - 0.07), z, s > 0 ? -Math.PI / 2 : Math.PI / 2, i + (s > 0 ? 1 : 0)); F(s * (hw - 1.05), 0.5, z, 2.0, 1.0, 0.98); } });
  // veladores entre camas (bajo las ventanas): blanco esmaltado con jarro de enlozado y vaso
  for (const s of [-1, 1]) for (const z of [-20.3, -25.5, -30.7]) {
    const x = s * (hw - 0.3), JV = R('velador_blanco', x, 0, z, -s * Math.PI / 2, ESC_G2.velador_blanco);   // N0-UTIL3: la malla trae jarro y vaso (s7)
    JV.caja('blanco', x, 0.37, z, 0.4, 0.74, 0.42); JV.caja('blancoM', x - s * 0.205, 0.45, z, 0.012, 0.36, 0.34);
    JV.add('laton', new THREE.SphereGeometry(0.02, 6, 5).translate(x - s * 0.22, 0.5, z));
    JV.add('blancoF', new THREE.CylinderGeometry(0.06, 0.07, 0.18, 12).translate(x, 0.83, z - 0.08)); JV.add('azul', new THREE.TorusGeometry(0.062, 0.008, 5, 14).rotateX(Math.PI / 2).translate(x, 0.92, z - 0.08));
    JV.add('vidrioR', new THREE.CylinderGeometry(0.03, 0.026, 0.1, 8).translate(x, 0.79, z + 0.1));
    F(x, 0.37, z, 0.42, 0.74, 0.44);
  }
  // biombos de tres hojas (tubo blanco y tela), en zigzag, entre camas
  const biombo = (X, Z, rot) => {   // tres hojas de 0,62 m en zigzag (la del medio adelantada 12 cm)
    const p = mueble(R('biombo_hospital', X, 0, Z, rot), X, Z, rot), w = 0.62, h = 1.75;   // C2: biombo FINO (tubo con esquinas dobladas, tela fruncida)
    for (const i of [-1, 0, 1]) {
      const a = i === 0 ? -0.4 : 0.4, cx = i * 0.6, cz = i === 0 ? 0.12 : 0, d = w / 2 - 0.02;
      p.b('tela', cx, 0.25 + h / 2 - 0.1, cz, w - 0.06, h - 0.2, 0.012, a);
      for (const u of [-1, 1]) p.c('catre', 0.014, 0.014, h + 0.1, cx + u * Math.cos(a) * d, (h + 0.1) / 2, cz - u * Math.sin(a) * d, 6);
      for (const y of [h + 0.02, 0.22]) p.b('catre', cx, y, cz, w, 0.025, 0.025, a);
    }
  };
  biombo(hw - 2.55, -22.9, Math.PI / 2); F(hw - 2.55, 0.9, -22.9, 0.4, 1.9, 1.9);
  biombo(-hw + 2.55, -28.1, -Math.PI / 2); F(-hw + 2.55, 0.9, -28.1, 0.4, 1.9, 1.9);
  biombo(2.7, -33.0, 0.25); F(2.7, 0.9, -33.0, 1.9, 1.9, 0.6);
  // porta-sueros (irrigador de vidrio en su pie) junto a una cama
  { const p = mueble(R('porta_sueros', -hw + 2.25, 0, -24.9, 0), -hw + 2.25, -24.9); p.c('catre',   /* C2: porta-sueros FINO */ 0.012, 0.012, 1.8, 0, 0.9, 0, 6); for (let i = 0; i < 3; i++) p.b('catre', 0, 0.03, 0, 0.42, 0.025, 0.025, i * 2.1);
    p.b('catre', 0, 1.78, 0, 0.3, 0.02, 0.02); p.c('vidrioR', 0.05, 0.04, 0.2, 0.13, 1.62, 0, 10); p.c('goma', 0.004, 0.004, 0.7, 0.13, 1.17, 0, 4); }
  // carro de curaciones: dos bandejas de fierro blanco con riñoneras y frascos
  { const p = mueble(R('carro_curaciones', -1.3, 0, -21.0, 0.3), -1.3, -21.0, 0.3);   // C2: carro FINO
    for (const y of [0.3, 0.82]) p.b('blanco', 0, y, 0, 0.75, 0.025, 0.45); for (const [dx, dz] of [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]]) { p.c('catre', 0.012, 0.012, 0.86, dx, 0.47, dz, 6); p.s('negro', 0.03, dx, 0.03, dz, 1, 1, 1, 6, 4); }
    p.s('blancoF', 0.12, -0.12, 0.85, 0, 1.2, 0.3, 0.6, 10, 5); p.c('ambar', 0.035, 0.035, 0.14, 0.2, 0.9, 0.08, 8); p.c('azul', 0.03, 0.03, 0.12, 0.25, 0.9, -0.1, 8);
    p.b('colchon', 0.1, 0.34, 0, 0.4, 0.06, 0.3); F(-1.3, 0.45, -21.0, 0.85, 0.9, 0.6); }
  // silla de ruedas (de madera y mimbre, ruedas grandes) junto a la puerta y camilla con ruedas al fondo
  { const p = mueble(R('silla_ruedas', -2.4, 0, -18.3, 0.6), -2.4, -18.3, 0.6);   // C2: silla de ruedas FINA
    p.b('mimbre', 0, 0.5, 0, 0.5, 0.05, 0.48); p.b('mimbre', 0, 0.85, -0.24, 0.5, 0.65, 0.04, 0, -0.15); p.b('mimbre', 0, 0.28, 0.32, 0.4, 0.04, 0.2, 0, 0.6);
    for (const s of [-1, 1]) { p.t('negro', 0.3, 0.018, s * 0.29, 0.31, -0.02, Math.PI / 2); p.t('negro', 0.08, 0.012, s * 0.18, 0.08, 0.32, Math.PI / 2); p.b('maderaOsc', s * 0.25, 0.68, -0.02, 0.04, 0.04, 0.5); }
    F(-2.4, 0.5, -18.3, 0.75, 1.0, 0.75); }
  { const p = mueble(R('camilla', -2.4, 0, -32.4, Math.PI / 2), -2.4, -32.4, Math.PI / 2);   // C2: camilla FINA
    p.b('colchon', 0, 0.8, 0, 0.62, 0.06, 1.9); p.b('negro', 0, 0.75, 0, 0.66, 0.04, 1.94);
    for (const [dx, dz] of [[-0.28, -0.85], [0.28, -0.85], [-0.28, 0.85], [0.28, 0.85]]) { p.c('catre', 0.015, 0.015, 0.7, dx, 0.4, dz, 6); p.s('negro', 0.045, dx, 0.045, dz, 1, 1, 1, 6, 4); }
    F(-2.4, 0.45, -32.4, 1.95, 0.9, 0.7); }
  // mesa de la enfermera de sala con lámpara y florero (al centro, entre las filas)
  { const p = mueble(J, 0.6, -26.2, 0);
    p.b('madera', 0, 0.76, 0, 1.3, 0.04, 0.7); for (const [dx, dz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) p.b('maderaOsc', dx, 0.37, dz, 0.05, 0.74, 0.05);
    p.b('mantel', 0, 0.787, 0, 1.36, 0.016, 0.76); p.c('blancoF', 0.05, 0.07, 0.2, -0.4, 0.895, 0.1, 10);
    for (let i = 0; i < 6; i++) p.s(['flor1', 'flor2', 'hoja'][i % 3], 0.045, -0.4 + (rnd() - 0.5) * 0.12, 1.04 + rnd() * 0.08, 0.1 + (rnd() - 0.5) * 0.12, 1, 1, 1, 6, 5);
    p.b('papel', 0.25, 0.8, -0.05, 0.3, 0.012, 0.22, 0.3);
    p.b('madera', 0, 0.46, 0.65, 0.42, 0.04, 0.42); for (const [dx, dz] of [[-0.18, 0.47], [0.18, 0.47], [-0.18, 0.83], [0.18, 0.83]]) p.b('maderaOsc', dx, 0.23, dz, 0.035, 0.46, 0.035);
    p.b('madera', 0, 0.72, 0.85, 0.42, 0.5, 0.03);
    F(0.6, 0.4, -26.2, 1.4, 0.8, 0.8); F(0.6, 0.45, -25.4, 0.45, 0.9, 0.45); }
  // puerta cerrada del pabellón y rayos X en el muro del fondo (hoja a 1,5 cm del muro, marco a 3 cm)
  { const z = -L;
    J.caja('blanco', 0, 1.25, z + 0.04, 1.7, 2.5, 0.05); J.caja('vidrioR', 0, 1.85, z + 0.07, 1.0, 0.7, 0.01);
    for (const s of [-1, 1]) J.caja('blancoM', s * 0.9, 1.33, z + 0.05, 0.12, 2.66, 0.1); J.caja('blancoM', 0, 2.7, z + 0.05, 1.92, 0.12, 0.1);
    J.caja('laton', 0.6, 1.1, z + 0.08, 0.05, 0.14, 0.04);
    cartel(g, texCartel(dosPisos ? ['ESCALERA DE SERVICIO', 'SOLO PERSONAL'] : ['PABELLÓN · RAYOS X', 'SOLO PERSONAL'], '#f1eee4', '#8a1c1c'), 1.5, 0.42, 0, 3.15, z + 0.03, 0);   // N4-HOSP2: el pabellón y los rayos X están arriba
    F(0, 1.3, z + 0.1, 2.0, 2.6, 0.2, 'muro'); }
  cartel(g, texCartel(viejo ? ['CRUZ ROJA', 'SALA DE HOMBRES · 1920'] : ['SALA DE HOMBRES'], '#f1eee4', '#8a1c1c', 512, 160), 0.9, 0.28, -hw + 0.025, 3.55, -25.5, Math.PI / 2);

  // ------------------------------------------------ 1967: Operación Valle (cajas de mudanza en el hall y aviso de traslado)
  if (!viejo) {
    for (const [x, y, z, sx, sy, sz, r] of [[3.3, 0.25, -0.75, 0.6, 0.5, 0.5, 0.1], [3.3, 0.71, -0.7, 0.5, 0.42, 0.45, -0.15], [4.05, 0.22, -1.0, 0.5, 0.44, 0.45, 0.3]]) {   // N4-HOSP2: junto a la puerta (el ascensor ocupa el rincón)
      const JC = R('caja_mudanza', x, y - sy / 2, z, r, [sx / 0.6, sy / 0.45, sz / 0.45]); JC.caja('carton', x, y, z, sx, sy, sz, r); JC.caja('cinta', x, y + sy / 2 + 0.004, z, 0.08, 0.008, sz + 0.004, r); }   // N0-UTIL3 (G8): cajas de malla (antes el cuerpo del for estaba dentro del comentario y no se dibujaban)
    F(3.6, 0.5, -0.85, 1.4, 1.0, 0.9);
    J.caja('madera', 2.9, 1.95, -0.03, 1.3, 1.0, 0.04);   // diario mural (sobre el friso del muro de la entrada; N4-HOSP2: antes en el muro de la escalera)
    cartel(g, texCartel(['OPERACIÓN VALLE', 'Inscripción de traslados a Rancagua', 'en la oficina de Bienestar'], '#f4efe2', '#1f3a2c', 512, 256), 1.1, 0.55, 2.9, 2.05, -0.072, Math.PI);
  }

  // ======================================================================== N4-HOSP2 (15-11-2026): 2.º PISO, ESCALERA y pozo del ASCENSOR
  // Pedido de Diego: «se perdió el segundo piso y el ascensor; el ascensor era parte importante del hospital». Planta del 2.º piso (y = Y2):
  //   hall de llegada (z 0 … −10,5): escalera a la izquierda (baranda alrededor del hueco), ascensor a la derecha, oficina del médico jefe (vidriada)
  //   · RAYOS X (z −10,5 … −18) · PABELLÓN DE OPERACIONES con lámpara cialítica (z −18 … −27,5) · MATERNIDAD con cunas e incubadoras (z −27,5 … −34).
  //   Ventanas: las mismas columnas que el 1.er piso (la fachada del kit tiene ventanas alineadas por piso). Losa con hueco de escalera y pozo.
  const ESC = { xa: -hw + 0.05, xb: -5.65, z0: -1.0, n: 26, T: 0.27 };   // escalera recta contra el muro izquierdo: sube hacia −z
  ESC.R = Y2 / ESC.n; ESC.zTop = ESC.z0 - (ESC.n - 1) * ESC.T; ESC.th = Math.atan2(ESC.R, ESC.T);
  const POZO = { x0: 4.4, x1: hw, z0: -1.6, z1: -4.4 };
  let ascensor = null;
  if (dosPisos) {
    const B = (k, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => J.caja(k, x, Y2 + y, z, sx, sy, sz, ry, rx, rz);
    const F2 = (x, y, z, sx, sy, sz, tipo) => F(x, Y2 + y, z, sx, sy, sz, tipo);
    const m2 = (X, Z, rot = 0) => mueble(J, X, Z, rot, Y2);
    const qX = th => ({ x: Math.sin(th / 2), y: 0, z: 0, w: Math.cos(th / 2) });
    // ---------------- losa (0,4 m) con cielo raso blanco abajo y baldosa en damero arriba; huecos: escalera y pozo del ascensor
    const xs = [-hw, -4.4, POZO.x0, hw], zs = [0, -0.9, POZO.z0, POZO.z1, ESC.zTop, -L];
    for (let i = 0; i < 3; i++) for (let k = 0; k < 5; k++) {
      const x0 = xs[i], x1 = xs[i + 1], z0 = zs[k], z1 = zs[k + 1];
      if ((i === 0 && k >= 1 && k <= 3) || (i === 2 && k === 2)) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z0 - z1;
      J.caja('losa', cx, (H + 0.015 + Y2) / 2, cz, w, Y2 - H - 0.015, d); J.caja('cielo', cx, H + 0.005, cz, w, 0.01, d);
      F(cx, (H + Y2) / 2, cz, w, Y2 - H, d, 'piso');
    }
    // cantos del hueco de la escalera (moldura blanca)
    J.caja('blancoM', -4.41, (H + Y2) / 2, (-0.9 + ESC.zTop) / 2, 0.02, Y2 - H + 0.02, -0.9 - ESC.zTop);
    J.caja('blancoM', (-hw - 4.4) / 2, (H + Y2) / 2, -0.89, hw - 4.4, Y2 - H + 0.02, 0.02);
    J.caja('blancoM', (-5.65 - 4.4) / 2, (H + Y2) / 2, ESC.zTop - 0.01, 1.25, Y2 - H + 0.02, 0.02);
    // ---------------- ESCALERA: peldaños de madera (huella con nariz), contrahuella oscura, costado cerrado, zanca, pasamanos y balaustres
    const xc = (ESC.xa + ESC.xb) / 2, wS = ESC.xb - ESC.xa;
    for (let i = 1; i < ESC.n; i++) {
      const hi = i * ESC.R, zA = ESC.z0 - (i - 1) * ESC.T, cz = zA - ESC.T / 2;
      J.caja('maderaOsc', xc, hi - ESC.R / 2, cz, wS, ESC.R, ESC.T);
      J.caja('madera', xc, hi + 0.0125, cz + 0.02, wS + 0.02, 0.025, ESC.T + 0.04);
      if (hi - ESC.R > 0.01) J.caja('muroInt', ESC.xb + 0.02, (hi - ESC.R) / 2, cz, 0.04, hi - ESC.R, ESC.T);
      F(xc, hi / 2, cz, wS, hi, ESC.T, 'escalera');
      if (i % 2 === 1) J.add('madera', new THREE.CylinderGeometry(0.022, 0.026, 0.9, 8).translate(ESC.xb - 0.04, hi + 0.47, cz));   // balaustres torneados
    }
    { // piezas inclinadas por los cantos de los peldaños: del peldaño iA al iB (centro de huella), dy sobre la nariz
      const nar = i => [ESC.z0 - (i - 0.5) * ESC.T, i * ESC.R];
      const incl = (k, x, sx, sy, iA, iB, dy, ext = 0) => { const [za, ya] = nar(iA), [zb, yb] = nar(iB), Lz = za - zb, Ly = yb - ya, Ls = Math.hypot(Lz, Ly), th = Math.atan2(Ly, Lz);
        J.caja(k, x, (ya + yb) / 2 + dy, (za + zb) / 2, sx, sy, Ls + ext, 0, th); return { zm: (za + zb) / 2, ym: (ya + yb) / 2 + dy, Ls, th }; };
      incl('maderaOsc', ESC.xb + 0.05, 0.06, 0.3, 0.5, ESC.n - 0.5, -0.16, 0.3);   // zanca
      const pm = incl('madera', ESC.xb - 0.04, 0.08, 0.06, 1, ESC.n - 1, 0.93);        // pasamanos (del pilar de arranque al de llegada)
      const pw = incl('laton', ESC.xa + 0.06, 0.035, 0.035, 2, ESC.n - 3, 0.88);       // pasamanos de bronce en el muro (no asoma sobre la losa)
      for (let t = -0.4; t <= 0.41; t += 0.2) J.caja('laton', ESC.xa + 0.03, pw.ym - 0.06 + t * pw.Ls * Math.sin(pw.th), pw.zm - t * pw.Ls * Math.cos(pw.th), 0.05, 0.1, 0.03);   // soportes
      fis.caja(O.x + ESC.xb - 0.04, O.y + pm.ym - 0.38, O.z + pm.zm, 0.1, 1.0, pm.Ls, 0, { tipo: 'baranda' }, qX(pm.th));
      // pilar de arranque con remate de bronce
      J.caja('maderaOsc', ESC.xb - 0.04, 0.6, ESC.z0 - 0.12, 0.15, 1.2, 0.15); J.add('laton', new THREE.SphereGeometry(0.075, 10, 8).translate(ESC.xb - 0.04, 1.27, ESC.z0 - 0.12));
      F(ESC.xb - 0.04, 0.6, ESC.z0 - 0.12, 0.18, 1.2, 0.18, 'mueble'); }
    // baranda del 2.º piso alrededor del hueco (madera con balaustres) y su colisión
    const baranda = (ax, az, bx, bz) => {
      const lx = bx - ax, lz = bz - az, Lb = Math.hypot(lx, lz), cx = (ax + bx) / 2, cz = (az + bz) / 2, ry = Math.atan2(lx, lz);
      B('madera', cx, 0.95, cz, 0.08, 0.06, Lb + 0.06, ry); B('madera', cx, 0.1, cz, 0.06, 0.05, Lb, ry);
      const n = Math.max(2, Math.round(Lb / 0.28));
      for (let i = 0; i <= n; i++) J.add('madera', new THREE.CylinderGeometry(0.022, 0.026, 0.82, 8).translate(ax + lx * i / n, Y2 + 0.53, az + lz * i / n));
      fis.caja(O.x + cx, O.y + Y2 + 0.55, O.z + cz, 0.1, 1.1, Lb, ry, { tipo: 'baranda' });
    };
    baranda(-4.43, -0.93, -4.43, ESC.zTop - 0.03); baranda(-hw + 0.02, -0.93, -4.43, -0.93); baranda(-5.62, ESC.zTop - 0.03, -4.43, ESC.zTop - 0.03);
    for (const [x, z] of [[-4.43, -0.93], [-4.43, ESC.zTop - 0.03], [-5.62, ESC.zTop - 0.03]]) { B('maderaOsc', x, 0.6, z, 0.14, 1.2, 0.14); J.add('laton', new THREE.SphereGeometry(0.07, 10, 8).translate(x, Y2 + 1.26, z)); }

    // ---------------- friso, ventanas y tabiques del 2.º piso (mismo lenguaje que el 1.º)
    const friso2 = (ax, az, bx, bz) => { const lx = Math.abs(bx - ax), lz = Math.abs(bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
      J.caja('friso', cx, Y2 + 0.675, cz, lx || 0.02, 1.35, lz || 0.02); J.caja('filete', cx, Y2 + 1.375, cz, lx || 0.035, 0.05, lz || 0.035); };
    const zTab = [-10.5, -18, -27.5];
    const cortes = (a, b, extra = []) => { let r = [[a, b]]; for (const [u, v] of [...zTab.map(z => [z + 0.08, z - 0.08]), ...extra]) r = r.flatMap(([p, q]) => [[p, Math.max(q, u)], [Math.min(p, v), q]]).filter(([p, q]) => p - q > 0.15); return r; };
    for (const [a, b] of cortes(-0.02, -L + 0.02)) friso2(-xMuro, a, -xMuro, b);
    for (const [a, b] of cortes(-0.02, -L + 0.02, [[POZO.z0 + 0.05, POZO.z1 - 0.05]])) friso2(xMuro, a, xMuro, b);
    friso2(-hw + 0.02, -0.012, POZO.x0 - 0.05, -0.012); friso2(-hw + 0.02, -L + 0.012, hw - 0.02, -L + 0.012);
    for (const s of [-1, 1]) for (const z of zVen) {
      const x = s * hw, yc = Y2 + (y0v + y1v) / 2, hv = y1v - y0v;
      J.caja('dia', x - s * 0.02, yc, z, 0.01, hv, wv);
      for (const dz of [-1, 1]) J.caja('blanco', x - s * 0.075, yc, z + dz * (wv / 2 + 0.05), 0.11, hv + 0.2, 0.1);
      J.caja('blanco', x - s * 0.075, Y2 + y1v + 0.1, z, 0.11, 0.12, wv + 0.3); J.caja('blanco', x - s * 0.1, Y2 + y0v - 0.05, z, 0.16, 0.06, wv + 0.36);
      J.caja('blanco', x - s * 0.06, yc, z, 0.05, 0.06, wv); J.caja('blanco', x - s * 0.055, yc, z, 0.04, hv, 0.04);
      if (z === -12.5) J.caja('cortinaOsc', x - s * 0.15, yc + 0.05, z, 0.03, hv + 0.1, wv + 0.2);                       // rayos X: cortina negra corrida
      else if (z === -20.3 || z === -25.5) J.caja('esmerilado', x - s * 0.035, Y2 + y0v + hv * 0.3, z, 0.008, hv * 0.6, wv);   // pabellón: vidrio esmerilado abajo
      else J.caja('cortina', x - s * 0.16, Y2 + y1v - 0.12, z + (wv / 2 - 0.1), 0.04, 0.5, 0.26);
    }
    const tabique2 = (zc, lineas, rojo) => {   // tabique con puerta de dos hojas abiertas y letrero sobre el vano (cara al hall)
      const t = 0.14, hp = 2.6, ap = 1.0;
      for (const s of [-1, 1]) { const a = s * ap, b = s * (hw - 0.005), cx = (a + b) / 2, w = Math.abs(b - a);
        B('muroInt', cx, H / 2, zc, w, H - 0.004, t); F2(cx, H / 2, zc, w, H, t + 0.02, 'muro');
        for (const dz of [-1, 1]) { B('friso', cx + s * 0.06, 0.675, zc + dz * (t / 2 + 0.012), w - 0.12, 1.35, 0.02); B('filete', cx + s * 0.06, 1.375, zc + dz * (t / 2 + 0.017), w - 0.12, 0.05, 0.035); } }
      B('muroInt', 0, (hp + H) / 2, zc, 2 * ap + 0.02, H - hp - 0.004, t); F2(0, (hp + H) / 2, zc, 2 * ap, H - hp, t + 0.02, 'muro');
      for (const s of [-1, 1]) B('blanco', s * (ap - 0.03), hp / 2, zc, 0.12, hp, t + 0.05); B('blanco', 0, hp + 0.05, zc, 2 * ap + 0.06, 0.12, t + 0.05);
      for (const s of [-1, 1]) {
        const piv = new THREE.Matrix4().makeRotationY(-s * 1.36).setPosition(s * (ap - 0.1), Y2, zc - t / 2 - 0.03);
        const hoja = (k, x, y, sx, sy, sz) => { const gg = new THREE.BoxGeometry(sx, sy, sz).translate(-s * x, y, 0); gg.applyMatrix4(piv); J.add(k, gg); };
        hoja('blanco', 0.45, 0.72, 0.86, 1.36, 0.045); hoja('vidrio', 0.45, 1.86, 0.7, 0.88, 0.01);
        hoja('blanco', 0.06, 1.86, 0.12, 0.92, 0.05); hoja('blanco', 0.84, 1.86, 0.12, 0.92, 0.05); hoja('blanco', 0.45, 2.37, 0.86, 0.1, 0.05); hoja('laton', 0.8, 1.05, 0.04, 0.12, 0.07);
      }
      cartel(g, texCartel(lineas, '#f1eee4', rojo ? '#8a1c1c' : '#1f3a2c'), 1.7, 0.44, 0, Y2 + 3.15, zc + t / 2 + 0.012, 0);
    };
    tabique2(-10.5, ['RAYOS X', 'NO ENTRAR CON LA LUZ ROJA'], true);
    tabique2(-18, ['PABELLÓN DE OPERACIONES', 'SILENCIO'], true);
    tabique2(-27.5, ['MATERNIDAD', viejo ? 'GOTA DE LECHE' : 'RECIÉN NACIDOS']);
    J.add('rojoL', new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(1.45, Y2 + 2.95, -10.5 + 0.08));   // luz roja de rayos X sobre la puerta
    B('laton', 1.45, 2.95, -10.5 + 0.075, 0.24, 0.24, 0.01);

    // ---------------- HALL DEL 2.º PISO: oficina del médico jefe (mampara vidriada), banca, directorio, maceteros
    const mampara2 = (ax, az, bx, bz) => {   // tramo recto: tablero bajo, vidrio, travesaños y muro sobre 2,6 m
      const lx = bx - ax, lz = bz - az, Lm = Math.hypot(lx, lz), cx = (ax + bx) / 2, cz = (az + bz) / 2, ry = Math.atan2(lx, lz);
      B('madera', cx, 0.5, cz, 0.08, 1.0, Lm, ry); B('madera', cx, 1.05, cz, 0.12, 0.1, Lm, ry); B('vidrio', cx, 1.8, cz, 0.012, 1.4, Lm - 0.06, ry);
      B('madera', cx, 2.55, cz, 0.12, 0.1, Lm, ry); B('muroInt', cx, (2.6 + H) / 2, cz, 0.1, H - 2.6 - 0.004, Lm, ry);
      const n = Math.max(1, Math.round(Lm / 0.9)); for (let i = 1; i < n; i++) B('madera', ax + lx * i / n, 1.8, az + lz * i / n, 0.05, 1.4, 0.05);
      for (let i = 0; i < n; i++) for (const d of [-1, 1]) { const u = (i + 0.5) / n; B('maderaOsc', ax + lx * u + Math.cos(ry) * d * 0.046, 0.5, az + lz * u - Math.sin(ry) * d * 0.046, 0.016, 0.6, Lm / n - 0.2, ry); }
      F2(cx, H / 2, cz, Math.abs(lx) + 0.1, H, Math.abs(lz) + 0.1, 'muro');
    };
    const xO = 1.4, zO = -5.4;   // oficina: x 1,4 … 7, z −5,4 … −10,5 (puerta en x 1,9 … 3,0)
    mampara2(xO, zO, xO, -10.43); mampara2(3.0, zO, hw - 0.005, zO); mampara2(xO, zO, 1.9, zO);
    B('muroInt', 2.45, (2.6 + H) / 2, zO, 1.1, H - 2.6, 0.1); F2(2.45, (2.6 + H) / 2, zO, 1.1, H - 2.6, 0.12, 'muro');
    for (const x of [1.9, 3.0]) B('blanco', x, 1.3, zO, 0.1, 2.6, 0.16); B('blanco', 2.45, 2.62, zO, 1.2, 0.1, 0.16);
    { const piv = new THREE.Matrix4().makeRotationY(-1.2).setPosition(2.95, Y2, zO - 0.08);   // hoja abierta hacia adentro
      for (const [k, x, y, sx, sy, sz] of [['madera', -0.5, 1.0, 0.98, 2.0, 0.045], ['vidrio', -0.5, 1.95, 0.7, 0.5, 0.01], ['laton', -0.88, 1.0, 0.04, 0.1, 0.08]]) { const gg = new THREE.BoxGeometry(sx, sy, sz).translate(x, y, 0); gg.applyMatrix4(piv); J.add(k, gg); } }
    cartel(g, texCartel(['DIRECCIÓN', 'MÉDICO JEFE']), 1.05, 0.3, 2.45, Y2 + 2.95, zO + 0.07, 0);
    // escritorio de cortina, sillón, sillas, estante de libros, diplomas, esqueleto de enseñanza, caja fuerte, alfombra
    B('alfombra', 4.6, 0.006, -8.0, 3.2, 0.012, 2.8);
    // G9M (16-11): escritorio de cortina (malla G9) abierto hacia el sillón del jefe (frente local +z → +x, ry +π/2), ×1,2 en y: cubierta a
    // 0,745 m (la malla la trae a 0,62). Las cosas FINAS de C7 van sobre la cubierta, delante de los casilleros. Las cajas quedan de respaldo.
    { const rE = Math.PI / 2, p = mueble(R('escritorio_cortina', 4.9, Y2, -8.0, rE, [1, 1.2, 1]), 4.9, -8.0, rE, Y2);
      p.b('madera', 0, 0.72, 0, 1.7, 0.05, 0.85); for (const s of [-1, 1]) { p.b('maderaOsc', s * 0.6, 0.35, 0, 0.42, 0.7, 0.78); for (const y of [0.18, 0.4, 0.6]) p.b('laton', s * 0.6, y, 0.395, 0.09, 0.02, 0.012); }
      p.b('maderaOsc', 0, 0.4, -0.38, 0.8, 0.6, 0.03); p.b('maderaOsc', 0, 1.05, -0.3, 1.66, 0.6, 0.25);   // casilleros
      const pc = mueble(R(viejo ? 'escritorio_cosas_a' : 'escritorio_cosas_b', 4.9, Y2, -8.0, rE), 4.9, -8.0, rE, Y2);   // C7 (H12): lámpara de vidrio verde, teléfono, libros y tintero FINOS; las cajas quedan de respaldo
      pc.b('papel', -0.25, 0.75, 0.16, 0.32, 0.012, 0.24, 0.2); pc.b('lomo', 0.3, 0.78, 0.08, 0.24, 0.06, 0.32);
      pc.c('negro', 0.03, 0.035, 0.06, 0.62, 0.78, 0.26, 8);
      if (viejo) { pc.c('negro', 0.05, 0.06, 0.03, -0.62, 0.76, -0.03, 10); pc.c('negro', 0.013, 0.013, 0.3, -0.62, 0.92, -0.03, 6); pc.c('negro', 0.03, 0.025, 0.08, -0.62, 1.1, -0.03, 8); }   // teléfono de candelero
      else { pc.b('negro', -0.6, 0.78, 0, 0.22, 0.09, 0.2); pc.c('negro', 0.025, 0.025, 0.22, -0.6, 0.85, 0, 8, 0, Math.PI / 2); }
      pc.c('laton', 0.06, 0.07, 0.03, 0.6, 0.76, -0.1, 10); pc.c('laton', 0.012, 0.012, 0.35, 0.6, 0.93, -0.1, 6); pc.s('pantalla', 0.14, 0.6, 1.1, -0.02, 1, 0.6, 0.7, 12, 6); }
    { const p = mueble(R('sillon_cuero', 6.0, Y2, -8.0, -Math.PI / 2, ESC_G2.sillon_cuero), 6.0, -8.0, -Math.PI / 2, Y2);   // sillón de cuero · N0-UTIL3
      p.b('cuero', 0, 0.45, 0, 0.62, 0.12, 0.58); p.b('cuero', 0, 0.85, -0.3, 0.62, 0.7, 0.12); for (const s of [-1, 1]) p.b('cuero', s * 0.33, 0.62, 0, 0.1, 0.36, 0.55);
      for (const [dx, dz] of [[-0.25, -0.24], [0.25, -0.24], [-0.25, 0.24], [0.25, 0.24]]) p.b('maderaOsc', dx, 0.2, dz, 0.05, 0.4, 0.05); }
    F2(5.3, 0.45, -8.0, 1.6, 0.9, 1.75);
    for (const z of [-7.4, -8.6]) { const p = m2(3.55, z, Math.PI / 2);   // sillas de visita
      p.b('madera', 0, 0.46, 0, 0.42, 0.04, 0.42); for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) p.b('maderaOsc', dx, 0.23, dz, 0.035, 0.46, 0.035);
      p.b('madera', 0, 0.75, -0.2, 0.42, 0.55, 0.03); F2(3.55, 0.45, z, 0.45, 0.9, 0.45); }
    { const p = mueble(R('librero_jefe', 4.4, Y2, -10.2, 0), 4.4, -10.2, 0, Y2);   // estante de libros contra el tabique · C7 (H25): librero FINO
      p.b('maderaOsc', 0, 1.1, 0, 2.2, 2.2, 0.36); for (let r = 0; r < 4; r++) for (let i = 0; i < 16; i++) { const w = 0.05 + rnd() * 0.05, h = 0.26 + rnd() * 0.12; p.b(['lomo', 'verdeOsc', 'abrigo', 'maderaOsc'][Math.floor(rnd() * 4)], -0.98 + i * 0.12, 0.28 + r * 0.5 + h / 2, 0.19, w, h, 0.012); }
      F2(4.4, 1.1, -10.2, 2.2, 2.2, 0.4); }
    for (const [z, y] of [[-6.2, 2.0], [-6.9, 2.0], [-6.55, 2.6]]) { B('maderaOsc', hw - 0.03, y, z, 0.03, 0.4, 0.32); B('papel', hw - 0.05, y, z, 0.012, 0.32, 0.24); }   // diplomas
    { const p = mueble(R('esqueleto', 6.3, Y2, -6.0, -2.3, ESC_G2.esqueleto), 6.3, -6.0, -2.3, Y2);   // esqueleto de enseñanza en su atril · N0-UTIL3
      p.c('fierroN', 0.12, 0.15, 0.04, 0, 0.02, 0, 12); p.c('fierroN', 0.012, 0.012, 1.85, 0, 0.93, -0.08, 6);
      p.s('hueso', 0.1, 0, 1.68, 0, 0.85, 1.05, 0.95); p.c('hueso', 0.025, 0.025, 0.55, 0, 1.3, 0, 6); for (let i = 0; i < 6; i++) p.g('hueso', new THREE.TorusGeometry(0.12 - i * 0.008, 0.01, 5, 14).scale(1, 0.75, 1).rotateX(Math.PI / 2).translate(0, 1.47 - i * 0.055, 0.02));
      p.b('hueso', 0, 1.0, 0, 0.26, 0.12, 0.1); for (const s of [-1, 1]) { p.c('hueso', 0.018, 0.016, 0.85, s * 0.09, 0.55, 0, 6); p.c('hueso', 0.015, 0.013, 0.6, s * 0.17, 1.25, 0, 6, 0, s * 0.12); }
      F2(6.3, 0.9, -6.0, 0.4, 1.8, 0.4); }
    { const p = m2(6.55, -9.6, -Math.PI / 2); p.b('verdeMaq', 0, 0.45, 0, 0.6, 0.9, 0.55); p.c('laton', 0.07, 0.07, 0.03, 0.1, 0.55, 0.29, 14, Math.PI / 2); p.b('laton', -0.18, 0.5, 0.285, 0.03, 0.12, 0.02); F2(6.55, 0.45, -9.6, 0.6, 0.9, 0.62); }   // caja fuerte
    { const p = m2(1.85, -10.0); p.c('madera', 0.03, 0.035, 1.8, 0, 0.9, 0, 8); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; p.b('madera', Math.cos(a) * 0.18, 0.04, Math.sin(a) * 0.18, 0.36, 0.05, 0.05, -a); }
      p.b('blancoF', 0.1, 1.35, 0, 0.12, 0.75, 0.34); F2(1.85, 0.9, -10.0, 0.4, 1.8, 0.4); }   // perchero con el delantal blanco
    cartel(g, texCalendario(anio, viejo ? 'MAYO' : 'NOVIEMBRE'), 0.3, 0.38, 2.3, Y2 + 1.85, -10.43 + 0.012, 0);
    // hall: banca contra la oficina, maceteros, directorio y reloj
    banca(1.0, -8.0, -Math.PI / 2, 2.2, Y2); F2(1.0, 0.45, -8.0, 0.6, 0.9, 2.2);
    for (const [x, z] of [[-3.8, -9.9], [-1.6, -0.55]]) { const p = mueble(R('macetero', x, Y2, z, 0, ESC_G2.macetero), x, z, 0, Y2); p.c('greda', 0.22, 0.16, 0.42, 0, 0.21, 0, 12);   // N0-UTIL3
      for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = 0.05 + rnd() * 0.18; p.s('hoja', 0.12 + rnd() * 0.06, Math.cos(a) * r, 0.55 + rnd() * 0.25, Math.sin(a) * r, 1, 0.55, 1, 7, 5); } F2(x, 0.4, z, 0.45, 0.8, 0.45); }
    cartel(g, texCartel(['2.º PISO', 'RAYOS X · PABELLÓN', 'MATERNIDAD · DIRECCIÓN'], '#1f3a2c', '#efe8d2', 512, 256), 1.2, 0.6, -2.7, Y2 + 2.0, -10.5 + 0.082, 0);
    { const x = -2.7, z = -10.5 + 0.085; J.add('madera', new THREE.CylinderGeometry(0.24, 0.24, 0.05, 24).rotateX(Math.PI / 2).translate(x, Y2 + 3.25, z));
      J.add('esfera', new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24).rotateX(Math.PI / 2).translate(x, Y2 + 3.25, z + 0.03)); B('negro', x, 3.32, z + 0.045, 0.015, 0.14, 0.008); B('negro', x + 0.06, 3.25, z + 0.047, 0.12, 0.015, 0.008); }

    // ---------------- RAYOS X (z −10,5 … −18): mesa, tubo en su columna, biombo de plomo, mesa de mandos, transformador, negatoscopio
    { const zR = -14.4;
      const JRX = viejo ? JQ('rayos_x') : J, p = mueble(JRX, -3.0, zR, 0, Y2);   // Q1: en 1920 la mesa, la columna y el tubo son el respaldo de la malla rayos_x
      p.b(viejo ? 'maderaOsc' : 'crom', 0, 0.38, 0, 0.5, 0.7, 1.5); p.b(viejo ? 'madera' : 'blanco', 0, 0.76, 0, 0.7, 0.06, 2.0); p.b('cuero', 0, 0.81, 0.05, 0.6, 0.04, 1.85);
      F2(-3.0, 0.42, zR, 0.75, 0.85, 2.05);
      const c = mueble(JRX, -4.6, zR, 0, Y2); c.c('fierroN', 0.07, 0.08, 2.7, 0, 1.35, 0, 10); c.b('fierroN', 0, 0.04, 0, 0.6, 0.08, 0.6); c.b('fierroN', 0.8, 2.15, 0, 1.6, 0.1, 0.1);
      const colRX = F2(-4.6, 1.3, zR, 0.3, 2.7, 0.3);
      // Q1: malla rayos_x (mesa de 2 m con la columna en la cabecera; giro 90°: la mesa a lo largo de z, columna hacia el hall). El brazo con
      // el tubo (y > 1 m) se parte de la malla y gira despacio en torno a la columna (±7°), con los cables de alta tensión colgando del techo.
      if (viejo) QM.push({ id: 'rayos_x', fn: () => {
        const P = partirPieza('rayos_x', 'brazo', (x, y) => y > 1.0); if (!P) return false;
        const xc = -0.735, gx = new THREE.Group(); gx.name = 'hosp_q1_rayos_x'; gx.position.set(O.x - 3.0, O.y + Y2, O.z + zR); gx.rotation.y = Math.PI / 2;
        const base = new THREE.Mesh(P.a, P.mat), piv = new THREE.Group(), brazo = new THREE.Mesh(P.b, P.mat); base.receiveShadow = brazo.receiveShadow = true;
        piv.position.x = xc; brazo.position.x = -xc; piv.add(brazo); gx.add(base, piv);
        for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.02, 0.012), mats.cable); k.position.set(-xc, 1.88 + 1.01, s * 0.08); piv.add(k); }   // cables al tubo (suben a los aisladores del techo, y 3,9)
        brazo.onBeforeRender = () => { piv.rotation.y = 0.12 * Math.sin(performance.now() / 1000 * 0.35); piv.updateMatrixWorld(true); };
        g.add(gx); colRX.setTranslation({ x: O.x - 3.0, y: O.y + Y2 + 1.3, z: O.z + zR - xc });   // la colisión de la columna va donde quedó la columna de la malla
        return true; } });
      if (viejo) { c.s('plomo', 0.26, 1.6, 1.86, 0, 1, 0.75, 1, 14, 8); c.s('vidrioR', 0.13, 1.6, 1.74, 0, 1.4, 1, 1, 12, 8); c.c('fierroN', 0.03, 0.03, 0.2, 1.6, 2.04, 0, 6); }   // ampolla de Coolidge en su campana de plomo
      else { c.c('crom', 0.13, 0.13, 0.45, 1.6, 1.9, 0, 14, 0, Math.PI / 2); c.b('crom', 1.6, 1.68, 0, 0.22, 0.2, 0.22); c.b('negro', 1.6, 1.56, 0, 0.16, 0.04, 0.16); }
      // biombo de plomo con visor y mesa de mandos detrás
      const bp = mueble(R('biombo_plomo', 2.3, Y2, -13.0, -Math.PI / 2, ESC_G3.biombo_plomo), 2.3, -13.0, -Math.PI / 2, Y2); bp.b('plomo', 0, 1.05, 0, 1.3, 1.7, 0.06); bp.b('vidrioPb', 0, 1.55, 0.035, 0.3, 0.22, 0.01); for (const s of [-1, 1]) { bp.b('fierroN', s * 0.6, 0.1, 0, 0.06, 0.2, 0.5); }   // N0-UTIL3 (G3)
      F2(2.3, 1.0, -13.0, 0.1, 2.0, 1.35, 'mueble');
      const mm = mueble(R('mandos_rx', 4.0, Y2, -13.0, -Math.PI / 2, ESC_G3.mandos_rx), 4.0, -13.0, -Math.PI / 2, Y2); mm.b(viejo ? 'madera' : 'verdeOsc', 0, 0.45, 0, 1.1, 0.9, 0.55); mm.b('marmol', 0, 1.35, -0.25, 1.1, 0.9, 0.05);   // N0-UTIL3 (G3)
      for (let i = 0; i < 3; i++) { mm.c('esfera', 0.1, 0.1, 0.02, -0.35 + i * 0.35, 1.5, -0.215, 18, Math.PI / 2); mm.b('negro', -0.35 + i * 0.35, 1.53, -0.2, 0.008, 0.08, 0.006, 0, 0, 0.6 - i * 0.5); }
      for (let i = 0; i < 4; i++) mm.c('negro', 0.025, 0.025, 0.05, -0.38 + i * 0.25, 1.1, -0.2, 8, Math.PI / 2);
      mm.b('negro', 0.4, 0.92, 0.0, 0.08, 0.06, 0.12); F2(4.0, 0.7, -13.0, 0.6, 1.4, 1.15);
      // transformador de alta tensión con aisladores (1920: cables desnudos por el cielo hasta el tubo)
      const tr = mueble(R('transformador', 5.9, Y2, -16.8, 0, ESC_G3.transformador), 5.9, -16.8, 0, Y2); tr.b('verdeMaq', 0, 0.8, 0, 1.2, 1.6, 0.9); for (const s of [-1, 1]) { tr.c('marfil', 0.06, 0.08, 0.3, s * 0.35, 1.75, 0, 10); tr.c('marfil', 0.09, 0.09, 0.04, s * 0.35, 1.7, 0, 10); }   // N0-UTIL3 (G3): los cables siguen en código
      F2(5.9, 0.8, -16.8, 1.2, 1.6, 0.9);
      if (viejo) for (const s of [-1, 1]) {   // cables desnudos: suben del aislador, cruzan por el cielo y bajan al tubo
        const xa = 5.9 + s * 0.35, xt = -3.0 + s * 0.08, zt = -16.8 + s * 0.08, yC = 3.9;
        B('cable', xa, (1.95 + yC) / 2, -16.8, 0.012, yC - 1.95, 0.012); B('cable', (xa + xt) / 2, yC, zt, Math.abs(xa - xt), 0.012, 0.012);
        B('cable', xt, yC, (zt + zR) / 2, 0.012, 0.012, Math.abs(zt - zR)); JQ('rayos_x').caja('cable', xt, Y2 + (yC + 2.05) / 2, zR, 0.012, yC - 2.05, 0.012);   // Q1: la bajada al tubo va con el respaldo (la malla trae la suya, que se mueve con el brazo)
        for (const [x, z] of [[xa, zt], [xt, zt]]) B('marfil', x, yC + 0.06, z, 0.06, 0.1, 0.06); }
      cartel(g, texCartel(['PELIGRO', 'ALTA TENSIÓN'], '#f1eee4', '#8a1c1c', 384, 200), 0.5, 0.26, 5.9, Y2 + 1.1, -16.8 + 0.462, 0);
      // negatoscopio con dos radiografías en el tabique del pabellón
      B('blanco', -4.2, 1.7, -18 + 0.09, 1.3, 0.75, 0.05); const rx = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.6), new THREE.MeshBasicMaterial({ map: texRadiografia(), color: 0xd8e4ea })); planoUtil(rx, 'radiografia', 2);   // N0-UTIL3 (P2): dos placas de tórax de Qwen
      rx.position.set(-4.2, Y2 + 1.7, -18 + 0.12); rx.name = 'hosp_cartel'; g.add(rx);
      { const p2 = mueble(R('taburete_giratorio', -1.6, Y2, -12.4, 0), -1.6, -12.4, 0, Y2); /* C7 (H34) */ p2.c('fierroN', 0.18, 0.2, 0.04, 0, 0.02, 0, 10); p2.c('fierroN', 0.02, 0.02, 0.6, 0, 0.32, 0, 6); p2.c('madera', 0.18, 0.18, 0.05, 0, 0.63, 0, 14); F2(-1.6, 0.33, -12.4, 0.4, 0.66, 0.4); }   // taburete giratorio
    }

    // ---------------- PABELLÓN DE OPERACIONES (z −18 … −27,5): mesa, lámpara cialítica, instrumental, anestesia, lavatorios, autoclave
    { const zP = -22.9;
      const p = mueble(R('mesa_operaciones', 0, Y2, zP, Math.PI / 2, ESC_G3.mesa_operaciones), 0, zP, 0, Y2);   // N0-UTIL3 (G3): la malla es larga en x → gira 90°
      if (viejo) { p.b('blanco', 0, 0.04, 0, 0.7, 0.08, 0.9); p.c('blanco', 0.16, 0.2, 0.68, 0, 0.42, 0, 12); p.b('blanco', 0, 0.8, 0, 0.56, 0.08, 1.9); p.c('crom', 0.015, 0.015, 0.3, 0.33, 0.6, 0.6, 6, 0, Math.PI / 2); p.c('negro', 0.04, 0.04, 0.05, 0.5, 0.6, 0.6, 8, 0, Math.PI / 2); }   // mesa de hierro esmaltado con manivela
      else { p.b('crom', 0, 0.05, 0, 0.6, 0.1, 1.0); p.c('crom', 0.12, 0.12, 0.65, 0, 0.42, 0, 14); p.b('crom', 0, 0.8, 0, 0.56, 0.08, 1.9); for (const s of [-1, 1]) p.b('crom', s * 0.3, 0.86, 0, 0.02, 0.03, 1.9); }
      p.b('cuero', 0, 0.87, 0.02, 0.52, 0.06, 1.8); p.b(viejo ? 'colchon' : 'verdeQ', 0, 0.91, 0.25, 0.6, 0.02, 1.2); p.s('colchon', 1, 0, 0.93, -0.75, 0.2, 0.06, 0.13, 10, 6);
      F2(0, 0.45, zP, 0.7, 0.9, 1.95);
      // lámpara cialítica (1919, la gran novedad de los pabellones): cúpula con espejos y foco; en 1967, dos cúpulas en brazos articulados
      const yL = 3.0;
      // G9M (16-11): cialítica FINA en código (mueblesFinos_hospital.js: cúpula con espejos, vidrio, foco y corona de lentes por debajo); lo de abajo es su respaldo
      const JC = R(viejo ? 'cialitica_1920' : 'cialitica_1967', 0, Y2 + yL + (viejo ? 0.07 : 0.03), zP, 0);
      if (viejo) { J.add('crom', new THREE.CylinderGeometry(0.03, 0.03, H - yL - 0.4, 8).translate(0, Y2 + (H + yL + 0.4) / 2, zP));
        JC.add('domo', new THREE.SphereGeometry(0.75, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2.4).translate(0, Y2 + yL - 0.12, zP));
        JC.add('crom', new THREE.TorusGeometry(0.72, 0.025, 6, 28).rotateX(Math.PI / 2).translate(0, Y2 + yL + 0.07, zP));
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; JC.add('espejo', new THREE.BoxGeometry(0.14, 0.012, 0.1).rotateZ(0.5).rotateY(-a).translate(Math.cos(a) * 0.48, Y2 + yL + 0.12, zP + Math.sin(a) * 0.48)); }
        JC.add('luzOp', new THREE.CircleGeometry(0.5, 24).rotateX(Math.PI / 2).translate(0, Y2 + yL + 0.02, zP)); }
      else { J.add('crom', new THREE.CylinderGeometry(0.04, 0.04, H - yL - 0.3, 8).translate(0, Y2 + (H + yL + 0.3) / 2, zP));
        for (const s of [-1, 1]) { JC.add('crom', new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8).rotateZ(Math.PI / 2 - s * 0.35).translate(s * 0.33, Y2 + yL + 0.42, zP));
          JC.add('domo', new THREE.SphereGeometry(0.42, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2.2).translate(s * 0.62, Y2 + yL + 0.15, zP));
          JC.add('luzOp', new THREE.CircleGeometry(0.3, 20).rotateX(Math.PI / 2).translate(s * 0.62, Y2 + yL + 0.16, zP)); } }
      // mesa de instrumental, anestesia, taburete
      const my = mueble(R('mesa_instrumental', 0.95, Y2, -23.7, 0), 0.95, -23.7, 0, Y2);   // C7 (H34): mesa de Mayo FINA my.c('crom', 0.012, 0.012, 0.95, 0, 0.47, 0, 6); my.b('crom', 0, 0.02, 0, 0.5, 0.03, 0.4); my.b('crom', -0.15, 0.97, 0, 0.6, 0.02, 0.4); my.b('verdeQ', -0.15, 0.985, 0, 0.56, 0.008, 0.36);
      for (let i = 0; i < 7; i++) my.b('crom', -0.38 + i * 0.07, 1.0, (rnd() - 0.5) * 0.15, 0.012, 0.008, 0.16, rnd() * 0.3);
      F2(0.95, 0.5, -23.7, 0.5, 1.0, 0.45);
      const an = viejo ? mueble(R('anestesia', -0.95, Y2, -21.6, 0.3, ESC_G3.anestesia), -0.95, -21.6, 0.3, Y2) : m2(-0.95, -21.6, 0.3);   // N0-UTIL3 (G3): malla de 1920 solo en época vieja
      if (viejo) { an.c('fierroN', 0.012, 0.012, 1.5, 0, 0.75, 0, 6); an.b('fierroN', 0, 0.02, 0, 0.45, 0.03, 0.45); an.b('crom', 0, 1.15, 0, 0.3, 0.02, 0.2); an.c('ambar', 0.05, 0.05, 0.2, -0.07, 1.26, 0, 10); an.c('azul', 0.04, 0.04, 0.16, 0.08, 1.24, 0, 10); an.s('negro', 0.07, 0.1, 1.42, 0.05, 1, 0.6, 1.2, 10, 6); }   // botellas de éter y cloroformo, mascarilla
      else { an.b('verdeOsc', 0, 0.45, 0, 0.55, 0.7, 0.45); an.b('crom', 0, 0.82, 0, 0.6, 0.03, 0.5); for (const [dx, k] of [[-0.18, 'verdeV'], [0, 'azul'], [0.18, 'blancoF']]) an.c(k, 0.07, 0.07, 1.0, dx, 1.35, -0.12, 12); for (let i = 0; i < 3; i++) an.c('esfera', 0.05, 0.05, 0.02, -0.15 + i * 0.15, 1.02, 0.23, 14, Math.PI / 2); an.s('negro', 0.12, 0.25, 1.0, 0.2, 1, 1.3, 1, 10, 6); }
      F2(-0.95, 0.6, -21.6, 0.6, 1.2, 0.6);
      // lavatorio doble de los cirujanos (grifos de codo) en el muro izquierdo, entre ventanas
      { const x = -hw + 0.05; B('blancoM', x + 0.02, 1.2, -22.9, 0.02, 0.7, 1.9);
        const JD = R('lavatorio_doble', x + 0.3, Y2, -22.9, Math.PI / 2, ESC_G2.lavatorio_doble), Bd = (k, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => JD.caja(k, x, Y2 + y, z, sx, sy, sz, ry, rx, rz);   // N0-UTIL3
        for (const z of [-22.45, -23.35]) { Bd('blancoF', x + 0.3, 0.82, z, 0.55, 0.22, 0.7); Bd('fierroN', x + 0.3, 0.4, z, 0.08, 0.8, 0.08); JD.add('crom', new THREE.TorusGeometry(0.15, 0.015, 6, 12, Math.PI).translate(x + 0.15, Y2 + 1.2, z)); Bd('crom', x + 0.02, 1.08, z, 0.04, 0.24, 0.04); /* cuello de cisne que sale del muro */ Bd('crom', x + 0.2, 1.1, z + 0.12, 0.25, 0.02, 0.02, 0, 0, -0.5); }
        F2(x + 0.3, 0.5, -22.9, 0.6, 1.0, 1.7); }
      // vitrina de instrumental en el muro derecho, entre ventanas
      { const p3 = mueble(R('vitrina_instrumental', hw - 0.24, Y2, -22.9, -Math.PI / 2), hw - 0.24, -22.9, -Math.PI / 2, Y2), wv3 = 1.6;   // C7 (H37): vitrina esmaltada FINA
        p3.b('blanco', 0, 0.45, 0, wv3, 0.9, 0.42); for (const s of [-1, 1]) p3.b('blanco', s * (wv3 / 2 - 0.03), 1.45, -0.02, 0.06, 1.1, 0.38); p3.b('blanco', 0, 1.45, -0.19, wv3 - 0.06, 1.1, 0.02); p3.b('blanco', 0, 2.03, 0, wv3 + 0.04, 0.06, 0.44);
        for (const y of [1.2, 1.55, 1.85]) { p3.b('vidrioR', 0, y, -0.02, wv3 - 0.08, 0.012, 0.34); for (let i = 0; i < 9; i++) p3.b(i % 3 ? 'crom' : ['ambar', 'azul', 'verdeV'][Math.floor(rnd() * 3)], -0.6 + i * 0.15, y + 0.06, -0.05, 0.04, 0.1 + rnd() * 0.06, 0.12); }
        p3.b('vidrio', 0, 1.45, 0.17, wv3 - 0.08, 1.06, 0.01); p3.b('blancoM', 0, 1.45, 0.175, 0.03, 1.06, 0.03); F2(hw - 0.24, 1.0, -22.9, 0.46, 2.1, wv3 + 0.06); }
      // autoclave (esterilizador) en el rincón y cubo de pedal
      { const p4 = mueble(R('autoclave', -5.4, Y2, -19.1, Math.PI / 2, ESC_G3.autoclave), -5.4, -19.1, 0, Y2); p4.c(viejo ? 'cobre' : 'crom', 0.33, 0.33, 0.95, 0, 0.95, 0, 18, 0, Math.PI / 2); p4.c(viejo ? 'laton' : 'crom', 0.34, 0.34, 0.05, 0.48, 0.95, 0, 18, 0, Math.PI / 2);   // N0-UTIL3 (G3): autoclave vertical mirando a la sala
        for (const s of [-1, 1]) p4.b('fierroN', s * 0.32, 0.32, 0, 0.06, 0.64, 0.5); p4.c('esfera', 0.08, 0.08, 0.03, 0.2, 1.33, 0.05, 16); p4.c('fierroN', 0.02, 0.02, 0.15, 0.2, 1.26, 0.05, 6);
        F2(-5.4, 0.7, -19.1, 1.1, 1.4, 0.75); }
      { const p5 = mueble(R('cubo_pedal', 1.8, Y2, -21.0, -Math.PI / 2, ESC_G3.cubo_pedal), 1.8, -21.0, 0, Y2); p5.c(viejo ? 'blancoF' : 'crom', 0.16, 0.14, 0.4, 0, 0.2, 0, 12); p5.c('negro', 0.165, 0.165, 0.02, 0, 0.41, 0, 12); }   // N0-UTIL3 (G3)
      cartel(g, texCartel(['SILENCIO'], '#f1eee4', '#8a1c1c'), 1.0, 0.3, -hw + 0.03, Y2 + 3.3, -22.9, Math.PI / 2);
      if (!viejo) cartel(g, texCartel(['LAVARSE LAS MANOS', '10 MINUTOS'], '#f1eee4', '#1f3a2c', 384, 200), 0.5, 0.26, -hw + 0.09, Y2 + 2.0, -22.9, Math.PI / 2);
    }

    // ---------------- MATERNIDAD (z −27,5 … −34): camas de las madres, cunas, incubadoras, balanza de guaguas, mesa de mudar
    { [-29.0, -31.6, -33.4].forEach((z, i) => { cama(-(hw - 0.07), z, Math.PI / 2, i + 1, Y2); F2(-(hw - 1.05), 0.5, z, 2.0, 1.0, 0.98); });
      const guagua = (p, x, y, z) => { p.s('colchon', 0.12, x, y + 0.06, z + 0.04, 0.9, 0.55, 1.5, 10, 6); p.s('piel', 0.065, x, y + 0.08, z - 0.16, 1, 1, 1, 10, 8); p.s('frazada2', 0.07, x, y + 0.11, z - 0.17, 1.05, 0.55, 1, 10, 6); };
      const cuna = (X, Z) => { const p = m2(X, Z, -Math.PI / 2);   // cuna de fierro esmaltado con barrotes
        for (const [dx, dz] of [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]]) p.c('catre', 0.018, 0.018, 1.0, dx, 0.5, dz, 6);
        for (const s of [-1, 1]) { p.c('catre', 0.012, 0.012, 0.9, s * 0.3, 0.98, 0, 6, Math.PI / 2); p.c('catre', 0.012, 0.012, 0.9, s * 0.3, 0.55, 0, 6, Math.PI / 2); for (let i = 1; i < 9; i++) p.c('catre', 0.006, 0.006, 0.43, s * 0.3, 0.765, -0.45 + i * 0.1, 4); }
        for (const s of [-1, 1]) { p.c('catre', 0.012, 0.012, 0.6, 0, 0.98, s * 0.45, 6, 0, Math.PI / 2); for (let i = 1; i < 6; i++) p.c('catre', 0.006, 0.006, 0.43, -0.3 + i * 0.1, 0.765, s * 0.45, 4); }
        p.b('colchon', 0, 0.6, 0, 0.56, 0.08, 0.86); guagua(p, 0, 0.64, 0.05); F2(X, 0.5, Z, 0.95, 1.0, 0.65); };
      const idInc = viejo ? 'incubadora_1920' : 'incubadora_1967', posInc = [];
      const incubadora = (X, Z) => { const p = mueble(JQ(idInc), X, Z, -Math.PI / 2, Y2); posInc.push([X, Z]);   // Q1: respaldo de la malla de la incubadora
        if (viejo) {   // incubadora de 1920: caja de madera con tapa de vidrio, termómetro y lámpara de alcohol abajo
          for (const [dx, dz] of [[-0.3, -0.42], [0.3, -0.42], [-0.3, 0.42], [0.3, 0.42]]) p.b('maderaOsc', dx, 0.38, dz, 0.05, 0.76, 0.05);
          p.b('madera', 0, 0.86, 0, 0.7, 0.22, 0.95); p.b('colchon', 0, 0.975, 0, 0.6, 0.03, 0.85); guagua(p, 0, 0.98, 0.05);
          p.b('vidrioR', 0, 1.18, 0, 0.66, 0.012, 0.9); for (const s of [-1, 1]) { p.b('vidrioR', s * 0.33, 1.08, 0, 0.01, 0.2, 0.9); p.b('maderaOsc', s * 0.34, 1.18, 0, 0.03, 0.03, 0.95); }
          p.c('blancoF', 0.012, 0.012, 0.22, 0.2, 1.06, 0.48, 6); p.c('laton', 0.08, 0.06, 0.12, 0, 0.55, 0, 10); }
        else {   // 1967: gabinete esmaltado con capota de acrílico y portillos
          p.b('blanco', 0, 0.42, 0, 0.62, 0.84, 0.95); for (const [dx, dz] of [[-0.25, -0.4], [0.25, -0.4], [-0.25, 0.4], [0.25, 0.4]]) p.s('negro', 0.035, dx, 0.03, dz, 1, 1, 1, 6, 4);
          p.b('crom', 0, 0.86, 0, 0.66, 0.04, 0.98); p.b('colchon', 0, 0.9, 0, 0.56, 0.05, 0.85); guagua(p, 0, 0.92, 0.05);
          p.b('acril', 0, 1.13, 0, 0.62, 0.48, 0.92); for (const dz of [-0.2, 0.2]) p.c('blancoF', 0.07, 0.07, 0.02, 0.315, 1.1, dz, 14, 0, Math.PI / 2);
          for (let i = 0; i < 3; i++) p.c('esfera', 0.035, 0.035, 0.015, -0.18 + i * 0.18, 0.6, 0.48, 12, Math.PI / 2); }
        F2(X, 0.6, Z, 0.75, 1.2, 1.0); };
      if (viejo) { cuna(hw - 0.6, -28.8); cuna(hw - 0.6, -29.9); incubadora(hw - 0.62, -31.8); cuna(hw - 0.6, -33.3); }
      else { incubadora(hw - 0.62, -28.9); incubadora(hw - 0.62, -30.5); incubadora(hw - 0.62, -32.1); cuna(hw - 0.6, -33.4); }
      // Q1: incubadoras de malla mirando a la sala (−x). 1967: la capota (cáscara sobre el colchón) se parte de la malla y va de acrílico
      // translúcido (salió opaca en TRELLIS); adentro, una guagua procedural sobre el colchón de la malla (y ≈ 0,9).
      QM.push({ id: idInc, fn: () => {
        if (viejo) { for (const [X, Z] of posInc) { const m = piezaGrupo(idInc); if (!m) return false; m.position.set(O.x + X, O.y + Y2, O.z + Z); m.rotation.y = -Math.PI / 2; m.name = 'hosp_q1_' + idInc; g.add(m); } return true; }
        const P = partirPieza(idInc, 'capota', (x, y, z) => y > 0.97 || (y > 0.9 && (Math.abs(x) > 0.39 || Math.abs(z) > 0.25))); if (!P) return false;
        const mAcr = P.mat.clone(); mAcr.transparent = true; mAcr.opacity = 0.3; mAcr.depthWrite = false; mAcr.side = THREE.DoubleSide; mAcr.roughness = 0.08; mAcr.color = new THREE.Color(0xe8f4f8); mAcr.emissive = new THREE.Color(0.05, 0.06, 0.065);
        const JG = new Junta();
        for (const [X, Z] of posInc) {
          const gi = new THREE.Group(); gi.name = 'hosp_q1_' + idInc; gi.position.set(O.x + X, O.y + Y2, O.z + Z); gi.rotation.y = -Math.PI / 2;
          const a = new THREE.Mesh(P.a, P.mat), b = new THREE.Mesh(P.b, mAcr); a.receiveShadow = true; b.renderOrder = 2; gi.add(a, b); g.add(gi);
          guagua(mueble(JG, O.x + X, O.z + Z, 0, O.y + Y2), 0, 0.87, 0);
        }
        for (const k of Object.keys(JG.p)) { const m = new THREE.Mesh(JG.geometria(k), mats[k]); m.name = 'hosp_q1_guagua'; g.add(m); }
        return true; } });
      // mesa de mudar con balanza de guaguas (bandeja de latón) contra el fondo, y mecedora
      { const p = mueble(R('mesa_mudar', 1.6, Y2, -L + 0.4, 0, ESC_G2.mesa_mudar), 1.6, -L + 0.4, 0, Y2); p.b('blanco', 0, 0.45, 0, 1.3, 0.9, 0.6);   // N0-UTIL3 p.b('colchon', -0.25, 0.93, 0, 0.6, 0.05, 0.5);
        p.b('fierroN', 0.35, 0.95, 0, 0.3, 0.1, 0.3); p.s('laton', 0.22, 0.35, 1.08, 0, 1, 0.22, 0.7, 12, 6); p.c('esfera', 0.08, 0.08, 0.02, 0.35, 1.12, 0.17, 14, Math.PI / 2);
        F2(1.6, 0.5, -L + 0.4, 1.35, 1.0, 0.65); }
      { const p = mueble(R('mecedora_mimbre', -3.4, Y2, -31.0, 0.6), -3.4, -31.0, 0.6, Y2); /* C7 (H41) */ /* HOSP-SALIDA: corrida 1,6 m: la salida del N3 va en el fondo (x −1) */ p.b('mimbre', 0, 0.45, 0, 0.5, 0.05, 0.5); p.b('mimbre', 0, 0.85, -0.24, 0.5, 0.75, 0.04, 0, -0.12);
        for (const s of [-1, 1]) { p.g('maderaOsc', new THREE.TorusGeometry(0.45, 0.02, 5, 10, 1.0).rotateZ(-Math.PI / 2 - 0.5).rotateY(Math.PI / 2).translate(s * 0.24, 0.47, 0)); p.b('maderaOsc', s * 0.24, 0.25, 0, 0.04, 0.42, 0.04); }
        F2(-3.4, 0.5, -31.0, 0.7, 1.0, 0.7); }
      cartel(g, texCartel(['SILENCIO', 'RECIÉN NACIDOS'], '#f1eee4', '#8a1c1c'), 1.1, 0.32, 0, Y2 + 2.9, -L + 0.03, 0);
      cartel(g, texCalendario(anio, viejo ? 'MAYO' : 'NOVIEMBRE'), 0.3, 0.38, -2.4, Y2 + 1.85, -L + 0.03, 0);
    }
    ascensor = pozoAscensor(J, g, fis, O, Y2, H, POZO, viejo, F);
  }

  // ------------------------------------------------ armar: una malla por material, con orden de coplanares (R-8)
  const T = (tipo, color, op = {}) => new THREE.MeshStandardMaterial({ color, roughness: op.r ?? 0.8, metalness: op.m ?? 0, side: op.doble ? THREE.DoubleSide : THREE.FrontSide, transparent: !!op.op, opacity: op.op ?? 1, depthWrite: !op.op });
  const mats = {
    friso: T(0, 0x86a892, { r: 0.55 }), filete: T(0, 0x2f4a3a, { r: 0.5 }), muroInt: T(0, S.muro ?? 0xeeeadc, { r: 0.9 }),
    blanco: material('blanco', 0xeceae2), blancoM: T(0, 0xf4f2ea, { r: 0.45 }), catre: T(0, 0xe2e5df, { r: 0.4, m: 0.3 }),
    madera: material('puerta', 0x7a5634), maderaOsc: material('puerta', 0x4e3420), verdeOsc: T(0, 0x3d5a46, { r: 0.5, m: 0.25 }),
    radiador: T(0, 0xb7b2a4, { r: 0.5, m: 0.4 }), fierroN: T(0, 0x2c2e30, { r: 0.5, m: 0.5 }), negro: T(0, 0x1b1c1e, { r: 0.5 }), laton: T(0, 0xb08d3c, { r: 0.35, m: 0.7 }),
    goma: T(0, 0x3a3430, { r: 0.95 }), greda: T(0, 0x9a5a3a, { r: 0.9 }), hoja: T(0, 0x3f6b3a, { r: 0.85 }), flor1: T(0, 0xd8506a), flor2: T(0, 0xf0d060),
    abrigo: T(0, 0x3a3a44, { r: 0.95 }), sombrero: T(0, 0x2c2622, { r: 0.8 }), papel: T(0, 0xf2eedf, { r: 0.9 }), lomo: T(0, 0x6a2a20),
    colchon: T(0, 0xf3f1ea, { r: 0.95 }), frazada: T(0, 0x8496ad, { r: 0.98 }), frazada2: T(0, 0xb39a72, { r: 0.98 }), tela: T(0, 0xe6e8dc, { r: 0.95, doble: true }),
    cortina: T(0, 0xefe9d8, { r: 0.95 }), carton: T(0, 0xa88457, { r: 0.95 }), cinta: T(0, 0xd8c9a4, { r: 0.7 }),   /* N0-UTIL3 (G8) */ mantel: T(0, 0xf6f4ec, { r: 0.95 }), mimbre: T(0, 0xa8865a, { r: 0.9 }), carton: T(0, 0xa88457, { r: 0.95 }), cinta: T(0, 0xd8c9a4, { r: 0.7 }),
    esfera: T(0, 0xf6f2e6, { r: 0.4 }), pantalla: T(0, 0x2f6a46, { r: 0.35, m: 0.2, doble: true }),
    ambar: T(0, 0x8a5a1c, { r: 0.2 }), azul: T(0, 0x2f4f8f, { r: 0.2 }), verdeV: T(0, 0x3f6f4f, { r: 0.2 }), blancoF: T(0, 0xeeeee6, { r: 0.3 }),
    vidrio: T(0, 0xd4e6ec, { r: 0.05, m: 0.1, op: 0.18 }), vidrioR: T(0, 0xd4e6ec, { r: 0.05, m: 0.1, op: 0.35 }),
    dia: new THREE.MeshBasicMaterial({ color: viejo ? 0xe9cfae : 0xe6eef4 }),
    // N4-HOSP2: 2.º piso y ascensor
    losa: matMundo(texDamero(), 1.6), cielo: T(0, S.techo ?? 0xf2f4ee, { r: 0.9 }), cortinaOsc: T(0, 0x1e2a24, { r: 0.95 }), esmerilado: T(0, 0xf4f6f4, { r: 0.4, op: 0.85 }),
    rojoL: new THREE.MeshBasicMaterial({ color: 0xd8301c }), alfombra: T(0, 0x6a2a24, { r: 0.98 }), cuero: T(0, viejo ? 0x4a2a1a : 0x1e1e20, { r: 0.6 }), hueso: T(0, 0xe8e0c8, { r: 0.6 }),
    verdeMaq: T(0, viejo ? 0x3f4f44 : 0x56645a, { r: 0.55, m: 0.35 }), crom: T(0, 0xd2d6da, { r: 0.35, m: 0.45 }), plomo: T(0, 0xa4a8aa, { r: 0.6, m: 0.1 }), domo: T(0, 0xf4f2ea, { r: 0.4, doble: true }), vidrioPb: T(0, 0x8a7a40, { r: 0.1, op: 0.7 }),
    marmol: T(0, 0xe6e2da, { r: 0.3 }), cable: T(0, 0x2a2622, { r: 0.5, m: 0.5 }), marfil: T(0, 0xeee4c8, { r: 0.4 }), espejo: T(0, 0xd8dcde, { r: 0.12, m: 0.9 }),
    luzOp: new THREE.MeshBasicMaterial({ color: 0xfff6e0, side: THREE.DoubleSide }), cobre: T(0, 0xb06a3a, { r: 0.35, m: 0.8 }), verdeQ: T(0, 0x4f8a78, { r: 0.9 }), piel: T(0, 0xe8b898, { r: 0.7 }),
    acril: T(0, 0xdfeef2, { r: 0.08, op: 0.28 }), fierro: T(0, viejo ? 0x24272a : 0x3a332c, { r: viejo ? 0.45 : 0.75, m: 0.55 }), oxido: T(0, 0x7a4426, { r: 0.95 }),
  };
  if (R8) for (const [k, n] of Object.entries({ friso: 0.6, filete: 1.2, muroInt: 0.4, blanco: 1, blancoM: 1.6, madera: 1.4, maderaOsc: 2, catre: 1.8, papel: 2.6, frazada: 2.2, frazada2: 2.2, colchon: 2.4, dia: 0.3, vidrio: 3.5, vidrioR: 3.5, cinta: 2.5, laton: 3, negro: 3.2 })) {
    let m = mats[k]; if (!m) continue; if (m.name?.startsWith('kit_')) m = mats[k] = m.clone(); m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -n * 8;
  }
  const gr = new THREE.Group(); gr.name = 'kit_hospital_mallas';
  for (const k of Object.keys(J.p)) { const geo = J.geometria(k); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'hosp_' + k; m.receiveShadow = true; m.castShadow = false; if (mats[k]?.transparent) m.renderOrder = 2; gr.add(m); }
  gr.position.copy(O); g.add(gr);
  for (const [id, { JR, it }] of RESP) {   // N0-UTIL3 (G2): respaldo de cada pieza en su grupo; se oculta al montar la malla
    const gR = new THREE.Group(); gR.name = 'hosp_resp_' + id;
    for (const k of Object.keys(JR.p)) { const geo = JR.geometria(k); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'hosp_' + k; m.receiveShadow = true; if (mats[k]?.transparent) m.renderOrder = 2; gR.add(m); }
    gR.position.copy(O); g.add(gR); montarEnKit(g, it, { ocultar: gR });
  }
  { const gQ = {};   // Q1: respaldos de las piezas con parte móvil o vidrio; se ocultan cuando su malla quedó armada
    for (const [id, JR] of RQ) { const gR = new THREE.Group(); gR.name = 'hosp_respq1_' + id; gQ[id] = gR;
      for (const k of Object.keys(JR.p)) { const geo = JR.geometria(k); if (!geo) continue; const m = new THREE.Mesh(geo, mats[k] ?? mats.blanco); m.name = 'hosp_' + k; m.receiveShadow = true; if (mats[k]?.transparent) m.renderOrder = 2; gR.add(m); }
      gR.position.copy(O); g.add(gR); }
    const pu = precargarUtileria(); if (pu) pu.then(() => { for (const { id, fn } of QM) { let ok = false; try { ok = fn(); } catch (e) { console.warn('Q1 hospital:', id, e && e.message); } if (ok && gQ[id]) gQ[id].visible = false; } });
  }
  g.children.filter(o => o.name === 'hosp_cartel').forEach(o => o.position.add(O));

  // ------------------------------------------------ lámparas colgantes de esmalte blanco (en el eje) y luz: 4 puntuales + ambiente templada
  const zLamp = [-2.8, -9.4, -13.8, -20.4, -25.6, -30.8], mPan = T(0, 0xf2f1ea, { r: 0.35, m: 0.15, doble: true }), mAmp = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
  const JL = new Junta();
  for (const z of zLamp) { const yl = H - 1.05;
    JL.add('c', new THREE.CylinderGeometry(0.008, 0.008, H - yl - 0.2, 4).translate(0, (H + yl + 0.2) / 2, z));
    JL.add('p', new THREE.ConeGeometry(0.34, 0.2, 18, 1, true).translate(0, yl + 0.1, z)); JL.add('p', new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10).translate(0, yl + 0.23, z));
    JL.add('a', new THREE.SphereGeometry(0.075, 10, 8).translate(0, yl + 0.02, z));
    JL.add('c', new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10).translate(0, H - 0.015 - 0.002, z)); }
  if (dosPisos) for (const [x, z] of [[0, -3.0], [-1.6, -7.9], [4.2, -7.9], [0, -14.2], [0, -30.8]]) { const yl = Y2 + H - 1.05, Ht = Y2 + H;   // N4-HOSP2: lámparas del 2.º piso (el pabellón tiene la cialítica)
    JL.add('c', new THREE.CylinderGeometry(0.008, 0.008, Ht - yl - 0.2, 4).translate(x, (Ht + yl + 0.2) / 2, z));
    JL.add('p', new THREE.ConeGeometry(0.34, 0.2, 18, 1, true).translate(x, yl + 0.1, z)); JL.add('p', new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10).translate(x, yl + 0.23, z));
    JL.add('a', new THREE.SphereGeometry(0.075, 10, 8).translate(x, yl + 0.02, z)); JL.add('c', new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10).translate(x, Ht - 0.017, z)); }
  for (const [k, m] of [['c', mats.negro], ['p', mPan], ['a', mAmp]]) { const geo = JL.geometria(k); const ms = new THREE.Mesh(geo, m); ms.position.copy(O); ms.name = 'hosp_lamp_' + k; ms.frustumCulled = false; if (k === 'a') ms.onBeforeRender = (r, sc, cam) => g.userData.pisoLuz?.(cam.position.y); g.add(ms); }
  const tono = viejo ? 0xffe3b8 : 0xfff0d8;
  const P1 = [[0, -6.2, 26], [2.2, -14.6, 22], [0, -21.4, 26], [0, -29.6, 26]].map(([x, z, I]) => [x, H - 1.2, z, I]);
  const luces = P1.map(([x, y, z, I]) => { const l = new THREE.PointLight(tono, I, 15, 1.6); l.position.set(O.x + x, O.y + y, O.z + z); g.add(l); return l; });
  // N4-HOSP2: las mismas 4 luces van al piso donde está la cámara (8 luces puntuales bajaban el hospital de ~57 a ~33 fps en la iGPU;
  // three.js calcula todas las luces en cada fragmento). Se cambian de piso con histéresis cuando la cámara cruza la losa.
  if (dosPisos) {
    const P2 = [[0.5, -5.6, 24], [1.2, -14.2, 22], [0, -22.9, 30], [0, -30.8, 24]].map(([x, z, I]) => [x, Y2 + H - (z === -22.9 ? 1.5 : 1.2), z, I]);
    let arriba = false; const poner = P => P.forEach(([x, y, z, I], i) => { luces[i].position.set(O.x + x, O.y + y, O.z + z); luces[i].intensity = I; luces[i].userData.luz0 = I; });
    g.userData.pisoLuz = cy => { const a = arriba ? cy - O.y > Y2 - 0.3 : cy - O.y > Y2 + 0.5; if (a !== arriba) { arriba = a; poner(a ? P2 : P1); } return arriba; };
  }
  g.add(new THREE.AmbientLight(0xf2ece0, 0.32));
  if (ascensor) g.userData.ascensor = ascensor;   // N4-HOSP2: construirSala lo pasa a sala.ascensores; entidades.js lo anima (kit)
  return g;
}

// ======================================================================================= 1967 en el cine y el palitroque (N4)
// Pocos detalles de época que no cambian la sala del N2: cajas de mudanza (Operación Valle), aviso de traslado y calendario de 1967.
export function adornosEpoca(S, O, fis) {
  const g = new THREE.Group(); g.name = 'kit_adornos_' + (S.epoca || ''); if (!S.epoca || S.epoca < 1960) return g;
  const J = new Junta(), hw = S.ancho / 2, F = (x, y, z, sx, sy, sz) => fis.caja(O.x + x, O.y + y, O.z + z, sx, sy, sz, 0, { tipo: 'mueble' });
  const cine = S.kit === 'teatro165', y0 = cine ? (S.entrada?.y || 0) : 0;
  // cajas de mudanza (en el cine, sobre la galería de la entrada, junto al muro; en el palitroque, junto a la entrada)
  const xc = cine ? hw - 1.2 : -hw + 0.9, zc = cine ? -1.4 : -2.4;
  const JC = new Junta(), itC = [];   // N0-UTIL3 (G8): cajas de mudanza de malla; respaldo procedural en JC
  for (const [dx, dy, dz, sx, sy, sz, r] of [[0, 0.25, 0, 0.6, 0.5, 0.5, 0.1], [0.02, 0.71, 0.05, 0.5, 0.42, 0.45, -0.15], [cine ? -0.75 : 0.7, 0.22, -0.3, 0.5, 0.44, 0.45, 0.3]]) {
    itC.push({ id: 'caja_mudanza', x: O.x + xc + dx, y: O.y + y0 + dy - sy / 2, z: O.z + zc + dz, ry: r, esc: [sx / 0.6, sy / 0.45, sz / 0.45] });
    JC.caja('carton', xc + dx, y0 + dy, zc + dz, sx, sy, sz, r); JC.caja('cinta', xc + dx, y0 + dy + sy / 2 + 0.004, zc + dz, 0.08, 0.008, sz + 0.004, r); }
  F(xc + (cine ? -0.35 : 0.35), y0 + 0.5, zc - 0.1, 1.5, 1.0, 1.0);
  const mats = { carton: new THREE.MeshStandardMaterial({ color: 0xa88457, roughness: 0.95 }), cinta: new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 0.7 }), tabla: material('puerta', 0x5a3c24) };
  // diario mural con el aviso (a 2 cm del muro; el cartel 2,2 cm delante del tablero)
  const s = cine ? 1 : -1, xm = s * (hw - (cine ? 0.08 : 0.03)), ym = y0 + (cine ? 1.45 : 2.3), zm = cine ? -3.47 : -1.6;   // cine: entre la pilastra (−2,5) y el farol (−4,3)   // cine: el estuco del kit cubre el muro 6 cm
  J.caja('tabla', xm, ym, zm, 0.04, 0.9, cine ? 1.05 : 1.25);
  for (const k of Object.keys(J.p)) { const m = new THREE.Mesh(J.geometria(k), mats[k]); m.position.copy(O); m.name = 'adorno_' + k; g.add(m); }
  { const gC = new THREE.Group(); gC.name = 'adorno_resp_cajas'; for (const k of Object.keys(JC.p)) { const m = new THREE.Mesh(JC.geometria(k), mats[k]); m.name = 'adorno_' + k; gC.add(m); } gC.position.copy(O); g.add(gC); montarEnKit(g, itC, { ocultar: gC }); }   // N0-UTIL3 (G8)
  const lineas = cine ? ['ESTA SEMANA', 'Función de las familias que bajan', 'a Rancagua · Operación Valle'] : ['OPERACIÓN VALLE', 'Las familias con casa asignada', 'inscriban su traslado en Bienestar'];
  cartel(g, texCartel(lineas, '#f4efe2', '#1f3a2c', 512, 256), cine ? 0.95 : 1.1, cine ? 0.48 : 0.55, O.x + xm - s * 0.042, ym + 0.08, O.z + zm, -s * Math.PI / 2);
  cartel(g, texCalendario(1967, 'NOVIEMBRE'), 0.3, 0.38, O.x + xm - s * 0.012, ym - 0.05, O.z + zm + (cine ? -0.84 : 1.0), -s * Math.PI / 2);
  return g;
}

// ======================================================================================= N4-HOSP2: ascensor de época del Edificio 157
// Cabina de madera con rejas de fierro, reja plegable de tijera en la cabina y en cada piso, botonera de bronce, indicador de piso de aguja
// (en cada rellano y dentro), máquina arriba del pozo (motor, reductor, tambor con cables) y contrapeso que baja cuando la cabina sube.
// Se entra caminando; E dentro de la cabina (o en el rellano del otro piso: «llamar») cierra las rejas, la cabina viaja con Nato y la
// cámara dentro (plataforma cinemática de Rapier: el controlador de Nato la sigue con el delta de la plataforma) y al llegar se abren.
const planoUtil = (m, n, rx = 1) => { const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil(n); if (!t) return; if (rx > 1) { t.wrapS = THREE.RepeatWrapping; const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * rx); uv.needsUpdate = true; } m.material.map = t; m.material.needsUpdate = true; }); };   // N0-UTIL3 (P2): textura de Qwen cuando carga el índice (respaldo: el lienzo procedural)
function texRadiografia() {
  return texto('rx2', 512, 256, (c, w, h) => {
    c.fillStyle = '#0b1216'; c.fillRect(0, 0, w, h);
    for (const cx of [w * 0.25, w * 0.75]) {
      c.fillStyle = 'rgba(120,150,165,0.18)'; c.beginPath(); c.ellipse(cx, h * 0.55, w * 0.17, h * 0.4, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(215,232,240,0.8)'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx, h * 0.08); c.lineTo(cx, h * 0.95); c.stroke();
      c.lineWidth = 3.5; for (let i = 0; i < 8; i++) { const y = h * (0.2 + i * 0.085); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx, y); c.quadraticCurveTo(cx + s * w * 0.16, y - h * 0.03, cx + s * w * 0.14, y + h * 0.1); c.stroke(); } }
      c.lineWidth = 5; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 8, h * 0.14); c.lineTo(cx + s * w * 0.16, h * 0.2); c.stroke(); }   // clavículas
    }
    c.strokeStyle = '#2a3236'; c.lineWidth = 8; c.strokeRect(4, 4, w / 2 - 8, h - 8); c.strokeRect(w / 2 + 4, 4, w / 2 - 8, h - 8);
  });
}
function texDial(viejo) {
  return texto('dial' + viejo, 256, 160, (c, w, h) => {
    const cx = w / 2, cy = h * 0.85, r = h * 0.8;
    c.fillStyle = viejo ? '#efe6cc' : '#ddd0a8'; c.beginPath(); c.arc(cx, cy, r, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = '#2a2218'; c.lineWidth = 6; c.stroke();
    c.lineWidth = 3; for (let i = 0; i <= 10; i++) { const a = -0.75 + i * 0.15; c.beginPath(); c.moveTo(cx + Math.sin(a) * r * 0.78, cy - Math.cos(a) * r * 0.78); c.lineTo(cx + Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9); c.stroke(); }
    c.fillStyle = '#2a2218'; c.font = 'bold 40px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('1', cx - Math.sin(0.75) * r * 0.58, cy - Math.cos(0.75) * r * 0.58); c.fillText('2', cx + Math.sin(0.75) * r * 0.58, cy - Math.cos(0.75) * r * 0.58);
    if (!viejo) { c.fillStyle = 'rgba(90,70,40,0.25)'; for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h * 0.85, 3, 3); }   // 1967: esfera amarillenta y manchada
  });
}
function texBotonera(viejo) {
  return texto('boton' + viejo, 96, 224, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, viejo ? '#d8b860' : '#a88c4c'); gr.addColorStop(1, viejo ? '#9a7a30' : '#6e5a30');
    c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = '#4a3814'; c.lineWidth = 5; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#2a1e08'; c.font = 'bold 26px Georgia, serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('2', 14, h * 0.2); c.fillText('1', 14, h * 0.45); c.font = 'bold 14px Georgia, serif'; c.fillText('PARAR', 10, h * 0.82);
    for (const y of [0.04, 0.96]) { c.beginPath(); c.arc(w / 2, h * y + (y < 0.5 ? 6 : -6), 3, 0, 7); c.fill(); }   // tornillos
  });
}
// reja plegable de tijera: barras verticales y eslabones en X que se juntan hacia el ancla (z = 0 local; se extiende hacia −z)
function tijera(Wd, Hd, mF) {
  const N = Math.round(Wd / 0.2) + 1, nb = 3, hb = (Hd - 0.16) / nb, nl = (N - 1) * nb * 2;
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, Hd, 0.026), mF, N), links = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 1, 0.012), mF, nl);
  bars.frustumCulled = links.frustumCulled = false; bars.name = 'asc_reja'; links.name = 'asc_eslabones';
  const grp = new THREE.Group(); grp.add(bars, links);
  const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), uno = new THREE.Vector3(1, 1, 1);
  let kp = -1;
  const poner = k => {
    if (Math.abs(k - kp) < 1e-4) return; kp = k;
    const w = Wd - (Wd - 0.03 * (N - 1)) * k, s = w / (N - 1);
    for (let i = 0; i < N; i++) bars.setMatrixAt(i, M4.compose(v.set(0, Hd / 2, -i * s), q.identity(), uno));
    const L = Math.hypot(s, hb); let n = 0;
    for (let i = 0; i < N - 1; i++) for (let b = 0; b < nb; b++) for (const sg of [-1, 1]) {
      eu.set(Math.atan2(sg * s, hb), 0, 0); q.setFromEuler(eu); sc.set(1, L, 1);
      links.setMatrixAt(n++, M4.compose(v.set(0, 0.08 + (b + 0.5) * hb, -(i + 0.5) * s), q, sc));
    }
    bars.instanceMatrix.needsUpdate = true; links.instanceMatrix.needsUpdate = true;
  };
  poner(0);
  return { grp, poner };
}
function pozoAscensor(J, g, fis, O, Y2, H, P, viejo, F) {
  const Ht = Y2 + H, xF = P.x0, xE = P.x1, zA = P.z0, zB = P.z1, zc = (zA + zB) / 2, xD = 6.58, xC = 5.5;
  const YP = [0.02, Y2 + 0.02], pz0 = -2.2, pz1 = -3.8, hp = 2.3, TV = 3.6, TR = 0.9;
  const vert = (x, z, sx, sz, y0, y1, k = 'fierro') => J.caja(k, x, (y0 + y1) / 2, z, sx, y1 - y0, sz);
  // ---- pozo fijo: pilares, rejas laterales y del frente, guías, divisor del contrapeso, vigas y máquina
  for (const z of [zA, zB]) {
    vert(xF, z, 0.1, 0.1, 0, Ht); vert(xE - 0.06, z, 0.08, 0.08, 0, Ht);
    for (let x = xF + 0.13; x < xE - 0.1; x += 0.13) vert(x, z, 0.018, 0.018, 0, Ht);
    for (const y of [0.05, 1.0, 2.4, H + 0.1, Y2 + 0.06, Y2 + 1.0, Y2 + 2.4, Ht - 0.08]) J.caja('fierro', (xF + xE) / 2, y, z, xE - xF, 0.05, 0.04);
    F((xF + xE) / 2, Ht / 2, z, xE - xF, Ht, 0.08, 'muro');
  }
  for (const [a, b] of [[zA, pz0], [pz1, zB]]) {   // paños del frente a los lados de la puerta
    for (let z = a - 0.13; z > b + 0.05; z -= 0.13) vert(xF, z, 0.018, 0.018, 0, Ht);
    for (const y of [0.05, 1.0, 2.4, H + 0.1, Y2 + 0.06, Y2 + 1.0, Y2 + 2.4, Ht - 0.08]) J.caja('fierro', xF, y, (a + b) / 2, 0.04, 0.05, Math.abs(a - b));
    F(xF, Ht / 2, (a + b) / 2, 0.08, Ht, Math.abs(a - b), 'muro');
  }
  for (const z of [pz0, pz1]) vert(xF, z, 0.08, 0.08, 0, Ht);   // jambas
  for (const [y0, y1] of [[YP[0] + hp + 0.02, YP[1]], [YP[1] + hp + 0.02, Ht]]) {   // dinteles de reja sobre cada puerta
    for (let z = pz0 - 0.13; z > pz1 + 0.05; z -= 0.13) vert(xF, z, 0.018, 0.018, y0, y1);
    J.caja('fierro', xF, y0, (pz0 + pz1) / 2, 0.06, 0.06, pz0 - pz1); F(xF, (y0 + y1) / 2, (pz0 + pz1) / 2, 0.08, y1 - y0, pz0 - pz1, 'muro');
    // arco de volutas sobre la puerta (rombos de pletina)
    for (let i = 0; i < 5; i++) J.caja('fierro', xF - 0.01, y0 + 0.22, pz0 - 0.16 - i * 0.32, 0.015, 0.22, 0.22, 0, Math.PI / 4);
  }
  for (const f of [0, 1]) {   // rieles de las rejas del rellano, botón de llamada, placa y letrero
    J.caja('fierro', xF - 0.06, YP[f] + hp + 0.03, (pz0 + pz1) / 2, 0.05, 0.04, pz0 - pz1); J.caja('fierro', xF - 0.06, YP[f] - 0.012, (pz0 + pz1) / 2, 0.06, 0.012, pz0 - pz1);
    J.caja('laton', xF - 0.06, YP[f] + 1.2, pz0 + 0.3, 0.012, 0.2, 0.1); J.add('marfil', new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12).rotateZ(Math.PI / 2).translate(xF - 0.075, YP[f] + 1.22, pz0 + 0.3));
    J.caja('laton', xF - 0.045, YP[f] + 2.62, zc, 0.012, 0.34, 0.52);
    cartel(g, texCartel(['ASCENSOR'], '#1f3a2c', '#efe8d2', 512, 128), 1.0, 0.25, xF - 0.06, YP[f] + 3.1, zc, -Math.PI / 2);
  }
  // guías de la cabina y del contrapeso, divisor (reja rala) y su colisión
  for (const z of [zA - 0.07, zB + 0.07]) vert(xC, z, 0.07, 0.05, 0, Ht, 'fierroN');
  for (const z of [zc + 0.42, zc - 0.42]) vert(6.78, z, 0.05, 0.05, 0, Ht, 'fierroN');
  for (let z = zA - 0.3; z > zB + 0.1; z -= 0.3) vert(xD, z, 0.02, 0.02, 0, Ht);
  for (const y of [0.05, 2.4, H + 0.1, Y2 + 2.4, Ht - 0.08]) J.caja('fierro', xD, y, zc, 0.03, 0.05, zA - zB);
  F(xD, Ht / 2, zc, 0.06, Ht, zA - zB, 'muro');
  if (!viejo) for (const [y, z] of [[0.3, zA], [0.12, zB], [0.6, zB], [Y2 + 0.1, zA]]) J.caja('oxido', xF + 0.6, y, z + (z === zA ? -0.025 : 0.025), 0.5, 0.18, 0.012);   // 1967: óxido en los rieles bajos
  // máquina en lo alto del pozo: vigas, reductor, motor, freno, polea del contrapeso
  for (const dz of [-0.55, 0.55]) J.caja('fierroN', (xF + xE) / 2, 7.95, zc + dz, xE - xF, 0.2, 0.12);
  J.caja('verdeMaq', 6.15, 8.35, zc, 0.42, 0.45, 0.5); J.add('verdeMaq', new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16).rotateX(Math.PI / 2).translate(6.15, 8.32, zc - 0.5));
  J.add('crom', new THREE.CylinderGeometry(0.15, 0.15, 0.12, 16).rotateX(Math.PI / 2).translate(6.15, 8.32, zc + 0.33));
  J.caja('fierroN', 5.85, 8.35, zc, 0.6, 0.06, 0.06); J.add('fierro', new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16).rotateX(Math.PI / 2).translate(6.78, 8.45, zc));
  J.caja('cable', 6.3, 8.55, zc, 0.95, 0.012, 0.012, 0, 0, 0.25);
  // ---- piezas que se mueven (marco local de la sala; el grupo va en O)
  const T = (c, op = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: op.r ?? 0.6, metalness: op.m ?? 0 });
  const mt = {
    fierro: T(viejo ? 0x24272a : 0x3a332c, { r: viejo ? 0.45 : 0.75, m: 0.55 }), fierroN: T(0x1c1d1f, { r: 0.5, m: 0.5 }), laton: T(viejo ? 0xb8923c : 0x8a7442, { r: viejo ? 0.3 : 0.55, m: 0.75 }),
    madCab: material('puerta', viejo ? 0x6b4428 : 0x5a3c26), madOsc: material('puerta', 0x3e2818), marfil: T(0xeee4c8, { r: 0.4 }), rojoB: T(0x9a1c1c, { r: 0.4 }),
    cable: T(0x2e2e2e, { r: 0.45, m: 0.6 }), cabPiso: T(viejo ? 0x5a3d26 : 0x55504a, { r: 0.8 }), amp: new THREE.MeshBasicMaterial({ color: 0xfff1c8 }), crom: T(0xb8bcc0, { r: 0.3, m: 0.8 }),
  };
  const mov = new THREE.Group(); mov.name = 'kit_ascensor'; mov.position.copy(O); g.add(mov);
  const cab = new THREE.Group(); cab.name = 'asc_cabina'; mov.add(cab);
  const JC = new Junta(), xi = xF + 0.18, xb = xD - 0.1, zs0 = zA - 0.12, zs1 = zB + 0.12, xm = (xi + xb) / 2, wz = zs0 - zs1;
  JC.caja('cabPiso', (xF + 0.05 + xD - 0.08) / 2, -0.09, zc, xD - 0.08 - xF - 0.05, 0.18, zA - zB - 0.06);
  for (const z of [zs0, zs1]) {   // costados: tablero de madera abajo, reja arriba, pasamanos de bronce
    JC.caja('madCab', xm, 0.5, z, xb - xi, 1.0, 0.04); for (let x = xi + 0.25; x < xb - 0.1; x += 0.45) JC.caja('madOsc', x + 0.1, 0.5, z + (z === zs0 ? -0.024 : 0.024), 0.36, 0.7, 0.012);
    for (let x = xi + 0.1; x < xb - 0.05; x += 0.12) JC.caja('fierro', x, 1.7, z, 0.015, 1.4, 0.015);
    for (const y of [1.02, 1.7, 2.42]) JC.caja('fierro', xm, y, z, xb - xi, 0.04, 0.03);
    JC.caja('laton', xm, 0.95, z + (z === zs0 ? -0.06 : 0.06), xb - xi - 0.2, 0.035, 0.035);
  }
  JC.caja('madCab', xb, 1.22, zc, 0.04, 2.45, wz); for (const zz of [zc + 0.55, zc - 0.55]) for (const [y, h] of [[0.55, 0.75], [1.65, 1.0]]) JC.caja('madOsc', xb - 0.024, y, zz, 0.012, h, 0.85);
  JC.caja('laton', xb - 0.06, 0.95, zc, 0.035, 0.035, wz - 0.2);
  for (const [x, z] of [[xi, zs0], [xi, zs1], [xb, zs0], [xb, zs1]]) JC.caja('fierro', x, 1.25, z, 0.06, 2.5, 0.06);
  for (const z of [zs0, zs1]) JC.caja('fierro', xm, 2.5, z, xb - xi + 0.06, 0.06, 0.06); for (const x of [xi, xb]) JC.caja('fierro', x, 2.5, zc, 0.06, 0.06, wz);
  for (let x = xi + 0.2; x < xb - 0.1; x += 0.22) JC.caja('fierro', x, 2.5, zc, 0.015, 0.015, wz);   // techo de reja (se ve a Nato desde arriba)
  JC.caja('fierro', xm, 2.5, zc, xb - xi, 0.015, 0.015);
  JC.add('amp', new THREE.SphereGeometry(0.06, 10, 8).translate(xm, 2.33, zc)); JC.add('fierro', new THREE.ConeGeometry(0.14, 0.1, 12, 1, true).translate(xm, 2.42, zc));
  // cruceta, montantes y enganche de los cables
  JC.caja('fierroN', xC, 2.78, zc, 0.12, 0.14, zA - zB - 0.1); for (const z of [zA - 0.12, zB + 0.12]) JC.caja('fierroN', xC, 1.4, z, 0.08, 2.8, 0.05);
  JC.caja('crom', xC, 2.9, zc, 0.12, 0.1, 0.2);
  // rieles de la reja de la cabina y botonera de bronce (en el costado sur, junto a la puerta)
  JC.caja('fierro', xF + 0.13, hp + 0.03, zc, 0.05, 0.04, wz); JC.caja('fierro', xF + 0.13, 0.008, zc, 0.06, 0.016, wz);
  for (const [y, k] of [[1.43, 'marfil'], [1.32, 'marfil'], [1.14, 'rojoB']]) JC.add(k, new THREE.CylinderGeometry(0.022, 0.022, 0.025, 12).rotateX(Math.PI / 2).translate(xi + 0.27, y, zs1 + 0.04));
  for (const k of Object.keys(JC.p)) { const m = new THREE.Mesh(JC.geometria(k), mt[k]); m.name = 'asc_' + k; cab.add(m); }
  const placa = (padre, tex, w, h, x, y, z, ry, transp) => { const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.2, transparent: false, alphaTest: transp ? 0.5 : 0 });
    m.polygonOffset = true; m.polygonOffsetUnits = -30; const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = ry; padre.add(p); return p; };
  placa(cab, texBotonera(viejo), 0.16, 0.38, xi + 0.25, 1.3, zs1 + 0.025, 0);
  placa(cab, texCartel(['CAPACIDAD', '6 PERSONAS · 450 KG'], '#c8a44c', '#2a1e08', 384, 160), 0.42, 0.17, xb - 0.036, 1.55, zc, -Math.PI / 2);
  if (!viejo) placa(cab, texCartel(['NO SOBRECARGAR', 'CIERRE LA REJA'], '#efe6d0', '#1f3a2c', 384, 160), 0.32, 0.14, xb - 0.036, 1.32, zc + 0.6, -Math.PI / 2);
  // indicadores de aguja: uno en cada rellano y uno dentro de la cabina (en el fondo)
  const agujas = [], mAg = T(0x1a1410, { r: 0.4 });
  const dial = (padre, x, y, z, ry) => { const p = placa(padre, texDial(viejo), 0.44, 0.275, x, y, z, ry, true), gA = new THREE.Group(); gA.position.set(0, -0.096, 0.006);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.15, 0.004).translate(0, 0.07, 0), mAg); gA.add(a); gA.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 10).rotateX(Math.PI / 2), mt.laton)); p.add(gA); agujas.push(gA); };
  for (const f of [0, 1]) dial(mov, xF - 0.056, YP[f] + 2.62, zc, -Math.PI / 2);
  dial(cab, xb - 0.036, 2.1, zc, -Math.PI / 2);
  // rejas de tijera: la de la cabina (viaja) y una por rellano
  const rC = tijera(wz - 0.04, hp, mt.fierro); rC.grp.position.set(xF + 0.13, 0.02, zs0 - 0.02); cab.add(rC.grp);
  const rP = [0, 1].map(f => { const r = tijera(pz0 - pz1 - 0.04, hp, mt.fierro); r.grp.position.set(xF - 0.06, YP[f], pz0 - 0.02); mov.add(r.grp); return r; });
  // tambor, cables y contrapeso
  const tambor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.6, 18).rotateX(Math.PI / 2), mt.fierro); tambor.position.set(5.6, 8.35, zc); mov.add(tambor);
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.6), mt.laton); r.position.set(Math.cos(i * 1.05) * 0.24, Math.sin(i * 1.05) * 0.24, 0); r.rotation.z = i * 1.05; tambor.add(r); }   // marcas para ver girar el tambor
  const cables = [-0.07, 0, 0.07].map(dz => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 6).translate(0, 0.5, 0), mt.cable); c.position.set(xC, 0, zc + dz); mov.add(c); return c; });
  const cp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.7), mt.fierroN); cp.position.x = 6.78; cp.position.z = zc; mov.add(cp);
  const cablesCP = [-0.1, 0.1].map(dz => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 6).translate(0, 0.5, 0), mt.cable); c.position.set(6.78, 0, zc + dz); mov.add(c); return c; });
  // ---- física: piso de la cabina y una reja por rellano. Colisionadores FIJOS que se mueven con setTranslation: sobre un cuerpo
  // cinemático de Rapier el controlador de Nato quedaba clavado (velocidad 4,9 y 0 cm de avance; sin él caminaba). Durante el viaje
  // Nato va sobre la cabina cuadro a cuadro (misma x/z, la y de la cabina): se ve subir con ella, sin corte ni fundido.
  const xP = O.x + (xF + 0.05 + xD - 0.08) / 2, zP = O.z + zc;
  const piso0 = fis.caja(xP, O.y + YP[0] - 0.1, zP, xD - 0.08 - xF - 0.05, 0.2, zA - zB - 0.06, 0, { tipo: 'ascensor' });
  const rejaF = [0, 1].map(f => fis.caja(O.x + xF - 0.04, O.y + YP[f] + hp / 2 + 0.05, O.z + (pz0 + pz1) / 2, 0.12, hp + 0.1, pz0 - pz1 + 0.04, 0, { tipo: 'muro' }));
  const reja = (f, cerrada) => rejaF[f].setTranslation({ x: O.x + xF - 0.04, y: cerrada ? O.y + YP[f] + hp / 2 + 0.05 : O.y - 60 - f * 5, z: O.z + (pz0 + pz1) / 2 });
  reja(0, false); reja(1, true);
  let est = 'abierta', piso = 0, dest = 0, k = 1, yc = YP[0], t = 0;
  const poner = () => {
    cab.position.y = yc; rC.poner(k); rP.forEach((r, f) => r.poner(f === piso && est !== 'viaja' ? k : 0));
    const p = (yc - YP[0]) / (YP[1] - YP[0]); for (const a of agujas) a.rotation.z = (0.5 - p) * 1.5;
    tambor.rotation.z = -yc / 0.24;
    const yT = 8.11; for (const c of cables) { c.position.y = yc + 2.95; c.scale.y = Math.max(0.05, yT - yc - 2.95); }
    cp.position.y = 7.25 - yc; for (const c of cablesCP) { c.position.y = cp.position.y + 0.55; c.scale.y = Math.max(0.05, 8.3 - cp.position.y - 0.55); }
  };
  poner();
  const kit = (M, e) => {
    let tAviso = 0, cam = null;
    return dt => {
      const j = M.jug; if (!j) return;
      const lx = j.pos.x - O.x, lz = j.pos.z - O.z, pie = j.pie - O.y;
      const enPlanta = lx > xi - 0.05 && lx < xb && lz < zs0 && lz > zs1, dentro = enPlanta && Math.abs(pie - yc) < 0.8;
      const planta = pie > Y2 * 0.5 ? 1 : 0, rellano = lx > xF - 2.2 && lx <= xi && lz < zA && lz > zB && Math.abs(pie - YP[planta]) < 0.9;
      if (est === 'abierta' && E.b.accion.recien) {
        if (dentro) { dest = 1 - piso; est = 'cierra'; E.b.accion.recien = false; }
        else if (rellano && planta !== piso) { dest = planta; est = 'cierra'; E.b.accion.recien = false; M.aviso('Llamando al ascensor…', 1500); }
        if (est === 'cierra') M.efecto('crujido');
      }
      if (est === 'cierra') { k = Math.max(0, k - dt / TR); if (k === 0) { est = 'viaja'; t = 0; reja(piso, true); if (dentro) M.aviso(dest ? 'Subiendo al 2.º piso…' : 'Bajando al 1.er piso…', 2200); } }
      else if (est === 'viaja') { t += dt; const u = Math.min(1, t / TV), s = u * u * (3 - 2 * u); yc = YP[piso] + (YP[dest] - YP[piso]) * s; if (u >= 1) { piso = dest; est = 'abre'; M.efecto('crujido'); } }
      else if (est === 'abre') { k = Math.min(1, k + dt / TR); if (k === 1) { est = 'abierta'; reja(piso, false); } }
      if (est === 'viaja' || est === 'abre') piso0.setTranslation({ x: xP, y: O.y + yc - 0.1, z: zP });
      poner(); e.y = yc;
      // viaja con la cabina: Nato queda sobre su piso cada cuadro (la x/z son las suyas; se puede mover dentro de la cabina)
      if (enPlanta && est === 'viaja' && Math.abs(pie - yc) < 1.5) { j.p.teletransportar(j.pos.x, O.y + yc + j.p.medio + j.p.radio + 0.005, j.pos.z); j.vel.y = 0; j.p.enSuelo = true; j.p.sueloCol = piso0; }
      // cámara: dentro de la cabina se acerca (como en los interiores procedurales) en vez de subir a mirar desde el techo
      if (dentro && !cam) { cam = { md: M.cam.minDist }; M.cam.minDist = 0.9; }
      else if (!dentro && cam) { M.cam.minDist = cam.md; cam = null; }
      // mientras las rejas se cierran, viaja y se abren: cámara fija en el rincón de la cabina, a la altura del techo, mirando a Nato
      // y por la reja hacia el rellano (se ve pasar la losa); con la cámara de órbita quedaba encima del techo de reja mirando hacia abajo
      const Gj = globalThis.JUEGO, fija = dentro && est !== 'abierta';
      if (Gj && fija) { Gj.camLibre = { pos: [O.x + xb - 0.22, O.y + yc + 2.15, O.z + zs0 - 0.22], mira: [O.x + xi + 0.15, O.y + yc + 0.75, O.z + zc - 0.35] }; e.camFija = true; }
      else if (Gj && e.camFija) { Gj.camLibre = null; e.camFija = false; M.cam.yaw = Math.PI / 2; j.rumbo = M.cam.yaw - Math.PI; M.cam.cortar?.(); }   // al abrir: Nato mira a la reja, cámara a su espalda
      if (est === 'abierta' && performance.now() > tAviso && (dentro || (rellano && planta !== piso))) {
        tAviso = performance.now() + 1500;
        M.aviso(dentro ? (piso === 0 ? 'Ascensor · E: subir al 2.º piso' : 'Ascensor · E: bajar al 1.er piso') : 'E: llamar al ascensor', 1600);
      }
    };
  };
  const estado = () => ({ est, piso, yc, k });
  return { x: O.x + xm, z: O.z + zc, y0: YP[0], y1: YP[1], kit, estado };
}

// N2-ESCUELA (carril interiores, 15-11-2026): utilidades compartidas con kitEscuela.js (escuela industrial y museo del ed. 129)
export { texto, texCartel, texCalendario, cartel, mueble };
