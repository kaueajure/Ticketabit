import "server-only";

import bcrypt from "bcryptjs";
import { RowDataPacket } from "mysql2/promise";
import { execute, query } from "@/lib/db";
import { ThemePreference } from "@/lib/types";

interface PasswordRow extends RowDataPacket {
  passwordHash: string;
}

interface PhotoRow extends RowDataPacket {
  data: Buffer;
  mime: string;
}

export async function updateOwnAccount(userId: string, name: string) {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  if (normalizedName.length < 2 || normalizedName.length > 120) {
    throw new Error("O nome deve possuir entre 2 e 120 caracteres.");
  }
  await execute("update users set name = ? where id = ? and active = true", [normalizedName, userId]);
}

export async function updateOwnTheme(userId: string, theme: ThemePreference) {
  if (theme !== "light" && theme !== "dark") throw new Error("Tema inválido.");
  await execute("update users set theme = ? where id = ? and active = true", [theme, userId]);
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  if (!currentPassword) throw new Error("Informe sua senha atual.");
  if (newPassword.length < 6) throw new Error("A nova senha deve possuir pelo menos 6 caracteres.");
  if (currentPassword === newPassword) throw new Error("A nova senha deve ser diferente da senha atual.");

  const rows = await query<PasswordRow[]>("select password_hash as passwordHash from users where id = ? and active = true limit 1", [userId]);
  if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].passwordHash))) {
    throw new Error("A senha atual está incorreta.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await execute("update users set password_hash = ? where id = ?", [passwordHash, userId]);
}

export async function saveProfilePhoto(userId: string, data: Buffer, mime: string) {
  await execute("update users set avatar_data = ?, avatar_mime = ?, avatar_updated_at = current_timestamp where id = ? and active = true", [data, mime, userId]);
}

export async function removeProfilePhoto(userId: string) {
  await execute("update users set avatar_data = null, avatar_mime = null, avatar_updated_at = null where id = ?", [userId]);
}

export async function getProfilePhoto(userId: string) {
  const rows = await query<PhotoRow[]>("select avatar_data as data, avatar_mime as mime from users where id = ? and active = true and avatar_data is not null limit 1", [userId]);
  return rows[0] ?? null;
}
