import "server-only";

import { randomUUID } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { execute, query, withTransaction } from "@/lib/db";
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
  if (Buffer.byteLength(content, "utf8") > 1_000_000) throw new Error("A anotação ultrapassou o limite de 1 MB.");
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error();
  } catch {
    throw new Error("O conteúdo da anotação é inválido.");
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
  const result = await execute("delete from note_folders where id = ? and user_id = ?", [id, userId]);
  if (!result.affectedRows) throw new Error("Pasta não encontrada.");
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
    if (!entries.length) throw new Error("Nenhuma alteração válida foi informada.");
    const [result] = await connection.execute<ResultSetHeader>(
      `update notes set ${entries.map((entry) => `${entry.column} = ?`).join(", ")} where id = ? and user_id = ?`,
      [...entries.map((entry) => entry.value), id, userId],
    );
    if (!result.affectedRows) throw new Error("Arquivo não encontrado.");
  });
}

export async function deleteNoteFile(userId: string, id: string) {
  const result = await execute("delete from notes where id = ? and user_id = ?", [id, userId]);
  if (!result.affectedRows) throw new Error("Arquivo não encontrado.");
}
