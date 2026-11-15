import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(`${dir}/${e.name}`) : `${dir}/${e.name}`,
      ),
    )
  ).flat();
}

/*
 * Cache policy (revised 2026-11-15 for first-load speed).
 *
 * CORE — the app, its data, its woff2 fonts, icons, manifest and licences — is
 * cached during install. That is what makes "open it on a plane" true.
 *
 * WARM — films, PDFs, the judges' ZIP, posters, slide images, the social card
 * and legacy .woff fonts — used to be downloaded during install too, which made
 * every first visit pull ~5.4 MB before anything was usable. They are now
 * fetched in the background after the first screen is idle (the page asks for
 * it with postMessage {type:'warm'}) and cached for offline use from then on.
 * A media file that is not cached yet simply streams.
 *
 * The 3:49.5 film itself is never cached: it is 6.6 MB and streamed on demand.
 * Its transcript and captions are, so an offline reader still has the words.
 */
const WARM = [
  /^\/media\/prohor-30-second\.mp4$/,
  /^\/media\/.*poster\.jpg$/,
  /^\/media\/.*\.(srt|vtt|txt)$/,
  /^\/docs\//,
  /^\/slides\//,
  /^\/og-image\.png$/,
  /^\/assets\/.*\.woff$/, // legacy Webfont format; woff2 is in CORE
];

/** The long film is never cached in either tier; it is streamed with ranges. */
const streamedOnly = /^\/media\/prohor-four-minute.*\.(mp4|webm)$/;
const files = (await walk("web"))
  .filter((f) => !f.endsWith("/sw.js"))
  .map((f) => "/" + f.slice(4))
  .filter((p) => !streamedOnly.test(p))
  .sort();
const core = files.filter((f) => !WARM.some((re) => re.test(f)));
const warm = files.filter((f) => WARM.some((re) => re.test(f)));

const digest = createHash("sha256");
for (const f of files) digest.update(await readFile("web" + f));
const name = "prohor-v3-" + digest.digest("hex").slice(0, 12);

/** Fails install only if the shell itself is missing; the rest are best effort. */
const SHELL =
  /^\/(index\.html|assets\/(index|react|zod|icons|csv)-.*\.(js|css))$/;

// Built with String.raw + JSON.stringify so a backslash reaches the worker as a
// backslash instead of being eaten by the template that generates it.
const FILM = String.raw`\.(mp4|webm)$`;
const PATH_OK = String.raw`^\/(assets|data|icons|docs|media|slides)\/`;
const RANGE = String.raw`^bytes=(\d*)-(\d*)$`;

const code = `const CACHE=${JSON.stringify(name)};
const FILM=new RegExp(${JSON.stringify(FILM)},"i");
const PATH_OK=new RegExp(${JSON.stringify(PATH_OK)});
const RANGE=new RegExp(${JSON.stringify(RANGE)});
const FILES=${JSON.stringify(core)}; // the install tier, also the CI parity check's name for it
const CORE=FILES;
const WARM=${JSON.stringify(warm)};
const SHELL=${SHELL};

async function cacheAll(list){
  const c=await caches.open(CACHE);
  let ok=true;
  await Promise.all(list.map(async f=>{
    try{ if(!(await c.match(f))) await c.add(f); }
    catch{ if(SHELL.test(f)) ok=false; }
  }));
  return ok;
}

async function warm(){
  await cacheAll(WARM);
  for(const client of await self.clients.matchAll()) client.postMessage({type:'warmed'});
}

self.addEventListener('install',e=>e.waitUntil((async()=>{
  if(!(await cacheAll(CORE))) throw new Error('PROHOR shell could not be cached');
  await self.skipWaiting();
})()));

self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys()) if(k.startsWith('prohor-')&&k!==CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='warm') e.waitUntil(warm());
});

/*
 * A cached video is one full-body 200 response, but a <video> element asks for
 * byte ranges. Answering those from the cache with a whole-body 200 is what made
 * the pitch behave badly on desktop: seeking stalls or jumps. So media is served
 * straight from the network while it is reachable -- the CDN answers ranges with
 * real 206s -- and the cache is only used when the network fails, sliced to the
 * range that was actually asked for.
 */
async function byRange(request,hit){
  const blob=await hit.blob();
  const total=blob.size;
  const headers=new Headers(hit.headers);
  headers.set('accept-ranges','bytes');
  headers.delete('content-encoding');
  const asked=request.headers.get('range');
  const m=asked?RANGE.exec(asked.trim()):null;
  if(!m){
    headers.set('content-length',String(total));
    return new Response(blob,{status:200,headers});
  }
  const from=m[1],to=m[2];
  let start,end;
  if(from===''){ start=Math.max(0,total-Number(to)); end=total-1; } // suffix: the last N bytes
  else { start=Number(from); end=to===''?total-1:Number(to); }
  if(!(start>=0)||!(end>=start)||start>=total){
    headers.set('content-range','bytes */'+total);
    headers.set('content-length','0');
    return new Response(null,{status:416,headers});
  }
  start=Math.min(start,total-1);
  end=Math.min(end,total-1);
  const body=blob.slice(start,end+1);
  headers.set('content-range','bytes '+start+'-'+end+'/'+total);
  headers.set('content-length',String(body.size));
  return new Response(body,{status:206,headers});
}

async function media(request,u){
  try{
    const res=await fetch(request);
    if(res) return res;
  }catch{}
  const c=await caches.open(CACHE);
  const hit=await c.match(u.origin+u.pathname);
  if(hit) return byRange(request,hit);
  const msg='This video is not available offline. The transcript is.';
  return new Response(msg,{status:504,headers:{'content-type':'text/plain; charset=utf-8'}});
}

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;
  if(u.pathname.startsWith('/api/')) return;
  if(FILM.test(u.pathname)){ e.respondWith(media(e.request,u)); return; }

  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const cached=await c.match('/index.html');
      // Race the network against a short deadline: a fast answer wins, a slow one
      // still gets a screen from cache instead of a white wait.
      try{
        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),3000);
        const res=await fetch(e.request,{signal:ctrl.signal});
        clearTimeout(timer);
        if(res&&res.ok){ await c.put('/index.html',res.clone()); return res; }
      }catch{}
      return cached||fetch(e.request);
    })());
    return;
  }

  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const hit=await c.match(e.request);
    if(hit) return hit;
    const res=await fetch(e.request);
    // Half a file is not a cache entry, so range requests are never stored.
    if(res&&res.ok&&!e.request.headers.has('range')&&PATH_OK.test(u.pathname))
      await c.put(e.request,res.clone());
    return res;
  })());
});
`;
await writeFile("web/sw.js", code);
console.log(
  "Offline cache:",
  core.length,
  "core files,",
  warm.length,
  "warmed later; cache",
  name,
);
