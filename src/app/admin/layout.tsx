import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_SECTIONS, canAccessSection, type AdminRole, type AdminSection } from "@/lib/admin/access";
import AdminNav from "@/components/admin-nav";
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  if (!supabase) redirect("/");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=%2Fadmin%2Fdashboard");
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map(row => row.role as AdminRole);
  if (!roles.length) redirect("/");
  const visible = ADMIN_SECTIONS.filter(section => canAccessSection(roles, section));
  return <div className="admin-workspace"><header className="admin-workspace-head"><a className="admin-workspace-brand" href="/admin/dashboard"><span className="admin-brand-mark">F</span><span><b>FUTO LIFE</b><small>Admin workspace</small></span></a><span className="admin-workspace-account">{user.email}</span></header><div className="admin-workspace-body"><AdminNav sections={visible}/><main className="admin-workspace-main">{children}</main></div></div>;
}
