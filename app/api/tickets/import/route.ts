import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { importTickets, TicketImportValidationError } from "@/lib/repository";
import { TicketImportRow } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const body = await request.json() as { rows?: TicketImportRow[]; force?: boolean };
    if (!Array.isArray(body.rows)) return NextResponse.json({ error: "Arquivo CSV inválido." }, { status: 400 });
    const result = await importTickets(body.rows, user, body.force === true);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TicketImportValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    const mysqlError = error as { code?: string };
    if (mysqlError.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Um dos tickets já foi cadastrado." }, { status: 409 });
    console.error("Import tickets error", error);
    return NextResponse.json({ error: "Não foi possível importar os tickets." }, { status: 500 });
  }
}
