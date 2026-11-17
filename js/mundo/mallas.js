// Mallas de TRELLIS.2 en lugar de las gaussianas de Idol (14-11-2026). Con ?malla=1, cada pieza que tenga malla en
// assets3d/trellis/indice.json (lo escribe el lote /mnt/gen5/trellis2/lote.py) se dibuja como malla en la MISMA caja que
// ocupaba su nube (las medidas «enderezadas» de splats.json: eje largo en X), así calza con podios, colisiones y puertas.
// En indice.json, «yaw» (grados) corrige una pieza que haya salido girada.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarEsq } from 'three/addons/utils/SkeletonUtils.js';
import { recortePiel, lodPiel } from '../motor/animMalla.js';   // N1-RENDIMIENTO (carril render): recorte por cámara del cóndor con esqueleto
import { edificioKit } from './kitSewell.js';
import { emblemaKit, clubAcceso, escuelaAcceso } from './kitEmblemas.js';   // N0-EMB

let INDICE = null;
// personajes con malla animada (los agrega la cadena /mnt/gen5/trellis2/hercules_cadena.sh en indice.json → _personajes)
export const PERSONAJES_MALLA = {};
export function ponerPersonajes(p) { Object.assign(PERSONAJES_MALLA, p || {}); }
const cache = {};

export function ponerIndiceMallas(indice, todo) { INDICE = indice; INDICE_TODO = todo || null; }
// índice completo (aunque no haya ?malla=1): para piezas que VIAJAN rápido (capacho). Spark muestra la nube ya ordenada,
// que llega varios cuadros tarde: el balde de gaussianas iba ~2 m detrás de Nato y él parecía colgar fuera del balde
let INDICE_TODO = null;
export function mallaMovil(sp) {
  if (!sp || !sp.url) return null;
  return mallaDe(sp) || (INDICE_TODO && INDICE_TODO[sp.url.split('/').pop().replace(/\.ply$/, '')]) || null;
}

// N4-C20 (kit Sewell): ?kit=1 muestra también los camarotes con el kit (piloto; sin la bandera solo el hospital y sus alas,
// que en indice.json llevan «kit» en vez de «glb»)
const KIT_URL = typeof location !== 'undefined' && new URLSearchParams(location.search).get('kit') === '1';
const SIN_KIT = typeof location !== 'undefined' && new URLSearchParams(location.search).get('kit') === '0';
// N0-KIT (carril kit, 14-11-2026; Diego aprobó el estilo del hospital 157 y pidió TODOS los edificios con el kit): niveles donde el
// kit es la ruta por omisión. construirNivel llama ponerNivelKit(def.numero). ?kit=0 vuelve a las mallas TRELLIS (comparar).
// Claves: nombre de la nube (splats.json). Opciones de edificioKit (KIT_SEWELL.md) + yaw (grados, frente del kit) y estas propias:
//   techoJuego: el techo a dos aguas calza con el colisionador de construir.js (cumbrera = alto, alero 2,95 m más abajo)
//   losaRel: techo plano con la losa caminable a esa fracción del alto (camarote_azotea: 0,95, como la colisión de edificioSplat)
let NIVEL_KIT = 0;
export function ponerNivelKit(n) { NIVEL_KIT = n; }
export function kitActivo() { return !SIN_KIT; }   // N2-C37: ?kit=0 vuelve a las mallas TRELLIS
const CAMAROTE = { camarote: true, techoJuego: true, zocalo: 0.45 };   // zócalo bajo: los 2 peldaños de la puerta quedan dentro del podio
// N1-KIT (14-11): Pueblo Hundido 1905 con el estilo '1905' del kit (piedra, tablas viejas, calamina gastada, ventanas de abatir)
const V1905 = { estilo: '1905', grupo: 0, anchoVentana: 1.15, altoVentana: 1.55, colorMolduras: 0xb59572, colorTecho: 0xb3aea4 };
// N0-EMB (14-11): edificios emblemáticos fieles a las fotos (js/mundo/kitEmblemas.js). Van en N2-N4; en N3/N4 solo estos (_solo: los
// camarotes de esos niveles siguen con su malla hasta que se pase el nivel entero). museo: true solo en una época actual (letrero del ed. 129)
const EMBLEMAS = { club: { forma: 'club20' }, escuela: { forma: 'escuela129' }, iglesia: { forma: 'iglesia231', alto: 12.5 } };
const KIT_NIVELES = {
  1: {
    // casas de piedra de Pueblo Hundido: un piso de mampostería, hastial de piedra, chimenea de piedra, puerta de tablas
    casa_piedra_v2: { ...V1905, muro: 'piedra', pisos: 1,   /* N1-INT1905b (15-11, Diego): un solo piso; principal.js le da alto 6,4 (alero ~3,5 m) */ techoJuego: true, puerta: true, chimeneas: 1, vano: 2.5, anchoVentana: 1.0, altoVentana: 1.35, zocalo: 0.35, colorPiedra: 0xd6cdbf },
    // panadería: piedra con hastial de tablas y chimenea del horno
    panaderia: { ...V1905, muro: 'piedra', piedraHasta: 3.0, color: 0x9a7350, pisos: 2, techoJuego: true, puerta: true, chimeneas: 1, vano: 2.5, anchoVentana: 1.1, altoVentana: 1.3, zocalo: 0.35, colorPiedra: 0xd8cfc0 },
    // casa Hamilton: planta baja de piedra, segundo piso de tablas, techo empinado con dos chimeneas (sin estirar: caja del modelo, 13,9 × 14 × 8,5)
    casa_hamilton_v3b: { ...V1905, muro: 'piedra', piedraHasta: 4.5, color: 0x7d5b3e, colorPiedra: 0xcfc6b8, pisos: 2, pendiente: 1.0, chimeneas: 2, puerta: true, vano: 2.3 /* N1-HAMILTON-c (casa agrandada a 17 m): con 2,1 las ventanas del frente caían detrás del letrero (más ancho) */, anchoVentana: 1.0, zocalo: 0.6 },
    // camarote de 1905: tablas viejas, dos pisos, chimeneas de lata
    camarote1905_v2: { ...V1905, color: 0x9a5c3c, pisos: 2, techoJuego: true, puerta: true, chimeneas: 2, chimenea: 'lata', vano: 2.4, zocalo: 0.6 },
    // molino: planta baja de piedra y tres pisos de tablas oscuras, calamina gris
    molino_v2b: { ...V1905, muro: 'piedra', piedraHasta: 4.6, color: 0x7a6656, colorPiedra: 0xc4bbae, pisos: 4, techoJuego: true, chimeneas: 2, chimenea: 'lata', puerta: true, vano: 2.6, anchoVentana: 1.3, zocalo: 0.6, colorTecho: 0x8e8a84 },
    estacion: { ...V1905, yaw: 180, pisos: 1, vano: 2.6, altoVentana: 1.9, techoJuego: true, chimeneas: 1, chimenea: 'lata', puerta: true, corredor: 2.4, zocalo: 0.6 },
    taller_largo_v2e: { ...V1905, color: 0x9a4a32, yaw: 180, pisos: 2, vano: 3, anchoVentana: 1.6, techoJuego: true, chimeneas: 2, chimenea: 'lata', puerta: true, zocalo: 0.6 },
  },
  2: {
    // N2-C32: sala larga de madera de un piso alto (pista de 46 m), ventanas altas en fila entre pilastras, zinc a dos aguas y la
    // entrada al centro del frente (cortavientos + letrero BOWLING de construir.js sobre muro liso)
    palitroque: { pisos: 1, altoVentana: 2.7, antepecho: 2.5, anchoVentana: 1.15, vano: 2.6, panos: 6, grupo: 1, libreCentro: 5.6, zocalo: 0.9, techoJuego: true, chimeneas: 0 },
    // N2-C33: Teatro de Sewell (edificio 165) fiel al plano M-1342 de 1937 y a la foto de la fachada (kitSewell.js cine165)
    cine: { forma: 'cine165', puertaPropia: true, colorTecho: 0x9b9c9a, marquesina: { y: 4.9, alto: 1.6, ancho: 6.4, sale: 0.55 } },
    pulperia: { pisos: 5, panos: 2, grupo: 4, cintas: true, techoJuego: true, chimeneas: 2, balcones: 0 },
    correos: { pisos: 3, panos: 6, grupo: 3, cintas: true, techoJuego: true, chimeneas: 1, puerta: true },
    ...EMBLEMAS,   // N0-EMB: club = Teniente Club (ed. 20), escuela = Escuela Industrial (ed. 129), iglesia (ed. 231)
    estacion: { yaw: 180, pisos: 1, panos: 6, grupo: 0, vano: 2.6, altoVentana: 2.2, techoJuego: true, chimeneas: 1, puerta: true, corredor: 2.4, zocalo: 0.6 },   // galería de pilares hacia el andén (como la estación real)
    taller_largo_v2e: { yaw: 180, pisos: 2, panos: 6, grupo: 3, vano: 3, anchoVentana: 1.5, techoJuego: true, chimeneas: 0, colorMolduras: 0xd9d4c6 },
    taller: { pisos: 2, panos: 6, grupo: 3, vano: 3, anchoVentana: 1.5, techoJuego: true, chimeneas: 2, colorMolduras: 0xd9d4c6 },
    concentradora: { pisos: 3, panos: 6, grupo: 4, vano: 3.2, anchoVentana: 1.6, techoJuego: true, chimeneas: 3, colorMolduras: 0xc9c4b6 },
    camarote_azotea: { camarote: true, techo: 'plano', losaRel: 0.95, chimeneas: 0, zocalo: 0.45 },
  },
};
// N3-KIT / N4-KIT (14-11, ronda 4): mismos edificios que el N2 (las claves son nubes del mismo catálogo); N4 suma el taller de 1967
KIT_NIVELES[3] = { ...KIT_NIVELES[2] };
KIT_NIVELES[4] = { ...KIT_NIVELES[2], taller_n4: { pisos: 1, antepecho: 5.3, altoVentana: 1.4, panos: 6, grupo: 0, vano: 3.6, anchoVentana: 2.0, portones: 4, color: 0xb7bbbe, colorTecho: 0x8f9398, colorMolduras: 0xd0d2d0, techoJuego: true, chimeneas: 0 } };   // 1967: nave de chapa gris con 4 portones };
export function kitNivel(nombre) {
  const t = !SIN_KIT && KIT_NIVELES[NIVEL_KIT];
  if (!t) return null;
  return t[nombre] || (!t._solo && /^camarote_(?!azotea)/.test(nombre) ? CAMAROTE : null);
}
export function mallaDe(sp) {
  if (!INDICE || !sp || !sp.url) return null;
  const nombre = sp.url.split('/').pop().replace(/\.ply$/, '');
  { const k = kitNivel(nombre); if (k) return { kit: k, yaw: k.yaw || 0, tipo: 'kit' }; }   // N0-KIT: el kit por omisión en este nivel
  if (KIT_URL && /^camarote(?!_azotea)/.test(nombre)) return { kit: { camarote: true } };
  const r = INDICE[nombre] || null;
  if (r && r.kit && r.glb_trellis && SIN_KIT) return { ...r, kit: null, glb: r.glb_trellis };   // ?kit=0: la malla TRELLIS de antes (comparar)
  return r;
}

const KIT_HECHO = new WeakMap();   // lote → R.exterior donde ya se armó su kit (hileras: un solo edificio por lote)
// opciones del kit: las del índice + lo que dice el lote (color, techo, número, puerta). Caja en metros del mundo.
function opcionesKit(k, e, L, H, W) {
  const o = { ...k, largo: L, alto: H, ancho: W };
  delete o.yaw; delete o.alto; o.alto = H;
  if (o.techoJuego) { o.yCumbrera ??= H - 0.2; o.pendiente ??= 5.4 / W; }   // N0-KIT: zinc ~a ras del colisionador a dos aguas (cumbrera = alto, alero −2,95 m)
  if (o.losaRel) o.yLosa ??= H * o.losaRel;
  if (e) {
    o.color ??= e.color; o.semilla ??= Math.round(Math.abs(e.x * 73.1 + e.z * 19.7));
    o.colorTecho ??= e.techoColor ?? [0xa8432f, 0x9c3a2c, 0xb24a32, 0x4f7a4a, 0x6d7275][o.semilla % 5];   // zinc rojo (lo más común en Sewell), verde o gris
    if (!o.techo) o.techo = e.techo === 'artdeco' ? 'artdeco' : e.techo === 'plano' || e.azotea ? 'plano' : 'dos';
    if (e.puerta && o.porche == null) o.porche = true;   // construir.js pone el cortavientos con la puerta de la sala
    if (e.numero && o.letrero == null) o.letrero = {};
    if (o.forma === 'escuela129' && e._escFis && e._escFis.tur) o.museo = true;   // N2-ESCUELA: en el modo turista, letrero del museo (fachada)
    if (e.nombre && o.estilo === '1905') o.cartel ??= { u: Math.min(12, L * 1.03 * 0.42) / 2 + 0.25, v0: 2.7, v1: 5.5 };   // N1-KIT: sin ventanas tras el letrero (construir.js)
    if (k.camarote) {   // camarotes: pisos del lote y algo de variedad estable por posición (balcones, escalera de incendio, chimeneas)
      o.pisos ??= Math.max(2, Math.min(6, Math.round((H - 4.6) / 3.2)));
      const r = o.semilla % 7;
      o.puerta ??= !o.porche; o.balcones ??= r < 2 ? 4 : 0; o.escaleraIncendio ??= o.pisos >= 4 && r >= 4 ? (r % 2 ? 'este' : 'oeste') : null; o.chimeneas ??= L > 20 ? 2 : 1;
      // N0-EMB: tipos de las fotos de Diego para variar la ciudad (estable por posición): vivienda obrera 035 (plancha acanalada verde
      // agua, lucarnas, corredores en el testero), vivienda de empleados (estucado, ventanas pareadas, pórtico rojo) y oficina de
      // ingeniería (tablas amarillo pálido, galería de columnas, zócalo verde agua). El resto, el camarote de tablas de siempre.
      const tipo = Math.floor(o.semilla / 7) % 6, verdeAgua = 0x86d6c2;
      if (tipo === 0 && !o.techo.startsWith('p')) Object.assign(o, { muro: 'acanalada', color: o.semilla % 3 ? verdeAgua : o.color, colorTecho: 0xb8302a, lucarnas: true, corredorTestero: r % 2 ? 'este' : 'oeste', escaleraIncendio: null, balcones: 0, grupo: 0, anchoVentana: 0.9, altoVentana: 1.15, vano: 1.9, placa: 'EDIF-0' + String(10 + o.semilla % 90) + '-P' });
      else if (tipo === 1) Object.assign(o, { muro: 'estuco', colorEstuco: o.semilla % 3 ? verdeAgua : o.color, colorTecho: 0xb8302a, pareadas: true, vano: 3.0, anchoVentana: 0.85, grupo: 0, balcones: 0, portico: o.puerta ? true : null, chimeneas: 1 });
      else if (tipo === 2 && o.pisos <= 4) Object.assign(o, { color: 0xeee2a4, colorZocalo: verdeAgua, porcheBajo: o.porche ? 0 : 2.4, corredor: o.porche ? 2.2 : 0, grupo: 0, cintas: true, balcones: 0, colorTecho: o.semilla % 2 ? 0xb8302a : 0xd8d2c0, chimeneas: 1 });
    }
  }
  if (NIVEL_KIT === 3 && !o.forma && !o.techo?.startsWith('p')) o.colorTecho = 0xe4e9f0;   // N3 invierno 1945: nieve sobre el zinc
  return o;
}

// N1-R2 (14-11): baja el .glb de una pieza antes de usarla (el tren del final del N1 se crea a 115 m y sus carros llegaban sin
// cuerpo ni ruedas 1-3 s, mientras bajaba la malla: solo se veían los enganches, a +0,8 m del riel). Comparte la caché de grupoMalla.
export function precargarMalla(info) {
  if (info && info.glb) (cache[info.glb] ||= new GLTFLoader().loadAsync(info.glb)).catch(() => {});
}

// Grupo para el marco «afuera» de la pieza (el mismo donde va la nube ya dada vuelta): la malla ocupa
// X [x0, x1], Y [-y1, -y0], Z [-z1, -z0], igual que las gaussianas
export function grupoMalla(info, sp, e) {
  const [x0, y0, z0] = sp.min, [x1, y1, z1] = sp.max;
  const g = new THREE.Group(); g.name = 'malla_trellis';
  if (info.kit) {   // N4-C20: edificio del kit Sewell en la misma caja. La escala del padre («afuera») se fija justo después de
    // agregar este grupo: se arma en la siguiente vuelta, en metros reales, y se deshace esa escala (sin estirar nada)
    Promise.resolve().then(() => {
      const af = g.parent, s = af ? af.scale : new THREE.Vector3(1, 1, 1);
      let L = (x1 - x0) * s.x, H = (y1 - y0) * s.y, W = (z1 - z0) * s.z, cx = (x0 + x1) / 2, cz = -(z0 + z1) / 2;
      // hileras (lotes largos en varios módulos traslapados): el kit es UN edificio del largo del lote; lo arma el 1.er módulo
      if (e && af && e.largo && e.ancho && sp.estirar) {   // (sin estirar —cine, pulpería— la caja es la del modelo, igual que el podio)
        if (af.parent && KIT_HECHO.get(e) === af.parent) return;
        if (af.parent) KIT_HECHO.set(e, af.parent);
        L = Math.max(e.largo, e.ancho); W = Math.min(e.largo, e.ancho);
        af.updateMatrix();
        const c = new THREE.Vector3(e.x, af.position.y, e.z).applyMatrix4(af.matrix.clone().invert());
        cx = c.x; cz = c.z;
      }
      const ok = opcionesKit(info.kit, e, L, H, W), kit = emblemaKit(ok) || edificioKit(ok);   // N0-EMB: formas emblemáticas
      if (info.yaw) kit.rotation.y = info.yaw * Math.PI / 180;
      const h = new THREE.Group(); h.add(kit);
      if (e && e._clubFis && kit.userData.kit && kit.userData.kit.acc) clubAcceso(e._clubFis, kit.userData.kit.acc);   // N2-C38: pórtico y escalera caminables, puerta arriba
      if (e && e._escFis && kit.userData.kit && kit.userData.kit.accE) escuelaAcceso(e._escFis, kit.userData.kit.accE);   // N2-PUERTAS-EMB: escalera lateral caminable y puerta en el descanso
      h.scale.set(1 / s.x, 1 / s.y, 1 / s.z); h.position.set(cx, -y1, cz);
      g.add(h);
    }).catch(err => console.warn('kit', err));
    return g;
  }
  (cache[info.glb] ||= new GLTFLoader().loadAsync(info.glb)).then(gltf => {
    const esc = gltf.scene.clone(true);
    const r = new THREE.Group(); r.add(esc);
    let yaw = (info.yaw || 0) * Math.PI / 180;
    // N1-C54: con un yaw que no es múltiplo de 90° la caja rápida (esquinas de la caja de la geometría, giradas) queda inflada y la
    // pieza se aplastaba al meterla en la caja de la nube (la locomotora, diagonal en su .glb, salía plana): ahí se mide vértice a vértice
    const fino = Math.abs(Math.sin(2 * (info.yaw || 0) * Math.PI / 180)) > 1e-3;
    const t0 = new THREE.Box3().setFromObject(esc).getSize(new THREE.Vector3());
    if (!info.yaw && t0.z > t0.x * 1.15) yaw += Math.PI / 2;   // el modelo de Idol va con el eje largo en X
    r.rotation.y = yaw; r.updateMatrixWorld(true);
    const t = new THREE.Box3().setFromObject(r, fino).getSize(new THREE.Vector3());
    const h = new THREE.Group(); h.add(r);
    h.scale.set((x1 - x0) / t.x, (y1 - y0) / t.y, (z1 - z0) / t.z);
    h.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(h, fino);
    h.position.set(x0 - c.min.x, -y1 - c.min.y, -z1 - c.min.z);
    esc.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const m = o.material;
      if (m) { m.side = THREE.DoubleSide; m.metalness = 0; for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k].anisotropy = 16; m[k].needsUpdate = true; } m.needsUpdate = true; }   // R-1: anisotropía máxima en las fachadas de malla   // paredes delgadas: se ven por ambos lados (sin «agujeros»)
    });
    g.add(h);
  }).catch(e => console.warn('malla', info.glb, e));
  return g;
}

// ===== cóndor andino MALLA (G-CONDOR, 14-11-2026; blender/condor_malla.py) =====
// Dos mallas de TRELLIS.2 con esqueleto: en vuelo (3 m de envergadura; planeo, aleteo, picada, chillido) y posado (1,30 m;
// posado, posado_chillido). Mismo marco que el cóndor de siempre (mallaCondor): pico hacia +Z, alas en X, origen en el centro
// del cuerpo; posado con las patas 0,5·esc bajo el origen (el jefe se posa a 1,2 m sobre el nido con esc 2,4).
// g.userData.condor = { tocar(nombre, vel), actualizar(dt), actual }: cambia sola entre la malla de vuelo y la de posado.
const GLTF_CONDOR = {};
// ===== A-CONDOR3: cara del cóndor GIGANTE (el villano que secuestra a Pedro) =====
// Cabeza y cuello rojos van pintados en la textura (herramientas/condor_gigante.py). Aquí se agregan al hueso «cabeza» las piezas que hacen
// legible la cara: pico con gancho y mandíbula (se abre al chillar), ojos ámbar con brillo, cejas oscuras caídas, cresta y papada rojas.
// Marco de la cara: origen en la punta del pico, +Z hacia adelante, +Y arriba (en unidades del .glb: la cabeza mide ~0,18).
const CARA = {
  vuelo:  { T: [0, 0.045, 0.704], C: [0.002, 0.05, 0.613], ex: 0.058, ey: 0.026, ez: -0.075, pit: 0.45, dy: -0.03 },
  posado: { T: [0.006, 1.13, 0.654], C: [0.006, 1.208, 0.527], ex: 0.040, ey: 0.026, ez: -0.075, pit: 0.45, dy: -0.03 },
};
function caraGigante(e, cual, st) {
  const c = CARA[cual]; let hueso = null; e.traverse(o => { if (o.isBone && o.name === 'cabeza') hueso = o; }); if (!hueso) return;
  const T = new THREE.Vector3(...c.T), f = new THREE.Vector3(0, c.T[1] - c.C[1], c.T[2] - c.C[2]).normalize(), u = new THREE.Vector3(0, f.z, -f.y);
  const marco = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), u, f).setPosition(T);
  e.updateMatrixWorld(true);
  let sm = null; e.traverse(o => { if (o.isSkinnedMesh && !sm) sm = o; }); const ib = sm ? sm.skeleton.bones.indexOf(hueso) : -1; if (ib < 0) return;
  (st.huesos ||= []).push({ b: hueso, k: 0.4 }); e.traverse(o => { if (o.isBone && o.name === 'cuello') st.huesos.push({ b: o, k: 0.6 }); });
  const cara = new THREE.Group(); cara.matrixAutoUpdate = false;
  cara.matrix.copy(sm.skeleton.boneInverses[ib]).multiply(sm.bindMatrix).multiply(marco);   // posición en el espacio de la malla -> hueso (como un vértice con peso 1)
  const mat = (col, em = 0.25, rug = 0.55) => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: em, roughness: rug, metalness: 0 });
  const roj = mat(0xd4140f, 0.35), rojOsc = mat(0x7a0707, 0.3), pico = mat(0xe6dcc2, 0.28, 0.4), pupila = new THREE.MeshBasicMaterial({ color: 0x050202 }), iris = new THREE.MeshBasicMaterial({ color: 0xffb11a }), brillo = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0, padre = cara) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, 0, rz); o.castShadow = false; o.frustumCulled = false; padre.add(o); return o; };
  const esf = new THREE.SphereGeometry(1, 20, 14), cono = new THREE.ConeGeometry(1, 1, 16, 1); cono.rotateX(Math.PI / 2);   // cono: base en -Z, punta en +Z (largo 1, radio 1)
  // pico superior: cuerpo + gancho hacia abajo en la punta
  const bk = new THREE.Group(); bk.rotation.x = c.pit; bk.position.y = c.dy; cara.add(bk);   // el hocico de la malla mira algo hacia abajo
  add(cono, pico, 0, 0.012, -0.03, 0.044, 0.04, 0.17, 0, 0, bk);
  add(cono, pico, 0, -0.008, 0.045, 0.024, 0.024, 0.08, 0.95, 0, bk);
  // mandíbula: pivota en la comisura; abierta se ve el interior rojo oscuro
  const jaw = new THREE.Group(); jaw.position.set(0, -0.022, -0.085); bk.add(jaw);
  add(cono, pico, 0, -0.004, 0.05, 0.036, 0.022, 0.15, 0, 0, jaw);
  add(cono, rojOsc, 0, 0.007, 0.048, 0.032, 0.013, 0.13, 0, 0, jaw);
  (st.mandibulas ||= []).push(jaw);
  // ojos: iris ámbar, pupila, brillo; ceja oscura inclinada sobre cada ojo (mirada amenazante)
  for (const s of [-1, 1]) {
    const ox = s * c.ex, oy = c.ey, oz = c.ez;
    add(esf, iris, ox, oy, oz, 0.026, 0.026, 0.026);
    add(esf, pupila, ox + s * 0.008, oy, oz + 0.016, 0.014, 0.014, 0.011);
    add(esf, brillo, ox + s * 0.011, oy + 0.01, oz + 0.026, 0.006, 0.006, 0.006);
    add(new THREE.BoxGeometry(0.02, 0.016, 0.085), rojOsc, ox - s * 0.002, oy + 0.032, oz + 0.004, 1, 1, 1, 0.5, -s * 0.18);
  }
  // cresta (carúncula) desde la base del pico hasta la coronilla, y papada colgante
  add(esf, roj, 0, 0.082, -0.075, 0.013, 0.026, 0.07, 0.45);
  add(esf, roj, 0, 0.045, -0.04, 0.017, 0.02, 0.026);
  add(esf, rojOsc, 0, -0.105, -0.09, 0.013, 0.032, 0.02);
  hueso.add(cara); st.cara = cara;
}

export function condorMalla(esc = 1, gigante = false) {   // A-CONDOR3: gigante = cabeza roja + cara expresiva (condor_gigante_*.glb)
  const g = new THREE.Group(); g.name = 'condor_malla';
  const vuelo = new THREE.Group(), posado = new THREE.Group();
  vuelo.scale.setScalar(esc); posado.scale.setScalar(esc); posado.position.y = -0.5 * esc; posado.visible = false;
  g.add(vuelo, posado);
  const st = { mixers: [], acc: {}, actual: null, nombre: '', pend: 'planeo', vel: 1 };
  const UNA = new Set(['chillido', 'posado_chillido']);
  const tocar = (n, vel = 1) => {
    st.pend = n; st.vel = vel; const x = st.acc[n]; if (!x) return;
    x.a.timeScale = vel;
    if (n === st.nombre) return;
    x.a.reset(); x.a.setLoop(UNA.has(n) ? THREE.LoopOnce : THREE.LoopRepeat); x.a.clampWhenFinished = true; x.a.play();
    const prev = st.actual;
    if (prev && prev.dest === x.dest) prev.a.crossFadeTo(x.a, 0.3, false); else if (prev) prev.a.stop();
    vuelo.visible = x.dest === vuelo; posado.visible = !vuelo.visible;
    st.actual = x; st.nombre = n;
  };
  const cargar = (url, dest) => (GLTF_CONDOR[url] ||= new GLTFLoader().loadAsync(url)).then(gltf => {
    const e = clonarEsq(gltf.scene);
    e.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;   // la caja de una malla con esqueleto no sigue la animación
      const m = o.material = o.material.clone();
      if (m.isMeshStandardMaterial) {   // plumas finas: por los dos lados; brillo propio suave (negro sobre cielo: sin esto, una mancha sin detalle)
        m.side = THREE.DoubleSide; m.emissiveMap = m.map; m.emissive = new THREE.Color(0.2, 0.2, 0.2); m.metalness = 0; m.roughness = Math.max(0.7, m.roughness ?? 0.8); m.needsUpdate = true;
      }
    });
    recortePiel(e, 2.2); lodPiel(e);   // N1-RENDIMIENTO (carril render, 15-11): antes frustumCulled = false (~75 mil triángulos por cóndor, dibujados siempre)
    dest.add(e);
    if (gigante) caraGigante(e, dest === vuelo ? 'vuelo' : 'posado', st);
    const mx = new THREE.AnimationMixer(e); st.mixers.push(mx);
    for (const c of gltf.animations) st.acc[c.name] = { a: mx.clipAction(c), dest };
  });
  g.userData.condor = {
    tocar, actualizar: dt => {
      const hs = st.huesos || [];   // A-CONDOR3: «mira» (rad): baja cuello y cabeza hacia lo que mira (el gigante mira a Pedro); se deshace antes de animar
      for (const h of hs) if (h.ex) { h.b.quaternion.multiply(h.ex.clone().invert()); h.ex = null; }
      for (const m of st.mixers) m.update(dt);
      if (st.mira) for (const h of hs) { h.ex = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), st.mira * h.k); h.b.quaternion.multiply(h.ex); }
      for (const m of st.mandibulas || []) {   // pico del gigante: entreabierto; se abre más al chillar
        const chill = st.nombre === 'chillido' || st.nombre === 'posado_chillido', ob = st.pico ?? (chill ? 0.62 : 0.16);
        m.rotation.x += (ob - m.rotation.x) * Math.min(1, dt * 9);
      }
    },
    get actual() { return st.nombre; },
    set pico(v) { st.pico = v; }, set mira(v) { st.mira = v; },   // A-CONDOR3: apertura del pico del gigante (rad); sin valor: se abre solo al chillar
    listo: Promise.all([cargar(gigante ? PERSONAJES_MALLA.condor_gigante_vuelo || PERSONAJES_MALLA.condor_vuelo : PERSONAJES_MALLA.condor_vuelo, vuelo), cargar(gigante ? PERSONAJES_MALLA.condor_gigante_posado || PERSONAJES_MALLA.condor_posado : PERSONAJES_MALLA.condor_posado, posado)])
      .then(() => { st.nombre = ''; tocar(st.pend, st.vel); }).catch(e => console.warn('cóndor malla', e)),
  };
  return g;
}
