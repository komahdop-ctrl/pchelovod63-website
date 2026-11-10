import concurrent.futures, datetime, hashlib, json, pathlib, re, urllib.request, urllib.error, xml.etree.ElementTree as ET
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).parent
LIVE = ROOT / 'live'
LIVE.mkdir(exist_ok=True)
ORIGIN = 'https://pchelovod63.ru'

class Tags(HTMLParser):
    def __init__(self):
        super().__init__(); self.canonical=[];self.meta={};self.headings=[];self.title='';self.in_title=False;self.in_h1=False;self.h1s=[];self.ld=[];self.in_ld=False;self.buf='';self.links=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='link' and 'canonical' in a.get('rel','').split():self.canonical.append(a.get('href'))
        if tag=='meta':self.meta.setdefault(a.get('name') or a.get('property',''),[]).append(a.get('content',''))
        if re.fullmatch('h[1-6]',tag):self.headings.append(tag)
        if tag=='title':self.in_title=True
        if tag=='h1':self.in_h1=True;self.h1s.append('')
        if tag=='script' and a.get('type')=='application/ld+json':self.in_ld=True;self.buf=''
        if tag=='a' and a.get('href'):self.links.append(a['href'])
    def handle_data(self,data):
        if self.in_title:self.title+=data
        if self.in_h1:self.h1s[-1]+=data
        if self.in_ld:self.buf+=data
    def handle_endtag(self,tag):
        if tag=='title':self.in_title=False
        if tag=='h1':self.in_h1=False
        if tag=='script' and self.in_ld:
            try:self.ld.append({'valid_json':True,'data':json.loads(self.buf)})
            except Exception as e:self.ld.append({'valid_json':False,'error':str(e)})
            self.in_ld=False

def fetch(url):
    row={'url':url,'checked_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    request=urllib.request.Request(url,headers={'User-Agent':'PC63-04-SEO-Audit/1.0','Accept':'text/html,application/xml,text/plain;q=0.9'})
    try:
        try:response=urllib.request.urlopen(request,timeout=25)
        except urllib.error.HTTPError as e:response=e
        with response:
            body=response.read();row.update(status=response.status,final_url=response.url,headers=dict(response.headers.items()),bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
        text=body.decode('utf-8','replace')
        if url.startswith(ORIGIN+'/'):
            path=url.removeprefix(ORIGIN+'/') or 'index.html'
            if not path.endswith('/'):
                p=LIVE/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body)
        if 'html' in row['headers'].get('Content-Type',row['headers'].get('content-type','')):
            p=Tags();p.feed(text)
            row.update(title=p.title.strip(),canonical=p.canonical,description=p.meta.get('description',[]),og_url=p.meta.get('og:url',[]),og_title=p.meta.get('og:title',[]),robots=p.meta.get('robots',[]),h1=p.h1s,headings=p.headings,jsonld=p.ld,links=p.links,has_main='<main' in text)
        return row,text
    except Exception as e:row['error']=str(e);return row,''

robots,rt=fetch(ORIGIN+'/robots.txt');sitemap,st=fetch(ORIGIN+'/sitemap.xml')
urls=[x.text for x in ET.fromstring(st).findall('{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
extra=[ORIGIN+'/news/poezdka-orenburg-2026.html',ORIGIN+'/pc63-04-seo-missing-20261110.html',ORIGIN+'/index.html',ORIGIN+'/news/',ORIGIN+'/articles/','http://pchelovod63.ru/','https://www.pchelovod63.ru/']
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(fetch,urls+extra))
rows=[r for r,t in results]
for row in rows:
    if row['url'] not in urls:continue
    failures=[]
    if row.get('status')!=200:failures.append('HTTP not 200')
    if row.get('canonical')!=[row['url']]:failures.append('canonical mismatch/count')
    if len(row.get('h1',[]))!=1:failures.append('H1 count')
    if not row.get('title'):failures.append('missing title')
    if not row.get('description') or not row['description'][0]:failures.append('missing description')
    if not row.get('og_title') or row.get('og_url')!=[row['url']]:failures.append('OG missing/mismatch')
    headers={k.lower():v for k,v in row.get('headers',{}).items()}
    if any('noindex' in v.lower() for v in row.get('robots',[])) or 'noindex' in headers.get('x-robots-tag','').lower():failures.append('noindex in sitemap')
    if any(not j['valid_json'] for j in row.get('jsonld',[])):failures.append('invalid JSON-LD syntax')
    row['failures']=failures;row['metadata_status']='FAIL' if failures else 'PASS'
out={'started_for':'PC63-CUP-001 / PC63-04 DISPATCH-04 r1','robots':robots,'robots_text':rt,'sitemap':sitemap,'sitemap_urls':urls,'unique_urls':len(set(urls)),'results':rows}
(ROOT/'live-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sitemap_status':sitemap.get('status'),'robots_status':robots.get('status'),'urls':len(urls),'metadata_pass':sum(r.get('metadata_status')=='PASS' for r in rows),'failures':[{k:r.get(k) for k in ['url','status','failures','error']} for r in rows if r.get('metadata_status')=='FAIL'],'extra':[{k:r.get(k) for k in ['url','status','final_url','canonical','robots','error']} for r in rows if r['url'] not in urls]},ensure_ascii=False,indent=2))
