# Multi-Tenant Database & Transaction Persistence Rules

> **Scope:** Data Layer, Multi-Tenancy & Neon PostgreSQL  
> **Source:** Repository Engineering Standards & `src/server/platform/`

---

## 1. Active Database Engine

- **Engine**: Neon Serverless PostgreSQL with Connection Pooling
- **Tables**: 330+ enterprise tables tracked via Drizzle migrations in `db/migrations/`.
- **Zero Uncommitted DDL**: Schema modifications must always be applied via versioned Drizzle migrations.

---

## 2. Mandatory Tenant Isolation (`tenantTx`)

Every database operation executed in `src/server/` must be wrapped in a tenant transaction:

```typescript
import { tenantTx } from "@/server/platform/access";

export async function createRecord(access: Access, input: InputData) {
  return await tenantTx(access, async (tx) => {
    // All queries automatically scope by access.tenantId
    const result = await tx.insert(recordsTable).values({
      ...input,
      tenantId: access.tenantId,
    });
    return result;
  });
}
```

---

## 3. Idempotency & Concurrency

- Every transactional `POST` endpoint must accept an `Idempotency-Key` header.
- Concurrent balance deductions (e.g. Leave days, Loan balances) must use row-level locking (`SELECT ... FOR UPDATE`) or atomic SQL decrement expressions (`SET balance = balance - :amount WHERE balance >= :amount`).
