// BODA DENTRO DE LA IGLESIA (N0-CIUDAD-VIVA, carril animador, 3.er relevo 15-11-2026). Pedido de Diego: «la boda ponlos dentro de la
// iglesia, con un cura y los invitados sentados en las bancas». Ceremonia en la sala 'iglesia' (kitEmblemas.js salaIglesia, que NO se toca:
// aquí solo se leen sus medidas): novios de pie en el pasillo frente a las gradas curvas del presbiterio, mirando al altar; el cura arriba
// de las gradas, de frente a ellos (bendice y habla); damas de honor (o paje) a los lados; invitados SENTADOS en las bancas delanteras
// (pose sentada apuntando huesos a direcciones del mundo, como gente1905.js: no depende de los ángulos locales del esqueleto); alguno
// se seca una lágrima. Solo tipos aprobados (ciudadViva.js APROBADOS). Sin cura aprobado: un tipo aprobado sin sombrero (gringo/joven) con
// sotana negra y alzacuello de código. Se arma la primera vez que Nato entra a la iglesia (N2-N4) y solo se anima dentro de la sala.
// URL: &bodaiglesia=0 la apaga. Lo llama ciudadViva.js (una línea al final).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cargarTipo, crearPersona } from '../motor/mallaCiudad.js';
import { APROBADOS } from './ciudadViva.js';

const URLP = new URLSearchParams(location.search);
const ok = id => APROBADOS.has(id) || URLP.has('cvtodos');
// medidas de salaIglesia (kitEmblemas.js): bancas xc ±1,85, z = −5,5 − i·1,1 (i 0-9), largo 1,9, asiento arriba en y 0,495;
// gradas curvas con centro en z −19,6 (radios 3,15 / 2,8 / 2,45; la de arriba a la altura del estrado, y 0,45); altar en z −22,2.
const BANCA = i => -5.5 - i * 1.1, ASIENTO = 0.495, Z_GRADAS = -19.6, Y_ESTRADO = 0.45;

// ---------------------------------------------------------------- pose sentada (= gente1905.js, copiada para no depender de ese carril)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _pm = new THREE.Matrix4(), _fr = new THREE.Frustum(), _esf = new THREE.Sphere(new THREE.Vector3(), 1.2);   // cierre 15-11: recorte por cámara
function apuntar(hueso, hijo, dir) {
  if (!hueso || !hijo) return;
  hueso.updateWorldMatrix(true, true);
  const d = hijo.getWorldPosition(_b).sub(hueso.getWorldPosition(_a)).normalize();
  _q.setFromUnitVectors(d, dir); hueso.getWorldQuaternion(_qb); hueso.parent.getWorldQuaternion(_qp);
  hueso.quaternion.copy(_qp.invert().multiply(_q.multiply(_qb)));
}
function poseSentado(g, H, lagrima) {
  g.updateWorldMatrix(true, false);
  const q = g.getWorldQuaternion(new THREE.Quaternion()), adel = new THREE.Vector3(0, 0, 1).applyQuaternion(q), izq = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  for (const s of ['L', 'R']) {
    const lado = H['thigh' + s] && H['thigh' + s].getWorldPosition(_c).sub(g.getWorldPosition(_a)).dot(izq) > 0 ? 1 : -1;
    apuntar(H['thigh' + s], H['shin' + s], _c.copy(adel).addScaledVector(izq, lado * 0.1).normalize());
    apuntar(H['shin' + s], H['foot' + s], _c.copy(adel).multiplyScalar(0.12).add(new THREE.Vector3(0, -1, 0)).normalize());
    const brazo = H['uparm' + s], ante = H['forearm' + s], mano = H['hand' + s], rod = H['shin' + s];
    if (!(brazo && ante && mano && rod)) continue;
    if (lagrima > 0 && lado < 0) {   // se seca una lágrima: el brazo adelante y el antebrazo sube hasta el ojo
      apuntar(brazo, ante, _c.copy(adel).multiplyScalar(0.55).add(new THREE.Vector3(0, -1, 0)).addScaledVector(izq, lado * 0.15).normalize());
      ante.updateWorldMatrix(true, true);
      const ojo = H.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0)).addScaledVector(adel, 0.14).addScaledVector(izq, lado * 0.05);
      const reposo = rod.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.07, 0)).addScaledVector(izq, -lado * 0.02);
      apuntar(ante, mano, reposo.lerp(ojo, lagrima).sub(ante.getWorldPosition(_a)).normalize());
      continue;
    }
    apuntar(brazo, ante, _c.copy(adel).multiplyScalar(0.45).add(new THREE.Vector3(0, -1, 0)).addScaledVector(izq, lado * 0.08).normalize());
    ante.updateWorldMatrix(true, true);
    const meta = rod.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.07, 0)).addScaledVector(izq, -lado * 0.02);
    apuntar(ante, mano, meta.sub(ante.getWorldPosition(_a)).normalize());
  }
}
const huesosDe = p => { const H = {}; p.escena.traverse(o => { if (o.isBone) H[o.name] = o; }); return H; };

// ---------------------------------------------------------------- sotana negra con alzacuello (cura de código, mientras no haya tipo «cura»)
// 16-11 (Diego: «de espaldas parece un recorte negro plano»): antes era UN torno macizo colgado de la cadera, negro casi puro y sin mangas
// (de espaldas, una silueta lisa; los brazos del terno del gringo a la vista). Ahora se MIDE el cuerpo posado (vértices de la malla alta ya
// deformados por los huesos, agrupados por su hueso dominante) y se arman piezas pegadas a su hueso: falda con pliegues que se abren hacia
// el ruedo (cadera), cuerpo hasta los hombros (pecho), esclavina corta sobre los hombros (pecho), mangas en dos tramos con puño (brazo y
// antebrazo), faja en la cintura y alzacuello blanco (cuello). Color carbón con sombra en el fondo de los pliegues (color por vértice):
// el volumen se lee también de espaldas. 1 material oscuro + 1 blanco, ~7 dibujos, ~4 mil triángulos.
const TELA = 0x29282b, BOTON = 0x0f0f13;
let MAT_SOT = null, MAT_ALZ = null;
function matSotana() {
  if (MAT_SOT) return [MAT_SOT, MAT_ALZ];
  MAT_SOT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, emissive: 0x07070a });
  MAT_SOT.onBeforeCompile = sh => {   // brillo rasante de la lana (sheen barato): realza el borde de cada pliegue en contraluz
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0); totalEmissiveRadiance += 0.10 * fr * vec3(0.55, 0.56, 0.66); }');
  };
  MAT_SOT.customProgramCacheKey = () => 'sotana16';
  MAT_ALZ = new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.45, emissive: 0x202020 });
  return [MAT_SOT, MAT_ALZ];
}
// anillos horizontales (elipses con centro propio) → tubo; pl(θ, t) = pliegue radial (m), sombra de pliegue en el color
function tuboAnillos(an, seg, pl) {
  const pos = [], col = [], idx = [], c = new THREE.Color(TELA), k = new THREE.Color();
  an.forEach((a, j) => { for (let i = 0; i < seg; i++) {
    const th = i / seg * Math.PI * 2, sx = Math.sin(th), cz = Math.cos(th), d = pl ? pl(th, a.t || 0) : 0;   // θ 0 = adelante (+z)
    pos.push(a.cx + sx * (a.rx + d), a.y, a.cz + cz * (a.rz + d));
    const sombra = pl && a.t ? 0.72 + 0.28 * Math.min(1, Math.max(0, 0.5 + d / (2 * (a.amp || 0.02) + 1e-4))) : 1;
    k.copy(c).multiplyScalar(sombra * (a.luz || 1)); col.push(k.r, k.g, k.b);
  } });
  // v5: la cara de afuera depende del orden de los anillos (de arriba abajo o al revés): antes el cuerpo, la faja (anillos hacia arriba)
  // quedaban con la cara de afuera hacia adentro y se veía la chaqueta a través
  const sube = an[an.length - 1].y > an[0].y;
  for (let j = 0; j < an.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * seg + i, b = j * seg + (i + 1) % seg, cc = a + seg, dd = b + seg; if (sube) idx.push(a, b, cc, b, dd, cc); else idx.push(a, cc, b, b, cc, dd);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed();
}
const pintar = (g, hex) => { const n = g.attributes.position.count, c = new THREE.Color(hex), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const limpia = g => { for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(n)) g.deleteAttribute(n); return g.index ? g.toNonIndexed() : g; };
// manga: tubo de a → b (marco de la persona), radios r0/r1, con puño
function manga(a, b, r0, r1, puno) {
  const d = b.clone().sub(a), L = d.length(), g = new THREE.CylinderGeometry(r1, r0, L, 14, 2, true);
  g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
  const gs = [pintar(limpia(g), TELA)];
  if (puno) { const p = new THREE.CylinderGeometry(r1 * 1.12, r1 * 1.08, 0.05, 14, 1, true); p.translate(0, L - 0.025, 0);
    p.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)); p.translate(a.x, a.y, a.z); gs.push(pintar(limpia(p), 0x232229)); }
  return mergeGeometries(gs);
}
function ponerSotana(p, H) {
  let alta = null; p.escena.traverse(o => { if (o.isSkinnedMesh && !alta && /_alta$/.test(o.name)) alta = o; });
  if (!alta) return null;
  p.g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(p.g.matrixWorld).invert(), aMarco = new THREE.Matrix4().multiplyMatrices(inv, alta.matrixWorld);
  const J = n => H[n] ? H[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv) : null;   // articulación en el marco de la persona (+z adelante)
  // vértices posados por grupo de hueso dominante
  const G = { tronco: [], piernas: [], brazoL: [], brazoR: [], antL: [], antR: [], cuello: [], mano: [] };
  const bones = alta.skeleton.bones, si = alta.geometry.attributes.skinIndex, sw = alta.geometry.attributes.skinWeight, v = new THREE.Vector3();
  for (let i = 0; i < si.count; i += 2) {
    let bi = si.getX(i), bw = sw.getX(i); for (const [x, w] of [[si.getY(i), sw.getY(i)], [si.getZ(i), sw.getZ(i)], [si.getW(i), sw.getW(i)]]) if (w > bw) { bw = w; bi = x; }
    const n = bones[bi].name.replace('.', '');
    const gr = /^(spine|chest|clav)/.test(n) ? 'tronco' : /^(hips|thigh|shin|foot)/.test(n) ? 'piernas' : /^uparm/.test(n) ? 'brazo' + n.slice(-1) : /^forearm/.test(n) ? 'ant' + n.slice(-1) : /^neck/.test(n) ? 'cuello' : /^hand/.test(n) ? 'mano' : null;
    if (!gr) continue;
    alta.getVertexPosition(i, v); G[gr].push(v.clone().applyMatrix4(aMarco));
  }
  const yCue = J('neck')?.y ?? 1.45, yCad = J('hips')?.y ?? 0.95, yPe = J('chest')?.y ?? 1.2, yCin = Math.max(yCad + 0.05, J('spine')?.y ?? yCad + 0.12);
  const hL = J('uparmL'), hR = J('uparmR'), yHom = hL && hR ? (hL.y + hR.y) / 2 : yCue - 0.06, xHom = hL && hR ? Math.abs(hL.x - hR.x) / 2 : 0.19;
  const yFaja = (yCin + yPe) / 2;   // cintura a la vista (la articulación «spine» del esqueleto TRELLIS queda a la altura de la cadera)
  // contorno a la altura y (±dy) de un grupo de vértices: semiancho x (desde 0) y frente/espalda z
  const corte = (L, y, dy = 0.035) => { let rx = 0, z0 = 1e9, z1 = -1e9, n = 0; for (const q of L) if (Math.abs(q.y - y) < dy) { n++; rx = Math.max(rx, Math.abs(q.x)); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); } return n > 4 ? { rx, cz: (z0 + z1) / 2, rz: (z1 - z0) / 2 } : null; };
  // v3 (16-11): la elipse que toca los extremos NO encierra un torso «cuadrado» (las esquinas asomaban 6-10 %, medido con &cvdiag):
  // cada anillo se agranda hasta que TODOS los vértices de su franja quedan dentro, + margen
  const cubrir = (a, L, m, dy = 0.03) => { let k = 0; for (const q of L) if (Math.abs(q.y - a.y) < dy) k = Math.max(k, (q.x / a.rx) ** 2 + ((q.z - a.cz) / a.rz) ** 2); k = Math.sqrt(k);
    if (k > 0) { const f = Math.max(1, k); a.rx = a.rx * f + m; a.rz = a.rz * f + m; } return a; };
  const cuerpo = [...G.tronco, ...G.piernas];
  // todo lo que queda entre los hombros (la chaqueta del gringo tiene pesos de brazo y de mano en los costados y el faldón)
  // v6: de los brazos/manos solo lo cercano al centro (con |x| < xHom − 0,04 las manos colgando inflaban el cuerpo como un barril)
  const centro = [...G.brazoL, ...G.brazoR, ...G.antL, ...G.antR, ...G.mano].filter(q => Math.abs(q.x) < Math.min(0.17, xHom * 0.6));
  const entre = [...G.tronco, ...G.piernas.filter(q => Math.abs(q.x) < xHom - 0.015), ...centro], sinManos = entre;
  // FALDA (cadera): de la cintura al ruedo; nunca se cierra hacia abajo y se abre al final; pliegues más hondos atrás y abajo
  const falda = [], NF = 14, yR = 0.035; let rx = 0.12, rz = 0.1, cz = 0;
  for (let j = 0; j <= NF; j++) {
    const t = j / NF, y = yFaja + 0.02 - (yFaja + 0.02 - yR) * t, L = y > yCad - 0.2 ? sinManos : cuerpo, m = corte(L, y);
    const a = { y, cx: 0, cz: m ? m.cz : cz, rx: m ? m.rx : rx, rz: m ? m.rz : rz }; cubrir(a, L, 0.03);
    rx = Math.max(rx, a.rx); rz = Math.max(rz, a.rz); if (j < 5) cz = a.cz;
    const ab = 0.09 * Math.pow(t, 1.6);
    falda.push({ y, cx: 0, cz: cz - 0.02 * t, rx: rx + ab, rz: rz + ab * 0.9, t, amp: 0.004 + 0.016 * t, luz: j === NF ? 0.8 : 1 });
  }
  const plF = (th, t) => { const atras = 0.55 + 0.45 * (1 - Math.cos(th)) / 2; return (0.004 + 0.016 * t) * atras * Math.cos(th * 11 + Math.sin(th * 3) * 0.6); };
  const gFalda = [tuboAnillos(falda, 72, plF)];
  // ruedo: un borde hacia adentro para que de abajo no se vea hueco
  const ult = falda[NF]; gFalda.push(tuboAnillos([ult, { ...ult, y: ult.y + 0.002, rx: ult.rx * 0.7, rz: ult.rz * 0.7, t: 0, luz: 0.5 }], 72, null));
  // CUERPO (pecho): de bajo la faja a la base del cuello; anillos cada ~5 cm, cada uno encierra su franja
  const torso = [], y0 = yFaja - 0.08, y1 = yHom - 0.02, nT = Math.max(4, Math.round((y1 - y0) / 0.05));
  let ucz = cz, uz = 0.12;
  for (let k = 0; k <= nT; k++) { const y = y0 + (y1 - y0) * k / nT, m = corte(entre, y) || { rx: 0.15, rz: 0.12, cz: ucz }; const a = cubrir({ y, cx: 0, cz: m.cz, rx: m.rx, rz: m.rz }, entre, 0.025); ucz = a.cz; uz = a.rz; torso.push(a); }
  // v6: sin escalones entre anillos: dilatar (máx. de vecinos, sigue encerrando) y promediar
  for (const k of ['rx', 'rz']) { const d = torso.map((a, i) => Math.max(a[k], torso[i - 1]?.[k] ?? 0, torso[i + 1]?.[k] ?? 0)); torso.forEach((a, i) => { a[k] = (d[Math.max(0, i - 1)] + 2 * d[i] + d[Math.min(d.length - 1, i + 1)]) / 4; }); }
  for (const a of torso) if (a.y > yPe) a.rx = Math.min(a.rx, xHom + 0.05);   // v7: sin pecho de barril (las axilas inflaban los anillos de arriba)
  torso[torso.length - 1].rx = Math.max(torso[torso.length - 1].rx, xHom + 0.03);
  // cuello: lo que hay a la altura del alzacuello (cuello de la camisa/chaqueta), sin la cabeza
  const nCu = [...G.tronco, ...G.cuello].filter(q => Math.abs(q.x) < 0.14), mc0 = corte(nCu, yCue + 0.03, 0.025) || { rx: 0.06, rz: 0.06, cz: ucz };
  const mc = cubrir({ y: yCue + 0.03, cx: 0, cz: mc0.cz, rx: mc0.rx, rz: mc0.rz }, nCu, 0.006, 0.025);
  const rC = Math.max(0.05, Math.min(0.11, mc.rx)), rCz = Math.max(0.05, Math.min(0.11, mc.rz));
  const hom = cubrir({ y: yHom + 0.035, cx: 0, cz: (ucz + mc.cz) / 2, rx: (xHom + 0.02 + rC) / 2 + 0.03, rz: (uz + rCz) / 2 + 0.01 }, entre, 0.02);
  const cue0 = cubrir({ y: yCue - 0.01, cx: 0, cz: mc.cz, rx: rC + 0.012, rz: rCz + 0.012 }, nCu, 0.008);
  torso.push(hom, cue0, { y: yCue + 0.012, cx: 0, cz: mc.cz, rx: Math.max(rC + 0.004, cue0.rx - 0.01), rz: Math.max(rCz + 0.004, cue0.rz - 0.01) });
  // v4: el cuerpo en DOS piezas: bajo el pecho pegado a «spine», arriba a «chest» (al hablar el pecho gira sobre la columna y la
  // chaqueta de abajo, pesada a spine/hips, asomaba por delante); el tramo de abajo sube un anillo, un poco más angosto, por dentro
  const iPe = Math.max(1, torso.findIndex(a => a.y >= yPe)), arr = torso.slice(iPe);
  const aba = torso.slice(0, iPe + 1).concat([{ ...torso[iPe + 1], rx: torso[iPe + 1].rx - 0.008, rz: torso[iPe + 1].rz - 0.008 }]);
  const gPecho = [tuboAnillos(arr, 48, null)], gCol = [tuboAnillos(aba, 48, null)];
  const botones = (y0, y1, n, fz) => { const L = []; for (let k = 0; k <= n; k++) { const y = y0 + (y1 - y0) * k / n, b = new THREE.SphereGeometry(0.0075, 6, 4); b.scale(1, 1, 0.6); b.translate(0, y, fz(y)); L.push(pintar(limpia(b), BOTON)); } return L; };
  const zFr = (an, y) => { let a = an[0], b = an[an.length - 1]; for (let i = 0; i < an.length - 1; i++) if ((an[i].y - y) * (an[i + 1].y - y) <= 0) { a = an[i]; b = an[i + 1]; break; } const u = Math.abs(b.y - a.y) < 1e-4 ? 0 : (y - a.y) / (b.y - a.y); return a.cz + a.rz + (b.cz + b.rz - a.cz - a.rz) * u + 0.004; };
  gPecho.push(...botones(yHom - 0.17, yFaja + 0.06, 5, y => zFr(torso, y)));
  gFalda.push(...botones(yFaja - 0.07, yR + 0.45, 9, y => zFr(falda, y)));
  // faja (cíngulo) en la cintura, tapa la unión cuerpo/falda: más ancha que los dos
  const f0 = falda[0], tF = torso.reduce((b, a) => Math.abs(a.y - yFaja) < Math.abs(b.y - yFaja) ? a : b, torso[0]);
  const faja = { cx: 0, cz: f0.cz, rx: Math.max(tF.rx, f0.rx) + 0.012, rz: Math.max(tF.rz, f0.rz) + 0.012 };
  gFalda.push(tuboAnillos([{ ...faja, y: yFaja - 0.045, rx: faja.rx - 0.01, rz: faja.rz - 0.01, luz: 0.6 }, { ...faja, y: yFaja - 0.04, luz: 0.75 }, { ...faja, y: yFaja + 0.035, luz: 0.75 }, { ...faja, y: yFaja + 0.04, rx: faja.rx - 0.01, rz: faja.rz - 0.01, luz: 0.6 }], 40, null));
  // ESCLAVINA (pecho): capa corta del cuello a media manga, cubre la unión hombro/manga y el cuello de la chaqueta; pliegues suaves
  const yEsc = yHom - 0.15, todoArr = [...entre, ...G.brazoL, ...G.brazoR].filter(q => q.y > yEsc - 0.05);
  const capa = [
    cubrir({ y: yCue - 0.005, cx: 0, cz: mc.cz, rx: cue0.rx + 0.006, rz: cue0.rz + 0.006, t: 0 }, nCu, 0.01),
    cubrir({ y: yHom + 0.05, cx: 0, cz: ucz, rx: xHom + 0.035, rz: uz + 0.02, t: 0.3, amp: 0.005 }, todoArr, 0.012),
    cubrir({ y: yHom - 0.03, cx: 0, cz: ucz, rx: xHom + 0.06, rz: uz + 0.035, t: 0.7, amp: 0.006 }, todoArr, 0.012)];
  for (const a of capa.slice(1)) { const t0 = torso.reduce((b, c) => Math.abs(c.y - a.y) < Math.abs(b.y - a.y) ? c : b, torso[0]); a.rx = Math.max(a.rx, t0.rx + 0.02); a.rz = Math.max(a.rz, t0.rz + 0.02); }   // v7: la esclavina siempre por fuera del cuerpo
  const c2 = capa[2]; capa.push({ y: yEsc, cx: 0, cz: ucz, rx: c2.rx + 0.02, rz: c2.rz + 0.015, t: 1, amp: 0.007, luz: 0.85 });
  const plC = (th, t) => 0.006 * t * Math.cos(th * 9);
  const gCapa = [tuboAnillos(capa, 60, plC)];
  const bajo = capa[capa.length - 1]; gCapa.push(tuboAnillos([bajo, { ...bajo, y: bajo.y + 0.003, rx: bajo.rx - 0.03, rz: bajo.rz - 0.03, t: 0, luz: 0.5 }], 60, null));
  // MANGAS: radio = percentil 85 de la distancia de sus vértices al eje del hueso
  const radio = (L, a, b, def) => { if (!a || !b || L.length < 10) return def; const ab = b.clone().sub(a), l2 = ab.lengthSq(), d = [];
    for (const q of L) { const u = Math.min(1, Math.max(0, q.clone().sub(a).dot(ab) / l2)); d.push(q.distanceTo(a.clone().addScaledVector(ab, u))); }
    d.sort((x, y) => x - y); return d[Math.floor(d.length * 0.85)]; };
  const piezas = { chest: gPecho.concat(gCapa), [H.spine ? 'spine' : 'chest']: gCol, hips: gFalda };
  for (const s of ['L', 'R']) {
    const h = J('uparm' + s), c = J('forearm' + s), m = J('hand' + s); if (!h || !c || !m) continue;
    const r1 = Math.min(0.085, Math.max(0.045, radio(G['brazo' + s], h, c, 0.06) + 0.014)), r2 = Math.min(0.075, Math.max(0.04, radio(G['ant' + s], c, m, 0.05) + 0.012));
    const d1 = c.clone().sub(h).normalize(), d2 = m.clone().sub(c).normalize();
    piezas['uparm' + s] = [manga(h.clone().addScaledVector(d1, -0.05), c.clone().addScaledVector(d1, 0.035), r1 * 1.05, r1 * 0.95, false)];
    piezas['forearm' + s] = [manga(c.clone().addScaledVector(d2, -0.04), m.clone().addScaledVector(d2, -0.015), r2 * 1.08, r2 * 1.12, true)];
  }
  const [mat, blanco] = matSotana(), g = new THREE.Group(); g.name = 'sotana';
  for (const [hueso, gs] of Object.entries(piezas)) {
    const me = new THREE.Mesh(mergeGeometries(gs), mat); me.name = 'sotana_' + hueso; me.castShadow = false; me.frustumCulled = false; me.userData.varNPC = true;
    p.g.add(me); p.g.updateMatrixWorld(true); (H[hueso] || p.escena).attach(me); g.userData[hueso] = me;
  }
  // alzacuello: banda blanca que asoma sobre el cuello de la sotana (cuello)
  const az = new THREE.Mesh(new THREE.CylinderGeometry(rC + 0.006, rC + 0.009, 0.03, 24, 1, true), blanco); az.scale.z = rCz / rC;
  az.position.set(0, yCue + 0.028, mc.cz); az.name = 'alzacuello'; az.frustumCulled = false; az.userData.varNPC = true;
  p.g.add(az); p.g.updateMatrixWorld(true); (H.neck || p.escena).attach(az);
  if (URLP.has('cvdiag')) {   // diagnóstico: cuánto se sale el cuerpo (entre hombros) de cada anillo del cuerpo de la sotana (>1 = asoma)
    const fuera = torso.map(a => { let mx = 0; for (const q of entre) if (Math.abs(q.y - a.y) < 0.03) mx = Math.max(mx, (q.x / a.rx) ** 2 + ((q.z - a.cz) / a.rz) ** 2); return a.y.toFixed(2) + ':' + a.rx.toFixed(2) + '/' + a.rz.toFixed(2) + '/' + a.cz.toFixed(2) + '→' + Math.sqrt(mx).toFixed(2); });
    console.warn('SOTANA yCue ' + yCue.toFixed(2) + ' yCad ' + yCad.toFixed(2) + ' yCin ' + yCin.toFixed(2) + ' yFaja ' + yFaja.toFixed(2) + ' yPe ' + yPe.toFixed(2) + ' yHom ' + yHom.toFixed(2) + ' xHom ' + xHom.toFixed(2) + ' n ' + JSON.stringify(Object.fromEntries(Object.entries(G).map(([k, l]) => [k, l.length]))) + ' anillos ' + fuera.join(' '));
  }
  if (URLP.has('cvinfo')) console.log('sotana', { yCue, yCad, yCin, yPe, yHom, xHom, falda: [falda[0].rx, falda[0].rz, ult.rx, ult.rz].map(x => +x.toFixed(3)), rC });
  return g;
}

export function bodaIglesia(M, def) {
  if (URLP.get('bodaiglesia') === '0' || ![2, 4].includes(def.numero)) return null;   // N0-FABLE-1611 (C2): sin boda en el N3 (1945, la tragedia del humo)
  const S = M.R && M.R.salas && M.R.salas.iglesia; if (!S) return null;
  const O = S.origen, raiz = new THREE.Group(); raiz.name = 'bodaIglesia'; raiz.position.set(O.x, O.y || 0, O.z); S.grupo.add(raiz);
  const gente = []; let armando = false, lista = false, t = 0, cuadro = 0;
  const poner = (T, x, y, z, rot, op = {}) => {
    const p = crearPersona(T, op.variar ? { variar: op.variar } : {}); p.g.position.set(x, y, z); p.g.rotation.y = rot; raiz.add(p.g);
    const q = { id: T.id, p, H: huesosDe(p), base: op.base || 'idle', capa: op.capa || null, fase: Math.random() * 6, sentado: !!op.sentado, rol: op.rol || 'invitado', lag: op.lagrima ? 0 : -1 };
    p.poner(q.base, q.capa, { fundido: 0 }); p.actualizar(Math.random() * 2);
    if (op.sentado) {   // el cuerpo baja hasta que la articulación de la cadera queda sobre el asiento (muslos horizontales, pies al suelo)
      p.g.updateMatrixWorld(true);
      const yc = p.g.worldToLocal(q.H.thighL.getWorldPosition(new THREE.Vector3())).y;
      p.escena.position.y -= yc - (ASIENTO + 0.07);
    }
    gente.push(q); return q;
  };
  const armar = async () => {
    armando = true;
    const quiero = ['novia', 'padrino', 'invitado', 'cura', 'gringo', 'joven', 'dama', 'nino2', 'oficinista', 'obrero2', 'obrero20', 'senora', 'senora20', 'invitada', 'abuela'].filter(ok);
    const T = {}; await Promise.all(quiero.map(id => cargarTipo(id).then(x => { T[id] = x; }).catch(() => {})));
    if (!T.novia) { lista = true; return; }
    // novios en el pasillo frente a las gradas, mirando al altar (−z = rot π); la novia a la izquierda del novio, con el ramo
    const zN = Z_GRADAS + 3.15 + 0.45;
    poner(T.novia, -0.42, 0, zN, Math.PI, { capa: 'b_ramo', rol: 'novia' });
    const novio = T.padrino ? 'padrino' : T.invitado ? 'invitado' : null;
    if (novio) poner(T[novio], 0.42, 0, zN, Math.PI, { rol: 'novio' });
    // cura arriba de la grada superior, mirando a los novios
    const curaT = T.cura || T.gringo || T.joven;
    if (curaT) { const c = poner(curaT, 0, Y_ESTRADO, Z_GRADAS + 1.7, 0, { rol: 'cura', capa: T.cura ? 'b_brazo' : null, variar: { uniforme: true, sinSombrero: true } }); if (!T.cura && URLP.get('cvsotana') !== '0') ponerSotana(c.p, c.H); }   // &cvsotana=0: sin sotana (A/B)
    // damas de honor (o un paje) a los lados de los novios, delante de la primera banca (sin pisar las rodillas de los sentados)
    const nina = T.dama ? 'dama' : T.nino2 ? 'nino2' : null;
    if (nina) for (const s of [-1, 1]) poner(T[nina], s * 1.25, 0, zN - 0.3, Math.PI + s * 0.35, { capa: nina === 'dama' ? 'b_ramo' : null, rol: 'dama' });
    // invitados sentados en las 4 bancas delanteras (filas 6-9), 1-2 por banca; los tipos se reparten sin repetir el vecino
    const inv = ['oficinista', 'senora', 'abuela', 'senora20', 'invitada', 'obrero20', 'joven', 'gringo', 'invitado'].filter(id => T[id] && id !== novio && !(curaT === T[id] && !T.cura));
    let k = 0;
    if (inv.length) for (let i = 9; i >= 6; i--) for (const s of [-1, 1]) for (const dx of (i % 2 ? [-0.5, 0.45] : [0.05])) {
      const id = inv[k++ % inv.length], x = s * 1.85 + dx + (Math.random() - 0.5) * 0.08, z = BANCA(i) + 0.08;
      poner(T[id], x, 0, z, Math.PI + (Math.random() - 0.5) * 0.12, { sentado: true, lagrima: k === 3 || k === 10 });
    }
    lista = true;
    if (URLP.has('cvinfo')) console.log('boda en la iglesia', gente.map(q => q.rol + ':' + q.p.g.position.toArray().map(v => v.toFixed(2)).join(',')));
  };
  const ent = M.L.agregar({ tipo: 'bodaIglesia', vivo: true, sala: 'iglesia', act(dt) {
    if (!lista) { if (!armando) armar(); return; }
    t += dt; cuadro++;
    const cc = M.cam && M.cam.cam, cam = cc ? cc.position : M.jug.pos;
    // cierre 15-11 (rendimiento iGPU, antes 14-19 fps): recorte por cámara (crearPersona deja frustumCulled=false: antes se dibujaban las 17
    // personas aunque quedaran detrás), sentados con la malla lejana (2,5 mil caras) pasados 6 m y animados cada 2-4 cuadros
    let fr = null; if (cc) { cc.updateMatrixWorld(); _pm.multiplyMatrices(cc.projectionMatrix, cc.matrixWorldInverse); fr = _fr.setFromProjectionMatrix(_pm); }
    for (let i = 0; i < gente.length; i++) {
      const q = gente[i], p = q.p;
      p.g.getWorldPosition(_c); const d = _c.distanceTo(cam);
      _esf.center.copy(_c); _esf.center.y += 0.8; const ver = !fr || fr.intersectsSphere(_esf);
      if (p.g.visible !== ver) p.g.visible = ver;
      if (!ver) continue;
      p.lod(q.sentado ? (d < 4 ? 0 : d < 14 ? 1 : 2) : d < 6 ? 0 : d < 22 ? 1 : 2, i < 2 && d < 14);   // 16-11 (Diego: invitados manchados): la malla lejana (2,5 mil caras) solo pasados 14 m; de cerca, la alta   // alta solo los de pie muy cerca; sombra solo los novios
      const cada = q.sentado ? (d < 8 ? 2 : 4) : d < 8 ? 1 : 2; if ((cuadro + i) % cada) continue;
      if (q.rol === 'cura') {   // bendice (brazo en alto) y habla, alternando
        const ben = Math.sin(t * 0.45 + 1) > 0.2; p.poner(ben ? 'idle' : 'hablar', ben ? 'b_brazo' : null);
      } else if (q.rol === 'novio' || q.rol === 'novia') {
        p.poner('idle', q.capa);
      }
      p.actualizar(dt * cada);
      if (q.sentado) {
        let lag = 0; if (q.lag >= 0) { const c = (t + q.fase) % 9; lag = c < 0.8 ? c / 0.8 : c < 2.6 ? 1 : c < 3.4 ? 1 - (c - 2.6) / 0.8 : 0; }
        poseSentado(p.g, q.H, lag);
      }
    }
  } });
  return { raiz, gente, ent, get lista() { return lista; }, get t() { return t; } };
}
