import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// Upload directories
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const QUESTIONS_DIR = path.join(UPLOADS_DIR, "questions");
const ANSWERS_DIR = path.join(UPLOADS_DIR, "answers");

// Ensure directories exist
fs.mkdirSync(QUESTIONS_DIR, { recursive: true });
fs.mkdirSync(ANSWERS_DIR, { recursive: true });

// Allowed file types
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Maximum file size: 20 MB
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Multer storage configuration.
 *
 * Question papers are stored in:
 * uploads/questions/
 *
 * Answer sheets are stored in:
 * uploads/answers/
 */
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === "questionPaper") {
      cb(null, QUESTIONS_DIR);
      return;
    }

    if (file.fieldname === "answerSheet") {
      cb(null, ANSWERS_DIR);
      return;
    }

    cb(new Error("Invalid file field."), "");
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;

    cb(null, uniqueName);
  },
});

/**
 * Validate uploaded file type.
 */
function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(
      new Error(
        "Invalid file type. Only PDF, JPEG, PNG, and WebP files are allowed."
      )
    );

    return;
  }

  cb(null, true);
}

/**
 * Upload middleware for creating an assessment.
 *
 * Expected multipart/form-data fields:
 *
 * questionPaper → 1 file
 * answerSheet   → 1 file
 */
export const assessmentUpload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 2,
  },

  fileFilter,
}).fields([
  {
    name: "questionPaper",
    maxCount: 1,
  },
  {
    name: "answerSheet",
    maxCount: 1,
  },
]);