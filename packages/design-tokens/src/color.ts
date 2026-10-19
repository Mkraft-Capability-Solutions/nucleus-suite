/**
 * OKLCH colour math for the token build: OKLCH → sRGB conversion, sRGB gamut mapping (chroma reduction at constant
 * lightness and hue), hex output for platforms without OKLCH support (React Native, e-mail, PDF), and WCAG 2.2
 * relative luminance / contrast ratio.
 *
 * Contrast is measured on the 8-bit sRGB value a browser actually paints (the hex), so the numbers match what an
 * auditor gets from any WCAG checker that samples rendered pixels.
 */

/** A colour in OKLCH: lightness 0..1, chroma 0..~0.37, hue in degrees, alpha 0..1. */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha: number;
}

/** Linear-light sRGB channels (0..1 when in gamut). */
interface LinearRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const GAMUT_EPSILON = 0.000_5;
const CHROMA_SEARCH_STEPS = 24;

/** Build an OKLCH colour. */
export function oklch(l: number, c: number, h: number, alpha = 1): Oklch {
  return { l, c, h, alpha };
}

function toLinearRgb(color: Oklch): LinearRgb {
  const hueRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hueRad);
  const b = color.c * Math.sin(hueRad);
  const lPrime = color.l + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const mPrime = color.l - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const sPrime = color.l - 0.089_484_177_5 * a - 1.291_485_548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  return {
    r: 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    g: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    b: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  };
}

function decodeChannel(channel8: number): number {
  const value = channel8 / 255;
  return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * Parse an sRGB hex colour (#rgb, #rrggbb or #rrggbbaa) into OKLCH. Used by themes whose palette is specified as exact
 * sRGB values (e.g. Horizon) rather than derived from an accent hue; the CSS output stays oklch().
 */
export function fromHex(hex: string): Oklch {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex);
  if (!match?.[1]) throw new Error(`Invalid hex colour: ${hex}`);
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];
  const channel = (index: number): number => Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16);
  const r = decodeChannel(channel(0));
  const g = decodeChannel(channel(1));
  const b = decodeChannel(channel(2));
  const alpha = digits.length === 8 ? channel(3) / 255 : 1;
  const l = Math.cbrt(0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b);
  const m = Math.cbrt(0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b);
  const s = Math.cbrt(0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b);
  const lightness = 0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s;
  const a = 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s;
  const bAxis = 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s;
  const chroma = Math.hypot(a, bAxis);
  const hue = chroma < 0.000_02 ? 0 : ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360;
  return { l: lightness, c: chroma < 0.000_02 ? 0 : chroma, h: hue, alpha };
}

function inGamut(rgb: LinearRgb): boolean {
  return [rgb.r, rgb.g, rgb.b].every((channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);
}

/** Reduce chroma (binary search, lightness and hue fixed) until the colour fits the sRGB gamut. */
export function toGamut(color: Oklch): Oklch {
  if (inGamut(toLinearRgb(color))) return color;
  let low = 0;
  let high = color.c;
  for (let step = 0; step < CHROMA_SEARCH_STEPS; step += 1) {
    const mid = (low + high) / 2;
    if (inGamut(toLinearRgb({ ...color, c: mid }))) low = mid;
    else high = mid;
  }
  return { ...color, c: low };
}

function encodeChannel(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const encoded = clamped <= 0.003_130_8 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

/** 8-bit sRGB channels of an (in-gamut) colour. */
export function toRgb8(color: Oklch): readonly [number, number, number] {
  const rgb = toLinearRgb(color);
  return [encodeChannel(rgb.r), encodeChannel(rgb.g), encodeChannel(rgb.b)];
}

/** Hex string (#rrggbb, or #rrggbbaa when translucent). */
export function toHex(color: Oklch): string {
  const channels = [...toRgb8(color)];
  if (color.alpha < 1) channels.push(Math.round(color.alpha * 255));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function round(value: number, digits: number): string {
  return Number(value.toFixed(digits)).toString();
}

/** CSS oklch() string. */
export function toCss(color: Oklch): string {
  const body = `${round(color.l * 100, 2)}% ${round(color.c, 4)} ${round(color.h, 2)}`;
  return color.alpha < 1 ? `oklch(${body} / ${round(color.alpha, 3)})` : `oklch(${body})`;
}

function linearize(channel8: number): number {
  const value = channel8 / 255;
  return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.2 relative luminance of the painted (8-bit) colour. */
export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = toRgb8(color);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2.2 contrast ratio (1..21) between two opaque colours. */
export function contrastRatio(foreground: Oklch, background: Oklch): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
