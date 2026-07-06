import ExcelJS from "exceljs";
import { GeneratedTestCase, QualityReport } from "../core/types";

/**
 * Renders generated test cases into the supported delivery formats.
 */
export class OutputFormatter {
  formatPlaywright(testCases: GeneratedTestCase[]): string {
    const header = `import { test, expect } from '@playwright/test';\n\n`;
    const body = testCases
      .map((tc) => {
        const comment = `// ${tc.skillId} - ${tc.metadata.testName}`;
        return `${comment}\n${this.extractTestCode(tc.code)}`;
      })
      .join("\n\n");
    return header + body + "\n";
  }

  formatJSON(testCases: GeneratedTestCase[]): string {
    const payload = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalTests: testCases.length,
        framework: testCases[0]?.framework ?? "playwright",
      },
      testCases: testCases.map((tc) => ({
        skillId: tc.skillId,
        testName: tc.metadata.testName,
        steps: tc.metadata.steps,
        assertions: tc.metadata.assertions,
        expectedResult: tc.metadata.expectedResult,
        tags: tc.metadata.tags,
        priority: tc.metadata.priority,
        score: tc.evaluation?.overallScore,
        code: tc.code,
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  async formatXLSX(testCases: GeneratedTestCase[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "test-case-generator";
    const sheet = wb.addWorksheet("Test Cases");

    sheet.columns = [
      { header: "Skill ID", key: "skillId", width: 18 },
      { header: "Test Name", key: "testName", width: 48 },
      { header: "Steps", key: "steps", width: 60 },
      { header: "Expected Result", key: "expected", width: 40 },
      { header: "Priority", key: "priority", width: 12 },
      { header: "Tags", key: "tags", width: 24 },
      { header: "Score", key: "score", width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const tc of testCases) {
      sheet.addRow({
        skillId: tc.skillId,
        testName: tc.metadata.testName,
        steps: tc.metadata.steps
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n"),
        expected: tc.metadata.expectedResult ?? "",
        priority: tc.metadata.priority,
        tags: tc.metadata.tags.join(", "),
        score: tc.evaluation?.overallScore ?? "",
      });
    }
    sheet.eachRow((row) => (row.alignment = { wrapText: true, vertical: "top" }));

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  formatReport(report: QualityReport): string {
    return JSON.stringify(report, null, 2);
  }

  private extractTestCode(code: string): string {
    const cleaned = code.replace(/```(?:[a-z]+)?/gi, "").trim();
    return cleaned;
  }
}
