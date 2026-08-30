// TODO: Implement backend/src/storage/file.store.ts
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export async function ensureUploadDirectories(): Promise<void> {
  await fs.mkdir(path.join(UPLOADS_DIR, "questions"), {
    recursive: true,
  });

  await fs.mkdir(path.join(UPLOADS_DIR, "answers"), {
    recursive: true,
  });
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: unknown) {
    const fsError = error as NodeJS.ErrnoException;

    if (fsError.code !== "ENOENT") {
      throw error;
    }
  }
}

export async function deleteDirectory(
  directoryPath: string
): Promise<void> {
  await fs.rm(directoryPath, {
    recursive: true,
    force: true,
  });
}

export function getQuestionUploadDirectory(): string {
  return path.join(UPLOADS_DIR, "questions");
}

export function getAnswerUploadDirectory(): string {
  return path.join(UPLOADS_DIR, "answers");
}