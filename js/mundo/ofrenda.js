// N3-C14 (14-11-2026, pedido de Diego): ofrenda del memorial del 19 de junio de 1945 (tragedia del humo).
// Antes eran una media esfera amarilla lisa y siete bolitas de colores. Ahora, todo procedural (sin assets nuevos):
//  - casco minero de época de cuero endurecido, gastado (textura, relieve y rugosidad), con ala, cresta, soporte y
//    lámpara de carburo de bronce apagada al frente;
//  - dos ramos de claveles rojos y blancos envueltos en papel, con tallos, cálices y hojas, atados con cinta negra de luto;
//  - una rama de copihues (rojos y uno blanco) apoyada en el casco;
//  - dos velas en vasos de vidrio con llama que titila (luz cálida muy suave).
// Tono de duelo: colores apagados, nada brillante ni festivo. ofrendaMemorial(x, y, z) devuelve un grupo; el frente
// (lámpara del casco) mira a +Z, por donde llega Nato.
import * as THREE from 'three';

const PI = Math.PI;
let azar = 1945;
const rnd = () => { azar = (azar * 16807) % 2147483647; return (azar - 1) / 2147483646; };

function lienzo(n, dibujar) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  dibujar(c.getContext('2d'), n);
  return c;
}
function texDe(c, srgb = true) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

// cuero endurecido negro-café, gastado: manchas, rayones claros y bordes pelados (el mismo lienzo en gris da el relieve)
function cueroCasco() {
  const color = lienzo(256, (g, n) => {
    g.fillStyle = '#4a3624'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) {   // manchas de grasa y desgaste
      const x = rnd() * n, y = rnd() * n, r = 4 + rnd() * 22, l = rnd() < 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, l ? 'rgba(92,70,48,0.35)' : 'rgba(14,10,8,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 140; i++) {   // rayones
      const x = rnd() * n, y = rnd() * n, a = rnd() * PI, L = 3 + rnd() * 18;
      g.strokeStyle = `rgba(150,120,90,${0.15 + rnd() * 0.35})`; g.lineWidth = 0.6 + rnd();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`; g.fillRect(rnd() * n, rnd() * n, 1, 1); }   // poro del cuero
  });
  const relieve = lienzo(256, (g, n) => {
    g.drawImage(color, 0, 0); const d = g.getImageData(0, 0, n, n), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const v = (p[i] + p[i + 1] + p[i + 2]) / 3; p[i] = p[i + 1] = p[i + 2] = Math.min(255, v * 2.4); }
    g.putImageData(d, 0, 0);
  });
  return new THREE.MeshStandardMaterial({ map: texDe(color), bumpMap: texDe(relieve, false), bumpScale: 2.5, roughnessMap: texDe(relieve, false), roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide });
}

// bronce viejo (lámpara de carburo): verdín y oscurecido en los rebajes
function bronceViejo() {
  const c = lienzo(128, (g, n) => {
    g.fillStyle = '#8a6a34'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 160; i++) {
      const x = rnd() * n, y = rnd() * n, r = 2 + rnd() * 12, v = rnd();
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, v < 0.25 ? 'rgba(70,110,90,0.45)' : v < 0.7 ? 'rgba(40,28,14,0.45)' : 'rgba(200,165,95,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  });
  return new THREE.MeshStandardMaterial({ map: texDe(c), metalness: 0.75, roughness: 0.45 });
}

function casco() {
  const g = new THREE.Group(), cuero = cueroCasco(), bronce = bronceViejo();
  // ala y copa en un solo perfil de revolución (r, y): labio interior, ala, quiebre y copa
  const perfil = [[0.150, 0.006], [0.205, 0.002], [0.228, 0.006], [0.232, 0.014], [0.214, 0.020], [0.178, 0.026], [0.168, 0.040],
    [0.166, 0.070], [0.160, 0.110], [0.146, 0.150], [0.120, 0.186], [0.084, 0.212], [0.044, 0.227], [0.001, 0.232]].map(([r, y]) => new THREE.Vector2(r, y));
  const copa = new THREE.LatheGeometry(perfil, 40);
  const pa = copa.attributes.position;   // un poco ovalado (más largo de adelante hacia atrás) y con el ala de atrás más ancha
  for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i); pa.setZ(i, z * 1.1 - (pa.getY(i) < 0.03 && z < 0 ? 0.012 : 0)); }
  copa.computeVertexNormals();
  const m = new THREE.Mesh(copa, cuero); m.castShadow = true; g.add(m);
  // cresta de refuerzo de adelante hacia atrás
  const pts = []; for (let k = 0; k <= 20; k++) { const t = -1.22 + 2.44 * k / 20; pts.push(new THREE.Vector3(0, 0.032 + 0.203 * Math.cos(t), 0.178 * Math.sin(t))); }
  const cresta = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 6), cuero); cresta.scale.x = 0.8; g.add(cresta);
  // soporte de la lámpara (placa de latón remachada) y la lámpara de carburo, apagada
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.008), bronce); placa.position.set(0, 0.118, 0.177); placa.rotation.x = -0.32; g.add(placa);
  const lamp = new THREE.Group(); lamp.position.set(0, 0.112, 0.2); lamp.rotation.x = -0.12; g.add(lamp);
  const tanque = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.02, 0.04, 16), bronce); tanque.position.set(0, 0.012, -0.004); lamp.add(tanque);
  const carburo = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.036, 16), bronce); carburo.position.set(0, -0.026, -0.004); lamp.add(carburo);
  const rosca = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0025, 6, 16), bronce); rosca.rotation.x = PI / 2; rosca.position.y = -0.008; lamp.add(rosca);
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.008, 10), bronce); tapa.position.set(0, 0.036, -0.004); lamp.add(tapa);
  // reflector cóncavo hacia el frente, con el mechero al centro
  const refl = new THREE.Mesh(new THREE.LatheGeometry([0.003, 0.012, 0.022, 0.032, 0.038].map((r, k) => new THREE.Vector2(r, k * k * 0.0016)), 24),
    new THREE.MeshStandardMaterial({ color: 0xb8a070, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  refl.rotation.x = PI / 2; refl.position.set(0, 0.016, 0.016); lamp.add(refl);
  const mech = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.02, 8), bronce); mech.rotation.x = PI / 2; mech.position.set(0, 0.016, 0.024); lamp.add(mech);
  // remaches de la placa
  for (const [x, y] of [[-0.018, 0.022], [0.018, 0.022], [-0.018, -0.022], [0.018, -0.022]]) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 4), bronce); r.position.set(x, y, 0.005); placa.add(r); }
  return g;
}

// ---------------- flores ----------------
function texClavel(c1, c2, borde) {
  return texDe(lienzo(128, (g, n) => {
    const h = n / 2; g.clearRect(0, 0, n, n);
    g.beginPath();
    for (let i = 0; i <= 96; i++) { const a = i / 96 * 2 * PI, r = h * (0.9 - (i % 2) * 0.07 - rnd() * 0.06 - 0.05 * (Math.sin(a * 5) > 0.8 ? 1 : 0)); g.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r); }
    const gr = g.createRadialGradient(h, h, 2, h, h, h); gr.addColorStop(0, c1); gr.addColorStop(0.75, c2); gr.addColorStop(1, borde);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;   // pliegues de los pétalos
    for (let i = 0; i < 40; i++) { const a = rnd() * 2 * PI, r0 = h * 0.15, r1 = h * (0.6 + rnd() * 0.3); g.beginPath(); g.moveTo(h + Math.cos(a) * r0, h + Math.sin(a) * r0); g.lineTo(h + Math.cos(a + 0.1) * r1, h + Math.sin(a + 0.1) * r1); g.stroke(); }
  }));
}
function texHoja(c) {
  return texDe(lienzo(64, (g, n) => {
    g.clearRect(0, 0, n, n); g.fillStyle = c; g.beginPath(); g.moveTo(n / 2, 1);
    g.quadraticCurveTo(n * 0.95, n * 0.45, n / 2, n - 1); g.quadraticCurveTo(n * 0.05, n * 0.45, n / 2, 1); g.fill();
    g.strokeStyle = 'rgba(255,255,230,0.25)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(n / 2, 3); g.lineTo(n / 2, n - 3); g.stroke();
  }));
}

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const flor = (t, em = 0x000000) => new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, emissive: em });   // em: un poco de luz propia cálida (de noche la luna azulaba los pétalos blancos)
  MATS = {
    rojo: flor(texClavel('#5a0710', '#9e1220', '#b8202c')),
    blanco: flor(texClavel('#cfc2b4', '#ece6dc', '#f4efe8'), 0x2a2018),
    tallo: new THREE.MeshStandardMaterial({ color: 0x55704a, roughness: 0.8 }),
    hojaClavel: new THREE.MeshStandardMaterial({ map: texHoja('#6d8a6a'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }),
    hojaCopihue: new THREE.MeshStandardMaterial({ map: texHoja('#2f4a26'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.45 }),
    copihueRojo: new THREE.MeshStandardMaterial({ color: 0xa8182a, roughness: 0.35, side: THREE.DoubleSide }),
    copihueBlanco: new THREE.MeshStandardMaterial({ color: 0xece4da, roughness: 0.35, side: THREE.DoubleSide }),
    papel: new THREE.MeshStandardMaterial({ color: 0x8f7a5c, roughness: 0.95, side: THREE.DoubleSide }),
    cinta: new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }),
  };
  return MATS;
}

// cabeza de clavel: tres coronas de pétalos con borde dentado, ahuecadas, sobre un cáliz verde
function clavel(blanco) {
  const M = mats(), g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const r = 0.034 - k * 0.008, geo = new THREE.CircleGeometry(r, 28); geo.rotateX(-PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z) / r; p.setY(i, d * d * (0.012 + k * 0.01) + Math.sin(Math.atan2(z, x) * 7 + k) * 0.002 * d); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, blanco ? M.blanco : M.rojo); m.position.y = 0.006 + k * 0.006; m.rotation.y = rnd() * PI; g.add(m);
  }
  const caliz = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.006, 0.026, 8), M.tallo); caliz.position.y = -0.008; g.add(caliz);
  return g;
}

// ramo de claveles envuelto en papel y atado con cinta negra; eje del ramo = +Y (tallos abajo)
function ramo(n, rojos) {
  const M = mats(), g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * PI + rnd() * 0.4, inc = i === 0 ? 0 : 0.18 + rnd() * 0.12, L = 0.3 + rnd() * 0.06;
    const f = new THREE.Group(); f.rotation.set(Math.cos(a) * inc, 0, Math.sin(a) * inc); g.add(f);
    const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0045, L, 5), M.tallo); tallo.position.y = L / 2; f.add(tallo);
    const c = clavel(i >= rojos); c.position.y = L + 0.012; c.rotation.set((rnd() - 0.5) * 0.4, rnd() * PI, (rnd() - 0.5) * 0.4); f.add(c);
    for (let k = 0; k < 2; k++) {   // hojas finas del clavel
      const h = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.075), M.hojaClavel); h.position.set(0, L * (0.35 + k * 0.25), 0);
      h.rotation.set(0, a + k * 2, (k ? 1 : -1) * 0.5); h.translateY(0.03); f.add(h);
    }
  }
  // papel de envolver: cono abierto con el borde ondulado
  const pr = []; for (let k = 0; k <= 8; k++) pr.push(new THREE.Vector2(0.012 + k * 0.011, k * 0.03));
  const cono = new THREE.LatheGeometry(pr, 24, 0, PI * 1.55), pp = cono.attributes.position;
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); if (y > 0.2) pp.setY(i, y + Math.sin(Math.atan2(pp.getZ(i), pp.getX(i)) * 6) * 0.012); }
  cono.computeVertexNormals();
  const papel = new THREE.Mesh(cono, M.papel); papel.position.y = 0.01; g.add(papel);
  // cinta de luto con lazo
  const nudo = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 20), M.cinta); nudo.rotation.x = PI / 2; nudo.scale.set(1, 1, 1.6); nudo.position.y = 0.07; g.add(nudo);
  for (const s of [-1, 1]) {
    const lazo = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 16), M.cinta); lazo.scale.set(1, 0.5, 0.6); lazo.position.set(s * 0.03, 0.07, 0.04); lazo.rotation.z = s * 0.4; g.add(lazo);
    const cola = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.12), M.cinta); cola.position.set(s * 0.018, 0.015, 0.045); cola.rotation.z = s * 0.25; g.add(cola);
  }
  return g;
}

// copihue (flor nacional): campana cerosa de seis tépalos que cuelga del tallo
function copihue(blanco) {
  const M = mats(), pr = [];
  for (let k = 0; k <= 10; k++) { const t = k / 10; pr.push(new THREE.Vector2(0.004 + 0.02 * Math.pow(t, 0.8) + (t > 0.85 ? (t - 0.85) * 0.05 : 0), -t * 0.072)); }
  const geo = new THREE.LatheGeometry(pr, 30), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), t = -y / 0.072, a = Math.atan2(z, x), s = 1 + 0.12 * Math.cos(a * 6) * t;
    p.setX(i, x * s); p.setZ(i, z * s); p.setY(i, y - Math.max(0, Math.cos(a * 6)) * 0.008 * t * t);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group(), m = new THREE.Mesh(geo, blanco ? M.copihueBlanco : M.copihueRojo); g.add(m);
  const caliz = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.014, 6), M.tallo); caliz.rotation.x = PI; caliz.position.y = 0.004; g.add(caliz);
  return g;
}
function ramaCopihue() {
  const M = mats(), g = new THREE.Group();
  const pts = [[0, 0, 0], [0.08, 0.03, 0.04], [0.17, 0.05, 0.02], [0.26, 0.04, -0.03], [0.34, 0.02, -0.02]].map(v => new THREE.Vector3(...v));
  const curva = new THREE.CatmullRomCurve3(pts); g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 20, 0.003, 5), M.tallo));
  [[0.3, false], [0.55, false], [0.8, true]].forEach(([t, bl]) => {
    const q = curva.getPoint(t), c = copihue(bl); c.position.copy(q); c.position.y += 0.035; c.rotation.set(1.35, rnd() * PI, 0); g.add(c);
  });
  for (let k = 0; k < 7; k++) {   // hojas ovaladas, brillantes
    const q = curva.getPoint(0.08 + k * 0.13), h = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.06), M.hojaCopihue);
    h.position.copy(q); h.rotation.set(-PI / 2 + (rnd() - 0.5) * 0.6, 0, (k % 2 ? 1 : -1) * (0.8 + rnd() * 0.5)); h.translateY(0.03); g.add(h);
  }
  return g;
}

// vela en vaso de vidrio; la llama titila (onBeforeRender) y alumbra apenas el casco
function vela() {
  const g = new THREE.Group();
  const cera = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.025, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.6, emissive: 0x3a2008, emissiveIntensity: 0.4 }));
  cera.position.y = 0.035; g.add(cera);
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.1, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xdfe8ec, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  vaso.position.y = 0.05; g.add(vaso);
  const pabilo = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.01, 4), new THREE.MeshBasicMaterial({ color: 0x1a1a1a })); pabilo.position.y = 0.075; g.add(pabilo);
  const llama = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.95, depthWrite: false }));
  llama.scale.set(1, 2.2, 1); llama.position.y = 0.092; g.add(llama);
  const luz = new THREE.PointLight(0xffa850, 0.25, 1.8, 2); luz.position.y = 0.12; g.add(luz);
  const fase = rnd() * 10;
  llama.onBeforeRender = () => { const t = performance.now() / 1000 + fase, f = 0.85 + 0.1 * Math.sin(t * 11) + 0.06 * Math.sin(t * 23.7); llama.scale.set(f, 2.2 * f, f); luz.intensity = 0.25 * f; };
  return g;
}

// x, y, z: punto del memorial en el suelo. escala: el conjunto a 1,35× del tamaño real para que se lea desde la cámara del juego
export function ofrendaMemorial(x, y, z, escala = 1.35) {
  azar = 1945;
  const raiz = new THREE.Group(); raiz.position.set(x, y, z); raiz.scale.setScalar(escala); raiz.userData.ofrenda = true;
  const c = casco(); c.rotation.set(0, 0.12, -0.04); raiz.add(c);   // apenas ladeado, como dejado en el suelo
  const r1 = ramo(7, 4); r1.rotation.set(-PI / 2 + 0.22, 0, 0.9); r1.position.set(-0.3, 0.035, 0.05); raiz.add(r1);   // ramos tendidos, flores hacia el casco
  const r2 = ramo(6, 2); r2.rotation.set(-PI / 2 + 0.22, 0, -1.05); r2.position.set(0.29, 0.035, 0.14); raiz.add(r2);
  const cop = ramaCopihue(); cop.position.set(-0.17, 0.005, 0.5); raiz.add(cop);   // rama de copihues delante, en el suelo (sobre el ala tapaba la lámpara)
  for (const [vx, vz] of [[-0.25, 0.33], [0.25, 0.36]]) { const v = vela(); v.position.set(vx, 0, vz); raiz.add(v); }
  raiz.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return raiz;
}
