import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfilePhoto } from "@/lib/account";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const photo = await getProfilePhoto(id);
  if (!photo) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
