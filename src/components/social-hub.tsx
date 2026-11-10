"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowUpRight, FiBell, FiDownload, FiFileText, FiHeart, FiHome, FiImage, FiMessageCircle, FiMic, FiPlus, FiSmile, FiUser, FiUsers, FiVideo, FiX, FiCheck, FiZoomIn, FiZoomOut, FiPlay, FiPause, FiEdit2, FiTrash2, FiCornerUpLeft } from "react-icons/fi";
import { IoCheckmarkDone } from "react-icons/io5";
import { createClient } from "@/lib/supabase/browser";
import { notify } from "@/lib/notify";
import { useAuthSession } from "@/components/auth-session-provider";
import { NotificationCenter } from "@/components/notification-center";

type ProfileDetails = { gender: "Male"|"Female"|null; date_of_birth: string|null; dob_visibility: "private"|"friends"|"public"; hometown: string|null; interests: string|null; social_link: string|null };
type Person = { id: string; display_name: string; department: string | null; year_of_study: number | null; member_type?: "student"|"alumni"|"visitor"; alumni_set?: string|null; avatar_url: string | null; bio?: string | null; referral_code?: string; is_suspended?: boolean } & Partial<ProfileDetails>;
type Friendship = { id: string; requester_id: string; addressee_id: string; status: string; created_at: string };
type Post = { id: string; author_id: string; body: string; created_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; edited_at?:string|null;is_deleted?:boolean;reply_to_id?:string|null;message_kind?: "text"|"image"|"video"|"document"|"voice"; attachment_bucket?: string|null; attachment_path?: string|null; attachment_name?: string|null; attachment_size?: number|null; attachment_mime?: string|null };
type MessageRead = { message_id: string; profile_id: string; read_at: string };
type MessageReaction={message_id:string;profile_id:string;reaction:string;created_at:string};
type PendingAttachment = { file: File; kind: "image"|"video"|"document"|"voice"; bucket: "chat-images"|"chat-attachments" };
type Chat = { id: string; kind: "direct" | "group"; title: string | null; created_at: string; members: Person[]; lastMessage?: Message };
type ReferralRow = {profile_id:string;display_name:string;depth:number;joined_at:string};
type ReportReason = "spam"|"harassment"|"hate_or_abuse"|"sexual_content"|"violence"|"false_information"|"other";

export default function SocialHub({ onClose = () => {}, onSignIn, onProfileChange = () => {}, standalone = false, embedded = false, initialTab = "feed", conversationId, profileId }: { onClose?: () => void; onSignIn?: () => void; onProfileChange?: (profile: Person) => void; standalone?: boolean; embedded?: boolean; initialTab?: "feed"|"friends"|"messages"|"profile"; conversationId?: string; profileId?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { status: authStatus, userId } = useAuthSession();
  const router=useRouter();
  const [me, setMe] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [messageReads, setMessageReads] = useState<Record<string, MessageRead[]>>({});
  const [messageReactions,setMessageReactions]=useState<Record<string,MessageReaction[]>>({});
  const [selectedMessageId,setSelectedMessageId]=useState<string|null>(null);
  const [replyToMessageId,setReplyToMessageId]=useState<string|null>(null);
  const [editingMessageId,setEditingMessageId]=useState<string|null>(null);
  const [deleteMessageId,setDeleteMessageId]=useState<string|null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment|null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(conversationId??null);
  const [comments, setComments] = useState<Record<string, { id: string; post_id: string; author_id: string; body: string; created_at: string }[]>>({});
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [myReportedPosts,setMyReportedPosts] = useState<string[]>([]);
  const [reportTarget,setReportTarget] = useState<Post|null>(null);
  const [reportReason,setReportReason] = useState<ReportReason>("spam");
  const [reportDetails,setReportDetails] = useState("");
  const [referralNetwork,setReferralNetwork] = useState<ReferralRow[]>([]);
  const [tab, setTab] = useState<"feed" | "friends" | "messages" | "profile">(initialTab);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [friendSearch, setFriendSearch] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [draftPost, setDraftPost] = useState("");
  const postInputRef=useRef<HTMLTextAreaElement>(null);
  const messageListRef=useRef<HTMLDivElement>(null);
  const messageInputRef=useRef<HTMLInputElement>(null);
  const hiddenMessageIdsRef=useRef<Set<string>>(new Set());
  const shouldStickToBottomRef=useRef(true);
  const lastScrolledChatRef=useRef<string|null>(null);
  const socialWindowRef=useRef<HTMLElement>(null);
  const recorderRef=useRef<MediaRecorder|null>(null);
  const recorderStreamRef=useRef<MediaStream|null>(null);
  const recorderChunksRef=useRef<Blob[]>([]);
  const [mentionQuery,setMentionQuery]=useState<string|null>(null);
  const [mentionStart,setMentionStart]=useState<number|null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [profileDraft, setProfileDraft] = useState({ display_name: "", department: "", year: "", member_type: "student" as "student"|"alumni"|"visitor", alumni_set: "", bio: "", gender: "" as ""|"Male"|"Female", date_of_birth: "", dob_visibility: "private" as "private"|"friends"|"public", hometown: "", interests: "", social_link: "" });
  const [viewedProfile, setViewedProfile] = useState<Person | null>(null);
  const activityKeysRef=useRef(new Set<string>());
  const scrollToLatest=useCallback((force=false)=>{
    const list=messageListRef.current;
    if(list&&(force||shouldStickToBottomRef.current))list.scrollTop=list.scrollHeight;
  },[]);

  const load = useCallback(async () => {
    if (authStatus === "loading") return;
    if (!supabase) { setBootstrapping(false); setLoadingChats(false); setNotice("Account services are unavailable. Please try again later."); return; }
    if (authStatus === "signed-out" || !userId) { setBootstrapping(false); setLoadingChats(false); setMe(null); setNotice(""); return; }
    hiddenMessageIdsRef.current=new Set();
    setLoadingChats(true);
    setBootstrapping(true);
    const user = { id: userId };
    const [profileResult, targetProfileResult, ownDetailsResult, targetDetailsResult] = await Promise.all([
      supabase.from("profiles").select("id,display_name,department,year_of_study,member_type,alumni_set,avatar_url,bio,referral_code,is_suspended").eq("id", user.id).maybeSingle(),
      profileId ? supabase.from("profiles").select("id,display_name,department,year_of_study,member_type,alumni_set,avatar_url,bio").eq("id", profileId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.rpc("get_profile_details", { target_profile_id: user.id }),
      profileId ? supabase.rpc("get_profile_details", { target_profile_id: profileId }) : Promise.resolve({ data: null }),
    ]);
    const ownDetails = ((ownDetailsResult.data ?? []) as ProfileDetails[])[0];
    const targetDetails = targetDetailsResult.data ? ((targetDetailsResult.data ?? []) as ProfileDetails[])[0] : undefined;
    setViewedProfile(targetProfileResult.data ? { ...targetProfileResult.data, ...targetDetails } as Person : null);
    if (profileResult.data) {
      const p = profileResult.data as Person;
      setMe(p);
      setProfileDraft({ display_name: p.display_name, department: p.department ?? "", year: p.year_of_study ? String(p.year_of_study) : "", member_type:p.member_type??"student", alumni_set:p.alumni_set??"", bio: p.bio ?? "", gender: ownDetails?.gender ?? "", date_of_birth: ownDetails?.date_of_birth ?? "", dob_visibility: ownDetails?.dob_visibility ?? "private", hometown: ownDetails?.hometown ?? "", interests: ownDetails?.interests ?? "", social_link: ownDetails?.social_link ?? "" });
      if(p.is_suspended)setNotice("This account is suspended from social interactions. Contact FUTO Life support if you think this is a mistake.");
    }
    setBootstrapping(false);
    const [peopleResult, friendshipResult, postResult, memberResult] = await Promise.all([
      supabase.from("profiles").select("id,display_name,department,year_of_study,member_type,alumni_set,avatar_url,bio").neq("id", user.id).order("display_name").limit(300),
      supabase.from("friendships").select("id,requester_id,addressee_id,status,created_at").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
      supabase.from("posts").select("id,author_id,body,created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("conversation_members").select("conversation_id").eq("profile_id", user.id),
    ]);
    setPeople((peopleResult.data ?? []) as Person[]);
    setFriendships((friendshipResult.data ?? []) as Friendship[]);
    const postRows = (postResult.data ?? []) as Post[];
    setPosts(postRows);
    const [reportedResult,networkResult]=await Promise.all([
      supabase.from("post_reports").select("post_id").eq("reporter_id",user.id),
      supabase.rpc("get_my_referral_network"),
    ]);
    setMyReportedPosts((reportedResult.data??[]).map(row=>row.post_id as string).filter(Boolean));
    setReferralNetwork((networkResult.data??[]) as ReferralRow[]);
    if (postRows.length) {
      const ids = postRows.map((post) => post.id);
      const [tagRows, reactionRows, commentRows] = await Promise.all([
        supabase.from("post_tags").select("post_id,profile_id").in("post_id", ids),
        supabase.from("post_reactions").select("post_id,profile_id").in("post_id", ids),
        supabase.from("post_comments").select("id,post_id,author_id,body,created_at").in("post_id", ids).order("created_at"),
      ]);
      const grouped = <T extends { post_id: string; profile_id?: string }>(rows: T[] | null) => (rows ?? []).reduce<Record<string,string[]>>((acc,row) => { (acc[row.post_id] ??= []).push(row.profile_id ?? ""); return acc; }, {});
      setTags(grouped(tagRows.data as {post_id:string;profile_id:string}[] | null));
      setLikes(grouped(reactionRows.data as {post_id:string;profile_id:string}[] | null));
      const c = (commentRows.data ?? []) as {id:string;post_id:string;author_id:string;body:string;created_at:string}[];
      setComments(c.reduce<Record<string,typeof c>>((acc,row) => { (acc[row.post_id] ??= []).push(row); return acc; }, {}));
    }
    const conversationIds = (memberResult.data ?? []).map((row) => row.conversation_id as string);
    if (!conversationIds.length) { setChats([]);setUnreadCounts({});setLoadingChats(false); return; }
    const [conversationResult, memberships] = await Promise.all([
      supabase.from("conversations").select("id,kind,title,created_at").in("id", conversationIds).order("created_at", { ascending: false }),
      supabase.from("conversation_members").select("conversation_id,profile_id").in("conversation_id", conversationIds),
    ]);
    const memberRows = (memberships.data ?? []) as {conversation_id:string;profile_id:string}[];
    const profileMap = new Map<string,Person>([...(peopleResult.data ?? []) as Person[], ...(profileResult.data ? [profileResult.data as Person] : [])].map(p => [p.id,p]));
    const conversationRows = (conversationResult.data ?? []) as Omit<Chat,"members"|"lastMessage">[];
    const [messageResult, unreadResult, hiddenResult] = await Promise.all([
      supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,message_kind,attachment_bucket,attachment_path,attachment_name,attachment_size,attachment_mime").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(conversationIds.length * 3),
      supabase.rpc("get_my_unread_counts"),
      supabase.from("message_hidden_for_profiles").select("message_id").eq("profile_id",userId).in("conversation_id",conversationIds),
    ]);
    const hiddenIds=new Set(((hiddenResult.data??[]) as {message_id:string}[]).map(row=>row.message_id));
    hiddenMessageIdsRef.current=hiddenIds;
    const messageRows = ((messageResult.data ?? []) as Message[]).filter(message=>!hiddenIds.has(message.id));
    setUnreadCounts(Object.fromEntries(((unreadResult.data??[]) as {conversation_id:string;unread_count:number}[]).map(row=>[row.conversation_id,Number(row.unread_count)])));
    setChats(conversationRows.map((chat) => ({ ...chat, members: memberRows.filter(m => m.conversation_id === chat.id).map(m => profileMap.get(m.profile_id)).filter((p): p is Person => Boolean(p)), lastMessage: messageRows.find(m => m.conversation_id === chat.id) })).sort((a,b)=>new Date(b.lastMessage?.created_at??b.created_at).getTime()-new Date(a.lastMessage?.created_at??a.created_at).getTime()));
    setLoadingChats(false);
  }, [authStatus, userId, profileId, supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(()=>{
    if(!supabase||!userId)return;
    const channel=supabase.channel(`conversation-order-${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"messages"},payload=>{
      const message=payload.new as Message;
      if(hiddenMessageIdsRef.current.has(message.id))return;
      setChats(current=>{
        if(!current.some(chat=>chat.id===message.conversation_id))return current;
        return current.map(chat=>chat.id===message.conversation_id?{...chat,lastMessage:message}:chat).sort((a,b)=>new Date(b.lastMessage?.created_at??b.created_at).getTime()-new Date(a.lastMessage?.created_at??a.created_at).getTime());
      });
    }).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[supabase,userId]);
  useEffect(()=>{
    if(!supabase||!userId||!profileId||!viewedProfile||activityKeysRef.current.has(`profile:${profileId}`))return;
    activityKeysRef.current.add(`profile:${profileId}`);
    void supabase.rpc("record_user_activity",{p_action:"profile.viewed",p_entity_type:"profile",p_entity_id:profileId}).then(()=>{});
  },[profileId,supabase,userId,viewedProfile]);
  useEffect(()=>{setTab(initialTab);setActiveChat(conversationId??null);},[initialTab,conversationId]);
  useEffect(() => { if (notice) { notify(notice); setNotice(""); } }, [notice]);
  useEffect(() => {
    if (!supabase || !userId || !activeChat) return;
    setMessages([]);setTotalMessageCount(0);setMessageReads({});setMessageReactions({});setAttachmentUrls({});setSelectedMessageId(null);setReplyToMessageId(null);setEditingMessageId(null);setDeleteMessageId(null);
    const refreshUnread = async () => {
      const {data}=await supabase.rpc("get_my_unread_counts");
      setUnreadCounts(Object.fromEntries(((data??[]) as {conversation_id:string;unread_count:number}[]).map(row=>[row.conversation_id,Number(row.unread_count)])));
    };
    const markRead = async () => {
      await supabase.rpc("mark_conversation_read",{target_conversation:activeChat});
      await refreshUnread();
    };
    const refresh = async () => {
      const [{data,count},{data:hiddenData}]=await Promise.all([
        supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,edited_at,is_deleted,reply_to_id,message_kind,attachment_bucket,attachment_path,attachment_name,attachment_size,attachment_mime",{count:"exact"}).eq("conversation_id", activeChat).order("created_at").limit(300),
        supabase.from("message_hidden_for_profiles").select("message_id").eq("profile_id",userId).eq("conversation_id",activeChat),
      ]);
      const hiddenIds=new Set(((hiddenData??[]) as {message_id:string}[]).map(row=>row.message_id));
      for(const id of hiddenIds)hiddenMessageIdsRef.current.add(id);
      const allRows=(data??[]) as Message[];const rows=allRows.filter(message=>!hiddenIds.has(message.id));setMessages(rows);
      setTotalMessageCount(Math.max(0,(count??allRows.length)-allRows.filter(message=>hiddenIds.has(message.id)).length));
      if(tab==="messages"&&document.visibilityState==="visible")await markRead();
      if(rows.length){const [readResult,reactionResult]=await Promise.all([supabase.from("message_reads").select("message_id,profile_id,read_at").in("message_id",rows.map(row=>row.id)),supabase.from("message_reactions").select("message_id,profile_id,reaction,created_at").in("message_id",rows.map(row=>row.id))]);const grouped=(readResult.data??[] as MessageRead[]).reduce<Record<string,MessageRead[]>>((acc,row)=>{(acc[row.message_id]??=[]).push(row as MessageRead);return acc;},{});setMessageReads(grouped);const groupedReactions=(reactionResult.data??[] as MessageReaction[]).reduce<Record<string,MessageReaction[]>>((acc,row)=>{(acc[row.message_id]??=[]).push(row as MessageReaction);return acc;},{});setMessageReactions(groupedReactions);}
    };
    const handleVisibility=()=>{if(document.visibilityState==="visible"&&tab==="messages")void markRead();};
    void refresh();
    document.addEventListener("visibilitychange",handleVisibility);
    const channel = supabase.channel(`messages-${me?.id??"user"}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const incoming = payload.new as Message;
      if(incoming.conversation_id===activeChat&&tab==="messages"&&document.visibilityState==="visible"){
        setMessages((current) => current.some((m) => m.id === incoming.id) ? current : [...current, incoming]);
        setTotalMessageCount(current=>current+1);
        if(incoming.sender_id!==me?.id)void markRead();
      }else void refreshUnread();
    }).on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`conversation_id=eq.${activeChat}`},payload=>{
      const updated=payload.new as Message;
      setMessages(current=>current.map(message=>message.id===updated.id?updated:message));
    }).on("postgres_changes",{event:"INSERT",schema:"public",table:"message_reads"},payload=>{
      const receipt=payload.new as MessageRead;
      setMessageReads(current=>({...current,[receipt.message_id]:[...(current[receipt.message_id]??[]).filter(row=>row.profile_id!==receipt.profile_id),receipt]}));
      void refreshUnread();
    }).on("postgres_changes",{event:"*",schema:"public",table:"message_reactions"},payload=>{
      const reaction=(payload.eventType==="DELETE"?payload.old:payload.new) as MessageReaction;
      setMessageReactions(current=>{
        const existing=current[reaction.message_id]??[];
        const remaining=existing.filter(row=>row.profile_id!==reaction.profile_id);
        return {...current,[reaction.message_id]:payload.eventType==="DELETE"?remaining:[...remaining,reaction]};
      });
    }).on("postgres_changes",{event:"INSERT",schema:"public",table:"message_hidden_for_profiles",filter:`profile_id=eq.${userId}`},payload=>{
      const hidden=payload.new as {message_id:string;conversation_id:string;profile_id:string};
      if(hiddenMessageIdsRef.current.has(hidden.message_id))return;
      hiddenMessageIdsRef.current.add(hidden.message_id);
      if(hidden.conversation_id===activeChat){setMessages(current=>current.filter(message=>message.id!==hidden.message_id));setTotalMessageCount(current=>Math.max(0,current-1));}
    }).subscribe();
    return () => { document.removeEventListener("visibilitychange",handleVisibility);void supabase.removeChannel(channel); };
  }, [activeChat, supabase, tab, me?.id, userId]);

  useEffect(()=>{
    let active=true;
    const attached=messages.filter(message=>!message.is_deleted&&message.attachment_bucket&&message.attachment_path);
    if(!supabase||!attached.length)return;
    void Promise.all(attached.map(async message=>{const {data}=await supabase.storage.from(message.attachment_bucket!).createSignedUrl(message.attachment_path!,3600);return [message.id,data?.signedUrl] as const;})).then(entries=>{if(active)setAttachmentUrls(current=>({...current,...Object.fromEntries(entries.filter((entry):entry is readonly [string,string]=>Boolean(entry[1])))}));});
    return()=>{active=false;};
  },[messages,supabase]);

  useEffect(()=>{
    if(!supabase||!me)return;
    const refresh=async()=>{const {data}=await supabase.rpc("get_my_unread_counts");setUnreadCounts(Object.fromEntries(((data??[]) as {conversation_id:string;unread_count:number}[]).map(row=>[row.conversation_id,Number(row.unread_count)])));};
    const channel=supabase.channel(`unread-${me.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},()=>void refresh()).on("postgres_changes",{event:"INSERT",schema:"public",table:"message_reads"},()=>void refresh()).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[me?.id,supabase]);

  useEffect(()=>()=>{recorderRef.current?.state!="inactive"&&recorderRef.current?.stop();recorderStreamRef.current?.getTracks().forEach(track=>track.stop());},[]);

  useLayoutEffect(() => {
    if(tab!=="messages"||!activeChat||!messageListRef.current)return;
    const list=messageListRef.current;
    const changedChat=lastScrolledChatRef.current!==activeChat;
    if(changedChat){lastScrolledChatRef.current=activeChat;shouldStickToBottomRef.current=true;}
    const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>scrollToLatest(changedChat)));
    if(typeof ResizeObserver==="undefined")return()=>cancelAnimationFrame(frame);
    const observer=new ResizeObserver(()=>scrollToLatest());
    observer.observe(list);
    list.querySelectorAll(".message-bubble").forEach(message=>observer.observe(message));
    return()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[activeChat,attachmentUrls,messages.length,scrollToLatest,tab]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncKeyboardViewport = () => {
      const element = socialWindowRef.current;
      if (!element || !standalone || tab !== "messages") return;
      const keyboardOpen = window.innerWidth <= 720 && viewport && viewport.height < Math.min(window.screen.height, window.innerHeight) - 100;
      if (keyboardOpen && viewport) {
        element.style.position = "fixed";
        element.style.top = `${viewport.offsetTop}px`;
        element.style.left = "0";
        element.style.width = "100vw";
        element.style.height = `${viewport.height}px`;
        element.style.maxHeight = `${viewport.height}px`;
      } else {
        for (const property of ["position", "top", "left", "width", "height", "max-height"]) element.style.removeProperty(property);
      }
    };
    syncKeyboardViewport();
    viewport?.addEventListener("resize", syncKeyboardViewport);
    viewport?.addEventListener("scroll", syncKeyboardViewport);
    window.addEventListener("resize", syncKeyboardViewport);
    return () => {
      viewport?.removeEventListener("resize", syncKeyboardViewport);
      viewport?.removeEventListener("scroll", syncKeyboardViewport);
      window.removeEventListener("resize", syncKeyboardViewport);
      const element = socialWindowRef.current;
      if (element) for (const property of ["position", "top", "left", "width", "height", "max-height"]) element.style.removeProperty(property);
    };
  }, [standalone, tab]);

  const accepted = useMemo(() => friendships.filter((f) => f.status === "accepted").map((f) => f.requester_id === me?.id ? f.addressee_id : f.requester_id), [friendships, me]);
  const friends = useMemo(() => people.filter((p) => accepted.includes(p.id)), [people, accepted]);
  const pendingIn = friendships.filter((f) => f.status === "pending" && f.addressee_id === me?.id);
  const pendingOut = friendships.filter((f) => f.status === "pending" && f.requester_id === me?.id);
  const filteredPeople = people.filter((p) => `${p.display_name} ${p.department ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const filteredFriends = friends.filter((p) => `${p.display_name} ${p.department ?? ""}`.toLowerCase().includes(friendSearch.trim().toLowerCase()));
  const filteredChats = chats.filter((chat) => `${chat.title ?? ""} ${chat.members.map(member=>member.display_name).join(" ")} ${chat.lastMessage?.body ?? ""}`.toLowerCase().includes(conversationSearch.trim().toLowerCase()));
  const currentChat = chats.find((chat) => chat.id === activeChat);
  const otherPerson = (id: string) => people.find((p) => p.id === id) ?? (me?.id === id ? me : null);
  const replyTarget=messages.find(message=>message.id===replyToMessageId)??null;
  const editingTarget=messages.find(message=>message.id===editingMessageId)??null;
  const replyTargetName=replyTarget?otherPerson(replyTarget.sender_id)?.display_name??"message":"message";
  useEffect(()=>{
    if(!supabase||!userId||!activeChat||!currentChat||activityKeysRef.current.has(`chat:${activeChat}`))return;
    activityKeysRef.current.add(`chat:${activeChat}`);
    void supabase.rpc("record_user_activity",{p_action:"chat.opened",p_entity_type:"conversation",p_entity_id:activeChat}).then(()=>{});
  },[activeChat,currentChat,supabase,userId]);
  const chatPartner=currentChat?.kind === "direct" ? currentChat.members.find(member=>member.id!==me?.id)??null : null;
  const unreadTotal=Object.values(unreadCounts).reduce((total,count)=>total+count,0);
 const communityLabel = (person: Person) => person.member_type === "alumni" ? `Alumni - ${person.alumni_set ?? "Set not provided"} set` : person.member_type === "visitor" ? "Visitor" : person.year_of_study ? `Year ${person.year_of_study}` : "FUTO student";
  const openProfile = (person: Person | null | undefined) => { if (person) router.push(`/community/profile/${person.id}`); };
  const mentionSuggestions=mentionQuery===null?[]:friends.filter(friend=>friend.display_name.toLocaleLowerCase().includes(mentionQuery.toLocaleLowerCase())).slice(0,7);

  function onPostDraftChange(value:string,cursor:number){
    setDraftPost(value);
    const match=value.slice(0,cursor).match(/(^|\s)@([\p{L}\p{N}_.-]*)$/u);
    if(match){setMentionQuery(match[2]);setMentionStart(cursor-match[0].length+match[1].length);}
    else{setMentionQuery(null);setMentionStart(null);}
  }
  function insertMention(person:Person){
    if(mentionStart===null)return;
    const cursor=postInputRef.current?.selectionStart??draftPost.length;
    const insertion=`@${person.display_name} `;
    const next=`${draftPost.slice(0,mentionStart)}${insertion}${draftPost.slice(cursor)}`;
    const nextCursor=mentionStart+insertion.length;
    setDraftPost(next);setMentionQuery(null);setMentionStart(null);
    requestAnimationFrame(()=>{postInputRef.current?.focus();postInputRef.current?.setSelectionRange(nextCursor,nextCursor);});
  }
  function mentionedFriendIds(text:string){
    return friends.filter(friend=>new RegExp(`(^|\\s)@${friend.display_name.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")}(?=$|[\\s.,!?])`,"i").test(text)).map(friend=>friend.id);
  }

  async function sendRequest(person: Person) {
    if (!supabase || !me) return;
    setBusy(true); setNotice("");
    const { error } = await supabase.from("friendships").insert({ requester_id: me.id, addressee_id: person.id });
    setBusy(false); if (error) setNotice(error.code === "23505" ? "A request or friendship already exists." : error.message); else { setNotice(`Friend request sent to ${person.display_name}.`); await load(); }
  }
  async function respond(request: Friendship, status: "accepted"|"declined") {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase.from("friendships").update({ status }).eq("id", request.id);
    if (error) setNotice(error.message); else { setNotice(status === "accepted" ? "Friend request accepted." : "Friend request declined."); await load(); }
    setBusy(false);
  }
  async function removeFriend(id: string) {
    if (!supabase || busy) return;
    const relation = friendships.find((f) => f.status === "accepted" && [f.requester_id,f.addressee_id].includes(id));
    if (!relation) return;
    setBusy(true);const { error } = await supabase.from("friendships").delete().eq("id", relation.id);
    if (error) setNotice(error.message); else { setNotice("Friend removed."); await load(); }
    setBusy(false);
  }
  async function publishPost(event: FormEvent) {
    event.preventDefault(); if (!supabase || !me || !draftPost.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("posts").insert({ author_id: me.id, body: draftPost.trim() }).select("id").single();
    const friendIds=mentionedFriendIds(draftPost.trim());
    if (!error && data && friendIds.length) {
      const result = await supabase.from("post_tags").insert(friendIds.map(profile_id => ({ post_id: data.id, profile_id })));
      if (result.error) setNotice(result.error.message);
    }
    if (error) setNotice(error.message); else { setDraftPost(""); setNotice("Post shared with your friends."); await load(); }
    setBusy(false);
  }
  async function likePost(post: Post) {
    if (!supabase || !me || busy) return;
    setBusy(true);
    const mine = (likes[post.id] ?? []).includes(me.id);
    const query = mine ? supabase.from("post_reactions").delete().eq("post_id",post.id).eq("profile_id",me.id) : supabase.from("post_reactions").insert({post_id:post.id,profile_id:me.id});
    const { error } = await query; if (error) setNotice(error.message); else await load();
    setBusy(false);
  }
  async function addComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault(); if (!supabase || !me || busy) return;
    const form = event.currentTarget; const input = new FormData(form).get("comment"); if (typeof input !== "string" || !input.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("post_comments").insert({post_id:postId,author_id:me.id,body:input.trim()});
    if (error) setNotice(error.message); else { form.reset(); setNotice("Comment added."); await load(); }
    setBusy(false);
  }
  async function submitReport(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!supabase||!me||!reportTarget)return;
    setBusy(true);const {error}=await supabase.from("post_reports").insert({post_id:reportTarget.id,reporter_id:me.id,reason:reportReason,details:reportDetails.trim()||null});setBusy(false);
    if(error)setNotice(error.code==="23505"?"You have already reported this post.":error.message);else{setNotice("Report sent to the FUTO Life admin team.");setMyReportedPosts(current=>[...current,reportTarget.id]);setReportTarget(null);setReportDetails("");}
  }
  async function copyReferralLink(){
    if(!me?.referral_code)return;
    const url=`${window.location.origin}/?ref=${encodeURIComponent(me.referral_code)}`;
    try{await navigator.clipboard.writeText(url);setNotice("Your referral link was copied. Referrals are recorded, but there are no rewards at this time.");}
    catch{setNotice(url);}
  }
  async function openDirect(person: Person) {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("open_direct_conversation", { other_profile: person.id });
    if (error) { setNotice(error.message); return; }
    await load(); setTab("messages"); setActiveChat(data as string);router.push("/community/messages/"+String(data));
  }
  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || busy) return;
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement); const title = String(form.get("groupTitle") ?? "");
    const ids = form.getAll("groupFriend").map(String);
    const { data, error } = await supabase.rpc("create_group_conversation", { group_title: title, friend_ids: ids });
    if (error) setNotice(error.message); else { formElement.reset(); await load(); setActiveChat(data as string); setNotice("Group chat created."); }
    setBusy(false);
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault(); if (!supabase || !me || !activeChat || (!draftMessage.trim()&&!pendingAttachment) || busy) return;
    setBusy(true);
    if(editingMessageId){
      const {data,error}=await supabase.rpc("edit_my_message",{target_message:editingMessageId,new_body:draftMessage.trim()});
      if(error)setNotice(error.message);else{setMessages(current=>current.map(message=>message.id===editingMessageId?data as Message:message));setDraftMessage("");setEditingMessageId(null);setSelectedMessageId(null);setNotice("Message edited.");}
      setBusy(false);return;
    }
    let attachment:{bucket:string;path:string;name:string;size:number;mime:string;kind:string}|null=null;
    if(pendingAttachment){
      const {file,kind,bucket}=pendingAttachment;
      const path=`${activeChat}/${me.id}/${crypto.randomUUID()}-${file.name.replace(/[^\p{L}\p{N}._-]/gu,"_")}`;
      const {error:uploadError}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});
      if(uploadError){setBusy(false);setNotice(`Upload failed: ${uploadError.message}`);return;}
      attachment={bucket,path,name:file.name,size:file.size,mime:file.type,kind};
    }
    const body=draftMessage.trim()||(attachment?.kind==="voice"?"Voice note":attachment?.name??"");
    const { error } = await supabase.from("messages").insert({conversation_id:activeChat,sender_id:me.id,body,reply_to_id:replyToMessageId,message_kind:attachment?.kind??"text",attachment_bucket:attachment?.bucket??null,attachment_path:attachment?.path??null,attachment_name:attachment?.name??null,attachment_size:attachment?.size??null,attachment_mime:attachment?.mime??null});
    if(error&&attachment)await supabase.storage.from(attachment.bucket).remove([attachment.path]);
    if (error) setNotice(error.message); else { setDraftMessage("");setPendingAttachment(null);setEmojiOpen(false);setReplyToMessageId(null);setSelectedMessageId(null); const {data,count} = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,edited_at,is_deleted,reply_to_id,message_kind,attachment_bucket,attachment_path,attachment_name,attachment_size,attachment_mime",{count:"exact"}).eq("conversation_id",activeChat).order("created_at").limit(300); setMessages((data ?? []) as Message[]);setTotalMessageCount(count??data?.length??0); }
    setBusy(false);
  }

  function replyToMessage(message:Message){
    if(message.is_deleted)return;
    setEditingMessageId(null);setReplyToMessageId(message.id);setSelectedMessageId(null);
    requestAnimationFrame(()=>messageInputRef.current?.focus());
  }
  function editMessage(message:Message){
    if(message.sender_id!==me?.id||message.message_kind!=="text"||message.is_deleted)return;
    setReplyToMessageId(null);setEditingMessageId(message.id);setDraftMessage(message.body);setSelectedMessageId(null);setPendingAttachment(null);
    requestAnimationFrame(()=>{messageInputRef.current?.focus();messageInputRef.current?.setSelectionRange(message.body.length,message.body.length);});
  }
  function cancelMessageAction(){setReplyToMessageId(null);setEditingMessageId(null);setDraftMessage("");setPendingAttachment(null);}
  async function confirmDeleteMessage(forEveryone:boolean){
    if(!supabase||!deleteMessageId||busy)return;
    setBusy(true);const targetId=deleteMessageId;
    if(forEveryone){
      const {data,error}=await supabase.rpc("delete_my_message",{target_message:targetId});
      if(error)setNotice(error.message);else{setMessages(current=>current.map(message=>message.id===targetId?data as Message:message));setMessageReactions(current=>({...current,[targetId]:[]}));setNotice("Message deleted for everyone.");}
    }else{
      const message=messages.find(row=>row.id===targetId);
      const {error}=await supabase.rpc("hide_my_message",{target_message:targetId});
      if(error)setNotice(error.message);else{
        hiddenMessageIdsRef.current.add(targetId);
        setMessages(current=>current.filter(row=>row.id!==targetId));
        setTotalMessageCount(current=>Math.max(0,current-1));
        const previousMessage=messages.filter(row=>row.id!==targetId).at(-1);
        setChats(current=>current.map(chat=>chat.id===message?.conversation_id&&chat.lastMessage?.id===targetId?{...chat,lastMessage:previousMessage?.conversation_id===chat.id?previousMessage:undefined}:chat));
        setNotice("Message deleted for you.");
      }
    }
    setDeleteMessageId(null);setSelectedMessageId(null);setBusy(false);
  }
  async function toggleMessageReaction(message:Message,reaction:string){
    if(!supabase||!me||message.is_deleted||busy)return;
    const current=(messageReactions[message.id]??[]).find(row=>row.profile_id===me.id);
    if(current?.reaction===reaction){
      const {error}=await supabase.from("message_reactions").delete().eq("message_id",message.id).eq("profile_id",me.id);
      if(error)setNotice(error.message);else setMessageReactions(rows=>({...rows,[message.id]:(rows[message.id]??[]).filter(row=>row.profile_id!==me.id)}));
    }else{
      const {data,error}=await supabase.from("message_reactions").upsert({message_id:message.id,profile_id:me.id,reaction},{onConflict:"message_id,profile_id"}).select("message_id,profile_id,reaction,created_at").single();
      if(error)setNotice(error.message);else setMessageReactions(rows=>({...rows,[message.id]:[...(rows[message.id]??[]).filter(row=>row.profile_id!==me.id),data as MessageReaction]}));
    }
  }

  function selectAttachment(file?:File){
    if(!file)return;
    const type=file.type.toLowerCase().split(";")[0];let kind:PendingAttachment["kind"]|null=null;let bucket:PendingAttachment["bucket"]="chat-attachments";
    if(type.startsWith("image/")){kind="image";bucket="chat-images";if(file.size>10*1024*1024){setNotice("Images must be 10 MB or smaller.");return;}}
    else if(type.startsWith("video/")){kind="video";if(!["video/mp4","video/webm","video/quicktime"].includes(type)){setNotice("Choose an MP4, WebM, or QuickTime video.");return;}}
    else if(type.startsWith("audio/")){kind="voice";if(!["audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/wav","audio/x-wav"].includes(type)){setNotice("This audio format is not supported.");return;}}
    else if(["application/pdf","text/plain","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(type)){kind="document";}
    if(!kind){setNotice("Choose an image, video, PDF, office document, or plain text file.");return;}
    if(file.size>25*1024*1024){setNotice("Files must be 25 MB or smaller.");return;}
    const normalizedFile=file.type===type?file:new File([file],file.name,{type,lastModified:file.lastModified});
    setPendingAttachment({file:normalizedFile,kind,bucket});
  }

  async function toggleVoiceRecording(){
    if(recording){recorderRef.current?.stop();setRecording(false);return;}
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setNotice("Voice recording is not supported in this browser.");return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});recorderStreamRef.current=stream;recorderChunksRef.current=[];
      const mime=["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);recorderRef.current=recorder;
      recorder.addEventListener("dataavailable",event=>{if(event.data.size)recorderChunksRef.current.push(event.data);});
      recorder.addEventListener("stop",()=>{const rawType=recorder.mimeType||"audio/webm";const mime=rawType.toLowerCase().split(";")[0];const blob=new Blob(recorderChunksRef.current,{type:mime});const ext=mime.includes("mp4")?"mp4":mime.includes("ogg")?"ogg":"webm";selectAttachment(new File([blob],`voice-note-${Date.now()}.${ext}`,{type:mime}));stream.getTracks().forEach(track=>track.stop());recorderStreamRef.current=null;});
      recorder.start();setRecording(true);
    }catch{setNotice("Allow microphone access to record a voice note.");}
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!supabase || !me) return;
    setBusy(true);
    const { error } = await supabase.rpc("save_my_profile_details", {
      p_display_name:profileDraft.display_name.trim(), p_department:profileDraft.department.trim()||null,
      p_year_of_study:profileDraft.year?Number(profileDraft.year):null, p_bio:profileDraft.bio.trim()||null,
      p_gender:profileDraft.gender||null, p_date_of_birth:profileDraft.date_of_birth||null,
      p_dob_visibility:profileDraft.dob_visibility, p_hometown:profileDraft.hometown.trim()||null,
      p_interests:profileDraft.interests.trim()||null, p_social_link:profileDraft.social_link.trim()||null,
      p_member_type:profileDraft.member_type, p_alumni_set:profileDraft.alumni_set.trim()||null,
    });
    setBusy(false); if (error) setNotice(error.message); else { setNotice("Profile saved."); await load(); }
  }
  async function uploadAvatar(file?: File) {
    if (!supabase || !me || !file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { setNotice("Choose a JPG, PNG, or WebP image smaller than 5 MB."); return; }
    setBusy(true);
    const path = `${me.id}/avatar.${file.type.split("/")[1]}`;
    const { error } = await supabase.storage.from("profile-avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
    if (error) { setBusy(false); setNotice(error.message); return; }
    const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
    const { error: profileError } = await supabase.from("profiles").update({ avatar_url:`${data.publicUrl}?v=${Date.now()}` }).eq("id",me.id);
    setBusy(false); if (profileError) setNotice(profileError.message); else { const updated = { ...me, avatar_url: `${data.publicUrl}?v=${Date.now()}` }; setMe(updated); onProfileChange(updated); setNotice("Profile photo updated."); await load(); }
  }

    if(profileId){const person=viewedProfile??people.find(candidate=>candidate.id===profileId)??(me?.id===profileId?me:null);return <div className="social-backdrop social-standalone"><section className="social-window panel social-page-window profile-page-window"><header className="social-header"><button className="chat-back-button" onClick={()=>router.back()} aria-label="Back"><FiArrowLeft/></button><b>Student profile</b></header>{person?<StudentProfileCard person={person} onMessage={()=>void openDirect(person)}/>:<div className="social-empty">{bootstrapping?"Loading profile…":"This profile could not be found."}</div>}</section></div>;}
  return <div className={`social-backdrop${standalone?" social-standalone":""}${embedded?" social-embedded":""}`} onMouseDown={e => {if(!standalone&&e.target===e.currentTarget)onClose();}}><section ref={socialWindowRef} className={`social-window panel${standalone?" social-page-window":""}${conversationId?" social-chat-screen":""}`} role={standalone?"main":"dialog"} aria-modal={standalone?undefined:true} aria-label="FUTO Life social">
    <header className={`social-header${conversationId?" chat-route-header":""}`}>{conversationId?<><button className="chat-back-button" onClick={embedded?onClose:()=>router.push("/community/messages")} aria-label={embedded?"Back to player profile":"Back to conversations"}><FiArrowLeft/></button><button className="chat-profile-trigger" onClick={()=>chatPartner&&router.push("/community/profile/"+chatPartner.id)} disabled={!chatPartner}><Avatar person={chatPartner}/><span><b>{currentChat?.kind==="group"?currentChat.title:chatPartner?.display_name??"Loading chat…"}</b><small>{chatPartner?.department??(currentChat?.kind==="group"?`${currentChat.members.length} members`:"Tap to view profile")}</small></span></button><NotificationCenter/></>:<><div className="social-brand"><div className="eyebrow">FUTO LIFE · COMMUNITY</div><h2>{tab==="feed"?"Campus feed":tab==="friends"?"Friends":tab==="messages"?"Messages":"My profile"}</h2></div>{standalone?<><NotificationCenter/><Link className="secondary social-close-link" href="/explore">Campus</Link></>:<button className="secondary social-close" onClick={onClose} aria-label="Close social"><FiX/></button>}</>}</header>
    {bootstrapping ? <div className="community-auth-loading social-loading" role="status" aria-live="polite"><span className="community-spinner"/><span>Loading your community…</span></div> : !me ? <div className="social-empty">{notice || "Sign in and complete your profile to use the student community."}<br/>{standalone?<Link className="primary social-signin" href="/explore?auth=signin&next=%2Fcommunity">Sign in / create account</Link>:<button className="primary social-signin" onClick={onSignIn}>Sign in / create account</button>}</div> : <>
      <div className={`social-content${tab==="messages"?" messages-content":""}`}>
        {tab === "feed" && <div className="feed-column">
          <form className="post-composer social-card" onSubmit={publishPost}><div className="composer-row"><Avatar person={me}/><div className="composer-input-wrap"><textarea ref={postInputRef} value={draftPost} onChange={e=>onPostDraftChange(e.target.value,e.target.selectionStart)} onClick={e=>onPostDraftChange(e.currentTarget.value,e.currentTarget.selectionStart)} maxLength={2000} placeholder="Share something with your FUTO friends…" aria-label="Write a post"/>{mentionSuggestions.length>0&&<div className="mention-suggestions" role="listbox" aria-label="Mention a friend">{mentionSuggestions.map(friend=><button type="button" key={friend.id} role="option" onMouseDown={e=>e.preventDefault()} onClick={()=>insertMention(friend)}><Avatar person={friend} small/><span><b>{friend.display_name}</b><small>{friend.department??"FUTO student"}</small></span></button>)}</div>}</div></div><div className="composer-footer"><span className="composer-hint">Type <b>@</b> to mention friends · add <b>#hashtags</b> to label your post</span><button className="primary" disabled={busy||!draftPost.trim()}>{busy?"Posting…":"Post"}</button></div></form>
          {posts.map(post=>{const author=otherPerson(post.author_id); const postComments=comments[post.id]??[]; return <article className="social-card feed-post" key={post.id}><div className="post-author"><Avatar person={author}/><div><strong>{author?.display_name??"FUTO student"}</strong><small>{author?.department??"FUTO Life"} · {new Date(post.created_at).toLocaleString()}</small></div></div><p className="post-body">{renderPostBody(post.body)}</p>{(tags[post.id]?.length??0)>0&&<div className="post-tags">with {(tags[post.id]??[]).map(id=>otherPerson(id)?.display_name).filter(Boolean).join(", ")}</div>}<div className="post-actions"><button disabled={busy} onClick={()=>void likePost(post)}><FiHeart className={(likes[post.id]??[]).includes(me.id)?"liked-icon":""} fill={(likes[post.id]??[]).includes(me.id)?"currentColor":"none"}/> {(likes[post.id]??[]).length} · Like</button><span><FiMessageCircle/> {postComments.length} comments</span>{post.author_id!==me.id&&(myReportedPosts.includes(post.id)?<span className="reported-label">Reported</span>:<button onClick={()=>{setReportTarget(post);setReportReason("spam");setReportDetails("");}}>Report</button>)}</div><div className="comment-list">{postComments.map(comment=><p key={comment.id}><b>{otherPerson(comment.author_id)?.display_name??"Student"}</b> {comment.body}</p>)}</div><form className="comment-form" onSubmit={e=>void addComment(e,post.id)}><Avatar person={me} small/><input name="comment" maxLength={1000} placeholder="Write a comment…" aria-label="Write a comment"/><button aria-label="Send comment" disabled={busy}>{busy?"…":<FiArrowUpRight/>}</button></form></article>;})}
          {!posts.length&&<div className="social-card social-empty">No posts yet. Share a hello to start the FUTO community feed.</div>}
        </div>}
        {tab === "friends" && <div className="friends-layout"><div className="social-card requests-card"><h3>Friend requests <span>{pendingIn.length}</span></h3>{pendingIn.length?pendingIn.map(request=>{const person=otherPerson(request.requester_id);return <div className="person-row" key={request.id}><button className="person-identity" onClick={()=>openProfile(person)} aria-label={`View ${person?.display_name??"student"}'s profile`}><Avatar person={person}/><span className="person-info"><b>{person?.display_name??"FUTO student"}</b><small>{person?.department??"View profile"}</small></span></button><button className="primary compact" disabled={busy} onClick={()=>void respond(request,"accepted")}>Accept</button><button className="secondary compact" disabled={busy} onClick={()=>void respond(request,"declined")}>Decline</button></div>;}):<p className="muted">No pending requests.</p>}{pendingOut.length>0&&<p className="muted">{pendingOut.length} request{pendingOut.length===1?"":"s"} awaiting a reply.</p>}</div><div className="social-card people-card"><h3>Find students</h3><input className="social-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or department…"/>{filteredPeople.filter(p=>!accepted.includes(p.id)).slice(0,100).map(person=>{const sent=pendingOut.some(r=>r.addressee_id===person.id);return <div className="person-row" key={person.id}><button className="person-identity" onClick={()=>openProfile(person)} aria-label={`View ${person.display_name}'s profile`}><Avatar person={person}/><span className="person-info"><b>{person.display_name}</b><small>{[person.department,communityLabel(person)].filter(Boolean).join(" · ")||"View profile"}</small></span></button>{sent?<span className="pending-label">Requested</span>:<button className="secondary compact" disabled={busy} onClick={()=>void sendRequest(person)}><FiPlus/> Add friend</button>}</div>;})}</div><div className="social-card people-card"><h3>Your friends <span>{friends.length}</span></h3><input className="social-search" value={friendSearch} onChange={e=>setFriendSearch(e.target.value)} placeholder="Search friends…" aria-label="Search friends"/>{filteredFriends.length?filteredFriends.map(person=><div className="person-row" key={person.id}><button className="person-identity" onClick={()=>openProfile(person)} aria-label={`View ${person.display_name}'s profile`}><Avatar person={person}/><span className="person-info"><b>{person.display_name}</b><small>{person.department??"FUTO student"}</small></span></button><button className="secondary compact" disabled={busy} onClick={()=>void openDirect(person)}>Message</button><button className="text-action" disabled={busy} onClick={()=>void removeFriend(person.id)}>Remove</button></div>):<p className="muted">{friendSearch?"No friends match that search.":"Accept a request or find classmates above. You need an accepted friendship to chat."}</p>}</div></div>}
        {tab === "messages" && <div className={`chat-layout${conversationId?" chat-full-layout":""}`}>{!conversationId&&<aside className="chat-sidebar"><form className="group-form" onSubmit={e=>void createGroup(e)}><b className="chat-list-heading">Chats <span>{chats.length}</span></b><input name="groupTitle" placeholder="New group name" maxLength={80} required/><details><summary>Choose 2+ friends</summary><div className="group-options">{friends.map(f=><label key={f.id}><input type="checkbox" name="groupFriend" value={f.id}/>{f.display_name}</label>)}</div></details><button className="secondary compact" disabled={busy||friends.length<2}>{busy?"Working…":"Create group"}</button></form><input className="social-search list-search" value={conversationSearch} onChange={e=>setConversationSearch(e.target.value)} placeholder="Search conversations…" aria-label="Search conversations"/>{filteredChats.map(chat=><button className={`chat-row ${activeChat===chat.id?"selected":""}`} key={chat.id} onClick={()=>{setActiveChat(chat.id);router.push("/community/messages/"+chat.id);}}><Avatar person={chat.kind==="group"?null:chat.members.find(m=>m.id!==me.id)??null}/><span><b>{chat.kind==="group"?chat.title:chat.members.find(m=>m.id!==me.id)?.display_name??"Direct chat"}</b><small>{chat.lastMessage?.body??(chat.kind==="group"?`${chat.members.length} members`:"Start a conversation")}</small></span>{(unreadCounts[chat.id]??0)>0&&<span className="unread-pill">{unreadCounts[chat.id]>99?"99+":unreadCounts[chat.id]}</span>}</button>)}{loadingChats&&<p className="muted">Loading conversations…</p>}{!loadingChats&&!filteredChats.length&&<p className="muted">{conversationSearch?"No conversations match that search.":"Your conversations will appear here after you message a friend or create a group."}</p>}</aside>}<section className="chat-main">{currentChat?<><div className="chat-title"><button className="chat-profile-inline" onClick={()=>chatPartner&&router.push("/community/profile/"+chatPartner.id)} disabled={!chatPartner}><Avatar person={chatPartner}/><span><b>{currentChat.kind==="group"?currentChat.title:chatPartner?.display_name}</b><small>{currentChat.kind==="group"?`${currentChat.members.length} members · ${totalMessageCount} messages`:`${totalMessageCount} messages · View profile`}</small></span></button></div><div ref={messageListRef} className="message-list" onScroll={event=>{const node=event.currentTarget;shouldStickToBottomRef.current=node.scrollHeight-node.scrollTop-node.clientHeight<120;}}>{messages.map((message,index)=>{const dayLabel=getMessageDayLabel(message.created_at);const dayKey=getMessageDayKey(message.created_at);const previous=messages[index-1];const showDay=!previous||getMessageDayKey(previous.created_at)!==dayKey;const reactions=messageReactions[message.id]??[];return <Fragment key={message.id}>{showDay&&<div className="message-day-divider"><span>{dayLabel}</span></div>}<ChatMessageBubble message={message} mine={message.sender_id===me.id} senderName={message.sender_id===me.id?"You":otherPerson(message.sender_id)?.display_name??"Friend"} chatKind={currentChat.kind} readers={(messageReads[message.id]??[]).filter(receipt=>receipt.profile_id!==me.id).length} attachmentUrl={attachmentUrls[message.id]} replyMessage={messages.find(item=>item.id===message.reply_to_id)??null} reactions={reactions} myReaction={reactions.find(item=>item.profile_id===me.id)?.reaction??null} selected={selectedMessageId===message.id} onSelect={()=>setSelectedMessageId(selectedMessageId===message.id?null:message.id)} onSender={()=>router.push("/community/profile/"+message.sender_id)} onReply={()=>replyToMessage(message)} onEdit={()=>editMessage(message)} onDelete={()=>setDeleteMessageId(message.id)} onReact={reaction=>void toggleMessageReaction(message,reaction)} onImageLoad={()=>scrollToLatest()}/></Fragment>;})}</div><form className="message-form" onSubmit={e=>void sendMessage(e)}>{(editingTarget||replyTarget)&&<div className="message-action-banner"><div><b>{editingTarget?"Editing message":"Replying to "+replyTargetName}</b><small>{editingTarget?"Only the message text can be changed.":replyTarget?.is_deleted?"This message was deleted":replyTarget?.body||replyTarget?.attachment_name||"Voice note"}</small></div><button type="button" aria-label="Cancel reply or edit" onClick={cancelMessageAction}><FiX/></button></div>}{pendingAttachment&&!editingTarget&&<div className="attachment-pending"><span>{pendingAttachment.kind==="image"?<FiImage/>:pendingAttachment.kind==="video"?<FiVideo/>:pendingAttachment.kind==="voice"?<FiMic/>:<FiFileText/>} {pendingAttachment.file.name}</span><button type="button" aria-label="Remove attachment" onClick={()=>setPendingAttachment(null)}><FiX/></button></div>}{emojiOpen&&<div className="emoji-picker" aria-label="Emoji picker">{["😀","😂","🥰","😍","😊","😉","🙌","👏","👍","❤️","🔥","🎉","🙏","😢","🤝","📍","👋","💯","🤔","🥳"].map(emoji=><button type="button" key={emoji} onClick={()=>{setDraftMessage(current=>current+emoji);setEmojiOpen(false);}}>{emoji}</button>)}</div>}<div className="message-compose-row">{!editingTarget&&<label className="chat-tool-button" title="Attach image, video or document"><FiPlus/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={e=>{selectAttachment(e.currentTarget.files?.[0]);e.currentTarget.value=""}}/></label>}<button type="button" className="chat-tool-button" aria-label="Emoji" aria-expanded={emojiOpen} onClick={()=>setEmojiOpen(value=>!value)}><FiSmile/></button>{!editingTarget&&<button type="button" className={`chat-tool-button voice-button${recording?" recording":""}`} aria-label={recording?"Stop voice note recording":"Record voice note"} onClick={()=>void toggleVoiceRecording()}>{recording?<FiX/>:<FiMic/>}</button>}<input ref={messageInputRef} className="message-text-input" value={draftMessage} onChange={e=>setDraftMessage(e.target.value)} onFocus={()=>{shouldStickToBottomRef.current=true;requestAnimationFrame(()=>scrollToLatest());}} placeholder={recording?"Recording voice note…":editingTarget?"Edit your message…":"Write a message…"} maxLength={4000} enterKeyHint="send"/><button className="primary" disabled={(!draftMessage.trim()&&!pendingAttachment)||busy}>{busy?(editingTarget?"Saving…":"Sending…"):editingTarget?"Save":"Send"}</button></div></form></>:<div className="social-empty">{conversationId?"Loading conversation…":"Choose a conversation to open it here."}</div>}</section></div>}
        {tab === "profile" && <><ProfileDeviceSettings userId={me.id}/><form className="social-card profile-editor" onSubmit={e=>void saveProfile(e)}><div className="avatar-editor"><Avatar person={me} large/><label className="secondary upload-button">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadAvatar(e.currentTarget.files?.[0])}/></label><small>JPG, PNG or WebP · up to 5 MB</small></div><h3 className="profile-section-heading">Basic information</h3><label className="field">Profile type<select value={profileDraft.member_type} onChange={e=>setProfileDraft({...profileDraft,member_type:e.target.value as "student"|"alumni"|"visitor"})}><option value="student">Current student</option><option value="alumni">FUTO alumni</option><option value="visitor">Visitor / guest</option></select></label>{profileDraft.member_type!=="visitor"&&<label className="field">Department<input maxLength={80} value={profileDraft.department} onChange={e=>setProfileDraft({...profileDraft,department:e.target.value})}/></label>}{profileDraft.member_type==="student"&&<label className="field">Year of study<select value={profileDraft.year} onChange={e=>setProfileDraft({...profileDraft,year:e.target.value})}><option value="">Choose year</option>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}{profileDraft.member_type==="alumni"&&<label className="field">Graduation set<input required value={profileDraft.alumni_set} onChange={e=>setProfileDraft({...profileDraft,alumni_set:e.target.value})} placeholder="23/24" pattern="[0-9]{2}/[0-9]{2}" title="Use YY/YY, for example 23/24"/><small className="field-help">Shown as “Alumni - {profileDraft.alumni_set||"YY/YY"} set”.</small></label>}<label className="field">About you<textarea maxLength={280} value={profileDraft.bio} onChange={e=>setProfileDraft({...profileDraft,bio:e.target.value})} placeholder="A little about yourself…"/></label><h3 className="profile-section-heading">A little more about you</h3><label className="field">Gender<select value={profileDraft.gender} onChange={e=>setProfileDraft({...profileDraft,gender:e.target.value as ""|"Male"|"Female"})}><option value="">Prefer not to say</option><option value="Female">Female</option><option value="Male">Male</option></select></label><label className="field">Date of birth<input type="date" max={new Date().toISOString().slice(0,10)} value={profileDraft.date_of_birth} onChange={e=>setProfileDraft({...profileDraft,date_of_birth:e.target.value})}/></label><label className="field">Who can see your date of birth?<select value={profileDraft.dob_visibility} onChange={e=>setProfileDraft({...profileDraft,dob_visibility:e.target.value as "private"|"friends"|"public"})}><option value="private">Only me</option><option value="friends">My friends</option><option value="public">Everyone on FUTO Life</option></select><small className="field-help">Your full date of birth is hidden from everyone else by default.</small></label><label className="field">Hometown<input maxLength={100} value={profileDraft.hometown} onChange={e=>setProfileDraft({...profileDraft,hometown:e.target.value})} placeholder="Where are you from?"/></label><label className="field">Interests<input maxLength={280} value={profileDraft.interests} onChange={e=>setProfileDraft({...profileDraft,interests:e.target.value})} placeholder="Music, football, design…"/></label><label className="field">Website or social link<input type="url" maxLength={200} value={profileDraft.social_link} onChange={e=>setProfileDraft({...profileDraft,social_link:e.target.value})} placeholder="https://…"/><small className="field-help">Use a full https:// link. Only share a link you are comfortable making visible to signed-in students.</small></label><button className="primary" disabled={busy}>{busy?"Saving…":"Save profile"}</button></form><section className="social-card profile-editor referral-card"><h3>Invite classmates</h3><p>Your referrals are recorded as a private chain. There are no rewards for referrals at this time.</p><div className="referral-link-row"><code>{me.referral_code?`/?ref=${me.referral_code}`:"Referral link unavailable"}</code><button className="secondary compact" onClick={()=>void copyReferralLink()}>Copy link</button></div><p><b>{referralNetwork.length}</b> people in your referral network · direct and downstream referrals</p>{referralNetwork.slice(0,20).map(person=><div className="referral-person" key={person.profile_id}><span className="referral-depth">L{person.depth}</span><span>{person.display_name}</span><small>{new Date(person.joined_at).toLocaleDateString()}</small></div>)}</section></>}
      </div>
    </>}
    {standalone&&!conversationId&&<nav className="community-bottom-nav" aria-label="Community navigation"><Link className={tab==="feed"?"active":""} href="/community/feed"><FiHome/><span>Feed</span></Link><Link className={tab==="friends"?"active":""} href="/community/friends"><span className="bottom-nav-icon"><FiUsers/>{pendingIn.length>0&&<i>{pendingIn.length>99?"99+":pendingIn.length}</i>}</span><span>Friends</span></Link><Link className={tab==="messages"?"active":""} href="/community/messages"><span className="bottom-nav-icon"><FiMessageCircle/>{unreadTotal>0&&<i>{unreadTotal>99?"99+":unreadTotal}</i>}</span><span>Chats</span></Link><Link className={tab==="profile"?"active":""} href="/community/profile"><FiUser/><span>Profile</span></Link></nav>}
    {deleteMessageId&&<div className="report-backdrop"><section className="report-dialog panel" role="dialog" aria-modal="true" aria-labelledby="delete-message-title"><div className="eyebrow">Chat message</div><h2 id="delete-message-title">Delete this message?</h2><p>{messages.find(message=>message.id===deleteMessageId)?.sender_id===me?.id?"Choose whether to delete this message only for you or for everyone in the conversation.":"This message will be removed from your conversation only."}</p><div className="confirm-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setDeleteMessageId(null)}>Cancel</button><button type="button" className="secondary" disabled={busy} onClick={()=>void confirmDeleteMessage(false)}>{busy?"Deleting…":"Delete for me"}</button>{messages.find(message=>message.id===deleteMessageId)?.sender_id===me?.id&&<button type="button" className="primary" disabled={busy} onClick={()=>void confirmDeleteMessage(true)}>{busy?"Deleting…":"Delete for everyone"}</button>}</div></section></div>}
    {reportTarget&&<div className="report-backdrop"><form className="report-dialog panel" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={e=>void submitReport(e)}><div className="eyebrow">Community safety</div><h2 id="report-title">Report this post</h2><p>Reports are reviewed by the FUTO Life admin team. The author won’t see who submitted a report.</p><label className="field">Reason<select value={reportReason} onChange={e=>setReportReason(e.target.value as ReportReason)}><option value="spam">Spam</option><option value="harassment">Harassment or bullying</option><option value="hate_or_abuse">Hate or abuse</option><option value="sexual_content">Sexual content</option><option value="violence">Violence or threats</option><option value="false_information">False information</option><option value="other">Other</option></select></label><label className="field">More details (optional)<textarea maxLength={1000} value={reportDetails} onChange={e=>setReportDetails(e.target.value)} placeholder="Add context to help the admin review"/></label><div className="confirm-actions"><button type="button" className="secondary" onClick={()=>setReportTarget(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?"Sending…":"Send report"}</button></div></form></div>}
  </section></div>;
}

function ChatMessageBubble({message,mine,senderName,chatKind,readers,attachmentUrl,replyMessage,reactions,myReaction,selected,onSelect,onSender,onReply,onEdit,onDelete,onReact,onImageLoad}:{message:Message;mine:boolean;senderName:string;chatKind:"direct"|"group";readers:number;attachmentUrl?:string;replyMessage:Message|null;reactions:MessageReaction[];myReaction:string|null;selected:boolean;onSelect:()=>void;onSender:()=>void;onReply:()=>void;onEdit:()=>void;onDelete:()=>void;onReact:(reaction:string)=>void;onImageLoad:()=>void}){
  const touchStart=useRef<{x:number;y:number}|null>(null);
  const reactionChoices=["👍","❤️","😂","😮","😢","🙏"];
  const groupedReactions=Array.from(reactions.reduce((groups,row)=>groups.set(row.reaction,(groups.get(row.reaction)??[]).concat(row)),new Map<string,MessageReaction[]>()).entries());
  const messageText=message.is_deleted?"This message was deleted":message.body&&message.body!==message.attachment_name&&!(message.message_kind==="voice"&&message.body==="Voice note")?message.body:null;
  return <div className={`message-item${mine?" mine":""}${selected?" selected":""}`} onTouchStart={event=>{touchStart.current={x:event.changedTouches[0].clientX,y:event.changedTouches[0].clientY};}} onTouchEnd={event=>{const start=touchStart.current;touchStart.current=null;if(!start)return;const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;if(dx>58&&Math.abs(dy)<44&&!message.is_deleted){event.preventDefault();onReply();}}}>
    <div className={`message-bubble ${mine?"mine":""}`} onClick={event=>{if((event.target as HTMLElement).closest("button,a,input,video"))return;onSelect();}}>
      <small><button className="message-sender-profile" onClick={onSender}>{senderName}</button></small>
      {replyMessage&&!message.is_deleted&&<div className="message-reply-quote"><b>{replyMessage.is_deleted?"Deleted message":"Reply"}</b><span>{replyMessage.is_deleted?"This message was deleted":replyMessage.body||replyMessage.attachment_name||"Voice note"}</span></div>}
      {message.is_deleted?<p className="message-deleted-label">This message was deleted</p>:<>
        {messageText&&<p>{messageText}{message.edited_at&&<small className="message-edited-label">edited</small>}</p>}
        {message.attachment_path&&attachmentUrl&&<div className="message-attachment">{message.message_kind==="image"?<a href={attachmentUrl} target="_blank" rel="noreferrer"><img src={attachmentUrl} alt={message.attachment_name??"Chat image"} onLoad={onImageLoad}/></a>:message.message_kind==="video"?<video controls preload="metadata" src={attachmentUrl} onLoadedMetadata={onImageLoad}/>:message.message_kind==="voice"?<VoiceNotePlayer src={attachmentUrl} mine={mine}/>:<a className="document-attachment" href={attachmentUrl} target="_blank" rel="noreferrer" download={message.attachment_name}><FiFileText/>{message.attachment_name}</a>}</div>}
      </>}
      <div className="message-meta"><time>{new Date(message.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time>{mine&&<span className={readers?"receipt-seen":"receipt-sent"} title={readers?chatKind==="group"?`Seen by ${readers} members`:"Read":"Sent"} aria-label={readers?"Read":"Sent"}>{readers?<IoCheckmarkDone/>:<FiCheck/>}{chatKind==="group"&&readers?` ${readers}`:""}</span>}</div>
    </div>
    {groupedReactions.length>0&&!message.is_deleted&&<div className="message-reaction-summary">{groupedReactions.map(([reaction,rows])=><button type="button" key={reaction} className={myReaction===reaction?"active":""} onClick={()=>onReact(reaction)} aria-label={`${reaction} reaction, ${rows.length} total`}>{reaction}<small>{rows.length}</small></button>)}</div>}
    {selected&&<div className="message-action-bar" onClick={event=>event.stopPropagation()}><div className="message-reaction-picker" aria-label="React to message">{reactionChoices.map(reaction=><button type="button" key={reaction} className={myReaction===reaction?"active":""} onClick={()=>onReact(reaction)} aria-label={`React ${reaction}`}>{reaction}</button>)}</div><button type="button" onClick={onReply} disabled={message.is_deleted}><FiCornerUpLeft/>Reply</button>{mine&&message.message_kind==="text"&&!message.is_deleted&&<button type="button" onClick={onEdit}><FiEdit2/>Edit</button>}{!message.is_deleted&&<button type="button" className="message-delete-action" onClick={onDelete}><FiTrash2/>Delete</button>}</div>}
  </div>;
}

function ProfileDeviceSettings({userId}:{userId:string}){
  const [permission,setPermission]=useState<NotificationPermission|"unsupported">("default");
  const [notificationsEnabled,setNotificationsEnabled]=useState(false);
  const [installed,setInstalled]=useState(false);
  useEffect(()=>{
    const syncNotifications=()=>{
      const supported="Notification" in window;
      setPermission(supported?window.Notification.permission:"unsupported");
      setNotificationsEnabled(Boolean(supported&&window.Notification.permission==="granted"&&window.localStorage.getItem(`futolife:web-notifications:${userId}`)==="enabled"));
    };
    const rememberInstall=()=>{setInstalled(true);window.localStorage.setItem(`futolife:install-nudge:${userId}`,"installed");};
    syncNotifications();
    setInstalled(window.matchMedia("(display-mode: standalone)").matches||window.localStorage.getItem(`futolife:install-nudge:${userId}`)==="installed");
    window.addEventListener("futolife-notification-preference",syncNotifications);
    window.addEventListener("focus",syncNotifications);
    window.addEventListener("appinstalled",rememberInstall);
    return()=>{window.removeEventListener("futolife-notification-preference",syncNotifications);window.removeEventListener("focus",syncNotifications);window.removeEventListener("appinstalled",rememberInstall);};
  },[userId]);
  async function enableNotifications(){
    if(!("Notification" in window)){setPermission("unsupported");notify("Browser notifications are not supported on this device.");return;}
    try{
      const next=await window.Notification.requestPermission();
      setPermission(next);
      if(next!=="granted"){setNotificationsEnabled(false);notify(next==="denied"?"Allow notifications for this site in your browser settings.":"Browser notifications were not enabled.");return;}
      window.localStorage.setItem(`futolife:web-notifications:${userId}`,"enabled");
      setNotificationsEnabled(true);
      window.dispatchEvent(new Event("futolife-notification-preference"));
      notify("Browser notifications are enabled on this device.");
    }catch{notify("Could not enable browser notifications in this browser.");}
  }
  return <section className="social-card profile-device-settings" aria-labelledby="profile-device-title"><div className="profile-device-heading"><div><span className="eyebrow">Your device</span><h3 id="profile-device-title">App & notifications</h3><p>Keep FUTO Life close and choose whether this device can show message and friend-request alerts.</p></div></div><div className="profile-device-actions"><div className="profile-device-row"><span className="profile-device-icon"><FiDownload/></span><span><b>Home screen</b><small>{installed?"FUTO Life is installed on this device.":"Add FUTO Life for quick access from your home screen."}</small></span><button type="button" className="secondary compact" onClick={()=>{if(installed)return;window.dispatchEvent(new Event("futolife-install-request"));}} disabled={installed}>{installed?"Added":"Install app"}</button></div><div className="profile-device-row"><span className="profile-device-icon"><FiBell/></span><span><b>Browser notifications</b><small>{permission==="unsupported"?"Notifications are not supported by this browser.":permission==="denied"?"Blocked by browser settings. Allow notifications for this site in browser settings.":notificationsEnabled?"Enabled for messages and friend requests on this device.":"Get alerts for messages and friend requests while FUTO Life is in the background."}</small></span><button type="button" className="secondary compact" onClick={()=>void enableNotifications()} disabled={permission==="unsupported"||notificationsEnabled}>{notificationsEnabled?<><FiCheck/> Enabled</>:permission==="denied"?"Browser settings":"Enable"}</button></div></div><small className="profile-device-note">These settings apply to this browser and device. You can revisit them here anytime.</small></section>;
}

function Avatar({person,small=false,large=false}:{person:Person|null|undefined;small?:boolean;large?:boolean}) {
  return <span className={`social-avatar${small?" small":""}${large?" large":""}`}>{person?.avatar_url?<img src={person.avatar_url} alt=""/>:person?.display_name?.slice(0,1).toUpperCase()??"F"}</span>;
}

function VoiceNotePlayer({src,mine}:{src:string;mine:boolean}){
  const audioRef=useRef<HTMLAudioElement>(null);
  const [playing,setPlaying]=useState(false);
  const [currentTime,setCurrentTime]=useState(0);
  const [duration,setDuration]=useState(0);
  const progress=duration?currentTime/duration:0;
  const bars=Array.from({length:34},(_,index)=>22+((index*29+index*index*7)%72));
  const formatTime=(value:number)=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,"0")}`;
  const togglePlayback=()=>{
    const audio=audioRef.current;
    if(!audio)return;
    if(audio.paused)void audio.play().catch(()=>setPlaying(false));
    else audio.pause();
  };
  return <div className={`voice-note-player${mine?" mine":""}`}>
    <audio ref={audioRef} src={src} preload="metadata" onLoadedMetadata={event=>setDuration(Number.isFinite(event.currentTarget.duration)?event.currentTarget.duration:0)} onDurationChange={event=>setDuration(Number.isFinite(event.currentTarget.duration)?event.currentTarget.duration:0)} onTimeUpdate={event=>setCurrentTime(event.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);setCurrentTime(0);if(audioRef.current)audioRef.current.currentTime=0;}}/>
    <button className="voice-play-button" type="button" onClick={togglePlayback} aria-label={playing?"Pause voice note":"Play voice note"}>{playing?<FiPause/>:<FiPlay/>}</button>
    <div className="voice-wave-area"><div className="voice-waveform" aria-hidden="true">{bars.map((height,index)=><i key={index} className={index/ bars.length<=progress?"played":""} style={{height:`${height}%`}}/>)}</div><input className="voice-seek" type="range" min={0} max={duration||0.01} step={0.05} value={Math.min(currentTime,duration||0.01)} onChange={event=>{if(audioRef.current)audioRef.current.currentTime=Number(event.target.value);}} aria-label="Seek voice note"/><div className="voice-time">{formatTime(playing||currentTime?currentTime:duration)}</div></div>
  </div>;
}

function StudentProfileCard({person,onMessage}:{person:Person;onMessage:()=>void}){
  const [photoOpen,setPhotoOpen]=useState(false);
  const [zoom,setZoom]=useState(1);
  const birthDate=person.date_of_birth?new Date(`${person.date_of_birth}T12:00:00`).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}):null;
  return <main className="student-profile-card">{person.avatar_url?<button className="profile-photo-button" onClick={()=>{setZoom(1);setPhotoOpen(true);}} aria-label={`View ${person.display_name}'s profile photo`}><Avatar person={person} large/></button>:<Avatar person={person} large/>}<h1>{person.display_name}</h1><p className="student-profile-meta">{[person.department,(person.member_type==="alumni"?`Alumni - ${person.alumni_set??"Set not provided"} set`:person.member_type==="visitor"?"Visitor":person.year_of_study?`Year ${person.year_of_study}`:null)].filter(Boolean).join(" · ")||"FUTO student"}</p>{person.bio&&<p className="student-profile-bio">{person.bio}</p>}<div className="student-profile-details">{person.gender&&<p><span>Gender</span><b>{person.gender}</b></p>}{birthDate&&<p><span>Date of birth</span><b>{birthDate}</b></p>}{person.hometown&&<p><span>Hometown</span><b>{person.hometown}</b></p>}{person.interests&&<p><span>Interests</span><b>{person.interests}</b></p>}{person.social_link&&<p><span>Link</span><a href={person.social_link} target="_blank" rel="noopener noreferrer">Visit website or social profile ↗</a></p>}</div><button className="primary" onClick={onMessage}><FiMessageCircle/> Message</button>{photoOpen&&<div className="profile-photo-viewer" role="dialog" aria-modal="true" aria-label={`${person.display_name}'s profile photo`} onClick={()=>setPhotoOpen(false)} onWheel={event=>{event.preventDefault();setZoom(value=>Math.min(3,Math.max(0.6,value+(event.deltaY<0?0.12:-0.12))));}}><button className="photo-viewer-close" onClick={()=>setPhotoOpen(false)} aria-label="Close photo"><FiX/></button><div className="photo-viewer-controls" onClick={event=>event.stopPropagation()}><button onClick={()=>setZoom(value=>Math.max(0.6,value-0.2))} aria-label="Zoom out"><FiZoomOut/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(value=>Math.min(3,value+0.2))} aria-label="Zoom in"><FiZoomIn/></button></div><div className="profile-photo-frame" onClick={event=>event.stopPropagation()}><img src={person.avatar_url ?? ""} alt={`${person.display_name}'s profile`} style={{transform:`scale(${zoom})`}} draggable={false}/></div></div>}</main>;
}

function renderPostBody(body:string){
  return body.split(/(#[\p{L}\p{N}_]{1,32})/gu).map((part,index)=>part.startsWith("#")?<span className="post-hashtag" key={`${part}-${index}`}>{part}</span>:part);
}

function getMessageDayKey(timestamp:string){
  const date=new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getMessageDayLabel(timestamp:string){
  const date=new Date(timestamp);
  const today=new Date();
  const messageDay=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
  const todayDay=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
  const daysAgo=Math.round((todayDay-messageDay)/86400000);
  if(daysAgo===0)return "Today";
  if(daysAgo===1)return "Yesterday";
  if(daysAgo>1&&daysAgo<7)return date.toLocaleDateString(undefined,{weekday:"long"});
  return `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()}`;
}
