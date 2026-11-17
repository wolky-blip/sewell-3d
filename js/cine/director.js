// Director de cinemáticas EN EL MOTOR (carril cine, X-K1): franjas de cine, subtítulos cortos, salto con Enter y un bucle
// propio que llama al guion cada cuadro con el tiempo de la escena. El render lo hace el bucle de principal.js (G.escena = 'cine').
import * as THREE from 'three';
import { altura } from '../mundo/terreno.js';

const URLP = new URLSearchParams(location.search);
let capa = null;
function prepararCapa() {
  if (capa) return capa;
  const d = document.createElement('div'); d.id = 'cine';
  d.innerHTML = '<div class="cine-franja arriba"></div><div class="cine-franja abajo"></div><div id="cine-tinte"></div><div id="cine-grano"></div><div id="cine-cartel"></div><div id="cine-sub"></div><div id="cine-saltar"></div>';
  const css = document.createElement('style');
  css.textContent = `#cine{position:fixed;inset:0;pointer-events:none;z-index:40;display:none}
#cine.ver{display:block}
.cine-franja{position:absolute;left:0;right:0;height:9vh;background:#000;transition:height .6s}
.cine-franja.arriba{top:0}.cine-franja.abajo{bottom:0}
#cine-tinte{position:absolute;inset:0;opacity:0;background:radial-gradient(circle at 50% 55%,#ffd9a0 0%,#d9823b 45%,#5a2a10 100%)}
#cine-sub{position:absolute;left:50%;bottom:11vh;transform:translateX(-50%);max-width:min(88vw,900px);text-align:center;color:#fff;
 font-size:clamp(17px,2.6vw,28px);line-height:1.3;text-shadow:0 2px 3px #000,0 0 8px #000;opacity:0;transition:opacity .25s}
#cine-sub b{color:#ffd58a}
#cine-sub .titulo{display:block;font-size:clamp(28px,5vw,58px);letter-spacing:.04em;color:#f3e2c0}
#cine-cartel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(90vw,820px);text-align:center;color:#fff;
 background:rgba(10,6,2,.62);border:2px solid #d9823b;border-radius:14px;padding:12px 22px;font-size:clamp(12px,1.55vw,19px);line-height:1.35;opacity:0;transition:opacity .5s;max-height:78vh;overflow:hidden}
#cine-cartel h1{margin:.1em 0;color:#ffd58a;font-size:clamp(22px,3.4vw,42px)}#cine-cartel h2{margin:.1em 0;color:#f3e2c0;font-size:clamp(15px,2.1vw,26px)}#cine-cartel p{margin:.35em 0}
#cine-grano{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(30,18,6,.85) 100%)}
#cine-saltar{position:absolute;right:16px;top:calc(9vh + 8px);color:#fff;opacity:.6;font-size:14px;pointer-events:auto;cursor:pointer;text-shadow:0 1px 2px #000}`;
  document.head.append(css); document.body.append(d);
  return (capa = d);
}
// subtítulo: texto (HTML corto) o null
export function subtitulo(html) {
  const s = document.getElementById('cine-sub'); if (!s) return;
  if (html) { if (s.dataset.t !== html) { s.innerHTML = html; s.dataset.t = html; } s.style.opacity = 1; } else { s.style.opacity = 0; s.dataset.t = ''; }
}
export function cartel(html) {
  const c = document.getElementById('cine-cartel'); if (!c) return;
  if (html) { if (c.dataset.t !== html) { c.innerHTML = html; c.dataset.t = html; } c.style.opacity = 1; } else { c.style.opacity = 0; c.dataset.t = ''; }
}
// película vieja (noticiario): el lienzo en sepia con parpadeo y viñeta; a = 0 la quita
export function sepia(a, t = 0) {
  const l = document.getElementById('lienzo'), g = document.getElementById('cine-grano');
  if (l) l.style.filter = a > 0 ? `sepia(${a}) contrast(${1 + 0.15 * a}) brightness(${1 - 0.12 * a + (a ? 0.06 * Math.sin(t * 37) * Math.sin(t * 13) : 0)})` : '';
  if (g) g.style.opacity = a > 0 ? Math.max(0.55, a) : 0;
}
export function tinte(a) { const t = document.getElementById('cine-tinte'); if (t) t.style.opacity = Math.max(0, Math.min(1, a)); }

// Corre una escena: guion(t, dt) se llama cada cuadro; termina a los «dura» segundos, con Enter/Esc/Espacio o un toque.
// Devuelve true si se saltó. Con ?rapido=1 no se muestra (las pruebas automáticas la saltan sola), salvo ?cine=1.
export function correrEscena(G, guion, dura, op = {}) {
  if (URLP.has('rapido') && !URLP.has('cine')) return Promise.resolve(true);
  const c = prepararCapa(); c.classList.add('ver'); subtitulo(null); tinte(0);
  const tacto = 'ontouchstart' in window;
  document.getElementById('cine-saltar').textContent = tacto ? 'Toca para saltar' : 'ENTER · clic · Ⓐ del mando para saltar';   // X-K10: también clic y mando
  const antes = G.escena; G.escena = 'cine'; mundoCine = G.M;   // X-K7: camaraTomas no deja la cámara dentro de sólidos
  // con cortes de cámara Spark debe rehacer el reparto de detalle enseguida (en el juego espera 6 m / 3° y 1,5 s: tras un corte
  // un personaje recién encuadrado, como el jefe en su contrapicado, no se dibujaba)
  const S = G.spark, lodAntes = S && [S.lodMinMs, S.lodMoveDist, S.lodMoveRot];
  if (S) { S.lodMinMs = 120; S.lodMoveDist = 0.5; S.lodMoveRot = 0.01; }
  const hud = document.getElementById('hud'), hudVisible = hud && !hud.classList.contains('oculto'); if (hud) hud.classList.add('oculto');
  const lienzo = document.getElementById('lienzo'); if (lienzo && !op.sinColor) lienzo.style.filter = 'contrast(1.08) saturate(1.12)';
  document.getElementById('cine-grano').style.opacity = op.vineta ?? 0.55;
  return new Promise(r => {
    let t = 0, ultimo = performance.now(), fin = false, saltada = false;
    const terminar = (s, por = s ? 'salto' : 'fin') => { if (fin) return; fin = true; saltada = s; G.cineFin = { por, t: +t.toFixed(2) }; };   // G.cineFin: pruebas (por qué terminó)
    const tecla = ev => { if (['Enter', 'Escape', ' '].includes(ev.key) && t > 0.4) { ev.preventDefault(); terminar(true, 'tecla ' + ev.key); } };
    const toque = () => { if (t > 0.4) terminar(true, 'toque'); };
    addEventListener('keydown', tecla); document.getElementById('cine-saltar').onclick = toque; addEventListener('pointerdown', toque);
    // X-K10: botón A, B o Start del mando (recién apretado: si venía apretado del juego no cuenta). Sin tocar entrada.js
    let padAntes = true;
    const mando = () => { let p = false; for (const gp of (navigator.getGamepads ? navigator.getGamepads() : [])) if (gp) for (const b of [0, 1, 9]) if (gp.buttons[b]?.pressed) p = true; const r = p && !padAntes; padAntes = p; return r; };
    G.cineT = 0;
    const cuadro = ahora => {
      const dt = Math.min(0.1, (ahora - ultimo) / 1000); ultimo = ahora;
      if (!fin) {
        t += dt; G.cineT = t;
        try { guion(t, dt); } catch (e) { console.error(e); terminar(false, 'error ' + (e && e.message)); }
        if (t >= dura) terminar(false);
        if (mando() && t > 0.4) terminar(true, 'mando');
      }
      if (fin) {
        removeEventListener('keydown', tecla); removeEventListener('pointerdown', toque);
        c.classList.remove('ver'); subtitulo(null); tinte(0); cartel(null); sepia(0);
        if (hud && hudVisible) hud.classList.remove('oculto');
        if (S && lodAntes) [S.lodMinMs, S.lodMoveDist, S.lodMoveRot] = lodAntes;
        if (G.escena === 'cine') G.escena = antes === 'cine' ? 'tarjeta' : antes;
        mundoCine = null; r(saltada); return;
      }
      requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  });
}

// ---------- ayudas de guion ----------
export const suave = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export const tramo = (t, t0, t1) => suave((t - t0) / (t1 - t0));
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
// cámara por tomas: [{ desde, hasta, pos0, pos1, mira0, mira1 }] (cortes secos entre tomas, movimiento suave dentro)
export function camaraTomas(cam, tomas, t, extra) {
  let k = tomas.find(s => t >= s.desde && t < s.hasta) || tomas[tomas.length - 1];
  const f = (k.lineal ? x => Math.max(0, Math.min(1, x)) : suave)((t - k.desde) / (k.hasta - k.desde));
  const p = k.pos ? k.pos(t, f) : new THREE.Vector3().lerpVectors(k.pos0, k.pos1 || k.pos0, f);
  const m = typeof k.mira === 'function' ? k.mira(t, f) : new THREE.Vector3().lerpVectors(k.mira0, k.mira1 || k.mira0, f);
  if (extra) extra(p, m, k);
  if (mundoCine && !k.libre) camaraSegura(mundoCine, p, m, k.origen ? { desde: typeof k.origen === 'function' ? k.origen(t) : k.origen } : {});   // X-K10: k.origen = origen del rayo (sujeto cercano cuando la mira está lejos)   // X-K7 (k.libre: toma que a propósito atraviesa algo)
  cam.position.copy(p); cam.lookAt(m);
  return m;
}
// subtítulos por tiempo: [[t0, t1, html], ...]
export function subtitulosEn(lista, t) { const s = lista.find(([a, b]) => t >= a && t < b); subtitulo(s ? s[2] : null); }

// X-K7 (pedido de Diego: «la cámara no puede traspasar objetos sólidos»). Ajusta pos EN EL LUGAR y la devuelve:
// 1) altura mínima sobre el terreno (+margen), solo afuera (si «mira» está bajo tierra, en salas y minas, no se aplica);
// 2) rayo de la mira a la cámara contra la física (edificios, muros, cerros): si algo se interpone, la cámara se acerca hasta
//    0,3 m antes del choque (como la cámara de juego). Un choque a < 5 cm del origen (mira dentro de un sólido) no cuenta.
let mundoCine = null;
export const ajustes = (window.CAMARA_SEGURA = { terreno: 0, solido: 0 });   // pruebas: cuántos cuadros corrigió
const _d = new THREE.Vector3(), _r = new THREE.Vector3();
export function camaraSegura(M, pos, mira, op = {}) {
  if (!M || !M.fis) return pos;
  const margen = op.margen ?? 0.6;
  // X-K10 (auditor): afuera (sin sala) el objetivo enterrado también se corrige: antes, con la mira bajo un cerro, no se subía la
  // cámara y el rayo partía desde dentro del cerro (UNESCO del final y rescate: hasta 18 m bajo tierra). Se sube la mira sobre el
  // terreno, luego la cámara, y si la línea de vista pasa bajo el terreno la cámara sube lo justo para verla por encima.
  const afuera = !M.salaActual || mira.y > altura(mira.x, mira.z) - 2;
  const o = op.desde || mira;   // origen de la línea de vista: la mira, o el sujeto cercano si la mira está lejos (cóndor que se va)
  if (afuera) {
    const ym = altura(mira.x, mira.z) + 0.4; if (mira.y < ym) { mira.y = ym; ajustes.terreno++; }
    const yt = altura(pos.x, pos.z) + margen; if (pos.y < yt) { pos.y = yt; ajustes.terreno++; }
    let alza = 0;
    for (let i = 1; i < 8; i++) { const f = i / 8, x = o.x + (pos.x - o.x) * f, z = o.z + (pos.z - o.z) * f, y = o.y + (pos.y - o.y) * f, h = altura(x, z) + 0.3; if (y < h) alza = Math.max(alza, (h - y) / f); }
    if (alza > 0) { pos.y += Math.min(alza, 60); ajustes.terreno++; }
  }
  _d.subVectors(pos, o); const L = _d.length();
  if (L > 0.5) {
    _d.divideScalar(L);
    const h = M.fis.rayo(o, _d, L + 0.3, M.jug?.p?.col, ['baranda', 'capacho']);
    if (h && h.toi > 0.05 && h.toi < L + 0.3) {
      // X-K14 (auditor N4, camarote_ocre): plano largo con el estorbo junto a la mira (edificio del kit bajo la mira del vuelo UNESCO):
      // acercar la cámara la metía DENTRO de ese edificio. Si la cámara está al aire libre (el rayo inverso no choca cerca de ella), se queda.
      let quieta = false;
      if (L > 20 && h.toi < L * 0.5) { _r.copy(_d).negate(); const hc = M.fis.rayo(pos, _r, L, M.jug?.p?.col, ['baranda', 'capacho']); quieta = !hc || hc.toi > L * 0.5; }
      if (quieta) ajustes.largo = (ajustes.largo || 0) + 1; else ajustes.solido++, pos.copy(o).addScaledVector(_d, Math.max(0.6, h.toi - 0.3));
    }
  }
  return pos;
}
