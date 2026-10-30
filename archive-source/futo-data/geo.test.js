const { toWorld, toLatLng } = require('./geo');
const o = { lat: 0, lng: 0 }; // arbitrary test origin, NOT a FUTO coordinate
const a = toWorld(0.001, 0.001, o), eq = (v, w, t = 0.5) => Math.abs(v - w) < t;
console.assert(eq(a.x, 111.32) && eq(a.z, -111.32), 'scale ~111.3 m per 0.001 deg at equator');
const b = toLatLng(a.x, a.z, o); console.assert(eq(b.lat, 0.001, 1e-9) && eq(b.lng, 0.001, 1e-9), 'round trip');
const n = toWorld(0.002, 0, o); console.assert(n.z < 0 && n.x === 0, 'north is -z');
console.log('geo tests passed');
