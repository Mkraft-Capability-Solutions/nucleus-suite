/**
 * "theming" catalog, English source of truth. Theme switcher, brand logo and tenant branding validation.
 * Every other locale file must match this shape (type ThemingMessages); keys are camelCase segments.
 */
import type { MessageTree } from '../../catalog';

const messages = {
  switcher: {
    triggerLabel: "Change appearance",
    title: "Appearance",
    themeLegend: "Theme",
    modeLegend: "Mode",
  },
  modes: {
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  themes: {
    horizon: "Horizon",
    signature: "Signature",
    sapphireTide: "Sapphire Tide",
    emeraldGrove: "Emerald Grove",
    saffronEmber: "Saffron Ember",
    roseQuartz: "Rose Quartz",
    platinum: "Platinum",
  },
  logo: {
    alt: "{name} logo",
  },
  branding: {
    errors: {
      themeId: "Choose one of the available themes.",
      defaultMode: "Choose light, dark or system mode.",
      displayName: "Enter a display name of 1 to {max} characters.",
      logoType: "Upload an SVG or PNG file.",
      logoSize: "The logo must be {max} KB or smaller.",
      logoHeight: "The logo must be at least {min} pixels tall.",
      logoAspect: "The logo must be between 1:1 and {max}:1 (width to height).",
      logoUnsafe: "This SVG contains scripts or external references and cannot be used.",
    },
  },
} as const;

export type ThemingMessages = MessageTree<typeof messages>;
export default messages;
