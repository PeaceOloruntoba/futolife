import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_SECTIONS, canAccessSection, type AdminRole, type AdminSection } from "@/lib/admin/access";

const labels: Record<AdminSection, string> = { dashboard:"Dashboard", users:"Users", opportunity:"Opportunity", community:"Community", campus:"Campus", activities:"Activities", settings:"Settings" };
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  if (!supabase) redirect("/");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=%2Fadmin%2Fdashboard");
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map(row => row.role as AdminRole);
  if (!roles.length) redirect("/");
  const visible = ADMIN_SECTIONS.filter(section => canAccessSection(roles, section));
  return <div className="admin-workspace"><header className="admin-workspace-head"><Link href="/admin/dashboard"><b>FUTO LIFE</b> Admin</Link><span>{user.email}</span></header><div className="admin-workspace-body"><nav className="admin-workspace-nav" aria-label="Admin modules">{visible.map(section => <Link key={section} href={`/admin/${section}`}>{labels[section]}</Link>)}</nav><main className="admin-workspace-main">{children}</main></div></div>;
}
