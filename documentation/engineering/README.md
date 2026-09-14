# Engineering Handbook & Architecture Standards

Nucleus is an enterprise-grade HRMS SaaS application. This handbook describes the core engineering requirements, service architecture, security boundaries, and verification gates.

| Document | Purpose |
| --- | --- |
| **[Service Architecture](SERVICE_ARCHITECTURE.md)** | **Military-Grade Enterprise Service Architecture**, Hexagonal DDD 14-domain services, Outbox pattern, 11-language i18n, Zero-Trust ABAC, and PostgreSQL persistence |
| [Architecture](ARCHITECTURE.md) | Source ownership, data boundaries, and change process |
| [Role Model](ROLE_MODEL.md) | 12 Configured enterprise RBAC identities, scope grants, and permission matrix |
| [Security](SECURITY.md) | Zero-trust boundaries, credential safety, and production security gates |
| [Interface Localization](I18N.md) | 11-Language localization framework, translation catalogs, and service adapters |
| [Responsive UI](RESPONSIVE_UX.md) | Device layout policy, 4-palette accessibility tokens, and browser coverage |
| [Quality](QUALITY.md) | Accessibility, testing standards, feature acceptance, and delivery gates |
| [Dashboard Customization](DASHBOARD_CUSTOMIZATION.md) | Dynamic dashboard layout controls and widget personalization |

`AGENTS.md` is the agent instruction entrypoint; `CLAUDE.md` imports it. Keep reusable engineering policy here instead of adding competing root instruction files or reorganizing working routes. Update these documents in the same change as affected behavior.
