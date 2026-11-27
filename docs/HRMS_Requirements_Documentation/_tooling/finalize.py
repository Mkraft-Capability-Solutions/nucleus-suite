"""Post-process requirements/: logo on every doc, link repair, DOC-02 register, folder READMEs (v1.0.0)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srclib import logo, TODAY, REQ_DIR as REQ

def mds():
    for dp, dn, fs in os.walk(REQ):
        dn[:] = sorted(dn)
        for f in sorted(fs):
            if f.endswith(".md"):
                yield os.path.join(dp, f)

index = {}
for p in mds(): index.setdefault(os.path.basename(p), p)
ALIASES = {"GOV-02_Competitive_Benchmark_and_Differentiation.md": "GOV-02_Capability_Coverage_and_Differentiation.md",
           "RB-03_Parity_and_Frontier_Roadmap.md": "RB-03_Capability_Gap_and_Frontier_Roadmap.md"}
fixed = broken = 0
for p in mds():
    t = open(p).read()
    depth = os.path.relpath(p, REQ).count(os.sep)
    if "MultipliersKraftLogo" not in t: t = logo(depth) + "\n" + t
    def rep(m):
        global fixed, broken
        label, target, anchor = m.group(1), m.group(2), m.group(3) or ""
        if target.startswith(("http", "#", "/", "mailto")): return m.group(0)
        if os.path.exists(os.path.normpath(os.path.join(os.path.dirname(p), target))): return m.group(0)
        base = os.path.basename(target)
        base = ALIASES.get(base, re.sub(r"_Workday_Parity_and_Frontier_Features", "_Capability_Coverage_and_Frontier_Features", base))
        if base in index:
            fixed += 1
            return f"[{label}]({os.path.relpath(index[base], os.path.dirname(p))}{anchor})"
        broken += 1; print("BROKEN", os.path.relpath(p, REQ), target)
        return m.group(0)
    t = re.sub(r"\[([^\]]*)\]\(([^)#\s]+\.md)(#[^)\s]*)?\)", rep, t)
    open(p, "w").write(t)
print("links fixed:", fixed, "broken:", broken)

def hdr(p):
    d = {}
    for ln in open(p).read().split("\n## ")[0].splitlines():
        m = re.match(r"^\| ([^|]+?) \| (.*) \|$", ln)
        if m: d[m.group(1).strip()] = m.group(2).strip()
    return d

def esc(s): return (s or "").replace("|", "\\|")
docs = [(p, hdr(p)) for p in mds()]
docs = [(p, h) for p, h in docs if h.get("Document ID") and not (os.path.basename(p) == "README.md" and not h["Document ID"].startswith("FRS-"))]

reg = os.path.join(REQ, "00_Programme_Governance/01_Document_Control/DOC-02_Master_Document_Register.md")
docs = [(p, h) for p, h in docs if p != reg]
rows = []
for p, h in docs:
    rel = os.path.relpath(p, os.path.dirname(reg))
    appr = re.sub(r"\s*—?\s*\*pending\*", "", h.get("Approved by", "")).strip() or "—"
    rows.append(f"| [{h['Document ID']}]({rel}) | {esc(h.get('Title',''))} | `{os.path.relpath(os.path.dirname(p), REQ)}` | {esc(h.get('Owner (role)',''))} | {esc(appr)} | {esc(h.get('CMMI practice areas',''))} | {esc(h.get('Version',''))} | {esc(h.get('Status',''))} |")
folders = sorted({os.path.relpath(os.path.dirname(p), REQ).split(os.sep)[0] for p, _ in docs})
pie = "\n".join(f'    "{f[:2]}" : {sum(1 for p, _ in docs if os.path.relpath(p, REQ).startswith(f))}' for f in folders)
text = logo(2) + f"""
# DOC-02 — Master Document Register

| Attribute | Value |
| :--- | :--- |
| Document ID | DOC-02 |
| Title | Master Document Register |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Configuration Manager |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Steering Committee — *pending* |
| Date | {TODAY} |
| Classification | Internal |
| CMMI practice areas | CM, PAD |
| Related documents | DOC-01, CM-01, SRC-01, TR-04 |
| Quality & process-performance objectives | QPPO-06 (fast, controlled change) |
| Process performance baseline used | PPB-07 (CR cycle time) |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-09 |

---

## 1. Purpose

Lists every controlled document of Nucleus Suite release 1.0.0 with its owner, approval authority, CMMI coverage, version and status. The Configuration Manager keeps it in step with the repository at every change (CM-01) and snapshots it at each gate. Controlled documents: **{len(rows)}**.

## 2. Documents by folder

```mermaid
pie showData title Controlled documents by top-level folder
{pie}
```

## 3. Register

| Doc ID | Title | Folder | Owner (role) | Approval authority | CMMI | Version | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
""" + "\n".join(rows) + f"""

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | {TODAY} | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| Steering Committee | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | {len(rows)} | registered documents | |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Requirement volatility | 0 | CRs since baseline | |

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | {TODAY} | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
"""
open(reg, "w").write(text)

PURPOSE = {
 "00_Programme_Governance": "Why the programme exists, who decides, and the conventions every document follows.",
 "00_Programme_Governance/01_Document_Control": "Document control standard and master register.",
 "00_Programme_Governance/02_Vision_and_Scope": "Vision, scope, business goals, capability coverage and differentiation.",
 "00_Programme_Governance/03_Charter_and_Governance_Model": "Project charter, governance bodies, decision rights and gates.",
 "00_Programme_Governance/04_Stakeholders_and_Personas": "Stakeholder register, RACI, personas and communication plan.",
 "00_Programme_Governance/05_Data_and_AI_Governance": "Data governance, privacy and responsible AI.",
 "00_Programme_Governance/06_Source_Workbooks": "Register of the source workbooks behind the functional requirements.",
 "01_Project_Management": "Planning, estimation, risk, measurement, monitoring, decisions, suppliers and organisational change.",
 "01_Project_Management/01_Planning_and_Estimation": "Project management plan, WBS and roadmap, estimation.",
 "01_Project_Management/02_Risk_Issue_and_Dependency": "Risk management plan, risk register, RAID log.",
 "01_Project_Management/03_Measurement_and_Control": "Quantitative management (QPPO, PPB, PPM) and monitoring and control.",
 "01_Project_Management/04_Decision_Management": "Decision analysis and resolution, decision log.",
 "01_Project_Management/05_Supplier_Management": "Supplier agreement management.",
 "01_Project_Management/06_Organizational_Change_Management": "Adoption strategy and end-user enablement.",
 "02_Engineering_Process": "How requirements are managed, configured, assured and continuously improved.",
 "02_Engineering_Process/01_Requirements_Management": "Requirements management plan and quality checklist.",
 "02_Engineering_Process/02_Configuration_and_Change_Control": "Configuration management, change control and the change request log.",
 "02_Engineering_Process/03_Quality_Assurance": "Quality management, peer review and process audit.",
 "02_Engineering_Process/04_Process_Improvement_and_Training": "Process definition and tailoring, causal analysis, organisational training.",
 "03_Business_Requirements": "Business requirements, concept of operations, capability model, glossary and process architecture.",
 "04_Stakeholder_Requirements": "Stakeholder and user requirements.",
 "05_System_Requirements": "System-level requirements: SRS, non-functional, security, operations, notifications, reporting, localisation.",
 "07_Data_Architecture": "Data dictionary, picklists, enumerations, configuration, form conventions and data migration.",
 "08_Integration_and_API": "API and tool surface, events, integration flows and interface control.",
 "09_AI_and_Agents": "Agent catalogue, tool governance and frontier AI.",
 "10_Verification_and_Validation": "V&V strategy, master test plan, UAT plan, test catalogue, acceptance tests and golden dataset.",
 "11_Traceability": "Traceability matrix, client requirement register, demo-point traceability and source coverage.",
 "12_Release_and_Backlog": "Phased build backlog, open decisions and the capability-gap and frontier roadmap.",
}
for rel, purpose in PURPOSE.items():
    d = os.path.join(REQ, rel)
    if not os.path.isdir(d): continue
    depth = rel.count("/") + 1
    subs = sorted(x for x in os.listdir(d) if os.path.isdir(os.path.join(d, x)))
    files = [(p, h) for p, h in docs if os.path.dirname(p) == d] + ([(reg, hdr(reg))] if d == os.path.dirname(reg) else [])
    files.sort(key=lambda x: x[1]["Document ID"])
    title = rel.split("/")[-1].split("_", 1)[1].replace("_", " ")
    t = logo(depth) + f"\n# {title}\n\n**Nucleus Suite (Nucleus HRMS Suite)** · {purpose}\n\n"
    if subs: t += "## Sub-folders\n\n| Folder | Purpose |\n| :--- | :--- |\n" + "".join(f"| [{s.split('_', 1)[1].replace('_', ' ')}]({s}/README.md) | {PURPOSE.get(rel + '/' + s, '')} |\n" for s in subs)
    if files: t += "\n## Documents\n\n| Doc ID | Title | Owner (role) | Version | Status |\n| :--- | :--- | :--- | :--- | :--- |\n" + "".join(f"| [{h['Document ID']}]({os.path.basename(p)}) | {esc(h.get('Title',''))} | {esc(h.get('Owner (role)',''))} | {esc(h.get('Version',''))} | {esc(h.get('Status',''))} |\n" for p, h in files)
    t += f"\nConventions: [DOC-01]({os.path.relpath(index.get('DOC-01_Document_Control_Standard.md', ''), d)}) · Register: [DOC-02]({os.path.relpath(reg, d)})\n"
    open(os.path.join(d, "README.md"), "w").write(t)
print("register rows:", len(rows))
