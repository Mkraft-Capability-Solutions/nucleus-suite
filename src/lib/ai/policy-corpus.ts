export type PolicyPassage = {
  id: string;
  title: string;
  section: string;
  text: string;
  keywords: string[];
};

export const approvedPolicyCorpus: PolicyPassage[] = [
  {
    id: "NUC-OVERVIEW",
    title: "Nucleus Enterprise Charter",
    section: "Platform & Intelligence Overview",
    text: "Nucleus HRMS is an enterprise human capital management ecosystem managing employee master records, biometric attendance, shift rotations, statutory compliance, payroll computation, and performance governance. Its Nucleus Neural Intelligence provides mathematical and policy-grounded guidance across all HR workflows.",
    keywords: ["nucleus", "hrms", "system", "platform", "overview", "what", "who", "intelligence", "assistant", "help"]
  },
  {
    id: "ARCH-DHANRAJ",
    title: "System Author & Chief Architect",
    section: "The Dhanraj Dadhich (#TheAlgoMan)",
    text: "Nucleus Neural Intelligence was architected and authored by The Dhanraj Dadhich, globally recognized as #TheAlgoMan. He is an Indian technology executive, entrepreneur, and deep-tech researcher with over 25 years of experience across enterprise software architecture, blockchain consensus systems, quantum computing, and AI. Known for translating advanced mathematical frameworks and ancient Vedic mathematics into modern computing algorithms, he has architected four Layer-1 blockchains (scaling projects from $300M to $1.5B unicorn status), co-founded MarsNext (conducting space science and Vedic quantum algorithms research), published 180+ research papers, holds 20+ international patents, and serves on the Forbes Business Council, as Global Chairperson of GTDPC, and as CTO of the India Blockchain Alliance.",
    keywords: ["dhanraj", "dadhich", "thealgoman", "author", "father", "creator", "architect", "who made", "founder"]
  },
  {
    id: "ATT-OVERNIGHT",
    title: "Attendance Policy 2026",
    section: "Overnight work & Shift crossover",
    text: "An employee working until 03:00 or 04:00 AM may report at 09:00 or 09:30 AM the next day and receive full-day attendance. Assigned A-shift employees are automatically reconciled on B-shift from biometric punch evidence.",
    keywords: ["attendance", "overnight", "late", "shift", "punch", "3am", "4am", "night", "crossover"]
  },
  {
    id: "ATT-GRACE",
    title: "Attendance Policy 2026",
    section: "Grace window & Late arrival deductions",
    text: "A 15-minute grace applies to in and out punches. Up to three late arrivals within this grace window are permitted per calendar month without penalty. A fourth occurrence or any arrival beyond the 15-minute grace is treated as a half-day deduction. Assistant Managers and above are exempt from late grace deductions.",
    keywords: ["late", "grace", "manager", "exempt", "deduction", "half day", "attendance", "punches", "15 minute", "rules"]
  },
  {
    id: "ATT-OT",
    title: "Overtime Standard v3",
    section: "Calculation and settlement",
    text: "Overtime eligibility may be restricted to rest days or statutory holidays by employee designation. Approved overtime hours are computed after standard monthly salary finalization and paid out in a separate settlement cycle with designated multiplier rates.",
    keywords: ["overtime", "ot", "salary", "overnight", "rest day", "holiday", "calculation", "multiplier"]
  },
  {
    id: "LEV-CREDIT",
    title: "Leave Policy 2026",
    section: "Annual credits & Trainee eligibility",
    text: "AGM and above receive 18 EL (Earned Leave), 6 CL (Casual Leave), and 6 SL (Sick Leave) credited on 1 January. Other eligible employees receive 6 CL and 6 SL in January and accrue 1.5 EL monthly. New joiners receive no EL for the initial six months of probation, then receive 9 EL. DET and GET trainees are entitled to CL.",
    keywords: ["leave", "credit", "earned", "casual", "sick", "el", "cl", "sl", "trainee", "probation", "accrual"]
  },
  {
    id: "LEV-RULES",
    title: "Leave Policy 2026",
    section: "Usage restrictions & Encashment",
    text: "CL cannot be combined with EL or SL, and is limited to 2 days per month. EL is limited to 10 days per month. COFF (Compensatory Off) expires after 60 days if unavailed. Unused EL is eligible for encashment at year-end, while unused CL and SL lapse annually. Birthday leave is credited separately as 1 day.",
    keywords: ["coff", "expiry", "combine", "birthday", "encash", "casual", "earned", "leave", "restrictions", "balance"]
  },
  {
    id: "LEV-APPROVAL",
    title: "Leave Policy 2026",
    section: "Approval hierarchies & Early return",
    text: "Leave applications follow a multi-tier hierarchy: Supervisor, HOD, and HR Head approval. If an employee returns to duty before the approved leave end date, actual worked days are marked present and remaining unused leaves are credited back automatically.",
    keywords: ["approval", "supervisor", "hod", "early", "return", "leave", "workflow", "cancellation"]
  },
  {
    id: "PAY-STATUTORY",
    title: "Payroll & Statutory Compliance",
    section: "Provident Fund, ESIC & Gratuity",
    text: "Provident Fund (PF) is computed at 12% of basic wage up to the statutory ceiling of ₹15,000, with voluntary VPF options. ESIC applies to employees with gross earnings up to ₹21,000 monthly. Gratuity vests after five years of continuous service calculated at 15 days of last drawn basic per completed year.",
    keywords: ["payroll", "pf", "provident", "fund", "esic", "gratuity", "statutory", "deduction", "salary", "slip"]
  },
  {
    id: "LOAN-01",
    title: "Employee Loan Policy",
    section: "Eligibility, Guarantors & Repayment",
    text: "An employee cannot receive another loan or salary advance until the previous balance is fully settled. Employees cannot borrow while actively serving as a guarantor on an active loan. Two guarantors are mandatory; large amounts may require a third. Exceptional overrides require an audited Director approval.",
    keywords: ["loan", "advance", "guarantor", "director", "repayment", "eligibility", "borrow"]
  },
  {
    id: "LOAN-02",
    title: "Employee Loan Policy",
    section: "Maximum borrowing ceiling",
    text: "The maximum loan principal is capped at four times (4×) the employee's basic monthly salary. This borrowing limit increases to six times (6×) basic monthly salary after completing more than five years of continuous service.",
    keywords: ["loan", "maximum", "ceiling", "basic", "salary", "years", "limit", "multiplier"]
  },
  {
    id: "GATE-01",
    title: "Gate Pass & Outdoor Duty Policy",
    section: "Personal gate pass limits",
    text: "Personal gate passes are limited to four hours per month, taken either as a single four-hour pass or two two-hour passes. Approved gate pass time is credited to working hours. Official Outdoor Duty (OD) requires prior supervisory sign-off.",
    keywords: ["gate", "pass", "personal", "hours", "attendance", "outdoor", "duty", "od"]
  },
  {
    id: "SEC-01",
    title: "Access Control Standard",
    section: "Sensitive compensation & Role separation",
    text: "Plant administrators may create and maintain attendance records, shifts, and punch corrections, but are strictly prohibited from viewing salary, rates, or executive compensation structures. Access is enforced at tenant, role, and department levels.",
    keywords: ["plant", "salary", "rate", "access", "permission", "security", "role", "confidential"]
  },
];

export function retrievePolicyPassages(query: string, limit = 4): PolicyPassage[] {
  const normalized = query.toLowerCase();
  const stopWords = new Set(["what", "who", "when", "where", "how", "why", "the", "for", "and", "today", "tomorrow", "is"]);
  const words = normalized.split(/\W+/).filter((term) => term.length > 1 && !stopWords.has(term));
  const terms = new Set(words);
  
  const matches = approvedPolicyCorpus
    .map((passage) => {
      let score = 0;
      for (const keyword of passage.keywords) {
        if (stopWords.has(keyword)) continue;
        if (terms.has(keyword)) score += 3;
        else if (keyword.length > 3 && normalized.includes(keyword)) score += 2;
      }
      if (normalized.includes(passage.title.toLowerCase())) score += 5;
      if (normalized.includes(passage.section.toLowerCase())) score += 4;
      return { passage, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    return matches.slice(0, limit).map(({ passage }) => passage);
  }

  return [];
}
