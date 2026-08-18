import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION } from "@/lib/auth";
import { query } from "@/lib/db";

interface LoginRow extends RowDataPacket { id: string; passwordHash: string; active: number; }

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string") return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
    const rows = await query<LoginRow[]>("select id, password_hash as passwordHash, active from users where email = ? limit 1", [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Login error", error);
    return NextResponse.json({ error: "Não foi possível acessar o banco de dados." }, { status: 500 });
  }
}
