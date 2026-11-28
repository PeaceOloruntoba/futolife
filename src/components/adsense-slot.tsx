"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

declare global { interface Window { adsbygoogle?: unknown[] } }

export function AdsenseSlot({ slot, label="Advertisement" }: { slot?: string; label?: string }) {
  const client=process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-6348105094973299";
  const adSlot=slot || process.env.NEXT_PUBLIC_ADSENSE_OPPORTUNITY_SLOT || "2841149584";
  const requested=useRef(false);
  const activate=useCallback(()=>{if(client&&adSlot&&window.adsbygoogle&&!requested.current){try{window.adsbygoogle.push({});requested.current=true;}catch{/* Ad blockers and unapproved sites may prevent an ad request. */}}},[client,adSlot]);
  useEffect(activate,[activate]);
  return <aside className="adsense-placement" aria-label={label}><span>ADVERTISEMENT</span><Script id="google-adsense" async strategy="afterInteractive" crossOrigin="anonymous" onReady={activate} src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}/><ins className="adsbygoogle" style={{display:"block"}} data-ad-client={client} data-ad-slot={adSlot} data-ad-format="auto" data-full-width-responsive="true"/></aside>;
}
