import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const publicSitePath = path.resolve(__dirname, '../src/config/public-site.json');
const rawPublicSite = JSON.parse(fs.readFileSync(publicSitePath, 'utf8'));

// Import public translations
import('../src/locales/translations.js').catch(() => {});

// Read translations.ts content directly to extract translation maps safely
const translationsContent = fs.readFileSync(path.resolve(__dirname, '../src/locales/translations.ts'), 'utf8');

const supportedLocales = ['en', 'hi', 'mr', 'ta', 'te', 'bn', 'es', 'fr', 'de', 'ja', 'ar'];

// Extract translation dictionary for each language
function extractDict(langCode) {
  if (langCode === 'en') return {};
  const regex = new RegExp(`\\b${langCode}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?\\n\\s*(?:[a-z]{2}:|\\};)`, 'm');
  const match = translationsContent.match(regex);
  if (!match) return {};
  const block = match[1];
  const dict = {};
  const lineRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let lineMatch;
  while ((lineMatch = lineRegex.exec(block)) !== null) {
    dict[lineMatch[1]] = lineMatch[2];
  }
  return dict;
}

const dictionaries = {};
for (const loc of supportedLocales) {
  dictionaries[loc] = extractDict(loc);
}

function localizeValue(val, dict) {
  if (typeof val === 'string') {
    return dict[val] || val;
  }
  if (Array.isArray(val)) {
    return val.map(item => localizeValue(item, dict));
  }
  if (val && typeof val === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === 'href' || k === 'icon') {
        res[k] = v;
      } else {
        res[k] = localizeValue(v, dict);
      }
    }
    return res;
  }
  return val;
}

for (const loc of supportedLocales) {
  const dict = dictionaries[loc];
  const localizedContent = localizeValue(rawPublicSite, dict);
  const targetFile = path.join(LOCALES_DIR, loc, 'public.json');
  fs.writeFileSync(targetFile, JSON.stringify(localizedContent, null, 2) + '\n', 'utf8');
  console.log(`Generated ${targetFile}`);
}

console.log('All 11 public.json locale files generated successfully.');
