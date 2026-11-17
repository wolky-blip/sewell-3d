// N0-INT (carril interiores, 14-11-2026): interiores procedurales de los edificios GENÉRICOS (camarotes de solteros, casas de obreros
// casados, departamentos de empleados, oficinas). Pedido de Diego: «entrar a la mayoría de los edificios no emblemáticos; si son de
// varios pisos, escaleras interiores para recorrerlos, y entrar a las habitaciones».
// - prepararInteriores(M): una vez por nivel (cuando el kit ya armó sus edificios): busca los edificios genéricos, elige una puerta
//   alcanzable (frente o fondo), dibuja la puerta si el kit no la trae y la agrega a M.R.puertas con `gen` (solo se entra con E).
// - construirInterior(M, puerta): al entrar arma el interior en una «sala» aparte (lejos del mundo, como las salas de niveles.js):
//   pasillo central, piezas a ambos lados con su puerta, escalera en U entre todos los pisos (rampa con colisión, peldaños, baranda,
//   muro de alma), ventanas donde están las de la fachada (vanos del kit), vista pintada hacia afuera, luz cálida y muebles de época.
// - destruirInterior(M, id): al salir lo desarma (mallas, colisiones y entidades): no queda nada en memoria.
// Coordenadas del interior: x a lo largo (centrado), z = 0 en el muro de la puerta y el edificio hacia -z, y = 0 piso del 1.er piso.
import * as THREE from 'three';
import { Junta, material, uvCaja, azar } from './kitSewell.js';
import { altura } from './terreno.js';
import { P } from '../juego/logica.js';
import { crearEntidad } from '../juego/entidades.js';
import { Colocador, precargarUtileria, texUtil, hayPieza, piezaGrupo, cajaPieza } from './utileria.js';   // N0-UTIL: muebles de malla realistas (respaldo: los de cajas)

const ORIGEN = { x: 6000, z: 0 };
const XMAX = 18;   // medio largo máximo del interior (los camarotes de 60 m se recortan a 36 m alrededor de la puerta)
const NOMBRES = { solteros: 'CAMAROTE DE SOLTEROS', casados: 'CASA DE OBREROS CASADOS', empleados: 'DEPARTAMENTOS DE EMPLEADOS', oficina: 'OFICINAS DE LA COMPAÑÍA', hamilton: 'CASA HAMILTON', piedra1905: 'CASA DE PIEDRA' };
const EMBLEMA = /^(hospital|hospital_ala|cine|palitroque|club|escuela|iglesia)$/;
const CERRADOS = { estacion: 'ESTACIÓN · CERRADA', taller_largo: 'TALLER · CERRADO', taller: 'TALLER · CERRADO', taller_n4: 'TALLER · CERRADO', concentradora: 'CONCENTRADORA · NO SE PUEDE ENTRAR',
  molino: 'MOLINO · CERRADO', pulperia: 'PULPERÍA · CERRADA (abre a las 8)', panaderia: 'PANADERÍA · CERRADA (el pan sale a las 5)' };
const FIJOS = { camarote1905: ['solteros', 'CAMAROTE DE 1905'], casa_piedra_v2: ['piedra1905', 'CASA DE PIEDRA'], hamilton3: ['hamilton', 'CASA HAMILTON'], correos: ['oficina', 'CORREOS Y OFICINAS'], camarote_azotea: ['solteros'] };

// textos breves del libro (documental/libro) y del reportaje (ESENCIA_SEWELL.md)
const TEXTOS = {
  solteros: { npc: ['anciana', '«El sereno lo dice clarito: aquí rigen dos leyes, las de Chile y las de la compañía. Nada de licor, y si lo pillan pololeando, o se casa o se va.»'],
    notas: ['<b>Del libro:</b> «La ley seca estaba en plena vigencia y solo la burlaban, de cuando en cuando, los que conseguían licor de los guachucheros», que cruzaban el cerro del Diablo con sus mulas.',
      '<b>Del libro:</b> en Teniente C había 65 dormitorios de 16 camas cada uno. En 1938 la pensión costaba 5 pesos diarios y el jornal medio del obrero, 22,50.',
      '<b>Aviso de la compañía:</b> PROHIBIDO EL LICOR. Los solteros que sean vistos pololeando serán convidados a casarse.'],
    recuerdos: [['carta', 'Carta de «convidado a casarse»: la compañía no perdonaba un pololeo a la vista.'], ['lampara', 'Lámpara de carburo del turno: subían de noche, con casco y lámpara, por las escaleras.']] },
  casados: { npc: ['vecina', '«Pase, pase. En mi casa no pagábamos nada: la empresa nos daba la luz, el agua, la comida. Pero eso tenía su precio.»'],
    notas: ['<b>Del libro:</b> la Braden daba a sus trabajadores casados un departamento con luz, agua, calefacción y servicios higiénicos, y educación gratuita, pero obligatoria, para sus hijos.',
      '<b>Del reportaje:</b> «Así comíamos en Sewell»: tres hijos, el marido en el turno, la cocina a leña siempre encendida.'],
    recuerdos: [['balanza', 'Balanza de resorte celeste de la cocina: con ella se pesaba lo que llegaba de la pulpería.'], ['jarro', 'Jarro de enlozado blanco: la loza esmaltada no se quebraba en la altura.']] },
  empleados: { npc: ['vecina', '«Mi hija jugaba en la plazuela O\'Higgins; para el 21 de mayo se llenaba de gente. En Rancagua había que pagar el agua y la luz; aquí era todo gratis.»'],
    notas: ['<b>Del reportaje:</b> los edificios 37 y 42 eran de empleados: paredes crema, pisos de madera y más muebles que en la casa obrera.',
      '<b>Lía Elgueta:</b> «Teníamos una bomba de agua para el agua caliente». No quería irse de Sewell y «le hizo la rincha» a sus papás.'],
    recuerdos: [['picaporte', 'Picaporte de latón de una puerta blanca del edificio de empleados.'], ['banderin', 'Banderín del 21 de mayo, de la plazuela O\'Higgins.']] },
  hamilton: { npc: ['vecina', '«Esta es la casa del superintendente. Aquí se firman los pedidos, se leen los planos del concentrador y se decide quién sube a la mina. Pase, pero no toque los papeles de la Braden.»'],
    notas: ['<b>Del libro:</b> la Braden Copper Company se constituyó en Maine en junio de 1904, con el respaldo de Nash y Sewell; el decreto de Hacienda que autorizó la sociedad es del 29 de abril de 1905.',
      '<b>Del libro:</b> el concentrador de 1906 era gravimétrico, de 250 toneladas diarias; Thomas M. Hamilton abrió la mina y desarrolló la extracción por gravedad, la «mina invertida».',
      '<b>Del libro:</b> norteamericanos, empleados y obreros vivían en edificios distintos: la casa del administrador era de piedra abajo y tablas arriba, con estufa y lámparas de queroseno.'],
    recuerdos: [['plano', 'Plano del concentrador de 1906 (250 t/día) firmado por la Braden Copper Company.'], ['lampara', 'Lámpara de queroseno del escritorio del superintendente: el campamento aún no tenía luz eléctrica.']] },
  // N1-INT1905 (15-11-2026, Diego: «las casas de piedra de 1905, sin luz eléctrica, por dentro parecen modernas»): textos de 1905.
  // Fuente: documental/libro/EL_TENIENTE_Guion_completo_IA.md (campamento El Molino 1905, camino de carretas, invierno, molino de 1906;
  // «lámparas de carburo en manos de mineros chilenos en 1905 → usar velas y candiles»).
  piedra1905: { npc: ['vecina', '«Pase, pase, que afuera corre viento. Aquí no hay luz eléctrica: nos alumbramos con velas y el candil, y la estufa de fierro se come la leña que suben las carretas.»'],
    notas: ['<b>Del libro:</b> en 1905 el campamento de El Molino era un caserío disperso de carpas y ranchos de tablas y piedra, en una ladera empinada; ese invierno se quedaron arriba unos cincuenta hombres.',
      '<b>Del libro:</b> el invierno, de junio a septiembre, deja varios metros de nieve y aludes.',
      '<b>Del libro:</b> en el verano de 1905-06 subieron hasta 250 carretas a la vez, tiradas por bueyes, con más de 4.000 toneladas de maquinaria y pino oregón.'],
    recuerdos: [['candil', 'Candil de lata del rancho: en 1905 los mineros se alumbraban con velas y candiles.'], ['mate', 'Mate de calabaza: junto a la estufa, el mate pasaba de mano en mano.']] },
  solteros1905: { npc: ['anciana', '«Aquí duermen los que se quedan el invierno. Velas hay pocas, así que el primero que la apaga, ese se duerme primero.»'],
    notas: ['<b>Del libro:</b> el primer año los obreros bajaban en invierno; en el de 1905 se quedaron unos cincuenta hombres en el campamento.',
      '<b>Del libro:</b> el molino concentrador de cinco pisos, hecho con un millón y medio de pies de madera por 180 carpinteros, arrancó en junio de 1906: 250 toneladas diarias.',
      '<b>Del libro:</b> en el verano de 1905-06 subieron hasta 250 carretas a la vez, tiradas por bueyes, con más de 4.000 toneladas de maquinaria y pino oregón.'],
    recuerdos: [['candil', 'Candil de lata del camarote: en 1905 los mineros se alumbraban con velas y candiles.'], ['mate', 'Mate de calabaza de la pieza de solteros: en las noches de invierno, mate y guitarra.']] },
  oficina: { npc: ['anciana', '«En Sewell había cuatro tipos de personas: obreros casados, obreros solteros, empleados y norteamericanos. Sus edificios también lo mostraban.»'],
    notas: ['<b>Del libro:</b> en una pequeña oficina se contrataban obreros, mulas y carretas para el transporte; el cobre llegaba hasta los puertos para embarcarse a Inglaterra.',
      '<b>Del libro:</b> el 11 de noviembre de 1920 un corto circuito en la oficina general de Teniente C encendió los camarotes. Desde entonces, extintores en cada pasillo.'],
    notas1945: ['<b>Del libro:</b> tras la tragedia del humo de 1945 nacieron los departamentos de seguridad industrial y de bienestar para los trabajadores y sus familias.'],
    recuerdos: [['tarjeta', 'Tarjeta del Departamento de Seguridad e Higiene Industrial.'], ['plano', 'Plano del campamento, dibujado a tinta en tela.']] },
};

// ------------------------------------------------------------------ texturas de lienzo (una vez)
const lienzos = {};
function lienzo(nombre, n, dib, rep) {
  if (lienzos[nombre]) return lienzos[nombre];
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); dib(g, n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (lienzos[nombre] = t);
}
// N1-HAMILTON-b: tela de visillo/cortina: pliegues verticales (luz y sombra), trama, encaje de puntos y ruedo (antes un plano liso de un color)
const texTela = (nombre, base, encaje) => lienzo(nombre, 256, (g, n) => {
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  for (let x = 0; x < n; x++) { const f = Math.sin(x / n * Math.PI * 2 * 6), a = 0.16 * f; g.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(60,40,20,${-a})`; g.fillRect(x, 0, 1, n); }
  g.fillStyle = 'rgba(80,60,40,0.10)'; for (let y = 0; y < n; y += 3) g.fillRect(0, y, n, 1); for (let x = 0; x < n; x += 3) g.fillRect(x, 0, 1, n);   // trama
  if (encaje) { g.fillStyle = 'rgba(255,255,255,0.55)'; for (let y = 6; y < n; y += 16) for (let x = (y / 16 % 2) * 8 + 4; x < n; x += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } }
  g.fillStyle = 'rgba(90,70,50,0.25)'; g.fillRect(0, n - 10, n, 3); g.fillRect(0, 4, n, 3);   // ruedo y jareta
});
const texPiso = () => lienzo('piso', 256, (g, n) => {   // tablas de piso de raulí: 8 tablas en 2 m, juntas y vetas
  const r = azar(77);
  for (let i = 0; i < 8; i++) { const v = 150 + r() * 30 | 0; g.fillStyle = `rgb(${v},${v * 0.66 | 0},${v * 0.42 | 0})`; g.fillRect(0, i * n / 8, n, n / 8);
    g.fillStyle = 'rgba(60,30,10,0.35)'; g.fillRect(0, i * n / 8, n, 2); g.fillRect((r() * n) | 0, i * n / 8, 2, n / 8);
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(70,40,15,0.12)'; g.fillRect(0, i * n / 8 + r() * n / 8, n, 1); } }
}, true);
const texMantel = () => lienzo('mantel', 128, (g, n) => { g.fillStyle = '#f4f0e8'; g.fillRect(0, 0, n, n); g.fillStyle = 'rgba(190,30,35,0.75)';
  for (let i = 0; i < 8; i++) { g.fillRect(i * 16, 0, 8, n); g.fillRect(0, i * 16, n, 8); } }, true);
const texAlfombra = () => lienzo('alfombra', 256, (g, n) => { g.fillStyle = '#7a2a24'; g.fillRect(0, 0, n, n); g.strokeStyle = '#d8b46a'; g.lineWidth = 8; g.strokeRect(14, 14, n - 28, n - 28);
  g.lineWidth = 3; g.strokeRect(32, 32, n - 64, n - 64); g.fillStyle = '#2f3e5a'; g.beginPath(); g.ellipse(n / 2, n / 2, n * 0.22, n * 0.14, 0, 0, 7); g.fill(); g.strokeStyle = '#d8b46a'; g.stroke(); });
const texPlano = () => lienzo('plano', 256, (g, n) => { g.fillStyle = '#dfe9f0'; g.fillRect(0, 0, n, n); g.strokeStyle = '#2b4f7a'; g.lineWidth = 2;
  const r = azar(5); for (let i = 0; i < 14; i++) { g.strokeRect(20 + r() * 160, 20 + r() * 160, 20 + r() * 60, 12 + r() * 40); }
  g.beginPath(); for (let i = 0; i < 6; i++) { g.moveTo(10, 30 + i * 38); g.bezierCurveTo(90, 10 + i * 40, 160, 60 + i * 35, 246, 40 + i * 36); } g.stroke();
  g.fillStyle = '#2b4f7a'; g.font = 'bold 16px serif'; g.fillText('BRADEN COPPER CO.', 40, 240); });
function texFoto(i) {
  return lienzo('foto' + i, 128, (g, n) => {   // retratos de familia en sepia (siluetas), como los del reportaje
    const r = azar(31 + i * 17); g.fillStyle = '#d9c9a8'; g.fillRect(0, 0, n, n); g.fillStyle = '#b39a74'; g.fillRect(8, 8, n - 16, n - 16);
    const k = 1 + (i % 4); for (let j = 0; j < k; j++) { const x = 24 + (j + 0.5) * (n - 48) / k, s = 0.7 + r() * 0.3;
      g.fillStyle = '#4a3a2a'; g.beginPath(); g.arc(x, 52, 11 * s, 0, 7); g.fill(); g.fillRect(x - 14 * s, 64, 28 * s, 50); }
    g.fillStyle = 'rgba(255,240,210,0.25)'; g.fillRect(8, 8, n - 16, 30);
  });
}
function texCartel(texto) {
  return lienzo('cartel' + texto, 256, (g, n) => { g.fillStyle = '#efe6cc'; g.fillRect(0, 0, n, n); g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.strokeRect(8, 8, n - 16, n - 16);
    g.fillStyle = '#2a1a10'; g.textAlign = 'center'; g.font = 'bold 30px serif';
    texto.split('|').forEach((l, i, a) => g.fillText(l, n / 2, n / 2 + (i - (a.length - 1) / 2) * 38 + 10)); });
}
// vista hacia afuera: cielo, cordillera nevada y la ciudad de colores en la ladera (se ve por las ventanas)
const texVista = () => {
  if (lienzos.vista) return lienzos.vista;
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const g = c.getContext('2d'), r = azar(9);
  const cielo = g.createLinearGradient(0, 0, 0, 240); cielo.addColorStop(0, '#5f9fe0'); cielo.addColorStop(1, '#cfe3f4'); g.fillStyle = cielo; g.fillRect(0, 0, 2048, 512);
  g.fillStyle = '#7d756e'; g.beginPath(); g.moveTo(0, 250); for (let x = 0; x <= 2048; x += 32) g.lineTo(x, 150 + 60 * Math.sin(x * 0.006) + 30 * Math.sin(x * 0.021) + r() * 14); g.lineTo(2048, 512); g.lineTo(0, 512); g.fill();
  g.fillStyle = '#f4f6f8'; for (let x = 0; x < 2048; x += 32) { const y = 150 + 60 * Math.sin(x * 0.006) + 30 * Math.sin(x * 0.021); if (y < 170) { g.beginPath(); g.moveTo(x - 30, y + 26); g.lineTo(x, y); g.lineTo(x + 34, y + 24); g.fill(); } }
  g.fillStyle = '#8b6f52'; g.fillRect(0, 232, 2048, 280);
  const cols = ['#4f8a3c', '#86d6c2', '#c8a24a', '#b84a3a', '#d8cfae', '#3f6fa0', '#e0d6b8', '#c86a3a'];
  for (let fila = 0; fila < 5; fila++) for (let x = -40; x < 2048; x += 70 + r() * 60) {
    const y = 230 + fila * 52 + r() * 14, w = 50 + r() * 90, h = 40 + r() * 30; g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, y, w, h);
    g.fillStyle = '#9c3a2c'; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + w / 2, y - 12); g.lineTo(x + w + 4, y); g.fill();
    g.fillStyle = 'rgba(30,35,45,0.75)'; for (let wx = x + 6; wx < x + w - 8; wx += 11) for (let wy = y + 7; wy < y + h - 8; wy += 13) g.fillRect(wx, wy, 5, 7);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return (lienzos.vista = t);
};

// N1-INT1905: texturas de la vivienda minera de 1905 (UV en metros: una repetición = 2 m, como uvCaja)
const pintaPiedras = (g, n, r, fila, tonos, junta) => {   // pirca: piedras irregulares en hiladas con junta de barro
  g.fillStyle = junta; g.fillRect(0, 0, n, n);
  for (let y = -fila / 2; y < n + fila; y += fila * (0.8 + r() * 0.3)) for (let x = -r() * fila; x < n + fila; ) {
    const w = fila * (0.9 + r() * 1.1), h = fila * (0.7 + r() * 0.35), cx = x + w / 2, cy = y + h / 2, t = tonos[(r() * tonos.length) | 0], d = r() * 18 - 9;
    g.fillStyle = `rgb(${t[0] + d | 0},${t[1] + d | 0},${t[2] + d | 0})`; g.beginPath();
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = 0.82 + r() * 0.18; g.lineTo(cx + Math.cos(a) * w / 2 * rr, cy + Math.sin(a) * h / 2 * rr); }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,245,225,0.13)'; g.fillRect(cx - w * 0.3, cy - h * 0.38, w * 0.6, h * 0.12);   // luz arriba
    g.fillStyle = 'rgba(30,20,10,0.22)'; g.fillRect(cx - w * 0.32, cy + h * 0.3, w * 0.64, h * 0.12);    // sombra abajo
    for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,30,20' : '230,220,200'},0.12)`; g.fillRect(cx - w / 3 + r() * w * 0.6, cy - h / 3 + r() * h * 0.6, 3 + r() * 6, 2 + r() * 4); }
    x += w + 3 + r() * 5;
  }
};
const texPirca = () => lienzo('pirca', 512, (g, n) => pintaPiedras(g, n, azar(41), 46, [[128, 118, 104], [146, 136, 120], [112, 104, 94], [158, 146, 126], [120, 100, 82]], '#5e4e3c'), true);
const texEncalado = () => lienzo('encalado', 512, (g, n) => {   // revoque de barro encalado y gastado: cal blanca sucia, desconchados con barro y piedra
  const r = azar(43); pintaPiedras(g, n, r, 46, [[128, 112, 92], [140, 126, 104], [116, 102, 86]], '#6a5640');
  g.fillStyle = '#9a7d5c'; g.globalAlpha = 0.92; g.fillRect(0, 0, n, n); g.globalAlpha = 1;   // barro sobre la piedra
  const capa = g.createLinearGradient(0, 0, 0, n); capa.addColorStop(0, '#e6dfcf'); capa.addColorStop(0.75, '#ddd3be'); capa.addColorStop(1, '#c9b998');
  g.save(); g.beginPath(); g.rect(0, 0, n, n);
  for (let i = 0; i < 9; i++) { const x = r() * n, y = n * 0.45 + r() * n * 0.55, rr = 6 + r() * 20; g.moveTo(x + rr, y); for (let k = 1; k <= 10; k++) { const a = k / 10 * Math.PI * 2, q = rr * (0.6 + r() * 0.5); g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } }
  g.clip('evenodd'); g.fillStyle = capa; g.fillRect(0, 0, n, n); g.restore();
  for (let i = 0; i < 40; i++) { const x = r() * n, y = r() * n, rr = 20 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(150,125,95,0.16)'); gr.addColorStop(1, 'rgba(150,125,95,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }   // cal manchada
  const sucio = g.createLinearGradient(0, n * 0.7, 0, n); sucio.addColorStop(0, 'rgba(110,85,60,0)'); sucio.addColorStop(1, 'rgba(110,85,60,0.4)'); g.fillStyle = sucio; g.fillRect(0, n * 0.7, n, n * 0.3);   // barro salpicado abajo
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,70,50' : '255,252,240'},${0.04 + r() * 0.06})`; g.fillRect(r() * n, r() * n, 1 + r() * 4, 1 + r() * 3); }
  for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(80,60,40,0.25)'; g.lineWidth = 1; g.beginPath(); let x = r() * n, y = r() * n; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += r() * 30 - 15; y += 8 + r() * 18; g.lineTo(x, y); } g.stroke(); }   // grietas
  const hollin = g.createLinearGradient(0, 0, 0, n * 0.35); hollin.addColorStop(0, 'rgba(50,40,30,0.25)'); hollin.addColorStop(1, 'rgba(50,40,30,0)'); g.fillStyle = hollin; g.fillRect(0, 0, n, n * 0.35);
}, true);
const texTierra = () => lienzo('tierra', 512, (g, n) => {   // tierra apisonada: café grisáceo, piedrecillas, manchas y huellas
  const r = azar(47); g.fillStyle = '#6e5a44'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 70; i++) { const x = r() * n, y = r() * n, rr = 20 + r() * 70, c = r() < 0.5 ? '90,72,54' : '120,100,78'; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${c},0.35)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
  for (let i = 0; i < 900; i++) { const v = 90 + r() * 80 | 0; g.fillStyle = `rgba(${v},${v * 0.9 | 0},${v * 0.78 | 0},0.7)`; g.fillRect(r() * n, r() * n, 1 + r() * 3, 1 + r() * 3); }
}, true);
const texPisoViejo = () => lienzo('pisoViejo', 256, (g, n) => {   // tablas anchas gastadas, grises de polvo, con juntas abiertas y clavos
  const r = azar(53);
  for (let i = 0; i < 6; i++) { const v = 112 + r() * 26 | 0, y = i * n / 6; g.fillStyle = `rgb(${v},${v * 0.8 | 0},${v * 0.62 | 0})`; g.fillRect(0, y, n, n / 6);
    for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,40,24' : '190,175,150'},0.12)`; g.fillRect(0, y + r() * n / 6, n, 1); }
    g.fillStyle = 'rgba(25,15,8,0.6)'; g.fillRect(0, y, n, 2); const xj = (r() * n) | 0; g.fillRect(xj, y, 2, n / 6);
    g.fillStyle = 'rgba(20,20,20,0.7)'; for (const xx of [xj - 6, xj + 8]) { g.fillRect(xx, y + 6, 2, 2); g.fillRect(xx, y + n / 6 - 8, 2, 2); } }
  const pol = g.createRadialGradient(n / 2, n / 2, 10, n / 2, n / 2, n * 0.7); pol.addColorStop(0, 'rgba(150,135,110,0)'); pol.addColorStop(1, 'rgba(150,135,110,0.18)'); g.fillStyle = pol; g.fillRect(0, 0, n, n);
}, true);
// haz de luz de la ventana (aditivo): fuerte junto a la ventana (v = 0), se apaga hacia el piso y en los bordes; mancha del piso con bordes suaves
const texRayo = () => lienzo('rayo', 128, (g, n) => { const im = g.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = i / (n - 1), v = j / (n - 1), b = Math.pow(1 - v, 1.6) * Math.min(1, Math.sin(Math.PI * u) * 1.6) * 255, k = (j * n + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = b; im.data[k + 3] = 255; }
  g.putImageData(im, 0, 0); });
const texMancha = () => lienzo('mancha', 128, (g, n) => { const im = g.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = i / (n - 1), v = j / (n - 1), b = Math.min(1, Math.sin(Math.PI * u) * 1.5) * Math.min(1, Math.sin(Math.PI * v) * 1.5) * (1 - 0.35 * v) * 255, k = (j * n + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = b; im.data[k + 3] = 255; }
  g.putImageData(im, 0, 0); });
const texVista1905 = () => {   // vista de 1905: cordillera nevada, ladera café, carpas y ranchos dispersos, humo; sin la ciudad de colores
  if (lienzos.vista1905) return lienzos.vista1905;
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const g = c.getContext('2d'), r = azar(19);
  const cielo = g.createLinearGradient(0, 0, 0, 240); cielo.addColorStop(0, '#7fa6cf'); cielo.addColorStop(1, '#dfe6ee'); g.fillStyle = cielo; g.fillRect(0, 0, 2048, 512);
  g.fillStyle = '#7d756e'; g.beginPath(); g.moveTo(0, 250); for (let x = 0; x <= 2048; x += 32) g.lineTo(x, 150 + 60 * Math.sin(x * 0.006) + 30 * Math.sin(x * 0.021) + r() * 14); g.lineTo(2048, 512); g.lineTo(0, 512); g.fill();
  g.fillStyle = '#f2f4f6'; for (let x = 0; x < 2048; x += 32) { const y = 150 + 60 * Math.sin(x * 0.006) + 30 * Math.sin(x * 0.021); if (y < 185) { g.beginPath(); g.moveTo(x - 34, y + 30); g.lineTo(x, y); g.lineTo(x + 36, y + 28); g.fill(); } }
  g.fillStyle = '#7c6650'; g.fillRect(0, 236, 2048, 280);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '95,80,62' : '140,122,98'},0.5)`; g.fillRect(r() * 2048, 236 + r() * 276, 6 + r() * 30, 2 + r() * 6); }
  for (let x = 30; x < 2048; x += 120 + r() * 200) {   // ranchos de piedra con techo de zinc y carpas
    const y = 270 + r() * 200, w = 26 + r() * 36, h = 16 + r() * 12;
    if (r() < 0.35) { g.fillStyle = '#e8e2d2'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w / 2, y); g.lineTo(x + w, y + h); g.fill(); continue; }
    g.fillStyle = r() < 0.5 ? '#8e8478' : '#6f5e4c'; g.fillRect(x, y, w, h); g.fillStyle = '#a7a39b'; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + w / 2, y - 8); g.lineTo(x + w + 3, y); g.fill();
    g.fillStyle = 'rgba(30,25,20,0.8)'; g.fillRect(x + w * 0.3, y + h * 0.35, 4, 6);
    if (r() < 0.5) { g.fillStyle = 'rgba(220,220,225,0.35)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + w * 0.7 + k * 4, y - 12 - k * 9, 5 + k * 2, 0, 7); g.fill(); } }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return (lienzos.vista1905 = t);
};

// ------------------------------------------------------------------ materiales del interior (compartidos)
const mats = {};
function mt(clave) {
  if (mats[clave]) return mats[clave];
  const S = (color, op = {}) => new THREE.MeshStandardMaterial({ color, roughness: op.r ?? 0.8, metalness: op.m ?? 0, ...(op.map ? { map: op.map } : {}), ...(op.t ? { transparent: true, opacity: op.t, depthWrite: false } : {}), side: op.doble ? THREE.DoubleSide : THREE.FrontSide });
  const tabla = {
    piso: () => S(0xffffff, { map: texPiso(), r: 0.7 }), cielo: () => S(0xf3efe4, { r: 0.95 }), zocalo: () => S(0xf6f3ea, { r: 0.6 }), zocaloOsc: () => S(0x5a3a22, { r: 0.6 }),
    madera: () => S(0x7a5232, { r: 0.7 }), maderaClara: () => S(0xb8905e, { r: 0.7 }), maderaOsc: () => S(0x4a2e1a, { r: 0.65 }), blanco: () => S(0xf2efe6, { r: 0.55 }),
    fierroVerde: () => S(0x3d6b52, { r: 0.5, m: 0.4 }), fierro: () => S(0x26272a, { r: 0.55, m: 0.5 }), laton: () => S(0xc9a24a, { r: 0.35, m: 0.8 }), cobre: () => S(0xb8693a, { r: 0.4, m: 0.7 }),
    tela: () => S(0xf4f2ea, { r: 1 }), colchaRoja: () => S(0x8a3434, { r: 1 }), colchaAzul: () => S(0x5d7ea8, { r: 1 }), colchaGris: () => S(0x6f6a62, { r: 1 }), frazada: () => S(0x8a6f4a, { r: 1 }),
    tapiz: () => S(0x6b4a3a, { r: 0.95 }), tapizVerde: () => S(0x56664a, { r: 0.95 }), crema: () => S(0xe9dcae, { r: 0.6 }), enlozado: () => S(0xf4f4ee, { r: 0.3, m: 0.1 }), celeste: () => S(0x8cc6e0, { r: 0.4, m: 0.2 }),
    rojo: () => S(0xb3202a, { r: 0.6 }), papel: () => S(0xeee6cf, { r: 0.9 }), metalGris: () => S(0x7a8078, { r: 0.45, m: 0.5 }), loza: () => S(0xfafafa, { r: 0.2, m: 0.05 }),
    mantel: () => S(0xffffff, { map: texMantel(), r: 0.9 }), alfombra: () => S(0xffffff, { map: texUtil('alfombra1') || texAlfombra(), r: 1 }), plano: () => S(0xffffff, { map: texUtil('plano') || texPlano(), r: 0.9 }),
    alfombra2: () => S(0xffffff, { map: texUtil('alfombra2') || texAlfombra(), r: 1 }), calendario: () => S(0xffffff, { map: texUtil('calendario') || texCartel('CALENDARIO|1945'), r: 0.85 }),
    paisaje: () => S(0xffffff, { map: texUtil('paisaje') || texFoto(1), r: 0.6 }), virgen: () => S(0xffffff, { map: texUtil('virgen') || texFoto(2), r: 0.6 }),   // N0-UTIL: texturas generadas en local (assets3d/utileria/planos)
    vidrio: () => S(0xcfe4f2, { r: 0.05, m: 0.2, t: 0.22, doble: true }), cortina: () => S(0xffffff, { map: texTela('telaRosa', '#f0b8c4', true), r: 1, t: 0.78, doble: true }), visillo: () => S(0xffffff, { map: texTela('telaCrema', '#efe4c8', true), r: 1, t: 0.82, doble: true }),
    peldano: () => S(0xa8a49c, { r: 0.95 }),
    pantalla: () => S(0x2f4a3a, { r: 0.45, m: 0.3, doble: true }),
    foco: () => new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), dia: () => new THREE.MeshBasicMaterial({ color: 0xfff6e2 }),
    vista: () => new THREE.MeshBasicMaterial({ map: texVista(), side: THREE.BackSide, fog: false }),
    // N1-INT1905: vivienda minera de 1905
    pirca: () => S(0xffffff, { map: texPirca(), r: 0.97 }), encalado: () => S(0xffffff, { map: texEncalado(), r: 0.95 }), tierra: () => S(0xffffff, { map: texTierra(), r: 1 }),
    pisoViejo: () => S(0xffffff, { map: texPisoViejo(), r: 0.9 }), maderaVieja: () => S(0x6e5a44, { r: 0.92 }), vigas: () => S(0x4e3a28, { r: 0.9 }),
    piel: () => S(0xb8a584, { r: 1 }), saco: () => S(0x8c7656, { r: 1 }), greda: () => S(0x9a5a3a, { r: 0.85 }), lata: () => S(0x8c8a84, { r: 0.5, m: 0.55 }), cera: () => S(0xf2e8cc, { r: 0.6 }),
    manta: () => S(0x7a3a2a, { r: 1 }), manta2: () => S(0x4a5a6a, { r: 1 }),
    llama: () => new THREE.MeshBasicMaterial({ color: 0xffb04a }), brasa: () => new THREE.MeshBasicMaterial({ color: 0xb8401a }),
    rayo: () => new THREE.MeshBasicMaterial({ color: 0xfff0d0, map: texRayo(), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    mancha: () => new THREE.MeshBasicMaterial({ color: 0xfff2d8, map: texMancha(), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    vista1905: () => new THREE.MeshBasicMaterial({ map: texVista1905(), side: THREE.BackSide, fog: false }),
  };
  if (clave.startsWith('foto')) return (mats[clave] = S(0xffffff, { map: texUtil('retrato' + (+clave.slice(4) + 1)) || texFoto(+clave.slice(4)), r: 0.6 }));
  if (clave.startsWith('cartel:')) return (mats[clave] = S(0xffffff, { map: texCartel(clave.slice(7)), r: 0.8 }));
  if (clave.startsWith('muro:')) { const [, tipo, col] = clave.split(':'); return (mats[clave] = rango(clave, material(tipo, +col).clone())); }   // tablas/estuco del kit (mismas texturas que la fachada)
  return (mats[clave] = rango(clave, (tabla[clave] || (() => S(0xff00ff)))()));
}
// R-8: quién queda encima entre piezas coplanares de materiales distintos (marcos a ras del muro, zócalos, cuadros, alfombras sobre el piso): polygonOffset por rango,
// así no hay z-fighting a ninguna distancia. Muros y piso = 0; ?r8=0 lo apaga (para comparar).
const RANGO_INT = { piso: 0.5, cielo: 1, zocalo: 1, blanco: 1.05, crema: 1.1, papel: 1.15, peldano: 1, tela: 1.2, tapiz: 1.3, tapizVerde: 1.35, fierro: 1.4, fierroVerde: 1.45, enlozado: 1.5, metalGris: 1.6, celeste: 1.7, colchaRoja: 1.8, colchaAzul: 1.82, colchaGris: 1.84, frazada: 1.9, rojo: 1.95, madera: 2, alfombra: 2.1, alfombra2: 2.15, mantel: 2.2, maderaClara: 2.3, zocaloOsc: 2.4, maderaOsc: 2.5, loza: 2.6, plano: 3, calendario: 3.1, paisaje: 3.2, virgen: 3.3, cobre: 3.4, laton: 3.5, pantalla: 3.8, vidrio: 4, cortina: 4.1, visillo: 4.2,
  pirca: 0.3, encalado: 0.3, tierra: 0.5, pisoViejo: 0.5, maderaVieja: 2, vigas: 2.05, piel: 2.12, saco: 1.92, manta: 1.86, manta2: 1.87, greda: 2.62, lata: 1.62, cera: 2.64, mancha: 4.3, rayo: 4.4 };
function rango(clave, m) {
  if (/[?&]r8=0/.test(globalThis.location?.search || '')) return m;
  const n = RANGO_INT[clave] ?? (clave.startsWith('muro:') ? 0.3 : clave.startsWith('foto') ? 3.4 : clave.startsWith('cartel:') ? 3.6 : 0);
  if (n && m.polygonOffset !== undefined) { m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -n * 8; }
  return m;
}
const CON_UV = k => k === 'piso' || k === 'mantel' || k === 'pirca' || k === 'encalado' || k === 'tierra' || k === 'pisoViejo' || k.startsWith('muro:');   // UV en metros (uvCaja)

// muros del interior según el tipo y la época (ESENCIA_SEWELL.md: casa obrera verde menta de listones con zócalo blanco; empleados crema)
// N1-INT1905: antes de 1915 (salvo la casa Hamilton) = vivienda minera sin luz eléctrica: piedra a la vista o pirca encalada, piso de tierra o
// de tablas viejas, vigas con el zinc a la vista, madera sin pintar, sin zócalos (ver estiloRustico y RUSTICO en amoblar).
function estilo(tipo, epoca, r, semilla = 0) {
  const base = { piso: () => 'piso', cieloLosa: 'cielo', techo: 'cielo', marco: 'blanco', peldano: 'maderaClara', vista: 'vista', ...estiloBase(tipo, epoca, r, semilla) };
  // N1-HAMILTON (15-11): casa del superintendente de 1905: acomodada pero SIN luz eléctrica: marcos y barandas de madera vieja (nada blanco moderno),
  // vigas y tablas del entrepiso a la vista, zinc y cerchas arriba, vista de 1905; luz de llama (velas, quinqués, faroles) con haces por las ventanas
  if (tipo === 'hamilton') return { ...base, llama: true, marco: 'maderaVieja', cieloLosa: 'maderaVieja', techo: `muro:zincViejo:${0xb8b2a8}`, vista: 'vista1905' };
  if (epoca >= 1915) return base;
  const piedra = tipo === 'piedra1905';
  // 16-11 (Diego): también en 1905 el interior va estucado (no tablas a rayas), en tonos gastados que varían por casa (estiloBase)
  return { ...base, rustico: true, muro: piedra ? 'pirca' : base.muro, tabique: piedra ? 'encalado' : base.muro, zocalo: null, puerta: 'maderaVieja', marco: 'maderaVieja', peldano: 'maderaVieja',
    piso: f => piedra && f === 0 ? 'tierra' : 'pisoViejo', cieloLosa: 'maderaVieja', techo: `muro:zincViejo:${0xb8b2a8}`, colcha: 'frazada', vista: 'vista1905', cortina: 'saco' };
}
// 16-11 (Diego): interiores ESTUCADOS (no tablas a rayas), y no todos del mismo color: crema, celeste agua o verde pálido por casa
// (se pueden repetir); en 1905 los mismos tonos más gastados
const ESTUCOS = [0xf0e4c4, 0xcfe3e6, 0xd6e6cf], ESTUCOS1905 = [0xdccfae, 0xbfd0cf, 0xc6d4bb];
function estiloBase(tipo, epoca, r, semilla) {   // el color sale de la semilla de la casa (no gasta r(): no mueve los muebles ya aprobados)
  const v = epoca < 1915, est = `muro:estuco:${(v ? ESTUCOS1905 : ESTUCOS)[Math.abs(Math.floor(semilla * 2.37)) % 3]}`;
  if (tipo === 'casados') return { muro: est, zocalo: 'zocalo', puerta: 'blanco', colcha: 'colchaRoja' };
  if (tipo === 'empleados') return { muro: est, zocalo: 'zocaloOsc', puerta: 'blanco', colcha: 'colchaAzul' };
  if (tipo === 'hamilton') return { muro: est, muroF: f => f === 0 ? `muro:piedra:${0xcfc6b8}` : est, zocalo: 'zocaloOsc', puerta: 'madera', colcha: 'colchaRoja' };   // piedra abajo, tablas arriba (como la fachada)
  if (tipo === 'oficina') return { muro: est, zocalo: 'zocaloOsc', puerta: 'madera', colcha: 'colchaGris' };
  r();   // (antes elegía el color de las tablas: se conserva el sorteo para no mover lo demás)
  return { muro: est, zocalo: 'zocaloOsc', puerta: 'madera', colcha: 'frazada' };
}

// ------------------------------------------------------------------ preparar: puertas de los edificios genéricos del nivel
function clasificar(id, x, z) {
  if (EMBLEMA.test(id)) return null;
  if (CERRADOS[id]) return { cerrada: true, nombre: CERRADOS[id] };
  if (FIJOS[id]) return { tipo: FIJOS[id][0], nombre: FIJOS[id][1] || NOMBRES[FIJOS[id][0]] };
  if (!/^camarote/.test(id)) return null;
  const semilla = Math.round(Math.abs(x * 73.1 + z * 19.7)), t = Math.floor(semilla / 7) % 6;   // misma regla que los tipos del kit (mallas.js opcionesKit)
  const tipo = ['casados', 'empleados', 'oficina', 'solteros', 'casados', 'solteros'][t];
  return { tipo, nombre: NOMBRES[tipo] };
}

export function prepararInteriores(M) {
  const R = M.R, fis = M.fis; if (R.intListo) return; R.intListo = true; precargarUtileria();
  if (globalThis.location && /[?&]interiores=0/.test(location.search)) return colisionKit(R, fis);   // ESC
  const vistos = new Set(), J = new Junta(), extra = []; let k = 0;
  R.interiores = [];
  for (const gs of R.gaussianas) {
    const id = String(gs.id || '').replace(/^.*\//, '').replace(/\.ply$/, ''), lote = gs.lote; if (!lote) continue;
    const clave = lote.x.toFixed(1) + ',' + lote.z.toFixed(1); if (vistos.has(clave)) continue; vistos.add(clave);
    const cl = clasificar(id, lote.x, lote.z); if (!cl) continue;
    let kg = null; gs.grupo.traverse(o => { if (!kg && o.userData.kit && o.userData.kit.vanos) kg = o; });
    const cand = kg ? candidatosKit(kg) : candidatosLote(gs);
    let elegida = null;
    const motivos = [];
    for (const c of cand) { const ok = puertaAlcanzable(fis, c); if (ok && !ok.motivo) {
      // ESC (16-11): una escalinata que no se puede subir caminando (en un barranco: 40 peldaños de 0,38 m en la concentradora, de 0,28 en el taller del N3) no sirve: se prueba otra cara
      const c2 = { ...c, ...ok }, f = c2.base - c2.yT, pp2 = pasosPuerta(c2); if (pp2) c2.alcance = pp2.alcance;
      const m = f > 0.12 ? escalinata(null, fis, c2, f, gs, R, null, true) : null;
      if (!m || m.h <= 0.235) { elegida = c2; break; } /* contrahuella > ~0,23 m con huella de 0,28: el paso automático ya no la sube */ motivos.push(c.cara + ':escalinata de ' + m.h.toFixed(2)); continue; }
      motivos.push(c.cara + ':' + (ok && ok.motivo)); }
    if (!elegida) { (R.intDescartes ||= []).push([id, Math.round(lote.x), Math.round(lote.z), motivos.join(' ')]); continue; }
    // N1-C73: UNA sola escalera por puerta. La de interiores (la que calza con la puerta real) reemplaza la de piedra que construir.js
    // ponía en el podio de la cara «sur» (quedaban las dos, una sobre otra y la gris flotando).
    for (const q of R.escPodio || []) if (!q.quitada && Math.abs(q.x - lote.x) < 0.01 && Math.abs(q.z - lote.z) < 0.01) { q.quitada = true; fis.mundo.removeCollider(q.col, false); q.malla.removeFromParent(); q.malla.geometry.dispose(); }
    if (elegida.kit && !elegida.kitPuerta && elegida.dFis > 0.05 && recortarPuerta(fis, { ...elegida, kg }, R)) { elegida.dFis = 0; elegida.recortada = true; const pp = pasosPuerta(elegida); if (pp) elegida.alcance = pp.alcance; }   // ESC2
    const falta = elegida.base - elegida.yT; if (falta > 0.12) escalinata(J, fis, elegida, falta, gs, R, extra);   // pendiente abajo: descanso y peldaños de piedra desde el borde del podio hasta la calle (con colisión)
    const n = elegida.n, rumbo = Math.atan2(n.x, n.z);
    if (!elegida.kitPuerta) puertaVisible(J, elegida, cl, fis);
    const p = { x: elegida.F.x + n.x * 1.6, y: elegida.ySill, z: elegida.F.z + n.z * 1.6, rumbo, sala: 'int_' + (k++), cara: elegida.cara, lado: 'entrada', nombre: cl.nombre, gen: true, cerrada: !!cl.cerrada,
      plan: cl.cerrada ? null : plan(kg, gs, elegida, cl, M.def) };
    R.puertas.push(p); R.interiores.push(p);
  }
  const g = new THREE.Group(); g.name = 'puertas_interiores';
  for (const key of Object.keys(J.p)) { const geo = J.geometria(key, CON_UV(key) ? uvCaja : null); if (geo) { const m = new THREE.Mesh(geo, mt(key)); m.castShadow = true; m.receiveShadow = true; g.add(m); } }
  for (const m of extra) g.add(m);
  R.exterior.add(g);
  colisionKit(R, fis);   // ESC: colisión de los peldaños de puerta que dibujan los kits (después de elegir las puertas: no cambia cuáles sirven)
}
// caras posibles para la puerta: frente (+Z del kit, donde el kit dibuja su puerta) y fondo
function candidatosKit(kg) {
  kg.updateWorldMatrix(true, false);
  const u = kg.userData.kit, out = [];
  for (const [cara, z, nz] of [['frente', u.zF, 1], ['fondo', -u.Ww / 2, -1]]) {
    const F = new THREE.Vector3(0, u.zoc, z).applyMatrix4(kg.matrixWorld), n = new THREE.Vector3(0, 0, nz).transformDirection(kg.matrixWorld);
    out.push({ cara, F, n, base: new THREE.Vector3(0, 0, 0).applyMatrix4(kg.matrixWorld).y, zoc: u.zoc, kitPuerta: cara === 'frente' && u.puerta, alcance: u.alcance, kit: true });   // ESC: alcance = hasta dónde salen los peldaños (y el pórtico) del kit
  }
  // N2 (14-11): si las dos caras largas están tapadas (camarote_rojo), puerta en un testero (la dibuja puertaVisible; el interior es el mismo)
  const zcL = u.zF === u.Ww / 2 ? 0 : -(u.Ww / 2 - u.zF) / 2;
  for (const [cara, sx] of [['este', 1], ['oeste', -1]]) {
    const F = new THREE.Vector3(sx * u.Lw / 2, u.zoc, zcL).applyMatrix4(kg.matrixWorld), n = new THREE.Vector3(sx, 0, 0).transformDirection(kg.matrixWorld);
    out.push({ cara, F, n, base: out[0].base, zoc: u.zoc, kitPuerta: false, kit: true });
  }
  return out;
}
function candidatosLote(gs) {
  const l = gs.lote, largoX = l.largo >= l.ancho, W = gs.real ? gs.real.W : Math.min(l.largo, l.ancho) * 0.97, out = [];
  for (const s of [1, -1]) {
    const n = new THREE.Vector3(largoX ? 0 : s, 0, largoX ? s : 0);
    out.push({ cara: s > 0 ? 'frente' : 'fondo', F: new THREE.Vector3(l.x + n.x * W / 2, gs.base, l.z + n.z * W / 2), n, base: gs.base, zoc: 0, kit: false });
  }
  return out;
}
// la puerta sirve si afuera hay suelo cerca de la altura del piso, nada la tapa y el muro está donde se cree (rayo hacia la fachada)
function puertaAlcanzable(fis, c) {
  const n = c.n, F = c.F.clone();
  const desde = { x: F.x + n.x * 3.5, y: c.base + 1.3, z: F.z + n.z * 3.5 };
  const h = fis.rayo(desde, { x: -n.x, y: 0, z: -n.z }, 6, undefined, ['baranda']);
  if (!h) return { motivo: 'sin fachada' };
  if (!c.kit) { if (h.toi < 1.5) return { motivo: 'tapada' }; F.set(h.punto.x, F.y, h.punto.z); }
  else if (Math.abs(h.toi - 3.5) > 1.2) return { motivo: 'fachada a ' + h.toi.toFixed(1) };   // otro edificio o un muro entre la calle y la fachada
  const T = { x: F.x + n.x * 1.6, z: F.z + n.z * 1.6 }, hs = fis.rayo({ x: T.x, y: c.base + c.zoc + 2.5, z: T.z }, { x: 0, y: -1, z: 0 }, 30), yT = hs ? hs.punto.y : -1e4;   // (fis.suelo salta lo que choca a < 5 m: el terreno es UN colisionador)
  const ySill = c.base + c.zoc;
  if (yT > ySill + 0.35 || yT < c.base - 3.2) return { motivo: 'suelo ' + (yT - ySill).toFixed(1) };   // la puerta quedaría enterrada o en el aire
  for (const dx of [-0.6, 0.6]) {   // espacio libre frente a la puerta (2,2 m hacia la calle)
    const o = { x: T.x - n.z * dx, y: yT + 1.0, z: T.z + n.x * dx };
    const b = fis.rayo(o, { x: n.x, y: 0, z: n.z }, 2.2, undefined, ['baranda']); if (b && b.toi < 1.8) return { motivo: 'obstáculo a ' + b.toi.toFixed(1) };
  }
  return { F, ySill, yT, dFis: c.kit ? Math.max(0, 3.5 - h.toi) : 0 };   // ESC: dFis = cuánto sale la caja física del edificio delante de la fachada del kit (galería)
}
// puerta dibujada (si el kit no la trae en esa cara, o el edificio es una malla): marco blanco, hoja, dintel, tejadillo y peldaños
function puertaVisible(J, c, cl, fis) {
  const n = c.n, rot = Math.atan2(n.x, n.z), F = c.F, y0 = c.ySill, w = 1.3, h = 2.35, hoja = cl.cerrada || cl.tipo === 'solteros' || cl.tipo === 'oficina' ? 'madera' : 'blanco';
  const P = (u, v, d) => [F.x + Math.cos(rot) * u + n.x * d, y0 + v, F.z - Math.sin(rot) * u + n.z * d];
  const caja = (k, u, v, d, sx, sy, sz) => { const [x, y, z] = P(u, v, d); J.caja(k, x, y, z, sx, sy, sz, rot); };
  caja(hoja, 0, h / 2, 0.06, w, h, 0.08);
  caja('maderaOsc', 0, h * 0.3, 0.11, w * 0.7, h * 0.32, 0.02); caja('maderaOsc', 0, h * 0.72, 0.11, w * 0.7, h * 0.3, 0.02);
  caja('laton', w * 0.36, h * 0.47, 0.14, 0.06, 0.06, 0.06);
  for (const s of [-1, 1]) caja('blanco', s * (w / 2 + 0.07), h / 2, 0.1, 0.14, h + 0.1, 0.12);
  caja('blanco', 0, h + 0.12, 0.1, w + 0.45, 0.2, 0.14);
  caja('blanco', 0, h + 0.42, 0.45, w + 0.9, 0.07, 0.85);   // tejadillo
  const dif = y0 - c.base;   // N1-C73: solo del umbral al piso del edificio; del podio a la calle sube la escalinata() (antes se dibujaban las dos)
  const pp = pasosPuerta(c);
  if (pp) { const np = pp.np; for (let i = 0; i < np; i++) { const top = dif - i * dif / np; caja(`muro:piedra:${0xb8ada0}`, 0, -dif + top / 2, pp.d0 + (i + 0.5) * 0.28, w + 0.5, top, 0.28);
    // ESC (16-11, Diego: TALLER · CERRADO): estos peldaños eran solo dibujo y Nato quedaba hundido hasta los muslos (la física era el
    // suelo de abajo). Ahora cada peldaño lleva su caja de colisión, la misma que se ve; el paso automático (0,55 m) los sube de a uno
    if (fis) { const [x, y, z] = P(0, -dif + top / 2, pp.d0 + (i + 0.5) * 0.28); fis.caja(x, y, z, w + 0.5, top, 0.28, rot, { tipo: 'escalera' }); } } }
}
// ESC (16-11): peldaños de la puerta dibujada, del umbral al piso del edificio. Arrancan donde termina la caja física del edificio
// (dFis: en los kits con galería la caja sale hasta ~1 m delante de la fachada y los peldaños de arriba quedaban dentro del muro:
// Nato se topaba con una pared invisible a media escalera). null si no hay peldaños.
function pasosPuerta(c) {
  const dif = c.ySill - c.base; if (c.kitPuerta || !(dif > 0.08)) return null;
  const np = Math.max(1, Math.round(dif / 0.2)), d0 = c.recortada ? 0.08 : Math.max(0.2, (c.dFis || 0) + 0.02);   // ESC2: recortada → desde el botaguas del zócalo (0,08 m)
  return { dif, np, d0, alcance: d0 + np * 0.28 };
}
// ESC (16-11): colisión de los peldaños de puerta de los kits (kitSewell.js los guarda en userData.kit.peldanos: [x, tope, z, ancho,
// huella] en el marco del kit, y 0 = su base). Una caja por peldaño, de la base del kit a su tope, igual a la que se ve.
function colisionKit(R, fis) {
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  R.exterior.updateMatrixWorld(true);
  const podios = new Map();   // ESC2: kit → cara de arriba de su podio de piedra a la vista (construir.js e._podio, con .mat si se dibuja), para recortarCuerpo
  for (const gs of R.gaussianas || []) if (gs.grupo && gs.podio && gs.podio.yb != null && gs.podio.mat) gs.grupo.traverse(o => { if (o.userData.kit) podios.set(o, gs.podio.yb); });
  R.exterior.traverse(o => {
    const u = o.userData.kit; if (!u || !u.peldanos || !u.peldanos.length || o.userData.escFis) return;
    o.userData.escFis = true; o.matrixWorld.decompose(v, q, s);   // (el marco «afuera» de las nubes puede venir dado vuelta: se usa el cuaternión entero)
    for (const [x, top, z, ancho, huella] of u.peldanos) {
      const p = new THREE.Vector3(x, top / 2, z).applyMatrix4(o.matrixWorld);
      fis.caja(p.x, p.y, p.z, ancho * Math.abs(s.x), top * Math.abs(s.y), huella * Math.abs(s.z), 0, { tipo: 'escalera' }, { x: q.x, y: q.y, z: q.z, w: q.w });
    }
    recortarCuerpo(fis, o, u, s, podios.get(o));   // ESC2
  });
}
// ESC2 (16-11, Diego: «que Nato no se entierre»; camarotes y TALLER del N1): la caja física del edificio (construir.js, colCuerpo: el 103 %
// de la planta) sale ~0,6 m delante de la fachada del kit y tapaba los peldaños de arriba y el umbral: Nato chocaba con una pared invisible
// antes de la escalera. Se recorta solo una franja del ancho de los peldaños (+0,1 m por lado), de la base del kit hacia arriba y hasta la
// fachada (o el borde de adentro del primer peldaño / piso del porche): queda 1 caja abajo (hasta la cara del podio), 1 detrás y 2 a los costados.
function recortarCuerpo(fis, o, u, s, yPodio) {
  const M4 = o.matrixWorld, muros = new Set();
  for (const [x, top, z] of u.peldanos) {
    const p = new THREE.Vector3(x, top + 0.9, z).applyMatrix4(M4);
    fis.mundo.intersectionsWithPoint({ x: p.x, y: p.y, z: p.z }, c => { const et = fis.etiquetas.get(c.handle); if (et && et.tipo === 'muro' && et.cuerpo) muros.add(c); return true; });
  }
  if (!muros.size) return false;
  const zCorte = Math.min(u.zF, ...u.peldanos.map(p => p[2] - p[4] / 2)), hw = (Math.max(...u.peldanos.map(p => p[3])) / 2 + 0.1) * Math.abs(s.x);
  const P0 = new THREE.Vector3(0, 0, zCorte).applyMatrix4(M4), C0 = new THREE.Vector3(0, 0, 0).applyMatrix4(M4), nW = new THREE.Vector3(0, 0, 1).transformDirection(M4);
  return recortarMuros(fis, muros, nW, P0, C0, hw, yPodio);
}
// ESC2: recorta cada caja «cuerpo» de muros: en la cara que mira a nW, una franja de ancho 2·hw centrada en C0 (x, z) queda libre desde la
// altura de C0 (o la cara del podio, yPodio) hacia arriba y hasta el plano de P0. true si recortó alguna
function recortarMuros(fis, muros, nW, P0, C0, hw, yPodio) {
  let hecho = false;
  for (const c of muros) {
    const he = c.halfExtents && c.halfExtents(), t = c.translation(), qc = c.rotation(); if (!he || Math.abs(qc.x) > 1e-3 || Math.abs(qc.z) > 1e-3) continue;
    const Qc = new THREE.Quaternion(qc.x, qc.y, qc.z, qc.w), Qi = Qc.clone().invert(), nL = nW.clone().applyQuaternion(Qi);
    const k = Math.abs(nL.x) > 0.999 ? 'x' : Math.abs(nL.z) > 0.999 ? 'z' : null; if (!k) continue;
    const b = k === 'x' ? 'z' : 'x', sg = Math.sign(nL[k]), T = new THREE.Vector3(t.x, t.y, t.z);
    const pl = P0.clone().sub(T).applyQuaternion(Qi), cl = C0.clone().sub(T).applyQuaternion(Qi), fk = pl[k], sb = cl[b], yb = Math.max(C0.y, yPodio ?? -1e9) - t.y;   // el corte, a la base del kit o a la cara del podio (lo más alto: en la franja recortada se pisa el podio)
    if (!(sg * fk < he[k] - 0.05 && sg * fk > -he[k] + 0.5 && yb > -he.y + 0.05 && yb < he.y - 0.5)) continue;
    const R = { x: [-he.x, he.x], y: [-he.y, he.y], z: [-he.z, he.z] }, cajas = [];
    const atras = sg > 0 ? [-he[k], fk] : [fk, he[k]], frente = sg > 0 ? [fk, he[k]] : [-he[k], fk];
    cajas.push({ ...R, y: [yb, he.y], [k]: atras });
    if (sb - hw > -he[b] + 0.05) cajas.push({ ...R, y: [yb, he.y], [k]: frente, [b]: [-he[b], sb - hw] });
    if (sb + hw < he[b] - 0.05) cajas.push({ ...R, y: [yb, he.y], [k]: frente, [b]: [sb + hw, he[b]] });
    const et = fis.etiquetas.get(c.handle);
    for (const r of cajas) {   // (en el marco de la caja: centro → mundo con su giro)
      const cen = new THREE.Vector3((r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2, (r.z[0] + r.z[1]) / 2).applyQuaternion(Qc).add(T);
      fis.caja(cen.x, cen.y, cen.z, r.x[1] - r.x[0], r.y[1] - r.y[0], r.z[1] - r.z[0], 0, { tipo: 'muro' }, qc);
    }
    // la caja original queda como el podio: de su fondo a la base del kit (o a la cara del podio de piedra, que sobresale 0,2 m de la caja:
    // esa franja frente a la puerta ahora se pisa —antes la caja no dejaba llegar— y no tenía colisión: un hoyo de ~1 m entre los peldaños)
    const kL = [-he[k], he[k]]; if (yPodio != null) { if (sg > 0) kL[1] += 0.2; else kL[0] -= 0.2; }
    const hL = { x: he.x, y: (yb + he.y) / 2, z: he.z }; hL[k] = (kL[1] - kL[0]) / 2;
    const cL = new THREE.Vector3(0, (-he.y + yb) / 2, 0); cL[k] = (kL[0] + kL[1]) / 2;
    c.setHalfExtents(hL); c.setTranslation(cL.applyQuaternion(Qc).add(T));
    if (et) et.cuerpo = false;
    hecho = true;
  }
  return hecho;
}
// ESC2: puerta dibujada en otra cara del kit (este, oeste o fondo: puertaVisible): la caja del edificio salía dFis m delante de la fachada
// y los peldaños arrancaban ahí, con una pared invisible entre ellos y la puerta (casa de obreros casados del N2 y el N4). Se recorta la
// caja frente a la puerta (franja de 2,4 m, el ancho de la escalinata) y los peldaños vuelven a salir de la fachada
function recortarPuerta(fis, c, R) {
  const n = c.n, F = c.F, muros = new Set(), yS = c.base + c.zoc;
  for (const f of [0.25, 0.5, 0.75]) { const d = Math.max(0.05, c.dFis * f);
    fis.mundo.intersectionsWithPoint({ x: F.x + n.x * d, y: yS + 0.9, z: F.z + n.z * d }, col => { const et = fis.etiquetas.get(col.handle); if (et && et.tipo === 'muro' && et.cuerpo) muros.add(col); return true; }); }
  if (!muros.size) return false;
  let yPodio = null; for (const gs of R.gaussianas || []) { let es = false; if (gs.podio && gs.podio.mat) gs.grupo.traverse(o => { if (o === c.kg) es = true; }); if (es) yPodio = gs.podio.yb; }
  return recortarMuros(fis, muros, n.clone().setY(0).normalize(), F.clone(), new THREE.Vector3(F.x, c.base, F.z), 1.2, yPodio);
}

// N1-C73: descanso y peldaños de piedra (el material del podio) desde el BORDE DEL PODIO hasta la calle, con colisión. Antes era hormigón gris liso
// que arrancaba en la fachada y salía por el aire más allá del podio, y encima quedaba la escalera de piedra de construir.js.
function escalinata(J, fis, c, falta, gs, R, extra, soloMedir) {   // ESC: soloMedir → { np, h } sin construir nada
  const n = c.n, rot = Math.atan2(n.x, n.z), F = c.F, w = 2.2, pod = gs && gs.podio, mat = (pod && pod.mat) || R.matEscalon;
  let dE = 0;   // distancia de la fachada al borde del podio (el zócalo sobresale 0,2 m de la planta)
  if (pod && pod.mat) dE = Math.abs(n.z) > 0.5 ? ((n.z > 0 ? pod.z1 + 0.2 : pod.z0 - 0.2) - F.z) * n.z : ((n.x > 0 ? pod.x1 + 0.2 : pod.x0 - 0.2) - F.x) * n.x;
  dE = Math.max(0, dE);
  const top0 = pod ? pod.yb : c.base, ftop = top0 - (c.base - falta);   // altura de la cara del podio sobre la calle
  const prof = Math.max(0.6, (c.kitPuerta ? Math.max(1.7, (c.alcance || 0) + 0.1) : c.alcance ? c.alcance + 0.1 : 0.3) - dE);   // ESC: con pórtico los peldaños del kit salen hasta ~3,3 m   // el descanso cubre también los peldaños del kit (1,7 m desde la fachada) que asoman del podio
  const pz = (d, sy, sd, top) => {
    const x = F.x + n.x * d, z = F.z + n.z * d;
    if (mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, sy, sd), mat); m.position.set(x, top - sy / 2, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true; extra.push(m); }
    else J.caja('peldano', x, top - sy / 2, z, w, sy, sd, rot);
    fis.caja(x, top - sy / 2, z, w, sy, sd, rot, { tipo: 'escalera' });
  };
  // N1-C74: la escalera se apoya en el suelo REAL bajo cada peldaño. Antes todos los peldaños llegaban a la cota yT (medida a 1,6 m
  // de la fachada) y en la ladera la escalera quedaba colgando sobre la pendiente. Ahora: suelo = lo más bajo de 3 × 3 rayos bajo la
  // huella de cada pieza (sin muros, techos ni otras escaleras); el número de peldaños sale del desnivel entre el descanso y el suelo
  // al pie de la escalera (que se busca de nuevo cada vez que la escalera se alarga) y cada pieza es maciza hasta 0,3 m bajo su suelo.
  const cr = Math.cos(rot), sr = Math.sin(rot), SALTA = ['muro', 'techo', 'baranda', 'escalera', 'azotea'];
  const suelo = (d0, d1) => {
    let m = 1e9;
    for (const d of [d0, (d0 + d1) / 2, d1]) for (const u of [-w / 2 + 0.05, 0, w / 2 - 0.05]) {
      const h = fis.rayo({ x: F.x + n.x * d + cr * u, y: top0 + 1.5, z: F.z + n.z * d - sr * u }, { x: 0, y: -1, z: 0 }, 60, undefined, SALTA);
      if (h && h.toi > 0.05) m = Math.min(m, h.punto.y);
    }
    return m < 1e8 ? m : c.base - falta;
  };
  // la escalera más corta cuyo pie calza con el suelo: con np peldaños el pie queda a np·HU del descanso; se acepta el primer np
  // cuya contrahuella (desnivel hasta el suelo de ese pie ÷ np) no pase de CH. Pendiente de la escalera CH/HU = 0,79 > la ladera
  // del pueblo (≤ 0,5): antes, a 0,6, en (-140,-170) no alcanzaba nunca el suelo
  const HU = 0.28, CH = 0.22, d0 = dE + prof, NMAX = 40;
  let np = NMAX, yPie = suelo(d0 + (NMAX - 1) * HU, d0 + NMAX * HU + 0.3);
  for (let k = 1; k <= NMAX; k++) {
    const y = suelo(d0 + (k - 1) * HU, d0 + k * HU + 0.3);
    if ((top0 - y) / k <= CH) { np = k; yPie = y; break; }
  }
  if (top0 - yPie < 0.05) { np = 1; yPie = top0 - 0.05; }
  const h = (top0 - yPie) / np;
  if (soloMedir) return { np, h };
  const yD = Math.min(top0 - 0.3, suelo(dE, d0)) - 0.3;
  pz(dE + prof / 2, top0 - yD, prof, top0);   // descanso a la altura del podio, macizo hasta el suelo
  for (let i = 1; i < np; i++) {
    const d = d0 + (i - 0.5) * HU, top = top0 - i * h, yB = Math.min(top - 0.3, suelo(d - HU / 2, d + HU / 2) - 0.3);
    pz(d, top - yB, HU, top);
  }
  (R.escalinatas ||= []).push({ x: F.x, z: F.z, nx: n.x, nz: n.z, top0, yPie, np, d0, dE, prof, w });   // N1-C74: para las pruebas (herramientas/c74_medir.js)
}

// ------------------------------------------------------------------ plan del interior (medidas, pisos, ventanas, tipo)
function plan(kg, gs, c, cl, def) {
  const epoca = def.epoca || 1940, semilla = Math.round(Math.abs(gs.lote.x * 73.1 + gs.lote.z * 19.7)) + (c.cara === 'fondo' ? 3 : 0);
  let Lw, D, pisos, hp, vanos = [], techoA = 0, muroA = 0;
  if (kg) {
    const u = kg.userData.kit; Lw = u.Lw; D = u.zF + u.Ww / 2; pisos = u.pisos; hp = u.altoPiso; techoA = u.cumbrera - u.zoc; muroA = u.muro - u.zoc;   // N1-INT1905b: cumbrera y tope del muro sobre el piso
    const zcL = u.zF === u.Ww / 2 ? 0 : -(u.Ww / 2 - u.zF) / 2;
    for (const [cara, uu, v, w, h] of u.vanos) {
      let x, z;   // en el marco del kit
      if (cara === 'frente') { x = uu; z = u.zF; } else if (cara === 'fondo') { x = -uu; z = -u.Ww / 2; } else if (cara === 'este') { x = u.Lw / 2; z = zcL - uu; } else { x = -u.Lw / 2; z = zcL + uu; }
      if (c.cara === 'fondo') { x = -x; z = -(z + u.Ww / 2); } else z = z - u.zF;   // al marco del interior: puerta en z = 0
      vanos.push({ x, z, y: v - u.zoc, w, h });
    }
  } else {
    const l = gs.lote; Lw = (gs.real ? gs.real.L : Math.max(l.largo, l.ancho) * 0.97) - 0.6; D = (gs.real ? gs.real.W : Math.min(l.largo, l.ancho) * 0.97) - 0.6;
    pisos = gs.real && gs.real.H ? Math.max(2, Math.min(6, Math.round((gs.real.H - 4.6) / 3.2))) : 3; hp = 3.2;
    const nb = Math.max(1, Math.floor((Lw - 1.8) / 2.2)); const nbI = nb % 2 ? nb : nb - 1;
    for (let p = 0; p < pisos; p++) for (let i = 0; i < nbI; i++) {
      const x = (i - (nbI - 1) / 2) * 2.2, y = p * hp + hp * 0.3 + 0.75;
      if (!(p === 0 && Math.abs(x) < 0.1)) vanos.push({ x, z: 0, y, w: 1.0, h: 1.5 });
      vanos.push({ x, z: -D, y, w: 1.0, h: 1.5 });
    }
  }
  return { tipo: cl.tipo, nombre: cl.nombre, epoca, semilla, Lw, D, pisos: Math.max(1, Math.min(7, pisos)), hp: Math.max(2.7, hp), vanos, techoA, muroA };
}

// ------------------------------------------------------------------ construir el interior (al entrar)
export function construirInterior(M, puerta) {
  const t0 = performance.now(), pl = puerta.plan, r = azar(pl.semilla * 7 + 1), E = estilo(pl.tipo, pl.epoca, r, pl.semilla);
  const fis = M.fis, cols = [], J = new Junta(); QUEROSENO = pl.tipo === 'hamilton' || !!E.rustico; RUSTICO = !!E.rustico; luzVentanas = null;
  const y0 = Math.max(0, Math.ceil(altura(ORIGEN.x, ORIGEN.z) + 3));
  const O = new THREE.Vector3(ORIGEN.x, y0, ORIGEN.z);
  const col = (x, y, z, sx, sy, sz, tipo = 'muro', quat) => cols.push(fis.caja(O.x + x, O.y + y, O.z + z, sx, sy, sz, 0, { tipo }, quat));
  const n = pl.pisos, hp = pl.hp, H = n * hp, D = pl.D, X = Math.min(pl.Lw / 2, XMAX), zMin = -D, tg = 0.2, tp = 0.12;
  // N1-INT1905b (15-11, Diego: «de un solo piso y no tan apretados; concepto de espacios abiertos»): la casa de piedra de UN piso es una
  // sola sala de planta abierta bajo las cerchas a la vista hasta el zinc (techo alto al centro); las zonas las definen muebles y luz
  const abierta = pl.tipo === 'piedra1905' && n === 1 && pl.techoA > hp + 0.5, muroA = abierta ? Math.max(hp, pl.muroA || hp) : hp, yCum = abierta ? pl.techoA - 0.15 : H;
  const cw = D >= 9 ? 1.8 : 1.65, zc1 = -(D - cw) / 2, zc0 = zc1 - cw;   // pasillo: z de zc0 (fondo) a zc1 (frente)
  const hall = 1.35, run0 = Math.ceil(hp / 2 / 0.18), riser = hp / 2 / run0, huella = 0.29, run = run0 * huella;   // N0-INT2: contrahuella ≤ 0,18 y huella 0,29 (cómoda)
  // N1-HAMILTON (15-11, Diego: «la escalera está contra la ventana; esta casa es de las antiguas, rediséñala a concepto abierto»): casa Hamilton de
  // 2 pisos SIN pasillo ni tabiques. Escalera en U de madera alrededor de un muro de alma de piedra EXENTO al centro (ningún tramo ni el descanso
  // queda delante de una ventana de la fachada: todos los muros exteriores tienen vanos), descanso al poniente, entrepiso con vigas a la vista,
  // 2.º piso abierto bajo las cerchas hasta el zinc. HS: x del descanso (xW..xL), de los tramos (xL..xE); z del tramo A (sube hacia -x, zA0..zA1,
  // lado de la calle), del alma (zA1..zB0) y del tramo B (vuelve hacia +x, zB0..zB1, lado del fondo).
  // N1-CAMAROTE1905 (15-11, Diego: «moderno por dentro y apretado»): el camarote de 1905 usa la MISMA estructura abierta (sin pasillo ni tabiques, entrepiso con vigas,
  // escalera en U de palo alrededor de un tabique ciego lejos de la puerta, 2.º piso hasta el zinc); sus muebles en amoblar (rama p.cam)
  const esHam = pl.tipo === 'hamilton', cam = pl.tipo === 'solteros' && !!E.rustico && !/[?&]cam1905=0/.test(location.search);
  const ham = (esHam || cam) && n === 2 && pl.muroA > H - 0.2 && pl.techoA > pl.muroA + 0.8 && X > 1.95 + run + 1.2 && D > 6.6;
  const xEh = Math.max(1.95 + run, X - (esHam ? 1.65 : 1.5));   // N1-HAMILTON-c (casa agrandada): la escalera queda junto al muro oriente con un paso de ≥ 1,3 m; con la casa chica, igual que antes
  const HS = ham ? { xW: xEh - run - 1.15, xL: xEh - run, xE: xEh,   // N1-HAMILTON-c (Diego: «al entrar chocas con la escalera»): corrida al oriente, vestíbulo libre frente a la puerta
    zA0: -D / 2 + 1.33, zA1: -D / 2 + 0.28, zB0: -D / 2 - 0.12, zB1: -D / 2 - 1.17 } : null, muroH = ham ? pl.muroA : H, yCumH = ham ? pl.techoA - 0.15 : H;
  const xs0 = -0.8, xA = xs0 + 1.6;   // escalera: zona de llegada (1,6 m) x∈[xs0, xA] y tramos desde xA
  let xe = xA + run + 1.9; if (X - xe < 3.2) xe = X;   // descanso de 1,9 m (≥ ancho del tramo); hasta el muro si al lado no cabe una pieza
  const zona = zc0 - zMin, wB = Math.min(2.1, (zona - 0.1) / 2);   // N0-INT2: tramos de 2 m útiles (antes B era de 1,0 m)
  const bB0 = zMin, bB1 = zMin + wB, alma = bB1 + 0.05, bA0 = bB1 + 0.1, bA1 = zc0;   // franjas de los tramos (B contra el muro de fondo)
  const vanosEn = (pared, f) => pl.vanos.filter(v => Math.floor((v.y + 0.01) / hp) === f && (pared === 'F' || pared === 'B' ? Math.abs(v.x) < X - 0.4 && Math.abs(v.z - (pared === 'F' ? 0 : -D)) < 0.3
    : Math.abs(v.x - (pared === 'E' ? 1 : -1) * pl.Lw / 2) < 0.3 && pl.Lw / 2 <= X + 0.01 && v.z < -0.5 && v.z > -D + 0.5));
  // N0-INT-AMPLIO (15-11, Diego: «muy apretadas; menos habitaciones pero más amplias»): interiores genéricos de 1915 en adelante con menos piezas por piso y más grandes.
  // Cada lado del pasillo se reparte con un ciclo de roles por tipo y un ancho objetivo por rol; las piezas de estar (living-comedor, comedor de la pensión,
  // sala de escritorios) quedan ABIERTAS al pasillo (vano ancho sin puerta: se leen como un solo espacio con él); las demás con puerta de 1,2 m. ?amplio=0 = reparto de antes.
  const amplio = !E.rustico && !ham && !abierta && /^(casados|empleados|solteros|oficina)$/.test(pl.tipo) && !/[?&]amplio=0/.test(location.search);
  const ANCHO_A = { estarC: 7.0, livingA: 7.0, dormitorio: pl.tipo === 'solteros' ? 6.5 : 5.0, ninos: 4.6, cocinaE: 4.8, bano: 3.2, comedorS: 7.0, lavatorio: 4.2, salaOf: 11, jefe: 5.0, dibujo: 6.5, archivo: 4.2 };
  const ABIERTO_A = new Set(['estarC', 'livingA', 'comedorS', 'salaOf']);
  const CICLO_A = { casados: { F: ['estarC', 'dormitorio'], B: ['dormitorio', 'ninos', ...(pl.epoca >= 1940 ? ['bano'] : [])] }, empleados: { F: ['livingA', 'dormitorio'], B: ['cocinaE', 'bano', 'dormitorio'] },
    solteros: { F: ['dormitorio', 'comedorS', 'dormitorio'], B: ['dormitorio', 'lavatorio'] }, oficina: { F: ['salaOf'], B: ['jefe', 'dibujo', 'archivo'] } }[pl.tipo];
  const partirA = (a0, a1, lado, f, k) => {   // piezas de un tramo con su rol; tabiques fuera de las ventanas; la última toma lo que sobra (si sobra mucho, es la pieza de estar)
    const len = a1 - a0; if (len < 0.3) return []; if (len < 3.3) return [{ x0: a0, x1: a1, closet: true }];
    const ci = CICLO_A[lado], vs = vanosEn(lado, f).map(v => [v.x - v.w / 2, v.x + v.w / 2]), out = [], MIN = 3.5, big = pl.tipo === 'solteros' ? null : ci.find(q => ABIERTO_A.has(q));   // solteros: un comedor por ciclo, lo que sobra es dormitorio
    let i = (pl.semilla + f * 2 + k) % ci.length, x = a0;
    const corte = (c, lo) => { const ch = vs.find(([u0, u1]) => c > u0 - 0.2 && c < u1 + 0.2); if (!ch) return c; const A = ch[0] - 0.25, B = ch[1] + 0.25; return c - A < B - c && A - lo >= 2.9 ? A : B; };   // el tabique no cae en una ventana
    for (let g = 0; g < 12; g++) {
      const rol = ci[i % ci.length], resto = a1 - x;
      if (resto < ANCHO_A[rol] + MIN) {   // lo que queda: una pieza (si es muy ancho: la de estar del ciclo, o el rol más grande en vez de baño/lavatorio/archivo, o dos piezas)
        const sig = ci[(i + 1) % ci.length], mayor = ci.filter(q => !ABIERTO_A.has(q)).sort((p, q) => ANCHO_A[q] - ANCHO_A[p])[0] || rol;
        let ro = rol; if (/^(bano|lavatorio|archivo)$/.test(ro) && resto > ANCHO_A[ro] * 1.45) ro = mayor;
        if (resto > 6.4 && big) out.push({ x0: x, x1: a1, rol: big });
        else if (resto <= Math.max(ANCHO_A[ro] * 1.35, 6.2)) out.push({ x0: x, x1: a1, rol: ro });
        else { const c = corte(x + resto / 2, x); if (c - x >= MIN - 0.4 && a1 - c >= MIN - 0.4) { out.push({ x0: x, x1: c, rol: ro === 'bano' ? sig : ro }); out.push({ x0: c, x1: a1, rol: ro === 'bano' ? ro : sig }); } else out.push({ x0: x, x1: a1, rol: ro }); }
        break;
      }
      const c = corte(x + ANCHO_A[rol], x);
      if (a1 - c < MIN) { out.push({ x0: x, x1: a1, rol }); break; }
      out.push({ x0: x, x1: c, rol }); x = c; i++;
    }
    for (const q of out) q.amplio = true;
    return out;
  };

  // --- pisos y losas (la 1.ª losa entera; las de arriba con el hueco de la escalera)
  const losa = (x0, x1, za, zb, y, f) => { if (x1 - x0 < 0.05 || zb - za < 0.05) return; const cx = (x0 + x1) / 2, cz = (za + zb) / 2;
    J.caja(E.piso(f), cx, y - 0.02, cz, x1 - x0, 0.04, zb - za); J.caja(E.cieloLosa, cx, y - 0.14, cz, x1 - x0, 0.2, zb - za); col(cx, y - 0.12, cz, x1 - x0, 0.24, zb - za, 'piso'); };
  J.caja(E.piso(0), 0, -0.02, -D / 2, 2 * X, 0.04, D); col(0, -0.5, -D / 2, 2 * X + 1, 1, D + 1, 'piso');
  if (ham) { const h = HS; losa(-X, X, zMin, h.zB1, hp, 1); losa(-X, X, h.zA0, 0, hp, 1); losa(-X, h.xW, h.zB1, h.zA0, hp, 1); losa(h.xE, X, h.zB1, h.zA0, hp, 1);   // entrepiso con el hueco de la escalera
    const yv = hp - 0.33;   // vigas del entrepiso a la vista (a lo hondo, cada 0,95 m); N1-VIGAS-ESCALERA: ninguna cruza el hueco: se cortan en dos brochales (cabezales) que apoyan en dos vigas de borde (cabios) corridas de pared a pared
    const xT0 = h.xW - 0.1, xT1 = h.xE + 0.1, hueco = x => x > xT0 - 0.1 && x < xT1 + 0.1;
    for (let x = -X + 0.45; x < X - 0.2; x += 0.95) { if (!hueco(x) && (Math.abs(x - xT0) < 0.17 || Math.abs(x - xT1) < 0.17)) continue;   // las que quedarían pegadas a una viga de borde sobran
      for (const [z0, z1] of hueco(x) ? [[zMin, h.zB1 - 0.08], [h.zA0 + 0.08, -0.02]] : [[zMin, -0.02]]) if (z1 - z0 > 0.05) J.caja('vigas', x, yv, (z0 + z1) / 2, 0.13, 0.18, z1 - z0); }
    for (const x of [xT0, xT1]) J.caja('vigas', x, yv - 0.01, -(D + 0.02) / 2, 0.15, 0.2, D - 0.02);   // viga de borde: de la pared del fondo a la de la calle
    for (const z of [h.zB1 - 0.08, h.zA0 + 0.08]) J.caja('vigas', (xT0 + xT1) / 2, yv - 0.01, z, xT1 - xT0, 0.2, 0.15);   // brochales
  } else for (let f = 1; f < n; f++) { const y = f * hp; losa(-X, xA, zMin, 0, y, f); losa(xe, X, zMin, 0, y, f); losa(xA, xe, bA1, 0, y, f); }
  if (abierta) techoAbierto(J, col, E, X, D, muroA, yCum, tg);
  else if (ham) techoAbierto(J, col, E, X, D, muroH, yCumH, tg);   // 2.º piso abierto hasta el zinc
  else { J.caja(E.techo, 0, H + 0.1, -D / 2, 2 * X, 0.2, D); col(0, H + 0.3, -D / 2, 2 * X + 1, 0.6, D + 1, 'techo'); }
  if (E.rustico && !abierta) for (let f = ham ? n - 1 : 0; f < n; f++) {   // N1-VIGAS-ESCALERA: con la escalera abierta (ham) el entrepiso ya tiene sus vigas y brochales arriba: este lazo del pasillo las duplicaba y cruzaba el hueco   // N1-INT1905: vigas de madera a la vista bajo cada losa y bajo el zinc (sobre el hueco de la escalera solo del lado de la calle)
    const yv = (f + 1) * hp - (f === n - 1 ? 0 : 0.24) - 0.09;
    for (let x = -X + 0.45; x < X - 0.2; x += 0.95) { const hueco = f < n - 1 && x > xA - 0.15 && x < xe + 0.15, z0 = hueco ? bA1 + 0.14 : zMin, z1 = -0.02;
      J.caja('vigas', x, yv, (z0 + z1) / 2, 0.13, 0.18, z1 - z0); }
    if (f < n - 1) { const xs = []; for (let x = -X + 0.45; x < X - 0.2; x += 0.95) xs.push(x); const a = xs.filter(x => x <= xA - 0.15).pop(), b = xs.find(x => x >= xe + 0.15);   // N1-VIGAS-ESCALERA: brochal (cabezal) donde acaban las vigas cortadas en el hueco, apoyado en las dos vigas de borde
      if (a !== undefined) J.caja('vigas', (a + (b === undefined ? X : b)) / 2, yv - 0.01, bA1 + 0.07, (b === undefined ? X : b) - a, 0.2, 0.14); }
    if (f === n - 1) J.caja('vigas', 0, H - 0.25, -D / 2, 2 * X, 0.2, 0.18);   // viga cumbrera
  }

  // --- muros exteriores con los vanos de la fachada (ventanas con marco, vidrio, alféizar y cortinas)
  const muroLinea = (eje, fijo, a0, a1, yA, yB, huecos, grosor, clave = E.muro, conCol = true) => {   // huecos: {a0, a1, v0, v1, puerta}
    const us = new Set([a0, a1]), vs = new Set([yA, yB]);
    for (const o of huecos) { us.add(Math.max(a0, Math.min(a1, o.a0))); us.add(Math.max(a0, Math.min(a1, o.a1))); vs.add(o.v0); vs.add(o.v1); }
    const U = [...us].sort((a, b) => a - b), V = [...vs].filter(v => v >= yA && v <= yB).sort((a, b) => a - b);
    for (let i = 0; i < U.length - 1; i++) {
      let ini = null;
      for (let j = 0; j <= V.length - 1; j++) {
        const llena = j < V.length - 1 && !huecos.some(o => U[i] >= o.a0 - 1e-6 && U[i + 1] <= o.a1 + 1e-6 && V[j] >= o.v0 - 1e-6 && V[j + 1] <= o.v1 + 1e-6);
        if (llena && ini === null) ini = V[j];
        if (!llena && ini !== null) { const c = (U[i] + U[i + 1]) / 2, l = U[i + 1] - U[i], h = V[j] - ini, ym = (ini + V[j]) / 2;
          if (eje === 'x') J.caja(clave, c, ym, fijo, l, h, grosor); else J.caja(clave, fijo, ym, c, grosor, h, l); ini = null; }
      }
    }
    if (!conCol) return;
    // colisión: entre puertas (las ventanas cuentan como muro), más los dinteles
    const ps = huecos.filter(o => o.puerta).sort((a, b) => a.a0 - b.a0); let a = a0;
    const pieza = (p0, p1, v0, v1) => { if (p1 - p0 < 0.02 || v1 - v0 < 0.02) return; const c = (p0 + p1) / 2; if (eje === 'x') col(c, (v0 + v1) / 2, fijo, p1 - p0, v1 - v0, grosor); else col(fijo, (v0 + v1) / 2, c, grosor, v1 - v0, p1 - p0); };
    for (const o of ps) { pieza(a, o.a0, yA, yB); pieza(o.a0, o.a1, o.v1, yB); a = o.a1; }
    pieza(a, a1, yA, yB);
  };
  const ventana = (pared, v) => {   // en el plano interior del muro, mirando hacia adentro
    const nI = pared === 'F' ? [0, -1] : pared === 'B' ? [0, 1] : pared === 'E' ? [-1, 0] : [1, 0];
    const px = pared === 'E' ? X - tg : pared === 'W' ? -X + tg : v.x, pz = pared === 'F' ? -tg : pared === 'B' ? zMin + tg : v.z, w = v.w, h = v.h, eX = nI[1] !== 0;
    const B = (k, a, y, d, sa, sy, sd) => eX ? J.caja(k, px + a, y, pz + nI[1] * d, sa, sy, sd) : J.caja(k, px + nI[0] * d, y, pz + a, sd, sy, sa);
    for (const s of [-1, 1]) B(E.marco, s * (w / 2 + 0.04), v.y, 0.02, 0.09, h + 0.12, 0.06);
    B(E.marco, 0, v.y + h / 2 + 0.05, 0.02, w + 0.2, 0.1, 0.06); B(E.marco, 0, v.y - h / 2 - 0.03, 0.08, w + 0.26, 0.05, 0.2);   // alféizar
    B(E.marco, 0, v.y, -0.06, w, 0.05, 0.04); B(E.marco, 0, v.y, -0.06, 0.04, h, 0.04);   // travesaño de la guillotina y montante (1905: postigo de dos hojas)
    if (E.rustico || E.llama) {   // N1-INT1905: la luz de la ventana se nota: haz de luz inclinado y mancha clara en el piso (aditivos, sin costo de luces)
      const yF = Math.floor((v.y + 0.01) / hp) * hp, top = v.y + h / 2, bot = v.y - h / 2, d0 = (bot - yF) * 0.55 + 0.25, d1 = (top - yF) * 0.55 + 0.25;
      const Pn = (a, y, d) => eX ? [px + a, y, pz + nI[1] * d] : [px + nI[0] * d, y, pz + a], hw = w / 2;
      J.quad('rayo', Pn(-hw, top, 0.05), Pn(hw, top, 0.05), Pn(hw, yF + 0.02, d1), Pn(-hw, yF + 0.02, d1));
      J.quad('rayo', Pn(-hw, bot, 0.05), Pn(hw, bot, 0.05), Pn(hw, yF + 0.02, d0), Pn(-hw, yF + 0.02, d0));
      J.quad('mancha', Pn(-hw, yF + 0.025, d0), Pn(hw, yF + 0.025, d0), Pn(hw, yF + 0.025, d1), Pn(-hw, yF + 0.025, d1));
      (luzVentanas ||= []).push([px + (eX ? 0 : nI[0] * 1.2), v.y, pz + (eX ? nI[1] * 1.2 : 0)]);
    }
    const gx = eX ? px : px - nI[0] * 0.08, gz = eX ? pz - nI[1] * 0.08 : pz;
    const g = new THREE.PlaneGeometry(eX ? w : w, h); if (!eX) g.rotateY(Math.PI / 2); g.translate(gx, v.y, gz); J.add('vidrio', g);
    if (pl.tipo === 'casados' || pl.tipo === 'empleados' || pl.tipo === 'hamilton' || (E.cortina && r() < 0.5)) {   // cortina de gasa rosada (casa obrera) o visillo crema (empleados), a un lado
      const s = r() < 0.5 ? -1 : 1, cg = new THREE.PlaneGeometry(w * 0.42, h + 0.2, 12, 1);
      { const pa = cg.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, 0.018 * Math.sin(pa.getX(i) / (w * 0.42) * Math.PI * 2 * 3)); cg.computeVertexNormals(); }   // N1-HAMILTON-b: pliegues (no un plano liso)
      if (!eX) cg.rotateY(Math.PI / 2);
      const off = s * w * 0.32; cg.translate(eX ? px + off : px + nI[0] * 0.1, v.y + 0.05, eX ? pz + nI[1] * 0.1 : pz + off); J.add(E.cortina || (pl.tipo === 'casados' ? 'cortina' : 'visillo'), cg);
    }
  };
  for (let f = 0; f < n; f++) {
    const yA = f * hp, yB = abierta ? muroA : ham && f === n - 1 ? muroH : (f + 1) * hp; if (E.muroF) E.muro = E.muroF(Math.min(f, 1));
    const hue = (pared) => vanosEn(pared, f).map(v => ({ a0: (pared === 'F' || pared === 'B' ? v.x : v.z) - v.w / 2, a1: (pared === 'F' || pared === 'B' ? v.x : v.z) + v.w / 2, v0: v.y - v.h / 2, v1: v.y + v.h / 2 }));
    const hF = hue('F'); if (f === 0) hF.push({ a0: -0.65, a1: 0.65, v0: 0, v1: 2.35, puerta: true });
    muroLinea('x', -tg / 2, -X, X, yA, yB, hF, tg); muroLinea('x', zMin + tg / 2, -X, X, yA, yB, hue('B'), tg);
    muroLinea('z', X - tg / 2, zMin, 0, yA, yB, hue('E'), tg); muroLinea('z', -X + tg / 2, zMin, 0, yA, yB, hue('W'), tg);
    for (const p of ['F', 'B', 'E', 'W']) for (const v of vanosEn(p, f)) ventana(p, v);
  }
  // puerta de calle: hoja abierta hacia adentro, marco y la luz del día en el vano
  J.caja(E.puerta, -0.62, 1.17, -0.75, 0.06, 2.3, 1.2); J.caja(E.rustico ? 'fierro' : 'laton', -0.56, 1.1, -1.25, 0.05, 0.05, 0.05);
  for (const s of [-1, 1]) J.caja(E.marco, s * 0.72, 1.2, -tg - 0.02, 0.12, 2.45, 0.05);
  J.caja(E.marco, 0, 2.42, -tg - 0.02, 1.6, 0.14, 0.05);
  J.caja('dia', 0, 1.18, 0.12, 1.3, 2.36, 0.02);

  // --- pasillo, piezas y escalera, piso por piso
  const piezas = [];
  const partir = (a0, a1, lado, f) => {   // reparte un tramo del pasillo en piezas (N0-INT2: de 3,6 a 5 m de ancho, más amplias), con tabiques entre las ventanas de la fachada
    const len = a1 - a0; if (len < 0.3) return [];
    if (len < 3.3) return [{ x0: a0, x1: a1, closet: true }];
    const k = Math.max(1, Math.floor(len / (pl.tipo === 'solteros' ? 4.4 : 3.9))), vs = vanosEn(lado, f).map(v => [v.x - v.w / 2, v.x + v.w / 2]), cortes = [a0];
    for (let i = 1; i < k; i++) {
      let x = a0 + len * i / k;
      const choca = vs.find(([u0, u1]) => x > u0 - 0.2 && x < u1 + 0.2);
      if (choca) x = (x - choca[0] < choca[1] - x) ? choca[0] - 0.25 : choca[1] + 0.25;
      if (x - cortes[cortes.length - 1] > 3.2 && a1 - x > 3.2) cortes.push(x);
    }
    cortes.push(a1);
    return cortes.slice(0, -1).map((x, i) => ({ x0: x, x1: cortes[i + 1] }));
  };
  if (abierta) piezas.push({ x0: -X, x1: X, lado: 'F', f: 0, zc: zMin + tg, zo: -tg, pu: 0, rol: 'abierta' });   // N1-INT1905b: una sola «pieza»: toda la casa
  else if (ham) for (let f = 0; f < 2; f++) piezas.push({ x0: -X, x1: X, lado: 'F', f, zc: zMin + tg, zo: -tg, pu: 0, rol: (esHam ? 'ham' : 'cam') + f, ham: HS, cam });   // N1-HAMILTON: cada piso es una sola «pieza»
  else for (let f = 0; f < n; f++) {
    const yA = f * hp, yB = yA + hp; if (E.muroF) E.muro = E.muroF(Math.min(f, 1));
    const PA = amplio ? partirA : (a0, a1, lado, f) => partir(a0, a1, lado, f);
    const frente = [...PA(-X, -hall, 'F', f, 0), ...PA(hall, X, 'F', f, 1)].map(p => ({ ...p, lado: 'F', f, zc: zc1, zo: -tg }));
    const fondo = [...PA(-X, xs0, 'B', f, 0), ...PA(xe, X, 'B', f, 1)].map(p => ({ ...p, lado: 'B', f, zc: zc0, zo: zMin + tg }));
    // muros del pasillo con las puertas de las piezas (N0-INT-AMPLIO: puertas de 1,2 m; piezas de estar abiertas al pasillo)
    const hw = amplio ? 0.6 : 0.5, huecosZ = [];
    for (const [lista, zl, tramos] of [[frente, zc1, [[-X, -hall], [hall, X]]], [fondo, zc0, [[-X, xs0], [xe, X]]]]) for (const [a0, a1] of tramos) {
      if (a1 - a0 < 0.05) continue;
      const hs = lista.filter(p => !p.closet && p.x0 >= a0 - 1e-6 && p.x1 <= a1 + 1e-6).map(p => { const c = (p.x0 + p.x1) / 2; p.pu = c;
        if (amplio && ABIERTO_A.has(p.rol)) { p.abiertoA = true; return { a0: p.x0 + 0.35, a1: p.x1 - 0.35, v0: yA, v1: yA + 2.45, puerta: true, abierto: true }; }
        return { a0: c - hw, a1: c + hw, v0: yA, v1: yA + 2.2, puerta: true }; });
      muroLinea('x', zl, a0, a1, yA, yB, hs, tp, E.tabique || E.muro);
      huecosZ.push([zl, a0, a1, hs]);
      for (const h of hs) {   // marco y hoja abierta contra el tabique
        const c = (h.a0 + h.a1) / 2, s = zl === zc1 ? 1 : -1;
        if (h.abierto) {   // vano ancho sin hoja: jambas y dintel con moldura
          for (const xx of [h.a0 - 0.035, h.a1 + 0.035]) J.caja(E.marco, xx, yA + 1.245, zl, 0.08, 2.49, tp + 0.06);   // 5 mm dentro del vano: sin caras coplanares con la punta del muro
          J.caja(E.marco, c, yA + 2.495, zl, h.a1 - h.a0 + 0.16, 0.1, tp + 0.06); continue;
        }
        for (const sx of [-1, 1]) J.caja(E.marco, c + sx * (hw + (amplio ? 0.035 : 0.04)), yA + 1.12, zl, 0.08, 2.24, tp + 0.06);
        J.caja(E.marco, c, yA + 2.24, zl, 2 * hw + 0.16, 0.1, tp + 0.06);
        J.caja(E.puerta === 'madera' ? 'maderaOsc' : E.puerta, c - hw + 0.02, yA + 1.08, zl + s * (hw - 0.04), 0.05, 2.12, 2 * hw - 0.14); J.caja(E.rustico ? 'fierro' : 'laton', c - hw + 0.07, yA + 1.0, zl + s * (2 * hw - 0.18), 0.04, 0.04, 0.04);
      }
    }
    // tabiques entre piezas (y los del hall y la escalera)
    const tabique = (x, za, zb) => { J.caja(E.tabique || E.muro, x, yA + hp / 2, (za + zb) / 2, tp, hp, Math.abs(zb - za)); col(x, yA + hp / 2, (za + zb) / 2, tp, hp, Math.abs(zb - za)); };
    for (const p of frente) { if (p.x0 > -X + 0.01) tabique(p.x0, zc1, 0); if (p.x1 < X - 0.01) tabique(p.x1, zc1, 0); }
    for (const p of fondo) { if (p.x0 > -X + 0.01) tabique(p.x0, zMin, zc0); if (p.x1 < X - 0.01) tabique(p.x1, zMin, zc0); }
    tabique(xs0, zMin, zc0); if (xe < X - 0.01) tabique(xe, zMin, zc0);
    // zócalo del pasillo (blanco en la casa obrera, madera en el resto)
    if (E.zocalo && amplio) for (const [zl, a0, a1, hs] of huecosZ) {   // N0-INT-AMPLIO: el zócalo se corta en puertas y vanos (no cruza el umbral)
      const zz = zl === zc1 ? zc1 - tp / 2 - 0.013 : zc0 + tp / 2 + 0.013; let a = Math.max(a0, -X + 0.2);
      for (const h of [...hs].sort((p, q) => p.a0 - q.a0)) { if (h.a0 - a > 0.05) J.caja(E.zocalo, (a + h.a0) / 2, yA + 0.08, zz, h.a0 - a, 0.16, 0.025); a = h.a1; }
      const b = Math.min(a1, X - 0.2); if (b - a > 0.05) J.caja(E.zocalo, (a + b) / 2, yA + 0.08, zz, b - a, 0.16, 0.025);
    }
    else if (E.zocalo) for (const zl of [zc1 - tp / 2 - 0.01, zc0 + tp / 2 + 0.01]) J.caja(E.zocalo, 0, yA + 0.08, zl, 2 * X - 0.4, 0.16, 0.025);
    // lámparas del pasillo cada ~4,5 m (1905: un farol de parafina colgado de la viga cada ~7 m)
    for (let x = -X + 2.2; x < X - 1; x += E.rustico ? 7 : 4.5) lampara(J, x, yB - (E.rustico ? 0.3 : 0.05), (zc0 + zc1) / 2, 0.55);
    for (const p of [...frente, ...fondo]) if (!p.closet) piezas.push(p);
    // nicho del hall en los pisos de arriba: banca y macetero
    if (f > 0) { J.caja('maderaClara', 0, yA + 0.23, -0.55, 1.5, 0.08, 0.42); for (const s of [-1, 1]) J.caja('maderaOsc', s * 0.65, yA + 0.11, -0.55, 0.06, 0.22, 0.38); col(0, yA + 0.23, -0.55, 1.5, 0.46, 0.42, 'mueble'); }
    else if (E.rustico) halls1905(J, col, yA, pl.tipo);   // N1-INT1905: clavos con ropa y herramientas del minero junto a la puerta
    else { J.caja('maderaOsc', 1.0, yA + 0.5, -0.4, 0.5, 1.0, 0.3); J.caja('cartel:' + (pl.tipo === 'oficina' ? 'BRADEN|COPPER CO.|OFICINAS' : pl.tipo === 'solteros' ? 'PROHIBIDO|EL LICOR' : 'BIENVENIDOS'), 1.0, yA + 1.7, -0.1, 0.7, 0.7, 0.02); }
    for (const s of [-1, 1]) tabique(s * hall, zc1, 0);
  }

  if (E.muroF) E.muro = E.muroF(0);   // muro de alma y despensa: de piedra
  // --- escalera en U entre todos los pisos: tramo A sube hacia +x junto al pasillo, descanso al fondo, tramo B vuelve contra el muro
  const rampa = (xa, ya, xb, yb, za, zb) => {
    const [ca, cb] = xa < xb ? [[xa, ya], [xb, yb]] : [[xb, yb], [xa, ya]];   // colisión con la normal hacia arriba (tramo B baja hacia +x)
    const L = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]), ang = Math.atan2(cb[1] - ca[1], cb[0] - ca[0]), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang);
    const nx = -Math.sin(ang), ny = Math.cos(ang), cx = (xa + xb) / 2 - nx * 0.15, cy = (ya + yb) / 2 - ny * 0.15, angV = Math.atan2(yb - ya, xb - xa);
    const dir = Math.sign(xb - xa);   // peldaños de madera (huella y contrahuella) y zancas
    // ESC (16-11, Diego: «que Nato no se entierre en las escaleras»): antes la colisión era una rampa por los talones de las huellas
    // (en la nariz quedaba una contrahuella entera, ~18 cm, bajo lo que se ve). Ahora una caja por peldaño a la altura de su huella,
    // de una contrahuella + 6 cm de grueso (cáscara escalonada: no tapa el paso bajo el tramo de arriba); el paso automático los sube
    for (let i = 0; i < run0; i++) col(xa + dir * (i + 0.5) * huella, ya + (i + 1) * riser - (riser + 0.06) / 2, (za + zb) / 2, huella + 0.004, riser + 0.06, Math.abs(zb - za), 'escalera');
    for (let i = 0; i < run0; i++) { const x = xa + dir * (i + 0.5) * huella, y = ya + (i + 1) * riser;
      J.caja(E.peldano, x, y - 0.03, (za + zb) / 2, huella + 0.02, 0.06, zb - za); J.caja('madera', xa + dir * i * huella, y - (riser + 0.06) / 2, (za + zb) / 2, 0.03, riser - 0.06, zb - za); }   // N1-HAMILTON-b: contrahuella bajo la huella (su tapa era coplanar con la huella)
    const zg = new THREE.BoxGeometry(L, 0.28, 0.07); zg.rotateZ(angV);   // N1-HAMILTON-b: zancas 1 cm más afuera que las huellas (sus caras eran coplanares)
    for (const z of [za + 0.025, zb - 0.025]) { const g = zg.clone(); g.translate((xa + xb) / 2, (ya + yb) / 2 - 0.05, z); J.add('madera', g); }
    zg.dispose();
  };
  const baranda = (xa, ya, xb, yb, z) => {   // pasamanos con barrotes (colisión fina: la cámara la ignora)
    const L = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa), g = new THREE.BoxGeometry(L, 0.06, 0.07); g.rotateZ(ang); g.translate((xa + xb) / 2, (ya + yb) / 2 + 0.95, z); J.add('madera', g);
    const nb = Math.max(2, Math.round(Math.abs(xb - xa) / 0.32)); for (let i = 0; i <= nb; i++) { const t = i / nb, x = xa + (xb - xa) * t, y = ya + (yb - ya) * t; J.caja(i === 0 || i === nb ? 'madera' : E.marco, x, y + 0.48, z, i === 0 || i === nb ? 0.09 : 0.035, 0.95, i === 0 || i === nb ? 0.09 : 0.035); }
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang); col((xa + xb) / 2, (ya + yb) / 2 + 0.55, z, L, 1.1, 0.08, 'baranda', { x: q.x, y: q.y, z: q.z, w: q.w });
  };
  const xT = xA + run;   // fin de los tramos (inicio del descanso)
  if (ham) escaleraHam();
  else for (let f = 0; f < n - 1; f++) {
    const y = f * hp;
    rampa(xA, y, xT, y + hp / 2, bA0, bA1);                       // tramo A
    const yd = y + hp / 2; J.caja(E.peldano, (xT + xe) / 2, yd - 0.03, (bB0 + bA1) / 2, xe - xT, 0.06, bA1 - bB0); J.caja(E.cieloLosa, (xT + xe) / 2, yd - 0.17, (bB0 + bA1) / 2, xe - xT, 0.22, bA1 - bB0);
    col((xT + xe) / 2, yd - 0.15, (bB0 + bA1) / 2, xe - xT, 0.3, bA1 - bB0, 'escalera');   // descanso
    rampa(xT, yd, xA, y + hp, bB0, bB1);                          // tramo B (vuelve)
    baranda(xA, y + riser, xT, yd, bA1 - 0.05);                   // pasamanos del tramo A (lado del pasillo)
    baranda(xT, yd, xe - 0.05, yd, bA1 - 0.05);                   // y del descanso
  }
  // muro de alma entre los tramos (todo el alto) y, en el último piso, baranda alrededor del hueco
  const yTop = (n - 1) * hp;
  if (n > 1 && !ham) { J.caja(E.muro, (xA + xT) / 2, yTop / 2 + 0.1, alma, xT - xA, yTop + 0.2, 0.1); col((xA + xT) / 2, yTop / 2 + 0.1, alma, xT - xA, yTop + 0.2, 0.1);
    baranda(xA, yTop, xT, yTop, alma);
    for (let f = 1; f < n; f++) baranda(xA, f * hp, xe - 0.05, f * hp, bA1 + 0.04);   // borde del hueco en cada piso de arriba (lado del pasillo)
    const g = new THREE.BoxGeometry(0.07, 0.06, bA1 - bA0); g.translate(xA, yTop + 0.95, (bA0 + bA1) / 2); J.add('madera', g); col(xA, yTop + 0.55, (bA0 + bA1) / 2, 0.08, 1.1, bA1 - bA0, 'baranda');
    for (let z = bA0 + 0.2; z < bA1; z += 0.3) J.caja(E.marco, xA, yTop + 0.48, z, 0.035, 0.95, 0.035);
    // bajo el tramo B del 1.er piso: despensa cerrada (no se queda atascado bajo el descanso)
    J.caja(E.muro, xA, (hp - 0.3) / 2, (bB0 + bB1) / 2, 0.1, hp - 0.3, bB1 - bB0); col(xA, (hp - 0.3) / 2, (bB0 + bB1) / 2, 0.1, hp - 0.3, bB1 - bB0);
    J.caja('maderaOsc', xA - 0.06, 1.0, (bB0 + bB1) / 2, 0.03, 2.0, 0.8);
  }
  // letrero del piso en la llegada de la escalera
  if (!E.rustico && !ham) for (let f = 0; f < n; f++) J.caja('cartel:PISO ' + (f + 1), xs0 + 0.08, f * hp + 1.75, (bB0 + bB1) / 2, 0.02, 0.32, 0.32);

  // N1-HAMILTON: escalera en U de madera alrededor del muro de alma (piedra abajo, antepecho de tablas arriba). Tramo A desde el oriente (pie en xE)
  // hacia el descanso del poniente; tramo B vuelve hacia el oriente y llega al 2.º piso en xE. Bajo los tramos y el descanso: despensa cerrada
  // con tablas (no se queda atascado debajo). Arriba, el hueco con baranda de madera en sus 4 lados (la llegada queda libre).
  function escaleraHam() {
    const h = HS, yd = hp / 2, pied = E.muroF ? E.muroF(0) : E.muro;
    rampa(h.xE, 0, h.xL, yd, h.zA1, h.zA0);                                  // tramo A
    J.caja(E.peldano, (h.xW + h.xL) / 2, yd - 0.03, (h.zA0 + h.zB1) / 2, h.xL - h.xW, 0.06, h.zA0 - h.zB1);   // descanso
    J.caja(E.cieloLosa, (h.xW + h.xL) / 2, yd - 0.17, (h.zA0 + h.zB1) / 2, h.xL - h.xW - 0.02, 0.22, h.zA0 - h.zB1 - 0.03);
    col((h.xW + h.xL) / 2, yd - 0.15, (h.zA0 + h.zB1) / 2, h.xL - h.xW, 0.3, h.zA0 - h.zB1, 'escalera');
    rampa(h.xL, yd, h.xE, hp, h.zB1, h.zB0);                                 // tramo B
    // barandas de la escalera (madera: pasamanos, balaustres y pilares)
    baranda(h.xE, riser, h.xL, yd, h.zA0 - 0.05); baranda(h.xL, yd, h.xW + 0.05, yd, h.zA0 - 0.05);
    barandaH(h.xW + 0.05, h.zA0, h.xW + 0.05, h.zB1, yd); baranda(h.xW + 0.05, yd, h.xL, yd, h.zB1 + 0.05); baranda(h.xL, yd, h.xE, hp, h.zB1 + 0.05);
    J.caja('madera', h.xE, 0.62, h.zA0 - 0.05, 0.14, 1.24, 0.14); J.add('madera', new THREE.SphereGeometry(0.085, 10, 8).translate(h.xE, 1.3, h.zA0 - 0.05));   // pilar del arranque
    // muro de alma: piedra en el 1.er piso, antepecho de tablas con su tapa en el 2.º
    const zc = (h.zA1 + h.zB0) / 2, ga = h.zA1 - h.zB0, la = h.xE - h.xL, xc = (h.xL + h.xE) / 2;
    J.caja(pied, xc, hp / 2, zc, la, hp, ga); J.caja('madera', xc, hp + 0.47, zc, la, 0.94, ga - 0.04); J.caja('madera', xc, hp + 0.97, zc, la + 0.06, 0.06, ga + 0.1);
    col(xc, (hp + 1.0) / 2, zc, la, hp + 1.0, ga);
    // despensa bajo el descanso (tablas con puerta al poniente) y tablas bajo los tramos, peldaño a peldaño
    const hD = yd - 0.26; J.caja('madera', (h.xW + h.xL) / 2 + 0.02, hD / 2, (h.zA0 + h.zB1) / 2, h.xL - h.xW - 0.04, hD, h.zA0 - h.zB1 - 0.04);
    col((h.xW + h.xL) / 2, hD / 2, (h.zA0 + h.zB1) / 2, h.xL - h.xW, hD, h.zA0 - h.zB1);
    J.caja('maderaOsc', h.xW - 0.005, 0.95, (h.zA0 + h.zB1) / 2, 0.03, 1.6, 0.75); J.caja('laton', h.xW - 0.03, 0.95, (h.zA0 + h.zB1) / 2 + 0.28, 0.03, 0.04, 0.04);
    for (let i = 0; i < run0; i++) {
      const xa = h.xE - (i + 0.5) * huella, ha = (i + 1) * riser - 0.07, xb = h.xL + (i + 0.5) * huella, hb = yd + (i + 1) * riser - 0.07;
      J.caja('madera', xa, ha / 2, h.zA0 - 0.035, huella + 0.005, ha, 0.03); if (ha > 0.2) col(xa, ha / 2, h.zA0 - 0.035, huella, ha, 0.04);   // tablas detrás de la zanca (sin caras coplanares)
      J.caja('madera', xb, hb / 2, h.zB1 + 0.035, huella + 0.005, hb, 0.03); col(xb, hb / 2, h.zB1 + 0.035, huella, hb, 0.04);
    }
    const hE = hp - 0.3, zE = (h.zB0 + h.zB1) / 2; J.caja('madera', h.xE + 0.015, hE / 2, zE, 0.03, hE, h.zB0 - h.zB1); col(h.xE + 0.015, hE / 2, zE, 0.04, hE, h.zB0 - h.zB1);   // cierre bajo el final del tramo B
    J.caja('maderaOsc', h.xE + 0.035, 0.95, zE, 0.02, 1.85, 0.72); J.caja('laton', h.xE + 0.055, 0.95, zE + 0.27, 0.03, 0.04, 0.04);   // puerta de la despensa
    // 2.º piso: baranda de madera en el borde del hueco (calle, poniente, fondo y, al oriente, solo frente al tramo A; la llegada del tramo B queda libre)
    barandaH(h.xW - 0.04, h.zA0 + 0.04, h.xE, h.zA0 + 0.04, hp); barandaH(h.xW - 0.04, h.zA0 + 0.04, h.xW - 0.04, h.zB1 - 0.04, hp);
    barandaH(h.xW - 0.04, h.zB1 - 0.04, h.xE, h.zB1 - 0.04, hp); barandaH(h.xE + 0.04, h.zA0, h.xE + 0.04, h.zA1, hp);
  }
  function barandaH(xa, za, xb, zb, y) {   // baranda horizontal (en x o en z) con pasamanos, solera, balaustres cada ~0,16 m y pilares en los extremos
    const L = Math.hypot(xb - xa, zb - za), cx = (xa + xb) / 2, cz = (za + zb) / 2, ex = Math.abs(xb - xa) >= Math.abs(zb - za);
    J.caja('madera', cx, y + 0.95, cz, ex ? L : 0.07, 0.06, ex ? 0.07 : L); J.caja('madera', cx, y + 0.07, cz, ex ? L : 0.06, 0.05, ex ? 0.06 : L);
    const nb = Math.max(2, Math.round(L / 0.16)); for (let i = 0; i <= nb; i++) { const t = i / nb, p0 = i === 0 || i === nb; J.caja(p0 ? 'madera' : E.marco, xa + (xb - xa) * t, y + 0.49, za + (zb - za) * t, p0 ? 0.09 : 0.035, p0 ? 1.0 : 0.85, p0 ? 0.09 : 0.035); }
    col(cx, y + 0.55, cz, ex ? L : 0.08, 1.1, ex ? 0.08 : L, 'baranda');
  }

  // --- muebles de cada pieza según el tipo
  const roles = { hamilton: [], solteros: ['dormitorio', 'dormitorio', 'comedorS', 'dormitorio', 'lavatorio'], casados: ['unica', 'unica', 'ninos', 'unica', 'dormitorio'],
    empleados: ['livingcom', 'cocinaE', 'dormitorio', 'bano', 'dormitorio', 'livingcom'], oficina: ['oficina', 'dibujo', 'archivo', 'oficina', 'jefe'] }[pl.tipo];
  const rolesP = [['cocinaP', 'dormP', 'bodegaP'], ['dormP', 'dormP', 'bodegaP']];   // N1-INT1905: casa de piedra: abajo cocina con estufa, pieza y bodega; arriba piezas
  const rolesH = [['living', 'comedor', 'escritorioH', 'cocina', 'estar', 'estar'], ['dormitorioH', 'dormitorioH', 'dormitorio', 'bano', 'dormitorio', 'dormitorio']];   // Hamilton: abajo sala, comedor, escritorio; arriba dormitorios
  U = new Colocador();   // N0-UTIL
  const ADL = ADLOG = [];   // N0-ADORNOS-VANOS: registro de adornos de pared (sala.adornos) para medir
  const OBS = [];   // UTIL-T0: cajas de colisión de los muebles [x, y, z, sx, sy, sz] (marco del interior) para colocar NPC y recuerdos en un punto libre
  const colA = (x, y, z, sx, sy, sz, tipo = 'muro', quat) => { if (sy < hp * 0.9) OBS.push([x, y, z, sx, sy, sz]); return col(x, y, z, sx, sy, sz, tipo, quat); };
  piezas.forEach((p, i) => { if (p.rol === 'abierta' || p.ham) return amoblar(J, colA, p, pl, E, r, hp, X);
    if (pl.tipo === 'piedra1905') { const lst = rolesP[Math.min(p.f, 1)]; p.rol = lst[(piezas.filter(q => q.f === p.f).indexOf(p) + p.f) % lst.length]; amoblar(J, colA, p, pl, E, r, hp, X); return; }
    if (pl.tipo === 'hamilton') { const lst = rolesH[Math.min(p.f, 1)]; p.rol = lst[piezas.filter(q => q.f === p.f).indexOf(p) % lst.length]; } else if (!p.rol) p.rol = roles[(i + (pl.semilla % 3)) % roles.length]; amoblar(J, colA, p, pl, E, r, hp, X); });

  // --- grupo: una malla por material, la vista exterior y la luz
  const g = new THREE.Group(); g.name = 'interior_' + puerta.sala; g.position.copy(O); g.visible = false;
  for (const key of Object.keys(J.p)) { const geo = J.geometria(key, CON_UV(key) ? uvCaja : null); if (!geo) continue; const m = new THREE.Mesh(geo, mt(key)); m.name = key; m.receiveShadow = true; m.castShadow = false; m.frustumCulled = false; if (key === 'vidrio' || key === 'cortina' || key === 'visillo') m.renderOrder = 2; g.add(m); }
  U.armar(g); const util = U; U = null;   // N0-UTIL: copias instanciadas por pieza y piso (LOD por piso)
  const vista = new THREE.Mesh(new THREE.CylinderGeometry(90, 90, 160, 40, 1, true), mt(E.vista)); vista.position.set(0, 20, -D / 2); vista.scale.set(1, 1, 1); g.add(vista);
  // N1-INT1905: sin electricidad: ambiente más bajo (más contraste), luz de llama naranja que titila y una luz fría de la ventana más cercana
  const llama = E.rustico || E.llama;   // N1-HAMILTON: la casa Hamilton también se alumbra con llama (sin electricidad)
  g.add(new THREE.AmbientLight(llama ? 0xffd0a0 : 0xffe0b8, E.rustico ? 0.5 : E.llama ? 0.6 : 0.9));
  const luces = [0, 1].map(() => { const l = new THREE.PointLight(llama ? 0xffa452 : 0xffcf8a, llama ? (abierta ? 30 : ham ? 30 : 26) : 30, llama ? (abierta ? 13 : ham ? 14 : 11) : 16, 1.5); l.castShadow = false; g.add(l); return l; });
  const lv = luzVentanas || [], luzV = llama && lv.length ? new THREE.PointLight(0xd8e6ff, 22, 7, 1.4) : null; luzVentanas = null;
  if (luzV) { luzV.castShadow = false; g.add(luzV); }
  const sala = { id: puerta.sala, nombre: pl.nombre, grupo: g, origen: O, oscura: false, gen: true, entrada: { x: O.x, y: O.y, z: O.z - 0.3 }, salida: null,
    specs: [], agua: [], ascensores: [], vagonetas: [], metas: [], cols, pisos: n, hp, D, X, piezas, escalera: { xA, xT, xe, xs0, bA0, bA1, bB0, bB1, zc0, zc1 }, ms: 0,
    abierta: abierta ? { muroA, yCum, ...puntosAbierta(X, D) } : ham ? { muroA: muroH, yCum: yCumH, ...(cam ? puntosCam(HS, hp, X, D) : puntosHam(HS, hp, X, D)) } : null,
    hamilton: ham && esHam ? pruebaHam(HS, hp, D, X) : null, prueba1905: ham && cam ? pruebaCam(HS, hp, X, D) : null };
  if (ham) Object.assign(sala.escalera, { xA: HS.xL, xT: HS.xE, xe: HS.xE, xs0: HS.xW, bA0: HS.zA1, bA1: HS.zA0, bB0: HS.zB1, bB1: HS.zB0 });
  M.escena.add(g);
  // luces que siguen a Nato en su piso (2 puntuales para todo el edificio)
  M.L.agregar({ tipo: 'decor', vivo: true, sala: sala.id, act: () => {
    const j = M.jug, f = Math.max(0, Math.min(n - 1, Math.floor((j.pie - O.y + 0.3) / hp))), yl = f * hp + hp - 1.1;   // R-6: más abajo del cielo raso (la luz pegada al techo lo quemaba en un manchón)
    util.verPiso(f);
    luces[0].position.set(j.pos.x - O.x, yl, j.pos.z - O.z);
    if (abierta) luces[1].position.set(-X + 1.3, 1.3, -D / 2);   // N1-INT1905b: el fuego de la cocina de fierro alumbra su rincón
    else if (ham && cam) luces[1].position.set(f ? -X / 2 : -X * 0.68, f * hp + (f ? 2.2 : 1.0), f ? -D / 2 : -D + 1.2);   // N1-CAMAROTE1905: abajo el fuego de la cocina; arriba el farol del dormitorio
    else if (ham) luces[1].position.set(-X + 0.9, f * hp + 0.7, -D / 2);   // N1-HAMILTON: el fuego de la chimenea del poniente (en los dos pisos)
    else luces[1].position.set(Math.max(-X + 1, Math.min(X - 1, j.pos.x - O.x + 6)), yl, (zc0 + zc1) / 2);
    if (llama) {   // llama: titila; ventana: la más cercana a Nato en su piso
      const t = M.t; for (const [i, l] of luces.entries()) { const fl = 0.92 + 0.06 * Math.sin(t * 9.1 + i * 2) + 0.04 * Math.sin(t * 23.7 + i); l.intensity = l.intensity / (l.userData.fl || 1) * fl; l.userData.fl = fl; }
      if (luzV) { let mejor = null, dm = 1e9; const jx = j.pos.x - O.x, jz = j.pos.z - O.z;
        for (const w of lv) { if (Math.floor((w[1] + 0.01) / hp) !== f) continue; const d = Math.hypot(w[0] - jx, w[2] - jz); if (d < dm) { dm = d; mejor = w; } }
        if (mejor) luzV.position.set(mejor[0], mejor[1], mejor[2]); luzV.visible = !!mejor; }
    }
  } });
  sala.adornos = ADL; sala.obst = OBS; poblar(M, sala, pl, r, O);
  sala.ms = performance.now() - t0;
  return sala;
}
export function destruirInterior(M, id) {
  const s = M.R.salas[id]; if (!s || !s.gen) return;
  for (const c of s.cols) M.fis.mundo.removeCollider(c, false);
  s.grupo.traverse(o => { if (o.userData.util) o.dispose(); else if (o.geometry) o.geometry.dispose(); });   // N0-UTIL: la geometría de la utilería es compartida   // los materiales son compartidos (caché)
  s.grupo.removeFromParent();
  for (const e of M.L.lista) if (e.sala === id && e.vivo) M.L.quitar(e);
  if (M.burbujaDe && M.burbujaDe.sala === id) { M.burbujaDe = null; }
  delete M.R.salas[id];
}

// N1-INT1905b: techo de la sala abierta: zinc a dos aguas visto desde adentro, cerchas de madera (tirante, pares, pendolón y tornapuntas)
// cada ~2,3 m, correas, cumbrera y solera; hastiales de pirca hasta la cumbrera. Colisión inclinada bajo el zinc (la cámara no sale).
function techoAbierto(J, col, E, X, D, muroA, yCum, tg) {
  const zm = -D / 2, hR = yCum - muroA, yAt = z => muroA + hR * (1 - Math.abs(z - zm) / (D / 2));
  const viga = (k, x, z0, y0, z1, y1, sx, sy) => { const dz = z1 - z0, dy = y1 - y0; J.caja(k, x, (y0 + y1) / 2, (z0 + z1) / 2, sx, sy, Math.hypot(dz, dy), 0, Math.atan2(-dy, dz)); };
  for (const [z0, z1] of [[0.05, zm], [zm, -D - 0.05]]) {   // las dos aguas
    const y0 = yAt(Math.min(0, Math.max(-D, z0))), y1 = yAt(z1), dz = z1 - z0, dy = y1 - y0, L = Math.hypot(dz, dy), a = Math.atan2(-dy, dz);
    viga(E.techo, 0, z0, y0 + 0.03, z1, y1 + 0.03, 2 * X - 0.03, 0.05);   // N1-HAMILTON-b: sus testeros eran coplanares con los muros
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    col(0, (y0 + y1) / 2 + 0.3, (z0 + z1) / 2, 2 * X + 1, 0.3, L + 0.6, 'techo', { x: q.x, y: q.y, z: q.z, w: q.w });
  }
  J.caja('vigas', 0, yCum - 0.12, zm, 2 * X, 0.2, 0.16);   // cumbrera
  for (const z of [-tg - 0.09, -D + tg + 0.09]) J.caja('vigas', 0, muroA - 0.08, z, 2 * X, 0.16, 0.18);   // soleras sobre los muros largos
  for (const f of [1 / 3, 2 / 3]) for (const z of [zm * (1 - f), zm - (D / 2) * f]) J.caja('vigas', 0, yAt(z) - 0.07, z, 2 * X, 0.1, 0.12);   // correas
  const xs = [0]; for (let k = 1; k * 2.3 < X - 0.5; k++) xs.push(k * 2.3, -k * 2.3);
  for (const x of xs) {   // cercha
    J.caja('vigas', x, muroA - 0.1, zm, 0.14, 0.2, D - 0.05);   // tirante
    viga('vigas', x, -tg * 0.5, muroA - 0.06, zm, yCum - 0.1, 0.13, 0.18); viga('vigas', x, zm, yCum - 0.1, -D + tg * 0.5, muroA - 0.06, 0.13, 0.18);   // pares
    J.caja('vigas', x, (muroA + yCum) / 2 - 0.1, zm, 0.13, hR - 0.1, 0.13);   // pendolón
    viga('vigas', x, zm - 0.06, muroA + 0.05, zm / 2, yAt(zm / 2) - 0.16, 0.1, 0.12); viga('vigas', x, zm + 0.06 - 0.12, muroA + 0.05, zm * 1.5, yAt(zm * 1.5) - 0.16, 0.1, 0.12);   // tornapuntas
  }
  for (const sx of [-1, 1]) {   // hastiales de pirca (cara interior) y su colisión
    const x = sx * (X - tg), a = [x, muroA - 0.01, 0], b = [x, yCum + 0.08, zm], c = [x, muroA - 0.01, -D];
    if (sx > 0) J.tri(E.muro, a, b, c); else J.tri(E.muro, a, c, b);
    col(sx * (X - tg / 2), (muroA + yCum) / 2 + 0.2, zm, tg, hR + 0.6, D);
  }
}
// puntos de la sala abierta (marco del interior): vecina junto a la cocina, recuerdo al fondo y textos del libro en la cocina y la zona de dormir
function puntosAbierta(X, D) {
  const L = D - 0.47, Wr = 2 * X - 0.54, Pt = (u, d, y = 0) => ({ x: -X + 0.27 + u, y, z: -D + 0.27 + d });
  return { npc: Pt(2.0, L * 0.5 + 0.5), recuerdo: Pt(2.3, 0.8), notas: [Pt(0.7, L * 0.5 + 1.75, 1.2), Pt(Wr - 2.6, 3.2, 1.2)] };
}

// N1-HAMILTON: puntos de la casa Hamilton (marco del interior): ama de llaves en el estar (lejos de la escalera: su burbuja no tapa la subida), recuerdo en el 2.º piso (premia subir),
// textos del libro al pie de la escalera, junto al escritorio y en la llegada de arriba
// N1-HAMILTON-c (casa agrandada): las coordenadas de la casa chica (X 6,58, D 7,57) se llevan a la grande: lo del poniente se reparte en proporción (sW),
// lo del oriente se corre con la escalera (dX) y las profundidades en proporción (kz). Con la casa chica, todo queda igual.
const mapaHam = (h, X, D) => { const sW = X / 6.576, dX = h.xW - 0.8, kz = D / 7.57; return { w: v => v * sW, e: v => v + dX, z: v => v * kz, kz }; };
function puntosHam(h, hp, X, D) {
  const m = mapaHam(h, X, D);
  return { npc: { x: m.w(-4.3), y: 0, z: -1.25 }, recuerdo: { x: m.w(-2.3), y: hp, z: m.z(-3.5) },
    notas: [{ x: h.xE + 0.55, y: 1.2, z: h.zA0 + 0.4 }, { x: m.e(4.2), y: 1.2, z: -D + 1.57 }, { x: h.xE + 0.6, y: hp + 1.2, z: h.zA0 + 0.6 }] };
}
// rutas de prueba (capturas/kit/hamilton/vistasH.js): recorrido del 1.er piso, subida, recorrido del 2.º y bajada, a pie
// N1-CAMAROTE1905: anciana junto a la mesa, recuerdo en el dormitorio de arriba, textos al pie de la escalera, junto a la cocina y en la llegada de arriba
function puntosCam(h, hp, X, D) {
  return { npc: { x: -X + 0.2 + 4.1, y: 0, z: -D + 1.6 }, recuerdo: { x: -X * 0.25, y: hp, z: -D / 2 }, notas: [{ x: h.xE + 0.55, y: 1.2, z: h.zA0 + 0.4 }, { x: -X + 3.4, y: 1.2, z: -D + 1.8 }, { x: h.xE + 0.6, y: hp + 1.2, z: h.zA0 + 0.6 }] };
}
function pruebaCam(h, hp, X, D) {
  const zA = (h.zA0 + h.zA1) / 2, zB = (h.zB0 + h.zB1) / 2, zD = (h.zA0 + h.zB1) / 2, xD = (h.xW + h.xL) / 2, xi0 = -X + 0.2, zm = -D / 2;
  return { esc: { vista: [h.xW - 3.0, -1.4], mira: [(h.xW + h.xE) / 2, zm], vista2: [h.xE + 0.6, -1.0], mira2: [h.xW - 2.5, zm] },
    ruta0: [[0, -1.6, 'hall'], [-3.0, -2.4, 'hacia_mesa'], [xi0 + 1.6, -2.5, 'cocina_frente'], [xi0 + 1.6, zm - 1.4, 'cocina'], [-3.6, zm - 1.4, 'catres'], [h.xW - 1.3, zm - 1.5, 'catres_or'], [h.xW - 1.3, -2.2, 'frente_or'], [h.xE + 0.6, -2.2, 'pie_escalera']],
    subir: [[h.xE + 0.6, zA, 'pie'], [h.xL + 0.3, zA, 'tramoA'], [xD, zD, 'descanso'], [h.xL + 0.35, zB, 'tramoB'], [h.xE + 0.5, zB, 'llegada']],
    ruta1: [[h.xE + 0.6, -D + 1.6, 'p1_fondo_or'], [h.xW + 1.6, -D + 1.6, 'p1_fondo_bodega'], [h.xW - 1.1, zm - 1.75, 'p1_rodea'], [h.xW - 1.2, zm - 0.3, 'p1_pasillo_or'], [-4.0, zm - 0.3, 'p1_pasillo'], [xi0 + 1.4, zm - 0.3, 'p1_poniente'], [-1.0, zm, 'p1_vuelta'], [h.xW - 0.9, -2.75, 'p1_frente'], [h.xE + 0.6, -2.6, 'p1_frente_or'], [h.xE + 0.6, zB, 'p1_llegada']],
    bajar: [[h.xE + 0.5, zB, 'arriba'], [h.xL + 0.35, zB, 'bajandoB'], [xD, zD, 'descanso_b'], [h.xL + 0.3, zA, 'bajandoA'], [h.xE + 0.8, zA, 'abajo']] };
}
function pruebaHam(h, hp, D, X) {
  const m = mapaHam(h, X, D), w = m.w, e = m.e, z = m.z, zA = (h.zA0 + h.zA1) / 2, zB = (h.zB0 + h.zB1) / 2, zD = (h.zA0 + h.zB1) / 2, xD = (h.xW + h.xL) / 2;
  return { esc: { vista: [-2.0, -0.8], mira: [(h.xW + h.xE) / 2, -D / 2], vista2: [e(5.6), -1.0], mira2: [e(0.6), -D / 2] },
    ruta0: [[0, -1.6, 'hall'], [w(-2.2), -2.0, 'hacia_estar'], [w(-2.0), z(-4.6), 'estar'], [e(0.6), -D + 1.87, 'cocina'], [e(3.9), -D + 2.17, 'escritorio'], [h.xE + 0.6, -D + 2.37, 'escritorio_or'], [h.xE + 0.6, -2.2, 'pie_escalera']],
    subir: [[h.xE + 0.6, zA, 'pie'], [h.xL + 0.3, zA, 'tramoA'], [xD, zD, 'descanso'], [h.xL + 0.35, zB, 'tramoB'], [h.xE + 0.5, zB, 'llegada']],
    ruta1: [[e(4.6), -1.8, 'p1_frente_or'], [w(-1.6), -1.6, 'p1_frente'], [w(-2.4), z(-4.2), 'p1_hogar'], [w(-4.2), z(-4.3), 'p1_dorm_a'], [w(-4.3), -D + 1.77, 'p1_dorm_b'], [w(-4.2), z(-4.6), 'p1_sale_dorm'], [w(-2.2), -D + 1.97, 'p1_fondo'], [e(2.0), -D + 1.97, 'p1_lavatorio'], [e(3.9), -D + 2.07, 'p1_tina'], [h.xE + 0.5, -D + 1.97, 'p1_tina_b'], [h.xE + 0.6, zB, 'p1_llegada']],
    bajar: [[h.xE + 0.5, zB, 'arriba'], [h.xL + 0.35, zB, 'bajandoB'], [xD, zD, 'descanso_b'], [h.xL + 0.3, zA, 'bajandoA'], [h.xE + 0.8, zA, 'abajo']] };
}

// ------------------------------------------------------------------ muebles (Junta en el marco del interior)
let QUEROSENO = false, RUSTICO = false, luzVentanas = null;   // N1-INT1905: RUSTICO = vivienda minera de 1905 (velas, candiles, faroles; nada eléctrico ni enlozado)
// N0-UTIL: colocador de la utilería del interior en armado, piso (índice y altura) de la pieza que se amuebla
let U = null, UF = 0, UY = 0;
let PB = null;   // UTIL-T0: caras libres de la pieza que se amuebla {x0, x1, z0, z1} (tabiques de 10 cm), null en Hamilton/planta abierta
// UTIL-T0: apoya la malla contra el muro con 2 cm de holgura: usa la caja REAL de su geometría (con giro y escala) y, si se sale de la pieza (≤ 25 cm), la corre lo justo; nunca la deja dentro del tabique
function ajusteMuro(id, x, z, k, esc) {
  const c = PB && !/[?&]npclibre=0/.test(location.search) && cajaPieza(id); if (!c) return null;   // ?npclibre=0 apaga también este ajuste (comparar con antes)
  const [sx, sy, sz] = esc || [1, 1, 1], co = Math.round(Math.cos(k * Math.PI / 2)), si = Math.round(Math.sin(k * Math.PI / 2)); let x0 = 9e9, x1 = -9e9, z0 = 9e9, z1 = -9e9;
  for (const X of [c.min[0] * sx, c.max[0] * sx]) for (const Z of [c.min[2] * sz, c.max[2] * sz]) { const rx = X * co + Z * si, rz = -X * si + Z * co; x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); z0 = Math.min(z0, rz); z1 = Math.max(z1, rz); }
  const g = 0.02; let dx = 0, dz = 0;
  if (x + x0 < PB.x0 + g) dx = PB.x0 + g - (x + x0); else if (x + x1 > PB.x1 - g) dx = PB.x1 - g - (x + x1);
  if (z + z0 < PB.z0 + g) dz = PB.z0 + g - (z + z0); else if (z + z1 > PB.z1 - g) dz = PB.z1 - g - (z + z1);
  return Math.abs(dx) <= 0.25 && Math.abs(dz) <= 0.25 ? [dx, dz] : null;
}
const put = (id, x, z, k = 0, dy = 0, esc) => { if (!U) return false; const aj = ajusteMuro(id, x, z, k, esc); if (aj) { x += aj[0]; z += aj[1]; } return U.poner(id, x, UY + dy, z, k * Math.PI / 2, UF, esc); };   // casa Hamilton (1905): sin luz eléctrica, lámparas de queroseno
function lampara(J, x, yTecho, z, ancho = 0.45) {
  if (RUSTICO) return farol(J, x, yTecho, z);
  if (QUEROSENO) {   // lámpara colgante de queroseno: cadena, depósito de latón, tubo de vidrio con la llama y pantalla de lata
    J.caja('fierro', x, yTecho - 0.2, z, 0.015, 0.4, 0.015);
    const d = new THREE.SphereGeometry(0.09, 10, 8); d.scale(1, 0.8, 1); d.translate(x, yTecho - 0.5, z); J.add('laton', d);
    const t = new THREE.CylinderGeometry(0.045, 0.06, 0.24, 10, 1, true); t.translate(x, yTecho - 0.68, z); J.add('vidrio', t);
    const f = new THREE.SphereGeometry(0.03, 6, 5); f.scale(1, 1.8, 1); f.translate(x, yTecho - 0.66, z); J.add('foco', f);
    const p = new THREE.ConeGeometry(0.17, 0.12, 12, 1, true); p.translate(x, yTecho - 0.8, z); J.add('pantalla', p);
    return;
  }
  // N0-UTIL: lámpara de techo de enlozado (pantalla de plato con borde, verde por fuera y blanca por dentro), florón y cordón trenzado
  J.add('enlozado', new THREE.CylinderGeometry(0.06, 0.07, 0.03, 12).translate(x, yTecho - 0.015, z));
  J.add('fierro', new THREE.CylinderGeometry(0.008, 0.008, 0.42, 5).translate(x, yTecho - 0.24, z));
  J.add('laton', new THREE.CylinderGeometry(0.035, 0.03, 0.08, 10).translate(x, yTecho - 0.48, z));
  const R = ancho / 2, perfil = [[0.03, 0], [0.05, -0.02], [R * 0.45, -0.07], [R * 0.8, -0.15], [R, -0.2], [R * 1.02, -0.215]].map(([a, b]) => new THREE.Vector2(a, b));
  const pe = new THREE.LatheGeometry(perfil, 20); pe.translate(x, yTecho - 0.5, z); J.add('pantalla', pe);
  const pi = new THREE.LatheGeometry(perfil.map(v => new THREE.Vector2(v.x * 0.97, v.y - 0.004)).reverse(), 20); pi.translate(x, yTecho - 0.5, z); J.add('enlozado', pi);
  const b = new THREE.SphereGeometry(0.06, 10, 8); b.scale(1, 1.25, 1); b.translate(x, yTecho - 0.62, z); J.add('foco', b);
}
// N1-INT1905: farol de parafina colgado de un gancho en la viga (asa de alambre, depósito de lata, globo de vidrio con la llama, sombrero de lata)
function farol(J, x, yG, z) {
  if (put('farol_parafina', x, z, 0, yG - UY)) return;   // C1: farol FINO (asa, sombrerete, globo con guardas, depósito); lo de abajo es el respaldo
  J.add('fierro', new THREE.TorusGeometry(0.03, 0.006, 4, 8, Math.PI).translate(x, yG - 0.02, z));
  J.caja('fierro', x, yG - 0.12, z, 0.008, 0.2, 0.008);
  J.add('lata', new THREE.ConeGeometry(0.075, 0.07, 10).translate(x, yG - 0.25, z));
  const gl = new THREE.SphereGeometry(0.065, 10, 8); gl.scale(1, 1.35, 1); gl.translate(x, yG - 0.37, z); J.add('vidrio', gl);
  J.add('llama', new THREE.SphereGeometry(0.018, 6, 5).scale(1, 2, 1).translate(x, yG - 0.37, z));
  J.add('lata', new THREE.CylinderGeometry(0.07, 0.075, 0.07, 10).translate(x, yG - 0.49, z));
  for (const a of [0, Math.PI / 2]) J.caja('fierro', x + Math.cos(a) * 0.072, yG - 0.37, z + Math.sin(a) * 0.072, 0.008, 0.2, 0.008);
}
// vela de sebo en su palmatoria de lata (o en el cuello de una botella) y candil de lata con mecha
function vela(J, x, y, z, botella = false) {
  if (botella) J.add('vigas', new THREE.CylinderGeometry(0.035, 0.04, 0.2, 8).translate(x, y + 0.1, z));
  else J.add('lata', new THREE.CylinderGeometry(0.06, 0.065, 0.015, 10).translate(x, y + 0.008, z));
  const yb = y + (botella ? 0.2 : 0.015);
  J.add('cera', new THREE.CylinderGeometry(0.014, 0.016, 0.12, 6).translate(x, yb + 0.06, z));
  J.add('llama', new THREE.SphereGeometry(0.013, 6, 5).scale(1, 2.2, 1).translate(x, yb + 0.145, z));
}
function candil(J, x, y, z) {
  if (put('candil', x, z, 0, y - UY)) return;   // C1: candil FINO de lata
  J.add('lata', new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10).translate(x, y + 0.04, z)); J.add('lata', new THREE.CylinderGeometry(0.008, 0.012, 0.07, 5).translate(x + 0.04, y + 0.1, z));
  J.add('llama', new THREE.SphereGeometry(0.016, 6, 5).scale(1, 2, 1).translate(x + 0.045, y + 0.15, z));
  J.add('fierro', new THREE.TorusGeometry(0.035, 0.005, 4, 8, Math.PI).rotateZ(Math.PI / 2).translate(x - 0.06, y + 0.07, z));
}
// hall de 1905: tabla de clavos con mantas y sombrero, barreta y combo apoyados, candil colgado
function halls1905(J, col, y, tipo) {
  const z = -0.23;
  J.caja('maderaVieja', 1.02, y + 1.6, z + 0.02, 0.6, 0.1, 0.03); for (let i = 0; i < 4; i++) J.caja('fierro', 0.8 + i * 0.15, y + 1.6, z - 0.04, 0.012, 0.012, 0.08);
  J.caja('manta', 0.8, y + 1.25, z - 0.06, 0.34, 0.7, 0.03); J.caja('manta2', 1.1, y + 1.3, z - 0.07, 0.3, 0.6, 0.03);
  J.add('saco', new THREE.CylinderGeometry(0.17, 0.2, 0.03, 12).translate(1.25, y + 1.48, z - 0.11)); J.add('saco', new THREE.CylinderGeometry(0.09, 0.1, 0.1, 10).translate(1.25, y + 1.54, z - 0.11));   // chupalla
  herramientas(J, 1.0, y, -0.6, 0, 2, [1.0, -0.4]);   // C1b: muro del hall en z ≈ −0,2 (+z)
  if (tipo === 'piedra1905') { tinaja(J, col, -1.05, y, -0.45); }
}
// herramientas del minero apoyadas en el muro (x, z: pie; giro k de 90° hacia donde se inclinan): barreta, combo y pala
// C1b (finos C): km = giro (cuartos de vuelta) que deja el MURO detrás de la pieza FINA herramientas_minero (−z local hacia el muro) y o = [x, z] de su
// pivote, a 0,2 m de la cara del muro; si la pieza entra, no se dibujan las barras de abajo (respaldo).
function herramientas(J, x, y, z, k, km, o) {
  if (km !== undefined && o && put('herramientas_minero', o[0], o[1], km, y - UY)) return;
  const ax = k % 2 ? 0 : 1, az = k % 2 ? 1 : 0;
  const barra = new THREE.CylinderGeometry(0.016, 0.016, 1.55, 6); barra.rotateZ(ax * 0.12); barra.rotateX(-az * 0.12); barra.translate(x, y + 0.77, z); J.add('fierro', barra);
  const mango = new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6); mango.rotateZ(-ax * 0.2); mango.rotateX(az * 0.2); mango.translate(x - ax * 0.25, y + 0.47, z - az * 0.25); J.add('maderaVieja', mango);
  J.caja('fierro', x - ax * 0.22, y + 0.06, z - az * 0.22, 0.2, 0.09, 0.09);   // cabeza del combo en el suelo
  const pala = new THREE.CylinderGeometry(0.018, 0.018, 1.1, 6); pala.rotateZ(ax * 0.18); pala.rotateX(-az * 0.18); pala.translate(x + ax * 0.3, y + 0.75, z + az * 0.3); J.add('maderaVieja', pala);
  J.caja('lata', x + ax * 0.35, y + 0.14, z + az * 0.35, 0.22, 0.28, 0.04);
}
function tinaja(J, col, x, y, z) {   // tinaja de greda con su tapa de tabla y jarro
  if (put('tinaja', x, z, 0, y - UY)) return col(x, y + 0.4, z, 0.55, 0.8, 0.55);   // N0-UTIL3 (G1): tinaja de greda de malla
  const g = new THREE.SphereGeometry(0.27, 12, 10); g.scale(1, 1.35, 1); g.translate(x, y + 0.36, z); J.add('greda', g);
  J.add('maderaVieja', new THREE.CylinderGeometry(0.15, 0.15, 0.03, 10).translate(x, y + 0.72, z)); J.add('lata', new THREE.CylinderGeometry(0.04, 0.035, 0.09, 8).translate(x + 0.05, y + 0.78, z));
  col(x, y + 0.36, z, 0.5, 0.72, 0.5);
}
// mueble en un marco local: origen (ox, oy, oz), giro de 90° k (frente local +z hacia la pieza)
function marco(J, ox, oy, oz, k) {
  const c = Math.round(Math.cos(k * Math.PI / 2)), s = Math.round(Math.sin(k * Math.PI / 2));
  const T = (x, z) => [ox + x * c + z * s, oz - x * s + z * c];
  return {
    caja(key, x, y, z, sx, sy, sz) { const [wx, wz] = T(x, z); J.caja(key, wx, oy + y, wz, c ? sx : sz, sy, c ? sz : sx); },
    cil(key, x, y, z, rr, h, seg = 10) { const [wx, wz] = T(x, z), g = new THREE.CylinderGeometry(rr, rr, h, seg); g.translate(wx, oy + y, wz); J.add(key, g); },
    cuadro(key, x, y, z, w, h) {   // plano vertical mirando hacia +z local
      const [wx, wz] = T(x, z), g = new THREE.PlaneGeometry(w, h); g.rotateY(Math.atan2(s, c)); g.translate(wx, oy + y, wz); J.add(key, g);
    },
    mundo: T,
  };
}
const k2 = k => k % 2 === 1;
function lamparaMesa(m, x, y, z = 0) {   // lámpara de queroseno de mesa: base de latón, tubo de vidrio y llama
  const [qx, qz] = m.mundo(x, z); if (put('quinque', qx, qz, 0, y)) return;   // N0-UTIL: quinqué de malla + llama
  m.cil('laton', x, y + 0.07, z, 0.07, 0.12, 10); m.cil('vidrio', x, y + 0.25, z, 0.045, 0.22, 8); m.cil('foco', x, y + 0.24, z, 0.015, 0.09, 6);
}
// N0-ADORNOS-VANOS (15-11, Diego: «los letreros están pegados en las ventanas»): todo adorno de pared (planos, carteles, retratos, calendarios, láminas, repisas) se COLOCA al final de
// cada pieza, cuando ya se conocen ventanas, puerta de calle y muebles altos: en un tramo de muro libre (margen de 20 cm a los vanos); si en ese muro no cabe prueba los otros muros de la
// pieza y, si no cabe en ninguno, no se pone. ?adornos=0 = colocación de antes (se sigue registrando en sala.adornos para medir antes/después).
let ADQ = null, ADLOG = [];
const ADORNOS = !(globalThis.location && /[?&]adornos=0/.test(location.search));
function amoblar(J, col, p, pl, E, r, hp, X) {
  if (!ADORNOS) { ADQ = { legacy: true }; try { return amoblar0(J, col, p, pl, E, r, hp, X); } finally { ADQ = null; } }
  const cajas = [], col2 = (x, y, z, sx, sy, sz, ...a) => { cajas.push([x, y, z, sx, sy, sz]); return col(x, y, z, sx, sy, sz, ...a); };
  const q = ADQ = { lista: [], cajas, flush: null };
  try { amoblar0(J, col2, p, pl, E, r, hp, X); if (q.flush) q.flush(); } finally { ADQ = null; }
}
function amoblar0(J, col, p, pl, E, r, hp, X) {
  const y = p.f * hp, s = p.lado === 'F' ? 1 : -1, x0 = p.x0 + (p.x0 <= -X + 0.01 ? 0.27 : 0.1), x1 = p.x1 - (p.x1 >= X - 0.01 ? 0.27 : 0.1), Wr = x1 - x0, zc = p.zc + s * 0.07, zo = p.zo, Dr = Math.abs(zo - zc);
  if (Wr < 1.6 || Dr < 1.6) return;
  UF = p.f; UY = y;   // N0-UTIL
  { const cf = p.zc + s * 0.05; PB = p.ham || p.rol === 'abierta' ? null : { x0: p.x0 <= -X + 0.01 ? p.x0 + 0.2 : p.x0 + 0.05, x1: p.x1 >= X - 0.01 ? p.x1 - 0.2 : p.x1 - 0.05, z0: Math.min(cf, p.zo), z1: Math.max(cf, p.zo) }; }   // UTIL-T0: caras libres (tabique 10 cm, pasillo, muros de fachada)
  const xm = (x0 + x1) / 2, P = (u, d) => [x0 + u, zc + s * d];   // u: a lo largo desde x0; d: profundidad desde el pasillo
  const kHacia = s > 0 ? 2 : 0;   // giro que mira hacia el pasillo (frente local +z → -s)
  const C = (u, d, sx, sy, sz, tipo = 'mueble') => { const [x, z] = P(u, d); col(x, y + sy / 2, z, sx, sy, sz, tipo); };
  if (!RUSTICO && !p.ham) { if (p.abiertoA && Wr > 5.2) for (const t of [0.27, 0.73]) lampara(J, x0 + Wr * t, y + hp - 0.05, zc + s * Dr * 0.58); else lampara(J, xm, y + hp - 0.05, zc + s * Dr / 2); }   // N0-INT-AMPLIO: 2 lámparas en las piezas de estar anchas   // N1-INT1905: en 1905 la luz la dan velas y candiles (los pone cada pieza)
  if (E.zocalo) J.caja(E.zocalo, xm, y + 0.08, zo - s * 0.012, Wr, 0.16, 0.025);
  const muroLado = (lado) => lado < 0 ? x0 : x1;   // tabique izquierdo/derecho
  const fxL = x0 - 0.04, fxR = x1 + 0.04;   // caras de los tabiques de la pieza
  // --- N0-ADORNOS-VANOS: muros de la pieza (plano, eje a lo largo, sentido hacia adentro, tramo útil) y cola de adornos
  const zA = zc + s * 0.45, zB = zc + s * (Dr - 0.2), PAR = { fondo: { eje: 'x', plano: zc + s * (Dr - 0.01), dir: -s, lo: x0 + 0.15, hi: x1 - 0.15 },
    izq: { eje: 'z', plano: fxL, dir: 1, lo: Math.min(zA, zB), hi: Math.max(zA, zB) }, der: { eje: 'z', plano: fxR, dir: -1, lo: Math.min(zA, zB), hi: Math.max(zA, zB) } };
  const mw = (pared, c) => pared === 'fondo' ? marco(J, c, y, PAR.fondo.plano, kHacia) : marco(J, pared === 'der' ? fxR : fxL, y, c, pared === 'der' ? 3 : 1);   // marco en el muro: +z local mira hacia la pieza
  const adorno = (nom, w, y0, y1, dib, pref, sole) => {   // pref = [pared, c]: c = x (fondo) o z (laterales) del centro; sole = muro propio (coordenadas del interior), sin probar otros muros
    const W0 = sole || PAR[pref[0]];
    if (!ADQ || ADQ.legacy) { ADLOG.push({ nom, f: p.f, pk: p.f + '|' + p.lado + '|' + p.x0.toFixed(2), eje: W0.eje, plano: W0.plano, dir: W0.dir, c: pref[1], w, y0: y + y0, y1: y + y1, ok: true }); return dib(pref[0], pref[1]); }
    ADQ.lista.push({ nom, w, y0, y1, dib, pref, sole }); };
  if (ADQ && !ADQ.legacy) ADQ.flush = () => {
    const vs = pl.vanos.filter(v => Math.floor((v.y + 0.01) / hp) === p.f), puesto = new Map(), blq = new Map();
    const bloqueos = (W) => { if (blq.has(W)) return blq.get(W); const L = [];
      for (const v of vs) { const yy0 = v.y - v.h / 2 - 0.12 - y, yy1 = v.y + v.h / 2 + 0.12 - y;
        if (W.eje === 'x' && Math.abs(v.z - W.plano) < 0.5 && Math.abs(v.x) < X - 0.3) L.push([v.x - v.w / 2 - 0.2, v.x + v.w / 2 + 0.2, yy0, yy1]);
        else if (W.eje === 'z' && Math.abs(v.x - W.plano) < 0.5 && Math.abs(Math.abs(v.x) - pl.Lw / 2) < 0.3 ) L.push([v.z - v.w / 2 - 0.2, v.z + v.w / 2 + 0.2, yy0, yy1]); }
      if (p.f === 0 && W.eje === 'x' && Math.abs(W.plano) < 0.5) L.push([-0.85, 0.85, -0.1, 2.6]);   // puerta de calle
      for (const [cx, cy, cz, sx, sy, sz] of ADQ.cajas) { const a0 = W.eje === 'x' ? cx - sx / 2 : cz - sz / 2, a1 = W.eje === 'x' ? cx + sx / 2 : cz + sz / 2, pp = W.eje === 'x' ? [cz - sz / 2, cz + sz / 2] : [cx - sx / 2, cx + sx / 2];
        const i0 = Math.min((pp[0] - W.plano) * W.dir, (pp[1] - W.plano) * W.dir), i1 = Math.max((pp[0] - W.plano) * W.dir, (pp[1] - W.plano) * W.dir);
        if (i1 > 0.06 && i0 < 0.32 && sy > 0.2) L.push([a0 - 0.05, a1 + 0.05, cy - sy / 2 - y, cy + sy / 2 - y, 1]); }
      blq.set(W, L); return L; };
    const cabe = (W, e, c) => { const a0 = c - e.w / 2, a1 = c + e.w / 2; if (a0 < W.lo || a1 > W.hi) return false;
      for (const b of bloqueos(W)) { const tol = b[4] ? 0.08 : 0; if (a1 > b[0] && a0 < b[1] && e.y1 > b[2] + tol && e.y0 < b[3] - tol) return false; }
      for (const b of puesto.get(W) || []) if (a1 + 0.1 > b[0] && a0 - 0.1 < b[1] && e.y1 + 0.05 > b[2] && e.y0 - 0.05 < b[3]) return false; return true; };
    const buscar = (W, e, c0) => { for (let d = 0; d <= 14; d += 0.05) for (const sg of d ? [1, -1] : [1]) { const c = c0 + sg * d; if (cabe(W, e, c)) return c; } return null; };
    let omitidos = 0;
    for (const e of ADQ.lista) {
      let pared = e.pref[0], W = e.sole || PAR[pared], c = buscar(W, e, e.pref[1]);
      if (c === null && !e.sole) for (const o of ['izq', 'der', 'fondo']) { if (o === e.pref[0]) continue; W = PAR[o]; c = buscar(W, e, (W.lo + W.hi) / 2); if (c !== null) { pared = o; break; } }
      if (c === null) { omitidos++; ADLOG.push({ nom: e.nom, f: p.f, omitido: true }); continue; }
      (puesto.get(W) || puesto.set(W, []).get(W)).push([c - e.w / 2, c + e.w / 2, e.y0, e.y1]);
      ADLOG.push({ nom: e.nom, f: p.f, pk: p.f + '|' + p.lado + '|' + p.x0.toFixed(2), eje: W.eje, plano: W.plano, c, w: e.w, y0: y + e.y0, y1: y + e.y1, ok: true, mov: Math.abs(c - e.pref[1]) > 0.02 || pared !== e.pref[0], dir: W.dir });
      e.dib(pared, c); }
  };
  const fotos = (n, u0, d, kk = 1) => { if (RUSTICO) return; for (let i = 0; i < n && d + i * 0.45 * kk < Dr - 0.3; i++) {   // retratos en el tabique izquierdo
    const k = 'foto' + ((r() * 4) | 0), yf = 1.75 + (i % 2) * 0.12, laton = kk > 1;
    adorno('foto', 0.34 * kk, yf - 0.21 * kk, yf + 0.21 * kk, (pa, c) => { const f2 = mw(pa, c); f2.caja(laton ? 'laton' : 'maderaOsc', 0, yf, 0.005, 0.34 * kk, 0.42 * kk, 0.02); f2.cuadro(k, 0, yf, 0.02, 0.28 * kk, 0.36 * kk); }, ['izq', zc + s * (d + i * 0.45 * kk)]); } void u0; };
  const cama = (u, d, k, colcha, litera = false, colFierro = 'fierroVerde') => {   // cama de fierro (o litera) a lo largo de la profundidad
    const [x, z] = P(u, d), m = marco(J, x, y, z, k), L = 1.95, A = 0.9;
    if (RUSTICO) { if (colFierro === 'fierroVerde') colFierro = 'fierro'; colcha = r() < 0.5 ? 'frazada' : 'manta'; }   // N1-INT1905: catre de fierro negro (o de palo) con jergón de saco, frazada y piel
    if (put(RUSTICO ? 'catre' : litera ? 'litera' : 'cama', x, z, k)) { col(x, y + (litera ? 0.75 : 0.35), z, k % 2 ? L : A, litera ? 1.5 : 0.7, k % 2 ? A : L, 'mueble'); return; }   // N0-UTIL
    for (const a of [-1, 1]) for (const b of [-1, 1]) m.caja(colFierro, a * (A / 2), (litera ? 1.75 : 0.95) / 2, b * (L / 2), 0.05, litera ? 1.75 : (b < 0 ? 0.95 : 0.7), 0.05);
    for (const yy of litera ? [0.38, 1.3] : [0.42]) { m.caja(colFierro, 0, yy, 0, A, 0.05, L); m.caja(RUSTICO ? 'saco' : 'tela', 0, yy + 0.1, 0, A - 0.06, 0.15, L - 0.06); m.caja(colcha, 0, yy + 0.19, 0.25, A - 0.02, 0.04, L * 0.68); m.caja(RUSTICO ? 'saco' : 'tela', 0, yy + 0.22, -L / 2 + 0.25, A * 0.6, 0.1, 0.32);
      if (RUSTICO) m.caja('piel', 0.08, yy + 0.225, 0.45, A * 0.8, 0.03, 0.7); }
    m.caja(colFierro, 0, litera ? 1.6 : 0.85, -L / 2, A, 0.05, 0.05);
    const [cx, cz] = m.mundo(0, 0); col(cx, y + (litera ? 0.75 : 0.35), cz, k % 2 ? L : A, litera ? 1.5 : 0.7, k % 2 ? A : L, 'mueble');
  };
  const baul = (u, d, k) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (put('baul', x, z, k)) return C(u, d, 0.85, 0.5, 0.5); m.caja('madera', 0, 0.25, 0, 0.85, 0.5, 0.48); m.caja('fierro', -0.3, 0.25, 0, 0.04, 0.52, 0.5); m.caja('fierro', 0.3, 0.25, 0, 0.04, 0.52, 0.5); m.caja('laton', 0, 0.38, 0.25, 0.08, 0.08, 0.02); C(u, d, 0.85, 0.5, 0.5); };
  const mesa = (u, d, a, b, mantel = false) => { if (RUSTICO) mantel = false; const [x, z] = P(u, d), m = marco(J, x, y, z, 0); if (RUSTICO) { if (!put('mesa_rustica', x, z, 0, 0, [a / 1.2, 1, b / 0.8])) { m.caja('maderaVieja', 0, 0.76, 0, a, 0.06, b); for (const i of [-1, 1]) for (const j of [-1, 1]) m.caja('maderaVieja', i * (a / 2 - 0.07), 0.37, j * (b / 2 - 0.07), 0.08, 0.74, 0.08); } return C(u, d, a, 0.8, b); }   // C1: mesa de tablas FINA
    if (mantel && put('mesa', x, z, 0, 0, [a / 1.0, 1, b / 0.8])) return C(u, d, a, 0.8, b); m.caja(mantel ? 'mantel' : 'madera', 0, 0.76, 0, a, 0.05, b);
    for (const i of [-1, 1]) for (const j of [-1, 1]) m.caja('madera', i * (a / 2 - 0.06), 0.37, j * (b / 2 - 0.06), 0.06, 0.74, 0.06); C(u, d, a, 0.8, b); };
  const silla = (u, d, k) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (put('silla', x, z, k)) return; m.caja('madera', 0, 0.45, 0, 0.42, 0.04, 0.42); m.caja('madera', 0, 0.75, -0.19, 0.42, 0.55, 0.04);
    for (const i of [-1, 1]) for (const j of [-1, 1]) m.caja('madera', i * 0.18, 0.22, j * 0.18, 0.04, 0.45, 0.04); };
  const ropero = (u, d, k) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (put('ropero', x, z, k)) return col(x, y + 1, z, k % 2 ? 0.55 : 1.0, 2, k % 2 ? 1.0 : 0.55); m.caja('madera', 0, 1.0, 0, 1.0, 2.0, 0.55); m.caja('maderaOsc', 0, 1.0, 0.28, 0.02, 1.8, 0.01); m.caja('maderaOsc', -0.25, 1.0, 0.28, 0.42, 1.75, 0.01);
    m.caja('maderaOsc', 0.25, 1.0, 0.28, 0.42, 1.75, 0.01); m.caja('laton', -0.05, 1.05, 0.3, 0.03, 0.08, 0.03); m.caja('laton', 0.05, 1.05, 0.3, 0.03, 0.08, 0.03); const [cx, cz] = m.mundo(0, 0); col(cx, y + 1, cz, k % 2 ? 0.55 : 1.0, 2, k % 2 ? 1.0 : 0.55); };
  const velador = (u, d) => { const [x, z] = P(u, d), m = marco(J, x, y, z, 0); if (RUSTICO) { if (!put('velador_rustico', x, z, kHacia, 0, [1, 0.5 / 0.6, 0.92])) m.caja('maderaVieja', 0, 0.25, 0, 0.4, 0.5, 0.32); vela(J, x, y + 0.5, z, r() < 0.4); return; }   /* N0-UTIL3 (G7): velador de tablas de malla */ if (!put('velador', x, z, kHacia)) m.caja('madera', 0, 0.3, 0, 0.42, 0.6, 0.38); if (QUEROSENO) lamparaMesa(m, 0, 0.6); else { m.cil('loza', 0, 0.68, 0, 0.07, 0.16); m.caja('crema', 0, 0.82, 0, 0.22, 0.14, 0.22); } };
  const estufa = (u, d) => { const [x, z] = P(u, d), m = marco(J, x, y, z, 0); if (!put('estufa', x, z, kHacia)) { m.cil('fierro', 0, 0.45, 0, 0.28, 0.8, 12); m.cil('fierro', 0, 0.9, 0, 0.32, 0.06, 12); } m.cil('fierro', 0, (hp + 0.9) / 2, 0, 0.07, hp - 0.9, 8); if (RUSTICO) { const [bx, bz] = P(u, d - 0.285); J.caja('brasa', bx, y + 0.3, bz, 0.14, 0.09, 0.03); } C(u, d, 0.6, 1, 0.6); };
  const cocinaLena = (u, d, k) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k);
    if (RUSTICO) {   // N1-INT1905: cocina de fierro a leña negra (sin enlozado ni latón), fuego visible, olla de fierro, ollas de fierro y cobre colgadas de una varilla
      if (put('cocina_rustica', x, z, k)) m.cil('fierro', -0.35, (hp + 0.74) / 2, -0.2, 0.06, hp - 0.74, 8);   // N0-UTIL3 (G1): cocina negra de malla; el cañón sigue procedural
      else { m.caja('fierro', 0, 0.4, 0, 1.0, 0.8, 0.62); m.caja('fierro', 0, 0.82, 0, 1.08, 0.05, 0.68); m.caja('brasa', -0.22, 0.32, 0.33, 0.3, 0.16, 0.01); m.caja('vigas', -0.22, 0.32, 0.317, 0.36, 0.22, 0.005);   // N1-HAMILTON-b: la brasa quedaba dentro del marco
      m.cil('fierro', 0.25, 0.94, 0, 0.13, 0.2, 10); m.cil('lata', -0.2, 0.9, 0.05, 0.08, 0.12, 8); m.cil('fierro', -0.35, (hp + 0.86) / 2, -0.2, 0.08, hp - 0.86, 8); }
      { const [ox, oz] = m.mundo(0.27, -0.17);   // G9M: ollas_colgadas (malla G10, ×0,75: 0,98 m) de la varilla contra el muro, a la derecha del cañón
        if (!put('ollas_colgadas', ox, oz, k, 1.45, [0.75, 0.75, 0.75])) { m.caja('fierro', 0, 1.75, -0.27, 1.3, 0.025, 0.025); for (let i = 0; i < 4; i++) { const xo = -0.5 + i * 0.33; m.caja('fierro', xo, 1.68, -0.27, 0.01, 0.12, 0.01); m.cil(i % 2 ? 'cobre' : 'fierro', xo, 1.52, -0.25, 0.1 - (i % 3) * 0.015, 0.18, 10); } } }
      const [cx, cz] = m.mundo(0, 0); col(cx, y + 0.45, cz, k % 2 ? 0.7 : 1.1, 0.9, k % 2 ? 1.1 : 0.7); return; }
    if (!put('cocina', x, z, k)) { m.caja('fierro', 0, 0.4, 0, 1.1, 0.8, 0.65); m.caja('fierro', 0, 0.83, 0, 1.2, 0.06, 0.72); m.caja('laton', 0, 0.83, 0.37, 1.2, 0.04, 0.03);
    m.caja('metalGris', -0.25, 0.45, 0.33, 0.4, 0.3, 0.02); m.cil('enlozado', 0.25, 0.95, 0, 0.12, 0.18); m.cil('fierro', 0.25, 1.06, 0, 0.03, 0.06); } m.cil('fierro', -0.35, (hp + 0.86) / 2, -0.2, 0.07, hp - 0.86, 8);
    m.caja('madera', 0, 1.65, -0.25, 1.2, 0.04, 0.22); for (let i = 0; i < 4; i++) { const [ox, oz] = m.mundo(-0.45 + i * 0.3, -0.25); if (!put(['olla', 'jarro', 'tetera', 'olla'][i], ox, oz, k, 1.67)) m.cil(i % 2 ? 'celeste' : 'enlozado', -0.45 + i * 0.3, 1.78, -0.25, 0.09, 0.2); }   // repisa de ollas de enlozado
    const [cx, cz] = m.mundo(0, 0); col(cx, y + 0.45, cz, k % 2 ? 0.72 : 1.2, 0.9, k % 2 ? 1.2 : 0.72); };
  const aparador = (u, d, k) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (put('aparador', x, z, k)) { const [bx, bz] = m.mundo(-0.3, 0), [jx, jz] = m.mundo(0.35, 0); put('balanza', bx, bz, k, 0.95) || put('jarro', bx, bz, k, 0.95); put('jarro', jx, jz, k, 0.95); return col(x, y + 0.45, z, k % 2 ? 0.45 : 1.2, 0.9, k % 2 ? 1.2 : 0.45); } m.caja('crema', 0, 0.45, 0, 1.2, 0.9, 0.45); m.caja('maderaOsc', 0, 0.45, 0.23, 0.02, 0.75, 0.01);
    for (let i = 0; i < 5; i++) m.cil(i % 2 ? 'rojo' : 'loza', -0.45 + i * 0.22, 1.02, 0, 0.06, 0.15); const [cx, cz] = m.mundo(0, 0); col(cx, y + 0.45, cz, k % 2 ? 0.45 : 1.2, 0.9, k % 2 ? 1.2 : 0.45); };
  const lavamanos = (u, d, k, doble = false) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k);
    if (RUSTICO) { if (put('lavamanos_rustico', x, z, k)) return C(u, d, 0.7, 0.66, 0.42);   // C1: banco de lavarse FINO (palangana, jarro y toalla)
      m.caja('maderaVieja', 0, 0.35, 0, 0.7, 0.05, 0.4); for (const i of [-1, 1]) m.caja('maderaVieja', i * 0.3, 0.17, 0, 0.05, 0.34, 0.36); m.cil('lata', 0, 0.42, 0, 0.19, 0.09, 12); m.cil('lata', 0.27, 0.5, 0.1, 0.05, 0.2, 8); return C(u, d, 0.7, 0.5, 0.42); }   // N1-INT1905: palangana de lata en un banco
    { const [lx, lz] = m.mundo(0, -0.05);   // UTIL-T0: lavatorio de malla (loza, jarro y toalla; 0,75×1,0×0,45 m) 5 cm hacia el muro (-z local); el espejo y las llaves de pared siguen procedurales
      if (put('lavatorio', lx, lz, k, 0, [doble ? 1.15 : 0.85, 1, 1])) { m.caja('vidrio', 0, 1.55, -0.2, 0.5, 0.6, 0.02); m.caja('blanco', 0, 1.55, -0.21, 0.56, 0.66, 0.01); return C(u, d, doble ? 0.95 : 0.75, 1.0, 0.5); } }
    m.caja('loza', 0, 0.45, 0, 0.18, 0.9, 0.18); m.caja('loza', 0, 0.85, 0.05, doble ? 0.9 : 0.6, 0.18, 0.45);
    m.caja('metalGris', -0.1, 1.02, -0.12, 0.04, 0.12, 0.04); m.caja('metalGris', 0.1, 1.02, -0.12, 0.04, 0.12, 0.04); m.caja('vidrio', 0, 1.55, -0.2, 0.5, 0.6, 0.02); m.caja('blanco', 0, 1.55, -0.21, 0.56, 0.66, 0.01); C(u, d, 0.6, 1.0, 0.5); };
  const sofa = (u, d, k, tela) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (put('sofa', x, z, k)) return col(x, y + 0.45, z, k % 2 ? 0.8 : 1.8, 0.9, k % 2 ? 1.8 : 0.8); m.caja(tela, 0, 0.25, 0, 1.8, 0.4, 0.8); m.caja(tela, 0, 0.65, -0.32, 1.8, 0.5, 0.18); m.caja(tela, -0.85, 0.5, 0, 0.16, 0.3, 0.8); m.caja(tela, 0.85, 0.5, 0, 0.16, 0.3, 0.8);
    const [cx, cz] = m.mundo(0, 0); col(cx, y + 0.45, cz, k % 2 ? 0.8 : 1.8, 0.9, k % 2 ? 1.8 : 0.8); };
  const escritorio = (u, d, k) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (put('escritorio', x, z, k)) { m.caja('papel', 0.2, 0.79, 0.05, 0.42, 0.01, 0.3); const [mx, mz] = m.mundo(-0.25, -0.1); if (!put('maquina', mx, mz, k, 0.78)) m.caja('fierro', -0.25, 0.86, -0.1, 0.4, 0.16, 0.3); col(x, y + 0.4, z, k % 2 ? 0.75 : 1.4, 0.8, k % 2 ? 1.4 : 0.75); return silla(u, d + 0.62, k); } m.caja('madera', 0, 0.76, 0, 1.4, 0.05, 0.75); m.caja('madera', -0.5, 0.37, 0, 0.4, 0.74, 0.7); m.caja('madera', 0.66, 0.37, 0, 0.05, 0.74, 0.7);
    for (let i = 0; i < 3; i++) m.caja('maderaOsc', -0.5, 0.15 + i * 0.22, 0.36, 0.34, 0.16, 0.01); m.caja('papel', 0.2, 0.79, 0.05, 0.42, 0.01, 0.3); m.caja('fierro', -0.25, 0.86, -0.1, 0.4, 0.16, 0.3);   // papeles y máquina de escribir
    const [cx, cz] = m.mundo(0, 0); col(cx, y + 0.4, cz, k % 2 ? 0.75 : 1.4, 0.8, k % 2 ? 1.4 : 0.75); silla(u, d + 0.62, k); };
  const archivador = (u, d, k) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (put('archivador', x, z, k)) return C(u, d, 0.6, 1.4, 0.7); m.caja('metalGris', 0, 0.68, 0, 0.5, 1.36, 0.62); for (let i = 0; i < 4; i++) { m.caja('fierro', 0, 0.2 + i * 0.32, 0.315, 0.42, 0.26, 0.01); m.caja('laton', 0, 0.28 + i * 0.32, 0.33, 0.1, 0.03, 0.02); } C(u, d, 0.6, 1.4, 0.7); };
  const tablero = (u, d, k) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (put('tablero_dibujo', x, z, k)) return C(u, d, 1.2, 1.1, 0.9);   // N0-UTIL3 (G1)
    for (const i of [-1, 1]) m.caja('madera', i * 0.5, 0.45, 0, 0.05, 0.9, 0.6);
    const g = new THREE.BoxGeometry(1.2, 0.03, 0.85); g.rotateX(-0.45); const [wx, wz] = m.mundo(0, 0); g.rotateY((k % 4) * Math.PI / 2); g.translate(wx, y + 1.05, wz); J.add('plano', g); C(u, d, 1.2, 1.1, 0.9); };
  const cartelPared = (texto, u, d0) => { if (RUSTICO) return; void d0; adorno('cartel', 0.6, 1.45, 2.05, (pa, c) => mw(pa, c).cuadro('cartel:' + texto, 0, 1.75, 0.02, 0.6, 0.6), ['fondo', x0 + u]); };
  const L = Dr, uc = Wr / 2, rol = p.rol === 'estarC' && Wr < 4.6 ? 'unica' : p.rol === 'livingA' && Wr < 6.0 ? 'livingcom' : p.rol === 'salaOf' && Wr < 3.2 ? 'oficina' : p.rol;   // N0-INT-AMPLIO: piezas de estar angostas → el rol de antes
  const kAdentro = s > 0 ? 0 : 2;   // giro que mira hacia el fondo de la pieza
  // detalles de época y de vida real (N0-INT2): todo fuera de la zona de la puerta (centro, d < 1,6) para no estorbar el paso
  const cuadroFondo = (key, u, yy, w, h) => { if (RUSTICO) return; adorno('cuadro', w, yy - h / 2, yy + h / 2, (pa, c) => mw(pa, c).cuadro(key, 0, yy, 0.02, w, h), ['fondo', x0 + u]); };
  const cuadroLado = (der, key, d, yy, w, h) => { if (RUSTICO) return null; adorno('cuadro', w, yy - h / 2, yy + h / 2, (pa, c) => mw(pa, c).cuadro(key, 0, yy, pa === 'fondo' ? 0.02 : 0.012, w, h), [der ? 'der' : 'izq', zc + s * d]); };
  const retrato = (der, d, yy = 1.6, kk = 1) => { if (RUSTICO) return; const fk = 'foto' + ((r() * 4) | 0); adorno('retrato', 0.32 * kk, yy - 0.2 * kk, yy + 0.2 * kk, (pa, c) => { const m = mw(pa, c), o = pa === 'fondo' ? 0.01 : 0; m.caja('maderaOsc', 0, yy, 0.012 + o, 0.32 * kk, 0.4 * kk, 0.02); m.cuadro(fk, 0, yy, 0.025 + o, 0.26 * kk, 0.34 * kk); }, [der ? 'der' : 'izq', zc + s * d]); };
  const calendario = (der, d) => RUSTICO ? null : texUtil('calendario') ? cuadroLado(der, 'calendario', d, 1.45, 0.3, 0.4) : cuadroLado(der, 'cartel:CALENDARIO|' + pl.epoca, d, 1.5, 0.3, 0.3);
  const cordel = (d) => { const [, z] = P(0, d), ok = put(RUSTICO ? 'ropa_tendida_r' : 'ropa_tendida', (x0 + x1) / 2, z, 0, y - UY, Wr < 1.8 ? [(Wr - 0.2) / 1.6, 1, 1] : undefined);   // C6 (G15): ropa FINA con perros; el cordel cuelga en catenaria
    if (ok) { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(x0 + 0.05 + (Wr - 0.1) * t, y + 2.08 + 0.02 - 0.05 * 4 * t * (1 - t), z)); } J.add('fierro', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.004, 4)); }
    else J.caja('fierro', (x0 + x1) / 2, y + 2.08, z, Wr - 0.1, 0.015, 0.015);
    const pr = RUSTICO ? ['tela', 'manta', 'saco', 'manta2', 'tela', 'frazada'] : ['tela', 'colchaAzul', 'crema', 'rojo', 'tela', 'colchaGris'], q = (r() * 6) | 0; for (let i = 0; i < 4; i++) { const sx = 0.26 + r() * 0.1, sy = 0.5 + r() * 0.14; if (!ok) J.caja(pr[(i + q) % 6], x0 + 0.55 + i * (Wr - 1.1) / 3, y + 1.8, z, sx, sy, 0.025); } };   // (los r() se consumen igual: no cambia el resto de la pieza)
  const radio = (m, yy, k = 0) => { const [rx, rz] = m.mundo(0, 0); if (put('radio', rx, rz, k, yy)) return; m.caja('madera', 0, yy + 0.15, 0, 0.44, 0.3, 0.22); m.caja('crema', 0, yy + 0.17, 0.115, 0.28, 0.17, 0.01); m.cil('laton', 0.15, yy + 0.16, 0.12, 0.025, 0.02, 8); };
  const zapatos = (u, d) => { const [x, z] = P(u, d); if (put('botas', x, z, kHacia, 0, [0.9, 0.9, 0.9])) return;   // N0-UTIL3 (G7): par de botas de malla
    J.caja('fierro', x - 0.07, y + 0.04, z, 0.09, 0.08, 0.24); J.caja('fierro', x + 0.07, y + 0.04, z + 0.03, 0.09, 0.08, 0.24); };
  const balde = (u, d) => { const [x, z] = P(u, d); if (RUSTICO && put('balde', x, z, 0)) return col(x, y + 0.15, z, 0.32, 0.3, 0.32);   // N0-UTIL3 (G1): balde de duelas
    if (RUSTICO) { J.add('maderaVieja', new THREE.CylinderGeometry(0.17, 0.14, 0.3, 10).translate(x, y + 0.15, z)); for (const h of [0.06, 0.24]) J.add('fierro', new THREE.CylinderGeometry(0.168 - h * 0.1, 0.168 - h * 0.1, 0.02, 10, 1, true).translate(x, y + h, z)); return col(x, y + 0.15, z, 0.32, 0.3, 0.32); } J.add('metalGris', new THREE.CylinderGeometry(0.16, 0.12, 0.28, 10).translate(x, y + 0.14, z)); col(x, y + 0.14, z, 0.3, 0.28, 0.3); };
  const escoba = (u, d) => { const [x, z] = P(u, d); if (put('escoba', x, z, kHacia, y - UY)) return; /* C6 (G19): escoba FINA de curahuilla */ J.add('madera', new THREE.CylinderGeometry(0.012, 0.012, 1.4, 5).translate(x, y + 0.7, z)); J.caja('frazada', x, y + 0.12, z, 0.14, 0.24, 0.05); };
  const tazas = (u, d, yy) => { const [x, z] = P(u, d);
    if (RUSTICO) { J.add('lata', new THREE.CylinderGeometry(0.04, 0.04, 0.09, 8).translate(x, y + yy + 0.045, z)); if (!put('mate', x + 0.17, z + 0.06, (r() * 4) | 0, yy)) { J.add('greda', new THREE.SphereGeometry(0.05, 8, 6).scale(1, 1.1, 1).translate(x + 0.17, y + yy + 0.05, z + 0.06)); J.caja('laton', x + 0.18, y + yy + 0.12, z + 0.06, 0.008, 0.1, 0.008); }   /* N0-UTIL3 (G7): mate de malla */ vela(J, x - 0.2, y + yy, z - 0.05, r() < 0.5); return; }   // jarro de lata, mate con bombilla y vela
    if (put('jarro', x, z, (r() * 4) | 0, yy)) return; J.add('enlozado', new THREE.CylinderGeometry(0.04, 0.035, 0.08, 8).translate(x, y + yy + 0.04, z)); J.add('celeste', new THREE.CylinderGeometry(0.04, 0.035, 0.08, 8).translate(x + 0.16, y + yy + 0.04, z + 0.08)); };
  const alfombraChica = (u, d, a, b) => { const [x, z] = P(u, d); if (RUSTICO) return J.caja('piel', x, y + 0.012, z, Math.min(a, 1.0), 0.02, Math.min(b, 0.7)); J.caja(pl.tipo === 'empleados' || pl.tipo === 'hamilton' ? 'alfombra' : 'alfombra2', x, y + 0.012, z, a, 0.02, b); };
  const estante = (der, d, yy = 1.55) => adorno('estante', 0.8, yy - 0.04, yy + 0.3, (pa, c) => { const m = mw(pa, c), kf = pa === 'der' ? 3 : pa === 'izq' ? 1 : kHacia; { const [rx, rz] = m.mundo(0, 0); if (!put('repisa_pared', rx, rz, kf, yy + 0.02)) m.caja('madera', 0, yy, 0.12, 0.8, 0.04, 0.24); }   /* C1: repisa FINA con ménsulas */ for (let i = 0; i < 3; i++) { const [ox, oz] = m.mundo(-0.25 + i * 0.25, 0.12); if (!put(['jarro', 'olla', 'tetera'][i], ox, oz, kf, yy + 0.02)) m.cil(RUSTICO ? ['greda', 'fierro', 'cobre'][i] : ['enlozado', 'celeste', 'rojo'][i], -0.25 + i * 0.25, yy + 0.12, 0.12, 0.07, 0.2, 10); } }, [der ? 'der' : 'izq', zc + s * d]);
  const ropaSilla = (u, d, k) => { silla(u, d, k); const [x, z] = P(u, d); J.caja(['colchaGris', 'tela', 'colchaAzul'][(r() * 3) | 0], x, y + 0.56, z, 0.3, 0.08, 0.34); };
  const sillaF = (u, d) => silla(u, d, kAdentro);
  // N1-INT1905: utilería de la vivienda minera de 1905
  const ropaClavos = (der, d) => adorno('ropa', 1.0, 1.0, 1.8, (pa, c) => { const m = mw(pa, c), kf = pa === 'der' ? 3 : pa === 'izq' ? 1 : kHacia, [rx, rz] = m.mundo(0, 0), ok = put(RUSTICO ? 'ropa_clavos_r' : 'ropa_clavos', rx, rz, kf, y - UY);   // C6 (G16): tabla y prendas FINAS
    if (!ok) { m.caja('maderaVieja', 0, 1.72, 0.02, 1.0, 0.08, 0.03); for (let i = 0; i < 4; i++) m.caja('fierro', -0.36 + i * 0.24, 1.72, 0.06, 0.012, 0.012, 0.07); }
    const pr = ['manta', 'manta2', 'tela', 'saco', 'frazada']; for (let i = 0; i < 3; i++) if (r() < 0.8) { const k2 = (r() * pr.length) | 0, yy = 1.38 - r() * 0.15, sx = 0.3 + r() * 0.1, sy = 0.62 + r() * 0.2; if (!ok) m.caja(pr[k2], -0.36 + i * 0.36, yy, 0.08, sx, sy, 0.03); } }, [der ? 'der' : 'izq', zc + s * d]);
  const herram = (der, d) => { const [x, z] = P(der ? Wr - 0.12 : 0.12, d); herramientas(J, x, y, z, 1, der ? 3 : 1, P(der ? Wr - 0.15 : 0.15, d)); };   // C1b: muro lateral (x0 o x1)
  const sacos = (u, d, n = 3) => { for (let i = 0; i < n; i++) { const [x, z] = P(u + (i % 2) * 0.5 - 0.25, d + (i > 1 ? -0.5 : 0)), yb = y + (i === 2 && n > 3 ? 0.62 : 0);
      if (put('saco', x, z, (i * 5 + n) % 4, yb - y, [0.92 + (i % 3) * 0.05, 0.85 + (i % 2) * 0.08, 0.95])) continue;   // UTIL-T0: saco de yute de malla (0,5×0,75×0,4 m; variaciones de tamaño y giro); respaldo: cilindro
      const g = new THREE.CylinderGeometry(0.2, 0.25, 0.6, 9); g.scale(1, 1, 0.75); g.translate(x, yb + 0.3, z); J.add('saco', g);
      J.add('saco', new THREE.SphereGeometry(0.2, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 0.75).translate(x, yb + 0.6, z)); J.add('fierro', new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6).translate(x, yb + 0.68, z)); }
    const [x, z] = P(u, d - 0.2); col(x, y + 0.4, z, 1.0, 0.8, 1.0); };
  const lena = (u, d, k = 0) => { const [x, z] = P(u, d); if (put('lena', x, z, k, 0, [0.67, 0.67, 0.67])) return col(x, y + 0.2, z, 0.6, 0.4, 0.6);   // N0-UTIL3 (G7): pila de leña de malla (0,6×0,4×0,33)
    for (let f = 0; f < 3; f++) for (let i = 0; i < 4 - f; i++) { const g = new THREE.CylinderGeometry(0.05, 0.055, 0.6, 6); g.rotateZ(Math.PI / 2); if (k % 2) g.rotateY(Math.PI / 2);
      const o = (i - (3 - f) / 2) * 0.11; g.translate(x + (k % 2 ? o : 0), y + 0.05 + f * 0.095, z + (k % 2 ? 0 : o)); J.add(i % 2 ? 'vigas' : 'maderaVieja', g); } col(x, y + 0.15, z, 0.6, 0.3, 0.6); };
  const brasero = (u, d) => { const [x, z] = P(u, d); if (put('brasero', x, z, 0)) return col(x, y + 0.25, z, 0.55, 0.5, 0.55);   // N0-UTIL3 (G1)
    J.add('fierro', new THREE.CylinderGeometry(0.26, 0.17, 0.16, 12, 1, true).translate(x, y + 0.42, z)); J.add('brasa', new THREE.CylinderGeometry(0.23, 0.23, 0.03, 12).translate(x, y + 0.46, z)); for (let i = 0; i < 9; i++) J.add('fierro', new THREE.DodecahedronGeometry(0.045 + r() * 0.025).translate(x + (r() - 0.5) * 0.3, y + 0.48, z + (r() - 0.5) * 0.3));
    for (let i = 0; i < 3; i++) { const a = i * 2.1; J.caja('fierro', x + Math.cos(a) * 0.17, y + 0.17, z + Math.sin(a) * 0.17, 0.03, 0.34, 0.03); } col(x, y + 0.25, z, 0.55, 0.5, 0.55); };
  const bancaR = (u, d, largo, k = 0) => { const [x, z] = P(u, d), m = marco(J, x, y, z, k); if (!put('banca_rustica', x, z, k, 0, [largo / 1.6, 1, 1])) { m.caja('maderaVieja', 0, 0.44, 0, largo, 0.05, 0.3); for (const i of [-1, 1]) m.caja('maderaVieja', i * (largo / 2 - 0.12), 0.21, 0, 0.05, 0.42, 0.26); } col(   /* C1: banca de palo FINA */ x, y + 0.24, z, k % 2 ? 0.3 : largo, 0.48, k % 2 ? largo : 0.3); };
  const guitarra = (der, d) => { { const [xg, zg] = P(der ? Wr - 0.08 : 0.08, d); if (put('guitarra', xg, zg, der ? 3 : 1)) return; }   // N0-UTIL3 (G6): guitarra de malla de pie contra el tabique, mirando a la pieza
    const [x, z] = P(der ? Wr - 0.15 : 0.15, d); const g1 = new THREE.SphereGeometry(0.17, 10, 8); g1.scale(1, 1.15, 0.35); const g2 = g1.clone(); g2.scale(0.8, 0.8, 1);
    const t = (g, dy) => { g.rotateZ(der ? 0.18 : -0.18); g.translate(x + (der ? -0.05 : 0.05), y + dy, z); J.add('madera', g); }; t(g1, 0.3); t(g2, 0.6); const c = new THREE.BoxGeometry(0.05, 0.55, 0.03); t(c, 0.95); };
  if (rol === 'estarC') {   // N0-INT-AMPLIO: casa obrera: cocina a leña, comedor y rincón de estar en UN espacio abierto al pasillo (franja de 1 m junto al pasillo libre)
    cocinaLena(0.85, L - 0.45, kHacia); balde(0.35, L - 1.25);
    const um = Wr >= 5.4 ? uc - 1.05 : Math.min(Wr * 0.48, Wr - 2.7), dm = L - 1.75;   // comedor a la izquierda del eje: desde el pasillo se entra derecho hasta el fondo
    alfombraChica(um, dm, 2.0, 1.8); mesa(um, dm, 1.2, 0.85, true); silla(um - 0.82, dm, 1); silla(um + 0.82, dm, 3); silla(um, dm + 0.68, kHacia); sillaF(um, dm - 0.68);
    tazas(um - 0.25, dm, 0.8); { const [fx, fz] = P(um + 0.3, dm); if (!put('florero', fx, fz, 0, 0.79)) J.add('rojo', new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8).translate(fx, y + 0.89, fz)); }   // florero
    if (Wr >= 5.4) { sofa(Wr - 0.45, L - 1.55, 3, 'tapizVerde');   // rincón de estar: sillón contra el tabique y mesita con la radio (1935+) en la esquina
      const [rx, rz] = P(Wr - 0.3, L - 0.28), m = marco(J, rx, y, rz, kHacia); m.caja('madera', 0, 0.35, 0, 0.45, 0.7, 0.4); col(rx, y + 0.35, rz, 0.45, 0.7, 0.4); if (pl.epoca >= 1935) radio(m, 0.7, kHacia); else m.cil('rojo', 0, 0.8, 0, 0.07, 0.2); }
    aparador(0.3, Math.max(1.4, L - 2.35), 1);
    cuadroFondo('foto' + ((r() * 4) | 0), um, 1.8, 0.5, 0.62); retrato(true, 0.9, 1.65); calendario(false, 0.9); estante(true, Math.max(1.0, L - 2.6), 1.75);
  } else if (rol === 'livingA') {   // N0-INT-AMPLIO: living-comedor de empleados en un solo espacio: estar (sofá, sillón, mesa de centro) a un lado, radio al fondo, comedor al otro
    const ul = 1.75; alfombraChica(ul, L - 1.55, 2.4, 2.0);
    sofa(ul, L - 0.5, kHacia, 'tapiz'); sofa(0.45, L - 1.85, 1, 'tapizVerde'); { const [mx, mz] = P(ul, L - 1.6); J.caja('maderaOsc', mx, y + 0.44, mz, 0.95, 0.04, 0.55); for (const i of [-1, 1]) for (const j of [-1, 1]) J.caja('maderaOsc', mx + i * 0.42, y + 0.21, mz + j * 0.22, 0.05, 0.42, 0.05); col(mx, y + 0.23, mz, 0.95, 0.46, 0.55, 'mueble'); } tazas(ul, L - 1.6, 0.46);   // mesa de centro baja
    { const [ax, az] = P(Math.max(ul + 1.55, Math.min(ul + 1.85, Wr - 3.0)), L - 0.25), m = marco(J, ax, y, az, kHacia); col(ax, y + 0.45, az, 1.1, 0.9, 0.42); if (!(pl.epoca >= 1935 && put('radiola', ax, az, kHacia, 0, [1, 0.9 / 0.85, 0.42 / 0.45]))) {   // N0-UTIL3 (G7): radiola de malla (1935+)
      m.caja('crema', 0, 0.45, 0, 1.1, 0.9, 0.42); m.caja('maderaOsc', 0, 0.45, 0.215, 0.95, 0.75, 0.01); if (pl.epoca >= 1935) radio(m, 0.9, kHacia); else m.cil('rojo', 0, 1.0, 0, 0.07, 0.2); } }
    const ud = Wr - 1.45, dd = L - 1.85; mesa(ud, dd, 1.1, 0.9, true); silla(ud - 0.78, dd, 1); silla(ud + 0.78, dd, 3); silla(ud, dd + 0.68, kHacia); sillaF(ud, dd - 0.68);
    { const [fx, fz] = P(ud, dd); J.add('rojo', new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8).translate(fx, y + 0.89, fz)); }
    cuadroFondo('plano', ul, 1.9, 0.7, 0.5); retrato(false, 0.8, 1.7, 1.2); calendario(true, 0.9); estante(true, Math.max(1.0, L - 3.0), 1.75);
  } else if (rol === 'salaOf') {   // N0-INT-AMPLIO: sala abierta de escritorios contra el muro de la fachada, archivadores en los extremos, plano grande en la pared
    archivador(0.4, L - 0.4, kHacia); archivador(Wr - 0.4, L - 0.4, kHacia);
    const n = Math.max(1, Math.floor((Wr - 3.1) / 2.3) + 1), paso = n > 1 ? (Wr - 3.1) / (n - 1) : 0;
    for (let i = 0; i < n; i++) escritorio(n > 1 ? 1.55 + i * paso : uc, L - 1.0, kHacia);
    cuadroFondo('plano', uc, 2.0, Math.min(2.2, Wr - 1.6), 0.8);
    cartelPared(pl.epoca >= 1945 ? 'SEGURIDAD|E HIGIENE|INDUSTRIAL' : 'BRADEN|COPPER CO.', 0.5, L); calendario(false, 1.3); retrato(true, 1.2, 1.7);
    if (Wr > 7) { const [px, pz] = P(Wr - 0.35, 1.7); J.add('madera', new THREE.CylinderGeometry(0.025, 0.03, 1.75, 6).translate(px, y + 0.875, pz)); J.caja(['colchaGris', 'tela'][(r() * 2) | 0], px, y + 1.45, pz, 0.08, 0.55, 0.3); }   // perchero con un abrigo
  } else if (rol === 'dormitorio' && pl.tipo === 'solteros') {   // literas de fierro, baúles y estufa; aviso de la compañía en la pared
    const lit = Wr > 3.2, dc = L - 1.05;
    cama(0.55, dc, 0, E.colcha, lit, RUSTICO ? 'maderaVieja' : 'fierro'); baul(0.55, dc - 1.4, 0);
    cama(Wr - 0.55, dc, 0, E.colcha, lit, RUSTICO ? 'maderaVieja' : 'fierro'); baul(Wr - 0.55, dc - 1.4, 0);
    if (Wr > 3.4) { if (RUSTICO) brasero(uc, L - 0.5); else estufa(uc, L - 0.5); }
    if (RUSTICO) { { const [vx, vz] = P(0.55, dc - 1.4); vela(J, vx, y + 0.5, vz); } ropaClavos(true, 0.9); if (L > 3) guitarra(false, 0.6); }
    if (!RUSTICO && p.amplio && Wr >= 5.5) { const um = uc + 1.0, dm = L - 1.7; mesa(um, dm, 0.8, 0.8); silla(um, dm - 0.62, kAdentro); silla(um, dm + 0.62, kHacia); }   // N0-INT-AMPLIO: mesita de naipes a un lado (el eje desde la puerta queda libre)
    zapatos(0.45, 0.4); zapatos(Wr - 0.5, 0.45); cordel(2.3);
    cuadroLado(false, 'cartel:' + (r() < 0.5 ? 'PROHIBIDO|POLOLEAR' : 'LEY SECA|NADA DE|LICOR'), 1.0, 1.65, 0.5, 0.5); calendario(true, 1.1); retrato(true, 2.3, 1.7);
  } else if (rol === 'comedorS' && p.abiertoA && !RUSTICO) {   // N0-INT-AMPLIO: comedor de la pensión abierto al pasillo: mesa larga a lo ancho con 2 bancas, cocina al fondo
    const lt = Math.max(1.0, Math.min(3.2, uc - 1.0)), um = 0.5 + lt / 2, dm = L - 1.7;   // mesa a la izquierda del eje (paso libre al centro), cocina a la derecha
    mesa(um, dm, lt, 0.8, true); for (const sd of [-1, 1]) { const [x, z] = P(um, dm + sd * 0.62); J.caja('madera', x, y + 0.45, z, lt, 0.05, 0.28); for (const i of [-1, 1]) J.caja('madera', x + i * (lt / 2 - 0.15), y + 0.22, z, 0.05, 0.44, 0.24); col(x, y + 0.25, z, lt, 0.5, 0.3); }
    tazas(um - lt * 0.3, dm, 0.8); tazas(um + lt * 0.25, dm + 0.1, 0.8);
    cocinaLena(Wr - 0.75, L - 0.45, kHacia); estante(true, Math.max(1.2, L - 2.4), 1.7); balde(Wr - 0.4, L - 1.3);
    retrato(false, 1.2); calendario(false, 2.6); cuadroFondo('cartel:' + (r() < 0.5 ? 'LEY SECA|NADA DE|LICOR' : 'COMEDOR|HORARIO|6 · 12 · 19'), um, 1.75, 0.5, 0.5);
  } else if (rol === 'comedorS') {   // comedor de la pensión: mesa larga (a lo largo) con bancas, lejos de la puerta
    const lt = Math.min(1.3, L - 2.8), dm = Math.max(1.75 + lt / 2, L - 0.75 - lt / 2);   // N0-INT2: mesa y bancas al fondo, fuera de la franja de la puerta
    mesa(uc, dm, 0.8, lt, true); for (const sx of [-1, 1]) { const [x, z] = P(uc + sx * 0.66, dm); J.caja('madera', x, y + 0.45, z, 0.28, 0.05, lt); col(x, y + 0.25, z, 0.3, 0.5, lt); }
    tazas(uc, dm - 0.3, 0.8); tazas(uc - 0.1, dm + 0.4, 0.8);
    if (L > 3) cocinaLena(Wr - 0.75, L - 0.45, kHacia); estante(false, 2.8); if (RUSTICO) { herram(false, 1.2); lena(0.5, L - 0.35, 1); } retrato(true, 1.2); calendario(true, 3.2); balde(0.4, 0.4);
  } else if (rol === 'lavatorio') { for (let u = 0.6; u < Wr - 0.4; u += 0.95) { const [lx, lz] = P(u, L - 0.25); if (put('lavatorio', lx, lz, kHacia)) C(u, L - 0.25, 0.75, 1.0, 0.45); else lavamanos(u, L - 0.3, kHacia, true); } cordel(2.2); balde(0.4, 0.45); zapatos(Wr - 0.5, 0.5); calendario(false, 1.0);
    if (Wr > 2.3) { const [px, pz] = P(0.95, 0.45); if (put('palangana_fina', px, pz, kHacia)) col(px, y + 0.055, pz, 0.44, 0.11, 0.44); }   // PALANGANA-FINA (16-11): palangana en el piso junto al balde (el lavatorio de los solteros)
  }
  else if (rol === 'unica') {   // casa obrera casada: pieza única con cocina a leña, mesa con mantel, cama matrimonial, ropa colgada (cuadros 65-77)
    cocinaLena(0.85, L - 0.45, kHacia);
    mesa(0.7, L - 1.55, 0.8, 1.0, true); silla(1.2, L - 1.55, 3); sillaF(0.7, L - 2.3);   // mesa contra el tabique: el centro queda libre desde la puerta (franja de 0,8 m)
    tazas(0.6, L - 1.55, 0.8); { const [fx, fz] = P(0.85, L - 1.65); if (!put('florero', fx, fz, 0, 0.79)) J.add('rojo', new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8).translate(fx, y + 0.89, fz)); }   // florero
    alfombraChica(0.8, L - 1.55, 1.4, 1.6);
    cama(Wr - 0.6, L - 1.05, 0, E.colcha); velador(Wr - 1.45, L - 0.25);
    cordel(2.3); calendario(false, 2.2); retrato(false, 1.1); retrato(true, 2.0, 1.65); estante(false, L - 0.9 > 3.4 ? 3.4 : L - 0.9, 1.6);
    escoba(0.3, 0.4); zapatos(Wr - 0.45, 0.4); ropaSilla(Wr - 0.4, 1.5, 3);
  } else if (rol === 'ninos') {   // dormitorio de los niños: litera, camita, baúl de juguetes
    cama(0.55, L - 1.05, 0, E.colcha, true); { const [cx, cz] = P(Wr - 0.42, L - 0.75); if (put('cuna', cx, cz, 3)) col(cx, y + 0.5, cz, 0.65, 1.0, 1.25); else cama(Wr - 0.55, L - 1.05, 0, 'colchaAzul'); } if (p.amplio && Wr < 3.7) baul(Wr - 0.3, L - 2.1, 3); else baul(uc, L - 0.35, 0);   // N0-UTIL: cuna de la guagua (N0-INT-AMPLIO: pieza angosta: el baúl contra el tabique, no contra la litera)
    alfombraChica(uc, 2.6, 1.5, 1.2); cordel(2.0); retrato(false, 1.1); calendario(true, 1.3); zapatos(uc + 0.7, 2.0);
    cuadroFondo('cartel:BUENAS|NOCHES', uc + 0.9, 1.5, 0.4, 0.4);
  } else if (rol === 'dormitorio') {   // dormitorio: cama de fierro con veladores, ropero, alfombra y ropa en la silla
    cama(uc, L - 1.05, 0, E.colcha); velador(uc + 0.78, L - 0.25); velador(uc - 0.78, L - 0.25);
    ropero(0.36, 2.4, 1); alfombraChica(uc, L - 2.5, 1.4, 1.0);
    { const [cx, cz] = P(Wr - 0.27, 2.6); if (Wr >= 3.2 && L > 3.3 && put('comoda', cx, cz, 3)) col(cx, y + 0.48, cz, 0.5, 0.95, 1.0); else ropaSilla(Wr - 0.4, 2.4, 3); }   // N0-UTIL: cómoda contra el tabique
    cuadroFondo('foto' + ((r() * 4) | 0), uc, 1.75, 0.5, 0.62); retrato(false, 1.1); retrato(true, 1.3, 1.6); calendario(true, 3.0);
    if (pl.tipo === 'casados') baul(0.5, 0.45, 0);
  } else if (rol === 'livingcom') {   // living-comedor de empleados: sofá, sillón, alfombra, radio (1935+) y mesa de comedor
    const ancho = Wr >= 4.2, lu = ancho ? Wr * 0.36 : uc;
    alfombraChica(lu, L - 1.9, Math.min(Wr * 0.5, 2.3), 1.8);
    sofa(lu, L - 0.55, kHacia, 'tapiz'); mesa(lu, L - 1.9, 0.9, 0.55); tazas(lu, L - 1.9, 0.8); sofa(0.55, L - 1.9, 1, 'tapizVerde');
    if (ancho) { mesa(Wr - 1.05, L - 1.8, 1.0, 0.9, true); silla(Wr - 1.05 - 0.7, L - 1.8, 1); if (Math.abs(L - 1.8 - 1.9) > 0.85) silla(Wr - 1.05 + 0.7, L - 1.8, 3); sillaF(Wr - 1.05, L - 2.5); sillaF(Wr - 1.05, L - 1.1); }
    { const k = 3, [ax, az] = P(Wr - 0.3, 1.9), m = marco(J, ax, y, az, k); if (!(pl.epoca >= 1935 && put('radiola', ax, az, (k + 1) % 4, 0, [1.09, 0.9 / 0.85, 1]))) { m.caja('crema', 0, 0.45, 0, 0.45, 0.9, 1.2); m.caja('maderaOsc', 0.23, 0.45, 0, 0.01, 0.75, 1.0); if (pl.epoca >= 1935) radio(m, 0.9, k); }   /* N0-UTIL3 (G7): radiola de malla (1935+), frente hacia la pieza */ col(ax, y + 0.45, az, 0.45, 0.9, 1.2); }
    estante(false, 1.2, 1.7); retrato(true, 3.4, 1.7, 1.2); cuadroFondo('plano', lu, 1.9, 0.7, 0.5); calendario(true, 0.9);
  } else if (rol === 'cocinaE') {   // cocina de empleados: cocina económica, mesa de cocina, lavaplatos con calefón
    cocinaLena(1.0, L - 0.45, kHacia); lavamanos(Wr - 0.8, L - 0.3, kHacia, true);
    { const [cx, cz] = P(Wr - 0.27, L - 0.28); if (put('calefon', cx, cz, kHacia, 0, [1.1, 1.1, 1.1])) col(cx, y + 0.5, cz, 0.44, 1.0, 0.4); else { const [ox, oz] = P(Wr - 0.3, L - 0.3); J.add('cobre', new THREE.CylinderGeometry(0.2, 0.2, 0.8, 12).translate(ox, y + 1.9, oz)); } }   // N0-UTIL3 (G7): calefón de cobre de pie junto al lavaplatos
    mesa(Wr * 0.5, L - 1.45, 1.0, 0.7, true); silla(Wr * 0.5 - 0.65, L - 1.45, 1); silla(Wr * 0.5 + 0.65, L - 1.45, 3); tazas(Wr * 0.5, L - 1.45, 0.8);   // N0-INT2: mesa más al fondo, la franja de la puerta queda libre
    alfombraChica(Wr * 0.5, L - 1.45, 1.5, 1.2); estante(false, 2.6); estante(true, 3.0, 1.7); calendario(true, 1.2); balde(0.4, 0.45); zapatos(Wr - 0.45, 0.4);
  }
  else if (rol === 'cocina') {   // cocina-comedor de la casa obrera (cuadros 65-77)
    cocinaLena(Math.min(Wr - 0.75, 1.0), L - 0.42, kHacia); mesa(Wr / 2 + 0.2, L - 1.9, 1.1, 0.8, true); silla(Wr / 2 - 0.5, L - 1.9, 1); silla(Wr / 2 + 0.9, L - 1.9, 3);
    if (Wr > 2.8) aparador(Wr - 0.7, L - 0.3, kHacia); fotos(2, 0.5, 1.0);
    const [fx, fz] = P(Wr / 2 + 0.2, L - 1.9); if (!put('florero', fx, fz, 0, 0.79)) J.add('rojo', new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8).translate(fx, y + 0.89, fz));   // florero
  } else if (rol === 'living') {   // living de empleados: sofá, sillón, alfombra, radio (1940+)
    const [ax, az] = P(Wr / 2, L / 2); J.caja('alfombra', ax, y + 0.012, az, Math.min(Wr - 0.6, 2.6), 0.02, Math.min(L - 0.8, 2));
    sofa(Wr / 2, L - 0.55, kHacia, 'tapiz'); if (Wr > 3) sofa(0.5, L / 2, 1, 'tapizVerde');
    mesa(Wr / 2, L / 2 + 0.3, 0.9, 0.55); if (pl.epoca >= 1935) { const [x, z] = P(Wr - 0.4, 0.5); J.caja('madera', x, y + 0.45, z, 0.5, 0.9, 0.4); J.caja('crema', x, y + 0.6, z - s * 0.2, 0.36, 0.2, 0.01); }
    if (QUEROSENO) { if (Wr > 3.2) estufa(Wr - 0.45, L - 0.55); const [lx, lz] = P(Wr / 2, L / 2); lamparaMesa(marco(J, lx, y, lz, 0), 0, 0.775); }   // Hamilton: estufa y lámpara de queroseno
    fotos(2, 0.5, 1.2, QUEROSENO ? 1.3 : 1);
  } else if (rol === 'comedor') { const dm = Math.min(L / 2 + 0.7, L - 1.6); mesa(Wr / 2, dm, 1.4, 0.9, true); for (const [du, dd, k] of [[-0.45, -0.7, 0], [0.45, -0.7, 0], [-0.45, 0.7, 2], [0.45, 0.7, 2]]) silla(Wr / 2 + du, dm + dd, k); if (Wr > 2.6) aparador(Wr - 0.7, L - 0.3, kHacia); }
  else if (rol === 'bano') {   // baño de empleados: tina, lavamanos grande con dos llaves y el calefón («la bomba del agua caliente»)
    const [x, z] = P(Wr - 0.45, L / 2); if (!put('tina_bano', x, z, 1, 0, [Math.min(1.6, L - 0.6) / 1.6, 0.85, 0.7 / 0.75])) { J.caja('loza', x, y + 0.28, z, 0.7, 0.55, Math.min(1.6, L - 0.6)); J.caja('enlozado', x, y + 0.5, z, 0.55, 0.12, Math.min(1.45, L - 0.75)); }   // N0-UTIL3 (G7): tina enlozada de patas
    col(x, y + 0.28, z, 0.7, 0.56, Math.min(1.6, L - 0.6));
    lavamanos(0.55, L - 0.3, kHacia, true); const [cx, cz] = P(0.35, L - 0.25); J.add('cobre', new THREE.CylinderGeometry(0.2, 0.2, 0.8, 12).translate(cx, y + 1.7, cz));   // N0-UTIL3 (G7): aquí sigue procedural (la malla del calefón tiene patas de piso y abajo está el lavamanos)
  } else if (rol === 'escritorioH') {   // escritorio del superintendente: planos del concentrador, documentos de la Braden Copper, caja fuerte
    const [x, z] = P(Wr / 2, L - 1.05), m = marco(J, x, y, z, kHacia);
    if (!put('escritorio', x, z, kHacia, 0, [1.7 / 1.4, 1, 0.85 / 0.75])) {   // UTIL-T0: escritorio de malla (1,4×0,78×0,75 m) escalado a 1,7×0,85 del superintendente; respaldo: cajas
    m.caja('maderaOsc', 0, 0.76, 0, 1.7, 0.06, 0.85); m.caja('madera', -0.62, 0.37, 0, 0.42, 0.74, 0.8); m.caja('madera', 0.78, 0.37, -0.3, 0.06, 0.74, 0.06); m.caja('madera', 0.78, 0.37, 0.3, 0.06, 0.74, 0.06);
    for (let i = 0; i < 3; i++) { m.caja('maderaClara', -0.62, 0.15 + i * 0.22, 0.41, 0.34, 0.16, 0.01); m.caja('laton', -0.62, 0.15 + i * 0.22, 0.42, 0.08, 0.03, 0.02); } }
    m.caja('plano', 0.12, 0.795, 0.02, 0.95, 0.012, 0.64); { const [rx, rz] = m.mundo(0.15, 0.33); if (!put('rollos_planos', rx, rz, kHacia, 0.79, [0.95, 0.9, 0.6])) { m.caja('papel', -0.4, 0.83, 0.3, 0.75, 0.07, 0.07); m.caja('papel', -0.35, 0.83, 0.2, 0.7, 0.06, 0.06); } }   // plano abierto y rollos (N0-UTIL3 G7: malla)
    m.caja('papel', 0.68, 0.82, -0.2, 0.3, 0.05, 0.22); m.caja('rojo', 0.68, 0.85, -0.2, 0.22, 0.01, 0.16); m.cil('fierro', 0.6, 0.83, 0.28, 0.035, 0.08); lamparaMesa(m, -0.6, 0.79, -0.15);   // documentos, tintero, lámpara
    const [cx, cz] = m.mundo(0, 0); col(cx, y + 0.4, cz, k2(kHacia) ? 0.85 : 1.7, 0.8, k2(kHacia) ? 1.7 : 0.85); silla(Wr / 2, L - 1.05 + 0.62, kHacia);
    tablero(0.8, 0.9, 1); if (Wr > 2.8) { const [qx, qz] = P(Wr - 0.5, 0.45), q = marco(J, qx, y, qz, kHacia); if (put('caja_fuerte', qx, qz, kHacia, 0, [1, 0.78, 0.92])) col(qx, y + 0.35, qz, 0.6, 0.7, 0.55); else { q.caja('fierro', 0, 0.35, 0, 0.6, 0.7, 0.55); q.caja('laton', 0, 0.45, 0.28, 0.14, 0.14, 0.02); q.caja('laton', 0, 0.2, 0.28, 0.2, 0.03, 0.02); col(qx, y + 0.35, qz, 0.6, 0.7, 0.55); } }   // caja fuerte (N0-UTIL3 G1: malla)
    cuadroFondo('plano', Wr / 2 - 0.5, 1.7, 1.0, 0.7);
    cartelPared('BRADEN|COPPER CO.', Wr / 2 + 0.8, L); fotos(1, 0.5, 0.8, 1.35);
  } else if (rol === 'estar') {   // sala de estar con estufa de fierro, sillones, repisa de libros y retratos
    const [ax, az] = P(Wr / 2, L / 2); J.caja('alfombra', ax, y + 0.012, az, Math.min(Wr - 0.6, 2.4), 0.02, Math.min(L - 0.8, 1.8));
    estufa(Wr - 0.55, L - 0.6); sofa(Wr / 2, L - 0.55, kHacia, 'tapizVerde'); mesa(Wr / 2, L / 2, 0.7, 0.5);
    { const [mx, mz] = P(Wr / 2, L / 2), m = marco(J, mx, y, mz, 0); lamparaMesa(m, 0, 0.785); }
    { const [bx, bz] = P(0.45, 0.4), m = marco(J, bx, y, bz, 1); m.caja('maderaOsc', 0, 0.9, 0, 0.9, 1.8, 0.32); for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) m.caja(['rojo', 'colchaAzul', 'tapizVerde', 'frazada', 'papel'][(i + j) % 5], -0.36 + j * 0.14, 0.2 + i * 0.33, 0.04, 0.1, 0.26, 0.2); col(bx, y + 0.9, bz, 0.35, 1.8, 0.9); }
    fotos(3, 0.5, 0.9, 1.3);
  } else if (rol === 'dormitorioH') {   // dormitorio principal: cama de fierro, velador con lámpara de queroseno, tocador, estufa y retratos
    cama(Wr / 2, L - 1.05, 0, E.colcha); velador(Wr / 2 + 0.75, L - 0.25); velador(Wr / 2 - 0.75, L - 0.25);
    if (Wr > 2.8) { ropero(0.3, 1.1, 1); estufa(Wr - 0.5, 0.7); }
    fotos(3, 0.4, 0.7, 1.3);
  } else if (p.cam) {   // N1-CAMAROTE1905 (15-11, Diego: «moderno por dentro y apretado, no tiene el estilo de Pueblo Hundido»): cuadra de mineros de 1905 de planta abierta.
    // Abajo: cocina de fierro y mesa larga con bancas (poniente), catres de palo contra el fondo entre las ventanas, bodega detrás de la escalera; arriba: dormitorio corrido de
    // literas de palo con frazadas y pieles entre las ventanas, baúles, palangana, brasero. Nada eléctrico; luz de velas, candiles y faroles colgados de las vigas.
    const h = p.ham, Q = (x, z) => [x - x0, z - zc], xi0 = -X + 0.2, xi1 = X - 0.2, zb = p.zc, zf = p.zo, zm = (zb + zf) / 2, alto = p.f ? (pl.muroA || 2 * hp) - hp : hp, Dd = -zb + 0.2;
    const farolC = (x, z, yG) => { const yT = p.f ? alto - 0.25 : hp - 0.42; J.caja('fierro', x, y + (yT + yG) / 2, z, 0.012, yT - yG, 0.012); farol(J, x, y + yG, z); };
    // tramos del muro (frente z = 0 / fondo z = -D) sin ventana en este piso: las literas y los clavos van ENTRE las ventanas, nunca delante
    const libres = (zW) => { const vs = pl.vanos.filter(v => Math.floor((v.y + 0.01) / hp) === p.f && Math.abs(v.z - zW) < 0.3).map(v => [v.x - v.w / 2 - 0.12, v.x + v.w / 2 + 0.12]).sort((a, b) => a[0] - b[0]);
      const out = []; let a = xi0; for (const [u0, u1] of vs) { if (u0 > a) out.push([a, Math.min(u0, xi1)]); a = Math.max(a, u1); } if (a < xi1) out.push([a, xi1]); return out.filter(([u0, u1]) => u1 - u0 > 0.95); };
    const sitios = (zW, xMax, sin = []) => libres(zW).map(([u0, u1]) => u1 - u0 < 2 ? (u0 + u1) / 2 : u0 <= xi0 + 0.01 ? u0 + 0.52 : u1 >= xi1 - 0.01 ? u1 - 0.52 : (u0 + u1) / 2).filter(x => x + 0.45 < xMax && !sin.some(([a, b]) => x > a && x < b));
    const clavos = (x, zW, sg, yy = 1.95) => {   // tabla con clavos sobre la cabecera: manta, camisa, sombrero
      const z = zW - sg * 0.02; J.caja('maderaVieja', x, y + yy, z, 0.8, 0.08, 0.03); for (let i = 0; i < 3; i++) J.caja('fierro', x - 0.27 + i * 0.27, y + yy, z - sg * 0.04, 0.012, 0.012, 0.06);
      J.caja(r() < 0.5 ? 'manta' : 'manta2', x - 0.2, y + yy - 0.33, z - sg * 0.05, 0.3, 0.6, 0.025); J.caja(r() < 0.5 ? 'saco' : 'frazada', x + 0.12, y + yy - 0.28, z - sg * 0.06, 0.28, 0.5, 0.025);
      if (r() < 0.5) J.add('saco', new THREE.CylinderGeometry(0.17, 0.2, 0.03, 12).rotateX(Math.PI / 2).translate(x + 0.27, y + yy - 0.12, z - sg * 0.07)); };
    const litera = (x, zW, sg, dos = true) => {   // litera (o catre) de palo: pilares, largueros, tablas, jergón de saco, frazada o manta, almohada de saco y a veces una piel; escalerilla a los pies
      const L = 1.95, A = 0.9, zq = zW - sg * (L / 2 + 0.03), hP = dos ? 1.75 : 0.62, niveles = dos ? [0.36, 1.28] : [0.36];
      for (const a of [-1, 1]) for (const b of [-1, 1]) J.caja('vigas', x + a * (A / 2 - 0.04), y + hP / 2, zq + b * (L / 2 - 0.04), 0.08, hP, 0.08);
      for (const yy of niveles) {
        for (const a of [-1, 1]) J.caja('maderaVieja', x + a * (A / 2 - 0.04), y + yy, zq, 0.06, 0.12, L - 0.12);
        J.caja('maderaVieja', x, y + yy - 0.03, zq, A - 0.18, 0.03, L - 0.16);
        J.caja('saco', x, y + yy + 0.06, zq, A - 0.16, 0.1, L - 0.22);
        J.caja(['frazada', 'manta', 'manta2'][(r() * 3) | 0], x, y + yy + 0.125, zq - sg * 0.3, A - 0.12, 0.035, L * 0.6);
        J.caja('saco', x, y + yy + 0.15, zq + sg * (L / 2 - 0.3), A * 0.55, 0.08, 0.3);
        if (r() < 0.45) J.caja('piel', x + 0.05, y + yy + 0.16, zq - sg * 0.45, A * 0.72, 0.025, 0.6);
      }
      if (dos) { const ze = zq - sg * (L / 2 + 0.03); for (const a of [-1, 1]) J.caja('vigas', x + a * 0.2, y + 0.68, ze, 0.04, 1.36, 0.04); for (let i = 1; i < 5; i++) J.caja('maderaVieja', x, y + i * 0.3, ze, 0.36, 0.03, 0.03); }
      col(x, y + hP / 2, zq, A, hP, L, 'mueble');
    };
    // faroles de parafina colgados de las vigas (o de los tirantes arriba) y velas
    if (rol === 'cam0') {
      const mx = xi0 + 5.3, mz = zm + 0.25;
      // cocina de fierro contra el fondo poniente (entre ventanas), leña, ollas, tinaja en la esquina, palangana y balde en el hastial poniente
      { const cx = sitios(-Dd, 0)[1] ?? xi0 + 3.2; cocinaLena(...Q(cx, zb + 0.36), 0); lena(...Q(cx + 1.25, zb + 0.35), 0);
        for (const [dx, rr, hh, k] of [[-0.85, 0.16, 0.22, 'fierro'], [-0.85, 0.11, 0.15, 'cobre']]) J.add(k, new THREE.CylinderGeometry(rr, rr * 0.85, hh, 10).translate(cx + dx, y + hh / 2 + (k === 'cobre' ? 0.22 : 0), zb + 0.35)); col(cx - 0.85, y + 0.2, zb + 0.35, 0.36, 0.4, 0.36);
        farolC(cx, zb + 1.4, 2.7); }
      tinaja(J, col, xi0 + 0.45, y, zb + 0.45);
      lavamanos(...Q(xi0 + 0.4, -3.35 * Dd / 9.1), 1); balde(...Q(xi0 + 0.45, -2.6 * Dd / 9.1));
      // mesa larga de tablas con dos bancas, jarros de lata, mate, velas y candil
      mesa(...Q(mx, mz), 3.6, 0.85); bancaR(...Q(mx, mz + 0.72), 3.4, 0); bancaR(...Q(mx, mz - 0.72), 3.4, 0);
      tazas(...Q(mx - 1.1, mz - 0.1), 0.8); tazas(...Q(mx + 0.9, mz + 0.1), 0.8); candil(J, mx + 0.1, y + 0.79, mz); vela(J, mx - 0.4, y + 0.79, mz + 0.2, true);
      farolC(mx - 0.9, mz, 2.6); farolC(mx + 0.9, mz, 2.6);
      // catres de palo con la cabecera contra el fondo, entre las ventanas; ropa en clavos encima, baúles entre catres, brasero de fierro
      const cs = sitios(-Dd, h.xW - 0.6).filter(x => x > mx + 1.0);
      cs.forEach((x, i) => { litera(x, zb, -1, false); clavos(x, zb, -1); if (i < cs.length - 1) { const bx = (x + cs[i + 1]) / 2; if (cs[i + 1] - x > 1.9) { baul(...Q(bx, zb + 0.3), 0); vela(J, bx, y + 0.5, zb + 0.3, r() < 0.5); } } });
      brasero(...Q(mx + 3.0, mz - 0.4));
      if (cs.length) farolC(cs[Math.floor(cs.length / 2)], zb + 2.4, 2.6);
      // junto a la puerta: mantas, chupalla y herramientas en clavos (como en las casas de piedra); leña y sacos bajo las ventanas del frente
      halls1905(J, col, y, pl.tipo);
      const fr = sitios(0, xi1 + 1); { const xs = fr.filter(x => x < -1.8); if (xs.length) { const [hx] = xs.slice(-1); herramientas(J, hx, y, zf - 0.35, 0, 2, [hx, zf - 0.22]); }   /* C1b: muro del frente (+z) */ if (xs.length > 1) sacos(...Q(xs[0] + 0.1, zf - 0.55), 3); }
      { const xs = fr.filter(x => x > 1.8); if (xs.length) lena(...Q(xs[0], zf - 0.35), 0); if (xs.length > 1) { baul(...Q(xs[xs.length - 1], zf - 0.3), 2); vela(J, xs[xs.length - 1], y + 0.5, zf - 0.3); } }
      // bodega detrás de la escalera: sacos de harina y papas, barril, herramientas en el fondo, candil
      { const bx = (h.xW + h.xE) / 2; sacos(...Q(bx - 1.0, zb + 1.0), 4); sacos(...Q(bx + 1.0, zb + 1.0), 3); herramientas(J, h.xE + 0.4, y, zb + 0.35, 2, 0, [h.xE + 0.4, zb + 0.22]);   /* C1b: muro del fondo (−z) */ tinaja(J, col, xi1 - 0.45, y, zb + 0.45); farolC(bx, zb + 1.5, 2.6); }
    } else {
      // dormitorio corrido: literas entre las ventanas del frente y del fondo, lejos del hueco de la escalera; aisle al centro
      const xMax = h.xW - 0.6, fr = sitios(0, xMax), fo = sitios(-Dd, xMax);
      fr.forEach((x, i) => { litera(x, zf, 1); clavos(x, zf, 1, 2.0); if (i % 2 === 0) { baul(...Q(x, zf - 2.33), 0); vela(J, x + 0.2, y + 0.5, zf - 2.33, true); } });
      fo.forEach((x, i) => { litera(x, zb, -1); clavos(x, zb, -1, 2.0); if (i % 2 === 1) baul(...Q(x, zb + 2.33), 2); });
      // palangana en un banco y balde en el hastial poniente; brasero en el pasillo; cordel con ropa secándose sobre el brasero
      lavamanos(...Q(xi0 + 0.4, -3.35 * Dd / 9.1), 1); balde(...Q(xi0 + 0.45, -5.75 * Dd / 9.1));
      brasero(...Q(xi0 + 4.6, zm + 0.95));
      // rincón oriente: baúles bajo las ventanas del frente, tinaja y sacos al fondo
      { const xs = sitios(0, xi1 + 1).filter(x => x > h.xW - 0.2); xs.forEach(x => baul(...Q(x, zf - 0.3), 2)); tinaja(J, col, xi1 - 0.45, y, zb + 0.45); sacos(...Q(h.xW + 0.6, zb + 0.6), 2); }
      for (const t of [0.18, 0.42, 0.66]) farolC(xi0 + (2 * X - 0.4) * t, zm, 2.6);
    }
  } else if (p.ham) {   // N1-HAMILTON: casa del superintendente de 1905, planta abierta (coordenadas del interior: x a lo largo, z = 0 en la fachada de la puerta)
    const h = p.ham, Q = (x, z) => [x - x0, z - zc], xi0 = -X + 0.2, xi1 = X - 0.2, zb = p.zc, zf = p.zo, zm = (zb + zf) / 2, alto = p.f ? (pl.muroA || 2 * hp) - hp : hp;
    const pied = E.muroF ? E.muroF(0) : E.muro;
    const MH = mapaHam(h, X, -zb + 0.2), w = MH.w, e = MH.e;   // N1-HAMILTON-c: casa agrandada (w: poniente en proporción; e: oriente con la escalera)
    const Pz = (id, x, z, k, dy = 0, esc) => put(id, x, z, k, dy, esc);
    const sillaV = (x, z, k) => { if (!Pz('silla_viena', x, z, k)) silla(...Q(x, z), k); };
    const velaP = (x, yy, z) => { if (!Pz('vela', x, z, 0, yy)) vela(J, x, y + yy, z); };
    const cuadroEn = (key, x, z, k, yy, w, hh, marcoK = 'maderaOsc') => {   // N0-ADORNOS-VANOS: muro propio (coordenadas del interior); se corre a lo largo del muro si cae en una ventana
      const al = k % 2 === 1, W = al ? { eje: 'z', plano: x, dir: k === 1 ? 1 : -1, lo: Math.min(p.zc, p.zo) + 0.3, hi: Math.max(p.zc, p.zo) - 0.3 } : { eje: 'x', plano: z, dir: k === 0 ? 1 : -1, lo: x0, hi: x1 };
      adorno('cuadro', w + 0.08, yy - hh / 2 - 0.04, yy + hh / 2 + 0.04, (pa, c) => { const m = al ? marco(J, x, y, c, k) : marco(J, c, y, z, k); m.caja(marcoK, 0, yy, 0.006, w + 0.08, hh + 0.08, 0.02); m.cuadro(key, 0, yy, 0.02, w, hh); }, [null, al ? z : x], W); };
    const farolC = (x, z, yG) => { const yT = p.f ? alto - 0.25 : hp - 0.42; J.caja('fierro', x, y + (yT + yG) / 2, z, 0.012, yT - yG, 0.012); farol(J, x, y + yG, z); };   // farol colgado de la viga o del tirante
    // chimenea de piedra en el muro poniente, entre sus dos ventanas (sube por los dos pisos): hogar con leños y brasas, repisa con velas y reloj, cuadro
    { const an = 0.92, dx = 0.45, xf = xi0 + dx, z0 = zm;
      if (!p.f && put('chimenea', xi0 + dx / 2, z0, 1, 0, [0.75, 1, 0.75])) {   // N0-UTIL3 (G1): hogar de piedra con repisa y reloj de malla; sobre él sigue el tiro procedural y el cuadro
        J.caja(pied, xi0 + dx / 2, y + 1.3 + (alto - 1.3) / 2, z0, dx, alto - 1.3, an); cuadroEn('paisaje', xf, z0, 1, 1.85, 0.6, 0.42); col(xi0 + dx / 2, y + alto / 2, z0, dx, alto, an);
      } else {
      J.caja(pied, xi0 + dx / 2, y + 0.75 + (alto - 0.75) / 2, z0, dx, alto - 0.75, an); for (const sg of [-1, 1]) J.caja(pied, xi0 + dx / 2, y + 0.375, z0 + sg * (an / 2 - 0.09), dx, 0.75, 0.18);
      J.caja('fierro', xi0 + 0.05, y + 0.375, z0, 0.04, 0.75, an - 0.36); J.caja(pied, xi0 + (dx + 0.4) / 2, y + 0.03, z0, dx + 0.4, 0.06, an + 0.3);
      J.caja('brasa', xi0 + 0.25, y + 0.09, z0, 0.26, 0.04, 0.42); for (const k of [-1, 1]) { const g = new THREE.CylinderGeometry(0.05, 0.055, 0.46, 6); g.rotateX(Math.PI / 2); g.rotateY(k * 0.35); g.translate(xi0 + 0.25, y + 0.15, z0); J.add('vigas', g); }
      if (!p.f) J.add('llama', new THREE.ConeGeometry(0.11, 0.3, 6).translate(xi0 + 0.25, y + 0.33, z0));
      J.caja('madera', xf + 0.06, y + 1.22, z0, 0.3, 0.06, an + 0.24); velaP(xf + 0.06, 1.25, z0 - 0.38); velaP(xf + 0.06, 1.25, z0 + 0.38);
      if (!p.f) { J.caja('maderaOsc', xf + 0.06, y + 1.39, z0, 0.14, 0.28, 0.24); J.add('papel', new THREE.CircleGeometry(0.07, 14).rotateY(Math.PI / 2).translate(xf + 0.135, y + 1.43, z0)); }   // reloj de repisa
      cuadroEn(p.f ? 'foto2' : 'paisaje', xf, z0, 1, 1.85, 0.6, 0.42); col(xi0 + dx / 2, y + alto / 2, z0, dx, alto, an); } }
    if (rol === 'ham0') {
      // estar junto al fuego: sofá mirando la chimenea, mesita con quinqué, 2 sillas de Viena a los lados, alfombra, librero contra la fachada
      J.caja('alfombra', w(-4.75), y + 0.012, zm, 2.5, 0.02, 2.7);
      sofa(...Q(w(-3.55), zm), 3, 'tapiz'); mesa(...Q(w(-4.55), zm), 0.5, 0.7); lamparaMesa(marco(J, w(-4.55), y, zm + 0.1, 0), 0, 0.775);
      sillaV(w(-5.2), zm + 1.15, 2); sillaV(w(-5.2), zm - 1.15, 0);
      // N1-HAMILTON-b: librero ABIERTO (costados, techo, zócalo, fondo y 5 repisas) con los libros 3 cm detrás del canto: antes era una caja maciza con los lomos
      // coplanares a su frente (parpadeaba y se veía lisa). A 2 cm del muro.
      { const lz = zf - 0.195, m = marco(J, w(-5.6), y, lz, 2), cols = ['rojo', 'colchaAzul', 'tapizVerde', 'frazada', 'papel', 'maderaClara', 'colchaRoja'];
        for (const sx of [-1, 1]) m.caja('maderaOsc', sx * 0.46, 0.95, 0, 0.03, 1.9, 0.34); m.caja('maderaOsc', 0, 1.885, 0, 0.98, 0.03, 0.36); m.caja('maderaOsc', 0, 0.05, 0.005, 0.89, 0.1, 0.33);
        m.caja('maderaOsc', 0, 0.95, -0.16, 0.89, 1.84, 0.02);
        const rep0 = [0.1, 0.44, 0.78, 1.12, 1.46]; for (const ry of rep0.slice(1)) m.caja('maderaOsc', 0, ry - 0.012, 0, 0.89, 0.024, 0.32);
        rep0.forEach((ry, i) => { let x = -0.43; let k = i * 3; while (x < 0.39) { const w = 0.03 + ((k * 37) % 5) * 0.008, hh = 0.2 + ((k * 53) % 4) * 0.025, inc = (k % 11 === 5) ? 0.25 : 0;
          if (x + w > 0.43) break; const dp = 0.18 + (k % 3) * 0.012, [bx, bz] = m.mundo(x + w / 2, -0.13 + dp / 2 + (k % 2) * 0.006); J.caja(cols[k % cols.length], bx, y + ry + hh / 2 + 0.002, bz, w, hh, dp, 0, 0, inc); x += w + 0.004 + (k % 7 === 3 ? 0.06 : 0); k++; } });
        col(w(-5.6), y + 0.95, lz, 0.95, 1.9, 0.34); }
      for (const [x, i] of [[w(-3.0), 0], [w(-2.2), 1]]) cuadroEn('foto' + i, x, zf - 0.012, 2, 1.65, 0.26, 0.34);
      // comedor al fondo poniente: mesa con mantel, 6 sillas, aparador con loza, farol colgado de la viga
      const xm2 = w(-2.95), zm2 = zb + 1.2 + Math.max(0, (MH.kz - 1) * 2.2); J.caja('alfombra2', xm2, y + 0.012, zm2, 2.6, 0.02, 2.0); mesa(...Q(xm2, zm2), 1.6, 0.9); J.caja('tela', xm2, y + 0.795, zm2, 1.7, 0.012, 1.0); for (const sg of [-1, 1]) { J.caja('tela', xm2, y + 0.68, zm2 + sg * 0.5, 1.7, 0.24, 0.012); J.caja('tela', xm2 + sg * 0.85, y + 0.68, zm2, 0.012, 0.24, 1.0); }   // mantel blanco de hilo (casa del superintendente)
      velaP(xm2 + 0.3, 0.78, zm2); velaP(xm2 - 0.3, 0.78, zm2);
      for (const dx of [-0.45, 0.45]) { sillaV(xm2 + dx, zm2 + 0.68, 2); sillaV(xm2 + dx, zm2 - 0.62, 0); } sillaV(xm2 - 1.05, zm2, 1); sillaV(xm2 + 1.05, zm2, 3);
      { const ax = xi0 + 0.24, az = zb + 1.15; if (Pz('aparador', ax, az, 1)) { Pz('jarro', ax, az - 0.3, 1, 0.95); Pz('tetera', ax, az + 0.3, 1, 0.95); } else aparador(...Q(ax, az), 1); col(ax, y + 0.48, az, 0.46, 0.95, 1.2); }
      farolC(xm2, zm2, 2.95);
      // rincón de cocina al fondo, detrás de la escalera: cocina de fierro con su cañón, ollas, mesa de cocina con pan, palangana, leña, tinaja, alacena
      { const cx = e(1.05), cz = zb + 0.38; if (!Pz('cocina', cx, cz, 0)) cocinaLena(...Q(cx, cz), 0); else col(cx, y + 0.43, cz, 1.1, 0.86, 0.66);
        J.add('fierro', new THREE.CylinderGeometry(0.07, 0.07, hp - 0.86, 8).translate(cx - 0.35, y + (hp + 0.86) / 2, cz - 0.18)); Pz('olla', cx + 0.25, cz, 0, 0.86); Pz('tetera', cx - 0.15, cz + 0.05, 0, 0.86); }
      mesa(...Q(e(0), zb + 0.32), 1.0, 0.55); Pz('pan', e(-0.15), zb + 0.32, 0, 0.78); velaP(e(0.3), 0.78, zb + 0.3);
      { const lx = e(-1.05), lz = zb + 0.24; J.caja('madera', lx, y + 0.62, lz, 0.7, 0.05, 0.4); for (const i of [-1, 1]) J.caja('madera', lx + i * 0.3, y + 0.3, lz, 0.05, 0.6, 0.36);
        if (!Pz('palangana_fina', lx - 0.06, lz, 0, 0.645)) J.add('loza', new THREE.CylinderGeometry(0.2, 0.12, 0.1, 14).translate(lx, y + 0.7, lz)); /* PALANGANA-FINA (16-11): la palangana del banco, FINA */ Pz('jarro', lx + 0.25, lz + 0.05, 0, 0.645); col(lx, y + 0.4, lz, 0.72, 0.8, 0.42); }
      lena(...Q(e(1.97), zb + 0.32), 0); tinaja(J, col, e(2.45), y, zb + 0.33);
      { const ax = e(3.3), az = zb + 0.24; if (Pz('aparador', ax, az, 0)) { Pz('olla', ax - 0.3, az, 0, 0.95); Pz('jarro', ax + 0.3, az, 0, 0.95); } else aparador(...Q(ax, az), 0); col(ax, y + 0.48, az, 1.2, 0.95, 0.46); }
      farolC(e(1.0), zb + 1.3, 2.95);
      // escritorio de trabajo al fondo oriente: planos del concentrador, quinqué, tintero; tablero de dibujo junto a la ventana, caja fuerte, mueble de planos
      { const ex = e(5.25), ez = zb + 0.5, m = marco(J, ex, y, ez, 0);
        if (!Pz('escritorio', ex, ez, 0, 0, [1.7 / 1.4, 1, 0.85 / 0.75])) {   // UTIL-T0: escritorio de malla escalado a 1,7×0,85; respaldo: cajas
        m.caja('maderaOsc', 0, 0.76, 0, 1.7, 0.06, 0.85); m.caja('madera', -0.62, 0.37, 0, 0.42, 0.74, 0.8); m.caja('madera', 0.78, 0.37, -0.3, 0.06, 0.74, 0.06); m.caja('madera', 0.78, 0.37, 0.3, 0.06, 0.74, 0.06);
        for (let i = 0; i < 3; i++) { m.caja('maderaClara', -0.62, 0.15 + i * 0.22, 0.41, 0.34, 0.16, 0.01); m.caja('laton', -0.62, 0.15 + i * 0.22, 0.42, 0.08, 0.03, 0.02); } }
        m.caja('plano', 0.12, 0.795, 0.02, 0.95, 0.012, 0.64); { const [rx, rz] = m.mundo(0.15, -0.33); if (!Pz('rollos_planos', rx, rz, 0, 0.79, [0.95, 0.9, 0.6])) { m.caja('papel', -0.4, 0.83, -0.3, 0.75, 0.07, 0.07); m.caja('papel', -0.35, 0.83, -0.2, 0.7, 0.06, 0.06); } }   // N0-UTIL3 (G7): rollos de malla
        m.caja('papel', 0.68, 0.82, -0.2, 0.3, 0.05, 0.22); m.caja('rojo', 0.68, 0.85, -0.2, 0.22, 0.01, 0.16); m.cil('fierro', 0.6, 0.83, 0.28, 0.035, 0.08); lamparaMesa(m, -0.6, 0.79, -0.15);
        col(ex, y + 0.4, ez, 1.7, 0.8, 0.85); sillaV(ex, ez + 0.65, 2); }
      tablero(...Q(e(2.75), zf - 0.75), 2);   // N1-HAMILTON-c: junto a la ventana del frente (el oriente queda para el pie de la escalera)
      { const qx = xi1 - 0.3, qz = zb + 1.75, q = marco(J, qx, y, qz, 3); if (Pz('caja_fuerte', qx, qz, 3, 0, [1, 0.78, 0.92])) col(qx, y + 0.35, qz, 0.55, 0.7, 0.6); else { q.caja('fierro', 0, 0.35, 0, 0.6, 0.7, 0.55); q.caja('laton', 0, 0.45, 0.28, 0.14, 0.14, 0.02); q.caja('laton', 0, 0.2, 0.28, 0.2, 0.03, 0.02); col(qx, y + 0.35, qz, 0.55, 0.7, 0.6); } }   // caja fuerte (N0-UTIL3 G1: malla)
      { const mx = xi1 - 0.3, mz = zf - 1.25, m = marco(J, mx, y, mz, 3); if (!Pz('mueble_planos', mx, mz, 3, 0, [0.77, 1, 0.67])) { m.caja('madera', 0, 0.45, 0, 1.0, 0.9, 0.6); for (let i = 0; i < 5; i++) m.caja('maderaOsc', 0, 0.12 + i * 0.16, 0.301, 0.9, 0.11, 0.01);
        m.caja('papel', -0.2, 0.95, 0, 0.8, 0.08, 0.08); m.caja('papel', 0.1, 0.94, 0.1, 0.7, 0.07, 0.07); } col(mx, y + 0.45, mz, 0.6, 0.9, 1.0); }   // mueble de planos con rollos (N0-UTIL3 G1: malla)
      cuadroEn('plano', xi1 - 0.012, zf - 1.25, 3, 1.75, 1.0, 0.7); cuadroEn('cartel:BRADEN|COPPER CO.', e(5.55), zf - 0.012, 2, 1.7, 0.6, 0.6);
      // entrada: perchero de pie con sombrero y abrigo
      if (Pz('perchero', 1.15, zf - 0.45, 2)) col(1.15, y + 0.9, zf - 0.45, 0.4, 1.8, 0.4);
    } else {   // 2.º piso: dormitorio principal al poniente (biombo), cuarto chico al oriente (cortina), lavatorio de palangana y tina al fondo
      { const bx = w(-5.5), bz = zb + 1.0; cama(...Q(bx, bz), 0, 'colchaRoja'); velador(...Q(bx + 0.75, zb + 0.23)); baul(...Q(bx, zb + 2.32), 0); cuadroEn('foto3', bx, zb + 0.012, 0, 1.75, 0.34, 0.44); }
      J.caja('alfombra2', w(-5.5) + 1.05, y + 0.012, zb + 1.05, 0.8, 0.02, 1.5);
      if (!put('biombo_3hojas', w(-3.4) + 0.04, zb + 1.13, 1)) for (let i = 0; i < 3; i++) { const z = zb + 0.45 + i * 0.68, a = (i % 2 ? 0.22 : -0.22); J.caja('tapizVerde',   /* C1: biombo FINO de 3 hojas (bastidor torneado, paño tapizado) */ w(-3.4) + (i % 2 ? 0.08 : 0), y + 0.95, z, 0.03, 1.55, 0.66, a); J.caja('maderaOsc', w(-3.4) + (i % 2 ? 0.08 : 0), y + 0.1, z, 0.05, 0.2, 0.66, a); }   // biombo de 3 hojas
      col(w(-3.4) + 0.04, y + 0.85, zb + 1.13, 0.2, 1.7, 2.04);
      if (!Pz('ropero', xi0 + 0.3, zf - 1.35, 1)) ropero(...Q(xi0 + 0.3, zf - 1.35), 1); else col(xi0 + 0.3, y + 1, zf - 1.35, 0.55, 2, 1.0);   // 2,5 cm de holgura al muro
      { const lx = w(-5.5), lz = zf - 0.25; if (Pz('lavatorio', lx, lz, 2)) col(lx, y + 0.5, lz, 0.75, 1.0, 0.45); else lavamanos(...Q(lx, lz), 2); }
      sillaV(w(-4.75), zm - 0.6, 3); J.caja('piel', w(-4.9), y + 0.012, zm, 1.0, 0.02, 0.7);
      // centro, junto a las ventanas de la calle: mesita de costura con quinqué y 2 sillas; baúl bajo la ventana
      mesa(...Q(w(-2.1), zf - 0.75), 0.8, 0.55); lamparaMesa(marco(J, w(-2.1), y, zf - 0.75, 0), 0.2, 0.775); sillaV(w(-2.1) - 0.3, zf - 1.35, 0); sillaV(w(-2.1) + 0.5, zf - 1.35, 0);
      baul(...Q(e(2.1), zf - 0.32), 2);
      // cuarto chico al oriente, detrás de una cortina de lana colgada de una varilla
      // cuarto chico al oriente (N1-HAMILTON-c: catre a lo largo del muro del fondo, así queda un paso de 1,2 m entre el hueco y el catre hacia la llegada de la escalera),
      // cortina de lana en una varilla delante del catre; su baúl, contra el muro oriente del frente
      { const cx = e(5.35), cz = zb + 0.53; if (Pz('catre', cx, cz, 1)) col(cx, y + 0.3, cz, 1.95, 0.6, 0.85); else cama(...Q(cx, cz), 1, 'colchaAzul'); baul(...Q(xi1 - 0.27, zf - 1.75), 3); velaP(xi1 - 0.27, 0.5, zf - 1.95); }
      { const zr = zb + 1.12, x0 = e(4.3), x1 = xi1 - 0.03;
        if (!put('cortina_lana', (x0 + x1) / 2, zr, 0, y - UY, [(x1 - x0) / 2.5, 1, 1])) { J.caja('fierro', (x0 + x1) / 2, y + 2.2, zr, x1 - x0, 0.025, 0.025);   // C1b: cortina FINA de lana con franjas, varilla y argollas (G36); las tiras quedan de respaldo
        for (let x = x0 + 0.95, i = 0; x < x1 - 0.06; x += 0.16, i++) J.caja(i % 2 ? 'manta2' : 'colchaGris', x, y + 1.15, zr + (i % 2 ? 0.03 : -0.03), 0.18, 2.05, 0.03); }
        col((x0 + 0.95 + x1) / 2, y + 1.1, zr, x1 - x0 - 0.95, 2.2, 0.12); }
      // frente oriente: mecedora y mesita con vela junto a la ventana
      sillaV(e(5.4), zf - 1.1, 2); mesa(...Q(e(4.7), zf - 0.6), 0.5, 0.5); velaP(e(4.7), 0.78, zf - 0.6);
      // fondo: lavatorio de palangana y jarro entre ventanas, tina de lata, cama de niño con baúl
      { const lx = e(1.05), lz = zb + 0.24; if (Pz('lavatorio', lx, lz, 0)) col(lx, y + 0.5, lz, 0.75, 1.0, 0.45); else lavamanos(...Q(lx, lz), 0); }
      if (Pz('tina_lata', e(3.05), zb + 0.6, 0, 0, [1.08, 0.9, 1.15])) col(e(3.05), y + 0.23, zb + 0.6, 1.3, 0.45, 0.75);   // N0-UTIL3 (G1): tina de lata de malla
      else { const tg2 = new THREE.CylinderGeometry(0.5, 0.42, 0.45, 16, 1, true); tg2.scale(1.35, 1, 0.75); tg2.translate(e(3.05), y + 0.23, zb + 0.6); J.add('lata', tg2);
        J.add('lata', new THREE.CylinderGeometry(0.42, 0.42, 0.02, 16).scale(1.35, 1, 0.75).translate(e(3.05), y + 0.02, zb + 0.6)); col(e(3.05), y + 0.23, zb + 0.6, 1.3, 0.45, 0.75); }
      { const cx = e(-1.3), cz = zb + 0.53; if (Pz('catre', cx, cz, 1)) col(cx, y + 0.3, cz, 1.95, 0.6, 0.85); else cama(...Q(cx, cz), 1, 'frazada'); } baul(...Q(e(0.15), zb + 0.5), 1);   // catre bajo: no toca los alféizares   // cama de niño a lo largo del muro (el paso del fondo queda libre)
      // faroles colgados de los tirantes de las cerchas
      farolC(w(-4.6), zm, 2.55); farolC(e(4.6), zm - 0.2, 2.55); farolC(0, zf - 1.4, 2.55);
    }
  } else if (rol === 'abierta') {   // N1-INT1905b: planta abierta (u desde el muro poniente, d desde el muro del fondo; la puerta en u = uc, d = L)
    const dm = L * 0.5, yC = pl.techoA - 0.15, mA = Math.max(hp, pl.muroA || hp);
    // rincón de cocina (muro poniente): cocina de fierro con el cañón hasta el zinc, ollas, leña, tinaja, palangana, estante de greda, mesita
    cocinaLena(0.36, dm, 1); { const [cx, cz] = P(0.36, dm), m = marco(J, cx, y, cz, 1); m.cil('fierro', -0.35, (hp + yC) / 2, -0.2, 0.08, yC - hp + 0.2, 8); }
    lena(0.42, dm + 0.95, 1); { const [tx, tz] = P(0.4, dm - 1.0); tinaja(J, col, tx, y, tz); }
    lavamanos(0.4, dm - 1.8, 1); balde(1.05, dm - 1.15); estante(false, dm + 1.75, 1.45);
    for (const [du, dd, rr, hh] of [[0.95, -0.4, 0.16, 0.22], [1.0, 0.45, 0.12, 0.16]]) { const [ox, oz] = P(du, dm + dd); J.add(dd < 0 ? 'fierro' : 'cobre', new THREE.CylinderGeometry(rr, rr * 0.85, hh, 10).translate(ox, y + hh / 2, oz)); }
    mesa(0.75, dm + 1.75, 0.6, 0.9); tazas(0.75, dm + 1.65, 0.8);
    // mesa con bancas al centro, a lo largo hacia la puerta; jarro, mate, vela y candil
    mesa(uc, dm, 0.85, 1.9); bancaR(uc - 0.72, dm, 1.8, 1); bancaR(uc + 0.72, dm, 1.8, 1); tazas(uc - 0.1, dm - 0.45, 0.8);
    { const [vx, vz] = P(uc + 0.15, dm + 0.5); candil(J, vx, y + 0.79, vz); }
    // zona de dormir al fondo oriente: catres con la cabecera contra el muro, ropa en clavos, velador con vela, piel; biombo de tablas
    for (let i = 0; i < 3; i++) cama(Wr - 1.0, 0.5 + i * 1.1, 3, E.colcha);
    ropaClavos(true, 1.6); velador(Wr - 2.3, 0.45); alfombraChica(Wr - 2.45, 1.7, 1.0, 0.7); zapatos(Wr - 2.3, 2.6);
    { const [bx, bz] = P(Wr - 1.1, 3.5); if (!put('biombo_tablas', bx, bz, 0)) { J.caja('maderaVieja', bx, y + 0.95, bz, 2.1, 1.5, 0.04); for (const k of [-1, 0, 1]) J.caja('vigas', bx + k * 0.98, y + 0.87, bz, 0.07, 1.74, 0.07);   // C1: biombo de tablas FINO
      for (const k of [-1, 1]) J.caja('vigas', bx + k * 0.98, y + 0.03, bz, 0.07, 0.06, 0.45); } col(bx, y + 0.85, bz, 2.1, 1.7, 0.12); }
    // fondo: bodega de sacos (poniente), baúl con vela y brasero
    sacos(0.95, 1.05, 4); baul(uc - 0.4, 0.32, 0); { const [vx, vz] = P(uc - 0.4, 0.32); vela(J, vx, y + 0.5, vz, true); } brasero(uc + 0.9, 0.95);
    // junto a la puerta: al oriente el rincón de herramientas y leña (barreta, combo, pala, tronco de picar con hacha, saco de carbón); al poniente tinaja y mantas
    { const [hx, hz] = P(Wr - 1.45, L - 0.12); herramientas(J, hx, y, hz, 0, kHacia, P(Wr - 1.45, L - 0.2)); }   // C1b: muro del fondo de la pieza (hacia +s)
    lena(Wr - 0.42, L - 0.45, 1); lena(Wr - 0.42, L - 1.15, 1);
    { const [tx, tz] = P(Wr - 1.55, L - 1.35); if (put('tronco_picar', tx, tz, kHacia + 1)) col(tx, y + 0.25, tz, 0.5, 0.5, 0.5); else { J.add('maderaVieja', new THREE.CylinderGeometry(0.22, 0.24, 0.45, 12).translate(tx, y + 0.225, tz)); J.add('vigas', new THREE.CylinderGeometry(0.2, 0.2, 0.01, 12).translate(tx, y + 0.455, tz));
      const mg = new THREE.CylinderGeometry(0.018, 0.018, 0.75, 6); mg.rotateZ(0.9); mg.translate(tx + 0.12, y + 0.62, tz); J.add('maderaVieja', mg); J.caja('fierro', tx - 0.12, y + 0.47, tz, 0.05, 0.12, 0.16); col(tx, y + 0.25, tz, 0.5, 0.5, 0.5); } }   // G9M: tronco de picar con hacha (malla G10)
    sacos(Wr - 0.55, L - 2.1, 2);
    { const [tx, tz] = P(uc - 1.3, L - 0.4); tinaja(J, col, tx, y, tz); }
    { const [mx, mz] = P(uc - 2.2, L - 0.03); const m = marco(J, mx, y, mz, 2); m.caja('maderaVieja', 0, 1.62, -0.02, 0.8, 0.08, 0.03); for (let i = 0; i < 3; i++) m.caja('fierro', -0.27 + i * 0.27, 1.62, -0.06, 0.012, 0.012, 0.07);
      m.caja('manta', -0.2, 1.27, -0.07, 0.34, 0.65, 0.03); m.caja('manta2', 0.15, 1.3, -0.08, 0.3, 0.6, 0.03); }
    // faroles de parafina colgados de los tirantes: sobre la mesa, la zona de dormir y la cocina
    const [fx, fz] = P(uc, dm); farol(J, Math.round(fx / 2.3) * 2.3, mA - 0.2, fz);
    if (X > 2.6) { farol(J, 2.3, mA - 0.2, zc + 1.6); farol(J, -2.3, mA - 0.2, zc + dm - 0.6); }
  } else if (rol === 'cocinaP') {   // N1-INT1905: cocina del rancho de piedra: cocina de fierro a leña con ollas colgadas, mesa rústica con bancas, vela y mate, tinaja, leña
    cocinaLena(0.75, L - 0.42, kHacia); lena(1.65, L - 0.32, 0);
    const lm = Math.min(1.2, L - 1.3), dm = L - 0.55 - lm / 2; mesa(Wr - 0.5, dm, 0.72, lm); bancaR(Wr - 1.12, dm, lm, 1); tazas(Wr - 0.5, dm, 0.8);
    { const [tx, tz] = P(0.35, 0.55); tinaja(J, col, tx, y, tz); } balde(0.35, 1.15); ropaClavos(false, 1.6);
    if (Wr > 3.4) estante(true, 0.6, 1.5);
  } else if (rol === 'dormP') {   // pieza: catre de fierro (o camastros) con frazadas y pieles, baúl con vela, brasero, ropa en clavos
    if (Wr >= 3.4 && r() < 0.5) { cama(0.55, L - 1.05, 0, E.colcha, false, 'maderaVieja'); cama(Wr - 0.55, L - 1.05, 0, E.colcha); baul(uc, L - 0.35, 0); { const [vx, vz] = P(uc, L - 0.35); vela(J, vx, y + 0.5, vz); } }
    else { cama(Wr - 1.08, L - 0.5, 1, E.colcha); baul(0.55, L - 0.35, 0); { const [vx, vz] = P(0.55, L - 0.35); vela(J, vx, y + 0.5, vz, true); } if (Wr > 3) brasero(0.45, 1.2); }
    ropaClavos(r() < 0.5, 1.0); alfombraChica(uc, L - 1.4, 1.0, 0.7); zapatos(Wr - 0.45, 0.4); cordel(Math.min(2.0, L - 0.6));
  } else if (rol === 'bodegaP') {   // bodega: sacos de harina y papas, leña, herramientas del minero, tinaja, candil colgado
    sacos(Wr - 0.7, L - 0.45, 4); lena(0.55, L - 0.35, 0); herram(false, 1.2); { const [tx, tz] = P(Wr - 0.35, 0.55); tinaja(J, col, tx, y, tz); }
    { const [kx, kz] = P(uc, L - 0.05); candil(J, kx, y + 1.55, kz - s * 0.08); J.caja('fierro', kx, y + 1.6, kz, 0.012, 0.012, 0.1); }
    estante(true, 1.5, 1.3); balde(0.4, 0.45);
  } else if (rol === 'oficina' || rol === 'jefe') {
    escritorio(Wr / 2, L - 1.0, kHacia); archivador(0.4, L - 0.4, kHacia); if (Wr > 2.6) archivador(Wr - 0.4, L - 0.4, kHacia);
    cuadroFondo('plano', Wr / 2, 1.8, 1.4, 0.9);
    if (rol === 'jefe') { const [ax, az] = P(Wr / 2, L / 2); J.caja('alfombra', ax, y + 0.012, az, Math.min(Wr - 0.6, 2.2), 0.02, 1.6); fotos(1, 0.6, 1.2); }
    cartelPared(pl.epoca >= 1945 ? 'SEGURIDAD|E HIGIENE|INDUSTRIAL' : 'BRADEN|COPPER CO.', 0.5, L); calendario(false, 1.3); retrato(true, 1.2, 1.7); ropaSilla(0.4, 1.9, 1);
  } else if (rol === 'dibujo' && p.amplio) {   // N0-INT-AMPLIO: 1 o 2 tableros de dibujo junto a la fachada, archivador contra el tabique cerca de la entrada (lejos de los tableros)
    if (Wr >= 4.6) { tablero(Wr * 0.3, L - 1.5, kHacia); tablero(Wr * 0.7, L - 1.5, kHacia); } else tablero(uc, L - 1.5, kHacia);
    archivador(Wr - 0.4, Math.min(1.25, L - 2.6), 3); calendario(false, 1.3); retrato(true, Math.min(2.4, L - 2.2), 1.7); cuadroFondo('plano', 0.9, 1.8, 0.8, 0.55);
  } else if (rol === 'dibujo') { tablero(Wr / 2, L - 1.5, kHacia); if (Wr > 3.6) tablero(Wr / 2 + 1.5 > Wr - 0.7 ? 0.8 : Wr / 2 + 1.5, L - 1.5, kHacia); archivador(Wr - 0.4, 2.4, 3); calendario(false, 1.3); retrato(true, 1.2, 1.7); cuadroFondo('plano', 0.9, 1.8, 0.8, 0.55); }
  else if (rol === 'archivo') { for (let u = 0.4; u < Wr - 0.3; u += 0.62) archivador(u, L - 0.4, kHacia); mesa(0.6, 2.4, 0.7, 1.4); calendario(true, 1.3); cuadroLado(true, 'cartel:EXTINTOR|EN CADA|PASILLO', 2.8, 1.6, 0.5, 0.5); }
}

// ------------------------------------------------------------------ vecinos, recuerdos (coleccionables) y textos del libro
const RECOGIDOS = new Set();   // por partida: lo recogido no vuelve a aparecer al entrar otra vez
function poblar(M, sala, pl, r, O) {
  const T = (pl.epoca < 1915 && TEXTOS[pl.tipo + '1905']) || TEXTOS[pl.tipo], ps = sala.piezas.filter(p => p.x1 - p.x0 > 2 && Math.abs(p.zo - p.zc) > 2.2); if (!ps.length) return;
  if (sala.abierta) return poblarAbierta(M, sala, pl, r, O, T);   // N1-INT1905b
  const centro = (p, frac, dx) => { const s = p.lado === 'F' ? 1 : -1, d = Math.abs(p.zo - p.zc); return { x: O.x + (p.pu ?? (p.x0 + p.x1) / 2) + dx, y: O.y + p.f * pl.hp, z: O.z + p.zc + s * d * frac }; };
  // vecino: en una pieza del 1.er o 2.º piso (no en el pasillo: no estorba el recorrido)
  // UTIL-T0: NPC y recuerdo en un punto LIBRE de la pieza (≥ 0,6 m de cualquier mueble y de los muros, lejos de la puerta/escalera); antes iban a un punto fijo y caían dentro del sofá
  const OB = [...(sala.obst || [])];
  { const bb = new THREE.Box3(), im = new THREE.Matrix4(); sala.grupo.traverse(o => { if (!o.isInstancedMesh || !o.userData.util || o.userData.util.lod) return;   // también las mallas de utilería (sillas, camas…: no tienen caja de colisión propia)
      o.geometry.computeBoundingBox(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, im); bb.copy(o.geometry.boundingBox).applyMatrix4(im);
        OB.push([(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2, bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z]); } }); }
  const libre = (p, q0, hueco, evitar = []) => {
    if (/[?&]npclibre=0/.test(location.search)) return q0;   // interruptor para comparar con el punto fijo de antes
    const lo = Math.min(p.zc, p.zo), hi = Math.max(p.zc, p.zo), y0 = p.f * pl.hp, bx = OB.filter(b => b[1] > y0 - 0.05 && b[1] < y0 + pl.hp - 0.3);
    const dist = (x, z) => { let m = 9; for (const [bx_, , bz, sx, , sz] of bx) m = Math.min(m, Math.hypot(Math.max(Math.abs(x - bx_) - sx / 2, 0), Math.max(Math.abs(z - bz) - sz / 2, 0))); for (const [ex, ez] of evitar) m = Math.min(m, Math.hypot(x - ex, z - ez) - 0.3); return m; };
    let mejor = null;
    for (let x = p.x0 + 0.55; x <= p.x1 - 0.55 + 1e-6; x += 0.2) for (let z = lo + 0.55; z <= hi - 0.55 + 1e-6; z += 0.2) {
      if (Math.abs(z - p.zc) < 1.0 && Math.abs(x - (p.pu ?? -999)) < 0.9) continue;   // delante de la puerta de la pieza
      const d = dist(x, z); if (d < hueco) continue; const sc = Math.hypot(x - (q0.x - O.x), z - (q0.z - O.z)); if (!mejor || sc < mejor.sc) mejor = { x, z, sc };
    }
    if (!mejor) for (let x = p.x0 + 0.4; x <= p.x1 - 0.4; x += 0.2) for (let z = lo + 0.4; z <= hi - 0.4; z += 0.2) { const d = dist(x, z); if (!mejor || d > mejor.d) mejor = { x, z, d, sc: 0 }; }   // sin hueco de 0,6: el más despejado
    return mejor ? { ...q0, x: O.x + mejor.x, z: O.z + mejor.z } : q0;
  };
  let npcP = null;
  if (r() < 0.8) { const c = ps.filter(p => p.f <= 1), p = c[(r() * c.length) | 0] || ps[0], q = libre(p, centro(p, 0.5, -1.1), 0.6); npcP = [q.x - O.x, q.z - O.z];
    crearEntidad(M, { t: 'npc', quien: T.npc[0], x: q.x, y: q.y, z: q.z, texto: T.npc[1], sala: sala.id, ySala: true }); }
  // recuerdo del reportaje en una pieza de un piso alto (premia subir la escalera)
  const clave = sala.id + ':' + pl.semilla;
  if (!RECOGIDOS.has(clave)) { const c = ps.filter(p => p.f === pl.pisos - 1), p = c[(r() * c.length) | 0] || ps[ps.length - 1], q = libre(p, centro(p, 0.3, 0.6), 0.45, npcP ? [npcP] : []), [tipo, texto] = T.recuerdos[(r() * T.recuerdos.length) | 0];
    recuerdo(M, sala, q, tipo, texto, clave); }
  // textos del libro: cuadros con burbuja junto a la escalera de cada piso y en alguna pieza
  const notas = [...T.notas, ...(pl.epoca >= 1945 && T.notas1945 ? T.notas1945 : [])], es = sala.escalera;
  for (let f = 0; f < Math.min(pl.pisos, notas.length + 1); f++) {
    const html = notas[(f + pl.semilla) % notas.length], pos = new THREE.Vector3(O.x + es.xs0 + 0.3, O.y + f * pl.hp + 1.2, O.z + (es.bA0 + es.bA1) / 2);
    const e = M.L.agregar({ tipo: 'nota', vivo: true, sala: sala.id, act: () => M.burbujaCerca(e, pos, 1.8, html) });
  }
}
function poblarAbierta(M, sala, pl, r, O, T) {
  const A = sala.abierta, W = q => ({ x: O.x + q.x, y: O.y + q.y, z: O.z + q.z });
  if (r() < 0.8) { const q = W(A.npc); crearEntidad(M, { t: 'npc', quien: T.npc[0], x: q.x, y: q.y, z: q.z, texto: T.npc[1], sala: sala.id, ySala: true }); }
  const clave = sala.id + ':' + pl.semilla;
  if (!RECOGIDOS.has(clave)) { const [tipo, texto] = T.recuerdos[(r() * T.recuerdos.length) | 0]; recuerdo(M, sala, W(A.recuerdo), tipo, texto, clave); }
  const notas = [...T.notas, ...(pl.epoca >= 1945 && T.notas1945 ? T.notas1945 : [])];
  A.notas.forEach((q, i) => { const html = notas[(i + pl.semilla) % notas.length], w = W(q), pos = new THREE.Vector3(w.x, w.y, w.z);
    const e = M.L.agregar({ tipo: 'nota', vivo: true, sala: sala.id, act: () => M.burbujaCerca(e, pos, 1.8, html) }); });
}
// N1-INT1905: el halo del recuerdo era un Sprite sin textura (un cuadrado amarillo translúcido): ahora es un brillo redondo
const texHalo = () => lienzo('halo', 64, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
function recuerdo(M, sala, q, tipo, texto, clave) {
  const g = new THREE.Group(), S = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mt(m)); o.position.set(x, y, z); g.add(o); return o; };
  // UTIL-T0: coleccionables con malla de la utilería (balanza, jarro enlozado, lámpara de carburo; la de queroseno de Hamilton es el quinqué fino de 1905) y pedestal de cajón;
  // un solo hijo que gira (g.children[0]); ×1,2 sobre la medida real para que se lea como objeto a recoger. Sin pieza: los de siempre.
  const mU = tipo === 'balanza' ? piezaGrupo('balanza', [1.2, 1.2, 1.2]) : tipo === 'jarro' ? piezaGrupo('jarro', [1.2, 1.2, 1.2])
    : tipo === 'lampara' ? (/queroseno/i.test(texto) ? piezaGrupo('quinque', [1.2, 1.2, 1.2]) : piezaGrupo('carburo', [1.2, 1.2, 1.2]))
    : tipo === 'mate' ? piezaGrupo('mate', [1.2, 1.2, 1.2]) : tipo === 'picaporte' ? piezaGrupo('picaporte', [1.5, 1.5, 1.5]) : null;   // N0-UTIL3 (G7): mate y picaporte de malla
  if (mU) g.add(mU);
  else if (tipo === 'balanza') { S(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16), 'celeste', 0, 0.3); S(new THREE.BoxGeometry(0.18, 0.25, 0.1), 'celeste', 0, 0.15); S(new THREE.CircleGeometry(0.07, 16), 'blanco', 0, 0.17, 0.051); }
  else if (tipo === 'jarro') { S(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 14), 'enlozado', 0, 0.1); S(new THREE.TorusGeometry(0.05, 0.012, 6, 12), 'enlozado', 0.09, 0.11); }
  else if (tipo === 'picaporte') { S(new THREE.SphereGeometry(0.05, 10, 8), 'laton', 0, 0.12); S(new THREE.BoxGeometry(0.05, 0.16, 0.02), 'laton', 0, 0.12, -0.04); }
  else if (tipo === 'banderin') { S(new THREE.CylinderGeometry(0.008, 0.008, 0.4), 'madera', 0, 0.2); const b = S(new THREE.PlaneGeometry(0.22, 0.14), 'rojo', 0.11, 0.32); b.material = mt('rojo');
    const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil('banderin'); if (t) b.material = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }); }); }   // N0-UTIL3 (P3): banderín de Qwen
  else if (tipo === 'candil') { S(new THREE.CylinderGeometry(0.06, 0.07, 0.09, 12), 'lata', 0, 0.05); S(new THREE.CylinderGeometry(0.01, 0.014, 0.08, 6), 'lata', 0.05, 0.12); S(new THREE.SphereGeometry(0.02, 6, 5), 'llama', 0.055, 0.18); }
  else if (tipo === 'mate') { S(new THREE.SphereGeometry(0.07, 12, 10), 'greda', 0, 0.08); S(new THREE.CylinderGeometry(0.006, 0.006, 0.16), 'laton', 0.02, 0.17); }
  else if (tipo === 'lampara') { S(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 10), 'laton', 0, 0.09); S(new THREE.SphereGeometry(0.035, 8, 6), 'foco', 0, 0.2, 0.05); }
  else { const o = S(new THREE.BoxGeometry(0.24, 0.02, 0.16), tipo === 'plano' ? 'plano' : 'papel', 0, 0.06);
    if (tipo === 'carta' || tipo === 'tarjeta') { const pu = precargarUtileria(); if (pu) pu.then(() => { const t = texUtil(tipo); if (t) o.material = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }); }); } }   // N0-UTIL3 (P3): carta y postal de Qwen
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo(), color: 0xffd890, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(0.9, 0.9, 1); halo.position.y = 0.15; g.add(halo);
  const pedU = piezaGrupo('pedestal', [0.5 / 0.6, 0.7 / 0.8, 0.4 / 0.5]);   // UTIL-T0: cajón de madera con paño (0,6×0,8×0,5 m) escalado a la mesita de 0,5×0,7×0,4
  if (pedU) { pedU.position.y = -0.7; g.add(pedU); }
  else { const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.4), mt('maderaOsc')); pedestal.position.y = -0.35; g.add(pedestal); }   // mesita
  g.position.set(q.x, q.y + 0.7, q.z);
  const e = M.L.agregar({ tipo: 'recuerdo', vivo: true, sala: sala.id, malla: g, act: () => {
    g.children[0].rotation.y += 0.01; halo.material.opacity = 0.35 + Math.sin(M.t * 3) * 0.12;
    if (M.cerca(new THREE.Vector3(g.position.x, g.position.y + 0.2, g.position.z), 1.3)) {
      RECOGIDOS.add(clave); if (P) P.puntos += 250; M.efecto('apunte'); M.aviso('Recuerdo de Sewell: ' + texto + ' (+250)', 4200); M.L.quitar(e);
    } } });
}
