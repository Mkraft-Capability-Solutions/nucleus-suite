/**
 * WCAG 2.2 contrast gate for every theme × mode. Prints one summary row per theme × mode (the weakest pair of each
 * requirement group) and every failing pair; exits 1 if any pair is below its minimum.
 * Usage: node scripts/check-contrast.mjs [--all]   (--all prints every pair)
 */
import { evaluateContrast } from '../src/tokens.ts';

const GROUPS = [
  ['body', (r) => r.foreground === 'text-primary' && r.background !== 'accent-subtle'],
  ['secondary', (r) => r.foreground === 'text-secondary'],
  ['muted', (r) => r.foreground === 'text-muted'],
  ['link', (r) => r.foreground === 'accent-text'],
  ['button', (r) => r.foreground === 'text-on-accent'],
  ['focus', (r) => r.foreground === 'border-focus'],
  ['control', (r) => r.foreground === 'border-strong'],
  ['status', (r) => /^(success|warning|danger|info)-/.test(r.foreground)],
  ['chart', (r) => r.foreground.startsWith('chart-')],
];

/** Run the gate. Returns the process exit code. */
export function checkContrast({ printAll = false, log = console.log } = {}) {
  const results = evaluateContrast();
  const rows = new Map();
  for (const result of results) {
    const key = `${result.themeId} ${result.mode}`;
    if (!rows.has(key)) rows.set(key, { theme: result.themeId, mode: result.mode, groups: {} });
    const row = rows.get(key);
    for (const [group, match] of GROUPS) {
      if (!match(result)) continue;
      const current = row.groups[group];
      if (current === undefined || result.ratio < current) row.groups[group] = result.ratio;
    }
  }

  const header = ['theme', 'mode', ...GROUPS.map(([group]) => group)];
  const widths = [16, 6, ...GROUPS.map(([group]) => Math.max(group.length, 6))];
  const line = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ');
  log('WCAG 2.2 contrast (minimum ratio per group; text ≥ 4.5, focus/control/chart ≥ 3)');
  log(line(header));
  log(line(widths.map((width) => '-'.repeat(width))));
  for (const row of rows.values()) {
    log(line([row.theme, row.mode, ...GROUPS.map(([group]) => row.groups[group].toFixed(2))]));
  }

  if (printAll) {
    for (const result of results) {
      log(`${result.pass ? 'ok  ' : 'FAIL'} ${result.themeId} ${result.mode} ${result.foreground} on ${result.background}: ${result.ratio.toFixed(2)} (min ${result.minimum}, ${result.purpose})`);
    }
  }

  const failures = results.filter((result) => !result.pass);
  log(`\n${results.length} pairs checked, ${failures.length} failed.`);
  for (const failure of failures) {
    log(`FAIL ${failure.themeId} ${failure.mode}: ${failure.foreground} on ${failure.background} = ${failure.ratio.toFixed(2)} < ${failure.minimum} (${failure.purpose})`);
  }
  return failures.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = checkContrast({ printAll: process.argv.includes('--all') });
}
