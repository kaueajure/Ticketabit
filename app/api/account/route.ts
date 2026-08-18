import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { changeOwnPassword, updateOwnAccount } from "@/lib/account";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = await request.json() as { name?: string; currentPassword?: string; newPassword?: string };
    if (typeof body.name === "string") {
      await updateOwnAccount(user.id, body.name);
      return NextResponse.json({ ok: true });
    }
    if (typeof body.newPassword === "string") {
      await changeOwnPassword(user.id, body.currentPassword ?? "", body.newPassword);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Nenhuma alteração válida foi informada." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar a conta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
