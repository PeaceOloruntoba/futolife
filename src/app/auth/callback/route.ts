import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, request.url));
  }
  const errorDestination = new URL("/", request.url);
  errorDestination.searchParams.set("auth", "confirmation-error");
  if(destination!=="/")errorDestination.searchParams.set("next",destination);
  return NextResponse.redirect(errorDestination);
}
