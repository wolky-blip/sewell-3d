// N0-CIUDAD-VIVA (15-11-2026, carril animador): NPC de época de Sewell con malla animada (blender/ciudad_malla.py →
// assets3d/anim/ciudad/<id>.glb + <id>.json). Un GLB por tipo, compartido (geometría, texturas y materiales); cada persona es un clon
// con su esqueleto y su mezclador. Dos niveles de detalle en el mismo GLB (<id>_alta 40 mil caras, <id>_baja ~8 mil).
// Capas de brazos (b_diario, b_pan…): solo traen huesos de brazos/cabeza; se suman a la marcha quitándole esas pistas.
// Escaleras: subir/bajar avanzan 2 peldaños por ciclo; fase(t) fija el tiempo desde la distancia recorrida (pies plantados).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarEsq } from 'three/addons/utils/SkeletonUtils.js';
import { variarNPC } from './variacionNPC.js';   // N0-NPC-UNICOS
import { prepararFalda, ponerFalda, FALDAS } from './faldaCodigo.js';   // 16-11: falda larga en código (mujeres y niñas)
const CUENTA = {};

export const PROP_DE_CAPA = { b_diario: 'diario', b_cartera: 'cartera', b_bolsa: 'bolsa', b_pan: 'pan', b_ramo: 'ramo' };
// banda (js/mundo/banda.js): instrumento por persona con op.prop; capa b_tocar_soplar (vientos) o b_tocar_golpear (percusión)
export const INSTRUMENTOS = { trompeta: 'b_tocar_soplar', trombon: 'b_tocar_soplar', bombardino: 'b_tocar_soplar', clarinete: 'b_tocar_soplar', tuba: 'b_tocar_soplar',
  redoblante: 'b_tocar_golpear', bombo: 'b_tocar_golpear' };
// ---------------------------------------------------------------- accesorios (en el hueso de la mano; posición medida en la pose de su capa)
const _m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.85, metalness: o.met ?? 0, map: o.map || null });
let _geo = null;
function texDiario() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 180; const x = c.getContext('2d');
  x.fillStyle = '#ddd6c6'; x.fillRect(0, 0, 256, 180); x.fillStyle = '#222'; x.font = 'bold 22px serif'; x.fillText('EL TENIENTE', 46, 26);
  x.fillRect(10, 32, 236, 2); x.fillStyle = '#555';
  for (let col = 0; col < 4; col++) for (let y = 44; y < 172; y += 6) x.fillRect(12 + col * 60, y, 40 + ((y * 7 + col * 13) % 14), 2);
  x.fillStyle = '#6a6660'; x.fillRect(132, 44, 52, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function geos() {
  if (_geo) return _geo;
  const ramo = new THREE.Group();
  const flor = new THREE.SphereGeometry(0.035, 8, 6), mf = _m(0xf4f1e8), mh = _m(0x4f7a3a);
  for (let i = 0; i < 13; i++) { const a = i * 2.4, rr = 0.012 + 0.03 * Math.sqrt(i / 13); const f = new THREE.Mesh(flor, mf); f.position.set(Math.cos(a) * rr, 0.06 + 0.02 * Math.sin(i), Math.sin(a) * rr); ramo.add(f); }
  const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.14, 8), mh); tallo.position.y = -0.02; ramo.add(tallo);
  const cinta = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 8), mf); cinta.position.y = -0.01; ramo.add(cinta);
  const bolsa = new THREE.Group(); const bb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), _m(0x9a7a48)); bb.scale.set(1, 1.2, 0.8); bolsa.add(bb);
  const pan2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), _m(0xc9893f)); pan2.position.set(0.03, 0.12, 0); pan2.scale.set(1.4, 0.8, 1); bolsa.add(pan2);
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 12, Math.PI), _m(0x6a4a28)); asa.position.y = 0.14; bolsa.add(asa);
  const cartera = new THREE.Group(); const cb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.25), _m(0x3a2014, { r: 0.45 })); cartera.add(cb);
  const ca = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 12, Math.PI), _m(0x3a2014, { r: 0.45 })); ca.rotation.y = Math.PI / 2; ca.position.y = 0.085; cartera.add(ca);
  const lonchera = new THREE.Group(); const lc = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.24, 12), _m(0x7d8285, { r: 0.4, met: 0.5 })); lc.rotation.z = Math.PI / 2; lonchera.add(lc);
  const la = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 12, Math.PI), _m(0x3a3a3a)); la.position.y = 0.085; lonchera.add(la);
  const botella = new THREE.Group(); const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), _m(0x2c4a26, { r: 0.2 })); b1.position.y = -0.08; botella.add(b1);
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.035, 0.1, 10), _m(0x2c4a26, { r: 0.2 })); b2.position.y = 0.07; botella.add(b2);
  // ---- instrumentos (bronce, madera y parche; ejes: +Z hacia adelante del músico, +Y arriba)
  const bronce = _m(0xc9a13e, { r: 0.3, met: 0.85 }), negro = _m(0x1b1b1b, { r: 0.4 }), parche = _m(0xe9e2cf), caja = _m(0x8a1f1f, { r: 0.5 }), madera = _m(0x6b4a2a);
  const tubo = (r0, r1, l, mat, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, l, seg, 1, true), mat);
  const campanaB = (r, l) => { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.012 + r * Math.pow(t, 3), l * t)); } const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), bronce); m.material.side = THREE.DoubleSide; return m; };
  const trompeta = new THREE.Group(); { const t = tubo(0.009, 0.009, 0.32, bronce); t.rotation.x = Math.PI / 2; t.position.z = 0.06; trompeta.add(t);
    const c = campanaB(0.055, 0.14); c.rotation.x = Math.PI / 2; c.position.z = 0.2; trompeta.add(c);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.07), bronce); v.position.set(0, 0.03, 0.02); trompeta.add(v); }
  const trombon = new THREE.Group(); { for (const y of [0, 0.05]) { const t = tubo(0.008, 0.008, 0.62, bronce); t.rotation.x = Math.PI / 2; t.position.set(0, y, 0.22); trombon.add(t); }
    const c = campanaB(0.07, 0.18); c.rotation.x = Math.PI / 2; c.position.set(0, 0.05, 0.42); trombon.add(c); }
  const bombardino = new THREE.Group(); { const t = tubo(0.04, 0.05, 0.38, bronce); t.position.y = 0.02; bombardino.add(t);
    const c = campanaB(0.1, 0.16); c.position.y = 0.2; bombardino.add(c); const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.05), bronce); v.position.set(0.05, 0.02, 0.03); bombardino.add(v); }
  const tuba = bombardino.clone(); tuba.scale.setScalar(1.55);
  const clarinete = new THREE.Group(); { const t = tubo(0.011, 0.014, 0.6, negro); t.rotation.x = Math.PI / 2 - 0.5; clarinete.add(t);
    const c = campanaB(0.03, 0.06); c.rotation.x = Math.PI / 2 - 0.5; c.position.set(0, -0.27 * Math.sin(0.5), 0.27 * Math.cos(0.5)); clarinete.add(c); }
  const redoblante = new THREE.Group(); { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 20), caja); redoblante.add(c);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.01, 20), parche); p.position.y = 0.075; redoblante.add(p);
    for (const s of [-1, 1]) { const b = tubo(0.006, 0.006, 0.34, madera, 6); b.rotation.set(0.9, 0, s * 0.5); b.position.set(s * 0.09, 0.2, -0.05); redoblante.add(b); } }
  const bombo = new THREE.Group(); { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 24), caja); c.rotation.z = Math.PI / 2; bombo.add(c);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.302, 0.302, 0.01, 24), parche); p.rotation.z = Math.PI / 2; p.position.x = s * 0.115; bombo.add(p); } }
  _geo = { trompeta, trombon, bombardino, tuba, clarinete, redoblante, bombo,
    diario: new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.30, 0.006), _m(0xffffff, { map: texDiario() })),
    pan: Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), _m(0xc9893f)), {}),
    ramo, bolsa, cartera, lonchera, botella,
  };
  _geo.pan.scale.set(1.5, 0.8, 1);
  return _geo;
}
// dónde va cada accesorio en la pose de su capa (espacio del personaje: mira a +Z, izquierda = +X, metros)
const DEF_PROP = {
  diario: { capa: 'b_diario', mano: 'R', donde: (L, R) => [L.clone().add(R).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.05, 0.03)), new THREE.Vector3(0, 0.75, -0.66)] },
  ramo: { capa: 'b_ramo', mano: 'R', donde: (L, R) => [L.clone().add(R).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.04, 0.03)), null] },
  pan: { capa: 'b_pan', mano: 'R', donde: (L, R) => [R.clone().add(new THREE.Vector3(0, 0.01, 0.02)), null] },
  cartera: { capa: 'b_cartera', mano: 'L', donde: (L, R) => [L.clone().add(new THREE.Vector3(0.02, -0.1, 0)), null] },
  bolsa: { capa: 'b_bolsa', mano: 'R', donde: (L, R) => [R.clone().add(new THREE.Vector3(-0.01, -0.17, 0)), null] },
  lonchera: { capa: 'b_bolsa', mano: 'R', donde: (L, R) => [R.clone().add(new THREE.Vector3(-0.01, -0.1, 0)), null] },
  botella: { capa: 'b_bolsa', mano: 'R', donde: (L, R) => [R.clone().add(new THREE.Vector3(0, -0.1, 0.01)), null] },
  // banda: vientos entre las manos (la boquilla hacia la boca); percusión colgada de la cadera (hueso hips) delante del cuerpo
  trompeta: { capa: 'b_tocar_soplar', mano: 'R', donde: (L, R) => [L.clone().add(R).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.04, -0.02)), null] },
  trombon: { capa: 'b_tocar_soplar', mano: 'R', donde: (L, R) => [L.clone().add(R).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.05, -0.05)), null] },
  clarinete: { capa: 'b_tocar_soplar', mano: 'R', donde: (L, R) => [L.clone().add(R).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.08, -0.08)), null] },
  bombardino: { capa: 'b_tocar_soplar', mano: 'R', donde: (L, R) => [L.clone().add(R).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.12, 0.02)), null] },
  tuba: { capa: 'b_tocar_soplar', mano: 'R', donde: (L, R) => [L.clone().add(R).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.2, 0.05)), null] },
  redoblante: { capa: 'b_tocar_golpear', hueso: 'hips', donde: (L, R, H) => [H.clone().add(new THREE.Vector3(0, -0.12, 0.26)), null] },
  bombo: { capa: 'b_tocar_golpear', hueso: 'hips', donde: (L, R, H) => [H.clone().add(new THREE.Vector3(0, 0.02, 0.36)), null] },
};
function medirProps(T) {   // un clon temporal en la pose de cada capa: matriz del accesorio relativa al hueso de la mano
  T.locales = {};
  const esc = clonarEsq(T.gltf.scene), mx = new THREE.AnimationMixer(esc), hueso = {};
  esc.traverse(o => { if (o.isBone) hueso[o.name] = o; });
  for (const [n, d] of Object.entries(DEF_PROP)) {
    if (!T.clips[d.capa] || !T.clips.idle) continue;
    mx.stopAllAction(); const a = mx.clipAction(clipSin(T, 'idle', d.capa)), b = mx.clipAction(T.clips[d.capa]); a.play(); b.play(); mx.update(0);
    esc.updateMatrixWorld(true);
    const palma = l => { const w = new THREE.Vector3().setFromMatrixPosition(hueso['hand' + l].matrixWorld), f = new THREE.Vector3().setFromMatrixPosition(hueso['forearm' + l].matrixWorld);
      return w.clone().add(w.clone().sub(f).normalize().multiplyScalar(0.075)); };
    const [c, nrm] = d.donde(palma('L'), palma('R'), new THREE.Vector3().setFromMatrixPosition(hueso.hips.matrixWorld)), M = new THREE.Matrix4();
    if (nrm) { const X = new THREE.Vector3(1, 0, 0), Z = nrm.normalize(), Y = new THREE.Vector3().crossVectors(Z, X); M.makeBasis(X, Y, Z); }
    M.setPosition(c);
    const ref = d.hueso || 'hand' + d.mano;
    T.locales[n] = { mano: ref, M: hueso[ref].matrixWorld.clone().invert().multiply(M) };
    a.stop(); b.stop();
  }
}
const TIPOS = {};
export function cargarTipo(id, base = 'assets3d/anim/ciudad/') {
  return TIPOS[id] ||= Promise.all([new GLTFLoader().loadAsync(base + id + '.glb'), fetch(base + id + '.json').then(r => r.json())]).then(([gltf, info]) => {
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m && m.isMeshStandardMaterial) {   // = animMalla.js: brillo propio suave (la cara no queda negra a contraluz), mate
        if (m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0.22, 0.22, 0.22); }
        m.metalness = 0; m.roughness = Math.max(0.65, m.roughness ?? 0.8); m.needsUpdate = true;
      }
      o.castShadow = false; o.receiveShadow = false;   // la sombra la decide ciudadViva (solo los más cercanos)
    });
    const clips = {}; for (const c of gltf.animations) clips[c.name] = c;
    const huesosCapa = {};
    for (const [n, c] of Object.entries(clips)) if (n.startsWith('b_')) huesosCapa[n] = new Set(c.tracks.map(t => t.name.split('.')[0]));
    const T = { id, gltf, info, clips, huesosCapa, enmascarados: {} }; medirProps(T); prepararFalda(T); return T;
  });
}
function clipSin(T, base, capa) {   // la marcha sin las pistas de los huesos de la capa
  const k = base + '|' + capa;
  if (T.enmascarados[k]) return T.enmascarados[k];
  const hs = T.huesosCapa[capa], c = T.clips[base];
  return (T.enmascarados[k] = new THREE.AnimationClip(k, c.duration, c.tracks.filter(t => !hs.has(t.name.split('.')[0]))));
}
// una persona: { g, poner(base, capa), fase(t 0-1), actualizar(dt), lod(dist), prop(nombre) }
export function crearPersona(T, op = {}) {
  const escena = clonarEsq(T.gltf.scene), g = new THREE.Group(); g.add(escena);
  let alta = null, baja = null, lejos = null; const props = {}, hueso = {};
  escena.traverse(o => {
    if (o.isSkinnedMesh) {
      if (/_alta$/.test(o.name)) alta = o; else if (/_baja$/.test(o.name)) baja = o; else if (/_lejos$/.test(o.name)) lejos = o;
      o.frustumCulled = true;
    }
    if (o.isBone) hueso[o.name] = o;
  });
  const accesorio = n => {   // se crea la primera vez que hace falta (geometría y materiales compartidos)
    if (props[n] !== undefined || !T.locales[n]) return props[n];
    const o = geos()[n].clone(); o.matrixAutoUpdate = false; o.matrix.copy(T.locales[n].M); o.traverse(q => { q.castShadow = false; });
    hueso[T.locales[n].mano].add(o); return (props[n] = o);
  };
  const niveles = [alta, baja || alta, (T.falda && FALDAS[T.id].lejosBaja ? baja : lejos) || baja || alta];   // falda de código: algunos LOD lejanos TRELLIS salen manchados
  for (const m of new Set(niveles)) if (m) { m.frustumCulled = false; m.visible = false; }   // el recorte por cámara lo hace ciudadViva (una esfera por persona)
  if (alta) alta.visible = true;
  const mixer = new THREE.AnimationMixer(escena);
  let clave = '', acts = [], extra = op.prop || null, nivel = 0, sombra = false;
  const P = {
    g, escena, mixer, alto: T.info.alto, vel: T.info.vel || {},
    get base() { return clave.split('|')[0]; },
    poner(base, capa = null, { fundido = 0.3, vel = 1 } = {}) {
      if (!T.clips[base]) base = 'idle';
      if (capa && !T.clips[capa]) capa = null;
      const k = base + '|' + (capa || '');
      if (k === clave) { for (const a of acts) a.timeScale = vel; return; }
      const nuevas = [mixer.clipAction(capa ? clipSin(T, base, capa) : T.clips[base])];
      if (capa) nuevas.push(mixer.clipAction(T.clips[capa]));
      for (const a of nuevas) { a.reset(); a.timeScale = vel; a.setLoop(THREE.LoopRepeat); a.play(); if (acts.length && fundido > 0) a.fadeIn(fundido); }
      for (const a of acts) if (!nuevas.includes(a)) { if (fundido > 0) a.fadeOut(fundido); else a.stop(); }
      acts = nuevas; clave = k;
      const quiere = (capa === 'b_bolsa' || /^b_tocar/.test(capa || '')) && extra ? extra : PROP_DE_CAPA[capa];   // b_bolsa: también lonchera/botella; b_tocar_*: el instrumento (op.prop)
      if (quiere) accesorio(quiere);
      for (const [n, o] of Object.entries(props)) if (o) o.visible = n === quiere;
    },
    fase(t) {   // tiempo fijado por la distancia (escaleras): t de 0 a 1 en el ciclo de la marcha
      const a = acts[0]; if (!a) return;
      a.time = (((t % 1) + 1) % 1) * a.getClip().duration; a.timeScale = 0;
    },
    actualizar(dt) { mixer.update(dt); if (P.falda) P.falda.actualizar(nivel); },
    lod(n, conSombra = false) {   // n: 0 alta (40 mil caras), 1 baja (14 mil), 2 lejos (2,5 mil); sombra solo en los más cercanos
      if (n !== nivel && niveles[n] !== niveles[nivel]) { niveles[nivel].visible = false; niveles[n].visible = true; }
      nivel = n;
      if (conSombra !== sombra || niveles[n].castShadow !== conSombra) { sombra = conSombra; for (const m of new Set(niveles)) m.castShadow = conSombra && m === niveles[n]; if (P.falda) P.falda.sombra(conSombra); }
    },
    get nivel() { return nivel; },
    caras(n = nivel) { const m = niveles[n], gi = m && m.geometry; return gi ? (gi.index ? gi.index.count : gi.attributes.position.count) / 3 : 0; },   // para medir el costo
    prop(n) { extra = n; },
  };
  P.poner(op.anim || 'idle', op.capa || null, { fundido: 0 });
  // N0-NPC-UNICOS: variante por persona (banda: mismo uniforme, sin sombrero; op.variar = { semilla, fija, uniforme, sinSombrero })
  const banda = /^b_tocar/.test(op.capa || ''), vo = op.variar || {};
  P.variacion = variarNPC(P, { malla: T.id, raiz: escena, alto: T.info.alto, ancla: g, semilla: vo.semilla ?? T.id + '#' + (CUENTA[T.id] = (CUENTA[T.id] || 0) + 1),
    fija: vo.fija, uniforme: vo.uniforme || banda, sinSombrero: vo.sinSombrero || banda });
  P.falda = T.falda ? ponerFalda(P, T) : null;   // después de variarNPC: el color sale de su variante (v.rb) y la cadera ya ocupada no recibe su delantal
  mixer.update(Math.random() * 3); if (P.falda) P.falda.actualizar(0);
  return P;
}
