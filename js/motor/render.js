// Render: Three.js con WebGL2 (decisión de Diego del 11-11-2026: «el camino rápido» para dibujar las gaussianas de Idol con Spark).
// Calidades · Ultra: MSAA 4x + SMAA + bloom + sombras 4096 · Media: MSAA 4x + sombras 2048 · Baja (celular): FXAA, 0,75 de resolución.
// R-3 (14-11-2026, dientes de sierra y parpadeo): MSAA en el render target del postproceso (antes no había MSAA: solo FXAA/SMAA, que no
// sostienen líneas de 1 px en movimiento), profundidad invertida en float de 32 bits (antes 24 bits con near 0,1 y far 6000: las piezas
// del kit a 1-2 cm de la fachada peleaban la profundidad desde ~80 m), sombra del sol anclada a su grilla de texeles (antes se corría
// con el jugador y los bordes de sombra «hervían» al caminar) y realce de nitidez mucho más suave (exageraba los dientes).
// Para comparar: ?aa=fxaa|smaa|msaa|ninguno · ?msaa=0|2|4|8 · ?nitidez=0.45 · ?revz=0 · ?anclasol=0
// Las gaussianas de los edificios (Spark) traen la luz «pintada»; el postproceso se aplica encima de todo.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { lodPielCuadro } from './animMalla.js';   // N1-RENDIMIENTO: LOD de las mallas con esqueleto
import { lodMallasCuadro } from './lodIndice.js';   // N1-RENDIMIENTO: LOD por índice de las mallas estáticas grandes

// realce de nitidez suave (máscara de desenfoque): devuelve definición a los marcos y ventanas de las gaussianas
const URLR = new URLSearchParams(location.search);
const Nitidez = {
  uniforms: { tDiffuse: { value: null }, resolucion: { value: new THREE.Vector2(1, 1) }, fuerza: { value: 0.45 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 resolucion; uniform float fuerza; varying vec2 vUv;
    void main() {
      vec2 p = 1.0 / resolucion; vec4 c = texture2D(tDiffuse, vUv);
      vec3 m = (texture2D(tDiffuse, vUv + vec2(p.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(p.x, 0.0)).rgb +
                texture2D(tDiffuse, vUv + vec2(0.0, p.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, p.y)).rgb) * 0.25;
      gl_FragColor = vec4(clamp(c.rgb + (c.rgb - m) * fuerza, 0.0, 1.0), c.a);
    }`,
};

export const CALIDADES = {
  ultra: { nombre: 'Ultra', pixel: 1, sombras: 4096, alcanceSombra: 70, post: 'ultra', msaa: 4, aa: 'smaa', nitidez: 0.12 },
  media: { nombre: 'Media', pixel: 1, sombras: 2048, alcanceSombra: 55, post: 'media', msaa: 4, aa: 'msaa', nitidez: 0.1 },
  baja: { nombre: 'Baja', pixel: 0.75, sombras: 1024, alcanceSombra: 40, post: 'baja', msaa: 0, aa: 'fxaa', nitidez: 0 },
  // M-MOVIL (14-11-2026): celular. Sin postproceso (se dibuja directo a la pantalla: ni composer, ni MSAA, ni FXAA), pixelRatio
  // con tope ABSOLUTO 1,5 (no ×devicePixelRatio: un teléfono trae 3), una sola sombra de 1024 con 30 m de alcance que se
  // rehace cada 2 cuadros, 900 m de dibujo (la niebla se cierra antes para que el corte no se vea; en el N1 con la iGPU: 1600 m = 22 fps, 900 m = 31, 500 m = 41) y LoD de Spark 0,7.
  // Objetivo 30 fps: si promedia < 26 fps por 4 s baja sola la resolución (1,5 → 1,25 → 1 → 0,8) y al final apaga las sombras.
  movil: { nombre: 'Móvil', pixelTope: 1.5, sombras: 1024, alcanceSombra: 30, post: null, msaa: 0, aa: null, nitidez: 0, lejos: 900, sombraCada: 2, lod: 0.7 },
};
const URLM = URLR.get('lejos');   // ?lejos=N: distancia de dibujo del perfil Móvil (pruebas)

export class Render {
  async iniciar(lienzo, calidad) {
    // profundidad invertida (reverse-Z): con el búfer float del postproceso da precisión casi pareja de 0,1 m a 6 km (R-3)
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: 'high-performance', reversedDepthBuffer: URLR.get('revz') !== '0' });
    this.revZ = !!this.renderer.capabilities.reversedDepthBuffer;
    this.backend = 'WebGL2';
    // qué GPU está usando el navegador (para ver si es la RX 9070 XT o la gráfica integrada)
    try {
      const gl = this.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
      const n = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
      this.gpu = /9070|RX \d/.test(n) ? 'RX 9070 XT' : /Radeon Graphics|raphael|Ryzen/i.test(n) ? 'GPU integrada (lenta)' : (n.replace(/ANGLE \(|\)$/g, '').split(',')[1] || n).trim().slice(0, 40);
      this.gpuIntegrada = /Radeon Graphics|raphael|Ryzen|Intel/i.test(n) && !/9070/.test(n);
    } catch (e) { this.gpu = '?'; }
    // Neutral (Khronos PBR) respeta los colores de las gaussianas de Idol; AgX las dejaba apagadas
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;   // r187 ya no tiene PCFSoftShadowMap (usaba esta y avisaba en la consola)
    this.escena = new THREE.Scene();
    // escena «aparte» (N1-C45): gaussianas que viajan pegadas a una malla (Hércules dentro del capacho) se dibujan con su propio
    // SparkRenderer, encima de la escena principal y con su profundidad; así su mapeo no cambia y no se atrasan respecto del balde
    this.aparte = new THREE.Scene();
    // lejos a 6000 m: la cordillera llega a 2600 m del centro y, desde un extremo del mapa, con 3000 m se cortaba y por el corte
    // se veía la parte baja del cielo (gris café): la «cortina lisa con bruma» al sureste del campamento
    this.camara = new THREE.PerspectiveCamera(48, 1, 0.1, 6000);   // 80 % del campo de antes (60°): los protagonistas se ven más grandes
    this.sol = new THREE.DirectionalLight(0xfff1dc, 3.2);
    this.sol.castShadow = true;
    this.sol.shadow.bias = -0.0005; this.sol.shadow.normalBias = 0.05;
    this.escena.add(this.sol, this.sol.target);
    this.cielo = new THREE.HemisphereLight(0xbfd8ff, 0x7a5a48, 1.1);
    this.escena.add(this.cielo);
    this.dirSol = new THREE.Vector3(-0.55, 0.7, 0.45).normalize();   // sol alto desde la izquierda (axonometría de Diego)
    this.ponerCalidad(calidad);
    addEventListener('resize', () => this.ajustar());
    this.ajustar();
    return this;
  }

  ponerCalidad(nombre) {
    this.calidad = CALIDADES[nombre] ? nombre : 'media';
    const c = CALIDADES[this.calidad];
    this.escalaMovil = c.pixelTope ? (this.escalaMovil || c.pixelTope) : 0;   // M-MOVIL: tope que el ajuste automático puede bajar
    this.renderer.setPixelRatio(c.pixelTope ? Math.min(devicePixelRatio || 1, this.escalaMovil) : Math.min(devicePixelRatio || 1, 2) * c.pixel);
    this.lejos = c.lejos ? +(URLM || c.lejos) : 6000;   // M-MOVIL: distancia de dibujo
    this.camara.far = this.lejos; this.camara.updateProjectionMatrix();
    this.renderer.shadowMap.autoUpdate = true; this.renderer.shadowMap.needsUpdate = true; this.sol.castShadow = !(c.pixelTope && this.sinSombraMovil);
    this.cuadroN = 0; this.tMov = null;
    this.renderer.debug.checkShaderErrors = !c.pixelTope;   // MOVIL: sin getProgramInfoLog tras cada compilación (forzaba compilar en sincronía y trababa la carga)
    this.recorte = null;
    { const f = this.escena.fog; if (!c.pixelTope && f && f.userData && f.userData.far) { f.near = f.userData.near; f.far = f.userData.far; f.userData = null; } }
    this.sol.shadow.mapSize.set(c.sombras, c.sombras);
    const r = c.alcanceSombra, s = this.sol.shadow.camera;
    s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.near = 1; s.far = 400; s.updateProjectionMatrix();
    if (this.sol.shadow.map) { this.sol.shadow.map.dispose(); this.sol.shadow.map = null; }
    if (this.post) { this.post.dispose?.(); this.post = null; }
    this.ao = null; this.bloom = null; this.fxaa = null; this.nitidez = null; this.errorPost = null; this.listoPost = false;
    // antialiasing (R-3): por calidad, o forzado con ?aa= y ?msaa= para comparar
    const aaU = URLR.get('aa'), msU = URLR.get('msaa');
    this.msaa = msU != null ? +msU : aaU && aaU !== 'msaa' ? 0 : c.msaa;
    this.tipoAA = aaU ? (aaU === 'msaa' || aaU === 'ninguno' ? null : aaU) : (c.aa === 'msaa' ? null : c.aa);
    const nU = URLR.get('nitidez'); this.fuerzaNitidez = nU != null ? +nU : c.nitidez;
    this.aa = (this.msaa ? 'MSAA ' + this.msaa + 'x' : 'sin MSAA') + (this.tipoAA ? ' + ' + this.tipoAA.toUpperCase() : '') + (this.revZ ? ' · revZ' : '');
    if (c.post) {
      try { this.post = this.armarPost(c.post); this.listoPost = true; }
      catch (e) { console.warn('postproceso no disponible:', e); this.errorPost = String(e); this.post = null; }
    }
    this.ajustar();
  }

  armarPost(tipo) {
    const w = innerWidth, h = innerHeight;
    // render target propio: MSAA (samples) y profundidad float de 32 bits (la necesita la profundidad invertida para servir de algo)
    const pr = this.renderer.getPixelRatio(), W = Math.max(1, Math.round(w * pr)), H = Math.max(1, Math.round(h * pr));
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: this.msaa,
      depthTexture: new THREE.DepthTexture(W, H, THREE.FloatType) });
    rt.texture.name = 'EffectComposer.rt1'; rt.resolveDepthBuffer = false;
    const comp = new EffectComposer(this.renderer, rt);
    comp.addPass(new RenderPass(this.escena, this.camara));
    { const rp = new RenderPass(this.aparte, this.camara); rp.clear = false; this.pasoAparte = rp; comp.addPass(rp); }
    if (tipo === 'baja') { this.mitadAO = false; return this.cerrarPost(comp); }
    const ao = new GTAOPass(this.escena, this.camara, w, h);
    // la oclusión ambiental oscurecía y desenfocaba las gaussianas de Idol (no tienen normales reales): apagada salvo con ?ao
    ao.enabled = location.search.includes('ao=1');
    ao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1, thickness: 1, scale: 1 });
    ao.blendIntensity = tipo === 'ultra' ? 0.9 : 0.7;
    comp.addPass(ao); this.ao = ao;
    if (tipo === 'ultra') {
      // el cielo (Sky) entrega valores de luz altísimos: sin tope, el bloom los esparcía y la pantalla se iba a blanco (12-11-2026)
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.14, 0.3, 1.0);
      const mf = bloom.materialHighPassFilter;
      mf.fragmentShader = mf.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = min( texture2D( tDiffuse, vUv ), vec4( 1.15 ) );');
      mf.needsUpdate = true;
      comp.addPass(bloom); this.bloom = bloom;
    }
    this.mitadAO = tipo !== 'ultra';
    return this.cerrarPost(comp);
  }

  // salida (tono y sRGB) + antialiasing de postproceso + realce de nitidez; Baja llega aquí sin oclusión ni bloom
  cerrarPost(comp) {
    comp.addPass(new OutputPass());
    if (this.tipoAA === 'smaa') comp.addPass(new SMAAPass(innerWidth, innerHeight));
    else if (this.tipoAA === 'fxaa') { const fx = new ShaderPass(FXAAShader); this.fxaa = fx; comp.addPass(fx); }
    // realce de nitidez: era para las gaussianas (0,45-0,55); con mallas solo agrandaba los dientes y el chispeo de bordes finos
    if (this.fuerzaNitidez > 0) { this.nitidez = new ShaderPass(Nitidez); this.nitidez.uniforms.fuerza.value = this.fuerzaNitidez; comp.addPass(this.nitidez); }
    return comp;
  }

  ajustar() {
    if (!this.renderer) return;
    const w = innerWidth, h = (visualViewport && visualViewport.height) || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h; this.camara.updateProjectionMatrix();
    if (this.post) {
      const pr = this.renderer.getPixelRatio();
      this.post.setPixelRatio(pr); this.post.setSize(w, h);
      if (this.ao && this.mitadAO) this.ao.setSize(w * pr / 2, h * pr / 2);
      if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
      if (this.nitidez) this.nitidez.uniforms.resolucion.value.set(w * pr, h * pr);
    }
  }

  // el sol sigue al jugador para que la sombra cubra lo que se ve
  // R-3: el centro se ancla a la grilla de texeles del mapa de sombras (en los ejes de la cámara del sol): si se corre una fracción
  // de texel, todos los bordes de sombra cambian de escalón cada cuadro y «hierven» al caminar
  seguirSol(p) {
    const c = CALIDADES[this.calidad], d = this.dirSol;
    let q = p;
    if (URLR.get('anclasol') !== '0') {
      const tx = 2 * c.alcanceSombra / c.sombras;
      const ex = (this._ex ||= new THREE.Vector3()).set(d.z, 0, -d.x).normalize();   // (0,1,0) × dir, como la cámara del sol (up = Y)
      const ey = (this._ey ||= new THREE.Vector3()).crossVectors(d, ex);
      const a = Math.round(p.dot(ex) / tx) * tx, b = Math.round(p.dot(ey) / tx) * tx, z = p.dot(d);
      q = (this._q ||= new THREE.Vector3()).copy(ex).multiplyScalar(a).addScaledVector(ey, b).addScaledVector(d, z);
    }
    this.sol.target.position.copy(q);
    this.sol.position.copy(q).addScaledVector(d, 160);
  }

  // M-MOVIL: ajustes del perfil Móvil por cuadro (sombra cada N cuadros, niebla antes del corte, resolución automática)
  movilCuadro() {
    const c = CALIDADES[this.calidad];
    if (!c.pixelTope) return;
    this.cuadroN++;
    this.renderer.shadowMap.autoUpdate = false;
    if (this.cuadroN % (c.sombraCada || 1) === 0) this.renderer.shadowMap.needsUpdate = true;
    const f = this.escena.fog;
    if (f && f.isFog && f.far > this.lejos * 0.97) { f.userData = { near: f.near, far: f.far }; f.far = this.lejos * 0.97; f.near = Math.min(f.near, f.far * 0.45); }
    // resolución automática para sostener 30 fps
    const t = performance.now();
    if (!this.tMov) this.tMov = { t0: t, n: 0, lento: 0 };
    const m = this.tMov; m.n++;
    (m.dts ||= []).push(t - (m.tu || t)); m.tu = t;
    if (t - m.t0 >= 1000) {
      // mediana del cuadro (no el promedio): los tirones de carga (un cuadro de 400 ms al entrar a una sala) no bajan la resolución
      const d = m.dts.sort((a, b) => a - b), med = d[d.length >> 1] || 16.7, fps = 1000 / Math.max(1, med);
      m.t0 = t; m.n = 0; m.dts = []; this.fpsMovil = Math.round(Math.min(fps, 240));
      m.lento = fps < 26 && this.cuadroN > 300 ? m.lento + 1 : 0;   // los primeros ~300 cuadros (carga y asentamiento del LoD) no cuentan
      if (m.lento >= 5 && !URLR.has('fijo')) {
        m.lento = 0;
        const pasos = [1.5, 1.25, 1, 0.8], i = pasos.findIndex(p => p < this.escalaMovil - 0.01);
        if (i >= 0) { this.escalaMovil = pasos[i]; this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.escalaMovil)); this.ajustar(); console.info('Móvil: resolución ×' + this.escalaMovil); }
        else if (!this.sinSombraMovil) { this.sinSombraMovil = true; this.sol.castShadow = false; console.info('Móvil: sin sombras'); }
      }
    }
  }

  // N1-RENDIMIENTO (15-11): presupuesto de luces puntuales en el exterior. Cada luz puntual visible suma su cálculo de luz en CADA píxel de
  // CADA material estándar de la pantalla (three no recorta luces por objeto): en el N1 eran 10 (fogatas, faroles, horno, dos en 0) y
  // costaban 3-7 ms de GPU en la integrada. Quedan encendidas las LUCES_MAX con su zona de alcance más cerca de la cámara (distancia a
  // la cámara menos su alcance); las demás salen de la lista con la capa 31 (no se tocan .visible ni .intensity, que maneja el juego).
  // Las luces en 0 van al final (solo rellenan si faltan). El número de luces activas queda fijo: no se recompilan los sombreadores.
  // Dentro de las salas no se aplica (la luz de los interiores es a medida). ?luces=0 lo apaga; ?luces=N cambia el tope.
  // TIRONES-MOVIL (17-11-2026): dentro de una sala las luces puntuales de AFUERA (a 3-6 km: no alumbran nada) seguían contando en los
  // sombreadores de la sala; y como esta revisión corre cada 10 cuadros, la cuenta de luces cambiaba DESPUÉS de compilarSala y todo se
  // recompilaba en sincronía con la luz ya encendida (tirones de 0,3-0,7 s al entrar y al salir, en el celular). Ahora dentro de una sala
  // solo cuentan las de la sala y la de Nato, y cruzarPuerta / el armado previo la llaman con forzar = true justo antes de compilar.
  presupuestoLuces(forzar) {
    const tope = this._t ?? (URLR.get('luces') != null ? +URLR.get('luces') : 5);
    if ((this._nLuz = (this._nLuz || 0) + 1) % 10 !== 1 && !forzar) return;
    const M = globalThis.JUEGO && globalThis.JUEGO.M, dentro = !M || !!M.salaActual || !tope;
    const sala = M && M.salaActual && M.R && M.R.salas[M.salaActual], deSala = l => { for (let x = l; x; x = x.parent) if (x === sala.grupo || (M.jug && (x === M.jug.malla || x === M.jug.brillo))) return true; return false; };
    const capa = (this._capaLuz ||= new WeakMap()), todas = [], cp = this.camara.position, w = (this._wLuz ||= new THREE.Vector3());
    const vis = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
    this.escena.traverse(o => { if (o.isPointLight || o.isSpotLight) todas.push(o); });
    const cand = [];
    for (const l of todas) {
      if (!capa.has(l)) capa.set(l, l.layers.mask);
      if (sala && sala.grupo && !deSala(l)) { l.layers.set(31); continue; }   // TIRONES-MOVIL: luz de afuera estando en una sala
      if (dentro || !vis(l)) { l.layers.mask = capa.get(l); continue; }
      l.getWorldPosition(w); cand.push([(l.intensity > 0 ? 0 : 1e6) + (l.distance > 0 ? Math.max(0, w.distanceTo(cp) - l.distance) : 0), l]);   // las en 0 al final: solo rellenan para que el número no cambie
    }
    cand.sort((a, b) => a[0] - b[0] || b[1].intensity - a[1].intensity);
    cand.forEach(([, l], i) => { if (i < tope) l.layers.mask = capa.get(l); else l.layers.set(31); });
  }

  // MOVIL (M-MOVIL-DIBUJO, 16-11-2026): recorte de lo chico y lejano. En el N1 con la calidad Móvil, el 38 % de las ~880 mallas
  // dentro de la distancia de dibujo medía menos de 4 px de radio en pantalla y cada una costaba una llamada de dibujo (la CPU de un
  // celular es lo que más sufre: ~500 llamadas por cuadro). Cada 15 cuadros se buscan las mallas cuya esfera envolvente se ve con
  // menos de RECORTE_PX px de radio; SOLO mientras se dibuja pasan a la capa 31 (no se tocan .visible ni las capas que usa el juego
  // en su lógica, y los rayos de la lógica las siguen viendo). Terreno, cordillera, cielo y personajes con esqueleto no se recortan.
  // ?recorte=0 lo apaga; ?recorte=N cambia el umbral.
  recorteMovil(poner) {
    if (!CALIDADES[this.calidad].pixelTope || URLR.get('recorte') === '0') return;
    if (!poner) { const L = this.recorte; if (L) for (let i = 0; i < L.length; i += 2) L[i].layers.mask = L[i + 1]; return; }
    if (!this._recN || ++this._recN > 15) {
      this._recN = 1;
      const C = this.camara, cp = C.position, k = this.renderer.domElement.height / 2 / Math.tan(C.fov * Math.PI / 360), umbral = +(URLR.get('recorte') || 4);
      const v = (this._rv ||= new THREE.Vector3()), L = this._recL = [];
      this.escena.traverse(o => {
        if (!o.isMesh || o.isSkinnedMesh || o.name === 'terreno' || o.name === 'cordillera' || o.name === 'cielo' || /Splat|Spark/.test(o.constructor.name)) return;
        // MINA-MOVIL (17-11-2026): lo que trae onBeforeRender o frustumCulled = false es un controlador (el de la luz de la mina es una caja
        // de 1 cm): recortado, su onBeforeRender no corría y la mina Fortuna quedaba sin luz horneada ni faroles (negra en el celular)
        if (o.frustumCulled === false || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
        const g = o.geometry; if (!g || !g.attributes || !g.attributes.position) return;
        const bs = o.isInstancedMesh ? (o.boundingSphere || (o.computeBoundingSphere(), o.boundingSphere)) : (g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere));
        if (!bs || !(bs.radius > 0)) return;
        const r = bs.radius * o.matrixWorld.getMaxScaleOnAxis(), d = v.copy(bs.center).applyMatrix4(o.matrixWorld).distanceTo(cp) - r;
        if (d > 0 && r / d * k < umbral) L.push(o);
      });
    }
    const L = this._recL || [], G = this.recorte = [];
    for (const o of L) { G.push(o, o.layers.mask); o.layers.mask = 1 << 31; }
  }

  // TIRONES-MOVIL (17-11-2026): precalentador de sombreadores. En el celular cada material que se veía por primera vez (utilería y gente
  // que llegan después de la carga, kits, la ciudad viva) se compilaba en el mismo cuadro: getProgramParameter esperaba el enlace del
  // programa (0,1-0,7 s en el iPhone emulado con CPU 4x). Cada 1 s se buscan, entre lo visible, los materiales sin programa y se compilan
  // de a pocos por cuadro (renderer.compile con una raíz falsa: crea el programa y el enlace sigue en paralelo en la GPU, sin esperar);
  // cuando se dibujan ya están listos. Además, una vez por nivel y estando afuera, se precompila la variante «a render target» de la
  // ciudad que usan las vistas de las ventanas (vistaVentanas): antes se compilaba entera en el cuadro de la puerta (0,3-0,8 s).
  // Solo en Móvil (?precalentar=1 lo prende en PC, ?precalentar=0 lo apaga). Presupuesto ~6 ms por cuadro.
  precalentar() {
    const pU = URLR.get('precalentar');
    if (pU === '0' || (!CALIDADES[this.calidad].pixelTope && pU !== '1')) return;
    const J = globalThis.JUEGO, M = J && J.M;
    if (!M || J.escena !== 'juego' || M.cruzando || !(J.cargando && J.cargando.listo)) return;
    const P = this._precal ||= { cola: [], tex: [], t: 0, lote: 8, raiz: new THREE.Object3D(), rt: null, M: null, rtHecho: false, n: 0, ms: 0, salas: new WeakSet() };
    if (P.M !== M) { P.M = M; P.cola.length = 0; P.tex.length = 0; P.rtHecho = false; P.modo = null; }
    const ahora = performance.now(), props = this.renderer.properties, objeto = o => (o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.material && !/Splat|Spark/.test(o.constructor.name);
    // texturas de la sala que se va a ver: de a una por cuadro (la subida a la GPU no cae toda en el cuadro de la puerta)
    if (P.tex.length && (J.fps || 60) >= 20) { const t = P.tex.pop(); try { if (!props.get(t).__webglInit && t.image) this.renderer.initTexture(t); } catch (e) { /* otra API */ } }
    if (!P.cola.length) {
      P.modo = null;
      if (ahora - P.t < 1000) return; P.t = ahora;
      // CAPACHO-MOVIL (17-11-2026, «frenada saliendo del capacho»): renderer.compile no sube texturas. Lo que entraba al cuadro por
      // primera vez (rocas, coirón y utilería del andén B al bajarse del capacho: 25 texturas y 65 geometrías) las subía todas en
      // ese cuadro. Ahora, en el mismo recorrido, las texturas aún no subidas de lo que está a < 120 m de Nato van a la cola de a
      // una por cuadro (en el viaje en capacho, que es tranquilo, queda listo lo del andén de llegada y la bocamina).
      const ok = P.matOk ||= new WeakSet(), tx = new Set(), jp = !P.tex.length && M.jug && M.jug.pos, c = new THREE.Vector3();
      const pend = t => t && t.isTexture && t.image && !t.isRenderTargetTexture && !t.isVideoTexture && !props.get(t).__webglInit;
      const cerca = o => { if (!jp) return false; const bs = o.boundingSphere || (o.geometry && o.geometry.boundingSphere); if (!bs) { o.getWorldPosition(c); return Math.hypot(c.x - jp.x, c.z - jp.z) < 120; }
        c.copy(bs.center).applyMatrix4(o.matrixWorld); return Math.hypot(c.x - jp.x, c.z - jp.z) - bs.radius * o.matrixWorld.getMaxScaleOnAxis() < 120; };
      this.escena.traverseVisible(o => { if (!objeto(o)) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
        if (ms.some(m => !props.get(m).currentProgram)) P.cola.push(o);
        let lejos = null;
        if (jp) for (const m of ms) { if (ok.has(m)) continue; let falta = false;
          for (const k in m) { const t = m[k]; if (!pend(t)) continue; falta = true; if (lejos === null) lejos = !cerca(o); if (!lejos) tx.add(t); }
          if (m.uniforms) for (const k in m.uniforms) { const t = m.uniforms[k] && m.uniforms[k].value; if (!pend(t)) continue; falta = true; if (lejos === null) lejos = !cerca(o); if (!lejos) tx.add(t); }
          if (!falta) ok.add(m); } });
      if (tx.size) { P.tex.push(...tx); P.texCerca = (P.texCerca || 0) + tx.size; }
      if (P.cola.length) P.lote = 1;
      if (P.cola.length || tx.size) return;
      // sala cercana (a < 22 m de su puerta; las genéricas, ya armadas de antemano): sus sombreadores con la luz de adentro y sus texturas
      if (!M.salaActual && M.R && M.jug) {
        const j = M.jug.pos; let id = null, dm = 22;
        for (const p of M.R.puertas || []) { const s = M.R.salas[p.sala]; if (p.lado === 'salida' || p.cerrada || !s || !s.grupo || P.salas.has(s)) continue; const d = Math.hypot(j.x - p.x, j.z - p.z); if (d < dm && Math.abs((M.jug.pie ?? j.y) - (p.y || 0)) < 4) { dm = d; id = p.sala; } }
        if (id) { const s = M.R.salas[id]; P.salas.add(s); P.modo = 'sala'; P.lote = 1; P.sala = id; P.salaObj = s; P.primera = true;
          const tx = new Set(); s.grupo.traverse(o => { if (!objeto(o)) return; P.cola.push(o); for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k in m) { const t = m[k]; if (t && t.isTexture && t.image && !t.isRenderTargetTexture && !props.get(t).__webglInit) tx.add(t); } });
          // y lo de afuera a < 60 m de la puerta: el cubo de las ventanas lo dibuja aunque nunca se haya visto (texturas de una vez: 0,2-0,5 s)
          const pu = (M.R.puertas || []).find(q => q.sala === id && q.lado !== 'salida'), w = new THREE.Vector3();
          if (pu) this.escena.traverseVisible(o => { if (!objeto(o) || o.isSkinnedMesh) return; o.getWorldPosition(w); if (Math.hypot(w.x - pu.x, w.z - pu.z) > 60) return;
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k in m) { const t = m[k]; if (t && t.isTexture && t.image && !t.isRenderTargetTexture && !props.get(t).__webglInit) tx.add(t); } });
          P.tex.push(...tx); return; }
      }
      if (!P.rtHecho && !M.salaActual && URLR.get('ventanas') !== '0') {   // la ciudad tal como la ve el cubo de las ventanas
        P.rtHecho = true; P.modo = 'rt'; P.lote = 1; P.rt ||= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
        this.escena.traverseVisible(o => { if (objeto(o)) P.cola.push(o); });
      }
      return;
    }
    if (P.modo && M.salaActual) { P.cola.length = 0; if (P.modo === 'rt') P.rtHecho = false; P.modo = null; return; }   // entró a una sala: lo de afuera se retoma al salir
    if (P.modo === 'sala' && M.R.salas[P.sala] !== P.salaObj) { P.cola.length = 0; P.modo = null; return; }   // la sala se desarmó
    const R = P.raiz, t0 = performance.now(); R.children.length = 0;
    for (let n = 0; n < P.lote && P.cola.length;) { const o = P.cola.pop(); if (o.parent) { R.children.push(o); n++; } }
    const np0 = (this.renderer.info.programs || []).length;
    const rt0 = this.renderer.getRenderTarget(), esc = this.escena, niebla = esc.fog, S = P.modo === 'sala' ? P.salaObj : null, visS = S && S.grupo.visible;
    try {
      if (P.modo === 'rt') this.renderer.setRenderTarget(P.rt);
      if (S) {   // como compilarSala al entrar: sala visible, sin niebla, la cuenta de luces de adentro
        esc.fog = null; M.salaActual = P.sala; S.grupo.visible = true; this.presupuestoLuces(true);
        if (P.primera) { P.primera = false; if (this.luzMinaSoloSala(S.grupo, esc)) S.grupo.traverse(o => { if (o.userData.luzMina) o.userData.luzMina(S.grupo); }); }
      }
      this.renderer.compile(R, this.camara, esc);
    }
    catch (e) { P.cola.length = 0; }
    finally {
      if (P.modo === 'rt') this.renderer.setRenderTarget(rt0);
      if (S) { M.salaActual = null; esc.fog = niebla; S.grupo.visible = visS; this.presupuestoLuces(true); }
      R.children.length = 0;
    }
    const dt = performance.now() - t0; P.n++; P.ms += dt;
    // el enlace de los programas nuevos corre en la GPU, pero la próxima consulta síncrona del cuadro lo espera: ≤ 3 programas nuevos por cuadro
    const nuevos = (this.renderer.info.programs || []).length - np0;
    // CAPACHO-MOVIL: el lote crecía hasta 64 con lo barato (ya compilado) y la sala Fortuna (a < 22 m de la bocamina, con el paseo en
    // vagoneta) estrenaba 16-21 programas en un solo cuadro (0,4-0,7 s esperando el enlace). Ahora crece solo mientras no aparezcan
    // programas nuevos y, en cuanto aparecen, baja a 1 objeto por cuadro (≤ 1-2 enlaces por cuadro)
    P.lote = nuevos >= 2 || dt > 10 ? 1 : nuevos === 0 && dt < 4 ? Math.min(64, P.lote * 2) : P.lote;
  }

  // CAPACHO-MOVIL (17-11-2026): la luz horneada de la mina (mina.js, conLuzMina) cambia el sombreador de cada material que toca. El
  // precalentador la aplicaba a 22 m de la bocamina con la escena entera, y los rieles y durmientes de afuera (materiales compartidos
  // con la sala Fortuna) se recompilaban de golpe en el cuadro siguiente: 12-21 programas, 0,15-0,7 s. Ahora solo la sala: sus
  // objetos con un material que también se usa afuera reciben una copia (mismo sombreador base y texturas), así afuera nada cambia
  // hasta entrar (compilarSala la aplica a todo, detrás del fundido). Devuelve true si la sala tiene luz de mina.
  luzMinaSoloSala(grupo, esc) {
    let hay = false; grupo.traverse(o => { if (o.userData.luzMina) hay = true; }); if (!hay) return false;
    const deSala = new Set(), fuera = new Set(), copias = new Map(); grupo.traverse(o => deSala.add(o));
    esc.traverse(o => { if (!deSala.has(o) && o.material) for (const m of [].concat(o.material)) fuera.add(m); });
    const copia = m => { if (!fuera.has(m) || m.userData.minaLuz || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return m;
      let c = copias.get(m); if (!c) { c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; c.name = m.name; copias.set(m, c); } return c; };
    grupo.traverse(o => { if (!o.material || !(o.isMesh || o.isSkinnedMesh) || o.isSprite) return; o.material = Array.isArray(o.material) ? o.material.map(copia) : copia(o.material); });
    return true;
  }

  dibujar() {
    this.movilCuadro();
    this.presupuestoLuces();
    lodPielCuadro(this.camara, this.renderer.domElement.height);
    lodMallasCuadro(this.escena, this.camara, this.renderer.domElement.height);
    if (this.post) {
      if (this.pasoAparte) this.pasoAparte.enabled = this.aparte.children.length > 1;
      try { this.post.render(); this.precalentar(); return; }
      catch (e) { console.warn('falló el postproceso, se apaga:', e); this.errorPost = String(e); this.post = null; }
    }
    this.recorteMovil(true);   // MOVIL
    try { this.renderer.render(this.escena, this.camara); } finally { this.recorteMovil(false); }   // MOVIL: las capas vuelven aunque falle el dibujo
    if (this.aparte.children.length > 1) { const ac = this.renderer.autoClear; this.renderer.autoClear = false; this.renderer.render(this.aparte, this.camara); this.renderer.autoClear = ac; }
    this.precalentar();   // TIRONES-MOVIL. CAPACHO-MOVIL: después de dibujar (antes iba al principio y el dibujo del mismo cuadro esperaba sus enlaces)
  }
}
