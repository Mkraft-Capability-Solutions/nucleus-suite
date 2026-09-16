export type Persona = {
  id: string;
  name: string;
  role: string;
  initials: string;
  accent: string;
};

export const personas: Persona[] = [
  { id: "hr", name: "Ananya Mehta", role: "HR Admin", initials: "AM", accent: "#d9ff6f" },
  { id: "manager", name: "Rohan Kapoor", role: "Engineering Manager", initials: "RK", accent: "#9ee8ff" },
  { id: "employee", name: "Maya Rao", role: "Employee", initials: "MR", accent: "#ffd6a0" },
  { id: "payroll", name: "Vikram Shah", role: "Payroll Admin", initials: "VS", accent: "#e7ceff" },
  { id: "recruiter", name: "Sara D'Souza", role: "Recruiter", initials: "SD", accent: "#ffc4cf" },
];

export { navigation } from "./navigation-catalog";

export const employees = [
  {
    id: "EMP-0142",
    name: "Aarav Malhotra",
    initials: "AM",
    role: "Senior Product Designer",
    department: "Product & Design",
    location: "Bengaluru",
    manager: "Naina Batra",
    status: "Active",
    capability: 86,
    tenure: "3y 4m",
    email: "aarav.m@asteria.in",
    accent: "#d9ff6f",
  },
  {
    id: "EMP-0098",
    name: "Meera Nair",
    initials: "MN",
    role: "Engineering Lead",
    department: "Engineering",
    location: "Pune",
    manager: "Rohan Kapoor",
    status: "Active",
    capability: 91,
    tenure: "5y 8m",
    email: "meera.n@asteria.in",
    accent: "#9ee8ff",
  },
  {
    id: "EMP-0231",
    name: "Kabir Singh",
    initials: "KS",
    role: "Plant Supervisor",
    department: "Operations",
    location: "Mumbai Plant",
    manager: "Ajay Menon",
    status: "On shift",
    capability: 79,
    tenure: "7y 2m",
    email: "kabir.s@asteria.in",
    accent: "#ffd6a0",
  },
  {
    id: "EMP-0274",
    name: "Isha Kulkarni",
    initials: "IK",
    role: "People Partner",
    department: "People",
    location: "Bengaluru",
    manager: "Ananya Mehta",
    status: "On leave",
    capability: 84,
    tenure: "2y 1m",
    email: "isha.k@asteria.in",
    accent: "#e7ceff",
  },
  {
    id: "EMP-0315",
    name: "Arjun Desai",
    initials: "AD",
    role: "GET Trainee",
    department: "Manufacturing",
    location: "Mumbai Plant",
    manager: "Kabir Singh",
    status: "New joiner",
    capability: 68,
    tenure: "4m",
    email: "arjun.d@asteria.in",
    accent: "#ffc4cf",
  },
  {
    id: "EMP-0188",
    name: "Leena Joseph",
    initials: "LJ",
    role: "Finance Manager",
    department: "Finance",
    location: "Mumbai HO",
    manager: "Dev Arora",
    status: "Active",
    capability: 88,
    tenure: "6y 7m",
    email: "leena.j@asteria.in",
    accent: "#b9f2df",
  },
];

export const headcountTrend = [
  { month: "Apr", headcount: 108, capability: 71 },
  { month: "May", headcount: 110, capability: 73 },
  { month: "Jun", headcount: 112, capability: 72 },
  { month: "Jul", headcount: 116, capability: 75 },
  { month: "Aug", headcount: 118, capability: 77 },
  { month: "Sep", headcount: 120, capability: 81 },
];

export const departmentCapability = [
  { name: "Engineering", value: 89, fill: "#164f45" },
  { name: "Product", value: 86, fill: "#2f7668" },
  { name: "Operations", value: 76, fill: "#e6a73b" },
  { name: "Sales", value: 82, fill: "#69b3a2" },
  { name: "Finance", value: 84, fill: "#9d7ac4" },
];

export const activities = [
  {
    title: "Onboarding started for Arjun Desai",
    meta: "12 tasks created across HR, IT and Operations",
    time: "8 min",
    tone: "mint",
  },
  {
    title: "September payroll calculated",
    meta: "120 employees · 3 anomalies need review",
    time: "24 min",
    tone: "amber",
  },
  {
    title: "People policy indexed by Nucleus AI",
    meta: "Leave Policy v4.2 · 38 source passages",
    time: "1 hr",
    tone: "violet",
  },
  {
    title: "Quarterly goal check-in completed",
    meta: "Product & Design · 87% participation",
    time: "2 hrs",
    tone: "blue",
  },
];

export const leaveRequests = [
  {
    id: "LR-2048",
    name: "Nikhil Jain",
    initials: "NJ",
    type: "Earned leave",
    dates: "14–17 Sep",
    days: 4,
    coverage: "Covered by Pooja",
    risk: "No conflict",
    accent: "#d9ff6f",
  },
  {
    id: "LR-2051",
    name: "Tanya Bose",
    initials: "TB",
    type: "Casual leave",
    dates: "12 Sep",
    days: 1,
    coverage: "2 teammates also away",
    risk: "Coverage risk",
    accent: "#ffd6a0",
  },
  {
    id: "LR-2055",
    name: "Faisal Khan",
    initials: "FK",
    type: "Sick leave",
    dates: "10–11 Sep",
    days: 2,
    coverage: "Document attached",
    risk: "No conflict",
    accent: "#9ee8ff",
  },
];

export const payrollAnomalies = [
  {
    id: "PAY-A31",
    employee: "Kabir Singh",
    initials: "KS",
    issue: "Overtime 184% above 6-month average",
    evidence: "7h 20m on 9 Sep · overnight continuation",
    amount: "₹4,812",
    severity: "High",
  },
  {
    id: "PAY-A18",
    employee: "Priya Menon",
    initials: "PM",
    issue: "Bank account changed after input lock",
    evidence: "Updated by HR Ops · maker-checker pending",
    amount: "₹82,400",
    severity: "High",
  },
  {
    id: "PAY-A07",
    employee: "Arjun Desai",
    initials: "AD",
    issue: "Attendance missing for one shift",
    evidence: "3 Sep · device import has no out punch",
    amount: "₹21,650",
    severity: "Medium",
  },
];

export const candidates = [
  {
    name: "Rhea Thomas",
    role: "Senior Product Manager",
    match: 92,
    stage: "Panel interview",
    skills: ["B2B SaaS", "Discovery", "Analytics"],
    note: "Strong evidence across 8 of 9 core skills",
  },
  {
    name: "Aditya Rao",
    role: "Senior Product Manager",
    match: 86,
    stage: "Hiring manager",
    skills: ["Platform", "Roadmaps", "Fintech"],
    note: "Adjacent domain; exceptional platform depth",
  },
  {
    name: "Sana Mirza",
    role: "Senior Product Manager",
    match: 81,
    stage: "Screening",
    skills: ["Research", "Growth", "Experimentation"],
    note: "Strong discovery profile; limited enterprise exposure",
  },
];

export const onboardingTasks = [
  { team: "People Ops", task: "Verify Form F and joining documents", owner: "Isha", status: "In review" },
  { team: "IT", task: "Issue device and ERP identity", owner: "Vijay", status: "Ready" },
  { team: "Operations", task: "Complete plant safety induction", owner: "Kabir", status: "Today" },
  { team: "Manager", task: "Set 30-day outcomes and buddy", owner: "Kabir", status: "Pending" },
];

export const goals = [
  { title: "Reduce customer onboarding time", owner: "Product", progress: 78, health: "On track" },
  { title: "Improve plant quality yield", owner: "Operations", progress: 61, health: "At risk" },
  { title: "Reach 90% manager check-in rate", owner: "People", progress: 84, health: "On track" },
];

export const announcements = [
  { label: "STAR EMPLOYEE", title: "Meera Nair raised the bar", copy: "Recognised for leading the Atlas recovery with clarity and care.", tone: "lime" },
  { label: "WELCOME", title: "Meet our September cohort", copy: "Six new colleagues joined across Engineering, Plant Ops and Finance.", tone: "blue" },
  { label: "CELEBRATE", title: "Birthdays this week", copy: "Wish Aarav, Leena and Dev a brilliant year ahead.", tone: "peach" },
];
