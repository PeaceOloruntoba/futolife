"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";

type Place = { id: string; name: string; category: string; description: string | null; position_status: "verified" | "provisional" | "unverified"; latitude: number | null; longitude: number | null; local_x: number | null; local_z: number | null; evidence: { type?: string; note?: string; url?: string }[]; image_url: string | null };
type Draft = Omit<Place,"evidence"> & { evidenceText: string };
const EMPTY: Draft = { id:"",name:"",category:"landmark",description:"",position_status:"unverified",latitude:null,longitude:null,local_x:null,local_z:null,evidenceText:"",image_url:null };

export default function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [places,setPlaces] = useState<Place[]>([]);
  const [draft,setDraft] = useState<Draft>(EMPTY);
  const [search,setSearch] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [importSummary,setImportSummary] = useState("");
  const [savedId,setSavedId] = useState<string|null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const {data,error} = await supabase.from("campus_locations").select("id,name,category,description,position_status,latitude,longitude,local_x,local_z,evidence,image_url").order("name");
    if (error) setMessage(`Could not load campus data: ${error.message}`);
    else setPlaces((data??[]) as Place[]);
  },[supabase]);
  useEffect(()=>{void load();},[load]);

  const filtered = places.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  function edit(place: Place) {
    setSavedId(place.id);
    setDraft({...place, evidenceText:place.evidence.map(e=>`${e.type??"admin_note"} | ${e.url??e.note??""}`).join("\n")});
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
    if(!supabase||!window.confirm(`Remove “${place.name}” from the campus directory?`))return;
    const {error}=await supabase.from("campus_locations").delete().eq("id",place.id);
    if(error)setMessage(`Delete failed: ${error.message}`);else{setMessage(`${place.name} removed.`);if(savedId===place.id)clearDraft();await load();}
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

  return <main className="admin-page"><header className="admin-top"><Link className="admin-back" href="/">← Return to campus</Link><div className="admin-user">Signed in as <b>{adminEmail}</b></div></header><div className="admin-main">
    <div className="admin-heading"><div><div className="eyebrow">FUTO LIFE · ADMIN</div><h1>Campus data dashboard</h1><p>Manage the location directory, map coordinates, evidence and photos.</p></div><div className="admin-count">{places.length}<small>campus places</small></div></div>
    <div className="admin-layout"><section className="admin-form-card"><h2>{savedId?"Edit campus place":"Add a campus place"}</h2><p>Precise WGS84 coordinates use latitude/longitude. Local map coordinates place items in the current 3D scene.</p>
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
        {message&&<p className="admin-message" role="status">{message}</p>}
        <div className="admin-form-actions"><button className="primary" disabled={busy}>{busy?"Saving…":savedId?"Save changes":"Add place"}</button>{savedId&&<button type="button" className="secondary" onClick={clearDraft}>New place</button>}</div>
      </form>
    </section>
    <section className="admin-list-card"><div className="admin-list-head"><div><h2>Campus locations</h2><p>Updates are saved to the live Supabase directory.</p></div><input className="admin-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search places…"/></div><div className="admin-location-list">{filtered.map(place=><article className="admin-place" key={place.id}><div className="admin-place-image">{place.image_url?<img src={place.image_url} alt=""/>:<span>⌖</span>}</div><div className="admin-place-info"><b>{place.name}</b><small>{place.category} · <span className={`admin-status status-${place.position_status}`}>{place.position_status}</span></small><small>{place.latitude!==null&&place.longitude!==null?`${place.latitude}, ${place.longitude}`:"GPS not set"}</small></div><button className="secondary compact" onClick={()=>edit(place)}>Edit</button><button className="admin-delete" onClick={()=>void remove(place)} aria-label={`Delete ${place.name}`} title="Delete place">×</button></article>)}{!filtered.length&&<div className="admin-empty">No places match this search.</div>}</div>
      <div className="geojson-import"><div><h3>Import a GeoJSON file</h3><p>Point coordinates are read as [longitude, latitude]. Imported items are never marked verified and existing IDs are skipped.</p></div><label className="secondary admin-upload">Choose .geojson<input type="file" accept=".json,.geojson,application/geo+json,application/json" onChange={e=>{importGeoJson(e.currentTarget.files?.[0]);e.currentTarget.value=""}}/></label>{importSummary&&<p role="status">{importSummary}</p>}</div>
    </section></div>
    <p className="admin-security-note">Only the confirmed admin account can change campus records. Keep your account password private; do not share it or commit it to the project.</p>
  </div></main>;
}
