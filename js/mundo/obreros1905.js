// N1-MOLINO (carril kit, 15-11-2026). Diego: «en su interior hay trabajando arrieros y debería haber obreros». OBREROS DE FUNDICIÓN de 1905:
// misma malla de hombre que la gente de 1905 (persona1905 de gente1905.js, malla doliente_minero con esqueleto), SIN manta ni chupalla, con
// accesorios hechos en código colgados de los huesos: gorra de paño o sombrero de fieltro gastado, antiparras oscuras de fundidor (algunos),
// pañuelo al cuello, delantal largo de cuero grueso, guantes de cuero, ropa tiznada de hollín; y su herramienta en las manos: barra de fierro
// para picar el horno, pala, rastrillo de escoria o tenazas. No toca gente1905.js: agrega el tipo y la fábrica en tiempo de ejecución.
// Spec: { t: 'fundidor', x, z, y, mira: [x, z], herramienta: 'barra'|'pala'|'rastrillo'|'tenazas', gorro: 'gorra'|'fieltro', antiparras, texto }
import * as THREE from 'three';
import { persona1905, TIPOS_1905 } from './gente1905.js';
import { FABRICA_VIDA } from './vidaMinera.js';

const MT = {};
const m = (k, color, op = {}) => MT[k] ||= new THREE.MeshStandardMaterial({ color, roughness: op.r ?? 0.9, metalness: op.me ?? 0 });
const malla = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; return o; };
// colgar como en gente1905.js: se pone en el marco del personaje y se pasa al hueso con attach() (conserva la pose)
function colgar(g, hueso, obj, x, y, z, rx = 0, ry = 0, rz = 0) { g.add(obj); obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz); g.updateMatrixWorld(true); hueso.attach(obj); }

function gorra(k) {   // gorra de paño con visera
  const g = new THREE.Group(), p = m('gorra', 0x2e2c2a);
  const c = malla(new THREE.SphereGeometry(0.115 * k, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), p); c.scale.y = 0.55; g.add(c);
  g.add(malla(new THREE.CylinderGeometry(0.118 * k, 0.118 * k, 0.03 * k, 16), p, 0, 0.005, 0));
  const v = malla(new THREE.CylinderGeometry(0.075 * k, 0.075 * k, 0.008, 12, 1, false, -Math.PI / 2, Math.PI), p, 0, 0, 0.06 * k); v.scale.z = 1.1; g.add(v);
  return g;
}
function fieltro(k) {   // sombrero de fieltro gastado y tiznado
  const g = new THREE.Group(), p = m('fieltro', 0x3a332c);
  g.add(malla(new THREE.CylinderGeometry(0.17 * k, 0.18 * k, 0.012, 22), p));
  g.add(malla(new THREE.CylinderGeometry(0.088 * k, 0.1 * k, 0.12 * k, 16), p, 0, 0.06 * k, 0));
  g.add(malla(new THREE.CylinderGeometry(0.102 * k, 0.102 * k, 0.022 * k, 16, 1, true), m('cinta', 0x141110), 0, 0.02 * k, 0));
  return g;
}
function antiparras(k) {   // antiparras oscuras de fundidor: dos copas de vidrio ahumado y la correa
  const g = new THREE.Group(), v = m('vidrio', 0x101418, { r: 0.15, me: 0.6 }), f = m('marco', 0x2a2622, { me: 0.4 });
  for (const s of [-1, 1]) { g.add(malla(new THREE.CylinderGeometry(0.026 * k, 0.03 * k, 0.03 * k, 12), f, s * 0.035 * k, 0, 0, Math.PI / 2)); g.add(malla(new THREE.CircleGeometry(0.024 * k, 12), v, s * 0.035 * k, 0, 0.016 * k)); }
  const c = malla(new THREE.TorusGeometry(0.1 * k, 0.006 * k, 4, 20, Math.PI * 1.25), m('correa', 0x2a2018)); c.rotation.set(Math.PI / 2, 0, -Math.PI * 0.125 + Math.PI); c.position.z = -0.075 * k; g.add(c);
  return g;
}
function panuelo(k, color) { const t = malla(new THREE.TorusGeometry(0.075 * k, 0.022 * k, 6, 16), m('pan' + color, color)); t.rotation.x = Math.PI / 2; t.scale.set(1, 0.85, 1); return t; }
function delantal(a) {   // delantal largo de cuero grueso: lámina curva que envuelve el frente del cuerpo, del pecho a las rodillas
  const r = 0.2 * a, h = 0.5 * a, geo = new THREE.CylinderGeometry(r, r * 1.1, h, 12, 1, true, -0.75, 1.5);
  geo.translate(0, -h / 2, -r);   // el frente del arco queda en el origen
  const mt = MT.cuero2 ||= new THREE.MeshStandardMaterial({ color: 0x4a3422, roughness: 0.75, side: THREE.DoubleSide });
  const g = new THREE.Group(); g.add(malla(geo, mt)); return g;
}
function guante() { return malla(new THREE.BoxGeometry(0.085, 0.12, 0.06), m('guante', 0x5a3e28, { r: 0.8 })); }
// herramienta a lo largo de +y (empuñadura en el origen)
function herramienta(tipo) {
  const g = new THREE.Group(), F = m('fierroH', 0x2a2a2c, { r: 0.5, me: 0.6 }), Mad = m('mangoH', 0x6b4a2c);
  if (tipo === 'barra') { g.add(malla(new THREE.CylinderGeometry(0.016, 0.018, 2.6, 6), F, 0, 0.9, 0)); g.add(malla(new THREE.ConeGeometry(0.022, 0.12, 6), m('punta', 0x5a2a14, { me: 0.5 }), 0, 2.25, 0)); }
  else if (tipo === 'pala') { g.add(malla(new THREE.CylinderGeometry(0.017, 0.017, 1.3, 6), Mad, 0, 0.35, 0)); const p = malla(new THREE.BoxGeometry(0.24, 0.3, 0.02), F, 0, 1.12, 0.02); p.rotation.x = 0.25; g.add(p); }
  else if (tipo === 'rastrillo') { g.add(malla(new THREE.CylinderGeometry(0.015, 0.015, 2.0, 6), F, 0, 0.7, 0)); g.add(malla(new THREE.BoxGeometry(0.34, 0.2, 0.025), F, 0, 1.72, 0.06, 1.2)); }
  else { for (const s of [-1, 1]) g.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 5), F, s * 0.02, 0.3, 0, 0, 0, s * 0.03)); g.add(malla(new THREE.BoxGeometry(0.1, 0.12, 0.04), F, 0, 0.88, 0.03)); }   // tenazas
  return g;
}

let LISTO = false;
export function registrarFundidores() {
  if (LISTO) return; LISTO = true;
  TIPOS_1905.fundidor ||= { base: 'doliente_minero', alto: 1.71, tinte: 0x7a6a58, nombre: 'Fundidor' };   // ropa de lona tiznada (sin manta ni chupalla)
  FABRICA_VIDA.fundidor = (M, L, s) => {
    const per = persona1905(M, 'fundidor'), g = per.g, a = per.alto, k = a / 1.7;
    const y0 = s.y ?? M.fis.suelo(s.x, s.z); g.position.set(s.x, y0, s.z);
    g.rotation.y = s.mira ? Math.atan2(s.mira[0] - s.x, s.mira[1] - s.z) : (s.giro || 0) * Math.PI / 180;
    const e = L.agregar({ tipo: 'npc', vivo: true, malla: g, sala: null, x: s.x, y: y0, z: s.z, t: Math.random() * 5, generico: true, epoca: 1905 });
    const v = new THREE.Vector3(), enG = h => g.worldToLocal(h.getWorldPosition(v.set(0, 0, 0))).clone();
    per.listo.then(r => {
      if (!r) return; const H = per.huesos; g.updateMatrixWorld(true);
      if (H.head) { const c = enG(H.head);
        colgar(g, H.head, s.gorro === 'fieltro' ? fieltro(k) : gorra(k), c.x, a * (s.gorro === 'fieltro' ? 0.955 : 0.978), c.z + 0.004 * a, -0.06);
        if (s.antiparras) { const ap = antiparras(k * 1.25); colgar(g, H.head, ap, c.x, a * 0.945, c.z + 0.118 * k, -0.25); }   // subidas sobre la frente, como las llevaban entre sangrías   // a la altura de los ojos, delante de la cara
      }
      if (H.chest) { const c = enG(H.chest);
        colgar(g, H.chest, panuelo(k, s.panuelo ?? 0x7a2a22), c.x, a * 0.845, c.z + 0.01 * a);
      }
      if (H.hips) { const c = enG(H.hips); colgar(g, H.hips, delantal(a), c.x, a * 0.74, c.z + 0.15 * k, 0.09); }   // del pecho a las rodillas, pegado al cuerpo (cuelga de la cadera)
      for (const lado of ['L', 'R']) if (H['hand' + lado]) { const c = enG(H['hand' + lado]); colgar(g, H['hand' + lado], guante(), c.x, c.y - 0.03, c.z); }
      if (H.handR && s.herramienta) { const c = enG(H.handR), h = herramienta(s.herramienta);
        // empuñadura en la mano derecha; la herramienta apunta adelante y abajo (hacia la boca del horno o el suelo)
        const ang = s.herramienta === 'barra' ? 1.95 : s.herramienta === 'tenazas' ? 2.5 : 2.2;
        colgar(g, H.handR, h, c.x, c.y, c.z, ang, 0, 0);
      }
      // hollín: la piel y la ropa más oscuras (material ya clonado por el tinte de persona1905)
      r.escena.traverse(x => { if (x.isMesh && x.material && x.material.color) x.material.color.multiplyScalar(0.92); });
    });
    let cuadro = 0;
    e.act = dt => {
      e.t += dt; cuadro++;
      const j = M.jug, dx = g.position.x - j.pos.x, dz = g.position.z - j.pos.z, d = Math.hypot(dx, dz), dy = Math.abs(j.pie - g.position.y);
      const ver = d < 85; if (g.visible !== ver) g.visible = ver; if (!ver) return;
      if (d < 0.85 && dy < 1.6) { const kk = (0.85 - d) * 30 * dt / Math.max(d, 0.05); j.vel.x -= dx * kk; j.vel.z -= dz * kk; }
      if (s.texto) M.burbujaCerca(e, g.position, 3.2, `<b>${per.nombre}:</b> ${s.texto}`);
      const cerca = d < 2.6 && dy < 3;
      e.tc = cerca ? (e.tc || 0) + dt : 0;
      // trabaja (pica el horno, palea, rastrilla) y se detiene a mirar a Nato si se le acerca
      const accion = cerca ? (e.tc < 1.4 ? 'saludar' : 'hablar') : (Math.sin(e.t * (s.ritmo || 1.1) + s.x) > -0.25 ? 'entregar' : 'idle');
      if (d < 45 || !e.ya) { e.ya = true; if (d < 25 || cuadro % 2 === 0) per.poner(accion, d < 25 ? dt : dt * 2, 1); }
    };
  };
}
