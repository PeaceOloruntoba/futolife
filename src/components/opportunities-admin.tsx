"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type RecordItem = Record<string, string | boolean | null> & { id: string; title: string; slug: string; status: string };
const emptyOpportunity = { title:"", slug:"", organization:"", category_id:"", summary:"", description:"", eligibility:"", benefits:"", required_documents:"", location:"Online", deadline:"", application_instructions:"", source_url:"", application_url:"", status:"draft", featured:false };
const emptyArticle = { title:"", slug:"", excerpt:"", content:"", section:"Guides", cover_image_url:"", status:"draft", featured:false, author_name:"FUTO Life Editorial Team" };
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export function OpportunitiesAdmin() {
  const supabase = createClient();
  const [email,setEmail] = useState("opportunities@futolife.app");
  const [password,setPassword] = useState("");
  const [userEmail,setUserEmail] = useState("");
  const [authorized,setAuthorized] = useState(false);
  const [section,setSection] = useState<"opportunities"|"articles"|"categories">("opportunities");
  const [items,setItems] = useState<RecordItem[]>([]);
  const [categories,setCategories] = useState<{id:string;name:string;slug:string}[]>([]);
  const [draft,setDraft] = useState<Record<string,string|boolean>>(emptyOpportunity);
  const [editId,setEditId] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const load = useCallback(async () => {
    if(!supabase)return;
    const {data,error}=await supabase.rpc("can_manage_opportunities");
    if(error||!data){setAuthorized(false);return;}
    setAuthorized(true);
    const {data:{user}}=await supabase.auth.getUser();setUserEmail(user?.email??"");
    const [opps,articles,cats]=await Promise.all([
      supabase.from("opportunities").select("*").order("updated_at",{ascending:false}),
      supabase.from("articles").select("*").order("updated_at",{ascending:false}),
      supabase.from("opportunity_categories").select("id,name,slug").order("name")
    ]);
    if(section==="opportunities"&&!opps.error)setItems((opps.data??[]) as RecordItem[]);
    if(section==="articles"&&!articles.error)setItems((articles.data??[]) as RecordItem[]);
    if(cats.data)setCategories(cats.data);
    const error=opps.error||articles.error||cats.error;
    if(error)setMessage(error.message);
  },[section,supabase]);
  useEffect(()=>{if(!supabase)return;void supabase.auth.getUser().then(({data:{user}})=>{if(user){setUserEmail(user.email??"");void load();}});},[load,supabase]);

  async function signIn(event:React.FormEvent){event.preventDefault();if(!supabase)return;setBusy(true);setMessage("");
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error){setMessage(error.message);setBusy(false);return;}
    const {data:allowed,error:roleError}=await supabase.rpc("can_manage_opportunities");
    if(roleError||!allowed){await supabase.auth.signOut();setMessage("This account is not authorized for the opportunities dashboard.");setBusy(false);return;}
    setAuthorized(true);setUserEmail(email);setPassword("");setBusy(false);void load();
  }
  function newItem(){setEditId("");setDraft(section==="articles"?emptyArticle:emptyOpportunity);setMessage("");}
  function edit(item:RecordItem){setEditId(item.id);setDraft(Object.fromEntries(Object.entries(item).map(([key,value])=>[key,value===null?"":value])) as Record<string,string|boolean>);setMessage("");}
  async function save(event:React.FormEvent){event.preventDefault();if(!supabase)return;setBusy(true);setMessage("");
    const payload={...draft,slug:String(draft.slug||slugify(String(draft.title))),updated_at:new Date().toISOString(),...(section==="opportunities"?{category_id:draft.category_id||null,deadline:draft.deadline||null,verified_at:draft.status==="published"?new Date().toISOString():null,last_checked_at:draft.status==="published"?new Date().toISOString():null}:{published_at:draft.status==="published"?new Date().toISOString():null})};
    const table=section==="opportunities"?"opportunities":"articles";
    const result=editId?await supabase.from(table).update(payload).eq("id",editId):await supabase.from(table).insert({...payload,created_by:(await supabase.auth.getUser()).data.user?.id});
    if(result.error)setMessage(result.error.message);else{setMessage("Saved.");newItem();void load();}
    setBusy(false);
  }
  async function remove(id:string){if(!supabase||!window.confirm("Delete this item permanently?"))return;const table=section==="opportunities"?"opportunities":"articles";const {error}=await supabase.from(table).delete().eq("id",id);setMessage(error?.message??"Deleted.");void load();}
  async function addCategory(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!supabase)return;const form=new FormData(event.currentTarget);const name=String(form.get("name")||"").trim();const {error}=await supabase.from("opportunity_categories").insert({name,slug:slugify(name),description:String(form.get("description")||"")});setMessage(error?.message??"Category added.");if(!error){event.currentTarget.reset();void load();}}

  if(!authorized)return <main className="opp-admin-page"><Link href="/opportunities" className="opp-back">← Opportunities</Link><section className="opp-admin-login"><span className="opp-kicker">FUTO LIFE · PUBLISHING</span><h1>Staff sign in</h1><p>Access the opportunities and editorial publishing dashboard.</p><form onSubmit={signIn}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form>{message&&<p role="status">{message}</p>}</section></main>;

  return <main className="opp-admin-page"><header className="opp-admin-top"><Link href="/opportunities">← Public opportunities</Link><span>Signed in as <b>{userEmail}</b></span><button onClick={async()=>{await supabase?.auth.signOut();setAuthorized(false);setUserEmail("");}}>Sign out</button></header><section className="opp-admin-content"><div className="opp-admin-heading"><div><span className="opp-kicker">FUTO LIFE · PUBLISHING</span><h1>Opportunities dashboard</h1><p>Create verified listings and editorial stories, then review and publish them here.</p></div><span className="opp-admin-mark">FL</span></div><nav className="opp-admin-tabs">{(["opportunities","articles","categories"] as const).map(tab=><button key={tab} className={section===tab?"active":""} onClick={()=>{setSection(tab);newItem();}}>{tab}</button>)}</nav>
    {section==="categories"?<section className="opp-admin-card"><h2>Opportunity categories</h2><form className="opp-category-form" onSubmit={addCategory}><input name="name" placeholder="Category name" required/><input name="description" placeholder="Short description"/><button>Add category</button></form><div className="opp-category-list">{categories.map(c=><div key={c.id}><b>{c.name}</b><span>/{c.slug}</span></div>)}</div></section>:<div className="opp-admin-grid"><form className="opp-admin-card opp-editor" onSubmit={save}><div className="opp-editor-head"><div><h2>{editId?"Edit":"New"} {section==="opportunities"?"opportunity":"article"}</h2><p>Items stay private until their status is published.</p></div><button type="button" className="opp-new" onClick={newItem}>New</button></div>
      {section==="opportunities"?<><label>Title<input required value={String(draft.title??"")} onChange={e=>setDraft({...draft,title:e.target.value,slug:editId?draft.slug:slugify(e.target.value)})}/></label><label>Slug<input required value={String(draft.slug??"")} onChange={e=>setDraft({...draft,slug:e.target.value})}/></label><div className="opp-form-row"><label>Organisation<input required value={String(draft.organization??"")} onChange={e=>setDraft({...draft,organization:e.target.value})}/></label><label>Category<select value={String(draft.category_id??"")} onChange={e=>setDraft({...draft,category_id:e.target.value})}><option value="">Choose category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><label>Summary<textarea rows={2} value={String(draft.summary??"")} onChange={e=>setDraft({...draft,summary:e.target.value})}/></label><label>Full description<textarea rows={6} value={String(draft.description??"")} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><div className="opp-form-row"><label>Eligibility<textarea rows={3} value={String(draft.eligibility??"")} onChange={e=>setDraft({...draft,eligibility:e.target.value})}/></label><label>Benefits<textarea rows={3} value={String(draft.benefits??"")} onChange={e=>setDraft({...draft,benefits:e.target.value})}/></label></div><div className="opp-form-row"><label>Required documents<textarea rows={3} value={String(draft.required_documents??"")} onChange={e=>setDraft({...draft,required_documents:e.target.value})}/></label><label>Application instructions<textarea rows={3} value={String(draft.application_instructions??"")} onChange={e=>setDraft({...draft,application_instructions:e.target.value})}/></label></div><div className="opp-form-row"><label>Location<input value={String(draft.location??"")} onChange={e=>setDraft({...draft,location:e.target.value})}/></label><label>Deadline<input type="date" value={String(draft.deadline??"").slice(0,10)} onChange={e=>setDraft({...draft,deadline:e.target.value?new Date(`${e.target.value}T23:59:59Z`).toISOString():""})}/></label></div><label>Official source URL<input type="url" required value={String(draft.source_url??"")} onChange={e=>setDraft({...draft,source_url:e.target.value})}/></label><label>Application URL<input type="url" required value={String(draft.application_url??"")} onChange={e=>setDraft({...draft,application_url:e.target.value})}/></label></>:<><label>Title<input required value={String(draft.title??"")} onChange={e=>setDraft({...draft,title:e.target.value,slug:editId?draft.slug:slugify(e.target.value)})}/></label><label>Slug<input required value={String(draft.slug??"")} onChange={e=>setDraft({...draft,slug:e.target.value})}/></label><div className="opp-form-row"><label>Section<input value={String(draft.section??"")} onChange={e=>setDraft({...draft,section:e.target.value})}/></label><label>Author<input value={String(draft.author_name??"")} onChange={e=>setDraft({...draft,author_name:e.target.value})}/></label></div><label>Excerpt<textarea rows={3} value={String(draft.excerpt??"")} onChange={e=>setDraft({...draft,excerpt:e.target.value})}/></label><label>Article body<textarea rows={12} value={String(draft.content??"")} onChange={e=>setDraft({...draft,content:e.target.value})}/></label><label>Cover image URL<input type="url" value={String(draft.cover_image_url??"")} onChange={e=>setDraft({...draft,cover_image_url:e.target.value})}/></label></>}
      <div className="opp-form-row"><label>Status<select value={String(draft.status??"draft")} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="draft">Draft</option>{section==="opportunities"&&<><option value="pending_review">Pending review</option><option value="rejected">Rejected</option></>}<option value="published">Published</option><option value="archived">Archived</option></select></label><label className="opp-featured"><input type="checkbox" checked={Boolean(draft.featured)} onChange={e=>setDraft({...draft,featured:e.target.checked})}/> Feature on the homepage</label></div><button className="opp-save" disabled={busy}>{busy?"Saving…":"Save changes"}</button>{message&&<p className="opp-admin-message" role="status">{message}</p>}</form>
      <section className="opp-admin-card opp-items"><div className="opp-items-head"><h2>{section=== "opportunities"?"Listings":"Articles"}</h2><button onClick={()=>void load()}>Refresh</button></div>{items.map(item=><article key={item.id}><div><b>{item.title}</b><small>/{item.slug} · {item.status}</small></div><button onClick={()=>edit(item)}>Edit</button><button className="opp-remove" onClick={()=>void remove(item.id)}>Delete</button></article>)}{!items.length&&<p>No items yet.</p>}</section></div>}
  </section></main>;
}
