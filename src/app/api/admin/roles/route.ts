import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

async function context() {
  const session = await createClient();
  if (!session) return { error: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: role } = await session.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
  if (!role) return { error: NextResponse.json({ error: "Super administrator access required." }, { status: 403 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 503 }) };
  return { admin: createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export async function GET() {
  const ctx = await context(); if ("error" in ctx) return ctx.error;
  const { data, error } = await ctx.admin.from("user_roles").select("user_id,role,created_at").neq("role", "super_admin").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = await Promise.all((data ?? []).map(async row => {
    const { data: profile } = await ctx.admin.from("profiles").select("display_name").eq("id", row.user_id).maybeSingle();
    const { data: auth } = await ctx.admin.auth.admin.getUserById(row.user_id);
    return { ...row, display_name: profile?.display_name ?? "Admin", email: auth.user?.email ?? "" };
  }));
  return NextResponse.json({ admins: rows });
}

export async function POST(request: NextRequest) {
  const ctx = await context(); if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body?.display_name === "string" ? body.display_name.trim() : "";
  const role = body?.role;
  if (!email || !displayName || !["opportunities_admin", "community_admin", "platform_admin"].includes(role)) return NextResponse.json({ error: "Email, display name, and a module admin role are required." }, { status: 400 });
  const { data, error } = await ctx.admin.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName }, redirectTo: `${request.nextUrl.origin}/auth/callback?next=%2Fadmin%2Fdashboard` });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Invitation failed." }, { status: 400 });
  const { error: profileError } = await ctx.admin.from("profiles").upsert({ id: data.user.id, display_name: displayName });
  const { error: roleError } = await ctx.admin.from("user_roles").insert({ user_id: data.user.id, role });
  if (profileError || roleError) return NextResponse.json({ error: profileError?.message ?? roleError?.message, invited: true }, { status: 500 });
  return NextResponse.json({ invited: true });
}

export async function PATCH(request: NextRequest) {
  const ctx = await context(); if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => null);
  if (typeof body?.user_id !== "string" || !["opportunities_admin", "community_admin", "platform_admin"].includes(body?.role)) return NextResponse.json({ error: "User ID and module admin role are required." }, { status: 400 });
  const { error: deleteError } = await ctx.admin.from("user_roles").delete().eq("user_id", body.user_id).in("role", ["opportunities_admin", "community_admin", "platform_admin"]);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  const { error } = await ctx.admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ updated: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await context(); if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => null);
  if (typeof body?.user_id !== "string") return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  const { error } = await ctx.admin.from("user_roles").delete().eq("user_id", body.user_id).in("role", ["opportunities_admin", "community_admin", "platform_admin"]);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ removed: true });
}
