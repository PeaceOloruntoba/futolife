import { redirect } from "next/navigation";
import { OpportunitiesSubmit } from "@/components/opportunities-submit";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function SubmitOpportunityPage(){const supabase=await createClient();const {data:{user}}=supabase?await supabase.auth.getUser():{data:{user:null}};if(!user)redirect("/explore?auth=signin&next=%2Fopportunities%2Fsubmit");return <OpportunitiesSubmit/>;}
