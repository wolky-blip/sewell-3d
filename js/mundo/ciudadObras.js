// Obras de Sewell en cono (?sewell=cono, carril «ciudad»): terrazas de calles y edificios, calles con muro de contención,
// barandas con aberturas, y edificios girados según la ladera. El trazado sale de ciudad.js; construir.js solo llama a
// terrazasCono (antes de las terrazas de las escaleras), obrasCono (al final) y edificioGirado (edificios con «giro»).
import * as THREE from 'three';
import { altura, matMundo, CONO } from './terreno.js';
import { TC, CALLE, FRENTE, TERRAZA, MURO, MARGEN, polar, enAnillo, rectTramo, puntoCalle } from './ciudad.js';

// altura de cada anillo: la de la escalera central donde la cruza (o la de la plaza de donde sale)
function alturasAnillos(def) {
  const escs = def.elementos.filter(e => e.t === 'escalera' && Math.abs(e.x0) < 1 && Math.abs(e.x1) < 1);
  const plazas = def.elementos.filter(e => e.t === 'plaza' && e.y != null && Math.abs(e.x) < 20);
  for (const A of def.cono.anillos) {
    const t = A.ta, p = plazas.find(p => t >= -p.z - p.sz / 2 && t <= -p.z + p.sz / 2);
    if (p) { A.y = p.y; A.plaza = p; continue; }
    const e = escs.find(e => t >= -e.z0 && t <= -e.z1);
    if (!e) { A.y = altura(0, -t); continue; }
    const y0 = e.y0 ?? altura(e.x0, e.z0) + 0.25, y1 = e.y1 ?? altura(e.x1, e.z1) + 0.25;
    A.y = y0 + (y1 - y0) * (t + e.z0) / (e.z0 - e.z1); A.escalera = e;
  }
}
// tramos de una calle (ángulos), de a lo más «largo» metros medidos en el radio R
// cortados en los bordes de las muescas de las escaleras secundarias (ensanchadas «ext» metros); cada tramo dice si es muesca
function tramos(L, R, largo, ext = 0) {
  const a = Math.min(L.f0, L.f1), b = Math.max(L.f0, L.f1), cortes = [a, b];
  const H = L.huecos.map(([h0, h1]) => [h0 - ext / R, h1 + ext / R]);
  for (const [h0, h1] of H) for (const c of [h0, h1]) if (c > a && c < b) cortes.push(c);
  cortes.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i < cortes.length - 1; i++) {
    const c0 = cortes[i], c1 = cortes[i + 1]; if (c1 - c0 < 1e-6) continue;
    const m = (c0 + c1) / 2, hueco = H.some(([h0, h1]) => m > h0 && m < h1), n = Math.max(1, Math.ceil((c1 - c0) * R / largo));
    for (let k = 0; k < n; k++) out.push([c0 + (c1 - c0) * k / n, c0 + (c1 - c0) * (k + 1) / n, hueco]);
  }
  return out;
}
const enHueco = (L, f) => L.huecos.some(([a, b]) => f > a && f < b);
const terraza = (x, z, th, hx, hz, m, y) => ({ x, z, c: Math.cos(th), s: -Math.sin(th), hx, hz, m, r: Math.hypot(hx, hz) + m, y, prioridad: true });

// T-B1 (auditor 14-11): camarotes verde, cobalto y crema del N3 con la ladera de atrás 2,7-3,1 m sobre su piso en las esquinas traseras
// (la malla del terreno, con vértices cada 5 m, subía justo en el borde del lote): su terraza se ensancha estos metros
const MAS_MARGEN = [[-51.88, -115.09, 3], [-121.97, -413.72, 3], [-89.81, -419.32, 3]];
// se llama antes de las terrazas de las escaleras (ganan las de aquí donde se pisan: descansos y calles)
export function terrazasCono(def, T) {
  alturasAnillos(def);
  const A = def.cono.anillos;
  // calles (primero: ganan sobre el margen de los edificios del anillo de abajo): franja plana justo bajo el pavimento,
  // de 3 m dentro del frente de los edificios hasta el borde de la terraza de piedra (ahí el terreno baja al anillo de abajo)
  const r0 = -CALLE - FRENTE - 3;
  for (const a of A) for (const L of Object.values(a.lados)) for (const [f0, f1, hueco] of tramos(L, a.R, 8, 4)) {
    const r1 = hueco ? CALLE : CALLE + TERRAZA;   // en la muesca la escalera secundaria baja por la terraza
    const q = rectTramo(a.ta, f0, f1, r0, r1);   // N2-C23: la calle ondula (cuerda entre las puntas del tramo)
    T.push(terraza(q.x, q.z, q.th, q.hx + 0.4, q.hz, 0.4, a.y - 0.05));
  }
  // edificios de los anillos: terraza plana a la cota de su calle
  for (const e of def.elementos) if (e.t === 'edificio' && e.anillo != null) {
    const th = e.giro * Math.PI / 180;
    const mg = MARGEN + (MAS_MARGEN.find(([x, z]) => Math.hypot(e.x - x, e.z - z) < 1)?.[2] ?? 0);   // T-B1
    T.push(terraza(e.x, e.z, th, e.largo / 2 + mg, e.ancho / 2 + mg, 3, A[e.anillo].y - 0.05));
  }
  // entre dos edificios vecinos de la misma calle (a ≤ 10 m) el suelo queda plano: sin eso la malla del terreno levantaba un
  // montículo en la brecha (p. ej. ~2 m entre las alas del hospital, N4)
  const ext = (e, ux, uz) => { const g = e.giro * Math.PI / 180, c = Math.cos(g), s = Math.sin(g); return Math.abs(e.largo / 2 * (ux * c - uz * s)) + Math.abs(e.ancho / 2 * (ux * s + uz * c)); };
  const anil = def.elementos.filter(e => e.t === 'edificio' && e.anillo != null);
  for (let p = 0; p < anil.length; p++) for (let q = p + 1; q < anil.length; q++) {
    const a = anil[p], b = anil[q]; if (a.anillo !== b.anillo) continue;
    const dx = b.x - a.x, dz = b.z - a.z, D = Math.hypot(dx, dz); if (D < 1) continue;
    const ux = dx / D, uz = dz / D, ea = ext(a, ux, uz), libre = D - ea - ext(b, ux, uz); if (libre > 10 || libre < -3) continue;
    const m = Math.max(0, libre) / 2, cx = a.x + ux * (ea + m), cz = a.z + uz * (ea + m);
    T.push(terraza(cx, cz, Math.atan2(-uz, ux), m + MARGEN, Math.min(a.ancho, b.ancho) / 2 + MARGEN, 3, A[a.anillo].y - 0.05));
  }
  // escaleras secundarias: del borde de arriba de la calle de abajo al borde de abajo de la calle de arriba
  for (const e of def.elementos) if (e.t === 'escalera' && e.anillos) { e.y0 = A[e.anillos[0]].y; e.y1 = A[e.anillos[1]].y; }
}

// ------------------------------------------------------------------ obras visibles
function juntar(geos) {   // una sola malla por material (cientos de tramos)
  const pos = [], nor = [], uv = [];
  for (const g of geos) { const h = g.index ? g.toNonIndexed() : g; pos.push(...h.attributes.position.array); nor.push(...h.attributes.normal.array); uv.push(...h.attributes.uv.array); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
function caja(geos, sx, sy, sz, x, y, z, th) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(th || 0).setPosition(x, y, z)); geos.push(g);
}
function barra(geos, a, b, r) {   // barra cuadrada de a a b
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 0.05) return;
  const g = new THREE.BoxGeometry(r, r, L), m = new THREE.Matrix4().lookAt(new THREE.Vector3(), d, new THREE.Vector3(0, 1, 0));
  m.setPosition(a.clone().addScaledVector(d, 0.5)); g.applyMatrix4(m); geos.push(g);
}
// caja deformada: pts[arriba 0|1][x 0|1][z 0|1] = [x, y, z] (muro lateral de la escalera, con la cara de arriba en pendiente)
function prisma(geos, pts) {
  const g = new THREE.BoxGeometry(1, 1, 1), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const p = pts[pos.getY(i) > 0 ? 1 : 0][pos.getX(i) > 0 ? 1 : 0][pos.getZ(i) > 0 ? 1 : 0]; pos.setXYZ(i, p[0], p[1], p[2]); }
  g.computeVertexNormals(); geos.push(g);
}
// baranda (pasamanos y postes blancos (M8: tubo blanco descascarado, como en las fotos de Sewell)) de a a b, con colisionador invisible si se pide
function baranda(G, a, b, fis, solida) {
  const L = a.distanceTo(b); if (L < 0.3) return;
  barra(G.amarillo, a.clone().setY(a.y + 1.05), b.clone().setY(b.y + 1.05), 0.09);
  barra(G.blanco, a.clone().setY(a.y + 0.55), b.clone().setY(b.y + 0.55), 0.05);
  for (let k = 0; k <= L + 0.01; k += Math.max(2, L / Math.ceil(L / 3))) { const p = a.clone().lerp(b, Math.min(1, k / L)); barra(G.blanco, p, p.clone().setY(p.y + 1.05), 0.08); }
  if (solida) {
    const c = a.clone().lerp(b, 0.5), th = Math.atan2(b.x - a.x, b.z - a.z);
    fis.caja(c.x, c.y + 0.6, c.z, 0.25, 1.2, L, th, { tipo: 'baranda' });
  }
}

export function obrasCono(def, fis, R) {
  const A = def.cono.anillos, inv = !!def.invierno;
  const G = { muro: [], muro1: [], muro2: [], piso: [], amarillo: [], blanco: [] };
  const tono = k => G[['muro', 'muro1', 'muro2'][Math.abs(Math.floor(k)) % 3]];   // N2-C23: muros de piedra de tres tonos, por paños
  // 1) calles con su muro de contención: bloque de piedra del borde de adentro de la calle hasta 5 m más allá del de afuera;
  //    arriba el pavimento, al frente la baranda. Tapa el escalón del terreno entre anillos (la malla tiene vértices cada 5 m)
  for (const a of A) for (const L of Object.values(a.lados)) for (const [f0, f1, hueco] of tramos(L, a.R, 6)) {
    // junto a la escalera central (|x| < 11) la calle se ensancha 3,5 m hacia el cerro: descanso amplio a cada lado
    const f = (f0 + f1) / 2, cerca = Math.abs(enAnillo(a.ta, f).x) < 11, r0 = -CALLE - FRENTE - (cerca ? 3.5 : 0), r1 = hueco ? CALLE : CALLE + MURO;
    const q = rectTramo(a.ta, f0, f1, r0, r1), largo = 2 * q.hx + 0.15, fondo = r1 - r0;
    let bajo = a.y;
    for (const u of [-0.5, 0, 0.5]) for (const v of [-0.5, 0, 0.5]) {
      const p = enAnillo(a.ta, f + u * (f1 - f0), (r0 + r1) / 2 + v * fondo); bajo = Math.min(bajo, altura(p.x, p.z));
    }
    bajo = Math.max(a.y - 45, bajo - 1.5);
    const h = a.y - bajo;
    caja(tono(f * a.R / 23), largo, h, fondo, q.x, bajo + h / 2, q.z, q.th);
    caja(G.piso, largo, 0.12, fondo + 0.02, q.x, a.y + 0.0, q.z, q.th);
    fis.caja(q.x, bajo + h / 2, q.z, largo, h, fondo, q.th, { tipo: 'plaza' });
    if (!hueco) { const b0 = enAnillo(a.ta, f0, r1 - 0.15), b1 = enAnillo(a.ta, f1, r1 - 0.15); baranda(G, new THREE.Vector3(b0.x, a.y, b0.z), new THREE.Vector3(b1.x, a.y, b1.z), fis, true); }
    else for (const g of [f0, f1]) {   // muesca de la escalera secundaria: baranda a los lados de la muesca
      if (enHueco(L, g)) continue;
      const q0 = enAnillo(a.ta, g, CALLE), q1 = enAnillo(a.ta, g, CALLE + MURO);
      baranda(G, new THREE.Vector3(q0.x, a.y, q0.z), new THREE.Vector3(q1.x, a.y, q1.z), fis, true);
    }
  }
  // 2) pasamanos de la escalera central, abiertos donde llega una calle (descanso)
  for (const e of def.elementos) if (e.t === 'escalera' && e.sinPasamanos) {
    const y0 = e._y0, y1 = e._y1, t0 = -e.z0, t1 = -e.z1;
    for (const s of [-1, 1]) {
      const x = s * (e.ancho / 2 - 0.15), cortes = [];
      for (const a of A) if (a.lados[s] && !a.plaza && a.ta > t0 && a.ta < t1) cortes.push([a.ta - CALLE - 0.2, a.ta + CALLE + 0.2]);
      cortes.sort((p, q) => p[0] - q[0]);
      let t = t0;
      const yEn = tt => y0 + (y1 - y0) * (tt - t0) / (t1 - t0);
      for (const [c0, c1] of [...cortes, [t1, t1]]) {
        if (c0 > t + 0.3) {
          baranda(G, new THREE.Vector3(x, yEn(t), -t), new THREE.Vector3(x, yEn(c0), -c0), fis, false);
          // colisionador: a los costados la escalera queda sobre las terrazas (una bola no bota a Nato al vacío); libre 6 m en
          // cada punta de la escalera para entrar en diagonal desde la plaza o la vía (el piloto se trababa en el primer poste)
          const s0 = Math.max(t, t0 + 6), s1 = Math.min(c0, t1 - 6);
          if (s1 > s0 + 0.5) baranda({ amarillo: [], blanco: [] }, new THREE.Vector3(x, yEn(s0), -s0), new THREE.Vector3(x, yEn(s1), -s1), fis, true);
        }
        t = Math.max(t, c1);
      }
    }
  }
  // 2b) muro lateral de la escalera central (N2-C23): entre descansos, a cada lado, un bloque de piedra de 3,6 m de ancho
  //     cuya cara de arriba sigue la escalera (0,2 m más alta); tapa los taludes de tierra entre la escalera y las terrazas
  for (const e of def.elementos) if (e.t === 'escalera' && e.sinPasamanos) {
    const y0 = e._y0, y1 = e._y1, t0 = -e.z0, t1 = -e.z1, yEn = tt => y0 + (y1 - y0) * (tt - t0) / (t1 - t0);
    for (const s of [-1, 1]) {
      const xi = s * e.ancho / 2, xo = s * (e.ancho / 2 + 3.6), cortes = [];
      for (const a of A) if (a.lados[s] && !a.plaza && a.ta > t0 && a.ta < t1) cortes.push([a.ta - CALLE - 0.1, a.ta + CALLE + 0.1]);
      cortes.sort((p, q) => p[0] - q[0]);
      let t = t0;
      for (const [c0, c1] of [...cortes, [t1, t1]]) {
        if (c0 > t + 1) {
          let yb = 1e9;
          for (let k = 0; k <= 4; k++) { const tt = t + (c0 - t) * k / 4; for (const xx of [xi * 1.4, xo * 1.25]) yb = Math.min(yb, altura(xx, -tt)); }
          yb = Math.max(Math.min(yEn(t), yEn(c0)) - 30, yb - 0.8);
          const P = (x, y, tt) => [x, y, -tt], pts = [[[P(xi, yb, c0), P(xi, yb, t)], [P(xo, yb, c0), P(xo, yb, t)]], [[P(xi, yEn(c0) + 0.2, c0), P(xi, yEn(t) + 0.2, t)], [P(xo, yEn(c0) + 0.2, c0), P(xo, yEn(t) + 0.2, t)]]];
          prisma(tono(t / 17), pts);
          fis.convexo(new Float32Array(pts.flat(2).flat()), { tipo: 'plaza' });
        }
        t = Math.max(t, c1);
      }
    }
  }
  // 2c) muros de contención de piedra a los costados y atrás de cada edificio de anillo donde el cerro queda más alto que su
  //     terraza (puntas de calle, perpendiculares a la ladera, junto a la escalera): antes se veía el corte de tierra
  const escC = def.elementos.find(e => e.t === 'escalera' && e.sinPasamanos);
  // 16-11 (Diego: «¿tienen alguna utilidad estos muros entre la escalera y el edificio? si no, sácalos todos»): fuera; &muros2c=1 los vuelve
  // a poner (A/B). window.__muros2c guarda dónde estaban (guion de revisión)
  const MUROS2C = typeof location !== 'undefined' && new URLSearchParams(location.search).get('muros2c') === '1';
  if (typeof window !== 'undefined') window.__muros2c = [];
  for (const e of def.elementos) if (e.t === 'edificio' && e.anillo != null) {
    const y = A[e.anillo].y, g = e.giro * Math.PI / 180, c = Math.cos(g), s = Math.sin(g), hx = e.largo / 2, hz = e.ancho / 2;
    const W = (lx, lz) => ({ x: e.x + lx * c + lz * s, z: e.z - lx * s + lz * c });
    for (const [ax, sg] of [['x', -1], ['x', 1], ['z', -1]]) {
      const ua = ax === 'x' ? -hz - MARGEN : -hx - MARGEN, ub = ax === 'x' ? hz - 0.5 : hx + MARGEN, n = Math.max(1, Math.round((ub - ua) / 7));
      for (let k = 0; k < n; k++) {
        const u0 = ua + (ub - ua) * k / n, u1 = u0 + (ub - ua) / n, um = (u0 + u1) / 2, lejos = (ax === 'x' ? hx : hz) + MARGEN + 3.5;
        let top = -1e9;
        for (const u of [u0, um, u1]) { const p = ax === 'x' ? W(sg * lejos, u) : W(u, sg * lejos); top = Math.max(top, altura(p.x, p.z)); }
        if (top < y + 1.2) continue;
        const d = (ax === 'x' ? hx : hz) + MARGEN + 0.8, p = ax === 'x' ? W(sg * d, um) : W(um, sg * d), H = Math.min(top, y + 25) + 0.3 - (y - 0.6);
        const sx = ax === 'x' ? 1.6 : u1 - u0 + 0.05, sz = ax === 'x' ? u1 - u0 + 0.05 : 1.6;
        // N2-Xciudad1: el muro del costado que mira a la escalera central se pega a su muro lateral (2b) y se alinea con ella:
        // antes, girado con el edificio y a 0,5-2 m, dejaba una cuña de tierra en V entre los dos
        let px = p.x, gg = g, sz2 = sz;
        if (ax === 'x' && escC && Math.abs(p.x) < escC.ancho / 2 + 3.6 + 6) { px = Math.sign(p.x) * (escC.ancho / 2 + 3.6 + 0.8); gg = 0; sz2 = sz * 1.15 + 0.6; }
        if (typeof window !== 'undefined') window.__muros2c.push([px, y, p.z]);
        if (!MUROS2C) continue;
        caja(tono(k + e.x), sx, H, sz2, px, y - 0.6 + H / 2, p.z, gg);
        fis.caja(px, y - 0.6 + H / 2, p.z, sx, H, sz2, gg, { tipo: 'plaza' });
      }
    }
  }
  // 3) barandas de las plazas cívicas, con aberturas: escalera al frente y atrás, calles a los costados
  for (const e of def.elementos) if (e.t === 'plaza' && e.barandaCono) {
    const y = e.y, X0 = e.x - e.sx / 2, X1 = e.x + e.sx / 2, Z0 = e.z - e.sz / 2, Z1 = e.z + e.sz / 2, V = (x, z) => new THREE.Vector3(x, y, z);
    for (const z of [Z0, Z1]) { baranda(G, V(X0, z), V(-3, z), fis, false); baranda(G, V(3, z), V(X1, z), fis, false); }
    for (const [x, s] of [[X0, -1], [X1, 1]]) {
      const zs = A.filter(a => a.plaza === e && a.lados[s]).map(a => puntoCalle(a.ta, x)[1]).sort((p, q) => p - q);
      let z = Z0;
      for (const zc of [...zs, Z1 + 3]) { const c0 = Math.min(Z1, zc - 3); if (c0 > z + 0.3) baranda(G, V(x, z), V(x, c0), fis, false); z = Math.max(z, zc + 3); }
    }
  }
  // mallas
  const grupo = new THREE.Group(); grupo.name = 'ciudadCono';
  const mats = {
    muro: matMundo('suelo_roca', 5, inv ? 0xd9d6d2 : 0xcbbfae),
    muro1: matMundo('suelo_roca', 5, inv ? 0xc9c6c4 : 0xa99f92),
    muro2: matMundo('suelo_roca', 4, inv ? 0xe2ddd6 : 0x9a8f80),
    piso: matMundo('concreto', 3, inv ? 0xf2f5fa : 0xd6cfc2),
    amarillo: new THREE.MeshStandardMaterial({ color: 0xe2ded2, roughness: 0.6 }),
    blanco: new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.7 }),
  };
  for (const [k, geos] of Object.entries(G)) if (geos.length) {
    const m = new THREE.Mesh(juntar(geos), mats[k]); m.castShadow = k.startsWith('muro'); m.receiveShadow = true; grupo.add(m);
  }
  R.exterior.add(grupo);
}

// edificio con giro libre (grados): se arma en su marco local (sin girar) y después se gira el grupo, los colisionadores,
// las puertas y las muestras del terreno (CONO.marco en terreno.js) alrededor de su centro
// N1-C74 (asentamiento, N2-N4): altura de la MALLA del terreno (vértices cada 5 m, diagonal b–c, como crearTerreno) en coordenadas
// del mundo. altura() es la curva exacta; entre un lote y el muro del anillo de arriba la malla interpola con el vértice alto del
// cerro y el suelo visible (y la colisión) sube varios metros dentro de la franja trasera del lote
function alturaMallaMundo(x, z) {
  const P = 5, X0 = -760, Z0 = -1000, u = (x - X0) / P, v = (z - Z0) / P, i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j;
  const ya = altura(X0 + i * P, Z0 + j * P), yb = altura(X0 + (i + 1) * P, Z0 + j * P), yc = altura(X0 + i * P, Z0 + (j + 1) * P), yd = altura(X0 + (i + 1) * P, Z0 + (j + 1) * P);
  return fx + fz <= 1 ? ya + fx * (yb - ya) + fz * (yc - ya) : yd + (1 - fx) * (yc - yd) + (1 - fz) * (yb - yd);
}
// camarote del cono con la espalda metida en el talud de la malla: se le recorta el fondo (máx. 2,5 m, ancho ≥ 9,5) y el lote se
// corre hacia la calle la mitad de lo recortado; el frente (puerta, calle) queda donde estaba. Auditor N2: «base» camarote_rojo (-112,-368)
function recortarEspalda(e) {
  if (e.id || e.rot || e.anillo == null || !(e.ancho > 10)) return e;
  const th = e.giro * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
  const W = (u, w) => [e.x + u * c + w * s, e.z - u * s + w * c];   // u a lo largo (x local), w a lo ancho (+ hacia el frente, z local)
  const marco = CONO.marco; CONO.marco = null;
  try {
    let piso = -1e9;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 4; j++) { const [x, z] = W(-e.largo / 2 + e.largo * i / 12, -e.ancho / 2 + e.ancho * j / 4); piso = Math.max(piso, Math.min(altura(x, z), alturaMallaMundo(x, z))); }
    const malla = d => { let m = -1e9; for (let i = 0; i <= 24; i++) { const [x, z] = W(-e.largo / 2 + e.largo * i / 24, -e.ancho / 2 + d); m = Math.max(m, alturaMallaMundo(x, z)); } return m; };
    if (malla(0) - piso <= 1.8) return e;
    for (let t = 0.5; t <= 2.5 && e.ancho - t >= 9.5; t += 0.5) if (malla(t) - piso <= 1.2) {
      const [x, z] = W(0, t / 2); (globalThis.__recortesEspalda ||= []).push([e.x, e.z, t, +(malla(0) - piso).toFixed(1)]); return { ...e, x: +x.toFixed(2), z: +z.toFixed(2), ancho: e.ancho - t, _recorte: t };
    }
    return e;
  } finally { CONO.marco = marco; }
}
export function edificioGirado(e, def, fis, R, edificio) {
  e = recortarEspalda(e);
  const th = e.giro * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), cx = e.x, cz = e.z;
  const mundo = (x, z) => [cx + (x - cx) * c + (z - cz) * s, cz - (x - cx) * s + (z - cz) * c];
  const local = new THREE.Group(), envoltura = new THREE.Group();
  envoltura.position.set(cx, 0, cz); envoltura.rotation.y = th; local.position.set(-cx, 0, -cz); envoltura.add(local);
  const qG = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), th);
  const fp = new Proxy(fis, { get(o, k) {
    if (k === 'caja') return (x, y, z, sx, sy, sz, giroY = 0, et, quat) => {
      const [X, Z] = mundo(x, z);
      if (quat) { const q = qG.clone().multiply(new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w)); return o.caja(X, y, Z, sx, sy, sz, 0, et, { x: q.x, y: q.y, z: q.z, w: q.w }); }
      return o.caja(X, y, Z, sx, sy, sz, giroY + th, et);
    };
    if (k === 'convexo') return (pts, et) => { const p = Float32Array.from(pts); for (let i = 0; i < p.length; i += 3) { const [X, Z] = mundo(p[i], p[i + 2]); p[i] = X; p[i + 2] = Z; } return o.convexo(p, et); };
    const v = o[k]; return typeof v === 'function' ? v.bind(o) : v;
  } });
  const Rp = { ...R, exterior: local,
    puertas: { push: p => { const [X, Z] = mundo(p.x, p.z); return R.puertas.push({ ...p, x: X, z: Z, rumbo: p.rumbo + th }); } },
    gaussianas: { push: g => { if (g.lote) g.lote.giro = e.giro; return R.gaussianas.push(g); } } };
  CONO.marco = { x: cx, z: cz, c, s };
  try { edificio(e, def, fp, Rp); } finally { CONO.marco = null; }
  R.exterior.add(envoltura);
}
