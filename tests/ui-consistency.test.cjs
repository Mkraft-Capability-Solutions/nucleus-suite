const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (file) => fs.readFileSync(file, 'utf8');

test('global styles provide a responsive typography and control baseline', () => {
    const styles = read('src/app/globals.css');
    assert.match(styles, /--t-display: clamp\(/);
    assert.match(styles, /button, \[role="button"\]/);
    assert.match(styles, /white-space: nowrap/);
    assert.match(styles, /@media \(max-width: 720px\)/);
});

test('leave application opens as a modal workflow rather than an inline form', () => {
    const source = read('src/components/Clerio/LeaveView.js');
    assert.match(source, /isApplyModalOpen/);
    assert.match(source, /LeaveApplicationDialog/);
    assert.match(source, /setIsApplyModalOpen\(true\)/);
});

test('navigation filters each menu surface through the current role permissions', () => {
    for (const file of [
        'src/components/Clerio/LeftDock.js',
        'src/components/Clerio/RightSubNav.js',
        'src/components/Navigation/DualPaneNav.js',
    ]) {
        assert.match(read(file), /isModuleAllowed/);
    }
});

test('the dashboard entry remains available while console choices stay permission-scoped', () => {
    const source = read('src/lib/navigation-access.js');
    assert.match(source, /if \(domainId === 'dashboard'\) return true/);
    assert.match(read('src/components/Clerio/RightSubNav.js'), /isConsoleAllowed/);
    assert.match(read('src/components/Navigation/DualPaneNav.js'), /isConsoleAllowed/);
});

test('restricted screens do not offer an unauthorized persona a way to self-grant access', () => {
    const source = read('src/components/auth/RoleProtected.js') + read('src/config/ui/components.auth.RoleProtected.json');
    assert.doesNotMatch(source, /Grant Access to/);
    assert.doesNotMatch(source, /Switch to Super Admin/);
    assert.match(source, /Access restricted/);
});

test('top-level actions are filtered by permission and do not switch a signed-in user role', () => {
    const source = read('src/components/Clerio/TopNav.js');
    assert.match(source, /quickActions\.length > 0/);
    assert.match(source, /isModuleAllowed\(action\.id/);
    assert.doesNotMatch(source, /switchRole\(/);
    assert.doesNotMatch(source, /Switch Persona/);
});

test('picklists catalog contains 119 seeded picklists and is mounted in SettingsView', () => {
    const catalog = JSON.parse(read('src/config/ui/picklists.catalog.json'));
    assert.equal(catalog.picklists.length, 119);
    const codes = new Set(catalog.picklists.map(p => p.code));
    assert.ok(codes.has('PL_ENTITY_TYPE'));
    assert.ok(codes.has('PL_EMPLOYMENT_TYPE'));
    assert.ok(codes.has('PL_GENDER'));
    assert.ok(codes.has('PL_ATTENDANCE_MODE'));
    assert.ok(codes.has('PL_ROLE'));
    
    const settingsSource = read('src/components/Clerio/SettingsView.js');
    assert.match(settingsSource, /Picklists Catalog/);
    assert.match(settingsSource, /searchPicklists/);
});

