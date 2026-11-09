"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Challenge = { id: string; title: string; description: string; category: string; type: string; coins: number; xp: number; prompt: string | null; choices: string[]; claimable: boolean; claimed: boolean };
type StoreItem = { id: string; name: string; description: string; category: string; price: number; purchase_type: string };
type InventoryItem = { id: string; name: string; category: string; quantity: number; purchase_type: string };
type GameState = { coins: number; xp: number; daily_streak: number; best_daily_streak: number; challenges: Challenge[]; store: StoreItem[]; inventory: InventoryItem[] };

export function GameHub({ open, signedIn, onRequireSignIn, onClose }: { open: boolean; signedIn: boolean; onRequireSignIn: () => void; onClose: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const supabase = useMemo(() => createClient(), []);

  const refresh = useCallback(async () => {
    if (!supabase || !signedIn) { setState(null); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_game_state");
    if (error) setMessage(error.message);
    else setState(data as GameState);
    setLoading(false);
  }, [signedIn, supabase]);

  useEffect(() => { if (open) { setMessage(""); void refresh(); } }, [open, refresh]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function claim(challenge: Challenge) {
    if (!supabase || !challenge.claimable || busy) return;
    setBusy(challenge.id); setMessage("");
    const { data, error } = await supabase.rpc("claim_game_challenge", { p_challenge_id: challenge.id, p_request_id: crypto.randomUUID(), p_answer: challenge.type === "trivia" ? answers[challenge.id] ?? null : null });
    if (error) setMessage(error.message);
    else { const result=data as {state:GameState;already_claimed:boolean;coins_awarded:number;xp_awarded:number};setState(result.state);setMessage(result.already_claimed?"Already claimed.":`Added ${result.coins_awarded} coins and ${result.xp_awarded} XP.`); }
    setBusy(null);
  }

  async function purchase(item: StoreItem) {
    if (!supabase || busy) return;
    setBusy(item.id); setMessage("");
    const { data, error } = await supabase.rpc("purchase_game_item", { p_item_id: item.id, p_request_id: crypto.randomUUID() });
    if (error) setMessage(error.message);
    else { setState((data as { state: GameState }).state); setMessage(`${item.name} added to your inventory.`); }
    setBusy(null);
  }

  if (!open) return null;
  return <div className="gamehub-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="gamehub panel" role="dialog" aria-modal="true" aria-labelledby="gamehub-title">
      <header className="gamehub-header"><div><span className="eyebrow">FUTO LIFE GAME</span><h2 id="gamehub-title">Missions & rewards</h2></div><button className="secondary" onClick={onClose} aria-label="Close game hub">×</button></header>
      {!signedIn ? <div className="gamehub-guest"><p>Explore the campus as a guest. Sign in to save your XP, streaks, coins and inventory.</p><button className="primary" onClick={onRequireSignIn}>Sign in to play</button></div> : loading ? <p className="gamehub-note">Loading your game profile…</p> : state && <>
        <div className="gamehub-stats"><div><small>GAME COINS</small><b>◉ {state.coins.toLocaleString()}</b></div><div><small>EXPERIENCE</small><b>{state.xp.toLocaleString()} XP</b></div><div><small>DAILY STREAK</small><b>🔥 {state.daily_streak} days</b></div></div>
        <section className="gamehub-section"><div className="gamehub-section-title"><h3>Today’s missions</h3><small>Streak record: {state.best_daily_streak} days</small></div>
          {state.challenges.filter((item) => item.type === "daily_login" || item.type === "trivia" || item.type === "discovery").map((item) => <article className="gamehub-challenge" key={item.id}><div className="gamehub-challenge-copy"><b>{item.title}</b><p>{item.description}</p>{item.prompt && <><label htmlFor={`answer-${item.id}`}>{item.prompt}</label><select id={`answer-${item.id}`} value={answers[item.id] ?? ""} onChange={(event) => setAnswers((prev) => ({ ...prev, [item.id]: event.target.value }))}><option value="">Choose an answer</option>{item.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></>}</div><button className="gamehub-reward" disabled={!item.claimable || busy !== null || (item.type === "trivia" && !answers[item.id])} onClick={() => void claim(item)}>{busy === item.id ? "…" : item.claimed ? "Done" : item.claimable ? `Claim · ${item.coins} coins` : "Map review pending"}</button></article>)}
        </section>
        <section className="gamehub-section"><div className="gamehub-section-title"><h3>Ride tickets & gear</h3><small>Game coins only</small></div>{state.store.map((item) => <article className="gamehub-store-item" key={item.id}><div><b>{item.name}</b><p>{item.description}</p></div><button disabled={busy !== null} onClick={() => void purchase(item)}>{busy === item.id ? "…" : `◉ ${item.price}`}</button></article>)}</section>
        <section className="gamehub-section"><div className="gamehub-section-title"><h3>Inventory</h3><small>{state.inventory.reduce((sum, item) => sum + item.quantity, 0)} items</small></div>{state.inventory.length ? <div className="gamehub-inventory">{state.inventory.map((item) => <span key={item.id}>{item.name}<b>×{item.quantity}</b></span>)}</div> : <p className="gamehub-note">Your inventory is empty. Complete a mission to earn coins, then choose a cosmetic or ride ticket.</p>}</section>
        <p className="gamehub-note">Coins have no cash value. Location missions stay locked until the campus arrival data is reviewed and validated.</p>
      </>}
      {message && <p className="gamehub-message" role="status">{message}</p>}
    </section>
  </div>;
}
