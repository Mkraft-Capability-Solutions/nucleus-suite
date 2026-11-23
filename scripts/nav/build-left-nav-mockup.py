"""Builds docs/plans/V1.0/NAVIGATION-LEFT-MOCKUP.html: every menu and sub-menu of navigation.catalog.json regrouped
into one left menu with short names. Fails if any catalog item is not placed."""
import json, html

catalog = json.load(open("src/config/ui/navigation.catalog.json"))
original = {}
for dom in catalog["domains"]:
    for g in dom.get("groups", []):
        for it in g.get("items", []):
            original[it["label"]] = (dom.get("label"), g.get("heading"))

# module -> (icon, [(group, [(short name, [original labels])])])
NAV = [
  ("Home", "home", [
    ("Consoles", [("People Command", ["People Command Centre"]), ("HR Operations", ["HR Operations Console"]), ("Attendance", ["Attendance & Shifts"]),
                  ("Hiring", ["Talent Acquisition"]), ("Payroll", ["Payroll Control Room"]), ("Performance", ["Performance & Talent"]),
                  ("My Team", ["Manager Cockpit"]), ("My Home", ["Employee Home"]), ("Capability", ["Magnetix Capability"]), ("Governance", ["Workspace Governance"])]),
  ]),
  ("People", "users", [
    ("Employees", [("Directory", ["People Core"]), ("Employee Record", ["Employee Record"]), ("Assignments", ["Assignment And Policy Attributes"]),
                   ("Documents", ["Document Vault"]), ("Letters", ["Letters And Issue Register"]), ("Policy Sign-offs", ["Policy Acknowledgements"]), ("Self-service", ["Employee Home Actions"])]),
    ("Organisation", [("Org Structure", ["Organization Management"]), ("Legal Entities", ["Legal Entity Master"]), ("Locations", ["Location / Work Site Master"]),
                      ("Positions", ["Position Register"]), ("Sanctioned Strength", ["Sanctioned Strength Board"]), ("Workforce Plan", ["Workforce Management"])]),
    ("Lifecycle", [("Onboarding", ["Onboarding & Lifecycle"]), ("Joining Chain", ["Joining Chain Console"]), ("Confirmation", ["Confirmation Review"]),
                   ("Exits", ["Resignation And Exit"]), ("Clearance", ["Clearance Board"])]),
    ("Service", [("Helpdesk", ["HR Operations & Helpdesk"]), ("Tickets", ["Helpdesk Ticket"]), ("HR Assistant", ["Assistant And Helpdesk"])]),
  ]),
  ("Time", "clock", [
    ("Attendance", [("Overview", ["Smart Attendance"]), ("Check In / Out", ["Check In And Check Out"]), ("My Attendance", ["My Attendance History"]),
                    ("Day Detail", ["Attendance Day Detail"]), ("Team History", ["Team History"]), ("Exceptions", ["Attendance Exception Queue"]), ("Recompute", ["Attendance Recompute Monitor"])]),
    ("Shifts", [("Shift Master", ["Shift Master"]), ("Rosters", ["Roster / Shift Schedule", "Shift Planning & Rosters"]), ("Overtime", ["Overtime Register"]), ("Gate Passes", ["Gate Pass Register"])]),
    ("Leave", [("Overview", ["Leave Management"]), ("Requests", ["Leave Requests"]), ("Balances", ["Leave Balance And Ledger"]), ("Policies", ["Leave Policy Configuration"]),
               ("Comp-off", ["Compensatory Off Claim"]), ("Encashment", ["Leave Encashment Request"])]),
  ]),
  ("Talent", "star", [
    ("Hiring", [("Overview", ["Talent ATS"]), ("Requisitions", ["Recruitment Requisitions"]), ("Candidates", ["Candidate Record And Application"]),
                ("Interviews", ["Interview Feedback"]), ("Offers", ["Offer Management"]), ("Referrals", ["Referral Tracking"])]),
    ("Performance", [("OKRs & Reviews", ["Performance & Okrs"]), ("Succession", ["Succession Planning"]), ("Mobility", ["Internal Mobility (ijp)"])]),
    ("Learning", [("Overview", ["Learning & L&D"]), ("My Learning", ["My Learning"]), ("Skills", ["Skills & Capability"])]),
    ("Engagement", [("Recognition", ["Recognition & Rewards"]), ("Recognition Log", ["Recognition Register"]), ("Announcements", ["Announcements"])]),
  ]),
  ("Pay", "wallet", [
    ("Payroll", [("Overview", ["Global Payroll"]), ("Run Payroll", ["Payroll Run Cockpit"]), ("Pre-payroll Audit", ["Pre-payroll Audit"]), ("Payslips", ["Payslips"]),
                 ("Reconciliation", ["Payroll Reconciliation"]), ("Disbursement", ["Bank Disbursement Control"])]),
    ("Compensation", [("Comp & Benefits", ["Compensation & Benefits"]), ("Salary Simulator", ["Salary Structure Simulator"]), ("Pay Components", ["Pay Component Master"])]),
    ("Claims & Loans", [("Reimbursements", ["Reimbursements & Claims"]), ("New Claim", ["Reimbursement Claim"]), ("Loans & EWA", ["Loans, Advances & EWA", "Loans And Advances"]),
                        ("Salary Advance", ["Salary Advance Request"])]),
    ("Tax & Accounts", [("Tax & Statutory", ["Tax & Statutory"]), ("Tax Declaration", ["Tax Declaration And Projection"]), ("GL Accounting", ["Payroll Accounting (GL)"]),
                        ("GL Mapping", ["GL Mapping And Journal"]), ("Full & Final", ["Full & Final Settlement", "Full And Final Settlement"])]),
  ]),
  ("Operations", "briefcase", [
    ("Workforce", [("Projects & Pods", ["Projects & Pod Allocation"]), ("Field Workforce", ["Field Workforce"]), ("Contract Workforce", ["Contract Workforce"]),
                   ("Contractor Invoices", ["Contractor Invoice Reconciliation", "Contractor Engagement And Invoice"])]),
    ("Work & Travel", [("Timesheets", ["Timesheets & Productivity"]), ("Travel & Duty", ["Travel & Duty Management"]), ("Assets", ["Assets & Gate Passes", "Asset Register"])]),
    ("Approvals", [("Approval Inbox", ["Unified Approval Inbox"])]),
  ]),
  ("Compliance", "shield", [
    ("Statutory", [("Overview", ["Statutory Compliance"]), ("Forms & Registers", ["Statutory Forms And Registers"]), ("Obligation Calendar", ["Obligation Calendar"]),
                   ("Rule Packs", ["Rule-pack Manager"]), ("Test Cases", ["Golden-case Library"])]),
  ]),
  ("Insights", "chart", [
    ("Dashboards", [("Executive", ["Executive Dashboards"]), ("People", ["People Intelligence"]), ("Workforce", ["Workforce Analytics"]),
                    ("Payroll", ["Payroll Analytics"]), ("Talent", ["Talent Analytics"])]),
    ("Reports", [("Report Builder", ["Custom Reports Builder"]), ("Operational Reports", ["Operational Reports"])]),
    ("AI", [("AI Agents", ["AI Copilot & Agents"]), ("Agent Ledger", ["Agent Console And Action Ledger"])]),
  ]),
  ("Admin", "gear", [
    ("Access", [("Access & Roles", ["Access Control & RBAC Studio"]), ("Access Scopes", ["Access Scope Administration"]), ("Security", ["Security Center"]), ("Audit Log", ["Immutable Audit Logs"])]),
    ("Configuration", [("Settings", ["Settings & Configuration"]), ("Workflows", ["Workflow Automation Studio"]), ("Notifications", ["Notifications & Alerts"])]),
    ("Integrations", [("Integrations & API", ["Integrations & API"]), ("Integration Setup", ["Integration Configuration"]), ("Sync Monitor", ["Integration Sync Monitor"])]),
  ]),
]

placed = [label for _, _, groups in NAV for _, items in groups for _, labels in items for label in labels]
missing = sorted(set(original) - set(placed)); unknown = sorted(set(placed) - set(original))
assert not missing, f"Not placed: {missing}"
assert not unknown, f"Unknown labels: {unknown}"
longest = max(len(n) for _, _, groups in NAV for _, items in groups for n, _ in items)
assert longest <= 20, f"Item name too long: {longest}"

ICONS = {
  "home": '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  "users": '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 4a4 4 0 0 1 0 8M22 21v-1a5 5 0 0 0-4-5"/>',
  "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  "star": '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  "wallet": '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/><path d="M6 6V5a2 2 0 0 1 2-2h10"/>',
  "briefcase": '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  "shield": '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  "gear": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  "catalog": '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
}
e = html.escape
def svg(name, size=20): return f'<svg class="i" width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'

GROUP_ICONS = ["grid", "users", "clock", "star", "wallet", "briefcase", "shield", "chart", "gear"]
rail_html, panels = [], []
for mi, (module, icon, groups) in enumerate(NAV):
    count = sum(len(items) for _, items in groups)
    rail_html.append(f'<button class="nav{" on" if mi == 0 else ""}" type="button" data-mod="m{mi}" title="{e(module)}">{svg(icon)}<span class="lb">{e(module)}</span><span class="ct">{count}</span></button>')
    rows = "".join(
        f'<div class="grp">{e(group)}</div>' + "".join(
            f'<a class="con{" on" if (mi == 0 and gi == 0 and ii == 0) else ""}" href="#" data-name="{e(name.lower())}" title="{e(" · ".join(labels))}"><span class="ib">{svg(icon, 18)}</span><span class="nm">{e(name)}</span></a>'
            for ii, (name, labels) in enumerate(items))
        for gi, (group, items) in enumerate(groups))
    panels.append(f'<div class="panel-mod" id="m{mi}"{"" if mi == 0 else " hidden"}><div class="right-head"><div><h3>{e(module)}</h3><div class="sub">{count} items · {len(groups)} groups</div></div></div><div class="cons">{rows}</div></div>')
nav_html = rail_html
rows = "".join(
    f'<tr><td>{e(module)}</td><td>{e(group)}</td><td><b>{e(name)}</b></td><td>{"<br>".join(e(l) for l in labels)}</td><td>{"<br>".join(e(original[l][0] + " › " + original[l][1]) for l in labels)}</td></tr>'
    for module, _, groups in NAV for group, items in groups for name, labels in items)
total_items = len(placed); total_entries = sum(len(items) for _, _, g in NAV for _, items in g)

page = f'''<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nucleus — Left Navigation (Pulse)</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {{ --void:#050913; --glass:rgba(16,26,46,.62); --glass-2:rgba(22,36,62,.7); --edge:rgba(148,163,184,.14); --edge-2:rgba(148,163,184,.24);
  --text:#E6EDF7; --text-2:#97A6BE; --text-3:#7F8FA9; --cyan:#38BDF8; --violet:#A78BFA; --mint:#34D399; --rose:#FB7185;
  --rail:rgba(7,12,24,.72); --head:rgba(8,14,28,.72); --hover:rgba(255,255,255,.05); --chip:rgba(255,255,255,.04);
  --on:linear-gradient(90deg,rgba(56,189,248,.2),rgba(167,139,250,.06)); --on-ring:rgba(56,189,248,.25); --grad:linear-gradient(120deg,#38BDF8,#A78BFA); --ink:#06101F;
  --rail-w:232px; --panel-w:300px; color-scheme: dark; }}
html[data-theme=light] {{ --void:#EEF3FA; --glass:rgba(255,255,255,.82); --glass-2:rgba(255,255,255,.94); --edge:rgba(15,23,42,.10); --edge-2:rgba(15,23,42,.18);
  --text:#0F172A; --text-2:#475569; --text-3:#5B6B80; --cyan:#0284C7; --violet:#7C3AED; --rail:rgba(255,255,255,.88); --head:rgba(255,255,255,.9);
  --hover:rgba(15,23,42,.05); --chip:rgba(15,23,42,.03); --on:linear-gradient(90deg,rgba(2,132,199,.14),rgba(124,58,237,.04)); --on-ring:rgba(2,132,199,.25); --grad:linear-gradient(120deg,#0284C7,#7C3AED); --ink:#fff; color-scheme: light; }}
* {{ box-sizing:border-box }} html,body {{ margin:0; height:100% }}
body {{ background:var(--void); color:var(--text); font:14px/1.5 Inter,system-ui,sans-serif; -webkit-font-smoothing:antialiased; }}
svg.i {{ fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0 }}
.chev {{ fill:none; stroke:currentColor; stroke-width:2; margin-left:auto; color:var(--text-3); transition:transform .2s }}
.app {{ height:100vh; display:grid; grid-template-rows:auto minmax(0,1fr) auto }}
.top {{ display:flex; align-items:center; gap:12px; padding:14px 24px; background:var(--head); backdrop-filter:blur(18px); border-bottom:1px solid var(--edge); position:relative }}
.top::after {{ content:""; position:absolute; inset:auto 0 -1px; height:1px; background:linear-gradient(90deg,transparent,var(--cyan),var(--violet),transparent); opacity:.7 }}
.brand {{ display:flex; align-items:center; gap:10px; font-weight:700; font-size:18px; white-space:nowrap }}
.logo {{ width:40px; height:40px; border-radius:13px; background:var(--grad); display:grid; place-items:center; color:var(--ink); font-weight:700 }}
.pill {{ height:40px; display:inline-flex; align-items:center; gap:10px; padding:0 14px 0 10px; border-radius:999px; background:var(--glass-2); border:1px solid var(--edge-2); font-weight:600 }}
.pill i {{ width:22px; height:22px; border-radius:50%; background:conic-gradient(var(--cyan),var(--violet),var(--cyan)) }}
.search {{ margin-left:auto; flex:0 1 380px; height:40px; display:flex; align-items:center; gap:10px; padding:0 12px; border-radius:12px; background:var(--chip); border:1px solid var(--edge); color:var(--text-2) }}
.btn {{ height:40px; padding:0 14px; border-radius:12px; border:1px solid var(--edge); background:var(--chip); color:var(--text); font:600 14px Inter; cursor:pointer }}
.mid {{ display:grid; grid-template-columns:var(--rail-w) var(--panel-w) minmax(0,1fr); min-height:0; transition:grid-template-columns .3s }}
.mid.c {{ --rail-w:80px }} .mid.pc {{ --panel-w:80px }}
.panel {{ background:var(--rail); backdrop-filter:blur(16px); border-right:1px solid var(--edge); display:flex; flex-direction:column; min-height:0; min-width:0 }}
.panel-body {{ flex:1; overflow-y:auto; padding:18px 14px; min-height:0 }}
.right-head {{ display:flex; justify-content:space-between; gap:8px; margin-bottom:10px }} .right-head h3 {{ margin:0; font-size:18px; font-weight:600; white-space:nowrap }}
.right-head .sub {{ font-size:12.5px; color:var(--text-3); white-space:nowrap }}
.cons {{ display:flex; flex-direction:column; gap:4px }}
.cons .grp {{ padding:12px 6px 4px }}
.con {{ display:flex; align-items:center; gap:12px; padding:8px 10px; border-radius:14px; color:var(--text-2); font-size:14px; font-weight:500; text-decoration:none; min-width:0 }}
.con:hover {{ background:var(--hover); color:var(--text) }}
.con .ib {{ width:34px; height:34px; border-radius:12px; display:grid; place-items:center; background:var(--hover); border:1px solid var(--edge); flex-shrink:0 }}
.con.on {{ color:var(--text); background:var(--on); box-shadow:inset 0 0 0 1px var(--on-ring) }} .con.on .ib {{ color:var(--cyan); border-color:var(--on-ring) }}
.con .nm {{ flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }}
.con.hide {{ display:none }}
.nav {{ width:100%; height:46px; display:flex; align-items:center; gap:12px; padding:0 12px; border:0; border-radius:14px; background:none; color:var(--text-2); font:600 15px Inter; cursor:pointer; white-space:nowrap }}
.nav:hover {{ background:var(--hover); color:var(--text) }} .nav.on {{ color:var(--text); background:var(--on); box-shadow:inset 0 0 0 1px var(--on-ring) }} .nav.on svg.i {{ color:var(--cyan) }}
.mid.pc .right-head, .mid.pc .cons .grp, .mid.pc .con .nm, .mid.pc .panel-search, .mid.pc .collapse-p span {{ display:none }} .mid.pc .con {{ justify-content:center; padding:6px }}
.rail {{ background:var(--rail); backdrop-filter:blur(16px); border-right:1px solid var(--edge); display:flex; flex-direction:column; min-height:0 }}
.rail-search {{ margin:14px 14px 8px; height:38px; display:flex; align-items:center; gap:8px; padding:0 10px; border-radius:12px; border:1px solid var(--edge); background:var(--chip); color:var(--text-3) }}
.rail-search input {{ flex:1; min-width:0; border:0; background:none; color:var(--text); font:14px Inter; outline:none }}
.mods {{ flex:1; overflow-y:auto; padding:4px 14px 14px; display:flex; flex-direction:column; gap:4px }}
.mod-head {{ width:100%; height:46px; display:flex; align-items:center; gap:12px; padding:0 12px; border:0; border-radius:14px; background:none; color:var(--text-2); font:600 15px Inter; cursor:pointer; white-space:nowrap }}
.mod-head:hover {{ background:var(--hover); color:var(--text) }}
.mod.open > .mod-head {{ color:var(--text); background:var(--on); box-shadow:inset 0 0 0 1px var(--on-ring) }}
.mod.open > .mod-head svg.i {{ color:var(--cyan) }} .mod.open .chev {{ transform:rotate(90deg) }}
.ct {{ font-size:12.5px; font-weight:700; color:var(--text-3); background:var(--chip); border:1px solid var(--edge); border-radius:999px; padding:0 8px }}
.mod-body {{ display:none; padding:2px 0 8px 44px }} .mod.open .mod-body {{ display:block }}
.grp {{ font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--text-3); font-weight:700; padding:10px 8px 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }}
.item {{ display:block; height:34px; line-height:34px; padding:0 10px; border-radius:10px; color:var(--text-2); text-decoration:none; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; position:relative }}
.item:hover {{ background:var(--hover); color:var(--text) }}
.item.on {{ color:var(--text); background:var(--hover) }} .item.on::before {{ content:""; position:absolute; left:-12px; top:9px; bottom:9px; width:3px; border-radius:2px; background:var(--cyan) }}
.item.hide, .mod.hide {{ display:none }}
.rail-foot {{ padding:12px 14px; border-top:1px solid var(--edge) }}
.collapse {{ width:100%; height:40px; display:flex; align-items:center; gap:10px; justify-content:center; border-radius:12px; border:1px solid var(--edge); background:var(--chip); color:var(--text-2); font:600 14px Inter; cursor:pointer }}
.mid.c .lb, .mid.c .ct, .mid.c .collapse span {{ display:none }} .mid.c .nav {{ justify-content:center; padding:0 }}
.main {{ overflow-y:auto; padding:20px 24px 28px; display:flex; flex-direction:column; gap:16px }}
.card {{ background:var(--glass); border:1px solid var(--edge); border-radius:20px; padding:20px; backdrop-filter:blur(18px) }}
h1 {{ margin:0; font-size:26px; font-weight:600; letter-spacing:-.01em }} h2 {{ margin:0 0 4px; font-size:18px; font-weight:600 }} p {{ margin:0; color:var(--text-2) }}
.kick {{ font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--cyan); font-weight:700 }}
.facts {{ display:flex; gap:10px; flex-wrap:wrap; margin-top:12px }} .fact {{ padding:6px 12px; border-radius:12px; border:1px solid var(--edge); background:var(--chip); color:var(--text-2) }} .fact b {{ color:var(--text) }}
.tbl-wrap {{ overflow-x:auto }} table {{ width:100%; border-collapse:collapse; font-size:14px }}
th {{ text-align:left; font-size:12.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-3); padding:10px; border-bottom:1px solid var(--edge); white-space:nowrap }}
td {{ padding:9px 10px; border-bottom:1px solid var(--edge); color:var(--text-2); vertical-align:top }} td b {{ color:var(--text) }}
.foot {{ display:flex; justify-content:space-between; padding:12px 24px; border-top:1px solid var(--edge); background:var(--head); color:var(--text-3); font-size:12.5px }}
@media (max-width:900px) {{ .mid {{ --rail-w:80px; --panel-w:260px }} .lb,.ct {{ display:none }} .nav {{ justify-content:center; padding:0 }} .search {{ display:none }} }}
</style></head>
<body><div class="app">
<header class="top">
  <div class="brand"><span class="logo">N</span>Nucleus Suite</div>
  <span class="pill"><i></i>People Command Centre</span>
  <div class="search">Search people, documents… <span style="margin-left:auto;font-size:12.5px;color:var(--text-3)">⌘K</span></div>
  <button class="btn" type="button">Modules</button>
  <button class="btn" type="button" id="theme">Light / Dark</button>
</header>
<div class="mid" id="mid">
  <nav class="rail" aria-label="Main menu">
    <div class="mods" id="mods" style="padding-top:18px">{"".join(nav_html)}
      <button class="nav" type="button" title="Feature Catalog">{svg("catalog")}<span class="lb">Feature Catalog</span></button>
    </div>
    <div class="rail-foot"><button class="collapse" id="collapse" type="button" aria-expanded="true"><svg class="i" width="18" height="18" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg><span>Collapse menu</span></button></div>
  </nav>
  <aside class="panel" aria-label="Sub-menu">
    <label class="rail-search panel-search">{svg("chart",16).replace('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>','<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>')}<input id="q" placeholder="Find in this module…" aria-label="Find in this module"></label>
    <div class="panel-body">{"".join(panels)}</div>
    <div class="rail-foot"><button class="collapse collapse-p" id="collapse-p" type="button" aria-expanded="true"><svg class="i" width="18" height="18" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg><span>Collapse panel</span></button></div>
  </aside>
  <main class="main">
    <div class="card">
      <div class="kick">Proposal · sub-menu beside the left menu</div>
      <h1>Every menu and sub-menu in one place</h1>
      <p style="margin-top:6px">The right menu keeps its look and simply opens next to the left menu. Pick a module on the left; its sub-menu, grouped into short single-line groups, opens beside it. Both panels collapse from their bottom buttons; content uses the rest of the width.</p>
      <div class="facts"><span class="fact"><b>{len(NAV) + 1}</b> modules</span><span class="fact"><b>{sum(len(g) for _, _, g in NAV)}</b> groups</span><span class="fact"><b>{total_entries}</b> items</span><span class="fact"><b>{total_items}</b> original entries covered</span><span class="fact">Longest name <b>{longest}</b> characters — no wrapping</span></div>
    </div>
    <div class="card">
      <h2>Menu map</h2>
      <p>New short name, its group and module, and the original menu entries it replaces. Hover an item in the menu to see the same.</p>
      <div class="tbl-wrap"><table><thead><tr><th>Module</th><th>Group</th><th>New name</th><th>Replaces</th><th>Was under</th></tr></thead><tbody>{rows}</tbody></table></div>
    </div>
  </main>
</div>
<footer class="foot"><span>Connected · live transactions</span><span>Enterprise production · Neon PostgreSQL DB engine</span></footer>
</div>
<script>
const mid = document.getElementById('mid');
document.querySelectorAll('.nav[data-mod]').forEach(btn => btn.addEventListener('click', () => {{
  document.querySelectorAll('.nav').forEach(n => n.classList.remove('on')); btn.classList.add('on');
  document.querySelectorAll('.panel-mod').forEach(p => p.hidden = p.id !== btn.dataset.mod);
  mid.classList.remove('pc'); document.getElementById('q').value = ''; filter('');
}}));
document.querySelectorAll('.con').forEach(a => a.addEventListener('click', e => {{ e.preventDefault(); document.querySelectorAll('.con.on').forEach(x => x.classList.remove('on')); a.classList.add('on'); }}));
function toggle(id, cls, open, closed) {{ document.getElementById(id).addEventListener('click', e => {{ const c = mid.classList.toggle(cls); e.currentTarget.setAttribute('aria-expanded', String(!c)); e.currentTarget.querySelector('span').textContent = c ? open : closed; e.currentTarget.querySelector('svg').style.transform = c ? 'rotate(180deg)' : ''; }}); }}
toggle('collapse', 'c', 'Expand menu', 'Collapse menu'); toggle('collapse-p', 'pc', 'Expand panel', 'Collapse panel');
function filter(q) {{ document.querySelectorAll('.panel-mod:not([hidden]) .con').forEach(c => c.classList.toggle('hide', !!q && !c.dataset.name.includes(q) && !c.title.toLowerCase().includes(q))); }}
document.getElementById('q').addEventListener('input', e => filter(e.target.value.trim().toLowerCase()));
document.getElementById('theme').addEventListener('click', () => {{ const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'light' ? 'dark' : 'light'; }});
</script>
</body></html>'''
open("docs/plans/V1.0/NAVIGATION-LEFT-MOCKUP.html", "w").write(page)
print(f"modules={len(NAV)+1} items={total_entries} covering {total_items} original entries; longest name {longest}")
