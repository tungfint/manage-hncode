import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Gender, StudentStatus } from "@/generated/prisma/client";

export type StudentImportRow = {
  rowNumber: number;
  fullName: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  email?: string;
  school?: string;
  schoolGrade?: string;
  classCode?: string;
  classId?: string;
  className?: string;
  entryLevel?: string;
  hncodeAccount?: string;
  status: StudentStatus;
  note?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  relationship?: string;
};

export type StudentImportError = {
  rowNumber: number;
  message: string;
};

export type StudentImportPreview = {
  token: string;
  fileName: string;
  createdAt: string;
  validRows: StudentImportRow[];
  errors: StudentImportError[];
  importedRows?: StudentImportRow[];
  importErrors?: StudentImportError[];
  confirmedAt?: string;
};

const PREVIEW_DIR = path.join(tmpdir(), "hncode-student-import-previews");

function previewPath(token: string) {
  return path.join(PREVIEW_DIR, `${token}.json`);
}

export async function saveStudentImportPreview(
  preview: Omit<StudentImportPreview, "token" | "createdAt">,
) {
  await mkdir(PREVIEW_DIR, { recursive: true });
  const token = randomUUID();
  const data: StudentImportPreview = {
    ...preview,
    token,
    createdAt: new Date().toISOString(),
  };

  await writeFile(previewPath(token), JSON.stringify(data), "utf8");
  return data;
}

export async function updateStudentImportPreview(preview: StudentImportPreview) {
  await mkdir(PREVIEW_DIR, { recursive: true });
  await writeFile(previewPath(preview.token), JSON.stringify(preview), "utf8");
}

export async function getStudentImportPreview(token?: string) {
  if (!token || !/^[a-f0-9-]{36}$/i.test(token)) {
    return null;
  }

  try {
    return JSON.parse(
      await readFile(previewPath(token), "utf8"),
    ) as StudentImportPreview;
  } catch {
    return null;
  }
}

export async function deleteStudentImportPreview(token?: string) {
  if (!token || !/^[a-f0-9-]{36}$/i.test(token)) {
    return;
  }

  await rm(previewPath(token), { force: true });
}
