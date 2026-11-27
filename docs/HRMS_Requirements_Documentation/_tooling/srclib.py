"""Shared helpers: load dumped workbooks, parse sheets into records, map rows to domains, render markdown."""
import json, csv, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REQ_DIR = os.path.join(os.path.dirname(HERE), "requirements")     # sibling final package
SRC_DIR = os.path.join(os.path.dirname(HERE), "data-form-process-sheets")
TODAY = os.environ.get("REQ_DATE", "2026-11-05")
sys.path.insert(0, HERE)
from xlsx_dump import read_book

def load(name):
    return read_book(os.path.join(SRC_DIR, ("HR Demo Points" if name == "HR_Demo_Points" else name) + ".xlsx"))

P = load("Nucleus_Process_Flows_and_Process_Maps_v1.0")
F = load("Nucleus_Forms_and_Fields_Complete_MKraft")
B = load("Nucleus_HR_Demo_Points_Build_Sheet_v1_0")
D = load("Nucleus_HRMS_Demo_Dataset_v1_1")
H = load("HR_Demo_Points")
ENDPOINTS = list(csv.DictReader(open(os.path.join(SRC_DIR, "Field_Spec_Impl_Path.csv"))))

SRC_NAMES = {
    "P": "Nucleus — Process Flows & Process Maps v1.0",
    "F": "Nucleus HRMS — Complete Forms & Fields Specification v1.0",
    "B": "Nucleus HR Demo Points Build Sheet v1.0",
    "D": "Nucleus HRMS Demo Dataset v1.1",
    "H": "HR Demo Points (client tracker)",
    "C": "Field_Spec_Impl_Path.csv (form → menu path → CRUD endpoint)",
}

def parse(book, sheet, first_col):
    """Return (header, records). Each record is a dict with '_section' (last § row seen)."""
    rows = book[sheet]
    hi = next(i for i, r in enumerate(rows) if r and r[0].strip() == first_col)
    hdr = [h.strip() for h in rows[hi]]
    recs, section = [], ""
    for r in rows[hi + 1:]:
        if not r or not any(c.strip() for c in r):
            continue
        if r[0].startswith("§"):
            section = r[0].lstrip("§ ").strip()
            continue
        if len([c for c in r if c.strip()]) == 1 and len(r) == 1:
            section = r[0].strip()
            continue
        d = {h: (r[i].strip() if i < len(r) else "") for i, h in enumerate(hdr) if h}
        d["_section"] = section
        recs.append(d)
    return [h for h in hdr if h], recs

def intro(book, sheet, first_col):
    """Rows above the header (title + description)."""
    rows = book[sheet]
    hi = next(i for i, r in enumerate(rows) if r and r[0].strip() == first_col)
    return [r[0] for r in rows[:hi] if r and r[0].strip()]

VENDOR = r"(?:Microsoft Dynamics|Dynamics 365|Dynamics|Oracle NetSuite|NetSuite|Zoho Books|Zoho|QuickBooks|Tally Prime|Tally ERP|Tally|SAP S/4HANA|SAP|Oracle|Odoo)"
CLEAN = [
    (r"API post \((?:\s*" + VENDOR + r"\s*,?)+\)", "API post to the connected ERP system"),
    (r"\bTally XML\b", "ERP-native XML voucher"),
    (VENDOR + r"(?:\s*·\s*" + VENDOR + r")+", "Cloud ERP · On-premise ERP · Accounting package"),
    (r"\b" + VENDOR + r"\b", "ERP system"),
    (r"(ERP system)(?:\s*,\s*ERP system)+", r"\1"),
    (r"\bTeams\s*(?:/|or)\s*Slack\b", "team-chat tools"),
    (r"\bSlack\b", "team chat"),
    (r"(?i)\bWhatsApp Business API\b", "business messaging API"),
    (r"(?i)\bWhatsApp (?:channel|Business)\b", "business messaging channel"),
    (r"(?i)\bover WhatsApp\b", "over the business messaging channel"),
    (r"(?i)\bWhatsApp\b", "business messaging"),
    (r"\bAndroid-heavy\b", "mobile-heavy"),
    (r"\bAndroid (?:phones?|devices?)\b", "mobile devices"),
    (r"\bAndroid\b", "mobile"),
    (r"\bActive Directory\s*/\s*Entra ID\b", "enterprise directory"),
    (r"\bActive Directory\b", "enterprise directory"),
    (r"\(?\bWorkday[- ](?:class|style|grade)\b\)?", "enterprise-grade"),
    (r"\s*[\(\[]?\bWorkday\b[:\s][^|.;)\]<]*[\)\]]?", ""),
    (r"\bWorkday\b", "enterprise HCM"),
    (r"\b(?:Outlook|Google) [Cc]alendars?\b", "corporate calendar"),
]
BANNED = re.compile(r"(?i)\b(?:Android|Active Directory|Entra|Workday|SAP|NetSuite|Tally|Zoho|QuickBooks|Dynamics|Oracle|Odoo|Microsoft|Google|Outlook|Slack|WhatsApp|Darwinbox|SuccessFactors|Peakon|VNDLY)\b")

def clean(v):
    v = "" if v is None else str(v)
    for pat, rep in CLEAN:
        v = re.sub(pat, rep, v)
    return v

def cell(v):
    v = clean(v)
    if re.fullmatch(r"-?\d+\.0", v):
        v = v[:-2]
    return v.replace("|", "\\|").replace("\r", "").replace("\n", "<br>").strip()

def table(recs, cols, labels=None):
    if not recs:
        return "_No entries in source for this scope._\n"
    labels = labels or cols
    keep = [i for i, c in enumerate(cols) if "workday" not in c.lower() and "workday" not in labels[i].lower()]
    cols, labels = [cols[i] for i in keep], [labels[i] for i in keep]
    out = ["| " + " | ".join(labels) + " |", "| " + " | ".join(":---" for _ in cols) + " |"]
    for r in recs:
        out.append("| " + " | ".join(cell(r.get(c, "")) for c in cols) + " |")
    return "\n".join(out) + "\n"

# ---------------------------------------------------------------- domains
DOMAINS = [
    ("PLT", "Platform & Foundations", "01_PLT_Platform_and_Foundations"),
    ("PPL", "People Core", "02_PPL_People_Core"),
    ("TIM", "Time & Attendance", "03_TIM_Time_and_Attendance"),
    ("LVE", "Leave", "04_LVE_Leave"),
    ("PAY", "Payroll", "05_PAY_Payroll"),
    ("CMP", "Compliance", "06_CMP_Compliance"),
    ("LCY", "Lifecycle", "07_LCY_Lifecycle"),
    ("SSV", "Self-service & Helpdesk", "08_SSV_Self_Service_and_Helpdesk"),
    ("CMB", "Compensation, Loans & Benefits", "09_CMB_Compensation_Loans_and_Benefits"),
    ("TAL", "Talent", "10_TAL_Talent"),
    ("CTG", "Contingent Workforce", "11_CTG_Contingent_Workforce"),
    ("EXP", "Experience", "12_EXP_Experience"),
    ("FIN", "Finance & ERP", "13_FIN_Finance_and_ERP"),
    ("INT", "Intelligence & Agents", "14_INT_Intelligence_and_Agents"),
]
DOM_CODES = [d[0] for d in DOMAINS]
DOM_NAME = {d[0]: d[1] for d in DOMAINS}
DOM_DIR = {d[0]: d[2] for d in DOMAINS}

BUILD_MOD = {"EMP": "PPL", "ATT": "TIM", "SHF": "TIM", "LVE": "LVE", "OTM": "TIM", "GPS": "TIM",
             "PAY": "PAY", "LON": "CMB", "FNF": "LCY", "STA": "CMP", "REC": "TAL", "ONB": "LCY",
             "ENG": "EXP", "DOC": "EXP", "ORG": "PPL", "INT": "FIN", "SEC": "PLT", "RPT": "INT"}
TC_AREA = {"Attendance": "TIM", "Leave": "LVE", "Payroll": "PAY", "Finance": "FIN", "Integration": "FIN",
           "Security": "PLT", "Loans": "CMB", "Exit": "LCY", "Talent": "TAL", "Compliance": "CMP",
           "Experience": "EXP", "Platform": "PLT"}
EVENT_DOM = {"payroll": "PAY", "time": "TIM", "people": "PPL", "leave": "LVE", "loan": "CMB",
             "compliance": "CMP", "lifecycle": "LCY", "integration": "FIN", "experience": "EXP",
             "agent": "INT", "talent": "TAL"}
SM_DOM = {"payroll_run": "PAY", "attendance_day": "TIM", "leave_request": "LVE", "loan": "CMB",
          "clearance_item / F&F": "LCY", "requisition": "TAL", "rule_pack": "CMP", "agent action": "INT"}
SWIM_DOM = {"SM-1": "TIM", "SM-2": "TIM", "SM-3": "LVE", "SM-4": "TIM", "SM-5": "PAY", "SM-6": "CMB",
            "SM-7": "LCY", "SM-8": "FIN", "SM-9": "LCY"}
RULE_SECTION = {"PLATFORM, SCOPE AND APPROVAL": "PLT", "PEOPLE CORE": "PPL", "LEAVE": "LVE", "PAYROLL": "PAY",
                "COMPLIANCE": "CMP", "LIFECYCLE": "LCY", "SELF-SERVICE AND ASSISTANT": "SSV", "LOANS": "CMB",
                "FINANCE AND INTEGRATION": "FIN", "AGENTS": "INT"}
API_DOM = [("/v1/people", ["PPL"]), ("/v1/assignments", ["PPL"]), ("/v1/attendance", ["TIM"]),
           ("/v1/gate-passes", ["TIM"]), ("/v1/leave", ["LVE"]), ("/v1/payroll/journal", ["FIN", "PAY"]),
           ("/v1/payroll", ["PAY"]), ("/v1/loans", ["CMB"]), ("/v1/requisitions", ["TAL"]),
           ("/v1/compliance", ["CMP"]), ("/v1/integration", ["FIN", "PPL"]), ("/v1/webhooks", ["PLT"]),
           ("read_employee", ["PPL"]), ("list_exceptions", ["TIM"]), ("propose_regularisation", ["TIM"]),
           ("simulate_payroll", ["PAY"]), ("run_pre_audit", ["PAY"]), ("check_loan_eligibility", ["CMB"]),
           ("draft_letter", ["EXP"]), ("assemble_filing_pack", ["CMP"]), ("create_ticket", ["SSV"]),
           ("schedule_interview", ["TAL"]), ("run_report", ["INT"]), ("apply_leave", ["LVE"])]
FLOW_DOM = {"Employee master": ["FIN", "PPL"], "Salary journal": ["FIN", "PAY"],
            "Cost centre, project and department master": ["FIN", "PPL"], "Bank disbursement": ["PAY"],
            "Biometric and access-control devices": ["TIM"], "WhatsApp Business API": ["SSV"],
            "EPFO / ESIC / state portals": ["CMP"], "Background verification": ["LCY", "TAL"],
            "E-signature": ["EXP", "LCY"], "SSO / identity provider": ["PLT"],
            "Contractor / vendor master": ["CTG"], "MCP server": ["INT"]}

def prefixes(text):
    return set(re.findall(r"\b(" + "|".join(DOM_CODES) + r")-\d", text or ""))

def rule_domain(r):
    sec = r["_section"]
    if sec.startswith("TIME"):
        return "TIM"
    if sec in RULE_SECTION:
        return RULE_SECTION[sec]
    found = prefixes(r.get("Consumed by", ""))
    for d in ("TAL", "CTG", "EXP"):
        if d in found:
            return d
    return "TAL"

def api_domains(name):
    for key, doms in API_DOM:
        if name.startswith(key):
            return doms
    return ["PLT"]

def form_domain(module):
    return (module or "").split(" ")[0]

# ---------------------------------------------------------------- page chrome
def logo(depth):
    up = "../" * depth
    return (f'<p align="right">\n<picture>\n'
            f'  <source media="(prefers-color-scheme: dark)" srcset="{up}assets/MultipliersKraftLogoDark.png">\n'
            f'  <img src="{up}assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">\n'
            f'</picture>\n</p>\n')

DOM_BG = {"PLT": "BG-06, BG-07, BG-10", "PPL": "BG-01", "TIM": "BG-03", "LVE": "BG-01, BG-03", "PAY": "BG-04",
          "CMP": "BG-04, BG-06", "LCY": "BG-01", "SSV": "BG-02, BG-03", "CMB": "BG-04, BG-05", "TAL": "BG-05",
          "CTG": "BG-03", "EXP": "BG-05", "FIN": "BG-07", "INT": "BG-02, BG-08"}

def header(doc_id, title, owner, cmmi, related, sources, depth, approver="Product Council", status="Issued for approval",
           classification="Internal", version="1.0.0", trace="BG-01 – BG-10 (programme level)"):
    src = "<br>".join(sources)
    return f"""{logo(depth)}
# {doc_id} — {title}

| Attribute | Value |
| :--- | :--- |
| Document ID | {doc_id} |
| Title | {title} |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | {version} |
| Status | {status} |
| Owner (role) | {owner} |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | {approver} — *pending* |
| Date | {TODAY} |
| Classification | {classification} |
| CMMI practice areas | {cmmi} |
| Related documents | {related} |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | {trace} |
| Source of record | {src} |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

"""

def revision(change="Consolidated release", cr="CR-0001"):
    return f"""
## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | {TODAY} | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| Approval authority (DOC-01 §7) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | {{{{SIZE}}}} | specified items (table rows) | Counted automatically at generation |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | items / hour | Compare with PPB control limits |
| Requirement volatility (changes since baseline) | 0 | CRs touching this artefact | Not yet baselined (CM-03) |

**Defects found, by detection phase and severity**

| Detection phase | Major | Minor | Editorial | Injected in phase (major) |
| :--- | :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 | — |
| Peer review | *pending* | | | |
| Design / build | | | | |
| System / integration test | | | | |
| UAT | | | | |
| Production (escaped) | | | | each escaped major opens a CAR record (CAR-01) |

Within control limits of the review-rate PPB? *To be assessed at peer review.*

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | {TODAY} | Dhanraj Dadhich | {change} | {cr} | *pending* |
"""


# ---------------------------------------------------------------- Mermaid helpers
def ml(text, n=58):
    t = clean(text)
    t = re.sub(r"<br\s*/?>", " ", t)
    t = t.replace('"', "'").replace("|", "/").replace("#", "No.").replace(";", ",").replace("<", "").replace(">", "")
    t = t.replace("[", "(").replace("]", ")").replace("{", "(").replace("}", ")").replace("`", "'")
    t = re.sub(r"\s+", " ", t).strip()
    return (t[: n - 1] + "…") if len(t) > n else t

def wrap(text, width=30):
    """Wrap a Mermaid label onto several lines with <br/> at word boundaries."""
    out, line = [], ""
    for w in text.split():
        if line and len(line) + 1 + len(w) > width:
            out.append(line); line = w
        else:
            line = f"{line} {w}".strip()
    if line: out.append(line)
    return "<br/>".join(out)

def mid(text):
    return re.sub(r"[^A-Za-z0-9_]", "_", str(text)).strip("_") or "X"

def mermaid(body):
    return "```mermaid\n" + body.rstrip() + "\n```\n"
