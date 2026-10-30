(function(root){
// Place landmarks along a route from the gate. bearing: 0 = north (-z), 90 = east (+x). offset: metres to the RIGHT of the direction of travel.
function layout(cfg){const sp=cfg.speedMps||1.3,cp=cfg.compression||1;return cfg.landmarks.map(l=>{const user=l.minutesFromGate!=null,sec=user?l.minutesFromGate*60:Math.max(0,(l.videoSec-cfg.departSec))*cp,d=sec*sp,b=((l.bearingDeg!=null?l.bearingDeg:cfg.bearingDeg)||0)*Math.PI/180,o=l.offset||0;
return Object.assign({},l,{distance:d,x:Math.sin(b)*d+Math.cos(b)*o,z:-Math.cos(b)*d+Math.sin(b)*o,source:user?'user-walking-time':'video-time (unreliable)',verified:false})})}
const API={layout};if(typeof module!=='undefined')module.exports=API;else root.Route=API})(typeof window!=='undefined'?window:globalThis);
