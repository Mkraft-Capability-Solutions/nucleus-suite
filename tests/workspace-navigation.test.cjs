const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const catalog = require('../src/config/ui/navigation.catalog.json');
const registry = require('../src/config/ui/lib.operational-module-registry.json');

test('all operational screens and main workspace destinations appear in the shared menu', () => {
    const items = catalog.domains.flatMap(domain => domain.groups.flatMap(group => group.items));
    const targets = new Set(items.map(item => item.targetTab));
    for (const entry of registry.modules) assert.ok(targets.has(entry.id), entry.id);
    for (const target of ['dashboard', 'people_core', 'attendance', 'leaves', 'payroll', 'recruitment', 'onboarding', 'performance', 'learning', 'compensation', 'experience', 'integrations', 'compliance', 'helpdesk', 'contract_workforce', 'projects', 'team', 'settings', 'access_control']) assert.ok(targets.has(target), target);
    for (const domain of catalog.domains) {
        const ids = domain.groups.flatMap(group => group.items.map(item => item.id));
        assert.equal(new Set(ids).size, ids.length, `Duplicate menu item in ${domain.id}`);
    }
});

test('every menu icon resolves to an installed direct MUI import', () => {
    const source = fs.readFileSync('src/lib/workspace-navigation.js', 'utf8');
    const aliases = JSON.parse(source.match(/const aliases = (.*);/)[1]);
    const icons = [...catalog.domains.map(d => d.icon), ...catalog.domains.flatMap(d => d.groups.flatMap(g => g.items.map(i => i.icon)))];
    for (const name of icons) {
        const resolved = aliases[name] || name;
        assert.ok(fs.existsSync(`node_modules/@mui/icons-material/${resolved}.js`), name);
        assert.ok(source.includes(`from '@mui/icons-material/${resolved}'`), name);
    }
});

test('workbook mapping accounts for every screen and all reference sheets', () => {
    const report = require('../documentation/coverage/WORKBOOK_UI_COVERAGE.json');
    assert.equal(Object.keys(report.sheets).length, 23);
    assert.equal(Object.keys(report.screens).length, 49);
    for (const [id, screen] of Object.entries(report.screens)) {
        assert.ok(screen.moduleId, id);
        assert.equal(registry.modules.find(item => item.id === screen.moduleId).screenId, id);
        assert.ok(screen.sourceRow > 4);
    }
});
