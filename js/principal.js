// Sewell y su Historia en 3D (antes «El Teniente 3D») · Nato y la ciudad de las escaleras — grey-box jugable (Fase 0).
// Flujo: título → (escena de inicio) → tarjeta del nivel → juego → final del nivel → resumen → siguiente nivel.
// Entre el Nivel 3 y el 4: la memoria del 19 de junio de 1945 (sin enemigos, sin puntaje, sin música) y el salto de tiempo.
import { ponerIndiceMallas, ponerPersonajes, precargarMalla, mallaMovil } from './mundo/mallas.js';
import * as THREE from 'three';
import { Render, CALIDADES } from './motor/render.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { Sky } from 'three/addons/objects/Sky.js';
import { Fisica, iniciarRapier } from './motor/fisica.js';
import { CamaraTP } from './motor/camara.js';
import { E, leerEntrada, prepararRaton, leerMando, mandoPulso, tomarPulsos, olvidarPulsos } from './motor/entrada.js';
import { prepararTactil } from './ui/tactil.js';   // M-MOVIL: controles táctiles e interfaz del celular (antes en entrada.js)
import { AUDIO, iniciarAudio, voz, efecto } from './motor/audio.js';
import { musica, musicaJuego, prepararSonido } from './cine/musica.js';   // X-M1 (carril cine)
import { cinematicaInicio } from './cine/inicio.js';   // X-K1 (carril cine)
import { noticiario, memoriaTitulo, anosDespues, finDelJuegoCine, rescatePedro, trenFinalCine } from './cine/finales.js';   // X-K2 (carril cine) · X-K10 trenFinalCine
import { fondoTitulo, salirTitulo } from './cine/titulo.js';   // X-K3 (carril cine)
import { construirNivel, mat } from './mundo/construir.js';
import { ofrendaMemorial } from './mundo/ofrenda.js';   // N3-C14
import { prepararInteriores, construirInterior, destruirInterior } from './mundo/interiores.js';   // N0-INT (carril interiores)
import { entrarVista, salirVista } from './motor/vistaVentanas.js';   // N0-VENTANAS-REALES (carril render): por las ventanas se ve el mundo real
import { irALugar } from './mundo/irLugar.js';
import { paseoPaso, paseoCuadro, paseoCamara, paseoSaltar, paseoPreparar } from './mundo/paseoVagoneta.js';   // N1-FORTUNA-PASEO (carril mina): paseo en vagoneta   // H-IR (herramientas): &ir=<lugar> y &lugares=1
import { defTurismo, filtrarTurismo, iniciarTurismo, cerrarTurismo, prepararMenuTurismo } from './mundo/turismo.js';   // M-TUR (carril turismo): modo Turístico
import { enBarranco, altura, LUZ_PROPIA } from './mundo/terreno.js';
import { NIVELES, MEMORIA } from './datos/niveles.js';
import { TEXTOS2D } from './datos/textos2d.js';
import { Jugador, mallaPersona, registrarPersonajes, personajeSplat, actualizarDiferidos } from './juego/jugador.js';
import { crearEntidades, llamarHercules, crearHercules, crearTren } from './juego/entidades.js';
import { J, P, DIF, nuevaPartida, pasarDeNivel, avisar, caida, perderVida, danar, DIFICULTAD } from './juego/logica.js';
import { UI, lectura } from './ui/hud.js';
import { iniciarMapa, alternarMapa, abrirMapa, cerrarMapa, mapaAbierto } from './ui/mapa.js';   // N0-MAPA: plano con Tab en el modo Historia
import { separar } from './juego/separacion.js';
import { ponerMallasMovil } from 'three/addons/loaders/GLTFLoader.js';   // MOVIL (M-MOVIL-PUB): variantes .movil.glb en la calidad Móvil
import { iniciarCacheMovil } from './motor/cacheMovil.js';   // CACHE-MOVIL: caché persistente, precarga en segundo plano y tope de memoria (solo Móvil)

const $ = id => document.getElementById(id);
const URLP = new URLSearchParams(location.search);
const PASO = 1 / 60;
const espera = s => new Promise(r => setTimeout(r, s * 1000));

// edificios que ya usan las gaussianas de Idol en el juego (el hospital espera su versión v2)
// id del edificio en el grey-box → modelo de Idol (carpeta en assets3d/crudo) y giro a mano (grados) para que la fachada mire a la escalera
const EN_JUEGO = { pulperia: { fuente: 'pulperia', yaw: 0, hundir: 1.0 }, cine: { fuente: 'cine', yaw: 0, hundir: 1.0 },   // hundir: el modelo traía ~1,1 m de gaussianas sueltas bajo su base (flotaba y se veía deshilachado)
  hospital: { fuente: 'hospital_centro', yaw: 0, estirar: true, modulos: 1 }, hospital_ala: { fuente: 'hospital_ala', yaw: 0, estirar: true },   // hospital: un solo modelo (con dos copias había dos casetas de entrada y una costura al medio)
  estacion: { fuente: 'estacion', estirar: true, modulos: 1, yaw: 180 },   // el corredor de pilares mira al andén
  palitroque: { fuente: 'palitroque', estirar: true, traslape: 1.08, relleno: 0.66 },   // relleno: tablas entre casas hasta el alero (66 % del alto)   // casi sin traslape: tres casas de frontón lado a lado (con 1,2 los extremos tapaban el del medio y quedaban manchas en las uniones)
  correos: { fuente: 'correos', estirar: true }, escuela: { fuente: 'escuela', estirar: true }, club: { fuente: 'club', estirar: true },
  taller: { fuente: 'taller', estirar: true, traslape: 1.05, juntas: true }, taller_n4: { fuente: 'taller_n4', estirar: true, modulos: 1, alto: 20 },   // taller_n4: N4-G5 (carril terreno), galpón de una pieza que llena el lote de 50 × 24   // poco traslape y cortafuegos de ladrillo en las uniones
  taller_largo: { fuente: 'taller_largo_v2e', estirar: true, modulos: 1, yaw: 180, alto: 14.6 },   // un solo galpón largo, sin uniones; yaw 180: ventanales y portones hacia la vía
  concentradora: { fuente: 'concentradora', estirar: true },
  hamilton3: { fuente: 'casa_hamilton_v3b', yaw: 0, alto: 14.8, hundir: 0, margenBase: 0, azul: 1.0, estirar: true, modulos: 1 },   // N1-HAMILTON-c (15-11): estirar = el kit toma el largo y ancho del lote (17 × 10, casa agrandada); antes la caja del modelo (13,9 × 8,4); alto 14,8 (antes 14): con el ancho de 10 m el techo sube 0,8 m más y los pisos quedan de 3,87 m como antes (las ventanas de arriba no caen detrás del letrero)   // azul: fuerza (0 a 1) de la corrección de la neblina azul de Idol (mundo/corregirAzul.js); sin la opción vale 1,0; ?azul=0 en la URL la apaga   // Hamilton nueva (GPU, 12-11-2026): sin estirar; la anterior (hamilton, abajo) queda de respaldo
  hamilton: { fuente: 'casa_hamilton', estirar: true, modulos: 1, hundir: -0.7, margenBase: 0 }, camarote1905: { fuente: 'camarote1905_v2', estirar: true, modulos: 1, hundir: 2.0 }, molino: { fuente: 'molino_v2b', estirar: true, modulos: 1, alto: 20, hundir: 1.8 }, panaderia: { fuente: 'panaderia', estirar: true, hundir: 0.6 },
  ['color:' + 0x8e8478]: { fuente: 'casa_piedra_v2', estirar: true, hundir: 0.6, alto: 6.4 },   // N1-INT1905b: casa de UN piso (antes 8,2 = 1·PISO + 5: dos filas de ventanas)   // v2 de la GPU: zócalo de concreto propio   // casas de piedra de Pueblo Hundido (1905)
  // camarotes: por color (los 8 colores de la paleta usan 4 modelos), estirados a la medida de cada bloque
  ['color:' + 0xa8432f]: { fuente: 'camarote_rojo', estirar: true }, ['color:' + 0xe07a2e]: { fuente: 'camarote_naranja', reserva: 'camarote_rojo', estirar: true },
  ['color:' + 0x2f62b8]: { fuente: 'camarote_cobalto', estirar: true }, ['color:' + 0x7fb6d8]: { fuente: 'camarote_celeste', reserva: 'camarote_cobalto', estirar: true },
  ['color:' + 0x5fae66]: { fuente: 'camarote_verde', estirar: true }, ['color:' + 0x4fb3a8]: { fuente: 'camarote_turquesa', reserva: 'camarote_verde', estirar: true },
  ['color:' + 0xd9a23a]: { fuente: 'camarote_ocre', estirar: true }, ['color:' + 0xefe2c0]: { fuente: 'camarote_crema', reserva: 'camarote_ocre', estirar: true },
  camarote_azotea: { fuente: 'camarote_azotea', estirar: true, traslape: 1.05, azotea: 0.95, hundir: 0.8 } };   // hundir 0,8: tapa más la franja de concreto bajo la fachada   // camarote de techo plano caminable (zona «Techos y balcones» del N2)
const G = { escena: 'carga', render: null, fis: null, M: null, pausa: false, foto: false, fps: 0 };
window.JUEGO = G; iniciarMapa(G);   // ganchos para las pruebas (herramientas/piloto3d.js)
setTimeout(() => (G.herrSala = { cruzar: (M, p) => cruzarPuerta(M, p), entrar: (M, id, d, sf) => entrarSala(M, id, d, sf) }));   // R-6 (herramientas/r6_luz.js): entrar a una sala sin caminar
setTimeout(() => (G.pruebasCine = { finalNivel: t => finalNivel(G.M, t), memoria1945, cierreFinal: () => cierreFinal(G.M), introPlaza }));   // X-K2: pruebas de las escenas (herramientas/cine_finales.js)

// ------------------------------------------------------------------ arranque
async function arrancar() {
  try {
    await iniciarRapier();
    let guardada = null; try { guardada = localStorage.getItem('calidad3d'); } catch (e) { /* sin almacenamiento */ }
    if (E.movil && guardada && guardada !== 'movil' && guardada !== 'baja') guardada = null;   // MOVIL: en el celular no se hereda Ultra/Media de una prueba anterior (un iPhone con «media» guardada no arrancaba liviano); ?calidad= sigue mandando
    const calidad = URLP.get('calidad') || (URLP.get('movil') === '1' ? 'movil' : guardada || (E.movil ? 'movil' : 'media'));   // M-MOVIL: perfil Móvil automático en el celular
    G.render = await new Render().iniciar($('lienzo'), calidad);
    { // MOVIL (M-MOVIL-PUB): mallas livianas (.movil.glb) mientras la calidad sea Móvil; la lista la deja publicar_movil.mjs en publicar/
      let lista = null; const pc = G.render.ponerCalidad.bind(G.render);
      const usar = async n => { if (n !== 'movil') return ponerMallasMovil(null); try { lista ||= (await (await fetch('assets3d/movil.json')).json()).glb || []; } catch (e) { lista = []; } ponerMallasMovil(lista);
        iniciarCacheMovil(G, { ocupado: () => CARGAS.pend > 0 || G.escena === 'carga' || !!(G.M && G.M.cruzando) }); };   // CACHE-MOVIL
      G.render.ponerCalidad = n => { pc(n); usar(G.render.calidad); };
      await usar(G.render.calidad);
    }
    if (G.render.gpuIntegrada) setTimeout(() => UI.aviso('Tu equipo usa gráficos integrados: si el juego va lento, baja la calidad en la pausa (Esc).', 6000), 2500);
    $('t-calidad').value = G.render.calidad;
    prepararRaton($('lienzo'), () => G.escena === 'juego' && !G.pausa);
    prepararTactil();
    prepararMenus();
    requestAnimationFrame(bucle);
    if (URLP.has('nivel')) {   // atajo de pruebas: ?nivel=2&dif=facil&invencible=1&fogata=1
      J.dificultad = URLP.get('dif') || 'normal'; J.invencible = URLP.get('invencible') === '1';
      jugar(+URLP.get('nivel'), { sinTarjeta: URLP.has('rapido'), fogata: +(URLP.get('fogata') || 0), turismo: URLP.get('modo') === 'turista' });   // M-TUR: ?modo=turista&nivel=N
    } else mostrarTitulo();
  } catch (e) {
    const gl = !!document.createElement('canvas').getContext('webgl2');
    UI.error(gl ? 'No se pudo iniciar: ' + (e.stack || e)
      : 'Este navegador no tiene gráficos 3D activados (ni WebGPU ni WebGL2). Abre el juego en Chrome o Firefox: http://127.0.0.1:8766/');
    console.error(e);
  }
}

function prepararMenus() {
  $('t-jugar').onclick = () => { iniciarAudio(); J.dificultad = $('t-dif').value; J.invencible = false; if ($('t-calidad').value !== G.render.calidad) G.render.ponerCalidad($('t-calidad').value); try { localStorage.setItem('calidad3d', G.render.calidad); } catch (e) { /* sin almacenamiento */ } if (G.render.avisoUltra) { G.render.avisoUltra = false; setTimeout(() => UI.aviso('Ultra necesita WebGPU: este navegador usa WebGL2, así que se usa Media', 4000), 1500); } jugar(+$('t-nivel').value); };
  $('p-seguir').onclick = () => pausar(false);
  $('p-calidad').onclick = () => { const o = ['ultra', 'media', 'baja', 'movil'], i = (o.indexOf(G.render.calidad) + 1) % o.length;   /* M-MOVIL: + Móvil */ G.render.ponerCalidad(o[i]); $('p-calidad').textContent = 'Calidad: ' + CALIDADES[o[i]].nombre; };
  $('p-mapa').onclick = () => { pausar(false); if (G.M && G.M.tur) dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true })); else abrirMapa(); };   // N0-MAPA
  $('p-foto').onclick = () => { pausar(false); modoFoto(true); };
  $('p-salir').onclick = () => { pausar(false); mostrarTitulo(); };
  $('modal').onclick = () => cerrarApunte();
  addEventListener('pointerdown', () => iniciarAudio(), { once: true });
  prepararSonido();   // X-M1
  prepararMenuTurismo(n => { iniciarAudio(); J.dificultad = 'facil'; J.invencible = false; if ($('t-calidad').value !== G.render.calidad) G.render.ponerCalidad($('t-calidad').value); jugar(n, { turismo: true }); });   // M-TUR: botón «Modo Turístico» y épocas
}
function mostrarTitulo() {
  limpiarMundo(); G.escena = 'titulo'; UI.mostrarHUD(false); UI.quitarTarjeta(); $('titulo').classList.remove('oculto'); $('pausa').classList.add('oculto'); fondoTitulo({ G, crearMundo, NIVELES, limpiarMundo, pantallaCarga });   // X-K6: con pantalla de carga   // X-K3: Sewell 3D de fondo y tema «titulo»
  if (document.pointerLockElement) document.exitPointerLock();
}
function pausar(v) {
  G.pausa = v; $('pausa').classList.toggle('oculto', !v); $('p-calidad').textContent = 'Calidad: ' + CALIDADES[G.render.calidad].nombre;
  if (v && document.pointerLockElement) document.exitPointerLock();
}

// ------------------------------------------------------------------ tarjetas (texto a pantalla completa) que se pasan con acción
async function tarjeta(html, op = {}) {
  G.escena = 'tarjeta'; UI.tarjeta(html + (op.sinPie ? '' : `<div class="pie">${E.esTactil ? 'Toca ✋ para seguir' : 'ENTER para seguir'}</div>`), op.sobria);
  UI.fundir(false);   // X-K8: #fundido va DESPUÉS de #tarjeta en el DOM: un fundido a negro tapaba la tarjeta (pantalla negra con música; «1981» del N4)
  const min = op.min ?? 1.2, t0 = performance.now();
  if (URLP.has('rapido')) { await espera(0.15); UI.quitarTarjeta(); return; }
  await new Promise(r => {
    const f = () => {
      leerEntrada();
      const listo = (performance.now() - t0) / 1000 > min;
      if (listo && (E.b.accion.recien || E.b.saltar.recien || G.saltarTarjeta || (op.auto && (performance.now() - t0) / 1000 > op.auto))) { G.saltarTarjeta = false; r(); } else requestAnimationFrame(f);
    };
    $('tarjeta').onclick = () => { if ((performance.now() - t0) / 1000 > min) G.saltarTarjeta = true; };
    requestAnimationFrame(f);
  });
  UI.quitarTarjeta();
}
const parrafos = lista => (lista || []).map(t => `<p>${t}</p>`).join('');

// ------------------------------------------------------------------ partida
async function jugar(n, op = {}) {
  $('titulo').classList.add('oculto');
  await salirTitulo({ G, limpiarMundo });   // X-K3: espera y limpia el fondo 3D del título
  nuevaPartida(n);
  if (op.turismo) P.invencible = true;   // M-TUR: sin daño
  if (n === 1 && !op.sinTarjeta && !op.turismo) await introPlaza();
  await empezarNivel(n, op);
}
async function introPlaza() {
  // X-K1 (carril cine): cinemática en el motor, en la plaza de Sewell (js/cine/inicio.js); antes eran 3 tarjetas
  await cinematicaInicio({ G, crearMundo, pantallaCarga, limpiarMundo, NIVELES, UI });
}

async function empezarNivel(n, op = {}) {
  limpiarMundo();
  const def = op.turismo ? defTurismo(NIVELES[n]) : NIVELES[n];   // M-TUR: misma época, sin enemigos ni reloj
  P.nivel = n;
  if (!op.sinTarjeta) await tarjeta(`<h1>${def.nombre}</h1><h2>${def.subTur || (def.epoca && typeof def.epoca === 'string' ? def.epoca : (TEXTOS2D.niveles[n].epoca || ''))}</h2>${def.intro ? `<p>${def.intro}</p>` : ''}`);
  await pantallaCarga(def.nombre, def.subTur ? def.subTur : def.epoca && typeof def.epoca === 'string' ? def.epoca : (TEXTOS2D.niveles[n].epoca || ''), () => crearMundo(def, op));
  G.escena = 'juego'; UI.mostrarHUD(true); UI.fundir(false);
  voz('dandole');
}

// ------------------------------------------------------------------ pantalla de carga
// Pedido de Diego (12-11-2026): las casas aparecían de a poco. Ahora el nivel no empieza hasta que todos los modelos de Idol
// (edificios, personajes, Hércules) están cargados, los sombreadores compilados y la ciudad dibujada unas veces detrás de la pantalla.
const CONSEJOS = ['Pulsa C (o 🐕) con la barra llena y Hércules atacará.', 'Espacio dos veces: doble salto.', 'E para entrar a los edificios: Hércules te espera afuera.',
  'Las pepitas de cobre suman puntos.', 'Busca los apuntes del libro: cuentan la historia de Sewell.', 'Esc pausa el juego · F modo foto.'];
// X-K6 (carril cine): los edificios en malla (.glb de TRELLIS, por defecto desde 14-11) y los personajes se cargan sin esperar
// (grupoMalla, cargarMalla) y aparecían de a poco después de la barra. GLTFLoader y TextureLoader pasan por
// THREE.DefaultLoadingManager: se cuentan aquí las cargas pendientes para que la pantalla de carga las espere.
const CARGAS = { pend: 0, total: 0 };
{ const LM = THREE.DefaultLoadingManager, ini = LM.itemStart.bind(LM), fin = LM.itemEnd.bind(LM);
  LM.itemStart = u => { CARGAS.pend++; CARGAS.total++; ini(u); };
  LM.itemEnd = u => { CARGAS.pend = Math.max(0, CARGAS.pend - 1); fin(u); }; }
async function pantallaCarga(titulo, sub, construir, sobria) {
  const total0 = CARGAS.total - CARGAS.pend;
  const c = $('carga'), barra = (f, t) => { $('carga-relleno').style.width = Math.round(f * 100) + '%'; if (t != null) $('carga-texto').textContent = t; };
  c.classList.toggle('sobrio', !!sobria);
  $('carga-titulo').textContent = titulo || ''; $('carga-sub').textContent = sub || '';
  $('carga-consejo').textContent = sobria ? '' : CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)];
  barra(0, 'Construyendo la ciudad…'); c.classList.remove('oculto'); UI.fundir(false);
  G.escena = 'carga'; G.cargando = { progreso: 0, listo: false };
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // que la pantalla se vea antes del trabajo pesado
  const M = await construir();
  G.escena = 'carga';
  barra(0.08, 'Cargando edificios y personajes…');
  const lista = []; G.render.escena.traverse(o => { if (o instanceof SplatMesh && !(o.userData && o.userData.diferido)) lista.push(o); });   // R-2: los diferidos cargan al acercarse, no se espera por ellos
  const total = lista.length, t0 = performance.now(); let hechos = 0;
  await Promise.race([
    Promise.all(lista.map(o => Promise.resolve(o.initialized).catch(() => null).then(() => {
      hechos++; G.cargando.progreso = hechos / total;
      barra(0.08 + 0.52 * hechos / total, `Cargando edificios y personajes: ${hechos} de ${total}`);
    }))),
    new Promise(r => setTimeout(r, 120000)),   // por si un modelo no llega: no dejar al jugador esperando para siempre
  ]);
  G.cargando.modelos = { hechos, total, seg: +((performance.now() - t0) / 1000).toFixed(1) };
  { // X-K6: mallas y texturas (ver CARGAS): hasta que no quede ninguna pendiente durante 0,4 s (tope 120 s)
    const tM = performance.now(); let quieto = performance.now();
    while (performance.now() - tM < 120000) {
      await new Promise(r => requestAnimationFrame(r));
      const n = CARGAS.total - total0, hechas = n - CARGAS.pend;
      if (CARGAS.pend > 0) quieto = performance.now();
      if (n) barra(0.6 + 0.28 * hechas / n, `Cargando mallas y texturas: ${hechas} de ${n}`);
      if (CARGAS.pend === 0 && performance.now() - quieto > 400) break;
    }
    G.cargando.mallas = { total: CARGAS.total - total0, pendientes: CARGAS.pend, seg: +((performance.now() - tM) / 1000).toFixed(1) };
  }
  barra(0.9, 'Preparando luces y sombras…');
  try { if (G.M) paseoPreparar(G.M); } catch (e) { console.warn('paseo vagoneta', e); }   // TIRONES-MOVIL: el paseo de la mina se arma en la carga
  try { await G.render.renderer.compileAsync(G.render.escena, G.render.camara); } catch (e) { /* sin compileAsync */ }
  // dibujar detrás de la pantalla hasta que Spark termine de afinar el detalle de lo que ve la cámara de inicio:
  // todos los modelos registrados en el LoD, sin trabajo pendiente y el reparto de detalle quieto 1,5 s (antes los edificios
  // seguían definiéndose ~3 s después de la barra; pedido de Diego, 12-11-2026). Tope de 25 s.
  barra(0.92, 'Afinando el detalle del paisaje…');   // N0-FABLE-1611 (B12): en el N1 (1905) aún no hay ciudad
  const S = G.spark, tA = performance.now(); let ver = -1, tVer = performance.now(), vueltas = 0;
  for (let i = 0; i < 40 || performance.now() - tA < 25000; i++) {
    await new Promise(r => requestAnimationFrame(r));
    if (!S || i < 40 || !total) { barra(0.92 + 0.03 * Math.min(1, i / 40)); if (i >= 40) break; continue; }   // X-K6: sin gaussianas (todo en malla) no hay LoD que afinar: antes esperaba siempre el tope de 25 s
    const mv = S.latestMappingVersion ?? 0;
    if (mv !== ver) { ver = mv; tVer = performance.now(); vueltas++; }
    const registrados = !S.lodMeshes || !S.lodInstances || S.lodInstances.size >= S.lodMeshes.length;
    const listo = registrados && !S.lodDirty && (S.lodInitQueue?.length ?? 0) === 0 && vueltas >= 2 && performance.now() - tVer > 1500;
    barra(0.95 + 0.05 * Math.min(1, (performance.now() - tA) / 6000));
    if (listo) break;
  }
  G.cargando.afinado = +((performance.now() - tA) / 1000).toFixed(1);
  barra(1, '¡Listo!'); G.cargando.listo = true;
  await new Promise(r => setTimeout(r, 200));
  c.classList.add('oculto');
  return M;
}

function limpiarMundo() {
  cerrarMapa();   // N0-MAPA
  const M = G.M;
  if (!M) return;
  G.render.escena.remove(...G.render.escena.children.filter(o => o !== G.render.sol && o !== G.render.sol.target && o !== G.render.cielo && o !== G.spark));
  G.render.aparte.remove(...G.render.aparte.children.filter(o => o !== G.sparkAparte));   // N1-C45: Hércules si se salió del nivel en el capacho
  M.fis.liberar(); G.M = null; UI.burbuja(null); UI.cerrarModal(); cerrarTurismo();   // M-TUR
}

// el «mundo» M: todo lo que comparten jugador, entidades y finales
async function crearMundo(def, op = {}) {
  const R = G.render, esc = R.escena;
  const fis = new Fisica();
  const M = G.M = {
    def, fis, escena: esc, t: 0, calidad: G.render.calidad, salaActual: null, final: null, dobleSalto: URLP.get('doble') !== '0', lento: !!op.lento,
    zonasViento: [], zonasHielo: [], zonaVista: -1, burbujaDe: null, sacudida: 0, paradaT: 0,
    grupoDe: e => (e.sala && M.R.salas[e.sala] ? M.R.salas[e.sala].grupo : esc),
    // N1-C45: gaussianas que viajan en el capacho (Hércules) van a la escena «aparte», con su propio SparkRenderer sin LoD: el de la
    // ciudad cambia de mapeo cada vez que algo aparece o se rehace el LoD y mientras ordena dibuja las posiciones viejas (se atrasaba 2 m)
    aparte: (o, si) => {
      const A = R.aparte;
      if (si) {
        if (!G.sparkAparte) G.sparkAparte = new SparkRenderer({ renderer: R.renderer, enableLod: false, blurAmount: URLP.has('blur') ? +URLP.get('blur') : 0 });
        if (!A.children.includes(G.sparkAparte)) A.add(G.sparkAparte);
        A.fog = esc.fog; if (o.parent !== A) A.attach(o);
      } else if (o.parent === A) esc.attach(o);
    },
    cerca: (p, r) => p.distanceTo(new THREE.Vector3(M.jug.pos.x, M.jug.pos.y, M.jug.pos.z)) < r,
    mismaSala: e => (e.sala || null) === M.salaActual,
    efecto, voz, rotulo: t => UI.aviso(t, 1400), aviso: (t, ms) => UI.aviso(t, ms), avisos: t => UI.aviso(t),
    estrellitas: p => particulas(M, p, 0xffe066, 6), plumas: p => particulas(M, p, 0x1d1b22, 8), explosion: p => { particulas(M, p, 0xff9a2a, 14); efecto('explosion'); M.sacudir(0.3); },
    tizne: () => {}, parada: s => (M.paradaT = Math.max(M.paradaT, s)), sacudir: s => (M.sacudida = Math.max(M.sacudida, s)),
    // alerta: nunca dentro de una sala (mina, cine...)
    alerta: (p, alto, e) => { if (M.salaActual || (e && e.sala)) return; particulas(M, new THREE.Vector3(p.x, p.y + alto + 0.6, p.z), 0xff3030, 3, e && e.sala && M.R.salas[e.sala] ? M.R.salas[e.sala].grupo : M.R.exterior); },   // los rombos rojos flotaban dentro de las salas: solo en la sala del minero, o en el exterior
    leerApunte: i => { UI.modal(`Apunte ${i + 1} de 5 · del libro`, (def.apuntes || [])[i] || ''); G.modalAbierto = performance.now(); },
    burbujaCerca: (e, p, r, html) => {
      const d = Math.hypot(p.x - M.jug.pos.x, p.z - M.jug.pos.z);
      // DEFECTOS-1611: la burbuja se leía a través de muros y pisos (anciana del camarote, profesor de la escuela): además de la
      // distancia, línea de vista de pecho a pecho sin muro, piso ni techo de por medio (cuando ya está abierta, se revisa cada 10 cuadros)
      const veo = () => { const o = { x: M.jug.pos.x, y: M.jug.pie + 1.4, z: M.jug.pos.z }, dx = p.x - o.x, dy = p.y + 1.4 - o.y, dz = p.z - o.z, L = Math.hypot(dx, dy, dz);
        if (L < 0.6) return true; const h = M.fis.rayo(o, { x: dx / L, y: dy / L, z: dz / L }, L - 0.4, M.jug.p && M.jug.p.col); const t = h && M.fis.etiquetas.get(h.col.handle);
        return !(t && BURBUJA_TAPA.includes(t.tipo)); };
      if (d < r && Math.abs(p.y - M.jug.pie) < 4 && (M.burbujaDe === e && (M.cuadroBurbuja = (M.cuadroBurbuja || 0) + 1) % 10 ? true : veo())) { if (M.burbujaDe !== e) { M.burbujaDe = e; UI.burbuja(html); } return true; }
      if (M.burbujaDe === e) { M.burbujaDe = null; UI.burbuja(null); }
      return false;
    },
    puntoControl: p => { M.control = p; },
    enHielo: p => M.zonasHielo.some(z => p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1),
    enAgua: p => { const s = M.R.salas[M.salaActual]; if (!s) return null; return s.agua.find(a => p.x > a.x0 && p.x < a.x1 && p.z > a.z0 && p.z < a.z1 && p.y < a.y + 1.2) || null; },
    viento: p => {
      for (const z of M.zonasViento) if (p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1) {
        const r = Math.max(0, Math.sin(M.t / 1.4)) ** 2, f = z.f * (0.25 + 0.75 * r);
        return { x: z.dir[0] * f, z: z.dir[1] * f };
      }
      return null;
    },
    peligro: p => enBarranco(p.x, p.z),
    enCapacho: () => {   // por posición: el contacto con un cuerpo en movimiento a veces no se reporta
      const j = M.jug;
      return M.L.de('capacho').some(c => Math.abs(j.pos.x - c.malla.position.x) < 1.8 && Math.abs(j.pos.z - c.malla.position.z) < 1.8 && Math.abs(j.pie - c.malla.position.y) < 1.2);
    },
    puedeAtacarCondor: () => !M.final && M.L.de('condor').filter(c => c.estado !== 'vuela').length === 0,
    atrapar: c => { M.jug.estado = 'atrapado'; M.atrapador = c; },
    llevarJugador: pos => { M.jug.p.teletransportar(pos.x, pos.y - 1.6, pos.z); },
    soltarJugador: () => { if (M.jug.estado === 'atrapado') { M.jug.estado = 'normal'; M.jug.invul = 1.2; M.jug.vel.set(0, 2, 0); } M.atrapador = null; },
    olla: () => {   // el cóndor lo lanza a la olla de cobre: sale con los pantalones humeando y pierde una vida (chiste de caricatura)
      M.atrapador = null; M.jug.estado = 'normal';
      if (!P.invencible) { UI.aviso('¡AY, AY, AY! ¡A la olla de cobre!', 2200); voz('pucha'); }   // N1-O3: con invencible, sin el «¡AY!»
      if (!P.invencible) perderVida(M.jug, 'olla'); else { M.jug.invul = 1; volverASeguro(M); }
    },
    peleaJefe: v => { M.pelea = v; },
    empezarFinal: tipo => finalNivel(M, tipo),
    rendicionJefe: e => finalNivel(M, 'jefe', e),
    condorDerrotado: c => rescate(M, c),
    trenParte: () => { UI.aviso('¡El último tren parte!', 2500); M.trenEnMarcha = true; for (let i = 0; i < 2; i++) M.condoresTren(); },
    volverAlCarro: e => {
      const x = e.x + (e.carros && e.carros.length ? e.carros[e.carros.length - 1] : -15 - 9.4 * 2);   // N1-C57: el último carro según crearTren
      M.jug.teletransportar(x, 3.2, 22); M.jug.invul = 1.5;
      if (!P.invencible) { P.corazones--; if (P.corazones <= 0) perderVida(M.jug, 'tren'); }
      UI.aviso('¡De vuelta al último carro!');
    },
    finTren: () => cierreFinal(M),
  };
  // gaussianas de Idol ya listas (Fase 1): se dibujan con Spark en lugar de las cajas del grey-box
  // LoD de Spark: un presupuesto fijo de gaussianas para toda la ciudad, repartido según la distancia (más en Ultra, menos en el celular)
  // R-1 (14-11): sin foveación el presupuesto se reparte en 360°; se sube para que lo de enfrente quede igual de fino (medido en la RX 9070 XT)
  const escalaLod = +(URLP.get('lod') || 0) || ({ ultra: 3.5, media: 2.5, baja: 1.0, movil: 0.7 }[R.calidad] || 2.5);   // M-MOVIL: LoD más agresivo en Móvil   // ?lod=N para probar
  const opcionesSpark = { renderer: R.renderer, enableLod: URLP.get('lod') !== 'no', lodSplatScale: escalaLod };
  // sin el desenfoque de antialiasing por defecto de Spark (0,3): las gaussianas de Idol quedan mucho más nítidas
  opcionesSpark.blurAmount = URLP.has('blur') ? +URLP.get('blur') : 0;
  // opciones de LoD solo para medir: ?lodCount=N (gaussianas objetivo), ?lodRender=N (tamaño mínimo en píxeles), ?cone=1 (sin foveación: coneFoveate y behindFoveate en 1)
  if (URLP.has('lodCount')) opcionesSpark.lodSplatCount = +URLP.get('lodCount');
  if (URLP.has('lodRender')) opcionesSpark.lodRenderScale = +URLP.get('lodRender');
  // R-1 (Diego: «al girar la cámara los edificios se ponen borrosos»): con foveación (Spark: 0,4 fuera del cono, 0,2 detrás) lo que quedaba al costado
  // o detrás tenía gaussianas 2,5-5 veces más gruesas; al girar entraba así a la pantalla y el LoD tardaba 1-2 s en afinarse (se rehacía cada ~28° de giro
  // y el recorrido del árbol toma ~1 s). Sin foveación el detalle no depende de hacia dónde se mira: girar no cambia nada (ni rehace el LoD, ni da tirones).
  // ?cone=0.4 vuelve a la foveación para comparar.
  { const f = URLP.has('cone') ? +URLP.get('cone') : 1; opcionesSpark.coneFoveate = f; opcionesSpark.behindFoveate = URLP.has('cone') ? Math.min(f, 0.2 / 0.4 * f) : 1; }
  if (!G.spark) { G.spark = new SparkRenderer(opcionesSpark); 
    // LoD menos nervioso: por defecto Spark rehacía el LoD con 1 mm de movimiento y en cada cuadro (parche en lib/spark), cada rehecho cambia el mapeo y
    // mientras ordena no se actualizan las gaussianas animadas: Nato y los demás se movían a 7-10 Hz aunque el juego fuera a 60. Ahora: cada 6 m / ~3° y
    // como mucho cada 1,5 s; con la cámara quieta ~250 ms se afina igual. ?lodMs=0&lodDist=0.001&lodRot=0.00001 restaura el comportamiento original.
    G.spark.lodMoveDist = URLP.has('lodDist') ? +URLP.get('lodDist') : 6; G.spark.lodMoveRot = URLP.has('lodRot') ? +URLP.get('lodRot') : G.spark.coneFoveate < 1 ? 0.03 : 2; G.spark.lodSettleRot = G.spark.coneFoveate < 1 ? 1e-4 : 2; G.spark.lodMinMs = URLP.has('lodMs') ? +URLP.get('lodMs') : 1500; }   // R-1: sin foveación girar no rehace el LoD
  if (!esc.children.includes(G.spark)) esc.add(G.spark);
  if (G.splats === undefined) {
    try { G.splats = await (await fetch('assets3d/splats.json')).json(); } catch (e) { G.splats = {}; }
    // en el celular (o en calidad Baja) se usan los modelos livianos: 150 mil gaussianas, unos 10 MB cada uno
    if (E.movil || ((R.calidad === 'baja' || R.calidad === 'movil') && !URLP.has('completo')))   /* M-MOVIL: E.movil respeta ?movil=0 */   // ?completo=1: modelos completos también en baja (solo para medir)
      for (const v of Object.values(G.splats)) if (v.urlMovil) v.url = v.urlMovil;
    // personajes animados (14-11, medido en el Chrome de Diego): Spark recalcula y reordena sus gaussianas en CADA cuadro;
    // 10 personajes sumaban 6,5 millones y 1 de cada 4 cuadros pasaba de 25 ms (tirones al caminar). Hércules, mineros y
    // vecinos usan siempre el modelo liviano (150 mil); Nato queda completo porque siempre está en primer plano
    if (!URLP.has('completo')) for (const id of ['hercules', 'p_minero', 'p_diego', 'p_vecina', 'p_anciana', 'p_pedro']) { const v = G.splats[id]; if (v && v.urlMovil) v.url = v.urlMovil; }
  }
  let usar = URLP.get('splats') === '0' ? {} : Object.fromEntries(Object.entries(EN_JUEGO).map(([id, a]) => [id, a, G.splats[a.fuente] ? a.fuente : a.reserva]).filter(([, , f]) => f && G.splats[f]).map(([id, a, f]) => [id, { ...G.splats[f], yaw: a.yaw || 0, estirar: !!a.estirar, traslape: a.traslape, modulos: a.modulos, juntas: !!a.juntas, relleno: a.relleno, azotea: a.azotea, hundir: a.hundir, alto: a.alto ?? G.splats[f].alto }]));
  // ?malla=1: piezas con malla de TRELLIS.2 (assets3d/trellis/indice.json, lo escribe /mnt/gen5/trellis2/lote.py) en vez de gaussianas
  { let ind = null; try { ind = await (await fetch('assets3d/trellis/indice.json', { cache: 'no-store' })).json(); } catch (e) {}
    ponerIndiceMallas(URLP.get('malla') !== '0' ? ind : null,   /* 14-11-2026 Diego: mallas por omisión (?malla=0 solo para depurar) */ URLP.has('gaussianas') ? null : ind);   // el 2.º: piezas que viajan (capacho) van con malla siempre
    if (!URLP.has('gaussianas')) ponerPersonajes(ind && ind._personajes);   // Hércules malla cuando la cadena lo deja listo
    if (URLP.has('qcpers')) ponerPersonajes(ind && ind._personajes_qc);   // G-PERS: mallas de personajes en control de calidad (aún no entran al juego)
    // R-2 (Diego, 14-11: «saca ya las gaussianas, ocupan mucha GPU»): ningún edificio ni objeto del escenario se dibuja con gaussianas.
    // Lo que no tiene malla aprobada (las _excluidas de indice.json: camarotes turquesa/cobalto/ocre/verde/azotea y escuela) sale de «usar»
    // y construir.js lo levanta con el edificio geométrico del juego (bloques, fachada, ventanas y techo, con su color). Cuando una malla
    // nueva entra al índice sigue sola: «usar» vuelve a incluirlo. ?gaussianas=1 deja todo como estaba (solo para comparar).
    if (ind && URLP.get('malla') !== '0' && !URLP.has('gaussianas')) usar = Object.fromEntries(Object.entries(usar).filter(([, sp]) => !!ind[String(sp.url).split('/').pop().replace(/\.ply$/, '')])); }
  await vaciarLod(G.spark);   // N2-C24: árboles del nivel anterior fuera del worker de LoD antes de crear los nuevos (si no, se suman)
  M.R = construirNivel({ ...def, splats: usar, splatsTodos: URLP.get('splats') === '0' ? {} : G.splats }, fis, esc);
  fis.indexar();   // antes de buscar el suelo de Nato, pepitas, cóndores y nidos
  // cielo y luz de la época
  esc.background = new THREE.Color(def.noche ? 0x0b1020 : def.tormenta ? 0x9aa6b8 : 0x8ec5ff);
  esc.fog = new THREE.Fog(def.niebla || 0xcfd8e3, def.tormenta ? 60 : 220, def.tormenta ? 320 : def.brumaLejos ?? 3200);   // brumaLejos: cordillera más nítida (N1)
  // cielo con atmósfera (de día): el sol del cielo coincide con la luz
  if (!def.noche && !def.tormenta) {
    const cielo = new Sky(); cielo.scale.setScalar(20000); cielo.name = 'cielo';
    const u = cielo.material.uniforms; u.turbidity.value = 3; u.rayleigh.value = 1.2; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.85;
    const d = new THREE.Vector3(-0.55, def.sol?.alto ?? 0.7, 0.45).normalize(); u.sunPosition.value.copy(d);
    // R-4: el Sky de three fija gl_Position.z = w («al fondo»); con la profundidad invertida de R-3 eso es el plano CERCANO y el cielo
    // tapaba todo lo dibujado antes que él (terreno y edificios: «desapareció el mundo»). Con profundidad invertida el fondo es z = 0.
    if (R.revZ) { cielo.material.vertexShader = cielo.material.vertexShader.replace('gl_Position.z = gl_Position.w;', 'gl_Position.z = 0.0;'); cielo.material.needsUpdate = true; }
    cielo.renderOrder = -10;   // siempre primero: no depende del orden de creación de los materiales
    cielo.material.fog = false; esc.add(cielo); esc.background = null;
  }
  R.sol.color.set(def.sol?.tono ?? 0xfff1dc); R.sol.intensity = def.noche ? 0.25 : def.tormenta ? 1.4 : 3.2;
  R.dirSol.set(-0.55, def.sol?.alto ?? 0.7, 0.45).normalize();
  R.cielo.intensity = def.noche ? 0.25 : 1.1;
  LUZ_PROPIA.value = def.noche ? 0.12 : 1;   // N3-C12: de noche el suelo y los muros no brillan solos
  // Nato
  const ini = op.inicio || def.inicio;
  const yIni = ini.y ?? fis.suelo(ini.x, ini.z);
  M.jug = new Jugador(fis, esc, ini.x, yIni + 0.1, ini.z);
  M.jug.rumbo = (ini.rumbo || 0) + Math.PI; M.jug.seguro = { x: ini.x, y: yIni, z: ini.z };
  M.control = { x: ini.x, y: yIni, z: ini.z, sala: null };
  if (URLP.get('splats') !== '0') registrarPersonajes(Object.fromEntries(Object.entries(G.splats).filter(([k]) => k.startsWith('p_'))));
  M.splatsTodos = URLP.get('splats') === '0' ? {} : G.splats;   // piezas sueltas de Idol (capacho, torre y andén del andarivel)
  M.splatTren = URLP.get('splats') === '0' ? {} : { loco: G.splats.locomotora, carro: G.splats.carro_plano, yawLoco: +(URLP.get('yawLoco') ?? 0) * Math.PI / 180, yawCarro: +(URLP.get('yawCarro') ?? 0) * Math.PI / 180 };
  for (const k of ['loco', 'carro']) precargarMalla(mallaMovil(M.splatTren[k]));   // N1-R2: el tren del final ya llega con sus carros (antes 1-3 s sin malla)
  M.splatNido = URLP.get('splats') === '0' ? null : G.splats.nido_condor || null;   // nido del cóndor (N4) de Idol en vez del anillo de bloques
  if (G.splats.hercules && URLP.get('splats') !== '0') { M.splatPerro = G.splats.hercules; M.yawPerro = +(URLP.get('yawPerro') ?? 180) * Math.PI / 180; }   // el modelo mira hacia atrás: media vuelta
  if (G.splats.nato && URLP.get('splats') !== '0') M.jug.ponerSplat(G.splats.nato, +(URLP.get('yawNato') ?? -90) * Math.PI / 180);   // el modelo de Idol mira a -X: -90° para que mire hacia donde avanza
  M.cam = new CamaraTP(R.camara, fis); M.cam.yaw = ini.rumbo || 0;   // rumbo 0 = mirando ladera arriba (-Z)
  if (def.turismo) filtrarTurismo(M.R);   // M-TUR: sin enemigos, pepitas, bolas ni peligros
  M.L = crearEntidades(M, M.R);
  if (!op.lento) crearHercules(M, M.L);   // Hércules acompaña a Nato (en la memoria de 1945 no)
  if (def.turismo) iniciarTurismo(M);   // M-TUR: carteles, guías, plano y pasaporte
  if ([2, 3, 4].includes(def.numero) && !op.lento) import('./mundo/ciudadViva.js').then(m => m.ciudadViva(M, def)).catch(e => console.warn('ciudad viva', e));   // N0-CIUDAD-VIVA (carril animador): gente de época, ambiente
  M.condoresTren = () => { const c = M.L.lista.find(e => e.tipo === 'tren'); if (!c) return; import('./juego/entidades.js'); trenCondor(M, c); };
  // salir desde una fogata (truco de pruebas)
  if (op.fogata) {
    const f = M.L.de('fogata')[op.fogata - 1];
    if (f) { if (f.sala) entrarSala(M, f.sala, { x: f.x, y: f.y, z: f.z }, true); else M.jug.teletransportar(f.x + 1.5, f.malla.position.y + 0.1, f.z); }
  }
  if (URLP.has('ir') || URLP.has('lugares')) irALugar(M, def, URLP.get('ir'), { lista: URLP.has('lugares') });   // H-IR: Nato frente al lugar (revisión)
  if (def.reloj) M.reloj = def.reloj.desde * 60;   // segundos de reloj del juego
  // nieve que cae (invierno, tormenta y la memoria de 1945): copos alrededor de la cámara, con viento
  if (def.invierno || def.tormenta || def.noche) {
    const n = def.tormenta ? 6000 : 3000, p = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) p[i] = (Math.random() - 0.5) * 80;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    // copo redondo y difuminado (sin textura, los puntos se veían como cuadrados blancos)
    const lz = document.createElement('canvas'); lz.width = lz.height = 32; const cx = lz.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
    const copos = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, map: new THREE.CanvasTexture(lz), size: def.tormenta ? 0.14 : 0.1, transparent: true, opacity: 0.9, depthWrite: false, fog: true }));
    copos.frustumCulled = false; esc.add(copos);
    M.nieve = { copos, p, n, viento: def.tormenta ? 6 : 1.2 };
  }
  M.cam.cortar();
  return M;
}

function particulas(M, p, color, n, padre) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.12), mat(color, { emisivo: color, brillo: 0.6 }));
    m.position.copy(p).add(new THREE.Vector3(0, 1.4, 0)); (padre || M.escena).add(m);
    const v = new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5);
    M.L.agregar({ tipo: 'particula', vivo: true, t: 0, act(dt) { this.t += dt; v.y -= 12 * dt; m.position.addScaledVector(v, dt); m.rotation.x += dt * 8; if (this.t > 0.8) { m.removeFromParent(); this.vivo = false; } } });
  }
}

const BURBUJA_TAPA = ['muro', 'piso', 'techo', 'azotea', 'losa', 'tapon', 'plaza', 'tierra', 'roca'];   // DEFECTOS-1611: lo que tapa la burbuja de un vecino
// ------------------------------------------------------------------ puertas: fundido a negro y escena aparte
async function afinarLod(maxMs) {
  const S = G.spark; if (!S) return;
  const t0 = performance.now(); let ver = S.latestMappingVersion ?? 0, tVer = t0, cambios = 0;
  while (performance.now() - t0 < maxMs) {
    await new Promise(r => requestAnimationFrame(r));
    const mv = S.latestMappingVersion ?? 0;
    if (mv !== ver) { ver = mv; tVer = performance.now(); cambios++; }
    if (cambios >= 1 && !S.lodDirty && (S.lodInitQueue?.length ?? 0) === 0 && performance.now() - tVer > 600) break;
  }
}
// N0-FABLE-1611 (A4): compileAsync(escena) recorre TODO (también la ciudad oculta y las otras salas) y, como las luces de la sala cambian
// la cuenta de luces, recompilaba los shaders de toda la ciudad: 1,2-1,4 s a negro al entrar (3,6 s la mina Fortuna) en la iGPU.
// Se compila solo lo que se ve dentro: se sacan un momento de la escena las otras salas (ocultas: sus luces no cuentan) y la ciudad
// si no tiene luces propias (verExterior deja encendidas las luces; si tuviera, se compila todo como antes). La parte síncrona de
// compileAsync (crear los programas) ocurre en la llamada; se devuelve todo a su lugar antes de esperar.
function compilarSala(M) {
  const R = G.render, s = M.R.salas[M.salaActual], fuera = [];
  R.presupuestoLuces(true);   // TIRONES-MOVIL: la cuenta de luces de adentro, antes de compilar (si no, cambia al cuadro siguiente y recompila todo)
  for (const o of Object.values(M.R.salas)) if (o !== s && o.grupo && o.grupo.parent) fuera.push(o.grupo);
  if (M.R.exterior.parent) fuera.push(M.R.exterior);   // TIRONES-MOVIL: sus luces ya no cuentan dentro (presupuestoLuces): la ciudad nunca se compila con la luz de la sala
  const sacados = fuera.map(o => { const p = o.parent, i = p.children.indexOf(o); p.children.splice(i, 1); return [o, p, i]; });
  try { s.grupo.traverse(o => { if (o.userData.luzMina) o.userData.luzMina(R.escena); }); } catch (e) { /* TIRONES-MOVIL: luz horneada de la mina antes de compilar */ }
  let pr;
  try { pr = R.renderer.compileAsync(R.escena, R.camara); }
  finally { for (let k = sacados.length - 1; k >= 0; k--) { const [o, p, i] = sacados[k]; p.children.splice(i, 0, o); } }
  return pr;
}
async function cruzarPuerta(M, puerta) {
  if (M.cruzando) return; M.cruzando = true; efecto('puerta');
  M.jug.invul = Math.max(M.jug.invul || 0, 2.5);   // N0-FABLE-1611 (A4): a oscuras nadie le hace daño
  UI.fundir(true); await espera(0.45);
  if (!M.salaActual) {   // de afuera hacia una sala
    if (M.preArmada && M.preArmada !== puerta.sala) destruirInterior(M, M.preArmada);   // CACHE-MOVIL: el interior armado de antemano era de otra puerta
    const preArmada = M.preArmada === puerta.sala; M.preArmada = null;
    if (puerta.gen && (preArmada || !M.R.salas[puerta.sala])) { if (!preArmada) M.R.salas[puerta.sala] = construirInterior(M, puerta); M.distAfuera = M.cam.dist; M.cam.dist = 2.3; M.cam.minDist = 0.7; M.cam.interior = true; M.cam.primera = false; M.cam.pitch = 0.12; setTimeout(() => UI.aviso('V: primera persona · rueda: acercar la cámara', 3200), 900); }   // N0-INT: el interior se arma al entrar; cámara más cerca (pasillos y piezas chicas)
    const s = M.R.salas[puerta.sala];
    const destino = puerta.lado === 'salida' && s.salida ? s.salida : s.entrada;
    try { entrarVista(M, puerta, s, destino, G.render); } catch (e) { console.warn('vistaVentanas', e); }   // N0-VENTANAS-REALES: cubemap del mundo real con el exterior aún visible (pantalla en negro)
    entrarSala(M, puerta.sala, destino);
  } else {               // de la sala hacia afuera
    const lado = puerta.lado;
    const fuera = M.R.puertas.find(p => p.sala === M.salaActual && p.lado === lado) || M.R.puertas.find(p => p.sala === M.salaActual);
    salirSala(M, fuera);
  }
  M.cam.cortar(); M.tPuerta = 1.2;
  // DEFECTOS-1611: pantalla negra de 1,6-2,5 s al entrar al palitroque y a la sala Fortuna: el primer cuadro de la sala compilaba sus
  // shaders DESPUÉS del fundido (cuadro de 0,7-1 s con el fundido aún opaco). Se compilan a oscuras y se dibuja un cuadro antes de aclarar.
  if (M.salaActual) { try { await compilarSala(M); } catch (e) { /* sin compileAsync */ } await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
  // N0-FABLE-1611 (A4): antes afinarLod(3000) dejaba 3-6 s a negro en la iGPU en cada puerta; tope de 0,45 s (el detalle de Spark termina de afinar ya con luz)
  // NEGRO-SALIDA (16-11): al SALIR de una sala la cuenta de luces vuelve a la del exterior y el primer cuadro afuera recompilaba los shaders
  // de la ciudad DESPUÉS de aclarar (cuadro de ~1,2 s con el fundido aún opaco: «pantalla negra 1,7 s» del auditor del N1 al salir de
  // Fortuna, en (−186,6, −194,9)). Se compilan a oscuras y se dibujan dos cuadros, como al entrar.
  if (!M.salaActual) { G.render.presupuestoLuces(true); try { await G.render.renderer.compileAsync(G.render.escena, G.render.camara); } catch (e) { /* sin compileAsync */ } await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
  if (!M.salaActual) await afinarLod(450);   // al salir, la cámara salta lejos: se espera, a oscuras, a que Spark afine el detalle (si no, casas y tren salen como manchas oscuras)
  await espera(0.1); UI.fundir(false); M.cruzando = false; M.jug.invul = Math.min(M.jug.invul, 0.4);   // sin parpadeo largo de Nato al aclarar
}
// CACHE-MOVIL (16-11-2026): en el celular el interior genérico se arma de antemano (oculto) cuando Nato está a menos de 9 m de su puerta
// y el cuadro va holgado: al entrar ya no se arma a oscuras (int_3 del N1: 3,2 s → ver capturas/movil/cache). Uno solo a la vez (todos se
// arman en el mismo ORIGEN); si Nato se aleja más de 25 m se desarma. Al entrar por otra puerta, cruzarPuerta lo desarma primero.
function preArmarInterior(M) {
  const j = M.jug, ahora = performance.now(), R = G.render;
  if (M.preTex && M.preTex.length && (G.fps || 60) >= 28) { const t = M.preTex.pop(); try { R.renderer.initTexture(t); } catch (e) { /* WebGPU u otra */ } }   // de a una textura por cuadro
  if (ahora - (M.tPreArmar || 0) < 500) return; M.tPreArmar = ahora;
  const dist = p => Math.hypot(j.pos.x - p.x, j.pos.z - p.z);
  if (M.preArmada) {
    const p = M.R.puertas.find(q => q.sala === M.preArmada && q.lado !== 'salida');
    if (!p || dist(p) > 25) { destruirInterior(M, M.preArmada); M.preArmada = null; M.preTex = null; }
    return;
  }
  if ((G.fps || 60) < 28) return;
  let mejor = null, dm = 14;   // TIRONES-MOVIL: 14 m (antes 9): más tiempo para que el precalentador deje la sala lista
  for (const p of M.R.puertas) if (p.gen && !p.cerrada && p.lado !== 'salida' && !M.R.salas[p.sala] && Math.abs(j.pie - p.y) < 3) { const d = dist(p); if (d < dm) { dm = d; mejor = p; } }
  if (!mejor) return;
  const s = construirInterior(M, mejor); M.R.salas[mejor.sala] = s; M.preArmada = mejor.sala;
  // TIRONES-MOVIL (17-11-2026): sus sombreadores ya no se compilan aquí de una vez (0,1-0,3 s en un cuadro): el precalentador de render.js
  // lo hace de a pocos materiales por cuadro, con la luz de adentro (ver Render.precalentar)
  const tx = new Set(); s.grupo.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) for (const k in m) if (m[k] && m[k].isTexture && m[k].image) tx.add(m[k]); });
  M.preTex = [...tx];
}
// Ocultar la ciudad al entrar a un interior SIN tocar las gaussianas de Idol: si se ocultan, Spark rehace sus árboles de detalle
// al volver y se queda sin memoria (124 «initLodTree error» la primera vez que se salía de un edificio; 12-11-2026).
// Dentro de la sala las paredes las tapan.
function verExterior(M, v) {
  M.R.exterior.visible = true;
  M.R.exterior.traverse(o => {
    if (o === M.R.exterior || o instanceof SplatMesh || !(o.isMesh || o.isLine || o.isPoints || o.isSprite)) return;
    if (!v) { if (o.userData._vis === undefined) o.userData._vis = o.visible; o.visible = false; }
    else if (o.userData._vis !== undefined) { o.visible = o.userData._vis; delete o.userData._vis; }
  });
}
// R-6 (carril render): las salas claras (estuco, caras blancas) saturaban: ambiente + 2 lámparas generales + las del kit sumaban ~3x lo necesario.
// Factores por sala sobre la intensidad con la que se construyó cada luz (se guarda en userData.luz0, así entrar de nuevo no los acumula).
// pt = luces puntuales · amb = luz ambiente · hemi = hemisférica del cielo · exp = exposición del tone mapping (se restaura al salir).
const LUZ_SALA = { _gen: { pt: 0.2, amb: 0.3, hemi: 0.3, exp: 0.85 }, _claro: { pt: 0.4, amb: 0.35, hemi: 0.3, exp: 0.9 },
  palitroque: { pt: 0.3, amb: 0.3, hemi: 0.3, exp: 0.85, frio: 0.4 }, iglesia: { pt: 0.4, amb: 0.45, hemi: 0.4, exp: 0.9, frio: 0.2 }, gimnasio: null, club: { pt: 1, amb: 1, hemi: 0.3, exp: 0.9 }, club45: { pt: 1, amb: 1, hemi: 0.3, exp: 0.9 }, hospital: { pt: 0.2, amb: 0.32, hemi: 0.3, exp: 0.85, frio: 0.15 }, cine: { pt: 0.8, amb: 0.7, hemi: 1, exp: 0.95 }, fortuna: { pt: 1, amb: 1, hemi: 1, exp: 1 } };
// N4-SALAS: salas por época (mismas luces que la del N2) y hospital del kit (4 lámparas propias + ambiente: factores 1, como el club)
Object.assign(LUZ_SALA, { cine45: LUZ_SALA.cine, cine67: LUZ_SALA.cine, palitroque45: LUZ_SALA.palitroque, palitroque67: LUZ_SALA.palitroque,
  hospital157: { pt: 1, amb: 1, hemi: 0.3, exp: 0.85, frio: 0.1 }, hospital67: { pt: 1, amb: 1, hemi: 0.3, exp: 0.85, frio: 0.1 },
  hospital: { pt: 1, amb: 1, hemi: 0.3, exp: 0.85, frio: 0.1 } });   // C7: el hospital del N3 también es el kit
// N2-ESCUELA: escuela y museo del ed. 129 (kitEscuela.js: 4 lámparas propias + ambiente)
for (const id of ['escuela20', 'escuela45', 'escuela67', 'museo']) LUZ_SALA[id] = { pt: 1, amb: 1, hemi: 0.3, exp: 0.85, frio: 0.1 };
const FRIO = new THREE.Color(0xc4d8ff);
function ajustarLuzSala(s) {
  if (URLP.get('luzsala') === '0') return;   // comparar con la luz de antes de R-6
  const k = s.gen ? LUZ_SALA._gen : LUZ_SALA[s.id] === undefined || LUZ_SALA[s.id] === null ? LUZ_SALA._claro : LUZ_SALA[s.id];
  s.grupo.traverse(o => { if (!o.isLight) return; o.userData.luz0 ??= o.intensity; o.intensity = o.userData.luz0 * (o.isAmbientLight ? k.amb : k.pt);
    if (o.isAmbientLight) { o.userData.col0 ??= o.color.clone(); o.color.copy(o.userData.col0).lerp(FRIO, k.frio || 0); } });   // día frío de alta montaña entrando por las ventanas
  G.render.cielo.intensity = (s.oscura ? 0.2 : 0.55) * k.hemi;
  G.render.renderer.toneMappingExposure = k.exp;
}
function entrarSala(M, id, destino, sinFundido) {
  const s = M.R.salas[id];
  verExterior(M, false); for (const o of Object.values(M.R.salas)) o.grupo.visible = false; s.grupo.visible = true;
  M.salaActual = id; M.escena.background = new THREE.Color(0x050505); M.escena.fog = null;
  M.burbujaDe = null; UI.burbuja(null);   // N0-FABLE-1611 (A1): la burbuja del vecino de afuera no entra con Nato
  G.render.sol.intensity = 0; G.render.cielo.intensity = s.oscura ? 0.2 : 0.55;   // 0,08 dejaba la mina completamente negra
  ajustarLuzSala(s);   // R-6: luz y exposición por sala (sin zonas quemadas)
  // N1-M10 (carril mina): al entrar por la puerta de SALIDA (al fondo de la sala) Nato aparecía 1,5 m hacia -z, o sea detrás del
  // muro del fondo (en la mina, fuera de la roca: caída al infinito). Ahora aparece 1,5 m hacia el interior, mirando hacia la sala
  const haciaDentro = destino === s.salida && s.entrada && s.entrada.z > destino.z + 3 ? 1 : -1;
  M.jug.teletransportar(destino.x, destino.y + 0.1, destino.z + haciaDentro * (sinFundido ? 0 : 1.5)); M.jug.rumbo = haciaDentro > 0 ? 0 : Math.PI; M.cam.yaw = haciaDentro > 0 ? Math.PI : 0;
  UI.zona(s.nombre);
}
function salirSala(M, puerta) {
  const viejo = M.salaActual;
  salirVista(M);   // N0-VENTANAS-REALES: devuelve la vista pintada y libera los cubemaps
  for (const o of Object.values(M.R.salas)) o.grupo.visible = false; verExterior(M, true); M.salaActual = null;
  M.burbujaDe = null; UI.burbuja(null);   // N0-FABLE-1611 (A1): la enfermera del hospital (N3) quedaba hablando en pantalla 7 min: el act() del NPC de la sala ya no corre afuera
  if (M.R.salas[viejo] && M.R.salas[viejo].gen) { destruirInterior(M, viejo); M.burbujaDe = null; UI.burbuja(null); if (M.distAfuera) M.cam.dist = M.distAfuera; M.cam.minDist = null; M.cam.interior = false; M.cam.primera = false; }   // N0-INT: al salir se desarma
  const def = M.def;
  M.escena.background = new THREE.Color(def.noche ? 0x0b1020 : def.tormenta ? 0x9aa6b8 : 0x8ec5ff);
  // la misma bruma que al empezar el nivel (con 160-1400 m, al salir de un interior la cordillera quedaba como un muro gris)
  M.escena.fog = new THREE.Fog(def.niebla || 0xcfd8e3, def.tormenta ? 60 : 220, def.tormenta ? 320 : def.brumaLejos ?? 3200);
  G.render.sol.intensity = def.noche ? 0.25 : def.tormenta ? 1.4 : 3.2; G.render.cielo.intensity = def.noche ? 0.25 : 1.1;
  G.render.renderer.toneMappingExposure = 1.0;   // R-6: el exterior no cambia
  const r = puerta.rumbo;
  // fuera del radio de la puerta, para no volver a entrar; salidaDist (puerta suelta de la cornisa del N3): más lejos, para
  // que la cámara, detrás de Nato, no quede metida en el marco de la puerta («caja gris» delante de la cámara)
  if (puerta.salir) {   // N2-ESCUELA: punto de salida propio (escuela: en la escalera). dx/dz en el marco del edificio sin girar (rumbo π/2); el cono lo gira con la puerta
    const q = puerta.salir, th = r - Math.PI / 2, c = Math.cos(th), sn = Math.sin(th), x = puerta.x + q.dx * c + q.dz * sn, z = puerta.z - q.dx * sn + q.dz * c, ru = q.rumbo + th;
    M.jug.teletransportar(x, M.fis.suelo(x, z, puerta.y + 8) + 0.2, z); M.jug.rumbo = ru; M.cam.yaw = ru + Math.PI; return; }   // N2-ESCUELA: punto de salida propio (escuela: en la escalera)
  const dS = puerta.salidaDist ?? 2.8;
  const q = salidaLibre(M, puerta, r, dS);   // N0-FABLE-1611 (A2): si al frente hay un muro (iglesia del N2 contra un camarote), se sale de lado
  M.jug.teletransportar(q.x, Math.max(puerta.y, M.fis.suelo(q.x, q.z, puerta.y + 3)) + 0.2, q.z); M.jug.rumbo = q.r; M.cam.yaw = q.r + Math.PI;
}
// N0-FABLE-1611 (A2): punto de salida con espacio. El de siempre (dS al frente de la puerta) si está libre; si no (muro a < 1,2 m de él,
// la cámara quedaba metida en la cabeza de Nato y no se podía avanzar), prueba girando hacia los lados y más cerca, sobre suelo a la
// altura de la puerta. Libre = 8 rayos horizontales de 1,2 m a la altura del pecho sin choque y suelo a ±1,2 m de la puerta. Solo se busca si un rayo
// desde la puerta choca con algo antes de dS + 1 m.
function salidaLibre(M, puerta, r, dS) {
  const ex = M.jug.p && M.jug.p.col, y0 = puerta.y || 0, abajo = { x: 0, y: -1, z: 0 };
  const d0 = { x: puerta.x + Math.sin(r) * dS, z: puerta.z + Math.cos(r) * dS, r };
  // solo si hay un sólido justo al frente de la puerta (antes de dS + 1 m); las demás puertas salen como siempre
  if (puerta.gen || !M.fis.rayo({ x: puerta.x, y: y0 + 1.1, z: puerta.z }, { x: Math.sin(r), y: 0, z: Math.cos(r) }, dS + 1, ex, ['baranda'])) return d0;
  const libre = (x, z) => {
    const h = M.fis.rayo({ x, y: y0 + 2, z }, abajo, 3.2, ex); if (!h || h.toi < 0.3) return null;   // suelo a ±1,2 m de la puerta (no dentro de un sólido)
    const s = h.punto.y;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (M.fis.rayo({ x, y: s + 1.1, z }, { x: Math.sin(a), y: 0, z: Math.cos(a) }, 0.9, ex, ['baranda'])) return null; }
    return s;
  };
  let mejor = null;
  for (const d of [1.6, 2.2, dS]) for (const g of [0.5, -0.5, 0.9, -0.9, 1.3, -1.3, 1.57, -1.57]) {
    const a = r + g, x = puerta.x + Math.sin(a) * d, z = puerta.z + Math.cos(a) * d, s = libre(x, z); if (s == null) continue;
    const mira = Math.abs(g) >= 0.9 ? r + Math.sign(g) * Math.PI / 2 : a;   // de lado: mira a lo largo del muro, alejándose de la puerta
    const h = M.fis.rayo({ x, y: s + 1.1, z }, { x: Math.sin(mira), y: 0, z: Math.cos(mira) }, 14, ex, ['baranda']), lib = h ? h.toi : 14;   // espacio por delante (para caminar y para la cámara detrás)
    if (lib > 2.5 && (!mejor || lib > mejor.lib)) mejor = { x, z, r: mira, lib };
  }
  return mejor || d0;
}
// N1-M2 (carril mina): las bocas de la mina (p.boca) disparan en todo el vano y el túnel, no solo en un círculo de 1,3 m al frente
// (si Nato entraba desviado, el círculo no lo tomaba y seguía dentro del cerro)
function enPuerta(j, p) {
  const dx = j.pos.x - p.x, dz = j.pos.z - p.z;
  if (!p.boca) return Math.hypot(dx, dz) < 1.3;
  const s = Math.sin(p.rumbo), c = Math.cos(p.rumbo), dentro = -(dx * s + dz * c), lat = dx * c - dz * s;
  return Math.abs(lat) < p.boca.hw && dentro > -0.9 && dentro < p.boca.fondo;
}
function revisarPuertas(M) {
  if (G.render.calidad === 'movil' && !M.salaActual && !M.cruzando && !M.final && M.R.intListo && URLP.get('cache') !== '0') preArmarInterior(M);   // CACHE-MOVIL (?cache=0: sin caché ni armado previo); TIRONES-MOVIL: también en la pausa de puertas (tPuerta)
  if (M.tPuerta > 0 || M.cruzando || M.final) return;
  const j = M.jug;
  if (!M.salaActual) {
    if (!M.R.intListo && M.t > 1.5) prepararInteriores(M);   // N0-INT: puertas de los edificios genéricos (el kit ya se armó)
    for (const p of M.R.puertas) if (!p.gen && enPuerta(j, p) && Math.abs(j.pie - p.y) < 2.5 && M.R.salas[p.sala]) return cruzarPuerta(M, p);
    // N2-C27 (carril ciudad): cerca de una puerta, aviso «E: entrar» y la tecla E (o Enter / botón de acción) entra sin tener que atinarle al vano
    // N4-SALAS: una puerta con disparador y sin sala en este nivel nunca queda muda: avisa «… · CERRADO» (como la escuela)
    for (const p of M.R.puertas) if (!p.boca && p.lado !== 'salida' && Math.hypot(j.pos.x - p.x, j.pos.z - p.z) < (p.gen ? 3.2 : 4.5) && Math.abs(j.pie - p.y) < 2.5) {
      const sinSala = !p.gen && !M.R.salas[p.sala], cerrada = p.cerrada || sinSala;
      const txt = p.cerrada ? p.nombre : sinSala ? (p.avisoCerrado || String(p.nombre || p.sala || 'PUERTA').toUpperCase() + ' · CERRADO') : null;
      if (E.b.accion.recien) { if (cerrada) { UI.aviso(txt, 1800); return; } return cruzarPuerta(M, p); }   // N0-INT: los genéricos solo con E; los cerrados avisan
      if (!(M.tAvisoPuerta > performance.now())) { M.tAvisoPuerta = performance.now() + 1500; UI.aviso(cerrada ? txt : 'E: entrar · ' + (p.nombre || p.sala).toUpperCase(), 1600); }
      break;
    }
  } else {
    const s = M.R.salas[M.salaActual];
    if (Math.hypot(j.pos.x - s.entrada.x, j.pos.z - s.entrada.z) < 1.0 && Math.abs(j.pie - s.entrada.y) < 1.5) return cruzarPuerta(M, { lado: 'entrada' });
    if (s.salida && Math.hypot(j.pos.x - s.salida.x, j.pos.z - s.salida.z) < 1.0 && Math.abs(j.pie - s.salida.y) < 1.5) return cruzarPuerta(M, { lado: 'salida' });
  }
}

// ------------------------------------------------------------------ caídas, vidas y puntos de control
function volverASeguro(M) {
  const s = M.jug.seguro || M.control;
  M.jug.teletransportar(s.x, s.y + 0.3, s.z); M.jug.vel.set(0, 0, 0); M.jug.invul = Math.max(M.jug.invul, 1.2);
}
avisar.perderVida = motivo => {
  const M = G.M; if (!M) return;
  voz('pucha');
  UI.fundir(true);
  setTimeout(() => {
    if (G.M !== M) return;
    if (P.vidas <= 0) { finDelJuego(); return; }
    P.corazones = P.corMax;
    const c = M.control;
    if (c.sala && c.sala !== M.salaActual) entrarSala(M, c.sala, c, true);
    else if (!c.sala && M.salaActual) salirSala(M, { x: c.x, y: c.y, z: c.z, rumbo: 0 });
    M.jug.reiniciar(); M.jug.teletransportar(c.x + 1.2, c.y + 0.2, c.z); M.jug.invul = 2; M.cam.cortar();
    UI.aviso(motivo === 'olla' ? '-1 VIDA' : '¡Otra vez!'); UI.fundir(false);
  }, 700);
};
avisar.rotulo = t => UI.aviso(t); avisar.efecto = efecto; avisar.energiaLlena = () => { efecto('energiaLlena'); UI.aviso('¡HÉRCULES LISTO! (C / 🐕)'); };
async function finDelJuego() {
  if (G.terminando) return; G.terminando = true; setTimeout(() => (G.terminando = false), 3000);
  limpiarMundo(); UI.mostrarHUD(false); UI.fundir(false);
  musica('derrota');   // X-M1
  await tarjeta(`<h1>FIN DEL JUEGO</h1><p>Puntaje: ${P.puntos}</p>`); mostrarTitulo();
}

// ------------------------------------------------------------------ finales de nivel
async function finalNivel(M, tipo, quien) {
  if (M.final) return; M.final = tipo;
  // nadie sigue peleando durante el final
  for (const e of M.L.lista) if (['minero', 'dinamitero', 'bolero', 'condor', 'dinamita', 'bola', 'vagoneta', 'lanzaBolas', 'lanzaVagonetas'].includes(e.tipo) && e !== quien) M.L.quitar(e);
  M.jug.estado = 'quieto'; UI.burbuja(null);
  // N0-CIUDAD-VIVA (carril animador): la banda de Sewell recibe al tren tocando en el andén (losa y 0,9, z 13-18), al lado de Nato, mirando a la vía
  const bandaTren = tipo === 'tren' && URLP.get('banda') !== '0' ? import('./mundo/banda.js').then(m => m.bandaAnden(M, URLP.has('rapido') && !URLP.has('cine') ? Math.max(-30, Math.min(120, M.jug.pos.x)) + 9 : 47)).catch(e => { console.warn('banda', e); return null; }) : null;
  if (tipo === 'tren' && !(URLP.has('rapido') && !URLP.has('cine'))) {   // X-K13 (carril cine): el final del N1 es una cinemática dirigida como la del N4 (X-K10)
    if (M.hercules) M.hercules.estado = 'final';
    await trenFinalCine({ G, UI }, M, { tren: crearTren(M, M.L, -200, 22, { carros: 3 }), pedro: false, fondo: new THREE.Vector3(-70, altura(-70, -90) + 15, -90),
      general: { pos0: new THREE.Vector3(165, altura(165, 72) + 22, 72), pos1: new THREE.Vector3(158, altura(158, 68) + 25, 68), k: 0.68 }, subs: [
      [0.6, 5.2, '1905 · El Molino. Por la quebrada sube el tren desde Rancagua.'],
      [15.6, 18.6, '<b>Nato:</b> ¡Vamos, Hércules! ¡Arriba!'],
      [23.4, 26.6, '<b>Nato:</b> Aguanta, papá. Voy por ti.'],
      [26.8, 29.2, 'Los viajeros suben sentados sobre la carga de los carros planos.'],
      [29.6, 37, 'El tren sigue su camino. Atrás queda El Molino, el campamento que en 1915 se llamará Sewell.'],
    ] });
  } else if (tipo === 'tren') {   // Nivel 1: llega el tren que sube desde Rancagua (la misma locomotora de la serie)
    // pedido de Diego (14-11): Nato quedaba a ~45 m del tren, que llegaba en reversa desde el lado equivocado y con los carros en
    // el aire. Ahora Nato va al borde del andén, el tren entra de frente (locomotora adelante, desde -X) sobre los rieles y frena
    // con la locomotora justo pasando a Nato
    // N1-C50: de pie SOBRE el andén (losa a y 0,9, z 13-18), a ~2 m del borde amarillo, con Hércules sentado a su lado
    const nx = Math.max(-30, Math.min(120, M.jug.pos.x)), nz = 15, s0 = M.fis.suelo(nx, nz, 8, M.jug.p.col), gy = s0 != null && s0 > 0.6 ? s0 : 0.9;
    M.jug.teletransportar(nx, gy + 0.05, nz); M.jug.rumbo = 0; M.jug.vel.set(0, 0, 0);
    // (suelo sin la cápsula de Nato: si él ya estaba en ese punto, el rayo daba en su cabeza y quedaba a 2,7 m)
    const H = M.hercules; if (H) { H.estado = 'final'; H.malla.position.set(nx - 1.3, gy, nz - 0.2); H.malla.rotation.y = 0; H.posAct?.copy(H.malla.position); H.posAnt?.copy(H.malla.position); H.gesto?.('sentado', 60); }   // posAct: si no, el paso interpolado lo devolvía a donde estaba
    const parada = nx + 2.5;   // frente de la locomotora (x + 3,3) unos 6 m pasado Nato: la cabina queda a su lado
    const t = crearTren(M, M.L, parada - 115, 22, { carros: 3 });
    UI.aviso('¡Llega el tren!', 3000);
    // N1-C55: cámara LIBRE toda la escena (la del juego: órbita con el mouse alrededor de Nato, con choque contra la estación y el
    // terreno). Parte en la toma armada: Nato y Hércules de tres cuartos por la espalda, en el andén, y el tren que entra
    G.camLibre = null; M.cam.cortar(); M.cam.yaw = Math.atan2(0.8, -0.6); M.cam.pitch = 0.3; const distAntes = M.cam.dist; M.cam.dist = 7.5;   // N1-E43: desde el lado de la estación, en diagonal: el tren pasa DETRÁS de Nato (antes rozaba la cámara y parecía pegado a él)
    UI.aviso('Mueve el mouse para mirar · Enter (o Ⓐ del mando) para continuar', 60000);
    // llegada natural: entra a 14 m/s y frena parejo (1,6 m/s²) hasta detenerse; Nato lo mira venir y lo saluda con la mano
    const mirar = (tx, tz) => { M.jug.rumbo = Math.atan2(tx - nx, tz - nz); };
    M.jug.gesto('saludar', 60);
    await new Promise(r => { let v = 14; t.act = dt => {
      const falta = parada - t.x; v = Math.min(v, Math.sqrt(2 * 1.6 * Math.max(0, falta)) + 0.15);
      const x = Math.min(parada, t.x + v * dt); t.mover(x, dt); mirar(t.x + 3, 22);
      if (x >= parada - 0.02) { t.act = dt2 => t.mover(t.x, dt2); r(); } }; });   // detenido: sigue echando humo
    // el tren ya se detuvo: ~3 s con Nato celebrando de frente a la locomotora, antes de la tarjeta
    // tren detenido: Nato sigue saludando (pedido de Diego) y la cámara sigue libre; la tarjeta espera una tecla (o 20 s)
    mirar(parada - 1.5, 22); M.jug.gesto('saludar', 60); M.hercules?.gesto?.('feliz', 30);
    await new Promise(r => { const fin = () => { removeEventListener('keydown', tecla); clearTimeout(tt); clearInterval(tm); r(); }, tecla = ev => { if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') fin(); }, tt = setTimeout(fin, 20000); addEventListener('keydown', tecla);
      mandoPulso('finTren', ['sur', 'este', 'start']); const tm = setInterval(() => { leerMando(); if (mandoPulso('finTren', ['sur', 'este', 'start'])) fin(); }, 50); });   // G-MANDO: también A/B/Start del mando
    UI.aviso('', 10); M.cam.dist = distAntes;
  }
  if (bandaTren) bandaTren.then(b => b && b.quitar());
  if (tipo === 'cine') {   // Nivel 2: se apagan las luces y empieza el noticiario en sepia
    G.render.cielo.intensity = 0.02; await espera(1);
    await noticiario({ G, verExterior }, M);   // X-K2: escena en sepia en el motor (antes una tarjeta)
  } else if (tipo === 'jefe') {   // Nivel 3: el jefe se rinde y confiesa dónde está el nido
    UI.burbuja('<b>Jefe de los mineros:</b> ¡Ya, ya, me rindo! El nido está en lo más alto de Sewell… El cóndor cruzó el cielo con tu papá.');
    await espera(Math.min(6.5, lectura('¡Ya, ya, me rindo! El nido está en lo más alto de Sewell.')));
    UI.burbuja(null);
  }
  if (tipo !== 'cine' && tipo !== 'tren') { M.jug.gesto('celebrar', 30); M.hercules?.gesto?.('feliz', 30); }   // en el tren sigue saludando   // en el N2 el noticiario es triste: sin festejo
  musica('victoria'); voz('orgulloso');   // X-M1
  const def = M.def;
  await tarjeta(`<h1>¡NIVEL ${def.numero} COMPLETADO!</h1>${parrafos(def.tarjetaFinal)}`);
  await resumen(def);
  const n = def.numero;
  if (n === 3) { await memoria1945(); return; }
  pasarDeNivel(n + 1); await empezarNivel(n + 1);
}
async function resumen(def) {
  musica('creditos');   // X-M1
  await tarjeta(`<h1>${def.nombre}</h1><p>Puntaje: <b>${P.puntos}</b> · Pepitas: ${P.pepitas} · Apuntes: ${P.apuntes.size}/5</p><p>Mineros noqueados: ${P.noqueados} · Cóndores: ${P.condores} · Vidas: ${P.vidas}</p>`);
}

// Memoria · 19 de junio de 1945: de noche y con nieve; Nato solo puede caminar lento entre las familias que esperan.
async function memoria1945() {
  limpiarMundo(); UI.mostrarHUD(false);
  const def = { ...NIVELES[3], noche: true, invierno: true, tormenta: false, niebla: 0x10141c, nombre: MEMORIA.titulo, elementos: NIVELES[3].elementos.filter(e => e.t === 'edificio' || e.t === 'escalera' || e.t === 'plaza' || e.t === 'via' || e.t === 'anden' || e.t === 'roca'), salas: [],
    ruta: [[MEMORIA.casco.x, MEMORIA.casco.z]] };   // ruta propia (piloto): con la del N3 iba al hospital y quedaba pegado a la fachada
  musica(null);   // X-M1: la memoria va en silencio (X-K2: el título pasa a la escena memoriaTitulo)
  const M = await pantallaCarga(MEMORIA.titulo, '', () => crearMundo(def, { lento: true, inicio: MEMORIA.inicio }), true);
  M.memoria = true; M.dobleSalto = false;
  // N3-C12 (carril codigo): noche de verdad. Las gaussianas no reciben luz (traen el día horneado): se oscurecen y azulan como
  // con luna; la luz del mundo baja a luna fría y un farol cálido alumbra a las familias y el casco (sin él, Nato no se distinguía)
  M.escena.traverse(o => { if (o.isObject3D && o.recolor && 'packedSplats' in o) o.recolor.setRGB(0.17, 0.2, 0.32); });
  G.render.sol.color.set(0x9db4ff); G.render.sol.intensity = 0.12; G.render.cielo.intensity = 0.1;
  { const yF = M.fis.suelo(MEMORIA.casco.x, MEMORIA.casco.z) ?? 0, farol = new THREE.PointLight(0xffc27a, 70, 45, 1.5); farol.position.set(MEMORIA.casco.x, yF + 7, MEMORIA.casco.z + 10); M.escena.add(farol); }
  // familias que esperan, en silencio. N3-C10 (carril codigo): con los dolientes de gaussianas (minero y mujer, movil); sin ellos,
  // las siluetas de antes. Giro propio del modelo: -1,36 (minero) y -1,26 (mujer) los deja mirando a +Z; el grupo los vuelve hacia el casco
  const dol = ['doliente_minero', 'doliente_mujer'].map(k => G.splats && G.splats[k] && URLP.get('splats') !== '0' ? { ...G.splats[k], url: G.splats[k].urlMovil || G.splats[k].url } : null);
  for (let i = 0; i < 18; i++) {
    const x = (i % 2 ? 1 : -1) * (5 + (i % 3) * 1.4), z = -282 - Math.floor(i / 2) * 4, sp = dol[i % 2];
    if (sp && i < 12) {
      const g = new THREE.Group(); g.add(personajeSplat(sp, (i % 2 ? 1.62 : 1.72) * (i % 4 === 0 ? 0.97 : 1), i % 2 ? -1.26 : -1.36, ['doliente_minero', 'doliente_mujer'][i % 2], 'duelo'));   /* G-PERS: malla en duelo si existe */
      g.position.set(x, M.fis.suelo(x, z), z); g.rotation.y = Math.PI + (i % 3 - 1) * 0.25; g.userData.doliente = true; M.escena.add(g);
      g.traverse(o => { if (o.recolor && 'packedSplats' in o) o.recolor.setRGB(0.42, 0.42, 0.52); });   // de noche, pero más claros que la ciudad: los alumbra el farol
      continue;
    }
    if (sp) continue;   // con gaussianas, 12 dolientes (las 18 siluetas eran demasiadas para la GPU integrada)
    const p = mallaPersona([{ cuerpo: 0x3a3a48, piernas: 0x22222a, pelo: 0x2a2220 }, { cuerpo: 0x4a3a3a, piernas: 0x22222a, pelo: 0x5a5a5a }][i % 2], 0.85 + (i % 4 === 0 ? -0.25 : 0));
    p.position.set(x, M.fis.suelo(x, z), z); p.rotation.y = Math.PI; M.escena.add(p);
  }
  const yC = M.fis.suelo(MEMORIA.casco.x, MEMORIA.casco.z);
  M.escena.add(ofrendaMemorial(MEMORIA.casco.x, yC, MEMORIA.casco.z));   // N3-C14 (carril terreno): casco de época, claveles, copihues y velas (antes media esfera amarilla y bolitas)
  UI.fundir(false); await memoriaTitulo({ G }, M, MEMORIA);   // X-K2
  G.escena = 'juego'; UI.fundir(false); M.cam.cortar();
  let i = 0;
  M.alActualizar = async () => {
    const d = Math.hypot(M.jug.pos.x - MEMORIA.casco.x, M.jug.pos.z - MEMORIA.casco.z);
    const k = Math.min(2, Math.floor((1 - Math.min(1, (d - 2) / 40)) * 3));
    if (k >= i && i < 3) { UI.burbuja(MEMORIA.textos[i]); i++; }
    if (d < 2.2 && !M.final) {
      M.final = 'memoria'; M.jug.estado = 'quieto';
      await espera(URLP.has('rapido') ? 0.2 : 5); UI.burbuja(null);
      // salto de tiempo explícito antes del Nivel 4: nada de lo que sigue parece celebrar esas muertes (X-K2: escena en el motor)
      await anosDespues({ G }, M, MEMORIA);
      UI.fundir(true); await espera(0.6);
      limpiarMundo(); UI.fundir(false);
      pasarDeNivel(4); await empezarNivel(4);
    }
  };
}

// Nivel 4: el cóndor gigante se va a la cordillera, Pedro baja del nido y se adelanta con Hércules; luego, 1981.
async function rescate(M, c) {
  M.pelea = false;
  if (URLP.has('rapido') && !URLP.has('cine')) {   // pruebas rápidas: como antes, sin escena
    UI.aviso('¡El cóndor gigante se va volando a la cordillera!', 3000); await espera(2.5);
    UI.burbuja('<b>Pedro:</b> ¡Nato, hijo! Sabía que vendrías. Me adelanto a la estación… ¡Ven con Hércules, nos vemos en el tren!'); await espera(1.5); UI.burbuja(null);
  } else await rescatePedro({ G }, M, c, M.L.de('nido')[0]);   // X-K8 (carril cine): escena del rescate en el motor
  M.herculesFuera = true;   // Hércules se va con Pedro: viajan en el último carro del tren
  UI.fundir(true); await espera(0.6);
  await tarjeta('<h1>1981</h1><p>El último tren sale de la estación de Sewell.</p>', { min: 1.5 });
  const nido = M.L.de('nido')[0]; if (nido) nido.pedro.visible = false;
  // X-K10 (carril cine): el último tren es una cinemática dirigida (andén, llegada, salto de Nato y Hércules, carro con Pedro, quebrada,
  // túnel) y sigue a los créditos. Con ?rapido sin ?cine queda el final jugable de antes (pruebas)
  if (!(URLP.has('rapido') && !URLP.has('cine'))) { await trenFinalCine({ G, UI }, M); await cierreFinal(M, true); return; }
  M.jug.teletransportar(-30, M.fis.suelo(-30, 8) + 0.2, 8); M.jug.rumbo = Math.PI / 2; M.cam.yaw = -Math.PI / 2; M.cam.cortar();
  M.listo1981 = true; M.jug.seguro = { x: -30, y: M.fis.suelo(-30, 8), z: 8 }; M.control = { ...M.jug.seguro, sala: null };
  // tarjeta() deja G.escena en 'tarjeta': sin volver a 'juego' el nivel quedaba congelado tras «1981» (sin tarjeta a la vista)
  G.escena = 'juego'; UI.zona('1981 · EL ÚLTIMO TREN'); UI.fundir(false);
}
function trenCondor(M, tren) {
  import('./juego/entidades.js').then(({ mallaCondor }) => {
    // cóndores que persiguen al tren: picotean (en Fácil y Normal roban hasta 5 pepitas; en Difícil, un corazón)
    // con el cóndor en vuelo de Idol (antes una cápsula negra con un tablón por alas)
    const g = mallaCondor(1, M.splatsTodos && M.splatsTodos.condor_vuelo), ala = g.userData.alaI, modelo = g.userData.modelo; M.escena.add(g);
    const antes = new THREE.Vector3();
    const nAntes = M.L.lista.filter(o => o.tipo === 'condorTren' && o.vivo).length, lado = nAntes % 2 ? 1 : -1, fase = nAntes * Math.PI;   // cada cóndor por su lado y a contratiempo (antes los dos perseguían el mismo punto y se encimaban)
    const e = M.L.agregar({ tipo: 'condorTren', vivo: true, malla: null, t: Math.random() * 3, estado: 'sigue' });
    e.pos = g.position;
    e.act = dt => {
      e.t += dt; ala.rotation.z = Math.sin(e.t * 8) * 0.5; g.userData.alaD.rotation.z = -ala.rotation.z;
      if (g.userData.condor) { g.userData.condor.tocar(e.estado === 'pica' ? 'picada' : 'aleteo', 1.3); g.userData.condor.actualizar(dt); }   // G-CONDOR: cóndor malla
      if (g.userData.y0 != null) { const pl = Math.sin(e.t * 1.3); modelo.position.y = g.userData.y0 + pl * 0.15; modelo.rotation.z = pl * 0.12; }   // planeo y balanceo suaves
      const j = M.jug, obj = new THREE.Vector3(j.pos.x - 6 + Math.sin(e.t + fase) * 3 + lado * 1.5, j.pos.y + (e.estado === 'pica' ? 0.5 : 5 + (lado > 0 ? 1.5 : 0)), j.pos.z + Math.cos(e.t * 0.7 + fase) * 3 + lado * 2.5);
      antes.copy(g.position); g.position.lerp(obj, 1 - Math.exp(-dt * (e.estado === 'pica' ? 4 : 1.5)));
      const vx = g.position.x - antes.x, vz = g.position.z - antes.z;   // mira hacia donde vuela (el tren va en +X)
      if (vx * vx + vz * vz > 1e-6) { let d = Math.atan2(vx, vz) - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 4); }
      if (e.estado === 'sigue' && e.t > 4) { e.estado = 'pica'; e.t = 0; }
      const gp = j.golpeActivo();
      if (gp && g.position.distanceTo(new THREE.Vector3(gp.x, gp.y, gp.z)) < gp.r + 1) { particulas(M, g.position, 0x1d1b22, 6); P.condores++; P.puntos += 250; e.estado = 'sigue'; e.t = -6; g.position.y += 8; return; }
      if (e.estado === 'pica' && g.position.distanceTo(new THREE.Vector3(j.pos.x, j.pos.y, j.pos.z)) < 1.3 && j.invul <= 0) {
        if (J.dificultad === 'dificil') danar(j, 'picotazo'); else { const n = Math.min(5, P.pepitas); P.pepitas -= n; UI.aviso(n ? `¡Te robó ${n} pepitas!` : '¡Picotazo!'); }
        j.invul = 1.2; j.vel.y = 4; e.estado = 'sigue'; e.t = 0;
      }
      if (M.final === 'cierre') { g.removeFromParent(); e.vivo = false; }
    };
  });
}
async function cierreFinal(M, desdeCine = false) {
  M.final = 'cierre'; M.jug.estado = 'quieto';
  if (!desdeCine) { UI.aviso('Nato se va con el tren, mirando hacia Sewell.', 3500); await espera(3.5); }   // X-K10: tras la cinemática del tren, directo al fundido
  UI.fundir(true); await espera(1); limpiarMundo(); UI.mostrarHUD(false); UI.fundir(false);
  musica(null);   // X-M1
  // X-K2: el fin del juego es una escena en el motor (plaza de Sewell); las tarjetas quedan para ?rapido=1
  if (!(await finDelJuegoCine({ G, crearMundo, pantallaCarga, limpiarMundo, NIVELES, UI }, P))) {
    await tarjeta('<p style="opacity:.8">Sewell quedó en silencio.</p>', { sobria: true, min: 3 });
    musica('titulo');   // X-M1
    await tarjeta(`<h2>13 de julio de 2006</h2><h1>SEWELL, PATRIMONIO DE LA HUMANIDAD</h1><p>declarado por la UNESCO por tres valores:</p>
      <p>Minero e industrial<br>Arquitectónico: los «Cuadrados y Triángulos» de sus 253 edificios de colores<br>Cultural: la vida en común de mineros norteamericanos y campesinos chilenos</p>
      <p>En 1998 ya había sido declarado Monumento Nacional.<br>Más de 500.000 personas pasaron por Sewell entre 1905 y 1981.</p>`, { min: 3 });
    musica('creditos'); voz('imaginate');   // X-M1
    await tarjeta('<h1>La plaza de Sewell</h1><p><b>Nato:</b> Como les decía antes de que nos interrumpieran… ¡esta es la historia de Sewell!</p><p><b>Pedro:</b> Gracias a todos los sewellinos y sewellinas. Este libro es para ellos.</p><p>«¡Bravo, Nato! ¡Bravo, don Pedro!»</p>');
    voz('orgulloso');
    await tarjeta(`<h1>¡JUEGO COMPLETADO!</h1><p>Puntaje final: <b>${P.puntos}</b> · Pepitas: ${P.pepitas} · Vidas: ${P.vidas}</p>`);
    voz('gracias');
    await tarjeta(`<h1>SEWELL Y SU HISTORIA EN 3D</h1><h2>Nato y la ciudad de las escaleras</h2><p>Un juego de <b>WOLKY TECH</b><br>Basado en el libro «Apuntes Históricos de El Mineral El Teniente», de Pedro Villagra Díaz,<br>y en la serie documental anime «El Teniente»</p>
      <p>Protagonista y voz: Ignacio «Nato» Villagra</p><p>YouTube @wolkytech · Instagram @wolky_ia · wolky.cl · ventas@wolky.cl</p><p>Dedicado a todos los sewellinos y sewellinas. ¡Gracias por jugar!</p>`, { min: 2 });
  }
  G.juegoCompleto = true; mostrarTitulo();
}

// ------------------------------------------------------------------ modo foto (Fase 4: path tracing con three-gpu-pathtracer)
function modoFoto(v) { G.foto = v; UI.mostrarHUD(!v); if (v) UI.aviso('Modo foto: mueve la cámara con el ratón · F o Esc para salir.', 3000); }

// ------------------------------------------------------------------ personajes lejanos
// los personajes animados a más de 80 m de la cámara no se dibujan (Spark no los recalcula ni los ordena): había mineros y
// vecinos a 340 m y hasta 3,4 km procesados a detalle completo en cada cuadro. Nato y Hércules nunca se ocultan
let tLejanos = 0;
function ocultarLejanos(M) {
  const ahora = performance.now(); if (ahora - tLejanos < 1000) return; tLejanos = ahora;   // una vez por segundo (los que cargan tarde también entran)
  const propios = new Set(); M.jug.malla.traverse(o => propios.add(o)); if (M.hercules) M.hercules.malla.traverse(o => propios.add(o));
  const c = G.render.camara.position, p = new THREE.Vector3();
  G.render.escena.traverse(o => { if (o.skinning && !propios.has(o)) { o.getWorldPosition(p); o.visible = p.distanceToSquared(c) < 80 * 80; } });
}

// ------------------------------------------------------------------ medidor de ritmo (F9): para encontrar tirones en el equipo de Diego
// barras: duración de cada cuadro (la línea marca 16,7 ms = 60 fps); color: pasos de física en ese cuadro (rojo 0, verde 1,
// amarillo 2, naranjo 3 o más). Texto: cuadros lentos (> 25 ms) y cuadros sin paso en los últimos 4 s
addEventListener('keydown', ev => {
  if (ev.code !== 'F9') return;
  ev.preventDefault();
  if (G.ritmo) { G.ritmo.lienzo.remove(); G.ritmo = null; return; }
  const c = document.createElement('canvas'); c.width = 480; c.height = 130;
  Object.assign(c.style, { position: 'fixed', right: '8px', bottom: '8px', zIndex: 99, background: 'rgba(0,0,0,0.65)', borderRadius: '6px', pointerEvents: 'none' });
  document.body.appendChild(c);
  const ctx = c.getContext('2d'), datos = [];
  G.ritmo = { lienzo: c, anotar(dt, n) {
    datos.push([dt * 1000, n]); if (datos.length > 240) datos.shift();
    ctx.clearRect(0, 0, 480, 130);
    const esc = 100 / 50;   // 50 ms = alto completo
    datos.forEach(([ms, k], i) => { ctx.fillStyle = k === 0 ? '#e33' : k === 1 ? '#3c3' : k === 2 ? '#ec3' : '#f80'; const h = Math.min(100, ms * esc); ctx.fillRect(i * 2, 110 - h, 2, h); });
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, 110 - 16.7 * esc); ctx.lineTo(480, 110 - 16.7 * esc); ctx.stroke();
    const lentos = datos.filter(d => d[0] > 25).length, sinPaso = datos.filter(d => d[1] === 0).length, dobles = datos.filter(d => d[1] >= 2).length;
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText(`cuadros lentos (>25 ms): ${lentos}   sin paso: ${sinPaso}   2+ pasos: ${dobles}   máx: ${Math.max(...datos.map(d => d[0])).toFixed(0)} ms`, 6, 126);
  } };
});

// ------------------------------------------------------------------ bucle
let acumulado = 0, ultimo = performance.now(), cuadros = 0, tFps = 0;
// N2-C24 (carril ciudad): el árbol de LoD de Spark vive en un worker de wasm (tope 4 GB). Si initLodTree se cae («unreachable»), Spark
// no recicla ese worker y ningún edificio con LoD se vuelve a dibujar. vaciarLod descarta todos los árboles (y el worker si quedó roto);
// Spark los rehace en el cuadro siguiente para lo que está en escena. Se llama antes de cada nivel y, como red, si el worker se rompe.
let reparacionesLod = 0;
async function vaciarLod(S) {
  if (!S || !S.lodIds) return;
  const roto = S.lodWorker && S.lodWorker.trapped;
  const limpiar = () => {
    for (const inst of S.lodInstances.values()) if (inst.texture) inst.texture.dispose();
    S.lodInstances.clear(); S.lodIds.clear(); S.lodIdToSplats.clear(); S.lodInitFailed = new WeakSet(); S.lodMeshes = []; S.lodDirty = true;
  };
  if (roto) { console.warn('Spark: worker de LoD roto, se reemplaza (N2-C24)'); try { S.lodWorker.dispose(); } catch (e) {} S.lodWorker = null; limpiar(); return; }
  if (!S.lodWorker) return;
  await S.lodWorker.exclusive(async w => { const ids = [...S.lodIds.values()].map(r => r.lodId); limpiar(); for (const lodId of ids) await w.call('disposeLodTree', { lodId }); });
}
async function bucle(ahora) {
  if (G.render) actualizarDiferidos(G.render.camara.position);   // R-2: personajes de gaussianas solo cerca de la cámara
  if (G.spark && G.spark.lodWorker && G.spark.lodWorker.trapped && reparacionesLod < 3) { reparacionesLod++; vaciarLod(G.spark); }
  const dtReal = Math.min(0.1, (ahora - ultimo) / 1000); ultimo = ahora;
  cuadros++; tFps += dtReal; if (tFps > 0.5) { G.fps = Math.round(cuadros / tFps); cuadros = 0; tFps = 0; }
  try {
    const M = G.M;
    if (G.escena === 'juego' && M) {
      leerEntrada(true);   // N0-CTRL: las pulsaciones quedan pendientes hasta el próximo paso de física (tomarPulsos)
      if (E.b.mapa.recien && !G.foto && !UI.abierto && !(G.pausa && !G.mapaPausa && !(M.tur && M.tur.abierto))) { if (M.tur) dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true })); else alternarMapa(); }   // N0-MAPA: Select del mando / botón táctil (el teclado lo atiende mapa.js)
      else if (mapaAbierto() && (E.b.pausa.recien || E.b.accion.recien)) cerrarMapa();   // N0-MAPA: Esc o B cierran el plano (sin abrir la pausa)
      else if (E.b.pausa.recien) { if (!G.pausa && !G.foto && paseoSaltar(M)) { /* N1-FORTUNA-PASEO: Esc salta el paseo en vagoneta */ } else if (G.foto) modoFoto(false); else if (UI.abierto) cerrarApunte(); else pausar(!G.pausa); }
      if (E.b.foto.recien && !G.pausa) modoFoto(!G.foto);
      if (UI.abierto) { if ((E.b.accion.recien || E.b.saltar.recien || E.b.golpe.recien) && performance.now() - G.modalAbierto > 600) cerrarApunte(); olvidarPulsos(); }
      else if (!G.pausa && !G.foto) {
        const turbo = +(URLP.get('turbo') || 1);   // pruebas: varios pasos de física por cuadro
        acumulado += dtReal * turbo;
        let n = 0;
        while (acumulado >= PASO && n < 8 * turbo) { tomarPulsos(); paso(M, PASO); acumulado -= PASO; n++; }   // N0-CTRL: cada pulsación la toma el primer paso que viene (antes se perdía en los cuadros sin paso)
        if (G.ritmo) G.ritmo.anotar(dtReal, n);
        if (n >= 8 * turbo) acumulado = 0;   // tope 8 pasos (antes 4: con cuadros de más de 66 ms se perdía tiempo y Nato quedaba atrás de la cámara)
        M.jug.vista(Math.min(1, acumulado / PASO), dtReal);
        ocultarLejanos(M);
        if (M.hercules && M.hercules.vista) M.hercules.vista(Math.min(1, acumulado / PASO), dtReal);
      } else olvidarPulsos();
      paseoCuadro(M, !G.pausa && !G.foto && !UI.abierto ? dtReal : 0);   // N1-FORTUNA-PASEO
      if (G.foto) { M.cam.yaw -= E.mirar.x; M.cam.pitch = Math.max(-0.3, Math.min(1.3, M.cam.pitch + E.mirar.y)); }
      if (G.camLibre) { G.render.camara.position.set(...G.camLibre.pos); G.render.camara.lookAt(...G.camLibre.mira); } else
      M.cam.enCapacho = M.enCapacho();
      if (!G.camLibre && !paseoCamara(M, G.render.camara, dtReal)) M.cam.actualizar(dtReal, M.jug.posVista || M.jug.pos, G.pausa ? { x: 0, y: 0 } : E.mirar, M.jug.p.col, M.jug.rumbo + Math.PI, Math.hypot(E.mover.x, E.mover.y) > 0.2);
      { // Hércules entre la cámara y Nato: un perro de splat a menos de 1,6 m de la cámara es una mancha roja borrosa que tapa la pantalla
        const h = M.L.de('hercules')[0];
        if (h && h.malla && h.malla.visible) { const cp = G.render.camara.position, hp = h.malla.position; if (Math.hypot(cp.x - hp.x, cp.y - (hp.y + 0.6), cp.z - hp.z) < 1.6) h.malla.visible = false; }
      }
      if (M.jug.splat) M.jug.splat.visible = !M.cam.muyCerca;   // cámara pegada a Nato (pared detrás): se oculta su splat
      if (M.sacudida > 0) { M.sacudida -= dtReal; G.render.camara.position.x += (Math.random() - 0.5) * 0.3; G.render.camara.position.y += (Math.random() - 0.5) * 0.3; }
      G.render.seguirSol(new THREE.Vector3(M.jug.pos.x, M.jug.pos.y, M.jug.pos.z));
      musicaJuego(M);   // X-M1
      UI.actualizar(M.jug, { reloj: M.reloj != null && !M.salaActual?.startsWith?.('cine') ? M.reloj / 60 : M.reloj != null ? M.reloj / 60 : null, fps: G.fps + ' fps · ' + (G.render.gpu || G.render.backend) + ' · ' + CALIDADES[G.render.calidad].nombre });
    }
    if (G.escena === 'carga' && G.M && G.camCarga) G.camCarga(dtReal);   // X-K6: el título afina el detalle desde la toma del vuelo
    else if (G.escena === 'carga' && G.M && G.M.cam && G.M.jug) {
      const M = G.M; M.cam.actualizar(dtReal, M.jug.pos, { x: 0, y: 0 }, M.jug.p.col, M.jug.rumbo + Math.PI, false);
      G.render.seguirSol(new THREE.Vector3(M.jug.pos.x, M.jug.pos.y, M.jug.pos.z));
    }
    if (G.escena === 'juego' || G.escena === 'tarjeta' || G.escena === 'titulo' || G.escena === 'carga' || G.escena === 'cine') { if (G.M) await G.render.dibujar(); }
    // calidad automática: si el juego anda lento unos segundos, baja un nivel (Ultra → Media → Baja) y avisa
    if (G.escena === 'juego' && G.M && !G.pausa && !URLP.has('prueba')) {
      G.lento = G.fps && G.fps < (G.render.calidad === 'baja' ? 0 : 40) ? (G.lento || 0) + dtReal : 0;
      if (G.lento > 4) {
        const sig = { ultra: 'media', media: 'baja' }[G.render.calidad];
        if (sig) { G.render.ponerCalidad(sig); UI.aviso(`Calidad ajustada a ${CALIDADES[sig].nombre} para que el juego no se trabe`, 3500); try { localStorage.setItem('calidad3d', sig); } catch (e) { /* sin almacenamiento */ } }
        G.lento = 0;
      }
    }
    if (G.escena === 'titulo') { leerEntrada(); const t = E.texto.match(/NATO([1-4])$/); if (t) { E.texto = ''; J.dificultad = $('t-dif').value; jugar(+t[1], { sinTarjeta: false }); } }
  } catch (e) { console.error(e); UI.error(String(e.stack || e)); G.errores = (G.errores || 0) + 1; }
  requestAnimationFrame(bucle);
}
function cerrarApunte() { UI.cerrarModal(); }

function paso(M, dt) {
  if (M.paradaT > 0) { M.paradaT -= dt; return; }   // pausa de impacto
  M.t += dt; P.tiempo += dt;
  if (M.nieve) {   // los copos caen y el viento los arrastra; al salir de la caja vuelven arriba, siempre alrededor de la cámara
    const { p, n, viento, copos } = M.nieve, c = G.render.camara.position;
    for (let i = 0; i < n; i++) {
      const k = i * 3; p[k] += (viento + Math.sin(M.t + i) * 0.6) * dt; p[k + 1] -= (1.2 + (i % 7) * 0.15) * dt; p[k + 2] += Math.cos(M.t * 0.7 + i) * 0.4 * dt;
      if (p[k + 1] < -20) p[k + 1] += 40; if (p[k] > 40) p[k] -= 80; if (p[k] < -40) p[k] += 80; if (p[k + 2] > 40) p[k + 2] -= 80; if (p[k + 2] < -40) p[k + 2] += 80;
    }
    copos.position.copy(c); copos.geometry.attributes.position.needsUpdate = true;
    copos.visible = !M.salaActual;
  }
  if (M.tPuerta > 0) M.tPuerta -= dt;
  const j = M.jug;
  if (E.b.hercules.recien && j.estado === 'normal' && !M.memoria) llamarHercules(M, M.L);
  j.actualizar(dt, M.cam, M);
  M.fis.paso(dt);
  M.L.actualizar(dt);
  separar(M, dt);   // N0-C3: nadie atraviesa a nadie (juego/separacion.js)
  if (M.alActualizar) M.alActualizar(dt);
  revisarPuertas(M);
  paseoPaso(M, dt);   // N1-FORTUNA-PASEO: palanca de la vagoneta
  // zonas (cartel con el nombre del lugar)
  if (!M.salaActual) for (const z of M.R.zonas) {
    if (z.i > M.zonaVista && Math.hypot(j.pos.x - z.x, j.pos.z - z.z) < z.r) { M.zonaVista = z.i; const n = (M.def.zonas || [])[z.i]; if (n) UI.zona(n[1]); }
  }
  // reloj del Nivel 2: corre desde las 18:30; la función empieza a las 19:00
  if (M.reloj != null && !M.final) M.reloj += dt * 60 / DIF().reloj;
  // caídas: al barranco o al vacío
  if (j.estado !== 'fuera' && j.estado !== 'atrapado' && !M.final) {
    const alFondo = (!M.salaActual && M.peligro(j.pos) && j.pie < altura(j.pos.x, j.pos.z) + 3) || j.pie < (M.salaActual ? -30 : -120);
    if (alFondo) {
      if (!P.invencible) voz('pucha');   // N1-O3: con invencible no hay daño, ni aviso ni queja: solo vuelve a la orilla
      const r = caida(j);
      if (r === 'volver') { if (!P.invencible) UI.aviso('¡Pucha! -1 ♥'); volverASeguro(M); }
    }
  }
  if (j.estado === 'fuera') return;
}

arrancar();
