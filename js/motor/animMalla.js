// Nato como MALLA animada (14-11-2026): malla de TRELLIS.2 con el mismo esqueleto y las mismas acciones que el Nato de gaussianas
// (blender/nato_malla.py -> assets3d/anim/nato_malla.glb). Misma interfaz que animSplat: tocar, actualizar, nombres, actual, tiempo.
// La malla se dobla perfecto con su esqueleto (sin el efecto «de goma» ni el deshilachado de las gaussianas), recibe la luz del sol
// y proyecta sombra.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarEsq } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptSimplifier } from '../../lib/meshopt/meshopt_simplifier.module.js';   // N1-RENDIMIENTO: meshoptimizer 0.18.1 (MIT, zeux)

const UNA_VEZ = new Set(['saltar', 'doble', 'aterrizar', 'jab', 'recto', 'golpe', 'golpe2', 'giratoria', 'gancho', 'patada', 'herido', 'recoger', 'sentado', 'ko', 'levantarse', 'puno', 'pisoton', 'rendicion', 'jefe_senalar', 'entregar', 'celebrar']);   // G-A8/G-A9
const FASE = { caminar: 0, correr: 0.5, trotar: 0.5, correr_subir: 0.5 };   // A-CORRER: trotar y correr_subir (blender/carrera.py) parten con el apoyo derecho, como correr   // fase del paso al inicio de cada ciclo (ver animSplat.js)

// G-A13: { compartir: true } = un solo GLB (geometría, texturas y materiales) para todas las copias (mineros): cada una es un clon con su esqueleto y su mezclador
const COMPARTIDA = {};
export async function cargarMalla(url, op = {}) {
  if (!SIN_LOD) await MeshoptSimplifier.ready.catch(() => {});
  if (op.compartir) {
    const gltf = await (COMPARTIDA[url] ||= new GLTFLoader().loadAsync(url).then(g => { preparar(g.scene); return g; }));
    if (!gltf.__lod) { gltf.__lod = true; gltf.scene.traverse(o => { if (o.isSkinnedMesh) lodGeometria(o.geometry); }); }
    const r = armar(gltf, clonarEsq(gltf.scene), []); registrarLod(r.escena); return r;   // N1-RENDIMIENTO: LOD solo en los compartidos (vecinos y mineros), nunca Nato, Hércules ni el jefe
  }
  const gltf = await new GLTFLoader().loadAsync(url);
  return armar(gltf, gltf.scene, preparar(gltf.scene));
}
// N1-RENDIMIENTO (carril render, 15-11): las mallas con esqueleto iban con frustumCulled = false (cada copia de ~75-80 mil triángulos
// se dibujaba SIEMPRE, también detrás de la cámara o a 400 m fuera de cuadro, y otra vez en el mapa de sombras). Ahora se recortan con
// una esfera holgada: la de la pose de reposo ×1,8 (cubre brazos abiertos, saltos y caer de espaldas). La copia la hereda (SkinnedMesh.copy).
// ?recorte=0 vuelve a dibujarlas siempre.
const SIN_RECORTE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('recorte') === '0';
export function recortePiel(escena, holgura = 1.8) {
  if (SIN_RECORTE) return;
  escena.updateMatrixWorld(true);
  escena.traverse(o => {
    if (!o.isSkinnedMesh || !o.skeleton) return;
    try { o.skeleton.update(); o.computeBoundingSphere(); } catch (e) { return; }
    if (!(o.boundingSphere.radius > 0) || !isFinite(o.boundingSphere.radius)) { o.boundingSphere = null; return; }
    o.boundingSphere.radius *= holgura; o.frustumCulled = true;
  });
}
// N1-RENDIMIENTO (carril render, 15-11): LOD de las mallas con esqueleto. Cada personaje TRELLIS trae ~75-80 mil triángulos (con
// skinning, y otra vez en la sombra): 11 vecinos a < 50 m eran ~1 M de triángulos por pasada en el Pueblo Hundido. Se simplifica SOLO el
// índice (meshoptimizer, una vez por GLB al cargar): los niveles comparten vértices, pesos, UV y material, así que la textura, el color de
// variacionNPC y la animación son los mismos. Nivel por tamaño en pantalla (alto del personaje en píxeles, con histéresis):
// ≥ 260 px malla completa (Nato y Hércules casi siempre) · 260-90 px 30 % (~24 mil) · < 90 px 9 % (~7 mil; ≈ 30 m). ?lodpiel=0 lo apaga.
const SIN_LOD = typeof location !== 'undefined' && new URLSearchParams(location.search).get('lodpiel') === '0';
const LOD_PIEL = new WeakMap(), PIEL_LOD = new Set(), ESTADO_LOD = new WeakMap();   // estado por malla fuera de userData (Object3D.copy lo pasa por JSON)
const LOD_FR = [1, 0.3, 0.09], LOD_PX = [260, 90];
function lodGeometria(g) {
  if (SIN_LOD || LOD_PIEL.has(g) || !g.index || !g.attributes.position) return;
  try {
    const p = g.attributes.position, n = p.count, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = p.getX(i); pos[i * 3 + 1] = p.getY(i); pos[i * 3 + 2] = p.getZ(i); }
    const idx = new Uint32Array(g.index.array), lods = [g];
    for (const f of LOD_FR.slice(1)) {
      const [nuevo] = MeshoptSimplifier.simplify(idx, pos, 3, Math.floor(idx.length * f / 3) * 3, 0.05, ['LockBorder']);   // bordes fijos: las costuras de UV de TRELLIS no están soldadas (sin esto, manchas de otra isla de textura)
      const h = new THREE.BufferGeometry(); h.attributes = g.attributes;   // MISMO objeto: lo que se agregue después (vzona de variacionNPC) también vale aquí
      h.morphAttributes = g.morphAttributes; h.setIndex(new THREE.BufferAttribute(nuevo, 1));
      h.boundingBox = g.boundingBox; h.boundingSphere = g.boundingSphere; h.name = (g.name || 'piel') + '_lod';
      lods.push(h);
    }
    for (const h of lods) LOD_PIEL.set(h, lods);   // también los niveles bajos: un clon hecho en pleno LOD encuentra su malla completa
  } catch (e) { console.warn('LOD de piel:', e); }
}
// cada cuadro antes de dibujar (render.js): elige el nivel de cada malla con esqueleto viva según su alto en pantalla
let _podar = 0; const _w = new THREE.Vector3(), _s = new THREE.Vector3();
export function lodPielCuadro(camara, altoPx) {
  if (!PIEL_LOD.size) return;
  const k = altoPx / (2 * Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2) * (camara.zoom || 1)), cp = camara.position, poda = ++_podar % 120 === 0;
  for (const o of PIEL_LOD) {
    if (poda) { let r = o; while (r.parent) r = r.parent; if (!r.isScene) { PIEL_LOD.delete(o); continue; } }
    const L = ESTADO_LOD.get(o); if (!L) { PIEL_LOD.delete(o); continue; }
    o.getWorldPosition(_w); o.getWorldScale(_s);
    const px = L.alto * Math.abs(_s.y) * k / Math.max(0.1, _w.distanceTo(cp));
    let n = L.n;
    if (globalThis.__forzarLod != null) n = Math.min(globalThis.__forzarLod, L.geos.length - 1); else {
    while (n > 0 && px > LOD_PX[n - 1] * 1.12) n--;   // acercarse: sube de detalle (histéresis 12 %)
    while (n < 2 && px < LOD_PX[n]) n++; }
    if (n !== L.n) { L.n = n; o.geometry = L.geos[n]; }
  }
}
export function lodPiel(escena) { escena.traverse(o => { if (o.isSkinnedMesh) lodGeometria(o.geometry); }); registrarLod(escena); }   // para mallas cargadas aparte (cóndor)
function registrarLod(escena) {
  if (SIN_LOD) return;
  escena.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const geos = LOD_PIEL.get(o.geometry); if (!geos) return; const base = geos[0];
    const bs = base.boundingSphere || (base.computeBoundingSphere(), base.boundingSphere);
    ESTADO_LOD.set(o, { geos, n: 0, alto: bs.radius * 2 });
    o.geometry = geos[0]; PIEL_LOD.add(o);
  });
}
function preparar(escena) {
  const tintes = [];
  escena.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;   // la caja de una malla con esqueleto no sigue la animación
    const m = o.material;
    if (m && m.isMeshStandardMaterial) {
      // luz de personaje: un brillo propio suave con su misma textura (la cara no queda negra a contraluz) y material mate
      m.emissiveMap = m.map; m.emissive = new THREE.Color(0.22, 0.22, 0.22); m.emissiveIntensity = 1;
      m.metalness = 0; m.roughness = Math.max(0.65, m.roughness ?? 0.8); m.needsUpdate = true;
    }
    // N1-C42: tinte de chaqueta (torso y brazos): peso de esos huesos por vértice → atributo «chaq»; el shader mezcla hacia uTinte
    if (o.isSkinnedMesh && m && m.isMeshStandardMaterial && o.skeleton) {
      const idx = new Set(o.skeleton.bones.map((b, i) => (/^(spine|chest|clav|uparm|forearm)/.test(b.name) ? i : -1)).filter(i => i >= 0));
      const ge = o.geometry, si = ge.attributes.skinIndex, sw = ge.attributes.skinWeight;
      if (idx.size && si && sw) {
        const c = new Float32Array(si.count);
        for (let v = 0; v < si.count; v++) { let s = 0; for (let k = 0; k < 4; k++) if (idx.has(si.getComponent(v, k))) s += sw.getComponent(v, k); c[v] = Math.min(1, s * 1.15); }
        ge.setAttribute('chaq', new THREE.BufferAttribute(c, 1));
        const u = { uTinte: { value: new THREE.Color(0xd27a3a) }, uTinteK: { value: 0 } }; tintes.push(u);
        m.onBeforeCompile = sh => {
          Object.assign(sh.uniforms, u);
          sh.vertexShader = 'attribute float chaq;\nvarying float vChaq;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvChaq = chaq;');
          sh.fragmentShader = 'uniform vec3 uTinte;\nuniform float uTinteK;\nvarying float vChaq;\n' + sh.fragmentShader
            .replace('#include <map_fragment>', '#include <map_fragment>\nfloat kC = uTinteK * smoothstep(0.35, 0.8, vChaq); vec3 tinteC = uTinte * (0.35 + 1.2 * dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));\ndiffuseColor.rgb = mix(diffuseColor.rgb, tinteC, kC);')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = mix(totalEmissiveRadiance, emissive * tinteC, kC);');
        };
        m.customProgramCacheKey = () => 'chaqueta'; m.needsUpdate = true;
      }
    }
  });
  recortePiel(escena);
  return tintes;
}
function armar(gltf, escena, tintes) {
  const mixer = new THREE.AnimationMixer(escena);
  const acciones = {}; for (const clip of gltf.animations) acciones[clip.name] = mixer.clipAction(clip);
  let actual = null, nombreActual = '';
  const anim = {
    nombres: Object.keys(acciones),
    get actual() { return nombreActual; },
    get tiempo() { return actual ? actual.time : 0; },
    tocar(nombre, { vel = 1, fundido = 0.15, reiniciar = false, sincronizar = false } = {}) {
      const a = acciones[nombre]; if (!a) return;
      a.timeScale = vel;
      if (nombre === nombreActual && !reiniciar) return;
      // G-HERC: el «sentado» del PERRO (tiene «ladrar») ya parte sentado y jadea en ciclo: se repite (si no, jadeaba una vez y quedaba quieto)
      a.reset(); a.setLoop(UNA_VEZ.has(nombre) && !(nombre === 'sentado' && acciones.ladrar) ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = true;
      if (sincronizar && actual && actual !== a && FASE[nombreActual] !== undefined && FASE[nombre] !== undefined) {
        const ph = actual.time / actual.getClip().duration + FASE[nombreActual];
        a.time = ((((ph - FASE[nombre]) % 1) + 1) % 1) * a.getClip().duration;
      }
      a.play();
      if (actual && actual !== a) actual.crossFadeTo(a, fundido, false);
      actual = a; nombreActual = nombre;
    },
    actualizar(dt) { mixer.update(dt); },
    tenir(k, color) { for (const u of tintes) { u.uTinteK.value = k; if (color != null) u.uTinte.value.set(color); } },   // N1-C42: 0 = su ropa, 1 = chaqueta
  };
  return { escena, anim };
}
