// N0-MAPA (carril juego, 14-11-2026): plano del nivel en el modo Historia (Tab, Select/Back del mando, botón 🗺 táctil, «Mapa» del menú de pausa).
// Mismo estilo que el plano del modo turista (js/mundo/turismo.js), pero con lo que importa al jugar: Nato y su rumbo, Hércules, fogatas
// (encendidas/apagadas), la meta, edificios con nombre, entradas visitables, apuntes (encontrados / cercanos pendientes), calles y la
// Escalera Central. Mientras está abierto el juego queda en pausa (G.pausa) y no se toca el HUD. En una sala muestra el plano de la sala.
// En el modo turista Tab sigue siendo el plano de turismo.js (aquí solo se reenvía la tecla).
import { P } from '../juego/logica.js';
import { UI } from './hud.js';
import { lugaresDelNivel } from '../mundo/irLugar.js';
import { enAnillo, CALLE } from '../mundo/ciudad.js';
import { SALAS } from '../datos/niveles.js';
import { EPOCAS } from '../datos/turismo.js';

const $ = id => document.getElementById(id);
const CSS = `
#map-capa { position: fixed; inset: 0; z-index: 30; background: #0b0910d9; display: flex; align-items: center; justify-content: center; padding: 12px; font-family: 'Trebuchet MS', 'DejaVu Sans', sans-serif; }
#map-caja { width: min(1100px, 100%); max-height: 100%; overflow: auto; padding-top: 8px; background: #f6ecd2; color: #2a1d10; border: 4px solid #6b4423; border-radius: 12px; padding: 8px 16px 10px; }
#map-caja h2 { margin: 0 0 2px; color: #8a3c0c; font-size: 22px; } #map-caja .sub { margin: 0 0 6px; font-size: 14px; opacity: .85; }
#map-caja .cerrar { float: right; font: bold 16px inherit; padding: 4px 12px; border-radius: 8px; border: 2px solid #6b4423; background: #3a2410; color: #fff; cursor: pointer; }
#map-cuerpo { display: flex; gap: 12px; flex-wrap: wrap; }
#map-cuerpo canvas { flex: 0 1 auto; height: min(780px, calc(100dvh - 118px)); width: auto; max-width: 100%; background: #efe3c2; border: 2px solid #b9a27a; border-radius: 8px; }
#map-lado { flex: 1 1 220px; max-height: calc(100dvh - 118px); overflow: auto; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
#map-lado .caja { padding: 7px 9px; background: #fff8e6; border: 1px solid #b9a27a; border-radius: 8px; }
#map-lado .caja b { color: #6b4423; }
#map-lado .leyenda i { display: inline-block; width: 14px; text-align: center; font-style: normal; margin-right: 5px; }
#map-lado .aviso { background: #ffe9a8; border-color: #d98a1c; }
#b-mapa { position: absolute; right: calc(max(14px, env(safe-area-inset-right))); top: 144px; width: 46px; height: 46px; font-size: 18px; border-radius: 50%; border: 3px solid #ffffffaa; background: #00000055; color: #fff; pointer-events: auto; }
body.turista #b-mapa { display: none; }
`;
let G = null;
export function iniciarMapa(juego) {
  G = juego;
  if (!$('map-estilo')) { const s = document.createElement('style'); s.id = 'map-estilo'; s.textContent = CSS; document.head.appendChild(s); }
  addEventListener('keydown', ev => {
    if (ev.code !== 'Tab') return;
    const M = G.M; if (!M || G.escena !== 'juego') return;
    ev.preventDefault(); if (ev.repeat || M.tur) return;   // en el modo turista Tab es del plano de turismo.js
    alternarMapa();
  });
}
export const mapaAbierto = () => !!document.getElementById('map-capa');
export function alternarMapa() {
  if (mapaAbierto()) cerrarMapa(); else abrirMapa();
}
export function cerrarMapa() {
  const c = $('map-capa'); if (c) c.remove();
  if (G && G.mapaPausa) { G.mapaPausa = false; G.pausa = false; }
}
export function abrirMapa() {
  const M = G && G.M; if (!M || G.escena !== 'juego' || M.tur || !M.def || !M.def.elementos || G.foto || UI.abierto || mapaAbierto()) return;
  if (G.pausa) return;   // el menú de pausa o una capa ya tienen el control (el botón del menú de pausa lo cierra antes)
  G.pausa = true; G.mapaPausa = true;
  if (document.pointerLockElement) document.exitPointerLock();
  const sala = M.salaActual && M.R.salas[M.salaActual];
  const capa = document.createElement('div'); capa.id = 'map-capa';
  const titulo = (EPOCAS && EPOCAS[P.nivel] ? EPOCAS[P.nivel].titulo : 'Nivel ' + P.nivel);
  capa.innerHTML = `<div id="map-caja"><button class="cerrar">Cerrar ✕ (Tab)</button><h2>🗺 ${sala ? 'Plano · ' + (sala.nombre || 'interior') : 'Plano · ' + titulo}</h2>
    <p class="sub">${sala ? 'Estás dentro de un edificio: este es el plano de la sala. Sal por la puerta para ver el plano del nivel.' : 'La pausa sigue activa mientras ves el plano. Tab, Esc o Select lo cierran.'}</p>
    <div id="map-cuerpo"><canvas id="map-lienzo" width="640" height="560"></canvas><div id="map-lado"></div></div></div>`;
  document.body.appendChild(capa);
  capa.querySelector('.cerrar').onclick = cerrarMapa;
  capa.addEventListener('mousedown', ev => { if (ev.target === capa) cerrarMapa(); });
  try { if (sala) planoSala(M, sala); else planoNivel(M); } catch (err) { console.warn('mapa:', err); }
}

// ------------------------------------------------------------------ utilidades de dibujo
function lienzo(x0, x1, z0, z1, tope = 1.5) {
  const cv = $('map-lienzo'), c = cv.getContext('2d');
  cv.width = 640; cv.height = Math.round(640 * Math.min(tope, Math.max(0.6, (z1 - z0) / (x1 - x0))));
  const k = Math.min(cv.width / (x1 - x0), cv.height / (z1 - z0)), ox = (cv.width - (x1 - x0) * k) / 2, oz = (cv.height - (z1 - z0) * k) / 2;
  return { cv, c, k, aP: (x, z) => [ox + (x - x0) * k, oz + (z - z0) * k] };
}
function texto(c, t, x, z, op = {}) {
  c.font = (op.neg ? 'bold ' : '') + (op.tam || 11) + 'px "DejaVu Sans", sans-serif'; c.textAlign = op.alin || 'left'; c.lineWidth = 3; c.strokeStyle = '#efe3c2e0'; c.strokeText(t, x, z); c.fillStyle = op.color || '#2a1d10'; c.fillText(t, x, z);
}
function nato(c, x, z, r) {
  c.save(); c.translate(x, z); c.rotate(-r + Math.PI); c.beginPath(); c.moveTo(0, -11); c.lineTo(7.5, 8); c.lineTo(-7.5, 8); c.closePath(); c.fillStyle = '#c0261f'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); c.restore();
}
function hercules(c, x, z) { c.beginPath(); c.arc(x, z, 6, 0, 7); c.fillStyle = '#c98b3c'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); texto(c, 'H', x + 8, z + 4, { neg: 1, tam: 11, color: '#7a4a14' }); }
function fogata(c, x, z, on) {
  c.beginPath(); c.moveTo(x, z - 9); c.lineTo(x + 6.5, z + 5); c.lineTo(x - 6.5, z + 5); c.closePath(); c.fillStyle = on ? '#ff8a1e' : '#8a8478'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = on ? '#fff3c0' : '#3a3630'; c.stroke();
}
function estrella(c, x, z, r) {
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, z + Math.sin(a) * q); } c.closePath();
  c.fillStyle = '#ffd34d'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#7a3c00'; c.stroke();
}
function escala(c, cv, k, unidad = 'm') {
  const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000]; let m = nice[0]; for (const n of nice) if (n * k <= cv.width * 0.3) m = n;
  const w = m * k, x = 14, z = cv.height - 14;
  c.strokeStyle = '#2a1d10'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, z - 4); c.lineTo(x, z); c.lineTo(x + w, z); c.lineTo(x + w, z - 4); c.stroke();
  texto(c, m + ' ' + unidad, x + w / 2, z - 7, { alin: 'center', neg: 1 });
}
function norte(c, cv, txt) {
  texto(c, txt || '↑ cerro arriba · ↓ estación y valle', cv.width - 8, cv.height - 8, { alin: 'right', tam: 11, color: '#6b4423' });
}
const lado = html => { $('map-lado').innerHTML = html; };
const nombreCorto = n => String(n).split(' (')[0].replace(/_/g, ' ').replace(/([a-z])(\d)/g, '$1 $2').replace(/^./, s => s.toUpperCase());
function especDe(M, t) { const lista = [...M.R.specs]; for (const s of Object.values(M.R.salas)) lista.push(...s.specs.map(q => ({ ...q, _sala: s.id }))); return lista.filter(s => s.t === t); }

// ------------------------------------------------------------------ plano del nivel
function planoNivel(M) {
  const def = M.def, R = M.R, J = M.jug;
  const lugares = lugaresDelNivel(def);
  const nombrePorEl = new Map(lugares.map(l => [l.e, l]));
  const fogs = M.L.de('fogata').filter(f => !f.sala), todasFog = (M.L.porTipo.fogata || []).filter(f => !f.sala);
  const metas = especDe(M, 'meta'), jefe = especDe(M, 'jefe')[0] || especDe(M, 'nido')[0];
  let meta = metas.find(s => !s._sala) || null, enSala = null;
  if (!meta && metas[0]) {   // la meta está dentro de una sala (el cine del N2): se marca la puerta de entrada
    const pu = (R.puertas || []).find(p => p.sala === metas[0]._sala && p.lado === 'entrada');
    if (pu) { meta = { x: pu.x, z: pu.z }; enSala = pu.nombre || 'el interior'; }
  }
  meta = meta || jefe || null;
  const apuntes = especDe(M, 'apunte').filter(s => !s._sala);
  const apuntesTot = especDe(M, 'apunte').length;
  const her = M.L.de('hercules')[0], hp = her && her.malla && her.malla.visible !== false ? her.malla.position : null;
  const puertas = (R.puertas || []).filter(p => p.lado === 'entrada' && !p.cerrada && p.nombre);
  // límites: edificios, plazas, escaleras, fogatas, meta y Nato (la vía y las calles largas no ensanchan el plano)
  const pts = [[J.pos.x, J.pos.z]];
  for (const e of def.elementos) { if ((e.t === 'edificio' || e.t === 'plaza') && isFinite(e.x) && isFinite(e.z)) pts.push([e.x, e.z]); else if (e.t === 'escalera' && isFinite(e.x0)) pts.push([e.x0, e.z0], [e.x1, e.z1]); }
  for (const f of todasFog) pts.push([f.x, f.z]);
  if (meta) pts.push([meta.x, meta.z]);
  const x0 = Math.min(...pts.map(p => p[0])) - 30, x1 = Math.max(...pts.map(p => p[0])) + 30, z0 = Math.min(...pts.map(p => p[1])) - 30, z1 = Math.max(...pts.map(p => p[1])) + 30;
  const { cv, c, k, aP } = lienzo(x0, x1, z0, z1);
  c.fillStyle = '#efe3c2'; c.fillRect(0, 0, cv.width, cv.height);
  c.save(); c.beginPath(); c.rect(0, 0, cv.width, cv.height); c.clip();
  // vía y andén
  for (const e of def.elementos) {
    if (e.t === 'via') { const [ax, az] = aP(e.x0, e.z), [bx, bz] = aP(e.x1, e.z); c.strokeStyle = '#6a6358'; c.lineWidth = 3; c.setLineDash([8, 4]); c.beginPath(); c.moveTo(ax, az); c.lineTo(bx, bz); c.stroke(); c.setLineDash([]); if (az > 0 && az < cv.height) texto(c, 'vía del tren', 8, az - 6, { tam: 10, color: '#6a6358' }); }
    else if (e.t === 'anden') { const [ax, az] = aP(e.x0, e.z), [bx] = aP(e.x1, e.z); c.fillStyle = '#c9b88f'; c.fillRect(ax, az - (e.ancho || 4) * k / 2, bx - ax, Math.max(2, (e.ancho || 4) * k)); }
  }
  // plazas
  for (const e of def.elementos) if (e.t === 'plaza' && isFinite(e.x) && e.sx) { const [px, pz] = aP(e.x, e.z); c.fillStyle = '#d9cdb0'; c.fillRect(px - e.sx * k / 2, pz - e.sz * k / 2, e.sx * k, e.sz * k); c.strokeStyle = '#a99a78'; c.lineWidth = 1; c.strokeRect(px - e.sx * k / 2, pz - e.sz * k / 2, e.sx * k, e.sz * k); }
  // calles de Sewell en cono: arcos de los anillos
  if (def.cono && def.cono.anillos) {
    c.lineCap = 'round'; c.strokeStyle = '#f7f0dc'; c.lineWidth = Math.max(2.5, CALLE * 2 * k);
    for (const A of def.cono.anillos) for (const L of Object.values(A.lados)) {
      const f0 = Math.min(L.f0, L.f1), f1 = Math.max(L.f0, L.f1), n = Math.max(6, Math.round((f1 - f0) * A.R / 6));
      c.beginPath(); for (let i = 0; i <= n; i++) { const p = enAnillo(A.ta, f0 + (f1 - f0) * i / n, 0), [qx, qz] = aP(p.x, p.z); c[i ? 'lineTo' : 'moveTo'](qx, qz); } c.stroke();
    }
  }
  // escaleras (la central más gruesa)
  c.lineCap = 'round';
  const central = id => /^tramo\d/.test(id);
  for (const [id, s] of Object.entries(R.escaleras || {})) {
    if (!s.a || !s.b) continue; const [ax, az] = aP(s.a.x, s.a.z), [bx, bz] = aP(s.b.x, s.b.z);
    c.strokeStyle = central(id) ? '#8a6a3a' : '#a89870'; c.lineWidth = Math.max(central(id) ? 4 : 2, (s.ancho || 2) * k); c.beginPath(); c.moveTo(ax, az); c.lineTo(bx, bz); c.stroke();
  }
  const ctr = Object.entries(R.escaleras || {}).filter(([id]) => central(id));
  if (ctr.length) { const s = ctr[Math.floor(ctr.length / 2)][1], [mx, mz] = aP((s.a.x + s.b.x) / 2, (s.a.z + s.b.z) / 2); texto(c, 'Escalera Central', mx + 8, mz, { neg: 1, tam: 11, color: '#6b4423' }); }
  // edificios
  const rotulos = [];
  for (const e of def.elementos) {
    if (e.t !== 'edificio' || !isFinite(e.x) || !e.largo) continue;
    let th = 0, w = e.largo, h = e.ancho || 8;
    if (e.giro != null) th = -e.giro * Math.PI / 180; else if ((e.rot || 0) % 180 !== 0) { w = e.ancho; h = e.largo; }
    const [cx, cz] = aP(e.x, e.z), nom = nombrePorEl.get(e); c.save(); c.translate(cx, cz); c.rotate(th);
    c.fillStyle = '#' + (e.color != null ? (e.color & 0xffffff).toString(16).padStart(6, '0') : 'b8a27a'); c.globalAlpha = nom ? 0.8 : 0.5; c.fillRect(-w * k / 2, -h * k / 2, w * k, h * k); c.globalAlpha = 1;
    c.strokeStyle = nom ? '#4a2c10' : '#6b4423'; c.lineWidth = nom ? 2 : 1; c.strokeRect(-w * k / 2, -h * k / 2, w * k, h * k); c.restore();
    if (nom) rotulos.push([nombreCorto(nom.nombre), cx, cz - Math.max(5, h * k / 2) - 3]);
  }
  // entradas visitables
  for (const p of puertas) { const [px, pz] = aP(p.x, p.z); c.beginPath(); c.moveTo(px, pz + 6); c.lineTo(px + 5, pz - 3); c.lineTo(px - 5, pz - 3); c.closePath(); c.fillStyle = '#e8590c'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = '#fff'; c.stroke(); }
  // rótulos de edificios sin encimarse
  const usados = []; c.font = 'bold 11px "DejaVu Sans", sans-serif';
  for (const [t, x, z] of rotulos) { const w = c.measureText(t).width; const r = [x - w / 2, z - 11, x + w / 2, z + 2]; if (usados.some(u => r[0] < u[2] && r[2] > u[0] && r[1] < u[3] && r[3] > u[1])) continue; usados.push(r); texto(c, t, x, z, { alin: 'center', neg: 1, color: '#4a2c10' }); }
  // apuntes: encontrados siempre; pendientes solo a menos de 60 m de Nato (los lejanos no se revelan)
  let encontrados = 0, cerca = 0;
  for (const s of apuntes) {
    const [px, pz] = aP(s.x, s.z), ya = P.apuntes && P.apuntes.has(s.i);
    if (ya) { encontrados++; c.fillStyle = '#2f8f4e'; c.fillRect(px - 5, pz - 5, 10, 10); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.strokeRect(px - 5, pz - 5, 10, 10); }
    else if (Math.hypot(s.x - J.pos.x, s.z - J.pos.z) < 60) { cerca++; c.fillStyle = '#d98a1c'; c.fillRect(px - 5, pz - 5, 10, 10); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.strokeRect(px - 5, pz - 5, 10, 10); texto(c, '?', px, pz + 4, { alin: 'center', neg: 1, tam: 10, color: '#fff' }); }
  }
  // fogatas
  for (const f of todasFog) { const [px, pz] = aP(f.x, f.z); fogata(c, px, pz, f.encendida); }
  // meta y línea hacia ella
  if (meta) {
    const [mx, mz] = aP(meta.x, meta.z), [nx0, nz0] = aP(J.pos.x, J.pos.z);
    c.setLineDash([5, 5]); c.strokeStyle = '#7a3c00aa'; c.lineWidth = 2; c.beginPath(); c.moveTo(nx0, nz0); c.lineTo(mx, mz); c.stroke(); c.setLineDash([]);
    estrella(c, mx, mz, 11); texto(c, meta === jefe ? 'Jefe' : enSala ? 'Meta: ' + nombreCorto(enSala) : 'Meta', mx + 13, mz + 4, { neg: 1, color: '#7a3c00' });
  }
  if (hp) { const [px, pz] = aP(hp.x, hp.z); hercules(c, px, pz); }
  { const [px, pz] = aP(J.pos.x, J.pos.z); nato(c, px, pz, J.rumbo || 0); texto(c, 'Nato', px + 11, pz - 6, { neg: 1, color: '#c0261f' }); }
  c.restore();
  escala(c, cv, k); norte(c, cv);
  const enc = todasFog.filter(f => f.encendida).length, dm = meta ? Math.round(Math.hypot(meta.x - J.pos.x, meta.z - J.pos.z)) : null;
  const entr = [...new Set(puertas.map(p => p.nombre))];
  lado(`<div class="caja leyenda"><b>Leyenda</b><br><i style="color:#c0261f">▲</i>Nato (hacia donde mira) · <i style="color:#c98b3c">●</i>Hércules<br><i style="color:#ff8a1e">▲</i>fogata encendida · <i style="color:#8a8478">▲</i>apagada<br>
    <i style="color:#e8590c">▼</i>entrada a un edificio · <i style="color:#2f8f4e">■</i>apunte encontrado · <i style="color:#d98a1c">■</i>apunte cercano<br><i style="color:#ffb400">★</i>${meta === jefe ? 'el jefe' : 'meta'} · trazo claro: calle · trazo oscuro: escalera</div>
    <div class="caja"><b>Objetivo</b><br>${meta ? (meta === jefe ? 'Llegar hasta el jefe' : enSala ? 'Entrar a «' + nombreCorto(enSala) + '» y llegar a la meta' : 'Llegar a la meta') + (dm != null ? ' · a ' + dm + ' m en línea recta' : '') : 'Seguir subiendo por la ruta.'}</div>
    <div class="caja"><b>Fogatas</b> ${enc}/${todasFog.length} encendidas<br><b>Apuntes</b> ${P.apuntes ? P.apuntes.size : 0}/${apuntesTot}${cerca ? ' · ' + cerca + ' cerca de ti' : ''}<br><b>Pepitas</b> ${P.pepitas || 0}</div>
    ${entr.length ? `<div class="caja"><b>Se puede entrar</b><br>${entr.join(' · ')}</div>` : ''}
    <div class="caja">Escala en metros abajo a la izquierda. Los apuntes sin encontrar solo aparecen cuando estás cerca.</div>`);
}

// ------------------------------------------------------------------ plano de una sala (interior)
function planoSala(M, sala) {
  const S = SALAS[sala.id], O = sala.origen, J = M.jug;
  let W = S ? S.ancho : sala.X ? sala.X * 2 : null, L = S ? S.largo : sala.D || null;
  const aviso = '<div class="caja aviso"><b>Aviso</b><br>Estás dentro de «' + (sala.nombre || 'un interior') + '». El plano del nivel se ve al salir por la puerta.</div>';
  if (!W || !L) { W = Math.max(14, Math.abs(J.pos.x - O.x) * 2 + 10); L = Math.max(14, Math.abs(J.pos.z - O.z) + 10); }
  const x0 = -W / 2 - 2, x1 = W / 2 + 2, z0 = -L - 2, z1 = 2;
  const { cv, c, k, aP } = lienzo(x0, x1, z0, z1, 1.9);
  const A = (x, z) => aP(x - O.x, z - O.z);
  c.fillStyle = '#efe3c2'; c.fillRect(0, 0, cv.width, cv.height);
  { const [ax, az] = aP(-W / 2, -L), [bx, bz] = aP(W / 2, 0); c.fillStyle = '#e1d3ab'; c.fillRect(ax, az, bx - ax, bz - az); c.strokeStyle = '#4a2c10'; c.lineWidth = 3; c.strokeRect(ax, az, bx - ax, bz - az); }
  for (const a of sala.agua || []) { const [ax, az] = A(a.x0, a.z0), [bx, bz] = A(a.x1, a.z1); c.fillStyle = '#8fc3e0aa'; c.fillRect(Math.min(ax, bx), Math.min(az, bz), Math.abs(bx - ax), Math.abs(bz - az)); }
  const puerta = (p, t) => { if (!p) return; const [px, pz] = A(p.x, p.z); c.fillStyle = '#e8590c'; c.fillRect(px - 9, pz - 4, 18, 8); c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.strokeRect(px - 9, pz - 4, 18, 8); texto(c, t, px + 13, pz + 4, { neg: 1, color: '#8a3c0c' }); };
  puerta(sala.entrada, 'entrada'); puerta(sala.salida, 'salida');
  const dentro = M.L.lista.filter(e => e.vivo && e.sala === sala.id);
  let fog = 0, fogOn = 0;
  for (const e of dentro) {
    if (!isFinite(e.x) || !isFinite(e.z)) continue; const [px, pz] = A(e.x, e.z);
    if (e.tipo === 'fogata') { fog++; if (e.encendida) fogOn++; fogata(c, px, pz, e.encendida); }
    else if (e.tipo === 'meta') estrella(c, px, pz, 10);
    else if (e.tipo === 'apunte') { c.fillStyle = '#d98a1c'; c.fillRect(px - 5, pz - 5, 10, 10); c.strokeStyle = '#fff'; c.strokeRect(px - 5, pz - 5, 10, 10); }
    else if (e.tipo === 'ascensor') { c.fillStyle = '#7a7468'; c.fillRect(px - 6, pz - 6, 12, 12); texto(c, 'ascensor', px + 9, pz + 4, { tam: 10 }); }
  }
  const her = M.L.de('hercules')[0]; if (her && her.malla && her.malla.visible !== false) { const [px, pz] = A(her.malla.position.x, her.malla.position.z); hercules(c, px, pz); }
  { const [px, pz] = A(J.pos.x, J.pos.z); nato(c, px, pz, J.rumbo || 0); texto(c, 'Nato', px + 11, pz - 6, { neg: 1, color: '#c0261f' }); }
  escala(c, cv, k); norte(c, cv, 'plano de la sala');
  lado(aviso + `<div class="caja leyenda"><b>Leyenda</b><br><i style="color:#c0261f">▲</i>Nato · <i style="color:#c98b3c">●</i>Hércules · <i style="color:#e8590c">▬</i>puerta<br><i style="color:#ff8a1e">▲</i>fogata · <i style="color:#d98a1c">■</i>apunte · <i style="color:#ffb400">★</i>meta</div>
    <div class="caja"><b>Sala</b> ${Math.round(W)} × ${Math.round(L)} m${fog ? ' · fogatas ' + fogOn + '/' + fog : ''}</div>`);
}
