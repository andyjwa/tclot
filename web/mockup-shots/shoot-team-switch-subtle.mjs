import fs from 'node:fs';

const BROWSER_WS = process.argv[2];
const OUT = '/Users/andyw/TCLOT/web/mockup-shots';

function rpc(ws, pending) {
  let id = 0;
  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });
}
const ws = new WebSocket(BROWSER_WS);
const pending = new Map();
const eventWaiters = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  } else if (msg.method) {
    for (let i = eventWaiters.length - 1; i >= 0; i--) {
      if (eventWaiters[i].method === msg.method) { eventWaiters[i].resolve(msg.params); eventWaiters.splice(i, 1); }
    }
  }
});
const waitEvent = (method) => new Promise((resolve) => eventWaiters.push({ method, resolve }));
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

const send = rpc(ws, pending);
const { targetInfos } = await send('Target.getTargets');
const page = targetInfos.find((t) => t.type === 'page');
const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable');
await S('Page.navigate', { url: 'file:///Users/andyw/TCLOT/web/public/scorecard-team-switch-subtle.html' });
await waitEvent('Page.loadEventFired');
await new Promise((r) => setTimeout(r, 700));

const layout = await S('Page.getLayoutMetrics');
const full = layout.cssContentSize || layout.contentSize;
const shotAll = await S('Page.captureScreenshot', { format:'png', captureBeyondViewport:true, clip:{ x:0, y:0, width:full.width, height:full.height, scale:1 } });
fs.writeFileSync(`${OUT}/team-switch-subtle-all.png`, Buffer.from(shotAll.data, 'base64'));
console.log('wrote team-switch-subtle-all.png');

const { result } = await S('Runtime.evaluate', { returnByValue:true, expression:`(${() => {
  const els=[...document.querySelectorAll('.option')]; const sx=window.scrollX, sy=window.scrollY;
  return els.map((el,i)=>{const r=el.getBoundingClientRect();return {name:el.dataset.shot||String(i+1),x:r.left+sx,y:r.top+sy,width:r.width,height:r.height};});
}})()` });
for (const r of result.value) {
  const shot = await S('Page.captureScreenshot', { format:'png', captureBeyondViewport:true, clip:{ x:Math.max(0,r.x-8), y:Math.max(0,r.y-8), width:r.width+16, height:r.height+16, scale:1 } });
  fs.writeFileSync(`${OUT}/team-switch-subtle-${r.name}.png`, Buffer.from(shot.data, 'base64'));
  console.log('wrote', `team-switch-subtle-${r.name}.png`);
}
ws.close(); console.log('DONE'); process.exit(0);
