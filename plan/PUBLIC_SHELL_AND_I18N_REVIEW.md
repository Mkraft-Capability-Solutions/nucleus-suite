# Public shell, login and interface-copy review

- Public header reads the actual pathname. Active destinations have a filled state and accent underline; active Login retains the accent button's contrast foreground. Desktop and mobile tests check every public route, active state and text contrast.
- Login uses a 440px maximum-width card beside a desktop introduction. At 800px and below, the introduction is hidden and the form remains bounded and scrollable. Both device profiles have browser evidence.
- Prior Home, Access Control and related dialog visual fixes are included in this commit scope. Unsupported compliance/audit assurances were replaced with preview labels.
- 94 direct labels and 198 conditional labels/notifications were extracted to an English message catalog. The reference validator checks 299 literal translation calls; direct JSX label findings are zero. Public website content is also resolved through the localization adapter without translating route/icon IDs.
- The published locale is English. The resolver supports injected catalogs, interpolation and fallback. This is not completion of the broader database-backed i18n migration or a claim that every business value and CSS literal has disappeared. Structural style values and intentional asset colors remain code/design tokens; legacy business fixtures and generated messages still need their domain migration review.

Validation evidence: unit suite 751 passed / 21 skipped; final focused i18n suite 3 passed; UI contracts 31 passed; public-shell/customization run 13 passed with three stale/interrupted failures, then all six affected desktop/mobile navigation, sign-out and pointer/touch cases passed on the stable rerun. The stale Home-title assertion was corrected. Final workspace-wide responsive/build results are recorded at delivery.

Final responsive sweep: all 79 module/console views passed at 320, 390, 768 and 1440 pixels in light/dark themes, with zero overflowing layout containers. Desktop and mobile login screenshots were inspected; the introduction is omitted on mobile and the active Login button meets the tested text-contrast threshold.

Final production build (including TypeScript), standalone typecheck, lint, translation-reference validation, service-plan coverage and shared form audit passed. The unrelated in-progress edit to FORM_VALIDATION_AUDIT.md is excluded from this commit. No deployment was performed.
