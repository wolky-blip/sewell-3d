// N0-C3: nadie atraviesa a nadie. Separación suave entre Nato, Hércules y todos los personajes (mineros, jefe, NPC de las calles, Diego,
// Pedro, enfermera, médico...): discos horizontales que se empujan hasta tocarse, a ritmo limitado (no hay saltos ni temblor).
// Se llama una vez por paso de juego (principal.js paso), después de que cada entidad movió. Los más pesados casi no se mueven.
const NO = new Set(['ko', 'sevan', 'derrotado', 'dormido']);
const GENTE = new Set(['minero', 'dinamitero', 'bolero', 'jugadorBolos', 'jefe', 'npc', 'diego', 'pedro']);
const PESO = { jefe: 3, diego: 4, pedro: 4, npc: 3 };   // los quietos ceden menos que Nato y los mineros
export const SEP = { rNato: 0.32, rHerc: 0.42, rGente: 0.4, rJefe: 0.55, vmax: 4.5, alcance: 24, ult: null };

export function separar(M, dt) {
  if (typeof window !== 'undefined' && window.__SIN) return;   // solo para medir «antes» en guiones
  const j = M.jug; if (!j || M.final || ['fuera', 'atrapado', 'quieto'].includes(j.estado)) return;
  const A = [];   // {o: objeto con position, r, w, nato, h, e}
  A.push({ nato: true, pos: j.pos, y: j.pie, r: SEP.rNato, w: 1 });
  const h = M.hercules;
  if (h && h.malla && ['sigue', 'espera', 'corre', 'herido'].includes(h.estado)) A.push({ h, pos: h.malla.position, y: h.malla.position.y, r: SEP.rHerc, w: 0.9 });
  for (const e of M.L.lista) {
    if (!e.vivo || !e.malla || !GENTE.has(e.tipo) || NO.has(e.estado) || e.acostado || e.estado === 'final' || e.estado === 'tunel') continue;
    if (e.sala && e.sala !== M.salaActual) continue;
    const p = e.malla.position; if (Math.abs(p.x - j.pos.x) > SEP.alcance || Math.abs(p.z - j.pos.z) > SEP.alcance) continue;
    A.push({ e, pos: p, y: p.y, r: e.tipo === 'jefe' ? SEP.rJefe : e.tipo === 'minero' || e.tipo === 'dinamitero' || e.tipo === 'bolero' ? SEP.rGente : 0.38, w: PESO[e.tipo] || 1 });
  }
  const k = Math.min(1, 14 * dt), tope = SEP.vmax * dt;
  const mov = new Map();   // cada uno suma su desplazamiento
  for (let a = 0; a < A.length; a++) for (let b = a + 1; b < A.length; b++) {
    const p = A[a], q = A[b];
    if (Math.abs(p.y - q.y) > 1.4) continue;
    let dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz); const min = p.r + q.r;
    if (d >= min) continue;
    let solap = min - d;
    if (d < 0.02) { const t = a * 2.4 + b; dx = Math.cos(t); dz = Math.sin(t); d = 1; solap = min; }   // justo encima: dirección fija cualquiera
    const ux = dx / d, uz = dz / d;
    const tp = p.w / (p.w + q.w), tq = 1 - tp;   // el más pesado se mueve menos
    const mp = mov.get(p) || [0, 0], mq = mov.get(q) || [0, 0];
    mp[0] -= ux * solap * tq * k; mp[1] -= uz * solap * tq * k; mq[0] += ux * solap * tp * k; mq[1] += uz * solap * tp * k;
    mov.set(p, mp); mov.set(q, mq);
    // Nato corriendo contra alguien: se le quita la velocidad que lo mete en el otro (si no, a 7 m/s atraviesa al empuje suave)
    if (p.nato && d < min + 0.08) { const vn = j.vel.x * ux + j.vel.z * uz; if (vn > 0) { j.vel.x -= vn * ux; j.vel.z -= vn * uz; } }
  }
  for (const [c, [mx, mz]] of mov) {
    const l = Math.hypot(mx, mz); if (l < 1e-5) continue; const f = l > tope ? tope / l : 1; const dx = mx * f, dz = mz * f;
    if (c.nato) { j.p.mover(dx, 0, dz); continue; }
    const g = c.pos, nx = g.x + dx, nz = g.z + dz, r = M.fis.rayo({ x: nx, y: g.y + 0.6, z: nz }, { x: 0, y: -1, z: 0 }, 1.8, M.jug.p.col);
    if (!r || Math.abs(r.punto.y - g.y) > 0.5) continue;   // borde o escalón: no lo saca del suelo
    g.x = nx; g.z = nz; g.y = r.punto.y;
    if (c.h) { c.h.posAct?.copy(g); c.h.posAnt?.copy(g); }
  }
}
