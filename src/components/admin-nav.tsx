"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiActivity, FiBookOpen, FiGrid, FiLogOut, FiMapPin, FiMessageSquare, FiSettings, FiUsers, FiMousePointer } from "react-icons/fi";
import type { AdminSection } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/browser";

const items:Record<AdminSection,{label:string;short:string;icon:typeof FiGrid}>={
 dashboard:{label:"Dashboard",short:"Home",icon:FiGrid}, users:{label:"Users",short:"Users",icon:FiUsers}, opportunity:{label:"Opportunity",short:"Opportunity",icon:FiBookOpen}, applications:{label:"Apply clicks",short:"Clicks",icon:FiMousePointer}, community:{label:"Community",short:"Community",icon:FiMessageSquare}, campus:{label:"Campus",short:"Campus",icon:FiMapPin}, activities:{label:"Activities",short:"Activity",icon:FiActivity}, settings:{label:"Settings",short:"Settings",icon:FiSettings}
};
export default function AdminNav({sections}:{sections:AdminSection[]}){
 const pathname=usePathname();
 const [signingOut,setSigningOut]=useState(false);
 async function signOut(){
  if(signingOut)return;
  setSigningOut(true);
  const supabase=createClient();
  if(supabase){
   try{await supabase.rpc("record_user_activity",{p_action:"auth.logout"});}catch{}
   await supabase.auth.signOut();
  }
  window.location.assign("/?auth=signin");
 }
 return <nav className="admin-workspace-nav" aria-label="Admin modules">{sections.map(section=>{const item=items[section];const Icon=item.icon;const active=pathname===`/admin/${section}`;return <Link key={section} href={`/admin/${section}`} className={active?"active":""} aria-current={active?"page":undefined}><Icon aria-hidden="true"/><span className="admin-nav-full">{item.label}</span><span className="admin-nav-short">{item.short}</span></Link>;})}<button className="admin-nav-logout" type="button" onClick={signOut} disabled={signingOut} aria-label="Sign out"><FiLogOut aria-hidden="true"/><span className="admin-nav-full">{signingOut?"Signing out…":"Sign out"}</span><span className="admin-nav-short">{signingOut?"Signing out":"Logout"}</span></button></nav>;
}
