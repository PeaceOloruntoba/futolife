import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_SECTIONS, canAccessSection, type AdminRole, type AdminSection } from "@/lib/admin/access";
import AdminDashboard from "@/components/admin-dashboard";
import { OpportunitiesAdmin } from "@/components/opportunities-admin";
import { OpportunityApplyClicks } from "@/components/opportunity-apply-clicks";

export const dynamic = "force-dynamic";
export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!ADMIN_SECTIONS.includes(section as AdminSection)) notFound();
  const supabase = await createClient();
  if (!supabase) redirect("/");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=%2Fadmin%2Fdashboard");
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map(row => row.role as AdminRole);
  if (!canAccessSection(roles, section as AdminSection)) redirect("/admin/dashboard");
  if (section === "opportunity") return <OpportunitiesAdmin />;
  if (section === "applications") return <OpportunityApplyClicks />;
  const module = ({ dashboard:"dashboard", users:"users", community:"posts", campus:"places", activities:"activity", settings:"settings" } as const)[section as Exclude<AdminSection,"opportunity">];
  return <AdminDashboard adminEmail={user.email ?? "Administrator"} initialSection={module} canManageRoles={roles.includes("super_admin")} canInviteUsers={roles.some(r=>["super_admin","platform_admin"].includes(r))} summaryScopes={{ campus:roles.some(r=>["super_admin","platform_admin"].includes(r)), users:roles.some(r=>["super_admin","platform_admin","community_admin"].includes(r)), community:roles.some(r=>["super_admin","community_admin"].includes(r)) }} />;
}
