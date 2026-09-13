import ts from 'typescript';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/discover-ui-text.mjs']);
assert.equal(JSON.parse(readFileSync('plan/frontend-live-gap-register.json','utf8')).directLabelLocations,0,'Direct JSX copy must use a message resource.');
const catalog=JSON.parse(readFileSync('src/data/locales/en/interface.json','utf8'));
const files=execFileSync('rg',['--files','src/components'],{encoding:'utf8'}).trim().split('\n').filter(path=>/\.[jt]sx?$/.test(path));
let calls=0;
for(const path of files){
 const ast=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='translateText'&&node.arguments.length>=2&&node.arguments.slice(0,2).every(ts.isStringLiteral)){
   const [namespace,key]=node.arguments;assert.equal(typeof catalog[namespace.text]?.[key.text],'string',`${path}: Missing ${namespace.text}.${key.text}`);calls++;
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);
}
writeFileSync('plan/interface-copy-verification.json',JSON.stringify({status:'passed',checkedCalls:calls,publishedLocales:['en'],scope:'Literal translation references resolve. This is not proof of complete database-backed localization or removal of all application literals.'},null,2)+'\n');
console.log(`${calls} literal translation references resolve.`);
