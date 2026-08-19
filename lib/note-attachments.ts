import "server-only";

import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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

function validImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function saveNoteAttachment(userId: string, input: { body: ReadableStream<Uint8Array> | null; mimeType: string; name: string }) {
  const extension = imageTypes.get(input.mimeType);
  if (!extension) throw new Error("Use uma imagem PNG, JPEG, WebP ou GIF.");
  if (!input.body) throw new Error("O arquivo enviado está vazio.");
  const directory = userDirectory(userId);
  await mkdir(directory, { recursive: true });
  const fileId = `${randomUUID()}.${extension}`;
  const path = attachmentPath(userId, fileId);
  try {
    await pipeline(Readable.fromWeb(input.body as never), createWriteStream(path, { flags: "wx", mode: 0o640 }));
    const handle = await open(path, "r");
    const signature = Buffer.alloc(12);
    try { await handle.read(signature, 0, signature.length, 0); } finally { await handle.close(); }
    if (!validImageSignature(signature, input.mimeType)) throw new Error("O conteúdo do arquivo não corresponde a uma imagem válida.");
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
  return { fileId, name: input.name.trim().slice(0, 180) || `imagem.${extension}`, mimeType: input.mimeType };
}

export async function readNoteAttachment(userId: string, fileId: string) {
  const extension = fileId.split(".").at(-1)?.toLowerCase() ?? "";
  const mimeType = extensionTypes.get(extension);
  if (!mimeType) throw new Error("Anexo inválido.");
  const path = attachmentPath(userId, fileId);
  const details = await stat(path);
  return { stream: Readable.toWeb(createReadStream(path)), size: details.size, mimeType };
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
