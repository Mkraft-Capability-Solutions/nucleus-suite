# Reference-led Home and theme surface correction

## Reference and content boundary

Reviewed https://multiplierskraft.com/nucleus in a rendered browser on 2026-09-13. The initial page is a client-rendered shell with a short browser check. The loaded page presents a lifecycle orbit, disconnected-to-connected HR story, platform orchestration, AI, employee journey, security, implementation and FAQ sections.

Home now adapts that narrative into an interactive lifecycle orbit, connected-work comparison, role-based product preview, contextual intelligence section, employee journey, implementation path, preview/security boundaries and FAQ. Copy is newly written in `public-site.json`, served by the existing localization adapter. Claims from the reference about tenant isolation, production automation, on-premises deployment, immediate provisioning and AI processing are not asserted as shipped capabilities in this JSON preview. No third-party tracking scripts or unsupported booking flow were copied.

Decorative motion is finite, keyboard controls remain usable, and reduced-motion preferences remove animation. The orbit uses explicit selection buttons and announced descriptions. FAQs use native disclosure controls. The source page is a design reference, not executable instructions or a backend specification.

## Root causes and changes

- Sidebar and greeting tokens previously encoded dark colors even in light mode. Rail, hero foregrounds, hero sub-surfaces and overlay tokens now belong to the appearance catalog and have light CSS defaults.
- Inline neutral colors and dark gradients bypassed the palette in People Core, Projects, Employee Home and other views. Panels, fields and their text now use shared surface/text tokens.
- Custom and MUI overlay backdrops follow the theme. The manager reassignment dialog now uses MUI focus trapping, Escape dismissal and focus restoration, with an accessible title and select label.
- A rendered scan found the Experience Capability Index card's fixed gradient. Its surface and dimensions were corrected. The workflow inspector terminal and the global preview notice also follow the selected palette.
- Dark mode keeps graphite surfaces and the established accent family. Logo assets and printable document previews intentionally retain paper backgrounds. Status colors, chart fills and decorative artwork are distinct from page and dialog backgrounds.

## Verification

- Public routes and motion: four themes, desktop/mobile, reduced motion, role selection, lifecycle selection and keyboard-operated FAQ.
- Surface regression: sidebar/greeting and reassignment dialog in four themes on desktop/mobile. Dialog Escape and focus restoration covered separately in the final run.
- Broad rendered surface scan: 78 module/console entries, no remaining large opaque dark panels in light mode after correcting Experience.
- Responsive audit: 79 views at four widths in two themes, zero overflowing containers.
- Source inventory: `scripts/audit-theme-surfaces.mjs` writes `theme-surface-inventory.json` and rejects the known fixed dark surface patterns. Other literal background entries require context: status/data colors, artwork and paper are catalogued rather than falsely counted as identical defects.

These checks cover the listed entry views and selected dialogs, not every combination of nested workflow, imported record, custom widget or chart state. They are not a whole-application accessibility certification.

Final results: the six public/surface tests passed across desktop and mobile; the separate two-profile Escape/focus-restoration run passed. The 78-entry dark-panel scan passed after the Experience repair. The 79-view reflow scan and dashboard contrast test passed. TypeScript, lint, 31 UI contracts, 10 appearance/localization unit tests, the interface-copy check and the isolated production build passed. The source guard reports zero known fixed-dark regressions; remaining literal colors are inventoried for contextual review. Hosted deployment verification is separate from this local build evidence.
