import { readdirSync, readFileSync } from 'node:fs';
/** Fail before connecting when SQL files and the authoritative journal disagree. */
export function verifyMigrationFiles(folder = './db/migrations') {
    const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, 'utf8')) as { entries: Array<{ idx: number; when: number; tag: string }> };
    const actual = readdirSync(folder).filter(name => name.endsWith('.sql')).sort();
    const expected = journal.entries.map(entry => `${entry.tag}.sql`);
    if (new Set(expected).size !== expected.length || actual.join('\n') !== [...expected].sort().join('\n')) throw new Error('Migration journal and SQL files do not match. Review missing or duplicate entries before migrating.');
    journal.entries.forEach((entry, index) => {
        if (entry.idx !== index || (index > 0 && entry.when <= journal.entries[index - 1].when)) throw new Error('Migration journal ordering is invalid.');
    });
    return expected;
}

/** Drizzle orders migrations by timestamp; also reject edits to applied SQL. */
export async function verifyAppliedMigrationHashes(
    rows: Array<{ hash: string; created_at: string | number }>,
    folder = './db/migrations',
) {
    const { createHash } = await import('node:crypto');
    const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, 'utf8')) as { entries: Array<{ when: number; tag: string }> };
    const expected = new Map(journal.entries.map(entry => [entry.when, createHash('sha256').update(readFileSync(`${folder}/${entry.tag}.sql`, 'utf8')).digest('hex')]));
    for (const row of rows) {
        if (expected.get(Number(row.created_at)) !== row.hash) throw new Error('An applied migration is missing or has changed. Restore immutable migration history before continuing.');
    }
}
