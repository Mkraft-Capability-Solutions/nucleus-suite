import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// Helper to convert strings to Title Case
function toTitleCase(str) {
  if (!str) return str;
  // If all caps with special chars, handle gracefully
  const words = str.split(' ');
  return words
    .map((w) => {
      if (/^[A-Z0-9&/()–-]+$/.test(w) && w.length <= 4) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

// 1. Clean navigation.catalog.json
const navCatalogPath = join(root, 'src/data/ui/navigation.catalog.json');
const navCatalog = JSON.parse(readFileSync(navCatalogPath, 'utf8'));

const tagMapping = {
  // Map raw SCR codes to elegant functional badges
  'SCR-001': 'Master',
  'SCR-002': 'Master',
  'SCR-005': 'Security',
  'SCR-010': 'Core',
  'SCR-011': 'Master',
  'SCR-012': 'Master',
  'SCR-013': 'Hierarchy',
  'SCR-014': 'Organization',
  'SCR-060': 'Master',
  'SCR-061': 'Master',
  'SCR-064': 'Governance',
  'SCR-067': 'Master',
  'SCR-062': 'Master',
  'SCR-042': 'Matrix',
  'SCR-020': 'Master',
  'SCR-021': 'Policy',
  'SCR-022': 'Policy',
  'SCR-023': 'Master',
  'SCR-024': 'Roster',
  'SCR-025': 'Ledger',
  'SCR-026': 'Approval',
  'SCR-027': 'Policy',
  'SCR-030': 'Self Service',
  'SCR-031': 'Ledger',
  'SCR-032': 'Ledger',
  'SCR-090': 'Master',
  'SCR-091': 'Pipeline',
  'SCR-063': 'Policy',
  'SCR-065': 'Matrix',
  'SCR-066': 'Hierarchy',
  'SCR-050': 'Master',
  'SCR-051': 'Policy',
  'SCR-052': 'Statutory',
  'SCR-053': 'Arrears',
  'SCR-054': 'Accounting',
  'SCR-055': 'Banking',
  'SCR-056': 'Settlement',
  'SCR-102': 'Statutory',
  'SCR-103': 'Declaration',
  'SCR-080': 'Master',
  'SCR-040': 'Assessment',
  'SCR-095': 'Recruitment',
  'SCR-041': 'Goals',
  'SCR-110': 'Master',
  'SCR-111': 'Policy',
  'SCR-070': 'Vendor',
  'SCR-071': 'Master',
  'SCR-072': 'Billing',
  'SCR-073': 'Statutory',
  'SCR-100': 'Register',
  'SCR-101': 'Audit',
  'SCR-120': 'Analytics',
};

for (const domain of navCatalog.domains) {
  domain.label = toTitleCase(domain.label);
  for (const group of domain.groups) {
    group.heading = toTitleCase(group.heading);
    for (const item of group.items) {
      item.label = toTitleCase(item.label);
      if (item.tag && tagMapping[item.tag]) {
        item.tag = tagMapping[item.tag];
      } else if (item.tag && item.tag.startsWith('SCR-')) {
        item.tag = 'Standard';
      }
    }
  }
}

writeFileSync(navCatalogPath, JSON.stringify(navCatalog, null, 2) + '\n', 'utf8');
console.log('Polished navigation.catalog.json');

// 2. Clean interface.json
const interfacePath = join(root, 'src/data/locales/en/interface.json');
const interfaceData = JSON.parse(readFileSync(interfacePath, 'utf8'));
if (interfaceData.leave?.applyTitle) {
  interfaceData.leave.applyTitle = 'Apply for Leave';
}
writeFileSync(interfacePath, JSON.stringify(interfaceData, null, 2) + '\n', 'utf8');
console.log('Polished interface.json');

// 3. Clean locale leave.json files
const locales = ['en', 'es', 'fr', 'de', 'ja', 'ar', 'hi', 'ta', 'te', 'bn', 'mr'];
const leaveTitles = {
  en: 'Apply for Leave',
  es: 'Solicitar Permiso',
  fr: 'Demander un Congé',
  de: 'Urlaub Beantragen',
  ja: '休暇申請',
  ar: 'تقديم طلب إجازة',
  hi: 'अवकाश के लिए आवेदन करें',
  ta: 'விடுப்புக்கு விண்ணப்பிக்கவும்',
  te: 'సెలవు కోసం దరఖాస్తు చేసుకోండి',
  bn: 'ছুটির জন্য আবেদন করুন',
  mr: 'रजेसाठी अर्ज करा',
};

for (const loc of locales) {
  const locLeavePath = join(root, `src/locales/${loc}/leave.json`);
  try {
    const data = JSON.parse(readFileSync(locLeavePath, 'utf8'));
    data.applyTitle = leaveTitles[loc] || 'Apply for Leave';
    writeFileSync(locLeavePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error(`Error updating ${locLeavePath}:`, err);
  }
}
console.log('Polished all locale leave.json files');
