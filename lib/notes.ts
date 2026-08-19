import "server-only";

import { randomUUID } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { execute, query, withTransaction } from "@/lib/db";
import { attachmentFileIdsFromContent, deleteNoteAttachment, deleteNoteAttachments } from "@/lib/note-attachments";
import { NoteFile, NoteFileType, NoteFolder, NotesData } from "@/lib/types";

interface NoteFolderRow extends RowDataPacket, NoteFolder {}
interface NoteFileRow extends RowDataPacket, NoteFile {}

const noteTypes = new Set<NoteFileType>(["text", "checklist"]);

function initialContent(type: NoteFileType) {
  return JSON.stringify([
    { id: randomUUID(), type: type === "checklist" ? "checklist" : "text", content: "", ...(type === "checklist" ? { checked: false } : {}) },
  ]);
}

function cleanName(value: string, label: string, maxLength: number) {
  const name = value.trim();
  if (!name) throw new Error(`Informe ${label}.`);
  if (name.length > maxLength) throw new Error(`${label} deve possuir no máximo ${maxLength} caracteres.`);
  return name;
}

function cleanType(value: string): NoteFileType {
  if (!noteTypes.has(value as NoteFileType)) throw new Error("Escolha um tipo de arquivo válido.");
  return value as NoteFileType;
}

function validateContent(content: string) {
  if (Buffer.byteLength(content, "utf8") > 10_000_000) throw new Error("A anotação ultrapassou o limite de 10 MB.");
  try {
    const parsed = JSON.parse(content) as Array<{ attachments?: unknown }>;
    if (!Array.isArray(parsed)) throw new Error();
    const attachments = parsed.flatMap((block) => Array.isArray(block?.attachments) ? block.attachments : []);
    if (attachments.length > 40) throw new Error("Uma anotação pode ter no máximo 40 anexos.");
    for (const raw of attachments) {
      if (!raw || typeof raw !== "object") throw new Error("Existe um anexo inválido.");
      const attachment = raw as Record<string, unknown>;
      if (typeof attachment.id !== "string" || !attachment.id || (attachment.type !== "image" && attachment.type !== "comment")) throw new Error("Existe um anexo inválido.");
      if (attachment.type === "comment") {
        if (typeof attachment.comment !== "string" || !attachment.comment.trim() || attachment.comment.length > 1_000) throw new Error("O comentário do anexo deve possuir até 1.000 caracteres.");
      } else {
        if (typeof attachment.name !== "string" || !attachment.name || attachment.name.length > 180) throw new Error("O nome do anexo é inválido.");
        if (typeof attachment.fileId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp|gif)$/i.test(attachment.fileId)) throw new Error("A imagem anexada ainda não foi enviada.");
        if (typeof attachment.mimeType !== "string" || !new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]).has(attachment.mimeType)) throw new Error("O formato da imagem anexada é inválido.");
      }
      if (attachment.position !== undefined && (!Number.isInteger(attachment.position) || Number(attachment.position) < 0)) throw new Error("A posição do anexo é inválida.");
    }
  } catch {
    throw new Error("O conteúdo ou algum anexo da anotação é inválido.");
  }
  return content;
}

function responsibleIdsFromContent(content: string) {
  const blocks = JSON.parse(content) as Array<{ responsibleId?: unknown }>;
  return [...new Set(blocks.flatMap((block) => typeof block?.responsibleId === "string" && block.responsibleId.trim() ? [block.responsibleId.trim()] : []))];
}

export async function getNotesData(userId: string): Promise<NotesData> {
  const [folders, notes] = await Promise.all([
    query<NoteFolderRow[]>(`select id, name, position, created_at as createdAt, updated_at as updatedAt
      from note_folders where user_id = ? order by position, created_at`, [userId]),
    query<NoteFileRow[]>(`select id, folder_id as folderId, title, type, content, created_at as createdAt, updated_at as updatedAt
      from notes where user_id = ? order by updated_at desc`, [userId]),
  ]);
  return { folders, notes: notes.map((note) => ({ ...note, type: noteTypes.has(note.type) ? note.type : "text" })) };
}

export async function createNoteFolder(userId: string, rawName: string) {
  const id = randomUUID();
  const name = cleanName(rawName, "o nome da pasta", 120);
  const rows = await query<RowDataPacket[]>("select coalesce(max(position), -1) + 1 as position from note_folders where user_id = ?", [userId]);
  const position = Number(rows[0]?.position ?? 0);
  await execute("insert into note_folders (id, user_id, name, position) values (?, ?, ?, ?)", [id, userId, name, position]);
  return id;
}

export async function updateNoteFolder(userId: string, id: string, rawName: string) {
  const name = cleanName(rawName, "o nome da pasta", 120);
  const result = await execute("update note_folders set name = ? where id = ? and user_id = ?", [name, id, userId]);
  if (!result.affectedRows) throw new Error("Pasta não encontrada.");
}

export async function deleteNoteFolder(userId: string, id: string) {
  const notes = await query<RowDataPacket[]>("select content from notes where folder_id = ? and user_id = ?", [id, userId]);
  const result = await execute("delete from note_folders where id = ? and user_id = ?", [id, userId]);
  if (!result.affectedRows) throw new Error("Pasta não encontrada.");
  await deleteNoteAttachments(userId, notes.map((note) => String(note.content))).catch((error) => console.error("Delete note folder attachments error", error));
}

export async function createNoteFile(userId: string, folderId: string, rawTitle: string, rawType: string) {
  const id = randomUUID();
  const title = cleanName(rawTitle, "o nome do arquivo", 180);
  const type = cleanType(rawType);
  const folders = await query<RowDataPacket[]>("select id from note_folders where id = ? and user_id = ? limit 1", [folderId, userId]);
  if (!folders[0]) throw new Error("Pasta não encontrada.");
  await execute("insert into notes (id, folder_id, user_id, title, type, content) values (?, ?, ?, ?, ?, ?)", [id, folderId, userId, title, type, initialContent(type)]);
  return id;
}

export async function updateNoteFile(userId: string, id: string, changes: { title?: string; content?: string; folderId?: string }) {
  const entries: Array<{ column: string; value: string }> = [];
  const responsibleIds = typeof changes.content === "string" ? responsibleIdsFromContent(changes.content) : [];
  if (typeof changes.title === "string") entries.push({ column: "title", value: cleanName(changes.title, "o nome do arquivo", 180) });
  if (typeof changes.content === "string") entries.push({ column: "content", value: validateContent(changes.content) });

  let removedFileIds: string[] = [];
  await withTransaction(async (connection) => {
    if (responsibleIds.length) {
      const [users] = await connection.execute<RowDataPacket[]>(`select id from users where active = 1 and id in (${responsibleIds.map(() => "?").join(", ")})`, responsibleIds);
      if (users.length !== responsibleIds.length) throw new Error("Um dos responsáveis não existe ou está inativo.");
    }
    if (typeof changes.folderId === "string") {
      const [folders] = await connection.execute<RowDataPacket[]>("select id from note_folders where id = ? and user_id = ? limit 1", [changes.folderId, userId]);
      if (!folders[0]) throw new Error("Pasta de destino não encontrada.");
      entries.push({ column: "folder_id", value: changes.folderId });
    }
    if (typeof changes.content === "string") {
      const [currentNotes] = await connection.execute<RowDataPacket[]>("select content from notes where id = ? and user_id = ? limit 1 for update", [id, userId]);
      if (!currentNotes[0]) throw new Error("Arquivo não encontrado.");
      const nextFileIds = new Set(attachmentFileIdsFromContent(changes.content));
      removedFileIds = attachmentFileIdsFromContent(String(currentNotes[0].content)).filter((fileId) => !nextFileIds.has(fileId));
    }
    if (!entries.length) throw new Error("Nenhuma alteração válida foi informada.");
    const [result] = await connection.execute<ResultSetHeader>(
      `update notes set ${entries.map((entry) => `${entry.column} = ?`).join(", ")} where id = ? and user_id = ?`,
      [...entries.map((entry) => entry.value), id, userId],
    );
    if (!result.affectedRows) throw new Error("Arquivo não encontrado.");
  });
  await Promise.all(removedFileIds.map((fileId) => deleteNoteAttachment(userId, fileId))).catch((error) => console.error("Delete removed note attachments error", error));
}

export async function deleteNoteFile(userId: string, id: string) {
  const notes = await query<RowDataPacket[]>("select content from notes where id = ? and user_id = ? limit 1", [id, userId]);
  const result = await execute("delete from notes where id = ? and user_id = ?", [id, userId]);
  if (!result.affectedRows) throw new Error("Arquivo não encontrado.");
  if (notes[0]) await deleteNoteAttachments(userId, [String(notes[0].content)]).catch((error) => console.error("Delete note attachments error", error));
}
