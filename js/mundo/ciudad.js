// Sewell en cono (prototipo N2-C22, carril «ciudad»; solo con ?sewell=cono en la URL, sin la bandera nada cambia).
// Pedido de Diego (14-11-2026): «Sewell es como un cono»: los camarotes siguen las curvas de nivel de un cerro cónico,
// girados según la ladera, en anillos escalonados; de cada descanso de la escalera central sale una calle peatonal casi
// horizontal, con baranda, que llega a las puertas; muros de contención de piedra entre niveles y escaleras secundarias.
// Este archivo es solo el trazado (sin three.js, se prueba con node). Las obras (calles, muros, barandas, edificios
// girados) están en ciudadObras.js. Plano y mapas: capturas/ciudad/DISENO_CONO.md.
//
// Geometría: el vértice del cono está sobre el eje de la escalera central, en t = TC (z = -TC). Cada anillo i es una
// calle circular de radio R = TC - t_i alrededor del vértice, que cruza la escalera en t_i (ahí está su descanso).
// Para un punto de ángulo φ (x = R·sen φ, z = -TC + R·cos φ) la ladera baja hacia (sen φ, cos φ): un edificio con
// rotation.y = φ deja su fachada «sur» (+z local) mirando a la calle.
export const SEWELL_CONO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('sewell') !== 'plano';   // 14-11-2026 Diego: el cono es la versión definitiva (?sewell=plano solo para depurar)
export const TC = 560;
const sE = (a, b, v) => { const f = Math.min(1, Math.max(0, (v - a) / (b - a))); return f * f * (3 - 2 * f); };
const NUCLEO = [0.05, 0.09, 0.12, 0.15, 0.18, 0.15, 0.12, 0.09, 0.05];

// perfil de la ladera en cono (terreno.js lo usa en vez de perfil(t) si el nivel trae def.cono).
// En el eje (|x| < 40) es el perfil de siempre: la escalera central y las plazas quedan donde estaban.
// Hacia los lados las curvas de nivel se doblan en círculos alrededor del vértice y el perfil se suaviza (sin las mesetas
// planas de lado a lado). Junto a la vía (t < 15) y arriba de la planta (t > 545) el terreno no cambia.
export function perfilCono(t, x, perfil) {
  const y0 = perfil(t), k = sE(15, 45, t) * (1 - sE(470, 545, t));
  if (k <= 0) return y0;
  const r = Math.hypot(x, TC - t), te = TC - (r - desvio(r, Math.atan2(x, TC - t))), w = sE(40, 95, Math.abs(x));   // N2-C23: curvas de nivel onduladas (las mismas que siguen las calles)
  let ys = 0; if (w > 0) for (let i = 0; i < 9; i++) ys += NUCLEO[i] * perfil(te + (i - 4) * 7);
  return y0 + k * (perfil(te) * (1 - w) + ys * w - y0);
}

// medidas (m)
export const CALLE = 2.2;      // media calle
export const FRENTE = 1.0;     // de la calle a la fachada
export const TERRAZA = 1.5;    // franja a la cota de la calle más allá de su borde (ahí baja el terreno al anillo de abajo); ≥ 5 m de la espalda de los edificios de abajo
export const MURO = 6.5;       // el bloque del muro sale 6,5 m más allá del borde de la calle: tapa los 5 m en que la malla del terreno (vértices cada 5 m) suaviza el escalón
export const MARGEN = 2.6;     // terraza alrededor de cada edificio (edificioSplat mira 2,5 m a la redonda)
const XMAX = 200, TMIN = 24, TMAX = 456;
// anillos: t en el eje (donde la calle cruza la escalera o sale de una plaza)
// separación ≥ 26 m: calle 4,4 + terraza 4 + 2,6 (margen del edificio de abajo) + edificio ≤ 14 + 1 + muro de arriba
export const ANILLOS = [40, 66, 92, 140, 172, 198, 224, 250, 290, 330, 356, 382, 408, 434];

export const polar = (R, f) => ({ x: R * Math.sin(f), z: -TC + R * Math.cos(f) });
export const angulo = (x, z) => Math.atan2(x, z + TC);
export const radio = (x, z) => Math.hypot(x, z + TC);

// N2-C23 («orgánico»): las curvas de nivel ya no son círculos. desvio(R, f) es el desvío común del radio (ondulación +
// quebradas, que doblan las calles hacia el vértice); todos los anillos lo comparten, así la separación entre vecinos no
// cambia (casi: la amplitud crece con R). Cada anillo con holgura (anillos vecinos a más de 26 m) suma además su propio
// desvío dentro de esa holgura: se juntan con el vecino en unos tramos y se separan en otros. Junto a la escalera central
// (|f| < 0,05) el desvío es 0: cada calle cruza la escalera en su descanso de siempre.
const QUEBRADAS = [[-0.64, 8, 0.09], [0.56, 10, 0.08], [0.8, 7, 0.1]];   // [ángulo, hondura m, ancho rad] (lejos de los edificios a visitar)
// zonas en calma (calle circular): [f0, f1, R0, R1]; alas del hospital (anillo 356, deben quedar alineadas con su cuerpo)
const CALMA = [[0.04, 0.44, 170, 215]];
export function desvio(R, f) {
  let w = sE(0.05, 0.16, Math.abs(f)); if (w <= 0) return 0;
  for (const [f0, f1, R0, R1] of CALMA) w *= 1 - sE(f0 - 0.05, f0, f) * (1 - sE(f1, f1 + 0.05, f)) * sE(R0 - 25, R0, R) * (1 - sE(R1, R1 + 25, R));
  let d = 4.5 * Math.sin(11 * f + 0.7) + 1.4 * Math.sin(23 * f - 1.1);
  for (const [fq, p, a] of QUEBRADAS) { const u = (f - fq) / a; d -= p * Math.exp(-u * u); }
  return w * (0.3 + 0.7 * sE(100, 330, R)) * d;
}
const IDX = new Map(ANILLOS.map((t, i) => [t, i]));
const VAR = ANILLOS.map((ta, i) => {
  const r = azar(311 + i * 7919), abajo = i > 0 ? ta - ANILLOS[i - 1] : 26, arriba = i < ANILLOS.length - 1 ? ANILLOS[i + 1] - ta : 26;
  return { hi: Math.max(0, abajo - 26) / 2, lo: -Math.max(0, arriba - 26) / 2, k: 5 + r() * 8, ph: r() * 6.28 };
});
// radio de la calle del anillo ta en el ángulo f
export function radioAnillo(ta, f) {
  const R = TC - ta, v = VAR[IDX.get(ta)];
  let r = R + desvio(R, f);
  if (v && (v.hi || v.lo)) r += sE(0.05, 0.16, Math.abs(f)) * (v.lo + (v.hi - v.lo) * (0.5 + 0.5 * Math.sin(v.k * f + v.ph)));
  return r;
}
export const enAnillo = (ta, f, off = 0) => polar(radioAnillo(ta, f) + off, f);
// giro de la normal hacia afuera (ladera abajo) de la calle en f (rotation.y de three: la fachada +z local mira a la calle)
export function normalAnillo(ta, f) {
  const h = 1e-3, r = radioAnillo(ta, f), dr = (radioAnillo(ta, f + h) - radioAnillo(ta, f - h)) / (2 * h);
  return f - Math.atan(dr / r);
}
// ángulo del punto de la calle (radio + dr) que queda en la abscisa x
export function anguloEnX(ta, x, dr = 0) {
  let f = Math.asin(Math.max(-1, Math.min(1, x / (TC - ta + dr))));
  for (let k = 0; k < 8; k++) f = Math.asin(Math.max(-1, Math.min(1, x / (radioAnillo(ta, f) + dr))));
  return f;
}
// punto de la calle del anillo de t = ta, a la altura x (lado de x)
export function puntoCalle(ta, x, dr = 0) { const p = enAnillo(ta, anguloEnX(ta, x, dr), dr); return [x, p.z]; }

// rectángulo girado { x, z, hx, hz, th } (th = rotation.y de three): ejes locales ux = (cos th, -sen th), uz = (sen th, cos th)
function esquinas(r) {
  const c = Math.cos(r.th || 0), s = Math.sin(r.th || 0), out = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push([r.x + a * r.hx * c + b * r.hz * s, r.z - a * r.hx * s + b * r.hz * c]);
  return out;
}
function choca(a, b) {   // SAT entre dos rectángulos girados
  const A = esquinas(a), B = esquinas(b);
  for (const r of [a, b]) {
    const c = Math.cos(r.th || 0), s = Math.sin(r.th || 0);
    for (const [ax, az] of [[c, -s], [s, c]]) {
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const [x, z] of A) { const p = x * ax + z * az; a0 = Math.min(a0, p); a1 = Math.max(a1, p); }
      for (const [x, z] of B) { const p = x * ax + z * az; b0 = Math.min(b0, p); b1 = Math.max(b1, p); }
      if (a1 < b0 || b1 < a0) return false;
    }
  }
  return true;
}
const dentro = r => esquinas(r).every(([x, z]) => Math.abs(x) <= XMAX && -z >= TMIN && -z <= TMAX);
// rectángulo de un tramo de calle + muro entre los ángulos f0 y f1 del anillo ta (r0, r1: desde el eje de la calle, + afuera)
// (lo usa también ciudadObras para los bloques de las calles: la cuerda entre las dos puntas, no el arco de un círculo)
export function rectTramo(ta, f0, f1, r0 = -CALLE, r1 = CALLE + MURO) {
  if (f1 < f0) [f0, f1] = [f1, f0];
  const a = enAnillo(ta, f0, (r0 + r1) / 2), b = enAnillo(ta, f1, (r0 + r1) / 2), c = enAnillo(ta, f0, r1), d = enAnillo(ta, f1, r1);
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, hx: Math.max(Math.hypot(b.x - a.x, b.z - a.z), Math.hypot(d.x - c.x, d.z - c.z)) / 2, hz: (r1 - r0) / 2, th: Math.atan2(a.z - b.z, b.x - a.x) };
}

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const PALETA = [0xa8432f, 0x2f62b8, 0x5fae66, 0xe07a2e, 0xd9a23a, 0x7fb6d8, 0x4fb3a8, 0xefe2c0];

// edificios especiales que pasan a los anillos: anillo (t), x del centro, medidas nuevas (largo a lo largo de la calle)
const ESPECIALES_ANILLO = {
  palitroque: { ta: 40, x: -66, largo: 46, ancho: 12, puerta: { sala: 'palitroque', lado: 'sur', marco: true } },
  pulperia: { ta: 66, x: 22, largo: 20, ancho: 14.4 },
  cine: { ta: 250, x: -22, largo: 20, ancho: 14, puerta: { sala: 'cine', lado: 'sur' } },
  correos: { ta: 290, x: -58, largo: 22, ancho: 13 },
  club: { ta: 290, x: -98, largo: 40, ancho: 20 },
  escuela: { ta: 290, x: 78, largo: 40, ancho: 12 },
  iglesia: { ta: 250, x: 36, largo: 22, ancho: 11, puerta: { sala: 'iglesia', lado: 'este', propia: true } },   // N0-EMB (carril kit): iglesia 231 en el anillo del cine, al oriente
  hospital_ala: [{ ta: 356, x: 27, largo: 34, ancho: 13 }, { ta: 356, x: 64, largo: 34, ancho: 13 }],
};
// lugares de cada nivel donde no va ningún edificio (además de cada objeto suelto del nivel)
const RESERVAS = {
  2: [{ x: 30, z: -205, hx: 10, hz: 10 }],   // N4-C18: sin los andenes del andarivel «caletones»
  3: [{ x: 40, z: -420, hx: 25, hz: 18 }],
  4: [],
};
const SUELTOS = { fogata: 3, minero: 2.5, npc: 2.5, diego: 2.5, pan: 1.5, apunte: 1.5, letrero: 2, cajas: 2.5, torre: 9, plataforma: 6, puerta: 4, jefe: 4, escenario: 9, olla: 4 };

// arma el trazado del nivel: quita los camarotes en filas rectas y los reemplaza por anillos
export function trazadoCono(def) {
  const n = def.numero, r = azar(97 + n * 13), E = def.elementos;
  const obst = [];   // rectángulos donde no va calle ni edificio
  const plazas = E.filter(e => e.t === 'plaza' && e.y != null && Math.abs(e.x) < 20);
  for (const p of plazas) obst.push({ x: p.x, z: p.z, hx: p.sx / 2 + 1, hz: p.sz / 2 + 1, plaza: p });
  obst.push({ x: 0, z: -236, hx: 4.2, hz: 222, escalera: true });   // escalera central (t 14-458, 8 m de ancho con la bandera): la calle llega hasta su borde (descanso)
  const pasilloEscalera = { x: 0, z: -236, hx: 8, hz: 222 };        // los edificios quedan a ≥ 10 m del eje (escalera de 8 m + muro lateral)
  // especiales que se quedan en su lugar (hospital, planta, roca)
  for (const e of E) if (e.t === 'edificio' && ['hospital', 'concentradora', 'taller', 'estacion', 'taller_largo'].includes(e.id)) {
    const g = (e.rot || 0) % 180 !== 0; obst.push({ x: e.x, z: e.z, hx: (g ? e.ancho : e.largo) / 2 + 3, hz: (g ? e.largo : e.ancho) / 2 + 3 });
  }
  for (const e of E) if (e.t === 'roca' && e.sx) obst.push({ x: e.x, z: e.z, hx: e.sx / 2 + 3, hz: e.sz / 2 + 3 });
  const reservas = (RESERVAS[n] || []).map(o => ({ ...o }));
  for (const e of E) if (SUELTOS[e.t] && e.x != null && e.z != null && !e.sala) reservas.push({ x: e.x, z: e.z, hx: SUELTOS[e.t], hz: SUELTOS[e.t], suelto: e });
  // N2-C25: el corredor del cable de cada andarivel queda sin edificios (el cable del «caletones» atravesaba un camarote crema)
  for (const e of E) if (e.t === 'andarivel' && e.a && e.b) {
    const dx = e.b[0] - e.a[0], dz = e.b[2] - e.a[2];
    reservas.push({ x: (e.a[0] + e.b[0]) / 2, z: (e.a[2] + e.b[2]) / 2, hx: Math.hypot(dx, dz) / 2, hz: 3.5, th: Math.atan2(-dz, dx), cable: true });
  }

  // 1) calles: desde la escalera (o el borde de la plaza) hacia cada lado, hasta el primer obstáculo, el borde del pueblo
  //    (desparejo: cada anillo y lado termina en otra x) o donde se juntaría demasiado con un anillo vecino (se corta)
  const anillos = ANILLOS.map((ta, i) => ({ i, ta, R: TC - ta, lados: {} }));
  const rf = (i, f) => radioAnillo(ANILLOS[i], f);
  for (const A of anillos) for (const lado of [-1, 1]) {
    const paso = 0.6 / A.R, xmax = XMAX - (A.i === 0 ? 0 : r() * 45);
    let f = 0, f0 = null, f1 = null;
    for (let k = 0; k < 4000; k++, f += lado * paso) {
      const seg = rectTramo(A.ta, f, f + lado * paso), c = enAnillo(A.ta, f + lado * paso / 2);
      const junto = (A.i > 0 && rf(A.i - 1, f) - rf(A.i, f) < 24.5) || (A.i < anillos.length - 1 && rf(A.i, f) - rf(A.i + 1, f) < 24.5);
      const ok = Math.abs(c.x) <= xmax && -c.z >= TMIN && -c.z <= TMAX && !junto && !obst.some(o => choca(seg, o)) && !reservas.some(o => o.torre && choca(seg, o));
      if (f0 == null) { if (ok) f0 = f; else if (Math.abs(c.x) > 60) break; continue; }
      if (!ok) break;
      f1 = f + lado * paso;
    }
    if (f0 != null && f1 != null && Math.abs(f1 - f0) * A.R > 12) A.lados[lado] = { f0, f1, huecos: [] };
  }
  // 1b) objetos sueltos chicos (mineros, pan, apuntes, cajas, fogatas) que quedaban entre las filas de antes: a la calle más
  //     cercana (a ≤ 20 m), en la mitad de adentro; así no dejan huecos en las hileras de camarotes (N2-C23)
  const MOVER = ['minero', 'npc', 'diego', 'pan', 'apunte', 'cajas', 'fogata'];
  // N2-C26: también los que quedaban junto a la escalera central (|x| < 18): ahí están sus muros, barandas y las cuñas de tierra
  // de los descansos, y fis.suelo los dejaba encima de un muro (fogata inalcanzable, mineros «en el aire»). Van a la calle más
  // cercana de su lado, a 18 m del eje (las de la plaza de partida, t < 28, no se mueven)
  const XESC = 18;
  for (const e of E) if (MOVER.includes(e.t) && e.x != null && e.z != null && !e.sala && e.y == null && -e.z > 28) {
    const pl = obst.find(o => o.plaza && Math.abs(e.x - o.x) <= o.hx - 2 && Math.abs(e.z - o.z) <= o.hz - 2);
    if (pl) { if (Math.abs(e.x) < 13 && pl.hx > 16) { e.x = (Math.sign(e.x) || 1) * 13; e._calle = true; } continue; }   // sobre una plaza: se queda, fuera de la franja de tierra junto a la escalera
    const cerca = Math.abs(e.x) < XESC, rr = radio(e.x, e.z); let mejor = null;
    for (const A of anillos) for (const [lk, L] of Object.entries(A.lados)) {
      const lo = Math.min(L.f0, L.f1) + 3 / A.R, hi = Math.max(L.f0, L.f1) - 3 / A.R, sg = Math.sign(+lk);
      let f = angulo(e.x, e.z);
      if (cerca) { if (Math.abs(e.x) > 2 && Math.sign(e.x) !== sg) continue; f = anguloEnX(A.ta, sg * XESC, -1.2); }
      if (f < lo || f > hi) continue;
      const q = enAnillo(A.ta, f, -1.2), dd = cerca ? Math.hypot(q.x - e.x, q.z - e.z) : Math.abs(rr - radioAnillo(A.ta, f));
      if (dd < (cerca ? 30 : 20) && (!mejor || dd < mejor.dd)) mejor = { q, dd };
    }
    if (!mejor && cerca) {   // sin calle cerca (fogata del N4 entre la escalera y el hospital): a la plaza más cercana, a 13 m del eje
      for (const o of obst) if (o.plaza && o.hx > 16 && Math.abs((Math.sign(e.x) || 1) * 13 - o.x) <= o.hx - 3) {
        const q = { x: (Math.sign(e.x) || 1) * 13, z: Math.max(o.z - o.hz + 3, Math.min(o.z + o.hz - 3, e.z)) }, dd = Math.hypot(q.x - e.x, q.z - e.z);
        if (dd < 25 && (!mejor || dd < mejor.dd)) mejor = { q, dd };
      }
    }
    if (!mejor) continue;
    const p = mejor.q; e.x = +p.x.toFixed(2); e.z = +p.z.toFixed(2); e._calle = true;
    for (let k = reservas.length - 1; k >= 0; k--) if (reservas[k].suelto === e) reservas.splice(k, 1);
  }
  // 3) edificios: primero los especiales en su anillo (antes de las escaleras secundarias: una pasaba por el club), después
  //    camarotes de relleno a lo largo de cada calle
  const edificios = [], ocupado = [];
  const frente = (ta, f, d) => { const g = normalAnillo(ta, f), p = enAnillo(ta, f); return { x: p.x - Math.sin(g) * d, z: p.z - Math.cos(g) * d }; };
  const ponerEn = (A, x, largo, ancho, extra) => {
    const d = CALLE + FRENTE + ancho / 2, f = anguloEnX(A.ta, x, -d), g = normalAnillo(A.ta, f), p = enAnillo(A.ta, f, -d);
    const rect = { x: p.x, z: p.z, hx: largo / 2, hz: ancho / 2, th: g };
    return { rect, e: { t: 'edificio', x: +p.x.toFixed(2), z: +p.z.toFixed(2), largo, ancho, giro: g * 180 / Math.PI, anillo: A.i, ...extra } };
  };
  for (const e of E) {
    const spec = e.t === 'edificio' && ESPECIALES_ANILLO[e.id]; if (!spec) continue;
    const lista = Array.isArray(spec) ? spec : [spec];
    const k = edificios.filter(b => b.e.id === e.id).length, s = lista[k] || lista[0];
    const A = anillos.find(a => a.ta === s.ta);
    const { rect, e: nuevo } = ponerEn(A, s.x, s.largo, s.ancho, { ...e, rot: 0, x: undefined, z: undefined, largo: undefined, ancho: undefined, terraza: undefined, terrazaCon: undefined, puerta: s.puerta ? { ...s.puerta, sala: e.puerta?.sala ?? s.puerta.sala } : e.puerta });   // N4-SALAS: la sala de la época la pone niveles.js
    Object.assign(nuevo, { x: +rect.x.toFixed(2), z: +rect.z.toFixed(2), largo: s.largo, ancho: s.ancho });
    edificios.push({ e: nuevo, rect }); ocupado.push({ ...rect, hx: rect.hx + 3, hz: rect.hz + 1 });
  }
  // 2) escaleras secundarias: entre dos anillos vecinos con calle en ese lado, en x ≈ ±100 / ±160 (radiales, en zigzag)
  const secundarias = [];
  for (let i = 0; i < anillos.length - 1; i++) {
    const In = anillos[i + 1], Out = anillos[i];   // In: el de más arriba (radio menor)
    for (const lado of [-1, 1]) {
      const a = In.lados[lado], b = Out.lados[lado]; if (!a || !b) continue;
      const fo = anguloEnX(Out.ta, lado * (i % 2 ? 160 : 100)), fi = fo;   // radial
      const cubre = (L, f, R) => (Math.min(L.f0, L.f1) + 6 / R) < f && f < (Math.max(L.f0, L.f1) - 6 / R);
      if (!cubre(a, fi, In.R) || !cubre(b, fo, Out.R)) continue;
      const p0 = enAnillo(Out.ta, fo, -CALLE), p1 = enAnillo(In.ta, fi, CALLE);
      const pas = { x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2, hx: 3.2, hz: Math.hypot(p1.x - p0.x, p1.z - p0.z) / 2, th: fo };
      if (obst.some(o => choca(pas, o)) || reservas.some(o => choca(pas, o)) || ocupado.some(o => choca(pas, o))) continue;
      secundarias.push({ t: 'escalera', x0: p0.x, z0: p0.z, x1: p1.x, z1: p1.z, ancho: 2.4, id: 'sec' + secundarias.length, anillos: [Out.i, In.i], f: fo });
      In.lados[lado].huecos.push([fi - 1.6 / In.R, fi + 1.6 / In.R]);   // muesca en el muro del anillo de arriba
      reservas.push({ ...pas, hx: 8 });   // (8: la orilla en pendiente de su terraza, m = 4, enterraba la esquina del camarote vecino) el núcleo de la terraza de la escalera mide ±5,5 m y gana a las terrazas de los edificios
    }
  }
  // ¿cabe? la fachada queda a 0-3 m de la calle en todo su largo, la espalda a ≥ 9,6 m de la calle de arriba (detrás está
  // su muro; con 8,6 la malla del terreno asomaba 2,6-3,8 m dentro de la planta, N4) y no choca con la escalera central, otros edificios ni lo reservado
  const cabe = (A, rect, up, upL) => {
    const c = Math.cos(rect.th), s = Math.sin(rect.th);
    const P = (a, b) => ({ x: rect.x + a * rect.hx * c + b * rect.hz * s, z: rect.z - a * rect.hx * s + b * rect.hz * c });
    for (let k = 0; k <= 8; k++) {
      const a = -1 + k / 4, fr = P(a, 1), dep = radioAnillo(A.ta, angulo(fr.x, fr.z)) - CALLE - FRENTE - radio(fr.x, fr.z);
      if (dep < -0.5 || dep > 3.2) return false;
      if (upL) {
        const bk = P(a, -1), fB = angulo(bk.x, bk.z);
        if (fB > Math.min(upL.f0, upL.f1) - 14 / up.R && fB < Math.max(upL.f0, upL.f1) + 14 / up.R && radio(bk.x, bk.z) - radioAnillo(up.ta, fB) < 9.6) return false;
      }
    }
    const pad = { ...rect, hx: rect.hx + 2, hz: rect.hz + 1 };
    return dentro(rect) && !choca(pad, pasilloEscalera) && !obst.some(o => choca(o.plaza ? { ...pad, hx: pad.hx + 4, hz: pad.hz + 4 } : pad, o)) && !reservas.some(o => choca(pad, o)) && !ocupado.some(o => choca(pad, o));
  };
  // edificio de «largo» m de fachada desde el ángulo fs, ladera afuera: alineado con la cuerda de la calle (no con un
  // círculo), un poco girado al azar y metido hacia el cerro lo justo si la calle se curva hacia adentro (quebradas)
  const intentar = (A, lado, fs, largo, ancho, up, upL) => {
    const d = CALLE + FRENTE, fe = fs + lado * largo / (radioAnillo(A.ta, fs) - d);
    const q0 = frente(A.ta, fs, d), q1 = frente(A.ta, fe, d), [a, b] = lado > 0 ? [q0, q1] : [q1, q0];
    const L = Math.hypot(b.x - a.x, b.z - a.z), th = Math.atan2(a.z - b.z, b.x - a.x) + (r() - 0.5) * 0.05;
    let ent = 0;
    for (let k = 0; k <= 8; k++) { const q = frente(A.ta, fs + (fe - fs) * k / 8, d); ent = Math.max(ent, -((q.x - a.x) * Math.sin(th) + (q.z - a.z) * Math.cos(th))); }
    const rect = { x: (a.x + b.x) / 2 - Math.sin(th) * (ancho / 2 + ent), z: (a.z + b.z) / 2 - Math.cos(th) * (ancho / 2 + ent), hx: L / 2, hz: ancho / 2, th };
    return { rect, fe, ok: cabe(A, rect, up, upL) };
  };
  for (const A of anillos) for (const lado of [-1, 1]) {
    const L = A.lados[lado]; if (!L) continue;
    const up = anillos[A.i + 1], upL = up && up.lados[lado];
    const R0 = A.R - CALLE - FRENTE, fIni = lado > 0 ? Math.min(L.f0, L.f1) : Math.max(L.f0, L.f1), fFin = lado > 0 ? Math.max(L.f0, L.f1) : Math.min(L.f0, L.f1);
    const fLim = fFin - lado * 6 / R0;   // el último termina 6 m antes del fin de la calle (si no, su esquina queda sobre el escalón)
    const ancho0 = 12 + Math.floor(r() * 3);
    let fs = fIni + lado * (3 + r() * 3) / R0;
    for (let guarda = 0; lado * (fLim - fs) * R0 > 12 && guarda < 500; guarda++) {
      const resto = lado * (fLim - fs) * R0, hueco = up ? radioAnillo(A.ta, fs) - radioAnillo(up.ta, fs) : 26;
      const opciones = [];
      // donde los anillos se separan, algunos camarotes van perpendiculares a la ladera (como en las fotos)
      if (hueco >= 36 && r() < 0.8) { const fondo = Math.min(30, hueco - 13.5); opciones.push([12 + Math.floor(r() * 4), fondo], [12, fondo - 5]); }
      const l0 = 40 + Math.floor(r() * 21);
      for (let lg = l0; lg >= 16; lg -= 5) opciones.push([lg, ancho0], [lg, 12]);   // el más largo que quepa
      let hecho = null;
      for (const [lg, an] of opciones) {
        if (lg > resto || an < 12) continue;
        const t = intentar(A, lado, fs, lg, an, up, upL); if (t.ok) { hecho = { ...t, an }; break; }
      }
      if (!hecho) { fs += lado * 3 / R0; continue; }
      const { rect } = hecho, perp = hecho.an > 2 * rect.hx;
      edificios.push({ rect, e: { t: 'edificio', x: +rect.x.toFixed(2), z: +rect.z.toFixed(2), largo: +(2 * rect.hx).toFixed(1), ancho: hecho.an, giro: rect.th * 180 / Math.PI, anillo: A.i,
        pisos: perp ? 3 + Math.floor(r() * 2) : def.epoca >= 1925 ? 4 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3), color: PALETA[Math.floor(r() * PALETA.length)], techo: 'dos', ropa: r() < 0.5 } });
      ocupado.push({ ...rect, hx: rect.hx + 1 });
      fs = hecho.fe + lado * (r() < 0.2 ? 9 + r() * 7 : 3 + r() * 3) / R0;   // agrupados: brechas de 3-6 m y cada tanto un pasaje
    }
  }
  return { anillos, secundarias, edificios: edificios.map(b => b.e) };
}

// ajusta un nivel (2-4) al cono: se llama desde niveles.js solo con la bandera
export function ajustarNivelCono(def) {
  const esCamarote = e => e.t === 'edificio' && 'ropa' in e && !e.nombre;
  const ids = new Set(Object.keys(ESPECIALES_ANILLO));
  // fuera: camarotes en filas, el tablón de techo a techo del N2 y el pasaje del alud del N3 (eran de las filas rectas)
  const base = def.elementos.filter(e => !esCamarote(e) && !(def.numero === 2 && e.t === 'tablon') && e.id !== 'pasaje_alud');
  const tr = trazadoCono({ ...def, elementos: base });
  const elementos = base.filter(e => !(e.t === 'edificio' && ids.has(e.id)));
  // plazas cívicas: las barandas las dibuja ciudadObras (con aberturas donde llegan las calles)
  for (const e of elementos) if (e.t === 'plaza' && e.baranda) e.barandaCono = true;
  for (const e of elementos) if (e.t === 'escalera' && Math.abs(e.x0) < 1 && Math.abs(e.x1) < 1) { e.sinPasamanos = true; e.ancho = 8; }   // escalera central: columna vertebral de 8 m (N2-C23)
  // la escalera central llega a ras de las plazas (hoy termina 2,9 m bajo la plaza 60 y la 126: el piloto se atasca ahí)
  const plazaEn = t => elementos.find(p => p.t === 'plaza' && p.y != null && Math.abs(p.x) < 20 && Math.abs(-p.z - t) <= p.sz / 2 + 1.5);
  for (const e of elementos) if (e.t === 'escalera' && Math.abs(e.x0) < 1 && Math.abs(e.x1) < 1) {
    const p0 = plazaEn(-e.z0), p1 = plazaEn(-e.z1);
    if (p0) e.y0 = p0.y; if (p1) e.y1 = p1.y;
  }
  elementos.push(...tr.edificios, ...tr.secundarias);
  def.elementos = elementos;
  def.cono = { perfil: perfilCono, anillos: tr.anillos, secundarias: tr.secundarias.map(s => s.id) };
  const P = (ta, x, dr = 0) => puntoCalle(ta, x, dr).map(v => +v.toFixed(1));
  const puerta = id => { const e = tr.edificios.find(b => b.id === id), f = e.giro * Math.PI / 180, d = e.ancho / 2 + 1.9; return [+(e.x + Math.sin(f) * d).toFixed(1), +(e.z + Math.cos(f) * d).toFixed(1)]; };
  // N2-C38: el Teniente Club se entra por el pórtico, ARRIBA de la escalera lateral (sube a +X del pórtico). Puntos de la ruta en coordenadas locales del lote
  // (x a lo largo, z hacia la calle) pasadas al mundo con el giro: calle → pie de la escalera → rellano → puerta (con el sitio de salida).
  const clubSube = (id, rev) => { const e = tr.edificios.find(b => b.id === id), f = e.giro * Math.PI / 180, L = Math.max(e.largo, e.ancho), W = Math.min(e.largo, e.ancho);
    const xP = Math.min(10, L * 0.3) / 2, zs = W / 2 - Math.min(3.4, W * 0.22) + 1.02, xs = xP + 7.7;
    const M = (lx, lz) => [+(e.x + lx * Math.cos(f) + lz * Math.sin(f)).toFixed(1), +(e.z - lx * Math.sin(f) + lz * Math.cos(f)).toFixed(1)];
    const ida = [M(xs, W / 2 + 3), M(xs, zs), M(xP + 3, zs), M(xP - 0.8, zs)];
    return rev ? [M(xP - 0.8, zs), M(xP + 3, zs), M(xs, zs), M(xs, W / 2 + 3)] : [...ida, [...M(0, zs), 'puerta']]; };
  if (def.numero === 2) {
    // palitroque en el anillo 40 (poniente), cine en el anillo 241 (poniente, puerta a la calle)
    const pp = puerta('palitroque'), pc = puerta('cine');
    def.ruta = [[20, 14], [0, -10], [0, -40], P(40, -20), P(40, -33), P(40, -45), [...pp, 'puerta'], ['sala', -6, -5], ['sala', -6, -44], ['sala', 0, -47, 'puerta'], P(40, -45), P(40, -33), P(40, -20), [0, -42],
      [0, -118], [0, -140], [0, -200], [0, -250], P(250, -10), [...pc, 'puerta'], ['sala', 0, -5], ['sala', 0, -30]];
    for (const e of elementos) if (e.t === 'zona' && e.i === 5) { e.x = pc[0]; e.z = pc[1]; }
    // azoteas: los dos camarotes del poniente más cerca de donde estaban los de techo plano
    for (const [x, z] of [[-95, -104], [-96, -79]]) {
      let mejor = null; for (const e of tr.edificios) if (!e.id && e.x < -20 && e.largo > e.ancho && (!mejor || Math.hypot(e.x - x, e.z - z) < Math.hypot(mejor.x - x, mejor.z - z))) mejor = e;
      if (mejor) mejor.id = 'camarote_azotea';
    }
    const az = tr.edificios.find(e => e.id === 'camarote_azotea');
    // el apunte de «Techos y balcones» queda en la calle frente al camarote de azotea (sobre el techo no se alcanzaba)
    if (az) for (const e of elementos) if (e.t === 'apunte' && e.sobreTecho) { const f = az.giro * Math.PI / 180, d = az.ancho / 2 + 3; e.x = +(az.x + Math.sin(f) * d).toFixed(1); e.z = +(az.z + Math.cos(f) * d).toFixed(1); e.sobreTecho = false; }
  }
  if (def.numero === 3) {
    const pg = puerta('club'), ini = P(382, -100);
    const ida = [-15, -30, -45, -60, -75, -90].map(x => P(382, x, -1.5)).concat([ini]), vuelta = [-90, -75, -60, -45, -30, -15].map(x => P(382, x, -1.5)).concat([[0, -382]]);   // -1,5: por la mitad de adentro de la calle (lejos del borde del muro)   // la calle ya no es un círculo: puntos cada 15 m
    def.ruta = [[0, -150], [0, -200], [0, -265], [0, -274], [-30, -292],   // [0,-274]: subir a la plaza por la escalera (en diagonal chocaba con el borde de la losa)
       P(290, -50), P(290, -62), P(290, -75), ...clubSube('club'), ['sala', 3, -4.6], ['sala', 0, -2, 'puerta'], ...clubSube('club', true),   /* N0-EMB9: el gimnasio ahora es el Teniente Club (club45): se entra al vestíbulo y se sale por la misma puerta */
      P(290, -75), P(290, -62), P(290, -50), [-30, -300], [0, -322], [0, -350], [0, -382], ...ida, ...vuelta, [0, -350], [0, -330], [40, -324, 'puerta'],
      ['sala', 5.5, -3.0, 'ascensor'] /* C7: ascensor del kit hospital157 */, ['sala', 0, -8, 'puerta'], [40, -420, 'jefe']];
    for (const e of elementos) {
      if (e.t === 'alud') { e.inicio = ini; e.ruta = [ini, P(382, -90), P(382, -80), P(382, -70), P(382, -60), P(382, -50), P(382, -40), P(382, -30), P(382, -20), P(382, -10), [0, -382], [0, -324], [40, -322]]; }
      if (e.t === 'fogata' && e.x === -150) { [e.x, e.z] = P(382, -104, -1); }
      if (e.t === 'zona' && e.i === 2) { [e.x, e.z] = ini; }
      if (e.t === 'zona' && e.i === 1) { [e.x, e.z] = pg; }
      if (e.t === 'apunte' && e.i === 2) { [e.x, e.z] = P(382, -85, 1); }
      if (e.t === 'pepitas' && e.de[0] === -140) { e.de = P(382, -90); e.a = P(382, -12); }
    }
  }
  return def;
}
