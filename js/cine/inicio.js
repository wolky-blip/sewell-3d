// X-K1 · Cinemática de inicio EN EL MOTOR (reemplaza las 3 tarjetas de introPlaza): Sewell hoy, plaza de la tarima (N4, 1967 = la
// ciudad conservada). Nato y Pedro presentan el libro → llega el jefe de los mineros con su tropa y el cóndor gigante → paliza de
// caricatura (polvareda y estrellitas) → el cóndor se lleva a Pedro hacia lo alto → Nato recoge el libro: luz cobriza con chispas.
// 2.ª pasada (pedido de main, «épico»): travelling de entrada, primeros planos al hablar, contraplanos por sobre el hombro,
// contrapicados al jefe y al cóndor, sombra del cóndor que cruza la plaza, viento en banderas y polvo, garras en cámara lenta,
// golpes musicales y final dorado. Saltable con Enter (o un toque); con ?rapido=1 se salta sola.
// Prueba y hoja de cuadros: herramientas/cine_prueba.js → capturas/cine/hoja_inicio.png
import * as THREE from 'three';
import { correrEscena, camaraTomas, subtitulosEn, tramo, suave, V, tinte } from './director.js';
import { persona, condorGigante, libro, polvareda, estrellitas, luzCobriza, sombraCondor, banderas, esperarSplats, ENVERGADURA_CONDOR_GIGANTE } from './actores.js';
import { musica } from './musica.js';
import { cargarPlaza, cargandoActores } from './plaza.js';
import { voz, efecto } from '../motor/audio.js';

// tiempo del guion: cámara lenta (40 %) entre 23,0 y 24,2 s de guion (las garras toman a Pedro)
const LENTO0 = 23, LENTO1 = 24.2, RITMO = 0.4, EXTRA = (LENTO1 - LENTO0) / RITMO - (LENTO1 - LENTO0);
const guionT = t => t < LENTO0 ? t : t < LENTO0 + (LENTO1 - LENTO0) / RITMO ? LENTO0 + (t - LENTO0) * RITMO : t - EXTRA;
const DURA_GUION = 39, DURA = DURA_GUION + EXTRA;   // ~40,8 s reales
const SUBS = [
  [0.8, 5, 'Sewell, hoy. La plaza de la ciudad de las escaleras.'],
  [5.4, 8.3, '<b>Nato:</b> ¡Bienvenidos! Hoy presentamos el libro de mi papá.'],
  [8.5, 11.1, '<b>Pedro:</b> «Apuntes Históricos de El Mineral El Teniente».'],
  [12.7, 14.5, '<b>Jefe de los mineros:</b> ¡Alto ahí! Ese libro cuenta demasiado.'],
  [14.7, 16.7, '<b>Jefe:</b> ¡Muchachos, llévense al viejo!'],
  [17, 21.5, '¡PUM! ¡PAF! ¡ZAS!'],
  [24.3, 27, '<b>Pedro:</b> ¡Nato, hijo! ¡Cuida el libro!'],
  [27.2, 30.2, 'El cóndor gigante se lleva a Pedro a lo más alto de Sewell…'],
  [30.6, 32.6, 'En el suelo quedó el libro.'],   // N0-FABLE-1611 (M13): termina antes de que Nato lo recoja (32,6)
  [34.2, 38.6, '<b>Nato:</b> ¡Imagínate el resultado!'],
];

// ctx: { G, crearMundo, pantallaCarga, limpiarMundo, NIVELES, UI }
export async function cinematicaInicio(ctx) {
  const { G, UI } = ctx;
  if (new URLSearchParams(location.search).has('rapido') && !new URLSearchParams(location.search).has('cine')) return;
  musica('creditos');
  const { M, suelo, Y0, YS } = await cargarPlaza(ctx, 'Sewell, hoy', 'La plaza de Sewell');   // Y0: plaza, YS: tarima
  const esc = M.escena, R = G.render, cam = R.camara;
  // ---- actores ----
  const J = M.jug; J.estado = 'normal'; J.invul = 0;   // Nato: el MISMO Jugador del juego (malla y acciones de Blender)
  const NATO_A = V(-1.6, YS, -309.6), NATO_B = V(0, Y0, -304.4), LIBRO_C = V(1.1, Y0 + 0.03, -302.9);
  const pedro = persona(esc, 'pedro'), PEDRO_A = V(1.6, YS, -309.6);
  const jefe = persona(esc, 'jefe');
  const mineros = [0, 1, 2].map(() => persona(esc, 'minero'));
  const publico = [['vecina', -7, -298], ['anciana', -9.5, -295], ['diego', -6, -292], ['medico', 7, -297], ['vecina', 9.5, -294], ['enfermera', 6.5, -291], ['anciana', 10, -300]]
    .map(([id, x, z]) => { const p = persona(esc, id); p.g.position.set(x, suelo(x, z), z); return p; });
  const condor = condorGigante(M); esc.add(condor);
  // A-CONDOR3: luz de relleno para la cara del cóndor en el secuestro (la toma salía a contraluz); sigue a la cámara y apunta al cóndor
  const relleno = new THREE.DirectionalLight(0xfff0e0, 0); relleno.target = new THREE.Object3D(); esc.add(relleno, relleno.target);
  const sombra = sombraCondor(esc, ENVERGADURA_CONDOR_GIGANTE), flamear = banderas(esc, V(0, YS + 4.4, -312.5));
  const lib = libro(); lib.scale.setScalar(0.8); esc.add(lib);
  await cargandoActores(G, esperarSplats([pedro.g, jefe.g, condor, ...mineros.map(m => m.g), ...publico.map(p => p.g)], 25000, [pedro, jefe, ...mineros]));   // X-K14: carga en vez de negro
  for (const a of [pedro, jefe, ...mineros, ...publico]) { a.poner('idle'); a.act(0.016); }
  // los que se mueven van a la escena «aparte» (SparkRenderer propio, sin LoD): en la de la ciudad Spark dibuja posiciones de hace ~1 s
  // y el jefe aparecía lejos de su primer plano (mismo arreglo que N1-C45 para Hércules en el capacho)
  for (const g of [jefe.g, pedro.g, condor, ...mineros.map(m => m.g)]) if (!g.userData.malla) M.aparte(g, true);   // X-K4: las mallas (jefe, secuaces) se quedan en la escena con luz
  UI.fundir(false);   // pose inicial puesta: sin ella el splat con esqueleto no se dibuja; actores cargados antes de rodar
  const polvo = polvareda(esc), viento = polvareda(esc, 12), estrellas = estrellitas(esc), magia = luzCobriza(esc);
  const mira = (g, x, z, k = 1) => { const d = Math.atan2(x - g.position.x, z - g.position.z) - g.rotation.y; g.rotation.y += Math.atan2(Math.sin(d), Math.cos(d)) * k; };
  const caminar = (a, p0, p1, t, t0, t1, anim = 'caminar') => {
    const f = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    a.g.position.lerpVectors(p0, p1, f); a.g.position.y = suelo(a.g.position.x, a.g.position.z);
    if (f > 0 && f < 1) { mira(a.g, p1.x, p1.z, 0.2); a.poner(anim); return true; }
    return false;
  };
  // Nato movido a mano (sin física): se elige la acción con su velocidad y gestos, como en el juego
  const nato = { pos: NATO_A.clone(), rumbo: 0, vel: 0 };
  const ponerNato = dt => {
    J.t += dt; J.p.enSuelo = true;
    J.vel.set(Math.sin(nato.rumbo) * nato.vel, 0, Math.cos(nato.rumbo) * nato.vel);
    J.rumbo = nato.rumbo; J.dibujar(dt); J.vista(1, dt);
    J.malla.position.copy(nato.pos); J.malla.rotation.y = nato.rumbo;
    if (J.splat) J.splat.visible = true;
  };
  const JEFE_A = V(0, Y0, -272), JEFE_B = V(-1.2, Y0, -299.8), FUERA = V(-3, Y0, -270);
  const condorPos = new THREE.Vector3();
  const delante = (p, rumbo, d, alto, lado = 0) => V(p.x + Math.sin(rumbo) * d + Math.cos(rumbo) * lado, p.y + alto, p.z + Math.cos(rumbo) * d - Math.sin(rumbo) * lado);
  const fwdCondor = () => V(Math.sin(condor.rotation.y), 0, Math.cos(condor.rotation.y)), latCondor = () => V(Math.cos(condor.rotation.y), 0, -Math.sin(condor.rotation.y));
  const cabezaCondor = () => condorPos.clone().addScaledVector(fwdCondor(), 1.9).add(V(0, -0.15, 0));   // la cabeza queda ~1,9 m delante del centro (envergadura 9 m)
  const caraCam = (dist, lado, alto) => cabezaCondor().addScaledVector(fwdCondor(), dist).addScaledVector(latCondor(), lado).add(V(0, alto, 0));
  // ---- planos de cámara (tiempo de guion) ----
  const tomas = [
    // travelling de entrada: de la cordillera sobre Sewell hasta la plaza
    { desde: 0, hasta: 5.2, pos0: V(70, Y0 + 75, -205), pos1: V(9, Y0 + 4.2, -290.5), mira0: V(-10, Y0 + 15, -340), mira1: V(-0.5, YS + 1.6, -309.6) },
    // primer plano de Nato al hablar (con el libro), push-in
    { desde: 5.2, hasta: 8.4, pos0: delante(NATO_A, 0, 2.4, 1.55, 0.5), pos1: delante(NATO_A, 0, 1.75, 1.6, 0.35), mira0: V(NATO_A.x, YS + 1.5, NATO_A.z) },
    // primer plano de Pedro (por sobre el hombro de Nato)
    { desde: 8.4, hasta: 11.2, pos0: V(-0.9, YS + 1.75, -307.6), pos1: V(-0.6, YS + 1.7, -308.0), mira0: V(PEDRO_A.x, YS + 1.5, PEDRO_A.z) },
    // contraplano por sobre el hombro de Nato: el jefe aparece al fondo de la plaza
    { desde: 11.2, hasta: 12.6, pos: () => delante(NATO_A, Math.PI, 1.1, 1.8, -0.45), mira: () => jefe.g.position.clone().add(V(0, 1.6, 0)) },
    // contrapicado y push-in al jefe mientras avanza
    { desde: 12.6, hasta: 14.6, pos: (t, f) => { const r = Math.atan2(NATO_A.x - jefe.g.position.x, NATO_A.z - jefe.g.position.z); return delante(jefe.g.position, r, 4.2 - 1.6 * f, 0.5, 0.6); }, mira: () => jefe.g.position.clone().add(V(0, 2.05, 0)) },
    // por sobre el hombro del jefe: Nato baja de la tarima a encararlo
    { desde: 14.6, hasta: 16.8, pos: () => delante(JEFE_B, Math.atan2(NATO_B.x - JEFE_B.x, NATO_B.z - JEFE_B.z), -1.3, 2.45, 0.7), mira: () => nato.pos.clone().add(V(0, 1.2, 0)) },
    // la paliza: cámara baja que gira alrededor de la polvareda
    { desde: 16.8, hasta: 22.2, lineal: true, pos: t => { const a = 0.8 + (t - 16.8) * 0.45; return V(NATO_B.x + Math.sin(a) * 4.2, Y0 + 1.1, NATO_B.z + Math.cos(a) * 4.2); }, mira0: V(NATO_B.x, Y0 + 1, NATO_B.z) },
    // A-CONDOR3: la cara del cóndor gigante, de frente y a la altura de la cabeza (antes: contrapicado a contraluz que solo mostraba la silueta)
    // picada: la cámara espera delante del cóndor, que baja con el pico abierto mirando a Pedro
    { desde: 22.2, hasta: LENTO0, pos: (t, f) => caraCam(3.8 - 1.2 * f, 1.8, -0.2), mira: () => cabezaCondor() },
    // cámara lenta: las garras toman a Pedro; encuadre abierto con la cara arriba y Pedro abajo
    { desde: LENTO0, hasta: LENTO1, pos: (t, f) => caraCam(4.6 + 0.8 * f, 2.4, -0.6), mira: () => condorPos.clone().addScaledVector(fwdCondor(), 1.0).add(V(0, -0.2, 0)) },
    // el cóndor se lleva a Pedro hacia lo alto: la cámara lo acompaña de frente, con Pedro colgando
    { desde: LENTO1, hasta: 27.6, pos: (t, f) => caraCam(5 + 2.5 * f, 2.2, -0.6), mira: () => condorPos.clone().addScaledVector(fwdCondor(), 1.0).add(V(0, -0.5, 0)) },
    // y se aleja (contrapicado desde la plaza, junto a Nato)
    { desde: 27.6, hasta: 30.4, pos: (t, f) => V(NATO_B.x + 1.2, Y0 + 1.3 - 0.4 * f, NATO_B.z + 2.2), mira: () => condorPos.clone().add(V(0, -1.6, 0)) },
    // Nato va por el libro
    { desde: 30.4, hasta: 33.4, pos0: V(2.6, Y0 + 1.5, -299.8), pos1: V(1.9, Y0 + 1.3, -300.6), mira0: V(0.6, Y0 + 0.8, -303.4), mira1: V(0.7, Y0 + 0.9, -303.4) },
    // primer plano final: la luz cobriza, la cámara sube despacio
    { desde: 33.4, hasta: DURA_GUION, pos: (t, f) => delante(nato.pos, nato.rumbo, 2.8 - 0.5 * f, 1.5 + 0.3 * f, 0.3), mira: (t, f) => nato.pos.clone().add(V(0, 1.55 + 0.1 * f, 0)) },   // N0-FABLE-1611 (M13): la cabeza quedaba fuera de cuadro (mira al pecho, a 1,8 m)
  ];
  let sacudir = 0, golpeT = 0, aleteoT = 0, ultimoTs = 0;
  const hecho = {}, una = (k, t, t0, f) => { if (t >= t0 && !hecho[k]) { hecho[k] = 1; f(); } };

  const saltada = await correrEscena(G, (tReal, dtReal) => {
    const t = guionT(tReal), dt = Math.max(0, t - ultimoTs); ultimoTs = t;
    // --- música, voces y sonidos ---
    una('tension', t, 11.2, () => { musica('tension'); efecto('golpeTam'); efecto('chillido'); sacudir = 0.15; });
    una('jefe', t, 12.6, () => efecto('golpeTam'));
    una('picada', t, 22.2, () => { efecto('golpeTam'); efecto('chillido'); });
    una('garras', t, LENTO0 + 0.3, () => { efecto('golpeFuerte'); sacudir = 0.25; });
    una('calla', t, 30.4, () => musica(null));
    una('magia', t, 33.2, () => efecto('magia'));
    una('voz', t, 34.2, () => voz('imaginate'));
    una('creditos', t, 34.6, () => musica('creditos'));
    if (t > 16.8 && t < 21.8 && (golpeT -= dt) <= 0) { golpeT = 0.32; efecto(Math.random() < 0.5 ? 'golpe' : 'golpeFuerte'); sacudir = 0.14; }
    if (t > 11 && t < 30 && (aleteoT -= dt) <= 0) { aleteoT = 1.1; efecto('aleteo'); }
    // --- Nato ---
    nato.vel = 0;
    if (t < 11.2) { nato.pos.copy(NATO_A); nato.rumbo = t < 8.4 ? 0 : 0.5; if (t > 6 && !hecho.saluda) { hecho.saluda = 1; J.gesto('saludar', 2.2); } }
    else if (t < 14.6) { nato.pos.copy(NATO_A); nato.rumbo = Math.atan2(jefe.g.position.x - nato.pos.x, jefe.g.position.z - nato.pos.z); }
    else if (t < 16.4) {   // baja de la tarima a encarar al jefe
      const f = (t - 14.6) / 1.8; nato.pos.lerpVectors(NATO_A, NATO_B, f); nato.pos.y = YS + (Y0 - YS) * suave(f) + Math.sin(Math.min(1, f * 1.6) * Math.PI) * 0.25;
      nato.rumbo = Math.atan2(NATO_B.x - NATO_A.x, NATO_B.z - NATO_A.z); nato.vel = 2.6;
    } else if (t < 21.6) { nato.pos.copy(NATO_B); nato.pos.x += Math.sin(t * 31) * 0.06; J.estado = 'herido'; nato.rumbo += dt * 2.5; }
    else if (t < 30.2) { J.estado = 'normal'; nato.pos.copy(NATO_B); if (!hecho.suelo) { hecho.suelo = 1; nato.rumboSuelo = nato.rumbo; J.gesto('apaleado_suelo', 8.6); } nato.rumbo = nato.rumboSuelo; }   // tirado de espaldas (clip G-A9)
    else if (t < 31.7) { nato.pos.copy(NATO_B); if (!hecho.levanta) { hecho.levanta = 1; J.gesto('levantarse', 1.5); } }
    else if (t < 32.6) { const f = (t - 31.7) / 0.9; nato.pos.lerpVectors(NATO_B, V(LIBRO_C.x - 0.5, Y0, LIBRO_C.z - 0.45), f); nato.rumbo = Math.atan2(LIBRO_C.x - NATO_B.x, LIBRO_C.z - NATO_B.z); nato.vel = 1.6; }
    else { nato.rumbo = Math.atan2(LIBRO_C.x - nato.pos.x, LIBRO_C.z - nato.pos.z) * (1 - tramo(t, 33, 34.5)) + 0.6 * tramo(t, 33, 34.5); if (!hecho.recoge) { hecho.recoge = 1; J.gesto('recoger', 1.4); } if (t > 35 && !hecho.celebra) { hecho.celebra = 1; J.gesto('celebrar', 3); } }
    ponerNato(dt);
    // --- libro ---
    const manos = V(nato.pos.x + Math.sin(nato.rumbo) * 0.38, nato.pos.y + 1.12, nato.pos.z + Math.cos(nato.rumbo) * 0.38);
    if (t < 16.4) { lib.position.copy(manos); lib.rotation.set(-0.3, nato.rumbo, 0); }
    else if (t < 17.4) { const f = t - 16.4; lib.position.lerpVectors(manos, LIBRO_C, f); lib.position.y += Math.sin(f * Math.PI) * 1.4; lib.rotation.set(-Math.PI / 2 * f, nato.rumbo + f * 5, f * 3); }
    else if (t < 32.6) { lib.position.copy(LIBRO_C); lib.rotation.set(-Math.PI / 2, 0.4, 0); }
    else { const f = tramo(t, 32.6, 33.4); lib.position.lerpVectors(LIBRO_C, manos, f); lib.rotation.set(-Math.PI / 2 * (1 - f) - 0.3 * f, 0.4 * (1 - f) + nato.rumbo * f, 0); }
    lib.userData.tapa.emissiveIntensity = 1.1 * tramo(t, 32.8, 34);
    // --- cóndor gigante: vuela en círculos sobre la plaza (su sombra la cruza), baja en picada y se lleva a Pedro hacia lo alto ---
    const antes = condor.position.clone();
    const circulo = tt => V(Math.cos(tt * 0.45) * 15, Y0 + 19 + Math.sin(tt * 0.9) * 1.5, -300 + Math.sin(tt * 0.45) * 15);
    const GARRA = V(PEDRO_A.x, YS + 2.6, PEDRO_A.z), NIDO = V(-24, Y0 + 95, -400);
    const enCielo = t > 10.6 && t < 30.5;
    if (t < 22.2) condorPos.copy(circulo(t));
    else if (t < LENTO0 + 0.4) condorPos.lerpVectors(circulo(22.2), GARRA, suave((t - 22.2) / (LENTO0 + 0.4 - 22.2)));
    else if (t < LENTO1) condorPos.copy(GARRA).add(V(0, (t - LENTO0 - 0.4) * 0.8, 0));
    else { const f = Math.min(1, (t - LENTO1) / 6.2); condorPos.lerpVectors(GARRA.clone().add(V(0, 0.64, 0)), NIDO, f * (0.35 + 0.65 * f)); }
    condor.position.copy(condorPos); if (!enCielo) condor.position.y = Y0 - 60;
    const dx = condor.position.x - antes.x, dz = condor.position.z - antes.z;
    if (dx * dx + dz * dz > 1e-6) { let d = Math.atan2(dx, dz) - condor.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); condor.rotation.y += d * Math.min(1, dt * 5); }
    condor.userData.aletear(t * (t > LENTO0 && t < LENTO1 ? 1 : 1.4));
    {   // A-CONDOR3: el cóndor gigante baja la cabeza hacia Pedro y chilla con el pico abierto durante el secuestro; luz de relleno hacia su cara
      const cm = condor.userData.condor, sec = t > 21.8 && t < 30.4;
      if (cm) { cm.mira = sec ? 0.7 * tramo(t, 21.8, 22.8) : 0; cm.pico = t > 22.3 && t < 25.6 ? 0.75 : t > 25.6 && t < 30.4 ? 0.3 : undefined; }
      relleno.intensity = sec ? 2.6 * Math.min(tramo(t, 21.6, 22.4), 1 - tramo(t, 29.5, 30.4)) : 0;
      relleno.position.copy(cam.position).add(V(0, 1.5, 0)); relleno.target.position.copy(condorPos).add(V(0, 0.5, 0));
    }
    sombra.act(enCielo ? condorPos : V(0, 1e4, 0), condor.rotation.y, suelo(condorPos.x, condorPos.z));
    const ventarron = enCielo ? Math.max(0, 1 - Math.abs(condorPos.y - YS) / 14) : 0;
    flamear.act(t, ventarron);
    viento.act(t, V(PEDRO_A.x - 0.5, YS - 0.2, PEDRO_A.z + 1.5), ventarron * 0.9);
    // --- Pedro ---
    if (t < LENTO0 + 0.4) {
      pedro.g.position.copy(PEDRO_A); pedro.g.rotation.y = t < 11.2 ? (t < 8.4 ? 0 : -0.5) : Math.atan2(NATO_B.x - PEDRO_A.x, NATO_B.z - PEDRO_A.z) * (t > 16 ? 1 : 0);
      pedro.poner(t > 8.4 && t < 11.2 ? 'hablar' : t > 18 ? 'saludar' : t > 5.2 ? 'presentar_libro' : 'idle');
    } else {   // colgando de las garras del cóndor
      pedro.g.position.copy(condorPos).add(V(0, -2.6, 0)); pedro.g.rotation.y = condor.rotation.y; pedro.poner(pedro.anim?.nombres?.includes('colgando') ? 'colgando' : 'saludar');
    }
    pedro.act(dt);
    // --- jefe y tropa: entran por el norte, se quedan frente a la tarima y se van corriendo ---
    // fuera de escena se esconden BAJO la plaza, no con visible=false: Spark tarda ~1,5 s en volver a dibujar una nube que reaparece
    if (t < 11.2) jefe.g.position.set(JEFE_A.x, Y0 - 40, JEFE_A.z);
    else {
      if (t < 15.4) { jefe.poner(t > 14.7 ? 'jefe_senalar' : 'caminar'); jefe.g.position.lerpVectors(JEFE_A, JEFE_B, tramo(t, 11.2, 15.4)); jefe.g.position.y = suelo(jefe.g.position.x, jefe.g.position.z) + Math.abs(Math.sin(t * 6)) * 0.08; mira(jefe.g, JEFE_B.x, JEFE_B.z - 1, 1); }
      else if (t < 23.4) { jefe.poner(t > 14.7 && t < 16.2 ? 'jefe_senalar' : 'jefe_pose'); jefe.g.position.copy(JEFE_B); mira(jefe.g, t < 17 ? NATO_B.x : PEDRO_A.x, t < 17 ? NATO_B.z : PEDRO_A.z, 0.1); jefe.g.rotation.z = t > 14.7 && t < 16.7 ? Math.sin(t * 9) * 0.05 : 0; }
      else { jefe.poner('correr'); jefe.g.rotation.z = 0; jefe.g.position.lerpVectors(JEFE_B, FUERA, tramo(t, 23.4, 28.4)); jefe.g.position.y = suelo(jefe.g.position.x, jefe.g.position.z) + Math.abs(Math.sin(t * 9)) * 0.12; mira(jefe.g, FUERA.x, FUERA.z, 0.2); }
      if (t > 28.5) jefe.g.position.y = Y0 - 40;
    }
    jefe.act(dt);
    mineros.forEach((m, i) => {
      const atras = V(JEFE_A.x + (i - 1) * 2.4, Y0, JEFE_A.z + 1.5), ladoJefe = V(JEFE_B.x + (i - 1) * 2.2 + 0.6, Y0, JEFE_B.z + 2.6);
      const a = i * 2.1 + 0.5, ronda = V(NATO_B.x + Math.cos(a) * 1.25, Y0, NATO_B.z + Math.sin(a) * 1.25), fuera = V(FUERA.x + (i - 1) * 2, Y0, FUERA.z - 2);
      if (t < 15.6) { if (!caminar(m, atras, ladoJefe, t, 11.4 + i * 0.2, 15.6)) { m.g.position.copy(atras); m.poner('idle'); } }
      else if (t < 16.8) { if (!caminar(m, ladoJefe, ronda, t, 15.8, 16.8, 'correr')) { m.g.position.copy(ladoJefe); m.g.position.y = suelo(ladoJefe.x, ladoJefe.z); m.poner('idle'); } }
      else if (t < 21.6) { m.g.position.copy(ronda); m.g.position.y = suelo(ronda.x, ronda.z); mira(m.g, NATO_B.x, NATO_B.z, 0.3); m.poner((Math.floor(t * 3 + i) % 2) ? 'golpe' : 'patada'); }
      else if (t < 23.4) { m.g.position.copy(ronda); m.g.position.y = suelo(ronda.x, ronda.z); m.poner(m.anim?.nombres?.includes('secuaz_burla') ? 'secuaz_burla' : 'celebrar'); }
      else { if (!caminar(m, ronda, fuera, t, 23.4 + i * 0.15, 28.6, 'correr')) m.poner('idle'); }
      if (t <= 11.2 || t >= 28.8) m.g.position.y = Y0 - 40;
      m.act(dt);
    });
    // --- público ---
    publico.forEach((p, i) => {
      const obj = t < 11.2 ? V(0, 0, -310) : t < 16.8 ? jefe.g.position : t > 22 && t < 30 ? condorPos : NATO_B;
      mira(p.g, obj.x, obj.z, 0.08);
      p.poner(t > 6.2 && t < 8 && i % 2 ? 'saludar' : 'idle'); p.act(dt);
    });
    // --- efectos ---
    const fp = t < 16.8 ? 0 : t < 21.8 ? Math.min(1, (t - 16.8) * 2) : Math.max(0, 1 - (t - 21.8) * 1.2);
    polvo.act(t, NATO_B, fp);
    estrellas.act(t, V(nato.pos.x, nato.pos.y + (t > 21.8 && t < 30.4 ? 0.75 : 1.95), nato.pos.z), t > 21.4 && t < 31 ? Math.min(1, (t - 21.4) * 3) * (t > 30 ? 31 - t : 1) : 0);
    magia.act(t, lib.position, 0.45 * tramo(t, 32.8, 34.2) * (1 - tramo(t, 38.2, 39)));
    tinte(0.1 * tramo(t, 33.4, 35) + 0.75 * tramo(t, 37.2, 38.9));   // ambiente dorado y fundido cobrizo
    // --- cámara ---
    sacudir = Math.max(0, sacudir - dtReal * 0.8);
    camaraTomas(cam, tomas, t, p => { if (sacudir > 0) { p.x += (Math.random() - 0.5) * sacudir; p.y += (Math.random() - 0.5) * sacudir; } });
    R.seguirSol(V(0, Y0, -302));
    subtitulosEn(SUBS, t);
    G.cineGuion = t;   // para las pruebas
    G.cineDebug = () => { const f = v => [v.x, v.y, v.z].map(n => n.toFixed(1)).join(','); let n = 0; jefe.g.traverse(o => n++); return 'jefe ' + f(jefe.g.position) + ' vis ' + jefe.g.visible + ' hijos ' + n + ' cam ' + f(cam.position) + ' nato ' + f(nato.pos); };
  }, DURA);
  if (!saltada) { UI.fundir(true); await new Promise(r => setTimeout(r, 500)); }
  polvo.quitar(); viento.quitar(); estrellas.quitar(); magia.quitar(); sombra.quitar();
  J.estado = 'normal';
  ctx.limpiarMundo();
  return saltada;
}
