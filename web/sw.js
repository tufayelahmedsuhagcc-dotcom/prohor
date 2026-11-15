const CACHE="prohor-v3-5d03d27ffe9c";
const FILM=new RegExp("\\.(mp4|webm)$","i");
const PITCH=new RegExp("^\\/media\\/prohor-30-second\\.mp4$");
const PATH_OK=new RegExp("^\\/(assets|data|icons|docs|media|slides)\\/");
const CORE=["/assets/About-MSvD_5g7.js","/assets/Actions-BZjNcYcV.js","/assets/Environment-D_XTG5-1.js","/assets/Evidence-BsYeGiRk.js","/assets/Handover-DovYA38F.js","/assets/Judges-NzhKwkxQ.js","/assets/Logbook-DqLOpYPa.js","/assets/Replay-DvoaCZeG.js","/assets/Settings-D32Qj7Ca.js","/assets/Trends-BVc0i8q5.js","/assets/csv-CkvfGzCZ.js","/assets/feeds-DZuw9EOh.js","/assets/icons-DVjE3ElW.js","/assets/index-Bz-k19Fw.css","/assets/index-CX6gN6q6.js","/assets/inter-latin-400-normal-C38fXH4l.woff2","/assets/inter-latin-500-normal-Cerq10X2.woff2","/assets/inter-latin-600-normal-LgqL8muc.woff2","/assets/papa-uG9AWU9K.js","/assets/react-CZAAIC1q.js","/assets/space-grotesk-latin-400-normal-CJ-V5oYT.woff2","/assets/space-grotesk-latin-500-normal-lFbtlQH6.woff2","/assets/space-grotesk-latin-600-normal-DjKNqYRj.woff2","/assets/zod-CuC_3cpb.js","/data/donki-events.json","/data/osd575-file-index.json","/data/osd575-submitted.csv","/data/osd575-transformed.csv","/data/osd575.json","/data/proton-flux.json","/data/source-manifest.json","/data/space-weather.json","/data/studies.json","/icons/icon-192.png","/icons/icon-512.png","/icons/mark.svg","/index.html","/licenses/PROHOR-MIT.txt","/licenses/THIRD-PARTY.txt","/manifest.webmanifest","/robots.txt","/sitemap.xml"];
const WARM=["/assets/inter-latin-400-normal-CyCys3Eg.woff","/assets/inter-latin-500-normal-BL9OpVg8.woff","/assets/inter-latin-600-normal-CiBQ2DWP.woff","/assets/space-grotesk-latin-400-normal-BnQMeOim.woff","/assets/space-grotesk-latin-500-normal-CNSSEhBt.woff","/assets/space-grotesk-latin-600-normal-BflQw4A9.woff","/docs/PROHOR_01_Mission_and_Demo.pdf","/docs/PROHOR_02_Data_and_Evidence.pdf","/docs/PROHOR_03_Technology_and_Method.pdf","/docs/PROHOR_04_Safety_Impact_and_Roadmap.pdf","/docs/PROHOR_Judges_Brief.pdf","/docs/PROHOR_Judges_Library.zip","/docs/PROHOR_Seven_Slide_Presentation.pdf","/media/prohor-30-second-transcript.txt","/media/prohor-30-second.mp4","/media/prohor-30-second.srt","/media/prohor-long-poster.jpg","/media/prohor-short-poster.jpg","/og-image.png","/slides/atlas.jpg","/slides/baseline.jpg","/slides/handover.jpg","/slides/nasa.jpg","/slides/offline.jpg"];
const SHELL=/^\/(index\.html|assets\/(index|react|zod|icons|csv)-.*\.(js|css))$/;

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
    if(res&&res.ok && /^\/(assets|data|icons|docs|media|slides)\//.test(u.pathname))
      await c.put(e.request,res.clone());
    return res;
  })());
});
