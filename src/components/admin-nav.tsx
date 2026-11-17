"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiActivity, FiBookOpen, FiGrid, FiMapPin, FiMessageSquare, FiSettings, FiUsers } from "react-icons/fi";
import type { AdminSection } from "@/lib/admin/access";

const items:Record<AdminSection,{label:string;short:string;icon:typeof FiGrid}>={
 dashboard:{label:"Dashboard",short:"Home",icon:FiGrid}, users:{label:"Users",short:"Users",icon:FiUsers}, opportunity:{label:"Opportunity",short:"Opportunity",icon:FiBookOpen}, community:{label:"Community",short:"Community",icon:FiMessageSquare}, campus:{label:"Campus",short:"Campus",icon:FiMapPin}, activities:{label:"Activities",short:"Activity",icon:FiActivity}, settings:{label:"Settings",short:"Settings",icon:FiSettings}
};
export default function AdminNav({sections}:{sections:AdminSection[]}){
 const pathname=usePathname();
 return <nav className="admin-workspace-nav" aria-label="Admin modules">{sections.map(section=>{const item=items[section];const Icon=item.icon;const active=pathname===`/admin/${section}`;return <Link key={section} href={`/admin/${section}`} className={active?"active":""} aria-current={active?"page":undefined}><Icon aria-hidden="true"/><span className="admin-nav-full">{item.label}</span><span className="admin-nav-short">{item.short}</span></Link>;})}</nav>;
}
