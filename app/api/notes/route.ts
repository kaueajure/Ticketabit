import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createNoteFile, getNotesData } from "@/lib/notes";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    return NextResponse.json(await getNotesData(user.id));
  } catch (error) {
    console.error("Get notes error", error);
    return NextResponse.json({ error: "Não foi possível carregar as anotações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const body = await request.json() as { folderId?: string; title?: string };
    if (typeof body.folderId !== "string" || typeof body.title !== "string") return NextResponse.json({ error: "Informe a pasta e o nome do arquivo." }, { status: 400 });
    const id = await createNoteFile(user.id, body.folderId, body.title);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o arquivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
