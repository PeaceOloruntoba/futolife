import type { Metadata } from "next";
import { OpportunitiesAdmin } from "@/components/opportunities-admin";
export const metadata:Metadata={title:"Opportunities Admin | FUTO Life"};
export const dynamic="force-dynamic";
export default function OpportunitiesAdminPage(){return <OpportunitiesAdmin/>;}
