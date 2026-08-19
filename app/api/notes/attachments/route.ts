import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveNoteAttachment } from "@/lib/note-attachments";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const mimeType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const encodedName = request.headers.get("x-file-name") ?? "imagem";
    let name = "imagem";
    try { name = decodeURIComponent(encodedName); } catch { /* mantém o nome padrão */ }
    return NextResponse.json(await saveNoteAttachment(user.id, { body: request.body, mimeType, name }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível enviar o anexo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
