"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type ClickRow = { id: string; profile_id: string; profile_display_name: string; opportunity_title: string; opportunity_slug: string; clicked_at: string };

export function OpportunityApplyClicks() {
  const supabase = useMemo(() => createClient(), []);
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [message, setMessage] = useState("Loading apply clicks…");
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("opportunity_apply_clicks").select("id,profile_id,profile_display_name,opportunity_title,opportunity_slug,clicked_at").order("clicked_at", { ascending: false }).limit(1000);
    if (error) { setMessage(`Could not load apply clicks: ${error.message}`); return; }
    const rows = (data ?? []) as ClickRow[];
    setClicks(rows);
    if (!rows.length) { setMessage("No apply clicks recorded yet."); return; }
    setMessage("");
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);
  return <section className="admin-list-card admin-manage-card"><div className="admin-list-head"><div><h2>Opportunity apply clicks</h2><p>Every recorded click on “Continue to official application”. This confirms intent to leave for the provider; it does not track whether an application was submitted.</p></div><button className="secondary compact" onClick={() => void load()}>Refresh</button></div><div className="admin-location-list">{clicks.map(row => <article className="admin-place" key={row.id}><div className="referral-depth">↗</div><div className="admin-place-info"><b>{row.profile_display_name || "FUTO Life user"}</b><small><a href={`/opportunities/${row.opportunity_slug}`} target="_blank" rel="noreferrer">{row.opportunity_title || "Opportunity listing"}</a></small><small>{new Date(row.clicked_at).toLocaleString()}</small></div></article>)}{message && <div className="admin-empty">{message}</div>}</div></section>;
}
