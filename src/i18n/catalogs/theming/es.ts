/** "theming" catalog, es. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Cambiar apariencia",
    title: "Apariencia",
    themeLegend: "Tema",
    modeLegend: "Modo",
  },
  modes: {
    light: "Claro",
    dark: "Oscuro",
    system: "Sistema",
  },
  themes: {
    horizon: "Horizonte",
    signature: "Firma",
    sapphireTide: "Marea Zafiro",
    emeraldGrove: "Arboleda Esmeralda",
    saffronEmber: "Brasa Azafrán",
    roseQuartz: "Cuarzo Rosa",
    platinum: "Platino",
  },
  logo: {
    alt: "Logotipo de {name}",
  },
  branding: {
    errors: {
      themeId: "Elige uno de los temas disponibles.",
      defaultMode: "Elige el modo claro, oscuro o del sistema.",
      displayName: "Introduce un nombre visible de 1 a {max} caracteres.",
      logoType: "Sube un archivo SVG o PNG.",
      logoSize: "El logotipo debe ocupar {max} KB o menos.",
      logoHeight: "El logotipo debe medir al menos {min} píxeles de alto.",
      logoAspect: "La proporción del logotipo (ancho : alto) debe estar entre 1:1 y {max}:1.",
      logoUnsafe: "Este SVG contiene scripts o referencias externas y no se puede usar.",
    },
  },
};

export default messages;
