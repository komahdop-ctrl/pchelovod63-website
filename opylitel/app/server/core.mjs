import {REGIONS,CROPS,externalValid} from '../config/regions.mjs';
import {Invalid,validateGeometry,bboxIntersects,km} from '../config/geometry.mjs';
const now=()=>new Date().toISOString(),uid=()=>crypto.randomUUID();
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const PERSONAS={farmer:{actor:'synthetic-farmer-a',role:'agrarian',region:'63'},other:{actor:'synthetic-farmer-b',role:'agrarian',region:'63'},beekeeper:{actor:'synthetic-beekeeper',role:'beekeeper',region:'63'},coordinator:{actor:'synthetic-coordinator-63',role:'coordinator',region:'63'},foreign:{actor:'synthetic-coordinator-16',role:'coordinator',region:'16'},admin:{actor:'synthetic-admin',role:'admin',region:null}};
function json(x,status=200,extra={}){return new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',...extra}})}
function must(ok,message='Доступ запрещён.',status=403){if(!ok)throw new Invalid(message,status)}
function integer(x,lo,hi){return Number.isInteger(x)&&x>=lo&&x<=hi}
function date(x){return typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x}
function exact(d,keys){must(d&&typeof d==='object'&&!Array.isArray(d),'Нужен JSON объект.',422);must(Object.keys(d).every(k=>keys.includes(k)),'Неизвестные поля. Личные контакты в тестовый сервис не принимаются.',422)}
async function regions(db){const rows=await db.all('SELECT * FROM regions');return REGIONS.map(r=>{const row=rows.find(x=>x.id===r.id);return row?{...r,status:row.status,external:row.external?JSON.parse(row.external):null}:r})}
async function active(db,id){const r=(await regions(db)).find(r=>r.id===id);must(r&&r.status==='ACTIVE','Приём в этом регионе выключен. Выберите доступный регион.',409)}
async function log(db,user,action,id){await db.run('INSERT INTO audit VALUES (?,?,?,?,?)',[uid(),user.actor,action,id,now()])}
function publicField(r){return {id:r.id,season:r.season,region_id:r.region_id,geometry:JSON.parse(r.geometry),crop:r.crop,area_ha:r.area_ha,area_source:'Расчёт на сфере R=6371008,8 м (приближение, не кадастр)',declared_ha:r.declared_ha,start:r.start,end:r.end,families:r.families,status:r.status,demo:true}}
function privateField(r){return {...publicField(r),visibility:r.visibility,version:r.version,price:r.price}}
function writable(u,r){return u.role==='agrarian'&&r.owner_id===u.actor}
function readable(u,r){return writable(u,r)||u.role==='admin'||u.role==='coordinator'&&u.region===r.region_id}
function parseField(d){exact(d,['season','region_id','geometry','crop','declared_ha','start','end','families','price','version']);must(integer(d.season,2027,2035),'Сезон: 2027–2035.',422);must(REGIONS.some(x=>x.id===d.region_id),'Укажите регион.',422);must(CROPS.includes(d.crop),'Выберите культуру.',422);must(date(d.start)&&date(d.end)&&d.start<=d.end&&d.start.startsWith(String(d.season))&&d.end.startsWith(String(d.season)),'Проверьте даты выбранного сезона.',422);must(integer(d.families,1,100000),'Укажите потребность, подтверждённую владельцем (1–100000).',422);must(d.declared_ha==null||typeof d.declared_ha==='number'&&d.declared_ha>.0&&d.declared_ha<=100000,'Проверьте заявленную площадь.',422);must(d.price==null||integer(d.price,1,1000000),'Проверьте бюджет за семью.',422);return {...d,...validateGeometry(d.geometry)}}
function parseApplication(d,role){exact(d,['region_id','district','season','crop','families','radius_km','origin','start','end','price','declared_ha','consent','consentVersion']);must(['Тестовый район А','Тестовый район Б'].includes(d.district),'Выберите вымышленный тестовый район.',422);must(d.consent===true&&d.consentVersion==='synthetic-v1','Подтвердите тестовый характер заявки.',422);must(integer(d.season,2027,2035)&&CROPS.includes(d.crop)&&REGIONS.some(r=>r.id===d.region_id),'Проверьте сезон, культуру и регион.',422);must(integer(d.families,1,100000),'Число семей: 1–100000.',422);must(date(d.start)&&date(d.end)&&d.start<=d.end&&d.start.startsWith(String(d.season))&&d.end.startsWith(String(d.season)),'Проверьте даты.',422);must(d.price==null||integer(d.price,1,1000000),'Проверьте цену.',422);if(role==='beekeeper'){must(integer(d.radius_km,1,2000),'Радиус: 1–2000 км.',422);must(Array.isArray(d.origin)&&d.origin.length===2&&d.origin.every(Number.isFinite)&&Math.abs(d.origin[0])<=180&&Math.abs(d.origin[1])<=85,'Неверная тестовая точка отправления.',422)}else must(typeof d.declared_ha==='number'&&d.declared_ha>0&&d.declared_ha<=100000,'Укажите площадь.',422);return {...d,synthetic_contact:'TEST_CONTACT_ONLY',consentRecordedAt:now()}}
export async function api(request,db,context={}){
 const url=new URL(request.url),p=url.pathname.replace(/^\/opylitel\/app/,'').replace(/^\/api/,'');
 try{
  // No configuration can enable production intake in this implementation.
  if(p==='/intake'||context.mode!=='synthetic')return json({error:'Реальный приём закрыт. Сервис работает только с вымышленными данными.'},503);
  const slot=Math.floor(Date.now()/60000),key=await digest(`${context.clientKey||'local'}:${slot}`);
  const count=await db.one('INSERT INTO rate_limits(id,hits,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=hits+1 RETURNING hits',[key,(slot+2)*60000]);
  if(count.hits>(context.limit||180))return json({error:'Слишком много запросов. Подождите минуту.'},429,{'Retry-After':'60'});
  await db.run('DELETE FROM rate_limits WHERE expires < ?',[Date.now()]);
  let d=null;
  if(!['GET','HEAD'].includes(request.method)){
   must(request.headers.get('Origin')===url.origin,'Запрос с другого сайта отклонён.');
   must(request.headers.get('Content-Type')?.split(';')[0].trim()==='application/json','Нужен application/json.',415);
   must(Number(request.headers.get('Content-Length')||0)<=32768,'Запрос слишком большой.',413);
   const reader=request.body?.getReader();let chunks=[],size=0;if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw new Invalid('Запрос слишком большой.',413)}chunks.push(value)}}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new Invalid('Неверная кодировка UTF-8.')} 
   try{d=JSON.parse(raw)}catch{throw new Invalid('Неверный JSON.')}
  }
  if(p==='/health')return json({status:'synthetic-only',realIntake:false,version:context.releaseId||'EUCP-OPY-001-r3'});
  if(p==='/regions'&&request.method==='GET')return json(await regions(db));
  if(p==='/demo/session'&&request.method==='POST'){
   exact(d,['persona']);const u=typeof d.persona==='string'&&Object.hasOwn(PERSONAS,d.persona)?PERSONAS[d.persona]:null;must(u,'Нет такой тестовой роли.',422);
   const token=uid()+uid(),csrf=uid();await db.run('DELETE FROM sessions WHERE expires<?',[Date.now()]);await db.run('INSERT INTO sessions VALUES (?,?,?,?,?,?)',[await digest(token),u.actor,u.role,u.region,csrf,Date.now()+3600000]);
   return json({role:u.role,region:u.region,csrf,demo:true},200,{'Set-Cookie':`opy_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${url.protocol==='https:'?'; Secure':''}`});
  }
  const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)opy_session=([^;]+)/)?.[1];
  const u=token?await db.one('SELECT * FROM sessions WHERE id=? AND expires>?',[await digest(token),Date.now()]):null;
  if(p==='/session'&&request.method==='GET')return json(u?{role:u.role,region:u.region,csrf:u.csrf,demo:true}:null);
  // Published records: explicit whitelist, status + visibility + region at request time.
  if(p==='/fields'&&request.method==='GET'&&!url.searchParams.has('mine')){
   const rs=await regions(db),valid=rs.filter(r=>r.status==='ACTIVE').map(r=>r.id);let rows=await db.all("SELECT * FROM fields WHERE status='published'");
   let box=null;if(url.searchParams.has('bbox')){box=url.searchParams.get('bbox').split(',').map(Number);must(box.length===4&&box.every(Number.isFinite)&&box[0]<box[2]&&box[1]<box[3]&&box[0]>=-180&&box[2]<=180&&box[1]>=-85&&box[3]<=85,'Неверный bbox.',422)}
   rows=rows.filter(r=>valid.includes(r.region_id)&&(r.visibility==='public'||u?.role==='beekeeper'&&r.visibility==='beekeepers'));
   for(const k of ['season','region_id','crop'])if(url.searchParams.get(k))rows=rows.filter(r=>String(r[k])===url.searchParams.get(k));
   if(url.searchParams.get('start')){must(date(url.searchParams.get('start')),'Неверная дата.',422);rows=rows.filter(r=>r.end>=url.searchParams.get('start'))}
   if(url.searchParams.get('end')){must(date(url.searchParams.get('end')),'Неверная дата.',422);rows=rows.filter(r=>r.start<=url.searchParams.get('end'))}
   if(url.searchParams.get('start')&&url.searchParams.get('end'))must(url.searchParams.get('start')<=url.searchParams.get('end'),'Начало периода позже окончания.',422);
   if(box)rows=rows.filter(r=>bboxIntersects(JSON.parse(r.geometry),box));
   return json({type:'FeatureCollection',features:rows.slice(0,300).map(r=>({type:'Feature',id:r.id,geometry:JSON.parse(r.geometry),properties:(({geometry,...x})=>x)(publicField(r))}))});
  }
  must(u,'Войдите в тестовую роль.',401);
  if(!['GET','HEAD'].includes(request.method))must(request.headers.get('X-CSRF-Token')===u.csrf,'Недействительный CSRF-токен.');
  if(p==='/logout'&&request.method==='POST'){await db.run('DELETE FROM sessions WHERE id=?',[u.id]);return json({ok:true},200,{'Set-Cookie':'opy_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict'})}
  if(p==='/fields'&&request.method==='GET'){
   const rows=u.role==='admin'?await db.all('SELECT * FROM fields'):u.role==='coordinator'?await db.all('SELECT * FROM fields WHERE region_id=?',[u.region]):await db.all('SELECT * FROM fields WHERE owner_id=?',[u.actor]);return json(rows.map(privateField));
  }
  if(p==='/fields'&&request.method==='POST'){
   must(u.role==='agrarian');const f=parseField(d);await active(db,f.region_id);const n=await db.one('SELECT COUNT(*) AS n FROM fields WHERE owner_id=?',[u.actor]);must(n.n<30,'Тестовый лимит: 30 полей на роль.',409);const id=uid(),t=now();
   await db.run('INSERT INTO fields(id,owner_id,season,region_id,geometry,crop,area_ha,declared_ha,start,end,families,price,status,visibility,version,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,u.actor,f.season,f.region_id,JSON.stringify(f.geometry),f.crop,f.area_ha,f.declared_ha??null,f.start,f.end,f.families,f.price??null,'draft','private',1,t,t]);await log(db,u,'field.create',id);return json(privateField(await db.one('SELECT * FROM fields WHERE id=?',[id])),201);
  }
  const fm=p.match(/^\/fields\/([a-f0-9-]{36})(?:\/(publish|close|unpublish|archive))?$/);
  if(fm){const [,id,action]=fm,r=await db.one('SELECT * FROM fields WHERE id=?',[id]);must(r&&readable(u,r),'Поле не найдено.',404);
   if(request.method==='GET'&&!action)return json(privateField(r));must(writable(u,r));
   if(request.method==='DELETE'&&!action){exact(d,[]);if(db.deleteRecord)await db.deleteRecord('field',id,now());else await db.batch([{sql:'DELETE FROM fields WHERE id=?',params:[id]},{sql:'INSERT INTO deletions VALUES (?,?,?)',params:[id,'field',now()]}]);await log(db,u,'field.delete',id);return json({ok:true})}
   if(request.method==='PUT'&&!action){const f=parseField(d);must(d.version===r.version,'Поле уже изменено. Перезагрузите данные.',409);must(r.status!=='published','Сначала снимите поле с публикации.',409);await active(db,f.region_id);const result=await db.run('UPDATE fields SET season=?,region_id=?,geometry=?,crop=?,area_ha=?,declared_ha=?,start=?,end=?,families=?,price=?,version=version+1,updated=? WHERE id=? AND version=?',[f.season,f.region_id,JSON.stringify(f.geometry),f.crop,f.area_ha,f.declared_ha??null,f.start,f.end,f.families,f.price??null,now(),id,d.version]);must(result.changes===1,'Конфликт изменений.',409);await log(db,u,'field.update',id);return json(privateField(await db.one('SELECT * FROM fields WHERE id=?',[id])))}
   if(request.method==='POST'&&action){exact(d,['visibility','confirmGeometry']);let status=action==='publish'?'published':action==='close'?'closed':action==='archive'?'archived':'draft',visibility='private';if(action==='publish'){must(d.confirmGeometry===true&&['public','beekeepers'].includes(d.visibility),'Отдельно подтвердите публикацию точной геометрии и аудиторию.',422);await active(db,r.region_id);visibility=d.visibility}await db.run('UPDATE fields SET status=?,visibility=?,version=version+1,updated=? WHERE id=?',[status,visibility,now(),id]);await log(db,u,'field.'+action,id);return json({ok:true,status})}
  }
  if(p==='/applications'&&request.method==='POST'){must(['agrarian','beekeeper'].includes(u.role));const a=parseApplication(d,u.role);await active(db,a.region_id);const cnt=await db.one('SELECT COUNT(*) AS n FROM applications WHERE owner_id=?',[u.actor]);must(cnt.n<20,'Тестовый лимит: 20 заявок.',409);const id=uid();await db.run('INSERT INTO applications VALUES (?,?,?,?,?,?,?)',[id,u.actor,u.role,a.region_id,JSON.stringify(a),'new',now()]);await log(db,u,'application.create',id);return json({id,status:'new',demo:true},201)}
  if(p==='/applications'&&request.method==='GET'){const rows=u.role==='admin'?await db.all('SELECT * FROM applications'):u.role==='coordinator'?await db.all('SELECT * FROM applications WHERE region_id=?',[u.region]):await db.all('SELECT * FROM applications WHERE owner_id=?',[u.actor]);return json(rows.map(r=>({id:r.id,role:r.role,region_id:r.region_id,status:r.status,data:JSON.parse(r.data)})))}
  const am=p.match(/^\/applications\/([a-f0-9-]{36})(?:\/(matches|status))?$/);
  if(am){const [,id,action]=am,a=await db.one('SELECT * FROM applications WHERE id=?',[id]);must(a&&(a.owner_id===u.actor||u.role==='admin'||u.role==='coordinator'&&u.region===a.region_id),'Заявка не найдена.',404);
   if(request.method==='DELETE'&&!action){exact(d,[]);must(a.owner_id===u.actor||u.role==='admin');if(db.deleteRecord)await db.deleteRecord('application',id,now());else await db.batch([{sql:'DELETE FROM applications WHERE id=?',params:[id]},{sql:'INSERT INTO deletions VALUES (?,?,?)',params:[id,'application',now()]}]);await log(db,u,'application.delete',id);return json({ok:true})}
   if(action==='status'&&request.method==='POST'){exact(d,['status']);must(u.role==='admin'||u.role==='coordinator'&&u.region===a.region_id);must(['new','review','matching','agreed','closed'].includes(d.status),'Неверный статус.',422);await db.run('UPDATE applications SET status=? WHERE id=?',[d.status,id]);await log(db,u,'application.status',id);return json({ok:true})}
   if(action==='matches'&&request.method==='GET'){must(a.role==='beekeeper','Подбор полей доступен заявке пчеловода.',422);const b=JSON.parse(a.data),rs=await regions(db),rows=await db.all("SELECT * FROM fields WHERE status='published'");return json(rows.filter(f=>rs.some(r=>r.id===f.region_id&&r.status==='ACTIVE')&&(u.role==='admin'||u.role==='coordinator'?f.region_id===a.region_id:true)&&['public','beekeepers'].includes(f.visibility)).map(f=>{const g=JSON.parse(f.geometry),center=g.coordinates[0][0],distance=km(b.origin,center),reasons=[];if(f.season!==b.season)reasons.push('Другой сезон');if(f.crop!==b.crop)reasons.push('Другая культура');if(f.end<b.start||f.start>b.end)reasons.push('Не совпадают сроки');if(distance>b.radius_km)reasons.push('За пределами радиуса (приближение по прямой)');if(b.families<f.families)reasons.push('Нужно больше семей: требуется совместная работа пасек');const priceMismatch=b.price&&f.price&&b.price>f.price;if(priceMismatch)reasons.push('Различается цена: предложить переговоры обеим сторонам');return {field:publicField(f),distance_km:Math.round(distance),compatible:reasons.length===0,negotiation:!!priceMismatch,reasons}}))}
  }
  if(p.startsWith('/admin/')){must(u.role==='admin');if(p==='/admin/regions'&&request.method==='POST'){exact(d,['id','status','external']);must(REGIONS.some(x=>x.id===d.id)&&['ACTIVE','DISABLED','EXTERNAL'].includes(d.status),'Неверный регион/статус.',422);must(d.status!=='EXTERNAL'||externalValid(d.external),'Нужен подтверждённый координатор, HTTPS-ссылка и источник проверки.',422);await db.run('INSERT INTO regions VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,external=excluded.external',[d.id,d.status,d.status==='EXTERNAL'?JSON.stringify(d.external):null]);await log(db,u,'region.update',d.id);return json({ok:true})}if(p==='/admin/audit'&&request.method==='GET')return json(await db.all('SELECT action,object_id,created FROM audit ORDER BY created DESC LIMIT 100'))}
  if(p.endsWith('/export'))throw new Invalid('Массовая выгрузка в этом сервисе отсутствует.',403);
  return json({error:'Маршрут не найден.'},404);
 }catch(e){if(e instanceof Invalid)return json({error:e.message},e.status);return json({error:'Ошибка сервиса. Данные запроса в журнал не записаны.'},503)}
}
