const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workspace = path.join(process.cwd(), 'src/components/Clerio/MainWorkspace.js');

test('the active workspace hosts the shared action form launcher', () => {
  const source = fs.readFileSync(workspace, 'utf8');

  assert.match(source, /NucleusActionModal/);
  assert.match(source, /nucleus:open-action/);
});

test('the action modal resets values when a different workflow opens', () => {
  const modal = fs.readFileSync(path.join(process.cwd(), 'src/components/Clerio/ActionFormModal.js'), 'utf8');

  assert.match(modal, /useEffect\(\(\) => \{\s*setValues\(initialValues\)/);
});
