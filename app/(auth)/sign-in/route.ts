import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSignInUrl } from "@/lib/workos";

export async function GET(request: NextRequest) {
  const redirectTo =
    request.nextUrl.searchParams.get("redirect_url") ?? "/dashboard";
  const url = await getSignInUrl({ redirectTo });
  return NextResponse.redirect(url);
}
