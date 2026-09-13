import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const read = path => JSON.parse(readFileSync(path,'utf8'));
const plan = read('plan/service-plan-coverage.json');
const source = execFileSync('rg',['--files','src'],{encoding:'utf8'}).trim().split('\n');
const checks=[];
function same(label,expected,actual) {
    assert.equal(new Set(actual).size,actual.length,`${label}: duplicate coverage`);
    assert.deepEqual([...actual].sort(),[...expected].sort(),`${label}: missing or stale source entries`);
    checks.push({label,count:actual.length});
}
same('navigation',read('src/data/ui/navigation.catalog.json').domains.flatMap(domain=>domain.groups.flatMap(group=>group.items.map(item=>item.id))),plan.navigation.map(item=>item.id));
same('operational screens',read('src/data/ui/lib.operational-module-registry.json').modules.map(item=>item.id),plan.operationalScreens.map(item=>item.id));
same('action dialogs',Object.keys(read('src/data/ui/components.Clerio.ActionFormModal.json').common_1),plan.actions.map(item=>item.id));
same('dashboard widgets',read('src/data/ui/dashboard.widgets.json').widgets.map(item=>item.id),plan.widgets);
same('route handlers',source.filter(file=>/\/route\.[jt]s$/.test(file)),plan.routes.map(item=>item.file));
same('page entrypoints',source.filter(file=>/\/page\.[jt]sx?$/.test(file)),plan.pages);
for (const item of [...plan.navigation,...plan.actions]) assert.ok(item.owner,`Missing service owner for ${item.id}`);
for (const input of plan.inputs) assert.equal(createHash('sha256').update(readFileSync(input.path)).digest('hex'),input.sha256,`Stale plan input ${input.path}`);
const catalog=readFileSync('plan/FEATURE_SERVICE_CATALOG.md','utf8');
for(const item of plan.navigation) assert.ok(catalog.includes(`### ${item.id} —`));
for(const item of plan.operationalScreens) assert.ok(catalog.includes(`### ${item.screenId} / ${item.id} —`));
for(const item of plan.actions) assert.ok(catalog.includes(`### Action ${item.id} —`));
for(const id of plan.widgets) assert.ok(catalog.includes(`### Widget ${id} —`));
const report={status:'passed',meaning:'Source coverage and catalog integrity only; service implementation and business correctness are not certified.',checks};
writeFileSync('plan/service-plan-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
