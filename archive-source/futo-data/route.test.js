const R=require('./route'),cfg=require('./route-layout.json');let n=0,f=0;const ck=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}},near=(a,b,t,m)=>ck(Math.abs(a-b)<t,m+' ('+a+' vs '+b+')');
const L=R.layout(cfg),g=id=>L.find(l=>l.id==id);
near(g('statue').distance,(56-12)*1.3,1e-9,'statue distance = (56-12)s x 1.3');near(g('statue').z,-(44*1.3),1e-9,'north is -z');near(g('statue').x,11,1e-9,'right offset is +x when heading north');
ck(L.every(l=>l.verified===false&&l.source.startsWith('video')),'all video-derived entries flagged unverified');
let ok=true;const order=['statue','river-bridge','health-tech-sign','urp-sign','soes-sign','fisheries-sign','nuclear-sign'];for(let i=1;i<order.length;i++)ok=ok&&g(order[i]).distance>=g(order[i-1]).distance;ck(ok,'distances follow the video order');
const c2=JSON.parse(JSON.stringify(cfg));c2.landmarks[0].minutesFromGate=2;c2.landmarks[0].bearingDeg=90;const s=R.layout(c2)[0];near(s.distance,2*60*1.3,1e-9,'user minutes override');near(s.x,156,1e-6,'east bearing moves +x');near(s.z,-11*0+11*Math.sin(Math.PI/2)*1,1e-6,'offset rotates with bearing (right of east = +z)');ck(s.source=='user-walking-time','override labelled as user data');
const c3=JSON.parse(JSON.stringify(cfg));c3.speedMps=2.6;near(R.layout(c3)[0].distance,2*g('statue').distance,1e-9,'speed scales distances');
console.log(n+' checks, '+f+' failed');process.exit(f?1:0);
