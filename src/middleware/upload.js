const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { maxResumeSizeMb } = require("../config/env");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "resumes");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // Generated filename - never the client-supplied one - to prevent path traversal
  // and filename-collision/overwrite attacks (Section 16, File upload safety).
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only PDF, DOC, or DOCX resumes are accepted"));
  }
  cb(null, true);
}

const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxResumeSizeMb * 1024 * 1024, files: 1 },
}).single("resume");

module.exports = { uploadResume, UPLOAD_DIR };
