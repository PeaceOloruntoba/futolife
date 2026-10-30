// FUTO Senate Building: procedural model guided by ONE user-supplied photograph (front view). Dimensions ESTIMATED (assumed ~3.5 m storey height).
// Unseen: rear, sides, wing lengths (photo crops them: 30 m assumed), interior, sign wording (unreadable, so none drawn). Local frame: facade on z=0, outside = +z.
(function(root){
function hip(T,wx,wz,rl,h,m){const a=wx/2,b=wz/2,r=rl/2,P=[],U=[];
const q=(p0,p1,p2,p3,L)=>{[p0,p1,p2,p0,p2,p3].forEach(p=>P.push(...p));U.push(0,0,L,0,L,1,0,0,L,1,0,1)},tr=(p0,p1,p2,L)=>{P.push(...p0,...p1,...p2);U.push(0,0,L,0,L/2,1)};
q([-a,0,b],[a,0,b],[r,h,0],[-r,h,0],wx/.6);q([a,0,-b],[-a,0,-b],[-r,h,0],[r,h,0],wx/.6);tr([-a,0,-b],[-a,0,b],[-r,h,0],wz/.6);tr([a,0,b],[a,0,-b],[r,h,0],wz/.6);
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeVertexNormals();const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;return o}
function build(c,pl){pl=pl||{x:0,z:0,rot:0};const T=c.THREE,tex=c.tex,M=c.M,F=c.foliage;let sd=21;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
const G=new T.Group(),loc=[],noise=(g,w,h,n,a)=>{for(let i=0;i<n;i++){const k=rnd()<.5?0:255;g.fillStyle='rgba('+k+','+k+','+k+','+a+')';g.fillRect(rnd()*w,rnd()*h,2,2)}};
const buffT=tex(256,256,(g,w,h)=>{g.fillStyle='#cdbb98';g.fillRect(0,0,w,h);for(let r=0;r<24;r++)for(let k=0;k<13;k++){g.fillStyle='hsl('+(36+(rnd()-.5)*8)+','+(32+rnd()*14)+'%,'+(58+(rnd()-.5)*12)+'%)';g.fillRect(k*20-(r%2?10:0)+1,r*10.6+1,18,8.6)}const gd=g.createLinearGradient(0,0,0,h);gd.addColorStop(0,'rgba(0,0,0,0)');gd.addColorStop(1,'rgba(60,40,25,.22)');g.fillStyle=gd;g.fillRect(0,0,w,h);for(let i=0;i<10;i++){g.fillStyle='rgba(40,30,20,.06)';g.fillRect(rnd()*w,0,3+rnd()*5,h)}});
const crT=tex(128,128,(g,w,h)=>{g.fillStyle='#e6dcc6';g.fillRect(0,0,w,h);noise(g,w,h,900,.05);for(let i=0;i<8;i++){g.fillStyle='rgba(80,65,45,.07)';g.fillRect(rnd()*w,0,3,h)}});
const rfT=tex(64,64,(g,w,h)=>{g.fillStyle='#3d444a';g.fillRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.07)';for(let x=0;x<w;x+=8)g.fillRect(x,0,2,h);noise(g,w,h,200,.05)});
const wnT=tex(128,128,(g,w,h)=>{g.fillStyle='#ecebe6';g.fillRect(0,0,w,h);const gd=g.createLinearGradient(0,0,w,h);gd.addColorStop(0,'#7f9db4');gd.addColorStop(.6,'#3b556b');gd.addColorStop(1,'#5f7f95');g.fillStyle=gd;g.fillRect(10,10,w-20,h-20);g.fillStyle='#ecebe6';g.fillRect(w/2-3,10,6,h-20)});
const rbT=tex(128,64,(g,w,h)=>{g.fillStyle='#ecebe6';g.fillRect(0,0,w,h);const gd=g.createLinearGradient(0,0,w,h);gd.addColorStop(0,'#6f93ad');gd.addColorStop(1,'#35506a');g.fillStyle=gd;g.fillRect(4,4,w-8,h-8);g.fillStyle='#ecebe6';g.fillRect(w/2-2,4,4,h-8)});
const tmT=tex(256,256,(g,w,h)=>{g.fillStyle='#5b5955';g.fillRect(0,0,w,h);noise(g,w,h,4000,.07);for(let i=0;i<30;i++){g.fillStyle='rgba('+(rnd()<.5?'120,112,104':'40,38,36')+',.12)';g.beginPath();g.arc(rnd()*w,rnd()*h,10+rnd()*30,0,7);g.fill()}});
const soT=tex(128,128,(g,w,h)=>{g.fillStyle='#8a6d4b';g.fillRect(0,0,w,h);noise(g,w,h,1500,.12)});
const mat=(t,rx,ry,o)=>{const m=t.clone();m.needsUpdate=true;m.repeat.set(rx,ry);m.offset.set(rnd(),rnd());return new T.MeshStandardMaterial(Object.assign({map:m,roughness:.9},o||{}))};
const br=(w,h)=>mat(buffT,w/2.6,h/2.6),cr=(w,h)=>mat(crT,w/3,h/3);
const bx=(w,h,d,m,x,y,z)=>{const b=new T.Mesh(new T.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=b.receiveShadow=true;G.add(b);return b};
const roofM=mat(rfT,1,1,{roughness:.55,metalness:.25,side:T.DoubleSide}),rf=(wx,wz,rl,h,x,y,z)=>{const o=hip(T,wx,wz,rl,h,roofM);o.position.set(x,y,z);G.add(o)};
// central block: ground storey with open porch, projecting cream first-floor box, glazed ribbon, brick frieze, hipped roof
bx(5,3.6,18,br(5,3.6),-9,0,-9);bx(5,3.6,18,br(5,3.6),9,0,-9);bx(13,3.6,13,br(13,3.6),0,0,-11.5);bx(23,6.9,18,br(23,6.9),0,3.6,-9);
bx(2.2,2.8,.1,M(0x1d2a33,{roughness:.2}),0,.2,-4.9);bx(10,.15,1.2,M(0x9a9892),0,0,3.9);bx(8,.1,1,M(0x9a9892),0,0,3.1);
bx(12.6,3,3.1,cr(12.6,3),0,3.7,1.55);[-1,1].forEach(s=>bx(.9,3.7,.9,br(.9,3.7),s*5.7,0,2.6));
bx(23.4,.25,18.4,cr(23.4,.25),0,3.5,-9);bx(23.4,.25,18.4,cr(23.4,.25),0,6.95,-9);bx(24.4,.3,19.6,M(0x8d8f90),0,10.5,-9);
const rib=new T.Mesh(new T.PlaneGeometry(19,1.8),mat(rbT,6,1,{roughness:.15,metalness:.2}));rib.material.map.offset.set(0,0);rib.position.set(0,8.3,.03);G.add(rib);
bx(19.4,.12,.3,cr(19.4,.12),0,7.2,.1);const sg=new T.Mesh(new T.PlaneGeometry(5,.6),new T.MeshStandardMaterial({color:0x2f6f4f,roughness:.6}));sg.position.set(0,9.9,.03);sg.name='sign-placeholder';G.add(sg);
rf(26,21,8,5.9,0,10.8,-9);
// wings (length assumed 30 m each; photo crops them)
const winPos=[],wsz=[];
[-1,1].forEach(s=>{bx(30,7.2,14,br(30,7.2),s*26.5,0,-10);bx(30.3,.25,14.3,cr(30.3,.25),s*26.5,3.5,-10);bx(30.6,.3,14.6,M(0x8d8f90),s*26.5,7.2,-10);rf(32,16,22,3.4,s*26.5,7.5,-10);
for(let i=0;i<9;i++){const x=s*(14.5+i*3.2);[1.0,4.6].forEach(y=>winPos.push([x,y+.6,-2.97]));if(i%3==1)bx(.5,2.6,.08,cr(.5,2.6),x+1.6,.9,-2.96)}
[ -1,1].forEach(t=>winPos.push([s*10.4,1.8,.03],[s*10.4,5.4,.03],[s*10.4,8.8,.03]))});
for(let i=0;i<5;i++)winPos.push([-4.8+i*2.4,5.3,3.07]);
const wm=new T.InstancedMesh(new T.PlaneGeometry(1.2,1.4),new T.MeshStandardMaterial({map:wnT,roughness:.2,metalness:.15}),winPos.length),mx=new T.Matrix4(),qq=new T.Quaternion(),v=new T.Vector3(),sc=new T.Vector3(1,1,1);
winPos.forEach((p,i)=>{mx.compose(v.set(p[0],p[1],p[2]),qq,sc);wm.setMatrixAt(i,mx)});wm.name='windows';G.add(wm);
const ac=new T.InstancedMesh(new T.BoxGeometry(.7,.5,.35),M(0xdadcdd),14);for(let i=0;i<14;i++){const s=i%2?1:-1;mx.compose(v.set(s*(12.5+rnd()*24),1.6+(rnd()<.5?0:3.6),-2.8),qq,sc);ac.setMatrixAt(i,mx)}ac.name='ac-units';G.add(ac);
// forecourt tarmac, roundabout (white curb ring, dry-earth island), Norfolk pine, shrubs, flagpoles
const tm=new T.Mesh(new T.PlaneGeometry(130,130),mat(tmT,16,16,{polygonOffset:true,polygonOffsetFactor:-1}));tm.rotation.x=-Math.PI/2;tm.position.set(0,.03,5+65-5);tm.receiveShadow=true;tm.name='forecourt';G.add(tm);
const CZ=27,cy=(r,h,m,y)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,48),m);o.position.set(0,y,CZ);o.receiveShadow=true;G.add(o);return o};
cy(11.5,.18,M(0xe4e2da),.09).name='roundabout-curb';cy(11,.22,mat(soT,5,5,{roughness:1}),.11).name='island';
const N=22*2,pine=new T.InstancedMesh((()=>{const g=new T.CylinderGeometry(.06,1,.6,10);g.translate(0,.3,0);return g})(),new T.MeshStandardMaterial({roughness:.9}),N),cc=new T.Color();let pi=0;
for(let i=0;i<22;i++){const y=2.6+i*.62,r=3.3*Math.pow(1-(y-2.6)/14.6,.9)+.25;[0,1].forEach(k=>{qq.setFromAxisAngle(new T.Vector3(0,1,0),k*.55+rnd());mx.compose(v.set(0,y-k*.2,CZ),qq,sc.set(r*(1-.18*k),1,r*(1-.18*k)));pine.setMatrixAt(pi,mx);pine.setColorAt(pi++,cc.set(rnd()<.5?'#27492d':'#2f5a34'))})}
sc.set(1,1,1);pine.castShadow=!c.mobile;pine.name='norfolk-pine';G.add(pine);
const tk=new T.Mesh(new T.CylinderGeometry(.18,.4,16.8,8),M(0x5a4a3a));tk.position.set(0,8.4,CZ);tk.castShadow=true;G.add(tk);loc.push({x0:-.6,x1:.6,z0:CZ-.6,z1:CZ+.6});
const fm=c.fm||F.mats(c),sh=[];for(let k=0;k<30;k++){const a=rnd()*6.28,u=Math.sqrt(rnd())*9,px=Math.cos(a)*u,pz=CZ+Math.sin(a)*u,z0=.6+rnd()*.5;for(let j=0;j<4;j++)sh.push([px+(rnd()-.5)*.5,.35+rnd()*.3,pz+(rnd()-.5)*.5,z0,-.5+rnd()*.6,rnd()*6.28,(rnd()-.5)*.8,'#ffffff'])}
const si=F.cards(c,fm.green,sh,false);si.name='island-shrubs';G.add(si);
G.add(F.trees(c,[[-17,9,1.1],[17,10,1.2],[-30,6,1],[33,7,1.1],[-9,14,.9],[9,15,.9]],fm,{shadow:!c.mobile}));
[-10.5,10.5].forEach(x=>bx(.1,9,.1,M(0xb9bdc1),x,0,9));
const flg=new T.Mesh(new T.PlaneGeometry(2.4,1.2),new T.MeshStandardMaterial({map:tex(96,48,g=>{g.fillStyle='#1f8a4c';g.fillRect(0,0,96,48);g.fillStyle='#fff';g.fillRect(32,0,32,48)}),side:T.DoubleSide,roughness:.8}));flg.position.set(11.8,8.2,9);flg.name='flag';G.add(flg);
G.add(F.blobs(c,[[0,-8,14,12],[-26.5,-10,18,9],[26.5,-10,18,9]]));
// colliders (local), then transform to world AABBs for placement {x,z,rot}
[[-11.9,-6.4,-18.4,.4],[6.4,11.9,-18.4,.4],[-6.4,6.4,-18.4,-5.4],[-.45-5.7,-5.7+.45,2.15,3.05],[5.7-.45,5.7+.45,2.15,3.05]].forEach(a=>loc.push({x0:a[0],x1:a[1],z0:a[2],z1:a[3]}));
[-1,1].forEach(s=>loc.push({x0:Math.min(s*11.1,s*41.9),x1:Math.max(s*11.1,s*41.9),z0:-17.4,z1:-2.6}));
const co=Math.cos(pl.rot),si2=Math.sin(pl.rot),W=(lx,lz)=>({x:pl.x+lx*co+lz*si2,z:pl.z-lx*si2+lz*co}),colliders=loc.map(r=>{const p=[W(r.x0,r.z0),W(r.x1,r.z0),W(r.x0,r.z1),W(r.x1,r.z1)];return{x0:Math.min(...p.map(a=>a.x)),x1:Math.max(...p.map(a=>a.x)),z0:Math.min(...p.map(a=>a.z)),z1:Math.max(...p.map(a=>a.z))}});
G.position.set(pl.x,0,pl.z);G.rotation.y=pl.rot;const d=W(0,5.2);
return{group:G,colliders,door:[d.x,d.z],toWorld:W,info:{estimated:true,source:'single user-supplied front photograph',ridgeTop:16.7,pineTop:16.8}}}
const API={build};if(typeof module!=='undefined')module.exports=API;else root.Senate=API})(typeof window!=='undefined'?window:globalThis);
