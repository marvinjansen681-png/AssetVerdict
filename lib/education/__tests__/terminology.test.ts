import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Phase 2, section 26/10: obsolete user-facing terminology ("Net Yield Yr 1
 * (pre-tax)") must not remain anywhere the user sees it — Deal Summary or
 * PDF — now that it's taught as "Cash-on-Cash Return". This reads the actual
 * source files rather than re-testing rendered output, which is enough to
 * catch a reverted or half-done rename.
 */
const SUMMARY_PAGE = resolve(__dirname, "../../../app/(app)/deals/[id]/summary/page.tsx");
const PDF_FILE = resolve(__dirname, "../../pdf/DealSummaryPDF.tsx");

describe("obsolete 'Net Yield' terminology is gone from user-facing surfaces", () => {
  it("Deal Summary page no longer labels a gauge 'Net Yield Yr 1'", () => {
    const source = readFileSync(SUMMARY_PAGE, "utf-8");
    expect(source).not.toContain("Net Yield Yr 1");
    expect(source).toContain("Cash-on-Cash Return (Pre-Tax)");
    expect(source).toContain("Cash-on-Cash Return (Post-Tax)");
  });

  it("PDF export no longer labels a row 'Net Yield'", () => {
    const source = readFileSync(PDF_FILE, "utf-8");
    expect(source).not.toContain("Net Yield Yr 1");
    expect(source).not.toContain('"Net Yield (pre-tax)"');
    expect(source).toContain("Cash-on-Cash Return");
  });
});
