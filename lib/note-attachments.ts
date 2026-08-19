import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const imageTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const extensionTypes = new Map([...imageTypes].map(([mimeType, extension]) => [extension, mimeType]));
const fileIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp|gif)$/i;

function uploadsRoot() {
  const configured = process.env.UPLOADS_DIR?.trim();
  return resolve(configured || "../uploads", "notes");
}

function userDirectory(userId: string) {
  if (!/^[a-z0-9-]{1,80}$/i.test(userId)) throw new Error("Usuário inválido para armazenamento de anexos.");
  return resolve(uploadsRoot(), userId);
}

function attachmentPath(userId: string, fileId: string) {
  if (!fileIdPattern.test(fileId)) throw new Error("Anexo inválido.");
  return resolve(userDirectory(userId), fileId);
}

export async function saveNoteAttachment(userId: string, file: File) {
  const extension = imageTypes.get(file.type);
  if (!extension) throw new Error("Use uma imagem PNG, JPEG, WebP ou GIF.");
  if (!file.size || file.size > 1_500_000) throw new Error("A imagem deve possuir no máximo 1,5 MB.");
  const directory = userDirectory(userId);
  await mkdir(directory, { recursive: true });
  const fileId = `${randomUUID()}.${extension}`;
  const path = attachmentPath(userId, fileId);
  await writeFile(path, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o640 });
  return { fileId, name: file.name.trim().slice(0, 180) || `imagem.${extension}`, mimeType: file.type };
}

export async function readNoteAttachment(userId: string, fileId: string) {
  const extension = fileId.split(".").at(-1)?.toLowerCase() ?? "";
  const mimeType = extensionTypes.get(extension);
  if (!mimeType) throw new Error("Anexo inválido.");
  return { data: await readFile(attachmentPath(userId, fileId)), mimeType };
}

export async function deleteNoteAttachment(userId: string, fileId: string) {
  try {
    await unlink(attachmentPath(userId, fileId));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

export function attachmentFileIdsFromContent(content: string) {
  try {
    const blocks = JSON.parse(content) as Array<{ attachments?: Array<{ fileId?: unknown }> }>;
    if (!Array.isArray(blocks)) return [];
    return [...new Set(blocks.flatMap((block) => Array.isArray(block?.attachments)
      ? block.attachments.flatMap((attachment) => typeof attachment?.fileId === "string" && fileIdPattern.test(attachment.fileId) ? [attachment.fileId] : [])
      : []))];
  } catch {
    return [];
  }
}

export async function deleteNoteAttachments(userId: string, contents: string[]) {
  const fileIds = [...new Set(contents.flatMap(attachmentFileIdsFromContent))];
  await Promise.all(fileIds.map((fileId) => deleteNoteAttachment(userId, fileId)));
}
