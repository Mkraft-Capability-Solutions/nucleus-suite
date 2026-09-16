export type PolicyPassage = {
  id: string;
  title: string;
  section: string;
  text: string;
  keywords: string[];
};

export const approvedPolicyCorpus: PolicyPassage[] = [
  { id: "ATT-OVERNIGHT", title: "Attendance Policy 2026", section: "Overnight work", text: "An employee working until 03:00 or 04:00 may report at 09:00 or 09:30 the next day and receive full-day attendance. Assigned A-shift employees may be auto-detected on B-shift from punch evidence.", keywords: ["attendance", "overnight", "late", "shift", "punch", "3am", "4am"] },
  { id: "ATT-GRACE", title: "Attendance Policy 2026", section: "Grace and late arrival", text: "A 15-minute grace applies to in and out punches. Three late instances are allowed each month; a later occurrence beyond grace is treated as half day. Assistant Manager and above are exempt from grace deduction.", keywords: ["late", "grace", "manager", "exempt", "deduction", "half day", "attendance"] },
  { id: "ATT-OT", title: "Overtime Standard v3", section: "Calculation and settlement", text: "Overtime eligibility may be restricted to rest days or holidays by employee policy. Approved overtime is generated after regular salary and paid in a separate settlement. Overnight spans preserve their next-day timestamps.", keywords: ["overtime", "ot", "salary", "overnight", "rest day", "holiday"] },
  { id: "LEV-CREDIT", title: "Leave Policy 2026", section: "Annual credits", text: "AGM and above receive 18 EL, 6 CL and 6 SL on 1 January. Other eligible employees receive 6 CL and 6 SL in January and accrue 1.5 EL monthly. New joiners receive no EL for six months, then 9 EL. DET and GET trainees are eligible for CL.", keywords: ["leave", "credit", "earned", "casual", "sick", "el", "cl", "sl", "trainee"] },
  { id: "LEV-RULES", title: "Leave Policy 2026", section: "Usage and expiry", text: "CL cannot be combined with EL or SL, is limited to 2 days per month, and EL is limited to 10 days per month. COFF expires after 60 days. EL is encashed at year-end while CL and SL lapse. Birthday leave is separate.", keywords: ["coff", "expiry", "combine", "birthday", "encash", "casual", "earned", "leave"] },
  { id: "LEV-APPROVAL", title: "Leave Policy 2026", section: "Approval and early return", text: "Leave follows Supervisor, HOD and HR Head approval. If an employee returns before approved leave ends, actual workdays are marked present and unused leave is credited back.", keywords: ["approval", "supervisor", "hod", "early", "return", "leave"] },
  { id: "LOAN-01", title: "Employee Loan Policy", section: "Eligibility and guarantors", text: "An employee cannot receive another loan or salary advance until full repayment and cannot borrow while actively guaranteeing another loan. Two guarantors are mandatory; a third may be requested for larger amounts. Director override is exceptional and audited.", keywords: ["loan", "advance", "guarantor", "director", "repayment"] },
  { id: "LOAN-02", title: "Employee Loan Policy", section: "Loan ceiling", text: "The maximum principal is four times basic monthly salary, increasing to six times basic monthly salary after more than five completed years of service.", keywords: ["loan", "maximum", "ceiling", "basic", "salary", "years"] },
  { id: "GATE-01", title: "Gate Pass Policy", section: "Personal gate pass", text: "Personal gate passes are limited to four hours monthly, taken as one four-hour pass or two two-hour passes. Approved time is credited to work hours.", keywords: ["gate", "pass", "personal", "hours", "attendance"] },
  { id: "SEC-01", title: "Access Control Standard", section: "Sensitive compensation", text: "Plant administrators may create and maintain attendance but cannot access salary, rates or compensation structure. Access is tenant-scoped and role-scoped.", keywords: ["plant", "salary", "rate", "access", "permission", "security"] },
];

export function retrievePolicyPassages(query: string, limit = 3) {
  const normalized = query.toLowerCase();
  const terms = new Set(normalized.split(/\W+/).filter((term) => term.length > 2));
  return approvedPolicyCorpus
    .map((passage) => ({ passage, score: passage.keywords.reduce((score, keyword) => score + (normalized.includes(keyword) || terms.has(keyword) ? 1 : 0), 0) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ passage }) => passage);
}
