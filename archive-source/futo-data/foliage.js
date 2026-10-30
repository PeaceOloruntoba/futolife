// Efficient foliage: alpha-tested leaf-cluster cards (instanced) on tapered trunks + contact-shadow blobs. Procedural textures only (no third-party assets).
(function(root){
function mats(c){const T=c.THREE,mk=(cols,dense,seed)=>{let s=seed;const r=()=>(s=(s*16807)%2147483647)/2147483647;
const t=c.tex(256,256,g=>{g.fillStyle=dense;g.globalAlpha=.9;g.beginPath();g.arc(128,128,86,0,7);g.fill();g.globalAlpha=1;for(let i=0;i<340;i++){const a=r()*6.283,d=Math.sqrt(r())*112;g.save();g.translate(128+Math.cos(a)*d,128+Math.sin(a)*d);g.rotate(r()*6.283);g.fillStyle=cols[(r()*cols.length)|0];g.beginPath();g.ellipse(0,0,8+r()*9,3+r()*3,0,0,7);g.fill();g.restore()}});
return new T.MeshStandardMaterial({map:t,alphaTest:.5,side:T.DoubleSide,roughness:.85})};
return{green:mk(['#2f6b34','#3d7d3c','#4f8e42','#2a5a30','#5b9a4a'],'#25512b',5),yellow:mk(['#b9b13a','#9fae3a','#c9c24a','#7d9a34'],'#6f8a2e',9),red:mk(['#8a2a2e','#a73a34','#6e2a3a','#b34a3a'],'#5a2230',13)}}
// items: [x,y,z,size,rx,ry,rz,tintHex]
function cards(c,m,items,shadow){const T=c.THREE,im=new T.InstancedMesh(new T.PlaneGeometry(1,1),m,items.length),mx=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),s=new T.Vector3(),col=new T.Color();
items.forEach((a,i)=>{e.set(a[4],a[5],a[6]);q.setFromEuler(e);mx.compose(v.set(a[0],a[1],a[2]),q,s.set(a[3],a[3],a[3]));im.setMatrixAt(i,mx);im.setColorAt(i,col.set(a[7]))});
im.castShadow=!!shadow;if(shadow)im.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:m.map,alphaTest:.5});return im}
// items: [x,z,rx,rz]  soft dark ellipse on the ground = cheap ambient occlusion
function blobs(c,items){const T=c.THREE,t=c.tex(128,128,g=>{const gd=g.createRadialGradient(64,64,0,64,64,64);gd.addColorStop(0,'rgba(255,255,255,.9)');gd.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gd;g.fillRect(0,0,128,128)});
const im=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:t,color:0x000000,transparent:true,opacity:.42,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),items.length),mx=new T.Matrix4(),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2),v=new T.Vector3(),s=new T.Vector3();
items.forEach((a,i)=>{mx.compose(v.set(a[0],.07,a[1]),q,s.set(a[2]*2,a[3]*2,1));im.setMatrixAt(i,mx)});im.name='ao-blobs';return im}
// list: [x,z,scale,far]
function trees(c,list,m,o){o=o||{};const T=c.THREE,G=new T.Group();let sd=3;const r=()=>(sd=(sd*16807)%2147483647)/2147483647,items=[],tr=[],br=[],bl=[],tint=['#ffffff','#e9f2d8','#d8e8c4','#f4f7e6'];
list.forEach(([x,z,k,far])=>{const h=2.4*k,n=far?7:18,R=1.7*k;tr.push([x,z,k,h]);if(!far){bl.push([x,z,R*1.15,R*1.15]);for(let i=0;i<3;i++)br.push([x,h*.72,z,r()*6.283,k,h])}
for(let i=0;i<n;i++){const a=r()*6.283,u=Math.sqrt(r());items.push([x+Math.cos(a)*u*R,h*.95+R*.5*Math.sqrt(1-u*u)*(.3+r()*.7)+r()*.5*k,z+Math.sin(a)*u*R,2.5*k*(.75+r()*.5),(r()-.5)*1.5,r()*6.283,(r()-.5)*1.2,tint[(r()*4)|0]])}});
const bark=new T.MeshStandardMaterial({color:0x6a5a4a,roughness:1}),cyl=(a,b)=>{const g=new T.CylinderGeometry(a,b,1,8);g.translate(0,.5,0);return g},mx=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),s=new T.Vector3();
const tk=new T.InstancedMesh(cyl(.6,1),bark,tr.length);tr.forEach((a,i)=>{mx.compose(v.set(a[0],0,a[1]),q.identity(),s.set(.28*a[2],a[3],.28*a[2]));tk.setMatrixAt(i,mx)});tk.castShadow=!!o.shadow;G.add(tk);
if(br.length){const bm=new T.InstancedMesh(cyl(.5,1),bark,br.length);br.forEach((a,i)=>{e.set(.75,a[3],0,'YXZ');q.setFromEuler(e);mx.compose(v.set(a[0],a[1],a[2]),q,s.set(.1*a[4],a[5]*.5,.1*a[4]));bm.setMatrixAt(i,mx)});G.add(bm)}
G.add(cards(c,m.green,items,o.shadow));if(bl.length)G.add(blobs(c,bl));return G}
const API={mats,cards,blobs,trees};if(typeof module!=='undefined')module.exports=API;else root.Foliage=API})(typeof window!=='undefined'?window:globalThis);
