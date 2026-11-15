"""Check the two videos, slide controls, PDF and offline caching on several screen widths.

Cache policy under test (revised 2026-11-15 for first-load speed): install caches only the
app shell, data and woff2 fonts (~0.9 MB). Films, PDFs, the ZIP, posters and slide images are
cached in the background once the first screen is idle, so they are offline from a few seconds
after the first visit instead of being downloaded before anything renders. The 3:49.5 film is
never cached: it streams with range requests and is excluded from both tiers.
"""
import os
import pathlib
from playwright.sync_api import sync_playwright
URL=os.getenv('PROHOR_URL','http://127.0.0.1:3000')
OUT=pathlib.Path(__file__).resolve().parents[1]/'docs/test-results'
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch()
 for width in (320,390,768,1440):
  ctx=b.new_context(viewport={'width':width,'height':900});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(URL+'/#overview',wait_until='networkidle')
  assert page.get_by_role('heading',name='The mission, in a moment.').count()==1
  assert page.locator('.landing-film video').count()==1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.locator('.landing-film').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'landing-video-{width}.png'))
  page.locator('.landing-film > button').click();assert page.url.endswith('#judges');page.locator('.video-grid video').first.wait_for(state='visible',timeout=15000);assert page.locator('.video-grid video').count()==2;assert page.locator('.dossier-card').count()==4
  page.get_by_role('heading',name='A quieter watch. A clearer picture.').wait_for(state='visible',timeout=15000)
  for _ in range(6):page.get_by_role('button',name='Next slide').click()
  assert page.get_by_role('heading',name='Human first. Always.').count()==1;assert page.get_by_role('button',name='Next slide').is_disabled()
  page.get_by_role('button',name='Go to slide 4: One reading. More context.').click();assert page.get_by_text('5.6 hours against a 7.4-hour',exact=False).count()>=1
  page.locator('.slide-section').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'judges-slides-{width}.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  for path in ['/media/prohor-30-second.mp4','/media/prohor-four-minute.mp4']:
   res=ctx.request.get(URL+path,headers={'Range':'bytes=0-1023'}); assert res.status==206,(path,res.status);assert 'video/mp4' in res.headers.get('content-type','');assert len(res.body())==1024
  pdf=ctx.request.get(URL+'/docs/PROHOR_Seven_Slide_Presentation.pdf');assert pdf.status==200 and pdf.body().startswith(b'%PDF-')
  page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('!!navigator.serviceWorker.controller')
  # The shell is already cached at this point; the extras arrive from the background warm.
  shell=page.evaluate("async()=>{const keys=await caches.keys();const c=await caches.open(keys.find(x=>x.startsWith('prohor-')));return [(await c.match('/index.html'))!==undefined,(await c.match('/data/studies.json'))!==undefined]}");assert shell==[True,True],shell
  for _ in range(60):
   warm=page.evaluate("async()=>{const keys=await caches.keys();const c=await caches.open(keys.find(x=>x.startsWith('prohor-')));return (await c.match('/media/prohor-30-second.mp4'))!==undefined&&(await c.match('/docs/PROHOR_Seven_Slide_Presentation.pdf'))!==undefined}")
   if warm: break
   page.wait_for_timeout(500)
  cached=page.evaluate("async()=>{const keys=await caches.keys();const c=await caches.open(keys.find(x=>x.startsWith('prohor-')));return [(await c.match('/media/prohor-30-second.mp4'))!==undefined,(await c.match('/docs/PROHOR_Seven_Slide_Presentation.pdf'))!==undefined,(await c.match('/media/prohor-four-minute.mp4'))!==undefined]}");assert cached==[True,True,False],cached
  # The page's own request goes through the service worker: it must come back as a real
  # 206 slice, online and then from the cached copy, or seeking on desktop misbehaves.
  page.goto(URL+'/#judges',wait_until='networkidle')
  ranged='''async()=>{const r=await fetch('/media/prohor-30-second.mp4',{headers:{Range:'bytes=100-199'}});return [r.status,r.headers.get('content-range'),(await r.arrayBuffer()).byteLength]}'''
  online=page.evaluate(ranged)
  assert online[0]==206 and str(online[1]).startswith('bytes 100-199/') and online[2]==100,online
  ctx.set_offline(True);page.reload(wait_until='domcontentloaded')
  offline=page.evaluate(ranged)
  assert offline[0]==206 and str(offline[1]).startswith('bytes 100-199/') and offline[2]==100,offline
  ctx.set_offline(False)
  print('PASS',width,'byte ranges served as 206 through the worker, online and offline',flush=True)
  assert not errors,errors;print('PASS',width,'layout, video links, slide navigation, range and cache policy',flush=True);ctx.close()
 b.close()
