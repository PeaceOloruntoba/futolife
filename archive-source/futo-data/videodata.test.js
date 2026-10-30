const j=require('./video-route.json'),fs=require('fs');let n=0,f=0;const ck=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}};
const raw=JSON.stringify(j).toUpperCase(),page=fs.readFileSync('../futo-life-3d.html','utf8').toUpperCase();
['MARITIME','MICROFINANCE'].forEach(w=>ck(!j.events.some(e=>((e.name||'')+' '+(e.text||'')).toUpperCase().includes(w)),w+' is not used in any event name or sign text'));
ck(j.events.filter(e=>e.type=='building').every(e=>e.identity=='unidentified'),'every building is marked unidentified');
ck(j.events.filter(e=>e.type=='sign').every(e=>e.kind=='confirmed-sign'&&e.confidence&&e.evidence&&e.building),'every sign has kind, confidence, evidence and a building-not-established note');
const sci=j.events.find(e=>e.text=='DEPARTMENT OF SCIENCE LABORATORY TECHNOLOGY'),atm=j.events.find(e=>e.text=='STANBIC IBTC BANK ATM');ck(sci&&sci.t==312&&sci.confidence=='high','Science Laboratory Technology sign at 5:12');ck(atm&&atm.t==336&&atm.confidence=='high','Stanbic IBTC ATM sign at 5:36');
ck(j.events.every((e,i,a)=>i==0||(a[i-1].t||a[i-1].t0||0)<=(e.t||e.t0||0)),'events are in chronological order');
ck(page.includes(JSON.stringify(j.events[0]).toUpperCase().slice(0,40)),'page inline copy contains the corrected data');ck(!/"NAME":"[^"]*(MARITIME|MICROFINANCE)/.test(page),'page inline data has no Maritime/Microfinance names');
console.log(n+' checks, '+f+' failed');process.exit(f?1:0);
