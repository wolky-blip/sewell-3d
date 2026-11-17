// Rellano de tierra apisonada (carril ciudad): superficie plana (elipse achatada) a la cota más alta del suelo bajo ella, hundida en el
// cerro por arriba y con falda suave (~28°) por abajo, con colisión. La malla del terreno tiene vértices cada 5 m: una TERRAZA de pocos
// metros no la aplana, por eso es un cuerpo propio. Usos: fogatas en ladera (N0-FOG) y playa de las ollas del molino (N0-OLLAS).
import * as THREE from 'three';
import { mat } from './construir.js';
import { matMundo } from './terreno.js';
// Diego 15-11: «las fogatas tienen bases pero falta darles textura» → tierra del terreno en coordenadas de mundo (misma textura y escalas que el suelo)
const MATS = new Map();
function matRellano(color) { if (!MATS.has(color)) { const m = matMundo('suelo_tierra', 7, color, { mezcla: 0.35 }); m.side = THREE.DoubleSide; m.roughness = 1; MATS.set(color, m); } return MATS.get(color); }

// cx, cz: centro; rot: giro (rad, three: rotation.y) del eje largo; hl, hw: semiejes. Devuelve { top, mallas } o null si ya es plano.
export function rellano(fis, grupo, cx, cz, rot, hl, hw, op = {}) {
  const c = Math.cos(rot), s = Math.sin(rot), W = (u, v) => [cx + u * c + v * s, cz - u * s + v * c];   // u a lo largo, v a lo ancho
  if (op.omitirSobre) {   // el centro ya está sobre una losa/plaza (etiqueta): no se pone un montículo de tierra sobre el pavimento
    const h0 = fis.rayo({ x: cx, y: fis.suelo(cx, cz, 1200) + 3, z: cz }, { x: 0, y: -1, z: 0 }, 6), et = h0 && h0.col && fis.etiquetas.get(h0.col.handle);
    if (et && op.omitirSobre.includes(et.tipo)) return null;
  }
  let hi = -1e9, lo = 1e9;
  const hc = fis.suelo(cx, cz, 1200), tope = hc + 3.5;   // lo que pasa de ahí es un techo o un muro vecino, no el suelo
  const nU = Math.max(3, Math.ceil(hl * 2 / 1.2)), nV = Math.max(3, Math.ceil(hw * 2 / 1.2));
  for (let i = 0; i <= nU; i++) for (let j = 0; j <= nV; j++) {
    const u = -hl + 2 * hl * i / nU, v = -hw + 2 * hw * j / nV; if ((u / hl) ** 2 + (v / hw) ** 2 > 1.3) continue;
    const [x, z] = W(u, v), h = fis.suelo(x, z, hc + 40); if (h > tope) continue; hi = Math.max(hi, h); lo = Math.min(lo, h);
  }
  if (hi < -1e8 || (hi - lo < (op.minDesnivel ?? 0.12) && !op.siempre)) return null;
  const top = hi + 0.03, NA = op.na || 28, pos = [cx, top, cz], base = [];
  for (let k = 0; k < NA; k++) {
    const a = k / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), q = 0.5;
    const u = hl * Math.sign(ca) * Math.abs(ca) ** q, v = hw * Math.sign(sa) * Math.abs(sa) ** q, nu = u / (hl * hl), nv = v / (hw * hw), nl = Math.hypot(nu, nv) || 1;
    const [x0, z0] = W(u, v), dx = (nu * c + nv * s) / nl, dz = (-nu * s + nv * c) / nl;
    pos.push(x0, top, z0);
    let rr = 8, yb = top - 0.5;
    for (let r = 0; r <= 8; r += 0.5) { const h = fis.suelo(x0 + dx * r, z0 + dz * r, top + 40); if (h >= top - r * (op.pend ?? 0.6)) { rr = r; yb = h - 0.35; break; } if (r >= 8) yb = h - 0.35; }
    base.push(x0 + dx * Math.max(rr, 0.4), Math.min(yb, top - 0.3), z0 + dz * Math.max(rr, 0.4));
  }
  const idx = [];
  for (let k = 0; k < NA; k++) { const k2 = (k + 1) % NA; idx.push(0, 1 + k2, 1 + k); idx.push(1 + k, 1 + k2, 1 + NA + k2); idx.push(1 + k, 1 + NA + k2, 1 + NA + k); }
  for (let k = 0; k < NA; k++) pos.push(base[k * 3], base[k * 3 + 1], base[k * 3 + 2]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, matRellano(op.color ?? 0xf2dcb8)); m.name = op.nombre || 'rellano'; m.receiveShadow = true; grupo.add(m);
  fis.convexo(new Float32Array(pos), { tipo: 'tierra' });
  return { top, lo, hi };
}
