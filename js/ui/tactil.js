// M-MOVIL (carril móvil, 14-11-2026): controles táctiles y adaptación de la interfaz al celular.
// - Palanca virtual a la izquierda (aparece donde se apoya el pulgar en la mitad izquierda); a fondo = correr.
// - Arrastrar en la mitad derecha mueve la cámara. Multitáctil real: cada dedo se sigue por su pointerId.
// - Botones: saltar, golpe y patada (solo modo Historia), Hércules (solo Historia), acción/entrar (E), mapa (Tab) y pausa.
// - Se esconde sola fuera del juego (título, pausa, mapa, apunte, tarjeta, carga).
// - Pantalla completa y orientación horizontal al tocar «Jugar» (cuando el navegador lo permite); en vertical se puede jugar
//   igual, con un aviso breve de que en horizontal se ve mejor.
// Escribe en js/motor/entrada.js: ponerPalanca(), sumarMirada() y E.b[n]._t/_p (lo mismo que el teclado escribe en _k/_p).
import { E, ponerPalanca, sumarMirada } from '../motor/entrada.js';

const $ = id => document.getElementById(id);
const SENS = 1.7;   // píxeles de dedo → «píxeles de ratón» (0,0028 rad cada uno): media pantalla ≈ 100°

const CSS = `
#tc { position: fixed; inset: 0; z-index: 5; pointer-events: none; touch-action: none; user-select: none; -webkit-user-select: none; }
#tc .zona { position: absolute; top: 0; bottom: 0; pointer-events: auto; touch-action: none; }
#tc-izq { left: 0; width: 45%; }
#tc-der { right: 0; width: 55%; }
#tc-base { position: absolute; width: var(--pal); height: var(--pal); margin: calc(var(--pal) / -2) 0 0 calc(var(--pal) / -2); border-radius: 50%;
  background: #ffffff1c; border: 3px solid #ffffff55; opacity: .55; transition: opacity .15s; pointer-events: none; }
#tc-base.activa { opacity: .9; transition: none; }
#tc-pomo { position: absolute; left: 50%; top: 50%; width: 44%; height: 44%; margin: -22% 0 0 -22%; border-radius: 50%; background: #ffffffaa; }
#tc-base.corre #tc-pomo { background: #ffd34dcc; }
#tc .b { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; border: 3px solid #ffffffaa; background: #0000004d; color: #fff;
  font: bold calc(var(--bt) * .34) 'Trebuchet MS', 'DejaVu Sans', sans-serif; display: flex; align-items: center; justify-content: center; flex-direction: column;
  width: var(--bt); height: var(--bt); opacity: .5; padding: 0; line-height: 1; text-shadow: 0 1px 2px #000; }
#tc .b small { font-size: 11px; font-weight: normal; margin-top: 2px; opacity: .9; }
#tc .b.apretado { opacity: .95; background: #ffffff40; }
#tc .b.chico { width: var(--bc); height: var(--bc); font-size: calc(var(--bc) * .4); }
#tc-saltar { width: var(--bg) !important; height: var(--bg) !important; font-size: calc(var(--bg) * .3) !important; }
#tc.turista .ataque { display: none; }
#tc.solo-pausa > :not(#tc-pausa):not(#tc-der) { display: none; }
#tc-giro { position: fixed; left: 50%; top: calc(max(8px, env(safe-area-inset-top)) + 70px); transform: translateX(-50%); z-index: 6; background: #14182ee6; color: #fff; border: 2px solid #f3e6c8;
  border-radius: 12px; padding: 12px 16px; font: bold 16px 'Trebuchet MS', 'DejaVu Sans', sans-serif; text-align: center; max-width: 82vw; pointer-events: none; transition: opacity .4s; }
#tc-giro .tel { font-size: 34px; display: block; animation: tc-girar 1.6s ease-in-out infinite; }
@keyframes tc-girar { 0%, 30% { transform: rotate(0); } 60%, 100% { transform: rotate(-90deg); } }

/* ===== interfaz en el celular (body.movil) ===== */
body.movil #titulo, body.movil #pausa { z-index: 10; justify-content: safe center; overflow-y: auto; padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); }
body.movil .menu { min-width: min(300px, 88vw); }
body.movil .menu button, body.movil .menu select { min-height: 46px; }
body.movil #titulo .controles { display: none; }
body.movil #titulo .controles-tactil { display: block; font-size: 13px; opacity: .8; margin-top: 12px; max-width: 520px; }
.controles-tactil { display: none; }
body.movil #modal, body.movil #tarjeta, body.movil #burbuja { z-index: 10; }
body.movil #modal-caja { max-height: 84dvh; overflow-y: auto; font-size: 17px; }
body.movil #tarjeta-caja { font-size: clamp(16px, 4.4vw, 22px); max-height: 92dvh; overflow-y: auto; }
body.movil #tarjeta-caja h1 { font-size: clamp(24px, 7vw, 34px); }
body.movil #burbuja { bottom: auto; top: calc(max(8px, env(safe-area-inset-top)) + 64px); font-size: 16px; max-width: min(560px, 38vw); padding: 8px 12px; }
body.movil #hud-izq { top: max(8px, env(safe-area-inset-top)); font-size: 19px; }
body.movil #hud-der { top: max(8px, env(safe-area-inset-top)); right: calc(max(10px, env(safe-area-inset-right)) + var(--bc) * 2 + 36px); font-size: 17px; }   /* M-MOVIL-b: 36 px de aire respecto de 🗺 */
body.movil #hud-energia .barra { width: 96px; }
body.movil #hud-zona { font-size: 22px; top: max(8px, env(safe-area-inset-top)); left: 20%; width: 46%; }   /* M-MOVIL-b: entre el HUD y los botones, sobre la burbuja */
body.movil #hud-aviso { font-size: 17px; bottom: auto; top: 52%; left: 28%; width: 44%; padding: 0; }
body.movil #hud-fps { left: 50%; transform: translateX(-50%); bottom: max(4px, env(safe-area-inset-bottom)); }
body.movil #map-capa, body.movil #tur-capa { padding: max(6px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right)) max(6px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left)); }
body.movil #map-caja, body.movil #tur-caja { padding: 6px 10px; }
body.movil #map-caja .cerrar, body.movil #tur-caja .cerrar { min-height: 44px; min-width: 44px; font-size: 17px; }
body.movil #map-caja h2 { font-size: 18px; }
body.movil #tur-barra { top: max(8px, env(safe-area-inset-top)); right: calc(max(10px, env(safe-area-inset-right)) + var(--bc) * 2 + 36px); font-size: 13px; z-index: 9; }   /* M-MOVIL-b: bajo la pausa (z 10) y sin 🗺 duplicado */
body.movil #tur-b-plano { display: none; }
body.movil #tur-flecha, body.movil #tur-ficha { z-index: 9; }
body.movil #tur-barra button { min-height: 40px; }
body.movil #tur-ficha { bottom: auto; top: calc(max(8px, env(safe-area-inset-top)) + 54px); font-size: 14px; width: min(380px, 62vw); }
body.movil #tur-lista button { min-height: 40px; }
@media (orientation: portrait) {
  body.movil #map-cuerpo canvas, body.movil #tur-plano canvas { width: 100%; height: auto; max-height: 62dvh; object-fit: contain; }
  body.movil #map-lado { max-height: none; }
  body.movil #burbuja { max-width: 92vw; top: 36dvh; }
  body.movil #hud-der { top: calc(max(8px, env(safe-area-inset-top)) + var(--bc) + 14px); right: max(10px, env(safe-area-inset-right)); }
  body.movil #hud-zona { top: 27%; left: 0; width: 100%; font-size: 20px; }
  body.movil #hud-aviso { top: 31%; left: 6%; width: 88%; }
  body.movil #hud-fps { left: 0; width: 100%; transform: none; bottom: 1px; font-size: 10px; white-space: nowrap; text-align: center; }
  #tc-giro { top: 58dvh; }
  body.movil #tur-barra { top: calc(max(8px, env(safe-area-inset-top)) + var(--bc) + 14px); right: max(10px, env(safe-area-inset-right)); }
  body.movil #tur-ficha { width: calc(100vw - 24px); top: 36dvh; }
  body.movil #tur-flecha { top: calc(max(8px, env(safe-area-inset-top)) + var(--bc) + 58px); }
}
@media (orientation: landscape) and (max-height: 500px) {
  body.movil.turista #hud-zona { width: 28%; }
  /* 17-11 (Diego, iPhone 17e en horizontal: «el menú se ve muy grande y tapa todo el fondo»): panel compacto a la izquierda,
     el vuelo de cámara sobre Sewell queda a la vista a la derecha */
  body.movil #titulo { align-items: flex-start; text-align: left; background: linear-gradient(90deg, rgba(10,14,22,.72) 0%, rgba(10,14,22,.45) 34%, rgba(10,14,22,0) 58%); }
  body.movil #titulo h1 { font-size: 20px; margin: 0; } body.movil #titulo h2 { font-size: 13px; margin: 2px 0 6px; } body.movil #titulo .nota { display: none; }
  body.movil #titulo .menu { display: flex; flex-direction: column; gap: 5px; width: min(270px, 38vw); min-width: 0; }
  body.movil #titulo .menu > * { min-width: 0; font-size: 13px; }
  body.movil #titulo .menu button, body.movil #titulo .menu select { min-height: 32px; padding: 3px 8px; font-size: 14px; }
  body.movil #titulo .menu label { display: flex; align-items: center; gap: 6px; } body.movil #titulo .menu label select { flex: 1; min-width: 0; width: auto; }
  body.movil #titulo .controles-tactil { display: none; }
  body.movil #pausa .menu { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: min(560px, 92vw); }
  body.movil #pausa .menu h2 { grid-column: 1 / -1; margin: 0; }
  body.movil #map-cuerpo { flex-wrap: nowrap; } body.movil #map-cuerpo canvas { height: calc(100dvh - 76px); }
  body.movil #map-lado { max-height: calc(100dvh - 76px); }
  body.movil #map-caja .sub { display: none; }
  body.movil #tur-plano { flex-wrap: nowrap; } body.movil #tur-plano canvas { height: calc(100dvh - 90px); }
  body.movil #tur-lista { max-height: calc(100dvh - 90px); overflow-y: auto; }
}
`;

// botón → nombre en E.b; clase «ataque» = no existe en el modo turístico
const BOTONES = [
  { id: 'tc-saltar', b: 'saltar', txt: '⤒', sub: 'saltar' },
  { id: 'tc-golpe', b: 'golpe', txt: '✊', sub: 'golpe', ataque: 1 },
  { id: 'tc-patada', b: 'patada', txt: '🦶', sub: 'patada', ataque: 1, chico: 1 },
  { id: 'tc-hercules', b: 'hercules', txt: '🐕', sub: 'Hércules', ataque: 1, chico: 1 },
  { id: 'tc-accion', b: 'accion', txt: '✋', sub: 'entrar' },
  { id: 'tc-mapa', b: 'mapa', txt: '🗺', chico: 1 },
  { id: 'tc-pausa', b: 'pausa', txt: '❚❚', chico: 1 },
];

let raiz = null, base = null, pomo = null;
let dedoPal = null, tragarClic = 0;           // { id, cx, cy }
const dedosCam = new Map();   // pointerId → { x, y }
export const TACTIL = { activo: false, visible: false, turista: false, dedosCam, get palanca() { return dedoPal; } };   // pruebas

export function prepararTactil() {
  // la vieja palanca del index.html (si quedara) se retira: ahora todo vive aquí
  $('tactil')?.remove();
  if (!E.esTactil) return;
  TACTIL.activo = true;
  if (E.movil) document.body.classList.add('movil');
  if (!$('tc-estilo')) { const s = document.createElement('style'); s.id = 'tc-estilo'; s.textContent = CSS; document.head.appendChild(s); }
  ayudaTitulo();
  raiz = document.createElement('div'); raiz.id = 'tc'; raiz.className = 'oculto';
  raiz.innerHTML = `<div id="tc-izq" class="zona"></div><div id="tc-der" class="zona"></div><div id="tc-base"><div id="tc-pomo"></div></div>` +
    BOTONES.map(o => `<button id="${o.id}" class="b${o.ataque ? ' ataque' : ''}${o.chico ? ' chico' : ''}" data-b="${o.b}" aria-label="${o.sub || o.b}">${o.txt}${o.sub && !o.chico ? `<small>${o.sub}</small>` : ''}</button>`).join('');
  document.body.appendChild(raiz);
  base = $('tc-base'); pomo = $('tc-pomo');
  medidas(); addEventListener('resize', medidas); screen.orientation?.addEventListener?.('change', medidas);

  // ----- palanca (mitad izquierda): aparece bajo el pulgar
  const zi = $('tc-izq');
  zi.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    if (dedoPal) return;   // ya hay un pulgar en la palanca: este dedo no cuenta
    try { zi.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    dedoPal = { id: ev.pointerId, cx: ev.clientX, cy: ev.clientY };
    base.style.left = ev.clientX + 'px'; base.style.top = ev.clientY + 'px'; base.classList.add('activa');
    moverPal(ev);
  });
  const moverPal = ev => {
    if (!dedoPal || ev.pointerId !== dedoPal.id) return;
    const rad = radio();
    let dx = (ev.clientX - dedoPal.cx) / rad, dy = (ev.clientY - dedoPal.cy) / rad;
    const l = Math.hypot(dx, dy);
    if (l > 1.35) {   // el pulgar se fue lejos: la base lo sigue (no hay que volver al centro para cambiar de dirección)
      dedoPal.cx = ev.clientX - dx / l * 1.35 * rad; dedoPal.cy = ev.clientY - dy / l * 1.35 * rad;
      base.style.left = dedoPal.cx + 'px'; base.style.top = dedoPal.cy + 'px';
    }
    if (l > 1) { dx /= l; dy /= l; }
    const m = Math.hypot(dx, dy), k = m < 0.12 ? 0 : (m - 0.12) / 0.88 / (m || 1);   // zona muerta
    ponerPalanca(dx * k, -dy * k);
    pomo.style.transform = `translate(${dx * 70}%, ${dy * 70}%)`;
    base.classList.toggle('corre', m * 1 > 0.92);
  };
  zi.addEventListener('pointermove', moverPal);
  const soltarPal = ev => { if (dedoPal && ev.pointerId === dedoPal.id) soltarPalanca(); };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) zi.addEventListener(t, soltarPal);

  // ----- cámara (mitad derecha y todo lo que no es un botón)
  const zd = $('tc-der');
  zd.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    try { zd.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    dedosCam.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  });
  zd.addEventListener('pointermove', ev => {
    const t = dedosCam.get(ev.pointerId); if (!t) return;
    sumarMirada((ev.clientX - t.x) * SENS, (ev.clientY - t.y) * SENS * 0.8); t.x = ev.clientX; t.y = ev.clientY;
  });
  const soltarCam = ev => dedosCam.delete(ev.pointerId);
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) zd.addEventListener(t, soltarCam);

  // ----- botones: pulsación con _p (no se pierde aunque el dedo se levante antes del cuadro) y estado con _t
  for (const el of raiz.querySelectorAll('.b')) {
    const n = el.dataset.b;
    el.addEventListener('pointerdown', ev => {
      ev.preventDefault(); ev.stopPropagation();
      try { el.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
      E.b[n]._t = E.b[n]._p = true; el.classList.add('apretado');
      if (navigator.vibrate && E.movil) try { navigator.vibrate(8); } catch (e) { /* sin vibración */ }
    });
    const fin = () => { E.b[n]._t = false; el.classList.remove('apretado'); tragarClic = performance.now(); };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, fin);
    el.addEventListener('contextmenu', ev => ev.preventDefault());
  }
  // el «click» que el navegador manda al levantar el dedo cae en lo que quedó debajo: al abrir el mapa con 🗺 caía en su
  // «Cerrar ✕» (mismo rincón) y lo cerraba al tiro. Se descarta el clic que sigue a un botón táctil.
  document.addEventListener('click', ev => { if (performance.now() - tragarClic < 450 && !ev.target.closest('#tc')) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  // sin menú contextual ni lupa por toque largo, y sin zoom con dos dedos / doble toque en todo el juego
  addEventListener('contextmenu', ev => { if (ev.target.closest('#tc, #lienzo')) ev.preventDefault(); });
  for (const t of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(t, ev => ev.preventDefault(), { passive: false });
  document.addEventListener('touchmove', ev => { if (ev.touches.length > 1 || ev.target.closest('#tc, #lienzo')) ev.preventDefault(); }, { passive: false });

  pantallaCompleta();
  setInterval(revisar, 150);
}

function soltarPalanca() {
  dedoPal = null; ponerPalanca(null);
  if (pomo) pomo.style.transform = '';
  if (base) { base.classList.remove('activa', 'corre'); reposo(); }
}
const radio = () => (base && base.offsetWidth ? base.offsetWidth / 2 : (parseFloat(document.documentElement.style.getPropertyValue('--pal')) || 120) / 2);   // oculta mide 0: se usa --pal
function reposo() {   // la base en reposo, abajo a la izquierda (zona segura incluida)
  let sonda = $('tc-sonda');   // env(safe-area-inset-*) no se puede leer directo: se mide en un div con ese relleno
  if (!sonda) { sonda = document.createElement('div'); sonda.id = 'tc-sonda'; sonda.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(sonda); }
  const cs = getComputedStyle(sonda), sl = parseFloat(cs.paddingLeft) || 0, sb = parseFloat(cs.paddingBottom) || 0;
  base.style.left = (Math.max(18, sl) + radio() + 14) + 'px';
  base.style.top = (innerHeight - Math.max(18, sb) - radio() - 14) + 'px';
}

// tamaños según la pantalla: palanca, botón grande (saltar), botones normales y chicos; posiciones con env(safe-area-inset-*)
function medidas() {
  if (!raiz) return;
  const v = Math.min(innerWidth, innerHeight), vertical = innerHeight > innerWidth;
  const pal = Math.round(Math.max(110, Math.min(170, v * (vertical ? 0.36 : 0.36))));
  const bg = Math.round(Math.max(64, Math.min(92, v * (vertical ? 0.2 : 0.22))));
  const bt = Math.round(bg * 0.8), bc = Math.round(Math.max(44, Math.min(54, bg * 0.6)));
  const st = document.documentElement.style;
  st.setProperty('--pal', pal + 'px'); st.setProperty('--bg', bg + 'px'); st.setProperty('--bt', bt + 'px'); st.setProperty('--bc', bc + 'px');
  // posiciones (right/bottom en calc con la zona segura)
  const R = x => `calc(max(14px, env(safe-area-inset-right)) + ${x}px)`, B = y => `calc(max(14px, env(safe-area-inset-bottom)) + ${y}px)`;
  const T = y => `calc(max(8px, env(safe-area-inset-top)) + ${y}px)`;
  const pos = {
    'tc-saltar': { right: R(0), bottom: B(0) },
    'tc-golpe': { right: R(bg + 12), bottom: B(Math.round(bg * 0.1)) },
    'tc-accion': { right: R(Math.round(bg * 0.1)), bottom: B(bg + 12) },
    'tc-patada': { right: R(bg + bt + 22), bottom: B(Math.round(bg * 0.15)) },
    'tc-hercules': { right: R(bg + 12 + Math.round((bt - bc) / 2)), bottom: B(bg + 18 + Math.round(bg * 0.05)) },
    'tc-pausa': { right: R(0), top: T(0) },
    'tc-mapa': { right: R(bc + 10), top: T(0) },
  };
  for (const [id, p] of Object.entries(pos)) { const el = $(id); if (!el) continue; el.style.right = p.right || ''; el.style.bottom = p.bottom || ''; el.style.top = p.top || ''; }
  // en turismo la acción baja al lugar del golpe (que no existe) para quedar al alcance del pulgar
  if (TACTIL.turista) { const a = $('tc-accion'); a.style.right = R(bg + 12); a.style.bottom = B(Math.round(bg * 0.1)); }
  if (!dedoPal && base) reposo();
}

// mostrar/ocultar según lo que hay en pantalla
function revisar() {
  const G = window.JUEGO; if (!raiz || !G) return;
  const visible = (id) => { const el = $(id); return !!el && !el.classList.contains('oculto') && el.offsetParent !== null; };
  const enJuego = G.escena === 'juego' && !!G.M && !G.pausa && !G.foto && !$('map-capa') && !$('tur-capa') && !visible('modal') && !visible('tarjeta') && !visible('carga');
  if (enJuego !== TACTIL.visible) {
    TACTIL.visible = enJuego; raiz.classList.toggle('oculto', !enJuego);
    if (!enJuego) { soltarPalanca(); dedosCam.clear(); for (const o of BOTONES) E.b[o.b]._t = false; }
  }
  // en la pausa del modo foto se necesita el botón de pausa para salir: se muestra solo ese
  if (G.foto && G.escena === 'juego') { raiz.classList.remove('oculto'); raiz.classList.add('solo-pausa'); } else raiz.classList.remove('solo-pausa');
  const tur = !!(G.M && G.M.tur);
  if (tur !== TACTIL.turista) { TACTIL.turista = tur; raiz.classList.toggle('turista', tur); medidas(); }
  avisoGiro(enJuego && E.movil && innerHeight > innerWidth * 1.15);
}

// aviso «gira el teléfono»: el juego se puede jugar en vertical, pero en horizontal se ve mucho más; se muestra una vez por
// carga en vertical, no estorba a los dedos (pointer-events: none) y se va a los 6 s
let giroVisto = false;
function avisoGiro(ver) {
  let el = $('tc-giro');
  if (!ver || giroVisto) { if (el && !ver) el.remove(); return; }
  giroVisto = true;
  el = document.createElement('div'); el.id = 'tc-giro';
  el.innerHTML = '<span class="tel">📱</span>Gira el teléfono: en horizontal se ve y se juega mejor';
  document.body.appendChild(el); setTimeout(() => el.remove(), 6000);
}

// ayuda de controles táctiles en el título (la del teclado se esconde en el celular)
function ayudaTitulo() {
  const t = $('titulo'); if (!t || t.querySelector('.controles-tactil')) return;
  const p = document.createElement('p'); p.className = 'controles-tactil';
  p.textContent = 'Pulgar izquierdo: caminar (a fondo, correr) · Dedo derecho: mover la cámara · ⤒ saltar · ✊ golpe · ✋ entrar/hablar · 🗺 mapa · ❚❚ pausa';
  t.appendChild(p);
}

// pantalla completa + horizontal al tocar «Jugar» o una época del modo turístico (solo en el celular; si el navegador no deja, nada)
function pantallaCompleta() {
  if (!E.movil) return;
  document.addEventListener('click', ev => {
    if (!ev.target.closest('#t-jugar, #t-epocas button[data-n]')) return;
    const d = document.documentElement;
    if (document.fullscreenElement || !d.requestFullscreen) return;
    d.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => { /* iOS Safari y otros: sin pantalla completa ni bloqueo */ })
      .finally(() => setTimeout(medidas, 300));
  }, true);
}
