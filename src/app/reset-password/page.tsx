"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { SiteFrame } from "@/components/site-frame";
import { notify } from "@/lib/notify";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (message) notify(message); }, [message]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setReady(Boolean(data.session));
        if (!data.session) setMessage("This password reset link is invalid or has expired. Request a new one from sign in.");
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        setReady(true);
        setMessage("");
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !ready) return;
    if (password.length < 8) { setMessage("Your password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setMessage("The passwords do not match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    await supabase.auth.signOut();
    setMessage("Your password has been updated. You can now sign in with your new password.");
    setPassword("");
    setConfirmPassword("");
    setReady(false);
  }

  return <SiteFrame><main className="auth-page"><section className="auth-card panel">
    <div className="eyebrow">FUTO LIFE · ACCOUNT SECURITY</div>
    <h1>Choose a new password</h1>
    <p>Set a new password for your FUTO Life account. Use at least 8 characters.</p>
    {!supabase && <p className="error">Supabase is not configured for this app.</p>}
    {ready && <form className="form" onSubmit={updatePassword}>
      <label className="field">New password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></label>
      <label className="field">Confirm new password<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></label>
      <button className="primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>}
    {!ready && <Link className="primary auth-back-link" href="/explore?auth=signin">Return to sign in</Link>}
    <button className="secondary auth-home-link" onClick={() => router.push("/")}>Back to FUTO Life</button>
  </section></main></SiteFrame>;
}
