import fs from 'node:fs';
import path from 'node:path';
const root='src/components';
const findings=[];
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(/\.(css|js|tsx)$/.test(file)){
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/\bbackground(?:Color|-color)?\s*:\s*([^;\n}]+)/g)){
  const value=match[1].match(/^(['"])(.*?)\1/)?.[2] || match[1];if(!/#|rgba?\(|linear-gradient\(/.test(value)||value.includes('var('))continue;
  const line=source.slice(0,match.index).split('\n').length;
  const blocked=/(?:#(?:060d18|14263d|0e1d30|0d1b2b|081625|10222f|1b3444)\b|linear-gradient\([^;\n]*rgba\((?:14, 23, 38|10, 16, 28))/i.test(value);
  findings.push({file,line,value:value.slice(0,180),classification:blocked?'fixed-dark-surface':'review-semantic-art-or-paper'});
 }
}}}
visit(root);
const blocked=findings.filter(x=>x.classification==='fixed-dark-surface');
fs.writeFileSync('plan/theme-surface-inventory.json',JSON.stringify({scope:root,description:'Direct literal background inventory. Semantic status colors, charts, artwork and paper previews require contextual review; this does not replace browser checks.',blocked:blocked.length,findings},null,2)+'\n');
console.log(`${findings.length} literal backgrounds catalogued; ${blocked.length} known fixed-dark surface regressions.`);
if(blocked.length)process.exitCode=1;
