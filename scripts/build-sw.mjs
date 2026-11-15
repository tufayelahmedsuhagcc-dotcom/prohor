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
 * The 3:49.5 film is never cached: it is 6.6 MB and streamed on demand, with
 * range requests passed straight to the network.
 */
const WARM = [
  /^\/media\/prohor-30-second\.mp4$/,
  /^\/media\/.*poster\.jpg$/,
  /^\/media\/.*\.(srt|txt)$/,
  /^\/docs\//,
  /^\/slides\//,
  /^\/og-image\.png$/,
  /^\/assets\/.*\.woff$/, // legacy Webfont format; woff2 is in CORE
];

/** The long film is never cached in either tier; it is streamed with ranges. */
const streamedOnly = /^\/media\/prohor-four-minute/;
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
const PITCH = String.raw`^\/media\/prohor-30-second\.mp4$`;
const PATH_OK = String.raw`^\/(assets|data|icons|docs|media|slides)\/`;

const code = `const CACHE=${JSON.stringify(name)};
const FILM=new RegExp(${JSON.stringify(FILM)},"i");
const PITCH=new RegExp(${JSON.stringify(PITCH)});
const PATH_OK=new RegExp(${JSON.stringify(PATH_OK)});
const CORE=${JSON.stringify(core)};
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

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;
  if(u.pathname.startsWith('/api/')) return;
  if(FILM.test(u.pathname)&&!PITCH.test(u.pathname)) return; // the long film streams

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
    if(res&&res.ok && /^\\/(assets|data|icons|docs|media|slides)\\//.test(u.pathname))
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
