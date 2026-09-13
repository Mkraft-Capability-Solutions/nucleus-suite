// Retired: applying individual files bypasses migration ordering and history.
console.error('Use npm run db:migrate. VP schema migrations are now registered in the authoritative journal. Demo reporting-hierarchy repairs are separate from schema migrations.');
process.exitCode = 1;
