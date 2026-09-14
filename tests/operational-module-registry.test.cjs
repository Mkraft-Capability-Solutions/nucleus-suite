const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = process.cwd();

test('the module registry includes each currently missing workbook screen', () => {
  const source = fs.readFileSync(path.join(root, 'src/config/ui/lib.operational-module-registry.json'), 'utf8');
  for (const screen of [
    'SCR-013', 'SCR-022', 'SCR-024', 'SCR-025', 'SCR-026', 'SCR-027', 'SCR-032',
    'SCR-054', 'SCR-055', 'SCR-062', 'SCR-070', 'SCR-071', 'SCR-101', 'SCR-102', 'SCR-103'
  ]) {
    assert.match(source, new RegExp(screen));
  }
  const workbookScreenIds = new Set(source.match(/SCR-\d{3}/g));
  assert.equal(workbookScreenIds.size, 51);
});

test('the workspace can render registered operational modules', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/Clerio/MainWorkspace.js'), 'utf8');
  assert.match(source, /OperationalModuleView/);
  assert.match(source, /getOperationalModule/);
});

test('navigation exposes operational submodules below their primary modules', () => {
  const sideNav = fs.readFileSync(path.join(root, 'src/components/Clerio/SideNav.js'), 'utf8');
  const rightNav = fs.readFileSync(path.join(root, 'src/components/Clerio/RightSubNav.js'), 'utf8');
  const navigator = fs.readFileSync(path.join(root, 'src/components/Navigation/DualPaneNav.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src/components/AppWorkspace.js'), 'utf8');

  assert.match(sideNav, /operationalNavigationGroups/);
  assert.match(sideNav, /isSubmodule/);
  assert.match(sideNav, /submoduleItem/);
  assert.match(rightNav, /navigationDomains/);
  assert.match(navigator, /navigationDomains/);
  const domains = JSON.parse(fs.readFileSync(path.join(root, 'src/config/ui/navigation.catalog.json'))).domains;
  const targets = new Set(domains.flatMap(d => d.groups.flatMap(g => g.items.map(i => i.targetTab))));
  for (const entry of JSON.parse(fs.readFileSync(path.join(root, 'src/config/ui/lib.operational-module-registry.json'))).modules) assert.ok(targets.has(entry.id), entry.id);
  assert.match(app, /getOperationalModule\(subFeatureId\)/);
});

test('each navigation surface uses the shared operational domain map', () => {
  const registry = fs.readFileSync(path.join(root, 'src/lib/operational-module-registry.js'), 'utf8');
  const rightNav = fs.readFileSync(path.join(root, 'src/components/Clerio/RightSubNav.js'), 'utf8');
  const navigator = fs.readFileSync(path.join(root, 'src/components/Navigation/DualPaneNav.js'), 'utf8');
  assert.match(registry, /operationalNavigationDomains/);
  assert.match(rightNav, /navigationDomains/);
  assert.match(navigator, /navigationDomains/);
});
