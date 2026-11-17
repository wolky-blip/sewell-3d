// Física con Rapier (WASM): mundo estático, plataformas móviles (capachos, tablones, ascensor, tren) y el controlador
// de personaje con cápsula, pendientes, escalones y nieve.
import RAPIER from 'rapier';

export { RAPIER };
export async function iniciarRapier() { await RAPIER.init(); }

export class Fisica {
  constructor() {
    this.mundo = new RAPIER.World({ x: 0, y: -25, z: 0 });
    this.moviles = new Map();   // handle de colisionador → plataforma móvil {cuerpo, delta}
    this.etiquetas = new Map(); // handle → {tipo, ...} (hielo, tablón, techo…)
  }
  liberar() { this.mundo.free(); }

  fijo(desc, etiqueta) {
    const c = this.mundo.createCollider(desc);
    if (etiqueta) this.etiquetas.set(c.handle, etiqueta);
    return c;
  }
  // caja estática: centro, medidas completas, giro en Y (radianes) o cuaternión
  caja(x, y, z, sx, sy, sz, giroY = 0, etiqueta, quat) {
    const d = RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(x, y, z);
    if (quat) d.setRotation(quat); else if (giroY) d.setRotation(quatY(giroY));
    return this.fijo(d, etiqueta);
  }
  malla(vertices, indices, etiqueta) {
    return this.fijo(RAPIER.ColliderDesc.trimesh(vertices, indices), etiqueta);
  }
  // ESC2 (16-11): UN colisionador compuesto de cajas (escaleras públicas: una caja por peldaño sin cientos de colisionadores).
  // cajas: [{ x, y, z, sx, sy, sz }] en el marco local; (x, y, z) y quat: posición y giro del conjunto
  compuesto(cajas, x, y, z, quat, etiqueta) {
    const id = { x: 0, y: 0, z: 0, w: 1 };
    const d = RAPIER.ColliderDesc.compound(cajas.map(k => new RAPIER.Cuboid(k.sx / 2, k.sy / 2, k.sz / 2)), cajas.map(k => ({ x: k.x, y: k.y, z: k.z })), cajas.map(() => id)).setTranslation(x, y, z);
    if (quat) d.setRotation(quat);
    return this.fijo(d, etiqueta);
  }
  convexo(puntos, etiqueta) {
    const d = RAPIER.ColliderDesc.convexHull(puntos);
    return d ? this.fijo(d, etiqueta) : null;
  }
  // cuerpo cinemático (plataforma móvil) con una o más cajas
  movil(x, y, z, cajas, etiqueta) {
    const cuerpo = this.mundo.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    const pl = { cuerpo, delta: { x: 0, y: 0, z: 0 }, pos: { x, y, z }, cols: [] };
    for (const k of cajas) {
      const c = this.mundo.createCollider(RAPIER.ColliderDesc.cuboid(k.sx / 2, k.sy / 2, k.sz / 2).setTranslation(k.x || 0, k.y || 0, k.z || 0), cuerpo);
      this.moviles.set(c.handle, pl); pl.cols.push(c);
      if (etiqueta) this.etiquetas.set(c.handle, etiqueta);
    }
    return pl;
  }
  moverMovil(pl, x, y, z, giroY) {
    pl.delta = { x: x - pl.pos.x, y: y - pl.pos.y, z: z - pl.pos.z };
    pl.pos = { x, y, z };
    pl.cuerpo.setNextKinematicTranslation(pl.pos);
    if (giroY != null) pl.cuerpo.setNextKinematicRotation(quatY(giroY));
  }
  quitarMovil(pl) {
    for (const c of pl.cols) { this.moviles.delete(c.handle); this.etiquetas.delete(c.handle); }
    this.mundo.removeRigidBody(pl.cuerpo);
  }
  paso(dt) { this.mundo.timestep = dt; this.mundo.step(); }
  // indexa los colisionadores recién creados para que los rayos los vean (sin esto, al construir el nivel fis.suelo()
  // devolvía ~1200 y las pepitas quedaban en el cielo)
  indexar() { const t = this.mundo.timestep; this.mundo.timestep = 1e-6; this.mundo.step(); this.mundo.timestep = t; }

  // rayo: devuelve {toi, punto, col, normal} o null. excluir = colisionador a ignorar
  rayo(o, d, max = 500, excluir, ignorar) {
    const r = new RAPIER.Ray(o, d);
    const h = this.mundo.castRayAndGetNormal(r, max, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, excluir, undefined, ignorar ? c => { const t = this.etiquetas.get(c.handle); return !(t && ignorar.includes(t.tipo)); } : undefined);
    if (!h) return null;
    return { toi: h.timeOfImpact ?? h.toi, col: h.collider, normal: h.normal,
      punto: { x: o.x + d.x * (h.timeOfImpact ?? h.toi), y: o.y + d.y * (h.timeOfImpact ?? h.toi), z: o.z + d.z * (h.timeOfImpact ?? h.toi) } };
  }
  suelo(x, z, desde = 1200, excluir) {
    let h = this.rayo({ x, y: desde, z }, { x: 0, y: -1, z: 0 }, desde + 300, excluir);
    // si el rayo choca con algo pegado al punto de partida (al crear el nivel aparecía un colisionador en y≈1200 y las
    // pepitas quedaban en el cielo), se ignora ese colisionador y se sigue buscando hacia abajo
    for (let i = 0; i < 4 && h && h.toi < 5; i++) h = this.rayo({ x, y: desde, z }, { x: 0, y: -1, z: 0 }, desde + 300, h.col);
    return h ? h.punto.y : -200;
  }
}

export function quatY(a) { return { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }; }

// Personaje con cápsula: lo usan Nato y (más simple) los enemigos con suelo
export class Personaje {
  constructor(fis, x, y, z, radio = 0.35, medio = 0.55) {
    this.fis = fis; this.radio = radio; this.medio = medio;
    this.cuerpo = fis.mundo.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    this.col = fis.mundo.createCollider(RAPIER.ColliderDesc.capsule(medio, radio), this.cuerpo);
    this.cc = fis.mundo.createCharacterController(0.03);
    this.cc.setUp({ x: 0, y: 1, z: 0 });
    this.cc.setMaxSlopeClimbAngle(52 * Math.PI / 180);   // subidas: un poco más de pendiente caminable (antes 48°)
    this.cc.setMinSlopeSlideAngle(55 * Math.PI / 180);
    this.cc.enableAutostep(0.55, 0.2, true);   // también sobre plataformas móviles (ascensor, capachos, tren)
    this.cc.enableSnapToGround(0.5);
    this.cc.setApplyImpulsesToDynamicBodies(false);
    this.pos = { x, y, z }; this.enSuelo = false; this.sueloCol = null;
  }
  // mueve con colisiones; devuelve el movimiento real
  mover(dx, dy, dz) {
    // si está parado sobre una plataforma móvil, se la lleva
    if (this.sueloCol && this.fis.moviles.has(this.sueloCol.handle)) {
      const d = this.fis.moviles.get(this.sueloCol.handle).delta;
      dx += d.x; dz += d.z; if (d.y > 0) dy += d.y; else dy += d.y * 1.02;
    }
    this.cc.computeColliderMovement(this.col, { x: dx, y: dy, z: dz }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const m = this.cc.computedMovement();
    this.enSuelo = this.cc.computedGrounded();
    this.sueloCol = null; this.choqueTecho = false; this.choqueLado = false;
    for (let i = 0; i < this.cc.numComputedCollisions(); i++) {
      const c = this.cc.computedCollision(i);
      if (!c) continue;
      const n = c.normal1;
      if (n.y > 0.5) this.sueloCol = c.collider;
      else if (n.y < -0.5) this.choqueTecho = true;
      else this.choqueLado = true;
    }
    if (!this.sueloCol && this.enSuelo) {   // con el «snap» a veces no hay contacto: se pregunta con un rayo corto
      const h = this.fis.rayo({ x: this.pos.x + m.x, y: this.pos.y + m.y - this.medio - this.radio + 0.05, z: this.pos.z + m.z }, { x: 0, y: -1, z: 0 }, 0.4, this.col);
      if (h) this.sueloCol = h.col;
    }
    this.pos = { x: this.pos.x + m.x, y: this.pos.y + m.y, z: this.pos.z + m.z };
    this.cuerpo.setNextKinematicTranslation(this.pos);
    return m;
  }
  teletransportar(x, y, z) { this.pos = { x, y, z }; this.cuerpo.setTranslation(this.pos, true); this.cuerpo.setNextKinematicTranslation(this.pos); this.sueloCol = null; }
  get pie() { return this.pos.y - this.medio - this.radio; }
  etiquetaSuelo() { return this.sueloCol ? this.fis.etiquetas.get(this.sueloCol.handle) : null; }
  liberar() { this.fis.mundo.removeCharacterController(this.cc); this.fis.mundo.removeRigidBody(this.cuerpo); }
}
