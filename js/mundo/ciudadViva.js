// N0-CIUDAD-VIVA (15-11-2026, carril animador; pedido de Diego: «con estas fotos crea NPC que hagan una ciudad viva, inspírate en
// sus ropas y actividades»). Gente de época (capturas/referencias_diego/ciudad_viva/) en N2 (1920), N3 (1940) y N4 (1967): sube y
// baja la escalera central pisando los peldaños reales, conversa en grupos en las plazas y frente a la pulpería, el club, el hospital
// y la estación, niños que comen pan y juegan, y un cortejo de matrimonio que baja por la escalera (N3 y N4) cada ~2,5 min.
// Solo ambiente: no reemplaza enemigos ni NPC con diálogo. Mallas: blender/ciudad_malla.py → assets3d/anim/ciudad (js/motor/mallaCiudad.js).
// Rendimiento (iGPU): malla alta < 16 m, baja más lejos; animación cada cuadro < 30 m, cada 2 < 60 m, cada 4 < 95 m; invisible más lejos.
// URL: ?ciudadviva=0 la apaga · &boda=1 lanza el cortejo enseguida · &cvinfo=1 escribe en consola el reparto.
import * as THREE from 'three';
import { cargarTipo, crearPersona } from '../motor/mallaCiudad.js';
import { lugaresDelNivel } from './irLugar.js';

const URLP = new URLSearchParams(location.search);
// tipos aprobados en el control de calidad (capturas/vida/ciudadviva/hoja_<id>.jpg). Solo estos entran al juego.
// 15-11 (relevo): 8 aprobados en hoja (capturas/vida/ciudadviva/hoja_<id>.jpg); descartados en assets3d/anim/ciudad/_excluidas/
export const APROBADOS = new Set(['oficinista', 'joven', 'nino2', 'novia', 'invitado', 'gringo', 'obrero2', 'obrero20', 'musico2', 'senora', 'gringo2', 'abuela', 'musico5', 'musico6', 'cura', 'nino1', 'senora20', 'nino20', 'madre', 'muchacha', 'nina']);   // 3.er relevo: + musico2 (solo banda), senora y gringo2 (semilla 17); 16-11: + abuela, musico5 y musico6 (s23; músicos solo banda), cura (s29, solo boda); 16-11 noche: + nino1 (s31) y senora20 (s31), Edit 2509 solo estilo (capturas/vida/ciudadviva/mujeres1611/); 16-11 madrugada: + nino20 (s47, HORNEAR=0, solo N2 de 1920); muchacha, nina, madre e invitada descartadas tras 3 semillas (hojas *_DESCARTADA.jpg); 16-11 mañana: + madre (s31), muchacha (s43) y nina (s47) con FALDA DE CÓDIGO (js/motor/faldaCodigo.js: torso TRELLIS, falda, medias y zapatos en código; hojas capturas/vida/ciudadviva/falda1611/); invitada sigue descartada
// ropa por época: qué tipos salen en cada nivel (si no están aprobados, no salen)
const POR_EPOCA = {
  2: { adultos: ['senora20', 'abuela', 'madre', 'obrero20', 'oficinista', 'gringo2', 'joven', 'invitado'], ninos: ['nino20', 'nina', 'nino2'], jefes: ['gringo2', 'gringo'], obreros: ['obrero20'] },
  3: { adultos: ['oficinista', 'senora', 'abuela', 'madre', 'muchacha', 'joven', 'obrero1', 'obrero2', 'invitada', 'invitado', 'gringo'], ninos: ['nino1', 'nina', 'nino2'], jefes: ['gringo', 'gringo2'], obreros: ['obrero1', 'obrero2'] },
  4: { adultos: ['oficinista', 'senora', 'abuela', 'madre', 'muchacha', 'joven', 'obrero1', 'obrero2', 'invitada', 'invitado', 'gringo'], ninos: ['nino1', 'nina', 'nino2'], jefes: ['gringo', 'gringo2'], obreros: ['obrero1', 'obrero2'] },
};
// actividad típica de cada tipo (capa de brazos + accesorio): el oficinista lee el diario, la señora lleva cartera o bolsa de la pulpería…
const CAPA = { oficinista: ['b_diario'], senora: ['b_cartera', 'b_bolsa'], senora20: ['b_bolsa', 'b_cartera'], abuela: ['b_bolsa', 'b_cartera'], invitada: ['b_cartera'], joven: ['b_bolsa'],
  nino1: ['b_pan'], nino2: ['b_pan'], nino20: ['b_pan'], nina: ['b_pan', null], madre: ['b_bolsa', 'b_pan'], muchacha: ['b_cartera', null], obrero1: ['b_bolsa'], obrero2: ['b_bolsa'], obrero20: ['b_bolsa'], gringo: ['b_bolsillo'], gringo2: [null], invitado: [null], padrino: [null] };
const PROP = { joven: 'botella', obrero1: 'lonchera', obrero2: 'lonchera', obrero20: 'lonchera' };
const BODA = ['novia', 'padrino', 'dama', 'invitado', 'invitada', 'gringo', 'oficinista', 'senora'];

const rnd = (a, b) => a + Math.random() * (b - a), elegir = l => l[Math.floor(Math.random() * l.length)];
const angDif = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

export async function ciudadViva(M, def) {
  const N = def.numero, ep = POR_EPOCA[N]; if (!ep || URLP.get('ciudadviva') === '0') return null;
  const ok = l => l.filter(t => APROBADOS.has(t) || URLP.has('cvtodos'));
  const tiposNivel = new Set([...ok(ep.adultos), ...ok(ep.ninos), ...ok(ep.jefes), ...ok(ep.obreros), ...(N === 4 ? ok(BODA) : [])]);   // N0-FABLE-1611 (C2): cortejo nupcial solo en N4 (en el N3 de 1945, «tragedia sin celebración»)
  if (!tiposNivel.size) return null;
  const T = {};
  await Promise.all([...tiposNivel].map(id => cargarTipo(URLP.has('cvprueba') ? (URLP.get('cvprueba') || 'prueba_medico') : id).then(t => { T[id] = t; }).catch(e => console.warn('ciudad viva: sin', id, e.message))));
  const hay = l => l.filter(t => T[t]);
  const adultos = hay(ok(ep.adultos)), ninos = hay(ok(ep.ninos)), jefes = hay(ok(ep.jefes)), obreros = hay(ok(ep.obreros));
  const todos = [...adultos, ...ninos]; if (!todos.length) return null;
  const raiz = new THREE.Group(); raiz.name = 'ciudadViva'; M.escena.add(raiz);
  const gente = [];
  const nueva = (tipo, op = {}) => {
    const capa = op.capa !== undefined ? op.capa : elegir(CAPA[tipo] || [null]);
    const p = crearPersona(T[tipo], { anim: op.anim || 'idle', capa, prop: PROP[tipo] });
    const q = { tipo, p, capa, x: 0, y: 0, z: 0, rumbo: 0, cuadro: Math.floor(Math.random() * 4), ...op };
    raiz.add(p.g); gente.push(q); return q;
  };
  // ---------------------------------------------------------------- escalera central: suben y bajan pisando los peldaños
  const tramos = Object.entries(M.R.escaleras).filter(([, e]) => Math.abs(e.a.x) < 1 && Math.abs(e.b.x) < 1).map(([id, e]) => {
    const H = Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z), n = Math.max(2, Math.round(H / 0.32));
    return { id, a: e.a, b: e.b, ancho: e.ancho, H, n, g: H / n, ux: (e.b.x - e.a.x) / H, uz: (e.b.z - e.a.z) / H };
  });
  // punto del tramo a s metros (horizontal) desde el pie, con desplazamiento lateral: y = rampa (los peldaños quedan r/2 sobre ella, como en la animación)
  // + tr.dy: altura de la superficie DIBUJADA sobre la rampa (medida con rayos, medirTramos). En N3 el tramo2 lo cubre una rampa lisa de
  // nieve 0,26 m sobre la física (de otro carril): ahí la gente camina (sin peldaños a la vista) a esa altura en vez de hundirse
  const enTramo = (tr, s, lat) => ({ x: tr.a.x + tr.ux * s - tr.uz * lat, z: tr.a.z + tr.uz * s + tr.ux * lat, y: tr.a.y + (tr.b.y - tr.a.y) * (s / tr.H) + (tr.dy || 0) });
  // TIRONES-MOVIL (17-11-2026): era UNA tarea de ~5 s en el celular (CPU 4x) y ~1,2 s en PC: los rayos chocaban contra el terreno entero
  // (su esfera toca todos los tramos; sin BVH se prueba triángulo por triángulo). Ahora es un generador que avanza de a pocos ms por cuadro
  // (ver act) y no prueba terreno, cordillera ni mallas gigantes (> 250 m de radio): la superficie dibujada de la escalera es otra malla
  const medirTramos = function* () {   // una vez (y otra a los ~30 s, por si la malla de nieve llega tarde): ~1 rayo cada 3 m por tramo
    const rc = new THREE.Raycaster(), o = new THREE.Vector3(), abajo = new THREE.Vector3(0, -1, 0); rc.far = 4; rc.camera = M.cam && M.cam.cam;
    const nuestra = ob => { for (let x = ob; x; x = x.parent) if (x === raiz) return true; return false; };
    // cierre 15-11: los rayos contra TODA la escena tomaban ~3 s (tirón a los 6 y 30 s); ahora solo contra las mallas cuya esfera toca el tramo
    const cerca = [], _s = new THREE.Sphere(), _c = new THREE.Vector3();
    M.escena.traverse(ob => {
      if (!ob.isMesh || ob.isSprite || !ob.visible || nuestra(ob) || !ob.geometry || !ob.geometry.attributes || !ob.geometry.attributes.position || ob.name === 'terreno' || ob.name === 'cordillera' || ob.name === 'cielo') return;
      const bs = ob.isInstancedMesh ? (ob.boundingSphere || (ob.computeBoundingSphere(), ob.boundingSphere)) : (ob.geometry.boundingSphere || (ob.geometry.computeBoundingSphere(), ob.geometry.boundingSphere));
      if (!bs) return; _s.copy(bs).applyMatrix4(ob.matrixWorld); _c.copy(_s.center); if (_s.radius > 250) return;
      if (tramos.some(tr => { const s = Math.max(0, Math.min(tr.H, (_c.x - tr.a.x) * tr.ux + (_c.z - tr.a.z) * tr.uz)), px = tr.a.x + tr.ux * s, pz = tr.a.z + tr.uz * s, py = tr.a.y + (tr.b.y - tr.a.y) * s / tr.H;
        return Math.hypot(_c.x - px, _c.z - pz) < _s.radius + tr.ancho && Math.abs(_c.y - py) < _s.radius + 4; })) cerca.push(ob);
    });
    for (const tr of tramos) {
      const v = [];
      for (let s = 1.5; s < tr.H - 1; s += 3) {
        const P = { x: tr.a.x + tr.ux * s, z: tr.a.z + tr.uz * s, y: tr.a.y + (tr.b.y - tr.a.y) * (s / tr.H) };
        rc.set(o.set(P.x, P.y + 2, P.z), abajo);
        const h = rc.intersectObjects(cerca, false).find(i => i.object.isMesh && !i.object.isSprite && i.object.visible && !nuestra(i.object) && !(i.object.material && i.object.material.transparent && i.object.material.opacity < 0.3));
        if (h) v.push(h.point.y - P.y);
        yield;
      }
      if (v.length < 4) continue;
      const med = v.reduce((a, b) => a + b, 0) / v.length, desv = Math.sqrt(v.reduce((a, b) => a + (b - med) ** 2, 0) / v.length);
      tr.liso = desv < 0.025 && med > 0.08;   // sin dientes de sierra = no se ven peldaños (los peldaños dan 0,05-0,22)
      tr.dy = tr.liso ? med : 0;
    }
    if (URLP.has('cvinfo')) console.log('ciudad viva: tramos', tramos.map(t => t.id + (t.liso ? ' liso +' + t.dy.toFixed(2) : ' peldaños')).join(', '));
  };
  let medidas = 0, vivo = 0, midiendo = null;
  // cierre 15-11 (escalera concurrida): antes 8/8/6 personas en tramos de 104-134 m (1 cada ~13 m): la cámara, que mira hacia abajo a Nato,
  // ve ~20-25 m de escalera y casi nunca había alguien. Ahora 1 cada ~6 m (16-22 por tramo); se dibujan igual solo las MAX más cercanas.
  tramos.forEach((tr, i) => {
    const cuantas = URLP.has('cvesc') ? +URLP.get('cvesc') : M.calidad === 'movil' ? Math.max(4, Math.min(9, Math.round(tr.H / 14))) /* MOVIL: menos gente (cada persona son ~75 huesos que se recalculan aunque no se dibuje) */ : Math.max(6, Math.min(22, Math.round(tr.H / 6)));
    for (let k = 0; k < cuantas; k++) {
      const nino = ninos.length && Math.random() < 0.22, tipo = nino ? elegir(ninos) : elegir(Math.random() < 0.3 && obreros.length ? obreros : adultos);
      const sube = Math.random() < 0.5;
      nueva(tipo, { modo: 'escalera', tr, sube, s: rnd(4, tr.H - 4), lat: (sube ? 1 : -1) * rnd(0.8, tr.ancho / 2 - 0.7), v: nino ? rnd(0.6, 0.75) : tipo === 'oficinista' ? rnd(0.38, 0.45) : rnd(0.45, 0.6), espera: 0 });
    }
  });
  // ---------------------------------------------------------------- grupos que conversan (plazas, pulpería, club, hospital, estación, cine)
  const lugares = lugaresDelNivel(def);
  const sueloEn = (x, z, yRef) => { const h = M.fis.rayo({ x, y: (yRef ?? 400) + 3, z }, { x: 0, y: -1, z: 0 }, yRef != null ? 8 : 900); return h ? h.punto.y : null; };
  const libre = (x, z, y) => {   // sin muros a 0,7 m, suelo parejo y sin techo encima
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; if (M.fis.rayo({ x, y: y + 1, z }, { x: Math.sin(a), y: 0, z: Math.cos(a) }, 0.7)) return false; }
    if (M.fis.rayo({ x, y: y + 0.3, z }, { x: 0, y: 1, z: 0 }, 5)) return false;
    for (const [dx, dz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) { const v = sueloEn(x + dx, z + dz, y); if (v == null || Math.abs(v - y) > 0.25) return false; }
    return true;
  };
  const grupo = (cx, cz, tiposG, yRef) => {
    const y0 = sueloEn(cx, cz, yRef); if (y0 == null || !libre(cx, cz, y0)) return 0;
    const n = tiposG.length, r = n <= 2 ? 0.55 : 0.85; let puestos = 0;
    tiposG.forEach((tipo, i) => {
      const a = i / n * Math.PI * 2 + rnd(-0.2, 0.2), x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, y = sueloEn(x, z, y0);
      if (y == null || Math.abs(y - y0) > 0.3) return;
      const capas = (CAPA[tipo] || [null]).filter(c => c !== 'b_diario' && c !== 'b_pan'), capa = Math.random() < 0.5 || !capas.length ? null : elegir(capas);   // conversando: sin diario ni pan
      nueva(tipo, { modo: 'grupo', x, y, z, rumbo: Math.atan2(cx - x, cz - z), capa, fase: rnd(0, 6) }); puestos++;
    });
    return puestos;
  };
  const frente = (l, d) => ({ x: l.x + l.nx * d, z: l.z + l.nz * d });
  const plazas = def.elementos.filter(e => e.t === 'plaza' && e.y != null && Math.abs(e.x) < 20);
  const mezcla = k => Array.from({ length: k }, () => elegir(Math.random() < 0.25 && ninos.length ? ninos : adultos));
  for (const pl of plazas) {   // 3 grupos por plaza, a los lados de la escalera (la franja central queda libre para pasar)
    for (const lado of [-1, 1]) grupo(pl.x + lado * rnd(9, Math.min(pl.sx / 2 - 6, 22)), pl.z + rnd(-pl.sz / 4, pl.sz / 4), mezcla(Math.random() < 0.5 ? 2 : 3), pl.y);
    if (ninos.length >= 1) {   // niños jugando
      const x = pl.x + elegir([-1, 1]) * rnd(12, Math.min(pl.sx / 2 - 5, 20)), z = pl.z + rnd(-pl.sz / 5, pl.sz / 5), y = sueloEn(x, z, pl.y);
      if (y != null && libre(x, z, y)) for (let k = 0; k < 2; k++) nueva(elegir(ninos), { modo: 'juego', cx: x, cz: z, y, x: x + (k ? 1.2 : -1.2), z, ang: k * Math.PI, capa: null, t: rnd(0, 5) });
    }
  }
  const PUERTAS = { pulperia: () => mezcla(3), club: () => hay(jefes).length ? [elegir(jefes), elegir(jefes), elegir(adultos)] : mezcla(2),
    hospital: () => mezcla(2), estacion: () => obreros.length ? [elegir(obreros), elegir(obreros), elegir(obreros)] : mezcla(3), cine: () => mezcla(3),
    escuela: () => mezcla(2), iglesia: () => mezcla(2), correos: () => mezcla(2) };
  for (const l of lugares) {
    const f = PUERTAS[l.id] || (/camarote/.test(l.id) && Math.random() < 0.35 ? () => mezcla(2) : null); if (!f) continue;
    if (l.id === 'estacion') { grupo(l.x + rnd(-6, 6), 15.6, f(), null); continue; }   // N0-FABLE-1611 (M16): sobre la losa del andén (z 13-18), no en el balasto de la vía (z 22)
    for (const d of [6, 8, 10]) { const p = frente(l, d); if (grupo(p.x + rnd(-2, 2), p.z + rnd(-2, 2), f(), null)) break; }
  }
  // ---------------------------------------------------------------- cortejo de matrimonio (N3, N4): baja por la escalera central
  const boda = { activa: false, prox: URLP.has('boda') ? 3 : 25, miembros: [] };
  const lanzarBoda = () => {
    const j = M.jug.pos; if (Math.abs(j.x) > 45) return false;
    let tr = null, sj = 0;   // el tramo más cercano a Nato y su avance (s desde arriba)
    for (const t of tramos) { const s = (j.x - t.a.x) * t.ux + (j.z - t.a.z) * t.uz; const sc = Math.max(0, Math.min(t.H, s)), p = enTramo(t, sc, 0), d = Math.hypot(p.x - j.x, p.z - j.z) + Math.abs(p.y - j.y);
      if (!tr || d < sj.d) { tr = t; sj = { d, s: t.H - sc }; } }
    if (!tr || sj.d > 70) return false;
    const s0 = Math.max(8, sj.s - 30);   // empieza ~30 m arriba de Nato y pasa a su lado
    const novio = T.padrino ? 'padrino' : 'invitado';   // 3.er relevo: sin padrino aprobado, el novio es el invitado de terno (y gringo2 ocupa su lugar)
    const filas = [[['dama', -0.6], ['dama', 0.6]], [['novia', 0.45], [novio, -0.45]], [['invitada', 0.7], [novio === 'invitado' ? 'gringo2' : 'invitado', -0.7]], [['senora', 0.8], ['gringo', -0.8]], [['oficinista', 0.2]]];
    filas.forEach((fila, k) => fila.forEach(([tipo, lat]) => {
      if (!T[tipo]) return;
      const capa = tipo === 'novia' || tipo === 'dama' ? 'b_ramo' : tipo === novio && novio === 'padrino' ? 'b_brazo' : tipo === 'invitada' || tipo === 'senora' ? 'b_cartera' : null;
      boda.miembros.push(nueva(tipo, { modo: 'escalera', tr, sube: false, s: s0 - k * 1.6, lat: lat - 1.2, v: 0.42, boda: true, capa }));
    }));
    boda.activa = boda.miembros.length > 0; return boda.activa;
  };
  // ---------------------------------------------------------------- cada cuadro
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _esf = new THREE.Sphere(new THREE.Vector3(), 1.3);
  const MAX = +(URLP.get('cvmax') || (M.calidad === 'movil' ? 10 : 14));   // MOVIL: 10 dibujadas a la vez en el celular
  const VENTANA = +(URLP.get('cvventana') || 14);   // personas en la escalera a ±40 m de Nato (cierre 15-11)   // personas dibujadas a la vez como máximo (las más cercanas a la cámara)
  let cuadro = 0;
  const e = M.L.agregar({ tipo: 'ciudadviva', vivo: true, sala: null, act(dt) {
    cuadro++; const t0 = performance.now();
    vivo += dt; if ((medidas === 0 && vivo > 6) || (medidas === 1 && vivo > 30)) { medidas++; midiendo = medirTramos(); }
    if (midiendo) { const tm = performance.now(); while (performance.now() - tm < 4) if (midiendo.next().done) { midiendo = null; break; } }   // TIRONES-MOVIL: ≤ 4 ms por cuadro
    const dentro = !!M.salaActual || !!M.ciudadViva.apagada; if (raiz.visible === dentro) raiz.visible = !dentro;   // apagada: pruebas de fps (A/B en la misma página)
    if (dentro) return;
    const j = M.jug.pos, cam = M.cam && M.cam.cam ? M.cam.cam.position : j;
    if (N === 4 && !boda.activa && (boda.prox -= dt) <= 0) { if (!lanzarBoda()) boda.prox = 5; }
    let fr = null; const cc = M.cam && M.cam.cam;
    if (cc) { cc.updateMatrixWorld(); _pm.multiplyMatrices(cc.projectionMatrix, cc.matrixWorldInverse); fr = _fr.setFromProjectionMatrix(_pm); }
    // cierre 15-11 (escalera concurrida): la cámara mira hacia abajo a Nato y ve ~20-25 m de escalera; con la gente repartida en 344 m de
    // tramos casi nunca había alguien cerca. Cada 8 cuadros, si en el tramo de Nato hay menos de VENTANA personas a ±40 m, una persona de la
    // escalera lejana (> 70 m y oculta) reaparece a 12-36 m de Nato caminando HACIA él (arriba baja, abajo sube), FUERA del cuadro de la cámara (no se ve aparecer).
    if (cuadro % 8 === 0 && !URLP.has('cvsinventana')) {
      let trN = null, sN = 0, dN = 1e9;
      for (const t of tramos) { const s0 = Math.max(0, Math.min(t.H, (j.x - t.a.x) * t.ux + (j.z - t.a.z) * t.uz)), p0 = enTramo(t, s0, 0), d0 = Math.hypot(p0.x - j.x, p0.z - j.z) + Math.abs(p0.y - j.y); if (d0 < dN) { dN = d0; trN = t; sN = s0; } }
      if (trN && dN < 12) {
        const pos = q => q.sube ? q.s : trN.H - q.s, esc = gente.filter(q => q.modo === 'escalera' && !q.boda);
        const cerca = esc.filter(q => q.tr === trN && Math.abs(pos(q) - sN) < 40).length;
        if (cerca < VENTANA) {
          const lejos = esc.find(q => !q.p.g.visible && (q.d ?? 1e9) > 70);
          if (lejos) {
            const arriba = Math.random() < 0.5, sv = sN + (arriba ? 1 : -1) * rnd(12, 36);
            if (sv > 3 && sv < trN.H - 3) {
              // arriba de Nato baja hacia él y abajo sube hacia él: los dos cruzan el cuadro de la cámara
              const sube = !arriba, lat = (sube ? 1 : -1) * rnd(0.8, trN.ancho / 2 - 0.7), P = enTramo(trN, sv, lat);
              _esf.center.set(P.x, P.y + 0.9, P.z);
              if (!fr || !fr.intersectsSphere(_esf)) { lejos.tr = trN; lejos.sube = sube; lejos.s = sube ? sv : trN.H - sv; lejos.lat = lat; lejos.espera = 0; lejos.x = P.x; lejos.y = P.y; lejos.z = P.z; }
            }
          }
        }
      }
    }
    const cand = [];
    for (let i = gente.length - 1; i >= 0; i--) {
      const q = gente[i], p = q.p, g = p.g;
      // --- lógica (barata, siempre)
      let anim = 'idle', capa = q.capa, fase = null, vel = 1;
      if (q.modo === 'escalera') {
        const tr = q.tr, dir = q.sube ? 1 : -1;   // q.s: recorrido desde donde empezó (pie si sube, cima si baja)
        const pos = enTramo(tr, q.sube ? q.s : tr.H - q.s, q.lat), dx = pos.x - j.x, dz = pos.z - j.z, dn = Math.hypot(dx, dz), dy = Math.abs(M.jug.pie - pos.y);
        // evasión de Nato: si está delante en el carril, se corre de carril y frena; muy cerca, se detiene
        const fx = tr.ux * dir, fz = tr.uz * dir, delante = -(dx * fx + dz * fz), latJ = -(j.x - tr.a.x) * tr.uz + (j.z - tr.a.z) * tr.ux;
        let frena = 1;
        if (dy < 2.5 && delante > -0.3 && delante < 2.4 && Math.abs(latJ - q.lat) < 1.1) { frena = delante < 1 ? 0 : 0.4; q.lat += (Math.sign(q.lat - latJ) || 1) * dt * 0.9; }
        q.lat = Math.max(-tr.ancho / 2 + 0.6, Math.min(tr.ancho / 2 - 0.6, q.lat));
        if (dn < 0.75 && dy < 1.8) { const k = (0.75 - dn) * 30 * dt / Math.max(dn, 0.05); M.jug.vel.x -= dx * k; M.jug.vel.z -= dz * k; }
        if (q.espera > 0) { q.espera -= dt; anim = q.charla ? 'hablar' : 'idle'; }
        else if (frena === 0) anim = 'idle';
        else {
          q.s += q.v * frena * dt;
          if (q.s >= tr.H - 0.5) {
            if (q.boda) { q.p.g.removeFromParent(); gente.splice(i, 1); boda.miembros = boda.miembros.filter(m => m !== q); if (!boda.miembros.length) { boda.activa = false; boda.prox = rnd(140, 180); } continue; }
            q.sube = !q.sube; q.s = 0.5; q.lat = -q.lat; q.espera = rnd(3, 9); q.charla = Math.random() < 0.4;
          }
          if (tr.liso) { anim = 'caminar'; vel = q.v * frena / (p.vel.caminar || 0.7); }   // rampa lisa (nieve): camina
          else { anim = q.sube ? 'subir' : 'bajar'; fase = ((q.s / tr.g) - 1.8) / 2; }   // = herramientas/ciudad_qc.html y blender/ciudad_malla.py escalera()
        }
        // cierre 15-11: quieto (descanso, charla o frenado por Nato) sobre la huella del peldaño: antes quedaba a la altura de la rampa y el
        // borde del peldaño de delante le tapaba las canillas (en la hoja «zapatos sueltos» bajo las piernas)
        const quieto = (anim === 'idle' || anim === 'hablar') && !tr.liso; let sv = q.sube ? q.s : tr.H - q.s;
        if (quieto) sv = Math.max(0, Math.min(tr.H, (Math.floor(sv / tr.g) + 0.5) * tr.g));
        const P = enTramo(tr, sv, q.lat); if (quieto) P.y += (tr.b.y - tr.a.y) / tr.n / 2; q.x = P.x; q.y = P.y; q.z = P.z;
        q.rumbo = Math.atan2(tr.ux * (q.sube ? 1 : -1), tr.uz * (q.sube ? 1 : -1));
        if (q.espera > 0) q.rumbo += q.sube ? Math.PI : 0;   // en el descanso mira hacia donde volverá
      } else if (q.modo === 'grupo') {
        const dJ = Math.hypot(q.x - j.x, q.z - j.z);
        if (dJ < 0.7 && Math.abs(M.jug.pie - q.y) < 1.8) { const k = (0.7 - dJ) * 30 * dt / Math.max(dJ, 0.05); M.jug.vel.x -= (q.x - j.x) * k; M.jug.vel.z -= (q.z - j.z) * k; }
        anim = Math.sin(M.t * 0.6 + q.fase) > 0.35 ? 'hablar' : 'idle';
      } else if (q.modo === 'juego') {   // niños: saltan a la rayuela y a ratos se persiguen en círculo
        q.t += dt; const corre = !p.falda && Math.sin(q.t * 0.35) > 0.3;   // 16-11: la niña de falda (de código) no corre: al correr la pierna de atrás la levantaba como cometa
        if (corre) { q.ang += dt * 1.1; q.x = q.cx + Math.sin(q.ang) * 2.2; q.z = q.cz + Math.cos(q.ang) * 2.2; q.rumbo = q.ang + Math.PI / 2; anim = 'correr'; vel = (1.1 * 2.2) / (p.vel.correr || 3); }
        else anim = 'jugar';
        q.y = q.y ?? 0;
      }
      // --- candidatos a dibujarse: a < 95 m y dentro del cuadro de la cámara (esfera de 1,3 m)
      q.d = Math.hypot(q.x - cam.x, q.z - cam.z) + Math.abs(q.y - cam.y) * 0.5; q.anim = anim; q.capaA = capa; q.faseA = fase; q.velA = vel;
      _esf.center.set(q.x, q.y + 0.9, q.z);
      if (!g.visible) { g.position.set(q.x, q.y + (q.dy || 0), q.z); g.rotation.y = q.rumbo; }   // cierre 15-11: también los ocultos (las hojas y __varNPC.mirar los ubican)
      if (q.d < 95 && (!fr || fr.intersectsSphere(_esf))) cand.push(q); else if (g.visible) g.visible = false;
    }
    // --- dibujo (rendimiento, iGPU): solo los MAX más cercanos; malla alta < 10 m, baja < 30 m, lejana (2,5 mil caras, horneada) más allá;
    // sombra solo los 3 más cercanos (< 22 m); animación cada cuadro los 4 primeros, cada 2 hasta el 10.º, cada 4 el resto
    cand.sort((a, b) => a.d - b.d);
    let st = 0, tri = 0, triViejo = 0;
    for (const q of cand) triViejo += q.d < 16 ? q.p.caras(0) * 2 : q.p.caras(1);   // costo con el esquema anterior (todos, alta < 16 m con sombra)
    for (let k = 0; k < cand.length; k++) {
      const q = cand[k], p = q.p, g = p.g, ver = k < (M.ciudadViva.max ?? MAX);
      if (g.visible !== ver) g.visible = ver;
      if (!ver) continue;
      st++;
      g.position.set(q.x, q.y + (q.dy || 0), q.z); g.rotation.y = q.rumbo;
      const sombra = k < 3 && q.d < 22; p.lod(q.d < 10 ? 0 : q.d < 30 ? 1 : 2, sombra); tri += p.caras() * (sombra ? 2 : 1);
      const cada = k < 4 && q.d < 30 ? 1 : k < 10 && q.d < 60 ? 2 : 4;
      if ((cuadro + q.cuadro) % cada !== 0) continue;
      p.poner(q.anim, q.capaA, { vel: q.velA });
      if (q.faseA != null) p.fase(q.faseA);
      p.actualizar(dt * cada);
    }
    if (M.ciudadViva) M.ciudadViva.stats = { dibujados: st, candidatos: cand.length, caras: Math.round(tri), carasViejo: Math.round(triViejo), ms: +(performance.now() - t0).toFixed(2) };
  } });
  if (URLP.has('cvinfo')) console.log('ciudad viva N' + N, gente.length, 'personas', Object.fromEntries([...tiposNivel].map(t => [t, gente.filter(q => q.tipo === t).length])));
  M.ciudadViva = { gente, tramos, boda, raiz, lanzarBoda, T };
  // boda DENTRO de la iglesia (pedido de Diego 15-11; 3.er relevo): js/mundo/bodaIglesia.js, se arma al entrar a la sala 'iglesia'
  import('./bodaIglesia.js').then(m => { if (M.ciudadViva) M.ciudadViva.bodaIglesia = m.bodaIglesia(M, def); }).catch(e => console.warn('boda iglesia', e));
  // banda en el modo turista (3.er relevo): N2 y N4 en la plaza del barrio cívico (club, escuela-museo e iglesia alrededor), al lado este de
  // la escalera (la franja central queda libre), mirando al oeste con el público entre ella y la escalera. N3 no (memoria de 1945).
  if (M.tur && (N === 2 || N === 4) && URLP.get('banda') !== '0') {
    const pl = def.elementos.find(e => e.t === 'plaza' && e.y != null && Math.abs(e.x) < 20 && Math.abs(e.z + 296) < 30);
    if (pl) import('./banda.js').then(m => m.bandaPlaza(M, pl.x + Math.min(30, pl.sx / 2 - 8), pl.z, -Math.PI / 2)).then(b => { if (M.ciudadViva) M.ciudadViva.banda = b; }).catch(e => console.warn('banda', e));
  }
  return M.ciudadViva;
}
