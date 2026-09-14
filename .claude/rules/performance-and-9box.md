# Performance Management, OKR & 9-Box Talent Calibration Rules

> **Scope:** Domain Performance & Talent Calibration  
> **Source:** `ConsoleCalibrationView.js` (S6 Console) & `src/server/performance/`

---

## 1. OKR & KRA Cascading Architecture

- **Company Objectives**: Defined at the corporate tenant level for annual/quarterly horizons.
- **Department & Team Key Results**: Linked directly to top-level corporate objectives.
- **Individual KPIs**: Measurable units (e.g. % SLA compliance, revenue generated, quality defect rate) with defined weights totaling 100%.

---

## 2. Interactive 9-Box Talent Matrix (S6 Console)

Employees are plotted on a 3x3 grid:
- **X-Axis**: Performance (Low, Medium, High)
- **Y-Axis**: Potential (Low, Medium, High)

Boxes:
1. Low Perf / Low Pot: *Risk / Action Required*
2. Med Perf / Low Pot: *Effective Specialist*
3. High Perf / Low Pot: *Trusted Professional*
4. Low Perf / Med Pot: *Dilemma / Realign*
5. Med Perf / Med Pot: *Core Contributor*
6. High Perf / Med Pot: *High Performer*
7. Low Perf / High Pot: *Enigma / Untapped*
8. Med Perf / High Pot: *Growth Talent*
9. High Perf / High Pot: *Star / Future Leader*

---

## 3. Bell Curve Normalization Quotas

- Corporate forced-distribution quotas:
  - Outstanding (Box 9 / Band A): Max 10%–15%
  - Solid Core (Boxes 5, 6, 8 / Band B): 70%
  - Needs Improvement / PIP (Boxes 1, 4 / Band C): Min 10%–15%
- S6 Calibration Cockpit flags variance exceeding ±2% with warning badges.
