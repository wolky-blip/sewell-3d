// La plaza de Sewell para las cinemáticas (inicio y final del juego): el mundo del N4 (1967, la ciudad conservada) solo con lo
// fijo (edificios, escaleras, plazas, vía, la tarima con banderas), sin enemigos ni objetos. Nato queda en la tarima.
export async function cargarPlaza(ctx, titulo, sub, inicio = { x: -1.6, z: -309.6, rumbo: 0 }) {
  if (ctx.G.M) ctx.limpiarMundo();
  const N4 = ctx.NIVELES[4];
  const fijos = new Set(['edificio', 'escalera', 'plaza', 'via', 'anden', 'roca', 'escenario', 'cajas', 'repisa', 'rieles']);
  const def = { ...N4, nombre: titulo, elementos: N4.elementos.filter(e => fijos.has(e.t)), salas: [], ruta: [[0, -300]] };
  const M = await ctx.pantallaCarga(titulo, sub, () => ctx.crearMundo(def, { lento: true, inicio }), true);
  ctx.UI.mostrarHUD(false);
  const suelo = (x, z) => M.fis.suelo(x, z) ?? 126;
  return { M, suelo, Y0: suelo(0, -298), YS: suelo(0, -309.6) };
}

// X-K14 (auditor N4: «pantalla negra 8 s»): mientras se esperan los actores (gaussianas/esqueletos) se muestra la pantalla de carga sobria
// en vez del fundido negro opaco; G.escena = 'carga' como en pantallaCarga. prom: la promesa de esperarSplats.
export async function cargandoActores(G, prom) {
  const c = document.getElementById('carga'), antes = G.escena, txt = document.getElementById('carga-texto');
  if (c) { c.classList.remove('oculto'); if (txt) txt.textContent = 'Preparando la escena…'; }
  G.escena = 'carga';
  try { return await prom; } finally { if (c) c.classList.add('oculto'); if (G.escena === 'carga') G.escena = antes; }
}
