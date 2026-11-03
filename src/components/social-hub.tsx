"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowUpRight, FiFileText, FiHeart, FiHome, FiImage, FiMessageCircle, FiMic, FiPlus, FiSmile, FiUser, FiUsers, FiVideo, FiX, FiCheck } from "react-icons/fi";
import { IoCheckmarkDone } from "react-icons/io5";
import { createClient } from "@/lib/supabase/browser";
import { notify } from "@/lib/notify";

type Person = { id: string; display_name: string; department: string | null; year_of_study: number | null; avatar_url: string | null; bio?: string | null; referral_code?: string; is_suspended?: boolean };
type Friendship = { id: string; requester_id: string; addressee_id: string; status: string; created_at: string };
type Post = { id: string; author_id: string; body: string; created_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; message_kind?: "text"|"image"|"video"|"document"|"voice"; attachment_bucket?: string|null; attachment_path?: string|null; attachment_name?: string|null; attachment_size?: number|null; attachment_mime?: string|null };
type MessageRead = { message_id: string; profile_id: string; read_at: string };
type PendingAttachment = { file: File; kind: "image"|"video"|"document"|"voice"; bucket: "chat-images"|"chat-attachments" };
type Chat = { id: string; kind: "direct" | "group"; title: string | null; created_at: string; members: Person[]; lastMessage?: Message };
type ReferralRow = {profile_id:string;display_name:string;depth:number;joined_at:string};
type ReportReason = "spam"|"harassment"|"hate_or_abuse"|"sexual_content"|"violence"|"false_information"|"other";

export default function SocialHub({ onClose = () => {}, onSignIn, onProfileChange = () => {}, standalone = false, initialTab = "feed", conversationId, profileId }: { onClose?: () => void; onSignIn?: () => void; onProfileChange?: (profile: Person) => void; standalone?: boolean; initialTab?: "feed"|"friends"|"messages"|"profile"; conversationId?: string; profileId?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router=useRouter();
  const [me, setMe] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [messageReads, setMessageReads] = useState<Record<string, MessageRead[]>>({});
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
  const [loadingChats, setLoadingChats] = useState(false);
  const [draftPost, setDraftPost] = useState("");
  const postInputRef=useRef<HTMLTextAreaElement>(null);
  const messageListRef=useRef<HTMLDivElement>(null);
  const socialWindowRef=useRef<HTMLElement>(null);
  const recorderRef=useRef<MediaRecorder|null>(null);
  const recorderStreamRef=useRef<MediaStream|null>(null);
  const recorderChunksRef=useRef<Blob[]>([]);
  const [mentionQuery,setMentionQuery]=useState<string|null>(null);
  const [mentionStart,setMentionStart]=useState<number|null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [profileDraft, setProfileDraft] = useState({ display_name: "", department: "", year: "", bio: "" });

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoadingChats(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingChats(false);setNotice("Sign in to connect with FUTO students."); return; }
    const [profileResult, peopleResult, friendshipResult, postResult, memberResult] = await Promise.all([
      supabase.from("profiles").select("id,display_name,department,year_of_study,avatar_url,bio,referral_code,is_suspended").eq("id", user.id).maybeSingle(),
      supabase.from("profiles").select("id,display_name,department,year_of_study,avatar_url,bio").neq("id", user.id).order("display_name").limit(300),
      supabase.from("friendships").select("id,requester_id,addressee_id,status,created_at").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
      supabase.from("posts").select("id,author_id,body,created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("conversation_members").select("conversation_id").eq("profile_id", user.id),
    ]);
    if (profileResult.data) {
      const p = profileResult.data as Person;
      setMe(p);
      setProfileDraft({ display_name: p.display_name, department: p.department ?? "", year: p.year_of_study ? String(p.year_of_study) : "", bio: p.bio ?? "" });
      if(p.is_suspended)setNotice("This account is suspended from social interactions. Contact FUTO Life support if you think this is a mistake.");
    }
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
    const [messageResult, unreadResult] = await Promise.all([
      supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,message_kind,attachment_bucket,attachment_path,attachment_name,attachment_size,attachment_mime").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(conversationIds.length * 3),
      supabase.rpc("get_my_unread_counts"),
    ]);
    const messageRows = (messageResult.data ?? []) as Message[];
    setUnreadCounts(Object.fromEntries(((unreadResult.data??[]) as {conversation_id:string;unread_count:number}[]).map(row=>[row.conversation_id,Number(row.unread_count)])));
    setChats(conversationRows.map((chat) => ({ ...chat, members: memberRows.filter(m => m.conversation_id === chat.id).map(m => profileMap.get(m.profile_id)).filter((p): p is Person => Boolean(p)), lastMessage: messageRows.find(m => m.conversation_id === chat.id) })));
    setLoadingChats(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(()=>{setTab(initialTab);setActiveChat(conversationId??null);},[initialTab,conversationId]);
  useEffect(() => { if (notice) { notify(notice); setNotice(""); } }, [notice]);
  useEffect(() => {
    if (!supabase || !activeChat) return;
    setMessages([]);setTotalMessageCount(0);setMessageReads({});setAttachmentUrls({});
    const refreshUnread = async () => {
      const {data}=await supabase.rpc("get_my_unread_counts");
      setUnreadCounts(Object.fromEntries(((data??[]) as {conversation_id:string;unread_count:number}[]).map(row=>[row.conversation_id,Number(row.unread_count)])));
    };
    const markRead = async () => {
      await supabase.rpc("mark_conversation_read",{target_conversation:activeChat});
      await refreshUnread();
    };
    const refresh = async () => {
      const { data, count } = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,message_kind,attachment_bucket,attachment_path,attachment_name,attachment_size,attachment_mime",{count:"exact"}).eq("conversation_id", activeChat).order("created_at").limit(300);
      const rows=(data??[]) as Message[];setMessages(rows);
      setTotalMessageCount(count??rows.length);
      if(tab==="messages"&&document.visibilityState==="visible")await markRead();
      if(rows.length){const {data:reads}=await supabase.from("message_reads").select("message_id,profile_id,read_at").in("message_id",rows.map(row=>row.id));const grouped=(reads??[] as MessageRead[]).reduce<Record<string,MessageRead[]>>((acc,row)=>{(acc[row.message_id]??=[]).push(row as MessageRead);return acc;},{});setMessageReads(grouped);}
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
    }).on("postgres_changes",{event:"INSERT",schema:"public",table:"message_reads"},payload=>{
      const receipt=payload.new as MessageRead;
      setMessageReads(current=>({...current,[receipt.message_id]:[...(current[receipt.message_id]??[]).filter(row=>row.profile_id!==receipt.profile_id),receipt]}));
      void refreshUnread();
    }).subscribe();
    return () => { document.removeEventListener("visibilitychange",handleVisibility);void supabase.removeChannel(channel); };
  }, [activeChat, supabase, tab, me?.id]);

  useEffect(()=>{
    let active=true;
    const attached=messages.filter(message=>message.attachment_bucket&&message.attachment_path);
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

  useEffect(() => {
    if (tab === "messages" && activeChat && messageListRef.current) {
      messageListRef.current.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, tab, activeChat]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncKeyboardViewport = () => {
      const element = socialWindowRef.current;
      if (!element || !standalone || tab !== "messages") return;
      const keyboardOpen = window.innerWidth <= 720 && viewport && viewport.height < window.innerHeight - 100;
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
  const currentChat = chats.find((chat) => chat.id === activeChat);
  const chatPartner=currentChat?.kind === "direct" ? currentChat.members.find(member=>member.id!==me?.id)??null : null;
  const unreadTotal=Object.values(unreadCounts).reduce((total,count)=>total+count,0);
  const otherPerson = (id: string) => people.find((p) => p.id === id) ?? (me?.id === id ? me : null);
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
    let attachment:{bucket:string;path:string;name:string;size:number;mime:string;kind:string}|null=null;
    if(pendingAttachment){
      const {file,kind,bucket}=pendingAttachment;
      const path=`${activeChat}/${me.id}/${crypto.randomUUID()}-${file.name.replace(/[^\p{L}\p{N}._-]/gu,"_")}`;
      const {error:uploadError}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});
      if(uploadError){setBusy(false);setNotice(`Upload failed: ${uploadError.message}`);return;}
      attachment={bucket,path,name:file.name,size:file.size,mime:file.type,kind};
    }
    const body=draftMessage.trim()||(attachment?.kind==="voice"?"Voice note":attachment?.name??"");
    const { error } = await supabase.from("messages").insert({conversation_id:activeChat,sender_id:me.id,body,message_kind:attachment?.kind??"text",attachment_bucket:attachment?.bucket??null,attachment_path:attachment?.path??null,attachment_name:attachment?.name??null,attachment_size:attachment?.size??null,attachment_mime:attachment?.mime??null});
    if(error&&attachment)await supabase.storage.from(attachment.bucket).remove([attachment.path]);
    if (error) setNotice(error.message); else { setDraftMessage("");setPendingAttachment(null);setEmojiOpen(false); const {data,count} = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,message_kind,attachment_bucket,attachment_path,attachment_name,attachment_size,attachment_mime",{count:"exact"}).eq("conversation_id",activeChat).order("created_at").limit(300); setMessages((data ?? []) as Message[]);setTotalMessageCount(count??data?.length??0); }
    setBusy(false);
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
    const { data, error } = await supabase.from("profiles").update({ display_name:profileDraft.display_name.trim(), department:profileDraft.department.trim() || null, year_of_study:profileDraft.year ? Number(profileDraft.year) : null, bio:profileDraft.bio.trim() || null }).eq("id",me.id).select("id,display_name,department,year_of_study,avatar_url,bio").single();
    setBusy(false); if (error) setNotice(error.message); else { setMe(data as Person); onProfileChange(data as Person); setNotice("Profile saved."); await load(); }
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

    if(profileId){const person=people.find(candidate=>candidate.id===profileId)??(me?.id===profileId?me:null);return <div className="social-backdrop social-standalone"><section className="social-window panel social-page-window profile-page-window"><header className="social-header"><button className="chat-back-button" onClick={()=>router.back()} aria-label="Back"><FiArrowLeft/></button><b>Student profile</b></header>{person?<StudentProfileCard person={person} onMessage={()=>void openDirect(person)}/>:<div className="social-empty">{loadingChats?"Loading profile…":"This profile could not be found."}</div>}</section></div>;}
  return <div className={`social-backdrop${standalone?" social-standalone":""}`} onMouseDown={e => {if(!standalone&&e.target===e.currentTarget)onClose();}}><section ref={socialWindowRef} className={`social-window panel${standalone?" social-page-window":""}${conversationId?" social-chat-screen":""}`} role={standalone?"main":"dialog"} aria-modal={standalone?undefined:true} aria-label="FUTO Life social">
    <header className={`social-header${conversationId?" chat-route-header":""}`}>{conversationId?<><button className="chat-back-button" onClick={()=>router.push("/community/messages")} aria-label="Back to conversations"><FiArrowLeft/></button><button className="chat-profile-trigger" onClick={()=>chatPartner&&router.push("/community/profile/"+chatPartner.id)} disabled={!chatPartner}><Avatar person={chatPartner}/><span><b>{currentChat?.kind==="group"?currentChat.title:chatPartner?.display_name??"Loading chat…"}</b><small>{chatPartner?.department??(currentChat?.kind==="group"?`${currentChat.members.length} members`:"Tap to view profile")}</small></span></button></>:<><div className="social-brand"><div className="eyebrow">FUTO LIFE · COMMUNITY</div><h2>{tab==="feed"?"Campus feed":tab==="friends"?"Friends":tab==="messages"?"Messages":"My profile"}</h2></div>{standalone?<Link className="secondary social-close-link" href="/explore">Campus</Link>:<button className="secondary social-close" onClick={onClose} aria-label="Close social"><FiX/></button>}</>}</header>
    {!me ? <div className="social-empty">{notice || "Sign in and complete your profile to use the student community."}<br/>{standalone?<Link className="primary social-signin" href="/explore?auth=signin&next=%2Fcommunity">Sign in / create account</Link>:<button className="primary social-signin" onClick={onSignIn}>Sign in / create account</button>}</div> : <>
      <div className={`social-content${tab==="messages"?" messages-content":""}`}>
        {tab === "feed" && <div className="feed-column">
          <form className="post-composer social-card" onSubmit={publishPost}><div className="composer-row"><Avatar person={me}/><div className="composer-input-wrap"><textarea ref={postInputRef} value={draftPost} onChange={e=>onPostDraftChange(e.target.value,e.target.selectionStart)} onClick={e=>onPostDraftChange(e.currentTarget.value,e.currentTarget.selectionStart)} maxLength={2000} placeholder="Share something with your FUTO friends…" aria-label="Write a post"/>{mentionSuggestions.length>0&&<div className="mention-suggestions" role="listbox" aria-label="Mention a friend">{mentionSuggestions.map(friend=><button type="button" key={friend.id} role="option" onMouseDown={e=>e.preventDefault()} onClick={()=>insertMention(friend)}><Avatar person={friend} small/><span><b>{friend.display_name}</b><small>{friend.department??"FUTO student"}</small></span></button>)}</div>}</div></div><div className="composer-footer"><span className="composer-hint">Type <b>@</b> to mention friends · add <b>#hashtags</b> to label your post</span><button className="primary" disabled={busy||!draftPost.trim()}>{busy?"Posting…":"Post"}</button></div></form>
          {posts.map(post=>{const author=otherPerson(post.author_id); const postComments=comments[post.id]??[]; return <article className="social-card feed-post" key={post.id}><div className="post-author"><Avatar person={author}/><div><strong>{author?.display_name??"FUTO student"}</strong><small>{author?.department??"FUTO Life"} · {new Date(post.created_at).toLocaleString()}</small></div></div><p className="post-body">{renderPostBody(post.body)}</p>{(tags[post.id]?.length??0)>0&&<div className="post-tags">with {(tags[post.id]??[]).map(id=>otherPerson(id)?.display_name).filter(Boolean).join(", ")}</div>}<div className="post-actions"><button disabled={busy} onClick={()=>void likePost(post)}>{(likes[post.id]??[]).includes(me.id)?"♥":"♡"} {(likes[post.id]??[]).length} · Like</button><span>▢ {postComments.length} comments</span>{post.author_id!==me.id&&(myReportedPosts.includes(post.id)?<span className="reported-label">Reported</span>:<button onClick={()=>{setReportTarget(post);setReportReason("spam");setReportDetails("");}}>Report</button>)}</div><div className="comment-list">{postComments.map(comment=><p key={comment.id}><b>{otherPerson(comment.author_id)?.display_name??"Student"}</b> {comment.body}</p>)}</div><form className="comment-form" onSubmit={e=>void addComment(e,post.id)}><Avatar person={me} small/><input name="comment" maxLength={1000} placeholder="Write a comment…" aria-label="Write a comment"/><button aria-label="Send comment" disabled={busy}>{busy?"…":"↗"}</button></form></article>;})}
          {!posts.length&&<div className="social-card social-empty">No posts yet. Share a hello to start the FUTO community feed.</div>}
        </div>}
        {tab === "friends" && <div className="friends-layout"><div className="social-card requests-card"><h3>Friend requests <span>{pendingIn.length}</span></h3>{pendingIn.length?pendingIn.map(request=>{const person=otherPerson(request.requester_id);return <div className="person-row" key={request.id}><Avatar person={person}/><div className="person-info"><b>{person?.display_name??"FUTO student"}</b><small>{person?.department??""}</small></div><button className="primary compact" disabled={busy} onClick={()=>void respond(request,"accepted")}>Accept</button><button className="secondary compact" disabled={busy} onClick={()=>void respond(request,"declined")}>Decline</button></div>;}):<p className="muted">No pending requests.</p>}{pendingOut.length>0&&<p className="muted">{pendingOut.length} request{pendingOut.length===1?"":"s"} awaiting a reply.</p>}</div><div className="social-card people-card"><h3>Find students</h3><input className="social-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or department…"/>{filteredPeople.filter(p=>!accepted.includes(p.id)).slice(0,100).map(person=>{const sent=pendingOut.some(r=>r.addressee_id===person.id);return <div className="person-row" key={person.id}><Avatar person={person}/><div className="person-info"><b>{person.display_name}</b><small>{[person.department,person.year_of_study?`Year ${person.year_of_study}`:""].filter(Boolean).join(" · ")}</small></div>{sent?<span className="pending-label">Requested</span>:<button className="secondary compact" disabled={busy} onClick={()=>void sendRequest(person)}>＋ Add friend</button>}</div>;})}</div><div className="social-card people-card"><h3>Your friends <span>{friends.length}</span></h3>{friends.length?friends.map(person=><div className="person-row" key={person.id}><Avatar person={person}/><div className="person-info"><b>{person.display_name}</b><small>{person.department??"FUTO student"}</small></div><button className="secondary compact" disabled={busy} onClick={()=>void openDirect(person)}>Message</button><button className="text-action" disabled={busy} onClick={()=>void removeFriend(person.id)}>Remove</button></div>):<p className="muted">Accept a request or find classmates above. You need an accepted friendship to chat.</p>}</div></div>}
        {tab === "messages" && <div className={`chat-layout${conversationId?" chat-full-layout":""}`}>{!conversationId&&<aside className="chat-sidebar"><form className="group-form" onSubmit={e=>void createGroup(e)}><b className="chat-list-heading">Chats <span>{chats.length}</span></b><input name="groupTitle" placeholder="New group name" maxLength={80} required/><details><summary>Choose 2+ friends</summary><div className="group-options">{friends.map(f=><label key={f.id}><input type="checkbox" name="groupFriend" value={f.id}/>{f.display_name}</label>)}</div></details><button className="secondary compact" disabled={busy||friends.length<2}>{busy?"Working…":"Create group"}</button></form>{chats.map(chat=><button className={`chat-row ${activeChat===chat.id?"selected":""}`} key={chat.id} onClick={()=>{setActiveChat(chat.id);router.push("/community/messages/"+chat.id);}}><Avatar person={chat.kind==="group"?null:chat.members.find(m=>m.id!==me.id)??null}/><span><b>{chat.kind==="group"?chat.title:chat.members.find(m=>m.id!==me.id)?.display_name??"Direct chat"}</b><small>{chat.lastMessage?.body??(chat.kind==="group"?`${chat.members.length} members`:"Start a conversation")}</small></span>{(unreadCounts[chat.id]??0)>0&&<span className="unread-pill">{unreadCounts[chat.id]>99?"99+":unreadCounts[chat.id]}</span>}</button>)}{loadingChats&&<p className="muted">Loading conversations…</p>}{!loadingChats&&!chats.length&&<p className="muted">Your conversations will appear here after you message a friend or create a group.</p>}</aside>}<section className="chat-main">{currentChat?<><div className="chat-title"><button className="chat-profile-inline" onClick={()=>chatPartner&&router.push("/community/profile/"+chatPartner.id)} disabled={!chatPartner}><Avatar person={chatPartner}/><span><b>{currentChat.kind==="group"?currentChat.title:chatPartner?.display_name}</b><small>{currentChat.kind==="group"?`${currentChat.members.length} members · ${totalMessageCount} messages`:`${totalMessageCount} messages · View profile`}</small></span></button></div><div ref={messageListRef} className="message-list">{messages.map(message=>{const readers=(messageReads[message.id]??[]).filter(receipt=>receipt.profile_id!==me.id).length;const attachmentUrl=attachmentUrls[message.id];return <div className={`message-bubble ${message.sender_id===me.id?"mine":""}`} key={message.id}><small><button className="message-sender-profile" onClick={()=>router.push("/community/profile/"+message.sender_id)}>{message.sender_id===me.id?"You":otherPerson(message.sender_id)?.display_name??"Friend"}</button></small><p>{message.body}</p>{message.attachment_path&&attachmentUrl&&<div className="message-attachment">{message.message_kind==="image"?<a href={attachmentUrl} target="_blank" rel="noreferrer"><img src={attachmentUrl} alt={message.attachment_name??"Chat image"}/></a>:message.message_kind==="video"?<video controls preload="metadata" src={attachmentUrl}/>:message.message_kind==="voice"?<audio controls preload="metadata" src={attachmentUrl}/>:<a className="document-attachment" href={attachmentUrl} target="_blank" rel="noreferrer" download={message.attachment_name}><FiFileText/>{message.attachment_name}</a>}</div>}<div className="message-meta"><time>{new Date(message.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time>{message.sender_id===me.id&&<span className={readers?"receipt-seen":"receipt-sent"} title={readers?currentChat.kind==="group"?`Seen by ${readers} members`:"Read":"Sent"} aria-label={readers?"Read":"Sent"}>{readers?<IoCheckmarkDone/>:<FiCheck/>}{currentChat.kind==="group"&&readers?` ${readers}`:""}</span>}</div></div>;})}</div><form className="message-form" onSubmit={e=>void sendMessage(e)}>{pendingAttachment&&<div className="attachment-pending"><span>{pendingAttachment.kind==="image"?<FiImage/>:pendingAttachment.kind==="video"?<FiVideo/>:pendingAttachment.kind==="voice"?<FiMic/>:<FiFileText/>} {pendingAttachment.file.name}</span><button type="button" aria-label="Remove attachment" onClick={()=>setPendingAttachment(null)}><FiX/></button></div>}{emojiOpen&&<div className="emoji-picker" aria-label="Emoji picker">{["😀","😂","🥰","😍","😊","😉","🙌","👏","👍","❤️","🔥","🎉","🙏","😢","🤝","📍","👋","💯","🤔","🥳"].map(emoji=><button type="button" key={emoji} onClick={()=>{setDraftMessage(current=>current+emoji);setEmojiOpen(false);}}>{emoji}</button>)}</div>}<div className="message-compose-row"><label className="chat-tool-button" title="Attach image, video or document"><FiPlus/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={e=>{selectAttachment(e.currentTarget.files?.[0]);e.currentTarget.value=""}}/></label><button type="button" className="chat-tool-button" aria-label="Emoji" aria-expanded={emojiOpen} onClick={()=>setEmojiOpen(value=>!value)}><FiSmile/></button><button type="button" className={`chat-tool-button voice-button${recording?" recording":""}`} aria-label={recording?"Stop voice note recording":"Record voice note"} onClick={()=>void toggleVoiceRecording()}>{recording?<FiX/>:<FiMic/>}</button><input className="message-text-input" value={draftMessage} onChange={e=>setDraftMessage(e.target.value)} onFocus={e=>{const input=e.currentTarget;window.setTimeout(()=>input.scrollIntoView({block:"nearest",behavior:"smooth"}),250);}} placeholder={recording?"Recording voice note…":"Write a message…"} maxLength={4000} enterKeyHint="send"/><button className="primary" disabled={(!draftMessage.trim()&&!pendingAttachment)||busy}>{busy?"Sending…":"Send"}</button></div></form></>:<div className="social-empty">{conversationId?"Loading conversation…":"Choose a conversation to open it here."}</div>}</section></div>}
        {tab === "profile" && <><form className="social-card profile-editor" onSubmit={e=>void saveProfile(e)}><div className="avatar-editor"><Avatar person={me} large/><label className="secondary upload-button">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadAvatar(e.currentTarget.files?.[0])}/></label><small>JPG, PNG or WebP · up to 5 MB</small></div><label className="field">Display name<input required minLength={2} maxLength={48} value={profileDraft.display_name} onChange={e=>setProfileDraft({...profileDraft,display_name:e.target.value})}/></label><label className="field">Department<input maxLength={80} value={profileDraft.department} onChange={e=>setProfileDraft({...profileDraft,department:e.target.value})}/></label><label className="field">Year of study<select value={profileDraft.year} onChange={e=>setProfileDraft({...profileDraft,year:e.target.value})}><option value="">Choose year</option>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label className="field">About you<textarea maxLength={280} value={profileDraft.bio} onChange={e=>setProfileDraft({...profileDraft,bio:e.target.value})} placeholder="A little about yourself…"/></label><button className="primary" disabled={busy}>Save profile</button></form><section className="social-card profile-editor referral-card"><h3>Invite classmates</h3><p>Your referrals are recorded as a private chain. There are no rewards for referrals at this time.</p><div className="referral-link-row"><code>{me.referral_code?`/?ref=${me.referral_code}`:"Referral link unavailable"}</code><button className="secondary compact" onClick={()=>void copyReferralLink()}>Copy link</button></div><p><b>{referralNetwork.length}</b> people in your referral network · direct and downstream referrals</p>{referralNetwork.slice(0,20).map(person=><div className="referral-person" key={person.profile_id}><span className="referral-depth">L{person.depth}</span><span>{person.display_name}</span><small>{new Date(person.joined_at).toLocaleDateString()}</small></div>)}</section></>}
      </div>
    </>}
    {standalone&&!conversationId&&<nav className="community-bottom-nav" aria-label="Community navigation"><Link className={tab==="feed"?"active":""} href="/community/feed"><FiHome/><span>Feed</span></Link><Link className={tab==="friends"?"active":""} href="/community/friends"><span className="bottom-nav-icon"><FiUsers/>{pendingIn.length>0&&<i>{pendingIn.length>99?"99+":pendingIn.length}</i>}</span><span>Friends</span></Link><Link className={tab==="messages"?"active":""} href="/community/messages"><span className="bottom-nav-icon"><FiMessageCircle/>{unreadTotal>0&&<i>{unreadTotal>99?"99+":unreadTotal}</i>}</span><span>Chats</span></Link><Link className={tab==="profile"?"active":""} href="/community/profile"><FiUser/><span>Profile</span></Link></nav>}
    {reportTarget&&<div className="report-backdrop"><form className="report-dialog panel" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={e=>void submitReport(e)}><div className="eyebrow">Community safety</div><h2 id="report-title">Report this post</h2><p>Reports are reviewed by the FUTO Life admin team. The author won’t see who submitted a report.</p><label className="field">Reason<select value={reportReason} onChange={e=>setReportReason(e.target.value as ReportReason)}><option value="spam">Spam</option><option value="harassment">Harassment or bullying</option><option value="hate_or_abuse">Hate or abuse</option><option value="sexual_content">Sexual content</option><option value="violence">Violence or threats</option><option value="false_information">False information</option><option value="other">Other</option></select></label><label className="field">More details (optional)<textarea maxLength={1000} value={reportDetails} onChange={e=>setReportDetails(e.target.value)} placeholder="Add context to help the admin review"/></label><div className="confirm-actions"><button type="button" className="secondary" onClick={()=>setReportTarget(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?"Sending…":"Send report"}</button></div></form></div>}
  </section></div>;
}

function Avatar({person,small=false,large=false}:{person:Person|null|undefined;small?:boolean;large?:boolean}) {
  return <span className={`social-avatar${small?" small":""}${large?" large":""}`}>{person?.avatar_url?<img src={person.avatar_url} alt=""/>:person?.display_name?.slice(0,1).toUpperCase()??"F"}</span>;
}

function StudentProfileCard({person,onMessage}:{person:Person;onMessage:()=>void}){
  return <main className="student-profile-card"><Avatar person={person} large/><h1>{person.display_name}</h1><p className="student-profile-meta">{[person.department,person.year_of_study?`Year ${person.year_of_study}`:null].filter(Boolean).join(" · ")||"FUTO student"}</p>{person.bio&&<p className="student-profile-bio">{person.bio}</p>}<button className="primary" onClick={onMessage}><FiMessageCircle/> Message</button></main>;
}

function renderPostBody(body:string){
  return body.split(/(#[\p{L}\p{N}_]{1,32})/gu).map((part,index)=>part.startsWith("#")?<span className="post-hashtag" key={`${part}-${index}`}>{part}</span>:part);
}
