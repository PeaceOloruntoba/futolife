// Headless smoke test: runs the REAL page script in Node with a stubbed DOM and a stubbed WebGL renderer (three.js r128 from npm).
// It proves: no exceptions on load, the animation loop runs, keyboard movement works, collision blocks the booth, the gate opening is passable.
// It does NOT prove: anything renders correctly, touch input, performance, or appearance.
let _now=0;Object.defineProperty(globalThis,'performance',{value:{now:()=>(_now+=16.7)},configurable:true,writable:true});
const fs=require('fs'),vm=require('vm'),path=require('path'),THREE=require('three');
const html=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','futo-life-3d.html'),'utf8'),src=[...html.matchAll(/<script>\n([\s\S]*?)<\/script>/g)].pop()[1];
let fails=0,n=0;const ck=(c,m)=>{n++;if(!c){fails++;console.log('FAIL',m)}};
const handlers={},raf=[],mkCtx=()=>new Proxy({},{get:(t,k)=>k=='measureText'?()=>({width:10}):(k=='createLinearGradient'||k=='createRadialGradient')?()=>({addColorStop(){}}):()=>{},set:()=>true});
const el=()=>{const store={style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},clientWidth:800,clientHeight:600,children:[],dataset:{},value:''};return new Proxy(store,{get:(t,k)=>k in t?t[k]:(k=='getBoundingClientRect'?()=>({left:0,top:0,width:800,height:600}):k=='getContext'?mkCtx:k=='closest'?()=>null:k=='setPointerCapture'?()=>{}:k=='appendChild'||k=='addEventListener'||k=='insertAdjacentHTML'?()=>{}:()=>{}),set:(t,k,v)=>{t[k]=v;return true}})};
const els={},doc={getElementById:id=>els[id]||(els[id]=el()),createElement:t=>t=='canvas'?{width:0,height:0,getContext:mkCtx,style:{}}:el(),body:{insertAdjacentHTML(){}},addEventListener(){}};
class FakeRenderer{constructor(){this.shadowMap={};this.domElement=el()}setPixelRatio(){}setSize(){}render(){this.frames=(this.frames||0)+1}}
const T=Object.assign({},THREE,{WebGLRenderer:FakeRenderer});
const win={addEventListener:(e,f)=>{(handlers[e]=handlers[e]||[]).push(f)},innerWidth:800,devicePixelRatio:1,matchMedia:()=>({matches:false}),requestAnimationFrame:f=>{raf.push(f);return raf.length},performance:{now:()=>Date.now()},location:{reload(){}}};
const ctx=vm.createContext(Object.assign({THREE:T,document:doc,console,Math,Date,JSON,Float32Array,Uint8Array,Uint16Array,Uint32Array,Set,Map,Promise,setTimeout:(f)=>0,clearTimeout(){},FileReader:class{},matchMedia:win.matchMedia,innerWidth:800,devicePixelRatio:1,performance:win.performance,location:win.location,requestAnimationFrame:win.requestAnimationFrame,addEventListener:win.addEventListener,toastTimer:0},{}));ctx.window=ctx;
try{vm.runInContext(src,ctx,{filename:'page-script'});ck(true,'script executes without throwing')}catch(e){console.log('LOAD ERROR:',e.stack.split('\n').slice(0,4).join('\n'));process.exit(1)}
const ev=(t,o)=>(handlers[t]||[]).forEach(f=>f(Object.assign({key:'',target:{closest:()=>null},clientX:0,clientY:0,pointerId:1,preventDefault(){}},o)));
const get=e=>vm.runInContext(e,ctx);
const run=(frames)=>{for(let i=0;i<frames;i++){const f=raf.shift();if(!f)return false;f(0)}return true};
// Date-based clock: THREE.Clock uses performance.now; fake a 60 fps clock
try{ck(run(5),'animation loop is running');
ck(get('walls.length')>0&&get('B.length')>=1,'colliders and an enterable building are registered');
ck(get('Math.abs(P.x)<1e-9&&P.z===7'),'spawn is at the Main Gate (0, 7)');
// 1) walk straight north from spawn: the booth block must stop the player
ev('keydown',{key:'w'});run(400);const z1=get('P.z');ev('keyup',{key:'w'});ck(z1>2.0&&z1<6.9,'booth blocks a straight walk north (stopped at z='+z1.toFixed(2)+')');
// 2) teleport in front of the right vehicle opening and walk through it
vm.runInContext('P.x=6.9;P.z=7;P.vx=P.vz=0;P.tx=null;',ctx);ev('keydown',{key:'w'});run(500);const z2=get('P.z');ev('keyup',{key:'w'});ck(z2<-6,'player walks through the right vehicle opening (z='+z2.toFixed(1)+')');
// 3) left opening
vm.runInContext('P.x=-6.9;P.z=7;P.vx=P.vz=0;P.tx=null;',ctx);ev('keydown',{key:'w'});run(500);const z3=get('P.z');ev('keyup',{key:'w'});ck(z3<-6,'player walks through the left vehicle opening (z='+z3.toFixed(1)+')');
// 4) avatar animates while walking
vm.runInContext('P.x=6.9;P.z=7;P.vx=P.vz=0;P.tx=null;',ctx);ev('keydown',{key:'w'});run(30);ck(get('Math.abs(me.userData.av.parts.hipL.rotation.x)')>.01,'avatar legs animate while walking');ev('keyup',{key:'w'});ck(!!get('me.userData.av'),'player uses the human avatar');
// 5) camera toggle does not throw and toggles visibility
els.cam.onclick();run(2);ck(get('me.visible')===false,'camera toggle -> first person hides the avatar');els.cam.onclick();run(2);ck(get('me.visible')===true,'camera toggle -> third person shows the avatar');
// 6) map walk-to
vm.runInContext('walkTo(6.9,-30)',ctx);run(900);ck(get('Math.hypot(P.x-6.9,P.z+30)')<3||get('P.tx')===null,'map auto-walk runs without error');
// 7) run 600 more frames for runtime exceptions in bots/labels
ck(run(600),'600 further frames run without error');
ck(get('renderer'in{}?1:1),'done');
}catch(e){fails++;console.log('RUNTIME ERROR:',e.stack.split('\n').slice(0,5).join('\n'))}
console.log(n+' checks, '+fails+' failed');process.exit(fails?1:0);
