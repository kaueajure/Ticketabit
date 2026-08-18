import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteNoteFolder, updateNoteFolder } from "@/lib/notes";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { id } = await context.params;
    const body = await request.json() as { name?: string };
    if (typeof body.name !== "string") return NextResponse.json({ error: "Informe o nome da pasta." }, { status: 400 });
    await updateNoteFolder(user.id, id, body.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mysqlError = error as { code?: string };
    const message = mysqlError.code === "ER_DUP_ENTRY"
      ? "Já existe uma pasta com esse nome."
      : error instanceof Error ? error.message : "Não foi possível editar a pasta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { id } = await context.params;
    await deleteNoteFolder(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir a pasta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
