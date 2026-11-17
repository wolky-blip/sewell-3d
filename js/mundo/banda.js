// BANDA DE SEWELL (N0-CIUDAD-VIVA / N0-BANDA-b, carril animador, 15-11-2026; foto banda_sewell.webp). API:
//   const b = await banda(M, { x, z, y?, rot, musicos: 14, publico: true, cuantos, marchar: false, musica: true })
//   → { g, gente, publico, marchar(bool), musica(bool), quitar() }
// N0-BANDA-b (Diego 15-11: «parecen muñecos disfrazados… los del tambor no tienen baquetas»): TODOS con el mismo uniforme (solo tipos
// «musico*» aprobados: gorra de plato, terno oscuro, camisa blanca y corbata; nada de civiles con gorra de código). Varía solo la estatura.
// Instrumentos tomados y tocados SIN capas de Blender: cada instrumento va pegado a un hueso (boca → head, bombo/platillos → chest,
// redoblante → hips) y los brazos se cierran sobre él con IK de dos huesos (uparm/forearm) tras el mezclador. Baquetas, maza y platillos
// van en la palma real (después del IK). Golpes y vara del trombón siguen el reloj de la música (bombo en cada tiempo, redoblante a
// contratiempo alternando manos, platillos en el 1 de cada compás con destello). Formación de banda real: maderas y trompetas adelante,
// bronces graves al medio, percusión atrás; marcha a paso sincronizado (fase de la marcha = tiempo musical).
// Música: marcha ORIGINAL sintetizada aquí (WebAudio, sin archivos ni APIs) con panorámica 3D y el volumen de música del juego.
import * as THREE from 'three';
import { cargarTipo, crearPersona } from '../motor/mallaCiudad.js';
import { AUDIO } from '../motor/audio.js';
import { APROBADOS } from './ciudadViva.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { piezaGrupo, precargarUtileria } from './utileria.js';   // G9 (16-11): instrumentos de malla (G11)

const PUBLICO = ['oficinista', 'senora', 'joven', 'invitada', 'invitado', 'nino1', 'nino2', 'obrero1', 'obrero2', 'obrero20', 'gringo', 'senora20', 'dama', 'padrino'];
const MUSICOS = ['musico2', 'musico5', 'musico6', 'musico1', 'musico3', 'musico4'];   // solo uniformados (se usan los aprobados); 16-11: + musico5 y musico6 (s23)
const URLP = new URLSearchParams(location.search);
const PULSO = 60 / 112, CORCHEA = PULSO / 2;          // marcha 2/4 a 112
// formaciones (fila 0 = adelante). x en metros entre músicos, z entre filas
const FORMACION = {
  14: [['clarinete', 'trompeta', 'trompeta', 'trompeta', 'clarinete'], ['trombon', 'bombardino', 'tuba', 'bombardino', 'trombon'], ['redoblante', 'bombo', 'platillos', 'redoblante']],
  12: [['clarinete', 'trompeta', 'trompeta', 'trompeta', 'clarinete'], ['trombon', 'bombardino', 'tuba', 'trombon'], ['redoblante', 'bombo', 'platillos']],
  10: [['clarinete', 'trompeta', 'trompeta', 'clarinete'], ['trombon', 'tuba', 'bombardino'], ['redoblante', 'bombo', 'platillos']],
  8: [['trompeta', 'clarinete', 'trompeta'], ['trombon', 'tuba'], ['redoblante', 'bombo', 'platillos']],
};
const SEP_X = 1.15, SEP_Z = 1.45;
const MEL = [12, null, 12, 14, 16, null, 12, null, 19, null, 19, 17, 16, null, 14, null, 17, null, 17, 16, 14, null, 11, null, 14, 16, 17, 14, 12, null, null, null,
  12, null, 12, 14, 16, null, 12, null, 19, null, 21, 19, 17, null, 16, null, 14, null, 16, 17, 19, null, 14, null, 12, 11, 12, 14, 12, null, null, null];

async function tiposDisponibles(lista, base) {   // solo los aprobados en el control de calidad (o todos con &cvtodos); base: carpeta (hojas QC)
  const r = [];
  for (const id of lista) { if (!APROBADOS.has(id) && !URLP.has('cvtodos')) continue; try { r.push(await cargarTipo(id, base)); } catch (e) { /* aún no existe */ } }
  return r;
}

// ---------------------------------------------------------------- medidas del tipo (espacio de enlace = persona en el origen, mira a +Z, izquierda = +X)
function medir(T) {
  if (T.banda) return T.banda;
  let alta = null; T.gltf.scene.traverse(o => { if (o.isSkinnedMesh && !alta && /_alta$/.test(o.name)) alta = o; });
  const sk = alta.skeleton, inv = {}, rest = {};
  sk.bones.forEach((b, i) => { inv[b.name] = sk.boneInverses[i]; rest[b.name] = new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert()); });
  const pos = alta.geometry.attributes.position, v = new THREE.Vector3(), W = alta.bindMatrix, hy = rest.head.y;
  let top = -9; for (let i = 0; i < pos.count; i += 2) { v.fromBufferAttribute(pos, i).applyMatrix4(W); if (v.y > top) top = v.y; }
  const by = hy + 0.22 * (top - hy); let bz = -9;
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(W); if (Math.abs(v.x) < 0.03 && Math.abs(v.y - by) < 0.015 && v.z > bz) bz = v.z; }
  if (bz < 0.05) bz = 0.2;
  const qBind = {}; for (const l of ['L', 'R']) { const m = inv['hand' + l].clone().invert(), pp = new THREE.Vector3(), sc = new THREE.Vector3(); qBind[l] = new THREE.Quaternion(); m.decompose(pp, qBind[l], sc); }
  return (T.banda = { inv, rest, qBind, boca: new THREE.Vector3(0, by, bz + 0.005), top });
}

// ---------------------------------------------------------------- instrumentos (geometría compartida; ejes: +Z adelante del músico, +Y arriba, +X su izquierda)
let _G = null;
function geo() {
  if (_G) return _G;
  const bronce = new THREE.MeshStandardMaterial({ color: 0xd2a640, roughness: 0.32, metalness: 0.55, emissive: 0x3a2808, side: THREE.DoubleSide });
  const plata = new THREE.MeshStandardMaterial({ color: 0xb9b6ab, roughness: 0.3, metalness: 0.6, emissive: 0x262626 });
  const negro = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.35 });
  const parche = new THREE.MeshStandardMaterial({ color: 0xece4cf, roughness: 0.8 }), aro = new THREE.MeshStandardMaterial({ color: 0x6e1b1b, roughness: 0.5 });
  const madera = new THREE.MeshStandardMaterial({ color: 0xc89a5e, roughness: 0.6 }), cuero = new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.75 });
  const fieltro = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.95 });
  const tuboE = (a, b, r, mat, seg = 8) => {   // tubo recto entre dos puntos
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return m;
  };
  const campana = (r, l, r0 = 0.008) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r0 + r * Math.pow(t, 3.2), l * t)); } return new THREE.Mesh(new THREE.LatheGeometry(pts, 20), bronce); };
  const boquilla = () => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.004, 0.035, 10), plata); b.rotation.x = Math.PI / 2; b.position.z = 0.017; return b; };
  // corneta/trompeta: boquilla en la boca, pistones a 0,10 m, campana a 0,36 m (compacta: los brazos de la serie son cortos)
  const trompeta = new THREE.Group(); { trompeta.add(boquilla(), tuboE([0, 0, 0.03], [0, -0.012, 0.09], 0.007, bronce), tuboE([0, -0.012, 0.09], [0, -0.012, 0.2], 0.008, bronce),
    tuboE([0, -0.062, 0.07], [0, -0.062, 0.18], 0.008, bronce));
    for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.075, 10), bronce); p.position.set(0, -0.035, 0.105 + k * 0.026); trompeta.add(p);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), plata); t.position.set(0, 0.008, 0.105 + k * 0.026); trompeta.add(t); }
    const c = campana(0.055, 0.17); c.rotation.x = Math.PI / 2; c.position.set(0, -0.012, 0.2); trompeta.add(c);
    const u = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI), bronce); u.rotation.y = Math.PI / 2; u.position.set(0, -0.037, 0.07); u.rotation.z = Math.PI / 2; trompeta.add(u); }
  // trombón: vara (parte móvil «vara») adelante, campana sobre el lado izquierdo; la mano derecha toma la barra de la vara
  const trombon = new THREE.Group(); { trombon.add(boquilla());
    trombon.add(tuboE([0, 0, 0.03], [0, -0.01, 0.36], 0.006, bronce), tuboE([0, -0.07, 0.0], [0, -0.07, 0.36], 0.006, bronce), tuboE([0, -0.01, 0.0], [0, -0.07, 0.0], 0.006, bronce));
    const vara = new THREE.Group(); vara.name = 'vara';
    vara.add(tuboE([0, -0.01, 0.13], [0, -0.01, 0.52], 0.0085, bronce), tuboE([0, -0.07, 0.13], [0, -0.07, 0.52], 0.0085, bronce), tuboE([0, -0.01, 0.2], [0, -0.07, 0.2], 0.005, bronce));
    const u = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0085, 6, 12, Math.PI), bronce); u.rotation.set(0, Math.PI / 2, Math.PI / 2); u.position.set(0, -0.04, 0.52); vara.add(u);
    trombon.add(vara);
    trombon.add(tuboE([0, 0, 0.02], [0.07, 0.04, -0.12], 0.007, bronce), tuboE([0.07, 0.04, -0.12], [0.07, 0.05, 0.14], 0.009, bronce));
    const c = campana(0.08, 0.2); c.rotation.x = Math.PI / 2; c.position.set(0.07, 0.05, 0.14); trombon.add(c); }
  // clarinete: tubo negro de la boca hacia abajo y adelante (35°), llaves plateadas y campana
  const clarinete = new THREE.Group(); { const t = new THREE.Group(); t.rotation.x = Math.PI - 0.62; clarinete.add(t);
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.5, 10), negro); cuerpo.position.y = 0.26; t.add(cuerpo);
    const bq = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, 0.05, 10), negro); bq.position.y = 0.02; t.add(bq);
    for (let k = 0; k < 6; k++) { const ll = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.012), plata); ll.position.set(0, 0.12 + k * 0.05, -0.012); t.add(ll); }
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.013, 0.07, 14), negro); c.position.y = 0.54; t.add(c); }
  // bombardino y tuba: cuerpo vertical al lado derecho del pecho, campana arriba, tudel a la boca y pistones al frente
  const vertical = (k, bx, by0, by1, bz, rb) => { const g = new THREE.Group(); g.add(boquilla());
    g.add(tuboE([0, 0, 0.03], [bx * 0.5, -0.06, 0.1], 0.007, bronce), tuboE([bx * 0.5, -0.06, 0.1], [bx + 0.03, by0 * 0.45, bz + 0.05], 0.009, bronce));
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * k, 0.065 * k, by1 - by0 - 0.06, 14), bronce); cuerpo.position.set(bx, (by0 + by1) / 2 - 0.03, bz); g.add(cuerpo);
    const fondo = new THREE.Mesh(new THREE.TorusGeometry(0.06 * k, 0.03 * k, 8, 14, Math.PI), bronce); fondo.rotation.set(0, 0, Math.PI); fondo.position.set(bx - 0.045 * k, by0, bz); g.add(fondo);
    const sube = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * k, 0.03 * k, by1 - by0 - 0.05, 10), bronce); sube.position.set(bx - 0.09 * k, (by0 + by1) / 2 - 0.02, bz); g.add(sube);
    const c = campana(rb, 0.16 * k, 0.03 * k); c.position.set(bx - 0.09 * k, by1 - 0.05, bz); g.add(c);
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 10), bronce); p.position.set(bx - 0.025 + i * 0.025, by0 * 0.45, bz + 0.065 * k); g.add(p); }
    return g; };
  const bombardino = vertical(1, -0.03, -0.42, 0.0, 0.07, 0.11);
  const tuba = vertical(1.3, -0.03, -0.6, 0.06, 0.08, 0.16);
  // redoblante (aro rojo, parches, bordonera) y su correa; baquetas aparte
  const redoblante = new THREE.Group(); { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.13, 22, 1, true), plata); redoblante.add(c);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.006, 22), parche); p.position.y = s * 0.065; redoblante.add(p);
      const a = new THREE.Mesh(new THREE.TorusGeometry(0.173, 0.009, 6, 22), aro); a.rotation.x = Math.PI / 2; a.position.y = s * 0.065; redoblante.add(a); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; redoblante.add(tuboE([Math.cos(a) * 0.176, -0.06, Math.sin(a) * 0.176], [Math.cos(a) * 0.176, 0.06, Math.sin(a) * 0.176], 0.003, plata, 4)); } }
  // bombo (eje izquierda-derecha) con platillo montado arriba
  const bombo = new THREE.Group(); { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.22, 24, 1, true), aro); c.rotation.z = Math.PI / 2; bombo.add(c);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.232, 0.232, 0.006, 24), parche); p.rotation.z = Math.PI / 2; p.position.x = s * 0.11; bombo.add(p);
      const a = new THREE.Mesh(new THREE.TorusGeometry(0.233, 0.012, 6, 24), madera); a.rotation.y = Math.PI / 2; a.position.x = s * 0.11; bombo.add(a); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; bombo.add(tuboE([-0.11, Math.cos(a) * 0.236, Math.sin(a) * 0.236], [0.11, Math.cos(a) * 0.236, Math.sin(a) * 0.236], 0.003, plata, 4)); }
    bombo.add(tuboE([0.03, 0.23, 0.02], [0.03, 0.29, 0.04], 0.006, plata)); }
  // G9 (16-11): bombo de malla (G11 bombo: caja roja con aros, tensores de bronce y parches de cuero, 0,75 m) achicado ×0,62 al bombo de la
  // banda (Ø 0,46, eje izquierda-derecha: los parches miran a los costados, donde pega la maza); el soporte del platillo sigue en código.
  // Respaldo: el bombo de cilindros (utilería apagada o sin cargar)
  const bomboM = (() => { const m = piezaGrupo('bombo', [0.62, 0.62, 0.58]); if (!m) return null; m.rotation.y = Math.PI / 2; m.position.y = -0.375 * 0.62;
    const gg = new THREE.Group(); gg.add(m, tuboE([0.03, 0.2, 0.02], [0.03, 0.29, 0.04], 0.006, plata)); return gg; })();
  // G9 (16-11): redoblante de malla (G11 redoblante s7: caja de latón y madera con parche de cuero, tiros y orejas) ×[0,85 0,53 0,85] =
  // Ø 0,34 × 0,16 m (proporción de redoblante real), centrado como el de cilindros; respaldo: el de cilindros
  const redoblanteM = (() => { const m = piezaGrupo('redoblante', [0.85, 0.53, 0.85]); if (!m) return null; m.position.y = -0.3 * 0.53 / 2; const gg = new THREE.Group(); gg.add(m); return gg; })();
  const platillo = r => { const pts = [new THREE.Vector2(0, 0.022), new THREE.Vector2(r * 0.22, 0.016), new THREE.Vector2(r * 0.3, 0.006), new THREE.Vector2(r, -0.006)];
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), bronce); const gg = new THREE.Group(); gg.add(m);
    const asa = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 10), cuero); asa.rotation.x = Math.PI / 2; asa.position.y = 0.035; gg.add(asa); return gg; };   // eje del platillo = +Y (cúpula hacia +Y)
  const baqueta = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.0075, 0.4, 7), madera); b.position.y = 0.2 - 0.06; baqueta.add(b);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), madera); p.position.y = 0.4 - 0.06; baqueta.add(p); }   // eje +Y desde la palma (0,06 m detrás)
  const maza = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.3, 7), madera); b.position.y = 0.15 - 0.05; maza.add(b);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), fieltro); p.position.y = 0.3 - 0.05; maza.add(p); }
  const correa = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cuero);   // escalada entre dos puntos
  const brillo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,250,215,1)'); gr.addColorStop(0.25, 'rgba(255,225,140,0.7)'); gr.addColorStop(1, 'rgba(255,200,90,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); })();
  // rendimiento (iGPU): cada instrumento en 1-3 mallas (una por material) en vez de 10-30 piezas; la vara del trombón queda aparte (se mueve)
  const fusionar = (gr, salvo) => {
    gr.updateMatrixWorld(true); const porMat = new Map(), out = new THREE.Group();
    gr.traverse(o => { if (!o.isMesh) return; for (let x = o.parent; x && x !== gr; x = x.parent) if (x === salvo) return;
      const gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); gg.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
      if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
      (porMat.get(o.material) || porMat.set(o.material, []).get(o.material)).push(gg); });
    for (const [m, l] of porMat) out.add(new THREE.Mesh(mergeGeometries(l), m));
    if (salvo) { const v = fusionar(salvo); v.name = salvo.name; out.add(v); }
    return out;
  };
  const F = o => fusionar(o, o.getObjectByName('vara'));
  return (_G = { trompeta: F(trompeta), trombon: F(trombon), clarinete: F(clarinete), bombardino: F(bombardino), tuba: F(tuba), redoblante: redoblanteM || F(redoblante), bombo: bomboM || F(bombo),
    platillo: r => fusionar(platillo(r)), baqueta: F(baqueta), maza: F(maza), correa, brillo });
}

// ---------------------------------------------------------------- definición por instrumento
// hueso: al que va pegado; donde(B): lugar en reposo (espacio de la persona); manos(tm, q): puntos de las palmas en el espacio del instrumento;
// polo: hacia dónde apuntan los codos (espacio de la persona, por lado: s = +1 izquierda, -1 derecha)
const fase = (tm, periodo, desfase = 0) => ((((tm / periodo - desfase) % 1) + 1) % 1);
const golpe = u => Math.pow(Math.sin(Math.PI * u), 0.8);   // 0 en el golpe, sube y vuelve a bajar
const DEF = {
  trompeta: { hueso: 'head', donde: B => B.boca, incl: 0.2, manos: () => ({ R: [-0.012, 0.0, 0.11], L: [0.03, -0.05, 0.12] }), polo: s => [s * 0.5, -0.6, -0.1] },
  clarinete: { hueso: 'head', donde: B => B.boca, manos: () => ({ L: [0.0, -0.14, 0.1], R: [0.0, -0.27, 0.19] }), polo: s => [s * 0.6, -0.4, -0.1] },
  trombon: { hueso: 'head', donde: B => B.boca, incl: 0.42, manos: (tm, q) => ({ L: [0.03, -0.06, 0.07], R: [-0.01, -0.04, 0.2 + q.vara] }), polo: s => [s * 0.5, -0.6, -0.2] },
  bombardino: { hueso: 'head', donde: B => B.boca, manos: () => ({ R: [-0.03, -0.15, 0.15], L: [0.05, -0.3, 0.07] }), polo: s => [s * 0.6, -0.5, -0.2] },
  tuba: { hueso: 'head', donde: B => B.boca, manos: () => ({ R: [-0.03, -0.24, 0.17], L: [0.07, -0.4, 0.08] }), polo: s => [s * 0.6, -0.5, -0.2] },
  redoblante: { hueso: 'hips', donde: () => new THREE.Vector3(0.1, 0.73, 0.32), polo: s => [s * 0.7, -0.4, -0.4],
    manos: (tm, q) => { const hR = golpe(fase(tm, 4 * CORCHEA, 0.25)), hL = golpe(fase(tm, 4 * CORCHEA, 0.75));   // contratiempos alternados (i ≡ 1 y 3 mod 4)
      q.altR = hR; q.altL = hL; return { R: [-0.13, 0.17 + 0.08 * hR, -0.12], L: [0.12, 0.18 + 0.08 * hL, -0.13] }; } },
  bombo: { hueso: 'chest', donde: () => new THREE.Vector3(0, 0.92, 0.37), polo: s => [s * 0.7, -0.4, -0.3],
    manos: (tm, q) => { const h = golpe(fase(tm, PULSO)), c = golpe(fase(tm, 2 * PULSO)); q.altR = h; q.altL = c;
      return { R: [-0.33 - 0.07 * h, 0.03 + 0.08 * h, -0.07], L: [0.06, 0.33 + 0.07 * c, -0.02] }; } },
  platillos: { hueso: 'chest', donde: () => new THREE.Vector3(0, 1.04, 0.36), polo: s => [s * 0.6, -0.5, -0.3],
    manos: (tm, q) => { const u = fase(tm, 2 * PULSO), ab = 0.035 + 0.15 * golpe(u); q.abre = ab; q.uChoque = u;
      return { L: [ab, 0.02 * Math.sin(u * Math.PI), 0], R: [-ab, 0.02 * Math.sin(u * Math.PI), 0] }; } },
};

// ---------------------------------------------------------------- IK de dos huesos (en el mundo) con la palma como efector
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3(), _d = new THREE.Vector3(), _pn = new THREE.Vector3(), _E2 = new THREE.Vector3(),
  _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _T2 = new THREE.Vector3();
function girar(bone, desde, hacia) {
  _q.setFromUnitVectors(desde.normalize(), hacia.normalize());
  bone.getWorldQuaternion(_qw); _qw.premultiply(_q); bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_qw)); bone.updateMatrixWorld(true);
}
function ik(up, fo, ha, T, polo, palma) {
  _S.setFromMatrixPosition(up.matrixWorld); _E.setFromMatrixPosition(fo.matrixWorld); _W.setFromMatrixPosition(ha.matrixWorld);
  const a = _S.distanceTo(_E), b = _E.distanceTo(_W) + palma;
  const dd = _S.distanceTo(T), d = Math.max(Math.abs(a - b) + 1e-3, Math.min(dd, (a + b) * 0.999));
  _d.copy(T).sub(_S).normalize();
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  _pn.copy(polo).sub(_S); _pn.addScaledVector(_d, -_pn.dot(_d)).normalize();
  _E2.copy(_S).addScaledVector(_d, x).addScaledVector(_pn, h);
  girar(up, _a.copy(_E).sub(_S), _b.copy(_E2).sub(_S));
  _E.setFromMatrixPosition(fo.matrixWorld); _W.setFromMatrixPosition(ha.matrixWorld);
  _T2.copy(_S).addScaledVector(_d, d);
  girar(fo, _a.copy(_W).sub(_E), _b.copy(_T2).sub(_E));
}
const _gq = new THREE.Quaternion(), _qm = new THREE.Quaternion(), _F = new THREE.Vector3(), _N = new THREE.Vector3(), _C = new THREE.Vector3(), _Fw = new THREE.Vector3(),
  _F0 = new THREE.Vector3(), _N0 = new THREE.Vector3(), _B0 = new THREE.Matrix4(), _B1 = new THREE.Matrix4();
// manos por instrumento: [dedos, cara de la palma] en el espacio de la persona (+Z adelante, +X su izquierda)
const MANOS = {
  trompeta: { R: [[0.1, -0.3, 1], [0, -1, 0]], L: [[-0.2, -0.3, 1], [-1, 0, 0]] },
  clarinete: { L: [[-1, 0, 0.3], [0, 0, 1]], R: [[1, 0, 0.3], [0, 0, 1]] },
  trombon: { L: [[0, 1, 0.3], [-1, 0, 0]], R: [[0.2, -0.4, 1], [1, 0, 0]] },
  bombardino: { L: [[-0.3, 0, 1], [-1, 0, 0]], R: [[0.2, -0.3, 1], [0, -1, 0]] },
  tuba: { L: [[-0.3, 0, 1], [-1, 0, 0]], R: [[0.2, -0.3, 1], [0, -1, 0]] },
  redoblante: { L: [[-0.3, -0.2, 1], [0, -1, 0]], R: [[0.3, -0.2, 1], [0, -1, 0]] },
  bombo: { L: [[-0.2, 0, 1], [0, -1, 0]], R: [[0.3, -0.3, 1], [1, 0, 0]] },
  platillos: { L: [[0, 1, 0.4], [-1, 0, 0]], R: [[0, 1, 0.4], [1, 0, 0]] },
};
function palmaDe(H, lado, out) {   // palma real (mundo): muñeca + 0,075 m en la dirección del antebrazo (= mallaCiudad.medirProps)
  _W.setFromMatrixPosition(H['hand' + lado].matrixWorld); _E.setFromMatrixPosition(H['forearm' + lado].matrixWorld);
  return out.copy(_W).add(_E.sub(_W).negate().normalize().multiplyScalar(H.palma));
}
const _Y = new THREE.Vector3(0, 1, 0);
function entre(m, A, B, ancho, grueso = 0.006) {   // correa entre dos puntos (espacio del padre)
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(_Y, _a.copy(B).sub(A).normalize()); m.scale.set(ancho, A.distanceTo(B), grueso);
}

// ---------------------------------------------------------------- un músico
function armarMusico(T, inst, escala) {
  const B = medir(T), D = DEF[inst], G = geo();
  const p = crearPersona(T, { anim: 'idle', variar: { uniforme: true, sinSombrero: true } });   // N0-NPC-UNICOS: mismo uniforme, cara/edad/bigote/estatura distintos
  p.g.scale.setScalar(escala);
  const H = { palma: 0.075 };
  p.escena.traverse(o => { if (o.isBone) H[o.name] = o; });
  const q = { p, inst, D, H, B, s: escala, vara: 0, abre: 0.1, altR: 0, altL: 0, uChoque: 0.5, extra: {} };
  // instrumento: matriz = (hueso ahora) · (hueso en reposo)⁻¹ · lugar en reposo; todo en el espacio de la persona (hijo de p.g)
  q.lugar = new THREE.Matrix4().makeTranslation(D.donde(B));
  if (D.incl) q.lugar.multiply(new THREE.Matrix4().makeRotationX(D.incl));
  if (inst === 'redoblante') q.lugar.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.12, 0, 0.22)));
  q.obj = inst === 'platillos' ? new THREE.Group() : G[inst].clone();
  q.obj.matrixAutoUpdate = false; p.g.add(q.obj);
  const x = q.extra;
  if (inst === 'trombon') x.vara = q.obj.getObjectByName('vara');
  if (inst === 'redoblante') { x.bR = G.baqueta.clone(); x.bL = G.baqueta.clone(); x.correa = G.correa.clone(); p.g.add(x.bR, x.bL, x.correa); }
  if (inst === 'bombo') { x.maza = G.maza.clone(); x.plato = G.platillo(0.13); x.fijo = G.platillo(0.15); q.obj.add(x.fijo); x.fijo.position.set(0.03, 0.3, 0.04); x.fijo.rotation.x = 0.15;
    x.cL = G.correa.clone(); x.cR = G.correa.clone(); p.g.add(x.maza, x.plato, x.cL, x.cR); }
  if (inst === 'platillos') { x.pL = G.platillo(0.19); x.pR = G.platillo(0.19); x.luz = new THREE.Sprite(G.brillo); x.luz.scale.setScalar(0.6); x.luz.visible = false; p.g.add(x.pL, x.pR, x.luz); }
  for (const o of [q.obj, ...Object.values(x)]) o && o.traverse && o.traverse(m => { m.castShadow = false; });
  return q;
}
const _M = new THREE.Matrix4(), _Mi = new THREE.Matrix4(), _P = new THREE.Vector3(), _P2 = new THREE.Vector3(), _L = new THREE.Vector3(), _R = new THREE.Vector3(), _pol = new THREE.Vector3();
function tocar(q, tm) {   // después del mezclador: instrumento al hueso, brazos con IK, baquetas/maza/platillos en las palmas
  const { p, D, H, B, obj, extra: x } = q;
  p.g.updateMatrixWorld(true);
  _Mi.copy(p.g.matrixWorld).invert();
  const hb = H[D.hueso];
  _M.multiplyMatrices(_Mi, hb.matrixWorld).multiply(B.inv[D.hueso]).multiply(q.lugar);
  obj.matrix.copy(_M); obj.matrixWorldNeedsUpdate = true; obj.updateMatrixWorld(true);
  if (x.vara) { const i = Math.floor(tm / CORCHEA) % 64, m = MEL[i]; const obj2 = m == null ? q.vara : Math.min(0.13, Math.max(0, (21 - m) * 0.014)); q.vara += (obj2 - q.vara) * 0.35; x.vara.position.z = q.vara; }
  const man = D.manos(tm, q);
  const mq = MANOS[q.inst];
  p.g.getWorldQuaternion(_gq);
  for (const lado of ['L', 'R']) {
    const s = lado === 'L' ? 1 : -1, up = H['uparm' + lado], ha = H['hand' + lado];
    _P.fromArray(man[lado]).applyMatrix4(obj.matrixWorld);   // palma deseada (mundo)
    // orientación de la mano: dedos F y cara de la palma N (espacio de la persona) → base; en la pose T los dedos van a ±X y la palma abajo
    const [f, nn] = mq[lado]; _F.fromArray(f).normalize(); _N.fromArray(nn); _N.addScaledVector(_F, -_N.dot(_F)).normalize();
    _B1.makeBasis(_F, _N, _C.crossVectors(_F, _N)); _F0.set(s, 0, 0); _N0.set(0, -1, 0); _B0.makeBasis(_F0, _N0, _C.crossVectors(_F0, _N0)).transpose();
    _qm.setFromRotationMatrix(_B1.multiply(_B0)).multiply(B.qBind[lado]).premultiply(_gq);   // mano en el mundo
    _Fw.copy(_F).applyQuaternion(_gq);
    const cl = H['clav' + lado]; _S.setFromMatrixPosition(up.matrixWorld); _E.setFromMatrixPosition(cl.matrixWorld);   // hombro 6 cm hacia el instrumento
    _a.copy(_S).sub(_E); _b.copy(_P).sub(_S).normalize().multiplyScalar(0.06 * q.s).add(_a); girar(cl, _a, _b);
    _pol.fromArray(D.polo(s)).applyMatrix4(p.g.matrixWorld).sub(_P2.setFromMatrixPosition(p.g.matrixWorld)).add(_S.setFromMatrixPosition(up.matrixWorld));
    const mun = _P.clone().addScaledVector(_Fw, -H.palma * q.s);   // muñeca = palma − dedos·7,5 cm
    ik(up, H['forearm' + lado], ha, mun, _pol.clone(), 0);
    ha.parent.getWorldQuaternion(_qp); ha.quaternion.copy(_qp.invert().multiply(_qm)); ha.updateMatrixWorld(true);
    q['pw' + lado] = (q['pw' + lado] || new THREE.Vector3()).setFromMatrixPosition(ha.matrixWorld).addScaledVector(_Fw, H.palma * q.s);
  }
  // accesorios en la palma real (espacio de la persona)
  const pl = _L.copy(q.pwL).applyMatrix4(_Mi), pr = _R.copy(q.pwR).applyMatrix4(_Mi);
  if (q.inst === 'redoblante') {   // baquetas desde la palma hacia el punto de golpe del parche (se levantan con la mano)
    for (const [b, P, sx, alt] of [[x.bR, pr, -0.05, q.altR], [x.bL, pl, 0.05, q.altL]]) {   // la punta en el parche (o levantada); la baqueta pasa por la palma
      _P.set(sx, 0.07 + 0.2 * alt, 0.0).applyMatrix4(obj.matrix);
      _P2.copy(_P).sub(P).normalize(); b.quaternion.setFromUnitVectors(_Y, _P2); b.position.copy(_P).addScaledVector(_P2, -0.34);
    }
    _P.setFromMatrixPosition(H.clavR.matrixWorld).applyMatrix4(_Mi).add(_P2.set(-0.07, 0.07, 0));
    _P2.set(0.17, 0.03, -0.02).applyMatrix4(obj.matrix); entre(x.correa, _P, _P2, 0.045);
  }
  if (q.inst === 'bombo') {
    _P.set(-0.16, 0.2 * q.altR, 0.0).applyMatrix4(obj.matrix); _P2.copy(_P).sub(pr).normalize();   // la bola de la maza en el parche derecho
    x.maza.quaternion.setFromUnitVectors(_Y, _P2); x.maza.position.copy(_P).addScaledVector(_P2, -0.25);
    x.plato.position.copy(pl).add(_P.set(0, -0.03, 0.02)); x.plato.quaternion.setFromUnitVectors(_Y, _P.set(0, 1, -0.15).normalize());   // plato de mano sobre el fijo   // plato de mano boca abajo sobre el platillo fijo
    for (const [c, lado, sx] of [[x.cL, 'L', 0.13], [x.cR, 'R', -0.13]]) {
      _P.setFromMatrixPosition(H['clav' + lado].matrixWorld).applyMatrix4(_Mi).add(_P2.set(sx * 0.6, 0.07, 0.02));
      _P2.set(sx, 0.2, -0.12).applyMatrix4(obj.matrix); entre(c, _P, _P2, 0.04);
    }
  }
  if (q.inst === 'platillos') {   // cada platillo en su palma, la cara cóncava hacia el otro; destello en el choque (1 de cada compás)
    x.pL.position.copy(pl).add(_P.set(-0.04, 0, 0.02)); x.pL.quaternion.setFromUnitVectors(_Y, _P.set(1, 0, 0.15).normalize());
    x.pR.position.copy(pr).add(_P.set(0.04, 0, 0.02)); x.pR.quaternion.setFromUnitVectors(_Y, _P.set(-1, 0, 0.15).normalize());
    x.luz.visible = q.uChoque < 0.09; if (x.luz.visible) { x.luz.position.copy(pl).add(pr).multiplyScalar(0.5).add(_P.set(0, 0.12, 0.08)); x.luz.scale.setScalar(0.12 + 0.4 * (1 - q.uChoque / 0.09)); }
  }
}

export async function banda(M, op = {}) {
  const x = op.x ?? 0, z = op.z ?? 0, rot = op.rot ?? 0;
  const y = op.y ?? (() => { const h = M.fis && M.fis.rayo({ x, y: 400, z }, { x: 0, y: -1, z: 0 }, 900); return h ? h.punto.y : 0; })();
  const tipos = await tiposDisponibles(op.tipos || MUSICOS, op.base);
  if (!_G) await Promise.race([precargarUtileria() || 0, new Promise(r => setTimeout(r, 4000))]);   // G9 (16-11): instrumentos de malla si la utilería llega a tiempo (máx. 4 s)
  if (!tipos.length) return null;   // sin músicos uniformados aprobados no hay banda (nunca civiles disfrazados)
  const n = op.musicos ?? 14, k = n >= 14 ? 14 : n >= 12 ? 12 : n >= 10 ? 10 : 8, filas = FORMACION[k];
  const g = new THREE.Group(); g.name = 'banda'; g.position.set(x, y, z); g.rotation.y = rot; M.escena.add(g);
  const gente = []; let idx = 0;
  const z0 = (filas.length - 1) * SEP_Z / 2;   // la fila del medio en el origen
  filas.forEach((fila, f) => fila.forEach((inst, c) => {
    const T = tipos[idx % tipos.length], esc = 0.97 + 0.06 * ((idx * 0.618) % 1);
    const q = armarMusico(T, inst, esc);
    q.p.g.position.set((c - (fila.length - 1) / 2) * SEP_X, 0, z0 - f * SEP_Z); q.p.lod(0, f === 0);
    g.add(q.p.g); gente.push(q); idx++;
  }));
  // público: semicírculo delante de la banda, mirándola, aplaudiendo a ratos
  const publico = [];
  if (op.publico) {
    const tp = await tiposDisponibles(op.tiposPublico || PUBLICO, op.base);
    const kk = Math.min(op.cuantos ?? 10, tp.length ? 14 : 0);
    for (let i = 0; i < kk; i++) {
      const a = -1.1 + 2.2 * i / Math.max(1, kk - 1), r = 6.5 + (i % 2) * 1.2, p = crearPersona(tp[i % tp.length], { anim: 'idle', capa: 'b_aplaudir' });
      p.g.position.set(Math.sin(a) * r, 0, z0 + 1 + Math.cos(a) * r - 2); p.g.rotation.y = Math.atan2(-p.g.position.x, -(p.g.position.z - 0.5));
      p.lod(1, false); g.add(p.g); publico.push({ p, fase: Math.random() * 6 });
    }
  }
  // ---- música: marcha original 2/4 a 112. Bronces, tuba, bombo en cada tiempo, redoblante a contratiempo, platillos en el 1 de cada compás
  let audio = null, t0 = null;
  const crearMusica = () => {
    const ctx = AUDIO.ctx; if (!ctx || audio) return;
    const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 8; pan.maxDistance = 140; pan.rolloffFactor = 1.2;
    const sal = ctx.createGain(); sal.gain.value = 0.55; sal.connect(pan); pan.connect(AUDIO.busMusica || AUDIO.maestro || ctx.destination);
    const ruido = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate); { const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const nota = (frec, t, dur, vol, tipo = 'sawtooth', corte = 2200) => {
      const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), e = ctx.createGain();
      o.type = tipo; o.frequency.value = frec; fl.type = 'lowpass'; fl.frequency.value = corte; fl.Q.value = 0.7;
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + 0.03); e.gain.setValueAtTime(vol * 0.8, t + dur * 0.7); e.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(fl); fl.connect(e); e.connect(sal); o.start(t); o.stop(t + dur + 0.02);
    };
    const golpeS = (t, vol, corte, dur, grave = 0, banda2 = 0) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), e = ctx.createGain(); s.buffer = ruido;
      fl.type = grave ? 'lowpass' : banda2 ? 'bandpass' : 'highpass'; fl.frequency.value = corte; if (banda2) fl.Q.value = 0.6;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(fl); fl.connect(e); e.connect(sal); s.start(t); s.stop(t + dur);
      if (grave) { const o = ctx.createOscillator(), eo = ctx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + dur);
        eo.gain.setValueAtTime(vol * 1.4, t); eo.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(eo); eo.connect(sal); o.start(t); o.stop(t + dur); }
    };
    const ACO = [0, 0, 5, 5, 7, 7, 0, 0, 0, 0, 5, 5, 7, 7, 0, 0];
    const base = 233.08 / 2, f = s => base * Math.pow(2, s / 12);
    let paso = 0, tSig = ctx.currentTime + 0.2; t0 = tSig;
    const prog = () => {
      while (tSig < ctx.currentTime + 0.6) {
        const i = paso % 64, comp = Math.floor(i / 4), t = tSig;
        const m = MEL[i]; if (m != null) { nota(f(m), t, CORCHEA * 0.95, 0.09); nota(f(m - 12), t, CORCHEA * 0.95, 0.035, 'square', 1400); }
        if (i % 2 === 0) { const r = ACO[comp % 16]; nota(f(r - 24 + (i % 4 ? 7 : 0)), t, CORCHEA * 1.6, 0.11, 'triangle', 600); }   // tuba
        if (i % 2 === 0) golpeS(t, i % 4 ? 0.32 : 0.5, 120, 0.35, 1);       // bombo en el 1 y el 2
        if (i % 2 === 1) golpeS(t, 0.16, 1800, 0.09);                      // redoblante a contratiempo
        if (i % 4 === 0) { golpeS(t, 0.13, 6500, 1.1); golpeS(t, 0.06, 3200, 0.5, 0, 1); }   // platillos de choque en el 1 de cada compás
        tSig += CORCHEA; paso++;
      }
    };
    const id = setInterval(prog, 120); prog();
    audio = { pan, sal, parar() { clearInterval(id); sal.gain.setTargetAtTime(0, ctx.currentTime, 0.2); setTimeout(() => sal.disconnect(), 1500); } };
  };
  let suena = op.musica !== false, marcha = !!op.marchar, t = 0, tSin = 0, base = '';
  const ciclo = 2 * PULSO;   // un ciclo de marcha = 2 pasos = 2 tiempos
  const _w = new THREE.Vector3();
  const tiempoMusical = () => (audio && AUDIO.ctx && t0 != null ? Math.max(0, AUDIO.ctx.currentTime - t0) : tSin);
  const ent = M.L && M.L.agregar({ tipo: 'banda', vivo: true, sala: null, act(dt) {
    t += dt; tSin += dt;
    if (!M.salaActual) {
      const cam = M.cam && M.cam.cam ? M.cam.cam.position : M.jug.pos;
      g.getWorldPosition(_w); const j = M.jug.pos, d = Math.min(_w.distanceTo(cam), Math.hypot(_w.x - j.x, _w.y - j.y, _w.z - j.z)), cada = d < 15 ? 1 : d < 40 ? 2 : 4;   // iGPU: animación e IK cada 2 cuadros pasado 15 m
      g.visible = d < 110;
      const tm = tiempoMusical();
      if (g.visible) {
        const quiere = marcha ? 'caminar' : 'idle', toca = Math.floor(t * 60) % cada === 0;
        for (const q of gente) {
          if (base !== quiere) q.p.poner(quiere, null, { fundido: 0.25 });
          q.p.lod(d < 9 ? 0 : d < 28 ? 1 : 2, d < 20);
          if (toca) { if (marcha) q.p.fase(tm / ciclo); q.p.actualizar(dt * cada); tocar(q, tm); }
        }
        base = quiere;
        for (const q of publico) { q.p.poner(Math.sin(t * 0.5 + q.fase) > -0.2 ? 'idle' : 'hablar', Math.sin(t * 0.5 + q.fase) > -0.2 ? 'b_aplaudir' : null); q.p.lod(d < 30 ? 1 : 2, false); if (toca) q.p.actualizar(dt * cada); }
      }
      if (marcha && gente.length) g.translateZ(dt * (gente[0].p.vel.caminar || 0.64) * velMarcha);
    }
    if (suena && AUDIO.ctx && !AUDIO.mudo) { crearMusica(); if (audio && audio.pan.positionX) { g.getWorldPosition(_w); audio.pan.positionX.value = _w.x; audio.pan.positionY.value = _w.y + 1.5; audio.pan.positionZ.value = _w.z; } }
    if (audio && AUDIO.ctx && AUDIO.ctx.listener.positionX && M.cam && M.cam.cam) { const c = M.cam.cam, L = AUDIO.ctx.listener, fw = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
      L.positionX.value = c.position.x; L.positionY.value = c.position.y; L.positionZ.value = c.position.z; L.forwardX.value = fw.x; L.forwardY.value = fw.y; L.forwardZ.value = fw.z; }
  } });
  // velocidad de avance: el clip de caminar a 1× avanza vel.caminar m/s en su duración; aquí un ciclo dura 2 tiempos
  const durCam = (tipos[0].clips.caminar && tipos[0].clips.caminar.duration) || 1, velMarcha = durCam / ciclo;
  const B = {
    g, gente, publico, ent,
    get tm() { return tiempoMusical(); },
    marchar(v = true) { marcha = v; },
    musica(v = true) { suena = v; if (!v && audio) { audio.parar(); audio = null; t0 = null; } },
    quitar() { B.musica(false); g.removeFromParent(); if (ent) ent.vivo = false; },
  };
  return B;
}

// ---------------------------------------------------------------- enganches (3.er relevo N0-CIUDAD-VIVA; N0-BANDA-b: 14 músicos en 3 filas)
// (a) llegada del tren (final del N1, js/principal.js finalNivel): en el andén (losa y 0,9, z 13-18; la vía va en z 22) mirando a la vía (+Z),
//     3 filas (z 14,5-17,3), sin público (el andén mide 5 m). x: unos 9 m al este de Nato.
export function bandaAnden(M, x) {
  if (M.def && M.def.numero < 2) return null;   // N0-FABLE-1611 (A6): la banda nace en 1923: no recibe el tren de 1905 (N1)
  x = Math.max(-35, Math.min(125, x));
  const s = M.fis && M.fis.suelo ? M.fis.suelo(x, 15.6, 8) : null;
  return banda(M, { x, z: 15.7, y: s != null && s > 0.5 && s < 2 ? s : 0.9, rot: 0, musicos: 14, publico: false });
}
// (b) modo turista (N2 1920 y N4 1967; en el N3 de 1945 no: «tragedia sin celebración»): plaza del barrio cívico, con público. Lo llama ciudadViva.js.
export function bandaPlaza(M, x, z, rot = 0) {
  if (M.def && M.def.numero === 3) return null;   // N0-FABLE-1611 (C2): nunca en el N3
  return banda(M, { x, z, rot, musicos: 14, publico: true, cuantos: 10 });
}
// (c) epílogo «Lanzamiento del Libro» (escena aún NO armada): `const b = await bandaLanzamiento(M, x, z, rot)`; al cerrar `b.quitar()`.
export function bandaLanzamiento(M, x, z, rot = 0) {
  return banda(M, { x, z, rot, musicos: 14, publico: true, cuantos: 14 });
}
