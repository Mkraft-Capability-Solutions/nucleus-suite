const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.md')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Basic replacements
      let newContent = content
        .replace(/GET \/api\/v1\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g, 'Server Action fetch()')
        .replace(/POST \/api\/v1\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g, 'Server Action submit()')
        .replace(/PUT \/api\/v1\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g, 'Server Action update()')
        .replace(/DELETE \/api\/v1\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g, 'Server Action delete()')
        .replace(/\/api\/v1\//g, 'src/app/actions/')
        .replace(/API Routes:/g, 'Server Actions:')
        .replace(/REST \/ JSON:API Gateway \(src\/app\/api\/v1\/\*\)/g, 'Next.js Server Actions (src/app/actions/*)')
        .replace(/Next\.js API routes \(`\/api\/v1\/\.\.\.`\)/g, 'Next.js Server Actions (`src/app/actions/...`)')
        .replace(/API routes/g, 'Server Actions');

      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'docs'));
