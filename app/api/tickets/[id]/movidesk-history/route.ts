import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMovideskTicketHistory, MovideskHistoryError } from "@/lib/movidesk";
import { getTicketNumberById } from "@/lib/repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { id } = await context.params;
    const ticketNumber = await getTicketNumberById(id);
    if (!ticketNumber) return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });

    return NextResponse.json(await getMovideskTicketHistory(ticketNumber));
  } catch (error) {
    if (error instanceof MovideskHistoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Movidesk ticket history error", error);
    return NextResponse.json({ error: "Não foi possível carregar o histórico oficial." }, { status: 500 });
  }
}
