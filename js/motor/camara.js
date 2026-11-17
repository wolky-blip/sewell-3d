// Cámara libre en tercera persona: órbita alrededor de Nato con choque contra paredes (rayo de Rapier).
import * as THREE from 'three';
import { altura } from '../mundo/terreno.js';

export class CamaraTP {
  constructor(camara, fis) {
    this.cam = camara; this.fis = fis;
    // más cerca de los protagonistas (pedido de Diego, 12-11): 5 m en vez de 7,5 y algo más baja; la rueda del mouse acerca o aleja (3 a 7,5 m)
    this.yaw = 0; this.pitch = 0.26; this.dist = 5; this.distReal = 5;
    addEventListener('wheel', e => { this.dist = this.interior ? THREE.MathUtils.clamp(this.dist + Math.sign(e.deltaY) * 0.4, 1.2, 4.5) : THREE.MathUtils.clamp(this.dist + Math.sign(e.deltaY) * 0.5, 3, 7.5); }, { passive: true });
    // N0-INT (14-11): dentro de los interiores procedurales (principal.js pone this.interior) la cámara va más cerca y baja, por encima del hombro
    // derecho de Nato (this.hombro, lo acorta un rayo si hay un muro a la derecha); la tecla V alterna la primera persona (ojos de Nato, sin su splat)
    this.interior = false; this.primera = false; this.hombro = 0;
    addEventListener('keydown', e => { if (e.code === 'KeyV' && !e.repeat && this.interior && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) this.primera = !this.primera; });
    this.objetivo = new THREE.Vector3(); this.suave = new THREE.Vector3(); this.iniciada = false;
    this.enCapacho = false; this.muyCerca = false;
    this.auto = 0;   // segundos sin mover la cámara: se acomoda sola detrás de Nato
  }
  // yaw 0 = mirando hacia -Z (subiendo la ladera)
  adelante() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  derecha() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  actualizar(dt, pos, mirar, excluir, rumbo, moviendo) {
    if (Math.abs(mirar.x) + Math.abs(mirar.y) > 0.0001) this.auto = 0; else this.auto += dt;
    this.yaw -= mirar.x; this.pitch = THREE.MathUtils.clamp(this.pitch + mirar.y, this.interior && this.primera ? -1.2 : -0.35, 1.25);
    // sin tocar la cámara por un rato y corriendo, se gira despacio detrás de Nato
    if (this.auto > 1.5 && moviendo && rumbo != null && !(this.interior && this.primera)) {
      let d = rumbo - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 0.8);
    }
    this.objetivo.set(pos.x, pos.y + (this.enCapacho ? 0.2 : 1.05), pos.z);   // en el capacho se apunta más abajo: Nato va dentro del cajón
    if (this.interior && this.primera) {   // primera persona: ojos de Nato (1,62 m), mirando hacia donde apunta la cámara; sin splat de Nato
      const cp = Math.cos(this.pitch), dv = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
      this.suave.set(pos.x, pos.y + 0.72, pos.z); this.cam.position.copy(this.suave).addScaledVector(new THREE.Vector3(-dv.x, 0, -dv.z).normalize(), 0.12);
      this.cam.lookAt(this.suave.clone().addScaledVector(dv, -1)); this.muyCerca = true; this.distReal = this.dist; this.iniciada = true; this.hombro = 0; return;
    }
    if (this.interior) {   // por encima del hombro derecho: se corre a la derecha de Nato lo que deje libre el muro (rayo horizontal)
      const dR = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), h = this.fis.rayo(this.objetivo, dR, 0.7, excluir, ['baranda']);
      const meta = h ? Math.max(0, h.toi - 0.3) : 0.42; this.hombro += (meta - this.hombro) * (1 - Math.exp(-dt * 6)); this.objetivo.addScaledVector(dR, this.hombro);
    } else this.hombro = 0;
    if (!this.iniciada) { this.suave.copy(this.objetivo); this.iniciada = true; }
    this.suave.lerp(this.objetivo, 1 - Math.exp(-dt * 14));
    // en el capacho: la cámara sube, mira desde un costado del cable y más lejos (la pletina y el andamio de la torre son malla visible, no física)
    let distE = this.dist, pit = this.pitch;
    if (this.enCapacho) {
      // lado libre: se elige una vez por viaje el costado (yaw 0 o π, perpendicular al cable) con más espacio; si la ladera tapa uno, se usa el otro
      if (this.ladoCap == null) {
        const libre = yw => { const dv = new THREE.Vector3(Math.sin(yw) * Math.cos(0.5), Math.sin(0.5), Math.cos(yw) * Math.cos(0.5)); const h = this.rayoCam(this.suave, dv, 6.5, excluir, ['capacho']); return h ? h.toi : 6.5; };
        this.ladoCap = libre(0) >= libre(Math.PI) ? 0 : Math.PI;
      }
      let dd = this.ladoCap - this.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      // N1-M1 (pedido de Diego): en el capacho la cámara queda LIBRE con el mouse (antes se giraba sola al costado); si la ladera
      // la acorta, sube por encima del balde (ver el bucle de abajo) en vez de quedar metida en el asa
      void dd;   // (ladoCap queda solo como dato)
      pit = Math.max(pit, 0.5); distE = 6.5; this.fijoCap = true;   // moderada y a un costado: Nato se ve y ni el cable ni la pletina quedan entre la cámara y él
    } else { this.ladoCap = null; this.fijoCap = false; }
    const der = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // barrido con radio: 5 rayos (centro y 4 desplazados ±0,4 m) del objetivo a la posición deseada; manda el más corto.
    // Si queda muy cerca de Nato (pared detrás), sube (más pitch, por encima del hombro) en vez de pegarse a su cabeza.
    let dir, d, hc = 1e9;   // hc: distancia al primer choque del rayo central (N2-C30)
    for (let intento = 0; intento < 5; intento++) {
      dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pit), Math.sin(pit), Math.cos(this.yaw) * Math.cos(pit));
      const arr = new THREE.Vector3().crossVectors(dir, der).normalize(), P = this.suave.clone().addScaledVector(dir, distE);
      d = distE;
      for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const T = P.clone().addScaledVector(der, a * 0.4).addScaledVector(arr, b * 0.4), v = T.clone().sub(this.suave), L = v.length();
        const h = this.rayoCam(this.suave, v.divideScalar(L), L + 0.2, excluir, this.enCapacho ? ['capacho', 'baranda'] : ['baranda']);   // el balde del andarivel no tapa la cámara
        // X-K7 (carril cine): con el sólido a menos de 0,9 m el mínimo de 0,6 m dejaba la cámara DEL OTRO LADO (bajo aleros y
        // escaleras, N2/N3): ahí se pega a 0,15 m antes del choque (Nato se oculta con muyCerca)
        if (!a && !b) hc = h ? h.toi : 1e9;
        if (h) d = Math.min(d, h.toi < 0.9 ? Math.max(0.1, (h.toi - 0.15) / L * distE) : Math.max(0.6, (h.toi - 0.3) / L * distE));
      }
      // N1-O8: la baranda (1,2 m) no acorta la cámara (quedaba pegada a las tablas y la pantalla se llenaba de madera): si la línea
      // a la cámara la cruza a menos de 0,35 m sobre su borde, la cámara SUBE para mirar por encima; solo si ni así pasa, se acorta
      let bar = false;   // 14-11: barandas convexas (escalera de incendio N2-C29) no tienen halfExtents: se tratan siempre como baranda (antes TypeError)
      { const v = P.clone().sub(this.suave), L = v.length(), h = this.fis.rayo(this.suave, v.divideScalar(L), L + 0.2, excluir, ['capacho']);
        const t = h && this.fis.etiquetas.get(h.col.handle);
        if (t && t.tipo === 'baranda' && (!h.col.halfExtents?.() || h.punto.y < h.col.translation().y + h.col.halfExtents().y + 0.35)) {
          bar = true; if (pit >= 1.25) d = Math.min(d, Math.max(0.6, (h.toi - 0.3) / L * distE));
        } }
      if ((!bar && d >= (this.fijoCap ? 3.2 : this.minDist ?? 1.8)) || pit >= 1.25) break;   // minDist (N0-INT): en los interiores procedurales 0,9 (pasillos y piezas chicas: si no, la cámara subía a mirar desde el techo)   // en el capacho también sube si queda a menos de 3,2 m (dentro del asa)
      pit = Math.min(1.25, pit + 0.2);
    }
    this.muyCerca = d < 0.8;
    // se acerca rápido pero suave cuando un rayo choca (antes de golpe: al correr junto a postes y barandas parpadeaba = tirones)
    this.distReal += (d - this.distReal) * (1 - Math.exp(-dt * (d < this.distReal ? 22 : 3)));
    // N2-C30: al girar rápido pegado a un muro, distReal (que baja con retraso) dejaba la cámara DENTRO del sólido unos cuadros
    // (el rayo ya veía el muro, pero la cámara iba por la distancia vieja): nunca pasa del primer choque del rayo central
    if (this.distReal > hc - 0.12) this.distReal = Math.max(0.1, hc - 0.15);
    this.cam.position.copy(this.suave).addScaledVector(dir, this.distReal);
    // N1-C58: altura mínima sobre el terreno (los rayos pasan entre los triángulos de la ladera y la cámara quedaba a 4-22 cm del suelo,
    // viendo a través). Solo afuera: con Nato muy bajo el terreno (salas y minas bajo tierra) no se aplica
    { const yt = altura(this.cam.position.x, this.cam.position.z); if (this.suave.y > altura(this.suave.x, this.suave.z) - 2 && this.cam.position.y < yt + 0.6) this.cam.position.y = yt + 0.6; }
    this.cam.lookAt(this.suave);
    this.desvanecer();
  }
  // N1-O8: con Nato o la cámara dentro de un obstáculo de cámara que trae su pieza (c.obj), la pieza se oculta (SplatMesh.opacity
  // no se nota en estas gaussianas; visible sí). Con margen de 0,3 m para que no parpadee en el borde.
  desvanecer() {
    for (const c of this.fis.camObst || []) {
      if (!c.obj) continue;
      const m = c.obj.visible ? 0 : 0.3, den = (p, k) => Math.hypot(p.x - c.x, p.z - c.z) < c.r + k + m && p.y > c.y0 - 0.5 && p.y < c.y1;
      const ver = !(den(this.suave, 0) || den(this.cam.position, 0.4));
      if (ver !== c.obj.visible) c.obj.visible = ver;
    }
  }
  // N1-O8: rayo de Rapier + obstáculos SOLO de cámara (fis.camObst: cilindros {x, z, r, y0, y1}), p. ej. la torre de madera del
  // andarivel (malla visible sin física: la cámara se metía entre sus vigas y la pantalla se llenaba de madera). Un cilindro que
  // contiene el origen (Nato entre sus patas, junto a la baranda) no frena: ahí la pieza se desvanece (desvanecer()).
  rayoCam(o, d, max, excluir, ignorar) {
    let h = this.fis.rayo(o, d, max, excluir, ignorar);
    for (const c0 of this.fis.camObst || []) {
      if (c0.capacho && this.enCapacho) continue;
      const c = c0.pos ? { x: c0.pos.x, z: c0.pos.z, r: c0.r, y0: c0.pos.y + c0.y0, y1: c0.pos.y + c0.y1 } : c0;   // con pos: sigue a la pieza (balde del andarivel)
      const ox = o.x - c.x, oz = o.z - c.z, a = d.x * d.x + d.z * d.z, b = ox * d.x + oz * d.z, cc = ox * ox + oz * oz - c.r * c.r;
      let t = null;
      if (a > 1e-9) { const disc = b * b - a * cc; if (disc >= 0) {
        const t0 = (-b - Math.sqrt(disc)) / a, y = o.y + d.y * t0; if (cc > 0 && t0 > 0 && y >= c.y0 && y <= c.y1) t = t0; } }
      if (t == null && o.y > c.y1 && d.y < 0) { const t1 = (c.y1 - o.y) / d.y, px = ox + d.x * t1, pz = oz + d.z * t1; if (px * px + pz * pz <= c.r * c.r) t = t1; }
      if (t != null && t < max && (!h || t < h.toi)) h = { toi: t, col: null, punto: { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t } };
    }
    return h;
  }
  cortar() { this.iniciada = false; }
}
