import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ticketabit_session";

function requestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const loginUrl = new URL("/login", requestOrigin(request));
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
