import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "Service unavailable." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => null) as { slug?: unknown } | null;
  if (typeof body?.slug !== "string" || body.slug.length > 180) return Response.json({ error: "Invalid opportunity." }, { status: 400 });
  const { data: opportunity } = await supabase.from("opportunities").select("id").eq("slug", body.slug).eq("status", "published").maybeSingle();
  if (!opportunity) return Response.json({ error: "Opportunity is unavailable." }, { status: 404 });
  const { error } = await supabase.from("opportunity_apply_clicks").insert({ profile_id: user.id, opportunity_id: opportunity.id });
  if (error) return Response.json({ error: "Could not record this click." }, { status: 500 });
  return Response.json({ ok: true });
}
