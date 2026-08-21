import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ticketabit_session";

function preventPageCaching(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function requestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/entrar") {
    const destination = request.cookies.has(SESSION_COOKIE) ? "/" : "/login";
    return preventPageCaching(NextResponse.redirect(new URL(destination, requestOrigin(request)), 307));
  }

  if (!request.cookies.has(SESSION_COOKIE) && request.nextUrl.pathname !== "/login") {
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const loginUrl = new URL("/login", requestOrigin(request));
    loginUrl.searchParams.set("next", next);
    return preventPageCaching(NextResponse.redirect(loginUrl, 307));
  }
  return preventPageCaching(NextResponse.next());
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
