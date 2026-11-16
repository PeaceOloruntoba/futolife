import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFrame } from "@/components/site-frame";
import { AdsenseSlot } from "@/components/adsense-slot";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
type Props={params:Promise<{slug:string}>};
async function getArticle(slug:string){const supabase=await createClient();if(!supabase)return null;const {data}=await supabase.from("articles").select("*").eq("slug",slug).eq("status","published").maybeSingle();return data;}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const article=await getArticle(slug);return {title:article?`${article.title} | FUTO Life`:"Story | FUTO Life",description:article?.excerpt||"Stories and guides from FUTO Life."};}
export default async function ArticleDetail({params}:Props){const {slug}=await params;const article=await getArticle(slug);if(!article)notFound();return <SiteFrame><main className="article-detail-page"><Link href="/articles" className="opp-back">← All stories</Link><article><header><span>{article.section} · {article.author_name}</span><h1>{article.title}</h1><p>{article.excerpt}</p><small>{article.published_at?new Date(article.published_at).toLocaleDateString("en-NG",{dateStyle:"long"}):"FUTO Life Editorial"}</small></header>{article.cover_image_url&&<img className="article-cover" src={article.cover_image_url} alt=""/>}<div className="article-body">{article.content.split(/\n{2,}/).map((paragraph:string,index:number)=><p key={index}>{paragraph}</p>)}</div><AdsenseSlot slot={process.env.NEXT_PUBLIC_ADSENSE_ARTICLE_SLOT}/></article></main></SiteFrame>}
