# Home and workspace visual review

## Changes

- Access Control uses shared palette surfaces/text instead of fixed dark translucent panels. Filter chips wrap, metric cards use balanced columns, and permission rows remain readable when access is off.
- Permission actions use the theme's contrast foreground. Related access and approval dialogs now use theme-aware neutral surfaces and legible action colors.
- The initial console subnavigation follows the user's configured default console.
- Replaced unsupported compliance percentages/certification claims and invented audit assurances with explicit preview labels. The displayed role count comes from the role catalog.
- Home now has an interactive Employee/HR Manager/Superadmin preview, keyboard tab navigation, a connected employee-journey section and a clearer feature hierarchy. Copy comes from public-site.json through the existing public-content service. Preview content is labeled illustrative.

## Verification

Desktop/mobile browser checks exercised the Home role switcher and Access Control across Pearl violet, Graphite night, Slate blue and Sage teal. Metric label/surface contrast is asserted at 4.5:1 or above. Screenshots were inspected, including the permission detail area.

Responsive audit checked Access Control, Settings, People and Payroll at 320, 390, 768 and 1440 pixels in light/dark themes with no overflowing layout containers. Mobile leave, preflight validation and action-reset regressions passed. The 31 UI contract tests passed; the obsolete source-regex reset test was removed because actual reset behavior is verified by the browser regression.

This is scoped visual verification, not certification of every page, modal state or accessibility requirement. Live service and statutory limitations remain unchanged.

Final production build (including TypeScript), lint and whitespace/diff checks passed. Changes remain local for review; this pass did not deploy the application.
