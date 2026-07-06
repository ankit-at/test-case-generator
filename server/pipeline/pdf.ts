// Extract plain text from a PDF buffer.
// Import the library entry point directly to avoid pdf-parse's debug-mode
// side effect (it reads a bundled test file when required as the main module).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  data: Buffer
) => Promise<{ text: string; numpages: number }>;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text.replace(/\r/g, "").trim();
}
