"""Write ../known-issues/ — issues kept outside the requirements package (never referenced from it)."""
import os, re, json, collections
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REQ = os.path.join(ROOT, "requirements")
OUT = os.path.join(ROOT, "known-issues")
os.makedirs(OUT, exist_ok=True)
TODAY = "2026-11-05"
LOGO = ('<p align="right">\n<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="../requirements/assets/MultipliersKraftLogoDark.png">\n'
        '  <img src="../requirements/assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">\n</picture>\n</p>\n')

def head(code, title, purpose):
    return f"""{LOGO}
# {code} — {title}

| Attribute | Value |
| :--- | :--- |
| Register | {code} |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Author | Dhanraj Dadhich |
| Date | {TODAY} |
| Scope | {purpose} |

"""

def esc(s): return str(s).replace("|", "\\|").replace("\n", " ")

def issue_table(rows):
    t = "| ID | Issue | Evidence | Impact | Recommended resolution | Owner (role) | Needed by | Status |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n"
    return t + "".join("| " + " | ".join(esc(x) for x in r) + " |\n" for r in rows)

# ------------------------------------------------------------------ 01 source data conflicts
KI01 = [
 ("KI-001", "Loan ceiling boundary differs between rules", "RL-433 applies the six-times ceiling for service *above* five years; BS:RL-22 for *five years or more*", "Eligibility differs for employees with exactly five years of service", "Adopt five completed years or more (client wording) and amend RL-433", "Compensation Product Owner with client HR Head", "P1 G1", "Open — client decision"),
 ("KI-002", "Year-end leave expected result contradicts the rule", "RL-220 encashes earned leave only above the 45-day carry-forward cap; acceptance test T-17 encashes all 7 days of an employee holding 7", "Year-end balances, encashment cost and payroll input", "If RL-220 stands, change T-17 to 7 days carried forward and 5 days lapsed; otherwise change RL-220", "Leave Product Owner with client", "P1 G1", "Open — client decision"),
 ("KI-003", "Early-return example differs from its golden record", "Build-sheet T-08: return on day 7 → 4 days credited; dataset LV-2026-0774 (7–16 Sep, back on 14 Sep) → 3 days", "Test and data disagree although both are arithmetically correct", "Rewrite T-08 setup to the dataset record (return on day 8, 3 days credited)", "QA / Test Lead", "P1 G1", "Open"),
 ("KI-004", "Recompute reason count differs", "RL-150 states 6 reasons; step TIM-09.1 lists 7 (late punch, regularisation, rule change, roster republish, policy/class change, gate pass, leave reversal)", "Recompute triggers may be missed", "Amend RL-150 to seven reasons", "Time & Attendance Product Owner", "P1 G1", "Open"),
 ("KI-005", "Actor who closed the early return differs", "Demo user U-005 (E1004, HR Head) closes LV-2026-0774; 18_Leave_Requests, workflow W-02 demo record and RG-2026-0214 name E1006", "Audit expectations in acceptance tests", "Set the closer to E1004 in the three dataset rows, matching W-02 (HR Head, single level)", "QA / Test Lead", "P1 G1", "Open"),
 ("KI-006", "Employee E1066 location differs", "Form F record filed under Karnataka (LOC-PLA); all other sheets place E1066 at Chakan Works (LOC-PUN, Maharashtra)", "Statutory form jurisdiction and golden-data reconciliation", "Move the Form F record to LOC-PUN", "QA / Test Lead", "P0 G1", "Open"),
 ("KI-007", "Contractor invoice passes despite a missing challan", "INV-VN01-2608 passes while vendor VN-01's August challan is missing; capability gap CTG-CG-002 requires challans before approval", "Invoice validation tests would accept an invalid invoice", "Change the expected result to 'Held — challan missing'", "Contingent Workforce Product Owner", "P2 G1", "Open"),
 ("KI-008", "Unmatched ERP employee picklist allows creation", "PL_UNMATCHED_ACTION offers 'Create'; RL-516 forbids creating a person from an unmatched external code", "Inbound master behaviour ambiguous", "Remove 'Create'; unmatched records stay parked (decide with OD-07)", "Integration Architect with Finance & ERP Product Owner", "P1 G2", "Open"),
 ("KI-009", "Same-day full-and-final has no escalation", "W-08 (HR Head → Finance) has no escalation, yet R-17 requires settlement on the last working day; NOT-01 assumes hourly reminders from 12:00", "Same-day settlement commitment at risk", "Add escalation on the last working day: HR Head 2 h → Finance 2 h → CFO; confirm reminder timing", "Lifecycle Product Owner with client", "P1 G1", "Open — client decision"),
 ("KI-010", "Statutory form titles differ across sources", "29_Statutory_Forms names Form 18 the leave-with-wages register and Form 36 the muster roll; other material uses Form 18 for notice of accident and Form 36 for the inspection book; Form F used for both factory particulars and gratuity nomination", "Wrong form generated or labelled", "Confirm official titles per state rules (client question Q-13) and define each form separately", "Compliance Product Owner with Legal", "P1 G1", "Open — Legal"),
 ("KI-011", "Peenya Works has no location holiday list", "09_Holiday_Calendar lists LOC-PLA only through 'ALL' holidays", "Day-type resolution, sandwich rule and OT at LOC-PLA", "Add the Karnataka festival holidays for LOC-PLA to the dataset", "Leave Product Owner with client", "P0 G1", "Open"),
 ("KI-012", "Kannada absent from base interface languages", "Two pilot sites (LOC-BLR, LOC-PLA) are in Karnataka", "Adoption at the Karnataka sites", "Delivered by capability gap PLT-CG-017 (expanded Indian language coverage)", "Product Owner", "P2", "Resolved in documentation — pending approval of PLT-CG-017"),
]

# ------------------------------------------------------------------ 02 source data quality
F = json.load(open(os.path.join(HERE, "findings.json")))["findings"]
nostep = [(d, re.search(r"\((.*?)\)", x).group(1)) for d, v in F.items() for x in v if "no step-level flow" in x]
notest = [d for d, v in F.items() for x in v if "No source test cases" in x]
KI02 = [
 ("KI-101", "Processes specified only at inventory level", "; ".join(f"{d}: {p}" for d, p in nostep), "Flows rely on authored use cases rather than source step specifications", "Product owners confirm the authored flows in FRS-<DOM>-12 and add step rows to the process workbook", "Domain Product Owners", "Each domain's G1", "Open"),
 ("KI-102", "Domains with no source test cases", ", ".join(notest), "Acceptance relies on authored user-story criteria and authored test cases", "Add golden test cases to the process workbook's test sheet for these domains", "QA / Test Lead", "Each domain's G1", "Open"),
 ("KI-103", "Forms workbook read-me lists a sheet that does not exist", "Read-me of the Forms & Fields workbook describes a fourth (benchmark) sheet; the workbook has three data sheets", "Readers look for evidence that is not there", "Remove the reference from the workbook read-me", "Business Analyst Lead", "P0 G1", "Open"),
 ("KI-104", "Third-party product names inside source workbooks", "Process workbook (SSV and FIN rules and steps, screens SCR-041, SCR-066, TIM-01 text), picklist PL_ERP_SYSTEM values, dataset sheets", "Requirements show generic terms, but the source of record still carries product names", "Replace product names in the workbooks with generic terms and neutral connector codes", "Business Analyst Lead", "P0 G1", "Open"),
 ("KI-105", "Client rule IDs collide with product rule IDs", "Build-sheet rules RL-01…RL-27 versus process rules RL-001…", "Ambiguous traceability (handled in requirements as BS:RL-xx)", "Rename build-sheet rules at source to a distinct prefix", "Business Analyst Lead", "P0 G1", "Open"),
 ("KI-106", "Loan rules incomplete", "No rule ID for the loan net-pay floor; no process step emits loan.closed; no rule releases guarantors when a loan is rejected at sanction or foreclosed (authored release flows added in CMB use cases)", "Loan lifecycle gaps at build time", "Add the three rules and the event to the process workbook", "Compensation Product Owner", "P1 G1", "Open"),
 ("KI-107", "Phase mismatches between processes and capability gaps", "PAY-11 (P2) overlaps PAY-CG-002 (P1); CTG capability gaps are P2 while CTG processes are P3", "Planning inconsistency", "Product Council aligns phases during scope triage", "Head of Product", "Scope triage", "Open"),
 ("KI-108", "Lanes that are not personas", "Process lanes 'Compliance engineer', 'Named reviewer', 'Admin / IT', 'Department owners' and the purchasing role in CTG-01 have no persona definition", "Access design for these actors is unspecified", "Add the roles to the roles sheet with scope and visibility", "Security Architect", "P1 G2", "Open"),
 ("KI-109", "Rule ranges and stray references", "PPL-08 cites ERP rules and tests only as ranges (RL-510..516, TC-F510..516); RL-014 appears only in step and traceability rows", "Use cases cannot cite individual rules", "List individual IDs in the process workbook", "Business Analyst Lead", "P1 G1", "Open"),
]

# ------------------------------------------------------------------ 03 decisions required
KI03 = [
 ("KI-201", "Runtime framework, hosting model and mobile app count", "Open decisions OD-01, OD-02, OD-03", "Environment, standby design, bring-your-own-key and per-tenant fairness", "Decide through DAR-01 by P0 week 2 (OD-01) and week 4 (OD-02); OD-03 by P0 exit", "Engineering lead", "P0", "Open"),
 ("KI-202", "Master-data direction per tenant", "OD-07 gates ERP inbound mode and People Core schema work", "Integration and migration design", "Decide through DAR-01 before People Core schema work", "Product with Engineering", "P0 hard gate", "Open"),
 ("KI-203", "Pilot client's legacy systems and extract formats unknown", "Needed for migration mapping", "Mapping specifications and effort", "Collect system inventory and sample extracts from the pilot client", "Migration Lead with client IT Head", "Before Mock 1 (P1)", "Open"),
 ("KI-204", "Programme calendar anchor for week 1", "Migration and test schedules use relative weeks", "Calendar dates of rehearsals and gates", "Executive Sponsor fixes the start date at G0", "Programme Manager", "G0", "Open"),
 ("KI-205", "Production data in migration rehearsals", "Requires a documented DPO decision", "Mock 2 and Mock 3 realism", "DPO decides with masking conditions", "Data Protection Officer", "Before Mock 1", "Open"),
 ("KI-206", "First bank for host-to-host disbursement", "Depends on the pilot client's salary bank", "Bank adapter build scope", "Client confirms its salary bank and file layout", "Client Finance Controller with Integration Architect", "P1 G2", "Open"),
 ("KI-207", "Contractor invoice posting to ERP payables", "Not present in the source flows", "Contingent workforce integration scope", "Product decides whether it is in P3 scope", "Contingent Workforce Product Owner", "P3 planning", "Open"),
 ("KI-208", "Kiosk second factor", "Biometric match versus card depends on each plant's device estate", "Kiosk authentication design", "Survey pilot plant devices and choose per site", "Integration Lead", "P1 design review", "Open"),
 ("KI-209", "Approvals allowed in the business messaging channel", "Limited to W-01, W-03, W-04 and W-10", "Client may expect loan or F&F approvals there", "Confirm scope with the client and the Security Lead", "Security Lead with Product Council", "P1 G2", "Open"),
 ("KI-210", "Quiet hours and shift-derived quiet hours", "Defaults need validation with plant HR", "Worker experience of notifications", "Validate with plant HR during pilot", "OCM Lead", "P2 pilot", "Open"),
 ("KI-211", "Reporting thresholds", "Small-cell suppression of 5; 100,000-row on-screen and 1,000,000-row export limits", "Privacy and performance", "Confirm with DPO and against pilot data volumes", "DPO and Chief Architect", "P1 G2", "Open"),
 ("KI-212", "Individual-level predictive attrition scores", "Manager-facing use needs a Data & AI Ethics Board decision", "AI feature scope", "DAEB decision before build", "Data & AI Ethics Board", "P3 entry", "Open"),
 ("KI-213", "Contractual service credits", "Linked to availability and support targets", "Commercial terms", "Executive Sponsor decides commercial policy", "Executive Sponsor", "Before first pilot contract", "Open"),
 ("KI-214", "Statutory file layouts", "EPFO, ESIC, PT and TDS return layouts must match the authorities' current specifications", "Filing rejections", "Payroll and statutory specialist validates layouts", "Payroll SME with Legal", "P1 G3", "Open"),
 ("KI-215", "Statutory parameter values", "PT slabs in the dataset are demonstration values; LWF values, ESI/PF ceilings, TDS regime parameters and gratuity ceiling are not in the sources", "Payroll accuracy", "Load values with citations during rule-pack authoring", "Payroll SME", "Before P2 parallel run", "Open"),
 ("KI-216", "SMS sender and template registration", "Indian telecom registration rules apply", "SMS go-live", "Register sender IDs and templates", "Platform Lead with Legal", "P2 entry", "Open"),
]

# ------------------------------------------------------------------ 05 governance & 06 authored scope
KI05 = [
 ("KI-301", "Governance roles not yet assigned to named people", "All approval authorities are roles", "No document can be approved; G0 blocked", "Executive Sponsor appoints people and deputies to SteerCo, Product Council, ARB, CCB, DAEB, EPG and PQA", "Executive Sponsor", "G0", "Open"),
 ("KI-302", "Peer reviews, approvals and measurement data pending", "277 controlled documents carry pending review, sign-off and measurement entries", "No baseline; no data for review-rate and defect-density baselines", "Run reviews in gate order (see schedule below), record PR records, fill measurement blocks, approve CR-0001, tag the baseline", "PQA Lead with Programme Manager", "G0 then G1", "Open"),
 ("KI-303", "Legal validation outstanding", "158 statements marked '(to be validated by Legal)' — register in KI-04", "Statutory and privacy obligations unconfirmed", "One review pass by labour-law and privacy counsel; answers applied through CM-02", "Legal with DPO", "G1", "Open"),
]
KI06 = [
 ("KI-401", "Authored capability gaps awaiting approval", "129 capability gaps (<DOM>-CG-nnn)", "Scope not yet committed", "Product Council triage with DAR-01 scoring: approve, defer or reject; set phase", "Head of Product", "Before each phase G1", "Open"),
 ("KI-402", "Frontier features awaiting decision", "75 frontier features (<DOM>-FX-nnn); AI tier 3+ items also need DAEB", "Differentiation roadmap not committed", "DAR-01 decision per feature; DAEB review for tier 3+", "Head of Product with DAEB", "Phase planning", "Open"),
 ("KI-403", "Authored use cases, user stories and test cases need product confirmation", "35 process use cases without source step flows, 129 capability-gap use cases, their user stories and 652 authored test cases", "Behaviour not yet confirmed by domain owners", "Domain walkthroughs with product owners; corrections through CM-02", "Domain Product Owners", "Each domain's G1", "Open"),
]

REVIEW = [
 ("Wave 1 — G0", "DOC-01, DOC-02, GOV-01, GOV-03, GOV-04, PLN-01, CM-01, CM-02, REQ-01, RSK-01, QA-01, MPM-01", "Steering Committee", "2 weeks"),
 ("Wave 2 — G1 business", "BRS-01, CONOPS-01, STRS-01, GOV-02, GOV-05..11", "Steering Committee / Product Council", "2 weeks"),
 ("Wave 3 — G1 system", "SRS-01, NFR-01, SEC-01, OPS-01, NOT-01, RPT-01, LOC-01, DA-01..05, MIG-01, IA-01..03, ICD-01, AI-01", "Product Council / ARB / DAEB", "3 weeks"),
 ("Wave 4 — G1 domains", "14 domain packs (FRS-<DOM>-00..13), UCC-01, USC-01, BA-01..06", "Product Council", "4 weeks, two domains per review session"),
 ("Wave 5 — G1 verification and planning", "MTP-01, UAT-01, QA-03, VV-01..03, REQ-02, TR-01..04, RB-01..03, PLN-02, PLN-03, RSK-02, RSK-03", "Product Council / Steering Committee", "2 weeks"),
]

def write(name, text): open(os.path.join(OUT, name), "w").write(text)

write("KI-01_Source_Data_Conflicts.md", head("KI-01", "Source Data Conflicts", "Contradictions between sheets of the source workbooks") +
      "Each conflict needs one answer from the client or domain owner; the source workbook is then corrected and the requirements updated through a change request.\n\n" + issue_table(KI01))
write("KI-02_Source_Data_Quality.md", head("KI-02", "Source Data Quality and Completeness", "Gaps and quality defects in the source workbooks") + issue_table(KI02))
write("KI-03_Decisions_Required.md", head("KI-03", "Decisions Required", "Open product, engineering, client and commercial decisions") + issue_table(KI03))

# Legal register generated from the requirements
rows = []
for dp, dn, fs in os.walk(REQ):
    for f in sorted(fs):
        if not f.endswith(".md"): continue
        p = os.path.join(dp, f)
        doc = re.search(r"^\| Document ID \| (.*?) \|", open(p).read(), re.M)
        for i, ln in enumerate(open(p).read().splitlines(), 1):
            if re.search(r"to be validated by legal", ln, re.I):
                ids = re.findall(r"\b[A-Z]{2,4}(?:-[A-Z]{2,4})?-\d{2,3}[a-z]?\b", ln)
                text = re.sub(r"<[^>]+>", " ", ln).replace("|", " ").strip()
                rows.append((doc.group(1) if doc else f, ids[0] if ids else "—", text[:260], os.path.relpath(p, ROOT)))
by = collections.Counter(r[0] for r in rows)
t = head("KI-04", "Legal and Statutory Validation Register", "Every requirement statement that asserts a legal or statutory obligation needing counsel's confirmation")
t += f"{len(rows)} statements in {len(by)} documents. Counsel reviews each statement, confirms or corrects it, and the answer is applied through a change request.\n\n"
t += "| Document | Statements |\n| :--- | ---: |\n" + "".join(f"| {d} | {n} |\n" for d, n in by.most_common()) + "\n"
t += "| # | Document | First ID on the line | Statement | File |\n| ---: | :--- | :--- | :--- | :--- |\n"
t += "".join(f"| {i} | {esc(a)} | {esc(b)} | {esc(c)} | `{esc(d)}` |\n" for i, (a, b, c, d) in enumerate(rows, 1))
write("KI-04_Legal_Validation_Register.md", t)

t = head("KI-05", "Governance, Reviews and Approvals", "Pending people, reviews and approvals needed to baseline release 1.0.0") + issue_table(KI05)
t += "\n## Review and approval schedule\n\n| Wave | Documents | Approval authority | Duration |\n| :--- | :--- | :--- | :--- |\n" + "".join(f"| {a} | {b} | {c} | {d} |\n" for a, b, c, d in REVIEW)
t += "\n```mermaid\nflowchart LR\n    A[\"Appoint people\"] --> W1[\"Wave 1 · G0\"] --> W2[\"Wave 2 · business\"] --> W3[\"Wave 3 · system\"] --> W4[\"Wave 4 · domains\"] --> W5[\"Wave 5 · verification\"] --> B[\"Baseline tag 1.0.0\"]\n```\n"
write("KI-05_Governance_Reviews_and_Approvals.md", t)
write("KI-06_Authored_Scope_Pending_Approval.md", head("KI-06", "Authored Scope Pending Approval", "Authored content that needs product and ethics decisions") + issue_table(KI06))

allrows = [("KI-01", r) for r in KI01] + [("KI-02", r) for r in KI02] + [("KI-03", r) for r in KI03] + [("KI-05", r) for r in KI05] + [("KI-06", r) for r in KI06]
files = {"KI-01": "KI-01_Source_Data_Conflicts.md", "KI-02": "KI-02_Source_Data_Quality.md", "KI-03": "KI-03_Decisions_Required.md", "KI-05": "KI-05_Governance_Reviews_and_Approvals.md", "KI-06": "KI-06_Authored_Scope_Pending_Approval.md"}
st = collections.Counter(r[7].split(" —")[0] for _, r in allrows)
t = head("KI-00", "Known Issues Index", "All open issues for Nucleus Suite requirements release 1.0.0. This folder is kept separate from the requirements package.")
t += f"**{len(allrows)} issues** plus a register of **{len(rows)} legal validation statements**. Status: " + ", ".join(f"{k} {v}" for k, v in st.items()) + ".\n\n"
t += "| Register | Contents | Issues |\n| :--- | :--- | ---: |\n"
t += f"| [KI-01](KI-01_Source_Data_Conflicts.md) | Contradictions between source sheets | {len(KI01)} |\n| [KI-02](KI-02_Source_Data_Quality.md) | Gaps and defects in the source workbooks | {len(KI02)} |\n| [KI-03](KI-03_Decisions_Required.md) | Product, engineering, client and commercial decisions | {len(KI03)} |\n| [KI-04](KI-04_Legal_Validation_Register.md) | Legal and statutory statements to confirm | {len(rows)} statements |\n| [KI-05](KI-05_Governance_Reviews_and_Approvals.md) | People, reviews and approvals | {len(KI05)} |\n| [KI-06](KI-06_Authored_Scope_Pending_Approval.md) | Authored scope awaiting decisions | {len(KI06)} |\n"
t += "\n## All issues\n\n| ID | Issue | Owner (role) | Needed by | Status | Register |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n"
t += "".join(f"| {r[0]} | {esc(r[1])} | {esc(r[5])} | {esc(r[6])} | {esc(r[7])} | [{k}]({files[k]}) |\n" for k, r in allrows)
t += "\n## How issues are closed\n\n```mermaid\nflowchart LR\n    I[\"Issue raised\"] --> D[\"Decision by owner\"] --> C[\"Change request\"] --> U[\"Source workbook or document updated\"] --> V[\"Verified by PQA\"] --> X[\"Closed\"]\n```\n"
write("README.md", t)
print("issues:", len(allrows), "legal statements:", len(rows))
