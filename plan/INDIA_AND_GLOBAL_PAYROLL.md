# India-first payroll and global country configuration

## Decision and current evidence

India (IN), INR is the initial enabled default in migration 0020. No Indian state was provided. Default-country storage is implemented; country management UI, statutory adapters and a reviewed India rule pack are planned. Do not select a state by inference or describe this catalog as legal compliance.

## Configuration model

Proposed catalogs: countries, country_subdivisions, currencies, currency_minor_units, locales, payroll_jurisdictions, country_capabilities, tenant_country_enrollments, legal_entity_establishments, statutory_registrations, rule_packs, rule_pack_versions, policy_effective_periods, obligation_types and filing_calendars. Existing payroll_country_configuration must gain a country-consistent composite reference to its jurisdiction during the normalization pass.

All country codes may be listed in the Superadmin catalog. Listing a country is distinct from enabling payroll: capability states are catalog-only → configured → rules-in-review → verified → enabled → suspended. Activation requires a currency, payroll calendar, supported statutory pack, test evidence and named reviewer. The global default affects newly configured entities, not existing employees' historical runs. Changing defaults never rewrites prior payroll profiles.

Superadmin workflow: search country → configure jurisdiction/currency/locale → add subdivisions and supported capabilities → upload/reference approved policy evidence → run golden cases → approve publication → enable for eligible tenants. Tenant admin then chooses legal entity, establishment and registrations. Employees receive an effective-dated work location/jurisdiction assignment; payroll blocks ambiguous or missing jurisdiction.

Proposed APIs: GET /api/v1/platform/payroll-countries; POST /api/v1/platform/payroll-countries/{code}/configure; POST .../{code}/validate; POST .../{code}/publish; POST .../{code}/suspend; POST .../{code}/set-default. All writes require explicit platform permission, recent privileged authentication, expectedVersion, audit and idempotency. Tenant runtime has no global catalog write grant.

## India rule-pack work packages

Inventory applicable employee/employer tax, social-security, wage, leave-linked payroll, state-level deductions, registrations, filings and reporting obligations with a qualified payroll/compliance reviewer. Separate national, state, establishment and employee eligibility rules. Store authority/source reference, effective date, publication/review dates, thresholds, rounding, exceptions and calculation precedence. No rates or applicability are specified in this plan.

Collect the initial establishment state(s), legal entities, worker categories, pay frequency, tax year, salary components, benefits, joining/leaving rules, arrears and statutory registrations before activating calculations. Provide a setup checklist that blocks execution until these are resolved. The state choice is a required setup input, not a blocker to designing the system.

Calculation pipeline: freeze approved employee/assignment and policy snapshot → attendance and leave cutoff → earnings/proration → eligibility → deductions/contributions → net pay → validation/reconciliation → independent approval → lock run → generate payslips/accounting obligations → separate disbursement authorization. Every result line stores input and policy provenance; replay against the same snapshots yields the same result.

## Global expansion gates

Country packs implement common interfaces for eligibility, earnings, deduction calculation, employer liabilities, filing schedules and export formats. Avoid a single global formula with country conditionals scattered across React. Currency precision, calendars, time zones, pay frequencies and localization are country-configurable. Multi-currency display conversion is separate from legal payroll amounts and uses a versioned rate source/date.

Acceptance includes boundary thresholds, effective-date changes, mid-period joins/exits, unpaid/half-day leave, multiple establishments, retroactive corrections, negative adjustments, rounding, leap years, concurrent finalization and locked-run amendment. Test unauthorized country activation and attempts to change the global default from tenant credentials. Mark unsupported statutory operations unavailable with a clear setup status.
