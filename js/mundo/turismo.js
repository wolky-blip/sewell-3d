// M-TUR (carril turismo, 14-11-2026): MODO TURÍSTICO. Pedido de Diego: «agrega un modo Turístico, con foco en recorrer la
// ciudad, hablar de la historia con los NPC, leer carteles e ingresar a conocer edificios emblemáticos y artefactos curiosos».
// El mundo de cada nivel tal cual (una época por nivel), sin enemigos, sin daño, sin pepitas, sin bolas, sin reloj ni meta.
// Datos en js/datos/turismo.js. Ganchos en js/principal.js (menú, ?modo=turista&nivel=N, crearMundo y limpiarMundo).
//   Carteles azules (ficha al acercarse, E: leerla entera), letrero «ENTRADA» sobre las puertas visitables, NPC guía y vecinos
//   (E: hablar, un relato por vez sin repetir), plano (Tab) con los puntos y su estado, pasaporte (B) persistente en
//   localStorage, «caminar hasta» (faro de luz + flecha) o «saltar» a un punto ya visitado (irLugar.js).
// Pruebas: window.JUEGO.M.tur (puntos, npcs, hablar(), saltar()); ?turismoNuevo=1 borra el pasaporte al cargar.
import * as THREE from 'three';
import { altura } from './terreno.js';
import { irALugar, lugaresDelNivel, buscarLugar } from './irLugar.js';
import { crearEntidad } from '../juego/entidades.js';
import { UI } from '../ui/hud.js';
import { E } from '../motor/entrada.js';
import { P } from '../juego/logica.js';
import { SALAS } from '../datos/niveles.js';
import { RELIQUIAS } from '../datos/vida.js';
import { EPOCAS, PUNTOS, NPCS, RECORRIDO, SIN_TURISMO } from '../datos/turismo.js';

const $ = id => document.getElementById(id);
const CLAVE = 'turismo3d';
const R_FICHA = 7, R_HABLAR = 3.2, R_LEER = 3.5, R_CED = 1.7;   // R_CED: cédulas de las piezas del museo (N2-ESCUELA2)

// ------------------------------------------------------------------ pasaporte persistente (localStorage protegido)
function leerPas() { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; } }
function guardarPas(d) { try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (e) { /* sin almacenamiento: el pasaporte vive solo en esta partida */ } }
function pasEpoca(T) { const d = T.pas[T.n] ||= {}; d.vis ||= {}; d.int ||= {}; d.cur ||= {}; d.hab ||= {}; return d; }

// ------------------------------------------------------------------ definición del nivel en modo turístico
export function defTurismo(def) {
  const n = def.numero, salas = new Set(def.salas || []);
  for (const e of def.elementos) if (e.puerta && e.puerta.sala && SALAS[e.puerta.sala]) salas.add(e.puerta.sala);
  if (def.elementos.some(e => e.id === 'escuela')) { for (const id of ['escuela20', 'escuela45', 'escuela67']) salas.delete(id); salas.add('museo'); }   // N2-ESCUELA: el ed. 129 es hoy el museo   // hospital, cine, gimnasio... aunque la historia no los abra en esa época
  return { ...def, turismo: true, reloj: null, zonas: [], salas: [...salas], nombre: 'MODO TURÍSTICO', subTur: EPOCAS[n].titulo, intro: EPOCAS[n].intro };
}
// entidades fuera: enemigos, pepitas, bolas, vagonetas, alud, cóndores, metas (lista en datos/turismo.js)
export function filtrarTurismo(R) {
  const f = a => a.splice(0, a.length, ...a.filter(s => !SIN_TURISMO.has(s.t)));
  f(R.specs); for (const s of Object.values(R.salas)) f(s.specs);
}

// ------------------------------------------------------------------ suelo libre cerca de un punto
function sueloEn(fis, x, z, y0) { const h = fis.rayo({ x, y: y0, z }, { x: 0, y: -1, z: 0 }, 40); return h ? h.punto.y : null; }
function libreCerca(M, x, z, radios = [0, 1.5, 3, 4.5, 6, 8, 10, 13]) {
  const fis = M.fis;
  for (const r of radios) for (let i = 0; i < (r ? 10 : 1); i++) {
    const a = i * Math.PI / 5, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const y = sueloEn(fis, px, pz, altura(px, pz) + 8); if (y == null) continue;
    if (fis.rayo({ x: px, y: y + 0.4, z: pz }, { x: 0, y: 1, z: 0 }, 5)) continue;   // bajo techo o dentro de algo
    let muro = false;
    for (let k = 0; k < 8 && !muro; k++) { const b = k * Math.PI / 4; if (fis.rayo({ x: px, y: y + 1.2, z: pz }, { x: Math.sin(b), y: 0, z: Math.cos(b) }, 0.8)) muro = true; }
    if (muro) continue;
    let parejo = true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = sueloEn(fis, px + dx, pz + dz, y + 3); if (v == null || Math.abs(v - y) > 0.8) parejo = false; }
    if (parejo) return { x: px, y, z: pz };
  }
  return { x, y: sueloEn(fis, x, z, altura(x, z) + 8) ?? altura(x, z), z };
}

// ------------------------------------------------------------------ piezas 3D: cartel azul, letrero de entrada, marca y faro
function lienzo(w, h, dib) { const c = document.createElement('canvas'); c.width = w; c.height = h; dib(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function partir(ctx, txt, ancho) { const pal = txt.split(' '), out = []; let l = ''; for (const p of pal) { const t = l ? l + ' ' + p : p; if (ctx.measureText(t).width > ancho && l) { out.push(l); l = p; } else l = t; } if (l) out.push(l); return out; }
function texCartel(poi) {
  return lienzo(512, 320, (c, w, h) => {
    c.fillStyle = poi.sobrio ? '#2b3036' : '#1d4f91'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f4f1e6'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = 'bold 44px "DejaVu Sans", sans-serif';
    const ls = partir(c, poi.nombre, w - 60).slice(0, 3); ls.forEach((l, i) => c.fillText(l, w / 2, 86 + i * 54 - (ls.length - 1) * 18));
    c.font = '30px "DejaVu Sans", sans-serif'; c.fillStyle = '#ffe9a8';
    c.fillText([poi.edif ? 'Edificio ' + poi.edif : null, poi.anio].filter(Boolean).join(' · '), w / 2, h - 46);
  });
}
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const marca = (fondo, signo) => new THREE.SpriteMaterial({ map: lienzo(128, 128, (c) => { c.fillStyle = fondo; c.beginPath(); c.arc(64, 64, 56, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 8; c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 72px "DejaVu Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(signo, 64, 68); }), depthWrite: false, fog: false, transparent: true });
  MATS = {
    poste: new THREE.MeshStandardMaterial({ color: 0x2f3a33, roughness: 0.6, metalness: 0.4 }),
    canto: new THREE.MeshStandardMaterial({ color: 0xe9e4d4, roughness: 0.7 }),
    pendiente: marca('#d98a1c', 'i'), visto: marca('#2f8f4e', '✓'),
    // M-TUR2: ya no hay letrero amarillo; placa pequeña de bronce junto a la puerta + brillo cálido suave en el umbral
    placa: new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.85, map: lienzo(256, 112, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#9a6f34'); g.addColorStop(0.5, '#c59a52'); g.addColorStop(1, '#7d5726'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#4a3216'; c.lineWidth = 5; c.strokeRect(8, 8, w - 16, h - 16); c.strokeStyle = 'rgba(255,230,170,.55)'; c.lineWidth = 2; c.strokeRect(14, 14, w - 28, h - 28);
      c.fillStyle = '#3b2711'; c.font = 'bold 40px "DejaVu Serif", Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Entrada', w / 2, h / 2 + 3); }) }),
    umbral: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, map: lienzo(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,214,140,0.85)'); g.addColorStop(0.5, 'rgba(255,190,100,0.3)'); g.addColorStop(1, 'rgba(255,190,100,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }) }),
    faro: new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }),
  };
  return MATS;
}
function cartel(poi) {
  const m = mats(), g = new THREE.Group();
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.86, 8), m.poste); poste.position.y = 0.93;   // N0-FABLE-1611 (M1): el poste llegaba a 2,3 m y atravesaba la tabla (tapaba el año): ahora termina bajo ella g.add(poste);
  const tex = texCartel(poi), cara = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 });
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.06, 0.06), [m.canto, m.canto, m.canto, m.canto, cara, cara]); tabla.position.y = 2.35; g.add(tabla);
  const sp = new THREE.Sprite(m.pendiente); sp.scale.set(0.9, 0.9, 1); sp.position.y = 3.5; g.add(sp);
  g.userData.marca = sp; return g;
}

// ------------------------------------------------------------------ inicio del modo en un nivel ya armado
export function iniciarTurismo(M) {
  const def = M.def, n = def.numero, URLP = new URLSearchParams(location.search);
  if (URLP.has('turismoNuevo')) guardarPas({});
  for (const e of M.L.de('olla')) e.act = null;   // el portaollas queda como curiosidad: sin quemar ni rebotar
  const T = M.tur = { n, pas: leerPas(), puntos: [], npcs: [], objetivo: null, recorrido: false, salaPrev: null, cerca: null, abierto: null };
  const d = pasEpoca(T);
  const lugares = lugaresDelNivel(def), raiz = new THREE.Group(); raiz.name = 'turismo'; M.escena.add(raiz); T.raiz = raiz;
  for (const p0 of PUNTOS[n] || []) {
    const poi = { ...p0 };
    if (poi.lugar) {
      const L = buscarLugar(lugares, poi.lugar); if (!L) continue;
      poi.puertaXZ = [L.x, L.z]; poi.nx = L.nx; poi.nz = L.nz;
      const tx = -L.nz, tz = L.nx, fu = L.tipo === 'bocamina' ? 10 : 5, la = L.tipo === 'bocamina' ? 5 : 3.5;   // la bocamina dispara en todo el túnel: cartel más afuera
      Object.assign(poi, libreCerca(M, L.x + L.nx * fu + tx * la, L.z + L.nz * fu + tz * la));
    } else Object.assign(poi, libreCerca(M, poi.x, poi.z));
    poi.g = cartel(poi); poi.g.position.set(poi.x, poi.y, poi.z); raiz.add(poi.g);
    poi.visto = !!d.vis[poi.id]; poi.dentro = !!d.int[poi.id];
    if (poi.visto) poi.g.userData.marca.material = mats().visto;
    T.puntos.push(poi);
  }
  // NPC: guía al inicio y vecinos junto a su punto de interés
  for (const v of NPCS[n] || []) {
    let x = v.x, z = v.z;
    const poi = v.en && T.puntos.find(p => p.id === v.en);
    if (poi) { const a = Math.atan2(poi.z - (poi.puertaXZ ? poi.puertaXZ[1] : poi.z + 1), poi.x - (poi.puertaXZ ? poi.puertaXZ[0] : poi.x)) + Math.PI / 2; x = poi.x + Math.cos(a) * 4; z = poi.z + Math.sin(a) * 4; }
    if (x == null) continue;
    const s = libreCerca(M, x, z, [0, 1.2, 2.4, 3.6, 5]);
    const antes = M.L.lista.length;
    crearEntidad(M, { t: 'gente', quien: v.quien, x: s.x, y: s.y, z: s.z, mira: poi ? [poi.x, poi.z] : [M.jug.pos.x, M.jug.pos.z], nombre: v.nombre, texto: '<i>(E: hablar)</i>' });   // N0-FABLE-1611 (M15): la burbuja solo con el nombre del personaje
    const e = M.L.lista.length > antes ? M.L.lista[M.L.lista.length - 1] : null;
    if (e) T.npcs.push({ ...v, e, x: s.x, y: s.y, z: s.z });
  }
  // faro del destino (columna de luz) y flecha en pantalla
  T.faro = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 70, 16, 1, true), mats().faro); T.faro.visible = false; T.faro.renderOrder = 5; raiz.add(T.faro);
  T.reliqs = def.elementos.filter(e => e.t === 'reliquia' && RELIQUIAS[e.id]).map(e => e.id);
  T.hablar = npc => hablar(M, npc); T.saltar = poi => saltar(M, poi); T.leer = poi => leerFicha(M, poi);
  armarUI(M);
  M.alActualizar = dt => actualizar(M, dt);
  setTimeout(() => { if (M.tur === T) UI.aviso('Modo Turístico · ' + EPOCAS[n].titulo + ' · Tab: plano · B: pasaporte', 4500); }, 1200);
  return T;
}

// placa de bronce y brillo en el umbral de las puertas de los edificios visitables (las genéricas aparecen al armarse los interiores)
function marcarEntradas(M) {
  const T = M.tur, m = mats();
  for (const poi of T.puntos) {
    if (!poi.entra || poi.puerta || !poi.puertaXZ) continue;
    const [px, pz] = poi.puertaXZ;
    const cand = M.R.puertas.filter(p => p.lado !== 'salida' && !p.cerrada && (poi.entra === 'gen' ? p.gen : !p.gen && M.R.salas[p.sala]) && Math.hypot(p.x - px, p.z - pz) < 22)
      .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
    if (!cand.length) continue;
    poi.puerta = cand[0];
    const pu = poi.puerta, r = pu.rumbo || 0, nx = Math.sin(r), nz = Math.cos(r);
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.27), m.placa); placa.position.set(pu.x + nz * 1.25 + nx * 0.12, pu.y + 1.45, pu.z - nx * 1.25 + nz * 0.12); placa.rotation.y = r; T.raiz.add(placa);
    const enPu = o => { const th = r - Math.PI / 2, c = Math.cos(th), sn = Math.sin(th); return [pu.x + o.dx * c + o.dz * sn, pu.z - o.dx * sn + o.dz * c]; };   // N2-ESCUELA: dx/dz en el marco del edificio sin girar (rumbo π/2)
    if (pu.placa) { const [x, z] = enPu(pu.placa); placa.position.set(x, pu.y + 1.45, z); }   // N2-ESCUELA: placa pegada a la fachada (puerta en un descanso angosto)
    const bs = pu.brillo ? pu.brillo.s : 3.2, brillo = new THREE.Mesh(new THREE.PlaneGeometry(bs, bs), m.umbral); brillo.rotation.x = -Math.PI / 2; brillo.position.set(pu.x + nx * 0.9, pu.y + 0.06, pu.z + nz * 0.9); brillo.renderOrder = 4; T.raiz.add(brillo);
    if (pu.brillo) { const [x, z] = enPu(pu.brillo); brillo.position.set(x, pu.y + 0.06, z); }
  }
}

// ------------------------------------------------------------------ cada paso de física (M.alActualizar)
function actualizar(M, dt) {
  const T = M.tur; if (!T) return;
  const j = M.jug, d = pasEpoca(T);
  if (!T.entradas && (M.R.intListo || M.t > 4)) { marcarEntradas(M); if (M.R.intListo) T.entradas = true; }
  // entrar a un edificio: interior visitado
  if (M.salaActual !== T.salaPrev) {
    T.salaPrev = M.salaActual;
    if (M.salaActual) {
      const pu = M.R.puertas.find(p => p.sala === M.salaActual);
      const poi = pu && T.puntos.filter(p => p.entra && p.puertaXZ).sort((a, b) => Math.hypot(a.puertaXZ[0] - pu.x, a.puertaXZ[1] - pu.z) - Math.hypot(b.puertaXZ[0] - pu.x, b.puertaXZ[1] - pu.z))[0];
      if (poi && Math.hypot(poi.puertaXZ[0] - pu.x, poi.puertaXZ[1] - pu.z) < 30) {
        if (!poi.visto) visitar(M, poi);
        if (!poi.dentro) { poi.dentro = true; d.int[poi.id] = 1; guardarPas(T.pas); setTimeout(() => UI.aviso('🎫 Sello: interior de ' + poi.nombre, 2600), 900); }
      }
      ficha(null);
    }
    T.cerca = null;   // N2-ESCUELA2: la ficha de afuera (o la cédula de adentro) no queda pegada al cruzar la puerta
  }
  // curiosidades (reliquias del libro) que se recogieron
  if (P && P.reliquias) for (const id of P.reliquias) if (!d.cur[id]) { d.cur[id] = 1; guardarPas(T.pas); }
  { const b = M.burbujaDe, q = b && b.malla && b.malla.position;   // burbuja de un vecino que quedó lejos (salto, sala): fuera
    if (q && (M.salaActual ? !b.sala : Math.hypot(q.x - j.pos.x, q.z - j.pos.z) > 8)) { M.burbujaDe = null; UI.burbuja(null); } }
  if (M.salaActual) { T.faro.visible = false; flecha(M); cedulas(M); return; }
  // carteles: marca, giro hacia Nato, ficha al acercarse
  let mejor = null, dm = 1e9;
  for (const poi of T.puntos) {
    const dx = j.pos.x - poi.x, dz = j.pos.z - poi.z, dd = Math.hypot(dx, dz);
    if (dd < 45) poi.g.rotation.y = Math.atan2(dx, dz);
    if (dd < R_FICHA && Math.abs(j.pie - poi.y) < 5 && dd < dm) { dm = dd; mejor = poi; }
  }
  if (mejor !== T.cerca) { T.cerca = mejor; ficha(mejor); if (mejor && !mejor.visto) visitar(M, mejor); }
  // E: hablar con el NPC más cercano o leer el cartel (antes que las puertas)
  if (E.b.accion.recien && !UI.abierto) {
    let npc = null, dn = R_HABLAR;
    for (const v of T.npcs) { const p = v.e.malla.position, dd = Math.hypot(p.x - j.pos.x, p.z - j.pos.z); if (dd < dn && Math.abs(p.y - j.pie) < 3) { dn = dd; npc = v; } }
    const abierto = T.npcs.find(v => v.e === M.burbujaDe);   // N0-FABLE-1611 (M4): si la burbuja de un vecino está abierta («E: hablar»), E habla con él y no abre el cartel
    if (abierto) { hablar(M, abierto); E.b.accion.recien = false; }
    else if (npc && !(mejor && dm + 0.6 < dn)) { hablar(M, npc); E.b.accion.recien = false; }   // el más cercano: vecino o cartel
    else if (mejor && dm < R_LEER) { leerFicha(M, mejor); E.b.accion.recien = false; }
  }
  // destino: faro y flecha; al llegar, el siguiente del recorrido
  if (T.objetivo && T.objetivo.visto) { const sig = T.recorrido ? siguiente(T) : null; T.objetivo = sig; if (sig) setTimeout(() => UI.aviso('Siguiente parada: ' + sig.nombre, 2600), 2800); else if (T.recorrido) { T.recorrido = false; setTimeout(() => UI.aviso('Recorrido completo. Mira tu pasaporte (B).', 3500), 2800); } }
  T.faro.visible = !!T.objetivo;
  if (T.objetivo) T.faro.position.set(T.objetivo.x, T.objetivo.y + 35, T.objetivo.z);
  flecha(M);
  barra(M);
}
function siguiente(T) {
  const orden = [...(RECORRIDO[T.n] || []), ...T.puntos.map(p => p.id)];
  for (const id of orden) { const p = T.puntos.find(q => q.id === id); if (p && !p.visto) return p; }
  return null;
}
function visitar(M, poi) {
  const T = M.tur, d = pasEpoca(T), j = M.jug;
  poi.visto = true; d.vis[poi.id] = [+j.pos.x.toFixed(1), +j.pie.toFixed(1), +j.pos.z.toFixed(1)]; guardarPas(T.pas);
  poi.g.userData.marca.material = mats().visto;
  UI.aviso('🎫 Sello en tu pasaporte: ' + poi.nombre, 2400);
}
function hablar(M, npc) {
  const T = M.tur, d = pasEpoca(T), k = d.hab[npc.id] || 0;
  let txt;
  if (k < npc.lineas.length) { txt = npc.lineas[k]; d.hab[npc.id] = k + 1; guardarPas(T.pas); }
  else txt = npc.guia ? 'Ya le conté lo que sé. El recorrido sigue marcado en el plano (Tab): siga la luz.' : npc.sobrio ? 'Gracias por venir a recordarlos.' : 'Ya le conté mis historias. ¡Que disfrute Sewell!';
  if (npc.guia && k + 1 >= npc.lineas.length) { T.recorrido = true; T.objetivo = siguiente(T); }
  UI.modal(npc.nombre + (k < npc.lineas.length ? ` · ${k + 1} de ${npc.lineas.length}` : ''), txt);
  if (window.JUEGO) window.JUEGO.modalAbierto = performance.now();
  return txt;
}
// N2-ESCUELA2: cédulas de las piezas en exposición dentro de una sala (hoy: el museo de la ex Escuela Industrial). El kit deja la lista en
// userData.cedulas de su grupo ({ x, y, z, nombre, anio, origen?, uso, dato }); se usa la misma ficha chica y el mismo modal de los carteles.
function cedulas(M) {
  const T = M.tur, j = M.jug, s = M.R.salas[M.salaActual]; if (!s) return;
  if (!s._ced) { s._ced = []; s.grupo.traverse(o => { if (o.userData.cedulas) s._ced.push(...o.userData.cedulas); }); }
  let mejor = null, dm = R_CED;
  for (const c of s._ced) { const d = Math.hypot(j.pos.x - c.x, j.pos.z - c.z); if (d < dm && Math.abs(j.pie + 1.2 - c.y) < 2 && aLaVista(M, c, d)) { dm = d; mejor = c; } }
  if (mejor !== T.cerca) { T.cerca = mejor; ficha(mejor); }
  if (mejor && E.b.accion.recien && !UI.abierto) { leerCedula(mejor); E.b.accion.recien = false; }
}
// la cédula no se lee a través de un muro (los paneles del muro del hall quedaban a 1,1 m de la recepción): rayo a 1,2 m del piso
function aLaVista(M, c, d) {
  if (d < 0.3) return true;
  const j = M.jug, o = { x: j.pos.x, y: j.pie + 1.2, z: j.pos.z }, v = { x: (c.x - o.x) / d, y: 0, z: (c.z - o.z) / d };
  const h = M.fis.rayo(o, v, d, j.p && j.p.col); if (!h) return true;
  const t = M.fis.etiquetas.get(h.col && h.col.handle); return !(t && t.tipo === 'muro');
}
function leerCedula(c) {
  UI.modal(c.nombre, [c.anio, c.origen].filter(Boolean).join(' · ') + '\n\n' + c.uso + '\n\n' + c.dato);
  const mt = $('modal-texto'); if (mt) mt.style.whiteSpace = 'pre-line';   // párrafos (el modal de los apuntes no tiene saltos de línea)
  if (window.JUEGO) window.JUEGO.modalAbierto = performance.now();
}
function leerFicha(M, poi) {
  UI.modal(poi.nombre + ' · ' + [poi.edif ? 'Edificio ' + poi.edif : null, poi.anio].filter(Boolean).join(' · '), poi.texto + (poi.entra ? ' Se puede entrar: busca la placa de bronce junto a la puerta.' : ''));
  if (window.JUEGO) window.JUEGO.modalAbierto = performance.now();
}
function saltar(M, poi) {
  const T = M.tur, v = pasEpoca(T).vis[poi.id];
  if (M.salaActual) { UI.aviso('Sal del edificio para saltar a otro lugar', 2200); return false; }
  if (!poi.visto) { UI.aviso('Primero hay que llegar caminando a ' + poi.nombre, 2200); return false; }
  if (poi.lugar) irALugar(M, M.def, poi.lugar);   // frente a la puerta, mirando la fachada (H-IR)
  else if (v) { M.jug.teletransportar(v[0], v[1] + 0.3, v[2]); M.cam.cortar(); }
  else { M.jug.teletransportar(poi.x + 2, poi.y + 0.3, poi.z + 2); M.cam.cortar(); }
  T.cerca = null; M.burbujaDe = null; UI.burbuja(null); return true;   // la burbuja del vecino de allá no queda pegada
}

// ------------------------------------------------------------------ interfaz (HTML propio, sin tocar index.html)
const CSS = `
body.turista #hud-izq, body.turista #hud-der > div:first-child, body.turista #hud-apuntes, body.turista #hud-reliquias, body.turista #hud-reloj, body.turista #hud-trucos { display: none !important; }
#tur-barra { position: fixed; right: max(12px, env(safe-area-inset-right)); top: 10px; display: flex; gap: 8px; align-items: center; z-index: 20; font: bold 16px 'Trebuchet MS', 'DejaVu Sans', sans-serif; }
#tur-barra button { font: inherit; padding: 6px 12px; border-radius: 9px; border: 2px solid #f3e6c8; background: #3a2410e6; color: #fff; cursor: pointer; }
#tur-barra span { color: #fff; text-shadow: 0 2px 0 #1a1420; }
#tur-flecha { position: fixed; left: 50%; top: 56px; transform: translateX(-50%); z-index: 19; color: #ffe066; font: bold 18px 'Trebuchet MS', 'DejaVu Sans', sans-serif; text-shadow: 0 2px 0 #1a1420, 0 0 4px #1a1420; pointer-events: none; white-space: nowrap; }
#tur-flecha b { display: inline-block; font-size: 26px; }
#tur-ficha { position: fixed; left: max(12px, env(safe-area-inset-left)); bottom: 90px; width: min(380px, calc(100vw - 24px)); background: #1d4f91f2; color: #fff; border: 3px solid #f4f1e6; border-radius: 10px; padding: 10px 14px; z-index: 18; font: 15px/1.4 'Trebuchet MS', 'DejaVu Sans', sans-serif; pointer-events: none; }
#tur-ficha.sobrio { background: #2b3036f2; }
#modal:not(.oculto) ~ #tur-ficha, #tarjeta:not(.oculto) ~ #tur-ficha { display: none; }
#tur-ficha h3 { margin: 0 0 2px; font-size: 18px; } #tur-ficha .dato { color: #ffe9a8; font-size: 13px; margin-bottom: 6px; } #tur-ficha .pie { color: #ffe9a8; font-size: 12px; margin-top: 6px; }
#tur-capa { position: fixed; inset: 0; z-index: 30; background: #0b0910d9; display: flex; align-items: center; justify-content: center; padding: 12px; font-family: 'Trebuchet MS', 'DejaVu Sans', sans-serif; }
#tur-caja { width: min(1100px, 100%); max-height: 100%; overflow: auto; background: #f6ecd2; color: #2a1d10; border: 4px solid #6b4423; border-radius: 12px; padding: 12px 16px; }
#tur-caja h2 { margin: 0 0 4px; color: #8a3c0c; font-size: 22px; } #tur-caja .sub { margin: 0 0 10px; font-size: 14px; opacity: .8; }
#tur-caja .cerrar { float: right; font: bold 16px inherit; padding: 4px 12px; border-radius: 8px; border: 2px solid #6b4423; background: #3a2410; color: #fff; cursor: pointer; }
#tur-plano { display: flex; gap: 12px; flex-wrap: wrap; } #tur-plano canvas { flex: 0 1 auto; height: min(560px, calc(100dvh - 150px)); width: auto; max-width: 100%; background: #efe3c2; border: 2px solid #b9a27a; border-radius: 8px; cursor: pointer; }
#tur-lista { flex: 1 1 220px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
#tur-lista button { text-align: left; font: inherit; padding: 5px 8px; border-radius: 6px; border: 1px solid #b9a27a; background: #fff8e6; cursor: pointer; color: #2a1d10; }
#tur-lista button.visto { background: #dff0dc; } #tur-lista button.sel { outline: 3px solid #d98a1c; }
#tur-sel { margin-top: 6px; padding: 8px; background: #fff8e6; border-radius: 8px; border: 1px solid #b9a27a; font-size: 14px; }
#tur-sel button { font: inherit; margin: 6px 6px 0 0; padding: 5px 10px; border-radius: 7px; border: 2px solid #6b4423; background: #3a2410; color: #fff; cursor: pointer; }
#tur-sel button:disabled { opacity: .45; cursor: default; }
.tur-sellos { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-bottom: 12px; }
.tur-sello { border: 2px dashed #b9a27a; border-radius: 10px; padding: 8px; font-size: 13px; min-height: 70px; background: #fff8e6; }
.tur-sello.ok { border: 2px solid #2f8f4e; background: #e4f3e0; } .tur-sello b { display: block; font-size: 14px; } .tur-sello .s { color: #2f8f4e; font-weight: bold; }
#tur-caja h4 { margin: 10px 0 6px; color: #6b4423; }
#t-epocas { display: flex; flex-direction: column; gap: 8px; }
`;
function armarUI(M) {
  if (!$('tur-estilo')) { const s = document.createElement('style'); s.id = 'tur-estilo'; s.textContent = CSS; document.head.appendChild(s); }
  document.body.classList.add('turista');
  quitar('tur-barra'); quitar('tur-flecha'); quitar('tur-ficha');
  const b = document.createElement('div'); b.id = 'tur-barra';
  b.innerHTML = '<span id="tur-cuenta"></span><button id="tur-b-plano">🗺 Plano (Tab)</button><button id="tur-b-pas">🎫 Pasaporte (B)</button>';
  document.body.appendChild(b);
  $('tur-b-plano').onclick = () => abrir(M, 'plano'); $('tur-b-pas').onclick = () => abrir(M, 'pasaporte');
  const f = document.createElement('div'); f.id = 'tur-flecha'; document.body.appendChild(f);
  const fi = document.createElement('div'); fi.id = 'tur-ficha'; fi.className = 'oculto'; document.body.appendChild(fi);
  if (!window.__turTeclas) {
    window.__turTeclas = true;
    addEventListener('keydown', ev => {
      const T = window.JUEGO && window.JUEGO.M && window.JUEGO.M.tur; if (!T || window.JUEGO.escena !== 'juego') return;
      if (ev.code === 'Tab') { ev.preventDefault(); if (T.abierto === 'plano') cerrar(window.JUEGO.M); else abrir(window.JUEGO.M, 'plano'); }
      else if (ev.code === 'KeyB' && !ev.repeat) { if (T.abierto === 'pasaporte') cerrar(window.JUEGO.M); else abrir(window.JUEGO.M, 'pasaporte'); }
      else if (ev.code === 'Escape' && T.abierto) cerrar(window.JUEGO.M);
    });
  }
}
function quitar(id) { const e = $(id); if (e) e.remove(); }
export function cerrarTurismo() {
  document.body.classList.remove('turista');
  for (const id of ['tur-barra', 'tur-flecha', 'tur-ficha', 'tur-capa']) quitar(id);
}
function ficha(poi) {
  const f = $('tur-ficha'); if (!f) return;
  if (!poi) { f.classList.add('oculto'); return; }
  f.className = poi.sobrio ? 'sobrio' : '';
  if (poi.cedula) { f.innerHTML = `<h3>${poi.nombre}</h3><div class="dato">${poi.anio}</div><div class="pie">E: leer la cédula</div>`; return; }   // N2-ESCUELA2
  f.innerHTML = `<h3>${poi.nombre}</h3><div class="dato">${[poi.edif ? 'Edificio ' + poi.edif : null, poi.anio].filter(Boolean).join(' · ')}${poi.entra ? ' · se puede entrar' : ''}</div>${poi.texto}<div class="pie">E: leer en grande${poi.entra ? ' · placa de bronce = entrada' : ''}</div>`;
}
function flecha(M) {
  const T = M.tur, f = $('tur-flecha'); if (!f) return;
  if (!T.objetivo || M.salaActual) { f.textContent = ''; return; }
  const c = window.JUEGO.render.camara, v = new THREE.Vector3(); c.getWorldDirection(v);
  const dx = T.objetivo.x - M.jug.pos.x, dz = T.objetivo.z - M.jug.pos.z;
  const a = Math.atan2(dx, dz) - Math.atan2(v.x, v.z);
  f.innerHTML = `<b style="transform: rotate(${(-a * 180 / Math.PI).toFixed(0)}deg)">▲</b> ${T.recorrido ? 'Recorrido: ' : ''}${T.objetivo.nombre} · ${Math.round(Math.hypot(dx, dz))} m`;
}
function barra(M) {
  const T = M.tur, c = $('tur-cuenta'); if (!c) return;
  const vis = T.puntos.filter(p => p.visto).length, t = `${vis}/${T.puntos.length} lugares`;
  if (c.textContent !== t) c.textContent = t;
}

// ------------------------------------------------------------------ plano y pasaporte (capa encima del juego, en pausa)
function abrir(M, que) {
  const T = M.tur, G = window.JUEGO; if (!T) return;
  quitar('tur-capa'); T.abierto = que; G.pausa = true; G.turPausa = true;
  if (document.pointerLockElement) document.exitPointerLock();
  const capa = document.createElement('div'); capa.id = 'tur-capa';
  capa.innerHTML = `<div id="tur-caja"><button class="cerrar">Cerrar ✕</button>${que === 'plano' ? htmlPlano(M) : htmlPasaporte(M)}</div>`;
  document.body.appendChild(capa);
  capa.querySelector('.cerrar').onclick = () => cerrar(M);
  if (que === 'plano') prepararPlano(M);
}
function cerrar(M) {
  const T = M.tur, G = window.JUEGO; quitar('tur-capa'); if (T) T.abierto = null;
  if (G.turPausa) { G.turPausa = false; G.pausa = false; }
}
function htmlPlano(M) {
  const T = M.tur;
  return `<h2>Plano · ${EPOCAS[T.n].titulo}</h2><p class="sub">● naranja: por conocer · ● verde: visitado · ▲ rojo: tú. Toca un punto para caminar hasta él (faro de luz) o saltar si ya lo visitaste.</p>
  <div id="tur-plano"><canvas id="tur-lienzo" width="760" height="560"></canvas><div id="tur-lista">${T.puntos.map((p, i) => `<button data-i="${i}" class="${p.visto ? 'visto' : ''}">${p.visto ? '✓' : '○'} ${p.nombre}${p.entra ? (p.dentro ? ' · interior ✓' : ' · se entra') : ''}</button>`).join('')}<div id="tur-sel">Elige un lugar.</div></div></div>`;
}
function prepararPlano(M) {
  const T = M.tur, cv = $('tur-lienzo'), c = cv.getContext('2d');
  // límites: edificios, puntos y Nato
  const pts = [...T.puntos.map(p => [p.x, p.z]), [M.jug.pos.x, M.jug.pos.z]];
  for (const e of M.def.elementos) if (e.t === 'edificio' && isFinite(e.x) && isFinite(e.z)) pts.push([e.x, e.z]);
  let x0 = Math.min(...pts.map(p => p[0])) - 25, x1 = Math.max(...pts.map(p => p[0])) + 25, z0 = Math.min(...pts.map(p => p[1])) - 25, z1 = Math.max(...pts.map(p => p[1])) + 25;
  cv.width = 640; cv.height = Math.round(640 * Math.min(1.5, Math.max(0.6, (z1 - z0) / (x1 - x0))));   // el lienzo toma la forma del plano (Sewell es alto y angosto)
  const k = Math.min(cv.width / (x1 - x0), cv.height / (z1 - z0)), ox = (cv.width - (x1 - x0) * k) / 2, oz = (cv.height - (z1 - z0) * k) / 2;
  const aP = (x, z) => [ox + (x - x0) * k, oz + (z - z0) * k];
  let sel = null;
  const dibujar = () => {
    c.fillStyle = '#efe3c2'; c.fillRect(0, 0, cv.width, cv.height);
    // escaleras
    c.strokeStyle = '#9c8a6a'; c.lineCap = 'round';
    for (const s of Object.values(M.R.escaleras || {})) { if (!s.a || !s.b) continue; c.lineWidth = Math.max(2, (s.ancho || 2) * k); const [ax, az] = aP(s.a.x, s.a.z), [bx, bz] = aP(s.b.x, s.b.z); c.beginPath(); c.moveTo(ax, az); c.lineTo(bx, bz); c.stroke(); }
    // edificios
    for (const e of M.def.elementos) {
      if (e.t !== 'edificio' || !isFinite(e.x) || !e.largo) continue;
      let th = 0, w = e.largo, h = e.ancho || 8;
      if (e.giro != null) th = -e.giro * Math.PI / 180; else if ((e.rot || 0) % 180 !== 0) { w = e.ancho; h = e.largo; }
      const [cx, cz] = aP(e.x, e.z); c.save(); c.translate(cx, cz); c.rotate(th);
      c.fillStyle = '#' + (e.color != null ? (e.color & 0xffffff).toString(16).padStart(6, '0') : 'b8a27a'); c.globalAlpha = 0.55; c.fillRect(-w * k / 2, -h * k / 2, w * k, h * k); c.globalAlpha = 1;
      c.strokeStyle = '#6b4423'; c.lineWidth = 1; c.strokeRect(-w * k / 2, -h * k / 2, w * k, h * k); c.restore();
    }
    // puntos
    c.font = 'bold 12px "DejaVu Sans", sans-serif'; c.textAlign = 'left';
    T.puntos.forEach((p, i) => {
      const [px, pz] = aP(p.x, p.z);
      c.beginPath(); c.arc(px, pz, p === sel ? 9 : 7, 0, 7); c.fillStyle = p.visto ? '#2f8f4e' : '#d98a1c'; c.fill(); c.lineWidth = 2; c.strokeStyle = p === T.objetivo ? '#ffd34d' : '#fff'; c.stroke();
      c.fillStyle = '#2a1d10'; c.fillText(String(i + 1), px + 9, pz + 4);
    });
    // Nato
    const [nx, nz] = aP(M.jug.pos.x, M.jug.pos.z), r = M.jug.rumbo || 0;
    c.save(); c.translate(nx, nz); c.rotate(-r + Math.PI); c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(-7, 8); c.closePath(); c.fillStyle = '#c0261f'; c.fill(); c.strokeStyle = '#fff'; c.stroke(); c.restore();
    c.fillStyle = '#6b4423'; c.font = '12px "DejaVu Sans", sans-serif'; c.fillText('↑ cerro arriba · ↓ estación y valle', 8, cv.height - 8);
  };
  const elegir = p => {
    sel = p; dibujar();
    for (const b of document.querySelectorAll('#tur-lista button')) b.classList.toggle('sel', T.puntos[+b.dataset.i] === p);
    const s = $('tur-sel');
    s.innerHTML = `<b>${p.nombre}</b> · ${[p.edif ? 'Edificio ' + p.edif : null, p.anio].filter(Boolean).join(' · ')}<br>${p.visto ? 'Visitado' : 'Por conocer'}${p.entra ? (p.dentro ? ' · interior visitado' : ' · se puede entrar') : ''}<br>
      <button id="tur-caminar">Caminar hasta aquí</button><button id="tur-saltar" ${p.visto ? '' : 'disabled title="Solo a lugares ya visitados"'}>Saltar</button>`;
    $('tur-caminar').onclick = () => { T.objetivo = p; T.recorrido = false; cerrar(M); UI.aviso('Sigue la luz hasta ' + p.nombre, 2400); };
    $('tur-saltar').onclick = () => { cerrar(M); saltar(M, p); };
  };
  cv.onclick = ev => {
    const r = cv.getBoundingClientRect(), mx = (ev.clientX - r.left) * cv.width / r.width, mz = (ev.clientY - r.top) * cv.height / r.height;
    let m = null, dm = 18; for (const p of T.puntos) { const [px, pz] = aP(p.x, p.z), d = Math.hypot(px - mx, pz - mz); if (d < dm) { dm = d; m = p; } }
    if (m) elegir(m);
  };
  for (const b of document.querySelectorAll('#tur-lista button')) b.onclick = () => elegir(T.puntos[+b.dataset.i]);
  dibujar();
}
function htmlPasaporte(M) {
  const T = M.tur, d = pasEpoca(T);
  const sello = (ok, titulo, linea) => `<div class="tur-sello ${ok ? 'ok' : ''}"><b>${ok ? titulo : '?'}</b>${ok ? `<span class="s">✓ ${linea}</span>` : '<span>Por descubrir</span>'}</div>`;
  const lug = T.puntos.map(p => sello(p.visto, p.nombre, [p.edif ? 'Ed. ' + p.edif : null, p.anio].filter(Boolean).join(' · ') + (p.dentro ? ' · interior' : ''))).join('');
  const cur = T.reliqs.map(id => sello(!!d.cur[id], RELIQUIAS[id][0], 'curiosidad del libro')).join('');
  const hab = T.npcs.map(v => sello((d.hab[v.id] || 0) > 0, v.nombre, `${Math.min(d.hab[v.id] || 0, v.lineas.length)} de ${v.lineas.length} relatos`)).join('');
  const otras = [1, 2, 3, 4].map(n => { const e = T.pas[n] || {}; return `<li>${EPOCAS[n].titulo}: ${Object.keys(e.vis || {}).length}/${(PUNTOS[n] || []).length} lugares · ${Object.keys(e.cur || {}).length} curiosidades · ${Object.keys(e.int || {}).length} interiores</li>`; }).join('');
  return `<h2>🎫 Pasaporte de Sewell · ${EPOCAS[T.n].titulo}</h2><p class="sub">Se guarda en este navegador. Los lugares se sellan al acercarte a su cartel; los interiores, al entrar.</p>
  <h4>Lugares y edificios (${T.puntos.filter(p => p.visto).length}/${T.puntos.length})</h4><div class="tur-sellos">${lug}</div>
  <h4>Curiosidades encontradas (${T.reliqs.filter(id => d.cur[id]).length}/${T.reliqs.length})</h4><div class="tur-sellos">${cur || '<i>Esta época no tiene curiosidades sueltas.</i>'}</div>
  <h4>Conversaciones</h4><div class="tur-sellos">${hab}</div>
  <h4>Todas las épocas</h4><ul>${otras}</ul>`;
}

// ------------------------------------------------------------------ menú principal: modo Historia o Turístico
export function prepararMenuTurismo(alElegir) {
  const jugar = $('t-jugar'); if (!jugar || $('t-turismo')) return;
  if (!$('tur-estilo')) { const s = document.createElement('style'); s.id = 'tur-estilo'; s.textContent = CSS; document.head.appendChild(s); }
  jugar.textContent = 'Modo Historia';
  const b = document.createElement('button'); b.id = 't-turismo'; b.textContent = 'Modo Turístico';
  jugar.insertAdjacentElement('afterend', b);
  const panel = document.createElement('div'); panel.id = 't-epocas'; panel.className = 'menu oculto';
  panel.innerHTML = '<p class="nota" style="margin:0">Modo Turístico: recorre Sewell sin enemigos ni apuro. Elige la época:</p>' +
    [1, 2, 3, 4].map(n => `<button data-n="${n}">${EPOCAS[n].titulo}</button>`).join('') + '<button id="t-epocas-volver">← Volver</button>';
  const menu = jugar.closest('.menu'); menu.insertAdjacentElement('afterend', panel);
  const ver = v => { menu.classList.toggle('oculto', v); panel.classList.toggle('oculto', !v); (v ? panel.querySelector('button') : b).focus({ preventScroll: true }); };
  b.onclick = () => ver(true);
  $('t-epocas-volver').onclick = () => ver(false);
  for (const e of panel.querySelectorAll('button[data-n]')) e.onclick = () => { ver(false); alElegir(+e.dataset.n); };
  if (new URLSearchParams(location.search).get('modo') === 'turista') ver(true);
}
