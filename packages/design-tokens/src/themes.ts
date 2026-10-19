/**
 * The seven Nucleus themes. Every theme follows the same restrained structure (owner decision 2026-10-19):
 *
 * - a neutral base (page, surfaces, text, hairlines) that is constant across themes — Signature alone has its own deep
 *   navy base, sampled from the live multiplierskraft.com/nucleus page;
 * - colour only where it earns attention: the brand gradient on emphasised headline words (`brand-1` → `brand-2` →
 *   `brand-3`), the primary fill (`accent-*`), the nucleus core material (`sphere-*`, `brand-glow`), the orbit nodes
 *   (`module-*`), rings and progress (`brand-*`), tag outlines (`accent-tag`) and the hub accent (`brand-gold`);
 * - status, data-visualisation and process-signal colours are shared by every theme, so meaning never changes.
 *
 * Palettes are exact sRGB values (hex), converted to OKLCH for the CSS output. Every value goes through the WCAG 2.2
 * contrast gate (contrast.ts) in light and dark mode; values that differ from a design mock-up were nudged to the
 * nearest colour that passes.
 */
import { fromHex, oklch, toGamut, type Oklch } from './color.ts';

export const THEME_IDS = ['horizon', 'signature', 'sapphire-tide', 'emerald-grove', 'saffron-ember', 'rose-quartz', 'platinum'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_MODES = ['light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** A mode preference: an explicit mode or "follow the operating system". */
export const MODE_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ModePreference = (typeof MODE_PREFERENCES)[number];

/** First-time visitors get Signature in dark mode (owner decision 2026-10-19); a viewer's own choice persists. */
export const DEFAULT_THEME_ID: ThemeId = 'signature';
export const DEFAULT_MODE_PREFERENCE: ModePreference = 'dark';

/** Themes viewers may pick (all seven are approved), in switcher order. */
export const APPROVED_THEME_IDS = THEME_IDS;

/** Every semantic colour token (CSS name without the `--color-` prefix). */
export const COLOR_TOKEN_NAMES = [
  'bg',
  'surface',
  'surface-raised',
  'surface-sunken',
  'overlay',
  'text-primary',
  'text-secondary',
  'text-muted',
  'text-inverse',
  'text-on-accent',
  'border-subtle',
  'border-default',
  'border-strong',
  'border-focus',
  'accent-default',
  'accent-hover',
  'accent-active',
  'accent-subtle',
  'accent-text',
  'success',
  'success-wash',
  'success-text',
  'success-on',
  'warning',
  'warning-wash',
  'warning-text',
  'warning-on',
  'danger',
  'danger-wash',
  'danger-text',
  'danger-on',
  'info',
  'info-wash',
  'info-text',
  'info-on',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
  'chart-7',
  'chart-8',
  'shadow',
  // Marketing and brand surfaces (landing page): gradient stops, glow, tag outline, hub accent, glass, contact shadow.
  'brand-1',
  'brand-2',
  'brand-3',
  'brand-glow',
  'brand-gold',
  'accent-tag',
  'glass',
  'contact-shadow',
  // Stage: an always-dark media panel (film poster, video frame) and the text on it.
  'stage',
  'stage-2',
  'stage-text',
  // Orbit node identity colours (derived from each theme's accents, always paired with a label).
  'module-sky',
  'module-violet',
  'module-emerald',
  'module-amber',
  'module-rose',
  'module-indigo',
  'module-cyan',
  // Process signals: pending (manual, needs chasing) and resolved (automated), each with wash and text.
  'signal-pending',
  'signal-pending-wash',
  'signal-pending-text',
  'signal-resolved',
  'signal-resolved-wash',
  'signal-resolved-text',
  // Lit sphere (the Nucleus core): specular, inner light, body and depth.
  'sphere-specular',
  'sphere-light',
  'sphere-body',
  'sphere-mid',
  'sphere-deep',
] as const;

export type ColorTokenName = (typeof COLOR_TOKEN_NAMES)[number];
export type ColorSet = Readonly<Record<ColorTokenName, Oklch>>;

type Palette = Readonly<Partial<Record<ColorTokenName, string>>>;

export interface ThemeSpec {
  readonly id: ThemeId;
  /** English display name; the UI shows the translated name from the theming catalog. */
  readonly displayName: string;
  readonly description: string;
  /** Exact sRGB values per mode: the base plus the theme's accents. */
  readonly palette: Readonly<Record<ThemeMode, Palette>>;
}

/* ── Neutral bases ───────────────────────────────────────────────────────────────────────────────────────────── */

/** The constant neutral base (Horizon's): near-black ink / cool paper, translucent hairlines. */
const NEUTRAL: Readonly<Record<ThemeMode, Palette>> = {
  dark: {
    bg: '#030712',
    surface: '#111827',
    'surface-raised': '#172033',
    'surface-sunken': '#02040b',
    overlay: '#030712b3',
    'text-primary': '#f9fafb',
    'text-secondary': '#a5b0c4',
    'text-muted': '#7f889e',
    'text-inverse': '#0b1020',
    'border-subtle': '#ffffff0f',
    'border-default': '#ffffff1f',
    'border-strong': '#6b7489',
    shadow: '#00000099',
    glass: '#1118279e',
    'contact-shadow': '#00000099',
  },
  light: {
    bg: '#f7f8fc',
    surface: '#ffffff',
    'surface-raised': '#ffffff',
    'surface-sunken': '#eef1f8',
    overlay: '#0b10207a',
    'text-primary': '#0b1020',
    'text-secondary': '#4a5470',
    'text-muted': '#636d83',
    'text-inverse': '#f7f8fc',
    'border-subtle': '#0f172a0f',
    'border-default': '#0f172a1f',
    'border-strong': '#7c859c',
    shadow: '#1e295029',
    glass: '#ffffffcc',
    'contact-shadow': '#1e295047',
  },
};

/** Signature's base: the deep navy and warm white of the live multiplierskraft.com/nucleus page (light: warm paper). */
const NAVY: Readonly<Record<ThemeMode, Palette>> = {
  dark: {
    bg: '#060915',
    surface: '#0c1023',
    'surface-raised': '#131831',
    'surface-sunken': '#02040e',
    overlay: '#060915b3',
    'text-primary': '#f7f5ef',
    'text-secondary': '#b2b7c5',
    'text-muted': '#868c9f',
    'text-inverse': '#0c111f',
    'border-subtle': '#ffffff0f',
    'border-default': '#ffffff1f',
    'border-strong': '#6e7488',
    shadow: '#00000099',
    glass: '#0c10239e',
    'contact-shadow': '#00000099',
  },
  light: {
    bg: '#f8f7f3',
    surface: '#ffffff',
    'surface-raised': '#ffffff',
    'surface-sunken': '#efede6',
    overlay: '#0c111f7a',
    'text-primary': '#0c111f',
    'text-secondary': '#474e63',
    'text-muted': '#626a7c',
    'text-inverse': '#f8f7f3',
    'border-subtle': '#0c111f0f',
    'border-default': '#0c111f1f',
    'border-strong': '#7d8394',
    shadow: '#1e295029',
    glass: '#ffffffcc',
    'contact-shadow': '#1e295047',
  },
};

/** Media stage, process signals and the sphere's specular highlight: identical in every theme. */
const SHARED: Readonly<Record<ThemeMode, Palette>> = {
  dark: {
    stage: '#0b1230',
    'stage-2': '#05070f',
    'stage-text': '#dbe3f5',
    'signal-pending': '#fbbf24',
    'signal-pending-wash': '#2a2112',
    'signal-pending-text': '#fcd34d',
    'signal-resolved': '#2dd4bf',
    'signal-resolved-wash': '#0d2a2b',
    'signal-resolved-text': '#5eead4',
    'sphere-specular': '#ffffff',
  },
  light: {
    stage: '#0b1230',
    'stage-2': '#05070f',
    'stage-text': '#dbe3f5',
    'signal-pending': '#c26a04',
    'signal-pending-wash': '#fef3c7',
    'signal-pending-text': '#92400e',
    'signal-resolved': '#0d9488',
    'signal-resolved-wash': '#ccfbf1',
    'signal-resolved-text': '#115e59',
    'sphere-specular': '#ffffff',
  },
};

/* ── Accent families ─────────────────────────────────────────────────────────────────────────────────────────── */

interface Accents {
  /** Gradient stops (emphasis words, rings, progress). */
  readonly brand: readonly [string, string, string];
  /** Primary fill: default, hover, active, and the foreground on it. */
  readonly primary: readonly [string, string, string];
  readonly onPrimary: string;
  /** Selected-item wash, accent text (links, focus), tag outline/text. */
  readonly subtle: string;
  readonly text: string;
  readonly tag: string;
  /** Core glow and the hub accent. */
  readonly glow: string;
  readonly gold: string;
  /** Sphere material: inner light, body, mid, depth. */
  readonly sphere: readonly [string, string, string, string];
  /** Seven orbit node colours. */
  readonly nodes: readonly [string, string, string, string, string, string, string];
}

const NODE_TOKENS = ['module-sky', 'module-violet', 'module-emerald', 'module-amber', 'module-rose', 'module-indigo', 'module-cyan'] as const;

function accentPalette(accents: Accents): Palette {
  const [brand1, brand2, brand3] = accents.brand;
  const [fill, hover, active] = accents.primary;
  const [light, body, mid, deep] = accents.sphere;
  const nodes = Object.fromEntries(NODE_TOKENS.map((token, index) => [token, accents.nodes[index]]));
  return {
    'brand-1': brand1,
    'brand-2': brand2,
    'brand-3': brand3,
    'accent-default': fill,
    'accent-hover': hover,
    'accent-active': active,
    'text-on-accent': accents.onPrimary,
    'accent-subtle': accents.subtle,
    'accent-text': accents.text,
    'border-focus': accents.text,
    'accent-tag': accents.tag,
    'brand-glow': accents.glow,
    'brand-gold': accents.gold,
    'sphere-light': light,
    'sphere-body': body,
    'sphere-mid': mid,
    'sphere-deep': deep,
    ...nodes,
  };
}

function theme(id: ThemeId, displayName: string, description: string, base: Readonly<Record<ThemeMode, Palette>>, accents: Readonly<Record<ThemeMode, Accents>>): ThemeSpec {
  return {
    id,
    displayName,
    description,
    palette: {
      dark: { ...base.dark, ...SHARED.dark, ...accentPalette(accents.dark) },
      light: { ...base.light, ...SHARED.light, ...accentPalette(accents.light) },
    },
  };
}

export const THEME_SPECS: Readonly<Record<ThemeId, ThemeSpec>> = {
  horizon: theme('horizon', 'Horizon', 'Sky to indigo to violet on the neutral base; indigo primary actions.', NEUTRAL, {
    dark: {
      brand: ['#38bdf8', '#818cf8', '#c084fc'],
      primary: ['#6164f0', '#4f46e5', '#4338ca'],
      onPrimary: '#ffffff',
      subtle: '#1e1b4b',
      text: '#818cf8',
      tag: '#818cf8',
      glow: '#6366f1',
      gold: '#fbbf24',
      sphere: ['#a5f3fc', '#38bdf8', '#6366f1', '#1e1b4b'],
      nodes: ['#38bdf8', '#c084fc', '#34d399', '#fbbf24', '#fb7185', '#818cf8', '#22d3ee'],
    },
    light: {
      brand: ['#0284c7', '#4f46e5', '#9333ea'],
      primary: ['#4f46e5', '#4338ca', '#3730a3'],
      onPrimary: '#ffffff',
      subtle: '#e0e7ff',
      text: '#4f46e5',
      tag: '#4f46e5',
      glow: '#4f46e5',
      gold: '#b45309',
      sphere: ['#a5f3fc', '#38bdf8', '#6366f1', '#1e1b4b'],
      nodes: ['#38bdf8', '#c084fc', '#34d399', '#fbbf24', '#fb7185', '#818cf8', '#22d3ee'],
    },
  }),
  signature: theme('signature', 'Signature', 'The live MultipliersKraft look: deep navy, gold actions, a gold to lavender gradient and a teal core.', NAVY, {
    dark: {
      brand: ['#fad03e', '#ccc09e', '#9fb0ff'],
      primary: ['#fad03e', '#fcdb6b', '#e9bb22'],
      onPrimary: '#0c111f',
      subtle: '#2a2410',
      text: '#fad03e',
      tag: '#fad03e',
      glow: '#2dd4bf',
      gold: '#fad03e',
      sphere: ['#a5f3fc', '#2dd4bf', '#0891b2', '#0b2545'],
      nodes: ['#22d3ee', '#5cd5c7', '#67e8f9', '#2dd4bf', '#a5f3fc', '#38bdf8', '#5eead4'],
    },
    light: {
      brand: ['#9a6b00', '#7d6a6a', '#5b5bd6'],
      primary: ['#f2b705', '#e0a800', '#c99700'],
      onPrimary: '#0c111f',
      subtle: '#fdf3d0',
      text: '#835800',
      tag: '#835800',
      glow: '#0d9488',
      gold: '#a87400',
      sphere: ['#a5f3fc', '#2dd4bf', '#0891b2', '#0b2545'],
      nodes: ['#06b6d4', '#14b8a6', '#22d3ee', '#2dd4bf', '#0ea5e9', '#38bdf8', '#5eead4'],
    },
  }),
  'sapphire-tide': theme('sapphire-tide', 'Sapphire Tide', 'Deep blue to azure on the neutral base; a trusted corporate blue.', NEUTRAL, {
    dark: {
      brand: ['#3b82f6', '#0ea5e9', '#7dd3fc'],
      primary: ['#2563eb', '#1d4ed8', '#1e40af'],
      onPrimary: '#ffffff',
      subtle: '#172554',
      text: '#60a5fa',
      tag: '#60a5fa',
      glow: '#3b82f6',
      gold: '#fbbf24',
      sphere: ['#bae6fd', '#38bdf8', '#2563eb', '#172554'],
      nodes: ['#60a5fa', '#38bdf8', '#7dd3fc', '#93c5fd', '#22d3ee', '#818cf8', '#bae6fd'],
    },
    light: {
      brand: ['#1d4ed8', '#0369a1', '#0284c7'],
      primary: ['#1d4ed8', '#1e40af', '#1e3a8a'],
      onPrimary: '#ffffff',
      subtle: '#dbeafe',
      text: '#1d4ed8',
      tag: '#1d4ed8',
      glow: '#2563eb',
      gold: '#b45309',
      sphere: ['#bae6fd', '#38bdf8', '#2563eb', '#172554'],
      nodes: ['#3b82f6', '#0ea5e9', '#38bdf8', '#60a5fa', '#06b6d4', '#6366f1', '#7dd3fc'],
    },
  }),
  'emerald-grove': theme('emerald-grove', 'Emerald Grove', 'Forest to jade on the neutral base; calm and growth-minded.', NEUTRAL, {
    dark: {
      brand: ['#22c55e', '#10b981', '#5eead4'],
      primary: ['#15803d', '#166534', '#14532d'],
      onPrimary: '#ffffff',
      subtle: '#052e16',
      text: '#4ade80',
      tag: '#4ade80',
      glow: '#10b981',
      gold: '#fbbf24',
      sphere: ['#a7f3d0', '#34d399', '#059669', '#052e16'],
      nodes: ['#4ade80', '#34d399', '#6ee7b7', '#2dd4bf', '#a3e635', '#86efac', '#5eead4'],
    },
    light: {
      brand: ['#166534', '#047857', '#0f766e'],
      primary: ['#15803d', '#166534', '#14532d'],
      onPrimary: '#ffffff',
      subtle: '#dcfce7',
      text: '#166534',
      tag: '#166534',
      glow: '#059669',
      gold: '#b45309',
      sphere: ['#a7f3d0', '#34d399', '#059669', '#052e16'],
      nodes: ['#22c55e', '#10b981', '#34d399', '#14b8a6', '#84cc16', '#4ade80', '#2dd4bf'],
    },
  }),
  'saffron-ember': theme('saffron-ember', 'Saffron Ember', 'Saffron to marigold on the neutral base; warm and energetic.', NEUTRAL, {
    dark: {
      brand: ['#f97316', '#fb923c', '#fbbf24'],
      primary: ['#f59e0b', '#fbbf24', '#fcd34d'],
      onPrimary: '#1c1003',
      subtle: '#3b2306',
      text: '#fdba74',
      tag: '#fdba74',
      glow: '#f97316',
      gold: '#fbbf24',
      sphere: ['#fde68a', '#fbbf24', '#ea580c', '#431407'],
      nodes: ['#fb923c', '#fbbf24', '#f59e0b', '#fdba74', '#facc15', '#f97316', '#fcd34d'],
    },
    light: {
      brand: ['#c2410c', '#b45309', '#a16207'],
      primary: ['#c2410c', '#9a3412', '#7c2d12'],
      onPrimary: '#ffffff',
      subtle: '#ffedd5',
      text: '#c2410c',
      tag: '#9a3412',
      glow: '#ea580c',
      gold: '#a16207',
      sphere: ['#fde68a', '#fbbf24', '#ea580c', '#431407'],
      nodes: ['#f97316', '#f59e0b', '#ea580c', '#fb923c', '#eab308', '#d97706', '#fbbf24'],
    },
  }),
  'rose-quartz': theme('rose-quartz', 'Rose Quartz', 'Magenta to rose on the neutral base; bold and human.', NEUTRAL, {
    dark: {
      brand: ['#e879f9', '#f472b6', '#fda4af'],
      primary: ['#db2777', '#be185d', '#9d174d'],
      onPrimary: '#ffffff',
      subtle: '#500724',
      text: '#f9a8d4',
      tag: '#f9a8d4',
      glow: '#ec4899',
      gold: '#fbbf24',
      sphere: ['#fbcfe8', '#f472b6', '#c026d3', '#500724'],
      nodes: ['#f472b6', '#e879f9', '#fda4af', '#f9a8d4', '#c084fc', '#fb7185', '#fbcfe8'],
    },
    light: {
      brand: ['#a21caf', '#be185d', '#e11d48'],
      primary: ['#be185d', '#9d174d', '#831843'],
      onPrimary: '#ffffff',
      subtle: '#fce7f3',
      text: '#be185d',
      tag: '#be185d',
      glow: '#db2777',
      gold: '#b45309',
      sphere: ['#fbcfe8', '#f472b6', '#c026d3', '#500724'],
      nodes: ['#ec4899', '#d946ef', '#f43f5e', '#f472b6', '#a855f7', '#fb7185', '#e879f9'],
    },
  }),
  platinum: theme('platinum', 'Platinum', 'Slate to silver on the neutral base; the understated enterprise option.', NEUTRAL, {
    dark: {
      brand: ['#94a3b8', '#cbd5e1', '#e2e8f0'],
      primary: ['#e2e8f0', '#cbd5e1', '#94a3b8'],
      onPrimary: '#0b1020',
      subtle: '#1e293b',
      text: '#cbd5e1',
      tag: '#cbd5e1',
      glow: '#94a3b8',
      gold: '#fbbf24',
      sphere: ['#f1f5f9', '#cbd5e1', '#64748b', '#1e293b'],
      nodes: ['#cbd5e1', '#94a3b8', '#e2e8f0', '#a5b4c8', '#b6c2d1', '#8fa1b8', '#dbe3ec'],
    },
    light: {
      brand: ['#334155', '#475569', '#64748b'],
      primary: ['#1e293b', '#0f172a', '#020617'],
      onPrimary: '#ffffff',
      subtle: '#e2e8f0',
      text: '#334155',
      tag: '#334155',
      glow: '#64748b',
      gold: '#a16207',
      sphere: ['#f1f5f9', '#cbd5e1', '#64748b', '#1e293b'],
      nodes: ['#64748b', '#475569', '#94a3b8', '#334155', '#7c8ba1', '#52617a', '#a3b1c4'],
    },
  }),
};

/* ── Shared families (status, charts) ────────────────────────────────────────────────────────────────────────── */

const WHITE = oklch(1, 0, 0);

/** Status families: one hue each, identical in every theme so meaning never changes between tenants. */
const STATUS = {
  success: { hue: 150, chroma: 0.14 },
  warning: { hue: 70, chroma: 0.15 },
  danger: { hue: 27, chroma: 0.19 },
  info: { hue: 248, chroma: 0.15 },
} as const;

type StatusName = keyof typeof STATUS;

/**
 * Categorical data-visualisation hues (ordered for maximum neighbour separation, colour-vision-deficiency aware:
 * blue / orange first, then teal, magenta, green, violet, gold, red). Shared by every theme so a series keeps its
 * colour in exported reports regardless of the tenant's theme.
 */
const CHART_HUES = [
  { hue: 255, chroma: 0.16 },
  { hue: 50, chroma: 0.16 },
  { hue: 190, chroma: 0.12 },
  { hue: 340, chroma: 0.17 },
  { hue: 140, chroma: 0.15 },
  { hue: 295, chroma: 0.16 },
  { hue: 85, chroma: 0.13 },
  { hue: 20, chroma: 0.17 },
] as const;

/** In-gamut OKLCH. */
function color(l: number, c: number, h: number, alpha = 1): Oklch {
  return toGamut(oklch(l, c, h, alpha));
}

function statusSet(name: StatusName, mode: ThemeMode): Record<string, Oklch> {
  const { hue, chroma } = STATUS[name];
  if (mode === 'light') {
    const isWarning = name === 'warning';
    return {
      [name]: color(isWarning ? 0.78 : 0.52, chroma, hue),
      [`${name}-wash`]: color(0.962, chroma * 0.22, hue),
      [`${name}-text`]: color(isWarning ? 0.46 : 0.45, chroma * 0.85, hue),
      [`${name}-on`]: isWarning ? color(0.22, 0.04, hue) : WHITE,
    };
  }
  return {
    [name]: color(0.74, chroma * 0.9, hue),
    [`${name}-wash`]: color(0.29, chroma * 0.35, hue),
    [`${name}-text`]: color(0.84, chroma * 0.6, hue),
    [`${name}-on`]: color(0.2, 0.03, hue),
  };
}

function chartSet(mode: ThemeMode): Record<string, Oklch> {
  const entries = CHART_HUES.map(({ hue, chroma }, index) => [
    `chart-${index + 1}`,
    mode === 'light' ? color(0.56, chroma, hue) : color(0.74, chroma * 0.9, hue),
  ]);
  return Object.fromEntries(entries) as Record<string, Oklch>;
}

/** The full semantic colour set of one theme in one mode. Throws if the palette misses a token. */
export function deriveColors(spec: ThemeSpec, mode: ThemeMode): ColorSet {
  const set: Record<string, Oklch> = {
    ...statusSet('success', mode),
    ...statusSet('warning', mode),
    ...statusSet('danger', mode),
    ...statusSet('info', mode),
    ...chartSet(mode),
  };
  for (const [name, hex] of Object.entries(spec.palette[mode])) set[name] = fromHex(hex);
  for (const name of COLOR_TOKEN_NAMES) if (!set[name]) throw new Error(`${spec.id} ${mode}: missing colour token ${name}`);
  return set as ColorSet;
}

export interface ResolvedTheme {
  readonly spec: ThemeSpec;
  readonly colors: Readonly<Record<ThemeMode, ColorSet>>;
}

/** Every theme with both modes resolved. */
export function resolveThemes(): readonly ResolvedTheme[] {
  return THEME_IDS.map((id) => {
    const spec = THEME_SPECS[id];
    return { spec, colors: { light: deriveColors(spec, 'light'), dark: deriveColors(spec, 'dark') } };
  });
}
