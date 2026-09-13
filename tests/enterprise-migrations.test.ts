import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyMigrationFiles, verifyAppliedMigrationHashes } from '../scripts/database/migration-files';

describe('enterprise migration history', () => {
 it('registers every schema SQL file and excludes synthetic hierarchy repairs', () => {
  const files = verifyMigrationFiles();
  expect(files).toContain('0019_runtime_policy_schema.sql');
  expect(files).not.toContain('0015_attendance_hierarchy_scope.sql');
 });
 it('rejects unjournaled files and changed applied SQL', async () => {
  const folder = mkdtempSync(join(tmpdir(),'nucleus-migration-test-'));
  try {
   mkdirSync(join(folder,'meta'));
   writeFileSync(join(folder,'meta/_journal.json'),JSON.stringify({entries:[{idx:0,when:1,tag:'0000_example'}]}));
   writeFileSync(join(folder,'0000_example.sql'),'select 1;');
   const hash = createHash('sha256').update('select 1;').digest('hex');
   await expect(verifyAppliedMigrationHashes([{hash,created_at:1}],folder)).resolves.toBeUndefined();
   writeFileSync(join(folder,'0000_example.sql'),'select 2;');
   await expect(verifyAppliedMigrationHashes([{hash,created_at:1}],folder)).rejects.toThrow('changed');
   writeFileSync(join(folder,'0001_orphan.sql'),'select 3;');
   expect(()=>verifyMigrationFiles(folder)).toThrow('do not match');
  } finally { rmSync(folder,{recursive:true,force:true}); }
 });
});
