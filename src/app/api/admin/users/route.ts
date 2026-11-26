import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
export async function POST(request:NextRequest){
 const session=await createClient();if(!session)return NextResponse.json({error:"Supabase is not configured."},{status:503});
 const {data:{user}}=await session.auth.getUser();if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data:roles}=await session.from("user_roles").select("role").eq("user_id",user.id);
 if(!roles?.some(r=>["super_admin","platform_admin"].includes(r.role)))return NextResponse.json({error:"Platform admin access required."},{status:403});
 const body=await request.json().catch(()=>null);const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";const name=typeof body?.display_name==="string"?body.display_name.trim():"";
 if(!email||name.length<2||name.length>48)return NextResponse.json({error:"A valid email and a 2–48 character display name are required."},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:"SUPABASE_SERVICE_ROLE_KEY is not configured."},{status:503});
 const admin=createSupabaseClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{data:{display_name:name},redirectTo:`${request.nextUrl.origin}/auth/callback?next=%2Fexplore`});
 if(error||!data.user)return NextResponse.json({error:error?.message??"Invitation failed."},{status:400});
 const {error:profileError}=await admin.from("profiles").upsert({id:data.user.id,display_name:name});
 return profileError?NextResponse.json({error:profileError.message,invited:true},{status:500}):NextResponse.json({invited:true});
}
