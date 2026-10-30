import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { locations as inventory } from "@/lib/locations";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ locations: inventory.map((place) => ({ ...place, position_status: place.id === "main-gate" || place.id === "senate-building" ? "provisional" : "unverified" })) });
  const { data, error } = await supabase.from("campus_locations").select("id,name,category,description,position_status,latitude,longitude,local_x,local_z").order("name");
  if (error) return NextResponse.json({ error: "Unable to load campus locations." }, { status: 503 });
  return NextResponse.json({ locations: data }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}
