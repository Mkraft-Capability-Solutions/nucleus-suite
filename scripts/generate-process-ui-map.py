"""Read the reference workbook without editing it; regenerate UI guidance and traceability."""
from pathlib import Path
import json,re,zipfile,xml.etree.ElementTree as E
SOURCE=Path('documentation/sheets/Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx')
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(SOURCE) as z:
    strings=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)] if 'xl/sharedStrings.xml' in z.namelist() else []
    rels={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets={}
    for sheet in E.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',ns):
        target=rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
        rows=[];headers={}
        for row in E.fromstring(z.read(target)).findall('m:sheetData/m:row',ns):
            cells={}
            for cell in row:
                value=cell.find('m:v',ns);inline=cell.find('m:is',ns)
                text=value.text if value is not None else ''.join(inline.itertext()) if inline is not None else ''
                if cell.attrib.get('t')=='s':text=strings[int(text)]
                if text:cells[re.sub(r'\d','',cell.attrib['r'])]=text
            number=int(row.attrib['r'])
            if number==4:headers=cells
            elif number>4 and cells and not cells.get('A','').startswith('§'):
                rows.append({'row':number,'cells':{headers.get(k,k):v for k,v in cells.items()}})
        sheets[sheet.attrib['name']]=rows
registry=json.loads(Path('src/data/ui/lib.operational-module-registry.json').read_text())['modules']
by_screen={m['screenId']:m for m in registry}
screens={}
for source in sheets['07_Screens']:
    fields=source['cells'];sid=fields.get('Screen ID','')
    if not re.fullmatch(r'SCR-\d+',sid):continue
    m=by_screen.get(sid)
    forms=[r for r in sheets['08_Form_Fields'] if r['cells'].get('Screen ID')==sid]
    steps=[r for r in sheets['04_Process_Steps'] if sid in r['cells'].get('Screen','')]
    rule_ids=set(re.findall(r'\b[A-Z]{2,5}-\d+[a-z]?\b',' '.join(r['cells'].get('Rule ID(s)','') for r in steps)))
    rules=[r for r in sheets['09_Business_Rules'] if r['cells'].get('Rule ID') in rule_ids]
    labels={re.sub(r'[^a-z0-9]','',f['label'].lower()) for f in m['fields']} if m else set()
    missing=[r['cells'].get('Field label') for r in forms if re.sub(r'[^a-z0-9]','',r['cells'].get('Field label','').lower()) not in labels]
    screens[sid]={'sourceRow':source['row'],'screen':fields,'moduleId':m['id'] if m else None,'component':'src/components/Clerio/OperationalModuleView.js' if m else None,'status':'UI surface available; complete workflow not verified' if m else 'Missing UI surface','formFields':forms,'steps':steps,'rules':rules,'fieldsNotMatchedByLabel':missing}
ui={'screens':screens,'copy':{'title':'Process guide','intro':'Reference workflow from the Nucleus process workbook. Connected approvals, integrations and persistence are planned for a later phase.','purpose':'Purpose','actors':'Who uses this','actions':'Required actions','fields':'Form requirements','steps':'Process steps','rules':'Business rules','empty':'No detailed rows are specified for this screen in this sheet.','source':'Source','validation':'Validation'}}
Path('src/data/ui/process.requirements.json').write_text(json.dumps(ui,indent=2,ensure_ascii=False)+'\n')
report={'source':str(SOURCE),'method':'All sheets extracted by cell reference. Screen IDs are matched exactly to the UI registry. Field label matching is conservative and not proof of behavior. Requirements are data, not executable instructions. No backend changes were made.','sheets':sheets,'screens':screens}
Path('documentation/coverage/WORKBOOK_UI_COVERAGE.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
lines=['# Workbook to UI coverage','',f'Source: `{SOURCE}`. Reviewed all {len(sheets)} sheets. The workbook was not modified.','',f'{len(screens)} screen IDs are specified; {sum(bool(s["moduleId"]) for s in screens.values())} have a matching operational UI surface. This does **not** mean every feature, rule, offline behavior or integration is implemented.','', '## Sheet-by-sheet assessment','', '| Sheet | Extracted requirement rows | Current assessment |','| --- | ---: | --- |']
for name,rows in sheets.items():
    assessment='Reference and planning material; not a feature-completion claim.'
    if name=='07_Screens':assessment='Every screen ID mapped below; generic UI is not end-to-end completion.'
    elif name=='08_Form_Fields':assessment='Field-level specifications attached to the process guide. Generic forms have label/validation gaps; see JSON detail.'
    elif name in ['03_Process_Inventory','04_Process_Steps','05_Swimlane_Maps','09_Business_Rules','10_Config_Tables','11_State_Machines']:assessment='UI/scenario coverage is partial; enforcement and all transitions are not verified.'
    elif name in ['12_Events','13_API_and_Tools','14_Agents','15_Integration_Flows','06_Data_Dictionary']:assessment='Live execution and storage are deferred by the frontend-only scope; existing code does not establish integration acceptance.'
    elif name in ['19_Test_Cases','20_NFR_and_DoD','21_Roles_and_RACI','17_Traceability']:assessment='Acceptance requirements captured. No claim of full rule, security, offline, load or release compliance.'
    lines.append(f'| {name} | {len(rows)} | {assessment} |')
lines+=['','## Screen mapping','', '| Workbook reference | Screen | UI module | Form labels not matched exactly |','| --- | --- | --- | ---: |']
for sid,s in screens.items():lines.append(f'| 07_Screens!A{s["sourceRow"]} ({sid}) | {s["screen"]["Screen"]} | `{s["moduleId"]}` | {len(s["fieldsNotMatchedByLabel"])} |')
lines+=['','## What remains','', '- Generic screen actions and browser state are available for layout review. Complete validation, conditional field visibility, offline queues, multi-stage approvals and state guards must be accepted separately.', '- Live payroll disbursement, statutory filing, document delivery, ERP/WhatsApp/Teams integrations, agent execution and durable audit trails are not enabled in this phase.', '- `WORKBOOK_UI_COVERAGE.json` retains every extracted requirement row, source row number and detailed screen/form/step/rule mapping. A missing exact label is a review candidate, not an automatic proof that the concept is absent elsewhere.', '- Each operational screen includes a Process guide so reviewers can compare its reference actions and fields with the current UI. The guide is reference content, not an implementation of the listed workflow.','']
Path('documentation/coverage/WORKBOOK_UI_COVERAGE.md').write_text('\n'.join(lines))
print(f'{len(sheets)} sheets; {len(screens)} screens; {sum(bool(s["moduleId"]) for s in screens.values())} matched')
