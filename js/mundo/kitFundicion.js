// N1-MOLINO (carril kit, 15-11-2026, pedido de Diego): «no un edificio cuadrado cerrado sino realmente un molino y fundición de cobre de
// la época; carros con cobre fundido haciendo el trabajo para moldear el cobre al interior; chimeneas humeando».
// Referencia: capturas/referencias_diego/molino_fundicion.webp (planta de tablas escalonada en la ladera hacia 1905-1915).
// Elemento de niveles.js: { t: 'fundicion', id: 'molino', x, z, via } (x, z = centro del galpón de la fundición; via = z de la vía de las ollas).
//  · terrazasFundicion(def): banco plano (corte y relleno) bajo la fundición y la playa de las ollas, ANTES de crear el terreno.
//  · construirFundicion(e, def, fis, R): después de la playa de las ollas (construir.js). Arma:
//    - molino concentrador: 3 cuerpos de tablas (edificioKit, estilo 1905) a distintas alturas en la ladera, cada uno sobre su
//      cimiento de piedra (lado alto) y caballetes de madera con diagonales (lado bajo); tolva, cañerías, montones de roca;
//    - fundición: galpón de tablas ABIERTO al sur (pilares) con portón grande al oriente por donde entra la vía; adentro horno de
//      reverbero de ladrillo con bocas incandescentes, canaleta de sangría, lecho de moldes de «mata», cerchas a la vista, linterna;
//    - carro vaciador animado (ciclo): se llena bajo la canaleta, vacía la olla en los moldes (que se encienden y se enfrían), sale
//      por el portón a la playa y vuelve. Colisión móvil; saltar dentro de la olla daña y rebota como las ollas de la playa;
//    - 2 chimeneas altas con tensores y humo negro continuo (un solo InstancedMesh de copos con billboard, ordenados), vapor blanco
//      en el molino, chispas (Points), luz naranja; pasarela-escalera de tablas por la ladera y caballete del tranvía de mineral;
//    - obreros de 1905 (vecino 'carretero', con su vara larga) trabajando en el horno y los moldes.
import * as THREE from 'three';
import { edificioKit, Junta, material, uvCaja } from './kitSewell.js';
import { altura, alturaBase, matMundo, TERRAZAS } from './terreno.js';
import { danar } from '../juego/logica.js';
import { registrarFundidores } from './obreros1905.js';
import { texMat, uvPieza } from './texFaena.js';   // TEX (16-11): fierro con óxido, madera con vetas, riel, olla tiznada
import { precargarUtileria, piezaGrupo, partirPieza, montarEnKit } from './utileria.js';   // REV (16-11): + montarEnKit (rocas y carbón)   // N0-UTIL3 (E2): montón de carbón de malla   // obreros de fundición de 1905 (pedido de Diego: no arrieros)

const FL = 16, FW = 15;   // galpón de la fundición: largo (x) y ancho (z)
const banco = e => ({ x0: e.x - FL / 2 - 1.5, x1: e.x + 38.5, z0: e.z - FW / 2 - 1, z1: e.z + FW / 2 });   // fundición + playa de las ollas

// ------------------------------------------------------------------ terraza (antes del terreno)
export function terrazasFundicion(def) {
  for (const e of def.elementos) if (e.t === 'fundicion') {
    const b = banco(e);
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 6; j++) { const y = alturaBase(b.x0 + (b.x1 - b.x0) * i / 12, b.z0 + (b.z1 - b.z0) * j / 6); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    e._yB = lo + (hi - lo) * 0.42;
    const hx = (b.x1 - b.x0) / 2, hz = (b.z1 - b.z0) / 2, m = 6;
    // peso 100: manda sobre el camino que cruza la playa (con 8 la mezcla subía el banco ~2 m y la playa quedaba más alta que la fundición)
    TERRAZAS.push({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, c: 1, s: 0, hx, hz, m, r: Math.hypot(hx, hz) + m, y: e._yB, peso: 100 });
  }
}

// ------------------------------------------------------------------ materiales
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const std = (color, rough = 0.9, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  MATS = {
    tab: material('tablasViejas', 0x8a735c), tabO: material('tablasViejas', 0x5e4e40), zinc: material('zincViejo', 0xa29e96), zincO: material('zincViejo', 0x7a7670),
    piedra: material('piedra', 0xc2b9ab), ladrillo: material('piedra', 0xa4644c) /* ladrillo: mampostería teñida (el kit no tiene textura de ladrillo) */, fierro: material('fierro', 0x26272a), madera: std(0x5a4632, 0.95),
    hollin: std(0x1b1918, 1), roca: material('piedra', 0x8e867c), arena: std(0x6e6458, 1), tierra: matMundo('suelo_tierra', 7, 0x8a7a66, { mezcla: 0.35 }),
    brasa: new THREE.MeshBasicMaterial({ color: 0xffa040 }), chorro: new THREE.MeshBasicMaterial({ color: 0xffc070 }), oscuro: new THREE.MeshBasicMaterial({ color: 0x0d0b0a }),
  };
  MATS.tierra.side = THREE.FrontSide;
  // TEX (16-11-2026, Diego: «falta aplicar las texturas»): el fierro (carro vaciador, chimeneas, moldes, topes) y la madera (pilares,
  // cerchas, caballetes) pasan de color liso a textura compartida con UV en metros; vía interior con riel y durmientes; olla tiznada
  Object.assign(MATS, { fierro: texMat('fierro', 0x8a8a8a), madera: texMat('veta', 0xa89078), riel: texMat('riel'), durm: texMat('durmiente', 0xd0bca4),
    rueda: texMat('pintado'), olla: texMat('olla') });
  return MATS;
}
const CON_UV = new Set(['tab', 'tabO', 'zinc', 'zincO', 'piedra', 'ladrillo', 'roca']);
function volcar(J, grupo, sombra = true) {
  const M = mats();
  for (const k of Object.keys(J.p)) {
    for (const p of J.p[k]) uvPieza(p, M[k]);   // TEX: UV en metros por pieza (solo materiales con textura de texFaena)
    const g = J.geometria(k, CON_UV.has(k) ? uvCaja : null); if (!g) continue;
    const m = new THREE.Mesh(g, M[k]); m.name = 'fund_' + k; m.castShadow = sombra && k !== 'brasa' && k !== 'chorro'; m.receiveShadow = true; grupo.add(m);
  }
}
// caja de A a B (barra: poste, diagonal, viga) de sección s
function barra(J, k, a, b, s = 0.2, s2 = s) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); if (L < 1e-3) return;
  const g = new THREE.BoxGeometry(s, L, s2), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); J.add(k, g);
}
function cil(J, k, x, y, z, r0, r1, h, seg = 14, eje = 'y') {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg); if (eje === 'x') g.rotateZ(Math.PI / 2); if (eje === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); J.add(k, g);
}

// ------------------------------------------------------------------ humo y vapor: copos instanciados (billboard) en una sola malla
function texCopo() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 30; i++) {
    const a = r() * 6.28, rr = r() ** 0.7 * 34, cx = 64 + Math.cos(a) * rr, cy = 64 + Math.sin(a) * rr, ra = 14 + r() * 22 * (1 - rr / 50);
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, ra), al = 0.22 + r() * 0.22;
    gr.addColorStop(0, `rgba(255,255,255,${al})`); gr.addColorStop(0.55, `rgba(255,255,255,${al * 0.45})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  }
  x.globalCompositeOperation = 'destination-in'; const m = x.createRadialGradient(64, 64, 20, 64, 64, 64);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = m; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function crearHumo(MAX) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3), iDat = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  iPos.setUsage(THREE.DynamicDrawUsage); iDat.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iDat', iDat); geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { mapa: { value: null }, sol: { value: new THREE.Color(0xfff2e0) } }]),
    vertexShader: `attribute vec3 iPos; attribute vec4 iDat; varying vec2 vUv; varying float vA; varying float vT;
      #include <fog_pars_vertex>
      void main() { vec4 mvPosition = modelViewMatrix * vec4(iPos, 1.0); float c = cos(iDat.z), s = sin(iDat.z);
        mvPosition.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iDat.x;
        gl_Position = projectionMatrix * mvPosition; vUv = position.xy + 0.5; vA = iDat.y; vT = iDat.w;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D mapa; uniform vec3 sol; varying vec2 vUv; varying float vA; varying float vT;
      #include <fog_pars_fragment>
      void main() { vec4 t = texture2D(mapa, vUv); float lado = 0.82 + 0.18 * (1.0 - vUv.y);
        vec3 col = mix(vec3(0.035, 0.032, 0.03), vec3(0.78, 0.77, 0.75), vT) * sol * lado;
        gl_FragColor = vec4(col, t.a * vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  mat.uniforms.mapa.value = texCopo();
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.name = 'fund_humo'; m.renderOrder = 3;
  const copos = [];
  // fuente: { x, y, z, cada (s entre copos), vida, s0, crece, sube, tono0 (0 negro .. 1 vapor), tono1, op, viento }
  m.userData = {
    copos, fuentes: [],
    paso(dt, cam) {
      for (const f of this.fuentes) {
        f.t = (f.t || 0) - dt;
        while (f.t <= 0 && copos.length < MAX) {
          f.t += f.cada * (0.7 + Math.random() * 0.6);
          copos.push({ x: f.x + (Math.random() - 0.5) * f.r, y: f.y, z: f.z + (Math.random() - 0.5) * f.r, t: 0, f, rot: Math.random() * 6.28, gira: (Math.random() - 0.5) * 0.3,
            vx: (Math.random() - 0.5) * 0.5, vz: (Math.random() - 0.5) * 0.5, s0: f.s0 * (0.8 + Math.random() * 0.4), vida: f.vida * (0.8 + Math.random() * 0.4) });
        }
        if (f.t < -5) f.t = 0;
      }
      for (let i = copos.length - 1; i >= 0; i--) {
        const c = copos[i], f = c.f; c.t += dt; const u = c.t / c.vida;
        if (u >= 1) { copos[i] = copos[copos.length - 1]; copos.pop(); continue; }
        const v = Math.min(1, c.t / 2.5) * f.viento;
        c.x += (c.vx + -0.45 * v) * dt; c.z += (c.vz + 1.0 * v) * dt; c.y += (f.sube * Math.exp(-c.t * 0.45) + 0.35) * dt; c.rot += c.gira * dt;
        c.s = c.s0 + f.crece * (1 - Math.exp(-c.t * 0.35)) + c.t * 0.25;
        let op = f.op * Math.min(1, c.t / 0.4) * (1 - u) ** 1.3;
        const dc = Math.hypot(c.x - cam.x, c.y - cam.y, c.z - cam.z) - c.s * 0.5; if (dc < 4) op *= Math.max(0, dc / 4);
        c.op = op; c.tono = f.tono0 + (f.tono1 - f.tono0) * Math.min(1, u * 1.6); c.d = (c.x - cam.x) ** 2 + (c.y - cam.y) ** 2 + (c.z - cam.z) ** 2;
      }
      copos.sort((a, b) => b.d - a.d);   // de atrás hacia adelante (mezcla alfa sin escribir profundidad)
      const P = iPos.array, D = iDat.array;
      for (let i = 0; i < copos.length; i++) { const c = copos[i]; P[i * 3] = c.x; P[i * 3 + 1] = c.y; P[i * 3 + 2] = c.z; D[i * 4] = c.s; D[i * 4 + 1] = c.op; D[i * 4 + 2] = c.rot; D[i * 4 + 3] = c.tono; }
      geo.instanceCount = copos.length; iPos.needsUpdate = true; iDat.needsUpdate = true;
      iPos.addUpdateRange?.(0, copos.length * 3); iDat.addUpdateRange?.(0, copos.length * 4);
    },
  };
  return m;
}

// ------------------------------------------------------------------ apoyos de un cuerpo en la ladera: cimiento de piedra donde el
// suelo está cerca del piso y caballetes de madera (postes, soleras, diagonales en cruz) donde queda alto. Colisión de postes y muros.
function apoyos(J, fis, x0, x1, z0, z1, y) {
  const P = 3, nx = Math.max(1, Math.round((x1 - x0) / P)), nz = Math.max(1, Math.round((z1 - z0) / P));
  const g = (x, z) => altura(x, z);
  const borde = (xa, za, xb, zb, n) => {
    const pts = []; for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n, z = za + (zb - za) * i / n; pts.push([x, z, y - g(x, z)]); }
    const ux = (xb - xa) / n, uz = (zb - za) / n, Ls = Math.hypot(ux, uz);
    for (let i = 0; i < n; i++) {
      const [xa2, za2, ha] = pts[i], [xb2, zb2, hb] = pts[i + 1], mx = (xa2 + xb2) / 2, mz = (za2 + zb2) / 2;
      if (Math.max(ha, hb) < 2.4) {   // muro de piedra (cimiento) hasta 0,8 m bajo el suelo más bajo del tramo
        const yb = y - Math.max(ha, hb) - 0.8, hh = y - yb, rot = Math.atan2(-uz, ux);
        const gg = new THREE.BoxGeometry(Ls + 0.5, hh, 0.55); gg.rotateY(rot); gg.translate(mx, yb + hh / 2, mz); J.add('piedra', gg);
        fis.caja(mx, yb + hh / 2, mz, Ls + 0.5, hh, 0.55, rot, { tipo: 'muro' });
      } else {   // caballete: solera arriba, riostra a media altura y cruz de San Andrés
        const ya = y - ha, yb2 = y - hb, ym = Math.max(ya, yb2) + (y - Math.max(ya, yb2)) * 0.45;
        barra(J, 'madera', [xa2, y - 0.25, za2], [xb2, y - 0.25, zb2], 0.3, 0.3);
        if (y - Math.max(ya, yb2) > 3) barra(J, 'madera', [xa2, ym, za2], [xb2, ym, zb2], 0.16, 0.16);
        barra(J, 'madera', [xa2, ya + 0.3, za2], [xb2, y - 0.4, zb2], 0.14, 0.14); barra(J, 'madera', [xb2, yb2 + 0.3, zb2], [xa2, y - 0.4, za2], 0.14, 0.14);
      }
    }
    return pts;
  };
  const postes = new Map();
  const poste = (x, z) => { const k = x.toFixed(2) + ',' + z.toFixed(2); if (postes.has(k)) return; const h = y - g(x, z); if (h < 0.4) return; postes.set(k, 1);
    J.caja('madera', x, y - h / 2 - 0.2, z, 0.32, h + 0.4, 0.32); fis.caja(x, y - h / 2 - 0.2, z, 0.32, h + 0.4, 0.32, 0, { tipo: 'muro' });
    J.caja('piedra', x, y - h - 0.05, z, 0.7, 0.5, 0.7); };
  for (const [a, b, n] of [[[x0, z1], [x1, z1], nx], [[x1, z1], [x1, z0], nz], [[x1, z0], [x0, z0], nx], [[x0, z0], [x0, z1], nz]]) {
    const pts = borde(a[0], a[1], b[0], b[1], n);
    for (let i = 0; i < pts.length; i++) { const [x, z, h] = pts[i], hv = Math.max(h, pts[i - 1]?.[2] ?? 0, pts[i + 1]?.[2] ?? 0); if (hv >= 2.4) poste(x, z); }
  }
  for (let i = 1; i < nx; i++) for (let j = 1; j < nz; j++) { const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz; if (y - g(x, z) > 1.2) poste(x, z); }
  // entablado de piso bajo el cuerpo (desde abajo no se ve el interior hueco del kit)
  J.caja('tabO', (x0 + x1) / 2, y - 0.12, (z0 + z1) / 2, x1 - x0, 0.24, z1 - z0);
}

// ------------------------------------------------------------------ un cuerpo del molino (kit 1905) con su colisión
function cuerpo(grupo, J, fis, c) {
  const { x0, x1, z0, z1, alto, pisos } = c, L = x1 - x0, W = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  let y = -1e9; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) y = Math.max(y, altura(x0 + L * i / 4, z0 + W * j / 4));
  y += 0.15; c.y = y;
  const g = edificioKit({ estilo: '1905', grupo: 0, largo: L, ancho: W, alto, pisos, techo: 'dos', pendiente: 0.55, color: c.color ?? 0x8a735c, colorTecho: 0xa09a90, colorMolduras: 0x9a7a5a,
    anchoVentana: 0.9, altoVentana: 1.2, vano: 2.0, zocalo: 0.3, chimeneas: 0, semilla: Math.round(cx * 7 + cz * 3) });
  g.position.set(cx, y, cz); g.name = 'molino_' + c.id; g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); grupo.add(g);
  apoyos(J, fis, x0, x1, z0, z1, y);
  // colisión: caja hasta el alero y techo a dos aguas (casco)
  const yE = y + alto - 0.2 - 0.55 * W / 2, yR = y + alto - 0.2;
  fis.caja(cx, (y + yE) / 2, cz, L - 0.7, yE - y, W - 0.9, 0, { tipo: 'muro' });
  const pts = []; for (const sx of [-1, 1]) { pts.push(cx + sx * L / 2, yE, cz - W / 2, cx + sx * L / 2, yE, cz + W / 2, cx + sx * L / 2, yR, cz); }
  fis.convexo(new Float32Array(pts), { tipo: 'techo' });
  return c;
}

// ------------------------------------------------------------------ chimenea alta de fierro remachado sobre pedestal de ladrillo
function chimenea(J, F, fis, x, z, H) {
  const g0 = Math.min(altura(x - 1.8, z - 1.8), altura(x + 1.8, z - 1.8), altura(x - 1.8, z + 1.8), altura(x + 1.8, z + 1.8)), g1 = Math.max(altura(x - 1.8, z - 1.8), altura(x + 1.8, z - 1.8), altura(x - 1.8, z + 1.8), altura(x + 1.8, z + 1.8));
  const yb = g0 - 1, yp = g1 + 4.5;   // pedestal de ladrillo
  J.caja('ladrillo', x, (yb + yp) / 2, z, 3.6, yp - yb, 3.6); J.caja('piedra', x, yp + 0.2, z, 4.0, 0.4, 4.0);
  fis.caja(x, (yb + yp) / 2, z, 3.6, yp - yb, 3.6, 0, { tipo: 'muro' });
  const yt = yp + H; cil(J, 'fierro', x, (yp + yt) / 2, z, 0.85, 1.12, H, 18);
  fis.caja(x, (yp + yt) / 2, z, 1.9, H, 1.9, 0, { tipo: 'muro' });
  for (let k = 1; k < 7; k++) cil(F, 'fierro', x, yp + H * k / 7, z, 1.14 - 0.27 * k / 7 + 0.04, 1.14 - 0.27 * k / 7 + 0.04, 0.18, 18);   // zunchos
  cil(J, 'fierro', x, yt - 0.3, z, 1.0, 0.92, 0.6, 18); cil(J, 'hollin', x, yt + 0.01, z, 0.8, 0.8, 0.04, 16);   // corona y boca tiznada
  // tensores (líneas) desde 2/3 del alto a anclas en el suelo
  const lin = [], yA = yp + H * 0.66;
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, ax = x + Math.cos(a) * 6.5, az = z + Math.sin(a) * 6.5; lin.push(x + Math.cos(a) * 0.95, yA, z + Math.sin(a) * 0.95, ax, altura(ax, az) + 0.2, az);
    J.caja('piedra', ax, altura(ax, az), az, 0.6, 0.5, 0.6); }
  return { tope: [x, yt + 0.2, z], lin };
}

const G9EXT_OLLA = { mun: 1.0, giro: -0.65 }, G9EXT_CHASIS = { x: 0.17, y: 0.14, esc: [0.85, 0.94, 1] };   // G9-EXT: muñones de la olla en la malla y giro que los deja en x; chasis: cojinetes de la malla (x −2,1 / +1,7, y 2,4) llevados a ±1,62 y 2,25
// ------------------------------------------------------------------ carro vaciador con su olla (muñones en los extremos: vuelca de lado)
function carroVaciador() {
  const g = new THREE.Group(), M = mats(), J = new Junta();
  for (const z of [-0.85, 0.85]) J.caja('fierro', 0, 0.83, z, 3.6, 0.24, 0.2);
  for (const x of [-1.5, 0, 1.5]) J.caja('fierro', x, 0.83, 0, 0.2, 0.2, 1.9);
  J.caja('fierro', 0, 0.96, 0, 3.4, 0.06, 1.9);
  for (const x of [-1.15, 1.15]) {
    cil(J, 'fierro', x, 0.52, 0, 0.06, 0.06, 1.4, 8, 'z');
    for (const z of [-0.5, 0.5]) { cil(J, 'rueda', x, 0.52, z, 0.32, 0.32, 0.1, 16, 'z');   /* TEX: rueda de fierro pintado (antes 'hollin' liso) */ cil(J, 'fierro', x, 0.52, z - Math.sign(z) * 0.06, 0.38, 0.38, 0.03, 16, 'z'); }
  }
  for (const x of [-1.55, 1.55]) { barra(J, 'fierro', [x, 0.95, -0.8], [x, 2.25, 0], 0.18, 0.22); barra(J, 'fierro', [x, 0.95, 0.8], [x, 2.25, 0], 0.18, 0.22); cil(J, 'fierro', x, 2.25, 0, 0.2, 0.2, 0.3, 12, 'x'); }
  for (const x of [-2.0, 2.0]) J.caja('fierro', x, 0.8, 0, 0.3, 0.14, 0.5);
  const base = new THREE.Group(); volcar(J, base); g.add(base);
  // G9-EXT (16-11): bastidor TRELLIS (chasis con ruedas y caballetes en A, sin olla) en lugar de las cajas; respaldo: la Junta texturizada de TEX
  // La malla s7 trae una viga entre los caballetes y un balde en la plataforma: se quitan con partirPieza (quedan ruedas, plataforma, caballetes y cojinetes)
  { const pu = precargarUtileria(); if (pu) pu.then(() => { const P = partirPieza('chasis_vaciador', 'sin_viga', (x, y, z) => (y > 2.05 && x > -1.9 && x < 1.5) || (y > 1.0 && y < 1.5 && x > 0.2 && x < 1.3 && Math.abs(z) < 0.5));
    if (!P || !P.a.index.count) return; const m = new THREE.Mesh(P.a, P.mat); m.name = 'g9ext_chasis'; m.castShadow = m.receiveShadow = true;
    m.scale.set(...G9EXT_CHASIS.esc); m.position.set(G9EXT_CHASIS.x, G9EXT_CHASIS.y, 0); g.add(m); base.visible = false; }); }
  // olla: pivote en los muñones (y 2,25), vuelca hacia +z
  const piv = new THREE.Group(); piv.position.y = 2.25; g.add(piv);
  const O = new Junta();
  cil(O, 'olla', 0, -0.1, 0, 1.0, 0.72, 1.3, 20); cil(O, 'olla', 0, 0.58, 0, 1.06, 1.06, 0.1, 20);   // TEX: olla de fierro tiznada con escoria
  for (const x of [-1.32, 1.32]) cil(O, 'fierro', x, 0, 0, 0.16, 0.16, 0.6, 10, 'x');
  O.caja('fierro', 0, 0.5, 1.08, 0.5, 0.12, 0.35);   // pico
  const og = new THREE.Group(); volcar(O, og); piv.add(og);
  // G9-EXT (16-11): olla de escoria TRELLIS (2,1 m, muñones a 1,0 m del fondo) colgada del mismo pivote; se oculta solo el casco 'olla'
  // de TEX (los muñones de fierro y el pico quedan: llegan a los caballetes). Respaldo: la olla texturizada.
  { const pu = precargarUtileria(); if (pu) pu.then(() => { const m = piezaGrupo('olla_escoria'); if (!m) return; m.position.y = -G9EXT_OLLA.mun; m.rotation.y = G9EXT_OLLA.giro; m.name = 'g9ext_olla'; piv.add(m); for (const c of og.children) if (c.name === 'fund_olla') c.visible = false; }); }
  const cobre = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.94, 0.06, 20), M.brasa.clone()); cobre.material.color.set(0xffa848); piv.add(cobre);
  g.userData = { piv, cobre };
  return g;
}

// ------------------------------------------------------------------ armado principal
export function construirFundicion(e, def, fis, R) {
  if (globalThis.location && /[?&]fundicion=0/.test(location.search)) return null;   // solo para comparar (fps): sin la planta
  const M = mats(), grupo = new THREE.Group(); grupo.name = 'molino_fundicion';
  const J = new Junta(), F = new Junta();   // J: lo grande (sombra) · F: detalle fino (se oculta lejos)
  const playa = def.elementos.find(p => p.t === 'playaOllas');
  const X = e.x, Z = e.z, xW = X - FL / 2, xE = X + FL / 2, zN = Z - FW / 2, zS = Z + FW / 2, VZ = e.via ?? Z + 1.5;
  const Y = playa && playa.y != null ? playa.y - 0.03 : (e._yB ?? altura(X, Z));   // piso de la fundición = playa de las ollas
  e.y = Y;

  // ---------------- molino concentrador (3 cuerpos escalonados) ----------------
  const C1 = cuerpo(grupo, J, fis, { id: 'bajo', x0: X - 25, x1: X - 15, z0: Z - 7.1, z1: Z + 2.5, alto: 8.6, pisos: 2 });
  const C2 = cuerpo(grupo, J, fis, { id: 'medio', x0: X - 24, x1: X - 11, z0: Z - 19.5, z1: Z - 7.7, alto: 12.5, pisos: 3, color: 0x7c6852 });
  const C3 = cuerpo(grupo, J, fis, { id: 'alto', x0: X - 24, x1: X - 12, z0: Z - 29.5, z1: Z - 20.1, alto: 10.5, pisos: 2, color: 0x8f7a62 });
  // linterna de ventilación del cuerpo medio (de ahí sale vapor) y cañerías por la fachada
  { const yr = C2.y + 12.3, cx = (C2.x0 + C2.x1) / 2, cz = (C2.z0 + C2.z1) / 2;
    J.caja('tabO', cx, yr + 0.35, cz, 6, 1.7, 1.6); J.caja('zinc', cx, yr + 1.35, cz, 6.6, 0.08, 2.4);
    for (const dx of [-2.4, 2.4]) { cil(F, 'fierro', cx + dx, yr + 1.9, cz, 0.18, 0.18, 1.6, 8); }
    for (const [x, z0, z1] of [[C2.x1 - 0.1, C2.z0 + 1, C2.z1 - 0.6]]) { cil(F, 'fierro', x, C2.y + 5.2, (z0 + z1) / 2, 0.14, 0.14, z1 - z0, 8, 'z'); cil(F, 'fierro', x, C2.y + 2.7, z1, 0.14, 0.14, 5, 8); }
    cil(F, 'fierro', C1.x1 - 0.1, C1.y + 4.75, (C1.z0 + C1.z1) / 2 + 2, 0.12, 0.12, 9.5, 8); }
  // tolva de mineral junto al cuerpo alto (oriente) y montones de roca al pie del molino
  { const tx = C3.x0 - 2.2, tz = (C3.z0 + C3.z1) / 2 + 1, ty = C3.y + 4.6;
    const tg = new THREE.CylinderGeometry(2.0, 0.5, 2.6, 4, 1, false, Math.PI / 4); tg.translate(tx, ty, tz); J.add('tabO', tg);
    for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { const h = ty - 1.2 - altura(tx + dx, tz + dz); if (h > 0) { J.caja('madera', tx + dx, ty - 1.2 - h / 2, tz + dz, 0.26, h + 0.3, 0.26); fis.caja(tx + dx, ty - 1.2 - h / 2, tz + dz, 0.26, h, 0.26, 0, { tipo: 'muro' }); } }
    barra(F, 'madera', [tx - 1.3, ty - 1.4, tz - 1.3], [tx + 1.3, altura(tx + 1.3, tz - 1.3) + 0.3, tz - 1.3], 0.12, 0.12);
    fis.caja(tx, ty, tz, 3, 2.6, 3, Math.PI / 4, { tipo: 'muro' }); }
  const rocas = (x, z, n, r) => { let s = Math.abs(x * 13 + z * 7) | 0; const rr = () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const a = rr() * 6.28, d = Math.sqrt(rr()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, sz = 0.35 + rr() * 0.6 * (1 - d / r + 0.3);
      const g = new THREE.DodecahedronGeometry(sz, 0); g.scale(1, 0.7, 1.1); const ry = rr() * 6; g.rotateY(ry); g.translate(px, altura(px, pz) + sz * 0.35, pz); JR.add('roca', g);
      const r3 = i % 3 === 2, s2 = 2 * sz / (r3 ? 1.2 : 1.4); LR.push([r3 ? 'roca3' : 'roca1', px, altura(px, pz) - 0.06 * s2, pz, ry, [s2, s2 * (r3 ? 1.1 : 0.8), s2]]); } };
  // REV (16-11, revisor de mallas): los montones de roca al pie del molino eran dodecaedros de color plano; ahora las rocas aprobadas
  // roca1 (gris) y roca3 (1 de cada 3, con escombro) instanciadas con la misma posición, tamaño y giro (roca2, laja negra, parecía tocón).
  // Los dodecaedros van a su propio grupo de respaldo, que se oculta solo si todas las rocas se colocaron
  const JR = new Junta(), LR = [];
  rocas(C1.x0 - 2.5, Z + 3.5, 26, 3.2); rocas(C3.x0 - 2.5, C3.z1 + 1.5, 18, 2.4);
  { const gR = new THREE.Group(); gR.name = 'fund_rocas_resp'; volcar(JR, gR); grupo.add(gR); montarEnKit(grupo, LR, { ocultar: gR }); }

  // ---------------- fundición: galpón de tablas abierto al sur ----------------
  const yE = Y + 7.2, pend = 0.42, yR = yE + pend * (FW / 2 + 0.6);
  // piso de tierra apisonada (colisión exacta a la cota de la playa)
  { const pg = new THREE.BoxGeometry(FL + 0.6, 0.8, FW + 0.4); pg.translate(X, Y - 0.38, Z); const pm = new THREE.Mesh(pg, M.tierra); pm.receiveShadow = true; pm.name = 'fund_piso'; grupo.add(pm);
    fis.caja(X, Y - 0.38, Z, FL + 0.6, 0.8, FW + 0.4, 0, { tipo: 'tierra' }); }
  // pilares cada 4 m en los dos lados largos y en los hastiales
  const xs = []; for (let x = xW; x <= xE + 0.01; x += 4) xs.push(x);
  for (const x of xs) for (const z of [zN, zS]) { J.caja('madera', x, (Y + yE) / 2, z, 0.38, yE - Y, 0.38); fis.caja(x, (Y + yE) / 2, z, 0.38, yE - Y, 0.38, 0, { tipo: 'muro' }); J.caja('piedra', x, Y + 0.25, z, 0.6, 0.5, 0.6); }
  for (const x of [xW, xE]) for (const z of [Z - 3.7, Z + 3.7]) { J.caja('madera', x, (Y + yE) / 2, z, 0.38, yE - Y, 0.38); }
  // muro norte (lleno) y muro poniente con puerta
  const muro = (k, x0, x1, z0, z1, y0, y1, col = true) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = Math.max(x1 - x0, 0.16), sz = Math.max(z1 - z0, 0.16);
    J.caja(k, cx, (y0 + y1) / 2, cz, sx, y1 - y0, sz); if (col) fis.caja(cx, (y0 + y1) / 2, cz, sx, y1 - y0, sz, 0, { tipo: 'muro' }); };
  muro('tabO', xW, xE, zN - 0.08, zN + 0.08, Y, yE);
  const dP = [VZ + 2.6, VZ + 5.2];   // puerta poniente (frente al pasillo de los moldes)
  muro('tabO', xW - 0.08, xW + 0.08, zN, dP[0], Y, yE); muro('tabO', xW - 0.08, xW + 0.08, dP[1], zS, Y, yE); muro('tabO', xW - 0.08, xW + 0.08, dP[0], dP[1], Y + 3.2, yE);
  J.caja('madera', xW - 0.12, Y + 3.25, (dP[0] + dP[1]) / 2, 0.2, 0.22, dP[1] - dP[0] + 0.4);
  // hastial oriente con portón grande (entra la vía de las ollas) y hojas abiertas contra el muro
  const pP = [VZ - 2.6, VZ + 4.0];
  muro('tabO', xE - 0.08, xE + 0.08, zN, pP[0], Y, yE); muro('tabO', xE - 0.08, xE + 0.08, pP[1], zS, Y, yE); muro('tabO', xE - 0.08, xE + 0.08, pP[0], pP[1], Y + 5.4, yE);
  J.caja('madera', xE + 0.14, Y + 5.45, (pP[0] + pP[1]) / 2, 0.24, 0.3, pP[1] - pP[0] + 0.5);
  J.caja('tabO', xE + 0.3, Y + 2.7, pP[0] - 1.6, 0.1, 5.2, 3.0); J.caja('tabO', xE + 0.3, Y + 2.7, pP[1] + 1.4, 0.1, 5.2, 2.6);   // hojas del portón
  // hastiales (triángulos de tablas) y techo a dos aguas de zinc tiznado
  for (const x of [xW, xE]) { const s = x === xW ? -1 : 1, [p, q] = s > 0 ? [zS, zN] : [zN, zS]; J.tri('tabO', [x + s * 0.09, yE, p], [x + s * 0.09, yE, q], [x + s * 0.09, yR, Z]); J.tri('tabO', [x - s * 0.01, yE, q], [x - s * 0.01, yE, p], [x - s * 0.01, yR, Z]); }
  const ov = 0.6;
  for (const s of [-1, 1]) {   // s = -1 faldón norte, +1 faldón sur
    const zEd = Z + s * (FW / 2 + ov), yEd = yR - pend * (FW / 2 + ov);
    const a = [xW - 0.5, yR, Z], b = [xE + 0.5, yR, Z], c = [xE + 0.5, yEd, zEd], d = [xW - 0.5, yEd, zEd];
    if (s > 0) { J.quad('zincO', d, c, b, a); J.quad('zincO', [a[0], a[1] - 0.06, a[2]], [b[0], b[1] - 0.06, b[2]], [c[0], c[1] - 0.06, c[2]], [d[0], d[1] - 0.06, d[2]]); }
    else { J.quad('zincO', a, b, c, d); J.quad('zincO', [d[0], d[1] - 0.06, d[2]], [c[0], c[1] - 0.06, c[2]], [b[0], b[1] - 0.06, b[2]], [a[0], a[1] - 0.06, a[2]]); }
  }
  { const pts = []; for (const x of [xW - 0.5, xE + 0.5]) pts.push(x, yE - 0.1, zN - ov, x, yE - 0.1, zS + ov, x, yR, Z); fis.convexo(new Float32Array(pts), { tipo: 'techo' }); }
  // linterna en la cumbrera (deja salir el calor) con su techito
  J.caja('hollin', X - 1, yR + 0.55, Z, 9, 1.1, 1.6); J.caja('zincO', X - 1, yR + 1.2, Z, 9.6, 0.1, 2.6);
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) F.caja('tabO', X - 5.2 + i * 0.76, yR + 0.55, Z + s * 0.82, 0.08, 1.0, 0.06, 0, s * 0.5);
  // cerchas de madera a la vista en cada línea de pilares
  for (const x of xs) {
    barra(F, 'madera', [x, yE, zN], [x, yE, zS], 0.24, 0.24); barra(F, 'madera', [x, yE, zN], [x, yR - 0.15, Z], 0.24, 0.22); barra(F, 'madera', [x, yE, zS], [x, yR - 0.15, Z], 0.24, 0.22);
    barra(F, 'madera', [x, yE, Z], [x, yR - 0.15, Z], 0.2, 0.2); barra(F, 'madera', [x, yE, Z - 3.6], [x, yE + (yR - yE) * 0.5, Z], 0.14, 0.14); barra(F, 'madera', [x, yE, Z + 3.6], [x, yE + (yR - yE) * 0.5, Z], 0.14, 0.14);
  }
  for (const z of [zN, zS]) barra(J, 'madera', [xW, yE + 0.12, z], [xE, yE + 0.12, z], 0.3, 0.32);   // soleras
  // baranda del borde sur (frente abierto) donde el terraplén cae más de 1 m
  for (let i = 0; i < xs.length - 1; i++) { const xa = xs[i] + 0.2, xb = xs[i + 1] - 0.2, h = Y - Math.min(altura((xa + xb) / 2, zS + 1.5), altura(xa, zS + 1.5), altura(xb, zS + 1.5));
    if (h < 1) continue; for (const yy of [0.5, 1.0]) J.caja('madera', (xa + xb) / 2, Y + yy, zS, xb - xa, 0.12, 0.1); for (let x = xa + 1; x < xb - 0.3; x += 1.25) F.caja('madera', x, Y + 0.5, zS, 0.1, 1.0, 0.08);
    fis.caja((xa + xb) / 2, Y + 0.6, zS, xb - xa, 1.2, 0.14, 0, { tipo: 'baranda' }); }
  // muro de piedra (contención) bajo el borde sur, donde el relleno queda alto
  for (let x = xW; x < xE - 0.01; x += 2) { const h = Y - Math.min(altura(x + 1, zS + 0.8), altura(x + 1, zS + 2)); if (h > 0.5) J.caja('piedra', x + 1, Y - h / 2 - 0.3, zS + 0.35, 2.05, h + 0.6, 0.6); }

  // ---------------- horno de reverbero (ladrillo, fierro) ----------------
  const hx0 = xW + 0.5, hx1 = X + 1.5, hz0 = zN + 0.3, hz1 = zN + 4.8, hH = 4.4, xT = X - 2.225;   // xT: piquera (sangría)
  J.caja('ladrillo', (hx0 + hx1) / 2, Y + hH / 2, (hz0 + hz1) / 2, hx1 - hx0, hH, hz1 - hz0);
  { const bg = new THREE.CylinderGeometry(2.25, 2.25, hx1 - hx0, 16, 1, false, 0, Math.PI); bg.rotateZ(Math.PI / 2); bg.scale(1, 0.32, 1); bg.translate((hx0 + hx1) / 2, Y + hH, (hz0 + hz1) / 2); J.add('ladrillo', bg); }
  fis.caja((hx0 + hx1) / 2, Y + (hH + 0.5) / 2, (hz0 + hz1) / 2, hx1 - hx0, hH + 0.5, hz1 - hz0, 0, { tipo: 'muro' });
  for (let x = hx0 + 0.2; x <= hx1 - 0.1; x += 1.45) for (const z of [hz0 - 0.1, hz1 + 0.12]) { J.caja('fierro', x, Y + hH / 2 + 0.2, z, 0.22, hH + 0.6, 0.18); }   // tirantes (I) verticales
  for (let x = hx0 + 0.2; x <= hx1 - 0.1; x += 1.45) F.caja('fierro', x, Y + hH + 0.75, (hz0 + hz1) / 2, 0.06, 0.06, hz1 - hz0 + 0.5);   // tensores sobre la bóveda
  // bocas incandescentes: hogar (poniente), puerta de trabajo y piquera; hollín alrededor
  const bocas = [];
  const boca = (x, y, w, h) => { J.caja('hollin', x, y, hz1 + 0.02, w + 0.5, h + 0.45, 0.06); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.brasa.clone()); m.position.set(x, y, hz1 + 0.07); grupo.add(m); bocas.push(m);
    J.caja('fierro', x, y + h / 2 + 0.15, hz1 + 0.12, w + 0.3, 0.12, 0.14); };
  boca(X - 6.575, Y + 1.2, 1.0, 0.9); boca(X - 0.775, Y + 1.5, 0.8, 0.6); boca(X + 0.675, Y + 1.5, 0.75, 0.6); boca(xT, Y + 3.9, 0.4, 0.35);
  J.caja('hollin', X - 6.575, Y + 0.05, hz1 + 1.5, 2.2, 0.1, 1.6);   // carbón frente al hogar
  // REV (16-11, revisor de mallas): los terrones sueltos (dodecaedros) van a su grupo de respaldo y los reemplaza un 2.º montón `carbon`
  const JCb = new Junta(); rocasCarbon(JCb, X - 7.2, hz1 + 1.6, Y);
  { const gC = new THREE.Group(); gC.name = 'fund_carbon_resp'; volcar(JCb, gC); grupo.add(gC); montarEnKit(grupo, [['carbon', X - 7.35, Y + 0.05, hz1 + 1.75, 2.2, [0.9, 0.7, 0.8]]], { ocultar: gC }); }
  { const pu = precargarUtileria(); if (pu) pu.then(() => { const c = piezaGrupo('carbon', [1.3, 0.9, 1.1]); if (c) { c.position.set(X - 6.1, Y + 0.06, hz1 + 1.5); c.rotation.y = 0.4; grupo.add(c); } }); }   // N0-UTIL3 (E2): montón de carbón TRELLIS sobre la losa de hollín, junto a las piedras de carbón
  // canaleta de sangría (piquera → olla bajo ella) con su caballete
  const yC0 = Y + 3.88, yC1 = Y + 3.4, zC1 = VZ - 0.85;
  barra(J, 'fierro', [xT, yC0 - 0.12, hz1 + 0.05], [xT, yC1 - 0.12, zC1], 0.5, 0.12);
  for (const s of [-1, 1]) barra(F, 'fierro', [xT + s * 0.25, yC0, hz1 + 0.05], [xT + s * 0.25, yC1, zC1], 0.05, 0.22);
  const canal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 1), M.chorro); grupo.add(canal);
  { const L = Math.hypot(zC1 - hz1, yC0 - yC1); canal.scale.z = L; canal.position.set(xT, (yC0 + yC1) / 2 - 0.05, (hz1 + zC1) / 2); canal.rotation.x = Math.atan2(yC0 - yC1, zC1 - hz1); }
  J.caja('madera', xT, (Y + yC1 - 0.2) / 2, zC1 - 0.4, 0.2, yC1 - 0.2 - Y, 0.2);
  // conducto de humos: sale del horno por el muro norte y sube la ladera hasta las chimeneas
  const ch1 = [X - 2, Z - 16.5], ch2 = [X + 5, Z - 14.5];
  const conducto = (xa, za, xb, zb) => { const n = Math.ceil(Math.hypot(xb - xa, zb - za) / 2); let prev = null;
    for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n, z = za + (zb - za) * i / n, y = Math.max(altura(x, z), Y + 2.2) + 0.55; if (prev) { barra(J, 'ladrillo', [prev[0], prev[1], prev[2]], [x, y, z], 1.5, 1.5); fis.caja((prev[0] + x) / 2, (prev[1] + y) / 2, (prev[2] + z) / 2, 1.5, Math.abs(y - prev[1]) + 1.4, Math.hypot(x - prev[0], z - prev[2]) + 0.2, Math.atan2(x - prev[0], z - prev[2]), { tipo: 'muro' }); } prev = [x, y, z]; } };
  conducto(ch1[0], zN - 0.2, ch1[0], ch1[1] + 1.6); conducto(ch2[0], zN - 0.2, ch2[0], ch2[1] + 1.6);
  const CH = [chimenea(J, F, fis, ch1[0], ch1[1], 27), chimenea(J, F, fis, ch2[0], ch2[1], 24)];
  { const pos = []; for (const c of CH) pos.push(...c.lin); const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x222222 })); l.name = 'fund_tensores'; grupo.add(l); }

  // ---------------- vía interior, lecho de moldes ----------------
  // (la vía de la playa sigue al oriente; esta llega hasta el tope frente al horno)
  const xV0 = xW + 1.2, LV = xE - xV0;
  { const A = new Junta(); const n = Math.floor(LV / 0.7);
    for (let i = 0; i <= n; i++) A.caja('durm', xV0 + i * LV / n, Y + 0.06, VZ, 0.2, 0.12, 1.7);   // TEX: durmientes y rieles con textura
    for (const z of [-0.5, 0.5]) A.caja('riel', xV0 + LV / 2, Y + 0.17, VZ + z, LV, 0.1, 0.07);
    A.caja('fierro', xV0 + 0.1, Y + 0.5, VZ, 0.3, 0.9, 0.3); A.caja('fierro', xV0 + 0.1, Y + 0.95, VZ, 0.25, 0.2, 1.2); volcar(A, grupo, false); }
  const zMo = VZ + 2.35, nMo = 7, xMo0 = X - 1.0, dMo = 0.95;
  J.caja('arena', xMo0 + (nMo - 1) * dMo / 2, Y + 0.08, zMo, nMo * dMo + 0.6, 0.16, 1.3);
  fis.caja(xMo0 + (nMo - 1) * dMo / 2, Y + 0.2, zMo, nMo * dMo + 0.6, 0.4, 1.3, 0, { tipo: 'cajon' });
  const moldes = [], JMo = new Junta();   // Q1: los moldes de cajas son el respaldo de la malla molde_lingote
  for (let i = 0; i < nMo; i++) {
    const x = xMo0 + i * dMo; JMo.caja('fierro', x, Y + 0.3, zMo, 0.8, 0.28, 0.62);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44), M.brasa.clone()); m.rotation.x = -Math.PI / 2; m.position.set(x, Y + 0.445, zMo); grupo.add(m);
    moldes.push({ x, m, calor: 0 });
  }
  { const gMo = new THREE.Group(); gMo.name = 'fund_moldes_resp'; volcar(JMo, gMo); grupo.add(gMo);
    // Q1 (16-11): molde_lingote trae 3 moldes en fila; se usa solo el del medio (|x| < 0,3: 0,41 × 0,25 × 0,6, cavidad 0,3 × 0,45 con fondo a
    // 0,07) girado 90° y escalado [1,5, 1,12, 1,33] a la caja de 0,8 × 0,28 × 0,62 del respaldo: 7 copias en un InstancedMesh. La brasa
    // animada (vertido y enfriado) sigue: el plano baja dentro de la cavidad (y 0,16 + 0,2) y se ajusta a su boca (0,58 × 0,45).
    const pu = precargarUtileria(); if (pu) pu.then(() => { const P = partirPieza('molde_lingote', 'uno', x => Math.abs(x) < 0.3); if (!P || !P.b.index.count) return;
      const im = new THREE.InstancedMesh(P.b, P.mat, nMo), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), es = new THREE.Vector3(1.5, 1.12, 1.33), v = new THREE.Vector3();
      moldes.forEach((mo, i) => { im.setMatrixAt(i, m4.compose(v.set(mo.x, Y + 0.16, zMo), q, es)); mo.m.position.y = Y + 0.36; mo.m.scale.x = 0.92; mo.m.scale.y = 1.0; });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; im.name = 'q1_molde_lingote'; grupo.add(im); gMo.visible = false; }); }
  // pilas de «mata» ya fría (panes de cobre oscuro) junto al portón
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - (i > 1 ? 1 : 0); j++) J.caja('hollin', xE - 2.2 + j * 0.85, Y + 0.12 + i * 0.25, zS - 1.3 + (i % 2) * 0.1, 0.75, 0.23, 0.55);
  // barandilla de seguridad entre la vía y el pasillo de los moldes (con un paso en el medio)
  for (const [a, b] of [[xW + 0.4, xMo0 - 0.9], [xMo0 + nMo * dMo, xE - 0.6]]) { if (b - a < 0.5) continue;
    for (let x = a; x <= b + 0.01; x += Math.max(0.5, (b - a) / Math.ceil((b - a) / 1.8))) F.caja('madera', x, Y + 0.5, VZ + 3.35, 0.1, 1.0, 0.1);
    J.caja('madera', (a + b) / 2, Y + 1.0, VZ + 3.35, b - a, 0.1, 0.12); fis.caja((a + b) / 2, Y + 0.55, VZ + 3.35, b - a, 1.1, 0.14, 0, { tipo: 'baranda' }); }

  // ---------------- pasarela-escalera de tablas por la ladera (fundición → camino de arriba) ----------------
  { const xP = X - 9.2, zA = zN - 0.6, zB = Z - 30, n = 5, pts = [];
    for (let i = 0; i <= n; i++) { const z = zA + (zB - zA) * i / n; pts.push([z, Math.max(altura(xP - 0.7, z), altura(xP + 0.7, z), altura(xP, z)) + 0.35]); }
    for (let i = 1; i <= n; i++) pts[i][1] = Math.max(pts[i][1], pts[i - 1][1] + 0.3);
    for (let i = 0; i < n; i++) {
      const [za, ya] = pts[i], [zb, yb] = pts[i + 1], Ls = Math.abs(zb - za), nE = Math.max(1, Math.round((yb - ya) / 0.19));
      for (let k = 0; k < nE; k++) { const z = za + (zb - za) * (k + 0.5) / nE, y = ya + (yb - ya) * (k + 1) / nE; J.caja('tab', xP, y - 0.05, z, 1.5, 0.1, Ls / nE + 0.04); F.caja('madera', xP, y - 0.2, z + Ls / nE * 0.5, 1.5, 0.2, 0.06); }
      for (const s of [-1, 1]) { barra(J, 'madera', [xP + s * 0.78, ya - 0.2, za], [xP + s * 0.78, yb - 0.2, zb], 0.1, 0.32); barra(F, 'madera', [xP + s * 0.8, ya + 0.95, za], [xP + s * 0.8, yb + 0.95, zb], 0.08, 0.1); }
      for (const s of [-1, 1]) { const z = za, y = ya, h = y - altura(xP + s * 0.8, z); F.caja('madera', xP + s * 0.8, y + 0.5 - h / 2, z, 0.12, h + 1.0, 0.12); }
      // ESC (16-11, Diego: «que Nato no se entierre en las escaleras»): antes una rampa por el borde de abajo de cada tramo: las tablas
      // quedaban hasta una contrahuella (~15 cm) sobre la colisión. Ahora una caja por tabla, a su altura (cáscara de una contrahuella + 12 cm)
      const rE = (yb - ya) / nE, sg = Math.sign(zb - za) || 1;
      for (let k = 0; k < nE; k++) { const z = za + (zb - za) * (k + 0.5) / nE, y = ya + (yb - ya) * (k + 1) / nE; fis.caja(xP, y - (rE + 0.12) / 2, z, 1.5, rE + 0.12, Ls / nE + 0.04, 0, { tipo: 'escalera' }); }
      if (i === 0) { J.caja('tab', xP, ya - 0.05, za - sg * 0.15, 1.5, 0.1, 0.3); fis.caja(xP, ya - 0.25, za - sg * 0.15, 1.5, 0.5, 0.3, 0, { tipo: 'escalera' }); }   // ESC: primera tabla a la altura del arranque (del suelo a la 1.ª huella había 0,54 m)
      for (const s of [-1, 1]) fis.caja(xP + s * 0.85, (ya + yb) / 2 + 0.55, (za + zb) / 2, 0.1, 1.1 + Math.abs(yb - ya), Ls, 0, { tipo: 'baranda' });
    }
    e._pasarela = { x: xP, pts }; }

  // ---------------- caballete del tranvía de mineral (llega al cuerpo alto por el norte, cruza sobre el camino) ----------------
  { const xT2 = (C3.x0 + C3.x1) / 2 - 1, z0 = C3.z0 + 0.4, z1 = C3.z0 - 12.5, bents = [z0 - 0.6, z0 - 6.6, z1 + 0.4];
    let gMax = -1e9; for (let z = z0 - 1; z >= z1; z -= 0.5) for (const dx of [-1.4, 0, 1.4]) gMax = Math.max(gMax, altura(xT2 + dx, z));
    const yD = Math.max(C3.y + 1.2, gMax + 3.6);   // el camino de arriba pasa por debajo con ≥ 3 m libres
    { const ga = Math.min(altura(xT2 - 1.3, z1), altura(xT2 + 1.3, z1)) - 0.6, h = yD - 0.2 - ga; J.caja('piedra', xT2, ga + h / 2, z1 - 0.6, 3.0, h, 2.2); fis.caja(xT2, ga + h / 2, z1 - 0.6, 3.0, h, 2.2, 0, { tipo: 'muro' }); }   // estribo de piedra al norte
    J.caja('tab', xT2, yD - 0.1, (z0 + z1) / 2, 2.6, 0.2, z0 - z1); fis.caja(xT2, yD - 0.1, (z0 + z1) / 2, 2.6, 0.2, z0 - z1, 0, { tipo: 'piso' });
    for (const s of [-1, 1]) { J.caja('madera', xT2 + s * 1.2, yD - 0.45, (z0 + z1) / 2, 0.3, 0.5, z0 - z1); F.caja('fierro', xT2 + s * 0.5, yD + 0.05, (z0 + z1) / 2, 0.08, 0.1, z0 - z1); }
    for (const z of bents.slice(0, 2)) { for (const s of [-1, 1]) { const x = xT2 + s * 1.15, h = yD - 0.6 - altura(x, z); if (h < 0.3) continue; barra(J, 'madera', [x + s * h * 0.12, yD - 0.6 - h - 0.3, z], [x, yD - 0.6, z], 0.3, 0.3); fis.caja(x, yD - 0.6 - h / 2, z, 0.3, h, 0.3, 0, { tipo: 'muro' }); }
      const h = yD - 0.6 - Math.min(altura(xT2 - 1.15, z), altura(xT2 + 1.15, z)); if (h > 1.5) { barra(F, 'madera', [xT2 - 1.2, yD - 0.6 - h * 0.85, z], [xT2 + 1.2, yD - 0.7, z], 0.14, 0.14); barra(F, 'madera', [xT2 + 1.2, yD - 0.6 - h * 0.85, z], [xT2 - 1.2, yD - 0.7, z], 0.14, 0.14); } }
    J.caja('oscuro', xT2, yD + 1.1, C3.z0 + 0.42, 2.0, 2.2, 0.04);   // boca en el muro norte del cuerpo alto
    const vg = new THREE.Group(), V = new Junta(); V.caja('fierro', 0, 0.55, 0, 1.0, 0.65, 1.5); for (const z of [-0.45, 0.45]) for (const x of [-0.35, 0.35]) cil(V, 'hollin', x, 0.2, z, 0.18, 0.18, 0.08, 10, 'x');
    for (let i = 0; i < 5; i++) { const g = new THREE.DodecahedronGeometry(0.22, 0); g.translate((i % 3 - 1) * 0.28, 0.95, (i - 2) * 0.22); V.add('roca', g); }
    volcar(V, vg); vg.position.set(xT2, yD, (z0 + z1) / 2 - 2); grupo.add(vg); }

  // ---------------- volcar geometría (lo fino en un LOD que se oculta lejos) ----------------
  volcar(J, grupo);
  const finos = new THREE.Group(); volcar(F, finos, false);
  const lod = new THREE.LOD(); lod.name = 'fund_finos'; lod.addLevel(finos, 0); lod.addLevel(new THREE.Group(), 150); grupo.add(lod);

  // ---------------- carro vaciador animado ----------------
  const carro = carroVaciador(); grupo.add(carro);
  const xFill = xT, xOut = xE + 2.9;
  const pl = fis.movil(xFill, Y, VZ, [{ x: 0, y: 0.6, z: 0, sx: 3.6, sy: 1.0, sz: 1.9 }, { x: 0, y: 2.0, z: 0, sx: 2.1, sy: 1.8, sz: 2.1 }], { tipo: 'cajon' });
  const chorro = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 1, 8), M.chorro); chorro.position.set(xT, (yC1 + Y + 2.75) / 2 - 0.05, zC1 + 0.1); chorro.scale.y = yC1 - (Y + 2.75); grupo.add(chorro);
  const vierte = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 1, 8), M.chorro); grupo.add(vierte);
  // chispas (Points aditivos)
  const NCH = 70, chP = new Float32Array(NCH * 3), chV = new Float32Array(NCH * 4);
  const chG = new THREE.BufferGeometry(); chG.setAttribute('position', new THREE.BufferAttribute(chP, 3));
  const chispas = new THREE.Points(chG, new THREE.PointsMaterial({ color: 0xffb050, size: 0.09, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  chispas.frustumCulled = false; chispas.name = 'fund_chispas'; grupo.add(chispas);
  for (let i = 0; i < NCH; i++) { chP[i * 3 + 1] = -1e4; chV[i * 4 + 3] = 0; }
  // luz naranja del horno y del vertido (una sola, se mueve con el trabajo)
  const luz = new THREE.PointLight(0xff8a3a, 40, 20, 1.6); luz.position.set(X - 3, Y + 2.2, VZ - 2); grupo.add(luz);
  // humo y vapor
  const humo = crearHumo(260); grupo.add(humo);
  for (const c of CH) humo.userData.fuentes.push({ x: c.tope[0], y: c.tope[1], z: c.tope[2], r: 1.2, cada: 0.2, vida: 20, s0: 2.8, crece: 15, sube: 5.5, tono0: 0, tono1: 0.4, op: 0.95, viento: 1.5 });
  const vap = (x, y, z, k = 1) => humo.userData.fuentes.push({ x, y, z, r: 0.5, cada: 0.55 / k, vida: 5.5, s0: 0.9, crece: 4.5, sube: 2.2, tono0: 1, tono1: 1, op: 0.55, viento: 0.9 });
  vap((C2.x0 + C2.x1) / 2 - 2.4, C2.y + 12.3 + 2.8, (C2.z0 + C2.z1) / 2); vap((C2.x0 + C2.x1) / 2 + 2.4, C2.y + 12.3 + 2.8, (C2.z0 + C2.z1) / 2);
  vap(C1.x1 + 0.25, C1.y + 8.2, (C1.z0 + C1.z1) / 2 + 2, 0.7);
  humo.userData.fuentes.push({ x: X - 1, y: yR + 1.4, z: Z, r: 6, cada: 0.6, vida: 8, s0: 1.8, crece: 6, sube: 1.6, tono0: 0.35, tono1: 0.7, op: 0.35, viento: 1.2 });   // calor por la linterna
  const vapOlla = { x: xT, y: Y + 3.4, z: VZ, r: 0.6, cada: 0.9, vida: 3.5, s0: 0.6, crece: 2.6, sube: 1.4, tono0: 0.85, tono1: 1, op: 0.0, viento: 0.6 };
  humo.userData.fuentes.push(vapOlla);

  // obreros de fundición de 1905 (obreros1905.js: gorra o fieltro, antiparras, pañuelo, delantal de cuero, guantes, herramienta), no enemigos
  registrarFundidores();
  const ob = (x, z, mira, herramienta, extra = {}) => R.specs.push({ t: 'fundidor', x, z, y: extra.y ?? Y, mira, herramienta, ...extra });
  ob(X - 5.6, hz1 + 1.4, [X - 6.575, hz1], 'barra', { antiparras: true, ritmo: 1.3 });   // pica el hogar
  ob(xT + 1.5, hz1 + 1.5, [xT, hz1 + 0.5], 'barra', { gorro: 'fieltro', antiparras: true, panuelo: 0x2a3a5a, texto: 'Del horno sale la «mata»: cobre con azufre y fierro, todavía no es cobre puro. La sangramos en la olla y se vacía en los moldes.' });
  ob(xMo0 + 3 * dMo, zMo + 1.6, [xMo0 + 3 * dMo, zMo], 'rastrillo', { ritmo: 0.9 });   // moldes
  ob(xE - 2.6, zS - 2.4, [xE - 2.2, zS - 1.3], 'tenazas', { gorro: 'fieltro', panuelo: 0x6a5a3a });   // apila la mata fría
  { const x = C1.x0 - 1.2, z = Z + 1.8; ob(x, z, [C1.x0 - 2.5, Z + 3.5], 'pala', { y: altura(x, z), ritmo: 1.0 }); }   // palea mineral al pie del molino

  // ---------------- ciclo de trabajo (se anima al dibujarse) ----------------
  const T = { llenar: 7, ir: 4, vaciar: 14, salir: 6, fuera: 5, volver: 7 }, TT = Object.values(T).reduce((a, b) => a + b, 0);
  const suave = f => { f = Math.min(1, Math.max(0, f)); return f * f * (3 - 2 * f); };
  const xMo1 = xMo0 + (nMo - 1) * dMo;
  let tC = 0, t0 = 0, cx = xFill, nivel = 0.15, tilt = 0, quemo = 0;
  const cam = new THREE.Vector3(), _v = new THREE.Vector3();
  const estado = { fase: '' };
  humo.onBeforeRender = (r, s, camera) => {   // una vez por cuadro (el humo se dibuja siempre: frustumCulled = false)
    const ahora = performance.now() / 1000, dt = t0 ? Math.min(0.1, ahora - t0) : 0.016; if (t0 && ahora - t0 < 0.004) return; t0 = ahora;
    camera.getWorldPosition(cam);
    const lejos = Math.hypot(cam.x - X, cam.z - Z);
    humo.userData.paso(dt, cam);
    if (lejos > 260) return;
    const G = globalThis.JUEGO, Mj = G && G.M, j = Mj && Mj.jug;
    // ¿Nato en la vía por delante del carro? el carro espera
    let bloqueo = false;
    if (j && Math.abs(j.pos.z - VZ) < 1.5 && Math.abs(j.pie - Y) < 1.6) { const dx = j.pos.x - cx; bloqueo = Math.abs(dx) < 2.6 + 0.3; }
    if (!bloqueo) tC = (tC + dt) % TT;
    let t = tC, fase, f;
    const fases = Object.entries(T); for (const [n, d] of fases) { if (t < d) { fase = n; f = t / d; break; } t -= d; }
    let xn = cx, llena = false, vac = false;
    if (fase === 'llenar') { xn = xFill; nivel = 0.15 + 0.85 * suave(f / 0.9); llena = f < 0.92; tilt = 0; }
    else if (fase === 'ir') { xn = xFill + (xMo0 - 0.15 - xFill) * suave(f); tilt = 0; }
    else if (fase === 'vaciar') { const a = Math.min(1, f / 0.14), b = Math.max(0, (f - 0.86) / 0.14); tilt = 1.15 * suave(a) * (1 - suave(b)); xn = xMo0 - 0.15 + (xMo1 - xMo0 + 0.3) * Math.min(1, Math.max(0, (f - 0.12) / 0.74)); vac = f > 0.1 && f < 0.88; nivel = Math.max(0.05, 1 - Math.max(0, f - 0.1) / 0.78); }
    else if (fase === 'salir') { xn = xMo1 + 0.15 + (xOut - xMo1 - 0.15) * suave(f); tilt = 0; }
    else if (fase === 'fuera') xn = xOut;
    else { xn = xOut + (xFill - xOut) * suave(f); nivel = 0.12; }
    if (bloqueo) xn = cx;
    cx = xn;
    carro.position.set(cx, Y, VZ); fis.moverMovil(pl, cx, Y, VZ);
    const { piv, cobre } = carro.userData; piv.rotation.x = tilt;
    cobre.visible = tilt < 0.5 && nivel > 0.12; cobre.position.y = -0.7 + nivel * 1.18; cobre.scale.x = cobre.scale.z = (0.72 + 0.28 * (cobre.position.y + 0.75) / 1.3) / 0.94 * 0.96;
    cobre.material.color.setRGB(1, 0.62 + Math.sin(ahora * 6) * 0.04, 0.26);
    chorro.visible = llena; if (llena) chorro.scale.x = chorro.scale.z = 0.8 + Math.sin(ahora * 31) * 0.2;
    vapOlla.op = nivel > 0.3 ? 0.35 : 0; vapOlla.x = cx; vapOlla.y = Y + 3.2;
    // chorro del vertido: del pico de la olla volcada al molde bajo él
    vierte.visible = vac && tilt > 0.8;
    if (vierte.visible) { _v.set(0, 0.5, 1.15).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt); const ax = cx, ay = Y + 2.25 + _v.y, az = VZ + _v.z, by = Y + 0.45, bz = zMo;
      const L = Math.hypot(ay - by, bz - az); vierte.scale.set(1, L, 1); vierte.position.set(ax, (ay + by) / 2, (az + bz) / 2); vierte.rotation.set(-Math.atan2(bz - az, ay - by), 0, 0);
      for (const m of moldes) if (Math.abs(m.x - cx) < 0.5) m.calor = Math.min(1, m.calor + dt * 1.5); }
    for (const m of moldes) { m.calor = Math.max(0, m.calor - dt * 0.03); const k = m.calor; m.m.visible = k > 0.02; m.m.material.color.setRGB(Math.min(1, 0.18 + k * 1.1), 0.03 + 0.52 * k ** 1.6, 0.01 + 0.14 * k ** 3); }
    // bocas del horno: titilan
    for (let i = 0; i < bocas.length; i++) { const fl = 0.82 + Math.sin(ahora * (7 + i * 1.7) + i) * 0.1 + Math.sin(ahora * 17.3 + i * 3) * 0.06; bocas[i].material.color.setRGB(fl, 0.55 * fl, 0.2 * fl); }
    luz.intensity = 34 + Math.sin(ahora * 9) * 5 + Math.sin(ahora * 23) * 3 + (vac ? 18 : 0); luz.position.set((cx + xT) / 2, Y + 2.4, VZ - 1.2);
    // chispas: en la piquera mientras se llena y en el vertido
    if (lejos < 90) {
      const fuentes = []; if (llena) fuentes.push([xT, yC1 - 0.1, zC1 + 0.2]); if (vierte.visible) fuentes.push([cx, Y + 0.5, zMo]); fuentes.push([X - 6.575, Y + 1.4, hz1 + 0.2]);
      for (let i = 0; i < NCH; i++) {
        if (chV[i * 4 + 3] <= 0) { if (Math.random() < dt * 9 && fuentes.length) { const s = fuentes[(Math.random() * fuentes.length) | 0]; chP[i * 3] = s[0]; chP[i * 3 + 1] = s[1]; chP[i * 3 + 2] = s[2];
          chV[i * 4] = (Math.random() - 0.5) * 2.4; chV[i * 4 + 1] = 1.5 + Math.random() * 3; chV[i * 4 + 2] = (Math.random() - 0.3) * 2.4; chV[i * 4 + 3] = 0.5 + Math.random() * 0.9; } else { chP[i * 3 + 1] = -1e4; continue; } }
        chV[i * 4 + 3] -= dt; chV[i * 4 + 1] -= 9 * dt; chP[i * 3] += chV[i * 4] * dt; chP[i * 3 + 1] += chV[i * 4 + 1] * dt; chP[i * 3 + 2] += chV[i * 4 + 2] * dt;
        if (chP[i * 3 + 1] < Y + 0.05) chV[i * 4 + 3] = 0;
      }
      chG.attributes.position.needsUpdate = true;
    }
    // saltar dentro de la olla del carro: daña y rebota (como las ollas de la playa)
    if (j && nivel > 0.2 && tilt < 0.4) {
      const top = Y + 2.25 + 0.6, dx = j.pos.x - cx, dz = j.pos.z - VZ;
      quemo = Math.max(0, quemo - dt);
      if (Math.hypot(dx, dz) < 1.0 && j.pie < top + 0.45 && j.pie > top - 1.4 && !quemo) {
        if (danar(j, 'olla')) { Mj.efecto?.('herido'); Mj.voz?.('ay'); Mj.rotulo?.('¡AY, AY, AY!'); }
        j.vel.set(dx || 0.3, 0, dz || 0.3).setLength(7); j.vel.y = 11; j.rebote = true; quemo = 0.4;
      }
    }
    estado.fase = fase; estado.x = cx;
  };
  globalThis.__fundicion = { estado, Y, X, Z, VZ, xs: { xFill, xMo0, xMo1, xOut }, cuerpos: [C1, C2, C3], CH: CH.map(c => c.tope), pasarela: e._pasarela };
  R.exterior.add(grupo);
  return grupo;
}
function rocasCarbon(J, x, z, Y) {
  let s = 99; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 16; i++) { const g = new THREE.DodecahedronGeometry(0.12 + r() * 0.14, 0); g.translate(x + (r() - 0.5) * 1.6, Y + 0.12 + r() * 0.15, z + (r() - 0.5) * 1.0); J.add('hollin', g); }
}
