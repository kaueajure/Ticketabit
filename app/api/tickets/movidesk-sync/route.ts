import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMovideskTicketsForUsers, MovideskHistoryError } from "@/lib/movidesk";
import { getMovideskSyncUsers, syncTicketsFromMovidesk } from "@/lib/repository";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const syncUsers = await getMovideskSyncUsers();
    if (!syncUsers.length) return NextResponse.json({ error: "Nenhum usuário ativo possui e-mail para consultar no Movidesk." }, { status: 422 });

    const { snapshots, truncated } = await getMovideskTicketsForUsers(syncUsers);
    return NextResponse.json(await syncTicketsFromMovidesk(snapshots, syncUsers, user, truncated));
  } catch (error) {
    if (error instanceof MovideskHistoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Movidesk bulk ticket sync error", error);
    return NextResponse.json({ error: "Não foi possível sincronizar os tickets com o Movidesk." }, { status: 500 });
  }
}
