# Public experience and CSS audit — 2026-09-13

## Implementation

The public stylesheet had accumulated overlapping hero, navigation, CTA and responsive rules. It now defines one coordinated public layout shared by Home, About, Features, Why Nucleus, Docs, Contact and the login header. The landing page has a layered orbital product stage, staged typography/CTA entrances and an animated role preview. All public content sections progressively reveal on entry; cards and CTAs provide restrained hover feedback. Contact fields group on desktop and stack on phones. Mobile navigation closes after navigation and supports Escape with focus restoration.

Motion uses finite CSS and Web Animations transitions, not continuous rendering loops or scroll interception. Intersection observers disconnect on unmount; in-flight reveal animations cancel when reduced motion is requested. Content is visible without the enhancement. Existing keyboard-operated role tabs keep their focus behavior. Decorative orbital art is clipped within its own bounds, leaving content and focus outlines unrestricted.

Workspace status badges now use shared semantic color pairs in attendance, leave, payroll, recruitment, onboarding, compliance and the shared dashboard kit. Payroll's earned-wage card now uses the defined hero background rather than an undefined `--ink-2` gradient. Printable letters and compliance documents intentionally retain paper styling.

## Evidence and limits

Verification includes `public-motion.spec.ts`, `public-shell-layout.spec.ts`, `workspace-status-colors.spec.ts` and the 79-view responsive audit. Checks target public route/theme reflow, desktop/mobile layouts, menu keyboard behavior, role switching, reduced motion, status contrast and workspace overflow. They do not establish that every nested workflow, chart label or third-party component is free of visual defects. No backend functionality or production integration was added. Public copy stays behind the existing localized content adapter.

Verified results: public route/theme/motion tests passed on desktop and mobile; public navigation/login layout tests passed on both profiles; semantic badge contrast passed across six module entry pages and four palettes. The workspace sweep passed 79 views × four widths × two themes with zero overflowing containers. TypeScript, repository lint, 31 UI contracts and the 299-reference interface-copy check passed. The first decorative-art overflow and a mobile test expecting the intentionally hidden login introduction were corrected before the passing runs. A status-test SVG class-reading error was corrected before its passing rerun.

The isolated production build passed after browser verification. Final targeted lint also passed. Build validation applies to the synthetic preview; it does not establish customer-production readiness.
