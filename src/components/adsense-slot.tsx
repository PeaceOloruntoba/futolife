"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

declare global { interface Window { adsbygoogle?: unknown[] } }

export function AdsenseSlot({ slot, label="Advertisement" }: { slot?: string; label?: string }) {
  const client=process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const requested=useRef(false);
  const activate=useCallback(()=>{if(client&&slot&&window.adsbygoogle&&!requested.current){try{window.adsbygoogle.push({});requested.current=true;}catch{/* Ad blockers and unapproved sites may prevent an ad request. */}}},[client,slot]);
  useEffect(activate,[activate]);
  if(!client||!slot)return null;
  return <aside className="adsense-placement" aria-label={label}><span>ADVERTISEMENT</span><Script id="google-adsense" async strategy="afterInteractive" crossOrigin="anonymous" onReady={activate} src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}/><ins className="adsbygoogle" style={{display:"block"}} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true"/></aside>;
}
