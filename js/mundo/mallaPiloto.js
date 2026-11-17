// Prueba piloto TRELLIS.2 (14-11-2026): con ?malla=1 la Casa Hamilton del N1 se reemplaza por la malla generada localmente con
// TRELLIS.2 en la RX 9070 XT, y se pone a Nato como malla (pose T) junto a ella. Sin el parámetro el juego no cambia.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function suelo(M, x, z, y0) { const r = M.fis.rayo({ x, y: y0 + 60, z }, { x: 0, y: -1, z: 0 }, 200, undefined, ['muro', 'azotea', 'techo', 'balcon', 'baranda']); return r ? r.punto.y : y0; }   // el terreno, no la colisión de la casa

async function poner(M, esc, url, { x, z, largo, alto, yaw = 0, nombre }) {
  const g = (await new GLTFLoader().loadAsync(url)).scene;
  const caja = new THREE.Box3().setFromObject(g), tam = caja.getSize(new THREE.Vector3());
  const k = largo ? largo / Math.max(tam.x, tam.z) : alto / tam.y;
  const piv = new THREE.Group(); piv.name = nombre;
  g.position.set(-(caja.min.x + caja.max.x) / 2, -caja.min.y, -(caja.min.z + caja.max.z) / 2);   // centrado en planta, base en y = 0
  piv.add(g); piv.scale.setScalar(k); piv.rotation.y = yaw;
  piv.position.set(x, suelo(M, x, z, 150), z);
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  esc.add(piv);
  return piv;
}

export async function mallaPiloto(M, esc) {
  const H = { x: -350, z: -330 };
  // oculta la Hamilton de gaussianas (las nubes grandes dentro de 9 m de su centro; no toca personajes animados)
  const p = new THREE.Vector3();
  esc.traverse(o => { if (o.packedSplats && !o.skinning) { o.getWorldPosition(p); if (Math.hypot(p.x - H.x, p.z - H.z) < 9) o.visible = false; } });
  await poner(M, esc, 'assets3d/trellis/hamilton.glb', { ...H, largo: 13.9, yaw: 0, nombre: 'hamilton_trellis' });
  console.log('mallaPiloto: Hamilton de TRELLIS.2 puesta (Nato malla lo pone jugador.js)');
}
