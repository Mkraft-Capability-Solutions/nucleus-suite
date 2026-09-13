import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// Classification is intentionally conservative: record names, role grants and IDs
// must not become public translation content merely because they are strings.
export function localizationInventory(directory = 'src/data/ui') {
 const inventory = [];
 for (const name of readdirSync(directory).filter(name => name.endsWith('.json')).sort()) {
  const namespace = name.slice(0,-5), sourceFile = `${directory}/${name}`;
  function walk(value, pointer = '', depth = 0) {
   if (typeof value === 'string') {
    const key = pointer.slice(1);
    const candidate = depth === 1 && namespace.startsWith('components.') && /_(text|title|placeholder|aria-label|alt)_\d+$/.test(key);
    inventory.push({ namespace, key, sourceFile, sourcePointer: pointer, sourceHash: createHash('sha256').update(value).digest('hex'), classification: candidate ? 'label-candidate' : 'requires-classification' });
   } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walk(child, `${pointer}/${key.replace(/~/g,'~0').replace(/\//g,'~1')}`, depth + 1);
   }
  }
  walk(JSON.parse(readFileSync(sourceFile, 'utf8')));
 }
 return inventory;
}
const inventory = localizationInventory();
writeFileSync('plan/localization-inventory.json', JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify({stringValues:inventory.length,labelCandidates:inventory.filter(item=>item.classification==='label-candidate').length,requiresClassification:inventory.filter(item=>item.classification==='requires-classification').length}));
