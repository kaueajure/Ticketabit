import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTicket, DuplicateTicketError } from "@/lib/repository";
import { TicketInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const input = await request.json() as TicketInput;
    if (!input.ticketNumber?.trim() || !input.description?.trim() || !input.systemId || !input.categoryId || !Array.isArray(input.responsibleIds) || !input.responsibleIds.length || !input.receivedAt) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }
    if (input.finishedAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.finishedAt)) return NextResponse.json({ error: "Data de finalização inválida." }, { status: 400 });
    const id = await createTicket(input, user);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateTicketError) return NextResponse.json({ error: error.message }, { status: 409 });
    const mysqlError = error as { code?: string };
    if (mysqlError.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Já existe um ticket com esse código." }, { status: 409 });
    console.error("Create ticket error", error);
    return NextResponse.json({ error: "Não foi possível criar o ticket." }, { status: 500 });
  }
}
