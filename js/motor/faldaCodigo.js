// N0-CIUDAD-VIVA (16-11-2026, carril animador): FALDA LARGA EN CÓDIGO para mujeres y niñas de la ciudad viva (madre, muchacha, nina,
// invitada). TRELLIS no sabe hacer faldas oscuras largas: salen con vetas y motas claras y el ruedo se deshilacha al caminar (3 semillas
// fallidas por tipo, capturas/vida/ciudadviva/hoja_*_DESCARTADA.jpg). Como la sotana del cura (bodaIglesia.js ponerSotana), aquí se usa
// SOLO el torso y la cabeza de la malla TRELLIS y la falda se hace en código:
//  1) prepararFalda(T) (una vez por tipo, al cargar): en las 3 mallas (alta, baja, lejos) se borran los triángulos de la falda vieja
//     (vértices bajo el corte con peso dominante de cadera/columna/piernas), salvo las canillas y los zapatos que quedan bajo el ruedo
//     nuevo (cápsula alrededor del eje de cada pierna medido en la malla), que se re-pesan a muslo/canilla/pie (en la malla original
//     los pies venían pesados como tela: cadera 50 % + muslos). Los trozos de falda pesados a las manos (brazos colgando) también se van.
//     De la falda vieja se toma solo la SILUETA (elipse por altura: ancho, frente y espalda), monótona hacia el ruedo.
//  2) ponerFalda(P, T) (una por persona): campana de anillos pegada al hueso de la cadera (matriz de enlace: no hay que medir nada por
//     cuadro), pliegues más hondos atrás y abajo, ruedo con vuelta hacia adentro, pretina (faja) donde la blusa va metida y, en la madre,
//     delantal blanco. Cada cuadro (en actualizar) se leen muslo, rodilla, tobillo y punta del pie RELATIVOS A LA CADERA y (a) el centro
//     de los anillos se corre un poco hacia donde van las piernas (balanceo leve, más abajo más) y (b) cada anillo se abomba lo justo para
//     encerrar las piernas (función de apoyo de un disco por pierna): la rodilla y el pie que avanzan empujan la tela y no la atraviesan.
//  Color de época (negro, gris, café, azul oscuro) por persona desde la variante de variacionNPC (v.rb: la firma de NPC únicos ya lo cuenta).
// URL: &cvfalda=0 apaga todo (vuelve la malla TRELLIS entera) · &cvcorte=0.9 prueba otra altura de corte (m) · &cvsinfalda=1 oculta la falda (QC).
import * as THREE from 'three';

const URLP = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
// corte: altura (m, malla de la semilla elegida) desde donde se borra la falda vieja; ruedo: altura del borde nuevo;
// faja: la blusa va metida (pretina a la vista); si no, la falda sale por dentro de la chaqueta/chaleco
export const FALDAS = {
  madre: { sem: 31, lejosBaja: true, corte: 0.972, ruedo: 0.15, faja: true, delantal: true, def: 0x3a2a22 },   // blusa granate metida + delantal
  muchacha: { sem: 43, corte: 0.86, ruedo: 0.2, faja: false, def: 0x232b3e },                   // chaleco gris de lana encima
  nina: { sem: 47, lejosBaja: true, corte: 0.79, ruedo: 0.3, faja: true, nino: true, def: 0x1d2333 },             // jumper (pechera azul) sobre blusa, a la rodilla
  // invitada: DESCARTADA también con falda de código (s31 dedos rojos, restos del floreado bajo la chaqueta y LOD bajo con parches azules en
  // la espalda; s43 manos y cara rojas; s41 manos naranjas; s17 manchas naranjas en el pecho; s7 colores chillones)
};
const COL = [0x1e1d21, 0x45454a, 0x4a3426, 0x222a3d, 0x2e2d31, 0x3a2a20, 0x1d2333, 0x55504a];   // negro, gris, café, azul oscuro… (= 8 de PAL.falda)
const COL_NINA = [0x1d2333, 0x45454a, 0x4a3426, 0x1e1d21, 0x26304a, 0x55504a];                  // (= 6 de PAL.ninoAbajo)
const DELANTAL = [0xe4ded0, 0xd8d0be, 0xcfc7b4, 0xe8e4da];
const NF = 13, SEG = 44;   // anillos de la campana y segmentos por anillo

const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const dominante = (si, sw, i) => { let b = si.getX(i), w = sw.getX(i); if (sw.getY(i) > w) { w = sw.getY(i); b = si.getY(i); } if (sw.getZ(i) > w) { w = sw.getZ(i); b = si.getZ(i); } if (sw.getW(i) > w) b = si.getW(i); return b; };
const pct = (a, p) => { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const distSeg = (p, a, b) => { const ab = _v.copy(b).sub(a), t = Math.max(0, Math.min(1, ab.dot(p.clone().sub(a)) / Math.max(1e-9, ab.lengthSq()))); return p.distanceTo(a.clone().addScaledVector(ab, t)); };

// ------------------------------------------------------------------ 1) una vez por tipo
export function prepararFalda(T) {
  const cfg0 = FALDAS[T.id]; if (!cfg0 || T.falda !== undefined || URLP.get('cvfalda') === '0') { T.falda ??= null; return; }
  const cfg = { ...cfg0 }; if (URLP.has('cvcorte')) cfg.corte = +URLP.get('cvcorte');
  const mallas = []; T.gltf.scene.traverse(o => { if (o.isSkinnedMesh && o.geometry.attributes.skinIndex) mallas.push(o); });
  const alta = mallas.find(m => /_alta$/.test(m.name)) || mallas[0]; if (!alta) { T.falda = null; return; }
  const sk = alta.skeleton, idx = n => sk.bones.findIndex(b => b.name === n);
  const J = {}, eje = {};
  sk.bones.forEach((b, i) => { _m.copy(sk.boneInverses[i]).invert(); J[b.name] = new THREE.Vector3().setFromMatrixPosition(_m); eje[b.name] = new THREE.Vector3().setFromMatrixColumn(_m, 1).normalize(); });
  const k = cfg.nino ? 0.82 : 1, lados = { L: Math.sign(J.thighL.x) || 1, R: Math.sign(J.thighR.x) || -1 };
  const pierna = {};
  for (const s of ['L', 'R']) pierna[s] = { hip: J['thigh' + s], rod: J['shin' + s], tob: J['foot' + s], pun: J['foot' + s].clone().addScaledVector(eje['foot' + s], 0.13 * k) };
  const brazos = ['L', 'R'].map(s => [J['uparm' + s], J['forearm' + s], J['hand' + s], J['hand' + s].clone().addScaledVector(eje['hand' + s], 0.17 * k)]);
  const esBrazo = n => /^(clav|uparm|forearm|hand)/.test(n), bind = alta.bindMatrix;
  // silueta de la falda vieja (vértices borrados, sin brazos) y del torso que queda justo sobre el corte
  const sil = [], tor = [];
  let borradas = 0, total = 0;
  for (const m of mallas) {
    const ge = m.geometry, P = ge.attributes.position, SI = ge.attributes.skinIndex, SW = ge.attributes.skinWeight, n = P.count, fuera = new Uint8Array(n), q = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      q.fromBufferAttribute(P, i).applyMatrix4(m.bindMatrix);
      if (q.y >= cfg.corte) { if (m === alta && q.y < cfg.corte + 0.05 && !esBrazo(sk.bones[dominante(SI, SW, i)].name)) tor.push(q.clone()); continue; }
      const nb = m.skeleton.bones[dominante(SI, SW, i)].name;
      if (esBrazo(nb)) {   // mano o antebrazo colgando junto a la falda: se queda solo lo que está pegado al hueso
        const b = brazos[q.x * lados.L > 0 ? 0 : 1]; if (Math.min(distSeg(q, b[0], b[1]), distSeg(q, b[1], b[2]), distSeg(q, b[2], b[3])) > 0.075 * k) fuera[i] = 1;
        continue;
      }
      // v6: piernas y zapatos TRELLIS también fuera: van en código sobre los huesos (el esqueleto plantilla gira el pie en otro punto
      // que el tobillo de la malla: con cualquier re-peso el zapato se estiraba o se despegaba de la canilla al despegar el pie)
      fuera[i] = 1; if (m === alta) sil.push(q.clone());
    }
    const I = ge.index ? ge.index.array : null, nt = I ? I.length : n, nuevo = [];
    for (let t = 0; t < nt; t += 3) { const a = I ? I[t] : t, b = I ? I[t + 1] : t + 1, c = I ? I[t + 2] : t + 2; total++; if (fuera[a] || fuera[b] || fuera[c]) { borradas++; continue; } nuevo.push(a, b, c); }
    ge.setIndex(nuevo); ge.computeBoundingSphere();
  }
  // anillos: de 5 cm sobre el corte (por dentro de la ropa de arriba) al ruedo; elipse con frente y espalda propios
  const banda = (L, y, dy = 0.02) => { const xs = [], zs = []; for (const q of L) if (Math.abs(q.y - y) < dy) { xs.push(Math.abs(q.x)); zs.push(q.z); } return xs.length > 10 ? { rx: pct(xs, 0.97), zf: pct(zs, 0.97), zb: pct(zs, 0.03) } : null; };
  const t0 = banda(tor, cfg.corte + 0.02, 0.025) || { rx: 0.16 * k, zf: 0.13 * k, zb: -0.12 * k };
  const an = []; let prev = null;
  for (let j = 0; j <= NF; j++) {
    const y = cfg.corte + 0.05 - (cfg.corte + 0.05 - cfg.ruedo) * Math.pow(j / NF, 0.95), t = Math.max(0, (cfg.corte - y) / (cfg.corte - cfg.ruedo));
    let e = y >= cfg.corte - 0.005 ? null : banda(sil, y);
    if (!e) e = prev ? { ...prev } : { rx: t0.rx * (cfg.faja ? 1 : 0.94), zf: t0.zf * (cfg.faja ? 1 : 0.94), zb: t0.zb * (cfg.faja ? 1 : 0.94) };
    if (y > cfg.corte - 0.005) { const f = cfg.faja ? 0.985 : 0.93; e = { rx: t0.rx * f, zf: (t0.zf - (t0.zf + t0.zb) / 2) * f + (t0.zf + t0.zb) / 2, zb: (t0.zb - (t0.zf + t0.zb) / 2) * f + (t0.zf + t0.zb) / 2 }; }
    if (prev && y < cfg.corte) { e.rx = Math.max(e.rx, prev.rx); e.zf = Math.max(e.zf, prev.zf); e.zb = Math.min(e.zb, prev.zb); }   // nunca se cierra hacia abajo
    prev = { ...e };
    const cz = (e.zf + e.zb) / 2, vuelo = 0.035 * k * Math.pow(t, 1.5);
    an.push({ y, t, cz, rx: e.rx + 0.008 + vuelo, rf: e.zf - cz + 0.008 + vuelo, rb: cz - e.zb + 0.008 + vuelo * 1.2 });
  }
  // tope del vuelo (TRELLIS a veces abre el ruedo en abanico): no más de 13 cm sobre la cadera
  const cad = an.reduce((a, b) => (Math.abs(b.y - J.thighL.y) < Math.abs(a.y - J.thighL.y) ? b : a), an[0]);
  for (const a of an) if (a.y < cad.y) { const tope = 0.13 * k * Math.min(1, (cad.y - a.y) / Math.max(0.1, cad.y - cfg.ruedo)) + 0.01; a.rx = Math.min(a.rx, cad.rx + tope); a.rf = Math.min(a.rf, cad.rf + tope); a.rb = Math.min(a.rb, cad.rb + tope); }
  // matrices: hueso de la cadera ↔ espacio de enlace; punta del pie en el marco del pie (para leerla cada cuadro)
  const iH = idx('hips'), deEnlace = new THREE.Matrix4().copy(sk.boneInverses[iH]).multiply(bind);   // enlace → local de la cadera
  const aEnlace = deEnlace.clone().invert();
  // piernas (empujan la tela) y piernas de código, cada punto en el marco de su hueso: cadera (muslo), rodilla y tobillo (canilla), punta (pie)
  const enHueso = (n, q) => q.clone().applyMatrix4(new THREE.Matrix4().copy(sk.boneInverses[idx(n)]).multiply(bind));
  const loc = {}, reposo = {}, piernas = {};
  for (const s of ['L', 'R']) { const p = pierna[s];
    loc[s] = [enHueso('thigh' + s, p.hip), enHueso('shin' + s, p.rod), enHueso('shin' + s, p.tob), enHueso('foot' + s, p.pun)]; reposo[s] = { rod: p.rod, tob: p.tob };
    const f = new THREE.Vector3(eje['foot' + s].x, 0, eje['foot' + s].z).normalize();   // adelante del pie, horizontal
    piernas[s] = { rod: p.rod, tob: p.tob, f, inv: { shin: new THREE.Matrix4().copy(sk.boneInverses[idx('shin' + s)]).multiply(bind), foot: new THREE.Matrix4().copy(sk.boneInverses[idx('foot' + s)]).multiply(bind) } }; }
  T.falda = { cfg, an, deEnlace, aEnlace, loc, reposo, k, corte: cfg.corte, faja: t0, borradas, total, cad, piernas };
  if (URLP.has('cvinfo')) console.log('falda', T.id, { borradas, total, anillos: an.map(a => [a.y, a.rx, a.rf, a.rb].map(x => +x.toFixed(3)).join('/')) });
}

// ------------------------------------------------------------------ 2) una por persona
let MAT = null;
function material() {
  if (MAT) return MAT;
  MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  MAT.onBeforeCompile = sh => {   // = mallaCiudad (brillo propio 0,22 del albedo: la tela no queda más oscura que la blusa) + brillo rasante de la lana
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += 0.22 * diffuseColor.rgb;\n{ float fr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 3.0); totalEmissiveRadiance += 0.07 * fr * vec3(0.6, 0.6, 0.66); }');
  };
  MAT.customProgramCacheKey = () => 'faldaCod16';
  return MAT;
}
export function ponerFalda(P, T) {
  const F = T.falda; if (!F) return null;
  const H = {}; P.escena.traverse(o => { if (o.isBone) H[o.name] = o; });
  if (!H.hips || !H.thighL || !H.shinL || !H.footL || !H.thighR || !H.shinR || !H.footR) return null;
  const v = P.variacion && P.variacion.v, nina = !!F.cfg.nino;
  const pal = nina ? COL_NINA : COL, base = new THREE.Color(v && !v.original && v.rb >= 0 ? pal[v.rb % pal.length] : F.cfg.def);
  const blanco = new THREE.Color(DELANTAL[v && v.delantal >= 0 ? v.delantal % DELANTAL.length : 0]);
  const an = F.an, nA = an.length, sn = new Float32Array(SEG), cs = new Float32Array(SEG), pl = new Float32Array(nA * SEG);
  for (let i = 0; i < SEG; i++) { const th = i / SEG * Math.PI * 2; sn[i] = Math.sin(th); cs[i] = Math.cos(th); }
  // pliegues: más hondos atrás y abajo (= sotana); la amplitud crece hacia el ruedo
  for (let j = 0; j < nA; j++) for (let i = 0; i < SEG; i++) { const th = i / SEG * Math.PI * 2, atras = 0.55 + 0.45 * (1 - Math.cos(th)) / 2; pl[j * SEG + i] = (0.003 + 0.013 * an[j].t) * F.k * atras * Math.cos(th * 9 + Math.sin(th * 3) * 0.6); }
  // geometría: campana (nA × SEG) + vuelta del ruedo (SEG) + pretina (3 × SEG, si va metida) + delantal (filas × columnas, madre)
  const fajaN = F.cfg.faja ? 3 : 0, DEL = F.cfg.delantal ? { a: 1.05, cols: 15, filas: Math.max(3, an.findIndex(a => a.y < F.cfg.ruedo + 0.13) + 1) } : null;
  const nV = nA * SEG + SEG + fajaN * SEG + (DEL ? DEL.filas * DEL.cols : 0);
  const pos = new Float32Array(nV * 3), col = new Float32Array(nV * 3), idx = [], c = new THREE.Color();
  const pintar = (vi, cc, f) => { col[vi * 3] = cc.r * f; col[vi * 3 + 1] = cc.g * f; col[vi * 3 + 2] = cc.b * f; };
  const tubo = (o, filas, cols, cerrado, haciaAfuera = true) => { const cc = cerrado ? cols : cols - 1;
    for (let j = 0; j < filas - 1; j++) for (let i = 0; i < cc; i++) { const a = o + j * cols + i, b = o + j * cols + (i + 1) % cols, d = a + cols, e = b + cols; if (haciaAfuera) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d); } };
  for (let j = 0; j < nA; j++) for (let i = 0; i < SEG; i++) { const p = pl[j * SEG + i], amp = (0.003 + 0.013 * an[j].t) * F.k + 1e-4; pintar(j * SEG + i, base, (0.74 + 0.26 * Math.min(1, Math.max(0, 0.5 + p / (2 * amp)))) * (j === nA - 1 ? 0.82 : 1)); }
  tubo(0, nA, SEG, true);
  const oL = nA * SEG; for (let i = 0; i < SEG; i++) pintar(oL + i, base, 0.45); for (let i = 0; i < SEG; i++) { const a = (nA - 1) * SEG + i, b = (nA - 1) * SEG + (i + 1) % SEG; idx.push(a, b, oL + i, b, oL + (i + 1) % SEG, oL + i); }
  const oF = oL + SEG; if (fajaN) { for (let j = 0; j < 3; j++) for (let i = 0; i < SEG; i++) pintar(oF + j * SEG + i, F.cfg.delantal ? blanco : base, F.cfg.delantal ? (j === 1 ? 0.95 : 0.8) : (j === 1 ? 0.72 : 0.6)); tubo(oF, 3, SEG, true); }
  const oD = oF + fajaN * SEG; if (DEL) { for (let j = 0; j < DEL.filas; j++) for (let i = 0; i < DEL.cols; i++) pintar(oD + j * DEL.cols + i, blanco, (j === DEL.filas - 1 ? 0.86 : 1) * (0.93 + 0.07 * Math.cos(i * 1.7))); tubo(oD, DEL.filas, DEL.cols, false); }
  const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ge.setAttribute('color', new THREE.BufferAttribute(col, 3)); ge.setIndex(idx);
  const malla = new THREE.Mesh(ge, material()); malla.name = 'falda_' + T.id; malla.frustumCulled = false; malla.castShadow = false; malla.receiveShadow = false;
  malla.matrixAutoUpdate = false; malla.matrix.copy(F.deEnlace); H.hips.add(malla); if (URLP.has('cvsinfalda')) malla.visible = false;   // la geometría queda en el espacio de enlace (metros, y arriba)
  // ---- cada cuadro: piernas relativas a la cadera → espacio de enlace
  const L = { L: { th: H.thighL, sh: H.shinL, ft: H.footL }, R: { th: H.thighR, sh: H.shinR, ft: H.footR } };
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mC = new THREE.Matrix4(), pts = { L: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], R: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
  // v2: solo empujan el muslo y la mitad de arriba de la canilla (el pie y el tobillo pueden asomar bajo el ruedo, como en una falda de
  // verdad; en la v1 el pie de atrás estiraba el ruedo en cola), con tope de abombado y caída de la tela bajo la rodilla
  const RL = [0.085, 0.066].map(x => x * F.k), RA = new Float32Array(nA * SEG), CX = new Float32Array(nA), CZ = new Float32Array(nA), MUESTRAS = 8, TOPE = 0.3 * F.k;
  let cuenta = 0;
  const actualizar = (nivel = 0) => {
    if (nivel === 2 && (cuenta++ % 3)) return;
    for (const s of ['L', 'R']) {
      const b = L[s]; b.th.updateMatrix(); b.sh.updateMatrix(); b.ft.updateMatrix();
      mA.copy(b.th.matrix); mB.multiplyMatrices(mA, b.sh.matrix); mC.multiplyMatrices(mB, b.ft.matrix);
      const p = pts[s], l = F.loc[s]; p[0].copy(l[0]).applyMatrix4(mA).applyMatrix4(F.aEnlace); p[1].copy(l[1]).applyMatrix4(mB).applyMatrix4(F.aEnlace);
      p[2].copy(l[2]).applyMatrix4(mB).applyMatrix4(F.aEnlace); p[3].copy(l[3]).applyMatrix4(mC).applyMatrix4(F.aEnlace);
    }
    // balanceo: desplazamiento medio de rodillas (arriba) y tobillos (abajo) respecto del reposo
    const dkx = (pts.L[1].x - F.reposo.L.rod.x + pts.R[1].x - F.reposo.R.rod.x) / 2, dkz = (pts.L[1].z - F.reposo.L.rod.z + pts.R[1].z - F.reposo.R.rod.z) / 2;
    const dax = (pts.L[2].x - F.reposo.L.tob.x + pts.R[2].x - F.reposo.R.tob.x) / 2, daz = (pts.L[2].z - F.reposo.L.tob.z + pts.R[2].z - F.reposo.R.tob.z) / 2;
    for (let j = 0; j < nA; j++) {
      const a = an[j], t = a.t, sw = 0.4 * Math.pow(t, 1.3), cx = (dkx * (1 - t) + dax * t) * sw, cz = a.cz + (dkz * (1 - t) + daz * t) * sw, o = j * SEG; CX[j] = cx; CZ[j] = cz;
      for (let i = 0; i < SEG; i++) { const rz = cs[i] > 0 ? a.rf : a.rb; RA[o + i] = 1 / Math.sqrt((sn[i] / a.rx) ** 2 + (cs[i] / rz) ** 2); }   // radio de la elipse en θ
      if (t > 0.02) for (const s of ['L', 'R']) { const p = pts[s];
        for (let g = 0; g < 2; g++) { const A = p[g], B = p[g + 1], rl = RL[g] + 0.012, uMax = g ? 0.8 : 1;
          if (Math.min(A.y, B.y) - rl > a.y || Math.max(A.y, B.y) + rl < a.y) continue;
          for (let m = 0; m <= MUESTRAS; m++) { const u = m / MUESTRAS * uMax, y = A.y + (B.y - A.y) * u, dy = y - a.y; if (Math.abs(dy) >= rl) continue;
            const rr = Math.sqrt(rl * rl - dy * dy), qx = A.x + (B.x - A.x) * u - cx, qz = A.z + (B.z - A.z) * u - cz;
            for (let i = 0; i < SEG; i++) { const r0 = RA[o + i], need = Math.min(qx * sn[i] + qz * cs[i] + rr, r0 + TOPE); if (need > r0 - 0.02) RA[o + i] = 0.5 * (r0 + need + Math.sqrt((r0 - need) ** 2 + 0.0004)); } } } }
      if (j > 0) { const dyj = an[j - 1].y - a.y; for (let i = 0; i < SEG; i++) RA[o + i] = Math.max(RA[o + i], RA[o - SEG + i] - 0.08 * dyj); }   // la tela cae desde la rodilla (no se mete)
    }
    for (let j = 0; j < nA; j++) {
      const a = an[j], cx = CX[j], cz = CZ[j], o = j * SEG;
      for (let i = 0; i < SEG; i++) { const r = RA[o + i] + pl[o + i], vi = (o + i) * 3; pos[vi] = cx + sn[i] * r; pos[vi + 1] = a.y; pos[vi + 2] = cz + cs[i] * r;
        if (j === nA - 1) { const li = (oL + i) * 3, rr = r * 0.9 - 0.008; pos[li] = cx + sn[i] * rr; pos[li + 1] = a.y + 0.02; pos[li + 2] = cz + cs[i] * rr; } }
      if (DEL && j < DEL.filas) for (let i = 0; i < DEL.cols; i++) {   // delantal: sector de adelante, 7 mm por fuera de la falda
        const th = (i / (DEL.cols - 1) - 0.5) * DEL.a * 2, s_ = Math.sin(th), c_ = Math.cos(th), fi = Math.round(((th + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SEG) % SEG;
        const r = RA[o + fi] + Math.max(0, pl[o + fi]) + 0.007, vi = (oD + j * DEL.cols + i) * 3, yy = j === 0 ? Math.min(a.y, F.corte + 0.01) : a.y;
        pos[vi] = cx + s_ * r; pos[vi + 1] = yy; pos[vi + 2] = cz + c_ * r;
      }
    }
    if (fajaN) {   // pretina: tapa la costura blusa/falda (rígida a la cadera)
      const f = F.faja, czf = (f.zf + f.zb) / 2, j0 = an.findIndex(a => a.y < F.corte), a0 = an[Math.max(0, j0)];
      const rx = Math.max(f.rx, a0.rx) + 0.01, rf = Math.max(f.zf - czf, a0.rf) + 0.01, rb = Math.max(czf - f.zb, a0.rb) + 0.01;
      [F.corte + 0.028, F.corte, F.corte - 0.03].forEach((y, j) => { const e = j === 1 ? 0.004 : 0; for (let i = 0; i < SEG; i++) { const rz = cs[i] > 0 ? rf : rb, r = 1 / Math.sqrt((sn[i] / (rx + e)) ** 2 + (cs[i] / (rz + e)) ** 2), vi = (oF + j * SEG + i) * 3; pos[vi] = sn[i] * r; pos[vi + 1] = y; pos[vi + 2] = czf + cs[i] * r; } });
    }
    ge.attributes.position.needsUpdate = true; ge.computeVertexNormals();
  };
  actualizar(0);
  const extra = [];
  // v6: piernas (medias) y zapatos de código sobre los huesos de canilla y pie: giran en el mismo tobillo, nada se estira ni se despega.
  // Medias oscuras de época en las mujeres (negro, café, gris); en la niña blancas, negras o café; zapatos de cuero negro o café.
  const MED = F.cfg.nino ? [0xe6e2d8, 0x2c2826, 0x5a4a3c, 0xd8d2c4] : [0x2a2624, 0x4a3c32, 0x56524e, 0x3a302a], ZAP = [0x1b1917, 0x3a2618, 0x2a201a];
  const vv = v && !v.original, cm = new THREE.Color(MED[vv && v.ra >= 0 ? v.ra % MED.length : 0]), cz = new THREE.Color(ZAP[vv && v.pelo >= 0 ? v.pelo % ZAP.length : 0]);
  const colorear = (g, c, f) => { const n = g.attributes.position.count, cc = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const k = f ? f(i) : 1; cc.set([c.r * k, c.g * k, c.b * k], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
  const tuboM = (a, b, r0, r1) => { const d = b.clone().sub(a), l = d.length(), g = new THREE.CylinderGeometry(r1, r0, l, 12, 1, false); g.translate(0, l / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
    return colorear(g, cm, i => 0.9 + 0.1 * (g.attributes.normal.getY(i) + 1) / 2); };
  const k = F.k, kk = F.cfg.nino ? 1 : 1.2;
  for (const s of ['L', 'R']) { const M = F.piernas[s];
    const arriba = M.rod.clone().add(new THREE.Vector3(0, 0.06 * k, 0)), rod = colorear(new THREE.SphereGeometry(0.046 * kk, 12, 8).translate(arriba.x, arriba.y, arriba.z), cm);
    const zap = new THREE.SphereGeometry(1, 16, 10); zap.scale(0.043 * kk, 0.042 * k, 0.122 * k);   // zapato: elipsoide con suela plana
    const base = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0).cross(M.f).normalize(), new THREE.Vector3(0, 1, 0), M.f).setPosition(M.tob.x + M.f.x * 0.045 * k, 0.038 * k, M.tob.z + M.f.z * 0.045 * k);
    zap.applyMatrix4(base); { const P = zap.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) < 0.008) P.setY(i, 0.008); zap.computeVertexNormals(); }
    colorear(zap, cz, i => zap.attributes.position.getY(i) < 0.014 ? 0.55 : 1);
    for (const [h, g] of [['shin', tuboM(M.tob.clone().add(new THREE.Vector3(0, -0.02 * k, 0)), arriba, 0.034 * kk, 0.044 * kk)], ['shin', rod], ['foot', zap]]) {
      const me = new THREE.Mesh(g, material()); me.matrixAutoUpdate = false; me.matrix.copy(M.inv[h]); me.frustumCulled = false; me.name = 'pierna_' + h + s; H[h + s].add(me); extra.push(me); }
  }
  return { malla, actualizar, sombra(b) { malla.castShadow = b; for (const e of extra) e.castShadow = b; } };
}
