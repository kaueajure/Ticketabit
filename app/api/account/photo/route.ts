import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { removeProfilePhoto, saveProfilePhoto } from "@/lib/account";

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

function imageMime(data: Buffer) {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.length >= 12 && data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const formData = await request.formData();
    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size === 0) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
    if (photo.size > MAX_PHOTO_SIZE) return NextResponse.json({ error: "A foto deve possuir no máximo 2 MB." }, { status: 400 });

    const data = Buffer.from(await photo.arrayBuffer());
    const mime = imageMime(data);
    if (!mime) return NextResponse.json({ error: "Use uma imagem JPG, PNG ou WebP válida." }, { status: 400 });

    await saveProfilePhoto(user.id, data, mime);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Profile photo upload error", error);
    return NextResponse.json({ error: "Não foi possível salvar a foto." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    await removeProfilePhoto(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Profile photo delete error", error);
    return NextResponse.json({ error: "Não foi possível remover a foto." }, { status: 500 });
  }
}
