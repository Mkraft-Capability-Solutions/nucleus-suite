const CODE = "S(?:10|[1-9])";
const PREFIX = new RegExp(`^\\s*${CODE}\\s*[:\\-–]\\s*`);
const PAREN = new RegExp(`\\s*\\(${CODE}\\)`, "g");

/** Removes internal console codes ("S1: ", "(S3)") from a display label. A bare code is returned unchanged. */
export function stripConsoleCode(label: string): string {
  if (new RegExp(`^${CODE}$`).test(label.trim())) return label;
  return label.replace(PREFIX, "").replace(PAREN, "");
}
