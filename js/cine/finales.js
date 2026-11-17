// X-K2 · Finales y memorias como escenas EN EL MOTOR (carril cine): el noticiario en sepia del cine (N2), el título de la memoria
// del 19 de junio de 1945, el salto «Años después… 1967» y el fin del juego en la plaza de Sewell. El texto de las antiguas
// tarjetas pasa a subtítulos (o a un cartel para los créditos). Todas se saltan con Enter; con ?rapido=1 no se muestran.
import * as THREE from 'three';
import { correrEscena, camaraTomas, subtitulosEn, subtitulo, cartel, sepia, tinte, tramo, V } from './director.js';
import { persona, condorGigante, libro, luzCobriza, esperarSplats } from './actores.js';
import { cargarPlaza, cargandoActores } from './plaza.js';
import { musica } from './musica.js';
import { voz, efecto, AUDIO } from '../motor/audio.js';
import { altura } from '../mundo/terreno.js';

const una = () => { const hecho = {}; return (k, t, t0, f) => { if (t >= t0 && !hecho[k]) { hecho[k] = 1; f(); } }; };
const T = txt => `<span class="titulo">${txt}</span>`;
const alturaMax = (x0, z0, x1, z1) => { let m = -1e9; for (let i = 0; i <= 10; i++) m = Math.max(m, altura(x0 + (x1 - x0) * i / 10, z0 + (z1 - z0) * i / 10)); return m; };   // X-K10

// ---------- N2 · noticiario: se apagan las luces del cine y en la pantalla, en sepia, el cóndor se lleva a Pedro ----------
// ctx: { G, verExterior }
export async function noticiario(ctx, M) {
  const { G } = ctx, R = G.render, esc = M.escena, cam = R.camara;
  const antes = { fondo: esc.background, niebla: esc.fog, sol: R.sol.intensity, cielo: R.cielo.intensity, salas: Object.values(M.R.salas).map(s => [s.grupo, s.grupo.visible]) };
  // afuera, de día: la ciudad de las escaleras vista desde abajo
  for (const s of Object.values(M.R.salas)) s.grupo.visible = false;
  ctx.verExterior(M, true);
  esc.background = new THREE.Color(0x8ec5ff); esc.fog = new THREE.Fog(M.def.niebla || 0xcfd8e3, 220, 3200); R.sol.intensity = 3.2; R.cielo.intensity = 1.1;
  // N0-FABLE-1611 (A3): con «Sewell en cono» la mira (y + 60 en z −220) quedaba BAJO la ciudad y camaraSegura, con el rayo desde la mira,
  // dejaba la cámara bajo la Escalera Central (4,6, 32, −92,9). Mira sobre el terreno y línea de vista desde el ojo (en la estación)
  const ini = M.def.inicio, y = M.fis.suelo(ini.x, ini.z) ?? 0;
  const ojo = V(ini.x, y + 5, ini.z), mira = V(0, Math.max(y + 60, altura(0, -220) + 25), -220), dir = mira.clone().sub(ojo).normalize(), der = V(-dir.z, 0, dir.x).normalize();
  const A = ojo.clone().addScaledVector(dir, 26).addScaledVector(der, -28).add(V(0, 4, 0)), B = ojo.clone().addScaledVector(dir, 110).addScaledVector(der, 30).add(V(0, 55, 0));   // pasa cerca de la cámara: se siente gigante
  const condor = condorGigante(M), pedro = persona(esc, 'pedro'); esc.add(condor);
  for (const o of [condor, pedro.g]) if (!o.userData.malla) M.aparte(o, true);   // G-PERS: las mallas se quedan en la escena con luz (en «aparte» salen negras)   // se mueven rápido: escena «aparte» de Spark (sin el retraso del LoD de la ciudad)
  await esperarSplats([condor, pedro.g], 8000);
  const u = una();
  musica(null);
  const saltada = await correrEscena(G, (t, dt) => {
    u('crujido', t, 0.2, () => efecto('crujido'));
    u('chillido', t, 2.4, () => { efecto('chillido'); efecto('golpeTam'); });
    sepia(Math.min(1, t * 2), t);
    const f = tramo(t, 2.2, 10.5), p = new THREE.Vector3().lerpVectors(A, B, f);
    p.y += Math.sin(f * Math.PI) * 10;
    const dx = B.x - A.x, dz = B.z - A.z; condor.rotation.y = Math.atan2(dx, dz); condor.position.copy(p); condor.userData.aletear(t);
    pedro.g.position.copy(p).add(V(0, -2.6, 0)); pedro.g.rotation.y = condor.rotation.y; pedro.poner('saludar'); pedro.act(dt);
    camaraTomas(cam, [{ desde: 0, hasta: 12, origen: ojo, pos0: ojo, pos1: ojo.clone().add(V(0, 1.5, 0)), mira: () => mira.clone().lerp(p, Math.min(1, t / 3) * 0.75) }], t,
      q => { q.x += Math.sin(t * 23) * 0.03; q.y += Math.sin(t * 17) * 0.03; });   // la película vieja tiembla
    R.seguirSol(ojo);
    subtitulosEn([[0.3, 3.2, T('NOTICIARIO')], [3.4, 8.6, 'En la pantalla, en sepia: el cóndor gigante se lleva a Pedro hacia lo alto de la ciudad.'], [8.8, 12, '<b>Nato:</b> ¡Papá! ¡Voy por ti!']], t);
  }, 12);
  condor.removeFromParent(); pedro.g.removeFromParent();
  ctx.verExterior(M, false);
  for (const [g, v] of antes.salas) g.visible = v;
  esc.background = antes.fondo; esc.fog = antes.niebla; R.sol.intensity = antes.sol; R.cielo.intensity = antes.cielo;
  M.cam.cortar?.();
  return saltada;
}

// ---------- Memoria · título: la cámara baja de noche, con nieve, hasta Nato ----------
export async function memoriaTitulo(ctx, M, MEMORIA) {
  const { G } = ctx, cam = G.render.camara, j = M.jug.pos, c = MEMORIA.casco;
  const yC = M.fis.suelo(c.x, c.z) ?? j.y;
  const nato = V(j.x, j.y, j.z), atras = V(j.x, j.y + 2.6, j.z + 6.5);
  const dn = V(c.x - j.x, 0, c.z - j.z), dd = Math.max(dn.length(), 1); dn.multiplyScalar(1 / dd);
  const lado = V(c.x - dn.x * 7 - dn.z * 4, yC + 2.3, c.z - dn.z * 7 + dn.x * 4);   // B8: a 7 m del casco, del lado de Nato y 4 m a un costado: se ve la ofrenda, Nato al fondo
  M.jug.dibujar?.(0); M.jug.vista?.(1, 0);
  return correrEscena(G, t => {
    // B8 (N0-FABLE-1611b): la toma final queda de costado, entre Nato y el casco, para que Nato no tape la ofrenda (antes quedaba detrás de él)
    camaraTomas(cam, [{ desde: 0, hasta: 9, pos0: V(c.x + 18, yC + 38, c.z + 40), pos1: lado, mira0: V(c.x, yC, c.z), mira1: V(c.x, yC + 1.0, c.z) }], t);
    G.render.seguirSol(nato);
    subtitulosEn([[0.5, 5.5, T(MEMORIA.titulo)], [5.7, 9, 'Plaza de Sewell. Las familias esperan noticias de la mina en silencio.']], t);
  }, 9);
}

// ---------- «Años después… 1967»: la cámara sube desde el casco hacia el cielo nevado y se funde ----------
export async function anosDespues(ctx, M, MEMORIA) {
  const { G } = ctx, cam = G.render.camara, c = MEMORIA.casco, yC = M.fis.suelo(c.x, c.z) ?? M.jug.pos.y;
  const fundido = document.getElementById('fundido');
  return correrEscena(G, t => {
    camaraTomas(cam, [{ desde: 0, hasta: 8, pos0: V(c.x + 2.2, yC + 1.4, c.z + 2.2), pos1: V(c.x + 6, yC + 26, c.z + 14), mira0: V(c.x, yC + 0.2, c.z), mira1: V(c.x, yC + 30, c.z - 30) }], t);
    G.render.seguirSol(V(c.x, yC, c.z));
    if (fundido) fundido.style.opacity = tramo(t, 2.5, 4.2) * 0.85;
    subtitulosEn([[1.5, 4.6, T('Años después…')], [4.8, 8, T('1967')]], t);
  }, 8);
}

// ---------- Fin del juego: Sewell en silencio, Patrimonio de la Humanidad, la plaza con Nato y Pedro, créditos ----------
// ctx: { G, crearMundo, pantallaCarga, limpiarMundo, NIVELES, UI }; P: puntaje
export async function finDelJuegoCine(ctx, P) {
  const { G, UI } = ctx;
  if (new URLSearchParams(location.search).has('rapido') && !new URLSearchParams(location.search).has('cine')) return false;
  musica(null);
  const { M, suelo, Y0, YS } = await cargarPlaza(ctx, 'Sewell', 'Patrimonio de la Humanidad', { x: -1.6, z: -309.6, rumbo: 0 });
  const esc = M.escena, R = G.render, cam = R.camara;
  const J = M.jug, NATO = V(-1.6, YS, -309.6), PEDRO = V(1.6, YS, -309.6);
  const pedro = persona(esc, 'pedro'); pedro.g.position.copy(PEDRO);
  const lib = libro(); esc.add(lib);
  const brillo = luzCobriza(esc, 40);
  const publico = [['vecina', -6, -298], ['anciana', -8.5, -295], ['diego', -4, -294], ['medico', 5, -297], ['vecina', 8.5, -294], ['enfermera', 4.5, -292], ['anciana', 9, -300],
    ['minero', -2, -297], ['minero', 2.5, -296.5], ['diego', -10, -301]].map(([id, x, z]) => { const p = persona(esc, id); p.g.position.set(x, suelo(x, z), z); p.g.rotation.y = Math.atan2(-x, -310 - z); p.y0 = p.g.position.y; return p; });
  await cargandoActores(G, esperarSplats([pedro.g, ...publico.map(p => p.g)], 20000, [pedro, ...publico])); UI.fundir(false);   // X-K14: carga en vez de negro
  const libroPos = () => V(NATO.x + 0.36 * Math.sin(J.rumbo), NATO.y + 1.12, NATO.z + 0.36 * Math.cos(J.rumbo));
  const u = una(), DURA = 54;
  const creditos = `<h1>SEWELL Y SU HISTORIA EN 3D</h1><h2>Nato y la ciudad de las escaleras</h2><p>Un juego de <b>WOLKY TECH</b><br>Basado en el libro «Apuntes Históricos de El Mineral El Teniente», de Pedro Villagra Díaz,<br>y en la serie documental anime «El Teniente»</p>
    <p>Protagonista y voz: Ignacio «Nato» Villagra</p><p>YouTube @wolkytech · Instagram @wolky_ia · wolky.cl · ventas@wolky.cl</p><p>Dedicado a todos los sewellinos y sewellinas. ¡Gracias por jugar!</p>`;
  const tomas = [
    // Sewell en silencio: la plaza vacía desde lo alto, la cámara gira despacio
    { desde: 0, hasta: 6, pos0: V(-34, Y0 + 30, -262), pos1: V(-20, Y0 + 26, -258), mira0: V(0, Y0, -300), mira1: V(4, Y0, -305) },
    // Patrimonio de la Humanidad: vuelo lento sobre la ciudad hacia la cordillera
    // X-K10 (auditor): con Sewell en cono la ladera alta queda sobre Y0+50: la mira final iba enterrada y la cámara se metía al cerro.
    // Alturas desde el terreno: la cámara 30 m sobre lo más alto bajo su recorrido y la mira 25 m sobre la ladera de la cordillera
    { desde: 6, hasta: 21, pos0: V(30, Math.max(Y0 + 22, altura(30, -250) + 18), -250), pos1: V(46, Math.max(Y0 + 40, alturaMax(30, -250, 46, -350) + 30), -350),
      mira0: V(0, Math.max(Y0 + 10, altura(0, -330) + 6), -330), mira1: V(-30, Math.max(Y0 + 50, altura(-30, -480) + 25), -480) },
    // la plaza: Nato y Pedro en la tarima, la gente aplaude
    { desde: 21, hasta: 26, pos0: V(1.5, Y0 + 5.5, -282), pos1: V(0.5, Y0 + 3.4, -288), mira0: V(0, YS + 1.3, -310) },   // por detrás del público
    { desde: 26, hasta: 30.5, pos0: V(-3.4, YS + 1.7, -305.4), pos1: V(-3.1, YS + 1.6, -305.8), mira0: V(-1.6, YS + 1.5, -309.6) },
    { desde: 30.5, hasta: 35, pos0: V(3.6, YS + 1.7, -305.6), pos1: V(3.2, YS + 1.6, -306), mira0: V(1.6, YS + 1.45, -309.6) },
    { desde: 35, hasta: 38.6, pos0: V(-0.4, YS + 1.9, -312.4), pos1: V(-0.2, YS + 2.4, -313.2), mira0: V(0, Y0 + 1.3, -296) },   // contraplano: el público aplaude
    { desde: 38.6, hasta: DURA, pos0: V(0, YS + 3, -298), pos1: V(0, YS + 9, -288), mira0: V(0, YS + 1.5, -309), mira1: V(0, YS + 5, -312) },
  ];
  J.estado = 'normal';
  const saltada = await correrEscena(G, (t, dt) => {
    u('titulo', t, 6, () => { musica('titulo'); efecto('golpeTam'); });
    u('plaza', t, 21, () => musica('creditos'));
    u('v1', t, 26.2, () => voz('imaginate'));
    u('bravo', t, 35, () => voz('orgulloso'));
    u('gracias', t, 41, () => voz('gracias'));
    const enPlaza = t >= 21;
    J.malla.visible = enPlaza; lib.visible = enPlaza;   // gaussianas (Pedro, público): bajo la plaza hasta su toma, no con visible=false (Spark tarda en redibujarlas)
    pedro.g.position.set(PEDRO.x, enPlaza ? PEDRO.y : PEDRO.y - 40, PEDRO.z); publico.forEach(p => (p.g.position.y = enPlaza ? p.y0 : p.y0 - 40));
    J.t += dt; J.p.enSuelo = true; J.vel.set(0, 0, 0); J.rumbo = t > 30.5 && t < 35 ? 0.5 : 0;
    if (t > 26 && t < 26.1) J.gesto('saludar', 2.5);
    if (t > 35 && t < 35.1) J.gesto('celebrar', 4);
    J.dibujar(dt); J.vista(1, dt); J.malla.position.copy(NATO); J.malla.rotation.y = J.rumbo;
    lib.position.copy(libroPos()); lib.rotation.set(-0.3, J.rumbo, 0); lib.userData.tapa.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 3);
    brillo.act(t, lib.position, enPlaza ? 0.35 : 0);
    pedro.g.rotation.y = t > 30.5 && t < 35 ? -0.5 : 0; pedro.poner(t > 30.5 && t < 35 ? 'hablar' : t > 35 ? 'saludar' : 'idle'); pedro.act(dt);
    publico.forEach((p, i) => { p.poner(t > 35 && (i + Math.floor(t * 1.5)) % 2 ? 'saludar' : 'idle'); p.act(dt); });
    camaraTomas(cam, tomas, t);
    R.seguirSol(V(0, Y0, -300));
    subtitulosEn([
      [0.8, 5.8, 'Sewell quedó en silencio.'],
      [6.4, 10.8, '13 de julio de 2006: la UNESCO declara a Sewell <b>Patrimonio de la Humanidad</b>.'],
      [11, 15.6, 'Por su valor minero e industrial, por su arquitectura —los «Cuadrados y Triángulos» de sus 253 edificios de colores— y por su cultura.'],
      [15.8, 20.6, 'En 1998 ya era Monumento Nacional. Más de 500.000 personas pasaron por Sewell entre 1905 y 1981.'],
      [26.2, 30.4, '<b>Nato:</b> Como les decía antes de que nos interrumpieran… ¡esta es la historia de Sewell!'],
      [30.6, 34.8, '<b>Pedro:</b> Gracias a todos los sewellinos y sewellinas. Este libro es para ellos.'],
      [35, 38.4, '«¡Bravo, Nato! ¡Bravo, don Pedro!»'],
    ], t);
    cartel(t > 38.6 && t < 42.6 ? `<h1>¡JUEGO COMPLETADO!</h1><p>Puntaje final: <b>${P.puntos}</b> · Pepitas: ${P.pepitas} · Vidas: ${P.vidas}</p>` : t >= 42.8 ? creditos : null);
    if (t > 38.6) subtitulo(null);
  }, DURA);
  if (!saltada) { UI.fundir(true); await new Promise(r => setTimeout(r, 500)); }
  ctx.limpiarMundo(); UI.fundir(false);
  return true;
}

// ---------- N4 · X-K8: rescate de Pedro al vencer al cóndor gigante (antes solo aviso + burbuja y luego la tarjeta «1981»,
// que quedaba TAPADA por el fundido negro: Diego veía la pantalla negra con música y un clic lo llevaba al tren) ----------
// Toma 1: desde atrás de Nato, el cóndor se va hacia la cordillera. Toma 2: Nato y Pedro en el nido, Pedro habla. ~10 s.
// ctx: { G }; c: entidad del cóndor; nido: entidad del nido (nido.pedro = malla de Pedro). Devuelve true si se saltó.
export async function rescatePedro(ctx, M, c, nido) {
  const { G } = ctx, cam = G.render.camara;
  const j = M.jug.pos, J = V(j.x, j.y, j.z);
  const P = V(0, 0, 0); if (nido?.pedro) nido.pedro.getWorldPosition(P); else P.copy(J).add(V(3, 0, 0));
  const cg = c?.malla, c0 = cg ? cg.position.clone() : P.clone().add(V(0, 12, 0));
  const fuera = V(c0.x - j.x, 0, c0.z - j.z); if (fuera.lengthSq() < 1) fuera.set(0, 0, -1); fuera.normalize();
  const lejos = c0.clone().addScaledVector(fuera, 170).add(V(0, 70, 0));
  const medio = J.clone().lerp(P, 0.5), lado = V(-(P.z - j.z), 0, P.x - j.x); if (lado.lengthSq() < 0.01) lado.set(1, 0, 0); lado.normalize();
  if (lado.dot(fuera) > 0) lado.negate();   // la toma doble, del lado contrario a donde se fue el cóndor (más lejos del borde)
  musica('victoria'); efecto('chillido');
  M.jug.gesto('celebrar', 12); M.hercules?.gesto?.('feliz', 12);   // A-CELEB: éxito varonil de Nato; Hércules acompaña
  const dist = Math.max(4.5, J.distanceTo(P) * 1.1 + 2.5);
  const tomas = [
    { desde: 0, hasta: 4, origen: J.clone().add(V(0, 1.4, 0)), pos0: J.clone().addScaledVector(fuera, -4).add(V(0, 1.6, 0)), pos1: J.clone().addScaledVector(fuera, -5).add(V(0, 1.2, 0)), mira: () => (cg ? cg.position : lejos).clone() },
    // desde arriba del borde del nido (Pedro está dentro, más alto que Nato): la cámara sube sobre las ramas para ver a los dos
    { desde: 4, hasta: 11, pos0: medio.clone().addScaledVector(lado, dist).setY(Math.max(J.y, P.y) + 3.2), pos1: medio.clone().addScaledVector(lado, dist * 0.85).setY(Math.max(J.y, P.y) + 2.6),
      mira0: J.clone().add(V(0, 1.2, 0)).lerp(P.clone().add(V(0, 1.2, 0)), 0.55) },
  ];
  const u = una();
  return await correrEscena(G, (t, dt) => {
    if (cg) { const f = tramo(t, 0, 4.5) ** 3; cg.position.lerpVectors(c0, lejos, f); cg.rotation.y = Math.atan2(fuera.x, fuera.z); cg.visible = f < 0.999;
      const cc = cg.userData.condor; if (cc) { cc.tocar('aleteo', 1.3); cc.actualizar(dt); } else if (cg.userData.aletear) cg.userData.aletear(t); }
    u('feliz', t, 4.2, () => { M.jug.gesto('saludar', 7); voz?.('orgulloso'); });
    subtitulosEn([[0.3, 4, '¡El cóndor gigante se va volando a la cordillera!'],
      [4.3, 11, '<b>Pedro:</b> ¡Nato, hijo! Sabía que vendrías. Me adelanto a la estación… ¡Ven con Hércules, nos vemos en el tren!']], t);
    camaraTomas(cam, tomas, t);
  }, 11);
}

// ---------- 1981 · X-K10: el último tren, cinemática dirigida (pedido de Diego: «Hércules no sube al tren final, Nato va vibrando
// y el túnel sigue tapado de tierra»). Antes era juego: Nato saltaba al carro y viajaba con la física de la plataforma (vibraba) y
// Hércules se ponía a su lado por posición. Ahora, sin control del jugador (~45 s, se salta con Enter/clic/mando):
//  A 0-5,5 andén junto a la estación SEWELL, Nato y Hércules esperan · B 5,5-15,5 el tren llega y frena (humo, silbato, chirrido)
//  C 15,5-23 Nato salta al último carro y Hércules salta tras él (clip «saltar» + parábola) · D 23-31 plano medio en el carro con
//  Pedro (cámara en espacio del tren); parte · E 31-37,5 plano general: el tren se aleja por la quebrada, Sewell al fondo ·
//  F 37,5-45 la boca del túnel desde fuera (abierta: construir.js X-K10) y fundido. Luego cierreFinal → créditos en la plaza.
// Los actores van como HIJOS del grupo del tren (espacio local, sin física): no vibran. Las gaussianas que viajan (pasajeros, Pedro)
// van a la escena «aparte» de Spark y se recolocan cada cuadro con el tren (en la de la ciudad se atrasaban ~1 s).
// ctx: { G }. Devuelve true si se saltó.
function sonidosTren() {
  const c = AUDIO.ctx, ok = () => c && !AUDIO.mudo && AUDIO.salida;
  let ruido = null;
  const buf = () => { if (ruido) return ruido; ruido = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return ruido; };
  return {
    silbato(vol = 1) {   // dos tonos de vapor con vibrato, ~1,4 s
      if (!ok()) return; const t = c.currentTime, g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * vol, t + 0.08); g.gain.setValueAtTime(0.09 * vol, t + 1.0); g.gain.linearRampToValueAtTime(0, t + 1.4); g.connect(AUDIO.salida);
      for (const f of [587, 740]) { const o = c.createOscillator(), v = c.createOscillator(), vg = c.createGain(); o.type = 'triangle'; o.frequency.value = f; v.frequency.value = 6; vg.gain.value = 6; v.connect(vg); vg.connect(o.frequency); o.connect(g); o.start(t); v.start(t); o.stop(t + 1.45); v.stop(t + 1.45); }
    },
    chuf(vol = 1) {   // bocanada: ruido filtrado corto
      if (!ok() || vol < 0.02) return; const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf(); f.type = 'bandpass'; f.frequency.value = 520 + Math.random() * 200; f.Q.value = 0.8;
      g.gain.setValueAtTime(0.16 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); s.connect(f); f.connect(g); g.connect(AUDIO.salida); s.start(t); s.stop(t + 0.25);
    },
    freno(dur = 3, vol = 1) {   // chirrido de frenos: agudo que baja y se apaga
      if (!ok()) return; const t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(2300, t); o.frequency.linearRampToValueAtTime(1700, t + dur); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 6;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035 * vol, t + 0.3); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(f); f.connect(g); g.connect(AUDIO.salida); o.start(t); o.stop(t + dur + 0.05);
    },
  };
}
// X-K13: también el final del N1 (1905): op = { tren (entidad de crearTren), pedro: false (Pedro está secuestrado), subs, fondo (mira del plano
// general: El Molino en vez de la ciudad de 1967), hablaNato: [t0, t1] }. Sin op es el final del N4 de siempre.
export async function trenFinalCine(ctx, M, op = {}) {
  const { G } = ctx, R = G.render, cam = R.camara, esc = M.escena;
  const T = op.tren || M.L.lista.find(e => e.tipo === 'tren' && e.final); if (!T) return false;
  const conPedro = op.pedro !== false;
  T.act = () => {};   // el tren lo mueve la escena (antes su estado 'espera' esperaba a Nato encima)
  const g = T.malla, zV = g.position.z, cxL = T.carros[T.carros.length - 1];   // x local del último carro
  const J = M.jug, H = M.hercules, col = J.p.col;
  // andén junto a la estación SEWELL (x 32-58, z 0,5-11,5): Nato a ~2 m del borde amarillo; el tren para con el último carro frente a él
  const NX = 37.5, NZ = 16.2, s0 = M.fis.suelo(NX, NZ, 8, col), gy = s0 != null && s0 > 0.3 && s0 < 3 ? s0 : 0.9;
  const PARADA = NX - cxL + 0.6, X0 = PARADA - 150;
  T.mover(X0, 0);
  // luz cálida de atardecer: sol bajo del poniente, más dorado (se restaura al terminar)
  const luz = { col: R.sol.color.clone(), int: R.sol.intensity, dir: R.dirSol?.clone(), cielo: R.cielo.color.clone() };
  R.sol.color.set(0xffcf9a); R.sol.intensity = luz.int * 0.95; R.cielo.color.set(0xffe9d4); if (R.dirSol) R.dirSol.set(-0.75, 0.42, 0.5).normalize();
  // actores: Nato (malla) y Hércules (malla) en el mundo hasta que suben; luego hijos del grupo del tren
  const ESC = J.malla.parent;
  J.malla.visible = true; if (J.splat) J.splat.visible = true; J.malla.position.set(NX, gy, NZ); J.malla.rotation.y = -Math.PI / 2; J.rumbo = -Math.PI / 2;
  const hSplat = (() => { let s = false; H?.malla.traverse(o => { if (o.isSplatMesh) s = true; }); return s; })();
  const HX = NX - 1.3, HZ = NZ - 0.4;
  if (H) { H.estado = 'final'; H.malla.visible = true; H.malla.position.set(HX, gy, HZ); H.malla.rotation.y = -Math.PI / 2; H.posAct?.copy(H.malla.position); H.posAnt?.copy(H.malla.position); }   // X-K13: posAct/posAnt, si no el paso interpolado lo devolvía a donde estaba (N1: al campamento)
  J.teletransportar?.(NX, gy + 0.05, NZ); J.malla.position.set(NX, gy, NZ);   // X-K13: el cuerpo también (en el N1 la malla volvía a la meta 30,14 cada cuadro)
  const hAnim = (n, op) => H?.anim?.tocar(n, { fundido: 0.25, ...op }), hAct = dt => { const a = H?.anim; if (a) (a.real || a.actualizar)(dt); };
  // asientos en el último carro (espacio local del tren): piso del carro a 1,5 m; todos miran hacia Sewell (-Z)
  // 16-11 (Diego: «sus piernas atraviesan el carro… que se siente en una caja; Hércules también atraviesa el piso»): el piso VISIBLE del
  // carro de Idol está a 1,66 (y 0,38 + plataforma 1,28), no a 1,5: Hércules y Pedro van sobre él y Nato se sienta en un cajón de 0,45 m
  const PISO = 1.66, CAJA = 0.45;
  const SN = V(cxL - 0.4, PISO + CAJA, -0.7), SH = V(cxL - 1.45, PISO, -0.6), SP = V(cxL + 0.55, PISO, -0.35);
  {
    const caja = new THREE.Group(); caja.position.set(SN.x, PISO, SN.z); g.add(caja);
    const resp = new THREE.Mesh(new THREE.BoxGeometry(0.8, CAJA, 0.55).translate(0, CAJA / 2, 0), new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.85 }));
    caja.add(resp);
    import('../mundo/utileria.js').then(U => { const pon = () => { const p = U.piezaGrupo('cajon', [1, CAJA / 0.6, 1]); if (p) { caja.remove(resp); caja.add(p); } }; if (U.hayPieza('cajon')) pon(); else U.precargarUtileria()?.then(pon); }).catch(() => {});
  }
  const _ha = new THREE.Vector3(), _hb = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hp = new THREE.Quaternion(), _hc = new THREE.Quaternion();
  const apuntar = (hueso, hijo, dir) => { if (!hueso || !hijo) return; hueso.updateWorldMatrix(true, true); const d = hijo.getWorldPosition(_hb).sub(hueso.getWorldPosition(_ha)).normalize();
    _hq.setFromUnitVectors(d, dir); hueso.getWorldQuaternion(_hc); hueso.parent.getWorldQuaternion(_hp); hueso.quaternion.copy(_hp.invert().multiply(_hq.multiply(_hc))); };
  let HN = null;
  const sentarNato = () => {   // sentado en el cajón: cadera sobre la tapa, muslos al frente, canillas hacia abajo (pies al piso del carro)
    if (!HN) { HN = {}; J.malla.traverse(o => { if (o.isBone) HN[o.name] = o; }); }
    const tL = HN.thighL || HN['thigh.L'], tR = HN.thighR || HN['thigh.R']; if (!tL || !tR) return;
    J.malla.updateWorldMatrix(true, true);
    const yC = (tL.getWorldPosition(_ha).y + tR.getWorldPosition(_hb).y) / 2, yAsiento = g.position.y + SN.y + 0.07;
    J.malla.position.y += yAsiento - yC; J.malla.updateWorldMatrix(true, true);
    const adel = new THREE.Vector3(0, 0, 1).applyQuaternion(J.malla.getWorldQuaternion(new THREE.Quaternion())); adel.y = 0; adel.normalize();
    for (const L of ['L', 'R']) {
      apuntar(HN['thigh' + L] || HN['thigh.' + L], HN['shin' + L] || HN['shin.' + L], adel.clone().add(new THREE.Vector3(0, -0.08, 0)).normalize());
      apuntar(HN['shin' + L] || HN['shin.' + L], HN['foot' + L] || HN['foot.' + L], adel.clone().multiplyScalar(0.15).add(new THREE.Vector3(0, -1, 0)).normalize());
    }
  };
  // pasajeros de gaussianas: a la escena «aparte» y recolocados con el tren; el Pedro fijo del carro se cambia por uno animado
  const viajan = [];
  for (const o of [...g.children]) if (o.userData && o.userData.splat === true) {
    if (conPedro && Math.abs(o.position.x - (cxL + 0.6)) < 0.05 && Math.abs(o.position.z + 0.5) < 0.05) { o.visible = false; continue; }
    let malla = false; o.traverse(x => { if (x.userData && x.userData.mallaPromesa) malla = true; });
    if (!malla) viajan.push([o, o.position.clone()]);   // G-PERS: los pasajeros con malla siguen como hijos del tren (con luz)
  }
  const pedro = conPedro ? persona(esc, 'pedro') : { g: new THREE.Group(), poner() {}, act() {}, listo: Promise.resolve() }; pedro.g.rotation.y = Math.PI;
  if (!conPedro) { /* N1: sin Pedro */ } else if (pedro.g.userData.malla) { pedro.g.position.set(g.position.x + SP.x, g.position.y + SP.y, g.position.z + SP.z); g.attach(pedro.g); } else viajan.push([pedro.g, SP.clone()]);
  for (const [o] of viajan) M.aparte(o, true);
  const recolocar = () => { for (const [o, l] of viajan) o.position.set(g.position.x + l.x, g.position.y + l.y, g.position.z + l.z); };
  recolocar();
  if (conPedro) await esperarSplats([pedro.g], 8000, [pedro]);
  const S = sonidosTren(), u = una();
  musica(null);
  let v = 14, tChuf = 0, subeN = null, subeH = null;
  const frente = () => V(T.x + 3.3, 2.4, zV);
  const salta = (obj, desde, haciaLocal, k, alto) => {   // parábola del andén al carro (hacia en espacio local del tren)
    const h = haciaLocal.clone().add(g.position); obj.position.lerpVectors(desde, h, k); obj.position.y += Math.sin(k * Math.PI) * alto;
  };
  const MOUTH = (() => { const tx = (M.R.tapones || []).map(t => t.pos.x).filter(x => x > PARADA + 20); return tx.length ? Math.min(...tx) - 1.2 : 243; })();
  // tomas (las del tren se calculan cada cuadro con su posición)
  const enTren = (lx, ly, lz) => V(g.position.x + lx, g.position.y + ly, g.position.z + lz);
  const tomas = [
    { desde: 0, hasta: 5.5, pos0: V(NX + 17, gy + 3.4, NZ + 0.6), pos1: V(NX + 13, gy + 2.7, NZ + 0.2), mira0: V(NX - 2, gy + 1.6, NZ - 2.5), mira1: V(NX - 3, gy + 1.3, NZ - 1) },
    // sobre el hombro: el tren entra por la izquierda y frena delante de ellos
    { desde: 5.5, hasta: 11, pos0: V(NX + 5.5, gy + 2.1, NZ - 3.4), pos1: V(NX + 5, gy + 1.9, NZ - 3.2), mira: () => V(NX - 14, 2.2, zV - 1).lerp(frente(), 0.35) },
    // a ras de los rieles, por delante: la locomotora llega frenando y echando humo
    { desde: 11, hasta: 15.5, pos0: V(PARADA + 15, gy + 0.6, NZ + 1.4), pos1: V(PARADA + 14, gy + 0.8, NZ + 1.4), mira: () => frente().add(V(0, 0.3, 0)) },
    // el salto: de tres cuartos por detrás, desde el oriente del andén (por el poniente el letrero SEWELL tapaba la toma)
    { desde: 15.5, hasta: 23, pos0: V(NX + 6.8, gy + 2.5, NZ - 1.4), pos1: V(NX + 6.2, gy + 2.8, NZ - 1.8), mira0: V(NX - 0.6, gy + 1.0, NZ + 2.6), mira1: V(NX - 0.9, gy + 1.3, NZ + 3.6) },
    // plano medio en el carro, la cámara viaja con el tren
    { desde: 23, hasta: 29.2, pos: (t, f) => enTren(cxL + 2.6 - f * 0.4, 1.5 + 1.75, -4.4 + f * 0.3), mira: () => enTren(cxL - 0.5, 1.5 + 0.75, -0.5) },   // termina antes de los pilares del fin del andén
    // plano general: el tren se aleja por la quebrada hacia el túnel, Sewell arriba al fondo
    // (libre: la cámara está en el aire, sobre el terreno; el rayo mira→cámara cruzaba la ciudad y la metía entre los edificios)
    op.general ? { desde: 29.2, hasta: 37.5, libre: true, pos0: op.general.pos0, pos1: op.general.pos1, mira: () => op.fondo.clone().lerp(V(T.x - 10, 3, zV), op.general.k ?? 0.3) } :   // X-K13: N1, desde el oriente alto: tren delante, El Molino arriba
    { desde: 29.2, hasta: 37.5, libre: true, pos0: V(PARADA + 125, Math.max(34, altura(PARADA + 125, zV + 92) + 10), zV + 92), pos1: V(PARADA + 121, Math.max(37, altura(PARADA + 121, zV + 90) + 12), zV + 90), mira: () => (op.fondo ? op.fondo.clone() : V(0, 95, -245)).lerp(V(T.x - 20, 3, zV), 0.58) },
    // la boca del túnel desde fuera (corte: el tren ya está llegando)
    { desde: 37.5, hasta: 46, pos0: V(MOUTH - 34, 8, zV + 11), pos1: V(MOUTH - 31, 7.2, zV + 10), mira0: V(MOUTH - 6, 2.4, zV), mira1: V(MOUTH - 1, 2.6, zV) },
  ];
  const fundido = document.getElementById('fundido'); const DURA = 46;
  M.final = 'tren';
  const saltada = await correrEscena(G, (t, dt) => {
    // ---- el tren ----
    if (t < 25) {
      const falta = PARADA - T.x; v = Math.min(v, Math.sqrt(2 * 1.6 * Math.max(0, falta)) + 0.15);
      T.mover(Math.min(PARADA, T.x + v * dt), dt); if (T.x >= PARADA - 0.02) v = 0;
    } else if (t < 37.5) { v = Math.min(11, v + dt * 1.05); T.mover(T.x + v * dt, dt); }
    else { if (!u.c) { u.c = 1; v = 11; T.mover(MOUTH - 3.3 - 11 * 3.2, 0); } T.mover(T.x + v * dt, dt); }
    recolocar();
    // sonido sincronizado con el tren: «chuf» al ritmo de la marcha (más suave lejos de la cámara), silbatos y frenos
    const dc = cam.position.distanceTo(frente()), volT = Math.min(1, 22 / (dc + 6));
    tChuf -= dt; if (v > 0.6 && tChuf <= 0) { tChuf = Math.max(0.14, 0.5 - v * 0.04); S.chuf(volT); }
    u('pito1', t, 1.2, () => S.silbato(0.35));
    u('freno', t, 8.8, () => S.freno(5.5, 0.8));
    u('pito2', t, 24.2, () => S.silbato(1));
    u('musica', t, 25.5, () => musica('titulo'));
    u('pito3', t, 39.2, () => S.silbato(0.6));
    // ---- Nato ----
    const A = J.anim;
    if (t < 15.5) { A?.tocar(t > 9 && t < 13 ? 'saludar' : 'idle', { fundido: 0.3 }); J.malla.rotation.y = -Math.PI / 2 + (t > 6 ? 0.35 : 0); }
    else if (t < 16.6) { const k = tramo(t, 15.5, 16.6); J.malla.rotation.y = -Math.PI / 2 * (1 - k) + 0; A?.tocar('caminar', { fundido: 0.2 }); J.malla.position.set(NX, gy, NZ + k * 1.4); }
    else if (t < 17.3) { if (!subeN) { subeN = J.malla.position.clone(); A?.tocar('saltar', { reiniciar: true, fundido: 0.08 }); }
      salta(J.malla, subeN, SN, (t - 16.6) / 0.7, 1.1); J.malla.rotation.y = 0; }
    else {
      if (J.malla.parent !== g) { g.attach(J.malla); J.malla.position.copy(SN); A?.tocar('aterrizar', { reiniciar: true, fundido: 0.08 }); }
      J.malla.rotation.y = t < 19.6 ? Math.PI * tramo(t, 18, 19.6) : Math.PI;
      if (t > 19.6 && !u.sienta) { u.sienta = 1; A?.tocar('idle', { fundido: 0.3 }); }   // 16-11: se sienta en el cajón (sentarNato, después de animar)
    }
    A?.actualizar(dt);
    if (u.sienta) sentarNato();
    // ---- Hércules: espera, ladra, corre al borde y salta tras Nato ----
    if (H) {
      if (t < 17) { hAnim(t > 11 && t < 12.2 ? 'ladrar' : 'sentado'); }
      else if (t < 18.1) { const k = tramo(t, 17, 18.1); hAnim('correr', { vel: 1.1 }); H.malla.position.set(HX + k * 1.0, gy, HZ + k * 1.6); H.malla.rotation.y = Math.atan2(1.0, 1.6); }
      else if (t < 18.85) { if (!subeH) { subeH = H.malla.position.clone(); hAnim('saltar', { reiniciar: true, fundido: 0.08 }); }
        salta(H.malla, subeH, SH, (t - 18.1) / 0.75, 1.3); H.malla.rotation.y = 0.3; }
      else {
        if (!hSplat && H.malla.parent !== g) { g.attach(H.malla); H.malla.position.copy(SH); }
        if (hSplat) H.malla.position.copy(SH).add(g.position);
        H.malla.rotation.y = t < 20.4 ? 0.3 + (Math.PI - 0.3) * tramo(t, 19, 20.4) : Math.PI;
        hAnim(t < 19.2 ? 'idle' : t > 27.6 && t < 28.6 ? 'feliz' : 'sentado');
      }
      hAct(dt);
    }
    // ---- Pedro ----
    pedro.poner(t > 15.5 && t < 18.5 ? 'saludar' : (t > 23.4 && t < 26.6) ? 'hablar' : 'idle'); pedro.act(dt);
    // ---- cámara, sol, fundido ----
    camaraTomas(cam, tomas, t);
    R.seguirSol(t < 29.2 ? V(NX, gy, NZ) : t < 37.5 ? V(T.x, 0, zV) : V(MOUTH, 0, zV));
    tinte(0.04);
    if (fundido) fundido.style.opacity = t > 43.6 ? tramo(t, 43.6, 45.4) : 0;
    subtitulosEn(op.subs || [
      [0.6, 5.2, '1981 · Estación de Sewell. Nato y Hércules esperan el último tren.'],
      [15.6, 18.6, '<b>Pedro:</b> ¡Aquí, hijo! ¡Arriba! ¡Y tú también, Hércules!'],
      [23.4, 26.6, '<b>Pedro:</b> Se va el último tren… Sewell queda en nuestra memoria.'],
      [26.8, 29.2, '<b>Nato:</b> Adiós, Sewell. Vamos a contar tu historia.'],
      [29.6, 37, 'El tren baja por la quebrada. Arriba, la ciudad de las escaleras queda en silencio.'],
    ], t);
  }, DURA);
  // limpieza (cierreFinal limpia el mundo enseguida; esto deja todo coherente si algo más corre antes)
  if (fundido) fundido.style.opacity = 1;
  for (const [o] of viajan) M.aparte(o, false);
  pedro.g.removeFromParent();
  if (J.malla.parent === g) ESC.attach(J.malla); if (H && H.malla.parent === g) ESC.attach(H.malla);
  R.sol.color.copy(luz.col); R.sol.intensity = luz.int; R.cielo.color.copy(luz.cielo); if (luz.dir) R.dirSol.copy(luz.dir);
  return saltada;
}
