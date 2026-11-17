// Alturas de pie de todos los personajes (metros, de la planta del pie a la coronilla), pedido de Diego (G-C1, 13-11-2026).
// Se usan donde se crean los personajes (jugador.js, entidades.js): cambiar aquí cambia el juego entero.
// Medidas con herramientas/medir_personajes.js en pose idle (malla: caja con huesos; gaussianas: percentil 99,5 % de los centros).
export const ALTURAS = {
  nato: 1.78, diego: 1.83,
  pedro: 1.70,   // el papá de Nato (pelo blanco, adulto mayor)
  hombre: 1.70, mujer: 1.57, anciana: 1.50,   // gente del pueblo de 1905
  medico: 1.72, enfermera: 1.60, vecina: 1.57,
  minero: 1.86, dinamitero: 1.86, bolero: 1.88,   // secuaces: algo más grandes que Nato (G-A13: el minero malla, ancho y con casco, a 1,82 se veía bajo al lado de Nato)
  jefe: 2.35,   // jefes humanos: bastante más grandes
  hercules: 0.97,   // mastín inglés: cabeza a ~0,97 m (cruz ~0,80)
  condorEnvergadura: 3.0,
};
// los modelos de gaussianas de personas (p_*) se escalan con mallaPersona(colores, escala): escala 1 = 1,75 m
export const BASE_PERSONA = 1.75;
export const escalaPersona = id => (ALTURAS[id] ?? ALTURAS.hombre) / BASE_PERSONA;
// la malla de Nato (TRELLIS + esqueleto) en idle mide 1,05 × el alto de la caja de su nube (1,89 m con caja de 1,80 m).
// G-A7: con la postura plantada (rodillas flexionadas, pies abiertos, mocap.PLANTADO) medía 1,724 m en la espera; se corrige
// × 1,724/1,78 para que en reposo mida 1,78 (herramientas/medir_personajes.js)
export const CORR_MALLA_NATO = 1.89 / 1.80 * 1.724 / 1.78;
