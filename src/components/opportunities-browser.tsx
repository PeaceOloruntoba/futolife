"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Listing={id:string;title:string;slug:string;organization:string;summary:string;location:string;deadline:string|null;featured:boolean;category_id:string|null};
type Category={id:string;name:string;slug:string};
export function OpportunitiesBrowser({items,categories}:{items:Listing[];categories:Category[]}){
  const [search,setSearch]=useState("");const [category,setCategory]=useState("all");const [order,setOrder]=useState("latest");
  const filtered=useMemo(()=>items.filter(item=>(category==="all"||item.category_id===category)&&`${item.title} ${item.organization} ${item.summary} ${item.location}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>order==="deadline"?(a.deadline??"9999").localeCompare(b.deadline??"9999"):Number(b.featured)-Number(a.featured)),[items,categories,category,order,search]);
  const categoryName=(id:string|null)=>categories.find(c=>c.id===id)?.name??"Opportunity";
  return <><div className="opp-filters"><label className="opp-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search opportunities, organisations…"/></label><select aria-label="Filter by category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label="Sort opportunities" value={order} onChange={e=>setOrder(e.target.value)}><option value="latest">Featured first</option><option value="deadline">Closing soon</option></select></div><div className="opp-list-grid">{filtered.map(item=><article className="opp-list-card" key={item.id}><div className="opp-list-meta"><span>{categoryName(item.category_id)}</span>{item.featured&&<b>FEATURED</b>}</div><h2><Link href={`/opportunities/${item.slug}`}>{item.title}</Link></h2><div className="opp-org">{item.organization} <span>·</span> {item.location}</div><p>{item.summary}</p><footer>{item.deadline&&<span>Deadline · {new Date(item.deadline).toLocaleDateString("en-NG",{dateStyle:"medium"})}</span>}<Link href={`/opportunities/${item.slug}`}>View opportunity ↗</Link></footer></article>)}{!filtered.length&&<div className="opp-empty">No opportunities match this search yet.</div>}</div></>;
}
