const Z=require('./geozone');
let fail=0,n=0;const ck=(c,m)=>{n++;if(!c){fail++;console.log('FAIL',m)}},near=(a,b,t,m)=>ck(Math.abs(a-b)<t,m+' ('+a+' vs '+b+')');
const gj=JSON.parse(require('fs').readFileSync(__dirname+'/test-fixture.geojson','utf8')),O={lat:0,lng:0},M=111319.49;
// conversions
let a=Z.toWorld(0.001,0.001,O);near(a.x,M*.001,.01,'x scale');near(a.z,-M*.001,.01,'north is -z');
let b=Z.toLatLng(a.x,a.z,O);near(b.lat,.001,1e-9,'rt lat');near(b.lng,.001,1e-9,'rt lng');
let c=Z.toWorld(5.38,7.031,{lat:5.38,lng:7.03});near(c.x,M*.001*Math.cos(5.38*Math.PI/180),.02,'cos(lat) scaling at Owerri-like latitude (test only)');
// parsing known features
const z=Z.parseGeoJSON(gj,O);ck(z.buildings.length==2&&z.roads.length==2&&z.points.length==1,'feature counts');ck(z.warnings.length==0,'no warnings on clean fixture');
const A=z.buildings.find(x=>x.id=='bldg-a');near(A.bbox.x0,M*.0003,.01,'A x0');near(A.bbox.x1,M*.0006,.01,'A x1');near(A.bbox.z0,-M*.0005,.01,'A z0');near(A.areaM2,(M*.0003)*(M*.0002),.5,'A area');near(A.height,10.2,1e-9,'A height from floors');
const B=z.buildings.find(x=>x.id=='bldg-b');near(B.height,7,1e-9,'B height');ck(!z.buildings.some(x=>x.verification!='unverified'),'all fixture features stay unverified');
const r=z.roads.find(x=>x.id=='road-a');near(r.width,7,1e-9,'tertiary width');near(Math.hypot(r.pts[1][0]-r.pts[0][0],r.pts[1][1]-r.pts[0][1]),M*.0012,.01,'road segment length');
const g=z.points[0];near(g.x,0,1e-9,'gate x');near(g.z,0,1e-9,'gate z');
// robustness
let w=Z.parseGeoJSON({type:'FeatureCollection',features:[{type:'Feature',properties:{id:'bad'},geometry:{type:'Point',coordinates:[999,5]}},{type:'Feature',properties:{id:'open'},geometry:{type:'Polygon',coordinates:[[[0,0],[.0001,0],[.0001,.0001],[0,.0001]]]}},{type:'Feature',properties:{id:'nog'},geometry:null},{type:'Feature',properties:{id:'mp'},geometry:{type:'MultiPoint',coordinates:[]}},{type:'Feature',properties:{id:'v',verification:'verified'},geometry:{type:'Point',coordinates:[0,0]}}]},O);
ck(w.warnings.length==4&&w.points.length==1&&w.buildings.length==1,'bad/open/no-geometry/unsupported handled: '+JSON.stringify(w.warnings));ck(w.points[0].verification=='verified','explicit verified preserved');
ck(Z.parseGeoJSON(gj,null).warnings[0]=='No origin set','missing origin refused');ck(Z.parseGeoJSON({},O).warnings.length==1,'non-FeatureCollection refused');
// geometry build (three@0.128 from npm, no WebGL needed)
const T=require('three'),bz=Z.buildZone(T,z),box=new T.Box3().setFromObject(bz.group);
ck(bz.colliders.length==2&&bz.group.children.length==3,'zone has roads mesh + 2 buildings');
near(box.max.y,10.2,.01,'tallest building height in geometry');ck(box.min.y>=0,'nothing below ground');
const bA=new T.Box3().setFromObject(bz.group.children.find(m=>m.name=='bldg-a'));near(bA.min.x,M*.0003,.01,'mesh A min x');near(bA.max.x,M*.0006,.01,'mesh A max x');near(bA.min.z,-M*.0005,.01,'mesh A min z (north=-z)');near(bA.max.z,-M*.0003,.01,'mesh A max z');
const rb=new T.Box3().setFromObject(bz.group.children[0]);ck(rb.max.z>rb.min.z&&rb.min.z<-M*.0012,'road mesh extends north');
console.log(n+' checks, '+fail+' failed');process.exit(fail?1:0);
