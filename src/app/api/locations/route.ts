import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { locations as inventory } from "@/lib/locations";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ source: "bundled", locations: inventory });
  const { data, error } = await supabase.from("campus_locations").select("id,name,category,description,position_status,latitude,longitude,local_x,local_z").order("name");
  if (error) return NextResponse.json({ error: "Unable to load campus locations." }, { status: 503 });
  return NextResponse.json({ source: "supabase", locations: data }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}
