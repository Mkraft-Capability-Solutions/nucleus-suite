import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Theme contrast guard.
 *
 * Parses the real token values out of src/app/globals.css and checks, for BOTH
 * themes, that every foreground token clears WCAG AA against the surface it is
 * actually painted on. This is what stops a dark-on-dark or light-on-light
 * regression from reaching a screen: a token edit that breaks a pairing fails
 * here rather than in review.
 */

// Normalised so the selector lookups below are independent of line endings.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\r\n/g, "\n");

/** Pulls the `--name: value;` declarations out of one top-level block. */
function readBlock(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Selector not found in globals.css: ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  const body = css.slice(open + 1, end);
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const lightTokens = readBlock(":root");
const darkTokens = { ...lightTokens, ...readBlock(".dark,\n[data-theme=\"dark\"]") };

type Rgba = { r: number; g: number; b: number; a: number };

function parseHex(value: string): Rgba | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((char) => char + char).join("");
  const int = Number.parseInt(hex.slice(0, 6), 16);
  const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a: alpha };
}

function parseRgba(value: string): Rgba | null {
  const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((part) => Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

/** Resolves a token to a colour, following `var(--x)` aliases. */
function resolve(name: string, tokens: Record<string, string>, seen = new Set<string>()): Rgba {
  if (seen.has(name)) throw new Error(`Circular token reference: ${name}`);
  seen.add(name);
  const raw = tokens[name];
  if (!raw) throw new Error(`Token not defined: ${name}`);
  const alias = /^var\((--[\w-]+)\)$/.exec(raw.trim());
  if (alias) return resolve(alias[1], tokens, seen);
  const colour = parseHex(raw) ?? parseRgba(raw);
  if (!colour) throw new Error(`Token ${name} is not a plain colour: ${raw}`);
  return colour;
}

/** Composites a possibly-translucent colour over an opaque backdrop. */
function flatten(colour: Rgba, backdrop: Rgba): Rgba {
  if (colour.a >= 1) return { ...colour, a: 1 };
  return {
    r: colour.r * colour.a + backdrop.r * (1 - colour.a),
    g: colour.g * colour.a + backdrop.g * (1 - colour.a),
    b: colour.b * colour.a + backdrop.b * (1 - colour.a),
    a: 1,
  };
}

function relativeLuminance({ r, g, b }: Rgba): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: Rgba, background: Rgba): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Ratio for `fg` painted on `surface`, where the surface may itself be
 * translucent and is therefore flattened over the page background first.
 */
function ratio(fg: string, surface: string, base: string, tokens: Record<string, string>): number {
  const backdrop = flatten(resolve(base, tokens), { r: 255, g: 255, b: 255, a: 1 });
  const surfaceColour = flatten(resolve(surface, tokens), backdrop);
  const foreground = flatten(resolve(fg, tokens), surfaceColour);
  return contrast(foreground, surfaceColour);
}

/** Body text must clear AA (4.5:1). */
const bodyPairs: Array<[fg: string, surface: string]> = [
  ["--foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--background"],
  ["--secondary-foreground", "--secondary"],
  ["--popover-foreground", "--popover"],
  ["--success", "--card"],
  ["--warning", "--card"],
  ["--destructive", "--card"],
  ["--info", "--card"],
  ["--ai", "--card"],
  ["--accent-foreground", "--accent"],
  ["--accent-amber", "--card"],
  ["--accent-coral", "--card"],
  ["--accent-violet", "--card"],
  ["--accent-sky", "--card"],
];

/** UI text, solid fills and large type must clear 3:1. */
const uiPairs: Array<[fg: string, surface: string]> = [
  ["--primary-foreground", "--primary"],
  ["--success-foreground", "--success"],
  ["--destructive-foreground", "--destructive"],
  ["--warning-foreground", "--warning"],
  ["--info-foreground", "--info"],
  ["--ai-foreground", "--ai"],
  ["--text-3", "--background"],
  ["--primary", "--background"],
  ["--primary", "--card"],
];

/** The rail is dark chrome in BOTH themes, so its text is always light. */
const railPairs: Array<[fg: string, surface: string]> = [
  ["--rail-text", "--rail"],
  ["--rail-active", "--rail"],
];

const themes: Array<[name: string, tokens: Record<string, string>]> = [
  ["light", lightTokens],
  ["dark", darkTokens],
];

describe("theme contrast", () => {
  it("defines the dark theme as a real override of the light theme", () => {
    expect(Object.keys(lightTokens).length).toBeGreaterThan(50);
    expect(darkTokens["--background"]).not.toBe(undefined);
    expect(resolve("--background", darkTokens)).not.toEqual(resolve("--background", lightTokens));
    expect(resolve("--foreground", darkTokens)).not.toEqual(resolve("--foreground", lightTokens));
  });

  for (const [themeName, tokens] of themes) {
    describe(`${themeName} theme`, () => {
      it.each(bodyPairs)("body text %s on %s clears AA", (fg, surface) => {
        const value = ratio(fg, surface, "--background", tokens);
        expect(value, `${fg} on ${surface} in ${themeName} = ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });

      it.each(uiPairs)("ui text %s on %s clears 3:1", (fg, surface) => {
        const value = ratio(fg, surface, "--background", tokens);
        expect(value, `${fg} on ${surface} in ${themeName} = ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      });

      it.each(railPairs)("rail text %s on %s clears 3:1", (fg, surface) => {
        const value = ratio(fg, surface, "--rail", tokens);
        expect(value, `${fg} on ${surface} in ${themeName} = ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      });

      it("never paints the page foreground onto the rail", () => {
        // The rail stays dark in both themes, so --foreground (which is dark in
        // light mode) must never be used there. Guard the value, not the usage.
        const railValue = ratio("--foreground", "--rail", "--rail", tokens);
        if (themeName === "light") {
          expect(railValue).toBeLessThan(3);
        }
      });
    });
  }
});
