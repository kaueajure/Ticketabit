import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveNoteAttachment } from "@/lib/note-attachments";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
    return NextResponse.json(await saveNoteAttachment(user.id, file), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível enviar o anexo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
