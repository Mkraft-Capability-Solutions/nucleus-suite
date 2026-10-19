/**
 * Export system enums translations into src/locales/{locale}/enums.json
 * and wire them into each locale index.ts so direct t('Full-time') or t('enums:Full-time')
 * works natively in all 11 languages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SEED_ENUMS } from './seed-system-enums.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../src/locales');

const LOCALES = ['en', 'hi', 'mr', 'ta', 'te', 'bn', 'es', 'fr', 'de', 'ja', 'ar'];

for (const loc of LOCALES) {
  const locDir = path.join(localesDir, loc);
  if (!fs.existsSync(locDir)) continue;

  const enumsData = {};

  for (const item of SEED_ENUMS) {
    const val = item.translations[loc] || item.translations['en'] || item.label;
    enumsData[item.code] = val;
    enumsData[`${item.category}.${item.code}`] = val;
    enumsData[item.label] = val;
  }

  const enumsFilePath = path.join(locDir, 'enums.json');
  fs.writeFileSync(enumsFilePath, JSON.stringify(enumsData, null, 2), 'utf-8');

  // Update index.ts for this locale to import enums
  const indexFile = path.join(locDir, 'index.ts');
  if (fs.existsSync(indexFile)) {
    let content = fs.readFileSync(indexFile, 'utf-8');
    if (!content.includes('enums.json')) {
      content = "import enums from './enums.json';\n" + content;
      content = content.replace(
        new RegExp(`export const ${loc} = \\{([\\s\\S]*?)\\};`),
        (match, p1) => {
          return `export const ${loc} = {${p1}  enums,\n};`;
        }
      );
      fs.writeFileSync(indexFile, content, 'utf-8');
    }
  }
}

console.log('Successfully exported system enums to all 11 locale directories and wired index.ts.');
