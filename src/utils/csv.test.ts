import { describe, it, expect } from "vitest";
import { csvRows } from "./csv";
describe("spreadsheet-safe leave report export", () => {
  it("quotes delimiters and neutralizes formula prefixes", () => {
    expect(
      csvRows([
        ["Name", "Comment"],
        ["Employee", 'a,"b"'],
        ['=HYPERLINK("https://example.com")', "\t+SUM(1,2)"],
      ]),
    ).toContain('"a,""b"""');
    expect(csvRows([["=1+1", " @SUM(1,2)"]])).toBe('"\'=1+1","\' @SUM(1,2)"');
  });
});
