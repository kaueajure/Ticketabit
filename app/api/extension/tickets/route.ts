import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createTicketFromExtension, DuplicateTicketError, ExtensionTicketValidationError } from "@/lib/repository";
import { ExtensionTicketInput } from "@/lib/types";

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

function authorized(request: Request) {
  const expected = process.env.EXTENSION_API_KEY?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: responseHeaders });
}

export async function POST(request: Request) {
  if (!process.env.EXTENSION_API_KEY?.trim()) return json({ error: "A integração da extensão não está configurada no servidor." }, 503);
  if (!authorized(request)) return json({ error: "Chave da extensão inválida." }, 401);

  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Corpo da requisição inválido." }, 400);
    const input = body as ExtensionTicketInput;
    const ticket = await createTicketFromExtension(input);
    return json({ message: `Ticket #${ticket.ticketNumber} criado com sucesso.`, ticket }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Corpo da requisição inválido." }, 400);
    if (error instanceof ExtensionTicketValidationError) return json({ error: error.message }, 400);
    if (error instanceof DuplicateTicketError) return json({ error: error.message }, 409);
    const mysqlError = error as { code?: string };
    if (mysqlError.code === "ER_DUP_ENTRY") return json({ error: "Já existe um ticket com esse código." }, 409);
    console.error("Create extension ticket error", error);
    return json({ error: "Não foi possível criar o ticket pela extensão." }, 500);
  }
}
