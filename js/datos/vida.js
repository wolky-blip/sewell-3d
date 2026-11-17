// N0-VIDA (carril ciudad, 14-11-2026). Pedido de Diego: «es una ciudad minera: un par de bulldozers antiguos estacionados, más vida
// en las calles con NPC genéricos y coleccionables repartidos por distintas calles (no todo en la escalera principal)».
// Este archivo es solo DATOS (sin three.js): agrega a cada nivel elementos nuevos que arma js/mundo/vidaMinera.js:
//   { t: 'faena', que, x, z, giro }        maquinaria y objetos de faena estacionados (con colisión), coherentes con la época
//   { t: 'gente', quien, x, z, a?, texto?, mira? }  vecinos y mineros que caminan entre dos puntos de una calle o conversan
//   { t: 'reliquia', id, x, z }              coleccionables del libro (ficha de pulpería, lámpara de carburo...): el HUD los cuenta
//   { t: 'pepitas', ... }                     filas de pepitas por las calles de los anillos (las de la escalera central se acortan)
// Épocas: N1 1905 (carretas, mulas, vagonetas: sin máquinas) · N2 1920 (carros de mano, carretillas) · N3 1940 (un tractor oruga
// despejando nieve en la plaza) · N4 1967 (dos bulldozers estacionados en la planta). En Sewell no había calles para vehículos
// (la ciudad creció en torno a la escalera): las máquinas quedan en las plazas de faena, nunca en las calles peatonales.
// Fuente: documental/libro (texto.txt, «Origen de El Teniente y Sewell.md»), resumido con palabras propias.
// ?vida=0 lo apaga entero (para comparar fps antes/después).
import { enAnillo, radioAnillo } from '../mundo/ciudad.js';

export const VIDA_ACTIVA = typeof location === 'undefined' || new URLSearchParams(location.search).get('vida') !== '0';

// fichas de los coleccionables (título corto + texto breve, del libro)
export const RELIQUIAS = {
  herradura: ['Herradura de mula', 'Antes del ferrocarril todo subía a lomo de mula o en carretas por el camino carretero desde Graneros. La compañía contrataba obreros, mulas y carretas en una pequeña oficina.'],
  muestra: ['Muestra de mineral', 'Para probar la mina, se mandaron a Europa unas 25 toneladas de mineral y se ensayó cómo concentrar su cobre. El resultado convenció a los ingenieros extranjeros.'],
  carburo: ['Lámpara de carburo', 'El agua goteaba sobre el carburo y el gas encendía una llama blanca. Con esa luz se trabajaba en las galerías antes de las lámparas eléctricas.'],
  // N0-FABLE-1611 (A7): en 1905 no había lámparas de carburo en manos de los mineros (lista de anacronismos: «velas y candiles»)
  candil: ['Candil de fierro', 'En los primeros años las galerías y las casas se alumbraban con velas y candiles: un platillo de fierro con aceite o sebo y una mecha, colgado de un gancho.'],
  dinamita: ['Caja de dinamita vacía', 'La roca se rompía con taladros y explosivos. Los polvorines del campamento guardaban la dinamita lejos de las casas.'],
  carpa: ['Estaca de carpa', 'Los primeros mineros vivieron en carpas y casuchas de madera; después vino la barraca y, al final, el camarote característico de Sewell.'],
  ficha: ['Ficha de la pulpería', 'Las provisiones llegaban del almacén de Sewell. En la pulpería se compraba la comida, la ropa y lo necesario para la casa.'],
  topics: ['Revista «Teniente Topics»', 'Hace más de cien años la compañía editaba una revista para los trabajadores que contaba la vida diaria del mineral.'],
  boleto: ['Boleto del ferrocarril', 'El tren de Rancagua a la mina se inauguró oficialmente el 17 de septiembre de 1911 y funcionó hasta 1971.'],
  partitura: ['Partitura de la banda', 'En 1923 empezó un curso de música y de piano: de ahí nació la banda de músicos del campamento.'],
  entrada: ['Entrada del cine', 'El cine de Sewell tenía 680 butacas y daba los mejores estrenos de la época.'],
  biblioteca: ['Carné de la biblioteca', 'En 1922 el campamento tenía una biblioteca pública; la escuela y la biblioteca compartían el mismo local.'],
  pala: ['Pala de nieve', 'Los inviernos eran duros: la nieve se juntaba en los cerros y bajaba en aludes que a veces destruían casas. Sewell quedaba aislado, como un barco en la nieve.'],
  pension: ['Vale de la pensión', 'En 1938 la pensión costaba 5 pesos diarios y el jornal medio de un obrero era de 22 pesos.'],
  casco: ['Casco de minero', 'Casco duro con su lámpara: protegía de las piedras sueltas en los túneles de la mina.'],
  hospital: ['Receta del Hospital 157', 'El hospital tenía ascensor, incubadoras, laboratorio farmacéutico, salas de operaciones y rayos X: uno de los más modernos del país.'],
  foto: ['Foto antigua de la escalera', 'Como la pendiente no dejaba pasar vehículos con ruedas, Sewell creció en torno a una gran escalera central. Por eso le dicen «la ciudad de las escaleras».'],
  llave: ['Llave de un departamento en Rancagua', 'Con la Operación Valle las familias bajaron a vivir a Rancagua y viajaban cada día a la mina por la carretera.'],
  carretera: ['Mapa de la carretera del cobre', 'En 1971 el ferrocarril dejó de funcionar: lo reemplazó la carretera del cobre Eduardo Frei Montalva.'],
  bomberos: ['Casco de bombero', 'En 1915, el año en que el campamento se bautizó Sewell, se levantaron el hospital, el cuerpo de bomberos y el club social.'],
};

// frases de los vecinos (datos del libro, breves); sin chistes sobre la tragedia de 1945 (regla de Diego)
const DICHOS = {
  1: ['Por fin terminaron el camino de carretas desde Graneros: antes todo subía a lomo de mula.', 'Dicen que van a tender un ferrocarril hasta la mina. ¡Ojalá!', 'Hay que cuidar la dinamita: lejos de las carpas.'],
  2: ['En Sewell no hay calles para carretas: todo sube por la escalera.', 'Con la ley seca, los carabineros no dejan entrar ni una botella.', 'El andarivel trae los materiales; nosotros, la mercadería en carretilla.', 'En marzo de 1915 el campamento pasó a llamarse Sewell.', 'Mi hijo va a la escuela; de noche estudian también los obreros.'],
  3: ['Con esta nieve el campamento queda aislado, como un barco.', 'El tractor oruga despeja la plaza; por las calles, puro pala.', 'Cuidado con los aludes: bajan por los flancos del cerro.', 'La pensión cuesta cinco pesos al día; el jornal, veintidós.'],
  4: ['Nos vamos a Rancagua: allá nos dieron departamento.', 'Ahora subimos todos los días por la carretera.', 'Los bulldozers son de la planta: aquí arriba no entran a las calles.', 'Toda la vida en este camarote… Qué pena dejarlo.'],
};

// distancia de un punto a la ruta del piloto (solo tramos exteriores)
function distRuta(def, x, z) {
  const P = (def.ruta || []).filter(p => typeof p[0] === 'number');
  let m = 1e9;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[i + 1] || a, dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const u = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
    m = Math.min(m, Math.hypot(x - a[0] - u * dx, z - a[1] - u * dz));
  }
  return m;
}
const OCUPA = new Set(['fogata', 'minero', 'npc', 'diego', 'pan', 'apunte', 'letrero', 'cajas', 'torre', 'plataforma', 'puerta', 'jefe', 'escenario', 'olla', 'bocamina', 'tunel', 'carpa', 'dinamitero', 'tren', 'nido', 'repisa', 'faena', 'gente', 'reliquia', 'vecino', 'animal']);
function libre(def, x, z, r) {
  for (const e of def.elementos) {
    if (!OCUPA.has(e.t) || e.x == null || e.z == null || e.sala) continue;
    if (Math.hypot(e.x - x, e.z - z) < r + (e.t === 'torre' || e.t === 'escenario' ? 10 : e.t === 'plataforma' ? 6 : 2.5)) return false;
  }
  return true;
}
function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// puntos de calle de los anillos del cono: cada ~paso m, lejos de la escalera central, de las escaleras secundarias y de lo que ya hay
function puntosCalle(def, dr, paso, extremos = 6) {
  const A = (def.cono && def.cono.anillos) || [], sec = def.elementos.filter(e => e.t === 'escalera' && e.anillos), out = [];
  for (const a of A) for (const [lk, L] of Object.entries(a.lados)) {
    const lo = Math.min(L.f0, L.f1) + extremos / a.R, hi = Math.max(L.f0, L.f1) - extremos / a.R;
    for (let f = lo; f <= hi; f += paso / a.R) {
      const p = enAnillo(a.ta, f, dr);
      if (Math.abs(p.x) < 18) continue;   // descanso de la escalera central
      if (sec.some(s => s.anillos.includes(a.i) && Math.abs(s.f - f) * a.R < 10)) continue;   // muesca de la escalera secundaria
      out.push({ a, lado: +lk, f, x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
    }
  }
  return out;
}
const giroCalle = (q) => q.f * 180 / Math.PI;   // rotation.y = ángulo: +x local a lo largo de la calle, +z ladera abajo

// objetos de faena por época (lo que se puede ver en una calle peatonal: nada con motor)
const FAENA_CALLE = {
  2: ['carroMano', 'carretilla', 'sacos', 'dinamita', 'tambores', 'herramientas', 'lena', 'carretilla', 'sacos', 'carroMano'],
  3: ['carretilla', 'sacos', 'tambores', 'herramientas', 'lena', 'trineo', 'sacos', 'lena', 'carroMano'],
  4: ['carroMano', 'tambores', 'sacos', 'herramientas', 'carretilla', 'tambores', 'lena', 'cajonera'],
};
const RELIQ_NIVEL = {
  1: ['herradura', 'muestra', 'candil', 'dinamita', 'carpa'],   // N0-FABLE-1611 (A7): candil en vez de la lámpara de carburo
  2: ['ficha', 'topics', 'boleto', 'biblioteca', 'bomberos', 'carburo'],
  3: ['pala', 'pension', 'partitura', 'casco', 'entrada', 'ficha'],
  4: ['llave', 'carretera', 'foto', 'hospital', 'casco', 'entrada'],
};

export function agregarVida(def) {
  if (!VIDA_ACTIVA || !def) return def;
  const n = def.numero, r = azar(4243 + n * 101), E = def.elementos;
  const push = e => { E.push(e); return e; };
  const dichos = DICHOS[n].slice();
  const dicho = () => dichos.length ? dichos.shift() : null;
  // ---------------------------------------------------------------- N1 (1905): campamento sin ciudad, puntos a mano
  if (n === 1) {
    const faena = [
      ['carreta', -446, -462, 30], ['sacos', -404, -485, 10], ['dinamita', -436, -495, -20], ['herramientas', -392, -478, 70],
      ['carreta', -355.5, -323.3, 180], ['sacos', -360, -320, 0], ['vagonetaRiel', -196, -186, 90], ['carretilla', -135, -186, 40],   // N1-PUEBLO-VIDA: carreta y carretilla a lugares llanos (antes en laderas de 35-40°, hundidas)
      ['lena', -115, -177.5, 0], ['carreta', -186, -150, 100], ['sacos', -88, -89, 15], ['vagonetaRiel', -43, -81, 0], ['dinamita', -36, -36, 45],   // DEFECTOS-1611: vagonetaRiel del molino 7 m al oriente (su riel chocaba con el muro del galpón nuevo)
    ];
    for (const [que, x, z, g] of faena) if (distRuta(def, x, z) > 5 && libre(def, x, z, 2)) push({ t: 'faena', que, x, z, giro: g });
    // N1-PUEBLO-VIDA (15-11, Diego): sin mineros pacíficos en 1905; gente que trabajaba en la época, con sus familias, mulas y bueyes
    // (js/mundo/gente1905.js y animales.js). Los mineros ENEMIGOS (t: 'minero' de niveles.js) no se tocan.
    // campamento de Cerro Negro: familia que llegó en las caravanas de carretas
    push({ t: 'vecino', quien: 'arriero', x: -434, z: -466, mira: [-430, -470], texto: dicho() });
    push({ t: 'vecino', quien: 'madre', x: -430, z: -470, mira: [-434, -466] });
    push({ t: 'vecino', quien: 'campesino', x: -392, z: -462, a: [-372, -446] });
    push({ t: 'animal', que: 'mula', x: -452, z: -468, giro: 60, carga: true });   // fuera de las carpas
    // Pueblo Hundido
    push({ t: 'vecino', quien: 'aguatera', x: -127, z: -142, a: [-146, -156], texto: dicho() });   // por el camino (antes cruzaba la casa de piedra de (-140,-170))
    push({ t: 'vecino', quien: 'lavandera', x: -170.5, z: -157, mira: [-173, -160], hace: 'lavar', texto: 'Lavo la ropa de los mineros solteros: con el frío de aquí arriba, se seca tiesa en el cordel.' });
    push({ t: 'vecino', quien: 'cocinera', x: -158, z: -139.5, mira: [-160, -139.5], hace: 'cocinar', texto: 'Porotos con mote: lo que alcanza para la familia. El pan lo compramos en la panadería.' });
    push({ t: 'vecino', quien: 'nino', x: -158.5, z: -135.5, hace: 'jugar', r: 2.1, aro: true });
    push({ t: 'vecino', quien: 'nina', x: -158.5, z: -135.5, hace: 'jugar', r: 2.1, fase: Math.PI });
    push({ t: 'vecino', quien: 'anciano', x: -118, z: -178.5, mira: [-126, -168], hace: 'sentado', texto: 'Yo subí con las primeras carretas desde Graneros: cuatro días de camino, con los bueyes resoplando en cada cuesta.' });
    // N1-ABASTECIMIENTO-c (15-11, Diego: «las carretas deberían moverse entre el tren y el andarivel PASANDO POR PUEBLO HUNDIDO, hasta el
    // punto de la foto [estación baja, B]; de esa manera las mercancías son transportadas en el andarivel hasta el frente [andén A, Casa
    // Hamilton], donde las mulas las llevan al campamento»). Cadena: tren → yunta (por Pueblo Hundido) → estación B → capachos → andén A →
    // mulas → campamento; el mineral al revés (js/mundo/animales.js y abasto.js).
    // eje: del punto P al Q por el camino; cada sentido va por su carril y da la vuelta en U en cada punta; pilas: [x, z, giro°] de los
    // acopios de cada punta. YUNTA: estación del tren (P) ↔ explanada al pie del andén B (Q). Camino: zigzag por la ladera al poniente del
    // molino, la calle de Pueblo Hundido entre sus casas (CAMINOS1905[2]; frente a la fogata se abre 1,5 m hacia el sur) y dos curvas hasta la estación B (CAMINOS1905[3] y [4], A* con
    // pendiente ≤ 20°: herramientas/abasto_astar.py). Los últimos 25 m van por la explanada sin tallar (junto a la fogata y la bocamina).
    // ARREO: andén A (P, al norte del andén) ↔ campamento de Cerro Negro (Q), por el camino real (CAMINOS1905[0]).
    push({ t: 'yunta', eje: [[18,7],[6,10.5],[-6,10],[-16,4],[-24,-6],[-28,-11],[-46,-23],[-64,-35],[-82,-47],[-100,-59],[-109,-65],[-115,-77],[-133,-89],[-151,-101],[-133,-113],[-115,-125],[-109,-128],[-112,-137],[-120,-141],[-139,-156],[-148,-164.5],[-158,-170],[-168,-178.2],[-172,-185],[-184,-187],[-197,-192],[-214,-200],[-223,-206],[-229,-206],[-238,-212],[-220,-224],[-202,-236],[-184,-248],[-175,-254],[-193,-266],[-202,-269],[-217,-269],[-226,-269],[-244,-275],[-255,-282],[-262,-289],[-261,-296],[-260.5,-300]], carril: 1.5, v: 1.0, parada: 30, s0: 1.5, carga0: 'm',
      pilas: { P: [19.1, 10.8, -74], Q: [-263.6, -301.5, 90] },
      texto: 'Traigo del tren los víveres, las herramientas y la dinamita, por Pueblo Hundido hasta el andarivel, y bajo con los sacos de mineral. Despacito: los bueyes no se apuran.' });
    push({ t: 'arreo', eje: [[-327, -322], [-326, -336], [-338, -350], [-360, -360], [-400, -430], [-411.3, -448.2]], carril: 1.5, mulas: 2, v: 0.95, parada: 8, s0Q: -32, carga0: 'v',
      pilas: { P: [-331.5, -322, 176], Q: [-413.1, -444.6, 32] },
      texto: 'Subo al campamento lo que llegó por el andarivel y vuelvo con muestras de mineral para el andén.' });
    push({ t: 'animal', que: 'mula', x: -191, z: -140.5, giro: 200 });
    const rel = [[-452, -448], [-372, -330], [-205, -180], [-112, -168], [-40, -95]];
    RELIQ_NIVEL[1].forEach((id, k) => push({ t: 'reliquia', id, x: rel[k][0], z: rel[k][1] }));
    // pepitas fuera de la ruta: por el campamento, el patio de Hamilton, Pueblo Hundido y el molino
    for (const [x0, z0, x1, z1, k] of [[-455, -490, -455, -455, 5], [-372, -346, -360, -322, 4], [-200, -150, -180, -140, 4], [-60, -110, -30, -110, 5]]) push({ t: 'pepitas', de: [x0, z0], a: [x1, z1], n: k });
    return def;
  }
  // ---------------------------------------------------------------- N2-N4: calles de los anillos del cono
  if (!def.cono) return def;
  // 1) pepitas: la escalera central se queda con menos; el resto, a lo largo de las calles (mitad de adentro, -1)
  for (const e of E) if (e.t === 'pepitas' && Math.abs(e.de[0]) < 1 && Math.abs(e.a[0]) < 1) e.n = Math.max(5, Math.round(e.n * 0.45));
  const pc = puntosCalle(def, -0.8, 5, 4).filter(q => distRuta(def, q.x, q.z) > 3 && libre(def, q.x, q.z, 1));
  // agrupar por calle (anillo y lado) y repartir filas de 4-5 pepitas en ~10 calles distintas
  const porCalle = new Map(); for (const q of pc) { const k = q.a.i + ':' + q.lado; (porCalle.get(k) || porCalle.set(k, []).get(k)).push(q); }
  const calles = [...porCalle.values()].filter(l => l.length >= 8).sort(() => r() - 0.5).slice(0, 12);
  for (const l of calles) {
    const i0 = Math.floor(r() * (l.length - 5)), fila = l.slice(i0, i0 + 5);
    for (let k = 0; k + 1 < fila.length; k++) push({ t: 'pepitas', de: [fila[k].x, fila[k].z], a: [fila[k + 1].x, fila[k + 1].z], n: 1 });
    const u = fila[fila.length - 1]; push({ t: 'pepitas', de: [u.x, u.z], a: [fila[0].x, fila[0].z], n: 1 });
  }
  // 2) objetos de faena junto a la baranda (lado de afuera de la calle, +6 m: queda libre el paso de adentro, ~8 m)
  const pf = puntosCalle(def, 6, 9, 8).filter(q => distRuta(def, q.x, q.z) > 6 && libre(def, q.x, q.z, 3)).sort(() => r() - 0.5);
  const lista = FAENA_CALLE[n], usados = [];
  for (const q of pf) {
    if (usados.length >= lista.length) break;
    if (usados.some(u => Math.hypot(u.x - q.x, u.z - q.z) < 30)) continue;
    usados.push(q); push({ t: 'faena', que: lista[usados.length - 1], x: q.x, z: q.z, giro: giroCalle(q) + (r() - 0.5) * 8 });
  }
  // máquinas en las plazas de faena (solo con la época)
  if (n === 3) {   // 1940: un tractor oruga (los primeros llegaron a la mina en los años 30) despejando la nieve de la plaza 126
    push({ t: 'faena', que: 'tractor', x: 30, z: -279, giro: 10 }); push({ t: 'faena', que: 'nieve', x: 35.5, z: -276, giro: 10 });
  }
  if (n === 4) {   // 1967: dos bulldozers estacionados en la plaza de la planta (cota 211), lejos de los rieles y la ruta
    push({ t: 'faena', que: 'bulldozer', x: 42, z: -519, giro: -8 }); push({ t: 'faena', que: 'bulldozer', x: 8, z: -520, giro: 6, color: 0xc9a227 });
    push({ t: 'faena', que: 'tambores', x: 58, z: -521, giro: 0 }); push({ t: 'faena', que: 'herramientas', x: -6, z: -521, giro: 0 });
  }
  // 3) gente: parejas que conversan y vecinos que caminan por las calles (densidad moderada)
  const pg = puntosCalle(def, 0.5, 8, 10).filter(q => distRuta(def, q.x, q.z) > 2.5 && libre(def, q.x, q.z, 2)).sort(() => r() - 0.5);
  const QUIEN = n === 3 ? ['minero', 'minero', 'vecina', 'anciana'] : ['minero', 'vecina', 'minero', 'anciana', 'vecina'];
  const gente = [], META = n === 2 ? 14 : 12;
  for (const q of pg) {
    if (gente.length >= META) break;
    if (gente.some(u => Math.hypot(u.x - q.x, u.z - q.z) < 26)) continue;
    gente.push(q);
    const quien = QUIEN[gente.length % QUIEN.length];
    if (gente.length % 3 === 0) {   // pareja conversando: uno frente al otro, a 1,6 m a lo largo de la calle
      const p2 = enAnillo(q.a.ta, q.f + 1.6 / q.a.R, 0.5);
      push({ t: 'gente', quien, x: q.x, z: q.z, mira: [+p2.x.toFixed(2), +p2.z.toFixed(2)], texto: dicho() });
      push({ t: 'gente', quien: quien === 'minero' ? 'vecina' : 'minero', x: +p2.x.toFixed(2), z: +p2.z.toFixed(2), mira: [q.x, q.z] });
    } else {   // camina de ida y vuelta 14-20 m por la calle
      const L = (14 + r() * 6) * (r() < 0.5 ? 1 : -1), f2 = q.f + L / q.a.R, A = q.a.lados[q.lado], lo = Math.min(A.f0, A.f1) + 8 / q.a.R, hi = Math.max(A.f0, A.f1) - 8 / q.a.R;
      const fb = Math.max(lo, Math.min(hi, f2)), p2 = enAnillo(q.a.ta, fb, 0.5);
      push({ t: 'gente', quien, x: q.x, z: q.z, a: [+p2.x.toFixed(2), +p2.z.toFixed(2)], texto: gente.length % 2 ? dicho() : null });
    }
  }
  // 4) reliquias: una por calle distinta, en anillos repartidos de abajo arriba y en los dos lados (lejos de la escalera central)
  const pr = puntosCalle(def, -1.2, 6, 10).filter(q => distRuta(def, q.x, q.z) > 8 && Math.abs(q.x) > 35 && libre(def, q.x, q.z, 2.5));
  const ids = RELIQ_NIVEL[n], tomadas = [];
  const anillosCon = [...new Set(pr.map(q => q.a.i))].sort((a, b) => a - b);
  for (let k = 0; k < ids.length && anillosCon.length; k++) {
    const ai = anillosCon[Math.min(anillosCon.length - 1, Math.floor((k + 0.5) * anillosCon.length / ids.length))], lado = k % 2 ? 1 : -1;
    let cand = pr.filter(q => q.a.i === ai && q.lado === lado && !tomadas.some(t => Math.hypot(t.x - q.x, t.z - q.z) < 40));
    if (!cand.length) cand = pr.filter(q => !tomadas.some(t => Math.hypot(t.x - q.x, t.z - q.z) < 40));
    if (!cand.length) break;
    // el punto más lejano de la escalera central (premia explorar la calle hasta el fondo)
    const q = cand.reduce((m, c) => Math.abs(c.x) > Math.abs(m.x) ? c : m);
    tomadas.push(q); push({ t: 'reliquia', id: ids[k], x: q.x, z: q.z });
  }
  return def;
}
// (radioAnillo se exporta para quien quiera reubicar a mano)
export { radioAnillo };
