"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function OpportunityApplyButton({ url, slug }: { url: string; slug: string }) {
  const [busy, setBusy] = useState(false);
  async function continueToApplication() {
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (!user) {
      window.location.assign(`/explore?auth=signin&next=${encodeURIComponent(`/opportunities/${slug}?continue=1`)}`);
      return;
    }
    window.location.assign(url);
  }
  return <button className="opportunity-apply" onClick={() => void continueToApplication()} disabled={busy}>{busy ? "Checking sign-in…" : "Continue to official application ↗"}</button>;
}
