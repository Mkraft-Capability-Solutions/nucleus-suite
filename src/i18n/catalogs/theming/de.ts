/** "theming" catalog, de. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Darstellung ändern",
    title: "Darstellung",
    themeLegend: "Design",
    modeLegend: "Modus",
  },
  modes: {
    light: "Hell",
    dark: "Dunkel",
    system: "System",
  },
  themes: {
    horizon: "Horizont",
    signature: "Signature",
    sapphireTide: "Saphirflut",
    emeraldGrove: "Smaragdhain",
    saffronEmber: "Safranglut",
    roseQuartz: "Rosenquarz",
    platinum: "Platin",
  },
  logo: {
    alt: "Logo von {name}",
  },
  branding: {
    errors: {
      themeId: "Wählen Sie eines der verfügbaren Designs.",
      defaultMode: "Wählen Sie den hellen, dunklen oder System-Modus.",
      displayName: "Geben Sie einen Anzeigenamen mit 1 bis {max} Zeichen ein.",
      logoType: "Laden Sie eine SVG- oder PNG-Datei hoch.",
      logoSize: "Das Logo darf höchstens {max} KB groß sein.",
      logoHeight: "Das Logo muss mindestens {min} Pixel hoch sein.",
      logoAspect: "Das Seitenverhältnis des Logos (Breite : Höhe) muss zwischen 1:1 und {max}:1 liegen.",
      logoUnsafe: "Diese SVG enthält Skripte oder externe Verweise und kann nicht verwendet werden.",
    },
  },
};

export default messages;
