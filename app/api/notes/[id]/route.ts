import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteNoteFile, updateNoteFile } from "@/lib/notes";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { id } = await context.params;
    const changes = await request.json() as { title?: string; content?: string; folderId?: string };
    await updateNoteFile(user.id, id, changes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar o arquivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { id } = await context.params;
    await deleteNoteFile(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir o arquivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
