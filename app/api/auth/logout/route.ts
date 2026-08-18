import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
