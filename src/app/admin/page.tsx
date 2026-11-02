import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin-dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=%2Fadmin");
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) redirect("/");
  return <AdminDashboard adminEmail={user.email ?? "Administrator"} />;
}
