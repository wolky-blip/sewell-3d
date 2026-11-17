// Qué música suena en cada momento del juego 3D (X-M1) y los controles de sonido (mudo y volumen de la música).
// Mismo criterio que el 2D: tema por nivel, «cine» en el cine, «cueva» en la mina y el hospital, «tension» en la pelea con el jefe,
// «victoria» al completar un nivel, «creditos» en el resumen y el cierre, «titulo» en el menú y la memoria de 1945 en silencio.
import { AUDIO, tocarMusica, pararMusica, alternarMudo, ponerVolumenMusica, MUSICA_NIVEL } from '../motor/audio.js';

export const musica = nombre => tocarMusica(nombre || null);
export { pararMusica };

const SALA = { cine: 'cine', fortuna: 'cueva', hospital: 'cueva', gimnasio: 'ciudad', palitroque: 'ciudad', club: 'ciudad', club45: 'ciudad' };   // N0-EMB9: Teniente Club
// cada cuadro de juego: elige el tema según dónde está Nato (idempotente: si ya suena, no lo reinicia)
export function musicaJuego(M) {
  if (!M || M.final) return;   // los finales eligen su propia música
  if (M.memoria) { if (AUDIO.nombreCancion) pararMusica(); return; }   // 19 de junio de 1945: sin música
  const sala = M.salaActual ? Object.keys(SALA).find(k => M.salaActual.startsWith(k)) : null;
  tocarMusica(M.pelea ? 'tension' : sala ? SALA[sala] : MUSICA_NIVEL[M.def.numero] || 'nivel');
}

// botones «Sonido» y «Música» en el título y en la pausa (se crean aquí para no tocar index.html) y la tecla M para silenciar
const VOLS = [0, 0.25, 0.55, 0.8, 1];
export function prepararSonido() {
  const textoSon = () => 'Sonido: ' + (AUDIO.mudo ? 'No' : 'Sí'), textoMus = () => 'Música: ' + Math.round(AUDIO.musicaVol * 100) + '%';
  const botones = [];
  for (const menu of document.querySelectorAll('#titulo .menu, #pausa .menu')) {
    const fila = document.createElement('div'); fila.className = 'fila-sonido'; fila.style.cssText = 'display:flex;gap:8px;justify-content:center';
    const bs = document.createElement('button'), bm = document.createElement('button');
    bs.onclick = () => { alternarMudo(); refrescar(); };
    bm.onclick = () => { const i = VOLS.findIndex(v => v >= AUDIO.musicaVol - 0.01); ponerVolumenMusica(VOLS[(i + 1) % VOLS.length]); refrescar(); };
    fila.append(bs, bm); menu.append(fila); botones.push([bs, bm]);
  }
  const refrescar = () => botones.forEach(([bs, bm]) => { bs.textContent = textoSon(); bm.textContent = textoMus(); });
  refrescar();
  addEventListener('keydown', ev => { if (ev.code === 'KeyM' && !ev.repeat && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) { alternarMudo(); refrescar(); } });
}
