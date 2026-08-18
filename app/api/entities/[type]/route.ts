import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createEntity, EntityType, updateEntity } from "@/lib/repository";

const allowedTypes = new Set(["systems", "categories", "statuses", "users"]);
const categoryColors = new Set(["blue", "amber", "violet", "slate", "emerald", "rose"]);
const statusColors = new Set(["neutral", "blue", "amber", "violet", "red", "green"]);

function validatePayload(type: string, payload: Record<string, unknown>, creating: boolean) {
  if ((creating || "name" in payload) && !String(payload.name ?? "").trim()) return "Informe o nome.";
  if (type === "users" && (creating || "email" in payload)) {
    const email = String(payload.email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe um e-mail válido.";
  }
  if (type === "users" && (creating || Boolean(payload.password))) {
    if (String(payload.password ?? "").length < 6) return "A senha deve possuir pelo menos 6 caracteres.";
  }
  if (type === "categories" && "color" in payload && !categoryColors.has(String(payload.color))) return "Cor de categoria inválida.";
  if (type === "statuses" && "color" in payload && !statusColors.has(String(payload.color))) return "Cor de status inválida.";
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ type: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { type } = await context.params;
    if (!allowedTypes.has(type)) return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    const payload = await request.json();
    const validationError = validatePayload(type, payload, true);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
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
    const { type } = await context.params;
    if (!allowedTypes.has(type)) return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    const { id, changes } = await request.json();
    if (typeof id !== "string" || !id || !changes || typeof changes !== "object") return NextResponse.json({ error: "Dados de edição inválidos." }, { status: 400 });
    const validationError = validatePayload(type, changes, false);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    await updateEntity(type as EntityType, id, changes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mysqlError = error as { code?: string };
    if (mysqlError.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Já existe um item com estes dados." }, { status: 409 });
    console.error("Update entity error", error);
    return NextResponse.json({ error: "Não foi possível atualizar o item." }, { status: 500 });
  }
}
