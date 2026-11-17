// Nato en 3D: cápsula con controlador de Rapier, carrera, salto variable y doble salto, combo de 3 golpes,
// patada voladora, pisotón, nado, hielo y viento. (Mismas mecánicas del 2D, en metros y segundos.)
import * as THREE from 'three';
import { Personaje } from '../motor/fisica.js';
import { E } from '../motor/entrada.js';
import { mat } from '../mundo/construir.js';
import { SplatMesh, PackedSplats, SplatLoader } from '@sparkjsdev/spark';
import { animarSplat } from '../motor/animSplat.js';
import { ALTURAS, BASE_PERSONA, CORR_MALLA_NATO } from '../datos/alturas.js';
import { PERSONAJES_MALLA } from '../mundo/mallas.js';
import { variarNPC } from '../motor/variacionNPC.js';   // N0-NPC-UNICOS (carril animador): cada NPC con malla es único

export const MOV = { vel: 10.5, caminar: 7,   /* 14-11-2026 Diego: caminar = antigua carrera (7 m/s), correr +50 % (10,5); antes vel 7, caminar 1.6 */ acelSuelo: 60, acelAire: 22, acelHielo: 7, grav: 25, salto: 9.6, doble: 8.4, corte: 3.2, coyote: 0.12, buffer: 0.15, minSalto: 0.1, maxCaida: 30 };

// modelos de Idol de los personajes (assets3d/juego/p_*.ply): los registra principal.js
export const PERSONAJES = {}; const PACKS = {};
export function registrarPersonajes(dic) { Object.assign(PERSONAJES, dic); }
// R-2: personajes de gaussianas con carga diferida (ver personajeSplat)
const DIFERIR = new URLSearchParams(location.search).get('diferir') !== '0';
const DIFERIDOS = [], R_CARGA = 80, R_DIBUJO = 100;
export const estadoDiferidos = () => ({ total: DIFERIDOS.length, cargados: DIFERIDOS.filter(d => d.ps.isInitialized).length, visibles: DIFERIDOS.filter(d => d.s.visible).length });
const _p = new THREE.Vector3();
export function actualizarDiferidos(camPos) {
  const ahora = performance.now();
  for (let i = DIFERIDOS.length - 1; i >= 0; i--) {
    const d = DIFERIDOS[i]; if (d.s.userData.reservaMalla) { d.s.visible = false; continue; }   // la malla (minero, jefe) lo reemplaza: no se baja el .ply
    let top = d.pivote; while (top.parent) top = top.parent;
    if (!top.isScene) { if (ahora - d.t0 > 15000) { DIFERIDOS.splice(i, 1); d.s.visible = false; } continue; }   // nivel descartado (o aún sin colgar)
    d.pivote.getWorldPosition(_p);
    const dist = _p.distanceTo(camPos);
    if (dist < R_CARGA && d.ps.abrirCarga) { d.ps.abrirCarga(); d.ps.abrirCarga = null; }
    const quiere = d.ps.isInitialized && (d.s.visible ? dist < R_DIBUJO * 1.15 : dist < R_DIBUJO);
    if (d.s.visible !== quiere) d.s.visible = quiere;
  }
}
// un personaje de gaussianas: pies en el suelo, mirando a +Z local, de «alto» metros
// G-PERS (carril animador): personajes secundarios con MALLA animada (blender/jefe_malla.py <glb> <id>; indice.json → _personajes).
// Si hay malla no se carga la nube: en su lugar va un Object3D en el mismo marco con la malla (un GLB compartido por todas las copias).
// userData.mallaPromesa → { escena, anim }. idle: acción que se anima sola (dolientes, pasajeros) si nadie la maneja.
export const MALLA_PIE = new Set(['diego', 'pedro', 'vecina', 'anciana', 'enfermera', 'medico', 'doliente_minero', 'doliente_mujer']);
export function personajeSplat(sp, alto, yaw = -Math.PI / 2, idMalla = null, idle = null, forzarMalla = false) {
  const [x0, y0, z0] = sp.minCrudo || sp.min, [x1, y1, z1] = sp.maxCrudo || sp.max, k = alto / (y1 - y0);
  const urlM = idMalla && (MALLA_PIE.has(idMalla) || forzarMalla) && PERSONAJES_MALLA[idMalla];   // forzarMalla: jefe/minero en cinemáticas y trenes (los enemigos cargan su malla en entidades.js)
  // R-2 (14-11): carga diferida. El .ply NO se baja ni se sube a la GPU hasta que un personaje de este modelo queda a menos de R_CARGA de la
  // cámara (actualizarDiferidos, cada cuadro desde principal.js); y solo se dibuja (visible) a menos de R_DIBUJO. Mientras tanto la nube está
  // vacía (0 gaussianas): Spark no ordena ni dibuja nada por ellos. ?diferir=0 la carga de una vez, como antes.
  if (!urlM && !PACKS[sp.url]) {
    if (DIFERIR) { let abrir; const puerta = new Promise(r => { abrir = r; });
      PACKS[sp.url] = new PackedSplats({ construct: async p => { await puerta; await new SplatLoader().loadInternalAsync({ packedSplats: p, url: sp.url }); } }); PACKS[sp.url].abrirCarga = abrir; }
    else PACKS[sp.url] = new PackedSplats({ url: sp.url });   // sin LoD: con LoD los personajes no se dibujaban
  }
  const pivote = new THREE.Group(), vuelta = new THREE.Group();
  vuelta.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  const s = urlM ? new THREE.Object3D() : new SplatMesh({ packedSplats: PACKS[sp.url] , enableLod: false });
  if (urlM) {
    s.userData.mallaId = idMalla;
    s.userData.mallaPromesa = import('../motor/animMalla.js').then(m => m.cargarMalla(urlM, { compartir: true })).then(r => {
      const gm = new THREE.Group(); gm.rotation.x = Math.PI; gm.add(r.escena); s.add(gm);
      variarNPC(r, { malla: idMalla, raiz: pivote, alto, ancla: s });   // N0-NPC-UNICOS: ropa, pelo, piel, sombrero, altura por NPC
      if (idle) {   // nadie la maneja: se anima sola mientras se dibuja
        r.anim.tocar(r.anim.nombres.includes(idle) ? idle : 'idle'); r.anim.actualizar(Math.random() * 3);
        let t0 = 0; const piel = []; r.escena.traverse(o => { if (o.isSkinnedMesh) piel.push(o); });
        if (piel[0]) piel[0].onBeforeRender = () => { const t = performance.now() / 1000, dt = t0 ? Math.min(0.1, t - t0) : 0; t0 = t; if (dt && !s.userData.manejada) r.anim.actualizar(dt); };
      }
      return r;
    });
  }
  s.position.set(-(x0 + x1) / 2, -y1, -(z0 + z1) / 2);
  vuelta.userData.splat = s;   // para el esqueleto de Blender (animSplat)
  if (DIFERIR && !urlM) { s.visible = false; s.userData.diferido = true; DIFERIDOS.push({ pivote, s, ps: PACKS[sp.url], t0: performance.now() }); }
  vuelta.add(s); pivote.add(vuelta); pivote.scale.setScalar(k); pivote.rotation.y = yaw + (sp.yaw || 0);
  return pivote;
}
export function mallaPersona(colores, escala = 1, clave = null, op = {}) {
  const g = new THREE.Group();
  if (clave && PERSONAJES[clave]) {   // con modelo de Idol: las piezas de la cápsula quedan como referencias invisibles
    g.add(personajeSplat(PERSONAJES[clave], BASE_PERSONA * escala * (PERSONAJES[clave].alto || 1), undefined, clave.replace(/^p_/, ''), 'idle', !!op.malla));   // escala 1 = 1,75 m (js/datos/alturas.js)
    const nada = () => { const o = new THREE.Object3D(); o.material = null; g.add(o); return o; };
    g.userData = { cuerpo: Object.assign(nada(), { material: mat(colores.cuerpo) }), brazo: nada(), brazo2: nada(), cabeza: nada(), splat: true };
    return g;
  }
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.34 * escala, 0.62 * escala, 6, 12), mat(colores.cuerpo));
  cuerpo.position.y = 0.95 * escala; cuerpo.castShadow = true; g.add(cuerpo);
  const piernas = new THREE.Mesh(new THREE.CapsuleGeometry(0.3 * escala, 0.3 * escala, 4, 10), mat(colores.piernas ?? 0x2a3550));
  piernas.position.y = 0.42 * escala; piernas.castShadow = true; g.add(piernas);
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.27 * escala, 16, 12), mat(colores.piel ?? 0xe0b48a));
  cabeza.position.y = 1.62 * escala; cabeza.castShadow = true; g.add(cabeza);
  if (colores.pelo != null) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.28 * escala, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(colores.pelo)); p.position.y = 1.66 * escala; p.rotation.x = -0.25; g.add(p); }
  if (colores.casco != null) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.31 * escala, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(colores.casco, { rough: 0.4 })); c.position.y = 1.68 * escala; g.add(c); }
  // nariz: para ver hacia dónde mira
  const n = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.16), mat(colores.piel ?? 0xe0b48a)); n.position.set(0, 1.6 * escala, 0.27 * escala); g.add(n);
  const brazo = new THREE.Mesh(new THREE.CapsuleGeometry(0.1 * escala, 0.5 * escala, 4, 8), mat(colores.cuerpo));
  brazo.position.set(0.42 * escala, 1.05 * escala, 0); brazo.castShadow = true; g.add(brazo);
  const brazo2 = brazo.clone(); brazo2.position.x = -0.42 * escala; g.add(brazo2);
  g.userData = { cuerpo, brazo, brazo2, cabeza };
  return g;
}

export class Jugador {
  constructor(fis, escena, x, y, z) {
    this.fis = fis;
    this.p = new Personaje(fis, x, y + 0.95, z);
    this.malla = mallaPersona({ cuerpo: 0x2b4a7e, piernas: 0x1f2c4a, pelo: 0x1d1a1a });   // chaqueta de mezclilla azul, pelo oscuro
    escena.add(this.malla);
    this.brillo = new THREE.PointLight(0xffb347, 0, 4); this.malla.add(this.brillo); this.brillo.position.y = 1;
    this.vel = new THREE.Vector3(); this.rumbo = 0;
    this.reiniciar();
  }
  reiniciar() {
    this.estado = 'normal'; this.invul = 0; this.chaqueta = 0; this.ataque = null; this.combo = 0; this.ventana = 0;
    this.coyote = 0; this.buffer = 0; this.dobleUsado = false; this.vel.set(0, 0, 0); this.lucha = 0; this.nadando = false; this.t = 0; this.gestoAct = null;
  }
  // Nato con su modelo de Idol (el chico de animacion3d): reemplaza la cápsula; la animación de esqueleto llega en la Fase 3
  ponerSplat(sp, yawExtra = 0) {
    const [x0, y0, z0] = sp.minCrudo || sp.min, [x1, y1, z1] = sp.maxCrudo || sp.max, k = ALTURAS.nato / (y1 - y0);   // 1,78 m (js/datos/alturas.js; antes 1,8 y la malla medía 1,89 en idle)
    const pivote = new THREE.Group();
    const giro = new THREE.Group(); giro.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    pivote.add(giro); pivote.scale.setScalar(k); pivote.rotation.y = yawExtra;
    this.splat = pivote; this.malla.add(pivote);
    // centro en planta y pies en el suelo: el punto (centro x, y1, centro z) del splat queda en el origen y, tras la vuelta, abajo
    const desplazar = new THREE.Vector3(-(x0 + x1) / 2, -y1, -(z0 + z1) / 2);
    const conSplat = () => {
      const s = new SplatMesh({ packedSplats: new PackedSplats({ url: sp.url }) , enableLod: false });
      s.position.copy(desplazar); giro.add(s);
      animarSplat(s, 'nato').then(a => { this.anim = a; });   // esqueleto y acciones de Blender (blender/animar.py)
    };
    if (!new URLSearchParams(location.search).has('gaussianas')) {   // por defecto Nato malla (14-11); ?gaussianas=1 vuelve al de gaussianas
      // Nato como MALLA (TRELLIS.2 + mismo esqueleto y acciones, blender/nato_malla.py). Mismo marco que el splat: el GLB está en
      // ejes glTF = vuelta de 180° del .ply crudo, así que se deshace la vuelta de «giro» y se aplica el mismo desplazamiento
      import('../motor/animMalla.js').then(m => m.cargarMalla('assets3d/anim/nato_malla.glb')).then(r => {
        const g = new THREE.Group(); g.position.copy(desplazar).multiplyScalar(1 / CORR_MALLA_NATO); g.rotation.x = Math.PI; g.scale.setScalar(1 / CORR_MALLA_NATO); g.add(r.escena); giro.add(g);   // la malla en idle es 5 % más alta que la caja de la nube
        this.anim = r.anim; this.esMalla = true;
      }).catch(e => { console.warn('Nato malla', e); conSplat(); });   // respaldo: el de gaussianas
    } else conSplat();
    for (const k2 of ['cuerpo', 'brazo', 'brazo2', 'cabeza']) this.malla.userData[k2].visible = false;
    for (const h of this.malla.children) if (h.isMesh) h.visible = false;
  }
  // gesto de una vez (celebrar, saludar, recoger): manda sobre la acción normal mientras dure
  gesto(n, dura = 1) { this.gestoAct = { n, hasta: this.t + dura }; }
  get pos() { return this.p.pos; }
  get pie() { return this.p.pie; }
  teletransportar(x, y, z) { this.p.teletransportar(x, y + 0.95, z); this.vel.set(0, 0, 0); this.seguro = { x, y, z }; }

  actualizar(dt, cam, M) {
    (this.posAnt ||= new THREE.Vector3()).copy(this.pos); this.pieAnt = this.pie;   // para interpolar el dibujo entre pasos (vista)
    this.t += dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.chaqueta > 0) { this.chaqueta -= dt; if (this.chaqueta <= 0) { this.chaqueta = 0; M.avisos('Se acabó la chaqueta'); } }
    this.brillo.intensity = this.chaqueta > 0 ? 6 : 0;
    if (this.estado === 'fuera' || this.estado === 'atrapado' || this.estado === 'quieto') { this.dibujar(dt); return; }
    const sueloEt = this.p.etiquetaSuelo();
    const enHielo = (this.p.enSuelo && sueloEt && (sueloEt.tipo === 'nieve' || sueloEt.hielo)) || M.enHielo(this.pos);
    const agua = M.enAgua(this.pos);
    this.nadando = !!agua && this.pos.y < agua.y + 0.4;
    // deseo de movimiento según la cámara
    const f = cam.adelante(), r = cam.derecha();
    const lento = M.lento ? 0.3 : 1;
    // sin Shift camina (1,6 m/s, ritmo cómodo de la caminata capturada); con Shift corre (7 m/s)
    const v = (E.correr ? MOV.vel : MOV.caminar) * (this.chaqueta > 0 ? 1.15 : 1) * (enHielo ? 1.1 : 1) * lento;
    const deseo = new THREE.Vector3().addScaledVector(r, E.mover.x).addScaledVector(f, E.mover.y);
    if (deseo.lengthSq() > 1) deseo.normalize();
    const herido = this.estado === 'herido';
    const acel = herido ? 4 : this.p.enSuelo ? (enHielo ? MOV.acelHielo : MOV.acelSuelo) : MOV.acelAire;
    const objetivo = deseo.multiplyScalar(herido ? 0 : v);
    const ataqueQuieto = this.ataque && this.ataque.tipo !== 'patada' && this.p.enSuelo;
    if (ataqueQuieto) objetivo.multiplyScalar(0.15);
    const dx = objetivo.x - this.vel.x, dz = objetivo.z - this.vel.z, l = Math.hypot(dx, dz), paso = acel * dt;
    if (l > paso) { this.vel.x += dx / l * paso; this.vel.z += dz / l * paso; } else { this.vel.x = objetivo.x; this.vel.z = objetivo.z; }
    if (this.ataque && this.ataque.tipo === 'patada') { this.vel.x = Math.sin(this.rumbo) * 10; this.vel.z = Math.cos(this.rumbo) * 10; }
    else if (this.ataque && this.ataque.avance && this.ataque.t < this.ataque.tAv) { const va = this.ataque.avance / this.ataque.tAv; this.vel.x = Math.sin(this.rumbo) * va; this.vel.z = Math.cos(this.rumbo) * va; }   // G-A6: paso del golpe
    if (Math.hypot(E.mover.x, E.mover.y) > 0.1 && !herido) {
      const deseado = Math.atan2(objetivo.x || this.vel.x, objetivo.z || this.vel.z);
      let d = deseado - this.rumbo; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (!this.ataque) this.rumbo += d * Math.min(1, dt * 14);
    }
    // viento (empuja más en el aire)
    const w = M.viento(this.pos);
    if (w) { this.vel.x += w.x * dt * (this.p.enSuelo ? 1 : 2.2); this.vel.z += w.z * dt * (this.p.enSuelo ? 1 : 2.2); }
    // salto: coyote, buffer, salto variable y doble salto
    if (this.p.enSuelo) { this.coyote = MOV.coyote; this.dobleUsado = false; } else this.coyote -= dt;
    if (E.b.saltar.recien && !M.memoria) this.buffer = MOV.buffer; else this.buffer -= dt;   // N0-FABLE-1611 (M11): en la memoria de 1945 no se salta
    if (this.nadando) {
      this.vel.y = Math.max(this.vel.y - 6 * dt, -1.5);
      if (E.b.saltar.recien) this.vel.y = this.pos.y > agua.y - 0.6 ? 8.5 : 3.6;   // en la orilla, saltar lo saca del agua
      this.vel.x *= 0.6; this.vel.z *= 0.6;
    } else {
      if (this.buffer > 0 && (this.coyote > 0 || this.p.enSuelo) && !herido) {
        this.vel.y = MOV.salto; this.coyote = 0; this.buffer = 0; M.efecto('saltar'); this.tSaltoIni = this.t;
        // N0-CTRL: el salto manda: corta el golpe en curso (no la patada voladora), la memoria del combo y el gesto (recoger, saludar)
        if (this.ataque && this.ataque.tipo !== 'patada') this.ataque = null;
        this.colaAt = null; this.gestoAct = null;
      } else if (this.buffer > 0 && !this.p.enSuelo && !this.dobleUsado && M.dobleSalto && !herido) {
        this.vel.y = MOV.doble; this.dobleUsado = true; this.buffer = 0; M.efecto('saltar'); this.tDoble = this.t; this.tSaltoIni = this.t;
        this.gestoAct = null;
      }
      // salto variable: soltar antes corta la subida, pero no en los primeros 0,1 s (N0-CTRL: un toque de 30-60 ms daba un brinco de
      // 20 cm que parecía «no saltó»; ahora el mínimo es ~1,1 m y el salto completo sigue siendo 1,85 m)
      if (!E.b.saltar.apretado && this.vel.y > MOV.corte && !this.rebote && this.t - (this.tSaltoIni ?? -9) > MOV.minSalto) this.vel.y = MOV.corte;
      this.vel.y = Math.max(this.vel.y - MOV.grav * dt, -MOV.maxCaida);
      if (this.p.enSuelo && this.vel.y < 0) { this.vel.y = -1; this.rebote = false; }
    }
    // ¿hay un enemigo cerca? (cada 0,3 s): Nato se pone en guardia de pelea en vez del reposo
    this.tEnem = (this.tEnem || 0) - dt;
    if (this.tEnem <= 0) {
      this.tEnem = 0.3; this.enemigoCerca = false;
      for (const e of (M.L && M.L.lista) || []) {
        if (!e.vivo || !e.malla || !['minero', 'dinamitero', 'bolero'].includes(e.tipo) || ['ko', 'sevan', 'derrotado', 'dormido'].includes(e.estado)) continue;
        if (Math.hypot(e.malla.position.x - this.pos.x, e.malla.position.z - this.pos.z) < 7 && Math.abs(e.malla.position.y - this.pie) < 3) { this.enemigoCerca = true; break; }
      }
    }
    // ataques: en el suelo, combo de 4 (jab, recto, gancho, patada de remate); en carrera, golpe con paso; en el aire, patada voladora
    this.ventana -= dt;
    // G-A4: J y K casi juntos (K en los primeros 0,12 s del jab, con J aún apretado) también lanzan la patada con vuelta
    const jk = E.b.patada.recien && E.b.golpe.apretado && this.ataque && this.ataque.anim === 'jab' && this.ataque.t < 0.12;
    // memoria de botón: J o K apretado en los últimos 0,3 s de un golpe se guarda y sale apenas termina (antes se perdía y el combo
    // se cortaba al machacar; con pocos fps casi nunca encadenaba)
    let pg = E.b.golpe.recien && !M.memoria, pk = E.b.patada.recien && !M.memoria;   // N0-FABLE-1611 (M11): ni golpes ni patadas entre los dolientes
    if ((pg || pk) && this.ataque && !jk && this.ataque.dura - this.ataque.t < 0.3) this.colaAt = { g: pg, k: pk, vence: 0.4 };
    if (this.colaAt) { this.colaAt.vence -= dt; if (this.colaAt.vence <= 0) this.colaAt = null; else if (!this.ataque) { pg = pg || this.colaAt.g; pk = pk || this.colaAt.k; this.colaAt = null; } }
    if ((pg || pk) && (!this.ataque || jk) && !herido) {
      if (!this.p.enSuelo && !this.nadando) this.ataque = { tipo: 'patada', t: 0, dura: 0.5, golpeados: new Set() };
      else {
        // G-A2: J encadena jab -> recto -> gancho ascendente -> patada circular de remate; K en el suelo patea directo; en carrera,
        // golpe con paso largo (Oiduki). Cada golpe: anim (blender/mocap.py GOLPES), vel del clip, dura y ventana de impacto [v0, v1] s
        const G = { jab: ['golpe', 1.1, 0.36, 0.07, 0.2], recto: ['golpe', 1.1, 0.41, 0.09, 0.24], gancho: ['gancho', 1.1, 0.45, 0.13, 0.28],
          golpe2: ['gancho', 1.2, 0.52, 0.16, 0.34], golpe: ['golpe', 1.25, 0.5, 0.15, 0.32],
          // G-A4 patada con vuelta (blender/mocap.py 'giratoria', 37 cuadros): vuelta de 360° sobre el pie izquierdo; la pierna barre a la
          // altura de la cabeza desde ~0,44 s y llega de frente al rival a ~0,6 s
          giratoria: ['giratoria', 1.35, 0.9, 0.44, 0.7] };
        let anim;
        // G-A4: J+K juntos, o K después de dos o más golpes del combo (dentro de la ventana) = patada con vuelta
        if (pk && (pg || E.b.golpe.apretado || (this.ventana > 0 && this.combo >= 2))) { anim = 'giratoria'; this.combo = 0; }
        else if (pk) { anim = 'golpe2'; this.combo = 0; }
        else if (this.vS > 4.5 && this.ventana <= 0) { anim = 'golpe'; this.combo = 0; }
        else { this.combo = this.ventana > 0 ? (this.combo % 4) + 1 : 1; anim = ['jab', 'recto', 'gancho', 'golpe2'][this.combo - 1]; }
        const [tipo, vel, dura, v0, v1] = G[anim];
        this.ataque = { tipo, t: 0, dura, v0, v1, vel, golpeados: new Set(), anim };
      }
      M.efecto('golpe');
      // apuntado suave: se gira hacia el enemigo más cercano (hasta 4 m y 100° de cada lado) y da un paso hacia él
      let mejor = null, dMin = 4;
      for (const e of (M.L && M.L.lista) || []) {
        if (!e.vivo || !e.malla || !['minero', 'dinamitero', 'bolero', 'condor'].includes(e.tipo) || ['ko', 'sevan', 'derrotado'].includes(e.estado)) continue;
        const ex = e.malla.position.x - this.pos.x, ez = e.malla.position.z - this.pos.z, de = Math.hypot(ex, ez);
        let da = Math.atan2(ex, ez) - this.rumbo; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (de < dMin && Math.abs(da) < 1.75 && Math.abs(e.malla.position.y - this.pie) < 2.5) { dMin = de; mejor = Math.atan2(ex, ez); }
      }
      if (mejor !== null) this.rumbo = mejor;
      // G-A6: avance hasta el contacto (asistencia de beat 'em up): con un rival a menos de 2,6 m Nato se desliza hasta ~1 m de él
      // antes del impacto; sin rival, un paso corto. (Antes era un empujón de velocidad que el freno del ataque se comía: no llegaba.)
      if (this.ataque.tipo !== 'patada') {
        const cerca = mejor !== null && dMin < 2.6;
        this.ataque.avance = cerca ? Math.min(1.6, Math.max(0.2, dMin - 1.0)) : 0.35;
        this.ataque.tAv = Math.max(0.08, this.ataque.v0 || 0.12);
      }
    }
    if (this.ataque) {
      this.ataque.t += dt;
      if (this.ataque.t > this.ataque.dura) { if (this.ataque.tipo !== 'patada') this.ventana = 0.45; this.ataque = null; }
    }
    if (herido && this.p.enSuelo && this.t - this.tHerido > 0.35) this.estado = 'normal';
    // mover con colisiones
    const antesY = this.pos.y;
    this.p.mover(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    if (this.p.choqueTecho && this.vel.y > 0) this.vel.y = 0;
    this.vy = (this.pos.y - antesY) / dt;
    // última orilla segura (para volver después de una caída)
    if (this.p.enSuelo && sueloEt && ['tierra', 'nieve', 'plaza', 'escalera', 'azotea', 'anden', 'piso', 'plataforma', 'via', 'roca', 'balcon', 'mueble', 'cajon'].includes(sueloEt.tipo) && (!M.peligro(this.pos) || sueloEt.tipo === 'plataforma')) {   // el andén del andarivel está sobre el barranco: antes nunca guardaba punto seguro y, tras caer, se volvía al inicio del nivel
      this.tSeguro = (this.tSeguro || 0) + dt;
      if (this.tSeguro > 0.4) { this.seguro = { x: this.pos.x, y: this.pie, z: this.pos.z }; this.tSeguro = 0; }
    }
    this.dibujar(dt);
  }
  // caja de golpe del ataque actual: centro y radio, o null
  golpeActivo() {
    const a = this.ataque; if (!a) return null;
    const act = a.tipo === 'patada' ? (a.t > 0.1 && a.t < 0.36) : a.v0 !== undefined ? (a.t > a.v0 && a.t < a.v1) : (a.t > 0.12 && a.t < 0.32);   // ventana de la pierna o el puño estirado (patadas con recámara, como en el video de referencia)
    if (!act) return null;
    const alc = a.tipo === 'patada' ? 1.2 : a.anim === 'golpe2' ? 1.3 : a.anim === 'giratoria' ? 1.25 : 1.1;   // G-A6: puño estirado a ~1 m del centro de Nato tras el paso
    return { x: this.pos.x + Math.sin(this.rumbo) * alc, y: this.pos.y + (a.tipo === 'gancho' ? 0.3 : 0), z: this.pos.z + Math.cos(this.rumbo) * alc,
      r: a.tipo === 'patada' ? 1.15 : a.tipo === 'giratoria' ? 1.3 : 0.95, tipo: a.tipo, a };   // la giratoria barre más ancho
  }
  golpeado(desde, fuerza = 6) {
    if (this.estado === 'fuera' || this.estado === 'quieto') return;   // si ese golpe le quitó la vida, no lo «revive»
    const dx = this.pos.x - desde.x, dz = this.pos.z - desde.z, l = Math.hypot(dx, dz) || 1;
    this.vel.set(dx / l * fuerza, 6, dz / l * fuerza); this.estado = 'herido'; this.tHerido = this.t; this.ataque = null;
  }
  // por cuadro de pantalla, no por paso de física (14-11): antes la posición y la animación solo cambiaban en los pasos de 1/60 s;
  // en los cuadros sin paso Nato quedaba congelado mientras la cámara seguía moviéndose (tirones al caminar y correr).
  // alfa: fracción del paso siguiente ya transcurrida; la cámara sigue posVista, la misma posición interpolada
  vista(alfa, dtReal) {
    const m = this.malla, v = (this.posVista ||= new THREE.Vector3());
    if (this.posAnt && this.pieAnt !== undefined && this.posAnt.distanceToSquared(this.pos) < 9) {
      v.lerpVectors(this.posAnt, this.pos, alfa);
      m.position.set(v.x, this.pieAnt + (this.pie - this.pieAnt) * alfa, v.z);
    } else v.copy(this.pos);
    if (this.splat && this.anim) this.anim.actualizar(dtReal);
  }
  dibujar(dt) {
    const m = this.malla, u = m.userData;
    m.position.set(this.pos.x, this.pie, this.pos.z);
    m.rotation.y = this.rumbo;
    m.visible = this.estado !== 'fuera' && !(this.invul > 0 && Math.floor(this.t * 12) % 2 === 0);
    // TIRONES-MOVIL (17-11-2026): la luz de la chaqueta iba DENTRO de la malla de Nato y su parpadeo (invulnerable: al cruzar cada puerta y
    // al recibir un golpe) sacaba y ponía una luz de la escena → cambiaba la cuenta de luces y se recompilaban todos los sombreadores a la
    // vista (0,3-0,7 s en el celular). Ahora la luz cuelga de la escena y sigue a Nato
    if (this.brillo.parent === m && m.parent) m.parent.add(this.brillo);
    if (this.brillo.parent !== m) this.brillo.position.set(this.pos.x, this.pie + 1, this.pos.z);
    // poses simples de grey-box: brazo adelante al golpear, piernas que se balancean al correr
    const corre = Math.hypot(this.vel.x, this.vel.z) > 0.5 && this.p.enSuelo;
    u.brazo.rotation.x = this.ataque ? -1.5 : corre ? Math.sin(this.t * 14) * 0.8 : 0;
    u.brazo2.rotation.x = this.ataque && this.ataque.tipo === 'gancho' ? -2.4 : corre ? -Math.sin(this.t * 14) * 0.8 : 0;
    u.cuerpo.rotation.x = this.ataque && this.ataque.tipo === 'patada' ? -0.6 : 0;
    u.cuerpo.material = this.chaqueta > 0 ? mat(0xd27a3a, { emisivo: 0x7a3a10, brillo: 0.6 }) : mat(0x2b4a7e);
    // N1-C42: con la chaqueta regalona, torso y brazos de la malla de Nato toman su color (aparece en 0,4 s; parpadea los últimos 2 s)
    if (this.anim && this.anim.tenir) {
      this.kChaq = Math.max(0, Math.min(1, (this.kChaq || 0) + (this.chaqueta > 0 ? dt : -dt) * 2.5));
      const k = this.chaqueta > 0 && this.chaqueta < 2 ? this.kChaq * (0.55 + 0.45 * Math.cos(this.t * 14)) : this.kChaq;
      if (k !== this.kTenido) { this.anim.tenir(k); this.kTenido = k; }
    }
    if (this.splat && this.anim) {   // esqueleto de Blender: elige la acción según lo que hace Nato
      const v = Math.hypot(this.vel.x, this.vel.z), a = this.anim, cl = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
      // velocidad suavizada y marcha con histéresis: sin esto pasaba de caminar a correr (o a quieto) en cada cuadro y se veía cortado
      this.vS = (this.vS || 0) + (v - (this.vS || 0)) * Math.min(1, dt * 8);
      // A-CORRER (14-11): tres marchas, cada una con su clip calzado a la velocidad (blender/carrera.py): caminar (captura), trotar (7 m/s)
      // y correr (10,5 m/s); con el clip a vS / nativa el pie de apoyo no patina. Sin trotar (Nato de gaussianas) queda la carrera de antes.
      const tieneTrote = a.nombres.includes('trotar');
      if (!tieneTrote) { if (this.vS > 2.2) this.marcha = 'correr'; else if (this.marcha === 'correr' && this.vS < 1.7) this.marcha = 'caminar'; }
      else if (this.marcha === 'correr') { if (this.vS < 8.2) this.marcha = 'trotar'; }
      else if (this.vS > 8.8) this.marcha = 'correr';
      else if (this.marcha === 'trotar') { if (this.vS < 1.9) this.marcha = 'caminar'; }
      else if (this.vS > 2.4) this.marcha = 'trotar';
      if (this.vS < 0.35) this.marcha = null; else if (!this.marcha && this.vS > 0.6) this.marcha = 'caminar';
      // pendiente suavizada (subida / escalera): sobre ~11° corre con la variante cuesta arriba (más inclinado, rodilla más alta)
      const subeV = this.p.enSuelo && dt > 0 && this.piePrev !== undefined ? (this.pie - this.piePrev) / dt : 0;
      this.pend = (this.pend || 0) + (Math.max(-2, Math.min(2, subeV / Math.max(1, this.vS))) - (this.pend || 0)) * Math.min(1, dt * 5);
      this.subiendo = this.subiendo ? this.pend > 0.1 : this.pend > 0.2;
      // en el aire solo tras 0,1 s sin suelo (en las pendientes enSuelo parpadea); al caer de alto, un aterrizaje corto
      this.tAire = this.p.enSuelo ? 0 : (this.tAire || 0) + dt;
      const enAire = this.tAire > 0.1 || this.vel.y > 2;
      if (enAire) this.maxAire = Math.max(this.maxAire || 0, this.tAire); else { if ((this.maxAire || 0) > 0.45) this.tAterriza = this.t; this.maxAire = 0; }
      let n = 'idle', vel = 1, reiniciar = false, fundido = 0.25;
      if (this.gestoAct && this.t < this.gestoAct.hasta) { n = this.gestoAct.n; fundido = 0.1; reiniciar = this.gestoAct !== this.gestoVisto; this.gestoVisto = this.gestoAct; }
      else if (this.estado === 'herido') { n = 'herido'; fundido = 0.08; }
      else if (this.ataque) { n = this.ataque.tipo === 'patada' ? 'patada' : this.ataque.anim || 'golpe'; reiniciar = this.ataque !== this.ataqueVisto; this.ataqueVisto = this.ataque; fundido = 0.07; vel = this.ataque.vel || ({ golpe: 1.18, golpe2: 1.2, gancho: 1.25, patada: 1.07 })[n] || 1; }   // el clip entero cabe en lo que dura el ataque
      else if (this.nadando) n = 'nadar';
      else if (enAire) { n = this.tDoble && this.t - this.tDoble < 0.6 ? 'doble' : this.vel.y > 0.5 ? 'saltar' : 'caer'; fundido = n === 'caer' ? 0.3 : 0.1; reiniciar = n === 'doble' && this.tDoble !== this.dobleVisto; if (n === 'doble') this.dobleVisto = this.tDoble; }
      else if (this.t - (this.tAterriza ?? -9) < 0.22 && !this.marcha) { n = 'aterrizar'; fundido = 0.08; }
      else if (this.enemigoCerca && !this.marcha) { n = 'guardia'; fundido = 0.2; }
      // ritmo nativo de la captura (blender/mocap.py): caminar 1,08 m/s, correr 3,03 m/s. A 7 m/s la carrera iría a 2,3x y las piernas
      // se ven frenéticas: sobre el ritmo nativo sube más suave (potencia 0,65), como en los juegos de plataformas
      else if (this.marcha === 'correr' && !tieneTrote) { n = 'correr'; vel = cl(Math.pow(this.vS / 3.03, 0.65), 0.75, 2.4); fundido = 0.25; }
      // A-CORRER: velocidad nativa de cada clip (m/s a timeScale 1; los de carrera.py van escritos a media velocidad): vel = vS / nativa
      else if (this.marcha === 'correr') { n = this.subiendo && a.nombres.includes('correr_subir') ? 'correr_subir' : 'correr'; vel = cl(this.vS / 5.25, 0.5, 2.8); fundido = 0.22; }
      else if (this.marcha === 'trotar') { n = 'trotar'; vel = cl(this.vS / 3.5, 0.6, 2.8); fundido = 0.22; }
      else if (this.marcha) { n = 'caminar'; vel = cl(this.vS / 1.08, 0.6, 2.2); fundido = 0.25; }
      a.tocar(n, { vel, reiniciar, fundido, sincronizar: n === 'caminar' || n === 'correr' || n === 'trotar' || n === 'correr_subir' });   // la animación avanza en vista()
      // inclinación natural: se ladea hacia el lado del giro al correr y se echa adelante al subir una pendiente
      const giro = Math.atan2(Math.sin(this.rumbo - (this.rumboPrev ?? this.rumbo)), Math.cos(this.rumbo - (this.rumboPrev ?? this.rumbo))) / Math.max(dt, 1e-3);
      this.rumboPrev = this.rumbo;
      const sube = this.p.enSuelo && dt > 0 ? (this.pie - (this.piePrev ?? this.pie)) / dt : 0; this.piePrev = this.pie;
      const ladeo = this.marcha ? Math.max(-0.22, Math.min(0.22, -giro * 0.045 * Math.min(1, this.vS / 5))) : 0;
      const adelante = this.marcha && sube > 0.3 && !(this.marcha === 'correr' && this.subiendo && tieneTrote) ? Math.min(0.14, sube * 0.04) : 0;   // correr_subir ya trae la inclinación
      const k = Math.min(1, dt * 8);
      this.splat.rotation.z += (ladeo - this.splat.rotation.z) * k;
      this.splat.rotation.x += (adelante - this.splat.rotation.x) * k;
      this.splat.position.y = 0;
    } else if (this.splat) {   // animación simple del modelo: rebote al correr, inclinación al golpear y patear
      const v = Math.hypot(this.vel.x, this.vel.z);
      this.splat.position.y = corre ? Math.abs(Math.sin(this.t * 12)) * 0.08 : 0;
      this.splat.rotation.x = this.ataque ? (this.ataque.tipo === 'patada' ? -0.5 : 0.25) : corre ? 0.08 * Math.min(1, v / 7) : 0;
      this.splat.rotation.z = corre ? Math.sin(this.t * 12) * 0.04 : 0;
    }
  }
}
