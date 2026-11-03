"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";
import { notify } from "@/lib/notify";
import { NotificationCenter } from "@/components/notification-center";

type Place = { id: string; name: string; category: string; description: string | null; position_status: "verified" | "provisional" | "unverified"; latitude: number | null; longitude: number | null; local_x: number | null; local_z: number | null; evidence: unknown; image_url: string | null };
type Draft = Omit<Place,"evidence"> & { evidenceText: string };
type ConfirmAction = { title: string; body: string; label: string; reason?: boolean; run: (reason: string) => Promise<void> };
type AdminUser = { id:string;display_name:string;department:string|null;year_of_study:number|null;avatar_url:string|null;is_suspended:boolean;suspension_reason:string|null;suspended_at:string|null;created_at:string;referral_code:string };
type PostReport = {id:string;post_id:string|null;post_key:string;post_author_id:string|null;post_snapshot:string;reporter_id:string|null;reason:string;details:string|null;status:string;created_at:string};
type AdminPost = {id:string;author_id:string;body:string;created_at:string};
type ReferralEdge = {id:string;referrer_id:string;referred_id:string;created_at:string};
type ActivityRow={id:number;actor_id:string|null;actor_email:string|null;action:string;entity_type:string|null;entity_id:string|null;metadata:Record<string,unknown>;created_at:string};
const EMPTY: Draft = { id:"",name:"",category:"landmark",description:"",position_status:"unverified",latitude:null,longitude:null,local_x:null,local_z:null,evidenceText:"",image_url:null };

export default function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [places,setPlaces] = useState<Place[]>([]);
  const [draft,setDraft] = useState<Draft>(EMPTY);
  const [search,setSearch] = useState("");
  const [busy,setBusy] = useState(false);
  const [dataLoading,setDataLoading] = useState(true);
  const [message,setMessage] = useState("");
  const [importSummary,setImportSummary] = useState("");
  const [savedId,setSavedId] = useState<string|null>(null);
  const [confirmation,setConfirmation] = useState<ConfirmAction|null>(null);
  const [confirmationReason,setConfirmationReason] = useState("");
  const [section,setSection] = useState<"places"|"users"|"posts"|"referrals"|"activity">("places");
  const [users,setUsers] = useState<AdminUser[]>([]);
  const [userSearch,setUserSearch] = useState("");
  const [reports,setReports] = useState<PostReport[]>([]);
  const [allPosts,setAllPosts] = useState<AdminPost[]>([]);
  const [referrals,setReferrals] = useState<ReferralEdge[]>([]);
  const [activityLogs,setActivityLogs] = useState<ActivityRow[]>([]);

  useEffect(()=>{if(message){notify(message);setMessage("");}},[message]);
  useEffect(()=>{if(importSummary){notify(importSummary);setImportSummary("");}},[importSummary]);

  const load = useCallback(async () => {
    if (!supabase) return;
    const {data,error} = await supabase.from("campus_locations").select("id,name,category,description,position_status,latitude,longitude,local_x,local_z,evidence,image_url").order("name");
    if (error) setMessage(`Could not load campus data: ${error.message}`);
    else setPlaces((data??[]) as Place[]);
  },[supabase]);
  useEffect(()=>{void load();},[load]);

  const loadUsers=useCallback(async()=>{if(!supabase)return;const {data,error}=await supabase.from("profiles").select("id,display_name,department,year_of_study,avatar_url,is_suspended,suspension_reason,suspended_at,created_at,referral_code").order("created_at",{ascending:false});if(error)setMessage(`Could not load users: ${error.message}`);else setUsers((data??[]) as AdminUser[]);},[supabase]);
  const loadReports=useCallback(async()=>{if(!supabase)return;const {data,error}=await supabase.from("post_reports").select("id,post_id,post_key,post_author_id,post_snapshot,reporter_id,reason,details,status,created_at").order("created_at",{ascending:false});if(error)setMessage(`Could not load post reports: ${error.message}`);else setReports((data??[]) as PostReport[]);},[supabase]);
  const loadPosts=useCallback(async()=>{if(!supabase)return;const {data,error}=await supabase.from("posts").select("id,author_id,body,created_at").order("created_at",{ascending:false}).limit(500);if(error)setMessage(`Could not load posts: ${error.message}`);else setAllPosts((data??[]) as AdminPost[]);},[supabase]);
  const loadReferrals=useCallback(async()=>{if(!supabase)return;const {data,error}=await supabase.from("referrals").select("id,referrer_id,referred_id,created_at").order("created_at",{ascending:false});if(error)setMessage(`Could not load referrals: ${error.message}`);else setReferrals((data??[]) as ReferralEdge[]);},[supabase]);
  const loadActivity=useCallback(async()=>{if(!supabase)return;const {data,error}=await supabase.from("activity_logs").select("id,actor_id,actor_email,action,entity_type,entity_id,metadata,created_at").order("created_at",{ascending:false}).limit(500);if(error)setMessage(`Could not load activity log: ${error.message}`);else setActivityLogs((data??[]) as ActivityRow[]);},[supabase]);
  useEffect(()=>{void Promise.all([loadUsers(),loadReports(),loadPosts(),loadReferrals(),loadActivity()]).finally(()=>setDataLoading(false));},[loadUsers,loadReports,loadPosts,loadReferrals,loadActivity]);
  useEffect(()=>{if(section==="activity"&&supabase)void supabase.rpc("record_user_activity",{p_action:"admin.activity_log.viewed"}).then(()=>void loadActivity());},[loadActivity,section,supabase]);

  const filtered = places.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers=users.filter(u=>`${u.display_name} ${u.department??""} ${u.id}`.toLowerCase().includes(userSearch.toLowerCase()));
  const userById=new Map(users.map(user=>[user.id,user]));
  const groupedReports=Array.from(reports.reduce((groups,report)=>{const key=report.post_key;const group=groups.get(key)??{postId:report.post_id,body:report.post_snapshot,authorId:report.post_author_id,reports:[] as PostReport[]};group.reports.push(report);groups.set(key,group);return groups;},new Map<string,{postId:string|null;body:string;authorId:string|null;reports:PostReport[]}>()).values());
  function edgeDepth(edge:ReferralEdge){let depth=1;let current=edge.referrer_id;const visited=new Set<string>();while(!visited.has(current)){visited.add(current);const parent=referrals.find(item=>item.referred_id===current);if(!parent)break;depth+=1;current=parent.referrer_id;}return depth;}
  function formatEvidence(value:unknown):string {
    if(Array.isArray(value))return value.map(item=>{const row=asRecord(item)??{};return `${String(row.type??"admin_note")} | ${String(row.url??row.note??JSON.stringify(row))}`;}).join("\n");
    const record=asRecord(value);if(!record)return "";
    const lines:string[]=[];if(typeof record.verification==="string")lines.push(`verification | ${record.verification}`);
    if(Array.isArray(record.references))for(const ref of record.references){const row=asRecord(ref)??{};lines.push(`${String(row.type??"reference")} | ${JSON.stringify(row)}`);}
    for(const [key,item] of Object.entries(record))if(key!=="verification"&&key!=="references")lines.push(`${key} | ${typeof item==="string"?item:JSON.stringify(item)}`);
    return lines.join("\n");
  }
  function edit(place: Place) {
    setSavedId(place.id);
    setDraft({id:place.id,name:place.name,category:place.category,description:place.description??"",position_status:place.position_status,latitude:place.latitude,longitude:place.longitude,local_x:place.local_x,local_z:place.local_z,image_url:place.image_url??null,evidenceText:formatEvidence(place.evidence)});
    setMessage("");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function clearDraft(){setSavedId(null);setDraft(EMPTY);setMessage("");}
  function draftId(name:string){return name.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,72);}
  function parseEvidence(text:string){return text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const split=line.indexOf(" | ");return split>0?{type:line.slice(0,split).trim(),note:line.slice(split+3).trim()}:{type:/^https?:\/\//i.test(line)?"official_source":"admin_note",...(/^https?:\/\//i.test(line)?{url:line}:{note:line})};});}
  function numeric(value:string){return value.trim()===""?null:Number(value);}
  async function save(event:FormEvent){
    event.preventDefault();if(!supabase)return;
    const id=draft.id.trim()||draftId(draft.name);const evidence=parseEvidence(draft.evidenceText);
    if(!id||!draft.name.trim()||!draft.category.trim()){setMessage("Name, category and a valid place ID are required.");return;}
    if((draft.latitude===null)!==(draft.longitude===null)){setMessage("Enter both latitude and longitude, or leave both blank.");return;}
    if((draft.local_x===null)!==(draft.local_z===null)){setMessage("Enter both local map coordinates, or leave both blank.");return;}
    if(draft.position_status==="verified"&&!evidence.length){setMessage("Add at least one evidence source before marking a place verified.");return;}
    if(draft.position_status==="verified"&&draft.latitude===null&&draft.local_x===null){setMessage("Add verified geographic coordinates or local map coordinates before marking this place verified.");return;}
    if(draft.latitude!==null&&(!Number.isFinite(draft.latitude)||draft.latitude < -90||draft.latitude>90)){setMessage("Latitude must be between −90 and 90.");return;}
    if(draft.longitude!==null&&(!Number.isFinite(draft.longitude)||draft.longitude < -180||draft.longitude>180)){setMessage("Longitude must be between −180 and 180.");return;}
    if([draft.local_x,draft.local_z].some(v=>v!==null&&!Number.isFinite(v))){setMessage("Local coordinates must be valid numbers.");return;}
    setBusy(true);setMessage("");
    const row={id,name:draft.name.trim(),category:draft.category.trim(),description:draft.description?.trim()||null,position_status:draft.position_status,latitude:draft.latitude,longitude:draft.longitude,local_x:draft.local_x,local_z:draft.local_z,evidence,image_url:draft.image_url};
    const result=savedId?await supabase.from("campus_locations").update(row).eq("id",savedId):await supabase.from("campus_locations").insert(row);
    setBusy(false);
    if(result.error){setMessage(`Save failed: ${result.error.message}`);return;}
    setMessage(savedId?"Campus place updated.":"Campus place added.");setSavedId(id);await load();
  }
  async function remove(place:Place){
    if(!supabase)return;
    setConfirmation({title:"Remove campus place?",body:`“${place.name}” will be removed from the live campus directory.`,label:"Remove place",run:async()=>{
      const {error}=await supabase.from("campus_locations").delete().eq("id",place.id);
      if(error)setMessage(`Delete failed: ${error.message}`);else{setMessage(`${place.name} removed.`);if(savedId===place.id)clearDraft();await load();}
    }});
  }
  function suspendUser(user:AdminUser){
    if(!supabase)return;
    const suspending=!user.is_suspended;
    setConfirmation({title:suspending?"Suspend this account?":"Restore this account?",body:suspending?`${user.display_name} will lose access to posting, friend requests, and messaging. Their profile and referral history will remain.`:`${user.display_name} will regain access to social features.`,label:suspending?"Suspend account":"Restore account",reason:suspending,run:async reason=>{
      const {data:{user:admin}}=await supabase.auth.getUser();if(!admin){setMessage("Your admin session expired.");return;}
      const {error}=await supabase.from("profiles").update({is_suspended:suspending,suspension_reason:suspending?reason.trim()||"Suspended by an administrator":null,suspended_at:suspending?new Date().toISOString():null,suspended_by:suspending?admin.id:null}).eq("id",user.id);
      if(error)setMessage(`User update failed: ${error.message}`);else{setMessage(`${user.display_name} ${suspending?"suspended":"restored"}.`);await loadUsers();}
    }});
  }
  function deleteReportedPost(postId:string|null,count:number){
    if(!supabase||!postId||count<5)return;
    setConfirmation({title:"Delete reported post?",body:`This post has ${count} distinct reports. Deleting removes it from feeds; report snapshots remain in the moderation log.`,label:"Delete post",run:async()=>{
      const {error}=await supabase.from("posts").delete().eq("id",postId);
      if(error)setMessage(`Post deletion failed: ${error.message}`);else{setMessage("Reported post deleted.");await Promise.all([loadReports(),loadPosts()]);}
    }});
  }
  async function reviewReports(postId:string|null){
    if(!supabase||!postId||busy)return;
    setBusy(true);
    const {error}=await supabase.from("post_reports").update({status:"reviewed",reviewed_at:new Date().toISOString()}).eq("post_id",postId).eq("status","pending");
    if(error)setMessage(`Unable to update reports: ${error.message}`);else{setMessage("Reports marked reviewed.");await loadReports();}
    setBusy(false);
  }
  async function dismissReport(report:PostReport){
    if(!supabase||busy)return;
    setBusy(true);
    const {error}=await supabase.from("post_reports").update({status:"dismissed",reviewed_at:new Date().toISOString()}).eq("id",report.id);
    if(error)setMessage(`Unable to dismiss report: ${error.message}`);else {setMessage("Report dismissed.");await loadReports();}
    setBusy(false);
  }
  async function uploadPhoto(file?:File){
    if(!supabase||!file)return;
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024){setMessage("Choose a JPG, PNG, or WebP image smaller than 10 MB.");return;}
    const id=draft.id.trim()||draftId(draft.name);
    if(!id){setMessage("Save the place name before uploading a photo.");return;}
    setBusy(true);const ext=file.type.split("/")[1];const path=`${id}/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from("campus-media").upload(path,file,{contentType:file.type,cacheControl:"3600"});
    if(error){setBusy(false);setMessage(`Photo upload failed: ${error.message}`);return;}
    const {data}=supabase.storage.from("campus-media").getPublicUrl(path);setDraft(current=>({...current,id,image_url:data.publicUrl}));
    if(savedId){const result=await supabase.from("campus_locations").update({image_url:data.publicUrl}).eq("id",savedId);if(result.error)setMessage(`Photo uploaded, but location update failed: ${result.error.message}`);else{setMessage("Campus photo uploaded.");await load();}}
    setBusy(false);
  }
  function asRecord(value:unknown):Record<string,unknown>|null{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;}
  function importGeoJson(file?:File){
    if(!file)return;
    setBusy(true);setImportSummary("");
    void file.text().then(async text=>{
      if(!supabase)throw new Error("Supabase is not configured.");
      const root=asRecord(JSON.parse(text));const features=Array.isArray(root?.features)?root.features:[];
      if(!features.length)throw new Error("This file must be a GeoJSON FeatureCollection with at least one feature.");
      const rows:Omit<Place,"image_url">[]=[];
      for(const feature of features){
        const f=asRecord(feature);const properties=asRecord(f?.properties)??{};const geometry=asRecord(f?.geometry)??{};
        const name=String(properties.name??properties.title??"").trim();if(!name)continue;
        const id=String(properties.id??draftId(name));if(!id)continue;const coords=Array.isArray(geometry.coordinates)?geometry.coordinates:[];
        const point=geometry.type==="Point"&&typeof coords[0]==="number"&&typeof coords[1]==="number";
        const rawLat=typeof properties.latitude==="number"?properties.latitude:point?Number(coords[1]):null;
        const rawLng=typeof properties.longitude==="number"?properties.longitude:point?Number(coords[0]):null;
        const lat=rawLat!==null&&rawLng!==null&&rawLat>=-90&&rawLat<=90&&rawLng>=-180&&rawLng<=180?rawLat:null;
        const lng=lat!==null?rawLng:null;
        const rawX=typeof properties.local_x==="number"?properties.local_x:typeof properties.x==="number"?properties.x:null;
        const rawZ=typeof properties.local_z==="number"?properties.local_z:typeof properties.z==="number"?properties.z:null;
        const x=rawX!==null&&rawZ!==null?rawX:null;const z=x!==null?rawZ:null;
        rows.push({id,name,category:String(properties.category??"landmark"),description:typeof properties.description==="string"?properties.description:null,latitude:lat,longitude:lng,local_x:x,local_z:z,position_status:lat!==null||x!==null?"provisional":"unverified",evidence:[{type:"import",note:"Imported from GeoJSON. Confirm source and position before marking verified."}]} as Omit<Place,"image_url">);
      }
      if(!rows.length)throw new Error("No features with a name were found.");
      const seen=new Set(places.map(p=>p.id));const fresh=rows.filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;});
      if(!fresh.length){setImportSummary(`No new places imported. ${rows.length} item(s) already exist; imports do not overwrite reviewed records.`);return;}
      const {error}=await supabase.from("campus_locations").insert(fresh);
      if(error)throw new Error(error.message);
      setImportSummary(`Imported ${fresh.length} place(s). ${rows.length-fresh.length} existing place(s) were skipped. Imported coordinates remain provisional until reviewed.`);await load();
    }).catch(error=>setImportSummary(error instanceof Error?error.message:"Unable to read this GeoJSON file.")).finally(()=>setBusy(false));
  }

  return <main className="admin-page"><header className="admin-top"><Link className="admin-back" href="/">← Return to campus</Link><div className="admin-top-actions"><NotificationCenter/><div className="admin-user">Signed in as <b>{adminEmail}</b></div></div></header><div className="admin-main">
    <div className="admin-heading"><div><div className="eyebrow">FUTO LIFE · ADMIN</div><h1>Admin dashboard</h1><p>Manage campus data, student accounts, posts and referrals.</p></div><div className="admin-count">{places.length}<small>campus places</small></div></div>
    <nav className="admin-tabs">{(["places","users","posts","referrals","activity"] as const).map(item=><button key={item} className={section===item?"active":""} onClick={()=>setSection(item)}>{item==="places"?"Places & map":item==="users"?`Users · ${users.length}`:item==="posts"?`Post reports · ${reports.filter(r=>r.status==="pending").length}`:item==="referrals"?`Referrals · ${referrals.length}`:"Activity log"}</button>)}</nav>
    {section==="places"&&<div className="admin-layout"><section className="admin-form-card"><h2>{savedId?"Edit campus place":"Add a campus place"}</h2><p>Precise WGS84 coordinates use latitude/longitude. Local map coordinates place items in the current 3D scene.</p>
      <form className="admin-form" onSubmit={e=>void save(e)}>
        <label className="field">Place name<input required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value,...(!savedId?{id:draftId(e.target.value)}:{})})} placeholder="e.g. School of Engineering"/></label>
        <label className="field">Place ID<input maxLength={80} value={draft.id} onChange={e=>setDraft({...draft,id:e.target.value})} placeholder="Generated from name"/></label>
        <label className="field">Category<input required maxLength={60} value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} placeholder="department, lecture, eatery…"/></label>
        <label className="field">Description<textarea maxLength={500} value={draft.description??""} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
        <div className="admin-fieldset"><b>Geographic coordinates · WGS84</b><div className="admin-number-grid"><label className="field">Latitude<input type="number" step="any" value={draft.latitude??""} onChange={e=>setDraft({...draft,latitude:numeric(e.target.value)})} placeholder="5.35…"/></label><label className="field">Longitude<input type="number" step="any" value={draft.longitude??""} onChange={e=>setDraft({...draft,longitude:numeric(e.target.value)})} placeholder="6.99…"/></label></div></div>
        <div className="admin-fieldset"><b>3D campus coordinates · local units</b><div className="admin-number-grid"><label className="field">X<input type="number" step="any" value={draft.local_x??""} onChange={e=>setDraft({...draft,local_x:numeric(e.target.value)})}/></label><label className="field">Z<input type="number" step="any" value={draft.local_z??""} onChange={e=>setDraft({...draft,local_z:numeric(e.target.value)})}/></label></div></div>
        <label className="field">Verification status<select value={draft.position_status} onChange={e=>setDraft({...draft,position_status:e.target.value as Place["position_status"]})}><option value="unverified">Unverified</option><option value="provisional">Provisional</option><option value="verified">Verified</option></select></label>
        <label className="field">Evidence sources <small>One item per line: “type | note or URL”. Verified locations need at least one.</small><textarea rows={4} value={draft.evidenceText} onChange={e=>setDraft({...draft,evidenceText:e.target.value})} placeholder={"official_source | FUTO campus map\nfield_survey | Confirmed at the location on 2026-11-02"}/></label>
        <div className="field"><span>Location photo</span>{draft.image_url&&<img className="admin-photo-preview" src={draft.image_url} alt="Campus location"/>}<label className="admin-upload secondary">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadPhoto(e.currentTarget.files?.[0])}/></label><small>JPG, PNG, WebP · max 10 MB</small></div>
        <div className="admin-form-actions"><button className="primary" disabled={busy}>{busy?"Saving…":savedId?"Save changes":"Add place"}</button>{savedId&&<button type="button" className="secondary" onClick={clearDraft}>New place</button>}</div>
      </form>
    </section>
    <section className="admin-list-card"><div className="admin-list-head"><div><h2>Campus locations</h2><p>Updates are saved to the live Supabase directory.</p></div><input className="admin-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search places…"/></div><div className="admin-location-list">{dataLoading?<div className="admin-empty" aria-live="polite">Loading campus locations…</div>:filtered.map(place=><article className="admin-place" key={place.id}><div className="admin-place-image">{place.image_url?<img src={place.image_url} alt=""/>:<span>⌖</span>}</div><div className="admin-place-info"><b>{place.name}</b><small>{place.category} · <span className={`admin-status status-${place.position_status}`}>{place.position_status}</span></small><small>{place.latitude!==null&&place.longitude!==null?`${place.latitude}, ${place.longitude}`:"GPS not set"}</small></div><button className="secondary compact" onClick={()=>edit(place)}>Edit</button><button className="admin-delete" onClick={()=>void remove(place)} aria-label={`Delete ${place.name}`} title="Delete place">×</button></article>)}{!dataLoading&&!filtered.length&&<div className="admin-empty">No places match this search.</div>}</div>
      <div className="geojson-import"><div><h3>Import a GeoJSON file</h3><p>Point coordinates are read as [longitude, latitude]. Imported items are never marked verified and existing IDs are skipped.</p></div><label className="secondary admin-upload">Choose .geojson<input type="file" accept=".json,.geojson,application/geo+json,application/json" onChange={e=>{importGeoJson(e.currentTarget.files?.[0]);e.currentTarget.value=""}}/></label></div>
    </section></div>}
    {section==="users"&&<section className="admin-list-card admin-manage-card"><div className="admin-list-head"><div><h2>Student accounts</h2><p>Suspend social access while retaining the account and referral history.</p></div><input className="admin-search" value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="Search name, department, ID…"/></div><div className="admin-location-list">{dataLoading?<div className="admin-empty">Loading student accounts…</div>:filteredUsers.map(user=><article className="admin-place admin-user-row" key={user.id}><div className="admin-place-image">{user.avatar_url?<img src={user.avatar_url} alt=""/>:<span>{user.display_name.slice(0,1).toUpperCase()}</span>}</div><div className="admin-place-info"><b>{user.display_name}</b><small>{[user.department,user.year_of_study?`Year ${user.year_of_study}`:null].filter(Boolean).join(" · ")||"Department not set"}</small><small title={user.id}>ID · {user.id.slice(0,8)}… · Joined {new Date(user.created_at).toLocaleDateString()}</small>{user.is_suspended&&<small className="admin-suspended-reason">Suspended: {user.suspension_reason||"No reason recorded"}</small>}</div><button className={user.is_suspended?"secondary compact":"admin-warn-button"} onClick={()=>suspendUser(user)}>{user.is_suspended?"Restore":"Suspend"}</button></article>)}{!dataLoading&&!filteredUsers.length&&<div className="admin-empty">No student accounts match.</div>}</div></section>}
    {section==="posts"&&<><section className="admin-list-card admin-manage-card"><div className="admin-list-head"><div><h2>Post reports</h2><p>Each student may report a post once. Admin deletion is available after five distinct reports.</p></div><button className="secondary compact" onClick={()=>{void loadReports();void loadPosts();}}>Refresh</button></div><div className="admin-report-list">{groupedReports.map(group=><article className="admin-report" key={group.reports[0].post_key}><div className="admin-report-head"><span className="report-count">{group.reports.length} report{group.reports.length===1?"":"s"}</span><span>{group.postId?`Post by ${userById.get(group.authorId??"")?.display_name??"student"}`:"Post removed; report retained"}</span><span className="report-id">{group.reports[0].status}</span></div><blockquote>{group.body}</blockquote><div className="admin-report-reasons">{group.reports.map(report=><div className="admin-report-reason" key={report.id}><b>{report.reason.replaceAll("_"," ")}</b>{report.details&&<span> — {report.details}</span>}<small>{userById.get(report.reporter_id??"")?.display_name??"Student"} · {new Date(report.created_at).toLocaleString()} · {report.status}</small></div>)}</div><div className="admin-report-actions">{group.postId&&<button className="secondary compact" onClick={()=>void reviewReports(group.postId)}>Mark pending reports reviewed</button>}{group.reports.some(r=>r.status==="pending")&&<button className="secondary compact" onClick={()=>void dismissReport(group.reports.find(r=>r.status==="pending")!)}>Dismiss a report</button>}{group.postId&&group.reports.length>=5&&<button className="admin-warn-button" onClick={()=>deleteReportedPost(group.postId,group.reports.length)}>Delete post · 5+ reports</button>}</div></article>)}{!groupedReports.length&&<div className="admin-empty">No post reports yet.</div>}</div></section><section className="admin-list-card admin-manage-card"><div className="admin-list-head"><div><h2>All posts</h2><p>Posts can be deleted here only when at least five distinct reports have been filed.</p></div><span>{allPosts.length} shown</span></div><div className="admin-report-list">{allPosts.map(post=>{const count=reports.filter(report=>report.post_key===post.id).length;return <article className="admin-report" key={post.id}><div className="admin-report-head"><b>{userById.get(post.author_id)?.display_name??"Student"}</b><span>{new Date(post.created_at).toLocaleString()}</span><span className="report-count">{count} reports</span></div><blockquote>{post.body}</blockquote>{count>=5&&<button className="admin-warn-button" onClick={()=>deleteReportedPost(post.id,count)}>Delete post · 5+ reports</button>}</article>;})}{!allPosts.length&&<div className="admin-empty">No posts have been created.</div>}</div></section></>}
    {section==="referrals"&&<section className="admin-list-card admin-manage-card"><div className="admin-list-head"><div><h2>Referral history</h2><p>Referral edges are stored without rewards. Depth shows each user’s position below the original referrer.</p></div><button className="secondary compact" onClick={()=>void loadReferrals()}>Refresh</button></div><div className="admin-location-list">{referrals.map(edge=><article className="admin-place" key={edge.id}><div className="referral-depth">L{edgeDepth(edge)}</div><div className="admin-place-info"><b>{userById.get(edge.referred_id)?.display_name??"Referred account"}</b><small>Referred by {userById.get(edge.referrer_id)?.display_name??"Student"} · Level {edgeDepth(edge)}</small><small>{new Date(edge.created_at).toLocaleString()}</small></div></article>)}{!referrals.length&&<div className="admin-empty">No referrals have been recorded yet.</div>}</div></section>}
    {section==="activity"&&<section className="admin-list-card admin-manage-card"><div className="admin-list-head"><div><h2>Activity log</h2><p>Append-only audit history for account, social, messaging, moderation, and campus changes. Message content and passwords are never included.</p></div><button className="secondary compact" onClick={()=>void loadActivity()}>Refresh</button></div><div className="activity-log-list">{dataLoading?<div className="admin-empty">Loading activity…</div>:activityLogs.map(entry=><article className="activity-log-row" key={entry.id}><span className="activity-log-marker"/><div className="activity-log-copy"><div className="activity-log-head"><b>{entry.action.replaceAll("_"," ")}</b><time>{new Date(entry.created_at).toLocaleString()}</time></div><p><strong>{entry.actor_email??(entry.actor_id?`User ${entry.actor_id.slice(0,8)}`:"System")}</strong>{entry.entity_type&&<> · {entry.entity_type}{entry.entity_id?` ${entry.entity_id.slice(0,16)}`:""}</>}{Object.keys(entry.metadata??{}).length>0&&<small>{JSON.stringify(entry.metadata)}</small>}</p></div></article>)}{!dataLoading&&!activityLogs.length&&<div className="admin-empty">No activity has been recorded yet. Apply the activity and notifications migration first.</div>}</div></section>}    <p className="admin-security-note">Only the confirmed admin account can manage users, posts and campus records. Suspended accounts and referral records are retained.</p>
  </div>{confirmation&&<div className="confirm-backdrop" role="presentation"><section className="confirm-dialog panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div className="eyebrow">Please confirm</div><h2 id="confirm-title">{confirmation.title}</h2><p>{confirmation.body}</p>{confirmation.reason&&<label className="field">Reason<textarea value={confirmationReason} onChange={e=>setConfirmationReason(e.target.value)} maxLength={500} placeholder="Add a short reason"/></label>}<div className="confirm-actions"><button className="secondary" disabled={busy} onClick={()=>{setConfirmation(null);setConfirmationReason("");}}>Cancel</button><button className="primary" disabled={busy} onClick={()=>{const action=confirmation;setBusy(true);void action.run(confirmationReason).finally(()=>{setBusy(false);setConfirmation(null);setConfirmationReason("");});}}>{busy?"Working…":confirmation.label}</button></div></section></div>}</main>;
}
