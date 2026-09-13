# Dashboard palette repair — 2026-09-13

## Report and cause

The supplied People Command Centre screenshot showed the executive filter region painted with fixed dark backgrounds inside a light workspace, an uneven three-plus-one filter grid, and faint narrative actions. The filter region's inline colors bypassed the shared appearance tokens. Dashboard narrative styles combined fixed purple fills, theme-dependent foregrounds, and disabled opacity.

## Changes

- Executive scope surfaces, labels, select controls, date controls and scope chips use semantic theme tokens. The four filters form four, two or one columns according to available workspace width, including open sidebars.
- Filter fields provide 44px controls; buttons have visible keyboard focus and 44px targets in narrow containers.
- Shared dashboard narrative actions use matched foreground/background pairs. Unavailable prototype actions remain disabled, but readable. Hover styles follow the selected palette.
- The intentional dark welcome banner retains its inverse text and icon colors. Shared metric surfaces use the selected card surface and elevation.

## Verification scope

`e2e/dashboard-palette.spec.ts` checks four palettes, desktop and phone, filter labels/controls and narrative action contrast (including composited translucent surfaces), plus document overflow. It waits for palette transitions before measuring. This is targeted regression coverage, not a whole-application accessibility certification. Existing responsive audit covers module/console reflow, not every dialog or interaction.

No business data, credentials, authorization, localization content or backend behavior changed. The unrelated form audit draft is preserved.

Results: TypeScript and ESLint passed; UI contracts 31/31 passed. The final desktop/mobile palette tests passed 2/2. The responsive sweep passed 79 views × four widths × two themes with zero overflowing containers. Earlier contrast runs exposed branch-label and narrative-action failures; those were fixed and the final palette checks rerun successfully.

The isolated production build (`NUCLEUS_ISOLATED_BUILD=true npm run build`) passed after browser verification. This verifies the synthetic UI build, not the customer-production release gate.
