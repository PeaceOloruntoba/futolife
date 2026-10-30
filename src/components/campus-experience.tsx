"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { locations, type CampusLocation } from "@/lib/locations";
import { createClient } from "@/lib/supabase/browser";

type Profile = { id: string; display_name: string; department: string | null; year_of_study: number | null; avatar_url: string | null };
type AuthMode = "signin" | "signup";

export default function CampusExperience() {
  const worldFrame = useRef<HTMLIFrameElement>(null);
  const [campusLocations, setCampusLocations] = useState<CampusLocation[]>(locations);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CampusLocation | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const visibleLocations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return campusLocations.filter((item) => !term || `${item.name} ${item.category}`.toLowerCase().includes(term));
  }, [campusLocations, query]);

  function chooseLocation(place: CampusLocation) {
    setSelected(place);
    if (typeof place.local_x === "number" && typeof place.local_z === "number") {
      worldFrame.current?.contentWindow?.postMessage({ type: "futo:walk-to", x: place.local_x, z: place.local_z }, window.location.origin);
    }
  }

  function openWorldMap() {
    worldFrame.current?.contentWindow?.postMessage({ type: "futo:open-map" }, window.location.origin);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/locations", { cache: "no-store" }).then((response) => response.json()).then((result) => {
      if (active && Array.isArray(result.locations)) setCampusLocations(result.locations);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let active = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      setEmail(user.email ?? null);
      const response = await fetch("/api/profile", { cache: "no-store" });
      const result = await response.json();
      if (active && response.ok && result.profile?.display_name) setProfile(result.profile);
      else if (active) setAccountOpen(true);
    };
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setEmail(session?.user.email ?? null);
      if (!session) setProfile(null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return <main className="campus">
    <iframe ref={worldFrame} className="world" src="/campus/index.html" title="Interactive FUTO campus prototype" allow="fullscreen" />
    <header className="topbar">
      <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">FUTO LIFE</div><div className="brand-sub">Explore your campus. Find your people.</div></div></div>
      <div className="top-actions">
        <button className="glass" onClick={() => setSelected(null)} title="Explore the 3D campus">Explore</button>
        <button className="glass" onClick={openWorldMap} title="Open the campus map">Map</button>
        <button className="glass user-chip" onClick={() => setAccountOpen(true)}><span className="avatar-dot">{profile?.display_name?.[0]?.toUpperCase() ?? "●"}</span>{profile?.display_name ?? (email ? "Finish profile" : "Sign in")}</button>
      </div>
    </header>
    <aside className="locations panel">
      <div className="panel-head">
        <div className="eyebrow">Campus directory</div><div className="panel-title">Find a place</div>
        <div className="panel-copy">Explore the campus prototype and browse the current location inventory. Estimated positions are labelled.</div>
        <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search buildings, halls, facilities…" aria-label="Search campus locations" />
      </div>
      <div className="location-list" aria-live="polite">
        {visibleLocations.map((place) => <button className="location-row" key={place.id} onClick={() => chooseLocation(place)}>
          <span className="loc-icon">{place.category === "lecture" ? "⌂" : place.category === "entrance" ? "↗" : "•"}</span>
          <span><span className="loc-name">{place.name}</span><br/><span className="loc-meta">{place.category.replaceAll("-", " ")}</span><br/><span className="badge">{place.position_status === "provisional" ? "Estimated position" : place.position_status === "verified" ? "Verified location" : "Location unverified"}</span></span>
        </button>)}
        {visibleLocations.length === 0 && <p className="panel-copy" style={{ padding: 10 }}>No locations match that search.</p>}
      </div>
      {profile && <div className="profile-card"><div className="profile-name">{profile.display_name}</div><div className="profile-email">{[profile.department, profile.year_of_study ? `Year ${profile.year_of_study}` : null].filter(Boolean).join(" · ") || email}</div></div>}
    </aside>
    {selected && <section className="status panel" role="status"><button className="glass" style={{ float: "right", padding: "4px 8px" }} onClick={() => setSelected(null)} aria-label="Close location details">×</button><strong>{selected.name}</strong><br/>{selected.category.replaceAll("-", " ")} · <span style={{ color: "#f1c46f" }}>{selected.position_status === "provisional" ? "Estimated position" : selected.position_status === "verified" ? "Verified" : "Unverified"}</span><br/><span style={{ color: "#a5ab9f" }}>{selected.description || selected.notes || selected.implementation || "Details and map position need confirmation."}</span></section>}
    <div className="status panel"><strong>Early access prototype</strong><br/>Map positions and several campus details are provisional. Help us verify FUTO as we build.</div>
    {accountOpen && <AccountDialog email={email} onClose={() => setAccountOpen(false)} onSignedIn={(userEmail, savedProfile) => { setEmail(userEmail); setProfile(savedProfile); setAccountOpen(false); }} />}
  </main>;
}

function AccountDialog({ email: currentEmail, onClose, onSignedIn }: { email: string | null; onClose: () => void; onSignedIn: (email: string, profile: Profile | null) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<AuthMode>(currentEmail ? "signup" : "signin");
  const [email, setEmail] = useState(currentEmail ?? "");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(Boolean(currentEmail));
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const hasSession = authenticated || Boolean(currentEmail);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setMessage("Account sign-in is not connected yet. Add your Supabase project URL and public key to .env.local."); return; }
    setBusy(true); setMessage("");
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) setAuthenticated(true);
      if (mode === "signup") {
        if (!currentUser) {
          const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
          if (error) throw error;
          if (!data.session) { setMessage("Check your email to confirm your account, then sign in to finish your profile."); return; }
        }
      } else if (!currentUser) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthenticated(true);
      }
      const existing = await fetch("/api/profile", { cache: "no-store" });
      const existingData = await existing.json();
      if (existing.ok && existingData.profile?.display_name) { onSignedIn(email, existingData.profile); return; }
      if (mode === "signin" && !name.trim()) {
        setMode("signup");
        setMessage("You’re signed in. Add a display name to finish setting up your profile.");
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

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
    <div className="eyebrow">Your FUTO Life account</div><h2 id="account-title">{currentEmail ? "Set up your profile" : mode === "signin" ? "Welcome back" : "Join FUTO Life"}</h2>
    <p>Save your profile and make your campus experience yours. Social features will arrive in later releases.</p>
    {!supabase && <p className="error">Supabase credentials are not configured yet. Guest campus exploration is available.</p>}
    <form className="form" onSubmit={submit}>
      <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      {!hasSession && <label className="field">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>}
      {(mode === "signup" || currentEmail) && <>
        <label className="field">Display name<input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={48} required /></label>
        <label className="field">Department (optional)<input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={80} placeholder="e.g. Computer Science" /></label>
        <label className="field">Year of study (optional)<select value={year} onChange={(e) => setYear(e.target.value)} className="field input" style={{ background: "#10120f", color: "white", border: "1px solid #3b4037", borderRadius: 10, padding: 11 }}><option value="">Choose year</option>{[1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      </>}
      {message && <p className={message.startsWith("Check your email") ? "panel-copy" : "error"} role="status">{message}</p>}
      <button className="primary" disabled={busy || !supabase}>{busy ? "Please wait…" : currentEmail ? "Save profile" : mode === "signin" ? "Sign in" : "Create account"}</button>
    </form>
    {!currentEmail && <div className="actions-row"><button className="secondary" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "Create an account" : "I already have an account"}</button><button className="secondary" onClick={onClose}>Explore as guest</button></div>}
    {currentEmail && <div className="actions-row"><button className="secondary" onClick={signOut}>Sign out</button><button className="secondary" onClick={onClose}>Close</button></div>}
  </section></div>;
}
