import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { env } from "~/env";

const uploadDir = () =>
  resolve(/* turbopackIgnore: true */ process.cwd(), env.UPLOAD_DIR);

export async function ensureUploadDir(): Promise<void> {
  await mkdir(uploadDir(), { recursive: true });
}

export function pathForDocument(documentId: string): string {
  return resolve(uploadDir(), `${documentId}.pdf`);
}

export async function savePdf(
  documentId: string,
  bytes: Uint8Array,
): Promise<string> {
  await ensureUploadDir();
  const path = pathForDocument(documentId);
  await writeFile(path, bytes);
  return path;
}

export async function deletePdf(documentId: string): Promise<void> {
  try {
    await unlink(pathForDocument(documentId));
  } catch (err) {
    // Ignore if already gone — DB delete should still succeed
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
