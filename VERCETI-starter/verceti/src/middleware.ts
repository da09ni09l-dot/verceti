
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key || !/^https?:\/\/.+/.test(url)) {
    if (request.nextUrl.pathname === "/setup") return NextResponse.next();
    console.error("VERCETI: Supabase environment variables are missing or invalid", {
      hasUrl: !!url,
      validUrl: !!url && /^https?:\/\/.+/.test(url),
      hasKey: !!key,
    });

    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname === "/login";
  const isPublicSupport = request.nextUrl.pathname === "/support" || request.nextUrl.pathname.startsWith("/support/chat");

  if (!user && !isLogin && !isPublicSupport && request.nextUrl.pathname !== "/setup") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const pathname = request.nextUrl.pathname;
  if (pathname !== "/maintenance") {
    const { data: setting } = await supabase
      .from("site_settings")
      .select("maintenance_enabled")
      .eq("id", true)
      .maybeSingle();

    if (setting?.maintenance_enabled) {
      let isAdmin = false;
      if (user) {
        const { data: role } = await supabase.rpc("current_verceti_role");
        isAdmin = role === "admin";
      }

      if (!isAdmin) {
        const maintenanceUrl = new URL("/maintenance", request.url);
        const maintenanceResponse = NextResponse.redirect(maintenanceUrl);
        response.cookies.getAll().forEach((cookie) => {
          maintenanceResponse.cookies.set(cookie);
        });
        return maintenanceResponse;
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

