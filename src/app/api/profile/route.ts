import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Account service is not configured." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to view your profile." }, { status: 401 });
  const { data, error } = await supabase.from("profiles").select("id, display_name, department, year_of_study, avatar_url").eq("id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load your profile." }, { status: 500 });
  return NextResponse.json({ profile: data, email: user.email });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Account service is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const display_name = typeof input.display_name === "string" ? input.display_name.trim().slice(0, 48) : "";
  if (input.department !== undefined && input.department !== null && typeof input.department !== "string") return NextResponse.json({ error: "Department must be text." }, { status: 400 });
  const department = typeof input.department === "string" ? input.department.trim().slice(0, 80) || null : null;
  if (input.year_of_study !== undefined && input.year_of_study !== null && (!Number.isInteger(input.year_of_study) || Number(input.year_of_study) < 1 || Number(input.year_of_study) > 7)) return NextResponse.json({ error: "Year of study must be a whole number from 1 to 7." }, { status: 400 });
  const year_of_study = typeof input.year_of_study === "number" ? input.year_of_study : null;
  if (display_name.length < 2) return NextResponse.json({ error: "Enter a display name with at least 2 characters." }, { status: 400 });
  const { data, error } = await supabase.from("profiles").upsert({ id: user.id, display_name, department, year_of_study }, { onConflict: "id" }).select("id, display_name, department, year_of_study, avatar_url").single();
  if (error) return NextResponse.json({ error: "Unable to save your profile." }, { status: 500 });
  return NextResponse.json({ profile: data });
}
