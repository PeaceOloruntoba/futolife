(function(root){
const R=6378137,rad=d=>d*Math.PI/180;
function toWorld(lat,lng,o){return{x:rad(lng-o.lng)*R*Math.cos(rad(o.lat)),z:-rad(lat-o.lat)*R}}
function toLatLng(x,z,o){return{lat:o.lat-z/R*180/Math.PI,lng:o.lng+x/(R*Math.cos(rad(o.lat)))*180/Math.PI}}
const okLL=c=>Array.isArray(c)&&c.length>=2&&isFinite(c[0])&&isFinite(c[1])&&Math.abs(c[1])<=90&&Math.abs(c[0])<=180;
const area=r=>{let a=0;for(let i=0;i<r.length-1;i++)a+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];return a/2};
const RW={motorway:12,trunk:12,primary:10,secondary:8,tertiary:7,residential:6,service:4,unclassified:6,footway:2,path:1.5,pedestrian:3,cycleway:2};
// GeoJSON (lng,lat) -> world metres about origin. Unknown verification => 'unverified'. Never throws on bad features.
function parseGeoJSON(g,o){const out={buildings:[],roads:[],points:[],warnings:[]},w=m=>out.warnings.push(m);
if(!o||!isFinite(o.lat)||!isFinite(o.lng)){w('No origin set');return out}
if(!g||g.type!=='FeatureCollection'||!Array.isArray(g.features)){w('Not a FeatureCollection');return out}
g.features.forEach((f,i)=>{const p=f.properties||{},id=String(p.id||f.id||'feature-'+i),geo=f.geometry;if(!geo){w(id+': no geometry');return}
const v=p.verification==='verified'?'verified':'unverified';
const conv=c=>{if(!okLL(c))throw new Error('bad coordinate');const q=toWorld(c[1],c[0],o);return[q.x,q.z]};
try{
if(geo.type==='Point'){const q=conv(geo.coordinates);out.points.push({id,name:p.name||id,x:q[0],z:q[1],role:p.role||null,verification:v,props:p})}
else if(geo.type==='LineString'||geo.type==='MultiLineString'){(geo.type==='LineString'?[geo.coordinates]:geo.coordinates).forEach((l,k)=>{if(l.length<2){w(id+': short line');return}out.roads.push({id:id+(k?'#'+k:''),name:p.name||'',pts:l.map(conv),width:+p.width||RW[p.highway]||5,highway:p.highway||null,verification:v,props:p})})}
else if(geo.type==='Polygon'||geo.type==='MultiPolygon'){(geo.type==='Polygon'?[geo.coordinates]:geo.coordinates).forEach((poly,k)=>{const ring=poly[0].map(conv),a=ring[0],b=ring[ring.length-1];if(a[0]!==b[0]||a[1]!==b[1]){w(id+': ring not closed, closed automatically');ring.push(a)}if(ring.length<4){w(id+': degenerate ring');return}
const xs=ring.map(r=>r[0]),zs=ring.map(r=>r[1]),fl=+p.floors,ht=+p.height||(fl?fl*3.4:null);
out.buildings.push({id:id+(k?'#'+k:''),name:p.name||id,ring,areaM2:Math.abs(area(ring)),bbox:{x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)},height:ht,heightKnown:!!ht,verification:v,props:p})})}
else w(id+': unsupported geometry '+geo.type)}catch(e){w(id+': '+e.message)}});
return out}
// Neutral massing + road ribbons. No facade detail is invented. Colliders are bounding boxes (+0.9 m).
function buildZone(T,z){const g=new T.Group(),col=[],pos=[];
const rm=new T.MeshStandardMaterial({color:0x4a4d52,roughness:.95,side:T.DoubleSide}),bm=new T.MeshStandardMaterial({color:0xcfc9bd,roughness:.85});
z.roads.forEach(r=>{const h=r.width/2;for(let i=0;i<r.pts.length-1;i++){const a=r.pts[i],b=r.pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<1e-6)continue;const nx=-dz/l*h,nz=dx/l*h;
[[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]+nx,b[1]+nz],[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]].forEach(q=>pos.push(q[0],.03,q[1]))}});
if(pos.length){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(pos.map((_,i)=>i%3==1?1:0),3));const m=new T.Mesh(geo,rm);m.receiveShadow=true;m.name='roads';g.add(m)}
z.buildings.forEach(b=>{const s=new T.Shape(b.ring.map(r=>new T.Vector2(r[0],-r[1]))),geo=new T.ExtrudeGeometry(s,{depth:b.height||8,bevelEnabled:false});geo.rotateX(-Math.PI/2);const m=new T.Mesh(geo,bm);m.castShadow=m.receiveShadow=true;m.name=b.id;g.add(m);col.push({id:b.id,x0:b.bbox.x0-.9,x1:b.bbox.x1+.9,z0:b.bbox.z0-.9,z1:b.bbox.z1+.9})});
return{group:g,colliders:col}}
const API={toWorld,toLatLng,parseGeoJSON,buildZone};
if(typeof module!=='undefined')module.exports=API;else root.GeoZone=API})(typeof window!=='undefined'?window:globalThis);
