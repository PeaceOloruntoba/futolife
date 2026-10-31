"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [selected, setSelected] = useState<CampusLocation | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [authNotice, setAuthNotice] = useState("");

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

  function runWorldControl(control: "camera" | "map" | "directory" | "data") {
    if (control === "map") {
      setMapOpen((open) => !open);
      if (window.matchMedia("(max-width: 760px)").matches) setDirectoryOpen(false);
      return;
    }
    if (control === "directory") {
      setDirectoryOpen((open) => !open);
      return;
    }
    if (control !== "camera" && window.matchMedia("(max-width: 760px)").matches) setDirectoryOpen(false);
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
    if (params.get("auth") === "confirmation-error") {
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

  useEffect(() => {
    if (!accountOpen && !mapOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setAccountOpen(false); setMapOpen(false); }
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
        <IconButton label="Toggle places directory" onClick={() => runWorldControl("directory")}><path d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="10" cy="8" r="2"/></IconButton>
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
      <div className="locations-note"><span className="note-mark">i</span><span>{locationLoadError ? "Live inventory is unavailable; showing the bundled location list. " : locationSource === "supabase" ? "Live location inventory connected. " : "Showing the bundled location list. "}Map positions are provisional until verified against reliable FUTO sources.</span></div>
    </aside>
    {mapOpen && <div className="map-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMapOpen(false); }}><section className="map-dialog panel" role="dialog" aria-modal="true" aria-labelledby="map-title">
      <header className="map-header"><div><div className="eyebrow">Campus map</div><h2 id="map-title">Places with saved positions</h2></div><button className="secondary map-close" onClick={() => setMapOpen(false)} aria-label="Close campus map">×</button></header>
      <div className="schematic-map" role="img" aria-label="Schematic map showing campus locations that have saved local positions">
        <span className="north-marker" aria-hidden="true">N ↑</span>
        {plottedLocations.map(({ place, left, top }) => <button key={place.id} className={`map-marker status-${place.position_status ?? "unverified"}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => { chooseLocation(place); setMapOpen(false); setDirectoryOpen(true); }} aria-label={`${place.name}, ${place.position_status === "provisional" ? "estimated position" : place.position_status === "verified" ? "verified position" : "unverified position"}`} title={place.name}><span className="map-marker-dot"/><span className="map-marker-name">{place.name}</span></button>)}
        {!plottedLocations.length && <p className="empty-map">No campus places have map positions yet.</p>}
      </div>
      <p className="map-caveat">Schematic positions only. This view does not imply surveyed roads, boundaries, building footprints, or verified directions.</p>
      {campusLocations.some((place) => typeof place.local_x !== "number" || !Number.isFinite(place.local_x) || typeof place.local_z !== "number" || !Number.isFinite(place.local_z)) && <div className="unmapped-section"><h3>Not placed on this map yet</h3><div className="unmapped-list">{campusLocations.filter((place) => typeof place.local_x !== "number" || !Number.isFinite(place.local_x) || typeof place.local_z !== "number" || !Number.isFinite(place.local_z)).map((place) => <button key={place.id} className="unmapped-place" onClick={() => { chooseLocation(place); setMapOpen(false); setDirectoryOpen(true); }}><span>{place.name}</span><span className="loc-meta">Position needed</span></button>)}</div></div>}
    </section></div>}
    {accountOpen && <AccountDialog email={email} profile={profile} initialName={profileNameDraft} initialMessage={authNotice} onClose={() => setAccountOpen(false)} onSignedIn={(userEmail, savedProfile) => { setEmail(userEmail); setProfile(savedProfile); setProfileNameDraft(""); setAuthNotice(""); setAccountOpen(false); }} />}
  </main>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button className="icon-button" onClick={onClick} aria-label={label} title={label} type="button"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg><span className="sr-only">{label}</span></button>;
}

function AccountDialog({ email: currentEmail, profile, initialName, initialMessage, onClose, onSignedIn }: { email: string | null; profile: Profile | null; initialName: string; initialMessage: string; onClose: () => void; onSignedIn: (email: string, profile: Profile | null) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<AuthMode>(currentEmail ? "signup" : "signin");
  const [email, setEmail] = useState(currentEmail ?? "");
  const [password, setPassword] = useState("");
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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) setAuthenticated(true);
      if (mode === "signup") {
        if (!currentUser) {
          const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
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
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
      setMessage("Confirmation email sent. Check your inbox and spam folder.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to resend the confirmation email."); }
    finally { setResendBusy(false); }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
    <div className="eyebrow">Your FUTO Life account</div><h2 id="account-title">{hasSession ? (profile ? "Edit your profile" : "Complete your profile") : mode === "signin" ? "Welcome back" : "Join FUTO Life"}</h2>
    <p>Save your profile and make your campus experience yours. Social features will arrive in later releases.</p>
    {!supabase && <p className="error">Supabase credentials are not configured yet. Guest campus exploration is available.</p>}
    <form className="form" onSubmit={submit}>
      <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" readOnly={hasSession} /></label>
      {!hasSession && <label className="field">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>}
      {showProfileFields && <>
        <label className="field">Display name<input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={48} required /></label>
        <label className="field">Department (optional)<input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={80} placeholder="e.g. Computer Science" /></label>
        <label className="field">Year of study (optional)<select value={year} onChange={(e) => setYear(e.target.value)} className="field input" style={{ background: "#10120f", color: "white", border: "1px solid #3b4037", borderRadius: 10, padding: 11 }}><option value="">Choose year</option>{[1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      </>}
      {message && <p className={message.startsWith("Check your email") || message.startsWith("Confirmation email sent") ? "panel-copy" : "error"} role="status">{message}</p>}
      <button className="primary" disabled={busy || !supabase}>{busy ? "Please wait…" : hasSession ? "Save profile" : mode === "signin" ? "Sign in" : "Create account"}</button>
      {canResendConfirmation && <button className="secondary" type="button" disabled={resendBusy || !supabase} onClick={() => void resendConfirmation()}>{resendBusy ? "Sending…" : "Resend confirmation email"}</button>}
    </form>
    {!hasSession && <div className="actions-row"><button className="secondary" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "Create an account" : "I already have an account"}</button><button className="secondary" onClick={onClose}>Explore as guest</button></div>}
    {hasSession && <div className="actions-row"><button className="secondary" onClick={signOut}>Sign out</button><button className="secondary" onClick={onClose}>Close</button></div>}
  </section></div>;
}
