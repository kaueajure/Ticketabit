import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";
import { ThemePreference, User } from "@/lib/types";

export const SESSION_COOKIE = "ticketabit_session";
export const SESSION_DURATION = 60 * 60 * 24 * 7;

interface SessionPayload { userId: string; expiresAt: number; }
interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  active: number;
  avatarUpdatedAt: string | null;
  theme: ThemePreference | string;
}

function avatarUrl(id: string, updatedAt: string | null) {
  return updatedAt ? `/api/account/photo/${id}?v=${encodeURIComponent(updatedAt)}` : null;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET deve possuir pelo menos 32 caracteres.");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload: SessionPayload = { userId, expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readSessionToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    return payload.expiresAt > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const rows = await query<UserRow[]>("select id, name, email, active, avatar_updated_at as avatarUpdatedAt, theme from users where id = ? and active = 1 limit 1", [session.userId]);
  if (!rows[0]) return null;
  const { avatarUpdatedAt, ...user } = rows[0];
  return { ...user, theme: user.theme === "dark" ? "dark" : "light", active: Boolean(user.active), avatarUrl: avatarUrl(user.id, avatarUpdatedAt) };
}
