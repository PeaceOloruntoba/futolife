export type AdminRole = "super_admin" | "opportunities_admin" | "community_admin" | "platform_admin";
export const ADMIN_SECTIONS = ["dashboard", "users", "opportunity", "community", "campus", "activities", "settings"] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
export function canAccessSection(roles: AdminRole[], section: AdminSection) {
  if (roles.includes("super_admin")) return true;
  if (["dashboard", "activities"].includes(section)) return roles.length > 0;
  if (section === "opportunity") return roles.includes("opportunities_admin");
  if (section === "community") return roles.includes("community_admin");
  if (section === "users") return roles.includes("community_admin") || roles.includes("platform_admin");
  if (section === "campus" || section === "settings") return roles.includes("platform_admin");
  return false;
}
