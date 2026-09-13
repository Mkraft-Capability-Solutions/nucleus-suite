import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { themes } = JSON.parse(readFileSync(new URL('../src/data/appearance.json', import.meta.url)));
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
  return channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const theme of themes) {
  test(`${theme.name}: normal text and primary actions meet 4.5:1 contrast`, () => {
    for (const foreground of ['--text', '--text-2', '--text-3', '--signal-ink']) {
      for (const background of ['--bg', '--card', '--card-2']) {
        const ratio = contrast(theme.tokens[foreground], theme.tokens[background]);
        assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
      }
    }
    assert.ok(contrast(theme.tokens['--on-signal'], theme.tokens['--signal']) >= 4.5);
  });
}
