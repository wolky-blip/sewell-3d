// Los 4 niveles en grey-box, con la ciudad armada según las fotos y las notas de arquitectura de Diego
// (datos/referencia_arquitectura.md). Coordenadas en metros: X oriente, Y arriba, Z sur (vía y valle). t = -z.
// Terrazas: base 0 m (vía, ~2.140 msnm) · cívica 60 m · plaza 126 m · alta 211 m · cumbre ~320 m.
// Si un objeto no trae «y», se apoya en lo que haya debajo (terreno, techo o plaza).
import { TEXTOS2D } from './textos2d.js';
import { altura } from '../mundo/terreno.js';
import { SEWELL_CONO, ajustarNivelCono } from '../mundo/ciudad.js';   // prototipo ?sewell=cono (carril ciudad)
import { agregarVida } from './vida.js';   // N0-VIDA (carril ciudad): faena, gente y reliquias por las calles

export const COLOR = {
  rojo: 0xa8432f, cobalto: 0x2f62b8, ocre: 0xd9a23a, verde: 0x5fae66, naranja: 0xe07a2e, crema: 0xefe2c0, celeste: 0x7fb6d8,
  turquesa: 0x4fb3a8, gris: 0x8c8f96, grisOscuro: 0x55585f, madera: 0xb5835a, piedra: 0x8e8478, roca: 0x6f625a, blanco: 0xf5f3ee,
  concreto: 0xb9b4aa, zinc: 0x9aa0a6, rojoTecho: 0xb2452f, negro: 0x1d1d22, cobre: 0xd27a3a, perla: 0xd8d6cf, amarillo: 0xf0c419,
};
const PALETA_CAMAROTES = [COLOR.rojo, COLOR.cobalto, COLOR.verde, COLOR.naranja, COLOR.ocre, COLOR.celeste, COLOR.turquesa, COLOR.crema];

// azar con semilla: la ciudad sale igual cada vez
function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ------------------------------------------------------------------ la ciudad (Niveles 2–4 y la escena de inicio)
// edificios especiales: se reservan su lugar para que los camarotes no se monten encima
function especiales(epoca) {
  const E = [];
  // cota base: estación, andén, vía y talleres
  E.push({ t: 'via', x0: -760, x1: 760, z: 22, y: 0 });
  E.push({ t: 'anden', x0: -40, x1: 130, z: 15.5, ancho: 5, y: 0.9 });
  E.push({ t: 'edificio', id: 'estacion', x: 45, z: 6, largo: 26, ancho: 11, pisos: 1, color: COLOR.ocre, techo: 'dos', nombre: epoca < 1915 ? null : 'SEWELL' });   // un solo edificio (dos copias chocaban); en 1905 sin letrero
  // talleres largos de un solo modelo (antes 2-3 copias en hilera con uniones). Lotes cerca de la proporción del modelo
  // (largo:fondo 4:1, alto 0,36 del largo): el de -175 calza sin estirar; el de -110 se estira ~1,4× en planta
  E.push({ t: 'edificio', id: 'taller_largo', x: -110, z: 2, largo: 40, ancho: 9, pisos: 3, color: COLOR.grisOscuro, techo: 'dos', techoColor: COLOR.zinc });
  E.push({ t: 'edificio', id: 'taller_largo', x: -175, z: -6, largo: 41, ancho: 10.5, pisos: 3, color: COLOR.gris, techo: 'dos', techoColor: COLOR.zinc });
  if (epoca < 1915) return E;
  // escalera central y terrazas
  E.push({ t: 'escalera', x0: 0, z0: -14, x1: 0, z1: -118, ancho: 5, id: 'tramo1' });
  E.push({ t: 'plaza', x: 0, z: -140, sx: 64, sz: 44, y: 60, color: COLOR.concreto, baranda: true });
  E.push({ t: 'escalera', x0: 0, z0: -162, x1: 0, z1: -268, ancho: 4.5, id: 'tramo2' });
  E.push({ t: 'plaza', x: 0, z: -296, sx: 82, sz: 56, y: 126, color: 0xc8bfae, baranda: true, nombre: 'plaza' });
  E.push({ t: 'escalera', x0: 0, z0: -324, x1: 0, z1: -458, ancho: 3, id: 'tramo3' });
  E.push({ t: 'plaza', x: 10, z: -492, sx: 120, sz: 66, y: 211, color: COLOR.concreto, integrar: true });   // integrar: el terreno corta y rellena hasta la losa (sobresalía 7 m)
  // cota cívica: pulpería (abajo) y cine (arriba)
  E.push({ t: 'edificio', id: 'pulperia', x: 19, z: -74, largo: 34, ancho: 18, pisos: 5, rot: 90, color: COLOR.ocre, techo: 'dos', nombre: 'PULPERÍA' });
  E.push({ t: 'edificio', id: 'cine', x: -21, z: -236, largo: 26, ancho: 20, pisos: 4, rot: 90, color: COLOR.crema, techo: 'artdeco', nombre: 'CINE',
    puerta: { sala: epoca >= 1960 ? 'cine67' : epoca >= 1930 ? 'cine45' : 'cine', lado: 'este' } });   // N4-SALAS: sala por época (sin la meta ni el apunte del N2)
  E.push({ t: 'edificio', id: 'palitroque', x: -66, z: -52, largo: 46, ancho: 12, pisos: 2, color: COLOR.madera, techo: 'dos', techoColor: COLOR.zinc, nombre: 'BOWLING',
    puerta: { sala: epoca >= 1960 ? 'palitroque67' : epoca >= 1930 ? 'palitroque45' : 'palitroque', lado: 'sur', marco: true } });   // N4-SALAS: sala por época   // marco: el modelo de Idol no trae puerta en ese lado
  // plaza: hospital en H (Edificio 157), correos y tenencia, escuela, club con gimnasio y piscina
  // terraza: 0 → el hospital queda al nivel de la plaza 126 (a media altura quedaba 7 m sobre ella y la puerta no se alcanzaba)
  E.push({ t: 'edificio', id: 'hospital', x: 40, z: -332, largo: 58, ancho: 14, pisos: 5, color: COLOR.verde, techo: 'dos', techoColor: COLOR.rojoTecho, numero: '157',
    puerta: { sala: epoca >= 1960 ? 'hospital67' : epoca >= 1930 ? 'hospital' : 'hospital157', lado: 'sur', nombre: 'HOSPITAL' }, terraza: 0 });   // N4-SALAS: el N3 conserva su hospital (ascensor y apunte 3); N2 y N4, el hospital del kit (kitHospital.js)
  // alas en la ladera: comparten la terraza del cuerpo central (terrazaCon), así el hospital en H queda a una sola cota;
  // con terraza propia quedaba un escalón de 6-14 m que se leía como pedestal (el cerro de atrás queda cortado)
  E.push({ t: 'edificio', id: 'hospital_ala', x: 17, z: -356, largo: 36, ancho: 13, rot: 90, pisos: 5, color: COLOR.verde, techo: 'dos', techoColor: COLOR.rojoTecho, terrazaCon: 'hospital' });
  E.push({ t: 'edificio', id: 'hospital_ala', x: 63, z: -356, largo: 36, ancho: 13, rot: 90, pisos: 5, color: COLOR.verde, techo: 'dos', techoColor: COLOR.rojoTecho, terrazaCon: 'hospital' });
  E.push({ t: 'edificio', id: 'correos', x: -58, z: -290, largo: 22, ancho: 14, pisos: 3, color: COLOR.perla, techo: 'dos', techoColor: COLOR.rojoTecho });
  E.push({ t: 'edificio', id: 'escuela', x: 72, z: -287, largo: 46, ancho: 12, pisos: 4,   /* N0-EMB: Escuela Industrial (ed. 129), 4 pisos */ color: COLOR.ocre, techo: 'dos', techoColor: COLOR.rojoTecho });
  E.push({ t: 'edificio', id: 'club', x: -96, z: -322, largo: 40, ancho: 22, pisos: 3, color: COLOR.cobalto, techo: 'dos', nombre: epoca >= 1930 ? 'TENIENTE CLUB' : null,   /* Diego 15-11: sin «gimnasio» en el club */
    puerta: { sala: epoca >= 1930 && epoca < 1950 ? 'club45' : 'club', lado: 'sur', propia: true, nombre: 'TENIENTE CLUB' } });   // N0-EMB9: se entra por el pórtico en todas las épocas (sala de 3 niveles, kitClub.js)
  // N0-EMB: iglesia (edificio 231), desde temprano en el campamento; la nave va a lo largo de la calle (sin nube: kit iglesia231)
  E.push({ t: 'edificio', id: 'iglesia', x: 34, z: -250, largo: 22, ancho: 11, pisos: 2, color: COLOR.celeste, techo: 'dos', techoColor: COLOR.rojoTecho,
    puerta: { sala: 'iglesia', lado: 'este', propia: true } });   // propia: el kit trae su pórtico y su puerta abierta (sin cortavientos del juego)
  // cota alta: planta, concentradora y boca de mina (acero, gris y negro)
  E.push({ t: 'edificio', id: 'concentradora', x: 110, z: -560, largo: 70, ancho: 30, pisos: 4, color: COLOR.grisOscuro, techo: 'dos', techoColor: COLOR.negro });
  E.push({ t: 'edificio', id: epoca >= 1960 ? 'taller_n4' : 'taller', x: 30, z: -600, largo: 50, ancho: 24, pisos: 3, color: COLOR.gris, techo: 'dos', techoColor: COLOR.zinc });   // N4-G5: en 1967 el taller es una sola pieza (semilla 5803, fila 3 de capturas/hojas/hoja_taller_n4.png)
  E.push({ t: 'roca', x: 175, z: -660, sx: 40, sy: 30, sz: 30 });
  return E;
}

// camarotes: bloques largos paralelos a las curvas de nivel (40–60 × 12–15 m, 4–5 pisos), en filas entre las terrazas
function camarotes(epoca, reservas, semilla) {
  const r = azar(semilla), lista = [];
  const bandas = [[24, 112], [170, 262], [332, 452]];
  const choca = (x, z, l, a) => reservas.some(e => e.t === 'edificio' && Math.abs(e.x - x) < ((e.rot ? e.ancho : e.largo) + l) / 2 + 4 && Math.abs(e.z - z) < ((e.rot ? e.largo : e.ancho) + a) / 2 + 4)
    || reservas.some(e => e.t === 'plaza' && Math.abs(e.x - x) < (e.sx + l) / 2 + 2 && Math.abs(e.z - z) < (e.sz + a) / 2 + 2);
  let k = 0;
  for (const [t0, t1] of bandas) {
    for (let t = t0 + 8; t < t1 - 6; t += 21 + r() * 4) {
      for (const lado of [-1, 1]) {
        let x = lado * (9 + r() * 4);
        while (Math.abs(x) < 210) {
          const largo = 40 + Math.floor(r() * 20), ancho = 12 + Math.floor(r() * 3);
          const cx = x + lado * largo / 2;
          if (!choca(cx, -t, largo, ancho) && (epoca >= 1925 || r() < 0.7)) {
            lista.push({ t: 'edificio', x: cx, z: -t, largo, ancho, pisos: epoca >= 1925 ? 4 + Math.floor(r() * 2) : 3 + Math.floor(r() * 2),
              color: PALETA_CAMAROTES[k++ % PALETA_CAMAROTES.length], techo: 'dos', ropa: r() < 0.5 });
          }
          x += lado * (largo + 6 + r() * 6);
        }
      }
    }
  }
  return lista;
}

// N3-C13: un pasaje de escalera angosto entre dos camarotes corta la malla del terreno (vértices cada 5 m) hasta 5 m dentro de
// los lotes vecinos y sus podios bajaban 5-6 m al foso. Esto recorta esos lotes para que su borde quede a 7 m del eje del pasaje
// (sin quitar camarotes: los colores de la hilera no cambian)
const apartarDePasaje = (xc, za, zb, d = 7) => e => {
  if (e.t !== 'edificio' || e.id || e.rot || e.z + e.ancho / 2 < Math.min(za, zb) || e.z - e.ancho / 2 > Math.max(za, zb)) return e;
  const x0 = e.x - e.largo / 2, x1 = e.x + e.largo / 2;
  if (e.x > xc && x0 < xc + d) { const n0 = xc + d; return { ...e, x: (n0 + x1) / 2, largo: x1 - n0, terraza0: { x: e.x, largo: e.largo } }; }
  if (e.x < xc && x1 > xc - d) { const n1 = xc - d; return { ...e, x: (x0 + n1) / 2, largo: n1 - x0, terraza0: { x: e.x, largo: e.largo } }; }
  return e;
};

function ciudad(epoca, semilla = 7, reservas = []) {   // reservas: lugares propios del nivel donde no van camarotes
  const E = especiales(epoca);
  return epoca < 1915 ? E : E.concat(camarotes(epoca, E.concat(reservas.map(r => ({ t: 'plaza', ...r }))), semilla));
}
// una fila de pepitas entre dos puntos
const pepitas = (x0, z0, x1, z1, n, y) => ({ t: 'pepitas', de: [x0, z0], a: [x1, z1], n, y });

// ------------------------------------------------------------------ interiores (escenas aparte, se entra por una puerta con fundido)
// Coordenadas locales: la sala se arma en su propio lugar lejos del mundo y nunca se ve desde afuera.
// N0-EMB9 (carril kit): Teniente Club (ed. 20) por dentro, 3 niveles (kitClub.js salaClub): piscina temperada en el zócalo (piso de la sala = fondo
// de la piscina, cubierta a 2,0), vestíbulo con la escalera imperial y sala del espejo (6,4), salón con arañas y columnata (11,4). Entrada a y 6,4.
const CLUB = { nombre: 'EL TENIENTE CLUB', ancho: 22, largo: 34, alto: 16.2, piso: 0x8c8478, muro: 0xf0e0b4, techo: 0xf6eedb, kit: 'club20', sinLamparas: true, sinPortal: true, luzK: 0, vapor: 0.5,
  elementos: [], entrada: { x: 0, z: -2, y: 6.4 } };
const SALAS = {
  fortuna: { nombre: 'LAS CAVERNAS DE LA MINA FORTUNA', ancho: 14, largo: 80, alto: 6, pisoHasta: -40,   // Fortuna 4 arriba; Fortuna 5, 8 m más abajo
    piso: COLOR.roca, muro: 0x4a403a, oscura: true, roca: true, tunelFondo: true,   // tunelFondo: la vía sale de un túnel en el muro del fondo (mina.js)
    elementos: [
      // G12 (16-11, F01 de C6; Diego: «las literas y las cajas se ven muy básicas»): literas FINAS de madera rústica (mueblesFinos_mina.js) y
      // cajones/mesa de la utilería; las cajas de antes quedan de respaldo (colisión y vista mientras la pieza no carga)
      ...[[-8, 'litera_mina'], [-12, 'litera_mina_b']].map(([z, id]) => ({ t: 'pieza', id, x: -4.5, z, respaldo: [
        { x: -4.5, y: 0.96, z, sx: 3, sy: 0.12, sz: 1.1 }, { x: -4.5, y: 2.36, z, sx: 3, sy: 0.12, sz: 1.1 },
        ...[[-5.94, z - 0.5], [-5.94, z + 0.5], [-3.06, z - 0.5], [-3.06, z + 0.5]].map(([x, zz]) => ({ x, y: 1.42, z: zz, sx: 0.1, sy: 2.85, sz: 0.1 }))] })),
      { t: 'pieza', id: 'cajon_grande', x: 4.3, z: -18.3, ry: 8, esc: [0.62, 0.62, 0.62], respaldo: [{ x: 4.3, y: 0.5, z: -18.3, sx: 1, sy: 1, sz: 1 }] },
      { t: 'pieza', id: 'cajon', x: 4.25, y: 0.99, z: -18.35, ry: -14, esc: [1.05, 1.05, 1.05], respaldo: [{ x: 4.25, y: 1.31, z: -18.35, sx: 0.84, sy: 0.63, sz: 0.58 }] },
      { t: 'pieza', id: 'cajon', x: 3.15, z: -17.6, ry: 24, esc: [1.1, 1.1, 1.1], respaldo: [{ x: 3.15, y: 0.33, z: -17.6, sx: 0.88, sy: 0.66, sz: 0.6 }] },
      { t: 'pieza', id: 'mesa_rustica', x: 4.3, z: -21.6, ry: 90, esc: [1.3, 1, 1.25], respaldo: [{ x: 4.3, y: 0.39, z: -21.6, sx: 1.0, sy: 0.78, sz: 1.56 }] },
      { t: 'pieza', id: 'banca_rustica', x: 3.35, z: -21.6, ry: 90, respaldo: [{ x: 3.35, y: 0.22, z: -21.6, sx: 0.32, sy: 0.44, sz: 1.6 }] },
      { t: 'pieza', id: 'candil', x: 4.55, y: 0.78, z: -22.1 },
      { t: 'npc', quien: 'anciana', x: 4, z: -20, texto: 'Aquí las mujeres cocinamos y vivimos igual que los hombres, en estos mismos túneles.' },
      { t: 'minero', x: -3.4, z: -12, dormido: true, litera: { y: 1.12, dx: -0.45 } }, { t: 'pan', x: 4.4, y: 0, z: -23.6 },   // duerme en la litera de abajo
      { t: 'apunte', i: 2, x: -4.5, y: 3.2, z: -12 },
      { t: 'letrero', x: 2.2, z: -37, texto: 'La escalera de El Fraile baja de Fortuna 4 al nivel de acarreo, Fortuna 5. ¡Cuidado con las vagonetas!' },
      { t: 'rampa', x: 4.3, z0: -40, z1: -50, y0: 0, y1: -8, ancho: 3 },   // escalera de El Fraile (N1-FORTUNA-TUNEL: a un costado, la vía sigue al túnel)
      { t: 'caja', x: 0, y: -8.5, z: -60, sx: 14, sy: 1, sz: 40, color: COLOR.roca },   // piso de Fortuna 5 (bajo la escalera y la galería)
      { t: 'caja', x: 0, y: -4.8, z: -19.9, sx: 14, sy: 7.6, sz: 40.2, color: COLOR.roca, soloFis: true },   // soloFis: sin malla (tapaba la boca del túnel de la vía); cierra el paso al túnel   // roca maciza bajo Fortuna 4: antes había un vacío sin piso (caída infinita, visto por Diego 12-11-2026)
      { t: 'rieles', x: 0, y: 0, z0: -4, z1: -38 },   // rieles también en Fortuna 4
      { t: 'rieles', x: 0, y: -8, z0: -27, z1: -93 },   // N1-FORTUNA-TUNEL: entran al túnel bajo Fortuna 4
      { t: 'vagonetas', de: [0, -92.5], a: [0, -28.5], y: -8, cada: 5 },   // nacen en la oscuridad del túnel del fondo (N1-FORTUNA-TUNEL2)   // se pierden en la oscuridad del túnel
      { t: 'minero', x: -5.6, z: -46, y: -8 },   // N1-FORTUNA-PASEO: junto al muro izquierdo, lejos de la palanca (antes en x 2, z -66: perseguía a Nato junto a la vagoneta y se metía en la vía)
      { t: 'fogata', x: -4, z: -58, y: -8 },
    ],
    entrada: { x: 0, z: -2, y: 0 }, salida: { x: -4.7, z: -79, y: -8 } },   // salida a un costado del muro del fondo (la vía entra al túnel)
  // N0-EMB (carril kit): interior del edificio 106 según la foto de Diego (kit: barandas, divisor, pilares, ventanas, zócalo de piedra, cuadros, globos)
  palitroque: { nombre: 'EL PALITROQUE', ancho: 14, largo: 50, alto: 6, piso: 0xc8925a, muro: 0xf4f1ea, techo: 0xf4f2ec, pisoTapiz: 'tablas', kit: 'palitroque106',
    elementos: [
      { t: 'caja', x: -3, y: 0.05, z: -25, sx: 2, sy: 0.1, sz: 40, tapiz: 'pista' }, { t: 'caja', x: 3, y: 0.05, z: -25, sx: 2, sy: 0.1, sz: 40, tapiz: 'pista' },   // pistas de maple
      ...[-4.2, -1.8, 1.8, 4.2].map(x => ({ t: 'caja', x, y: 0.02, z: -25, sx: 0.36, sy: 0.04, sz: 40, color: 0x3a3530 })),   // canaletas a los lados de cada pista
      { t: 'banco', x: -6.55, z: -20, largo: 8 }, { t: 'banco', x: 6.55, z: -30, largo: 8 },   // en los pasillos junto a las ventanas
      { t: 'palos', x: -3, z: -46 }, { t: 'palos', x: 3, z: -46, juega: true },   // juega: los pinos de esta pista los pone el bolero (js/juego/boleroJuega.js)
      { t: 'jugadorBolos', x: 3, z: -4.4, juega: { zPalos: -46 } },   // 16-11 (Diego): un ciudadano de época (antes un minero enemigo) · N2-C34: juega a los bolos en la pista derecha (toma bola del soporte, lanza, derriba pinos)
      { t: 'minero', x: -3, z: -30 },
      { t: 'apunte', i: 1, x: -6.55, y: 1.3, z: -20 },
    ],
    entrada: { x: 0, z: -2 }, salida: { x: 0, z: -48 } },
  // N0-EMB7 (carril kit): interior de la Iglesia (ed. 231) según el cuadro 92 del video: nave celeste con bancas, gran arco al presbiterio, altar, cruz, banderas (kitEmblemas.js salaIglesia)
  iglesia: { nombre: 'LA IGLESIA', ancho: 12.4, largo: 24, alto: 8.8, piso: 0xd6cfc0, muro: 0xa6c7e4, techo: 0xf4f1e8, kit: 'iglesia231', sinLamparas: true, sinPortal: true, luzK: 0.3,   // N0-EMB8: interior como en el video (nave, naves laterales, coro, presbiterio)
   
    elementos: [],
    entrada: { x: 0, z: -2 } },
  cine: { nombre: 'EL CINE · 680 BUTACAS', ancho: 26, largo: 34, alto: 12, piso: 0x5a1f22, muro: 0x2a1418, oscura: true, tapiz: 'brocado', techo: 0x24100f, pisoTapiz: 'tablas', kit: 'teatro165', sinCielo: true,   // N2-C35: interior del Teatro 165 según los planos de 1937 (salaTeatro, kitEmblemas.js): cerchas, bóveda, escenario elevado
    elementos: [
      { t: 'caja', x: 0, y: 1.7, z: -2.5, sx: 26, sy: 3.4, sz: 5, color: COLOR.madera },   // galería de entrada, arriba
      ...Array.from({ length: 8 }, (_, i) => ({ t: 'caja', x: 0, y: 0.2 * (8 - i), z: -6 - i * 2.2, sx: 20, sy: 0.4 * (8 - i), sz: 2.2, color: COLOR.madera })),   // gradas de madera que bajan hacia la pantalla
      { t: 'butacas', x: 0, filas: 8, alto0: 3.2, dAlto: -0.4, z0: -6, paso: 2.2, ancho: 20, pasillo: 2 },   // butacas de terciopelo sobre las gradas
      { t: 'pantalla', x: 0, y: 6, z: -33.5, sx: 18, sy: 7 },
      { t: 'telon', x: 0, z: -33.3, ancho: 18, lado: 3.6, alto: 10.4, bambalina: 1.7 },
      { t: 'proyector', x: 0, y: 8.8, z: -1.6 },
      { t: 'haz', de: [0, 8.8, -1.95], a: [0, 6, -33.42], sx: 18, sy: 7 },
      { t: 'minero', x: -11.5, z: -12 }, { t: 'minero', x: 11.5, z: -20 },   // en los pasillos laterales (antes dentro de las gradas)
      { t: 'apunte', i: 4, x: 10, y: 2.1, z: -30 },   // sobre el escenario (0,9 m)
      { t: 'meta', x: 0, y: 0.9, z: -30, r: 4, tipo: 'cine' },
    ],
    entrada: { x: 0, z: -2, y: 3.4 } },
  club: CLUB,
  // 1945 (invierno): más vapor sobre el agua tibia; el apunte 1, los mineros y el pan que antes estaban en el gimnasio
  club45: { ...CLUB, vapor: 1, elementos: [
    { t: 'apunte', i: 1, x: 0, y: 1.25, z: -13.2 },   // en la parte baja de la piscina (fondo 0,9; agua 1,7)
    { t: 'minero', x: 7.5, y: 2.0, z: -20 }, { t: 'minero', x: -6, y: 11.4, z: -30 },
    { t: 'pan', x: 9.2, y: 6.4, z: -33 },   // en un rincón de la sala del espejo
  ] },
  // C7 (finos C, 16-11, decisión del coordinador A11): el hospital del N3 (1940) es el kit hospital157 de 2 pisos, igual que N2 y N4 (antes: sala genérica
  // de 18 × 40 con camas, rayos X y estantes de cajas, y un ascensor suelto). Se conservan sus npc, el apunte 3, el minero del 2.º piso y la salida
  // por el 2.º piso hacia la cornisa del jefe; el ascensor y la escalera los pone el kit. La sala vieja queda en capturas/coordinacion/respaldo_c/niveles.js.antesC7.
  hospital: { nombre: 'EL HOSPITAL DEL EDIFICIO 157', ancho: 14, largo: 34, alto: 4.2, pisos: 2, piso: 0xd7e6dc, muro: 0xeeeadc, techo: 0xf2f4ee, pisoTapiz: 'damero',
    kit: 'hospital157', epoca: 1940, sinLamparas: true, luzK: 0,
    elementos: [
      { t: 'npc', quien: 'enfermera', x: 4.4, z: -15.2, texto: 'Bienvenido al hospital del Edificio 157, el más moderno de Chile: ¡hasta tiene ascensor! Súbete y aprieta E para subir.' },
      { t: 'npc', quien: 'medico', x: -1.4, z: -24.4, texto: 'Aquí tenemos incubadoras, laboratorio farmacéutico, salas de operaciones, cuidados intensivos y rayos X.' },
      { t: 'apunte', i: 3, x: -5, y: 5.6, z: -10 },   // 2.º piso, en el hall junto a la baranda de la escalera
      { t: 'minero', x: -2, z: -14, y: 4.6 },
    ],
    entrada: { x: 0, z: -2 }, salida: { x: -1.0, z: -33, y: 4.6 } },   // HOSP-SALIDA (17-11, pedido de Diego): la salida va empotrada en el muro del fondo de la ÚLTIMA sala del 2.º piso (maternidad), no suelta en medio del hall
};

// N4-SALAS (15-11-2026): salas por época para las puertas que tenían disparador y no sala (E no hacía nada).
// Hospital del Edificio 157 hecho con el kit (kitHospital.js): hall, mampara, sala de espera, mesón de enfermería, vitrina de
// medicamentos, sala de camas de hierro con biombos. Cine y palitroque del N3/N4: la sala del N2 sin la meta ni el apunte del N2
// (los índices de apunte son de cada nivel) y, en 1967, adornos de la Operación Valle (adornosEpoca en kitHospital.js).
const HOSP = { nombre: 'EL HOSPITAL DEL EDIFICIO 157', ancho: 14, largo: 34, alto: 4.2, pisos: 2, piso: 0xd7e6dc, muro: 0xeeeadc, techo: 0xf2f4ee, pisoTapiz: 'damero',
  kit: 'hospital157', sinLamparas: true, luzK: 0, entrada: { x: 0, z: -2 } };
SALAS.hospital157 = { ...HOSP, epoca: 1920, elementos: [
  { t: 'npc', quien: 'enfermera', x: 4.4, z: -15.2, texto: 'Bienvenido al hospital del Edificio 157. Lo inauguramos el año pasado y ya dicen que es el más moderno de Chile. ¡Suba en el ascensor: arriba están los rayos X, el pabellón y la maternidad!' },
  { t: 'npc', quien: 'enfermera', nombre: 'Matrona', x: 2.2, y: 4.6, z: -31.3, texto: 'Shhh, que duermen. Esta incubadora llegó de Europa: mantiene tibias a las guaguas que nacen antes de tiempo.' },   // N4-HOSP2: 2.º piso
  { t: 'npc', quien: 'medico', nombre: 'Cirujano', x: -2.4, y: 4.6, z: -20.8, texto: '¿Ve esa lámpara? Es una cialítica, recién inventada en Francia: ilumina la herida sin dejar sombras.' },
  { t: 'npc', quien: 'medico', x: -1.4, z: -24.4, texto: 'Tenemos rayos X, salas de operaciones, laboratorio farmacéutico y hasta incubadoras para las guaguas.' },
  { t: 'npc', quien: 'anciana', x: -5.3, z: -9.0, texto: 'Vengo a ver a mi hijo: se golpeó en la mina. Aquí lo atienden bien, gracias a Dios.' },
] };
SALAS.hospital67 = { ...HOSP, epoca: 1967, adornosPropios: true, elementos: [
  { t: 'npc', quien: 'enfermera', x: 4.4, z: -15.2, texto: 'Aquí nacieron generaciones de sewellinos. Con la Operación Valle, muchas familias ya están bajando a Rancagua.' },
  { t: 'npc', quien: 'medico', x: -1.4, z: -24.4, texto: 'Medio siglo atendiendo a los mineros y sus familias: rayos X, pabellón, incubadoras. Fue de los hospitales más modernos del país.' },
  { t: 'npc', quien: 'anciana', x: -5.3, z: -9.0, texto: '¿Usted también se va a Rancagua, mijito? Allá dicen que hay que pagar la luz y el agua.' },
  { t: 'npc', quien: 'enfermera', nombre: 'Matrona', x: 2.2, y: 4.6, z: -31.3, texto: 'En estas incubadoras se salvaron cientos de guaguas. Me da pena pensar que el hospital se va a cerrar.' },   // N4-HOSP2: 2.º piso
  { t: 'npc', quien: 'medico', nombre: 'Cirujano', x: -2.4, y: 4.6, z: -20.8, texto: 'Aquí operamos a los accidentados de la mina día y noche. El ascensor sube las camillas directo al pabellón.' },
] };
// N2-ESCUELA (carril interiores, 15-11-2026; decisión de Diego): la Escuela Industrial (ed. 129) tiene interior (kitEscuela.js):
// hall, pasillo, salón de clases y taller mecánico, por época; en el modo turista es el Museo de la Gran Minería del Cobre de hoy.
// La puerta la pone escuelaAcceso (kitEmblemas.js) en el descanso de la escalera lateral y elige la sala por época / turismo.
const ESC = { nombre: 'LA ESCUELA INDUSTRIAL · EDIFICIO 129', ancho: 14, largo: 36, alto: 4.2, piso: 0x8a6a48, muro: 0xe6dcc2, techo: 0xf0ebdc, pisoTapiz: 'tablas',
  kit: 'escuela129', sinLamparas: true, luzK: 0, adornosPropios: true, entrada: { x: 0, z: -0.9 } };   // N2-ESCUELA2: el disparador de salida junto a la puerta (antes a 2 m, en medio del hall: cruzar el hall te sacaba a la calle)
const PROF = { t: 'npc', quien: 'medico', nombre: 'Profesor', x: 0.4, y: 0.2, z: -6.0 }, MAESTRO = { t: 'npc', quien: 'minero', nombre: 'Maestro de taller', x: -2.9, z: -24.6 };
SALAS.escuela20 = { ...ESC, epoca: 1920, elementos: [
  { ...PROF, texto: '¡Buenos días! Aquí los hijos de los trabajadores aprenden a leer, a contar y a dibujar planos. Los más hábiles pasan al taller.' },
  { ...MAESTRO, texto: 'Cada torno lo mueve el eje de transmisión con sus correas. ¡Ojo con las manos: la correa no perdona!' },
] };
SALAS.escuela45 = { ...ESC, epoca: 1940, elementos: [
  { ...PROF, texto: 'Formamos técnicos para la mina: mecánicos, electricistas y dibujantes. Muchos terminan trabajando en la Braden.' },
  { ...MAESTRO, texto: 'Llegaron motores nuevos para la clase de electrotecnia. El que aprende aquí tiene pega segura en la mina.' },
] };
SALAS.escuela67 = { ...ESC, epoca: 1967, elementos: [
  { ...PROF, texto: 'Con la Operación Valle, el próximo año las clases siguen en Rancagua. Da pena dejar este edificio.' },
  { ...MAESTRO, texto: 'Los tornos bajan al valle en el tren. Medio siglo formando mecánicos aquí arriba…' },
] };
SALAS.museo = { ...ESC, nombre: 'MUSEO DE LA GRAN MINERÍA DEL COBRE', kit: 'museo129', muro: 0xf2f0ea, techo: 0xf4f3ee, piso: 0x9a7a58, elementos: [
  { t: 'npc', quien: 'vecina', nombre: 'Guía del museo', x: 5.0, z: -2.5,   /* N2-ESCUELA2: junto al mesón (antes en la boca del pasillo) */ texto: 'Bienvenido al Museo de la Gran Minería del Cobre. Este edificio fue la Escuela Industrial de Sewell; hoy cuenta la historia del campamento y de la mina El Teniente.' },
  { t: 'npc', quien: 'anciana', nombre: 'Exalumna', x: 0.2, z: -29.5, texto: 'Yo estudié en este mismo edificio… Donde está la locomotora estaba el taller de tornos. ¡Aquí hubo mucha felicidad!' },
] };
const sinMeta = l => l.filter(e => e.t !== 'meta' && e.t !== 'apunte');
SALAS.cine45 = { ...SALAS.cine, epoca: 1945, elementos: [...sinMeta(SALAS.cine.elementos),
  { t: 'npc', quien: 'vecina', x: 11.5, z: -8, texto: 'Afuera cae la nevazón, pero aquí adentro la función sigue. Las películas llegan casi al mismo tiempo que en Estados Unidos.' }] };
SALAS.cine67 = { ...SALAS.cine, epoca: 1967, nombre: 'EL CINE · 1967', elementos: [...sinMeta(SALAS.cine.elementos),
  { t: 'npc', quien: 'anciana', x: 11.5, z: -8, texto: 'Vengo a una de las últimas funciones antes de bajar a Rancagua. Aquí vi todas las películas de mi vida.' }] };
SALAS.palitroque45 = { ...SALAS.palitroque, epoca: 1945, elementos: [...sinMeta(SALAS.palitroque.elementos),
  { t: 'npc', quien: 'vecina', x: -6.2, z: -13, texto: 'Con este invierno, el palitroque es el mejor refugio: aquí nos juntamos todos después del turno.' }] };
SALAS.palitroque67 = { ...SALAS.palitroque, epoca: 1967, elementos: [...sinMeta(SALAS.palitroque.elementos),
  { t: 'npc', quien: 'vecina', x: -6.2, z: -13, texto: 'Medio siglo de palitroque… Antes de irnos a Rancagua, una última partida con los vecinos.' }] };

// ------------------------------------------------------------------ niveles
const N = TEXTOS2D.niveles;

export const NIVELES = {
  1: {
    ...N[1], numero: 1, epoca: 1905, sol: { alto: 0.75, tono: 0xfff2dc }, nieveDesde: 225, niebla: 0xcfd8e3,
    laderaNatural: true,   // en 1905 no hay ciudad: ladera suave, sin las terrazas planas de lado a lado (terreno.js)
    brumaLejos: 6000,      // aire limpio de altura: con 3200 m la cordillera al sureste del campamento era un muro gris
    inicio: { x: -425, z: -470, rumbo: -Math.PI * 0.7 },
    // la mina Fortuna entra al cerro: colina cortada en un frente de roca donde están la bocamina (oeste) y la salida del túnel (sur)
    cerros: [
      // (el cerro de la bocamina ya no es una colina cortada: la boca es un macizo de roca propio, bocaminaReal en construir.js)
      // (el cerro de la salida del túnel tampoco: la salida es un macizo de roca propio, bocaminaReal en construir.js)
    ],
    zonas: [[0, 'CERRO NEGRO · 1905'], [1, 'LA CASA DE HAMILTON Y EL TRANVÍA AÉREO'], [2, 'LAS CAVERNAS DE LA MINA FORTUNA'], [3, 'PUEBLO HUNDIDO'], [4, 'EL MOLINO Y LAS FUNDICIONES']],
    elementos: [
      ...especiales(1905),
      // Cerro Negro: carpas y fogatas
      ...[[-440, -480], [-415, -492], [-398, -470], [-430, -452]].map(([x, z]) => ({ t: 'carpa', x, z })),
      { t: 'zona', i: 0, x: -425, z: -470, r: 30 },
      { t: 'fogata', x: -410, z: -458 },
      { t: 'letrero', x: -418, z: -455, texto: 'Muévete con WASD o la palanca (Shift: correr), salta con Espacio (dos veces: doble salto). Golpea con J (tres seguidos: combo), patada con K, Hércules con C y E para hablar o entrar.' },
      pepitas(-410, -450, -360, -360, 10),
      { t: 'minero', x: -385, z: -405 },
      { t: 'apunte', i: 0, x: -446, z: -485 },
      // casa de Hamilton y andarivel sobre el barranco
      { t: 'zona', i: 1, x: -345, z: -335, r: 28 },
      { t: 'edificio', id: 'hamilton3', nombre: 'CASA HAMILTON', x: -351.5, z: -330.8, largo: 17, ancho: 10, pisos: 2, color: COLOR.piedra, techo: 'dos', techoColor: COLOR.zinc, patio: 7, margenTerraza: 6, ventanasExtra: { lado: 'oeste', dentro: 0.55, v: [[-1.8, 2.3], [1.8, 2.3]] } },   // N1-HAMILTON-c (15-11, Diego: «agrandar la casa»): 17 × 10 (+46 % en planta; antes 13,9 × 8,4 en x −350, z −330): fachada del frente y lado oriente en el mismo lugar, crece al poniente y al fondo   // ventanasExtra: N1-O5 (hastial poniente ciego)   // N1-C66: solo la planta baja (el piso de arriba ya trae sus dos ventanas en el modelo: quedaban dobles) y 0,55 m adentro (flotaban fuera del muro)   // v3b sin estirar (13,9 x 8,4 m); respaldo: id 'hamilton' con largo 16, ancho 12 y nombre 'HAMILTON'
      // piedras de borde del patio de la casa de Hamilton (lado sur)
      ...[[-358, 0.5], [-353, 0.7], [-347, 0.6], [-342, 0.8]].map(([x, h]) => ({ t: 'roca', x, z: -316.8, sx: 1.6, sy: h, sz: 1.2 })),
      { t: 'apunte', i: 1, x: -357, z: -318 },
      { t: 'letrero', x: -322.6, z: -314, texto: 'Sube al capacho del andarivel desde el andén para cruzar el barranco.' },
      { t: 'plataforma', x: -330, z: -300, sx: 8, sz: 8, color: COLOR.madera, andarivel: true, peldano: [-330, -304] },   // andén de embarque (peldaños donde llega el camino)
      { t: 'andarivel', a: [-330, null, -300], b: [-268, null, -300], capachos: 3, periodo: 9, id: 'hamilton' },
      { t: 'plataforma', x: -268, z: -300, sx: 8, sz: 8, color: COLOR.madera, andarivel: true, giro: 180, peldano: [-268, -306] },   // N1-ABASTECIMIENTO-c (Diego: volver en el andarivel): peldaños al norte para subir al andén B y abordar un capacho de vuelta
      { t: 'letrero', x: -263.5, z: -309.5, texto: 'Sube al capacho para volver a la Casa Hamilton.' },
      { t: 'condor', x: -300, z: -330, alto: 14 },
      { t: 'barranco' },
      // bocamina de Fortuna: túnel hacia el interior del cerro (el cerro está en cerros:)
      { t: 'bocamina', x: -240.6, z: -292, rot: -90, sala: 'fortuna', nombre: 'MINA FORTUNA' },
      { t: 'fogata', x: -256, z: -292 },
      { t: 'zona', i: 2, x: -245, z: -292, r: 12 },
      // Pueblo Hundido: casas de piedra con techo de zinc, panadería y ropa tendida
      { t: 'tunel', x: -190, z: -204.4, rot: 0, sala: 'fortuna', lado: 'salida' },
      { t: 'zona', i: 3, x: -170, z: -180, r: 30 },
      ...[[-160, -185], [-140, -170], [-180, -160], [-150, -145], [-120, -155]].map(([x, z], i) => ({ t: 'edificio', x, z, largo: 10, ancho: 8, pisos: 1, color: COLOR.piedra, techo: 'dos', techoColor: COLOR.zinc, ropa: i % 2 === 0, terrazaPeso: 8, ...(x === -140 ? { margenBase: 0.5, terraza: 0.6 } : {}) })),   // -140: N1-A3 (la base ya no sube por la terraza de la panadería)   // N1-C59: terraza que manda (sin podios de 3-5 m)
      { t: 'edificio', id: 'panaderia', x: -125, z: -185, largo: 12, ancho: 9, pisos: 1, color: 0xa08868, techo: 'dos', techoColor: COLOR.zinc, nombre: 'PANADERÍA', terrazaPeso: 8, margenTerraza: 3, margenBase: 1 },   // N1-C59: su terraza manda sobre caminos y vecinas (podio de 5,7 m)
      { t: 'edificio', id: 'camarote1905', x: -105, z: -205, largo: 22, ancho: 10, pisos: 2, color: COLOR.madera, techo: 'dos', techoColor: COLOR.zinc, terrazaPeso: 8, podioReal: true },   // camarote (N1-A3: terraza que manda, sin podio de 3,7 m)
      { t: 'pan', x: -125, z: -176 }, { t: 'fogata', x: -150, z: -160 },
      { t: 'minero', x: -139, z: -142 }, { t: 'minero', x: -111, z: -149 },   // DEFECTOS-1611: antes (-140,-158) y (-120,-140), patrullaban (radio 5 m) sobre la calle de la yunta; ahora a ≥ 9 m del camino
      { t: 'apunte', i: 3, x: -104, z: -192 },   // N1-C64: el camarote ahora tiene su planta real (hasta z -195,9)
      { t: 'diego', x: -165, z: -150 },
      pepitas(-185, -195, -110, -130, 14),
      // El Molino y las fundiciones: ollas de cobre colgadas
      { t: 'zona', i: 4, x: -60, z: -70, r: 35 },
      // N1-MOLINO (carril kit, 15-11): planta de 1905 escalonada en la ladera (molino de tablas en 3 cuerpos, fundición abierta al sur con horno,
      // carro vaciador y moldes, 2 chimeneas humeando): js/mundo/kitFundicion.js. Respaldo de la caja antigua: capturas/coordinacion/respaldo_molino/
      { t: 'fundicion', id: 'molino', x: -62, z: -76.5, via: -75 },
      // N0-OLLAS: playa de maniobras (rellano plano al costado de la ladera, vía de trocha angosta a lo largo de la curva de nivel) con
      // tres carros portaolla; el daño/rebote al saltar dentro de la olla sigue igual
      { t: 'playaOllas', x: -40, z: -75, giro: 0, largo: 28, ancho: 3.8 },   // N1-MOLINO: vía en z -75 (sigue dentro de la fundición)
      { t: 'olla', x: -46, z: -75, carro: true, giro: 0 }, { t: 'olla', x: -38, z: -75, carro: true, giro: 0 }, { t: 'olla', x: -30, z: -75, carro: true, giro: 0 },
      { t: 'letrero', x: -44.5, z: -69.6, texto: 'La primera fundición de Braden hacía «mata» de cobre, no barras refinadas: del horno, el cobre fundido pasaba a ollas sobre carros por riel y se vaciaba en moldes. La gran fundición de Caletones llegó en 1922, seis kilómetros más abajo.' },
      { t: 'condor', x: -40, z: -85, alto: 12 },
      { t: 'minero', x: -20, z: -30 },
      { t: 'fogata', x: -75, z: -60 },
      { t: 'apunte', i: 4, x: -10, z: -10 },
      pepitas(-100, -110, 20, 8, 16),
      { t: 'meta', x: 30, z: 14, r: 7, tipo: 'tren' },
    ],
    salas: ['fortuna'],
    ruta: [[-425, -470], [-400, -430], [-360, -360], [-338, -350], [-326, -336], [-326, -316], [-330, -306], [-330, -300, 'capacho'], [-268, -300, 'bajar'], [-252, -294], [-243, -292, 'puerta'],
      ['sala', 0, -30], ['sala', 4.3, -37], ['sala', 4.3, -52.5], ['sala', -4.7, -78.6, 'puerta'], [-190, -198], [-160, -170], [-120, -140], [-95, -102], [-95, -72], [-82, -62.5], [-70, -58], [-62, -58.5], [-20, -20], [30, 14]],   // DEFECTOS-1611: antes [-62,-62] (el tramo iba por el pie del talud nuevo del molino, 44° de costado); ahora máx. 33°
  },
  2: {
    ...N[2], numero: 2, epoca: 1920, azoteas: { x0: -210, x1: -8, t0: 20, t1: 165 }, sol: { alto: 0.35, tono: 0xffd7a0 }, nieveDesde: 260, niebla: 0xe8c9a6, reloj: { desde: 18 * 60 + 30, funcion: 19 * 60 },
    inicio: { x: 20, z: 14, rumbo: 0 },
    zonas: [[0, 'LA ESTACIÓN DE SEWELL'], [1, 'EL PALITROQUE'], [2, 'TECHOS Y BALCONES'], [3, 'EL MIRADOR DE CALETONES'], [4, 'LA ESCALERA CENTRAL'], [5, 'EL CINE']],
    elementos: [
      ...ciudad(1920, 7, [{ x: 30, z: -205, sx: 16, sz: 16 }, { x: -95, z: -152, sx: 14, sz: 14 }, { x: -30, z: -166, sx: 12, sz: 12 }, { x: -62, z: -140, sx: 60, sz: 14 }])
        .map(e => e.t === 'edificio' && !e.id && [[-95, -104], [-96, -79]].some(([x, z]) => Math.abs(e.x - x) < 3 && Math.abs(e.z - z) < 3) ? { ...e, id: 'camarote_azotea' } : e),   // dos camarotes de azotea plana en «Techos y balcones»
      { t: 'zona', i: 0, x: 20, z: 10, r: 20 },
      { t: 'letrero', x: 6, z: -8, texto: 'Las bolas del palitroque bajan rodando por la escalera: sáltalas o hazte a un lado.' },
      { t: 'bolas', escalera: 'tramo1', cada: 4.5 },
      pepitas(0, -18, 0, -110, 16),
      { t: 'fogata', x: -12, z: -20 },
      { t: 'minero', x: -18, z: -30 }, { t: 'minero', x: -24, z: -36 },
      { t: 'apunte', i: 0, x: 6, z: 0 },
      { t: 'zona', i: 1, x: -66, z: -40, r: 18 },
      { t: 'cajas', x: -45, z: -44 }, { t: 'cajas', x: -47.2, z: -44, y2: true },   // antes en z -47: quedaba metida en la fachada del palitroque
      // techos: azoteas de camarotes del poniente y tablones de techo a techo
      { t: 'zona', i: 2, x: -60, z: -95, r: 25 },
      // a lo largo de la cumbrera, sobre el hueco en V entre los dos módulos del camarote (antes atravesado y metido en el hueco)
      { t: 'tablon', x: -39, z: -104, largo: 9, rot: 90 },
      { t: 'condor', x: -60, z: -110, alto: 12 }, { t: 'condor', x: -40, z: -120, alto: 14 },
      { t: 'apunte', i: 2, x: -75, z: -95, sobreTecho: true },
      // N4-C18 (Diego): sin el andarivel «caletones» (no tenía sentido en el recorrido); el apunte del tranvía aéreo a Caletones
      // queda en el mirador de la plaza 60, junto a la baranda que da al valle (por donde bajaba el cable a la fundición)
      { t: 'zona', i: 3, x: -10, z: -128, r: 18 },
      { t: 'apunte', i: 3, x: -24, z: -122 },
      { t: 'fogata', x: -14, z: -150 },
      // tramo 2: bolas, la vecina, pan y la torre de balcones
      { t: 'zona', i: 4, x: 0, z: -180, r: 20 },
      { t: 'bolas', escalera: 'tramo2', cada: 5 },
      { t: 'npc', quien: 'vecina', x: 12, z: -150, texto: '¡Apúrate, mijito! La función del cine empieza a las siete en punto.' },
      { t: 'pan', x: 14, z: -146 },
      { t: 'diego', x: -14, z: -128 },
      { t: 'torre', x: 30, z: -205, pisos: 6 },
      { t: 'cajas', x: 23.2, z: -207.6 }, { t: 'cajas', x: 24.4, z: -205.4, y2: true },   // cajones al pie de la torre: del suelo al primer balcón (5,5 m)
      { t: 'dinamitero', x: 30, z: -205, sobreTorre: true },
      { t: 'pan', x: 30, z: -205, sobreTorre: true },
      { t: 'fogata', x: -8, z: -210 },
      pepitas(0, -168, 0, -260, 14),
      { t: 'zona', i: 5, x: -10, z: -236, r: 10 },
    ],
    salas: ['palitroque', 'cine', 'iglesia', 'club', 'hospital157', 'escuela20'],   // N2-ESCUELA   // N4-SALAS: + hospital (1920)
    ruta: [[20, 14], [0, -10], [0, -60], [-30, -50], [-62, -46, 'puerta'], ['sala', -6, -5], ['sala', -6, -44], ['sala', 0, -47, 'puerta'], [-30, -50], [-50, -80], [0, -118],   // [-30,-50]: la salida de atrás deja a Nato frente a la puerta sur; ir derecho a [-50,-80] lo metía otra vez al palitroque
      [0, -140], [0, -200], [-8, -236, 'puerta'], ['sala', 0, -5], ['sala', 0, -30]],
  },
  3: {
    ...N[3], numero: 3, epoca: 1940, invierno: true, sol: { alto: 0.3, tono: 0xcfdcff }, niebla: 0xc9d3e0, tormenta: true,
    inicio: { x: 0, z: -150, rumbo: 0 },
    zonas: [[0, 'INVIERNO EN SEWELL'], [1, 'EL TENIENTE CLUB Y LA PISCINA'], [2, '¡EL ALUD!'], [3, 'EL HOSPITAL DEL EDIFICIO 157'], [4, 'LA CORNISA DEL JEFE']],
    elementos: [
      ...ciudad(1940, 11, [{ x: 40, z: -420, sx: 46, sz: 32 }]).map(apartarDePasaje(-122.5, -391, -373)),   // N3-C13
      { t: 'zona', i: 0, x: 0, z: -150, r: 15 },
      { t: 'letrero', x: 6, z: -156, texto: 'El hielo resbala y cuesta frenar. El viento empuja, sobre todo en el aire. Estos mineros aguantan el doble: dos combos.' },
      { t: 'hielo', x: 0, z: -215, sx: 6, sz: 106 },
      { t: 'viento', x: 0, z: -296, sx: 82, sz: 56, fuerza: 5, dir: [1, 0] },
      { t: 'minero', x: -12, z: -180 }, { t: 'minero', x: 10, z: -280 },
      { t: 'condor', x: 0, z: -250, alto: 14 },
      { t: 'diego', x: -24, z: -300 },
      { t: 'apunte', i: 0, x: 28, z: -142 },
      { t: 'fogata', x: 10, z: -300 },
      pepitas(0, -165, 0, -265, 14),
      { t: 'zona', i: 1, x: -96, z: -308, r: 10 },
      // el alud: desde lo alto del poniente hasta la puerta del hospital
      { t: 'zona', i: 2, x: -150, z: -400, r: 15 },
      // fogata y alud por las calles (antes caían dentro del camarote turquesa de (-162,-412): la fogata quedaba en su techo):
      // el alud nace en la calle de z -422, baja por el pasaje de x -136 y sigue por la calle de z -400
      { t: 'fogata', x: -150, z: -400 },
      // N3-X1: escalera del pasaje x -123 (entre las hileras de camarotes de z -364 y -388): las dos terrazas dejaban un muro de 14 m en z -377
      { t: 'escalera', x0: -122.5, z0: -373, x1: -122.5, z1: -391, y1: 165.9, ancho: 3, hxTerreno: 2.5, mTerreno: 2, sinCuerpo: true, id: 'pasaje_alud' },   // solo en la calle: más larga subía la base de los camarotes vecinos (podio de 7 m)
      { t: 'alud', ruta: [[-150, -422], [-136, -420], [-136, -400], [-120, -400], [-60, -380], [0, -340], [40, -322]], inicio: [-150, -422] },
      { t: 'apunte', i: 2, x: -100, z: -395 },
      pepitas(-140, -405, -10, -345, 13),   // N3-C13: 13 (antes 14): con el camarote celeste a su ancho real una quedaba pegada a su fachada
      { t: 'zona', i: 3, x: 40, z: -322, r: 8 },
      // la cornisa del jefe, detrás del hospital
      { t: 'plaza', x: 40, z: -420, sx: 40, sz: 26, color: COLOR.roca, y: null, terrazaLadera: true },   // terraza en la ladera, corta y rellena (antes un cajón de roca)
      { t: 'zona', i: 4, x: 40, z: -420, r: 18 },
      { t: 'puerta', x: 40, z: -410, rot: 180, sala: 'hospital', lado: 'salida', salidaDist: 7, caseta: true },   // boca de pasadizo en roca y salida lejos de la puerta (cámara)
      { t: 'jefe', x: 40, z: -428 },
      { t: 'apunte', i: 4, x: 58, z: -428 },
    ],
    salas: ['club45', 'hospital', 'iglesia', 'cine45', 'palitroque45', 'escuela45'],   // N2-ESCUELA   // N4-SALAS: + cine y palitroque (1945, antes de la tragedia: abiertos)   // N0-EMB9: el gimnasio y la piscina temperada ahora son el Teniente Club por dentro (club45 = con el apunte 1)
    ruta: [[0, -150], [0, -200], [0, -265], [-30, -306], [-70, -308], [-96, -313, 'puerta'], ['sala', 3, -4.6], ['sala', 0, -2, 'puerta'],   /* N0-EMB9: el gimnasio ahora es el Teniente Club (club45): se entra al vestíbulo y se sale por la misma puerta */
      [-122.5, -366], [-122.5, -392], [-125, -400], [-150, -400], [-120, -400], [-60, -380], [0, -340], [40, -324, 'puerta'], ['sala', 5.5, -3.0, 'ascensor'] /* C7: ascensor del kit hospital157 (antes 6, −36) */, ['sala', 2, -4.5], ['sala', 0, -9.5], ['sala', 0, -12], ['sala', 0, -17], ['sala', 0, -18.8], ['sala', 3.2, -20], ['sala', 3.2, -26], ['sala', 0, -27], ['sala', 0, -29], ['sala', -1, -32.6, 'puerta'] /* HOSP-SALIDA: hall → rayos X → pabellón (por el lado de la vitrina) → maternidad → salida del fondo */, [40, -420, 'jefe']],
  },
  4: {
    ...N[4], numero: 4, epoca: 1967, sol: { alto: 0.55, tono: 0xffe9c9 }, nieveDesde: 240, niebla: 0xd8e2ec,
    inicio: { x: 0, z: -290, rumbo: 0 },
    zonas: [[0, 'SEWELL, 1967'], [1, 'LA PLANTA, 1971'], [2, 'LO MÁS ALTO DE SEWELL'], [3, 'EL NIDO'], [4, '1981 · EL ÚLTIMO TREN']],
    elementos: [
      ...ciudad(1967, 23),
      { t: 'zona', i: 0, x: 0, z: -290, r: 20 },
      { t: 'escenario', x: 0, z: -310 },
      ...[[-20, -285], [22, -280], [-30, -300]].map(([x, z]) => ({ t: 'cajas', x, z })),
      { t: 'npc', quien: 'vecina', x: -14, z: -278, texto: '¡Nos vamos a Rancagua, mijito! Con la Operación Valle nos construyeron casas allá abajo.' },
      { t: 'npc', quien: 'anciana', x: 16, z: -300, texto: 'Aquí nacieron mis hijos… Qué pena dejar Sewell. Tome, mijito, para el camino.', regalo: 'pan' },
      { t: 'diego', x: 28, z: -292 },
      { t: 'minero', x: -6, z: -340 }, { t: 'minero', x: 6, z: -380 }, { t: 'minero', x: -6, z: -420 },
      { t: 'apunte', i: 0, x: -36, z: -312 },
      { t: 'fogata', x: 8, z: -326 },
      { t: 'apunte', i: 4, x: 22, z: -318 },   // N0-FABLE-1611 (A15): antes en (60, 12), junto a la estación de 1981 (zona que ya no se juega)
      pepitas(0, -330, 0, -450, 14),
      // la planta (1971): ollas en hoyos, vagonetas y el andarivel sobre un hoyo
      { t: 'zona', i: 1, x: 20, z: -490, r: 30 },
      { t: 'olla', x: -20, z: -480, hoyo: true }, { t: 'olla', x: 30, z: -500, hoyo: true },
      { t: 'letrero', x: -12, z: -488, texto: 'Vaciado de escoria: en la fundición, el cobre fundido se separaba de la escoria, que se volcaba desde las ollas en hoyos junto a la planta. Cuidado con el borde: ¡la olla quema!' },
      { t: 'rieles', x0: -45, x1: 65, z: -470, y: 211 }, { t: 'vagonetas', de: [65, -470], a: [-45, -470], y: 211, cada: 6 },
      { t: 'fogata', x: 60, z: -485 },
      { t: 'apunte', i: 1, x: 66, z: -510 },
      // N4-C18 (Diego): andarivel minero desde el borde poniente de la plaza alta hasta la última repisa, junto al nido (ahorra la
      // subida a pie; la pelea del nido sigue). Como los andariveles de El Teniente que subían carga, mineral y gente por la ladera:
      // capachos de fierro colgados de un cable sobre torres de madera. Cable en línea recta vista desde arriba, por la ladera libre del
      // poniente (a ≥ 13 m de las repisas); torres intermedias a 7 m del terreno para que el balde no roce la ladera.
      // Andenes girados (giro): su lado libre mira al cable; la escalera de A da al oriente (se llega desde la planta) y la de B, al nido.
      { t: 'zona', i: 2, x: -44, z: -515, r: 14 },
      { t: 'letrero', x: -33, z: -513, texto: 'Andarivel de la mina: sube al capacho para llegar a lo alto, junto al nido del cóndor.' },
      // (A: 1,4 m sobre la losa de la plaza, 211: con la altura del terreno el balde se metía en la losa; B: a ras de la ladera, con zócalo)
      { t: 'plataforma', x: -44, z: -505, y: 212.4, sy: 2.4, sx: 8, sz: 8, color: COLOR.madera, andarivel: true, giro: 97, peldano: [-40, -505] },
      { t: 'plataforma', x: -66, z: -684, sx: 8, sz: 8, color: COLOR.madera, andarivel: true, giro: -83, peldano: [-62, -684], sobreLadera: true },
      { t: 'andarivel', a: [-44, 212.4, -505], b: [-66, null, -684], torres: [[-50.76, -560, 9]], capachos: 4, periodo: 20, id: 'cumbre' },
      // lo más alto: repisas de roca, cada una más arriba, hasta el nido (camino a pie, para quien no sube al andarivel)
      // N4-C19 (Diego): cada repisa lleva una escalinata de roca desde la anterior (la 1.ª, desde la plaza alta): a pie sin saltar
      ...Array.from({ length: 7 }, (_, i) => ({ t: 'repisa', x: -20 - i * 4, z: -545 - i * 20, sube: 3, desde: i ? [-16 - i * 4, -525 - i * 20] : [-20, -520] })),
      { t: 'condor', x: -30, z: -600, alto: 12 }, { t: 'condor', x: -40, z: -640, alto: 14 }, { t: 'condor', x: -20, z: -620, alto: 16 },
      { t: 'apunte', i: 2, x: -36, z: -610, sobreRepisa: true },
      { t: 'fogata', x: -48, z: -686, sobreRepisa: true },
      { t: 'zona', i: 3, x: -50, z: -720, r: 20 },
      { t: 'plaza', x: -50, z: -720, sx: 40, sz: 34, color: COLOR.roca, y: altura(-50, -703) + 0.6, terraza: true },   // terraza del nido, a ras del borde por donde se llega
      { t: 'escalinata', a: [-50, -696], b: [-50, -703.6, altura(-50, -703) + 0.6], ancho: 4 },   // N4-C19: borde de 1,7 m de la terraza del nido
      { t: 'nido', x: -50, z: -733 },   // nido de Idol de 3,9 m de radio: entero sobre la losa (en z-738 sobresalía sobre la nieve de atrás)
      { t: 'condorJefe', x: -50, z: -725 },
      { t: 'apunte', i: 3, x: -66, z: -712, sobrePlaza: true },
      // 1981: azoteas hasta el andén y el último tren
      { t: 'zona', i: 4, x: -40, z: -20, r: 20 },
      { t: 'tren', x: 60, z: 22, final: true },
      // N0-FABLE-1611 (A15): el apunte 5 quedaba junto a la estación, 430 m cuesta abajo y fuera de la ruta (el tramo jugable de 1981 ya no se juega): va a la plaza del inicio
    ],
    salto1981: { x: 0, z: -110 },
    salas: ['iglesia', 'club', 'cine67', 'palitroque67', 'hospital67', 'escuela67'],   // N2-ESCUELA   // N4-SALAS: cine, palitroque y hospital de 1967 (Operación Valle)
    ruta: [[0, -290], [0, -330], [0, -455], [20, -490], [-30, -505], [-36, -505], [-44, -505, 'capacho'], [-66, -684, 'bajar'], [-57, -684], [-50, -698], [-50, -715, 'jefe']],   // N4-C18: por el andarivel
  },
};
if (SEWELL_CONO) for (const n of [2, 3, 4]) ajustarNivelCono(NIVELES[n]);   // Sewell en cono (N2-C22): solo con ?sewell=cono; el N1 no cambia
for (const n of [1, 2, 3, 4]) agregarVida(NIVELES[n]);   // N0-VIDA: después del cono (usa sus calles); ?vida=0 lo apaga
for (const [id, s] of Object.entries(SALAS)) s.id = id;
export { SALAS };

// Memoria · 19 de junio de 1945 (entre el Nivel 3 y el 4): sin enemigos, sin puntaje, sin música, sin celebración.
export const MEMORIA = {
  titulo: '19 de junio de 1945',
  textos: [
    'Un incendio en un taller del nivel Teniente Uno llenó de humo las galerías de la mina.',
    'Murieron 355 trabajadores. Quedaron 150 viudas y más de 400 niños huérfanos.',
    'De aquel dolor nacieron los departamentos de seguridad industrial y de bienestar para los trabajadores y sus familias.',
  ],
  inicio: { x: 0, z: -275, rumbo: 0 }, casco: { x: 0, z: -318 },
};
