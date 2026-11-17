// N2-C34 (carril juego): el bolero del palitroque juega de verdad en bucle. Toma una bola del soporte, camina a la línea, balancea el
// brazo y la suelta; la bola rueda por su pista y choca los pinos, que caen con física simple y se dispersan; un rastrillo barre los
// caídos (como un armador) y, tras el segundo tiro o una chuza, baja un juego nuevo de 10 pinos. A veces chuza, a veces deja pinos en pie
// o manda la bola a la canaleta. No daña a Nato: si Nato se para en la pista, espera (o la bola se detiene al topar con él).
// Uso: entidades.js minero() llama juegaBolos(M, e, s, g, dt) cada cuadro cuando el spec trae `juega: { zPalos }` (SALAS.palitroque).
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);
const PERFIL = [[0, 0], [0.05, 0], [0.07, 0.06], [0.085, 0.14], [0.07, 0.24], [0.036, 0.31], [0.04, 0.36], [0.046, 0.41], [0.03, 0.45], [0, 0.46]].map(([r, y]) => new THREE.Vector2(r, y));
const R_BOLA = 0.16, V_BOLA = 8, YT = 0.1;   // radio de la bola, m/s, tope de la plataforma de los pinos
const aza = (a, b) => a + Math.random() * (b - a);
const suave = u => u * u * (3 - 2 * u);
let GEO = null, MAT = null, GEO_BOLA = null, MAT_BOLA = null, MAT_PUNTO = null;

function recursos() {
  if (GEO) return;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#b3202a'; x.fillRect(0, 64 * 0.3, 64, 64 * 0.05); x.fillRect(0, 64 * 0.39, 64, 64 * 0.03);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  GEO = new THREE.LatheGeometry(PERFIL, 14); MAT = new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 });
  GEO_BOLA = new THREE.SphereGeometry(R_BOLA, 18, 14); MAT_BOLA = new THREE.MeshStandardMaterial({ color: 0x1a2a55, roughness: 0.2, metalness: 0.25 });
  MAT_PUNTO = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.5 });
}
function bola() {
  const m = new THREE.Mesh(GEO_BOLA, MAT_BOLA); m.castShadow = true;
  for (const [x, y, z] of [[0.05, 0.08, 0.13], [-0.03, 0.1, 0.12], [0.0, 0.14, 0.08]]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), MAT_PUNTO); p.position.set(x, y, z); m.add(p); }
  return m;
}

function iniciar(M, e, s, g) {
  const sala = M.R.salas[s.sala]; if (!sala) return null;
  recursos();
  const grupo = sala.grupo, O = sala.origen, cx = s.x, zP = O.z + s.juega.zPalos, y0 = e.casa.y;
  const c = {
    grupo, cx, zP, y0, linea: s.z, rack: { x: cx - 1.75, z: s.z + 0.8 }, fase: 'espera', t: 1.5, tiro: 1, pf: 'listo', pt: 0, ball: null, mano: null, lean: 0, sonido: 0, vistas: 0,
    pins: [], barra: null,
  };
  g.rotation.order = 'YXZ';
  // soporte de bolas (madera con 3 bolas) junto a la pista
  const sop = new THREE.Group(), mad = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 });
  const caj = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.4), mad); caj.position.y = 0.25; caj.castShadow = true; sop.add(caj);
  for (let i = 0; i < 3; i++) { const b = bola(); b.position.set((i - 1) * 0.27, 0.5 + R_BOLA, 0); sop.add(b); }
  sop.position.set(c.rack.x, y0, c.rack.z); sop.rotation.y = Math.PI / 2 * 0; grupo.add(sop); c.soporte = sop;
  // 10 pinos en triángulo (la cabeza hacia el jugador)
  for (let f = 0; f < 4; f++) for (let j = 0; j <= f; j++) {
    const m = new THREE.Mesh(GEO, MAT); m.castShadow = true; const bx = cx + (j - f / 2) * 0.3, bz = zP - f * 0.26;
    m.position.set(bx, YT, bz); grupo.add(m);
    c.pins.push({ m, bx, bz, f, est: 'pie', x: bx, z: bz, vx: 0, vz: 0, vy: 0, air: 0, th: 0, om: 0, dir: new THREE.Vector2(0, -1), yaw: 0, spin: 0, delay: 0, wob: 0, lift: 0 });
  }
  // rastrillo del armador
  const barra = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 0.14), new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.6, metalness: 0.3 }));
  barra.position.set(cx, 1.6, zP + 0.7); barra.visible = false; grupo.add(barra); c.barra = barra;
  return c;
}

function natoEnPista(M, c) {
  const j = M.jug; return Math.abs(j.pos.x - c.cx) < 1.3 && j.pos.z < c.linea - 0.2 && j.pos.z > c.zP - 3 && j.pie < c.y0 + 1.5;
}
// avanza hacia (tx,tz); si Nato estorba al frente se detiene. Devuelve true al llegar
function ir(M, e, g, c, tx, tz, vel, dt) {
  const dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz);
  if (d < 0.06) return true;
  const paso = Math.min(d, vel * dt), nx = g.position.x + dx / d * paso, nz = g.position.z + dz / d * paso, j = M.jug;
  g.rotation.y += Math.atan2(Math.sin(Math.atan2(dx, dz) - g.rotation.y), Math.cos(Math.atan2(dx, dz) - g.rotation.y)) * Math.min(1, dt * 10);
  if (Math.hypot(j.pos.x - nx, j.pos.z - nz) < 0.9 && Math.abs(j.pie - g.position.y) < 1.5) return false;   // Nato en el camino: espera
  g.position.x = nx; g.position.z = nz; return false;
}
function mirar(g, tx, tz, dt) {
  const a = Math.atan2(tx - g.position.x, tz - g.position.z); g.rotation.y += Math.atan2(Math.sin(a - g.rotation.y), Math.cos(a - g.rotation.y)) * Math.min(1, dt * 8);
}
// posición de la mano (péndulo del brazo desde el hombro) con la inclinación del cuerpo
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3();
function manoPos(g, c, phi) {
  if (c.S) {   // 16-11: ciudadano: el péndulo nace en su hombro real (medido por animarBolero en el cuadro anterior)
    _q.setFromEuler(_e.set(c.lean, g.rotation.y, 0));
    return _p.copy(c.S).add(_v.set(0, -c.r * Math.cos(phi), c.r * Math.sin(phi)).applyQuaternion(_q));
  }
  const sx = -0.26, sy = 1.3, r = 0.62, y = sy - r * Math.cos(phi), z = 0.08 + r * Math.sin(phi), l = c.lean;
  const yy = y * Math.cos(l) - z * Math.sin(l), zz = y * Math.sin(l) + z * Math.cos(l), w = g.rotation.y;
  return _p.set(g.position.x + sx * Math.cos(w) + zz * Math.sin(w), g.position.y + yy, g.position.z - sx * Math.sin(w) + zz * Math.cos(w));
}

// ---- pinos
function volcar(c, M, pins, bx, fuerza) {
  for (const p of pins) {
    p.est = 'cae'; p.delay = p.f * 0.03 + Math.random() * 0.1; p.th = 0; p.om = aza(4, 9);
    p.vx = (p.bx - bx) * 3 + aza(-1.2, 1.2); p.vz = -aza(1.2, 3.2) * fuerza; p.vy = aza(1, 3); p.air = 0.001;
    const l = Math.hypot(p.vx, p.vz) || 1; p.dir.set(p.vx / l, p.vz / l); p.spin = aza(-5, 5);
  }
  for (const p of c.pins) if (p.est === 'pie') p.wob = 0.12;
  if (M.mismaSala && M.efecto) { M.efecto('pinos'); for (let i = 1; i < 6; i++) setTimeout(() => M.efecto('pinos'), i * aza(50, 120)); }
}
function moverPinos(c, dt) {
  for (const p of c.pins) {
    const m = p.m;
    if (p.est === 'cae') {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.vy -= 14 * dt; p.air += p.vy * dt;
      if (p.air < 0) { p.air = 0; p.vy = p.vy < -1.2 ? -p.vy * 0.28 : 0; }
      p.th = Math.min(Math.PI / 2, p.th + p.om * dt); p.yaw += p.spin * dt; p.spin *= Math.exp(-2 * dt);
      const fr = Math.exp(-(p.air > 0 ? 0.6 : 3.2) * dt); p.vx *= fr; p.vz *= fr; p.x += p.vx * dt; p.z += p.vz * dt;
      if (p.x < c.cx - 1.0) { p.x = c.cx - 1.0; p.vx = Math.abs(p.vx) * 0.4; } else if (p.x > c.cx + 1.0) { p.x = c.cx + 1.0; p.vx = -Math.abs(p.vx) * 0.4; }
      if (p.z < c.zP - 2.05) { p.z = c.zP - 2.05; p.vz = Math.abs(p.vz) * 0.35; }
      if (p.th >= Math.PI / 2 && p.air === 0 && Math.hypot(p.vx, p.vz) < 0.2) p.est = 'tumbado';
    }
    if (p.est === 'pie') { m.position.set(p.x, YT + p.lift, p.z); p.wob *= Math.exp(-2.5 * dt); m.rotation.set(Math.sin(c.pt * 28 + p.f) * p.wob, 0, Math.cos(c.pt * 31 + p.f) * p.wob); continue; }
    if (p.est === 'cae' || p.est === 'tumbado') {
      m.position.set(p.x, YT + 0.085 * Math.sin(p.th) + p.air, p.z);
      m.quaternion.setFromAxisAngle(Y, p.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(p.dir.y, 0, -p.dir.x), p.th));
    }
  }
}
function juegoNuevo(c) {
  for (const p of c.pins) { p.est = 'pie'; p.x = p.bx; p.z = p.bz; p.th = 0; p.air = 0; p.vx = p.vz = p.vy = 0; p.yaw = 0; p.wob = 0; p.lift = 1.4; p.m.visible = true; p.m.quaternion.identity(); p.m.rotation.set(0, 0, 0); }
}

// ---- un cuadro del juego
export function juegaBolos(M, e, s, g, dt) {
  if (!M.mismaSala(e)) return;
  const c = e.bolos || (e.bolos = iniciar(M, e, s, g)); if (!c) return;
  dt = Math.min(dt, 0.05); c.pt += dt; c.t += dt; e.animForzada = null;
  const j = M.jug, y0 = c.y0; g.position.y = y0;
  // ---- el armador (pinos)
  if (c.pf === 'rueda') {
    const b = c.ball, st = b.userData;
    if (!st.parada && natoEnPista(M, c) && Math.abs(j.pos.z - b.position.z) < 0.7 && Math.abs(j.pos.x - b.position.x) < 0.75) {   // la bola topa con Nato: se detiene sin dañarlo
      b.visible = false; c.ball = null; c.pf = 'listo'; c.fase = 'mira'; c.t = 0; if (M.efecto) M.efecto('golpeSuave'); }
    else {
      st.s += V_BOLA * dt; const u = st.s / st.largo, f = Math.min(1, st.s / (0.35 * st.largo));
      b.position.x = c.cx + st.ox * (st.canal ? suave(f) : u);
      b.position.z = c.linea - 0.45 - st.s;
      const sueltaY = Math.max(0, 1 - st.s / 0.5);
      b.position.y = y0 + (st.canal ? 0.04 : 0.1) + R_BOLA + sueltaY * st.y0h * 0.9;
      b.rotation.x -= V_BOLA / R_BOLA * dt;
      c.sonido -= dt; if (c.sonido <= 0) { c.sonido = 0.5; if (M.efecto) M.efecto('rueda'); }
      if (!st.golpeo && !st.canal && b.position.z <= c.zP + 0.25) { st.golpeo = true; volcar(c, M, st.cae, b.position.x, 1); c.pf = 'caida'; c.pt2 = 0; c.ballTrasPinos = true; }
      if (b.position.z <= c.zP - 2.0) { b.visible = false; if (c.pf === 'rueda') { c.pf = 'caida'; c.pt2 = 1.4; } }
    }
  }
  if (c.pf === 'caida') {
    c.pt2 = (c.pt2 || 0) + dt;
    if (c.ball && c.ball.visible && c.ball.userData.golpeo) { const b = c.ball; b.userData.s += V_BOLA * dt * 0.8; b.position.z = c.linea - 0.45 - b.userData.s; b.rotation.x -= 40 * dt; if (b.position.z <= c.zP - 2.0) b.visible = false; }
    if (c.pt2 > 2.4) { c.pf = 'barre'; c.pt2 = 0; c.todos = c.pins.every(p => p.est !== 'pie'); c.barra.visible = true; }
  } else if (c.pf === 'barre') {
    c.pt2 += dt; const t = c.pt2, bz0 = c.zP + 0.9, bz1 = c.zP - 2.15;
    const elev = t < 0.5 ? suave(t / 0.5) : t > 2.0 ? 1 - suave((t - 2.0) / 0.5) : 1;   // los pinos en pie suben mientras barre el rastrillo
    for (const p of c.pins) if (p.est === 'pie') p.lift = elev * 0.7;
    const zb = t < 0.5 ? bz0 : t < 1.5 ? bz0 + (bz1 - bz0) * suave((t - 0.5) / 1.0) : bz1, yb = t < 0.5 ? 1.5 - 1.2 * suave(t / 0.5) : t > 1.9 ? 0.3 + 1.2 * suave((t - 1.9) / 0.4) : 0.3;
    c.barra.position.set(c.cx, y0 + yb, zb);
    for (const p of c.pins) if ((p.est === 'tumbado' || p.est === 'cae') && p.z > zb - 0.1) { p.z = zb - 0.12; p.vz = 0; p.vx *= 0.5; }
    if (t > 1.6) for (const p of c.pins) if (p.est !== 'pie') { p.est = 'fuera'; p.m.visible = false; }
    if (t > 2.5) {
      c.barra.visible = false;
      if (c.todos || c.tiro >= 2) { c.tiro = 1; juegoNuevo(c); c.pf = 'baja'; c.pt2 = 0; }
      else { c.tiro = 2; c.pf = 'listo'; }
    }
  } else if (c.pf === 'baja') {
    c.pt2 += dt; for (const p of c.pins) p.lift = 1.4 * (1 - suave(Math.min(1, c.pt2 / 0.9)));
    if (c.pt2 > 1.0) { for (const p of c.pins) p.lift = 0; c.pf = 'listo'; }
  }
  moverPinos(c, dt);
  if (c.pf === 'listo' && c.ball && !c.ball.visible) c.ball = null;

  // ---- el bolero
  switch (c.fase) {
    case 'espera': if (c.t > 1.2 && c.pf === 'listo') { c.fase = 'ir_rack'; c.t = 0; } mirar(g, c.cx, c.zP, dt); break;
    case 'ir_rack':
      if (ir(M, e, g, c, c.rack.x + 0.6, c.rack.z + 0.45, c.vel || 1.5, dt)) { c.fase = 'agacha'; c.t = 0; }
      break;
    case 'agacha': {
      mirar(g, c.rack.x, c.rack.z, dt);
      const t = c.t, u = t < 0.55 ? suave(t / 0.55) : 1 - suave(Math.min(1, (t - 0.9) / 0.5)); c.lean = 0.6 * u; g.rotation.x = c.lean;
      if (!c.mano && t > 0.55) { c.mano = bola(); c.grupo.add(c.mano); }
      if (c.mano) { const k = suave(Math.min(1, (t - 0.55) / 0.45)); const h = manoPos(g, c, 0.1); c.mano.position.set(c.rack.x + (h.x - c.rack.x) * k, y0 + 0.66 + (h.y - y0 - 0.66) * k, c.rack.z + (h.z - c.rack.z) * k); }
      if (t > 1.45) { c.fase = 'ir_linea'; c.t = 0; c.lean = 0; g.rotation.x = 0; }
      break;
    }
    case 'ir_linea': {
      const llego = ir(M, e, g, c, c.cx, c.linea, c.vel || 1.4, dt); manoPos(g, c, 0.15); c.mano.position.copy(_p);
      if (llego) { c.fase = 'apunta'; c.t = 0; }
      break;
    }
    case 'apunta': {
      mirar(g, c.cx, c.zP, dt); manoPos(g, c, 0.1); c.mano.position.copy(_p);
      if (c.t > 0.8 && c.pf === 'listo' && !natoEnPista(M, c)) {
        c.fase = 'lanza'; c.t = 0;
        // resultado decidido de antemano: chuza o varios pinos, o bola a la canaleta
        const pie = c.pins.filter(p => p.est === 'pie'); let cae, ox = 0, canal = false; const r = Math.random();
        if (r < 0.1) { canal = true; cae = []; ox = Math.random() < 0.5 ? -1.2 : 1.2; }
        else if (c.tiro === 1) {
          if (r < 0.45) cae = pie;
          else { const k = Math.min(pie.length - 1, 4 + Math.floor(Math.random() * 5)); const lado = Math.random() < 0.5 ? -1 : 1; cae = [...pie].sort((a, b) => lado * (a.bx - b.bx) + aza(-0.15, 0.15)).slice(0, k); ox = (cae.reduce((u, p) => u + p.bx, 0) / cae.length - c.cx) * 1.0; }
        } else cae = Math.random() < 0.6 ? pie : pie.slice(0, Math.max(1, pie.length - 1 - Math.floor(Math.random() * 2)));
        if (!canal && c.tiro === 2) ox = cae.length ? cae.reduce((u, p) => u + p.bx, 0) / cae.length - c.cx : 0;
        c.plan = { cae, ox: Math.max(-0.8, Math.min(0.8, ox)), canal };
      }
      break;
    }
    case 'lanza': {
      const t = c.t, d = 1.0;   // 0-0,4 balanceo atrás · 0,4-0,62 adelante y suelta
      const phi = t < 0.4 ? 0.1 - 1.0 * suave(t / 0.4) : -0.9 + 1.5 * suave(Math.min(1, (t - 0.4) / 0.22));
      c.lean = t < 0.4 ? 0.25 + 0.2 * suave(t / 0.4) : 0.45 + 0.35 * suave(Math.min(1, (t - 0.4) / 0.22)); if (t > 0.75) c.lean = 0.8 * (1 - suave(Math.min(1, (t - 0.75) / 0.25)));
      g.rotation.x = c.lean; manoPos(g, c, phi);
      if (c.mano) { c.mano.position.copy(_p); c.mano.rotation.x -= 9 * dt; }
      if (c.mano && t >= 0.62) {   // suelta: la bola pasa de la mano a la pista
        const b = c.mano, pl = c.plan; c.mano = null; b.rotation.set(0, 0, 0);
        b.userData = { s: 0, largo: c.linea - 0.45 - c.zP, ox: pl.ox, canal: pl.canal, cae: pl.cae, golpeo: false, y0h: Math.max(0, b.position.y - y0 - 0.26) };
        b.position.set(c.cx + 0, b.position.y, c.linea - 0.45); c.ball = b; c.pf = 'rueda'; c.sonido = 0.15; c.tiros = (c.tiros || 0) + 1;
      }
      if (t > d) { c.fase = 'mira'; c.t = 0; c.lean = 0; g.rotation.x = 0; }
      break;
    }
    case 'mira':
      mirar(g, c.cx, c.zP, dt); c.lean = 0; g.rotation.x = 0;
      if (c.pf === 'listo' && c.t > 1.0) { c.fase = 'espera'; c.t = 0; }
      break;
  }
  if (c.fase === 'ir_rack' || c.fase === 'ir_linea') e.animForzada = null;
}

// ---- 16-11 (Diego): el jugador es un ciudadano de la ciudad viva (mallaCiudad.js). Marcha o reposo según la fase, el torso se inclina
// desde la columna (no todo el cuerpo desde los pies) y el brazo derecho se orienta hacia la bola (toma, balanceo y lanzamiento).
const VEL_ANDAR = 1.1, _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
function rotarMundo(hueso, q) {   // aplica la rotación q (en el mundo) al hueso
  hueso.getWorldQuaternion(_q2); hueso.parent.getWorldQuaternion(_q3);
  hueso.quaternion.copy(_q3.invert().multiply(_q1.copy(q).multiply(_q2))); hueso.updateMatrixWorld(true);
}
export function animarBolero(e, dt) {
  const P = e.persona, c = e.bolos, g = e.malla; if (!c) return;
  c.vel = VEL_ANDAR;
  const anda = (c.fase === 'ir_rack' || c.fase === 'ir_linea') && c.moviendo !== false;
  P.poner(anda ? 'caminar' : 'idle', null, { vel: anda ? VEL_ANDAR / (P.vel.caminar || 0.7) : 1, fundido: 0.25 });
  g.rotation.x = 0; P.actualizar(dt);
  if (!c.H) { const h = {}; P.escena.traverse(o => { if (o.isBone) h[o.name] = o; }); c.H = h.spine && h['uparm.R'] && h['hand.R'] ? { col: h.spine, up: h['uparm.R'], mano: h['hand.R'] } : false; }
  const H = c.H; if (!H) return;
  P.escena.updateMatrixWorld(true);
  if (c.lean) { _a.set(1, 0, 0).applyAxisAngle(Y, g.rotation.y); rotarMundo(H.col, _q.setFromAxisAngle(_a, c.lean)); }   // se agacha desde la cintura
  H.up.getWorldPosition(c.S || (c.S = new THREE.Vector3()));
  if (!c.r) c.r = H.mano.getWorldPosition(_a).distanceTo(c.S) + 0.13;   // largo del brazo + radio de la bola
  if (c.mano) {   // el brazo apunta a la bola que lleva (o que va a tomar del soporte)
    H.mano.getWorldPosition(_a).sub(c.S).normalize(); _b.copy(c.mano.position).sub(c.S).normalize();
    rotarMundo(H.up, _q.setFromUnitVectors(_a, _b));
  }
}
