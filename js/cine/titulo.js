// X-K3 · Pantalla de título con Sewell 3D de fondo (carril cine): la plaza y la ciudad del N4 (desde X-K6 con pantalla de carga), la cámara gira lenta alrededor de la ciudad y el menú
// queda sobre una franja oscura a la izquierda, legible. Suena el tema «titulo». Con ?rapido=1 o ?sinFondo=1 no carga el fondo.
import * as THREE from 'three';
import { musica } from './musica.js';
import { altura } from '../mundo/terreno.js';
import { condorMalla } from '../mundo/mallas.js';

const URLP = new URLSearchParams(location.search);
let estilo = false;
function ponerEstilo() {
  if (estilo) return; estilo = true;
  const css = document.createElement('style');
  css.textContent = `#titulo.con-fondo{background:linear-gradient(90deg,rgba(11,9,16,.86) 0%,rgba(11,9,16,.72) 34%,rgba(11,9,16,.18) 62%,rgba(11,9,16,0) 80%);
 align-items:flex-start;justify-content:safe center;overflow-y:auto;padding-left:max(16px,6vw);text-align:left;transition:background 1s}
#titulo.con-fondo h1,#titulo.con-fondo h2,#titulo.con-fondo .nota{text-shadow:0 2px 4px #000}
#titulo.con-fondo .menu{background:rgba(20,12,6,.55);padding:14px;border-radius:14px;border:2px solid rgba(217,130,59,.5)}
#titulo.con-fondo .controles{max-width:min(600px,88vw);font-size:14px;line-height:1.4;opacity:.95;text-shadow:0 1px 3px #000}
@media (max-height:620px){#titulo.con-fondo h1{font-size:40px}#titulo.con-fondo h2{font-size:17px;margin:2px 0}#titulo.con-fondo .menu{gap:6px;padding:10px}#titulo.con-fondo .menu button,#titulo.con-fondo .menu select{font-size:16px;padding:5px 10px}#titulo.con-fondo .controles{font-size:13px}}
@media (max-width:700px){#titulo.con-fondo{align-items:center;padding-left:16px;text-align:center;background:rgba(11,9,16,.7)}}`;
  document.head.append(css);
}

// X-K6 (pedido de Diego, 14-11): antes el menú se veía mientras Sewell se armaba y los edificios aparecían de a poco. Ahora el
// mundo se carga con la pantalla de carga sobria del juego (barra real: modelos de Spark, sombreadores compilados y detalle
// afinado desde la primera toma del vuelo) y recién entonces se muestran el menú y el vuelo.
// X-K7: el vuelo nunca entra al cerro ni a un edificio: altura mínima sobre lo que haya debajo (fis.suelo = terreno, techos,
// muros) en un círculo de 12 m, mirando 4 y 8 s adelante para subir con tiempo, y línea de vista libre hacia la ciudad.
function crearVuelo(M, R) {
  // X-K9 (pedido de Diego, 14-11): planos generales desde el otro lado de la quebrada, con TODA la ciudad en cono sobre la ladera
  // (cerros nevados alrededor y el camino de acceso abajo), como menu_vista_lejana_referencia.png. Tres planos de 40 s con
  // fundido a negro entre ellos (SE, SO y E más alto); en cada uno la cámara órbita despacio y se aleja un poco. Nunca a menos
  // de ~270 m de un edificio. La ciudad queda hacia el centro-derecha (el objetivo se corre a la izquierda de la cámara)
  // para que el menú de la izquierda no la tape.
  const cam = R.camara, centro = new THREE.Vector3(0, 100, -245);
  const PLANOS = [   // az: grados desde el sur (+z) hacia el este (+x); r: distancia horizontal al centro; h: altura sobre el centro; todo [inicio, fin]
    { az: [26, 40], r: [520, 485], h: [75, 85], lado: 100 },
    { az: [-30, -46], r: [510, 475], h: [80, 90], lado: 100 },
    { az: [54, 68], r: [470, 440], h: [105, 112], lado: 90 },
  ];
  const DUR = 40, FUN = 1.2, cur = Math.PI / 180;
  const lerp = (v, u) => v[0] + (v[1] - v[0]) * u;
  const crudo = s => {
    s = Math.max(0, s); const i = Math.floor(s / DUR) % PLANOS.length, u0 = (s % DUR) / DUR, u = u0 * u0 * (3 - 2 * u0) * 0.35 + u0 * 0.65, P = PLANOS[i];
    const az = lerp(P.az, u) * cur, r = lerp(P.r, u);
    const pos = new THREE.Vector3(centro.x + Math.sin(az) * r, centro.y + lerp(P.h, u), centro.z + Math.cos(az) * r);
    const izq = new THREE.Vector3(-Math.cos(az), 0, Math.sin(az));   // a la izquierda de la cámara (mirando al centro)
    const mira = centro.clone().addScaledVector(izq, P.lado);   // la ciudad se ve a la derecha del centro de la imagen
    return { pos, mira };
  };
  const fundido = (() => {   // capa negra entre el mundo y el menú
    let d = document.getElementById('k9fundido');
    if (!d) { d = document.createElement('div'); d.id = 'k9fundido'; d.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none'; const t = document.getElementById('titulo'); t && t.parentNode ? t.parentNode.insertBefore(d, t) : document.body.append(d); }
    return d;
  })();
  const RAD = 12, MARGEN = 25, dir = new THREE.Vector3();
  const falta = s => {   // metros que hay que subir la toma del instante s para no tocar nada
    const { pos, mira } = crudo(s);
    let yMin = -Infinity;
    for (const [dx, dz] of [[0, 0], [RAD, 0], [-RAD, 0], [0, RAD], [0, -RAD], [RAD * 0.7, RAD * 0.7], [-RAD * 0.7, -RAD * 0.7], [RAD * 0.7, -RAD * 0.7], [-RAD * 0.7, RAD * 0.7]])
      yMin = Math.max(yMin, M.fis.suelo(pos.x + dx, pos.z + dz), altura(pos.x + dx, pos.z + dz));
    let f = Math.max(0, yMin + MARGEN - pos.y);
    for (let k = 0; k < 8; k++) {   // línea de vista libre (cerros) hasta 120 m antes del objetivo; lo de dentro de la ciudad no cuenta
      const p = pos.clone(); p.y += f; dir.subVectors(mira, p); const L = dir.length(); dir.divideScalar(L);
      const h = M.fis.rayo(p, dir, L, null, ['baranda']);
      if (!h || h.toi > L - 120) break;
      f += 6;
    }
    return f;
  };
  let t = 0, alza = 0, meta = 0, n = 0;
  const cuadro = (dt, fijo) => {
    t += dt;
    if (fijo || n++ % 8 === 0) meta = Math.max(falta(t + 4), falta(t + 8));   // adelantarse a lo que viene
    const ya = falta(t), obj = Math.max(meta, ya);
    alza = fijo ? obj : alza + (obj - alza) * (1 - Math.exp(-dt * (obj > alza ? 1.5 : 0.35)));
    if (alza < ya) alza = ya;   // nunca dentro de un sólido, aunque haya que subir de golpe
    const { pos, mira } = crudo(t); pos.y += alza;
    cam.position.copy(pos); cam.lookAt(mira);
    const u = t % DUR;   // fundido a negro al cambiar de plano (y al empezar)
    fundido.style.opacity = String(Math.max(0, t >= DUR ? 1 - u / FUN : 0, 1 - (DUR - u) / FUN));
    R.seguirSol(centro);
  };
  return {
    t: () => t, alza: () => alza, cuadro,
    irA(s) { t = s; cuadro(0, true); },   // pruebas: salta a s segundos del vuelo
    quitar() { fundido.remove(); },
  };
}

// X-K12 (pedido de Diego, 14-11; ajustado el mismo día: «demasiado lejos y pequeños»): cóndores andinos planeando sobre Sewell al fondo del menú.
// Una sola malla (condorMalla comparte el GLB; cada cóndor es un clon con esqueleto), precargada bajo la pantalla de carga. Envergadura ~3,5 m.
// Cada cóndor traza círculos lentos (térmica) cuyo centro va a un lado y delante de la cámara del plano (siempre a la derecha del centro de la
// imagen: el menú queda libre), por encima del horizonte de la cámara para que se recorte contra el cielo o la nieve. El más cercano
// pasa a ~25-65 m; los otros entre 55 y 130 m. Alabeo hacia adentro del giro, altura que sube y baja, aleteo ocasional (~3,5 s cada 31-53 s).
// Altura mínima 14 m sobre terreno/edificios (mirando 0, 3 y 6 s adelante) y nunca a menos de 12 m de la cámara.
function crearCondores(M, R) {
  const cam = R.camara;
  const DEF = [   // D: metros delante de la cámara; lado: a la derecha (+); R: radio; v: m/s; sube: sobre la cámara; dir: sentido del giro
    { D: 40, lado: 24, R: 20, v: 9, sube: -2, dir: 1, f: 0.4, alet: 31 },
    { D: 72, lado: 50, R: 30, v: 11, sube: -6, dir: -1, f: 2.2, alet: 37 },
    { D: 100, lado: 12, R: 36, v: 12, sube: 2, dir: 1, f: 4.0, alet: 43 },
    { D: 58, lado: 78, R: 26, v: 10, sube: -4, dir: -1, f: 5.3, alet: 53 },
  ];
  const cs = DEF.map((d, i) => {
    const g = condorMalla(1.17), yaw = new THREE.Group(); yaw.add(g); g.userData.condor.tocar('planeo');
    yaw.visible = false; M.escena.add(yaw);
    return { d, i, g, yaw, c: g.userData.condor, y: null, roll: 0, ult: null, cx: 0, cz: 0 };
  });
  const listo = Promise.all(cs.map(o => o.c.listo)).then(() => { for (const o of cs) o.g.traverse(m => { if (m.isMesh) m.castShadow = false; }); });
  const p = new THREE.Vector3(), q = new THREE.Vector3(), f = new THREE.Vector3(), fw = new THREE.Vector3();
  const pos = (o, t, out) => {   // posición horizontal en el instante t: círculo (óvalo suave) alrededor del centro actual
    const d = o.d, w = d.dir * d.v / d.R, a = d.f + w * t;
    return out.set(o.cx + Math.cos(a) * d.R * (1 + 0.1 * Math.sin(t * 0.021 + d.f)), 0, o.cz + Math.sin(a) * d.R * (1 - 0.1 * Math.sin(t * 0.017 + d.f)));
  };
  const piso = (x, z) => Math.max(altura(x, z), M.fis.suelo(x, z, 700));
  let n = 0;
  const cuadro = (dt, t) => {
    n++;
    cam.getWorldDirection(fw); fw.y = 0; if (fw.lengthSq() < 1e-6) fw.set(0, 0, 1); fw.normalize();
    for (const o of cs) {
      const d = o.d, vivo = 1 + 0.12 * Math.sin(t * 0.05 + d.f);
      o.cx = cam.position.x + fw.x * d.D * vivo - fw.z * d.lado; o.cz = cam.position.z + fw.z * d.D * vivo + fw.x * d.lado;
      pos(o, t, p);
      const base = cam.position.y + d.sube + 4 * Math.sin(t * 0.11 + d.f) + 2 * Math.sin(t * 0.27 + d.f * 3);   // sube y baja en la térmica
      if (o.y == null || n % 6 === 0) {   // altura mínima: mira 0, 3 y 6 s adelante y sube con tiempo
        let m = -1e9; for (const s of [0, 3, 6]) { pos(o, t + s, q); m = Math.max(m, piso(q.x, q.z) + 14); }
        o.meta = Math.max(base, m);
        if (o.y == null) o.y = o.meta;
      }
      o.y += (o.meta - o.y) * (1 - Math.exp(-dt * (o.meta > o.y ? 1.2 : 0.5)));
      p.y = Math.max(o.y, piso(p.x, p.z) + 12);
      const dc = p.distanceTo(cam.position);   // nunca tapar ni rozar la cámara
      if (dc < 12) { f.subVectors(p, cam.position); if (f.lengthSq() < 1e-4) f.set(1, 0, 0); f.y = Math.abs(f.y) + 2; f.setLength(12); p.copy(cam.position).add(f); }
      pos(o, t + 0.5, q); const vx = q.x - p.x, vz = q.z - p.z;   // rumbo = tangente del círculo
      const yaw = Math.atan2(vx, vz), w = d.dir * d.v / d.R;
      o.yaw.position.copy(p); o.yaw.rotation.y = yaw;
      const alabeo = THREE.MathUtils.clamp(-Math.sign(w) * (Math.atan(Math.abs(w) * d.v / 9.81) * 2.1 + 0.07 * Math.sin(t * 0.9 + d.f)), -0.6, 0.6);
      o.roll += (alabeo - o.roll) * (1 - Math.exp(-dt * 2));
      o.g.rotation.z = o.roll; o.g.rotation.x = 0.03 * Math.sin(t * 0.6 + d.f);
      const ciclo = (t + d.f * 9) % d.alet, bate = ciclo < 3.5;   // aleteo ocasional
      o.c.tocar(bate ? 'aleteo' : 'planeo', bate ? 0.8 : 0.5);
      o.c.actualizar(o.ult == null ? 0 : dt); o.ult = t;
      o.yaw.visible = true;
    }
  };
  return { listo, cuadro, lista: cs, quitar() { for (const o of cs) o.yaw.removeFromParent(); } };
}

// ctx: { G, crearMundo, NIVELES, limpiarMundo, pantallaCarga }. Devuelve una promesa que termina cuando el fondo está listo (o se descarta).
export function fondoTitulo(ctx) {
  const { G } = ctx;
  musica('titulo');
  if (URLP.has('rapido') || URLP.has('sinFondo')) return Promise.resolve();
  ponerEstilo();
  const token = (G.tokenTitulo = (G.tokenTitulo || 0) + 1);
  const N4 = ctx.NIVELES[4];
  const fijos = new Set(['edificio', 'escalera', 'plaza', 'via', 'anden', 'roca', 'escenario', 'cajas', 'repisa', 'rieles']);
  const def = { ...N4, nombre: 'Título', elementos: N4.elementos.filter(e => fijos.has(e.t)), salas: [], ruta: [[0, -300]] };
  const menu = document.getElementById('titulo');
  const p = (async () => {
    let vuelo = null;
    const construir = async () => {
      const M = await ctx.crearMundo(def, { lento: true, inicio: { x: 0, z: -300, rumbo: 0 } });
      M.jug.malla.visible = false; M.esTitulo = true;
      vuelo = crearVuelo(M, G.render);
      const co = crearCondores(M, G.render); await co.listo;   // X-K12: precarga bajo la pantalla de carga
      vuelo.condores = co; const cuadroV = vuelo.cuadro, irAV = vuelo.irA;
      vuelo.cuadro = (dt, fijo) => { cuadroV(dt, fijo); co.cuadro(dt, vuelo.t()); };
      vuelo.irA = s => { irAV(s); co.cuadro(0, s); };
      vuelo.quitarC = co.quitar;
      G.camCarga = () => vuelo.cuadro(0, true);   // la carga afina el detalle desde la primera toma del vuelo
      return M;
    };
    let M;
    if (ctx.pantallaCarga) {
      menu.classList.add('oculto');
      try { M = await ctx.pantallaCarga('Sewell y su Historia en 3D', 'La ciudad de las escaleras', construir, true); }
      finally { G.camCarga = null; if (G.tokenTitulo === token) menu.classList.remove('oculto'); }
    } else M = await construir();
    if (G.tokenTitulo !== token || (G.escena !== 'titulo' && G.escena !== 'carga')) return;   // el jugador ya salió: jugar() limpia este mundo
    G.escena = 'titulo';
    menu.classList.add('con-fondo');
    G.vueloTitulo = vuelo;   // pruebas: G.vueloTitulo.t()/alza()
    let ultimo = performance.now();
    const giro = ahora => {
      if (G.escena !== 'titulo' || G.M !== M) return;
      vuelo.cuadro(Math.max(0, Math.min(0.1, (ahora - ultimo) / 1000))); ultimo = ahora;
      requestAnimationFrame(giro);
    };
    requestAnimationFrame(giro);
  })().catch(e => { console.warn('fondo del título', e); menu.classList.remove('oculto'); if (G.escena === 'carga' && G.tokenTitulo === token) G.escena = 'titulo'; });
  G.cargandoTitulo = p;
  return p;
}
// al salir del título (Jugar): espera a que termine de cargar el fondo y lo limpia
export async function salirTitulo(ctx) {
  const { G } = ctx;
  G.tokenTitulo = (G.tokenTitulo || 0) + 1;
  document.getElementById('titulo')?.classList.remove('con-fondo');
  if (G.cargandoTitulo) { try { await G.cargandoTitulo; } catch (e) { /* nada */ } G.cargandoTitulo = null; }
  document.getElementById('k9fundido')?.remove();
  if (G.vueloTitulo && G.vueloTitulo.quitarC) G.vueloTitulo.quitarC();
  if (G.M && G.M.esTitulo) ctx.limpiarMundo();
}
