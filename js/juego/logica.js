// Lógica portada de videojuego/js/juego.js (2D): dificultad, partida, vidas y corazones, energía de Hércules,
// chaqueta regalona, pepitas, apuntes y puntaje. Los tiempos del 2D estaban en cuadros a 60 fps; aquí van en segundos.

// misma tabla del 2D (los campos de cuadros se convierten donde se usan: /60)
export const DIFICULTAD = {
  facil: { nombre: 'Fácil', vidas: 5, corazones: 5, hpMinero: 3, persigue: 0.8, carga: 34, aviso: 58, picada: 2.2, lucha: 18, energia: 1.5, dinamita: 190, bola: 1.7, bolero: 210, tablon: 46, reloj: 14, alud: 1.0, jefe: 14, condorJefe: 8, tren: 1.1 },
  normal: { nombre: 'Normal', vidas: 3, corazones: 3, hpMinero: 5, persigue: 0.95, carga: 24, aviso: 42, picada: 2.7, lucha: 13, energia: 1, dinamita: 135, bola: 2.1, bolero: 160, tablon: 30, reloj: 11, alud: 1.18, jefe: 20, condorJefe: 10, tren: 1.25 },
  dificil: { nombre: 'Difícil', vidas: 2, corazones: 3, hpMinero: 6, persigue: 1.15, carga: 17, aviso: 32, picada: 3.2, lucha: 10, energia: 0.8, dinamita: 95, bola: 2.5, bolero: 120, tablon: 22, reloj: 9, alud: 1.32, jefe: 26, condorJefe: 13, tren: 1.4 },
};
export const ORDEN_DIF = ['facil', 'normal', 'dificil'];
export const DURA_CHAQUETA = 20;        // segundos (20 * 60 cuadros en el 2D)
export const PEPITAS_POR_VIDA = 100;

export const J = { dificultad: 'normal', invencible: false };
export const DIF = () => DIFICULTAD[J.dificultad];

export let P = null;   // la partida
export function nuevaPartida(nivel) {
  const d = DIF();
  P = { nivel: nivel || 1, invencible: !!J.invencible, energia: 100, vidas: d.vidas, corazones: d.corazones, corMax: d.corazones,
    pepitas: 0, puntos: 0, apuntes: new Set(), noqueados: 0, condores: 0, inicio: performance.now(), tiempo: 0, golpes: [] };
  return P;
}
// al pasar al nivel siguiente se conservan vidas, pepitas y puntaje; lo demás es de cada nivel
export function pasarDeNivel(n) { P.nivel = n; P.apuntes = new Set(); P.noqueados = 0; P.condores = 0; P.tiempo = 0; P.energia = 100; P.corazones = P.corMax; }

// eventos hacia el juego (sonido, rótulos, fundidos): se conectan desde principal.js
export const avisar = { rotulo: () => {}, efecto: () => {}, perderVida: () => {}, energiaLlena: () => {} };

// daño: devuelve true si de verdad le hizo daño
export function danar(jug, motivo) {
  if (jug.invul > 0 || jug.estado === 'atrapado' || jug.chaqueta > 0 || jug.estado === 'fuera') return false;
  P.golpes.push({ motivo, t: P.tiempo });
  if (P.invencible) { jug.invul = 0.5; return false; }   // truco: sin daño
  P.corazones = Math.max(0, P.corazones - 0.5);   // G-A5: cada golpe recibido quita MEDIO corazón (peleas más largas); el HUD dibuja las mitades
  avisar.efecto('herido');
  if (P.corazones <= 0) { perderVida(jug, motivo || 'golpe'); return true; }
  jug.invul = 1.5;
  return true;
}
// caídas al vacío: cuestan 1 corazón (en el Nivel 4, una vida) y se vuelve a la última orilla segura
export function caida(jug) {
  if (jug.estado === 'fuera') return 'nada';
  P.golpes.push({ motivo: 'caida', t: P.tiempo });
  if (P.invencible) return 'volver';
  if (P.nivel === 4) { perderVida(jug, 'caida'); return 'vida'; }
  P.corazones--;
  if (P.corazones <= 0) { perderVida(jug, 'caida'); return 'vida'; }
  return 'volver';
}
export function perderVida(jug, motivo) {
  if (jug.estado === 'fuera') return;   // una sola vida por accidente, aunque lleguen varios golpes juntos
  jug.estado = 'fuera';
  jug.chaqueta = 0;            // al perder una vida se pierde la chaqueta
  if (!P.invencible) P.vidas--;
  avisar.perderVida(motivo);
}
export function sumarEnergia(n) {
  const antes = P.energia;
  P.energia = Math.min(100, P.energia + n * DIF().energia);
  if (antes < 100 && P.energia >= 100) avisar.energiaLlena();
}
export function sumarPepita() {
  P.pepitas++; P.puntos += 10;
  if (P.pepitas % PEPITAS_POR_VIDA === 0) { P.vidas++; avisar.rotulo('¡+1 VIDA!'); avisar.efecto('vida'); }
}
export function curar() { if (P.corazones < P.corMax) { P.corazones = Math.min(P.corMax, P.corazones + 1); return true; } P.puntos += 50; return false; }
export function noqueo(tipo, puntos) { if (tipo === 'condor') P.condores++; else P.noqueados++; P.puntos += puntos; }
export function apunte(i) { if (P.apuntes.has(i)) return false; P.apuntes.add(i); P.puntos += 500; return true; }
