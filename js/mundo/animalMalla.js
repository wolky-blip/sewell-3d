// G12 (16-11-2026, pedido de Diego: «las mulas y los bueyes siguen siendo procedurales de cajas y cilindros»): MULA y BUEY como mallas
// ANIMADAS (Qwen-Image-Edit 2511 → TRELLIS.2 → blender/animal_rig.py: esqueleto propio, pesos por cápsulas, acciones idle y caminar).
// Se montan SOBRE el animal procedural de animales.js (mismo objeto: g, tronco, cuello, cola, patas), que sigue mandando:
//  · el tronco (cabeceo según el suelo, alto) es el padre de la malla; la carga (aparejo, pirquas, sacos) sigue colgada de él;
//  · las patas: las mismas anclas en el mundo y fases de animales.js, resueltas con IK de dos huesos sobre los huesos de la malla
//    (los cascos tocan el suelo real; el paso va por la DISTANCIA recorrida, así que va sincronizado con la velocidad);
//  · cuello y cola: los giros que el juego da a an.cuello / an.cola (pastar, cabeceo, mirar a Nato, espantar moscas) se aplican a sus huesos;
//  · las acciones del GLB: «caminar» llevada por la fase del paso (cabeceo y cola) y «idle» (respira), mezcladas por la velocidad.
// Si la malla no carga (o ?animales=proc), queda el procedural de siempre. En el celular se baja la variante .movil.glb (publicar_movil.mjs).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarEsq } from 'three/addons/utils/SkeletonUtils.js';

const URL = { mula: 'assets3d/anim/mula.glb', buey: 'assets3d/anim/buey.glb' };
const APAGADO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('animales') === 'proc';
const CARGA = {};
function cargar(tipo) {
  return (CARGA[tipo] ||= new GLTFLoader().loadAsync(URL[tipo]).then(g => {
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material; if (m && m.isMeshStandardMaterial) { m.metalness = 0; m.roughness = Math.max(0.8, m.roughness ?? 0.8); if (m.map) m.map.anisotropy = 4; m.needsUpdate = true; }
    });
    return g;
  }).catch(e => { console.warn('animal malla: no cargó', tipo, e && e.message); return null; }));
}
export const precargarAnimal = tipo => (APAGADO || !URL[tipo] ? Promise.resolve(null) : cargar(tipo));

const _a = new THREE.Vector3(), _k = new THREE.Vector3(), _f = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _K = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _e = new THREE.Euler(), _qr = new THREE.Quaternion();
// gira el hueso b (en el mundo) para que la dirección de su hijo pase de «de» a «a»
function girar(b, de, a) {
  _q.setFromUnitVectors(de.normalize(), a.normalize());
  b.getWorldQuaternion(_qw); b.parent.getWorldQuaternion(_qp);
  b.quaternion.copy(_qp.invert().multiply(_q).multiply(_qw)); b.updateMatrixWorld(true);
}

// an: animal de animales.js; ocultar: mallas procedurales que se esconden al montar; listo(rig): aviso al montar (la yunta mueve el yugo)
export function mallaAnimal(an, ocultar = [], listo) {
  if (APAGADO || !URL[an.tipo]) return;
  cargar(an.tipo).then(g => {
    if (!g || an.rig) return;
    const esc = clonarEsq(g.scene), B = {};
    esc.traverse(o => { if (o.isBone) B[o.name] = o; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    const lados = ['MI', 'MD', 'PI', 'PD'];
    if (!B.tronco || !B.cuello || !B.cola || lados.some(l => !B[l + '_1'] || !B[l + '_2'] || !B[l + '_fin'])) { console.warn('animal malla: esqueleto incompleto', an.tipo); return; }
    // en el marco del tronco: el suelo de la malla en y = −alto0 y la mitad entre manos y patas en z = 0 (ahí va el aparejo)
    esc.position.y = -an.alto0; an.tronco.add(esc); an.tronco.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(an.tronco.matrixWorld).invert(), enT = o => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const zM = (enT(B.MI_fin).z + enT(B.MD_fin).z) / 2, zP = (enT(B.PI_fin).z + enT(B.PD_fin).z) / 2;
    esc.position.z = -(zM + zP) / 2; an.tronco.updateMatrixWorld(true);
    // patas: cada pata procedural toma la de la malla de su lado (I = +x) y su apoyo nominal pasa al casco de la malla
    const qT = an.tronco.getWorldQuaternion(new THREE.Quaternion()).invert();
    for (const p of an.patas) {
      const n = (p.z > 0 ? 'M' : 'P') + (p.x > 0 ? 'I' : 'D'), b1 = B[n + '_1'], b2 = B[n + '_2'], bf = B[n + '_fin'];
      const A = enT(b1), K = enT(b2), F = enT(bf);
      p.hueso = { b1, b2, bf, L1: A.distanceTo(K), L2: K.distanceTo(F), polo: p.z > 0 ? 1 : -1 };
      p.x = F.x; p.z = F.z;
    }
    const rest = b => qT.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));   // giro de reposo del hueso en el marco del tronco
    const giros = [[B.cuello, an.cuello, rest(B.cuello)], [B.cola, an.cola, rest(B.cola)]];
    const mixer = new THREE.AnimationMixer(esc), A = {};
    for (const c of g.animations) A[c.name] = mixer.clipAction(c);
    if (A.idle) A.idle.play();
    if (A.caminar) { A.caminar.play(); A.caminar.timeScale = 0; A.caminar.setEffectiveWeight(0); }
    for (const o of ocultar) if (o) o.visible = false;
    an.rig = {
      esc, B, nariz: B.nariz || B.cabeza,
      // antes de las patas: acciones (caminar por la fase del paso, idle por el tiempo), y los giros del juego en cuello y cola
      pre(dt, ph, k) {
        if (A.caminar) { A.caminar.time = ((ph % 1) + 1) % 1 * A.caminar.getClip().duration; A.caminar.setEffectiveWeight(k); }
        if (A.idle) A.idle.setEffectiveWeight(1 - k);
        mixer.update(dt);
        for (const [b, o, q0] of giros) {
          _qr.setFromEuler(_e.copy(o.rotation));
          if (o === an.cola) _qr.setFromEuler(_e.set(o.rotation.x - 0.15, 0, o.rotation.z));   // la cola procedural cuelga con 0,15 de base
          b.quaternion.multiply(_q.copy(q0).invert().multiply(_qr).multiply(q0));
        }
        esc.updateMatrixWorld(true);
      },
      // IK de dos huesos: el casco (hueso _fin) al punto T del mundo; rodilla (carpo) hacia adelante en las manos, corvejón hacia atrás en las patas
      ik(p, T) {
        const h = p.hueso, { b1, b2, bf, L1, L2 } = h;
        b1.getWorldPosition(_a); b2.getWorldPosition(_k); bf.getWorldPosition(_f);
        _d.subVectors(T, _a); const dist = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min(_d.length(), L1 + L2 - 1e-3)); _d.normalize();
        const c = Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist))), s = Math.sqrt(1 - c * c);
        an.tronco.getWorldQuaternion(_qw); _n.set(0, 0, h.polo).applyQuaternion(_qw); _n.addScaledVector(_d, -_n.dot(_d)).normalize();
        _K.copy(_a).addScaledVector(_d, L1 * c).addScaledVector(_n, L1 * s);
        girar(b1, _k.sub(_a), _K.clone().sub(_a));
        b2.getWorldPosition(_k); bf.getWorldPosition(_f);
        girar(b2, _f.sub(_k), _d.copy(T).sub(_k));
      },
    };
    if (listo) listo(an.rig);
  });
}
