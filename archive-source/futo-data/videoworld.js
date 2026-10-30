// World built to follow a user-supplied tour video. All positions are PROTOTYPE values from video timing (see video-route.json). Buildings are neutral massing, not reconstructions.
(function(root){
function hipG(T,wx,wz,rl,h){const a=wx/2,b=wz/2,r=rl/2,P=[],q=(p0,p1,p2,p3)=>[p0,p1,p2,p0,p2,p3].forEach(p=>P.push(...p));q([-a,0,b],[a,0,b],[r,h,0],[-r,h,0]);q([a,0,-b],[-a,0,-b],[-r,h,0],[r,h,0]);P.push(-a,0,-b,-a,0,b,-r,h,0,a,0,b,a,0,-b,r,h,0);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.computeVertexNormals();return g}
function build(c,cfg){const T=c.THREE,Z=t=>-(t-cfg.departSec)*cfg.speedMps,fmt=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'),G=new T.Group(),col=[],S=s=>s=='L'?-1:1;let sd=7;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
const M=(h,o)=>new T.MeshStandardMaterial(Object.assign({color:h,roughness:.9},o||{})),tg=t=>'Unverified \u00b7 from video '+fmt(t)+' \u00b7 photos pending';
const bx=(P,w,h,d,m,x,y,z)=>{const b=new T.Mesh(new T.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=b.receiveShadow=true;P.add(b);return b};
const strip=(w,z0,z1,m,y,x)=>{const p=new T.Mesh(new T.PlaneGeometry(w,Math.abs(z1-z0)),m);p.rotation.x=-Math.PI/2;p.position.set(x||0,y,(z0+z1)/2);p.receiveShadow=true;G.add(p);return p};
const sur=(hex,n)=>{const t=c.tex(128,128,(g,w,h)=>{g.fillStyle=hex;g.fillRect(0,0,w,h);for(let i=0;i<1200;i++){const k=rnd()<.5?0:255;g.fillStyle='rgba('+k+','+k+','+k+',.05)';g.fillRect(rnd()*w,rnd()*h,2,2)}});return t};
const mk=(hex,len,wd)=>{const t=sur(hex).clone();t.needsUpdate=true;t.repeat.set(wd/4,len/4);return new T.MeshStandardMaterial({map:t,roughness:.95,polygonOffset:true,polygonOffsetFactor:-1})};
// ground strips: dry earth verge under everything, then each road segment
const zEnd=Z(cfg.segments[cfg.segments.length-1].t1),zS=Z(cfg.departSec);strip(40,zS,zEnd,mk('#a2825c',zS-zEnd,40),.012,0);
const fm=c.foliage.mats(c),veg=[];
cfg.segments.forEach(s=>{const z0=Z(s.t0),z1=Z(s.t1),L=Math.abs(z1-z0);strip(s.width,z0,z1,mk(s.kind=='earth'?'#b5835a':s.kind=='bridge'?'#9a958c':'#b3aea3',L,s.width),.03,0);
if(s.drain){const d0=Z(s.drain[0]),d1=Z(s.drain[1]),dl=Math.abs(d1-d0),cz=(d0+d1)/2;[-1,1].forEach(k=>{const x=k*(s.width/2+1);bx(G,.25,.4,dl,M(0xa9a69c),x-.4*k,0,cz);bx(G,.25,.4,dl,M(0xa9a69c),x+.4*k,0,cz);strip(.6,d0,d1,M(0x2e2b28),.015,x)})}
if(s.kind=='bridge'){const rl=new T.MeshStandardMaterial({color:0x7a7770,roughness:.7,metalness:.4}),ps=[];[-1,1].forEach(k=>{const r=new T.Mesh(new T.CylinderGeometry(.09,.09,L,8),rl);r.rotation.x=Math.PI/2;r.position.set(k*(s.width/2+.1),1,(z0+z1)/2);G.add(r);for(let z=z0;z>z1;z-=4)ps.push([k*(s.width/2+.1),z]);col.push({x0:Math.min(k*(s.width/2+.4),k*60),x1:Math.max(k*(s.width/2+.4),k*60),z0:z1,z1:z0,id:'valley'+k})});
const im=new T.InstancedMesh(new T.BoxGeometry(.12,1.1,.12),rl,ps.length),m4=new T.Matrix4();ps.forEach((p,i)=>{m4.setPosition(p[0],.55,p[1]);im.setMatrixAt(i,m4)});im.name='bridge-posts';G.add(im);
[-1,1].forEach(k=>{const w=new T.Mesh(new T.PlaneGeometry(50,20),new T.MeshStandardMaterial({color:0x9ccbbd,roughness:.25,metalness:.1}));w.rotation.x=-Math.PI/2;w.position.set(k*30,.014,z0-12);w.name='stream';G.add(w);for(let i=0;i<24;i++)veg.push([k*(6+rnd()*40),.4+rnd()*.5,z0-rnd()*L,1.2+rnd()*1.2,-.5,rnd()*6.28,0,'#ffffff'])})}});
if(veg.length)G.add(c.foliage.cards(c,fm.green,veg,false));
// events
const win=hex=>c.tex(128,128,(g,w,h)=>{g.fillStyle=hex;g.fillRect(0,0,w,h);g.fillStyle='#efede7';g.fillRect(34,28,60,64);const gd=g.createLinearGradient(0,0,w,h);gd.addColorStop(0,'#7f9db4');gd.addColorStop(1,'#34495a');g.fillStyle=gd;g.fillRect(39,33,50,54);g.fillStyle='#efede7';g.fillRect(62,33,4,54)});
const PL=[],LP=[],CY=[];
cfg.events.forEach(e=>{const s=S(e.side),z=Z(e.t),x=s*e.off;
if(e.type=='building'){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=e.side=='L'?Math.PI/2:-Math.PI/2;const H=e.floors*3.4,ft=win(e.wall).clone();ft.needsUpdate=true;ft.repeat.set(Math.round(e.w/3.4),e.floors);const wl=M(e.wall),fr=new T.MeshStandardMaterial({map:ft,roughness:.85});
const b=new T.Mesh(new T.BoxGeometry(e.w,H,e.d),[wl,wl,M(e.roof),wl,fr,wl]);b.position.y=H/2;b.castShadow=b.receiveShadow=true;g.add(b);
const rf=new T.Mesh(hipG(T,e.w+1.6,e.d+1.6,Math.max(e.w*.5,3),2.4+e.floors*.4),new T.MeshStandardMaterial({color:e.roof,roughness:.7,side:T.DoubleSide}));rf.position.y=H;rf.castShadow=true;g.add(rf);
bx(g,1.8,2.4,.1,M(0x2a2420),0,0,e.d/2+.03);if(e.accent)for(let i=-Math.floor(e.w/10);i<=Math.floor(e.w/10);i++)bx(g,.5,H,.3,M(e.accent),i*5+2.5,0,e.d/2+.15);
if(e.hedge)bx(g,e.w*.9,.9,.9,M(0x2f5d2a),0,0,e.d/2+2);G.add(g);col.push({x0:x-e.d/2-.4,x1:x+e.d/2+.4,z0:z-e.w/2-.4,z1:z+e.w/2+.4,id:e.name});c.label(e.name,tg(e.t),x,H+5,z,'#e8765a')}
else if(e.type=='sign'){bx(G,.12,2.6,.12,M(0x8a8f96),x,0,z);bx(G,1.7,.9,.08,M(0xe8e6de),x,1.9,z);c.label(e.text,tg(e.t),x,4.2,z,'#e8765a')}
else if(e.type=='pine'){const H=e.h||17,N=22,g0=new T.CylinderGeometry(.06,1,.6,10);g0.translate(0,.3,0);const im=new T.InstancedMesh(g0,M(0x2b4f30),N),m4=new T.Matrix4(),Y=new T.Vector3(0,1,0);for(let i=0;i<N;i++){const y=2.5+i*(H-3.5)/N,r=3*Math.pow(1-(y-2.5)/(H-2.5),.9)+.25;m4.compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(Y,rnd()*6),new T.Vector3(r,1,r));im.setMatrixAt(i,m4)}im.castShadow=!c.mobile;im.name='norfolk-pine';G.add(im);bx(G,.5,H,.5,M(0x5a4a3a),x,0,z);col.push({x0:x-.7,x1:x+.7,z0:z-.7,z1:z+.7,id:'pine'});c.label('Norfolk pine (as seen in video)',tg(e.t),x,H+2,z,'#e8765a')}
else if(e.type=='cypress'){for(let i=0;i<e.n;i++)CY.push([x+(rnd()-.5)*e.spread,z+(rnd()-.5)*e.spread])}
else if(e.type=='bins'){bx(G,.7,1,.7,M(0xb3262e),x,0,z);bx(G,.7,1,.7,M(0x2a5fa8),x+1,0,z)}
else if(e.type=='planter'){bx(G,4,.35,4,M(0x1b9a90),x,0,z);bx(G,3.4,.4,3.4,M(0x6a5038),x,0,z);c.label('Low planter with painted curb',tg(e.t),x,2,z,'#e8765a')}
else if(e.type=='series'){for(let t=e.t0;t<e.t1;t+=e.spacing/cfg.speedMps)(e.what=='poles'?PL:LP).push([S(e.side)*e.off,Z(t)])}
else if(e.type=='statue'){bx(G,8,1,1,M(0x2f5d2a),x,0,z+3);bx(G,2,1.2,2,M(0xd9b84a),x,0,z);bx(G,.5,2.4,.5,M(0x3a3430),x,1.2,z);col.push({x0:x-1.4,x1:x+1.4,z0:z-1.4,z1:z+1.4,id:'statue'});c.label(e.name,tg(e.t),x,5,z,'#e8765a')}});
// utility poles with wires, street lamps, cypress trees (all instanced)
const inst=(g,m,pts,y,nm)=>{if(!pts.length)return;const im=new T.InstancedMesh(g,m,pts.length),m4=new T.Matrix4();pts.forEach((p,i)=>{m4.setPosition(p[0],y,p[1]);im.setMatrixAt(i,m4)});im.name=nm;G.add(im)};
const pg=new T.CylinderGeometry(.1,.14,9,6);inst(pg,M(0x5a4a3a),PL,4.5,'poles');
const wp=[];[-1,1].forEach(k=>{const a=PL.filter(p=>Math.sign(p[0])==k).sort((u,v)=>v[1]-u[1]);for(let i=0;i<a.length-1;i++)[8.6,8.2].forEach(h=>wp.push(a[i][0],h,a[i][1],a[i+1][0],h,a[i+1][1]))});
if(wp.length){const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(wp,3));const ln=new T.LineSegments(wg,new T.LineBasicMaterial({color:0x222222}));ln.name='wires';G.add(ln)}
inst(new T.CylinderGeometry(.08,.1,7,6),M(0xdfe6ee),LP,3.5,'lamp-posts');inst(new T.BoxGeometry(.9,.18,.35),M(0x2a2d31),LP,7.1,'lamp-heads');
const cg=new T.ConeGeometry(.8,5.5,8);inst(cg,M(0x2f5d2a),CY,2.75,'cypress');
// trees
const TL=[];cfg.trees.forEach(r=>{for(let t=r.t0;t<r.t1;t+=r.spacing/cfg.speedMps)[-1,1].forEach(k=>TL.push([k*(r.off||(14+rnd()*12)),Z(t)+rnd()*4,r.scale,!r.avenue&&false]))});
const nearAny=(x,z)=>col.some(b=>x>b.x0-4&&x<b.x1+4&&z>b.z0-4&&z<b.z1+4);G.add(c.foliage.trees(c,TL.filter(a=>!nearAny(a[0],a[1])),fm,{shadow:!c.mobile}));
// open ground: parked vans, palms, water tower
const f=cfg.field;if(f){const v=f.vans,vm=new T.InstancedMesh(new T.BoxGeometry(1.9,1.9,4.6),M(0xf1f1ee),v.count),m4=new T.Matrix4(),z0=Z(v.t0),z1=Z(v.t1);for(let i=0;i<v.count;i++){m4.setPosition(S(v.side)*v.off,.95,z0+(z1-z0)*i/(v.count-1));vm.setMatrixAt(i,m4)}vm.name='vans';G.add(vm);
for(let i=0;i<f.palms;i++)c.palm((i%2?1:-1)*(28+rnd()*10),Z(f.t0)+(Z(f.t1)-Z(f.t0))*i/f.palms,7+rnd()*2);
const wt=f.waterTower,wx=S(wt.side)*wt.off,wz=Z(wt.t);bx(G,6,3,6,M(0xcfd3d4),wx,9,wz);[-2,2].forEach(a=>[-2,2].forEach(b=>bx(G,.4,9,.4,M(0x8a8f96),wx+a,0,wz+b)));c.label('Water tower (seen in distance)',tg(wt.t),wx,15,wz,'#e8765a')}
return{group:G,colliders:col,Z}}
const API={build};if(typeof module!=='undefined')module.exports=API;else root.VideoWorld=API})(typeof window!=='undefined'?window:globalThis);
