import ts from 'typescript';
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const files = execFileSync('rg', ['--files', 'src'], {encoding:'utf8'}).trim().split('\n').filter(file => /\.[jt]sx?$/.test(file));
const forms = [], numeric = [], requiredCandidates = [];
for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const line = node => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const attrs = node => Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attr => [attr.name.getText(source), attr.initializer?.getText(source) ?? true]));
    function visit(node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tag = node.tagName.getText(source), properties = attrs(node);
            if (tag === 'form') forms.push({file,line:line(node),submit:properties.onSubmit ?? null});
            if (tag === 'input' && ['"number"', "'number'", '"range"', "'range'"].includes(properties.type)) {
                numeric.push({file,line:line(node),type:properties.type,missing:['min','max','step'].filter(key => !(key in properties))});
            }
        }
        if (ts.isJsxElement(node)) {
            const labels = node.children.filter(child => ts.isJsxElement(child) && child.openingElement.tagName.getText(source) === 'label');
            const controls = node.children.filter(child => ts.isJsxSelfClosingElement(child) && ['input','textarea'].includes(child.tagName.getText(source)));
            for (const label of labels) {
                let required = false;
                function inspect(child) {
                    if (ts.isJsxText(child) && child.text.includes('*')) required = true;
                    if (ts.isCallExpression(child) && child.expression.getText(source) === 'readData' && child.arguments.length === 2 && child.arguments.every(ts.isStringLiteral)) {
                        try {
                            const copy = JSON.parse(readFileSync(`src/data/ui/${child.arguments[0].text}.json`, 'utf8'))[child.arguments[1].text];
                            if (typeof copy === 'string' && copy.includes('*')) required = true;
                        } catch { /* Non-UI resources are outside this label heuristic. */ }
                    }
                    ts.forEachChild(child, inspect);
                }
                inspect(label);
                if (required) for (const control of controls) if (!('required' in attrs(control))) requiredCandidates.push({file,line:line(control)});
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
}
const modules = JSON.parse(readFileSync('src/data/ui/lib.operational-module-registry.json','utf8')).modules;
const actions = JSON.parse(readFileSync('src/data/ui/components.Clerio.ActionFormModal.json','utf8')).common_1;
const metadataNumeric = [
    ...modules.flatMap(module => module.fields.filter(field => field.type === 'number').map(field => ({owner:module.id,...field}))),
    ...Object.entries(actions).flatMap(([owner,action]) => action.fields.filter(field => field[2] === 'number').map(([key,,,required,,constraints]) => ({owner,key,required,...constraints})))
];
const metadataGaps = metadataNumeric.filter(field => !Number.isFinite(field.min) || !Number.isFinite(field.max) || !(field.step > 0) || field.max < field.min);
const report = {scope:'Static intrinsic forms/numeric inputs and both shared metadata engines; click-only domain commands require separate validation contracts.',filesScanned:files.length,forms,numeric,metadataNumeric,requiredCandidates,metadataGaps};
writeFileSync('plan/form-inventory.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:files.length,forms:forms.length,numeric:numeric.length,metadataNumeric:metadataNumeric.length,missingNumeric:numeric.filter(field=>field.missing.length),requiredCandidates,metadataGaps},null,2));
if (numeric.some(field => field.missing.length) || requiredCandidates.length || metadataGaps.length) process.exitCode = 1;
