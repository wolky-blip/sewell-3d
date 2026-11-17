// P-PUBLICAR (14-11-2026): GLTFLoader que también abre mallas comprimidas (Draco o Meshopt) de la versión liviana (herramientas/publicar.sh).
// index.html redirige 'three/addons/loaders/GLTFLoader.js' a este archivo (importmap), así ningún otro js cambia.
// Con un .glb sin comprimir funciona igual que antes: el decodificador Draco (wasm) solo se baja si un archivo lo pide.
import { GLTFLoader as GLTFLoaderBase } from '../../lib/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../lib/three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from '../../lib/three/examples/jsm/libs/meshopt_decoder.module.js';
import { LoaderUtils } from 'three';
export * from '../../lib/three/examples/jsm/loaders/GLTFLoader.js';

let draco = null;
// MOVIL (M-MOVIL-PUB, 16-11-2026): en la calidad Móvil, cada .glb que tenga variante liviana (publicar/assets3d/movil.json, la escribe
// herramientas/publicar_movil.mjs: texturas 1024/512, geometría simplificada) se baja como <nombre>.movil.glb. principal.js llama
// ponerMallasMovil() al arrancar solo si la calidad es Móvil; en PC (o sin movil.json, como en el servidor de desarrollo) no cambia nada.
let MOVIL = null;
export function ponerMallasMovil(lista) { MOVIL = lista && lista.length ? new Set(lista) : null; }
export const mallasMovil = () => !!MOVIL;   // MOVIL: true si se están usando las variantes .movil.glb
// CACHE-MOVIL (16-11-2026): sin Service Worker (iPhone por http) js/motor/cacheMovil.js pone aquí su lector de IndexedDB: los .glb
// se leen de la caché del celular (o se bajan y se guardan) y se arman con parse(). Sin él (PC) todo sigue igual.
let CACHE_GLB = null;
export function ponerCacheGlb(f) { CACHE_GLB = f || null; }
export const rutaMovil = u => urlMovil(u);
function urlMovil(url) {
  if (!MOVIL || typeof url !== 'string') return url;
  const i = url.indexOf('assets3d/'), rel = i >= 0 ? url.slice(i).split(/[?#]/)[0] : null;
  return rel && MOVIL.has(rel) ? url.replace(/\.glb(?=[?#]|$)/, '.movil.glb') : url;
}
export class GLTFLoader extends GLTFLoaderBase {
  constructor(manager) {
    super(manager);
    this.setDRACOLoader(draco ||= new DRACOLoader().setDecoderPath(new URL('../../lib/three/examples/jsm/libs/draco/gltf/', import.meta.url).href));
    this.setMeshoptDecoder(MeshoptDecoder);
  }
  load(url, onLoad, onProgress, onError) {   // MOVIL
    const u = urlMovil(url);
    if (!CACHE_GLB || typeof u !== 'string' || !/\.glb(?=[?#]|$)/.test(u)) return super.load(u, onLoad, onProgress, onError);
    const abs = new URL((this.path || '') + u, document.baseURI).href, m = this.manager;   // CACHE-MOVIL: IndexedDB
    m.itemStart(abs);
    const fallo = e => { if (onError) onError(e); else console.error(e); m.itemError(abs); m.itemEnd(abs); };
    CACHE_GLB(abs).then(buf => this.parse(buf, this.resourcePath || LoaderUtils.extractUrlBase(abs), g => { onLoad(g); m.itemEnd(abs); }, fallo), fallo);
  }
}
