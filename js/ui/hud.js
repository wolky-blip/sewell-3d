// Marcador, burbujas, apuntes, tarjetas y fundidos (HTML encima del lienzo).
import { P, DURA_CHAQUETA } from '../juego/logica.js';

const $ = id => document.getElementById(id);
export const UI = {
  mostrarHUD(v) { $('hud').classList.toggle('oculto', !v); },
  actualizar(jug, extra = {}) {
    if (!P) return;
    {   // G-A5: corazones por mitades (cada golpe quita 0,5): ♥ lleno, medio ♥ (mitad roja) y ♡ vacío
      const c = Math.max(0, P.corazones), ll = Math.floor(c), medio = c - ll >= 0.5 ? 1 : 0, cl = ll + '/' + medio + '/' + P.corMax;
      const hc = $('hud-corazones');
      if (hc.dataset.c !== cl) { hc.dataset.c = cl; hc.innerHTML = '♥'.repeat(ll) + (medio ? '<span class="medio-cor">♥</span>' : '') + '♡'.repeat(Math.max(0, P.corMax - ll - medio)); }
    }
    $('hud-vidas').textContent = '× ' + P.vidas;
    $('hud-barra-energia').style.width = P.energia + '%';
    $('hud-pepitas').textContent = P.pepitas; $('hud-puntos').textContent = P.puntos;
    $('hud-apuntes').textContent = '📖 ' + P.apuntes.size + '/5';
    { const hr = $('hud-reliquias'); if (hr) hr.textContent = P.reliquiasTot ? '🏺 ' + (P.reliquias ? P.reliquias.size : 0) + '/' + P.reliquiasTot : ''; }   // N0-VIDA: reliquias del nivel
    const ch = $('hud-chaqueta');
    ch.classList.toggle('oculto', !(jug && jug.chaqueta > 0));
    if (jug && jug.chaqueta > 0) { $('hud-chaqueta-s').textContent = Math.ceil(jug.chaqueta) + ' s'; ch.style.opacity = jug.chaqueta < 3 && (performance.now() / 150 | 0) % 2 ? 0.3 : 1; }
    $('hud-trucos').classList.toggle('oculto', !P.invencible);
    const r = $('hud-reloj'); r.classList.toggle('oculto', extra.reloj == null);
    if (extra.reloj != null) r.textContent = '🕖 ' + Math.floor(extra.reloj / 60) + ':' + String(Math.floor(extra.reloj % 60)).padStart(2, '0');
    $('hud-fps').textContent = extra.fps || '';
  },
  zona(texto) {
    const z = $('hud-zona'); z.textContent = texto; z.classList.add('ver');
    clearTimeout(this._tz); this._tz = setTimeout(() => z.classList.remove('ver'), 3200);
  },
  aviso(texto, ms = 1800) { const a = $('hud-aviso'); a.textContent = texto; clearTimeout(this._ta); this._ta = setTimeout(() => (a.textContent = ''), ms); },
  burbuja(html) { const b = $('burbuja'); if (!html) { b.classList.add('oculto'); return; } b.innerHTML = html; b.classList.remove('oculto'); },
  // ficha del apunte (se lee y se sigue con acción/ENTER)
  modal(titulo, texto) { $('modal-titulo').textContent = titulo; $('modal-texto').textContent = texto; $('modal').classList.remove('oculto'); this.abierto = true; },
  cerrarModal() { $('modal').classList.add('oculto'); this.abierto = false; },
  tarjeta(html, sobria) { const t = $('tarjeta'); $('tarjeta-caja').innerHTML = html; t.classList.toggle('sobrio', !!sobria); t.classList.remove('oculto'); },
  quitarTarjeta() { $('tarjeta').classList.add('oculto'); },
  fundir(v) { $('fundido').style.opacity = v ? 1 : 0; },
  error(t) { const e = $('error'); e.textContent = t; e.classList.remove('oculto'); },
};
// tiempo mínimo de lectura del 2D: 60 cuadros + 3 por letra → segundos
export const lectura = txt => (60 + 3 * txt.length) / 60;
