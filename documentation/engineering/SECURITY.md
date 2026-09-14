# Security requirements

## Local preview

- `DEMO_AUTH_ENABLED=true` is explicit consent to serve synthetic fixtures. The workspace snapshot is available before sign-in in this mode. Never host real personnel, payroll, bank or identity data behind this demo gate.
- `.env.local` is ignored and sets local JSON preview options. Keep `.env` and `.env.example` production-closed by default. Do not set `NODE_ENV=production` for local development.
- `credentials.webp` is a private local reference excluded from Git. Never copy it into `public`, docs or the workspace-data manifest. Password hashes are server-only; passwords, tokens and secrets must not appear in logs or client payloads.
- Browser tests read `DEMO_TEST_PASSWORD` from `.env.local` or the CI secret store. It is test-only, must not use `NEXT_PUBLIC_`, and must not be configured for public deployment. Shared demo credentials are not acceptable production credentials.
- Preserve input/body limits, origin validation, generic login failures, constant-time hash comparison and cache restrictions. Do not replace these with plaintext password matching.
- If a secret is exposed, remove it from distribution and rotate it; deleting a source line alone does not revoke it.

## Production gate, after backend approval

Use [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) as the verification framework, with a risk-based Level 2 target for sensitive HRMS workflows. Track each applicable control and evidence; the project is not yet ASVS verified.

Require server-side authorization on every operation, tenant isolation tests, secure sessions, privilege-change audit trails, MFA for privileged accounts, rate limiting, CSRF protections, dependency review, backup/restore exercises and data-retention policies. Define incident response and access review ownership before launch. Use established cryptographic libraries and managed key storage; no custom “unbreakable” algorithms or unattended agents that patch production code.

Document privacy, payroll and employment-law requirements for the actual deployment jurisdictions with qualified review. A template license or a green test suite does not establish legal compliance.

The user explicitly authorized documenting the shared synthetic demo password in `docs/engineering/ROLE_MODEL.md`. This narrow exception does not permit publishing production secrets or copying credentials into client bundles.
