/**
 * WCAG 2.2 contrast requirements for every theme × mode. The build fails if any pair is below its minimum.
 *
 * Thresholds: 4.5:1 for text (SC 1.4.3), 3:1 for non-text UI such as focus rings, control borders and chart marks
 * (SC 1.4.11). Muted text is held to 4.5:1 as well (stricter than the 3:1 large-text allowance) so it is safe for
 * small meta text; only disabled controls are exempt, and they have no token.
 */
import { contrastRatio } from './color.ts';
import { resolveThemes, type ColorTokenName, type ThemeId, type ThemeMode } from './themes.ts';

export interface ContrastRule {
  readonly foreground: ColorTokenName;
  readonly background: ColorTokenName;
  readonly minimum: number;
  readonly purpose: string;
}

const TEXT = 4.5;
const NON_TEXT = 3;

const TEXT_SURFACES = ['bg', 'surface', 'surface-raised', 'surface-sunken'] as const satisfies readonly ColorTokenName[];

function onSurfaces(foreground: ColorTokenName, minimum: number, purpose: string): ContrastRule[] {
  return TEXT_SURFACES.map((background) => ({ foreground, background, minimum, purpose }));
}

const STATUS_NAMES = ['success', 'warning', 'danger', 'info'] as const;
const CHART_TOKENS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-7', 'chart-8'] as const;

export const CONTRAST_RULES: readonly ContrastRule[] = [
  ...onSurfaces('text-primary', TEXT, 'body text'),
  ...onSurfaces('text-secondary', TEXT, 'secondary text'),
  ...onSurfaces('text-muted', TEXT, 'muted / meta text'),
  ...onSurfaces('accent-text', TEXT, 'links and accent text'),
  { foreground: 'accent-text', background: 'accent-subtle', minimum: TEXT, purpose: 'selected item text' },
  { foreground: 'text-primary', background: 'accent-subtle', minimum: TEXT, purpose: 'text on accent wash' },
  { foreground: 'text-on-accent', background: 'accent-default', minimum: TEXT, purpose: 'primary button' },
  { foreground: 'text-on-accent', background: 'accent-hover', minimum: TEXT, purpose: 'primary button hover' },
  { foreground: 'text-on-accent', background: 'accent-active', minimum: TEXT, purpose: 'primary button pressed' },
  { foreground: 'text-inverse', background: 'text-primary', minimum: TEXT, purpose: 'inverse (tooltip) text' },
  ...onSurfaces('border-focus', NON_TEXT, 'focus ring'),
  { foreground: 'border-focus', background: 'accent-subtle', minimum: NON_TEXT, purpose: 'focus ring on wash' },
  ...onSurfaces('border-strong', NON_TEXT, 'form control boundary'),
  ...STATUS_NAMES.flatMap((name): ContrastRule[] => [
    { foreground: `${name}-text`, background: `${name}-wash`, minimum: TEXT, purpose: `${name} text on wash` },
    { foreground: `${name}-on`, background: name, minimum: TEXT, purpose: `${name} solid badge` },
    { foreground: `${name}-text`, background: 'surface', minimum: TEXT, purpose: `${name} text / icon on surface` },
    { foreground: `${name}-text`, background: 'bg', minimum: TEXT, purpose: `${name} text / icon on page` },
  ]),
  ...CHART_TOKENS.map((token): ContrastRule => ({ foreground: token, background: 'surface', minimum: NON_TEXT, purpose: 'chart mark' })),
  // Marketing: tag/kicker text uses accent-tag; gradient display words (≥ 40px, large text) span brand-1 → brand-3.
  { foreground: 'brand-2', background: 'bg', minimum: NON_TEXT, purpose: 'gradient display text (large)' },
  ...onSurfaces('accent-tag', TEXT, 'tag / pill text'),
  { foreground: 'brand-gold', background: 'bg', minimum: NON_TEXT, purpose: 'hub ring accent' },
  { foreground: 'brand-1', background: 'bg', minimum: NON_TEXT, purpose: 'gradient display text (large)' },
  { foreground: 'brand-3', background: 'bg', minimum: NON_TEXT, purpose: 'gradient display text (large)' },
  ...(['pending', 'resolved'] as const).flatMap((name): ContrastRule[] => [
    { foreground: `signal-${name}-text`, background: `signal-${name}-wash`, minimum: TEXT, purpose: `${name} badge text` },
    { foreground: `signal-${name}-text`, background: 'surface', minimum: TEXT, purpose: `${name} text on surface` },
    { foreground: `signal-${name}-text`, background: 'bg', minimum: TEXT, purpose: `${name} text on page` },
    { foreground: `signal-${name}`, background: 'bg', minimum: NON_TEXT, purpose: `${name} connector stroke` },
    { foreground: `signal-${name}`, background: 'surface', minimum: NON_TEXT, purpose: `${name} connector stroke` },
  ]),
  { foreground: 'stage-text', background: 'stage', minimum: TEXT, purpose: 'text on the media stage' },
  { foreground: 'stage-text', background: 'stage-2', minimum: TEXT, purpose: 'text on the media stage' },
];

export interface ContrastResult extends ContrastRule {
  readonly themeId: ThemeId;
  readonly mode: ThemeMode;
  readonly ratio: number;
  readonly pass: boolean;
}

/** Evaluate every rule for every theme and mode. */
export function evaluateContrast(): readonly ContrastResult[] {
  const results: ContrastResult[] = [];
  for (const theme of resolveThemes()) {
    for (const mode of ['light', 'dark'] as const) {
      const colors = theme.colors[mode];
      for (const rule of CONTRAST_RULES) {
        const ratio = contrastRatio(colors[rule.foreground], colors[rule.background]);
        results.push({ ...rule, themeId: theme.spec.id, mode, ratio, pass: ratio >= rule.minimum });
      }
    }
  }
  return results;
}
