/**
 * Demo records for the "Tata" organisation (provisioned by provision-demo.ts), so every screen has
 * something real to show. Two passes:
 *
 *  1. Direct inserts (owner role) for what has no API or has to be dated in the past: the group's
 *     companies, sites, departments, positions, the employee records with their career history,
 *     ~90 days of attendance, documents, onboarding/exits, hiring, goals, reviews, learning, skills,
 *     recognition, announcements, helpdesk tickets and statutory due dates.
 *  2. The application's own APIs, as the people who would do it, for what has a workflow: leave
 *     (apply → supervisor → HOD → HR head) and payroll (create → calculate → approve → finalise).
 *
 *   DEMO_PASSWORD=... npm run demo:seed-tata     (dev server running on DEMO_BASE_URL)
 *
 * Dates are relative to today in Asia/Kolkata, so the demo stays current whenever it is rebuilt.
 * People, identifiers and bank details are fictitious.
 */
import { config } from "dotenv";
import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { renderPdf } from "../../src/lib/documents/simple-pdf";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const TIMEZONE = "Asia/Kolkata";

/* ------------------------------------------------------------------ */
/* Dates and a repeatable random source                                */
/* ------------------------------------------------------------------ */

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const addMonths = (day: string, months: number) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
};
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`).toISOString();
const minutesToHHMM = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

let seed = 20261121;
const random = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (min: number, max: number) => Math.floor(min + random() * (max - min + 1));

/* ------------------------------------------------------------------ */
/* The group                                                           */
/* ------------------------------------------------------------------ */

type CompanyKey = "TGH" | "TEPL" | "TDSPL" | "TRPL";
const COMPANIES: Record<CompanyKey, { name: string; kind: string; industry: string; parent: CompanyKey | null; site: string }> = {
  TGH: { name: "Tata Group Holdings Limited", kind: "holding", industry: "Diversified holding", parent: null, site: "Mumbai" },
  TEPL: { name: "Tata Engineering Private Limited", kind: "subsidiary", industry: "Engineering & manufacturing", parent: "TGH", site: "Pune" },
  TDSPL: { name: "Tata Digital Services Private Limited", kind: "subsidiary", industry: "Information technology services", parent: "TGH", site: "Bengaluru" },
  TRPL: { name: "Tata Retail Private Limited", kind: "subsidiary", industry: "Retail", parent: "TGH", site: "Gurugram" },
};

const SITES: Record<string, { name: string; city: string; state: string; type: string; company: CompanyKey; pin: string; weekdays: number[] }> = {
  Mumbai: { name: "Mumbai – Group Head Office, Nariman Point", city: "Mumbai", state: "Maharashtra", type: "Head office", company: "TGH", pin: "400021", weekdays: [1, 2, 3, 4, 5] },
  Pune: { name: "Pune – Chakan Manufacturing Plant", city: "Pune", state: "Maharashtra", type: "Factory", company: "TEPL", pin: "410501", weekdays: [1, 2, 3, 4, 5, 6] },
  Bengaluru: { name: "Bengaluru – Whitefield Technology Centre", city: "Bengaluru", state: "Karnataka", type: "Technology centre", company: "TDSPL", pin: "560066", weekdays: [1, 2, 3, 4, 5] },
  Gurugram: { name: "Gurugram – Retail Head Office, Cyber City", city: "Gurugram", state: "Haryana", type: "Regional office", company: "TRPL", pin: "122002", weekdays: [1, 2, 3, 4, 5, 6] },
};

const GRADES = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"] as const;

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

type Person = {
  code: string; first: string; last: string; gender: "male" | "female"; salutation: string; dob: string;
  joined: string; company: CompanyKey; site: string; department: string; designation: string; grade: (typeof GRADES)[number];
  manager: string | null; basic: number; email: string; login?: string;
  shift?: "GENERAL" | "A" | "B"; category?: "regular" | "contract" | "trainee"; workerCategory?: string;
  married?: boolean; spouse?: string; blood: string; mobile: string; city?: string;
  passportExpiry?: string; international?: { country: string; permit: string; permitExpiry: string };
  medical?: { exam: string; fitness: string };
  exit?: { lastDay: string; reason: string; state: "settled" | "in_progress" };
  /** Earlier positions, oldest first; the record holds the current one. */
  history?: Array<{ type: string; on: string; company?: CompanyKey; site?: string; department?: string; designation?: string; grade?: string; manager?: string; reason: string }>;
  education: { level: string; degree: string; institute: string; year: number };
  previous?: { employer: string; designation: string; from: string; to: string };
  /** An earlier spell with the group: the employee left and has rejoined (a returning employee). */
  rehire?: { from: string; to: string; reason: string };
};

const yearsAgo = (years: number, extraDays = 0) => addDays(addMonths(TODAY, -12 * years), -extraDays);

/** Skills each role needs (job_profiles.attributes.required_skills): what the capability gap analysis measures against. */
const ROLE_SKILLS: Record<string, string[]> = {
  "Software Engineer": ["Java", "SQL", "Cloud (AWS)"], "Senior Software Engineer": ["Java", "Cloud (AWS)", "Python"], "QA Engineer": ["Test automation", "Python"],
  "DevOps Engineer": ["Cloud (AWS)", "Python"], "Engineering Manager": ["Stakeholder management", "Cloud (AWS)"], "Solutions Architect": ["Cloud (AWS)", "Java"],
  "Head of Engineering": ["Stakeholder management", "Cloud (AWS)"], "Product Manager": ["Stakeholder management", "SQL"], "UI/UX Designer": ["React"], "Data Analyst": ["SQL", "Python"],
  "Senior Data Engineer": ["Python", "SQL", "Cloud (AWS)"], "CNC Machine Operator": ["CNC programming", "Lean manufacturing"], "Machine Operator": ["CNC programming"],
  "Production Supervisor": ["Lean manufacturing", "Six Sigma"], "Quality Inspector": ["Six Sigma"], "Maintenance Technician": ["Lean manufacturing"], "Plant Head": ["Lean manufacturing", "Stakeholder management"],
  "Category Manager": ["Retail merchandising", "SQL"], "Store Operations Manager": ["Retail merchandising", "Stakeholder management"], "Store Manager": ["Retail merchandising", "Stakeholder management"],
  "Supply Chain Executive": ["SQL"], "Payroll Lead": ["Payroll compliance"], "Finance Executive": ["Payroll compliance", "SQL"],
};

/** Final ratings (1–5) and potential (1–3) from the closed FY 2025-26 annual review. */
const ANNUAL_RATINGS: Record<string, [number, number]> = {
  TG1002: [4, 2], TG1003: [5, 3], TG1004: [3, 2], TG1005: [4, 2], TG1006: [4, 2], TG1007: [3, 2], TG1008: [3, 1], TG1009: [3, 2], TG1010: [2, 1], TG1011: [3, 2],
  TG1012: [3, 1], TG1013: [3, 2], TG1014: [3, 2], TG1016: [4, 3], TG1017: [4, 3], TG1018: [4, 2], TG1019: [5, 3], TG1020: [3, 1], TG1021: [3, 2], TG1022: [4, 3],
  TG1023: [4, 2], TG1025: [4, 2], TG1026: [5, 3], TG1027: [5, 2], TG1028: [3, 2], TG1029: [4, 2], TG1030: [3, 1], TG1031: [4, 3],
};

export const PEOPLE: Person[] = [
  // Group head office (Mumbai)
  { code: "TG1001", first: "Sanjay", last: "Mehta", gender: "male", salutation: "mr", dob: addDays(addMonths(TODAY, -12 * 60), 110), joined: "2009-04-01", company: "TGH", site: "Mumbai", department: "Leadership", designation: "Group Chief Executive Officer", grade: "G9", manager: null, basic: 850000, email: "sanjay.mehta@tata.com", married: true, spouse: "Rekha Mehta", blood: "b_positive", mobile: "9820011001", passportExpiry: "2031-08-14", education: { level: "postgraduate", degree: "MBA", institute: "IIM Ahmedabad", year: 1990 } },
  { code: "TG1002", first: "Meera", last: "Nair", gender: "female", salutation: "ms", dob: "1974-02-11", joined: "2012-07-02", company: "TGH", site: "Mumbai", department: "Human Resources", designation: "Chief Human Resources Officer", grade: "G8", manager: "TG1001", basic: 520000, email: "meera.nair@tata.com", married: true, spouse: "Arun Nair", blood: "o_positive", mobile: "9820011002", education: { level: "postgraduate", degree: "MA, Personnel Management", institute: "TISS Mumbai", year: 1997 } },
  { code: "TG1003", first: "Kavita", last: "Desai", gender: "female", salutation: "ms", dob: "1972-09-23", joined: "2011-01-10", company: "TGH", site: "Mumbai", department: "Finance", designation: "Chief Financial Officer", grade: "G8", manager: "TG1001", basic: 560000, email: "kavita.desai@tata.com", married: true, spouse: "Nikhil Desai", blood: "a_positive", mobile: "9820011003", education: { level: "professional", degree: "Chartered Accountant", institute: "ICAI", year: 1996 } },
  { code: "TG1004", first: "Arvind", last: "Menon", gender: "male", salutation: "mr", dob: "1984-05-19", joined: "2016-03-14", company: "TGH", site: "Mumbai", department: "Human Resources", designation: "Head of People Systems", grade: "G6", manager: "TG1002", basic: 210000, email: "admin@tata.com", login: "admin@tata.com", married: true, spouse: "Lakshmi Menon", blood: "o_negative", mobile: "9820011004", education: { level: "postgraduate", degree: "MBA, Human Resources", institute: "XLRI Jamshedpur", year: 2008 }, previous: { employer: "Infosys BPM", designation: "HRIS Analyst", from: "2008-06-01", to: "2016-02-29" } },
  { code: "TG1005", first: "Priya", last: "Sharma", gender: "female", salutation: "ms", dob: "1988-12-03", joined: "2018-06-04", company: "TGH", site: "Mumbai", department: "Human Resources", designation: "HR Manager", grade: "G5", manager: "TG1002", basic: 145000, email: "hr@tata.com", login: "hr@tata.com", married: false, blood: "b_positive", mobile: "9820011005", education: { level: "postgraduate", degree: "MBA, Human Resources", institute: "Symbiosis Pune", year: 2012 }, history: [{ type: "joined", on: "2018-06-04", designation: "HR Executive", grade: "G3", reason: "Joined" }, { type: "promotion", on: "2023-07-01", reason: "Annual promotion cycle 2023" }] },
  { code: "TG1006", first: "Rakesh", last: "Gupta", gender: "male", salutation: "mr", dob: "1986-04-27", joined: "2017-09-11", company: "TGH", site: "Mumbai", department: "Finance", designation: "Payroll Lead", grade: "G5", manager: "TG1003", basic: 135000, email: "payroll@tata.com", login: "payroll@tata.com", married: true, spouse: "Sunita Gupta", blood: "ab_positive", mobile: "9820011006", education: { level: "graduate", degree: "B.Com", institute: "Narsee Monjee College", year: 2007 } },
  { code: "TG1007", first: "Neha", last: "Joshi", gender: "female", salutation: "ms", dob: "1995-08-08", joined: "2021-02-15", company: "TEPL", site: "Pune", department: "Human Resources", designation: "HR Executive", grade: "G3", manager: "TG1005", basic: 62000, email: "neha.joshi@tata.com", married: false, blood: "a_positive", mobile: "9822011007", history: [{ type: "joined", on: "2021-02-15", company: "TGH", site: "Mumbai", reason: "Joined" }, { type: "group_transfer", on: addDays(TODAY, -210), reason: "Moved to Tata Engineering to run HR at the Chakan plant" }], education: { level: "postgraduate", degree: "MBA, Human Resources", institute: "Symbiosis Pune", year: 2019 } },
  // Tata Engineering (Pune plant)
  { code: "TG1008", first: "Suresh", last: "Patil", gender: "male", salutation: "mr", dob: "1975-01-30", joined: "2010-08-02", company: "TEPL", site: "Pune", department: "Operations", designation: "Plant Head", grade: "G7", manager: "TG1001", basic: 310000, email: "suresh.patil@tata.com", married: true, spouse: "Vandana Patil", blood: "o_positive", mobile: "9822011008", medical: { exam: addMonths(TODAY, -5), fitness: "Fit" }, education: { level: "graduate", degree: "B.E. Mechanical", institute: "COEP Pune", year: 1996 } },
  { code: "TG1009", first: "Mahesh", last: "Jadhav", gender: "male", salutation: "mr", dob: "1982-06-14", joined: "2013-11-18", company: "TEPL", site: "Pune", department: "Production", designation: "Production Supervisor", grade: "G4", manager: "TG1008", basic: 72000, email: "mahesh.jadhav@tata.com", shift: "A", married: true, spouse: "Kalpana Jadhav", blood: "b_negative", mobile: "9822011009", medical: { exam: addDays(addMonths(TODAY, -12), 15), fitness: "Fit" }, education: { level: "diploma", degree: "Diploma, Production Engineering", institute: "Government Polytechnic Pune", year: 2002 } },
  { code: "TG1010", first: "Ganesh", last: "Shinde", gender: "male", salutation: "mr", dob: "1990-03-21", joined: "2015-04-06", company: "TEPL", site: "Pune", department: "Production", designation: "CNC Machine Operator", grade: "G2", manager: "TG1009", basic: 21000, email: "ganesh.shinde@tata.com", shift: "A", category: "regular", workerCategory: "PERM", married: true, spouse: "Manisha Shinde", blood: "o_positive", mobile: "9822011010", medical: { exam: addMonths(TODAY, -13), fitness: "Fit" }, education: { level: "iti", degree: "ITI, Machinist", institute: "ITI Aundh", year: 2009 } },
  { code: "TG1011", first: "Rahul", last: "Pawar", gender: "male", salutation: "mr", dob: "1993-10-02", joined: "2018-01-08", company: "TEPL", site: "Pune", department: "Production", designation: "CNC Machine Operator", grade: "G2", manager: "TG1009", basic: 19500, email: "rahul.pawar@tata.com", shift: "B", married: false, blood: "a_positive", mobile: "9822011011", medical: { exam: addMonths(TODAY, -4), fitness: "Fit" }, education: { level: "iti", degree: "ITI, Fitter", institute: "ITI Pimpri", year: 2012 } },
  { code: "TG1012", first: "Amit", last: "Kale", gender: "male", salutation: "mr", dob: "1989-12-12", joined: "2016-09-19", company: "TEPL", site: "Pune", department: "Maintenance", designation: "Maintenance Technician", grade: "G3", manager: "TG1008", basic: 34000, email: "amit.kale@tata.com", shift: "B", married: true, spouse: "Sneha Kale", blood: "b_positive", mobile: "9822011012", medical: { exam: addMonths(TODAY, -2), fitness: "Pending" }, education: { level: "diploma", degree: "Diploma, Electrical Engineering", institute: "Government Polytechnic Pune", year: 2009 } },
  { code: "TG1013", first: "Pooja", last: "More", gender: "female", salutation: "ms", dob: "1994-07-17", joined: "2019-03-11", company: "TEPL", site: "Pune", department: "Quality", designation: "Quality Inspector", grade: "G3", manager: "TG1008", basic: 38000, email: "pooja.more@tata.com", married: false, blood: "o_positive", mobile: "9822011013", history: [{ type: "joined", on: "2019-03-11", designation: "Quality Assistant", grade: "G2", reason: "Joined" }, { type: "promotion", on: addDays(TODAY, -45), reason: "Promoted after the first-pass-yield improvement" }], medical: { exam: addMonths(TODAY, -7), fitness: "Fit" }, education: { level: "graduate", degree: "B.Sc. Physics", institute: "Fergusson College", year: 2015 } },
  { code: "TG1014", first: "Deepak", last: "Chavan", gender: "male", salutation: "mr", dob: "1985-11-05", joined: "2014-06-23", company: "TEPL", site: "Pune", department: "EHS", designation: "Safety Officer", grade: "G4", manager: "TG1008", basic: 68000, email: "deepak.chavan@tata.com", married: true, spouse: "Priyanka Chavan", blood: "a_negative", mobile: "9822011014", medical: { exam: addMonths(TODAY, -3), fitness: "Fit" }, education: { level: "diploma", degree: "Diploma, Industrial Safety", institute: "RLI Mumbai", year: 2008 } },
  { code: "TG1015", first: "Sunil", last: "Gaikwad", gender: "male", salutation: "mr", dob: "2001-02-25", joined: addDays(TODAY, -65), company: "TEPL", site: "Pune", department: "Stores", designation: "Stores Assistant", grade: "G1", manager: "TG1009", basic: 17000, email: "sunil.gaikwad@tata.com", shift: "A", category: "trainee", workerCategory: "TRAINEE_DET", married: false, blood: "b_positive", mobile: "9822011015", medical: { exam: addDays(TODAY, -70), fitness: "Fit" }, education: { level: "iti", degree: "ITI, Store Keeping", institute: "ITI Chinchwad", year: 2022 } },
  // Tata Digital (Bengaluru)
  { code: "TG1016", first: "Karthik", last: "Reddy", gender: "male", salutation: "mr", dob: "1979-04-09", joined: "2014-02-03", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Head of Engineering", grade: "G7", manager: "TG1001", basic: 380000, email: "karthik.reddy@tata.com", married: true, spouse: "Divya Reddy", blood: "o_positive", mobile: "9845011016", passportExpiry: "2029-03-30", education: { level: "postgraduate", degree: "M.Tech, Computer Science", institute: "IIT Madras", year: 2002 } },
  { code: "TG1017", first: "Vikram", last: "Rao", gender: "male", salutation: "mr", dob: "1987-01-16", joined: "2015-07-13", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Engineering Manager", grade: "G6", manager: "TG1016", basic: 225000, email: "manager@tata.com", login: "manager@tata.com", married: true, spouse: "Anjali Rao", blood: "a_positive", mobile: "9845011017", education: { level: "graduate", degree: "B.Tech, Computer Science", institute: "NIT Surathkal", year: 2008 }, history: [{ type: "joined", on: "2015-07-13", designation: "Senior Software Engineer", grade: "G4", reason: "Joined" }, { type: "promotion", on: "2019-04-01", designation: "Technical Lead", grade: "G5", reason: "Annual promotion cycle 2019" }, { type: "promotion", on: "2022-10-01", reason: "Took over the platform engineering team" }] },
  { code: "TG1018", first: "Ananya", last: "Iyer", gender: "female", salutation: "ms", dob: "1997-03-28", joined: "2020-08-17", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Software Engineer", grade: "G3", manager: "TG1017", basic: 95000, email: "emp1@tata.com", login: "emp1@tata.com", married: false, blood: "b_positive", mobile: "9845011018", passportExpiry: addDays(TODAY, 70), education: { level: "graduate", degree: "B.E., Information Science", institute: "RV College of Engineering", year: 2019 } },
  { code: "TG1019", first: "Rohit", last: "Verma", gender: "male", salutation: "mr", dob: "1992-10-21", joined: "2017-05-22", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Senior Software Engineer", grade: "G4", manager: "TG1017", basic: 135000, email: "emp2@tata.com", login: "emp2@tata.com", married: true, spouse: "Pallavi Verma", blood: "o_positive", mobile: "9845011019", passportExpiry: "2030-01-12", education: { level: "graduate", degree: "B.Tech, Computer Science", institute: "VIT Vellore", year: 2014 }, previous: { employer: "Wipro Technologies", designation: "Software Engineer", from: "2014-07-01", to: "2017-05-12" }, history: [{ type: "joined", on: "2017-05-22", designation: "Software Engineer", grade: "G3", reason: "Joined" }, { type: "promotion", on: "2024-04-01", reason: "Annual promotion cycle 2024" }] },
  { code: "TG1020", first: "Sneha", last: "Kulkarni", gender: "female", salutation: "ms", dob: "1996-06-30", joined: "2021-09-06", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "QA Engineer", grade: "G3", manager: "TG1017", basic: 82000, email: "emp3@tata.com", login: "emp3@tata.com", married: false, blood: "a_positive", mobile: "9845011020", education: { level: "graduate", degree: "B.E., Electronics", institute: "PES University", year: 2018 } },
  { code: "TG1021", first: "Arjun", last: "Nambiar", gender: "male", salutation: "mr", dob: "1994-12-01", joined: "2022-01-17", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "DevOps Engineer", grade: "G4", manager: "TG1017", basic: 118000, email: "arjun.nambiar@tata.com", married: false, blood: "b_negative", mobile: "9845011021", history: [{ type: "joined", on: "2022-01-17", designation: "Software Engineer", grade: "G3", reason: "Joined" }, { type: "promotion", on: addDays(TODAY, -100), reason: "Promoted to DevOps Engineer after leading the cloud cost programme" }], education: { level: "graduate", degree: "B.Tech, Information Technology", institute: "CET Thiruvananthapuram", year: 2016 } },
  { code: "TG1022", first: "Divya", last: "Krishnan", gender: "female", salutation: "ms", dob: "1990-09-14", joined: "2019-11-04", company: "TDSPL", site: "Bengaluru", department: "Product", designation: "Product Manager", grade: "G5", manager: "TG1016", basic: 185000, email: "divya.krishnan@tata.com", married: true, spouse: "Hari Krishnan", blood: "o_positive", mobile: "9845011022", passportExpiry: addDays(TODAY, 20), education: { level: "postgraduate", degree: "MBA", institute: "IIM Bangalore", year: 2015 } },
  { code: "TG1023", first: "Daniel", last: "Fischer", gender: "male", salutation: "mr", dob: "1985-02-18", joined: "2023-03-01", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Solutions Architect", grade: "G6", manager: "TG1016", basic: 260000, email: "daniel.fischer@tata.com", married: true, spouse: "Anna Fischer", blood: "a_positive", mobile: "9845011023", passportExpiry: "2032-05-09", international: { country: "Germany", permit: "EMP-BLR-2023-04417", permitExpiry: addDays(TODAY, 45) }, education: { level: "postgraduate", degree: "M.Sc., Computer Science", institute: "TU Munich", year: 2010 } },
  { code: "TG1024", first: "Farhan", last: "Sheikh", gender: "male", salutation: "mr", dob: "1998-05-06", joined: addDays(TODAY, -20), company: "TDSPL", site: "Bengaluru", department: "Product", designation: "UI/UX Designer", grade: "G3", manager: "TG1022", basic: 88000, email: "farhan.sheikh@tata.com", married: false, blood: "b_positive", mobile: "9845011024", education: { level: "graduate", degree: "B.Des., Interaction Design", institute: "NID Bengaluru", year: 2020 }, previous: { employer: "Swiggy", designation: "Product Designer", from: "2020-07-01", to: addDays(TODAY, -35) } },
  // Tata Retail (Gurugram)
  { code: "TG1025", first: "Rajiv", last: "Malhotra", gender: "male", salutation: "mr", dob: "1977-08-29", joined: "2013-04-15", company: "TRPL", site: "Gurugram", department: "Retail Operations", designation: "Head of Retail Operations", grade: "G7", manager: "TG1001", basic: 330000, email: "rajiv.malhotra@tata.com", married: true, spouse: "Shalini Malhotra", blood: "o_positive", mobile: "9810011025", education: { level: "postgraduate", degree: "MBA, Marketing", institute: "FMS Delhi", year: 2001 } },
  { code: "TG1026", first: "Simran", last: "Kaur", gender: "female", salutation: "ms", dob: "1989-03-15", joined: "2017-10-09", company: "TRPL", site: "Gurugram", department: "Retail Operations", designation: "Store Operations Manager", grade: "G5", manager: "TG1025", basic: 120000, email: "simran.kaur@tata.com", married: true, spouse: "Harpreet Singh", blood: "b_positive", mobile: "9810011026", education: { level: "postgraduate", degree: "MBA, Retail Management", institute: "Amity University", year: 2012 } },
  { code: "TG1027", first: "Aditya", last: "Sharma", gender: "male", salutation: "mr", dob: "1991-07-07", joined: "2020-01-20", company: "TRPL", site: "Gurugram", department: "Merchandising", designation: "Category Manager", grade: "G5", manager: "TG1025", basic: 128000, email: "aditya.sharma@tata.com", married: false, blood: "a_positive", mobile: "9810011027", history: [{ type: "joined", on: "2020-01-20", designation: "Assistant Category Manager", grade: "G4", reason: "Joined" }, { type: "promotion", on: addDays(TODAY, -250), reason: "Promoted to own the private-label category" }], education: { level: "postgraduate", degree: "MBA", institute: "MDI Gurgaon", year: 2015 } },
  { code: "TG1028", first: "Nisha", last: "Bansal", gender: "female", salutation: "ms", dob: "1995-11-23", joined: "2022-06-13", company: "TRPL", site: "Gurugram", department: "Customer Experience", designation: "Customer Experience Lead", grade: "G4", manager: "TG1026", basic: 76000, email: "nisha.bansal@tata.com", married: false, blood: "o_negative", mobile: "9810011028", history: [{ type: "joined", on: "2022-06-13", designation: "Customer Experience Associate", grade: "G2", reason: "Joined" }, { type: "promotion", on: addDays(TODAY, -160), reason: "Promoted to lead the Gurugram service desk" }], education: { level: "graduate", degree: "BBA", institute: "Delhi University", year: 2017 } },
  { code: "TG1029", first: "Manoj", last: "Yadav", gender: "male", salutation: "mr", dob: "1993-04-04", joined: "2022-02-07", company: "TRPL", site: "Gurugram", department: "Supply Chain", designation: "Supply Chain Executive", grade: "G3", manager: "TG1025", basic: 54000, email: "manoj.yadav@tata.com", married: true, spouse: "Pinki Yadav", blood: "b_positive", mobile: "9810011029", education: { level: "graduate", degree: "B.Com", institute: "Pune University", year: 2014 }, history: [{ type: "joined", on: "2022-02-07", company: "TEPL", site: "Pune", department: "Stores", designation: "Stores Executive", grade: "G2", manager: "TG1009", reason: "Joined" }, { type: "group_transfer", on: "2025-06-02", reason: "Moved to Tata Retail to set up the north-India distribution hub" }] },
  { code: "TG1030", first: "Ritu", last: "Arora", gender: "female", salutation: "ms", dob: "1992-01-19", joined: "2019-08-26", company: "TRPL", site: "Gurugram", department: "Finance", designation: "Finance Executive", grade: "G3", manager: "TG1003", basic: 58000, email: "ritu.arora@tata.com", married: true, spouse: "Saurabh Arora", blood: "ab_negative", mobile: "9810011030", education: { level: "professional", degree: "CA Intermediate, B.Com", institute: "Delhi University", year: 2013 } },
  { code: "TG1031", first: "Harsh", last: "Vardhan", gender: "male", salutation: "mr", dob: "1996-09-09", joined: "2023-01-09", company: "TRPL", site: "Gurugram", department: "Retail Operations", designation: "Store Supervisor", grade: "G2", manager: "TG1026", basic: 36000, email: "harsh.vardhan@tata.com", married: false, blood: "o_positive", mobile: "9810011031", exit: { lastDay: addDays(TODAY, 15), reason: "Resigned: higher studies", state: "in_progress" }, education: { level: "graduate", degree: "B.A.", institute: "Kurukshetra University", year: 2018 } },
  // Left in the last year
  { code: "TG1032", first: "Varun", last: "Kapoor", gender: "male", salutation: "mr", dob: "1995-05-12", joined: "2021-04-05", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Software Engineer", grade: "G3", manager: "TG1017", basic: 92000, email: "varun.kapoor@tata.com", married: false, blood: "b_positive", mobile: "9845011032", exit: { lastDay: addDays(TODAY, -62), reason: "Resigned: relocating abroad", state: "settled" }, education: { level: "graduate", degree: "B.Tech, Computer Science", institute: "Manipal Institute of Technology", year: 2017 } },
  { code: "TG1033", first: "Swati", last: "Deshmukh", gender: "female", salutation: "ms", dob: "1993-08-03", joined: "2018-07-16", company: "TEPL", site: "Pune", department: "Quality", designation: "Quality Inspector", grade: "G3", manager: "TG1008", basic: 37000, email: "swati.deshmukh@tata.com", married: true, spouse: "Ajay Deshmukh", blood: "a_positive", mobile: "9822011033", exit: { lastDay: addDays(TODAY, -150), reason: "Resigned: family relocation", state: "settled" }, medical: { exam: addMonths(TODAY, -15), fitness: "Fit" }, education: { level: "graduate", degree: "B.Sc. Chemistry", institute: "Fergusson College", year: 2014 } },
  // Joining soon
  // Joined in the last year (TG1039 is returning after an earlier spell with the group)
  { code: "TG1035", first: "Kiran", last: "Patel", gender: "female", salutation: "ms", dob: "1998-04-22", joined: addDays(TODAY, -300), company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Software Engineer", grade: "G3", manager: "TG1017", basic: 90000, email: "kiran.patel@tata.com", married: false, blood: "b_positive", mobile: "9845011035", education: { level: "graduate", degree: "B.Tech, Computer Science", institute: "BMS College of Engineering", year: 2020 }, previous: { employer: "Flipkart", designation: "Software Engineer", from: "2020-07-01", to: addDays(TODAY, -310) } },
  { code: "TG1036", first: "Imran", last: "Qureshi", gender: "male", salutation: "mr", dob: "1999-01-30", joined: addDays(TODAY, -235), company: "TRPL", site: "Gurugram", department: "Customer Experience", designation: "Customer Experience Associate", grade: "G2", manager: "TG1028", basic: 32000, email: "imran.qureshi@tata.com", married: false, blood: "o_positive", mobile: "9810011036", education: { level: "graduate", degree: "BBA", institute: "GGSIPU Delhi", year: 2021 } },
  { code: "TG1037", first: "Ritika", last: "Sen", gender: "female", salutation: "ms", dob: "1997-06-11", joined: addDays(TODAY, -120), company: "TEPL", site: "Pune", department: "Quality", designation: "Quality Inspector", grade: "G3", manager: "TG1008", basic: 36000, email: "ritika.sen@tata.com", married: false, blood: "a_positive", mobile: "9822011037", medical: { exam: addDays(TODAY, -125), fitness: "Fit" }, education: { level: "graduate", degree: "B.Sc. Chemistry", institute: "Modern College Pune", year: 2018 } },
  { code: "TG1038", first: "Nikhil", last: "Bhosale", gender: "male", salutation: "mr", dob: "2000-09-05", joined: addDays(TODAY, -95), company: "TEPL", site: "Pune", department: "Production", designation: "CNC Machine Operator", grade: "G2", manager: "TG1009", basic: 20000, email: "nikhil.bhosale@tata.com", shift: "A", married: false, blood: "b_positive", mobile: "9822011038", medical: { exam: addDays(TODAY, -100), fitness: "Fit" }, education: { level: "iti", degree: "ITI, Machinist", institute: "ITI Aundh", year: 2019 } },
  { code: "TG1039", first: "Sameer", last: "Khan", gender: "male", salutation: "mr", dob: "1990-11-17", joined: addDays(TODAY, -140), company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Senior Software Engineer", grade: "G4", manager: "TG1017", basic: 140000, email: "sameer.khan@tata.com", married: true, spouse: "Zoya Khan", blood: "a_positive", mobile: "9845011039", rehire: { from: "2017-08-01", to: "2022-03-31", reason: "Resigned: startup venture" }, education: { level: "graduate", degree: "B.E., Computer Science", institute: "MS Ramaiah Institute of Technology", year: 2012 } },
  { code: "TG1040", first: "Farah", last: "Ali", gender: "female", salutation: "ms", dob: "1996-02-08", joined: addDays(TODAY, -45), company: "TGH", site: "Mumbai", department: "Finance", designation: "Finance Executive", grade: "G3", manager: "TG1003", basic: 60000, email: "farah.ali@tata.com", married: false, blood: "o_positive", mobile: "9820011040", education: { level: "professional", degree: "CA Intermediate, B.Com", institute: "HR College Mumbai", year: 2018 } },
  // Left in the last year: retirement, end of contract, resignations and a termination
  { code: "TG1041", first: "Prakash", last: "Kulkarni", gender: "male", salutation: "mr", dob: addDays(addMonths(TODAY, -12 * 60), -95), joined: "1998-06-01", company: "TEPL", site: "Pune", department: "Production", designation: "Senior Machine Operator", grade: "G3", manager: "TG1009", basic: 42000, email: "prakash.kulkarni@tata.com", shift: "B", married: true, spouse: "Shobha Kulkarni", blood: "o_positive", mobile: "9822011041", exit: { lastDay: addDays(TODAY, -95), reason: "Retirement on superannuation", state: "settled" }, education: { level: "iti", degree: "ITI, Turner", institute: "ITI Pune", year: 1985 } },
  { code: "TG1042", first: "Rohan", last: "Mehra", gender: "male", salutation: "mr", dob: "2001-03-14", joined: addDays(TODAY, -405), company: "TRPL", site: "Gurugram", department: "Retail Operations", designation: "Store Associate", grade: "G1", manager: "TG1026", basic: 22000, email: "rohan.mehra@tata.com", category: "contract", married: false, blood: "b_positive", mobile: "9810011042", exit: { lastDay: addDays(TODAY, -40), reason: "End of contract: fixed-term store contract completed", state: "settled" }, education: { level: "graduate", degree: "B.A.", institute: "Delhi University", year: 2022 } },
  { code: "TG1043", first: "Aisha", last: "Siddiqui", gender: "female", salutation: "ms", dob: "1997-07-25", joined: "2023-05-02", company: "TRPL", site: "Gurugram", department: "Customer Experience", designation: "Customer Experience Associate", grade: "G2", manager: "TG1028", basic: 31000, email: "aisha.siddiqui@tata.com", married: false, blood: "a_negative", mobile: "9810011043", exit: { lastDay: addDays(TODAY, -200), reason: "Resigned: better opportunity", state: "settled" }, education: { level: "graduate", degree: "B.Com", institute: "Jamia Millia Islamia", year: 2019 } },
  { code: "TG1044", first: "Gaurav", last: "Joshi", gender: "male", salutation: "mr", dob: "1992-12-19", joined: "2020-03-02", company: "TGH", site: "Mumbai", department: "Finance", designation: "Accounts Executive", grade: "G3", manager: "TG1003", basic: 56000, email: "gaurav.joshi@tata.com", married: true, spouse: "Ketki Joshi", blood: "b_positive", mobile: "9820011044", exit: { lastDay: addDays(TODAY, -120), reason: "Resigned: career change", state: "settled" }, education: { level: "graduate", degree: "B.Com", institute: "Mithibai College", year: 2013 } },
  { code: "TG1045", first: "Siddharth", last: "Nair", gender: "male", salutation: "mr", dob: "1996-04-03", joined: "2022-07-11", company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Software Engineer", grade: "G3", manager: "TG1017", basic: 88000, email: "siddharth.nair@tata.com", married: false, blood: "o_positive", mobile: "9845011045", exit: { lastDay: addDays(TODAY, -280), reason: "Resigned: higher pay elsewhere", state: "settled" }, education: { level: "graduate", degree: "B.Tech, Information Technology", institute: "NIT Calicut", year: 2018 } },
  { code: "TG1046", first: "Kunal", last: "Deshpande", gender: "male", salutation: "mr", dob: "1991-08-28", joined: "2019-02-04", company: "TEPL", site: "Pune", department: "Maintenance", designation: "Maintenance Technician", grade: "G3", manager: "TG1008", basic: 33000, email: "kunal.deshpande@tata.com", shift: "A", married: true, spouse: "Rupali Deshpande", blood: "b_negative", mobile: "9822011046", exit: { lastDay: addDays(TODAY, -25), reason: "Terminated: prolonged unauthorised absence", state: "settled" }, education: { level: "diploma", degree: "Diploma, Mechanical Engineering", institute: "Government Polytechnic Pune", year: 2011 } },
  // Left in the year before: the comparison period for attrition
  { code: "TG1047", first: "Vandana", last: "Shetty", gender: "female", salutation: "ms", dob: "1994-10-10", joined: "2021-10-04", company: "TDSPL", site: "Bengaluru", department: "Product", designation: "Product Analyst", grade: "G3", manager: "TG1022", basic: 84000, email: "vandana.shetty@tata.com", married: true, spouse: "Rakesh Shetty", blood: "a_positive", mobile: "9845011047", exit: { lastDay: addDays(TODAY, -430), reason: "Resigned: relocation", state: "settled" }, education: { level: "graduate", degree: "B.E., Information Science", institute: "NMIT Bengaluru", year: 2016 } },
  { code: "TG1048", first: "Deepika", last: "Chauhan", gender: "female", salutation: "ms", dob: "1998-02-02", joined: "2022-11-14", company: "TRPL", site: "Gurugram", department: "Retail Operations", designation: "Store Associate", grade: "G1", manager: "TG1026", basic: 21000, email: "deepika.chauhan@tata.com", married: false, blood: "o_positive", mobile: "9810011048", exit: { lastDay: addDays(TODAY, -520), reason: "Resigned: higher studies", state: "settled" }, education: { level: "graduate", degree: "B.Com", institute: "Delhi University", year: 2020 } },
  { code: "TG1034", first: "Tanvi", last: "Rao", gender: "female", salutation: "ms", dob: "1999-12-14", joined: addDays(TODAY, 10), company: "TDSPL", site: "Bengaluru", department: "Engineering", designation: "Data Analyst", grade: "G3", manager: "TG1017", basic: 78000, email: "tanvi.rao@tata.com", married: false, blood: "o_positive", mobile: "9845011034", education: { level: "postgraduate", degree: "M.Sc., Statistics", institute: "Christ University", year: 2024 } },
];

const byCode = new Map(PEOPLE.map((person) => [person.code, person]));
const active = (person: Person) => !person.exit || person.exit.state !== "settled";
const name = (person: Person) => `${person.first} ${person.last}`;
const gradeLevel = (grade: string) => Number(grade.slice(1));

/** Fictitious but well-formed identifiers. */
function identifiers(person: Person, index: number) {
  const letters = (person.last.toUpperCase() + "XXXXX").replace(/[^A-Z]/g, "");
  const pan = `${"ABCDE"[index % 5]}${"PQRST"[index % 5]}${"LMNOP"[(index + 2) % 5]}P${letters[0]}${String(1000 + index * 37).slice(-4)}${"ABCDEFGHJK"[index % 10]}`;
  return {
    pan,
    aadhaar: `${4000 + index * 11}${String(5000 + index * 73).padStart(4, "0")}${String(1000 + index * 19).slice(-4)}`.slice(0, 12),
    uan: String(100800000000 + index * 104729),
    account: String(50100000000000 + index * 7919).slice(0, 14),
    ifsc: { Mumbai: "HDFC0000060", Pune: "HDFC0000116", Bengaluru: "ICIC0000202", Gurugram: "SBIN0004567" }[person.site] ?? "HDFC0000060",
    bank: { Mumbai: "HDFC Bank", Pune: "HDFC Bank", Bengaluru: "ICICI Bank", Gurugram: "State Bank of India" }[person.site] ?? "HDFC Bank",
    branch: { Mumbai: "Nariman Point", Pune: "Chakan MIDC", Bengaluru: "Whitefield", Gurugram: "Cyber City" }[person.site] ?? "",
  };
}

/** What the employee form stores on the record (employees.metadata). */
function profile(person: Person, index: number, managerName: string | null) {
  const ids = identifiers(person, index);
  const site = SITES[person.site]!;
  const esiEligible = person.basic <= 21000;
  return {
    employeeCode: person.code, salutation: person.salutation, firstName: person.first, lastName: person.last,
    fullName: name(person), fullLegalName: name(person), nameAsPerBank: name(person).toUpperCase(),
    gender: person.gender, dateOfBirth: person.dob, bloodGroup: person.blood, nationality: person.international ? person.international.country : "Indian",
    maritalStatus: person.married ? "married" : "single",
    ...(person.married ? { spouseName: person.spouse, marriageDate: addMonths(person.dob, 12 * 27) } : {}),
    mobile: `+91 ${person.mobile}`, personalEmail: `${person.first.toLowerCase()}.${person.last.toLowerCase()}@gmail.com`, officialEmail: person.email,
    presentAddr1: `Flat ${100 + index}, ${["Sunrise Residency", "Green Acres", "Lake View Towers", "Palm Grove"][index % 4]}`,
    presentCity: site.city, presentDistrict: site.city, presentState: site.state, presentPin: site.pin, presentCountry: "India", permanentSameAsPresent: true,
    emergencyName: person.spouse ?? `${["Ramesh", "Sunita", "Mohan", "Lata"][index % 4]} ${person.last}`,
    emergencyRelation: person.married ? "spouse" : index % 2 ? "father" : "mother", emergencyPhone: `+91 98${String(10000000 + index * 3571).slice(0, 8)}`,
    panToken: ids.pan, aadhaarToken: ids.aadhaar, aadhaarLast4: ids.aadhaar.slice(-4), uan: ids.uan,
    ...(esiEligible ? { esiIp: `3100000000${String(1000000 + index * 9973).padStart(7, "0")}` } : {}),
    ...(person.passportExpiry ? { passportToken: `${person.international ? "C" : "Z"}${String(4100000 + index * 731).slice(0, 7)}`, passportExpiry: person.passportExpiry } : {}),
    isInternationalWorker: Boolean(person.international),
    ...(person.international ? { countryOfOrigin: person.international.country, workPermitNo: person.international.permit, workPermitExpiry: person.international.permitExpiry } : {}),
    bankName: ids.bank, bankBranch: ids.branch, accountToken: ids.account, ifsc: ids.ifsc, accountType: "Salary", paymentMode: "Bank Transfer",
    education: [{ level: person.education.level, degree: person.education.degree, institute: person.education.institute, passingYear: String(person.education.year), isHighest: true }],
    experience: person.previous ? [{ employer: person.previous.employer, designation: person.previous.designation, fromDate: person.previous.from, toDate: person.previous.to, reasonForLeaving: "Career growth" }] : [],
    dependants: [], nominees: [],
    designation: person.designation, department: person.department, location: person.site, joiningDate: person.joined,
    manager: managerName ?? "", workerClass: person.category === "trainee" ? "apprentice" : person.site === "Pune" && gradeLevel(person.grade) <= 3 ? "workman_permanent" : "staff_monthly",
    workerCategory: person.workerCategory ?? (person.category === "trainee" ? "TRAINEE_DET" : "PERM"),
    status: person.exit?.state === "settled" ? "Inactive" : person.exit ? "Notice" : "Active",
    assignedShift: person.shift ?? "GENERAL", otEligibility: person.site === "Pune" && gradeLevel(person.grade) <= 3 ? "ALL_DAYS" : "NONE",
    salaryLocationScope: person.site === "Pune" ? "PLANT" : "HO", hasRestDays: true, effectiveFrom: person.joined,
    ...(person.medical ? { medicalExamDate: person.medical.exam, fitnessStatus: person.medical.fitness, safetyInductionDate: person.joined } : {}),
    biometricEnrolId: `BIO-${person.code}`, accessCardNo: `AC-${person.code.slice(2)}`,
  };
}

/* ------------------------------------------------------------------ */
/* SQL helpers                                                         */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;
async function insert(client: PoolClient, table: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  // Every column any row names; a row without it gets the column default.
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const chunk = Math.max(1, Math.floor(30000 / columns.length));
  for (let start = 0; start < rows.length; start += chunk) {
    const slice = rows.slice(start, start + chunk);
    const values: unknown[] = [];
    const tuples = slice.map((row) => `(${columns.map((column) => {
      if (!(column in row)) return "default";
      const value = row[column];
      values.push(value !== null && typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value);
      return `$${values.length}`;
    }).join(", ")})`);
    await client.query(`insert into ${table} (${columns.map((column) => `"${column}"`).join(", ")}) values ${tuples.join(", ")}`, values);
  }
}

/* ------------------------------------------------------------------ */
/* Pass 1: records                                                     */
/* ------------------------------------------------------------------ */

type Leave = { code: string; type: "EL" | "CL" | "SL"; from: string; to: string; days: number; reason: string; outcome: "approved" | "pending" | "rejected" };

function workdays(person: Person, from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) if (SITES[person.site]!.weekdays.includes(weekday(day))) days.push(day);
  return days;
}

/** Leave over the last ~3 months and the coming weeks, decided later through the leave API. */
function planLeave(): Leave[] {
  const reasons: Record<Leave["type"], string[]> = {
    EL: ["Family wedding in Jaipur", "Annual family vacation", "Personal work at home town", "Travel to Kerala with family"],
    CL: ["Personal errand", "Bank and property paperwork", "Child's school event", "Home maintenance visit"],
    SL: ["Viral fever", "Dental procedure", "Migraine", "Medical check-up"],
  };
  const plan: Leave[] = [];
  for (const person of PEOPLE) {
    // Leave of HR, the manager and the admin would need a fourth approver: their own requests are left out.
    if (!active(person) || person.joined > addDays(TODAY, -30) || ["TG1004", "TG1005", "TG1017"].includes(person.code)) continue;
    const count = between(2, 3);
    for (let i = 0; i < count; i += 1) {
      const type = (["EL", "CL", "SL"] as const)[between(0, 2)]!;
      const length = type === "EL" ? between(2, 4) : 1;
      const days = workdays(person, addDays(TODAY, -170), addDays(TODAY, -3));
      const startIndex = between(0, Math.max(0, days.length - length - 1));
      const span = days.slice(startIndex, startIndex + length);
      if (span.length === 0 || plan.some((leave) => leave.code === person.code && !(span[span.length - 1]! < leave.from || span[0]! > leave.to))) continue;
      plan.push({ code: person.code, type, from: span[0]!, to: span[span.length - 1]!, days: span.length, reason: reasons[type][between(0, 3)]!, outcome: "approved" });
    }
  }
  // On leave today and coming up (approved), waiting for approval, and one declined.
  const ahead = (code: string, type: Leave["type"], startIn: number, length: number, reason: string, outcome: Leave["outcome"]) => {
    const person = byCode.get(code)!;
    const span = workdays(person, addDays(TODAY, startIn), addDays(TODAY, startIn + length + 4)).slice(0, length);
    plan.push({ code, type, from: span[0]!, to: span[span.length - 1]!, days: span.length, reason, outcome });
  };
  ahead("TG1013", "SL", 0, 2, "Recovering from a sprained ankle", "approved");
  ahead("TG1027", "EL", -1, 3, "Sister's wedding in Amritsar", "approved");
  ahead("TG1021", "EL", 6, 4, "Trip to Coorg with family", "approved");
  ahead("TG1011", "CL", 3, 1, "Village panchayat meeting", "approved");
  ahead("TG1018", "EL", 12, 3, "Attending a friend's wedding in Chennai", "pending");
  ahead("TG1019", "CL", 4, 1, "Car service and RTO work", "pending");
  ahead("TG1028", "EL", 9, 2, "Family function in Ludhiana", "pending");
  ahead("TG1012", "SL", 1, 1, "Scheduled dental surgery", "pending");
  ahead("TG1020", "EL", 20, 5, "Year-end vacation", "rejected");
  return plan;
}

async function seedRecords(client: PoolClient, tenantId: string, leavePlan: Leave[]) {
  const ids = new Map<string, string>();
  const id = (key: string) => { if (!ids.has(key)) ids.set(key, randomUUID()); return ids.get(key)!; };
  const [{ id: jurisdictionId }] = (await client.query(`select j.id from jurisdictions j join countries c on c.id = j.country_id where c.iso_code = 'IN' limit 1`)).rows;

  // Companies (group structure), sites, business units, departments, grades, cost centres
  await insert(client, "legal_entities", (Object.keys(COMPANIES) as CompanyKey[]).map((key) => ({
    id: id(`le:${key}`), tenant_id: tenantId, jurisdiction_id: jurisdictionId, code: key, legal_name: COMPANIES[key].name, currency_code: "INR", status: "active",
    parent_legal_entity_id: COMPANIES[key].parent ? id(`le:${COMPANIES[key].parent}`) : null, entity_kind: COMPANIES[key].kind, industry: COMPANIES[key].industry,
    attributes: { registered_city: SITES[COMPANIES[key].site]!.city },
  })));
  await insert(client, "establishments", Object.entries(SITES).map(([code, site]) => ({
    id: id(`est:${code}`), tenant_id: tenantId, jurisdiction_id: jurisdictionId, legal_entity_id: id(`le:${site.company}`),
    attributes: { code: `EST-${code.toUpperCase()}`, name: site.name, type: site.type, city: site.city, state: site.state },
  })));
  await insert(client, "locations", Object.entries(SITES).map(([code, site]) => ({
    id: id(`loc:${code}`), tenant_id: tenantId, establishment_id: id(`est:${code}`),
    attributes: { code, name: site.name, city: site.city, state: site.state, establishment_type: site.type, pin: site.pin, status: "active" },
  })));
  await insert(client, "business_units", (Object.keys(COMPANIES) as CompanyKey[]).map((key) => ({
    id: id(`bu:${key}`), tenant_id: tenantId, legal_entity_id: id(`le:${key}`), attributes: { code: `BU-${key}`, name: COMPANIES[key].name.replace(/ (Private )?Limited$/, "") },
  })));
  const departments = [...new Set(PEOPLE.map((person) => `${person.company}|${person.department}`))];
  await insert(client, "departments", departments.map((key) => {
    const [company, department] = key.split("|") as [CompanyKey, string];
    return { id: id(`dep:${key}`), tenant_id: tenantId, business_unit_id: id(`bu:${company}`), attributes: { code: `${company}-${department.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase()}`, name: department } };
  }));
  await insert(client, "grades", GRADES.map((grade) => ({ id: id(`grade:${grade}`), tenant_id: tenantId, attributes: { code: grade, name: `Grade ${grade.slice(1)}`, level: gradeLevel(grade) } })));
  await insert(client, "cost_centers", (Object.keys(COMPANIES) as CompanyKey[]).map((key) => ({ id: id(`cc:${key}`), tenant_id: tenantId, legal_entity_id: id(`le:${key}`), attributes: { code: `CC-${key}`, name: `${COMPANIES[key].name.replace(/ (Private )?Limited$/, "")} – overheads` } })));
  await insert(client, "worker_categories", [
    { id: id("wc:regular"), tenant_id: tenantId, attributes: { code: "regular", name: "Regular" } },
    { id: id("wc:trainee"), tenant_id: tenantId, attributes: { code: "trainee", name: "Trainee" } },
  ]);
  const jobProfiles = [...new Set(PEOPLE.map((person) => person.designation)), "Senior Data Engineer", "Store Manager", "Machine Operator"];
  await insert(client, "job_profiles", jobProfiles.map((title) => ({ id: id(`jp:${title}`), tenant_id: tenantId, attributes: { code: title.replace(/[^A-Za-z]/g, "").slice(0, 10).toUpperCase(), name: title, required_skills: ROLE_SKILLS[title] ?? [] } })));

  // People and employee records. Career history is written here, so the capture trigger stands aside.
  await client.query(`select set_config('app.job_history_recorded', 'on', true)`);
  for (const [index, person] of PEOPLE.entries()) {
    const manager = person.manager ? byCode.get(person.manager)! : null;
    const metadata = profile(person, index, manager ? name(manager) : null);
    const ids2 = identifiers(person, index);
    await insert(client, "people", [{ id: id(`person:${person.code}`), tenant_id: tenantId, attributes: { full_name: name(person) } }]);
    await insert(client, "employees", [{
      id: id(`emp:${person.code}`), tenant_id: tenantId, person_id: id(`person:${person.code}`), employee_code: person.code, first_name: person.first, last_name: person.last,
      work_email: person.email, designation: person.designation, designation_level: gradeLevel(person.grade), department: person.department, location: person.site,
      category: person.category ?? "regular", payroll_owner: person.site === "Pune" ? "plant" : "ho", joining_date: person.joined,
      status: person.exit?.state === "settled" ? "separated" : "active", basic_salary_minor: person.basic * 100, currency: "INR",
      legal_entity_id: id(`le:${person.company}`), manager_employee_id: manager ? id(`emp:${manager.code}`) : null, date_of_birth: person.dob,
      worker_category: metadata.workerCategory, has_rest_days: true, ot_eligibility: metadata.otEligibility, salary_location_scope: metadata.salaryLocationScope,
      is_trainee: person.category === "trainee", trainee_type: person.category === "trainee" ? "DET" : null, biometric_enrol_id: metadata.biometricEnrolId, access_card_no: metadata.accessCardNo,
      bank_account_no: ids2.account, bank_ifsc: ids2.ifsc, bank_name: ids2.bank, pan_number: ids2.pan, aadhaar_last4: ids2.aadhaar.slice(-4), uan: ids2.uan,
      esic_number: (metadata as { esiIp?: string }).esiIp ?? null, emergency_contact_name: metadata.emergencyName, emergency_contact_phone: metadata.emergencyPhone, emergency_contact_relation: metadata.emergencyRelation,
      metadata, updated_at: person.exit?.state === "settled" ? `${person.exit.lastDay}T18:00:00+05:30` : new Date().toISOString(),
    }]);

    // Career history: the position held from each step's date; the last step is the current record.
    const steps = person.history ?? [{ type: "joined", on: person.joined, reason: "Joined" }];
    const current = { company: person.company as CompanyKey, site: person.site, department: person.department, designation: person.designation, grade: person.grade as string };
    await insert(client, "employee_job_history", steps.map((step, i) => {
      const held = i === steps.length - 1 ? current : {
        company: step.company ?? current.company, site: step.site ?? current.site, department: step.department ?? current.department,
        designation: step.designation ?? current.designation, grade: step.grade ?? current.grade,
      };
      const stepManager = i < steps.length - 1 && step.manager ? byCode.get(step.manager)! : manager;
      return {
        tenant_id: tenantId, employee_id: id(`emp:${person.code}`), movement_type: step.type, effective_from: step.on,
        legal_entity_id: id(`le:${held.company}`), legal_entity_name: COMPANIES[held.company].name, location: held.site, department: held.department,
        designation: held.designation, grade: held.grade, category: person.category ?? "regular",
        manager_employee_id: stepManager ? id(`emp:${stepManager.code}`) : null, manager_name: stepManager ? name(stepManager) : null,
        reason: step.reason, source: i === 0 ? "record_created" : "move", recorded_at: `${step.on < TODAY ? step.on : TODAY}T10:00:00+05:30`,
      };
    }));
    if (person.rehire) await insert(client, "employments", [{ id: id(`employment-earlier:${person.code}`), tenant_id: tenantId, employee_id: id(`emp:${person.code}`), legal_entity_id: id(`le:${person.company}`), worker_category_id: id("wc:regular"), created_at: `${person.rehire.from}T10:00:00+05:30`, attributes: { status: "ended", start_date: person.rehire.from, end_date: person.rehire.to, reason: person.rehire.reason } }]);
    await insert(client, "employments", [{ id: id(`employment:${person.code}`), tenant_id: tenantId, employee_id: id(`emp:${person.code}`), legal_entity_id: id(`le:${person.company}`), worker_category_id: id(person.category === "trainee" ? "wc:trainee" : "wc:regular"), attributes: { status: person.exit?.state === "settled" ? "ended" : "active", start_date: person.joined, end_date: person.exit?.lastDay ?? null } }]);
    await insert(client, "audit_events", [{ tenant_id: tenantId, action: "people.create", entity_type: "employee", entity_id: id(`emp:${person.code}`), reason: "Employee record created", after: { employeeCode: person.code, fullName: name(person) }, created_at: `${person.joined < TODAY ? person.joined : TODAY}T09:30:00+05:30` }]);
  }
  await client.query(`select set_config('app.job_history_recorded', '', true)`);

  // Positions: one per role held, plus open roles being hired for
  const positionRows: Row[] = [];
  const assignmentRows: Row[] = [];
  for (const person of PEOPLE.filter(active)) {
    positionRows.push({ id: id(`pos:${person.code}`), tenant_id: tenantId, department_id: id(`dep:${person.company}|${person.department}`), grade_id: id(`grade:${person.grade}`), job_profile_id: id(`jp:${person.designation}`), location_id: id(`loc:${person.site}`), cost_center_id: id(`cc:${person.company}`), reports_to_position_id: null, record_status: "filled",
      attributes: { code: `POS-${person.code.slice(2)}`, name: person.designation, fte: 1, workerClass: "PERM", effectiveFrom: person.joined, budgetCostMinor: person.basic * 100 * 12 * 1.6 } });
    if (person.joined <= TODAY) assignmentRows.push({ tenant_id: tenantId, employment_id: id(`employment:${person.code}`), position_id: id(`pos:${person.code}`), department_id: id(`dep:${person.company}|${person.department}`), grade_id: id(`grade:${person.grade}`), location_id: id(`loc:${person.site}`), cost_center_id: id(`cc:${person.company}`), manager_employee_id: person.manager ? id(`emp:${person.manager}`) : null, record_status: "active", attributes: { effectiveFrom: person.joined } });
  }
  const openRoles = [
    { key: "open:data", title: "Senior Data Engineer", company: "TDSPL" as CompanyKey, department: "Engineering", site: "Bengaluru", grade: "G4", budget: 160000 },
    { key: "open:store", title: "Store Manager", company: "TRPL" as CompanyKey, department: "Retail Operations", site: "Gurugram", grade: "G4", budget: 90000 },
    { key: "open:operator", title: "Machine Operator", company: "TEPL" as CompanyKey, department: "Production", site: "Pune", grade: "G2", budget: 22000 },
  ];
  for (const role of openRoles) {
    positionRows.push({ id: id(`pos:${role.key}`), tenant_id: tenantId, department_id: id(`dep:${role.company}|${role.department}`), grade_id: id(`grade:${role.grade}`), job_profile_id: id(`jp:${role.title}`), location_id: id(`loc:${role.site}`), cost_center_id: id(`cc:${role.company}`), reports_to_position_id: null, record_status: "active",
      attributes: { code: `POS-OPEN-${role.key.split(":")[1]!.toUpperCase()}`, name: role.title, fte: 1, workerClass: "PERM", availableFrom: addDays(TODAY, -30), effectiveFrom: addDays(TODAY, -30), budgetCostMinor: role.budget * 100 * 12 * 1.6 } });
  }
  await insert(client, "positions", positionRows);
  await insert(client, "employee_assignments", assignmentRows);

  // Manpower plan: sanctioned against filled, per department
  await insert(client, "manpower_plans", [{ id: id("mp:2026"), tenant_id: tenantId, legal_entity_id: id("le:TGH"), department_id: null, attributes: { code: "MP-FY27", name: "Manpower plan FY 2026-27", status: "approved", fiscal_year: "2026-27" } }]);
  await insert(client, "manpower_plan_lines", departments.map((key, index) => {
    const [company, department] = key.split("|") as [CompanyKey, string];
    const filled = PEOPLE.filter((person) => active(person) && person.company === company && person.department === department).length;
    const open = openRoles.filter((role) => role.company === company && role.department === department).length;
    const sample = PEOPLE.find((person) => person.company === company && person.department === department)!;
    return { tenant_id: tenantId, manpower_plan_id: id("mp:2026"), department_id: id(`dep:${key}`), grade_id: id(`grade:${sample.grade}`), job_profile_id: id(`jp:${sample.designation}`), location_id: id(`loc:${sample.site}`),
      // Every third department has one approved position not yet opened for hiring.
      attributes: { record_code: `SS-${company}-${String(index + 1).padStart(2, "0")}`, department, company: COMPANIES[company].name, sanctioned: filled + open + (index % 3 === 0 ? 1 : 0), filled, open_requisitions: open, effective_from: "2026-04-01" } };
  }));

  // Roles added to the plan for later quarters (growth sanctioned at the April planning round).
  const growth: Array<[CompanyKey, string, string, string, number, string]> = [
    ["TRPL", "Customer Experience", "Customer Experience Associate", "Gurugram", 1, "2026-07-01"], ["TDSPL", "Engineering", "Software Engineer", "Bengaluru", 1, "2026-10-01"],
    ["TEPL", "Production", "CNC Machine Operator", "Pune", 1, "2027-01-01"], ["TDSPL", "Product", "Product Manager", "Bengaluru", 1, "2027-01-01"],
  ];
  await insert(client, "manpower_plan_lines", growth.map(([company, department, role, site, sanctioned, from], index) => ({
    tenant_id: tenantId, manpower_plan_id: id("mp:2026"), department_id: id(`dep:${company}|${department}`), grade_id: id(`grade:${PEOPLE.find((person) => person.designation === role)!.grade}`), job_profile_id: id(`jp:${role}`), location_id: id(`loc:${site}`),
    attributes: { record_code: `SS-${company}-G${String(index + 1).padStart(2, "0")}`, department, company: COMPANIES[company].name, role, sanctioned, filled: 0, open_requisitions: 0, effective_from: from, note: "Growth role in the FY 2026-27 plan" },
  })));

  // Logins linked to their employee records
  for (const person of PEOPLE.filter((entry) => entry.login)) {
    await client.query(`update memberships m set employee_id = $1 from "user" u where u.id = m.user_id and m.tenant_id = $2 and lower(u.email) = $3`, [id(`emp:${person.code}`), tenantId, person.login]);
  }

  // Attendance for the last ~90 days (today: punched in so far)
  const leaveDays = new Map<string, Set<string>>();
  for (const leave of leavePlan.filter((entry) => entry.outcome === "approved")) {
    const set = leaveDays.get(leave.code) ?? new Set<string>();
    for (let day = leave.from; day <= leave.to; day = addDays(day, 1)) set.add(day);
    leaveDays.set(leave.code, set);
  }
  const holidays = new Set([`${TODAY.slice(0, 4)}-10-02`, `${TODAY.slice(0, 4)}-08-15`]);
  const monthStart = `${TODAY.slice(0, 7)}-01`;
  const days: Row[] = [];
  const punches: Row[] = [];
  const pendingDays: Array<{ dayId: string; code: string; day: string }> = [];
  const yesterdayMissing = new Set(["TG1029", "TG1010"]);
  const notYetIn = new Set(["TG1003", "TG1024", "TG1030"]);
  for (const person of PEOPLE) {
    const from = [addDays(TODAY, -179), person.joined].sort().pop()!;
    const to = person.exit ? [TODAY, person.exit.lastDay].sort()[0]! : TODAY;
    if (from > to) continue;
    const plant = person.site === "Pune" && (person.shift === "A" || person.shift === "B");
    const shiftStart = plant ? (person.shift === "A" ? 6 * 60 : 14 * 60) : 9 * 60 + 30;
    for (const day of workdays(person, from, to)) {
      const dayId = randomUUID();
      const base = { id: dayId, tenant_id: tenantId, employee_id: id(`emp:${person.code}`), attendance_date: day, assigned_shift: person.shift ?? "GENERAL", detected_shift: person.shift ?? "GENERAL", locked_at: day < monthStart ? `${addDays(monthStart, 2)}T10:00:00+05:30` : null };
      if (holidays.has(day)) { days.push({ ...base, status: "holiday", productive_minutes: 0, payable_ot_minutes: 0, exception_reason: null }); continue; }
      if (leaveDays.get(person.code)?.has(day)) { days.push({ ...base, status: "leave", productive_minutes: 0, payable_ot_minutes: 0, exception_reason: null }); continue; }
      if (day === TODAY) {
        if (notYetIn.has(person.code) || person.exit?.state === "settled") continue;
        const inAt = shiftStart + between(-12, 14);
        days.push({ ...base, status: "present", productive_minutes: 0, payable_ot_minutes: 0, exception_reason: inAt > shiftStart + 15 ? "Late arrival" : null });
        punches.push({ tenant_id: tenantId, attendance_day_id: dayId, punched_at: at(day, minutesToHHMM(inAt)), type: "in", source: plant ? "biometric" : "mobile" });
        continue;
      }
      if (day === addDays(TODAY, -1) && yesterdayMissing.has(person.code)) {
        const inAt = shiftStart + between(-5, 8);
        days.push({ ...base, status: "pending", productive_minutes: 0, payable_ot_minutes: 0, exception_reason: "Missing out-punch" });
        punches.push({ tenant_id: tenantId, attendance_day_id: dayId, punched_at: at(day, minutesToHHMM(inAt)), type: "in", source: "biometric" });
        pendingDays.push({ dayId, code: person.code, day });
        continue;
      }
      const roll = random();
      if (roll < 0.015) { days.push({ ...base, status: "absent", productive_minutes: 0, payable_ot_minutes: 0, exception_reason: "No punch, no leave applied" }); continue; }
      const half = roll < 0.035;
      const inAt = shiftStart + between(-15, 22);
      const span = half ? between(250, 290) : between(530, 575);
      const ot = plant && !half && random() < 0.18 ? between(60, 150) : 0;
      const outAt = inAt + span + ot;
      days.push({ ...base, status: half ? "half_day" : "present", gross_span_minutes: span + ot, break_minutes: half ? 0 : 45, productive_minutes: span - (half ? 0 : 45), payable_ot_minutes: ot, exception_reason: inAt > shiftStart + 15 ? "Late arrival" : half ? "Left early: half day" : null });
      punches.push({ tenant_id: tenantId, attendance_day_id: dayId, punched_at: at(day, minutesToHHMM(inAt)), type: "in", source: plant ? "biometric" : "mobile" });
      punches.push({ tenant_id: tenantId, attendance_day_id: dayId, punched_at: at(day, minutesToHHMM(Math.min(outAt, 23 * 60 + 50))), type: "out", source: plant ? "biometric" : "mobile" });
    }
  }
  await insert(client, "attendance_days", days);
  await insert(client, "attendance_punches", punches);
  const holidayCalendar = id("hc:2026");
  await insert(client, "holiday_calendars", [{ id: holidayCalendar, tenant_id: tenantId, jurisdiction_id: jurisdictionId, attributes: { code: `HOL-${TODAY.slice(0, 4)}`, name: `National holidays ${TODAY.slice(0, 4)}`, year: Number(TODAY.slice(0, 4)) } }]);
  await insert(client, "holidays", [["01-26", "Republic Day"], ["08-15", "Independence Day"], ["10-02", "Gandhi Jayanti"], ["12-25", "Christmas"]].map(([md, title]) => ({ tenant_id: tenantId, holiday_calendar_id: holidayCalendar, attributes: { date: `${TODAY.slice(0, 4)}-${md}`, name: title, type: "national" } })));

  // Documents
  const documentTypes = ["Aadhaar card", "PAN card", "Offer letter", "Passport", "Work permit / visa", "Medical fitness certificate", "Relieving letter", "Degree certificate", "Address proof"];
  await insert(client, "document_types", documentTypes.map((title) => ({ id: id(`dt:${title}`), tenant_id: tenantId, attributes: { code: title.replace(/[^A-Za-z]/g, "").slice(0, 12).toUpperCase(), name: title } })));
  const documents: Row[] = [];
  const versions: Row[] = [];
  for (const [index, person] of PEOPLE.entries()) {
    if (person.joined > TODAY) continue;
    const ids = identifiers(person, index);
    const doc = (type: string, title: string, issued: string, extra: Row = {}) => {
      const documentId = id(`doc:${person.code}:${type}`);
      const code = `DOC-${person.code}-${type.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()}`;
      documents.push({ id: documentId, tenant_id: tenantId, employee_id: id(`emp:${person.code}`), document_type_id: id(`dt:${type}`), created_at: `${issued}T11:00:00+05:30`,
        attributes: { code, title, issued_on: issued, verification: "verified", classification: "personal", source: "record", uploaded_by_name: "HR records", ...extra } });
      // The digital copy on file: a one-page PDF of what the HR record holds for this document.
      const number = type === "Aadhaar card" ? `XXXX XXXX ${ids.aadhaar.slice(-4)}` : type === "PAN card" ? ids.pan : type === "Passport" ? `${"JKLMNPRSTV"[index % 10]}${String(1000000 + index * 7331).slice(-7)}` : code;
      const bytes = renderPdf({
        heading: type, subheading: COMPANIES[person.company].name,
        lines: [
          { label: "Name", value: name(person) }, { label: "Employee code", value: person.code }, { label: "Designation", value: person.designation },
          { label: "Department", value: `${person.department}, ${person.site}` }, { label: "Document number", value: number },
          { label: "Issued on", value: issued }, ...(extra.expires_at ? [{ label: "Valid until", value: String(extra.expires_at) }] : []),
        ],
        footer: `Digital copy held on the employee's record. ${title}. Reference ${code}.`,
      });
      const content = Buffer.from(bytes).toString("base64");
      versions.push({ tenant_id: tenantId, document_id: documentId, created_at: `${issued}T11:00:00+05:30`, attributes: {
        version: 1, title, file_name: `${title.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-")}.pdf`, mime: "application/pdf", size_bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"), scan: "available", scan_method: "file-signature", content_base64: content, expires_at: extra.expires_at ?? null,
      } });
    };
    const pending = ["TG1024", "TG1015"].includes(person.code);
    doc("Aadhaar card", `Aadhaar card – ${name(person)}`, person.joined, pending ? { verification: "pending" } : {});
    doc("PAN card", `PAN card – ${name(person)}`, person.joined, pending ? { verification: "pending" } : {});
    doc("Offer letter", `Offer letter – ${person.designation}`, addDays(person.joined, -21), { classification: "employment" });
    if (person.passportExpiry) doc("Passport", `Passport – ${name(person)}`, addMonths(person.passportExpiry, -120), { expires_at: person.passportExpiry });
    if (person.international) doc("Work permit / visa", `Employment visa – ${name(person)}`, addMonths(person.international.permitExpiry, -24), { expires_at: person.international.permitExpiry, classification: "immigration" });
    if (person.medical) doc("Medical fitness certificate", `Annual medical fitness – ${name(person)}`, person.medical.exam, { expires_at: addMonths(person.medical.exam, 12), verification: person.medical.fitness === "Pending" ? "pending" : "verified" });
    if (person.previous) doc("Relieving letter", `Relieving letter – ${person.previous.employer}`, person.previous.to, { classification: "employment", verification: index % 3 === 0 ? "pending" : "verified" });
  }
  await insert(client, "documents", documents);
  await insert(client, "document_versions", versions);

  // Onboarding (recent and upcoming joiners) and exits
  const tasks = ["Sign the offer and NDA", "Submit identity documents", "Laptop and access card", "Bank account and PF nomination", "Induction: values, POSH and safety", "Meet your buddy", "30-day check-in with manager"];
  await insert(client, "onboarding_templates", [{ id: id("ot:std"), tenant_id: tenantId, attributes: { code: "DAY1-STD", name: "Standard onboarding", tasks: tasks.map((title, index) => ({ code: `T${index + 1}`, title })) } }]);
  await insert(client, "onboarding_instances", ["TG1024", "TG1015", "TG1034"].map((code) => {
    const person = byCode.get(code)!;
    const done = person.joined > TODAY ? 2 : code === "TG1015" ? 7 : 5;
    return { tenant_id: tenantId, employee_id: id(`emp:${code}`), employment_id: id(`employment:${code}`), onboarding_template_id: id("ot:std"),
      attributes: { status: done === 7 ? "completed" : "active", template: "DAY1-STD", start_date: person.joined, tasks: tasks.map((title, index) => ({ code: `T${index + 1}`, title, status: index < done ? "done" : "open" })) } };
  }));
  for (const person of PEOPLE.filter((entry) => entry.exit)) {
    const caseId = id(`off:${person.code}`);
    const settled = person.exit!.state === "settled";
    await insert(client, "offboarding_cases", [{ id: caseId, tenant_id: tenantId, employment_id: id(`employment:${person.code}`), created_at: `${addDays(person.exit!.lastDay, -30) < TODAY ? addDays(person.exit!.lastDay, -30) : TODAY}T10:00:00+05:30`,
      attributes: { status: settled ? "settled" : "in_progress", reason: person.exit!.reason, resignation_date: addDays(person.exit!.lastDay, -30), last_working_day: person.exit!.lastDay, notice_days: 30 } }]);
    await insert(client, "clearance_items", ["IT assets returned", "Finance: advances and dues", "Access card and ID", "Knowledge transfer sign-off"].map((title, index) => ({
      tenant_id: tenantId, offboarding_case_id: caseId, attributes: { title, department: ["IT", "Finance", "Admin", "Reporting manager"][index], status: settled || index === 3 ? "cleared" : "pending" } })));
  }

  // Hiring
  await insert(client, "requisitions", [
    { id: id("req:data"), status: "open", code: "REQ-2026-014", title: "Senior Data Engineer", company: "TDSPL", department: "Engineering", manager: "TG1017", openings: 1, days: 26 },
    { id: id("req:store"), status: "open", code: "REQ-2026-015", title: "Store Manager – Gurugram", company: "TRPL", department: "Retail Operations", manager: "TG1026", openings: 1, days: 18 },
    { id: id("req:operator"), status: "approved", code: "REQ-2026-016", title: "Machine Operator", company: "TEPL", department: "Production", manager: "TG1009", openings: 2, days: 9 },
    { id: id("req:analyst"), status: "filled", code: "REQ-2026-011", title: "Data Analyst", company: "TDSPL", department: "Engineering", manager: "TG1017", openings: 1, days: 58 },
  ].map((row) => ({ id: row.id, tenant_id: tenantId, department_id: id(`dep:${row.company}|${row.department}`), hiring_manager_employee_id: id(`emp:${row.manager}`), created_at: `${addDays(TODAY, -row.days)}T10:00:00+05:30`,
    attributes: { code: row.code, title: row.title, status: row.status, openings: row.openings, location: COMPANIES[row.company as CompanyKey].site, employment_type: "Full time" } })));
  const candidates = [
    ["Tanvi Rao", "Campus", "req:analyst", "hired", 50], ["Kunal Bhatia", "LinkedIn", "req:analyst", "rejected", 52],
    ["Shreya Ghosh", "Employee referral", "req:data", "offer", 22], ["Abhishek Menon", "Naukri", "req:data", "interview", 20], ["Ishaan Kapoor", "LinkedIn", "req:data", "screening", 8], ["Pallavi Rao", "Careers page", "req:data", "applied", 3],
    ["Gurpreet Singh", "Naukri", "req:store", "interview", 14], ["Mehak Arora", "Employee referral", "req:store", "screening", 6], ["Rohan Sethi", "Walk-in", "req:store", "rejected", 15],
    ["Santosh Mane", "ITI campus", "req:operator", "interview", 7], ["Vishal Kamble", "Walk-in", "req:operator", "applied", 2], ["Arif Khan", "Naukri", "req:data", "offer_declined", 30],
  ] as const;
  // Screening match scores recorded against new applications (index into the list above).
  const MATCH: Record<number, [number, string]> = {
    4: [82, "Spark and Python pipelines for 4 years; Airflow"], 5: [74, "Strong SQL and Airflow; no Spark yet"], 7: [78, "Six years running large-format stores; NPS uplift"], 10: [69, "ITI machinist with CNC basics"],
  };
  await insert(client, "candidates", candidates.map(([full, source], index) => ({ id: id(`cand:${index}`), tenant_id: tenantId, attributes: { name: full, email: `${full.toLowerCase().replace(/ /g, ".")}@example.com`, phone: `+91 99${String(10000000 + index * 7717).slice(0, 8)}`, source } })));
  await insert(client, "applications", candidates.map(([, , requisition, stage, daysAgo], index) => ({ id: id(`app:${index}`), tenant_id: tenantId, candidate_id: id(`cand:${index}`), requisition_id: id(requisition), created_at: `${addDays(TODAY, -daysAgo)}T12:00:00+05:30`, updated_at: `${addDays(TODAY, -Math.max(0, daysAgo - 5))}T12:00:00+05:30`, attributes: { stage, status: stage, ...(MATCH[index] ? { match_score: MATCH[index]![0], match_reason: MATCH[index]![1] } : {}) } })));
  await insert(client, "surveys", [{ id: id("survey:cx"), tenant_id: tenantId, attributes: { code: "CX-2026", name: "Candidate experience", audience: "candidates", scale: "1-5" } }]);
  const questions = ["Clarity of the job description", "Speed of response", "Interview experience", "Communication about next steps"];
  await insert(client, "survey_questions", questions.map((question, index) => ({ id: id(`sq:${index}`), tenant_id: tenantId, survey_id: id("survey:cx"), attributes: { text: question, order: String(index + 1), kind: "scale" } })));
  await insert(client, "survey_runs", [{ id: id("sr:cx"), tenant_id: tenantId, survey_id: id("survey:cx"), attributes: { name: "Candidates after interview, 2026", status: "open", opened_on: addDays(TODAY, -60) } }]);
  const respondents = [0, 1, 2, 3, 6, 8, 9, 11];
  await insert(client, "survey_responses", respondents.map((candidate) => ({ id: id(`sresp:${candidate}`), tenant_id: tenantId, survey_run_id: id("sr:cx"), employee_id: null, created_at: `${addDays(TODAY, -between(2, 50))}T18:00:00+05:30`, attributes: { candidate_id: id(`cand:${candidate}`), submitted: true } })));
  const answerScores = [[5, 4, 5, 4], [4, 3, 4, 3], [5, 4, 4, 4], [4, 4, 5, 3], [3, 2, 4, 2], [4, 3, 4, 3], [4, 4, 4, 3], [3, 2, 3, 2]];
  await insert(client, "survey_answers", respondents.flatMap((candidate, row) => questions.map((_, q) => ({ tenant_id: tenantId, survey_response_id: id(`sresp:${candidate}`), survey_question_id: id(`sq:${q}`), attributes: { score: answerScores[row]![q] } }))));
  await employeePulse(client, tenantId, id);
  await insert(client, "interview_sessions", [
    [3, "Technical round 2", 1, "scheduled"], [6, "Store walkthrough", 2, "scheduled"], [9, "Practical test", 3, "scheduled"], [3, "Hiring manager round", 5, "scheduled"],
    [2, "Technical round 1", -12, "completed"], [3, "Technical round 1", -9, "completed"], [6, "HR round", -4, "completed"],
  ].map(([app, round, offset, status]) => ({ tenant_id: tenantId, application_id: id(`app:${app}`), attributes: { round, status, scheduled_at: `${addDays(TODAY, offset as number)}T${offset as number > 0 ? "11:30" : "15:00"}`, panel: ["Vikram Rao", "Karthik Reddy"] } })));
  await insert(client, "offers", [
    { application: 0, position: "pos:TG1034", status: "accepted", ctc: 1250000, days: 30 },
    { application: 2, position: "pos:open:data", status: "offered", ctc: 2600000, days: 3 },
    { application: 11, position: "pos:open:data", status: "declined", ctc: 2400000, days: 16 },
  ].map((row) => ({ tenant_id: tenantId, application_id: id(`app:${row.application}`), position_id: id(row.position), updated_at: `${addDays(TODAY, -row.days)}T16:00:00+05:30`, attributes: { status: row.status, annual_ctc_minor: row.ctc * 100, currency: "INR", joining_date: row.application === 0 ? byCode.get("TG1034")!.joined : addDays(TODAY, 45) } })));

  // Goals, check-ins, review cycle
  await insert(client, "goal_cycles", [{ id: id("gc:fy27"), tenant_id: tenantId, attributes: { code: "FY27", name: "FY 2026-27 goals", starts_on: "2026-04-01", ends_on: "2027-03-31", status: "active" } }]);
  const goals: Array<[string, string, number]> = [
    ["TG1017", "Ship the customer self-service portal v2", 65], ["TG1018", "Reduce API p95 latency below 300 ms", 55], ["TG1019", "Lead the payments service migration", 72], ["TG1020", "Automate 80% of regression tests", 48],
    ["TG1021", "Cut cloud spend by 15%", 40], ["TG1022", "Launch two features from the partner roadmap", 60], ["TG1009", "Improve OEE on Line 2 to 82%", 70], ["TG1013", "Bring first-pass yield above 98%", 76],
    ["TG1014", "Zero lost-time incidents this year", 90], ["TG1026", "Raise store NPS to 60", 52], ["TG1027", "Grow private-label share to 18%", 44], ["TG1005", "Close the annual engagement survey actions", 35],
  ];
  await insert(client, "objectives", goals.map(([code, title, progress], index) => ({ id: id(`obj:${index}`), tenant_id: tenantId, goal_cycle_id: id("gc:fy27"), owner_employee_id: id(`emp:${code}`), attributes: { title, status: progress >= 90 ? "on_track" : progress < 45 ? "at_risk" : "active", progress_pct: progress, weight: 25, due_date: "2027-03-31" } })));
  await insert(client, "checkins", goals.slice(0, 9).map(([code, , progress], index) => ({ tenant_id: tenantId, employee_id: id(`emp:${code}`), objective_id: id(`obj:${index}`), created_at: `${addDays(TODAY, -between(2, 25))}T17:00:00+05:30`, attributes: { progress_pct: progress, note: "Weekly update shared with manager", confidence: progress >= 60 ? "high" : "medium" } })));
  const COMPETENCIES = ["Delivery", "Collaboration", "Ownership", "Customer focus", "Craft", "Coaching"];
  const BENCHMARKS = { Delivery: 3.5, Collaboration: 3.5, Ownership: 3.5, "Customer focus": 3.5, Craft: 3.5, Coaching: 3 };
  await insert(client, "review_templates", [
    { id: id("rt:mid"), tenant_id: tenantId, attributes: { code: "MID-YEAR", name: "Mid-year review", competencies: COMPETENCIES, benchmarks: BENCHMARKS } },
    { id: id("rt:annual"), tenant_id: tenantId, created_at: "2026-02-15T10:00:00+05:30", attributes: { code: "ANNUAL", name: "Annual review", competencies: COMPETENCIES, benchmarks: BENCHMARKS } },
  ]);
  await insert(client, "review_cycles", [{ id: id("rc:annual"), tenant_id: tenantId, created_at: "2026-03-01T10:00:00+05:30", attributes: { code: "AR-FY26", name: "Annual review FY 2025-26", status: "closed", starts_on: "2026-03-01", ends_on: "2026-04-30", calibrated_on: "2026-04-24" } }]);
  const annual = Object.entries(ANNUAL_RATINGS).filter(([code]) => byCode.get(code)?.manager);
  await insert(client, "review_participants", annual.map(([code, [rating, potential]]) => ({ id: id(`rpa:${code}`), tenant_id: tenantId, employee_id: id(`emp:${code}`), manager_employee_id: id(`emp:${byCode.get(code)!.manager}`), review_cycle_id: id("rc:annual"), review_template_id: id("rt:annual"), created_at: "2026-03-01T10:00:00+05:30", attributes: { status: "completed", final_rating: rating, potential, calibrated: true } })));
  await insert(client, "review_responses", annual.flatMap(([code, [rating]]) => [
    { tenant_id: tenantId, review_participant_id: id(`rpa:${code}`), rater_employee_id: id(`emp:${code}`), created_at: "2026-03-20T10:00:00+05:30", attributes: { kind: "self", ratings: Object.fromEntries(COMPETENCIES.map((name) => [name, Math.min(5, Math.max(1, rating + between(0, 1)))])), comment: "Self assessment submitted" } },
    { tenant_id: tenantId, review_participant_id: id(`rpa:${code}`), rater_employee_id: id(`emp:${byCode.get(code)!.manager}`), created_at: "2026-04-10T10:00:00+05:30", attributes: { kind: "manager", overall: rating, ratings: Object.fromEntries(COMPETENCIES.map((name) => [name, Math.min(5, Math.max(1, rating + between(-1, 1) - (name === "Coaching" ? 1 : 0)))])), comment: "Manager assessment" } },
  ]));
  await insert(client, "review_cycles", [{ id: id("rc:mid"), tenant_id: tenantId, attributes: { code: "MYR-2026", name: "Mid-year review 2026", status: "active", starts_on: addDays(TODAY, -40), ends_on: addDays(TODAY, 20) } }]);
  const reviewees = PEOPLE.filter((person) => active(person) && person.joined < addDays(TODAY, -180) && person.manager);
  const participants = reviewees.map((person, index) => ({ person, status: index % 4 === 0 ? "completed" : index % 4 === 1 ? "manager_review" : index % 4 === 2 ? "self_review" : "enrolled" }));
  await insert(client, "review_participants", participants.map(({ person, status }) => ({ id: id(`rp:${person.code}`), tenant_id: tenantId, employee_id: id(`emp:${person.code}`), manager_employee_id: id(`emp:${person.manager}`), review_cycle_id: id("rc:mid"), review_template_id: id("rt:mid"), attributes: { status } })));
  await insert(client, "review_responses", participants.filter(({ status }) => status === "completed" || status === "manager_review").map(({ person }) => ({ tenant_id: tenantId, review_participant_id: id(`rp:${person.code}`), rater_employee_id: id(`emp:${person.code}`), attributes: { kind: "self", ratings: { Delivery: between(3, 5), Collaboration: between(3, 5), Ownership: between(3, 5), "Customer focus": between(2, 5) }, comment: "Self assessment submitted" } })));

  // Learning and skills
  const courses = [["POSH-26", "Prevention of sexual harassment (POSH)"], ["FIRE-26", "Fire safety and evacuation"], ["INFOSEC-26", "Information security essentials"], ["DPDP-26", "Data privacy under the DPDP Act"], ["LEAD-01", "First-time manager programme"]];
  const skillCourses: Array<[string, string, string[], number]> = [
    ["LEAD-01", "First-time manager programme", ["Stakeholder management"], 480], ["AWS-201", "Cloud architecture on AWS", ["Cloud (AWS)"], 720],
    ["PY-101", "Python and SQL for data work", ["Python", "SQL"], 600], ["LEAN-101", "Lean and Six Sigma yellow belt", ["Lean manufacturing", "Six Sigma"], 900], ["TEST-201", "Test automation with Playwright", ["Test automation"], 360],
  ];
  await insert(client, "courses", [
    ...courses.filter(([code]) => code !== "LEAD-01").map(([code, title]) => ({ id: id(`course:${code}`), tenant_id: tenantId, attributes: { code, title, mandatory: true, duration_minutes: 45, skills: [] } })),
    ...skillCourses.map(([code, title, built, minutes]) => ({ id: id(`course:${code}`), tenant_id: tenantId, attributes: { code, title, mandatory: false, duration_minutes: minutes, skills: built } })),
  ]);
  for (const [code] of skillCourses) if (!courses.some(([existing]) => existing === code)) courses.push([code, skillCourses.find(([c]) => c === code)![1]]);
  await insert(client, "course_versions", [...courses, ...skillCourses.filter(([code]) => !courses.some(([c]) => c === code)).map(([code, title]) => [code, title])].map(([code]) => ({ id: id(`cv:${code}`), tenant_id: tenantId, course_id: id(`course:${code}`), attributes: { version: "2026.1", status: "published" } })));
  const enrollments: Row[] = [];
  const completions: Row[] = [];
  for (const person of PEOPLE.filter((entry) => active(entry) && entry.joined <= TODAY)) {
    for (const [code] of courses.slice(0, person.site === "Pune" ? 2 : 4)) {
      const enrollmentId = randomUUID();
      const roll = random();
      const status = roll < 0.62 ? "verified" : "assigned";
      const due = roll < 0.62 ? addDays(TODAY, -between(20, 80)) : roll < 0.8 ? addDays(TODAY, -between(3, 25)) : addDays(TODAY, between(5, 40));
      enrollments.push({ id: enrollmentId, tenant_id: tenantId, employee_id: id(`emp:${person.code}`), course_version_id: id(`cv:${code}`), created_at: `${addDays(due, -30)}T09:00:00+05:30`, updated_at: status === "verified" ? `${addDays(due, -between(1, 10))}T15:00:00+05:30` : `${addDays(due, -30)}T09:00:00+05:30`, attributes: { course_code: code, status, due_date: due } });
      if (status === "verified") completions.push({ tenant_id: tenantId, employee_id: id(`emp:${person.code}`), enrollment_id: enrollmentId, created_at: `${addDays(due, -between(1, 10))}T15:00:00+05:30`, attributes: { course_code: code, score: between(72, 100), completed_on: addDays(due, -3) } });
    }
  }
  // Skill programmes: engineers on cloud and data paths, the plant on lean.
  const programmes: Array<[string, string, "verified" | "assigned", number]> = [
    ["TG1018", "AWS-201", "assigned", 20], ["TG1020", "TEST-201", "verified", -40], ["TG1021", "AWS-201", "verified", -60], ["TG1019", "PY-101", "verified", -90], ["TG1024", "PY-101", "assigned", 35],
    ["TG1009", "LEAN-101", "verified", -120], ["TG1012", "LEAN-101", "assigned", 25], ["TG1013", "LEAN-101", "verified", -70], ["TG1017", "LEAD-01", "verified", -150], ["TG1026", "LEAD-01", "assigned", 15],
  ];
  for (const [code, course, status, dueIn] of programmes) {
    const enrollmentId = randomUUID();
    const due = addDays(TODAY, dueIn);
    enrollments.push({ id: enrollmentId, tenant_id: tenantId, employee_id: id(`emp:${code}`), course_version_id: id(`cv:${course}`), created_at: `${addDays(due, -60)}T09:00:00+05:30`, updated_at: `${addDays(due, -5)}T15:00:00+05:30`, attributes: { course_code: course, status: status === "assigned" && dueIn < 30 ? "in_progress" : status, due_date: due } });
    if (status === "verified") completions.push({ tenant_id: tenantId, employee_id: id(`emp:${code}`), enrollment_id: enrollmentId, created_at: `${addDays(due, -5)}T15:00:00+05:30`, attributes: { course_code: course, score: between(78, 98), completed_on: addDays(due, -5) } });
  }
  await insert(client, "enrollments", enrollments);
  await insert(client, "learning_completions", completions);
  const skills = ["Java", "Python", "React", "SQL", "Cloud (AWS)", "Test automation", "CNC programming", "Lean manufacturing", "Six Sigma", "Retail merchandising", "Payroll compliance", "Stakeholder management"];
  await insert(client, "skills", skills.map((skill) => ({ id: id(`skill:${skill}`), tenant_id: tenantId, attributes: { code: skill.replace(/[^A-Za-z]/g, "").slice(0, 10).toUpperCase(), name: skill } })));
  const skillMap: Record<string, string[]> = {
    TG1017: ["Java", "Cloud (AWS)", "Stakeholder management"], TG1018: ["Java", "SQL", "React"], TG1019: ["Java", "Python", "Cloud (AWS)"], TG1020: ["Test automation", "Python"], TG1021: ["Cloud (AWS)", "Python"],
    TG1022: ["Stakeholder management", "SQL"], TG1023: ["Java", "Cloud (AWS)"], TG1024: ["React"], TG1009: ["Lean manufacturing", "Six Sigma"], TG1010: ["CNC programming"], TG1011: ["CNC programming"],
    TG1013: ["Six Sigma"], TG1027: ["Retail merchandising", "SQL"], TG1026: ["Retail merchandising", "Stakeholder management"], TG1006: ["Payroll compliance"], TG1030: ["Payroll compliance", "SQL"],
    TG1035: ["Java", "SQL"], TG1039: ["Java", "Python", "Cloud (AWS)"], TG1037: ["Six Sigma"], TG1038: ["CNC programming"], TG1040: ["Payroll compliance"], TG1028: ["Stakeholder management"],
  };
  await insert(client, "employee_skills", Object.entries(skillMap).flatMap(([code, list]) => list.map((skill, index) => ({ tenant_id: tenantId, employee_id: id(`emp:${code}`), skill_id: id(`skill:${skill}`), created_at: `${addDays(TODAY, -between(15, 330))}T11:00:00+05:30`, attributes: { proficiency: ["Expert", "Advanced", "Intermediate"][index % 3], verified: index === 0 ? "true" : "false", source: index === 0 ? "manager" : "self" } }))));

  // Recognition and feedback over the last six months
  await insert(client, "recognition_programs", [{ id: id("rp:spot"), tenant_id: tenantId, attributes: { code: "SPOT", name: "Spot award", points: 500 } }]);
  const praise: Array<[string, string, string, number]> = [
    ["TG1017", "TG1019", "Led the payments migration cut-over without downtime", 8], ["TG1008", "TG1014", "Six months without a lost-time incident at Chakan", 20], ["TG1026", "TG1028", "Turned around three escalated customer complaints in a week", 35],
    ["TG1002", "TG1005", "Ran the campus hiring drive end to end", 60], ["TG1009", "TG1010", "Suggested the fixture change that cut cycle time by 6%", 75], ["TG1016", "TG1022", "Partner roadmap launched ahead of plan", 95],
    ["TG1025", "TG1029", "Set up the Gurugram distribution hub in record time", 110], ["TG1003", "TG1006", "Zero-error payroll for six straight months", 140], ["TG1017", "TG1020", "Built the regression suite that caught a release blocker", 160],
  ];
  await insert(client, "recognition_events", praise.map(([from, to, citation, daysAgo]) => ({ tenant_id: tenantId, recognition_program_id: id("rp:spot"), nominator_employee_id: id(`emp:${from}`), recipient_employee_id: id(`emp:${to}`), created_at: `${addDays(TODAY, -daysAgo)}T12:00:00+05:30`, attributes: { citation, status: "approved", points: 500 } })));
  await insert(client, "feedback_entries", [["TG1017", "TG1018", 12], ["TG1017", "TG1021", 26], ["TG1022", "TG1024", 9], ["TG1026", "TG1031", 44], ["TG1008", "TG1013", 70], ["TG1016", "TG1017", 100], ["TG1002", "TG1007", 130]].map(([from, to, daysAgo]) => ({
    tenant_id: tenantId, author_employee_id: id(`emp:${from}`), subject_employee_id: id(`emp:${to}`), created_at: `${addDays(TODAY, -(daysAgo as number))}T16:00:00+05:30`, attributes: { kind: "praise", visibility: "manager", text: "Thanks for going the extra mile this sprint." } })));

  // Succession for two critical roles
  await insert(client, "succession_plans", [
    { id: id("sp:ceo"), tenant_id: tenantId, position_id: id("pos:TG1001"), owner_employee_id: id("emp:TG1002"), attributes: { title: "Group Chief Executive Officer", criticality: "high", reason: "Incumbent reaches retirement age this year" } },
    { id: id("sp:plant"), tenant_id: tenantId, position_id: id("pos:TG1008"), owner_employee_id: id("emp:TG1002"), attributes: { title: "Plant Head, Chakan", criticality: "high" } },
  ]);
  await insert(client, "succession_candidates", [["sp:ceo", "TG1016", "Ready in 1–2 years"], ["sp:ceo", "TG1025", "Ready in 1–2 years"], ["sp:ceo", "TG1003", "Ready now"], ["sp:plant", "TG1009", "Ready in 1–2 years"], ["sp:plant", "TG1014", "Ready in 3+ years"]].map(([plan, code, readiness]) => ({ tenant_id: tenantId, succession_plan_id: id(plan!), employee_id: id(`emp:${code}`), attributes: { readiness } })));

  // Announcements, helpdesk, statutory calendar
  await insert(client, "feed_posts", [
    { title: "Annual health check-up at the Chakan plant", body: "Medical examinations for all plant staff run from next Monday for two weeks. Book your slot with the EHS desk.", kind: "management", days: 2, audience: "all" },
    { title: "Welcome to our new colleagues", body: "Please welcome Farhan Sheikh (UI/UX Designer, Bengaluru) and Sunil Gaikwad (Stores, Chakan). Tanvi Rao joins the data team next week.", kind: "joiner", days: 5, audience: "all" },
    { title: "Revised domestic travel policy", body: "From the 1st of next month, hotel limits are revised for metro cities and economy airfare is the default for trips under three hours. Details are on the HR portal.", kind: "management", days: 9, audience: "all" },
    { title: "Payments migration completed", body: "The engineering team moved all payment flows to the new platform with zero downtime. Thank you, Rohit and team!", kind: "project", days: 12, audience: "all" },
  ].map((post) => ({ tenant_id: tenantId, author_employee_id: id("emp:TG1005"), created_at: `${addDays(TODAY, -post.days)}T10:00:00+05:30`, attributes: { title: post.title, body: post.body, audience: post.audience, expires_at: addDays(TODAY, 30), kind: post.kind } })));
  await insert(client, "helpdesk_tickets", [
    ["TG1018", "Payroll", "HIGH", "Arrears for the promotion month not paid", "My revised salary was effective from the 1st but last month's payslip shows the old basic.", "OPEN", 2],
    ["TG1010", "Attendance", "MEDIUM", "Overtime on Sunday not reflected", "I worked 4 hours of overtime on Sunday for the line changeover but it is not in my attendance.", "IN_PROGRESS", 4],
    ["TG1028", "IT", "MEDIUM", "VPN access for working from home", "Please enable VPN on my laptop for the customer portal.", "OPEN", 1],
    ["TG1021", "Policy", "LOW", "Clarification on the hybrid work policy", "Is the three-days-in-office rule counted per week or per fortnight?", "RESOLVED", 12],
    ["TG1013", "Leave", "MEDIUM", "Sick leave balance looks wrong", "My SL balance shows 2 days less than expected after my last leave.", "IN_PROGRESS", 3],
    ["TG1029", "Facilities", "LOW", "Parking sticker for new vehicle", "Need a parking sticker for my new two-wheeler at Cyber City.", "CLOSED", 25],
    ["TG1024", "Onboarding", "MEDIUM", "Laptop not yet issued", "Joined three weeks ago and still using a loaner laptop.", "OPEN", 6],
  ].map(([code, category, priority, subject, description, status, daysAgo]) => ({ tenant_id: tenantId, employee_id: id(`emp:${code}`), status, created_at: `${addDays(TODAY, -(daysAgo as number))}T10:30:00+05:30`, updated_at: `${addDays(TODAY, -Math.max(0, (daysAgo as number) - 1))}T15:00:00+05:30`,
    attributes: { category, priority, subject, description, messages: status === "OPEN" ? [] : [{ author: "HR Helpdesk", body: status === "IN_PROGRESS" ? "We are looking into this and will update you shortly." : "This has been resolved. Please reopen if you need anything else.", at: `${addDays(TODAY, -Math.max(0, (daysAgo as number) - 1))}T15:00:00+05:30` }] } })));
  const month = TODAY.slice(0, 7);
  const nextMonth = addMonths(`${month}-01`, 1).slice(0, 7);
  await insert(client, "compliance_calendar_items", [
    ["PF ECR filing and payment", "ECR", `${nextMonth}-15`, "TGH"], ["ESI contribution", "ESI", `${nextMonth}-15`, "TEPL"], ["Professional tax – Maharashtra", "PT-MH", addDays(`${nextMonth}-01`, -1), "TEPL"],
    ["Professional tax – Karnataka", "PT-KA", `${nextMonth}-20`, "TDSPL"], ["TDS deposit (salary)", "TDS", `${nextMonth}-07`, "TGH"], ["Labour welfare fund – Haryana", "LWF-HR", `${nextMonth}-31`.replace(/-31$/, "-28"), "TRPL"],
    ["Quarterly TDS return (24Q)", "24Q", `${addMonths(`${month}-01`, 2).slice(0, 7)}-31`.replace(/-31$/, "-15"), "TGH"],
  ].map(([title, form, due, company]) => ({ tenant_id: tenantId, legal_entity_id: id(`le:${company}`), attributes: { title, form_code: form, due_date: due, status: "scheduled" } })));

  return { id, pendingDays };
}

/* ------------------------------------------------------------------ */
/* Pass 2: the application's own workflows                             */
/* ------------------------------------------------------------------ */

async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error(`Sign-in as ${email} failed: ${response.status} ${await response.text()}`);
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

async function call<T>(cookie: string, method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookie, "Idempotency-Key": randomUUID(), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${text.slice(0, 400)}`);
  const parsed = JSON.parse(text) as { data?: T };
  return (parsed.data ?? parsed) as T;
}

async function runWorkflows(password: string, employeeId: (key: string) => string, leavePlan: Leave[], pendingDays: Array<{ code: string; day: string }>) {
  const sessions = {
    hr: await signIn("hr@tata.com", password),
    manager: await signIn("manager@tata.com", password),
    admin: await signIn("admin@tata.com", password),
    payroll: await signIn("payroll@tata.com", password),
  };
  const loginOf = (code: string) => byCode.get(code)?.login;
  const approvers = (code: string) => (["manager", "hr", "admin"] as const).filter((who) => loginOf(code) !== `${who === "hr" ? "hr" : who}@tata.com`);

  // Leave: filed by HR on the employee's behalf (or by the employee), then decided level by level.
  let filed = 0;
  for (const leave of leavePlan) {
    const created = await call<{ id: string }>(sessions.hr, "POST", "/api/v1/leave-requests", { employeeId: employeeId(`emp:${leave.code}`), leaveType: leave.type, startsOn: leave.from, endsOn: leave.to, days: leave.days, reason: leave.reason });
    filed += 1;
    if (leave.outcome === "pending") continue;
    const chain = approvers(leave.code);
    const decide = (who: (typeof chain)[number], approve: boolean, comment: string) => call(sessions[who], "POST", `/api/v1/leave-requests/${created.id}/decide`, { approve, comment });
    if (leave.outcome === "rejected") { await decide(chain[0]!, false, "Release freeze in the last two weeks of December; please pick other dates."); continue; }
    for (const [level, who] of chain.slice(0, 3).entries()) await decide(who, true, ["Approved", "Approved by HOD", "Final approval"][level]!);
    if (chain.length < 3) throw new Error(`Not enough distinct approvers for ${leave.code}.`);
  }
  console.info(`Leave: ${filed} requests filed through the leave API.`);

  // Missing out-punches yesterday: regularisation requests waiting for approval.
  for (const entry of pendingDays) {
    await call(sessions.hr, "POST", "/api/v1/regularizations", {
      employeeId: employeeId(`emp:${entry.code}`), date: entry.day, kind: "missing-punch",
      reason: entry.code === "TG1029" ? "Forgot to punch out after the vendor meeting" : "Biometric reader at Gate 2 was down at shift end",
      claimedOut: entry.code === "TG1029" ? "18:20" : "14:05",
    });
  }
  console.info(`Regularisation: ${pendingDays.length} requests filed through the attendance API.`);

  await projectWork(sessions, employeeId, leavePlan);
  await selfUploads(password, employeeId);
}

/** Employees adding their own documents through the document library (they wait for HR to verify them). */
async function selfUploads(password: string, employeeId: (key: string) => string) {
  const tree = async (cookie: string) => call<{ types: Array<{ id: string; name: string }> }>(cookie, "GET", "/api/v1/documents/library/tree");
  const uploads: Array<{ login: string; code: string; type: string; title: string; lines: Array<{ label: string; value: string }>; issued: string }> = [
    { login: "emp1@tata.com", code: "TG1018", type: "Degree certificate", title: "B.E. degree certificate – Ananya Iyer", issued: "2019-08-10",
      lines: [{ label: "Degree", value: "Bachelor of Engineering, Information Science" }, { label: "Institute", value: "RV College of Engineering" }, { label: "Year", value: "2019" }] },
    { login: "emp2@tata.com", code: "TG1019", type: "Address proof", title: "Address proof – Rohit Verma", issued: addDays(TODAY, -40),
      lines: [{ label: "Proof", value: "Electricity bill" }, { label: "Address", value: "Whitefield, Bengaluru 560066" }] },
  ];
  for (const upload of uploads) {
    const cookie = await signIn(upload.login, password);
    const type = (await tree(cookie)).types.find((entry) => entry.name === upload.type);
    if (!type) throw new Error(`Document type ${upload.type} is missing.`);
    const person = byCode.get(upload.code)!;
    const bytes = renderPdf({ heading: upload.type, subheading: name(person), lines: [{ label: "Name", value: name(person) }, ...upload.lines, { label: "Dated", value: upload.issued }], footer: "Copy added by the employee." });
    await call(cookie, "POST", "/api/v1/documents/library", {
      employeeId: employeeId(`emp:${upload.code}`), documentTypeId: type.id, title: upload.title, issuedOn: upload.issued,
      fileName: `${upload.title.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-")}.pdf`, contentBase64: Buffer.from(bytes).toString("base64"),
    });
  }
  console.info(`Documents: ${uploads.length} added by employees through the document library.`);
}

/** Quarterly employee pulse: engagement and manager questions, answered by most of the people on the rolls at the time. */
const PULSE_QUESTIONS: Array<[string, "engagement" | "manager"]> = [
  ["I would recommend this company as a great place to work", "engagement"], ["I see myself working here in two years' time", "engagement"],
  ["I feel motivated to go beyond what is expected of me", "engagement"], ["My manager gives me regular, useful feedback", "manager"], ["My manager supports my growth and development", "manager"],
];
async function employeePulse(client: PoolClient, tenantId: string, id: (key: string) => string) {
  await insert(client, "surveys", [{ id: id("survey:pulse"), tenant_id: tenantId, attributes: { code: "PULSE", name: "Employee pulse", audience: "employees", scale: "1-5", anonymous_reporting: true } }]);
  await insert(client, "survey_questions", PULSE_QUESTIONS.map(([text, theme], index) => ({ id: id(`pq:${index}`), tenant_id: tenantId, survey_id: id("survey:pulse"), attributes: { text, theme, order: String(index + 1), kind: "scale" } })));
  // The earlier run had weaker manager scores in two teams; the action plan since then lifted them.
  const runs = [{ key: "q2", name: "Pulse, Q2 FY 2026-27", opened: -150, lift: 0 }, { key: "q3", name: "Pulse, Q3 FY 2026-27", opened: -35, lift: 1 }];
  const weakManagers = new Set(["TG1009", "TG1026"]);
  let responses = 0;
  for (const run of runs) {
    await insert(client, "survey_runs", [{ id: id(`pr:${run.key}`), tenant_id: tenantId, survey_id: id("survey:pulse"), created_at: `${addDays(TODAY, run.opened)}T09:00:00+05:30`, attributes: { name: run.name, status: run.key === "q3" ? "open" : "closed", opened_on: addDays(TODAY, run.opened), closes_on: addDays(TODAY, run.opened + 21) } }]);
    const onRolls = PEOPLE.filter((person) => person.joined <= addDays(TODAY, run.opened) && (!person.exit || person.exit.lastDay > addDays(TODAY, run.opened + 21)) && person.manager);
    const respondents = onRolls.filter((_, index) => (index + run.lift) % 6 !== 0);
    await insert(client, "survey_responses", respondents.map((person) => ({ id: id(`presp:${run.key}:${person.code}`), tenant_id: tenantId, survey_run_id: id(`pr:${run.key}`), employee_id: id(`emp:${person.code}`), created_at: `${addDays(TODAY, run.opened + between(1, 18))}T18:00:00+05:30`, attributes: { submitted: true } })));
    await insert(client, "survey_answers", respondents.flatMap((person) => PULSE_QUESTIONS.map(([, theme], q) => {
      const leaving = Boolean(person.exit);
      const managerDrag = theme === "manager" && weakManagers.has(person.manager!) && run.lift === 0 ? 1 : 0;
      const score = Math.max(1, Math.min(5, between(3, 5) - managerDrag - (leaving ? 1 : 0) + (run.lift && between(0, 2) === 0 ? 1 : 0)));
      return { tenant_id: tenantId, survey_response_id: id(`presp:${run.key}:${person.code}`), survey_question_id: id(`pq:${q}`), attributes: { score } };
    })));
    responses += respondents.length;
  }
  return responses;
}

/** Projects, allocations and two weeks of timesheets, through the projects workflow (maker HR, checker admin). */
const PROJECTS = [
  { key: "portal", code: "PRJ-2026-021", name: "Customer self-service portal v2", client: "Tata Retail Private Limited", owner: "TG1017", cost: "CC-TDSPL", budget: 9_00_000, start: -150, end: 120 },
  { key: "payments", code: "PRJ-2026-017", name: "Payments platform migration", client: undefined, owner: "TG1019", cost: "CC-TDSPL", budget: 8_50_000, start: -200, end: 45 },
  { key: "partners", code: "PRJ-2026-024", name: "Partner integrations", client: "Tata Engineering Private Limited", owner: "TG1022", cost: "CC-TDSPL", budget: 6_00_000, start: -90, end: 150 },
  { key: "line2", code: "PRJ-2026-009", name: "Line 2 automation", client: undefined, owner: "TG1008", cost: "CC-TEPL", budget: 9_80_000, start: -240, end: 90 },
] as const;
const ALLOCATIONS: Array<[string, (typeof PROJECTS)[number]["key"], number, string]> = [
  ["TG1017", "portal", 20, "Engineering manager"], ["TG1018", "portal", 60, "Backend developer"], ["TG1018", "payments", 40, "Backend developer"],
  ["TG1019", "payments", 80, "Tech lead"], ["TG1019", "partners", 20, "Reviewer"], ["TG1020", "portal", 50, "QA engineer"], ["TG1020", "payments", 50, "QA engineer"],
  ["TG1021", "payments", 50, "DevOps"], ["TG1021", "partners", 50, "DevOps"], ["TG1022", "partners", 60, "Product owner"], ["TG1022", "portal", 40, "Product owner"],
  ["TG1023", "partners", 50, "Architect"], ["TG1023", "payments", 50, "Architect"], ["TG1024", "portal", 100, "Designer"],
  ["TG1009", "line2", 30, "Production lead"], ["TG1012", "line2", 50, "Maintenance lead"],
];
const TASKS: Record<string, string[]> = {
  portal: ["Order tracking API", "Account settings screens", "Regression testing", "Sprint planning"], payments: ["UPI refund flow", "Ledger reconciliation job", "Load testing", "Cut-over runbook"],
  partners: ["Supplier catalogue sync", "OAuth onboarding", "Partner sandbox"], line2: ["PLC integration", "Changeover trial", "Operator training"],
};

async function projectWork(sessions: Record<"hr" | "admin", string>, employeeId: (key: string) => string, leavePlan: Leave[]) {
  const transition = (resource: string, record: { id: string; version: number }, action: string, who: "hr" | "admin", reason: string) =>
    call<{ id: string; version: number }>(sessions[who], "POST", `/api/v1/operations/${resource}/${record.id}/${action}`, { reason }, { "If-Match": `"${record.version}"` });
  const projects = new Map<string, string>();
  for (const project of PROJECTS) {
    let record = await call<{ id: string; version: number }>(sessions.hr, "POST", "/api/v1/operations/projects", {
      code: project.code, name: project.name, ...(project.client ? { client: project.client } : {}), employeeId: employeeId(`emp:${project.owner}`),
      startDate: addDays(TODAY, project.start), endDate: addDays(TODAY, project.end), budgetMinor: project.budget * 100, costCenter: project.cost, description: `${project.name}.`,
    });
    record = await transition("projects", record, "activate", "admin", "Approved in the portfolio review");
    projects.set(project.key, record.id);
  }
  for (const [code, project, percent, role] of ALLOCATIONS) {
    let record = await call<{ id: string; version: number }>(sessions.hr, "POST", "/api/v1/operations/allocations", {
      employeeId: employeeId(`emp:${code}`), projectId: projects.get(project)!, role, allocationPercent: percent, costCenter: PROJECTS.find((entry) => entry.key === project)!.cost,
      // Within the project's own dates.
      startDate: addDays(TODAY, Math.max(-60, PROJECTS.find((entry) => entry.key === project)!.start)), endDate: addDays(TODAY, Math.min(90, PROJECTS.find((entry) => entry.key === project)!.end)),
    });
    record = await transition("allocations", record, "submit", "hr", "Staffing plan for the quarter");
    await transition("allocations", record, "approve", "admin", "Allocation approved");
  }
  // Timesheets for the last two weeks (weekdays, skipping approved leave). This week's are waiting for approval.
  const away = new Set(leavePlan.filter((leave) => leave.outcome === "approved").flatMap((leave) => { const days: string[] = []; for (let day = leave.from; day <= leave.to; day = addDays(day, 1)) days.push(`${leave.code}:${day}`); return days; }));
  const monday = addDays(TODAY, -((weekday(TODAY) + 6) % 7));
  let logged = 0;
  for (const code of [...new Set(ALLOCATIONS.map(([person]) => person))]) {
    const mine = ALLOCATIONS.filter(([person]) => person === code);
    for (let back = 14; back >= 1; back -= 1) {
      const day = addDays(TODAY, -back);
      if (weekday(day) === 0 || weekday(day) === 6 || away.has(`${code}:${day}`)) continue;
      for (const [, project, percent] of mine) {
        const minutes = Math.round((480 * percent) / 100 / 30) * 30;
        if (minutes < 30) continue;
        const tasks = TASKS[project]!;
        let record = await call<{ id: string; version: number }>(sessions.hr, "POST", "/api/v1/operations/timesheets", {
          employeeId: employeeId(`emp:${code}`), projectId: projects.get(project)!, workDate: day, minutes, task: tasks[(back + percent) % tasks.length]!, billing: project === "payments" || project === "line2" ? "non_billable" : "billable",
        });
        record = await transition("timesheets", record, "submit", "hr", "Week submitted");
        if (day < monday) await transition("timesheets", record, "approve", "admin", "Timesheet approved");
        logged += 1;
      }
    }
  }
  console.info(`Projects: ${PROJECTS.length} projects, ${ALLOCATIONS.length} allocations and ${logged} timesheet entries through the projects workflow.`);
}

/**
 * Today's leave balances as the leave engine computes them (policy credit less approved leave),
 * stored as the dated snapshot the dashboards read. Skipped if today's snapshot exists.
 */
async function snapshotLeaveBalances(password: string, pool: Pool, tenantId: string) {
  const done = (await pool.query<{ count: string }>(`select count(*) from leave_balances where tenant_id = $1 and as_of_date = $2`, [tenantId, TODAY])).rows[0]!;
  if (Number(done.count) > 0) return;
  const hr = await signIn("hr@tata.com", password);
  const employees = (await pool.query<{ id: string }>(`select id from employees where tenant_id = $1 and status = 'active' and joining_date <= $2`, [tenantId, TODAY])).rows;
  const rows: Row[] = [];
  for (const employee of employees) {
    const result = await call<{ balances: Record<string, number> }>(hr, "GET", `/api/v1/leave-balances?employeeId=${employee.id}`);
    const balances = (result as { balances?: Record<string, number>; attributes?: { balances: Record<string, number> } }).balances ?? (result as { attributes?: { balances: Record<string, number> } }).attributes?.balances ?? {};
    for (const type of ["EL", "CL", "SL"]) {
      if (typeof balances[type] === "number") rows.push({ tenant_id: tenantId, employee_id: employee.id, leave_type: type, balance: Math.max(0, Math.round(balances[type]! * 2) / 2), as_of_date: TODAY, expires_at: type === "EL" ? null : `${TODAY.slice(0, 4)}-12-31` });
    }
  }
  const client = await pool.connect();
  try { await insert(client, "leave_balances", rows); } finally { client.release(); }
  console.info(`Leave balances: ${rows.length} balances recorded from the leave engine.`);
}

/**
 * Payroll for the last five months (finalised) and this month (calculated, waiting for approval):
 * drafted and calculated by the payroll lead, approved by the admin, finalised by the payroll lead
 * (maker/checker). Picks up where it left off if a run already exists.
 */
async function runPayroll(password: string, pool: Pool, tenantId: string) {
  const sessions = { admin: await signIn("admin@tata.com", password), payroll: await signIn("payroll@tata.com", password) };
  const employees = new Map((await pool.query<{ id: string; employee_code: string }>(`select id, employee_code from employees where tenant_id = $1`, [tenantId])).rows.map((row) => [row.employee_code, row.id]));
  const months = Array.from({ length: 6 }, (_, index) => addMonths(`${TODAY.slice(0, 7)}-01`, index - 5).slice(0, 7));
  for (const period of months) {
    const periodEnd = addDays(addMonths(`${period}-01`, 1), -1);
    const population = PEOPLE.filter((person) => person.joined <= periodEnd && (!person.exit || person.exit.lastDay >= `${period}-01`)).map((person) => employees.get(person.code)!);
    const existing = (await pool.query<{ id: string; status: string }>(`select id, status from payroll_runs where tenant_id = $1 and period = $2 and scope = 'regular' limit 1`, [tenantId, period])).rows[0];
    let runId = existing?.id;
    let status = existing?.status ?? "none";
    if (!runId) runId = (await call<{ id: string }>(sessions.payroll, "POST", "/api/v1/payroll-runs", { period, runType: "regular" })).id;
    if (status === "none" || status === "draft") { await call(sessions.payroll, "POST", `/api/v1/payroll-runs/${runId}/calculate`, { employeeIds: population }); status = "calculated"; }
    if (period === months[months.length - 1]) { console.info(`Payroll ${period}: calculated, waiting for approval.`); continue; }
    if (status !== "approved" && status !== "finalized") await call(sessions.admin, "POST", `/api/v1/payroll-runs/${runId}/approve`, {});
    if (status !== "finalized") await call(sessions.payroll, "POST", `/api/v1/payroll-runs/${runId}/finalize`, {}, { "If-Match": "\"1\"" });
    console.info(`Payroll ${period}: finalised for ${population.length} employees.`);
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  const password = process.env.DEMO_PASSWORD;
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!password) throw new Error("Set DEMO_PASSWORD.");
  if (!url) throw new Error("MIGRATION_DATABASE_URL is required.");
  const pool = new Pool({ connectionString: url, max: 2 });
  try {
    const tenant = (await pool.query<{ id: string }>(`select id from tenants where slug = 'tata'`)).rows[0];
    if (!tenant) throw new Error("Provision the Tata organisation first (npm run demo:provision).");
    // --resume picks up the leave-balance and payroll steps after an interruption.
    if (!process.argv.includes("--resume")) {
      const existing = (await pool.query<{ count: string }>(`select count(*) from employees where tenant_id = $1`, [tenant.id])).rows[0]!;
      if (Number(existing.count) > 0) throw new Error("Tata already has employees. Reset the database first (npm run demo:reset), or pass --resume.");
      const leavePlan = planLeave();
      const client = await pool.connect();
      let result: Awaited<ReturnType<typeof seedRecords>>;
      try {
        await client.query("begin");
        result = await seedRecords(client, tenant.id, leavePlan);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
      console.info(`Records: ${PEOPLE.length} employees across ${Object.keys(COMPANIES).length} companies, with attendance, documents, hiring, goals, learning and more.`);
      await runWorkflows(password, result.id, leavePlan, result.pendingDays);
    }
    await snapshotLeaveBalances(password, pool, tenant.id);
    await runPayroll(password, pool, tenant.id);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Seeding Tata failed:", (error as Error).message);
  process.exitCode = 1;
});
