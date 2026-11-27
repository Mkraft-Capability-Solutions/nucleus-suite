"""Generate the source-derived documents of requirements/ (v1.0.0)."""
import os, re, sys, json, glob, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from srclib import *
from authored import CG, FX

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else REQ_DIR
UCDIR = os.environ.get("UC_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "usecases"))  # <DOM>.json use-case files
USED = collections.defaultdict(set)
WRITTEN = {}
FINDINGS = {}
_CATF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "authored_catalogue.json")
CAT = json.load(open(_CATF)) if os.path.exists(_CATF) else {"apis": [], "events": [], "objects": []}
def cat_rows(kind, dom=None):
    return [r for r in CAT.get(kind, []) if dom is None or r.get("Domain") == dom]

F_DIR = "06_Functional_Requirements"
TIER = {"T0": "No AI", "T1": "Tier 1", "T2": "Tier 2", "T3": "Tier 3", "T4": "Tier 4"}

def use(bk, sheet): USED[bk].add(sheet)

def p(bk, sheet, first):
    use(bk, sheet)
    return parse({"P": P, "F": F, "B": B, "D": D, "H": H}[bk], sheet, first)

def count_items(text):
    body = text.split("## Approval & Sign-off")[0]
    n, tables, prev, in_code = 0, 0, "", False
    for ln in body.splitlines():
        if ln.startswith("```"): in_code = not in_code
        if in_code: continue
        if ln.startswith("| :") or ln.startswith("| ---"):
            tables += 1
        elif ln.startswith("| ") and tables > 1 and prev.startswith("|"):
            n += 1
        prev = ln
    return n

def guard(text, rel):
    out, in_code = [], False
    for ln in text.splitlines():
        if ln.startswith("```"): in_code = not in_code
        if BANNED.search(ln):
            ln = clean(ln)
            if BANNED.search(ln):
                print("BANNED TERM LEFT:", rel, ln[:120])
        out.append(ln)
    return "\n".join(out) + "\n"

def write(rel, text):
    text = text.replace("{{SIZE}}", str(count_items(text)))
    text = guard(text, rel)
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(text)
    WRITTEN[rel] = text

def drop(cols, *names): return [c for c in cols if c not in names]
def src(bk, *sheets): return f"{SRC_NAMES[bk]} — sheet(s) {', '.join(sheets)}"
def keys(rows): return [k for k in (rows[0].keys() if rows else []) if k != "_section"]

# ------------------------------------------------------------------ load
arch_h, arch = p("P", "02_Process_Architecture", "ID / prefix")
inv_h, inv = p("P", "03_Process_Inventory", "Process ID")
stp_h, stp = p("P", "04_Process_Steps", "Process ID")
sw_h, sw = p("P", "05_Swimlane_Maps", "Map")
dd_h, dd = p("P", "06_Data_Dictionary", "Object")
scr_h, scr = p("P", "07_Screens", "Screen ID")
ff_h, ff = p("P", "08_Form_Fields", next(r[0] for r in P["08_Form_Fields"] if len(r) > 4))
rl_h, rl = p("P", "09_Business_Rules", "Rule ID")
ct_h, ct = p("P", "10_Config_Tables", "Config table")
sm_h, sm = p("P", "11_State_Machines", "Object")
ev_h, ev = p("P", "12_Events", "Event")
api_h, api = p("P", "13_API_and_Tools", "Surface")
ag_h, ag = p("P", "14_Agents", "Agent")
fl_h, fl = p("P", "15_Integration_Flows", "Flow")
ru_h, ru = p("P", "16_Reuse_Register", "Component")
tr_h, tr = p("P", "17_Traceability", "Pt")
tc_h, tc = p("P", "19_Test_Cases", "Case ID")
bl_h, bl = p("P", "18_Build_Backlog", "ID")
nfr_h, nfr = p("P", "20_NFR_and_DoD", "Requirement")
ro_h, ro = p("P", "21_Roles_and_RACI", "Persona")
od_h, od = p("P", "22_Open_Decisions", "ID")
fi_h, fi = p("F", "01_Form_Index", "Form ID")
fs_h, fs = p("F", "02_Field_Spec", "Form ID")
pl_h, pl = p("F", "03_Picklists", "Picklist code")
br_h, br = p("B", "01_Requirement_Register", "Req ID")
bm_h, bm = p("B", "02_Module_Index", "Module ID")
bf_h, bf = p("B", "03_Forms_and_Screens", "Form ID")
bfs_h, bfs = p("B", "04_Field_Specification", "Form ID")
brl_h, brl = p("B", "05_Rules_and_Calculations", "Rule ID")
ben_h, ben = p("B", "06_Enum_Values", "Enum code")
bw_h, bw = p("B", "07_Approval_Workflows", "Workflow ID")
brp_h, brp = p("B", "08_Reports_and_Outputs", "Report ID")
bc_h, bc = p("B", "09_Configuration_Register", "Config item")
bt_h, bt = p("B", "10_Acceptance_Tests", "Test ID")
bq_h, bq = p("B", "11_Open_Questions", "Question ID")
btm_h, btm = p("B", "12_Traceability_Matrix", "Req ID")
hd_h, hd = p("H", "Sheet1", "S No.")
_, dsw = p("D", "64_Approval_Workflows", "Workflow")
_, dat = p("D", "68_Acceptance_Test_Data", "Test")
_, drp = p("D", "67_Reports_Register", "Report")
_, dens = p("D", "65_Enum_Seed_Values", "Enum code")
datm = {r["Test"]: r for r in dat}
fi = [r for r in fi if r.get("Form ID", "").startswith("FRM-")]
fs = [r for r in fs if r.get("Form ID", "").startswith("FRM-")]
EP = {r["Form ID"]: r for r in ENDPOINTS}
for r in brl: r["Rule ID"] = "BS:" + r["Rule ID"]
ALL_OBJ = {r["Object"] for r in dd}

def bmod(code): return BUILD_MOD.get((code or "").strip(), "")
def req_dom(rid):
    r = next((x for x in br if x["Req ID"] == (rid or "").strip()), None)
    return bmod(r["Module"]) if r else ""
def form_bdom(fid):
    m = re.match(r"F-([A-Z]+)-", fid or "")
    return bmod(m.group(1)) if m else ""

DS_DOM = {
 "02_Legal_Entities": "PLT", "03_Locations": "PLT", "04_Org_Units": "PPL", "05_Designations": "PPL",
 "06_Worker_Classes": "PPL", "07_Shifts": "TIM", "08_Attendance_Rules": "TIM", "09_Holiday_Calendar": "LVE",
 "10_Sanctioned_Manpower": "PPL", "11_Positions": "PPL", "12_Employees": "PPL", "13_Salary_Structure": "CMB",
 "14_Leave_Types": "LVE", "15_Leave_Accrual_Policy": "LVE", "16_Leave_Proration": "LVE", "17_Leave_Ledger": "LVE",
 "18_Leave_Requests": "LVE", "19_CompOff_Ledger": "LVE", "20_Punch_Events": "TIM", "21_Expected_Attendance": "TIM",
 "22_Gate_Pass": "TIM", "23_Overtime_Register": "TIM", "24_Loans": "CMB", "25_Loan_Guarantors": "CMB",
 "26_Payroll_Runs": "PAY", "27_Exit_Clearance": "LCY", "28_Statutory_Calendar": "CMP", "29_Statutory_Forms": "CMP",
 "30_Recognition_Referral": "EXP", "31_Announcements": "EXP", "32_Letter_Templates": "EXP", "33_Assets": "LCY",
 "34_Induction_Learning": "LCY", "35_GL_Mapping": "FIN", "36_ERP_Inbound_Master": "FIN", "37_Requisitions": "TAL",
 "38_Employment_Categories": "PPL", "39_Leave_Schemes": "LVE", "40_Leave_Rules_Matrix": "LVE",
 "41_Grace_Late_Policy": "TIM", "42_Night_Extension_Rule": "TIM", "43_Roles_and_Data_Scope": "PLT",
 "44_Demo_Users": "PLT", "45_Vendors_Contractors": "CTG", "46_Contractor_Invoices": "CTG", "47_Pay_Components": "PAY",
 "48_PT_Slabs": "PAY", "49_Break_Register": "TIM", "50_Attendance_Regularisation": "TIM",
 "51_Attendance_Exceptions": "TIM", "52_Shift_Roster": "TIM", "53_Leave_Balance_AsOn": "LVE",
 "54_Year_End_Leave_Preview": "LVE", "55_Payroll_Register": "PAY", "56_GL_Journal": "FIN", "57_Bank_File": "PAY",
 "58_FnF_Settlement": "PAY", "59_Candidates_and_Offers": "TAL", "60_Confirmations": "LCY",
 "61_Preboarding_Chain": "LCY", "62_Documents": "PPL", "63_Helpdesk_Tickets": "SSV", "64_Approval_Workflows": "PLT",
 "67_Reports_Register": "INT",
}

def ds_table(sheet):
    use("D", sheet)
    rows = D[sheet]; hdr = rows[0]
    keep = [i for i, h in enumerate(hdr) if h]
    recs = [{hdr[i]: (r[i] if i < len(r) else "") for i in keep} for r in rows[1:] if any(c.strip() for c in r)]
    return table(recs, [hdr[i] for i in keep]), len(recs)

# ------------------------------------------------------------------ Mermaid builders
SHAPE = {"DEC": ('{"', '"}'), "APPR": ('[["', '"]]'), "INT": ('(["', '"])'), "AGENT": ('(["', '"])'), "WAIT": ('(["', '"])')}
def process_flow(steps):
    lines = ['%%{init: {"flowchart": {"wrappingWidth": 320}}}%%', "flowchart TD"]
    prev = None
    for i, s in enumerate(steps, 1):
        o, c = SHAPE.get(s.get("Type", "").upper(), ('["', '"]'))
        label = f"{ml(s.get('Step ID',''), 12)} · {ml(s.get('Lane / actor',''), 22)}<br/>{wrap(ml(s.get('Action or decision',''), 140), 34)}"
        lines.append(f"    N{i}{o}{label}{c}")
        if prev: lines.append(f"    N{prev} --> N{i}")
        prev = i
    return mermaid("\n".join(lines))

LANES = [("Employee / worker", "W", "Employee / worker"), ("Manager", "M", "Manager"), ("HR / admin", "H", "HR / admin"),
         ("System (Nucleus)", "S", "Nucleus platform"), ("Agent", "A", "Agent"), ("External", "X", "External")]
def swim_seq(rows):
    lines = ["sequenceDiagram", "    autonumber"]
    present = [l for l in LANES if any(r.get(l[0]) for r in rows)]
    for col, a, label in present: lines.append(f"    participant {a} as {label}")
    prev = None
    for r in rows:
        for col, a, _ in present:
            t = r.get(col)
            if not t: continue
            msg = wrap(ml(t, 90).replace(":", " -"), 28)
            lines.append(f"    Note over {a}: {msg}" if prev in (None, a) else f"    {prev}->>{a}: {msg}")
            prev = a
    return mermaid("\n".join(lines))

def state_diagram(rows):
    lines = ["stateDiagram-v2", "    direction LR"]
    states = [r["State"] for r in rows]
    if states: lines.append(f"    [*] --> {mid(states[0])}")
    for r in rows:
        nxt = [x.strip() for x in re.split(r",|·|/|\bor\b", r.get("Allowed next states", "")) if x.strip() and x.strip() not in ("—", "-", "none", "None")]
        for n in nxt: lines.append(f"    {mid(r['State'])} --> {mid(n)}")
        if not nxt: lines.append(f"    {mid(r['State'])} --> [*]")
    return mermaid("\n".join(lines))

def er_diagram(objs_in_domain):
    fields = collections.defaultdict(set)
    for r in dd:
        for f in re.split(r"[,\s]+", r.get("Fields", "")):
            if f: fields[r["Object"]].add(f.strip())
    edges = set()
    for o in sorted(objs_in_domain):
        for f in sorted(fields[o]):
            if f.endswith("_id") and f not in ("tenant_id", f"{o}_id"):
                base = f[:-3]
                if base in ALL_OBJ and base != o:
                    edges.add((base, o, f))
    if not edges: return ""
    edges = sorted(edges)[:22]
    lines = ["erDiagram"] + [f'    {mid(a)} ||--o{{ {mid(b)} : "{f}"' for a, b, f in edges]
    return mermaid("\n".join(lines))

def seam_graph():
    lines = ["flowchart LR"]
    for d in DOM_CODES: lines.append(f'    {d}["{d} · {ml(DOM_NAME[d], 28)}"]')
    for r in arch:
        if not r["ID / prefix"].startswith("S-"): continue
        m = re.match(r"\s*([A-Z]{3})\s*→\s*([A-Z]{3}|all)", r.get("Name", ""))
        if not m: continue
        a, b = m.groups()
        if b == "all": lines.append(f'    {a} -. "{r["ID / prefix"]} governs all" .-> {a}')
        else: lines.append(f'    {a} -- "{r["ID / prefix"]}" --> {b}')
    return mermaid("\n".join(lines))

def landscape():
    lines = ["flowchart LR", '    N(["Nucleus Suite"])']
    for i, r in enumerate(fl, 1):
        name = ml(r["Flow"], 34); d = r.get("Direction", "")
        lines.append(f'    E{i}["{name}"]')
        if "Both" in d or "↔" in d: lines.append(f"    E{i} <--> N")
        elif d.strip().startswith("Nucleus"): lines.append(f"    N --> E{i}")
        else: lines.append(f"    E{i} --> N")
    return mermaid("\n".join(lines))

# ------------------------------------------------------------------ use cases
UCS = {}
if UCDIR:
    for f in sorted(glob.glob(os.path.join(UCDIR, "*.json"))):
        data = json.load(open(f))
        UCS.setdefault(data["domain"], []).extend(data["use_cases"])
    for _d in UCS:
        UCS[_d].sort(key=lambda u: int(u["id"].rsplit("-", 1)[1]))

def uc_actor_diagram(ucs):
    out = ""
    for k in range(0, len(ucs), 10):
        chunk = ucs[k:k + 10]
        actors = list(dict.fromkeys(u["primary_actor"] for u in chunk))
        lines = ["flowchart LR"]
        lines += [f'    A{i}(["{ml(a, 30)}"])' for i, a in enumerate(actors)]
        lines += [f'    U{j}["{u["id"]}<br/>{ml(u["name"], 40)}"]' for j, u in enumerate(chunk)]
        lines += [f"    A{actors.index(u['primary_actor'])} --- U{j}" for j, u in enumerate(chunk)]
        out += mermaid("\n".join(lines)) + "\n"
    return out

def uc_seq(u):
    actors = list(dict.fromkeys(s["actor"] for s in u["main_flow"]))[:7]
    lines = ["sequenceDiagram", "    autonumber"] + [f"    participant P{i} as {wrap(ml(a, 40).replace(':', ' '), 16)}" for i, a in enumerate(actors)]
    prev = None
    for s in u["main_flow"]:
        if s["actor"] not in actors: continue
        a = f"P{actors.index(s['actor'])}"
        msg = wrap(ml(s["action"], 96).replace(":", " -"), 30)
        lines.append(f"    Note over {a}: {msg}" if prev in (None, a) else f"    {prev}->>{a}: {msg}")
        prev = a
    return mermaid("\n".join(lines))

def L(x): return ", ".join(x) if x else "—"

def cg_tests(dom, ucs):
    out, n = [], 0
    for u in ucs:
        if not u.get("capability_gap"): continue
        ids = []
        for s in u.get("user_stories", []):
            for a in s.get("acceptance", []):
                n += 1
                tid = f"{dom}-TC-{n:03d}"
                ids.append(tid)
                out.append({"Test ID": tid, "Use case": u["id"], "Capability gap": u["capability_gap"], "User story": s["id"],
                            "Given": a["given"], "When": a["when"], "Then (expected result)": a["then"], "Level": "System / acceptance", "Method": "Test"})
        u["_authored_tests"] = ids
    return out

def uc_doc(dom, ucs, H):
    t = H(12, "Use Case Specifications", "RDM, VV", [src("P", "03_Process_Inventory", "04_Process_Steps", "07_Screens", "09_Business_Rules"), "Authored use cases (marked per use case)"])
    n_src = sum(1 for u in ucs if u["source"].startswith("Source"))
    t += f"This document specifies {len(ucs)} use cases for {DOM_NAME[dom]}: {n_src} follow the step-level flows of the source workbook and {len(ucs) - n_src} are authored (processes without step-level detail in the source, and capability gaps). User stories derived from each use case are in FRS-{dom}-13.\n\n"
    t += "## 1. Use case index\n\n| ID | Use case | Primary actor | Realises | Source | Phase | Criticality |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n"
    t += "".join(f"| [{u['id']}](#{u['id'].lower()}) | {cell(u['name'])} | {cell(u['primary_actor'])} | {u.get('process') or u.get('capability_gap') or '—'} | {u['source']} | {u.get('phase','')} | {u.get('criticality','')} |\n" for u in ucs)
    t += "\n## 2. Use case diagrams\n\n" + uc_actor_diagram(ucs)
    t += "## 3. Use case specifications\n"
    for u in ucs:
        t += f"\n### {u['id']}\n\n**{cell(u['name'])}** — {cell(u['goal'])}\n\n| Attribute | Value |\n| :--- | :--- |\n"
        rows = [("Realises", u.get("process") or u.get("capability_gap") or "—"), ("Source", u["source"]), ("Level", u.get("level", "")),
                ("Primary actor", u["primary_actor"]), ("Secondary actors", L(u.get("secondary_actors"))),
                ("Trigger", u.get("trigger", "")), ("Frequency", u.get("frequency", "")), ("Criticality", u.get("criticality", "")),
                ("Phase", u.get("phase", "")), ("Client requirements", L(u.get("client_requirements"))),
                ("Business rules", L(u.get("business_rules"))), ("Screens", L(u.get("screens"))),
                ("Data objects (CRUD)", L(u.get("data_objects"))), ("Events", L(u.get("events"))),
                ("Acceptance tests", L((u.get("acceptance_tests") or []) + u.get("_authored_tests", []))),
                ("System requirements", L(u.get("system_requirements")))]
        t += "".join(f"| {a} | {cell(b)} |\n" for a, b in rows)
        if u.get("stakeholders"):
            t += "\n**Stakeholders and interests**\n\n| Stakeholder | Interest |\n| :--- | :--- |\n" + "".join(f"| {cell(s['who'])} | {cell(s['interest'])} |\n" for s in u["stakeholders"])
        t += "\n**Preconditions**\n\n" + "".join(f"- {cell(x)}\n" for x in u.get("preconditions", []))
        t += "\n**Main success scenario**\n\n| # | Actor | Action | Ref |\n| ---: | :--- | :--- | :--- |\n" + "".join(f"| {s['n']} | {cell(s['actor'])} | {cell(s['action'])} | {cell(s.get('ref') or '')} |\n" for s in u["main_flow"])
        t += "\n" + uc_seq(u)
        if u.get("alternate_flows"):
            t += "\n**Alternate flows**\n\n| ID | At step | Condition | Steps | Rejoins |\n| :--- | ---: | :--- | :--- | :--- |\n" + "".join(f"| {a['id']} | {a.get('at_step','')} | {cell(a['condition'])} | {cell(' → '.join(a.get('steps', [])))} | {cell(a.get('rejoin',''))} |\n" for a in u["alternate_flows"])
        if u.get("exception_flows"):
            t += "\n**Exception flows**\n\n| ID | At step | Condition | Handling | Rule |\n| :--- | ---: | :--- | :--- | :--- |\n" + "".join(f"| {e['id']} | {e.get('at_step','')} | {cell(e['condition'])} | {cell(e['handling'])} | {cell(e.get('rule') or '')} |\n" for e in u["exception_flows"])
        t += "\n**Postconditions — success**\n\n" + "".join(f"- {cell(x)}\n" for x in u.get("postconditions_success", []))
        t += "\n**Postconditions — failure**\n\n" + "".join(f"- {cell(x)}\n" for x in u.get("postconditions_failure", []))
        if u.get("nfrs"): t += "\n**Quality requirements**\n\n" + "".join(f"- {cell(x)}\n" for x in u["nfrs"])
    return t + revision()

def us_doc(dom, ucs, H):
    stories = [(u, s) for u in ucs for s in u.get("user_stories", [])]
    t = H(13, "User Stories and Acceptance Criteria", "RDM, VV", ["Derived from FRS-" + dom + "-12 use cases; source rules, tests and golden data"])
    pr = collections.Counter(s.get("priority", "") for _, s in stories)
    t += f"{len(stories)} user stories, each traced to its use case and verified by Given / When / Then acceptance criteria. Priority mix: " + ", ".join(f"{k} {v}" for k, v in pr.most_common()) + ".\n\n"
    t += "## 1. Story index\n\n| ID | As a | I want | Priority | Use case |\n| :--- | :--- | :--- | :--- | :--- |\n"
    t += "".join(f"| {s['id']} | {cell(s['persona'])} | {cell(s['want'])} | {s.get('priority','')} | {u['id']} |\n" for u, s in stories)
    t += "\n## 2. Stories with acceptance criteria\n"
    for u, s in stories:
        t += f"\n### {s['id']} · {cell(u['name'])}\n\nAs a **{cell(s['persona'])}**, I want {cell(s['want'])}, so that {cell(s['so_that'])}.\n\nPriority: **{s.get('priority','')}** · Use case: {u['id']} · Realises: {u.get('process') or u.get('capability_gap') or '—'}\n\n| # | Given | When | Then |\n| ---: | :--- | :--- | :--- |\n"
        t += "".join(f"| {i} | {cell(a['given'])} | {cell(a['when'])} | {cell(a['then'])} |\n" for i, a in enumerate(s.get("acceptance", []), 1))
    return t + revision()

# ------------------------------------------------------------------ per-domain packs
def dom_docs(dom):
    name, ddir = DOM_NAME[dom], DOM_DIR[dom]
    base = f"{F_DIR}/{ddir}/"
    procs = [r for r in inv if r["Process ID"].split("-")[0] == dom]
    pids = {r["Process ID"] for r in procs}
    steps = [r for r in stp if r["Process ID"] in pids]
    rules = [r for r in rl if rule_domain(r) == dom]
    forms = [r for r in fi if form_domain(r["Module"]) == dom]
    fids = {r["Form ID"] for r in forms}
    fields = [r for r in fs if r["Form ID"] in fids]
    screens = [r for r in scr if r.get("Domain") == dom]
    objs = [r for r in dd if r.get("Domain") == dom]
    sms = [r for r in sm if SM_DOM.get(r["_section"]) == dom]
    evs = [r for r in ev if EVENT_DOM.get(r["Event"].split(".")[0]) == dom]
    apis = [r for r in api if dom in api_domains(r["Name"])]
    flows = [r for r in fl if dom in FLOW_DOM.get(r["Flow"], [])]
    dom_tools = {r["Name"] for r in api if r["Surface"] == "TOOL" and dom in api_domains(r["Name"])}
    agents = ag if dom == "INT" else [r for r in ag if any(x in r.get("Tools used", "") for x in dom_tools)]
    tcs = [r for r in tc if TC_AREA.get(r.get("Area")) == dom]
    backlog = [r for r in bl if r.get("Domain") == dom]
    blids = {r["ID"] for r in backlog}
    ods = [r for r in od if set(re.findall(r"BL-\d+", r.get("Blocks", ""))) & blids]
    breqs = [r for r in br if bmod(r["Module"]) == dom]
    bforms = [r for r in bf if bmod(r["Module"]) == dom]
    bfids = {r["Form ID"] for r in bforms}
    bfields = [r for r in bfs if r["Form ID"] in bfids]
    brules = [r for r in brl if bmod(r["Module"]) == dom]
    benums = [r for r in ben if bmod(r["Module"]) == dom]
    bwf = [r for r in bw if form_bdom(r.get("Form ID", "")) == dom]
    breps = [r for r in brp if form_bdom(r.get("Form ID", "")) == dom]
    btests = [r for r in bt if req_dom(r.get("Requirement", "")) == dom]
    bqs = [r for r in bq if bmod(r.get("Module", "")) == dom]
    bconf = [r for r in bc if bmod(r.get("Module", "")) == dom]
    swim = [r for r in sw if SWIM_DOM.get(r.get("Map")) == dom]
    seams = [r for r in arch if r["ID / prefix"].startswith("S-") and dom in r.get("Name", "").replace("all", "")]
    l0 = [r for r in arch if r["ID / prefix"].startswith("L0-") and dom in r.get("Blueprint reference", "")]
    l1 = next((r for r in arch if r["ID / prefix"] == dom), {})
    ds_sheets = [s for s, d in DS_DOM.items() if d == dom]
    cg, fx = CG.get(dom, []), FX.get(dom, [])
    ucs = UCS.get(dom, [])
    nst = sum(len(u.get("user_stories", [])) for u in ucs)
    atc = cg_tests(dom, ucs)
    ALL_ATC.extend(atc)
    anchor = DOM_BG[dom] + (" · " + ", ".join(r["Req ID"] for r in breqs) if breqs else "") + (f" · processes {procs[0]['Process ID']}–{procs[-1]['Process ID']}" if procs else "")
    rel_docs = ", ".join(f"FRS-{dom}-{i:02d}" for i in range(14))

    def H(n, title, cmmi, sources, owner=f"Domain Product Owner — {name}"):
        return header(f"FRS-{dom}-{n:02d}", f"{name} — {title}", owner, cmmi, f"{rel_docs}, BRS-01, SRS-01, REQ-01, REQ-02", sources, 2, trace=anchor)

    counts = [("Processes (DOM-nn)", len(procs)), ("Process steps (DOM-nn.s)", len(steps)), ("Use cases (UC)", len(ucs)),
              ("User stories (US)", nst), ("Business rules (RL-nnn)", len(rules)), ("Client calculation rules (BS:RL-xx)", len(brules)),
              ("Forms (FRM-)", len(forms)), ("Form fields", len(fields)), ("Client form deltas (F-)", len(bforms)),
              ("Client form-delta fields", len(bfields)), ("Screens (SCR-)", len(screens)), ("Data objects", len(objs)),
              ("State-machine states", len(sms)), ("Domain events", len(evs)), ("APIs and agent tools", len(apis)),
              ("Integration flows", len(flows)), ("Agents", len(agents)), ("Test cases (TC-)", len(tcs)), ("Authored test cases (<DOM>-TC)", len(atc)),
              ("Acceptance tests (T-)", len(btests)), ("Backlog stories (BL-)", len(backlog)), ("Open decisions (OD-)", len(ods)),
              ("Open questions (Q-)", len(bqs)), ("Client requirements (R-)", len(breqs)), ("Reference / golden data sheets", len(ds_sheets)),
              ("Capability gaps — authored (CG)", len(cg)), ("Frontier features — authored (FX)", len(fx))]
    findings = []
    no_tc = [r["Rule ID"] for r in rules if not r.get("Test case")]
    if no_tc: findings.append(f"{len(no_tc)} business rule(s) have no linked test case in the source: {', '.join(no_tc[:25])}{' …' if len(no_tc) > 25 else ''}. Test cases are to be added in FRS-{dom}-08 before the requirements baseline.")
    nostep = sorted(pids - {r['Process ID'] for r in steps})
    if nostep: findings.append(f"{len(nostep)} process(es) have no step-level flow in the source ({', '.join(nostep)}); their flows are specified as authored use cases in FRS-{dom}-12.")
    if procs and not tcs and not btests: findings.append("No source test cases are mapped to this domain; acceptance is defined by the user-story criteria in FRS-" + dom + "-13.")
    if procs and not screens: findings.append("No screens are specified in the source for this domain; screen needs are captured in the use cases.")
    findings.append("All requirements in this pack are new requirements; delivery statuses from client trackers are not carried over.")

    # 00
    t = H(0, "Domain Overview", "RDM, TS, PLAN", [src("P", "02_Process_Architecture", "03_Process_Inventory"), src("B", "01_Requirement_Register", "02_Module_Index")])
    t += f"## 1. Domain scope\n\n| Attribute | Value |\n| :--- | :--- |\n| Domain code | `{dom}` |\n| Domain | {name} |\n| Scope | {cell(l1.get('Scope', ''))} |\n| Blueprint reference | {cell(l1.get('Blueprint reference', ''))} |\n| Delivery phase(s) | {cell(l1.get('Phase / tier', ''))} |\n\n"
    t += "## 2. Position in the value chain\n\n" + table(l0, ["ID / prefix", "Name", "Scope", "Phase / tier"], ["L0 ID", "Stage", "Scope", "Tier"])
    t += "\n## 3. Seams with other domains\n\n" + table(seams, ["ID / prefix", "Name", "Scope", "Blueprint reference", "Phase / tier"], ["Seam", "Direction", "What must hold", "Processes", "Phase"])
    t += "\n## 4. Client requirements realised in this domain\n\n" + table(breqs, ["Req ID", "Source point", "Requirement", "Module", "Priority", "What is asked", "What it changes in Nucleus"])
    t += "\n## 5. Requirement inventory\n\n| Artefact | Count |\n| :--- | ---: |\n" + "".join(f"| {a} | {n} |\n" for a, n in counts)
    docs = [(1, "Process_Specifications", "Process Specifications", "Process inventory, step flows (Mermaid), swimlanes, approval workflows"),
            (2, "Business_Rules", "Business Rules", "RL-nnn rules and client calculation rules with worked examples"),
            (3, "Forms_and_Fields", "Forms and Fields", "Every form and field, picklists, menu path and CRUD endpoint"),
            (4, "Screens_Reports_and_UX", "Screens, Reports and UX", "Screens, personas, permission scope, offline, reports"),
            (5, "Data_Model", "Data Model", "Objects, ER diagram, enumerations"),
            (6, "State_Machines_and_Events", "State Machines and Events", "Lifecycle state diagrams, guards, domain events"),
            (7, "APIs_Integrations_and_Agents", "APIs, Integrations and Agents", "REST, governed tools, integration flows, agents"),
            (8, "Test_Cases_and_Acceptance", "Test Cases and Acceptance", "Golden and property tests, client acceptance tests"),
            (9, "Backlog_and_Open_Decisions", "Backlog and Open Decisions", "Build backlog, open decisions and questions"),
            (10, "Capability_Coverage_and_Frontier_Features", "Capability Coverage and Frontier Features", "Specified capabilities, capability gaps, frontier features"),
            (11, "Reference_Configuration_and_Golden_Data", "Reference Configuration and Golden Data", "Configuration register and golden reference data"),
            (12, "Use_Case_Specifications", "Use Case Specifications", "Formal use cases with diagrams and flows"),
            (13, "User_Stories", "User Stories", "User stories with Given / When / Then acceptance criteria")]
    t += "\n## 6. Document map\n\n| Doc ID | Document | Content |\n| :--- | :--- | :--- |\n"
    t += "".join(f"| FRS-{dom}-{n:02d} | [{lbl}](FRS-{dom}-{n:02d}_{fn}.md) | {c} |\n" for n, fn, lbl, c in docs if n < 12 or ucs)
    FINDINGS[dom] = findings[:-1]
    write(base + "README.md", t + revision())

    # 01
    t = H(1, "Process Specifications", "RDM, TS", [src("P", "03_Process_Inventory", "04_Process_Steps", "05_Swimlane_Maps"), src("B", "07_Approval_Workflows"), src("D", "64_Approval_Workflows")])
    t += "Step types: TASK (human) · SYS (system, unattended) · DEC (decision) · APPR (approval gate) · INT (integration call) · WAIT (timer or external event) · AGENT (agent-executed, governed). CRUD: C create · R read · U update · D delete-by-end-dating (temporal facts are never hard-deleted). In the flow diagrams decisions are diamonds, approvals are double-bordered boxes and integration, wait and agent steps are rounded.\n\n"
    t += "## 1. Process inventory\n\n" + table(procs, drop(inv_h, "Domain"))
    t += "\n## 2. Step-level specifications\n"
    for pr in procs:
        ps = [s for s in steps if s["Process ID"] == pr["Process ID"]]
        uc = next((u for u in ucs if u.get("process") == pr["Process ID"]), None)
        t += f"\n### {pr['Process ID']} — {cell(pr['Process'])}\n\n"
        t += f"**Trigger:** {cell(pr.get('Trigger'))} · **Primary actor:** {cell(pr.get('Primary actor'))} · **Frequency:** {cell(pr.get('Frequency'))} · **Criticality:** {cell(pr.get('Criticality'))} · **Phase:** {cell(pr.get('Phase'))} · **Reuses:** {cell(pr.get('Reuses')) or '—'}\n\n"
        if ps:
            t += process_flow(ps) + "\n" + table(ps, drop(stp_h, "Process ID", "Process"))
        else:
            t += f"The source workbook specifies this process at inventory level only. Its complete flow is specified in use case {uc['id'] if uc else 'FRS-' + dom + '-12'} (FRS-{dom}-12).\n"
    if swim:
        t += "\n## 3. Swimlane maps\n"
        for m in sorted({r["Map"] for r in swim}):
            rows = [r for r in swim if r["Map"] == m]
            t += f"\n### {m} — {cell(rows[0]['_section'].split('·', 1)[-1])}\n\n" + swim_seq(rows) + "\n" + table(rows, drop(sw_h, "Map", "Flow"))
    t += "\n## 4. Approval workflows\n\n" + table(bwf, bw_h)
    wf_ids = {r["Workflow ID"] for r in bwf}
    t += "\n### Workflow behaviour\n\n" + table([r for r in dsw if r["Workflow"] in wf_ids], keys(dsw))
    write(base + f"FRS-{dom}-01_Process_Specifications.md", t + revision())

    # 02
    t = H(2, "Business Rules", "RDM, TS, VV", [src("P", "09_Business_Rules"), src("B", "05_Rules_and_Calculations")])
    t += "## 1. Business rules (RL-nnn)\n"
    for sec in dict.fromkeys(r["_section"] for r in rules):
        t += f"\n### {sec.title()}\n\n" + table([r for r in rules if r["_section"] == sec], rl_h)
    t += "\n## 2. Client calculation rules with worked examples (BS:RL-xx)\n\nThese rule IDs come from the client build sheet and are qualified with `BS:` so they cannot be confused with the RL-nnn rules above.\n\n" + table(brules, brl_h)
    write(base + f"FRS-{dom}-02_Business_Rules.md", t + revision())

    # 03
    t = H(3, "Forms and Fields", "RDM, TS", [src("F", "01_Form_Index", "02_Field_Spec", "03_Picklists"), SRC_NAMES["C"], src("B", "03_Forms_and_Screens", "04_Field_Specification")])
    t += "Conventions for every form: temporal fields are effective-dated; overriding a policy default requires a reason; every create, update and delete writes an audit entry; Aadhaar, PAN, passport and bank account are tokenised at rest and masked in display; records are end-dated rather than deleted; money is stored as an integer in the smallest currency unit; a blocked save names the rule and the value that blocked it (DA-05).\n\n"
    frows = [{**r, "Menu path": EP.get(r["Form ID"], {}).get("Full Location Path", ""), "CRUD API endpoint": EP.get(r["Form ID"], {}).get("CRUD API Endpoint", ""), "Target object": EP.get(r["Form ID"], {}).get("Target Module ID", "")} for r in forms]
    t += "## 1. Form index\n\n" + table(frows, ["Form ID", "Form", "Screen ID", "Primary persona", "Fields", "Menu path", "Target object", "CRUD API endpoint"])
    t += "\n## 2. Field specifications\n"
    picks = set()
    for r in forms:
        rows = [x for x in fields if x["Form ID"] == r["Form ID"]]
        picks |= {x["Picklist"] for x in rows if x.get("Picklist") and x["Picklist"] not in ("—", "-")}
        t += f"\n### {r['Form ID']} — {cell(r['Form'])} ({cell(r.get('Screen ID'))})\n\n" + table(rows, drop(fs_h, "Form ID", "Form", "Module"))
    t += "\n## 3. Picklists used by this domain's forms\n\n" + table([x for x in pl if x["Picklist code"] in picks], pl_h)
    t += "\n## 4. Client form deltas\n\nAdditional fields and behaviour required by the client requirements (R-xx), extending the forms above.\n\n" + table(bforms, drop(bf_h, "Build action"))
    for r in bforms:
        rows = [x for x in bfields if x["Form ID"] == r["Form ID"]]
        if rows: t += f"\n#### {r['Form ID']} — {cell(r['Form / screen'])}\n\n" + table(rows, drop(bfs_h, "Form ID", "Form", "Module", "Action"))
    write(base + f"FRS-{dom}-03_Forms_and_Fields.md", t + revision())

    # 04
    sids = {r["Screen ID"] for r in screens}
    personas = [r for r in ro if sids & set(re.findall(r"SCR-\d+", r.get("Key screens", "")))]
    dreps = [r for r in drp if bmod(r.get("Module", "")) == dom]
    t = H(4, "Screens, Reports and UX", "RDM, TS", [src("P", "07_Screens", "21_Roles_and_RACI"), src("B", "08_Reports_and_Outputs"), src("D", "67_Reports_Register")])
    t += "## 1. Screens\n\n" + table(screens, drop(scr_h, "Domain"))
    t += "\n## 2. Personas using these screens\n\n" + table(personas, ro_h)
    t += "\n## 3. Reports and outputs\n\n" + table(breps, drop(brp_h, "Build action"))
    t += "\n### Report configuration\n\n" + table(dreps, drop(keys(drp), "Build action"))
    t += "\n## 4. UX requirements for every screen in this domain (Authored)\n\n- Screens MUST use the design-token system only and conform to WCAG 2.2 AA.\n- Every label MUST be an i18n key; all 11 supported languages MUST render, including right-to-left for Arabic.\n- Each screen MUST define empty, loading, error, success and, where marked, offline states.\n- Masked fields MUST render masked for personas without the salary or identity scope; hiding in the browser is not authorisation — the server MUST enforce scope (SEC-01).\n- Voice (Nucleus Talk) and AI-assist touchpoints MUST follow the risk tiering in GOV-11.\n"
    write(base + f"FRS-{dom}-04_Screens_Reports_and_UX.md", t + revision())

    # 05
    t = H(5, "Data Model", "TS, RDM", [src("P", "06_Data_Dictionary"), src("B", "06_Enum_Values"), src("D", "65_Enum_Seed_Values")])
    t += "Every object carries the platform envelope (`tenant_id`, `entity_id`), effective dating (`effective_from`, `effective_to`) where temporal, and audit columns. Sensitivity classes follow GOV-10.\n\n"
    er = er_diagram({r["Object"] for r in objs})
    if er: t += "## 1. Entity relationships\n\nRelationships are derived from the identifier fields in the data dictionary; the tenant envelope is omitted for legibility.\n\n" + er + "\n"
    t += "## 2. Data objects\n\n" + table(objs, drop(dd_h, "Domain"))
    if cat_rows("objects", dom):
        t += "\n### Additional objects and attributes (Authored)\n\n" + table(cat_rows("objects", dom), ["Object", "Fields", "Type", "Required", "Owner / source", "Temporal", "Sensitivity", "Notes", "Defined in"])
    t += "\n## 3. Enumerations\n\n" + table(benums, ben_h)
    t += "\n### Enumeration seed values and tenant defaults\n\n" + table([r for r in dens if bmod(r.get("Module", "")) == dom], keys(dens))
    write(base + f"FRS-{dom}-05_Data_Model.md", t + revision())

    # 06
    t = H(6, "State Machines and Events", "TS, VV", [src("P", "11_State_Machines", "12_Events")])
    t += "## 1. State machines\n"
    for obj in dict.fromkeys(r["_section"] for r in sms):
        rows = [r for r in sms if r["_section"] == obj]
        t += f"\n### `{obj}`\n\n" + state_diagram(rows) + "\n" + table(rows, drop(sm_h, "Object"))
    if not sms: t += "\nNo object in this domain has a governed lifecycle in the source; records follow the platform's effective-dated create / update / end-date pattern.\n"
    t += "\n## 2. Domain events\n\nEvent names follow `domain.object.verb` in the past tense. Every event carries the envelope defined in IA-02.\n\n" + table(evs, ev_h)
    if cat_rows("events", dom):
        t += "\n### Additional events (Authored)\n\n" + table(cat_rows("events", dom), ["Event", "Emitted by", "Payload (beyond envelope)", "Consumers", "Idempotency key", "Retention", "Defined in"])
    write(base + f"FRS-{dom}-06_State_Machines_and_Events.md", t + revision())

    # 07
    t = H(7, "APIs, Integrations and Agents", "TS, PI", [src("P", "13_API_and_Tools", "14_Agents", "15_Integration_Flows"), SRC_NAMES["C"]])
    t += "## 1. Form CRUD endpoints\n\n" + table([{"Form ID": r["Form ID"], "Form": r["Form"], "Target object": EP.get(r["Form ID"], {}).get("Target Module ID", ""), "Endpoint": EP.get(r["Form ID"], {}).get("CRUD API Endpoint", "")} for r in forms], ["Form ID", "Form", "Target object", "Endpoint"])
    t += "\n## 2. Public REST and governed tool surface\n\n" + table(apis, api_h)
    if cat_rows("apis", dom):
        t += "\n### Additional interfaces (Authored)\n\n" + table(cat_rows("apis", dom), ["Surface", "Name", "Method / class", "Purpose", "Permission", "Side effect", "Consumed by", "Defined in"])
    t += "\n## 3. Integration flows\n\n" + table(flows, fl_h) + ("\nPayload-level specifications are in ICD-01.\n" if flows else "")
    t += "\n## 4. Agents operating in this domain\n\n" + table(agents, ag_h)
    t += "\n## 5. API requirements (Authored)\n\n- Public REST MUST be described in OpenAPI 3.1, versioned, with a sandbox tenant per partner (IA-01).\n- Every write MUST accept an `Idempotency-Key` and return the effective-dated version it created.\n- The tool surface is built once and exposed twice (internal agents and external MCP clients); every tool call MUST pass the policy gate and be recorded in the action ledger.\n"
    write(base + f"FRS-{dom}-07_APIs_Integrations_and_Agents.md", t + revision())

    # 08
    merged = [{**r, "Demo records to use": datm.get(r["Test ID"], {}).get("Demo records to use", "")} for r in btests]
    t = H(8, "Test Cases and Acceptance", "VV, PR", [src("P", "19_Test_Cases"), src("B", "10_Acceptance_Tests"), src("D", "68_Acceptance_Test_Data")], owner="QA / Test Lead")
    t += "Expected results reconcile against the golden demo dataset (VV-03). Property tests run on every build. Story-level acceptance criteria are in FRS-" + dom + "-13.\n\n"
    for sec in dict.fromkeys(r["_section"] for r in tcs):
        t += f"\n## {sec.split(' — ')[0].title()}\n\n" + table([r for r in tcs if r["_section"] == sec], drop(tc_h, "Area"))
    if not tcs: t += "\nThe source has no TC- cases for this domain; verification is by the client acceptance tests below and the user-story criteria in FRS-" + dom + "-13.\n"
    t += "\n## Client acceptance tests (T-xx)\n\n" + table(merged, bt_h + ["Demo records to use"])
    if atc:
        t += f"\n## Test cases for capability gaps (Authored)\n\nOne test case per acceptance criterion of the capability-gap user stories in FRS-{dom}-13; expected results are the stated outcomes.\n\n" + table(atc, ["Test ID", "Use case", "Capability gap", "User story", "Given", "When", "Then (expected result)", "Level", "Method"])
    write(base + f"FRS-{dom}-08_Test_Cases_and_Acceptance.md", t + revision())

    # 09
    t = H(9, "Backlog and Open Decisions", "PLAN, EST, DAR", [src("P", "18_Build_Backlog", "22_Open_Decisions"), src("B", "11_Open_Questions")], owner="Delivery Lead")
    for sec in dict.fromkeys(r["_section"] for r in backlog):
        t += f"\n## {cell(sec.split('.')[0]).title()}\n\n" + table([r for r in backlog if r["_section"] == sec], drop(bl_h, "Domain"))
    if not backlog: t += "\nThe source build backlog has no stories for this domain; delivery scope is defined by the use cases (FRS-" + dom + "-12) and capability gaps (FRS-" + dom + "-10), planned in PLN-02.\n"
    t += "\n## Open decisions blocking this domain\n\n" + table(ods, od_h)
    t += "\n## Open questions on client requirements\n\n" + table(bqs, bq_h)
    write(base + f"FRS-{dom}-09_Backlog_and_Open_Decisions.md", t + revision())

    # 10
    t = H(10, "Capability Coverage and Frontier Features", "RDM, DAR", [src("P", "03_Process_Inventory"), "Authored (sections 2–3)"])
    t += "## 1. Capabilities specified in the source\n\n" + table(procs, ["Process ID", "Process", "Criticality", "Phase", "Reuses"])
    t += f"\nForms specified: {len(forms)} with {len(fields)} fields; screens: {len(screens)}; rules: {len(rules)}.\n"
    t += f"\n## 2. Capability gaps (Authored — new requirements)\n\nCapabilities that an enterprise-grade, market-leading HCM needs and that the source workbooks do not yet specify. Each is a new requirement with status **Proposed**, decided through CM-02, and has a use case in FRS-{dom}-12.\n\n| ID | Capability | Requirement | Priority | Phase |\n| :--- | :--- | :--- | :--- | :--- |\n"
    t += "".join(f"| {dom}-CG-{i:03d} | {cell(a)} | {cell(b)} | {c} | {d} |\n" for i, (a, b, c, d) in enumerate(cg, 1))
    t += f"\n## 3. Frontier features (Authored)\n\nForward-looking capabilities that set Nucleus Suite apart. Each requires a decision under DAR-01 and, where AI is involved, the GOV-11 controls for its risk tier. Status: **Proposed**.\n\n| ID | Feature | Description | Differentiation | Builds on | AI risk tier | Phase |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n"
    t += "".join(f"| {dom}-FX-{i:03d} | {cell(a)} | {cell(b)} | {cell(c)} | {cell(d)} | {TIER[e]} | {f} |\n" for i, (a, b, c, d, e, f) in enumerate(fx, 1))
    write(base + f"FRS-{dom}-10_Capability_Coverage_and_Frontier_Features.md", t + revision())

    # 11
    t = H(11, "Reference Configuration and Golden Data", "TS, VV", [src("B", "09_Configuration_Register"), src("D", *ds_sheets) if ds_sheets else SRC_NAMES["D"]])
    t += "Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.\n\n"
    t += "## 1. Configuration register (configuration, not code)\n\n" + table(bconf, bc_h)
    t += "\n## 2. Reference and golden data\n"
    if not ds_sheets: t += "\nThe golden dataset holds no sheet owned by this domain; its tests use the shared master data in FRS-PLT-11 and FRS-PPL-11.\n"
    for s in ds_sheets:
        tbl, n = ds_table(s)
        t += f"\n### `{s}` ({n} rows)\n\n" + tbl
    write(base + f"FRS-{dom}-11_Reference_Configuration_and_Golden_Data.md", t + revision())

    if ucs:
        write(base + f"FRS-{dom}-12_Use_Case_Specifications.md", uc_doc(dom, ucs, H))
        write(base + f"FRS-{dom}-13_User_Stories.md", us_doc(dom, ucs, H))
    return {"dom": dom, "name": name, "dir": ddir, "counts": dict(counts)}

ALL_ATC = []
summaries = [dom_docs(d) for d in DOM_CODES]

def doc(rel, doc_id, title, owner, cmmi, related, sources, body, depth=1, approver="Product Council", trace="BG-01 – BG-10"):
    write(rel, header(doc_id, title, owner, cmmi, related, sources, depth, approver=approver, trace=trace) + body + revision())

# ------------------------------------------------------------------ functional index + catalogues
keys_ = ["Processes (DOM-nn)", "Use cases (UC)", "User stories (US)", "Business rules (RL-nnn)", "Forms (FRM-)", "Form fields", "Screens (SCR-)", "Test cases (TC-)", "Capability gaps — authored (CG)", "Frontier features — authored (FX)"]
body = "Functional requirements are organised by the 14 process domains of the Nucleus process architecture (BA-01). Each domain pack contains FRS-<DOM>-00 to FRS-<DOM>-13.\n\n"
body += "| # | Domain | Code | " + " | ".join(k.split(" (")[0].replace(" — authored", "") for k in keys_) + " |\n| ---: | :--- | :--- | " + " | ".join("---:" for _ in keys_) + " |\n"
for i, s in enumerate(summaries, 1):
    body += f"| {i} | [{s['name']}]({s['dir']}/README.md) | `{s['dom']}` | " + " | ".join(str(s["counts"][k]) for k in keys_) + " |\n"
body += "| | **Total** | | " + " | ".join(f"**{sum(s['counts'][k] for s in summaries)}**" for k in keys_) + " |\n"
body += "\nCatalogues: [UCC-01 Use Case Catalogue](UCC-01_Use_Case_Catalogue.md) · [USC-01 User Story Catalogue](USC-01_User_Story_Catalogue.md).\n"
body += "\n## Cross-domain backlog items (Domain = ALL)\n\n" + table([r for r in bl if r.get("Domain") == "ALL"], drop(bl_h, "Domain"))
doc(f"{F_DIR}/README.md", "FRS-00", "Functional Requirements — Domain Index", "Head of Product", "RDM", "BRS-01, SRS-01, REQ-01, REQ-02, BA-02", [SRC_NAMES[k] for k in "PFBDC"], body)

if UCS:
    allu = [(d, u) for d in DOM_CODES for u in UCS.get(d, [])]
    body = f"All {len(allu)} use cases across the 14 domains, with what each realises and how it is verified.\n\n"
    body += mermaid("pie showData title Use cases by domain\n" + "\n".join(f'    "{d}" : {len(UCS.get(d, []))}' for d in DOM_CODES if UCS.get(d)))
    for d in DOM_CODES:
        us_ = UCS.get(d, [])
        if not us_: continue
        body += f"\n## {DOM_NAME[d]} ({d})\n\n| ID | Use case | Primary actor | Realises | Source | Client req. | System req. | Tests | Phase |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n"
        body += "".join(f"| [{u['id']}]({DOM_DIR[d]}/FRS-{d}-12_Use_Case_Specifications.md#{u['id'].lower()}) | {cell(u['name'])} | {cell(u['primary_actor'])} | {u.get('process') or u.get('capability_gap') or '—'} | {u['source']} | {cell(L(u.get('client_requirements')))} | {cell(L(u.get('system_requirements')))} | {cell(L((u.get('acceptance_tests') or []) + u.get('_authored_tests', [])))} | {u.get('phase','')} |\n" for u in us_)
    doc(f"{F_DIR}/UCC-01_Use_Case_Catalogue.md", "UCC-01", "Use Case Catalogue", "Business Analyst Lead", "RDM, VV", "FRS-<DOM>-12, REQ-02", ["FRS-<DOM>-12 use case specifications"], body)
    body = "All user stories by domain and priority.\n\n| Domain | Stories | Must | Should | Could |\n| :--- | ---: | ---: | ---: | ---: |\n"
    for d in DOM_CODES:
        st = [s for u in UCS.get(d, []) for s in u.get("user_stories", [])]
        if not st: continue
        c = collections.Counter(s.get("priority") for s in st)
        body += f"| [{DOM_NAME[d]}]({DOM_DIR[d]}/FRS-{d}-13_User_Stories.md) | {len(st)} | {c.get('Must',0)} | {c.get('Should',0)} | {c.get('Could',0)} |\n"
    doc(f"{F_DIR}/USC-01_User_Story_Catalogue.md", "USC-01", "User Story Catalogue", "Business Analyst Lead", "RDM, VV", "FRS-<DOM>-13, PLN-02", ["FRS-<DOM>-13 user stories"], body)

# ------------------------------------------------------------------ 03 business requirements (architecture artefacts)
BR_DIR = "03_Business_Requirements"
body = "\n".join(f"> {cell(x)}" for x in intro(P, "02_Process_Architecture", "ID / prefix")) + "\n\n"
body += "## 1. Level 0 — the value chain\n\n" + mermaid('flowchart LR\n    HIRE["HIRE"] --> ONBOARD["ONBOARD"] --> WORK["WORK"] --> PAY["PAY"] --> COMPLY["COMPLY"]\n    WORK --> GROW["GROW"] --> EXIT["EXIT"]\n    GOVERN["GOVERN"] -.-> HIRE\n    GOVERN -.-> PAY\n    GOVERN -.-> EXIT') + "\n"
body += table([r for r in arch if r["ID / prefix"].startswith("L0-")], arch_h)
body += "\n## 2. Level 1 — domains\n\n" + table([r for r in arch if r["ID / prefix"] in DOM_CODES], arch_h)
body += "\n## 3. Seams between domains\n\n" + seam_graph() + "\n" + table([r for r in arch if r["ID / prefix"].startswith("S-")], arch_h)
doc(f"{BR_DIR}/BA-01_Process_Architecture_and_Value_Chain.md", "BA-01", "Process Architecture and Value Chain", "Enterprise Architect", "RDM, TS", "BRS-01, GOV-05, BA-02, FRS-00", [src("P", "02_Process_Architecture")], body, approver="Architecture Review Board")
body = "".join(f"\n## {sec.title()}\n\n" + table([r for r in inv if r["_section"] == sec], inv_h) for sec in dict.fromkeys(r["_section"] for r in inv))
doc(f"{BR_DIR}/BA-02_Process_Inventory.md", "BA-02", "Process Inventory", "Enterprise Architect", "RDM", "BA-01, UCC-01, FRS-<DOM>-01", [src("P", "03_Process_Inventory")], body)
body = "\n".join(f"> {cell(x)}" for x in intro(P, "05_Swimlane_Maps", "Map")) + "\n"
for m in dict.fromkeys(r["Map"] for r in sw):
    rows = [r for r in sw if r["Map"] == m]
    body += f"\n## {m} — {cell(rows[0]['_section'].split('·', 1)[-1])}\n\n" + swim_seq(rows) + "\n" + table(rows, drop(sw_h, "Map"))
doc(f"{BR_DIR}/BA-03_Swimlane_Process_Maps.md", "BA-03", "Swimlane Process Maps", "Business Analyst Lead", "RDM, TS", "BA-02, FRS-<DOM>-01", [src("P", "05_Swimlane_Maps")], body)
_, drs = p("D", "43_Roles_and_Data_Scope", "Role code")
_, dus = p("D", "44_Demo_Users", "User ID")
body = "Hiding data in the browser is a convenience, not authorisation; the server enforces scope (SEC-01). Plant and location-scoped users see attendance for their location and never see salary or rate structures.\n\n"
body += "## 1. Personas, scope and visibility\n\n" + table(ro, ro_h)
body += "\n## 2. Role and data-scope matrix (pilot tenant)\n\n" + table(drs, keys(drs))
body += "\n## 3. Pilot users (login names only; no credentials are recorded in documentation)\n\n" + table(dus, keys(dus))
doc(f"{BR_DIR}/BA-04_Roles_Personas_and_Data_Scope.md", "BA-04", "Roles, Personas and Data Scope", "Security Architect", "RDM, TS", "GOV-08, GOV-10, SEC-01, STRS-01", [src("P", "21_Roles_and_RACI"), src("D", "43_Roles_and_Data_Scope", "44_Demo_Users")], body)
body = "All approval chains run on the single shared approval engine (CMP-01); a per-module approval table is a design defect.\n\n## 1. Workflow catalogue\n\n" + table(bw, bw_h)
body += "\n## 2. Workflow behaviour\n\n" + table(dsw, keys(dsw))
doc(f"{BR_DIR}/BA-05_Approval_Workflow_Catalogue.md", "BA-05", "Approval Workflow Catalogue", "Business Analyst Lead", "RDM, TS", "BA-06, NOT-01, FRS-PLT-01", [src("B", "07_Approval_Workflows"), src("D", "64_Approval_Workflows")], body)
body = "\n".join(f"> {cell(x)}" for x in intro(P, "16_Reuse_Register", "Component")) + "\n\n**Build-once rule.** Eleven capabilities that look like separate features are each one shared component. A story that re-implements one of them is a design defect, checked in peer review (QA-02).\n\n" + table(ru, ru_h)
doc(f"{BR_DIR}/BA-06_Shared_Component_Reuse_Register.md", "BA-06", "Shared Component Reuse Register", "Chief Architect", "TS, PAD", "BA-01, SRS-01, RB-01", [src("P", "16_Reuse_Register")], body, approver="Architecture Review Board")

# ------------------------------------------------------------------ 07 data architecture
DA = "07_Data_Architecture"
dom_links = collections.Counter()
objdom = {r["Object"]: r.get("Domain") for r in dd}
for r in dd:
    for f in re.split(r"[,\s]+", r.get("Fields", "")):
        if f.endswith("_id") and f != "tenant_id" and f[:-3] in objdom and objdom[f[:-3]] != r.get("Domain"):
            dom_links[(objdom[f[:-3]], r.get("Domain"))] += 1
body = "## 1. Domain data dependencies\n\nArrows point from the domain that owns a referenced object to the domain whose objects reference it.\n\n" + mermaid("flowchart LR\n" + "\n".join(f'    {a} -- "{n}" --> {b}' for (a, b), n in sorted(dom_links.items()) if a and b)) + "\n"
body += "".join(f"\n## {sec.title()}\n\n" + table([r for r in dd if r["_section"] == sec], dd_h) for sec in dict.fromkeys(r["_section"] for r in dd))
if CAT["objects"]:
    body += "\n## Additional objects and attributes defined in ICD-01 and MIG-01 (Authored)\n\n" + table(CAT["objects"], ["Object", "Domain", "Fields", "Type", "Required", "Owner / source", "Temporal", "Sensitivity", "Notes", "Defined in"])
doc(f"{DA}/DA-01_Enterprise_Data_Dictionary.md", "DA-01", "Enterprise Data Dictionary", "Data Architect", "TS", "GOV-10, MIG-01, FRS-<DOM>-05", [src("P", "06_Data_Dictionary")], body, approver="Architecture Review Board")
_, dpl = p("D", "66_Picklist_Seed_Values", "Picklist code")
doc(f"{DA}/DA-02_Picklist_Catalogue.md", "DA-02", "Picklist Catalogue", "Data Architect", "TS", "DA-03, FRS-<DOM>-03", [src("F", "03_Picklists"), src("D", "66_Picklist_Seed_Values")], "## 1. Picklist value sets\n\n" + table(pl, pl_h) + "\n## 2. Picklist seed values (pilot tenant)\n\n" + table(dpl, keys(dpl)))
doc(f"{DA}/DA-03_Enumerations.md", "DA-03", "Enumerations", "Data Architect", "TS", "DA-02", [src("B", "06_Enum_Values"), src("D", "65_Enum_Seed_Values")], "## 1. Enumerations\n\n" + table(ben, ben_h) + "\n## 2. Seed values and tenant defaults\n\n" + table(dens, keys(dens)))
doc(f"{DA}/DA-04_Configuration_Tables_and_Register.md", "DA-04", "Configuration Tables and Register", "Implementation Lead", "TS, CM", "CM-01, FRS-<DOM>-11", [src("P", "10_Config_Tables"), src("B", "09_Configuration_Register")], "## 1. Configuration tables\n\n" + table(ct, ct_h) + "\n## 2. Configuration register — items that must be configuration, not code\n\n" + table(bc, bc_h))
use("F", "00_Read_Me")
conv = [{"Topic": r[0], "Rule": r[1]} for r in F["00_Read_Me"] if len(r) > 1 and "workday" not in (r[0] + r[1]).lower()]
body = "## 1. Field specification conventions\n\n" + table(conv, ["Topic", "Rule"])
body += "\n## 2. Form index with navigation path and CRUD endpoint\n\n" + table([{**r, **EP.get(r["Form ID"], {})} for r in fi], ["Form ID", "Form", "Module", "Screen ID", "Primary persona", "Fields", "Full Location Path", "Target Module ID", "CRUD API Endpoint"])
body += "\n## 3. Earlier field list from the process workbook\n\nRetained for traceability; where it differs, the Forms & Fields specification governs.\n\n" + table(ff, ff_h)
doc(f"{DA}/DA-05_Form_Index_and_Field_Conventions.md", "DA-05", "Form Index and Field Conventions", "UX Lead", "TS, RDM", "FRS-<DOM>-03", [src("F", "00_Read_Me", "01_Form_Index"), SRC_NAMES["C"], src("P", "08_Form_Fields")], body)

# ------------------------------------------------------------------ 08 integration
IA = "08_Integration_and_API"
body = "\n".join(f"> {cell(x)}" for x in intro(P, "13_API_and_Tools", "Surface")) + "\n"
for sec in dict.fromkeys(r["_section"] for r in api):
    body += f"\n## {cell(sec)}\n\n" + table([r for r in api if r["_section"] == sec], api_h)
body += "\n## Form CRUD endpoint map\n\n" + table(ENDPOINTS, ["Form ID", "Form Name", "Target Module ID", "CRUD API Endpoint", "Full Location Path"])
if CAT["apis"]:
    body += "\n## Additional interfaces defined in ICD-01 and MIG-01 (Authored)\n\n" + table(CAT["apis"], ["Surface", "Name", "Method / class", "Purpose", "Permission", "Side effect", "Dry run", "Consumed by", "Note", "Domain", "Defined in"])
doc(f"{IA}/IA-01_API_and_Tool_Surface_Catalogue.md", "IA-01", "API and Tool Surface Catalogue", "Integration Architect", "TS, PI", "IA-02, IA-03, ICD-01, AI-01", [src("P", "13_API_and_Tools"), SRC_NAMES["C"]], body, approver="Architecture Review Board")
env = next((r["_section"] for r in ev), "")
evdom = collections.Counter(EVENT_DOM.get(r["Event"].split(".")[0], "PLT") for r in ev)
body = f"**Envelope.** {cell(env)}\n\n" + mermaid("pie showData title Domain events by producing domain\n" + "\n".join(f'    "{d}" : {n}' for d, n in evdom.most_common())) + "\n" + table(ev, ev_h)
if CAT["events"]:
    body += "\n## Additional events defined in ICD-01 and process specifications (Authored)\n\n" + table(CAT["events"], ["Event", "Emitted by", "Payload (beyond envelope)", "Consumers", "Idempotency key", "Retention", "Domain", "Defined in"])
doc(f"{IA}/IA-02_Event_Catalogue.md", "IA-02", "Event Catalogue", "Integration Architect", "TS, PI", "IA-01, NOT-01, FRS-<DOM>-06", [src("P", "12_Events")], body, approver="Architecture Review Board")
body = "\n".join(f"> {cell(x)}" for x in intro(P, "15_Integration_Flows", "Flow")) + "\n\n## 1. Integration landscape\n\n" + landscape() + "\n## 2. Flows\n\n" + table(fl, fl_h) + "\nPayload-level specifications for each flow are in ICD-01.\n"
doc(f"{IA}/IA-03_Integration_Flows.md", "IA-03", "Integration Flows", "Integration Architect", "TS, PI, SAM", "IA-01, ICD-01, SAM-01", [src("P", "15_Integration_Flows")], body, approver="Architecture Review Board")

# ------------------------------------------------------------------ 09 AI
body = "\n".join(f"> {cell(x)}" for x in intro(P, "14_Agents", "Agent")) + "\n\n"
body += "## 1. Governed agent action path\n\n" + mermaid('flowchart LR\n    U(["User or schedule"]) --> AG["Agent"]\n    AG --> PG{"Policy gate"}\n    PG -- "denied" --> R["Refusal with reason"]\n    PG -- "allowed" --> T["Tool surface"]\n    T --> TH{"Above approval threshold?"}\n    TH -- "yes" --> AP[["Human approval"]]\n    TH -- "no" --> EX["Execute"]\n    AP --> EX\n    EX --> L[("Action ledger")]') + "\n"
body += "## 2. Agent catalogue\n\n" + table(ag, ag_h)
body += "\n## 3. Governed tools available to agents\n\n" + table([r for r in api if r["Surface"] == "TOOL"], api_h)
body += "\n## 4. Agent rules\n\n" + table([r for r in rl if r["_section"] == "AGENTS"], rl_h)
body += "\n## 5. Frontier AI features across domains (Authored)\n\n| ID | Feature | AI risk tier | Phase |\n| :--- | :--- | :--- | :--- |\n"
body += "".join(f"| {d}-FX-{i:03d} | {cell(f[0])} | {TIER[f[4]]} | {f[5]} |\n" for d in DOM_CODES for i, f in enumerate(FX.get(d, []), 1) if f[4] != "T0")
doc("09_AI_and_Agents/AI-01_Agent_Catalogue_and_Tool_Governance.md", "AI-01", "Agent Catalogue and Tool Governance", "Head of AI", "TS, RDM, VV", "GOV-11, IA-01, SEC-01, FRS-INT-00", [src("P", "14_Agents", "13_API_and_Tools", "09_Business_Rules")], body, approver="Data & AI Ethics Board", trace="BG-02, BG-06")

# ------------------------------------------------------------------ 05 NFR
doc("05_System_Requirements/NFR-01_Non_Functional_Requirements_and_Definition_of_Done.md", "NFR-01", "Non-Functional Requirements and Definition of Done", "Chief Architect", "RDM, VV, MPM", "SRS-01, OPS-01, MPM-01, QA-03", [src("P", "20_NFR_and_DoD")], "These targets are the source of truth for the quality and process-performance objectives in MPM-01 and the operational targets in OPS-01.\n\n" + table(nfr, nfr_h), approver="Architecture Review Board")

# ------------------------------------------------------------------ 10 V&V
VVD = "10_Verification_and_Validation"
body = ""
for sec in dict.fromkeys(r["_section"] for r in tc):
    body += f"\n## {cell(sec)}\n\n" + table([r for r in tc if r["_section"] == sec], tc_h)
if ALL_ATC:
    body += f"\n## Test cases for capability gaps (Authored)\n\n{len(ALL_ATC)} test cases, one per acceptance criterion of the capability-gap user stories; full Given / When / Then detail is in each domain's FRS-<DOM>-08.\n\n| Domain | Test cases |\n| :--- | ---: |\n" + "".join(f"| {DOM_NAME[d]} ({d}) | {sum(1 for x in ALL_ATC if x['Test ID'].startswith(d + '-'))} |\n" for d in DOM_CODES if any(x['Test ID'].startswith(d + '-') for x in ALL_ATC))
doc(f"{VVD}/VV-01_Test_Case_Catalogue.md", "VV-01", "Test Case Catalogue", "QA / Test Lead", "VV", "QA-03, MTP-01, FRS-<DOM>-08", [src("P", "19_Test_Cases")], body)
merged = [{**r, "Demo records to use": datm.get(r["Test ID"], {}).get("Demo records to use", "")} for r in bt]
doc(f"{VVD}/VV-02_Client_Acceptance_Tests.md", "VV-02", "Client Acceptance Tests", "QA / Test Lead", "VV", "VV-01, UAT-01, TR-02", [src("B", "10_Acceptance_Tests"), src("D", "68_Acceptance_Test_Data")], "Client acceptance tests derived from the 26 client demo points, with the golden-dataset records that prove each one.\n\n" + table(merged, bt_h + ["Demo records to use"]))
use("D", "00_README")
body = "## 1. About the golden dataset\n\n" + table([{"Topic": r[0], "Detail": r[1] if len(r) > 1 else ""} for r in D["00_README"] if r and r[0].strip()], ["Topic", "Detail"])
_, scen = p("D", "01_Scenario_Map", "Demo point")
body += "\n## 2. Scenario map — records that prove each requirement\n\n" + table(scen, drop(keys(scen), "Client status"))
body += "\n## 3. Dataset sheet catalogue\n\n| Sheet | Rows | Domain pack | Columns |\n| :--- | ---: | :--- | :--- |\n"
for s, rows in D.items():
    dm = DS_DOM.get(s, "")
    loc = f"FRS-{dm}-11" if dm else {"00_README": "VV-03 §1", "01_Scenario_Map": "VV-03 §2", "65_Enum_Seed_Values": "DA-03", "66_Picklist_Seed_Values": "DA-02", "68_Acceptance_Test_Data": "VV-02", "69_Coverage_Matrix": "TR-03", "70_Change_Log_v1_1": "VV-03 §4"}.get(s, "")
    body += f"| `{s}` | {max(len(rows) - 1, 0)} | {loc} | {cell(', '.join(rows[0][:40]) if rows else '')} |\n"
_, chg = p("D", "70_Change_Log_v1_1", "Type")
body += "\n## 4. Dataset corrections between dataset versions 1.0 and 1.1\n\n" + table(chg, keys(chg))
doc(f"{VVD}/VV-03_Golden_Demo_Dataset_Guide.md", "VV-03", "Golden Demo Dataset Guide", "QA / Test Lead", "VV, TS", "VV-01, VV-02, UAT-01, FRS-<DOM>-11", [src("D", "00_README", "01_Scenario_Map", "70_Change_Log_v1_1")], body)

# ------------------------------------------------------------------ 11 traceability
TRD = "11_Traceability"
body = "The client's 26 demo points are the origin of requirements R-01…R-27. Tracker status values are not carried: all are new requirements.\n\n## 1. Client demo points as stated\n\n"
body += table(hd, ["S No.", "Points", "Remark", "Flow To Verify Implementation"], ["Point", "Requirement as stated", "Client remark", "Verification flow"])
body += "\n## 2. Requirement register (R-xx)\n\n" + table(br, drop(br_h, "Demo status (as received)", "Build action"))
body += "\n## 3. Module index\n\n" + table([{**r, "Domain": bmod(r["Module ID"])} for r in bm], ["Module ID", "Module", "Domain", "What it covers", "Priority", "Requirements", "Forms"])
doc(f"{TRD}/TR-01_Client_Requirement_Register.md", "TR-01", "Client Requirement Register", "Business Analyst Lead", "RDM", "BRS-01, TR-02, REQ-02", [src("H", "Sheet1"), src("B", "01_Requirement_Register", "02_Module_Index")], body)
body = "## 1. Demo point → process → screen → rule → dataset → test\n\n" + table(tr, drop(tr_h, "Client status"))
body += "\n## 2. Requirement → form → field → rule → report → test → question\n\n" + table(btm, drop(btm_h, "Demo status"))
if UCS:
    rows = [{"Req": r["Req ID"], "Use cases": ", ".join(u["id"] for d in DOM_CODES for u in UCS.get(d, []) if r["Req ID"] in (u.get("client_requirements") or []))} for r in br]
    body += "\n## 3. Requirement → use case\n\n" + table(rows, ["Req", "Use cases"], ["Client requirement", "Use cases realising it"])
doc(f"{TRD}/TR-02_Demo_Point_Traceability_Matrix.md", "TR-02", "Demo Point Traceability Matrix", "Business Analyst Lead", "RDM, VV", "TR-01, REQ-02, UCC-01, VV-02", [src("P", "17_Traceability"), src("B", "12_Traceability_Matrix")], body)
_, cov = p("D", "69_Coverage_Matrix", "Form ID")
doc(f"{TRD}/TR-03_Form_Data_Coverage_Matrix.md", "TR-03", "Form Data Coverage Matrix", "Business Analyst Lead", "RDM, VV", "DA-05, VV-03", [src("D", "69_Coverage_Matrix")], "Which golden-dataset sheet supplies data for each form or screen.\n\n" + table(cov, drop(keys(cov), "Status")))

# ------------------------------------------------------------------ 12 release
RBD = "12_Release_and_Backlog"
body = "\n".join(f"> {cell(x)}" for x in intro(P, "18_Build_Backlog", "ID")) + "\n\n"
phase_eff = []
for sec in dict.fromkeys(r["_section"] for r in bl):
    rows = [r for r in bl if r["_section"] == sec]
    phase_eff.append((cell(sec.split(".")[0]), sum(float(r.get("Effort (days)") or 0) for r in rows)))
body += mermaid("pie showData title Build effort (days) by phase\n" + "\n".join(f'    "{ml(n, 30)}" : {e:g}' for n, e in phase_eff)) + "\n"
for sec in dict.fromkeys(r["_section"] for r in bl):
    rows = [r for r in bl if r["_section"] == sec]
    body += f"\n## {cell(sec)}\n\nEffort: {sum(float(r.get('Effort (days)') or 0) for r in rows):g} days across {len(rows)} stories.\n\n" + table(rows, bl_h)
doc(f"{RBD}/RB-01_Phased_Build_Backlog.md", "RB-01", "Phased Build Backlog", "Delivery Lead", "PLAN, EST", "PLN-02, PLN-03, FRS-<DOM>-09", [src("P", "18_Build_Backlog")], body, approver="Steering Committee")
doc(f"{RBD}/RB-02_Open_Decisions_and_Questions.md", "RB-02", "Open Decisions and Questions", "Programme Manager", "DAR, RSK", "DAR-01, DAR-02, RSK-03", [src("P", "22_Open_Decisions"), src("B", "11_Open_Questions")], "## 1. Open decisions (OD-xx)\n\nEach is resolved through DAR-01 and recorded in DAR-02.\n\n" + table(od, od_h) + "\n## 2. Open questions on client requirements (Q-xx)\n\n" + table(bq, bq_h), approver="Steering Committee")
body = "Roadmap of the authored capability gaps (CG) and frontier features (FX) across all domains. Nothing here is committed until approved through CM-02 and, for AI features, GOV-11.\n\n"
ph_counts = collections.Counter([x[3] for d in DOM_CODES for x in CG.get(d, [])] + [x[5] for d in DOM_CODES for x in FX.get(d, [])])
body += mermaid("pie showData title Capability gaps and frontier features by phase\n" + "\n".join(f'    "{ph}" : {ph_counts[ph]}' for ph in ["P0", "P1", "P2", "P3", "P4", "P5"] if ph_counts[ph])) + "\n"
for ph in ["P0", "P1", "P2", "P3", "P4", "P5"]:
    rows = [(d, i, x) for d in DOM_CODES for i, x in enumerate(CG.get(d, []), 1) if x[3] == ph]
    rows2 = [(d, i, x) for d in DOM_CODES for i, x in enumerate(FX.get(d, []), 1) if x[5] == ph]
    if not rows and not rows2: continue
    body += f"\n## Phase {ph}\n\n| ID | Type | Domain | Title | Priority / AI tier |\n| :--- | :--- | :--- | :--- | :--- |\n"
    body += "".join(f"| {d}-CG-{i:03d} | Capability gap | {DOM_NAME[d]} | {cell(x[0])} | {x[2]} |\n" for d, i, x in rows)
    body += "".join(f"| {d}-FX-{i:03d} | Frontier | {DOM_NAME[d]} | {cell(x[0])} | {TIER[x[4]]} |\n" for d, i, x in rows2)
doc(f"{RBD}/RB-03_Capability_Gap_and_Frontier_Roadmap.md", "RB-03", "Capability Gap and Frontier Feature Roadmap", "Head of Product", "PLAN, RDM, DAR", "GOV-01, GOV-02, FRS-<DOM>-10", ["Authored"], body, approver="Steering Committee")

# ------------------------------------------------------------------ source register
files = {"P": "Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx", "F": "Nucleus_Forms_and_Fields_Complete_MKraft.xlsx", "B": "Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx", "D": "Nucleus_HRMS_Demo_Dataset_v1_1.xlsx", "H": "HR Demo Points.xlsx", "C": "Field_Spec_Impl_Path.csv"}
books = {"P": P, "F": F, "B": B, "D": D, "H": H}
body = "Controlled source workbooks (configuration items under CM-01). A change to any of them follows CM-02, and every dependent requirement document is updated in the same change.\n\n| Code | Workbook | File | Sheets |\n| :--- | :--- | :--- | ---: |\n"
body += "".join(f"| {k} | {SRC_NAMES[k]} | `data-form-process-sheets/{f}` | {len(books[k]) if k in books else 1} |\n" for k, f in files.items())
body += "\n`parsed_forms_spec.json` in the same folder is a machine-readable derivative of the Forms & Fields workbook and is not a separate source of record.\n"
use("P", "00_Read_Me"); use("P", "01_Sheet_Index")
body += "\n## Process workbook — read-me and conventions\n\n" + table([{"Topic": r[0], "Detail": r[1] if len(r) > 1 else ""} for r in P["00_Read_Me"] if r and r[0].strip()], ["Topic", "Detail"])
body += "\n## Process workbook — sheet index\n\n" + table([{"Sheet": r[0], "Purpose": " · ".join(r[1:])} for r in P["01_Sheet_Index"] if r and r[0].strip()], ["Sheet", "Purpose"])
doc("00_Programme_Governance/06_Source_Workbooks/SRC-01_Source_Workbook_Register.md", "SRC-01", "Source Workbook Register", "Configuration Manager", "CM, RDM", "DOC-02, CM-01, TR-04", [SRC_NAMES[k] for k in "PFBDHC"], body, depth=2, approver="Steering Committee")

# ------------------------------------------------------------------ coverage report
alltext = "\n".join(WRITTEN.values())
idpat = re.compile(r"^(?:RL-\d+|SCR-\d+|FRM-[A-Z]+-\d+|TC-[A-Z0-9]+|BL-\d+|OD-\d+|R-\d+|T-\d+|Q-\d+|W-\d+|RP-\d+|F-[A-Z]+-\d+|CMP-\d+|SM-\d+|S-\d+|L0-\d+|(?:%s)-\d+p?|PL_[A-Z_]+|EN_[A-Z_]+)$" % "|".join(DOM_CODES))
rows = []
for bk, book in books.items():
    for s, data in book.items():
        ids = {c.strip() for r in data for c in r[:1] if idpat.match(c.strip())}
        found = {i for i in ids if i in alltext or ("BS:" + i) in alltext}
        miss = sorted(ids - found)
        rows.append({"Workbook": bk, "Sheet": s, "Rows": str(len(data)), "Used": "Yes" if s in USED[bk] else "**No**", "IDs found": str(len(ids)), "IDs covered": str(len(found)), "Missing": ", ".join(miss[:10])})
ep_ok = sum(1 for e in ENDPOINTS if e["Form ID"] in alltext)
body = f"Automated audit showing that every sheet and every identifier in the source workbooks appears in the requirements set.\n\n**Summary.** Sheets used: {sum(r['Used'] == 'Yes' for r in rows)} / {len(rows)}. Identifiers covered: {sum(int(r['IDs covered']) for r in rows)} / {sum(int(r['IDs found']) for r in rows)}. Form endpoint rows covered: {ep_ok} / {len(ENDPOINTS)}.\n\n"
body += "## 1. Sheet coverage\n\n" + table(rows, ["Workbook", "Sheet", "Rows", "Used", "IDs found", "IDs covered", "Missing"], ["Book", "Sheet", "Rows", "Used", "IDs", "Covered", "Missing IDs"])
body += """
## 2. Content intentionally excluded

- **Delivery status columns** — all requirements are new, so client and delivery tracker statuses are excluded: `Client status`, `Demo status`, `Build action`, `Action`, `Data readiness`, coverage `Status`, and the `Status` column of the client tracker. Business-data status fields inside the golden dataset (for example an employee's employment status) are retained because they are data.
- **Third-party product references** — product-mapping columns and third-party product names in the sources are removed or replaced by generic terms (for example "ERP system", "business messaging channel").

## 3. Identifier conventions applied

| Convention | Reason | Applied as |
| :--- | :--- | :--- |
| Build-sheet rule IDs `RL-01…` collide with process-workbook rule IDs `RL-001…` | Ambiguous traceability | Build-sheet rules shown as `BS:RL-xx` (qualified, not renumbered) |
| Domain document IDs `<DOM>-nn` would collide with process IDs (e.g. `TIM-01`) | Ambiguous traceability | Domain documents use `FRS-<DOM>-nn` |
| Compliance processes use the suffix `p` (`CMP-01p`) to avoid colliding with component IDs `CMP-nn` | — | Retained as in source |
| Two form namespaces: `FRM-<MOD>-nn` (forms workbook) and `F-<MOD>-nn` (build sheet client deltas) | Two IDs for related forms | Both retained; workflow and coverage tables cross-reference them |
"""
doc(f"{TRD}/TR-04_Source_Coverage_Report.md", "TR-04", "Source Coverage Report", "PQA Lead", "RDM, PQA, CM", "SRC-01, REQ-02, TR-01, TR-02, TR-03", [SRC_NAMES[k] for k in "PFBDHC"], body)
json.dump({"findings": FINDINGS, "authored_tests": len(ALL_ATC)}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "findings.json"), "w"), indent=1)
print("files:", len(WRITTEN), "| authored tests:", len(ALL_ATC), "| unused sheets:", [(r["Workbook"], r["Sheet"]) for r in rows if r["Used"] != "Yes"], "| missing ids:", sum(1 for r in rows if r["Missing"]), "| use-case domains:", len(UCS))
