// Sonido del juego 3D: la voz real de Nato (frases cortas del 2D), efectos sintetizados y la música andina del 2D
// (quena, charango, pulsos y percusión de ruido) con el mismo secuenciador de tracker (X-M1, portado de referencia_2d/js/audio.js).
// Las pruebas automáticas corren en Chrome headless con el audio mudo (--mute-audio): todo esto suena solo jugando.
import { CANCIONES } from '../cine/canciones.js';

const leer = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

export const AUDIO = {
  ctx: null, listo: false, mudo: leer('mudo3d', '0') === '1', musicaVol: +leer('musica3d', '0.55'), voces: {},
  cancion: null, nombreCancion: null, pendiente: null, vivas: [],
};
if (typeof window !== 'undefined') window.AUDIO3D = AUDIO;   // para las pruebas
const FRASE = { dandole: 'dandole', imaginate: 'imaginate', orgulloso: 'orgulloso', pega: 'pegacaleta', gracias: 'gracias', pucha: 'pucha', ay: 'pucha' };
const VOL_MAESTRO = 0.8;

function _frec(nota) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(nota);
  if (!m) return 0;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (base + (parseInt(m[3], 10) + 1) * 12 - 69) / 12);
}
function _ondaPulso(ctx, ciclo) {
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * ciclo);
  return ctx.createPeriodicWave(re, im);
}

export async function iniciarAudio() {
  if (AUDIO.ctx) { if (AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume(); return; }
  try {
    const ctx = AUDIO.ctx = new AudioContext();
    AUDIO.maestro = ctx.createGain(); AUDIO.maestro.gain.value = AUDIO.mudo ? 0 : VOL_MAESTRO; AUDIO.maestro.connect(ctx.destination);
    AUDIO.busMusica = ctx.createGain(); AUDIO.busMusica.gain.value = AUDIO.musicaVol; AUDIO.busMusica.connect(AUDIO.maestro);
    AUDIO.salida = ctx.createGain(); AUDIO.salida.gain.value = 0.75; AUDIO.salida.connect(AUDIO.maestro);   // efectos
    // voz: más fuerte y comprimida para que se entienda sobre la música
    AUDIO.busVoz = ctx.createGain(); AUDIO.busVoz.gain.value = 1.3;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 4;
    AUDIO.busVoz.connect(comp); comp.connect(AUDIO.maestro);
    AUDIO.ondas = { pulso25: _ondaPulso(ctx, 0.25), pulso12: _ondaPulso(ctx, 0.125), pulso50: _ondaPulso(ctx, 0.5) };
    const ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AUDIO.ruido = ruido;
    AUDIO.listo = true;
    const datos = window.VOCES_DATOS || {};
    for (const [k, url] of Object.entries(datos)) {
      fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => (AUDIO.voces[k] = buf)).catch(() => {});
    }
    setInterval(_programador, 25);
    if (AUDIO.pendiente) { const p = AUDIO.pendiente; AUDIO.pendiente = null; tocarMusica(p); }
  } catch (e) { console.warn('sin audio', e); }
}

// ---------- mudo y volumen (se recuerdan entre partidas) ----------
export function alternarMudo(v) {
  AUDIO.mudo = v === undefined ? !AUDIO.mudo : !!v; guardar('mudo3d', AUDIO.mudo ? '1' : '0');
  if (AUDIO.maestro) AUDIO.maestro.gain.setTargetAtTime(AUDIO.mudo ? 0 : VOL_MAESTRO, AUDIO.ctx.currentTime, 0.03);
  return AUDIO.mudo;
}
export function ponerVolumenMusica(v) {
  AUDIO.musicaVol = Math.max(0, Math.min(1, v)); guardar('musica3d', String(AUDIO.musicaVol));
  if (AUDIO.busMusica) AUDIO.busMusica.gain.setTargetAtTime(AUDIO.musicaVol, AUDIO.ctx.currentTime, 0.05);
  return AUDIO.musicaVol;
}

// ---------- voz ----------
let vozFin = 0;
export function voz(clave) {
  const k = FRASE[clave] || clave, c = AUDIO.ctx;
  if (AUDIO.mudo || !c || !AUDIO.voces[k] || c.currentTime < vozFin) return false;
  const s = c.createBufferSource(); s.buffer = AUDIO.voces[k]; s.connect(AUDIO.busVoz); s.start();
  const ahora = c.currentTime, dur = s.buffer.duration;
  vozFin = ahora + dur;
  // la música baja mientras Nato habla, para que se le entienda
  const g = AUDIO.busMusica.gain;
  g.cancelScheduledValues(ahora); g.setValueAtTime(g.value, ahora);
  g.linearRampToValueAtTime(AUDIO.musicaVol * 0.18, ahora + 0.08);
  g.setValueAtTime(AUDIO.musicaVol * 0.18, ahora + dur + 0.1);
  g.linearRampToValueAtTime(AUDIO.musicaVol, ahora + dur + 0.6);
  return true;
}

// ---------- música: secuenciador de tracker ----------
function _compilar(cancion) {
  return cancion.canales.map(c => {
    const toks = c.notas.split(/\s+/).filter(t => t && t !== '|'), eventos = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t === '-' || t === '.') continue;
      let dur = 1;
      while (toks[i + dur] === '-') dur++;
      eventos.push({ paso: i, dur, nota: t });
    }
    return { inst: c.inst, vol: c.vol, largo: toks.length, eventos };
  });
}
// nombre: una de CANCIONES (titulo, nivel, ciudad, cine, invierno, chaqueta, cueva, tension, olla, victoria, derrota, creditos) o null para callar
export function tocarMusica(nombre) {
  if (!nombre) { pararMusica(); return; }
  if (AUDIO.nombreCancion === nombre && (AUDIO.cancion || AUDIO.pendiente === nombre)) return;
  if (!AUDIO.listo) { AUDIO.pendiente = nombre; AUDIO.nombreCancion = nombre; return; }
  pararMusica();
  const c = CANCIONES[nombre];
  if (!c) return;
  AUDIO.nombreCancion = nombre;
  AUDIO.cancion = { def: c, canales: _compilar(c), paso: 0, tiempo: AUDIO.ctx.currentTime + 0.05, bucle: c.bucle !== false };
  AUDIO.cancion.largo = Math.max(...AUDIO.cancion.canales.map(k => k.largo));
}
export function pararMusica() {
  AUDIO.cancion = null; AUDIO.nombreCancion = null; AUDIO.pendiente = null;
  AUDIO.vivas.forEach(n => { try { n.stop(); } catch (e) { /* ya terminó */ } });
  AUDIO.vivas = [];
}
// tema de cada nivel (como en el 2D: niveles 1 y 4 «nivel», 2 «ciudad», 3 «invierno»)
export const MUSICA_NIVEL = { 1: 'nivel', 2: 'ciudad', 3: 'invierno', 4: 'nivel' };
function _programador() {
  const s = AUDIO.cancion;
  if (!s) return;
  const ctx = AUDIO.ctx;
  if (s.tiempo < ctx.currentTime - 0.5) s.tiempo = ctx.currentTime + 0.05;   // pestaña en segundo plano: no ametrallar notas atrasadas
  while (s.tiempo < ctx.currentTime + 0.12) {
    if (s.paso >= s.largo) {
      if (!s.bucle) { AUDIO.cancion = null; AUDIO.nombreCancion = null; return; }
      s.paso = 0;
    }
    for (const c of s.canales) {
      const p = s.paso % c.largo;
      for (const ev of c.eventos) if (ev.paso === p) _nota(c.inst, ev.nota, s.tiempo, ev.dur * s.def.paso, c.vol, AUDIO.busMusica);
    }
    s.tiempo += s.def.paso;
    s.paso++;
  }
}
function _nota(inst, nota, t, dur, vol, bus) {
  const ctx = AUDIO.ctx, g = ctx.createGain();
  g.connect(bus);
  let fuente;
  if (inst === 'ruido') {
    if (nota === 'K') {   // bombo
      fuente = ctx.createOscillator();
      fuente.frequency.setValueAtTime(150, t); fuente.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      g.gain.setValueAtTime(vol * 3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      fuente.connect(g); fuente.start(t); fuente.stop(t + 0.15);
    } else {
      fuente = ctx.createBufferSource(); fuente.buffer = AUDIO.ruido;
      const f = ctx.createBiquadFilter();
      f.type = nota === 'S' ? 'bandpass' : 'highpass'; f.frequency.value = nota === 'S' ? 1800 : 7000;
      const largo = nota === 'S' ? 0.12 : 0.04;
      g.gain.setValueAtTime(vol * (nota === 'S' ? 1.6 : 0.8), t); g.gain.exponentialRampToValueAtTime(0.001, t + largo);
      fuente.connect(f); f.connect(g); fuente.start(t, Math.random() * 0.5); fuente.stop(t + largo + 0.01);
    }
  } else if (inst === 'quena') {   // flauta andina: triángulo suave con soplo y vibrato
    fuente = ctx.createOscillator(); fuente.type = 'triangle';
    fuente.frequency.setValueAtTime(_frec(nota), t);
    const vib = ctx.createOscillator(), prof = ctx.createGain();
    vib.frequency.value = 5.2; prof.gain.setValueAtTime(0, t); prof.gain.linearRampToValueAtTime(14, t + Math.min(0.25, dur * 0.6));
    vib.connect(prof); prof.connect(fuente.detune); vib.start(t);
    const fin = t + Math.max(0.08, dur - 0.02);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.035);
    g.gain.setValueAtTime(vol * 0.85, t + Math.min(dur * 0.5, 0.12)); g.gain.linearRampToValueAtTime(0, fin);
    const soplo = ctx.createBufferSource(), fs = ctx.createBiquadFilter(), gs = ctx.createGain();
    soplo.buffer = AUDIO.ruido; fs.type = 'bandpass'; fs.frequency.value = _frec(nota) * 2; fs.Q.value = 6;
    gs.gain.setValueAtTime(vol * 0.5, t); gs.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    soplo.connect(fs); fs.connect(gs); gs.connect(bus); soplo.start(t, Math.random() * 0.5); soplo.stop(t + 0.1);
    fuente.connect(g); fuente.start(t); fuente.stop(fin + 0.01); vib.stop(fin + 0.01);
  } else if (inst === 'charango') {   // rasgueo: la nota y su quinta con un desfase corto, pulsadas y breves
    fuente = ctx.createOscillator(); fuente.setPeriodicWave(AUDIO.ondas.pulso12);
    fuente.frequency.setValueAtTime(_frec(nota), t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    const quinta = ctx.createOscillator(), gq = ctx.createGain();
    quinta.setPeriodicWave(AUDIO.ondas.pulso25); quinta.frequency.setValueAtTime(_frec(nota) * 1.5, t + 0.018);
    gq.gain.setValueAtTime(0, t); gq.gain.setValueAtTime(vol * 0.7, t + 0.018); gq.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    quinta.connect(gq); gq.connect(bus); quinta.start(t); quinta.stop(t + 0.3);
    fuente.connect(g); fuente.start(t); fuente.stop(t + 0.3);
  } else {
    fuente = ctx.createOscillator();
    if (inst === 'triangulo') fuente.type = 'triangle';
    else fuente.setPeriodicWave(AUDIO.ondas[inst] || AUDIO.ondas.pulso50);
    fuente.frequency.setValueAtTime(_frec(nota), t);
    const fin = t + Math.max(0.05, dur - 0.015);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol * 0.8, t + Math.min(dur * 0.5, 0.08));
    g.gain.linearRampToValueAtTime(0, fin);
    fuente.connect(g); fuente.start(t); fuente.stop(fin + 0.01);
  }
  AUDIO.vivas.push(fuente);
  if (AUDIO.vivas.length > 64) AUDIO.vivas.splice(0, 32);
}

// ---------- efectos: tono con caída de frecuencia y volumen (tipo, f0, f1, duración, volumen) ----------
const EF = {
  saltar: ['square', 380, 620, 0.09, 0.08], golpe: ['triangle', 220, 120, 0.07, 0.15], golpeSuave: ['triangle', 300, 160, 0.06, 0.12],
  golpeFuerte: ['sawtooth', 160, 50, 0.16, 0.2], pepita: ['sine', 900, 1400, 0.08, 0.1], vida: ['sine', 500, 1000, 0.25, 0.15],
  apunte: ['sine', 660, 990, 0.3, 0.15], fogata: ['triangle', 300, 600, 0.3, 0.12], herido: ['sawtooth', 400, 120, 0.22, 0.18],
  chillido: ['sawtooth', 1400, 900, 0.35, 0.08], ladrido: ['sawtooth', 180, 90, 0.18, 0.3], ladrido1: ['sawtooth', 170, 90, 0.14, 0.3],
  energiaLlena: ['square', 520, 1040, 0.3, 0.1], crujido: ['square', 90, 60, 0.15, 0.08], alud: ['sawtooth', 80, 40, 1.2, 0.25],
  explosion: ['sawtooth', 120, 30, 0.5, 0.3], rueda: ['sawtooth', 64, 50, 0.55, 0.05], pinos: ['square', 820, 190, 0.1, 0.05],   // N2-C34 palitroque puerta: ['triangle', 200, 260, 0.2, 0.1],
  magia: ['sine', 600, 2400, 0.9, 0.12], aleteo: ['triangle', 140, 70, 0.25, 0.12],
  golpeTam: ['sawtooth', 95, 32, 1.1, 0.34], golpeTam2: ['square', 190, 60, 0.5, 0.14],   // golpe musical de las cinemáticas (llegada del jefe y del cóndor)
};
export function efecto(n) {
  const c = AUDIO.ctx, e = EF[n];
  if (AUDIO.mudo || !c || !e) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type = e[0]; o.frequency.setValueAtTime(e[1], t); o.frequency.exponentialRampToValueAtTime(e[2], t + e[3]);
  g.gain.setValueAtTime(e[4], t); g.gain.exponentialRampToValueAtTime(0.001, t + e[3]);
  o.connect(g); g.connect(AUDIO.salida); o.start(t); o.stop(t + e[3] + 0.02);
  if (n === 'ladrido') setTimeout(() => efecto('ladrido1'), 230);   // «¡GUAU, GUAU!» doble
  if (n === 'golpeTam') efecto('golpeTam2');   // dos capas: grave largo y ataque medio
}
