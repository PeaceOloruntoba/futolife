const T=require('three'),MG=require('./maingate');let n=0,f=0;const ck=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}};
const stub=()=>new Proxy({},{get:(t,k)=>k=='measureText'?()=>({width:10}):k=='createLinearGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});
const r=MG.build({THREE:T,tex:(w,h,fn,rx,ry)=>{const t=new T.Texture();return t},M:(c,o)=>new T.MeshStandardMaterial(Object.assign({color:c},o||{})),cv:()=>({getContext:stub}),mobile:false,foliage:require('./foliage')});
const b=new T.Box3().setFromObject(r.group);
ck(Math.abs(b.max.y-6.7)<.01,'tallest part is the street-light head 6.7 (got '+b.max.y+')');ck(b.min.x<=-15.7&&b.max.x>=15.7,'gate spans about +/-15.8 m');
const names=[];r.group.traverse(o=>names.push(o.name));['emblem-area','sign:FEDERAL UNIVERSITY OF','sign:TECHNOLOGY OWERRI','gate-leaves','painted-curbs','flowers','ao-blobs','approach-road','apron'].forEach(k=>ck(names.includes(k),'has '+k));
let dc=0;r.group.traverse(o=>{if(o.isMesh)dc++});console.log('draw calls (meshes+instanced):',dc);ck(dc<80,'draw calls < 80');
// traversal: walk straight south->north lines through the gate with the same point-in-box test the game's collision uses
const hit=(x,z)=>r.colliders.some(w=>x>w.x0&&x<w.x1&&z>w.z0&&z<w.z1),pass=x=>{for(let z=8;z>=-8;z-=.05)if(hit(x,z))return false;return true};
ck(pass(6.9)&&pass(-6.9),'vehicle openings traversable at x=+/-6.9');ck(pass(12.9)&&pass(-12.9),'pedestrian openings traversable at x=+/-12.9');
ck(!pass(0)&&!pass(2)&&!pass(-3),'booth block is solid');ck(!pass(4.6)&&!pass(9.5)&&!pass(-4.6)&&!pass(-9.5),'gate leaves are solid');ck(!pass(10.5)&&!pass(-15.4),'piers are solid');ck(!pass(11.4)&&!pass(14.4),'bay walls are solid');
ck(!hit(0,7)&&!hit(0,9),'spawn (0,7) is outside colliders');
const F=require('./foliage'),C0={THREE:T,tex:()=>new T.Texture(),cv:()=>({getContext:stub})},fm=F.mats(C0),tg=F.trees(C0,[[0,0,2,false],[9,9,1,false],[50,50,6,true]],fm,{shadow:true});let ic=0;tg.traverse(o=>{if(o.isInstancedMesh)ic+=o.count});ck(ic>=3+6+18*2+7+2,'tree instance count '+ic);let my=0;const m4=new T.Matrix4(),p4=new T.Vector3();tg.traverse(o=>{if(o.isInstancedMesh)for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);p4.setFromMatrixPosition(m4);my=Math.max(my,p4.y)}});ck(my>5,'highest foliage instance above 5 m (got '+my.toFixed(1)+')');
console.log(n+' checks, '+f+' failed');process.exit(f?1:0);
