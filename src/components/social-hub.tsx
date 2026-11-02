"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

type Person = { id: string; display_name: string; department: string | null; year_of_study: number | null; avatar_url: string | null; bio?: string | null; referral_code?: string; is_suspended?: boolean };
type Friendship = { id: string; requester_id: string; addressee_id: string; status: string; created_at: string };
type Post = { id: string; author_id: string; body: string; created_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type Chat = { id: string; kind: "direct" | "group"; title: string | null; created_at: string; members: Person[]; lastMessage?: Message };
type ReferralRow = {profile_id:string;display_name:string;depth:number;joined_at:string};
type ReportReason = "spam"|"harassment"|"hate_or_abuse"|"sexual_content"|"violence"|"false_information"|"other";

export default function SocialHub({ onClose = () => {}, onSignIn, onProfileChange = () => {}, standalone = false }: { onClose?: () => void; onSignIn?: () => void; onProfileChange?: (profile: Person) => void; standalone?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, { id: string; post_id: string; author_id: string; body: string; created_at: string }[]>>({});
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [myReportedPosts,setMyReportedPosts] = useState<string[]>([]);
  const [reportTarget,setReportTarget] = useState<Post|null>(null);
  const [reportReason,setReportReason] = useState<ReportReason>("spam");
  const [reportDetails,setReportDetails] = useState("");
  const [referralNetwork,setReferralNetwork] = useState<ReferralRow[]>([]);
  const [tab, setTab] = useState<"feed" | "friends" | "messages" | "profile">("feed");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftPost, setDraftPost] = useState("");
  const postInputRef=useRef<HTMLTextAreaElement>(null);
  const messageListRef=useRef<HTMLDivElement>(null);
  const socialWindowRef=useRef<HTMLElement>(null);
  const [mentionQuery,setMentionQuery]=useState<string|null>(null);
  const [mentionStart,setMentionStart]=useState<number|null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [profileDraft, setProfileDraft] = useState({ display_name: "", department: "", year: "", bio: "" });

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNotice("Sign in to connect with FUTO students."); return; }
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
    if (!conversationIds.length) { setChats([]); return; }
    const [conversationResult, memberships] = await Promise.all([
      supabase.from("conversations").select("id,kind,title,created_at").in("id", conversationIds).order("created_at", { ascending: false }),
      supabase.from("conversation_members").select("conversation_id,profile_id").in("conversation_id", conversationIds),
    ]);
    const memberRows = (memberships.data ?? []) as {conversation_id:string;profile_id:string}[];
    const profileMap = new Map<string,Person>([...(peopleResult.data ?? []) as Person[], ...(profileResult.data ? [profileResult.data as Person] : [])].map(p => [p.id,p]));
    const conversationRows = (conversationResult.data ?? []) as Omit<Chat,"members"|"lastMessage">[];
    const messageResult = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(conversationIds.length * 3);
    const messageRows = (messageResult.data ?? []) as Message[];
    setChats(conversationRows.map((chat) => ({ ...chat, members: memberRows.filter(m => m.conversation_id === chat.id).map(m => profileMap.get(m.profile_id)).filter((p): p is Person => Boolean(p)), lastMessage: messageRows.find(m => m.conversation_id === chat.id) })));
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!supabase || !activeChat) return;
    const refresh = async () => {
      const { data } = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id", activeChat).order("created_at").limit(300);
      setMessages((data ?? []) as Message[]);
    };
    void refresh();
    const channel = supabase.channel(`messages-${activeChat}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeChat}` }, (payload) => {
      const incoming = payload.new as Message;
      setMessages((current) => current.some((m) => m.id === incoming.id) ? current : [...current, incoming]);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeChat, supabase]);

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
    if (!supabase) return;
    const { error } = await supabase.from("friendships").update({ status }).eq("id", request.id);
    if (error) setNotice(error.message); else await load();
  }
  async function removeFriend(id: string) {
    if (!supabase) return;
    const relation = friendships.find((f) => f.status === "accepted" && [f.requester_id,f.addressee_id].includes(id));
    if (!relation) return;
    const { error } = await supabase.from("friendships").delete().eq("id", relation.id);
    if (error) setNotice(error.message); else { setNotice("Friend removed."); await load(); }
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
    if (error) setNotice(error.message); else { setDraftPost(""); await load(); }
    setBusy(false);
  }
  async function likePost(post: Post) {
    if (!supabase || !me) return;
    const mine = (likes[post.id] ?? []).includes(me.id);
    const query = mine ? supabase.from("post_reactions").delete().eq("post_id",post.id).eq("profile_id",me.id) : supabase.from("post_reactions").insert({post_id:post.id,profile_id:me.id});
    const { error } = await query; if (error) setNotice(error.message); else await load();
  }
  async function addComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault(); if (!supabase || !me) return;
    const form = event.currentTarget; const input = new FormData(form).get("comment"); if (typeof input !== "string" || !input.trim()) return;
    const { error } = await supabase.from("post_comments").insert({post_id:postId,author_id:me.id,body:input.trim()});
    if (error) setNotice(error.message); else { form.reset(); await load(); }
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
    await load(); setTab("messages"); setActiveChat(data as string);
  }
  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement); const title = String(form.get("groupTitle") ?? "");
    const ids = form.getAll("groupFriend").map(String);
    const { data, error } = await supabase.rpc("create_group_conversation", { group_title: title, friend_ids: ids });
    if (error) setNotice(error.message); else { formElement.reset(); await load(); setActiveChat(data as string); setNotice("Group chat created."); }
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault(); if (!supabase || !me || !activeChat || !draftMessage.trim()) return;
    const { error } = await supabase.from("messages").insert({conversation_id:activeChat,sender_id:me.id,body:draftMessage.trim()});
    if (error) setNotice(error.message); else { setDraftMessage(""); const {data} = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id",activeChat).order("created_at").limit(300); setMessages((data ?? []) as Message[]); }
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

  return <div className={`social-backdrop${standalone?" social-standalone":""}`} onMouseDown={e => {if(!standalone&&e.target===e.currentTarget)onClose();}}><section ref={socialWindowRef} className={`social-window panel${standalone?" social-page-window":""}`} role={standalone?"main":"dialog"} aria-modal={standalone?undefined:true} aria-label="FUTO Life social">
    <header className="social-header"><div className="social-brand"><div className="eyebrow">FUTO LIFE · COMMUNITY</div><h2>Connect on campus</h2></div>{standalone?<Link className="secondary social-close-link" href="/explore">← Campus</Link>:<button className="secondary social-close" onClick={onClose} aria-label="Close social">×</button>}</header>
    {!me ? <div className="social-empty">{notice || "Sign in and complete your profile to use the student community."}<br/>{standalone?<Link className="primary social-signin" href="/explore?auth=signin&next=%2Fcommunity">Sign in / create account</Link>:<button className="primary social-signin" onClick={onSignIn}>Sign in / create account</button>}</div> : <>
      <nav className="social-tabs">{(["feed","friends","messages","profile"] as const).map(item => <button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item === "feed" ? "Feed" : item === "friends" ? `Friends${friends.length?` · ${friends.length}`:""}` : item === "messages" ? "Messages" : "My profile"}</button>)}</nav>
      {notice && <p className="social-notice" role="status">{notice}</p>}
      <div className={`social-content${tab==="messages"?" messages-content":""}`}>
        {tab === "feed" && <div className="feed-column">
          <form className="post-composer social-card" onSubmit={publishPost}><div className="composer-row"><Avatar person={me}/><div className="composer-input-wrap"><textarea ref={postInputRef} value={draftPost} onChange={e=>onPostDraftChange(e.target.value,e.target.selectionStart)} onClick={e=>onPostDraftChange(e.currentTarget.value,e.currentTarget.selectionStart)} maxLength={2000} placeholder="Share something with your FUTO friends…" aria-label="Write a post"/>{mentionSuggestions.length>0&&<div className="mention-suggestions" role="listbox" aria-label="Mention a friend">{mentionSuggestions.map(friend=><button type="button" key={friend.id} role="option" onMouseDown={e=>e.preventDefault()} onClick={()=>insertMention(friend)}><Avatar person={friend} small/><span><b>{friend.display_name}</b><small>{friend.department??"FUTO student"}</small></span></button>)}</div>}</div></div><div className="composer-footer"><span className="composer-hint">Type <b>@</b> to mention friends · add <b>#hashtags</b> to label your post</span><button className="primary" disabled={busy||!draftPost.trim()}>{busy?"Posting…":"Post"}</button></div></form>
          {posts.map(post=>{const author=otherPerson(post.author_id); const postComments=comments[post.id]??[]; return <article className="social-card feed-post" key={post.id}><div className="post-author"><Avatar person={author}/><div><strong>{author?.display_name??"FUTO student"}</strong><small>{author?.department??"FUTO Life"} · {new Date(post.created_at).toLocaleString()}</small></div></div><p className="post-body">{renderPostBody(post.body)}</p>{(tags[post.id]?.length??0)>0&&<div className="post-tags">with {(tags[post.id]??[]).map(id=>otherPerson(id)?.display_name).filter(Boolean).join(", ")}</div>}<div className="post-actions"><button onClick={()=>void likePost(post)}>{(likes[post.id]??[]).includes(me.id)?"♥":"♡"} {(likes[post.id]??[]).length} · Like</button><span>▢ {postComments.length} comments</span>{post.author_id!==me.id&&(myReportedPosts.includes(post.id)?<span className="reported-label">Reported</span>:<button onClick={()=>{setReportTarget(post);setReportReason("spam");setReportDetails("");}}>Report</button>)}</div><div className="comment-list">{postComments.map(comment=><p key={comment.id}><b>{otherPerson(comment.author_id)?.display_name??"Student"}</b> {comment.body}</p>)}</div><form className="comment-form" onSubmit={e=>void addComment(e,post.id)}><Avatar person={me} small/><input name="comment" maxLength={1000} placeholder="Write a comment…" aria-label="Write a comment"/><button aria-label="Send comment">↗</button></form></article>;})}
          {!posts.length&&<div className="social-card social-empty">No posts yet. Share a hello to start the FUTO community feed.</div>}
        </div>}
        {tab === "friends" && <div className="friends-layout"><div className="social-card requests-card"><h3>Friend requests <span>{pendingIn.length}</span></h3>{pendingIn.length?pendingIn.map(request=>{const person=otherPerson(request.requester_id);return <div className="person-row" key={request.id}><Avatar person={person}/><div className="person-info"><b>{person?.display_name??"FUTO student"}</b><small>{person?.department??""}</small></div><button className="primary compact" onClick={()=>void respond(request,"accepted")}>Accept</button><button className="secondary compact" onClick={()=>void respond(request,"declined")}>Decline</button></div>;}):<p className="muted">No pending requests.</p>}{pendingOut.length>0&&<p className="muted">{pendingOut.length} request{pendingOut.length===1?"":"s"} awaiting a reply.</p>}</div><div className="social-card people-card"><h3>Find students</h3><input className="social-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or department…"/>{filteredPeople.filter(p=>!accepted.includes(p.id)).slice(0,100).map(person=>{const sent=pendingOut.some(r=>r.addressee_id===person.id);return <div className="person-row" key={person.id}><Avatar person={person}/><div className="person-info"><b>{person.display_name}</b><small>{[person.department,person.year_of_study?`Year ${person.year_of_study}`:""].filter(Boolean).join(" · ")}</small></div>{sent?<span className="pending-label">Requested</span>:<button className="secondary compact" disabled={busy} onClick={()=>void sendRequest(person)}>＋ Add friend</button>}</div>;})}</div><div className="social-card people-card"><h3>Your friends <span>{friends.length}</span></h3>{friends.length?friends.map(person=><div className="person-row" key={person.id}><Avatar person={person}/><div className="person-info"><b>{person.display_name}</b><small>{person.department??"FUTO student"}</small></div><button className="secondary compact" onClick={()=>void openDirect(person)}>Message</button><button className="text-action" onClick={()=>void removeFriend(person.id)}>Remove</button></div>):<p className="muted">Accept a request or find classmates above. You need an accepted friendship to chat.</p>}</div></div>}
        {tab === "messages" && <div className="chat-layout"><aside className="chat-sidebar"><form className="group-form" onSubmit={e=>void createGroup(e)}><input name="groupTitle" placeholder="New group name" maxLength={80} required/><details><summary>Choose 2+ friends</summary><div className="group-options">{friends.map(f=><label key={f.id}><input type="checkbox" name="groupFriend" value={f.id}/>{f.display_name}</label>)}</div></details><button className="secondary compact" disabled={friends.length<2}>Create group</button></form>{chats.map(chat=><button className={`chat-row ${activeChat===chat.id?"selected":""}`} key={chat.id} onClick={()=>setActiveChat(chat.id)}><Avatar person={chat.kind==="group"?null:chat.members.find(m=>m.id!==me.id)??null}/><span><b>{chat.kind==="group"?chat.title:chat.members.find(m=>m.id!==me.id)?.display_name??"Direct chat"}</b><small>{chat.lastMessage?.body??(chat.kind==="group"?`${chat.members.length} members`:"Start a conversation")}</small></span></button>)}{!chats.length&&<p className="muted">Your conversations will appear here after you message a friend or create a group.</p>}</aside><section className="chat-main">{currentChat?<><div className="chat-title"><b>{currentChat.kind==="group"?currentChat.title:currentChat.members.find(m=>m.id!==me.id)?.display_name}</b><small>{currentChat.kind==="group"?`${currentChat.members.length} members`:"Friends conversation"}</small></div><div ref={messageListRef} className="message-list">{messages.map(message=><div className={`message-bubble ${message.sender_id===me.id?"mine":""}`} key={message.id}><small>{message.sender_id===me.id?"You":otherPerson(message.sender_id)?.display_name??"Friend"}</small><p>{message.body}</p><time>{new Date(message.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time></div>)}</div><form className="message-form" onSubmit={e=>void sendMessage(e)}><input value={draftMessage} onChange={e=>setDraftMessage(e.target.value)} onFocus={e=>{const input=e.currentTarget;window.setTimeout(()=>input.scrollIntoView({block:"nearest",behavior:"smooth"}),250);}} placeholder="Write a message…" maxLength={4000} enterKeyHint="send"/><button className="primary" disabled={!draftMessage.trim()}>Send</button></form></>:<div className="social-empty">Choose a conversation, or open a friend’s profile and start a chat.</div>}</section></div>}
        {tab === "profile" && <><form className="social-card profile-editor" onSubmit={e=>void saveProfile(e)}><div className="avatar-editor"><Avatar person={me} large/><label className="secondary upload-button">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadAvatar(e.currentTarget.files?.[0])}/></label><small>JPG, PNG or WebP · up to 5 MB</small></div><label className="field">Display name<input required minLength={2} maxLength={48} value={profileDraft.display_name} onChange={e=>setProfileDraft({...profileDraft,display_name:e.target.value})}/></label><label className="field">Department<input maxLength={80} value={profileDraft.department} onChange={e=>setProfileDraft({...profileDraft,department:e.target.value})}/></label><label className="field">Year of study<select value={profileDraft.year} onChange={e=>setProfileDraft({...profileDraft,year:e.target.value})}><option value="">Choose year</option>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label className="field">About you<textarea maxLength={280} value={profileDraft.bio} onChange={e=>setProfileDraft({...profileDraft,bio:e.target.value})} placeholder="A little about yourself…"/></label><button className="primary" disabled={busy}>Save profile</button></form><section className="social-card profile-editor referral-card"><h3>Invite classmates</h3><p>Your referrals are recorded as a private chain. There are no rewards for referrals at this time.</p><div className="referral-link-row"><code>{me.referral_code?`/?ref=${me.referral_code}`:"Referral link unavailable"}</code><button className="secondary compact" onClick={()=>void copyReferralLink()}>Copy link</button></div><p><b>{referralNetwork.length}</b> people in your referral network · direct and downstream referrals</p>{referralNetwork.slice(0,20).map(person=><div className="referral-person" key={person.profile_id}><span className="referral-depth">L{person.depth}</span><span>{person.display_name}</span><small>{new Date(person.joined_at).toLocaleDateString()}</small></div>)}</section></>}
      </div>
    </>}
    {reportTarget&&<div className="report-backdrop"><form className="report-dialog panel" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={e=>void submitReport(e)}><div className="eyebrow">Community safety</div><h2 id="report-title">Report this post</h2><p>Reports are reviewed by the FUTO Life admin team. The author won’t see who submitted a report.</p><label className="field">Reason<select value={reportReason} onChange={e=>setReportReason(e.target.value as ReportReason)}><option value="spam">Spam</option><option value="harassment">Harassment or bullying</option><option value="hate_or_abuse">Hate or abuse</option><option value="sexual_content">Sexual content</option><option value="violence">Violence or threats</option><option value="false_information">False information</option><option value="other">Other</option></select></label><label className="field">More details (optional)<textarea maxLength={1000} value={reportDetails} onChange={e=>setReportDetails(e.target.value)} placeholder="Add context to help the admin review"/></label><div className="confirm-actions"><button type="button" className="secondary" onClick={()=>setReportTarget(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?"Sending…":"Send report"}</button></div></form></div>}
  </section></div>;
}

function Avatar({person,small=false,large=false}:{person:Person|null|undefined;small?:boolean;large?:boolean}) {
  return <span className={`social-avatar${small?" small":""}${large?" large":""}`}>{person?.avatar_url?<img src={person.avatar_url} alt=""/>:person?.display_name?.slice(0,1).toUpperCase()??"F"}</span>;
}

function renderPostBody(body:string){
  return body.split(/(#[\p{L}\p{N}_]{1,32})/gu).map((part,index)=>part.startsWith("#")?<span className="post-hashtag" key={`${part}-${index}`}>{part}</span>:part);
}
