// Animación de esqueleto para los splats de Idol (Nato y Hércules), 12-11-2026.
// El esqueleto y las acciones se hacen en Blender (blender/animar.py) y llegan en assets3d/anim/<id>.glb.
// Cada gaussiana se pega a sus huesos por distancia a la «cápsula» de cada hueso (<id>_huesos.json, en coords crudas del .ply)
// y Spark la deforma en la GPU con SplatSkinning (cuaterniones duales).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SplatSkinning } from '@sparkjsdev/spark';

const R = new THREE.Matrix4().makeRotationX(Math.PI);   // glTF (y arriba) <-> .ply crudo de Idol (y abajo, z invertida)
// fase del paso al inicio de cada ciclo (0 = pie derecho arriba): la carrera CMU 09_01 empieza con el izquierdo (blender/mocap.py)
const FASE = { caminar: 0, correr: 0.5 };
const cache = {}, PESOS = {};   // PESOS: los pesos de cada personaje se calculan una vez y las demás copias (mineros) los reutilizan
function cargar(id) {
  if (!cache[id]) cache[id] = Promise.all([
    new GLTFLoader().loadAsync(`assets3d/anim/${id}.glb`),
    fetch(`assets3d/anim/${id}_huesos.json`).then(r => r.json()).then(async h => {
      if (h.mixamo) h.buf = new Float32Array(await (await fetch(`assets3d/anim/${id}_pesos.bin`)).arrayBuffer());
      return h;
    }),
  ]);
  return cache[id];
}

// splat: SplatMesh ya creado con el .ply de Idol. Devuelve { tocar(nombre, opciones), actualizar(dt), nombres } o null si falla
export async function animarSplat(splat, id) {
  try {
    const [gltf, huesosDef] = await cargar(id);
    await splat.initialized;
    if (huesosDef.mixamo) return animarMixamo(splat, id, gltf, huesosDef);
    const escena = gltf.scene.clone(true);   // cada personaje con su propia copia del esqueleto
    const nodo = {}; escena.traverse(o => { nodo[o.name] = o; });
    const nom = n => THREE.PropertyBinding.sanitizeNodeName(n);   // GLTFLoader quita el punto: 'thigh.L' -> 'thighL'
    const arm = nodo[nom(id)] || escena;
    const huesos = huesosDef.filter(h => h.r > 0 && nodo[nom(h.n)]);
    const objs = huesos.map(h => nodo[nom(h.n)]);
    if (huesos.length < huesosDef.filter(h => h.r > 0).length) console.warn('animSplat: faltan huesos en', id);
    const N = huesos.length;
    const sk = new SplatSkinning({ mesh: splat, numBones: N, mode: 'dual_quaternion' });
    // pose de reposo de cada hueso, en coords crudas
    const M = new THREE.Matrix4(), inv = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const enCrudo = (o, out) => { out.multiplyMatrices(inv, o.matrixWorld); out.premultiply(R).multiply(R); return out; };
    escena.updateMatrixWorld(true); inv.copy(arm.matrixWorld).invert();
    // Spark compone (resto⁻¹·q) y (p − p_resto): gira en torno al origen, no a la articulación. Por eso le damos el reposo en
    // identidad y le pasamos ya la transformación relativa correcta: R = q·qr⁻¹ y t = p − R·pr
    const restQ = [], restP = [], Q0 = new THREE.Quaternion(), V0 = new THREE.Vector3(), Rq = new THREE.Quaternion(), t = new THREE.Vector3();
    objs.forEach((o, i) => { enCrudo(o, M).decompose(p, q, s); restQ.push(q.clone().invert()); restP.push(p.clone()); sk.setRestQuatPos(i, Q0, V0); });
    // pesos: distancia de cada gaussiana a la superficie de cada cápsula; 4 huesos más cercanos, suavizado exponencial
    const A = huesos.map(h => new THREE.Vector3(...h.a)), B = huesos.map(h => new THREE.Vector3(...h.b));
    const AB = A.map((a, i) => B[i].clone().sub(a)), L2 = AB.map(v => Math.max(1e-8, v.lengthSq())), RAD = huesos.map(h => h.r);
    // brazos de Nato: cuelgan pegados a la chaqueta; las gaussianas del tronco (|lateral| < 0.118, bajo los hombros) no se pegan a ellos
    const UMBRAL = { nato: 0.108, minero: 0.13, jefe: 0.14 }[id];   // medio ancho del tronco: lo de dentro no se pega a los brazos
    const esBrazo = huesos.map(h => UMBRAL !== undefined && /^(uparm|forearm|hand)/.test(h.n));
    // transición de pesos corta: codos y rodillas se doblan como bisagras (con 0,012 los brazos se curvaban como mangueras)
    const sigma = 0.0075, sc = new Float32Array(N), idx = new THREE.Vector4(), w = new THREE.Vector4(), d = new THREE.Vector3();
    // grupos (13-11): lo que es del brazo no se pega a piernas ni cadera (la mano colgaba junto al bolsillo y se estiraba como una
    // tira al golpear); lo del cuerpo no se pega al antebrazo ni a la mano. Igual que pesos() en blender/animar.py
    const lado = huesos.map(h => /^(uparm|forearm|hand)\./.test(h.n) ? h.n.split('.')[1] : '');
    const hombro = huesos.map(h => /^(clav|chest)/.test(h.n)), extremo = huesos.map(h => /^(forearm|hand)\./.test(h.n));
    // piernas: lo que es de una pierna no se pega a la otra, y la cadera casi no lo toma (el muslo se doblaba a media altura)
    const pierna = huesos.map(h => /^(thigh|shin|foot)\./.test(h.n) ? h.n.split('.')[1] : ''), cadera = huesos.map(h => h.n === 'hips');
    const pc = PESOS[id], nuevo = { idx: [], w: [] };
    splat.forEachSplat((i, c) => {
      if (pc) { idx.fromArray(pc.idx, i * 4); w.fromArray(pc.w, i * 4); sk.setSplatBones(i, idx, w); return; }
      let min = 1e9, mejor = 0;
      for (let b = 0; b < N; b++) {
        d.subVectors(c, A[b]); let t = d.dot(AB[b]) / L2[b]; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = c.x - (A[b].x + AB[b].x * t), dy = c.y - (A[b].y + AB[b].y * t), dz = c.z - (A[b].z + AB[b].z * t);
        sc[b] = Math.sqrt(dx * dx + dy * dy + dz * dz) - RAD[b] + (esBrazo[b] && Math.abs(c.z) < UMBRAL && c.y > -0.15 ? 0.06 : 0); if (sc[b] < min) { min = sc[b]; mejor = b; }
      }
      const gb = lado[mejor];
      const gp = pierna[mejor];
      for (let b = 0; b < N; b++) {
        if (gb ? (lado[b] !== gb && !hombro[b]) : extremo[b]) sc[b] = 1e9;
        if (gp && pierna[b] && pierna[b] !== gp) sc[b] = 1e9;
        if (gp && cadera[b]) sc[b] += 0.012;
      }
      const top = [-1, -1, -1, -1], tw = [0, 0, 0, 0];
      for (let b = 0; b < N; b++) {
        const v = Math.exp(-(sc[b] - min) / sigma);
        for (let k = 0; k < 4; k++) if (v > tw[k]) { for (let j = 3; j > k; j--) { tw[j] = tw[j - 1]; top[j] = top[j - 1]; } tw[k] = v; top[k] = b; break; }
      }
      const suma = tw[0] + tw[1] + tw[2] + tw[3];
      idx.set(Math.max(0, top[0]), Math.max(0, top[1]), Math.max(0, top[2]), Math.max(0, top[3]));
      w.set(tw[0] / suma, tw[1] / suma, tw[2] / suma, tw[3] / suma);
      sk.setSplatBones(i, idx, w);
      nuevo.idx[i * 4] = idx.x; nuevo.idx[i * 4 + 1] = idx.y; nuevo.idx[i * 4 + 2] = idx.z; nuevo.idx[i * 4 + 3] = idx.w;
      nuevo.w[i * 4] = w.x; nuevo.w[i * 4 + 1] = w.y; nuevo.w[i * 4 + 2] = w.z; nuevo.w[i * 4 + 3] = w.w;
    });
    if (!pc) PESOS[id] = { idx: Float32Array.from(nuevo.idx), w: Float32Array.from(nuevo.w) };
    sk.skinTexture.needsUpdate = true;
    splat.skinning = sk; splat.updateGenerator();
    // acciones
    const mixer = new THREE.AnimationMixer(escena);
    const acciones = {}; for (const clip of gltf.animations) acciones[clip.name] = mixer.clipAction(clip);
    let actual = null, nombreActual = '';
    const UNA_VEZ = new Set(['saltar', 'doble', 'aterrizar', 'jab', 'recto', 'golpe', 'golpe2', 'giratoria', 'gancho', 'patada', 'herido', 'recoger', 'sentado', 'ko',
      'puno', 'pisoton', 'rendicion', 'jefe_senalar', 'levantarse']);   // G-A8/G-A9: jefe y cinemática
    return {
      nombres: Object.keys(acciones),
      get actual() { return nombreActual; },
      get tiempo() { return actual ? actual.time : 0; },   // para las pruebas
      // tocar('correr', { vel: 1.2, fundido: 0.15 }): cambia de acción con fundido; las de una vez quedan en su último cuadro
      // sincronizar: al pasar entre caminar y correr, la nueva empieza con el mismo pie en la misma fase (sin tirón de piernas)
      tocar(nombre, { vel = 1, fundido = 0.15, reiniciar = false, sincronizar = false } = {}) {
        const a = acciones[nombre]; if (!a) return;
        a.timeScale = vel;
        if (nombre === nombreActual && !reiniciar) return;
        a.reset(); a.setLoop(UNA_VEZ.has(nombre) && !(nombre === 'sentado' && acciones.ladrar) ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = true;   // G-HERC: el perro jadea sentado en ciclo
        if (sincronizar && actual && actual !== a && FASE[nombreActual] !== undefined && FASE[nombre] !== undefined) {
          const ph = actual.time / actual.getClip().duration + FASE[nombreActual];
          a.time = ((((ph - FASE[nombre]) % 1) + 1) % 1) * a.getClip().duration;
        }
        a.play();
        if (actual && actual !== a) actual.crossFadeTo(a, fundido, false);
        actual = a; nombreActual = nombre;
      },
      // N1-C70: ajuste(nodo) opcional, después de la acción (p. ej. bajar los brazos de Diego). Las rotaciones que deja se deshacen
      // antes del cuadro siguiente: los huesos que la acción no anima no acumulan el ajuste
      ajuste: null, _q0: null, huesos, pesos: PESOS[id],   // N1-C70: cápsulas y pesos (para ocultar restos que no siguen a los brazos)
      actualizar(dt) {
        if (this._q0) { objs.forEach((o, i) => o.quaternion.copy(this._q0[i])); this._q0 = null; }
        mixer.update(dt);
        if (this.ajuste) { this._q0 = objs.map(o => o.quaternion.clone()); escena.updateMatrixWorld(true); this.ajuste(nodo); }
        escena.updateMatrixWorld(true); inv.copy(arm.matrixWorld).invert();
        objs.forEach((o, i) => { enCrudo(o, M).decompose(p, q, s); Rq.multiplyQuaternions(q, restQ[i]); t.copy(restP[i]).applyQuaternion(Rq); t.subVectors(p, t); sk.setBoneQuatPos(i, Rq, t); });
        sk.updateBones();
      },
    };
  } catch (e) { console.warn('animSplat', id, e); return null; }
}

// ---------------------------------------------------------------- ruta híbrida (blender/nato_hibrido.py)
// Esqueleto y animaciones de Mixamo; los pesos vienen de la malla rigeada por Mixamo, posada como las gaussianas
// (acción «reposo_splat»). Cada gaussiana toma los pesos de los 3 vértices más cercanos de esa malla.
const UNA_VEZ_MX = new Set(['saltar', 'doble', 'aterrizar', 'jab', 'recto', 'golpe', 'golpe2', 'giratoria', 'gancho', 'patada', 'herido', 'recoger', 'sentado', 'ko', 'levantarse', 'puno', 'pisoton', 'rendicion', 'jefe_senalar', 'celebrar']);   // G-A8/G-A9
function animarMixamo(splat, id, gltf, def) {
  const escena = gltf.scene.clone(true);
  const nodo = {}; escena.traverse(o => { nodo[o.name] = o; });
  const nom = n => THREE.PropertyBinding.sanitizeNodeName(n);
  const objs = def.huesos.map(n => nodo[nom(n)]);
  if (objs.some(o => !o)) { console.warn('animSplat: faltan huesos Mixamo en', id); return null; }
  const N = objs.length;
  const sk = new SplatSkinning({ mesh: splat, numBones: N, mode: 'dual_quaternion' });
  const mixer = new THREE.AnimationMixer(escena);
  const acciones = {}; for (const clip of gltf.animations) acciones[clip.name] = mixer.clipAction(clip);
  // reposo = postura de las gaussianas (brazos abajo), no la pose T de Mixamo
  if (acciones.reposo_splat) { acciones.reposo_splat.play(); mixer.update(0); }
  escena.updateMatrixWorld(true);
  const M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const enCrudo = (o, out) => out.copy(o.matrixWorld).premultiply(R).multiply(R);
  const restQ = [], restP = [], Q0 = new THREE.Quaternion(), V0 = new THREE.Vector3(), Rq = new THREE.Quaternion(), t = new THREE.Vector3();
  objs.forEach((o, i) => { enCrudo(o, M).decompose(p, q, s); restQ.push(q.clone().invert()); restP.push(p.clone()); sk.setRestQuatPos(i, Q0, V0); });
  if (acciones.reposo_splat) { acciones.reposo_splat.stop(); delete acciones.reposo_splat; }
  // pesos: rejilla de vértices (coords crudas) y mezcla de los 3 más cercanos
  const pc = PESOS[id], idx = new THREE.Vector4(), w = new THREE.Vector4();
  if (pc) splat.forEachSplat((i) => { idx.fromArray(pc.idx, i * 4); w.fromArray(pc.w, i * 4); sk.setSplatBones(i, idx, w); });
  else {
    const B = def.buf, NV = def.verts, C = 0.03, rej = new Map(), clave = (x, y, z) => x * 73856093 ^ y * 19349663 ^ z * 83492791;
    for (let v = 0; v < NV; v++) {
      const k = clave(Math.floor(B[v * 11] / C), Math.floor(B[v * 11 + 1] / C), Math.floor(B[v * 11 + 2] / C));
      (rej.get(k) || rej.set(k, []).get(k)).push(v);
    }
    const cad = def.huesos.indexOf('mixamorig:Hips'), acum = new Float32Array(N), nuevo = { idx: [], w: [] };
    splat.forEachSplat((i, c) => {
      const cx = Math.floor(c.x / C), cy = Math.floor(c.y / C), cz = Math.floor(c.z / C), cerca = [[1e9, -1], [1e9, -1], [1e9, -1]];
      for (let r = 1; r <= 3 && cerca[0][1] < 0; r++)
        for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let e = -r; e <= r; e++) {
          const l = rej.get(clave(cx + a, cy + b, cz + e)); if (!l) continue;
          for (const v of l) {
            const dx = B[v * 11] - c.x, dy = B[v * 11 + 1] - c.y, dz = B[v * 11 + 2] - c.z, d = dx * dx + dy * dy + dz * dz;
            if (d < cerca[2][0]) { cerca[2] = [d, v]; cerca.sort((m, n) => m[0] - n[0]); }
          }
        }
      const usados = [];
      for (const [d, v] of cerca) {
        if (v < 0) continue; const f = 1 / (Math.sqrt(d) + 0.004) ** 2;
        for (let k = 0; k < 4; k++) { const h = B[v * 11 + 3 + k], ww = B[v * 11 + 7 + k]; if (ww > 0) { if (!acum[h]) usados.push(h); acum[h] += ww * f; } }
      }
      usados.sort((m, n) => acum[n] - acum[m]);
      const top = usados.slice(0, 4); let suma = 0; for (const h of top) suma += acum[h];
      if (!top.length) { top.push(cad); acum[cad] = suma = 1; }
      for (let k = 0; k < 4; k++) { nuevo.idx[i * 4 + k] = top[k] ?? top[0]; nuevo.w[i * 4 + k] = top[k] !== undefined ? acum[top[k]] / suma : 0; }
      for (const h of usados) acum[h] = 0;
      idx.fromArray(nuevo.idx, i * 4); w.fromArray(nuevo.w, i * 4); sk.setSplatBones(i, idx, w);
    });
    PESOS[id] = { idx: Float32Array.from(nuevo.idx), w: Float32Array.from(nuevo.w) };
  }
  sk.skinTexture.needsUpdate = true;
  splat.skinning = sk; splat.updateGenerator();
  let actual = null, nombreActual = '';
  return {
    nombres: Object.keys(acciones),
    get actual() { return nombreActual; },
    tocar(nombre, { vel = 1, fundido = 0.15, reiniciar = false } = {}) {
      const a = acciones[nombre]; if (!a) return;
      a.timeScale = vel;
      if (nombre === nombreActual && !reiniciar) return;
      a.reset(); a.setLoop(UNA_VEZ_MX.has(nombre) ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = true; a.play();
      if (actual && actual !== a) actual.crossFadeTo(a, fundido, false);
      actual = a; nombreActual = nombre;
    },
    actualizar(dt) {
      mixer.update(dt); escena.updateMatrixWorld(true);
      objs.forEach((o, i) => { enCrudo(o, M).decompose(p, q, s); Rq.multiplyQuaternions(q, restQ[i]); t.copy(restP[i]).applyQuaternion(Rq); t.subVectors(p, t); sk.setBoneQuatPos(i, Rq, t); });
      sk.updateBones();
    },
  };
}
