import ts from 'typescript';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const dictionaryPath='src/data/locales/en/interface.json';
const dictionary=JSON.parse(readFileSync(dictionaryPath,'utf8'));
const files=execFileSync('rg',['--files','src/components','src/app'],{encoding:'utf8'}).trim().split('\n').filter(file=>/\.[jt]sx?$/.test(file));
const report=[];
const decode=text=>text.replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'}[key])).replace(/&#(x[\da-f]+|\d+);/gi,(_,code)=>String.fromCodePoint(code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code)));
for(const file of files){
 const source=readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const client=/^[\s]*["']use client["']/.test(source);
 const namespace=file.replace(/^src\//,'').replace(/\.[jt]sx?$/,'').replaceAll('/','.');
 const edits=[],functions=new Set();
 function visit(node){
  let value,attribute=false,expression=false,params=[];
  if(ts.isJsxText(node)&&node.text.trim()) {
   const rows=node.text.split(/\r?\n/);value=rows.map((line,index)=>{let text=line.replaceAll('\t',' ');if(index>0)text=text.trimStart();if(index<rows.length-1)text=text.trimEnd();return text;}).filter(Boolean).join(' ');
  }
  if(ts.isJsxAttribute(node)&&['title','placeholder','aria-label','alt','label','helperText'].includes(node.name.getText(ast))&&node.initializer&&ts.isStringLiteral(node.initializer)&&node.initializer.text.trim()){value=node.initializer.text;attribute=true;}
  const literal=ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateExpression(node);
  if(literal){
   let ancestor=node.parent,jsx=false,attributeName;
   while(ancestor){if(ts.isJsxExpression(ancestor))jsx=true;if(ts.isJsxAttribute(ancestor)){attributeName=ancestor.name.getText(ast);break;}if(ts.isJsxElement(ancestor))break;ancestor=ancestor.parent;}
   const p=node.parent;
   const rendered=jsx&&(!attributeName||['title','placeholder','aria-label','alt','label','helperText'].includes(attributeName))&&(ts.isJsxExpression(p)||ts.isConditionalExpression(p));
   const notification=ts.isCallExpression(p)&&['showToast','setError','setNotice'].includes(p.expression.getText(ast))&&p.arguments.indexOf(node)<(p.expression.getText(ast)==='showToast'?2:1);
   if(rendered||notification){
    expression=true;
    if(ts.isTemplateExpression(node)){
     value=node.head.text;
     node.templateSpans.forEach((span,index)=>{const key='value'+(index+1);value+='{'+key+'}'+span.literal.text;params.push(key+': String('+span.expression.getText(ast)+')');});
    }else value=node.text;
    if(!/[A-Za-z]/.test(value))value=undefined;
   }
  }
  if(value){
   let parent=node,owner;
   while(parent.parent){parent=parent.parent;if(ts.isFunctionLike(parent))owner=parent;}
   if(client&&(!owner?.body||!ts.isBlock(owner.body)))throw new Error(`Manual hook placement required: ${file}:${ast.getLineAndCharacterOfPosition(node.getStart()).line+1}`);
   const key='text_'+createHash('sha256').update(value).digest('hex').slice(0,10);
   dictionary[namespace]??={};dictionary[namespace][key]=decode(value);
   const target=attribute?node.initializer:node;
   edits.push({start:attribute?target.getStart(ast):target.pos,end:target.end,text:(expression?'':'{')+`translateText(${JSON.stringify(namespace)},${JSON.stringify(key)}${params.length?', {'+params.join(', ')+'}':''})`+(expression?'':'}')});
   if(client)functions.add(owner);
   report.push({file,namespace,key,kind:expression?'expression':'direct',line:ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1});
  }
  if(!value||!expression)ts.forEachChild(node,visit);
 }
 visit(ast);
 if(edits.length){
  for(const owner of functions){
   const body=owner.body;
   if(!/\b(?:const|let)\s*\{\s*t(?:\s*:\s*translateText)?\s*\}\s*=\s*useTranslation/.test(body.getText(ast)))edits.push({start:body.getStart(ast)+1,end:body.getStart(ast)+1,text:'\n    const {t: translateText}=useTranslation();\n'});
  }
  let output=source;
  for(const edit of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);
  const importLine=client?"import {useTranslation} from '@/context/I18nContext';\n":"import {t as translateText} from '@/lib/i18n';\n";
  if(!source.includes(client?"from '@/context/I18nContext'":"from '@/lib/i18n'")){
   if(client){const end=ast.statements[0].end;output=output.slice(0,end)+'\n'+importLine+output.slice(end);}else output=importLine+output;
  }
  writeFileSync(file,output);
 }
}
writeFileSync(dictionaryPath,JSON.stringify(dictionary,null,2)+'\n');
writeFileSync('plan/interface-expression-extraction.json',JSON.stringify({status:'interface-copy-extracted',scope:'Direct text and label attributes. Conditional strings, notifications, business records and CSS need separate semantic review.',entries:report},null,2)+'\n');
console.log(`Extracted ${report.length} labels into the English message catalog.`);
