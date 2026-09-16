/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS build tool. */
/* Generate form contracts from route validators without importing server/database code. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function source(file) {
  if (cache.has(file)) return cache.get(file);
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const symbols = new Map();
  function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) symbols.set(n.name.text, n.initializer);
    if (ts.isFunctionDeclaration(n) && n.name) symbols.set(n.name.text, n);
    ts.forEachChild(n, visit);
  }
  visit(ast);
  const imports = new Map();
  for (const s of ast.statements) if (ts.isImportDeclaration(s) && s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings)) {
    const spec = s.moduleSpecifier.text;
    const target = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
    if (target) for (const e of s.importClause.namedBindings.elements) imports.set(e.name.text, [target + '.ts', e.propertyName?.text || e.name.text]);
  }
  const result = { ast, symbols, imports, file }; cache.set(file, result); return result;
}
function resolve(name, ctx) {
  if (ctx.symbols.has(name)) return [ctx.symbols.get(name), ctx];
  const imp = ctx.imports.get(name);
  if (imp && fs.existsSync(imp[0])) return resolve(imp[1], source(imp[0]));
  return null;
}
function literal(n) {
  if (!n) return undefined;
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return ts.isNumericLiteral(n) ? Number(n.text) : n.text;
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (n.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
  if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText().replace(/['"]/g, ''), literal(p.initializer)]));
  return undefined;
}
/**
 * Values of the picklist registry, read straight from src/lib/picklists.ts.
 *
 * A route that writes `z.enum(picklistValues("PL_X"))` states which workbook vocabulary it
 * accepts. Resolving the call here means the generated form contract carries the real value
 * set and the picklist code, so the renderer can print the workbook's labels rather than a
 * humanised slug, and a vocabulary is never transcribed twice.
 */
let picklistCache = null;
function picklistRegistry() {
  if (picklistCache) return picklistCache;
  picklistCache = new Map();
  const file = path.join(root, 'src/lib/picklists.ts');
  if (!fs.existsSync(file)) return picklistCache;
  const ctx = source(file);
  let node = ctx.symbols.get('picklists');
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  if (node && ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const entry = literal(prop.initializer);
      if (entry && Array.isArray(entry.values)) picklistCache.set(prop.name.getText(ctx.ast).replace(/['"]/g, ''), entry.values.map(v => v.value));
    }
  }
  return picklistCache;
}
/** The picklist code of a `picklistValues("PL_X")` call, or null for any other expression. */
function picklistCodeOf(n) {
  if (!n || !ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== 'picklistValues') return null;
  const arg = n.arguments[0];
  return arg && ts.isStringLiteral(arg) ? arg.text : null;
}
function schema(n, ctx, depth = 0) {
  if (!n || depth > 30) return { kind: 'unknown' };
  if (ts.isIdentifier(n)) { const found = resolve(n.text, ctx); return found ? schema(...found, depth + 1) : { kind: 'unknown' }; }
  if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return { kind: 'unknown' };
  const method = n.expression.name.text, base = n.expression.expression, args = n.arguments;
  // zod 4 moved the ISO string formats onto `z.iso`, so `z.iso.date()` is a dated text field.
  // Without this the field resolves to `unknown` and the renderer draws a variant picker
  // instead of a date control.
  if (base.getText(ctx.ast) === 'z.iso') {
    const format = method === 'datetime' ? 'datetime' : method === 'time' ? undefined : 'date';
    return format ? { kind: 'text', format } : { kind: 'text' };
  }
  if (base.getText(ctx.ast) === 'z' || base.getText(ctx.ast) === 'z.coerce') {
    if (method === 'object') {
      const props = args[0];
      return { kind: 'object', fields: props && ts.isObjectLiteralExpression(props) ? props.properties.filter(ts.isPropertyAssignment).map(p => ({ name: p.name.getText(ctx.ast).replace(/['"]/g, ''), ...schema(p.initializer, ctx, depth + 1) })) : [] };
    }
    if (method === 'array') return { kind: 'array', item: schema(args[0], ctx, depth + 1) };
    if (method === 'enum') {
      const picklist = picklistCodeOf(args[0]);
      if (picklist) {
        const values = picklistRegistry().get(picklist);
        if (!values) throw new Error(`z.enum(picklistValues("${picklist}")) refers to a picklist that src/lib/picklists.ts does not define.`);
        return { kind: 'select', options: values, picklist };
      }
      return { kind: 'select', options: literal(args[0]) };
    }
    if (method === 'literal') return { kind: 'select', options: [literal(args[0])], default: literal(args[0]) };
    if (method === 'record') return { kind: 'record', item: schema(args[1] || args[0], ctx, depth + 1) };
    if (method === 'union' || method === 'discriminatedUnion') {
      const list = args[method === 'union' ? 0 : 1];
      const variants = list && ts.isArrayLiteralExpression(list) ? list.elements.map(e => schema(e, ctx, depth + 1)) : [];
      if (variants.every(v => v.kind === 'select')) return { kind: 'select', options: variants.flatMap(v => v.options) };
      return { kind: 'union', variants };
    }
    return { kind: method === 'string' ? 'text' : method };
  }
  const result = schema(base, ctx, depth + 1);
  if (method === 'optional' || method === 'nullable' || method === 'nullish') result.optional = true;
  if (method === 'default') { result.default = literal(args[0]); result.optional = true; }
  if (method === 'min' || method === 'max') result[method] = literal(args[0]);
  if (method === 'positive') result.min = result.kind === 'number' && !result.integer ? 0.01 : 1;
  if (method === 'nonnegative') result.min = 0;
  if (method === 'int') result.integer = true;
  if (['uuid', 'email', 'datetime', 'url'].includes(method)) result.format = method;
  if (method === 'regex' && args[0]?.getText(ctx.ast).includes('d{4}')) result.format = args[0].getText(ctx.ast).includes('d{2}\\/') ? 'date' : (args[0].getText(ctx.ast).match(/d\{2\}/g)?.length === 1 ? 'month' : 'date');
  if (method === 'partial') result.fields?.forEach(f => { f.optional = true; });
  return result;
}
/**
 * Permission keys a function requires *unconditionally*.
 *
 * Two things make this structural rather than a text scan. Services name their keys as
 * constants and pick between them with a ternary, so the literal is not in the call; and
 * an `enforce` nested inside an `if` is not a requirement but a branch — payslips are
 * deliberately self-service, and reading the check inside `if (scope === "all")` as
 * mandatory would hide every employee's own payslip from them. Only statements reachable
 * without taking a branch are read, descending through `try` because every route handler
 * wraps its work in one.
 */
function requiredPermissions(node, ctx, depth, seen) {
  const found = new Set();
  const declaring = ctx.ast.getFullText();
  const constants = new Map();
  for (const m of declaring.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*"([^"]+)"/g)) constants.set(m[1], m[2]);

  const readCalls = (text) => {
    for (const call of text.matchAll(/enforce\(access\.context,\s*([\s\S]*?),\s*\{/g)) {
      // A ternary picks the key from a condition that may itself quote a string: only the
      // branches after the `?` are permissions, never the test that chooses between them.
      const argument = call[1].includes("?") ? call[1].slice(call[1].indexOf("?") + 1) : call[1];
      for (const lit of argument.matchAll(/"([^"]+)"/g)) found.add(lit[1]);
      for (const id of argument.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
        const value = constants.get(id[1]);
        if (value) found.add(value);
      }
    }
    // `operationalScope(access, X, "verb")` enforces `X.verb`; it is how every
    // catalog-backed resource states its permission.
    for (const call of text.matchAll(/operationalScope\(access,\s*([^,]+),\s*"(read|write|approve)"\)/g)) {
      const expression = call[1].trim();
      const base = /^"[^"]+"$/.test(expression) ? expression.slice(1, -1) : constants.get(expression);
      if (base) found.add(base + "." + call[2]);
    }
  };

  const follow = (statement) => {
    if (depth <= 0) return;
    const visitCalls = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const key = ctx.ast.fileName + ":" + n.expression.text;
        if (!seen.has(key)) {
          seen.add(key);
          const target = resolve(n.expression.text, ctx);
          if (target && target[0]) {
            for (const permission of requiredPermissions(target[0], target[1], depth - 1, seen)) found.add(permission);
          }
        }
      }
      ts.forEachChild(n, visitCalls);
    };
    visitCalls(statement);
  };

  const walkStatements = (block) => {
    for (const statement of block.statements ?? []) {
      if (ts.isTryStatement(statement)) { walkStatements(statement.tryBlock); continue; }
      if (ts.isBlock(statement)) { walkStatements(statement); continue; }
      // Anything that branches is skipped: its checks apply to one path, not to the call.
      if (ts.isIfStatement(statement) || ts.isSwitchStatement(statement)) continue;
      readCalls(statement.getText(ctx.ast));
      follow(statement);
    }
  };

  const body = node.body ?? node;
  if (body && body.statements) walkStatements(body);
  else if (body) { readCalls(body.getText(ctx.ast)); follow(body); }
  return found;
}

function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
const modules = {
  assets: ["assets"],
  statutory: ["statutory-register"],
  settlements: ["settlement-proposals", "settlement-workings"],
  accounting: ["gl-accounts", "gl-mappings", "payroll-accounting"],
  people: ['people', 'documents', "letters", "employee-assignments"], organization: ['organization', "establishment", "mobility-register"], onboarding: ['onboarding', 'offboarding', "lifecycle"], engagement: ['announcements', 'recognition-events', 'surveys', 'survey-responses', 'survey-runs', "announcement-register", "recognition-register", "social-feed", "engagement"],
  attendance: ['attendance', 'regularizations', 'shift-swaps', 'gate-passes', "overtime"], leave: ['leave-requests', 'leave-balances', 'coff-grants', "leave", "leave-policies"], payroll: ['payroll-runs', 'payroll-inputs', 'payroll-anomalies', 'payslips', 'wage-simulations', "payroll", "disbursements", "tax-projections", "reconciliations", "earned-wage-access"], loans: ['loans', 'salary-advances'],
  performance: ['objectives', 'key-results', 'checkins', 'review-cycles', 'review-participants', 'review-responses', 'feedback', 'calibration-sessions', 'succession-plans', "okr-tree", "manager-coaching-notes"], talent: ['requisitions', 'job-descriptions', 'job-postings', 'candidates', 'applications', 'interview-plans', 'interview-sessions', 'interview-scores', 'offers', 'referrals', "talent-pipeline", "talent-placements", "referral-tracking", "requisition-register"], learning: ['courses', 'learning-paths', 'enrollments', 'employee-skills', 'skill-evidence', "learning-progress", "my-learning"], compensation: ['compensation', 'benefits', "reimbursement-claims"], insights: ['analytics', 'reports', 'exports', "cockpits"], compliance: ['compliance', 'privacy', "policy-acknowledgements"], integrations: ['integrations', 'fx', 'webhooks'], settings: ['tenant', 'roles', 'memberships', 'invitations', 'delegations', 'ops', "access-scopes", "plant-scope"], inbox: ['notifications'], assistant: ['ai'], contractors: ['contractors'],
};
const ignored = ['platform', 'identity', 'auth', 'workspace', 'search', 'vp', 'home', 'operations', 'dossier', 'commands', 'dossier-lookups'];
const catalog = [], omitted = [];
for (const file of walk(path.join(root, 'src/app/api/v1')).filter(f => f.endsWith('route.ts'))) {
  const route = '/api/v1/' + path.relative(path.join(root, 'src/app/api/v1'), path.dirname(file)).replaceAll('\\', '/');
  const prefix = route.split('/')[3];
  if (ignored.includes(prefix) || !prefix || route.startsWith('/api/v1/webhooks/inbound')) continue;
  const moduleId = Object.entries(modules).find(([, prefixes]) => prefixes.includes(prefix))?.[0];
  if (!moduleId) { omitted.push(route); continue; }
  const ctx = source(file);
  for (const statement of ctx.ast.statements) {
    if (!ts.isFunctionDeclaration(statement) || !['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(statement.name?.text)) continue;
    const method = statement.name.text, text = statement.getText(ctx.ast);
    if (text.includes('formData(')) { omitted.push(`${method} ${route} (file upload)`); continue; }
    let body = { kind: 'object', fields: [] }, schemaName = '', permissions = new Set(), queries = new Set();
    function inspect(n) {
      if (ts.isCallExpression(n)) {
        if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'safeParse' && method !== 'GET') { body = schema(n.expression.expression, ctx); schemaName = n.expression.expression.getText(ctx.ast); }
        if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'get' && /params|searchParams/i.test(n.expression.expression.getText(ctx.ast)) && ts.isStringLiteral(n.arguments[0])) queries.add(n.arguments[0].text);
        if (ts.isIdentifier(n.expression)) {
          const found = resolve(n.expression.text, ctx);
          if (found && ts.isFunctionDeclaration(found[0])) {
            for (const permission of requiredPermissions(found[0], found[1], 2, new Set())) permissions.add(permission);
          }
        }
      }
      ts.forEachChild(n, inspect);
    }
    inspect(statement);
    const resource = text.match(/workflowRecords\(access,\s*"([^"]+)"/)?.[1];
    if (resource) for (const permission of require('../src/server/workflows/resources.json')[resource].slice(1)) permissions.add(permission);
    for (const permission of requiredPermissions(statement, ctx, 0, new Set())) permissions.add(permission);
    if (['onboarding/tasks', 'offboarding/items'].includes(resource)) queries.add('parentId');
    const segments = route.slice(8).split('/[')[0].split('/');
    const section = segments.filter(s => !s.startsWith('[')).slice(0, ['organization','onboarding','offboarding','compensation','benefits','compliance','integrations','ops','privacy','analytics','contractors','attendance','ai','notifications','tenant','feedback','webhooks','cockpits','engagement','lifecycle','leave','leave-policies','payroll','assets','letters','overtime','access-scopes'].includes(prefix) ? 2 : 1).join('/');
    catalog.push({ id: method + ' ' + route, module: moduleId, section, path: route, method, label: schemaName && !['bodySchema', 'schema'].includes(schemaName) ? schemaName.replace(/Schema$/, '').replace(/([a-z])([A-Z])/g, '$1 $2') : undefined, body, permissions: [...permissions], query: [...queries], version: text.includes('requireVersion('), source: path.relative(root, file).replaceAll('\\', '/') });
  }
}
fs.writeFileSync(path.join(root, 'src/lib/workflow-catalog.generated.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(JSON.stringify({ operations: catalog.length, sections: new Set(catalog.map(c => c.module + ':' + c.section)).size, omitted, unknown: catalog.filter(c => JSON.stringify(c.body).includes('"unknown"')).map(c => c.id) }, null, 2));

// Dedicated command permissions are separate from employee editing.
const commandMap = {
 save_rule_set:['settings','policy.manage'], grant_location:['settings','role.scope.manage'],
 evaluate_attendance:['attendance','attendance.evaluate'], run_leave_maintenance:['leave','leave.maintain'],
 sync_erp_employee:['integrations','integration.sync'], retry_erp_record:['integrations','integration.sync'], abandon_erp_record:['integrations','integration.sync'],
 create_gl_posting:['accounting','payroll.accounting.write'],
 ack_gl_posting:['accounting','payroll.accounting.write'], generate_statutory_form:['statutory','compliance.forms.generate'],
 record_feature:['onboarding','hr.records.write'], approve_manpower:['organization','workforce.manpower.approve'],
 controlled_requisition:['talent','recruitment.requisition.write']
};
const commandSchema = schema(...resolve('vpCommandSchema',source(path.join(root,'src/server/vp/service.ts'))));
const commandCatalog=(commandSchema.variants||[]).map(body=>{
 const action=body.fields.find(f=>f.name==='action').options[0];
 const mapping=commandMap[action];
 if(!mapping) throw new Error(`Command "${action}" is in vpCommandSchema but not in commandMap in this file. Add its module and permission, keeping it in step with src/lib/command-permissions.ts.`);
 const [moduleId,permission]=mapping;
 const route='/api/v1/commands/'+action;
 return {id:'POST '+route,module:moduleId,section:'commands/'+action,path:route,method:'POST',label:action.replaceAll('_',' '),body:{...body,fields:body.fields.filter(f=>f.name!=='action')},permissions:[permission],query:[],version:false,source:'src/app/api/v1/commands/[action]/route.ts'};
});
fs.writeFileSync(path.join(root,'src/lib/command-catalog.generated.json'),JSON.stringify(commandCatalog,null,2)+'\n');
