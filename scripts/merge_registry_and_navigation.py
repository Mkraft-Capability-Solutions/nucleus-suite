import json

with open('documentation/sheets/parsed_forms_spec.json') as f:
    forms = json.load(f)

with open('src/config/ui/lib.operational-module-registry.json') as f:
    reg = json.load(f)

with open('src/config/ui/navigation.catalog.json') as f:
    nav = json.load(f)

# Mapping from screenId to existing module in registry
scr_to_mod = {m.get('screenId'): m for m in reg.get('modules', [])}

# New modules definitions for the 14 forms not in registry
NEW_FORM_MODULES = {
    'FRM-TIM-01': {
        'id': 'shift_master',
        'screenId': 'SCR-028',
        'title': 'Shift master',
        'primary': 'attendance',
        'domain': 'core_hr',
        'groupHeading': 'Attendance Operations',
        'icon': 'Clock',
        'tag': 'Master',
        'desc': 'Shift definition, timings, grace period, breaks, and overtime rules'
    },
    'FRM-TIM-02': {
        'id': 'roster_schedule',
        'screenId': 'SCR-029',
        'title': 'Roster / shift schedule',
        'primary': 'attendance',
        'domain': 'core_hr',
        'groupHeading': 'Attendance Operations',
        'icon': 'Calendar',
        'tag': 'Schedule',
        'desc': 'Shift scheduling, site allocations, rest days, and roster publishing'
    },
    'FRM-LVE-03': {
        'id': 'compensatory_off',
        'screenId': 'SCR-033',
        'title': 'Compensatory off claim',
        'primary': 'leaves',
        'domain': 'core_hr',
        'groupHeading': 'Leave Operations',
        'icon': 'EventAvailableOutlined',
        'tag': 'Self Service',
        'desc': 'Comp-off grant claims, weekend / holiday work justification'
    },
    'FRM-LVE-04': {
        'id': 'leave_encashment',
        'screenId': 'SCR-034',
        'title': 'Leave encashment request',
        'primary': 'leaves',
        'domain': 'core_hr',
        'groupHeading': 'Leave Operations',
        'icon': 'PaidOutlined',
        'tag': 'Payout',
        'desc': 'Earned leave encashment and payroll payout workflow'
    },
    'FRM-LCY-02': {
        'id': 'probation_confirmation',
        'screenId': 'SCR-068',
        'title': 'Confirmation review',
        'primary': 'people_core',
        'domain': 'core_hr',
        'groupHeading': 'Lifecycle & Governance',
        'icon': 'CheckCircle2',
        'tag': 'Governance',
        'desc': 'Probation assessment, confirmation review, and extension decisions'
    },
    'FRM-LCY-03': {
        'id': 'resignation_exit',
        'screenId': 'SCR-069',
        'title': 'Resignation and exit',
        'primary': 'people_core',
        'domain': 'core_hr',
        'groupHeading': 'Lifecycle & Governance',
        'icon': 'ExitToAppOutlined',
        'tag': 'Governance',
        'desc': 'Resignation submission, notice period calculation, and exit approvals'
    },
    'FRM-PAY-01': {
        'id': 'pay_component_master',
        'screenId': 'SCR-057',
        'title': 'Pay component master',
        'primary': 'payroll',
        'domain': 'payroll_finance',
        'groupHeading': 'Payroll & Finance Operations',
        'icon': 'CalculateOutlined',
        'tag': 'Master',
        'desc': 'Earnings, deductions, statutory flags, and wage calculation formulas'
    },
    'FRM-PAY-06': {
        'id': 'reimbursement_claim',
        'screenId': 'SCR-058',
        'title': 'Reimbursement claim',
        'primary': 'payroll',
        'domain': 'payroll_finance',
        'groupHeading': 'Payroll & Finance Operations',
        'icon': 'ReceiptLongOutlined',
        'tag': 'Claims',
        'desc': 'Flexible benefits, expense proofs, bill verification, and payouts'
    },
    'FRM-CMB-02': {
        'id': 'salary_advance',
        'screenId': 'SCR-081',
        'title': 'Salary advance request',
        'primary': 'payroll',
        'domain': 'payroll_finance',
        'groupHeading': 'Payroll & Finance Operations',
        'icon': 'PaidOutlined',
        'tag': 'Advance',
        'desc': 'Emergency salary advances, limit checks, and EMI deductions'
    },
    'FRM-TAL-02': {
        'id': 'candidate_application',
        'screenId': 'SCR-092',
        'title': 'Candidate record and application',
        'primary': 'recruitment',
        'domain': 'talent',
        'groupHeading': 'Talent & Experience Operations',
        'icon': 'PersonAddAltOutlined',
        'tag': 'ATS',
        'desc': 'Candidate profile intake, resume parsing, and requisition mapping'
    },
    'FRM-TAL-03': {
        'id': 'interview_feedback',
        'screenId': 'SCR-093',
        'title': 'Interview feedback',
        'primary': 'recruitment',
        'domain': 'talent',
        'groupHeading': 'Talent & Experience Operations',
        'icon': 'FactCheckOutlined',
        'tag': 'Evaluation',
        'desc': 'Panel assessment, competency scoring, and hiring recommendations'
    },
    'FRM-TAL-04': {
        'id': 'offer_management',
        'screenId': 'SCR-094',
        'title': 'Offer management',
        'primary': 'recruitment',
        'domain': 'talent',
        'groupHeading': 'Talent & Experience Operations',
        'icon': 'DescriptionOutlined',
        'tag': 'Offers',
        'desc': 'Compensation proposals, approval matrices, and offer letter release'
    },
    'FRM-SSV-01': {
        'id': 'helpdesk_ticket',
        'screenId': 'SCR-043',
        'title': 'Helpdesk ticket',
        'primary': 'analytics',
        'domain': 'analytics_ai',
        'groupHeading': 'Intelligence Operations',
        'icon': 'SupportAgentOutlined',
        'tag': 'Service',
        'desc': 'Service tickets, category triage, SLA tracking, and resolution audit'
    },
    'FRM-CTG-02': {
        'id': 'contractor_invoice',
        'screenId': 'SCR-096',
        'title': 'Contractor invoice reconciliation',
        'primary': 'compliance',
        'domain': 'workforce_ops',
        'groupHeading': 'Workforce Operations',
        'icon': 'ReceiptOutlined',
        'tag': 'Vendor',
        'desc': 'Contract worker billing verification, attendance cross-check, and pass-through payments'
    }
}

# 3. Update existing modules with formId and complete fields from Excel
for fid, f in forms.items():
    scr = f['screen_id']
    if scr in scr_to_mod:
        mod = scr_to_mod[scr]
        mod['formId'] = fid
        # Update fields with the complete 02_Field_Spec fields
        mod['fields'] = f['fields']
        # If columns empty, set from first 5 fields
        if not mod.get('columns'):
            mod['columns'] = [field['label'] for field in f['fields'][:5]]

# 4. Add the 14 new modules to registry
existing_mod_ids = {m['id'] for m in reg['modules']}
for fid, meta in NEW_FORM_MODULES.items():
    f = forms[fid]
    mod_id = meta['id']
    title_str = meta['title']
    if mod_id not in existing_mod_ids:
        new_mod = {
            'id': mod_id,
            'screenId': meta['screenId'],
            'formId': fid,
            'title': title_str,
            'primary': meta['primary'],
            'endpoint': f'/api/v1/ops/modules/{mod_id}/records',
            'fields': f['fields'],
            'description': meta['desc'],
            'stateLabel': 'Status',
            'states': ['Draft', 'Pending', 'Approved', 'Active', 'Closed'],
            'actions': ['Create ' + title_str.lower(), 'Edit ' + title_str.lower()],
            'columns': [field['label'] for field in f['fields'][:5]] + ['Status'],
            'apiMethod': 'GET'
        }
        reg['modules'].append(new_mod)
        existing_mod_ids.add(mod_id)

    # Add id to group in reg['groups']
    for grp in reg.get('groups', []):
        if grp.get('primary') == meta['primary']:
            if mod_id not in grp.get('ids', []):
                grp['ids'].append(mod_id)
            break

# 5. Add submenu items to navigation.catalog.json
for fid, meta in NEW_FORM_MODULES.items():
    domain_id = meta['domain']
    target_domain = next((d for d in nav.get('domains', []) if d.get('id') == domain_id), None)
    if not target_domain:
        continue
    
    target_group = next((g for g in target_domain.get('groups', []) if g.get('heading') == meta['groupHeading']), None)
    if not target_group:
        target_group = target_domain['groups'][-1]
    
    # Check if item with this targetTab or id already exists
    exists = any(item.get('id') == meta['id'] or item.get('targetTab') == meta['id'] for item in target_group.get('items', []))
    if not exists:
        target_group['items'].append({
            'id': meta['id'],
            'label': meta['title'].title(),
            'targetTab': meta['id'],
            'tag': meta['tag'],
            'desc': meta['desc'],
            'icon': meta['icon']
        })

with open('src/config/ui/lib.operational-module-registry.json', 'w') as f:
    json.dump(reg, f, indent=2)

with open('src/config/ui/navigation.catalog.json', 'w') as f:
    json.dump(nav, f, indent=2)

print('Updated lib.operational-module-registry.json and navigation.catalog.json successfully!')
print('Total modules in registry now:', len(reg['modules']))
