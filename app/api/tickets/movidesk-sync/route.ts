import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMovideskRecentTicketSnapshots, MovideskHistoryError } from "@/lib/movidesk";
import { syncTicketsFromMovidesk } from "@/lib/repository";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { snapshots, truncated } = await getMovideskRecentTicketSnapshots();
    return NextResponse.json(await syncTicketsFromMovidesk(snapshots, user, truncated));
  } catch (error) {
    if (error instanceof MovideskHistoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Movidesk bulk ticket sync error", error);
    return NextResponse.json({ error: "Não foi possível sincronizar os tickets com o Movidesk." }, { status: 500 });
  }
}
