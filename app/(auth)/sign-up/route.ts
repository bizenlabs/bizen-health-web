import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSignUpUrl } from "@/lib/workos";

export async function GET(request: NextRequest) {
  const redirectTo =
    request.nextUrl.searchParams.get("redirect_url") ?? "/onboarding";
  const url = await getSignUpUrl({ redirectTo });
  return NextResponse.redirect(url);
}
