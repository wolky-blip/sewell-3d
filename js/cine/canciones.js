// Canciones originales del juego 2D (referencia_2d/js/audio.js), portadas tal cual al 3D (X-M1).
// Formato de tracker: '-' alarga la nota anterior, '.' es silencio, '|' solo separa compases.
export const CANCIONES = {
  // Pantalla de título: épica, en la menor, con sabor andino (sol sostenido)
  titulo: {
    paso: 0.14, canales: [
      { inst: 'quena', vol: 0.2, notas:
        'A4 - - - E5 - - - | D5 - C5 - B4 - G4 - | A4 - - - C5 - E5 - | A5 - - - - - - - |' +
        'G5 - - - F5 - E5 - | D5 - - - C5 - D5 - | E5 - - - - - B4 - | E5 - - - - - - . |' +
        'C5 - - - E5 - - - | G5 - F5 - E5 - D5 - | C5 - - - D5 - E5 - | F5 - - - - - - - |' +
        'E5 - - - D5 - C5 - | B4 - - - C5 - D5 - | E5 - - - G#4 - - - | A4 - - - - - - . |' },
      { inst: 'triangulo', vol: 0.32, notas:
        'A2 - A3 - A2 - A3 - | G2 - G3 - G2 - G3 - | A2 - A3 - A2 - A3 - | A2 - A3 - E3 - A3 - |' +
        'C3 - C4 - C3 - C4 - | D3 - D4 - D3 - D4 - | E2 - E3 - E2 - E3 - | E2 - E3 - B2 - E3 - |' +
        'C3 - C4 - C3 - C4 - | G2 - G3 - G2 - G3 - | C3 - C4 - C3 - C4 - | F2 - F3 - F2 - F3 - |' +
        'A2 - A3 - A2 - A3 - | G2 - G3 - G2 - G3 - | E2 - E3 - E2 - E3 - | A2 - A3 - E3 - A2 - |' },
      { inst: 'ruido', vol: 0.10, notas: 'K . h . S . h . | K . h K S . h h |'.repeat(8) },
    ] },
  // Nivel al aire libre: 6/8 saltarín, como de cueca chiptune
  nivel: {
    paso: 0.125, canales: [
      { inst: 'quena', vol: 0.19, notas:
        'A4 - C5 E5 - D5 | C5 - A4 G4 - E4 | A4 - C5 E5 - G5 | A5 - - G5 - E5 |' +
        'D5 - E5 G5 - E5 | D5 - C5 A4 - G4 | A4 - C5 D5 - C5 | A4 - - - - . |' +
        'C5 - E5 G5 - E5 | F5 - E5 D5 - C5 | D5 - E5 F5 - D5 | E5 - - - - . |' +
        'C5 - E5 G5 - A5 | G5 - E5 D5 - C5 | D5 - C5 B4 - G4 | A4 - - - - . |' },
      { inst: 'charango', vol: 0.09, notas:
        'E4 . . C4 . . | E4 . . C4 . . | E4 . . C4 . . | E4 . . C4 . . |' +
        'D4 . . B3 . . | F4 . . D4 . . | F4 . . C4 . . | E4 . . C4 . . |' +
        'G4 . . E4 . . | A4 . . F4 . . | A4 . . F4 . . | G#4 . . E4 . . |' +
        'G4 . . E4 . . | G4 . . D4 . . | G4 . . D4 . . | E4 . . C4 . . |' },
      { inst: 'triangulo', vol: 0.34, notas:
        'A2 - - E3 - - | A2 - - E3 - - | A2 - - E3 - - | A2 - - E3 - - |' +
        'G2 - - D3 - - | D3 - - A2 - - | F2 - - C3 - - | A2 - - E3 - - |' +
        'C3 - - G2 - - | F2 - - C3 - - | D3 - - A2 - - | E2 - - B2 - - |' +
        'C3 - - G2 - - | G2 - - D3 - - | G2 - - B2 - - | A2 - - E3 - - |' },
      { inst: 'ruido', vol: 0.10, notas: 'K . h S . h | K . h S h h |'.repeat(8) },
    ] },
  // Nivel 2, la ciudad de las escaleras: alegre, en sol mayor, con aire de los años 20
  ciudad: {
    paso: 0.12, canales: [
      { inst: 'quena', vol: 0.18, notas:
        'G4 - B4 - D5 - B4 - | C5 - E5 - D5 - B4 - | A4 - C5 - B4 - G4 - | A4 - - - D4 - - - |' +
        'G4 - B4 - D5 - G5 - | F#5 - E5 - D5 - C5 - | B4 - A4 - G4 - A4 - | G4 - - - - - . . |' +
        'E5 - - - D5 - C5 - | B4 - C5 - D5 - - - | C5 - - - B4 - A4 - | G4 - A4 - B4 - - - |' +
        'E5 - D5 - C5 - B4 - | A4 - B4 - C5 - E5 - | D5 - - - F#4 - A4 - | G4 - - - - - . . |' },
      { inst: 'charango', vol: 0.085, notas:
        'B3 . D4 . B3 . D4 . | C4 . E4 . C4 . E4 . | C4 . E4 . B3 . D4 . | C4 . D4 . F#4 . D4 . |' +
        'B3 . D4 . B3 . D4 . | C4 . E4 . A3 . C4 . | B3 . D4 . C4 . F#4 . | B3 . D4 . G4 . . . |' +
        'G4 . C4 . G4 . C4 . | G4 . B3 . G4 . B3 . | E4 . A3 . E4 . A3 . | D4 . G3 . D4 . G3 . |' +
        'G4 . C4 . G4 . C4 . | E4 . A3 . E4 . A3 . | F#4 . D4 . F#4 . C4 . | B3 . D4 . G4 . . . |' },
      { inst: 'triangulo', vol: 0.34, notas:
        'G2 - - - D3 - - - | C3 - - - G2 - - - | A2 - - - G2 - - - | D3 - - - D2 - - - |' +
        'G2 - - - B2 - - - | D3 - - - A2 - - - | G2 - - - D3 - - - | G2 - - - G2 - - - |' +
        'C3 - - - G2 - - - | G2 - - - D3 - - - | A2 - - - E3 - - - | G2 - - - D3 - - - |' +
        'C3 - - - G2 - - - | A2 - - - E3 - - - | D3 - - - D2 - - - | G2 - - - G2 - - - |' },
      { inst: 'ruido', vol: 0.10, notas: 'K . h . S . h . | K . h K S . h h |'.repeat(8) },
    ] },
  // Dentro del cine: piano de película muda, juguetón
  cine: {
    paso: 0.11, canales: [
      { inst: 'pulso12', vol: 0.12, notas:
        'E5 . E5 F5 G5 . E5 . | C5 . D5 . E5 - - . | D5 . D5 E5 F5 . D5 . | B4 . C5 . D5 - - . |' +
        'E5 . G5 . C6 . B5 . | A5 . G5 . F5 . E5 . | D5 . E5 . F5 . D5 . | C5 - - - - - . . |' },
      { inst: 'triangulo', vol: 0.3, notas:
        'C3 . G3 . C3 . G3 . | C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | G2 . D3 . G2 . D3 . |' +
        'C3 . G3 . E3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . . |' },
      { inst: 'ruido', vol: 0.04, notas: 'h . . . h . . . |'.repeat(8) },
    ] },
  // Nivel 3, la tormenta de invierno: en mi menor, empujada como el viento
  invierno: {
    paso: 0.13, canales: [
      { inst: 'quena', vol: 0.17, notas:
        'E5 - - - B4 - E5 - | G5 - F#5 - E5 - D5 - | C5 - - - G4 - C5 - | E5 - D5 - B4 - - - |' +
        'A4 - C5 - E5 - A5 - | G5 - - - F#5 - E5 - | D#5 - E5 - F#5 - B4 - | E5 - - - - - . . |' },
      { inst: 'charango', vol: 0.085, notas:
        'G4 . B4 . G4 . B4 . | G4 . B4 . A4 . B4 . | E4 . G4 . E4 . G4 . | F#4 . A4 . D#4 . F#4 . |' +
        'E4 . A4 . C5 . A4 . | E4 . G4 . B4 . G4 . | F#4 . B4 . D#5 . B4 . | G4 . B4 . E4 . . . |' },
      { inst: 'triangulo', vol: 0.34, notas:
        'E2 . E3 . E2 . E3 . | E2 . E3 . D2 . D3 . | C2 . C3 . C2 . C3 . | B1 . B2 . B1 . B2 . |' +
        'A1 . A2 . A1 . A2 . | E2 . E3 . E2 . E3 . | B1 . B2 . B1 . B2 . | E2 . E3 . E2 . . . |' },
      { inst: 'ruido', vol: 0.09, notas: 'K . h . S . h h | K . h K S . h . |'.repeat(8) },
    ] },
  // La chaqueta regalona: cueca rápida y brillante, en re mayor
  chaqueta: {
    paso: 0.085, canales: [
      { inst: 'pulso25', vol: 0.15, notas:
        'D5 F#5 A5 D6 - A5 | B5 - A5 F#5 - D5 | E5 G5 B5 E6 - B5 | C#6 - A5 E5 - C#5 |' +
        'D5 F#5 A5 D6 - F#6 | E6 - D6 C#6 - B5 | A5 - G5 F#5 - E5 | D5 - - A4 - . |' },
      { inst: 'charango', vol: 0.09, notas:
        'F#4 . A4 F#4 . A4 | G4 . B4 G4 . B4 | G4 . B4 G4 . B4 | A4 . C#5 A4 . E4 |' +
        'F#4 . A4 F#4 . A4 | G4 . B4 A4 . C#5 | F#4 . A4 E4 . G4 | F#4 . A4 D4 . . |' },
      { inst: 'triangulo', vol: 0.34, notas:
        'D3 - - A2 - - | G2 - - D3 - - | E3 - - B2 - - | A2 - - E3 - - |' +
        'D3 - - A2 - - | G2 - - A2 - - | A2 - - A2 - - | D3 - - D2 - - |' },
      { inst: 'ruido', vol: 0.11, notas: 'K . h S h h | K h h S . h |'.repeat(8) },
    ] },
  // Cavernas de la mina Fortuna: lenta, en re menor
  cueva: {
    paso: 0.2, canales: [
      { inst: 'quena', vol: 0.14, notas:
        'D5 - - - A4 - - - | F5 - E5 - D5 - - - | C5 - - - A4 - - - | D5 - - - - - . . |' +
        'F5 - - - E5 - - - | D5 - C5 - A4 - - - | A#4 - - - C5 - - - | D5 - - - - - . . |' },
      { inst: 'triangulo', vol: 0.32, notas:
        'D2 - - - A2 - - - | D2 - - - A2 - - - | C2 - - - G2 - - - | D2 - - - A2 - - - |' +
        'F2 - - - C3 - - - | D2 - - - A2 - - - | A#1 - - - F2 - - - | A1 - - - D2 - - - |' },
      { inst: 'ruido', vol: 0.05, notas: 'h . . . . . . . | . . . . h . . . |'.repeat(4) },
    ] },
  // Escena de la plaza: tensión cuando llega el jefe
  tension: {
    paso: 0.13, canales: [
      { inst: 'pulso25', vol: 0.13, notas: 'E4 . E4 . F4 . E4 . | E4 . E4 . G4 - F4 . | E4 . E4 . F4 . E4 . | D#4 - - - - - . . |' },
      { inst: 'triangulo', vol: 0.34, notas: 'E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 . | F2 . F2 . F2 . F2 . | D#2 . D#2 . D#2 . D#2 . |' },
      { inst: 'ruido', vol: 0.10, notas: 'K . . . S . . . | K . K . S . . . |'.repeat(2) },
    ] },
  // La olla de fundición: chiste rápido
  olla: {
    paso: 0.07, bucle: false, canales: [
      { inst: 'pulso25', vol: 0.15, notas: 'C6 B5 A#5 A5 G#5 G5 F#5 F5 E5 D#5 D5 C#5 C5 - . . C5 . C5 . G4 - - .' },
      { inst: 'triangulo', vol: 0.3, notas: 'C3 . . . C3 . . . C3 . . . C3 . . . C3 . C3 . G2 - - .' },
    ] },
  victoria: {
    paso: 0.11, bucle: false, canales: [
      { inst: 'pulso25', vol: 0.17, notas: 'C5 E5 G5 C6 - - G5 - C6 - - - E6 - - - - - - .' },
      { inst: 'pulso12', vol: 0.08, notas: 'E4 G4 C5 E5 - - E5 - G5 - - - G5 - - - - - - .' },
      { inst: 'triangulo', vol: 0.32, notas: 'C3 . C3 . C3 . G2 . C3 . . . C3 - - - - - - .' },
    ] },
  derrota: {
    paso: 0.18, bucle: false, canales: [
      { inst: 'pulso25', vol: 0.15, notas: 'A4 - G4 - F4 - E4 - - - - .' },
      { inst: 'triangulo', vol: 0.3, notas: 'A2 - - - D2 - - - E2 - - .' },
    ] },
  // Créditos y fin: tranquila y cálida
  creditos: {
    paso: 0.17, canales: [
      { inst: 'quena', vol: 0.17, notas:
        'E5 - - - D5 - C5 - | D5 - - - G4 - - - | C5 - - - D5 - E5 - | G5 - - - - - - - |' +
        'A5 - - - G5 - E5 - | F5 - - - E5 - D5 - | C5 - - - D5 - B4 - | C5 - - - - - - . |' },
      { inst: 'triangulo', vol: 0.3, notas:
        'C3 - G3 - C3 - G3 - | G2 - D3 - G2 - D3 - | A2 - E3 - A2 - E3 - | E2 - B2 - E2 - B2 - |' +
        'F2 - C3 - F2 - C3 - | D3 - A3 - D3 - A3 - | G2 - D3 - G2 - D3 - | C3 - G3 - C3 - . - |' },
    ] },
};
