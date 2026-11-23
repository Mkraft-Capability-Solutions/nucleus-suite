/**
 * Assisted input from a resume (approved design, step 1). Runs on the device over plain
 * text the user pasted or chose; nothing is uploaded. Every value it finds is only a
 * suggestion: it lands in the review step marked "from resume" for the user to confirm.
 */

export type ResumeFindings = {
  firstName?: string;
  lastName?: string;
  personalEmail?: string;
  mobile?: string;
  degree?: string;
  passingYear?: string;
  employer?: string;
  designation?: string;
};

const DEGREES = ["B.Tech", "B.E.", "B.Sc", "B.Com", "BBA", "BCA", "M.Tech", "M.Sc", "MBA", "MCA", "PhD", "Diploma"];
const TITLE_WORDS = /\b(engineer|manager|analyst|designer|developer|lead|consultant|specialist|executive|officer|technician|operator|supervisor|associate)\b/i;

function normaliseDegree(raw: string): string | undefined {
  const key = raw.replace(/[.\s]/g, "").toLowerCase();
  return DEGREES.find((degree) => degree.replace(/[.\s]/g, "").toLowerCase() === key);
}

export function readResumeText(text: string, currentYear: number): ResumeFindings {
  const out: ResumeFindings = {};
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text);
  if (email) out.personalEmail = email[0];
  const phone = /(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})\b/.exec(text);
  if (phone) out.mobile = phone[1].replace(/\D/g, "");

  const lines = text.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const words = first.split(/\s+/);
  if (first && !/[@\d]/.test(first) && words.length >= 2 && words.length <= 4 && words.every((word) => /^[\p{L}.'-]+$/u.test(word))) {
    out.firstName = words[0];
    out.lastName = words[words.length - 1];
  }

  const degree = /\b(B\.?\s?Tech|B\.?\s?E\.?|B\.?\s?Sc|B\.?\s?Com|BBA|BCA|M\.?\s?Tech|M\.?\s?Sc|MBA|MCA|Ph\.?\s?D|Diploma)\b/i.exec(text);
  if (degree) out.degree = normaliseDegree(degree[1]);
  const years = (text.match(/\b(19[5-9]\d|20\d{2})\b/g) ?? []).map(Number).filter((year) => year <= currentYear);
  if (years.length > 0) out.passingYear = String(Math.max(...years));

  const title = lines.find((line) => TITLE_WORDS.test(line) && line.length < 80);
  if (title) out.designation = title.replace(/\s+(at|@)\s+.*$/i, "").replace(/[|•–-].*$/, "").trim() || undefined;
  const employerLine = lines.find((line) => /\s(?:at|@)\s+\p{Lu}/u.test(line) && line.length < 100);
  if (employerLine) {
    const employer = employerLine.split(/\s(?:at|@)\s/)[1]?.replace(/[|•–,(].*$/, "").trim();
    if (employer) out.employer = employer;
  }
  for (const key of Object.keys(out) as Array<keyof ResumeFindings>) if (!out[key]) delete out[key];
  return out;
}
