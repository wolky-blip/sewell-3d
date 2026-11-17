// Corrige la neblina azul que Idol hornea en las caras en sombra de sus modelos: modificador de Spark (dyno) que, solo con el COLOR,
// lleva las gaussianas oscuras y azuladas (azul > rojo, luminancia baja) a un gris cálido neutro. No toca posiciones, escalas ni opacidad.
// fuerza 0 = sin cambio; 1 = máxima. Por modelo: opción `azul` en EN_JUEGO (principal.js); global con ?azul=0.5 en la URL (azul=0 desactiva).
import { dyno } from '@sparkjsdev/spark';

const { Dyno, dynoBlock, Gsplat, dynoFloat } = dyno;
export const AZUL_DEFECTO = 1.0;
const URLP = new URLSearchParams(location.search);
const GLOBAL = URLP.has('azul') ? +URLP.get('azul') : null;

const sombreador = [
  '{',
  '  vec3 c = GS.rgba.rgb;',
  '  float lum = dot(c, vec3(0.299, 0.587, 0.114));',
  '  float azul = max(0.0, c.b - max(c.r, c.g * 0.92));          // exceso de azul sobre rojo y verde',
  '  float oscuro = 1.0 - smoothstep(0.30, 0.70, lum);            // más fuerza en lo oscuro',
  '  float w = clamp(azul * 10.0, 0.0, 1.0) * mix(0.45, 1.0, oscuro) * F;',
  '  vec3 neutro = vec3(lum * 1.10, lum * 0.97, lum * 0.84);      // gris cálido',
  '  OUT.rgba.rgb = mix(c, neutro, w);',
  '}',
];

export function corregirAzul(splat, fuerza) {
  const f = GLOBAL != null ? GLOBAL : (fuerza ?? AZUL_DEFECTO);
  if (!(f > 0)) return;
  const F = dynoFloat(f);
  splat.objectModifier = dynoBlock({ gsplat: Gsplat }, { gsplat: Gsplat }, ({ gsplat }) => {
    const d = new Dyno({
      inTypes: { gsplat: Gsplat, f: 'float' }, outTypes: { gsplat: Gsplat },
      statements: ({ inputs, outputs }) => [
        `${outputs.gsplat} = ${inputs.gsplat};`,
        ...sombreador.map(l => l.replaceAll('GS', inputs.gsplat).replaceAll('OUT', outputs.gsplat).replace(/\bF\b/g, inputs.f)),
      ],
    });
    return { gsplat: d.apply({ gsplat, f: F }).gsplat };
  });
  splat.updateGenerator();
}
