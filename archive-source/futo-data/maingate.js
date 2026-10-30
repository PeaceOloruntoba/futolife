// FUTO Main Gate, procedural model guided by ONE user-supplied photograph (front view). All dimensions are ESTIMATED from the photo
// (assumed ~7 m vehicle opening as scale reference), not measured. No photo pixels are used as textures. Local frame: gate line on z=0, outside = +z, north = -z.
(function(root){
function build(c){const T=c.THREE,tex=c.tex,M=c.M,cv=c.cv;let sd=11;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
const G=new T.Group(),col=[],Y=new T.Vector3(0,1,0);
const noise=(g,w,h,n,a)=>{for(let i=0;i<n;i++){const k=rnd()<.5?0:255;g.fillStyle='rgba('+k+','+k+','+k+','+a+')';g.fillRect(rnd()*w,rnd()*h,2,2)}};
const tanT=tex(256,256,(g,w,h)=>{g.fillStyle='#d9c3a0';g.fillRect(0,0,w,h);for(let i=0;i<26;i++){const x=rnd()*w,y=rnd()*h,gd=g.createRadialGradient(x,y,0,x,y,30+rnd()*50);gd.addColorStop(0,rnd()<.5?'rgba(255,245,225,.10)':'rgba(120,90,55,.10)');gd.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gd;g.fillRect(0,0,w,h)}noise(g,w,h,2400,.05);for(let i=0;i<14;i++){g.fillStyle='rgba(70,55,35,'+(.03+rnd()*.05)+')';g.fillRect(rnd()*w,0,2+rnd()*5,h*(.4+rnd()*.6))}const gb=g.createLinearGradient(0,h*.7,0,h);gb.addColorStop(0,'rgba(150,100,60,0)');gb.addColorStop(1,'rgba(150,100,60,.28)');g.fillStyle=gb;g.fillRect(0,0,w,h)});
const brT=tex(256,256,(g,w,h)=>{g.fillStyle='#a8a094';g.fillRect(0,0,w,h);const pl=[[24,28,36],[20,22,42],[14,8,34],[28,10,30],[18,16,24],[22,6,46]];for(let r=0;r<24;r++)for(let k=0;k<13;k++){const p=pl[(rnd()*pl.length)|0];g.fillStyle='hsl('+(p[0]+(rnd()-.5)*6)+','+p[1]+'%,'+(p[2]+(rnd()-.5)*10)+'%)';g.fillRect(k*20-(r%2?10:0)+1,r*10.6+1,18,8.6)}const gd=g.createLinearGradient(0,0,0,h);gd.addColorStop(0,'rgba(0,0,0,0)');gd.addColorStop(1,'rgba(30,20,10,.25)');g.fillStyle=gd;g.fillRect(0,0,w,h);for(let i=0;i<12;i++){g.fillStyle='rgba(20,15,10,.06)';g.fillRect(rnd()*w,0,3+rnd()*5,h)}});
const rdT=tex(256,256,(g,w,h)=>{g.fillStyle='#a35c44';g.fillRect(0,0,w,h);noise(g,w,h,5000,.07);for(let i=0;i<40;i++){g.fillStyle='rgba(120,60,40,.07)';g.beginPath();g.arc(rnd()*w,rnd()*h,8+rnd()*18,0,7);g.fill()}[.3,.7].forEach(u=>{const gd=g.createLinearGradient(w*(u-.1),0,w*(u+.1),0);gd.addColorStop(0,'rgba(70,35,25,0)');gd.addColorStop(.5,'rgba(70,35,25,.14)');gd.addColorStop(1,'rgba(70,35,25,0)');g.fillStyle=gd;g.fillRect(0,0,w,h)});g.fillStyle='rgba(205,150,115,.16)';g.fillRect(0,0,w*.06,h);g.fillRect(w*.94,0,w*.06,h)});
const mat=(t,rx,ry,o)=>{const m=t.clone();m.needsUpdate=true;m.repeat.set(rx,ry);m.offset.set(rnd(),rnd());return new T.MeshStandardMaterial(Object.assign({map:m,roughness:.9},o||{}))};
const tn=(w,h)=>mat(tanT,w/3,h/3),bk=(w,h)=>mat(brT,w/2.4,h/2.4);
const bx=(w,h,d,m,x,y,z)=>{const b=new T.Mesh(new T.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=b.receiveShadow=true;G.add(b);return b};
// --- center security block (booth): brick frame, recessed tan panel, window, emblem area
bx(7.7,.25,3.8,M(0x9a9a96),0,0,0);bx(7.5,6,3.6,tn(7.5,6),0,0,0);bx(7.9,.3,3.9,tn(7.9,.3),0,6,0);bx(7.7,.1,3.7,tn(7.7,.1),0,6.3,0);
[-1,1].forEach(s=>bx(1.2,5.2,.25,bk(1.2,5.2),s*3.15,0,1.925));bx(7.5,.8,.25,bk(7.5,.8),0,5.2,1.925);
bx(3.7,1.8,.08,M(0xcfcfca),0,1.2,1.84);bx(3.95,.12,.24,M(0xd6d3cb),0,1.1,1.9);bx(3.8,.1,.12,M(0xc4c0b6),0,3.0,1.88);
const glT=tex(256,128,(g,w,h)=>{const gd=g.createLinearGradient(0,0,w,h);gd.addColorStop(0,'#7d9db5');gd.addColorStop(.5,'#34495a');gd.addColorStop(1,'#5d7d93');g.fillStyle=gd;g.fillRect(0,0,w,h);g.fillStyle='#15191d';for(let i=0;i<=4;i++)g.fillRect(i*(w-6)/4,0,6,h);for(let j=0;j<=2;j++)g.fillRect(0,j*(h-6)/2,w,6)});
const gl=new T.Mesh(new T.PlaneGeometry(3.5,1.6),new T.MeshStandardMaterial({map:glT,roughness:.15,metalness:.2}));gl.position.set(0,2.1,1.885);G.add(gl);
const emT=tex(256,256,(g)=>{g.fillStyle='#2b7a72';g.beginPath();g.arc(128,128,124,0,7);g.fill();g.fillStyle='#e7eeec';g.beginPath();g.arc(128,128,100,0,7);g.fill();g.strokeStyle='#2b7a72';g.lineWidth=8;g.beginPath();g.arc(128,128,78,0,7);g.stroke();g.fillStyle='#cfd9d6';g.beginPath();g.arc(128,128,66,0,7);g.fill()});
const em=new T.Mesh(new T.CircleGeometry(.95,40),new T.MeshStandardMaterial({map:emT,transparent:true,roughness:.5}));em.position.set(0,4.1,1.83);em.name='emblem-area';G.add(em);
// --- lettering
function sign(t,w){const c2=cv(1024,128),g=c2.getContext('2d');g.fillStyle='#2f3a47';g.textAlign='center';g.textBaseline='middle';const sl=1000/t.length;let fs=88;g.font='bold '+fs+'px sans-serif';const mw=Math.max(...[...t].map(ch=>g.measureText(ch).width));fs=Math.min(88,fs*sl*.86/mw);g.font='bold '+fs+'px sans-serif';g.fillStyle='rgba(0,0,0,.28)';[...t].forEach((ch,i)=>g.fillText(ch,14+sl*(i+.5),71));g.fillStyle='#2f3a47';[...t].forEach((ch,i)=>g.fillText(ch,12+sl*(i+.5),68));const tx=new T.CanvasTexture(c2);tx.encoding=T.sRGBEncoding;const m=new T.Mesh(new T.PlaneGeometry(w,w*.125),new T.MeshStandardMaterial({map:tx,transparent:true,alphaTest:.3,side:T.DoubleSide,roughness:.8}));m.name='sign:'+t;return m}
const s1=sign('FEDERAL UNIVERSITY OF',6.8);s1.position.set(-7.35,5.45,0);G.add(s1);const s2=sign('TECHNOLOGY OWERRI',6.8);s2.position.set(7.35,5.45,0);G.add(s2);
// --- both sides: lintel beam with brick band, brick piers, pedestrian bay, end pier
const parts=[],add=(x,y,z,w,h,d)=>parts.push([x,y+h/2,z,w,h,d]);
const leaf=(xc,w,h,z)=>{add(xc-w/2+.04,.15,z,.08,h,.08);add(xc+w/2-.04,.15,z,.08,h,.08);add(xc,.15,z,w,.08,.08);add(xc,.15+h-.08,z,w,.08,.08);add(xc,.15+h/2,z,w,.05,.05);const n=Math.round(w/.115);for(let i=0;i<n;i++)add(xc-w/2+.1+i*(w-.2)/(n-1),.15,z,.04,h,.04)};
[-1,1].forEach(s=>{bx(7.2,.85,.6,tn(7.2,.85),s*7.35,4.15,0);bx(7.2,.75,.12,bk(7.2,.75),s*7.35,4.15,.36);bx(.9,5,.8,bk(.9,5),s*10.5,0,0);bx(1.05,5,.6,tn(1.05,5),s*11.475,0,0);bx(1.2,5,.6,tn(1.2,5),s*14.4,0,0);bx(1.8,2,.6,tn(1.8,2),s*12.9,3,0);bx(.8,5,.8,bk(.8,5),s*15.4,0,0);
leaf(s*4.35,1.2,3,.15);leaf(s*9.45,1.2,3,.15);leaf(s*12.9,1.6,2.6,.15);
const r=(a,b)=>({x0:Math.min(s*a,s*b),x1:Math.max(s*a,s*b),z0:-.7,z1:.7});col.push(r(4,5.35),r(8.45,12.4),r(13.4,16.2))});
col.push({x0:-4.15,x1:4.15,z0:-2.2,z1:2.2});
const im=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0x14161a,roughness:.55,metalness:.3}),parts.length),mx=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3(),sc=new T.Vector3();
parts.forEach((p,i)=>{mx.compose(v.set(p[0],p[1],p[2]),q,sc.set(p[3],p[4],p[5]));im.setMatrixAt(i,mx)});im.castShadow=true;im.name='gate-leaves';G.add(im);
// --- roads (reddish paving; left lane asphalt as in the photo), ribbons along curves
const crv=(a,n)=>new T.CatmullRomCurve3(a.map(p=>new T.Vector3(p[0],0,p[1]))).getPoints(n).map(p=>[p.x,p.z]);
function rib(P,w,m,y,nm){const pos=[],uv=[],ix=[];let d=0;P.forEach((p,i)=>{const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;const nx=-tz*w/2,nz=tx*w/2;if(i)d+=Math.hypot(p[0]-P[i-1][0],p[1]-P[i-1][1]);pos.push(p[0]+nx,y,p[1]+nz,p[0]-nx,y,p[1]-nz);uv.push(0,d/4,1,d/4);if(i){const k=i*2;ix.push(k-2,k,k-1,k-1,k,k+1)}});
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(pos.map((_,i)=>i%3==1?1:0),3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);const m2=new T.Mesh(g,m);m2.receiveShadow=true;m2.name=nm;G.add(m2);return m2}
const rm=mat(rdT,1,1,{side:T.DoubleSide,roughness:.95}),asph=M(0x5d5f63,{side:T.DoubleSide,roughness:.95});
rib(crv([[1.5,75],[.5,45],[0,22],[0,9]],24),7,rm,.04,'approach-road');rib([[-16,3.5],[16,3.5]],9,rm,.036,'apron');
[-1,1].forEach(s=>{rib(crv([[s*6.9,8],[s*7.4,13],[s*11,22],[s*16,42],[s*21,70]],24),3.8,s<0?asph:rm,.04,'lane');rib(crv([[s*6.9,1],[s*6.9,-5],[s*3,-9.5],[0,-12]],16),3.6,rm,.04,'inner-lane')});
// --- flowerbeds with painted teal/white curbs, shrubs and flowers (instanced)
const beds=[-1,1].map(s=>crv([[s*5.2,12],[s*6.3,22],[s*8.5,44]],14)),W=3,soil=mat(tex(128,128,(g,w,h)=>{g.fillStyle='#4d3626';g.fillRect(0,0,w,h);noise(g,w,h,1400,.12);for(let i=0;i<120;i++){g.fillStyle='rgba('+((60+rnd()*40)|0)+',40,25,.5)';g.fillRect(rnd()*w,rnd()*h,3,2)}}),1,1,{roughness:1,side:T.DoubleSide});
const nrm=(P,i)=>{const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)],tx=b[0]-a[0],tz=b[1]-a[1],l=Math.hypot(tx,tz)||1;return[-tz/l,tx/l]};
const segs=[];beds.forEach(P=>{rib(P,W,soil,.05,'flowerbed');[-1,1].forEach(e=>{for(let i=0;i<P.length-1;i++){const n0=nrm(P,i),n1=nrm(P,i+1),a=[P[i][0]+n0[0]*e*W/2,P[i][1]+n0[1]*e*W/2],b=[P[i+1][0]+n1[0]*e*W/2,P[i+1][1]+n1[1]*e*W/2];segs.push([a,b])}})});
const cu=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0xffffff,roughness:.7}),segs.length),cc=new T.Color();
segs.forEach((s2,i)=>{const dx=s2[1][0]-s2[0][0],dz=s2[1][1]-s2[0][1];q.setFromAxisAngle(Y,-Math.atan2(dz,dx));mx.compose(v.set((s2[0][0]+s2[1][0])/2,.12,(s2[0][1]+s2[1][1])/2),q,sc.set(Math.hypot(dx,dz)+.02,.16,.2));cu.setMatrixAt(i,mx);cu.setColorAt(i,cc.set(i%2?'#e4e2da':'#1b9a90').offsetHSL(0,0,(rnd()-.5)*.06))});cu.receiveShadow=true;cu.name='painted-curbs';G.add(cu);
const F=c.foliage,fmt=F.mats(c),grp={g:[],y:[],r:[]},tint=['#ffffff','#e6f0d4','#d4e6bf'];
beds.forEach(P=>{for(let k=0;k<34;k++){const i=(rnd()*P.length)|0,n=nrm(P,i),l=(rnd()-.5)*(W-.7),kd=rnd()<.5?'g':rnd()<.55?'y':'r',px=P[i][0]+n[0]*l,pz=P[i][1]+n[1]*l,z0=.7+rnd()*.5;for(let j=0;j<5;j++)grp[kd].push([px+(rnd()-.5)*.5,.3+rnd()*.35,pz+(rnd()-.5)*.5,z0,-.5+rnd()*.6,rnd()*6.28,(rnd()-.5)*.8,kd=='g'?tint[(rnd()*3)|0]:'#ffffff'])}});
[['g',fmt.green],['y',fmt.yellow],['r',fmt.red]].forEach(([k,m])=>{if(grp[k].length){const i2=F.cards(c,m,grp[k],!c.mobile);i2.name='shrubs-'+k;G.add(i2)}});
const fl=new T.InstancedMesh(new T.SphereGeometry(.1,6,5),new T.MeshStandardMaterial({roughness:.6}),48);let fi=0;
beds.forEach(P=>{for(let k=0;k<24;k++){const i=(rnd()*P.length)|0,n=nrm(P,i),l=(rnd()-.5)*(W-.6);q.identity();mx.compose(v.set(P[i][0]+n[0]*l,.6+rnd()*.2,P[i][1]+n[1]*l),q,sc.set(1,1,1));fl.setMatrixAt(fi,mx);fl.setColorAt(fi++,cc.set(rnd()<.5?'#d1202a':'#e86a8a'))}});fl.name='flowers';G.add(fl);
// --- one street-light pole (position/height estimated)
bx(.14,6.5,.14,M(0x8a8f96),-1.5,0,3.5);bx(.9,.2,.4,M(0x2a2d31),-1.1,6.5,3.5);
G.add(F.blobs(c,[[0,0,5.6,3.4],[-7.35,0,4.2,1.2],[7.35,0,4.2,1.2],[-13.2,0,3.6,1.2],[13.2,0,3.6,1.2]]));
return{group:G,colliders:col,info:{estimated:true,source:'single user-supplied front photograph',tops:{center:6.25,wall:5.0},halfWidth:16.2}}}
const API={build};if(typeof module!=='undefined')module.exports=API;else root.MainGate=API})(typeof window!=='undefined'?window:globalThis);
