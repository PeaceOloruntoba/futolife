"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { locations, type CampusLocation } from "@/lib/locations";
import { createClient } from "@/lib/supabase/browser";

type Profile = { id: string; display_name: string; department: string | null; year_of_study: number | null; avatar_url: string | null };
type AuthMode = "signin" | "signup";

export default function CampusExperience() {
  const worldFrame = useRef<HTMLIFrameElement>(null);
  const [campusLocations, setCampusLocations] = useState<CampusLocation[]>(locations);
  const [query, setQuery] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(true);
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

  function runWorldControl(control: "camera" | "map" | "near" | "data") {
    if (control !== "camera" && window.matchMedia("(max-width: 760px)").matches) setDirectoryOpen(false);
    worldFrame.current?.contentWindow?.postMessage({ type: `futo:${control}` }, window.location.origin);
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
        <IconButton label="Switch camera view" onClick={() => runWorldControl("camera")}><path d="M3 7.5h3l1.5-2h5l1.5 2h3v9H3z"/><circle cx="10" cy="12" r="3"/></IconButton>
        <IconButton label="Open campus map" onClick={() => runWorldControl("map")}><path d="m3 6 5-2 5 2 4-2v12l-4 2-5-2-5 2z"/><path d="M8 4v12m5-10v12"/></IconButton>
        <IconButton label="Nearby campus activity" onClick={() => runWorldControl("near")}><circle cx="8" cy="8" r="2.5"/><circle cx="14.5" cy="9" r="2"/><path d="M3.5 17c.5-2.4 2-3.5 4.5-3.5s4 1.1 4.5 3.5m.3-3.3c2.2-.4 4.1.6 4.7 2.8"/></IconButton>
        <IconButton label="Campus data tools" onClick={() => runWorldControl("data")}><ellipse cx="10" cy="5" rx="6.5" ry="2.5"/><path d="M3.5 5v5c0 1.4 2.9 2.5 6.5 2.5 1.7 0 3.2-.3 4.5-.8M3.5 10v5c0 1.4 2.9 2.5 6.5 2.5 1.1 0 2.1-.1 3-.4"/><path d="M14 13v6m-3-3h6"/></IconButton>
        <button className="glass user-chip" onClick={() => setAccountOpen(true)} aria-label={profile?.display_name ?? (email ? "Finish profile" : "Sign in")} title={profile?.display_name ?? (email ? "Finish profile" : "Sign in")}><span className="avatar-dot">{profile?.display_name?.[0]?.toUpperCase() ?? "♙"}</span></button>
      </div>
    </header>
    {!directoryOpen && <button className="places-toggle glass" onClick={() => setDirectoryOpen(true)} aria-label="Show places directory" title="Show places directory"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="10" cy="8" r="2"/></svg><span>Places</span></button>}
    <aside className={`locations panel${directoryOpen ? "" : " is-closed"}`}>
      <div className="panel-head">
        <div className="eyebrow">Campus directory</div><div className="panel-title">Find a place</div>
        <div className="panel-copy">Explore the campus prototype and browse the current location inventory. Estimated positions are labelled.</div>
        <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search buildings, halls, facilities…" aria-label="Search campus locations" />
      </div>
      {selected && <div className="selected-place"><div className="selected-place-title">{selected.name}</div><div className="loc-meta">{selected.category.replaceAll("-", " ")} · {selected.position_status === "provisional" ? "Estimated position" : selected.position_status === "verified" ? "Verified" : "Unverified"}</div><div className="selected-place-copy">{selected.description || selected.notes || "Details and map position need confirmation."}</div><button className="clear-place" onClick={() => setSelected(null)}>Clear selection</button></div>}
      <div className="location-list" aria-live="polite">
        {visibleLocations.map((place) => <button className="location-row" key={place.id} onClick={() => chooseLocation(place)}>
          <span className="loc-icon">{place.category === "lecture" ? "⌂" : place.category === "entrance" ? "↗" : "•"}</span>
          <span><span className="loc-name">{place.name}</span><br/><span className="loc-meta">{place.category.replaceAll("-", " ")}</span><br/><span className="badge">{place.position_status === "provisional" ? "Estimated position" : place.position_status === "verified" ? "Verified location" : "Location unverified"}</span></span>
        </button>)}
        {visibleLocations.length === 0 && <p className="panel-copy" style={{ padding: 10 }}>No locations match that search.</p>}
      </div>
      {profile && <div className="profile-card"><div className="profile-name">{profile.display_name}</div><div className="profile-email">{[profile.department, profile.year_of_study ? `Year ${profile.year_of_study}` : null].filter(Boolean).join(" · ") || email}</div></div>}
      <div className="locations-note"><span className="note-mark">i</span><span>Map positions are provisional until verified against reliable FUTO sources.</span></div>
    </aside>
    {accountOpen && <AccountDialog email={email} onClose={() => setAccountOpen(false)} onSignedIn={(userEmail, savedProfile) => { setEmail(userEmail); setProfile(savedProfile); setAccountOpen(false); }} />}
  </main>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button className="icon-button" onClick={onClick} aria-label={label} title={label} type="button"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg><span className="sr-only">{label}</span></button>;
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
