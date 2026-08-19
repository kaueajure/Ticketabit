import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteNoteAttachment, readNoteAttachment } from "@/lib/note-attachments";

export async function GET(_: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { fileId } = await context.params;
    const attachment = await readNoteAttachment(user.id, fileId);
    return new NextResponse(attachment.stream as ReadableStream, {
      headers: { "Content-Type": attachment.mimeType, "Content-Length": String(attachment.size), "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { fileId } = await context.params;
    await deleteNoteAttachment(user.id, fileId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível remover o anexo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
