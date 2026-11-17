// Personajes, objetos y peligros del grey-box 3D, con el comportamiento portado del 2D (juego.js):
// mineros con combo y pisotón, cóndores que avisan y bajan en picada, Hércules, Diego y la chaqueta regalona,
// pepitas, pan, fogatas, apuntes, letreros, ollas, vagonetas, bolas, dinamita, tablones, capachos, alud, jefes y tren.
import { mallaDe, mallaMovil, grupoMalla, PERSONAJES_MALLA, condorMalla } from '../mundo/mallas.js';
import { ALTURAS, escalaPersona } from '../datos/alturas.js';
import * as THREE from 'three';
import { mat, letreroTex } from '../mundo/construir.js';
import { mallaPersona, personajeSplat, PERSONAJES } from './jugador.js';
import { DIF, P, danar, sumarEnergia, sumarPepita, curar, noqueo, apunte, DURA_CHAQUETA } from './logica.js';
import { E } from '../motor/entrada.js';
import { UI, lectura } from '../ui/hud.js';
import { altura } from '../mundo/terreno.js';
import { SplatMesh, PackedSplats, SplatEdit, SplatEditSdf } from '@sparkjsdev/spark';
import { corregirAzul } from '../mundo/corregirAzul.js';   // N2-C24 (carril ciudad): fogata
import { FABRICA_VIDA, portaollas, PORTAOLLAS_H } from '../mundo/vidaMinera.js';   // N0-VIDA (carril ciudad): faena, gente, reliquia
import { animarSplat } from '../motor/animSplat.js';
import { juegaBolos, animarBolero } from './boleroJuega.js';
import { cargarTipo, crearPersona } from '../motor/mallaCiudad.js';
import { texMat, piezaTex } from '../mundo/texFaena.js';   // TEX (16-11): olla tiznada, vigas y cajón del pan con textura
import { piezaGrupo, hayPieza, precargarUtileria } from '../mundo/utileria.js';   // 16-11: pan de malla   // 16-11: el jugador de bolos es un ciudadano
import { andarivelVuelta, cargaMineral, cargaSacos, TB_ESP } from '../mundo/abasto.js';   // N1-ABASTECIMIENTO (carril vida): capachos de ida y vuelta   // N2-C34: el bolero del palitroque juega a los bolos

// Hércules con su modelo de Idol (el perro de animacion3d): cuerpo a lo largo de +Z local, 0,85 m a la cruz
let modeloPerro = null;
// vehículo de gaussianas (locomotora, carros): enderezado con su eje largo, dado vuelta (Idol guarda Y hacia abajo),
// escalado al largo pedido y con el centro de su base en el origen del grupo
const PACKS_VEH = {};
export function vehiculoSplat(sp, largo, yaw = 0, ancho = 0, alto = 0, movil = false) {   // movil: usa la malla de TRELLIS si existe (sin el retraso de Spark)
  // alto aparte: la locomotora de Idol sale rechoncha (1,24 × 0,72): escalada solo por el largo medía 9 m de alto
  const [x0, y0, z0] = sp.min, [x1, y1, z1] = sp.max, k = largo / (x1 - x0), kz = ancho ? ancho / (z1 - z0) : k, ky = alto ? alto / (y1 - y0) : k;   // ancho aparte: escalado solo por el largo quedaban de 4-5 m de ancho, fuera de la vía
  const afuera = new THREE.Group(), m = new THREE.Group();
  m.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.alinear || 0));
  const info = movil ? mallaMovil(sp) : mallaDe(sp);   // ?malla=1: malla de TRELLIS.2 en la misma caja que la nube
  if (info) afuera.add(grupoMalla(info, sp)); else { m.add(new SplatMesh({ packedSplats: (PACKS_VEH[sp.url] ||= new PackedSplats({ url: sp.url })) })); afuera.add(m); }   // P-PUBLICAR: el .ply solo se baja si se dibuja (con malla no)
  afuera.scale.set(k, ky, kz); afuera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const ancla = new THREE.Vector3((x0 + x1) / 2, -y1, -(z0 + z1) / 2).multiply(afuera.scale).applyQuaternion(afuera.quaternion);
  afuera.position.copy(ancla).negate();
  const g = new THREE.Group(); g.add(afuera); return g;
}
export function perroSplat(sp, yawExtra = 0) {
  const [x0, y0, z0] = sp.min, [x1, y1, z1] = sp.max, k = ALTURAS.hercules / (y1 - y0);   // mastín: cabeza a 0,97 m (js/datos/alturas.js)
  const afuera = new THREE.Group(), vuelta = new THREE.Group();
  vuelta.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.alinear || 0));
  if (PERSONAJES_MALLA.hercules) {
    // Hércules MALLA (TRELLIS.2 + su esqueleto y acciones, blender/hercules_malla.py): mismo marco que la nube (el GLB va en
    // ejes glTF = vuelta del .ply crudo, así que se deshace esa vuelta dentro de «vuelta»)
    const gm = new THREE.Group(); gm.rotation.x = Math.PI; vuelta.add(gm); afuera.add(vuelta);
    afuera.userData.mallaPromesa = import('../motor/animMalla.js').then(m => m.cargarMalla(PERSONAJES_MALLA.hercules)).then(r => { gm.add(r.escena); return r; });
  } else {
    const s = new SplatMesh({ packedSplats: (modeloPerro ||= new PackedSplats({ url: sp.url })), enableLod: false });   // P-PUBLICAR: el .ply solo si no hay malla vuelta.add(s); afuera.add(vuelta);
    afuera.userData.splat = s;   // para el esqueleto de Blender (animSplat)
  }
  afuera.scale.setScalar(k);
  // eje largo (X enderezado) hacia +Z local; los pies en el suelo y el centro en planta
  afuera.rotation.y = -Math.PI / 2 + yawExtra;
  const ancla = new THREE.Vector3((x0 + x1) / 2, -y1, -(z0 + z1) / 2).multiplyScalar(k).applyEuler(afuera.rotation);
  const g = new THREE.Group(); afuera.position.copy(ancla).multiplyScalar(-1); g.add(afuera);
  return g;
}

// N3-X2: retroceso que no tira al vacío. Prueba el suelo a lo largo del vuelo (~0,8 s × fuerza); si en algún punto falta suelo
// o cae más de 1,5 m (cornisa del jefe, terrazas, andenes), prueba con la mitad y luego con un empujón mínimo hacia el lado seguro.
function golpeSeguro(M, j, desde, fuerza) {
  const dx = j.pos.x - desde.x, dz = j.pos.z - desde.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  const libre = f => { for (let k = 1; k <= 4; k++) { const d = f * 0.2 * k, h = M.fis.rayo({ x: j.pos.x + ux * d, y: j.pie + 1.2, z: j.pos.z + uz * d }, { x: 0, y: -1, z: 0 }, 2.7, j.p.col); if (!h) return false; } return true; };
  if (libre(fuerza)) return j.golpeado(desde, fuerza);
  if (libre(fuerza * 0.45)) return j.golpeado(desde, fuerza * 0.45);
  j.golpeado({ x: j.pos.x - ux, z: j.pos.z - uz }, 1.2);   // al borde: solo el salto del golpe, casi en el lugar
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const COL = { minero: { cuerpo: 0x7a5236, piernas: 0x3b3a36, casco: 0xf0c419 }, diego: { cuerpo: 0xe9dfc4, piernas: 0xb59a6a, pelo: 0x2a2220 },
  vecina: { cuerpo: 0xb04a6a, piernas: 0x5a3040, pelo: 0x3a2a20 }, anciana: { cuerpo: 0x4a4a6a, piernas: 0x2a2a3a, pelo: 0xdcdcdc },
  enfermera: { cuerpo: 0xf4f4f4, piernas: 0xf4f4f4, pelo: 0x3a2a20 }, medico: { cuerpo: 0xffffff, piernas: 0x3a3a3a, pelo: 0x8a8a8a },
  pedro: { cuerpo: 0x8fb8d8, piernas: 0x3a4a6a, pelo: 0xf0f0f0 }, jefe: { cuerpo: 0x5a3a26, piernas: 0x2a2a2a, casco: 0xf0c419 } };

export class Entidades {
  constructor(M) { this.M = M; this.lista = []; this.porTipo = {}; }
  agregar(e) { this.lista.push(e); (this.porTipo[e.tipo] ||= []).push(e); if (e.malla) this.M.grupoDe(e).add(e.malla); return e; }
  quitar(e) { e.vivo = false; if (e.malla) e.malla.removeFromParent(); }
  de(tipo) { return (this.porTipo[tipo] || []).filter(e => e.vivo); }
  actualizar(dt) {
    for (const e of this.lista) if (e.vivo && e.act && (!e.sala || e.sala === this.M.salaActual)) e.act(dt);
    if (this.lista.length > 400) { this.lista = this.lista.filter(e => e.vivo); for (const k in this.porTipo) this.porTipo[k] = this.porTipo[k].filter(e => e.vivo); }
  }
}

// ------------------------------------------------------------------ fábrica desde los datos del nivel
export function crearEntidades(M, R) {
  const L = new Entidades(M);
  const specs = [...R.specs];
  for (const s of Object.values(R.salas)) specs.push(...s.specs);
  Object.assign(FABRICA, FABRICA_VIDA);   // N0-VIDA
  for (const s of specs) {
    const f = FABRICA[s.t];
    if (!f) { console.warn('sin fábrica:', s.t); continue; }
    try { f(M, L, s); } catch (err) { console.warn('entidad con problema', s, err); }
  }
  for (const a of R.andariveles) capachos(M, L, a);
  for (const t of R.tablones) tablon(M, L, t);
  for (const s of Object.values(R.salas)) { for (const a of s.ascensores) ascensor(M, L, a, s.id); }
  return L;
}

// N0-INT (carril interiores): crea una entidad suelta (vecinos de los interiores procedurales, que se arman al entrar)
export function crearEntidad(M, s) { const f = FABRICA[s.t]; if (f) f(M, M.L, s); }
function ySuelo(M, s, extra = 0) {
  if (s.ySala) return s.y + extra;
  return s.y + extra;
}
const base = (s, tipo, extra) => ({ tipo, vivo: true, x: s.x, y: s.y, z: s.z, sala: s.sala || null, t: 0, ...extra });

// Hielo a la vista: lámina azulada y brillante. Si la zona cae sobre una escalera, va inclinada sobre sus peldaños
// (como una capa de hielo que tapa los escalones); si no, una lámina pegada al suelo.
function hieloVisible(M, L, s) {
  // textura de hielo: celeste con vetas blancas y rayones (sin mapa de entorno el brillo solo no se notaba)
  const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g2 = c.getContext('2d');
  g2.fillStyle = '#a9d8f5'; g2.fillRect(0, 0, 128, 512); let sem = 3; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) { g2.fillStyle = `rgba(255,255,255,${0.08 + az() * 0.18})`; g2.beginPath(); g2.ellipse(az() * 128, az() * 512, 10 + az() * 30, 30 + az() * 90, az() * 0.6 - 0.3, 0, 7); g2.fill(); }
  g2.strokeStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 40; i++) { g2.lineWidth = 0.6 + az() * 1.4; g2.beginPath(); const x = az() * 128, y = az() * 512; g2.moveTo(x, y); g2.lineTo(x + az() * 40 - 20, y + 20 + az() * 70); g2.stroke(); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(1, 6);
  const mt = new THREE.MeshStandardMaterial({ map: tx, color: 0xe6f6ff, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.8, emissive: 0x9fd0ff, emissiveIntensity: 0.22 });
  const esc = Object.values(M.R.escaleras || {}).find(e => Math.abs((e.a.x + e.b.x) / 2 - s.x) < s.sx && Math.min(e.a.z, e.b.z) < s.z + s.sz / 2 && Math.max(e.a.z, e.b.z) > s.z - s.sz / 2);
  const g = new THREE.Group();
  if (esc) {
    const d = new THREE.Vector3().subVectors(esc.b, esc.a), L2 = d.length(), n = Math.max(2, Math.round(Math.hypot(d.x, d.z) / 0.32)), alto = Math.abs(d.y) / n;
    const lamina = new THREE.Mesh(new THREE.BoxGeometry(Math.max(esc.ancho, s.sx) - 0.4, 0.06, L2), mt);
    lamina.position.copy(esc.a).addScaledVector(d, 0.5); lamina.position.y += alto + 0.03;   // sobre las aristas de los peldaños
    lamina.rotation.set(-Math.asin(d.y / L2), Math.atan2(d.x, d.z), 0, 'YXZ'); g.add(lamina);
  } else {
    const lamina = new THREE.Mesh(new THREE.BoxGeometry(s.sx, 0.05, s.sz), mt); lamina.position.set(s.x, altura(s.x, s.z) + 0.06, s.z); g.add(lamina);
  }
  L.agregar({ tipo: 'decor', vivo: true, malla: g, sala: null });
}
// Viento a la vista: nieve arrastrada que cruza la zona en la dirección del viento y banderines que flamean en los bordes
function vientoVisible(M, L, s) {
  const N = 420, dir = s.dir || [1, 0], vel = 3 + (s.fuerza || 5) * 1.6, pos = new Float32Array(N * 3), base = new Float32Array(N * 2), fase = new Float32Array(N);
  const x0 = s.x - s.sx / 2, z0 = s.z - s.sz / 2;
  for (let i = 0; i < N; i++) { const x = x0 + Math.random() * s.sx, z = z0 + Math.random() * s.sz; base[i * 2] = Math.random() * 5.5 + 0.2; fase[i] = Math.random() * 6.3; pos.set([x, altura(x, z) + base[i * 2], z], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cc = document.createElement('canvas'); cc.width = cc.height = 32; const gc = cc.getContext('2d'), gr = gc.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); gc.fillStyle = gr; gc.fillRect(0, 0, 32, 32);   // copo redondo (sin mapa los puntos eran cuadrados)
  const nieve = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cc), color: 0xffffff, size: 0.3, transparent: true, opacity: 0.9, depthWrite: false }));
  nieve.frustumCulled = false;
  const g = new THREE.Group(); g.add(nieve);
  // banderines en postes a los dos lados de la zona (perpendiculares al viento), apuntando a sotavento
  const banderas = [], colores = [0xd8443a, 0xf0c419, 0x2f62b8];
  const lados = Math.abs(dir[0]) > Math.abs(dir[1]) ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
  lados.forEach(([lx, lz], j) => { for (let k = 0; k < 4; k++) {
    const u = (k + 0.5) / 4 - 0.5, x = s.x + (lz ? u * s.sx : lx * s.sx / 2), z = s.z + (lx ? u * s.sz : lz * s.sz / 2), y = altura(x, z);
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4, 6), mat(0x6a4a2a)); poste.position.set(x, y + 2, z); g.add(poste);
    const piv = new THREE.Group(); piv.position.set(x, y + 3.6, z); g.add(piv);
    const tri = new THREE.Shape([new THREE.Vector2(0, 0.3), new THREE.Vector2(1.4, 0), new THREE.Vector2(0, -0.3)]);
    const b = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat(colores[(j + k) % 3], { doble: true })); piv.add(b);
    banderas.push({ piv, b, f: Math.random() * 6 });
  } });
  const rumbo = Math.atan2(-dir[1], dir[0]);
  const e = L.agregar({ tipo: 'decor', vivo: true, malla: g, sala: null, t: 0 });
  e.act = dt => {
    e.t += dt;
    for (let i = 0; i < N; i++) {
      let x = pos[i * 3] + dir[0] * vel * dt, z = pos[i * 3 + 2] + dir[1] * vel * dt;
      if (x > x0 + s.sx) x -= s.sx; if (x < x0) x += s.sx; if (z > z0 + s.sz) z -= s.sz; if (z < z0) z += s.sz;
      pos[i * 3] = x; pos[i * 3 + 2] = z; pos[i * 3 + 1] = altura(x, z) + base[i * 2] + Math.sin(e.t * 3 + fase[i]) * 0.25;
    }
    geo.attributes.position.needsUpdate = true;
    for (const f of banderas) { f.piv.rotation.y = rumbo + Math.sin(e.t * 6 + f.f) * 0.22; f.b.rotation.x = Math.sin(e.t * 9 + f.f) * 0.35; }
  };
}

const TECHOS = ['techo', 'azotea', 'muro', 'balcon', 'baranda'];   // superficies de edificio donde no va una pepita suelta
const FABRICA = {
  pepitas(M, L, s) {
    const [x0, z0] = s.de, [x1, z1] = s.a;
    for (let i = 0; i < s.n; i++) {
      let x = x0 + (x1 - x0) * i / Math.max(1, s.n - 1), z = z0 + (z1 - z0) * i / Math.max(1, s.n - 1), y = s.y;
      if (y == null) {
        // la fila cruza edificios: una pepita que cae sobre un techo (el molino del N1) no se alcanzaba. Se corre de lado
        // (perpendicular a la fila) hasta el suelo libre más cercano
        const L2 = Math.hypot(x1 - x0, z1 - z0) || 1, px = -(z1 - z0) / L2, pz = (x1 - x0) / L2;
        // N1-C48: y sin muro a menos de 1 m en horizontal a la altura de la pepita (quedaban metidas en zócalos de las casas)
        const muro = (a, yy, b) => { for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4; if (M.fis.rayo({ x: a, y: yy, z: b }, { x: Math.cos(an), y: 0, z: Math.sin(an) }, 1.0)) return true; } return false; };
        const libre = (a, b, cm) => { const h = M.fis.rayo({ x: a, y: 1200, z: b }, { x: 0, y: -1, z: 0 }, 1500); const t = h && M.fis.etiquetas.get(h.col.handle); return h && h.toi > 5 && !(t && TECHOS.includes(t.tipo)) && !(cm && muro(a, h.punto.y + 1, b)) ? h.punto.y : null; };
        for (const cm of [true, false]) { for (const d of [0, 1.5, -1.5, 3, -3, 4, -4, 8, -8, 12, -12, 16, -16, 20, -20, 25, -25]) { const yy = libre(x + px * d, z + pz * d, cm); if (yy != null) { x += px * d; z += pz * d; y = yy + 1; break; } } if (y != null) break; }   // sin lugar libre de muros: como antes
        if (y == null) continue;
      }
      FABRICA.pepita(M, L, { x, z, y, sala: s.sala });
    }
  },
  pepita(M, L, s) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), mat(0xe08b3c, { metal: 0.8, rough: 0.25, emisivo: 0x5a2a08, brillo: 0.5 }));
    m.position.set(s.x, s.y, s.z); m.castShadow = true;
    // REV (16-11, revisor de mallas): pepita de cobre = malla aprobada `pepita` (calcopirita con malaquita) a 1,9×, con brillo propio para que se lea
    // como coleccionable; el octaedro se vuelve invisible (sigue siendo el que gira y flota). Sin malla queda el octaedro
    const ponerP = () => { const p = piezaGrupo('pepita', [1.9, 1.9, 1.9]); if (!p) return; const me = p.children[0], C = FABRICA.pepita;
      C.matM ||= (() => { const q = me.material.clone(); q.emissive = new THREE.Color(0x7a3a10); q.emissiveIntensity = 0.9; q.metalness = 0.45; q.roughness = 0.4; return q; })();
      C.inv ||= new THREE.MeshBasicMaterial({ visible: false });
      me.material = C.matM; me.castShadow = true; p.position.y = -0.11 * 1.9; m.material = C.inv; m.add(p); };
    if (hayPieza('pepita')) ponerP(); else { const c0 = precargarUtileria(); if (c0) c0.then(ponerP); }
    const e = L.agregar(base(s, 'pepita', { malla: m }));
    e.act = dt => { m.rotation.y += dt * 3; m.position.y = s.y + Math.sin(M.t * 3 + s.x) * 0.1;
      if (M.cerca(m.position, 1.1)) { sumarPepita(); M.efecto('pepita'); L.quitar(e); } };
  },
  pan(M, L, s) {
    // un pan recién horneado sobre un cajón de madera apoyado en el suelo (antes una bola café flotando a 0,6 m); el cajón baja 1 m bajo tierra para que no quede en el aire en la ladera
    const g = new THREE.Group(), y0 = s.y;
    const cajon = piezaTex(new THREE.BoxGeometry(1.1, 1.9, 0.8), texMat('tablas', 0x9a7050)); cajon.position.y = 0.45 - 0.95 + 0.0; g.add(cajon);   // TEX: tablas viejas con vetas y clavos (antes mat liso)
    const tapa = piezaTex(new THREE.BoxGeometry(1.2, 0.07, 0.9), texMat('tablas', 0xb08a64)); tapa.position.y = 0.5; g.add(tapa);
    const paño = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.6), mat(0xf0e8d8, { rough: 1 })); paño.position.y = 0.545; g.add(paño);
    const m = new THREE.Group(); m.position.y = 0.8; g.add(m);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), mat(0xd9a05a)); bola.scale.set(1.2, 0.7, 1); m.add(bola);
    // 16-11 (Diego: «vi la malla de un pan dentro de una casa, ¿se puede aplicar al que se come Nato?»): el pan TRELLIS de la utilería
    // (0,32 m) a 2,2× para que se lea como objeto que se recoge; la bola queda de respaldo si la malla no carga
    const poner = () => { const p = piezaGrupo('pan', [2.2, 2.2, 2.2]); if (!p) return; p.position.y = -0.55 * 0.16 * 2.2 - 0.06; p.traverse(o => { o.castShadow = true; }); m.remove(bola); m.add(p); };
    if (hayPieza('pan')) poner(); else { const c0 = precargarUtileria(); if (c0) c0.then(poner); }
    // REV (16-11, revisor de mallas): el cajón es la malla aprobada `cajon` (cajón de tablas con zunchos) a [1,4, 0,9, 1,45] = 1,12 × 0,54 × 0,8 m;
    // la caja de tablas baja a zócalo bajo tierra (tapa la ladera) y la tapa de caja se oculta. Sin malla, todo como antes
    const ponerC = () => { const c = piezaGrupo('cajon', [1.4, 0.9, 1.45]); if (!c) return; c.traverse(o => { o.castShadow = true; }); g.add(c); cajon.position.y = -0.97; cajon.scale.set(0.88, 1, 0.88); tapa.visible = false; paño.position.y = 0.552; };
    if (hayPieza('cajon')) ponerC(); else { const c0 = precargarUtileria(); if (c0) c0.then(ponerC); }
    g.position.set(s.x, y0, s.z);
    const e = L.agregar(base(s, 'pan', { malla: g })), v = new THREE.Vector3(0, 0.8, 0), c = new THREE.Vector3();
    e.act = () => { m.rotation.y += 0.02; if (M.cerca(c.copy(g.position).add(v), 1.3)) { curar(); M.efecto('vida'); M.rotulo('+1 ♥'); L.quitar(e); } };
  },
  fogata(M, L, s) {
    const g = new THREE.Group();
    const spL = M.splatsTodos && M.splatsTodos.fogata_lena;
    if (spL) g.add(vehiculoSplat(spL, 2.2, (s.x * 0.21 + s.z * 0.17) % (Math.PI * 2), 2.2, 0.85));   // fogata con leña y piedras de Idol
    if (spL) g.traverse(o => { if (o instanceof SplatMesh) corregirAzul(o, spL.azul); });   // N2-C24: sin esto las piedras se veían azules (el «objeto azul tirado» de Diego)
    else for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), mat(0x5a3a1a)); l.rotation.z = Math.PI / 2; l.rotation.y = i * Math.PI / 4; l.position.y = 0.1; g.add(l); }
    // N1-C46 (pedido de Diego): empiezan APAGADAS (brasas tenues y un hilo de humo) y se encienden al tocarlas (punto de control).
    // La llama del modelo de Idol se tapa (SplatEdit) y el fuego es de sprites con textura radial suave y mezcla aditiva:
    // lenguas que suben, se achican y titilan (amarillo → naranja → rojo), chispas, humo y una luz que parpadea (una sola, compartida)
    if (spL) taparLlamaSplat(g);
    const F = fuegoFogata(M, g);
    g.position.set(s.x, ySuelo(M, s), s.z);
    const e = L.agregar(base(s, 'fogata', { malla: g, encendida: false }));
    e.act = dt => {
      F.actualizar(dt || 1 / 60, e.encendida);
      if (spL && !e.sinLlama && g.getObjectByName('malla_trellis')) e.sinLlama = quitarLlamaMalla(g);   // ?malla=1: quitar la llama pintada
      if (!e.encendida && M.cerca(g.position, 2.2)) { e.encendida = true; F.encender(); M.puntoControl({ x: s.x, y: g.position.y, z: s.z, sala: s.sala }); M.efecto('fogata'); M.rotulo('¡Fogata encendida!'); }
    };
  },
  apunte(M, L, s) {
    // libreta de tapas de cuero con lomo, cantos de hojas, elástico y cinta, parada y girando, con un halo cálido suave
    // (antes una tablilla naranja plana). Materiales compartidos entre todos los apuntes.
    const C = FABRICA.apunte;
    if (!C.mats) {
      const lienzo = (n, dib) => { const c = document.createElement('canvas'); c.width = c.height = n; dib(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
      const tapa = lienzo(128, (c, n) => {
        c.fillStyle = '#6b2a14'; c.fillRect(0, 0, n, n);
        for (let i = 0; i < 900; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,200,150,0.06)'; c.fillRect(Math.random() * n, Math.random() * n, 2, 2); }   // grano del cuero
        c.strokeStyle = 'rgba(232,190,110,0.85)'; c.lineWidth = 3; c.strokeRect(10, 10, n - 20, n - 20); c.lineWidth = 1.5; c.strokeRect(16, 16, n - 32, n - 32);
        c.fillStyle = 'rgba(232,190,110,0.9)'; c.fillRect(32, 46, n - 64, 4); c.fillRect(40, 58, n - 80, 3); c.fillRect(40, 66, n - 80, 3);   // rótulo dorado
      });
      const hojas = lienzo(64, (c, n) => { c.fillStyle = '#efe4c8'; c.fillRect(0, 0, n, n); c.fillStyle = 'rgba(120,100,70,0.35)'; for (let y = 2; y < n; y += 3) c.fillRect(0, y, n, 1); });
      const halo = lienzo(64, (c, n) => { const r = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(255,214,140,0.9)'); r.addColorStop(0.4, 'rgba(255,190,110,0.35)'); r.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = r; c.fillRect(0, 0, n, n); });
      const mTapa = new THREE.MeshStandardMaterial({ map: tapa, roughness: 0.6, emissive: 0x3a1606, emissiveIntensity: 0.6 });
      const mLomo = new THREE.MeshStandardMaterial({ color: 0x4a1a0a, roughness: 0.5, emissive: 0x2a0e04, emissiveIntensity: 0.6 });
      C.mats = { tapa: mTapa, lomo: mLomo, hojas: new THREE.MeshStandardMaterial({ map: hojas, roughness: 0.9, emissive: 0x3a3020, emissiveIntensity: 0.5 }),
        // caja de tapas: solo las dos caras grandes con cuero; los cantos del color del lomo
        tapas: [mLomo, mLomo, mLomo, mLomo, mTapa, mTapa], elastico: mat(0x151515), cinta: mat(0xb3202a), halo: new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }) };
    }
    const Mt = C.mats, g = new THREE.Group(), libro = new THREE.Group();
    const pagi = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.08), Mt.hojas); libro.add(pagi);
    for (const z of [-0.055, 0.055]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.03), Mt.tapas); t.position.z = z; libro.add(t); }
    const lomo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10, 1, false, Math.PI, Math.PI), Mt.lomo); lomo.position.x = -0.23; libro.add(lomo);
    const ela = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.62, 0.15), Mt.elastico); ela.position.x = 0.17; libro.add(ela);
    const cinta = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.005), Mt.cinta); cinta.position.set(-0.05, -0.36, 0.01); cinta.rotation.z = 0.15; libro.add(cinta);
    libro.rotation.x = -0.25; g.add(libro);
    // REV (16-11, revisor de mallas): libreta de cuero amarrada con cordel = malla aprobada `libreta` a 2,7× (0,43 × 0,59 m), parada; las cajas de respaldo
    const ponerL = () => { const p = piezaGrupo('libreta', [2.7, 2.7, 2.7]); if (!p) return; const resp = libro.children.slice(); p.rotation.x = -Math.PI / 2; p.position.z = 0.054; p.children[0].castShadow = true; libro.add(p); for (const o of resp) o.visible = false; };
    if (hayPieza('libreta')) ponerL(); else { const c0 = precargarUtileria(); if (c0) c0.then(ponerL); }
    const brillo = new THREE.Sprite(Mt.halo); brillo.scale.set(1.5, 1.5, 1); g.add(brillo);
    g.position.set(s.x, ySuelo(M, s, s.ySala ? 0.9 : 1.1), s.z);
    const e = L.agregar(base(s, 'apunte', { malla: g, i: s.i }));
    e.act = dt => { g.rotation.y += dt * 1.5; g.position.y += Math.sin(M.t * 2) * 0.003; brillo.material.opacity = 0.45 + Math.sin(M.t * 3) * 0.12;
      if (M.cerca(g.position, 1.3)) { if (apunte(s.i)) { M.efecto('apunte'); M.voz('pega'); M.leerApunte(s.i); M.jug.gesto('recoger', 0.55); } L.quitar(e); } };
  },
  letrero(M, L, s) {
    const g = new THREE.Group();
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), mat(0x6b4a2a)); poste.position.y = 0.7; g.add(poste);
    const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.1), mat(0x8a5f3c)); tabla.position.y = 1.5; g.add(tabla);
    const avisos = []; for (const lado of [1, -1]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshStandardMaterial({ map: letreroTex('AVISO', '#c8a070', '#3a2410', 256), roughness: 0.9 })); t.position.set(0, 1.5, 0.052 * lado); if (lado < 0) t.rotation.y = Math.PI; g.add(t); avisos.push(t); }   // antes tabla lisa sin texto
    // G9 (16-11): letrero de malla (G11 letrero_poste: poste rústico con tablero clavado, ×[1,17 1 1] = tablero de 1,4 m) con «AVISO» pintado
    // sobre la madera (letras con fondo transparente, cara de adelante: el letrero siempre mira a Nato); respaldo: poste, tabla y lienzos
    { const pu = precargarUtileria(); if (pu) pu.then(() => { const m = piezaGrupo('letrero_poste', [1.17, 1, 1]); if (!m) return; m.name = 'g9_letrero'; m.children[0].castShadow = true; g.add(m);
      poste.visible = tabla.visible = avisos[1].visible = false; const t = avisos[0];
      t.material = new THREE.MeshStandardMaterial({ map: letreroTex('AVISO', 'rgba(0,0,0,0)', '#2a1a0c', 256), roughness: 0.9, transparent: true, alphaTest: 0.3 });
      t.geometry = new THREE.PlaneGeometry(1.2, 0.56); t.position.set(0, 1.75, 0.128); }); }
    g.position.set(s.x, ySuelo(M, s), s.z);
    const e = L.agregar(base(s, 'letrero', { malla: g }));
    e.act = () => { g.lookAt(M.jug.pos.x, g.position.y, M.jug.pos.z); M.burbujaCerca(e, g.position, 4, '<b>Letrero:</b> ' + s.texto); };
  },
  npc(M, L, s) {
    const g = mallaPersona(COL[s.quien] || COL.vecina, escalaPersona(ALTURAS[s.quien] ? s.quien : 'mujer'), 'p_' + s.quien);   // alturas en js/datos/alturas.js
    g.userData.varNPC = { semilla: [s.quien, s.nombre, s.sala, Math.round(s.x), Math.round(s.z)].join('|'), quien: s.quien, nombre: s.nombre, sala: s.sala };   // N0-NPC-UNICOS (carril animador): variante fija por NPC (js/motor/variacionNPC.js)
    g.position.set(s.x, ySuelo(M, s), s.z);
    const e = L.agregar(base(s, 'npc', { malla: g }));
    const vid = ['vecina', 'anciana'].includes(s.quien) || splatDe(g)?.userData.mallaPromesa ? vida(g, s.quien) : null;   // G-PERS: enfermera y médico con malla también saludan y hablan
    e.act = dt => {
      g.lookAt(M.jug.pos.x, g.position.y, M.jug.pos.z);
      const nombre = s.nombre || { vecina: 'Vecina', anciana: 'Anciana', enfermera: 'Enfermera', medico: 'Médico' }[s.quien] || s.quien;   // N2-ESCUELA: s.nombre (Profesor, Guía del museo…)
      const cerca = M.burbujaCerca(e, g.position, 4, `<b>${nombre}:</b> ${s.texto}`);
      if (vid) { e.tv = cerca ? (e.tv || 0) + dt : 0; vid.poner(!cerca ? 'idle' : e.tv < 1.2 ? 'saludar' : 'hablar', dt, dist2(M.jug.pos, g.position) < 40); }
      if (cerca && s.regalo && !e.dio) { e.dio = true; FABRICA.pan(M, L, { x: s.x + 1, z: s.z + 1, y: g.position.y, sala: s.sala }); }
    };
  },
  diego(M, L, s) {
    const g = mallaPersona(COL.diego, escalaPersona('diego'), 'p_diego');
    const chaq = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.12), mat(0xd27a3a, { emisivo: 0x6a2a08, brillo: 0.4 })); chaq.position.set(0, 1.1, 0.42);
    if (!g.userData.splat) g.add(chaq);   // el modelo de Idol ya trae la chaqueta en las manos (N1-A2: la caja oculta, a 0,7 m, hacía que el auditor lo diera por flotando)
    g.position.set(s.x, ySuelo(M, s), s.z);
    const e = L.agregar(base(s, 'diego', { malla: g, estado: 'espera' }));
    const vid = vida(g, 'diego');
    chaquetaDiego(g, false); restoDiego(g, null, false);   // N1-C42: si otro Diego ya la había entregado, vuelve a tenerla
    // N1-C70: espera con los brazos abajo y sin la chaqueta en las manos; al hablar con Nato la levanta (0,6 s) y la entrega;
    // después baja los brazos otra vez
    let bajar = 1; e.vid = vid;
    if (vid.malla) {   // G-PERS: Diego MALLA espera con los brazos abajo y sin chaqueta; al hablar «entregar» (brazos al frente) y aparece la chaqueta (TRELLIS) en sus manos
      chaq.visible = false; g.add(chaq);
      if (PERSONAJES_MALLA.chaqueta) import('three/addons/loaders/GLTFLoader.js').then(m => new m.GLTFLoader().loadAsync(PERSONAJES_MALLA.chaqueta)).then(gl => {
        const c = gl.scene, b = new THREE.Box3().setFromObject(c), t = b.getSize(new THREE.Vector3()), k = 0.62 / Math.max(t.x, t.z);
        c.scale.setScalar(k); c.position.set(-(b.min.x + b.max.x) / 2 * k, -(b.min.y + b.max.y) / 2 * k, -(b.min.z + b.max.z) / 2 * k);
        c.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material) { o.material.emissiveMap = o.material.map; o.material.emissive = new THREE.Color(0.2, 0.2, 0.2); o.material.metalness = 0; } } });
        chaq.material.visible = false; chaq.add(c);
      }).catch(err => console.warn('chaqueta', err));
    }
    if (g.userData.splat) e.sinChaq = chaquetaDiego(g, true);
    e.act = dt => {
      if (vid.a && !vid.a.ajuste) vid.a.ajuste = brazosAbajo(() => bajar);
      if (g.userData.splat && e.estado === 'espera' && !e.sinChaq) e.sinChaq = chaquetaDiego(g, true);   // el splat puede cargar después
      const meta = e.estado === 'habla' ? 0 : 1; bajar += Math.sign(meta - bajar) * Math.min(Math.abs(meta - bajar), dt / (meta ? 0.8 : 0.6));
      if (g.userData.splat && e.estado === 'habla' && e.sinChaq && bajar < 0.7) { chaquetaDiego(g, false); e.sinChaq = 0; if (e.resto) { restoDiego(g, vid.a, false); e.resto = 0; } }
      if (g.userData.splat && e.estado !== 'habla' && e.sinChaq && !e.resto && vid.a) e.resto = restoDiego(g, vid.a, true);   // sin chaqueta en las manos: tampoco su forro
      if (vid.malla && e.estado !== 'dio') chaq.visible = e.estado === 'habla' && e.t > 0.45;
      vid.poner(e.estado === 'habla' ? (vid.malla ? 'entregar' : e.t < 1.2 ? 'saludar' : 'hablar') : 'idle', dt, dist2(M.jug.pos, g.position) < 40);
      g.lookAt(M.jug.pos.x, g.position.y, M.jug.pos.z);
      if (e.estado === 'espera' && M.cerca(g.position, 3.2)) { e.estado = 'habla'; e.t = 0; M.jug.gesto('saludar', 1.6); UI.burbuja('<b>Diego:</b> ¡Nato! Toma mi chaqueta regalona, de cuando era flaco. ¡Con ella nada te para!'); }
      else if (e.estado === 'habla') {
        e.t += dt;
        if (e.t > Math.min(5, lectura('Toma mi chaqueta regalona, de cuando era flaco.'))) {
          e.estado = 'dio'; chaq.visible = false; if (g.userData.splat) { g.children[0].visible = true; e.sinChaq = chaquetaDiego(g, true); } UI.burbuja(null);
          M.jug.chaqueta = DURA_CHAQUETA; M.efecto('energiaLlena'); M.voz('dandole'); M.rotulo('¡CHAQUETA REGALONA!'); M.jug.gesto('saludar', 1.4);   // A-CELEB: sin festejo grande al recibir la chaqueta
        }
      }
    };
  },
  minero(M, L, s) { return minero(M, L, s); },
  dinamitero(M, L, s) { return minero(M, L, { ...s, lanzador: true }); },
  bolero(M, L, s) { return minero(M, L, { ...s, bolero: true }); },
  // 16-11 (Diego): jugador de bolos del palitroque = ciudadano de la época (malla animada de la ciudad viva), no un minero enemigo;
  // juega con boleroJuega.js (camina al soporte, toma la bola, la lanza) y animarBolero() mueve su brazo hacia la bola
  jugadorBolos(M, L, s) {
    const g = new THREE.Group(), y0 = ySuelo(M, s); g.position.set(s.x, y0, s.z);
    const e = L.agregar(base(s, 'jugadorBolos', { malla: g, estado: 'patrulla', casa: v3(s.x, y0, s.z), radio: 0.35, alto: 1.7 }));
    e.pos = g.position;
    const tipo = /67$/.test(s.sala || '') ? 'joven' : /45$/.test(s.sala || '') ? 'obrero2' : 'obrero20';
    cargarTipo(tipo).then(T => { const P = crearPersona(T, { variar: { semilla: 'bolero-' + tipo } }); P.lod(0, true); g.add(P.g); e.persona = P; }).catch(err => console.warn('jugadorBolos', err));
    e.act = dt => { juegaBolos(M, e, s, g, dt); if (e.persona && M.mismaSala(e)) animarBolero(e, dt); };
    return e;
  },
  condor(M, L, s) { return condor(M, L, s); },
  olla(M, L, s) {
    const g = new THREE.Group(), y0 = ySuelo(M, s), H = s.carro ? PORTAOLLAS_H : 0;   // N0-OLLAS: s.carro = la olla va montada en un carro portaolla (H de alto) sobre un tramo de vía
    const olla = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.3, 14), texMat('olla'));   // TEX: fierro fundido tiznado con escoria (antes mat liso)
    olla.position.y = (s.hoyo ? 0.2 : 1.2) + H; g.add(olla);
    const cobre = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 14), mat(0xff7a20, { emisivo: 0xff5a00, brillo: 3 })); cobre.position.y = olla.position.y + 0.62; g.add(cobre);
    if (!s.hoyo && !s.carro) {   // la olla cuelga de un pórtico de vigas (antes de un palo que terminaba en el aire)
      const gancho = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 4), mat(0x333333)); gancho.position.y = 3.5; g.add(gancho);
      for (const dx of [-1.7, 1.7]) { const p = piezaTex(new THREE.BoxGeometry(0.25, 5.4, 0.25), texMat('durmiente', 0xb89c80)); p.position.set(dx, 2.7, 0); g.add(p); }   // TEX: vigas de madera gastada
      const viga = piezaTex(new THREE.BoxGeometry(3.9, 0.3, 0.3), texMat('durmiente', 0xb89c80)); viga.position.y = 5.2; g.add(viga);
    }
    // olla en hoyo (planta de 1971): olla de cobre de Idol de 3 m × 1,65 m con el cobre fundido adentro, borde a la misma
    // altura que la antigua (y0 + 0,85) y un resplandor naranja (antes un cilindro gris con tapa naranja)
    const sp = s.hoyo && M.splatsTodos && M.splatsTodos.olla_cobre, spF = !s.hoyo && M.splatsTodos && M.splatsTodos.olla_fundicion;
    let luz = null;
    if (spF) {   // olla de fundición de Idol con su bastidor de fierro (reemplaza el balde negro y el pórtico de palos)
      g.children.forEach(o => { o.visible = false; });
      const v = vehiculoSplat(spF, 3.3, (s.x * 0.37 + s.z * 0.11) % (Math.PI * 2), 3.1, 2.9); v.position.y += H; g.add(v);
      luz = new THREE.PointLight(0xff7a2a, 26, 9, 1.8); luz.position.y = 2.2 + H; g.add(luz);
    }
    if (sp) {
      olla.visible = cobre.visible = false;
      const v = vehiculoSplat(sp, 3, (s.x * 0.37 + s.z * 0.11) % (Math.PI * 2), 3, 1.65); v.position.y = olla.position.y + 0.65 - 1.65; g.add(v);
      luz = new THREE.PointLight(0xff7a2a, 30, 9, 1.8); luz.position.y = olla.position.y + 0.65 - 1.65 * 0.49 + 0.6; g.add(luz);
    }
    if (s.carro) {   // carro portaolla: bastidor, 4 ruedas y muñones sobre el tramo de vía (eje largo = vía, giro en grados)
      const car = portaollas(); car.rotation.y = (s.giro || 0) * Math.PI / 180; g.add(car);
      M.fis.caja(s.x, y0 + H / 2, s.z, 3.9, H, 2.4, car.rotation.y, { tipo: 'cajon' });
    }
    g.position.set(s.x, y0, s.z);
    const e = L.agregar(base(s, 'olla', { malla: g }));
    const top = y0 + H + (spF ? 1.7 : (olla.position.y - H) + 0.65);
    M.fis.caja(s.x, y0 + H + (spF ? 0.85 : olla.position.y - H), s.z, sp ? 2.6 : spF ? 2.4 : 1.8, spF ? 1.7 : 1.3, sp ? 2.6 : spF ? 2.4 : 1.8, 0, { tipo: 'olla' });   // con el modelo: la caja cubre hasta el borde de 3 m
    e.act = () => {
      cobre.material.emissiveIntensity = 2.5 + Math.sin(M.t * 5) * 0.6;
      if (luz) luz.intensity = 26 + Math.sin(M.t * 5) * 6 + Math.sin(M.t * 13) * 2;
      const j = M.jug;
      if (dist2(j.pos, g.position) < (sp ? 1.15 : spF ? 1.2 : 1.5) && j.pie < top + 0.4 && j.pie > top - 1.5) {   // con el modelo: solo el disco de cobre (0,75 del radio)
        if (danar(j, 'olla')) { M.efecto('herido'); M.voz('ay'); M.rotulo('¡AY, AY, AY!'); }
        j.vel.set(j.pos.x - s.x, 0, j.pos.z - s.z).setLength(7); j.vel.y = 11; j.rebote = true;
      }
    };
  },
  vagonetas(M, L, s) {
    const de = v3(s.de[0] + (s.ySala ? 0 : 0), 0, s.de[1]), a = v3(s.a[0], 0, s.a[1]);
    const y = s.y;
    const e = L.agregar(base(s, 'lanzaVagonetas', { cada: s.cada || 5, prox: 1 }));
    e.act = dt => {
      if (M.paseoVia && M.paseoVia === s.sala) { e.prox = 1.5; return; }   // N1-FORTUNA-PASEO: mientras va el paseo en vagoneta no sale ninguna
      e.prox -= dt; if (e.prox > 0) return; e.prox = e.cada / DIF().persigue;
      if (dist2(M.jug.pos, de) > 70 && dist2(M.jug.pos, a) > 70) return;
      // vagoneta de Idol (2,4 × 1,0 × 1,1 m, largo a lo largo de los rieles); sin el modelo, la caja de antes
      const spV = M.splatsTodos && M.splatsTodos.vagoneta;
      const m = spV ? new THREE.Group() : new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 2), mat(0x5a4a3a, { metal: 0.5 })); m.castShadow = true;
      if (spV) { const vs = vehiculoSplat(spV, 2.4, Math.PI / 2, 1.1, 1.0); vs.position.y = -0.55; m.add(vs); }   // el grupo va a y + 0,6 como la caja: las ruedas quedan sobre los rieles
      const dir = a.clone().sub(de).normalize(), largo = a.distanceTo(de);
      const v = L.agregar({ tipo: 'vagoneta', vivo: true, sala: s.sala, malla: m, d: 0 });
      m.position.set(de.x, y + 0.6, de.z); m.rotation.y = Math.atan2(dir.x, dir.z);
      { const j = M.jug.pos, dx = a.x - de.x, dz = a.z - de.z, L2 = dx * dx + dz * dz, k = L2 ? Math.max(0, Math.min(1, ((j.x - de.x) * dx + (j.z - de.z) * dz) / L2)) : 0;   // N0-FABLE-1611 (M3): avisar solo si Nato está cerca de la vía y a su altura (no en Fortuna 4, 8 m más arriba, ni en el andarivel)
        if ((s.sala || null) === (M.salaActual || null) && Math.abs(M.jug.pie - y) < 3 && Math.hypot(j.x - de.x - dx * k, j.z - de.z - dz * k) < 25) M.aviso('¡Vagoneta!'); }
      v.act = dt2 => {
        v.d += dt2 * 5.5 * DIF().persigue; if (v.d > largo) { L.quitar(v); return; }
        m.position.set(de.x + dir.x * v.d, y + 0.6, de.z + dir.z * v.d);
        const j = M.jug, g = j.golpeActivo();
        if (g && Math.hypot(g.x - m.position.x, g.z - m.position.z) < g.r + 0.9) { M.rotulo('¡Volcada!'); P.puntos += 100; sumarEnergia(8); L.quitar(v); return; }
        if (Math.hypot(j.pos.x - m.position.x, j.pos.z - m.position.z) < 1.3 && Math.abs(j.pie - y) < 1) { if (danar(j, 'vagoneta')) j.golpeado(m.position, 7); }
      };
    };
  },
  bolas(M, L, s) {
    const esc = M.R.escaleras[s.escalera]; if (!esc) return;
    const e = L.agregar(base(s, 'lanzaBolas', { prox: 2 }));
    e.act = dt => {
      e.prox -= dt; if (e.prox > 0) return; e.prox = (s.cada || 5) * 2.1 / DIF().bola;
      if (M.jug.pos.z > esc.a.z + 10 || M.jug.pos.z < esc.b.z - 10) return;   // solo si Nato anda por ese tramo
      lanzarBola(M, L, esc.b.clone(), esc.a.clone(), (Math.random() - 0.5) * (esc.ancho - 1.2));
    };
  },
  viento(M, L, s) { M.zonasViento.push({ x0: s.x - s.sx / 2, x1: s.x + s.sx / 2, z0: s.z - s.sz / 2, z1: s.z + s.sz / 2, f: s.fuerza, dir: s.dir }); vientoVisible(M, L, s); },
  hielo(M, L, s) {
    M.zonasHielo.push({ x0: s.x - s.sx / 2, x1: s.x + s.sx / 2, z0: s.z - s.sz / 2, z1: s.z + s.sz / 2 });
    hieloVisible(M, L, s);
  },
  meta(M, L, s) {
    const e = L.agregar(base(s, 'meta', { r: s.r || 4, fin: s.tipo }));
    e.act = () => { if (!M.final && dist2(M.jug.pos, s) < e.r && Math.abs(M.jug.pie - (s.y ?? M.jug.pie)) < 6) M.empezarFinal(s.tipo); };
  },
  cajas() {}, palos() {},
  jefe(M, L, s) { return jefe(M, L, s); },
  condorJefe(M, L, s) { return condorJefe(M, L, s); },
  nido(M, L, s) {
    const g = new THREE.Group(), pedro = mallaPersona(COL.pedro, escalaPersona('pedro'), 'p_pedro');
    if (M.splatNido) {
      // nido de Idol (nido_condor): losa de roca con nido de ramas encima, 7,9 m de diámetro y 4 m de alto.
      // Alturas (fracción del alto): losa pisable 0,40 (1,6 m: se sube de un salto), piso del hueco 0,58, borde de ramas 0,99
      // 3,2 m de alto (6,3 m de diámetro): con 4 m los huevos medían más que Pedro y el borde quedaba a 3,96 m (no se entraba)
      const A = 3.2, Rn = A / 0.497 * 0.98 / 2, y0 = ySuelo(M, s), bordeF = 0.85;   // borde de ramas en la física a 0,85 del alto (2,7 m): se entra con salto + doble salto
      // (antes se agrandaba 1,12: medía 1,86 m, más que Nato; ahora su altura sale de js/datos/alturas.js)
      g.add(vehiculoSplat(M.splatNido, A / 0.497 * 0.944, 0, A / 0.497 * 0.98, A));
      pedro.position.y = 0.58 * A; g.add(pedro);
      g.position.set(s.x, y0, s.z);
      const disco = (r, h) => { const p = []; for (const y of [0, h]) for (let i = 0; i < 16; i++) p.push(s.x + Math.cos(i * Math.PI / 8) * r, y0 + y, s.z + Math.sin(i * Math.PI / 8) * r); return new Float32Array(p); };
      M.fis.convexo(disco(Rn, 0.4 * A), { tipo: 'nido' });          // losa de roca
      M.fis.convexo(disco(0.62 * Rn, 0.58 * A), { tipo: 'nido' });   // piso del hueco
      for (let i = 0; i < 12; i++) {   // muro de ramas entre 0,6 y 0,81 del radio, hasta bordeF del alto
        const a = i * Math.PI / 6, rm = 0.705 * Rn, hm = (bordeF - 0.4) * A;
        M.fis.caja(s.x + Math.cos(a) * rm, y0 + 0.4 * A + hm / 2, s.z + Math.sin(a) * rm, 0.21 * Rn, hm, 2 * rm * Math.tan(Math.PI / 12) + 0.15, -a, { tipo: 'nido' });
      }
    } else {
      const n = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.7, 8, 16), mat(0x6b4a2a, { rough: 1 })); n.rotation.x = Math.PI / 2; g.add(n);
      pedro.position.y = 0.2; g.add(pedro);
      g.position.set(s.x, ySuelo(M, s) + 0.4, s.z);
    }
    const eN = L.agregar(base(s, 'nido', { malla: g, pedro })), vidP = vida(pedro, 'pedro');
    eN.act = dt => { const d = dist2(M.jug.pos, g.position); vidP.poner(d < 5 ? 'hablar' : d < 9 ? 'saludar' : 'idle', dt, d < 40); };
  },
  tren(M, L, s) { return tren(M, L, s); },
  alud(M, L, s) { return alud(M, L, s); },
};

// ------------------------------------------------------------------ bolas del palitroque (bajan rodando la escalera)
function lanzarBola(M, L, desde, hasta, lado) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(0x1c2433, { rough: 0.25, metal: 0.2 })); m.castShadow = true;
  const d = hasta.clone().sub(desde), largo = d.length(); d.normalize();
  const perp = v3(Math.cos(Math.atan2(d.x, d.z)), 0, -Math.sin(Math.atan2(d.x, d.z)));
  const b = L.agregar({ tipo: 'bola', vivo: true, malla: m, s: 0, v: 2, sala: M.salaActual });
  b.act = dt => {
    b.v = Math.min(b.v + dt * 4 * DIF().bola / 2.1, 9 * DIF().bola / 2.1); b.s += b.v * dt;
    if (b.s > largo) { L.quitar(b); return; }
    m.position.copy(desde).addScaledVector(d, b.s).addScaledVector(perp, lado); m.position.y += 0.6; m.rotation.x += b.v * dt * 2;
    /* N0-C1: la bola aparecía y desaparecía de golpe a la vista de Nato (una esfera oscura con el reflejo naranja de la fogata): entra y sale creciendo/achicándose en 1,5 m */
    m.scale.setScalar(Math.max(0.05, Math.min(1, b.s / 1.5, (largo - b.s) / 1.5)));
    const j = M.jug, g = j.golpeActivo();
    if (j.chaqueta > 0 && m.position.distanceTo(j.pos) < 1.3) { M.rotulo('¡PAF!'); L.quitar(b); return; }
    if (g && Math.hypot(g.x - m.position.x, g.z - m.position.z) < g.r + 0.4) { M.rotulo('¡CHUZA!'); P.puntos += 50; L.quitar(b); return; }
    if (m.position.distanceTo(new THREE.Vector3(j.pos.x, j.pos.y - 0.4, j.pos.z)) < 1.0) { if (danar(j, 'bola')) j.golpeado(m.position, 6); }
  };
  return b;
}

// ------------------------------------------------------------------ mineros: patrulla, persigue, puñetazo anunciado, combo y pisotón
function minero(M, L, s, op = {}) {
  const esc = op.escala || escalaPersona(s.bolero ? 'bolero' : s.lanzador ? 'dinamitero' : 'minero');   // 1,82-1,84 m (js/datos/alturas.js)
  const g = mallaPersona(op.colores || COL.minero, esc, op.tipo === 'jefe' ? 'p_jefe' : 'p_minero');
  const y0 = ySuelo(M, s);
  g.position.set(s.x, y0, s.z);
  const hpBase = op.hp ?? DIF().hpMinero * (M.def.hpMinero ? 2 : 1);
  const e = L.agregar(base(s, op.tipo || 'minero', { malla: g, hp: hpBase, estado: s.dormido ? 'dormido' : 'patrulla', casa: v3(s.x, y0, s.z), rumbo: Math.random() * 6, prox: 1, radio: 0.5 * esc, alto: 1.9 * esc }));
  e.pos = g.position;
  const bajar = () => { const h = M.fis.rayo({ x: g.position.x, y: g.position.y + 1.5, z: g.position.z }, { x: 0, y: -1, z: 0 }, 6); return h ? h.punto.y : null; };
  e.recibir = (n, desde, tipo) => {
    if (['ko', 'sevan'].includes(e.estado)) return false;
    e.hp -= n; e.destello = 0.15; sumarEnergia(n * 6);
    if (e.hp <= 0) {
      e.estado = 'ko'; e.t = 0; noqueo('minero', 150); M.estrellitas(g.position); M.efecto('golpeFuerte');
      const dx = g.position.x - desde.x, dz = g.position.z - desde.z, l = Math.hypot(dx, dz) || 1; e.vko = v3(dx / l * 4, 5, dz / l * 4);
      if (Math.random() < 0.35) M.voz('dandole');
    } else {   // G-A5: reacción visible a cada golpe: retroceso (más largo con los golpes fuertes) y tambaleo; la animación «herido» se reinicia
      // G-A10: dentro del combo (jab, recto, gancho) el retroceso es corto (~0,35 m) para que conecten los 4 golpes; el largo (~1,6 m)
      // queda solo para el remate (golpe2, giratoria, patada: n >= 2). Nato lo sigue con el avance hasta el contacto (jugador.js G-A6)
      const fuerteR = n >= 2, dx = g.position.x - desde.x, dz = g.position.z - desde.z, l = Math.hypot(dx, dz) || 1;
      e.estado = 'herido'; e.t = 0; e.otraVez = true; e.duraH = fuerteR ? 0.6 : 0.42; e.empuje = v3(dx / l * (fuerteR ? 4.5 : 1.4), 0, dz / l * (fuerteR ? 4.5 : 1.4));
      e.tamb = fuerteR ? 0.32 : tipo === 'gancho' ? 0.24 : 0.18;
    }
    return true;
  };
  e.act = dt => {
    e.t += dt; e.prox -= dt;
    const j = M.jug, d = dist2(j.pos, g.position), dy = Math.abs(j.pie - g.position.y);
    if (e.destello > 0) e.destello -= dt;
    if (!g.userData.splat) g.userData.cuerpo.material = e.destello > 0 ? mat(0xffffff, { emisivo: 0xffffff }) : mat((op.colores || COL.minero).cuerpo);
    else g.scale.setScalar(e.destello > 0 ? 1.06 : 1);
    // chaqueta regalona: lo que toca sale volando
    if (j.chaqueta > 0 && d < 1.4 + e.radio && dy < 2 && !['ko', 'sevan'].includes(e.estado)) { e.recibir(99, j.pos); M.rotulo('¡PAF!'); return; }
    // golpes de Nato
    const gp = j.golpeActivo();
    if (gp && !gp.a.golpeados.has(e) && Math.hypot(gp.x - g.position.x, gp.z - g.position.z) < gp.r + e.radio && Math.abs(gp.y - (g.position.y + 1)) < 1.6 * esc) {
      gp.a.golpeados.add(e);
      const fuerte = gp.tipo !== 'golpe';
      if (op.jefe) op.jefe.golpe(e, gp.tipo, j.pos); else e.recibir(gp.tipo === 'patada' || gp.a.anim === 'golpe2' || gp.a.anim === 'giratoria' ? 2 : 1, j.pos, gp.tipo);   // G-A5: remates (patada) quitan 2
      // impacto: pausa más larga y sacudida según el golpe, y chispas en el punto donde pega
      M.efecto(fuerte ? 'golpeFuerte' : 'golpeSuave'); M.parada(gp.tipo === 'giratoria' ? 0.16 : gp.tipo === 'gancho' ? 0.12 : gp.tipo === 'patada' ? 0.1 : 0.065); M.sacudir(gp.tipo === 'giratoria' ? 0.26 : fuerte ? 0.16 : 0.07);   // G-A4: la patada con vuelta pega más
      if (M.estrellitas) M.estrellitas(new THREE.Vector3(gp.x, gp.y, gp.z));
    }
    // pisotón: cae sobre el casco
    if (j.vy < -1 && d < 0.75 + e.radio && j.pie > g.position.y + e.alto - 0.5 && j.pie < g.position.y + e.alto + 0.6 && !['ko', 'sevan'].includes(e.estado)) {
      j.vel.y = 8; j.rebote = true; M.efecto('golpeSuave');
      if (op.jefe) op.jefe.golpe(e, 'pisoton', j.pos); else { e.estado = 'aturdido'; e.t = 0; M.estrellitas(g.position); sumarEnergia(8); P.puntos += 50; }
    }
    if (op.jefe && op.jefe.act(e, dt, d)) return;
    if (s.juega && (e.estado === 'patrulla' || e.estado === 'persigue')) { juegaBolos(M, e, s, g, dt); return; }   // N2-C34: bolero del palitroque (no persigue ni lanza contra Nato)
    switch (e.estado) {
      case 'dormido':   // acostado en su litera (pedido de Diego); al despertar se baja y se para en el suelo
        if (!e.acostado) {
          e.acostado = true; g.rotation.set(-Math.PI / 2, Math.PI / 2, 0, 'YXZ');   // de espaldas, mirando al techo, a lo largo de la litera (de lado se veía raro)
          if (s.litera) g.position.set(s.x + (s.litera.dx || 0), e.casa.y + s.litera.y + 0.3, s.z); else g.position.y += 0.35;
        }
        if (d < 2.2) { e.estado = 'persigue'; g.rotation.set(0, 0, 0, 'XYZ'); g.position.set(s.x + (s.litera ? 1.4 : 0), e.casa.y, s.z); e.acostado = false; M.aviso('¡Shhh! Se despertó un minero'); }
        break;
      case 'patrulla': {
        if (e.prox < 0) { e.rumbo += (Math.random() - 0.5) * 2; e.prox = 2 + Math.random() * 2; }
        if (!op.quieto && !s.lanzador && !s.bolero) andar(e, g, Math.sin(e.rumbo), Math.cos(e.rumbo), 1.2, dt, bajar, M, e.casa, 5);
        if (d < 13 && dy < 3 && M.mismaSala(e)) e.estado = 'persigue';
        lanzador(M, L, e, s, d, dt);
        break;
      }
      case 'persigue': {
        if (d > 18 || dy > 4) { e.estado = 'patrulla'; break; }
        lanzador(M, L, e, s, d, dt);
        if (s.lanzador || s.bolero) break;
        const dx = j.pos.x - g.position.x, dz = j.pos.z - g.position.z, l = Math.hypot(dx, dz) || 1;
        if (d > 1.35 + e.radio) andar(e, g, dx / l, dz / l, 2.8 * DIF().persigue, dt, bajar, M, null, 0);
        else { e.estado = 'carga'; e.t = 0; M.alerta(g.position, e.alto, e); }
        g.rotation.y = Math.atan2(dx, dz);
        break;
      }
      case 'carga': if (e.t > DIF().carga / 60) { e.estado = 'golpe'; e.t = 0; g.userData.brazo.rotation.x = -1.5; } break;
      case 'golpe':
        if (e.t < 0.15 && d < 1.7 + e.radio && dy < 1.5) { if (danar(j, 'minero')) golpeSeguro(M, j, g.position, 6); }
        if (e.t > 0.5) { e.estado = 'persigue'; g.userData.brazo.rotation.x = 0; }
        break;
      case 'herido': {   // G-A5: retrocede frenando y se tambalea (balanceo lateral que se apaga)
        const k = Math.max(0, 1 - e.t / (e.duraH || 0.4));
        { const ox = g.position.x, oy = g.position.y, oz = g.position.z;   // N1-C62: pegado al suelo; en un borde o escalón alto el retroceso se frena (quedaba en el aire o enterrado en la ladera)
          g.position.addScaledVector(e.empuje, dt * k * 1.2);
          const hs = bajar(); if (hs === null || Math.abs(hs - oy) > 0.9) { g.position.set(ox, oy, oz); e.empuje.set(0, 0, 0); } else g.position.y = hs; }
        g.rotation.z = Math.sin(e.t * 22) * (e.tamb || 0.15) * k;
        if (e.t > (e.duraH || 0.4)) { e.estado = 'persigue'; g.rotation.z = 0; }
        break;
      }
      case 'aturdido': g.rotation.y += dt * 6; if (e.t > 2) e.estado = 'persigue'; break;
      case 'ko':
        e.vko.y -= 25 * dt; g.position.addScaledVector(e.vko, dt); if (!e.anim) g.rotation.z += dt * 6;
        { const hs = bajar(); if (hs !== null && g.position.y < hs) { g.position.y = hs; e.vko.y = 0; e.vko.x *= 0.85; e.vko.z *= 0.85; } }   // antes seguía cayendo bajo el suelo   // con esqueleto cae de espaldas con la acción «ko»
        if (e.t > 1.4) { e.estado = 'sevan'; L.quitar(e); }
        break;
    }
  };
  // esqueleto de Blender (blender/animar.py → assets3d/anim/minero.glb): la acción sale del estado y de la velocidad real
  const spM = op.tipo !== 'jefe' && g.userData.splat === true ? (() => { let r = null; g.traverse(o => { if (o.userData && o.userData.splat && o.userData.splat !== true) r = o.userData.splat; }); return r; })() : null;
  if (spM) {
    if (PERSONAJES_MALLA.minero) {   spM.userData.reservaMalla = true;   // R-2: la nube diferida no se carga ni se dibuja si la malla lo reemplaza
      // G-A13: minero MALLA (TRELLIS.2 + su esqueleto y acciones, blender/jefe_malla.py -- minero); un solo GLB para todos (compartir)
      import('../motor/animMalla.js').then(m => m.cargarMalla(PERSONAJES_MALLA.minero, { compartir: true })).then(r => {
        const gm = new THREE.Group(); gm.position.copy(spM.position); gm.rotation.x = Math.PI; gm.add(r.escena); spM.parent.add(gm); spM.visible = false; e.anim = r.anim; e.escM = r.escena;
      }).catch(err => { console.warn('minero malla', err); spM.userData.reservaMalla = false; animarSplat(spM, 'minero').then(a => { e.anim = a; }); });
    } else animarSplat(spM, 'minero').then(a => { e.anim = a; });
    const actBase = e.act; let px = g.position.x, pz = g.position.z, vS = 0, prev = '', tReloj = 0;
    e.act = dt => {
      actBase(dt);
      const a = e.anim; if (!a || !e.vivo) return;
      const v = Math.hypot(g.position.x - px, g.position.z - pz) / Math.max(dt, 1e-3); px = g.position.x; pz = g.position.z;
      vS += (Math.min(v, 8) - vS) * Math.min(1, dt * 8);
      let n = 'idle', vel = 1, reiniciar = false, fundido = 0.25;
      if (e.estado === 'ko' || e.estado === 'sevan') { n = 'ko'; fundido = 0.08; }
      else if (e.estado === 'herido') { n = 'herido'; fundido = 0.06; }
      else if (e.estado === 'golpe') { n = 'golpe'; fundido = 0.06; }
      else if (e.animForzada) { n = e.animForzada; fundido = 0.1; }
      else if (e.estado === 'dormido' || e.estado === 'carga' || e.estado === 'aturdido') n = 'idle';
      else if (vS > 2.0) { n = 'correr'; vel = Math.min(2, vS / 3.6); fundido = 0.25; }
      else if (vS > 0.35) { n = 'caminar'; vel = Math.min(2.2, Math.max(0.5, vS / 1.35)); fundido = 0.25; }
      if (n !== prev) { reiniciar = n === 'golpe' || n === 'herido' || n === 'ko'; prev = n; }
      if (e.otraVez) { e.otraVez = false; if (n === 'herido') reiniciar = true; }   // G-A5: cada golpe del combo vuelve a sacudirlo
      a.tocar(n, { vel, reiniciar, fundido });
      if (!e.posado || (M.jug && dist2(M.jug.pos, g.position) < 50 && (!e.sala || e.sala === M.salaActual))) { a.actualizar(dt); e.posado = true; if (e.escM && (n === 'idle' || n === 'caminar' || n === 'correr')) cerrarBrazos(e.escM, 0.75); }   // la primera vez siempre: sin pose inicial el splat sale como una astilla
    };
  }
  // G-A8 (carril anim): el jefe con esqueleto (blender/animar.py animar_jefe → assets3d/anim/jefe.glb); la acción sale del estado de jefe()
  const spJ = op.tipo === 'jefe' && g.userData.splat === true ? splatDe(g) : null;
  if (spJ) {
    if (PERSONAJES_MALLA.jefe) {   spJ.userData.reservaMalla = true;   // R-2
      // N3-V2: jefe MALLA (TRELLIS.2 + su esqueleto y acciones, blender/jefe_malla.py): brazos nítidos al levantarlos.
      // Mismo marco que la nube (el GLB va en ejes glTF = vuelta del .ply crudo: se deshace la vuelta y se usa su desplazamiento)
      import('../motor/animMalla.js').then(m => m.cargarMalla(PERSONAJES_MALLA.jefe)).then(r => {
        const gm = new THREE.Group(); gm.position.copy(spJ.position); gm.rotation.x = Math.PI; gm.add(r.escena); spJ.parent.add(gm); spJ.visible = false; e.anim = r.anim;
      }).catch(err => { console.warn('jefe malla', err); spJ.userData.reservaMalla = false; animarSplat(spJ, 'jefe').then(a => { e.anim = a; }); });
    } else animarSplat(spJ, 'jefe').then(a => { e.anim = a; });
    const actBase = e.act, ACC = { presenta: 'burla', 'puño': 'puno', escarba: 'pisoton', embiste: 'embestir', aturdido: 'aturdido' };
    let prev = '', dPrev = 0, tHer = 0;
    e.act = dt => {
      actBase(dt);
      const a = e.anim; if (!a || !e.vivo) return;
      if ((e.destello || 0) > dPrev + 0.05 && e.estado === 'elige') tHer = 0.45; dPrev = e.destello || 0; tHer -= dt;   // golpe que le dolió: echa la cabeza atrás
      const n = e.estado === 'ko' ? (e.t > 1.3 ? 'rendido' : 'rendicion') : ACC[e.estado] || (tHer > 0 ? 'herido' : 'idle');
      if (n !== prev) { a.tocar(n, { reiniciar: true, fundido: n === 'puno' || n === 'pisoton' || n === 'herido' ? 0.1 : 0.22 }); prev = n; }
      a.actualizar(dt);
    };
  }
  return e;
}
// personajes de pie con esqueleto (idle / saludar / hablar): blender/animar.py → assets3d/anim/<id>.glb
function splatDe(g) { let r = null; g.traverse(o => { if (o.userData && o.userData.splat && o.userData.splat !== true) r = o.userData.splat; }); return r; }
// N1-C42: la chaqueta regalona viene pegada al splat de Diego (en el PLY crudo: frente +x, arriba −y; tela café rojiza delante
// del torso). Al entregarla se apagan esas gaussianas; al crear otro Diego (otra vida) se devuelven (el PackedSplats es compartido)
const CHAQ_DIEGO = new WeakMap();
function chaquetaDiego(g, quitar) {
  const sm = splatDe(g), ps = sm && sm.packedSplats; if (!ps || !ps.packedArray) return false;
  let lista = CHAQ_DIEGO.get(ps);
  if (!lista) {
    if (!quitar) return false;
    lista = []; ps.forEachSplat((i, c, sc, q, o, col) => { const l = (col.r + col.g + col.b) / 3; const bajo = c.y > -0.06 && c.y < 0.25;   /* a la altura del cinturón y los muslos cuelga la chaqueta: ahí todo lo de adelante es chaqueta */
      if (c.x > 0.02 && c.y > -0.21 && c.y < 0.2 && (l < 0.42 || col.r - col.g > 0.05 && col.r < 0.75 && l < 0.6) || bajo && (c.x > 0.03 || c.x > -0.03 && l < 0.42)) lista.push([i, o]);   /* tela café y su forro; quedan camisa, pantalón y manos */ });
    CHAQ_DIEGO.set(ps, lista);
  }
  for (const [i, o] of lista) { const u = ps.getSplat(i); ps.setSplat(i, u.center, u.scales, u.quaternion, quitar ? 0 : o, u.color); }
  ps.needsUpdate = true; sm.updateVersion(); return lista.length;
}
// N1-C70: con los brazos abajo quedaba flotando delante de la barriga lo que sobra de la chaqueta (forro rosado pegado al tronco,
// no a las manos). restoDiego apaga las gaussianas de adelante (x > 0,05, entre pecho y muslos) cuyo hueso principal no es del
// brazo y que salen más de 2,5 cm de la superficie de las cápsulas del tronco o son color piel/forro (la camisa crema queda)
const RESTO_DIEGO = new WeakMap();
function restoDiego(g, a, quitar) {
  const sm = splatDe(g), ps = sm && sm.packedSplats; if (!ps || !ps.packedArray) return false;
  let lista = RESTO_DIEGO.get(ps);
  if (!lista) {
    if (!quitar || !a || !a.pesos) return false;
    const H = a.huesos, brazo = H.map(h => /^(uparm|forearm|hand)/.test(h.n)), tronco = H.map(h => /^(hips|spine|chest)$/.test(h.n));
    const A = H.map(h => new THREE.Vector3(...h.a)), B = H.map(h => new THREE.Vector3(...h.b)), d = new THREE.Vector3(), cp = new THREE.Vector3(), line = new THREE.Line3();
    lista = []; ps.forEachSplat((i, c, sc, q, o, col) => {
      if (c.x < 0.05 || c.y < -0.15 || c.y > 0.2 || Math.abs(c.z) > 0.17 || o < 0.02) return;
      if (brazo[a.pesos.idx[i * 4]] && a.pesos.w[i * 4] > 0.5) return;
      let min = 9; for (let b = 0; b < H.length; b++) if (tronco[b]) { line.set(A[b], B[b]); line.closestPointToPoint(c, true, cp); min = Math.min(min, d.subVectors(c, cp).length() - H[b].r); }
      if (min > 0.025 || col.r - col.g > 0.1 && col.r > 0.4) lista.push([i, o]);   /* o pegado a la barriga pero de color piel/forro (la camisa es crema) */
    });
    RESTO_DIEGO.set(ps, lista);
  }
  for (const [i, o] of lista) { const u = ps.getSplat(i); ps.setSplat(i, u.center, u.scales, u.quaternion, quitar ? 0 : o, u.color); }
  ps.needsUpdate = true; sm.updateVersion(); return lista.length;
}
// N1-C70: el modelo de Diego viene posado con los brazos al frente sosteniendo la chaqueta. brazosAbajo(fac) es un ajuste para
// animSplat: lleva brazo y antebrazo hacia «abajo» (de la cabeza a los pies), un poco abiertos del pecho; fac() 0..1 = cuánto
const _ba = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], _bq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const _bm = new THREE.Matrix4();
function brazosAbajo(fac) {
  return nodo => {
    const k = fac(); if (k <= 0.001 || !nodo.head || !nodo.footL || !nodo.footR || !nodo.chest) return;
    const [a, b, abajo, pecho, lado] = _ba, [q, qd] = _bq;
    nodo.head.getWorldPosition(a); nodo.footL.getWorldPosition(b); nodo.footR.getWorldPosition(abajo);
    abajo.add(b).multiplyScalar(0.5).sub(a).normalize(); nodo.chest.getWorldPosition(pecho);
    for (const L of ['L', 'R']) for (const [h, hijo, abre] of [['uparm' + L, 'forearm' + L, 0.2], ['forearm' + L, 'hand' + L, 0.1]]) {
      const o = nodo[h], c = nodo[hijo]; if (!o || !c) continue;
      o.getWorldPosition(a); c.getWorldPosition(b); b.sub(a).normalize();
      lado.subVectors(a, pecho); lado.addScaledVector(abajo, -lado.dot(abajo)).normalize();
      lado.multiplyScalar(abre).add(abajo).normalize();
      // giro en el marco del padre (su matriz de mundo puede traer espejo: el .ply de Idol va con Y hacia abajo)
      _bm.copy(o.parent.matrixWorld).invert(); b.transformDirection(_bm); lado.transformDirection(_bm);
      q.setFromUnitVectors(b, lado); qd.identity().slerp(q, k);
      o.quaternion.premultiply(qd); o.updateMatrixWorld(true);
    }
  };
}
// 16-11 (Diego: «los brazos de los enemigos siguen más abiertos de lo normal»): tras la animación del minero (idle, caminar, correr) se
// cierra la parte LATERAL del brazo hacia el cuerpo (k = cuánto de lo que sobra de 0,12); el vaivén adelante/atrás queda igual
const _cb = { h: new WeakMap(), S: new THREE.Vector3(), E: new THREE.Vector3(), P: new THREE.Vector3(), b: new THREE.Vector3(), t: new THREE.Vector3(), o: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };
function cerrarBrazos(escena, k) {
  let H = _cb.h.get(escena);
  if (H === undefined) { const n = {}; escena.traverse(o => { if (o.isBone) n[o.name] = o; }); H = n.chest || n.spine ? n : null; _cb.h.set(escena, H); }
  if (!H) return;
  const { S, E, P, b, t, o, q, m } = _cb, pecho = H.chest || H.spine;
  escena.updateMatrixWorld(true); pecho.getWorldPosition(P);
  for (const L of ['L', 'R']) {
    const up = H['uparm' + L], fo = H['forearm' + L]; if (!up || !fo) continue;
    up.getWorldPosition(S); fo.getWorldPosition(E); b.subVectors(E, S).normalize();
    o.subVectors(S, P); o.y = 0; if (o.lengthSq() < 1e-6) continue; o.normalize();   // hacia afuera (horizontal)
    const lat = b.dot(o); if (lat <= 0.12) continue;
    t.copy(b).addScaledVector(o, -(lat - 0.12) * k).normalize();
    m.copy(up.parent.matrixWorld).invert(); b.transformDirection(m); t.transformDirection(m);   // en el marco del padre (la malla va con giro de 180°)
    q.setFromUnitVectors(b, t); up.quaternion.premultiply(q); up.updateMatrixWorld(true);
  }
}
function vida(g, id) {
  const v = { a: null, n: '', posado: false }, sp = splatDe(g);
  if (sp && sp.userData.mallaPromesa) { sp.userData.manejada = true; v.malla = true; sp.userData.mallaPromesa.then(r => { v.a = r.anim; }).catch(err => console.warn('malla', id, err)); }   // G-PERS: malla animada
  else if (sp) animarSplat(sp, id).then(a => { v.a = a; });
  v.poner = (n, dt, cerca) => {
    if (!v.a) return;
    if (n !== v.n) { v.a.tocar(n, { fundido: 0.25, reiniciar: true }); v.n = n; } else v.a.tocar(n);
    if (cerca || !v.posado) { v.a.actualizar(dt); v.posado = true; }   // la primera vez siempre (sin pose inicial el splat sale como una astilla)
  };
  return v;
}
function andar(e, g, dx, dz, v, dt, bajar, M, casa, radioCasa) {
  const nx = g.position.x + dx * v * dt, nz = g.position.z + dz * v * dt;
  if (casa && Math.hypot(nx - casa.x, nz - casa.z) > radioCasa) { e.rumbo += Math.PI; return; }
  // no se tira a las grietas ni camina por el aire
  const h = M.fis.rayo({ x: nx + dx * 0.6, y: g.position.y + 1.5, z: nz + dz * 0.6 }, { x: 0, y: -1, z: 0 }, 4.5);
  if (!h || h.punto.y < g.position.y - 1.2 || h.punto.y > g.position.y + 0.8) { e.rumbo += Math.PI * 0.7; return; }
  // N1-C62: la altura sale del suelo bajo los pies (antes, del punto 0,6 m adelante: en las laderas flotaba subiendo y se enterraba bajando)
  const hp = M.fis.rayo({ x: nx, y: g.position.y + 1.5, z: nz }, { x: 0, y: -1, z: 0 }, 4.5);
  g.position.set(nx, hp && hp.punto.y > g.position.y - 1.2 ? hp.punto.y : h.punto.y, nz); g.rotation.y = Math.atan2(dx, dz);
  const u = g.userData; if (!e.anim) { u.brazo.rotation.x = Math.sin(M.t * 9) * 0.6; u.brazo2.rotation.x = -Math.sin(M.t * 9) * 0.6; }
}
// dinamitero: lanza dinamita que rebota y explota; se puede devolver de un golpe · bolero: tira bolas por la pista
function lanzador(M, L, e, s, d, dt) {
  if (!(s.lanzador || s.bolero)) return;
  e.cargaLanz = (e.cargaLanz ?? 1.5) - dt;
  if (e.cargaLanz > 0 || d > 26) return;
  if (s.bolero) {
    e.cargaLanz = DIF().bolero / 60;
    lanzarBola(M, L, e.pos.clone(), v3(e.pos.x, e.pos.y, e.pos.z + 44), 0);
    return;
  }
  e.cargaLanz = DIF().dinamita / 60;
  const j = M.jug, m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), mat(0xc02020, { emisivo: 0x400000 })); m.castShadow = true;
  const p = v3(e.pos.x, e.pos.y + 2, e.pos.z), T = 1.2;
  const vel = v3((j.pos.x - p.x) / T, 0, (j.pos.z - p.z) / T); vel.y = (j.pos.y - p.y + 0.5 * 25 * T * T) / T;
  m.position.copy(p);
  const k = L.agregar({ tipo: 'dinamita', vivo: true, malla: m, t: 0, sala: e.sala });
  k.act = dt2 => {
    k.t += dt2; vel.y -= 25 * dt2; m.position.addScaledVector(vel, dt2); m.rotation.z += dt2 * 8;
    const suelo = M.fis.suelo(m.position.x, m.position.z, m.position.y + 0.3);
    if (m.position.y < suelo + 0.15) { m.position.y = suelo + 0.15; vel.y = Math.abs(vel.y) * 0.35; vel.x *= 0.6; vel.z *= 0.6; }
    const g = j.golpeActivo();
    if (g && !k.devuelta && Math.hypot(g.x - m.position.x, g.z - m.position.z) < g.r + 0.4) { k.devuelta = true; vel.set((e.pos.x - m.position.x) / 1, 8, (e.pos.z - m.position.z) / 1); M.rotulo('¡De vuelta!'); }
    if (k.t > 1.8) {
      M.explosion(m.position);
      if (m.position.distanceTo(j.pos) < 2.6) { if (danar(j, 'dinamita')) { j.golpeado(m.position, 8); M.tizne(); } }
      if (k.devuelta && m.position.distanceTo(e.pos) < 3 && e.recibir) e.recibir(99, m.position);
      L.quitar(k);
    }
  };
}

// ------------------------------------------------------------------ cóndores: vuelan, avisan con sombra y chillido, bajan en picada
// cóndor en vuelo de Idol (condor_vuelo): envergadura en X, alto 0,42/0,909 de la envergadura; YAW_CONDOR endereza el pico hacia +Z del grupo
export const YAW_CONDOR = -1.1;   // medido con herramientas/explorador2_condor.js (vista de arriba: pico adelante, alas a lo ancho)
export function mallaCondor(esc = 1, spVuelo = null, gigante = false) {
  if (PERSONAJES_MALLA.condor_vuelo && PERSONAJES_MALLA.condor_posado) {   // G-CONDOR: cóndor malla con esqueleto (mallas.js condorMalla)
    const g = condorMalla(esc, gigante); g.userData.alaI = new THREE.Object3D(); g.userData.alaD = new THREE.Object3D(); return g;
  }
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.35 * esc, 0.9 * esc, 4, 10), mat(0x1d1b22)); cuerpo.rotation.x = Math.PI / 2; g.add(cuerpo);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3 * esc, 0.1 * esc, 6, 12), mat(0xf2f0ea)); collar.position.z = 0.55 * esc; g.add(collar);
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.2 * esc, 10, 8), mat(0xc0606a)); cabeza.position.set(0, 0.1, 0.8 * esc); g.add(cabeza);
  const alaI = new THREE.Mesh(new THREE.BoxGeometry(1.8 * esc, 0.06, 0.7 * esc), mat(0x1d1b22)); alaI.position.x = -1 * esc; g.add(alaI);
  const alaD = alaI.clone(); alaD.position.x = 1 * esc; g.add(alaD);
  for (const m of [cuerpo, alaI, alaD]) m.castShadow = true;
  g.userData = { alaI, alaD };
  if (spVuelo) {   // en vuelo: alas extendidas de 3 m; el aleteo se reemplaza por un balanceo y un planeo suave
    for (const h of [...g.children]) h.visible = false;
    const m = vehiculoSplat(spVuelo, 3 * esc, YAW_CONDOR); m.position.y = -0.7 * esc; g.add(m); g.userData.modelo = m; g.userData.y0 = -0.7 * esc;
  } else if (PERSONAJES.p_condor) {   // el cóndor de Idol de pie (alas abiertas): para el jefe, que se posa junto al nido; el aleteo se hace meciendo el modelo
    for (const h of [...g.children]) h.visible = false;
    const m = personajeSplat(PERSONAJES.p_condor, 1.5 * esc); m.position.y = -0.75 * esc; g.add(m); g.userData.modelo = m;
  }
  return g;
}
// ------------------------------------------------------------------ fuego de las fogatas (N1-C46)
// tapa la llama que trae el modelo de Idol (caja de 0,3 a 1,6 m sobre el suelo, solo en esa nube) y oscurece un poco las brasas
function taparLlamaSplat(g) {
  let sm = null; g.traverse(o => { if (!sm && o instanceof SplatMesh) sm = o; });
  if (!sm) return;   // ?malla=1: la malla de TRELLIS no se edita
  const sdf = new SplatEditSdf({ type: 'box', opacity: 0 }); sdf.position.set(0, 0.95, 0); sdf.scale.set(1.3, 0.65, 1.3); g.add(sdf);
  const ed = new SplatEdit({ rgbaBlendMode: 'multiply', softEdge: 0.12, sdfs: [sdf] }); sm.add(ed);
  // brasas del modelo (vienen encendidas, naranjas): apagada se oscurecen; encendida vuelven a su color (ver fuegoFogata)
  const sdfB = new SplatEditSdf({ type: 'box', opacity: 1, color: new THREE.Color(0.28, 0.2, 0.18) }); sdfB.position.set(0, 0.2, 0); sdfB.scale.set(0.75, 0.32, 0.75); g.add(sdfB);
  const edB = new SplatEdit({ rgbaBlendMode: 'multiply', softEdge: 0.25, sdfs: [sdfB] }); sm.add(edB);
  g.userData.brasas = sdfB;
}
// ?malla=1: la malla de TRELLIS de la fogata trae una llama de «cartón» pintada en su textura: se quitan los triángulos de color
// llama (naranja/amarillo brillante) que están sobre el primer cuarto de alto. Se hace una vez por geometría (los clones la comparten)
function quitarLlamaMalla(g) {
  let listo = false;
  g.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes.uv) return;
    if (o.geometry.userData.sinLlama) { listo = true; return; }
    const img = o.material?.map?.image; if (!img || !img.width) return;
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data, geo = o.geometry, uv = geo.attributes.uv, pos = geo.attributes.position;
    geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, alto = geo.boundingBox.max.y - y0;
    const idx = geo.index ? geo.index.array : Array.from({ length: pos.count }, (_, i) => i), nuevo = [];
    const flipY = o.material.map.flipY;
    for (let t = 0; t < idx.length; t += 3) {
      let u = 0, v = 0, yy = 0; for (let k = 0; k < 3; k++) { u += uv.getX(idx[t + k]); v += uv.getY(idx[t + k]); yy += pos.getY(idx[t + k]); }
      u /= 3; v /= 3; yy /= 3;
      const X = Math.min(c.width - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * c.width))), Y = Math.min(c.height - 1, Math.max(0, Math.floor((flipY ? 1 - ((v % 1 + 1) % 1) : (v % 1 + 1) % 1) * c.height)));
      const q = (Y * c.width + X) * 4, r = px[q], gg = px[q + 1], b = px[q + 2];
      const h = (yy - y0) / alto, llama = h > 0.82 || h > 0.25 && ((r > 170 && gg > 80 && r - b > 90) || (r > 160 && r - gg > 80 && b < 90) || (h > 0.4 && r > 215 && gg > 190 && b > 140));   // naranja/amarillo, puntas rojas y núcleo blanco
      if (!llama) nuevo.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    geo.setIndex(nuevo); geo.userData.sinLlama = true; listo = true;
  });
  return listo;
}
let TEX_FUEGO = null;
// humo/vapor: copo algodonoso e irregular (manchas blandas superpuestas, borde deshilachado) en vez de un disco radial.
// Tres variantes al azar para que las bocanadas no se repitan.
const TEX_HUMO = [];
function texHumo() {
  if (TEX_HUMO.length < 3) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, r = Math.random() ** 0.7 * 34, cx = 64 + Math.cos(a) * r, cy = 64 + Math.sin(a) * r, rr = 14 + Math.random() * 22 * (1 - r / 50);
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr), al = 0.22 + Math.random() * 0.22;
      gr.addColorStop(0, `rgba(255,255,255,${al})`); gr.addColorStop(0.55, `rgba(255,255,255,${al * 0.45})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    }
    // borde: se apaga hacia afuera para que ningún copo deje canto
    x.globalCompositeOperation = 'destination-in'; const m = x.createRadialGradient(64, 64, 20, 64, 64, 64);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = m; x.fillRect(0, 0, 128, 128);
    TEX_HUMO.push(new THREE.CanvasTexture(c)); return TEX_HUMO[TEX_HUMO.length - 1];
  }
  return TEX_HUMO[(Math.random() * 3) | 0];
}
function texFuego() {
  if (TEX_FUEGO) return TEX_FUEGO;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); TEX_FUEGO = new THREE.CanvasTexture(c); return TEX_FUEGO;
}
function fuegoFogata(M, g) {
  const baja = M.calidad === 'baja', tex = texFuego(), grupo = new THREE.Group(); g.add(grupo);
  const spr = (aditivo, color, op) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: op, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true })); grupo.add(m); return m; };
  const llamas = Array.from({ length: baja ? 10 : 16 }, (_, i) => ({ s: spr(i % 2 === 0, 0xffffff, 0), aditiva: i % 2 === 0, f: i / (baja ? 10 : 16), a: Math.random() * 6.28, r: 0.08 + Math.random() * 0.18, v: 0.8 + Math.random() * 0.5 }));
  const nucleo = spr(true, 0xff7a20, 0), chispas = Array.from({ length: baja ? 3 : 6 }, () => ({ s: spr(true, 0xffc060, 0), t: Math.random() * 2, vx: 0, vz: 0 }));
  const humo = Array.from({ length: baja ? 3 : 5 }, (_, i) => ({ s: spr(false, 0x5a5550, 0), f: i / (baja ? 3 : 5) }));
  const c1 = new THREE.Color(1, 0.9, 0.55), c2 = new THREE.Color(1, 0.45, 0.08), c3 = new THREE.Color(0.55, 0.08, 0.02), tmp = new THREE.Color(), wp = new THREE.Vector3();
  if (!M.luzFuego) { M.luzFuego = new THREE.PointLight(0xff8a3a, 0, 10, 1.6); M.escena.add(M.luzFuego); }   // una sola luz para todas (no cambia la cantidad de luces: sin recompilar)
  let fuerza = 0, t = Math.random() * 10, chispaz = 0;
  return {
    encender() { fuerza = 0.05; chispaz = 1; },
    actualizar(dt, encendida) {
      if (M.luzMarca !== M.t) { M.luzMarca = M.t; M.luzMejor = Infinity; M.luzFuego.intensity = 0; }   // primera fogata del cuadro: apaga la luz
      g.getWorldPosition(wp);
      const dj = Math.hypot(wp.x - M.jug.pos.x, wp.z - M.jug.pos.z);
      grupo.visible = dj < 80; if (!grupo.visible) return;
      t += dt; fuerza = encendida ? Math.min(1, fuerza + dt * 1.4) : 0;
      if (g.userData.brasas) g.userData.brasas.color.setRGB(0.28 + 0.72 * fuerza, 0.2 + 0.8 * fuerza, 0.18 + 0.82 * fuerza);
      const tit = 0.85 + 0.1 * Math.sin(t * 13.1) + 0.07 * Math.sin(t * 23.7 + 1) + 0.05 * Math.sin(t * 5.3);
      for (const l of llamas) {
        const u = (l.f + t * l.v * 0.9) % 1, k = fuerza * (1 - u);
        l.s.position.set(Math.cos(l.a + t * 2) * l.r * (1 - u * 0.7) + Math.sin(t * 7 + l.a) * 0.04 * u, 0.32 + u * 1.3 * (0.8 + 0.2 * tit), Math.sin(l.a + t * 2) * l.r * (1 - u * 0.7));
        l.s.scale.setScalar((0.95 * (1 - u) + 0.18) * tit * (0.6 + 0.4 * fuerza) * (l.aditiva ? 1 : 0.8));
        tmp.copy(u < 0.35 ? c1 : c2).lerp(u < 0.35 ? c2 : c3, u < 0.35 ? u / 0.35 : (u - 0.35) / 0.65); l.s.material.color.copy(tmp);
        l.s.material.opacity = Math.min(1, k * (l.aditiva ? 1.4 : 0.85)) * (u < 0.08 ? u / 0.08 : 1);
      }
      // brasas: con el fuego apagado queda un resplandor rojo tenue que late
      nucleo.position.y = 0.3; nucleo.scale.setScalar(encendida ? 1.5 * tit : 0.75);
      nucleo.material.color.setRGB(1, encendida ? 0.5 : 0.25, encendida ? 0.12 : 0.05); nucleo.material.opacity = encendida ? 0.45 * fuerza * tit : 0.22 + 0.08 * Math.sin(t * 1.7);
      for (const c of chispas) {
        c.t += dt * (chispaz > 0 ? 3 : 1);
        if (c.t > 1.4) { c.t = Math.random() * (chispaz > 0 ? 0.2 : 1.2) - 0.3; c.vx = (Math.random() - 0.5) * 0.6; c.vz = (Math.random() - 0.5) * 0.6; }
        const u = Math.max(0, c.t); c.s.position.set(c.vx * u, 0.5 + u * 1.9, c.vz * u + Math.sin(u * 9) * 0.05); c.s.scale.setScalar(0.07);
        c.s.material.opacity = encendida && c.t > 0 ? fuerza * Math.max(0, 1 - u / 1.4) : 0;
      }
      chispaz = Math.max(0, chispaz - dt);
      for (const h of humo) {   // encendida: humo gris que sube y se abre; apagada: un hilo delgado
        const u = (h.f + t * (encendida ? 0.22 : 0.12)) % 1;
        h.s.position.set(Math.sin(u * 4 + h.f * 6) * 0.15 * u, encendida ? 1.3 + u * 2.6 : 0.35 + u * 1.6, Math.cos(u * 3 + h.f * 5) * 0.12 * u);
        h.s.scale.setScalar(encendida ? 0.5 + u * 1.6 : 0.15 + u * 0.45);
        h.s.material.opacity = (encendida ? 0.2 * fuerza : 0.16) * Math.sin(u * Math.PI);
      }
      // luz: la de la fogata encendida más cercana a Nato (a menos de 22 m), parpadeando
      if (encendida && dj < 22 && dj < M.luzMejor) { M.luzMejor = dj; M.luzFuego.position.set(wp.x, wp.y + 1.0, wp.z); M.luzFuego.intensity = 22 * fuerza * tit; }
    },
  };
}
function sombra(M) {
  const s = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  s.rotation.x = -Math.PI / 2; s.visible = false; M.escena.add(s); return s;
}
function condor(M, L, s, op = {}) {
  const esc = op.escala || 1, g = mallaCondor(esc, !op.jefe && M.splatsTodos && M.splatsTodos.condor_vuelo, !!op.jefe), casa = v3(s.x, (s.y ?? M.fis.suelo(s.x, s.z)) + (s.alto || 12), s.z);
  g.position.copy(casa);
  const e = L.agregar(base(s, op.tipo || 'condor', { malla: g, estado: 'vuela', casa, ang: Math.random() * 6, sombra: sombra(M), hp: op.hp || 1 }));
  e.pos = g.position;
  e.golpear = (desde, n = 1) => {
    if (op.jefe) return op.jefe.golpe(e, desde, n);
    if (e.estado === 'agarra') M.soltarJugador();
    e.estado = 'golpeado'; e.t = 0; noqueo('condor', 250); sumarEnergia(12); M.plumas(g.position); M.efecto('golpeFuerte');
    const dx = g.position.x - desde.x, dz = g.position.z - desde.z, l = Math.hypot(dx, dz) || 1; e.vg = v3(dx / l * 8, 6, dz / l * 8);
  };
  e.act = dt => {
    e.t += dt;
    const j = M.jug, alas = g.userData, aleteo = Math.sin(M.t * (e.estado === 'agarra' ? 14 : 8));
    if (alas.condor) {   // G-CONDOR: acción del esqueleto según el estado (planea y de vez en cuando bate las alas)
      const ac = { aviso: 'aleteo', picada: 'picada', sube: 'aleteo', agarra: 'aleteo', golpeado: 'aleteo', presenta: 'chillido', aleteo: 'aleteo', descansa: 'posado', clavado: 'aleteo', derrotado: 'aleteo' }[e.estado]
        || ((M.t * 0.2 + e.ang) % 3 < 0.7 ? 'aleteo' : 'planeo');
      alas.condor.tocar(ac, { agarra: 1.6, golpeado: 2, clavado: 2, aleteo: 1.4 }[e.estado] || 1); alas.condor.actualizar(dt);
    }
    alas.alaI.rotation.z = aleteo * 0.6; alas.alaD.rotation.z = -aleteo * 0.6;
    if (alas.y0 != null) { const pl = Math.sin(M.t * 1.3 + e.ang); alas.modelo.position.y = alas.y0 + pl * 0.15; alas.modelo.rotation.z = pl * 0.12 + aleteo * 0.03; }   // en vuelo: planeo y balanceo suaves
    else if (alas.modelo) { alas.modelo.position.y = -0.75 * (op.escala || 1) + aleteo * 0.12; alas.modelo.rotation.z = aleteo * 0.08; }
    const libre = !['golpeado', 'agarra', 'sevan'].includes(e.estado);
    if (libre) {   // golpes de Nato (la patada voladora es la buena)
      const gp = j.golpeActivo();
      if (gp && !gp.a.golpeados.has(e) && Math.hypot(gp.x - g.position.x, gp.z - g.position.z) < gp.r + 0.9 * esc && Math.abs(gp.y - g.position.y) < 1.6 * esc) { gp.a.golpeados.add(e); e.golpear(j.pos, gp.tipo === 'patada' ? 2 : 1); return; }
      if (j.chaqueta > 0 && g.position.distanceTo(j.pos) < 1.8 * esc && !op.jefe) { e.golpear(j.pos); return; }
    }
    if (op.jefe && op.jefe.act(e, dt)) return;
    const dh = dist2(j.pos, casa);
    switch (e.estado) {
      case 'vuela':
        e.ang += dt * 0.6; g.position.set(casa.x + Math.cos(e.ang) * 8, casa.y + Math.sin(M.t) * 0.5, casa.z + Math.sin(e.ang) * 8);
        g.rotation.y = -e.ang;
        if (dh < 22 && j.estado === 'normal' && j.p.enSuelo && M.mismaSala(e) && !M.enCapacho() && M.puedeAtacarCondor()) { e.estado = 'aviso'; e.t = 0; M.efecto('chillido'); M.aviso('¡Cuidado, un cóndor!'); }
        break;
      case 'aviso': {   // se pone encima de Nato; su sombra marca dónde bajará
        const obj = v3(j.pos.x, j.pie + 8, j.pos.z);
        g.position.lerp(obj, 1 - Math.exp(-dt * 3));
        e.sombra.visible = true; e.sombra.position.set(j.pos.x, j.pie + 0.05, j.pos.z); e.blanco = v3(j.pos.x, j.pos.y, j.pos.z);
        if (e.t > DIF().aviso / 60 * 1.6) { e.estado = 'picada'; e.t = 0; M.efecto('chillido'); }
        break;
      }
      case 'picada': {
        const d = e.blanco.clone().sub(g.position), l = d.length();
        g.position.addScaledVector(d.normalize(), Math.min(l, DIF().picada * 6.5 * dt));
        g.rotation.x = 0.8;
        if (g.position.distanceTo(j.pos) < 1.3 * esc) {
          if (j.chaqueta > 0 || (j.ataque && j.ataque.tipo === 'patada')) { e.golpear(j.pos); break; }
          if (j.invul <= 0 && !op.noAgarra) { e.estado = 'agarra'; e.t = 0; e.sombra.visible = false; M.atrapar(e); M.efecto('chillido'); break; }
          if (op.noAgarra && danar(j, 'picada')) golpeSeguro(M, j, g.position, 6);
        }
        // N4-X1: el cóndor gigante, al fallar o al terminar la picada, queda CLAVADO en el suelo un momento (la ventana para pegarle)
        if (l < 0.4 || e.t > 2.5) { e.estado = op.jefe ? 'clavado' : 'sube'; e.t = 0; e.sombra.visible = false; if (!op.jefe) g.rotation.x = 0; }
        break;
      }
      case 'sube': g.position.lerp(casa, 1 - Math.exp(-dt * 1.2)); if (e.t > 2.5) e.estado = 'vuela'; break;
      case 'agarra': {   // se lleva a Nato al cielo: hay que machacar saltar o golpear para soltarse
        g.position.y += dt * 2.4; g.position.x += Math.sin(e.t) * dt;
        M.llevarJugador(g.position);
        if (E.b.saltar.recien || E.b.golpe.recien || E.b.patada.recien) { e.lucha = (e.lucha || 0) + 1; M.efecto('golpeSuave'); }
        if ((e.lucha || 0) >= Math.ceil(DIF().lucha / 2)) { e.lucha = 0; M.soltarJugador(); e.golpear(j.pos); M.rotulo('¡Te soltaste!'); break; }
        if (e.t > 3.6) { e.lucha = 0; M.olla(e); e.estado = 'sube'; e.t = 0; }
        break;
      }
      case 'golpeado':
        e.vg.y -= 12 * dt; g.position.addScaledVector(e.vg, dt); g.rotation.z += dt * 5;
        if (e.t > 2) { e.estado = 'sevan'; L.quitar(e); e.sombra.removeFromParent(); }
        break;
    }
  };
  return e;
}

// ------------------------------------------------------------------ Hércules: entra corriendo y se lanza contra el enemigo más cercano
// Hércules acompaña a Nato todo el camino (pedido de Diego, 12-11-2026): lo sigue a un lado y un poco atrás,
// entra con él a los interiores y reaparece a su lado si se queda lejos. Solo ataca cuando se pulsa la tecla del perro
// (C / 🐕) con la barra de energía llena; después del mordisco vuelve a su lado.
export function crearHercules(M, L) {
  const j = M.jug;
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.3), mat(0xc8924e)); cuerpo.position.y = 0.75; g.add(cuerpo);
  const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.5), mat(0x2a1e18)); cabeza.position.set(0, 1.05, 0.75); g.add(cabeza);
  const pecho = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), mat(0xf4f0e8)); pecho.position.set(0, 0.65, 0.66); g.add(pecho);
  for (const [x, z] of [[-0.22, 0.45], [0.22, 0.45], [-0.22, -0.45], [0.22, -0.45]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), mat(0xc8924e)); p.position.set(x, 0.25, z); g.add(p); }
  g.traverse(o => (o.castShadow = true));
  let modelo = null;
  if (M.splatPerro) { for (const h of g.children) h.visible = false; modelo = perroSplat(M.splatPerro, M.yawPerro || 0); g.add(modelo); }
  if (modelo && modelo.children[0]?.userData.mallaPromesa) modelo.children[0].userData.mallaPromesa.then(r => { if (M.hercules) { M.hercules.anim = r.anim; M.hercules.escena3 = r.escena; } }).catch(e => console.warn('Hércules malla', e));
  else if (modelo && modelo.children[0]?.userData.splat) animarSplat(modelo.children[0].userData.splat, 'hercules').then(a => { if (M.hercules) M.hercules.anim = a; });
  g.position.set(j.pos.x + 1.5, j.pie, j.pos.z + 2);
  const h = L.agregar({ tipo: 'hercules', vivo: true, malla: g, estado: 'sigue', t: 0, obj: null, sala: null, paso: 0 });
  M.hercules = h;
  h.gesto = (n, dura = 1.5) => { h.gestoAct = { n, hasta: performance.now() / 1000 + dura }; };
  // si el rayo parte dentro de un sólido (un edificio) choca en el mismo punto de partida (toi 0): eso no es suelo
  const sueloEn = (x, z, y) => { const r = M.fis.rayo({ x, y: y + 2.5, z }, { x: 0, y: -1, z: 0 }, 8); return r && r.toi > 0.01 ? r.punto.y : null; };
  const irA = (x, z, vel, dt, sinGirar = false) => {   // corre pegado al suelo; no cae a las grietas. sinGirar: retrocede mirando adelante
    const dx = x - g.position.x, dz = z - g.position.z, l = Math.hypot(dx, dz);
    if (l < 0.05) return 0;
    const paso = Math.min(l, vel * dt), nx = g.position.x + dx / l * paso, nz = g.position.z + dz / l * paso;
    // N1-C71: choca con lo mismo que Nato (barandas, muros, cajas): dos rayos horizontales (0,35 y 0,75 m) hacia donde va; si
    // pega en algo casi vertical, espera (y tras 2,5 s atascado reaparece junto a Nato). Desde dentro de un sólido (toi 0) sí sale
    for (const hy of [0.35, 0.75]) {
      const r = M.fis.rayo({ x: g.position.x, y: g.position.y + hy, z: g.position.z }, { x: dx / l, y: 0, z: dz / l }, paso + 0.3, j.p.col);
      if (r && r.toi > 0.01 && Math.abs(r.normal?.y ?? 0) < 0.5) return -1;
    }
    const y = sueloEn(nx, nz, g.position.y);
    // borde o escalón muy alto: espera. Hacia ABAJO, si Nato ya bajó, salta hasta 3,2 m (el borde del andén B del N1 mide 1,8 m y se quedaba arriba)
    if (y == null || y - g.position.y > 1.6 || g.position.y - y > (j.pie < g.position.y - 1 ? 3.2 : 1.6)) return -1;
    g.position.set(nx, Math.max(y, g.position.y - 14 * dt), nz);   // cae rápido pero no de golpe
    let d = Math.atan2(dx, dz) - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); if (!sinGirar) g.rotation.y += Math.max(-6 * dt, Math.min(6 * dt, d * Math.min(1, dt * 10)));   // dobla como animal, no de golpe
    h.girando = false;
    return paso / dt;
  };
  const alLado = () => {   // reaparece junto a Nato (lejos, otra sala, otra altura)
    // prueba varios puntos alrededor de Nato y se queda con el primero que tenga suelo libre a su altura. El rayo baja desde
    // 25 m: si lo primero que toca es un techo (más de 1,5 m sobre Nato) ahí hay un edificio. Antes se ponía igual a la altura
    // de Nato y quedaba dentro de la estación del N4, pegado a la fachada y sin poder salir
    const sn = Math.sin(j.rumbo), cs = Math.cos(j.rumbo);
    for (const [atras, der] of [[1.8, 1.2], [1.8, -1.2], [2.2, 0], [0, 1.6], [0, -1.6], [-1.6, 1.2], [-1.6, -1.2]]) {
      const x = j.pos.x - sn * atras + cs * der, z = j.pos.z - cs * atras - sn * der;
      const r = M.fis.rayo({ x, y: j.pie + 25, z }, { x: 0, y: -1, z: 0 }, 40, j.p.col);
      if (r && r.punto.y <= j.pie + 1.5 && r.punto.y >= j.pie - 2.5) { g.position.set(x, r.punto.y, z); g.rotation.y = j.rumbo; return; }
    }
    g.position.set(j.pos.x, j.pie, j.pos.z); g.rotation.y = j.rumbo;   // sin lugar libre: a los pies de Nato
  };
  h.act = dt => {
    h.t += dt;
    g.visible = !M.herculesFuera && j.estado !== 'fuera';
    if (M.herculesFuera) return;
    let vel = 0;
    // Nato entró a un edificio: Hércules no entra; lo espera afuera, sentado junto a la puerta por donde va a salir
    if (M.salaActual) {
      if (h.salaVista !== M.salaActual) {
        const ps = M.R.puertas.filter(p => p.sala === M.salaActual);
        const salida = ps.find(p => p.lado === 'salida' && M.R.salas[M.salaActual].salida) || ps.find(p => p.lado === 'entrada') || ps[0];
        if (salida) {
          const r = salida.rumbo, x = salida.x + Math.sin(r) * 3.2 + Math.cos(r) * 1.6, z = salida.z + Math.cos(r) * 3.2 - Math.sin(r) * 1.6;
          const y = sueloEn(x, z, salida.y + 1);
          g.position.set(x, y != null ? y : salida.y, z); g.rotation.y = r + Math.PI;   // mirando hacia la puerta
        }
        h.estado = 'espera'; h.obj = null; h.salaVista = M.salaActual;
      }
      if (modelo) { modelo.position.y = 0; modelo.rotation.z = 0; }
      if (h.anim) { h.anim.tocar('sentado'); h.anim.actualizar(dt); }   // espera sentado junto a la puerta
      return;
    }
    if (h.estado === 'espera') { h.estado = 'sigue'; h.salaVista = null; }   // Nato salió: vuelve a su lado
    // capacho (N1-C45, pedido de Diego): con Nato arriba de un capacho, Hércules salta adentro, viaja sentado a su lado y,
    // cuando Nato se baja en el otro andén, salta afuera tras él (antes flotaba junto al balde durante todo el viaje)
    {
      const cap = M.enCapacho() ? M.L.de('capacho').find(c => Math.abs(j.pos.x - c.malla.position.x) < 1.8 && Math.abs(j.pos.z - c.malla.position.z) < 1.8) : null;
      if (cap || h.estado === 'saltaCapacho' || h.estado === 'enCapacho' || h.estado === 'saltaFuera') {
        if (modelo && modelo.children[0]?.userData.splat && M.aparte) M.aparte(g, true);   // N1-C45: la nube va con su propio Spark (sin luces: solo gaussianas)
        if (cap && h.estado !== 'saltaCapacho' && h.estado !== 'enCapacho') {
          const c = cap.malla.position, An = M.R.andariveles.reduce((m, a) => { const d = Math.hypot((a.a.x + a.b.x) / 2 - c.x, (a.a.z + a.b.z) / 2 - c.z); return !m || d < m.d ? { a, d } : m; }, null).a;
          const l = Math.hypot(An.b.x - An.a.x, An.b.z - An.a.z) || 1; h.capU = { x: (An.b.x - An.a.x) / l, z: (An.b.z - An.a.z) / l };
          h.capLado = ((g.position.x - c.x) * -h.capU.z + (g.position.z - c.z) * h.capU.x) < 0 ? -1 : 1;   // del lado por donde viene
          h.capacho = cap; h.capPrev = null; h.estado = 'saltaCapacho'; h.t = 0; h.desde = g.position.clone(); h.vx = h.vz = 0; M.efecto('ladrido1');
        }
        const dentro = () => { const c = h.capacho.malla.position, u = h.capU; return new THREE.Vector3(c.x - u.z * 0.55 * h.capLado, c.y - 0.05, c.z + u.x * 0.55 * h.capLado); };
        let anim = 'sentado';
        if (h.estado === 'saltaCapacho') {
          const k = Math.min(1, h.t / 0.6), p = dentro();
          g.position.lerpVectors(h.desde, p, k); g.position.y += Math.sin(k * Math.PI) * 1.9;   // salta por sobre el borde del balde
          g.rotation.y = Math.atan2(p.x - h.desde.x, p.z - h.desde.z); anim = 'saltar';
          if (k >= 1) h.estado = 'enCapacho';
        } else if (h.estado === 'enCapacho') {
          if (cap) h.tBaja = 0; else h.tBaja = (h.tBaja || 0) + dt;
          // Nato va en el aire (el saltito de bajada lo deja 3 m más allá, bajo el borde del andén): espera a que pise lejos del balde
          if (!cap && h.tBaja < 2 && (!j.p.enSuelo || Math.hypot(j.pos.x - g.position.x, j.pos.z - g.position.z) < 2.6)) g.position.copy(dentro());
          else if (!cap) {   // Nato se bajó y ya pisa: salta afuera a su lado, al suelo donde está él (no al borde del andén)
            const dx = j.pos.x - g.position.x, dz = j.pos.z - g.position.z, l = Math.hypot(dx, dz) || 1;
            const x = j.pos.x - dz / l * 1.2 - dx / l * 0.6, z = j.pos.z + dx / l * 1.2 - dz / l * 0.6, y = sueloEn(x, z, j.pie);
            h.estado = 'saltaFuera'; h.t = 0; h.desde = g.position.clone(); h.hacia = new THREE.Vector3(x, y != null ? y : j.pie, z); anim = 'saltar';
          } else {   // sentado mirando hacia adonde va el balde
            const p = dentro(), v = h.capPrev ? p.distanceTo(h.capPrev) / Math.max(dt, 1e-3) : 0; h.capPrev = p.clone();
            g.position.copy(p); g.rotation.y = h.capacho.vuelta ? Math.atan2(-h.capU.x, -h.capU.z) : Math.atan2(h.capU.x, h.capU.z);   // N1-ABASTECIMIENTO-c: en la vuelta mira hacia A
            // se ve todo el viaje (antes se agachaba y no se veía): va en la escena «aparte» con su propio SparkRenderer (M.aparte)
          }
        } else {   // saltaFuera
          const k = Math.min(1, h.t / 0.6);
          if (h.hacia.distanceTo(h.desde) > 15) { alLado(); h.estado = 'sigue'; }
          else {
            g.position.lerpVectors(h.desde, h.hacia, k); g.position.y += Math.sin(k * Math.PI) * 1.6; g.rotation.y = Math.atan2(h.hacia.x - h.desde.x, h.hacia.z - h.desde.z); anim = 'saltar';
            if (k >= 1) { h.estado = 'sigue'; h.capacho = null; h.vx = h.vz = 0; h.t = 0; }
          }
        }
        if (modelo) { modelo.position.y = 0; modelo.rotation.z = 0; }
        if (h.anim) { h.anim.tocar(anim); h.anim.actualizar(dt); }
        return;
      }
    }
    if (M.aparte) M.aparte(g, false);   // N1-C45: de vuelta a la escena principal al bajarse del capacho
    if (h.estado === 'sigue') {
      // compañero con inercia (14-11, pedido de Diego): antes iba clavado a 1,5 m «como amarrado con un palo» y al frenar se
      // iba 1,8 m atrás. Ahora: caminando o quieto se pone al lado; corriendo se adelanta y se atrasa (±1,5 m) y se abre y
      // se acerca, con un ritmo variable. No copia la velocidad de Nato: acelera y frena con un tope (12 m/s²), como un perro
      const vN = Math.hypot(j.vel.x, j.vel.z), corre = Math.min(1, Math.max(0, (vN - 2.5) / 3));
      const tt = h.t + (h.fase ??= Math.random() * 20);
      const adel = corre * (0.4 + 1.4 * Math.sin(tt * 0.7) + 0.9 * Math.sin(tt * 0.31 + 1)), lado = 1.6 + corre * 0.4 * Math.sin(tt * 0.53 + 2);
      const sn = Math.sin(j.rumbo), cs = Math.cos(j.rumbo);
      const x = j.pos.x + sn * adel + cs * lado, z = j.pos.z + cs * adel - sn * lado;
      const d = Math.hypot(x - g.position.x, z - g.position.z);
      h.vx ??= 0; h.vz ??= 0;
      // velocidad deseada: la de Nato más un resorte hacia el punto; la real la alcanza con aceleración limitada
      // llegada: a menos de 35 cm de su lugar y con Nato quieto, frena a cero (antes quedaba a 0,25 m/s, justo en el umbral,
      // y alternaba cada cuadro entre avanzar y girar a mirar a Nato: temblaba sobre su eje y nunca se sentaba)
      const llega = d < 0.35 && vN < 0.3;
      let dvx = llega ? 0 : j.vel.x + (x - g.position.x) * 1.6, dvz = llega ? 0 : j.vel.z + (z - g.position.z) * 1.6;
      const ld = Math.hypot(dvx, dvz); if (ld > 13) { dvx *= 13 / ld; dvz *= 13 / ld; }
      const ax = dvx - h.vx, az = dvz - h.vz, la = Math.hypot(ax, az), amax = (vN < 0.5 ? 18 : 12) * dt;   // frena más fuerte: se pasa menos
      if (la > amax) { h.vx += ax / la * amax; h.vz += az / la * amax; } else { h.vx = dvx; h.vz = dvz; }
      const vH = Math.hypot(h.vx, h.vz);
      // tras morder vuelve corriendo (pedido de Diego): ataca hasta 45 m y antes, a más de 28 m, reaparecía a tu lado de golpe
      if (h.volviendo && d < 4) h.volviendo = false;
      if (d > (h.volviendo ? 70 : 28) || Math.abs(j.pie - g.position.y) > (h.volviendo ? 15 : 7)) { alLado(); h.vx = h.vz = 0; h.volviendo = false; }
      else if ((h.mueve = h.mueve ? vH > 0.15 : vH > 0.4)) { const qAtras = vH < 1.8 && d < 2 && vN < 0.5 && Math.cos(Math.atan2(h.vx, h.vz) - g.rotation.y) < -0.35; h.tAtras = qAtras ? (h.tAtras || 0) + dt : 0; const atras = qAtras && h.tAtras < 0.8; /* N1-C56: retrocede solo un ajuste corto con Nato quieto; si Nato camina, se da vuelta (antes lo seguía de espaldas o de lado, como cangrejo) */ vel = irA(g.position.x + h.vx, g.position.z + h.vz, vH, dt, atras); if (vel < 0) { vel = 0; h.atascado = (h.atascado || 0) + dt; if (h.atascado > 2.5) { alLado(); h.atascado = 0; } } else h.atascado = 0; }   // histéresis: no alterna entre avanzar y girar
      else {   // quieto a su lado: al rato se gira a mirar a Nato (no mira al mismo lado que él como un adorno)
        const objetivo = h.quieto > 1.5 ? Math.atan2(j.pos.x - g.position.x, j.pos.z - g.position.z) : j.rumbo;
        let r = objetivo - g.rotation.y; r = Math.atan2(Math.sin(r), Math.cos(r));
        // gira dando pasos (antes giraba sobre su eje «como en un plato giratorio»): sobre 17° camina en el lugar mientras gira
        h.girando = Math.abs(r) > 0.3 || (h.girando && Math.abs(r) > 0.08);
        g.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, r * Math.min(1, dt * 3)));
      }
      // compañero: con Nato quieto se sienta a su lado; cuando Nato parte, se levanta contento. Con enemigos cerca ladra
      // de vez en cuando, y si a Nato le pegan, ladra
      h.quieto = vN < 0.3 && vH < 0.5 ? (h.quieto || 0) + dt : 0;
      if (h.sentado && vN > 1) h.gesto('feliz', 0.4);
      h.sentado = h.quieto > 2.5 && !h.girando;
      if (j.enemigoCerca && vH < 1 && Math.random() < dt * 0.25) h.gesto('ladrar', 0.5);
      if (j.estado === 'herido' && !h.vioHerido) { h.gesto('ladrar', 0.6); h.vioHerido = true; } else if (j.estado !== 'herido') h.vioHerido = false;
      // Hércules no se superpone a las piernas de Nato: a menos de 1,1 m se aparta en línea recta
      { const ex = g.position.x - j.pos.x, ez = g.position.z - j.pos.z, ld = Math.hypot(ex, ez);
        if (ld < 1.1) { const ux = ld > 0.05 ? ex / ld : Math.cos(j.rumbo + 1.5), uz = ld > 0.05 ? ez / ld : -Math.sin(j.rumbo + 1.5), k = Math.min(1, dt * 8) * (1.1 - ld); g.position.x += ux * k; g.position.z += uz * k; } }
      h.salaVista = M.salaActual;
    } else if (h.estado === 'corre') {
      const o = h.obj, op = o.pos || o.malla.position;
      const fuera = !o.vivo || ['ko', 'sevan', 'golpeado', 'derrotado'].includes(o.estado);
      if (fuera || ((o.tipo === 'condor' || o.tipo === 'condorJefe') && op.y - g.position.y > 1.5)) { h.estado = 'sigue'; h.obj = null; }   // N1-C61: el cóndor se fue a la altura: lo deja
      else {
        const dx = op.x - g.position.x, dz = op.z - g.position.z, l = Math.hypot(dx, dz) || 1;
        g.rotation.y = Math.atan2(dx, dz);
        g.position.x += dx / l * 12 * dt; g.position.z += dz / l * 12 * dt; vel = 12;
        const y = sueloEn(g.position.x, g.position.z, g.position.y); if (y != null && y > g.position.y - 3) g.position.y = y;
        if (l < 3 || h.t > 4) { h.estado = 'salta'; h.t = 0; M.efecto('ladrido1'); h.gesto('ladrar', 0.35); h.desde = g.position.clone(); }
      }
    } else if (h.estado === 'salta') {
      const o = h.obj, op = o.pos || o.malla.position;
      g.position.lerpVectors(h.desde, op, Math.min(1, h.t / 0.35)); g.position.y += Math.sin(Math.min(1, h.t / 0.35) * Math.PI) * 1.2;
      if (h.t > 0.35) {
        // ¡mordisco de caricatura! quita mucha más vida que Nato
        if (['minero', 'dinamitero', 'bolero'].includes(o.tipo)) o.recibir(99, g.position);
        else if (o.tipo === 'condor') o.golpear(g.position, 3);
        else if (o.tipo === 'jefe') o.golpeHercules();
        else if (o.tipo === 'condorJefe') o.golpear(g.position, 3);
        M.rotulo('¡GUAU!'); M.efecto('golpeFuerte'); M.sacudir(0.3);
        h.estado = 'sigue'; h.obj = null; h.t = 0; h.volviendo = true; h.vx = h.vz = 0;   // vuelve corriendo al lado de Nato
        const y = sueloEn(g.position.x, g.position.z, g.position.y + 2); if (y != null) g.position.y = y;
      }
    }
    // trote: el modelo sube y baja y se mece al correr
    h.paso += vel * dt;
    if (h.anim) {   // esqueleto de Blender: galope, paso, salto o reposo según lo que hace
      h.vS = (h.vS || 0) + (vel - (h.vS || 0)) * Math.min(1, dt * 6);   // velocidad suavizada y marcha con histéresis (no salta de una a otra)
      if (h.vS > 6.5) h.marcha = 'correr'; else if (h.marcha === 'correr' && h.vS < 5) h.marcha = 'caminar';
      if (h.vS < 0.3) h.marcha = null; else if (!h.marcha && h.vS > 0.7) h.marcha = 'caminar';
      const gh = h.gestoAct && performance.now() / 1000 < h.gestoAct.hasta ? h.gestoAct.n : null;
      const giraPasos = !h.marcha && h.girando && h.estado === 'sigue';
      h.anim.tocar(gh || (h.estado === 'salta' ? 'saltar' : h.marcha || (giraPasos ? 'caminar' : h.sentado && h.estado === 'sigue' ? 'sentado' : 'idle')), { vel: h.marcha === 'correr' ? Math.min(1.4, Math.max(0.8, h.vS / 10)) : h.marcha ? Math.min(1.6, Math.max(0.6, h.vS / 2.2)) : giraPasos ? 0.7 : 1, fundido: 0.3 });
      h.anim.actualizar(dt);
    } else if (modelo) { modelo.position.y = vel > 0.5 ? Math.abs(Math.sin(h.paso * 1.6)) * 0.07 : 0; modelo.rotation.z = vel > 0.5 ? Math.sin(h.paso * 1.6) * 0.04 : 0; }
  };
  // dibujo fluido (14-11): como Nato, Hércules se mueve por pasos de 1/60 s; vista() lo dibuja interpolado entre pasos y su
  // animación avanza con el tiempo real del cuadro (si no, en los cuadros sin paso quedaba congelado)
  const actPaso = h.act;
  h.act = dt => { if (h.posAct) g.position.copy(h.posAct); (h.posAnt ||= new THREE.Vector3()).copy(g.position); actPaso(dt); (h.posAct ||= new THREE.Vector3()).copy(g.position); };
  h.vista = (alfa, dtReal) => {
    if (h.posAnt && h.posAct && h.posAnt.distanceToSquared(h.posAct) < 9) g.position.lerpVectors(h.posAnt, h.posAct, alfa);
    if (h.anim) { if (!h.anim.real) { h.anim.real = h.anim.actualizar; h.anim.actualizar = () => {}; } h.anim.real(dtReal); }
    // N0-C2: apoyo en el suelo según la pose. Al sentarse la cadera baja del origen del modelo y el trasero y las patas traseras quedaban
    // bajo el piso (y en un escalón o pendiente, uno de los lados). Cada 3 cuadros se miden los vértices más bajos de la malla ya
    // deformada contra el suelo bajo ellos (rayo) y el modelo sube (o, sentado/quieto, baja) lo justo; se suaviza para que no tiemble.
    if (h.escena3 && modelo) {
      if (!h.apoyo) {
        const mallas = []; h.escena3.traverse(o => { if (o.isSkinnedMesh) mallas.push(o); });
        const muestras = []; for (const m of mallas) { const n = m.geometry.attributes.position.count, paso = Math.max(1, Math.floor(n / 700)); for (let i = 0; i < n; i += paso) muestras.push([m, i]); }
        h.apoyo = { muestras, v: new THREE.Vector3(), lift: 0, meta: 0, n: 0 };
      }
      const A = h.apoyo;
      if (++A.n % 3 === 0 && A.muestras.length) {
        const bajos = [];   // los 14 vértices más bajos (mundo)
        for (const [m, i] of A.muestras) { m.getVertexPosition(i, A.v); A.v.applyMatrix4(m.matrixWorld); const y = A.v.y - modelo.position.y;
          if (bajos.length < 14 || y < bajos[bajos.length - 1][1]) { bajos.push([A.v.x, y, A.v.z]); bajos.sort((a, b) => a[1] - b[1]); if (bajos.length > 14) bajos.pop(); } }
        let pen = -9, tocan = 0;
        for (const [x, y, z] of bajos) { const r = M.fis.rayo({ x, y: y + 1.2, z }, { x: 0, y: -1, z: 0 }, 3.2, j.p.col, ['baranda']); if (!r || r.toi < 0.01) continue; pen = Math.max(pen, r.punto.y - y); tocan++; }
        const quieta = ['sentado', 'idle'].includes(h.anim.actual);
        if (tocan) A.meta = Math.max(quieta ? -0.45 : 0, Math.min(0.6, pen)); else A.meta = 0;
        if (A.meta > -0.02 && A.meta < 0.02) A.meta = 0;
      }
      A.lift += (A.meta - A.lift) * Math.min(1, dtReal * 10); modelo.position.y = A.lift;
    }
    // N1-O4: pegado a la cámara las gaussianas del perro se ven como una mancha negra que tapa a Nato. Se desvanece si está a
    // menos de ~2 m de la cámara, o si se mete entre la cámara y Nato (a menos de 4,5 m de la cámara)
    const cam = M.cam?.cam;
    if (cam && modelo) {
      const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, hx = g.position.x - cx, hy = g.position.y + 0.5 - cy, hz = g.position.z - cz;
      const dh = Math.hypot(hx, hy, hz); let k = Math.min(1, Math.max(0, (dh - 0.9) / 1.3));
      for (const alt of [0.3, 1, 1.6]) {   // rayos de la cámara a los pies, la cintura y la cabeza de Nato
        const nx = j.pos.x - cx, ny = j.pie + alt - cy, nz = j.pos.z - cz, dn = Math.hypot(nx, ny, nz) || 1, a = (hx * nx + hy * ny + hz * nz) / dn;
        if (a > 0 && a < dn - 0.4 && dh < 5) { const perp = Math.sqrt(Math.max(0, dh * dh - a * a)); if (perp < 0.8) k = Math.min(k, 0.12 + perp / 0.8 * 0.88); }
      }
      h.opVista = (h.opVista ?? 1) + (k - (h.opVista ?? 1)) * Math.min(1, dtReal * 10);
      modelo.visible = h.opVista > 0.35;   // (SplatMesh.opacity no se nota con el esqueleto de animSplat: se oculta entero)
    }
  };
  return h;
}

export function llamarHercules(M, L) {
  const j = M.jug, h = M.hercules;
  if (!h || M.herculesFuera) return false;
  if (P.energia < 100) { M.rotulo('Hércules espera: llena la barra peleando'); return false; }
  if (h.estado === 'espera') { M.rotulo('Hércules te espera afuera'); return false; }
  if (h.estado !== 'sigue') return false;
  let obj = null, mejor = 45;
  for (const e of L.lista) {
    if (!e.vivo || !M.mismaSala(e)) continue;
    const vale = (['minero', 'dinamitero', 'bolero'].includes(e.tipo) && !['ko', 'sevan'].includes(e.estado)) || (e.tipo === 'condor' && !['golpeado', 'sevan'].includes(e.estado))
      || (e.tipo === 'jefe' && e.pelea) || (e.tipo === 'condorJefe' && e.pelea);
    if (!vale) continue;
    if ((e.tipo === 'condor' || e.tipo === 'condorJefe') && (e.pos || e.malla.position).y - j.pie > 1.2) continue;   // N1-C61: solo lo que está a su alcance en el suelo (no cóndores en el aire)
    const d = (e.pos || e.malla.position).distanceTo(j.pos) - (e.estado === 'agarra' ? 100 : 0);
    if (d < mejor) { mejor = d; obj = e; }
  }
  if (!obj) { M.rotulo('No hay enemigos cerca'); return false; }
  P.energia = 0;
  h.obj = obj; h.estado = 'corre'; h.t = 0;
  M.efecto('ladrido'); M.rotulo('¡HÉRCULES, AL ATAQUE!');
  return true;
}

// ------------------------------------------------------------------ plataformas móviles
function capachos(M, L, A) {
  // puertas del vano: cierran el hueco del andén (barranco) cuando no hay un balde esperando; bajan bajo el piso cuando el balde está en el andén
  const uA = { x: (A.b.x - A.a.x), z: (A.b.z - A.a.z) }, lU = Math.hypot(uA.x, uA.z) || 1; uA.x /= lU; uA.z /= lU;
  const giroG = Math.atan2(uA.x, uA.z);
  // N4-C18: el balde y sus puertas se giran con el cable (rotation.y que lleva +x local a lo largo del cable; en el N1 es 0) y
  // el viaje sigue la línea quebrada de las torres intermedias (A.puntos, todas en la recta a→b vista desde arriba)
  const thC = Math.atan2(-uA.z, uA.x), PT = A.puntos || [A.a, A.b], LS = [0];
  for (let k = 1; k < PT.length; k++) LS.push(LS[k - 1] + Math.hypot(PT[k].x - PT[k - 1].x, PT[k].y - PT[k - 1].y, PT[k].z - PT[k - 1].z));
  const enCable = k => { const d = k * LS[LS.length - 1]; let s = 1; while (s < PT.length - 1 && LS[s] < d) s++; const f = (d - LS[s - 1]) / (LS[s] - LS[s - 1] || 1), p = PT[s - 1], q = PT[s]; return [p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f, p.z + (q.z - p.z) * f]; };
  const mkG = (x, y, z) => { const g = M.fis.movil(x, y - 30, z, [{ sx: 0.15, sy: 2.2, sz: 3.5, y: 1.1 }], { tipo: 'baranda' }); M.fis.moverMovil(g, x, y - 30, z, thC); return g; };
  A.gA = mkG(A.a.x - uA.x * 1.15, A.a.y, A.a.z - uA.z * 1.15); A.gB = mkG(A.b.x + uA.x * 1.15, A.b.y, A.b.z + uA.z * 1.15);
  A.enA = []; A.enB = [];
  const subirG = (g, x, y, z, arriba) => { M.fis.moverMovil(g, x, arriba ? y : y - 30, z, thC); if (Math.abs(g.delta.y) > 3) g.delta = { x: 0, y: 0, z: 0 }; };
  const largo = Math.hypot(A.b.x - A.a.x, A.b.y - A.a.y, A.b.z - A.a.z);
  const V = andarivelVuelta(M, L, A, enCable, LS[LS.length - 1]);   // N1-ABASTECIMIENTO: solo 'hamilton' (null en el resto: igual que antes)
  for (let i = 0; i < (V ? V.n : A.capachos); i++) {
    // balde: costados altos y umbrales bajos hacia los andenes; en el viaje, quien se baja cae al barranco
    const cajas = [{ sx: 2.3, sy: 1.0, sz: 2.3, y: -0.55 }, { sx: 2.3, sy: 2.2, sz: 0.15, y: 1.1, z: 1.1 }, { sx: 2.3, sy: 2.2, sz: 0.15, y: 1.1, z: -1.1 }];   // costados de 2,2 m (invisibles): con 1,4 Nato se subía encima
    // tapas de los extremos (en el viaje Nato caminaba por las puntas abiertas y caía al barranco): suben solo mientras el balde viaja, y bajan bajo el piso en los andenes
    const plT = M.fis.movil(A.a.x, A.a.y - 30, A.a.z, [{ sx: 0.15, sy: 2.2, sz: 2.3, x: -1.1, y: 1.1 }], { tipo: 'capacho' });   // tapa de atrás (por donde se entra en A)
    const plF = M.fis.movil(A.a.x, A.a.y - 30, A.a.z, [{ sx: 0.15, sy: 2.2, sz: 2.3, x: 1.1, y: 1.1 }], { tipo: 'capacho' });   // tapa de adelante: arriba en A y en el viaje, abajo solo al llegar a B (si no, quien entra corriendo se pasa de largo al barranco)   // abierto hacia los andenes: se entra y se sale caminando (el balde espera detenido mientras Nato está arriba)
    const pl = M.fis.movil(A.a.x, A.a.y, A.a.z, cajas, { tipo: 'capacho' });
    for (const q of [plT, plF, pl]) M.fis.moverMovil(q, q.pos.x, q.pos.y, q.pos.z, thC);
    const g = new THREE.Group(); g.rotation.y = thC;
    (M.fis.camObst ||= []).push({ pos: g.position, r: 1.35, y0: -1.1, y1: 3.7, capacho: true });   // N1-O8: la cámara (con Nato fuera) no se mete en el balde ni en su asa (3,4 m)
    const spC = M.splatsTodos && M.splatsTodos.capacho;
    for (const k of cajas) { const m = new THREE.Mesh(new THREE.BoxGeometry(k.sx, k.sy, k.sz), mat(0x5a4636, { metal: 0.4 })); m.position.set(k.x || 0, k.y || 0, k.z || 0); m.castShadow = true; m.visible = !spC; g.add(m); }
    // N1-C52: girado 90° (los cables del N1 y N2 van a lo largo de X): el asa pivota en los costados que miran a lo largo del cable y el lado del andén queda libre
    if (spC) { const v = vehiculoSplat(spC, 2.5, Math.PI / 2, 2.5, 0, true); v.position.y = -0.25; g.add(v); }   // balde de fierro de Idol (la colisión sigue siendo la de las cajas); malla: viaja sin retraso
    // cable desde el gancho del balde (con modelo, su asa llega a ~3,4 m) hasta el cable de arriba: antes bajaba hasta el piso y atravesaba a Nato
    const y0c = spC ? 3.3 : 0, colg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, A.alto - y0c, 4), mat(0x222222)); colg.position.y = (A.alto + y0c) / 2; g.add(colg);
    const e = L.agregar({ tipo: 'capacho', vivo: true, malla: g, pl, plT, plF, i, reloj: 0 });
    if (V) { e.carga = cargaMineral(); e.carga.position.y = spC ? 0.95 : 0.5; g.add(e.carga); e.sacos = cargaSacos(); e.sacos.I.position.y = spC ? 0.95 : 0.5; g.add(e.sacos.I); }   // N1-ABASTECIMIENTO-c: mineral a la ida, sacos de víveres a la vuelta
    e.act = dt => {
      // cada capacho lleva su reloj: en la punta de llegada espera mientras Nato siga arriba
      const j = M.jug, p0 = g.position;
      const encima = Math.abs(j.pos.x - p0.x) < 1.3 && Math.abs(j.pos.z - p0.z) < 1.3 && Math.abs(j.pie - p0.y) < 0.8;
      const u0 = V ? V.u(e.reloj, i, true) : ((e.reloj / A.periodo) + i / A.capachos) % 1;
      // N1-ABASTECIMIENTO-c: tR = segundos de la vuelta (B → A) o null en la ida; e.trajo = Nato viajó en él desde A (solo a ese se le
      // baja en B: quien se sube en el muelle de B es para volver)
      const tR = V ? V.tRet(e.reloj, i) : null;
      if (tR == null && encima && u0 > 0.25 && u0 < 0.8) e.trajo = true; else if (!encima && u0 < 0.2) e.trajo = false;
      // solo el capacho que lleva a Nato espera en la llegada; los que vienen detrás esperan antes, sin montarse encima
      if (encima && u0 > 0.83 && tR == null && (!V || e.trajo)) A.ocupado = i; else if (A.ocupado === i) { A.ocupado = null; e.quieto = 0; e.trajo = false; }
      // llegó con Nato: se baja solo al andén con un saltito (el borde balde/andén trababa al controlador de física)
      if (A.ocupado === i) {
        e.quieto = (e.quieto || 0) + dt;
        if (e.quieto > 0.5 && j.estado === 'normal') {
          const dx = A.b.x - A.a.x, dz = A.b.z - A.a.z, l = Math.hypot(dx, dz) || 1;
          const x = A.b.x + dx / l * 3.2, z = A.b.z + dz / l * 3.2;
          j.teletransportar(x, M.fis.suelo(x, z, A.b.y + 8) + 0.15, z);   // N4-C18: desde ≥ 5 m arriba (fis.suelo ignora lo que choca a < 5 m del origen: con +3 saltaba la tabla del andén y dejaba a Nato dentro de su bloque, en el suelo) j.vel.set(dx / l * 2, 3, dz / l * 2);
          A.ocupado = null; e.quieto = 0;
        }
      }
      const esperaAtras = A.ocupado != null && A.ocupado !== i && u0 > 0.62 && u0 < 0.83 || (V && tR == null && u0 > 0.62 && u0 < 0.8 && V.ocupaB(i));   // N1-ABASTECIMIENTO-c: el muelle de B lo ocupa uno de vuelta
      // N1-ABASTECIMIENTO-c (Diego: «Nato y Hércules deben poder tomar el andarivel de vuelta cuando quieran»): uno de vuelta quieto en el
      // muelle de B se puede abordar; el que lleva a Nato (V.jinete) espera a que esté adentro (y Hércules haya saltado), y en A lo baja
      let detener = false;
      if (V && tR != null) {
        const enB = V.enMuelleB(tR) || tR < TB_ESP + 0.4;
        if (encima && enB) { if (V.jinete !== i) { V.jinete = i; e.subio = 0; } }
        else if (V.jinete === i && !encima && enB) V.jinete = null;   // se bajó antes de partir
        if (V.jinete === i) {
          e.subio = (e.subio || 0) + dt;
          if (enB && (e.subio < 1.2 || !encima || Math.abs((j.pos.x - p0.x) * uA.x + (j.pos.z - p0.z) * uA.z) > 0.7)) detener = V.enMuelleB(tR);
          { const al = (j.pos.x - p0.x) * uA.x + (j.pos.z - p0.z) * uA.z;   // adentro pero en el borde: se le lleva suave al centro (si no, el balde no parte)
            if (enB && encima && j.estado === 'normal' && Math.abs(al) > 0.4 && Math.abs(al) < 1.2 && Math.hypot(j.vel.x, j.vel.z) < 1) { const pa = Math.min(Math.abs(al) - 0.3, 3 * dt) * (al > 0 ? -1 : 1); j.p.teletransportar(j.pos.x + uA.x * pa, j.pos.y, j.pos.z + uA.z * pa); } }
          if (V.enMuelleA(tR) || tR + dt >= V.TRET - 0.02) {   // llegó al muelle de A: se baja solo al andén con un saltito (como en B)
            detener = true; e.quieto = (e.quieto || 0) + dt;
            if (e.quieto > 0.5 && j.estado === 'normal') {
              const x = A.a.x - uA.x * 3.2, z = A.a.z - uA.z * 3.2;
              j.teletransportar(x, M.fis.suelo(x, z, A.a.y + 8) + 0.15, z);
              V.jinete = null; e.quieto = 0;
            }
          }
          if (!encima && !enB && !V.enMuelleA(tR) && j.estado !== 'normal') V.jinete = null;   // se cayó al barranco: el capacho sigue
        }
      } else if (V && V.jinete === i) V.jinete = null;
      // sube con calma: si Nato está en el borde de atrás (aún no entró del todo), el balde no parte
      const uxA = (A.b.x - A.a.x), uzA = (A.b.z - A.a.z), lA = Math.hypot(uxA, uzA) || 1;
      const alFondo = (j.pos.x - p0.x) * uxA / lA + (j.pos.z - p0.z) * uzA / lA;   // posición de Nato a lo largo del cable, respecto al centro del balde
      // ayuda para subir: si Nato empuja hacia el balde detenido en el andén y la física de la cápsula se traba en la junta andén/piso (contacto cinemático), se le da un empujoncito
      if (u0 < 0.2 && j.estado === 'normal' && alFondo > -2.2 && alFondo < 0.4 && Math.abs((j.pos.x - p0.x) * -uzA / lA + (j.pos.z - p0.z) * uxA / lA) < 1.0 && Math.abs(j.pie - p0.y) < 0.6) {
        const vAl = j.vel.x * uxA / lA + j.vel.z * uzA / lA, mov = e.ultX == null ? 1 : Math.abs(j.pos.x - e.ultX) + Math.abs(j.pos.z - e.ultZ);
        if (vAl > 2 && mov < 0.012) { j.p.teletransportar(j.pos.x + uxA / lA * 0.13, j.pos.y, j.pos.z + uzA / lA * 0.13); }
      }
      // quien se queda en el borde de atrás del balde detenido (la tapa de atrás lo expulsaría al partir) es llevado suavemente hacia el centro
      if (u0 < 0.2 && j.estado === 'normal' && Math.abs(alFondo) > 0.4 && Math.abs(alFondo) < 1.2 && Math.abs((j.pos.x - p0.x) * -uzA / lA + (j.pos.z - p0.z) * uxA / lA) < 1.0 && Math.abs(j.pie - p0.y) < 0.6 && !(j.vel.x * uxA / lA + j.vel.z * uzA / lA > 2)) {
        const paso = Math.min(Math.abs(alFondo) - 0.3, 3 * dt) * (alFondo > 0 ? -1 : 1);
        j.p.teletransportar(j.pos.x + uxA / lA * paso, j.pos.y, j.pos.z + uzA / lA * paso);
      }
      e.ultX = j.pos.x; e.ultZ = j.pos.z;
      const mitadEntrando = u0 > 0.0 && u0 < 0.2 && encima && Math.abs(alFondo) > 0.7;
      if (A.ocupado !== i && !esperaAtras && !mitadEntrando && !detener && !(V && V.espera(e.reloj, i))) {
        let d = dt; if (V && V.jinete === i && tR != null) d = Math.min(dt, Math.max(0, V.TRET - 0.01 - tR));   // con Nato no pasa del muelle de A a la ida
        e.reloj += d;
      }
      e.dbg = { u0: +u0.toFixed(2), oc: A.ocupado, esperaAtras, mitadEntrando, alFondo: +alFondo.toFixed(2), encima };
      const u = V ? V.u(e.reloj, i) : ((e.reloj / A.periodo) + i / A.capachos) % 1;
      // en la punta se detiene un momento para subir y bajar con calma
      const k0 = Math.min(1, Math.max(0, (u - 0.2) / 0.6)), k = k0 * k0 * (3 - 2 * k0);   // arranca y frena suave   // espera ~20 % del ciclo en cada andén para subir y bajar con calma
      let [x, y, z] = enCable(k);
      const tV = V ? V.tRet(e.reloj, i) : null;   // N1-ABASTECIMIENTO-c: en la vuelta la física sigue al balde por el cable paralelo (se puede abordar en B)
      if (tV != null) [x, y, z] = V.pos(tV);
      else if (u > 0.985) y -= 40;   // al final se esconde bajo el andén y vuelve a empezar
      M.fis.moverMovil(pl, x, y, z);
      A.enA[i] = k0 <= 0 && u <= 0.985 && u < 0.3; A.enB[i] = (k0 >= 1 && u <= 0.985) || (tV != null && V.enMuelleB(tV));
      // una pared que sube justo donde está Nato lo catapultaba: si él está encima del lugar de la pared, ésta espera abajo
      // (Nato DENTRO de un balde no cuenta: la zona de la puerta tapa los 0,95 m de atrás del balde y, al partir, lo sacaba hacia el andén)
      const enBalde = () => M.L.de('capacho').some(c => { const q = c.malla.position, dx = j.pos.x - q.x, dz = j.pos.z - q.z; return Math.abs(dx * uA.x + dz * uA.z) < 1.1 && Math.abs(-dx * uA.z + dz * uA.x) < 1.1 && Math.abs(j.pie - q.y) < 0.6; });
      const cerca = (wx, wz, wy = A.a.y) => { const dxw = j.pos.x - wx, dzw = j.pos.z - wz, al = dxw * uA.x + dzw * uA.z, la = -dxw * uA.z + dzw * uA.x; return Math.abs(al) < 0.95 && Math.abs(la) < 1.9 && Math.abs(j.pie - wy) < 3 && !enBalde(); };   // wy: altura de ESE andén (N1-ABASTECIMIENTO-c: en B se medía contra A, 10 m más alto, y la puerta subía bajo Nato)
      // si Nato está encima del lugar de la puerta cuando le toca subir, se lo retira (hacia su andén) en vez de dejarla abierta: abierta = se cae al barranco
      const retira = (wx, wz, sg, wy) => { if (cerca(wx, wz, wy)) j.p.teletransportar(j.pos.x + uA.x * sg * 0.3, j.pos.y, j.pos.z + uA.z * sg * 0.3); };
      if (!A.enA.some(Boolean)) retira(A.a.x - uA.x * 1.15, A.a.z - uA.z * 1.15, -1);
      if (!A.enB.some(Boolean)) retira(A.b.x + uA.x * 1.15, A.b.z + uA.z * 1.15, 1, A.b.y);
      subirG(A.gA, A.a.x - uA.x * 1.15, A.a.y, A.a.z - uA.z * 1.15, !A.enA.some(Boolean) && !cerca(A.a.x - uA.x * 1.15, A.a.z - uA.z * 1.15));
      subirG(A.gB, A.b.x + uA.x * 1.15, A.b.y, A.b.z + uA.z * 1.15, !A.enB.some(Boolean) && !cerca(A.b.x + uA.x * 1.15, A.b.z + uA.z * 1.15, A.b.y));
      const nxu = (A.b.x - A.a.x) / (Math.hypot(A.b.x - A.a.x, A.b.z - A.a.z) || 1), nzu = (A.b.z - A.a.z) / (Math.hypot(A.b.x - A.a.x, A.b.z - A.a.z) || 1);
      const alT = (j.pos.x - x) * nxu + (j.pos.z - z) * nzu, laT = Math.abs(-(j.pos.x - x) * nzu + (j.pos.z - z) * nxu);
      const nadieAtras = !(laT < 1.9 && alT > -1.5 && alT < -0.85 && Math.abs(j.pie - y) < 3);   // Nato justo encima de la tapa de atrás: no sube sobre él
      const visible = u <= 0.985 || tV != null;
      const esperaA = tV != null ? V.enMuelleA(tV) : k0 <= 0.003, enBfin = tV != null ? V.enMuelleB(tV) : k0 >= 0.997;   // detenido en A (se entra por atrás) / detenido en B (se sale por delante)
      M.fis.moverMovil(plT, x, visible && !esperaA && nadieAtras ? y : y - 30, z);
      M.fis.moverMovil(plF, x, visible && !enBfin ? y : y - 30, z);
      if (Math.abs(plF.delta.y) > 3) plF.delta = { x: 0, y: 0, z: 0 };
      if (Math.abs(plT.delta.y) > 3) plT.delta = { x: 0, y: 0, z: 0 };
      if (Math.abs(pl.delta.x) + Math.abs(pl.delta.y) + Math.abs(pl.delta.z) > 3) pl.delta = { x: 0, y: 0, z: 0 };
      // arrastre explícito de Nato: con pasos de física grandes el arrastre por contacto de la cápsula lo dejaba atrás y se caía por la tapa de atrás
      if ((u <= 0.985 || tV != null) && Math.abs(j.pos.x - p0.x) < 1.15 && Math.abs(j.pos.z - p0.z) < 1.1 && j.pie - p0.y > -0.3 && j.pie - p0.y < 1.2 && (Math.abs(x - p0.x) + Math.abs(y - p0.y) + Math.abs(z - p0.z)) < 3 && (Math.abs(x - p0.x) + Math.abs(y - p0.y) + Math.abs(z - p0.z)) > 1e-5 && j.pie - p0.y < 0.6 && Math.abs(j.pos.x - p0.x) < 1.0) {
        j.p.teletransportar(j.pos.x + (x - p0.x), j.pos.y + (y - p0.y), j.pos.z + (z - p0.z));
        pl.delta = { x: 0, y: 0, z: 0 };   // ya lo llevamos: que el controlador no lo sume otra vez
      }
      g.position.set(x, y, z);
      if (V) V.colocar(e, i, u, encima || e.trajo || V.jinete === i);   // carga de la cadena (mineral a la ida, sacos a la vuelta) y avisos a las pilas
    };
  }
}
function tablon(M, L, T) {
  const c = Math.cos(T.rot), sn = Math.sin(T.rot);
  const cx = T.x, cz = T.z, largo = T.largo, incl = 0;
  const y = Math.max(M.fis.suelo(T.x - sn * T.largo / 2, T.z - c * T.largo / 2), M.fis.suelo(T.x + sn * T.largo / 2, T.z + c * T.largo / 2)) + 0.15;
  const pl = M.fis.movil(cx, y, cz, [{ sx: 1.2, sy: 0.2, sz: largo }], { tipo: 'tablon' });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, largo), mat(0x9a7448)); m.castShadow = true; m.rotation.set(-incl, T.rot, 0, 'YXZ'); m.position.set(cx, y, cz);
  pl.cuerpo.setRotation(m.quaternion, true);
  const e = L.agregar({ tipo: 'tablon', vivo: true, malla: m, pl, estado: 'firme', t: 0 });
  e.act = dt => {
    e.t += dt;
    const encima = M.jug.p.sueloCol && pl.cols.some(c => c.handle === M.jug.p.sueloCol.handle);
    if (e.estado === 'firme' && encima) { e.estado = 'cruje'; e.t = 0; M.efecto('crujido'); }
    else if (e.estado === 'cruje') { m.position.x = cx + Math.sin(M.t * 40) * 0.04; if (e.t > DIF().tablon / 60 * 1.5) { e.estado = 'cae'; e.t = 0; } }
    else if (e.estado === 'cae') { m.position.y -= e.t * 9 * dt * 4; M.fis.moverMovil(pl, cx, y - 60, cz); if (e.t > 3) { e.estado = 'firme'; m.position.set(cx, y, cz); M.fis.moverMovil(pl, cx, y, cz); } }
  };
}
function ascensor(M, L, A, sala) {
  if (A.kit) { const e = L.agregar({ tipo: 'ascensor', vivo: true, x: A.x, z: A.z, y: A.y0, sala, t: 0, kit: A }); e.act = A.kit(M, e); return; }   // N4-HOSP2: ascensor del kit (cabina, rejas y máquina en kitHospital.js)
  const pl = M.fis.movil(A.x, A.y0, A.z, [{ sx: 3, sy: 0.3, sz: 3, y: -0.15 }], { tipo: 'ascensor' });
  const m = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 3), mat(0x8a8f96, { metal: 0.6 })); m.position.set(A.x, A.y0 - 0.15, A.z);
  // cabina de reja de fierro que viaja con la plataforma y pozo de fierro de piso a techo (antes solo una losa gris).
  // Rejas al oriente y al sur (contra los muros); al norte y al poniente queda abierto para subir y bajar.
  const mF = mat(0x2e3236, { metal: 0.7, rough: 0.4 }), mB = mat(0xb8962e, { metal: 0.8, rough: 0.3 });
  const barra = (padre, sx, sy, sz, x, y, z, mt = mF) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mt); b.position.set(x, y, z); padre.add(b); };
  for (const dx of [-1.45, 1.45]) for (const dz of [-1.45, 1.45]) barra(m, 0.07, 2.4, 0.07, dx, 1.35, dz);   // parantes de la cabina
  for (const k of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) { barra(m, 0.03, 2.4, 0.03, 1.45, 1.35, k * 0.32); barra(m, 0.03, 2.4, 0.03, k * 0.32, 1.35, -1.45); }   // reja
  for (const y of [1.05, 2.55]) { barra(m, 0.06, 0.06, 2.95, 1.45, y, 0); barra(m, 2.95, 0.06, 0.06, 0, y, -1.45); barra(m, 2.95, 0.06, 0.06, 0, y, 1.45, mB); barra(m, 0.06, 0.06, 2.95, -1.45, y, 0, mB); }   // marcos (pasamanos de bronce)
  barra(m, 3, 0.08, 3, 0, 2.62, 0);   // techo de la cabina
  const pozo = new THREE.Group(), alto = A.y1 + 3.8;
  for (const dx of [-1.6, 1.6]) for (const dz of [-1.6, 1.6]) barra(pozo, 0.1, alto, 0.1, dx, alto / 2, dz);
  for (let k = -5; k <= 5; k++) { barra(pozo, 0.03, alto, 0.03, 1.6, alto / 2, k * 0.3); barra(pozo, 0.03, alto, 0.03, k * 0.3, alto / 2, -1.6); }
  for (const y of [0.05, A.y1 - 0.15, alto - 0.1]) { barra(pozo, 3.3, 0.1, 0.1, 0, y, 1.6); barra(pozo, 3.3, 0.1, 0.1, 0, y, -1.6); barra(pozo, 0.1, 0.1, 3.3, 1.6, y, 0); barra(pozo, 0.1, 0.1, 3.3, -1.6, y, 0); }
  pozo.position.set(A.x, 0, A.z); M.escena.add(pozo);
  const e = L.agregar({ tipo: 'ascensor', vivo: true, malla: m, pl, y: A.y0, estado: 'abajo', t: 0, sala });
  e.act = dt => {
    e.t += dt;
    const j = M.jug;
    const encima = Math.abs(j.pos.x - A.x) < 1.4 && Math.abs(j.pos.z - A.z) < 1.4 && Math.abs(j.pie - e.y) < 0.7 && j.estado !== 'fuera';
    // espera abajo hasta que Nato se sube y parte enseguida; arriba, si queda vacío, vuelve a bajar
    if (e.estado === 'abajo' && encima && e.t > 0.4) { e.estado = 'sube'; e.t = 0; }
    if (e.estado === 'arriba' && (encima ? false : e.t > 3)) { e.estado = 'baja'; e.t = 0; }
    if (e.estado === 'sube') { e.y = Math.min(A.y1, e.y + dt * 1.6); if (e.y >= A.y1) { e.estado = 'arriba'; e.t = 0; } }
    if (e.estado === 'baja') { e.y = Math.max(A.y0, e.y - dt * 1.6); if (e.y <= A.y0) { e.estado = 'abajo'; e.t = 0; } }
    M.fis.moverMovil(pl, A.x, e.y, A.z); m.position.y = e.y - 0.15;
    if (encima && (e.estado === 'sube' || e.estado === 'baja')) { j.p.teletransportar(j.pos.x, e.y + j.p.medio + j.p.radio + 0.04, j.pos.z); j.vel.y = 0; }   // lleva a Nato
  };
}

// ------------------------------------------------------------------ el alud (Nivel 3): una ola de nieve que baja por el cerro
function alud(M, L, s) {
  const ruta = s.ruta.map(([x, z]) => v3(x, altura(x, z), z));
  const largos = [0]; for (let i = 1; i < ruta.length; i++) largos.push(largos[i - 1] + ruta[i].distanceTo(ruta[i - 1]));
  const total = largos[largos.length - 1];
  const enRuta = d => { d = Math.max(0, Math.min(total, d)); let i = 1; while (i < ruta.length - 1 && largos[i] < d) i++; const k = (d - largos[i - 1]) / (largos[i] - largos[i - 1]); return ruta[i - 1].clone().lerp(ruta[i], k); };
  const proy = p => { let mejor = 0, md = 1e9; for (let d = 0; d <= total; d += 2) { const q = enRuta(d), dd = Math.hypot(q.x - p.x, q.z - p.z); if (dd < md) { md = dd; mejor = d; } } return mejor; };
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat(0xf6f8fc, { rough: 0.9 })); m.scale.set(14, 6, 6); m.visible = false;
  const e = L.agregar({ tipo: 'alud', vivo: true, malla: m, estado: 'espera', d: -18, t: 0 });
  e.act = dt => {
    const j = M.jug;
    if (e.estado === 'espera') { if (Math.hypot(j.pos.x - s.inicio[0], j.pos.z - s.inicio[1]) < 10) { e.estado = 'baja'; e.d = -20; m.visible = true; M.aviso('¡EL ALUD! ¡Corre hacia el hospital!', 3000); M.efecto('alud'); M.sacudir(0.5); } return; }
    if (e.estado !== 'baja') return;
    e.d += 4.8 * DIF().alud * dt;   // en Normal ~5,7 m/s: Nato (7 m/s) le gana si no se detiene
    const p = enRuta(e.d), adelante = enRuta(e.d + 2); m.position.set(p.x, p.y + 2, p.z); m.rotation.y = Math.atan2(adelante.x - p.x, adelante.z - p.z) + Math.PI / 2;
    const dj = proy(j.pos);
    if (dj >= total - 3) { e.estado = 'fin'; m.visible = false; M.aviso('¡A salvo!'); return; }
    if (dj - e.d < 2.5 && j.estado !== 'fuera') {   // la nieve lo alcanza: pierde un corazón y sale lanzado adelante
      if (danar(j, 'alud')) { const q = enRuta(dj + 6); j.vel.set(q.x - j.pos.x, 9, q.z - j.pos.z); }
      else if (j.invul <= 0) j.vel.y = 6;
      e.d = dj - 6;
    }
    M.sacudir(0.05);
  };
  return e;
}

// ------------------------------------------------------------------ jefe de los mineros (Nivel 3)
function jefe(M, L, s) {
  const J = { estado: 'espera', ataques: 0, llamo: false };
  let ent;
  J.golpe = (e, tipo, desde) => {
    if (!e.pelea) return;
    const aturdido = e.estado === 'aturdido';
    const fuerte = tipo !== 'golpe';   // de frente solo duelen los golpes fuertes; aturdido, todo duele más
    if (!fuerte && !aturdido) { M.rotulo('¡Ni lo siente!'); return; }
    J.danar(e, aturdido ? 2 : 1);
  };
  J.danar = (e, n) => {
    e.hp -= n; e.destello = 0.2; sumarEnergia(10); M.efecto('golpeFuerte'); M.estrellitas(e.pos);
    if (e.hp <= 0 && e.estado !== 'ko') { e.estado = 'ko'; e.t = 0; e.pelea = false; noqueo('jefe', 3000); M.rendicionJefe(e); }
  };
  ent = minero(M, L, s, { escala: escalaPersona('jefe'), colores: COL.jefe, hp: DIF().jefe, tipo: 'jefe', jefe: J });
  ent.golpeHercules = () => { J.danar(ent, 4); if (ent.estado !== 'ko') { ent.estado = 'aturdido'; ent.t = 0; } };
  J.act = (e, dt, d) => {
    const j = M.jug, g = e.malla;
    if (e.estado === 'patrulla' || e.estado === 'persigue') e.estado = J.estado === 'espera' ? 'espera' : 'elige';
    switch (e.estado) {
      case 'espera': if (d < 15 && M.mismaSala(e)) { e.estado = 'presenta'; e.t = 0; UI.burbuja('<b>Jefe de los mineros:</b> ¿Buscas a tu padre? Solo yo sé dónde está el nido. ¡Tendrás que ganarme!'); M.peleaJefe(true); } return true;
      case 'presenta': if (e.t > 3.5) { UI.burbuja(null); e.estado = 'elige'; e.pelea = true; J.estado = 'pelea'; if (j.p.enSuelo && j.estado === 'normal') M.puntoControl({ x: j.pos.x, y: j.pie, z: j.pos.z, sala: null }); } return true;   // N3-X2: si pierde una vida, vuelve a la cornisa (antes reaparecía en la última fogata, abajo en la ciudad, y había que cruzar el hospital otra vez)
      case 'elige': {
        g.rotation.y = Math.atan2(j.pos.x - g.position.x, j.pos.z - g.position.z);
        if (!J.llamo && e.hp <= DIF().jefe / 2) { J.llamo = true; for (let i = 0; i < (DIF().nombre === 'Fácil' ? 1 : 2); i++) minero(M, L, { x: g.position.x + (i ? 6 : -6), z: g.position.z + 4, y: g.position.y }); UI.burbuja('<b>Jefe:</b> ¡Muchachos, ayúdenme!'); setTimeout(() => UI.burbuja(null), 2500); }
        if (e.t > 1) { e.estado = d < 4 ? 'puño' : 'escarba'; e.t = 0; if (e.estado === 'puño') M.alerta(g.position, 3, e); }
        return true;
      }
      case 'puño':   // puñetazo lento que se anuncia con «!»
        if (e.t > 0.9 && e.t < 1.1 && d < 3.2 && Math.abs(j.pie - g.position.y) < 2) { if (danar(j, 'jefe')) golpeSeguro(M, j, g.position, 9); }
        g.userData.brazo.rotation.x = e.t > 0.8 ? -1.6 : 0.3;
        if (e.t > 1.5) { e.estado = 'elige'; e.t = 0; }
        return true;
      case 'escarba': if (e.anim && e.t >= 0.52 && e.t - dt < 0.52) { M.sacudir(0.3); M.efecto('golpeFuerte'); }   // G-A8: el pisotón cae a los 0,52 s de la animación
        if (e.t > 1.0) { e.estado = 'embiste'; e.t = 0; e.dir = v3(j.pos.x - g.position.x, 0, j.pos.z - g.position.z).normalize(); } return true;
      case 'embiste': {   // cabeza gacha; se le puede saltar por encima; al chocar queda aturdido
        const nx = g.position.x + e.dir.x * 11 * dt, nz = g.position.z + e.dir.z * 11 * dt;
        const h = M.fis.rayo({ x: nx + e.dir.x * 1.5, y: g.position.y + 1.5, z: nz + e.dir.z * 1.5 }, { x: 0, y: -1, z: 0 }, 4);
        if (!h || Math.abs(h.punto.y - g.position.y) > 0.8 || e.t > 1.4) { e.estado = 'aturdido'; e.t = -1; M.estrellitas(g.position); M.sacudir(0.3); return true; }
        g.position.set(nx, h.punto.y, nz);
        if (dist2(j.pos, g.position) < 1.6 && j.pie < g.position.y + 1.5) { if (danar(j, 'jefe')) golpeSeguro(M, j, g.position, 10); }
        return true;
      }
      case 'aturdido': g.rotation.y += e.anim ? Math.sin(e.t * 2.2) * dt * 0.8 : dt * 5; if (e.t > 2) { e.estado = 'elige'; e.t = 0; } return true;   // G-A8: con esqueleto se tambalea (animación «aturdido») en vez de girar como trompo
      case 'ko': return true;
    }
    return false;
  };
  return ent;
}

// ------------------------------------------------------------------ cóndor gigante (Nivel 4)
function condorJefe(M, L, s) {
  const J = { ataques: 0, llamo: false };
  const hp = DIF().condorJefe;
  const yNido = (s.y ?? M.fis.suelo(s.x, s.z));
  let e;
  J.golpe = (c, desde, n) => {
    if (!c.pelea || M.t - (c.tGolpe ?? -9) < 0.9) return;   // N4-X1: un golpe por embestida (antes un combo le quitaba 4-5 de vida de una vez)
    c.tGolpe = M.t;
    c.hp -= (c.estado === 'descansa' ? 2 : 1) * n; c.malla.rotation.x = 0; M.plumas(c.pos); M.efecto('golpeFuerte'); sumarEnergia(10);
    if (c.hp <= 0) { c.estado = 'derrotado'; c.t = 0; c.pelea = false; noqueo('condor', 5000); c.sombra.visible = false; M.condorDerrotado(c); return; }
    c.estado = 'sube'; c.t = 0; c.sombra.visible = false;
  };
  J.act = (c, dt) => {
    const j = M.jug, g = c.malla;
    const sobre = v3(s.x, yNido + 9, s.z - 6);
    switch (c.estado) {
      case 'vuela':
        if (!c.pelea) { g.position.lerp(sobre, 1 - Math.exp(-dt)); if (dist2(j.pos, sobre) < 22 && Math.abs(j.pie - yNido) < 8) { c.estado = 'presenta'; c.t = 0; M.efecto('chillido'); M.aviso('¡EL CÓNDOR GIGANTE!', 2500); M.peleaJefe(true); } return true; }
        g.position.lerp(sobre, 1 - Math.exp(-dt * 2));
        if (c.t > 1.4) {
          J.ataques++;
          if (!J.llamo && c.hp <= hp / 2) { J.llamo = true; condor(M, L, { x: s.x - 8, z: s.z, y: yNido, alto: 8 }); condor(M, L, { x: s.x + 8, z: s.z, y: yNido, alto: 9 }); }
          if (J.ataques % 4 === 0) { c.estado = 'descansa'; c.t = 0; }
          else if (J.ataques % 3 === 0) { c.estado = 'aleteo'; c.t = 0; }
          else { c.estado = 'aviso'; c.t = 0; M.efecto('chillido'); }
        }
        return true;
      case 'presenta': g.position.lerp(sobre, 1 - Math.exp(-dt * 2)); g.rotation.y = M.t; if (c.t > 2.5) { c.estado = 'vuela'; c.t = 0; c.pelea = true; } return true;
      case 'aleteo': {   // levanta viento que empuja a Nato hacia la orilla
        const d = v3(j.pos.x - g.position.x, 0, j.pos.z - g.position.z).normalize();
        if (j.p.enSuelo || true) { j.vel.x += d.x * 14 * dt; j.vel.z += d.z * 14 * dt; }
        if (c.t > 2.2) { c.estado = 'vuela'; c.t = 0; }
        return true;
      }
      case 'descansa':   // se posa junto al nido a jadear: posado, las patadas le quitan el doble
        g.position.lerp(v3(s.x + 4, yNido + 1.2, s.z - 2), 1 - Math.exp(-dt * 3));
        if (c.t > 3.6) { c.estado = 'vuela'; c.t = 0; }
        return true;
      case 'clavado': {   // N4-X1: pico enterrado junto a Nato ~1,6 s (2,2 en Fácil): aletea para soltarse; golpes y patadas le pegan
        if (!J.avisoClavado) { J.avisoClavado = true; M.aviso('¡Clavó el pico! ¡Pégale ahora!', 2200); }
        g.rotation.x = 0.55 + Math.sin(c.t * 18) * 0.08;
        if (c.t > (DIF().vidas >= 5 ? 2.2 : 1.6)) { c.estado = 'sube'; c.t = 0; g.rotation.x = 0; }
        return true;
      }
      case 'sube': g.position.lerp(sobre, 1 - Math.exp(-dt * 2)); if (c.t > 1.2) { c.estado = 'vuela'; c.t = 0; } return true;
      case 'derrotado': g.position.add(v3(-8 * dt, 5 * dt, -10 * dt)); if (c.t > 5) L.quitar(c); return true;
      case 'agarra': c.estado = 'sube'; return true;
    }
    return false;   // aviso y picada: como un cóndor chico (sin agarrar)
  };
  e = condor(M, L, { ...s, y: yNido, alto: 9 }, { escala: 2.4, tipo: 'condorJefe', jefe: J, hp, noAgarra: true });
  e.hp = hp; e.pelea = false;
  return e;
}

// N1-C68/C69: la malla de TRELLIS del tren llega después (GLTF asíncrono). Estas ayudas la parten con planos de recorte
// (renderer.localClippingEnabled) cuando ya cargó: cada parte lleva materiales propios con sus planos (en coordenadas de mundo).
const mallaCargada = raiz => { let n = 0; raiz.traverse(o => { if (o.isMesh) n++; }); return n > 0; };
function recortar(raiz, planos) {
  raiz.traverse(o => { if (!o.isMesh) return; const ms = (Array.isArray(o.material) ? o.material : [o.material]).map(m => { const c = m.clone(); c.clippingPlanes = planos; c.clipShadows = true; return c; }); o.material = ms.length === 1 ? ms[0] : ms; });
  const r = globalThis.JUEGO?.render?.renderer; if (r) r.localClippingEnabled = true;
}
// ------------------------------------------------------------------ el tren: siempre la misma locomotora negra a vapor de la serie
// domo de bronce, un farol, defensa roja y sin cara; ténder y hasta 4 carros planos; la gente va solo sobre la carga de los carros.
export function crearTren(M, L, x, z, op = {}) {
  const g = new THREE.Group(), y = 0.38;   // ruedas sobre el riel (cara de arriba a 0,375): con 0,9 los carros iban medio metro en el aire
  const loco = new THREE.Group();
  const caldera = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 6, 16), mat(0x141418, { metal: 0.6, rough: 0.35 })); caldera.rotation.z = Math.PI / 2; caldera.position.set(0, 1.9, 0); loco.add(caldera);
  const cabina = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 2.8), mat(0x141418, { metal: 0.5 })); cabina.position.set(-3.6, 2.2, 0); loco.add(cabina);
  const domo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc08a3a, { metal: 0.9, rough: 0.3 })); domo.position.set(0, 3.0, 0); loco.add(domo);
  const chimenea = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 1.4, 10), mat(0x141418)); chimenea.position.set(2.2, 3.4, 0); loco.add(chimenea);
  const farol = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 10), mat(0xfff0b0, { emisivo: 0xffe080, brillo: 2 })); farol.rotation.z = Math.PI / 2; farol.position.set(3.2, 2.6, 0); loco.add(farol);
  const defensa = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 2.6), mat(0xc0221e)); defensa.position.set(3.3, 0.8, 0); loco.add(defensa);
  const ruedas = [];
  for (const rx of [-2, 0, 2]) for (const rz of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 14), mat(0x2a2a2e, { metal: 0.6 })); r.rotation.x = Math.PI / 2; r.position.set(rx, 0.75, rz * 1.1); loco.add(r); ruedas.push(r); }
  loco.position.x = 0; g.add(loco);
  const tender = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 2.6), mat(0x1a1a1e)); tender.position.set(-7.4, 1.5, 0); g.add(tender);
  // con modelos de Idol: la locomotora con su ténder y los carros planos reemplazan las piezas geométricas (la física sigue igual)
  const ST = M.splatTren || {};
  // N1-C68: la locomotora de Idol venía girada ~3,8° respecto de su caja (de frente a cola el eje se corría 0,8 m de lado: las ruedas
  // de adelante caían fuera del riel de la estación y las de atrás fuera del otro); YAW_LOCO la endereza sobre la vía
  const YAW_LOCO = -0.066, pend = [];   // pend: [grupo, función] para cuando la malla asíncrona ya cargó
  let vLoco = null;
  if (ST.loco) { loco.visible = false; tender.visible = false; const v = vehiculoSplat(ST.loco, 15.6, (ST.yawLoco || 0) + YAW_LOCO, 2.6, 4.6, true); v.position.set(-4.6, -0.05, 0); g.add(v); vLoco = v; }   // más larga: con 13,2 m quedaba un hueco de ~5 m hasta el primer carro
  const carros = [], cajas = [{ sx: 12.6, sy: 2.2, sz: 2.6, x: -3.6, y: 1.5 }];
  if (ST.loco) cajas.push({ sx: 11, sy: 1.3, sz: 2.2, x: -3.2, y: 3.25 });   // N1-C40: la locomotora de Idol mide 4,6 m: sin esta caja la cámara del final pasaba sobre la de 3 m y quedaba dentro de la caldera
  // N1-C57: separación real entre la locomotora (con su ténder) y los carros: ~0,9 m de luz con un enganche visible (barra oscura)
  // y una tabla invisible encima para que Nato no caiga entre carros. Locomotora de Idol (nube o ?malla=1): caja de 15,6 m centrada
  // en -4,6 → cola en -12,4; carro de Idol 9,2 m (geométrico 8,8). Antes: cx = -15 - i * 9,4 → el primer carro entraba 2 m en el ténder.
  // La nube de Idol de la locomotora no llena su caja por atrás (puntos sueltos adelante): su ténder termina ~2,5 m antes, en ~-9,9 (medido desde arriba);
  // igual que el ténder geométrico; con ?malla=1 la malla llena la caja y la cola queda en -12,4.
  // N1-C69: el ténder de la malla de Idol (x -9,1..-12,5) salía alto y corto (2,3 m de caja sobre 3,4 m de largo, techo a 2,9 m)
  // y sus ruedas flotaban 9 cm sobre el riel. Con malla se corta en la cabina: la caja se alarga a TEN_L m y se baja (TEN_SY), las
  // ruedas del modelo (un solo bogie adelante) van tal cual, bajadas al riel, y se repiten atrás; arriba, un cerro de carbón.
  const TEN_X = -9.1, TEN_L0 = 3.4, TEN_L = 5.0, TEN_YB = 0.57, TEN_SY = 0.77, TEN_BAJA = -0.095, planosX = [];
  const conTender = !!(vLoco && mallaMovil(ST.loco));   // malla del tren SIEMPRE (como el capacho), salvo ?gaussianas: el arreglo vale en N1 y en el final del N4
  const LUZ = 0.9, medio = ST.carro ? 4.6 : 4.4, colaLoco = ST.loco ? (mallaMovil(ST.loco) ? TEN_X - TEN_L : -9.9) : -9.4, paso = 2 * medio + LUZ;
  if (conTender) {
    cajas.push({ sx: TEN_L - 0.8, sy: 2.0, sz: 1.7, x: TEN_X - 0.8 - (TEN_L - 0.8) / 2, y: 1.25 });   // el ténder alargado también se pisa
    const px = (xl, signo) => { const p = new THREE.Plane(new THREE.Vector3(signo, 0, 0), 0); planosX.push([p, xl]); return p; };
    const py = (yl, signo) => new THREE.Plane(new THREE.Vector3(0, signo, 0), -signo * (y + yl));
    const pivote = (obj, x0, y0, sx, sy, dx, dy) => { const w = new THREE.Group(), i = new THREE.Group(); w.position.set(x0 + dx, y0 + dy, 0); w.scale.set(sx, sy, 1); i.position.set(-x0, -y0, 0); i.add(obj); w.add(i); g.add(w); };
    const yAlto = TEN_YB + TEN_BAJA;   // borde de abajo de la caja del ténder (sobre el bastidor rojo)
    pend.push([vLoco, () => {
      const caja = vLoco.clone(true), bog1 = vLoco.clone(true), bog2 = vLoco.clone(true), sx = TEN_L / TEN_L0;
      recortar(vLoco, [px(TEN_X, 1)]);   // la locomotora termina en la cabina
      recortar(caja, [px(TEN_X, -1), py(yAlto, 1)]); pivote(caja, TEN_X, TEN_YB, sx, TEN_SY, 0, TEN_BAJA);
      // bogie del modelo (2,2 m bajo el frente del ténder) adelante, y una copia atrás
      recortar(bog1, [px(TEN_X - 0.2, -1), px(TEN_X - 2.4, 1), py(yAlto, -1)]); pivote(bog1, 0, 0, 1, 1, -0.2, TEN_BAJA);
      const d2 = -(TEN_L - 2.2 - 0.2);
      recortar(bog2, [px(TEN_X + d2, -1), px(TEN_X - 2.2 + d2, 1), py(yAlto, -1)]); pivote(bog2, 0, 0, 1, 1, d2, TEN_BAJA);
      e.planos?.();
      // carbón: cerro de terrones oscuros sobre la caja (el modelo traía la tapa lisa)
      const tope = TEN_YB + TEN_BAJA + (2.9 - TEN_YB) * TEN_SY, geo = new THREE.IcosahedronGeometry(1, 3), pa = geo.attributes.position, q = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) { q.fromBufferAttribute(pa, i); const r = 1 + 0.12 * Math.sin(q.x * 9.1 + q.z * 5.3) * Math.sin(q.y * 7.7 + q.x * 3.1) + 0.06 * Math.sin(q.z * 17 + q.x * 13); q.multiplyScalar(r); if (q.y < 0) q.y *= 0.2; pa.setXYZ(i, q.x, q.y, q.z); }
      geo.computeVertexNormals();
      const carbon = new THREE.Mesh(geo, mat(0x1b1a1a, { rough: 0.9, metal: 0.15 })); carbon.scale.set(TEN_L * 0.36, 0.42, 0.66); carbon.position.set(TEN_X - TEN_L * 0.45, tope - 0.12, 0); carbon.castShadow = true; g.add(carbon);
      // REV (16-11, revisor de mallas): encima, tres montones de la malla aprobada `carbon` (terrones de 1,2 × 0,5 × 1 m) y el cerro baja a base
      { const pu = precargarUtileria(); if (pu) pu.then(() => { if (!hayPieza('carbon')) return; carbon.scale.y = 0.22;
        for (let i = 0; i < 3; i++) { const c = piezaGrupo('carbon', [1.15, 1.1, 1.2]); c.position.set(TEN_X - 0.75 - i * 1.25, tope - 0.1, (i - 1) * 0.06); c.rotation.y = i * 2.1; c.children[0].castShadow = true; g.add(c); } }); }
    }]);
  }
  const yPiso = ST.carro ? 1.5 : 2.55, matEng = mat(0x1c1c1f, { metal: 0.6, rough: 0.5 });
  for (let i = 0; i < (op.carros || 3); i++) {
    const cx = colaLoco - LUZ - medio - i * paso;
    {   // enganche entre la pieza de adelante y este carro: barra con dos mordazas
      const xe = cx + medio + LUZ / 2;
      const barra = new THREE.Mesh(new THREE.BoxGeometry(LUZ + 0.6, 0.14, 0.14), matEng); barra.position.set(xe, 0.95, 0); g.add(barra);
      for (const sx of [-1, 1]) { const mo = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.3), matEng); mo.position.set(xe + sx * (LUZ / 2 - 0.05), 0.95, 0); g.add(mo); }
      cajas.push({ sx: LUZ + 0.4, sy: 0.1, sz: 1.6, x: xe, y: yPiso - 0.05 });
    }
    const c = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.5, 2.8), mat(0x6b4a2a)); c.position.set(cx, 1.3, 0); g.add(c);
    const carga = new THREE.Mesh(new THREE.BoxGeometry(7, 0.9, 2.4), mat(0x9a7a50)); carga.position.set(cx, 2, 0); g.add(carga);
    if (ST.carro) {
      c.visible = false; carga.visible = false; const v = vehiculoSplat(ST.carro, 9.2, ST.yawCarro || 0, 2.7, 0, true); v.position.set(cx, -0.005, 0); g.add(v);   // -0,005: la llanta (0,045 m bajo el borde) queda SOBRE el riel (0,375)
      // N1-C68: el carro de Idol trae las ruedas por fuera del costado (|z| 1,0-1,2 m) y la trocha es ±0,6: con malla se parte en
      // la plataforma (arriba de 1,28 m sobre el riel, tal cual) y el tren de ruedas (abajo), angostado a lo ancho para que cada
      // rueda vaya sobre su riel. La nube de gaussianas no se puede recortar: queda como estaba.
      if (mallaMovil(ST.carro)) pend.push([v, () => {
        const yc = y + 1.28, baja = v.clone(true), env = new THREE.Group();
        recortar(v, [new THREE.Plane(new THREE.Vector3(0, 1, 0), -yc)]); recortar(baja, [new THREE.Plane(new THREE.Vector3(0, -1, 0), yc)]);
        env.scale.z = 0.6 / 1.1; env.add(baja); g.add(env);
      }]);
    }
    carros.push(cx); cajas.push(ST.carro ? { sx: 8.8, sy: 0.8, sz: 2.7, x: cx, y: 1.1 } : { sx: 8.8, sy: 1.6, sz: 2.8, x: cx, y: 1.75 });   // con el carro de Idol la plataforma está a 1,5 m
    // familias sentadas sobre la carga
    // familias de pie sobre la carga, con los modelos de Idol (antes muñecos de bloques aplastados para parecer sentados)
    for (let k = 0; k < (i === (op.carros || 3) - 1 && op.pedro ? 1 : 2); k++) { const n = (i + k) % 3; const p = mallaPersona([COL.vecina, COL.minero, COL.anciana][n], escalaPersona(['mujer', 'hombre', 'anciana'][n]), ['p_vecina', 'p_minero', 'p_anciana'][n], { malla: true });   /* G-PERS: pasajeros con malla (también el minero) */ p.position.set(cx + (ST.carro ? (k ? 0.9 : -1.1) : -2.5 + k * 2.2), ST.carro ? 1.5 : 2.45, ST.carro ? (k ? -0.55 : 0.55) : 0.6); p.rotation.y = Math.PI / 2 + (k ? 0.5 : -0.4); g.add(p); }   // con el carro de Idol: en el centro libre, sin atravesar la carga
    if (op.pedro && i === (op.carros || 3) - 1) { const p = mallaPersona(COL.pedro, escalaPersona('pedro'), 'p_pedro'); p.position.set(cx + (ST.carro ? 0.6 : 1.5), ST.carro ? 1.5 : 2.45, ST.carro ? -0.5 : -0.4); p.rotation.y = Math.PI / 2; g.add(p); }
  }
  // ruedas que giran: la nube/malla de Idol trae las ruedas pintadas y no se pueden girar, así que van ruedas propias con rayos
  // por fuera de cada costado (locomotora: 3 motrices grandes; carros: 2 por lado)
  const ruedasVis = [];
  // (N1-C50: se sacaron las ruedas rojas propias: flotaban delante de la locomotora y no calzaban con las ruedas pintadas del modelo)
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, y, z);
  if (pend.length) { const t0 = performance.now(), aplicar = () => { for (let i = pend.length - 1; i >= 0; i--) if (mallaCargada(pend[i][0])) { pend[i][1](); pend.splice(i, 1); } };
    aplicar();   // N1-C72: con la malla precargada ya está lista al crear el tren; sin esto los carros salían 0,2 s con las ruedas sin angostar
    if (pend.length) { const iv = setInterval(() => {   // aplica los recortes apenas carga cada malla (máx. 2 min)
      aplicar();
      if (!pend.length || performance.now() - t0 > 120000) clearInterval(iv);
    }, 40); } }
  const pl = M.fis.movil(x, y, z, cajas, { tipo: 'tren' });
  const e = L.agregar({ tipo: 'tren', vivo: true, malla: g, pl, x, v: 0, ruedas, carros });
  e.listo = () => !pend.length;   // N1-TREN: false mientras algún carro espera su malla para angostar las ruedas (la sonda del auditor no mide a medio cargar)
  // humo de la chimenea (N1-C40): vapor de carbón en BOCANADAS al ritmo del pistón («chuf»): cada bocanada son 2-3 copos de
  // textura algodonosa e irregular (no un disco radial), que salen rápido hacia arriba, frenan, crecen mucho al principio y
  // luego despacio, se aclaran de gris carbón a blanco vapor, se deshilachan y el viento del valle se los lleva (hacia +Z y atrás).
  // Detenido: un hilo flojo y lento. Cerca de la cámara se desvanecen (antes una bocanada le tapaba la vista entera).
  const humo = [], chim = ST.loco ? [1.2, 4.55] : [2.2, 4.0], VIENTO = [-0.35, 0.75], cOsc = new THREE.Color(0x5e5a56), cVap = new THREE.Color(0xe4e0da);
  let tHumo = 0, fase = 0;
  e.vapor = (dt, vel) => {
    tHumo -= dt;
    if (tHumo <= 0 && g.parent) {
      const marcha = vel > 1;
      tHumo = marcha ? Math.max(0.14, 0.5 - vel * 0.04) : 0.32 + Math.random() * 0.2;   // ritmo del «chuf»: más seguido con más velocidad
      const n = marcha ? 3 + (fase++ % 2) : 1;
      for (let k = 0; k < n; k++) {
        const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHumo(), color: marcha ? cOsc : cVap, transparent: true, opacity: 0, depthWrite: false, fog: true }));
        b.position.set(e.x + chim[0] + (Math.random() - 0.5) * 0.25, y + chim[1] + k * 0.25, z + (Math.random() - 0.5) * 0.25); b.material.rotation = Math.random() * 6.28;
        const s0 = (marcha ? 0.55 : 0.4) * (0.8 + Math.random() * 0.4);
        b.scale.setScalar(s0);
        b.userData = { t: 0, s0, sube: marcha ? 2.4 + Math.random() * 0.9 : 1.3 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.7, vz: (Math.random() - 0.5) * 0.7,
          op: marcha ? 0.8 + Math.random() * 0.15 : 0.5, vida: marcha ? 5 + Math.random() * 2 : 4.5 + Math.random() * 1.5, crece: marcha ? 3 + Math.random() * 1.4 : 2, gira: (Math.random() - 0.5) * 0.5, osc: marcha };
        g.parent.add(b); humo.push(b);
      }
    }
    const cam = M.cam?.cam;
    for (let i = humo.length - 1; i >= 0; i--) {
      const b = humo[i], u = b.userData; u.t += dt;
      const f = u.t / u.vida, viento = Math.min(1, u.t / 1.2);   // el viento toma la bocanada cuando deja de subir
      b.position.x += (u.vx + VIENTO[0] * viento) * dt; b.position.z += (u.vz + VIENTO[1] * viento) * dt;
      b.position.y += (u.sube * Math.exp(-u.t * 1.3) + 0.25) * dt;
      b.scale.setScalar(u.s0 + u.crece * (1 - Math.exp(-u.t * 1.1)) + u.t * 0.35); b.material.rotation += u.gira * dt;
      if (u.osc) b.material.color.copy(cOsc).lerp(cVap, Math.min(1, u.t / 1.6));   // carbón al salir, vapor claro al abrirse
      let op = u.op * Math.min(1, u.t / 0.1) * Math.max(0, 1 - f) ** 1.6;   // aparece de golpe y se deshace
      if (cam) { const dc = b.position.distanceTo(cam.position) - b.scale.x * 0.5; if (dc < 3) op *= Math.max(0, dc / 3); }
      b.material.opacity = op;
      if (f >= 1) { b.parent?.remove(b); b.material.dispose(); humo.splice(i, 1); }
    }
  };
  e.planos = () => { for (const [p, xl] of planosX) p.constant = -p.normal.x * (g.position.x + xl); };   // N1-C69: los cortes del ténder viajan con el tren
  e.mover = (nx, dt) => { const dx = nx - e.x; e.x = nx; g.position.x = nx; e.planos(); M.fis.moverMovil(pl, nx, y, z); for (const r of ruedas) r.rotation.y -= dx / 0.75; for (const r of ruedasVis) r.rotation.z -= dx / r.userData.radio; if (dt > 0) e.vapor(dt, Math.abs(dx) / dt); };
  return e;
}
function tren(M, L, s) {
  const e = crearTren(M, L, s.x, s.z, { pedro: true, carros: 3 });
  e.final = true; e.estado = 'espera';
  e.act = dt => {
    const j = M.jug;
    if (e.estado === 'espera') {
      if (j.p.sueloCol && e.pl.cols.some(c => c.handle === j.p.sueloCol.handle) && M.listo1981) {
        e.estado = 'parte'; M.trenParte(e);
        // N4-C16: boca del túnel por delante (tapón más cercano adelante): ahí empieza la toma fija del final
        if (M.hercules) { M.hercules.estado = 'final'; M.hercules.gesto?.('sentado', 120); }   // viaja sentado en el carro junto a Nato (antes corría detrás, en el aire)
        e.xTunel = Math.min(...(M.R.tapones || []).map(t => t.pos.x).filter(tx => tx > e.x + 5), 1e9);
        for (const t of M.R.tapones || []) M.fis.quitarMovil(t);   // el tren entra al túnel: se abren las bocas
        if (M.R.tapones) M.R.tapones.length = 0;
      }
    } else if (e.estado === 'parte') {
      e.v = Math.min(e.v + dt * 1.2, 7 * DIF().tren); e.mover(e.x + e.v * dt, dt);
      const H = M.hercules; if (H && H.estado === 'final' && j.p.enSuelo) { H.malla.position.set(j.pos.x - 1.1, j.pie - 0.02, s.z - 0.7); H.malla.rotation.y = Math.PI / 2; H.posAct?.copy(H.malla.position); H.posAnt?.copy(H.malla.position); }
      // si Nato se cae o se queda en la vía, vuelve al último carro y pierde un corazón
      if (j.estado === 'normal' && (Math.abs(j.pos.z - s.z) > 6 || j.pos.x < e.x - 50 || j.pie < -3)) M.volverAlCarro(e);
      // N4-C16: antes de que Nato llegue a la boca del túnel, Nato y Hércules quedan PEGADOS al carro (con el estado 'quieto' del
      // cierre, la plataforma ya no lo llevaba y quedaba atrás) y la cámara corta a una toma fija sobre la vía, fuera del cerro,
      // mirando cómo el tren se mete al túnel (antes la cámara de seguir atravesaba el cerro: media pantalla negra)
      if (j.pos.x > e.xTunel - 14 || e.x > 640) {
        e.estado = 'tunel'; e.pega = { j: [j.pos.x - e.x, j.pie + 0.02, j.pos.z], h: M.hercules ? M.hercules.malla.position.x - e.x : null };
        const xc = Math.min(e.xTunel, e.x + 60) - 34, G = globalThis.JUEGO; if (G) { const toma = G.camLibre = { pos: [xc, 5.5, s.z + 0.5], mira: [xc + 34, 2.2, s.z] }; setTimeout(() => { if (G.camLibre === toma) G.camLibre = null; }, 6000); }   // se suelta después del fundido
        M.finTren();
      }
    } else if (e.estado === 'tunel') {
      e.v = Math.min(e.v + dt * 1.2, 7 * DIF().tren); e.mover(e.x + e.v * dt, dt);
      M.jug.teletransportar(e.x + e.pega.j[0], e.pega.j[1], e.pega.j[2]);
      const H = M.hercules; if (H && e.pega.h != null) { H.malla.position.x = e.x + e.pega.h; H.posAct?.copy(H.malla.position); H.posAnt?.copy(H.malla.position); }
    }
  };
  return e;
}
