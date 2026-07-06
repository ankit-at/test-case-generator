import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../auth";
import { extractPdfText } from "../pipeline/pdf";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

// Accepts a PDF and returns extracted text (plus a short preview) so the UI
// can show what will be used as context before generation.
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: "No file uploaded." });
  if (file.mimetype !== "application/pdf" && !file.originalname.endsWith(".pdf")) {
    return res.status(400).json({ error: "Only PDF files are supported." });
  }
  try {
    const text = await extractPdfText(file.buffer);
    if (!text) {
      return res
        .status(422)
        .json({ error: "Could not extract text (is the PDF scanned/empty?)." });
    }
    res.json({
      filename: file.originalname,
      charCount: text.length,
      preview: text.slice(0, 1200),
      text,
    });
  } catch (err) {
    res.status(500).json({ error: `PDF parse failed: ${(err as Error).message}` });
  }
});

export default router;
