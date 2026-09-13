import { config } from 'dotenv';
import { environmentProblems, productionReadinessProblems } from '../src/lib/runtime-config';

const mode = process.env.NODE_ENV || 'production';
config({ path: [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'], quiet: true });
const production = process.argv.includes('--production');
const problems = production ? productionReadinessProblems() : environmentProblems();
if (problems.length) {
    console.error([...new Set(problems)].join('\n'));
    process.exitCode = 1;
} else {
    console.info('Supported environment settings are valid. No credentials were printed.');
    if (process.env.DEMO_AUTH_ENABLED !== 'true') console.info('Workspace UI is disabled. Backend API configuration does not enable the demo UI.');
    else console.info('Synthetic-data preview enabled. This is not customer-production readiness.');
}
