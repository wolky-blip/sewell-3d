// N0-VENTANAS-REALES (carril render, 15-11-2026). Pedido de Diego: «¿Es posible que por las ventanas realmente veas el exterior y no esos
// edificios falsos? Para todos los edificios a los que se ingresa.»
//
// Cómo funciona
// - Los interiores se arman en una «sala» lejos del mundo (interiores.js x 6000; kits de hospital, escuela, club, iglesia, cine, palitroque en
//   x 3000-4800). Por las ventanas se veía un fondo pintado: el cilindro `vista`/`vista1905` (interiores.js) o planos «dia» / `vista` de los kits.
// - Al cruzar la puerta (con la pantalla ya en negro y el mundo exterior TODAVÍA visible) se toma un cubemap del mundo real desde DENTRO del
//   edificio real (su lote; uno por fila de ventanas o por piso, máx. 3), escondiendo solo ese edificio, a Nato, a Hércules, las puertas
//   dibujadas y las gaussianas. Se hace en el hilo de la puerta (un setTimeout), FUERA de cualquier render (lección R-9: nada de render anidado
//   en onBeforeRender), sin re-dibujar sombras y devolviendo el render target, la sombra y las visibilidades tal como estaban.
// - Las mallas de vista de la sala cambian a un material que, por cada píxel, toma la dirección cámara→píxel, la lleva del marco de la sala al
//   del mundo (giro de la puerta: la cara +z de la sala es la de la puerta; en la puerta de «salida», -z) y corrige paralaje: el rayo sale del
//   ojo «en el mundo» y choca con una esfera de 30 m alrededor del punto de captura o con el plano de la calle; se muestrea desde el punto de
//   captura hacia ese choque. Así la calle frente a la puerta real se ve por las ventanas del frente, y desde un 3.er piso se ve la calle abajo.
// - Al salir se devuelven los materiales de la sala y se liberan los cubemaps. Cubemap 256 (Baja/Móvil), 512 (Media), 1024 (Ultra; máx. 2).
// - Sin edificio real (o ?ventanas=0): queda la vista pintada de siempre.
import * as THREE from 'three';
import { altura } from '../mundo/terreno.js';

const URLV = new URLSearchParams(globalThis.location ? location.search : '');
const APAGADO = URLV.get('ventanas') === '0';
// paralaje con el cubo de distancias (?vvparalaje=1): corrige mejor a los vecinos cercanos pero mete ruido en barandas finas (hoja capturas/render/ventanas/var);
// por omisión: esfera de 30 m + plano de la calle ajustado al terreno (limpio, sin ruido)
const PARALAJE = URLV.get('vvparalaje') === '1';
const RES = { baja: 256, movil: 256, media: 512, ultra: 1024 };
const EMBLEMA = /^(hospital|hospital_ala|cine|palitroque|club|escuela|iglesia)$/;
let activo = null;   // { sala, mallas: [[mesh, matOriginal]], cubos: [rt], mat }
export const ajustarVista = o => { if (activo) for (const [k, v] of Object.entries(o)) if (activo.U[k]) activo.U[k].value = v; };   // pruebas
export const alternarVista = real => { if (activo) for (const [o, m] of activo.mallas) o.material = real ? activo.usados.get(m) : m; };   // pruebas A/B de fps
export const estadoVista = () => activo && { sala: activo.sala.id, cubos: activo.cubos.length, mallas: activo.mallas.length, ms: activo.ms, res: activo.res, info: activo.info };

// ¿esta malla de la sala es una «vista» por la ventana (fondo pintado)?
function esVista(o, salaId) {
  if (!o.isMesh || !o.material || Array.isArray(o.material)) return false;
  if (o.userData.vistaVentana || o.material.userData.vistaVentana) return true;
  const n = o.name || '';
  if (n === 'dia' || /^(kit|hosp|esc|mus|kit_club)_dia$/.test(n)) return true;
  if (/^cine/.test(salaId) && n === 'kit_vidrio' && o.material.isMeshBasicMaterial) return true;   // cine: vidrios altos pintados de azul gris
  const g = o.geometry;
  return !!(g && g.type === 'CylinderGeometry' && g.parameters.radiusTop >= 50 && g.parameters.openEnded);   // interiores.js: cilindro pintado de 90 m
}

// alturas (en el marco de la sala) de las filas de ventanas: vértices de las mallas de vista agrupados (salto > 1,6 m = otra fila)
function filas(mallas) {
  const ys = [], v = new THREE.Vector3();
  for (const o of mallas) {
    const p = o.geometry.attributes.position; if (!p || o.geometry.type === 'CylinderGeometry') continue;
    o.updateWorldMatrix(true, false);
    for (let i = 0, paso = Math.max(1, Math.floor(p.count / 20000)); i < p.count; i += paso) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); ys.push(v.y); }
  }
  ys.sort((a, b) => a - b);
  const grupos = []; let g0 = null;
  for (const y of ys) { if (!g0 || y - g0.max > 1.8) grupos.push(g0 = { min: y, max: y }); else g0.max = y; }
  return grupos.filter(g => g.max - g.min > 0.3).map(g => (g.min + g.max) / 2);   // sin claraboyas (planas)
}

const VERT_DECL = 'varying vec3 vMundoV;\n';
const FRAG_DECL = `varying vec3 vMundoV;
uniform samplerCube uCubo0; uniform samplerCube uCubo1; uniform samplerCube uCubo2; uniform samplerCube uDist0; uniform samplerCube uDist1; uniform samplerCube uDist2;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform float uNCubos;
uniform vec3 uAl; uniform vec3 uAw; uniform mat3 uRot; uniform vec3 uCajaMin; uniform vec3 uCajaMax;
uniform vec4 uCalle; uniform float uRadio; uniform float uIter; uniform float uMezcla; uniform float uRmin; uniform float uLodD; uniform float uLod; uniform vec3 uTinte;
float vvSalida(vec3 oc, vec3 d, float r) { float b = dot(oc, d), c = dot(oc, oc) - r * r, h = b * b - c; return h > 0.0 ? -b + sqrt(h) : -1.0; }
vec3 vvMuestra(samplerCube cubo, samplerCube dist, vec3 C, vec3 e, vec3 d) {
  vec3 oc = e - C;
  float t = vvSalida(oc, d, uRadio); if (t < 0.0) t = uRadio;
  float dn = dot(uCalle.xyz, d); if (dn < -0.002) { float tg = (uCalle.w - dot(uCalle.xyz, e)) / dn; if (tg > 0.0) t = min(t, tg); }   // calle: plano ajustado al terreno alrededor del edificio (n·p = w)
  // paralaje con la distancia real medida desde C: el rayo del ojo se cruza con la «esfera» de radio = distancia en esa dirección (3 vueltas)
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uIter) break;
    float r = max(min(textureLod(dist, oc + d * t, uLodD).r, 3000.0), uRmin);
    float t2 = vvSalida(oc, d, r);
    if (t2 > 0.0) t = mix(t, t2, uMezcla);
  }
  return textureLod(cubo, oc + d * t, uLod).rgb;
}
`;
const FRAG_MAPA = `{
  vec3 dL = normalize(vMundoV - cameraPosition);
  vec3 dW = normalize(uRot * dL);
  vec3 eW = clamp(uAw + uRot * (cameraPosition - uAl), uCajaMin, uCajaMax);   // el ojo, llevado al edificio real (dentro de su caja)
  vec3 col;
  float a0 = abs(eW.y - uC0.y), a1 = uNCubos > 1.5 ? abs(eW.y - uC1.y) : 1e9, a2 = uNCubos > 2.5 ? abs(eW.y - uC2.y) : 1e9;
  if (a0 <= a1 && a0 <= a2) col = vvMuestra(uCubo0, uDist0, uC0, eW, dW);
  else if (a1 <= a2) col = vvMuestra(uCubo1, uDist1, uC1, eW, dW);
  else col = vvMuestra(uCubo2, uDist2, uC2, eW, dW);
  diffuseColor.rgb = col * uTinte;
}
`;

function materialVista(original, U) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: original.side, transparent: original.transparent, opacity: original.opacity,
    depthWrite: original.depthWrite, depthTest: original.depthTest, polygonOffset: original.polygonOffset, polygonOffsetFactor: original.polygonOffsetFactor, polygonOffsetUnits: original.polygonOffsetUnits });
  m.name = 'vistaVentanaReal'; m.toneMapped = original.toneMapped;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_DECL + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vMundoV = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = FRAG_DECL + sh.fragmentShader.replace('#include <map_fragment>', FRAG_MAPA);
  };
  m.customProgramCacheKey = () => 'vistaVentanaReal1';
  return m;
}

const LEJOS = 20000;
let _matDist = null;
function matDistancia() {   // distancia a la cámara del cubo (= C): largo de la posición en el espacio de vista; sirve para mallas instanciadas y con huesos
  if (_matDist) return _matDist;
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }); m.name = 'vistaVentanaDist';
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vVVmv;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vVVmv = mvPosition.xyz;');
    sh.fragmentShader = 'varying vec3 vVVmv;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor = vec4(length(vVVmv), 0.0, 0.0, 1.0);');
  };
  m.customProgramCacheKey = () => 'vistaVentanaDist1';
  return (_matDist = m);
}

// puerta → marco: la cara de la puerta en la sala (+z, o -z en la puerta de «salida») corresponde a la normal de la puerta en el mundo
export function entrarVista(M, puerta, sala, destino, render) {
  salirVista(M);
  if (APAGADO || !sala || !sala.grupo || !destino || puerta.boca || !render || !render.renderer) return null;
  const t0 = performance.now();
  const mallas = []; sala.grupo.traverse(o => { if (esVista(o, sala.id)) mallas.push(o); });
  if (!mallas.length) return null;
  const R = M.R, r = puerta.rumbo || 0, n = new THREE.Vector3(Math.sin(r), 0, Math.cos(r));
  const haciaDentro = destino === sala.salida && sala.entrada && sala.entrada.z > destino.z + 3 ? 1 : -1;   // igual que entrarSala
  const th = haciaDentro > 0 ? r + Math.PI : r;   // giro sala → mundo (alrededor de y)
  const rot = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(th));
  const dPuerta = puerta.gen ? 1.6 : (puerta.salidaDist === 1.7 ? 1.0 : 1.5);   // de la marca de la puerta a la fachada (interiores 1,6; construir 1,5; kitEmblemas 1,0)
  const Aw = new THREE.Vector3(puerta.x - n.x * dPuerta, puerta.y || 0, puerta.z - n.z * dPuerta);   // fachada real, a ras del piso de la puerta
  const Al = new THREE.Vector3(destino.x, destino.y, destino.z - haciaDentro * 0.3);
  const aMundo = v => v.clone().sub(Al).applyMatrix3(rot).add(Aw);
  // centro de las vistas de la sala (xz) llevado al mundo: de ahí se busca el edificio real
  const cS = new THREE.Box3(); for (const o of mallas) { if (o.geometry.type === 'CylinderGeometry') continue; o.geometry.computeBoundingBox(); cS.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
  const centroLocal = cS.isEmpty() ? Al.clone().add(new THREE.Vector3(0, 0, haciaDentro * (sala.D ? sala.D / 2 : 6))) : cS.getCenter(new THREE.Vector3());
  if (sala.gen && sala.D) centroLocal.set(Al.x, Al.y, Al.z + haciaDentro * sala.D / 2);
  const cW = aMundo(centroLocal);
  // el edificio real: lote cuyo centro está más cerca del centro buscado (emblemático: el de su id, cerca de la puerta)
  let gs = null, mejor = 1e9;
  for (const g of R.gaussianas || []) {
    if (!g.lote || !g.grupo) continue;
    const id = String(g.id || '').replace(/^.*\//, '').replace(/\.ply$/, '');
    const d = Math.hypot(g.lote.x - cW.x, g.lote.z - cW.z), dP = Math.hypot(g.lote.x - Aw.x, g.lote.z - Aw.z);
    const lim = Math.max(g.lote.largo || 10, g.lote.ancho || 10) / 2 + 4;
    if (dP > lim + 6) continue;
    const pen = puerta.gen ? 0 : (EMBLEMA.test(id) ? 0 : 15);
    if (d + pen < mejor) { mejor = d + pen; gs = g; }
  }
  if (!gs) { console.info('vistaVentanas: sin edificio real para', sala.id); return null; }
  const caja = new THREE.Box3().setFromObject(gs.grupo);
  if (caja.isEmpty()) caja.setFromCenterAndSize(new THREE.Vector3(gs.lote.x, Aw.y + 6, gs.lote.z), new THREE.Vector3(gs.lote.largo || 10, 14, gs.lote.ancho || 10));
  const dentro = caja.clone(); dentro.min.x += 1.2; dentro.min.z += 1.2; dentro.max.x -= 1.2; dentro.max.z -= 1.2;
  if (dentro.min.x > dentro.max.x) dentro.min.x = dentro.max.x = (caja.min.x + caja.max.x) / 2;
  if (dentro.min.z > dentro.max.z) dentro.min.z = dentro.max.z = (caja.min.z + caja.max.z) / 2;
  cW.x = THREE.MathUtils.clamp(cW.x, dentro.min.x, dentro.max.x); cW.z = THREE.MathUtils.clamp(cW.z, dentro.min.z, dentro.max.z);
  // alturas de captura (marco de la sala) → mundo: una por fila de ventanas (kits) o por piso (interiores generados), máx. 3
  let ysL;
  if (sala.gen && sala.pisos) ysL = Array.from({ length: sala.pisos }, (_, f) => (sala.origen ? sala.origen.y : destino.y) + f * (sala.hp || 3) + 1.6);
  else ysL = filas(mallas).map(y => Math.max(y, destino.y + 1.4));
  if (!ysL.length) ysL = [destino.y + 1.6];
  const calidad = render.calidad || 'media', res = RES[calidad] || 512, max = calidad === 'movil' ? 1 : res >= 1024 ? 2 : 3;   // TIRONES-MOVIL: en el celular un solo cubo (cada uno son 6 dibujos de la ciudad en el cuadro de la puerta)
  if (ysL.length > max) { const a = ysL; ysL = max === 1 ? [a[0]] : max === 2 ? [a[0], a[a.length - 1]] : [a[0], a[Math.floor((a.length - 1) / 2)], a[a.length - 1]]; }
  // --- captura (fuera de todo render; se restaura todo en finally)
  const ren = render.renderer, esc = M.escena, ocultos = [];
  const ocultar = o => { if (o && o.visible) { o.visible = false; ocultos.push(o); } };
  for (const g of R.gaussianas) if (g.grupo && g.lote && (g === gs || (Math.hypot(g.lote.x - gs.lote.x, g.lote.z - gs.lote.z) < 0.5))) ocultar(g.grupo);
  ocultar(M.jug && M.jug.malla); ocultar(M.hercules && M.hercules.malla);
  for (const c of R.exterior.children) if (c.name === 'puertas_interiores') ocultar(c);
  esc.traverse(o => { if (o.isSparkRenderer || (o.constructor && o.constructor.name === 'SparkRenderer')) ocultar(o); });
  ocultar(globalThis.JUEGO && globalThis.JUEGO.spark);
  const somAuto = ren.shadowMap.autoUpdate, somNec = ren.shadowMap.needsUpdate;
  const cubos = [], distancias = [], centros = [], tiempos = [];
  try {
    ren.shadowMap.autoUpdate = false; ren.shadowMap.needsUpdate = false;
    for (const yL of ysL) {
      const rt = new THREE.WebGLCubeRenderTarget(res, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
      const cam = new THREE.CubeCamera(0.3, calidad === 'movil' ? 350 : render.lejos || 6000, rt);   // TIRONES-MOVIL: en el celular hasta 350 m (menos dibujos y texturas en el cuadro de la puerta)
      const C = new THREE.Vector3(cW.x, yL - Al.y + Aw.y, cW.z);
      cam.position.copy(C); cam.updateMatrixWorld(true);
      const tc = performance.now(); cam.update(ren, esc);
      // distancia desde C por dirección (canal rojo, filtrada): paralaje exacto con lo que está cerca (vecinos, barandas, escaleras)
      if (PARALAJE) {
        const rd = new THREE.WebGLCubeRenderTarget(res, { type: THREE.HalfFloatType, format: THREE.RedFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
        const camD = new THREE.CubeCamera(0.3, render.lejos || 6000, rd); camD.position.copy(C); camD.updateMatrixWorld(true); distancias.push(rd);
        const fondo = esc.background, ov = esc.overrideMaterial, cc = ren.getClearColor(new THREE.Color()), ca = ren.getClearAlpha();
        try { esc.background = null; esc.overrideMaterial = matDistancia(); ren.setClearColor(new THREE.Color(LEJOS, 0, 0), 1); camD.update(ren, esc); }
        finally { esc.background = fondo; esc.overrideMaterial = ov; ren.setClearColor(cc, ca); }
      }
      tiempos.push(Math.round(performance.now() - tc));
      cubos.push(rt); centros.push(C);
    }
  } catch (e) { console.warn('vistaVentanas: falló la captura', e); for (const rt of [...cubos, ...distancias]) rt.dispose(); cubos.length = 0; }
  finally {
    for (const o of ocultos) o.visible = true;
    ren.shadowMap.autoUpdate = somAuto; ren.shadowMap.needsUpdate = somNec;
  }
  if (!cubos.length) return null;
  const viejo = (M.def && M.def.epoca || 1940) < 1930 || /1905|piedra|hamilton/i.test(sala.nombre || '');
  const cine = /^cine/.test(sala.id);
  const U = {
    uCubo0: { value: cubos[0].texture }, uCubo1: { value: (cubos[1] || cubos[0]).texture }, uCubo2: { value: (cubos[2] || cubos[0]).texture },
    uDist0: { value: (distancias[0] || cubos[0]).texture }, uDist1: { value: (distancias[1] || distancias[0] || cubos[0]).texture }, uDist2: { value: (distancias[2] || distancias[0] || cubos[0]).texture },
    uC0: { value: centros[0] }, uC1: { value: centros[1] || centros[0] }, uC2: { value: centros[2] || centros[0] }, uNCubos: { value: cubos.length },
    uAl: { value: Al }, uAw: { value: Aw }, uRot: { value: rot },
    uCajaMin: { value: new THREE.Vector3(dentro.min.x - 1, caja.min.y - 2, dentro.min.z - 1) }, uCajaMax: { value: new THREE.Vector3(dentro.max.x + 1, caja.max.y + 2, dentro.max.z + 1) },
    uIter: { value: PARALAJE ? 4 : 0 }, uMezcla: { value: 0.7 }, uRmin: { value: 0 }, uLodD: { value: 2.5 },
    uCalle: { value: planoCalle(caja, Aw) }, uRadio: { value: 30 }, uLod: { value: viejo ? 0.5 : 0.25 },
    // vidrio: leve tinte (antiguo: verdoso cálido y algo más borroso); cine: vidrio oscuro de sala; + compensa la exposición baja de las salas (R-6)
    uTinte: { value: cine ? new THREE.Vector3(0.42, 0.46, 0.52) : viejo ? new THREE.Vector3(1.04, 1.08, 1.0) : new THREE.Vector3(1.08, 1.12, 1.14) },
  };
  const usados = new Map(), cambiadas = [];
  for (const o of mallas) {
    let mv = usados.get(o.material); if (!mv) { mv = materialVista(o.material, U); usados.set(o.material, mv); }
    cambiadas.push([o, o.material]); o.material = mv;
  }
  activo = { U, usados, sala, mallas: cambiadas, cubos: [...cubos, ...distancias], mats: [...usados.values()], ms: Math.round(performance.now() - t0), res, info: { tiempos, edificio: gs.id, lote: [gs.lote.x, gs.lote.z], th: +th.toFixed(3), alturas: centros.map(c => +c.y.toFixed(1)), Aw: Aw.toArray().map(v => +v.toFixed(1)), Al: Al.toArray().map(v => +v.toFixed(1)), C: centros[0].toArray().map(v => +v.toFixed(1)) } };
  return activo;
}

// plano de la calle: mínimos cuadrados y = a + b·x + c·z sobre el terreno en dos anillos alrededor del edificio (en ladera queda inclinado);
// nunca sobre el umbral de la puerta. Devuelve (n, w) con n·p = w
function planoCalle(caja, Aw) {
  const c = caja.getCenter(new THREE.Vector3()), r = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z) / 2;
  const P = [];
  for (const rr of [r + 2, r + 8]) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr; const y = altura(x, z); if (Number.isFinite(y)) P.push([x - c.x, y, z - c.z]); }
  let b = 0, cc = 0, a0 = Aw.y - 0.15;
  if (P.length >= 6) {   // normales 3x3
    let Sx = 0, Sz = 0, Sxx = 0, Szz = 0, Sxz = 0, Sy = 0, Sxy = 0, Szy = 0; const n = P.length;
    for (const [x, y, z] of P) { Sx += x; Sz += z; Sxx += x * x; Szz += z * z; Sxz += x * z; Sy += y; Sxy += x * y; Szy += z * y; }
    const A = new THREE.Matrix3().set(n, Sx, Sz, Sx, Sxx, Sxz, Sz, Sxz, Szz);
    if (Math.abs(A.determinant()) > 1e-6) { const v = new THREE.Vector3(Sy, Sxy, Szy).applyMatrix3(A.clone().invert()); a0 = v.x; b = THREE.MathUtils.clamp(v.y, -0.6, 0.6); cc = THREE.MathUtils.clamp(v.z, -0.6, 0.6); }
  }
  const enPuerta = a0 + b * (Aw.x - c.x) + cc * (Aw.z - c.z);
  if (enPuerta > Aw.y - 0.15) a0 -= enPuerta - (Aw.y - 0.15);
  // y = a0 + b(x-cx) + c(z-cz)  →  -b x + y - c z = a0 - b cx - c cz
  const nn = new THREE.Vector3(-b, 1, -cc), L = nn.length();
  return new THREE.Vector4(nn.x / L, nn.y / L, nn.z / L, (a0 - b * c.x - cc * c.z) / L);
}

export function salirVista() {
  if (!activo) return;
  for (const [o, m] of activo.mallas) o.material = m;
  for (const m of activo.mats) m.dispose();
  for (const rt of activo.cubos) rt.dispose();
  activo = null;
}
