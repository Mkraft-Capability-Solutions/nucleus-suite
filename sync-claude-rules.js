const fs = require('fs');
const path = require('path');

function replaceInFile(fullPath, replacements) {
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let newContent = content;
    for (const {from, to} of replacements) {
      newContent = newContent.split(from).join(to);
    }
    if (newContent !== content) {
      fs.writeFileSync(fullPath, newContent, 'utf8');
      console.log("Updated " + fullPath);
    }
  }
}

// 1. data-boundary.md
replaceInFile(path.join(__dirname, '.claude', 'rules', 'data-boundary.md'), [
  { from: "const res = await fetch('/api/v1/employees');", to: "import { fetchEmployees } from '@/app/actions/peopleActions';\nconst res = await fetchEmployees();" }
]);

// 2. client-server-boundary.md
replaceInFile(path.join(__dirname, '.claude', 'rules', 'client-server-boundary.md'), [
  { from: "│            Next.js App Router API Routes (/api/v1/*)        │", to: "│            Next.js Server Actions (src/app/actions/*)        │" },
  { from: "- **`src/app/api/v1/`**: REST gateway connecting client forms to `src/server/`.", to: "- **`src/app/actions/`**: Server Actions connecting client forms to `src/server/`." }
]);

// 3. implement-statutory-report.md
replaceInFile(path.join(__dirname, '.claude', 'skills', 'implement-statutory-report.md'), [
  { from: "1. In `src/app/api/v1/exports/route.ts`, support CSV, PDF, and Excel formatting:", to: "1. In `src/app/actions/complianceActions.ts`, support CSV, PDF, and Excel formatting via Server Actions:" }
]);

// 4. Update the JSON registry
const jsonPath = path.join(__dirname, 'src', 'config', 'ui', 'lib.operational-module-registry.json');
if (fs.existsSync(jsonPath)) {
  let jsonContent = fs.readFileSync(jsonPath, 'utf8');
  // replace "endpoint": "/api/v1/organization/entities"
  // with "serverAction": "organizationActions.ts"
  
  // Custom replacements to map domains to actions
  const mappings = [
    { regex: /"endpoint": "\/api\/v1\/organization\/[^"]+"/g, action: '"serverAction": "organizationActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/identity\/[^"]+"/g, action: '"serverAction": "identityActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/people[^"]*"/g, action: '"serverAction": "peopleActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/ops\/modules\/[^"]+"/g, action: '"serverAction": "opsActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/ot-requests"/g, action: '"serverAction": "attendanceActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/regularizations"/g, action: '"serverAction": "attendanceActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/reports\/[^"]+"/g, action: '"serverAction": "reportsActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/announcements"/g, action: '"serverAction": "communicationActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/webhooks\/[^"]+"/g, action: '"serverAction": "webhookActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/notifications"/g, action: '"serverAction": "notificationActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/onboarding\/[^"]+"/g, action: '"serverAction": "onboardingActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/assets"/g, action: '"serverAction": "assetActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/recognition-events"/g, action: '"serverAction": "recognitionActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/hr-letters"/g, action: '"serverAction": "letterActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/loans"/g, action: '"serverAction": "loanActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/requisitions"/g, action: '"serverAction": "recruitmentActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/referrals"/g, action: '"serverAction": "recruitmentActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/contractors\/[^"]+"/g, action: '"serverAction": "contractorActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/integrations\/[^"]+"/g, action: '"serverAction": "integrationActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/ai\/[^"]+"/g, action: '"serverAction": "aiActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/analytics\/[^"]+"/g, action: '"serverAction": "analyticsActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/attendance\/[^"]+"/g, action: '"serverAction": "attendanceActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/gate-passes"/g, action: '"serverAction": "attendanceActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/leave-requests"/g, action: '"serverAction": "leaveActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/leave-balances"/g, action: '"serverAction": "leaveActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/payroll-runs"/g, action: '"serverAction": "payrollActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/payroll-anomalies"/g, action: '"serverAction": "payrollActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/wage-simulations"/g, action: '"serverAction": "complianceActions.ts"' },
    { regex: /"endpoint": "\/api\/v1\/[^"]+"/g, action: '"serverAction": "genericActions.ts"' } // catchall
  ];

  let newJsonContent = jsonContent;
  for (const mapping of mappings) {
    newJsonContent = newJsonContent.replace(mapping.regex, mapping.action);
  }

  if (newJsonContent !== jsonContent) {
    fs.writeFileSync(jsonPath, newJsonContent, 'utf8');
    console.log("Updated JSON registry: " + jsonPath);
  }
}
