const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
  { from: '@/lib/legacy-stubs/workspace-data.mjs', to: '@/lib/static-dictionary' },
  { from: '@/lib/legacy-stubs/workspace-data', to: '@/lib/static-dictionary' },
  { from: '@/lib/legacy-stubs/auth-service.mjs', to: '@/app/actions/authActions' },
  { from: '@/lib/legacy-stubs/auth-service', to: '@/app/actions/authActions' },
  { from: '@/lib/legacy-stubs/leaveEngine.js', to: '@/app/actions/leaveActions' },
  { from: '@/lib/legacy-stubs/leaveEngine', to: '@/app/actions/leaveActions' },
  { from: '@/lib/legacy-stubs/leave-workflow.ts', to: '@/app/actions/leaveActions' },
  { from: '@/lib/legacy-stubs/leave-workflow', to: '@/app/actions/leaveActions' },
  { from: '@/lib/legacy-stubs/leave-reference.ts', to: '@/app/actions/leaveActions' },
  { from: '@/lib/legacy-stubs/leave-reference', to: '@/app/actions/leaveActions' },
  { from: '@/lib/legacy-stubs/module-service.mjs', to: '@/app/actions/moduleActions' },
  { from: '@/lib/legacy-stubs/module-service', to: '@/app/actions/moduleActions' },
  { from: '@/lib/legacy-stubs/assistant-service.mjs', to: '@/app/actions/assistantActions' },
  { from: '@/lib/legacy-stubs/assistant-service', to: '@/app/actions/assistantActions' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      for (const rule of replacements) {
        if (content.includes(rule.from)) {
          content = content.split(rule.from).join(rule.to);
          changed = true;
        }
      }
      
      // Catch-all
      if (content.includes('@/lib/legacy-stubs/')) {
        content = content.replace(/@\/lib\/legacy-stubs\/[a-zA-Z0-9_-]+(\.mjs|\.js|\.ts)?/g, '@/lib/static-dictionary');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Refactored imports in ${fullPath.replace(__dirname, '')}`);
      }
    }
  }
}

console.log('🔍 Refactoring imports to use Server Actions...');
processDirectory(path.join(srcDir, 'components'));
processDirectory(path.join(srcDir, 'app'));
processDirectory(path.join(srcDir, 'context'));
processDirectory(path.join(srcDir, 'lib'));

// Delete legacy-stubs folder
const stubsDir = path.join(srcDir, 'lib', 'legacy-stubs');
if (fs.existsSync(stubsDir)) {
  fs.rmSync(stubsDir, { recursive: true, force: true });
  console.log('🗑️ Deleted src/lib/legacy-stubs directory.');
}

console.log('✨ Refactoring complete!');
