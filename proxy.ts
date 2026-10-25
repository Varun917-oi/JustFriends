import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const loginRequest = request.nextUrl.pathname === "/login";

  if (!url || !key) {
    if (!loginRequest) {
      return NextResponse.json(
        { error: "Authentication is not configured." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.next({
      request,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  let response = NextResponse.next({ request });
  const refreshedCookies = new Set<string>();
  const supabase = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
          refreshedCookies.add(name);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith("sb-") || !cookie.name.includes("-auth-token") || refreshedCookies.has(cookie.name)) continue;
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  const userId = data?.claims?.sub;
  const email = data?.claims?.email;
  let isAuthorizedUser = false;
  if (typeof userId === "string" && typeof email === "string") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json(
        { error: "Could not validate the current account." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const expectedEmail =
      profile?.username === "Varun"
        ? process.env.VARUN_ADMIN_EMAIL
        : profile?.username === "Akrati"
          ? process.env.AKRATI_ADMIN_EMAIL
          : undefined;
    isAuthorizedUser =
      Boolean(profile) &&
      typeof expectedEmail === "string" &&
      email.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  }

  if (loginRequest && isAuthorizedUser) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    response = redirectResponse;
  } else if (!loginRequest && !isAuthorizedUser) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    response = redirectResponse;
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|favicon.ico|background.mp4|.*\\.svg$).*)",
  ],
};
