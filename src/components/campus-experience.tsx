"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { locations, type CampusLocation } from "@/lib/locations";
import { createClient } from "@/lib/supabase/browser";
import { notify } from "@/lib/notify";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { NotificationCenter } from "@/components/notification-center";
import { GameHub } from "@/components/game-hub";

type Profile = { id: string; display_name: string; department: string | null; year_of_study: number | null; member_type?: "student"|"alumni"|"visitor"; alumni_set?: string|null; avatar_url: string | null };
type AuthMode = "signin" | "signup";
type RoadDraft = { id: string; name: string; class: string; status: string; coordinates: number[][] };
type CampusRoadData = { roads: RoadDraft[]; transform?: { warning?: string; origin_label?: string }; status?: string };
type WorldPosition = { x: number; z: number; face: number; speed: number; riding: boolean };
type NearbyPlayer = WorldPosition & { id: string; display_name: string; avatar_url: string | null };
type PresenceMeta = WorldPosition & { updated_at: number };

export default function CampusExperience() {
  const worldFrame = useRef<HTMLIFrameElement>(null);
  const [campusLocations, setCampusLocations] = useState<CampusLocation[]>(locations);
  const [locationSource, setLocationSource] = useState<"bundled" | "supabase">("bundled");
  const [locationLoadError, setLocationLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [menuOpen,setMenuOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [gameHubOpen, setGameHubOpen] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [shareCampusPosition, setShareCampusPosition] = useState(false);
  const [presencePreferenceReady, setPresencePreferenceReady] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [presenceStatus, setPresenceStatus] = useState<"offline"|"joining"|"online"|"error">("offline");
  const playerPosition = useRef<WorldPosition>({x:0,z:7,face:0,speed:0,riding:false});
  const lastPositionUiUpdate = useRef(0);
  const [currentWorldPosition, setCurrentWorldPosition] = useState<WorldPosition>({x:0,z:7,face:0,speed:0,riding:false});
  const [roadDraft, setRoadDraft] = useState<CampusRoadData | null>(null);
  const [selected, setSelected] = useState<CampusLocation | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [initialReferralCode,setInitialReferralCode] = useState("");
  const [authReturnTo,setAuthReturnTo] = useState("");

  const visibleLocations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return campusLocations.filter((item) => !term || `${item.name} ${item.category}`.toLowerCase().includes(term));
  }, [campusLocations, query]);

  const plottedLocations = useMemo(() => {
    const positioned = campusLocations.filter((place) => typeof place.local_x === "number" && Number.isFinite(place.local_x) && typeof place.local_z === "number" && Number.isFinite(place.local_z));
    if (!positioned.length) return [];
    const xs = positioned.map((place) => place.local_x as number);
    const zs = positioned.map((place) => place.local_z as number);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const spanX = maxX - minX || 1, spanZ = maxZ - minZ || 1;
    return positioned.map((place) => ({
      place,
      left: 10 + (((place.local_x as number) - minX) / spanX) * 80,
      top: 10 + (((place.local_z as number) - minZ) / spanZ) * 80,
    }));
  }, [campusLocations]);

  function chooseLocation(place: CampusLocation) {
    setSelected(place);
    const client=createClient();
    if(client)void client.rpc("record_user_activity",{p_action:"place.viewed",p_entity_type:"campus_location",p_entity_id:place.id}).then(()=>{});
    if ((place.position_status === "verified" || place.position_status === "provisional") && typeof place.local_x === "number" && typeof place.local_z === "number") {
      worldFrame.current?.contentWindow?.postMessage({ type: "futo:walk-to", x: place.local_x, z: place.local_z }, window.location.origin);
    }
  }

  function navigateToSelected() {
    if (!selected || (selected.position_status !== "verified" && selected.position_status !== "provisional") || typeof selected.local_x !== "number" || typeof selected.local_z !== "number") {
      notify("This place has no usable map position yet. Its photo is available as a visual reference.");
      return;
    }
    worldFrame.current?.contentWindow?.postMessage({ type: "futo:walk-to", x: selected.local_x, z: selected.local_z }, window.location.origin);
  }

  function runWorldControl(control: "camera" | "map" | "directory") {
    if (control === "map") {
      setMapOpen((open) => !open);
      return;
    }
    if (control === "directory") {
      setDirectoryOpen((open) => !open);
      return;
    }
    worldFrame.current?.contentWindow?.postMessage({ type: `futo:${control}` }, window.location.origin);
  }

  useEffect(() => {
    let active = true;
    const refreshLocations=async()=>{
      try{
        const response=await fetch("/api/locations",{cache:"no-store"});
        if(!response.ok)throw new Error("Location inventory request failed.");
        const result=await response.json();
        if(!active||!Array.isArray(result.locations))return;
        setCampusLocations(result.locations);
        setSelected(current=>current?result.locations.find((place:CampusLocation)=>place.id===current.id)??null:null);
        setLocationSource(result.source==="supabase"?"supabase":"bundled");
        setLocationLoadError(false);
      }catch{if(active)setLocationLoadError(true);}
    };
    void refreshLocations();
    const supabase=createClient();
    const channel=supabase?.channel("campus-location-updates").on("postgres_changes",{event:"*",schema:"public",table:"campus_locations"},()=>void refreshLocations()).subscribe();
    return () => { active=false;if(channel&&supabase)void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/campus/map-data-v0.2.json", { cache: "force-cache" })
      .then((response) => response.ok ? response.json() as Promise<CampusRoadData> : Promise.reject())
      .then((data) => { if (active && Array.isArray(data.roads)) setRoadDraft(data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer=window.setTimeout(()=>{
      try { setShareCampusPosition(localStorage.getItem("futo-campus-position-sharing") === "on"); }
      catch { setShareCampusPosition(false); }
      setPresencePreferenceReady(true);
    },0);
    return()=>window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!presencePreferenceReady) return;
    try { localStorage.setItem("futo-campus-position-sharing", shareCampusPosition ? "on" : "off"); }
    catch { /* Position sharing remains controlled by this in-memory setting. */ }
  }, [presencePreferenceReady, shareCampusPosition]);

  useEffect(() => {
    const client = createClient();
    if (!client || !profile?.id || !email) {
      worldFrame.current?.contentWindow?.postMessage({type:"futo:nearby-players",players:[]},window.location.origin);
      return;
    }
    let active = true;
    let joined = false;
    const joiningTimer=window.setTimeout(()=>{if(active)setPresenceStatus("joining");},0);
    const channel = client.channel("futo-campus-presence-v1", {config:{private:true,presence:{key:profile.id}}});
    const refresh = async () => {
      if (!active) return;
      const current = channel.presenceState<PresenceMeta>();
      const snapshots = Object.entries(current).flatMap(([id,metas]) => {
        if(id===profile.id||!Array.isArray(metas)||!metas.length)return [];
        const meta=[...metas].sort((a,b)=>(b.updated_at||0)-(a.updated_at||0))[0];
        if(typeof meta.x!=="number"||typeof meta.z!=="number"||typeof meta.face!=="number"||typeof meta.speed!=="number"||typeof meta.riding!=="boolean"||typeof meta.updated_at!=="number"||!Number.isFinite(meta.x)||!Number.isFinite(meta.z)||!Number.isFinite(meta.face)||!Number.isFinite(meta.speed)||!Number.isFinite(meta.updated_at)||meta.updated_at>Date.now()+10000||Date.now()-meta.updated_at>30000||Math.abs(meta.x)>=1800||Math.abs(meta.z)>=1800||Math.hypot(meta.x-playerPosition.current.x,meta.z-playerPosition.current.z)>180)return [];
        return [{id,meta}];
      });
      if(!snapshots.length){if(active){setNearbyPlayers([]);worldFrame.current?.contentWindow?.postMessage({type:"futo:nearby-players",players:[]},window.location.origin);}return;}
      const {data,error}=await client.from("profiles").select("id,display_name,avatar_url,is_suspended").in("id",snapshots.map((item)=>item.id)).eq("is_suspended",false);
      if(!active)return;
      if(error){setPresenceStatus("error");return;}
      const cards=(data??[]).flatMap((user)=>{const snapshot=snapshots.find((item)=>item.id===user.id);return snapshot?[{id:user.id,display_name:user.display_name,avatar_url:user.avatar_url,...snapshot.meta}]:[];});
      setNearbyPlayers(cards);
      worldFrame.current?.contentWindow?.postMessage({type:"futo:nearby-players",players:cards},window.location.origin);
    };
    channel.on("presence",{event:"sync"},()=>void refresh());
    channel.subscribe(async(status)=>{
      if(!active)return;
      if(status==="SUBSCRIBED"){
        joined=true;setPresenceStatus("online");
        if(shareCampusPosition){const p=playerPosition.current;await channel.track({...p,updated_at:Date.now()});}
        await refresh();
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){joined=false;setPresenceStatus("error");}
      else if(status==="CLOSED"){joined=false;setPresenceStatus("offline");}
    });
    const heartbeat=window.setInterval(()=>{
      if(!joined||!shareCampusPosition)return;
      const p=playerPosition.current;
      void channel.track({...p,updated_at:Date.now()});
    },10000);
    return()=>{active=false;joined=false;clearTimeout(joiningTimer);clearInterval(heartbeat);setNearbyPlayers([]);worldFrame.current?.contentWindow?.postMessage({type:"futo:nearby-players",players:[]},window.location.origin);void client.removeChannel(channel);};
  }, [email, profile?.id, shareCampusPosition]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ref")) {
      setInitialReferralCode(params.get("ref") ?? "");
      setAccountOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("auth") === "signin") {
      const next=params.get("next")??"";if(next.startsWith("/")&&!next.startsWith("//"))setAuthReturnTo(next);
      setAccountOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("auth") === "confirmation-error") {
      const next=params.get("next")??"";if(next.startsWith("/")&&!next.startsWith("//"))setAuthReturnTo(next);
      setAuthNotice("We couldn’t confirm that email link. It may have expired; enter your email and resend the confirmation.");
      setAccountOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    function receiveWorldMessage(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin || event.source !== worldFrame.current?.contentWindow) return;
      if (!event.data || typeof event.data !== "object" || !("type" in event.data) || typeof event.data.type !== "string") return;
      if(event.data.type==="futo:open-map"){
        setMapOpen(true);
        if (window.matchMedia("(max-width: 760px)").matches) setDirectoryOpen(false);
        return;
      }
      if(event.data.type==="futo:open-nearby"){
        setNearbyOpen(true);
        return;
      }
      if(event.data.type==="futo:player-position"){
        if("x" in event.data&&"z" in event.data&&"face" in event.data&&"speed" in event.data&&"riding" in event.data){
          const {x,z,face,speed,riding}=event.data;
          if(typeof x!=="number"||typeof z!=="number"||typeof face!=="number"||typeof speed!=="number"||typeof riding!=="boolean"||!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(face)||!Number.isFinite(speed)||Math.abs(x)>=1800||Math.abs(z)>=1800)return;
          const position={x,z,face,speed,riding};
          playerPosition.current=position;
          if(performance.now()-lastPositionUiUpdate.current>1000){lastPositionUiUpdate.current=performance.now();setCurrentWorldPosition(position);}
        }
        return;
      }
      if(event.data.type==="futo:request-ride-ticket"&&"requestId" in event.data&&typeof event.data.requestId==="string"){
        const requestId=event.data.requestId;
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))return;
        const reply=(ok:boolean,message:string)=>worldFrame.current?.contentWindow?.postMessage({type:"futo:ride-ticket-result",requestId,ok,message},window.location.origin);
        const client=createClient();
        if(!client){reply(true,"Guest bike ride · no ticket required.");return;}
        void client.auth.getUser().then(async({data:{user}})=>{
          if(!user){reply(true,"Guest bike ride · no ticket required.");return;}
          const {error}=await client.rpc("consume_game_ride_ticket",{p_item_id:"bike-ride",p_request_id:requestId});
          if(error)reply(false,error.message);else reply(true,"Bike ticket used.");
        }).catch(()=>reply(false,"Unable to check your bike ticket. Try again."));
      }
    }
    window.addEventListener("message", receiveWorldMessage);
    return () => window.removeEventListener("message", receiveWorldMessage);
  }, []);

  useEffect(()=>{
    const controlled=new Set(["w","a","s","d","shift","arrowleft","arrowright","arrowup","arrowdown"]);
    const forward=(down:boolean)=>(event:KeyboardEvent)=>{
      if(event.target instanceof HTMLElement&&event.target.closest("input,textarea,select,[contenteditable='true']"))return;
      const key=event.key.toLowerCase();if(!controlled.has(key))return;
      if(key.startsWith("arrow"))event.preventDefault();
      worldFrame.current?.contentWindow?.postMessage({type:"futo:key",key,down},window.location.origin);
    };
    const down=forward(true),up=forward(false);
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);};
  },[]);

  useEffect(() => {
    if (!accountOpen && !mapOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setAccountOpen(false); setMapOpen(false); setMenuOpen(false); }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [accountOpen, mapOpen]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let active = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      setEmail(user.email ?? null);
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (active) setIsAdmin(Boolean(role));
      const metadataName = user.user_metadata?.display_name;
      if (typeof metadataName === "string") setProfileNameDraft(metadataName);
      const response = await fetch("/api/profile", { cache: "no-store" });
      const result = await response.json();
      if (active && response.ok && result.profile?.display_name) setProfile(result.profile);
      else if (active) setAccountOpen(true);
    };
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setEmail(session?.user.email ?? null);
      if (!session) { setProfile(null); setIsAdmin(false); setNearbyPlayers([]); setPresenceStatus("offline"); }
      else void supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle().then(({ data }) => { if (active) setIsAdmin(Boolean(data)); });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return <main className="campus">
    <iframe ref={worldFrame} className="world" src="/campus/index.html" title="Interactive FUTO campus prototype" allow="fullscreen" onLoad={()=>worldFrame.current?.contentWindow?.postMessage({type:"futo:nearby-players",players:nearbyPlayers},window.location.origin)}/>
    <Link href="/" className="campus-brand"><span className="brand-mark">F</span><span><b>FUTO LIFE</b><small>Explore your campus</small></span></Link>
    <button className={`dock-menu-toggle${menuOpen?" active":""}`} onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-label={menuOpen?"Close campus menu":"Open campus menu"}><span>{menuOpen?"×":"☰"}</span><b>{menuOpen?"Close":"Menu"}</b></button>
    <aside className={`experience-dock${menuOpen?" drawer-open":""}`} aria-label="Campus menu">
      <div className="dock-heading"><div><span className="eyebrow">FUTO LIFE</span><b>Campus explorer</b></div><button className="dock-dismiss" onClick={()=>setMenuOpen(false)} aria-label="Close menu">×</button></div>
      <nav className="dock-nav" aria-label="Explore FUTO">
        <DockAction icon="walk" label="Explore" detail="Move around campus" onClick={()=>runWorldControl("camera")}/>
        <DockAction icon="map" label="Campus map" detail="View saved places" onClick={()=>{setMapOpen(true);setMenuOpen(false);}}/>
        <DockAction icon="pin" label={directoryOpen?"Hide places":"Campus directory"} detail={directoryOpen?"Collapse place list":"Search campus locations"} active={directoryOpen} onClick={()=>setDirectoryOpen(v=>!v)}/>
        <button className="dock-action" onClick={()=>{setNearbyOpen(true);setMenuOpen(false);}}><span className="game-dock-icon" aria-hidden="true">{nearbyPlayers.length?nearbyPlayers.length:"◎"}</span><span><b>Players nearby</b><small>{presenceStatus==="online"?`${nearbyPlayers.length} sharing in this area`:presenceStatus==="error"?"Live presence needs setup":"Live campus presence"}</small></span><span className="dock-arrow">›</span></button>
        {profile&&<button className="dock-action" onClick={()=>setShareCampusPosition((value)=>!value)} aria-pressed={shareCampusPosition}><span className={`game-dock-icon${shareCampusPosition?" presence-enabled":""}`} aria-hidden="true">{shareCampusPosition?"●":"○"}</span><span><b>{shareCampusPosition?"Position sharing on":"Appear on campus map"}</b><small>{shareCampusPosition?"Signed-in explorers can see your in-game location":"Opt in to appear to other signed-in explorers"}</small></span><span className="dock-arrow">{shareCampusPosition?"On":"Off"}</span></button>}
        <button className="dock-action" onClick={()=>{setGameHubOpen(true);setMenuOpen(false);}}><span className="game-dock-icon" aria-hidden="true">✦</span><span><b>Missions & rewards</b><small>XP, streaks and game coins</small></span><span className="dock-arrow">›</span></button>
        <Link className="dock-action" href="/community"><DockGlyph icon="people"/><span><b>Community</b><small>Friends, posts and messages</small></span><span className="dock-arrow">↗</span></Link>
        <NotificationCenter dock/>
        <button className="dock-action" onClick={()=>{setAccountOpen(true);setMenuOpen(false);}}><span className="dock-avatar">{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:profile?.display_name?.slice(0,1).toUpperCase()??"♙"}</span><span><b>{profile?.display_name??(email?"Finish profile":"Sign in")}</b><small>Account and profile</small></span><span className="dock-arrow">›</span></button>
        {isAdmin&&<Link className="dock-action" href="/admin"><DockGlyph icon="shield"/><span><b>Admin dashboard</b><small>Manage FUTO campus</small></span><span className="dock-arrow">↗</span></Link>}
      </nav>
      {directoryOpen&&<section className="dock-directory" aria-label="Campus directory"><div className="dock-directory-head"><div><span className="eyebrow">CAMPUS DIRECTORY</span><h2>Find a place</h2></div><button onClick={()=>setDirectoryOpen(false)} aria-label="Collapse directory">−</button></div><input className="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search halls, eateries…" aria-label="Search campus locations"/><div className="location-list" aria-live="polite">{visibleLocations.map(place=><button className="location-row" key={place.id} onClick={()=>{chooseLocation(place);if(window.matchMedia("(max-width:760px)").matches)setMenuOpen(false);}}><span className="location-thumb">{place.image_url?<img src={place.image_url} alt="" loading="lazy"/>:<span aria-hidden="true">{place.category==="lecture"?"⌂":place.category==="entrance"?"↗":"•"}</span>}</span><span className="location-row-copy"><span className="loc-name">{place.name}</span><br/><span className="loc-meta">{place.category.replaceAll("-"," ")}</span><br/><span className={`badge status-badge-${place.position_status??"unverified"}`}>{place.position_status==="provisional"?"Approximate position":place.position_status==="verified"?"Verified location":"Position unverified"}</span></span></button>)}{!visibleLocations.length&&<p className="panel-copy">No places match that search.</p>}</div><div className="locations-note"><span className="note-mark">i</span><span>{locationLoadError?"Live location data unavailable. ":locationSource==="supabase"?"Live location data connected. ":"Showing the available place list. "}Photos identify the place; map position confidence is shown separately.</span></div></section>}
      <div className="dock-controls"><span>CONTROLS</span><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move <kbd>⇧</kbd> Sprint</p><p><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> Look around</p><small>Touch: swipe to look, use the on-screen stick to move.</small></div>
    </aside>
    {selected&&<section className={`destination-preview${menuOpen?" behind-dock":""}`} aria-label={`Selected destination: ${selected.name}`}><button className="destination-close" onClick={()=>setSelected(null)} aria-label="Clear selected destination">×</button>{selected.image_url?<img className="destination-photo" src={selected.image_url} alt={`Photo reference for ${selected.name}`} loading="lazy"/>:<div className="destination-photo destination-photo-empty" aria-hidden="true">⌖</div>}<div className="destination-copy"><span className="destination-kicker">{selected.category.replaceAll("-"," ")} · {selected.position_status==="verified"?"Verified position":selected.position_status==="provisional"?"Approximate position":"Position unverified"}</span><h2>{selected.name}</h2><p>{selected.description||selected.notes||"Use this photo to recognize the place. Its map position may need confirmation."}</p><div className="destination-actions"><button className="destination-navigate" onClick={navigateToSelected} disabled={selected.position_status==="unverified"||typeof selected.local_x!=="number"||typeof selected.local_z!=="number"}>Navigate in campus view</button><button className="destination-map-link" onClick={()=>{setMapOpen(true);setMenuOpen(false);}}>Show map</button></div></div></section>}
    <GameHub open={gameHubOpen} signedIn={Boolean(email&&profile)} onRequireSignIn={()=>{setGameHubOpen(false);setAccountOpen(true);}} onClose={()=>setGameHubOpen(false)}/>
    {nearbyOpen&&<div className="nearby-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setNearbyOpen(false);}}><section className="nearby-dialog panel" role="dialog" aria-modal="true" aria-labelledby="nearby-title"><header className="map-header"><div><span className="eyebrow">LIVE CAMPUS PRESENCE</span><h2 id="nearby-title">Players nearby</h2></div><button className="secondary map-close" onClick={()=>setNearbyOpen(false)} aria-label="Close nearby players">×</button></header><p className="nearby-explainer">Only signed-in players who opted in to share their in-game position appear here. “Nearby” uses the current provisional game-world coordinates.</p>{presenceStatus==="error"&&<p className="nearby-status-error">Live players could not connect. Apply the campus presence migration and confirm Supabase Realtime is enabled.</p>}{nearbyPlayers.length?<div className="nearby-player-list">{nearbyPlayers.map((person)=><article className="nearby-player" key={person.id}>{person.avatar_url?<img src={person.avatar_url} alt=""/>:<span className="nearby-player-initial">{person.display_name.slice(0,1).toUpperCase()}</span>}<span><b>{person.display_name}</b><small>{person.riding?"Riding nearby":"Exploring nearby"}</small></span><i aria-label="Online"/> </article>)}</div>:<div className="nearby-empty"><b>{presenceStatus==="joining"?"Connecting to campus…":"No opted-in players nearby yet"}</b><span>Invite a friend to Explore and turn on position sharing in the campus menu.</span></div>}{profile?<button className="nearby-sharing-toggle" onClick={()=>setShareCampusPosition((value)=>!value)}>{shareCampusPosition?"Stop sharing my position":"Share my position while I Explore"}</button>:<button className="nearby-sharing-toggle" onClick={()=>{setNearbyOpen(false);setAccountOpen(true);}}>Sign in to see live campus players</button>}<span className="nearby-presence-state">Connection: {presenceStatus}</span></section></div>}
    {mapOpen && <div className="map-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMapOpen(false); }}><section className="map-dialog panel" role="dialog" aria-modal="true" aria-labelledby="map-title">
      <header className="map-header"><div><div className="eyebrow">Campus map</div><h2 id="map-title">Places with saved positions</h2></div><button className="secondary map-close" onClick={() => setMapOpen(false)} aria-label="Close campus map">×</button></header>
      <div className="schematic-map" role="img" aria-label="Schematic map showing campus locations that have saved local positions">
        <span className="north-marker" aria-hidden="true">N ↑</span>
        {plottedLocations.map(({ place, left, top }) => <button key={place.id} className={`map-marker status-${place.position_status ?? "unverified"}${selected?.id===place.id?" selected": ""}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => { chooseLocation(place); setMapOpen(false); setDirectoryOpen(true); if(window.matchMedia("(max-width:640px)").matches)setMenuOpen(true); }} aria-label={`${place.name}, ${place.position_status === "provisional" ? "estimated position" : place.position_status === "verified" ? "verified position" : "unverified position"}`} title={place.name}>{place.image_url?<img className="map-marker-photo" src={place.image_url} alt=""/>:<span className="map-marker-dot"/>}<span className="map-marker-name">{place.name}</span></button>)}
        {!plottedLocations.length && <p className="empty-map">No campus places have map positions yet.</p>}
      </div>
      <p className="map-caveat">Schematic positions only. This view does not imply surveyed roads, boundaries, building footprints, or verified directions.</p>
      {roadDraft && <section className="road-draft-card" aria-label="Provisional campus road trace preview"><div className="road-draft-heading"><div><span className="eyebrow">MASTER PLAN TRACE · REVIEW REQUIRED</span><h3>Draft campus road network</h3></div><span className="badge status-badge-provisional">12 provisional roads</span></div><DraftRoadMap roads={roadDraft.roads} playerPosition={currentWorldPosition}/><p className="map-caveat">{roadDraft.transform?.warning ?? "Road traces are provisional."} The road trace and live player dot share the prototype coordinate frame. Saved-place pins remain separate until their positions are reviewed.</p></section>}
      {campusLocations.some((place) => typeof place.local_x !== "number" || !Number.isFinite(place.local_x) || typeof place.local_z !== "number" || !Number.isFinite(place.local_z)) && <div className="unmapped-section"><h3>Not placed on this map yet</h3><div className="unmapped-list">{campusLocations.filter((place) => typeof place.local_x !== "number" || !Number.isFinite(place.local_x) || typeof place.local_z !== "number" || !Number.isFinite(place.local_z)).map((place) => <button key={place.id} className="unmapped-place" onClick={() => { chooseLocation(place); setMapOpen(false); setDirectoryOpen(true); if(window.matchMedia("(max-width:640px)").matches)setMenuOpen(true); }}><span>{place.name}</span><span className="loc-meta">Position needed</span></button>)}</div></div>}
    </section></div>}
    {accountOpen && <AccountDialog email={email} profile={profile} initialName={profileNameDraft} initialMessage={authNotice} initialReferralCode={initialReferralCode} redirectTo={authReturnTo||"/"} onClose={() => setAccountOpen(false)} onSignedIn={(userEmail, savedProfile) => { setEmail(userEmail); setProfile(savedProfile); setProfileNameDraft(""); setAuthNotice(""); setInitialReferralCode(""); setAccountOpen(false); if(userEmail&&authReturnTo)window.location.assign(authReturnTo); }} />}
  </main>;
}

function DraftRoadMap({ roads, playerPosition }: { roads: RoadDraft[]; playerPosition: WorldPosition }) {
  const [zoom,setZoom]=useState(1);
  const points = roads.flatMap((road) => road.coordinates);
  if (!points.length) return null;
  const xs = points.map(([x]) => x), zs = points.map(([, z]) => z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const pad = 24, width = 960, height = 460;
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxZ - minZ || 1));
  const ox = (width - (maxX - minX) * scale) / 2, oy = (height - (maxZ - minZ) * scale) / 2;
  const xy = ([x, z]: number[]) => `${ox + (x - minX) * scale},${oy + (z - minZ) * scale}`;
  const [px,py]=xy([playerPosition.x,playerPosition.z]).split(",");
  const playerVisible=playerPosition.x>=minX&&playerPosition.x<=maxX&&playerPosition.z>=minZ&&playerPosition.z<=maxZ;
  return <div className="road-draft-map"><div className="road-map-tools" aria-label="Map zoom controls"><button type="button" onClick={()=>setZoom(value=>Math.min(3,value*1.25))} aria-label="Zoom in">+</button><button type="button" onClick={()=>setZoom(value=>Math.max(1,value/1.25))} aria-label="Zoom out">−</button><button type="button" onClick={()=>setZoom(1)}>Reset</button><span>{Math.round(zoom*100)}%</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Twelve provisional road centerlines traced from the FUTO master plan image with the live player position" onWheel={event=>{event.preventDefault();setZoom(value=>Math.max(1,Math.min(3,value*(event.deltaY<0?1.12:1/1.12))))}}><g transform={`translate(${width/2} ${height/2}) scale(${zoom}) translate(${-width/2} ${-height/2})`} fill="none" strokeLinecap="round" strokeLinejoin="round"><g stroke="#d2c6a6" strokeWidth="12">{roads.map((road) => <polyline key={`base-${road.id}`} points={road.coordinates.map(xy).join(" ")}/>)}</g><g stroke="#806d58" strokeWidth="6">{roads.map((road) => <polyline key={road.id} points={road.coordinates.map(xy).join(" ")}/>)}</g><circle cx={xy([0, 0]).split(",")[0]} cy={xy([0, 0]).split(",")[1]} r="9" fill="#37d2b4" stroke="white" strokeWidth="4"/><text x={+xy([0,0]).split(",")[0]+14} y={+xy([0,0]).split(",")[1]-12} fill="#fff" fontSize="17" fontWeight="700">Trace origin · assumed</text>{playerVisible&&<g><circle cx={px} cy={py} r="15" fill="#53d8b6" opacity=".3"/><circle cx={px} cy={py} r="8" fill="#44e0bc" stroke="#fff" strokeWidth="3"/><text x={+px+12} y={+py+5} fill="#d8fff4" fontSize="16" fontWeight="800">YOU</text></g>}</g></svg></div>;
}

function DockGlyph({icon}:{icon:"walk"|"map"|"pin"|"people"|"shield"}) {
  return <svg className="dock-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon==="walk"?<><circle cx="13" cy="4" r="2"/><path d="m11 8-3 4 4 2 2 6m-6-8-3 5-3 1m8-8 4 2 3 1m-8 1-1 7"/></>:icon==="map"?<><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2z"/><path d="M8 4v13m8-10v13"/></>:icon==="pin"?<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>:icon==="people"?<><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1m1-12a3 3 0 0 1 0 6m1 2a5 5 0 0 1 4 5"/></>:<><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>}</svg>;
}

function DockAction({icon,label,detail,onClick,active=false}:{icon:"walk"|"map"|"pin";label:string;detail:string;onClick:()=>void;active?:boolean}) {
  return <button className={`dock-action${active?" active":""}`} onClick={onClick}><DockGlyph icon={icon}/><span><b>{label}</b><small>{detail}</small></span><span className="dock-arrow">›</span></button>;
}

function AccountDialog({ email: currentEmail, profile, initialName, initialMessage, initialReferralCode, redirectTo, onClose, onSignedIn }: { email: string | null; profile: Profile | null; initialName: string; initialMessage: string; initialReferralCode: string; redirectTo: string; onClose: () => void; onSignedIn: (email: string, profile: Profile | null) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<AuthMode>(currentEmail || initialReferralCode ? "signup" : "signin");
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode,setReferralCode] = useState(initialReferralCode);
  const [authenticated, setAuthenticated] = useState(Boolean(currentEmail));
  const [name, setName] = useState(profile?.display_name ?? initialName);
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [year, setYear] = useState(profile?.year_of_study ? String(profile.year_of_study) : "");
  const [memberType, setMemberType] = useState<"student"|"alumni"|"visitor">(profile?.member_type ?? "student");
  const [alumniSet, setAlumniSet] = useState(profile?.alumni_set ?? "");
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(initialMessage.startsWith("We couldn’t confirm"));
  useEffect(() => { if (message) notify(message); }, [message]);
  const hasSession = authenticated || Boolean(currentEmail);
  const showProfileFields = mode === "signup" || Boolean(currentEmail) || authenticated;

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setDepartment(profile.department ?? "");
      setYear(profile.year_of_study ? String(profile.year_of_study) : "");
      setMemberType(profile.member_type ?? "student");
      setAlumniSet(profile.alumni_set ?? "");
    } else if (initialName) setName((current) => current || initialName);
    if (initialMessage) setMessage(initialMessage);
  }, [initialMessage, initialName, profile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setMessage("Account sign-in is not connected yet. Add your Supabase project URL and public key to .env.local."); return; }
    setBusy(true); setMessage("");
    try {
      if (recoveringPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=%2Freset-password`,
        });
        if (error) throw error;
        await supabase.rpc("record_user_activity",{p_action:"auth.password_reset_requested",p_contact_email:email.trim()});
        setMessage("If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.");
        return;
      }
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (showProfileFields && memberType === "alumni" && !/^[0-9]{2}\/[0-9]{2}$/.test(alumniSet.trim())) throw new Error("Enter your alumni set as YY/YY, for example 23/24.");
      if (currentUser) setAuthenticated(true);
      if (mode === "signup") {
        if (!currentUser) {
          const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim(), referral_code: referralCode.trim().toLowerCase() || null, member_type: memberType, alumni_set: memberType === "alumni" ? alumniSet.trim() : null, department: department.trim() || null, year_of_study: memberType === "student" && year ? Number(year) : null }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` } });
          if (error) { void supabase.rpc("record_user_activity",{p_action:"auth.signup_failed",p_contact_email:email.trim()}).then(()=>{}); throw error; }
          if (!data.session) { setCanResendConfirmation(true); setMessage("Check your email to confirm your account. Your display name is saved; you can finish your profile after confirmation."); return; }
        }
      } else if (!currentUser) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { void supabase.rpc("record_user_activity",{p_action:"auth.login_failed",p_contact_email:email.trim()}).then(()=>{}); throw error; }
        await supabase.rpc("record_user_activity",{p_action:"auth.login"});
        setAuthenticated(true);
      }
      const existing = await fetch("/api/profile", { cache: "no-store" });
      const existingData = await existing.json();
      if (existing.ok && existingData.profile?.display_name && !currentEmail) { notify("You’re signed in. Welcome back!"); onSignedIn(email, existingData.profile); return; }
      if (mode === "signin" && !currentEmail) {
        const metadata = currentUser?.user_metadata ?? {};
        if (metadata.member_type === "alumni" || metadata.member_type === "visitor" || metadata.member_type === "student") setMemberType(metadata.member_type);
        if (typeof metadata.alumni_set === "string") setAlumniSet(metadata.alumni_set);
        if (typeof metadata.department === "string") setDepartment(metadata.department);
        if (typeof metadata.year_of_study === "number") setYear(String(metadata.year_of_study));
        setMode("signup");
        setMessage("You’re signed in. Finish setting up your profile.");
        return;
      }
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name.trim(), department, member_type: memberType, alumni_set: alumniSet.trim(), year_of_study: memberType === "student" && year ? Number(year) : null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save profile.");
      notify("Your FUTO Life profile is ready.");
      onSignedIn(email, result.profile);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (supabase) { await supabase.rpc("record_user_activity",{p_action:"auth.logout"}); await supabase.auth.signOut(); }
    onSignedIn("", null); onClose();
  }

  async function resendConfirmation() {
    if (!supabase || !email.trim()) { setMessage("Enter the email address you used to sign up."); return; }
    setResendBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` } });
      if (error) throw error;
      setMessage("Confirmation email sent. Check your inbox and spam folder.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to resend the confirmation email."); }
    finally { setResendBusy(false); }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
    <div className="eyebrow">Your FUTO Life account</div><h2 id="account-title">{recoveringPassword ? "Reset your password" : hasSession ? (profile ? "Edit your profile" : "Complete your profile") : mode === "signin" ? "Welcome back" : "Join FUTO Life"}</h2>
    <p>Save your profile and make your campus experience yours. Connect with classmates through FUTO Life.</p>
    {!supabase && <p className="error">Supabase credentials are not configured yet. Guest campus exploration is available.</p>}
    <form className="form" onSubmit={submit}>
      <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" readOnly={hasSession} /></label>
      {!hasSession && !recoveringPassword && <label className="field">Password<div className="password-control"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} /><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <FiEyeOff/> : <FiEye/>}</button></div></label>}
      {!hasSession && mode === "signup" && <label className="field">Referral code (optional)<input value={referralCode} onChange={e=>setReferralCode(e.target.value.trim())} maxLength={40} autoComplete="off" placeholder="Enter a classmate’s referral code"/></label>}
      {showProfileFields && <>
        <label className="field">Display name<input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={48} required /></label>
        <label className="field">Department (optional)<input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={80} placeholder="e.g. Computer Science" /></label>
        <label className="field">I am a<select value={memberType} onChange={e=>setMemberType(e.target.value as "student"|"alumni"|"visitor")}><option value="student">Current student</option><option value="alumni">FUTO alumni</option><option value="visitor">Visitor / guest</option></select></label>
        {memberType === "student" && <label className="field">Year of study (optional)<select value={year} onChange={(e) => setYear(e.target.value)}><option value="">Choose year</option>{[1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
        {memberType === "alumni" && <label className="field">Graduation set<input value={alumniSet} onChange={e=>setAlumniSet(e.target.value)} placeholder="23/24" pattern="[0-9]{2}/[0-9]{2}" title="Use YY/YY, for example 23/24" required/><small className="field-help">Enter your set as YY/YY. It will appear as “Alumni - 23/24 set”.</small></label>}
      </>}
      <button className="primary" disabled={busy || !supabase}>{busy ? "Please wait…" : recoveringPassword ? "Send reset link" : hasSession ? "Save profile" : mode === "signin" ? "Sign in" : "Create account"}</button>
      {canResendConfirmation && <button className="secondary" type="button" disabled={resendBusy || !supabase} onClick={() => void resendConfirmation()}>{resendBusy ? "Sending…" : "Resend confirmation email"}</button>}
    </form>
    {!hasSession && <div className="actions-row"><button className="secondary" onClick={() => { setRecoveringPassword(false); setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{recoveringPassword ? "Back to sign in" : mode === "signin" ? "Create an account" : "I already have an account"}</button>{!recoveringPassword && mode === "signin" && <button className="text-action" type="button" onClick={() => { setRecoveringPassword(true); setMessage(""); }}>Forgot password?</button>}<button className="secondary" onClick={onClose}>Explore as guest</button></div>}
    {hasSession && <div className="actions-row"><button className="secondary" onClick={signOut}>Sign out</button><button className="secondary" onClick={onClose}>Close</button></div>}
  </section></div>;
}
