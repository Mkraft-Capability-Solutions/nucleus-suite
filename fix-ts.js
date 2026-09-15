const fs = require('fs');

// 1. fix gate-passes
let gp = fs.readFileSync('src/app/api/v1/gate-passes/route.ts', 'utf8');
gp = gp.replace('passType: body.passType,', '');
gp = gp.replace('validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),', 'outTime: body.validFrom ? new Date(body.validFrom) : new Date(),');
gp = gp.replace('validUntil: body.validUntil ? new Date(body.validUntil) : null,', 'expectedInTime: body.validUntil ? new Date(body.validUntil) : null,');
fs.writeFileSync('src/app/api/v1/gate-passes/route.ts', gp);

// 2. fix records/[id]/route.ts
let rid = fs.readFileSync('src/app/api/v1/ops/modules/[moduleId]/records/[id]/route.ts', 'utf8');
rid = rid.replace('parseResult.error.errors', 'parseResult.error.issues');
fs.writeFileSync('src/app/api/v1/ops/modules/[moduleId]/records/[id]/route.ts', rid);

// 3. fix records/route.ts
let rr = fs.readFileSync('src/app/api/v1/ops/modules/[moduleId]/records/route.ts', 'utf8');
rr = rr.replace('parseResult.error.errors', 'parseResult.error.issues');
fs.writeFileSync('src/app/api/v1/ops/modules/[moduleId]/records/route.ts', rr);

// 4. fix DynamicFormEngine.tsx
let dfe = fs.readFileSync('src/core/form-engine/DynamicFormEngine.tsx', 'utf8');
dfe = dfe.replace('(result.error as z.ZodError).errors', '(result.error as z.ZodError).issues');
fs.writeFileSync('src/core/form-engine/DynamicFormEngine.tsx', dfe);
