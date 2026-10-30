// Procedural human avatar: realistic proportions (~7.5 heads), jointed limbs, walk/run/idle animation, serialisable appearance (for future multiplayer sync).
// No third-party assets. Faces +z. Appearance = plain JSON {skin,hair,hairStyle,shirt,pants,shoes,height}.
(function(root){
const TONES=['#7a4e34','#5a3a28','#3f2618','#8a5a3c','#a8714a','#4a2f20','#c68b5e'],HAIR=['#0d0b0a','#1a1210','#2a1b12'],SHIRTS=['#f2b84b','#2f6f9a','#c9d4d8','#7a2f3a','#3f7a5a','#d8cdb8','#5a4a8a'],PANTS=['#2a3340','#1f2530','#4a4036','#5a6270'],STY=['short','short','afro','short','bald','long','short'];
function preset(i,shirt){return{skin:TONES[i%7],hair:HAIR[i%3],hairStyle:STY[i%7],shirt:i==0&&typeof shirt=='number'?'#'+shirt.toString(16).padStart(6,'0'):SHIRTS[i%7],pants:PANTS[i%4],shoes:'#1d1a18',height:1.7+((i*37)%9)/100}}
function make(T,o){o=Object.assign({skin:'#7a4e34',hair:'#0d0b0a',hairStyle:'short',shirt:'#2f6f9a',pants:'#2a3340',shoes:'#1d1a18',height:1.75},o);
const M=(c,r)=>new T.MeshStandardMaterial({color:c,roughness:r==null?.8:r}),skin=M(o.skin,.55),sh=new T.MeshStandardMaterial({color:o.shirt,roughness:.85,side:T.DoubleSide}),pt=M(o.pants,.9),shoe=M(o.shoes,.5),hr=M(o.hair,.45),dark=M(0x120e0c,.3);
const root=new T.Group(),inner=new T.Group();root.add(inner);inner.scale.setScalar(o.height/1.75);const P={};
const add=(par,g,m,x,y,z,sx,sy,sz)=>{const e=new T.Mesh(g,m);e.position.set(x,y,z);if(sx)e.scale.set(sx,sy,sz);e.castShadow=true;par.add(e);return e},grp=(par,x,y,z)=>{const g=new T.Group();g.position.set(x,y,z);par.add(g);return g};
const sp=(r)=>new T.SphereGeometry(r,14,10),cy=(a,b,h)=>{const g=new T.CylinderGeometry(a,b,h,12);g.translate(0,-h/2,0);return g};
const hips=P.hips=grp(inner,0,.93,0);
const tp=[[0,-.02],[.15,-.02],[.17,.06],[.15,.2],[.155,.34],[.185,.46],[.17,.54],[.08,.58],[0,.58]].map(p=>new T.Vector2(p[0],p[1]));
P.torso=add(hips,new T.LatheGeometry(tp,18),sh,0,0,0,1,1,.62);add(hips,cy(.045,.052,.1),skin,0,.64,0);
const head=P.head=grp(hips,0,.6,0);add(head,sp(.11),skin,0,.09,0,.9,1.12,1);
[-1,1].forEach(s=>{add(head,sp(.014),dark,s*.038,.1,.098);add(head,sp(.024),skin,s*.103,.09,0,.5,1,1)});add(head,sp(.018),skin,0,.075,.108,1,1.2,1);
const st=o.hairStyle;if(st=='short'||st=='long'){const h=new T.SphereGeometry(.118,16,10,0,Math.PI*2,0,Math.PI*.55);add(head,h,hr,0,.1,-.008,.95,1.12,1.05);if(st=='long')add(head,new T.BoxGeometry(.2,.24,.07),hr,0,.0,-.09)}else if(st=='afro')add(head,sp(.165),hr,0,.12,-.015,1,.95,1);
[-1,1].forEach((s,i)=>{const k=i?'R':'L';
const sh2=P['sh'+k]=grp(hips,s*.2,.52,0);add(sh2,sp(.052),sh,0,0,0);add(sh2,cy(.05,.044,.3),sh,0,0,0);
const el=P['el'+k]=grp(sh2,0,-.3,0);add(el,sp(.04),skin,0,0,0);add(el,cy(.037,.03,.26),skin,0,0,0);add(el,sp(.04),skin,0,-.29,0,.8,1.3,.6);
const hp=P['hip'+k]=grp(hips,s*.09,0,0);add(hp,cy(.088,.062,.43),pt,0,0,0);
const kn=P['kn'+k]=grp(hp,0,-.43,0);add(kn,sp(.06),pt,0,0,0);add(kn,cy(.058,.04,.42),pt,0,0,0);add(kn,sp(.06),shoe,0,-.46,.05,.9,.55,2.1)});
const a={group:root,parts:P,phase:0,t:0,appearance:o};update(a,0,0);return a}
function update(a,dt,speed){const P=a.parts;a.t+=dt;const w=Math.min(1,speed/2.5),run=Math.min(1,Math.max(0,(speed-4.5)/2.5));a.phase+=dt*(1.6+speed*1.35);const s=Math.sin(a.phase),c=Math.cos(a.phase),sw=(.42+.28*run)*w;
P.hipL.rotation.x=s*sw;P.hipR.rotation.x=-s*sw;P.knL.rotation.x=(Math.max(0,-c)*.85)*w*(1+run*.6)+.04;P.knR.rotation.x=(Math.max(0,c)*.85)*w*(1+run*.6)+.04;
P.shL.rotation.x=-s*sw*.85;P.shR.rotation.x=s*sw*.85;P.shL.rotation.z=.07;P.shR.rotation.z=-.07;
P.elL.rotation.x=-(.15+.35*w+.6*run);P.elR.rotation.x=-(.15+.35*w+.6*run);P.hips.rotation.y=s*.07*w;P.hips.rotation.x=.05*run;
P.hips.position.y=.93+Math.abs(c)*.022*w-.01*w;P.torso.scale.set(1+.012*Math.sin(a.t*1.7),1,.62);P.head.rotation.y=-s*.04*w}
const API={make,update,preset};if(typeof module!=='undefined')module.exports=API;else root.Avatar=API})(typeof window!=='undefined'?window:globalThis);
