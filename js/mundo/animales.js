// N1-PUEBLO-VIDA (carril vida, 15-11-2026): mulas y bueyes PROCEDURALES (no hay modelos): tronco, cuello y cabeza con orejas o
// cuernos, cola, patas de dos segmentos (brazo/antebrazo, muslo/caña) con casco, y su carga: aparejo con pirquas (mula) o yugo
// atado a los cuernos con coyundas y pértiga a la carreta (yunta).
// Caminata sin patinar: cada pata tiene su fase (paso lateral de 4 tiempos: PI 0, MI 0,25, PD 0,5, MD 0,75) avanzada por la
// DISTANCIA recorrida, no por el tiempo; en el apoyo el casco queda fijo en el mundo (avanza hacia atrás exactamente lo que avanza
// el cuerpo) y la pata se resuelve con cinemática inversa de dos huesos contra el suelo real (rayos), así sube y baja la ladera.
// Rutas: polilíneas cerradas por los caminos (datos en js/datos/vida.js), suavizadas; se detienen si Nato está delante.
// Rendimiento: invisibles a > 90 m, sin animar a > 50 m, rayos solo cerca. Sin colisión física: empujan suave a Nato (como la gente).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './construir.js';
import { texMat } from './texFaena.js';   // TEX (16-11): sacos de arpillera de la mula y de la carreta de bueyes
import { persona1905 } from './gente1905.js';
import { pila, vuelo, saco, tipoSaco, sacosInstanciados } from './abasto.js';   // N1-ABASTECIMIENTO: acopios y sacos
import { mallaAnimal } from './animalMalla.js';   // G12: mula y buey de malla animada (TRELLIS + esqueleto); el procedural queda de respaldo

const ABAJO = { x: 0, y: -1, z: 0 };
export function sueloAnimal(M, x, z, y) {
  const h = M.fis.rayo({ x, y: y + 3, z }, ABAJO, 14, undefined, ['cajon', 'animal']);
  return h ? h.punto.y : M.fis.suelo(x, z);
}
// piezas sueltas → una malla por material
function Piezas() {
  const partes = new Map(), o = new THREE.Object3D();
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
    const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(o.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    (partes.get(m) || partes.set(m, []).get(m)).push(g);
  };
  return {
    add,
    bola: (m, rx, ry, rz, x, y, z, ax = 0) => add(new THREE.SphereGeometry(1, 14, 10), m, x, y, z, ax, 0, 0, rx, ry, rz),
    // tronco de cono entre dos puntos
    entre: (m, a, b, r0, r1, seg = 10) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
      const geo = new THREE.CylinderGeometry(r1, r0, L, seg); geo.translate(0, L / 2, 0);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); geo.translate(A.x, A.y, A.z);
      add(geo, m);
    },
    caja: (m, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => add(new THREE.BoxGeometry(sx, sy, sz), m, x, y, z, rx, ry, rz),
    fin: (sombra = true) => { const g = new THREE.Group(); for (const [m, gs] of partes) { const me = new THREE.Mesh(mergeGeometries(gs), m); me.castShadow = sombra; me.receiveShadow = true; g.add(me); } return g; },
  };
}
// textura de pelaje (manchas suaves, para que no se vea de plástico)
const TEX = {};
function pelo(base, clave) {
  return TEX[clave] ||= (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#' + base.toString(16).padStart(6, '0'); g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const t = Math.random(); g.fillStyle = t < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,240,220,0.06)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 4 + Math.random() * 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  })();
}

// ------------------------------------------------------------------ una pata: cadera (pivote) → segmento alto → rodilla (pivote) → segmento bajo + casco
function pata(tronco, x, y, z, L1, L2, r1, r2, mPelo, mCasco, delantera) {
  const cadera = new THREE.Object3D(); cadera.position.set(x, y, z); tronco.add(cadera);
  const alto = Piezas(); alto.entre(mPelo, [0, 0.04, 0], [0, -L1, 0], r1, r2 * 1.15, 9); if (!delantera) alto.bola(mPelo, r1 * 1.1, r1 * 1.25, r1 * 1.4, 0, -0.02, -0.02);
  const mA = alto.fin(false); cadera.add(mA);   // N1-ABASTECIMIENTO: patas sin sombra propia (−8 dibujos por animal en la pasada de sombras; la del tronco basta)
  const rodilla = new THREE.Object3D(); rodilla.position.y = -L1; cadera.add(rodilla);
  const bajo = Piezas(); bajo.bola(mPelo, r2 * 1.2, r2 * 1.2, r2 * 1.2, 0, 0, 0);
  bajo.entre(mPelo, [0, 0, 0], [0, -(L2 - 0.1), 0], r2, r2 * 0.75, 8);
  bajo.bola(mPelo, r2 * 0.95, r2 * 0.9, r2 * 1.05, 0, -(L2 - 0.1), 0.01);                       // menudillo
  bajo.entre(mCasco, [0, -(L2 - 0.085), 0.012], [0, -L2, 0.03], r2 * 0.95, r2 * 1.25, 10);       // casco / pezuña
  const mB = bajo.fin(false); rodilla.add(mB);
  return { cadera, rodilla, L1, L2, x, y, z, s: delantera ? 1 : -1, mallas: [mA, mB] };
}
// cinemática inversa de dos huesos en el plano yz del tronco: (ty, tz) relativos a la cadera; s = +1 rodilla adelante, -1 corvejón atrás
function ik(p, ty, tz) {
  const d = Math.min(Math.hypot(ty, tz), p.L1 + p.L2 - 1e-3), b = Math.atan2(tz, -ty);
  const a = Math.acos(Math.max(-1, Math.min(1, (p.L1 * p.L1 + d * d - p.L2 * p.L2) / (2 * p.L1 * d))));
  const f1 = b + p.s * a, kz = Math.sin(f1) * p.L1, ky = -Math.cos(f1) * p.L1;
  const f2 = Math.atan2(tz - kz, -(ty - ky));
  p.cadera.rotation.x = -f1; p.rodilla.rotation.x = -(f2 - f1);
}

// ------------------------------------------------------------------ mula y buey
// cada animal: { g (raíz en el suelo, +z al frente), tronco, cuello, cola, orejas, patas, H (altura de cadera), D (distancia de un ciclo), largo }
export function mula(op = {}) {
  const g = new THREE.Group(), tronco = new THREE.Group(), H = 0.9; tronco.position.y = 1.0; g.add(tronco);
  const mP = pelo(op.color ?? 0x5a4030, 'mula' + (op.color ?? '')), mO = mat(0x2a201a, { rough: 0.9 }), mH = mat(0x1e1814, { rough: 0.7 }), mC = mat(0xb8a080, { rough: 0.95 });
  const P = Piezas();
  P.bola(mP, 0.27, 0.3, 0.7, 0, 0, 0); P.bola(mP, 0.25, 0.29, 0.27, 0, -0.01, 0.5); P.bola(mP, 0.27, 0.28, 0.3, 0, 0.03, -0.5);
  const proc = [P.fin()]; tronco.add(proc[0]);   // G12: proc = mallas procedurales del cuerpo (se esconden si carga la malla animada)
  // cuello y cabeza (pivote en la base del cuello: pastar = bajar el cuello)
  const cuello = new THREE.Group(); cuello.position.set(0, 0.12, 0.62); tronco.add(cuello);
  const C = Piezas();
  C.entre(mP, [0, -0.02, 0], [0, 0.42, 0.34], 0.17, 0.12, 12);
  C.caja(mO, 0.035, 0.07, 0.42, 0, 0.3, 0.13, -0.88);                                    // crin corta (las mulas la llevan tusada)
  C.entre(mP, [0, 0.47, 0.36], [0, 0.18, 0.7], 0.12, 0.085, 12);                           // cabeza larga
  C.bola(mC, 0.085, 0.08, 0.1, 0, 0.17, 0.71);                                              // belfo claro
  C.bola(mP, 0.1, 0.1, 0.11, 0, 0.47, 0.37);
  for (const s of [-1, 1]) {
    C.entre(mP, [s * 0.05, 0.52, 0.34], [s * 0.14, 0.78, 0.3], 0.035, 0.012, 7);          // orejas LARGAS (mula)
    C.bola(mH, 0.018, 0.018, 0.018, s * 0.075, 0.43, 0.47);                                 // ojos
    C.entre(mO, [s * 0.09, 0.42, 0.42], [s * 0.08, 0.2, 0.64], 0.008, 0.008, 4);           // jáquima
  }
  C.add(new THREE.TorusGeometry(0.1, 0.01, 4, 14), mO, 0, 0.24, 0.62, 0.5, 0, 0);
  proc.push(C.fin()); cuello.add(proc[1]);
  // cola con borla
  const cola = new THREE.Group(); cola.position.set(0, 0.13, -0.78); tronco.add(cola);
  const T = Piezas(); T.entre(mP, [0, 0, 0], [0, -0.22, -0.08], 0.04, 0.03, 6); T.entre(mO, [0, -0.2, -0.07], [0, -0.62, -0.1], 0.05, 0.02, 7); proc.push(T.fin()); cola.add(proc[2]);
  // aparejo con pirquas (bolsas de cuero) cargadas de mineral, cincha y pechera
  if (op.carga !== false) {
    const A = Piezas(), mCu = mat(0x6a4a30, { rough: 0.85 }), mS = texMat('arpillera', 0xd2bc90), mM = mat(0x7a5634, { rough: 0.95 });   // TEX: saco de arpillera
    A.caja(mat(0x8a2a22, { rough: 1 }), 0.56, 0.05, 0.78, 0, 0.3, 0);                      // pellón (manta bajo el aparejo)
    A.caja(mM, 0.5, 0.08, 0.6, 0, 0.36, 0); for (const z of [-0.26, 0.26]) A.caja(mM, 0.06, 0.2, 0.06, 0, 0.45, z);   // aparejo con sus arcos
    for (const s of [-1, 1]) { A.bola(mCu, 0.13, 0.22, 0.3, s * 0.36, 0.2, 0); A.caja(mO, 0.02, 0.38, 0.03, s * 0.3, 0.12, -0.1, 0, 0, s * 0.2); }
    if (!op.sacoAparte) A.bola(mS, 0.28, 0.12, 0.17, 0, 0.5, 0);                          // saco atravesado arriba (N1-ABASTECIMIENTO: aparte, se descarga)
    A.add(new THREE.TorusGeometry(0.31, 0.02, 4, 18), mO, 0, 0, 0.12, 0, 0, 0, 0.95, 1.05, 1); // cincha
    A.add(new THREE.TorusGeometry(0.3, 0.022, 4, 16, Math.PI), mO, 0, 0.06, 0.62, Math.PI / 2 + 0.4, 0, Math.PI, 0.9, 1, 1);   // pechera
    tronco.add(A.fin());
  }
  let sacoM = null; if (op.sacoAparte) { sacoM = saco('v'); sacoM.scale.set(0.95, 0.65, 0.48); sacoM.position.set(0, 0.5, 0); sacoM.rotation.y = Math.PI / 2; tronco.add(sacoM); }
  const patas = [
    pata(tronco, -0.15, -0.12, 0.5, 0.5, 0.5, 0.075, 0.045, mP, mH, true), pata(tronco, 0.15, -0.12, 0.5, 0.5, 0.5, 0.075, 0.045, mP, mH, true),
    pata(tronco, -0.15, -0.08, -0.52, 0.52, 0.51, 0.1, 0.048, mP, mH, false), pata(tronco, 0.15, -0.08, -0.52, 0.52, 0.51, 0.1, 0.048, mP, mH, false),
  ];
  // orden de fase: [MI, MD, PI, PD] (M = mano/delantera, P = pata trasera) → paso lateral 0,25 / 0,75 / 0 / 0,5
  patas.forEach((p, i) => { p.fase = [0.25, 0.75, 0, 0.5][i]; });
  const an = { g, tronco, cuello, cola, patas, saco: sacoM, H, D: 1.15, deber: 0.62, alza: 0.11, alto0: 1.0, largo: 1.0, tipo: 'mula' };
  mallaAnimal(an, [...proc, ...patas.flatMap(p => p.mallas)]); return an;   // alcance de pata ≥ hipotenusa (cadera, medio paso): sin estirarse de más
}
export function buey(op = {}) {
  const g = new THREE.Group(), tronco = new THREE.Group(), H = 0.98; tronco.position.y = 1.12; g.add(tronco);
  const base = op.color ?? 0x7a4a2c, mP = pelo(base, 'buey' + base), mB = pelo(op.mancha ?? 0xe6dccb, 'bueyM' + (op.mancha ?? '')), mH = mat(0x1a1612, { rough: 0.7 }), mCu = mat(0xe2d6b8, { rough: 0.6 }), mN = mat(0x2a2220, { rough: 0.6 });
  const P = Piezas();
  P.bola(mP, 0.4, 0.43, 0.92, 0, 0, 0); P.bola(mP, 0.37, 0.45, 0.4, 0, 0.02, 0.62); P.bola(mP, 0.39, 0.4, 0.4, 0, 0.03, -0.62);
  P.bola(mP, 0.17, 0.22, 0.32, 0, 0.36, 0.55);                                              // cruz alta
  P.bola(op.mancha != null ? mB : mP, 0.12, 0.3, 0.22, 0, -0.33, 0.82);                      // papada
  if (op.mancha != null) { P.bola(mB, 0.36, 0.3, 0.42, 0.06, -0.12, -0.2); P.bola(mB, 0.3, 0.26, 0.32, -0.08, 0.05, 0.45); }   // overo: manchas claras
  const proc = [P.fin()]; tronco.add(proc[0]);   // G12: ver mula()
  const cuello = new THREE.Group(); cuello.position.set(0, 0.12, 0.9); tronco.add(cuello);
  const C = Piezas();
  C.entre(mP, [0, -0.06, -0.06], [0, 0.12, 0.3], 0.3, 0.22, 12);                           // cuello corto y grueso
  C.entre(mP, [0, 0.16, 0.28], [0, -0.12, 0.62], 0.19, 0.13, 12);                            // cabeza
  C.bola(op.mancha != null ? mB : mP, 0.17, 0.17, 0.17, 0, 0.17, 0.3);                        // testuz
  C.bola(mN, 0.12, 0.1, 0.1, 0, -0.13, 0.64);                                                // hocico oscuro
  for (const s of [-1, 1]) {
    C.entre(mCu, [s * 0.1, 0.25, 0.28], [s * 0.3, 0.32, 0.3], 0.045, 0.034, 7);              // cuernos: salen de lado…
    C.entre(mCu, [s * 0.3, 0.32, 0.3], [s * 0.37, 0.52, 0.36], 0.034, 0.012, 7);             // …y suben en curva
    C.entre(mP, [s * 0.12, 0.18, 0.27], [s * 0.3, 0.12, 0.22], 0.045, 0.02, 6);              // orejas de lado
    C.bola(mH, 0.022, 0.022, 0.022, s * 0.12, 0.13, 0.42);
    C.add(new THREE.TorusGeometry(0.06, 0.018, 4, 10), mat(0x3a2414, { rough: 0.9 }), s * 0.14, 0.28, 0.29, 0, Math.PI / 2, 0);   // coyunda en la base del cuerno
  }
  proc.push(C.fin()); cuello.add(proc[1]);
  const cola = new THREE.Group(); cola.position.set(0, 0.24, -0.98); tronco.add(cola);
  const T = Piezas(); T.entre(mP, [0, 0, 0], [0, -0.75, -0.08], 0.04, 0.025, 6); T.entre(mN, [0, -0.72, -0.08], [0, -0.95, -0.09], 0.05, 0.015, 6); proc.push(T.fin()); cola.add(proc[2]);
  const patas = [
    pata(tronco, -0.22, -0.14, 0.62, 0.54, 0.54, 0.1, 0.06, mP, mH, true), pata(tronco, 0.22, -0.14, 0.62, 0.54, 0.54, 0.1, 0.06, mP, mH, true),
    pata(tronco, -0.22, -0.1, -0.66, 0.55, 0.55, 0.14, 0.06, mP, mH, false), pata(tronco, 0.22, -0.1, -0.66, 0.55, 0.55, 0.14, 0.06, mP, mH, false),
  ];
  patas.forEach((p, i) => { p.fase = [0.25, 0.75, 0, 0.5][i]; });
  const an = { g, tronco, cuello, cola, patas, H, D: 1.05, deber: 0.66, alza: 0.09, alto0: 1.12, largo: 1.3, tipo: 'buey' };
  mallaAnimal(an, [...proc, ...patas.flatMap(p => p.mallas)], op.listo); return an;
}

// ANIM-CASCOS (16-11, Diego: cascos 10-30 cm en el aire en las laderas del N1 y mulas paradas con las patas traseras estiradas):
// las patas de la malla miden en reposo lo mismo que la altura de la cadera (extensión 0,99-1,0): con cualquier desnivel no alcanzaban
// el suelo (el IK las estiraba rectas y el casco quedaba colgando; la física y la malla visible del terreno coinciden, se midió).
// Ahora se baja el tronco lo justo para que cada pata llegue a su apoyo con holgura (manos ≤ 0,985 del largo: rectas como en una mula
// parada; patas ≤ 0,94: corvejón algo doblado hacia atrás), y la diferencia entre manos y patas se reparte con un cabeceo.
const _hp = new THREE.Vector3();
function apoyarRig(an) {
  let dM = 0, dP = 0;
  for (const p of an.patas) {
    if (!p.hueso || !p._T) continue;
    const h = p.hueso, mano = p.z > 0, Lt = (h.L1 + h.L2) * (mano ? 0.985 : 0.94);
    h.b1.getWorldPosition(_hp);
    const hz = Math.hypot(_hp.x - p._T.x, _hp.z - p._T.z), dv = _hp.y - p._T.y;
    const baja = Math.min(0.8, dv - Math.sqrt(Math.max(Lt * Lt - hz * hz, Lt * Lt * 0.09)));
    if (mano) dM = Math.max(dM, baja); else dP = Math.max(dP, baja);
  }
  if (dM <= 0.002 && dP <= 0.002) return;
  const span = Math.max(0.5, an.largo * 0.95);
  an.tronco.position.y -= (dM + dP) / 2;
  an.tronco.rotation.x -= (dP - dM) / span;   // patas más abajo que las manos: la grupa baja (rotation.x < 0 levanta el frente)
  an.tronco.updateMatrixWorld(true);
}
// ------------------------------------------------------------------ andar: patas, tronco, cola y cabeza (an = animal; ph = fase global en ciclos)
const _w = new THREE.Vector3(), _q = new THREE.Quaternion();
const _gp = new THREE.Vector3();
function moverPatas(M, an, ph, k, dt, yaw = an.g.rotation.y) {
  const g = an.g, c = Math.cos(yaw), s = Math.sin(yaw), S = an.deber * an.D, G = g.getWorldPosition(_gp);   // yaw y posición en el MUNDO (los bueyes cuelgan de la yunta)
  // tronco: cabeceo según el suelo delante y atrás (los rayos se piden a la altura de la raíz)
  const yF = sueloAnimal(M, G.x + s * an.largo * 0.55, G.z + c * an.largo * 0.55, G.y), yB = sueloAnimal(M, G.x - s * an.largo * 0.55, G.z - c * an.largo * 0.55, G.y);
  const pitch = Math.max(-0.45, Math.min(0.45, Math.atan2(yF - yB, an.largo * 1.1)));
  an.tronco.rotation.x = -pitch;
  an.tronco.position.y = an.alto0 + (yF + yB) / 2 - G.y - 0.02 + Math.abs(Math.sin(ph * Math.PI * 2)) * 0.018 * k;
  g.updateMatrixWorld(true);
  if (an.rig) an.rig.pre(dt, ph, k);   // G12: acciones, cuello y cola de la malla animada (antes de las patas)
  // Apoyo ANCLADO: al empezar el apoyo se guarda el punto del casco en el mundo y se mantiene ahí hasta despegar (aunque el cuerpo
  // gire en la curva o frene); en el vuelo el casco va del punto donde despegó al punto de aterrizaje (adelante de la cadera).
  const loc = (lz) => [G.x + s * lz, G.z + c * lz];
  for (const p of an.patas) {
    const f = (((ph + p.fase) % 1) + 1) % 1, lx = p.x, lz0 = p.z * Math.cos(pitch);
    const nom = dz => { const lz = lz0 + dz; return [G.x + c * lx + s * lz, G.z - s * lx + c * lz]; };
    let wx, wz, alz = 0;
    if (f < an.deber && k > 0.02) {
      if (!p.apoyo || !p.ancla) { p.apoyo = true; p.ancla = nom((S / 2 - (f / an.deber) * S) * k); }
      [wx, wz] = p.ancla;
      // si el ancla quedó fuera del alcance de la pata (frenazo, giro cerrado), se suelta hacia el punto nominal
      const [nx, nz] = nom((S / 2 - (f / an.deber) * S) * k);
      if (Math.hypot(wx - nx, wz - nz) > S * 0.45 + 0.05) { p.ancla = [nx, nz]; [wx, wz] = p.ancla; }
    } else if (k > 0.02) {
      const u = (f - an.deber) / (1 - an.deber), suave = 0.5 - 0.5 * Math.cos(Math.PI * u), fin = nom(S / 2 * k);
      if (p.apoyo) { p.apoyo = false; p.despegue = p.ancla || nom(-S / 2 * k); p.ancla = null; }
      const d0 = p.despegue || nom(-S / 2 * k);
      wx = d0[0] + (fin[0] - d0[0]) * suave; wz = d0[1] + (fin[1] - d0[1]) * suave; alz = an.alza * Math.sin(Math.PI * u) * Math.min(1, k / 0.3);
    } else {   // quieto: todas las patas apoyadas bajo la cadera
      p.apoyo = false; p.ancla = null; [wx, wz] = nom(0);
      if (p.hueso) { p.hueso.b1.getWorldPosition(_hp); wx = _hp.x; wz = _hp.z; }   // ANIM-CASCOS: parada, cada pata a plomo bajo su cadera (en la ladera se abrían hacia atrás y adelante)
    }
    const wy = sueloAnimal(M, wx, wz, G.y) + alz + 0.005;
    _w.set(wx, wy, wz);
    if (p.hueso) { (p._T ||= new THREE.Vector3()).copy(_w); continue; }   // G12: IK sobre los huesos de la malla (casco al suelo), después de apoyarRig
    an.tronco.worldToLocal(_w);
    ik(p, _w.y - p.y, _w.z - p.z);
  }
  if (an.rig) { apoyarRig(an); for (const p of an.patas) if (p.hueso) an.rig.ik(p, p._T); }
  // cola: vaivén suave al paso y espantando moscas de vez en cuando
  an.t = (an.t || 0) + dt;
  an.cola.rotation.z = Math.sin(an.t * 1.7 + an.g.id) * 0.12 + Math.max(0, Math.sin(an.t * 0.5 + an.g.id)) ** 12 * Math.sin(an.t * 14) * 0.5;
  an.cola.rotation.x = 0.15 + Math.sin(ph * Math.PI * 4) * 0.05 * k;
}

// ------------------------------------------------------------------ rutas: polilínea cerrada suavizada, recorrida por distancia
function ruta(pts, cerrada = true) {
  const curva = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), cerrada, 'centripetal', 0.5);
  const L = curva.getLength(), n = Math.max(40, Math.round(L / 0.5)), P = curva.getSpacedPoints(n);
  return { L, en: s => { s = ((s % L) + L) % L; const u = s / L * n, i = Math.floor(u), f = u - i, a = P[i], b = P[Math.min(n, i + 1)]; return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, dx: b.x - a.x, dz: b.z - a.z }; } };
}
const angDif = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
// N1-ABASTECIMIENTO: bucle de ida y vuelta por un camino: carril de ida a la derecha del eje (c m), vuelta en U en Q, carril de vuelta
// (a la derecha del sentido contrario) y vuelta en U en P. Devuelve los puntos, el largo del polígono y dónde termina la U de Q.
function rutaVaiven(eje, c = 1.5) {
  const cur = new THREE.CatmullRomCurve3(eje.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.max(8, Math.round(cur.getLength() / 1.5)), S = cur.getSpacedPoints(n);
  const dir = k => { const a = S[Math.max(0, k - 1)], b = S[Math.min(n, k + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
  const pts = [];
  for (let k = 0; k <= n; k++) { const [dx, dz] = dir(k); pts.push([S[k].x - dz * c, S[k].z + dx * c]); }   // derecha del avance = (-dz, dx)
  { const [dx, dz] = dir(n), Q = S[n]; for (let j = 1; j < 10; j++) { const a = j / 10 * Math.PI; pts.push([Q.x + (-dz * Math.cos(a) + dx * Math.sin(a)) * c, Q.z + (dx * Math.cos(a) + dz * Math.sin(a)) * c]); } }
  const iQ = pts.length;
  for (let k = n; k >= 0; k--) { const [dx, dz] = dir(k); pts.push([S[k].x + dz * c, S[k].z - dx * c]); }
  { const [dx, dz] = dir(0), P = S[0]; for (let j = 1; j < 10; j++) { const a = j / 10 * Math.PI; pts.push([P.x + (dz * Math.cos(a) - dx * Math.sin(a)) * c, P.z + (-dx * Math.cos(a) - dz * Math.sin(a)) * c]); } }
  let Lp = 0, sQ = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (i === iQ) sQ = Lp; Lp += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return { pts: pts.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]), Lpoli: Lp, sQ };
}
// ¿hay otro viajero (yunta/arreo) en los próximos metros de MI ruta? (puntos adelante a lo largo de la ruta, radio 1,9 m: el carril
// contrario va a 3 m y no cuenta)
function bloqueo(M, yo, R, sA, adelante) {
  for (const o of M._viajeros || []) {
    if (o === yo) continue;
    for (const ds of adelante) { const q = R.en(sA + ds); for (const [x, z] of o.cuerpo) if (Math.hypot(x - q.x, z - q.z) < 1.9) return o; }
  }
  return null;
}
// ¿Nato delante del animal (a < 2,8 m en un cono de 60° hacia donde va)?
function natoDelante(M, x, z, rumbo, r = 2.8) {
  const j = M.jug, dx = j.pos.x - x, dz = j.pos.z - z, d = Math.hypot(dx, dz);
  return d < r && Math.abs(angDif(Math.atan2(dx, dz), rumbo)) < 1.05;
}
// empujón suave a Nato desde un segmento (cuerpo largo de un animal o carreta), sin colisión física: Nato nunca queda atrapado
function empujar(M, ax, az, bx, bz, r, dt, y) {
  const j = M.jug; if (Math.abs(j.pie - y) > 2.2) return;
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, u = Math.max(0, Math.min(1, ((j.pos.x - ax) * vx + (j.pos.z - az) * vz) / l2));
  const dx = j.pos.x - (ax + vx * u), dz = j.pos.z - (az + vz * u), d = Math.hypot(dx, dz);
  if (d < r) { const k = (r - d) * 30 * dt / Math.max(d, 0.05); j.vel.x += dx * k; j.vel.z += dz * k; }
}
// visibilidad y cercanía (90 m / 50 m)
function lejos(M, g, p = g.position) { const d = Math.hypot(p.x - M.jug.pos.x, p.z - M.jug.pos.z), v = d < 90; if (g.visible !== v) g.visible = v; return d; }   // p: posición del que encabeza (arreo y yunta cuelgan de un grupo en el origen)

// carreta de bueyes chilena: dos ruedas grandes, plataforma con varillas y pértiga larga hasta el yugo. Eje en el origen, +z al frente;
// la pértiga llega a (0, 0, Lp) (punto del yugo)
function carretaBueyes(Lp, carga = 'sacos') {
  const g = new THREE.Group(), P = Piezas(), mM = mat(0x7a5634, { rough: 0.95 }), mV = mat(0x5e4128, { rough: 1 }), mF = mat(0x3b3936, { metal: 0.5, rough: 0.6 }), R = 0.8;
  for (const s of [-1, 1]) {
    const x = s * 0.92;
    P.add(new THREE.TorusGeometry(R - 0.04, 0.05, 6, 28), mF, x, 0, 0, 0, Math.PI / 2, 0);   // llanta de fierro
    P.add(new THREE.TorusGeometry(R - 0.1, 0.055, 6, 28), mM, x, 0, 0, 0, Math.PI / 2, 0);   // pina de madera
    P.add(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 12), mV, x, 0, 0, 0, 0, Math.PI / 2);   // maza
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; P.caja(mM, 0.05, R - 0.16, 0.05, x, Math.cos(a) * (R - 0.16) / 2, Math.sin(a) * (R - 0.16) / 2, a, 0, 0); }
  }
  P.add(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8), mF, 0, 0, 0, 0, 0, Math.PI / 2);   // eje
  P.caja(mM, 1.5, 0.09, 2.8, 0, 0.26, -0.25);                                                // plataforma
  for (const s of [-1, 1]) { P.caja(mV, 0.07, 0.07, 2.8, s * 0.72, 0.85, -0.25); for (let i = 0; i < 8; i++) P.caja(mV, 0.04, 0.6, 0.04, s * 0.72, 0.56, -1.55 + i * 0.37); }   // barandas de varillas
  for (const z of [-1.62, 1.12]) { P.caja(mV, 1.5, 0.07, 0.07, 0, 0.85, z); for (let i = 0; i < 5; i++) P.caja(mV, 0.04, 0.6, 0.04, -0.6 + i * 0.3, 0.56, z); }
  P.entre(mV, [0, 0.22, 1.1], [0, 0.0, Lp + 0.15], 0.07, 0.055, 8);                           // pértiga hasta el yugo
  P.entre(mV, [-0.5, 0.22, 1.12], [0, 0.18, 1.9], 0.04, 0.04, 6); P.entre(mV, [0.5, 0.22, 1.12], [0, 0.18, 1.9], 0.04, 0.04, 6);   // tijeras
  P.entre(mV, [0, 0.24, -1.6], [0, -R + 0.05, -1.95], 0.04, 0.04, 6);                         // pie de apoyo atrás
  if (carga === 'sacos') { const mS = texMat('arpillera', 0xd2bc90), mS2 = texMat('arpillera', 0xa8916c); let k = 0;   // TEX: arpillera (antes mat liso)
    for (const [x, y, z] of [[-0.38, 0.5, -0.9], [0.36, 0.5, -0.85], [-0.36, 0.5, -0.2], [0.38, 0.5, -0.15], [-0.35, 0.5, 0.5], [0.35, 0.5, 0.55], [0, 0.8, -0.55], [0, 0.8, 0.2]]) P.bola(k++ % 3 ? mS : mS2, 0.32, 0.2, 0.38, x, y, z); }
  else if (carga !== 'nada') { const mT = mat(0xb08a5a, { rough: 0.9 }); for (let i = 0; i < 6; i++) P.caja(mT, 0.24, 0.24, 4.2, -0.5 + (i % 3) * 0.5, 0.45 + Math.floor(i / 3) * 0.25, -0.5); }   // vigas de pino oregón
  g.add(P.fin()); return { g, R };
}

// ------------------------------------------------------------------ fábricas
// arreo: arriero con una o dos mulas cargadas en fila (s.ruta: polilínea cerrada; s.mulas: n; s.v: m/s)
// yunta: carretero junto a la yunta de bueyes con su carreta (s.ruta)
// animal: mula o buey suelto, quieto o pastando (s.que: 'mula'|'buey', s.giro)
export const FABRICA_ANIMALES = {
  // N1-ABASTECIMIENTO (15-11): arreo y yunta van y vienen por el camino entre dos puntas (s.eje: polilínea del eje del camino de P a Q),
  // cada sentido por su carril (a la derecha, s.carril m del eje) y dan la vuelta en U en cada punta; tras la vuelta se detienen,
  // descargan en la pila de esa punta (s.pilas.P/Q = [x, z, giro°]) y cargan lo que va de vuelta. Sin s.eje: bucle cerrado s.ruta (como antes).
  // Lejos (> 90 m) siguen avanzando sin dibujar ni lanzar rayos: la cadena no se congela si Nato no mira.
  arreo(M, L, s) {
    const V = s.eje ? rutaVaiven(s.eje, s.carril ?? 1.5) : null, R = ruta(V ? V.pts : s.ruta), v = s.v ?? 0.95, n = s.mulas ?? 1;
    const per = persona1905(M, s.quien || 'arriero');
    const mulas = []; for (let i = 0; i < n; i++) mulas.push(mula({ color: [0x5a4030, 0x3a2c22, 0x6a5040][i % 3], carga: true, sacoAparte: !!V }));
    const g = new THREE.Group(); g.add(per.g); for (const m of mulas) g.add(m.g);
    // cabestro: del bozal de la primera mula a la mano del arriero (y de una mula a la siguiente)
    const cab = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * n), 3)), new THREE.LineBasicMaterial({ color: 0x2a1d14 }));
    cab.frustumCulled = false; g.add(cab);
    let sA = s.s0 ?? 0, ph = 0, k = 0, para = 0, cuadro = 0, op = null;
    const e = L.agregar({ tipo: 'animal', vivo: true, malla: g, sala: null, x: R.en(0).x, z: R.en(0).z, animal: 'mula', t: 0 });
    e.foco = mulas[0].g; e.animales = mulas;   // (las sondas de QC miden el patinaje de los cascos)
    const colocar = (o, sp) => { const q = R.en(sp); o.position.set(q.x, sueloAnimal(M, q.x, q.z, o.position.y || M.fis.suelo(q.x, q.z)), q.z); return Math.atan2(q.dx, q.dz); };
    let rumbo = colocar(per.g, sA); per.g.rotation.y = rumbo;
    mulas.forEach((m, i) => { m.g.rotation.y = colocar(m.g, sA - 2.1 - i * 2.4); m.fase = 0; });
    // cadena (N1-ABASTECIMIENTO-b: P = andén A del andarivel, Q = campamento): paradas tras cada vuelta en U, pilas y carga de las mulas (s.carga0: 'v' víveres | 'm' mineral)
    let paradas = s.paradas, pilas = {}, tipoCarga = s.carga0 || 'v';
    const yo = { tipo: 'arreo', cuerpo: [], bloq: null }; (M._viajeros ||= []).push(yo);
    if (V) {
      const f = R.L / V.Lpoli, T = s.parada ?? 8;
      paradas = [[(V.sQ * f + 5) % R.L, T, 'Q'], [5, T, 'P']];
      if (s.s0Q != null) { sA = ((V.sQ * f + s.s0Q) % R.L + R.L) % R.L; rumbo = colocar(per.g, sA); per.g.rotation.y = rumbo; mulas.forEach((m, i) => { m.g.rotation.y = colocar(m.g, sA - 2.1 - i * 2.4); }); }   // arranca a s0Q m de la punta Q
      for (const P of ['P', 'Q']) if (s.pilas && s.pilas[P]) {
        const [x, z, gr] = s.pilas[P], pi = pila(M, x, z, gr * Math.PI / 180, 4, (a, b) => sueloAnimal(M, a, b, M.fis.suelo(a, b)));
        const entra = P === 'Q' ? 'v' : 'm', sale = entra === 'v' ? 'm' : 'v'; pi.n[sale] = 4; pi.n[entra] = 0; pi.ver(); pi.entra = entra; pi.sale = sale;
        L.agregar({ tipo: 'decor', vivo: true, malla: pi.g, sala: null }); pilas[P] = pi;
      }
      // N1-ABASTECIMIENTO-c: la pila del andén A (frente del andarivel) la mueven los capachos: cada uno que llega de B deja víveres,
      // cada uno que parte hacia B se lleva mineral (abasto.js andarivelVuelta)
      if (pilas.P) { const pp = pilas.P; M.abastoCapachoA = tipo => { if (tipo === 'llega') pp.n.v = Math.min(pp.cap, pp.n.v + 1); else pp.n.m = Math.max(0, pp.n.m - 1); pp.ver(); }; }
      for (const m of mulas) tipoSaco(m.saco, tipoCarga);
      e.rutaAbasto = V.pts;
      e.dbgAbasto = { s: () => sA, ir: x => { sA = x; para = 0; if (op) { for (const m of mulas) { tipoSaco(m.saco, op.pi.sale); m.saco.visible = true; } tipoCarga = op.pi.sale; op = null; vu.ocultar(); } }, paradas: () => paradas, L: () => R.L, op: () => op && op.t, carga: () => tipoCarga, pila: P => ({ x: pilas[P].x, z: pilas[P].z }) };   // (QC: herramientas/abasto_qc.js)
    }
    const vu = vuelo(); g.add(vu.m);
    // descarga y carga en una pila: cada mula deja su saco y recibe otro (1,5 s por saco)
    const operar = (P) => {
      const pi = pilas[P]; if (!pi) return null;
      const pasos = []; mulas.forEach((m, i) => pasos.push({ m, baja: true })); mulas.forEach((m, i) => pasos.push({ m, baja: false }));
      return { pi, pasos, t: 0, j: 0, dur: 1 + pasos.length * 1.5, pend: [] };
    };
    const avanzarOp = (dd, cerca) => {
      if (!op) return; op.t += dd;
      while (op.j < op.pasos.length && op.t >= 1 + op.j * 1.5) {
        const p = op.pasos[op.j], pi = op.pi;
        if (p.baja) { const k2 = Math.min(pi.cap - 1, pi.n[pi.entra]); p.m.saco.visible = false; if (cerca) vu.lanzar(p.m.saco.getWorldPosition(new THREE.Vector3()), pi.slot(pi.entra, k2), pi.entra); op.pend.push([op.t + 1.1, () => { pi.n[pi.entra] = Math.min(pi.cap, pi.n[pi.entra] + 1); pi.ver(); }]); }
        else { const k2 = Math.max(0, pi.n[pi.sale] - 1); if (cerca) vu.lanzar(pi.slot(pi.sale, k2), p.m.saco.getWorldPosition(new THREE.Vector3()), pi.sale); pi.n[pi.sale] = Math.max(0, pi.n[pi.sale] - 1); pi.ver(); op.pend.push([op.t + 1.1, () => { tipoSaco(p.m.saco, pi.sale); p.m.saco.visible = true; }]); }
        if (cerca && per.anim) { per.poner('idle', 0); per.poner('entregar', 0); }
        op.j++;
      }
      op.pend = op.pend.filter(([t, f]) => { if (op.t >= t) { f(); return false; } return true; });
      if (cerca) vu.actualizar(dd); else vu.ocultar();
      if (op.t >= op.dur) { for (const [, f] of op.pend) f(); tipoCarga = op.pi.sale; op = null; }
    };
    e.act = dt => {
      cuadro++;
      const lead = per.g.position, d = Math.hypot(lead.x - M.jug.pos.x, lead.z - M.jug.pos.z);
      // cuerpo en el plano (para que la yunta y el arreo no se atraviesen: el arreo siempre cede)
      yo.cuerpo.length = 0; yo.cuerpo.push([R.en(sA).x, R.en(sA).z]); mulas.forEach((m, i) => { const q = R.en(sA - 2.1 - i * 2.4); yo.cuerpo.push([q.x, q.z]); });
      const bl = V ? bloqueo(M, yo, R, sA, [1.0, 2.2, 3.4]) : null; yo.bloq = bl;
      if (d > 90) {   // lejos: solo avanza (sin rayos ni dibujo)
        if (g.visible) g.visible = false;
        if (para > 0) para -= dt; k = bl || para > 0 ? 0 : 1;
        const ds = v * k * dt; sA += ds; revisarParadas(sA - ds, sA);
        avanzarOp(dt, false); if (!op) for (const P in pilas) if (P !== 'P') pilas[P].regular(dt, pilas[P].entra, pilas[P].sale, 9);
        const q = R.en(sA); per.g.position.set(q.x, per.g.position.y, q.z); e.x = q.x; e.z = q.z; return;
      }
      if (!g.visible) { g.visible = true; colocar(per.g, sA); mulas.forEach((m, i) => { m.g.rotation.y = colocar(m.g, sA - 2.1 - i * 2.4); }); }
      const paso = d < 25 || cuadro % 2 === 0, dd = d < 25 ? dt : dt * 2; if (!paso) return;
      // avanza (o se detiene si Nato está delante del arriero o de una mula, o en una parada)
      const delante = natoDelante(M, per.g.position.x, per.g.position.z, rumbo) || mulas.some(m => natoDelante(M, m.g.position.x, m.g.position.z, m.g.rotation.y, 2.4));
      if (para > 0) para -= dd;
      const objetivo = delante || bl || para > 0 ? 0 : 1; k += (objetivo - k) * Math.min(1, dd * 2.5);
      const ds = v * k * dd; sA += ds; ph += ds / mulas[0].D;
      revisarParadas(sA - ds, sA);
      avanzarOp(dd, d < 60);
      if (!op) for (const P in pilas) if (P !== 'P') pilas[P].regular(dd, pilas[P].entra, pilas[P].sale, 9);   // N1-ABASTECIMIENTO-c: la pila del andén A la mueven los capachos
      const r0 = colocar(per.g, sA); rumbo += angDif(r0, rumbo) * Math.min(1, dd * 5);
      // en la descarga mira a la pila
      if (op) { const pi = op.pi; rumbo += angDif(Math.atan2(pi.x - per.g.position.x, pi.z - per.g.position.z), rumbo) * Math.min(1, dd * 3); }
      per.g.rotation.y = rumbo;
      if (!op || k > 0.15) per.poner(k > 0.15 ? 'caminar' : 'idle', dd, Math.max(0.3, v * k / 1.3)); else per.poner(per.anim && per.anim.nombres.includes('entregar') ? 'entregar' : 'idle', dd);
      mulas.forEach((m, i) => {
        const r1 = colocar(m.g, sA - 2.1 - i * 2.4); m.g.rotation.y += angDif(r1, m.g.rotation.y) * Math.min(1, dd * 4);
        if (d < 50) moverPatas(M, m, ph - i * 0.37, k, dd, m.g.rotation.y);
        m.cuello.rotation.x = Math.sin(ph * Math.PI * 2) * 0.04 * k + (1 - k) * Math.max(0, Math.sin(e.t * 0.4 + i)) * 0.25;   // cabeceo al paso; quieta, baja la cabeza
        empujar(M, m.g.position.x - Math.sin(m.g.rotation.y) * 0.9, m.g.position.z - Math.cos(m.g.rotation.y) * 0.9, m.g.position.x + Math.sin(m.g.rotation.y) * 1.1, m.g.position.z + Math.cos(m.g.rotation.y) * 1.1, 0.75, dd, m.g.position.y);
      });
      e.t += dd;
      empujar(M, per.g.position.x, per.g.position.z, per.g.position.x, per.g.position.z, 0.6, dd, per.g.position.y);
      // cabestro
      if (d < 40 && per.anim) {
        const a = cab.geometry.attributes.position, h = per.mano(); g.worldToLocal(h);
        mulas.forEach((m, i) => {
          const b = m.rig ? m.rig.nariz.getWorldPosition(_w) : m.cuello.localToWorld(_w.set(0, 0.22, 0.64)); g.worldToLocal(b);   // G12: bozal de la malla
          const ini = i === 0 ? h : mulas[i - 1].tronco.localToWorld(new THREE.Vector3(0, 0.3, -0.3));
          if (i > 0) g.worldToLocal(ini);
          a.setXYZ(i * 2, ini.x, ini.y, ini.z); a.setXYZ(i * 2 + 1, b.x, b.y, b.z);
        });
        a.needsUpdate = true;
      }
      if (s.texto) M.burbujaCerca(e, per.g.position, 3, `<b>${per.nombre}:</b> ${s.texto}`);
      e.x = per.g.position.x; e.z = per.g.position.z;
    };
    function revisarParadas(s0, s1) {
      if (!paradas) return;
      for (const [sp, t, P] of paradas) { const a = (s0 % R.L + R.L) % R.L, b = (s1 % R.L + R.L) % R.L; if ((a < sp && b >= sp) || (b < a && (sp > a || sp <= b))) { para = t; if (P && !op) op = operar(P); if (op) para = Math.max(para, op.dur + 0.5); } }
    }
  },
  yunta(M, L, s) {
    const V = s.eje ? rutaVaiven(s.eje, s.carril ?? 1.5) : null, R = ruta(V ? V.pts : s.ruta), v = s.v ?? 0.7, Lp = 3.7;
    const bA = buey({ color: 0x7a4a2c }), bB = buey({ color: 0x6a3a22, mancha: 0xe6dccb });
    const yun = new THREE.Group(); bA.g.position.x = -0.66; bB.g.position.x = 0.66; yun.add(bA.g, bB.g);
    // yugo atado a los cuernos (sobre la nuca de los dos) y la clavija de la pértiga
    const Y = Piezas(), mY = mat(0x6b4a2c, { rough: 0.9 }), mCo = mat(0x3a2414, { rough: 0.9 });
    const yy = bA.alto0 + 0.12 + 0.28, yz = 0.9 + 0.29;
    Y.caja(mY, 1.95, 0.13, 0.15, 0, yy, yz); for (const x of [-0.66, 0.66]) { Y.add(new THREE.TorusGeometry(0.12, 0.02, 4, 12), mCo, x - 0.13, yy - 0.02, yz, 0, Math.PI / 2, 0); Y.add(new THREE.TorusGeometry(0.12, 0.02, 4, 12), mCo, x + 0.13, yy - 0.02, yz, 0, Math.PI / 2, 0); }
    Y.caja(mCo, 0.05, 0.22, 0.05, 0, yy - 0.1, yz);
    const yugo = Y.fin(); yun.add(yugo);
    const car = carretaBueyes(Lp, V ? 'nada' : (s.carga || 'sacos')), per = persona1905(M, 'carretero');
    const g = new THREE.Group(); g.add(yun, car.g, per.g);
    let sA = s.s0 ?? 0, ph = 0, k = 0, para = 0, cuadro = 0, op = null;
    const e = L.agregar({ tipo: 'animal', vivo: true, malla: g, sala: null, x: R.en(0).x, z: R.en(0).z, animal: 'yunta', t: 0 }); e.foco = yun; e.animales = [bA, bB];
    const q0 = R.en(sA); let rumbo = Math.atan2(q0.dx, q0.dz);
    yun.position.set(q0.x, M.fis.suelo(q0.x, q0.z), q0.z); yun.rotation.y = rumbo;
    const eje = { x: q0.x - Math.sin(rumbo) * (Lp - yz), z: q0.z - Math.cos(rumbo) * (Lp - yz) };
    const ponerCarreta = () => {
      // el punto del yugo arrastra el eje de la carreta (remolque): el eje queda siempre a Lp del yugo
      const H = yun.localToWorld(_w.set(0, yy - 0.08, yz)).clone();
      let dx = H.x - eje.x, dz = H.z - eje.z; const l = Math.hypot(dx, dz) || 1; eje.x = H.x - dx / l * Lp; eje.z = H.z - dz / l * Lp;
      const r = Math.atan2(dx, dz), lx = Math.cos(r), lz = -Math.sin(r);   // (lx, lz) = izquierda del avance = +x del modelo
      const gL = sueloAnimal(M, eje.x + lx * 0.92, eje.z + lz * 0.92, H.y - 1), gR = sueloAnimal(M, eje.x - lx * 0.92, eje.z - lz * 0.92, H.y - 1);
      const ey = (gL + gR) / 2 + car.R;
      const f = new THREE.Vector3(H.x - eje.x, H.y - ey, H.z - eje.z).normalize(), izq = new THREE.Vector3(lx * 1.84, gL - gR, lz * 1.84).normalize();
      const up = new THREE.Vector3().crossVectors(f, izq).normalize(); izq.crossVectors(up, f).normalize();
      const m = new THREE.Matrix4().makeBasis(izq, up, f);
      car.g.position.set(eje.x, ey, eje.z); car.g.quaternion.setFromRotationMatrix(m);
      return { H, r };
    };
    ponerCarreta();
    // cadena: sacos de la carreta (8 lugares), pilas de la estación del tren (P) y de la estación B del andarivel (Q; la mueven los capachos)
    let paradas = s.paradas; const pilas = {}, sacos = [], vu = vuelo(); g.add(vu.m);
    const yo = { tipo: 'yunta', cuerpo: [], bloq: null }; (M._viajeros ||= []).push(yo);
    if (V) {
      const f = R.L / V.Lpoli, T = s.parada ?? 30;
      paradas = [[(V.sQ * f + 6) % R.L, T, 'Q'], [6, T, 'P']];
      const tipo0 = s.carga0 || 'm';
      const SI = sacosInstanciados([[-0.38, 0.52, -0.9], [0.36, 0.52, -0.85], [-0.36, 0.52, -0.2], [0.38, 0.52, -0.15], [-0.35, 0.52, 0.5], [0.35, 0.52, 0.55], [0, 0.82, -0.55], [0, 0.82, 0.2]], tipo0);
      car.g.add(SI.I); sacos.push(...SI.sacos);   // 8 sacos en una sola malla instanciada
      for (const P of ['P', 'Q']) if (s.pilas && s.pilas[P]) {
        const [x, z, gr] = s.pilas[P], pi = pila(M, x, z, gr * Math.PI / 180, 8, (a, b) => sueloAnimal(M, a, b, M.fis.suelo(a, b)));
        const entra = P === 'Q' ? 'v' : 'm', sale = entra === 'v' ? 'm' : 'v'; pi.n[sale] = 8; pi.n[entra] = 0; pi.ver(); pi.entra = entra; pi.sale = sale;
        L.agregar({ tipo: 'decor', vivo: true, malla: pi.g, sala: null }); pilas[P] = pi;
      }
      // la pila de la estación B del andarivel (N1-ABASTECIMIENTO-c) la mueven los capachos: cada uno que llega de A deja mineral, cada uno que sale hacia A se lleva víveres
      if (pilas.Q) { const pq = pilas.Q; M.abastoCapacho = tipo => { if (tipo === 'llega') pq.n.m = Math.min(pq.cap, pq.n.m + 1); else pq.n.v = Math.max(0, pq.n.v - 1); pq.ver(); }; }
      e.rutaAbasto = V.pts;
      e.dbgAbasto = { s: () => sA, ir: x => { sA = x; para = 0; cerca0 = false; if (op) { for (const m of sacos) { tipoSaco(m, op.pi.sale); m.visible = true; } op = null; vu.ocultar(); } }, paradas: () => paradas, L: () => R.L, op: () => op && op.t, pila: P => ({ x: pilas[P].x, z: pilas[P].z }), carga: () => nCarga() + sacos.filter(m => m.visible).map(m => m.userData.tipo).join('') };
    }
    const nCarga = () => sacos.filter(m => m.visible).length;
    // descarga (8 sacos de la carreta a la pila) y carga (8 de la pila a la carreta); el carretero va a la cola de la carreta
    const operar = (P) => {
      const pi = pilas[P]; if (!pi) return null;
      return { pi, t: 0, j: 0, pasos: 16, ini: 2.5, cada: 1.5, dur: 2.5 + 16 * 1.5 + 2.5, pend: [] };
    };
    const avanzarOp = (dd, cerca) => {
      if (!op) return; op.t += dd; const pi = op.pi;
      while (op.j < op.pasos && op.t >= op.ini + op.j * op.cada) {
        const j = op.j;
        if (j < 8) {   // baja el saco de arriba primero
          const m = sacos[7 - j]; const from = m.getWorldPosition(new THREE.Vector3()), tp = m.userData.tipo; m.visible = false;
          const k2 = Math.min(pi.cap - 1, pi.n[tp] ?? 0); if (cerca) vu.lanzar(from, pi.slot(tp, k2), tp);
          op.pend.push([op.t + 1.1, () => { pi.n[tp] = Math.min(pi.cap, (pi.n[tp] ?? 0) + 1); pi.ver(); }]);
        } else {   // sube los de la pila (primero los de abajo de la carreta)
          const m = sacos[j - 8], tp = pi.sale, k2 = Math.max(0, pi.n[tp] - 1);
          if (cerca) vu.lanzar(pi.slot(tp, k2), car.g.localToWorld(m.position.clone()), tp);
          pi.n[tp] = Math.max(0, pi.n[tp] - 1); pi.ver();
          op.pend.push([op.t + 1.1, () => { tipoSaco(m, tp); m.visible = true; }]);
        }
        if (cerca && per.anim) { per.poner('idle', 0); per.poner('entregar', 0); }
        op.j++;
      }
      op.pend = op.pend.filter(([t, f]) => { if (op.t >= t) { f(); return false; } return true; });
      if (cerca) vu.actualizar(dd); else vu.ocultar();
      if (op.t >= op.dur) { for (const [, f] of op.pend) f(); op = null; }
    };
    function revisarParadas(s0, s1) {
      if (!paradas) return;
      for (const [sp, t, P] of paradas) { const a = (s0 % R.L + R.L) % R.L, b = (s1 % R.L + R.L) % R.L; if ((a < sp && b >= sp) || (b < a && (sp > a || sp <= b))) { para = t; if (P && !op) op = operar(P); if (op) para = Math.max(para, op.dur + 0.5); } }
    }
    let cerca0 = false;
    e.act = dt => {
      cuadro++; const d = Math.hypot(yun.position.x - M.jug.pos.x, yun.position.z - M.jug.pos.z);
      // cuerpo en el plano: cabezas, yugo, eje y cola de la carreta
      yo.cuerpo.length = 0; for (const ds of [1.4, 0, -Lp, -Lp - 1.7]) { const q = R.en(sA + ds); yo.cuerpo.push([q.x, q.z]); }
      let bl = V ? bloqueo(M, yo, R, sA, [2.0, 3.4, 4.8]) : null; if (bl && bl.bloq === yo) bl = null;   // la yunta tiene la preferencia
      yo.bloq = bl;
      if (d > 90) {   // lejos: solo avanza
        if (g.visible) g.visible = false; cerca0 = false;
        if (para > 0) para -= dt; k = bl || para > 0 ? 0 : 1;
        const ds = v * k * dt; sA += ds; revisarParadas(sA - ds, sA);
        avanzarOp(dt, false); if (!op) for (const P in pilas) if (P !== 'Q') pilas[P].regular(dt, pilas[P].entra, pilas[P].sale, 8);
        const q = R.en(sA); yun.position.set(q.x, yun.position.y, q.z); e.x = q.x; e.z = q.z; return;
      }
      if (!g.visible) g.visible = true;
      if (!cerca0) {   // al volver a acercarse: yunta y carreta en su lugar de la ruta (sin arrastrar la carreta desde lejos)
        cerca0 = true; const q = R.en(sA); rumbo = Math.atan2(q.dx, q.dz); yun.rotation.y = rumbo;
        yun.position.set(q.x, sueloAnimal(M, q.x, q.z, M.fis.suelo(q.x, q.z)), q.z);
        const qe = R.en(sA - Lp + yz); eje.x = qe.x; eje.z = qe.z; ponerCarreta();
      }
      const paso = d < 25 || cuadro % 2 === 0, dd = d < 25 ? dt : dt * 2; if (!paso) return;
      const delante = natoDelante(M, yun.position.x, yun.position.z, rumbo, 3.4);
      if (para > 0) para -= dd;
      k += ((delante || bl || para > 0 ? 0 : 1) - k) * Math.min(1, dd * 2);
      const ds = v * k * dd; sA += ds; ph += ds / bA.D;
      revisarParadas(sA - ds, sA);
      avanzarOp(dd, d < 60);
      if (!op) for (const P in pilas) if (P !== 'Q') pilas[P].regular(dd, pilas[P].entra, pilas[P].sale, 8);
      const q = R.en(sA), r0 = Math.atan2(q.dx, q.dz); rumbo += angDif(r0, rumbo) * Math.min(1, dd * 3);
      yun.position.set(q.x, sueloAnimal(M, q.x, q.z, yun.position.y), q.z); yun.rotation.y = rumbo;
      if (d < 50) { moverPatas(M, bA, ph, k, dd, rumbo); moverPatas(M, bB, ph + 0.5, k, dd, rumbo); }
      bA.cuello.rotation.x = bB.cuello.rotation.x = Math.sin(ph * Math.PI * 2) * 0.02 * k;
      const { r } = ponerCarreta();
      // carretero: camina a la izquierda de la yunta, a la altura de las cabezas, con la picana; en la carga va a la cola de la carreta
      const lx = Math.cos(rumbo), lz = -Math.sin(rumbo);
      let px = yun.position.x + lx * 1.55 + Math.sin(rumbo) * 0.6, pz = yun.position.z + lz * 1.55 + Math.cos(rumbo) * 0.6, giro = rumbo, anda = k > 0.15;
      if (op) {
        const pi = op.pi, cola = car.g.localToWorld(_w.set(0, 0, -2.3)), sx = cola.x + (pi.x - cola.x) * 0.45, sz = cola.z + (pi.z - cola.z) * 0.45;
        const w = Math.min(1, op.t / 2.2, Math.max(0, (op.dur - op.t) / 2.2)), w2 = w * w * (3 - 2 * w);
        const nx = px + (sx - px) * w2, nz = pz + (sz - pz) * w2; anda = (op.t < 2.2 || op.t > op.dur - 2.2) && Math.hypot(nx - per.g.position.x, nz - per.g.position.z) > dd * 0.2;
        if (anda) giro = Math.atan2(nx - per.g.position.x, nz - per.g.position.z);
        else { const bajando = op.j <= 8, tx = bajando ? pi.x : cola.x, tz = bajando ? pi.z : cola.z; giro = Math.atan2(tx - nx, tz - nz); }
        px = nx; pz = nz;
        e.giroCarretero = (e.giroCarretero ?? giro) + angDif(giro, e.giroCarretero ?? giro) * Math.min(1, dd * 4); giro = e.giroCarretero;
      } else e.giroCarretero = null;
      per.g.position.set(px, sueloAnimal(M, px, pz, yun.position.y), pz); per.g.rotation.y = giro;
      if (op && !anda) per.poner(per.anim && per.anim.nombres.includes('entregar') ? 'entregar' : 'idle', dd);
      else per.poner(anda ? 'caminar' : 'idle', dd, op ? 0.8 : Math.max(0.3, v * k / 1.3));
      // empujones suaves: cada buey, la carreta y el carretero
      for (const b of [bA, bB]) { b.g.getWorldPosition(_w); empujar(M, _w.x - Math.sin(rumbo) * 1.1, _w.z - Math.cos(rumbo) * 1.1, _w.x + Math.sin(rumbo) * 1.5, _w.z + Math.cos(rumbo) * 1.5, 0.75, dd, _w.y); }
      empujar(M, car.g.position.x - Math.sin(r) * 1.7, car.g.position.z - Math.cos(r) * 1.7, car.g.position.x + Math.sin(r) * 1.2, car.g.position.z + Math.cos(r) * 1.2, 1.25, dd, car.g.position.y - car.R);
      empujar(M, px, pz, px, pz, 0.6, dd, per.g.position.y);
      e.t += dd;
      if (s.texto) M.burbujaCerca(e, per.g.position, 3, `<b>${per.nombre}:</b> ${s.texto}`);
      e.x = yun.position.x; e.z = yun.position.z;
    };
  },
  animal(M, L, s) {   // mula o buey quieto / pastando (cabeza, cola y orejas)
    const an = s.que === 'buey' ? buey({ color: s.color ?? 0x7a4a2c, mancha: s.mancha }) : mula({ color: s.color, carga: !!s.carga });
    const g = an.g; g.position.set(s.x, M.fis.suelo(s.x, s.z), s.z); g.rotation.y = (s.giro || 0) * Math.PI / 180;
    g.position.y = sueloAnimal(M, s.x, s.z, g.position.y);
    const e = L.agregar({ tipo: 'animal', vivo: true, malla: g, sala: null, x: s.x, z: s.z, animal: s.que, t: Math.random() * 10 }); e.foco = g;
    let cuadro = 0, listo = false;
    e.act = dt => {
      cuadro++; const d = lejos(M, g); if (d > 90) return;
      if (!listo || (d < 50 && cuadro % (d < 25 ? 1 : 3) === 0)) { moverPatas(M, an, 0, 0, dt * (d < 25 ? 1 : 3)); listo = true; }
      e.t += dt;
      // pasta: baja la cabeza un rato, la sube a mirar (y mira a Nato si se acerca)
      const pastar = s.pastar !== false && Math.sin(e.t * 0.22 + s.x) > -0.2 && d > 4;
      const obj = pastar ? (s.que === 'buey' ? 0.75 : 1.05) : -0.05; an.cuello.rotation.x += (obj - an.cuello.rotation.x) * Math.min(1, dt * 1.2);
      an.cuello.rotation.y = pastar ? Math.sin(e.t * 0.6) * 0.08 : Math.max(-0.5, Math.min(0.5, angDif(Math.atan2(M.jug.pos.x - g.position.x, M.jug.pos.z - g.position.z), g.rotation.y))) * (d < 8 ? 1 : 0);
      const y = g.rotation.y, cx = Math.sin(y), cz = Math.cos(y), l = an.largo;
      empujar(M, g.position.x - cx * l, g.position.z - cz * l, g.position.x + cx * l * 1.2, g.position.z + cz * l * 1.2, s.que === 'buey' ? 0.8 : 0.6, dt, g.position.y);
    };
  },
};
