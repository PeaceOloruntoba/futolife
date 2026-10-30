const T=require('three'),A=require('./avatar');let n=0,f=0;const ck=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}},near=(a,b,t,m)=>ck(Math.abs(a-b)<t,m+' ('+a+' vs '+b+')');
const a=A.make(T,A.preset(0,0xf2b84b));let meshes=0;a.group.traverse(o=>{if(o.isMesh)meshes++});console.log('meshes per avatar',meshes);ck(meshes<=40,'meshes per avatar <= 40');
a.group.updateMatrixWorld(true);const b=new T.Box3().setFromObject(a.group),h=b.max.y-b.min.y;near(h,A.preset(0).height,.07,'height matches preset');near(b.min.y,0,.03,'feet on the ground');ck(b.max.x-b.min.x<.8&&b.max.z-b.min.z<.5,'sensible width and depth');
const hd=new T.Box3().setFromObject(a.parts.head),hh=hd.max.y-hd.min.y;ck(h/hh>6.5&&h/hh<8.5,'about 7-8 heads tall (ratio '+(h/hh).toFixed(1)+')');
const r=A.make(T,A.preset(1));for(let i=0;i<300;i++){A.update(r,1/60,3);}
let mn=9,mx=-9;for(let i=0;i<120;i++){A.update(r,1/60,3);mn=Math.min(mn,r.parts.hipL.rotation.x);mx=Math.max(mx,r.parts.hipL.rotation.x)}ck(mx>.3&&mn<-.3,'legs swing both ways when walking');
A.update(r,0,3);ck(Math.sign(r.parts.hipL.rotation.x)==-Math.sign(r.parts.hipR.rotation.x)||Math.abs(r.parts.hipL.rotation.x)<1e-6,'legs swing in opposition');ck(Math.sign(r.parts.shL.rotation.x)==Math.sign(r.parts.hipR.rotation.x)||Math.abs(r.parts.shL.rotation.x)<1e-6,'arm swings opposite its leg');
const q=A.make(T,A.preset(2));for(let i=0;i<10;i++)A.update(q,1/60,0);ck(Math.abs(q.parts.hipL.rotation.x)<1e-9&&Math.abs(q.parts.shL.rotation.x)<1e-9,'idle: limbs at rest');
const tones=new Set([0,1,2,3,4,5,6].map(i=>A.preset(i).skin));ck(tones.size==7,'7 distinct skin tones in presets');ck(JSON.parse(JSON.stringify(a.appearance)).skin===A.preset(0).skin,'appearance is plain serialisable JSON');
const w=A.make(T,A.preset(5));let hm=new T.Box3().setFromObject(w.group);ck(hm.max.y>1.6,'long-hair preset builds');ck(A.make(T,A.preset(4)).group.children.length==1,'bald preset builds');
console.log(n+' checks, '+f+' failed');process.exit(f?1:0);
