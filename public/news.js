const el=document.querySelector('#news-grid');
const calendar=document.querySelector('#events-calendar');
const archive=document.querySelector('#news-archive');
const buttons=[...document.querySelectorAll('[data-filter]')];
let items=[];
const fmt=d=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00'));
const eventDates=n=>n.eventLabel||(!n.eventStart?'':(n.eventStart===n.eventEnd?fmt(n.eventStart):fmt(n.eventStart).replace(/\s\d{4}\sг\.?$/,'')+' — '+fmt(n.eventEnd)));
function card(n){
  const event=n.eventStart?'<p><b>Событие:</b> '+eventDates(n)+(n.location?'<br><b>'+n.location+'</b>':'')+'</p>':'';
  const notice=n.notice?'<div style="font-weight:900;color:#8c2a12;background:#fff1e9;border:1px solid #e6ac91;border-radius:9px;padding:8px 10px;margin-bottom:10px">'+n.notice+'</div>':'';
  const published='Опубликовано: '+fmt(n.published)+(n.updated?' · Обновлено: '+fmt(n.updated):'');
  return '<article class="card"><img src="'+n.image+'" alt="" loading="lazy"><div class="card-body">'+notice+'<div class="meta"><span class="pill gold">'+n.category+'</span><span class="pill">'+n.region+'</span></div><h3>'+n.title+'</h3><p class="source">'+published+'</p><p>'+n.summary+'</p>'+event+'<a class="read" href="'+n.url+'">Читать →</a></div></article>'
}
function render(filter='Все'){
  const today=new Date().toISOString().slice(0,10);
  const current=items.filter(n=>!n.eventEnd||n.eventEnd>=today);
  const past=items.filter(n=>n.eventEnd&&n.eventEnd<today);
  const filtered=current.filter(n=>filter==='Все'||n.region===filter||n.category===filter||(filter==='Самарская область'&&n.subregion==='Самарская область'));
  el.innerHTML=filtered.length?filtered.map(card).join(''):'<p class="archive-note">Пока публикаций по этому фильтру нет.</p>';
  const events=current.filter(n=>n.eventStart).sort((a,b)=>a.eventStart.localeCompare(b.eventStart));
  calendar.innerHTML=events.length?events.map(n=>'<div class="event-row"><div class="event-date">'+eventDates(n)+'</div><b>'+n.title+'</b><div>'+n.location+'</div></div>').join(''):'<div class="archive-note">Предстоящих мероприятий в реестре пока нет.</div>';
  archive.innerHTML=past.length?past.map(card).join(''):'<div class="archive-note">Архив пока пуст. После завершения события карточки автоматически будут отображаться здесь.</div>'
}
buttons.forEach(b=>b.addEventListener('click',()=>{buttons.forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.filter)}));
fetch('../news-data.json').then(r=>r.json()).then(data=>{items=data.sort((a,b)=>(b.updated||b.published).localeCompare(a.updated||a.published));render()}).catch(()=>{el.innerHTML='<p class="archive-note">Не удалось загрузить реестр новостей.</p>'});