import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppData } from "@/lib/repository";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const data = await getAppData();
    return NextResponse.json({ ...data, currentUser: user });
  } catch (error) {
    console.error("Bootstrap error", error);
    return NextResponse.json({ error: "Não foi possível carregar os dados do MySQL." }, { status: 500 });
  }
}
