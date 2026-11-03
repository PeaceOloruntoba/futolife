import SocialHub from "@/components/social-hub";
export const metadata={title:"Student profile · FUTO Life"};
export default async function StudentProfilePage({params}:{params:Promise<{profileId:string}>}){const {profileId}=await params;return <SocialHub standalone initialTab="profile" profileId={profileId}/>;}
