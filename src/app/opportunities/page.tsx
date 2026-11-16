import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/components/site-frame";
import { OpportunitiesBrowser } from "@/components/opportunities-browser";
import { AdsenseSlot } from "@/components/adsense-slot";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Opportunities | FUTO Life",description:"Discover verified scholarships, internships, fellowships, jobs, grants and training opportunities."};

export default async function OpportunitiesPage(){
  const supabase=await createClient();
  const [opps,cats,articles]=supabase?await Promise.all([
    supabase.from("opportunities").select("id,title,slug,organization,summary,location,deadline,featured,category_id").eq("status","published").order("featured",{ascending:false}).order("created_at",{ascending:false}),
    supabase.from("opportunity_categories").select("id,name,slug").order("name"),
    supabase.from("articles").select("id,title,slug,excerpt,section,published_at").eq("status","published").order("featured",{ascending:false}).order("published_at",{ascending:false}).limit(3)
  ]):[{data:[]},{data:[]},{data:[]}];
  const items=opps.data??[];const categories=cats.data??[];const stories=articles.data??[];
  return <SiteFrame><main className="opportunities-page"><section className="opp-hero"><div><span className="opp-kicker">FUTO LIFE · OPPORTUNITIES</span><h1>Find your next<br/><em>opportunity.</em></h1><p>Verified paths to learn, grow and build your future — for students, graduates and the wider public.</p><div className="opp-hero-trust"><span>✓ Official sources</span><span>✓ Reviewed listings</span><span>✓ Open to everyone</span></div><Link className="opp-submit-link" href="/opportunities/submit">Share an opportunity or story ↗</Link></div><div className="opp-hero-art"><span>OPEN CALL</span><strong>Make<br/>your next<br/><i>move.</i></strong><small>FUTO LIFE · CAREER & LEARNING</small></div></section><AdsenseSlot slot={process.env.NEXT_PUBLIC_ADSENSE_OPPORTUNITY_SLOT}/><section className="opp-section"><header className="opp-section-head"><div><span className="opp-kicker">DISCOVER</span><h2>Opportunities</h2><p>Every published listing is checked against its official source.</p></div><span className="opp-total">{items.length} listings</span></header><OpportunitiesBrowser items={items} categories={categories}/></section>{stories.length>0&&<section className="opp-editorial"><header className="opp-section-head"><div><span className="opp-kicker">THE EDIT</span><h2>Guides & stories</h2><p>Practical advice and context from the FUTO Life editorial desk.</p></div><Link href="/articles">View all stories ↗</Link></header><div className="opp-story-grid">{stories.map(story=><article key={story.id}><span>{story.section}</span><h3><Link href={`/articles/${story.slug}`}>{story.title}</Link></h3><p>{story.excerpt}</p></article>)}</div></section>}</main></SiteFrame>;
}
