/** "theming" catalog, fr. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Modifier l’apparence",
    title: "Apparence",
    themeLegend: "Thème",
    modeLegend: "Mode",
  },
  modes: {
    light: "Clair",
    dark: "Sombre",
    system: "Système",
  },
  themes: {
    horizon: "Horizon",
    signature: "Signature",
    sapphireTide: "Marée saphir",
    emeraldGrove: "Bosquet émeraude",
    saffronEmber: "Braise safran",
    roseQuartz: "Quartz rose",
    platinum: "Platine",
  },
  logo: {
    alt: "Logo de {name}",
  },
  branding: {
    errors: {
      themeId: "Choisissez l’un des thèmes disponibles.",
      defaultMode: "Choisissez le mode clair, sombre ou système.",
      displayName: "Saisissez un nom d’affichage de 1 à {max} caractères.",
      logoType: "Importez un fichier SVG ou PNG.",
      logoSize: "Le logo ne doit pas dépasser {max} Ko.",
      logoHeight: "Le logo doit mesurer au moins {min} pixels de haut.",
      logoAspect: "Le rapport largeur : hauteur du logo doit être compris entre 1:1 et {max}:1.",
      logoUnsafe: "Ce SVG contient des scripts ou des références externes et ne peut pas être utilisé.",
    },
  },
};

export default messages;
