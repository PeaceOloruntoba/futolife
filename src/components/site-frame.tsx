import Link from "next/link";
import type { ReactNode } from "react";
import { NotificationCenter } from "@/components/notification-center";

export function SiteHeader() {
  return <header className="site-header"><Link className="site-logo" href="/" aria-label="FUTO Life home"><span className="site-logo-mark">F</span><span>FUTO <b>LIFE</b></span></Link><nav aria-label="Main navigation"><Link href="/explore">Campus</Link><Link href="/community">Community</Link><NotificationCenter/><Link className="site-header-cta" href="/explore?auth=signin">Join FUTO Life <span aria-hidden="true">↗</span></Link></nav></header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-top"><Link className="site-logo" href="/"><span className="site-logo-mark">F</span><span>FUTO <b>LIFE</b></span></Link><p>Find your place. Find your people. Make FUTO yours.</p></div><div className="footer-bottom"><span>© {new Date().getFullYear()} FUTO Life</span><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="mailto:hello@futolife.com">Contact</a></nav></div></footer>;
}

export function SiteFrame({children}:{children:ReactNode}) {
  return <div className="site-frame"><SiteHeader/><div className="site-content">{children}</div><SiteFooter/></div>;
}
