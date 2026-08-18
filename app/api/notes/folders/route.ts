import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createNoteFolder } from "@/lib/notes";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const body = await request.json() as { name?: string };
    if (typeof body.name !== "string") return NextResponse.json({ error: "Informe o nome da pasta." }, { status: 400 });
    const id = await createNoteFolder(user.id, body.name);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const mysqlError = error as { code?: string };
    const message = mysqlError.code === "ER_DUP_ENTRY"
      ? "Já existe uma pasta com esse nome."
      : error instanceof Error ? error.message : "Não foi possível criar a pasta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
