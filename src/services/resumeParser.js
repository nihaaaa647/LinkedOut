const fs = require("fs/promises");
const pdfParse = require("pdf-parse");
const { extractSkillsFromText } = require("./normalizeSkill");

// Best-effort text extraction: PDFs are fully parsed via pdf-parse. .doc/.docx aren't
// parsed for MVP (no lightweight pure-JS parser in the chosen stack) - upload still
// succeeds, it just returns no auto-detected skills, which is a safe/explicit fallback
// rather than a silent failure.
async function extractResumeText(filePath, mimeType) {
  if (mimeType !== "application/pdf") return "";
  const buffer = await fs.readFile(filePath);
  const { text } = await pdfParse(buffer);
  return text;
}

// Resume parsing is a convenience layer on top of manual skill entry (Section 6), never
// a requirement - if the file can't be parsed (corrupt/unusual PDF), the upload still
// succeeds with no auto-detected skills rather than failing the whole request.
async function parseResumeSkills(filePath, mimeType) {
  try {
    const text = await extractResumeText(filePath, mimeType);
    if (!text) return [];
    return await extractSkillsFromText(text);
  } catch (err) {
    console.warn("Resume parsing failed, continuing without auto-detected skills:", err.message);
    return [];
  }
}

module.exports = { parseResumeSkills };
