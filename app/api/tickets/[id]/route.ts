import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteTicket, updateTicket } from "@/lib/repository";
import { Ticket } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { id } = await context.params;
    const { changes, label } = await request.json() as { changes: Partial<Ticket>; label?: string };
    await updateTicket(id, changes, label ?? "Ticket", user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update ticket error", error);
    return NextResponse.json({ error: "Não foi possível atualizar o ticket." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { id } = await context.params;
    await deleteTicket(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete ticket error", error);
    return NextResponse.json({ error: "Não foi possível excluir o ticket." }, { status: 500 });
  }
}
