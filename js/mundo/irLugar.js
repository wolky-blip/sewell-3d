// H-IR (carril herramientas, 14-11-2026): parámetro de revisión &ir=<lugar> (junto a ?nivel=N&rapido&invencible=1).
// Tras cargar el nivel, Nato aparece en la calle frente a la puerta del lugar, mirándolo, con la cámara encuadrando la fachada.
// Usa la posición/giro FINAL de cada elemento (def.elementos ya con el cono aplicado). &lugares=1 muestra la lista del nivel.
// Nombres: club, escuela|museo, iglesia, teatro|cine, palitroque|bowling, hospital, gimnasio (= club), pulperia, hamilton, molino,
// estacion, mina (bocamina Fortuna), nido, torre; y cualquier id de niveles.js (&ir=taller_largo; el 2.º repetido: taller_largo2).
import * as THREE from 'three';
import { altura } from './terreno.js';

const sinTilde = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
// id del edificio → nombres con que se puede pedir (el primero es el que se muestra)
const NOMBRES = { club: ['club', 'gimnasio'], escuela: ['escuela', 'museo'], iglesia: ['iglesia'], cine: ['cine', 'teatro'], palitroque: ['palitroque', 'bowling'],
  hospital: ['hospital'], pulperia: ['pulperia'], hamilton3: ['hamilton'], hamilton: ['hamilton'], molino: ['molino'], estacion: ['estacion'],
  bocamina: ['mina', 'fortuna', 'bocamina'], nido: ['nido', 'condor'], torre: ['torre', 'balcones'] };
const ACCESO_TARDE = new Set(['club', 'escuela']);   // N2-PUERTAS-EMB: lugares cuya puerta (con acceso) la arma el kit después
const LADO = { sur: [0, 1], norte: [0, -1], este: [1, 0], oeste: [-1, 0] };

// lugares del nivel con su puerta en el mundo: { claves, nombre, x, z (punto de la puerta), nx, nz (hacia afuera), tipo }
export function lugaresDelNivel(def) {
  const lista = [], cuenta = {};
  for (const e of def.elementos) {
    let id = null, nx = 0, nz = 1, px = e.x, pz = e.z;
    if (e.t === 'edificio' && e.id) {
      id = e.id;
      const lado = (e.puerta && e.puerta.lado) || 'sur', [lx, lz] = LADO[lado] || LADO.sur;
      if (e.giro != null) {   // edificioGirado: el marco local (largo en x, ancho en z) se gira alrededor del centro
        const th = e.giro * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
        nx = lx * c + lz * s; nz = -lx * s + lz * c;
        const m = lx ? e.largo / 2 : e.ancho / 2; px = e.x + nx * m; pz = e.z + nz * m;
      } else {
        const girado = (e.rot || 0) % 180 !== 0, wx = girado ? e.ancho : e.largo, wz = girado ? e.largo : e.ancho;
        nx = lx; nz = lz; const m = lx ? wx / 2 : wz / 2; px = e.x + nx * m; pz = e.z + nz * m;
      }
    } else if (e.t === 'fundicion') { id = e.id; nx = 1; nz = 0; px = e.x + 8; pz = (e.via ?? e.z) + 3.5; }   // N1-MOLINO (carril kit). DEFECTOS-1611: se mira desde el ORIENTE, junto a la vía de las ollas (no encima de una olla) (el frente sur da al talud: &ir=molino dejaba a Nato 36 m abajo mirando la ladera)
    else if (e.t === 'bocamina') { id = 'bocamina'; const r = (e.rot || 0) * Math.PI / 180; nx = Math.sin(r); nz = Math.cos(r); }
    else if (e.t === 'torre') { id = 'torre'; nx = -1; nz = 0; px = e.x - 5; }   // balcones al poniente, hacia la escalera
    else if (e.t === 'nido') { id = 'nido'; nx = 0; nz = 1; pz = e.z + 4; }
    if (!id) continue;
    const n = cuenta[id] = (cuenta[id] || 0) + 1, base = NOMBRES[id] || [id];
    const claves = base.map(sinTilde); if (n > 1) for (let i = 0; i < claves.length; i++) claves[i] += n;
    if (n === 1 && !NOMBRES[id]) claves.push(sinTilde(id));
    // mismo nombre alternativo para el 1.º: «club» y «club1»
    lista.push({ id, claves, nombre: base[0] + (n > 1 ? n : '') + (base.length > 1 && n === 1 ? ' (' + base.slice(1).join(', ') + ')' : ''), x: px, z: pz, nx, nz, tipo: e.t, e });
  }
  return lista;
}
export const buscarLugar = (lista, q) => {
  const k = sinTilde(q); if (!k) return null;
  return lista.find(l => l.claves.includes(k)) || lista.find(l => sinTilde(l.id) === k) || lista.find(l => l.claves.some(c => c.startsWith(k))) || null;
};

// suelo caminable: rayo desde 4 m sobre el terreno (no choca con techos altos); null si no hay
function sueloEn(fis, x, z, yRef) {
  const h = fis.rayo({ x, y: (yRef ?? altura(x, z)) + 4, z }, { x: 0, y: -1, z: 0 }, 40);
  return h ? h.punto.y : null;
}
// ¿cabe Nato en (x, z)? suelo parejo (cerca de yRef), sin muros a 0,8 m, sin techo encima y con vista libre hacia la puerta
export const MOTIVOS = {};
function libre(fis, x, z, yRef, objetivo, flojo) {
  const no = k => { MOTIVOS[k] = (MOTIVOS[k] || 0) + 1; return null; };
  const y = sueloEn(fis, x, z, yRef); if (y == null || (!flojo && Math.abs(y - yRef) > 1.2)) return no('suelo');
  for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) { const v = sueloEn(fis, x + dx, z + dz, y); if (v == null || Math.abs(v - y) > (flojo ? 3.5 : 0.9)) return no('desnivel'); }   // sin caídas ni escalones grandes
  for (const alto of flojo ? [1.4, 2] : [0.5, 1.2, 1.8]) for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, h = fis.rayo({ x, y: y + alto, z }, { x: Math.sin(a), y: 0, z: Math.cos(a) }, 0.8);
    if (h) return no('muro');
  }
  if (fis.rayo({ x, y: y + 0.4, z }, { x: 0, y: 1, z: 0 }, 6)) return no('techo');   // bajo un alero, balcón o techo
  { const o = { x, y: y + 1.5, z }, dx = objetivo.x - x, dz = objetivo.z - z, d = Math.hypot(dx, dz), h = fis.rayo(o, { x: dx / d, y: 0, z: dz / d }, d - 1.2);   // la fachada a la vista: nada se interpone antes
    if (h && !flojo) return no('vista'); }
  return y;
}

// pone a Nato frente al lugar. Devuelve { ok, lugar, x, y, z, d } o { ok: false, lista }
export function irALugar(M, def, nombre, op = {}) {
  const lista = lugaresDelNivel(def), nombres = lista.map(l => l.nombre);
  M.lugares = lista;
  if (op.lista || !nombre) mostrarLista(def, nombres);
  if (!nombre) return { ok: false, lista: nombres };
  let L = buscarLugar(lista, nombre);
  if (!L) { avisoLista(`No hay «${nombre}» en este nivel. Lugares: ${nombres.join(', ')}`); return { ok: false, lista: nombres }; }
  // N2-PUERTAS-EMB: si la puerta trae «acceso» (pie de su escalera: club, escuela), Nato aparece en la calle frente a ESE acceso, mirándolo.
  // Club y escuela arman su puerta cuando el kit termina (asíncrono): si aún no está, se reintenta (hasta ~8 s) y se reubica.
  const pa = (M.R.puertas || []).find(p => p.lugar === L.id && p.acceso);
  if (!pa && ACCESO_TARDE.has(L.id) && (op._n || 0) < 26) setTimeout(() => { if (!M.salaActual) irALugar(M, def, nombre, { ...op, lista: false, _n: (op._n || 0) + 1 }); }, 300);
  if (pa) {
    const r = pa.rumbo, fx = Math.sin(r), fz = Math.cos(r), rx = Math.cos(r), rz = -Math.sin(r), A = pa.acceso;
    L = { ...L, x: pa.x + rx * A.a + fx * A.b, z: pa.z + rz * A.a + fz * A.b, nx: rx * A.na + fx * A.nb, nz: rz * A.na + fz * A.nb, acceso: true };
  }
  const fis = M.fis, tx = -L.nz, tz = L.nx;   // tangente a la fachada
  const yFachada = sueloEn(fis, L.x + L.nx * 3.5, L.z + L.nz * 3.5) ?? altura(L.x, L.z);   // 3,5 m: a 1,5 m el rayo a veces cae sobre el zócalo o el muro
  const objetivo = { x: L.x, z: L.z };
  let mejor = null;
  for (const flojo of [false, true]) {   // 1.ª pasada: suelo parejo; 2.ª (lugares en ladera, como la concentradora): se tolera pendiente
    for (const d of flojo ? [36, 28, 20, 12, 9] : [9, 7, 11, 6, 13, 15, 17, 4.5]) {   // primero un poco lejos (se ve la fachada entera); si no cabe, más cerca
      for (const off of [0, 2, -2, 4, -4, 6, -6, 9, -9]) {
        const x = L.x + L.nx * d + tx * off, z = L.z + L.nz * d + tz * off, y = libre(fis, x, z, yFachada, objetivo, flojo);
        if (y != null) { mejor = { x, y, z, d, off, flojo }; break; }
      }
      if (mejor) break;
    }
    if (mejor) break;
  }
  // sin sitio libre con vista: el punto de siempre (a 7 m) sobre el suelo, y se avisa
  const sinSitio = !mejor;
  if (!mejor) { const x = L.x + L.nx * 7, z = L.z + L.nz * 7; mejor = { x, y: sueloEn(fis, x, z, yFachada) ?? yFachada, z, d: 7, off: 0 }; }
  M.jug.teletransportar(mejor.x, mejor.y + 0.1, mejor.z);
  // mirando al lugar (el frente de la puerta está en -n): rumbo = dirección de avance de Nato; yaw 0 de la cámara mira a -Z
  const dx = L.x - mejor.x, dz = L.z - mejor.z;
  M.jug.rumbo = Math.atan2(dx, dz);
  M.cam.yaw = Math.atan2(-dx, -dz); M.cam.pitch = mejor.flojo ? 0.02 : 0.27; M.cam.dist = 7.5; M.cam.auto = 0; M.cam.cortar();
  const info = { ok: true, lugar: L.nombre, id: L.id, puerta: [+L.x.toFixed(1), +L.z.toFixed(1)], nato: [+mejor.x.toFixed(1), +mejor.y.toFixed(1), +mejor.z.toFixed(1)], d: mejor.d, sinSitio, ladera: !!mejor.flojo, acceso: !!L.acceso };
  G_info(M, info);
  if (sinSitio) setTimeout(() => import('../ui/hud.js').then(m => m.UI.aviso('&ir=' + nombre + ': sin suelo libre frente al lugar (se usó el punto a 7 m)', 3000)), 800);
  else setTimeout(() => import('../ui/hud.js').then(m => m.UI.aviso('Frente a: ' + L.nombre, 2200)), 800);
  return info;
}
function G_info(M, info) { M.irInfo = info; if (typeof window !== 'undefined' && window.JUEGO) window.JUEGO.irInfo = info; }

function avisoLista(texto) { setTimeout(() => import('../ui/hud.js').then(m => m.UI.aviso(texto, 9000)), 800); mostrarLista(null, null, texto); }
// &lugares=1: la lista del nivel queda escrita en una esquina (no atrapa el ratón)
function mostrarLista(def, nombres, texto) {
  if (typeof document === 'undefined') return;
  let d = document.getElementById('ir-lugares');
  if (!d) { d = document.createElement('div'); d.id = 'ir-lugares'; d.style.cssText = 'position:fixed;left:8px;top:8px;z-index:60;max-width:46vw;padding:6px 10px;background:rgba(0,0,0,.62);color:#ffe9a8;font:12px/1.35 monospace;border-radius:6px;pointer-events:none;white-space:pre-wrap'; document.body.appendChild(d); }
  d.textContent = texto || ('Lugares del nivel ' + def.numero + ' (&ir=…):\n' + nombres.map(n => '· ' + n).join('\n'));
}
void THREE;
