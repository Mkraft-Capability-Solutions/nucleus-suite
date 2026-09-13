# Engineering handbook

Nucleus is a private HRMS SaaS UI under local review. This handbook describes engineering requirements and the current implementation boundary; it is not a compliance attestation.

| Document | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Source ownership, data boundaries and change process |
| [Role model](ROLE_MODEL.md) | Five configured preview identities and future authorization requirements |
| [Security](SECURITY.md) | Secrets, demo limitations and production security gates |
| [Responsive UI](RESPONSIVE_UX.md) | Device layout policy and browser coverage |
| [Quality](QUALITY.md) | Accessibility, testing, feature acceptance and delivery |

`AGENTS.md` is the agent instruction entrypoint; `CLAUDE.md` imports it. Keep reusable engineering policy here instead of adding competing root instruction files or reorganizing working routes. Update these documents in the same change as affected behavior. Record consequential architectural decisions under this folder with context, alternatives, decision and consequences; create a decision record when there is an actual decision to review.

[Dashboard customization](DASHBOARD_CUSTOMIZATION.md) describes editor behavior, storage boundaries and verification. Public content lives in `src/data/public-site.json`, loaded by the async server-only `src/services/public-content.ts` adapter. Public pages do not load HR fixtures or require demo mode. The `/login` and `/workspace` routes share a client auth boundary; logout returns to `/`.
