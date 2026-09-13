import ts from 'typescript';
import { readFileSync,writeFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
const walkFiles=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walkFiles(join(dir,e.name)):[join(dir,e.name)]);
const files=walkFiles('src').filter(p=>/\.[jt]sx?$/.test(p)&&!p.includes('.test.')&&(p.startsWith('src/components/')||p.startsWith('src/context/')||p.startsWith('src/app/')));
const findings=[];
for(const path of files){
 const source=readFileSync(path,'utf8');const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,/tsx$/.test(path)?ts.ScriptKind.TSX:ts.ScriptKind.JSX);
 const labels=[];let snapshotReads=0;
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='readData')snapshotReads++;
  if(ts.isJsxText(node)&&node.text.trim())labels.push({line:ast.getLineAndCharacterOfPosition(node.getStart()).line+1,kind:'jsx-text'});
  if(ts.isJsxAttribute(node)&&['title','placeholder','aria-label','alt','label','helperText'].includes(node.name.getText(ast))&&node.initializer&&ts.isStringLiteral(node.initializer)&&node.initializer.text.trim())labels.push({line:ast.getLineAndCharacterOfPosition(node.getStart()).line+1,kind:'jsx-attribute',attribute:node.name.getText(ast)});
  ts.forEachChild(node,visit);
 }
 visit(ast);if(labels.length||snapshotReads)findings.push({path,snapshotReads,hardcodedLabelLocations:labels});
}
const report={status:findings.some(file=>file.hardcodedLabelLocations.length)?'direct-jsx-gaps':'direct-jsx-covered',scope:'Direct JSX text and common label attributes; conditional/template-generated labels require additional semantic review.',snapshotReads:findings.reduce((n,f)=>n+f.snapshotReads,0),directLabelLocations:findings.reduce((n,f)=>n+f.hardcodedLabelLocations.length,0),files:findings};
writeFileSync('plan/frontend-live-gap-register.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({files:findings.length,snapshotReads:report.snapshotReads,directLabelLocations:report.directLabelLocations}));
