import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createEntity, EntityType, updateEntity } from "@/lib/repository";

const allowedTypes = new Set(["systems", "categories", "users", "stages"]);

export async function POST(request: Request, context: { params: Promise<{ type: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    if (user.role !== "Administrador") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    const { type } = await context.params;
    if (!allowedTypes.has(type)) return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    const payload = await request.json();
    if (!payload.name?.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
    const id = await createEntity(type as EntityType, payload);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const mysqlError = error as { code?: string; message?: string };
    if (mysqlError.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Já existe um item com estes dados." }, { status: 409 });
    return NextResponse.json({ error: mysqlError.message ?? "Não foi possível adicionar o item." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ type: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    if (user.role !== "Administrador") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    const { type } = await context.params;
    if (!allowedTypes.has(type)) return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    const { id, changes } = await request.json();
    await updateEntity(type as EntityType, id, changes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update entity error", error);
    return NextResponse.json({ error: "Não foi possível atualizar o item." }, { status: 500 });
  }
}
