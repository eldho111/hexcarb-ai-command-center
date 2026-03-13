import { NextResponse, type NextRequest } from "next/server";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="HexCarb Console", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

function parseBasicAuth(
  headerValue: string | null,
): { user: string; pass: string } | null {
  if (!headerValue) return null;
  const [scheme, encoded] = headerValue.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
}

export function middleware(req: NextRequest): NextResponse {
  const expectedUser = process.env.HEXCARB_WEB_BASIC_USER || "";
  const expectedPass = process.env.HEXCARB_WEB_BASIC_PASS || "";

  // Fail closed in prod if the app was deployed without credentials.
  if (!expectedUser || !expectedPass) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Basic auth is not configured.", {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.next();
  }

  const auth = parseBasicAuth(req.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  if (auth.user !== expectedUser || auth.pass !== expectedPass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect app routes + API routes. Allow Next.js internal static assets.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
