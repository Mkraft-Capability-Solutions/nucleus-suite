import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const supportedLocales = ['en', 'hi', 'mr', 'ta', 'te', 'bn', 'es', 'fr', 'de', 'ja', 'ar'];

for (const loc of supportedLocales) {
  const indexPath = path.join(LOCALES_DIR, loc, 'index.ts');
  const code = `import assistant from './assistant.json';
import publicContent from './public.json';
import errors from './errors.json';
import enums from './enums.json';
import common from './common.json';
import auth from './auth.json';
import leave from './leave.json';
import attendance from './attendance.json';
import payroll from './payroll.json';
import people from './people.json';
import navigation from './navigation.json';
import validation from './validation.json';

export const ${loc} = {
  common,
  auth,
  leave,
  attendance,
  payroll,
  people,
  navigation,
  validation,
  enums,
  errors,
  assistant,
  publicContent,
};

export default ${loc};
`;
  fs.writeFileSync(indexPath, code, 'utf8');
  console.log(`Updated ${indexPath}`);
}
console.log('All 11 locale index.ts files updated with assistant and publicContent.');
