import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export default async function ExploreLayout({ children }: { children: ReactNode }) {
 const supabase=await createClient(); if(!supabase)return children;
 const {data:{user}}=await supabase.auth.getUser();
 if(user){const {data}=await supabase.from("user_roles").select("role").eq("user_id",user.id).limit(1);if(data?.length)redirect("/admin/dashboard");}
 return children;
}
