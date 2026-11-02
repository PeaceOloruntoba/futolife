"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { locations, type CampusLocation } from "@/lib/locations";
import { createClient } from "@/lib/supabase/browser";

type Profile = { id: string; display_name: string; department: string | null; year_of_study: number | null; avatar_url: string | null };
type AuthMode = "signin" | "signup";

export default function CampusExperience() {
  const worldFrame = useRef<HTMLIFrameElement>(null);
  const [campusLocations, setCampusLocations] = useState<CampusLocation[]>(locations);
  const [locationSource, setLocationSource] = useState<"bundled" | "supabase">("bundled");
  const [locationLoadError, setLocationLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [menuOpen,setMenuOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
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
    if (typeof place.local_x === "number" && typeof place.local_z === "number") {
      worldFrame.current?.contentWindow?.postMessage({ type: "futo:walk-to", x: place.local_x, z: place.local_z }, window.location.origin);
    }
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
    void fetch("/api/locations", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Location inventory request failed.");
      return response.json();
    }).then((result) => {
      if (!active || !Array.isArray(result.locations)) return;
      setCampusLocations(result.locations);
      setLocationSource(result.source === "supabase" ? "supabase" : "bundled");
      setLocationLoadError(false);
    }).catch(() => { if (active) setLocationLoadError(true); });
    return () => { active = false; };
  }, []);

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
      if (!event.data || typeof event.data !== "object" || !("type" in event.data) || event.data.type !== "futo:open-map") return;
      setMapOpen(true);
      if (window.matchMedia("(max-width: 760px)").matches) setDirectoryOpen(false);
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
      if (!session) { setProfile(null); setIsAdmin(false); }
      else void supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle().then(({ data }) => { if (active) setIsAdmin(Boolean(data)); });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return <main className="campus">
    <iframe ref={worldFrame} className="world" src="/campus/index.html" title="Interactive FUTO campus prototype" allow="fullscreen" />
    <Link href="/" className="campus-brand"><span className="brand-mark">F</span><span><b>FUTO LIFE</b><small>Explore your campus</small></span></Link>
    <button className={`dock-menu-toggle${menuOpen?" active":""}`} onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-label={menuOpen?"Close campus menu":"Open campus menu"}><span>{menuOpen?"×":"☰"}</span><b>{menuOpen?"Close":"Menu"}</b></button>
    <aside className={`experience-dock${menuOpen?" drawer-open":""}`} aria-label="Campus menu">
      <div className="dock-heading"><div><span className="eyebrow">FUTO LIFE</span><b>Campus explorer</b></div><button className="dock-dismiss" onClick={()=>setMenuOpen(false)} aria-label="Close menu">×</button></div>
      <nav className="dock-nav" aria-label="Explore FUTO">
        <DockAction icon="walk" label="Explore" detail="Move around campus" onClick={()=>runWorldControl("camera")}/>
        <DockAction icon="map" label="Campus map" detail="View saved places" onClick={()=>{setMapOpen(true);setMenuOpen(false);}}/>
        <DockAction icon="pin" label={directoryOpen?"Hide places":"Campus directory"} detail={directoryOpen?"Collapse place list":"Search campus locations"} active={directoryOpen} onClick={()=>setDirectoryOpen(v=>!v)}/>
        <Link className="dock-action" href="/community"><DockGlyph icon="people"/><span><b>Community</b><small>Friends, posts and messages</small></span><span className="dock-arrow">↗</span></Link>
        <button className="dock-action" onClick={()=>{setAccountOpen(true);setMenuOpen(false);}}><span className="dock-avatar">{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:profile?.display_name?.slice(0,1).toUpperCase()??"♙"}</span><span><b>{profile?.display_name??(email?"Finish profile":"Sign in")}</b><small>Account and profile</small></span><span className="dock-arrow">›</span></button>
        {isAdmin&&<Link className="dock-action" href="/admin"><DockGlyph icon="shield"/><span><b>Admin dashboard</b><small>Manage FUTO campus</small></span><span className="dock-arrow">↗</span></Link>}
      </nav>
      {directoryOpen&&<section className="dock-directory" aria-label="Campus directory"><div className="dock-directory-head"><div><span className="eyebrow">CAMPUS DIRECTORY</span><h2>Find a place</h2></div><button onClick={()=>setDirectoryOpen(false)} aria-label="Collapse directory">−</button></div><input className="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search halls, eateries…" aria-label="Search campus locations"/><div className="location-list" aria-live="polite">{visibleLocations.map(place=><button className="location-row" key={place.id} onClick={()=>{chooseLocation(place);if(window.matchMedia("(max-width:760px)").matches)setMenuOpen(false);}}><span className="loc-icon">{place.category==="lecture"?"⌂":place.category==="entrance"?"↗":"•"}</span><span><span className="loc-name">{place.name}</span><br/><span className="loc-meta">{place.category.replaceAll("-"," ")}</span><br/><span className="badge">{place.position_status==="provisional"?"Estimated position":place.position_status==="verified"?"Verified location":"Location unverified"}</span></span></button>)}{!visibleLocations.length&&<p className="panel-copy">No places match that search.</p>}</div>{selected&&<div className="selected-place">{selected.image_url&&<img className="selected-place-image" src={selected.image_url} alt={`Photo of ${selected.name}`}/>}<b>{selected.name}</b><span>{selected.description||selected.notes||"Details and map position need confirmation."}</span></div>}<div className="locations-note"><span className="note-mark">i</span><span>{locationLoadError?"Live location data unavailable. ":locationSource==="supabase"?"Live location data connected. ":"Showing the available place list. "}Map positions may be provisional or unverified.</span></div></section>}
      <div className="dock-controls"><span>CONTROLS</span><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move <kbd>⇧</kbd> Sprint</p><p><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> Look around</p><small>Touch: swipe to look, use the on-screen stick to move.</small></div>
    </aside>
    {mapOpen && <div className="map-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMapOpen(false); }}><section className="map-dialog panel" role="dialog" aria-modal="true" aria-labelledby="map-title">
      <header className="map-header"><div><div className="eyebrow">Campus map</div><h2 id="map-title">Places with saved positions</h2></div><button className="secondary map-close" onClick={() => setMapOpen(false)} aria-label="Close campus map">×</button></header>
      <div className="schematic-map" role="img" aria-label="Schematic map showing campus locations that have saved local positions">
        <span className="north-marker" aria-hidden="true">N ↑</span>
        {plottedLocations.map(({ place, left, top }) => <button key={place.id} className={`map-marker status-${place.position_status ?? "unverified"}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => { chooseLocation(place); setMapOpen(false); setDirectoryOpen(true); if(window.matchMedia("(max-width:640px)").matches)setMenuOpen(true); }} aria-label={`${place.name}, ${place.position_status === "provisional" ? "estimated position" : place.position_status === "verified" ? "verified position" : "unverified position"}`} title={place.name}><span className="map-marker-dot"/><span className="map-marker-name">{place.name}</span></button>)}
        {!plottedLocations.length && <p className="empty-map">No campus places have map positions yet.</p>}
      </div>
      <p className="map-caveat">Schematic positions only. This view does not imply surveyed roads, boundaries, building footprints, or verified directions.</p>
      {campusLocations.some((place) => typeof place.local_x !== "number" || !Number.isFinite(place.local_x) || typeof place.local_z !== "number" || !Number.isFinite(place.local_z)) && <div className="unmapped-section"><h3>Not placed on this map yet</h3><div className="unmapped-list">{campusLocations.filter((place) => typeof place.local_x !== "number" || !Number.isFinite(place.local_x) || typeof place.local_z !== "number" || !Number.isFinite(place.local_z)).map((place) => <button key={place.id} className="unmapped-place" onClick={() => { chooseLocation(place); setMapOpen(false); setDirectoryOpen(true); if(window.matchMedia("(max-width:640px)").matches)setMenuOpen(true); }}><span>{place.name}</span><span className="loc-meta">Position needed</span></button>)}</div></div>}
    </section></div>}
    {accountOpen && <AccountDialog email={email} profile={profile} initialName={profileNameDraft} initialMessage={authNotice} initialReferralCode={initialReferralCode} redirectTo={authReturnTo||"/"} onClose={() => setAccountOpen(false)} onSignedIn={(userEmail, savedProfile) => { setEmail(userEmail); setProfile(savedProfile); setProfileNameDraft(""); setAuthNotice(""); setInitialReferralCode(""); setAccountOpen(false); if(userEmail&&authReturnTo)window.location.assign(authReturnTo); }} />}
  </main>;
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
  const [referralCode,setReferralCode] = useState(initialReferralCode);
  const [authenticated, setAuthenticated] = useState(Boolean(currentEmail));
  const [name, setName] = useState(profile?.display_name ?? initialName);
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [year, setYear] = useState(profile?.year_of_study ? String(profile.year_of_study) : "");
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(initialMessage.startsWith("We couldn’t confirm"));
  const hasSession = authenticated || Boolean(currentEmail);
  const showProfileFields = mode === "signup" || Boolean(currentEmail) || authenticated;

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setDepartment(profile.department ?? "");
      setYear(profile.year_of_study ? String(profile.year_of_study) : "");
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
        setMessage("If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.");
        return;
      }
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) setAuthenticated(true);
      if (mode === "signup") {
        if (!currentUser) {
          const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim(), referral_code: referralCode.trim().toLowerCase() || null }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` } });
          if (error) throw error;
          if (!data.session) { setCanResendConfirmation(true); setMessage("Check your email to confirm your account. Your display name is saved; you can finish your profile after confirmation."); return; }
        }
      } else if (!currentUser) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthenticated(true);
      }
      const existing = await fetch("/api/profile", { cache: "no-store" });
      const existingData = await existing.json();
      if (existing.ok && existingData.profile?.display_name && !currentEmail) { onSignedIn(email, existingData.profile); return; }
      if (mode === "signin" && !currentEmail) {
        setMode("signup");
        setMessage("You’re signed in. Finish setting up your profile.");
        return;
      }
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name.trim(), department, year_of_study: year ? Number(year) : null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save profile.");
      onSignedIn(email, result.profile);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
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
      {!hasSession && !recoveringPassword && <label className="field">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>}
      {!hasSession && mode === "signup" && <label className="field">Referral code (optional)<input value={referralCode} onChange={e=>setReferralCode(e.target.value.trim())} maxLength={40} autoComplete="off" placeholder="Enter a classmate’s referral code"/></label>}
      {showProfileFields && <>
        <label className="field">Display name<input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={48} required /></label>
        <label className="field">Department (optional)<input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={80} placeholder="e.g. Computer Science" /></label>
        <label className="field">Year of study (optional)<select value={year} onChange={(e) => setYear(e.target.value)} className="field input" style={{ background: "#10120f", color: "white", border: "1px solid #3b4037", borderRadius: 10, padding: 11 }}><option value="">Choose year</option>{[1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      </>}
      {message && <p className={message.startsWith("Check your email") || message.startsWith("Confirmation email sent") || message.startsWith("If an account exists") ? "panel-copy" : "error"} role="status">{message}</p>}
      <button className="primary" disabled={busy || !supabase}>{busy ? "Please wait…" : recoveringPassword ? "Send reset link" : hasSession ? "Save profile" : mode === "signin" ? "Sign in" : "Create account"}</button>
      {canResendConfirmation && <button className="secondary" type="button" disabled={resendBusy || !supabase} onClick={() => void resendConfirmation()}>{resendBusy ? "Sending…" : "Resend confirmation email"}</button>}
    </form>
    {!hasSession && <div className="actions-row"><button className="secondary" onClick={() => { setRecoveringPassword(false); setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{recoveringPassword ? "Back to sign in" : mode === "signin" ? "Create an account" : "I already have an account"}</button>{!recoveringPassword && mode === "signin" && <button className="text-action" type="button" onClick={() => { setRecoveringPassword(true); setMessage(""); }}>Forgot password?</button>}<button className="secondary" onClick={onClose}>Explore as guest</button></div>}
    {hasSession && <div className="actions-row"><button className="secondary" onClick={signOut}>Sign out</button><button className="secondary" onClick={onClose}>Close</button></div>}
  </section></div>;
}
