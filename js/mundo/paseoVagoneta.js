// N1-FORTUNA-PASEO (carril mina, 15-11-2026, pedido de Diego): palanca junto a la vía de Fortuna 5; al activarla Nato sube a una
// vagoneta y da un paseo de montaña rusa por el interior de la mina (subidas lentas con cadena, bajadas fuertes, curvas peraltadas,
// caverna con vetas de mineral que brillan, puente de caballetes sobre un pique, galería con mineros trabajando) y vuelve al MISMO
// punto: frena suave, Nato se baja junto a la palanca y el control vuelve al jugador. Se repite cuantas veces se quiera.
// Esc o E mantenida: saltar el paseo. V: primera persona.
// - El trazado y el movimiento (física precalculada, determinista) están en paseoVia.js.
// - La montaña rusa está FUERA de la caja negra de la sala (detrás del muro del fondo, al costado derecho y bajo Fortuna 4): no se ve
//   desde la galería. Mientras se viaja se ocultan la caja negra y las tapas negras del fondo de los dos túneles de la vía.
// - Luz horneada en colores de vértice (MeshBasic: cero luces dinámicas) + oscurecido por distancia propio (no toca la niebla de la
//   escena, así no se recompilan los materiales). Un farol con PointLight en la vagoneta alumbra a Nato y a los mineros.
// - Ganchos en principal.js: paseoPaso (paso de física: palanca y E mantenida), paseoCuadro (cada cuadro), paseoCamara, paseoSaltar (Esc).
import * as THREE from 'three';
import { armarVia, enTiempo, marcoEn } from './paseoVia.js';
import { texRoca, texBarro, texMaderaMina, matMadera, fbm, ruido3 } from './mina.js';
import { mat } from './construir.js';
import { texMat, uvPieza } from './texFaena.js';   // TEX (16-11): durmientes de la estación con textura
import { AUDIO } from '../motor/audio.js';
import { E } from '../motor/entrada.js';
import { UI } from '../ui/hud.js';
import { vehiculoSplat } from '../juego/entidades.js';
import { mallaPersona } from '../juego/jugador.js';
import { escalaPersona } from '../datos/alturas.js';
import { armarMineros, animarMineros } from './paseoMineros.js';   // N1-PASEO-MINEROS
import { precargarUtileria, piezaGrupo } from './utileria.js';   // Q1: cabina_ascensor de malla en la jaula del pique

const SALA = 'fortuna';
const PALANCA = { x: 4.3, z: -72.7 };   // local de la sala (y = -8), junto al desvío (x 2,6)
const BAJADA = { x: 3.85, z: -70.9 };    // donde queda Nato al bajarse
const T_SENTADO = 0.4;                   // «levantarse» congelado en este instante = sentado en el piso de la vagoneta (como en el tren X-K10)
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const suave = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// ---------------------------------------------------------------- materiales propios: color de vértice/instancia × textura, oscurecidos por distancia
const NIEBLA = { value: new THREE.Vector2(16, 78) }, TIEMPO = { value: 0 };
function matBase(op = {}) {
  const m = new THREE.MeshBasicMaterial(op);
  m.onBeforeCompile = sh => {
    sh.uniforms.uNiebla = NIEBLA;
    sh.vertexShader = 'varying float vPDist;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvPDist = -mvPosition.z;');
    sh.fragmentShader = 'uniform vec2 uNiebla;\nvarying float vPDist;\n' + sh.fragmentShader.replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.rgb *= 1.0 - smoothstep(uNiebla.x, uNiebla.y, vPDist);');
  };
  m.customProgramCacheKey = () => 'paseoOscuro';
  return m;
}
// puntos que brillan (llamas, halos, destellos de las vetas, chispas): aditivos, titilan, se apagan junto a la cámara y a lo lejos
function matPuntos(titila = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { t: TIEMPO, escala: { value: 400 }, uNiebla: NIEBLA, titila: { value: titila } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float tam; attribute vec3 col; attribute float fase; uniform float t, escala, titila; uniform vec2 uNiebla; varying vec3 vC;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        float k = 1.0 + titila * (0.16 * sin(t * 13.0 + fase) + 0.09 * sin(t * 29.0 + fase * 2.3)) + (1.0 - titila) * 0.0;
        float tw = titila < 0.5 ? max(0.0, sin(t * (1.5 + fract(fase) * 2.0) + fase * 7.0)) : 1.0;
        vC = col * k * tw * smoothstep(0.7, 2.2, d) * (1.0 - smoothstep(uNiebla.x, uNiebla.y * 1.1, d));
        gl_PointSize = clamp(tam * k * escala / max(d, 0.1), 0.0, 220.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main() { vec2 c = gl_PointCoord - 0.5; float r2 = dot(c, c) * 4.0; float a = exp(-r2 * 3.5) - 0.03; if (a <= 0.0) discard; gl_FragColor = vec4(vC * a, 1.0); }`,
  });
}
function puntos(lista, titila = 1) {   // lista: [{ p, tam, col: [r,g,b], fase }]
  const n = lista.length, P = new Float32Array(n * 3), T = new Float32Array(n), C = new Float32Array(n * 3), F = new Float32Array(n);
  lista.forEach((q, i) => { P.set([q.p.x, q.p.y, q.p.z], i * 3); T[i] = q.tam; C.set(q.col, i * 3); F[i] = q.fase ?? i * 1.7; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('tam', new THREE.BufferAttribute(T, 1)); g.setAttribute('col', new THREE.BufferAttribute(C, 3)); g.setAttribute('fase', new THREE.BufferAttribute(F, 1));
  const m = new THREE.Points(g, matPuntos(titila)); m.frustumCulled = false; return m;
}

// ---------------------------------------------------------------- luz horneada: lámparas → color por vértice
class Luces {
  constructor() { this.l = []; this.celda = 12; this.grid = new Map(); }
  agregar(p, k, col = [1, 0.7, 0.42], r0 = 1.6, R = 18) { this.l.push({ p: p.clone(), k, col, r0, R }); }
  indexar() { for (const q of this.l) { const c = this.celda, x0 = Math.floor((q.p.x - q.R) / c), x1 = Math.floor((q.p.x + q.R) / c), y0 = Math.floor((q.p.y - q.R) / c), y1 = Math.floor((q.p.y + q.R) / c), z0 = Math.floor((q.p.z - q.R) / c), z1 = Math.floor((q.p.z + q.R) / c);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const k = x + ',' + y + ',' + z; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(q); } } }
  en(px, py, pz, nx, ny, nz, amb = 0.03, out = [0, 0, 0]) {
    out[0] = amb * 1.0; out[1] = amb * 0.9; out[2] = amb * 0.82;
    const lista = this.grid.get(Math.floor(px / this.celda) + ',' + Math.floor(py / this.celda) + ',' + Math.floor(pz / this.celda)); if (!lista) return out;
    for (const q of lista) {
      const dx = q.p.x - px, dy = q.p.y - py, dz = q.p.z - pz, d2 = dx * dx + dy * dy + dz * dz; if (d2 > q.R * q.R) continue;
      const d = Math.sqrt(d2) || 1e-3, lam = Math.max(0, (dx * nx + dy * ny + dz * nz) / d);
      const f = q.k / (1 + d2 / (q.r0 * q.r0)) * (1 - suave((d - q.R * 0.55) / (q.R * 0.45))) * (0.22 + 0.78 * lam);
      out[0] += q.col[0] * f; out[1] += q.col[1] * f; out[2] += q.col[2] * f;
    }
    return out;
  }
}
const CALIDA = [1, 0.7, 0.42], TURQUESA = [0.25, 1, 0.82], DORADA = [1, 0.78, 0.3];

// ---------------------------------------------------------------- construcción (la primera vez que Nato entra a la mina)
function construir(M) {
  const sala = M.R.salas[SALA], O = sala.origen, g = sala.grupo, V = armarVia();
  const grp = new THREE.Group(); grp.name = 'paseoVagoneta'; g.add(grp);
  const W = (x, y, z) => V3(O.x + x, y, O.z + z);   // local → mundo
  const fr = { p: V3(), t: V3(), r: V3(), u: V3() };
  const kDe = s => Math.max(0, Math.min(V.M - 1, Math.round(s / V.DS)));
  const pW = k => W(V.pos[k * 3], V.pos[k * 3 + 1], V.pos[k * 3 + 2]);
  const tK = k => V3(V.tan[k * 3], V.tan[k * 3 + 1], V.tan[k * 3 + 2]);
  const rK = k => V3(V.der[k * 3], V.der[k * 3 + 1], V.der[k * 3 + 2]), uK = k => V3(V.arr[k * 3], V.arr[k * 3 + 1], V.arr[k * 3 + 2]);
  const Y = V3(0, 1, 0);
  const planoK = k => { const t = tK(k), r = t.clone().cross(Y); if (r.lengthSq() < 1e-6) r.set(1, 0, 0); r.normalize(); return { t, r, u: r.clone().cross(t).normalize() }; };   // sin peralte (túnel derecho)
  const zl = k => V.pos[k * 3 + 2], xl = k => V.pos[k * 3];
  // tramos: túnel propio (detrás del muro del fondo hasta el fondo del túnel bajo Fortuna 4), rieles propios y rieles del desvío (en la sala)
  let kT0 = V.kIni; while (zl(kT0) > -89.5) kT0++;   // el túnel propio entra 4 m DENTRO del túnel de la sala, más angosto (sin rendija entre los dos)
  let kU = Math.round(V.M * 0.6); while (zl(kU) < 0) kU++;   // ya en la vuelta en U (z > 0)
  let kT1 = kU; while (zl(kT1) > -30.5) kT1++;
  let kR0 = V.kIni; while (zl(kR0) > -93.0) kR0++;
  let kR1 = kU; while (zl(kR1) > -27.0) kR1++;
  let kS0 = V.kIni; while (xl(kS0) > 0.03) kS0++;                 // desvío de salida: del punto de partida a la vía principal
  let kS1 = kR1; while (!(xl(kS1) > 0.03 && zl(kS1) < -55)) kS1++;  // desvío de llegada: de la vía principal al punto de llegada (y un poco más)
  const kS2 = Math.min(V.M - 1, V.kFin + 12);
  let kO0 = V.kIni; while (zl(kO0) > -104) kO0++;                 // la galería se oculta mientras la vagoneta va lejos (menos que dibujar)
  let kO1 = kU; while (!(xl(kO1) < 0.5 && zl(kO1) < -6.5)) kO1++;   // la cámara (3,7 m atrás) ya pasó el muro de la entrada (z 0)

  // ---- lámparas (se hornean en el túnel y se dibujan como llamas)
  const luces = new Luces(), llamas = [], cajasLamp = [], faroles = [];
  // dentro de los túneles de la sala (z -93,5 → -80 y -40 → -26,5) el túnel propio se angosta para quedar por dentro del de la sala
  const enSala = k => { const z = zl(k); return k < kU ? suave((z + 92.4) / 1.6) : suave((-27.6 - z) / 1.6); };
  const perf = k => { const a = { hwI: V.perfil.hwI[k], hwD: V.perfil.hwD[k], yw: V.perfil.yw[k], yr: V.perfil.yr[k], fondo: V.perfil.fondo[k] }, e = Math.abs(xl(k)) < 0.3 ? enSala(k) : 0;
    if (e > 0) { a.hwI += (1.42 - a.hwI) * e; a.hwD += (1.42 - a.hwD) * e; a.yw += (1.95 - a.yw) * e; a.yr += (2.8 - a.yr) * e; } return a; };
  const enPlano = (k, a, b) => { const { r, u } = planoK(k); return pW(k).addScaledVector(r, a).addScaledVector(u, b); };
  let lado = 1, ultimo = -99;
  for (let k = kT0 + 12; k < kT1 - 8; k++) {
    const s = k * V.DS, z = V.zonaK[k], pf = perf(k), paso = z === 'galeria' ? 3.6 : z === 'tunel' ? 7.5 : 7;
    if (s - ultimo < paso) continue;
    ultimo = s; lado = -lado;
    if (z === 'tunel' && pf.hwI < 3 && pf.fondo < 0.8) {   // vela en palmatoria clavada en el muro (1905: sin carburo)
      const a = lado > 0 ? pf.hwD - 0.32 : -(pf.hwI - 0.32), p = enPlano(k, a, 1.85);
      luces.agregar(p.clone().addScaledVector(planoK(k).r, -Math.sign(a) * 0.25), 1.35);
      llamas.push({ p: p.clone().add(V3(0, 0.12, 0)), tam: 0.09, col: [1.2, 0.95, 0.6] }, { p: p.clone().add(V3(0, 0.12, 0)), tam: 0.9, col: [0.5, 0.26, 0.08] });
      cajasLamp.push({ p, r: planoK(k).r.multiplyScalar(-Math.sign(a)) });
    } else if (z === 'galeria' || (pf.hwI < 4 && pf.fondo < 0.8)) {   // farol colgado del sombrero del marco
      const a = lado * 1.3, p = enPlano(k, a, pf.yw - 0.45);
      luces.agregar(p, 1.15); faroles.push(p);
      llamas.push({ p, tam: 0.07, col: [1.1, 0.85, 0.5] }, { p, tam: 1.0, col: [0.45, 0.24, 0.07] });
    } else {   // caverna y pique: farol en un poste del caballete
      const a = lado * 1.05, p = enPlano(k, a, 1.25);
      luces.agregar(p, 1.4, CALIDA, 1.9, 22); faroles.push(p);
      llamas.push({ p, tam: 0.08, col: [1.1, 0.85, 0.5] }, { p, tam: 1.3, col: [0.5, 0.27, 0.08] });
    }
  }
  // caverna: lámparas de faena en el piso; pique: resplandor al fondo; vetas (más abajo) agregan su luz de color
  const sCueva = V.zonas.find(q => q.z === 'cueva').s, sPique = V.zonas.find(q => q.z === 'pique').s, sGal = V.zonas.find(q => q.z === 'galeria').s;
  for (const [ds, a] of [[8, -7], [20, -9], [33, -6], [44, 4], [26, 6]]) { const k = kDe(sCueva + ds), pf = perf(k), p = enPlano(k, a, -pf.fondo + 1.6); luces.agregar(p, 4.2, CALIDA, 3.2, 26); llamas.push({ p, tam: 0.12, col: [1.2, 0.9, 0.55] }, { p, tam: 2.2, col: [0.55, 0.3, 0.1] }); }
  { const k = kDe(sPique + 10), pf = perf(k); const p = enPlano(k, 1.5, -pf.fondo + 1.2); luces.agregar(p, 7, [1, 0.55, 0.25], 4, 30); llamas.push({ p, tam: 3.2, col: [0.7, 0.32, 0.1] }); }
  const NF = 8, NWL = 8, NA = 16, NP = (NF + 1) + NWL + (NA - 1) + NWL;
  // perímetro del anillo (en el plano normal a la vía, sin peralte): a = lateral (+derecha), b = alto; con la normal hacia afuera
  const perimetro = pf => {
    const P = [], cx = (pf.hwD - pf.hwI) / 2, hm = (pf.hwI + pf.hwD) / 2, fo = pf.fondo, alto = pf.yr - pf.yw;
    for (let i = 0; i <= NF; i++) P.push([-pf.hwI + (pf.hwI + pf.hwD) * i / NF, -fo, 0, -1, 'piso']);
    for (let j = 1; j <= NWL; j++) P.push([pf.hwD, -fo + (pf.yw + fo) * j / NWL, 1, 0, 'muro']);
    for (let m = 1; m < NA; m++) { const th = Math.PI * m / NA, c = Math.cos(th), s = Math.sin(th), n = [c / hm, s / alto], l = Math.hypot(...n); P.push([cx + hm * c, pf.yw + alto * s, n[0] / l, n[1] / l, 'clave']); }
    for (let j = 0; j < NWL; j++) P.push([-pf.hwI, pf.yw - (pf.yw + fo) * j / NWL, -1, 0, 'muro']);
    return P;
  };
  // ---- el túnel: anillos cada 0,5 m con desplazamiento por ruido; piso de barro (grupo 1). UV: u = arco del anillo, v = distancia
  // = s más el exceso de distancia REAL de cada línea del perímetro, que se va olvidando (en las transiciones caverna ↔ túnel la roca
  // no queda estirada, y en las curvas el lado de afuera no arrastra un desfase para siempre)
  const tubo = { pos: [], uv: [], idxR: [], idxP: [], centros: [], kAn: [], nR: 0 };
  {
    const { pos, uv, centros } = tubo, vAc = new Float64Array(NP);
    for (let k = kT0; k <= kT1; k += 2) {
      const pf = perf(k), { r, u } = planoK(k), p = pW(k), P = perimetro(pf);
      const tam = (pf.hwI + pf.hwD) / 2, amp = 0.8 + Math.max(0, tam - 2) * 0.32, grande = tam > 3.2;
      centros.push(p.clone().addScaledVector(r, (pf.hwD - pf.hwI) / 2).addScaledVector(u, (pf.yw - pf.fondo) / 2)); tubo.kAn.push(k);
      let arcoAc = 0;
      P.forEach(([a, b, na, nb, tipo], i) => {
        if (i) arcoAc += Math.hypot(a - P[i - 1][0], b - P[i - 1][1]);
        const w = p.clone().addScaledVector(r, a).addScaledVector(u, b);
        let d = (fbm(w.x * 0.27 + 3.1, w.y * 0.27, w.z * 0.27, 3) - 0.5) * amp * 2 + (ruido3(w.x * 1.2, w.y * 1.2, w.z * 1.2 + 5) - 0.5) * 0.25;
        if (tipo === 'piso') d = Math.abs(a) < 1.4 + (grande ? 0.4 : 0) ? Math.max(0, d) * 0.25 : d * (grande ? 1 : 0.4);
        if (!grande) d = Math.max(d, tipo === 'clave' ? -0.18 : -0.22);   // en los túneles la roca no se mete en el gálibo de la vagoneta ni de la cámara
        w.addScaledVector(r.clone().multiplyScalar(na).addScaledVector(u, nb), d);
        if (tubo.nR) { const q = (tubo.nR - 1) * NP + i; vAc[i] = (vAc[i] + Math.hypot(w.x - pos[q * 3], w.y - pos[q * 3 + 1], w.z - pos[q * 3 + 2]) - 2 * V.DS) * 0.93; }
        pos.push(w.x, w.y, w.z); uv.push(arcoAc / 3.2, (k * V.DS + vAc[i]) / 3.2);
      });
      tubo.nR++;
    }
    for (let i = 0; i < tubo.nR - 1; i++) for (let j = 0; j < NP; j++) {
      const j2 = (j + 1) % NP, a = i * NP + j, b = (i + 1) * NP + j, c = i * NP + j2, d = (i + 1) * NP + j2;
      (j < NF ? tubo.idxP : tubo.idxR).push(a, b, c, c, b, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex([...tubo.idxR, ...tubo.idxP]); geo.addGroup(0, tubo.idxR.length, 0); geo.addGroup(tubo.idxR.length, tubo.idxP.length, 1);
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;   // hacia adentro del túnel
    for (let v = 0; v < pos.length / 3; v++) { const c = centros[Math.floor(v / NP)]; if (nor.getX(v) * (c.x - pos[v * 3]) + nor.getY(v) * (c.y - pos[v * 3 + 1]) + nor.getZ(v) * (c.z - pos[v * 3 + 2]) < 0) nor.setXYZ(v, -nor.getX(v), -nor.getY(v), -nor.getZ(v)); }
    tubo.geo = geo; tubo.nor = nor;
  }
  // ---- vetas de mineral que brillan (cobre: turquesa y dorado): cintas finas que serpentean SOBRE la roca de la caverna y del pique
  // (siguen los vértices del túnel, 4 cm hacia adentro) con destellos; cada veta tiñe la roca de alrededor (luz horneada)
  const vetas = [];
  {
    let sem = 7; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
    const anillos = []; tubo.kAn.forEach((k, i) => { const z = V.zonaK[k]; if ((z === 'cueva' || z === 'pique') && perf(k).hwI > 5.5) anillos.push(i); });
    const P3 = (i, j) => { const q = i * NP + j; return V3(tubo.pos[q * 3], tubo.pos[q * 3 + 1], tubo.pos[q * 3 + 2]).addScaledVector(V3(tubo.nor.getX(q), tubo.nor.getY(q), tubo.nor.getZ(q)), 0.045); };
    for (let n = 0; n < 44 && anillos.length; n++) {
      let i = anillos[Math.floor(az() * anillos.length)], j = NF + 2 + Math.floor(az() * (NP - NF - 4));   // muros y clave (no el piso)
      const col = az() < 0.55 ? TURQUESA : DORADA, di = az() < 0.5 ? 1 : -1, pts = [], ns = [];
      for (let paso = 0; paso < 4 + Math.floor(az() * 4); paso++) {
        pts.push(P3(i, j)); { const q = i * NP + j; ns.push(V3(tubo.nor.getX(q), tubo.nor.getY(q), tubo.nor.getZ(q))); }
        i = Math.max(0, Math.min(tubo.nR - 1, i + di * (1 + Math.floor(az() * 2)))); j = Math.max(NF + 1, Math.min(NP - 1, j + Math.floor(az() * 3) - 1));
      }
      const q0 = pts[Math.floor(pts.length / 2)]; vetas.push({ pts, ns, col, ancho: 0.06 + az() * 0.1, fase: az() * 6.28 });
      luces.agregar(q0, 0.9, col, 2.2, 12);
    }
  }
  luces.indexar();
  // ---- luz horneada del túnel
  {
    const { pos } = tubo, nor = tubo.nor, col = [], o = [0, 0, 0];
    for (let v = 0; v < pos.length / 3; v++) {
      const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2], z = V.zonaK[tubo.kAn[Math.floor(v / NP)]];
      luces.en(px, py, pz, nor.getX(v), nor.getY(v), nor.getZ(v), z === 'cueva' ? 0.05 : z === 'pique' ? 0.04 : 0.025, o);
      const mot = 0.72 + 0.56 * fbm(px * 0.6, py * 0.6, pz * 0.6 + 9, 2);
      col.push(o[0] * mot, o[1] * mot, o[2] * mot);
    }
    tubo.geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const [mapR] = texRoca(), [mapB] = texBarro();
    const m = new THREE.Mesh(tubo.geo, [matBase({ map: mapR, vertexColors: true, side: THREE.DoubleSide }), matBase({ map: mapB, vertexColors: true, side: THREE.DoubleSide })]);
    m.frustumCulled = false; m.name = 'paseoTunel'; grp.add(m);
  }

  // ---- rieles y durmientes: los del paseo (horneados) y los del desvío en la sala (con los materiales de la sala)
  const rielesDe = (tramos, matR, hornear) => {
    const pos = [], col = [], idx = [], o = [0, 0, 0];
    const sec = [[-0.035, 0.04], [0.035, 0.04], [0.035, 0.16], [-0.035, 0.16]];
    for (const [k0, k1] of tramos) for (const ld of [-0.5, 0.5]) {
      const v0 = pos.length / 3;
      for (let k = k0; k <= k1; k++) {
        const p = pW(k), r = rK(k), u = uK(k);
        for (const [a, b] of sec) { const w = p.clone().addScaledVector(r, ld + a).addScaledVector(u, b); pos.push(w.x, w.y, w.z); if (hornear) { luces.en(w.x, w.y, w.z, u.x, u.y, u.z, 0.03, o); col.push(o[0] * 0.55 + 0.02, o[1] * 0.55 + 0.02, o[2] * 0.55 + 0.02); } }
      }
      for (let i = 0; i < k1 - k0; i++) for (let j = 0; j < 4; j++) { const a = v0 + i * 4 + j, b = v0 + (i + 1) * 4 + j, c = v0 + i * 4 + (j + 1) % 4, d = v0 + (i + 1) * 4 + (j + 1) % 4; idx.push(a, c, b, c, d, b); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (hornear) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, matR); m.frustumCulled = false; grp.add(m); return m;
  };
  rielesDe([[kR0, kR1]], matBase({ vertexColors: true, color: 0xb8b8c0 }), true);
  rielesDe([[V.kIni - 2, kS0 + 4], [kS1 - 4, kS2]], mat(0x555555, { metal: 0.3, rough: 0.5 }), false);
  const durmientes = (tramos, matD, hornear, paso = 0.8) => {
    const lista = [];
    for (const [k0, k1] of tramos) for (let k = k0; k <= k1; k += Math.round(paso / V.DS)) {
      const pf = perf(k), puente = pf.fondo > 0.8;
      lista.push({ k, ancho: puente ? (V.zonaK[k] === 'pique' ? 2.9 : 2.0) : 1.6 });
    }
    const im = new THREE.InstancedMesh(uvPieza(new THREE.BoxGeometry(1, 0.1, 0.2), matD, 1.6), matD, lista.length), M4 = new THREE.Matrix4(), o = [0, 0, 0], C = new THREE.Color();
    lista.forEach(({ k, ancho }, i) => {
      const p = pW(k).addScaledVector(uK(k), 0.03), r = rK(k), u = uK(k), t = r.clone().cross(u);
      M4.makeBasis(r.clone().multiplyScalar(ancho), u, t); M4.setPosition(p); im.setMatrixAt(i, M4);
      if (hornear) { luces.en(p.x, p.y + 0.1, p.z, u.x, u.y, u.z, 0.03, o); im.setColorAt(i, C.setRGB(o[0], o[1], o[2])); }
    });
    im.frustumCulled = false; grp.add(im); return lista;
  };
  const [, , mapM] = [null, null, texMaderaMina()[0]];
  durmientes([[kR0, kR1]], matBase({ map: mapM }), true);
  durmientes([[V.kIni - 2, kS0 + 4], [kS1 - 4, kS2]], texMat('durmiente', 0xb8a08a), false);   // TEX: madera gastada (antes mat liso)

  // ---- caballetes (caverna y pique): bents verticales hasta el piso, cruces, cabezal y largueros; baranda en el puente del pique
  {
    const piezas = [], o = [0, 0, 0];   // [centro, eje y (vector), ancho x, ancho z, giro r]
    const viga = (a, b, gx, gz, r) => { const d = b.clone().sub(a), L = d.length(); piezas.push({ c: a.clone().addScaledVector(d, 0.5), y: d.normalize(), L, gx, gz, r }); };
    let ult = -99;
    for (let k = kR0; k <= kR1; k++) {
      const pf = perf(k), s = k * V.DS; if (pf.fondo < 0.9 || s - ult < 2.4) continue; ult = s;
      const p = pW(k), r = planoK(k).r, piso = p.y - pf.fondo - 0.4, top = p.y - 0.14;
      for (const a of [-0.85, 0.85]) { const q = p.clone().addScaledVector(r, a); viga(V3(q.x, piso, q.z), V3(q.x, top, q.z), 0.2, 0.2, r); }
      viga(p.clone().addScaledVector(r, -1.05).setY(top - 0.12), p.clone().addScaledVector(r, 1.05).setY(top - 0.12), 0.24, 0.22, null);   // cabezal (eje = r)
      for (let y = top - 0.6; y > piso + 1.5; y -= 3.6) {   // cruces de San Andrés
        const y2 = Math.max(piso + 0.5, y - 3.4), A = p.clone().addScaledVector(r, -0.85), B = p.clone().addScaledVector(r, 0.85);
        viga(V3(A.x, y, A.z), V3(B.x, y2, B.z), 0.1, 0.14, r); viga(V3(B.x, y, B.z), V3(A.x, y2, A.z), 0.1, 0.14, r);
      }
      if (V.zonaK[k] === 'pique') for (const a of [-1.38, 1.38]) { const q = p.clone().addScaledVector(r, a); viga(V3(q.x, p.y + 0.02, q.z), V3(q.x, p.y + 1.05, q.z), 0.09, 0.09, r); }   // pies de la baranda
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matBase({ map: texMaderaMina()[0] }), piezas.length), M4 = new THREE.Matrix4(), C = new THREE.Color();
    piezas.forEach((q, i) => {
      const y = q.y, x = (q.r && Math.abs(y.dot(q.r)) < 0.9 ? q.r.clone() : V3(0, 0, 1).cross(y)).normalize(), z = x.clone().cross(y).normalize(); x.copy(y.clone().cross(z)).normalize();
      M4.makeBasis(x.multiplyScalar(q.gx), y.clone().multiplyScalar(q.L), z.multiplyScalar(q.gz)); M4.setPosition(q.c); im.setMatrixAt(i, M4);
      luces.en(q.c.x, q.c.y, q.c.z, 0, 0.3, 0, 0.035, o); im.setColorAt(i, C.setRGB(o[0] * 0.9, o[1] * 0.9, o[2] * 0.9));
    });
    im.frustumCulled = false; grp.add(im);
    // largueros bajo los durmientes y pasamanos del puente: como los rieles, a lo largo de la vía
    const tramosP = []; let k0 = null;
    for (let k = kR0; k <= kR1; k++) { const hay = perf(k).fondo > 0.9; if (hay && k0 === null) k0 = k; if (!hay && k0 !== null) { tramosP.push([k0, k - 1]); k0 = null; } }
    const pos = [], col = [], idx = [];
    const banda = (k0, k1, a, b, w, h, enPique) => {
      const v0 = pos.length / 3, sec = [[-w, -h], [w, -h], [w, h], [-w, h]];
      for (let k = k0; k <= k1; k++) { const p = pW(k), { r, u } = planoK(k); for (const [da, db] of sec) { const q = p.clone().addScaledVector(r, a + da).addScaledVector(u, b + db); pos.push(q.x, q.y, q.z); luces.en(q.x, q.y, q.z, 0, 1, 0, 0.035, o); col.push(o[0] * 0.8, o[1] * 0.8, o[2] * 0.8); } }
      for (let i = 0; i < k1 - k0; i++) for (let j = 0; j < 4; j++) { const A = v0 + i * 4 + j, B = v0 + (i + 1) * 4 + j, Cc = v0 + i * 4 + (j + 1) % 4, D = v0 + (i + 1) * 4 + (j + 1) % 4; idx.push(A, Cc, B, Cc, D, B); }
      void enPique;
    };
    for (const [a0, a1] of tramosP) {
      for (const a of [-0.85, 0.85]) banda(a0, a1, a, -0.12, 0.1, 0.13);
      let p0 = a0; while (p0 <= a1 && V.zonaK[p0] !== 'pique') p0++; let p1 = p0; while (p1 <= a1 && V.zonaK[p1] === 'pique') p1++;
      if (p1 - p0 > 8) for (const a of [-1.38, 1.38]) banda(p0, p1 - 1, a, 1.05, 0.04, 0.05);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const lg = new THREE.Mesh(geo, matBase({ map: texMaderaMina()[0], vertexColors: true })); lg.frustumCulled = false; grp.add(lg);
  }

  // ---- marcos de entibación cada 2,8 m en los túneles y la galería (instanciados, horneados)
  {
    const piezas = [], o = [0, 0, 0]; let ult = -99;
    for (let k = kT0 + 8; k < kT1 - 4; k++) {
      const pf = perf(k), s = k * V.DS; if (pf.fondo > 0.6 || pf.hwI > 4 || s - ult < 2.8 || (Math.abs(xl(k)) < 0.3 && (zl(k) > -94 && zl(k) < -26))) continue; ult = s;
      const { r, u, t } = planoK(k), p = pW(k);
      for (const a of [-(pf.hwI - 0.28), pf.hwD - 0.28]) piezas.push({ c: p.clone().addScaledVector(r, a).addScaledVector(u, (pf.yw - pf.fondo) / 2), x: r, y: u, z: t, sx: 0.24, sy: pf.yw + pf.fondo, sz: 0.24 });
      piezas.push({ c: p.clone().addScaledVector(r, (pf.hwD - pf.hwI) / 2).addScaledVector(u, pf.yw + 0.13), x: r, y: u, z: t, sx: pf.hwI + pf.hwD - 0.2, sy: 0.26, sz: 0.28 });
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matBase({ map: texMaderaMina()[0] }), piezas.length), M4 = new THREE.Matrix4(), C = new THREE.Color();
    piezas.forEach((q, i) => { M4.makeBasis(q.x.clone().multiplyScalar(q.sx), q.y.clone().multiplyScalar(q.sy), q.z.clone().multiplyScalar(q.sz)); M4.setPosition(q.c); im.setMatrixAt(i, M4);
      luces.en(q.c.x, q.c.y, q.c.z, 0, 0, 0, 0.03, o); const n = 0.75; im.setColorAt(i, C.setRGB(o[0] * n + 0.01, o[1] * n + 0.01, o[2] * n + 0.01)); });
    im.frustumCulled = false; grp.add(im);
  }

  // ---- lámparas y faroles (cuerpos) + vetas
  {
    const hierro = matBase({ color: 0x2a2420 }), laton = matBase({ color: 0x9a7a3a });
    const cera = matBase({ color: 0xd9c9a0 });   // vela de sebo sobre un platillo de fierro (la llama está 0,12 sobre p)
    const imL = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.021, 0.17, 8), cera, cajasLamp.length), imP = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.048, 0.016, 10), hierro, cajasLamp.length), M4 = new THREE.Matrix4();
    cajasLamp.forEach((c, i) => { imL.setMatrixAt(i, M4.makeTranslation(c.p.x, c.p.y + 0.03, c.p.z)); imP.setMatrixAt(i, M4.makeTranslation(c.p.x, c.p.y - 0.06, c.p.z)); });
    for (const m of [imL, imP]) { m.frustumCulled = false; grp.add(m); }
    const vidrio = matBase({ color: 0xffb060 }); vidrio.toneMapped = false;
    const imF = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.19, 8), vidrio, faroles.length), imT = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.1, 8), hierro, faroles.length);
    faroles.forEach((p, i) => { imF.setMatrixAt(i, M4.makeTranslation(p.x, p.y, p.z)); imT.setMatrixAt(i, M4.makeTranslation(p.x, p.y + 0.15, p.z)); });
    for (const m of [imF, imT]) { m.frustumCulled = false; grp.add(m); }
    grp.add(puntos(llamas, 1));
    // vetas: cintas finas sobre la roca + destellos
    const pos = [], col = [], idx = [], brillos = [], halos = [];
    let sem = 99; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
    for (const v of vetas) {
      const v0 = pos.length / 3, n = v.pts.length;
      v.pts.forEach((q, i) => {
        const dir = v.pts[Math.min(n - 1, i + 1)].clone().sub(v.pts[Math.max(0, i - 1)]).normalize(), cen = v.ns[i];
        const ld = dir.clone().cross(cen).normalize(), w = v.ancho * (0.5 + 0.5 * Math.sin(i * 2.1 + v.fase)) * (i === 0 || i === n - 1 ? 0.2 : 1);
        for (const sg of [-1, 1]) { const p = q.clone().addScaledVector(ld, sg * w); pos.push(p.x, p.y, p.z); col.push(...v.col.map(c => c * (0.9 + 0.35 * Math.sin(i * 1.7 + v.fase)))); }
        if (az() < 0.55) brillos.push({ p: q.clone(), tam: 0.07 + az() * 0.12, col: v.col.map(c => c * 1.3), fase: az() * 6.28 });
        if (i % 2 === 1) halos.push({ p: q.clone().addScaledVector(v.ns[i], 0.15), tam: 0.9 + az() * 0.6, col: v.col.map(c => c * 0.16), fase: az() * 6.28 });
      });
      for (let i = 0; i < n - 1; i++) { const a = v0 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const mv = matBase({ vertexColors: true, side: THREE.DoubleSide }); mv.toneMapped = false;
    const mVeta = new THREE.Mesh(geo, mv); mVeta.frustumCulled = false; grp.add(mVeta);
    mVeta.onBeforeRender = () => { const k = 0.8 + 0.2 * Math.sin(TIEMPO.value * 1.7); mv.color.setScalar(k); };
    grp.add(puntos(brillos, 0)); grp.add(puntos(halos, 1));
  }

  // ---- pique: cables del ascensor, jaula que sube y baja con su farol, viga y polea arriba
  const jaula = new THREE.Group(), cajasJ = [];
  {
    const k = kDe(sPique + 8), pf = perf(k), { r, t } = planoK(k), p = pW(k), hierro = matBase({ color: 0x3a342e }), o = [0, 0, 0];
    const xc = p.clone().addScaledVector(r, 3.6), top = p.y + pf.yr - 1, fondo = p.y - pf.fondo + 0.5;
    for (const dz of [-0.55, 0.55]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, top - fondo, 4), hierro); c.position.copy(xc).addScaledVector(t, dz).setY((top + fondo) / 2); grp.add(c); }
    const vg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 7), matBase({ map: texMaderaMina()[0], color: 0x7a6a5a })); vg.position.copy(xc).setY(top); vg.lookAt(xc.clone().setY(top).add(r)); grp.add(vg);
    const polea = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 6, 18), hierro); polea.position.copy(xc).setY(top - 0.75); polea.lookAt(polea.position.clone().add(r)); grp.add(polea);
    luces.en(xc.x, p.y, xc.z, 0, 1, 0, 0.05, o);
    const madera = matBase({ map: texMaderaMina()[0], color: new THREE.Color(o[0] * 2 + 0.15, o[1] * 2 + 0.12, o[2] * 2 + 0.1) });
    for (const [x, y, z, sx, sy, sz] of [[0, 0, 0, 1.6, 0.12, 1.6], [0, 2.2, 0, 1.6, 0.12, 1.6], [-0.75, 1.1, -0.75, 0.1, 2.2, 0.1], [0.75, 1.1, -0.75, 0.1, 2.2, 0.1], [-0.75, 1.1, 0.75, 0.1, 2.2, 0.1], [0.75, 1.1, 0.75, 0.1, 2.2, 0.1], [0, 1.1, -0.75, 1.5, 0.08, 0.05], [0, 1.1, 0.75, 1.5, 0.08, 0.05]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), madera); b.position.set(x, y, z); jaula.add(b); cajasJ.push(b);
    }
    // Q1 (16-11): cabina_ascensor de malla (1,5 × 2,4 × 1,5, frente abierto) ×[1,07, 0,96, 1,07] en lugar de la jaula de cajas; frente hacia
    // la vía (+x local de la jaula: lookAt pone +z a lo largo de la vía y la vía queda en −r = +x). Mismo material de luz horneada que la
    // madera de la jaula (MeshBasic con oscurecido por distancia, sin luces dinámicas). Sube y baja con la jaula (paseoCuadro).
    // G9M (16-11): la malla se veía «acuarela» a 1080p (cerrada, botonera moderna) → jaula_mina FINA en código (mueblesFinos_mina.js: listones,
    // pilares con zunchos, horquilla, farol y reja de tijera). Sus materiales pasan a la luz horneada del paseo (MeshBasic con la textura y el color de vértice).
    { const pu = precargarUtileria(); if (pu) pu.then(() => { const c = piezaGrupo('jaula_mina', [1.07, 0.96, 1.07]); if (!c) return;
      const me = c.children[0], k = madera.color.clone().multiplyScalar(2.2);
      me.material = [].concat(me.material).map(x => matBase({ map: x.map || null, vertexColors: true, color: x.name === 'fino_llama' ? new THREE.Color(1, 1, 1) : k, transparent: x.transparent, opacity: x.opacity, depthWrite: x.depthWrite, side: x.side })); me.receiveShadow = false;
      c.name = 'q1_cabina_ascensor'; c.position.y = -0.06; c.rotation.y = Math.PI / 2; jaula.add(c); for (const b of cajasJ) b.visible = false; }); }
    jaula.add(puntos([{ p: V3(0, 1.9, 0), tam: 0.07, col: [1.1, 0.85, 0.5] }, { p: V3(0, 1.9, 0), tam: 1.1, col: [0.5, 0.26, 0.08] }], 1));
    jaula.position.copy(xc); jaula.userData = { top: top - 3.5, fondo: fondo + 0.2 }; jaula.lookAt(jaula.position.clone().add(t)); grp.add(jaula);
  }

  // ---- galería con mineros trabajando: montón de mineral, carro, palas, sacos; 4 mineros (palean, uno saluda al paso)
  let minerosPS = null;
  {
    const o = [0, 0, 0];
    const color = p => { luces.en(p.x, p.y + 1, p.z, 0, 0.5, 0, 0.04, o); return new THREE.Color(o[0] + 0.03, o[1] + 0.03, o[2] + 0.03); };
    const ponerEn = (ds, a) => { const k = kDe(sGal + ds), { r, t } = planoK(k), p = pW(k).addScaledVector(r, a); p.y -= perf(k).fondo; return { p, r, t }; };
    // montones de mineral (roca quebrada con pintas verdes)
    const monton = (ds, a, rad) => {
      const { p } = ponerEn(ds, a), geo = new THREE.ConeGeometry(rad, rad * 0.9, 9, 3); const pa = geo.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), n = ruido3(x * 4 + ds, y * 4, z * 4) - 0.5; pa.setXYZ(i, x * (1 + n * 0.3), y + n * 0.1, z * (1 + n * 0.3)); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, matBase({ map: texRoca()[0], color: color(p).multiplyScalar(1.1) })); m.position.copy(p).add(V3(0, rad * 0.4, 0)); grp.add(m);
    };
    for (const [ds, a, rad] of [[2.2, -2.75, 0.9], [9.0, -2.8, 0.75], [11.5, 2.8, 0.6]]) monton(ds, a, rad);
    // (N1-PASEO-MINEROS: las palas de cajas apoyadas en el muro se reemplazaron por herramientas de paseoMineros.js)
    for (const [ds, a] of [[6.8, -2.9], [7.4, -2.95], [7.1, -2.6]]) { const { p } = ponerEn(ds, a); const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), matBase({ map: texMaderaMina()[0], color: color(p).multiplyScalar(0.9).multiply(new THREE.Color(0.95, 0.8, 0.6)) })); s.scale.set(1, 0.75, 0.8); s.position.copy(p).add(V3(0, 0.22, 0)); grp.add(s); }
    // carro de mineral en una vía muerta a la derecha
    const spV = M.splatsTodos && M.splatsTodos.vagoneta;
    if (spV) { const { p, t } = ponerEn(5.2, 2.55); const car = vehiculoSplat(spV, 2.0, Math.PI / 2, 0.95, 0.85); car.position.copy(p).add(V3(0, 0.05, 0)); car.lookAt(car.position.clone().add(t)); grp.add(car); }
    // N1-PASEO-MINEROS: 4 mineros trabajando con picota, pala (saluda al paso) y barreta (paseoMineros.js)
    minerosPS = armarMineros({ M, grp, ponerEn, sGal, monton, mallaPersona, escala: escalaPersona('minero') });
    minerosPS.carro = ponerEn(5.2, 2.55).p;
  }

  // ---- la vagoneta del paseo (el mismo modelo que las de la vía), con su farol, y la palanca con su letrero
  const vag = new THREE.Group(); vag.name = 'vagonetaPaseo';
  {
    const spV = M.splatsTodos && M.splatsTodos.vagoneta;
    if (spV) { const vs = vehiculoSplat(spV, 2.4, Math.PI / 2, 1.1, 1.0); vs.position.y = 0.05; vag.add(vs); }
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 2.3), mat(0x5a4a3a, { metal: 0.5 })); b.position.y = 0.55; vag.add(b); }
    const hierro = mat(0x2a2622, { rough: 0.6 });
    const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.38), matMadera()); tabla.position.set(0, 0.47, -0.12); vag.add(tabla);   // tabla para sentarse
    for (const dz of [-1.12, 1.12]) {   // un poste con farol en cada extremo (la vagoneta va y viene sin dar vuelta)
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5), hierro); poste.position.set(0.42, 1.2, dz); vag.add(poste);
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.18), hierro); brazo.position.set(0.42, 1.44, dz + Math.sign(dz) * 0.08); vag.add(brazo);
      const vid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), mat(0x3a2412, { emisivo: 0xffa64a, brillo: 1.6 })); vid.position.set(0.42, 1.3, dz + Math.sign(dz) * 0.17); vag.add(vid);
      const tapa = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.08, 8), hierro); tapa.position.set(0.42, 1.42, dz + Math.sign(dz) * 0.17); vag.add(tapa);
    }
    grp.add(vag);
  }
  const luzVag = new THREE.PointLight(0xffa24a, 1.2, 8, 1.6); luzVag.castShadow = false; grp.add(luzVag);
  const chispasN = 160, chispas = { p: new Float32Array(chispasN * 3), v: new Float32Array(chispasN * 3), vida: new Float32Array(chispasN), i: 0 };
  const chGeo = new THREE.BufferGeometry(); chGeo.setAttribute('position', new THREE.BufferAttribute(chispas.p, 3)); chGeo.setAttribute('tam', new THREE.BufferAttribute(new Float32Array(chispasN).fill(0.05), 1));
  chGeo.setAttribute('col', new THREE.BufferAttribute(new Float32Array(chispasN * 3), 3)); chGeo.setAttribute('fase', new THREE.BufferAttribute(new Float32Array(chispasN), 1));
  const chPts = new THREE.Points(chGeo, matPuntos(0)); chPts.material.uniforms.titila.value = 1; chPts.frustumCulled = false; grp.add(chPts);
  chispas.geo = chGeo;

  const palanca = new THREE.Group(), barra = new THREE.Group();
  {
    const hierro = mat(0x2a2622, { rough: 0.55, metal: 0.4 }), madera = matMadera();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.7), madera); base.position.y = 0.08; palanca.add(base);
    // cuadrante dentado de fierro (arco con dientes) entre dos placas, como las palancas de cambio de vía
    const arcoD = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 5, 18, 1.9), hierro); arcoD.rotation.set(0, Math.PI / 2, Math.PI / 2 - 0.95); arcoD.position.y = 0.22; palanca.add(arcoD);
    for (let i = 0; i <= 8; i++) { const a = -0.95 + 1.9 * i / 8, d = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.025), hierro); d.position.set(0, 0.22 + Math.cos(a) * 0.285, Math.sin(a) * 0.285); d.rotation.x = a; palanca.add(d); }
    for (const dx of [-0.045, 0.045]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.2, 0.26), hierro); ch.position.set(dx, 0.2, 0); palanca.add(ch); }
    const varilla = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 1.0, 7), hierro); varilla.position.y = 0.5; barra.add(varilla);
    const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), hierro); pomo.position.y = 1.02; barra.add(pomo);
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.2, 7), mat(0x6a2a1a, { rough: 0.7 })); mango.position.y = 0.9; barra.add(mango);   // empuñadura de madera pintada
    barra.position.y = 0.22; barra.rotation.x = 0.42; palanca.add(barra);
    const pivote = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), hierro); pivote.rotation.z = Math.PI / 2; pivote.position.y = 0.22; palanca.add(pivote);
    palanca.position.copy(W(PALANCA.x, -8, PALANCA.z)); grp.add(palanca);
    // letrero chico de tabla pintada, en un poste detrás de la palanca
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#b89668'; x.fillRect(0, 0, 256, 128); x.strokeStyle = 'rgba(70,45,20,0.35)'; x.lineWidth = 2;
    for (let i = 0; i < 16; i++) { x.beginPath(); x.moveTo(0, 6 + i * 8 + Math.sin(i) * 2); x.bezierCurveTo(80, 2 + i * 8, 170, 10 + i * 8, 256, 5 + i * 8); x.stroke(); }
    x.fillStyle = '#2a170a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 30px Georgia, serif'; x.fillText('PASEO EN', 128, 30); x.fillText('VAGONETA', 128, 64); x.font = 'italic 21px Georgia, serif'; x.fillText('tire la palanca', 128, 102);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    const tabla = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.84), [new THREE.MeshStandardMaterial({ map: tx, roughness: 0.85 }), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.85 }), madera, madera, madera, madera]);
    tabla.position.copy(W(PALANCA.x + 0.62, -8 + 1.5, PALANCA.z - 0.35)); tabla.rotation.y = Math.PI; tabla.rotation.x = 0.02; grp.add(tabla);
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 0.1), madera); poste.position.copy(W(PALANCA.x + 0.68, -8 + 0.86, PALANCA.z - 0.35)); grp.add(poste);
    M.fis.caja(O.x + PALANCA.x, -8 + 0.35, O.z + PALANCA.z, 0.5, 0.7, 0.7, 0, { tipo: 'mueble' });
    M.fis.caja(O.x + PALANCA.x + 0.68, -8 + 0.9, O.z + PALANCA.z - 0.35, 0.14, 1.8, 0.14, 0, { tipo: 'mueble' });
  }
  { const p = pW(V.kIni); M.fis.caja(p.x, -8 + 0.6, p.z, 1.15, 1.2, 2.45, 0, { tipo: 'cajon' }); }   // la vagoneta estacionada (vuelve siempre al mismo lugar)

  // objetos de la sala que se ocultan durante el viaje (la caja negra y las tapas del fondo de los túneles de la vía)
  const ocultables = []; g.traverse(o2 => { if (o2.userData && (o2.userData.cajaNegra || o2.userData.tapaTunel)) ocultables.push(o2); });

  const P = { V, O, grp, vag, luzVag, barra, palanca, jaula, minerosPS, mineros: minerosPS.mineros, chispas, chPts, ocultables, estado: 'libre', t: 0, tViaje: 0, tB: 0, primera: false,
    fr, W, kIni: V.kIni, sOc0: kO0 * V.DS, sOc1: kO1 * V.DS, salaG: g, salaOculta: false, sIni: V.sIni, sFin: V.sFin, camP: V3(), camM: V3(), camU: V3(0, 1, 0), camLista: false, sonido: null, tE: 0, eSuelta: false, angPal: 0.42 };
  ponerVagoneta(P, V.sIni);
  M.paseoObj = P;
  addEventListener('keydown', ev => { if (ev.code === 'KeyV' && !ev.repeat && M.paseoObj && M.paseoObj.estado !== 'libre') M.paseoObj.primera = !M.paseoObj.primera; });
  return P;
}

// vagoneta en s: posición en la vía con sus ejes (peralte e inclinación incluidos)
const _M4 = new THREE.Matrix4();
function ponerVagoneta(P, s) {
  const f = marcoEn(P.V, s, P.fr);
  P.vag.position.set(P.O.x + f.p.x, f.p.y, P.O.z + f.p.z);
  const x = f.u.clone().cross(f.t).normalize();   // eje x del modelo
  _M4.makeBasis(x, f.u, f.t); P.vag.quaternion.setFromRotationMatrix(_M4);
  P.luzVag.position.copy(P.vag.position).addScaledVector(f.u, 1.35).addScaledVector(f.t, 1.05).addScaledVector(x, 0.42);
  return f;
}
const ASIENTO = V3(0, 0.5, -0.12);   // sentado en una tabla atravesada sobre la carga (en el piso de la vagoneta el mineral lo tapaba)
const asiento = (P, out = V3()) => out.copy(ASIENTO).applyQuaternion(P.vag.quaternion).add(P.vag.position);

// ---------------------------------------------------------------- sonido sintetizado (bus de efectos del juego: respeta mudo y volumen)
function crearSonido() {
  const c = AUDIO.ctx; if (!c || !AUDIO.salida) return null;
  const sal = c.createGain(); sal.gain.value = AUDIO.mudo ? 0 : 1; sal.connect(AUDIO.salida);
  const ruido = AUDIO.ruido || (() => { const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const fuente = c.createBufferSource(); fuente.buffer = ruido; fuente.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 0.7;
  const gR = c.createGain(); gR.gain.value = 0;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6; const gV = c.createGain(); gV.gain.value = 0;
  fuente.connect(lp); lp.connect(gR); gR.connect(sal); fuente.connect(bp); bp.connect(gV); gV.connect(sal); fuente.start();
  const zumb = c.createOscillator(); zumb.type = 'sawtooth'; zumb.frequency.value = 52; const lpZ = c.createBiquadFilter(); lpZ.type = 'lowpass'; lpZ.frequency.value = 260; const gZ = c.createGain(); gZ.gain.value = 0;
  zumb.connect(lpZ); lpZ.connect(gZ); gZ.connect(sal); zumb.start();
  const chir = c.createOscillator(); chir.type = 'sawtooth'; chir.frequency.value = 2100; const bpC = c.createBiquadFilter(); bpC.type = 'bandpass'; bpC.frequency.value = 2300; bpC.Q.value = 7; const gC = c.createGain(); gC.gain.value = 0;
  chir.connect(bpC); bpC.connect(gC); gC.connect(sal); chir.start();
  const golpe = (f0, f1, dur, vol, tipo = 'triangle', ruidoF = 0, ruidoVol = 0) => {
    const t = c.currentTime;
    if (vol > 0) { const o = c.createOscillator(), g = c.createGain(); o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(sal); o.start(t); o.stop(t + dur + 0.02); }
    if (ruidoVol > 0) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = ruido; f.type = 'bandpass'; f.frequency.value = ruidoF; f.Q.value = 1.6; g.gain.setValueAtTime(ruidoVol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur * 0.8); s.connect(f); f.connect(g); g.connect(sal); s.start(t, Math.random() * 0.5); s.stop(t + dur); }
  };
  return {
    sal, golpe,
    actualizar(v, cadena, freno, dt) {
      const t = c.currentTime, k = Math.min(1, v / 14);
      sal.gain.setTargetAtTime(AUDIO.mudo ? 0 : 1, t, 0.05);
      gR.gain.setTargetAtTime(dt > 0 && v > 0.05 ? 0.05 + 0.13 * k : 0, t, 0.08); lp.frequency.setTargetAtTime(110 + 260 * k, t, 0.1);
      gV.gain.setTargetAtTime(dt > 0 ? 0.07 * k * k : 0, t, 0.15); bp.frequency.setTargetAtTime(500 + 900 * k, t, 0.2);
      gZ.gain.setTargetAtTime(dt > 0 && cadena ? 0.035 : 0, t, 0.12);
      const fr = dt > 0 ? (freno === 2 ? 0.05 * Math.min(1, v / 1.2 + 0.25) : freno ? 0.03 : 0) : 0;
      gC.gain.setTargetAtTime(fr, t, 0.06); chir.frequency.setTargetAtTime(freno === 2 ? 1500 + 500 * Math.min(1, v / 3) : 2200 + 180 * Math.sin(t * 9), t, 0.05);
    },
    junta(v) { golpe(110, 60, 0.07, 0.05 + 0.012 * Math.min(14, v), 'triangle', 1700 + Math.random() * 500, 0.04 + 0.006 * Math.min(14, v)); },   // ruedas sobre la junta del riel
    clac() { golpe(2300, 1400, 0.03, 0.03, 'square', 3200, 0.05); golpe(170, 90, 0.06, 0.06, 'triangle'); },   // trinquete de la cadena
    palanca() { golpe(190, 80, 0.25, 0.12, 'triangle', 900, 0.08); setTimeout(() => golpe(2600, 1500, 0.04, 0.03, 'square', 3000, 0.04), 120); },
    chispa() { golpe(0, 0, 0.05, 0, 'square', 5200 + Math.random() * 2000, 0.03); },
    parar() { const t = c.currentTime; sal.gain.setTargetAtTime(0, t, 0.1); setTimeout(() => { for (const o of [fuente, zumb, chir]) try { o.stop(); } catch (e) { /* ya */ } sal.disconnect(); }, 700); },
  };
}

// ---------------------------------------------------------------- estado del paseo
const enPaseo = P => P && P.estado !== 'libre';
function ocultarSala(P, v) {   // la galería de la mina (menos luces y el paseo) mientras la vagoneta va lejos, dentro de la roca
  if (P.salaOculta === v) return; P.salaOculta = v;
  for (const o of P.salaG.children) { if (o === P.grp || o.isLight) continue; if (v) { o.userData._visPaseo = o.visible; o.visible = false; } else if (o.userData._visPaseo !== undefined) { o.visible = o.userData._visPaseo; delete o.userData._visPaseo; } }
}
function viajando(M, P, v) {   // ocultar/mostrar la caja negra y las tapas de los túneles; parar los lanzadores de vagonetas
  if (!v) ocultarSala(P, false);
  for (const o of P.ocultables) o.visible = !v;
  M.paseoVia = v ? SALA : null;
}
function iniciar(M, P) {
  const j = M.jug;
  P.estado = 'palanca'; P.t = 0; P.tViaje = 0; P.tB = 0; P.tE = 0; P.eSuelta = false; P.salto = 0; P.camLista = false; P.junta = null;
  j.estado = 'quieto'; j.vel.set(0, 0, 0); j.invul = 0;
  const pl = P.palanca.position; j.rumbo = Math.atan2(pl.x - j.pos.x, pl.z - j.pos.z);
  j.gesto('recoger', 0.95);
  P.desde = V3(j.pos.x, j.pie, j.pos.z);
  // un minero de la galería que venía persiguiendo a Nato vuelve a su lugar (si no, se queda pegándole a Nato, que está en la vagoneta)
  for (const e of M.L.lista) if (e.vivo && e.tipo === 'minero' && e.sala === SALA && e.casa && e.malla && !['dormido', 'ko', 'sevan'].includes(e.estado) && e.malla.position.distanceTo(j.pos) < 16) { e.malla.position.copy(e.casa); e.estado = 'patrulla'; e.t = 0; }
  P.sonido = P.sonido || crearSonido();
  M.paseoVia = SALA;   // desde ya no sale ninguna vagoneta nueva de la vía
  UI.aviso('Esc o mantén E: saltar el paseo · V: primera persona', 4200);
}
function terminar(M, P) {   // Nato abajo: el control vuelve al jugador
  const j = M.jug, b = P.W(BAJADA.x, -8, BAJADA.z);
  j.teletransportar(b.x, -8 + 0.05, b.z); j.rumbo = 0.35; j.estado = 'normal'; j.gestoAct = null; j.vel.set(0, 0, 0);
  if (j.anim) j.anim.tocar('idle', { reiniciar: true, fundido: 0.2 });
  M.cam.yaw = j.rumbo + Math.PI; M.cam.pitch = 0.26; M.cam.cortar(); M.cam.muyCerca = false;
  P.estado = 'libre'; P.camLista = false; P.primera = false;
  M.paseoVia = null;
  if (P.sonido) { P.sonido.parar(); P.sonido = null; }
  NIEBLA.value.set(16, 78);
}

// paso de física (1/60 s): palanca con E y salto con E mantenida
export function paseoPaso(M, dt) {
  const P = M.paseoObj; if (!P || M.salaActual !== SALA || M.final) return;
  const j = M.jug;
  if (P.estado === 'libre') {
    const pl = P.palanca.position, d = Math.hypot(j.pos.x - pl.x, j.pos.z - pl.z);
    if (d < 1.9 && Math.abs(j.pie - pl.y) < 1.2 && j.estado === 'normal') {
      if (E.b.accion.recien) { iniciar(M, P); return; }
      if (!(P.tAviso > performance.now())) { P.tAviso = performance.now() + 1500; UI.aviso('E: subir a la vagoneta', 1600); }
    }
    return;
  }
  if (!E.b.accion.apretado) { P.eSuelta = true; P.tE = 0; }
  else if (P.eSuelta) { P.tE += dt; if (P.tE > 0.8 && (P.estado === 'viaje' || P.estado === 'espera' || P.estado === 'subir')) saltar(M, P); }
}
function saltar(M, P) { if (P.salto > 0 || P.estado === 'bajar' || P.estado === 'palanca') return false; P.salto = 0.55; UI.fundir(true); return true; }
export function paseoSaltar(M) { const P = M.paseoObj; if (!enPaseo(P) || M.salaActual !== SALA) return false; saltar(M, P); return true; }

// cada cuadro (sin pausa): mueve la vagoneta, a Nato, chispas, sonido; anima mineros y la jaula del pique
const _a = V3(), _b = V3();
// TIRONES-MOVIL (17-11-2026): armar el paseo en la pantalla de carga (antes se armaba en el primer cuadro dentro de la mina: ~0,2 s de
// armado y, como trae su propia luz, la cuenta de luces cambiaba y se recompilaba toda la sala con la luz encendida: ~1 s en el celular)
export function paseoPreparar(M) { if (!M.paseoObj && M.R && M.R.salas[SALA]) construir(M); }
export function paseoCuadro(M, dt) {
  if (M.salaActual !== SALA) return;
  const P = M.paseoObj || construir(M);
  TIEMPO.value += dt;
  const j = M.jug, V = P.V;
  // la palanca vuelve sola arriba cuando no hay paseo
  const angMeta = P.estado === 'libre' ? 0.42 : P.estado === 'palanca' && P.t < 0.3 ? 0.42 : -0.62;
  P.angPal += (angMeta - P.angPal) * Math.min(1, dt * (P.estado === 'libre' ? 2.5 : 9)); P.barra.rotation.x = P.angPal;
  P.luzVag.intensity = enPaseo(P) ? 5 : 1.6;
  if (!enPaseo(P)) { if (P.sonido) P.sonido.actualizar(0, 0, 0, 0); return; }
  P.t += dt;
  if (P.salto > 0) {   // saltar el paseo: a oscuras, la vagoneta queda detenida en el punto de llegada
    P.salto -= dt;
    if (P.salto <= 0) { P.tViaje = V.tTotal; P.estado = 'bajar'; P.tB = 0; viajando(M, P, false); ponerVagoneta(P, P.sFin); P.camLista = false; setTimeout(() => UI.fundir(false), 80); }
  }
  let e = { s: P.sIni, v: 0, fr: 0, ca: 0, k: P.kIni };
  if (P.estado === 'palanca') {
    if (P.t > 0.42 && !P.sonoPal) { P.sonoPal = 1; P.sonido?.palanca(); }
    if (P.t > 1.0) { P.estado = 'subir'; P.t = 0; P.sonoPal = 0; j.gesto('saltar', 0.8); }
  } else if (P.estado === 'subir') {
    const k = Math.min(1, P.t / 0.75), dest = asiento(P, _a);
    j.malla.position.lerpVectors(P.desde, dest, suave(k)); j.malla.position.y += Math.sin(k * Math.PI) * 0.75;
    const f = P.fr; j.malla.rotation.set(0, Math.atan2(f.t.x, f.t.z) * suave(k) + j.rumbo * (1 - suave(k)), 0);
    if (P.t > 0.75) { P.estado = 'espera'; P.t = 0; j.gesto('levantarse', 1e6); }
  } else if (P.estado === 'espera') {
    // sale cuando no viene ninguna vagoneta por la vía del fondo (las nuevas ya no salen: M.paseoVia)
    const libre = !M.L.lista.some(x => x.tipo === 'vagoneta' && x.vivo && x.sala === SALA && x.malla && x.malla.position.z - P.O.z < -71.5);
    if (P.t > 0.7 && libre) { P.estado = 'viaje'; P.tViaje = 0; viajando(M, P, true); P.sonido?.palanca(); }
  } else if (P.estado === 'viaje') {
    P.tViaje = P.fijarT ?? P.tViaje + dt; e = enTiempo(V, P.tViaje);   // fijarT: solo pruebas (QC de los mineros)
    ocultarSala(P, e.s > P.sOc0 && e.s < P.sOc1);
    if (P.tViaje >= V.tTotal) { P.estado = 'bajar'; P.tB = 0; viajando(M, P, false); }
  } else if (P.estado === 'bajar') {
    P.tB += dt; e = { s: P.sFin, v: 0, fr: 0, ca: 0, k: V.kFin };
    if (P.tB > 0.5 && P.tB - dt <= 0.5) j.gesto('saltar', 0.8);
    if (P.tB > 1.25 && P.tB - dt <= 1.25) j.gesto('aterrizar', 0.4);
  }
  // vagoneta, farol, Nato sentado
  const f = ponerVagoneta(P, e.s);
  if (P.estado === 'espera' || P.estado === 'viaje' || (P.estado === 'bajar' && P.tB <= 0.5)) {
    asiento(P, j.malla.position); j.malla.quaternion.copy(P.vag.quaternion);
    if (j.anim) { j.anim.tocar('levantarse', { reiniciar: true, fundido: 0 }); j.anim.actualizar(T_SENTADO); }
  } else if (P.estado === 'bajar') {
    const k = Math.min(1, (P.tB - 0.5) / 0.75), b = P.W(BAJADA.x, -8, BAJADA.z), sa = asiento(P, _b);
    if (k < 1) { j.malla.position.lerpVectors(sa, b, suave(k)); j.malla.position.y += Math.sin(k * Math.PI) * 0.7; } else j.malla.position.copy(b);
    j.malla.rotation.set(0, Math.atan2(f.t.x, f.t.z) * (1 - suave(k)) + 0.35 * suave(k), 0);
    if (P.tB > 1.65) { terminar(M, P); return; }
  }
  // oscurecido por distancia: en la caverna se ve más lejos
  const zn = V.zonaK[Math.min(V.M - 1, Math.round(e.s / V.DS))];
  const nM = zn === 'cueva' || zn === 'pique' ? 95 : 70; NIEBLA.value.y += (nM - NIEBLA.value.y) * Math.min(1, dt * 1.5); NIEBLA.value.x = NIEBLA.value.y * 0.22;
  // juntas de los rieles (cada 4,5 m, dos ejes), trinquete de la cadena (cada 0,9 m), chispas y chirrido en frenos y curvas
  if (P.estado === 'viaje' && P.sonido) {
    const s = e.s;
    if (P.junta == null) P.junta = s;
    for (const off of [0.7, -0.7]) { const a = Math.floor((P.junta + off) / 4.5), b = Math.floor((s + off) / 4.5); if (b > a && e.v > 0.3) P.sonido.junta(e.v); }
    if (e.ca && Math.floor(s / 0.9) > Math.floor(P.junta / 0.9)) P.sonido.clac();
    P.junta = s;
  }
  P.sonido?.actualizar(e.v, e.ca, e.fr, dt);
  // chispas: frenos de ajuste y curvas rápidas (ruedas de atrás, lado de afuera de la curva)
  const ch = P.chispas, bk = V.bank[Math.min(V.M - 1, Math.round(e.s / V.DS))];
  const tasa = P.estado === 'viaje' ? (e.fr ? (e.fr === 2 ? 40 : 120) : 0) + (Math.abs(bk) > 0.22 && e.v > 7 ? 90 * Math.abs(bk) : 0) : 0;
  P.acChispa = (P.acChispa || 0) + tasa * dt;
  const x = f.u.clone().cross(f.t).normalize();
  while (P.acChispa >= 1) {
    P.acChispa -= 1; const i = ch.i = (ch.i + 1) % ch.vida.length, lado = e.fr ? (Math.random() < 0.5 ? -1 : 1) : (bk > 0 ? 1 : -1);
    const p0 = P.vag.position.clone().addScaledVector(x, -lado * 0.5).addScaledVector(f.t, (Math.random() < 0.5 ? -0.75 : 0.75)).addScaledVector(f.u, 0.12);
    ch.p.set([p0.x, p0.y, p0.z], i * 3);
    const vv = f.t.clone().multiplyScalar(-e.v * (0.15 + Math.random() * 0.25)).addScaledVector(x, -lado * (0.5 + Math.random() * 1.6)).add(V3((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8));
    ch.v.set([vv.x, vv.y, vv.z], i * 3); ch.vida[i] = 0.25 + Math.random() * 0.3;
    if (Math.random() < 0.08) P.sonido?.chispa();
  }
  const col = ch.geo.attributes.col.array;
  for (let i = 0; i < ch.vida.length; i++) {
    if (ch.vida[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
    ch.vida[i] -= dt; ch.v[i * 3 + 1] -= 9.8 * dt;
    for (let q = 0; q < 3; q++) ch.p[i * 3 + q] += ch.v[i * 3 + q] * dt;
    const k = Math.max(0, ch.vida[i]) * 3; col[i * 3] = 2.2 * k; col[i * 3 + 1] = 1.3 * k; col[i * 3 + 2] = 0.45 * k;
  }
  ch.geo.attributes.position.needsUpdate = true; ch.geo.attributes.col.needsUpdate = true;
  // jaula del pique y mineros (solo cuando la vagoneta anda cerca)
  const jj = P.jaula, u = jj.userData; jj.position.y = u.fondo + (u.top - u.fondo) * (0.5 + 0.5 * Math.sin(TIEMPO.value * 0.22));
  animarMineros(P.minerosPS, e, dt, { cam: M.cam && M.cam.cam || null, vag: P.vag.position, carro: P.minerosPS.carro, sonido: P.sonido, chispa: (p, v) => chispa(P, p, v) });
}

function chispa(P, p, v) {   // una chispa suelta (golpes de picota)
  const ch = P.chispas, i = ch.i = (ch.i + 1) % ch.vida.length;
  ch.p.set([p.x, p.y, p.z], i * 3); ch.v.set([v.x, v.y, v.z], i * 3); ch.vida[i] = 0.2 + Math.random() * 0.25;
}

// cámara del paseo: detrás y encima de Nato, a lo largo de la vía (nunca atraviesa la roca: va por el eje del túnel); V = primera persona
export function paseoCamara(M, cam, dt) {
  const P = M.paseoObj; if (!enPaseo(P) || M.salaActual !== SALA || P.estado === 'palanca') return false;
  const V = P.V, s = P.estado === 'viaje' ? enTiempo(V, P.tViaje).s : P.estado === 'bajar' ? P.sFin : P.sIni;
  const v = P.estado === 'viaje' ? enTiempo(V, P.tViaje).v : 0;
  const fa = marcoEn(V, s - (P.primera ? 0 : 3.7)), fb = marcoEn(V, s + (P.primera ? 9 : 5));
  const Ox = P.O.x, Oz = P.O.z, ojo = V3(), mira = V3(), arriba = V3(0, 1, 0);
  if (P.primera) { asiento(P, ojo).addScaledVector(P.fr.u, 1.18).addScaledVector(P.fr.t, 0.2); mira.set(Ox + fb.p.x, fb.p.y, Oz + fb.p.z).addScaledVector(fb.u, 1.1); arriba.copy(P.fr.u).lerp(V3(0, 1, 0), 0.3).normalize(); }
  else { ojo.set(Ox + fa.p.x, fa.p.y, Oz + fa.p.z).addScaledVector(fa.u, 2.05); mira.set(Ox + fb.p.x, fb.p.y, Oz + fb.p.z).addScaledVector(fb.u, 0.95); arriba.copy(fa.u).lerp(V3(0, 1, 0), 0.55).normalize(); }
  // sacudidas suaves: más con la velocidad y al frenar
  const T = TIEMPO.value, amp = P.estado === 'viaje' ? 0.004 + 0.0022 * v + (enTiempo(V, P.tViaje).fr ? 0.012 : 0) : 0;
  ojo.x += amp * (Math.sin(T * 23.1) + 0.6 * Math.sin(T * 37.7 + 1)); ojo.y += amp * (Math.sin(T * 19.3 + 2) + 0.5 * Math.sin(T * 41.3)); ojo.z += amp * Math.sin(T * 29.9 + 0.5);
  if (!P.camLista) { P.camP.copy(cam.position); P.camM.copy(cam.position).add(cam.getWorldDirection(V3()).multiplyScalar(5)); P.camU.set(0, 1, 0); P.camLista = true; P.tMezcla = 0; P.mezclaDesde = { p: cam.position.clone(), m: P.camM.clone() }; }
  // al subir: mezcla de 1,4 s desde la cámara del juego; al bajar: hacia donde la pondrá la cámara del juego (detrás de Nato)
  P.tMezcla = (P.tMezcla || 0) + dt;
  let kM = suave(P.tMezcla / 1.4);
  if (P.estado === 'bajar' && P.tB > 0.45) {
    const b = P.W(BAJADA.x, -8, BAJADA.z), yaw = 0.35 + Math.PI, pit = 0.26, d = 5;
    const ojoJ = V3(b.x, -8 + 1.05, b.z).add(V3(Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit)).multiplyScalar(d)), miraJ = V3(b.x, -8 + 1.05, b.z);
    const k = suave((P.tB - 0.45) / 1.15); ojo.lerp(ojoJ, k); mira.lerp(miraJ, k); arriba.lerp(V3(0, 1, 0), k).normalize();
  }
  const kS = 1 - Math.exp(-dt * (P.primera ? 18 : 9));
  P.camP.lerp(ojo, kS); P.camM.lerp(mira, kS); P.camU.lerp(arriba, kS).normalize();
  const pos = P.mezclaDesde && kM < 1 ? P.mezclaDesde.p.clone().lerp(P.camP, kM) : P.camP, mi = P.mezclaDesde && kM < 1 ? P.mezclaDesde.m.clone().lerp(P.camM, kM) : P.camM;
  cam.position.copy(pos); cam.up.copy(P.camU); cam.lookAt(mi); cam.up.set(0, 1, 0);
  M.cam.muyCerca = P.primera;
  // tamaño de los puntos según la pantalla
  const h = (cam.isPerspectiveCamera ? 0.5 / Math.tan(cam.fov * Math.PI / 360) : 1) * (innerHeight * Math.min(2, devicePixelRatio || 1));
  P.grp.traverse(o => { if (o.isPoints && o.material.uniforms && o.material.uniforms.escala) o.material.uniforms.escala.value = h; });
  return true;
}
