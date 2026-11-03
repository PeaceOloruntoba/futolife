import SocialHub from "@/components/social-hub";
export const metadata={title:"Chat · FUTO Life"};
export default async function ChatPage({params}:{params:Promise<{conversationId:string}>}){const {conversationId}=await params;return <SocialHub standalone initialTab="messages" conversationId={conversationId}/>;}
