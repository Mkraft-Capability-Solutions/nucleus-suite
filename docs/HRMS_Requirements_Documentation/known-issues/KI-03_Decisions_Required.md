<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">
  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# KI-03 — Decisions Required

| Attribute | Value |
| :--- | :--- |
| Register | KI-03 |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Author | Dhanraj Dadhich |
| Date | 2026-11-05 |
| Scope | Open product, engineering, client and commercial decisions |

| ID | Issue | Evidence | Impact | Recommended resolution | Owner (role) | Needed by | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| KI-201 | Runtime framework, hosting model and mobile app count | Open decisions OD-01, OD-02, OD-03 | Environment, standby design, bring-your-own-key and per-tenant fairness | Decide through DAR-01 by P0 week 2 (OD-01) and week 4 (OD-02); OD-03 by P0 exit | Engineering lead | P0 | Open |
| KI-202 | Master-data direction per tenant | OD-07 gates ERP inbound mode and People Core schema work | Integration and migration design | Decide through DAR-01 before People Core schema work | Product with Engineering | P0 hard gate | Open |
| KI-203 | Pilot client's legacy systems and extract formats unknown | Needed for migration mapping | Mapping specifications and effort | Collect system inventory and sample extracts from the pilot client | Migration Lead with client IT Head | Before Mock 1 (P1) | Open |
| KI-204 | Programme calendar anchor for week 1 | Migration and test schedules use relative weeks | Calendar dates of rehearsals and gates | Executive Sponsor fixes the start date at G0 | Programme Manager | G0 | Open |
| KI-205 | Production data in migration rehearsals | Requires a documented DPO decision | Mock 2 and Mock 3 realism | DPO decides with masking conditions | Data Protection Officer | Before Mock 1 | Open |
| KI-206 | First bank for host-to-host disbursement | Depends on the pilot client's salary bank | Bank adapter build scope | Client confirms its salary bank and file layout | Client Finance Controller with Integration Architect | P1 G2 | Open |
| KI-207 | Contractor invoice posting to ERP payables | Not present in the source flows | Contingent workforce integration scope | Product decides whether it is in P3 scope | Contingent Workforce Product Owner | P3 planning | Open |
| KI-208 | Kiosk second factor | Biometric match versus card depends on each plant's device estate | Kiosk authentication design | Survey pilot plant devices and choose per site | Integration Lead | P1 design review | Open |
| KI-209 | Approvals allowed in the business messaging channel | Limited to W-01, W-03, W-04 and W-10 | Client may expect loan or F&F approvals there | Confirm scope with the client and the Security Lead | Security Lead with Product Council | P1 G2 | Open |
| KI-210 | Quiet hours and shift-derived quiet hours | Defaults need validation with plant HR | Worker experience of notifications | Validate with plant HR during pilot | OCM Lead | P2 pilot | Open |
| KI-211 | Reporting thresholds | Small-cell suppression of 5; 100,000-row on-screen and 1,000,000-row export limits | Privacy and performance | Confirm with DPO and against pilot data volumes | DPO and Chief Architect | P1 G2 | Open |
| KI-212 | Individual-level predictive attrition scores | Manager-facing use needs a Data & AI Ethics Board decision | AI feature scope | DAEB decision before build | Data & AI Ethics Board | P3 entry | Open |
| KI-213 | Contractual service credits | Linked to availability and support targets | Commercial terms | Executive Sponsor decides commercial policy | Executive Sponsor | Before first pilot contract | Open |
| KI-214 | Statutory file layouts | EPFO, ESIC, PT and TDS return layouts must match the authorities' current specifications | Filing rejections | Payroll and statutory specialist validates layouts | Payroll SME with Legal | P1 G3 | Open |
| KI-215 | Statutory parameter values | PT slabs in the dataset are demonstration values; LWF values, ESI/PF ceilings, TDS regime parameters and gratuity ceiling are not in the sources | Payroll accuracy | Load values with citations during rule-pack authoring | Payroll SME | Before P2 parallel run | Open |
| KI-216 | SMS sender and template registration | Indian telecom registration rules apply | SMS go-live | Register sender IDs and templates | Platform Lead with Legal | P2 entry | Open |
