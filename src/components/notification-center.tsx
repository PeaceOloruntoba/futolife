"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiBell, FiCheck, FiMessageCircle, FiUserPlus } from "react-icons/fi";
import { createClient } from "@/lib/supabase/browser";
import { useAuthSession } from "@/components/auth-session-provider";
import { notify } from "@/lib/notify";

type NotificationRow = { id:string;actor_name:string;notification_type:"friend_request"|"friend_accepted"|"message";title:string;summary:string;target_path:string;created_at:string;read_at:string|null };

export function NotificationCenter({ dock = false }: { dock?: boolean }) {
  const supabase=useMemo(()=>createClient(),[]);
  const { status,userId }=useAuthSession();
  const router=useRouter();
  const [items,setItems]=useState<NotificationRow[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [browserPermission,setBrowserPermission]=useState<NotificationPermission|"unsupported">("default");
  const [browserNotificationsEnabled,setBrowserNotificationsEnabled]=useState(false);
  const preferenceKey=userId?`futolife:web-notifications:${userId}`:null;

  useEffect(()=>{
    if(typeof window==="undefined")return;
    setBrowserPermission("Notification" in window?window.Notification.permission:"unsupported");
    setBrowserNotificationsEnabled(Boolean(preferenceKey&&window.localStorage.getItem(preferenceKey)==="enabled"));
  },[preferenceKey]);

  const load=useCallback(async()=>{
    if(!supabase||!userId)return;
    setLoading(true);
    const [listResult,countResult]=await Promise.all([
      supabase.from("notifications").select("id,actor_name,notification_type,title,summary,target_path,created_at,read_at").order("created_at",{ascending:false}).limit(40),
      supabase.from("notifications").select("id",{count:"exact",head:true}).is("read_at",null),
    ]);
    if(listResult.error)notify(`Notifications could not load: ${listResult.error.message}`);
    else setItems((listResult.data??[]) as NotificationRow[]);
    setUnreadCount(countResult.count??0);
    setLoading(false);
  },[supabase,userId]);

  useEffect(()=>{
    if(status!=="signed-in"||!userId||!supabase)return;
    void load();
    const channel=supabase.channel(`notifications-${userId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`recipient_id=eq.${userId}`},payload=>{
      const row=payload.new as NotificationRow;
      setItems(current=>[row,...current.filter(item=>item.id!==row.id)].slice(0,40));
      setUnreadCount(value=>value+1);
      if(document.visibilityState==="hidden"&&preferenceKey&&window.localStorage.getItem(preferenceKey)==="enabled"&&"Notification" in window&&window.Notification.permission==="granted"){
        const target=row.target_path.startsWith("/community/")&&!row.target_path.startsWith("//")?row.target_path:"/community";
        const options:NotificationOptions={body:row.summary||row.title,tag:row.id,icon:"/futo-notification.svg",badge:"/futo-notification.svg",data:{target}};
        const showFallback=()=>{const notification=new window.Notification(row.title,options);notification.onclick=()=>{window.focus();router.push(target);notification.close();};};
        if("serviceWorker" in navigator)void navigator.serviceWorker.getRegistration().then(registration=>registration?registration.showNotification(row.title,options):showFallback()).catch(showFallback);
        else showFallback();
      }else notify(row.summary||row.title);
    }).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[load,preferenceKey,router,status,supabase,userId]);

  useEffect(()=>{
    if(!open)return;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    window.addEventListener("keydown",close);
    return()=>window.removeEventListener("keydown",close);
  },[open]);

  if(status!=="signed-in")return null;

  async function enableBrowserNotifications(){
    if(typeof window==="undefined"||!preferenceKey)return;
    if(!("Notification" in window)){setBrowserPermission("unsupported");return;}
    try{
      const permission=await window.Notification.requestPermission();
      setBrowserPermission(permission);
      if(permission!=="granted"){setBrowserNotificationsEnabled(false);notify(permission==="denied"?"Browser notifications are blocked. Allow them in your browser’s site settings.":"Browser notifications were not enabled.");return;}
      if("serviceWorker" in navigator){try{await navigator.serviceWorker.register("/notifications-sw.js");}catch{/* Browser Notification remains available without a service worker. */}}
      window.localStorage.setItem(preferenceKey,"enabled");
      setBrowserNotificationsEnabled(true);
      notify("Browser notifications are enabled on this device.");
    }catch{notify("Could not enable browser notifications in this browser.");}
  }

  async function openNotification(item:NotificationRow){
    if(!supabase)return;
    if(!item.read_at){
      const readAt=new Date().toISOString();
      setItems(current=>current.map(row=>row.id===item.id?{...row,read_at:readAt}:row));
      setUnreadCount(count=>Math.max(0,count-1));
      await supabase.from("notifications").update({read_at:readAt}).eq("id",item.id);
    }
    setOpen(false);
    const target=item.target_path.startsWith("/community/")&&!item.target_path.startsWith("//")?item.target_path:"/community";
    router.push(target);
  }

  async function markAllRead(){
    if(!supabase||!userId||!unreadCount)return;
    const readAt=new Date().toISOString();
    setItems(current=>current.map(item=>item.read_at?item:{...item,read_at:readAt}));
    setUnreadCount(0);
    const {error}=await supabase.from("notifications").update({read_at:readAt}).eq("recipient_id",userId).is("read_at",null);
    if(error)notify(`Could not update notifications: ${error.message}`);
  }

  return <div className={`notification-root${dock?" notification-root-dock":""}`}>
    <button className={dock?"dock-action notification-dock-button":"notification-trigger"} onClick={()=>{setOpen(value=>!value);if(!open)void load();}} aria-expanded={open} aria-label={`Notifications${unreadCount?`, ${unreadCount} unread`:""}`}>
      <span className="notification-trigger-icon"><FiBell/>{unreadCount>0&&<i>{unreadCount>99?"99+":unreadCount}</i>}</span>
      {dock?<><span><b>Notifications</b><small>{unreadCount?`${unreadCount} unread`:`${items.length} recent`}</small></span><span className="dock-arrow">›</span></>:<span className="notification-trigger-label">Notifications</span>}
    </button>
    {open&&<section className={`notification-panel${dock?" notification-panel-dock":""}`} aria-label="Notifications">
      <header className="notification-panel-head"><div><b>Notifications</b><small>{unreadCount?`${unreadCount} unread`:"You’re all caught up"}</small></div><div>{unreadCount>0&&<button onClick={()=>void markAllRead()} aria-label="Mark all notifications as read"><FiCheck/></button>}<button onClick={()=>setOpen(false)} aria-label="Close notifications">×</button></div></header>
      <div className="browser-notification-setting">{browserPermission==="unsupported"?<small>Browser alerts aren’t supported here.</small>:browserNotificationsEnabled&&browserPermission==="granted"?<small className="browser-notification-enabled"><FiCheck/> Browser alerts enabled on this device</small>:browserPermission==="denied"?<small>Browser alerts are blocked. Change the site permission in your browser settings.</small>:<><span><b>Get browser alerts</b><small>Messages and friend requests while FUTO Life is in the background</small></span><button onClick={()=>void enableBrowserNotifications()}>Enable</button></>}</div>
      <div className="notification-list">{loading&&!items.length?<p className="notification-empty">Loading notifications…</p>:items.map(item=><button key={item.id} className={`notification-item${item.read_at?"":" unread"}`} onClick={()=>void openNotification(item)}><span className="notification-item-icon">{item.notification_type==="message"?<FiMessageCircle/>:<FiUserPlus/>}</span><span className="notification-item-copy"><b>{item.title}</b><small>{item.summary}</small><time>{new Date(item.created_at).toLocaleString()}</time></span>{!item.read_at&&<i className="notification-unread-dot"/>}</button>)}{!loading&&!items.length&&<p className="notification-empty">New messages and friend requests will show up here.</p>}</div>
    </section>}
  </div>;
}
