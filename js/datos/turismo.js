// M-TUR (carril turismo, 14-11-2026): datos del MODO TURÍSTICO (sin three.js).
// Pedido de Diego: «recorrer la ciudad, hablar de la historia con los NPC, leer carteles e ingresar a conocer edificios
// emblemáticos y artefactos curiosos, cual turista». Sin enemigos, sin pepitas, sin bolas ni peligros, sin reloj.
// Fuentes (resumidas, no copiadas): libro «Apuntes Históricos de El Mineral El Teniente» (P. Villagra), documental/libro/*.md
// y el reportaje de T13 (capturas/coordinacion/ESENCIA_SEWELL.md). Regla «tragedia sin celebración»: lo de 1945 va sobrio.
//
// Punto de interés (POI):
//   id, nombre, tipo 'edificio' | 'curiosidad', anio (texto), edif (n.º de edificio si se conoce), texto (ficha breve)
//   lugar: clave de irLugar.js (la puerta del edificio) → el cartel va frente a la puerta; o x, z: punto fijo.
//   entra: 'sala' (interior propio: cine, palitroque...) | 'gen' (interior genérico de interiores.js, con E) | undefined
// NPC: id, quien ('minero' | 'vecina' | 'anciana'), nombre, en: id del POI (se para a su lado) o x, z; guia: true propone
//   el recorrido; lineas: relatos (uno por cada E, sin repetir).

export const EPOCAS = {
  1: { titulo: '1905 · Pueblo Hundido', sub: 'El campamento del Cerro Negro y El Molino',
    intro: 'La Braden Copper Co. acaba de llegar al Cerro Negro. Todavía no hay ciudad: carpas, el molino en obra y casas de piedra en Pueblo Hundido. Recorre a tu ritmo: no hay enemigos ni apuro.' },
  2: { titulo: '1917-1930 · La ciudad de las escaleras', sub: 'Sewell crece alrededor de su Escalera Central',
    intro: 'Desde 1915 el campamento se llama Sewell. Ya viven más de 13.000 personas: hay palitroque, cine, hospital y escuelas, todo unido por la Escalera Central.' },
  3: { titulo: '1945 · El apogeo, en invierno', sub: 'La nieve, el Teniente Club, el hospital y la memoria',
    intro: 'Sewell en invierno, en sus años de apogeo. En la plaza del barrio cívico hay un lugar de memoria por los 355 trabajadores que murieron en la tragedia del humo de 1945: se visita en silencio.' },
  4: { titulo: '1967 · La Operación Valle', sub: 'La chilenización del cobre y el comienzo de la despedida',
    intro: 'En 1967 el cobre se chileniza y comienza la Operación Valle: las familias bajan poco a poco a Rancagua. El último tren saldrá en 1981.' },
};

export const PUNTOS = {
  1: [
    { id: 'campamento', nombre: 'Campamento del Cerro Negro', tipo: 'curiosidad', anio: '1905', x: -420, z: -462,
      texto: 'Los primeros trabajadores, casi todos campesinos del centro y sur de Chile, llegaban en caravanas de carretas desde Graneros: el viaje tomaba 4 a 5 días. Vivían en carpas y barracas en el Cerro Negro, donde después nacería Sewell.' },
    { id: 'hamilton', nombre: 'Casa de Hamilton', tipo: 'edificio', anio: 'c. 1905', lugar: 'hamilton', entra: 'gen',
      texto: 'El superintendente Thomas Hamilton levantó en la ladera del Cerro Negro las primeras viviendas antes de que llegara el invierno. Desde el comienzo la vivienda marcó las diferencias: norteamericanos, empleados y obreros vivían en edificios distintos. Por dentro: sala con estufa, comedor, el escritorio del superintendente con los planos de la Braden Copper y, arriba, los dormitorios.' },
    { id: 'andarivel', nombre: 'El andarivel (tranvía aéreo)', tipo: 'curiosidad', anio: '1905-1910', x: -323, z: -318,
      texto: 'Junto al molino funcionaron andariveles, como el «Fortuna», que bajaban el mineral en capachos colgados de un cable. En la montaña no había caminos para carros: el cable cruzaba quebradas que nadie podía cruzar a pie.' },
    { id: 'fortuna', nombre: 'Bocamina de la mina Fortuna', tipo: 'curiosidad', anio: 'desde 1897', lugar: 'mina', entra: 'sala',
      texto: 'Fortuna era el sector más antiguo del yacimiento: sus vetas ricas se agotaron en 1897. Los campamentos Fortuna 3 y Fortuna 4 fueron los primeros. Entra con cuidado: la galería es oscura.' },
    { id: 'pueblo', nombre: 'Pueblo Hundido', tipo: 'curiosidad', anio: '1905', x: -160, z: -172,
      texto: 'Casas de piedra y tablas apretadas en la ladera, hundidas en la pendiente para capear el viento y la nieve. Aquí vivían las primeras familias que subieron con los obreros.' },
    { id: 'camarote1905', nombre: 'Camarote de solteros', tipo: 'edificio', anio: 'c. 1905', lugar: 'camarote1905', entra: 'gen',
      texto: 'Los obreros solteros dormían en camarotes con literas de fierro y baúles. La compañía vigilaba la moral: ley seca permanente y nada de pololeos a escondidas.' },
    { id: 'panaderia', nombre: 'Panadería', tipo: 'edificio', anio: 'c. 1905', lugar: 'panaderia',
      texto: 'El pan se horneaba en el mismo campamento: todo lo demás subía en mula o en carreta por el camino desde Graneros, terminado en noviembre de 1905.' },
    { id: 'molino', nombre: 'El Molino (concentradora)', tipo: 'edificio', anio: '1905', lugar: 'molino',
      texto: 'Cincuenta trabajadores pusieron sus cimientos en 1905; 180 carpinteros levantaron un edificio de cinco pisos. Los obreros llamaban «El Molino» a todo el campamento. El molino de Sewell sigue funcionando, con muchos cambios, y es patrimonio industrial.' },
    { id: 'portaollas', nombre: 'Portaollas y playa de ollas', tipo: 'curiosidad', anio: '1906-1922', x: -49, z: -60,
      texto: 'La primera fundición de Braden, de dos hornos de soplo, producía «mata» de cobre, no barras refinadas. El metal fundido viajaba en ollas montadas en carros portaollas sobre rieles. En 1922 la fundición se trasladó a Caletones.' },
    { id: 'estacion', nombre: 'Punta de rieles (futura estación)', tipo: 'edificio', anio: '1911', lugar: 'estacion',
      texto: 'El ferrocarril Rancagua–Sewell, de trocha angosta, se inauguró en 1911: más de 64 km y unas 6 horas de viaje subiendo la cordillera. Fue la única forma de llegar durante casi toda la vida de Sewell.' },
  ],
  2: [
    { id: 'estacion', nombre: 'Estación de Sewell', tipo: 'edificio', anio: '1911', lugar: 'estacion',
      texto: 'Estación de término del ferrocarril de la Braden, a más de 2.100 m de altura. El tren unía cada día Rancagua con Sewell en más de 6 horas, pasando por Coya y Caletones. No había autos: desde aquí todo subía a pie.' },
    { id: 'palitroque', nombre: 'El Palitroque (bowling)', tipo: 'edificio', anio: '1917', edif: 106, lugar: 'palitroque', entra: 'sala',
      texto: 'Se inauguró en 1917 como bowling; los sewellinos le dieron su propio nombre: palitroque. Pistas de madera clara y bolas negras de uso: una de las diversiones más queridas de la ciudad.' },
    { id: 'pulperia', nombre: 'Pulpería', tipo: 'edificio', anio: '1915-1930', lugar: 'pulperia',
      texto: 'En la pulpería se compraba la comida, la ropa y lo necesario para la casa. Para los casados, la vivienda, la luz y el agua eran gratis: «aquí era todo gratis», recuerdan los que vivieron aquí.' },
    { id: 'azotea', nombre: 'Techos y balcones', tipo: 'edificio', anio: '1920', lugar: 'camarote_azotea', entra: 'gen',
      texto: 'Los edificios de madera se arman con el sistema de «cuadrados y triángulos», flexible y resistente a la nieve y los temblores. Se pintaban de colores fuertes: verde, amarillo, rojo, azul, cada vecino distinto.' },
    { id: 'mirador', nombre: 'Mirador de Caletones', tipo: 'curiosidad', anio: '1922', x: -10, z: -128,
      texto: 'Desde 1922 la fundición funciona en Caletones, unos kilómetros más abajo. Un tranvía aéreo bajaba el concentrado de cobre desde la planta de Sewell solo con la fuerza de gravedad.' },
    { id: 'escalera', nombre: 'La Escalera Central', tipo: 'curiosidad', anio: 'desde 1905', x: 5, z: -178,
      texto: 'La pendiente impedía los vehículos con ruedas, así que la ciudad creció alrededor de una escalera central que unía casas, plazas e industrias. En vez de calles, peldaños: por eso es «la ciudad de las escaleras».' },
    { id: 'torre', nombre: 'Edificio de balcones', tipo: 'edificio', anio: '1920', lugar: 'torre',
      texto: 'Bloques largos de obreros con corredores de madera y escaleras de emergencia de acero blanco en zigzag pegadas a la fachada: un detalle que todavía se ve en Sewell.' },
    { id: 'cine', nombre: 'Teatro / cine', tipo: 'edificio', anio: '1920-1930', edif: 165, lugar: 'cine', entra: 'sala',
      texto: 'Cine para 680 personas. Los estrenos llegaban antes que a Santiago, casi al mismo tiempo que en Estados Unidos. Ir a la función era el panorama de la semana.' },
    { id: 'iglesia', nombre: 'Iglesia', tipo: 'edificio', anio: '1915-1930', edif: 231, lugar: 'iglesia', entra: 'sala',
      texto: 'Nave pequeña, celeste, con arcos blancos y una campana colgada de un brazo de fierro. Bajo la moral de la compañía, a la pareja de solteros que se veía de la mano la «convidaban a casarse».' },
    { id: 'plaza', nombre: 'Plaza del barrio cívico', tipo: 'curiosidad', anio: '1920', x: 6, z: -300,
      texto: 'Sewell tenía barrio cívico, múltiples plazas y canchas. En las plazuelas se hacían los actos del 21 de mayo y jugaban los niños: «todo era un gran y seguro patio», dice un antiguo vecino.' },
    { id: 'hospital', nombre: 'Hospital', tipo: 'edificio', anio: '1919', edif: 157, lugar: 'hospital', entra: 'sala',
      texto: 'Inaugurado en 1919 en el edificio 157, fue el hospital más moderno de Chile y Latinoamérica: ascensor, incubadoras, laboratorio farmacéutico, salas de operaciones y rayos X.' },
    { id: 'correos', nombre: 'Correos', tipo: 'edificio', anio: '1920', lugar: 'correos', entra: 'gen',
      texto: 'Las cartas y encomiendas subían y bajaban en el tren. Para miles de familias que habían llegado del campo, el correo era el hilo con los parientes del valle.' },
    { id: 'escuela', nombre: 'Escuela Industrial · hoy Museo', tipo: 'edificio', anio: '1920', edif: 129, lugar: 'escuela', entra: 'sala',   // N2-ESCUELA: interior = museo de hoy
      texto: 'La educación era gratuita pero obligatoria para los hijos e hijas de los trabajadores. Un exalumno recuerda el patio de recreo y al inspector: «aquí hubo mucha felicidad». Hoy el edificio es el Museo de la Gran Minería del Cobre.' },
    { id: 'club', nombre: 'Teniente Club', tipo: 'edificio', anio: '1925', edif: 20, lugar: 'club', entra: 'sala',
      texto: 'Centro social y recreativo de la comunidad estadounidense de Sewell (1925), con pórtico de columnas y balcón. Adentro: escalera de madera con alfombra roja, salón de bailes y conciertos con arañas de bronce y cortinas de terciopelo, la sala del espejo y, en el zócalo, la única piscina de la ciudad, temperada para nadar todo el año.' },
    { id: 'concentradora', nombre: 'La concentradora', tipo: 'edificio', anio: '1920', lugar: 'concentradora',
      texto: 'Aquí se molía la roca y se separaba el cobre por flotación, técnica que El Teniente fue el primero en usar a gran escala desde 1911. La ciudad entera existía para que esta planta no se detuviera.' },
  ],
  3: [
    { id: 'invierno', nombre: 'Invierno en Sewell', tipo: 'curiosidad', anio: '1945', x: 6, z: -146,
      texto: 'Con la nieve, Sewell quedaba aislado «como un barco». Los inviernos eran crudos: la gente aprendió a vivir en la montaña todo el año, y de esa mezcla de mineros norteamericanos y campesinos chilenos nació una cultura propia.' },
    { id: 'escalera', nombre: 'La Escalera Central', tipo: 'curiosidad', anio: 'desde 1905', x: 5, z: -190,
      texto: 'En invierno los peldaños se cubren de nieve y hielo. Por la escalera subían los turnos de obreros con casco y lámpara, y por ella bajaba todo lo que traía el tren.' },
    { id: 'palitroque', nombre: 'El Palitroque (bowling)', tipo: 'edificio', anio: '1917', edif: 106, lugar: 'palitroque', entra: 'sala',
      texto: 'Bowling inaugurado en 1917; los sewellinos lo llamaron palitroque. En invierno era refugio y punto de encuentro.' },
    { id: 'pulperia', nombre: 'Pulpería', tipo: 'edificio', anio: '1945', lugar: 'pulperia',
      texto: 'Las provisiones subían en tren y se repartían en las pulperías. Con la nieve, había que guardar comida para los días en que el tren no podía subir.' },
    { id: 'cine', nombre: 'Teatro / cine', tipo: 'edificio', anio: '1945', edif: 165, lugar: 'cine', entra: 'sala',
      texto: 'Cine para 680 personas, con estrenos antes que en Santiago. Juan Carlos Cáceres, nacido en Sewell, recuerda que las películas llegaban al mismo tiempo que en Estados Unidos.' },
    { id: 'iglesia', nombre: 'Iglesia', tipo: 'edificio', anio: '1945', edif: 231, lugar: 'iglesia', entra: 'sala',
      texto: 'La iglesia acompañó a las familias en los bautizos, los matrimonios y también en los duelos. Hoy se recorre en silencio.' },
    { id: 'club', nombre: 'Teniente Club', tipo: 'edificio', anio: '1945', edif: 20, lugar: 'club', entra: 'sala',
      texto: 'El Teniente Club (1925) tenía en su zócalo la única piscina de Sewell, temperada: se nadaba en agua tibia con la cordillera nevada al otro lado de las ventanas. Arriba, el salón de bailes y conciertos, la sala del espejo y la gran escalera de alfombra roja.' },
    { id: 'correos', nombre: 'Correos', tipo: 'edificio', anio: '1945', lugar: 'correos', entra: 'gen',
      texto: 'Oficina de correos y administración. En los inviernos aislados, una carta del valle era un acontecimiento.' },
    { id: 'escuela', nombre: 'Escuela Industrial · hoy Museo', tipo: 'edificio', anio: '1936', edif: 129, lugar: 'escuela', entra: 'sala',   // N2-ESCUELA
      texto: 'Edificio ocre de esquina curva, de 1936. Formaba técnicos para la mina. Hoy es el Museo de la Gran Minería del Cobre.' },
    { id: 'hospital', nombre: 'Hospital', tipo: 'edificio', anio: '1919', edif: 157, lugar: 'hospital', entra: 'sala',
      texto: 'El hospital del edificio 157, con ascensor, rayos X y salas de operaciones. Fue de los primeros de Chile en tener incubadoras para los recién nacidos.' },
    { id: 'memoria', nombre: 'Memoria del 19 de junio de 1945', tipo: 'curiosidad', anio: '1945', x: 4, z: -312, sobrio: true,
      texto: 'El 19 de junio de 1945 un incendio en un taller, fuera de la mina, en el Nivel Teniente 1, llenó de humo las galerías. Murieron 355 trabajadores: la «tragedia del humo», el accidente más grave de la minería metálica moderna. Después nacieron los departamentos de seguridad industrial y de bienestar. Este lugar se visita en silencio.' },
    { id: 'concentradora', nombre: 'La concentradora', tipo: 'edificio', anio: '1945', lugar: 'concentradora',
      texto: 'La planta seguía trabajando día y noche, también con nieve. El concentrado bajaba a la fundición de Caletones.' },
  ],
  4: [
    { id: 'plaza', nombre: 'Sewell, 1967', tipo: 'curiosidad', anio: '1967', x: 6, z: -284,
      texto: 'En 1967, con el presidente Eduardo Frei Montalva, el cobre se chileniza: el Estado compra el 49 % de El Teniente. El acta se presentó en una ceremonia aquí, en Sewell. Ese mismo año empieza la Operación Valle.' },
    { id: 'escalera', nombre: 'La Escalera Central', tipo: 'curiosidad', anio: '1967', x: 5, z: -190,
      texto: 'En los años 50 y 60 vivieron en Sewell más de 15.000 personas. Más de 500.000 pasaron por la ciudad entre 1905 y 1981, todas subiendo y bajando esta escalera.' },
    { id: 'estacion', nombre: 'Estación: el último tren', tipo: 'edificio', anio: '1981', lugar: 'estacion',
      texto: 'Con la Operación Valle las familias se trasladaron a poblaciones nuevas en Rancagua. En 1981 bajó el último tren desde la estación de Sewell y la ciudad quedó despoblada. «Allá había que pagar el agua y la luz; aquí era todo gratis», recuerda una vecina.' },
    { id: 'palitroque', nombre: 'El Palitroque (bowling)', tipo: 'edificio', anio: '1967', edif: 106, lugar: 'palitroque', entra: 'sala',
      texto: 'Medio siglo después de su inauguración, el palitroque seguía siendo punto de encuentro. Hoy sus pistas se pueden ver en la visita a Sewell.' },
    { id: 'pulperia', nombre: 'Pulpería', tipo: 'edificio', anio: '1967', lugar: 'pulperia',
      texto: 'Los sewellinos recordaban dos grandes almacenes. Al bajar a Rancagua, muchas familias descubrieron por primera vez la cuenta de la luz y el agua.' },
    { id: 'cine', nombre: 'Teatro / cine', tipo: 'edificio', anio: '1967', edif: 165, lugar: 'cine', entra: 'sala',
      texto: 'El cine de 680 butacas siguió dando estrenos hasta que la ciudad se fue vaciando.' },
    { id: 'iglesia', nombre: 'Iglesia', tipo: 'edificio', anio: '1967', edif: 231, lugar: 'iglesia', entra: 'sala',
      texto: 'Muchos nietos de los primeros obreros se casaron aquí. Hoy la iglesia es parte de la visita al sitio patrimonial.' },
    { id: 'hospital', nombre: 'Hospital', tipo: 'edificio', anio: '1919', edif: 157, lugar: 'hospital', entra: 'sala',
      texto: 'Aquí nacieron generaciones de sewellinos. «Este es mi pueblo; aquí nací y aquí me quiero quedar», dice Juan Carlos Cáceres.' },
    { id: 'club', nombre: 'Teniente Club', tipo: 'edificio', anio: '1967', edif: 20, lugar: 'club', entra: 'sala',
      texto: 'Club social de 1925 con salón de conciertos, sala del espejo y la piscina temperada del zócalo: la «mejor ciudad moderna de Chile», decían quienes vivieron aquí.' },
    { id: 'escuela', nombre: 'Escuela Industrial · hoy Museo', tipo: 'edificio', anio: '1936', edif: 129, lugar: 'escuela', entra: 'sala',   // N2-ESCUELA
      texto: 'Hoy es el Museo de la Gran Minería del Cobre. En 1998 Sewell fue declarado Monumento Nacional (zona típica).' },
    { id: 'correos', nombre: 'Correos', tipo: 'edificio', anio: '1967', lugar: 'correos', entra: 'gen',
      texto: 'Por correo llegaban los avisos del traslado a Rancagua. Lía Elgueta, que vivió aquí hasta los 15 años, no se quería ir: «le hizo la rincha» a sus papás.' },
    { id: 'planta', nombre: 'La planta, 1971', tipo: 'curiosidad', anio: '1971', x: -8, z: -492,
      texto: 'En 1971, con el presidente Salvador Allende, el cobre se nacionaliza por completo: el Estado adquiere el 51 % restante. Ese año se abre la Carretera del Cobre y los trabajadores pueden viajar a diario desde Rancagua.' },
    { id: 'andarivel', nombre: 'Andarivel de la mina', tipo: 'curiosidad', anio: '1967', x: -36, z: -508,
      texto: 'Capachos colgados de un cable subían a lo alto de la faena. En la montaña, los cables y los andariveles reemplazaban a los caminos.' },
    { id: 'taller', nombre: 'Taller de la planta', tipo: 'edificio', anio: '1967', lugar: 'taller_n4',
      texto: 'Naves de chapa con portones para la mantención de las máquinas. Después del cierre del campamento, la mina siguió: hoy El Teniente es la mina subterránea de cobre más grande del mundo.' },
    { id: 'cumbre', nombre: 'Lo más alto de Sewell', tipo: 'curiosidad', anio: '2006', x: -46, z: -690,
      texto: 'Desde aquí se ve la ciudad entera. El 13 de julio de 2006 la UNESCO declaró a Sewell Patrimonio de la Humanidad por su valor minero, su arquitectura de madera de 253 edificios de colores y la cultura de sus habitantes.' },
  ],
};

export const NPCS = {
  1: [
    { id: 'n1guia', quien: 'minero', nombre: 'Don Ramón, capataz', guia: true, x: -421, z: -465, lineas: [
      'Bienvenido al Cerro Negro, forastero. Esto es la Braden Copper Company: todavía no hay ciudad, solo carpas, barro y mucho trabajo.',
      'Yo llegué de Graneros con una caravana de carretas: cuatro días de camino. Los que bajan a buscar gente nos ofrecen sueldo en plata contante y sonante.',
      'Allá arriba está la casa del superintendente Hamilton. Más allá, el andarivel cruza la quebrada hasta la mina Fortuna.',
      'Le propongo un recorrido: campamento, casa de Hamilton, andarivel, la Fortuna, Pueblo Hundido y El Molino. Se lo marco en el plano (Tab). Siga la luz.',
    ] },
    { id: 'n1vecina', quien: 'vecina', nombre: 'Doña Clara', en: 'pueblo', lineas: [
      'Aquí en Pueblo Hundido las casas van metidas en la ladera, por el viento. Mi marido trabaja en el molino.',
      'El pan lo hornean aquí mismo; lo demás sube en mula. Cuando nieva, nadie baja en semanas.',
      'Dicen que la compañía va a construir camarotes para las familias, con luz y agua. Ojalá sea cierto.',
    ] },
    { id: 'n1molinero', quien: 'minero', nombre: 'Carpintero del molino', en: 'molino', lineas: [
      'Somos ciento ochenta carpinteros levantando este molino: cinco pisos de madera en plena cordillera.',
      'Por eso la gente le dice «El Molino» a todo el campamento. El nombre de Sewell vino después, en 1915.',
      'Esas ollas llevan la mata de cobre fundida en carros portaollas. No se acerque mucho: queman.',
    ] },
  ],
  2: [
    { id: 'n2guia', quien: 'vecina', nombre: 'Rosa, guía de la estación', guia: true, x: 24, z: 6, lineas: [
      '¡Bienvenido a Sewell! Acaba de llegar en el tren desde Rancagua: más de seis horas subiendo la cordillera.',
      'Aquí no hay calles: todo se hace por la Escalera Central. Hay cuatro tipos de vecinos: obreros casados, obreros solteros, empleados y norteamericanos, y cada uno vive en su edificio.',
      'Rige la ley seca, y si a una pareja de solteros la ven de la mano, la «convidan a casarse». Leyes de Chile y leyes de la compañía.',
      'Le propongo un recorrido: palitroque, pulpería, la escalera, el cine, la iglesia, el hospital y la escuela. Se lo marco en el plano (Tab): siga la luz.',
    ] },
    { id: 'n2minero', quien: 'minero', nombre: 'Minero de turno', en: 'palitroque', lineas: [
      'Después del turno, una partida en el palitroque. Antes le decían bowling, pero aquí lo bautizamos a nuestra manera.',
      'Subimos a la mina con casco y lámpara de carburo. Arriba las ventanas dan a la cordillera: aquí hay cóndores en vez de palomas.',
      'A los casados la compañía les da casa, luz, agua y calefacción. A los solteros, el camarote y la pensión.',
    ] },
    { id: 'n2anciana', quien: 'anciana', nombre: 'Señora Elena', en: 'cine', lineas: [
      'En este cine las películas llegan antes que a Santiago, mijito. Caben seiscientas ochenta personas.',
      'Los domingos la escalera se llena: unos van al cine, otros a la iglesia, otros a la plaza.',
      'Vivir aquí es como estar en un estado dentro de otro: todo es de la empresa, hasta la luz que nos alumbra.',
    ] },
    { id: 'n2vecina', quien: 'vecina', nombre: 'Lía, hija de empleado', en: 'plaza', lineas: [
      'En la plaza jugamos todos los niños; para el 21 de mayo se llena de banderas.',
      'En mi casa hay una bomba para el agua caliente. ¡En invierno es lo mejor!',
      'Mi papá dice que la escuela es gratis pero obligatoria. Al inspector nadie se le escapa.',
    ] },
  ],
  3: [
    { id: 'n3guia', quien: 'anciana', nombre: 'Doña Marta, guía', guia: true, x: 4, z: -153, lineas: [
      'Bienvenido a Sewell en invierno. Con esta nieve el campamento queda aislado, como un barco en la cordillera.',
      'Estos son los años del apogeo: el Teniente Club con su piscina temperada, el hospital del edificio 157, el cine y la Escuela Industrial.',
      'Arriba, en la plaza del barrio cívico, hay un lugar de memoria por los trabajadores que murieron en junio de 1945. Allí se va despacio y en silencio.',
      'Le propongo un recorrido: la escalera, el palitroque, el cine, la iglesia, el Teniente Club, la escuela y el hospital, y al final la memoria. Se lo marco en el plano (Tab).',
    ] },
    { id: 'n3enfermera', quien: 'vecina', nombre: 'Enfermera del hospital', en: 'hospital', lineas: [
      'Este hospital tiene ascensor, rayos X, incubadoras y su propio laboratorio. Vienen a vernos desde otras ciudades.',
      'En invierno atendemos sobre todo caídas en el hielo y pulmonías. Abríguese bien.',
    ] },
    { id: 'n3memoria', quien: 'minero', nombre: 'Minero, compañero de turno', en: 'memoria', sobrio: true, lineas: [
      'Aquí recordamos a los 355 compañeros que murieron por el humo el 19 de junio de 1945.',
      'El fuego empezó en un taller, afuera de la mina, y el humo entró por las galerías. Muchos eran padres de familia de estos mismos edificios.',
      'Después de eso nacieron los departamentos de seguridad industrial. Que no se olvide nunca.',
    ] },
  ],
  4: [
    { id: 'n4guia', quien: 'vecina', nombre: 'Carmen, guía', guia: true, x: 4, z: -296, lineas: [
      'Bienvenido a Sewell, 1967. Este año el cobre se chilenizó, y el presidente Frei vino a presentar el acta aquí mismo.',
      'Con la Operación Valle nos están construyendo poblaciones en Rancagua. Las familias bajan de a poco.',
      'En 1971 vino la nacionalización y la Carretera del Cobre: los trabajadores podrán viajar a diario desde el valle.',
      'Le propongo un recorrido de despedida: la escalera, el cine, el hospital, la planta, el andarivel y lo más alto de Sewell, y al final la estación. Se lo marco en el plano (Tab).',
    ] },
    { id: 'n4anciana', quien: 'anciana', nombre: 'Señora Inés', en: 'hospital', lineas: [
      'Aquí nacieron mis hijos… Qué pena dejar Sewell.',
      'Allá abajo hay que pagar el agua y la luz. Aquí era todo gratis, pero también era todo de la compañía.',
      'Dicen que un día van a cuidar estos edificios como un museo. Ojalá vengan los nietos a conocerlos.',
    ] },
    { id: 'n4minero', quien: 'minero', nombre: 'Operador de la planta', en: 'planta', lineas: [
      'Desde 1971 el cobre es de todos los chilenos. La mina sigue; lo que se va es el campamento.',
      'Con la carretera ya no hace falta vivir arriba. Subimos en bus por la mañana y bajamos en la tarde.',
      'El Teniente es la mina subterránea de cobre más grande del mundo. Y pensar que empezó con carpas en el Cerro Negro.',
    ] },
  ],
};

// orden del recorrido que propone el guía (ids de PUNTOS); los que falten se agregan al final en el orden de la lista
export const RECORRIDO = {
  1: ['campamento', 'hamilton', 'andarivel', 'fortuna', 'pueblo', 'camarote1905', 'panaderia', 'molino', 'portaollas', 'estacion'],
  2: ['estacion', 'palitroque', 'pulperia', 'azotea', 'mirador', 'escalera', 'torre', 'cine', 'iglesia', 'plaza', 'correos', 'club', 'escuela', 'hospital', 'concentradora'],
  3: ['invierno', 'escalera', 'palitroque', 'pulperia', 'cine', 'iglesia', 'club', 'correos', 'escuela', 'hospital', 'concentradora', 'memoria'],
  4: ['plaza', 'escalera', 'cine', 'iglesia', 'club', 'escuela', 'correos', 'hospital', 'palitroque', 'pulperia', 'planta', 'andarivel', 'taller', 'cumbre', 'estacion'],
};

// entidades que NO se crean en el modo turístico (Diego: «sin ataques, ni pepitas, ni bolas cayendo por las escaleras»)
export const SIN_TURISMO = new Set(['pepitas', 'pepita', 'pan', 'apunte', 'letrero', 'npc', 'diego', 'minero', 'dinamitero', 'bolero', 'condor',
  'vagonetas', 'bolas', 'viento', 'hielo', 'meta', 'jefe', 'condorJefe', 'nido', 'tren', 'alud']);

// N2-ESCUELA2 (carril interiores, 15-11-2026, pedido de Diego): CÉDULAS del Museo de la Gran Minería del Cobre (ex Escuela Industrial,
// sala `museo`, solo en el modo turista). Cada pieza en exposición tiene su cédula física (kitEscuela.js la dibuja en un lienzo) y, al
// acercarse, «E: leer» abre esta ficha (turismo.js, mismo modal de los carteles). Campos: nombre, anio, origen (fabricante/procedencia,
// solo si hay dato seguro), uso (para qué servía), dato (dato histórico breve). Fuentes: documental/libro/«Origen de El Teniente y
// Sewell.md» (Braden Copper Co. 1904, decreto de 1905, concentrador de 1906, camino de carretas de 1905, ferrocarril de 762 mm,
// nombre Sewell en 1915), capturas/coordinacion/ESENCIA_SEWELL.md (altura y distancia a Rancagua, UNESCO) y datos generales de la
// minería. Donde no hay dato seguro, texto general y sin cifras.
export const CEDULAS = {
  loco: { nombre: 'Locomotora de baterías', anio: 'Mina El Teniente · siglo XX', origen: 'Equipo importado para la minería subterránea',
    uso: 'Arrastraba trenes de carros mineros por las galerías de transporte. Funciona con acumuladores eléctricos: no echa humo, algo clave bajo tierra, donde el aire es escaso.',
    dato: 'Las minas subterráneas usaron también locomotoras de trole, que toman la corriente de un cable aéreo. Las de baterías podían entrar a galerías sin ese cable.' },
  carros: { nombre: 'Carros mineros', anio: 'Mina El Teniente · siglo XX',
    uso: 'Llevaban el mineral tronado desde los puntos de carguío hasta los piques de traspaso, por donde la roca cae a los niveles de transporte.',
    dato: 'Se enganchaban en trenes tirados por una locomotora. Para vaciarlos, la caja se volteaba de costado sobre el pique.' },
  pala: { nombre: 'Pala cargadora Eimco 12B', anio: 'Mediados del siglo XX', origen: 'Eimco Corporation · Salt Lake City, Estados Unidos',
    uso: 'Pala sobre rieles movida por aire comprimido. La cuchara recoge la roca del frente y, al bascular, la lanza por encima de la máquina al carro que va detrás.',
    dato: 'Este tipo de pala de volteo (en inglés, «rocker shovel») se usó en minas y túneles de todo el mundo y reemplazó la carga de la roca a pala de mano.' },
  jumbo: { nombre: 'Jumbo perforador', anio: 'Minería mecanizada · fines del siglo XX',
    uso: 'Equipo sobre neumáticos con un brazo que sostiene la perforadora: hace los tiros en el frente de la galería, que después se cargan con explosivo para la tronadura.',
    dato: 'Con el jumbo, el operador perfora desde su puesto bajo el techo de protección, lejos de la roca suelta del frente. Reemplazó a las perforadoras de mano.' },
  perforadora: { nombre: 'Perforadora neumática de pierna', anio: 'Siglo XX',
    uso: 'La «máquina» del perforista: con aire comprimido golpea y hace girar un barreno de acero contra la roca. La pierna neumática la sostiene y la empuja hacia el frente.',
    dato: 'El polvo de la perforación en seco causaba silicosis, la enfermedad de los mineros. Perforar con agua (perforación húmeda) ayudó a combatirla.' },
  vagoneta: { nombre: 'Vagoneta de madera', anio: 'Primeros años de la mina',
    uso: 'Carro de tablas reforzado con zunchos de fierro, de los primeros tiempos de El Teniente. Se empujaba por los rieles de las galerías.',
    dato: 'Los primeros equipos y materiales subieron en carretas tiradas por bueyes desde Graneros: el camino de carretas a la mina se terminó en noviembre de 1905.' },
  mural: { nombre: 'Corte de la mina El Teniente', anio: 'Esquema de la mina',
    uso: 'Muestra cómo la mina se ordena en niveles horizontales unidos por piques, bajo la cordillera, alrededor del cuerpo de mineral.',
    dato: 'El Teniente es la mina subterránea de cobre más grande del mundo. Desde 1976 la explota Codelco, la empresa del Estado de Chile.' },
  minerales: { nombre: 'Minerales de cobre', anio: 'Vitrina 1', origen: 'Yacimientos de cobre de Chile',
    uso: 'De izquierda a derecha: calcopirita (dorada), bornita (tornasolada), malaquita (verde), cuprita (roja), roca de la mina y cobre nativo.',
    dato: 'El Teniente es un pórfido de cobre: el mineral está repartido en enormes volúmenes de roca. Su mena principal es la calcopirita, y la mina también produce molibdeno.' },
  lamparas: { nombre: 'Lámparas de carburo y casco', anio: 'Vitrina 2 · primera mitad del siglo XX',
    uso: 'En el depósito de abajo va el carburo de calcio; arriba, agua que gotea sobre él y produce gas acetileno, que arde en el mechero con una llama clara.',
    dato: 'Antes de las lámparas eléctricas de casco, cada minero bajaba al turno con su lámpara de carburo; en las fotos de la época se ven en los cascos.' },
  herramientas: { nombre: 'Herramientas del minero', anio: 'Vitrina 3',
    uso: 'Barreno, combo y picota. Con el combo se golpeaba el barreno para abrir los tiros a mano; la picota servía para acuñar y botar la roca suelta.',
    dato: 'La perforación a mano fue el trabajo de los primeros mineros, antes de que llegaran las perforadoras de aire comprimido.' },
  maqueta: { nombre: 'Maqueta de Sewell', anio: 'El campamento hacia 1950',
    uso: 'Sewell no tenía calles para autos: escaleras y pasarelas unían los edificios de madera pintados de colores, levantados en terrazas sobre la ladera del cerro Negro.',
    dato: 'Está a unos 2.200 m de altura, a 62 km de Rancagua. En 1915 tomó el nombre de Barton Sewell y en 2006 la UNESCO lo declaró Patrimonio de la Humanidad.' },
  p1904: { nombre: 'Braden Copper Company', anio: 'Panel de historia · 1904',
    uso: 'En junio de 1904 William Braden, con el respaldo de E. W. Nash y Barton Sewell (American Smelting and Refining Co.), organiza la Braden Copper Company para explotar El Teniente.',
    dato: 'Un decreto del 29 de abril de 1905 autorizó a la compañía a instalarse en Chile. En junio de 1906 partió el primer concentrador, en la ladera junto a la mina.' },
  p1915: { nombre: 'El campamento se llama Sewell', anio: 'Panel de historia · 1915',
    uso: 'En marzo de 1915 el campamento minero, conocido hasta entonces como El Molino, recibe el nombre de Sewell en homenaje a Barton Sewell, socio de la compañía.',
    dato: 'Desde 1911 el ferrocarril de trocha angosta (762 mm) sube desde Rancagua: el campamento crece rápido en la ladera del cerro Negro.' },
  p1920: { nombre: 'La ciudad de las escaleras', anio: 'Panel de historia · 1920',
    uso: 'Sin calles para autos, la Escalera Central es la columna de la ciudad: desde ella se llega al hospital, al cine, al palitroque, a las escuelas y a los camarotes.',
    dato: 'Los edificios de madera se pintaban de colores vivos, que todavía hoy distinguen a Sewell en la ladera.' },
  p1945: { nombre: 'La tragedia del humo', anio: 'Panel de historia · 1945', sobrio: true,
    uso: 'El 19 de junio de 1945 un incendio en la mina llenó de humo las galerías. Murieron 355 trabajadores.',
    dato: 'Es la mayor tragedia de la minería chilena. A las víctimas se las recuerda con respeto y en silencio.' },
  p1967: { nombre: 'Operación Valle', anio: 'Panel de historia · 1967',
    uso: 'Con la chilenización del cobre, el Estado de Chile se hace socio mayoritario de la mina. Comienza la Operación Valle: las familias bajan a vivir a Rancagua.',
    dato: 'Sewell se fue quedando vacío y muchos de sus edificios se desarmaron. Los que quedaron son hoy el campamento que se visita.' },
  p1971: { nombre: 'Nacionalización del cobre', anio: 'Panel de historia · 1971',
    uso: 'En julio de 1971 el Congreso aprueba por unanimidad la nacionalización de la gran minería del cobre: El Teniente pasa a manos del Estado de Chile.',
    dato: 'Desde 1976 El Teniente es una división de Codelco, la Corporación Nacional del Cobre.' },
  p2006: { nombre: 'Patrimonio de la Humanidad', anio: 'Panel de historia · 2006',
    uso: 'En julio de 2006 la UNESCO declara a Sewell Patrimonio de la Humanidad, como ejemplo único de campamento minero de la gran minería del siglo XX.',
    dato: 'El edificio en que estás, la ex Escuela Industrial, es hoy el Museo de la Gran Minería del Cobre.' },
  // C4 (P1, 16-11): las 3 fotos del pasillo son ahora las de Qwen (planta, alumnos, enfermeras): cédulas al día con lo que muestran
  foto1: { nombre: 'La planta concentradora', anio: 'Fotografía · c. 1930',
    uso: 'En la planta concentradora el mineral molido se separaba en celdas de flotación: así se obtenía el concentrado de cobre que bajaba a la fundición.',
    dato: 'El trabajo de la mina y de la planta no paraba: día y noche se relevaban los turnos.' },
  foto2: { nombre: 'Alumnos de la Escuela Industrial', anio: 'Fotografía · c. 1940',
    uso: 'En los talleres de este mismo edificio los alumnos aprendían a tornear, ajustar y reparar las máquinas de la mina.',
    dato: 'Muchos mecánicos y electricistas de El Teniente se formaron en la Escuela Industrial de Sewell.' },
  foto3: { nombre: 'Enfermeras del hospital', anio: 'Fotografía · c. 1950',
    uso: 'El hospital de Sewell atendía a los trabajadores y a sus familias: salas de camas blancas, pabellón, rayos X y maternidad.',
    dato: 'Muchos hijos de Sewell nacieron en la maternidad de este hospital.' },
};
