(() => {
'use strict';
const $ = s => document.querySelector(s);
const KEY='sef_vault_v1', PREF='sef_prefs', FAIL='sef_fail', AUTOLOCK_MS=5*60*1000;
const TYPES = {
  login:{label:'Lozinka',p:'Lozinke',fields:[['site','Aplikacija / sajt'],['user','Korisničko ime / mejl'],['pass','Šifra','secret'],['url','Link (za ikonu)'],['note','Napomena','area']]},
  email:{label:'Mejl',p:'Mejlovi',fields:[['addr','Mejl adresa'],['pass','Šifra','secret'],['recovery','Mejl za oporavak'],['note','Napomena','area']]},
  card:{label:'Kartica',p:'Kartice',fields:[['holder','Ime na kartici'],['num','Broj kartice','secret'],['exp','Važi do (MM/GG)'],['cvv','CVV','secret'],['pin','PIN','secret'],['bank','Banka']]},
  wifi:{label:'Wi-Fi',p:'Wi-Fi',fields:[['ssid','Naziv mreže'],['pass','Šifra','secret'],['sec','Zaštita (WPA2…)']]},
  codes:{label:'Rezervni kodovi',p:'Rezervni kodovi',fields:[['service','Servis'],['codes','Kodovi (jedan po redu)','area']]},
  qa:{label:'Sig. pitanja',p:'Sigurnosna pitanja',fields:[['service','Servis'],['q1','Pitanje 1'],['a1','Odgovor 1','secret'],['q2','Pitanje 2'],['a2','Odgovor 2','secret']]},
  note:{label:'Bilješka',p:'Bilješke',fields:[['text','Tekst','area']]}
};
const SECRET=['pass','num','cvv','pin','a1','a2','codes'];
const COLORS=['','#4fd1b0','#6ea8fe','#b794f6','#f6a35c','#ef6f9a','#e2c044','#8fb3c9','#7bd88f'];
const THEMES=[['auto','Automatska'],['dark','Tamna'],['light','Svijetla'],['midnight','Ponoć'],['paper','Papir'],['forest','Šuma'],['ocean','Okean'],['dusk','Sumrak']];
const COL={login:'#4fd1b0',email:'#6ea8fe',card:'#f6a35c',wifi:'#b794f6',codes:'#ef6f9a',qa:'#e2c044',note:'#8fb3c9',trash:'#ef6f6c'};
const IC={all:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
login:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',email:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
card:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',wifi:'<path d="M2 9a15 15 0 0120 0M5.5 12.5a10 10 0 0113 0M9 16a5 5 0 016 0"/><circle cx="12" cy="19" r="1"/>',
codes:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',qa:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
note:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'};
const ic=k=>`<svg class="ic" viewBox="0 0 24 24">${IC[k]}</svg>`;
const NAMES={};
let key=null,salt=null,entries=[],cat='all',editing=null,cur={att:[],h:[],color:''},timer,panelId=null,animateNext=true;
let prefs=JSON.parse(localStorage.getItem(PREF)||'{}');
const pwnCache=new Map();
const LOG='sef_log';
const getLog=()=>JSON.parse(localStorage.getItem(LOG)||'[]');
function logEv(k){localStorage.setItem(LOG,JSON.stringify([{t:Date.now(),k},...getLog()].slice(0,40)))}
const byPin=(a,b)=>(a.pinOrder??1e9)-(b.pinOrder??1e9)||a.title.localeCompare(b.title,'bs');
function pinToggle(e){if(e.pin)e.pin=false;else{e.pin=true;e.pinOrder=Math.max(-1,...entries.filter(x=>x.pin&&x!==e).map(x=>x.pinOrder??0))+1}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const ec=e=>e.color||COL[e.type];

/* ---------- Crypto ---------- */
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>{let s='';new Uint8Array(b).forEach(x=>s+=String.fromCharCode(x));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pw,sl){
  const base=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:sl,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encrypt(d){const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(d)));
  return {salt:b64(salt),iv:b64(iv),data:b64(ct)}}
async function decrypt(st,k){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(st.iv)},k,unb64(st.data));return JSON.parse(dec.decode(pt))}
async function save(){
  try{localStorage.setItem(KEY,JSON.stringify(await encrypt(entries)))}
  catch{toast('Nema dovoljno prostora u browseru – obriši neki prilog')}
}

/* ---------- Prefs ---------- */
function storePrefs(){localStorage.setItem(PREF,JSON.stringify(prefs))}
function applyPrefs(){
  const r=document.documentElement,st=r.style;
  if(prefs.theme&&prefs.theme!=='auto')r.dataset.theme=prefs.theme;else delete r.dataset.theme;
  if(prefs.accent){st.setProperty('--accent',prefs.accent);st.setProperty('--accent-ink','#06141a')}
  else{st.removeProperty('--accent');st.removeProperty('--accent-ink')}
  $('#optIcons').checked=!!prefs.icons;
  $('#themes').innerHTML=THEMES.map(([k,l])=>`<button type="button" data-t="${k}" class="${(prefs.theme||'auto')===k?'on':''}">${l}</button>`).join('');
  $('#swatches').innerHTML=swatches(prefs.accent||'');
  $('#vGrid').classList.toggle('on',prefs.view!=='list');$('#vList').classList.toggle('on',prefs.view==='list');
  $('#sort').value=prefs.sort||'name';$('#group').value=prefs.group||'none';$('#lockMin').value=String(prefs.lockMin||5);$('#nameIn').value=prefs.name||'';
  $('#optBlur').checked=prefs.blur!==false;$('#optNoCap').checked=!!prefs.nocap;document.body.classList.toggle('nocap',!!prefs.nocap);
}
const swatches=sel=>COLORS.map((c,i)=>i?`<button type="button" class="sw ${sel===c?'on':''}" data-c="${c}" style="background:${c}" aria-label="Boja ${i}"></button>`
  :`<button type="button" class="sw auto ${!sel?'on':''}" data-c="" title="Automatski">A</button>`).join('');
const savePrefs=()=>{storePrefs();applyPrefs();render()};
$('#swatches').onclick=e=>{const b=e.target.closest('.sw');if(!b)return;prefs.accent=b.dataset.c||null;savePrefs()};
$('#themes').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;prefs.theme=b.dataset.t;savePrefs()};
$('#optIcons').onchange=e=>{prefs.icons=e.target.checked;savePrefs()};
$('#vGrid').onclick=()=>{prefs.view='grid';animateNext=true;savePrefs()};
$('#vList').onclick=()=>{prefs.view='list';animateNext=true;savePrefs()};
$('#lockMin').onchange=e=>{prefs.lockMin=+e.target.value;storePrefs();resetTimer();toast('Automatsko zaključavanje podešeno')};
$('#nameIn').oninput=e=>{prefs.name=e.target.value.trim();storePrefs();render()};
$('#group').onchange=e=>{prefs.group=e.target.value;animateNext=true;savePrefs()};
$('#optBlur').onchange=e=>{prefs.blur=e.target.checked;savePrefs()};
$('#optNoCap').onchange=e=>{prefs.nocap=e.target.checked;savePrefs()};
$('#sort').onchange=e=>{prefs.sort=e.target.value;savePrefs()};

/* ---------- Lock ---------- */
const stored=()=>JSON.parse(localStorage.getItem(KEY)||'null');
const fails=()=>JSON.parse(localStorage.getItem(FAIL)||'{"n":0,"until":0}');
function setupLock(){
  const first=!stored();
  $('#lockTitle').textContent=first?'Napravi svoj trezor':'Otključaj trezor';
  $('#lockSub').textContent=first?'Izaberi glavnu šifru. Jedna šifra štiti sve.':'Unesi glavnu šifru.';
  $('#lockBtn').textContent=first?'Napravi trezor':'Otključaj';
  $('#master2').classList.toggle('hidden',!first);$('#master2').required=first;
  $('#lockHint').classList.toggle('hidden',!first);
}
$('#lockForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const pw=$('#master').value,msg=$('#lockMsg'),st=stored(),f=fails();
  msg.textContent='';
  if(Date.now()<f.until)return msg.textContent=`Previše pokušaja. Sačekaj ${Math.ceil((f.until-Date.now())/1000)} s.`;
  try{
    if(!st){
      if(pw.length<8)return msg.textContent='Šifra mora imati najmanje 8 znakova.';
      if(pw!==$('#master2').value)return msg.textContent='Šifre se ne poklapaju.';
      salt=crypto.getRandomValues(new Uint8Array(16));key=await deriveKey(pw,salt);entries=[];await save();
    }else{salt=unb64(st.salt);const k=await deriveKey(pw,salt);entries=await decrypt(st,k);key=k}
  }catch{
    f.n++;if(f.n>=3)f.until=Date.now()+Math.min(300,5*2**(f.n-2))*1000;
    localStorage.setItem(FAIL,JSON.stringify(f));logEv('fail');
    msg.textContent=f.n>=3?'Pogrešna šifra. Pauza prije sljedećeg pokušaja.':`Pogrešna šifra (${f.n}/3).`;
    const c=$('.lock-card');c.classList.remove('shake');void c.offsetWidth;c.classList.add('shake');return;
  }
  localStorage.removeItem(FAIL);
  {const L0=getLog(),lastOk=L0.find(x=>x.k==='ok'),fs=L0.filter(x=>x.k==='fail'&&(!lastOk||x.t>lastOk.t)).length;logEv('ok');
   const A=$('#alert');A.classList.toggle('hidden',!fs);
   if(fs)A.innerHTML=`<span>⚠ Bilo je ${fs} neuspjelih pokušaja otključavanja od tvog zadnjeg ulaska${lastOk?' ('+new Date(lastOk.t).toLocaleString('bs')+')':''}.</span><button class="btn ghost" data-log>Dnevnik</button><button class="mini" data-x aria-label="Zatvori">✕</button>`;
   if(lastOk)setTimeout(()=>toast('Zadnje otključavanje: '+new Date(lastOk.t).toLocaleString('bs')),900)}
  const n0=entries.length;entries=entries.filter(e=>!e.deleted||Date.now()-e.deleted<30*864e5);if(entries.length!==n0)await save();
  $('#master').value=$('#master2').value='';
  cat='all';animateNext=true;buildNav();render();
  $('#lock').classList.add('leaving');await sleep(reduced()?0:260);
  $('#lock').classList.add('hidden');$('#lock').classList.remove('leaving');
  $('#app').classList.remove('hidden');$('#app').classList.add('appin');
  $('#fab').classList.remove('hidden');resetTimer();
});
function lock(){
  key=null;entries=[];clearTimeout(timer);closePanel();hidePeek();shield(false);$('#alert').classList.add('hidden');
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  $('#app').classList.add('hidden');$('#app').classList.remove('appin');$('#fab').classList.add('hidden');
  $('#lock').classList.remove('hidden');
  $('#list').innerHTML='';$('#search').value='';setupLock();$('#master').focus();
}
function resetTimer(){clearTimeout(timer);if(key)timer=setTimeout(lock,(prefs.lockMin||5)*60000)}
['click','keydown','mousemove','touchstart'].forEach(ev=>document.addEventListener(ev,resetTimer,{passive:true}));
$('#lockNow').onclick=lock;
document.addEventListener('keydown',e=>{
  if(!key)return;
  if(e.altKey&&e.key.toLowerCase()==='l'){e.preventDefault();lock()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!document.querySelector('dialog[open]'))openCmd()}
  else if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();closePanel();$('#search').focus();$('#search').select()}
  else if(e.key==='Escape'&&panelId&&!document.querySelector('dialog[open]'))closePanel();
});

/* ---------- Helpers ---------- */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>new Date(t).toLocaleDateString('bs');
function buildNav(){
  const items=[['all','Sve'],...Object.entries(TYPES).map(([k,v])=>[k,v.p]),['trash','Kanta']];
  items.forEach(([k,l])=>NAMES[k]=l);
  $('#nav').innerHTML=items.map(([k,l])=>`<button data-cat="${k}" class="${k===cat?'active':''}" style="--c:${COL[k]||''}">${ic(k)}<span>${l}</span><b id="c-${k}">0</b></button>`).join('');
  $('#type').innerHTML=Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
}
function subtitle(e){const f=e.f;return f.user||f.addr||f.ssid||f.service||(f.num?'•••• '+f.num.replace(/\s/g,'').slice(-4):'')||(f.text||'').slice(0,50)}
function domain(e){const d=(e.f.url||e.f.site||'').trim().replace(/^https?:\/\//,'').split(/[\/?#]/)[0];return /^[\w-]+(\.[\w-]+)+$/.test(d)?d:''}
function safeUrl(u){u=(u||'').trim();if(/^https?:\/\//i.test(u))return u;return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u)?'https://'+u:''}
function strength(p){let s=0;if(p.length>=8)s++;if(p.length>=12)s++;if(p.length>=16)s++;
  if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^\w]/.test(p))s++;return s}
function analyze(){
  const pw=entries.filter(e=>!e.deleted&&e.f.pass),weak=pw.filter(e=>strength(e.f.pass)<=2),map={};
  pw.forEach(e=>(map[e.f.pass]=map[e.f.pass]||[]).push(e));
  const dups=Object.values(map).filter(g=>g.length>1),lim=Date.now()-365*864e5;
  const old=pw.filter(e=>(e.pwd||e.updated||Date.now())<lim),leaked=pw.filter(e=>pwnCache.get(e.f.pass)>0);
  const bad=new Set([...weak,...dups.flat(),...old,...leaked]);
  return {pw,weak,dups,old,leaked,bad,score:pw.length?Math.round(100*(1-bad.size/pw.length)):100};
}

/* ---------- Render ---------- */
function cardHTML(e,i,inTrash,drag){
  const c=ec(e),d=prefs.icons&&!e.emoji?domain(e):'',list=prefs.view==='list';
  const av=`<div class="avatar">${esc(e.emoji||e.title.charAt(0).toUpperCase())}${d?`<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64" alt="" loading="lazy">`:''}</div>`;
  const tag=`<span class="tag">${TYPES[e.type].label}</span>`;
  const star=inTrash?'':`<button class="star${e.pin?' on':''}" data-pin title="${e.pin?'Ukloni iz najčešćih':'Dodaj u najčešće'}" aria-label="Fiksiraj">★</button>`;
  const sk=['pass','num','codes','a1'].find(k=>e.f[k]),uk=e.f.user?'user':e.f.addr?'addr':'';
  const SL={pass:'Kopiraj šifru',num:'Kopiraj broj',codes:'Kopiraj kodove',a1:'Kopiraj odgovor'};
  const chips=inTrash?`<small class="muted">Još ${Math.max(0,30-Math.floor((Date.now()-e.deleted)/864e5))} dana</small><button class="chip" data-restore>Vrati</button><button class="chip danger" data-purge>Briši</button>`
    :(uk?`<button class="chip" data-copy="${uk}">Kopiraj ${uk==='addr'?'mejl':'korisnika'}</button>`:'')+(sk?`<button class="chip" data-copy="${sk}">${SL[sk]}</button>`:'');
  const attrs=`class="item${list?' row':''}" data-id="${e.id}" tabindex="0"${drag?' draggable="true"':''} style="--c:${c};--i:${Math.min(i,14)}"`;
  const info=`<strong>${esc(e.title)}</strong><span class="sub">${esc(subtitle(e))||'&nbsp;'}</span>`;
  const mini=!list&&e.type==='card'?miniCC(e):'';
  return list?`<div ${attrs}>${av}<div class="info">${info}</div>${tag}<div class="ifoot">${chips}</div>${star}</div>`
    :`<div ${attrs}><div class="ihead">${av}<div class="tags">${tag}${star}</div></div>${info}${mini}<div class="ifoot">${chips}</div></div>`;
}
function render(){
  if(!key)return;
  const q=$('#search').value.trim().toLowerCase(),act=entries.filter(e=>!e.deleted),tr=entries.filter(e=>e.deleted),inTrash=cat==='trash';
  $('#c-all').textContent=act.length;$('#c-trash').textContent=tr.length;
  Object.keys(TYPES).forEach(k=>$('#c-'+k).textContent=act.filter(e=>e.type===k).length);
  const an=analyze();
  $('#stTotal').textContent=act.length;$('#stHealth').textContent=an.score+'%';$('#stRing').style.setProperty('--p',an.score);$('#stIssues').textContent=an.bad.size;
  let rows=(inTrash?tr:act.filter(e=>cat==='all'||e.type===cat)).filter(e=>!q||(e.title+' '+Object.entries(e.f).filter(([k])=>!SECRET.includes(k)).map(x=>x[1]).join(' ')).toLowerCase().includes(q));
  rows.sort(prefs.sort==='updated'?(a,b)=>(b.updated||0)-(a.updated||0):(a,b)=>a.title.localeCompare(b.title,'bs'));
  const h=new Date().getHours();
  $('#greet').textContent=cat==='all'?(h<5?'Laku noć':h<12?'Dobro jutro':h<18?'Dobar dan':'Dobro veče')+(prefs.name?', '+prefs.name:''):'';
  $('#heroTitle').textContent=cat==='all'?'Tvoj trezor':NAMES[cat];
  $('#heroSub').textContent=rows.length+(rows.length===1?' unos':' unosa')+(q?' pronađeno':'');
  $('#stats').classList.toggle('hidden',inTrash);
  const nb=act.length&&Date.now()>(prefs.snooze||0)&&(!prefs.lastBackup||Date.now()-prefs.lastBackup>30*864e5);
  $('#banner').classList.toggle('hidden',!nb);
  if(nb)$('#banner').innerHTML=`<span>${prefs.lastBackup?'Zadnji backup je stariji od 30 dana.':'Još nisi napravio backup.'} Podaci postoje samo u ovom browseru.</span><button class="btn primary" id="bkNow">Napravi backup</button><button class="mini" id="bkLater" aria-label="Kasnije">✕</button>`;
  $('#empty').classList.toggle('hidden',rows.length>0);
  const L=$('#list');L.classList.toggle('rows',prefs.view==='list');L.classList.toggle('anim',animateNext&&!reduced());
  const pinned=!inTrash&&!q?rows.filter(e=>e.pin).sort(byPin):[],rest=pinned.length?rows.filter(e=>!e.pin):rows;
  const rec=cat==='all'&&!q?(prefs.recent||[]).map(id=>act.find(e=>e.id===id)).filter(Boolean).slice(0,5):[];
  const gm=inTrash?'none':(prefs.group||'none');
  let groups=[[pinned.length&&rest.length?'Svi unosi':'',rest]];
  if(gm==='letter'){const m={};rest.forEach(e=>{const ch=(e.title.trim()[0]||'#').toLocaleUpperCase('bs'),k=/\p{L}/u.test(ch)?ch:'#';(m[k]=m[k]||[]).push(e)});
    groups=Object.keys(m).sort((x,y)=>x==='#'?1:y==='#'?-1:x.localeCompare(y,'bs')).map(k=>[k,m[k]])}
  else if(gm==='cat')groups=Object.keys(TYPES).map(k=>[TYPES[k].p,rest.filter(e=>e.type===k)]).filter(g=>g[1].length);
  let i=0;
  L.innerHTML=(inTrash&&tr.length?'<div class="trashbar"><span class="muted">Obrisani unosi se trajno brišu nakon 30 dana.</span><button class="btn danger" id="emptyTrash">Isprazni kantu</button></div>':'')
    +(rec.length?'<h3 class="shead">Nedavno</h3><div class="recent">'+rec.map(e=>`<button class="rchip" data-open="${e.id}" style="--c:${ec(e)}"><span class="avatar">${esc(e.emoji||e.title.charAt(0).toUpperCase())}</span><span>${esc(e.title)}</span></button>`).join('')+'</div>':'')
    +(pinned.length?'<h3 class="shead">★ Najčešće</h3>'+pinned.map(e=>cardHTML(e,i++,false,true)).join(''):'')
    +groups.map(([h,list])=>(h?`<h3 class="shead">${esc(h)}<span>${list.length}</span></h3>`:'')+list.map(e=>cardHTML(e,i++,inTrash)).join('')).join('');
  animateNext=false;
}
$('#list').addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.remove()},true);
$('#list').addEventListener('click',async e=>{
  if(e.target.id==='emptyTrash'){if(confirm('Trajno obrisati sve iz kante?')){entries=entries.filter(v=>!v.deleted);await save();render()}return}
  const rc=e.target.closest('[data-open]');if(rc)return openPanel(rc.dataset.open);
  const it=e.target.closest('.item');if(!it)return;const id=it.dataset.id,en=entries.find(v=>v.id===id);if(!en)return;
  const cp=e.target.closest('[data-copy]');if(cp)return copy(en.f[cp.dataset.copy]);
  if(e.target.closest('[data-pin]')){pinToggle(en);await save();return render()}
  if(e.target.closest('[data-restore]')){delete en.deleted;await save();render();return toast('Vraćeno')}
  if(e.target.closest('[data-purge]')){if(confirm('Trajno obrisati ovaj unos? Ovo se ne može poništiti.')){entries=entries.filter(v=>v.id!==id);await save();render()}return}
  if(cat!=='trash')openPanel(id);
});
$('#list').addEventListener('keydown',e=>{if(e.key==='Enter'&&cat!=='trash'&&e.target.classList.contains('item'))openPanel(e.target.dataset.id)});
$('#nav').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  cat=b.dataset.cat;animateNext=true;document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x===b));render()});
$('#search').addEventListener('input',render);
$('#banner').addEventListener('click',e=>{
  if(e.target.id==='bkNow')exportBackup();
  if(e.target.id==='bkLater'){prefs.snooze=Date.now()+7*864e5;storePrefs();render()}});
$('#emptyAdd').onclick=()=>openEntry();$('#fab').onclick=()=>openEntry();$('#addBtn').onclick=()=>openEntry();

/* ---------- Detail panel ---------- */
function openPanel(id){
  const e=entries.find(x=>x.id===id);if(!e)return;panelId=id;
  prefs.recent=[id,...(prefs.recent||[]).filter(x=>x!==id)].slice(0,6);storePrefs();
  const T=TYPES[e.type];
  const rows=T.fields.filter(([k])=>e.f[k]).map(([k,l])=>{
    const sec=SECRET.includes(k),v=e.f[k],u=k==='url'?safeUrl(v):'';
    return `<div class="frow" data-k="${k}"><div class="flab">${l}</div>
      <div class="fval${sec?' mask':''}">${sec?'••••••••':u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>`:esc(v)}</div>
      <div class="facts">${sec?'<button class="mini" data-act="show">Prikaži</button>':''}<button class="mini" data-act="copy">Kopiraj</button>${k==='pass'?'<button class="mini" data-act="pwn">Provjeri curenje</button>':''}</div><div class="fnote"></div></div>`}).join('');
  const hist=(e.h||[]).length?`<details class="phist"><summary>Historija šifre (${e.h.length})</summary>${e.h.map((x,i)=>`<div class="hrow"><span>${fmt(x.d)}</span><code data-i="${i}">••••••••</code><button class="mini" data-h="show" data-i="${i}">Prikaži</button><button class="mini" data-h="copy" data-i="${i}">Kopiraj</button></div>`).join('')}</details>`:'';
  const atts=(e.att||[]).length?`<div class="flab" style="margin-top:14px">Prilozi</div><div class="pthumbs">${e.att.map((a,i)=>`<img src="${a.data}" alt="${esc(a.name)}" data-i="${i}">`).join('')}</div>`:'';
  $('#panelBody').innerHTML=`<div class="phead" style="--c:${ec(e)}"><div class="avatar">${esc(e.emoji||e.title.charAt(0).toUpperCase())}</div>
    <div><h2>${esc(e.title)}</h2><span class="tag">${T.label}</span></div><button class="mini x" data-act="close" aria-label="Zatvori">✕</button></div>
    <div class="pscroll">${e.type==='card'?cardVisual(e):''}${e.pin?'<div class="mvrow"><span class="muted small">Redoslijed u „Najčešće“</span><button class="mini" data-act="mvl">← Naprijed</button><button class="mini" data-act="mvr">Nazad →</button></div>':''}${rows||'<p class="muted">Nema unesenih podataka.</p>'}${atts}${hist}<p class="muted small" style="margin-top:16px">Izmijenjeno ${e.updated?fmt(e.updated):'–'}</p></div>
    <div class="pfoot"><button class="btn primary" data-act="edit">Uredi</button><button class="btn ghost" data-act="dup">Dupliraj</button><button class="btn ghost" data-act="pdf">PDF</button><button class="btn ghost" data-act="pin">${e.pin?'★ Ukloni':'☆ Fiksiraj'}</button><button class="btn danger" data-act="del">Obriši</button></div>`;
  $('#panel').classList.add('open');$('#panel').setAttribute('aria-hidden','false');$('#scrim').classList.add('show');
}
function closePanel(){const was=panelId;panelId=null;$('#panel').classList.remove('open');$('#panel').setAttribute('aria-hidden','true');$('#scrim').classList.remove('show');if(was&&key)render()}
$('#scrim').onclick=closePanel;
$('#panelBody').addEventListener('click',async ev=>{
  const e=entries.find(x=>x.id===panelId);if(!e)return;
  const th=ev.target.closest('.pthumbs img');if(th){$('#bigImg').src=e.att[+th.dataset.i].data;return $('#imgDlg').showModal()}
  const cc=ev.target.closest('[data-cc]');
  if(cc){const n=(e.f.num||'').replace(/\D/g,''),el=cc.querySelector('.cc-num'),sh=el.dataset.full==='1';el.dataset.full=sh?'0':'1';
    el.textContent=sh?'•••• •••• •••• '+n.slice(-4):(n.replace(/(.{4})/g,'$1 ').trim()||'—');return}
  const hb=ev.target.closest('[data-h]');
  if(hb){const i=+hb.dataset.i;if(hb.dataset.h==='copy')return copy(e.h[i].p);
    const c=$(`#panelBody code[data-i="${i}"]`),hid=c.textContent.startsWith('•');c.textContent=hid?e.h[i].p:'••••••••';hb.textContent=hid?'Sakrij':'Prikaži';return}
  const b=ev.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,row=b.closest('.frow'),k=row&&row.dataset.k;
  if(a==='close')return closePanel();
  if(a==='show'){const m=row.querySelector('.fval'),hid=m.classList.contains('mask');
    m.classList.toggle('mask',!hid);m.textContent=hid?e.f[k]:'••••••••';b.textContent=hid?'Sakrij':'Prikaži'}
  if(a==='copy')copy(e.f[k]);
  if(a==='pwn'){const n=row.querySelector('.fnote');n.className='fnote';n.textContent='Provjeravam…';
    const c=await pwned(e.f[k]);
    if(c===null){n.textContent='Provjera nije uspjela (nema interneta?).'}
    else if(c>0){n.className='fnote bad';n.textContent=`⚠ Ova šifra je pronađena ${c.toLocaleString('bs')} puta u poznatim curenjima. Promijeni je.`;render()}
    else{n.className='fnote good';n.textContent='✓ Nije pronađena u poznatim curenjima.'}}
  if(a==='edit'){const id=panelId;closePanel();openEntry(id)}
  if(a==='pin'){pinToggle(e);await save();render();openPanel(e.id)}
  if(a==='mvl'||a==='mvr'){movePin(e.id,a==='mvl'?-1:1);await save();render();openPanel(e.id)}
  if(a==='pdf')await downloadPdf([e],'fara-trezor-'+slug(e.title)+'.pdf',{});
  if(a==='dup'){const c=JSON.parse(JSON.stringify(e));Object.assign(c,{id:crypto.randomUUID(),title:e.title+' (kopija)',h:[],pin:false,pinOrder:undefined,updated:Date.now(),pwd:Date.now()});
    entries.push(c);await save();closePanel();render();toast('Unos dupliran')}
  if(a==='del')trashEntry(e.id);
});
async function flyToTrash(id){
  const el=$(`.item[data-id="${id}"]`),t=$('#nav [data-cat="trash"]');
  if(!el||!t||reduced())return;
  const a=el.getBoundingClientRect(),b=t.getBoundingClientRect();
  try{await el.animate([{transform:'none',opacity:1},{transform:`translate(${b.left+b.width/2-(a.left+a.width/2)}px,${b.top+b.height/2-(a.top+a.height/2)}px) scale(.08)`,opacity:0}],
    {duration:520,easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'}).finished}catch{}
}
async function trashEntry(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  closePanel();if($('#dlg').open)$('#dlg').close();
  e.deleted=Date.now();await save();await flyToTrash(id);render();
  toast('Premješteno u kantu','Poništi',async()=>{delete e.deleted;await save();render()});
}

/* ---------- Strength / HIBP ---------- */
function updateMeter(){
  const inp=$('#fields [data-k="pass"]'),box=$('#meter');
  if(!inp||!inp.value){box.classList.add('hidden');return}
  box.classList.remove('hidden');
  const v=inp.value,s=strength(v),lvl=s<=2?['Slaba','var(--danger)']:s<=4?['Srednja','#e2c044']:['Jaka','var(--accent)'];
  const bar=box.querySelector('i');bar.style.width=Math.max(12,s/6*100)+'%';bar.style.background=lvl[1];
  const dup=entries.filter(x=>!x.deleted&&x!==editing&&x.f.pass===v).map(x=>x.title);
  $('#mtxt').textContent='Jačina: '+lvl[0]+(dup.length?` · ⚠ ista šifra se koristi i za: ${dup.slice(0,3).join(', ')}`:'');
}
$('#fields').addEventListener('input',e=>{if(e.target.dataset.k==='pass')updateMeter()});
async function sha1(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-1',enc.encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}
async function pwned(p){
  if(pwnCache.has(p))return pwnCache.get(p);
  try{
    const h=await sha1(p),r=await fetch('https://api.pwnedpasswords.com/range/'+h.slice(0,5),{headers:{'Add-Padding':'true'}});
    if(!r.ok)throw 0;
    const m=(await r.text()).split('\n').map(l=>l.trim().split(':')).find(x=>x[0]===h.slice(5)),n=m?+m[1]:0;
    pwnCache.set(p,n);return n;
  }catch{return null}
}

/* ---------- Entry dialog ---------- */
function buildFields(type,vals={}){
  $('#fields').innerHTML=TYPES[type].fields.map(([k,l,kind])=>{
    if(kind==='area')return `<label class="full">${l}<textarea data-k="${k}">${esc(vals[k])}</textarea></label>`;
    if(kind==='secret')return `<label class="full">${l}<div class="pwrap"><input data-k="${k}" type="password" value="${esc(vals[k])}" autocomplete="off">
      <div class="tools"><button type="button" class="mini" data-act="show">Prikaži</button><button type="button" class="mini" data-act="copy">Kopiraj</button>${k==='pass'?'<button type="button" class="mini" data-act="gen">Nova</button>':''}</div></div></label>`;
    return `<label>${l}<input data-k="${k}" value="${esc(vals[k])}" autocomplete="off"></label>`;
  }).join('');
  updateMeter();
}
function renderHist(){
  const h=cur.h;$('#histBox').classList.toggle('hidden',!h.length);
  $('#histSum').textContent=`Historija šifre (${h.length})`;
  $('#hist').innerHTML=h.map((x,i)=>`<div class="hrow"><span>${fmt(x.d)}</span><code data-i="${i}">••••••••</code>
    <button type="button" class="mini" data-h="show" data-i="${i}">Prikaži</button><button type="button" class="mini" data-h="copy" data-i="${i}">Kopiraj</button></div>`).join('');
}
$('#hist').addEventListener('click',e=>{const b=e.target.closest('[data-h]');if(!b)return;const i=+b.dataset.i;
  if(b.dataset.h==='copy')return copy(cur.h[i].p);
  const c=$(`#hist code[data-i="${i}"]`),hid=c.textContent.startsWith('•');c.textContent=hid?cur.h[i].p:'••••••••';b.textContent=hid?'Sakrij':'Prikaži'});
function renderAtts(){
  $('#atts').innerHTML=cur.att.map((a,i)=>`<div class="thumb"><img src="${a.data}" alt="${esc(a.name)}" data-i="${i}"><button type="button" data-del="${i}" aria-label="Ukloni">×</button></div>`).join('');
}
$('#atts').addEventListener('click',e=>{
  if(e.target.dataset.del!==undefined){cur.att.splice(+e.target.dataset.del,1);renderAtts()}
  else if(e.target.tagName==='IMG'){$('#bigImg').src=cur.att[+e.target.dataset.i].data;$('#imgDlg').showModal()}});
$('#imgClose').onclick=()=>$('#imgDlg').close();
$('#attBtn').onclick=()=>$('#attFile').click();
$('#attFile').onchange=async e=>{
  for(const f of e.target.files){
    try{const bmp=await createImageBitmap(f),sc=Math.min(1,1280/Math.max(bmp.width,bmp.height));
      const c=document.createElement('canvas');c.width=bmp.width*sc;c.height=bmp.height*sc;
      c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
      cur.att.push({name:f.name,data:c.toDataURL('image/jpeg',.8)});
    }catch{toast('Slika '+f.name+' nije podržana')}
  }
  e.target.value='';renderAtts();
};
$('#ecolors').onclick=e=>{const b=e.target.closest('.sw');if(!b)return;cur.color=b.dataset.c;$('#ecolors').innerHTML=swatches(cur.color)};
function openEntry(id){
  editing=id?entries.find(e=>e.id===id):null;
  cur={att:editing?[...(editing.att||[])]:[],h:editing?[...(editing.h||[])]:[],color:editing?editing.color||'':''};
  $('#dlgTitle').textContent=editing?'Uredi unos':'Novi unos';
  $('#type').value=editing?editing.type:(TYPES[cat]?cat:'login');$('#type').disabled=!!editing;
  $('#title').value=editing?editing.title:'';$('#emoji').value=editing?editing.emoji||'':'';
  $('#ecolors').innerHTML=swatches(cur.color);
  buildFields($('#type').value,editing?editing.f:{});
  $('#delBtn').classList.toggle('hidden',!editing);
  renderHist();renderAtts();$('#dlg').showModal();
}
$('#type').onchange=()=>buildFields($('#type').value);
$('#cancelBtn').onclick=()=>$('#dlg').close();
$('#fields').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const inp=b.closest('.pwrap').querySelector('input');
  if(b.dataset.act==='show'){const h=inp.type==='password';inp.type=h?'text':'password';b.textContent=h?'Sakrij':'Prikaži'}
  if(b.dataset.act==='copy')copy(inp.value);
  if(b.dataset.act==='gen'){inp.value=genPass(16,true);inp.type='text';updateMeter()}
});
$('#entryForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const f={};$('#fields').querySelectorAll('[data-k]').forEach(i=>f[i.dataset.k]=i.value);
  const title=$('#title').value.trim();if(!title)return;
  const emoji=Array.from($('#emoji').value.trim()).slice(0,2).join(''),color=cur.color||'';
  if(editing){
    if(editing.f.pass&&f.pass!==editing.f.pass){cur.h.unshift({p:editing.f.pass,d:Date.now()});editing.pwd=Date.now()}
    Object.assign(editing,{title,f,emoji,color,att:cur.att,h:cur.h.slice(0,10),updated:Date.now()});
  }else entries.push({id:crypto.randomUUID(),type:$('#type').value,title,f,emoji,color,att:cur.att,h:[],updated:Date.now(),pwd:Date.now()});
  await save();$('#dlg').close();render();toast('Sačuvano');
});
$('#delBtn').onclick=()=>{if(editing)trashEntry(editing.id)};

/* ---------- Generator ---------- */
function genPass(n=16,sym=true){
  const set='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'+(sym?'!@#$%^&*-_=+?':'');
  return Array.from(crypto.getRandomValues(new Uint32Array(n)),v=>set[v%set.length]).join('');
}
const newGen=()=>{const v=$('#genOut').value=genPass(+$('#len').value,$('#optSym').checked),s=strength(v),b=$('#genBar');b.style.width=Math.max(12,s/6*100)+'%';b.style.background=s<=2?'var(--danger)':s<=4?'#e2c044':'var(--accent)'};
$('#genBtn').onclick=()=>{newGen();$('#genDlg').showModal()};
$('#len').oninput=()=>{$('#lenVal').textContent=$('#len').value;newGen()};
$('#optSym').onchange=newGen;$('#genNew').onclick=newGen;
$('#genCopy').onclick=()=>copy($('#genOut').value);$('#genClose').onclick=()=>$('#genDlg').close();

/* ---------- Security review ---------- */
function renderSec(){
  const {pw,weak,dups,old,leaked,score}=analyze();
  const row=(e,d)=>`<div class="srow"><span><b>${esc(e.title)}</b><small>${esc(d)}</small></span><button class="mini" data-open="${e.id}">Otvori</button></div>`;
  const sec=(t,n,body)=>`<div class="sgroup"><h3>${t} (${n})</h3>${n?body:'<div class="ok">Sve u redu.</div>'}</div>`;
  $('#secBody').innerHTML=`<div class="score"><b>${score}%</b><span class="muted">zdravlje šifri · provjereno ${pw.length}</span></div><div class="meter"><i style="width:${score}%;background:var(--accent)"></i></div>`
    +sec('Slabe šifre',weak.length,weak.map(e=>row(e,'Kratka ili jednostavna šifra')).join(''))
    +sec('Duplirane šifre',dups.length,dups.map(g=>`<div class="muted" style="margin-top:8px">Ista šifra u ${g.length} unosa:</div>`+g.map(e=>row(e,TYPES[e.type].label)).join('')).join(''))
    +sec('Stare šifre (preko godinu dana)',old.length,old.map(e=>row(e,'Mijenjana prije '+Math.floor((Date.now()-(e.pwd||e.updated))/864e5)+' dana')).join(''))
    +sec('Procurene šifre',leaked.length,leaked.map(e=>row(e,`Pronađena ${pwnCache.get(e.f.pass).toLocaleString('bs')} puta u curenjima`)).join(''))
    +`<div class="sgroup"><button class="btn ghost" data-pwnall>Provjeri procurene šifre (Have I Been Pwned)</button>
      <p class="muted small">Šalje se samo prvih 5 znakova SHA-1 otiska šifre, nikad cijela šifra.</p></div>`;
}
$('#secBtn').onclick=()=>{renderSec();$('#secDlg').showModal()};
$('#stHealthBtn').onclick=$('#secBtn').onclick;
$('#secClose').onclick=()=>$('#secDlg').close();
$('#secBody').addEventListener('click',async e=>{
  const o=e.target.closest('[data-open]');if(o){$('#secDlg').close();return openPanel(o.dataset.open)}
  const b=e.target.closest('[data-pwnall]');if(!b)return;
  const list=[...new Set(entries.filter(x=>!x.deleted&&x.f.pass).map(x=>x.f.pass))].filter(p=>!pwnCache.has(p));
  let i=0,fail=false;
  for(const p of list){b.disabled=true;b.textContent=`Provjeravam ${++i}/${list.length}…`;if(await pwned(p)===null){fail=true;break}await sleep(120)}
  renderSec();render();toast(fail?'Provjera prekinuta – nema interneta?':'Provjera gotova');
});

/* ---------- Settings, backup, PDF, CSV ---------- */
$('#setBtn').onclick=()=>{applyPrefs();$('#sDlg').showModal()};
$('#sClose').onclick=()=>$('#sDlg').close();
$('#pwBtn').onclick=()=>{$('#pwForm').reset();$('#pwMsg').textContent='';$('#pwDlg').showModal()};
$('#pwCancel').onclick=()=>$('#pwDlg').close();
$('#pwForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('#pwMsg'),n=$('#pwNew').value;msg.textContent='';
  try{await decrypt(stored(),await deriveKey($('#pwOld').value,unb64(stored().salt)))}catch{return msg.textContent='Trenutna šifra nije tačna.'}
  if(n.length<8)return msg.textContent='Nova šifra mora imati najmanje 8 znakova.';
  if(n!==$('#pwNew2').value)return msg.textContent='Nove šifre se ne poklapaju.';
  salt=crypto.getRandomValues(new Uint8Array(16));key=await deriveKey(n,salt);await save();
  $('#pwDlg').close();toast('Glavna šifra je promijenjena');
});
function download(blob,name){const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:name});document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
function exportBackup(){
  download(new Blob([localStorage.getItem(KEY)],{type:'application/json'}),'fara-trezor-backup-'+new Date().toISOString().slice(0,10)+'.json');
  prefs.lastBackup=Date.now();storePrefs();render();toast('Šifrovani backup preuzet');
}
$('#exportBtn').onclick=exportBackup;
$('#importBtn').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const st=JSON.parse(await file.text()),pw=prompt('Unesi glavnu šifru ovog backupa:');if(!pw)return;
    const k=await deriveKey(pw,unb64(st.salt)),data=await decrypt(st,k);
    if(!confirm(`Ovo zamjenjuje trenutnih ${entries.length} unosa sa ${data.length} iz backupa. Nastaviti?`))return;
    salt=unb64(st.salt);key=k;entries=data;await save();render();toast('Backup uvezen');
  }catch{toast('Neispravan backup ili pogrešna šifra')}
  e.target.value='';
};
/* ---------- PDF ---------- */
const slug=t=>(t||'unos').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w]+/g,'-').replace(/^-|-$/g,'')||'unos';
const loadScript=src=>new Promise((res,rej)=>{const sc=document.createElement('script');sc.src=src;sc.onload=res;sc.onerror=rej;document.head.appendChild(sc)});
let pdfLoad=null;
function ensurePdf(){
  const ok=()=>!!(window.pdfMake&&pdfMake.createPdf&&pdfMake.vfs);
  if(ok())return Promise.resolve(true);
  return pdfLoad||(pdfLoad=loadScript('pdfmake.bundle.js').then(ok).catch(()=>false).then(r=>{if(!r)pdfLoad=null;return r}));
}
function printFallback(list){
  const f=document.createElement('iframe');f.style.cssText='position:fixed;width:0;height:0;border:0';document.body.appendChild(f);
  const body=list.slice().sort((a,b)=>a.title.localeCompare(b.title,'bs')).map(e=>`<h2>${esc(e.title)} <small>${TYPES[e.type].label}</small></h2><table>${TYPES[e.type].fields.filter(([k])=>e.f[k]).map(([k,l])=>`<tr><td>${l}</td><td>${esc(e.f[k]).replace(/\n/g,'<br>')}</td></tr>`).join('')}</table>`).join('');
  f.contentDocument.write(`<!doctype html><meta charset="utf-8"><title>fara Trezor</title><style>body{font:14px system-ui,sans-serif;margin:30px}h1{color:#0f6b57}h2{margin:22px 0 6px;border-bottom:2px solid #0f6b57;color:#0f6b57;break-after:avoid}small{color:#888;font-weight:400}table{width:100%;border-collapse:collapse;break-inside:avoid}td{border:1px solid #ddd;padding:6px 10px}td:first-child{width:28%;color:#667;background:#f4f7f9}</style><h1>fara Trezor – izvod trezora</h1>${body}`);
  f.contentDocument.close();setTimeout(()=>{f.contentWindow.focus();f.contentWindow.print();setTimeout(()=>f.remove(),3000)},300);
}
async function downloadPdf(list,name,meta){
  if(!list.length)return toast('Nema unosa za izvoz');
  toast('Pripremam PDF…');
  if(!await ensurePdf()){toast('Datoteka pdfmake.bundle.js nije pronađena uz sajt – otvaram štampu, izaberi „Spremi kao PDF“');return printFallback(list)}
  pdfMake.createPdf(window.SefPdf.build(list,TYPES,COL,meta)).download(name);
}
const day=()=>new Date().toISOString().slice(0,10);
function pickedEntries(){
  if(document.querySelector('input[name=pdfmode]:checked').value==='all')return entries.filter(e=>!e.deleted);
  const ids=new Set([...document.querySelectorAll('#pdfPick .pitem input:checked')].map(i=>i.value));
  return entries.filter(e=>!e.deleted&&ids.has(e.id));
}
function buildPick(){
  $('#pdfPick').innerHTML=Object.keys(TYPES).map(k=>{
    const l=entries.filter(e=>!e.deleted&&e.type===k).sort((a,b)=>a.title.localeCompare(b.title,'bs'));
    return l.length?`<div class="pgrp"><span style="color:${COL[k]}">${TYPES[k].p} (${l.length})</span><input type="checkbox" data-grp="${k}" aria-label="Sve u grupi" checked></div>`+l.map(e=>`<label class="pitem"><input type="checkbox" value="${e.id}" data-t="${k}" checked> ${esc(e.emoji||'')} ${esc(e.title)}</label>`).join(''):'';
  }).join('');
}
function pdfCount(){
  const pick=document.querySelector('input[name=pdfmode]:checked').value==='pick';
  $('#pdfPick').classList.toggle('hidden',!pick);
  const n=pickedEntries().length;$('#pdfCount').textContent=n+(n===1?' unos':' unosa');$('#pdfGo').disabled=!n;
}
$('#pdfBtn').onclick=()=>{$('#sDlg').close();buildPick();document.querySelector('input[name=pdfmode][value=all]').checked=true;$('#pdfSep').checked=false;pdfCount();$('#pdfDlg').showModal();ensurePdf()};
$('#pdfDlg').addEventListener('change',e=>{
  if(e.target.dataset.grp)document.querySelectorAll(`#pdfPick .pitem input[data-t="${e.target.dataset.grp}"]`).forEach(i=>i.checked=e.target.checked);
  pdfCount();
});
$('#pdfCancel').onclick=()=>$('#pdfDlg').close();
$('#pdfGo').onclick=async()=>{
  const sel=pickedEntries(),all=document.querySelector('input[name=pdfmode]:checked').value==='all';
  $('#pdfDlg').close();
  if($('#pdfSep').checked&&sel.length>1){
    for(const e of sel){await downloadPdf([e],'fara-trezor-'+slug(e.title)+'.pdf',{});await sleep(600)}
    toast(`Preuzeto PDF-ova: ${sel.length}`);
  }else await downloadPdf(sel,'fara-trezor-sifre-'+day()+'.pdf',all?{score:analyze().score}:{});
};
function parseCSV(t){
  const rows=[];let r=[],c='',q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch==='"')q=true;else if(ch===','){r.push(c);c=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(c);c='';rows.push(r);r=[]}
    else c+=ch}
  if(c||r.length){r.push(c);rows.push(r)}
  return rows.filter(r=>r.some(x=>x));
}
$('#csvBtn').onclick=()=>$('#csvFile').click();
$('#csvFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const rows=parseCSV((await file.text()).replace(/^\uFEFF/,''));e.target.value='';
  if(rows.length<2)return toast('CSV je prazan');
  const h=rows[0].map(x=>x.trim().toLowerCase()),ix=(...n)=>h.findIndex(x=>n.includes(x));
  const iN=ix('name','title'),iU=ix('url','login_uri'),iUs=ix('username','login_username'),iP=ix('password','login_password'),iNo=ix('note','notes'),iT=ix('type');
  if(iP<0&&iT<0)return toast('Nepoznat CSV format');
  let added=0;
  for(const r of rows.slice(1)){
    const g=i=>i>=0?(r[i]||'').trim():'';
    const isNote=g(iT)==='note'&&!g(iP),title=g(iN)||g(iU)||'Bez naziva';
    const f=isNote?{text:g(iNo)}:{site:g(iN),user:g(iUs),pass:g(iP),url:g(iU),note:g(iNo)};
    if(entries.some(x=>x.title===title&&x.f.user===f.user&&x.f.pass===f.pass&&x.f.text===f.text))continue;
    entries.push({id:crypto.randomUUID(),type:isNote?'note':'login',title,f,emoji:'',color:'',att:[],h:[],updated:Date.now(),pwd:Date.now()});added++;
  }
  await save();render();toast(`Uvezeno unosa: ${added}`);
};

/* ---------- Peek, drag & drop ---------- */
const canHover=matchMedia('(hover:hover)').matches;let peekT,dragId=null;
function hidePeek(){clearTimeout(peekT);$('#peek').classList.remove('show')}
function showPeek(it){
  const e=entries.find(x=>x.id===it.dataset.id);if(!e||e.deleted||panelId)return;
  const lines=TYPES[e.type].fields.filter(([k])=>e.f[k]).slice(0,6).map(([k,l])=>{
    let v=e.f[k];if(k==='num')v='•••• '+v.replace(/\D/g,'').slice(-4);else if(SECRET.includes(k))v='••••••••';else if(v.length>60)v=v.slice(0,60)+'…';
    return `<div class="pk"><span>${l}</span><b>${esc(v)}</b></div>`}).join('');
  const P=$('#peek');
  P.innerHTML=`<div class="pk-h"><i style="background:${ec(e)}"></i>${esc(e.title)}</div>${lines}<div class="pk-f">Izmijenjeno ${e.updated?fmt(e.updated):'–'}${(e.h||[]).length?` · ${e.h.length} stare šifre`:''}${(e.att||[]).length?` · ${e.att.length} slika`:''}</div>`;
  const r=it.getBoundingClientRect(),pw=P.offsetWidth,ph=P.offsetHeight;let x=r.right+12,y=r.top;
  if(x+pw>innerWidth-12)x=r.left-pw-12;
  if(x<12){x=Math.max(12,Math.min(r.left,innerWidth-pw-12));y=r.bottom+10;if(y+ph>innerHeight-12)y=r.top-ph-10}
  P.style.left=x+'px';P.style.top=Math.max(12,Math.min(y,innerHeight-ph-12))+'px';P.classList.add('show');
}
const LST=$('#list');
LST.addEventListener('mouseover',e=>{if(!canHover||dragId)return;const it=e.target.closest('.item');if(!it||it.contains(e.relatedTarget))return;clearTimeout(peekT);peekT=setTimeout(()=>showPeek(it),380)});
LST.addEventListener('mouseout',e=>{const it=e.target.closest('.item');if(it&&!it.contains(e.relatedTarget))hidePeek()});
LST.addEventListener('click',hidePeek);
LST.addEventListener('mousemove',e=>{const it=e.target.closest('.item');if(it){const r=it.getBoundingClientRect();it.style.setProperty('--mx',e.clientX-r.left+'px');it.style.setProperty('--my',e.clientY-r.top+'px')}});
window.addEventListener('scroll',hidePeek,{passive:true});
function reorderPins(from,to){
  const p=entries.filter(x=>x.pin&&!x.deleted).sort(byPin),a=p.findIndex(x=>x.id===from),b=p.findIndex(x=>x.id===to);if(a<0||b<0)return;
  p.splice(b,0,p.splice(a,1)[0]);p.forEach((x,n)=>x.pinOrder=n);
}
function movePin(id,d){
  const p=entries.filter(x=>x.pin&&!x.deleted).sort(byPin),i=p.findIndex(x=>x.id===id),j=i+d;if(i<0||j<0||j>=p.length)return;
  [p[i],p[j]]=[p[j],p[i]];p.forEach((x,n)=>x.pinOrder=n);
}
const dragItem=e=>e.target.closest&&e.target.closest('.item[draggable="true"]');
LST.addEventListener('dragstart',e=>{const it=dragItem(e);if(!it)return;hidePeek();dragId=it.dataset.id;it.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId)});
LST.addEventListener('dragover',e=>{const it=dragItem(e);if(!it||!dragId)return;e.preventDefault();document.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));if(it.dataset.id!==dragId)it.classList.add('drop')});
LST.addEventListener('drop',async e=>{const it=dragItem(e);if(!it||!dragId)return;e.preventDefault();reorderPins(dragId,it.dataset.id);dragId=null;await save();render()});
LST.addEventListener('dragend',()=>{dragId=null;document.querySelectorAll('.dragging,.drop').forEach(x=>x.classList.remove('dragging','drop'))});

/* ---------- Bank card visual ---------- */
function brand(n){return /^4/.test(n)?'VISA':/^(5[1-5]|2[2-7])/.test(n)?'MASTERCARD':/^3[47]/.test(n)?'AMEX':''}
function cardVisual(e){
  const n=(e.f.num||'').replace(/\D/g,'');
  return `<div class="cc" style="--c:${ec(e)}" data-cc><div class="cc-top"><span>${esc(e.f.bank||'')}</span><span>${brand(n)}</span></div><div class="cc-chip"></div>
    <div class="cc-num" data-full="0">•••• •••• •••• ${esc(n.slice(-4)||'••••')}</div>
    <div class="cc-bot"><div><small>VLASNIK</small><span>${esc(e.f.holder||'—')}</span></div><div><small>VAŽI DO</small><span>${esc(e.f.exp||'––/––')}</span></div></div></div>
    <p class="muted small center">Klikni na karticu da prikažeš ili sakriješ broj</p>`;
}
function miniCC(e){
  const n=(e.f.num||'').replace(/\D/g,'');
  return `<div class="cc mini" style="--c:${ec(e)}"><div class="cc-top"><span>${esc(e.f.bank||'Kartica')}</span><span>${brand(n)}</span></div><div class="cc-num">•••• ${esc(n.slice(-4)||'••••')}</div><div class="cc-top"><span>${esc(e.f.holder||'')}</span><span>${esc(e.f.exp||'')}</span></div></div>`;
}

/* ---------- Privacy: blur, no-capture, activity log ---------- */
function shield(on){document.body.classList.toggle('pblur',!!on&&!!key)}
window.addEventListener('blur',()=>{if(prefs.blur!==false)shield(true)});
window.addEventListener('focus',()=>shield(false));
document.addEventListener('visibilitychange',()=>document.hidden?(prefs.blur!==false&&shield(true)):shield(false));
$('#shield').onclick=()=>shield(false);
document.addEventListener('contextmenu',e=>{if(prefs.nocap&&key&&!/INPUT|TEXTAREA/.test(e.target.tagName))e.preventDefault()});
document.addEventListener('keydown',e=>{if(prefs.nocap&&key&&e.key==='PrintScreen'){shield(true);navigator.clipboard&&navigator.clipboard.writeText('').catch(()=>{});setTimeout(()=>shield(false),1800)}});
function openLog(){
  const L=getLog(),ok=L.find(x=>x.k==='ok'),fs=L.filter(x=>x.k==='fail').length;
  $('#logBody').innerHTML=`<div class="stats lstats"><div class="stat"><span>Zadnje otključavanje</span><b style="font-size:17px">${ok?new Date(ok.t).toLocaleString('bs'):'–'}</b></div><div class="stat"><span>Neuspjeli pokušaji</span><b>${fs}</b><small>u zadnjih ${L.length} događaja</small></div></div>`
    +(L.length?L.map(x=>`<div class="lrow ${x.k}"><span>${x.k==='ok'?'✓ Otključano':'✗ Pogrešna šifra'}</span><small>${new Date(x.t).toLocaleString('bs')}</small></div>`).join(''):'<p class="muted">Nema zapisa.</p>');
  $('#logDlg').showModal();
}
$('#logBtn').onclick=()=>{$('#sDlg').close();openLog()};
$('#logClose').onclick=()=>$('#logDlg').close();
$('#logClear').onclick=()=>{if(confirm('Obrisati dnevnik aktivnosti?')){localStorage.removeItem(LOG);openLog()}};
$('#alert').addEventListener('click',e=>{if(e.target.dataset.x!==undefined)$('#alert').classList.add('hidden');if(e.target.dataset.log!==undefined)openLog()});

/* ---------- Command palette ---------- */
let cmdSel=0,cmdRows=[];
function cmdBuild(q){
  q=q.trim().toLowerCase();
  const acts=[['Novi unos','Akcija',()=>openEntry()],['Generator šifri','Akcija',()=>$('#genBtn').click()],['Sigurnosni pregled','Akcija',()=>$('#secBtn').click()],['Postavke','Akcija',()=>$('#setBtn').click()],['Izvezi u PDF','Akcija',()=>{$('#setBtn').click();$('#pdfBtn').click()}],['Zaključaj','Akcija',lock],
    ...THEMES.map(([k,l])=>['Tema: '+l,'Tema',()=>{prefs.theme=k;savePrefs()}])];
  const ents=entries.filter(e=>!e.deleted).map(e=>[e.title,TYPES[e.type].label,()=>openPanel(e.id),e]);
  const m=r=>!q||(r[0]+' '+r[1]).toLowerCase().includes(q);
  cmdRows=q?[...ents.filter(m),...acts.filter(m)].slice(0,9):[...acts.slice(0,5),...(prefs.recent||[]).map(id=>ents.find(x=>x[3].id===id)).filter(Boolean).slice(0,3)];
  cmdSel=0;cmdPaint();
}
function cmdPaint(){
  $('#cmdList').innerHTML=cmdRows.length?cmdRows.map((r,i)=>`<button class="crow${i===cmdSel?' on':''}" data-i="${i}"><span class="cdot" style="background:${r[3]?ec(r[3]):'var(--accent)'}"></span><b>${esc(r[0])}</b><small>${r[1]}</small></button>`).join(''):'<p class="muted center">Nema rezultata.</p>';
  const on=$('#cmdList .on');if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest'});
}
function cmdRun(i){const r=cmdRows[i];if(!r)return;$('#cmd').close();setTimeout(r[2],30)}
function openCmd(){if(!key)return;closePanel();hidePeek();$('#cmdIn').value='';cmdBuild('');$('#cmd').showModal();$('#cmdIn').focus()}
$('#cmdBtn').onclick=openCmd;
$('#cmdIn').addEventListener('input',e=>cmdBuild(e.target.value));
$('#cmdIn').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();cmdSel=(cmdSel+(e.key==='ArrowDown'?1:-1)+cmdRows.length)%Math.max(1,cmdRows.length);cmdPaint()}
  else if(e.key==='Enter'){e.preventDefault();cmdRun(cmdSel)}});
$('#cmdList').addEventListener('click',e=>{const b=e.target.closest('.crow');if(b)cmdRun(+b.dataset.i)});
$('#cmd').addEventListener('click',e=>{if(e.target===$('#cmd'))$('#cmd').close()});

/* ---------- Lock screen extras ---------- */
$('#eye').onclick=()=>{const h=$('#master').type==='password';$('#master').type=h?'text':'password';$('#master2').type=$('#master').type;$('#eye').textContent=h?'Sakrij':'Prikaži'};
['keydown','keyup'].forEach(ev=>$('#lockForm').addEventListener(ev,e=>$('#caps').classList.toggle('hidden',!(e.getModifierState&&e.getModifierState('CapsLock')))));

/* ---------- Misc ---------- */
async function copy(t){
  if(!t)return;
  try{await navigator.clipboard.writeText(t);toast('Kopirano (briše se za 30 s)');setTimeout(()=>navigator.clipboard.writeText('').catch(()=>{}),30000)}
  catch{toast('Kopiranje nije uspjelo')}
}
let tt;function toast(m,label,fn){
  const t=$('#toast');t.textContent=m;t.classList.toggle('act',!!label);
  if(label){const b=document.createElement('button');b.className='tbtn';b.textContent=label;b.onclick=()=>{t.classList.remove('show');fn()};t.appendChild(b)}
  t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),label?6000:2400)}

applyPrefs();setupLock();
})();
