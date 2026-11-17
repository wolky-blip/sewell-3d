// Terreno de Sewell: ladera sur del Cerro Negro en cuatro terrazas (axonometría de Diego), quebrada al sur,
// hombro poniente del Cerro Negro (Nivel 1) con el barranco del andarivel, y cerros a los lados.
// Ejes: X al oriente, Y arriba, Z al sur (hacia la vía y el valle). t = -z es la distancia ladera arriba.
import * as THREE from 'three';

// perfil de la ladera central: (t, altura). 0 m = andén de la estación (~2.140 msnm)
const PERFIL = [[-260, -48], [-70, -8], [-40, 0], [15, 0], [120, 58], [165, 62], [270, 124], [325, 128], [460, 208], [525, 214], [700, 300], [950, 440]];
function perfil(t) {
  if (t <= PERFIL[0][0]) return PERFIL[0][1];
  for (let i = 1; i < PERFIL.length; i++) {
    const [t1, y1] = PERFIL[i], [t0, y0] = PERFIL[i - 1];
    if (t <= t1) return y0 + (y1 - y0) * (t - t0) / (t1 - t0);   // lineal: la escalera central va pegada al cerro
  }
  return PERFIL[PERFIL.length - 1][1];
}
const suaveEscalon = (a, b, v) => { const f = Math.min(1, Math.max(0, (v - a) / (b - a))); return f * f * (3 - 2 * f); };
// Ladera natural (Nivel 1, 1905: todavía no hay ciudad). El perfil lineal con las terrazas planas de la ciudad dejaba
// quiebres rectos de lado a lado sobre la estación («corte recto de la escalera central»): aquí el perfil se suaviza
// y las curvas de nivel se ondulan con x. Lo activa construirNivel según el nivel.
export const LADERA = { natural: false };
const NUCLEO = [0.05, 0.09, 0.12, 0.15, 0.18, 0.15, 0.12, 0.09, 0.05];   // promedio con forma de campana
function perfilNatural(t, x) {
  const lejos = suaveEscalon(25, 110, t);   // junto a la estación y la vía el perfil queda igual (andén plano)
  if (lejos <= 0) return perfil(t);
  const tt = t + lejos * (16 * Math.sin(x * 0.012 + 0.7) + 7 * Math.sin(x * 0.034 + 2.1));   // curvas de nivel onduladas
  const r = 55 * lejos; let y = 0;
  for (let i = 0; i < 9; i++) y += NUCLEO[i] * perfil(tt + (i - 4) / 4 * r);
  return y;
}
// quiebre suave (softplus): el hombro poniente y el flanco oriente empezaban en una línea recta a x = ±230
const rampaSuave = (v, s) => v > 8 * s ? v : s * Math.log1p(Math.exp(v / s));

// barranco del Nivel 1 (lo cruza el andarivel de Hamilton): eje x = -300, entre t 170 y 430
export const BARRANCO = { x: -300, t0: 170, t1: 430, mitad: 20, hondo: 30 };
// eje serpenteante (era una zanja recta y larga detrás del pueblo); en t = 300, donde cruza el andarivel, queda en x = -300
// (el serpenteo se apaga a ±40 m del andarivel: corrido 1-2 m hacia el andén A, el borde del barranco quedaba bajo el andén)
export const ejeBarranco = t => BARRANCO.x + (9 * Math.sin((t - 300) * 0.03) + 4 * Math.sin((t - 300) * 0.071)) * suaveEscalon(0, 40, Math.abs(t - 300));
export function enBarranco(x, z) {
  const t = -z, B = BARRANCO;
  return t > B.t0 + 8 && t < B.t1 - 8 && Math.abs(x - ejeBarranco(t)) < B.mitad - 4;
}

// Cerros propios de cada nivel (los pone construirNivel): una colina suave cortada en un frente vertical donde entra un túnel.
// corte: { eje: 'x' | 'z', valor, lado: +1 | -1 } → la colina existe solo del lado indicado del corte.
export const CERROS = [];
export function alturaCerro(c, x, z) {
  if (c.corte) { const v = c.corte.eje === 'x' ? x : z; if ((v - c.corte.valor) * c.corte.lado < 0) return 0; }
  const d2 = ((x - c.x) ** 2 + (z - c.z) ** 2) / (c.r * c.r);
  if (d2 > 4) return 0;
  return c.h * Math.exp(-d2 * 1.3) * (1 + 0.08 * Math.sin(x * 0.31 + z * 0.17) + 0.05 * Math.sin(x * 0.07 - z * 0.23));
}
// Terrazas: cada edificio aplana el suelo bajo su planta (corta arriba y rellena abajo, a media altura) con una transición suave.
// Así se ve como Sewell, con los edificios sobre terrazas del cerro, y no sobre podios gigantes (pedido de Diego, 12-11-2026).
export const TERRAZAS = [];
const suave01 = f => f * f * (3 - 2 * f);
// MOVIL (M-MOVIL-CARGA, 16-11-2026): índice en grilla de las terrazas. aplicarTerrazas recorría TODAS las terrazas en cada llamada
// a altura() (terreno, física, utilería, gente): era el 45 % de la CPU al cargar un nivel (6,3 s de 22 con la CPU de un celular).
// La grilla solo entrega las terrazas cuyo cuadrado de radio r toca la celda, en el MISMO orden del arreglo (los empates se resuelven
// igual): el resultado es idéntico. Se rehace sola si TERRAZAS cambia (length = 0 al construir un nivel; push agrega al final).
const GT = { n: -1, a: null, b: null, celdas: new Map(), glob: [], C: 24 };
const VACIA = [];
function indiceTerrazas() {
  const L = TERRAZAS, n = L.length;
  if (GT.n === n && GT.a === L[0] && GT.b === L[n - 1]) return;
  let desde = 0;
  if (GT.n > 0 && n > GT.n && GT.a === L[0] && L[GT.n - 1] === GT.b) desde = GT.n; else { GT.celdas.clear(); GT.glob = []; }
  for (let i = desde; i < n; i++) {
    const t = L[i];
    if (!(t.r < 400) || !Number.isFinite(t.x) || !Number.isFinite(t.z)) { GT.glob.push(i); continue; }   // vía (r = 1e6) y casos raros: en todas las celdas
    const C = GT.C, x0 = Math.floor((t.x - t.r) / C), x1 = Math.floor((t.x + t.r) / C), z0 = Math.floor((t.z - t.r) / C), z1 = Math.floor((t.z + t.r) / C);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const k = cx * 100003 + cz, l = GT.celdas.get(k); if (l) l.push(i); else GT.celdas.set(k, [i]); }
  }
  GT.n = n; GT.a = L[0]; GT.b = L[n - 1];
}
function aplicarTerrazas(x, z, y) {
  let mejor = 0, yt = 0, sw = 0, sy = 0;
  const nat = LADERA.natural;   // 1905: donde se pisan las transiciones de dos terrazas se mezclan sus cotas (antes gana la más fuerte y entre las casas de piedra quedaba un escalón de varios metros)
  indiceTerrazas();
  const A = GT.celdas.get(Math.floor(x / GT.C) * 100003 + Math.floor(z / GT.C)) || VACIA, B = GT.glob;
  for (let ia = 0, ib = 0; ia < A.length || ib < B.length;) {
    const t = TERRAZAS[ib >= B.length || (ia < A.length && A[ia] < B[ib]) ? A[ia++] : B[ib++]];   // MOVIL: las dos listas en orden de índice
    const dx = x - t.x, dz = z - t.z;
    if (Math.abs(dx) > t.r || Math.abs(dz) > t.r) continue;
    if (t.corte && y <= t.y) continue;
    if (t.relleno && y >= t.y) continue;   // relleno bajo una losa: solo sube el suelo hasta ella, nunca lo corta   // trinchera de la vía: solo corta el cerro, no rellena (ahí la vía va en su terraplén)
    const lx = dx * t.c + dz * t.s, lz = -dx * t.s + dz * t.c;
    // mx: transición más corta a lo largo (la trinchera termina de golpe tras el muro del portal del túnel)
    const ex = Math.max(0, Math.abs(lx) - t.hx) * (t.mx ? t.m / t.mx : 1), ez = Math.max(0, Math.abs(lz) - t.hz), d = Math.hypot(ex, ez);
    if (d >= t.m) continue;
    const w = suave01(1 - d / t.m) + (t.prioridad ? 0.001 : 0);   // la franja de la vía gana a las terrazas de los edificios
    // rampa (escaleras): la altura va de y0 a y1 a lo largo (lz de -hz a +hz), para que el terreno siga la escalera
    const yi = t.y1 == null ? t.y : t.y + (t.y1 - t.y) * Math.min(1, Math.max(0, (lz + t.hz) / (2 * t.hz)));
    if (nat) { const wp = t.peso ? w * (1 + (t.peso - 1) * suave01(Math.max(0, 1 - d / 5))) : w; sw += wp; sy += wp * yi; }   // peso: terraza que manda sobre las vecinas al mezclar (panadería de 1905, N1-C59)
    if (w > mejor) { mejor = Math.min(1, w); yt = yi; }
  }
  if (nat && sw > 1e-9) yt = sy / sw;
  return mejor > 0 ? y + (yt - y) * mejor : y;
}
// Sewell en cono (?sewell=cono, carril ciudad, js/mundo/ciudad.js): perfil propio por nivel y marco girado temporal
// (edificios girados de ciudadObras.js: mientras se arman, altura() recibe coordenadas locales). Sin la bandera no hace nada.
export const CONO = { perfil: null, marco: null };
export function altura(x, z) {
  if (CONO.marco) { const m = CONO.marco, dx = x - m.x, dz = z - m.z; x = m.x + dx * m.c + dz * m.s; z = m.z - dx * m.s + dz * m.c; }
  return TERRAZAS.length ? aplicarTerrazas(x, z, alturaBase(x, z)) : alturaBase(x, z);
}
export function alturaBase(x, z) {
  const t = -z, nat = LADERA.natural;
  let y = nat ? perfilNatural(t, x) : CONO.perfil ? CONO.perfil(t, x, perfil) : perfil(t);
  for (const c of CERROS) y += alturaCerro(c, x, z);
  // hombro poniente (Cerro Negro de 1905): sube suave; más allá, cerro empinado
  if (nat) y += rampaSuave(-x - 230, 18) * 0.22 + rampaSuave(-x - 520, 25) * 0.6;
  else if (x < -230) y += (-x - 230) * 0.22 + Math.max(0, -x - 520) * 0.6;
  // flanco oriente: cerro
  if (nat) y += rampaSuave(x - 230, 18) * 0.48;
  else if (x > 230) y += (x - 230) * 0.48;
  // la quebrada del valle al sur se abre hacia los lados
  // (con transición suave: el corte en t = -60 dejaba un surco recto a lo largo de la vía, visible tras el portal este)
  if (t < -40) y -= rampaSuave(Math.abs(x) - 300, 20) * 0.05 * suaveEscalon(-40, -110, t);
  // barranco
  const B = BARRANCO;
  if (t > B.t0 - 30 && t < B.t1 + 30) {
    const lado = 1 - suaveEscalon(B.mitad - 6, B.mitad + 10, Math.abs(x - ejeBarranco(t)));
    const largo = suaveEscalon(B.t0 - 30, B.t0 + 10, t) * (1 - suaveEscalon(B.t1 - 10, B.t1 + 30, t));
    y -= B.hondo * lado * largo;
  }
  // relieve suave (menos dentro de la ciudad)
  const fuera = Math.min(1, Math.max(0, (Math.abs(x) - 190) / 60) + Math.max(0, (t - 540) / 60) + Math.max(0, (-t - 50) / 40));
  y += (Math.sin(x * 0.045 + z * 0.02) * 1.1 + Math.sin(z * 0.06 - x * 0.013) * 0.9 + Math.sin((x + z) * 0.17) * 0.25) * (0.25 + 0.75 * fuera);
  y += fuera * (Math.sin(x * 0.011) * Math.cos(z * 0.009) * 9);
  // flanco oriente lejos de la ciudad: espolones y quebradas que bajan por la ladera (cresta «ridged» que varía con z).
  // Desde el campamento se veía como una ladera lisa enorme, café y con bruma (no parecía sierra)
  if (x > 260) {
    const f = Math.min(1, (x - 260) / 220), rid = v => 1 - Math.abs(Math.sin(v));
    y += f * (34 * Math.pow(rid(z * 0.017 + 0.9 * Math.sin(x * 0.006)), 2) + 14 * Math.pow(rid(z * 0.041 - x * 0.012 + 1.3), 2)
      + 9 * Math.sin(x * 0.029 + z * 0.013) - 16);
  }
  return y;
}

// texturas de suelo de H3-Image (assets3d/texturas): tierra, roca en pendientes y nieve en lo alto, en coordenadas de mundo
const cargador = new THREE.TextureLoader();
const TEX = {};
function tex(n) {
  if (!TEX[n]) { const t = cargador.load(`assets3d/texturas/${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; TEX[n] = t; }
  return TEX[n];
}
// material con textura en coordenadas de mundo (plazas, zócalos, base de la escalera): no depende de las UV de la caja
// (nombre: archivo de assets3d/texturas o una textura ya hecha, p. ej. la sillería dibujada en un canvas)
// N3-C12 (carril codigo): factor de la «luz propia» de matMundo y del terreno; la memoria de 1945 (de noche) lo baja (principal.js)
export const LUZ_PROPIA = { value: 1 };
export function matMundo(nombre, escala = 4, color = 0xffffff, opc = {}) {   // opc.lejos = [d0, d1]: desde d0 a d1 m de la cámara la textura se funde al color medio (moiré lejano); opc.mezcla: parte de una segunda escala (÷3,1)
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  m.onBeforeCompile = sh => {
    sh.uniforms.tMundo = { value: typeof nombre === 'string' ? tex(nombre) : nombre };
    // escala como uniform: three reutiliza el programa de todos los matMundo (mismo onBeforeCompile) y con la escala
    // escrita en el código todos quedaban con la del primero que se compilaba
    sh.uniforms.escalaMundo = { value: escala };
    sh.uniforms.lejosMundo = { value: new THREE.Vector2(...(opc.lejos || [1e8, 2e8])) }; sh.uniforms.mezclaMundo = { value: opc.mezcla || 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo2; varying vec3 vNorm2;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMundo2 = (modelMatrix * vec4(transformed, 1.0)).xyz; vNorm2 = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tMundo; uniform float escalaMundo, mezclaMundo; uniform vec2 lejosMundo; varying vec3 vMundo2; varying vec3 vNorm2;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 an = abs(vNorm2); an /= (an.x + an.y + an.z);
        // N1-RENDIMIENTO (carril render, 15-11): se lee la textura solo donde pesa (proyección con peso > 0,2 %, y no pasado el fundido
        // lejano, donde ya era gris 0,62 entero: la cordillera). Mismo resultado; derivadas fuera de los «if» (textureGrad).
        float fLejos = smoothstep(lejosMundo.x, lejosMundo.y, length(vViewPosition));
        vec3 dMx = dFdx(vMundo2), dMy = dFdy(vMundo2), tx = vec3(0.62);
        #define TM(p, dx, dy, e) textureGrad(tMundo, (p) / (e), (dx) / (e), (dy) / (e)).rgb
        #define TRIM(e) ((an.x > 0.002 ? TM(vMundo2.zy, dMx.zy, dMy.zy, e) * an.x : vec3(0.0)) + (an.y > 0.002 ? TM(vMundo2.xz, dMx.xz, dMy.xz, e) * an.y : vec3(0.0)) + (an.z > 0.002 ? TM(vMundo2.xy, dMx.xy, dMy.xy, e) * an.z : vec3(0.0)))
        if (fLejos < 1.0 || ${SUELO_VIEJO ? 'true' : 'false'}) {
          tx = TRIM(escalaMundo);
          if (mezclaMundo > 0.0) tx = mix(tx, TRIM(escalaMundo / 3.1), mezclaMundo);
          tx = mix(tx, vec3(0.62), fLejos);
        }
        diffuseColor.rgb *= tx * 1.15;`)
      // un poco de luz propia: con el sol bajo (N2) los muros de terraza, zócalos y sillería en sombra se veían casi negros
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.14 * luzPropia;');
    sh.uniforms.luzPropia = LUZ_PROPIA; sh.fragmentShader = 'uniform float luzPropia;\n' + sh.fragmentShader;   // N3-C12: de noche se apaga
  };
  return m;
}
// N1-C49: volúmenes donde el suelo no se dibuja (boca de los túneles del tren): la malla del terreno tiene vértices cada 5 m
// y dentro del arco subía como un bloque de tierra hasta media altura. Hasta 4 cajas [min, max]; se llenan al construir el nivel
export const HUECOS = { min: [0, 1, 2, 3].map(() => new THREE.Vector3(1e9, 1e9, 1e9)), max: [0, 1, 2, 3].map(() => new THREE.Vector3(-1e9, -1e9, -1e9)) };
export function limpiarHuecos() { for (let i = 0; i < 4; i++) { HUECOS.min[i].set(1e9, 1e9, 1e9); HUECOS.max[i].set(-1e9, -1e9, -1e9); } }
// T-CAM1 (Diego: «los caminos se ven muy falsos»): los caminos de tierra se pintan en el propio sombreado del suelo con una máscara
// de distancia a la polilínea (r = distancia al eje /6 m, b = distancia al centro de la plaza /24 m; construir.js mascaraCaminos).
// Sin cinta encima (sin z-fighting), borde irregular por ruido, tierra apisonada, huellas de ruedas, pisadas, piedrecillas y pasto seco.
const _tVacia = new THREE.DataTexture(new Uint8Array([255, 128, 255, 255]), 1, 1); _tVacia.needsUpdate = true;
export const CAMINO = { tex: { value: _tVacia }, caja: { value: new THREE.Vector4(0, 0, 1, 1) }, on: { value: 0 } };
let OP_TERRENO = {};
export const hayNieve = (x, z) => altura(x, z) > lineaNieveEn(x, z, OP_TERRENO) + 4;
const SUELO_VIEJO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('suelo') === '0';   // N1-RENDIMIENTO: A/B
const CAPAS_VIEJO = `
        #define TRI(tx, e) (texture2D(tx, vMundo.zy / (e)).rgb * an.x + texture2D(tx, vMundo.xz / (e)).rgb * an.y + texture2D(tx, vMundo.xy / (e)).rgb * an.z)
        vec3 tierra = mix(TRI(tTierra, 7.0), TRI(tTierra, 31.0), 0.35);
        // roca triplanar según la normal: la proyección diagonal (x+z, y) se estiraba en franjas diagonales claras en las laderas empinadas
        vec3 roca = TRI(tRoca, 9.0);
        roca = mix(roca, TRI(tRoca, 37.0), 0.45);   // segunda escala: rompe el dibujo repetido
        roca = mix(roca, TRI(tRoca, 23.7), 0.3);   // tercera escala, no múltiplo de las otras: el mosaico del barranco y las laderas no repite
        float tonoR = texture2D(tRoca, mat2(0.8, -0.6, 0.6, 0.8) * vMundo.xz / 83.0 + 0.3).r + texture2D(tTierra, vMundo.xz / 47.0 + 0.5).g - 1.0;
        roca *= 1.0 + 0.5 * tonoR;   // ruido de tono de baja frecuencia solo en la roca
        roca = mix(roca, tierra * 0.92, 0.35);   // acerca la roca al color de la tierra (se veía como parches grises)
        // nieve: poco contraste y dos escalas (la textura sola se veía como cráteres de la luna repetidos)
        vec3 nt = mix(TRI(tNieve, 8.75), TRI(tNieve, 23.8), 0.5);
        vec3 nieve = mix(vec3(0.94, 0.955, 0.975), nt, 0.3);
        // borde de la nieve: ruido de baja frecuencia solo cerca del borde (entre vértices cada 5 m el borde salía recto)
        vec2 pr = mat2(0.8, -0.6, 0.6, 0.8) * vMundo.xz;   // segunda muestra girada: que el ruido no repita en diagonal
        float rn = texture2D(tRoca, vMundo.xz / 61.0 + 0.13).r + texture2D(tTierra, pr / 29.0 + 0.71).r - 1.0;
        float mn = vMezcla.y + rn * 1.1 * min(vMezcla.y, 1.0 - vMezcla.y);
        // en lo empinado asoma la roca, modulada por el mismo ruido (sin franjas regulares)
        float nv = smoothstep(0.18, 0.82, mn) * (1.0 - 0.5 * smoothstep(0.35, 1.0, vMezcla.x) * clamp(0.75 + rn, 0.3, 1.2));
        vec3 t = mix(mix(tierra, roca, vMezcla.x), nieve, nv);`;
const CAPAS = `
        // N1-RENDIMIENTO (carril render, 15-11): cada proyección y cada capa se muestrea SOLO si su peso no es cero (antes ~25 lecturas
        // de textura por píxel en todo el suelo; en tierra plana sin roca ni nieve ahora son 2). El resultado es el mismo: lo que se salta
        // se multiplicaba por 0 (las proyecciones laterales bajo 0,2 % de peso tampoco se ven). Las derivadas se toman fuera de los «if»
        // (textureGrad) para que el mipmap no cambie en el borde de una rama. ?suelo=0 vuelve al sombreado de antes.
        vec3 dWx = dFdx(vMundo), dWy = dFdy(vMundo);
        #define TP(tx, p, dx, dy, e) textureGrad(tx, (p) / (e), (dx) / (e), (dy) / (e)).rgb
        #define TRI(tx, e) ((an.x > 0.002 ? TP(tx, vMundo.zy, dWx.zy, dWy.zy, e) * an.x : vec3(0.0)) + (an.y > 0.002 ? TP(tx, vMundo.xz, dWx.xz, dWy.xz, e) * an.y : vec3(0.0)) + (an.z > 0.002 ? TP(tx, vMundo.xy, dWx.xy, dWy.xy, e) * an.z : vec3(0.0)))
        vec3 tierra = mix(TRI(tTierra, 7.0), TRI(tTierra, 31.0), 0.35);
        // roca triplanar según la normal: la proyección diagonal (x+z, y) se estiraba en franjas diagonales claras en las laderas empinadas
        vec3 roca = vec3(0.0);
        if (vMezcla.x > 0.0) {
          roca = TRI(tRoca, 9.0);
          roca = mix(roca, TRI(tRoca, 37.0), 0.45);   // segunda escala: rompe el dibujo repetido
          roca = mix(roca, TRI(tRoca, 23.7), 0.3);   // tercera escala, no múltiplo de las otras: el mosaico del barranco y las laderas no repite
          float tonoR = textureGrad(tRoca, mat2(0.8, -0.6, 0.6, 0.8) * vMundo.xz / 83.0 + 0.3, mat2(0.8, -0.6, 0.6, 0.8) * dWx.xz / 83.0, mat2(0.8, -0.6, 0.6, 0.8) * dWy.xz / 83.0).r + textureGrad(tTierra, vMundo.xz / 47.0 + 0.5, dWx.xz / 47.0, dWy.xz / 47.0).g - 1.0;
          roca *= 1.0 + 0.5 * tonoR;   // ruido de tono de baja frecuencia solo en la roca
          roca = mix(roca, tierra * 0.92, 0.35);   // acerca la roca al color de la tierra (se veía como parches grises)
        }
        // borde de la nieve: ruido de baja frecuencia solo cerca del borde (entre vértices cada 5 m el borde salía recto)
        float nv = 0.0;
        if (vMezcla.y > 0.0) {
          vec2 pr = mat2(0.8, -0.6, 0.6, 0.8) * vMundo.xz;   // segunda muestra girada: que el ruido no repita en diagonal
          float rn = textureGrad(tRoca, vMundo.xz / 61.0 + 0.13, dWx.xz / 61.0, dWy.xz / 61.0).r + textureGrad(tTierra, pr / 29.0 + 0.71, mat2(0.8, -0.6, 0.6, 0.8) * dWx.xz / 29.0, mat2(0.8, -0.6, 0.6, 0.8) * dWy.xz / 29.0).r - 1.0;
          float mn = vMezcla.y + rn * 1.1 * min(vMezcla.y, 1.0 - vMezcla.y);
          // en lo empinado asoma la roca, modulada por el mismo ruido (sin franjas regulares)
          nv = smoothstep(0.18, 0.82, mn) * (1.0 - 0.5 * smoothstep(0.35, 1.0, vMezcla.x) * clamp(0.75 + rn, 0.3, 1.2));
        }
        // nieve: poco contraste y dos escalas (la textura sola se veía como cráteres de la luna repetidos)
        vec3 nieve = vec3(0.0);
        if (nv > 0.0) { vec3 nt = mix(TRI(tNieve, 8.75), TRI(tNieve, 23.8), 0.5); nieve = mix(vec3(0.94, 0.955, 0.975), nt, 0.3); }
        vec3 t = mix(mix(tierra, roca, vMezcla.x), nieve, nv);`;
export function texturasSuelo(material) {
  material.onBeforeCompile = sh => {
    sh.uniforms.hMin = { value: HUECOS.min }; sh.uniforms.hMax = { value: HUECOS.max };
    sh.uniforms.tCamino = CAMINO.tex; sh.uniforms.caminoCaja = CAMINO.caja; sh.uniforms.caminoOn = CAMINO.on;
    sh.uniforms.tTierra = { value: tex('suelo_tierra') }; sh.uniforms.tRoca = { value: tex('suelo_roca') }; sh.uniforms.tNieve = { value: tex('suelo_nieve') };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 mezcla;\nvarying vec2 vMezcla;\nvarying vec3 vMundo;\nvarying vec3 vNormM;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMezcla = mezcla;\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNormM = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tTierra, tRoca, tNieve, tCamino;\nuniform vec4 caminoCaja;\nuniform float caminoOn;\nuniform vec3 hMin[4], hMax[4];\nvarying vec2 vMezcla;\nvarying vec3 vMundo;\nvarying vec3 vNormM;\nfloat hC(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }\n// piedrecilla en una grilla de celda s: devuelve (cuerpo, sombra) con probabilidad dens por celda\nvec2 piedrita(vec2 w, float s, float dens) { vec2 c = floor(w / s), f = fract(w / s) - 0.5; if (hC(c) > dens) return vec2(0.0); vec2 o = (vec2(hC(c + 17.1), hC(c + 5.3)) - 0.5) * 0.45; float r = 0.13 + 0.2 * hC(c + 3.7); vec2 q = (f - o) / r; q.x *= 0.8 + 0.5 * hC(c + 9.1); float d = length(q), ds = length(q - vec2(0.28, 0.32)); return vec2(1.0 - smoothstep(0.7, 1.0, d), (1.0 - smoothstep(0.8, 1.25, ds)) * smoothstep(0.75, 1.0, d)); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        for (int i = 0; i < 4; i++) if (all(greaterThan(vMundo, hMin[i])) && all(lessThan(vMundo, hMax[i]))) discard;
        vec2 uv1 = vMundo.xz / 7.0, uv2 = vMundo.xz / 31.0;
        // pesos triplanares según la normal: tierra, roca y nieve proyectadas solo desde arriba se estiraban en las laderas
        // empinadas en rayas horizontales finas y regulares
        vec3 an = pow(abs(normalize(vNormM)), vec3(4.0)); an /= (an.x + an.y + an.z);
${SUELO_VIEJO ? CAPAS_VIEJO : CAPAS}
        // T-CAM1: caminos de tierra pintados (máscara de distancia; ver CAMINO en terreno.js)
        vec2 cuv = (vMundo.xz - caminoCaja.xy) * caminoCaja.zw;
        if (caminoOn > 0.5 && cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0) {
          vec4 cm = texture2D(tCamino, cuv);
          float dC = cm.r * 6.0, dP = cm.b * 24.0;
          float detalle = 1.0 - smoothstep(22.0, 55.0, length(vMundo - cameraPosition));   // lo menudo se apaga de lejos (sin chispeo)
          float nb = texture2D(tTierra, vMundo.xz / 13.0 + 0.37).g + texture2D(tRoca, vMundo.xz / 4.3 + 0.61).r - 1.0;   // borde irregular, dos escalas
          float nf = texture2D(tTierra, vMundo.xz / 1.9 + 0.11).r;
          float borde = 1.75 + 0.6 * nb, fC = 1.0 - smoothstep(borde - 0.3, borde + 0.45, dC);
          float bordeP = 9.3 + 0.9 * nb, fP = 1.0 - smoothstep(bordeP - 0.5, bordeP + 0.6, dP);
          float fT = max(fC, fP), halo = (1.0 - smoothstep(0.0, 2.2, min(dC - borde, dP - bordeP))) * (1.0 - fT);
          // tierra apisonada: más oscura y compacta, con grano fino; huellas de ruedas a ±0,8 m y lomo central algo más claro
          vec3 apis = mix(tierra, vec3(dot(tierra, vec3(0.333))), 0.45) * vec3(0.63, 0.575, 0.52) * (0.9 + 0.2 * nf);
          float rueda = exp(-pow((dC - 0.8) / 0.17, 2.0)) * (0.45 + 0.55 * smoothstep(0.35, 0.65, texture2D(tTierra, vMundo.xz / 11.0 + 0.2).b));
          apis *= (1.0 - 0.3 * rueda) * (1.0 + 0.05 * (1.0 - smoothstep(0.0, 0.45, dC)));
          vec3 grava = mix(tierra * vec3(0.8, 0.77, 0.73), vec3(0.6, 0.58, 0.55), 0.3) * (0.86 + 0.28 * nf);
          vec3 cam = mix(apis, grava, fP / max(fC + fP, 1e-3));
          cam = mix(cam, vec3(0.6, 0.57, 0.55) * (0.9 + 0.2 * nf), nv * 0.55);   // en la nieve: barro pisado
          // pisadas sutiles (óvalos apenas más oscuros) en el centro del camino
          vec2 cP = floor(vMundo.xz / 0.38), fPi = fract(vMundo.xz / 0.38) - 0.5 - (vec2(hC(cP + 2.1), hC(cP + 8.4)) - 0.5) * 0.4;
          float ang = hC(cP + 4.2) * 6.28; fPi = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * fPi;
          float pisada = step(hC(cP), 0.2) * (1.0 - smoothstep(0.75, 1.0, length(fPi / vec2(0.2, 0.32)))) * (1.0 - smoothstep(0.6, 1.5, dC));
          cam *= 1.0 - 0.09 * pisada * detalle;
          t = mix(t * (1.0 - 0.1 * halo), cam, fT * (1.0 - 0.2 * nv));
          // pasto seco en matas en el borde (no en la nieve ni en la roca)
          float banda = smoothstep(borde - 0.4, borde + 0.3, dC) * (1.0 - smoothstep(borde + 0.9, borde + 2.8, dC)) * (1.0 - fP);
          float mata = smoothstep(0.5, 0.62, texture2D(tTierra, vMundo.xz / 1.3 + 0.5).g * 0.55 + texture2D(tRoca, vMundo.xz / 3.7 + 0.2).r * 0.65) * banda * (1.0 - nv) * (1.0 - 0.8 * vMezcla.x);
          vec3 pasto = vec3(0.64, 0.56, 0.34) * (0.75 + 0.45 * texture2D(tTierra, vec2(vMundo.x * 3.1, vMundo.z * 0.7)).g);
          t = mix(t, pasto, mata * 0.85);
          // piedrecillas sueltas al azar (más en el camino y la plaza, pocas en el borde)
          float densP = 0.03 * fC + 0.05 * fP + 0.01 * halo;
          vec2 pa = piedrita(vMundo.xz, 0.17, densP), pb = piedrita(vMundo.xz + 7.3, 0.41, densP * 0.35);
          vec2 pd = max(pa, pb) * detalle;
          vec3 colP = mix(tierra, vec3(0.56, 0.53, 0.5), 0.6) * (0.7 + 0.45 * hC(floor(vMundo.xz / 0.17))) * (0.85 + 0.25 * pd.x);
          t = mix(t * (1.0 - 0.3 * pd.y), colP, pd.x * 0.9);
        }
        float luz = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = t * (0.75 + 0.5 * luz);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (0.12 + 0.2 * smoothstep(0.3, 0.9, vMezcla.x)) * luzPropia;');   // luz propia: las laderas entre terrazas en sombra se veían casi negras (N2)
    sh.uniforms.luzPropia = LUZ_PROPIA; sh.fragmentShader = 'uniform float luzPropia;\n' + sh.fragmentShader;   // N3-C12: de noche se apaga
  };
}

// cota donde empieza la nieve: ondas largas y cortas (con solo dos ondas largas el borde se veía casi recto de lejos)
function lineaNieveEn(x, z, op) {
  const base = op.invierno ? -100 : op.nieveDesde ?? 250;
  return base + 22 * Math.sin(x * 0.043 + z * 0.011) + 12 * Math.sin(z * 0.071 - x * 0.02)
    + 9 * Math.sin(x * 0.113 + z * 0.052 + 1.3) + 5 * Math.sin(z * 0.19 - x * 0.07 + 0.4) + 3 * Math.sin(x * 0.31 + z * 0.27);
}

// malla visual + colisionador (trimesh)
export function crearTerreno(fis, op = {}) {
  OP_TERRENO = op; CAMINO.on.value = 0;   // T-CAM1: la máscara de caminos la pone construirPueblo1905 (solo N1)
  const X0 = -760, X1 = 760, Z0 = -1000, Z1 = 300, PASO = op.paso || 5;
  const nx = Math.round((X1 - X0) / PASO) + 1, nz = Math.round((Z1 - Z0) / PASO) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const roca = new THREE.Color(op.invierno ? 0xc9c3c8 : 0x9c8068), tierra = new THREE.Color(op.invierno ? 0xe9eef5 : 0xb69a76),
    nieve = new THREE.Color(0xf4f6fb), fondo = new THREE.Color(0x6e5a52), c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X0 + i * PASO, z = Z0 + j * PASO, y = altura(x, z), k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
    const pend = Math.abs(altura(x + 2, z) - altura(x - 2, z)) + Math.abs(altura(x, z + 2) - altura(x, z - 2));
    c.copy(tierra).lerp(roca, Math.min(1, pend / 4));
    if (enBarranco(x, z)) c.lerp(fondo, 0.6);
    const lnC = lineaNieveEn(x, z, op);
    if (y > lnC) c.lerp(nieve, Math.min(1, (y - lnC) / 28) * (1 - 0.4 * suaveEscalon(2.5, 6, pend)));
    const v = (Math.sin(x * 1.7 + z * 2.3) * 0.5 + 0.5) * 0.06; c.offsetHSL(0, 0, v - 0.03);
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let n = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c2 = a + nx, d = c2 + 1;
    idx[n++] = a; idx[n++] = c2; idx[n++] = b; idx[n++] = b; idx[n++] = c2; idx[n++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  // mezcla de texturas por vértice: x = roca (pendiente), y = nieve (altura / invierno)
  const mezcla = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = pos[k * 3], z = pos[k * 3 + 2], y = pos[k * 3 + 1];
    // pendiente medida a ±6 m (a ±2 m seguía los triángulos de la malla: parches de roca con bordes rectos)
    const pend = (Math.abs(altura(x + 6, z) - altura(x - 6, z)) + Math.abs(altura(x, z + 6) - altura(x, z - 6))) / 3;
    // roca por pendiente, sin la onda sin(x·0,09 + z·0,13): era un dibujo diagonal repetido en las laderas
    mezcla[k * 2] = Math.min(1, Math.max(0, (pend - 2.4) / 3.5));
    const lnR = lineaNieveEn(x, z, op);   // borde de la nieve irregular (antes una línea recta)
    // nieve solo por altura; lo empinado la adelgaza en el sombreador (el corte en pendiente 3,5 dejaba franjas entre triángulos)
    mezcla[k * 2 + 1] = Math.min(1, Math.max(0, (y - lnR) / 28));
  }
  geo.setAttribute('mezcla', new THREE.BufferAttribute(mezcla, 2));
  // doble cara: si la cámara queda bajo el suelo (junto al portal, en la trinchera) se veía el cielo blanco por debajo
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  texturasSuelo(material);
  const malla = new THREE.Mesh(geo, material);
  malla.receiveShadow = true; malla.castShadow = false; malla.name = 'terreno';
  fis.malla(pos, idx, { tipo: op.invierno ? 'nieve' : 'tierra' });
  return malla;
}

// Cordillera de los Andes alrededor del valle: anillo de cerros lejanos con nieve arriba (no se pisa, solo se ve)
// ruido de valores 2D (retícula con hash, interpolación suave): sin periodicidad visible
function hash2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruidoV(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return hash2(i, j) * (1 - u) * (1 - v) + hash2(i + 1, j) * u * (1 - v) + hash2(i, j + 1) * (1 - u) * v + hash2(i + 1, j + 1) * u * v;
}
export function crearCordillera(op = {}) {
  // el anillo nace en el borde del rectángulo del terreno (x ±760, z −1000…300) y a su misma altura:
  // antes empezaba a 900 m del centro y hacia el sur quedaba un hueco por donde se veía cielo bajo las montañas
  const segs = 720, filas = 72, R1 = 2600;   // 72 filas: con 40 las crestas quedaban como lomas lisas   // más resolución: crestas y quebradas en vez de una cortina lisa
  const pos = [], col = [], idx = [];
  const roca = new THREE.Color(0x8a7466), nieve = new THREE.Color(0xf2f4f8), c = new THREE.Color();
  const tierra = new THREE.Color(op.invierno ? 0xe9eef5 : 0xb69a76);
  // relieve suave de cumbres y portezuelos (sin picos de cono)
  const ruido = (a, r) => Math.sin(a * 5.3 + r * 0.0021) * 0.55 + Math.sin(a * 11.7 - r * 0.0013 + 1.3) * 0.3 + Math.sin(a * 23.1 + r * 0.0031) * 0.12;
  for (let j = 0; j <= filas; j++) {
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2, sx = Math.sin(a), cz = -Math.cos(a);
      // distancia al borde del terreno en esta dirección (un poco hacia adentro para que no quede ranura)
      const rx = Math.abs(sx) > 1e-6 ? 760 / Math.abs(sx) : 1e9, rz = Math.abs(cz) > 1e-6 ? (cz < 0 ? 1000 : 300) / Math.abs(cz) : 1e9;
      const r0 = Math.min(rx, rz) - 4, hBorde = altura(sx * r0, cz * r0) - 2;
      const lejos = j / filas, r = r0 + (R1 - r0) * Math.pow(lejos, 1.3);   // más filas cerca del borde
      // más alto lejos y hacia el norte (detrás del Cerro Negro); cerca se funde con el terreno
      // (cz = -cos a: el norte es cos a > 0; antes decía -cos a y el lado alto quedaba al sur, la «cortina» al sureste del campamento)
      const norte = 0.6 + 0.4 * Math.max(0, Math.cos(a));
      // la altura depende de la distancia real al borde: lomas suaves cerca y cumbres lejos (si no, al sur —borde a 300 m— era una pared)
      const d = r - r0, sube = Math.min(1, d / 1900), cumbre = sube * sube * (3 - 2 * sube);
      // crestas (ruido «ridged» de varias frecuencias): rompen la superficie lisa que parecía una cortina
      // crestas con ruido en coordenadas de mundo (no del ángulo): con a·29 y a·61 las crestas eran radiales y de cerca
      // se veían como vetas verticales en una cortina estirada (sureste del campamento)
      // deformación de dominio con ruido de valores (no periódico): rompe las ondas regulares de las sinusoides
      const qx = sx * r, qz = cz * r;
      const px = qx + 520 * (ruidoV(qx * 0.0011 + 3.1, qz * 0.0011) - 0.5) + 160 * (ruidoV(qx * 0.0037, qz * 0.0037 + 9.7) - 0.5);
      const pz = qz + 520 * (ruidoV(qx * 0.0011, qz * 0.0011 + 7.7) - 0.5) + 160 * (ruidoV(qx * 0.0037 + 4.2, qz * 0.0037) - 0.5);
      const rid = v => 1 - Math.abs(Math.sin(v));
      const cresta = Math.pow(rid(px * 0.0019 - pz * 0.0012 + 1.4 * Math.sin(pz * 0.0011 + px * 0.0007)), 1.6) * 0.45
        + Math.pow(rid(px * 0.0041 + 0.9 * Math.sin(pz * 0.0029)), 2) * 0.25 + Math.pow(rid(pz * 0.0047 + 0.8 * Math.sin(px * 0.0033 + 1)), 2) * 0.18
        + Math.pow(rid((px - pz) * 0.0093 + Math.sin((px + pz) * 0.006)), 2) * 0.12;
      // cumbres por ruido en coordenadas de mundo (el ruido por ángulo hacía valles radiales: pliegues verticales de cortina)
      const ruidoM = Math.sin(px * 0.0017 + Math.sin(pz * 0.0013) * 1.4) * 0.5 + Math.sin(pz * 0.0023 - px * 0.0009 + 1.3) * 0.3 + Math.sin((px + 0.6 * pz) * 0.0041) * 0.2;
      const h = hBorde + (0.62 + 0.38 * (0.35 * ruido(a, r) + 0.65 * ruidoM)) * (950 * Math.pow(cumbre, 1.25) + 0.08 * d) * norte + (cresta - 0.35) * (10 + 420 * cumbre) * (0.5 + 0.5 * norte);   // espolones marcados también al sur (con «norte» 0,6 quedaban lisos)
      pos.push(sx * r, h, cz * r);
      c.copy(roca).offsetHSL(0, 0, (ruido(a * 3, r) * 0.03));   // menos variación por ángulo: hacía rayas radiales
      c.offsetHSL(0, 0, (0.45 - cresta) * 0.12);   // crestas de roca más oscura, quebradas más claras: relieve legible a distancia
      if (j <= 2) c.lerp(tierra, 1 - j / 3);
      // nieve: más baja y metida en las quebradas (canaletas), además de las cumbres (antes solo sobre 700 m: el sur no tenía)
      const linea = (op.invierno ? 300 : 400) - 150 * (1 - Math.min(1, cresta * 1.4));
      if (h > linea) c.lerp(nieve, Math.min(1, (h - linea) / 60));   // borde nítido: mezclada en 180 m se veía como bruma blanquecina
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < filas; j++) for (let i = 0; i < segs; i++) {
    const a = j * (segs + 1) + i, b = a + 1, c2 = a + segs + 1, d = c2 + 1;
    idx.push(a, b, c2, b, d, c2);   // caras hacia el centro y hacia arriba (antes miraban hacia abajo: se veía la «panza» colgando del cielo)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  // textura de roca proyectada en el mundo (antes solo colores por vértice: se veía como una cortina con rayas)
  const mt = matMundo('suelo_roca', 110, 0xffffff, { lejos: [500, 1700], mezcla: 0.5 }); mt.vertexColors = true;   // 110 m por repetición (con 28 se veía un moiré de puntos en las laderas lejanas)
   mt.roughness = 1;
  const m = new THREE.Mesh(geo, mt);
  m.name = 'cordillera'; m.receiveShadow = false; m.castShadow = false;
  return m;
}
