// Actores y efectos de las cinemáticas (carril cine): personas de Idol con su esqueleto, el cóndor gigante, el libro,
// polvareda, estrellitas y chispas cobrizas. Todo usa los modelos que ya carga el juego (crearMundo registra los p_*).
import * as THREE from 'three';
import { mallaPersona } from '../juego/jugador.js';
import { mallaCondor } from '../juego/entidades.js';
import { animarSplat } from '../motor/animSplat.js';
import { PERSONAJES_MALLA } from '../mundo/mallas.js';
import { escalaPersona, ALTURAS } from '../datos/alturas.js';

// ===== PUNTO ÚNICO DEL CÓNDOR GIGANTE =====
// Desde G-CONDOR (14-11): la malla nueva del cóndor (mallas.js condorMalla) a escala gigante; sin ella, el de Idol. Contrato: debe devolver un grupo con el pico hacia +Z local, alas a lo ancho (X) y, si puede aletear,
// userData.aletear(t) (si no, se mece el modelo entero).
export const ENVERGADURA_CONDOR_GIGANTE = 9;   // metros
export function condorGigante(M) {
  const esc = ENVERGADURA_CONDOR_GIGANTE / 3;
  const g = mallaCondor(esc, null, true);   // G-PERS: sin nube de respaldo (solo malla)
  if (g.userData.condor) g.userData.malla = true;   // malla: se queda en la escena con luz (no va a «aparte», salía negro)
  const mod = g.userData.modelo, y0 = g.userData.y0 ?? 0, aI = g.userData.alaI, aD = g.userData.alaD;
  // G-CONDOR: con la malla nueva (userData.condor) bate las alas con su esqueleto; la cinemática puede pedir otra acción con
  // g.userData.condor.tocar('planeo' | 'aleteo' | 'picada' | 'chillido') y aletear(t) la sigue avanzando
  let tAnt = null; if (g.userData.condor) g.userData.condor.tocar('aleteo');
  g.userData.aletear = t => {
    const cm = g.userData.condor;
    if (cm) { const dt = tAnt == null ? 0 : Math.max(0, Math.min(0.1, t - tAnt)); tAnt = t; cm.actualizar(dt); return; }
    if (mod) { const pl = Math.sin(t * 2.2); mod.position.y = y0 + pl * 0.35; mod.rotation.z = pl * 0.1; }
    else { aI.rotation.z = Math.sin(t * 6) * 0.5; aD.rotation.z = -aI.rotation.z; }
  };
  return g;
}

const COLORES = {
  pedro: { cuerpo: 0x8fb8d8, piernas: 0x3a4a6a, pelo: 0xf0f0f0 }, jefe: { cuerpo: 0x5a3a26, piernas: 0x2a2a2a, casco: 0xf0c419 },
  minero: { cuerpo: 0x7a5236, piernas: 0x3b3a36, casco: 0xf0c419 }, vecina: { cuerpo: 0xb0605a, piernas: 0x3a3030, pelo: 0x3a2a20 },
  anciana: { cuerpo: 0x6a5a7a, piernas: 0x2a2a30, pelo: 0xd0d0d0 }, diego: { cuerpo: 0xe9dfc4, piernas: 0xb59a6a, pelo: 0x2a2220 },
  medico: { cuerpo: 0xf2f2f2, piernas: 0x30303a, pelo: 0x2a2220 }, enfermera: { cuerpo: 0xf2f2f2, piernas: 0xf2f2f2, pelo: 0x3a2a20 },
};
const GAUSS = new URLSearchParams(location.search).has('gaussianas');   // solo para comparar
const ANIMADOS = { pedro: 'pedro', minero: 'minero', vecina: 'vecina', anciana: 'anciana', diego: 'diego', jefe: 'jefe' };   // jefe: esqueleto de G-A9
function splatDe(g) { let r = null; g.traverse(o => { if (o.userData && o.userData.splat && o.userData.splat !== true) r = o.userData.splat; }); return r; }

// una persona de Idol: { g, poner(nombreAnim, vel), act(dt) }. id: pedro, jefe, minero, vecina, anciana, diego, medico, enfermera
export function persona(escena, id) {
  // G-PERS (14-11, Diego: «están mezcladas las mallas y las gaussianas»): en las cinemáticas TODOS los actores son MALLA
  // (jugador.js personajeSplat con forzarMalla: jefe y minero también); sin malla no se carga ninguna nube (salvo ?gaussianas)
  const g = mallaPersona(COLORES[id] || COLORES.vecina, escalaPersona(id), 'p_' + id, { malla: !GAUSS });
  escena.add(g);
  const a = { g, anim: null, n: '', bob: 0 };
  const sp = splatDe(g);
  if (sp && sp.userData.mallaPromesa) {
    sp.userData.manejada = true; g.userData.malla = true;
    a.listo = sp.userData.mallaPromesa.then(r => { a.anim = r.anim; }).catch(err => console.warn('cine malla', id, err));
  } else if (sp && GAUSS && ANIMADOS[id]) a.listo = animarSplat(sp, ANIMADOS[id]).then(x => { a.anim = x; }).catch(() => {});
  else { if (sp) { sp.userData.reservaMalla = true; sp.visible = false; } if (sp) console.warn('cine: sin malla para', id); a.listo = Promise.resolve(); }
  a.poner = (n, op = {}) => {
    if (!a.anim) return;
    // acción que este esqueleto no tiene (p. ej. «caminar» del jefe): se usa idle; sin ninguna acción el splat queda sin pose y no se ve
    if (a.anim.nombres && !a.anim.nombres.includes(n)) n = ['idle', 'jefe_pose'].find(k => a.anim.nombres.includes(k)) || a.anim.nombres[0];
    if (n !== a.n) { a.anim.tocar(n, { fundido: 0.15, reiniciar: true, ...op }); a.n = n; } else if (op.vel) a.anim.tocar(n, op);
  };
  a.act = dt => { if (a.anim) a.anim.actualizar(dt); };
  return a;
}
export const alturaDe = id => ALTURAS[id] ?? ALTURAS.hombre;

// el libro de Pedro: tapa cobriza con letras doradas (caja chica); brilla con emisivo
export function libro() {
  const g = new THREE.Group();
  const tapa = new THREE.MeshStandardMaterial({ color: 0x8a3f1c, roughness: 0.6, metalness: 0.2, emissive: 0xd9823b, emissiveIntensity: 0 });
  const hojas = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.9 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.05), [hojas, tapa, hojas, hojas, tapa, tapa]); g.add(b);
  const franja = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.052), new THREE.MeshStandardMaterial({ color: 0xf0c419, metalness: 0.6, roughness: 0.3 }));
  franja.position.y = 0.06; g.add(franja);
  g.userData.tapa = tapa;
  return g;
}

// textura redonda difuminada o estrella (canvas)
function textura(tipo) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  if (tipo === 'estrella') {
    x.fillStyle = '#ffe066'; x.strokeStyle = '#7a5a00'; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    x.closePath(); x.fill(); x.stroke();
  } else {
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}
// polvareda de caricatura: nubes que se inflan y giran alrededor de un punto. act(t, centro, fuerza 0..1)
export function polvareda(escena, n = 16) {
  const tex = textura('nube'), nubes = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: i % 3 ? 0xcdb48e : 0xe8dcc4, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { a: i * 2.4, r: 0.6 + (i % 4) * 0.35, h: 0.3 + (i % 5) * 0.35, v: 1.5 + (i % 3) }; escena.add(s); nubes.push(s);
  }
  return {
    act(t, c, f) {
      for (const s of nubes) {
        const u = s.userData, a = u.a + t * u.v;
        s.position.set(c.x + Math.cos(a) * u.r * (0.8 + f * 0.6), c.y + u.h + Math.sin(t * 7 + u.a) * 0.15, c.z + Math.sin(a) * u.r * (0.8 + f * 0.6));
        const k = (1.1 + 0.5 * Math.sin(t * 5 + u.a)) * (0.6 + f); s.scale.set(k, k, 1); s.material.opacity = 0.85 * f; s.visible = f > 0.01;
      }
    },
    quitar() { nubes.forEach(s => s.removeFromParent()); },
  };
}
// estrellitas que giran sobre la cabeza del aturdido
export function estrellitas(escena, n = 5) {
  const tex = textura('estrella'), es = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.setScalar(0.32); escena.add(s); es.push(s); }
  return {
    act(t, c, f) { es.forEach((s, i) => { const a = t * 3.2 + i * Math.PI * 2 / n; s.position.set(c.x + Math.cos(a) * 0.55, c.y + Math.sin(t * 4 + i) * 0.06, c.z + Math.sin(a) * 0.55); s.visible = f > 0.01; s.material.opacity = f; }); },
    quitar() { es.forEach(s => s.removeFromParent()); },
  };
}
// luz cobriza con chispas que suben en espiral (el libro mágico)
export function luzCobriza(escena, n = 90) {
  const luz = new THREE.PointLight(0xe08a3c, 0, 10, 1.6); escena.add(luz);
  const pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffb060, map: textura('nube'), size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; escena.add(p);
  const semillas = Array.from({ length: n }, (_, i) => [Math.random() * 6.28, 0.3 + Math.random() * 1.1, Math.random() * 2.5, 0.6 + Math.random()]);
  return {
    act(t, c, f) {
      luz.position.set(c.x, c.y + 0.6, c.z); luz.intensity = 7 * f;   // con 40 Nato quedaba quemado (pálido, «otro modelo»)
      for (let i = 0; i < n; i++) {
        const [a0, r, ph, v] = semillas[i], h = ((t * v * 0.8 + ph) % 2.5), a = a0 + t * 2 + h;
        pos[i * 3] = c.x + Math.cos(a) * r * (1 - h / 3.5); pos[i * 3 + 1] = c.y - 0.8 + h; pos[i * 3 + 2] = c.z + Math.sin(a) * r * (1 - h / 3.5);
      }
      geo.attributes.position.needsUpdate = true; mat.opacity = f; p.visible = f > 0.01;
    },
    quitar() { luz.removeFromParent(); p.removeFromParent(); },
  };
}

// sombra del cóndor gigante sobre el suelo: elipse oscura que se achica y aclara con la altura. act(pos, rumbo, suelo)
export function sombraCondor(escena, envergadura = 9) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; escena.add(m);
  return {
    act(p, rumbo, ySuelo) {
      const h = Math.max(0, p.y - ySuelo), k = Math.max(0, 1 - h / 45);
      m.visible = k > 0.02; m.position.set(p.x, ySuelo + 0.06, p.z); m.rotation.z = rumbo;
      m.scale.set(envergadura * (0.8 + 0.4 * k), envergadura * 0.45 * (0.8 + 0.4 * k), 1); m.material.opacity = 0.45 * k;
    },
    quitar() { m.removeFromParent(); },
  };
}
// banderas de la tarima (PlaneGeometry 1,8 x 1,2 de construir.js): flamean; con viento fuerte (el cóndor) se agitan
export function banderas(escena, centro, radio = 12) {
  const bs = [];
  escena.traverse(o => { const p = o.geometry?.parameters; if (o.isMesh && p && o.geometry.type === 'PlaneGeometry' && Math.abs(p.width - 1.8) < 0.01 && Math.abs(p.height - 1.2) < 0.01 && o.position.distanceTo(centro) < radio) bs.push([o, o.rotation.y, o.position.x]); });
  return { act(t, viento) { bs.forEach(([o, ry, x0], i) => { const a = 0.12 + 0.6 * viento; o.rotation.y = ry + Math.sin(t * (3 + 6 * viento) + i) * a; o.position.x = x0 - Math.sin(o.rotation.y - ry) * 0.9 * 0; o.scale.y = 1 - 0.08 * viento * Math.abs(Math.sin(t * 9 + i)); }); }, n: bs.length };
}

// espera a que las gaussianas de los actores recién creados estén cargadas (el jefe es pesado: sin esto no se veía en su primer plano)
export async function esperarSplats(raices, maxMs = 20000, actores = []) {
  const lista = [];
  const esqueletos = Promise.all(actores.map(a => a.listo));
  for (const r of raices) r.traverse(o => { if (o.userData && o.userData.reservaMalla) return; if (o.isSplatMesh || (o.constructor && o.constructor.name === 'SplatMesh') || o.initialized instanceof Promise) lista.push(o); });
  await Promise.race([Promise.all([esqueletos, ...lista.map(o => Promise.resolve(o.initialized).catch(() => null))]), new Promise(r => setTimeout(r, maxMs))]);
  return lista.length;
}
