const T=require('three'),S=require('./senate'),F=require('./foliage');let n=0,f=0;const ck=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}},near=(a,b,t,m)=>ck(Math.abs(a-b)<t,m+' ('+a+' vs '+b+')');
const stub=()=>new Proxy({},{get:(t,k)=>k=='measureText'?()=>({width:10}):k=='createLinearGradient'||k=='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});
const C={THREE:T,tex:()=>new T.Texture(),M:(c,o)=>new T.MeshStandardMaterial(Object.assign({color:c},o||{})),cv:()=>({getContext:stub}),mobile:false,foliage:F};
const P={x:-62,z:-300,rot:Math.PI/2},r=S.build(C,P);let dc=0,names=[];r.group.traverse(o=>{if(o.isMesh)dc++;names.push(o.name)});console.log('draw calls',dc);ck(dc<110,'draw calls < 110');
['windows','ac-units','norfolk-pine','forecourt','roundabout-curb','island','island-shrubs','sign-placeholder','flag'].forEach(k=>ck(names.includes(k),'has '+k));
// roof ridge top = eave 10.8 + 5.9
let ymax=0;const b0=new T.Box3();r.group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh){b0.setFromObject(o);ymax=Math.max(ymax,b0.max.y)}});near(ymax,16.8,.05,'tallest element is the pine trunk (16.8); roof ridge is 16.7');
const hit=(x,z)=>r.colliders.some(w=>x>w.x0&&x<w.x1&&z>w.z0&&z<w.z1),L=(lx,lz)=>r.toWorld(lx,lz);
ck(hit(L(25,-8).x,L(25,-8).z),'right wing solid');ck(hit(L(-25,-8).x,L(-25,-8).z),'left wing solid');ck(hit(L(9,-8).x,L(9,-8).z),'central block side solid');
ck(!hit(L(25,0).x,L(25,0).z)&&!hit(L(0,10).x,L(0,10).z),'forecourt in front of wings and entrance is free');ck(!hit(r.door[0],r.door[1]),'door prompt point is free');
const walk=(a,b)=>{for(let t=0;t<=1;t+=.005){const p=L(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);if(hit(p.x,p.z))return false}return true};
ck(walk([3,50],[3,4]),'walk x=3 from the avenue side to the porch steps');ck(!walk([0,50],[0,4]),'island pine trunk at x=0 is solid');ck(!walk([3,50],[3,-8]),'cannot walk into the porch back wall');
const rb=Math.min(...r.colliders.map(w=>w.z0)),rx=Math.max(...r.colliders.map(w=>w.x1));ck(isFinite(rb)&&isFinite(rx),'colliders finite');
console.log(n+' checks, '+f+' failed');process.exit(f?1:0);
