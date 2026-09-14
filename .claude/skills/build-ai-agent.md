# Skill: Build and Register a MultipliersKraft AI Agent

This skill guides you through constructing one of the 13 specialized AI domain agents in Nucleus HRMS.

---

## 13 Specialized Domain Agents
1. **Resume Scorer (ATS)**: Evaluates resumes against job descriptions (OneScore 0–100).
2. **Attrition Radar**: Analyzes tenure, comp ratio, and sentiment to plot flight risk.
3. **Shift Balancer**: Predicts shift absenteeism and auto-suggests optimal relief staff.
4. **Payroll Anomaly Scanner**: Pre-payroll audit flagger for gross-to-net variances > 10%.
5. **Policy Assistant**: Interactive NLP agent answering questions on company policies.
6. **Voice Command Interpreter**: Transcribes voice audio and triggers UI navigation / punches.
7. **Expense OCR Auditor**: Scans receipts for duplicate claims and non-compliant line items.
8. **Leave Sandwich Evaluator**: Proactively notifies employees before applying for sandwich leave.
9. **Performance Bias Detector**: Analyzes review comments and distribution curves for gender/rating bias.
10. **Skill Gap Identifier**: Compares current role competencies against target succession ladders.
11. **Onboarding Buddy**: Guides new hires through 30-60-90 day checklists and document uploads.
12. **Statutory Filing Auditor**: Verifies PF, ESIC, and PT registers before government submission.
13. **Governance Sentinel**: Watches access logs for anomalous bulk exports or permission elevation.

---

## Implementation Pattern

1. **Trigger Definition**:
   In `src/server/ai/agent-actions.ts`:
   ```typescript
   export async function executeAgentAction(access: Access, actionType: string, payload: Record<string, any>) {
     // Validate policy guardrails & log to agent_actions table
   }
   ```
2. **Outbox Event Integration**:
   Agents subscribe to transactional outbox events in `src/server/jobs/worker.ts`.
