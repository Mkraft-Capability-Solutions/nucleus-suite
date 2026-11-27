"""One-off normaliser for hand-written documents in requirements/ (v1.0.0 consolidation)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srclib import clean, REQ_DIR
TPL = {"00": "the standard document blocks (DOC-01 §4)", "01": "the domain pack structure (DOC-01 §3)", "02": "the functional requirement format (REQ-01)",
       "03": "the use-case and user-story format (FRS-<DOM>-12/13)", "04": "the data model and interface format (DA-01, ICD-01)", "05": "the screen specification format (FRS-<DOM>-04)",
       "06": "the NFR format (NFR-01)", "07": "the AI feature specification and model card (GOV-11)", "08": "the change request record (CM-02)", "09": "the peer review record (QA-02)",
       "10": "the decision record (DAR-01)", "11": "the meeting minutes record (GOV-04)", "12": "the status report (MC-01)", "13": "the test case specification (MTP-01)",
       "14": "the lessons-learned record (PCM-01)", "15": "the causal analysis record (CAR-01)", "16": "the process performance baseline record (MPM-01)"}
FOLD = [("03_Business_Architecture_and_Glossary", "03_Business_Requirements"), ("03_Business_Architecture", "03_Business_Requirements"),
        ("04_Functional_Requirements", "06_Functional_Requirements"), ("05_Data_Architecture", "07_Data_Architecture"),
        ("06_Integration_and_API", "08_Integration_and_API"), ("07_AI_and_Agents", "09_AI_and_Agents"),
        ("08_Non_Functional_Requirements", "05_System_Requirements"), ("09_Verification_and_Validation", "10_Verification_and_Validation"),
        ("10_Traceability", "11_Traceability"), ("11_Release_and_Backlog", "12_Release_and_Backlog")]
REV = "## {num}Revision History\n\n| Version | Date | Author | Change summary | CR ref | Approved by |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |\n"
skip = {"GOV-02_Competitive_Benchmark_and_Differentiation.md"}
n = 0
for dp, dn, fs in os.walk(REQ_DIR):
    for f in fs:
        if not f.endswith(".md") or f == "README.md" or f in skip: continue
        p = os.path.join(dp, f); s = open(p).read()
        if "> **Source of record.**" in s: continue                 # generated
        if not re.search(r"^\| Document ID \|", s, re.M): continue   # new agent docs follow the standard already
        o = s
        s = re.sub(r"^\| Version \| .* \|$", "| Version | 1.0.0 |", s, count=1, flags=re.M)
        s = re.sub(r"^\| Status \| .* \|$", "| Status | Issued for approval |", s, count=1, flags=re.M)
        s = re.sub(r"^\| Prepared by \| .* \|$", "| Author | Dhanraj Dadhich |", s, count=1, flags=re.M)
        s = re.sub(r"^\| Author \| (?!Dhanraj)[^|]*\| (\d{4}-\d\d-\d\d|) *\|", lambda m: f"| Author | Dhanraj Dadhich | {m.group(1) or '2026-11-05'} |", s, flags=re.M)
        m = re.search(r"^#{2,3} (\d+\.\s*)?Revision History.*$", s, re.M)
        if m:
            s = s[:m.start()] + REV.format(num=m.group(1) or "")
        # vendor names (outside header of sources) and residual wording
        s = clean(s)
        s = re.sub(r"\b([A-Z]{3})-PG-(\d{3})\b", r"\1-CG-\2", s)
        s = re.sub(r"\bPG-nnn\b", "CG-nnn", s)
        s = re.sub(r"(?i)\bparity[- ]gaps?\b", lambda m: "capability gaps" if m.group(0).lower().endswith("s") else "capability gap", s)
        s = s.replace("Workday_Parity_and_Frontier_Features", "Capability_Coverage_and_Frontier_Features").replace("RB-03_Parity_and_Frontier_Roadmap", "RB-03_Capability_Gap_and_Frontier_Roadmap")
        s = s.replace("GOV-02_Competitive_Benchmark_and_Differentiation", "GOV-02_Capability_Coverage_and_Differentiation").replace("Competitive Benchmark and Differentiation", "Capability Coverage and Differentiation")
        s = re.sub(r"\bTPL-(\d\d)\s*(?:\.\.|–|-|to)\s*(?:TPL-)?(\d\d)\b", "the standard artefact formats (DOC-01 §4)", s)
        s = re.sub(r"\bTPL-(\d\d)\b", lambda m: TPL.get(m.group(1), "the standard artefact formats (DOC-01 §4)"), s)
        s = re.sub(r"`?99_Templates/?`?", "the process asset library", s)
        s = re.sub(r"`?_archive[^`\s]*`?", "superseded history (CM-01)", s)
        s = re.sub(r"`?_tooling[^`\s]*`?", "the configuration-controlled source workbooks", s)
        for a, b in FOLD: s = s.replace(a, b)
        if s != o: open(p, "w").write(s); n += 1
print("normalised", n)
