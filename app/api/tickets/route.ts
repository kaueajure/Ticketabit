import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTicket } from "@/lib/repository";
import { TicketInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const input = await request.json() as TicketInput;
    if (!input.ticketNumber?.trim() || !input.description?.trim() || !input.systemId || !input.categoryId || !input.responsibleId || !input.receivedAt) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }
    const id = await createTicket(input, user);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const mysqlError = error as { code?: string };
    if (mysqlError.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Já existe um ticket com esse código." }, { status: 409 });
    console.error("Create ticket error", error);
    return NextResponse.json({ error: "Não foi possível criar o ticket." }, { status: 500 });
  }
}
