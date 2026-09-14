# Nucleus HRMS — Master Development & Deployment Execution Plan

> **File Location:** `documentation/execution/MASTER_DEVELOPMENT_AND_DEPLOYMENT_EXECUTION_PLAN.md`  
> **Repository:** Private HRMS SaaS (Nucleus Suite)  
> **Architecture Level:** Military-Grade Multi-Tenant Enterprise HRMS  
> **Current Status:** Ready for Phase-by-Phase Execution  
> **Execution Trigger Syntax:** Say `"Complete Phase X"` (e.g., `"Complete Phase 1"`) to trigger end-to-end execution of that phase.

---

## Table of Contents

1. [Execution Overview & Governing Protocols](#1-execution-overview--governing-protocols)
2. [Complete Service & Architecture Inventory](#2-complete-service--architecture-inventory)
3. [Phase 1: Persistence & Live Database Migration (PostgreSQL + Drizzle ORM + PgVector)](#phase-1-persistence--live-database-migration)
4. [Phase 2: Enterprise Identity, Session Security & Tenant Isolation (Better-Auth + RBAC + SAML/OIDC)](#phase-2-enterprise-identity-session-security--tenant-isolation)
5. [Phase 3: Deep Domain Engines & Edge-Case Completion (All 35 Services)](#phase-3-deep-domain-engines--edge-case-completion)
6. [Phase 4: Complete Enterprise AI Subsystem (Top 10 WOW Features)](#phase-4-complete-enterprise-ai-subsystem-top-10-wow-features)
7. [Phase 5: External Communication Gateways & Cloud Object Storage](#phase-5-external-communication-gateways--cloud-object-storage)
8. [Phase 6: End-to-End Automation, Security Audits & Statutory Compliance](#phase-6-end-to-end-automation-security-audits--statutory-compliance)
9. [Phase 7: Cloud Infrastructure, CI/CD & Production Zero-Downtime Launch](#phase-7-cloud-infrastructure-cicd--production-zero-downtime-launch)
10. [Verification Gate & Definition of Done for Each Phase](#10-verification-gate--definition-of-done-for-each-phase)

---

# 1. Execution Overview & Governing Protocols

This document defines the strict, phase-by-phase execution blueprint to transition **Nucleus HRMS** from the prototype UI validation baseline into a fully production-grade, multi-tenant enterprise platform.

### Phase Trigger Protocol:
When you instruct:
- **`"Complete Phase 1"`** $\rightarrow$ Activates live PostgreSQL instance, executes Drizzle migrations, imports workbook seed data, converts mock snapshot repositories in `src/server/` into transactional Drizzle repositories, and validates zero regressions.
- **`"Complete Phase 2"`** $\rightarrow$ Activates Better-Auth partitioned HTTP-only session cookies, MFA/TOTP, SAML 2.0 / OIDC enterprise SSO, multi-tenant Row-Level Security (RLS), and RBAC/ABAC authorization across all 10 role consoles.
- **`"Complete Phase 3"`** $\rightarrow$ Implements the deep domain computation engines across all 35 business services (Time & Biometrics, Leave Ledger, Indian Dual-Regime Payroll & Statutory Challans, ATS & Offer Signatures, 360 Appraisal & 9-Box Matrix).
- **`"Complete Phase 4"`** $\rightarrow$ Deploys and wires all **10 AI WOW Features** (Autonomous Biometric Anomaly Auto-Healer, Predictive Flight-Risk Radar, 11-Language Conversational Copilot, Semantic Resume Matcher, Payroll Fraud Sentinel, Skill Graph, Shift Optimizer, Tax Simulator, OCR Onboarding Concierge, Voice Briefing).
- **`"Complete Phase 5"`** $\rightarrow$ Configures transactional email (AWS SES/SendGrid), WhatsApp Cloud API, Twilio SMS, Push notifications, and encrypted S3 document storage with presigned URLs.
- **`"Complete Phase 6"`** $\rightarrow$ Runs complete Playwright E2E test suites (200+ workbook flows), OWASP Top 10 penetration auditing, k6 load testing, and DPDP / GDPR / SOC 2 compliance verification.
- **`"Complete Phase 7"`** $\rightarrow$ Builds production Docker containers, sets up Kubernetes / Vercel Enterprise CI/CD, configures Prometheus/Grafana observability, and executes zero-downtime deployment.

---

# 2. Complete Service & Architecture Inventory

The application is built on **35 Backend Domain Services** unified under `src/server/` with strict domain isolation:

```
src/server/
├── identity/          # 1. Better-Auth, Sessions, MFA, SAML/OIDC, RBAC
├── organization/      # 2. Companies, Business Units, Departments, Designations, Cost Centers
├── people/            # 3. Employee Master, KYC, Family/Dependents, Emergency Contacts
├── lifecycle/         # 4. Onboarding, Probation, Transfers, Promotions, Exit / F&F
├── attendance/        # 5. Biometric Punches, Geo-tracking, Regularization, Shifts, Overtime
├── leave/             # 6. Accruals, Leave Policies, Multi-Tier Approval, Balance Ledger
├── payroll/           # 7. Salary Structures, Dual-Regime Tax, Allowances, LOP, Pay Batches
├── statutory/         # 8. EPFO ECR, ESIC, Form 16, Form 24Q TDS, State-wise PT
├── talent/            # 9. Job Requisitions, ATS Pipeline, Candidates, Scorecards
├── interviews/        # 10. Multi-Stage Interview Scheduling, Calendar Sync, Feedback
├── offers/            # 11. Offer Templates, Compensation Approvals, Digital Signatures
├── performance/       # 12. OKRs, Goal Cascading, 360 Reviews, Self/Manager Ratings
├── 9box/              # 13. Dynamic 9-Box Grid Calibration, Succession Planning
├── learning/          # 14. Course Catalog, Mandatory Compliance Training, Certifications
├── skills/            # 15. Skill Matrix, Competency Graph, Gap Analysis
├── benefits/          # 16. Flexible Benefit Plans (FBP), Group Health Insurance, Claims
├── advances/          # 17. Salary Advances, Loan Applications, EMI Payroll Deductions
├── expenses/          # 18. Travel & Expense Claims, Multi-Level Receipt Approvals
├── assets/            # 19. Hardware/Software Asset Allocation, Depreciation, Return
├── helpdesk/          # 20. Employee Ticketing, SLA Tracking, Category Escalations
├── engagement/        # 21. Pulse Surveys, eNPS, Recognition Wall, Kudos
├── compliance/        # 22. Statutory Registers, Labor Law Audits, Minimum Wage Sentinel
├── governance/        # 23. Delegation of Authority (DoA), Policy Distribution, Acknowledgments
├── documents/         # 24. Document Vault, Expiry Alerts, Encrypted Storage
├── privacy/           # 25. India DPDP & GDPR Compliance, Data Subject Requests (DSR)
├── notifications/     # 26. Multi-Channel Dispatch (Email, SMS, WhatsApp, WebPush)
├── jobs/              # 27. Transactional Outbox Worker, BullMQ Async Task Queue
├── fx/                # 28. Multi-Currency Conversion, Exchange Rate Sync
├── contractors/       # 29. Contingent Workforce, Vendor Agencies, SOW Invoicing
├── exports/           # 30. Governed MIS Reports, Excel/CSV/PDF Streaming Exporters
├── ai/                # 31. LangGraph Multi-Agent Gateway, Semantic Router, Guardrails
├── analytics/         # 32. Workforce Metrics, Headcount Forecasting, Attrition Heatmaps
├── platform/          # 33. Tenant Configuration, Custom Fields, Feature Flags
├── admin/             # 34. System Health, Audit Trail Inspector, Data Migration Tools
└── platform-admin/    # 35. Super Admin Multi-Tenant Provisioning, SaaS Billing
```

---

# 3. `src/data/` Decommissioning & Database Migration Register

The files currently residing in `src/data/` represent prototype assets and validation fixtures. During the database persistence and authentication phases, all static JSON files will be systematically migrated into PostgreSQL tables and removed from source control:

| File / Directory | Purpose in Prototype | Production PostgreSQL Target Table | Migration & Removal Phase |
|---|---|---|---|
| `src/data/locales/en/interface.json` | Prototype UI text hashes | Migrated to `src/locales/en/interface.json` (centralized i18n) | **Immediate (Completed)** |
| `src/data/appearance.json` | Theme tokens, font configurations, density | `tenant_branding_settings` & `user_appearance_preferences` | **Phase 1 (DB Activation)** |
| `src/data/assistant.json` | Static prototype agent tools & actions | Replaced by `ai_agent_conversations` & dynamic LangGraph tools | **Phase 4 (AI Implementation)** |
| `src/data/demo-accounts.json` | Synthetic persona logins | Seeded into Better-Auth `users`, `accounts`, `user_roles` | **Phase 2 (Auth Activation)** |
| `src/data/public-site.json` | Public marketing & feature content | Static marketing bundle / `cms_content` table | **Phase 1 (DB Activation)** |
| `src/data/workbook.json` | Excel master process snapshot | Seeded into master tables (`departments`, `leave_types`, `tax_slabs`) | **Phase 1 (DB Activation)** |
| `src/data/workspace-contract.mjs` | Validation contract for mock fixtures | Replaced by Drizzle ORM schemas & OpenAPI/Zod validator | **Phase 1 (DB Activation)** |
| `src/data/workspace-manifest.ts` | Prototype fixture bundle manifest | Replaced by direct Drizzle SQL queries (`src/lib/db`) | **Phase 1 (DB Activation)** |
| `src/data/ui/*.json` (152 files) | Default component mock states & catalogs | `navigation_catalogs`, React initial states, or API responses | **Phase 1 & Phase 3** |

---

# Phase 1: Persistence & Live Database Migration

### Goals:
Transition the data layer from mock memory/snapshot reads to a production-grade PostgreSQL 16+ database with Drizzle ORM and `pgvector`.

### Concrete Execution Steps:
1. **Live PostgreSQL Connection Configuration:**
   - Configure `.env.local` / `.env.production` with `DATABASE_URL` (SSL mode enabled).
   - Initialize PostgreSQL connection pool via `pg.Pool` with connection retry and health checks.
2. **Execute Drizzle Schema Migrations:**
   - Run `npx drizzle-kit generate` and `npx drizzle-kit migrate` against the live PostgreSQL database.
   - Synchronize all 35 domain models in `src/lib/db/schema.ts`, including tables, composite indexes, foreign key constraints, and cascade rules.
   - Enable `CREATE EXTENSION IF NOT EXISTS vector;` for pgvector support.
3. **Master Reference Data Ingestion & Seeding:**
   - Execute seed script `scripts/seed-enterprise-masters.mjs` to populate:
     - 10 System Personas and Permission Matrices.
     - Indian Statutory Tax Slabs (Old vs. New Regime, Surcharge, Cess).
     - Standard Leave Policy Catalogs (CL, SL, EL, Maternity, Paternity, Comp-Off).
     - Standard Organization Hierarchy from `Nucleus_Forms_and_Fields_Complete_MKraft.xlsx`.
4. **Service Repository Layer Switchover:**
   - Replace prototype snapshot readers with direct Drizzle SQL queries across all 35 services.
   - Implement transactional unit-of-work boundaries (`db.transaction()`) with optimistic concurrency control on balance and payroll entities.
5. **Phase 1 Verification:**
   - Run `npm run typecheck`, `npm run lint`, `npm test` (all 808 unit tests + live DB integration tests), and verify 100% data fidelity.

---

# Phase 2: Enterprise Identity, Session Security & Tenant Isolation

### Goals:
Implement enterprise-grade identity management, multi-factor authentication, single sign-on, and row-level tenant security.

### Concrete Execution Steps:
1. **Better-Auth Enterprise Setup:**
   - Configure Better-Auth Drizzle adapter with HTTP-only, secure, `SameSite=Lax`, partitioned session cookies.
   - Implement automatic session rotation on privilege changes.
2. **Multi-Factor Authentication (MFA / 2FA):**
   - Implement TOTP (Google Authenticator / Microsoft Authenticator) setup and verification workflows.
   - Implement FIDO2 / WebAuthn Passkeys for passwordless biometric login.
   - Generate emergency backup recovery codes.
3. **Enterprise Single Sign-On (SSO):**
   - Implement SAML 2.0 and OIDC endpoints for Okta, Microsoft Azure AD / Entra ID, and Google Workspace.
   - Support Just-In-Time (JIT) employee account provisioning and role synchronization.
4. **Multi-Tenant Row-Level Security (RLS) & Tenant Isolation:**
   - Implement AsyncLocalStorage request context to propagate `tenantId` across all database queries.
   - Enforce tenant isolation middleware blocking any cross-tenant data leakage.
5. **RBAC & ABAC Permission Engine:**
   - Enforce fine-grained authorization gates across all 10 consoles (`SUPER_ADMIN`, `HR_ADMIN`, `PAYROLL_OFFICER`, `TALENT_DIRECTOR`, `LINE_MANAGER`, `EMPLOYEE`, etc.).

---

# Phase 3: Deep Domain Engines & Edge-Case Completion

### Goals:
Implement full business logic calculations, state machines, and statutory compliance rules across all core modules.

### Concrete Execution Steps:

### 3.1 Workforce, Time & Attendance Engine
- **Biometric Integration:** Webhook listeners for biometric punch devices (ZKTeco, Matrix, Suprema, eSSL) and mobile GPS geofenced punches.
- **Auto-Regularization & Overtime:** Automatic detection of missed punches, grace periods, half-day triggers, and Indian Factories Act overtime multipliers (2x normal wage).
- **Shift Roster & Rotation:** Automated rotating shift scheduling (Day/Night/General), weekly-off management, and shift exchange requests.

### 3.2 Leave Management & Ledger Engine
- **Balance Ledger:** Double-entry leave ledger maintaining opening balance, credited, debited, lapsed, encashed, and available balances.
- **Complex Policies:** Automated handling of sandwich rule (weekends/holidays between leave days), probation restrictions, and continuous service rules.
- **Multi-Level Approval Hierarchy:** Dynamic routing based on organization hierarchy (Reporting Manager $\rightarrow$ Department Head $\rightarrow$ HRBP).

### 3.3 Payroll, Compensation & Statutory Engine
- **Dual-Regime Tax Calculator:** Real-time income tax computation comparing Old Regime (with 80C, 80D, HRA, Standard Deduction) vs. New Regime (Section 115BAC).
- **Statutory Return Generators:**
  - Automated EPFO Electronic Challan cum Return (ECR) text file generator.
  - ESIC Monthly Return Excel format.
  - TDS Form 24Q quarterly filing return with Annexure II.
  - State-wise Professional Tax (PT) slab computation (Maharashtra, Karnataka, Tamil Nadu, Telangana, West Bengal, Gujarat).
- **Bank Disbursement Files:** Encrypted batch payment generation for ICICI, HDFC, SBI, Axis (NEFT/RTGS formats).
- **Digital Payslip Engine:** High-performance background PDF rendering with password protection (PAN + DoB) and batch distribution.

### 3.4 Talent Acquisition & ATS Engine
- **Job Board Syndication:** Outbound XML/API feeds for LinkedIn Jobs, Indeed, and Naukri.
- **Interview Scheduling & Calendar Sync:** Real-time calendar availability lookup and Google Meet / Microsoft Teams meeting generation.
- **Offer Management & e-Signatures:** Dynamic offer compensation letter generation with digital signature collection.

### 3.5 Performance, Appraisal & 9-Box Engine
- **OKR & Goal Cascading:** Company $\rightarrow$ Department $\rightarrow$ Team $\rightarrow$ Individual goal alignment with weightages and milestone progress tracking.
- **360 Feedback & Multi-Rater Appraisals:** Anonymous peer feedback, self-evaluations, and manager calibration.
- **Dynamic 9-Box Calibration Grid:** Real-time potential vs. performance placement with talent pool segmentation and succession tagging.

---

# Phase 4: Complete Enterprise AI Subsystem (Top 10 WOW Features)

### Goals:
Implement the complete 4-tier AI Subsystem and all 10 WOW Features specified in [`AI_ENTERPRISE_ARCHITECTURE.md`](file:///Users/dhanraj/dhanraj/DFS/workspace/MKraft/nucleus-suite/documentation/engineering/AI_ENTERPRISE_ARCHITECTURE.md).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NUCLEUS ENTERPRISE AI SUBSYSTEM                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. SEMANTIC INTENT GATEWAY  │ Intent classification & multi-lingual parsing │
│ 2. ROLE-GATED RAG PIPELINE  │ pgvector embeddings + strict RBAC context     │
│ 3. MULTI-AGENT ORCHESTRATOR │ LangGraph stateful multi-step tool execution  │
│ 4. GUARDRAILS & PRIVACY     │ PII masking, Zero Data Retention, Fair AI     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detailed WOW Features Implementation:

| # | Feature | Architecture & Implementation |
|---|---|---|
| **1** | **Autonomous Biometric Anomaly Auto-Healer** | Background worker evaluating punch discrepancies against calendar invites, Slack activity, and GPS pings; drafts and executes pre-approved attendance regularizations without HR intervention. |
| **2** | **Predictive Flight-Risk & Burnout Radar (9-Box AI)** | Real-time ML model analyzing overtime spikes, sentiment dips in 1-on-1s, leave frequency, and market salary benchmarks to alert managers *before* key talent resigns. |
| **3** | **Conversational "Ask HR" Multi-Lingual Copilot** | Voice & text assistant operating across **11 languages** (English, Spanish, French, German, Japanese, Arabic, Hindi, Tamil, Telugu, Bengali, Marathi) for instant leave booking, policy inquiries, and tax estimates. |
| **4** | **Semantic Requisition & Bias-Free Resume Matcher** | Deep vector embeddings for skill mapping that automatically masks candidate demographic identifiers (name, gender, age, photo) to score candidates purely on competency. |
| **5** | **Autonomous Payroll Exception & Fraud Sentinel** | Pre-run audit agent scanning 100+ payroll anomaly vectors (duplicate bank accounts, sudden grade jumps, ghost employees, excessive LOP reversals) before payouts occur. |
| **6** | **AI Skill Graph & Adaptive Career Pathways** | Analyzes organizational competency gaps and generates personalized upskilling pathways and internal mobility recommendations. |
| **7** | **Smart Shift Roster & Fatigue Optimizer** | Constraint-satisfaction solver optimizing shift rotations around employee preferences, labor regulations, and predicted workload surges. |
| **8** | **Interactive Tax & Benefit Simulator** | Real-time "What-If" tax simulation engine helping employees optimize voluntary contributions, HRA, and investments with live take-home pay comparisons. |
| **9** | **Autonomous Onboarding Concierge & OCR Verifier** | Instant OCR extraction and validation for passports, Aadhaar, PAN, and educational certificates, guiding new hires via dynamic conversational checklists. |
| **10** | **Voice-to-Action Executive Briefing** | Generates 60-second synthesized audio and visual morning briefings for managers highlighting urgent approvals, team bandwidth, and compliance deadlines. |

---

# Phase 5: External Communication Gateways & Cloud Object Storage

### Goals:
Connect enterprise notification channels, messaging platforms, and secure cloud storage.

### Concrete Execution Steps:
1. **Transactional Email Service:**
   - AWS SES / SendGrid integration with DKIM, SPF, and DMARC verification.
   - Responsive HTML templates for approvals, welcome emails, payslips, and alert digests.
2. **WhatsApp & SMS Gateway:**
   - Meta WhatsApp Cloud API integration for instant interactive approvals (e.g., Approve/Reject leave via WhatsApp button).
   - Twilio / Karix SMS integration for OTP verification and critical compliance notifications.
3. **Encrypted Cloud Object Storage:**
   - AWS S3 / Cloudflare R2 bucket integration with server-side AES-256 encryption.
   - Time-limited Presigned URLs for secure document viewing and downloads.

---

# Phase 6: End-to-End Automation, Security Audits & Statutory Compliance

### Goals:
Perform full-spectrum quality verification, security hardening, and regulatory compliance auditing.

### Concrete Execution Steps:
1. **Automated Playwright E2E Suite:**
   - Execute 200+ automated end-to-end browser journeys covering all workbook flows across all 10 personas.
2. **Load & Stress Testing:**
   - k6 performance benchmark simulating 50,000+ concurrent employee punch-ins and 10,000 concurrent payroll runs with < 200ms p95 latency.
3. **OWASP Top 10 Security Audit & Penetration Testing:**
   - Hardening against SQL Injection, XSS, CSRF, IDOR, and Broken Object Level Authorization (BOLA).
4. **Data Privacy & Statutory Certifications:**
   - India Digital Personal Data Protection (DPDP) Act compliance (Right to Correction, Right to Erasure, Consent Logs).
   - GDPR, SOC 2 Type II, and ISO 27001 readiness.

---

# Phase 7: Cloud Infrastructure, CI/CD & Production Zero-Downtime Launch

### Goals:
Deploy high-availability production infrastructure with automated CI/CD and full observability.

### Concrete Execution Steps:
1. **Docker Containerization:**
   - Optimized multi-stage Dockerfile for Next.js App Router (Node.js Alpine) and background BullMQ worker containers.
2. **Kubernetes / Cloud Orchestration:**
   - Production manifests with Horizontal Pod Autoscalers (HPA), Ingress TLS certificates, and health probes (`/api/health`).
3. **Enterprise CI/CD Automation:**
   - GitHub Actions workflow running:
     `Lint -> Typecheck -> Unit Tests (808) -> UI Tests (32) -> E2E Playwright -> Production Build -> Zero-Downtime Deploy`.
4. **Observability, Monitoring & Disaster Recovery:**
   - Prometheus metrics & Grafana dashboards tracking API latencies, active sessions, and database query performance.
   - Sentry error monitoring and OpenTelemetry distributed tracing.
   - Multi-region database read-replicas with automated backups and < 15-minute RTO / RPO.

---

# 8. Swagger / OpenAPI 3.1 Specification & Endpoint Test Coverage

To ensure military-grade service integration and enterprise API governance, the platform implements interactive Swagger / OpenAPI 3.1 documentation and automated contract testing across all 35 domain services:

### 8.1 OpenAPI 3.1 Specification Engine
- **Endpoint Route:** `/api/docs` (Interactive Swagger UI / Redoc) and `/api/openapi.json` (OpenAPI 3.1 Schema).
- **Schema Validation:** Automated runtime validation using Zod schemas (`@asteasolutions/zod-to-openapi`) mapped directly from Drizzle ORM models.
- **Interactive Console:** Authenticated API explorer supporting OAuth2 Bearer Tokens and API Keys with live request execution and response schema verification.

### 8.2 Endpoint Test Suite Matrix
Every endpoint across all 35 services must have dedicated Vitest integration tests covering:
1. **Happy Path:** Valid payload returning `200 OK` or `201 Created` with expected Drizzle entity structure.
2. **Schema & Field Validation:** Malformed or missing required parameters returning `400 Bad Request` with structured RFC 7807 problem details.
3. **Authentication & Identity:** Missing or expired session tokens returning `401 Unauthorized`.
4. **RBAC / Authorization:** Insufficient persona permissions (e.g. `EMPLOYEE` attempting to trigger payroll) returning `403 Forbidden`.
5. **Multi-Tenant Isolation:** Accessing records belonging to another `tenant_id` returning `404 Not Found` or `403 Forbidden`.
6. **Concurrency & Rate Limiting:** High-frequency requests returning `429 Too Many Requests`.

---

# 9. Enterprise OAuth 2.0, OpenID Connect (OIDC) & Security Architecture

The platform architecture enforces zero-trust security across all identity and service boundaries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   ENTERPRISE OAUTH 2.0 & SECURITY LAYER                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. IDENTITY PROVIDERS   │ Okta, Azure AD / Entra ID, Google Workspace       │
│ 2. PROTOCOLS            │ SAML 2.0, OIDC (Authorization Code Flow with PKCE)│
│ 3. TOKEN ARCHITECTURE   │ Partitioned HTTP-Only Session Cookies + Short JWT │
│ 4. SERVICE-TO-SERVICE   │ mTLS + Asymmetric Signed HMAC Service Tokens      │
│ 5. DATA SECURITY        │ AES-256 Envelope Encryption at Rest & TLS 1.3     │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **OAuth 2.0 Authorization Server:** Built on Better-Auth with full PKCE (Proof Key for Code Exchange) support for SPAs and mobile clients.
- **Granular Scopes:** Scopes defined per domain (e.g., `attendance:read`, `leave:write`, `payroll:admin`, `talent:interview`).
- **Token Rotation & Revocation:** Cryptographically signed refresh tokens with automatic single-use rotation and instant global revocation on password changes.
- **Audit Trails:** Immutable append-only audit logging for all authentication, token generation, and role delegation events.

---

# 10. Verification Gate & Definition of Done for Each Phase

Every phase must satisfy the following Quality Gate before being declared complete:

| Check | Requirement | Target |
|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **0 Errors** |
| **ESLint Quality Gate** | `npm run lint` | **0 Errors / 0 Warnings** |
| **Unit & Service Tests** | `npm test` | **100% Passing (808+ tests)** |
| **UI & Visual Tests** | `npm run test:ui` | **100% Passing (32+ tests)** |
| **Build Compilation** | `npm run build` | **Zero-Error Turbopack Compilation** |
| **Localization Integrity** | `src/lib/i18n.test.ts` | **All 11 Languages Synchronized** |
| **Zero Regressions** | Git Working Tree | **Clean, Committed & Pushed** |
