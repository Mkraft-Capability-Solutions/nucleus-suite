import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const envPath = '.env.enterprise.local';
if (existsSync(envPath)) throw new Error('An enterprise environment already exists; refusing to replace its database.');
const directory = mkdtempSync(join(tmpdir(), 'nucleus-enterprise-pg-'));
const passwordFile = join(directory, 'owner-password');
const ownerPassword = randomBytes(32).toString('hex');
writeFileSync(passwordFile, ownerPassword, { mode: 0o600 });
try {
 execFileSync('initdb', ['-D', join(directory, 'data'), '-U', 'nucleus_owner', '--pwfile', passwordFile, '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--encoding=UTF8', '--no-locale'], { stdio: 'pipe' });
 execFileSync('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55432', '-w', 'start'], { stdio: 'pipe' });
 execFileSync('createdb', ['-h', '127.0.0.1', '-p', '55432', '-U', 'nucleus_owner', 'nucleus_enterprise'], { env: { ...process.env, PGPASSWORD: ownerPassword }, stdio: 'pipe' });
 const url = `postgresql://nucleus_owner:${ownerPassword}@127.0.0.1:55432/nucleus_enterprise`;
 writeFileSync(envPath, `# Isolated development migration environment; never deploy or commit.\nMIGRATION_DATABASE_URL=${url}\nMIGRATION_DATABASE_DRIVER=postgres\nBETTER_AUTH_URL=http://localhost:3200\nBETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\nNUCLEUS_LOCAL_PGDATA=${join(directory, 'data')}\n`, { mode: 0o600 });
 console.log('Created isolated PostgreSQL on 127.0.0.1:55432. Owner credentials are only in the ignored .env.enterprise.local file.');
} finally { unlinkSync(passwordFile); }
