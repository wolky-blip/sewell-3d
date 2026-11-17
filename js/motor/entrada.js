// Controles: teclado + ratón, pantalla táctil (palanca y botones) y mando (Gamepad API).
// Se lee como un estado: E.mover (x, y en -1..1), E.mirar (dx, dy por cuadro) y botones con .apretado / .recien.
export const E = {
  mover: { x: 0, y: 0 }, mirar: { x: 0, y: 0 },
  correr: false,  // Shift en el teclado; palanca o control empujados a fondo (pedido de Diego: con letras o flechas camina)
  b: {}, esTactil: false, movil: false,   // M-MOVIL: se calculan abajo (perfil «Móvil» automático; ?movil=1 lo fuerza y ?movil=0 lo apaga)
  piloto: null,   // el piloto automático de las pruebas escribe aquí sus entradas
  texto: '',      // últimas letras (atajos NATO1–NATO4)
};
// M-MOVIL: perfil «Móvil» = puntero grueso (dedo), o pantalla táctil chica, o pantalla muy chica. ?movil=1 / ?movil=0 mandan.
{
  const q = new URLSearchParams(location.search).get('movil');
  const grueso = matchMedia('(pointer: coarse)').matches, toque = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
  const lado = Math.min(screen.width || innerWidth, screen.height || innerHeight);
  E.movil = q === '1' ? true : q === '0' ? false : grueso || (toque && lado <= 900) || lado < 500;
  E.esTactil = E.movil || grueso || location.search.includes('tactil');
}
const BOTONES = ['saltar', 'golpe', 'patada', 'hercules', 'accion', 'pausa', 'foto', 'mapa'];
for (const n of BOTONES) E.b[n] = { apretado: false, recien: false, pend: 0, _t: false, _g: false, _k: false, _p: false, _pm: false };
// ===== N0-CTRL (carril juego, 14-11-2026): «presiono saltar y no siempre lo hace» =====
// Causa raíz: .recien se calculaba por CUADRO (apretado ahora y no en el cuadro anterior) pero lo consume el PASO de física (1/60 s,
// con acumulador). En los cuadros sin paso (monitor de 75/120/144 Hz, o el vaivén normal de requestAnimationFrame a 60 Hz) el flanco
// se calculaba, nadie lo leía y al cuadro siguiente ya era «apretado de antes»: la pulsación se perdía. Con 144 Hz se perdía ~la mitad.
// Ahora cada pulsación (keydown, toque, botón del mando visto por el sondeo rápido) queda como PENDIENTE (pend = instante) hasta
// que el siguiente paso de física la toma con tomarPulsos(); si ningún paso la toma en 250 ms (pausa, menú) se descarta.
const PASO_BOTONES = ['saltar', 'golpe', 'patada', 'hercules', 'accion'];
export function tomarPulsos() {   // antes de CADA paso de física: .recien = hubo pulsación desde el paso anterior
  const t = performance.now();
  for (const n of PASO_BOTONES) { const b = E.b[n]; b.recien = !!b.pend && t - b.pend < 250; b.pend = 0; }
}
export function olvidarPulsos() { for (const n of BOTONES) E.b[n].pend = 0; }   // pausa, apunte abierto, menú: no se guardan para después

const TECLAS = {
  Space: 'saltar', KeyZ: 'saltar', KeyJ: 'golpe', KeyX: 'golpe', KeyK: 'patada', KeyC: 'hercules', KeyH: 'hercules', KeyL: 'hercules',
  KeyE: 'accion', Enter: 'accion', Escape: 'pausa', KeyP: 'pausa', KeyF: 'foto',
};
const teclas = new Set();
addEventListener('keydown', ev => {
  if (ev.repeat) return;
  teclas.add(ev.code);
  if (TECLAS[ev.code]) { E.b[TECLAS[ev.code]]._k = true; E.b[TECLAS[ev.code]]._p = true; }   // _p: la pulsación cuenta aunque se suelte antes del siguiente cuadro
  if (ev.key && ev.key.length === 1) E.texto = (E.texto + ev.key.toUpperCase()).slice(-8);
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(ev.code)) ev.preventDefault();
});
addEventListener('keyup', ev => { teclas.delete(ev.code); if (TECLAS[ev.code]) E.b[TECLAS[ev.code]]._k = false; });
const soltarTodo = () => { teclas.clear(); for (const n of BOTONES) E.b[n]._k = E.b[n]._t = false; };   // teclas pegadas al perder el foco
addEventListener('blur', soltarTodo);
document.addEventListener('visibilitychange', () => { if (document.hidden) soltarTodo(); });

// ratón: arrastrar con el botón derecho, o con el puntero capturado (clic en el juego)
let ratonX = 0, ratonY = 0, arrastrando = false;
export function prepararRaton(lienzo, capturar) {
  lienzo.addEventListener('contextmenu', ev => ev.preventDefault());
  lienzo.addEventListener('mousedown', ev => {
    if (ev.button === 2) arrastrando = true;
    else if (ev.button === 0) {
      if (capturar() && document.pointerLockElement !== lienzo && !E.esTactil) lienzo.requestPointerLock?.();
      else E.b.golpe._k = E.b.golpe._p = true, setTimeout(() => (E.b.golpe._k = false), 60);
    }
  });
  addEventListener('mouseup', ev => { if (ev.button === 2) arrastrando = false; });
  addEventListener('mousemove', ev => {
    if (document.pointerLockElement === lienzo || arrastrando) { ratonX += ev.movementX; ratonY += ev.movementY; }
  });
}

// táctil (M-MOVIL, 14-11-2026): la palanca, la cámara con el dedo y los botones viven en js/ui/tactil.js, que escribe aquí
// con ponerPalanca() / sumarMirada() y en E.b[n]._t / ._p. El teclado y el mando no cambian.
let palanca = null;
export function ponerPalanca(x, y) { palanca = x == null ? null : { x, y }; }   // x, y en -1..1 (y positivo = adelante); null = suelta
export function sumarMirada(dx, dy) { ratonX += dx; ratonY += dy; }              // en píxeles «de ratón» (0,0028 rad por unidad)

const zonaMuerta = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;

// ===== mando (G-MANDO, carril codigo, 14-11-2026) =====
// Por qué no lo detectaba en Ubuntu/Chrome: (1) Chrome no entrega ningún mando a la página hasta que se aprieta un botón con la
// página visible (getGamepads() da [null, …] y sin aviso parecía muerto); (2) en Linux un DualShock/DualSense aparece además como
// «… Motion Sensors» / «Touchpad» (sin botones, a veces en el índice 0) y se tomaba ESE; (3) los mandos sin mapeo «standard»
// (mapping === '') traen los botones y ejes en otro orden: el gatillo izquierdo de un Xbox (xpad) cae en el eje 2, que se leía como
// cámara (giraba sola). Ahora: se sondea getGamepads() cada cuadro, se elige el mando de verdad (más botones; standard primero),
// se traduce con una tabla por fabricante y se avisa «Mando conectado: <nombre>».
// Botones normalizados: sur (A/✕), este (B/○), oeste (X/□), norte (Y/△), lb, rb, lt, rt, select, start, l3, r3, arriba, abajo, izq, der.
const MAPEOS = {
  // xpad / xinput (Xbox 360/One/Series, 8BitDo en modo X, la mayoría de los clones «Xbox»): A B X Y LB RB Back Start Guía L3 R3
  xbox: { nombre: 'Xbox (no estándar)', b: { sur: 0, este: 1, oeste: 2, norte: 3, lb: 4, rb: 5, select: 6, start: 7, l3: 9, r3: 10 }, ejes: { lx: 0, ly: 1, rx: 3, ry: 4, lt: 2, rt: 5, hx: 6, hy: 7 } },
  // hid-sony / hid-playstation (DualShock 4, DualSense): ✕ ○ △ □ L1 R1 L2 R2 Share Options PS L3 R3
  ps: { nombre: 'PlayStation (no estándar)', b: { sur: 0, este: 1, norte: 2, oeste: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, l3: 11, r3: 12 }, ejes: { lx: 0, ly: 1, rx: 3, ry: 4, lt: 2, rt: 5, hx: 6, hy: 7 } },
  // 8BitDo en modo D-input / Switch (hid-nintendo y similares): B A Y X … (el de abajo es 0, el de la derecha 1)
  ocho: { nombre: '8BitDo (no estándar)', b: { sur: 0, este: 1, oeste: 3, norte: 4, lb: 6, rb: 7, lt: 8, rt: 9, select: 10, start: 11, l3: 13, r3: 14 }, ejes: { lx: 0, ly: 1, rx: 2, ry: 3, hx: 6, hy: 7 } },
  // genéricos USB (DragonRise 0079, «USB Gamepad», etc.): 1 2 3 4 L1 R1 L2 R2 Select Start; cámara en los ejes 2/3 o 3/4 (se miran en reposo)
  generico: { nombre: 'genérico', b: { norte: 0, este: 1, sur: 2, oeste: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, l3: 10, r3: 11 }, ejes: { lx: 0, ly: 1, rx: 2, ry: 3, hx: 4, hy: 5 } },
};
const STD = { b: { sur: 0, este: 1, oeste: 2, norte: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, l3: 10, r3: 11, arriba: 12, abajo: 13, izq: 14, der: 15 }, ejes: { lx: 0, ly: 1, rx: 2, ry: 3 } };
function mapeoDe(g) {
  if (g.mapping === 'standard') return { ...STD, nombre: 'estándar' };
  const id = g.id.toLowerCase(), ven = (id.match(/vendor:\s*([0-9a-f]{4})/) || id.match(/^([0-9a-f]{4})-/) || [])[1];
  if (ven === '045e' || /x-?box|xinput|microsoft|x360/.test(id)) return MAPEOS.xbox;
  if (ven === '054c' || /sony|playstation|dualshock|dualsense|wireless controller/.test(id)) return MAPEOS.ps;
  if (ven === '2dc8' || /8bitdo/.test(id)) return g.axes.length >= 6 && g.buttons.length <= 12 ? MAPEOS.xbox : MAPEOS.ocho;
  if (ven === '057e' || /nintendo|pro controller/.test(id)) return MAPEOS.ocho;
  // sin nombre conocido: 6+ ejes con los gatillos en reposo en -1 (2 y 5) → como Xbox; si no, genérico
  if (g.axes.length >= 6 && g.axes[2] < -0.9 && g.axes[5] < -0.9) return MAPEOS.xbox;
  return MAPEOS.generico;
}
// el mando de verdad: fuera sensores de movimiento y touchpads (ejes sin botones); standard primero, después el de más botones
function elegirMando() {
  const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(p => p && p.connected !== false && p.buttons && p.buttons.length >= 4 && !/motion sensors|touchpad|accelerometer|gyro/i.test(p.id));
  pads.sort((a, b) => (b.mapping === 'standard') - (a.mapping === 'standard') || b.buttons.length - a.buttons.length || b.timestamp - a.timestamp);
  return pads[0] || null;
}
const MANDO = { g: null, id: '', mapa: null, reposo: null, previo: {}, antes: {}, tAvisoBuscar: 0 };
export const mando = MANDO;   // pruebas: mando.id, mando.mapa.nombre
let avisoMando = null;
function avisar(txt, ms = 4500) {
  if (!document.body) return;
  if (!avisoMando) {
    avisoMando = document.createElement('div'); avisoMando.id = 'aviso-mando';
    Object.assign(avisoMando.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 60, padding: '8px 16px', borderRadius: '8px',
      background: 'rgba(20,24,32,0.88)', color: '#fff', font: '600 15px system-ui, sans-serif', pointerEvents: 'none', transition: 'opacity 0.4s', maxWidth: '90vw', textAlign: 'center' });
    document.body.appendChild(avisoMando);
  }
  avisoMando.textContent = txt; avisoMando.style.opacity = '1';
  clearTimeout(avisoMando._t); avisoMando._t = setTimeout(() => { avisoMando.style.opacity = '0'; }, ms);
}
addEventListener('gamepadconnected', ev => { MANDO.g = null; leerMando(); if (!MANDO.g) avisar('Mando detectado: ' + ev.gamepad.id); });
addEventListener('gamepaddisconnected', ev => { if (MANDO.id === ev.gamepad.id) { MANDO.g = null; MANDO.id = ''; avisar('Mando desconectado'); } });
const nombreCorto = id => id.replace(/\s*\((standard gamepad\s*)?vendor:.*$/i, '').replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '').trim() || id;
// lee el mando ya traducido (se llama cada cuadro: NO se guarda el objeto Gamepad, Chrome entrega uno nuevo en cada getGamepads)
export function leerMando() {
  const g = elegirMando();
  if (!g) { if (MANDO.id) { MANDO.id = ''; MANDO.mapa = null; } MANDO.g = null; return null; }
  if (g.id !== MANDO.id) {
    MANDO.id = g.id; MANDO.mapa = mapeoDe(g); MANDO.reposo = [...g.axes];
    avisar('Mando conectado: ' + nombreCorto(g.id) + (g.mapping === 'standard' ? '' : ' · mapeo ' + MANDO.mapa.nombre), 5000);
    console.info('mando', g.index, g.id, 'mapping=' + (g.mapping || '""'), g.buttons.length + ' botones', g.axes.length + ' ejes', '→', MANDO.mapa.nombre);
  }
  const m = MANDO.mapa, eje = k => { const i = m.ejes[k]; if (i == null || i >= g.axes.length) return 0; const v = g.axes[i] || 0;
    return Math.abs(MANDO.reposo[i] ?? 0) > 0.9 && Math.abs(v - MANDO.reposo[i]) < 0.05 ? 0 : v; };   // eje en reposo en ±1 (gatillo mal mapeado): no cuenta
  const bt = k => { const i = m.b[k]; const b = i != null ? g.buttons[i] : null; return !!b && (b.pressed || b.value > 0.5); };
  const r = { g, x: 0, y: 0, mx: 0, my: 0, b: {} };
  // palancas con zona muerta radial (en Linux muchas no vuelven a 0 exacto)
  const lx = eje('lx'), ly = eje('ly'), ll = Math.hypot(lx, ly), lk = ll < 0.2 ? 0 : Math.min(1, (ll - 0.2) / 0.75) / ll;
  r.x = lx * lk; r.y = -ly * lk;
  const rx = eje('rx'), ry = eje('ry'), rl = Math.hypot(rx, ry), rk = rl < 0.2 ? 0 : Math.min(1, (rl - 0.2) / 0.75) / rl;
  r.mx = rx * rk; r.my = ry * rk;
  for (const k of ['sur', 'este', 'oeste', 'norte', 'lb', 'rb', 'lt', 'rt', 'select', 'start', 'l3', 'r3', 'arriba', 'abajo', 'izq', 'der']) r.b[k] = bt(k);
  if (m.ejes.lt != null && !m.b.lt) r.b.lt = eje('lt') > 0.3; if (m.ejes.rt != null && !m.b.rt) r.b.rt = eje('rt') > 0.3;
  if (m.ejes.hx != null && g.axes.length > m.ejes.hy) {   // cruceta como «hat» (dos ejes)
    const hx = g.axes[m.ejes.hx], hy = g.axes[m.ejes.hy];
    r.b.izq ||= hx < -0.5; r.b.der ||= hx > 0.5; r.b.arriba ||= hy < -0.5; r.b.abajo ||= hy > 0.5;
  }
  if (g.mapping !== 'standard' && g.axes.length >= 10 && Math.abs(g.axes[9]) <= 1.01) {   // cruceta como un solo eje POV (genéricos): -1 arriba, -0,43 der, 0,14 abajo, 0,71 izq; suelta ≈ 1,29
    const a = Math.round((g.axes[9] + 1) / (2 / 7)) % 8;
    r.b.arriba ||= a === 0 || a === 1 || a === 7; r.b.der ||= a >= 1 && a <= 3; r.b.abajo ||= a >= 3 && a <= 5; r.b.izq ||= a >= 5 && a <= 7;
  }
  MANDO.g = r; return r;
}
// N0-CTRL: sondeo rápido del mando (cada 8 ms) solo para no perder pulsaciones cortas cuando el juego va a pocos fps (a 20 fps un
// toque de 40 ms cae entero entre dos cuadros). Solo anota flancos (_pm); el estado, palancas y menús siguen en leerMando por cuadro.
const SONDEO = { saltar: ['sur'], accion: ['este'], golpe: ['oeste'], hercules: ['norte'], patada: ['rb', 'rt'] };
const sondPrev = {};
setInterval(() => {
  if (!MANDO.id || !MANDO.mapa || E.piloto || document.hidden) return;
  const g = elegirMando(); if (!g || g.id !== MANDO.id) return;
  const m = MANDO.mapa;
  for (const [n, ks] of Object.entries(SONDEO)) {
    let p = false;
    for (const k of ks) { const i = m.b[k]; const b = i != null ? g.buttons[i] : null; if (b && (b.pressed || b.value > 0.5)) p = true;
      else if (k === 'rt' && m.ejes.rt != null && !m.b.rt && (g.axes[m.ejes.rt] || -1) > 0.3 && Math.abs((MANDO.reposo[m.ejes.rt] ?? 0) - g.axes[m.ejes.rt]) > 0.05) p = true; }
    if (p && !sondPrev[n]) E.b[n]._pm = true;
    sondPrev[n] = p;
  }
}, 8);
// ¿se acaba de apretar alguno de estos botones del mando? (cada «clave» lleva su propio estado anterior)
export function mandoPulso(clave, nombres) {
  const r = MANDO.g || leerMando(); const ahora = !!r && nombres.some(n => r.b[n]);
  const antes = MANDO.antes[clave]; MANDO.antes[clave] = ahora; return ahora && !antes;
}

// menús con el mando: arriba/abajo (cruceta o palanca) mueven el foco entre los botones y listas visibles; izquierda/derecha
// cambian la lista; A (sur) aprieta; B (este) en la pausa = «Seguir»; Start en el título = «Jugar»
let navT = 0, navDir = '';
function menuVisible() {
  for (const sel of ['#pausa .menu', '#titulo .menu']) { const m = document.querySelector(sel); if (m && m.offsetParent !== null && !m.closest('.oculto')) return m; }
  return null;
}
function navegarMenu(r) {
  const menu = menuVisible(); if (!menu || !r) return false;
  const items = [...menu.querySelectorAll('button, select')].filter(el => el.offsetParent !== null && !el.disabled);
  if (!items.length) return false;
  let i = items.indexOf(document.activeElement);
  const enfocar = k => { const el = items[(k + items.length) % items.length]; el.focus({ preventScroll: true }); for (const o of items) o.classList.toggle('foco-mando', o === el); };
  const dir = r.b.arriba || r.y > 0.6 ? 'arriba' : r.b.abajo || r.y < -0.6 ? 'abajo' : r.b.izq || r.x < -0.6 ? 'izq' : r.b.der || r.x > 0.6 ? 'der' : '';
  const t = performance.now();
  if (dir && (dir !== navDir || t - navT > 260)) {
    navT = t + (dir !== navDir ? 140 : 0); navDir = dir;
    if (i < 0) enfocar(0);
    else if (dir === 'arriba') enfocar(i - 1);
    else if (dir === 'abajo') enfocar(i + 1);
    else if (items[i].tagName === 'SELECT') { const s = items[i], n = s.options.length; s.selectedIndex = (s.selectedIndex + (dir === 'der' ? 1 : -1) + n) % n; s.dispatchEvent(new Event('change', { bubbles: true })); }
  } else if (!dir) navDir = '';
  if (mandoPulso('menuA', ['sur'])) { const el = i >= 0 ? items[i] : items[0]; if (el.tagName === 'BUTTON') el.click(); else enfocar(i + 1); return true; }
  if (mandoPulso('menuStart', ['start']) && menu.closest('#titulo')) { document.getElementById('t-jugar')?.click(); return true; }
  if (mandoPulso('menuB', ['este']) && menu.closest('#pausa')) { document.getElementById('p-seguir')?.click(); return true; }
  return false;
}
// se llama una vez por cuadro; juego = true en el bucle del juego (las pulsaciones quedan pendientes para el paso de física)
export function leerEntrada(juego = false) {
  let x = 0, y = 0;
  if (teclas.has('KeyA') || teclas.has('ArrowLeft')) x -= 1;
  if (teclas.has('KeyD') || teclas.has('ArrowRight')) x += 1;
  if (teclas.has('KeyW') || teclas.has('ArrowUp')) y += 1;
  if (teclas.has('KeyS') || teclas.has('ArrowDown')) y -= 1;
  if (palanca) { x += palanca.x; y += palanca.y; }
  let mx = ratonX * 0.0028, my = ratonY * 0.0028; ratonX = ratonY = 0;
  const g = leerMando();   // G-MANDO: sondeo de cada cuadro, mando elegido y traducido (ver arriba)
  const gb = {};
  let enMenu = false;
  if (g) {
    enMenu = navegarMenu(g) || !!menuVisible();   // con un menú a la vista, el mando maneja el menú y no a Nato
    if (!enMenu) {
      x += g.x; y += g.y; mx += g.mx * 0.05; my += g.my * 0.05;
      if (g.b.izq) x -= 1; if (g.b.der) x += 1; if (g.b.arriba) y += 1; if (g.b.abajo) y -= 1;   // cruceta: caminar
      gb.saltar = g.b.sur; gb.accion = g.b.este; gb.golpe = g.b.oeste; gb.hercules = g.b.norte; gb.patada = g.b.rb || g.b.rt; gb.foto = g.b.r3; gb.mapa = g.b.select;
    }
    gb.pausa = g.b.start;
  }
  if (E.piloto) {   // pruebas automáticas
    x = E.piloto.x || 0; y = E.piloto.y || 0; mx = E.piloto.mx || 0; my = 0;
  }
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  const analogico = !!palanca || !!g;
  E.correr = E.piloto ? E.piloto.correr !== false : teclas.has('ShiftLeft') || teclas.has('ShiftRight') || (analogico && Math.hypot(x, y) > 0.9);
  E.mover.x = x; E.mover.y = y; E.mirar.x = mx; E.mirar.y = my;
  const t = performance.now();
  for (const n of BOTONES) {
    const b = E.b[n];
    const pm = b._pm && !enMenu && !E.piloto; b._pm = false;   // con un menú a la vista, el A del mando es del menú
    const ahora = E.piloto ? !!E.piloto[n] : (b._k || b._t || !!gb[n]);
    b.recien = (ahora && !b.apretado) || (!E.piloto && (b._p || pm)); b._p = false;   // flanco del cuadro o pulsación por evento (aunque ya se soltó)
    b.apretado = ahora;
    if (!juego) b.pend = 0; else if (b.recien) b.pend = t;   // N0-CTRL: queda pendiente hasta el próximo paso de física
  }
}
