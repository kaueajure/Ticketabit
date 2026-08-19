import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMovideskTicketSnapshot, MovideskHistoryError } from "@/lib/movidesk";
import { getTicketNumberById, syncTicketFromMovidesk } from "@/lib/repository";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { id } = await context.params;
    const ticketNumber = await getTicketNumberById(id);
    if (!ticketNumber) return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });

    const snapshot = await getMovideskTicketSnapshot(ticketNumber);
    return NextResponse.json(await syncTicketFromMovidesk(id, snapshot, user));
  } catch (error) {
    if (error instanceof MovideskHistoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Movidesk ticket sync error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível sincronizar o ticket." }, { status: 500 });
  }
}
